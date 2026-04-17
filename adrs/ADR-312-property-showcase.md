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
- **Showcase PDF URL** — the PDF object is `makePublic()` on upload. Because the URL contains `{shareId}` and the shareId is enterprise-id-generated, enumeration is not practical. Revoke marks the share inactive but **does not delete the blob**; follow-up hardening could move PDFs behind a signed-URL gateway.
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
