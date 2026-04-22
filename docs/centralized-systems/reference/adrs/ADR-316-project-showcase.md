# ADR-316 — Project Showcase (Επίδειξη Έργου)

| Field | Value |
|-------|-------|
| **Status** | 📋 In Progress |
| **Date** | 2026-04-22 |
| **Domain** | Projects / Sharing / PDF / Public Surfaces |
| **Extends** | ADR-312 (Property Showcase), ADR-315 (Unified Sharing) |

---

## 1. Context

ADR-312 + ADR-315 implement a full property showcase: branded PDF generation, polymorphic token sharing (`UnifiedSharingService`), multi-channel dispatch (Telegram/WhatsApp/email), and a public viewer at `/shared/{token}`.

Giorgio requested the same feature for **projects** (Έργα): a "Επίδειξη Έργου" button in the project detail header, identical UX and infrastructure, zero scattered code, zero duplicates.

---

## 2. Decision

Extend the existing `UnifiedSharing` infrastructure with a new `entityType: 'project_showcase'`. No new sharing infrastructure — one new resolver, one new snapshot builder, one new PDF service, one new public viewer.

### What is shared (zero duplication)

| Centralized system | Path |
|--------------------|------|
| `UnifiedSharingService` | `src/services/sharing/unified-sharing.service.ts` |
| `UnifiedShareDialog` | `src/components/sharing/UnifiedShareDialog.tsx` |
| `ShareEntityRegistry` | `src/services/sharing/share-entity-registry.ts` |
| `resolveShowcaseCompanyBranding()` | `src/services/company/company-branding-resolver.ts` |
| `PropertyShowcaseBrandHeader` (PDF) | `src/services/pdf/renderers/PropertyShowcaseBrandHeader.ts` |
| jsPDF + Greek font loader | `src/services/pdf/` |
| `loadShareByToken()` dual-read helper | `src/app/api/showcase/[token]/helpers.ts` |

### New modules (ADR-316 scope)

| Module | Path | Role |
|--------|------|------|
| Types SSoT | `src/types/project-showcase.ts` | Wire-format contracts |
| Snapshot Builder | `src/services/project-showcase/snapshot-builder.ts` | Firestore → `ProjectShowcaseSnapshot` |
| Labels | `src/services/project-showcase/labels.ts` | Server-side i18n for PDF |
| PDF Service | `src/services/pdf/ProjectShowcasePDFService.ts` | PDF orchestrator |
| PDF Renderer | `src/services/pdf/renderers/ProjectShowcaseRenderer.ts` | jsPDF render chain |
| PDF API | `src/app/api/projects/[projectId]/showcase/pdf/route.ts` | Authenticated PDF generation |
| Public API | `src/app/api/project-showcase/[token]/route.ts` | Public token resolver |
| Share Resolver | `src/services/sharing/resolvers/project-showcase.resolver.ts` | Plugin for ShareEntityRegistry |
| Public Viewer | `src/components/project-showcase/ProjectShowcaseClient.tsx` | Public page component |
| Dispatch | `src/components/shared/pages/SharedFilePageContent.tsx` | Adds `project_showcase` branch |

---

## 3. Data Model

### `ProjectShowcaseSnapshot` (server-side wire format)

```
project: ProjectShowcaseInfo {
  id, projectCode, name, description
  typeLabel, statusLabel, progress
  totalValue, totalArea
  startDate, completionDate
  address, city, location, client, linkedCompanyName
}
company: ShowcaseCompanyBranding  ← shared with property showcase
```

### `ProjectShowcasePayload` (public API response)

```
project: ProjectShowcaseInfo
company: ShowcaseCompanyBranding
photos: ProjectShowcaseMedia[]
floorplans: ProjectShowcaseMedia[]
videoUrl?, pdfUrl?, expiresAt
```

### Firestore `shares` record

```
entityType: 'project_showcase'
entityId: <projectId>
showcaseMeta: { pdfStoragePath, pdfRegeneratedAt }
```

Storage path: `companies/{companyId}/projects/{projectId}/showcase/documents/{fileId}.pdf`

---

## 4. Flow

```
1. User clicks "Επίδειξη Έργου" (ProjectDetailsHeader)
   → project-details.tsx: setShowcaseDialogOpen(true)

2. UnifiedShareDialog opens
   → preSubmit: POST /api/projects/{id}/showcase/pdf
   → generates PDF → uploads to Storage → returns pdfStoragePath

3. UnifiedSharingService.createShare({
     entityType: 'project_showcase', entityId: projectId,
     showcaseMeta: { pdfStoragePath }
   })
   → writes to COLLECTIONS.SHARES

4. User copies link / sends via Telegram/WhatsApp/email
   → URL: /shared/{token}

5. Public access: SharedFilePageContent dispatches on entityType
   → 'project_showcase' → SharedProjectShowcasePageContent
   → ProjectShowcaseClient fetches GET /api/project-showcase/{token}
   → renders project specs + photos + floorplans + PDF download
```

---

## 5. GOL Checklist

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive or reactive? | Proactive — PDF at preSubmit, before createShare |
| 2 | Race condition? | No — preSubmit awaited before createShare |
| 3 | Idempotent? | Yes — policy change = new share + revoke old |
| 4 | Belt-and-suspenders? | Yes — dual-read token resolver (shares + file_shares) |
| 5 | SSOT? | Yes — snapshot-builder owns project→wire mapping |
| 6 | Await? | Yes for preSubmit + createShare |
| 7 | Lifecycle owner? | UnifiedSharingService (unchanged) |

---

## 6. Changelog

| Date | Change |
|------|--------|
| 2026-04-22 | ADR created — F0 foundation: types + i18n + ShareEntityType extension |
| 2026-04-22 | F1: snapshot-builder + labels.ts (PROJECT_TYPE/STATUS_LABELS) |
| 2026-04-22 | F2+F3: ProjectShowcasePDFService + ProjectShowcaseRenderer + public GET route + authenticated PDF POST route (in commit 12c431ab due to race) |
| 2026-04-22 | F4: project-showcase.resolver.ts + resolvers/index.ts registration |
| 2026-04-22 | F5: ProjectShowcaseClient + ProjectShowcaseHeader + ProjectShowcaseSpecs + SharedProjectShowcasePageContent + useSharedFilePageState dispatch + SharedFilePageContent dispatch |
| 2026-04-22 | F6: ProjectDetailsHeader onShowcaseProject prop + project-details.tsx UnifiedShareDialog + preSubmit PDF callback |
| 2026-04-22 | F7: i18n detailsHeader.actions.showcase (el + en) |
| 2026-04-22 | F8: .ssot-registry.json project-showcase-service module (Tier 2) |
| 2026-04-22 | Cleanup: extracted shared MessageScreen+ShowcaseFooter → ShowcaseShared.tsx; extended ShowcaseHeader with titleOverride+subtitleOverride; removed ProjectShowcaseHeader.tsx; extracted jsonError+streamPdfFromStorage → shared-pdf-proxy-helpers.ts (GOL+SSoT) |
