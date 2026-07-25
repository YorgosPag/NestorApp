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

> **Ενημέρωση 2026-07-25**: το τυφλό σημείο του §10.7.1 έχει πλέον **όργανο** — §10.9. Το όργανο
> είναι επικυρωμένο (3/4 vs 1/4 του knip, 50 tests, browser). Η **επιβολή** του παραμένει ανοιχτή:
> baseline άγραφο, hook ασύνδετος, μηδέν διαγραφές. Όργανο ≠ gate.

### 10.9 CHECK 3.30 — barrel-aware dead-export gate (2026-07-25)

Απάντηση στο κενό που κατέγραψε το §10.7.1. **Δεν** είναι ρύθμιση του knip — είναι διαφορετική
ερώτηση, που το knip δεν μπορεί να κάνει όσο τα barrels είναι entry points.

| Αρχείο | Ρόλος |
|---|---|
| `scripts/lib/module-graph/resolve-specifier.js` | Ανάλυση specifier· alias table από `tsconfig.base.json` (SSoT), **μεγαλύτερο prefix κερδίζει** (`@/systems/*` πριν το `@/*`) |
| `scripts/lib/module-graph/parse-module.js` | Ένα αρχείο → exports / imports / re-exports / μετρητές ταυτοτήτων |
| `scripts/lib/module-graph/build-graph.js` | Γράφος + **fixpoint προσπελασιμότητας** από τις ρίζες |
| `scripts/lib/module-graph/classify-exports.js` | Οι 5 κάδοι |
| `scripts/lib/module-graph/scan-config.js` | Τι διαβάζεται, τι μετρά ως ρίζα |
| `scripts/check-barrel-deadcode-ratchet.js` | CLI + ratchet (`--report` / `--explain` / `--check` / `--write-baseline`) |
| `scripts/__tests__/check-barrel-deadcode-ratchet.test.js` | **50 tests** — το σενάριο §10.7 καρφωμένο ως regression |

#### Οι δύο κανόνες που κάνουν τη διαφορά

**1. Το είδος της δήλωσης αποφασίζει, όχι το όνομα του αρχείου.**
`import` **καταναλώνει**· `export … from` **προωθεί**. Άρα μια αλυσίδα barrels προσθέτει **μηδέν**
καταναλωτές, και η χρήση πιστώνεται στο αρχείο που **δηλώνει** το σύμβολο. Το `export { X }` χωρίς
`from` διορθώνεται **πάντα** ως προώθηση για την απόδοση προέλευσης (αλλιώς η χρήση πιστώνεται σε
λάθος module και η πραγματική δήλωση φαίνεται αζήτητη), αλλά αφαιρείται από την κατανάλωση **μόνο**
σε καθαρό barrel. Πλευρικό όφελος: πιάνει και τα **non-index barrels** — π.χ. το
`ui/DxfViewerComponents.styles.ts:281` («Sub-module re-exports (backward compat)»), που κρύβει
10 σύμβολα χωρίς να λέγεται `index.ts`.

**2. Προσπελασιμότητα, όχι «έχει importer».**
Το βρήκε το ίδιο το εργαλείο πάνω στα δεδομένα του §10.7: το `useEntityDrag` είχε **ακριβώς έναν**
importer — το `useMovementOperations`, που ήταν κι αυτό νεκρό. **Νεκρό νησί.** Με κανόνα ενός
βήματος τα μέλη κρατούν το ένα το άλλο ζωντανό για πάντα. Άρα η ζωντάνια είναι fixpoint από τις
ρίζες που **όντως** καλεί το framework (Next `page`/`layout`/`route`/`middleware`, `*.worker.ts`) —
και τα barrels **δεν** είναι ρίζες, σε αντίθεση με το `knip.json:14`.

#### Οι 5 κάδοι — γιατί όχι δύο

