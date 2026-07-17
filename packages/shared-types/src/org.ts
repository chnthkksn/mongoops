import { z } from "zod";

export const orgRoleSchema = z.enum(["owner", "admin", "member"]);
export type OrgRole = z.infer<typeof orgRoleSchema>;

export const createOrgSchema = z.object({
  name: z.string().min(2).max(64),
});
export type CreateOrgInput = z.infer<typeof createOrgSchema>;

export const orgSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.string(),
});
export type Org = z.infer<typeof orgSchema>;

export const membershipSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  userId: z.string(),
  role: orgRoleSchema,
});
export type Membership = z.infer<typeof membershipSchema>;
