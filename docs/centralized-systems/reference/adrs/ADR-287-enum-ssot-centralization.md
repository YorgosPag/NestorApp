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
- **2026-04-16 (Batch 16)**: Semantic UX helper `requiresGrossArea()` + unified inline alert for sales dashboard requirements.
  - **Extended**: `src/constants/commercial-statuses.ts` — νέος type-guard helper `requiresGrossArea(value): value is ListedCommercialStatus` με το ίδιο pattern με το `requiresAskingPrice()`: alias του `isListedCommercialStatus()`, **zero duplicated λίστα**. Το `LISTED_COMMERCIAL_STATUSES` παραμένει το μοναδικό canonical array — αν προστεθεί νέο listed status, και τα δύο semantic aliases (`requiresAskingPrice` + `requiresGrossArea`) ενημερώνονται αυτόματα.
  - **Created**: `src/components/properties/shared/SalesDashboardRequirementsAlert.tsx` — unified inline Alert που αντικαθιστά το παλιό `AskingPriceRequiredAlert`. Props: `commercialStatus` (required) + optional `askingPrice` + optional `grossArea` gates. Ο alert εμφανίζεται όταν το status είναι listed ΚΑΙ τουλάχιστον ένα από τα δύο fields λείπει· το rendered body είναι δυναμική bulletlist των missing requirements (λιγότερος οπτικός θόρυβος από δύο parallel alerts όταν λείπουν ταυτόχρονα).
  - **Removed**: `src/components/properties/shared/AskingPriceRequiredAlert.tsx` (Batch 15 component) — αντικαταστάθηκε ολοκληρωτικά από το unified alert. Καμία retrocompatibility shim — το component ήταν βραχείας ζωής (1 day), οι μόνοι consumers ενημερώθηκαν directly.
  - **Wired**:
    - `AddPropertyDialog.tsx` (creation flow) — passes `grossArea={formData.area}`. Το creation form έχει ένα single "area" field που αποθηκεύεται ως `property.area` top-level (gross — βλ. `property-fields-save-handler.ts:34` που mappάρει `areaGross` σε αυτό το field). Το `askingPrice` δεν υπάρχει στο creation form → `undefined` → **πάντα missing** όταν status listed.
    - `PropertyFieldsEditForm.tsx` (edit flow) — passes `askingPrice={formData.askingPrice ?? null}` + `grossArea` derived από `aggregatedTotals.areas.gross` αν multi-level, αλλιώς `formData.areaGross`. Multi-level aware: το property-wide alert βλέπει την aggregated gross area, όχι την τιμή του active level.
  - **i18n**: Νέες keys `alerts.salesDashboardRequirements.{title, description, missing.askingPrice, missing.grossArea}` στα `src/i18n/locales/{el,en}/properties.json`. Οι παλιές Batch 15 keys `alerts.askingPriceRequired.{title, description}` αφαιρέθηκαν. **Pure Greek translation** (καμία αγγλική λέξη): "Απαιτήσεις προβολής στους πίνακες πωλήσεων/ενοικιάσεων" + "Μεικτό εμβαδό (τ.μ.)". Zero hardcoded strings (CLAUDE.md N.11).
  - **Purpose**: Google-level UX — ενιαίο "Sales dashboard requirements" panel αντί για πολλαπλά parallel warnings. Προλαμβάνει την δημιουργία listings που δεν εμφανίζονται σε sales/rental dashboards επειδή λείπει τιμή ή/και μεικτό εμβαδό (και τα δύο απαραίτητα για €/τ.μ. και sales analytics).
  - **Gross vs Net decision**: Το check γίνεται στο **gross (μεικτό)** εμβαδό και όχι στο net, επειδή το gross είναι το primary marketing surface που εμφανίζεται στα listings/dashboards και είναι το field που αποθηκεύεται ως `property.area` top-level (canonical για reports/filters). Το net area είναι secondary (per-level usable surface).
  - **SSoT preserved**: Τρεις helpers (`isListedCommercialStatus`, `requiresAskingPrice`, `requiresGrossArea`) αλλά **μία λίστα** (`LISTED_COMMERCIAL_STATUSES`). Semantic aliases εκφράζουν UX intent χωρίς να duplicate το source of truth.