| Κάδος | Σημασία | Ενέργεια |
|---|---|---|
| `live` | Προσπελάσιμο και εισαγόμενο ονομαστικά | — |
| `testOnly` | Ζει μόνο όταν σπείρουμε τα tests ως ρίζες | **ΠΟΤΕ στο ratchet** — διαγραφή αφαιρεί το συμβόλαιο, όχι τον καλούντα |
| `suspect` | Απροσπέλαστο, αλλά το όνομα εμφανίζεται σε **ζωντανό** module | Άνθρωπος αποφασίζει |
| `unusedExport` | Απροσπέλαστο απ' έξω, **ζωντανό μέσα στο αρχείο του** | Πέταξε τη λέξη `export`, **όχι** τον κώδικα |
| `dead` | Απροσπέλαστο, και το όνομά του δεν εμφανίζεται σε κανένα ζωντανό module | Ο **μόνος** κάδος που μετρά το ratchet |

Χωρίς το `unusedExport` ο κάδος `dead` ήταν **5.067**· με αυτό **1.625**. Ένα `interface Opts` που
χρησιμοποιείται ως τύπος παραμέτρου στο ίδιο αρχείο **δεν** είναι νεκρός κώδικας — είναι υπερβολικά
πλατύ export. Το `unusedExport` δίνεται **μόνο** σε προσπελάσιμο module: σε νεκρό module η «τοπική
χρήση» είναι μια νεκρή γραμμή που καλεί μια άλλη.

Το δίχτυ ασφαλείας (`suspect`) διαβάζει **AST ταυτότητες, όχι grep**: το `Floating3DPanel`
αναφέρεται σε 5 αρχεία — **όλα σε σχόλια**. Το grep θα το έλεγε ζωντανό· ο parser όχι. Και ρωτά
«εμφανίζεται σε **ζωντανό** module;» — αλλιώς κάθε νεκρό νησί θα αυτο-πιστοποιούνταν ως `suspect`.

#### Επαλήθευση

**Α. Έναντι των 4 του §10.7** — τρέξιμο πάνω σε `git archive 90c351a5` (το commit **πριν** τη
διαγραφή) σε scratchpad, χωρίς άγγιγμα του κοινού tree:

| Σύμβολο | knip 6.6.2 | CHECK 3.30 |
|---|---|---|
| `useEntityDrag` | ❌ | ✅ `dead` (+ dead file) |
| `useMovementOperations` | ❌ | ✅ `dead` |
| `useDrawingKeyboardShortcuts` | ✅ | ✅ `dead` |
| `createKeyboardHandler` | ❌ | ⚠️ **εκτός εμβέλειας** |
| | **1 / 4** | **3 / 4** |

Το 4ο **δεν** είναι module-level export: είναι `const` **μέσα** στο hook, που επιστρέφεται ως πεδίο
του object API (`useSettingsUpdater.ts:117` → `:150`). Αυτό είναι «νεκρό μέλος επιστρεφόμενου
αντικειμένου» — άλλη, δυσκολότερη ερώτηση, που απαιτεί type-level ανάλυση. **Το εργαλείο δεν το
βλέπει και δεν προσποιείται ότι το βλέπει.**

Παρεμπιπτόντως, το `useMovementOperations.ts` **δεν** αναφέρεται ως ολόκληρο νεκρό αρχείο: εξάγει
`NUDGE_CONFIG`, όνομα που ζει και στο `useKeyboardShortcuts.ts` → `suspect`. Το δίχτυ δούλεψε
ακριβώς όπως σχεδιάστηκε — σύγκρουση ονομάτων ⇒ άνθρωπος, όχι διαγραφή.

**Β. Ακρίβεια σε δείγμα** — 14 εγγραφές κατανεμημένες στη λίστα, ελεγμένες με το χέρι:
**12/12 σωστές** (2 από τις 14 ήταν διπλότυπα ονόματος). Ενδεικτικά επιβεβαιωμένα barrel-only:
`ViewerModeSchema` (μόνο μέσω `settings/index.ts`), `getKindButtonStyles` (μέσω non-index barrel),
`useCanvasContext` (οι καταναλωτές καλούν `useContext(CanvasContext)` κατευθείαν).

