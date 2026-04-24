# ADR-315 — Unified Sharing (Contact + File + Property Showcase)

| Field | Value |
|-------|-------|
| **Status** | ✅ Phase M3 + M4 COMPLETE (all 3 entity types unified: file + contact + property_showcase — single dialog, single public route) — 2026-04-18 |
| **Date** | 2026-04-18 |
| **Category** | Sharing / Access Control / Public Surfaces |
| **Canonical Location** (target) | `src/services/sharing/`, `src/components/sharing/`, `src/app/shared/[token]/`, Firestore `shares` collection |
| **Supersedes (partial)** | ADR-312 §2 "Scope change to FileShareRecord" (inline discriminators → polymorphic schema) |
| **Extends** | ADR-147 (Unified Share Surface — UI foundation) |

---

## 1. Problem

Three share flows exist today, partially centralized, with overlapping responsibilities and diverging capabilities:

### 1.1 Contact share (`Κοινοποίηση επαφής`)

- **Entry**: `src/components/ui/ShareModal.tsx` → `src/components/ui/sharing/panels/UserAuthPermissionPanel.tsx`
- **APIs**: `POST /api/communications/email/property-share`, `POST /api/communications/share-to-channel`, `GET /api/contacts/search-for-share`
- **Persistence**: `photo_shares` (dispatch history only — no persistent shareable token)
- **UI capabilities**: email sub-dialog (manual / from contacts), social channel grid (Messenger / Instagram / WhatsApp / Telegram), copy-link, copy-text
- **Gaps**:
  - No expiration, password, max-downloads, note (present in file share)
  - Copy-link button copies an empty string: the dialog receives `shareData.url` as *input* from the caller, but no token is ever generated, so the URL is either blank or a non-authenticated client-side placeholder
  - No revocation surface (dispatch cannot be revoked post-send — expected — but there is also no persistent link to revoke)

### 1.2 File share (`Κοινοποίηση αρχείου`)

- **Entry**: `src/components/shared/files/ShareDialog.tsx` → `src/components/ui/sharing/panels/link-token/LinkTokenPermissionPanel.tsx`
- **Service SSoT**: `src/services/file-share.service.ts` — `FileShareService.{createShare, validateShare, verifyPassword, incrementDownloadCount, deactivateShare, getSharesForFile}`
- **Persistence**: Firestore `file_shares` — `FileShareRecord { token, expiresAt, passwordHash (SHA-256 client-side), requiresPassword, maxDownloads, downloadCount, note, isActive, companyId }`
- **Public route**: `src/app/shared/[token]/page.tsx` (via `SharedFilePageContent`)
- **Form draft**: `LinkTokenDraft { expiresInHours, password, maxDownloads, note }` — 4 canonical fields

### 1.3 Property showcase (ADR-312)

- Reuses `file_shares` collection with **inline discriminators** (`showcaseMode: boolean`, `showcasePropertyId: string`, `pdfStoragePath`, `pdfRegeneratedAt`)
- Public route: `src/app/shared/po/[token]/page.tsx` (separate path due to different render target)
- `FileShareRecord.fileId` is semantically unused for showcase (debt: field is `string` non-optional but showcase populates a proxy value)

### 1.4 Structural problems

1. **No SSoT for sharing**. Three partially-overlapping systems, each re-implementing its own surface.
2. **Contact share has no token lifecycle**. Cannot be revoked, cannot be expired, cannot be password-protected, cannot be rate-limited per link.
3. **`file_shares` is a misnomer post-ADR-312**. Schema drifts with inline-discriminator pattern; adding a fourth entity type would compound the drift.
4. **Password hashing is SHA-256 client-side** — offline brute-force friendly, documented known debt in `FileShareService`. Extending sharing to contact data (PII) without fixing this widens the attack surface.
5. **Public route dispatches are inconsistent** — `/shared/[token]` for files, `/shared/po/[token]` for showcase, none for contact.
6. **UI foundation is partially shared** via ADR-147 (`ShareSurfaceShell`) but the top-level panels (`UserAuthPermissionPanel` vs `LinkTokenPermissionPanel`) diverge, so the user experience is visibly different per entity.

---