- **2026-04-16 (Batch 17)**: Google-style price plausibility check (Tier 1 static ranges).
  - **Created**: `src/constants/price-plausibility.ts` — SSoT για "is this asking price realistic?" sanity check. Εξάγει:
    - `PLAUSIBILITY_RANGES: Record<ListingPriceMode, Record<PropertyPriceClass, PlausibilityRange>>` — static €/τ.μ. bands + absolute floor για Ελλάδα 2026 (3 property classes × 2 listing modes = 6 bands).
    - `classifyPropertyTypeForPricing(type)` → `'residential' | 'commercial' | 'auxiliary'` (leverages `PROPERTY_TYPES` SSoT: storage → auxiliary, shop/office/hall → commercial, rest → residential; unknown → residential as safest default).
    - `assessPricePlausibility(args)` → `{ verdict, mode, priceClass, pricePerSqm, expected }` με 5 verdicts: `ok`, `insufficientData`, `hardFloor`, `suspiciousLow`, `suspiciousHigh`. Gate order: listed status → price > 0 → absolute floor → gross area > 0 → €/τ.μ. band.
    - `isActionableVerdict(v)` — type narrowing helper για UI layer.
  - **Created**: `src/components/properties/shared/PricePlausibilityWarning.tsx` — inline amber Alert, **non-blocking** (Google pattern: sanity check, not error). Pure render layer — delega όλη την λογική στο SSoT helper. Interpolates localized numbers (`toLocaleString('el-GR')`) σε ICU templates.
  - **Wired**: `PropertyFieldsEditForm.tsx` — warning κάτω από το `SalesDashboardRequirementsAlert` στην Identity card, δίπλα στον askingPrice input. Διαβάζει `grossArea` με την ίδια multi-level-aware logic (aggregated σε multi-level, flat αλλιώς). Creation flow (`AddPropertyDialog`) δεν wires το warning γιατί δεν έχει askingPrice input.
  - **i18n**: Νέες keys `alerts.pricePlausibility.{hardFloor, suspiciousLow, suspiciousHigh}.{title, description}` στα `src/i18n/locales/{el,en}/properties.json`. ICU interpolation single-brace (`{pricePerSqm}`, `{min}`, `{max}`, `{absoluteFloor}`) ανά CHECK 3.9. Pure Greek translation (καμία αγγλική λέξη στο el locale). Zero hardcoded strings (CLAUDE.md N.11).
  - **Google pattern**: Μη-blocking sanity warning — ο χρήστης μπορεί να αποθηκεύσει ακόμα και σε hardFloor verdict (αν έχει legitimate reason: test data, κρυφή συμφωνία, edge case). Σκοπός: να πιάσουμε **typos** (1€ αντί 100000€), όχι να κριτικάρουμε business decisions. Ranges γενναιόδωρα για να αποφεύγεται alert fatigue.
  - **Tier 2 (future)**: Per-project median benchmark — compare με median €/τ.μ. των sibling properties στο ίδιο project+type. Θα απαιτήσει aggregation query + ≥5 properties for statistical validity + ADR επέκτασης. Δεν υλοποιείται σε αυτό το batch.
  - **SSoT**: Όλες οι ranges + classification + assessment logic σε ένα leaf module. Το UI component είναι pure view. Αν προσθέσουμε νέο property type ή listing mode, επέκταση γίνεται σε ένα σημείο (constants file).
- **2026-04-16 (Batch 18)**: Display-eligibility gate για sales dashboards & public vetrina — κλείνει το UX-vs-query drift.
  - **Problem statement**: Το `SalesDashboardRequirementsAlert` (Batch 16) υπόσχεται στον χρήστη ότι incomplete listings (listed commercialStatus χωρίς askingPrice ή grossArea) **δεν** εμφανίζονται στους πίνακες πωλήσεων/ενοικιάσεων. Ωστόσο, οι πραγματικές queries/hooks δεν εφάρμοζαν κανένα τέτοιο gate — οι λίστες εμφάνιζαν ό,τι υπήρχε στο collection. UX contract → query contract mismatch (Google pattern violation: η διεπαφή είναι συμβόλαιο).
  - **Extended**: `src/constants/commercial-statuses.ts` — νέο leaf helper `isDisplayableInSalesDashboard(input)` + companion interface `SalesDisplayEligibilityInput`. Gate: `isListedCommercialStatus(commercialStatus) && askingPrice > 0 && grossArea > 0`. Πλήρως agnostic σε data shape (δέχεται 3 optional scalar fields) — κάθε consumer κάνει ό,τι mapping χρειάζεται από το δικό του schema.
  - **Applied**: `src/hooks/useSalesPropertiesViewerState.ts` — pre-filter `salesUnits` μέσω του gate. Αφαιρέθηκε το προηγούμενο inline comment "Sold/rented units remain accessible for post-sale follow-up" γιατί η σελίδα είναι "Διαθέσιμα Ακίνητα" (availability vetrina, όχι analytics). Sold/rented παραμένουν διαθέσιμα μέσω reports/analytics flows — όχι σε αυτήν την σελίδα.
  - **Refactored**: `src/hooks/usePublicPropertyViewer.ts` — αφαιρέθηκαν τρεις hardcoded sets (`PUBLIC_ALLOWED_COMMERCIAL_STATUSES`, `PUBLIC_ALLOWED_LEGACY_STATUSES`, `PUBLIC_ALLOWED_OPERATIONAL_STATUSES`) που duplicate-άραν το `LISTED_COMMERCIAL_STATUSES`. Legacy `status` field κανονικοποιείται μέσω του υπάρχοντος `normalizeCommercialStatus()` (Batch 10A) πριν περάσει στο gate — migration-safe χωρίς extra sets. `operationalStatus === 'ready'` fallback καταργήθηκε: δεν υπάρχει πλέον path που εμφανίζει customer-facing listing χωρίς askingPrice/grossArea.
  - **SSoT preserved**: Μία λίστα (`LISTED_COMMERCIAL_STATUSES`), τρεις semantic aliases (`requiresAskingPrice`, `requiresGrossArea`, `isListedCommercialStatus`), ένας eligibility gate (`isDisplayableInSalesDashboard`). Όλα σε ένα leaf module. Η προσθήκη νέου listed status updates όλο το downstream αυτόματα — sales vetrina, public viewer, alerts.
  - **UI ↔ query alignment**: Το `SalesDashboardRequirementsAlert` και ο gate μοιράζονται την ίδια triadic condition (listed status + price + area). Αν αλλάξει η business rule (π.χ. απαιτείται και `rentMonthly` για `for-rent`), επεκτείνεται το `SalesDisplayEligibilityInput` + gate + alert σε συντονισμό — single refactor point.
  - **No new i18n / no UI changes**: Καθαρά data-layer change. Ο alert ήδη δείχνει στον χρήστη τις προϋποθέσεις· ο gate τώρα τις επιβάλλει.
  - **Bug fixed**: Property με `commercialStatus=for-rent`, `askingPrice=null`, `grossArea=null` εμφανιζόταν στη σελίδα "Διαθέσιμα Ακίνητα" παρότι ο alert στο edit form υπόσχεται το αντίθετο. Τώρα εξαιρείται σωστά.
  - **Out of scope**: `/properties` gestionale λίστα (`PropertiesPageContent` via `usePropertyFilters`) παραμένει unfiltered — είναι internal management view, χρειάζεται να βλέπει draft/incomplete units για data entry. Gate εφαρμόζεται μόνο σε customer-facing / sales-facing surfaces.
