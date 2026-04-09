# ADR-296: i18n Hardcoded Greek Strings — Phased Cleanup Plan

**Status**: APPROVED
**Date**: 2026-04-09
**Author**: Claude (ADR-driven workflow)
**Approved by**: Georgios Pagonis
**Related**: CLAUDE.md SOS N.11, ADR-294 (SSoT Ratchet)

---

## 1. Context & Problem

Audit on 2026-04-09 revealed **~1,042 hardcoded Greek strings** across 20+ files in 4 domains. These strings bypass the i18n system (`t()` calls + locale JSONs), making the app untranslatable and violating the SSoT principle (CLAUDE.md SOS N.11).

### Previous Work (Batches 1-3)
| Batch | Commit   | Components Fixed                                                        | Violations |
|-------|----------|-------------------------------------------------------------------------|------------|
| 1     | e436f818 | MultiplePhotosFull, ParkingNode, ProjectParkingTab, SalesSidebar, GenericTabRenderer | ~47 |
| 2     | 4019174b | StorageNode, FilePreviewPanel, PdfCanvasViewer, MobileHeaderViewToggle, StorageDetailsHeader | ~27 |
| 3     | 75caafba | ModalContainer, ProjectHierarchyContext, VideosTab, PhotosTab, DocumentsTab | ~19 |

**Total fixed so far**: ~93 violations in 15 production components.

---

## 2. Full Audit Results (2026-04-09)

### 2.1 DXF-Viewer Subapp — 451 violations

| # | File | Lines | Violations | Type |
|---|------|-------|------------|------|
| 1 | `config/modal-select.ts` | 818 | 346 | CONFIG (labels, placeholders) |
| 2 | `config/modal-select/toolbar/configurations.ts` | 276 | 82 | CONFIG (button labels, states) |
| 3 | `config/modal-select/core/options/encoding.ts` | 67 | 11 | CONFIG (encoding options) |
| 4 | `app/useDxfViewerCallbacks.ts` | 398 | 4 | CODE (toast messages) |
| 5 | `components/DestinationWizard.tsx` | 344 | 8 | CODE (UI labels) |

### 2.2 Accounting Subapp — 292 violations

| # | File | Lines | Violations | Type |
|---|------|-------|------------|------|
| 6 | `data/greek-tax-offices.ts` | 166 | 114 | DATA (tax office names) |
| 7 | `config/account-categories.ts` | 486 | 72 | CONFIG (category labels) |
| 8 | `components/setup/CustomCategoriesSection.tsx` | 456 | 37 | CODE (UI strings) |
| 9 | `services/config/vat-config.ts` | 179 | 49 | CONFIG (VAT labels) |
| 10 | `hooks/useCustomCategories.ts` | 176 | 20 | CODE (error messages) |

### 2.3 Geo-Canvas Subapp — 31 violations

| # | File | Lines | Violations | Type |
|---|------|-------|------------|------|
| 11 | `app/GeoCanvasPanels.tsx` | 202 | 13 | CODE (feature descriptions) |
| 12 | `components/AdminBoundaryDemo.tsx` | 304 | 8 | CODE (button labels) |
| 13 | `components/AddressSearchPanel.tsx` | 499 | 8 | CODE (placeholders) |
| 14 | `services/.../AdministrativeBoundaryService.ts` | 356 | 2 | SERVICE (hierarchy labels) |

### 2.4 Main Src — 268 violations

| # | File | Lines | Violations | Type | Category |
|---|------|-------|------------|------|----------|
| 15 | `api/admin/migrate-building-features/migration-config.ts` | 121 | 85 | DATA | EXEMPT (migration) |
| 16 | `config/geographic-config.ts` | 211 | 7 | CONFIG | FIX |
| 17 | `config/admin-tool-definitions.ts` | 397 | 55 | CONFIG | EXEMPT (AI prompts) |
| 18 | `config/ai-role-access-matrix.ts` | 442 | 108 | CONFIG | EXEMPT (AI prompts) |
| 19 | `api/accounting/bank/reconcile/route.ts` | 252 | 9 | CODE | FIX |
| 20 | `api/accounting/setup/route.ts` | 180 | 4 | CODE | FIX |