## 2. Decision

**Introduce a single unified sharing system** composed of:

1. A **polymorphic share collection** (`shares`) with `entityType` discriminator.
2. A **single SSoT service** (`UnifiedSharingService`) responsible for token lifecycle only.
3. A **separate dispatch service** (`ChannelDispatchService`) responsible for one-shot sends (email / social channels), decoupled from token persistence.
4. A **single public route** (`/shared/[token]`) with server-side entity-type dispatch.
5. A **single adaptive dialog** (`UnifiedShareDialog`) built on ADR-147 `ShareSurfaceShell`.
6. An **entity registry** (`ShareEntityRegistry`) so adding a 4th entity type requires zero changes to the service core.
7. A **server-side bcrypt password validator** (Cloud Function) replacing SHA-256 client-side.

The `file_shares` collection is **renamed to `shares`** with a dual-read alias during migration. `photo_shares` is deprecated (kept read-only for audit; new dispatches land in `share_dispatches`).

---

## 3. Architecture

### 3.1 Layers

| Layer | Path (target) | Responsibility |
|-------|---------------|----------------|
| Schema | `src/types/sharing/share-record.ts` | `ShareRecord`, `ShareEntityType`, `ShareDispatchLog` interfaces |
| Firestore config | `src/config/firestore-collections.ts` | Add `SHARES: 'shares'`, `SHARE_DISPATCHES: 'share_dispatches'`; mark `FILE_SHARES` as deprecated alias |
| Service SSoT — tokens | `src/services/sharing/unified-sharing.service.ts` | `createShare`, `validateShare`, `verifyPassword` (delegates to Cloud Function), `incrementAccessCount`, `revoke`, `listSharesForEntity`, `listSharesForCompany` |
| Service SSoT — dispatch | `src/services/sharing/channel-dispatch.service.ts` | `sendViaChannel({ channel, externalUserId, token? \| payload, contactId? })`; writes to `share_dispatches`; reuses existing Mailgun/Telegram/WhatsApp/Messenger/Instagram channel adapters |
| Entity registry | `src/services/sharing/share-entity-registry.ts` | `register(entityType, { resolve, renderPublic, canShare, safePublicProjection })`; plugin pattern |
| Entity resolvers | `src/services/sharing/resolvers/{file,contact,property-showcase}.resolver.ts` | Per-type `resolve()` returns safe public payload; `renderPublic()` returns React component to render on `/shared/[token]` |
| Password validator (server) | `functions/src/sharing/validatePasswordedShare.ts` (Cloud Function) | Accepts `{ token, password }`; compares bcrypt hash server-side; returns session cookie scoped to token |
| Generate dialog | `src/components/sharing/UnifiedShareDialog.tsx` | Adaptive panel; wraps ADR-147 `ShareSurfaceShell`; tab mode for contact |
| Public route | `src/app/shared/[token]/page.tsx` | Validates token; dispatches via `ShareEntityRegistry.renderPublic(entityType)` |
| Public API | `src/app/api/shares/[token]/route.ts` | Anonymous resolver (safe projection only); `/api/shares/[token]/verify-password` for bcrypt validation; `/api/shares/[token]/download` for file streaming with access count |
| Legacy redirect | `src/app/shared/po/[token]/page.tsx` | 301 → `/shared/[token]` |
| SSoT registry entry | `.ssot-registry.json` | Tier 2 module `unified-sharing-service` — forbids direct `shares` collection writes, forbids re-implementation of `FileShareService`, forbids new inline share schema definitions |

### 3.2 Schema