- **2026-04-17 (Batch 19)**: Google-style floor ↔ property-type plausibility check (Tier 1 static matrix).
  - **Created**: `src/constants/floor-type-plausibility.ts` — SSoT για "is this property-type consistent with the selected floor?" sanity check. Εξάγει:
    - `FloorBand = 'basement' | 'ground' | 'upper'` — V1 3-band classification (floor < 0 / floor === 0 / floor > 0). Μελλοντικό batch μπορεί να εισάγει 4η banda (`top`) μόλις υπάρχει cross-entity lookup του `buildingTopFloor` (non-breaking extension).
    - `classifyFloor(floor)` — accepts `number | string | unknown`, returns `FloorBand | null`. Δέχεται 0 και αρνητικά (unlike price-plausibility `toPositiveNumber`).
    - `FLOOR_TYPE_MATRIX: Record<Exclude<PropertyTypeCanonical, 'villa' | 'detached_house'>, Record<FloorBand, FloorTypeVerdict>>` — 10 in-building types × 3 bands. Google business rules: residential basement → `unusual`, penthouse basement/ground → `implausible`, hall/storage basement → `ok` (canonical), shop upper → `unusual`, κ.λπ.
    - `assessFloorTypePlausibility(args)` → `{ verdict, band, propertyType, isStandalone }` με 4 verdicts: `ok`, `insufficientData`, `unusual`, `implausible`. Special-case για Family B standalone (villa, detached_house): floor null/undefined/0 → `ok`, floor ≠ 0 → `implausible` (standalone δεν ανήκει σε όροφο per ADR-284).
    - `isActionableFloorVerdict(v)` — type narrowing helper για UI layer.
  - **Created**: `src/components/properties/shared/FloorTypePlausibilityWarning.tsx` — inline amber Alert, **non-blocking** (Google pattern: sanity check, not error). Pure render layer — delega όλη την λογική στο SSoT helper. Interpolates localized property-type label (`PROPERTY_TYPE_I18N_KEYS`) + band label σε ICU templates.
  - **Wired**:
    - `PropertyFieldsEditForm.tsx` — warning κάτω από το `PricePlausibilityWarning` στην Identity card (edit & create paths).
    - `AddPropertyDialog.tsx` — warning κάτω από το FormField του floor (creation dialog).
  - **i18n**: Νέες keys `alerts.floorTypePlausibility.{bands.{basement,ground,upper}, unusual.{title,description}, implausible.{title,description}}` στα `src/i18n/locales/{el,en}/properties.json`. ICU interpolation single-brace (`{type}`, `{band}`) ανά CHECK 3.9. Pure Greek translation (καμία αγγλική λέξη στο el locale). Zero hardcoded strings (CLAUDE.md N.11).
  - **Google pattern**: Μη-blocking sanity warning — ο χρήστης μπορεί να αποθηκεύσει και σε `implausible` verdict (legitimate edge case: basement apartment conversion, penthouse σε building χωρίς καταγεγραμμένο top floor). Σκοπός: να πιάσουμε λάθος dropdown selections + data entry errors, όχι να κριτικάρουμε unusual properties. Matrix συντηρητικά sized ώστε να αποφεύγεται alert fatigue (π.χ. office σε upper = `ok`, όχι `unusual`).
  - **Scope limitation (V1)**: Δεν διακρίνει middle vs top floor. Penthouse σε floor=5 σε building 5-ορόφων δείχνει `ok` (upper), αλλά και σε floor=5 σε building 10-ορόφων δείχνει `ok`. Cross-entity lookup του `buildingTopFloor` είναι μελλοντικό batch (Batch 20 candidate) — θα αναβαθμίσει το band classification σε 4 bands + θα εκλεπτύνει τα penthouse/loft/shop/office verdicts.
  - **SSoT**: Όλη η matrix + classification + assessment logic σε ένα leaf module. Το UI component είναι pure view. Νέος property type → ADR-287 Batch 11 alias resolution (αυτόματα), + νέα row στο `FLOOR_TYPE_MATRIX` (single edit point).
  - **Family A/B consistency**: Ο helper `isStandaloneUnitType()` (Batch 14, ADR-284) επαναχρησιμοποιείται για να διακρίνει Family B. Καμία duplicate standalone list — single source.
