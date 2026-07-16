# ADR-588: Space Media Tab Shell SSoT (`EntityMediaFilesTab`)

## Status
✅ **ACTIVE — 2026-07-16 (Phase 2)** — De-duplication of the copy-pasted Parking ↔ Storage detail tabs under `src/components/space-management/{ParkingPage/ParkingDetails,StoragesPage/StorageDetails}/tabs/`.

- **Phase 1 (2026-07-08)** — (1) the four **media** tab pairs (Photos / Videos / Documents / Floorplan) collapsed onto one generic shell + per-entity binding + per-tab config; (2) the **general** tab pair de-duplicated conservatively via shared primitives (labelled select, building-link labels, save-ref hook) **without** unifying the divergent form logic. jscpd: **27 clones / 347 dup lines → 10 clones / 115 dup lines**.
- **Phase 2 (2026-07-16)** — the general-tab follow-up Phase 1 deferred: the two tabs adopt the **`useVersionedSave` SSoT** (SPEC-256A) instead of hand-rolling the 409 retry, and the remaining shared logic moves into `space-info` primitives + hooks. The **God-shell is still refused** — the two forms stay separate, only primitives are shared. jscpd on the pair: **10 clones / 115 dup lines → 0 clones / 0 dup lines** (verified). Repo-wide: **3149 → 3107 clones**.

**Related:**
- **ADR-031** (Canonical File Storage System) — `EntityFilesManager`, the centralized files engine every media tab already wrapped. Behaviour unchanged.
- **ADR-585** (Domain Card View-Model Hook) — same shell+binding archetype for the spatial cards (`domain/cards`); sibling de-dup in the same 2026-07-08 sweep.
- **ADR-586** (Meta Webhook Shared Core) — same sweep, communications bucket (core + thin adapters).
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28) — the token-based detector that surfaced these twins and gates re-introduction.
- **ADR-187** (Floor-level floorplans) — the floorplan tab this refactor preserves.

---

## Context

Parking spots and Storage units are the same spatial archetype and each carried **four near-identical media tabs**, each a thin wrapper over the centralized `EntityFilesManager` (ADR-031). jscpd (min-tokens 50) measured **27 exact clones / 347 duplicated lines (20.52%)** between the two `tabs/` folders.

The duplicated bodies were, verbatim across the Parking/Storage twins:
- `useAuth` + `useCompanyId` resolution and the `!companyId || !currentUserId` sign-in guard.
- The `<section className="p-2"><EntityFilesManager …/></section>` render.
- **Floorplan additionally** carried a byte-identical `companyDisplayName` fetch block (`useState` + `useEffect` + `getCompanyById`, "prefer companyName → tradeName → id") — a **third** copy of a pattern also living in `FloorFloorplanInline`.

Only a handful of axes genuinely differ per entity/tab: entity type, label field (`number` vs `name`), `projectId`, i18n namespace, `purpose`, file `category`/`domain`, `displayStyle`, accepted types, and the entry-point filters.

A **real SSoT audit (grep)** confirmed the files engine (`EntityFilesManager`) was already the SSoT — the duplication was **wrapper boilerplate only**. Storage's `storage-general-tab-config.ts` already signalled the config-extraction direction.

Big-player practice (Figma / Revit component registries) is exactly **one presentational shell + per-instance config/binding** — so the fix generalises that, not a new files engine.

---

## Decision

New shared module **`src/components/space-management/shared/tabs/`**:

| File | Owns |
|---|---|
| `EntityMediaFilesTab.tsx` | Generic presentational shell. Wires auth/company context + sign-in guard, then renders `EntityFilesManager`. Composes `purpose` as `` `${binding.purposePrefix}-${media.purposeKey}` `` (→ `parking-photo`, `storage-floorplan` = `FLOORPLAN_PURPOSES.STORAGE`, etc.). |
| `entity-media-binding.ts` | Per-entity binding: `parkingMediaBinding(parking)` / `storageMediaBinding(storage)` → `{ entityType, entityId, entityLabel, projectId, i18nNamespace, purposePrefix }`. |
| `media-tab-configs.ts` | Per-tab config literals: `PHOTOS_MEDIA_CONFIG`, `VIDEOS_MEDIA_CONFIG`, `DOCUMENTS_MEDIA_CONFIG`, `FLOORPLAN_MEDIA_CONFIG` (domain/category/purposeKey/displayStyle/accept/entry-point/signInKey/needsCompanyName). Config-only data file. |

Plus **`src/hooks/useCompanyDisplayName.ts`** — SSoT for the "fetch company → display name" pattern (eliminates the Floorplan third copy; available for the `FloorFloorplanInline` copy to adopt on next touch — Boy-Scout, N.0.2).

### General tab — shared primitives (conservative, no God-shell)
The `GeneralTab` pair genuinely diverges (fields, mutation gateways, realtime events — see *Out of scope*), so instead of one shell they now **share small entity-agnostic primitives**, exactly as a big-player form library does (Revit/Figma reuse field primitives, not whole forms):

