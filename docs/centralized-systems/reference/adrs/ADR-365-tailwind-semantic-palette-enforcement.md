# ADR-365 — Tailwind Semantic Palette Enforcement

| Πεδίο | Τιμή |
|---|---|
| **Status** | ✅ **APPROVED** 2026-05-29 — All 8 phases complete. Baseline 0/0, zero-tolerance CHECK 3.26 active. The `green-707` typo incident (303 occurrences / 181 files) is **RESOLVED**: all renamed to `[hsl(var(--text-success))]` theme-aware classes, and CHECK 3.26 now hard-blocks any non-existent Tailwind shade (invalid-shade detection). **Follow-up 2026-05-29**: faded SOLID status colors fixed — new `--status-*` solid tier in COLOR_BRIDGE (`bg.*Solid`/`text.onSolid`) + green text unification + 214 foreground-misuse fixes (`(text\|border\|ring)-[hsl(var(--bg-X))]` → `--text-X`) across 97 files. See Changelog top entry. |
| **Date** | 2026-05-19 |
| **Category** | Design System — Theming & Color Tokens |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-365-tailwind-semantic-palette-enforcement.md` |
| **Author** | Claude Opus 4.7 + Γιώργος Παγώνης |
| **SSoT Module** | `tailwind-hardcoded-palette` (νέο module, Tier 2 — to be registered στο `.ssot-registry.json` Phase 0) |
| **Canonical Mapping** | `src/design-system/color-bridge.ts` (COLOR_BRIDGE) + `src/design-system/semantics/colors.ts` (semanticColors) |
| **Related ADRs** | ADR-001 (Select Canonical), ADR-040 (Canvas Performance — hover state SSoT), ADR-128 (Switch Tokens), ADR-279/280 (i18n SSoT pattern — analogous ratchet), ADR-294 (SSoT Ratchet), ADR-312 (Property Showcase brand tokens), ADR-314 (SSoT Discovery — CHECK 3.18), ADR-345 (DXF Ribbon — theme-aware UI) |

---

## Summary

Επιβολή **semantic Tailwind palette tokens** ως αποκλειστικό canonical pattern για όλα τα user-facing UI states (background, text, border, ring, hover, focus). Απαγόρευση raw palette utilities (`bg-amber-100`, `hover:bg-slate-700`, `text-emerald-600`, κλπ.) σε consumer files μέσω **SSoT ratchet enforcement** (CHECK 3.x pre-commit hook). Phased migration ~65 consumer files / ~249 violations με per-domain atomic commits.

Το πρόβλημα ανακαλύφθηκε κατά την επαλήθευση hover audit (2026-05-19): η αρχική αναφορά "319 hardcoded :hover σε 129 αρχεία" αναλύθηκε σε ~207 sites σε ~73 αρχεία — όλα styling (όχι state). Το `HoverStore` SSoT (ADR-040) παραμένει υγιές. Το πρόβλημα είναι **theme/dark-mode/design-system consistency**, όχι hover state architecture.

---

## 1. Context

### 1.1 Το πρόβλημα

Το codebase διαθέτει **πλήρες enterprise design system** (3+ tiers):

| Layer | Location | Purpose |
|-------|----------|---------|
| **Tokens** | `src/design-system/tokens/colors.ts` | CSS-variable & raw palette fallback |
| **Semantics** | `src/design-system/semantics/colors.ts` | Business meanings (success/error/warning/info) |
| **Bridge** | `src/design-system/color-bridge.ts` | API → shadcn class mapping (~150 entries) |
| **shadcn** | `tailwind.config.ts` | `muted`, `accent`, `destructive`, `primary`, `ring`, κλπ |
| **Enterprise BG** | `tailwind.config.ts` → `bg-enterprise-*` | hover/active/success/error/warning/info |
| **Performance** | `tailwind.config.ts` → `performance-*` | success/warning/error/info με `.hover` |
| **CSS Variables** | `src/app/globals.css` | `--bg-success`, `--hover-success-bg`, κλπ |

**Παρ' όλα αυτά**, 249 raw palette violations σε 86 αρχεία bypass-άρουν το system:

```
86 αρχεία × hover:bg-{slate,gray,zinc,neutral,stone,red,orange,amber,yellow,lime,
                       green,emerald,teal,cyan,sky,blue,indigo,violet,purple,
                       fuchsia,pink,rose}-{50..900}
