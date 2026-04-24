# ADR-320 — Building Showcase (SSoT Composition)

| Field | Value |
|-------|-------|
| **Status** | ✅ IMPLEMENTED (Phase 6 landed — public `/shared/[token]` viewer for `building_showcase`. All 6 phases green.) |
| **Date** | 2026-04-23 |
| **Category** | Buildings / Public Share Surfaces |
| **Canonical Location** | `src/components/building-showcase/`, `src/app/api/{building-showcase,buildings}/…/showcase/`, `src/services/building-showcase/` (SSoT snapshot + labels) |
| **Siblings** | ADR-312 (property showcase), ADR-315 (unified sharing), project-showcase subsystem (documented in ADR-312 changelog 2026-04-23) |

---

## 1. Problem

The application already has two polymorphic public-link surfaces:

- **Property showcase** (ADR-312) — prospect-facing snapshot of a single unit.
- **Project showcase** (ADR-315 polymorphism + ADR-312 changelog) — prospect-facing snapshot of a whole development.

There is **no equivalent surface for the Building** tier, even though the Building sits between Project and Property in the domain hierarchy and often matches how sales & brokers want to present mid-size assets (single block, multiple units). Today a broker who wants to hand a prospect a building-level presentation either:

1. Improvises a list of property showcases (fragmented, no aggregated specs).
2. Falls back to the project showcase, which over-exposes sister buildings.

**Pain point**: there is no single revocable link that bundles a building's public-facing content (brand header, photos, floorplans, PDF, aggregated specs like total area / floors / units / energy class / renovation status) into one surface.

---

## 2. Decision

**Mirror ADR-315/ADR-312 polymorphism** — do not introduce a new share system or a new public route tree.

- Reuse `ShareEntityRegistry` + the unified `shares` collection: add a fifth resolver `building_showcase` alongside `file`, `contact`, `property_showcase`, `project_showcase`.
- Reuse `resolveShowcaseCompanyBranding({ brandingSource: 'tenant' })` so the logo is always the Energo blue tenant brand, matching the project showcase fix from 2026-04-23.
- Reuse every shared email primitive in `src/services/email-templates/showcase-email-shared.ts` (`renderKeyValueTable`, `renderSectionTitle`, `renderPhotoGrid`, `renderMediaList`, `renderShareCta`, `buildSharedTextFallback`).
- Reuse the unified public router at `/shared/[token]` — add a dispatcher branch to `SharedFilePageContent` for the new `building_showcase` state.
- Reuse `withAuth` + `withStandardRateLimit` + `EntityAuditService` on all new API routes.

---

## 3. Architecture (target, phased)

