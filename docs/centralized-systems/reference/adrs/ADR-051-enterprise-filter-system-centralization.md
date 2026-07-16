# ADR-051: Enterprise Filter System Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Filters & Search |
| **Canonical Location** | `@/components/core/AdvancedFilters/` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `@/components/core/AdvancedFilters/`
- **Hooks**: `useGenericFilters` + `applyFilters`
- **Result**: 7 files deleted, 16 consumers migrated

---

## Zero values: where a default filter state lives

**Rule: the zero value of a filter-state type lives beside the type.** Not in a hook, not in a
component — beside the `interface`. Same rule the codebase already follows for
`EMPTY_STATS: PropertyStats` in `project-status-types.ts`.

| Type | Defined in | Zero value |
|---|---|---|
| `PropertyFilterState` | `AdvancedFilters/types.ts` | `defaultPropertyFilters` — `AdvancedFilters/configs/propertyFiltersConfig.ts` |
| `PropertyListFilterState` | `AdvancedFilters/types.ts` | `defaultUnitFilters` — `AdvancedFilters/configs/propertyFiltersConfig.ts` |
| `FilterState` (property viewer) | `@/types/property-viewer.ts` | **`DEFAULT_FILTERS` — `@/types/property-viewer.ts`** (2026-07-17) |

⚠️ **These three are NOT interchangeable and must not be "unified"** — `PropertyFilterState` has no
`project`/`building`; `PropertyListFilterState` uses `type` where `FilterState` uses `propertyType`.
They share the `priceRange: { min: undefined, max: undefined }` line and nothing more. That shared
line is also why **no SSoT-registry pattern guards these**: no line lives *only* in one of them, so
any line-based ERE would fire on the legitimate siblings. The jscpd ratchet (CHECK 3.28, ADR-584) is
the gate for re-duplicated data literals.

⚠️ **`DEFAULT_FILTERS` must stay in `@/types/property-viewer.ts`.** The dependency arrow is
`types/property-viewer → AdvancedFilters/types` (`FilterState extends GenericFilterState`). Moving
`DEFAULT_FILTERS` into `AdvancedFilters/configs/` to sit next to its siblings would reverse that arrow
and create an import cycle.

### Changelog

- **2026-07-17** — `DEFAULT_FILTERS` (the empty `FilterState`) moved from `@/hooks/usePropertyViewer`
  to `@/types/property-viewer`, beside `FilterState`. It had been parked in a **hook**, which caused
  two defects: (1) a **circular import** — `usePropertyViewer` → `usePropertyEditor` →
  `usePropertyViewer` (for the constant); (2) a **byte-identical second copy**,
  `DEFAULT_PUBLIC_FILTERS` in `usePublicPropertyViewer`, since importing a constant out of a hook
  module was the more expensive option. Both consumers repointed, the copy deleted, **no back-compat
  re-export left behind** — two homes for one constant is what caused this. Sibling change:
  `DEFAULT_STATS` → `DEFAULT_PROPERTY_STATS` in `@/types/property`, beside `PropertyStats` (it had no
  external consumer). Locked by 85 characterization tests. Full detail: **ADR-584** changelog.
