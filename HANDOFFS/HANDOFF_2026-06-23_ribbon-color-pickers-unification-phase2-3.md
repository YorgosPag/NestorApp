# HANDOFF — Ενοποίηση color pickers στο ribbon (Φάσεις 2 & 3)

**Ημερομηνία:** 2026-06-23
**Κατάσταση:** Φάση 1 ✅ DONE (uncommitted) · Φάσεις 2-3 ⏳ ΠΡΟΣ ΥΛΟΠΟΙΗΣΗ
**ADR:** ADR-344 (ColorPickerPopover / text color) + ADR-345 (ribbon color controls)
**Working tree:** ⚠️ ΜΟΙΡΑΖΕΤΑΙ ΜΕ ΑΛΛΟΝ AGENT — μην αγγίξεις άσχετα αρχεία, ΠΟΤΕ `git add -A`, ΠΟΤΕ commit/push (ο Giorgio committαρει).

---

## 🎯 ΣΤΟΧΟΣ (εντολή Giorgio)

Στα **contextual ribbon tabs**, όλα τα σημεία επιλογής χρώματος να χρησιμοποιούν **ΕΝΑ** picker — το πλούσιο **`EnterpriseColorPicker`** (HSL sliders + HEX/RGB/HSL + παλέτες Χρώματα DXF/Σημασιολογικά/Material + Πρόσφατα + WCAG). Όχι drop-downs με λίγα χρώματα, όχι φτωχό react-colorful.

Απαίτηση: **FULL ENTERPRISE + FULL SSoT, σαν Revit.** ΠΡΙΝ από κάθε νέο κώδικα → **πραγματικό SSoT audit (grep)** για reuse, μηδέν διπλότυπα. Ο Giorgio κάνει σκληρό SSoT audit μετά (ναι/όχι ερωτήσεις: «κεντρικοποιημένο; διπλότυπο; θα το έκανε έτσι η Google;»).

---

## 🧩 ΑΡΧΙΤΕΚΤΟΝΙΚΗ — τα 2 picker engines (ΚΡΙΣΙΜΟ)

Υπάρχουν **ΔΥΟ** color pickers στην εφαρμογή:

1. **`EnterpriseColorPicker`** — `src/subapps/dxf-viewer/ui/color/EnterpriseColorPicker.tsx`
   - Το «Enterprise» engine (screenshot Giorgio = το πλούσιο). Props: `value: string` (hex), `onChange: (hex)=>void`, `alpha`, `modes`, `palettes`, `recent`, `eyedropper`, `orientation`, `className`, `showContrast`.
   - Wrapper σε dialog: `ColorDialogTrigger` (ίδιο αρχείο φάκελος `EnterpriseColorDialog.tsx`). Hex-only — **ΔΕΝ** έχει ACI/ByLayer.

2. **`ColorPickerPopover`** — `src/subapps/dxf-viewer/ui/text-toolbar/controls/ColorPickerPopover.tsx`
   - Το **CAD-aware** picker. 3 tabs: «Αληθινό χρώμα» (true-color) / «Ευρετήριο» (ACI 256) / «Κληρονομημένο» (ByLayer/ByBlock). Props: `value: MixedValue<DxfColor>`, `onChange: (DxfColor)=>void`, `trueColorSupported`, `disabled`.
   - **ΑΠΟΦΑΣΗ GIORGIO:** αυτό είναι το framework που θέλουμε για CAD οντότητες, ΚΑΙ μέσα στο «Αληθινό χρώμα» tab μπαίνει το `EnterpriseColorPicker` (έγινε στη Φάση 1).

**Άρα το «ένα picker» = `ColorPickerPopover` με `EnterpriseColorPicker` στο true-color tab.** Ό,τι χρειάζεται CAD semantics (ACI/ByLayer) → `ColorPickerPopover`. Ό,τι είναι pure hex → είτε αυτό (με κρυμμένο inherited tab) είτε `ColorDialogTrigger`.

---

## 🎨 DxfColor + conversions (SSoT — ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΑ, ΜΗΝ ΞΑΝΑΓΡΑΨΕΙΣ)

**Type:** `DxfColor` από `src/subapps/dxf-viewer/text-engine/types`
```
{ kind:'TrueColor', r,g,b } | { kind:'ACI', index } | { kind:'ByLayer' } | { kind:'ByBlock' }
```
`MixedValue<DxfColor>` = `DxfColor | null` (null = mixed).
Σταθερές: `DXF_COLOR_BY_LAYER`, `DXF_COLOR_BY_BLOCK` (ίδιο module).

