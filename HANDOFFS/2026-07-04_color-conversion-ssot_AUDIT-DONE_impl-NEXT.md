# HANDOFF — Color-Conversion SSoT Consolidation (big-player-grade)

> **Ημερομηνία:** 2026-07-04
> **Κατάσταση:** AUDIT ΟΛΟΚΛΗΡΩΘΗΚΕ (3 Explore agents) · IMPLEMENTATION = ΕΠΟΜΕΝΗ SESSION
> **Subapp:** `src/subapps/dxf-viewer`
> **Σχετικό ολοκληρωμένο:** ADR-571 (κυανά/cyan SSoT — DONE, uncommitted)

---

## 0. START HERE — τι πρέπει να ξέρεις

Ο Giorgio ζητά **full enterprise + full SSoT, big-player-grade** (Revit / Maxon Cinema 4D / Figma):
**ΕΝΑ** κεντρικό color primitive module, **μηδέν διπλότυπα**. Αν οι μεγάλοι δεν προτείνουν κάτι →
ακολουθούμε την πρακτική τους (Figma = single color model· δεν σκορπίζουν converters).

**ΠΡΙΝ γράψεις ΟΤΙΔΗΠΟΤΕ:** κάνε **πραγματικό SSoT audit (grep)** για να επιβεβαιώσεις ότι οι canonical
SSoT (πίνακας §2) ισχύουν ακόμα, και **delegate** σε αυτούς — **ΜΗΝ** δημιουργήσεις νέο converter.

**⚠️ SHARED WORKING TREE:** δουλεύει **κι άλλος agent** ταυτόχρονα.
- **Commit = ΜΟΝΟ ο Giorgio.** Ο agent ΠΟΤΕ commit/push.
- `git add <specific files>` μόνο · verify `git diff --cached` · **ΠΟΤΕ** `git add -A` / `git restore .` / `reset --hard`.
- Μην αγγίξεις αρχεία εκτός task.
- **ADR numbering:** το ADR-572 ΗΔΗ πιάστηκε (`ADR-572-alignment-traces-ssot-audit.md`, άλλος agent) →
  ο επόμενος ελεύθερος είναι **ADR-573+** — **ξανα-glob** στην αρχή, μπορεί να έχει προχωρήσει.
- **Χωρίς tsc** (N.17) · **jest επιτρέπεται**.

---

## 1. Πλαίσιο / Το πρόβλημα

Κατά την κεντρικοποίηση των κυανών (ADR-571) βρέθηκε ότι η μετατροπή χρωμάτων είναι **διάσπαρτη σε ~15+
διπλότυπα** που έχουν **αποκλίνει** — με **πραγματικό bug**: δύο διαφορετικοί ACI πίνακες δίνουν
διαφορετικά χρώματα στο **ΙΔΙΟ export** (entities vs dimensions).

---

## 2. Canonical SSoT στόχοι (ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΗΣΕ — grep πρώτα)

| Domain | Canonical SSoT | Ρόλος |
|---|---|---|
| hex ↔ rgb/rgba, parse, mix, contrast, luminance, (HSL/HSV μετά το Phase B) | **`config/color-math.ts`** (ADR-509) | primitive color library |
| hex ↔ 24-bit int (`0xRRGGBB`) | **`utils/dxf-true-color.ts`** (`trueColorToHex` / `hexToTrueColor`) | int encoding |
| ACI index ↔ hex (nearest-match) | **`settings/standards/aci.ts`** (`ACI_PALETTE` 256 + `findClosestAci`) | ACI table + nearest |
| hex → rgba string | `config/color-math.ts` `hexToRgba` (ADR-571) | ήδη ενοποιημένο |

---

## 3. Ευρήματα audit — τι ενοποιείται

### Τα 4 families (εγκεκριμένα από Giorgio)
- **`parseHex` ×3:** `color-math:29` (`Rgb|null`, TESTED) · `aci-palette:66` (tuple, **6-digit only**, ΜΗΔΕΝ εξωτερικοί consumers) · `ui/color/utils:20` (`RGBColor`, **THROWS**, superset: 8-digit alpha).
- **`rgbToHex` ×3 (+1):** `color-math:55` · `aci-palette:74` (**BUG: λείπει `Math.round`**) · `ui/color/utils:127` (superset: alpha/uppercase/short) · **+ `ui/color/eyedropper.ts:285`** (κρυφό 4ο).
- **`parseColor` ×2:** `color-math:118` (`RgbaColor|null`) · `ui/color/utils:91` (`ParseResult`, superset: **+HSL/HSV**, never throws).
- **`hexToAci` ×2:** `aci-palette:83` (προσεγγιστικός ramp, **LIVE στο export** μέσω `export/core/dxf-ascii-writer.ts:43,157-164`) · `dxf-export.types:865` (**ΝΕΚΡΟΣ κώδικας**, μηδέν consumers). Canonical = `aci.ts findClosestAci`.