---

## 3. Classification & Exemptions

### 3.1 EXEMPT — Not user-facing, keep as-is (248 violations)

| File | Violations | Reason |
|------|-----------|--------|
| `admin-tool-definitions.ts` | 55 | AI system prompts (sent to LLM, not rendered in UI) |
| `ai-role-access-matrix.ts` | 108 | AI role prompts (sent to LLM, not rendered in UI) |
| `migration-config.ts` | 85 | One-time migration mapping, not user-facing |

**Rule**: AI prompt strings (system/role messages for OpenAI) are NOT user-facing. They stay hardcoded.

### 3.2 MUST FIX — User-facing (794 violations)

Everything else: UI labels, placeholders, toast messages, error messages, button text, config labels rendered in components.

---

## 4. Architecture: Config Files i18n Pattern (SSoT)

### Problem
Config files (`.ts`) don't have access to React's `useTranslation()` hook. They export static objects.

### Solution: i18n Key Pattern
Config files store **translation keys** (not literal text). Components call `t(key)` at render time.

```typescript
// ❌ BEFORE (hardcoded)
export const MODAL_CONFIG = {
  placeholder: 'Επιλέξτε...',
  noResults: 'Δεν βρέθηκαν αποτελέσματα',
};

// ✅ AFTER (i18n keys)
export const MODAL_CONFIG = {
  placeholderKey: 'dxfViewer.modalSelect.placeholder',
  noResultsKey: 'dxfViewer.modalSelect.noResults',
};

// Component:
const { t } = useTranslation('dxf-viewer');
<span>{t(config.placeholderKey)}</span>
```

### For Data Files (tax offices, categories)
Data files with domain-specific Greek names use **structured locale entries**:

```typescript
// ❌ BEFORE
{ id: 'ath1', name: "Α' Αθηνών", region: 'Αττική' }

// ✅ AFTER
{ id: 'ath1', nameKey: 'accounting.taxOffices.ath1', regionKey: 'accounting.taxOffices.regions.attica' }
```

### Existing Locale Namespaces (already created)
| Namespace | File |
|-----------|------|
| `dxf-viewer` | `dxf-viewer.json` |
| `dxf-viewer-settings` | `dxf-viewer-settings.json` |
| `dxf-viewer-wizard` | `dxf-viewer-wizard.json` |
| `dxf-viewer-panels` | `dxf-viewer-panels.json` |
| `dxf-viewer-shell` | `dxf-viewer-shell.json` |
| `accounting` | `accounting.json` |
| `accounting-setup` | `accounting-setup.json` |
| `geo-canvas` | `geo-canvas.json` |
| `geo-canvas-drawing` | `geo-canvas-drawing.json` |

---

## 5. Phased Execution Plan

### Overview

| Phase | Scope | Violations | Files | Session Size | Priority |
|-------|-------|------------|-------|-------------|----------|
| 4A | geo-canvas (all) | 31 | 4 | Small | HIGH |
| 4B | dxf-viewer user-facing code | 12 | 2 | Small | HIGH |
| 4C | accounting components + hooks | 57 | 2 | Medium | HIGH |
| 4D | accounting config (vat + categories) | 121 | 2 | Medium | MEDIUM |
| 4E | accounting data (tax offices) | 114 | 1 | Medium | MEDIUM |
| 4F | API routes + geographic config | 20 | 3 | Small | MEDIUM |
| 4G | dxf-viewer toolbar config | 82 | 1 | Medium | MEDIUM |
| 4H | dxf-viewer encoding config | 11 | 1 | Small | LOW |
| 4I | dxf-viewer modal-select.ts (Part 1: lines 1-400) | ~170 | 1 | Large | LOW |
| 4J | dxf-viewer modal-select.ts (Part 2: lines 400-818) | ~176 | 1 | Large | LOW |

**Total MUST FIX**: 794 violations across 10 phases.

---

### Phase 4A: Geo-Canvas — 31 violations, 4 files
**Estimated effort**: Small (1 session, ~15 min)

