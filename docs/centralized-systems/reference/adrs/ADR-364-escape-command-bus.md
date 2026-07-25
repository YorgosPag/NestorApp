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

## 10. Enforcement — Φάση 1: κριτήριο διάκρισης + ταξινόμηση (2026-07-25)

> **Κατάσταση: ΤΑΞΙΝΟΜΗΣΗ ΜΟΝΟ. Καμία γραμμή κώδικα δεν άλλαξε σε αυτή τη φάση.**
> Ειδικά **ΔΕΝ** μπήκε `stopImmediatePropagation()` στον bus — αυτό αλλάζει συμπεριφορά σε
> δεκάδες listeners ταυτόχρονα και ανήκει στη Φ2, αφού η ταξινόμηση είναι πλήρης.

### 10.1 Γιατί υπάρχει αυτή η ενότητα

Στο browser test του ADR-692 μετρήθηκε: **ένα** ESC στη μέση ενός marquee drag ακύρωσε το
ορθογώνιο **ΚΑΙ** έκλεισε το gizmo. Δύο ενέργειες, ένα πάτημα.

Αιτία, και είναι δομική:

> `stopPropagation()` σταματά τη διάδοση σε **επόμενους κόμβους**, **ΟΧΙ** σε άλλους listeners
> του **ίδιου** κόμβου. Ο bus (`EscapeCommandBus.ts:113`) και οι ανταγωνιστές του κάθονται
> **όλοι στο `window` σε capture** ⇒ τρέχουν **πάντα όλοι**, ό,τι κι αν «καταναλώσει» ο bus.
> Η σειρά τους είναι **σειρά mount**, όχι προτεραιότητα.

⇒ Ο πίνακας `ESC_PRIORITY` (§3.3) είναι σωστός ως *σχέδιο* αλλά **δεν εγγυάται τίποτα ως
μηχανισμός** όσο υπάρχουν παράλληλοι global capture listeners. Το ADR-364 περιγράφει SSoT που
στην πράξη δεν επιβάλλεται.

Η αρχιτεκτονική **δεν** αλλάζει: Revit (1ο Esc = αποεπιλογή, 2ο = ακύρωση εντολής — ένα
επίπεδο ανά πάτημα) και VS Code (**ΕΝΑΣ** dispatcher, δηλωτικοί κανόνες + `when` context keys,
ο πρώτος που ταιριάζει κερδίζει, **καμία** δεύτερη εκτέλεση) κάνουν ακριβώς αυτό που
περιγράφει το `ESC_PRIORITY`. Χρειάζεται **επιβολή**, όχι νέο σύστημα.

**Πού ξεπερνάμε τους μεγάλους:** ούτε το Revit ούτε το VS Code έχουν μηχανισμό που
*απαγορεύει* σε νέο κώδικα να παρακάμψει τον dispatcher. Εμείς μπορούμε (§10.6).

### 10.2 ΤΟ ΚΡΙΤΗΡΙΟ — πότε το ESC ανήκει τοπικά και πότε στον bus

**Θεμελιώδης αρχή.** Το ESC χρειάζεται dispatcher **ακριβώς όταν το πάτημα είναι ΑΜΦΙΣΗΜΟ** —
όταν δύο ή περισσότερα περιβάλλοντα μπορούν εύλογα να το διεκδικήσουν την ίδια στιγμή. Δεν
χρειάζεται dispatcher όταν την αποκλειστικότητα **την εγγυάται μηχανισμός ΕΞΩ από τον κώδικά
μας** (DOM focus, focus trap, native modal stack).

Άρα το ερώτημα **δεν** είναι «είναι input field;» αλλά **«υπάρχει ανταγωνιστής;»**.

#### Το τεστ — 3 συνθήκες, ΟΛΕΣ πρέπει να ισχύουν για ΤΟΠΙΚΟ

| # | Συνθήκη | Τι ελέγχεις |
|---|---|---|
| **T1** | **Αποκλειστικότητα εστίασης** | Το ESC έχει νόημα μόνο όσο ένα συγκεκριμένο editable στοιχείο κρατά DOM focus, και ο handler είναι δεσμευμένος σε **αυτό** (React `onKeyDown` στο στοιχείο, ή έλεγχος `document.activeElement`). Ο browser εγγυάται **έναν** focus owner. Global `window`/`document` listener ⇒ **T1 ❌ αυτόματα.** |
| **T2** | **Κανένας ανταγωνιστής από πάνω** | Κανένας *πρόγονος* ή *global* ιδιοκτήτης ESC δεν θα ενεργούσε στο **ίδιο** πάτημα. ⚠️ Η εστίαση **από μόνη της ΔΕΝ αρκεί** (βλ. §10.3). |
| **T3** | **Καμία διασυνδεδεμένη σημασία** | Η ενέργεια περιορίζεται στην **εφήμερη κατάσταση του ίδιου του στοιχείου** (revert κειμένου, κλείσιμο του δικού του popup). **ΔΕΝ** αλλάζει global viewer state: όχι αλλαγή tool, όχι αλλαγή selection, όχι ακύρωση gesture, όχι έξοδος από mode, όχι γράψιμο σε store έξω από το component. |

> **ΟΛΑ ✅ ⇒ ΤΟΠΙΚΟ νόμιμο. ΕΝΑ ❌ ⇒ ΑΝΗΚΕΙ ΣΤΟΝ BUS.**

#### Γιατί αυτό το κριτήριο και όχι κάποιο άλλο — τεκμηρίωση από την ιστορία του ίδιου του ADR

Το ADR-364 είχε **δύο αντικρουόμενα πρότυπα για την ίδια περίπτωση** («rename input»):

- **Group 4 GROUP C** (2026-06-03): τα rename inputs πήραν **bus hook** + `allowWhenEditable: true`.
- **2026-07-18**: νέο `inline-rename-keyboard.ts` για **τοπικό** Enter/Escape.

Το T2 τα συμβιβάζει και δείχνει ότι **και τα δύο ήταν σωστά**: στα GROUP C το ESC έπρεπε να
**προλάβει το Radix** να κλείσει ολόκληρο το popover/dialog ⇒ υπήρχε ανταγωνιστής ⇒ bus. Στο
inline-rename κανείς άλλος δεν θέλει το ESC ⇒ τοπικό. **Ίδιο «input field», αντίθετη απόφαση,
και το διακριτικό είναι ο ανταγωνιστής — όχι η εστίαση.**

Ο ίδιος ο bus συμφωνεί: το `isEditableFocus()` guard (§3.4) **σκόπιμα παραχωρεί** το ESC στην
εστίαση όταν ο handler δεν δηλώνει `allowWhenEditable`. Το T1 δεν είναι εξαίρεση στην
αρχιτεκτονική — **είναι** η αρχιτεκτονική.

Ευθυγράμμιση με VS Code: τα `when` clauses `editorTextFocus` / `inputFocus` είναι ακριβώς το
T1+T2. Το VS Code τα δρομολογεί όλα από τον έναν dispatcher επειδή **κατέχει** τα δικά του
input widgets. Εμείς χρησιμοποιούμε native browser inputs, που δίνουν την εγγύηση δωρεάν — άρα
το να την τιμήσουμε τοπικά είναι **ισοδύναμο**, όχι έκπτωση.

#### Παρατήρηση φάσης (καθορίζει τι είναι επικίνδυνο)

Ο bus κάθεται στο `window` σε **capture**. Άρα:

- **Τοπικός bubble handler** (React `onKeyDown`) τρέχει **μετά** τον bus ⇒ ο bus έχει δομική
  προτεραιότητα. Σωστή κατεύθυνση, ακίνδυνο.
- **Global capture handler** στο ίδιο `window` τρέχει **ανεξάρτητα**, με σειρά = σειρά mount.
  **Αυτή είναι η μόνη πραγματικά επικίνδυνη κατηγορία** — και είναι όλα τα Κ2 του §10.5.

### 10.3 Ταξινομία ανταγωνιστών (ποιος ΑΛΛΟΣ διεκδικεί ESC)

Το T2 απαντάται μόνο αν ξέρεις ποιους να ψάξεις. Μετρημένοι ανταγωνιστές σε αυτό το repo:

| Ανταγωνιστής | Πού κάθεται | Γιατί κερδίζει |
|---|---|---|
| **Ο ίδιος ο bus** | `window`, capture | Τρέχει πρώτος από κάθε bubble handler |
| **Radix `DismissableLayer`** | `document`, **capture** (`react-use-escape-keydown`) | Κλείνει Popover/Dialog/DropdownMenu **πριν** τρέξει το React `onKeyDown` του input μέσα του. Το `stopPropagation()` στο τοπικό handler είναι **άχρηστο** — έχει προλάβει |
| **react-aria `useOverlay`** | bubble handler στο dialog `<div>` | Κλείνει το overlay όταν το event bubble-άρει από μέσα |
| **`HOT_GRIP_OP` (P975, `allowWhenEditable: true`)** | bus, μονίμως εγγεγραμμένο | Τρέχει **ακόμα κι όταν** το focus είναι σε input ⇒ κλέβει ESC από modals που ανοίγουν μέσα σε grip flow |
| **Άλλος global capture listener** | `window`/`document`, capture | Σειρά mount, `stopPropagation` δεν τον αγγίζει |

### 10.4 Το πραγματικό εύρος — γιατί το «24» ήταν λάθος φακός

Η αρχική μέτρηση ήταν «48 global keydown listeners, 24 αγγίζουν Escape». Ισχύει, αλλά είναι
**ένας** φακός. Υπάρχουν **τρία ανεξάρτητα ιδιώματα** με τα οποία ο κώδικας πιάνει ESC, και
κάθε φακός βλέπει άλλο υποσύνολο:

| Φακός | Τι βλέπει | Πλήθος |
|---|---|---:|
| **G** — global keydown listener + λέξη `Escape` | η αρχική λίστα | **24** |
| **R** — τα 2 `forbiddenPatterns` του ratchet (`e.key === 'Escape'` / `key === 'Escape'`) | ό,τι μπλοκάρει το CHECK 3.7 | **23** |
| **I** — έμμεσο, μέσω `matchesShortcut(e, 'escape')` (πεζό id σε config registry) | αόρατο και στα δύο | **2** |

```
|G| = 24     |R| = 23     |G ∩ R| = 7     |G ∪ R| = 40     + |I| = 2   ⇒  42 αρχεία
```

**Η τομή είναι 7 από 40.** Οι δύο φακοί σχεδόν δεν τέμνονται. Συνέπειες:

1. **16 αρχεία στο R δεν ήταν ποτέ στα 24** — μεταξύ τους τα `useTrimTool` / `useScaleTool` /
   `useStretchTool` / `useExtendTool` (βλ. §10.5 «διπλή αποστολή») και τα
   `TextEditorOverlay` / `PromptDialog` / `ZoomControls`.
2. **17 αρχεία από τα 24 είναι αόρατα στον ratchet.** Δύο από αυτά με ιδιώματα που το regex δεν
   συλλαμβάνει **εξ ορισμού**:
   - `e.code === 'Escape'` — `use-waypoint-drag-interaction.ts:211`, `shortcut-dispatcher.ts:232`
     (**το gizmo bug**) και `:270`. Το regex ζητά `.key`.
   - `e.key !== 'Escape'` — `useZoomWindowTool.ts:70`. Αντίστροφη σύγκριση, ίδια σημασία.
3. **2 αρχεία (I) είναι αόρατα και στους δύο**: `useDxfViewerEffects.ts:223` και
   `useDxfToolbarShortcuts.ts:215` καλούν `matchesShortcut(event, 'escape')`. Δεν περιέχουν
   ούτε κεφαλαίο `Escape` ούτε σύγκριση — η ταυτότητα του πλήκτρου ζει σε
   `config/keyboard-shortcuts.ts:871` (`key: 'Escape'`) και συγκρίνεται από γενικό comparator
   στη `:1148`. **Και οι δύο είναι μη-bus global listeners** (ο δεύτερος σε `document` **και**
   `window`, capture).

> **Αυτό είναι το ίδιο σχήμα με τα «0» των N.11/N.12 στο CLAUDE.md: το πράσινο του ratchet
> σήμαινε «κανείς δεν κοίταξε με αυτόν τον φακό», όχι «καθαρό».** Ο κανόνας για κάθε επόμενη
> φάση: **μέτρα και τα τρία ιδιώματα, ποτέ ένα.**

#### 10.4.1 Διόρθωση του §6 (ADR drift — ο κώδικας κερδίζει, N.0.1)

Το §6 τεκμηριώνει άλλο registry entry από το πραγματικό:

| | §6 (τεκμηριωμένο) | `.ssot-registry.json` (πραγματικό, γρ. 4066-4086) |
|---|---|---|
| patterns | `addEventListener\(['\"]keydown['\"].*Escape` + `e\.key === 'Escape'` | `e\.key\s*===\s*['\"]Escape['\"]` + `key\s*===\s*['\"]Escape['\"]` |
| allowlist | 5 entries | **8** entries (+ `useCanvasEscapeRegistrations`, `dynamic-input/hooks/`, `dynamic-input/keyboard-handlers/`, `inline-rename-keyboard.ts`) |

