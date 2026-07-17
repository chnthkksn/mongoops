import { betterAuth, APIError } from 'better-auth';
import { organization, twoFactor } from 'better-auth/plugins';
import { apiKey } from '@better-auth/api-key';
import { MongoClient, Db, ObjectId } from 'mongodb';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';

const mongoUrl = process.env.MONGO_URL ?? 'mongodb://localhost:27017/mongoops';
const client = new MongoClient(mongoUrl);
const db = client.db();

interface WriteAuditLogInput {
  orgId: string;
  actorUserId: string;
  actorName: string;
  action: string;
  targetLabel: string;
  metadata?: Record<string, unknown>;
}

async function writeAuditLog(database: Db, input: WriteAuditLogInput) {
  try {
    await database.collection('auditlogs').insertOne({
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      action: input.action,
      targetLabel: input.targetLabel,
      metadata: input.metadata ?? null,
      createdAt: new Date(),
    });
  } catch {
    // Audit logging must never break the underlying org operation.
  }
}

export const auth = betterAuth({
  database: mongodbAdapter(db, { client }),
  baseURL: process.env.AUTH_BASE_URL ?? 'http://localhost:3001',
  trustedOrigins: [process.env.WEB_ORIGIN ?? 'http://localhost:3000'],
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    organization({
      sendInvitationEmail(data) {
        const inviteLink = `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/accept-invitation/${data.id}`;
        console.log(
          `[invitation] ${data.email} invited to ${data.organization.name}: ${inviteLink}`,
        );
        return Promise.resolve();
      },
      organizationHooks: {
        beforeCreateOrganization: async ({ user }) => {
          const ownedCount = await db.collection('member').countDocuments({
            userId: ObjectId.isValid(user.id) ? new ObjectId(user.id) : user.id,
            role: 'owner',
          });
          if (ownedCount > 0) {
            throw new APIError('BAD_REQUEST', {
              message:
                'You already own an organization. Each user can own at most one organization, though you can still join others as a member.',
            });
          }
        },
        // Note: `user` in these three member hooks is the member being
        // acted on, not the admin performing the action — better-auth
        // doesn't pass the actor through to these callbacks. So these
        // entries are logged as subject-based events ("X joined as...")
        // rather than actor-based ones ("Y added X"), to avoid attributing
        // the action to the wrong person.
        afterAddMember: async ({ member, user, organization: org }) => {
          await writeAuditLog(db, {
            orgId: org.id,
            actorUserId: user.id,
            actorName: user.name,
            action: 'member.added',
            targetLabel: member.role,
          });
        },
        afterRemoveMember: async ({ user, organization: org }) => {
          await writeAuditLog(db, {
            orgId: org.id,
            actorUserId: user.id,
            actorName: user.name,
            action: 'member.removed',
            targetLabel: user.email,
          });
        },
        afterUpdateMemberRole: async ({
          member,
          previousRole,
          user,
          organization: org,
        }) => {
          await writeAuditLog(db, {
            orgId: org.id,
            actorUserId: user.id,
            actorName: user.name,
            action: 'member.role_updated',
            targetLabel: member.role,
            metadata: { previousRole, newRole: member.role },
          });
        },
        afterCreateInvitation: async ({
          invitation,
          inviter,
          organization: org,
        }) => {
          await writeAuditLog(db, {
            orgId: org.id,
            actorUserId: inviter.id,
            actorName: inviter.name,
            action: 'invitation.created',
            targetLabel: invitation.email,
            metadata: { role: invitation.role },
          });
        },
        afterAcceptInvitation: async ({
          invitation,
          user,
          organization: org,
        }) => {
          await writeAuditLog(db, {
            orgId: org.id,
            actorUserId: user.id,
            actorName: user.name,
            action: 'invitation.accepted',
            targetLabel: invitation.email,
          });
        },
        afterCancelInvitation: async ({
          invitation,
          cancelledBy,
          organization: org,
        }) => {
          await writeAuditLog(db, {
            orgId: org.id,
            actorUserId: cancelledBy.id,
            actorName: cancelledBy.name,
            action: 'invitation.canceled',
            targetLabel: invitation.email,
          });
        },
      },
    }),
    apiKey({ enableMetadata: true }),
    twoFactor(),
  ],
});
