const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Request failed with ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export interface ClusterDto {
  _id: string;
  orgId: string;
  name: string;
  topology: "standalone" | "replicaSet";
  status: "healthy" | "warning" | "critical" | "unknown";
  lastCheckedAt: string | null;
  nodeCount: number | null;
  createdAt: string;
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  nodeCount?: number;
}

export interface MetricSampleDto {
  timestamp: string;
  connections: { current: number; available: number };
  memoryMB: { resident: number; virtual: number };
  replicationLagSeconds: number | null;
  longRunningOps: number;
  throughput: {
    insertsPerSec: number;
    queriesPerSec: number;
    updatesPerSec: number;
    deletesPerSec: number;
  } | null;
}

export interface ApiKeyDto {
  id: string;
  name: string | null;
  start: string | null;
  createdAt: string;
}

export interface CreatedApiKeyDto extends ApiKeyDto {
  key: string;
}

export interface AuditLogDto {
  _id: string;
  orgId: string;
  actorUserId: string;
  actorName: string;
  action: string;
  targetLabel: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface DatabaseInfoDto {
  name: string;
  sizeOnDisk: number;
  empty: boolean;
}

export interface CollectionInfoDto {
  name: string;
  count: number;
  avgObjSize: number;
  storageSize: number;
  nindexes: number;
  totalIndexSize: number;
  capped: boolean;
}

export interface DocumentDto {
  id: string;
  raw: string;
  preview: string;
  parsed: unknown;
}

export interface DocumentListDto {
  documents: DocumentDto[];
  total: number;
  page: number;
  limit: number;
}

export interface IndexDto {
  name: string;
  key: Record<string, unknown>;
  size: number | null;
  unique: boolean;
  sparse: boolean;
  expireAfterSeconds: number | null;
}

export interface ValidatorDto {
  validator: Record<string, unknown> | null;
}

export interface StorageProviderDto {
  _id: string;
  orgId: string;
  name: string;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  forcePathStyle: boolean;
  status: "unknown" | "healthy" | "critical";
  lastCheckedAt: string | null;
  createdAt: string;
}

export interface BackupRunDto {
  _id: string;
  orgId: string;
  clusterId: string;
  storageProviderId: string;
  status: "running" | "completed" | "failed";
  trigger: "manual" | "scheduled";
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  totalSizeBytes: number | null;
  collections: { dbName: string; collName: string; documentCount: number }[];
  objectKeyPrefix: string | null;
  errorMessage: string | null;
}

export interface BackupScheduleDto {
  _id: string;
  orgId: string;
  clusterId: string;
  storageProviderId: string;
  intervalHours: number;
  enabled: boolean;
  lastRunAt: string | null;
}

export interface BackupShareLinkDto {
  _id: string;
  orgId: string;
  runId: string;
  clusterId: string;
  token: string;
  url: string;
  actorUserId: string;
  actorName: string;
  expiresAt: string;
  revoked: boolean;
  revokedAt: string | null;
  status: "active" | "expired" | "revoked";
  createdAt: string;
}

export const api = {
  listClusters: () => request<ClusterDto[]>("/clusters"),
  createCluster: (input: { name: string; connectionString: string; topology: "standalone" | "replicaSet" }) =>
    request<ClusterDto>("/clusters", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  testConnection: (id: string) =>
    request<TestConnectionResult>(`/clusters/${id}/test-connection`, {
      method: "POST",
    }),
  updateCluster: (
    id: string,
    input: { name?: string; connectionString?: string; topology?: "standalone" | "replicaSet" },
  ) =>
    request<ClusterDto>(`/clusters/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteCluster: (id: string) =>
    request<{ ok: boolean }>(`/clusters/${id}`, { method: "DELETE" }),
  getMetrics: (id: string, limit?: number) =>
    request<MetricSampleDto[]>(
      `/clusters/${id}/metrics${limit ? `?limit=${limit}` : ""}`,
    ),
  listApiKeys: () => request<ApiKeyDto[]>("/api-keys"),
  createApiKey: (name: string) =>
    request<CreatedApiKeyDto>("/api-keys", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  revokeApiKey: (id: string) =>
    request<void>(`/api-keys/${id}`, {
      method: "DELETE",
    }),
  listAuditLogs: () => request<AuditLogDto[]>("/audit-logs"),
  listDatabases: (clusterId: string) =>
    request<DatabaseInfoDto[]>(`/clusters/${clusterId}/databases`),
  listCollections: (clusterId: string, db: string) =>
    request<CollectionInfoDto[]>(`/clusters/${clusterId}/databases/${db}/collections`),
  listDocuments: (
    clusterId: string,
    db: string,
    coll: string,
    opts: { page?: number; limit?: number; filter?: string; sort?: string } = {},
  ) => {
    const params = new URLSearchParams();
    params.set("page", String(opts.page ?? 1));
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.filter) params.set("filter", opts.filter);
    if (opts.sort) params.set("sort", opts.sort);
    return request<DocumentListDto>(
      `/clusters/${clusterId}/databases/${db}/collections/${coll}/documents?${params.toString()}`,
    );
  },
  listIndexes: (clusterId: string, db: string, coll: string) =>
    request<IndexDto[]>(`/clusters/${clusterId}/databases/${db}/collections/${coll}/indexes`),
  updateDocument: (clusterId: string, db: string, coll: string, raw: string) =>
    request<{ ok: boolean }>(
      `/clusters/${clusterId}/databases/${db}/collections/${coll}/documents`,
      {
        method: "PUT",
        body: JSON.stringify({ raw }),
      },
    ),
  insertDocument: (clusterId: string, db: string, coll: string, raw: string) =>
    request<{ ok: boolean; id: string }>(
      `/clusters/${clusterId}/databases/${db}/collections/${coll}/documents`,
      {
        method: "POST",
        body: JSON.stringify({ raw }),
      },
    ),
  deleteDocument: (clusterId: string, db: string, coll: string, docId: string) =>
    request<{ ok: boolean }>(
      `/clusters/${clusterId}/databases/${db}/collections/${coll}/documents/${docId}`,
      { method: "DELETE" },
    ),
  createCollection: (
    clusterId: string,
    db: string,
    input: {
      name: string;
      capped?: boolean;
      size?: number;
      max?: number;
      validator?: Record<string, unknown>;
    },
  ) =>
    request<{ ok: boolean }>(`/clusters/${clusterId}/databases/${db}/collections`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  renameCollection: (clusterId: string, db: string, coll: string, newName: string) =>
    request<{ ok: boolean }>(
      `/clusters/${clusterId}/databases/${db}/collections/${coll}/rename`,
      {
        method: "PUT",
        body: JSON.stringify({ newName }),
      },
    ),
  dropCollection: (clusterId: string, db: string, coll: string) =>
    request<{ ok: boolean }>(`/clusters/${clusterId}/databases/${db}/collections/${coll}`, {
      method: "DELETE",
    }),
  getValidator: (clusterId: string, db: string, coll: string) =>
    request<ValidatorDto>(`/clusters/${clusterId}/databases/${db}/collections/${coll}/validator`),
  setValidator: (clusterId: string, db: string, coll: string, validator: Record<string, unknown>) =>
    request<{ ok: boolean }>(
      `/clusters/${clusterId}/databases/${db}/collections/${coll}/validator`,
      {
        method: "PUT",
        body: JSON.stringify({ validator }),
      },
    ),
  createIndex: (
    clusterId: string,
    db: string,
    coll: string,
    input: {
      keys: Record<string, 1 | -1>;
      unique?: boolean;
      sparse?: boolean;
      expireAfterSeconds?: number;
      name?: string;
    },
  ) =>
    request<{ ok: boolean; name: string }>(
      `/clusters/${clusterId}/databases/${db}/collections/${coll}/indexes`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    ),
  dropIndex: (clusterId: string, db: string, coll: string, name: string) =>
    request<{ ok: boolean }>(
      `/clusters/${clusterId}/databases/${db}/collections/${coll}/indexes/${name}`,
      { method: "DELETE" },
    ),
  updateIndexTtl: (clusterId: string, db: string, coll: string, name: string, expireAfterSeconds: number) =>
    request<{ ok: boolean }>(
      `/clusters/${clusterId}/databases/${db}/collections/${coll}/indexes/${name}/ttl`,
      {
        method: "PATCH",
        body: JSON.stringify({ expireAfterSeconds }),
      },
    ),

  listStorageProviders: () => request<StorageProviderDto[]>("/storage-providers"),
  createStorageProvider: (input: {
    name: string;
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle?: boolean;
  }) =>
    request<StorageProviderDto>("/storage-providers", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deleteStorageProvider: (id: string) =>
    request<{ ok: boolean }>(`/storage-providers/${id}`, { method: "DELETE" }),
  testStorageProviderConnection: (id: string) =>
    request<{ ok: boolean; status: string; message?: string }>(
      `/storage-providers/${id}/test-connection`,
      { method: "POST" },
    ),

  listBackupRuns: (clusterId?: string) =>
    request<BackupRunDto[]>(`/backup-runs${clusterId ? `?clusterId=${clusterId}` : ""}`),
  createBackupRun: (clusterId: string, storageProviderId: string) =>
    request<BackupRunDto>("/backup-runs", {
      method: "POST",
      body: JSON.stringify({ clusterId, storageProviderId }),
    }),
  restoreBackupRun: (id: string) =>
    request<{ ok: boolean; restoredCollections: number; restoredDocuments: number }>(
      `/backup-runs/${id}/restore`,
      { method: "POST" },
    ),
  deleteBackupRun: (id: string) =>
    request<{ ok: boolean }>(`/backup-runs/${id}`, { method: "DELETE" }),
  createBackupDownloadUrl: (id: string, expiresInSeconds?: number) =>
    request<{ url: string; expiresAt: string }>(`/backup-runs/${id}/download-url`, {
      method: "POST",
      body: JSON.stringify(expiresInSeconds ? { expiresInSeconds } : {}),
    }),

  listBackupSchedules: (clusterId?: string) =>
    request<BackupScheduleDto[]>(
      `/backup-schedules${clusterId ? `?clusterId=${clusterId}` : ""}`,
    ),
  createBackupSchedule: (input: {
    clusterId: string;
    storageProviderId: string;
    intervalHours: number;
  }) =>
    request<BackupScheduleDto>("/backup-schedules", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateBackupSchedule: (id: string, input: { intervalHours?: number; enabled?: boolean }) =>
    request<BackupScheduleDto>(`/backup-schedules/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteBackupSchedule: (id: string) =>
    request<{ ok: boolean }>(`/backup-schedules/${id}`, { method: "DELETE" }),

  listBackupShareLinks: (clusterId?: string) =>
    request<BackupShareLinkDto[]>(
      `/backup-share-links${clusterId ? `?clusterId=${clusterId}` : ""}`,
    ),
  createBackupShareLink: (runId: string, expiresInSeconds: number) =>
    request<BackupShareLinkDto>("/backup-share-links", {
      method: "POST",
      body: JSON.stringify({ runId, expiresInSeconds }),
    }),
  revokeBackupShareLink: (id: string) =>
    request<{ ok: boolean }>(`/backup-share-links/${id}`, { method: "DELETE" }),
};