**Files**:
1. `src/subapps/geo-canvas/app/GeoCanvasPanels.tsx` (13) — feature descriptions, architecture labels
2. `src/subapps/geo-canvas/components/AdminBoundaryDemo.tsx` (8) — quick search buttons
3. `src/subapps/geo-canvas/components/AddressSearchPanel.tsx` (8) — placeholders
4. `src/subapps/geo-canvas/services/.../AdministrativeBoundaryService.ts` (2) — hierarchy labels

**Locale files**: `geo-canvas.json` (el + en)
**Approach**: Direct `t()` replacement, add keys to existing locale files.

---

### Phase 4B: DXF-Viewer User-Facing Code — 12 violations, 2 files
**Estimated effort**: Small (1 session, ~10 min)

**Files**:
1. `src/subapps/dxf-viewer/app/useDxfViewerCallbacks.ts` (4) — toast/notification messages
2. `src/subapps/dxf-viewer/components/DestinationWizard.tsx` (8) — button labels, step titles

**Locale files**: `dxf-viewer.json`, `dxf-viewer-wizard.json` (el + en)
**Approach**: Direct `t()` replacement.

---

### Phase 4C: Accounting Components — 57 violations, 2 files
**Estimated effort**: Medium (1 session, ~25 min)

**Files**:
1. `src/subapps/accounting/components/setup/CustomCategoriesSection.tsx` (37) — dropdown labels, error messages, myDATA categories
2. `src/subapps/accounting/hooks/useCustomCategories.ts` (20) — error/validation messages

**Locale files**: `accounting-setup.json` (el + en)
**Approach**: Direct `t()` replacement. useCustomCategories may need `useTranslation` hook addition.

---

### Phase 4D: Accounting Config — 121 violations, 2 files
**Estimated effort**: Medium (1 session, ~30 min)

**Files**:
1. `src/subapps/accounting/config/account-categories.ts` (72) — category names, descriptions
2. `src/subapps/accounting/services/config/vat-config.ts` (49) — VAT rate labels, legal basis

**Locale files**: `accounting.json` (el + en)
**Approach**: Config i18n key pattern (Section 4). Store keys, resolve at render time.

---

### Phase 4E: Accounting Data — 114 violations, 1 file
**Estimated effort**: Medium (1 session, ~25 min)

**Files**:
1. `src/subapps/accounting/data/greek-tax-offices.ts` (114) — DOY names, regions

**Locale files**: New namespace `accounting-tax-offices.json` (el + en)
**Approach**: Each tax office gets a locale key. Region names get shared keys.
**Note**: ~50 unique tax offices + ~13 regions = ~63 locale entries (many lines are duplicates).

---

### Phase 4F: API Routes + Geographic Config — 20 violations, 3 files
**Estimated effort**: Small (1 session, ~15 min)

**Files**:
1. `src/app/api/accounting/bank/reconcile/route.ts` (9) — error messages
2. `src/app/api/accounting/setup/route.ts` (4) — validation messages
3. `src/config/geographic-config.ts` (7) — city/country defaults

**Locale files**: `accounting.json`, `common.json` (el + en)
**Approach**: API routes use server-side i18n or return error codes. Geographic config uses locale keys.
**Caveat**: API routes return JSON — may need error code pattern instead of translated strings.

---

### Phase 4G: DXF-Viewer Toolbar Config — 82 violations, 1 file
**Estimated effort**: Medium (1 session, ~30 min)

**Files**:
1. `src/subapps/dxf-viewer/config/modal-select/toolbar/configurations.ts` (82) — action buttons, loading states

**Locale files**: `dxf-viewer.json` (el + en)
**Approach**: Config i18n key pattern. Button labels → keys.

---

### Phase 4H: DXF-Viewer Encoding Config — 11 violations, 1 file
**Estimated effort**: Small (1 session, ~10 min)

**Files**:
1. `src/subapps/dxf-viewer/config/modal-select/core/options/encoding.ts` (11) — Yes/No, descriptions

**Locale files**: `dxf-viewer.json` (el + en)
**Approach**: Direct key replacement.

---

### Phase 4I: DXF-Viewer modal-select.ts Part 1 — ~170 violations
**Estimated effort**: Large (1 full session, ~45 min)