- **2026-04-17 (Batch 20)**: Google-style layout (bedrooms/bathrooms/WC) plausibility check + dropdown filtering για `storage`.
  - **Created**: `src/constants/layout-plausibility.ts` — SSoT για "does the room layout match the property type?" sanity check. Εξάγει:
    - `LAYOUT_RULES: Record<PropertyTypeCanonical, LayoutRule>` — per-type bedroom min/max + `bedroomStrict` flag + `requiresSanitary` / `requiresDedicatedBathroom` / `requiresDedicatedWC` booleans. Covers και τα 12 canonical types (residential + commercial + auxiliary).
    - `assessLayoutPlausibility(args)` → `{ verdict, reason, propertyType, rule, bedrooms, bathrooms, wc }` με 4 verdicts (`ok`, `insufficientData`, `unusual`, `implausible`) + 6 reason codes (`bedroomMismatch`, `bedroomAtypical`, `bedroomsForbidden`, `noSanitary`, `noDedicatedBathroom`, `noDedicatedWC`). Single-reason surfacing — priority: bedroom constraints > sanitary checks.
    - `isActionableLayoutVerdict(v)` — type narrowing helper.
  - **Definitions aligned with Greek/EU real-estate + Zillow/Idealista patterns**:
    - Studio (στούντιο) → strict 0 bedrooms (open-plan definition)
    - Γκαρσονιέρα (apartment_1br) → strict 1 bedroom (ελληνικός ορισμός)
    - Apartment / maisonette / detached_house → ≥1 bedroom strict
    - Penthouse / villa → ≥1 / ≥2 bedroom + dedicated bathroom (luxury)
    - Loft → flexible 0–2 bedrooms (loose, open-plan convertible)
    - Shop / office / hall → no bedrooms, requires WC (Greek commercial code)
    - Storage → 0 bedrooms, no sanitary requirements (auxiliary)
  - **Created**: `src/components/properties/shared/LayoutPlausibilityWarning.tsx` — inline amber Alert, **non-blocking**. Pure render — delega assessment στο SSoT helper. Per-reason localized messages via `alerts.layoutPlausibility.reasons.<code>` i18n keys. Single warning shown (priority-ordered) για αποφυγή alert fatigue.
  - **Wired**: `PropertyFieldsEditForm.tsx` — warning κάτω από το `FloorTypePlausibilityWarning` στην Identity card. Creation dialog (`AddPropertyDialog`) δεν wires — δεν έχει bedroom/bathroom fields στο initial creation flow.
  - **i18n**: Νέες keys `alerts.layoutPlausibility.{unusual.title, implausible.title, reasons.*}` στα `src/i18n/locales/{el,en}/properties.json`. ICU single-brace interpolation (`{type}`, `{bedrooms}`, `{bathrooms}`, `{wc}`, `{min}`, `{max}`) per CHECK 3.9. Pure Greek translation. Zero hardcoded strings.
  - **Google pattern**: Μη-blocking sanity warning — ο χρήστης μπορεί να αποθηκεύσει ακόμα και σε `implausible` verdict (legitimate edge case: raw/unfinished unit, loft industriale, mezzanine conversion). Σκοπός: να πιάσουμε λάθος dropdown selections + data entry errors.
  - **Storage dropdown removal** (Γιώργος request 2026-04-17):
    - **Added**: `CREATABLE_PROPERTY_TYPES` (leaf module `property-types.ts`) — derived από `PROPERTY_TYPES.filter((t) => t !== 'storage')`. Storage αποθήκες δημιουργούνται από dedicated storage-management σελίδα, όχι από το γενικό property unit dialog.
    - **Applied**: Τρεις unit-creation dropdowns τώρα χρησιμοποιούν `CREATABLE_PROPERTY_TYPES`:
      - `src/features/property-details/components/property-fields-constants.ts` — `PROPERTY_TYPE_OPTIONS`
      - `src/components/properties/dialogs/useAddPropertyDialogState.ts` — `PROPERTY_TYPE_OPTIONS`
      - `src/components/properties/shared/NewUnitHierarchySection.tsx` — import alias
    - **Preserved**: Canonical `PROPERTY_TYPES` array παραμένει full (12 types) για Firestore backward compat, filters (`UNIT_TYPES_FOR_FILTER`, public property filter checkboxes), reports, super-admin search. Η αλλαγή είναι UI-only dropdown filtering — zero breaking changes σε data layer.
  - **SSoT**: Όλη η rules matrix + assessment logic σε ένα leaf module. UI component = pure view. Adding new property type → single edit σε `LAYOUT_RULES` + `PROPERTY_TYPES`.
  - **Out of scope για V1**: Cross-field priority merging (π.χ. bedroom mismatch AND missing sanitary → single combined message). Μελλοντικό enhancement αν reported alert coverage ανεπαρκής.
