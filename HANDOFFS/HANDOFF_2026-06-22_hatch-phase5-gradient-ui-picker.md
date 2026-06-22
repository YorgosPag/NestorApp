# HANDOFF — ADR-507 Φ5 follow-up: Gradient UI picker (ribbon controls δημιουργίας gradient hatch)

> **Ημ/νία:** 2026-06-22 · **Origin:** ανάθεση Giorgio (επόμενο μετά το Φ5 gradient render/IO).
> **Ποιότητα:** FULL ENTERPRISE + FULL SSoT, Revit/AutoCAD-grade. ΟΧΙ forced abstraction, ΟΧΙ διπλότυπα.
> **Commit:** ΜΟΝΟ ο Giorgio. **Working tree:** ΜΟΙΡΑΖΕΤΑΙ με άλλον agent — `git add` ΜΟΝΟ δικά σου.
> **Σχετικό ADR:** `docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md` (§8 changelog Φ5).
> **Σχετικό memory:** `reference_hatch_gradient_fill` (Φ5 model/IO/render), `reference_hatch_patterns` (Φ2 picker).

---

## 0. ⚠️ ΠΡΩΤΟ ΒΗΜΑ — ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

Το tree αλλάζει ζωντανά. Τρέξε ΠΡΩΤΑ — βρες τι ΥΠΑΡΧΕΙ ώστε να το ΕΠΕΚΤΕΙΝΕΙΣ:

```bash
# Α) Τι committed/uncommitted (Φ5 gradient μπορεί να μπήκε commit):
"C:/Program Files/Git/cmd/git.exe" status --short
"C:/Program Files/Git/cmd/git.exe" log --oneline -8

# Β) Ο gradient SSoT (Φ5 — ΕΠΕΚΤΕΙΝΕ, ΜΗΝ ξαναγράψεις):
cat src/subapps/dxf-viewer/bim/hatch/hatch-gradient.ts          # HatchGradient type + resolveGradientStops
grep -n "gradient" src/subapps/dxf-viewer/types/entities.ts      # HatchEntity.gradient?

# Γ) Τα 5 UI surfaces του hatch ribbon (το reuse target):
cat src/subapps/dxf-viewer/ui/ribbon/data/contextual-hatch-tab.ts        # panels + comboboxes
cat src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/hatch-command-keys.ts  # command-key registry
cat src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonHatchBridge.ts       # read/write entity OR draw-defaults
cat src/subapps/dxf-viewer/bim/hatch/hatch-draw-defaults-store.ts        # HatchDrawDefaults (next-hatch)
grep -rn "comboboxVariant\|HatchPatternPicker" src/subapps/dxf-viewer/ui/ribbon  # Φ2 picker pattern

# Δ) Πού η δημιουργία hatch διαβάζει τα draw-defaults (πρέπει να χτίσει gradient):
grep -rn "getHatchDrawDefaults\|case 'hatch'" src/subapps/dxf-viewer --include=*.ts | grep -iv __tests__

# Ε) Υπάρχον color picker (μην φτιάξεις νέο — δες FILL_COLOR_OPTIONS / αν υπάρχει richer):
grep -rln "ColorPicker\|color-picker\|FILL_COLOR_OPTIONS\|aci-palette" src/subapps/dxf-viewer/ui --include=*.tsx
```

**Κανόνας:** αν grep δείξει υπάρχον SSoT → ΧΡΗΣΙΜΟΠΟΙΗΣΕ το. (Ο Giorgio κάνει σκληρό audit «δημιούργησες διπλότυπο;».)

---

## 1. ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ (Φ5 — τι ΥΠΑΡΧΕΙ ήδη)

**Gradient model + IO + render = ΕΤΟΙΜΑ (Φ5, 29 jest GREEN):**
- `HatchEntity.gradient?: HatchGradient` (`{ type, color1, color2?, singleColor?, tint?, angleDeg?, shift? }`).
- SSoT `bim/hatch/hatch-gradient.ts`: `HatchGradientType` (7 τύποι), `resolveGradientStops`, `isRadialGradientType`, `applyTint`, `normalizeGradientType`.
- Reader/writer DXF 450-470 (round-trip), `HatchRenderer.fillGradient` (CanvasGradient). `fillType:'gradient'`.