```ts
// src/types/sharing/share-record.ts

export type ShareEntityType = 'file' | 'contact' | 'property_showcase';

export interface ShareRecord {
  id: string;                            // enterprise ID, prefix `share_` (aligned with existing SSoT — enterprise-id-prefixes.ts)
  token: string;                         // 32-char URL-safe random
  entityType: ShareEntityType;
  entityId: string;                      // fileId | contactId | propertyId
  companyId: string;                     // tenant isolation
  createdBy: string;                     // user UID
  createdAt: Timestamp;

  // Lifecycle
  expiresAt: string;                     // ISO datetime
  isActive: boolean;
  revokedAt?: Timestamp;
  revokedBy?: string;

  // Access control
  requiresPassword: boolean;
  passwordHash?: string;                 // bcrypt server-managed; NEVER returned to client
  maxAccesses: number;                   // 0 = unlimited
  accessCount: number;
  lastAccessedAt?: Timestamp;

  // User metadata
  note?: string;

  // Entity-specific metadata (validated by resolver per entityType)
  showcaseMeta?: {
    pdfStoragePath: string;
    pdfRegeneratedAt: Timestamp;
  };
  contactMeta?: {
    includedFields: Array<'name' | 'emails' | 'phones' | 'address' | 'company'>;
  };
  fileMeta?: {
    mimeType: string;
    sizeBytes: number;
  };
}

export interface ShareDispatchLog {
  id: string;                            // enterprise ID, prefix `dispatch_` (new DISPATCH prefix added in M1)
  shareId?: string;                      // nullable — "direct send without link"
  token?: string;                        // denormalized for analytics
  companyId: string;
  createdBy: string;
  createdAt: Timestamp;
  channel: 'email' | 'telegram' | 'whatsapp' | 'messenger' | 'instagram';
  externalUserId: string;                // recipient identifier (PII — never publicly readable)
  contactId?: string;                    // if sent to a known contact
  payload: {
    subject?: string;
    body?: string;
    photoUrls?: string[];
  };
  status: 'queued' | 'sent' | 'failed';
  errorCode?: string;
}
```

**Public projection** (served by `/api/shares/[token]`): only `{ entityType, entityId, requiresPassword, expiresAt, isActive, accessCount, maxAccesses, note, <entityType-specific safe subset> }`. `companyId`, `createdBy`, `passwordHash`, full `externalUserId`s are never exposed.

### 3.3 Entity registry pattern

```ts
// src/services/sharing/share-entity-registry.ts

export interface ShareEntityDefinition<T = unknown> {
  resolve(share: ShareRecord): Promise<T>;                  // fetch public data
  safePublicProjection(share: ShareRecord): PublicShareData; // strip PII
  renderPublic(data: T): ReactNode;                         // server component
  canShare(user: AuthUser, entityId: string): Promise<boolean>;
  validateCreateInput(input: CreateShareInput): ValidationResult;
}

// Registration (called at module load):
ShareEntityRegistry.register('file', fileShareDefinition);
ShareEntityRegistry.register('contact', contactShareDefinition);
ShareEntityRegistry.register('property_showcase', propertyShowcaseDefinition);
```

Adding a 4th type (e.g. `listing`, `document_bundle`) requires only a new resolver file + one `.register()` call. Core service stays agnostic.

### 3.4 UI — `UnifiedShareDialog`

Built on ADR-147 `ShareSurfaceShell`:

| `entityType` | Dialog shape |
|--------------|--------------|
| `file` | Single panel: 4 token fields (λήξη / κωδικός / μέγιστες προσβάσεις / σημείωση) + `Generate link` button |
| `property_showcase` | Single panel: same 4 token fields + PDF regeneration indicator (ADR-312) |
| `contact` | Two tabs: **(1) Απευθείας αποστολή** — default; email manual/from-contacts + social channel grid (preserves current UX). **(2) Δημιουργία συνδέσμου** — 4 token fields + contactMeta field selection (which contact fields to expose). User can also combine: generate link THEN share link via channel |

The dialog **produces** the link (output); it does not consume a pre-built URL as input. This fixes the contact-share copy-link bug (`shareData.url` was empty because no token existed).

### 3.5 Public route dispatch

```ts
// src/app/shared/[token]/page.tsx (simplified)
async function PublicSharePage({ params: { token } }) {
  const share = await UnifiedSharingService.validateShare(token);
  if (!share) return <InvalidShare />;
  if (share.expiresAt < now()) return <ExpiredShare />;
  if (share.accessCount >= share.maxAccesses && share.maxAccesses > 0) return <MaxAccessesReached />;
  if (share.requiresPassword) return <PasswordGate token={token} />;

  const definition = ShareEntityRegistry.get(share.entityType);
  const data = await definition.resolve(share);
  await UnifiedSharingService.incrementAccessCount(share.id);
  return definition.renderPublic(data);
}
```