- **2026-04-17 (Batch 21)**: Google-style area (gross / net / balcony / terrace / garden) plausibility check.
  - **Created**: `src/constants/area-plausibility.ts` — SSoT για "are the area measurements plausible for this property type?" sanity check. Εξάγει:
    - `AREA_RULES: Record<PropertyTypeCanonical, AreaRule>` — per-type `grossHardMin` / `grossTypicalMax` + `outdoorExpected` / `outdoorRequired` / `gardenTypical` / `ratioApplies` flags. Covers και τα 12 canonical types (residential + commercial + auxiliary).
    - `AREA_RATIO_LOW` (0.60) / `AREA_RATIO_HIGH` (0.95) — net/gross ratio thresholds tuned στην ελληνική αγορά (typical 0.82–0.92).
    - `assessAreaPlausibility(args)` → `{ verdict, reason, propertyType, rule, gross, net, balcony, terrace, garden, ratio }` με 4 verdicts (`ok`, `insufficientData`, `unusual`, `implausible`) + 10 reason codes (`netExceedsGross`, `netZeroWithGross`, `grossBelowMin`, `luxuryNoOutdoor`, `grossAboveMax`, `netRatioTooLow`, `netRatioTooHigh`, `netEqualsGross`, `noOutdoorResidential`, `gardenOnNonGround`). Single-reason surfacing — priority: physical impossibility > type-definition contradiction > range violations > ratio anomalies > outdoor expectations > garden placement.
    - `isActionableAreaVerdict(v)` — type narrowing helper.
  - **Definitions aligned with Greek/EU real-estate + Zillow/Idealista/Spitogatos standards**:
    - Studio → gross 10–65 τ.μ., no outdoor expected (tiny units legit)
    - Γκαρσονιέρα (apartment_1br) → 20–75 τ.μ., no outdoor expected
    - Apartment → 30–250 τ.μ., outdoor expected (unusual αν όλα 0)
    - Maisonette → 50–400 τ.μ., outdoor expected
    - Penthouse → 50–450 τ.μ., outdoor **required** (implausible αν όλα 0 — luxury without outdoor contradicts definition)
    - Loft → 25–300 τ.μ., flexible (industrial convertible)
    - Detached_house → 50–700 τ.μ., outdoor + garden required
    - Villa → 80–1500 τ.μ., outdoor + garden required (luxury standalone)
    - Shop / office → 8/10–800 τ.μ., no outdoor checks
    - Hall → 40–5000 τ.μ., no outdoor / no ratio check (open-plan variable)
    - Storage → 2–50 τ.μ., no outdoor / no ratio check (auxiliary)
  - **Physical impossibility rule** (Γιώργος direction): `net > gross` OR `gross > 0 && net === 0` → `implausible`. Η αναλογία καθαρού προς μεικτού θα πρέπει πάντα να βρίσκεται κάτω από 100% (typical 82–92%). Zero net με positive gross = ασυνέπεια data entry.
  - **Ratio anomalies** (`unusual`, μη-blocking): `net/gross < 0.60` (πιθανή υπερβολική κοινόχρηστη επιφάνεια), `net/gross > 0.95` (υπερβολικά μικρή αφαίρεση για τοιχοποιία), `net === gross` (zero wall deduction). Range tuned στο ελληνικό market stock.
  - **Outdoor expectations** (residential-only):
    - Penthouse / villa / detached_house χωρίς κανένα outdoor (balcony + terrace + garden = 0) → `implausible` (luxury definition contradiction).
    - Apartment / maisonette χωρίς κανένα outdoor → `unusual` (ελληνικά διαμερίσματα τυπικά έχουν μπαλκόνι).
    - Studio / loft / apartment_1br — no outdoor check (legit χωρίς για μικρές μονάδες).
  - **Garden placement rule**: Garden > 0 σε apartment / penthouse / maisonette / loft → `unusual` (γενικά εμφανίζεται σε ισόγεια ή μονοκατοικίες). Skip για shop / office / hall / storage (commercial irrelevant).
  - **Created**: `src/components/properties/shared/AreaPlausibilityWarning.tsx` — inline amber Alert, **non-blocking**. Pure render — delega assessment στο SSoT helper. Per-reason localized messages via `alerts.areaPlausibility.reasons.<code>` i18n keys. Single warning shown (priority-ordered) για αποφυγή alert fatigue. Ratio formatted ως percentage (`{ratio}` placeholder → `85%`).
  - **Wired**: `PropertyFieldsEditForm.tsx` — warning μέσα στην Areas card, αμέσως μετά το editable/aggregated input branch, πριν το millesimal shares read-only section. Multi-level aware: διαβάζει `aggregatedTotals.areas.*` (aggregated view), `currentLevelData.areas.*` (per-level edit), ή `formData.area{Gross,Net,Balcony,Terrace,Garden}` (single-level / creation). Coexist με το υπάρχον inline `netExceedsGross` per-input micro-feedback (border rossa + tiny hint) — complementary UX layers: inline = immediate data-entry cue, SSoT warning = semantic sanity summary.
  - **i18n**: Νέες keys `alerts.areaPlausibility.{unusual.title, implausible.title, reasons.*}` στα `src/i18n/locales/{el,en}/properties.json`. ICU single-brace interpolation (`{type}`, `{gross}`, `{net}`, `{balcony}`, `{terrace}`, `{garden}`, `{ratio}`, `{min}`, `{max}`) per CHECK 3.9. Pure Greek translation — χρήση `τ.μ.` αντί `m²` ανά CLAUDE.md N.11 pure-Greek rule. Zero hardcoded strings.
  - **Google pattern**: Μη-blocking sanity warning — ο χρήστης μπορεί να αποθηκεύσει ακόμα και σε `implausible` verdict (legitimate edge case: υπό-κατασκευή ακίνητο, converted industrial loft, μη-οριστικοποιημένες μετρήσεις πριν την έκδοση άδειας). Σκοπός: να πιάσουμε typos, λάθος type selection, και ασυνέπειες μεταξύ gross/net.
  - **Field naming** (Firestore schema alignment): Canonical field names `gross` / `net` / `balcony` / `terrace` / `garden` — matching `areas?: { gross, net?, balcony?, terrace?, garden? }` από το `src/types/property.ts`. Δεν έχουμε ξεχωριστό `veranda` field — το `terrace` καλύπτει ελληνική έννοια "βεράντα".
  - **SSoT**: Όλη η rules matrix + ratio thresholds + assessment logic σε ένα leaf module. UI component = pure view. Νέος property type → single edit σε `AREA_RULES` + `PROPERTY_TYPES`. Αλλαγή αγοραστικών tolerances (π.χ. luxury ratio > 0.95 acceptable για penthouse) → tweak των thresholds σε ένα σημείο.
  - **Out of scope για V1**: Separate balcony/terrace plausibility ranges per type (π.χ. "villa με μπαλκόνι 200 τ.μ. είναι ασυνήθιστο"). Multi-reason combining (π.χ. `netExceedsGross` AND `luxuryNoOutdoor` → μοναδικό aggregated alert). Per-level area ratio check (V1 εξετάζει μόνο το aggregate ή current level).