| Layer | Path | SSoT anchor |
|-------|------|-------------|
| ShareEntityType union | `src/types/sharing.ts` | `ShareEntityType` extended with `'building_showcase'` |
| Wire-format types | `src/types/building-showcase.ts` | `BuildingShowcaseInfo` / `BuildingShowcaseSnapshot` / `BuildingShowcaseMedia` / `BuildingShowcasePayload` |
| Snapshot builder | `src/services/building-showcase/snapshot-builder.ts` | `buildBuildingShowcaseSnapshot(buildingId, locale, adminDb, companyId)` — tenant-isolated, `brandingSource: 'tenant'`, resolves `projectId → projectName` lookup |
| Enum labels + i18n loader | `src/services/building-showcase/labels.ts` | Inline maps over `@/constants/{building-types,building-statuses,renovation-statuses}` SSoT arrays + loader reading `showcase.json → buildingShowcase` namespace |
| i18n namespace | `src/i18n/locales/{el,en}/showcase.json → buildingShowcase` | Mirror of `projectShowcase` namespace + building-specific fields (builtArea, floors, units, energyClass, renovation, constructionYear, project, linkedCompany) |
| Share resolver | `src/services/sharing/resolvers/building-showcase.resolver.ts` | Validates `pdfStoragePath` required; canShare via tenant match; safePublicProjection hides companyId |
| Resolver registry | `src/services/sharing/resolvers/index.ts` | Registers `building_showcase` in `registerShareResolvers()` |
| Email template | `src/services/email-templates/building-showcase-email.ts` (planned Phase 2) | Reuses `showcase-email-shared.ts` helpers + local `renderBuildingHero` / `renderBuildingSpecs` |
| PDF generator route | `src/app/api/buildings/[buildingId]/showcase/pdf/route.ts` (planned Phase 3) | `withAuth('buildings:buildings:update')` + standard rate limit; returns `{ pdfStoragePath, pdfRegeneratedAt }` |
| Email dispatch route | `src/app/api/buildings/[buildingId]/showcase/email/route.ts` (planned Phase 3) | Mirror of project email route; validates tenant, loads snapshot + media, sends via Mailgun |
| Public payload route | `src/app/api/building-showcase/[token]/route.ts` (planned Phase 3) | Anonymous GET; returns `BuildingShowcasePayload` |
| Public PDF proxy | `src/app/api/building-showcase/[token]/pdf/route.ts` (planned Phase 3) | Anonymous GET; streams PDF via Admin SDK |
| PDF service | `src/services/pdf/BuildingShowcasePDFService.ts` (planned Phase 4) | Dynamic `jspdf` import + `JSPDFAdapter` + `registerGreekFont` + `BuildingShowcaseRenderer` |
| PDF renderer | `src/services/pdf/renderers/BuildingShowcaseRenderer.ts` (planned Phase 4) | Reuses `TextRenderer`, `COLORS`, `FONT_SIZES`, `drawPhotoGrid`, `drawFloorplanGrid` primitives under `src/services/pdf/` |
| Entity action wiring | `BuildingDetailsHeader.tsx` + `BuildingDetails.tsx` (planned Phase 5) | New `onShowcaseBuilding` prop + `createEntityAction('showcase', …)` preset |
| Dialog dispatch | `UnifiedShareDialog.tsx` (planned Phase 5) | Extend download button condition + public PDF path for `building_showcase` |
| Email panel dispatch | `UserAuthPermissionPanel.tsx` (planned Phase 5) | Extend `showcaseContext` discriminated union with `{ type: 'building', buildingId }` |
| Public page dispatcher | `useSharedFilePageState.ts` + `SharedFilePageContent.tsx` (planned Phase 6) | New state `'building_showcase'` + dispatch to `SharedBuildingShowcasePageContent` |
| Public client | `src/components/building-showcase/BuildingShowcaseClient.tsx` (planned Phase 6) | Fetches `/api/building-showcase/[token]` + renders hero, specs, photos, floorplans, PDF CTA |

---

## 4. Domain mapping — Building → Showcase

| Building field (Firestore) | Snapshot field | Label namespace key | Notes |
|----------------------------|----------------|---------------------|-------|
| `code` | `code` | `specs.code` | ADR-233 sequential code |
| `name` | `name` | (header) | Falls back to id |
| `description` | `description` | `description.sectionTitle` | Optional |
| `type` (`BuildingType`) | `typeLabel` | `specs.type` | Translated via `translateBuildingType()` over `@/constants/building-types` |
| `status` (`BuildingStatus`) | `statusLabel` | `specs.status` | Translated via `translateBuildingStatus()` over `@/constants/building-statuses` |
| `energyClass` (`EnergyClass`) | `energyClassLabel` | `specs.energyClass` | Displayed as-is (EU standard codes) |
| `renovation` (`RenovationStatus`) | `renovationLabel` | `specs.renovation` | Translated via `translateRenovationStatus()` |
| `progress` | `progress` | `specs.progress` | 0–100 |
| `totalArea` | `totalArea` | `specs.totalArea` | m² |
| `builtArea` | `builtArea` | `specs.builtArea` | m² |
| `floors` | `floors` | `specs.floors` | Integer |
| `units` | `units` | `specs.units` | Integer |
| `totalValue` | `totalValue` | `specs.totalValue` | EUR |
| `constructionYear` | `constructionYear` | `specs.constructionYear` | Integer |
| `startDate` / `completionDate` | same | `specs.{startDate,completionDate}` | ISO string |
| `address` / `city` / `location` | same | `specs.location` | Legacy string fields (ADR-167 multi-address deferred) |
| `projectId` | `projectId` | — | Used for branding hierarchy + name lookup |
| (derived: projects/{projectId}.name) | `projectName` | `specs.project` | Secondary lookup |
| `linkedCompanyName` | `linkedCompanyName` | `specs.linkedCompany` | Optional |

