# ADR-364 — Escape Command Bus (Centralized ESC Dispatcher)

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 **APPROVED** 2026-05-18 — Group 1+2+3 (BIM tools) implemented; Boy-Scout Group 4 (10 secondary components) migrated 2026-06-03 |
| **Date** | 2026-05-18 |
| **Category** | DXF Viewer — Tools & Keyboard |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-364-escape-command-bus.md` |
| **Author** | Claude Opus 4.7 + Γιώργος Παγώνης |
| **SSoT Module** | `escape-command-bus` (registered in `.ssot-registry.json`, Tier 1) |
| **Canonical** | `src/subapps/dxf-viewer/systems/escape-bus/` |
| **Related ADRs** | ADR-027 (Keyboard Shortcuts), ADR-040 (Preview Canvas Perf), ADR-047 (Polygon Close), ADR-049 (Move Tool), ADR-188 (Rotation), ADR-189 (Canvas Numeric Input), ADR-294 (SSoT Ratchet), ADR-345 (Ribbon), ADR-348 (Scale), ADR-349 (Stretch), ADR-350 (Trim), ADR-353 (Extend/Array), ADR-357 (Line Tool — Phase 14 Command Line + Phase 15 Selection Cycling), ADR-362 (Dimensions) |

---

## Summary

Κεντρικοποιημένος dispatcher για το πλήκτρο **Escape** σε ολόκληρο τον DXF Viewer subapp. Αντικαθιστά τους τρεις ανταγωνιστικούς window-level capture-phase listeners και τα ad-hoc bubble-phase ESC handlers που ήταν διάσπαρτα σε popovers/dropdowns. Όλοι οι ESC consumers εγγράφονται μέσω ενός handler-bus με **priority-based first-match-wins** semantic και **single window listener**, αντιστοιχώντας στο αρχιτεκτονικό patrón των AutoCAD / Revit / Google Docs command bus systems.

---

## 1. Context

### 1.1 Το πρόβλημα

Πριν την εισαγωγή του bus, το ESC χειριζόταν σε **3 ξεχωριστούς window-level capture-phase listeners** + **40+ ad-hoc local listeners** σε popovers, dropdowns και tool hooks. Συγκεκριμένα:

#### A. Window-level capture handlers (το αληθινό SSOT πρόβλημα)

| # | Αρχείο | Pre-ADR-364 ESC λογική |
|---|---|---|
| 1 | `hooks/useKeyboardShortcuts.ts` | Priority 1: cancel drawing (περιείχε **και τα dim tools** ως ADR-362 hotfix). Priority 2: close color palette. |
| 2 | `hooks/dimensions/useDimensionKeyboardRouting.ts` | Dispatch Tab/Space/**Escape**/Enter → `onKey('Escape')` όταν `isDimTool(activeTool)`. |
| 3 | `hooks/canvas/useCanvasKeyboardShortcuts.ts` | Τεράστιο priority chain: `CanvasNumericInput → polygonCrop → lassoCrop → move → mirror → scale → stretch → trim → extend → arrayPolar → arrayPath → rotation → grip → draftPolygon → exitDrawMode → gripSelection → entitySelection`. |

#### B. Bubble-phase local handlers (component-scoped)

- `RibbonSplitDropdown.tsx` — `document.addEventListener('keydown', ...)` για close.
- `CommandLineInput.tsx` — React onKeyDown switch case `'Escape'`.
- `use-selection-cycling.ts` — window listener για cancel cycling.
- `useDynamicInputKeyboard.ts` — capture listener για Tab/Enter/Escape στους tool-specific Strategy handlers.

#### C. Tool-internal `handleXxxEscape` callbacks

Καλούνταν από το giant priority chain στο `useCanvasKeyboardShortcuts`. Δεν είναι το ίδιο το πρόβλημα — απλά υλοποιούν τη συμπεριφορά cancel του εκάστοτε tool.

### 1.2 Συμπτώματα

1. **Double-cancel race** — όταν dim tool active + dynamic input visible + ESC, εκτελούνταν δύο handlers ταυτόχρονα.
2. **Hidden priority coupling** — η ADR-362 hotfix προσέθεσε τα dim tools στη "drawing-cancel" λίστα του `useKeyboardShortcuts`, μετατοπίζοντας λογική από όπου ανήκε.
3. **Διπλο-σχήμα priorities** — `useCanvasKeyboardShortcuts` είχε εσωτερικό priority chain (move > mirror > scale > ... > rotation > grip > deselect), αλλά τα άλλα 2 hooks είχαν δικά τους αυτόνομα priorities χωρίς συγχρονισμό.
4. **Δύσκολη πρόβλεψη** — προσθέτοντας νέο tool, ο developer έπρεπε να συμπληρώνει 2-3 διαφορετικά αρχεία, με τη σωστή σειρά, χωρίς central index.
5. **Editable focus handling διάσπαρτο** — κάθε listener επανέγραφε το ίδιο `INPUT / TEXTAREA / contentEditable` guard.

---

## 2. Decision

Εισαγωγή **Escape Command Bus**: ενός singleton handler-registry με ένα μοναδικό window keydown capture listener. Όλοι οι ESC consumers εγγράφονται μέσω hook `useEscapeHandler({...})` ή direct `escapeBus.register({...})`. Σε κάθε ESC press, ο bus:

1. Παίρνει snapshot των εγγεγραμμένων handlers.
2. Τους ταξινομεί κατά priority (ψηλό → χαμηλό), με ties να διατηρούν την insertion order.
3. Ελέγχει για **editable-focus**: handlers χωρίς `allowWhenEditable: true` παραλείπονται όταν `document.activeElement` είναι `INPUT` / `TEXTAREA` / `contenteditable=true`.
4. Για κάθε επιλέξιμο handler καλεί `canHandle()` — αν `true`, καλεί `handle()`.
5. Αν `handle()` επιστρέψει `true`, ο bus καλεί `e.preventDefault()` + `e.stopPropagation()` και **τερματίζει την αλυσίδα** (first-match-wins).
6. Αν `handle()` επιστρέψει `false`, ο bus συνεχίζει στον επόμενο επιλέξιμο handler (fall-through).

---

## 3. Architecture

### 3.1 Module structure

```
src/subapps/dxf-viewer/systems/escape-bus/
├── EscapeCommandBus.ts            # Singleton + lazy window listener + dispatch
├── escape-priority.ts             # ESC_PRIORITY SSoT constants (16 levels)
├── types.ts                       # EscapeHandler, EscapeBusInspection, EscapeDispatchResult
├── useEscapeHandler.ts            # React hook με ref pattern
├── index.ts                       # Barrel export — canonical import path
└── __tests__/
    └── EscapeCommandBus.test.ts   # 24 test cases (Google Presubmit grade)
