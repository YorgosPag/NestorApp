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
- **2026-04-05 (Batch 9F-2)**: `ProjectType` centralization.
  - **Created**: `src/constants/project-types.ts` — `PROJECT_TYPES` (6), `ProjectType` union, `isProjectType()` guard. Σημείωση: παρά την επικάλυψη 4 τιμών με `BuildingType`, διατηρείται ξεχωριστό domain (project-wide classification vs individual building).
  - **Migrated**:
    - `src/types/project.ts` — inline union (6 values) → `export type { ProjectType } from '@/constants/project-types'`.
    - `src/config/report-builder/domain-definitions.ts` — local `PROJECT_TYPES` array αφαιρέθηκε · imported από SSoT.
- **2026-04-05 (Batch 9F-3)**: `BuildingStatus` centralization.
  - **Created**: `src/constants/building-statuses.ts` — `BUILDING_STATUSES` (5, incl. `deleted`), `BuildingStatus` union, `isBuildingStatus()` guard, derived subsets `ACTIVE_BUILDING_STATUSES` (4, non-deleted) + `IN_CONSTRUCTION_BUILDING_STATUSES` (2) + αντίστοιχα guards.
  - **Migrated**:
    - `src/types/building/contracts.ts` — inline union (5 values) στο `Building.status` → `BuildingStatus` (import + re-export από SSoT).
    - `src/config/report-builder/domain-definitions.ts` — local 4-value array → `const BUILDING_STATUSES = ACTIVE_BUILDING_STATUSES` (subset import excluding `deleted`).
- **2026-04-05 (Batch 9F-4)**: `LegalWorkflowPhase` (6 values) centralization — ❌ **ΑΝΑΘΕΩΡΗΘΗΚΕ** στο 9F-5 γιατί οι 6 τιμές ήταν **λανθασμένες**: δεν ταίριαζαν ποτέ με τις πραγματικές τιμές του `property.commercial.legalPhase` field (που αποθηκεύει canonical 7-value `LegalPhase` από ADR-230). Το filter dropdown ήταν ουσιαστικά broken.
- **2026-04-05 (Batch 9F-5)**: `LegalPhase` canonical centralization + i18n correction (διόρθωση του 9F-4).
  - **Replaced**: `src/constants/legal-phases.ts` — τώρα περιέχει το **canonical** 7-value enum από ADR-230 (`none` → `payoff_completed`), με `getLegalPhaseRank()` helper + derived subsets `PENDING_LEGAL_PHASES` (3) + `SIGNED_LEGAL_PHASES` (3) + αντίστοιχα guards.
  - **Migrated**:
    - `src/types/legal-contracts.ts` — inline 7-value union → import + re-export από SSoT.
    - `src/config/report-builder/domain-definitions.ts` — τώρα χρησιμοποιεί το canonical `LEGAL_PHASES` (7), fixing the broken filter.
    - `src/config/report-builder/domain-defs-buyers.ts` — same fix.
    - `src/i18n/locales/{el,en,pseudo}/report-builder-domains.json` — i18n keys ενημερώθηκαν από τις 6 λανθασμένες (`initial`/`deedPrep`/...) στις 7 canonical (`none`/`preliminary_pending`/...). Τα ίδια labels χρησιμοποιούνταν ήδη στο `reports.json`.
    - `src/types/i18n.ts` — regenerated.
  - **Bonus fix**: Προστέθηκαν τα λείπον local `import type { X }` statements στα `src/types/building/contracts.ts` και `src/types/project.ts` για τα SSoT types των 9C/9D/9E/9F-1/9F-2 (`BuildingType`, `BuildingStatus`, `EnergyClass`, `RenovationStatus`, `ProjectStatus`, `ProjectType`) — `export type { X } from '...'` δεν δημιουργούσε local binding, με αποτέλεσμα pre-existing TS2304 errors στα `Building` + `Project` interfaces.