**ΟΛΑ τα conversions ζουν στο `src/subapps/dxf-viewer/ui/text-toolbar/controls/aci-palette.ts`:**
- `parseHex(hex) → [r,g,b] | null`
- `rgbToHex(r,g,b) → '#rrggbb'`
- `aciToRgb(index) → [r,g,b] | undefined`
- `hexToAci(hex) → number` (nearest ACI)
- `dxfColorToHex(DxfColor) → hex`
- **`hexToDxfTrueColor(hex) → DxfColor`** ← ΝΕΟ (Φάση 1). Inverse του dxfColorToHex για true-color.

⚠️ **ΠΡΟΣΟΧΗ name collision:** υπάρχει ΑΛΛΟ `hexToTrueColor` στο `utils/dxf-true-color.ts` που επιστρέφει `number` (packed RGB για DXF export 420/421) — ΑΣΧΕΤΟ, διαφορετική σημασιολογία. Μην τα μπερδέψεις.

---

## ✅ ΦΑΣΗ 1 — ΤΙ ΕΓΙΝΕ (uncommitted)

**Αρχείο `ui/text-toolbar/controls/ColorPickerPopover.tsx`:**
- Στο tab «Αληθινό χρώμα»: `react-colorful` `HexColorPicker` → **`EnterpriseColorPicker`** (`alpha={false}`, `modes=['hex','rgb','hsl']`, `palettes=['dxf','semantic','material']`, `recent`, `eyedropper={false}` — γιατί το nav έχει ήδη eyedropper, αποφυγή διπλού, `orientation="vertical"`, `className="w-[320px]"`).
- `PopoverContent` width: `w-72` → `w-auto` (το enterprise picker θέλει χώρο).
- Boy-scout: dedup του inline hex→TrueColor (eyedropper + tab) → ΕΝΑ helper.

**Αρχείο `ui/text-toolbar/controls/aci-palette.ts`:**
- ΝΕΟ `hexToDxfTrueColor(hex): DxfColor` δίπλα στο αντίστροφό του `dxfColorToHex` (SSoT location). Reuse `parseHex`.

**Επηρεάζει αυτόματα:** text editor + dimension (χρησιμοποιούν `ColorPickerPopover`).
**tsc:** ✅ clean (NO_ERRORS_IN_TOUCHED_FILES).
**🔴 ΕΚΚΡΕΜΕΙ Φάσης 1:** browser-verify (text/dimension → tab «Αληθινό χρώμα» → πλούσιο picker) + ADR-344 changelog entry (ΔΕΝ έγινε ακόμα).

---

## ⏳ ΦΑΣΗ 2 — Hatch «Χρώμα Γεμίσματος» (ΕΠΟΜΕΝΟ)

**Drop-down προς αντικατάσταση:**
- Data: `ui/ribbon/data/contextual-hatch-tab.ts` — `FILL_COLOR_OPTIONS` (~γρ.104-113, 8 hex) + command `hatch.fillColor` (~γρ.195-206, `type:'combobox'`, `options: FILL_COLOR_OPTIONS`).
- Bridge: `ui/ribbon/hooks/useRibbonHatchBridge.ts` — `getComboboxState` (~γρ.181: `hatch?.fillColor ?? defaults.fillColor`) + `onComboboxChange` (~γρ.249: `patchHatch(hatch,{fillColor:value})` / `setHatchDrawDefaults({fillColor:value})`). **Τιμή = hex string** (`#rrggbb`).

**Σχέδιο (full SSoT):**
1. Νέο ribbon widget (π.χ. `RibbonHatchFillColorWidget` ή ΓΕΝΙΚΟ `RibbonDxfColorPickerWidget`) — mirror του `HatchGradientColorPicker.tsx` pattern (διαβάζει/γράφει μέσω `useRibbonCommand().getComboboxState/onComboboxChange(command.commandKey)`).
2. Χρησιμοποιεί `ColorPickerPopover`. Conversion: hex ↔ DxfColor μέσω **`hexToDxfTrueColor`** (in) + **`dxfColorToHex`** (out, στο onChange).
3. ⚠️ Το hatch fillColor model = **καθαρό hex, ΧΩΡΙΣ ByLayer/ByBlock**. Το `ColorPickerPopover` δείχνει πάντα το «Κληρονομημένο» tab → **χρειάζεται νέο prop** `inheritedSupported?: boolean` (default `true`) στο `ColorPickerPopover`· για hatch → `false` (κρύβει το inherited tab). Boy-scout extension στο ίδιο SSoT component.
4. `contextual-hatch-tab.ts`: `hatch.fillColor` → `type:'widget'` + `widgetId` (αφαίρεση `options`). **ΠΡΟΣΟΧΗ:** στο ίδιο tab το **gradient color** χρησιμοποιεί `comboboxVariant:'hatch-gradient-color'` → `HatchGradientColorPicker` (ColorDialogTrigger). Σκέψου συνέπεια (ίσως και αυτά να γίνουν ίδιο widget — ρώτα/πρότεινε).
5. Mount: `ui/ribbon/components/RibbonPanel.tsx` (widgetId dispatcher — βλ. πώς γίνεται mount το `mep-circuit-color`).
6. types: `ui/ribbon/types/ribbon-types.ts` (νέο widgetId ή comboboxVariant).

