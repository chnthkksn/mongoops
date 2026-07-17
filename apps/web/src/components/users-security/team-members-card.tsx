"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";

type OrgRole = "owner" | "admin" | "member";

interface MemberRow {
  id: string;
  role: string;
  user: { name: string; email: string };
}

interface InvitationRow {
  id: string;
  email: string;
  role: string;
  status: string;
}

export function TeamMembersCard() {
  const { data: activeRole } = authClient.useActiveMemberRole();
  const canManage = activeRole?.role === "owner" || activeRole?.role === "admin";

  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [invitations, setInvitations] = useState<InvitationRow[] | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("member");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    authClient.organization.listMembers().then(({ data }) => {
      setMembers((data?.members as MemberRow[]) ?? []);
    });
    authClient.organization.listInvitations().then(({ data }) => {
      setInvitations(((data as InvitationRow[]) ?? []).filter((i) => i.status === "pending"));
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error: inviteError } = await authClient.organization.inviteMember({
      email: inviteEmail,
      role: inviteRole,
    });
    setLoading(false);
    if (inviteError || !data) {
      setError(inviteError?.message ?? "Could not send invitation");
      return;
    }
    setInviteLink(`${window.location.origin}/accept-invitation/${data.id}`);
    setInviteEmail("");
    load();
  }

  async function onCancelInvitation(id: string) {
    await authClient.organization.cancelInvitation({ invitationId: id });
    load();
  }

  async function onRemoveMember(memberId: string) {
    await authClient.organization.removeMember({ memberIdOrEmail: memberId });
    load();
  }

  async function onRoleChange(memberId: string, role: OrgRole) {
    await authClient.organization.updateMemberRole({ memberId, role });
    load();
  }

  return (
    <div className="rounded-[10px] border border-border bg-card">
      <div className="flex items-center justify-between p-[18px] pb-3">
        <h2 className="text-[13.5px] font-bold">Team Members</h2>
        {canManage && (
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) {
                setInviteLink(null);
                setError(null);
              }
            }}
          >
            <DialogTrigger render={<Button size="sm" className="h-7 px-3 text-[12px]" />}>
              + Invite member
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a team member</DialogTitle>
                <DialogDescription>
                  No email service is configured yet — you&apos;ll get a link to share
                  manually.
                </DialogDescription>
              </DialogHeader>
              {inviteLink ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    Share this link with the invited teammate:
                  </p>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={inviteLink} className="font-mono text-xs" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(inviteLink)}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={onInvite} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <select
                      id="invite-role"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                      className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {error && <p className="text-sm text-critical-fg">{error}</p>}
                  <DialogFooter>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Sending..." : "Send invite"}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            {canManage && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members === null && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Loading...
              </TableCell>
            </TableRow>
          )}
          {members?.map((member) => (
            <TableRow key={member.id}>
              <TableCell className="font-semibold">{member.user.name}</TableCell>
              <TableCell className="text-muted-foreground">{member.user.email}</TableCell>
              <TableCell>
                {canManage && member.role !== "owner" ? (
                  <select
                    value={member.role}
                    onChange={(e) => onRoleChange(member.id, e.target.value as OrgRole)}
                    className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <Badge variant="secondary" className="capitalize">
                    {member.role}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-neutral-fg">Active</TableCell>
              {canManage && (
                <TableCell className="text-right">
                  {member.role !== "owner" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-[12px]"
                      onClick={() => onRemoveMember(member.id)}
                    >
                      Remove
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
          {invitations?.map((invitation) => (
            <TableRow key={invitation.id}>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell className="text-muted-foreground">{invitation.email}</TableCell>
              <TableCell>
                <Badge variant="secondary" className="capitalize">
                  {invitation.role}
                </Badge>
              </TableCell>
              <TableCell className="text-neutral-fg">Invited</TableCell>
              {canManage && (
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-[12px]"
                    onClick={() => onCancelInvitation(invitation.id)}
                  >
                    Cancel
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