- **2026-04-05 (Batch 10A)**: `CommercialStatus` Greek↔English alias normalization (extension του 9A SSoT, αγγίζει AI pipeline).
  - **Extended**: `src/constants/commercial-statuses.ts` — `COMMERCIAL_STATUS_ALIASES` map (canonical self-mapping + legacy English `available`/`off-market` + Greek variants με/χωρίς τόνους σε όλες τις verbal forms: `πωλημένο`/`πουλημένο`/`πωλήθηκε`, `κρατημένο`/`προκρατημένο`, `ενοικιασμένο`/`ενοικιάστηκε`, `προς πώληση`/`διαθέσιμο`/`αδιάθετο`, `προς ενοικίαση`, `πώληση & ενοικίαση`, `μη διαθέσιμο`), `normalizeCommercialStatus(raw: unknown): CommercialStatus | null` resolver (case-insensitive, whitespace-trimmed, null για unknown inputs).
  - **Migrated**:
    - `src/services/ai-pipeline/modules/uc-013-admin-property-stats/admin-property-stats-module.ts` — hardcoded if/else chain (`status === 'sold' || status === 'πωλημένο'` κλπ.) αντικαταστάθηκε με `normalizeCommercialStatus()` + `isListedCommercialStatus()` για bucket assignment. Τα buckets `sold`/`available`/`reserved`/`other` διατηρούν identical semantics (sold→sold, LISTED_COMMERCIAL_STATUSES→available, reserved→reserved, rented/unavailable/null→other).
  - **Purpose**: Εξάλειψη scattered bilingual matching logic. Μελλοντικά consumers (UC-003 property search, στατιστικά reports) θα χρησιμοποιούν τον κεντρικό resolver.
- **2026-04-05 (Batch 10B)**: `ContactType` centralization με Greek alias normalization (server-safe leaf SSoT).
  - **Created**: `src/constants/contact-types.ts` — `CONTACT_TYPES` (3: individual/company/service), `ContactType` union, `isContactType()` guard, `CONTACT_TYPE_ALIASES` map (canonical + Greek: `ιδιώτης`/`φυσικό πρόσωπο`/`άτομο`, `εταιρεία`/`εταιρία`/`νομικό πρόσωπο`/`οργανισμός`, `υπηρεσία`/`δημόσιος φορέας`/`δημόσιο`/`φορέας` + plurals), `normalizeContactType()` resolver, `isCompanyContactType()` convenience predicate για binary buckets.
  - **Γιατί ξεχωριστό module από `src/constants/contacts.ts`**: Το υπάρχον `contacts.ts` είναι UI-heavy (imports `lucide-react`, `brandClasses`, `useSemanticColors`) — δεν μπορεί να τρέξει σε `'server-only'` code (AI pipeline, API routes). Το παρόν leaf είναι pure-data, zero-deps, server-safe.
  - **Migrated**:
    - `src/services/ai-pipeline/modules/uc-013-admin-property-stats/admin-property-stats-module.ts` — hardcoded if/else (`type === 'company' || type === 'εταιρεία' || type === 'εταιρία'`) αντικαταστάθηκε με `isCompanyContactType()`. Το bucketing διατηρεί identical semantics: companies vs (individual/service/unknown)→individuals.
  - **Backlog**: Το `src/constants/contacts.ts` (UI) + `src/types/contacts/contracts.ts` (inline union) **δεν μεταφέρθηκαν** — out of scope για batch 10B (πολύ μεγάλη διάχυση consumers). Θα γίνει σε μελλοντικό batch αν χρειαστεί.
- **2026-04-05 (Batch 11A)**: `PropertyType` alias normalization (extension του ADR-145 SSoT, αγγίζει AI pipeline UC-003).
  - **Extended**: `src/constants/property-types.ts` — `PROPERTY_TYPE_ALIASES` map (~40 aliases: canonical self-mapping + deprecated underscore collapse `apartment_2br`/`apartment_3br`→`apartment` + legacy English `store`→`shop` + Greek variants με/χωρίς τόνους: `διαμέρισμα`/`διαμέρισμα 2δ`/`3δ`/`2δ`/`3δ`→`apartment`, `γκαρσονιέρα`→`apartment_1br`, `στούντιο`→`studio`, `μεζονέτα`→`maisonette`, `ρετιρέ`/`πενθάουζ`→`penthouse`, `μονοκατοικία`→`detached_house`, `βίλα`→`villa`, `κατάστημα`/`μαγαζί`→`shop`, `γραφείο`→`office`, `αίθουσα`→`hall`, `αποθήκη`→`storage`), `normalizePropertyType(raw: unknown): PropertyTypeCanonical | null` resolver + `arePropertyTypesEquivalent(a, b): boolean` convenience predicate με apartment-family expansion (generic `apartment` matches `apartment_1br` και vice versa, preserving legacy UC-003 fuzzy-matching).
  - **Migrated**:
    - `src/services/ai-pipeline/modules/uc-003-property-search/property-search-query.ts` — local `typeAliases` one-to-many Record (hardcoded apartment/maisonette/store/studio fuzzy-match lists) αντικαταστάθηκε με `arePropertyTypesEquivalent()`. Το `matchUnitType()` helper καταρρέει σε single-line delegation. Τα match semantics διατηρούνται + επεκτείνονται (πλέον καλύπτει penthouse/villa/office/hall/detached_house/loft/storage Greek searches).
  - **Purpose**: Εξάλειψη scattered alias maps στο property-search pipeline. Μελλοντικά consumers (report-builder search, admin stats labels) θα χρησιμοποιούν τον κεντρικό resolver.