**ΠΡΟΤΥΠΑ ΓΙΑ REUSE (grep & μελέτησε ΠΡΙΝ γράψεις):**
- `ui/ribbon/components/RibbonMepCircuitColorWidget.tsx` (standalone leaf, store-driven, ColorDialogTrigger)
- `ui/ribbon/components/OpeningTagStyleColorWidget.tsx`
- `ui/ribbon/components/buttons/HatchGradientColorPicker.tsx` (bridge-driven, getComboboxState/onComboboxChange)
- `ui/ribbon/components/RibbonColorSwatchWidget.tsx` (χρησιμοποιεί ΗΔΗ ColorPickerPopover για text)

---

## ⏳ ΦΑΣΗ 3 — Line «Χρώμα Γραμμής» (ΜΕΤΑ τη Φάση 2)

**Drop-down προς αντικατάσταση:**
- Data: `ui/ribbon/data/contextual-line-tool-tab.ts` — `COLOR_OPTIONS` (~γρ.45-54: `ByLayer` + 7 ACI) + command `lineToolStyle.color` (~γρ.119-127).
- Bridge: `ui/ribbon/hooks/useRibbonLineToolBridge.ts` — `getComboboxState` (~γρ.228-233: γυρίζει `'ByLayer'` ή ACI number string) + `onComboboxChange` (~γρ.279-300: `'ByLayer'` → `{colorMode:'ByLayer', colorAci:undefined, color:undefined, colorTrueColor:null}` · ACI → `{colorMode:'Concrete', colorAci:aci, colorTrueColor:null}` · μέσω `patchEntity(selected, ...)` ή `setQuickStyleColor(mode, aci, trueColor)`).

**ΚΡΙΣΙΜΟ εύρημα:** το line model **ΗΔΗ υποστηρίζει `colorTrueColor`** (true-color hex) — βλ. `setQuickStyleColor(mode, aci, trueColor)` 3η param + `colorTrueColor` field. ΑΛΛΑ το generic ribbon combobox string-protocol μεταφέρει μόνο `'ByLayer'`/ACI — **όχι** trueColor hex. Άρα:
- Το `lineToolStyle.color` widget **ΔΕΝ** μπορεί να περάσει από το string getComboboxState/onComboboxChange για trueColor.
- **Προτεινόμενη προσέγγιση:** standalone leaf widget (mirror `RibbonMepCircuitColorWidget`) που διαβάζει/γράφει **απευθείας** `QuickStyleStore` (`src/subapps/dxf-viewer/stores/QuickStyleStore.ts`) + selected entity, με ΠΛΗΡΕΣ `DxfColor` (TrueColor/ACI/ByLayer/ByBlock).
- Conversion: line color state (`colorMode`/`colorAci`/`colorTrueColor`) ↔ `DxfColor`. **GREP πρώτα** για υπάρχον helper (`resolve-entity-style.ts`, `QuickStyleStore`, `setQuickStyleColor`) — μην ξαναγράψεις.
- Το `ColorPickerPopover` εδώ με ΟΛΑ τα tabs (`inheritedSupported=true`, ByLayer/ByBlock χρήσιμα για line).

**Reuse:** `setQuickStyleColor`, `patchEntity`, `aciToRgb`/`hexToAci`/`dxfColorToHex`/`hexToDxfTrueColor` (aci-palette), `QuickStyleStore`.

---

## 🔍 SSoT AUDIT — GREP ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ (υποχρεωτικό)

