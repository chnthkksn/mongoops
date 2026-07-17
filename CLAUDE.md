# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MongoOps Cloud is a SaaS platform for monitoring, managing, securing, and backing up **self-hosted** MongoDB clusters — positioned as an Atlas alternative for self-hosted deployments. There is no host-level agent on target MongoDB deployments; every feature (Monitoring, Database Explorer, Backup) works exclusively through short-lived `mongodb` driver connections opened by the API, not shell tools like `mongodump`. This constraint shapes the design of every data-touching feature — keep it in mind before assuming a feature could shell out or install an agent.

## Monorepo layout

Turborepo + pnpm workspaces (`pnpm-workspace.yaml`: `apps/*`, `packages/*`).

- `apps/api` — NestJS backend (all business logic, auth, DB access)
- `apps/web` — Next.js (App Router) frontend
- `packages/shared-types` — zod schemas for `Org`/`Cluster`; scaffolded early but **not currently imported by either app** — `apps/web/src/lib/api-client.ts` defines its own parallel `*Dto` TypeScript interfaces by hand instead. Don't assume shared-types is the source of truth for API contracts; check `api-client.ts` and the actual NestJS DTOs/schemas.

## Commands

Run from repo root unless noted:

```bash
pnpm dev                      # turbo run dev — both apps, watch mode
pnpm build                    # turbo run build
pnpm turbo run typecheck lint # typecheck + lint across all packages
```

Caveat: `apps/api` and `apps/web` have no `typecheck` script of their own, so `turbo run typecheck` only actually typechecks `packages/shared-types` for them; `lint`/`build` are what catch type errors in api/web. For a real type check of one app:

```bash
cd apps/api && pnpm exec tsc --noEmit -p tsconfig.json
cd apps/web && pnpm exec tsc --noEmit    # or: pnpm build (next build typechecks too)
```

Per-app (from `apps/api` or `apps/web`):

```bash
pnpm start          # nest start (api) — no reload
pnpm start:dev       # nest start --watch (api)
pnpm dev             # next dev (web)
pnpm build           # nest build / next build
pnpm lint            # eslint --fix (api) / eslint (web)
pnpm test            # jest unit tests (api only)
pnpm test:e2e        # jest e2e (api only, apps/api/test/jest-e2e.json)
pnpm exec jest <path-to-spec>   # run a single test file (api)
```

### Local infra

```bash
docker compose up -d          # mongo (replSet rs0) + mongo-init + minio + minio-init
```

- Mongo: `mongodb://localhost:27017/mongoops?replicaSet=rs0` — a replica set is **required**, not optional: better-auth needs transactions.
- MinIO (S3-compatible, backs the Backup feature): `http://localhost:9000`, console `:9001`, creds `minioadmin`/`minioadmin`, bucket `mongoops-backups`, path-style required.
- Env vars: `apps/api/.env.example` and `apps/web/.env.local` show the dev shape; `.env.prod.example` (root) documents the production compose vars, notably that `NEXT_PUBLIC_API_URL` is baked into the web image at **build** time (Next.js inlines `NEXT_PUBLIC_*`), so the web image must be rebuilt if the public API URL changes.
- Production: `docker-compose.prod.yml` bundles Mongo + MinIO + both app images with no reverse proxy/TLS (operator supplies their own); Mongo has no published port in prod, unlike dev.

## Architecture

### Backend (`apps/api`, NestJS)

**One feature = one module** under `src/<feature>/`, each typically: `<feature>.module.ts`, `<feature>.service.ts`, `<feature>.controller.ts`, `<feature>.schema.ts` (Mongoose), `dto/*.dto.ts` (class-validator). Look at `src/clusters/` or `src/backup/` as the reference shape before adding a new module.

