# ADR-280: i18n Namespace Splitting Implementation Plan

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-04-03 |
| **Category** | Infrastructure / i18n |
| **Parent ADR** | ADR-279 (Google-Grade i18n Governance) |
| **Canonical Location** | `src/i18n/locales/` |
| **Author** | Georgios Pagonis + Claude Code |

---

## 1. Context

### 1.1 Background

ADR-279 established the governance model for Google-grade i18n. This ADR provides the **concrete implementation plan** for the most critical action: splitting oversized namespace files.

### 1.2 Current State Analysis (2026-04-03)

**System Overview:**
- 49 namespaces across 3 locales (el, en, pseudo)
- Full locale parity achieved
- `namespace-manifest.json` defines budgets per namespace
- `namespace-compat.ts` provides backward-compatible key remapping
- Lazy loading via `lazy-config.ts` with webpack dynamic imports

**14 of 49 namespaces exceed their budget:**

| Namespace | Lines (EN) | Budget | Factor | Domain Mixing |
|-----------|-----------|--------|--------|---------------|
| building | 2,391 | 700 | 3.4x | SEVERE |
| common | 2,177 | 700 | 3.1x | SEVERE |
| dxf-viewer | 1,845 | 700 | 2.6x | HIGH |
| report-builder-domains | 1,572 | 600 | 2.6x | NONE (data) |
| contacts | 1,565 | 700 | 2.2x | HIGH |
| projects | 1,290 | 600 | 2.2x | MODERATE |
| payments | 985 | 600 | 1.6x | MODERATE |
| geo-canvas | 882 | 600 | 1.5x | LOW |
| crm | 837 | 600 | 1.4x | LOW |
| accounting | 819 | 600 | 1.4x | LOW |
| files | 675 | 600 | 1.1x | LOW |
| navigation | 635 | 600 | 1.1x | LOW |
| reports | 625 | 600 | 1.04x | LOW |
| tool-hints | 601 | 600 | 1.0x | NONE (data) |

### 1.3 What Google Would Do

Google separates translation catalogs by **bounded context** AND **string class**. Their standards:

1. **Single Responsibility:** Each catalog = 1 product surface + limited string classes
2. **Budget Enforcement:** Max 500-600 keys per catalog (hard limit, CI-enforced)
3. **String Class Separation:** UI chrome, domain vocabulary, forms, validation, notifications, long-form help -- never all mixed in one file
4. **Lazy Loading:** Only load what the current view needs
5. **Zero-Downtime Migration:** Compatibility layers remap old keys to new catalogs
6. **Incremental Splits:** One namespace per commit, each independently deployable

### 1.4 Domain Mixing Analysis

**building.json (SEVERE):**
- `tabs` key = 32,436 chars (timeline, analytics, floors, measurements, photos, contracts, storage, map -- all different domains)
- `storage*` keys = ~6,000 chars (separate business domain: warehouse management)
- `address` = 2,481 chars (cross-cutting concern shared with contacts, projects)
- `parkings*` = ~590 chars (separate business domain: parking management)
- `photos` = 811 chars (media management concern)
- `analytics` = 314 chars (reporting/BI concern)

**common.json (SEVERE):**
- `sales*` keys = 15,851 chars (372+ keys -- **entire e-commerce domain** in "common"!)
- `ownership` = 5,234 chars (access control domain)
- `account` = 4,920 chars (user account management)
- `contacts` = 3,778 chars (CRM concern in common)
- `spaces` = 2,616 chars (property management concern)
- `twoFactor` = 1,524 chars (security/auth concern)

**contacts.json (HIGH):**
- `relationships` = 7,406 chars (deep domain: family/professional networks)
- `persona` = 5,079 chars (sales/CRM personas -- different domain)
- `identityImpact` = 3,473 chars (KYC/compliance concern)
- `bankingTab` = 2,660 chars (financial data -- different domain)
- `individual` = 3,324 chars (natural person details)

**dxf-viewer.json (HIGH):**
- `settings` = 5,772 chars (8+ sub-settings categories mixed)
- `promptDialog` = 3,780 chars (AI assistant UI)
- `tools` = 2,772 chars (drawing tools)
- `rulerSettings` = 2,059 chars (measurement feature)
- `layerManager` = 1,639 chars (layer management feature)

**projects.json (MODERATE):**
- `ika` = 9,097 chars (329 keys -- **entire IKA labor compliance domain**)
- `impactGuard` = 3,705 chars (deletion impact analysis)
- `dialog` = 1,839 chars (various dialog UIs)
- `address` = 1,558 chars (cross-cutting addressing)

**payments.json (MODERATE):**
- `costCalculator` = 37,416 chars (**massive** construction cost calculator -- separate feature)
- `loanTracking` = 2,166 chars (loan management feature)
- `chequeRegistry` = 1,711 chars (cheque management feature)

---

## 2. Decision

Split oversized namespaces in **4 phases**, producing ~28 new namespaces. Each phase is independently deployable with zero-downtime via `namespace-compat.ts`.

---

## 3. Implementation Plan

### Phase 1: CRITICAL -- building.json + common.json

**Priority:** Immediate. These 2 files account for 4,568 lines and both exceed 3x their budget.

#### 3.1A building.json (2,391 lines --> 6 namespaces)

| New Namespace | Top-Level Keys Moving | Est. Lines | String Classes |
|---|---|---|---|
| **building-core** | `header`, `names`, `toolbar`, `categories`, `status`, `accessibility`, `units`, `viewMode`, `card`, `validation`, `details`, `pages`, `list`, `stats`, `customers`, `unitsTable`, `companySelector`, `projectSelector`, `videos`, `placeholder`, `emptyState`, `emptyList`, `dialog`, `listItem`, `error`, `entityLabel`, `filtersDisplay`, `floors`, `connections` | ~550 | ui-chrome, forms |
| **building-filters** | `filters` | ~230 | forms, domain-vocabulary |
| **building-tabs** | `tabs` (except `tabs.timeline`, `tabs.analytics`) | ~450 | ui-chrome, forms |
| **building-timeline** | `tabs.timeline`, `tabs.analytics`, `analytics` | ~560 | ui-chrome, domain-vocabulary |
| **building-storage** | `storage`, `storages`, `storageMap`, `storageSummary`, `storageActions`, `storageListHeader`, `storageTabHeader`, `storageTable`, `storageNotifications`, `storageView`, `storageStats`, `storageForm`, `parkings`, `parkingStats`, `unitStats`, `spaceActions`, `spaceConfirm`, `spaceLink`, `map`, `floorplan` | ~420 | ui-chrome, forms |
| **building-address** | `address`, `associations`, `photos` | ~180 | forms, domain-vocabulary |

**Deviation from manifest:** Manifest targets `building-core`, `building-floors`, `building-filters`, `building-reports`, `building-help`. Actual data does not have natural `reports` or `help` groupings. Instead, `tabs` (32K chars) and `storage*` (6K chars) are the dominant groupings. Manifest `targetNamespaces` must be updated.

**Component impact:** 114 components use `useTranslation('building')`. Zero changes needed on day 1 via compat layer.

#### 3.1B common.json (2,177 lines --> residual + 4 new)

5 sub-namespaces already extracted: `common-actions`, `common-navigation`, `common-status`, `common-validation`, `common-empty-states`. The residual common.json is still 2,177 lines.

| New Namespace | Top-Level Keys Moving | Est. Lines | String Classes |
|---|---|---|---|
| **common-sales** | `sales`, `salesStorage`, `salesParking` | ~480 | ui-chrome, domain-vocabulary |
| **common-account** | `account`, `twoFactor`, `userMenu` | ~210 | ui-chrome, forms |
| **common-photos** | `photo`, `photos`, `photoPreview`, `photoCard`, `photoManager`, `upload` | ~130 | ui-chrome |
| **common-shared** | `toolbar`, `filters`, `contacts`, `customerActions`, `sharing`, `recipients`, `email`, `search`, `ownership`, `workspace`, `productTour`, `voiceAssistant`, `voiceDictation` | ~530 | ui-chrome, notifications |
| **common** (residual) | `buttons`, `periods`, `notifications`, `header`, `accessDenied`, `toast`, `placeholders`, `labels`, `clickableField`, `dropdown`, `richText`, `pdf`, `tooltips`, `favorites`, `success`, `modal`, `share`, `loading`, `groups`, `copy`, `boolean`, `availability`, `quickAdd`, `dropdowns`, `progress`, `headerActions`, `viewMode`, `entityLink`, `entityCode`, `a11y`, `fullscreen`, `autoSave`, `progressiveLoader`, `months`, `deletionGuard`, `versioning`, `doyPicker`, `audit`, `storage`, `contactTypes`, `propertyStatus`, `helpHub`, `communication`, `obligations`, `propertyViewer`, `propertyEditor`, `dxfViewer`, `layerManager`, `priority`, `recordState`, `entityType`, `countries`, `units`, `trends`, `documentStatus`, `validationMessages`, `debug`, `spaces` | ~530 | ui-chrome, domain-vocabulary |