---

## 5. Security & tenant isolation

Same model as property / project showcase:

- All API routes that mutate/generate (PDF regen, email dispatch) are wrapped in `withAuth` + permissioned against `buildings:*`.
- The snapshot builder throws `TenantMismatchError` if `building.companyId !== ctx.companyId` — identical guarantee as `project-showcase/snapshot-builder.ts::TenantMismatchError`.
- The resolver's `canShare()` re-validates same-tenant match against the live Firestore building doc before creating the share.
- Public routes (`/api/building-showcase/[token]` + `/pdf`) validate the share token, re-check tenant, and stream through the Admin SDK without exposing `companyId`.

---

## 6. Branding rule

`brandingSource: 'tenant'` is hardcoded in the snapshot builder. Same as the project showcase (fixed 2026-04-23). The tenant/developer brand is always surfaced — never the linked client contact's brand — because a building presentation represents the developer's offering, not the end-client's identity.

The hierarchy walk in `resolveShowcaseCompanyBranding` is bypassed via the explicit flag:

```ts
await resolveShowcaseCompanyBranding({
  adminDb,
  propertyData: projectId ? { projectId } : {},
  companyId,
  brandingSource: 'tenant',
});
```

---

## 7. Rollout phases

1. **Phase 1** — SSoT fondamenta: types, snapshot-builder, labels, resolver, i18n namespace, resolver registry. ✅ This commit.
2. **Phase 2** — Email template reusing `showcase-email-shared.ts`.
3. **Phase 3** — API routes (PDF gen, email, public payload, public PDF proxy).
4. **Phase 4** — PDF service + renderer.
5. **Phase 5** — UI wiring: header action, `UnifiedShareDialog` + `UserAuthPermissionPanel` branches.
6. **Phase 6** — Public page: `BuildingShowcaseClient` + `/shared/[token]` dispatcher branch.
7. **Phase 7** — ADR finalisation + manual end-to-end verification.

---

## 8. Changelog

