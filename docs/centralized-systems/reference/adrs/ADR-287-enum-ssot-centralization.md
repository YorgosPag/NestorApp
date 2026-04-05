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