Το pattern `addEventListener…Escape` **αφαιρέθηκε** και σωστά: το grep είναι γραμμικό, και το
`addEventListener` με το `Escape` δεν βρίσκονται ποτέ στην ίδια γραμμή — δεν έπιανε τίποτα.
Το §6 να διαβάζεται ως ιστορικό· η πηγή αλήθειας είναι το registry.

#### 10.4.2 Πώς επιβάλλεται ΠΡΑΓΜΑΤΙΚΑ το CHECK 3.7 (κρίσιμο για τη Φ2)

- **Μόνο staged αρχεία.** `scripts/git-hooks/pre-commit:20` → `git diff --cached` →
  `run-checks-parallel.js:95` → `check-ssot-imports.js:317` (`process.argv.slice(2)`,
  και `exit 0` σε κενή λίστα). **Καμία** σάρωση όλου του `src/`.
- **Ratchet per-file, με άθροισμα όλων των modules** — όχι per-module. Μπλοκάρει μόνο:
  (α) **νέο** αρχείο με ≥1 παράβαση (μηδενική ανοχή), ή (β) **αύξηση** πάνω από τη δική του
  τιμή baseline. Ίδιος αριθμός ⇒ `same` ⇒ περνά **σιωπηλά, για πάντα**.
- Το `.ssot-violations-baseline.json` (2026-07-20: 129 παραβάσεις / 89 αρχεία) περιέχει
  **41 αρχεία του dxf-viewer**, μεταξύ τους `useTrimTool.ts: 1`, `ZoomControls.tsx: 2`,
  `useSettingsUpdater.ts: 2`.

⇒ **Γι' αυτό ζουν οι παρακάμψεις.** Το `useTrimTool.ts` έχει `key === 'Escape'`, **δεν** είναι
στην allowlist, και παρ' όλα αυτά δεν μπλοκάρει: baseline 1, τρέχον 1, `same`. Ο ratchet δεν
είναι σπασμένος — είναι **grandfathering μηχανισμός** και λειτουργεί όπως σχεδιάστηκε. Η Φ2
πρέπει να το λάβει υπόψη: **σκέτο σφίξιμο του regex δεν αγγίζει κανένα υπάρχον αρχείο.**

### 10.5 Η ταξινόμηση (42 αρχεία σε 3 κάδους)

#### Κ1 — ΗΔΗ ΣΩΣΤΟΙ (19) — καμία ενέργεια

Δρομολογούν ESC μέσω `useEscapeHandler` / `escapeBus.register`, **ή** η λέξη «Escape»
εμφανίζεται μόνο σε σχόλιο/import ενώ ο global listener αφορά **άλλα** πλήκτρα (νόμιμο).

| Αρχείο | Πώς |
|---|---|
| `systems/escape-bus/**` | ο SSoT |
| `hooks/canvas/useCanvasEscapeRegistrations.ts` | **25** bus registrations (CANVAS_NUMERIC, HOT_GRIP_OP, 2×CROP_TOOL, 18×MODIFY_TOOL, GRIP_DRAG, DRAFT_POLYGON, OVERLAY_DRAW_MODE) |
| `hooks/useKeyboardShortcuts.ts` | 4 (DRAW_TOOL, COLOR_MENU, GROUP_EXIT, BLOCK_EDITOR_EXIT) |
| `hooks/dimensions/useDimToolRouting.ts` | DIM_TOOL, `allowWhenEditable` |
| `hooks/dimensions/useDimensionCreate.ts` | bus-only διαδρομή (`key` = typed param, **όχι** `e.key`) |
| `hooks/dimensions/useDimensionKeyboardRouting.ts` | ESC ρητά αφαιρεμένο από `mapKey()` |
| `hooks/state/use2DKeyboardFocus.ts` | FOCUS_CLEAR |
| `hooks/tools/useMirrorTool.ts` | MODIFY_TOOL μέσω `useCanvasEscapeRegistrations:129` |
| `bim-3d/render/crop-region/CropRegionTool.ts` | `escapeBus.register`, CROP_TOOL (imperative, όχι React) |
| `components/dxf-layout/DistMeasureOverlayLeaf.tsx` | DRAW_TOOL |
| `systems/selection/use-selection-cycling.ts` | SELECTION_CYCLING |
| `systems/properties/QuickPropertiesMiniPanel.tsx` | POPOVER_DROPDOWN |
| `systems/dynamic-input/components/RadialCommandRing.tsx` | DYNAMIC_INPUT |
| `systems/dynamic-input/hooks/useDynamicInputKeyboard.ts` | DYNAMIC_INPUT |
| `ui/opening-info-tag/OpeningInfoTagEditorOverlay.tsx` | MODAL_DIALOG + `allowWhenEditable` |
| `ui/ribbon/components/DrawingScaleWidget.tsx` | POPOVER_DROPDOWN + `allowWhenEditable` |
| `hooks/drawing/use-column-anchor-tab-cycle.ts` | comment-only (listener = Tab) |
| `hooks/drawing/useFoundationTool.ts` | comment-only (listener = Tab) |
| `hooks/drawing/use-polygon-sketch-chain.ts` | comment-only (listener = Enter) |

Τα δύο τελευταία ζεύγη είναι χρήσιμα ως **αποδείξεις μη-ψευδώς-θετικού**: το
`OpeningInfoTagEditorOverlay` και το `DrawingScaleWidget` λύνουν **σωστά** ακριβώς το πρόβλημα
που οι δίδυμοί τους (`TextEditorOverlay`, `ZoomControls`) λύνουν **λάθος**. Το πρότυπο υπάρχει
ήδη μέσα στο repo — δεν χρειάζεται να εφευρεθεί.

#### Κ2 — ΠΑΡΑΚΑΜΨΕΙΣ (21) — πρέπει να μεταναστεύσουν

**Κ2-α — ΖΩΝΤΑΝΕΣ (13)**

| # | Αρχείο:γραμμή | Ιδίωμα | Τι σπάει | Προτεινόμενο slot |
|---|---|---|---|---|
| 1 | `bim-3d/shortcuts/shortcut-dispatcher.ts:232` (via `use3DShortcuts.ts:108`) | `event.code` | **ΤΟ ΜΕΤΡΗΜΕΝΟ BUG** — `useBim3DEditStore.deactivate()` κλείνει gizmo παράλληλα με ακύρωση marquee | **`EDIT_GIZMO_3D = 290`** (νέο) |
| 2 | `bim-3d/shortcuts/shortcut-dispatcher.ts:270` | `event.code` + `!shiftKey` | `StairSubElementSelectionStore.clear()` — ίδιος listener, δεύτερη διεκδίκηση | νέο ~273, δίπλα σε GROUP/BLOCK_EXIT |
| 3 | `bim-3d/animation/use-waypoint-drag-interaction.ts:211` | `e.code` | `AnimationStore.setDragAxisLock(null)` | ~`GRIP_DRAG` (450) |
| 4 | `ui/color/eyedropper.ts:133` | `e.key ===` | **ΔΕΥΤΕΡΟ ΖΩΝΤΑΝΟ BUG** — ένα ESC ακυρώνει το eyedropper **ΚΑΙ** κλείνει όλο τον color picker (react-aria ancestor). Δεν καλεί καθόλου `stopPropagation` | `MODAL_DIALOG` (1000) |
| 5 | `ui/text-toolbar/TextEditorOverlay.tsx:145` | `e.key ===` | Το `escape-priority.ts:19` το ονομάζει **ρητά** ως το κανονικό παράδειγμα `MODAL_DIALOG` — και δεν είναι εγγεγραμμένο | `MODAL_DIALOG` + `allowWhenEditable` |
| 6 | `systems/prompt-dialog/PromptDialog.tsx:124` | `e.key ===` | `HOT_GRIP_OP` (P975, `allowWhenEditable`) κλέβει το ESC όταν το dialog ανοίγει μέσα σε grip flow (`grip-mouse-down-helpers.ts:54`) ⇒ modal μένει ανοιχτό, state desync | `MODAL_DIALOG` + `allowWhenEditable` |
| 7 | `ui/toolbar/ZoomControls.tsx:82` | `e.key ===` | Radix `DismissableLayer` (document capture) έχει **ήδη** κλείσει το dropdown· το τοπικό `stopPropagation()` είναι άχρηστο | `POPOVER_DROPDOWN` + `allowWhenEditable` |
| 8 | `hooks/state/useColorMenuState.ts:102` | `event.key ===` | global capture· το slot **υπάρχει ήδη γι' αυτό ακριβώς** («Fallback: close color/menu palette») | `COLOR_MENU` (100) |
| 9 | `ui/ribbon/components/RibbonContextMenu.tsx:32` | `e.key ===` | global bubble· κλείνει μενού ταυτόχρονα με άλλες ακυρώσεις | `POPOVER_DROPDOWN` (800) |
| 10 | `ui/toolbar/ToolButton.tsx:70` | `e.key ===` | global bubble σε `document` | `POPOVER_DROPDOWN` (800) |
| 11 | `hooks/tools/useZoomWindowTool.ts:70` | `e.key !==` | `ZoomWindowStore.cancel()` + tool→`'select'`. ⚠️ Το `DRAW_TOOL` gate είναι `isInteractiveTool`, και το `'zoom-window'` έχει `category: 'zoom'` ⇒ **ρητά εκτός**. Θέλει **δικό του** registration, όχι διεύρυνση του gate | δικό του id στο tier 500 |
| 12 | `app/useDxfViewerEffects.ts:223` | `matchesShortcut(e,'escape')` | αόρατο σε όλα τα εργαλεία· global capture σε `document` **και** `window` | κατά περίπτωση |
| 13 | `hooks/useDxfToolbarShortcuts.ts:215` | `matchesShortcut(e,'escape')` | αόρατο σε όλα τα εργαλεία· global bubble | κατά περίπτωση |

**Κ2-β — ΔΙΠΛΗ ΑΠΟΣΤΟΛΗ: το «laundered» κανάλι (5)** — *νέο εύρημα, το σοβαρότερο μετά το gizmo*

Το `useCanvasKeyboardShortcuts.ts` είναι **regex-καθαρό** (κανένα `case 'Escape'`, το §4 λέει
«ESC switch αφαιρέθηκε») και γι' αυτό είναι στην allowlist. Αλλά ο global capture listener του
(γρ. 351) **προωθεί ωμό `e.key`** στα tool hooks:

```ts
if (trimIsActive  && handleTrimKeyDown)  { const consumed = handleTrimKeyDown(e.key, e.shiftKey); … }
if (scaleIsActive && handleScaleKeyDown) { const consumed = handleScaleKeyDown(e.key);            … }
```

…και **εκεί** γίνεται η σύγκριση: `useTrimTool.ts:305`, `useScaleTool.ts:249`,
`useStretchTool.ts:217`, `useExtendTool.ts:196`. Ταυτόχρονα το `useCanvasEscapeRegistrations`
έχει εγγράψει τα **ίδια** `handleXEscape` στο `MODIFY_TOOL` (γρ. 130-136).

⇒ Δύο ανεξάρτητοι `window` capture listeners, κανένας με `stopImmediatePropagation` στη
διαδρομή ESC ⇒ **το `handleTrimEscape()` εκτελείται ΔΥΟ ΦΟΡΕΣ σε ένα πάτημα.** Σήμερα δεν
φαίνεται επειδή οι ενέργειες είναι σχεδόν ιδempotent (`reset()` + `onToolChange('select')`) —
αλλά είναι πραγματική διπλή αποστολή, και η δεύτερη κλήση τρέχει σε **άλλο** state από την πρώτη.

> **Το μάθημα, και ισχύει για όλη τη Φ2: ο ratchet μετρά το string, όχι τη συμπεριφορά.** Η
> μετανάστευση του 2026-05-18 έβγαλε το `switch` από το `useCanvasKeyboardShortcuts` — τον
> έκανε regex-καθαρό και allowlist-άξιο — ενώ η **αλυσίδα προώθησης** συνέχισε να δρομολογεί
> ESC. Κανένα εργαλείο δεν το είδε, επειδή κανένα εργαλείο δεν κοιτάζει διαδρομές κλήσης.
> Άρα: `useCanvasKeyboardShortcuts.ts` = **Κ2 δομικά**, παρά το καθαρό regex.

**Κ2-γ — ΑΔΡΑΝΕΙΣ / ΝΕΚΡΕΣ (3+1)** — *διαγραφή, όχι μετανάστευση (Boy Scout N.0.2)*

