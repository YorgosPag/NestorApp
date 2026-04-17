# ADR-312 — Property Showcase (SSoT Composition)

| Field | Value |
|-------|-------|
| **Status** | ✅ IMPLEMENTED (MVP) |
| **Date** | 2026-04-17 |
| **Category** | Properties / Public Share Surfaces |
| **Canonical Location** | `src/app/showcase/[token]/`, `src/components/property-showcase/`, `src/app/api/{showcase,properties}/...` |

---

## 1. Problem

Sales & brokers need to hand prospects a self-contained view of a property: photos, floorplans, a short description, core specs, a PDF they can keep, and a link that works without a login. The existing application only exposes the authenticated `/properties` tree (invisible to outside contacts) and the `/shared/[token]` page (generic file preview, no property context).

**Pain point**: there is no single surface that bundles a property's public-facing content (brand header, photos, floorplans, video, PDF) behind one revocable link.

---

## 2. Decision

**Compose existing SSoT — do not introduce a new share system.**

- Reuse `FileShareService` + `FILE_SHARES` collection for token, TTL, revocation, tenant isolation.
- Reuse `PropertyShowcasePDFService` built on the existing `jspdf`/`JSPDFAdapter`/`TextRenderer` primitives under `src/services/pdf/`.
- Reuse `getAdminFirestore()` / `getAdminStorage()` / `withAuth` / `withStandardRateLimit` patterns already used by `/api/properties/[id]/generate-description`.
- Reuse `createEntityAction` preset registry for the header action button; add one new preset `showcase`.
- Reuse `GRADIENT_HOVER_EFFECTS` tokens; add one new token `VIOLET`.

**Scope change to FileShareRecord**: three optional fields (no migration required):

| Field | Purpose |
|-------|---------|
| `showcasePropertyId?: string` | Links a share to the property it represents |
| `showcaseMode?: boolean` | Distinguishes showcase shares from regular file shares |
| `pdfStoragePath?: string` | Server path to the generated PDF (for public download URL reconstruction) |

---

## 3. Architecture

| Layer | Path | SSoT anchor |
|-------|------|-------------|
| PDF renderer | `src/services/pdf/renderers/PropertyShowcaseRenderer.ts` | Uses `IPDFDoc`, `TextRenderer`, `COLORS`, `FONT_SIZES` from the existing `src/services/pdf/` module |
| PDF service | `src/services/pdf/PropertyShowcasePDFService.ts` | Dynamic `jspdf` import (server-compatible); wraps result in `JSPDFAdapter` |
| Generate/Revoke API | `src/app/api/properties/[id]/showcase/generate/route.ts` | `withAuth` + `withStandardRateLimit`; tenant isolation on `companyId`; `'properties:properties:read'` for POST, `'...:update'` for DELETE |
| Public resolver API | `src/app/api/showcase/[token]/route.ts` | Anonymous GET; validates share via Admin SDK (bypasses client rules); returns property snapshot + photos/floorplans from `files` collection |
| Public PDF proxy | `src/app/api/showcase/[token]/pdf/route.ts` | Anonymous GET; re-validates share + tenant cross-check; streams PDF via Admin SDK `createReadStream()`; rate-limited (`withStandardRateLimit`); increments `downloadCount` fire-and-forget |
| Public page (server) | `src/app/showcase/[token]/page.tsx` | Exports `robots: { index: false, follow: false }` metadata; delegates to client renderer |
| Public page (client) | `src/components/property-showcase/ShowcaseClient.tsx` + `Showcase{Header,Specs,PhotoGrid,Floorplans,VideoEmbed}.tsx` | Tailwind-only styling, no inline styles; i18n through `showcase` namespace |
| Dialog (action) | `src/features/properties-sidebar/components/PropertyShowcaseDialog.tsx` | shadcn `Dialog`, `Button`; posts/deletes to the generate API |
| Header wiring | `PropertyDetailsHeader.tsx` + `PropertiesSidebar.tsx` | New `onShowcaseProperty` prop; violet action button between `new` and `delete` |
| i18n | `src/i18n/locales/{el,en,pseudo}/showcase.json` + `properties-detail.json` (`showcase.*`, `navigation.actions.showcase.*`) | Registered in `lazy-config.ts`, `namespace-loaders.ts`, `namespace-manifest.json` |

