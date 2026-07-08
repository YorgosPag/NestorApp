# ADR-603: API Route-Handler Factory SSoT (`defineRoute` + envelope helpers)

## Status
🔵 **ACTIVE (Φ0 — factory + pilot) — 2026-07-08** — De-duplication of the repeated CRUD **handler-assembly** across `src/app/api/**/route.ts`. A fresh jscpd (min-tokens 50, `src/app/api`) measured **7058 dup-lines / 584 clones / 544 files (8.37%)** — cross-file, not self-clones. The clone is **not** the auth (340/382 routes already use the centralized `withAuth`); it is the *body assembly* each handler re-writes: `withAuth`-wrap → `try/catch` → `getErrorMessage` → `logger.error` → 500 envelope → `{ success, data }` shape → `safeParseBody` → `export const GET = withRateLimit(handleX)`.

Φ0 introduces **`@/lib/api/define-route.ts`** — a thin *composition* layer (`defineRoute`) that assembles the **existing** primitives plus bare-envelope helpers (`ok`/`created`/`badRequest`/`notFound`/`conflict`/`httpError`), reusing the shared **`ApiError`** class (extended with an optional `details` bag) as the throw-based HTTP-error type. Pilot migration: `src/app/api/accounting/apy-certificates/route.ts`. jscpd:diff on the staged fileset: **✅ 0 clones**. 24 unit tests green (factory contract + pilot route byte-identical).

**Related:**
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — the token-based detector that sized this «μεγάλο ψάρι».
- **ADR-245** (API Routes Centralization) — centralized the **URL-extraction** helpers (`extractIdFromUrl`…); this ADR closes the **handler-assembly** gap it did not cover.
- **ADR-065** (ApiErrorHandler) — the pre-existing `ApiError` class + `apiSuccess`/`withErrorHandling`. `withErrorHandling` had **0 route adoption** because its richer envelope (timestamp/requestId + error-mapping) changes the wire contract; Φ0 reuses only the `ApiError` class, not the envelope.
- **ADR-585 … ADR-602** — same 2026-07-08 «shared shell/factory + per-instance binding» archetype in other buckets.

---

## Context

382 `route.ts` files. Grep-verified SSoT already in place (**reused, not re-created**):

| Primitive | Module | Adoption |
|---|---|---|
| `withAuth` (+ permissions/roles) | `@/lib/auth` | 340 routes |
| `withRateLimit` + 6 named tiers | `@/lib/middleware/with-rate-limit` | all |
| `safeParseBody` | `@/lib/validation/shared-schemas` | 70 routes |
| `getErrorMessage` | `@/lib/error-utils` | 267 routes |
| `createModuleLogger` | `@/lib/telemetry/Logger` | all |
| **`ApiError`** (statusCode+message+errorCode) | `@/lib/api/api-error-types` | 64 routes |
| `apiSuccess` / `ApiErrorHandler.success` | `@/lib/api/ApiErrorHandler` | 82 routes |
| `extractIdFromUrl`… | `@/lib/api/route-helpers` (ADR-245) | URL only |

**The envelope is split** — a decisive finding:
- **222 routes** emit the **bare** `{ success: true, data }` / `{ success: false, error }` (status 200/201/4xx/500).
- **82 routes** use `apiSuccess`, which additionally emits `timestamp` + `requestId` + `X-Request-ID` header and, on the error path, **error-mapping** rules that can remap a 500 into a 404/409.

These are **two different public contracts**. This is exactly why the pre-existing `withErrorHandling` wrapper (ADR-065) was never adopted by the bare-envelope majority: it changes the wire shape and can change status codes.

**Addressable clone family = 188 routes** (withAuth **and** bare envelope **and** getErrorMessage). All the top clone offenders (accounting, buildings, apy-certificates) live here.

## Decision

Introduce **`defineRoute(config)`** — a higher-order route definer that composes the cross-cutting concerns and lets each route write **only** its business callback:

```ts
export const POST = defineRoute({
  rateLimit: 'sensitive',          // 'high'|'standard'|'sensitive'|'heavy'|'webhook'|'telegram' → existing wrappers
  schema: CreateAPYSchema,         // optional → auto safeParseBody, typed body passed to handler
  auth: { permissions: '…' },      // optional → forwarded to withAuth
  fallbackError: 'Failed to …',    // optional → byte-identical 500 fallback message
  handler: async ({ req, auth, cache, body, params }) => {
    // …business…  throw conflict('…', { existingCertificateId });
    return created({ id });
  },
});
```