**Rationale for common-sales:** The `sales` key alone is 13,448 chars (372+ keys) -- an **entire e-commerce domain** hiding inside "common". 13 components under `src/components/sales/` use it exclusively. This is the most egregious domain mixing violation.

**Component impact:** 147 components use `useTranslation('common')`. Compat layer handles all. Sales components (13) and account components (6) are the primary direct migration targets.

---

### Phase 2: HIGH -- dxf-viewer.json + contacts.json

#### 3.2A dxf-viewer.json (1,845 lines --> 5 namespaces)

| New Namespace | Top-Level Keys Moving | Est. Lines | String Classes |
|---|---|---|---|
| **dxf-viewer-shell** | `common`, `toolbar`, `toolbarStatus`, `actionButtons`, `loadingStates`, `autoSave`, `confirmations`, `zoomControls`, `overlayToolbar`, `toolLabels`, `toolGroups`, `tools`, `snapModes` | ~290 | ui-chrome |
| **dxf-viewer-panels** | `panels`, `layerActions`, `search`, `mergePanel`, `levelPanel`, `sceneInfo`, `overlayProperties`, `overlayCard`, `overlayList`, `levelCard`, `pdfPanel`, `cadDock`, `layerManager` | ~290 | ui-chrome |
| **dxf-viewer-settings** | `settings`, `lineSettings`, `gridSettings`, `selectionSettings`, `cursorSettings`, `crosshairSettings`, `rulerSettings`, `layersSettings`, `entitiesSettings`, `dxfSettings`, `currentSettings`, `specificSettings`, `dynamicInput` | ~560 | forms |
| **dxf-viewer-wizard** | `wizard`, `wizardProgress`, `import`, `importModal`, `importWizard`, `dxfViewer`, `calibration`, `calibrationStep`, `textTemplates`, `promptDialog`, `entityJoin` | ~370 | ui-chrome, forms |
| **dxf-viewer-guides** | `guidePanel`, `guideGroups`, `guideMenuGroups`, `guideContextMenu`, `guides`, `guideBatchMenu`, `guideAnalysis`, `aiAssistant` | ~140 | long-form-help |

**Component impact:** 81 components. Settings components are the largest group and co-located under `src/subapps/dxf-viewer/ui/components/dxf-settings/`.

#### 3.2B contacts.json (1,565 lines --> 5 namespaces)

| New Namespace | Top-Level Keys Moving | Est. Lines | String Classes |
|---|---|---|---|
| **contacts-core** | `emptyState`, `export`, `import`, `header`, `page`, `list`, `types`, `card`, `stats`, `projects`, `properties`, `details`, `toolbar`, `dialog`, `fields`, `common`, `sections`, `sectionDescriptions`, `creation`, `basicInfo`, `placeholderTab`, `navigation`, `filterBar`, `duplicate` | ~270 | ui-chrome |
| **contacts-form** | `form`, `options`, `identity`, `professional`, `address`, `company`, `employment`, `businessTypes`, `validation`, `submission`, `addressesSection` | ~290 | forms, validation-errors |
| **contacts-relationships** | `relationships`, `communication`, `service`, `individual`, `esco`, `employer`, `persona` | ~570 | domain-vocabulary |
| **contacts-banking** | `bankingTab` | ~65 | forms, domain-vocabulary |
| **contacts-lifecycle** | `trash`, `identityImpact` | ~140 | ui-chrome, notifications |

**Deviation from manifest:** Manifest targets `contacts-form`, `contacts-relationships`, `contacts-status`, `contacts-trash`, `contacts-help`. Actual data groups better as: core, form, relationships, banking, lifecycle. No natural `status` or `help` groupings exist.

**Component impact:** 68 components. Relationship components (~25) are the most concentrated.

---

### Phase 3: MEDIUM -- projects.json + payments.json

#### 3.3A projects.json (1,290 lines --> 3 namespaces)

| New Namespace | Top-Level Keys Moving | Est. Lines | String Classes |
|---|---|---|---|
| **projects-core** | `title`, `description`, `status`, `emptyState`, `projectHeader`, `header`, `toolbar`, `card`, `messages`, `page`, `list`, `viewSwitch`, `grid`, `detailsHeader`, `listCard`, `filters`, `stats`, `toolbarGroups`, `rowActions`, `progressBlock`, `projectProgress`, `search`, `projectType`, `priority`, `riskLevel`, `complexity`, `empty`, `table`, `editToolbar`, `dialog`, `common`, `documents`, `cards`, `impactGuard` | ~540 | ui-chrome, forms |
| **projects-data** | `plot`, `timelineTab`, `timeline`, `structure`, `buildings`, `metrics`, `customers`, `errors`, `financial`, `parking`, `permits`, `plotZoning`, `units`, `basicInfo`, `permitsTab`, `videosTab`, `contributorsTab`, `attachmentsTab`, `documentsTab`, `plotDataTab`, `otherDataTab`, `statsGrid`, `generalTab`, `buildingDataTabs`, `parkingManagement`, `actualBuildingData`, `buildingData`, `address`, `locations`, `measurements` | ~380 | forms, domain-vocabulary |
| **projects-ika** | `ika` | ~370 | domain-vocabulary, forms |

**Rationale for projects-ika:** The `ika` key is 9,097 chars (329 keys) -- an **entire IKA labor compliance domain** with its own UI surface at `src/components/projects/ika/`. Single Responsibility demands extraction.

**Component impact:** 89 components. ~25 IKA components are the cleanest migration target.

#### 3.3B payments.json (985 lines --> 3 namespaces)

| New Namespace | Top-Level Keys Moving | Est. Lines | String Classes |
|---|---|---|---|
| **payments-core** | `title`, `paymentPlan`, `installments`, `installmentType`, `paymentMethod`, `actions`, `labels`, `milestones`, `templates`, `wizard`, `dialog`, `report`, `alerts`, `portfolio`, `maturity`, `variance`, `errors`, `taxRegime`, `loan` | ~250 | ui-chrome, forms |
| **payments-loans** | `loanTracking`, `chequeRegistry` | ~155 | domain-vocabulary |
| **payments-cost-calc** | `costCalculator` | ~580 | domain-vocabulary, forms |

**Note:** `costCalculator` at 37,416 chars is a massive single-feature domain (construction cost calculation). It is within budget as a single coherent feature.

**Component impact:** 21 components. Clean 1:1 mapping between features and namespaces.

#### 3.3C report-builder-domains.json -- BUDGET EXEMPT

This file (1,572 lines) contains only 2 top-level keys: `groups` (10 lines) and `domains` (~1,561 lines of pure field name vocabulary). Per CLAUDE.md, **config/data files are exempt from the 600-line budget**. Action: Mark as `budgetExempt: true` in manifest. No split needed.

---

### Phase 4: LOW -- Borderline Namespaces

These are 1.0x-1.5x over budget. Optional splits, can be deferred indefinitely.

| Namespace | Lines | Recommended Action |
|---|---|---|
| geo-canvas (882) | Extract `drawingInterfaces` + `hardcodedTexts` into `geo-canvas-drawing` (~180). Residual: ~700 |
| crm (837) | Extract `calendarPage` + `inbox` into `crm-inbox` (~290). Residual: ~550 |
| accounting (819) | Extract `setup` + `reconciliation` into `accounting-setup` (~235). Residual: ~585 |
| files (675) | Minor overage. Extract `floorplan*` + `media` into `files-media` (~115). Residual: ~560 |
| navigation (635) | Extract `entities` + `filters` into `navigation-entities` (~170). Residual: ~465 |
| reports (625) | Extract `crm` + `spaces` into `reports-extended` (~155). Residual: ~470 |
| tool-hints (601) | 1 line over budget. Pure long-form-help data. Mark `budgetExempt: true`. No split. |

> **2026-10-03 — δεύτερη διάσπαση του `navigation` (ADR-744 §26).** Οι ρίζες της σελίδας του ιεραρχικού
> πλοηγητή (`dialogs` · `tree` · `columns` · `buildingSpaces` · `modals` · `page` · `mobile`) έφυγαν στο νέο
> lazy `hierarchy-navigator`, **χωρίς** compat remap (απευθείας μετάβαση των 8 καταναλωτών· ADR-798 §13). Κριτήριο
> εδώ δεν ήταν το όριο γραμμών αλλά το **byte budget του κελύφους**: το `navigation` ταξιδεύει ολόκληρο σε κάθε διαδρομή.

---

## 4. Infrastructure Changes

### 4.1 Per-Split Checklist

For each namespace split, these files must be updated:

1. **Create JSON files** in `src/i18n/locales/{el,en,pseudo}/[new-namespace].json` (3 files per new namespace)
2. **Update `lazy-config.ts`**: Add to `SUPPORTED_NAMESPACES` + add `case` branch per language
3. **Update `namespace-compat.ts`**: Add legacy key remapping for the split parent
4. **Update `namespace-manifest.json`**: Add new namespace entry with budget + owner
5. **Remove keys from source JSON** (3 locales)
6. **Run `npm run validate:i18n`** to confirm no key loss
7. **Regenerate types**: `npm run generate:i18n-types`