**Γ. Αρνητικός έλεγχος** — 10 πυρηνικά σύμβολα (`DxfRenderer`, `HoverStore`, `EscapeCommandBus`,
`ImmediateTransformStore`, `getImmediateTransform`, `UnifiedFrameScheduler`, `pickTopEntityAt`,
`WebglLineLayerManager`, `useViewportManager`, `DxfCanvas`): **κανένα** δεν χαρακτηρίστηκε νεκρό.

**Δ. jest** — 50/50 PASS (`npm run test:barrel-deadcode`, ~3s).

**Δ2. Και οι τρεις διαδρομές του ratchet, end-to-end** (ένα gate που δεν έχει δει ποτέ κόκκινο δεν
είναι gate). Με πειραγμένα baselines στο scratchpad μέσω `--baseline`, χωρίς άγγιγμα του αληθινού:

| Διαδρομή | Σενάριο | Αποτέλεσμα |
|---|---|---|
| 🟢 σταθερό | αληθινό baseline | `✅ no new barrel-only dead exports (1625 / 332)`, exit 0 |
| 🔴 οπισθοδρόμηση | αφαιρέθηκαν 2 exports + 1 αρχείο από το baseline | `❌ FAIL — 2 new dead export(s)` + `1 new dead file(s)`, **ονομαστικά**, exit 1 |
| 🔵 πρόοδος | προστέθηκε φάντασμα στο baseline | `✅ 1 entr(ies) cleaned … Lock it in`, exit 0 |

**Ε. Πραγματικός browser** (`localhost:3000/dxf/viewer`): πλήρες φόρτωμα Ισογείου (550 στοιχεία),
καρτέλα **Τοπογραφικό**, διακόπτης **Βορράς → Εμφάνιση/Απόκρυψη** ✅, **μηδέν** σφάλματα κονσόλας
από την εφαρμογή. Διασταύρωση με το εύρημα: το `toggleNorthArrowVisible` αναφέρθηκε `dead` ενώ το
module του είναι ζωντανό — και όντως το UI καλεί `setNorthArrowVisible(!opts.visible)`
(`NorthArrowSection.tsx:66`). **Στατική ανάλυση και ζωντανό UI συμφωνούν στο ίδιο σύμβολο.**

#### Μέτρηση στο τρέχον δέντρο (2026-07-25)

13.192 αρχεία αναλυμένα, 5.697 modules στην εμβέλεια `src/subapps/dxf-viewer`, **~29s**:

| dead | unusedExport | suspect | testOnly | live | dead files |
|---|---|---|---|---|---|
| **1.625** | 3.625 | 444 | 1.408 | 14.406 | **332** |

Έναντι knip χωρίς το `ignore`: 831 exports + 305 types + 252 αρχεία. Οι διαφορές είναι το barrel
τυφλό σημείο συν τα νεκρά νησιά. **501 από τα 1.625 dead exports ζουν σε αρχεία ολόκληρα νεκρά.**

#### Κατάσταση επιβολής — ρητά

- ✅ Εργαλείο, tests, CLI, ratchet μηχανή: **έτοιμα**.
- ✅ **Baseline γεννήθηκε** (2026-07-25, τρίτο βήμα κατ' εντολή Giorgio — ώστε να προέλθει από
  εργαλείο που ξέρουμε ότι βλέπει σωστά): `.barrel-deadcode-baseline.json`, **156 KB**,
  **1.625 dead exports / 332 νεκρά αρχεία** στο `src/subapps/dxf-viewer`. Καταγράφει επίσης
  `unusedExport: 3625`, `suspect: 444`, `testOnly: 1408` ως **πληροφορία** — το ratchet συγκρίνει
  **μόνο** `deadExports` + `deadFiles`.