- **`defineRoute` = `withRateLimitTier( withAuth( async (req,ctx,cache,routeCtx) => { try { [await params] ; [schema→safeParseBody] ; return await handler(...) } catch (e) { → envelope } }, auth) )`.**
- **Envelope helpers** emit the **bare** shape byte-identical to the migrated routes: `ok(data?)` (200, omits `data` key when absent), `created(data?)` (201). Errors are **thrown**: `badRequest`/`notFound`/`conflict`/`httpError` throw `ApiError`; the factory catch maps `ApiError` → `{ success:false, error, ...details }` at `error.statusCode` (**not logged** — expected business errors) and any other throw → `getErrorMessage` + `logger.error` + 500 (**logged** — unexpected). This reproduces the current per-route behavior exactly (404/409 were never logged; only 500 was).
- **Reuse `ApiError`** (ADR-065) as the HTTP-error type — **no new `HttpError` class**. Extended additively with an optional `details?: Record<string, unknown>` (spread into the envelope, e.g. `{ existingCertificateId }`). Backward-compatible for its 64 existing importers.

### Big-player rationale
- **Contract immutability wins (Stripe / Figma / GitHub).** You never mutate the wire format of a live endpoint that clients depend on. The SSoT here is the **composition of cross-cutting concerns**, *not* a change to the response contract. The factory therefore emits each route's **current** bare envelope and status codes — byte-identical.
- **Unified richer envelope is deferred, not rejected.** A single canonical envelope with `requestId`/`timestamp` for tracing (the `apiSuccess` shape) is the enterprise ideal, but for a **live** API it must ship as a deliberate **versioned** rollout — a separate ADR — never as a silent side-effect of a refactor. Documented as future work.
- **Composition, not a God-wrapper.** Divergences (schema, business logic, rate tier, auth, status) are injected via `config`/`handler` — no `if`-branching on behavior inside the factory (Figma/tRPC/Next-community pattern).

## Consequences
- ✅ ~7k dup-lines addressable across 188 routes collapse onto one composer. Each migrated route drops the withAuth-wrap + try/catch + getErrorMessage + 500 + rate-limit-export boilerplate.
- ✅ Public contract preserved byte-identical for the bare-envelope family (verified by pilot route test + jscpd:diff 0).
- ✅ The 82 `apiSuccess` routes are a **separate, already-centralized family** — left untouched by this ADR.
- ⚠️ **Migration is a phased campaign, never a single session** (orchestrator-scale, HIGH risk — production auth/tenant/Firestore/validation). One domain per session, batches of ~8–12 routes, per-batch `jscpd:diff` + tests, Giorgio commits per batch.
- ⚠️ **SSoT-registry enforcement entry deferred.** Adding a forbidding pattern to `.ssot-registry.json` would flag 300+ existing routes and require `ssot:baseline`, which is unsafe in the currently shared working tree. The registry module + baseline are added in a later phase once the tree is exclusive and Giorgio approves.