### 4.2 namespace-compat.ts Refactoring

Current implementation chains hardcoded namespaces. Must refactor to:

```typescript
const LEGACY_NAMESPACES = [
  'common', 'properties', 'building', 'dxf-viewer', 
  'contacts', 'projects', 'payments'
] as const;

export function remapLegacyTranslationKey(key: string, options?: unknown) {
  for (const ns of LEGACY_NAMESPACES) {
    const result = remapNamespaceKey(ns, key, options);
    if (result.key !== key || result.options !== options) return result;
  }
  return { key, options };
}
```

### 4.3 config.ts Critical Namespaces

Replace monolithic preloads with core variants:
- `'building'` --> `'building-core'`
- `'dxf-viewer'` --> `'dxf-viewer-shell'`
- `'contacts'` --> `'contacts-core'`
- `'projects'` --> `'projects-core'`

This reduces initial bundle by ~60% for these namespaces.

### 4.4 lazy-config.ts Scale

Phase 1-3 adds ~23 new namespaces. Each requires 2 `case` branches (el + en) = ~46 new case statements. This is mechanical but verbose due to explicit webpack imports. Future optimization: refactor to parameterized dynamic import.

---

## 5. Zero-Downtime Strategy

1. **Day 0:** `namespace-compat.ts` remaps all old keys to new namespaces automatically
2. **Day 0:** All 1,138+ components with `useTranslation` continue working unchanged
3. **Day 1-N:** Gradual migration of `useTranslation('building')` --> `useTranslation('building-core')` in individual components
4. **Post-migration:** Remove compat entries when all consumers are migrated

**Execution rule:** Each split = 1 atomic commit. Never split 2 namespaces in the same commit.

---

## 6. Impact Summary

| Phase | New Namespaces | Components via Compat | Direct Changes Day 1 |
|---|---|---|---|
| Phase 1 (CRITICAL) | 10 | 261 | 0 |
| Phase 2 (HIGH) | 10 | 149 | 0 |
| Phase 3 (MEDIUM) | 6 | 110 | 0 |
| Phase 4 (LOW) | ~7 | ~200 | 0 |
| **Total** | **~33** | **~720** | **0** |

---

## 7. Success Criteria

After full implementation:

- [x] No namespace file exceeds 600 lines (except budget-exempt data files) — 7 borderline namespaces within warnOnly budgets
- [x] Each namespace has single-purpose ownership (no domain mixing)
- [x] `namespace-compat.ts` provides 100% backward compatibility — LEGACY_NESTED_MAP + root mappings
- [x] Full el/en/pseudo parity for all new namespaces — 30 x 3 = 90 new files
- [x] `namespace-manifest.json` reflects all new namespaces — 77 entries (sorted)
- [x] `validate:i18n` passes with zero missing keys — 16,317/16,317 keys (100%)
- [x] Generated `types/i18n.ts` includes all new namespaces — regenerated successfully

---

## 8. Consequences

### Positive

- Eliminates domain mixing in the 5 most critical translation files
- Reduces initial bundle size (lazy-load only what each view needs)
- Clear ownership per namespace (building-storage owned by storage team, not building team)
- Unblocks ADR-279 Phase 3 (was blocked on concrete splitting plan)
- Zero-downtime migration via compat layer

### Negative

- ~33 new JSON files to maintain (x3 locales = ~99 files total)
- `lazy-config.ts` grows by ~46 case statements
- `namespace-compat.ts` grows with legacy mappings (temporary, until migration complete)
- Requires discipline to migrate components gradually from legacy namespace to specific

---

## 9. References

- ADR-279: Google-Grade i18n Governance & Localization Operating Model
- `src/i18n/namespace-manifest.json` -- Governance metadata
- `src/i18n/namespace-compat.ts` -- Legacy key remapping
- `src/i18n/lazy-config.ts` -- Dynamic namespace loader
- `src/i18n/config.ts` -- Main i18n configuration
- `src/types/i18n.ts` -- Generated TypeScript types

---

