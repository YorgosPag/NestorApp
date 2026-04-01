# ADR-269: Unit to Property Rename — Naming Standardization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-03-31 |
| **Category** | Entity Systems |
| **Canonical Location** | `src/types/property.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Context

Η εφαρμογή χρησιμοποιεί τρεις διαφορετικούς όρους για την ίδια οντότητα (ακίνητο μέσα σε κτίριο):

### The Problem

- **"Unit"** — στα types (`src/types/unit.ts`), Firestore collection (`units`), services (`units.service.ts`)
- **"Property"** — στα components, navigation, i18n (`properties.json`)
- **"Apartment"** — στα routes (`/spaces/apartments`), sidebar labels, sales pages

Αυτό δημιουργεί:
- Σύγχυση σε developers (ποιον όρο χρησιμοποιώ πού;)
- Ασυνέπεια στο codebase (3 type files για το ίδιο πράγμα)
- Πρόβλημα onboarding όταν μπουν εξωτερικοί συνεργάτες
- Τεχνικό χρέος που αυξάνεται με κάθε νέο feature

### Industry Standard

| Platform | Term Used |
|----------|-----------|
| Google Real Estate | Property |
| Procore | Property |
| Salesforce Real Estate | Property |
| Yardi | Property / Unit (unit = subunit of property) |
| AppFolio | Property |

---

## 2. Decision

**Υιοθέτηση "Property" ως canonical term παντού στο codebase.**

### Naming Convention

| Πριν | Μετά |
|------|------|
| Unit (interface) | Property |
| UnitType | PropertyType |
| UnitDoc | PropertyDoc |
| UnitModel | PropertyModel |
| UnitCommercialData | PropertyCommercialData |
| UnitCoverage | PropertyCoverage |
| UnitLevel | PropertyLevel |
| UnitSortKey | PropertySortKey |
| units (Firestore collection) | properties |
| COLLECTIONS.UNITS | COLLECTIONS.PROPERTIES |
| generateUnitId() | generatePropertyId() |
| /api/units | /api/properties |
| /spaces/apartments | /spaces/properties |
| /sales/available-apartments | /sales/available-properties |

### Hierarchy (δεν αλλάζει)

```
Project → Building → Floor → Property (πρώην Unit), Storage, Parking
```

### What "Apartment" becomes

"Apartment" γίνεται **μόνο τιμή** του `PropertyType` enum:
```typescript
type PropertyType = 'apartment' | 'apartment_1br' | 'apartment_2br' | 'apartment_3br' | 'studio' | 'maisonette' | 'penthouse' | 'loft' | 'detached_house' | 'villa' | 'shop' | 'office' | 'hall' | 'storage';
```

### Canonical Source

```
src/types/property.ts          — Core type definitions
src/services/properties.service.ts — Data service
src/config/firestore-collections.ts — COLLECTIONS.PROPERTIES
```

### What does NOT change

| Item | Reason |
|------|--------|
| `src/config/procurement-units.ts` | BOQ measurement units — different concept |
| `src/types/boq/units.ts` | BOQ measurement units — different concept |
| `storage_units` Firestore collection | Different entity (storage spaces) |
| Firestore subcollection values (photos, documents, history) | Only TS constant names change |
| PropertyType values (apartment, maisonette, etc.) | These are property subtypes, correct as-is |

---

## 3. Consequences

### Positive

- Single term for single concept across entire codebase
- Industry-standard naming (Google, Procore, Salesforce pattern)
- Eliminates 3 duplicate type files → 1 canonical source
- Clear onboarding for new developers
- Clean URL structure (/properties, /api/properties)

### Negative

- ~120 files affected (mechanical rename)
- Firestore collection rename requires data recreation (test data only)
- One-time large diff in git history

---

## 4. Prohibitions (after this ADR)

- **"Unit"** as entity name for real estate properties (σε types, services, routes, components)
- **"Apartment"** as page/route name (μόνο ως `propertyType` value)
- `src/types/unit.ts` — DELETED, replaced by `src/types/property.ts`
- `COLLECTIONS.UNITS` — DELETED, replaced by `COLLECTIONS.PROPERTIES`
- `generateUnitId()` — DELETED, replaced by `generatePropertyId()`
- Any new file/type/route using "unit" for real estate properties

---

## 5. Migration

### Phase 0: ADR Creation
| File | Status | Notes |
|------|--------|-------|
| `ADR-269-unit-to-property-rename.md` | ✅ Created | This file |
| `adr-index.md` | ✅ Updated | Added ADR-269 entry |

### Phase 1: Type System (~5 files)
| File | Status | Notes |
|------|--------|-------|
| `src/types/unit.ts` → `property.ts` | Pending | Split if >500 lines |
| `src/types/property.ts` (legacy) | Pending | DELETE + merge |
| `src/types/property-viewer.ts` | Pending | Update imports |
| `src/constants/unit-features-enterprise.ts` | Pending | Rename |

### Phase 2: Config & Data Layer (~15 files)
| File | Status | Notes |
|------|--------|-------|
| `src/config/firestore-collections.ts` | Pending | UNITS→PROPERTIES |
| `src/services/units.service.ts` | Pending | Rename |
| `src/services/enterprise-id.service.ts` | Pending | generatePropertyId |
| + 12 more config files | Pending | |

### Phase 3-8: Hooks, API, UI, Components, Nav, AI — ✅ COMPLETE
All phases executed. ~200 files renamed (types, services, routes, components, i18n, navigation, AI pipeline).

### Phase 9: Cross-reference Fields Rename — ✅ COMPLETE (2026-04-01)
Renamed all unit cross-reference fields across ~150 files:

| Pattern | Occurrences | Renamed To |
|---------|------------|------------|
| `unitId` (cross-ref field) | ~709 | `propertyId` |
| `selectedUnit` | ~200+ | `selectedProperty` |
| `UNIT_*` constants | ~189 | `PROPERTY_*` |
| `unitName` | ~114 | `propertyName` (where applicable) |
| `unitData/unitDoc` | ~106 | `propertyData/propertyDoc` |
| `linkedUnitIds` | ~50 | `linkedPropertyIds` |
| `SEARCH_ENTITY_TYPES.UNIT` | ~15 | `.PROPERTY` |
| `unitLabel` | ~5 | `propertyLabel` |

**Excluded from rename** (legitimate uses):
- `src/subapps/dxf-viewer/` — measurement units (different concept)
- `src/database/migrations/` — historical migration scripts
- `src/auth/` — deprecated backward-compat aliases
- `src/services/booking-codec.ts` — deprecated alias
- BOQ/procurement units — different concept

### Phase 10: Remaining Type Field Renames — ✅ COMPLETE (2026-04-01)
Renamed all remaining "unit" type fields across ~70 files:

| Field | Rename To | Files Affected |
|-------|-----------|----------------|
| `ProjectCustomer.unitsCount` | `propertiesCount` | ~10 files |
| `ProjectStats.totalUnits` | `totalProperties` | ~40 files |
| `ProjectStats.soldUnits` | `soldProperties` | ~30 files |
| `BuildingStats.totalUnits` | `totalProperties` | ~10 files |
| `BuildingStats.soldUnits` | `soldProperties` | ~10 files |
| `totalUnitsWithPlan` | `totalPropertiesWithPlan` | 3 files |
| `totalUnitsWithoutPlan` | `totalPropertiesWithoutPlan` | 3 files |
| `totalUnitsSold` | `totalPropertiesSold` | 1 file |
| `soldUnitsCount` | `soldPropertiesCount` | 1 file |
| i18n keys (`totalUnits`, `soldUnits`, `unitsCount`) | `totalProperties`, `soldProperties`, `propertiesCount` | 18 JSON + 12 TS files |

**Excluded from rename** (same as Phase 9):
- `src/subapps/dxf-viewer/` — measurement units (different concept)

### Phase 12: Config, Navigation, Firestore Fields & Cleanup — ✅ COMPLETE (2026-04-01)
Comprehensive final rename pass:

| Category | Change | Files |
|----------|--------|-------|
| `NavigationEntityType` | `'unit'` → `'property'` | 1 |
| `NAVIGATION_ENTITIES` key | `unit:` → `property:` | 1 |
| `NAVIGATION_ENTITIES.unit` usages | → `.property` | ~70 |
| `UnitIcon` / `unitColor` variables | → `PropertyIcon` / `propertyColor` | ~50 |
| `ENTITY_ASSOCIATION_ROLES.unit` | → `.property` | 1 |
| `UnitRole` type | → `PropertyRole` | 3 |
| Firestore field `unitCoverage` | → `propertyCoverage` | ~8 |
| Firestore field `unitAmenities` | → `propertyAmenities` | ~3 |
| Firestore field `unitName` | → `propertyName` | ~6 |
| i18n locale keys | ~70 `unit.*` keys → `property.*` | 4 JSON files |
| Collection literals `=== 'units'` | → `=== 'properties'` | 3 |
| Deprecated aliases deleted | `UnitOwner`, `UnitGrant`, `UnitListCard`, `UnitGridCard` | 4 |
| `ProjectsService-broken.ts` | DELETED (unused) | 1 |

### Phase 11: PascalCase Type Names Rename — ✅ COMPLETE (2026-04-01)
Renamed remaining PascalCase "Unit" type names to "Property" across ~20 files:

| Old Name | New Name | Files Affected |
|----------|----------|----------------|
| `UnitItem` | `PropertyItem` | 2 (floorplan-import-types.ts, useFloorplanImportState.ts) |
| `UnitSummary` | `PropertySummary` | 4 (brokerage-form-types.ts, useBrokerageAgreements.ts, BrokerageInlineForm.tsx, index.ts) |
| `UnitData` | `PropertyData` | 1 (GenericPropertiesTabsRenderer.tsx) |
| `AggregatedUnitData` | `AggregatedPropertyData` | 1 (multi-level.service.ts) |
| `UnitsApiResponse` | `PropertiesApiResponse` | 3 (LinkedSpacesCard.tsx, useCustomerInfo.ts, navigationApi.ts) |
| `UnitsListSuccess/Error/Response` | `PropertiesListSuccess/Error/Response` | 1 (api/properties/route.ts) |
| `UnitFloorplanTabContentProps` | `PropertyFloorplanTabContentProps` | 1 (ReadOnlyMediaSubTabs.tsx) |
| `UnitFilterState` | `PropertyListFilterState` (+ deprecated alias) | 3 (types.ts, configs.ts, index.ts) |
| `UnitsTabConfig` | `PropertiesTabConfig` (+ deprecated alias) | 1 (GenericPropertiesTabsRenderer.tsx) |
| `unitOwners` (variable) | `propertyOwners` | 3 (SaleInfoContent.tsx, SellDialog.tsx, SalesPropertyListCard.tsx) |
| `UnitBadgeProps` | deprecated alias → `PropertyBadgeProps` | 1 (BadgeTypes.ts) |

**Not renamed** (different concepts or would cause type conflicts):
- `UnitStatus` — Different type from `PropertyStatus` (parking/storage badge domain)
- `UnitBadge` component — Tied to UNIT badge domain (parking/storage)
- `UnitsApiResponse` in dxf-viewer — Excluded directory
- `StorageUnit*` types — Different entity

### Phase 13: DXF Overlay Kind + BOQ Scope — ✅ COMPLETE (2026-04-01)

Renamed `'unit'` string literal values to `'property'` in DXF overlay system and BOQ scope types.

#### A. DXF Overlay Kind: `kind: 'unit'` → `kind: 'property'`

| File | Change |
|------|--------|
| `src/subapps/dxf-viewer/overlays/types.ts` | OverlayKind type + KIND_LABELS key |
| `src/subapps/dxf-viewer/components/useFloorplanImport.ts` | getTypeLabel key |
| `src/hooks/useFloorOverlays.ts` | fallback `kind ?? 'property'` |
| `src/domain/cards/overlay/OverlayListCard.tsx` | KIND_TO_ENTITY key |
| `src/i18n/locales/en/dxf-viewer.json` | `kindLabels.property`, `floorplanTypes.property` |
| `src/i18n/locales/el/dxf-viewer.json` | `kindLabels.property`, `floorplanTypes.property` |

Other DXF files (OverlayProperties, useDxfPipeline, useEntityStatusResolver, etc.) were already updated by a parallel agent.

#### B. BOQ Scope: `scope: 'unit'` → `scope: 'property'`

| File | Change |
|------|--------|
| `src/types/boq/boq.ts` | `BOQItem.scope`, `CreateBOQItemInput.scope`, `BOQFilters.scope` |
| `src/hooks/useBOQItems.ts` | `BOQUIFilters.scope` |
| `src/components/building-management/tabs/MeasurementsTabContent/useBOQEditorState.ts` | scope check |
| `src/components/building-management/tabs/MeasurementsTabContent/BOQItemEditor.tsx` | radio value + scope checks |

**Firestore note**: Dev data only — existing documents with old values will not match (recreate test data).

---

## 6. References

- Related: [ADR-017](./ADR-017-enterprise-id-generation.md) — Enterprise ID Generation (unit prefix → property)
- Related: [ADR-025](./ADR-025-unit-linking-system.md) — Unit Linking System (rename to Property Linking)
- Related: [ADR-210](./ADR-210-document-id-audit.md) — Document ID Audit
- Industry: Google Real Estate API naming conventions
- Industry: Procore API v1 property management terminology

---

## 7. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-03-31 | ADR Created — Naming standardization approved | Γιώργος Παγώνης + Claude Code |
| 2026-03-31 | Status: APPROVED — Begin phased implementation | Γιώργος Παγώνης |

---

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-31 | ADR created | Claude Code |
| 2026-04-01 | Phase 1: Implementation complete — all 8 phases executed, ~200 files renamed (types, services, routes, components, i18n, navigation, AI pipeline). | Claude Code |
| 2026-04-01 | Phase 2: Cross-reference fields rename — unitId→propertyId, unitName→propertyName, selectedUnit→selectedProperty, UNIT_*→PROPERTY_* constants, and ~30 other patterns across ~150 files. Clean rename (no backward-compat mapping — dev data only). Remaining `unitId` refs are: dxf-viewer (measurement units), database migrations (historical), auth layer (deprecated aliases), booking-codec (deprecated alias). | Claude Code |
| 2026-04-01 | Phase 2 fix: Fixed ~15 remaining TS errors from rename — linkedUnitIds→linkedPropertyIds in AI pipeline (14 files), SEARCH_ENTITY_TYPES.UNIT→.PROPERTY, onSelectUnit→onSelectProperty, unitLabel→propertyLabel, OverlayEntity.linked.unitId→propertyId, ResolvedContact.linkedUnitIds→linkedPropertyIds. Documented Phase 10 (pending 70-file type field renames). | Claude Code |
| 2026-04-01 | Phase 10: Renamed remaining type fields — unitsCount→propertiesCount, totalUnits→totalProperties, soldUnits→soldProperties, BuildingStats fields, payment report fields, i18n keys+values across ~70 files (types, services, API routes, components, hooks, 18 JSON locale files). All phases complete. | Claude Code |
| 2026-04-01 | Phase 11: PascalCase type names — UnitItem→PropertyItem, UnitSummary→PropertySummary, UnitData→PropertyData, UnitsApiResponse→PropertiesApiResponse, UnitsListSuccess/Error/Response→PropertiesListSuccess/Error/Response, UnitFloorplanTabContentProps→PropertyFloorplanTabContentProps, UnitFilterState→PropertyListFilterState (deprecated alias kept), unitOwners→propertyOwners across ~20 files. UnitStatus/UnitBadge kept (different concept: parking/storage badge domain). | Claude Code |
| 2026-04-01 | Phase 12: Config & Navigation — NavigationEntityType `'unit'`→`'property'`, NAVIGATION_ENTITIES key `unit`→`property`, ENTITY_ASSOCIATION_ROLES key `unit`→`property`, UnitRole→PropertyRole, GroupedContactEntityLinks.units→.properties. Firestore fields: unitCoverage→propertyCoverage, unitAmenities→propertyAmenities, unitName→propertyName (dev data only, no migration). i18n: ~70 locale keys renamed in en/el navigation.json + common.json. NAVIGATION_ENTITIES.unit→.property + UnitIcon→PropertyIcon + unitColor→propertyColor across ~70 component/feature/app files. Deleted UnitOwner/UnitGrant deprecated aliases, deleted ProjectsService-broken.ts, deleted deprecated UnitListCard/UnitGridCard exports. Collection literals `'units'`→`'properties'` in ownership services. | Claude Code |
| 2026-04-01 | Phase 13: DXF Overlay Kind + BOQ Scope — OverlayKind `'unit'`→`'property'` (types, KIND_LABELS, i18n en/el dxf-viewer.json), BOQ scope type `'unit'`→`'property'` (boq.ts, useBOQItems.ts, useBOQEditorState.ts, BOQItemEditor.tsx), useFloorOverlays fallback, OverlayListCard KIND_TO_ENTITY key. ~14 files. Dev data only — no Firestore migration. | Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