| SSoT | Replaces (identical clone) |
|---|---|
| `components/shared/space-info/OptionSelectField.tsx` | The type + status `<Select>` blocks (4 identical blocks across the pair). Generic `<T extends string>` labelled select over a `{ value, labelKey }[]` list. |
| `components/shared/space-info/building-link-labels.ts` | `buildBuildingLinkLabels(t)` — the byte-identical 10-key `entityLinks.building.*` label block passed to `useEntityLink` (ADR-200). |
| `hooks/useSaveHandlerRef.ts` | The identical `onSaveRef.current = handleSave` registration effect. **3 consumers** migrated (Parking + Storage + `building-management/tabs/GeneralTabContent`, Boy-Scout N.0.2). |

### Thin per-tab wrappers (contract preserved)
The eight tab files (`ParkingPhotosTab`, `StoragePhotosTab`, …) keep their **exported name, prop shape and mapping-key contract** (`PARKING_COMPONENT_MAPPING` / `STORAGE_COMPONENT_MAPPING` / `mappings/index.ts` and `unified-tabs-factory` string keys are untouched). Each body becomes one line:
```tsx
<EntityMediaFilesTab binding={parkingMediaBinding(parking)} media={PHOTOS_MEDIA_CONFIG} />
```
The differing tokens (parking↔storage, config const) keep the thin wrappers **below the 50-token clone threshold** — empirically verified: `jscpd` on any two thin wrappers = **0 clones**.