## 10. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-04-03 | ADR created after comprehensive i18n audit. 14 over-budget namespaces identified, 4-phase splitting plan approved | Georgios Pagonis + Claude Code |
| 2026-04-03 | Status APPROVED → IMPLEMENTED. Phases 1-4 completed. 30 new namespaces created (90 JSON files across 3 locales). Validation: 16,317/16,317 keys (100%). Manifest: 77 namespaces. Types regenerated. namespace-compat.ts enhanced with LEGACY_NESTED_MAP. lazy-config.ts: 60 new case branches | Georgios Pagonis + Claude Code |
| 2026-04-07 | Post-implementation audit: 78 namespaces (was 49 pre-split), 17,245 keys total, 100% EL/EN/pseudo parity. BUG: `communications` namespace registered in lazy-config.ts but MISSING from namespace-loaders.ts — 4 components affected (TelegramNotifications, CommunicationsIntegration, CommunicationsHistory, useCommunicationsHistory). Fix: add 2 case entries to getElLoader() and getEnLoader() | Claude (Opus 4.6) + Georgios Pagonis |
| 2026-04-08 | BUGFIX: `useTranslation.ts` compat remap was NOT passing `options` (count, interpolation vars) to `remapLegacyTranslationKey()`. Result: `{{count}}` rendered literally instead of interpolated value in ALL remapped keys. One-line fix: pass `optionsOrDefault` as second argument. Affected: every `t()` call using interpolation in a split namespace (contacts-lifecycle, building-storage, etc.) | Claude (Opus 4.6) + Georgios Pagonis |
| 2026-04-20 | BUGFIX: `namespace-compat.ts` compat map for `contacts.individual` pointed to `contacts-core` but the actual keys (`individual.sections.*`, `individual.fields.*`, `individual.helpTexts.*` — basicInfo/identity/professional/address/communication/photo/banking/relationships/files/history + all first/last/fatherName/… fields + helpTexts) live in `contacts-relationships.json`. `contacts-core.json` + `contacts.json` only had an orphan partial `individual.sections.{projectParticipation, photoShareHistory}` block (the latter never read via the `individual.*` prefix — consumer uses `photoShareHistory.*` directly). Result: every label in `/contacts` → Individual form rendered as literal key (`individual.sections.basicInfo.title` instead of `Βασικά Στοιχεία`). One-line fix: `individual: 'contacts-core'` → `individual: 'contacts-relationships'`. Zero blast on `projectParticipation` (present in `contacts-relationships.json` with identical shape) or `photoShareHistory` (orphan, never routed through `individual.*`). Golden fixtures + registry ratchet unaffected. | Claude (Opus 4.7 1M) + Georgios Pagonis |
| 2026-04-20 | BUGFIX: `/spaces/properties` (+`/sales/available`, `/sales/sold`) rendered `filters.from`, `filters.to`, `units.operationalStatus.*` as literal keys. Root cause **two independent misroutings**: (1) `propertyListFiltersConfig.i18nNamespace: "properties"` but all labels (`FT`/`SP`/`FL`/`AFO`/`PROPERTY_FILTER_LABELS`) use prefix `filters.*` — resolver stripped `properties.` (not `filters.`) → `t('filters.allStatuses')` on `properties` ns → miss. (2) 5 option labels hardcoded `"units.operationalStatus.*"` but `operationalStatus` lives in `properties-enums.json`, not under `units` in any namespace. (3) `FilterField.tsx` hardcoded `t('filters.from')`/`.to`/`.minimum`/`.maximum`/`.all` on whatever namespace the parent config carried — no namespace's top-level has nested `filters.from`. **Fix**: (a) `i18nNamespace: "properties" → "filters"` in `propertyListFiltersConfig` so `filters.*` labels strip correctly via AdvancedFiltersPanel.translateLabel; (b) rewrote 5 option labels `"units.operationalStatus.X"` → `"properties-enums:operationalStatus.X"` (explicit `ns:key` syntax — i18next resolves cross-namespace, `properties-enums` is preloaded); (c) rewrote 5 hardcoded `t('filters.X')` calls in `FilterField.tsx` to `t('filters:X')` so they work regardless of parent config's default ns. Blast radius: 3 pages using `propertyListFiltersConfig` (Units + Sales Available + Sales Sold) all fixed identically; `FilterField.tsx` change is generic — other consumers (building/project/contact filters) previously showed same literals on range inputs, now fixed too. | Claude (Opus 4.7 1M) + Georgios Pagonis |
| 2026-07-29 | 🔴 **BUGFIX ΚΛΑΣΗΣ — το compat στρώμα ήταν ΝΕΚΡΟ για ολόκληρη τη σύμβαση `ns:key`.** Ο wrapper του `useTranslation.ts` έκρινε την επιτυχία με **`result !== key`**. Όταν όμως το i18next **αστοχεί** σε κλειδί με πρόθεμα namespace (`dxf-viewer:import.warnings.summary`), επιστρέφει το κλειδί **χωρίς** το πρόθεμα (`import.warnings.summary`) — που φυσικά `!== key`. Άρα **κάθε** αστοχία σε `ns:key` περνούσε για **επιτυχία**: (1) το ωμό κλειδί ζωγραφιζόταν στην οθόνη σαν μετάφραση (μετρημένο ζωντανά στο DXF import toast, 2026-07-29) και (2) το `remapLegacyTranslationKey()` **δεν καλούνταν ΠΟΤΕ** για τη σύμβαση `ns:key` — δηλαδή για **όλα** τα `NOTIFICATION_KEYS` (`projects:`, `files:`, `dxf-viewer:` …) και για κάθε ρητό `ns:key` που εισήγαγε η καταχώριση 2026-04-20 παρακάτω. Δεύτερο, ανεξάρτητο: το `fullKey` χτιζόταν ως `${primaryNs}:${key}` **ακόμα κι όταν το key έφερε ήδη πρόθεμα** ⇒ `dxf-viewer:dxf-viewer:import.…`, που δεν ταιριάζει με κανέναν legacy κανόνα — άρα ακόμα κι αν η ανίχνευση αστοχίας ήταν σωστή, το remap θα αστοχούσε. **Fix:** `isUnresolved(result, key)` = «κλειδί **ή** bare-key ⇒ αστοχία», μέσω του **εξαγόμενου πλέον** `getExplicitNamespace()` του `namespace-compat.ts` (SSoT — ο wrapper πρέπει να ερμηνεύει το `:` **ακριβώς** όπως το compat, αλλιώς ξαναγεννιέται η ίδια ασυμφωνία)· κανένα διπλό πρόθεμα· και **dev-only `logger.warn`** (μία φορά ανά κλειδί) που καταγράφει κλειδί + γλώσσα + **ποια namespaces ήταν όντως φορτωμένα** — η μόνη πληροφορία που ξεχωρίζει «λείπει η μετάφραση» από «δεν είχε φορτώσει ακόμα». **Ένα ωμό κλειδί δεν επιτρέπεται πλέον να είναι σιωπηλό.** ⚠️ Το **CHECK 3.13** δεν πιάνει αυτή την κλάση: σαρώνει **μόνο** τον resolver των service forms (`translate-field-value.ts`). Tests: `src/i18n/__tests__/use-translation-prefixed-key-resolution.test.tsx` (4, **mutation-verified** — με `result !== key` το πρώτο πέφτει). Πλήρες σκεπτικό: ADR-635 §Φ C.23 Β. | Claude (Opus 5) + Georgios Pagonis |
| 2026-07-31 | 🔴 **BUGFIX ΚΛΑΣΗΣ — ο ΠΙΝΑΚΑΣ namespaces ΔΕΝ κάνει lookup, μόνο φόρτωση.** Το `useTranslation(['dxf-viewer', …, 'files-media'])` **φόρτωνε** το `files-media` αλλά **κανείς δεν κοίταζε ποτέ μέσα του**: το react-i18next δένει το `t` στο **`namespaces[0]`** και μόνο — `node_modules/react-i18next/dist/commonjs/useTranslation.js:56` → `i18nOptions.nsMode === 'fallback' ? namespaces : namespaces[0]`, και το έργο **δεν** ορίζει `nsMode`. Μετρημένο ζωντανά (Chrome console, `localhost:3000/dxf/viewer`, 2026-07-31): 8 warnings `raw key reached the UI → dxf-viewer:floorplanImport.drawingUnits.*` **με `bundles: [… files-media=loaded]`** — δηλαδή το bundle ήταν φορτωμένο, τα κλειδιά υπήρχαν σε `el`+`en`, και ο χρήστης έβλεπε ωμά κλειδιά στο dialog «Εισαγωγή Αρχείου DXF» (ADR-716 Φ5). **Μέχρι σήμερα το ΜΟΝΟ μονοπάτι προς μη-πρωτεύον ns ήταν το compat remap** — που καλύπτει μόνο **καταγεγραμμένες ρίζες** στον `LEGACY_NAMESPACE_ROOT_MAP`· το `floorplanImport` υπάρχει μόνο κάτω από `files`, όχι κάτω από `dxf-viewer`, άρα το DXF modal έμενε ακάλυπτο. Επιφάνεια: **733 αρχεία** καλούν `useTranslation([...])` με πίνακα. **Fix:** `resolveAcrossNamespaces()` στο `useTranslation.ts` — δίχτυ **τελευταίας γραμμής** που ρωτά ρητά (`ns:key`) κάθε άλλο ns του πίνακα, **αφού** αποτύχουν και το primary και το compat, δηλαδή ακριβώς εκεί όπου σήμερα ζωγραφιζόταν ωμό κλειδί ⇒ **μηδενική επιφάνεια παλινδρόμησης by construction**· η σειρά του πίνακα παραμένει η σειρά προτεραιότητας. ⚠️ **ΜΗΝ** το αντικαταστήσεις με καθολικό `nsMode: 'fallback'` στο init: εκείνο τρέχει **πριν** το compat remap και μπορεί να αλλάξει την επίλυση κλειδιών που σήμερα δουλεύουν μέσω compat. ⚠️ Κανένα static gate δεν έπιανε αυτή την κλάση: το `resolver-reach:audit` (CHECK 3.13) βγήκε **καθαρό** στα ίδια κλειδιά, και το `validate:i18n` τα μετρά ως υπαρκτά — «το κλειδί υπάρχει» ≠ «κάποιος το ψάχνει εκεί που ζει». Tests: `use-translation-prefixed-key-resolution.test.tsx` 4 → **7**, **mutation-verified** (πρόωρο `return undefined` στο `resolveAcrossNamespaces` ⇒ πέφτει **μόνο** το νέο πρώτο test, τα 6 μένουν πράσινα). Οπτική επαλήθευση: το dialog δείχνει «Μονάδες Σχεδίου DXF / Αυτόματα / Μέτρα (m) / …» και **0** warnings `raw key`. | Claude (Opus 5) + Georgios Pagonis |
| 2026-10-30 | 🗂️ **ΜΙΑ ΔΗΛΩΣΗ ΟΙΚΟΓΕΝΕΙΑΣ — CHECK 3.108 (§11).** Οι ~650 χειρόγραφες λίστες «γονέας + όλα τα splits» (10 οικογένειες) αναδιατυπώθηκαν σε `useTranslation('P')` με codemod **που αποδεικνύει την ισοδυναμία ανά κλήση** (654/654 ζεύγη ξαναποδείχθηκαν από το git diff). Νέα πύλη ⛔ Κ1-Κ3 + 🔴 ratchet `order-bearing` (5). Πλήρες σκεπτικό: §11. | Claude (Opus 5.5) + Georgios Pagonis |
| 2026-10-30 | 🧩 **§11.8 Β4.1 — `defineLazySurfaces`**: οι τεμπέλικες επιφάνειες περνούν από την ΙΔΙΑ μηχανή με τις διαδρομές (ένας πυρήνας chunk, ένας βρόχος, ένας χάρτης, ένα πεδίο config)· νέος έλεγχος «καλών `defineLazy*` εκτός μητρώων ⇒ άρνηση» σε γεννήτορα + Layer 1. Χάρτης/σφράγιση αμετάβλητα. Πλήρες: §11.8 · ADR-744 §33.2. | Claude (Opus 5.5) + Georgios Pagonis |
| 2026-10-31 | 🩺 **§11.8 Β4.3 — οι θεραπείες**: 0 dxf τριάδες με εκκίνηση χωρίς dxf (ήταν 93)· 5 σελίδες + harness από μητρώο· `SalesReserveDialog` / `PropertyDossierTab` επιφάνειες· **κανόνας Ρ** (import() στόχου εγγραφής εκτός μητρώου ⇒ άρνηση) + `preload()` από τον ίδιο πυρήνα. Εισδοχή 400→321· Κ2 57→77 (ρητό «ναι»). Πλήρες: §11.8 · ADR-744 §33.4. | Claude (Opus 5.5) + Georgios Pagonis |

---

## 11. Μία δήλωση οικογένειας namespaces — CHECK 3.108 (2026-10-30)

### 11.1 Το πρόβλημα (μετρημένο)

Η διάσπαση του §3 έγραψε τον χάρτη των splits **μία φορά**: `COMPAT_NAMESPACE_MAP` στο `src/i18n/namespace-compat.ts`.
Τον διαβάζουν ήδη:
- ο hook (`resolveAllNamespaces()` στο `useTranslation.ts`): `useTranslation('building')` ⇒ `building` + 5 splits·
- τα στατικά εργαλεία (`withCompatNamespaces()` / `loadCompatNamespaces()` στο `scripts/lib/i18n-namespace-extract.js`,
  CHECK 3.8 · 3.34).

Παρ' όλα αυτά, σε κάθε component δόθηκε **με αντιγραφή** ολόκληρη η λίστα. Μετρημένο 2026-10-30: **~650 κλήσεις σε
10 οικογένειες**:

| Οικογένεια | Κλήσεις |
|---|---|
| building | 100 |
| dxf-viewer | 96 |
| accounting | 96 |
| files | 85 |
| projects | 70 |
| properties | 60 |
| crm | 59 |
| contacts | 56 |
| payments | 21 |
| common | 10 |

Ένα νέο split θα ήθελε 650 χειρόγραφες αλλαγές, και όποια ξεχνιόταν θα ζωγράφιζε ωμό κλειδί. **Η πηγή υπήρχε· κανείς
δεν τη χρησιμοποιούσε.** Άρα το επίπεδο (α) δεν χρειάστηκε νέο SSoT: χρειάστηκε να σβηστούν οι επαναλήψεις και μια
πύλη να αρνείται την επιστροφή τους.

### 11.2 Πρακτική των μεγάλων

- **i18next / react-i18next / Modern.js:** ένα namespace ανά feature, lazy loading, `keyPrefix`, typed keys μέσω
  `CustomTypeOptions` (selector API από v25.4). Το component ζητά **το namespace του feature**, όχι τη λίστα αρχείων του.
- **i18next-cli:** στατική ανάλυση ανά εμβέλεια `useTranslation`· `extract --ci` αποτυγχάνει σε απόκλιση.
- **Lingui:** ο compiler συλλέγει τα μηνύματα· κάθε component παίρνει αυτόματα μόνο τα δικά του.

Εδώ πηγαίνουμε **ένα βήμα παραπέρα από το i18next-cli**: η πύλη δεν συγκρίνει μόνο δήλωση με κλειδιά, αλλά
**αποδεικνύει ότι η αναδιατύπωση δεν αλλάζει ΚΑΜΙΑ λέξη στην οθόνη** (§11.3) πριν γράψει.

### 11.3 Η απόδειξη ισοδυναμίας: η σειρά είναι σειρά προτεραιότητας

Ο hook ψάχνει με την εξής σειρά:
1. primary (`[0]`)·
2. compat remap·
3. τα υπόλοιπα με τη σειρά του `resolveAllNamespaces()` (δηλωμένα **πριν** τα splits τους).

Άρα το `['P', …splits(P), 'X']` γίνεται `['P', 'X']` και το X περνά **μπροστά** από τα splits. Μετρήθηκαν ~25 κοινά
φύλλα ανάμεσα σε οικογένειες (π.χ. `common` ∩ `properties-detail` = 7) και 3 μέσα σε οικογένεια
(`contacts-core` ∩ `contacts-relationships`).

Το `scripts/lib/i18n-namespace-family/equivalence.js` αποδεικνύει, **για κάθε κλειδί που ΜΠΟΡΕΙ να ζητήσει το
αρχείο**, σε κάθε γλώσσα, ότι το πρώτο namespace που το λύνει μένει το ίδιο, και ότι το σύνολο των φορτωμένων είναι
ίδιο.

Το «τι μπορεί να ζητήσει» το απαντά ο ταξινομητής AST του CHECK 3.34 (`key-extract.js`). Δεν γράφτηκε δεύτερη μηχανή.
Η απάντηση γίνεται «τα πάντα» στις εξής περιπτώσεις:
- **Διαφυγή του `t`** ως τιμή (όρισμα, prop): **190 / 588** αρχεία.
- Ανεπίλυτο κλειδί.
- `defaultValue`.

Δύο επιπλέον κανόνες:
- Κλειδί με ρητό `ns` που το έχει δεν επηρεάζεται από τη σειρά.
- Ένας κόμβος-αντικείμενο μετράει μόνο με `returnObjects`. Τα `building-tabs` και `building-timeline` μοιράζονται
  **μόνο** τον κόμβο `tabs` (§4 `LEGACY_NESTED_MAP`), κανένα φύλλο.

⚠️ **Μάθημα που μετρήθηκε κατά την υλοποίηση:**
- Το πρώτο πέρασμα του codemod δεν έλεγχε τη διαφυγή του `t`.
- Η επανεπαλήθευση όλων των ζευγών από το `git diff` βρήκε **3** αναδιατυπώσεις που η πλήρης απόδειξη δεν
  επιβεβαίωνε. Επανήλθαν.
- Η επανεπαλήθευση είναι πλέον ο κανόνας: 654/654.

### 11.4 Η πύλη (CHECK 3.108 · `docs/gates/3.108.md`)

| | Ερώτηση | Μηχανισμός |
|---|---|---|
| Κ1 | γονέας P **και** split του P (εκτός `[0]`), **αποδεδειγμένα αφαιρέσιμο** | ⛔ ZERO-TOL |
| Κ2 | **όλα** τα splits του P χωρίς τον P | ⛔ ZERO-TOL |
| Κ3 | bundle (`namespace-bundles.ts`) με P χωρίς όλα τα splits του | ⛔ ZERO-TOL |
| order-bearing | Κ1-σχήμα όπου η αφαίρεση θα άλλαζε λέξη | 🔴 RATCHET κατά ταυτότητα (`.i18n-namespace-family-baseline.json`, 5) |

- Το `[0]` δεν μετράει ως split: ορίζει primary (`['common-photos', 'common']` = πρόθεση).
- Το `COMMON_NAMESPACES` **μένει**. Το διαβάζουν μη-hook καταναλωτές (preload αλλαγής γλώσσας, `useLanguagePreference`),
  που **δεν** επεκτείνουν compat. Το Κ3 κάνει την απόκλισή του από τον χάρτη μη εκφράσιμη.
- `--fix` = το codemod, με την **ίδια** κρίση (`judge`) με την πύλη: μία απόφαση, όχι δύο.

**Αποτέλεσμα:**
- 658 αναδιατυπώσεις σε 588 αρχεία (εκ των οποίων 25 είχαν ήδη αλλαγές άλλων).
- Κ1 = Κ2 = Κ3 = 0.
- 5 `order-bearing`:
  - `SalesAvailablePropertiesPageContent`
  - `SalesSoldPageContent`
  - `StoragePageContent`
  - `PropertyDetailsContent`
  - `ReadOnlyMediaViewer`
- 21 άγκυρες· 7/7 μεταλλάξεις σκοτώθηκαν· CHECK 3.8 Layer 2 χωρίς νέα παράβαση· σχετικά tests 811/811
  (1 άγκυρα, `property-header-status-badge`, έλεγχε το **γράμμα** της δήλωσης και διορθώθηκε να ρωτά τον χάρτη).

### 11.5 Επόμενο: επίπεδο (β)

Μετρημένο: **~85%** των αρχείων χρειάζονται **ένα** namespace της οικογένειας, αλλά φορτώνουν όλη την οικογένεια
(κτίριο: ~164 KB αντί για 8–47 KB). Η κατεύθυνση:
- κάθε component ζητά **μόνο** τα splits των κλειδιών του, με γεννήτορα + πύλη «περιττό namespace»·
- τα 5 `order-bearing` λύνονται εκεί, με ρητό `ns`.

Εκκρεμεί στο `.claude-rules/pending-ratchet-work.md`.

### 11.6 Πριν την απόφαση του (β): έρευνα + μέτρηση με τη ΜΙΑ μηχανή (2026-10-30)