---

## 4. Data Flow — Generate

```
┌─────────────┐    POST /api/properties/{id}/showcase/generate
│  Dialog UI  │──────────────────────────────────────────────────▶
└─────────────┘                                                    │
                                                                   ▼
                                            ┌────────────────────────────┐
                                            │ withAuth + rate-limit      │
                                            │ + tenant-isolation check   │
                                            └─────────────┬──────────────┘
                                                          │
            ┌─────────────────────────────────────────────┴──────────────┐
            │ loadShowcaseSources(propertyId, companyId) via Admin SDK    │
            │  - property doc                                              │
            │  - company doc (branding)                                    │
            │  - count(photos subcol)                                      │
            │  - count(unit_floorplans where companyId+propertyId)         │
            └─────────────────────────────────────┬─────────────────────┘
                                                   │
                              ┌────────────────────┴──────────────────┐
                              │ PropertyShowcasePDFService.generate() │
                              │   → Uint8Array                         │
                              └────────────────────┬──────────────────┘
                                                   │
                              ┌────────────────────┴──────────────────┐
                              │ uploadPdfToStorage()                   │
                              │   bucket().file(companies/{companyId}/ │
                              │     property-showcases/{propertyId}/   │
                              │     {shareId}.pdf)                     │
                              │   .save(buffer).makePublic()           │
                              └────────────────────┬──────────────────┘
                                                   │
                              ┌────────────────────┴──────────────────┐
                              │ adminDb.collection(FILE_SHARES)        │
                              │   .doc(shareId).set({                  │
                              │     token, companyId, createdBy,       │
                              │     expiresAt: +30 days,               │
                              │     showcaseMode: true,                │
                              │     showcasePropertyId,                │
                              │     pdfStoragePath                     │
                              │   })                                   │
                              └────────────────────┬──────────────────┘
                                                   │
                                                   ▼
                            Response: { token, pdfUrl, richUrl, expiresAt }
```

---

## 5. MVP Decisions

| Knob | Decision | Reason |
|------|----------|--------|
| TTL | Fixed 30 days (720 h) | No UI selector — keep dialog simple |
| Password | Disabled | Low-friction sharing beats link-protection at this stage |
| Analytics | Relies on existing `downloadCount` | No bespoke analytics UI |
| Video embed | Stored in `FileShareRecord.note` (hijacked, MVP); rendered as external link | Avoids a fourth new field |
| Email | Not wired to the dialog (MVP) | `/api/communications/email/property-share` already exists — future wire |
| Photo/floorplan source | `files` collection `entityType='property'`, `entityId=propertyId`, `category∈{photos,floorplans}` | SSoT per ADR-191 / ADR-292 |
| PDF embedding | Text-only MVP (no photos inside the PDF) | Keeps server generation dependency-free and < 1 MB per PDF |

---

## 6. Security Considerations

- **Firestore rules** — `file_shares` is already public-read (required for anonymous token validation on `/shared/[token]`). The public showcase endpoint does not rely on rules: it runs under Admin SDK and re-checks `showcaseMode=true`, active state, and expiry.
- **Tenant isolation** — generate/delete endpoints assert `property.companyId === ctx.companyId` before touching Storage or Firestore. The public resolver cross-checks `share.companyId === property.companyId` to refuse a forged share ID pointing at a foreign tenant's property.
- **Token entropy** — 32-char URL-safe random (62 alphabet). Matches `FileShareService`'s own generator.
- **Showcase PDF URL** — the PDF object is **never public**. Download is served by `/api/showcase/[token]/pdf`, which validates the share token, cross-checks `share.companyId === property.companyId`, and streams via Admin SDK. Revoking the share (`isActive=false`) immediately invalidates the PDF URL — no blob deletion required.
- **Rate limit** — POST/DELETE use `withStandardRateLimit` (60/min per user). The anonymous GET resolver has no rate limit in MVP; add IP-based limit if abuse appears.