- **2026-04-17 (Batch 22)**: Bidirectional level symmetry — SSoT cleanup helper για multi↔single property-type transitions (ADR-236 Phase 5).
  - **Problem**: Όταν ο χρήστης άλλαζε τύπο από maisonette/penthouse/loft (multi-level capable) σε apartment/studio (single-level), τα level tabs παρέμεναν orphan στο UI. Forward direction (single→multi auto-create) δούλευε από Phase 4, αλλά reverse cleanup έλειπε. Επιπλέον, σε edit mode το `isMultiLevel`/`effectiveLevels` διάβαζαν `property.*` από Firestore (όχι formData) — άρα ακόμα και αν το cleanup του formData γινόταν, το UI continuava να δείχνει stale tabs μέχρι save+refetch.
  - **Created**: `src/services/property/level-reconciliation.ts` — pure SSoT helper `reconcileLevelsForType({ oldType, newType, currentLevels, currentLevelData, flatFields })`. Επιστρέφει `{ transition: 'multi-to-single' | 'single-to-multi' | 'none', newLevels, newLevelData, flatPatch, clearActiveLevel, shouldAutoCreate, autoSavePayload }`. Καμία side effect — testable, server-safe, καλύπτει 9 unit tests (multi→single aggregation, manual flat preservation, autoSavePayload shape, single→multi signal, no-op cases).
  - **Wired**: `usePropertyFieldHandlers.ts` καλεί τον helper σε κάθε type change. Σε multi→single: aggregate `levelData` (areas SUM, layout SUM, orientations UNION) → flat `formData` πριν το clear. Zero perceived data loss εκτός από finishes (per-level only ανά Phase 2 contract). Σε single→multi: triggerAutoLevelCreation, gate `isCreatingNewUnit` αφαιρέθηκε για συμμετρία edit/create.
  - **Refactored**: `PropertyFieldsBlock.tsx` — `isMultiLevel` + `effectiveLevels` derive ΑΠΟ `formData` και στα δύο modes (πριν: edit mode διάβαζε `property.*`). UI αντιδρά αμέσως στο type change. `useAutoLevelCreation` configured με `formData.buildingId/floorId/floor` (πριν: gated σε `isCreatingNewUnit`). Edit mode `onUpdateProperty` callback αναμεταδίδει `{ levels, isMultiLevel, floor, floorId }` στο `onAutoSaveFields` για άμεσο Firestore persist.
  - **Auto-save extension**: σε multi→single edit mode, `onAutoSaveFields` καλείται με merged payload `{ type, name, isMultiLevel: false, levels: [], levelData: {}, areas, layout, orientations }` — single Firestore write αντί για να περιμένουμε explicit Save.
  - **Google pattern**: bidirectional symmetry contract — αν A→B δημιουργεί N level cards, τότε B→A τα αφαιρεί. Silent cleanup (no modal, no toast) ακολουθώντας Google Docs/Sheets pattern. User-visible state transition αμέσως, undo available μέσω type re-selection.
  - **SSoT**: Όλη η reconciliation logic σε ένα pure module. Hook `usePropertyFieldHandlers` = thin orchestrator. Αλλαγή policy (π.χ. πάντα keep aggregated values ακόμα και αν > flat, ή confirmation dialog πριν cleanup) → single edit στο helper.
  - **Out of scope για V1**: undo toast με snapshot restore (silent cleanup σύμφωνα με Google pattern). Per-level finishes preservation σε flat (Phase 2 contract: finishes είναι per-level-only — σκόπιμη απώλεια στο reverse). Confirmation modal για destructive cleanup (decisione: silent, user can re-select multi-type to recreate empty levels).