| Αρχείο | Απόδειξη νεκρού |
|---|---|
| `hooks/useEntityDrag.ts:336` | `useEntityDrag` → `useMovementOperations` → **μόνο** barrel `hooks/index.ts`, κανένα component call-site. Αντικαταστάθηκε από `systems/drag/EntityBodyDragStore.ts:113` που είναι **σωστά** στον bus (`BODY_DRAG`) |
| `core/state-machine/useDrawingMachine.ts:209` | `enableKeyboardShortcuts` default `false`, **κανένα** call-site το ενεργοποιεί |
| `core/state-machine/useDrawingMachine.ts:274` (`useDrawingKeyboardShortcuts`) | export μόνο από `core/state-machine/index.ts`, μηδέν call-sites |
| `ui/hooks/useSettingsUpdater.ts:132` (`createKeyboardHandler`) | μηδέν καταναλωτές σε όλο το `src/` |
| `bim-3d/comments/CommentMentionsPicker.tsx:55` | `onKeyDown` σε `<div role="listbox" tabIndex={-1}>` που **τίποτα δεν εστιάζει** (κανένα `autoFocus`/`.focus()`), και είναι *sibling* του textarea ⇒ το event δεν φτάνει ποτέ. Ξεχωριστό bug προσβασιμότητας: το keyboard nav του picker είναι απρόσιτο |

⚠️ Το `knip` **αγνοεί το `dxf-viewer`**, γι' αυτό ο νεκρός κώδικας συσσωρεύεται εκεί αόρατα.

#### Κ3 — ΝΟΜΙΜΟΙ ΤΟΠΙΚΟΙ (2) — να μείνουν ως είναι

| Αρχείο | T1 | T2 | T3 |
|---|---|---|---|
| `ui/utils/inline-rename-keyboard.ts` (+3 καταναλωτές) | ✅ μόνο μέσω `onKeyDown` σε εστιασμένο `<input>` | ✅ κανένας καταναλωτής μέσα σε Radix layer | ✅ revert τοπικής τιμής / blur |
| `bim-3d/comments/CommentReplyInput.tsx:73` | ✅ `onKeyDown` στο `<textarea>` | ✅ ο μόνος 3D global capture (`use3DShortcuts.ts:108`) κάνει `isTypingInFormField()` early-return σε TEXTAREA· μηδέν `allowWhenEditable` registrations στο `bim-3d/**` | ✅ μόνο τοπικό `mentionQuery` |

📌 Το JSDoc του `inline-rename-keyboard.ts` αναφέρει **2** καταναλωτές· είναι **3** —
`FrameProfileCard.tsx:73`, `EntityCard.tsx:119`, **`ui/components/shared/useSliderValueEditing.ts:376`**.
Ο τρίτος είναι νόμιμη χρήση (εστιασμένο numeric input) και μάλιστα τεκμηριώνει σωστά τον λόγο —
απλώς το JSDoc είναι μπαγιάτικο.

> **Δομική διαπίστωση: ο κάδος Κ3 ήταν εξ ορισμού αδύνατο να βρεθεί στα «24».** Το grep έψαχνε
> **global** listeners· οι νόμιμοι τοπικοί ζουν σε React `onKeyDown` και δεν έχουν global
> listener. Δηλαδή ο αρχικός φακός δεν μπορούσε να παράξει ούτε ένα Κ3 — και όντως δεν παρήγαγε
> (24/24 βγήκαν Κ1 ή Κ2). Τα Κ3 φάνηκαν μόνο όταν προστέθηκε ο φακός R.

### 10.6 Τι σημαίνει αυτό για τη Φ2 (επιβολή) — αναθεωρημένο

> ⚠️ **ΑΝΑΘΕΩΡΗΘΗΚΕ ΑΠΟ ΜΕΤΡΗΣΗ — διάβασε το §10.10 πριν εφαρμόσεις το §1 ή το §2 παρακάτω.**
> Η τοπολογία των listeners (στόχος + φάση) έδειξε ότι το `stopImmediatePropagation` αφορά **5**
> αρχεία, όχι 21· και ότι ο ανιχνευτής του §2 έχει **δύο δομικά τυφλά σημεία** (σειρά mount,
> λιμοκτονία). Η παρακάτω λίστα κρατιέται ως ιστορικό της Φ1.

Η σειρά του αρχικού σχεδίου παραμένει, με τρεις διορθώσεις από τα ευρήματα:

1. **`stopImmediatePropagation()` στον bus όταν ένας handler καταναλώνει.** Τώρα ξέρουμε
   ακριβώς ποιους αφορά: τα **21 Κ2**. ⚠️ Και ένα προϋπάρχον: το
   `useCanvasKeyboardShortcuts.ts:145` **ήδη** καλεί `stopImmediatePropagation()` στη διαδρομή
   hot-grip — άρα μπορεί **να λιμοκτονήσει τον bus** αν τρέξει πρώτο. Η Φ2 πρέπει να ελέγξει
   αυτή την αλληλεπίδραση, δεν είναι μονόδρομη.
2. **Dev-time assertion** (bus βλέπει ESC που ήρθε ήδη `defaultPrevented` → `console.error` με
   το ποιος). Ο φθηνότερος και πιο άμεσος ανιχνευτής — πιάνει και τα 3 ιδιώματα **και** τη
   διπλή αποστολή, χωρίς regex.
3. **Pre-commit ratchet** — τρεις απαιτήσεις που δεν ήταν γνωστές πριν:
   - Τα `forbiddenPatterns` να καλύψουν **και** `e.code === 'Escape'`, `key !== 'Escape'`,
     `case 'Escape':`, `matchesShortcut(…, 'escape')`. Χωρίς αυτό, τα 3 σοβαρότερα Κ2
     (συμπεριλαμβανομένου του gizmo) παραμένουν αόρατα.
   - Το σφίξιμο του regex **δεν** αγγίζει κανένα υπάρχον αρχείο (per-file `same` ⇒ περνά).
     Χρειάζεται **ρητό ratchet-down** των 41 dxf-viewer baseline entries, όχι μόνο νέο pattern.
   - **Η allowlist μπορεί να στενέψει τώρα**: από τα 4 keyboard-core entries, τα **3**
     (`useCanvasKeyboardShortcuts.ts`, `useCanvasEscapeRegistrations.ts`,
     `useDimensionKeyboardRouting.ts`) δεν έχουν πλέον literal που να ενεργοποιεί τα patterns.
     Μένει το `useDimToolRouting.ts` **μόνο** λόγω της γρ. 140 (`key === 'Escape'` σε typed
     param). ⚠️ Αλλά **προσοχή**: αφαίρεση του `useCanvasKeyboardShortcuts.ts` από την allowlist
     θα «πρασίνιζε» ένα αρχείο που είναι **Κ2 δομικά** (§10.5 Κ2-β) — καθαρό παράδειγμα του
     γιατί ο ratchet δεν είναι δείκτης υγείας.
4. **Φ3 μετανάστευση** — πρώτο θύμα το gizmo ESC, με `EDIT_GIZMO_3D = 290`: κάτω από
   `BODY_DRAG` (425) ώστε marquee/grip drag να προηγείται, πάνω από `ENTITY_SELECTION` (250)
   ώστε **1ο ESC = κλείσε gizmo, 2ο ESC = αποεπιλογή** (Revit parity). Tests που pin-άρουν
   σήμερα τη λάθος συμπεριφορά και θα χρειαστούν ενημέρωση:
   `bim-3d/shortcuts/__tests__/shortcut-dispatcher-edit.test.ts`,
   `bim-3d/shortcuts/__tests__/shortcut-dispatcher-stair-sub.test.ts`.

### 10.7 Εκτέλεση Κ2-γ — διαγραφή νεκρού κώδικα (2026-07-25)

Πρώτο βήμα **πριν** τη Φ2, κατά τη Google/Figma πρακτική «σβήσε — το git είναι το αρχείο» και
τον κανόνα Beyoncé (κώδικας χωρίς test δεν έχει συμβόλαιο). Οι 4 στόχοι είχαν **μηδέν** tests
και αναφέρονταν **μόνο** από barrels:

| Στόχος | Ενέργεια | Απόδειξη |
|---|---|---|
| `hooks/useEntityDrag.ts` (359 γρ.) | **Διαγραφή αρχείου** | barrel-only· διάδοχος `EntityBodyDragStore` ήδη στον bus (`BODY_DRAG`) |
| `hooks/useMovementOperations.ts` (421 γρ.) | **Διαγραφή αρχείου** | barrel-only· κατανάλωνε το παραπάνω. `NUDGE_CONFIG` ζει τοπικά στο `useKeyboardShortcuts.ts:72` |
| `useDrawingMachine.ts` → `useDrawingKeyboardShortcuts` | Αφαίρεση συνάρτησης | export μόνο από `core/state-machine/index.ts`, μηδέν call-sites |
| `useDrawingMachine.ts` → `enableKeyboardShortcuts` + ESC/Enter effect | Αφαίρεση option + effect | default `false`, κανένα call-site το άναβε |
| `useSettingsUpdater.ts` → `createKeyboardHandler` | Αφαίρεση | μηδέν καταναλωτές σε όλο το `src/` |

Παράπλευρα: `useEffect` import έφυγε (αχρησιμοποίητο), 3 σχόλια που παρέπεμπαν στο διαγραμμένο
`useEntityDrag` διορθώθηκαν (`dxf-timing.ts`, `useGripMovement.ts` ×2).
**Καθαρό αποτέλεσμα: −780 γραμμές, −4 ESC σημεία (21 Κ2 → 17).**

**Επαλήθευση — jest + πραγματικός browser** (όχι μόνο tests):
- `jest`: **189/189 PASS**, 20 suites (incl. `EscapeCommandBus`, `EntityBodyDragStore`).
- Chrome, `localhost:3000/dxf/viewer`: πλήρες φόρτωμα, **μηδέν** console errors σε όλη τη ροή.
  Ρυθμίσεις DXF slider 20%→50%→20% ✅ (`useSettingsUpdater`). Εργαλείο Τοίχος → preview
  «πάχος 21,00 cm · ύψος 300,00 cm» ✅ (`useDrawingMachine`). ESC → `wall` → `Επιλογή`, preview
  καθαρίστηκε ✅ (bus `DRAW_TOOL`). Γραμμή σχεδιάστηκε + auto-save ✅. Επιλογή → λαβές + info tag
  (ΜΗΚΟΣ 16,55 cm) ✅. Drag → ροή μετακίνησης → **1ο ESC ακύρωσε κρατώντας την επιλογή, 2ο ESC
  αποεπέλεξε** ✅ — **κλιμακωτό ESC, Revit parity, ένα σκαλί ανά πάτημα**.
- Καθαρισμός: η δοκιμαστική γραμμή αναιρέθηκε (Ctrl+Z), slider επανήλθε.
  ⚠️ **ΟΧΙ** Ctrl+A→Delete για καθαρισμό — το επίπεδο έχει 550 στοιχεία.

#### 10.7.1 Τι έδειξε η μέτρηση του dead-code gate (για τα επόμενα βήματα)

- Το `knip.json:33` αγνοεί `src/subapps/dxf-viewer/**`. Το `ignore` του knip **δεν** εξαιρεί από
  την ανάλυση — **μόνο κρύβει την αναφορά** (τα ίδια τα docs του knip το λένε anti-pattern).
- Με το ignore αφαιρεμένο: **252 άχρηστα αρχεία** / **831 exports** / **305 types** στο
  dxf-viewer, έναντι **10 αρχείων** στο υπόλοιπο repo (= το `.deadcode-baseline.json`).
  ⚠️ Η λίστα των 252 περιέχει **σίγουρα αθώα** (`bim/index.ts`, `core/index.ts` = barrels·
  `debug/*` = εργαλεία διάγνωσης· `vitest.config.enterprise.ts` = config). **ΜΗΝ** μαζική
  διαγραφή — υπάρχει καταγεγραμμένο περιστατικό 2026-04-24 (13 scaffolding αρχεία / 2.338 γρ.
  του ADR-321 σβήστηκαν από μαζικό batch που εμπιστεύτηκε το εργαλείο).
- **Το knip δεν θα είχε πιάσει 3 από τα 4.** Ακόμα και με `--include-entry-exports` βρίσκει
  **μόνο** το `useDrawingKeyboardShortcuts`. Αιτία: το `knip.json:14` δηλώνει `src/**/index.ts`
  ως **entry point**, άρα κάθε barrel είναι «δημόσιο API» και ό,τι re-export-άρει μετράει ως
  χρησιμοποιούμενο. **Τα barrel-only exports είναι αόρατα εκ κατασκευής.**
- ⚠️ **knip 6.6.2 ΔΕΝ έχει `--baseline` / `--save-baseline`** (επαληθεύτηκε στο εγκατεστημένο
  binary· web summaries το μπερδεύουν με το *fallow*). Έχει `--reporter json` + `--max-issues`.
  Άρα ratchet = υπάρχουσα μηχανή `scripts/check-deadcode-ratchet.js`, **όχι** νέα.

⇒ Η ερώτηση που έπιασε τα 4 και δεν την κάνει κανένα εργαλείο: **«ποιος εισάγει αυτό το σύμβολο
εκτός από barrel;»** — τα barrels δεν καταναλώνουν, προωθούν. Μηχανικά ελέγξιμο, και δομικά
ανέφικτο για το knip όσο τα barrels είναι entry points. Εκκρεμεί ως επόμενο βήμα.