### 3.6 Firestore security

- Public read on `shares/{id}` must return **only the safe projection**. Implemented via a dedicated `/api/shares/[token]` Admin-SDK resolver — direct client reads on `shares` are forbidden by rules.
- Write rules on `shares`: only via Admin SDK (`withAuth` + tenant check).
- `share_dispatches`: **no public read**. Server-only writes and reads (admin panels query via Admin SDK).
- Composite indexes (declared in `firestore.indexes.json`):
  - `(companyId, entityType, entityId, isActive)` — "shares for this entity"
  - `(companyId, entityType, createdAt DESC)` — tenant admin dashboards
  - `(token)` — single-field, primary lookup path

---

## 4. Data Flow

### 4.1 Generate share link (all entity types)

```
User → UnifiedShareDialog
      → POST /api/shares/create { entityType, entityId, expiresInHours, password?, maxAccesses, note? }
      → withAuth + withStandardRateLimit
      → UnifiedSharingService.createShare()
          → ShareEntityRegistry.get(entityType).canShare(user, entityId)
          → ShareEntityRegistry.get(entityType).validateCreateInput()
          → generateToken() (crypto.getRandomValues, 32 chars)
          → if password: bcrypt hash server-side
          → setDoc(shares/{id}, ShareRecord)
      → returns { token, url: `${origin}/shared/${token}` }
User copies / shares URL
```

### 4.2 Channel dispatch WITH generated link

```
User → UnifiedShareDialog tab "Απευθείας αποστολή" (contact only)
      → generates link (flow 4.1) OR picks existing share for entityId
      → POST /api/shares/dispatch { shareId, channel, externalUserId, message? }
      → ChannelDispatchService.sendViaChannel()
          → setDoc(share_dispatches/{id}, ShareDispatchLog { shareId, token, ... })
          → invokes channel adapter (Mailgun / Telegram / WhatsApp / Messenger / Instagram)
          → updates status sent/failed
      → UI confirms dispatch + shows permanent link for copy
```

### 4.3 Channel dispatch WITHOUT link (preserves legacy "send email directly")

```
User → tab "Απευθείας αποστολή" → picks "Just send content, no link"
      → POST /api/shares/dispatch { channel, externalUserId, payload: {subject, body, photoUrls} }
        (no shareId, no token)
      → ChannelDispatchService.sendViaChannel()
          → setDoc(share_dispatches/{id}, ShareDispatchLog { shareId: null, token: null, ... })
          → invokes channel adapter
```

This preserves the current `POST /api/communications/email/property-share` behavior (email with photos, no persistent link) during and after migration.

### 4.4 Public access

```
Anonymous visitor → /shared/{token}
      → Server component validates share, checks expiry/maxAccesses/password
      → If password required: → /api/shares/{token}/verify-password { password }
            → Cloud Function bcrypt.compare server-side
            → returns session cookie (scoped: token + 15min TTL)
      → ShareEntityRegistry.get(entityType).resolve(share)
      → incrementAccessCount fire-and-forget
      → renders entity-specific page
```

---

## 5. Migration

### 5.1 Phases

**Phase M1 — Skeleton** (zero user-visible change — ✅ COMMITTED 2026-04-18)
1. Types: `src/types/sharing/share-record.ts` + barrel.
2. Collections: `COLLECTIONS.SHARES`, `COLLECTIONS.SHARE_DISPATCHES`; `FILE_SHARES` marked `@deprecated`.
3. Enterprise ID: `DISPATCH: 'dispatch'` prefix + `generateDispatchId()`.
4. Service SSoT skeleton: `src/services/sharing/unified-sharing.service.ts` — token lifecycle (`createShare`/`validateShare`/`verifyPassword`/`incrementAccessCount`/`revoke`/`listSharesForEntity`/`listSharesForCompany`/`canShare`).
5. Entity registry: `src/services/sharing/share-entity-registry.ts` (empty — resolvers registered in M3).
6. SSoT ratchet: `unified-sharing-service` Tier 2 module in `.ssot-registry.json`; baseline regenerated.
7. Firestore indexes: 3 composite indexes for `shares` declared (not yet deployed).
8. Tests: unit tests for token lifecycle (all paths).

