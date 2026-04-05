# ADR-287: Enum SSoT Centralization (Batch 9)

**Status**: 🚧 IN PROGRESS
**Date**: 2026-04-05
**Category**: Data & State
**Author**: Γιώργος Παγώνης + Claude

---

## Context

Μετά την ολοκλήρωση του ADR-145 (PropertyType SSoT) εντοπίστηκαν πολλαπλά enum unions που ακολουθούν το ίδιο anti-pattern: **inline union στο `types/`** + **duplicated array στο `config/report-builder/domain-definitions.ts`** (για να τροφοδοτήσει dropdown filters).

Κάθε τέτοιο duplicate φέρει drift risk: όταν προστεθεί ή αλλάξει value στο ένα σημείο, το άλλο ξεχνιέται → report-builder dropdown εμφανίζει παλιές επιλογές ή χάνει καινούριες.

### Εντοπισμένα duplicates (scope του ADR-287)

| Enum | Canonical source | Shadow duplicate |
|------|------------------|------------------|
| `CommercialStatus` | `src/types/property.ts` (7 values) | `domain-definitions.ts` (7 values) |
| `OperationalStatus` | `src/types/property.ts` (5 values) | `domain-definitions.ts` (5 values) |
| `EnergyClass` | `src/types/building/contracts.ts` (9 values) | `domain-definitions.ts` (9 values) |
| `BuildingType` | `src/types/building/contracts.ts` (6 values) | `domain-definitions.ts` (6 values) |

## Decision

Για κάθε enum εφαρμόζεται το pattern του ADR-145:

1. **Leaf module** στο `src/constants/<enum>.ts` (zero deps — ασφαλές παντού)
2. **Canonical array** `as const` → derive union type μέσω `(typeof X)[number]`
3. **Runtime type guard** `isX(value: unknown): value is X`
4. **Derived subsets** όπου έχει domain σημασία (π.χ. listed vs finalized)
5. **Re-export** από υπάρχοντα legacy paths (backward compat)
6. **Migrate consumers** να importάρουν από SSoT

### Architecture (per enum)

```
┌────────────────────────────────────────────────┐
│ src/constants/<enum>.ts  ← SSoT (LEAF, no deps)│
└────────────────────────────────────────────────┘
         ↑                            ↑
┌────────┴────────┐        ┌──────────┴──────────┐
│ types/          │        │ config/report-      │
│ property.ts     │        │ builder/domain-     │
│ (re-exports)    │        │ definitions.ts      │
└─────────────────┘        └─────────────────────┘
```

## Consequences

### Positive
- **Single point of change** per enum (array + i18n αντί 2 αρχείων)
- **Zero drift**: report-builder dropdown auto-sync με canonical type
- **Richer exports**: derived subsets + type guards διαθέσιμα σε όλους τους consumers
- **Zero circular deps** — leaf modules

### Negative
- **Import surface growth**: 4 νέα leaf modules στο `src/constants/`. Mitigation: consistent naming (`<enum>-statuses.ts`, `<enum>-types.ts`) + συνεπής export shape.

## Related ADRs

- **ADR-145** — PropertyType SSoT (αρχικό pattern reference)
- **ADR-197** — Sales Pages Implementation (canonical origin του `CommercialStatus`)
- **ADR-043** — Transform Constants Consolidation (ίδιο `typeof ARRAY[number]` derivation pattern)

## Changelog

- **2026-04-05 (Batch 9A)**: `CommercialStatus` centralization.
  - **Created**: `src/constants/commercial-statuses.ts` — `COMMERCIAL_STATUSES` (7), `CommercialStatus` union, `isCommercialStatus()` guard, derived subsets `LISTED_COMMERCIAL_STATUSES` (3) + `FINALIZED_COMMERCIAL_STATUSES` (2) + αντίστοιχα guards.
  - **Migrated**:
    - `src/types/property.ts` — inline union (7 values) → `export type { CommercialStatus } from '@/constants/commercial-statuses'`.
    - `src/config/report-builder/domain-definitions.ts` — local `COMMERCIAL_STATUSES` array αφαιρέθηκε · imported από SSoT. Το `enumValues` στο properties domain field ακολουθεί αυτόματα.