| Date       | Change |
|------------|--------|
| 2026-04-23 | Phase 1 landed — SSoT fondamenta. Extended `ShareEntityType` union with `'building_showcase'`. New `types/building-showcase.ts`, `services/building-showcase/{snapshot-builder,labels}.ts`, `services/sharing/resolvers/building-showcase.resolver.ts`. Registered in `registerShareResolvers()`. Added `buildingShowcase` namespace to `showcase.json` (el + en) mirroring `projectShowcase` with building-specific fields (builtArea, floors, units, energyClass, renovation, constructionYear, project, linkedCompany). Tenant isolation + `brandingSource: 'tenant'` enforced. Phase 2 (email template) next. |
| 2026-04-23 | Phase 2 landed — branded email template. New `services/email-templates/building-showcase-email.ts` exports `buildBuildingShowcaseEmail({ snapshot, labels, photos, floorplans, shareUrl, personalMessage })` returning `{ subject, html, text }`. 100% reuse of the SSoT helpers from `showcase-email-shared.ts` (`renderKeyValueTable`, `renderSectionTitle`, `renderPhotoGrid`, `renderMediaList`, `renderShareCta`, `buildSharedTextFallback`) — only `renderBuildingHero` + `renderBuildingSpecs` are local, because their field set differs from property/project (builtArea, floors, units, energyClass, renovation, constructionYear, project, linkedCompany). Subject prefix from `labels.email.subjectPrefix`; optional sender `personalMessage` overrides the default intro. Phase 3 (API routes) next. |
| 2026-04-23 | Phase 3+4 landed together — API routes + PDF service (co-dependent, one commit to avoid broken imports mid-stream). Four new routes: `POST /api/buildings/[buildingId]/showcase/{pdf,email}` (authenticated, tenant-isolated via `buildBuildingShowcaseSnapshot`, rate-limited, EntityAudit on email_sent) and `GET /api/building-showcase/[token]{,/pdf}` (public, anonymous, rate-limited, streams PDF via Admin SDK through the shared `streamPdfFromStorage` helper). Email + PDF paths both pre-upload-claim the PDF file id in `FILE_SHARES` before Storage upload so orphan cleanup never deletes the artifact mid-flight. PDF service: new `services/pdf/BuildingShowcasePDFService.ts` (jsPDF + Greek font + renderer) + `services/pdf/renderers/BuildingShowcaseRenderer.ts` — 5-page layout (cover / specs 2-column grid / description / photos grid / floorplans grid) reusing `drawShowcaseBrandHeader`, `drawMediaGridPage`, `TextRenderer`, layout constants with **zero duplication**. Specs grid widened to 8 rows to cover building-specific fields (builtArea, floors, units, energyClass, renovation, constructionYear, project name, linkedCompany). Phase 5 (UI wiring) next. |
| 2026-04-23 | Phase 5 landed — UI wiring. (1) `BuildingDetailsHeader.tsx`: new optional `onShowcaseBuilding` prop + `createEntityAction('showcase', …)` preset (violet→fuchsia gradient, already in the preset registry). Hidden in trash mode. (2) `BuildingDetails.tsx`: new `showcaseDialogOpen` state + `buildingShowcasePdfPreSubmit` callback mirroring the project showcase pattern (validates `pdfStoragePath` with `.trim()`, falls back to `nowISO()` for `pdfRegeneratedAt`) + `<UnifiedShareDialog entityType="building_showcase" entityId={building.id} preSubmit={buildingShowcasePdfPreSubmit}>` rendered alongside `DetailsContainer`. (3) `UnifiedShareDialog.tsx`: extended `showcaseContext` discriminated union to dispatch `{ type: 'building', buildingId }` for `building_showcase`, and the download-PDF button condition + href now covers the three entity types (property/project/building). (4) `UserAuthPermissionPanel.tsx`: extended the `showcaseContext` union type + email-endpoint dispatch ternary to route building shares to `/api/buildings/{id}/showcase/email`. Phase 6 (public viewer page) next. |
| 2026-04-24 | **ADR-321 cross-reference — building-showcase migrated onto showcase-core generics (ADR-321 Phase 2).** `BuildingShowcasePDFService`, `BuildingShowcaseRenderer`, `building-showcase-email`, `building-showcase/labels`, and 4 API routes rewritten as thin configs on top of core factories. Zero behavioural change. Canonical location for orchestration now `src/services/showcase-core/`. See ADR-321 Phase 2 part 2 changelog entry for full detail. |
| 2026-04-23 | Phase 6 landed — public `/shared/[token]` viewer. Three new components: `components/building-showcase/BuildingShowcaseSpecs.tsx` (key/value grid reading the 17 `BuildingShowcaseInfo` fields via `showcase.buildingShowcase.*` i18n keys, uses `formatDate` + Intl currency), `components/building-showcase/BuildingShowcaseClient.tsx` (fetches `/api/building-showcase/[token]?locale=…`, 5-state machine loading/ready/expired/notfound/error, reuses `ShowcaseHeader` + `ShowcaseFooter` + `MessageScreen` from property-showcase/ShowcaseShared for visual parity), `components/shared/pages/SharedBuildingShowcasePageContent.tsx` (thin dispatcher wrapper). Hook + dispatcher extended: `useSharedFilePageState.ts` adds `building_showcase` to `PageState` union + two branches (pre-password-gate + post-password-gate) that call `UnifiedSharingService.incrementAccessCount` and transition to the new state; `SharedFilePageContent.tsx` imports the new component and dispatches on `state === 'building_showcase'`. No changes to the PDF/email flows — the viewer uses the same public-payload route that Phase 3 landed. |