### Google-level normalisations (not just de-dup)
- **Floorplan** previously rendered **blank** (`return null`) when unauthenticated → now shows the same sign-in message as the other tabs (strictly better UX; new keys `auth.signInToViewFloorplans`).
- **Documents** previously used **hardcoded Greek** strings (with `eslint-disable custom/no-hardcoded-strings`) → now i18n (`auth.signInToViewDocuments`). The `eslint-disable` headers are gone (N.11).
- Sign-in `<p>` padding was inconsistent (`p-4` vs `p-2`) → unified to `p-4 text-center`.
- Floorplan accepted-types unified to the **superset** (parking's, incl. `application/dxf, image/vnd.dxf`) — harmless widening, both tabs are DXF-intended.

### Out of scope (deliberate)
`ParkingGeneralTab` ↔ `StorageGeneralTab` genuinely diverge — different fields (`location` vs `floorId`/`price`/`millesimalShares`), different mutation gateways (`*ParkingWithPolicy` vs `*StorageWithPolicy`) and `RealtimeService` events. A single God-shell over two different schemas is **not** big-player practice (Revit/Figma keep per-type forms, share only primitives). **This constraint still holds after Phase 2** — the two tabs remain separate components with separate schemas; only entity-agnostic primitives are shared.

Phase 1 additionally deferred the `useVersionedSave` adoption ("adopting it rewrites the divergent create/edit save path and needs a render/behaviour verify"). **Phase 2 closes that item** — see below.

---

## Decision — Phase 2 (general tab)

A real SSoT audit (grep) found the biggest remaining clone was **not** new duplication to extract but an **existing SSoT the two tabs never adopted**: `hooks/useVersionedSave.ts` (SPEC-256A), already used by `building-management/tabs/GeneralTabContent` and `projects/general-tab/GeneralProjectTab`. Both space tabs hand-rolled the same `versionRef` + `try/catch 409` + retry-without-`_v` block instead.

| SSoT | Owns | Replaces |
|---|---|---|
| `hooks/useVersionedSave` *(adopted, pre-existing)* | `_v` injection, forward-only version tracking, silent last-write-wins retry on 409 | The hand-rolled `versionRef` + inline 409 retry in **both** tabs |
| `hooks/useSpaceGeneralSave` | Create-or-update dispatch + error→`false` + save-ref registration (wraps `useSaveHandlerRef`) | The identical `handleSave` try/catch in both tabs |
| `hooks/useSpaceNameSuggestion` | ADR-233 createMode auto-naming: seed-on-mount, `nameManuallyChanged` tracking, re-derive on type/area | The 3 hand-rolled handlers + seed effect in both tabs |
| `space-info/space-payload-builder` | The POST/PATCH payload rules: trim, diff-vs-current, cleared→`null` vs omit, `buildSpaceRealtimeUpdates` | The two hand-rolled payload blocks (the subtle rules had already drifted) |
| `space-info/SpaceCoreFields` | The three fields every space has — type + status + area — and their label keys | 3 duplicated field blocks per tab |
| `space-info/SpaceFloorCard` | The `FloorSelectField` card shell (byte-identical in both) | The floor card in both tabs |
| `space-info/LabeledInputField` | The labelled text/number input — sibling of `OptionSelectField` | name / area / price fields |
| `space-info/space-general-tab-contracts` | `SpaceGeneralTabProps` — the isEditing/onSaveRef/createMode contract | The identical props block in both configs |
| `space-info/DescriptionNotesCard` *(API tightened)* | Now takes `form` + `onChange` + `t` and resolves its own labels | The identical 6-prop wiring block in both tabs |

**Canonical form field.** Parking's form state renamed `number` → **`name`** so both forms expose the same suggestible shape; the mapping back to the spot's `number` happens where the payload is built. Internal only — the component's public props are unchanged.

**Per-entity config symmetry.** `parking-general-tab-config.ts` now mirrors `storage-general-tab-config.ts` (props, form state, option lists, defaults, `buildFormState`) — the direction Phase 1 noted Storage had already signalled.

### Google-level normalisations (Phase 2)
- **`_v` is now declared** on `ParkingSpot` and `Storage` (`_v?: number`, lazy per SPEC-256A) — both tabs previously reached it via an `as unknown as { _v?: number }` double-cast. The API routes already return it.
- **Parking's type label key drifted**: the createMode seed used a dynamic `` t(`types.${v}`) `` while its option list used `general.types.*` — two parallel i18n blocks. Now both resolve through the option list's `labelKey` (verified: all 24 type/status keys resolve in el + en).
- **Arbitrary Tailwind colour removed**: both tabs hardcoded `text-[hsl(var(--text-success))]`; `SpaceFloorCard` uses `colors.text.success` (ADR-365 SSoT). Parking's `eslint-disable design-system/enforce-semantic-colors` header is gone.
- **Telemetry improved**: the save failure now logs under each tab's own module logger rather than a duplicated per-entity message string.

---

## Consequences
- **+** *(Phase 2)* The general tab pair is at **0 clones / 0 duplicated lines**. `ParkingGeneralTab` 429 → 299 lines, `StorageGeneralTab` 413 → 350.
- **+** *(Phase 2)* The 409 last-write-wins retry now has **one** implementation for all four entity general tabs (parking, storage, building, project) — a divergence here was a correctness risk, not just duplication.
- **~** *(Phase 2)* The two tabs have **no automated tests** — none existed before either. Verification was jscpd + ESLint + i18n key resolution + line-by-line behaviour diff against the originals. A render/behaviour smoke test of both tabs (create + edit + 409 path) is the honest next step.
- **+** jscpd across both `tabs/` folders + shared: **27 → 10 clones** (347 → 115 dup lines). Ratchet advances.
- **+** 4 media-tab pairs → 1 shell + config; general tab pair shares 3 new primitives without merging its divergent logic.
- **+** `useCompanyDisplayName` / `OptionSelectField` / `buildBuildingLinkLabels` / `useSaveHandlerRef` are reusable SSoTs (the save-ref hook already has 3 consumers; `FloorFloorplanInline` can adopt `useCompanyDisplayName` on next touch).
- **+** i18n coverage gaps (Documents / Floorplan sign-in) closed for both `parking` and `storage` namespaces (el + en); Documents `eslint-disable no-hardcoded-strings` removed (N.11).
- **~** Adding a new space entity (e.g. a future "Locker") = one media binding + reuse of the 4 configs; a new media kind = one config constant.
- **~** jscpd self-guard (N.18) on all new/changed files: **0 clones** — no sibling twins introduced.

---

## Changelog
- **2026-07-16 (Phase 2)** — General-tab follow-up closed. Both tabs adopt the pre-existing `useVersionedSave` SSoT (the hand-rolled 409 retry is gone); new SSoTs `useSpaceGeneralSave`, `useSpaceNameSuggestion`, `space-payload-builder`, `SpaceCoreFields`, `SpaceFloorCard`, `LabeledInputField`, `space-general-tab-contracts`; `DescriptionNotesCard` API tightened to `form`/`onChange`/`t`; `parking-general-tab-config.ts` added to mirror Storage. Parking form field `number` → canonical `name` (internal; public props unchanged). `_v?: number` declared on `ParkingSpot` + `Storage` (removes an `as unknown as` double-cast in both). Parking's dynamic `types.*` label key aligned to the option list's `general.types.*`. jscpd on the pair: **10 clones / 115 dup lines → 0 / 0**; repo-wide **3149 → 3107**. N.18 self-check on all 15 touched files: 0 new clones. ESLint clean. No new i18n keys (all 27 + 24 option keys verified in el + en).
- **2026-07-08** — Created. (1) Media-tab de-dup for Parking/Storage: `EntityMediaFilesTab` shell + `entity-media-binding` + `media-tab-configs` + `useCompanyDisplayName`; 4 i18n keys × 2 namespaces × 2 locales. (2) General-tab conservative de-dup: `OptionSelectField`, `buildBuildingLinkLabels`, `useSaveHandlerRef` (3 consumers). Divergent general save flow left for an opt-in `useVersionedSave` follow-up. Net jscpd: 27 → 10 clones.