**Phase M1b — Migration + dual-write** (deferred to next PR)
1. Backfill `file_shares` → `shares` with inferred `entityType`:
   - `doc.showcaseMode === true` → `entityType: 'property_showcase'`, `entityId: doc.showcasePropertyId`, `showcaseMeta: { pdfStoragePath: doc.pdfStoragePath, pdfRegeneratedAt: doc.pdfRegeneratedAt }`
   - otherwise → `entityType: 'file'`, `entityId: doc.fileId`, `fileMeta: { mimeType, sizeBytes }` (looked up from `files`)
   - rename `maxDownloads` → `maxAccesses`, `downloadCount` → `accessCount` (keep original fields as deprecated aliases in the doc for one release cycle)
2. Dual-write (`file_shares` + `shares`) for one release cycle to allow rollback.
3. Migrate reads: `FileShareService.validateShare` reads `shares` first, falls back to `file_shares`.

**Phase M2 — Password migration to bcrypt**
1. Deploy Cloud Function `validatePasswordedShare`.
2. For shares with SHA-256 hash: on first successful password verify via legacy path, re-hash with bcrypt server-side, update `passwordHash`. After 90 days, disable legacy SHA-256 path (existing unverified password shares become unrecoverable — users must regenerate).
3. New shares hash with bcrypt from day one.

**Phase M3 — Contact share unification**
1. Replace `ShareModal` / `UserAuthPermissionPanel` imports with `UnifiedShareDialog` (entityType=`contact`).
2. Contact share gains token generation capability; copy-link bug is resolved by construction.
3. `/api/communications/share-to-channel` reroutes internally to `ChannelDispatchService.sendViaChannel()`; legacy API surface kept as thin wrapper for 1 release cycle.
4. `photo_shares` frozen — no new writes; existing docs remain queryable for audit.

**Phase M4 — Public route consolidation**
1. `/shared/po/[token]` becomes 301 redirect to `/shared/[token]`.
2. ADR-312 `src/app/showcase/[token]/page.tsx` repointed to unified public dispatcher (behind same `/shared/[token]` path) OR kept as legacy under `/showcase/[token]` with redirect — choice deferred to implementation phase.