---

## 7. Alternatives Considered

| Option | Rejected because |
|--------|------------------|
| Greenfield `/api/showcase/*` with bespoke `showcase_shares` collection | Duplicates FILE_SHARES, splits RBAC, doubles rules surface |
| Embed photos inside the PDF | Needs server `addImage()` + remote fetch of every photo → heavy PDFs, slow generation, 60 s timeout risk |
| Client-side PDF generation + upload | Duplicates trust boundary (client-generated artifact uploaded to Storage, then marked "branded") |
| Add dedicated `showcase_shares` collection later if FILE_SHARES gets crowded | Deferred: current volume is trivial; one-file schema is cheaper to operate |

---

## 8. Consequences

**Positive**
- Zero new runtime services, one new renderer, one new page, one new dialog. Everything else is composition.
- One SSoT for every showcase link (FILE_SHARES): revocation, TTL, audit, download-count all free.
- Rich page stays thin (~200 lines split across 5 UI files) because data prep is server-side.

**Negative**
- `FileShareRecord.note` is overloaded (general-purpose note AND showcase video URL). Resolve later by adding a dedicated field when/if video moves to a native property attribute.
- MVP PDF lacks embedded photos — compensated by photos rendered on the public page. Upgrade is a drop-in renderer change.
- `/api/showcase/[token]` is unrated — revisit under abuse or when exposing the surface externally.

---

## 9. Changelog

