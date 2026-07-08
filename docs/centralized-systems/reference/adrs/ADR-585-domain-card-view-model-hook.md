# ADR-585: Domain Card View-Model Hook SSoT (`useXxxCardModel` + `DomainCard`)

## Status
✅ **ACTIVE — 2026-07-08** — De-duplication of the `src/domain/cards/<entity>/` Grid/List cards. **All 11 entities migrated** (jscpd baseline **4548 → 4489**, −59 clones): pilot (Contact, Building, Project) −15, then the remaining 8 (parking, storage, property, po, quote, agreement, vendor, material) −45.

**Related:**
- **ADR-013** (Enterprise Card System, atomic design) — `GridCard` / `ListCard` design-system shells this decision sits on top of. Unchanged.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28) — the token-based detector that surfaced these twins and gates against re-introducing them.
- **ADR-233** (`buildCardSubtitle`) — prior small card-level SSoT helper; same `src/domain/cards/shared/` home.
- **ADR-332 Phase 10** — Contact address-enrichment mini-badges (the List-only concern preserved as `children`).

---

## Context

Each domain entity exposed two card components — `XxxGridCard.tsx` and `XxxListCard.tsx` under `src/domain/cards/<entity>/`. They differed **only** in which design-system shell they rendered into (`<GridCard>` vs `<ListCard>`) plus occasional view-specific extras, yet **each duplicated the entire view-model computation block** (the `useMemo`s for `stats` / `badges` / `subtitle` / `title` / `icon` / `ariaLabel`).

jscpd (ADR-584) measured the twins directly:

| Entity | Grid | List | Cloned lines |
|---|---|---|---|
| Contact | `ContactGridCard.tsx:105-187` | `ContactListCard.tsx:106-191` | 83 |
| Building | `BuildingGridCard.tsx:102-169` | `BuildingListCard.tsx:106-173` | 68 |
| Project | `ProjectGridCard.tsx:104-163` | `ProjectListCard.tsx:103-162` | 60 |

On top of the per-entity computation twins, the **wrapper boilerplate itself** (the identical props interface + the identical interaction-prop plumbing forwarded to the shell) was cloned across all ~22 wrapper files.

Big-player practice for "same content, two layouts" is a **headless view-model / presenter** feeding thin layout adapters (React ecosystem: model hook + presentational shell; Figma/Revit-grade component systems separate the computed model from the chrome). A shared JSX *component* does **not** fit here because the difference **is** the shell — so the SSoT is a **hook** returning the model, plus **one** generic shell that binds a model to the chosen shell.

---

## Decision

Three-part SSoT under `src/domain/cards/`:

### 1. `shared/card-model.types.ts`
- **`CardViewModel`** — the view-agnostic props an entity contributes to both shells: `entityType?` / `customIcon?` / `customIconColor?` / `title` / `subtitle?` / `badges` / `stats` / `ariaLabel`. Badges typed as `GridCardBadge[]` because `GridCardBadgeVariant ⊂ ListCardBadgeVariant` (ListCard additionally allows `'muted'`), so the model is assignable to **both** shells.
- **`DomainCardInteraction`** — the shared selection/interaction props (`isSelected?` / `isFavorite?` / `onSelect?` / `onToggleFavorite?` / `compact?` / `className?`). Each `XxxGridCardProps` / `XxxListCardProps` now only declares its single entity field: `interface ContactGridCardProps extends DomainCardInteraction { contact: Contact }`.

### 2. `shared/DomainCard.tsx`
One shell component — `<DomainCard variant="grid"|"list" model={…} {…interaction}>{children?}</DomainCard>` — that destructures the model, builds the shared shell-prop set **once**, and renders it into `<GridCard>` or `<ListCard>`. This is where the interaction plumbing + shell render live, instead of being copy-pasted per wrapper. `children` carries List-only enrichment (e.g. Contact address badges).

### 3. `<entity>/useXxxCardModel.ts`
A per-entity hook computing that entity's `CardViewModel` (title, badges, stats, icon, aria, and subtitle **when identical across views**). Consumed by both the Grid and List wrapper of that entity. The hooks are **not** clones of one another — each holds entity-specific logic.

