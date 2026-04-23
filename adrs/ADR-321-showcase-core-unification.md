# ADR-321 — Showcase Core Unification (Property = SSoT Baseline)

| Field | Value |
|-------|-------|
| **Status** | 🟡 IN PROGRESS — Phase 0 scaffolding landing. Migration of 3 surfaces follows in Phases 2–4. |
| **Date** | 2026-04-23 |
| **Category** | Architecture / Public Share Surfaces |
| **Canonical Location** | `src/services/showcase-core/`, `src/components/showcase-core/`, `src/app/api/showcase-core/` (route factories) |
| **Siblings** | ADR-312 (property showcase — canonical baseline), ADR-315 (unified sharing), ADR-320 (building showcase — last copy before this ADR) |
| **Owner** | Giorgio Pagonis |

---

## 1. Problem

As of ADR-320 landing (2026-04-23), the codebase has **three parallel public-showcase subsystems**:

- Property showcase — ADR-312, the oldest, most tested, most feature-rich (~2 633 LOC).
- Project showcase — ADR-315 polymorphism + ADR-312 changelog 2026-04-23 (~1 549 LOC).
- Building showcase — ADR-320 (~1 576 LOC).

Across 12 structural layers (snapshot-builder, labels, PDF service, PDF renderer, share resolver, email template, 4 API routes, public Client, Specs, shared page wrapper) the three subsystems are **70 %–95 % structurally identical** — they differ only in:

1. Firestore collection name.
2. Entity field shape (snapshot `Info` interface).
3. Enum-label maps (translate* helpers from the enum-label service).
4. i18n namespace key under `showcase.json`.
5. Entity-specific extension sections (property has ~1 000 LOC of extras: `linkedSpaces`, floorplans per unit, systems/finishes/features/views/condition/energy — project and building have none).

**Net effect**: ~1 500 LOC of copy-pasted orchestration is duplicated 3× (will become 4× if a unit/floor/parking showcase ever arrives). Manual bug-fix cost is linear in the number of surfaces (every regression is fixed thrice).

**Giorgio's mandate (2026-04-23)**: property-showcase is the most tested and battle-proven. Use **property as the single source of truth**. Extract generics from it, migrate project + building onto those generics, delete the parallel copies.

---

## 2. Decision

Introduce a **showcase core** under `src/services/showcase-core/` + `src/components/showcase-core/` + `src/app/api/showcase-core/` that centralises every layer into **config-driven generics**. Property showcase is the reference baseline whose patterns are lifted into the generics. Project + building become **thin configs** (~20–30 LOC each) on top of the generics.

### 2.1 Design principles

1. **Baseline-first**: every generic is extracted FROM property-showcase behaviour. No new invention; the generic is the property code with extension hooks.
2. **Config-driven, not inheritance-driven**: generics accept a `ShowcaseModuleConfig<TEntity, TInfo>` object. No abstract classes with magic methods.
3. **Extension hooks, not branching**: property-specific layers (linked spaces, per-unit floorplans, systems/finishes/features) are wired via optional hooks in the config — the core never has `if (entityType === 'property')` branches.
4. **Zero behavioural regression**: every hash-comparable output (snapshot JSON, PDF byte count, email HTML) must be byte-identical before and after migration for the property surface. Project + building parity is validated via manual E2E.
5. **Rollback-safe**: feature flag `SHOWCASE_USE_CORE` per surface during migration. Either surface can fall back to legacy until parity is confirmed.

### 2.2 Layer-by-layer generic signatures