- **2026-04-17 (Batch 24)**: Google-style sanity checks για 5 sezioni property fields (orientations, condition, systems, finishes, interior features).
  - **Created**: 5 leaf SSoT modules sotto `src/constants/`:
    - `orientation-plausibility.ts` — `ORIENTATION_RULES: Record<PropertyTypeCanonical, OrientationRule>` + `assessOrientationPlausibility()`. Reasons: `missingResidential` (residential 0 orientations), `tooMany` (>4 σε non-standalone non-commercial), `allEightNonStandalone` (8 σε non-villa/detached), `commercialAllDirections` (shop/office >2). Standalone (villa/detached_house) excluded from cap — όλες οι 8 κατευθύνσεις θεμιτές.
    - `condition-plausibility.ts` — `assessConditionPlausibility()` cross-field (condition × operationalStatus × heatingType × energyClass). Reasons: `needsRenovationButReady` (implausible — contradicts operational), `newWithoutHeating` (implausible — ΚΕνΑΚ violation), `newButLowEnergy` (unusual — class E/F/G), `needsRenovationHighEnergy` (unusual — class A+/A/B).
    - `systems-plausibility.ts` — `assessSystemsPlausibility()` cross-field (type × heating × cooling × condition × area). Reasons: `heatingNoneNewBuild` (implausible), `heatingNoneResidential` (implausible — ΚΕνΑΚ residential exemption applies only σε storage/hall), `coolingOversizedTinyUnit` (central-air σε <40 τ.μ. residential), `coolingNoneLargeUnit` (residential >120 τ.μ. χωρίς ψύξη).
    - `finishes-plausibility.ts` — `assessFinishesPlausibility()` cross-field (flooring × glazing × frames × energyClass × condition × interiorFeatures). Reasons: `glazingSingleHighEnergy` (implausible — single + class A+/A/B physically incompatible), `carpetWithUnderfloor` (unusual — counterproductive), `glazingTripleLowEnergy` (unusual — investment incoherence with F/G), `glazingMissingFinished` / `flooringEmptyFinished` (unusual — missing data σε finished unit).
    - `interior-features-plausibility.ts` — `assessInteriorFeaturesPlausibility()` cross-field (interiorFeatures × securityFeatures × energyClass × heating × cooling × type × area). Reasons: `airConditioningRedundant` (feature + coolingType set), `alarmSystemRedundant` (alarm-system in interior + alarm in security), `underfloorHeatingNoCentral` (incompatible with heating=none/autonomous), `solarPanelsLowEnergy` (unusual — F/G), `fireplaceTinyStudio` (unusual — studio/1br <35 τ.μ.), `luxuryFeaturesStudio` (jacuzzi/sauna σε studio).
  - **Created**: 5 pure-render warning components σε `src/components/properties/shared/`:
    - `OrientationPlausibilityWarning.tsx`
    - `ConditionPlausibilityWarning.tsx`
    - `SystemsPlausibilityWarning.tsx`
    - `FinishesPlausibilityWarning.tsx`
    - `InteriorFeaturesPlausibilityWarning.tsx`
    Stesso pattern Batch 21 (amber Alert, single-reason surfacing, ICU placeholders, `isActionable*Verdict` narrowing).
  - **Wired**: `PropertyFieldsDetailCards.tsx` + new `PropertyFieldsDetailCardsRow2.tsx` (split per N.7.1). Warning ζώνη μέσα στο CardContent της κάθε section, immediately μετά τα fields. Multi-level aware όπου εφαρμόζεται: orientations + finishes διαβάζουν `currentLevelData` (active level) ή `aggregatedTotals` (totals view) ή `formData` (single-level / creation). Condition / Systems / InteriorFeatures είναι shared — διαβάζουν πάντα από `formData` (matches CardHeader sharedHint behavior).
  - **Split**: `PropertyFieldsDetailCards.tsx` 460→276 γραμμές, νέο `PropertyFieldsDetailCardsRow2.tsx` 309 γραμμές. Trigger: 5 warning wirings έσπρωξαν το original σε 530 γραμμές, υπερβαίνοντας το N.7.1 όριο 500. SRP-clean cut: Row 1 (Layout / Orientation / Condition+Energy) μένει στο parent, Row 2 (Systems / Finishes / Features) εξάγεται. Zero behavioral change.
  - **i18n**: Νέες keys `alerts.{orientation,condition,systems,finishes,interiorFeatures}Plausibility.{unusual.title, implausible.title, reasons.*}` (≈80 keys total) στα `src/i18n/locales/{el,en}/properties.json`. Pure Greek (no English words). ICU single-brace placeholders (`{type}`, `{count}`, `{condition}`, `{energyClass}`, `{cooling}`, `{heating}`, `{area}`, `{features}`).
  - **Tests**: 5 unit-test files σε `src/constants/__tests__/` (~9 tests ανά helper, 45+ total). Coverage: insufficientData gates, ok happy paths, κάθε reason code, priority order spot-checks, `isActionable*Verdict` narrowing.
  - **Google pattern**: Plausibility / sanity check — ΠΟΤΕ δεν μπλοκάρει το save. Ο χρήστης μπορεί πάντα να αποθηκεύσει legitimate edge cases (raw shell, partial data, ασυνήθιστες luxury combinations). Σκοπός: catch typos, λάθος επιλογές dropdown, αντιφάσεις cross-field. Material Design pattern — context-relevant inline warnings αντί global error summary.
  - **Cross-field rules cataloged** (15 total, 11 implemented V1):
    - V1 implemented: orientations missing/too-many/all-8/commercial; condition needs-renovation+ready / new+no-heating / new+low-energy / needs-reno+high-energy; systems heating=none+residential / heating=none+new / cooling=central+tiny / cooling=none+large; finishes single+high-energy / triple+low-energy / carpet+underfloor / glazing-missing+finished / flooring-missing+finished; interior air-conditioning+cooling / alarm+alarm / underfloor+no-central / solar+low-energy / fireplace+tiny-studio / luxury+studio.
    - Out of scope V1: orientations opposite-only check (north+south μόνο = corridor unit?), windowFrames=wood + condition=new informational (rare in greek market), commercial cross-checks (shop χωρίς storage), security-as-selling-point UX hint (not plausibility — postpone V2).
  - **SSoT**: 5 leaf modules indipendenti, καθένα με δική του rules matrix. Νέος cross-field rule → single edit στο σχετικό helper. Νέος property type → minimal impact (ORIENTATION_RULES + κανείς άλλος hardcoded set). Διαφορετικά severity ordering ή tolerances → tweak constants σε ένα σημείο.
  - **Out of scope για V1**:
    - Security features plausibility (skip V1 — SecurityFeatures είναι UX hint domain, όχι plausibility — postpone αν reported demand).
    - Cross-section warning aggregation/de-duplication (π.χ. condition=new + heating=none triggers 2 warnings — condition card + systems card. Single-section single-reason surfacing per Batch 21 pattern, accepted overlap).
    - Per-level finishes plausibility coupling με per-level orientations (V1 reads active-level finishes/orientations indipendent — accurate enough για data entry feedback).
    - i18n missing keys baseline ratchet adjustment — οι νέες keys είναι complete σε el+en, καμία baseline ratchet impact.
