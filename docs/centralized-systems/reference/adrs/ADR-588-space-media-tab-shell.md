# ADR-588: Space Media Tab Shell SSoT (`EntityMediaFilesTab`)

## Status
✅ **ACTIVE — 2026-07-08** — De-duplication of the copy-pasted Parking ↔ Storage detail tabs under `src/components/space-management/{ParkingPage/ParkingDetails,StoragesPage/StorageDetails}/tabs/`. Two moves: (1) the four **media** tab pairs (Photos / Videos / Documents / Floorplan) collapsed onto one generic shell + per-entity binding + per-tab config; (2) the **general** tab pair de-duplicated conservatively via shared primitives (labelled select, building-link labels, save-ref hook) **without** unifying the divergent form logic. jscpd (both folders + shared): **27 clones / 347 dup lines → 10 clones / 115 dup lines** (−17 clones, −232 lines). The remaining 10 are the `GeneralTab` imports + the entity-specific save flow (see *Out of scope*).

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
`ParkingGeneralTab` (475) ↔ `StorageGeneralTab` (459) genuinely diverge — different fields (`location` vs `floorId`/`price`/`millesimalShares`), different mutation gateways (`*ParkingWithPolicy` vs `*StorageWithPolicy`) and `RealtimeService` events. A single God-shell over two different schemas is **not** big-player practice (Revit/Figma keep per-type forms, share only primitives). After the primitive extraction **10 clones remain**: the import blocks and the entity-specific save flow (the inline 409 last-write-wins `_v` retry). The retry is the biggest single clone and has an existing SSoT — `hooks/useVersionedSave.ts` (SPEC-256A) — but adopting it rewrites the divergent create/edit save path and needs a render/behaviour verify, so it is left as a separate, opt-in follow-up rather than folded into this refactor.

---

## Consequences
- **+** jscpd across both `tabs/` folders + shared: **27 → 10 clones** (347 → 115 dup lines). Ratchet advances.
- **+** 4 media-tab pairs → 1 shell + config; general tab pair shares 3 new primitives without merging its divergent logic.
- **+** `useCompanyDisplayName` / `OptionSelectField` / `buildBuildingLinkLabels` / `useSaveHandlerRef` are reusable SSoTs (the save-ref hook already has 3 consumers; `FloorFloorplanInline` can adopt `useCompanyDisplayName` on next touch).
- **+** i18n coverage gaps (Documents / Floorplan sign-in) closed for both `parking` and `storage` namespaces (el + en); Documents `eslint-disable no-hardcoded-strings` removed (N.11).
- **~** Adding a new space entity (e.g. a future "Locker") = one media binding + reuse of the 4 configs; a new media kind = one config constant.
- **~** jscpd self-guard (N.18) on all new/changed files: **0 clones** — no sibling twins introduced.

---

## Changelog
- **2026-07-08** — Created. (1) Media-tab de-dup for Parking/Storage: `EntityMediaFilesTab` shell + `entity-media-binding` + `media-tab-configs` + `useCompanyDisplayName`; 4 i18n keys × 2 namespaces × 2 locales. (2) General-tab conservative de-dup: `OptionSelectField`, `buildBuildingLinkLabels`, `useSaveHandlerRef` (3 consumers). Divergent general save flow left for an opt-in `useVersionedSave` follow-up. Net jscpd: 27 → 10 clones.
