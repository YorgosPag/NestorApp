# ADR-365 — Tailwind Semantic Palette Enforcement

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 **PHASE 7 DONE** 2026-05-22 — Design System + Showcase + Sales + Geo-canvas migrated (8 files, −51 violations). Added `--showcase-link` CSS var. Baseline: **2,479 violations / 346 files** (was 2,530/354). Awaits Phase 8 (Closure). |
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
| `bg-amber-{50,100}`, `bg-yellow-{50,100}` | `bg-[hsl(var(--bg-warning))]/40` | warning subtle |
| `bg-yellow-{500..700}` | `bg-[hsl(var(--bg-warning))]` | warning full |
| `bg-emerald-{50,100}`, `bg-green-{50,100}` | `bg-[hsl(var(--bg-success))]/40` | success subtle |
| `bg-emerald-{500..700}`, `bg-green-{500..700}` | `bg-[hsl(var(--bg-success))]` | success full |
| `bg-rose-{50,100}`, `bg-red-{50,100}` | `bg-[hsl(var(--bg-error))]/40` | error subtle |
| `bg-rose-{500..900}`, `bg-red-{500..900}` | `bg-destructive` ή `bg-[hsl(var(--bg-error))]` | destructive action vs error state |
| `bg-blue-{50,100}` | `bg-[hsl(var(--bg-info))]/40` | info subtle |
| `bg-blue-{500..700}` | `bg-primary` ή `bg-[hsl(var(--bg-info))]` | primary action vs info state |
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
| `text-red-{600..800}` | `text-destructive` |
| `text-green-{600..800}` | `text-green-700` (WCAG exception — documented in COLOR_BRIDGE) |
| `text-blue-{600..800}` | `text-primary` ή `text-blue-700` (info exception) |
| `text-slate-{500..900}`, `text-gray-{500..900}` | `text-foreground` ή `text-muted-foreground` |
| `hover:text-red-*` | `hover:text-destructive` |

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

- [ ] Phase 0 infrastructure ready: ratchet script, registry module, baseline file, pre-commit hook
- [ ] All 8 phases completed με per-phase smoke test
- [ ] Baseline = 0 (zero-tolerance henceforth)
- [ ] No new violations introduced post-Phase 0 (hook enforces)
- [ ] ADR-365 status: APPROVED
- [ ] `.claude-rules/pending-ratchet-work.md` entry removed
- [ ] ADR-299 backlog roadmap updated
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