### Thin typed adapters
`XxxGridCard` / `XxxListCard` shrink to: compute the model via the hook, delegate to `<DomainCard>`. Because each adapter now carries entity-specific tokens (`contact`, `useContactCardModel`, …), the previously-cloned wrapper boilerplate falls below jscpd's 50-token threshold.

### Per-view exceptions (preserved, not flattened)
- **Project subtitle differs per view** (Grid = `city - address`; List = company-first) → NOT in the hook; each wrapper computes it locally and passes `model={{ ...model, subtitle }}`.
- **Contact List** renders address-enrichment children (ADR-332 Phase 10).
- **Building List** keeps its custom `React.memo` comparator for list-scroll perf.

### Three real shapes (the family is NOT all clean twins)

Auditing all 11 entities showed three distinct shapes; one shell does not fit all, so the SSoT is applied per shape:

1. **Clean twins** (`contact`, `building`, `project`) — Grid & List differ only by shell → `useXxxCardModel` + **`shared/DomainCard`** (`variant='grid'|'list'`, plain single-click).
2. **Spatial spot cards** (`parking`, `storage`, `property`) — Grid supports **shift-click multi-select** + keyboard (property List adds hover-sync). The identical `handleClick`/`handleKeyDown` (the parking↔storage cross-clone) + the floor/area/price stat rows are centralized in **`shared/SpotCard`** + **`shared/spot-card-stats.ts`**. Model hooks are `view`-aware to preserve pre-existing per-view differences (parking's `general.statuses.*` vs `status.*` i18n keys; storage's stat ordering; property's divergent stat/badge sets). Grid → `SpotCard`; parking/storage List (plain) → `DomainCard`; property List → `SpotCard` (+hover).
3. **Presentation-divergent** (`po`, `quote`, `agreement`, `vendor`, `material`) — Grid renders `StatItems`, List renders a single-line joined `subtitle` + `inlineBadges`. They do **not** share a shell; only the derived data (supplier/vendor name, status label + badge variant, `formatQuoteDate`, the duplicated `STATUS_BADGE_VARIANTS` maps) is centralized in a `useXxxCardCommon` hook + co-located shared module. Each wrapper keeps its own stats-vs-subtitle assembly. `material` had no ≥50-token clone and was left as-is.

---

## Consequences

- ✅ **−59 jscpd clones** total (baseline `4548 → 4489`), locked via `npm run jscpd:baseline`. Pilot −15, remaining 8 −45.
- ✅ A label/badge/stat/status-map change for an entity now happens **once** in its model hook / shared module, reflected in both views.
- ✅ New card = model hook + thin adapter over the matching shell. Same-commit sibling clones are blocked by CHECK 3.28 (verified: `jscpd:diff` clean across all 27 touched files).
- ✅ Behavior preserved surgically — per-view i18n-key/stat-order/badge-map inconsistencies were kept, not "fixed", via `view`-aware hooks.
- ⚠️ Visual (render) verification pending on the running app; jscpd + API-compat verified.

---

## Files

**Shared:** `shared/card-model.types.ts` (`CardViewModel`, `DomainCardInteraction`, `SpotCardInteraction`), `shared/DomainCard.tsx`, `shared/SpotCard.tsx`, `shared/spot-card-stats.ts`.
**Model hooks / shared logic:** `{contact,building,project}/useXxxCardModel.ts`; `{parking,storage}/useXxxCardModel.ts` + `parking/parking-types.ts`; `property/usePropertyCardModel.ts` + `property/property-card-shared.ts`; `{po,quote,agreement,vendor}/xxx-card-model.ts`.
**Rewritten (thin adapters):** all `{Xxx}{Grid,List}Card.tsx` for the 10 migrated entities. `material` unchanged (no clone).

---

## Changelog
- **2026-07-08** — Created. Pilot: Contact / Building / Project migrated to `useXxxCardModel` + `DomainCard`. jscpd 4548 → 4533 (−15).
- **2026-07-08** — Extended to the remaining 8. Added `SpotCard` (spatial shift-click shell) + `spot-card-stats` for parking/storage/property, and `useXxxCardCommon` hooks for the presentation-divergent procurement cards (po/quote/agreement/vendor). jscpd 4533 → 4489 (−45). All 27 touched files pass `jscpd:diff`.