- **2026-04-05 (Batch 11B)**: `PropertyType` legacy Greek resolver + label helper (extension του ADR-145 SSoT, UC-013 consumer migration).
  - **Extended**: `src/constants/property-types.ts` — `normalizeLegacyGreekPropertyType(raw: unknown): PropertyTypeCanonical | null` (narrow resolver, accepts μόνο τιμές από `LEGACY_GREEK_PROPERTY_TYPES` — case-sensitive, διακρίνει από general `normalizePropertyType()`), `getPropertyTypeLabelEL(raw: unknown): string | null` (convenience: any input → Greek label από `PROPERTY_TYPE_LABELS_EL` μέσω `normalizePropertyType()` pipeline).
  - **Migrated**:
    - `src/services/ai-pipeline/modules/uc-013-admin-property-stats/admin-property-stats-module.ts` — local `PROPERTY_TYPE_LABELS` lookup Record (spread `PROPERTY_TYPE_LABELS_EL` + 7 lowercase Greek keys + 'parking') αντικαταστάθηκε με `resolvePropertyTypeLabel()` helper που delegates στο `getPropertyTypeLabelEL()` + 'parking' fallback + raw-passthrough για unknown. Identical display semantics (2Δ/3Δ collapse σε 'Διαμέρισμα' διατηρείται).
  - **Purpose**: Εξάλειψη της τελευταίας local lookup table στο AI pipeline για property types. Όλα τα Greek labels τώρα προέρχονται από SSoT.
- **2026-04-05 (Batch 12A)**: Delete dead `EnterprisePropertyTypesService` (parallel taxonomy cleanup).
  - **Deleted**: `src/services/property/EnterprisePropertyTypesService.ts` (803 γραμμές) + `src/features/property-grid/constants.ts` (166 γραμμές) — σύνολο **969 γραμμές dead code**.
  - **Context**: Είχαν δημιουργηθεί Dec 2025 ως Firestore-backed per-tenant property type service, αλλά ποτέ δεν συνδέθηκαν με UI/API consumer. Grep επιβεβαίωσε **zero external imports** σε όλο το `src/` (only self-references + the deleted constants file as sole consumer).
  - **Architectural decision (Γιώργος 2026-04-05)**: Static SSoT (`src/constants/property-types.ts`) παραμένει **κυρίαρχο** — ίδιο pattern με Google Maps Place Types, Stripe payment methods, Salesforce standard objects, AKTOR/ΓΕΚ ΤΕΡΝΑ domain models. Per-tenant customization, αν χρειαστεί ποτέ μελλοντικά, θα υλοποιηθεί πάνω στο SSoT ως cosmetic label overrides — όχι parallel taxonomy.
  - **Enterprise coverage ήδη από το static SSoT**: CFO reporting (`normalizePropertyType()` στο UC-013), VAT compliance (`COMMERCIAL_PROPERTY_TYPES`), BI/AI canonical vocabulary (12 canonical tokens + `arePropertyTypesEquivalent()`), audit query normalization (AI pipeline-wide).
- **2026-04-05 (Batch 13)**: Write-time enum normalization at property mutation gateway (hard data integrity).
  - **Extended**: `src/services/property/property-mutation-gateway.ts` — προστέθηκε `normalizeEnumFieldsForWrite(payload)` middleware που κανονικοποιεί τα `type` (PropertyType) και `commercialStatus` (CommercialStatus) πεδία σε canonical SSoT tokens **πριν** το Firestore write. Invalid inputs ρίχνουν typed errors (`InvalidPropertyTypeError`, `InvalidCommercialStatusError` — ambele extend `PropertyMutationPolicyError`).
  - **Call sites**: `createPropertyWithPolicy()` + `updatePropertyWithPolicy()` — οι μοναδικοί δύο write-path entry points του gateway. Building-link και linked-spaces paths δεν αγγίζουν τα εν λόγω πεδία → no-op.
  - **Semantics**: null/undefined values + missing keys περνούν άθικτα (ο caller ορίζει αν το field τίθεται καθόλου). Valid canonical values περνούν στον idempotent self-mapping alias (`'apartment'`→`'apartment'`). Valid Greek/legacy aliases normalize-άρονται (π.χ. `'διαμέρισμα'`→`'apartment'`, `'sold'`/`'πωλημένο'`→`'sold'`).
  - **Rename**: Το local `normalizeCommercialStatus()` helper (που διάβαζε το current state για field locking) μετονομάστηκε σε `readCurrentCommercialStatus()` για να αποφευχθεί naming collision με το imported SSoT resolver `normalizeCommercialStatusSSoT`.
  - **Consumers (όλα περνούν από το gateway — επιβεβαιώθηκε με grep)**: `PropertyInlineCreateForm`, `usePropertyForm`, `PropertyFieldsBlock`, `useGuardedPropertyMutation`, `usePolygonHandlers` (4 write sites). Όλες οι UI mutations καλύπτονται — **zero bypass paths**.
  - **Purpose**: Google-level data integrity pattern (clean-by-design Firestore). Αντί query-time normalization μόνο (που καλύπτει existing dirty data), τα writes πλέον εγγυώνται canonical tokens κατά την εισαγωγή → reports/BI/AI δουλεύουν σε clean data χωρίς να βασίζονται σε downstream fixup. Παράλληλα, αποτυχημένα writes δίνουν clear error messages που δείχνουν ποιο SSoT module παραβιάστηκε.