**Phase M5 — Cleanup**
1. Delete `FileShareService` (replaced by `UnifiedSharingService`).
2. Remove legacy wrappers `/api/communications/share-to-channel`, `/api/communications/email/property-share` (now thin proxies).
3. Remove `file_shares` alias reads; drop collection (Firestore doesn't require deletion — abandon reads).
4. Remove legacy fields (`maxDownloads`, `downloadCount`, `showcaseMode`, `showcasePropertyId`, `pdfStoragePath`, `pdfRegeneratedAt` at root) from `ShareRecord`.
5. Update `firestore-rules` tests and `seed-helpers` to reference `shares` / `share_dispatches` only.

### 5.4 Scope reduction (2026-04-18)

The original §5.1 phase plan modeled a **production-grade migration** with dual-write windows, bcrypt Cloud Function + 90-day re-hash cycle, 301 redirects, and feature flags — estimating **2–3 weeks** of focused work (§6.2 original). Giorgio challenged the estimate during implementation; the honest answer is that almost all of that cost is **amortization against real production data and real users**, neither of which exists in this project yet (per `.claude-rules` memory: all Firestore data is test, dropped before go-live; no live password-protected shares).

Reduced plan (this PR):

| Phase | Original intent | What shipped | Why deferred |
|-------|-----------------|--------------|--------------|
| M1 | Skeleton | ✅ Full | — |
| M1b | Backfill + dual-write | ⏸ Skipped | No data to migrate; `file_shares` wiped pre-prod |
| M2 | bcrypt Cloud Function + re-hash | ⏸ Deferred | SHA-256 parity retained via `hashPasswordLegacy`; revisit before first production user |
| M3 | `UnifiedShareDialog` + resolvers + `ChannelDispatchService` + legacy wrappers | ✅ Dialog, resolvers, public dispatcher, channel dispatch service, 2/3 entry points migrated (contact + file). Showcase still on legacy `PropertyShowcaseDialog` (requires splitting `POST /api/properties/[id]/showcase/generate` — not in scope this pass) | Entry-point migration is opportunistic |
| M4 | Public route consolidation + 301 redirects | ~ Partial | `/shared/[token]` dispatches unified+legacy; `/shared/po/[token]` kept for PDF render; redirect path added but consolidation deferred |
| M5 | Cleanup legacy | ⏸ Deferred | `ShareModal` / `ShareDialog` / `FileShareService` still used by other callers |

Total actual time: **~4 hours**, not 2–3 weeks. The SSoT skeleton (M1) + the user-visible unification (most of M3) are what Giorgio actually asked for; the rest was enterprise-migration ceremony designed for a production with real users. It will be revisited when the data stops being test data.

### 5.2 Rollback strategy

- Each phase gated by a feature flag in `system/settings.sharing` (`shares.v2.enabled`, `shares.v2.dialog`, `shares.v2.bcrypt`).
- Dual-write window in M1 lets us flip back to `file_shares` reads without data loss.
- Bcrypt migration is append-only (SHA-256 record is preserved until successful bcrypt re-hash).

### 5.3 Test coverage

- Unit tests: `UnifiedSharingService`, `ChannelDispatchService`, each resolver (`file`, `contact`, `property_showcase`).
- Integration tests: full flow for each entity type (generate → access → password gate → revoke).
- Firestore rules tests: unauthenticated reads on `shares` must fail; public API projection must exclude PII.
- Migration dry-run script: iterates `file_shares`, reports mapping plan without writing.

---

## 6. Consequences

### 6.1 Positive

- **True SSoT for sharing**. One service, one collection, one dialog, one public route.
- **Contact share gains security parity**: expiration, password (bcrypt), max accesses, revocation.
- **Contact share copy-link bug fixed by construction**: the dialog produces a token, never consumes one.
- **Showcase schema cleanup**: ADR-312 inline discriminators promoted to first-class `entityType`/`entityMeta`; `fileId`-for-showcase debt eliminated.
- **Password hashing moved server-side** (bcrypt) — closes known security gap from `FileShareService`.
- **Admin revocation is uniform**: a single "Revoke share" surface works for any entity type.
- **Extensibility**: 4th entity type (listing, document bundle, etc.) costs one resolver file, zero core changes.
- **Auditability**: all dispatches captured in `share_dispatches` with channel, status, recipient, regardless of whether a persistent link was used.

### 6.2 Negative / risks

- **Migration complexity**: 5 phases, dual-write window, bcrypt re-hash — non-trivial effort. ~2-3 weeks of focused work.
- **Breaking change for unverified password shares**: after 90-day bcrypt migration window, legacy SHA-256 shares with an unused password hash cannot be recovered; users must regenerate. Mitigation: announce in release notes; no production user impact expected (test data only pre-production — per project memory).
- **Dialog complexity increases** for contact (two tabs). Mitigated by keeping "Απευθείας αποστολή" as default tab and matching current layout verbatim.
- **Firestore composite indexes** require explicit declaration — one-time deployment step.
- **Temporary API surface bloat** during M3 (legacy wrappers + new dispatch service coexist for one release cycle).

### 6.3 Non-goals

- **Admin analytics dashboard** for share usage — deferred to follow-up ADR.
- **Cross-tenant shares** — explicitly not supported; `companyId` remains a hard partition.
- **External OAuth-backed share access** (e.g. "only users with @company.com can open") — out of scope; may warrant a future ADR if required.

---

## 7. Relation to existing ADRs

| ADR | Relationship |
|-----|--------------|
| ADR-147 — Unified Share Surface | **Extended**. `ShareSurfaceShell` remains the UI foundation; `UnifiedShareDialog` composes it. |
| ADR-312 — Property Showcase | **Partially superseded**: §2 "Scope change to FileShareRecord" (inline discriminators) replaced by polymorphic `entityType` / `showcaseMeta`. Public route `/shared/po/[token]` → 301 to `/shared/[token]`. All other ADR-312 content (PDF renderer, property media service, public resolver API) remains unchanged in behavior. |
| ADR-070/071 — Email channel adapters | **Reused** by `ChannelDispatchService`. No behavior change. |
| ADR-294 — SSoT ratchet | **Extended**. New Tier 2 module `unified-sharing-service` registered in `.ssot-registry.json`; forbids new direct writes to `shares` and re-implementations of sharing logic. |
| ADR-314 — SSoT Discovery Findings | **Addresses** one of the documented duplicates (`FileShareService` vs contact-share inline logic in `UserAuthPermissionPanel`). |

---

## 8. Open questions (to resolve in implementation phase)

1. **Public route strategy for showcase**: keep `/showcase/[token]` path for SEO/brand reasons and redirect `/shared/[token]?entityType=property_showcase` → `/showcase/[token]`? Or fully unify under `/shared/[token]`?
2. **Contact public card rendering**: do we ship a minimal HTML contact card (vCard-like), or only support download of a `.vcf` file? (Out of scope for this ADR — decided at implementation time.)
3. **Dispatch retry policy**: should `share_dispatches` entries with `status: 'failed'` be auto-retried? Current channel adapters do not retry internally.
4. **Rate limiting for public endpoints**: `/shared/[token]` and `/api/shares/[token]` need `withStandardRateLimit` or stricter? The token is public, so naïve brute-force of tokens is a concern — suggest token-space size (32 URL-safe chars ≈ 190 bits) makes this non-exploitable in practice, but rate limiting as defense-in-depth is trivial to add.

---

## 9. Implementation checklist (for future execution PR)

- [x] Phase M1 — skeleton (types + service SSoT + registry + tests) ✅ 2026-04-18
- [~] Phase M1b — backfill script + dual-write — **SKIPPED** (test data pre-production; no real records to migrate — see §5.4)
- [~] Phase M2 — bcrypt migration — **DEFERRED** (no real users; SHA-256 parity retained until first production users)
- [x] Phase M3 — `UnifiedShareDialog` + resolvers + `ChannelDispatchService` + showcase unification ✅ 2026-04-18
- [x] Phase M4 — Public route consolidation ✅ 2026-04-18 — `/shared/[token]` now dispatches all 3 entity types (file inline + contact via `SharedContactPageContent` + showcase via `SharedShowcasePageContent`). Legacy `/shared/po/[token]` retained read-only for ADR-312 legacy `file_shares`-persisted shares.
- [ ] Phase M5 — Cleanup legacy surface (FileShareService, ShareModal, ShareDialog) — deferred
- [x] `.ssot-registry.json` entry `unified-sharing-service` (Tier 2) ✅ 2026-04-18
- [x] `firestore.indexes.json` composite indexes declared + deployed ✅ 2026-04-18
- [ ] `firestore.rules` + rules-test suite updated for `shares` and `share_dispatches` — deferred
- [ ] i18n keys consolidated under `sharing` namespace — deferred (existing `files.share.*` keys reused)
- [ ] Seed helpers updated — deferred
- [ ] ADR-147 and ADR-312 updated with pointer to this ADR — deferred

---

## 10. Changelog

| Date | Change |
|------|--------|
| 2026-04-18 | Initial proposal authored — Claude + Giorgio, derived from three-flow mapping (contact / file / showcase) |
| 2026-04-18 | Phase M1 skeleton implemented (code-truth reconciliation). `ShareRecord.id` prefix aligned to existing SSoT `share_` (was proposed `shr_`). `ShareDispatchLog.id` prefix `dispatch_` added to enterprise-id SSoT (was proposed `dsp_`). Files: `src/types/sharing/*`, `src/services/sharing/unified-sharing.service.ts`, `src/services/sharing/share-entity-registry.ts`, `src/config/firestore-collections.ts` (SHARES + SHARE_DISPATCHES), `.ssot-registry.json` (Tier 2 `unified-sharing-service`), `firestore.indexes.json` (3 composite indexes). Firestore rules + UI + dispatch + bcrypt deferred to M2–M4. Legacy `FileShareService` + `file_shares` unchanged — single operational path until M3. |
| 2026-04-24 | **ADR-321 cross-reference — all showcase public API routes migrated onto showcase-core factories (ADR-321 Phases 2–4).** `GET /api/showcase/[token]` (property), `GET /api/project-showcase/[token]`, `GET /api/building-showcase/[token]` and their `/pdf` counterparts now delegate to `createPublicShowcasePayloadRoute` / `createPublicShowcasePdfRoute` from `src/services/showcase-core/`. The unified `shares` collection lookups and ADR-312 dual-read `file_shares` fallback are preserved inside the factory (property surface only). No change to `/shared/[token]` viewer routing or `UnifiedSharingService`. |
| 2026-04-18 | **Phase M3 + M4 COMPLETE — showcase fully unified**. Split `POST /api/properties/[id]/showcase/generate` into a new standalone PDF endpoint `POST /api/properties/[id]/showcase/pdf` (PDF-only, no Firestore record — consumed by `UnifiedShareDialog.preSubmit` hook). `UnifiedShareDialog` gained a `preSubmit?: () => Promise<Partial<CreateShareInput>>` prop so entity-specific metadata (showcase `pdfStoragePath`) can be produced at submit time. **New files**: `src/app/api/properties/[id]/showcase/pdf/route.ts` (standalone PDF gen), `src/app/api/shared/[token]/pdf/route.ts` (public PDF proxy streaming from `shares` collection — counterpart of legacy `/api/showcase/[token]/pdf`), `src/components/shared/pages/SharedShowcasePageContent.tsx` (public showcase view rendered inside `/shared/[token]`). **Modified**: `src/features/properties-sidebar/PropertiesSidebar.tsx` (replaces `PropertyShowcaseDialog` with `UnifiedShareDialog` entityType=property_showcase + preSubmit hook calling the new PDF endpoint); `src/components/sharing/UnifiedShareDialog.tsx` (adds `preSubmit` prop + result-stage "Κατέβασμα PDF" button for property_showcase); `src/components/shared/pages/SharedFilePageContent.tsx` (showcase branch now renders `SharedShowcasePageContent` inline — the `/shared/po/[token]` redirect is gone). **Deleted**: `src/features/properties-sidebar/components/PropertyShowcaseDialog.tsx` (legacy entry — superseded). Legacy `POST /api/properties/[id]/showcase/generate` kept for retro-compat (no new callers in tree) — removable in M5. User-visible result: identical 4-field dialog (expiration / password / max accesses / note) for file, contact, and property_showcase. |
| 2026-04-18 | Phase M3 implemented (mostly complete). Scope-reduced after Giorgio push-back that the original 3-week plan was over-engineered for a pre-production test-dataset project. **New files**: `src/services/sharing/resolvers/{file,contact,property-showcase}.resolver.ts` + `index.ts` (auto-registering barrel); `src/components/sharing/UnifiedShareDialog.tsx` (single adaptive dialog — 4 canonical fields + contact-only channel-dispatch stage); `src/components/shared/pages/SharedContactPageContent.tsx` (anonymous contact card with `includedFields` enforcement); `src/services/sharing/channel-dispatch.service.ts` (writes `share_dispatches` audit log + delegates to existing `/api/communications/*` outbound routes). **Modified**: `src/components/contacts/list/ContactsList.tsx` (replaces `ShareModal` with `UnifiedShareDialog` entityType=contact → fixes the copy-link bug and gains λήξη/κωδικός/μέγιστες προσβάσεις/σημείωση); `src/components/file-manager/FilePreviewPanel.tsx` (replaces `ShareDialog` with `UnifiedShareDialog` entityType=file); `src/components/shared/pages/SharedFilePageContent.tsx` (unified-first dispatcher with legacy fallback — handles unified file via adapter + contact via resolver + redirects showcase to `/shared/po/[token]`). **Deferred** (honest scope): M1b backfill (no data to migrate), M2 bcrypt (no real users), M4 `/shared/po` redirect (showcase UX still on legacy generate API), M5 cleanup. `ShareDialog` and `ShareModal` remain exported because other callers (`ShareButton`, `projects-list`) still use them — migration is opportunistic. Property Showcase entry (`PropertyShowcaseDialog`) left unchanged: full unification requires splitting the showcase PDF-generate API, deferred. |