- **2026-04-05 (Batch 9B)**: `OperationalStatus` centralization.
  - **Created**: `src/constants/operational-statuses.ts` — `OPERATIONAL_STATUSES` (5), `OperationalStatus` union, `isOperationalStatus()` guard, derived subset `IN_PROGRESS_OPERATIONAL_STATUSES` (3) + `isInProgressOperationalStatus()` guard.
  - **Migrated**:
    - `src/types/property.ts` — inline union (5 values) → `export type { OperationalStatus } from '@/constants/operational-statuses'`.
    - `src/config/report-builder/domain-definitions.ts` — local `OPERATIONAL_STATUSES` array αφαιρέθηκε · imported από SSoT.
- **2026-04-05 (Batch 9C)**: `EnergyClass` centralization (EU Directive 2010/31/EU).
  - **Created**: `src/constants/energy-classes.ts` — `ENERGY_CLASSES` (9, ordered best→worst), `EnergyClass` union, `isEnergyClass()` guard, `getEnergyClassRank()` helper, derived subset `HIGH_EFFICIENCY_ENERGY_CLASSES` (4) + `isHighEfficiencyEnergyClass()` guard.
  - **Migrated**:
    - `src/types/building/contracts.ts` — inline union (9 values) → `export type { EnergyClass } from '@/constants/energy-classes'`.
    - `src/config/report-builder/domain-definitions.ts` — local `ENERGY_CLASSES` array αφαιρέθηκε · imported από SSoT.
- **2026-04-05 (Batch 9D)**: `BuildingType` centralization.
  - **Created**: `src/constants/building-types.ts` — `BUILDING_TYPES` (6), `BuildingType` union, `isBuildingType()` guard, derived subset `NON_RESIDENTIAL_BUILDING_TYPES` (4) + `isNonResidentialBuildingType()` guard.
  - **Migrated**:
    - `src/types/building/contracts.ts` — inline union (6 values) → `export type { BuildingType } from '@/constants/building-types'`.
    - `src/config/report-builder/domain-definitions.ts` — local `BUILDING_TYPES` array αφαιρέθηκε · imported από SSoT.
- **2026-04-05 (Batch 9E)**: `BuildingPriority` + `RenovationStatus` centralization.
  - **Shared SSoT**: `src/constants/priority-levels.ts` — `PRIORITY_LEVELS` (4: low/medium/high/critical), `PriorityLevel` union, `isPriorityLevel()` guard, `getPriorityRank()` helper. Το priority scale είναι **shared** across Building + Project domains (identical 4 values).
  - **Renovation SSoT**: `src/constants/renovation-statuses.ts` — `RENOVATION_STATUSES` (4), `RenovationStatus` union, `isRenovationStatus()` guard, derived subset `COMPLETED_RENOVATION_STATUSES` (2) + `isCompletedRenovationStatus()` guard.
  - **Migrated**:
    - `src/types/building/contracts.ts` — inline `BuildingPriority` (4 values) → `export type BuildingPriority = PriorityLevel`. Inline `RenovationStatus` (4 values) → `export type { RenovationStatus } from '@/constants/renovation-statuses'`.
    - `src/config/report-builder/domain-definitions.ts` — local `PROJECT_PRIORITIES` literal array → `const PROJECT_PRIORITIES = PRIORITY_LEVELS` (semantic alias πάνω στο shared SSoT).
- **2026-04-05 (Batch 9F-1)**: `ProjectStatus` centralization.
  - **Created**: `src/constants/project-statuses.ts` — `PROJECT_STATUSES` (6, incl. `deleted`), `ProjectStatus` union, `isProjectStatus()` guard, derived subsets `ACTIVE_PROJECT_STATUSES` (5, non-deleted) + `IN_PROGRESS_PROJECT_STATUSES` (3) + αντίστοιχα guards.
  - **Migrated**:
    - `src/types/project.ts` — inline union (6 values) → `export type { ProjectStatus } from '@/constants/project-statuses'`.
    - `src/config/report-builder/domain-definitions.ts` — local 5-value array → `const PROJECT_STATUSES = ACTIVE_PROJECT_STATUSES` (subset import excluding `deleted` για να διατηρηθεί η prior filter-dropdown συμπεριφορά).