### 10.8 Δήλωση Google-level (Φ1)

⚠️ **Google-level: PARTIAL** — και αυτό είναι το **σωστό** αποτέλεσμα σε αυτό το στάδιο.
Το κριτήριο είναι γραπτό, εκτελέσιμο και **επικυρωμένο**: εφαρμοσμένο σε 42 αρχεία παρήγαγε
19 Κ1 / 21 Κ2 / 2 Κ3 — διακρίνει, δεν ομογενοποιεί, και συμβίβασε δύο αντικρουόμενα
προηγούμενα του ίδιου ADR (§10.2). Η διαγραφή Κ2-γ (§10.7) εκτελέστηκε και **επαληθεύτηκε στον
browser**, μειώνοντας την επιφάνεια σε **17 Κ2**.

Το **κενό** είναι εξ ορισμού η επιβολή: 17 παρακάμψεις παραμένουν ζωντανές, δύο με μετρημένη
λανθασμένη συμπεριφορά (gizmo, eyedropper), και το dead-code gate του subapp παραμένει κλειστό
(§10.7.1). Κλείνει στη Φ2/Φ3.

> **Ενημέρωση 2026-07-25**: το τυφλό σημείο του §10.7.1 **έκλεισε** και έχει δικό του record —
> **[ADR-700](./ADR-700-barrel-aware-dead-export-gate.md)** (CHECK 3.30). Όργανο επικυρωμένο
> (3/4 vs 1/4 του knip), baseline γραμμένο, CI gate ενεργό, Προτεραιότητα 1 εκτελεσμένη
> (−23 αρχεία). **Δεν αφορά πλέον το ADR-364** — το κενό που μένει εδώ είναι **μόνο** η επιβολή
> του ESC (17 παρακάμψεις), και κλείνει στη Φ2/Φ3.

### 10.9 → μεταφέρθηκε στο **ADR-700**

Το barrel-aware dead-export gate (**CHECK 3.30**) γεννήθηκε εδώ, ως απάντηση στο τυφλό σημείο που
μέτρησε το §10.7.1. Είναι όμως **ανεξάρτητη απόφαση** από το ESC — άλλο πρόβλημα, άλλος
καταναλωτής, άλλος κύκλος ζωής — και το ADR-364 είχε φτάσει τις 1.170 γραμμές με **δύο** αποφάσεις.
Μεταφέρθηκε **αυτούσιο** στο
**[ADR-700 — Barrel-aware Dead-export Gate](./ADR-700-barrel-aware-dead-export-gate.md)**.

| Ήταν | Είναι |
|---|---|
| ADR-364 §10.9 | **ADR-700 §1** |
| ADR-364 §10.9.1 | **ADR-700 §2** |
| ADR-364 §10.9.2 | **ADR-700 §3** |
| ADR-364 §10.9.3 | **ADR-700 §4** |

Η μόνη σχέση που παραμένει ζωντανή: τα **4 σύμβολα** που διέγραψε το §10.7 είναι καρφωμένα ως
regression test του ADR-700 (`scripts/__tests__/check-barrel-deadcode-ratchet.test.js:567`) — εκεί
μετρήθηκε ότι το knip πιάνει 1 από τα 4. **Ό,τι ακολουθεί εδώ αφορά μόνο το ESC.**

### 10.10 Φ2 Μηχανισμός 1 — dev-time audit (ΥΛΟΠΟΙΗΘΗΚΕ 2026-07-25)

> **Αυτή η ενότητα αναθεωρεί το §10.6.** Το §10.6 γράφτηκε από ταξινόμηση· εδώ μετρήθηκε η
> **τοπολογία** των listeners. Δύο ισχυρισμοί του δεν επιβίωσαν. N.0.1: ο κώδικας κερδίζει.

#### Α. Η μέτρηση που αλλάζει το σχέδιο — δεν είναι «17 Κ2», είναι δύο ζώνες

Μετρήθηκε ο **στόχος και η φάση** κάθε ανταγωνιστή (`grep -oE "(window|document)\.addEventListener\('keydown'…"`).
Το `stopImmediatePropagation()` επηρεάζει **μόνο** listeners στον **ίδιο κόμβο και την ίδια φάση**:

| Ζώνη | Ποιοι | Τι τους σταματά |
|---|---|---|
| **Α — `window` capture, αδελφοί του bus (5)** | `useCanvasKeyboardShortcuts` · `use3DShortcuts` (→ `shortcut-dispatcher`, **το gizmo bug**) · `useDxfViewerEffects` · `useColorMenuState` · `use-waypoint-drag-interaction` | **ΜΟΝΟ** `stopImmediatePropagation()` (Μηχ. 2). Το `stopPropagation()` δεν τους αγγίζει |
| **Β — κατάντη του bus (12)** | `eyedropper` (document capture) · `ToolButton` (document bubble) · `useDxfToolbarShortcuts`, `RibbonContextMenu`, `useZoomWindowTool` (window bubble) · `ZoomControls`, `TextEditorOverlay`, `PromptDialog` (React bubble) | **ΗΔΗ** το υπάρχον `stopPropagation()` — τρέχουν μόνο όταν ο bus **δεν** καταναλώνει |

⇒ Το §10.6 §1 λέει «αφορά τα 21 Κ2». **Αφορά 5.** Τα 12 της Ζώνης Β δεν είναι παρακάμψεις του
μηχανισμού — είναι **ελλείπουσες εγγραφές**: ενεργούν στη σιωπή που αφήνει ο bus όταν κανένα slot
δεν διεκδικεί. Η θεραπεία τους είναι **μετανάστευση (Φ3)**, όχι `stopImmediatePropagation`.
Επιβεβαιώνει το §10.2: «η μόνη πραγματικά επικίνδυνη κατηγορία είναι ο global capture handler».

#### Β. Ο ανιχνευτής του §10.6 είχε δύο τυφλά σημεία — και τα δύο δομικά

Το §10.6 §2 πρότεινε «ο bus βλέπει ESC που ήρθε ήδη `defaultPrevented`» και ισχυρίστηκε ότι
**«πιάνει και τα 3 ιδιώματα και τη διπλή αποστολή»**. Μετρημένα, δεν πιάνει:

1. **Σειρά.** Ο bus **δεν είναι εγγυημένα πρώτος** — η σειρά των window-capture listeners είναι
   σειρά mount. Ανταγωνιστής που εγγράφεται **μετά** τον bus είναι αόρατος σε έλεγχο εισόδου.
2. **Λιμοκτονία.** Ανταγωνιστής που καλεί `stopImmediatePropagation()` **πριν** τον bus τον
   αποκλείει τελείως — ο bus δεν καλείται, άρα δεν ελέγχει τίποτα. Δεν είναι θεωρητικό:
   `useCanvasKeyboardShortcuts.ts:145` ήδη το καλεί.

**Η λύση: σεντινέλα σε χρόνο import.** Ένας listener που εγκαθίσταται κατά την **αξιολόγηση του
module** — πριν τρέξει οποιοδήποτε effect — άρα **πρώτος**. Στιγματίζει το συμβάν, και κρίνει σε
`setTimeout(0)`, δηλαδή **αφού τελειώσει η διάδοση**, όταν το `defaultPrevented` έχει την τελική του
τιμή. (`queueMicrotask` θα ήταν λάθος: ο microtask checkpoint τρέχει **ανάμεσα** στους listeners.)

Τέσσερις ετυμηγορίες: `ok` · **`starved`** (ο bus δεν κλήθηκε) · **`preempted`** (καταναλώθηκε πριν
τον bus) · **`shadow-owner`** (ο bus δεν διεκδίκησε, κάποιος άλλος κατανάλωσε — ιδιοκτήτης ESC εκτός
SSoT). Οι `starved` και `shadow-owner` είναι **ακριβώς** ό,τι ο αρχικός ανιχνευτής δεν έβλεπε.

#### Γ. Τι ΔΕΝ βλέπει — καρφωμένο σε test, όχι σε σχόλιο

Ανταγωνιστής που δεν καλεί **ούτε** `preventDefault` **ούτε** `stopImmediatePropagation` ενεργεί
χωρίς να αφήσει ίχνος στο DOM. Μετρημένοι: `eyedropper.ts:132`, `ZoomControls.tsx:82`,
`useZoomWindowTool.ts:70` — **3 από τα 17 Κ2**. Για αυτούς ο έλεγχος βγάζει `ok`.

Το ψευδώς αρνητικό είναι **καρφωμένο ως test** (`escape-dev-audit.test.ts`, group «ΤΥΦΛΟ ΣΗΜΕΙΟ»)
ώστε κανείς να μη διαβάσει το `ok` ως «καθαρό» — η παθολογία των «0» των N.11/N.12. ⇒ **Οι
Μηχανισμοί 1 και 3 είναι συμπληρωματικοί, όχι εναλλακτικοί**· ο στατικός ratchet είναι ο **μόνος**
που βλέπει τους σιωπηλούς.

#### Δ. Υλοποίηση + επαλήθευση

| Αρχείο | Τι |
|---|---|
| `systems/escape-bus/escape-dev-audit.ts` (νέο, 170 γρ.) | σεντινέλα + κριτήριο + αναφορά· `NODE_ENV !== 'production'`, SSR-safe, `WeakMap` (μηδέν διαρροή) |
| `systems/escape-bus/EscapeCommandBus.ts` | +3 γραμμές: install σε χρόνο import· `preemptedAtEntry` **πριν** την αλυσίδα· `noteBusDispatch` μετά |
| `systems/escape-bus/__tests__/escape-dev-audit.test.ts` (νέο) | 8 tests — και οι 4 ετυμηγορίες + το τυφλό σημείο |

**Καμία αλλαγή στη σημασιολογία δρομολόγησης** — ο έλεγχος παρατηρεί, δεν αποφασίζει.
**jest: 32/32** (24 προϋπάρχοντα `EscapeCommandBus` αμετάβλητα + 8 νέα)· `jscpd:diff` καθαρό (N.18).
⚠️ **Εκκρεμεί browser** — το ESC αποδεικνύεται με πάτημα πλήκτρου. Το ζητούμενο της πρώτης συνεδρίας
στον browser: **ποιες ετυμηγορίες βγαίνουν στην πράξη** — αυτό απαντά εμπειρικά το ερώτημα σειράς
mount που κανένα static tool δεν μπορεί.

✅ **Google-level: ΝΑΙ** για τον Μηχανισμό 1 — παρατηρητής μηδενικού ρίσκου, order-independent,
με τα όριά του μετρημένα και καρφωμένα σε test αντί να δηλώνονται σε σχόλιο.
⚠️ Το **σύνολο** της Φ2 παραμένει PARTIAL: Μηχανισμοί 2–4 δεν ξεκίνησαν.

### 10.11 Φ2 Μηχανισμός 2 — ΜΕΤΡΗΘΗΚΕ ΣΤΟΝ BROWSER ΚΑΙ ΜΠΛΟΚΑΡΕΤΑΙ (2026-07-25)

> **Αυτή η ενότητα αναθεωρεί τη σειρά του §10.10.** Ο Μηχ. 2 υλοποιήθηκε, μετρήθηκε ζωντανά,
> **προκάλεσε παλινδρόμηση** και επαναφέρθηκε. Ο κώδικας κερδίζει (N.0.1).

#### Α. Οι ζωντανές ετυμηγορίες — ο Μηχ. 1 διαβάστηκε επιτέλους σε browser

`localhost:3000/dxf/viewer`, dev build, Chrome. **Πρώτα επικυρώθηκε το ίδιο το όργανο**: το
`report()` κάνει early-return στο `ok` (γρ. 104), άρα **η σιωπή δεν είναι απόδειξη**. Στήθηκε
θετικό control — listener σε `document` capture (δηλαδή **μετά** τους window-capture) που καλεί
`preventDefault()` ενώ ο bus δεν διεκδικεί ⇒ η σεντινέλα **όφειλε** να πει `shadow-owner`. Το είπε.
Μόνο μετά από αυτό μετρήθηκαν τα σενάρια.

| Ενέργεια | Ετυμηγορία | Κατανάλωσε ο bus; |
|---|---|---|
| Σχεδίαση γραμμής (1ο σημείο) | `ok` | ναι |
| Marquee / lasso drag | `ok` | ναι |
| 3D με ανοιχτό gizmo (×3 πατήματα) | `ok` ×3 | ναι ×3 |
| Color dialog (MODAL) | `ok` | ναι |
| Dropdown κλίμακας | `ok` | ναι |
| Εστίαση σε `<input>` | `ok` | όχι (σωστά) |
| **Ενεργό `trim` (Κ2-β)** | **`ok`** | **ναι** |

**Καμία `starved`, καμία `preempted`, κανένα πραγματικό `shadow-owner`.**

#### Β. Το `trim` απάντησε το ερώτημα σειράς mount — ο bus ΕΙΝΑΙ πρώτος