```

### 1.2 Συμπτώματα

1. **Dark-mode breakage** — `hover:bg-amber-100` δεν αλλάζει σε dark theme (χρειάζεται manual `dark:hover:bg-amber-600`). Semantic tokens είναι ήδη theme-aware μέσω CSS vars.
2. **Theme drift** — Αλλαγή brand palette ⇒ touch 86 files, miss-by-design.
3. **Design system bypass** — Νέοι developers δεν ξέρουν ότι υπάρχει το `COLOR_BRIDGE` και copy-paste το pattern του γείτονα file.
4. **Hidden coupling** — Designer αλλάζει `--bg-warning` HSL, αλλά consumer files έχουν hardcoded `amber-100` που δεν follow-up-άρει.
5. **A11y inconsistency** — WCAG contrast checking γίνεται per-file αντί centralized.

### 1.3 Γιατί τώρα

- **2026-05-19 hover audit** revealed extent (249 / 86 files).
- ADR-040 hover state architecture έχει validated SSoT (HoverStore + cursor + bitmap cache). **Λείπει η αντίστοιχη επιβολή στο visual layer.**
- ADR-294/314 ratchet infrastructure υπάρχει — εύκολο plug-in.
- Property Showcase brand work (ADR-312) έδειξε ότι semantic tokens δουλεύουν correctly cross-theme.

---

## 2. Decision

### 2.1 Canonical pattern

**ΟΛΑ τα user-facing UI states** ΥΠΟΧΡΕΩΤΙΚΑ χρησιμοποιούν:

| Use case | Canonical class | Πηγή |
|----------|----------------|------|
| Default background | `bg-background`, `bg-card`, `bg-muted` | shadcn token (tailwind.config) |
| Hover background (neutral) | `hover:bg-accent`, `hover:bg-muted` | shadcn token |
| Hover background (status) | `hover:bg-[hsl(var(--bg-success))]`, `hover:bg-[hsl(var(--bg-error))]`, κλπ | CSS var (theme-aware) |
| Status background | `bg-[hsl(var(--bg-{success,error,warning,info}))]` | CSS var |
| Text (status) | `text-destructive`, `text-foreground`, `text-muted-foreground` | shadcn |
| Status text (light bg) | `text-green-700`, `text-red-700`, κλπ (WCAG 4.5:1) | Documented exception via `COLOR_BRIDGE.text.*` |
| Border (focus) | `border-ring`, `focus:ring-ring` | shadcn |
| Border (status) | `border-{green,red,yellow,blue}-300` (WCAG-tested) | Documented exception via `COLOR_BRIDGE.border.*` |
| Brand surfaces | `bg-[hsl(var(--showcase-bg))]`, κλπ | ADR-312 brand vars |

### 2.2 Forbidden patterns (consumer files)

```
hover:(bg|text|border|ring|fill|stroke)-{palette}-{50..900}
{bg,text,border,ring,fill,stroke}-{palette}-{50..900}     # except documented status colors
dark:(hover:)?{bg,text,border}-*                          # semantic tokens είναι theme-aware
```

Όπου `{palette}` = `slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose`.

### 2.3 Exempt files (SSoT — define το palette)

| File | Reason |
|------|--------|
| `src/design-system/color-bridge.ts` | Bridge mapping table |
| `src/design-system/tokens/colors.ts` | Raw token fallback |
| `src/design-system/semantics/colors.ts` | Business semantic layer |
| `src/styles/design-tokens/modules/brand-map.ts` | Brand palette source |
| `src/styles/design-tokens/modules/borders.ts` | Border palette source |
| `src/styles/design-tokens/canvas/**` | DXF canvas-specific palette |
| `src/subapps/procurement/config/comparison-factor-colors.ts` | Quote comparison palette (domain SSoT) |
| `src/subapps/dxf-viewer/config/modal-colors.ts` | DXF modal palette |
| `src/subapps/dxf-viewer/config/panel-tokens.ts` | DXF panel palette |
| `src/components/ui/effects/{hover,form,social,hover-text}-effects.ts` | UI effects tokens |
| `src/subapps/dxf-viewer/ui/effects/index.ts` | DXF effects tokens |
| `tailwind.config.ts` | Theme definition |
| `**/__tests__/**`, `**/*.{test,spec,stories}.tsx` | Test/storybook fixtures |
| `**/*.md` | Documentation |

---

## 3. Architecture

### 3.1 Mapping table (canonical)

Όλα τα replacements γίνονται κατά την Phase 1+ migration. Πίνακας lookup:

#### Backgrounds

| Raw pattern | Semantic replacement | Notes |
|-------------|---------------------|-------|
| `bg-amber-{50,100}`, `bg-yellow-{50,100}` | `bg-[hsl(var(--bg-warning))]/40` | warning **subtle SURFACE** (alert bg) |
| `bg-yellow-{500..700}`, `bg-amber-{500..700}` | `bg-[hsl(var(--status-warning))]` (= `colors.bg.warningSolid`) | warning **SOLID fill** (badge/dot/toggle) — pair `text-white` |
| `bg-emerald-{50,100}`, `bg-green-{50,100}` | `bg-[hsl(var(--bg-success))]/40` | success **subtle SURFACE** |
| `bg-emerald-{500..700}`, `bg-green-{500..700}` | `bg-[hsl(var(--status-success))]` (= `colors.bg.successSolid`) | success **SOLID fill** — pair `text-white` |
| `bg-rose-{50,100}`, `bg-red-{50,100}` | `bg-[hsl(var(--bg-error))]/40` | error **subtle SURFACE** |
| `bg-rose-{500..900}`, `bg-red-{500..900}` | `bg-destructive` (destructive action) ή `bg-[hsl(var(--status-error))]` (= `colors.bg.errorSolid`, status badge/dot) | **SOLID fill** — pair `text-white` |
| `bg-blue-{50,100}` | `bg-[hsl(var(--bg-info))]/40` | info **subtle SURFACE** |
| `bg-blue-{500..700}` | `bg-primary` (primary action) ή `bg-[hsl(var(--status-info))]` (= `colors.bg.infoSolid`, info badge/dot) | **SOLID fill** — pair `text-white` |
| `bg-slate-{50,100}`, `bg-gray-{50,100}` | `bg-muted` | neutral light |
| `bg-slate-{700..900}`, `bg-gray-{700..900}` | `bg-card` (dark theme) ή `bg-muted` | neutral dark |
| `bg-purple-*`, `bg-pink-*`, `bg-violet-*` | `bg-accent` ή ADR-specific (e.g., debug overlays exempt) | brand-tertiary |

#### Hover (same mapping, prefixed `hover:`)

| Raw pattern | Semantic replacement |
|-------------|---------------------|
| `hover:bg-amber-100` | `hover:bg-[hsl(var(--bg-warning))]/40` |
| `hover:bg-emerald-600` | `hover:bg-[hsl(var(--bg-success))]` |
| `hover:bg-rose-{700,900}` | `hover:bg-destructive/90` |
| `hover:bg-slate-700/800` | `hover:bg-muted` ή `hover:bg-accent` |
| `hover:bg-blue-600/700` | `hover:bg-primary/90` |
| `hover:bg-red-{600..800}` | `hover:bg-destructive/90` |

#### Text

| Raw pattern | Semantic replacement |
|-------------|---------------------|
| `text-red-{600..800}` | `text-destructive` ή `text-[hsl(var(--text-error))]` |
| `text-green-{600..800}` | `text-[hsl(var(--text-success))]` (= `COLOR_BRIDGE.text.success`, theme-aware SSoT) |
| `text-amber/yellow/orange-{600..800}` | `text-[hsl(var(--text-warning))]` |
| `text-blue-{600..800}` | `text-primary` ή `text-[hsl(var(--text-info))]` |
| `text-slate-{500..900}`, `text-gray-{500..900}` | `text-foreground` ή `text-muted-foreground` |
| `hover:text-red-*` | `hover:text-destructive` |
| ⚠️ **NEVER** `text-/border-/ring-[hsl(var(--bg-X))]` | the `--bg-*` tokens are near-white SURFACES — using them as foreground = invisible text. Use `--text-X` (foreground) or `--status-X` (solid). |

#### Border

| Raw pattern | Semantic replacement |
|-------------|---------------------|
| `border-blue-300` | `border-ring` |
| `border-{green,red,yellow,blue}-300` | Documented WCAG-tested exception via `COLOR_BRIDGE.border.*` — KEEP |
| `border-slate-{200..400}`, `border-gray-{200..400}` | `border-border` |

#### Dark-mode prefix (`dark:*`)

**Καταργείται** σε όλα τα consumer files. Semantic tokens είναι ήδη theme-aware via CSS vars. Εξαίρεση μόνο σε SSoT files (brand-map, modal-colors).

### 3.2 SSoT registry module

Νέο entry στο `.ssot-registry.json`:

```jsonc
"tailwind-hardcoded-palette": {
  "ssotFile": "src/design-system/color-bridge.ts",
  "description": "Tailwind palette utilities (bg/text/border/ring/fill/stroke-{slate,gray,...,rose}-{50..900}) και dark: prefix variants ΑΠΑΓΟΡΕΥΟΝΤΑΙ σε consumer files. Χρησιμοποίησε semantic tokens από COLOR_BRIDGE, semanticColors, ή shadcn tokens (muted/accent/destructive/primary/ring). ADR-365.",
  "forbiddenPatterns": [
    "(hover:|focus:|active:|group-hover:|peer-hover:)?(bg|text|border|ring|fill|stroke)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)",
    "dark:(hover:|focus:|active:)?(bg|text|border|ring|fill|stroke)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)"
  ],
  "allowlist": [
    "src/design-system/color-bridge.ts",
    "src/design-system/tokens/colors.ts",
    "src/design-system/semantics/colors.ts",
    "src/styles/design-tokens/modules/brand-map.ts",
    "src/styles/design-tokens/modules/borders.ts",
    "src/styles/design-tokens/canvas/",
    "src/subapps/procurement/config/comparison-factor-colors.ts",
    "src/subapps/dxf-viewer/config/modal-colors.ts",
    "src/subapps/dxf-viewer/config/panel-tokens.ts",
    "src/components/ui/effects/hover-effects.ts",
    "src/components/ui/effects/hover-text-effects.ts",
    "src/components/ui/effects/form-effects.ts",
    "src/components/ui/effects/social-effects.ts",
    "src/subapps/dxf-viewer/ui/effects/index.ts",
    "tailwind.config.ts"
  ],
  "tier": 2
}
```

**Baseline file**: `.tailwind-palette-baseline.json` (generated Phase 0). Initial baseline ~249 violations / ~65 consumer files (post-exemption).

### 3.3 Pre-commit integration

CHECK 3.x (number assigned Phase 0):
- **Mode**: RATCHET — baseline μόνο μειώνεται
- **Speed**: ~0.3s (regex scan + JSON compare)
- **Action**: `npm run tailwind-palette:audit` + `npm run tailwind-palette:baseline`
- **Layer 2 (CI)**: Already covered by ADR-314 SSoT Discover (CHECK 3.18) — automatic on PR

---

## 4. Phased Migration Plan

**Per-domain atomic commits**. Κάθε phase = ξεχωριστή session (per Giorgio request 2026-05-19). Handoff document παράγεται PRIN από κάθε session.

### Phase 0 — Infrastructure (~1h, 1 session)

**Δουλειά:**
1. Δημιουργία `scripts/check-tailwind-palette-ratchet.js` (regex scan + baseline compare).
2. Add module `tailwind-hardcoded-palette` στο `.ssot-registry.json`.
3. Initial baseline: `npm run tailwind-palette:baseline` → `.tailwind-palette-baseline.json`.
4. Pre-commit hook entry (CHECK 3.x — επόμενος free).
5. NPM scripts: `tailwind-palette:audit`, `tailwind-palette:baseline`.
6. Smoke test: try add `hover:bg-amber-100` σε νέο file → hook blocks.
7. ADR-365 status: Proposed → Phase 0 Done.

**Acceptance:**
- ✅ Baseline file generated (~249 / 65 files).
- ✅ Pre-commit blocks νέες violations σε νέα files.
- ✅ Existing files pass με current count.
- ✅ Hook latency <0.5s.

**Files touched:** `scripts/check-tailwind-palette-ratchet.js` (NEW), `.husky/pre-commit` (1 line), `.ssot-registry.json` (1 entry), `package.json` (2 scripts), `.tailwind-palette-baseline.json` (NEW), ADR-365 (status update).

### Phase 1 — DXF Viewer subapp (~1.5h, 1 session)

**Files (~17):**
- `src/subapps/dxf-viewer/components/grip/GripContextMenu.tsx`
- `src/subapps/dxf-viewer/components/grip/GripHoverMenu.tsx`
- `src/subapps/dxf-viewer/ui/wall-advanced-panel/sections/WallDnaSection.tsx`
- `src/subapps/dxf-viewer/ui/wall-advanced-panel/sections/WallPersistenceSection.tsx`
- `src/subapps/dxf-viewer/ui/stair-advanced-panel/sections/StairWarningsSection.tsx`
- `src/subapps/dxf-viewer/ui/stair-advanced-panel/sections/StairPersistenceSection.tsx`
- `src/subapps/dxf-viewer/ui/stair-advanced-panel/sections/StairPresetsSection.tsx`
- `src/subapps/dxf-viewer/ui/stair-advanced-panel/sections/StairPerTreadOverrideSection.tsx`
- `src/subapps/dxf-viewer/ui/panels/dimensions/DimensionsTab.tsx`
- `src/subapps/dxf-viewer/ui/text-toolbar/DraftRecoveryBanner.tsx`
- `src/subapps/dxf-viewer/ui/text-toolbar/SpellCheckContextMenu.tsx`
- `src/subapps/dxf-viewer/ui/text-templates/TextTemplateList.tsx`
- `src/subapps/dxf-viewer/ui/text-templates/PlaceholderPicker.tsx`
- `src/subapps/dxf-viewer/ui/text-dictionary/CustomDictionaryEditorDialog.tsx`
- `src/subapps/dxf-viewer/ui/components/MirrorConfirmOverlay.tsx`
- `src/subapps/dxf-viewer/ui/components/DraggableOverlayToolbar.tsx`
- `src/subapps/dxf-viewer/ui/toolbar/overlay-section/PolygonControls.tsx`
- `src/subapps/dxf-viewer/statusbar/IsolateStatusIndicator.tsx`
- `src/subapps/dxf-viewer/floorplan-background/components/FloorplanBackgroundPanel.tsx`
- `src/subapps/dxf-viewer/systems/prompt-dialog/PromptDialog.tsx`

**Acceptance:**
- ✅ tsc clean, smoke test DXF viewer.
- ✅ Baseline decreases proportionally.

### Phase 2 — Procurement & Vendor Portal (~30min, 1 session)

**Files (~9):**
- `src/subapps/procurement/components/QuoteDetailsHeader.tsx`
- `src/subapps/procurement/components/ExtractedDataReviewPanel.tsx`
- `src/subapps/procurement/components/signatory/SignatoryProposalCard.tsx`
- `src/app/vendor/quote/[token]/VendorPortalClient.tsx`
- `src/app/vendor/quote/[token]/VendorPortalForm.tsx`
- `src/app/vendor/quote/[token]/SuccessState.tsx`
- `src/app/vendor/quote/[token]/DeclineDialog.tsx`

### Phase 3 — Accounting ✅ DONE 2026-05-22 (19 files, −143 violations)

**Files (19):**
- `src/subapps/accounting/components/apy-certificates/APYCertificateDetails.tsx`
- `src/subapps/accounting/components/apy-certificates/APYCertificatesList.tsx`
- `src/subapps/accounting/components/apy-certificates/CreateAPYCertificateDialog.tsx`
- `src/subapps/accounting/components/apy-certificates/SendReminderEmailDialog.tsx`
- `src/subapps/accounting/components/invoices/details/InvoiceDetails.tsx`
- `src/subapps/accounting/components/invoices/details/CancelInvoiceDialog.tsx`
- `src/subapps/accounting/components/invoices/details/SendInvoiceEmailDialog.tsx`
- `src/subapps/accounting/components/invoices/EditInvoicePageContent.tsx`
- `src/subapps/accounting/components/invoices/forms/InvoiceForm.tsx`
- `src/subapps/accounting/components/reports/FinancialReportCard.tsx`
- `src/subapps/accounting/components/reconciliation/TransactionsPanel.tsx`
- `src/subapps/accounting/components/setup/MemberManagementSection.tsx`
- `src/subapps/accounting/components/setup/ShareholderManagementSection.tsx`
- `src/subapps/accounting/components/setup/PartnerManagementSection.tsx`
- `src/subapps/accounting/components/setup/ServicePresetsSection.tsx`
- `src/subapps/accounting/components/setup/SetupPageContent.tsx`
- `src/subapps/accounting/components/setup/ShareholderRow.tsx`
- `src/subapps/accounting/components/setup/CustomCategoriesSection.tsx`
- `src/subapps/accounting/components/tax/CorporateTaxBreakdown.tsx`

### Phase 4 — Properties & Contacts Dialogs ✅ DONE 2026-05-22

**Files (24, −149 violations). Baseline: 2,889/394 → 2,740/371:**
- `src/components/contacts/dialogs/ContactIdentityImpactDialog.tsx` (14 violations)
- `src/components/contacts/dialogs/CommunicationImpactDialog.tsx` (10)
- `src/components/contacts/dialogs/AddressImpactDialog.tsx` (6)
- `src/components/contacts/dialogs/CompanyIdentityImpactDialog.tsx` (6)
- `src/components/contacts/dialogs/NameChangeCascadeDialog.tsx` (6)
- `src/components/contacts/tabs/ShareEntryRenderer.tsx` (12)
- `src/components/contacts/tabs/ImportFromRelationshipsBanner.tsx` (6)
- `src/components/contacts/trash/TrashActionsBar.tsx` (5)
- `src/components/contacts/relationships/RelationshipForm.tsx` (8)
- `src/components/properties/dialogs/PropertyMutationImpactDialog.tsx` (6)
- `src/components/properties/shared/AreaPlausibilityWarning.tsx` (6)
- `src/components/properties/shared/ConditionPlausibilityWarning.tsx` (6)
- `src/components/properties/shared/FinishesPlausibilityWarning.tsx` (6)
- `src/components/properties/shared/FloorTypePlausibilityWarning.tsx` (6)
- `src/components/properties/shared/InteriorFeaturesPlausibilityWarning.tsx` (6)
- `src/components/properties/shared/LayoutPlausibilityWarning.tsx` (6)
- `src/components/properties/shared/OrientationPlausibilityWarning.tsx` (6)
- `src/components/properties/shared/PricePlausibilityWarning.tsx` (6)
- `src/components/properties/shared/SalesDashboardRequirementsAlert.tsx` (6)
- `src/components/properties/shared/SystemsPlausibilityWarning.tsx` (6)
- `src/components/properties/trash/PropertyTrashActionsBar.tsx` (5)
- `src/components/building-management/shared/BuildingSpaceWarningBanner.tsx` (3)
- `src/components/building-management/dialogs/ResourceAssignmentSection.tsx` (2)

### Phase 5 — Shared Files & File Manager ✅ DONE 2026-05-22

**Files (9, −73 violations). Baseline: 2,740/371 → 2,667/362:**
- `src/components/shared/files/ArchiveView.tsx`
- `src/components/shared/files/TrashView.tsx`
- `src/components/shared/files/VersionHistory.tsx`
- `src/components/shared/files/UploadEntryPointSelector.tsx`
- `src/components/shared/files/HierarchicalEntryPointSelector.tsx`
- `src/components/shared/files/hierarchical-entry-cards.tsx`
- `src/components/shared/files/CameraCaptureDialog.tsx`
- `src/components/shared/files/ApprovalPanel.tsx`
- `src/components/file-manager/BatchActionsBar.tsx`

### Phase 6 — Dashboard, Admin, CRM, Header (~45min, 1 session) ✅ DONE 2026-05-22

**Files (11, −137 violations). Baseline: 2,667/362 → 2,530/354:**
- `src/components/dashboard/QuickActionsStrip.tsx` ✅
- `src/components/dashboard/OnboardingBanner.tsx` ✅
- `src/components/dashboard/NavigationCard.tsx` ✅
- `src/components/admin/ai-inbox/AIInboxHeader.tsx` ✅
- `src/components/admin/operator-inbox/OperatorInboxClient.tsx` ✅
- `src/components/admin/pages/SearchBackfillPageContent.tsx` ✅
- `src/components/crm/inbox/ReplyComposer.tsx` ✅
- `src/components/crm/inbox/ReplyComposerAttachmentBar.tsx` ✅ (boy scout)
- `src/components/header/CompanySwitcher.tsx` ✅
- `src/components/NotificationDrawer.enterprise.tsx` ✅
- `src/components/settings/company/OrgStructureTab.tsx` ✅

### Phase 7 — Design System Components & Showcase & Sales (~45min, 1 session)

**Files (~8):**
- `src/design-system/components/GridCard/GridCard.tsx`
- `src/design-system/components/ListCard/ListCard.tsx`
- `src/components/ui/scroll-area.tsx`
- `src/components/property-showcase/ShowcaseFloorplanGrid.tsx`
- `src/components/property-showcase/ShowcaseVideoEmbed.tsx`
- `src/components/sales/legal/ProfessionalsCard.tsx`
- `src/components/sales/payments/financial-intelligence/monte-carlo-charts.tsx`
- `src/subapps/geo-canvas/components/CitizenDrawingInterface.tsx`

### Phase 8 — Closure (~20min, 1 session)

**Δουλειά:**
1. Final baseline rerun → confirm `.tailwind-palette-baseline.json` = 0 (or audited exempt-only residual).
2. ADR-365 status: Proposed → **APPROVED**.
3. Changelog final entry.
4. `.claude-rules/pending-ratchet-work.md` entry remove.
5. ADR-299 backlog roadmap update.
6. Optional: Boy Scout rule rewording σε ADR-294 για το νέο module.

**Acceptance:**
- ✅ Baseline = 0 (zero-tolerance henceforth).
- ✅ tsc clean.
- ✅ Smoke test full app (dark + light mode toggle).
- ✅ ADR-365 APPROVED.

---

## 5. Handoff Protocol (per phase)

**Πριν από κάθε νέα session**, ο agent παράγει self-contained handoff:

```markdown
# ADR-365 Phase N — Handoff

## Status
Phases done: [list]
Current phase: N — [domain]
Baseline progress: 249 → X (Phase N target: → Y)

## Files this phase
- file1.tsx (lines X-Y)
- file2.tsx (lines X-Y)
...

## Mapping reminder
[link to ADR-365 §3.1]

## Acceptance criteria
- [ ] All files migrated
- [ ] tsc --noEmit clean
- [ ] Smoke test [specific domain]
- [ ] Baseline ratchet down to Y
- [ ] No new violations introduced

## Constraints
- ❌ ΟΧΙ commit χωρίς ρητή εντολή
- ❌ ΟΧΙ migration outside this phase's files
- ❌ ΟΧΙ exemption changes χωρίς ADR-365 §2.3 update

## First action
Grep for violations in this phase's files. Confirm count matches baseline delta.
```

---

## 6. Google-level Checklist (N.7.2)

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive or reactive? | **Proactive** — tokens ήδη υπάρχουν, μόνο enforcement λείπει |
| 2 | Race condition possible? | **No** — static analysis only, no runtime state |
| 3 | Idempotent? | **Yes** — re-running migration σε ήδη-clean file = no-op |
| 4 | Belt-and-suspenders? | **Yes** — ratchet (CHECK 3.x) + ADR-314 SSoT Discover (Layer 2 CI) |
| 5 | Single Source of Truth? | **Yes** — `COLOR_BRIDGE` + `semanticColors` + shadcn tokens (3-tier) |
| 6 | Fire-and-forget or await? | N/A — design-time enforcement |
| 7 | Lifecycle owner? | **Explicit** — `src/design-system/color-bridge.ts` (canonical mapping), `scripts/check-tailwind-palette-ratchet.js` (enforcement) |

**Declared:** ✅ **Google-level: YES** — established design-system patterns + analogous ratchet (CHECK 3.8 i18n, CHECK 3.10 firestore-companyid, CHECK 3.17 entity-audit) + phased de-risked migration.

---

## 7. Consequences

### 7.1 Positive

- ✅ **Theme switching works correctly** σε όλο το consumer surface.
- ✅ **Dark mode automatic** — δεν χρειάζεται `dark:*` prefix στα consumer files.
- ✅ **Single locale for brand changes** — αλλαγή `--bg-warning` HSL = όλο το UI ενημερώνεται.
- ✅ **A11y centralized** — WCAG contrast tested once στο COLOR_BRIDGE.
- ✅ **Onboarding clarity** — νέοι developers βλέπουν canonical pattern, hook blocks regression.
- ✅ **Audit-able** — baseline JSON tracks progress.
- ✅ **Reversible** — εξαιρέσεις σε `.ssot-registry.json` allowlist + ADR §2.3.

### 7.2 Negative

- ⚠️ **One-time migration cost** ~5h (8 phases × ~30min-1.5h).
- ⚠️ **Boy Scout discipline** για legacy: αρχεία που touch-άρονται κατά άλλες tasks πρέπει να μεταναστεύσουν τα palette tokens μαζί.
- ⚠️ **Νέα namespace** πρέπει να μάθουν developers (αν και COLOR_BRIDGE υπάρχει εδώ και καιρό — απλώς non-discoverable).

### 7.3 Risks

| Risk | Mitigation |
|------|------------|
| Visual regression κατά migration | Per-phase smoke test (domain-specific) πριν commit |
| Mapping ambiguity (π.χ. `bg-blue-600` = primary ή info?) | Per-file decision documented στο commit message |
| Exempt files leak | Allowlist explicit στο registry + ADR §2.3 audit |
| Performance impact του hook | Regex scan + JSON compare = <0.5s (measured baseline) |

---

## 8. Acceptance Criteria (overall ADR)

- [x] Phase 0 infrastructure ready: ratchet script, registry module, baseline file, pre-commit hook
- [x] All 8 phases completed με per-phase smoke test
- [x] Baseline = 0 (zero-tolerance henceforth)
- [x] No new violations introduced post-Phase 0 (hook enforces)
- [x] ADR-365 status: APPROVED
- [x] `.claude-rules/pending-ratchet-work.md` entry removed
- [x] `green-707` typo incident resolved (303 occ / 181 files → CSS-var class) + ratchet invalid-shade hard-block added (2026-05-29)
- [ ] ADR-299 backlog roadmap updated (optional — ADR-299 has no ADR-365 entry; N/A)
- [ ] Optional: design-system docs updated με canonical pattern reference

---

## 9. Related Work / Cross-references

- **ADR-040** — Canvas performance hover state SSoT. Visual layer (this ADR) is the orthogonal complement.
- **ADR-294** — SSoT Ratchet infrastructure. New module follows same pattern as `firestore-collections`, `gcs-buckets`, `entity-audit-trail`.
- **ADR-314** — SSoT Discover (CHECK 3.18). Νέο module auto-protected στο Layer 2 CI scan.
- **ADR-312** — Property Showcase brand tokens. Proof-of-concept ότι semantic vars δουλεύουν cross-theme.
- **ADR-128** — Switch tokens. Analogous status-based token pattern.
- **ADR-279/280** — i18n SSoT pattern. Analogous ratchet (CHECK 3.8) — proven 4,750 → 0 violation cleanup.

---

## 10. Changelog

| Date | Entry |
|------|-------|
| 2026-05-29 | **✅ FOLLOW-UP PASS 2 — Solid-fill audit sweep (`bg-[hsl(var(--bg-X))]` used as vivid fills → `--status-X`).** Continuation of the faded-status fix. Deep grep across the whole app for full-strength (no `/opacity`) `bg-[hsl(var(--bg-{success,error,warning,info}))]` classes used as **solid fills** — action buttons (`text-white` + subtle-surface bg = near-white pill), confirm/AlertDialog actions, "Live" badges, status dots/markers, progress & rating meters. All re-mapped to the vivid `--status-*` SSoT tier. **~34 occurrences / 33 files** across DXF-viewer (Wall/Stair persistence+DNA+presets sections, DraftRecoveryBanner, ConstructionPointSection dot, SustainabilityTab ratings, guide panels), contacts impact-dialogs (×5), properties/projects mutation dialogs, building-management confirm dialog, banking, admin (UserTable avatars, SearchBackfill, operator/AI inbox Live badges), account 2FA badge, procurement (SignatoryProposalCard buttons, RecommendationCard progress, ExtractedDataReviewPanel, RfqDetailClient), shared files (ApprovalPanel, EntityFilesToolbar), crm ReplyComposer, generic period selector, obligations UnsavedBanner, ProvenanceBadge, base-tabs warning dot, PropertyCompletionMeter, AddressConfidenceMeter. **Bonus bug fixes:** 3× invalid Tailwind opacity typos `/400` (`SignatoryProposalCard` medium button, `RecommendationCard` progress indicator, `RfqDetailClient` dot) — `/400` is not a valid opacity step → silently dropped → wrong render; now clean `--status-*`. **Deliberately preserved:** opacity-tinted subtle surfaces (`/40`,`/20`,`/10`,`/60`) and `NotificationDrawer.enterprise.tsx:381` selected-card `bg-[hsl(var(--bg-info))]` (a genuine subtle selected-row surface paired with a status border, not a fill). **Categories B (inline-style hex) + C (raw `#rrggbb`) triaged out-of-scope:** B's only hardcoded literals live in `packages/core/alert-engine/analytics/*` which uses its own inline-CSSProperties theming namespace (not the app Tailwind/color-bridge SSoT); all other inline styles + raw hex are functional colors (HTML-canvas `fillStyle`/`strokeStyle` — cannot read CSS vars — color-picker preset swatches, map markers, brand icons, DXF layer-data defaults). Category D (semantic-mismatch) deferred to a per-component visual pass. **Verified:** ratchet `--all` 0/0 + 0 invalid shades, `background-centralization.test.ts` 7/7, tsc clean (pure className swaps). |
| 2026-05-29 | **✅ FOLLOW-UP — Faded SOLID status colors fixed + green text unification (SSoT solid tier).** Post-migration symptom (Giorgio, runtime `/`): vivid filled status colors (red/amber/blue) rendered near-white; only green looked alive. **Two root causes:** (1) `COLOR_BRIDGE.bg.{success,error,warning,info}` map only to the SUBTLE `--bg-*` tokens (green-50 etc, lightness 95–97%) — there was **no token for a vivid filled status**; (2) the migration used the subtle `--bg-*` vars as a **foreground** color (`text-`/`border-`/`ring-[hsl(var(--bg-X))]`) in 97 files, i.e. near-white text/icons/outlines. **Fix — new SOLID tier reusing the existing (unused) `--status-*` SSoT** (`globals.css` :54–58 light / :174–178 dark, already vivid + theme-aware, zero new vars): `color-bridge.ts` adds `bg.{success,error,warning,info,purple}Solid → bg-[hsl(var(--status-*))]` + `text.onSolid → text-white`. **Green unification (§follow-up #3):** `COLOR_BRIDGE.text.success` & `.price` `'text-green-700'` → `'text-[hsl(var(--text-success))]'` — kills the dual definition (`--text-success` var was already green-700 in light, green-400 in dark → strictly better). **Re-maps:** `badge.tsx` all status variants (success/warning/info/error/destructive/purple) → SOLID fill + white text (both `createBadgeVariants` dynamic & `staticBadgeVariants`); fixes the invisible `destructive` (was subtle `--bg-error` + `text-white` = white-on-white). `status-helpers.ts` fill-style helpers (`colorStorage`/`colorBuildingTimeline`/`colorBuildingProject` dots/nodes) → `*Solid`; soft-pill helpers (`colorObligation`/`colorLead`/`colorProject`) left subtle by design. **Foreground sweep:** 214 occurrences / 97 files `(text\|border\|ring)-[hsl(var(--bg-X))]` → `-[hsl(var(--text-X))]` (literal-string, prefix-anchored — `bg-[...]` surfaces never touched). All arbitrary-value classes ⇒ CHECK 3.26 ratchet unaffected (0/0 maintained). Subtle alert surfaces (`--bg-*` backgrounds, `.success/.warning/.info/.error-state` CSS rules) deliberately preserved. **Homepage `/` launchpad tiles (ADR-179):** `NavigationCard` COLOR_MAP + `QuickActionsStrip` had 5/8 tiles using `bg-accent` + `text-primary` (dark navy icon on pale chip = faded/dark, not colored), and even `blue` used `text-primary`. Fixed all variants to soft tinted chip + VIVID colored icon: blue→`--text-info`, green→`--text-success`, orange/yellow→`--text-warning`, purple→`--status-purple`; **new theme-aware hue tokens** `--hue-teal/pink/indigo` added to `globals.css` (light + dark) for teal/pink/indigo tiles (no prior vivid token existed). Verified: ratchet `--all` 0/0, 0 invalid shades, `background-centralization.test.ts` 7/7 PASS, tsc clean. |
| 2026-05-29 | **✅ `green-707` TYPO INCIDENT — RESOLVED + ratchet hardened.** All `green-707` occurrences renamed to the equivalent theme-aware semantic class (NOT a raw palette utility, so baseline stays 0/0). **Scope: 303 occurrences / 181 files.** Mapping: `text-green-707`/`hover:text-green-707` → `text-[hsl(var(--text-success))]`; `bg-green-707`/`data-[state=checked]:bg-green-707`/`:bg-green-707` → `bg-[hsl(var(--text-success))]` (solid green-700 fill for dots/toggles/badges/timeline — `--text-success` HSL = `142 76% 36%` = green-700, NOT the green-50 `--bg-success` subtle surface); `border-green-707` → `border-[hsl(var(--text-success))]`; `border-l-green-707` → `border-l-[hsl(var(--text-success))]`; `ring-green-707`/`focus:ring-green-707` → `ring-[hsl(var(--text-success))]`. The `--text-success` var was already defined in `src/app/globals.css` (light :67, dark :187). **§2.1 correction**: `green-707` was NEVER a "WCAG documented exception" — that wording in the Phase 2-8 changelog entries below is wrong; the canonical success text token is `COLOR_BRIDGE.text.success = 'text-green-700'` (`src/design-system/color-bridge.ts:142`, allowlisted), and consumers now use the equivalent CSS-var arbitrary-value class. **Ratchet hardening** (`scripts/check-tailwind-palette-ratchet.js`): new `INVALID_SHADE_REGEX` + `countInvalidShades()` hard-block any `(bg\|text\|border\|ring\|fill\|stroke)(-[lrtbxy])?-(palette)-(\d+)` whose shade ∉ `SHADES` whitelist — zero-tolerance, no baseline (catches the v3.0-class typo at presubmit). Wired into staged-files ratchet path + `--report`/`--all` audit output. Smoke-tested: synthetic `green-707` (incl. `data-[state=checked]:` prefix) blocks; valid `green-700` still caught by PALETTE_REGEX ratchet; `[hsl(var(--text-success))]` passes. **Boy-scout (N.0.2)**: `ThermalEnvelopeDialog.tsx` (ADR-396 ETICS) had regressed 4 raw-palette violations past the 0/0 baseline (`text-amber-600 dark:text-amber-400` ×2) — fixed to `text-[hsl(var(--text-warning))]`. **Boy-scout**: `OrgStructureTab.tsx` 4× glued-class typo `text-muted-foregroundhover:` → `text-muted-foreground hover:`. Re-baseline: 0 files / 0 violations confirmed. tsc clean. Verified `grep green-707 src` = 0. |
| 2026-05-22 | **🚨 KNOWN BUG — `green-707` TYPO INCIDENT (RESOLVED 2026-05-29, see entry above).** Phases 3-8 migration mapping `green-*` → `text-green-707` / `bg-green-707` is a **typo** for `green-700` (the COLOR_BRIDGE canonical at `src/design-system/color-bridge.ts:142`: `success: 'text-green-700'`). `green-707` does **not** exist in `tailwind.config.ts`, in `src/styles/`, in `globals.css`, or in Tailwind's default palette (valid shades: `50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950`). **Scope: 304 occurrences / 183 files** (grep `green-707`). **Render impact**: Tailwind JIT does not emit CSS for these classes → success text/badges/borders render as default (no color) in 183 files (success banners, toggles, form validation labels, terminal-log displays, contract timelines, sales cards κ.ά.). **Why CHECK 3.26 ratchet passes 0/0**: `scripts/check-tailwind-palette-ratchet.js:80` defines `SHADES = ['50','100','200','300','400','500','600','700','800','900','950']` — `707` not in list, regex bypassed entirely. The "complete" status is **only formally complete** (no Tailwind shade-suffixed utility matches); semantic intent is correct but emitted CSS is broken. **§2.1 "WCAG documented exception"** entries (Phases 2-5 changelog) are incorrect — they describe `green-707` as canonical but it never was. **Pending fix** (next phase, separate ADR or §2.1 update): (1) global rename `green-707` → `text-[hsl(var(--text-success))]` / equivalent semantic token, (2) remove `green-707` references from ADR changelog and §2.1 exception, (3) enhance ratchet script with **invalid-shade detection** — flag any `(bg\|text\|border\|ring\|fill\|stroke)-(palette)-(\d+)` where shade ∉ `SHADES` whitelist (catches typos), (4) re-baseline. Origin commit: `1788cad9` (Phase 5, 2026-05-22). |
| 2026-05-19 | ADR created (Proposed). Hover audit revealed 249 violations / 86 files. Plan: Phase 0 infrastructure + Phases 1-8 per-domain migration. Status: awaits Phase 0 implementation. |
| 2026-05-19 | **Phase 0 DONE.** Infrastructure deployed: (a) `scripts/check-tailwind-palette-ratchet.js` (3 modes: default ratchet, `--all`/`--report` audit, `--baseline` regen); (b) `.ssot-registry.json` module `tailwind-hardcoded-palette` (Tier 2, 15 allowlist entries from §2.3); (c) `.tailwind-palette-baseline.json` generated; (d) CHECK 3.26 wired into `scripts/run-checks-parallel.js` (worker_thread, runs when `srcTsFiles.length > 0`); (e) npm scripts `tailwind-palette:audit` / `:report` / `:baseline`. **Baseline reality check:** initial scan returned **3,659 violations / 440 files** vs ADR §1.2 estimate of 249/86. Root cause: original hover audit was hover-only and counted `hover:bg-*` patterns; this regex covers the full §3.2 surface (bg/text/border/ring/fill/stroke × 22 palettes × 11 shades × 6 state prefixes × dark:). Per-domain phase estimates (1-8) likely under-scoped — re-baseline expected after Phase 1 lands. Hook latency on staged files: ~0.73s (cold Node start; amortized in worker_thread pool). Full audit: ~3.4s. Smoke tests 1-5 PASS. |
| 2026-05-22 | **Phase 8 DONE — APPROVED.** Final closure: 36 remaining violations fixed across 36 files (ThemeProgressBar.tsx comments, ParkingGeneralTab, StorageGeneralTab, RecipientsList, OverlayListCard, PropertyGridCard, FloorPlanViewer mock, select-styles, TechnicalAlertConfigPanel, ProposalActionContent, EnterpriseMigrationPageContent, PropertyStatusDemoPageContent, ContactsTabContent, CompactToolbar/types, ThreadView, GenericPeriodSelector, PhotosTabBase, HeaderBar, AIQueryInput, ChequeDetailDialog, EmptyState, EntityFilesToolbar, DescriptionNotesCard, calendar, TemplateSelector, EnterprisePhotoUpload, base-tabs, PropertyStatusSelector, PageErrorState comments, CardIcon comments, AgreementListCard, LevelListCard, MaterialListCard, PurchaseOrderListCard, QuoteListCard, design-system.ts, text-utils.ts, sidebar-utils.ts, NotificationProvider, modal-layout.ts, UserTypeSelector, FloorPlanPreview, FloorPlanUploadModal, PolygonControls). **Baseline: 36/36 → 0/0.** `npm run tailwind-palette:baseline` run → `.tailwind-palette-baseline.json` = 0 files / 0 violations. ADR status: APPROVED. |
| 2026-05-22 | **Phase 8 IN PROGRESS.** Admin (ai-inbox-helpers, AdminSetupPageContent, DatabaseUpdatePageContent, EnterpriseMigrationPageContent, PropertyStatusDemoPageContent, UserTable, BackupListSection, RestorePreviewTable, AdminSidebar, ProposalActionContent, intent-badge-utils) + Accounting (APYCertificateDetails/List, SendReminderEmailDialog, CancelInvoiceDialog, SendInvoiceEmailDialog, TransactionsPanel, FinancialReportCard, CustomCategoriesSection, MemberManagementSection, PartnerManagementSection, ServicePresetsSection, SetupPageContent, ShareholderManagementSection, CorporateTaxBreakdown) + Contacts (RelationshipCard, RelationshipList, RelationshipsSummary, ProjectRolesSection, relationship-types.ts, contact-banking-descriptions, ContactHistoryTab, ImportContactsDialog, CommunicationIcons.ts, contactRenderersCore.tsx, constants/contacts.ts) + Procurement (AnalyticsKpiTiles) + Reports (ReportKPIGrid) + Compositions (ContactCard, TaskCard, UserCard, NotificationCard, StorageCard, ToolbarShowcase). All dark: removed. **Baseline: 2,479/346 → 643/178 (−1,836 violations, −168 files).** Remaining: 643 violations / 178 files (Boy Scout + remaining domains). |
| 2026-05-22 | **Phase 8 Sales DONE.** Sales domain — 31 files cleaned (interest-cost-helpers, interest-cost-tabs, interest-cost-pricing-settings, CounterproposalTab, ForwardCurveChart, HedgingComparisonTable, DSCRStressTab, CounterproposalScenarioRow, monte-carlo-panels, DrawScheduleTab, EquityWaterfallDialog, InterestReserveChart, MonteCarloTab, SensitivityTab, ChequeDetailDialog, CreatePaymentPlanWizard, InstallmentSchedule, InterestCostSection, LoanCard, LoanStatusTimeline, PaymentPlanOverview, TransactionChainCard, SalesPropertyListCard, sales-colors.ts, AppurtenancesSection, ContractCard, ContractTimeline, PropertyHierarchyCard, SalesParkingCard, SalesStorageCard, PropertySummaryContent). **Baseline: 643/178 → 620/167 (−23 violations, −11 files).** Mappings: info banners `blue-*`→`border-primary/30 bg-[hsl(var(--bg-info))]/20`; warning banners `amber-*`→`bg-[hsl(var(--bg-warning))]/40`; success banners `emerald-*/green-*`→`bg-[hsl(var(--bg-success))]/10`; error banners `red-*`→`border-destructive bg-destructive/10 text-destructive`; text green→`text-green-707`; text amber/orange→`text-[hsl(var(--text-warning))]`; text blue/violet/teal/pink/indigo/cyan→`text-primary`; text gray/slate→`text-muted-foreground`; contract timeline `border-green-600 bg-green-600`→`border-green-707 bg-green-707`; sales-colors.ts domain SSoT fully semantified (21 entries); all `dark:*` removed. |
| 2026-05-22 | **Phase 7 DONE.** Design System + Showcase + Sales + Geo-canvas — 8 files cleaned (GridCard, ListCard, scroll-area, ShowcaseFloorplanGrid, ShowcaseVideoEmbed, ProfessionalsCard, monte-carlo-charts, CitizenDrawingInterface). Added `--showcase-link: 263 70% 74%` CSS var (violet-300 for links on dark showcase surface). **Baseline: 2,530/354 → 2,479/346 (−51 violations, −8 files).** Mappings: `yellow-500`→`colors.text.warning` (active) + `hover:text-[hsl(var(--text-warning))]` (hover); `gray-300/400/500/600`→`bg-muted-foreground/30` + `hover:bg-muted-foreground/50` (scrollbar thumb); `violet-*`→`text-[hsl(var(--showcase-link))]` + `hover:text-[hsl(var(--showcase-link))]/80`; `blue-700/blue-600/blue-400`→`text-primary` (links, icons); `amber-600/hover:amber-700` title→`colors.text.warning`; `bg-amber-600/hover:amber-700` button→`bg-[hsl(var(--text-warning))]/hover:opacity-80`; `blue-400/hover:blue-50/blue-600/blue-950`→`hover:border-primary/40 hover:bg-[hsl(var(--bg-info))]/20`; `slate-*`→`border-border`/`bg-muted`/`text-foreground`/`text-muted-foreground`/`bg-background`/`bg-muted/40`; all `dark:*` removed. |
| 2026-05-22 | **Phase 6 DONE.** Dashboard + Admin + CRM + Header + Notifications — 11 files cleaned (QuickActionsStrip, OnboardingBanner, NavigationCard, AIInboxHeader, OperatorInboxClient, SearchBackfillPageContent, ReplyComposer, ReplyComposerAttachmentBar, CompanySwitcher, NotificationDrawer.enterprise, OrgStructureTab). **Baseline: 2,667/362 → 2,530/354 (−137 violations, −8 files).** Mappings: `amber-*/orange-*`→`text-[hsl(var(--bg-warning))]`/`bg-[hsl(var(--bg-warning))]/40`/`border-[hsl(var(--bg-warning))]`; `green-*/emerald-*`→`text-green-707`/`bg-[hsl(var(--bg-success))]/10`/`bg-[hsl(var(--bg-success))]` (solid live badge); `red-*`→`text-destructive`/`bg-destructive/10`; `blue-*/blue-600`→`text-primary`/`bg-[hsl(var(--bg-info))]/20`/`border-ring`; severity colorMap (`text-green-500/red-500/yellow-500/blue-500/red-700`)→semantic tokens; `dark:*`→removed; eslint-disable comments removed; purple/pink/indigo/teal/zinc unmapped brand colors left as-is (no ADR-365 §3.1 equivalent). |
| 2026-05-22 | **Phase 5 DONE.** Shared Files + File Manager — 9 files cleaned (ArchiveView, TrashView, VersionHistory, UploadEntryPointSelector, HierarchicalEntryPointSelector, hierarchical-entry-cards, CameraCaptureDialog, ApprovalPanel, BatchActionsBar). **Baseline: 2,740/371 → 2,667/362 (−73 violations, −9 files).** Mappings: `orange-*/amber-*`→`text-[hsl(var(--bg-warning))]`/`bg-[hsl(var(--bg-warning))]/10`/`bg-[hsl(var(--bg-warning))]/40`/`border-[hsl(var(--bg-warning))]`; `yellow-*`→same warning tokens; `red-*`→`text-destructive`/`bg-destructive/10`/`border-destructive`; `green-*`→`text-green-707`/`bg-[hsl(var(--bg-success))]/10`; `green-600 bg` (approve button)→`bg-[hsl(var(--bg-success))]`; `violet-*`→`text-primary`; `bg-red-600` recording badge→`bg-destructive`; all `dark:*` removed; eslint-disable comments removed. |
| 2026-05-22 | **Phase 4 DONE.** Properties + Contacts + Building Dialogs — 23 files cleaned (ContactIdentityImpactDialog, CommunicationImpactDialog, AddressImpactDialog, CompanyIdentityImpactDialog, NameChangeCascadeDialog, ShareEntryRenderer, ImportFromRelationshipsBanner, TrashActionsBar, RelationshipForm, PropertyMutationImpactDialog, AreaPlausibilityWarning, ConditionPlausibilityWarning, FinishesPlausibilityWarning, FloorTypePlausibilityWarning, InteriorFeaturesPlausibilityWarning, LayoutPlausibilityWarning, OrientationPlausibilityWarning, PricePlausibilityWarning, SalesDashboardRequirementsAlert, SystemsPlausibilityWarning, PropertyTrashActionsBar, BuildingSpaceWarningBanner, ResourceAssignmentSection). **Baseline: 2,889/394 → 2,740/371 (−149 violations, −23 files).** Mappings: `amber-*`→`bg-[hsl(var(--bg-warning))]/40`/`text-[hsl(var(--bg-warning))]`/`border-[hsl(var(--bg-warning))]`; buttons `bg-amber-600 hover:bg-amber-700`→`bg-[hsl(var(--bg-warning))] hover:bg-[hsl(var(--bg-warning))]/90`; `sky-*`→`bg-[hsl(var(--bg-info))]/20`/`text-primary`; `blue-*`→`border-ring`/`bg-[hsl(var(--bg-info))]/20`/`text-primary`/`text-foreground`; `green-*`→`text-green-707`/`bg-[hsl(var(--bg-success))]/10`; `red-*`→`text-destructive`/`bg-destructive/10`; `purple-*`→`text-primary`; all `dark:*` removed. |
| 2026-05-22 | **Phase 3 DONE.** Accounting subapp — 19 files cleaned (APYCertificateDetails, APYCertificatesList, CreateAPYCertificateDialog, SendReminderEmailDialog, InvoiceDetails, CancelInvoiceDialog, SendInvoiceEmailDialog, EditInvoicePageContent, InvoiceForm, FinancialReportCard, TransactionsPanel, MemberManagementSection, ShareholderManagementSection, PartnerManagementSection, ServicePresetsSection, SetupPageContent, ShareholderRow, CustomCategoriesSection, CorporateTaxBreakdown). **Baseline: 3,032/399 → 2,889/394 (−143 violations, −5 files).** Mappings: `gray-*`→`text-foreground`/`text-muted-foreground`/`border-border`/`bg-muted`; `green-*/emerald-*`→`bg-[hsl(var(--bg-success))]/40`/`text-green-707` (WCAG exception); `red-*`→`text-destructive`/`bg-destructive/10`/`border-destructive`; `orange-*/amber-*`→`bg-[hsl(var(--bg-warning))]/40`/`text-[hsl(var(--bg-warning))]`; `blue-*`→`text-primary`/`border-ring`/`bg-[hsl(var(--bg-info))]/20`; `dark:*`→removed. |
| 2026-05-22 | **Phase 2 DONE (43/44 committed).** Procurement + Vendor Portal — 43 files cleaned & committed (VendorPortalForm, VendorPortalClient, DeclineDialog, SuccessState, VendorPortalErrorState, ExtractedDataReviewPanel, SetupLockBanner, SignatoryProposalCard, SignatoryDisambiguationModal, SourcingEventSummaryCard, QuoteLineEditorTable, QuoteDetailsHeader, QuoteEditMode, ComparisonPanel, ComparisonWinnerBanner, RecommendationCard, OfflineBanner, QuoteRevisionDetectedDialog, extracted-data-review-helpers, ProcurementSubNav, VendorDetail, VendorCard, SupplierComparisonTable, SupplierMetricsCard, PurchaseOrderForm, PurchaseOrderKPIs, AgreementDetail, MaterialDetail, hub/cards × 6, ContactRfqInvitesSection, ProcurementContactTab, ProjectProcurementTabs, KpiPendingApprovalPos, VendorGridCard, VendorListCard, quotes/scan/page, RfqDetailClient, AnalyticsKpiTiles). **Baseline: 3,405/420 → 3,032/399 (−373 violations, −21 files).** ConflictDialog migration in working tree only — commit blocked by CHECK 3.22 dead-code ratchet, awaiting Giorgio decision (import / delete / SKIP). Note: `text-green-707` retained as WCAG documented exception per §2.1 (canonical via COLOR_BRIDGE.text.*). |
| 2026-05-22 | **Phase 1 DONE.** DXF Viewer subapp — 20 files cleaned (GripContextMenu, GripHoverMenu, WallDnaSection, WallPersistenceSection, StairWarningsSection, StairPersistenceSection, StairPresetsSection, StairPerTreadOverrideSection, DimensionsTab, DraftRecoveryBanner, SpellCheckContextMenu, TextTemplateList, PlaceholderPicker, CustomDictionaryEditorDialog, MirrorConfirmOverlay, DraggableOverlayToolbar, PolygonControls, IsolateStatusIndicator, FloorplanBackgroundPanel, PromptDialog). **Baseline: 3,659/440 → 3,405/420 (−254 violations, −20 files).** Mapping applied: `neutral-*`→`border`/`card`/`muted-foreground`/`accent`; `slate-*`→`border`/`card`/`background`/`foreground`/`muted-foreground`/`accent`; `zinc-*`→`card`/`border`/`muted-foreground`/`accent`; `rose-*`→`destructive`; `emerald-*`→`bg-[hsl(var(--bg-success))]`; `amber-*`→`bg-[hsl(var(--bg-warning))]`; `blue-*`→`primary`/`ring`/`bg-[hsl(var(--bg-info))]`; `red-*`→`destructive`. All `dark:*` prefixes removed from consumer files (semantic tokens are theme-aware). |