**❌ ΤΙ ΛΕΙΠΕΙ (= αυτό το handoff):** ΔΕΝ υπάρχει UI για να **δημιουργήσει** ο χρήστης gradient hatch. Το `FILL_TYPE_OPTIONS` στο `contextual-hatch-tab.ts` έχει μόνο `solid / user-defined / predefined`. Δεν υπάρχουν controls για gradient type / 2 χρώματα / γωνία / single-color. Τα draw-defaults δεν κουβαλούν gradient.

---

## 2. 🔴 DELIVERABLES (Revit «Fill Pattern → Gradient» grade)

### 2.1 `fillType` += `'gradient'` option
- `contextual-hatch-tab.ts` → `FILL_TYPE_OPTIONS` += `{ value:'gradient', labelKey:'ribbon.commands.hatchEditor.fillTypeGradient', isLiteralLabel:false }`.
- `useRibbonHatchBridge.onComboboxChange` (fillType branch, ~γρ.164): δέξου `'gradient'` → `patternType:'gradient'`· σε switch χωρίς gradient data → δώσε default gradient (mirror του «predefined χωρίς patternName → default»).
- i18n: NEW key `fillTypeGradient` σε `el` + `en` (`dxf-viewer-shell`).

### 2.2 NEW «Γέμισμα Gradient» controls (panel ή row μέσα στο υπάρχον — Revit-style)
Νέα command keys στο `HATCH_RIBBON_KEYS` (`hatch-command-keys.ts`) + sets + type guards (mirror των υπαρχόντων):
- `stringParams.gradientType` → combobox 7 options (LINEAR…CURVED, i18n labels).
- `stringParams.gradientColor1` + `gradientColor2` → **reuse `FILL_COLOR_OPTIONS`** (preset hex combobox· ΜΗΝ φτιάξεις νέο color picker — δες §3 decision).
- `params.gradientAngle` → numeric combobox (reuse `LINE_ANGLE_OPTIONS` pattern, editable 0-360).
- `toggles.gradientSingleColor` → toggle (single-color → κρύψε/αγνόησε color2, use tint).
- (προαιρετικό) `params.gradientTint` numeric 0..1 — μόνο αν single-color.

### 2.3 Draw-defaults gradient fields (`hatch-draw-defaults-store.ts`)
`HatchDrawDefaults` += `gradientType`, `gradientColor1`, `gradientColor2`, `gradientSingleColor`, `gradientAngle` (+ defaults: `'linear'`, `'#2980b9'`, `'#ffffff'`, `false`, `0`). **SSoT** — η επόμενη hatch τα διαβάζει.

### 2.4 Bridge read/write (`useRibbonHatchBridge`)
- `getComboboxState` / `onComboboxChange` / `getToggleState` / `onToggle`: για κάθε νέο key → entity (`patchHatch` με `gradient:{...}` πλήρες object) **Ή** draw-defaults (no selection). ⚠️ Το `gradient` είναι **nested object** — όταν αλλάζει 1 πεδίο, χτίσε ΟΛΟ το `gradient` από (hatch.gradient ?? defaults) + patch (immutable merge), όχι partial.
- Helper SSoT πρόταση: μικρή pure `buildGradientFromDefaults(defaults)` + `withGradientPatch(current, field, value)` σε leaf (π.χ. μέσα στο `hatch-gradient.ts` ή νέο `hatch-gradient-ui.ts`) ώστε bridge + entity-creation να μοιράζονται το ΙΔΙΟ build (μηδέν διπλό object-assembly).

### 2.5 Entity creation reads gradient defaults
Στο σημείο που το `createEntityFromTool` (`case 'hatch'`) διαβάζει `getHatchDrawDefaults()` (βρες το με §0.Δ grep): όταν `fillType==='gradient'` → set `entity.gradient = buildGradientFromDefaults(defaults)` (ΙΔΙΟ SSoT build με §2.4). Αλλιώς το gradient hatch δημιουργείται χωρίς gradient data → invisible/solid fallback.

### 2.6 Tests
- bridge: fillType→gradient set· gradientType/color/angle/single-color → entity patch ΚΑΙ draw-defaults.
- build helper: `buildGradientFromDefaults` + immutable `withGradientPatch`.
- (αν προστεθεί) draw-defaults gradient round-trip με entity-creation.