| Date | Change |
|------|--------|
| 2026-04-17 | Initial MVP implementation + ADR filing (shareId collision with the camera-capture ADR forced the number bump from 311 → 312) |
| 2026-04-18 | Attempted fix by reverting `FIREBASE_STORAGE_BUCKET` to `.appspot.com` — rolled back: GCS returned `The specified bucket does not exist.` The canonical bucket for this project is `pagonis-87766.firebasestorage.app` (only `.firebasestorage.app` exists; no legacy `.appspot.com` bucket was ever created). |
| 2026-04-18 | **Fixed signed URL incompatibility with `.firebasestorage.app` buckets.** Root cause: GCS XML API (host `storage.googleapis.com/{bucket}/...`) returns `NoSuchKey` for objects in `.firebasestorage.app` buckets because XML API does not serve that host domain — only JSON API and the Firebase download-token endpoint do. Signed URLs are XML-API-based, so they are fundamentally incompatible with this bucket class. **Fix**: replaced `getSignedUrl()` with the Firebase download-token pattern. On upload, `uploadPdfToStorage()` sets `metadata.firebaseStorageDownloadTokens = crypto.randomUUID()` and returns `{ url, downloadToken }` where `url = https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media&token={token}` (permanent URL, valid while both file and token metadata persist). `writeShowcaseShareRecord()` stores `pdfDownloadToken` on the `FILE_SHARES` doc alongside `pdfStoragePath`. Public resolver `/api/showcase/[token]` rebuilds the URL from `bucket.name + storagePath + downloadToken` without any signing round-trip. `FileShareRecord` + `CreateShareInput` gain `pdfDownloadToken?: string`. Exported helper `buildDownloadTokenUrl()` is the single point of URL construction. Revoke deactivates the share; to fully invalidate the PDF URL, future hardening can rotate the `firebaseStorageDownloadTokens` metadata via Admin SDK. |
| 2026-04-18 | **Bucket resolver SSoT (`getAdminBucket()`).** The proxy `exists()` check returned `false` for a PDF that had just been uploaded successfully (upload's own post-`save()` `exists()` passed). Root cause: `getAdminStorage().bucket()` (no-arg) relies on the Admin SDK's implicit default, which under Next.js dev hot-reload can momentarily resolve the bucket against the legacy `{projectId}.appspot.com` alias, producing cross-request inconsistencies on `.firebasestorage.app` buckets. **Fix**: added `getAdminBucket()` in `src/lib/firebaseAdmin.ts` — the single source of truth for server-side Storage. It requires `FIREBASE_STORAGE_BUCKET` explicitly (throws if unset) and returns `getAdminStorage().bucket(envBucketName)`. Migrated `uploadPdfToStorage()` + `streamPdfFromStorage()` to use it. Every future server-side Storage access must go through this helper. |
| 2026-04-18 | **Replaced Firebase download-token URL with server-side proxy endpoint `/api/showcase/[token]/pdf`.** Root cause: buckets on the `.firebasestorage.app` domain do **not** honor the download-token bypass over `storage.rules`, returning `403 Permission denied` even with valid token metadata (verified via `getMetadata()` — token writes succeeded but download was still denied). The legacy `.appspot.com` bucket this project would have needed does not exist in GCS (`The specified bucket does not exist.`), so reverting the bucket is not an option. **Fix**: the PDF is now streamed by a new anonymous route (`src/app/api/showcase/[token]/pdf/route.ts`) that reuses the existing showcase-share validation (active + `showcaseMode` + not expired), cross-checks `share.companyId === property.companyId`, and streams via Admin SDK `createReadStream()` — bypasses `storage.rules` by design. The response sets `Content-Disposition: attachment` with a filename derived from `property.code` + `property.name`, and increments `share.downloadCount` fire-and-forget. Rate-limited with `withStandardRateLimit` (anonymous IP-keyed). Cleanup: removed `pdfDownloadToken` from `FileShareRecord`/`CreateShareInput`, removed `generateOpaqueToken()` usage + `setMetadata({ firebaseStorageDownloadTokens })` call + post-upload diagnostic read-back + exported `buildDownloadTokenUrl()` helper. `uploadPdfToStorage()` now returns `void` and only performs `save()` + `exists()` verification. Architecture is simpler: the share token is the single authorization for the PDF — no separate download token, no metadata writes, no public blob. Revocation (`isActive=false`) instantly invalidates the download URL. |
| 2026-04-17 | **Fixed showcase PDFs being deleted by `onStorageFinalize` orphan-cleanup trigger (§Race).** Root cause: `functions/src/storage/orphan-cleanup.ts` verified file ownership against a **single hardcoded collection** (`FILES`). Showcase PDFs write their ownership claim only into `FILE_SHARES` per ADR-312, so every freshly uploaded showcase PDF was mis-classified as orphan and deleted ~8 s after upload (verified via MCP `storage_list_files`: `photos/files/` populated, `documents/files/` permanently empty; the upload's post-`save()` `exists()` passed because the trigger had not yet fired). **Fix — SSoT ownership resolver**: new module `functions/src/shared/file-ownership-resolver.ts` exposes `findFileOwner(db, fileId)` backed by an ordered registry `OWNERSHIP_CLAIM_PROVIDERS` (FILES → FILE_SHARES → future). Adding a new file-producing system that does not use `FILES` = add **one** entry to that registry; every orphan check automatically benefits. `onStorageFinalize` now delegates to `findFileOwner()` instead of hardcoding the `FILES` lookup. **Fix — race elimination**: `/api/properties/[id]/showcase/generate/route.ts` now writes the `FILE_SHARES` ownership claim **before** `uploadPdfToStorage()` (so the trigger always finds the claim), with a compensation `deleteShowcaseShareRecord(shareId)` that removes the orphaned claim if the upload itself fails. Added `FILE_SHARES: 'file_shares'` to `functions/src/config/firestore-collections.ts` (SSoT mirror). |