```

### 3.2 Public API

```typescript
import {
  escapeBus,
  useEscapeHandler,
  ESC_PRIORITY,
  type EscapeHandler,
} from '@/subapps/dxf-viewer/systems/escape-bus';
```

`escapeBus.register(handler) → unregister`. `useEscapeHandler(options | null)` — React hook με stable ref pattern.

### 3.3 Priority SSoT (`escape-priority.ts`)

| Constant | Value | Owner | Editable opt-in |
|---|---:|---|:---:|
| `MODAL_DIALOG` | 1000 | Future: TextEditorOverlay, MirrorConfirmOverlay, DimStyleCreateDialog | — |
| `CANVAS_NUMERIC` | 950 | `useCanvasEscapeRegistrations` (ADR-189) | — |
| `DYNAMIC_INPUT` | 900 | `useDynamicInputKeyboard` | ✅ |
| `POPOVER_DROPDOWN` | 800 | `RibbonSplitDropdown` + future popovers | — |
| `COMMAND_LINE` | 750 | `CommandLineInput` (ADR-357 Phase 14-B) | ✅ |
| `SELECTION_CYCLING` | 700 | `use-selection-cycling` (ADR-357 Phase 15) | — |
| `CROP_TOOL` | 650 | `useCanvasEscapeRegistrations` (polygon-crop, lasso-crop) | — |
| `MODIFY_TOOL` | 600 | `useCanvasEscapeRegistrations` × 9 (move/mirror/scale/stretch/trim/extend/array-polar/array-path/rotation) | — |
| `DIM_TOOL` | 550 | `useDimToolRouting` (ADR-362) | ✅ |
| `DRAW_TOOL` | 500 | `useKeyboardShortcuts` (line/polyline/polygon/measure-*/rectangle/circle/stair/wall) | — |
| `GRIP_DRAG` | 450 | `useCanvasEscapeRegistrations` (DxfGripInteraction.handleGripEscape) | — |
| `DRAFT_POLYGON` | 400 | `useCanvasEscapeRegistrations` (composite fallback) | — |
| `OVERLAY_DRAW_MODE` | 350 | `useCanvasEscapeRegistrations` | — |
| `GRIP_SELECTION` | 300 | merged into composite fallback | — |
| `ENTITY_SELECTION` | 250 | merged into composite fallback | — |
| `COLOR_MENU` | 100 | `useKeyboardShortcuts` (lowest fallback) | — |

Κάθε priority λογικά χωρισμένη με gap 50 — αφήνει χώρο για μελλοντικές inserts χωρίς renumber.

### 3.4 Editable-focus model

Per-handler check, εκτελούμενο **εντός** της iteration του dispatch loop **και επανυπολογιζόμενο per handler** (ADR-364 Group 3 update, 2026-05-19):

- Default `allowWhenEditable: false` — handler δεν τρέχει όταν editable element έχει focus.
- `allowWhenEditable: true` — handler τρέχει πάντα. Χρήση για widgets που **own** την editable focus state τους (Dynamic Input, Command Line, Dim tool dynamic-input integration).
- **Per-iteration re-evaluation**: `isEditableFocus()` καλείται ΕΝΤΟΣ του `for` loop, όχι πριν. Αυτό επιτρέπει σε editable-allowed handler (π.χ. DYNAMIC_INPUT) να κάνει `document.activeElement.blur()` + return `false` (no consume), και ο bus να συνεχίσει σε editable-blocked handler χαμηλότερης priority (π.χ. DRAW_TOOL). Industry parallel: AutoCAD command system re-evaluates editable context per command; Revit modal stack re-checks state on each pop. Pattern είναι το core του ADR-364 §4 Group 3 BIM tools cascade (ESC inside Dynamic Input → close DI + cancel drawing tool to 'select').

### 3.5 Lifecycle + re-entrancy

- **Lazy listener install**: η πρώτη `register()` εγκαθιστά το single window keydown capture listener. Όλες οι επόμενες εγγραφές απλά προσθέτουν στο Map.
- **Idempotent register by id**: εγγραφή με ήδη υπάρχον `id` αντικαθιστά τον προηγούμενο handler (React strict-mode double-effect safe).
- **Snapshot-then-iterate**: handlers εγγεγραμμένοι **κατά τη διάρκεια** ενός dispatch δεν τρέχουν εκείνη την κλήση — μόνο στην επόμενη.
- **Error containment**: `canHandle` ή `handle` που πετάει exception loggάρεται μέσω `console.error` και η αλυσίδα συνεχίζει.

---

## 4. Migration map (Group 2)

| # | Αρχείο | Πριν | Μετά |
|---|---|---|---|
| 1 | `hooks/useKeyboardShortcuts.ts` | Inline ESC switch (drawing cancel + color menu) | 2 × `useEscapeHandler` — DRAW_TOOL + COLOR_MENU |
| 2 | `hooks/dimensions/useDimensionKeyboardRouting.ts` | window listener handles Tab/Space/Escape/Enter | Tab/Space/Enter μόνο. ESC αφαιρέθηκε. |
| 3 | `hooks/dimensions/useDimToolRouting.ts` | — | + `useEscapeHandler` — DIM_TOOL με `allowWhenEditable: true` |
| 4 | `hooks/canvas/useCanvasKeyboardShortcuts.ts` | Giant switch case ESC (16+ branches) | ESC switch αφαιρέθηκε. + DDE auto-clear effect. Καλεί `useCanvasEscapeRegistrations`. Από 500 → 464 γραμμές. |
| 5 | `hooks/canvas/useCanvasEscapeRegistrations.ts` | ✨ NEW | 12 × `useEscapeHandler` (CANVAS_NUMERIC, CROP_TOOL × 2, MODIFY_TOOL × 9, GRIP_DRAG, fallback, OVERLAY_DRAW_MODE) |
| 6 | `ui/command-line/CommandLineInput.tsx` | React onKeyDown case `'Escape'` | + `useEscapeHandler` — COMMAND_LINE, `allowWhenEditable: true` |
| 7 | `systems/selection/use-selection-cycling.ts` | window listener ESC branch | + `useEscapeHandler` — SELECTION_CYCLING |
| 8 | `ui/ribbon/components/buttons/RibbonSplitDropdown.tsx` | `document.addEventListener('keydown', ...)` ESC branch | + `useEscapeHandler` — POPOVER_DROPDOWN |
| 9 | `systems/dynamic-input/hooks/useDynamicInputKeyboard.ts` | capture listener handles Tab/Enter/**Escape** via Strategy | Tab/Enter μόνο. + `useEscapeHandler` — DYNAMIC_INPUT, `allowWhenEditable: true`, route μέσω Strategy handler. |

### 4.1 Pending Boy-Scout migrations

> **Update 2026-05-19 (Group 3 — BIM tools)**: Οι 5 BIM drawing tools που εισήχθησαν μετά το ADR-364 (ADR-363 Phase 4.5c/5.5c) είχαν δικούς τους capture-phase `window.addEventListener('keydown', ...)` ESC listeners με semantics "soft reset within tool" (κρατούσαν το tool active, επανέφεραν phase). Αυτό:
>
> 1. **Παραβίαζε το SSoT** του ADR-364 (parallel listeners σε capture phase).
> 2. **Διαφωνούσε με την AutoCAD/Revit/ArchiCAD σύγκλιση**: ESC = exit tool to select, όχι soft reset.
> 3. **Έσπαγε το user expectation** — το bus DRAW_TOOL slot στο `useKeyboardShortcuts` παρέλειπε αυτά τα tools από το `DRAWING_TOOLS_WITH_CANCEL` set, άρα το ESC είτε δεν φαινόταν να κάνει τίποτα (column/beam/slab) είτε κρατούσε το tool ενεργό αντί να το βγάλει στο select.
>
> Migration:
>
> | File | Πριν (2026-05-18) | Μετά (2026-05-19) |
> |---|---|---|
> | `hooks/drawing/useColumnTool.ts` | Tab+ESC useEffect (capture window listener) | Μόνο Tab. ESC αφαιρέθηκε — bus DRAW_TOOL deactivates. |
> | `hooks/drawing/useBeamTool.ts` | ESC useEffect (capture window listener) | Αφαιρέθηκε ολόκληρο. `useEffect` import dropped. |
> | `hooks/drawing/useSlabTool.ts` | Enter+ESC useEffect | Μόνο Enter (commit polygon). ESC αφαιρέθηκε. |
> | `hooks/drawing/useOpeningTool.ts` | ESC useEffect (release host) | Αφαιρέθηκε ολόκληρο. `useEffect` import dropped. |
> | `hooks/drawing/useSlabOpeningTool.ts` | ESC useEffect (release host) | Αφαιρέθηκε ολόκληρο. `useEffect` import dropped. |
> | `hooks/useKeyboardShortcuts.ts` | `DRAWING_TOOLS_WITH_CANCEL` = 10 tools | + `column, beam, slab, opening, slab-opening` (15 tools). |
>
> Αποτέλεσμα: ESC = exit tool to select για ΟΛΑ τα drawing tools. Tool's `deactivate()` καλείται από το `useToolLifecycle` όταν `activeTool` αλλάζει σε 'select' — επαναφέρει state σε `INITIAL_STATE` (idle phase). AutoCAD/Revit/ArchiCAD parity επιτυγχάνεται.

### Boy-Scout Group 4 — Migrated 2026-06-03

| # | Αρχείο | Στρατηγική | canHandle gate | id |
|---|---|---|---|---|
| 1 | `systems/properties/PropertiesPalette.tsx` | bus hook (A) | `paletteSnap.open` | `'properties-palette'` |
| 2 | `systems/properties/QuickPropertiesMiniPanel.tsx` | bus hook (A) — Enter listener stays | `open` | `'quick-properties-mini-panel'` |
| 3 | `ui/panels/dimensions/DimStyleCreateDialog.tsx` | Radix Dialog onEscapeKeyDown → onOpenChange (B) | — | — |
| 4 | `ui/components/layer-state/LayerStateDropdown.tsx` | Radix Popover onEscapeKeyDown → onOpenChange (B) | — | — |
| 5 | `ui/components/layers/LayerItem.tsx` | bus hook (C) | `editingLayer === layerName` | `'layer-item-rename'` |
| 6 | `ui/components/layers/ColorGroupItem.tsx` | bus hook (C) | `isEditingColorGroup` | `'color-group-rename'` |
| 7 | `ui/components/layer-state/LayerStateDropdownPopover.tsx` | bus hook in parent (C) — consumes ESC so Radix Popover stays open | `renameId !== null` | `'layer-state-rename'` |
| 8 | `ui/components/layer-state/LayerStateManageRow.tsx` + `LayerStateManagePanel.tsx` | bus hook in parent LayerStateManagePanel (C) — consumes ESC so Radix Dialog stays open | `editingId !== null \|\| editingCategoryId !== null` | `'layer-state-manage-rename'` |
| 9 | `ui/panels/dimensions/TextOverrideEditor.tsx` | bus hook in FieldTokenInput sub-component (C) | `openAngle !== null && suggestions.length > 0` | `'text-override-suggestions'` |
| 10 | `ui/stair-advanced-panel/sections/StairPresetsSection.tsx` | bus hook (C) | `saveMode` | `'stair-preset-save'` |

**Εκτός scope**: `components/grip/GripContextMenu.tsx` + `hooks/grips/useGripContextMenuController.ts` — ελέγχθηκαν και δεν έχουν `keydown`/`Escape` handler, μόνο `contextmenu` (right-click) listener. Δεν υπάρχει τίποτα να μεταναστεύσει.

Όλα Group 4 handlers χρησιμοποιούν `priority: ESC_PRIORITY.POPOVER_DROPDOWN` + `allowWhenEditable: true` (όλα φωτίζονται ενώ ένα input/panel έχει focus).

---

## 5. Test strategy

`__tests__/EscapeCommandBus.test.ts` — 24 cases:

| Group | Cases |
|---|---:|
| Priority ordering | 4 |
| Event consumption (preventDefault) | 3 |
| Registration lifecycle (register / unregister / id replace / empty id throws) | 4 |
| Editable-focus guard | 3 |
| Non-ESC keys (ignored) | 1 |
| Error containment (canHandle / handle throws) | 2 |
| `inspect()` snapshot | 1 |
| Snapshot-then-iterate (re-entrancy safety) | 1 |
| `ESC_PRIORITY` strictly decreasing | 1 |
| `useEscapeHandler` hook (mount, null skip, ref pattern) | 3 |

Στόχος: 95%+ statements / 90%+ branches coverage. Trigger: `npm run test -- EscapeCommandBus`.

---

## 6. SSoT Ratchet integration

Νέο entry στο `.ssot-registry.json`:

```json
"escape-command-bus": {
  "ssotFile": "src/subapps/dxf-viewer/systems/escape-bus/EscapeCommandBus.ts",
  "description": "All ESC key dispatch MUST go through escapeBus.register() or useEscapeHandler(). Direct window.addEventListener('keydown', ...) handlers that check e.key === 'Escape' are forbidden outside the escape-bus folder.",
  "forbiddenPatterns": [
    "addEventListener\\(['\"]keydown['\"].*Escape",
    "e\\.key\\s*===\\s*['\"]Escape['\"]"
  ],
  "allowlist": [
    "src/subapps/dxf-viewer/systems/escape-bus/",
    "src/subapps/dxf-viewer/hooks/dimensions/useDimensionKeyboardRouting.ts",
    "src/subapps/dxf-viewer/hooks/canvas/useCanvasKeyboardShortcuts.ts",
    "src/subapps/dxf-viewer/hooks/canvas/useCanvasEscapeRegistrations.ts",
    "src/subapps/dxf-viewer/hooks/dimensions/useDimToolRouting.ts"
  ],
  "tier": 1
}
```

Το pattern `e\\.key\\s*===\\s*['\"]Escape['\"]` πιάνει direct comparisons. Αρχικά allowlist περιλαμβάνει τα modules που πέρασαν από Group 2 migration επειδή κρατούν residual references (π.χ. fakeEvent construction στο dynamic-input handler). Boy Scout migrations θα στενέψουν την allowlist προοδευτικά.

Baseline: `npm run ssot:baseline` μετά το commit του Group 2 → καταγραφή residual violations στο `.ssot-violations-baseline.json`.

---

## 7. Compliance checklist (CLAUDE.md)

| # | Rule | Status |
|---|---|:---:|
| N.0 | Centralized systems index updated | ✅ ADR entered registry + this file |
| N.0.1 | ADR-driven workflow (4 phases) | ✅ Recognition → Plan → Implement → ADR → STOP before commit |
| N.1 | Professional quality | ✅ Enterprise patterns (AutoCAD / Revit / Google Docs parallel) |
| N.2 | No `any` | ✅ All types explicit |
| N.3 | No inline styles | ✅ No styling in this module |
| N.4 | No div soup | ✅ No JSX in this module |
| N.7 | Google-level quality | ✅ Single listener, idempotent register, re-entrancy safe, error contained, SSR-safe |
| N.7.1 | File ≤500 lines, function ≤40 lines | ✅ All files ≤290 lines, all functions ≤25 lines |
| N.7.2 | Google-level architecture checklist | ✅ Proactive (lazy install on first register), no race (snapshot-then-iterate), idempotent (id replace), belt-and-suspenders (editable guard + canHandle gate), SSoT (priority constants), await semantics (sync dispatch), explicit ownership (bus singleton) |
| N.8 | Execution mode | ✅ Plan Mode → Orchestrator-grade (9 files, 2 domains) — confirmed by Giorgio |
| N.11 | No hardcoded i18n | ✅ No user-facing strings in this module |
| N.12 | SSoT ratchet | ✅ Registry entry added (§6) |
| N.14 | Model enforcement | ✅ Opus 4.7 declared + confirmed before any tool call |

---

## 8. Google-level architecture declaration

✅ **Google-level: YES** — Single SSoT dispatcher με priority constants, idempotent registration, error containment, editable-focus model, re-entrancy safety, SSR safety, exhaustive test suite. Πρόβλεψη επεκτασιμότητας: όλα τα νέα ESC consumers προσθέτονται με μία γραμμή `useEscapeHandler(...)` σε προφανές priority slot.

---

## 9. Future work

1. **Per-tool registrations εντός tool hooks** — μετακίνηση των MODIFY_TOOL × 9 από `useCanvasEscapeRegistrations` στους ίδιους τους `useXxxTool` (max SRP). Optional refactor.
2. **DevTools panel** — `escapeBus.inspect()` ήδη επιστρέφει sorted snapshot — προσθήκη React DevTools panel για live debug.
3. **Telemetry** — αν χρειαστεί, log `EscapeDispatchResult.consumedBy` για production analytics μέσω structured logging (ADR-036).
4. **Extension προς other keys** — αν αποδειχθεί χρήσιμο, ο ίδιος patrón γενικεύεται σε `CommandKeyBus` για Enter/Tab/Delete με δικό του priority chain. Εκτός scope ADR-364.

---

## 10. Changelog

| Date | Change | Author |
|---|---|---|
| 2026-05-18 | Initial draft + Group 1 (core 6 files) + Group 2 (8 migrations) implemented; pending commit. | Claude Opus 4.7 + Γιώργος Παγώνης |
| 2026-05-19 | Group 3 — BIM tools migration (column/beam/slab/opening/slab-opening). 5 per-tool window listeners removed, all 5 added to `DRAWING_TOOLS_WITH_CANCEL`. ESC now exits BIM tools to 'select' (AutoCAD/Revit/ArchiCAD parity), aligning with Group 2 line/polyline/rectangle behavior. Bug fix: `ΟΤΑΝ ΔΙΝΩ ΕΝΤΟΛΗ ΓΙΑ ΝΑ ΣΧΕΔΙΑΣΩ ΟΠΟΙΑΔΗΠΟΤΕ ΟΝΤΟΤΗΤΑ, ΤΟ ESCAPE ΔΕΝ ΛΕΙΤΟΥΡΓΕΙ` — reported by Giorgio, fixed same session. | Claude Opus 4.7 + Γιώργος Παγώνης |
| 2026-05-19 | Group 3 follow-up #2 — **SSoT alignment** (Γιώργος SSoT audit). (1) `DRAWING_TOOLS_WITH_CANCEL` Set στο `useKeyboardShortcuts.ts` ΑΦΑΙΡΕΘΗΚΕ — αντικαθίσταται με `isInteractiveTool(activeTool)` από `systems/tools/ToolStateManager.ts` (ADR-036 SSoT για tool categories). Νέα BIM tools / measurement variants δεν χρειάζονται πλέον εγγραφή σε 2 μέρη — μόνο στο `TOOL_DEFINITIONS`. (2) DI cleanup duplication ΑΦΑΙΡΕΘΗΚΕ — νέο `keyboard-handlers/dynamic-input-actions.ts` με exported `closeDynamicInput(actions)` SSoT. Χρησιμοποιείται από: (a) `handleDefaultEscape` (default strategy) και (b) DYNAMIC_INPUT bus slot στο `useDynamicInputKeyboard`. Καθαρίζει ΟΛΑ τα 9 fields (x/y/angle/length/radius/diameter + stair rise/tread/width). Idempotent. **Files modified (3)**: `useKeyboardShortcuts.ts`, `default-keyboard-handler.ts`, `useDynamicInputKeyboard.ts`. **Files created (1)**: `dynamic-input-actions.ts`. **Files updated (1 barrel)**: `keyboard-handlers/index.ts` (+ `closeDynamicInput` export). | Claude Opus 4.7 + Γιώργος Παγώνης |
| 2026-05-19 | Group 3 follow-up — **Dynamic Input cascade fix**. Bug report από Γιώργο: `ΟΤΑΝ ΤΟ DYNAMIC ΕΙΝΑΙ ΕΝΕΡΓΟΠΟΙΗΜΕΝΟ ΔΕΝ ΛΕΙΤΟΥΡΓΕΙ ΤΟ ESCAPE, ΟΤΑΝ ΔΕΝ ΕΙΝΑΙ ΛΕΙΤΟΥΡΓΕΙ`. Root cause: DYNAMIC_INPUT slot (priority 900, `allowWhenEditable: true`) πάντα consume με `return true` αφού η Strategy `getKeyboardHandler(activeTool)` καλείται για cleanup. Line/circle/stair strategy handlers επιστρέφουν `false` για Escape (μόνο default κάνει clear), αλλά ο wrapper πάντα `return true`. Άρα DRAW_TOOL (priority 500) δεν τρέχει ποτέ → tool παραμένει active. Plus: ακόμα κι αν DI επέστρεφε `false`, ο bus cached το `editable=true` στην αρχή του dispatch και skip-άρε το DRAW_TOOL (allowWhenEditable: false). **Fix (2 αρχεία)**: (1) `EscapeCommandBus.runHandlerChain` — `isEditableFocus()` επανυπολογίζεται per-iteration αντί cached prior to the loop, ώστε ένας handler που blur-άρει + return false να μπορεί να αφήσει τον bus να συνεχίσει σε editable-blocked handler χαμηλότερης priority. (2) `useDynamicInputKeyboard` DYNAMIC_INPUT bus slot — μετά τη Strategy call καθαρίζει explicitly όλα τα DI fields (belt-and-suspenders για line/circle/stair που δεν χειρίζονται Escape), κρύβει το overlay, blur-άρει το `document.activeElement`, και επιστρέφει `false` ώστε ο bus να συνεχίσει στο DRAW_TOOL → `onDrawingCancel` → `handleToolCompletion(activeTool, true)` → exit to 'select'. AutoCAD/Revit/ArchiCAD parity. Test: `EscapeCommandBus.test.ts` — νέο case `editable-allowed handler blurs + returns false → editable-blocked handler at lower priority runs` (case #25). ADR-364 §3.4 ενημερωμένο με per-iteration re-evaluation semantic. | Claude Opus 4.7 + Γιώργος Παγώνης |
| 2026-06-03 | **Boy-Scout Group 4 — 10 secondary components migrated.** PropertiesPalette + QuickPropertiesMiniPanel: window listeners αντικαταστάθηκαν με `useEscapeHandler` (bus, GROUP A). DimStyleCreateDialog + LayerStateDropdown (LayerStateSaveButton): τοπικό `e.key==='Escape'` αφαιρέθηκε — Radix Dialog/Popover onEscapeKeyDown → onOpenChange αρκεί (GROUP B). LayerItem, ColorGroupItem, LayerStateDropdownPopover, LayerStateManageRow (hook στο LayerStateManagePanel parent), TextOverrideEditor (FieldTokenInput sub-component), StairPresetsSection: bus hook με `allowWhenEditable: true` + `canHandle` gate (GROUP C). GripContextMenu + useGripContextMenuController ελέγχθηκαν — μόνο `contextmenu` listener, χωρίς `keydown`/Escape — εκτός scope. SSoT baseline: 149→129 violations (−20), 99→88 files (−11). tsc: 0 errors. Jest EscapeCommandBus: 24/24 PASS. | Claude Sonnet 4.6 |