---

## 3. ❓ ΑΠΟΦΑΣΗ ΓΙΑ GIORGIO/ΕΠΟΜΕΝΟ AGENT (color picker)
Τα 2 gradient χρώματα: **(A) reuse `FILL_COLOR_OPTIONS`** (8 preset hex comboboxes, SSoT, ταιριάζει με το υπάρχον fillColor — γρήγορο, μηδέν νέο component) **Ή (B) full color picker** (richer, νέο component/dependency — έλεγξε license N.5). **Σύσταση: (A) για v1** (Revit-grade αρκετά, μηδέν διπλότυπο)· (B) ως DEFER. Ρώτα Giorgio αν θέλει (B).

---

## 4. SSoT προς REUSE (μην ξαναγράψεις)
- **Gradient model/stops:** `bim/hatch/hatch-gradient.ts` (Φ5) — `HatchGradient`, `resolveGradientStops`, `normalizeGradientType`.
- **Ribbon combobox/toggle patterns:** `contextual-hatch-tab.ts` + `HatchPatternPicker.tsx` (Φ2 searchable popover· δες αν χρειάζεται variant για gradient type — μάλλον απλό combobox αρκεί).
- **Command-key registry + guards:** `hatch-command-keys.ts` (πρόσθεσε keys + sets + type guards — μην παρακάμψεις τα guards).
- **Bridge dual-mode (entity OR draw-defaults):** `useRibbonHatchBridge.ts` — `patchHatch` (UpdateEntityCommand, undoable) / `setHatchDrawDefaults`.
- **Draw-defaults store:** `hatch-draw-defaults-store.ts`.
- **Preset colors:** `FILL_COLOR_OPTIONS` (contextual-hatch-tab) — reuse για gradient χρώματα.

## 5. ΚΑΝΟΝΕΣ
- **N.8 mode:** ~6-8 αρχεία (tab + command-keys + bridge + draw-defaults + entity-creation + gradient-ui leaf + i18n + tests) / 1 domain (hatch UI). Πιθανότατα **Plan Mode**. Πρότεινε mode + **N.14 μοντέλο** (μάλλον **Sonnet** — UI wiring, καθαρό pattern· Opus αν θες αυστηρό review) ΠΡΙΝ υλοποιήσεις, περίμενε «ok».
- **N.11 i18n:** ΚΑΘΕ νέο label → key σε `el` + `en` (`dxf-viewer-shell`) ΠΡΙΝ τη χρήση. ΟΧΙ hardcoded ελληνικά/αγγλικά.
- **N.17 ΕΝΑ tsc:** έλεγξε process ΠΡΙΝ (μοιραζόμενος υπολογιστής)· ΠΟΤΕ 2 παράλληλα.
- **COMMIT = Giorgio.** `git add` ΜΟΝΟ δικά σου.
- **N.15 docs ίδιο commit:** ADR-507 changelog (Φ5 UI) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY.
- **CHECK 6D:** το UI/ribbon **ΔΕΝ** είναι canvas → μάλλον ΟΧΙ 6D. ΑΛΛΑ αν αγγίξεις `HatchRenderer`/entity-creation canvas path → stage ADR-040. Έλεγξε τι σου ζητά το pre-commit.

## 6. ΕΚΤΟΣ SCOPE (ξεχωριστές συνεδρίες)
- Full color picker (αν Giorgio θέλει B στο §3).
- `461` shift visual apply στο render (Φ5 το parse+persist· δεν το ζωγραφίζει ακόμη).
- Gradient seed-point center (custom gradient origin).
- Φ8 Associative· Φ9 quantity/legend.

## 7. ΠΡΟΣΟΧΗ (shared tree, 2026-06-22)
Φ5 gradient (8 αρχεία + 3 tests) ίσως είναι ΗΔΗ committed από Giorgio (έλεγξε §0.Α `git log` — ψάξε `feat(dxf): hatch gradient` ή παρόμοιο). Αν ναι, ο gradient SSoT/IO/render είναι στο tree έτοιμα προς reuse. Άλλος agent δουλεύει παράλληλα → `git add` ΜΟΝΟ τα δικά σου UI αρχεία.