## Phased plan
- **Φ0 (this session) — DONE:** ADR + `define-route.ts` (factory + envelope helpers) + `ApiError.details` + unit tests (19 factory + 5 pilot route) + **1 pilot migration** (`accounting/apy-certificates/route.ts`), jscpd:diff 0.
- **Φ1..N (separate sessions, per domain, ~8–12/batch):** `accounting`(32 ✅ done) → ~~`buildings`(14)~~ **DEFERRED** → `procurement`(26, in progress) → `properties`(28) → `quotes`(8) → … Each batch: migrate → `jscpd:diff` on own files → jest → Giorgio commit. Never >1 domain/session. Public contract (URLs, status, JSON envelope) verified per-route.
  - **⚠️ `buildings` DEFERRED (envelope-incompatible, 2026-07-08):** a full recon of all 14 buildings routes found **zero** routes on the clean `{ success, data }` contract the factory emits byte-identically. They split into (a) **`apiSuccess` family** (`route.ts`, `[buildingId]`, `link-project` — the richer `timestamp/requestId/message` envelope, a separate family the campaign must not touch), (b) **already-centralized** thin forwards (`showcase/pdf`, `showcase/email` → `createShowcase*Route` core; `seed`, `populate` → `handleBuildingInstantiation`), and (c) **bespoke top-level-field envelopes** (`{ success, buildings/customers/baselines/milestones, buildingId, summary, … }` + custom `{ success:false, error, details }` 500s) — NOT `{ success, data }`. Migrating (c) to `defineRoute` would either change the wire contract (top-level fields → `data:{}`) or reduce the factory to a bare wrapper while still diverging on the custom 500 envelope. **Buildings needs a separate, reviewed envelope-normalization ADR (contract change + client updates), not a byte-identical batch.**
  - **Φ1 procurement — batch A (catalog CRUD, 4 files / 11 handlers) DONE:** `materials`(+`[materialId]`), `agreements`(+`[agreementId]`). GET handlers → clean factory (`ok`/`notFound` + `fallbackError`); POST/PATCH/DELETE keep a manual `safeParseBody` + status-mapping `try/catch` ending in `httpError(status, message)` (byte-identical, because bad-JSON status differs per family — see findings). Boy-Scout SSoT: `_shared/error-status.ts` (`resolveProcurementErrorStatus`, create-vs-mutation mode), `_shared/material-schema.ts` + `_shared/framework-agreement-schema.ts` (`Update = Create.partial()` kills the create/update sibling clone), `_shared/catalog-list-filters.ts` (`readCatalogListFilters` — shared `search`+`includeDeleted` reader). 21 contract tests, jscpd:diff on the 9 staged files = 0 clones. **Remaining procurement:** `route.ts` (PO list/create, 400-fallback), `[poId]` (action-switch PATCH), plus rfqs/sourcing-events/spend-analytics/etc. → batch B+.
  - **Φ1 accounting — batch 1 (8 routes) DONE:** `apy-certificates/[id]`, `assets`, `balances`, `balances/[customerId]`, `invoices/next-number`, `invoices/series`, `fiscal-periods`, `fiscal-periods/[periodId]`. Boy-Scout extraction: `_shared/fiscal-year-param.ts` (sibling clone between `balances`+`fiscal-periods` GET).
  - **Φ1 accounting — batch 2 (14 routes) DONE:** `categories`(+`[id]`), `documents`(+`[id]`), `journal`(+`[id]`), `setup`(+`presets`), `efka/summary`, `vat/summary`, `tax/estimate`, `reports/[type]`, `bank/transactions`, `invoices`. Boy-Scout SSoT: `entity-scoped-response`, `entity-scoped-summary-route`, `journal-entry-fields`, `list-request-context`, `fiscal-year-param#resolveYearInRange`, local `loadCategoryOr404`. **Excluded:** `tax/dashboard` (bare non-`success` envelope). **Remaining accounting micro-batch:** `invoices/[id]`(+`send-email`), `bank/match`, `bank/reconcile`, `bank/import`.
  - **Φ1 accounting — batch 3 (heavy, 5 handlers / 4 files) DONE:** `invoices/[id]` (GET/PATCH/DELETE), `invoices/[id]/send-email` (POST), `bank/match` (POST), `bank/reconcile` (POST/PATCH). PATCH `invoices/[id]` + POST `bank/match` + POST `bank/reconcile` use the factory `schema` option; the rest keep manual parse where the pre-existing 400 shape differs (`safeJsonBody`, custom `Invalid JSON body`, admin-check-before-parse ordering). 28 new contract tests (56 batch-2+3 green), jscpd:diff on the 5 staged files = 0 clones. **Excluded:** `bank/import` (bare `{error}` on error paths). **Accounting migration COMPLETE** (batches 1+2+3, `apy` pilot); remaining exclusions (`tax/dashboard`, `bank/candidates`, `bank/match-batch`, `bank/import`) need a separate reviewed envelope-normalization pass.

### Per-route contract findings (byte-identical guardrails)
- **`bank/candidates` + `bank/match-batch` use `{ error }` (no `success:false`) on their error paths** — a *different* error sub-contract. **Excluded** from the factory migration (which emits `{ success:false, error }`); handle via a dedicated pass or an explicit, reviewed normalization.
- **`tax/dashboard` emits a bare `{ error }` on failure AND success payloads with NO `success` field at all** (`{ entityType, taxResult, installments }`, `{ taxResult, installments }`) — a fundamentally different envelope from the `{ success, data }` factory contract. **Excluded** from the migration; would need an explicit, reviewed envelope normalization.
- **`fiscal-periods` POST/PATCH use raw `schema.safeParse()` + `error.flatten()`** for their 400 `details`, not `safeParseBody` (whose `details` is a `{path,message}[]` array). Migrated with **manual parse + `badRequest('Validation failed', { details: parsed.error.flatten() })`** (NOT the factory `schema` option) to preserve the exact `details` shape.
- **`assets` POST uses manual field validation** (no zod) → preserved as `badRequest(<same messages>)`, not converted to a schema (which would change the 400 body).
- **`bank/match` + `bank/reconcile` put a `BankMatchProblem` OBJECT in the `error` field** (`{ success:false, error: { code, message, status, …metadata } }` via `problemResponse`), not a string. The envelope helpers (`httpError`/`conflict`/…) only emit a **string** `error`, so every `problemResponse` return is kept **inline** inside the handler; only success (`ok(...)`) and — for `bank/reconcile` PATCH — the string-`error` admin-only 403 use helpers/inline `NextResponse.json`.
- **`bank/reconcile` PATCH checks the admin role BEFORE parsing the body** — so it stays a **manual** `safeParseBody(AdminUnlockSchema)` inside the handler (NOT the factory `schema` option), preserving the invariant that a non-admin gets `403` even with an invalid body (the `schema` option would parse first and return `400`). Covered by a dedicated test.
- **`invoices/[id]` DELETE uses `safeJsonBody`** (400 `Invalid or empty JSON body` on malformed JSON) and **`send-email` uses a bespoke `try { req.json() } catch` → 400 `Invalid JSON body`** — both kept as manual parse (NOT the `schema` option, whose malformed-JSON path yields a 500) to preserve the exact 400 body/message.
- **`bank/match` + `bank/reconcile` had NO per-handler `try/catch`** pre-migration: their *unexpected*-error path fell through to `withAuth`→`apiErrorHandler.handleError` (rich envelope: `errorCode`/`timestamp`/`requestId`, rule-mapped HTTP status). After migration the factory's own `try/catch` intercepts first → `{ success:false, error }` at `500` (+ server log). **Accepted, minor divergence limited to the truly-unexpected-exception path** (all explicit `problemResponse`/success returns stay byte-identical); it also makes these two routes consistent with every other `defineRoute` migration. Flagged for Giorgio.