Το `useCanvasKeyboardShortcuts:165` καλεί `e.preventDefault()` όταν το `handleTrimKeyDown('Escape')`
καταναλώσει (`useTrimTool.ts:305`). **Αν έτρεχε πριν τον bus, ο bus θα έβλεπε
`preemptedAtEntry = true` ⇒ ετυμηγορία `preempted`.** Με ενεργό `trim` βγήκε **`ok`**.
⇒ Ο bus εγγράφεται **πριν** τον `useCanvasKeyboardShortcuts`, άρα το `stopImmediatePropagation()`
**θα** έκοβε την αλυσίδα προώθησης του §10.5 Κ2-β.

⚠️ Η σειρά είναι **σειρά mount, δηλαδή αναδυόμενη** — όχι εγγύηση. Φύλακας: ο Μηχ. 1 θα φωνάξει
`preempted` αν κάποιο refactor την αντιστρέψει.

#### Γ. Γιατί ο Μηχ. 2 ΔΕΝ μπαίνει μόνος του — μετρημένη παλινδρόμηση

Ο Μηχ. 2 μπήκε (`stopImmediatePropagation()` στο `dispatch()`), jest **36/36**, και δοκιμάστηκε
ζωντανά. Αποτέλεσμα, με A/B στον ίδιο browser και ίδια συνεδρία:

| | 1ο ESC | 2ο ESC | 3ο–4ο ESC |
|---|---|---|---|
| **Πριν** (`stopPropagation`) | panel + ribbon tab κλείνουν | **gizmo κλείνει** | καμία αλλαγή |
| **Με Μηχ. 2** (`stopImmediatePropagation`) | panel + ribbon tab κλείνουν | — | **το gizmo ΔΕΝ κλείνει ΠΟΤΕ** |

**Αιτία:** ο `bim-3d/shortcuts/shortcut-dispatcher.ts:232` είναι **Ζώνη Α** και σήμερα ο **ΜΟΝΟΣ**
που κλείνει το gizmo. Ο Μηχ. 2 τον σιωπά, και **δεν υπάρχει slot `EDIT_GIZMO_3D` να τον παραλάβει**.
Το αποτέλεσμα είναι χειρότερο από την αρχική κατάσταση: η επιλογή καθαρίζεται αλλά το gizmo μένει
**ορφανό** στην οθόνη.

> **Η εξάρτηση είναι αντίστροφη από το §10.6/§10.10.** Ο Μηχ. 4 δεν είναι «τελευταίος» — είναι
> **προϋπόθεση** του Μηχ. 2. Σειρά: **Μηχ. 4 ⇒ Μηχ. 2**, ή και οι δύο στο ίδιο commit.

#### Δ. Τι έμεινε στο δέντρο

- `EscapeCommandBus.ts` — παραμένει `stopPropagation()`. Το σχόλιο τεκμηριώνει **γιατί** και δείχνει
  εδώ, ώστε να μη «διορθωθεί» ξανά από άγνοια.
- `EscapeCommandBus.test.ts` — **4 νέα tests ως φύλακας της εξάρτησης** (σύνολο **36/36**). Καρφώνουν
  ότι ο αδελφός `window`-capture **εξακολουθεί** να τρέχει όταν ο bus καταναλώνει. Γίνονται **κόκκινα**
  αν κάποιος βάλει `stopImmediatePropagation()` χωρίς τον Μηχ. 4 — δηλαδή η παλινδρόμηση πιάνεται
  στο presubmit αντί στην οθόνη του Giorgio.

#### Ε. Δύο διορθώσεις στην ταξινόμηση του §10.5

1. **Κ2 #4 `eyedropper.ts:133` είναι Firefox-only, όχι «ΔΕΥΤΕΡΟ ΖΩΝΤΑΝΟ BUG».** Το
   `openEyedropper()` (γρ. 51-54) παίρνει το **native `EyeDropper`** branch σε Chrome/Edge· η
   `openDomEyedropper()` — που περιέχει τον handler — **δεν καλείται ποτέ** εκεί. Επαληθεύτηκε
   ζωντανά (`'EyeDropper' in window === true`). Παραμένει νόμιμος στόχος μετανάστευσης, με
   **χαμηλότερη** προτεραιότητα.
2. **Νέο ζωντανό εύρημα, ανεξάρτητο του Μηχ. 2 — η σκάλα του 3D σταματά νωρίς.** Με επιλεγμένη
   κολώνα: 1ο ESC → panel/ribbon· 2ο → gizmo· **3ο → τίποτα**, και το στοιχείο μένει επιλεγμένο
   (επιβεβαιωμένο με τον δείκτη μακριά — δεν είναι hover· το status bar κρατά «Στύλος · 500×250mm»).
   Ο bus **κατανάλωσε** και στα τρία (`ok`, `defaultPrevented` μετά τον bus). Δηλαδή **handler του
   bus καταναλώνει χωρίς ορατή ενέργεια**, μπλοκάροντας χαμηλότερες προτεραιότητες. Ανήκει στη Φ3.

✅ **Google-level: ΝΑΙ** για τη μέτρηση — θετικό control πριν από κάθε ισχυρισμό, A/B για αιτιότητα,
και η παλινδρόμηση καρφώθηκε σε test αντί να γραφτεί σε σχόλιο.
❌ **Google-level: ΟΧΙ** για να μπει ο Μηχ. 2 μόνος του — είναι τεκμηριωμένη παλινδρόμηση.

### 10.12 Η ΡΙΖΑ — το τελευταίο slot κατανάλωνε ΚΑΘΕ ESC (2026-07-25)

Ψάχνοντας **γιατί** ο Μηχ. 2 έσβησε ολόκληρη τη Ζώνη Α αντί για επιλεκτικά, βρέθηκε ότι το
πρόβλημα δεν ήταν ο Μηχ. 2 — ήταν το **τελευταίο slot της αλυσίδας**:

```ts
// useKeyboardShortcuts.ts — ΠΡΙΝ
useEscapeHandler({
  id: 'use-keyboard-shortcuts/color-menu-close',
  priority: ESC_PRIORITY.COLOR_MENU,          // 100 — το ΧΑΜΗΛΟΤΕΡΟ
  canHandle: () => true,                       // ← ΠΑΝΤΑ
  handle: () => { onColorMenuClose(); return true; },  // ← ΠΑΝΤΑ ΚΑΤΑΝΑΛΩΝΕΙ
});
```

Ένας **άνευ όρων καταναλωτής στον πάτο**. Κάθε ESC που έφτανε ώς εκεί «καταναλωνόταν» και
επέστρεφε `consumed: true` **χωρίς να έχει συμβεί τίποτα**.

#### Οι τρεις μετρημένες συνέπειες

| # | Συνέπεια | Πώς φαινόταν |
|---|---|---|
| 1 | **Η αλυσίδα δεν έφτανε ποτέ σε «κανείς δεν διεκδίκησε»** | `defaultPrevented === true` σε **κάθε** πάτημα, ακόμα και σε εντελώς αδρανή viewer |
| 2 | **Η ετυμηγορία `shadow-owner` ήταν πρακτικά ανέφικτη** | ο bus πάντα δήλωνε `consumedBy ≠ null` ⇒ ο Μηχ. 1 έβγαζε πάντα `ok` |
| 3 | **Ο Μηχ. 2 σιωπούσε ΟΛΗ τη Ζώνη Α σε κάθε πάτημα** | γι' αυτό «χάθηκε» το κλείσιμο του 3D gizmo (§10.11.Γ) |

> Το §10.11 απέδωσε την παλινδρόμηση στην απουσία του `EDIT_GIZMO_3D`. Αυτό **ισχύει**, αλλά ήταν
> το δεύτερο μισό. Το πρώτο μισό ήταν εδώ: **ο bus δεν είχε ποτέ την έννοια «δεν διεκδίκησε
> κανείς»**, άρα το `stopImmediatePropagation()` δεν ήταν ποτέ επιλεκτικό.

#### Και ήταν ταυτόχρονα διπλότυπο (N.0.2)

Το `hooks/state/useColorMenuState.ts:98-111` είχε **ιδιωτικό `window` capture listener** για το ίδιο
ακριβώς ESC, καλώντας το ίδιο `close()` — και ήταν **σωστά gated** (`if (!state.open) return`).
Δηλαδή δύο ιδιοκτήτες για ένα ESC: το slot (ungated) και ο listener (gated). Αυτό είναι το **Κ2 #8**
του §10.5, όπου σημειώνεται «το slot **υπάρχει ήδη γι' αυτό ακριβώς**».

#### Η διόρθωση — ένας ιδιοκτήτης, σωστά gated

| Αρχείο | Αλλαγή |
|---|---|
| `hooks/useKeyboardShortcuts.ts` | `canHandle: () => isColorMenuOpen` (νέο πεδίο config) αντί για `() => true` |
| `app/DxfViewerContent.tsx` | περνά `isColorMenuOpen: colorMenu.open` |
| `hooks/state/useColorMenuState.ts` | **ο ιδιωτικός listener διαγράφηκε** — Κ2 #8 μεταναστευμένο· η Ζώνη Α **5 → 4** |

Το `useEscapeHandler` κρατά `ref` που ανανεώνεται σε κάθε render (γρ. 29-30), άρα το gate διαβάζει
πάντα την τρέχουσα τιμή — δεν υπάρχει stale-closure κίνδυνος.

**Επαλήθευση (browser, ίδια συνεδρία):** ESC σε αδρανή viewer, listener αμέσως **μετά** τον bus:
`defaultPrevented` **`true` → `false`**. Ο bus πλέον αφήνει το ESC να περάσει όταν κανένα slot δεν
το διεκδικεί. jest: **58/58** (escape-bus 36 + cross-mode 22).

#### Τι ΑΠΟΜΕΝΕΙ για να μπει ο Μηχ. 2

1. **Μηχ. 4** — `EDIT_GIZMO_3D = 290` + έξοδος stair sub-element (~273) στον bus· αφαίρεση των δύο
   `event.code === 'Escape'` από `shortcut-dispatcher.ts` (γρ. 232 / 270)· ενημέρωση των 2 tests που
   καρφώνουν τη σημερινή συμπεριφορά.
2. **3D selection clear** — μετρημένο κενό (§10.11.Ε.2): κανείς δεν καθαρίζει το `Selection3DStore`
   στο ESC. Χρειάζεται slot ώστε η σκάλα να τελειώνει σε αποεπιλογή (Revit parity).
3. **Μηχ. 2** — μόνο ΜΕΤΑ τα (1) και (2), με ξανα-επαλήθευση της σκάλας στον browser.

### 10.13 Φ2 Μηχανισμός 4 + Μηχανισμός 2 — η σκάλα του 3D στον bus (2026-07-25)

> **Αυτή η ενότητα διορθώνει το §10.12 «Τι απομένει» σε δύο σημεία.** Το σχέδιο εκεί
> (`EDIT_GIZMO_3D = 290`, stair-sub `~273`) ήταν **λάθος** — θα παρήγαγε δύο slots που δεν
> θα εκτελούνταν ποτέ. Και οι κλάδοι ESC του dispatcher ήταν **τρεις**, όχι δύο. Ο κώδικας
> κερδίζει (N.0.1).

#### Α. Τι βρήκε το SSoT audit πριν γραφτεί γραμμή

| # | Ισχυρισμός εγγράφου | Τι λέει ο κώδικας |
|---|---|---|
| 1 | «Το `ENTITY_SELECTION` (250) είναι πιασμένο από το 2D» | **Καμία εγγραφή δεν το χρησιμοποιεί.** `grep -rn "ENTITY_SELECTION"` → μόνο σχόλια, η σταθερά, και tests. Σταθερά-ορόσημο, όχι σκαλί της αλυσίδας. |
| 2 | «Ο αποεπιλογέας ζει στο 250» | Ζει στο **`DRAFT_POLYGON` (400)**: το `canvas/fallback-deselect` είναι **σύνθετο** — draft polygon + draw-mode + grips + **entity selection** σε ένα πάτημα. |
| 3 | «Το 2D δεν παίζει ρόλο στο 3D» | Το `BimViewport3D` είναι **leaf ΜΕΣΑ στο `CanvasLayerStack`** (`CanvasLayerStack.tsx:38`). Άρα το `useCanvasEscapeRegistrations` είναι **ζωντανό στο 3D**. (Το JSDoc του `canvas-layer-stack-3d-leaf.tsx` λέει «NOT YET imported» — μπαγιάτικο κατά μία εγγραφή.) |
| 4 | «Δύο κλάδοι ESC στον dispatcher» | **Τρεις.** Ο τρίτος είναι ο `focusClear` του registry (`key: 'Escape'`), που επέστρεφε `HANDLED` **χωρίς κανένα gate** σε κάθε 3D ESC. |

**Το συμπέρασμα που ανατρέπει το σχέδιο**: το gizmo είναι **auto-on-selection**
(`use-bim3d-edit-interaction.ts` §`syncFromSelection` — «a 3D BIM selection mounts the gizmo»).
Άρα *gizmo ανεβασμένο ⟹ υπάρχει επιλογή ⟹ το `canHandle` του 400 είναι πάντα `true`*.
**Κάθε slot κάτω από το 400 είναι δομικά ανεκτέλεστο όσο το gizmo είναι πάνω.** Το 290 θα
ήταν νεκρός κώδικας από τη γέννησή του, και το `~273` επίσης: το stair-sub store
τεκμηριώνει ότι καθαρίζεται «whenever the whole-entity selection … is dropped», δηλαδή
η υπο-επιλογή **πάντα** συνυπάρχει με επιλεγμένη σκάλα.