- **2026-04-05 (Batch 14)**: Backfill migration script για existing Firestore records.
  - **Created**: `scripts/migrate-property-enums.ts` — one-off ts-node script που διαβάζει όλα τα documents στο `properties` collection, εφαρμόζει `normalizePropertyType()` + `normalizeCommercialStatus()` στα legacy values, γράφει πίσω τα canonical tokens σε batched writes (400 ops/batch, Firestore limit 500).
  - **Zero drift**: Το script κάνει direct import από τα leaf SSoT modules (`src/constants/property-types.ts` + `src/constants/commercial-statuses.ts`) — ίδιοι normalizers με το runtime gateway (Batch 13) + το AI pipeline (Batch 10A/11A/11B).
  - **Safety**: **Dry-run by default** (δείχνει τι θα άλλαζε χωρίς writes). `--apply` flag required για actual Firestore mutations. Separate **unresolvable values report** για manual review cases (π.χ. typos, legacy tokens εκτός alias map).
  - **Usage**:
    ```bash
    # Dry-run (default)
    npx ts-node scripts/migrate-property-enums.ts
    # Apply
    npx ts-node scripts/migrate-property-enums.ts --apply
    ```
  - **Συμπλήρωση Batch 13**: Το write-time middleware προστατεύει ΝΕΑ writes. Το migration script καθαρίζει ΥΠΑΡΧΟΝΤΑ legacy records που γράφτηκαν πριν το Batch 13 ή απευθείας μέσω Firestore console/admin SDK bypass. Μαζί: **100% canonical data** στο collection.
- **2026-04-16 (Batch 15)**: Semantic UX helper `requiresAskingPrice()` + shared inline alert component.
  - **Extended**: `src/constants/commercial-statuses.ts` — νέος type-guard helper `requiresAskingPrice(value): value is ListedCommercialStatus` που delegates στο υπάρχον `isListedCommercialStatus()`. Semantic alias (δεν εισάγει duplicated λίστα), εκφράζει την UX intent "this status requires a price declaration" χωρίς να απαιτεί από τους consumers να γνωρίζουν ότι τα listed statuses συμπίπτουν σημασιολογικά με τα priced statuses.
  - **Created**: `src/components/properties/shared/AskingPriceRequiredAlert.tsx` — single reusable inline Alert που ενεργοποιείται μέσω `requiresAskingPrice()`. Props: `commercialStatus` (required) + optional `askingPrice` gate (αν undefined → πάντα εμφανίζεται όταν το status ταιριάζει — creation flow· αν defined → εμφανίζεται μόνο όταν η τιμή λείπει/είναι 0 — edit flow).
  - **Wired**: `AddPropertyDialog.tsx` (creation flow, sotto commercialStatus select — το dialog δεν έχει askingPrice field) + `PropertyFieldsEditForm.tsx` (edit flow, sotto askingPrice input — gate su έλλειψη τιμής).
  - **i18n**: Νέες keys `alerts.askingPriceRequired.title` + `.description` στα `src/i18n/locales/{el,en}/properties.json` (namespace `properties`). Zero hardcoded strings.
  - **Purpose**: UX guidance για να μην δημιουργούνται listings χωρίς τιμή (που δεν εμφανίζονται σε sales/rental dashboards). SSoT: αν μελλοντικά προστεθεί νέο listed status, αρκεί να ενημερωθεί το `LISTED_COMMERCIAL_STATUSES` — alert + semantic helper updated automatically.
  - **Scope περιορισμένο σε properties**: Buildings/contacts δεν έχουν ακόμα write-time middleware (άλλο gateway). Αν χρειαστεί, extending pattern (same normalize-read-write loop, different resolvers from `building-types.ts` / `contact-types.ts`).