**Έρευνα (2026-10-30)**: κανένα από τα εργαλεία της αγοράς δεν **παράγει** τη δήλωση namespaces ανά component.
Το `i18next-cli` έχει `status --unused` (ορφανά κλειδιά ανά namespace) — **όχι** «περιττό namespace ανά αρχείο»·
το `--ci` που επικαλούνταν το handoff είναι του `vue-i18n-extract`, όχι του i18next-cli (μη επαληθευμένο). Το Lingui
**δεν** κόβει καταλόγους ανά διαδρομή (issue #1384: όλος ο κατάλογος κατεβαίνει). Το next-intl συστήνει `pick()` ανά
σελίδα, δηλωμένο **με το χέρι**. Το FormatJS εξάγει μηνύματα, δεν κόβει. ⇒ Ο γεννήτορας + η πύλη δύο κατευθύνσεων
είναι **πάνω** από την πρακτική, και η μηχανή υπάρχει ήδη (`requestOf` · `key-extract.js` · `proveEquivalent`).

**Μέτρηση** (μόνο ανάγνωση, `requestOf` του 3.108 πάνω στο `el`): **871** αρχεία δηλώνουν οικογένεια· **276 (32%)**
ζητούν «τα πάντα» (ανεπίλυτο κλειδί · `defaultValue` · διαφυγή του `t`) ⇒ **δεν** στενεύουν χωρίς χειρωνακτική
δουλειά· **580 (67%)** στενεύουν· 26 είναι ήδη ελάχιστα. Άθροισμα ανά αρχείο: ~185 MB → ~94 MB (−49%).
⚠️ **Αυτό ΔΕΝ είναι κέρδος δικτύου**: το `loadNamespace` κατεβάζει κάθε namespace **μία** φορά ανά συνεδρία, και τα
route slices είναι `shell-partial` (ADR-744 §15)· κερδίζει μόνο η οθόνη όπου **κανένα** μονταρισμένο component δεν ζητά
την υπόλοιπη οικογένεια. Το πραγματικό μέτρο είναι η **ένωση ανά διαδρομή** (κλειστότητα εισαγωγών του ADR-744,
`route-slices.js`) — **δεν μετρήθηκε ακόμα**. Ένα «τα πάντα» στην ίδια οθόνη ακυρώνει το κέρδος των αδελφών του.

### 11.7 Φάση 0: η ένωση ανά διαδρομή — μετρημένη (2026-10-30)

**Ερώτημα**: για κάθε οθόνη (`page.tsx` + οι `LazyRoutes.<Κλειδί>` που ονομάζει), πόσα KB κάθε οικογένειας
φορτώνονται **σήμερα** και πόσα **θα** φορτώνονταν αν κάθε αρχείο ζητούσε μόνο τα splits των κλειδιών του (τα «τα
πάντα» κρατούν όλη την οικογένεια).

**Καμία νέα μηχανή** (μόνο σύνθεση, script μέτρησης εκτός repo):
- γράφος + walk: `buildModuleGraph` (`plan.js`) + `computeShellClosure` (`shell-closure.js`)· μητρώα: `readRegistries` /
  `buildLazyRouteNamespaces` (`lazy-routes.js`, ADR-744 §27)·
- «τι ονομάζει ένα αρχείο»: `createNamespaceDeclarationReader` + `extractExplicitTCalls` + `lazyRouteOpaqueNamespaces`
  — η ίδια σύνθεση με το ιδιωτικό `createFileNamespaceReader`·
- «τι ζητά ένα αρχείο»: `requestOf` (CHECK 3.108)· ιδιοκτήτες κλειδιών: `nodePaths` (`equivalence.js`) στο `el`·
- βάση εκκίνησης: `bootNamespaces` (`lazy-routes.js`) = ολόκληρα του κελύφους ∪ `CRITICAL_NAMESPACES`.

**Απόδειξη ότι η σύνθεση μετρά το σωστό**: για τις 82 τεμπέλικες διαδρομές (`ssr: false`) δίνει **ίδια** namespaces
με τον `buildLazyRouteNamespaces` στις **82/82**. Με το δεσμευμένο `lazy-route-namespaces.json` αποκλίνει **1**
(`AccountingAPYCertificates`): ο δίσκος έχει αστάδιοποίητη δουλειά άλλου agent στο `apy-certificates/*` — η μηχανή
στον δίσκο συμφωνεί με τη σύνθεση. Μεταλλάξεις: «χωρίς compat επέκταση» ⇒ **59/82** αποκλίνουν· «χωρίς ρητά `t('ns:…')`» ⇒ **5/82** (σκοτώθηκαν και οι δύο).
Δύο βάθη: **πρώτη απόδοση** (η κλειστότητα του ADR-744, κόβεται στο `import()`) και **βαθιά** (+ κάθε δυναμικό όριο,
μεταβατικά — άνω όριο συνεδρίας της οθόνης). 238 σελίδες, 216 παραγωγής (εκτός test-harness/demo/debug).

#### 11.7.1 🔴 Το αποτέλεσμα: με τη σημερινή εκκίνηση, το (β) δίνει **0 KB** σε **κάθε** οθόνη

Και τα **47** namespaces των **13** οικογενειών του `COMPAT_NAMESPACE_MAP` είναι στο σύνολο εκκίνησης: το
`config.ts` (IIFE του client) κάνει `await loadNamespace` για **κάθε** `CRITICAL_NAMESPACES` στην εκκίνηση, και η
λίστα περιέχει **όλες** τις οικογένειες (building, dxf-viewer, contacts, properties, payments, projects, …).

| μέγεθος (el, compact UTF-8) | raw | gzip |
|---|---:|---:|
| σύνολο εκκίνησης (81 από 128 namespaces) | **1.906,8 KB** | **532,4 KB** |
| — από αυτά οι 13 οικογένειες (47 ns) | 1.495,7 KB | — |
| όλα τα `el` locales | 2.620,9 KB | — |

⇒ Σε **216/216** οθόνες, σε **πρώτη απόδοση και βαθιά**, «σήμερα − εκκίνηση» = ∅ για κάθε οικογένεια. Το στένεμα
των δηλώσεων **δεν αλλάζει ούτε ένα byte** που κατεβαίνει. Το «−49% ανά αρχείο» του §11.6 δεν είναι μέτρο δικτύου.

#### 11.7.2 Αντιπαράδειγμα: αν η εκκίνηση ήταν **μόνο** το κέλυφος

Πρώτη απόδοση, άθροισμα ανά οθόνη (KB·οθόνες, el raw — gzip σε παρένθεση):

| οικογένεια | οθόνες | με κέρδος | σήμερα | μετά (β) | κέρδος (β) | ιδανικό* |
|---|---:|---:|---:|---:|---:|---:|
| common | 144 | 13 | 17.254 | 15.675 | 1.580 (416) | 14.083 |
| projects | 23 | 9 | 1.479 | 1.160 | 319 (95) | 806 |
| contacts | 26 | 7 | 1.762 | 1.503 | 258 (83) | 1.503 |
| crm | 32 | 19 | 1.002 | 813 | 188 (69) | 724 |
| navigation | 34 | 25 | 157 | 42 | 115 (37) | 5 |
| files | 38 | 2 | 2.291 | 2.261 | 31 (10) | 1.938 |
| properties | 30 | 2 | 1.682 | 1.657 | 25 (8) | 1.562 |
| accounting | 35 | 1 | 2.083 | 2.068 | 14 (4) | 1.685 |
| reports | 18 | 2 | 328 | 318 | 9 (4) | 281 |
| building · payments · dxf-viewer · geo-canvas | 14 · 7 · 8 · 8 | **0** | 1.786 · 633 · 4.756 · 375 | ίδιο | **0** | 780 · 291 · 4.232 · 375 |

\* ιδανικό = αν **κάθε** «τα πάντα» στένευε στον γονέα (άνω όριο, όχι υπόσχεση).
Βαθιά, το κέρδος συρρικνώνεται κι άλλο (common 608 · projects 248 · contacts 111 · crm 109 · navigation 55 · files 31 ·
οι υπόλοιπες 7 οικογένειες **0**): στη βαθιά κλειστότητα σχεδόν πάντα υπάρχει ένα «τα πάντα».

**Αρχεία «τα πάντα» που μπλοκάρουν** (πρώτη απόδοση, αντιπαράδειγμα · KB·οθόνες που κρατούν δεσμευμένα, άνω όριο
μοιρασμένο με τους αδελφούς της ίδιας οθόνης):

| οικογένεια | αρχείο | οθόνες | KB |
|---|---|---:|---:|
| common | `src/lib/listings/listing-price-label.ts` | 71 | 1.108 |
| building | `building-management/tabs/PlaceholderTab.tsx` · `generic/UniversalTabsRenderer.tsx` | 11 | 797 |
| dxf-viewer | `hooks/notifications/useDxfImportNotifications.ts` | 8 | 525 |
| dxf-viewer · building | `generic/ServiceFormRenderer.tsx` · `generic/ServiceFormTabRenderer.tsx` | 6 | 394 · 288 |
| accounting · files | `core/AdvancedFilters/AdvancedFiltersPanel.tsx` · `FilterField.tsx` | 26 | 369 · 292 |
| building | `contacts/details/ProjectParticipationSection.tsx` | 6 | 288 |
| projects | `ui/navigation/route-tabs.tsx` | 8 | 283 |
| payments | `projects/tabs/project-budget/ProjectBudgetTab.tsx` | 4 | 274 |
| common | `NotificationProvider.tsx` (50) · `SearchInput.tsx` (26) · `UnifiedBadgeSystem.tsx` (13) | — | 122 το καθένα |

Τα γενικά renderers (`UniversalTabsRenderer`, `ServiceForm*`, `AdvancedFilters*`) περνούν το `t` ως τιμή ⇒ «τα
πάντα» σε **κάθε** οικογένεια που τα μοντάρει — αυτή είναι η κλάση, όχι τα μεμονωμένα αρχεία.

#### 11.7.3 Ο πραγματικός μοχλός είναι το `CRITICAL_NAMESPACES`, όχι οι δηλώσεις

Ανά οθόνη παραγωγής, KB οικογενειών που **χρειάζεται** (αντιπαράδειγμα, el raw): πρώτη απόδοση **διάμεσος 122 ·
p90 277** · βαθιά διάμεσος 188 (p90 1.423, όπου η βαθιά κλειστότητα φτάνει «όλη την εφαρμογή»). **55/216** οθόνες
δεν χρειάζονται **κανένα** byte οικογένειας ούτε βαθιά. Απέναντι: **1.495,7 KB** οικογενειών σε **κάθε** εκκίνηση.
Η μεγαλύτερη μεμονωμένη: `dxf-viewer` = **594,5 KB** (το `dxf-viewer-shell` μόνο του 373,6) = **31%** της εκκίνησης,
που τη χρειάζονται στην πρώτη απόδοση **8/216** οθόνες (βαθιά 84, μέσω δυναμικών ορίων).

⚠️ Γιατί η λίστα μεγάλωσε έτσι: ο κανόνας εισδοχής (ADR-279 §9, `lazy-config.ts`) δέχεται namespace που εμφανίζεται
σε **ήδη μονταρισμένη** επιφάνεια (καρτέλα, διάλογος) χωρίς αλλαγή διαδρομής — εκεί δεν υπάρχει loading boundary και
η τεμπέλικη λήψη ζωγραφίζει ωμό κλειδί για ένα καρέ. Δηλαδή το `CRITICAL_NAMESPACES` είναι η **χειρόγραφη** απάντηση
στο «τι μπορεί να μονταριστεί αργότερα σε αυτή την οθόνη» — ακριβώς η **βαθιά κλειστότητα** που αυτή η μέτρηση
**παράγει**. Ίδιο σχήμα με το ADR-744 §27, που αντικατέστησε χειρόγραφες δηλώσεις τεμπέλικων διαδρομών με
παραγόμενες.

**Συνέπεια για το §11.5 / pending (β)**: το (β) **μόνο του** είναι υγιεινή δηλώσεων (ακρίβεια, όχι bytes). Αποκτά
αξία δικτύου **μόνο** όταν μια οικογένεια **βγει** από το `CRITICAL_NAMESPACES`, και τότε το κέρδος το καθορίζουν τα
γενικά renderers «τα πάντα», όχι τα 580 αρχεία που στενεύουν. Η επιλογή της επόμενης κίνησης είναι του Giorgio.
Κόστος της μέτρησης: ~2′15″ ανά πέρασμα (δίσκος, ψυχρό), `--max-old-space-size=8192`.

### 11.8 Πιλότος: το `dxf-viewer` βγαίνει από το `CRITICAL_NAMESPACES` (απόφαση Giorgio 2026-10-30, επιλογή 1)

Στόχος: −594,5 KB (31%) σε κάθε εκκίνηση, **χωρίς** ωμό κλειδί, και ο κανόνας εισδοχής του ADR-279 §9 να γίνει
**αποδείξιμος από πύλη** για ό,τι βγαίνει. Έξι βήματα, σειριακά.

**Αναγνώριση (μετρημένη):** (1) ο χάρτης `lazy-route-namespaces.json` **δεν** καταναλωνόταν (ADR-744 §27.10 #1)·
(2) το `/dxf/viewer` φορτώνει το `DxfViewerApp` με δικό του `dynamic()`, όχι μέσω `LazyRoutes.DXFViewer`·
(3) στην πρώτη απόδοση το `dxf-viewer` το ονομάζουν 8 οθόνες (Κτίρια · Επαφές · Έργα · Ακίνητα ×2 · Ρυθμίσεις
εταιρείας · Αποθήκες · Στάθμευση) μέσω `useDxfImportNotifications` (σταθερά-κλειδί που ο ταξινομητής δεν λύνει) και
`ServiceForm*` (`SERVICE_FORM_NAMESPACES` περιέχει `dxf-viewer` ⇒ ο hook φορτώνει και τα 6 splits, ενώ το
`translateFieldValue` παρακάμπτει το compat)· (4) βαθιά, 91 δυναμικά όρια — σχεδόν όλα **μέσα** στο `DxfViewerApp` ή
μέσω του prefetch `preloadRoutes.ts`.

- ✅ **Β1 (2026-10-30) — ο χάρτης καταναλώνεται.** ADR-744 §33: `awaitedNamespaces` στο `defineLazyRoutes`,
  `isSupportedNamespace` (ένας φρουρός), −4 χειρόγραφα `namespaces`. Άγκυρες Χ1–Χ4 + Π1/Π2, μεταλλάξεις 4/4.
- ✅ **Β2 (2026-10-30) — το `/dxf/viewer` περνά από το μητρώο.** `dxf/viewer/page.tsx`: `LazyRoutes.DXFViewer` στη
  θέση του τοπικού `dynamic()` (−`DxfViewerLoadingFallback`, −`i18n.t` σε module, −`next/dynamic`). Ο `AdminGuard`
  μένει. ⚠️ Η όψη φόρτωσης γίνεται το `spinner` του μητρώου (αντί για `PageLoadingState` με μήνυμα) — μόνο οπτική,
  καμία αλλαγή κειμένου UI. Η **κλάση** («`import()` εγγραφής μητρώου έξω από το μητρώο = αναμονή αόρατη στον χάρτη»)
  κλείνει ως κανόνας της πύλης στο Β4.
- ✅ **Β3α (2026-10-30) — η ειδοποίηση εισαγωγής DXF δεν κοστίζει στο mount.** Το κλειδί
  `dxf-viewer:import.warnings.summary` ζει στον **γονέα** `dxf-viewer` ⇒ το αρχείο δεν μπορούσε να στενέψει σε split,
  και ο hook επεκτείνει **πάντα** τον γονέα σε όλα τα splits (594,5 KB σε κάθε οθόνη με καρτέλα αρχείων, μέσω
  `useFloorplanAutoProcess`). Θεραπεία της **κλάσης** «κείμενο που εμφανίζεται μόνο μετά από ασύγχρονη πράξη»: νέο
  `src/i18n/translate-on-demand.ts` — `translateOnDemand(key, options)`: διαβάζει το namespace **από το κλειδί**
  (SSoT `getExplicitNamespace`), φορτώνει **μόνο** αυτό (χωρίς compat splits) τη στιγμή του γεγονότος, μεταφράζει με το
  καθολικό `i18n.t` (δίπορτη αναζήτηση ADR-798 §13 — η παγίδα `import → dxf-viewer-wizard` του 2026-07-29 καλύπτεται).
  `useDxfImportNotifications` χωρίς `useTranslation`. Άγκυρες Δ1–Δ6
  (`src/hooks/notifications/__tests__/useDxfImportNotifications.test.ts`), μεταλλάξεις **4/4**.
  ⚠️ Προϋπάρχον, άσχετο κόκκινο: `registry-exhaustiveness.test.ts` Β «files» (12 κλειδιά `files:upload.listingVideo.*`
  χωρίς ιδιοκτήτη· το `dxfImport` δεν είναι καν στους τομείς του test).
- ✅ **Β3β (2026-10-30, απόφαση Giorgio «διόρθωση κλάσης στο 3.13») — το `dxf-viewer` βγήκε από το
  `SERVICE_FORM_NAMESPACES`.** Η εμβέλεια του CHECK 3.13 **παράγεται** (renderers → καταναλωτές → configs τους): 14
  αρχεία αντί για 186, **0** απρόσιτα χωρίς `dxf-viewer`. Λεπτομέρειες στο ADR-279 Decision Log 2026-10-30. Μεταλλάξεις 5/5.
- 📏 **Β4 — μέτρηση έκθεσης πριν την πύλη (2026-10-30, μετά τα Β1–Β3).** Αν το `dxf-viewer` έβγαινε τώρα από την
  εκκίνηση, ωμό κλειδί θα μπορούσε να ζωγραφιστεί σε:
  (α) **5 σελίδες** που εισάγουν το περιεχόμενό τους **στατικά** αντί για την υπάρχουσα εγγραφή μητρώου (`contacts`,
  `properties`, `properties/[id]`, `spaces/parking`, `spaces/storage`) — η κλειστότητά τους ονομάζει 10 αρχεία DXF/BIM
  (`PolygonMaterialPanel`, `CutPlaneSliderControl`, `SnapIndicatorGlyph`, `use-bim3d-edit-interaction`…) από
  **στατική προσβασιμότητα κώδικα**, όχι από ό,τι ζωγραφίζει στο πρώτο καρέ·
  (β) **5 δυναμικά όρια** που δεν τα περιμένει καμία γραμμή: `LevelsSystem` (8 ρίζες), `GanttView`, `ReserveDialog`
  (Sales: διαθέσιμα/πωλημένα), `PropertyFloorplanView`, `PropertyDossierTabs` (`(me)/dossiers/[dossierId]`)·
  (γ) κέλυφος: **0**.
  🔴 Συνέπεια για το κέρδος: όσο ο κώδικας BIM/canvas είναι στατικά προσβάσιμος από Επαφές/Ακίνητα/Χώρους/Κτίρια/
  Έργα/Ρυθμίσεις, αυτές οι οθόνες θα **περιμένουν** την οικογένεια (σωστό, χωρίς ωμά κλειδιά — αλλά χωρίς κέρδος εκεί).
  Το κέρδος (−594,5 KB) πέφτει στις συνεδρίες που δεν τις ανοίγουν. Ο πλήρης μοχλός είναι ο διαχωρισμός κώδικα
  (ADR-744 §27.10 #3). Απόφαση σχεδίασης του Β4: Giorgio.
- 🔬 **Β4 — σχεδίαση με έρευνα (απόφαση Giorgio: «όπως οι μεγάλοι, χωρίς εκπτώσεις»).** Google (Closure
  `goog.getMsg`, Angular `$localize`) και Meta (fbt) ενσωματώνουν τα κείμενα στον κώδικα **κατά το build ανά γλώσσα** ⇒
  chunk χωρίς κείμενα δομικά αδύνατο (εδώ ανέφικτο αυτούσιο: 914 δυναμικές `t()`, ADR-744 §27.3). Lingui v4
  `extract-experimental`: κατάλογος ανά **σελίδα** από το δέντρο εξαρτήσεων (πειραματικό). remix-i18next: ανά διαδρομή,
  χειρόγραφο. ⇒ Επιλογή: **«ένα αίτημα για κώδικα + κείμενα, ανά chunk»** σε χρόνο εκτέλεσης, **παραγόμενο** ανά όριο
  chunk (όχι μόνο σελίδα) με πύλη και στις δύο κατευθύνσεις. Βήματα: Β4.0 parser · Β4.1 `defineLazySurfaces` ·
  Β4.2 κανόνας εισδοχής στο CHECK 3.34 · Β4.3 οι θεραπείες (5 σελίδες μέσω μητρώου · `ReserveDialog` ·
  `PropertyDossierTabs`).
- ✅ **Β4.0 (2026-10-30) — η σύγχρονη κλήση `require` δεν είναι όριο chunk** (ADR-744 §33.1): νέο `kind: 'require'`
  στον κοινό parser· κέλυφος/γραμμές/Κ2 αμετάβλητα, κλειστότητες +2 αρχεία. Μεταλλάξεις 2/2 + 1 ισοδύναμη (αφαιρέθηκε).
- ✅ **Β4.1 (2026-10-30) — `defineLazySurfaces`: οι επιφάνειες (διάλογος, καρτέλα) στην ΙΔΙΑ μηχανή** (ADR-744 §33.2).
  Ένας πυρήνας chunk (`lazyChunk`: κώδικας + namespaces ως ένα αίτημα) και ένας βρόχος μητρώων (`defineLazy` →
  `awaitedNamespaces`) για διαδρομές **και** επιφάνειες· ο γεννήτορας διαβάζει και τις δύο κλήσεις (`REGISTRY_CALLS`,
  πεδίο `kind`) ⇒ ίδιος χάρτης, ίδια Κ1/Κ2, ίδια κάλυψη Layer 1, κλειδί μοναδικό σε όλα τα μητρώα. **Απόκλιση από το
  σχέδιο, εγκεκριμένη:** ΕΝΑ πεδίο config (`lazyRouteRegistries`), όχι δεύτερο `lazySurfaceRegistries` (θα ήταν 6 σημεία
  που θυμούνται μια ένωση). Η κλειστότητα δίνεται από έλεγχο **και στις δύο κατευθύνσεις** που έλειπε ακόμη και για τις
  διαδρομές: αρχείο που καλεί `defineLazy*` εκτός λίστας ⇒ άρνηση (γεννήτορας: εισαγωγείς από τον γράφο· Layer 1: τα
  σταδιοποιημένα, από την όψη του commit). Χάρτης αμετάβλητος (82 / 57 = σφράγιση 57), καμία σφράγιση δεν αγγίχτηκε.
  Μεταλλάξεις 6/6. Ψευδώς θετικό της πρώτης εκτέλεσης (test που καλεί το factory) ⇒ `isTestSource` του `gate-input.js`.
- ✅ **Β4.2 (2026-10-30) — ο κανόνας εισδοχής ως πύλη** (ADR-744 §33.3 · ADR-279 Decision Log). Νέο `surface-coverage.js`:
  ρίζες = σελίδες/layouts/route-boundaries του `src/app` + εγγραφές μητρώου· όρια = ρίζα + μεταβατικά τα `import()` που δεν
  είναι εγγραφή· κάλυψη = εκκίνηση ∪ γραμμή(ρίζας). Ίδια μηχανή κλειστοτήτων (κοινή μνήμη με τον χάρτη), ίδια απογραφή
  Κ1/Κ2 (`lazy-route-census.js`, παραμετρικά ονόματα). Αφετηρία **400** τριάδες / 111 ρίζες (καμία dxf) — μετά το Β5 κάθε dxf
  τριάδα είναι νέα ⇒ ⛔ χωρίς λίστα. Κλειστό και το ανοιχτό του §33: χειρόγραφο `namespaces` πέρα από τη γραμμή ⇒ κόκκινο.
  🔴 Κενό που έκλεισε: το CI (`--full`) δεν έκρινε καθόλου τον χάρτη. Μεταλλάξεις 6/6. Στο Β4.3 προστίθενται και **5 σελίδες
  harness** (contact-mutation · bim-3d · dxf-canvas · test-cursor) — απόφαση Giorgio: μηδέν ωμά κλειδιά παντού.
- ✅ **Β4.3 (2026-10-31) — οι θεραπείες: 0 dxf τριάδες** (ADR-744 §33.4 · ADR-279 Decision Log). Η απόδειξη έγινε με την
  ΙΔΙΑ `admissionDebt` και εκκίνηση **χωρίς** τα 6 dxf namespaces: **93 → 0** τριάδες (18 → 0 κλειδιά).
  · 5 σελίδες προϊόντος από το μητρώο: `LazyRoutes.Contacts` · `.Properties` · `.SpacesParking` · `.SpacesStorage`, οι οποίες υπήρχαν
    χωρίς καταναλωτή, και η νέα `PropertyDetail`. Το `properties/[id]` έγινε `'use client'` + `use(params)`, γιατί ένας server
    component δεν μπαίνει με τελεία σε client module. Το SSR δίνει πλέον μόνο skeleton.
  · Harness: νέο λεπτό μητρώο `src/utils/lazyHarnessRoutes.tsx` (contact-mutation · bim-3d · dxf-canvas + επιφάνεια του πάνελ
    του test-cursor). Τα stubs παραγωγής μένουν ενεργά: το alias του webpack εφαρμόζεται και στο στάδιο `file`. Άγκυρα
    `scripts/__tests__/lazy-harness-stubs.test.js`.
  · Επιφάνειες σε λεπτά μητρώα **ανά τομέα**: `sales-surfaces.tsx` (`SalesReserveDialog`) · `dossier-surfaces.tsx` (**ένα**
    κλειδί `PropertyDossierTab` + dispatcher, αντί για 5 `React.lazy`).
  · 🔴 **Τρύπα κλάσης που βρέθηκε και έκλεισε — κανόνας Ρ:** `import()` στόχου εγγραφής **έξω** από μητρώο ⇒ άρνηση, με
    μηδενική ανοχή και χωρίς λίστα. Ο κανόνας εισδοχής σταματούσε σε κάθε τέτοιο `import()`, άρα ένα τοπικό `dynamic()` φόρτωνε
    τον ίδιο κώδικα **χωρίς** τα κείμενα, με την πύλη πράσινη. Μετρήθηκαν δύο περιπτώσεις:
    – ο κρυμμένος **5ος harness**, `DxfPerfHarness` → `DxfViewerApp`, που τώρα περνά από το `LazyRoutes.DXFViewer`·
    – το `preloadRoutes.ts`, με 7 specs γραμμένα δεύτερη φορά. Τώρα καλεί το `preload()` της εγγραφής: ο ίδιος φορτωτής, κώδικας + κείμενα
      (πρότυπο React Router `route.lazy` / Remix `intent`).
  · Κατάστιχα: `lazyAdmissionSeal` **400 → 321** (−94 τριάδες, +15 που είναι μετακόμιση από `properties/[id]/page.tsx` σε
    `entry:PropertyDetail`). `lazyRouteMountSeal` **57 → 77** με **ρητό «ΝΑΙ» του Giorgio**: +20 ζεύγη, 0 bytes, γιατί τα ίδια
    namespaces από χρέος ωμού καρέ γίνονται δηλωμένη αναμονή.
  · Μεταλλάξεις **7/7**, με επαναφορά μέσω `os.replace` και έλεγχο bytes.
  · ⚠️ Ανοιχτό, ξένο: η WIP του ADR-923 (`catalog-ui-hooks.ts`) πρόσθεσε ήδη 3 ζεύγη `→ catalog` (77 → 80), και υπάρχουν 3 ακόμη
    ευρήματα του catalog στον γεννήτορα. Τα κρίνει ο κάτοχός της.
- ⏳ Β4.1 · Β4.2 · Β4.3 · Β5 · Β6. Πρώην γραμμή: Β3β `SERVICE_FORM_NAMESPACES` · Β4 ο κανόνας εισδοχής ως πύλη (επέκταση CHECK 3.34) ·
  Β5 αφαίρεση από το `CRITICAL_NAMESPACES` (θέλει ρητό «ναι» για τη σφράγιση Κ2) · Β6 επαλήθευση el+en.
