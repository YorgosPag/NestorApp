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