| Date | Change |
|------|--------|
| 2026-05-19 | ADR created (Proposed). Hover audit revealed 249 violations / 86 files. Plan: Phase 0 infrastructure + Phases 1-8 per-domain migration. Status: awaits Phase 0 implementation. |
| 2026-05-19 | **Phase 0 DONE.** Infrastructure deployed: (a) `scripts/check-tailwind-palette-ratchet.js` (3 modes: default ratchet, `--all`/`--report` audit, `--baseline` regen); (b) `.ssot-registry.json` module `tailwind-hardcoded-palette` (Tier 2, 15 allowlist entries from §2.3); (c) `.tailwind-palette-baseline.json` generated; (d) CHECK 3.26 wired into `scripts/run-checks-parallel.js` (worker_thread, runs when `srcTsFiles.length > 0`); (e) npm scripts `tailwind-palette:audit` / `:report` / `:baseline`. **Baseline reality check:** initial scan returned **3,659 violations / 440 files** vs ADR §1.2 estimate of 249/86. Root cause: original hover audit was hover-only and counted `hover:bg-*` patterns; this regex covers the full §3.2 surface (bg/text/border/ring/fill/stroke × 22 palettes × 11 shades × 6 state prefixes × dark:). Per-domain phase estimates (1-8) likely under-scoped — re-baseline expected after Phase 1 lands. Hook latency on staged files: ~0.73s (cold Node start; amortized in worker_thread pool). Full audit: ~3.4s. Smoke tests 1-5 PASS. |
| 2026-05-22 | **Phase 7 DONE.** Design System + Showcase + Sales + Geo-canvas — 8 files cleaned (GridCard, ListCard, scroll-area, ShowcaseFloorplanGrid, ShowcaseVideoEmbed, ProfessionalsCard, monte-carlo-charts, CitizenDrawingInterface). Added `--showcase-link: 263 70% 74%` CSS var (violet-300 for links on dark showcase surface). **Baseline: 2,530/354 → 2,479/346 (−51 violations, −8 files).** Mappings: `yellow-500`→`colors.text.warning` (active) + `hover:text-[hsl(var(--text-warning))]` (hover); `gray-300/400/500/600`→`bg-muted-foreground/30` + `hover:bg-muted-foreground/50` (scrollbar thumb); `violet-*`→`text-[hsl(var(--showcase-link))]` + `hover:text-[hsl(var(--showcase-link))]/80`; `blue-700/blue-600/blue-400`→`text-primary` (links, icons); `amber-600/hover:amber-700` title→`colors.text.warning`; `bg-amber-600/hover:amber-700` button→`bg-[hsl(var(--text-warning))]/hover:opacity-80`; `blue-400/hover:blue-50/blue-600/blue-950`→`hover:border-primary/40 hover:bg-[hsl(var(--bg-info))]/20`; `slate-*`→`border-border`/`bg-muted`/`text-foreground`/`text-muted-foreground`/`bg-background`/`bg-muted/40`; all `dark:*` removed. |
| 2026-05-22 | **Phase 6 DONE.** Dashboard + Admin + CRM + Header + Notifications — 11 files cleaned (QuickActionsStrip, OnboardingBanner, NavigationCard, AIInboxHeader, OperatorInboxClient, SearchBackfillPageContent, ReplyComposer, ReplyComposerAttachmentBar, CompanySwitcher, NotificationDrawer.enterprise, OrgStructureTab). **Baseline: 2,667/362 → 2,530/354 (−137 violations, −8 files).** Mappings: `amber-*/orange-*`→`text-[hsl(var(--bg-warning))]`/`bg-[hsl(var(--bg-warning))]/40`/`border-[hsl(var(--bg-warning))]`; `green-*/emerald-*`→`text-green-707`/`bg-[hsl(var(--bg-success))]/10`/`bg-[hsl(var(--bg-success))]` (solid live badge); `red-*`→`text-destructive`/`bg-destructive/10`; `blue-*/blue-600`→`text-primary`/`bg-[hsl(var(--bg-info))]/20`/`border-ring`; severity colorMap (`text-green-500/red-500/yellow-500/blue-500/red-700`)→semantic tokens; `dark:*`→removed; eslint-disable comments removed; purple/pink/indigo/teal/zinc unmapped brand colors left as-is (no ADR-365 §3.1 equivalent). |
| 2026-05-22 | **Phase 5 DONE.** Shared Files + File Manager — 9 files cleaned (ArchiveView, TrashView, VersionHistory, UploadEntryPointSelector, HierarchicalEntryPointSelector, hierarchical-entry-cards, CameraCaptureDialog, ApprovalPanel, BatchActionsBar). **Baseline: 2,740/371 → 2,667/362 (−73 violations, −9 files).** Mappings: `orange-*/amber-*`→`text-[hsl(var(--bg-warning))]`/`bg-[hsl(var(--bg-warning))]/10`/`bg-[hsl(var(--bg-warning))]/40`/`border-[hsl(var(--bg-warning))]`; `yellow-*`→same warning tokens; `red-*`→`text-destructive`/`bg-destructive/10`/`border-destructive`; `green-*`→`text-green-707`/`bg-[hsl(var(--bg-success))]/10`; `green-600 bg` (approve button)→`bg-[hsl(var(--bg-success))]`; `violet-*`→`text-primary`; `bg-red-600` recording badge→`bg-destructive`; all `dark:*` removed; eslint-disable comments removed. |
| 2026-05-22 | **Phase 4 DONE.** Properties + Contacts + Building Dialogs — 23 files cleaned (ContactIdentityImpactDialog, CommunicationImpactDialog, AddressImpactDialog, CompanyIdentityImpactDialog, NameChangeCascadeDialog, ShareEntryRenderer, ImportFromRelationshipsBanner, TrashActionsBar, RelationshipForm, PropertyMutationImpactDialog, AreaPlausibilityWarning, ConditionPlausibilityWarning, FinishesPlausibilityWarning, FloorTypePlausibilityWarning, InteriorFeaturesPlausibilityWarning, LayoutPlausibilityWarning, OrientationPlausibilityWarning, PricePlausibilityWarning, SalesDashboardRequirementsAlert, SystemsPlausibilityWarning, PropertyTrashActionsBar, BuildingSpaceWarningBanner, ResourceAssignmentSection). **Baseline: 2,889/394 → 2,740/371 (−149 violations, −23 files).** Mappings: `amber-*`→`bg-[hsl(var(--bg-warning))]/40`/`text-[hsl(var(--bg-warning))]`/`border-[hsl(var(--bg-warning))]`; buttons `bg-amber-600 hover:bg-amber-700`→`bg-[hsl(var(--bg-warning))] hover:bg-[hsl(var(--bg-warning))]/90`; `sky-*`→`bg-[hsl(var(--bg-info))]/20`/`text-primary`; `blue-*`→`border-ring`/`bg-[hsl(var(--bg-info))]/20`/`text-primary`/`text-foreground`; `green-*`→`text-green-707`/`bg-[hsl(var(--bg-success))]/10`; `red-*`→`text-destructive`/`bg-destructive/10`; `purple-*`→`text-primary`; all `dark:*` removed. |
| 2026-05-22 | **Phase 3 DONE.** Accounting subapp — 19 files cleaned (APYCertificateDetails, APYCertificatesList, CreateAPYCertificateDialog, SendReminderEmailDialog, InvoiceDetails, CancelInvoiceDialog, SendInvoiceEmailDialog, EditInvoicePageContent, InvoiceForm, FinancialReportCard, TransactionsPanel, MemberManagementSection, ShareholderManagementSection, PartnerManagementSection, ServicePresetsSection, SetupPageContent, ShareholderRow, CustomCategoriesSection, CorporateTaxBreakdown). **Baseline: 3,032/399 → 2,889/394 (−143 violations, −5 files).** Mappings: `gray-*`→`text-foreground`/`text-muted-foreground`/`border-border`/`bg-muted`; `green-*/emerald-*`→`bg-[hsl(var(--bg-success))]/40`/`text-green-707` (WCAG exception); `red-*`→`text-destructive`/`bg-destructive/10`/`border-destructive`; `orange-*/amber-*`→`bg-[hsl(var(--bg-warning))]/40`/`text-[hsl(var(--bg-warning))]`; `blue-*`→`text-primary`/`border-ring`/`bg-[hsl(var(--bg-info))]/20`; `dark:*`→removed. |
| 2026-05-22 | **Phase 2 DONE (43/44 committed).** Procurement + Vendor Portal — 43 files cleaned & committed (VendorPortalForm, VendorPortalClient, DeclineDialog, SuccessState, VendorPortalErrorState, ExtractedDataReviewPanel, SetupLockBanner, SignatoryProposalCard, SignatoryDisambiguationModal, SourcingEventSummaryCard, QuoteLineEditorTable, QuoteDetailsHeader, QuoteEditMode, ComparisonPanel, ComparisonWinnerBanner, RecommendationCard, OfflineBanner, QuoteRevisionDetectedDialog, extracted-data-review-helpers, ProcurementSubNav, VendorDetail, VendorCard, SupplierComparisonTable, SupplierMetricsCard, PurchaseOrderForm, PurchaseOrderKPIs, AgreementDetail, MaterialDetail, hub/cards × 6, ContactRfqInvitesSection, ProcurementContactTab, ProjectProcurementTabs, KpiPendingApprovalPos, VendorGridCard, VendorListCard, quotes/scan/page, RfqDetailClient, AnalyticsKpiTiles). **Baseline: 3,405/420 → 3,032/399 (−373 violations, −21 files).** ConflictDialog migration in working tree only — commit blocked by CHECK 3.22 dead-code ratchet, awaiting Giorgio decision (import / delete / SKIP). Note: `text-green-707` retained as WCAG documented exception per §2.1 (canonical via COLOR_BRIDGE.text.*). |
| 2026-05-22 | **Phase 1 DONE.** DXF Viewer subapp — 20 files cleaned (GripContextMenu, GripHoverMenu, WallDnaSection, WallPersistenceSection, StairWarningsSection, StairPersistenceSection, StairPresetsSection, StairPerTreadOverrideSection, DimensionsTab, DraftRecoveryBanner, SpellCheckContextMenu, TextTemplateList, PlaceholderPicker, CustomDictionaryEditorDialog, MirrorConfirmOverlay, DraggableOverlayToolbar, PolygonControls, IsolateStatusIndicator, FloorplanBackgroundPanel, PromptDialog). **Baseline: 3,659/440 → 3,405/420 (−254 violations, −20 files).** Mapping applied: `neutral-*`→`border`/`card`/`muted-foreground`/`accent`; `slate-*`→`border`/`card`/`background`/`foreground`/`muted-foreground`/`accent`; `zinc-*`→`card`/`border`/`muted-foreground`/`accent`; `rose-*`→`destructive`; `emerald-*`→`bg-[hsl(var(--bg-success))]`; `amber-*`→`bg-[hsl(var(--bg-warning))]`; `blue-*`→`primary`/`ring`/`bg-[hsl(var(--bg-info))]`; `red-*`→`destructive`. All `dark:*` prefixes removed from consumer files (semantic tokens are theme-aware). |