Αυτό εξηγεί πλήρως και τη μέτρηση του §10.11.Ε.2, που είχε μείνει ανερμήνευτη:
1ο ESC → το P400 καθάρισε το universal (εξ ου «έκλεισαν panel + ribbon tab»)·
2ο ESC → το universal ήταν άδειο, το P400 δεν διεκδίκησε, πέρασε στη Ζώνη Α → έκλεισε το gizmo·
3ο ESC → τίποτα, **και το στοιχείο έμεινε επιλεγμένο επειδή κανείς δεν άγγιξε το `Selection3DStore`**.

#### Β. Το τρίτο κενό ΗΤΑΝ όντως SSoT εύρημα — αλλά όχι εκεί που το ψάχναμε

`SelectedEntitiesStore` (universal) και `Selection3DStore` κρατούν την **ίδια έννοια**
«επιλογή», συνδεδεμένα με **μονόδρομη** γέφυρα 3D → universal
(`use-3d-selection-universal-bridge.ts`, που το τεκμηριώνει ρητά: «there is no universal → 3D path»).

⇒ Όποιος καθαρίζει την universal πλευρά πρέπει να θυμηθεί να καθαρίσει **και** την 3D με το
χέρι. Το `useSmartDelete.ts:306` το κάνει· το `clearEntitySelection` της διαδρομής ESC
(`CanvasSection.tsx:405` → `universalSelection.clearAll()`) **το ξέχασε**. Αυτό ήταν το κενό.

**Η λύση δεν είναι δεύτερη κατεύθυνση στη γέφυρα** (η μονοδρομία είναι τεκμηριωμένη επιλογή
κατά των βρόχων ανάδρασης) **ούτε δεύτερο slot στην ίδια προτεραιότητα**. Είναι να καθαρίζεται
**η 3D πλευρά**: η υπάρχουσα γέφυρα κατεβάζει μόνη της το universal. Μία ενέργεια, δύο stores,
μηδέν νέο μονοπάτι συγχρονισμού.

#### Γ. Η σκάλα όπως υλοποιήθηκε

| Προτεραιότητα | Slot | Ενέργεια |
|---|---|---|
| 425 `BODY_DRAG` (υπάρχον) | `bim3d-marquee-cancel` | ακύρωση marquee εν πτήσει |
| **420 `EDIT_GIZMO_3D`** (νέο) | `bim3d/edit-gizmo-teardown` | κλείνει το gizmo, **κρατά** την επιλογή |
| **415 `STAIR_SUB_EXIT`** (νέο) | `bim3d/stair-sub-exit` | έξοδος από tread/riser |
| **410 `SELECTION_3D_CLEAR`** (νέο) | `bim3d/selection-clear` | καθαρίζει 3D → γέφυρα → universal |
| 400 `DRAFT_POLYGON` (υπάρχον) | `canvas/fallback-deselect` | η 2D αποεπιλογή, αμετάβλητη |
| 150 `FOCUS_CLEAR` (υπάρχον) | `bim3d/focus-clear` | δίδυμο του `use2DKeyboardFocus`, **με gate** |

Όλα mode-gated σε 3D ⇒ στο 2D η αλυσίδα είναι **byte-για-byte η ίδια**· καμία ισοπαλία.
Η σχετική σειρά gizmo → stair-sub διατηρήθηκε: ήταν σειρά εντολών στον `dispatchShortcut`,
έγινε σειρά προτεραιότητας (420 > 415).

#### Δ. Αρχεία

| Αρχείο | Αλλαγή |
|---|---|
| `systems/escape-bus/escape-priority.ts` | +3 σταθερές με πλήρη τεκμηρίωση του **γιατί 400+ και όχι 250**· το `ENTITY_SELECTION` σημειώθηκε ρητά ως αχρησιμοποίητο |
| `bim-3d/shortcuts/use3DEscapeRegistrations.ts` | **ΝΕΟ** — καθρέφτης του `useCanvasEscapeRegistrations`· 4 gated slots |
| `bim-3d/shortcuts/use3DShortcuts.ts` | καλεί το νέο module· −3 νεκρά ctx πεδία |
| `bim-3d/shortcuts/shortcut-dispatcher.ts` | **ένα** bail `if Escape → NOT_HANDLED` αντικαθιστά 3 διάσπαρτους κλάδους· −`onEditEscape3D`, −`onStairSubClear`, −`onFocusClear3D` |
| `systems/escape-bus/EscapeCommandBus.ts` | **Μηχ. 2**: `stopPropagation` → `stopImmediatePropagation` |
| `systems/escape-bus/escape-dev-audit.ts` | `window.__escapeAudit` (dev-only): `last()` / `history()` / `clear()` |
| 3 test αρχεία ενημερώθηκαν, 1 νέο | βλ. §Ε |

Ο ορισμός `focusClear` **μένει** στο registry (το panel συντομεύσεων εξακολουθεί να δείχνει
Esc → καθαρισμός εστίασης)· αποσύρθηκε μόνο η δρομολόγηση. Ίδιο πρότυπο με το
`useDimensionKeyboardRouting.mapKey()` (§10.5 Κ1).

#### Ε. Γιατί ο Μηχ. 2 μπήκε τώρα, και τι έγιναν τα 4 tests-φύλακες

Ο Μηχ. 2 ήταν μπλοκαρισμένος επειδή σιωπούσε τη Ζώνη Α ενώ **εκεί** ζούσε ο μόνος που έκλεινε
το gizmo. Με τον Μηχ. 4 η Ζώνη Α δεν έχει πια τίποτα να χάσει στη διαδρομή ESC ⇒ η προϋπόθεση
ικανοποιήθηκε και το `stopImmediatePropagation()` μπήκε.

Το πρώτο από τα 4 tests-φύλακες **αντιστράφηκε**, όπως προβλεπόταν: από «ο αδελφός
ΕΞΑΚΟΛΟΥΘΕΙ να τρέχει» σε «ο αδελφός **ΔΕΝ** τρέχει». Τα άλλα 3 έμειναν έγκυρα αυτούσια
(αφορούν μη-κατανάλωση, κατάντη listeners, και πλήκτρα εκτός ESC — ανεπηρέαστα). Το σχόλιο
κρατά το ιστορικό ώστε η αντιστροφή να μη φαίνεται αυθαίρετη σε επόμενο αναγνώστη.

Παράπλευρα, η **διπλή αποστολή του §10.5 Κ2-β θεραπεύτηκε**: το `handleTrimEscape()` έτρεχε
δύο φορές σε ένα πάτημα (slot + αλυσίδα προώθησης του `useCanvasKeyboardShortcuts`). Ο
`stopImmediatePropagation` κόβει τον δεύτερο. Δεν χρειάστηκε ξεχωριστή μετανάστευση.

**Παραμένουσα προϋπόθεση, μη επιβαλλόμενη από τύπο**: ο bus πρέπει να εγγράφεται **πριν** τους
αδελφούς του (σειρά mount — αναδυόμενη, §10.11.Β). Φύλακας = ο Μηχ. 1: αν αντιστραφεί, βγάζει
`preempted`.

#### ΣΤ. Το όργανο έγινε αναγνώσιμο

Κάθε μέτρηση της Φ2 ξεκινούσε στήνοντας χειροκίνητο θετικό control, επειδή το `report()` κάνει
early-return στο `ok` — «η σιωπή δεν είναι απόδειξη». Με τον Μηχ. 2 το πρόβλημα **επιδεινώθηκε**:
ο bus κόβει πλέον και τους αδελφούς, άρα κανένας εξωτερικός παρατηρητής δεν μπορεί να δει *ποιος*
κατανάλωσε. Το `window.__escapeAudit` (dev-only) εκθέτει το `consumedBy` — τη μόνη πληροφορία που
δεν συνάγεται από έξω. Η σεντινέλα δεν άλλαξε· έγινε απλώς ερωτήσιμη.

#### Ζ. Δήλωση Google-level

✅ **Google-level: ΝΑΙ.**
- **Προληπτικό, όχι αντιδραστικό**: ο έλεγχος έγινε πριν γραφτεί γραμμή και ακύρωσε ένα σχέδιο που θα παρήγαγε 2 ανεκτέλεστα slots.
- **SSoT**: μηδέν νέο μονοπάτι συγχρονισμού — η υπάρχουσα γέφυρα καλύπτει το 3D→universal· το `useCanvasEscapeRegistrations` καθρεφτίστηκε αντί να εφευρεθεί· ο editable-focus έλεγχος δεν διπλασιάστηκε (τον έχει ο bus).
- **Ιδιοκτησία κύκλου ζωής**: ένας ιδιοκτήτης ανά σκαλί, όλοι gated· κανένας ανεξέλεγκτος καταναλωτής (το μάθημα του §10.12 εφαρμόστηκε και στον `focusClear`).
- **Χωρίς race**: όλες οι πύλες διαβάζουν store σε **χρόνο συμβάντος**, ποτέ React snapshot.
- **Ιδempotent**: κάθε `handle` είναι set-to-empty· δεύτερη κλήση = ίδιο αποτέλεσμα.
- **jscpd (N.18)**: καθαρό στα αρχεία της αλλαγής.

⚠️ Γνωστό όριο, εκτός εύρους: το `GROUP_EXIT` (275) / `BLOCK_EDITOR_EXIT` (274) βρίσκονται
**κάτω** από το σύνθετο 400, άρα εκτελούνται μόνο όταν δεν υπάρχει επιλογή. Παρατηρήθηκε, **δεν
μετρήθηκε ζωντανά** — πιθανότατα λειτουργεί ως 2-βήματη σκάλα (αποεπιλογή, μετά έξοδος), που
είναι αποδεκτή συμπεριφορά Figma. Δεν θίχτηκε.

---

## 11. Changelog