- ⛔ **ΔΕΝ** συνδέθηκε στο pre-commit hook. Δεν υπάρχει CHECK 3.30 στον hook σήμερα· ο αριθμός
  δεσμεύεται εδώ. ⚠️ **~30s ανά εκτέλεση** — αυτό είναι βάρος **CI (Layer 2)**, όχι hook, όπως
  ακριβώς το CHECK 3.29 (ADR-663). Η απόφαση εκκρεμεί.
- ⛔ **Καμία διαγραφή.** Η λίστα είναι **αποδεικτικό υλικό, όχι άδεια**. Περιστατικό 2026-04-24
  (13 scaffolding αρχεία / 2.338 γρ. του ADR-321 σβήστηκαν από μαζικό batch που εμπιστεύτηκε το
  εργαλείο) — ένα αρχείο τη φορά, με χειροκίνητη απόδειξη, όπως στο §10.7.

#### Όρια — τι ΔΕΝ βλέπει

1. **Μέλη επιστρεφόμενου object** (η περίπτωση `createKeyboardHandler`). Χρειάζεται type-level ανάλυση.
2. **Αναφορές μέσω string** σε registries. Πέφτουν σε `suspect` μόνο αν το string συμπίπτει με
   ταυτότητα σε ζωντανό module· αλλιώς αόρατες.
3. **Καταναλωτές εκτός `src`/`packages`** (`scripts/`, `functions/`). Δεν σαρώνονται· το δίχτυ
   ταυτοτήτων τα μαλακώνει, δεν τα εξαλείφει.
4. **Ρίζα που δεν δηλώθηκε** στο `scan-config.js` ⇒ ολόκληρο υποδέντρο φαίνεται νεκρό. Ο κατάλογος
   ριζών είναι SSoT και ελέγχεται από tests· κάθε νέο file convention του Next πάει **εκεί**.
5. **Δεν είναι tsc** (N.17): `ts.createSourceFile` χτίζει AST χωρίς Program και χωρίς διαγνωστικά.

#### SSoT