Τρέξε & μελέτησε:
- `grep -r "ColorPickerPopover"` → ποιοι το χρησιμοποιούν, πώς (value/onChange σχήμα).
- `grep -r "ColorDialogTrigger"` → όλα τα ribbon color widgets (patterns).
- `grep -rE "hexToDxfTrueColor|dxfColorToHex|hexToAci|aciToRgb"` → conversions SSoT (aci-palette).
- `grep -r "setQuickStyleColor"` + `QuickStyleStore` → πώς γράφεται line color.
- `grep -r "colorTrueColor|colorMode|colorAci"` → line/entity color model.
- `grep -r "widgetId"` στο `RibbonPanel.tsx` → πώς γίνεται mount νέο widget.
- `grep -r "inheritedSupported"` → αν προστέθηκε ήδη το prop.

**Στόχος:** reuse `EnterpriseColorPicker` (engine) + `ColorPickerPopover` (CAD framework) + `aci-palette` (conversions) + `QuickStyleStore`/bridges. **ΜΗΔΕΝ νέο color logic, ΜΗΔΕΝ νέο picker, ΜΗΔΕΝ νέο conversion.**

---

## 📐 ΚΑΝΟΝΕΣ / CONSTRAINTS

- **FULL ENTERPRISE + FULL SSoT (Revit-grade).** Reuse > create.
- **ΜΗΝ commit/push** — ο Giorgio το κάνει. Shared working tree με άλλον agent → **μόνο τα δικά σου αρχεία**, ΠΟΤΕ `git add -A`, ΠΟΤΕ git operations.
- **N.17:** ΕΝΑ tsc τη φορά — έλεγξε running tsc (`Get-CimInstance Win32_Process ... '*tsc*'`) ΠΡΙΝ τρέξεις. tsc background, μη-blocking.
- **N.11 i18n:** καμία hardcoded Greek/English string — keys σε `src/i18n/locales/{el,en}/*.json` (το `ColorPickerPopover` χρησιμοποιεί namespace `textToolbar`· τα ribbon widgets `dxf-viewer-shell`).
- **N.2/N.3:** μηδέν `any`/`as any`/inline styles.
- **ADR:** ενημέρωσε ADR-344 (ColorPickerPopover) + ADR-345 (ribbon color controls) changelog (ΚΑΙ το pending Φάσης 1 ADR-344 entry).
- Μετά από κάθε φάση: tsc + δήλωση Google-level (N.7.2) + browser-verify από Giorgio.

---

## 📂 CRITICAL FILES (συγκεντρωτικά)

| Αρχείο | Ρόλος |
|---|---|
| `ui/color/EnterpriseColorPicker.tsx` | Engine (ΜΗΝ ξαναγράψεις) |
| `ui/text-toolbar/controls/ColorPickerPopover.tsx` | CAD picker framework (Φάση 1 done· πρόσθεσε `inheritedSupported`) |
| `ui/text-toolbar/controls/aci-palette.ts` | SSoT conversions (hex↔DxfColor↔ACI) |
| `text-engine/types` | `DxfColor`, `DXF_COLOR_BY_LAYER/BY_BLOCK` |
| `ui/ribbon/data/contextual-hatch-tab.ts` | Φάση 2 — hatch.fillColor drop-down |
| `ui/ribbon/hooks/useRibbonHatchBridge.ts` | Φάση 2 — hex get/set |
| `ui/ribbon/data/contextual-line-tool-tab.ts` | Φάση 3 — lineToolStyle.color drop-down |
| `ui/ribbon/hooks/useRibbonLineToolBridge.ts` | Φάση 3 — ByLayer/ACI get/set |
| `stores/QuickStyleStore.ts` | Φάση 3 — draw-default line color |
| `ui/ribbon/components/RibbonPanel.tsx` | widget mount dispatcher |
| `ui/ribbon/types/ribbon-types.ts` | widgetId / comboboxVariant |
| `ui/ribbon/components/{RibbonMepCircuitColorWidget,HatchGradientColorPicker,OpeningTagStyleColorWidget,RibbonColorSwatchWidget}.tsx` | πρότυπα reuse |

---

## ΠΑΡΑΤΗΡΗΣΗ (όχι μέρος του scope, για επίγνωση)
Τα ήδη-enterprise widgets (gradient, MEP circuit, opening tags) χρησιμοποιούν `ColorDialogTrigger` (= EnterpriseColorPicker σε dialog, hex-only, χωρίς ACI/ByLayer — δεν τα χρειάζονται). Αφέθηκαν ως έχουν. Αν ο Giorgio θελήσει ΑΠΟΛΥΤΗ συνέπεια (όλα = ColorPickerPopover), είναι επιπλέον φάση.