## Changelog
- **2026-07-08** — ADR created. Φ0 landed: `@/lib/api/define-route.ts` (`defineRoute` + `ok`/`created`/`badRequest`/`notFound`/`conflict`/`httpError`), `ApiError` extended with `details`, pilot migration of `accounting/apy-certificates/route.ts`, 24 unit tests green, jscpd:diff on staged files = 0 clones.
- **2026-07-08** — Φ1 accounting batch 1: migrated 8 routes onto `defineRoute` (byte-identical), extracted `_shared/fiscal-year-param.ts`, 18 new contract tests (42 total green), jscpd:diff on the 10 staged files = 0 clones. Documented `{error}`-envelope and `flatten()`-details per-route findings above.
- **2026-07-08** — Φ1 accounting batch 2: migrated 14 routes onto `defineRoute` (byte-identical) — `categories` (+`[id]`), `documents` (+`[id]`), `journal` (+`[id]`), `setup` (+`presets`), `efka/summary`, `vat/summary`, `tax/estimate`, `reports/[type]`, `bank/transactions`, `invoices`. 422 (`validatePostingAllowed.reason` / credit-limit, `string|null`) and top-level extra-field responses (`action`, `entityType`) kept as inline `NextResponse.json` inside the handler (envelope helpers only cover the bare `{success,data}` shape). Boy-Scout SSoT extractions to break jscpd sibling clones: `_shared/entity-scoped-response.ts` (entity-type dispatch), `_shared/entity-scoped-summary-route.ts` (efka+tax/estimate route-factory twin), `_shared/journal-entry-fields.ts` (shared create/update zod field shape), `_shared/list-request-context.ts` (`readListContext` for GET-list openers), `_shared/fiscal-year-param.ts#resolveYearInRange` (range-validated year param), local `loadCategoryOr404`. 28 new contract tests (88 total green), jscpd:diff on the 19 staged files = 0 clones. **Excluded** `tax/dashboard` (see findings). Remaining accounting micro-batch: heavy `invoices/[id]` (+`send-email`), `bank/match`, `bank/reconcile`, `bank/import`.
- **2026-07-08** — Φ1 accounting batch 3 (heavy): migrated 5 handlers across 4 files onto `defineRoute` — `invoices/[id]` (GET/PATCH/DELETE), `invoices/[id]/send-email` (POST), `bank/match` (POST), `bank/reconcile` (POST/PATCH). `schema` option where the pre-existing parse was `safeParseBody` (PATCH `invoices/[id]`, POST `bank/match`, POST `bank/reconcile`); manual parse kept where the 400 shape/ordering differs (`safeJsonBody` in DELETE, bespoke `Invalid JSON body` in send-email, admin-check-before-parse in reconcile PATCH). `bank/*` object-`error` `problemResponse` returns kept inline (helpers emit only string `error`); success via `ok()`. Documented the object-`error`, admin-order, malformed-JSON and unexpected-error `try/catch` divergences under findings. 28 new contract tests (`adr603-batch3.route.test.ts`; 56 batch-2+3 green), jscpd:diff on the 5 staged files = 0 clones. **Excluded** `bank/import` (bare `{error}`). **Accounting API migration complete** apart from the 4 reviewed envelope-mismatch exclusions.