- **2026-04-17 (Batch 23)**: Property form sync — per-field server↔form reconciliation (preserve unsaved edits across auto-save round-trips).
  - **Problem**: Σε edit mode, ο χρήστης συμπλήρωνε 20 πεδία (areas, layout, orientations, condition, energy, finishes…) χωρίς να πατήσει Save. Όταν άλλαζε τον τύπο, το `handleTypeChange` καλούσε `onAutoSaveFields({ type, name, ... })` → Firestore persist → `onSnapshot` επανεξέπεμπε το `property` prop → ο naive `useEffect(() => setFormData({...property mapping}), [property])` ΞΑΝΑΕΓΡΑΦΕ και τα 28 flat fields με τις παλιές Firestore τιμές. Όλες οι non-saved user edits χάνονταν. UX broken.
  - **Root cause**: Το παλιό effect στο `PropertyFieldsBlock.tsx:255-287` είχε ref-pattern (`prevServerCodeRef/NameRef/TypeRef`) ΜΟΝΟ για code/name/type (conditional spread). Τα υπόλοιπα 25 πεδία γράφονταν unconditionally σε κάθε `property` change — αρκετό ένα auto-save round-trip για να ξηλωθεί ολόκληρη η μη-αποθηκευμένη editing session.
  - **Created**: `src/services/property/property-form-sync.ts` — pure SSoT helpers `buildFormDataFromProperty(property)` + `diffServerSnapshot(prev, next)`. Primitives equality με `Object.is`, arrays/objects (`orientations`, `flooring`, `interiorFeatures`, `securityFeatures`, `levels`, `levelData`) με structural (JSON) equality για να ανέχονται fresh references από Firestore `onSnapshot`. Testable, server-safe, 9 unit tests (structural diff, fresh-ref tolerance, single + multi field changes, local-edit preservation, array content changes, levelData object changes).
  - **Created**: `src/hooks/properties/usePropertyFormSync.ts` — React hook με δύο refs (`prevPropertyIdRef`, `prevServerSnapshotRef`). On `property` change: (1) card-switch (id changed) → full `setFormData(snapshot)` + snapshot refresh · (2) in-place update (same id) → `diffServerSnapshot(prev, next)` → `setFormData(p => ({ ...p, ...patch }))` μόνο για πεδία που ο server άλλαξε.
  - **Refactored**: `PropertyFieldsBlock.tsx` (459→397 γραμμές, -62). Απαλοιφή `prevServerCodeRef/NameRef/TypeRef` + useEffect 255-287 (31 γραμμές). `useState(() => buildFormDataFromProperty(property))` για DRY initial state. `usePropertyFormSync(property, setFormData)` single-line integration. Απαλοιφή unused `OperationalStatus` import.
  - **Google contract**: type (και οποιοδήποτε άλλο πεδίο) είναι ορθογώνιο στα υπόλοιπα — αλλαγή type δεν σβήνει areas/layout/orientations/finishes. Μόνο `levels`/`levelData` reconciliate (Batch 22 — ADR-236 Phase 5). Concurrent server edits (άλλο device, AI pipeline, cron job) εξακολουθούν να προπαγάρονται per-field — μηδενικό trade-off vs minimal `[property.id]` dep shortcut.
  - **SSoT**: Όλη η server→form sync logic σε ένα pure module + ένα thin hook. Δεύτερος component που χρειαστεί ίδιο pattern (π.χ. BuildingFieldsBlock, ProjectFieldsBlock) → `usePropertyFormSync`-style reuse ή γενίκευση σε `useDocumentFormSync<T>(doc, setForm, buildSnapshot)`.
  - **Out of scope για V1**: per-field "user-dirty" tracking με Map<string, boolean> (verbose, 28 keys, reset-on-save bug surface). `react-hook-form` migration (overkill V1, διατηρεί pattern uniformity με υπόλοιπο codebase). Generic `useDocumentFormSync<T>` abstraction (YAGNI — single caller, εξαχθεί αν εμφανιστεί 2ος).
