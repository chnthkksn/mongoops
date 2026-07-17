import { z } from "zod";

export const clusterTopologySchema = z.enum(["standalone", "replicaSet"]);
export type ClusterTopology = z.infer<typeof clusterTopologySchema>;

export const clusterStatusSchema = z.enum(["healthy", "warning", "critical", "unknown"]);
export type ClusterStatus = z.infer<typeof clusterStatusSchema>;

export const createClusterSchema = z.object({
  name: z.string().min(2).max(64),
  connectionString: z.string().min(10),
  topology: clusterTopologySchema,
});
export type CreateClusterInput = z.infer<typeof createClusterSchema>;

export const clusterSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  topology: clusterTopologySchema,
  status: clusterStatusSchema,
  lastCheckedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Cluster = z.infer<typeof clusterSchema>;

export const testConnectionResultSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  nodeCount: z.number().optional(),
});
export type TestConnectionResult = z.infer<typeof testConnectionResultSchema>;