Το set-diff του ratchet μπήκε ως `compareSets` στο **υπάρχον** `scripts/lib/ratchet-baseline.js`
(δίπλα στο αριθμητικό `isRegression`), και το `check-deadcode-ratchet.js` (CHECK 3.22) **μετακινήθηκε
σε αυτό** — μία σύγκριση για την οικογένεια dead-code, όχι μία ανά script (N.18). Επαληθεύτηκε:
`node scripts/check-deadcode-ratchet.js` → `✅ Dead-code OK (baseline: 10)`. **Δεν** φτιάχτηκε νέα
μηχανή ratchet.

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
| 2026-07-25 | **§10.9 — CHECK 3.30, barrel-aware dead-export gate. Απάντηση στο §10.7.1.** Το knip 6.6.2 είναι **δομικά** τυφλό στα barrel-only exports (`knip.json:14` δηλώνει `src/**/index.ts` entry point ⇒ ό,τι προωθεί ένα barrel μετρά ως χρησιμοποιούμενο)· μετρημένα **1/4** στα χειροκίνητα επαληθευμένα σύμβολα του §10.7, και **1/4** ακόμα με `--include-entry-exports`. Νέο εργαλείο: `scripts/lib/module-graph/` (5 modules) + `scripts/check-barrel-deadcode-ratchet.js`. **Δύο κανόνες**: (1) *το είδος της δήλωσης αποφασίζει* — `import` καταναλώνει, `export … from` προωθεί, άρα αλυσίδα barrels = μηδέν καταναλωτές και η χρήση πιστώνεται στο αρχείο που **δηλώνει**· πιάνει και non-index barrels (`DxfViewerComponents.styles.ts`). (2) *προσπελασιμότητα, όχι «έχει importer»* — το ίδιο το εργαλείο βρήκε ότι το `useEntityDrag` είχε ακριβώς έναν importer, το επίσης νεκρό `useMovementOperations`: **νεκρό νησί** που αυτοσυντηρείται σε κανόνα ενός βήματος. Άρα fixpoint από τις πραγματικές ρίζες (Next page/layout/route/middleware, `*.worker.ts`)· τα barrels **δεν** είναι ρίζες. **5 κάδοι** αντί για 2: το `unusedExport` (ζωντανό μέσα στο αρχείο του) κόβει τα `dead` από 5.067 σε **1.625** — ένα `interface Opts` ως τύπος παραμέτρου δεν είναι νεκρός κώδικας. Το δίχτυ `suspect` διαβάζει **AST ταυτότητες, όχι grep** (το `Floating3DPanel` αναφέρεται σε 5 αρχεία, **όλα σε σχόλια**) και ρωτά «σε **ζωντανό** module;», αλλιώς κάθε νεκρό νησί αυτο-πιστοποιείται. **Επαλήθευση**: 3/4 έναντι 1/4 του knip πάνω σε `git archive 90c351a5` σε scratchpad (το 4ο, `createKeyboardHandler`, είναι μέλος επιστρεφόμενου object — **ρητά** εκτός εμβέλειας)· δείγμα **12/12** σωστά με το χέρι· αρνητικός έλεγχος 10/10 πυρηνικά σύμβολα όχι-νεκρά· **50/50 jest**· **browser** (Ισόγειο 550 στοιχεία, Τοπογραφικό → Βορράς toggle ✅, μηδέν σφάλματα εφαρμογής) με διασταύρωση: το `toggleNorthArrowVisible` είναι `dead` ενώ το UI καλεί `setNorthArrowVisible` — στατική ανάλυση και ζωντανό UI συμφωνούν. **Τρέχον δέντρο**: 1.625 dead / 3.625 unusedExport / 444 suspect / 1.408 testOnly / **332 νεκρά αρχεία** σε 5.697 modules, ~29s. **SSoT**: το set-diff μπήκε ως `compareSets` στο υπάρχον `scripts/lib/ratchet-baseline.js` και το CHECK 3.22 μετακινήθηκε σε αυτό (επαληθεύτηκε πράσινο) — καμία νέα μηχανή ratchet (N.18). **Κατάσταση**: όργανο ✅ · baseline **άγραφο** (3ο βήμα κατ' εντολή) · hook **ασύνδετος** · **μηδέν διαγραφές** (περιστατικό 2026-04-24). Όρια ρητά καταγεγραμμένα στο §10.9. | Claude Opus 5 + Γιώργος Παγώνης |
| 2026-07-25 | **§10.9 βήμα 3 — baseline γεννήθηκε + ratchet αποδεδειγμένο και στις 3 διαδρομές.** `.barrel-deadcode-baseline.json` (156 KB): **1.625 dead exports / 332 νεκρά αρχεία** στο `src/subapps/dxf-viewer`, + `unusedExport: 3625`, `suspect: 444`, `testOnly: 1408` ως πληροφορία (το ratchet συγκρίνει **μόνο** `deadExports` + `deadFiles`). **Καταγραφή, μηδέν άγγιγμα κώδικα.** Επαληθεύτηκαν και οι 3 διαδρομές με πειραγμένα baselines στο scratchpad μέσω `--baseline` (χωρίς άγγιγμα του αληθινού): 🟢 σταθερό → exit 0 · 🔴 αφαίρεσα 2 exports + 1 αρχείο από το baseline → `FAIL — 2 new dead export(s)` + `1 new dead file(s)` **ονομαστικά**, exit 1 · 🔵 πρόσθεσα φάντασμα → `1 entr(ies) cleaned … Lock it in`, exit 0. Ένα gate που δεν έχει δει ποτέ κόκκινο δεν είναι gate. **Εκκρεμεί απόφαση**: ~30s ανά εκτέλεση ⇒ ανήκει σε **CI (Layer 2)** όπως το CHECK 3.29, **όχι** στο pre-commit hook. Καμία διαγραφή· η διαλογή των 1.625 είναι ξεχωριστή δουλειά, ένα αρχείο τη φορά με χειροκίνητη απόδειξη. | Claude Opus 5 + Γιώργος Παγώνης |