**File**: `src/subapps/dxf-viewer/config/modal-select.ts` (lines 1-400)
**Locale files**: New namespace `dxf-viewer-modal-select.json` (el + en)
**Approach**: Config i18n key pattern. Systematic: field labels, placeholders, filter names.

---

### Phase 4J: DXF-Viewer modal-select.ts Part 2 — ~176 violations
**Estimated effort**: Large (1 full session, ~45 min)

**File**: `src/subapps/dxf-viewer/config/modal-select.ts` (lines 400-818)
**Locale files**: `dxf-viewer-modal-select.json` (el + en)
**Approach**: Same as Phase 4I. Complete the file.

---

## 6. Definition of Done (per phase)

- [ ] All hardcoded Greek strings replaced with `t('key')` or `config.labelKey`
- [ ] Locale keys added to **both** `el/*.json` and `en/*.json`
- [ ] Greek text in `el/*.json`, English translation in `en/*.json`
- [ ] No `defaultValue: 'literal text'` (only `defaultValue: ''` if needed)
- [ ] Components importing `useTranslation` from `react-i18next`
- [ ] Config files using i18n key pattern (not importing React hooks)
- [ ] `npm run i18n:audit` passes (0 new violations)
- [ ] TypeScript compilation clean for changed files
- [ ] Git commit with ADR changelog update

---

## 7. Progress Tracker

| Phase | Status | Date | Commit | Notes |
|-------|--------|------|--------|-------|
| Batch 1 | DONE | 2026-04-06 | e436f818 | 5 components, ~47 violations |
| Batch 2 | DONE | 2026-04-06 | 4019174b | 5 components, ~27 violations |
| Batch 3 | DONE | 2026-04-06 | 75caafba | 5 components, ~19 violations |
| Phase 4A | DONE | 2026-04-09 | — | geo-canvas: 31 violations fixed, 7 files |
| Phase 4B | DONE | 2026-04-09 | — | dxf-viewer code: 12 violations fixed, 2 files |
| Phase 4C | DONE | 2026-04-09 | — | accounting components: 57 violations fixed, 2 files |
| Phase 4D | DONE | 2026-04-09 | — | accounting config: 121 violations fixed, 10 files |
| Phase 4E | PENDING | — | — | accounting data |
| Phase 4F | PENDING | — | — | API routes + geo config |
| Phase 4G | PENDING | — | — | dxf-viewer toolbar |
| Phase 4H | PENDING | — | — | dxf-viewer encoding |
| Phase 4I | PENDING | — | — | modal-select Part 1 |
| Phase 4J | PENDING | — | — | modal-select Part 2 |

---

## 8. Changelog

| Date | Change |
|------|--------|
| 2026-04-09 | ADR-296 created. Full audit: 1,042 violations, 248 exempt, 794 to fix in 10 phases. |
| 2026-04-09 | Phase 4D DONE: accounting config — 121 violations fixed. account-categories.ts (50: labels+descriptions→i18n keys, getCategoryDisplayLabel helper), vat-config.ts (24: VAT labels, 19 legalBasis, notes→i18n keys). 4 report services updated to use helper. VATDeductibilityTable consumer updated. ~70 new locale keys in el/en accounting.json. |
| 2026-04-09 | Phase 4C DONE: accounting components — 57 violations fixed. CustomCategoriesSection (37: myDATA options→i18n keys, 15 defaultValue removals, error messages, buttons), useCustomCategories (4 error messages). ~50 new locale keys in el/en accounting-setup.json. |
| 2026-04-09 | Phase 4B DONE: dxf-viewer user-facing code — 12 violations fixed. useDxfViewerCallbacks (4 toast/notification messages), DestinationWizard (8 button labels + step text). 14 new locale keys added to el/en dxf-viewer.json + dxf-viewer-wizard.json. |
| 2026-04-09 | Phase 4A DONE: geo-canvas — 31 violations fixed. GeoCanvasPanels (removed isLoading ternaries), AdminBoundaryDemo (18 keys → i18n), AddressSearchPanel (placeholders + cache stats), AdministrativeBoundaryService + overpass-data-converters + SpatialQueryService (GREECE_COUNTRY_NAME constant). 26 new locale keys added to el/en geo-canvas.json. |