| Date | Change | Author |
|---|---|---|
| 2026-05-18 | Initial draft + Group 1 (core 6 files) + Group 2 (8 migrations) implemented; pending commit. | Claude Opus 4.7 + Γιώργος Παγώνης |
| 2026-05-19 | Group 3 — BIM tools migration (column/beam/slab/opening/slab-opening). 5 per-tool window listeners removed, all 5 added to `DRAWING_TOOLS_WITH_CANCEL`. ESC now exits BIM tools to 'select' (AutoCAD/Revit/ArchiCAD parity), aligning with Group 2 line/polyline/rectangle behavior. Bug fix: `ΟΤΑΝ ΔΙΝΩ ΕΝΤΟΛΗ ΓΙΑ ΝΑ ΣΧΕΔΙΑΣΩ ΟΠΟΙΑΔΗΠΟΤΕ ΟΝΤΟΤΗΤΑ, ΤΟ ESCAPE ΔΕΝ ΛΕΙΤΟΥΡΓΕΙ` — reported by Giorgio, fixed same session. | Claude Opus 4.7 + Γιώργος Παγώνης |
| 2026-05-19 | Group 3 follow-up #2 — **SSoT alignment** (Γιώργος SSoT audit). (1) `DRAWING_TOOLS_WITH_CANCEL` Set στο `useKeyboardShortcuts.ts` ΑΦΑΙΡΕΘΗΚΕ — αντικαθίσταται με `isInteractiveTool(activeTool)` από `systems/tools/ToolStateManager.ts` (ADR-036 SSoT για tool categories). Νέα BIM tools / measurement variants δεν χρειάζονται πλέον εγγραφή σε 2 μέρη — μόνο στο `TOOL_DEFINITIONS`. (2) DI cleanup duplication ΑΦΑΙΡΕΘΗΚΕ — νέο `keyboard-handlers/dynamic-input-actions.ts` με exported `closeDynamicInput(actions)` SSoT. Χρησιμοποιείται από: (a) `handleDefaultEscape` (default strategy) και (b) DYNAMIC_INPUT bus slot στο `useDynamicInputKeyboard`. Καθαρίζει ΟΛΑ τα 9 fields (x/y/angle/length/radius/diameter + stair rise/tread/width). Idempotent. **Files modified (3)**: `useKeyboardShortcuts.ts`, `default-keyboard-handler.ts`, `useDynamicInputKeyboard.ts`. **Files created (1)**: `dynamic-input-actions.ts`. **Files updated (1 barrel)**: `keyboard-handlers/index.ts` (+ `closeDynamicInput` export). | Claude Opus 4.7 + Γιώργος Παγώνης |
| 2026-05-19 | Group 3 follow-up — **Dynamic Input cascade fix**. Bug report από Γιώργο: `ΟΤΑΝ ΤΟ DYNAMIC ΕΙΝΑΙ ΕΝΕΡΓΟΠΟΙΗΜΕΝΟ ΔΕΝ ΛΕΙΤΟΥΡΓΕΙ ΤΟ ESCAPE, ΟΤΑΝ ΔΕΝ ΕΙΝΑΙ ΛΕΙΤΟΥΡΓΕΙ`. Root cause: DYNAMIC_INPUT slot (priority 900, `allowWhenEditable: true`) πάντα consume με `return true` αφού η Strategy `getKeyboardHandler(activeTool)` καλείται για cleanup. Line/circle/stair strategy handlers επιστρέφουν `false` για Escape (μόνο default κάνει clear), αλλά ο wrapper πάντα `return true`. Άρα DRAW_TOOL (priority 500) δεν τρέχει ποτέ → tool παραμένει active. Plus: ακόμα κι αν DI επέστρεφε `false`, ο bus cached το `editable=true` στην αρχή του dispatch και skip-άρε το DRAW_TOOL (allowWhenEditable: false). **Fix (2 αρχεία)**: (1) `EscapeCommandBus.runHandlerChain` — `isEditableFocus()` επανυπολογίζεται per-iteration αντί cached prior to the loop, ώστε ένας handler που blur-άρει + return false να μπορεί να αφήσει τον bus να συνεχίσει σε editable-blocked handler χαμηλότερης priority. (2) `useDynamicInputKeyboard` DYNAMIC_INPUT bus slot — μετά τη Strategy call καθαρίζει explicitly όλα τα DI fields (belt-and-suspenders για line/circle/stair που δεν χειρίζονται Escape), κρύβει το overlay, blur-άρει το `document.activeElement`, και επιστρέφει `false` ώστε ο bus να συνεχίσει στο DRAW_TOOL → `onDrawingCancel` → `handleToolCompletion(activeTool, true)` → exit to 'select'. AutoCAD/Revit/ArchiCAD parity. Test: `EscapeCommandBus.test.ts` — νέο case `editable-allowed handler blurs + returns false → editable-blocked handler at lower priority runs` (case #25). ADR-364 §3.4 ενημερωμένο με per-iteration re-evaluation semantic. | Claude Opus 4.7 + Γιώργος Παγώνης |
| 2026-07-18 | **CreateBlockDialogHost pick-base-point → bus + inline-rename false-positive fix.** (1) `CreateBlockDialogHost` (ADR-652 M6): το ιδιωτικό `window.addEventListener('keydown', …Escape…)` για ακύρωση του «pick base point» armed mode αντικαταστάθηκε με `useEscapeHandler` (priority `MODAL_DIALOG`, `canHandle: () => armed`). Ο tool-hint override έμεινε σε ξεχωριστό effect. (2) Νέο SSoT helper `ui/utils/inline-rename-keyboard.ts` (`handleInlineRenameKey`) για local rename `<input>` Enter/Escape — το bus σκιπάρει editable focus, οπότε τα εστιασμένα rename inputs χειρίζονται το δικό τους Escape τοπικά· ΕΝΑ allowlisted σημείο κρατά πλέον το `'Escape'` literal. Καταναλωτές: `FrameProfileCard` (νέο, ADR-676) + `EntityCard` (layers, 2→0 ratchet). Allowlist + description του `escape-command-bus` module ενημερώθηκαν. | Claude Opus 4.8 + Γιώργος Παγώνης |
| 2026-06-03 | **Boy-Scout Group 4 — 10 secondary components migrated.** PropertiesPalette + QuickPropertiesMiniPanel: window listeners αντικαταστάθηκαν με `useEscapeHandler` (bus, GROUP A). DimStyleCreateDialog + LayerStateDropdown (LayerStateSaveButton): τοπικό `e.key==='Escape'` αφαιρέθηκε — Radix Dialog/Popover onEscapeKeyDown → onOpenChange αρκεί (GROUP B). LayerItem, ColorGroupItem, LayerStateDropdownPopover, LayerStateManageRow (hook στο LayerStateManagePanel parent), TextOverrideEditor (FieldTokenInput sub-component), StairPresetsSection: bus hook με `allowWhenEditable: true` + `canHandle` gate (GROUP C). GripContextMenu + useGripContextMenuController ελέγχθηκαν — μόνο `contextmenu` listener, χωρίς `keydown`/Escape — εκτός scope. SSoT baseline: 149→129 violations (−20), 99→88 files (−11). tsc: 0 errors. Jest EscapeCommandBus: 24/24 PASS. | Claude Sonnet 4.6 |
| 2026-07-25 | **Φ1 ENFORCEMENT — κριτήριο διάκρισης + ταξινόμηση (νέο §10). ΚΑΜΙΑ αλλαγή κώδικα.** Αφορμή: μετρημένο στο browser test του ADR-692 — ένα ESC ακύρωσε marquee **και** έκλεισε gizmo, επειδή `stopPropagation()` δεν σταματά sibling listeners στον **ίδιο** κόμβο (`window`, capture). **(1) Κριτήριο T1/T2/T3** («υπάρχει ανταγωνιστής;», όχι «είναι input field;»), που συμβιβάζει δύο αντικρουόμενα προηγούμενα του ίδιου ADR — Group 4 GROUP C (bus) vs `inline-rename-keyboard.ts` (τοπικό): και τα δύο σωστά, διακριτικό ο ανταγωνιστής. **(2) Ταξινομία ανταγωνιστών** (bus capture, Radix `DismissableLayer` σε document capture, react-aria `useOverlay`, `HOT_GRIP_OP` P975). **(3) Το «24» ήταν λάθος φακός**: τρία ανεξάρτητα ιδιώματα — G (global listener + `Escape`) = 24, R (ratchet regex) = 23, **G∩R = 7**, + I (`matchesShortcut(e,'escape')`, πεζό, αόρατο σε **αμφότερα**) = 2 ⇒ **42 αρχεία**. Νέα κενά regex: `e.code === 'Escape'` (**το gizmo bug**, `shortcut-dispatcher.ts:232`) και `e.key !== 'Escape'` (`useZoomWindowTool.ts:70`). **(4) Ταξινόμηση 19 Κ1 / 21 Κ2 / 2 Κ3.** Κ3 ήταν εξ ορισμού αδύνατο να βρεθεί στα 24 (το grep έψαχνε global listeners). **(5) Νέα ζωντανά bugs**: `eyedropper.ts:133` (ένα ESC ακυρώνει eyedropper **και** κλείνει όλο τον color picker μέσω react-aria ancestor)· `PromptDialog.tsx:124` (το `HOT_GRIP_OP` κλέβει το ESC σε grip flow)· **διπλή αποστολή** — ο regex-καθαρός `useCanvasKeyboardShortcuts.ts:351` προωθεί ωμό `e.key` στα trim/scale/stretch/extend, που συγκρίνουν εσωτερικά, ενώ τα **ίδια** `handleXEscape` είναι ήδη εγγεγραμμένα σε `MODIFY_TOOL` ⇒ εκτελούνται **δύο φορές** ανά πάτημα. **Ο ratchet μετρά το string, όχι τη συμπεριφορά.** **(6) CHECK 3.7 αποκωδικοποιημένο**: staged-only (`check-ssot-imports.js:317`), per-file άθροισμα, `current === baseline` ⇒ `same` ⇒ περνά σιωπηλά για πάντα — γι' αυτό ζει το `useTrimTool.ts` (baseline 1 / τρέχον 1, εκτός allowlist). Baseline: **41** dxf-viewer αρχεία (όχι 0). **(7) Διόρθωση drift §6** (N.0.1 — ο κώδικας κερδίζει): το §6 τεκμηριώνει 2 άλλα patterns + 5 allowlist entries· το πραγματικό registry έχει 2 patterns + **8** entries, και το `addEventListener…Escape` αφαιρέθηκε σωστά (γραμμικό grep, δεν έπιανε τίποτα). **(8) Νεκρός κώδικας** προς διαγραφή αντί μετανάστευσης: `useEntityDrag` chain (barrel-only, αντικαταστάθηκε από `EntityBodyDragStore` που είναι σωστά στον bus), `useDrawingKeyboardShortcuts`, `createKeyboardHandler`, `CommentMentionsPicker` keydown (τίποτα δεν εστιάζει το listbox — και bug προσβασιμότητας). Το knip αγνοεί το dxf-viewer. **(9) Allowlist μπορεί να στενέψει**: 3 από 4 keyboard-core entries δεν έχουν πλέον matching literal· μένει το `useDimToolRouting.ts:140`. ⚠️ Αλλά η αφαίρεση του `useCanvasKeyboardShortcuts.ts` θα «πράσινιζε» αρχείο που είναι **Κ2 δομικά**. Φ2 απαιτεί ratchet-down των 41 baseline entries, όχι μόνο νέο pattern. Έρευνα Revit/VS Code από το handoff — δεν επαναλήφθηκε. | Claude Opus 5 + Γιώργος Παγώνης |
| 2026-07-25 | **§10.10 — Φ2 Μηχανισμός 1 ΥΛΟΠΟΙΗΘΗΚΕ (dev-time audit). Καμία αλλαγή στη δρομολόγηση.** Πριν τον κώδικα μετρήθηκε η **τοπολογία** των ανταγωνιστών (στόχος + φάση ανά listener) και **δύο ισχυρισμοί του §10.6 δεν επιβίωσαν**. **(1) Δεν είναι «17 Κ2», είναι δύο ζώνες**: το `stopImmediatePropagation()` αγγίζει **μόνο** τους 5 αδελφούς σε `window` capture (`useCanvasKeyboardShortcuts`, `use3DShortcuts`→gizmo, `useDxfViewerEffects`, `useColorMenuState`, `use-waypoint-drag-interaction`)· οι υπόλοιποι **12 είναι κατάντη** (document capture / bubble / React bubble) και τους σταματά **ήδη** το υπάρχον `stopPropagation()` — δεν είναι παρακάμψεις του μηχανισμού αλλά **ελλείπουσες εγγραφές**, άρα θεραπεία = Φ3 μετανάστευση, ΟΧΙ Μηχ. 2. Επιβεβαιώνει το §10.2 («μόνη επικίνδυνη κατηγορία = global capture»). **(2) Ο ανιχνευτής που πρότεινε το §10.6 έχει δύο δομικά τυφλά σημεία**: ο bus **δεν είναι εγγυημένα πρώτος** (σειρά = σειρά mount ⇒ ανταγωνιστής που εγγράφεται μετά είναι αόρατος) και **λιμοκτονείται** από `stopImmediatePropagation()` προγενέστερου listener (`useCanvasKeyboardShortcuts.ts:145` το καλεί ήδη) ⇒ ο ισχυρισμός «πιάνει και τα 3 ιδιώματα και τη διπλή αποστολή» **δεν ισχύει**. **Λύση: σεντινέλα σε χρόνο import** (πριν κάθε effect ⇒ πρώτη) που στιγματίζει το συμβάν και κρίνει σε `setTimeout(0)` — **αφού** τελειώσει η διάδοση, όταν το `defaultPrevented` είναι τελικό (`queueMicrotask` λάθος: ο checkpoint τρέχει **ανάμεσα** στους listeners). 4 ετυμηγορίες: `ok` / **`starved`** / **`preempted`** / **`shadow-owner`** — οι δύο τελευταίες είναι ακριβώς ό,τι ο αρχικός ανιχνευτής έχανε. **Τυφλό σημείο ΚΑΡΦΩΜΕΝΟ ΣΕ TEST**: σιωπηλός ανταγωνιστής (ούτε `preventDefault` ούτε `stop*`) βγάζει `ok` — μετρημένοι `eyedropper.ts:132`, `ZoomControls.tsx:82`, `useZoomWindowTool.ts:70` (3/17) ⇒ **Μηχ. 1 και 3 συμπληρωματικοί, όχι εναλλακτικοί**· το test υπάρχει ώστε το `ok` να μη διαβαστεί ως «καθαρό» (παθολογία N.11/N.12). **Νέα**: `escape-dev-audit.ts` (170 γρ., dev-only, SSR-safe, `WeakMap`) + 8 tests· `EscapeCommandBus.ts` +3 γραμμές (install σε import· `preemptedAtEntry` **πριν** την αλυσίδα). **jest 32/32** (24 προϋπάρχοντα αμετάβλητα)· `jscpd:diff` καθαρό (N.18). ⚠️ **Εκκρεμεί browser** — το ESC αποδεικνύεται με πάτημα πλήκτρου, και οι ζωντανές ετυμηγορίες απαντούν εμπειρικά το ερώτημα σειράς mount. Μηχανισμοί 2–4 δεν ξεκίνησαν. | Claude Opus 5 + Γιώργος Παγώνης |
| 2026-07-25 | **§10.12 — Η ΡΙΖΑ: το τελευταίο ESC slot κατανάλωνε ΚΑΘΕ πάτημα. ΔΙΟΡΘΩΘΗΚΕ.** Ψάχνοντας γιατί ο Μηχ. 2 έσβησε **ολόκληρη** τη Ζώνη Α αντί για επιλεκτικά, βρέθηκε ότι το `useKeyboardShortcuts.ts` είχε `canHandle: () => true` στο slot `COLOR_MENU` (100) — **το χαμηλότερο της αλυσίδας** — με `handle` που πάντα επέστρεφε `true`. Δηλαδή **ο bus «κατανάλωνε» κάθε ESC της εφαρμογής χωρίς να έχει συμβεί τίποτα**. Τρεις μετρημένες συνέπειες: (α) η αλυσίδα **δεν έφτανε ποτέ** στην κατάσταση «κανείς δεν διεκδίκησε» — `defaultPrevented === true` ακόμα και σε εντελώς αδρανή viewer· (β) η ετυμηγορία **`shadow-owner` του Μηχ. 1 ήταν πρακτικά ανέφικτη** (πάντα `consumedBy ≠ null` ⇒ πάντα `ok`) — δηλαδή το «όλα ok» του §10.11.Α ήταν εν μέρει **artefact αυτού του bug**· (γ) με τον Μηχ. 2 το `stopImmediatePropagation()` **δεν ήταν ποτέ επιλεκτικό**, σιωπούσε τη Ζώνη Α σε κάθε πάτημα — η πραγματική αιτία της παλινδρόμησης του 3D gizmo. ⇒ **Το §10.11 απέδωσε την παλινδρόμηση στην απουσία του `EDIT_GIZMO_3D`· αυτό ισχύει αλλά ήταν το ΔΕΥΤΕΡΟ μισό.** **Ήταν ταυτόχρονα διπλότυπο (N.0.2):** το `useColorMenuState.ts:98-111` είχε ιδιωτικό `window` capture listener για το ίδιο ESC, καλώντας το ίδιο `close()`, και μάλιστα **σωστά gated** — δύο ιδιοκτήτες, ο ένας ungated. Είναι ακριβώς το **Κ2 #8** του §10.5 («το slot υπάρχει ήδη γι' αυτό ακριβώς»). **Διόρθωση**: `canHandle: () => isColorMenuOpen` (νέο πεδίο config) + `DxfViewerContent` περνά `colorMenu.open` + **ο ιδιωτικός listener διαγράφηκε** ⇒ ένας ιδιοκτήτης, σωστά gated, και η **Ζώνη Α 5 → 4**. Το `useEscapeHandler` κρατά ref ανά render (γρ. 29-30) ⇒ καμία stale closure. **Επαλήθευση browser**: ESC σε αδρανή viewer, `defaultPrevented` **`true` → `false`**. **jest 58/58**. ⏳ Απομένουν για τον Μηχ. 2: (1) Μηχ. 4 — `EDIT_GIZMO_3D=290` + stair-sub exit (~273) στον bus, αφαίρεση των 2 `event.code === 'Escape'` από `shortcut-dispatcher.ts:232/270`, ενημέρωση 2 tests· (2) slot για καθαρισμό `Selection3DStore` (μετρημένο κενό §10.11.Ε.2)· (3) ενεργοποίηση Μηχ. 2 + ξανα-επαλήθευση σκάλας. | Claude Opus 5 + Γιώργος Παγώνης |
| 2026-07-25 | **§10.11 — Φ2 Μηχανισμός 2 ΜΕΤΡΗΘΗΚΕ ΣΤΟΝ BROWSER, ΠΡΟΚΑΛΕΣΕ ΠΑΛΙΝΔΡΟΜΗΣΗ, ΕΠΑΝΑΦΕΡΘΗΚΕ. Καμία αλλαγή δρομολόγησης στο δέντρο.** **(1) Ο Μηχ. 1 διαβάστηκε επιτέλους ζωντανά** — αλλά **πρώτα επικυρώθηκε το όργανο**: το `report()` κάνει early-return στο `ok`, άρα η σιωπή δεν είναι απόδειξη· στήθηκε θετικό control (listener σε `document` capture που κάνει `preventDefault` ενώ ο bus δεν διεκδικεί ⇒ όφειλε να βγει `shadow-owner`, και βγήκε). 7 σενάρια: γραμμή · marquee · 3D gizmo ×3 · color dialog · dropdown κλίμακας · editable input · **ενεργό trim** ⇒ **όλα `ok`· καμία `starved`, καμία `preempted`**. **(2) Το `trim` απάντησε το ερώτημα σειράς mount που κανένα static tool δεν μπορεί**: το `useCanvasKeyboardShortcuts:165` κάνει `preventDefault()` όταν το `handleTrimKeyDown('Escape')` καταναλώσει (`useTrimTool.ts:305`)· αν έτρεχε πρώτο, ο bus θα έβλεπε `preemptedAtEntry=true` ⇒ `preempted`. Βγήκε `ok` ⇒ **ο bus είναι ΠΡΩΤΟΣ**, άρα ο Μηχ. 2 όντως κόβει την αλυσίδα Κ2-β. ⚠️ Η σειρά είναι σειρά mount, δηλαδή **αναδυόμενη**· φύλακας ο Μηχ. 1. **(3) 🔴 Ο Μηχ. 2 ΜΟΝΟΣ ΤΟΥ ΕΙΝΑΙ ΠΑΛΙΝΔΡΟΜΗΣΗ** — υλοποιήθηκε, jest 36/36, και σε A/B στον ίδιο browser: **πριν** = 2ο ESC κλείνει το 3D gizmo· **μετά** = το gizmo **δεν κλείνει με κανέναν αριθμό πατημάτων** (μετρήθηκε ώς 4), επειδή σιωπά τον `shortcut-dispatcher.ts:232` (Ζώνη Α) που είναι ο **ΜΟΝΟΣ** που το κλείνει, και **δεν υπάρχει slot `EDIT_GIZMO_3D`**. Κατάσταση χειρότερη από την αρχική: επιλογή καθαρή, gizmo **ορφανό**. ⇒ **Η εξάρτηση είναι αντίστροφη από το §10.6/§10.10: ο Μηχ. 4 είναι ΠΡΟΫΠΟΘΕΣΗ του Μηχ. 2**, όχι «τελευταίος». **(4) Επαναφορά + φύλακας**: ο bus ξαναγύρισε σε `stopPropagation()` με σχόλιο που δείχνει εδώ, και τα **4 νέα tests** (36/36) καρφώνουν ότι ο αδελφός `window`-capture **εξακολουθεί** να τρέχει όταν ο bus καταναλώνει ⇒ γίνονται **κόκκινα** αν κάποιος ξαναβάλει `stopImmediatePropagation()` χωρίς τον Μηχ. 4. **(5) Διόρθωση §10.5 Κ2 #4**: το `eyedropper.ts:133` είναι **Firefox-only** — σε Chrome/Edge το `openEyedropper()` (γρ. 51-54) παίρνει το native `EyeDropper` branch και η `openDomEyedropper()` δεν καλείται ποτέ (επαληθεύτηκε ζωντανά). Δεν είναι «ζωντανό bug» στον κύριο browser· χαμηλότερη προτεραιότητα. **(6) Νέο ζωντανό εύρημα (Φ3)**: στο 3D η σκάλα σταματά στο 2ο σκαλί — 3ο ESC δεν κάνει τίποτα και το στοιχείο **μένει επιλεγμένο** (δείκτης μακριά, όχι hover), ενώ ο bus **κατανάλωσε** και στα τρία ⇒ handler του bus καταναλώνει **χωρίς ορατή ενέργεια**, μπλοκάροντας χαμηλότερες προτεραιότητες. | Claude Opus 5 + Γιώργος Παγώνης |
| 2026-07-25 | **SPLIT — τα §10.9–§10.9.3 έφυγαν στο ADR-700.** Το record είχε φτάσει **1.170 γραμμές με δύο ανεξάρτητες αποφάσεις**: τον Escape Command Bus (§1–§10.8) και το barrel-aware dead-export gate / CHECK 3.30 (§10.9.x), που ήταν παρακλάδι του §10.7.1 — νόμιμο βήμα-βήμα, scope creep στο άθροισμα. Η πρακτική είναι ομόφωνη (**μία απόφαση ανά record**· ADR πάνω από μία σελίδα ⇒ τεκμηριώνει πολλαπλές, σπάσ' τες). Μεταφέρθηκαν **507 γραμμές + 5 εγγραφές changelog, αυτούσια**· ό,τι μένει εδώ αφορά **μόνο** το ESC. Στη θέση τους έμεινε pointer με πίνακα αντιστοίχισης §10.9→§1 … §10.9.3→§4. **Καμία αλλαγή στο CHECK 3.30** (ελεγκτής / γράφος / workflow / hook PHASE 0.8 / baseline δεδομένα άθικτα) — ενημερώθηκαν **μόνο** οι συμβολοσειρές αναφοράς ADR, ώστε να μη μείνει dangling παραπομπή. | Claude Opus 5 + Γιώργος Παγώνης |
| 2026-07-25 | **§10.13 follow-up — CHECK 3.7 allowlist για τον `shortcut-dispatcher.ts`.** Το ένα εναπομείναν bail του §10.13 (`dispatchShortcut` γρ. 117: `if (event.code === 'Escape' \|\| event.key === 'Escape') return NOT_HANDLED;`) πιάστηκε από το CHECK 3.7 (`escape-command-bus` module, pattern `key === 'Escape'`) ως NEW-FILE zero-tolerance παραβίαση. **Δεν είναι παραβίαση αλλά ο ΦΥΛΑΚΑΣ του SSoT**: είναι το single point που κρατά κάθε 3D ESC ρήγα ως gated escape-bus slot (βγάζει το ESC έξω από τον pure dispatcher). Ίδια ακριβώς κατηγορία drop-ESC με το ήδη-allowlisted `useDimensionKeyboardRouting.mapKey()`. Προστέθηκε το `bim-3d/shortcuts/shortcut-dispatcher.ts` στο allowlist του module + ενημερώθηκε η description. Καμία αλλαγή κώδικα/συμπεριφοράς — μόνο registry. CHECK 3.7 → EXIT 0. | Claude Opus 4.8 + Γιώργος Παγώνης |
| 2026-07-25 | **§10.13 — Φ2 Μηχανισμός 4 (σκάλα 3D → bus) + ΞΕΜΠΛΟΚΑΡΙΣΜΑ Μηχανισμού 2.** Το SSoT audit πριν τον κώδικα **ακύρωσε το σχέδιο του §10.12**: τα προτεινόμενα `EDIT_GIZMO_3D = 290` / stair-sub `~273` θα ήταν **ανεκτέλεστα**, επειδή (α) το `ENTITY_SELECTION` (250) **δεν το χρησιμοποιεί καμία εγγραφή** — ο πραγματικός αποεπιλογέας είναι το σύνθετο `canvas/fallback-deselect` στο `DRAFT_POLYGON` (400), (β) το `BimViewport3D` είναι leaf **μέσα** στο `CanvasLayerStack`, άρα οι 2D εγγραφές τρέχουν και στο 3D, και (γ) το gizmo είναι auto-on-selection ⇒ όσο είναι πάνω, το 400 διεκδικεί πάντα. Νέες σταθερές στη ζώνη **420 / 415 / 410** (κάτω από `BODY_DRAG` 425, πάνω από το 400). Οι κλάδοι ESC του dispatcher ήταν **τρεις, όχι δύο** — ο τρίτος (`focusClear`, `key: 'Escape'`) επέστρεφε `HANDLED` **χωρίς gate** σε κάθε 3D ESC, ίδιο σφάλμα με τη ρίζα του §10.12. Και οι τρεις αντικαταστάθηκαν από **ένα** bail στον `dispatchShortcut` + 4 gated slots στο νέο `bim-3d/shortcuts/use3DEscapeRegistrations.ts` (καθρέφτης του `useCanvasEscapeRegistrations`). **Το τρίτο κενό ήταν όντως SSoT εύρημα**: `SelectedEntitiesStore` και `Selection3DStore` κρατούν την ίδια έννοια με **μονόδρομη** γέφυρα 3D→universal, οπότε ο ESC καθαρίζει πλέον τη **3D** πλευρά και η υπάρχουσα γέφυρα κατεβάζει το universal — μία ενέργεια, δύο stores, κανένα νέο μονοπάτι. Με τη Ζώνη Α άδεια, μπήκε ο **Μηχ. 2** (`stopPropagation` → `stopImmediatePropagation`): το 1ο από τα 4 tests-φύλακες **αντιστράφηκε** κατά σχέδιο, τα άλλα 3 έμειναν έγκυρα· θεραπεύτηκε παράπλευρα και η **διπλή αποστολή του §10.5 Κ2-β** (`handleTrimEscape` ×2 ανά πάτημα). Ο έλεγχος έγινε **αναγνώσιμος**: `window.__escapeAudit` (dev-only) εκθέτει `consumedBy` — αναγκαίο αφού ο Μηχ. 2 κόβει κάθε εξωτερικό παρατηρητή. **Αρχεία**: +2 νέα (`use3DEscapeRegistrations.ts`, `use3DEscapeRegistrations.test.ts`), 6 τροποποιημένα. **jest 81/81** (βάση 58 + 23 νέα). jscpd καθαρό. | Claude Opus 5 + Γιώργος Παγώνης |