| Generic | Location | Replaces | Extension points |
|---------|----------|----------|------------------|
| `createShowcaseSnapshotBuilder<TEntity, TInfo>(config)` | `src/services/showcase-core/snapshot-builder-factory.ts` | 3 × `snapshot-builder.ts` | `loadRelations?` (property: storages/parking/floors); `buildInfo(raw, relations, locale)`; `tenantCheck: 'strict'` |
| `createShowcaseLabelsLoader<TLabels>(namespace)` | `src/services/showcase-core/labels-loader.ts` | 3 × `labels.ts` | Namespace key under `showcase.json` (`propertyShowcase` / `projectShowcase` / `buildingShowcase`); shared defaults for chrome/email/header |
| `createShowcaseShareResolver<TData>(config)` | `src/services/showcase-core/share-resolver-factory.ts` | 3 × `{entity}-showcase.resolver.ts` | `entityType`, `collection`, `buildResolvedData(share, doc)` |
| `createShowcaseEmailBuilder<TSnapshot, TLabels>(config)` | `src/services/showcase-core/email-builder-factory.ts` | 3 × `{entity}-showcase-email.ts` | `renderHero`, `renderSpecs`, `renderExtras?` (property uses extras for systems/finishes/features/views/linkedSpaces) |
| `ShowcasePDFService<TData>` + `BaseShowcaseRenderer` | `src/services/showcase-core/pdf-service.ts` + `pdf-renderer-base.ts` | 3 × `{Entity}ShowcasePDFService.ts` + `{Entity}ShowcaseRenderer.ts` | `renderSpecsRows` config; `renderExtraSections?` (property uses for 7 extra section types + linkedSpaces floorplans) |
| `createShowcasePdfRoute(config)` | `src/services/showcase-core/api/create-pdf-route.ts` | 3 × `POST /{collection}/[id]/showcase/pdf/route.ts` | `collection`, `permission`, `snapshotBuilder`, `pdfService`, `entityType` |
| `createShowcaseEmailRoute(config)` | `src/services/showcase-core/api/create-email-route.ts` | 3 × `POST /{collection}/[id]/showcase/email/route.ts` | Same as PDF + `emailBuilder` |
| `createPublicShowcasePayloadRoute(config)` | `src/services/showcase-core/api/create-public-payload-route.ts` | 3 × `GET /{entity}-showcase/[token]/route.ts` (and property's `/api/showcase/[token]`) | `entityType`, `snapshotBuilder`, `payloadShape` |
| `createPublicShowcasePdfRoute(config)` | `src/services/showcase-core/api/create-public-pdf-route.ts` | 3 × `GET /{entity}-showcase/[token]/pdf/route.ts` | Already 95 % shared via `shared-pdf-proxy-helpers.ts`; collapses the thin wrappers |
| `<ShowcaseClient<TPayload> />` | `src/components/showcase-core/ShowcaseClient.tsx` | 3 × `{Entity}ShowcaseClient.tsx` | `fetchEndpoint`, `renderSpecs`, `renderExtras?` |
| `<ShowcaseSpecsGrid<TInfo> />` | `src/components/showcase-core/ShowcaseSpecsGrid.tsx` | 2 × `{Entity}ShowcaseSpecs.tsx` + property's inline grid | Rows: `Array<{ labelKey, value, formatter? }>` |
| `<SharedShowcasePageContent />` | `src/components/shared/pages/SharedShowcasePageContent.tsx` | 3 × `Shared{Project,Building,}ShowcasePageContent.tsx` | `entityType` prop drives Client selection — wrappers delete |

### 2.3 Things that stay exactly where they are

Already-centralised helpers that are **not touched** by this ADR:

- `src/services/email-templates/showcase-email-shared.ts` (`renderKeyValueTable`, `renderSectionTitle`, `renderPhotoGrid`, `renderMediaList`, `renderShareCta`, `buildSharedTextFallback`).
- `src/services/pdf/renderers/PropertyShowcaseMediaGrid.ts`, `PropertyShowcaseBrandHeader.ts`, `TextRenderer.ts` (canonical PDF primitives — imported by all renderers).
- `src/app/api/showcase/shared-pdf-proxy-helpers.ts` (`streamPdfFromStorage`, `jsonError`).
- `src/components/property-showcase/ShowcaseHeader.tsx`, `ShowcaseShared.tsx` (already reused cross-showcase).
- `src/services/company/company-branding-resolver.ts` (`resolveShowcaseCompanyBranding` + `brandingSource` flag).
- `src/types/sharing.ts` (`ShareEntityType` union, `ShowcaseShareMeta`).
- Enum-label maps in `@/constants/{property-types,building-types,building-statuses,energy-classes,renovation-statuses,project-types,project-statuses}` and the `translate*` services.

After this ADR, these will be the primitives the core generics compose. They are already SSoT — this ADR only closes the orchestration gap above them.

---

## 3. Tenant isolation & security

The generic `createShowcaseSnapshotBuilder` enforces `raw.companyId === ctx.companyId` at the builder level (Google belt-and-suspenders pattern): `withAuth` at the route level is permission authorisation, the builder-level check is tenant-isolation defence-in-depth. This matches the project + building behaviour today and adds the same guarantee to property (which currently relies only on the route-level check).

`brandingSource: 'tenant'` is hard-wired in the generic (explicit, not configurable) because all three current surfaces want the developer brand, never the linked-client brand (see ADR-312 changelog 2026-04-23 for the project bug-fix that forced this).

Public routes (`/api/{entity}-showcase/[token]` + `/pdf`) remain anonymous + rate-limited through the existing `withStandardRateLimit` / `withHeavyRateLimit` middleware; the generic public-route factories only orchestrate the pattern — no new surface area.

---

## 4. Migration phases

| Phase | Scope | Files touched | Commit policy |
|-------|-------|---------------|---------------|
| **0** | Scaffolding: create empty `showcase-core/` trees + this ADR. | +1 (ADR), +~8 empty dir stubs | 1 commit, no behaviour change |
| **1** | Extract generics from property-showcase behaviour. Unit-level re-export: legacy `property-showcase/*` files re-export from core so existing imports keep working. No call-site change. | +~12 core files, 0 deletions | 1 commit per layer (snapshot / labels / resolver / email / pdf / routes / client); 7 commits total |
| **2** | Migrate **building-showcase** (simplest, most recent) onto core. Delete parallel building files. Manual E2E: PDF regen, email dispatch, public viewer. | ~15 files touched, ~9 legacy deletions | 1 commit |
| **3** | Migrate **project-showcase** onto core. Delete parallel project files. Manual E2E. | ~15 files touched, ~9 legacy deletions | 1 commit |
| **4** | Migrate **property-showcase** onto core. Property becomes the reference consumer with all extension hooks wired (linkedSpaces, floorplans, extras). Delete now-redundant property-specific orchestration (field builders stay — they ARE the extension hooks). Manual E2E. | ~20 files touched, ~6 legacy deletions | 1 commit |
| **5** | Cleanup: remove re-export shims, update ADR-312/315/320 cross-references, regen `docs/centralized-systems/reference/adr-index.md`, register `showcase-core` module in `.ssot-registry.json`, finalise this ADR. | ~10 files touched | 1 commit |

**Rollback**: if any E2E fails in Phase 2–4, revert the migration commit for that surface — generics stay in place, legacy path still works because Phase 1 is non-destructive.

---

## 5. Google-level architecture checklist (SOS N.7.2)

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive or reactive? | **Proactive** — generics are introduced before the 4th surface exists, not after N copies already drifted. |
| 2 | Race condition possible? | **No** — generics are pure functions + config; tenant check + share validation run on every request identically to today. |
| 3 | Idempotent? | **Yes** — migration is commit-by-commit + feature-flag-guarded; running it twice = same state. |
| 4 | Belt-and-suspenders? | **Yes** — tenant check is moved from route-only (property today) to both route + builder (all surfaces after migration). |
| 5 | Single Source of Truth? | **Yes** — one orchestration per layer, in `showcase-core/`. Configs are plain data. |
| 6 | Fire-and-forget or await? | **Await** — snapshot / PDF / email paths are all awaited as today; no semantic change. |
| 7 | Who owns the lifecycle? | **Explicit** — `showcase-core/` owns orchestration; `property-showcase/field-builders.ts` etc. own per-field mapping; configs wire them. |

**Declared**:

```
✅ Google-level: YES (target) — property-baseline lift + config-driven extension hooks = zero-branch generic orchestration, belt-and-suspenders tenant check, rollback-safe migration.
```

---

## 6. Non-goals

- **Not** unifying property-showcase field builders (`snapshot-field-builders.ts`) into generics — they are the property-specific extension; project/building do not have equivalents.
- **Not** touching the unified sharing subsystem (ADR-315) — this ADR only touches the resolvers *registered* in it.
- **Not** changing public URL shapes — `/shared/[token]` + the per-entity `/api/{entity}-showcase/[token]` paths stay as-is, just served by generic factories.
- **Not** introducing a shared `/api/showcase-core/[token]` public route — URL compatibility matters more than URL consolidation, and Phase 6 of ADR-320 already landed the 3 per-entity public routes.

---

## 7. Changelog

| Date       | Change |
|------------|--------|
| 2026-04-23 | Phase 0 — ADR drafted. Canonical SSoT = property-showcase. Generics signature locked. Migration roadmap (5 phases after scaffolding) defined. Next: Phase 1 scaffolding + layer-by-layer extraction. |
| 2026-04-23 | Phase 1.1 — 3 factories landed non-destructively: `snapshot-builder-factory.ts` (183 LOC, tenant-isolation check + optional relations + pluggable branding/wrapper), `share-resolver-factory.ts` (149 LOC, entityType-agnostic `ShareEntityDefinition` producer), `labels-shared.ts` (114 LOC, centralises the identical chrome/email/header fallbacks). Zero call-site change. |
| 2026-04-24 | Phase 1.2 — `email-builder-factory.ts` (234 LOC) landed non-destructively. Config-driven generic extracted from `email-templates/property-showcase-email.ts` + project/building counterparts. Orchestration order byte-identical to the property baseline (`intro → hero → photoGrid → specs → bodySections → cta`). `renderBodySections` hook makes property's 9 extra sections + floorplans expressible without factory branching; default behaviour matches project/building (single floorplans-as-media-list block). Uses `ShowcaseCompanyBranding` as the SSoT company shape across surfaces. No call-site change. |
| 2026-04-24 | Phase 1.3a — `pdf-service.ts` (73 LOC) landed non-destructively. Generic `ShowcasePDFService<TData>` replaces the 3 byte-identical legacy services (property/project/building). Encapsulates jsPDF dynamic import + `registerGreekFont` (ADR-267 Identity-H, prevents Greek gibberish) + `JSPDFAdapter` wrap. Default margins `{20,18,20,18}` match legacy. Takes a `ShowcaseRendererLike<TData>` renderer instance — zero coupling to specific renderer classes. |
| 2026-04-24 | Phase 1.3b — `pdf-renderer-base.ts` (415 LOC) landed non-destructively. Config-driven `BaseShowcaseRenderer<TData>` class lifted from project + building renderers (95 %-identical) and aligned with property-showcase chrome layer. Default page order: Cover → Specs → Extras (hook) → Description → Photos → Floorplans → Footer. `renderSpecsRows` slot takes the legacy 4-tuple shape `[l1,v1,l2,v2]` so the existing spec-row code in project/building transplants 1:1. `renderExtraSections?` slot lets property inject its 9 extra pages (project/commercial/systems/finishes/features/linkedSpaces/energy/views/propertyFloor) without modifying the base orchestration. Shared formatters (`safeShowcaseValue`, `formatShowcasePdfDate`, `formatShowcasePdfEuro`, `formatShowcasePdfArea`) exported so surface-specific spec builders reuse them. No call-site change. |