### +11 ακόμα (sweep)
- **int→hex clones του `trueColorToHex`:** `export/core/dxf-ascii-writer.ts:435` · `bim-3d/converters/dxf-text-3d.ts:51` · `services/las-parser.ts:262` · `systems/properties/resolve-entity-style.ts:76` · `bim/materials/material-catalog-defs.ts:162` · `text-engine/parser/mtext-tokenizer.ts:176` vs `text-engine/types/text-toolbar.types.ts:45`.
- **parseHex/rgbToHex clones:** `bim/structural/detail-sheet/render/detail-pdf-renderer.ts:43` · `bim/hatch/hatch-gradient.ts:83` · `ui/ribbon/components/OpeningTagStyleColorWidget.tsx:29` + `ui/components/bim-openings/OpeningTagStyleDialog.tsx:216` (πανομοιότυπα) · 4× Ruler settings rgba-regex (`RulerUnits/MinorLines/MajorLines/BackgroundSettings.tsx`).
- **`config/color-config.ts:345` `getContrastColor`:** το σχόλιο του `color-math` **ΨΕΥΔΩΣ** λέει ότι μεταφέρθηκε — είναι ακόμα η παλιά naive `.includes('fff')` έκδοση. + **`withOpacity:324`** (~12 call sites).

### Άσε ήσυχα (domain logic, ΟΧΙ generic converters)
`utilization-color`, `clash-severity-color`, `heat-load-color`, `bim-entity-color`, `color-mapping`,
`modal-colors`, `dxf-color-to-css` (intentional minimal preview), `SelectionOutlinePass srgbVec` (shader-specific).

---

## 4. Ρίσκο (καθορίζει τη σειρά)

1. 🎨 **Color-picker** (`ui/color/*`): superset (alpha/HSL/HSV) + **THROWS** + **ΜΗΔΕΝ tests** → characterization tests ΠΡΩΤΑ. Consumers που βασίζονται στο throw (try/catch): `settings/standards/aci.ts:173`, `rendering/ui/grid/LegacyGridAdapter.ts:90,109`.
2. 💾 **Export ACI**: αλλάζει χρώματα σε **αποθηκευμένα αρχεία** (μη-βασικά χρώματα). Διορθώνει το entity-vs-dimstyle bug. Χρειάζεται characterization tests + ρητή έγκριση.

---

## 5. Υλοποίηση — φάσεις κατά ρίσκο

**Phase 0 — Characterization tests (safety net ΠΡΩΤΑ).** Κλείδωσε την ΤΩΡΙΝΗ συμπεριφορά: `ui/color/utils`
(throw / 8-digit / rgbToHex options / parseColor+HSL), `aci-palette.hexToAci` (ramp outputs σε spread hexes),
export DXF ACI για μη-βασικά χρώματα, `withOpacity`. (Μόνο το `color-math` έχει ήδη tests:
`config/__tests__/adaptive-entity-color.test.ts`.)

**Phase A — Zero-risk fold-ins (μηχανικά, value-preserving).**
- Διάγραψε νεκρό `dxf-export.types.ts` ACI (ή re-export από `aci.ts`).
- Όλα τα int→hex clones → `dxf-true-color.trueColorToHex`.
- parseHex/rgbToHex clones (detail-pdf, hatch-gradient, eyedropper, openings ×2) → `color-math`.
- Διόρθωσε `getContrastColor` → `contrastRatio`/`srgbRelativeLuminance` · `withOpacity` → compose από `color-math` (output-compatible shim· πρόσεχε τα ~12 call sites).

**Phase B — Τα 4 families (core unification).**
- **Extend `color-math`** να απορροφήσει 8-digit alpha hex + HSL/HSV (τα picker features ζουν στον SSoT — big-player single-module).
- `ui/color/utils` parseHex/rgbToHex/parseColor → thin adapters πάνω στον core (**κράτα** throw-contract + `RGBColor`/`ParseResult` shapes). 4× Ruler rgba-regex → `parseColor`.
- `aci-palette` parseHex/rgbToHex → delegate στο `color-math` (διορθώνει missing-Math.round + προσθέτει 3-digit) · `aciToRgb` → από `ACI_PALETTE`.

**Phase C — ACI export unification (behavior-affecting, guarded).**
- `aci-palette.hexToAci` (export) → `findClosestAci` (real `ACI_PALETTE`). Διορθώνει το entity-vs-dimstyle inconsistency. Characterization tests δείχνουν τα deltas (μόνο μη-βασικά χρώματα) → **έγκριση Giorgio πριν κλειδώσει.**

**Phase D — ADR + docs.** Νέο **ADR-573+** (ξανα-glob· 572 πιάστηκε) «Color-Conversion SSoT (big-player single color module)» + `adr-index.md`. Προαιρετικά: SSoT-registry module που απαγορεύει νέους inline converters.

---

## 6. Verification (ΧΩΡΙΣ tsc — N.17)
- Phase 0 characterization + `adaptive-entity-color.test.ts`.
- Μετά από κάθε φάση: `npx jest` στα color-touched suites (πρέπει πράσινα).
- Οπτικός (/run): color picker · hatch gradients · opening tags · PDF detail sheet · DXF export round-trip.
- **Grep proof:** μηδέν local color-converter εκτός των 3 canonical SSoT (§2).

---

## 7. Πηγές / πλήρες context
- Plan file (ίδιο περιεχόμενο): `C:\Users\user\.claude\plans\sharded-crunching-wirth.md`
- ADR-571 (cyan, DONE-uncommitted) — το προηγούμενο βήμα που ξεκίνησε αυτό το audit.