- **Auth**: better-auth is NOT a separate service — it's constructed once in `src/auth/auth.instance.ts` (Mongo native-driver adapter, `organization`, `apiKey`, `twoFactor` plugins) and mounted into Nest via `AuthModule.forRoot({ auth })` from `@thallesp/nestjs-better-auth` in `app.module.ts`. `main.ts` disables Nest's body parser (`bodyParser: false`) because better-auth's mounted routes parse their own bodies.
- **Route guards** (from `@thallesp/nestjs-better-auth`): `@RequireActiveOrg()` at controller level gates every org-scoped route behind an active-session + active-org check; `@Session() session: UserSession` injects the session (`session.session.activeOrganizationId!`, `session.user.id/name`); `@OrgRoles(['owner','admin'])` on individual mutating routes; `@AllowAnonymous()` is the deliberate escape hatch for public routes (see `app.controller.ts`'s `GET /` and `backup/public-backup-shares.controller.ts`) — it bypasses the global session guard entirely, no `@RequireActiveOrg()` at all.
- **RBAC convention, established across every module**: read/list = any org member; mutations = owner/admin (`@OrgRoles(['owner','admin'])`); a few especially sensitive things (API keys, storage-provider credentials) = owner-only (`@OrgRoles(['owner'])`). Match this exactly when adding new mutating endpoints rather than inventing a new tier.
- **Multi-tenancy**: every domain document carries a plain-string `orgId` (not an org-scoped Mongo collection or view) — every service method takes `orgId` as its first argument and filters by it explicitly. There is no query-scoping interceptor; scoping is manual and consistent per-method.
- **Secrets at rest**: `src/common/crypto.util.ts` (`encryptSecret`/`decryptSecret`, AES-256-GCM, key derived via `scryptSync` from `CLUSTER_SECRET_KEY`) encrypts cluster connection strings and storage-provider secret keys. Despite the env var's name, the derivation is generic and reused for both.
- **Mongo access pattern for target clusters**: features that talk to a *user's* MongoDB cluster (Monitoring, Database Explorer, Backup) each open their own short-lived `MongoClient` (decrypt → connect → do the work → close), rather than sharing a pooled/injected connection — this is a deliberate, repeated small-duplication trade-off across those modules, not an oversight to "fix" by extracting a shared helper.
- **Audit logging** is hand-rolled (`src/audit/`), not a better-auth plugin — `AuditLogService.record(...)` is called directly from services after a mutation succeeds. Org-lifecycle events (member/invite changes) are captured via better-auth's `organizationHooks` in `auth.instance.ts` itself (those hooks run outside Nest's DI container, so they write via the native Mongo `db` handle directly, not through `AuditLogService`). Action names follow `<domain>.<verb>_<noun-or-past-tense>` (e.g. `backup.share_link_created`, `member.role_updated`). Scheduled/system-initiated actions use a sentinel actor (`actorUserId: 'system'`).
- **Scheduled jobs**: `@nestjs/schedule`'s `@Interval(...)` on service methods (e.g. `MetricsService.collectAll` every 30s, `BackupSchedulesService`'s hourly due-schedule poller) — `ScheduleModule.forRoot()` is registered once, globally, in `app.module.ts`.
- **Backup feature specifics**: backups are an application-level logical export via the driver (NDJSON per collection, gzipped, uploaded to S3-compatible storage), not real `mongodump` output. Restore is a genuine drop-and-recreate (not a merge) — see `src/backup/backup-runs.service.ts`. Public share links (`src/backup/backup-share-links.service.ts` + `public-backup-shares.controller.ts`) are DB-backed tokens that 302-redirect to a freshly-minted short-lived presigned S3 URL, not a raw presigned URL handed out directly — this is what makes them revocable/listable/trackable, unlike the plain "Download" button which still uses a raw ephemeral presigned URL.

### Frontend (`apps/web`, Next.js App Router)

- All API calls go through the single hand-rolled client in `src/lib/api-client.ts`: a `request<T>()` helper (fetch with `credentials: "include"`) plus a flat `api.*` object of typed methods and matching `*Dto` interfaces. Add new endpoints here rather than calling `fetch` directly from components.
- Auth client: `src/lib/auth-client.ts` (`better-auth/react`, `organizationClient()`, `twoFactorClient()`), re-exports `useSession`/`signIn`/`signUp`/`signOut`. RBAC-gated UI reads the active role via `authClient.useActiveMemberRole()` — check this consistently rather than rolling a separate role hook.
- Feature pages live under `src/app/(app)/<feature>/page.tsx` (authenticated shell) and compose one or more section components from `src/components/<feature>/`, mirroring the pattern in `src/components/backup/` and `src/components/users-security/` (one card-shaped component per concern, e.g. `backup-runs-card.tsx`, `share-links-card.tsx`).
- Nav is a flat static list in `src/components/shell/nav-items.ts` (`{label, href, letter, enabled}`); shipping a page means also flipping its `enabled: true` here.
- Standard component conventions already established: shadcn `Dialog`/`Table`/`Button` from `src/components/ui/`, `cn()` from `src/lib/utils.ts` for conditional classes, destructive actions confirmed via a plain native `confirm()` (not a typed-confirmation dialog) except where a much stronger explicit warning is needed (e.g. Backup restore).

## Notes on non-obvious scope decisions

Several features are deliberately narrower than their real-world equivalent, for reasons that aren't visible from the code alone:

- **Monitoring** only surfaces mongod-level metrics (connections, opcounters, memory, replication lag, long-running ops as a slow-query proxy) — no host CPU/RAM/disk, since there's no agent on the target host.
- **Backup** is a logical NDJSON export via the driver, not a `mongodump` archive, for the same no-agent/no-bundled-binary reason.
- **Database Explorer** document editing goes through raw EJSON text (via `bson`'s `EJSON`), not a structured field editor — this is required to round-trip BSON types like `ObjectId`/`Date` correctly through a plain textarea.

If a task looks like it wants a "real" `mongodump`, a host-metrics agent, or a structured document editor, that's a scope expansion worth confirming with the user rather than a bug to silently fix.
