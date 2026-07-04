# ADR-573 — Color-Conversion SSoT (big-player single color module)

> **Status:** ✅ 🟢 IMPLEMENTED (UNCOMMITTED) — 2026-07-04 (βλ. §8 changelog)
> **Date:** 2026-07-04
> **Subapp:** `src/subapps/dxf-viewer` (https://nestorconstruct.gr/dxf/viewer)
> **Author:** Giorgio + agent
> **Related:** ADR-509 (color-math adaptive entity color), ADR-571 (cyan/construction color SSoT — το audit που ξεκίνησε αυτό),
> ADR-076 (centralized color conversion — παλαιό), ADR-344 (ACI palette picker), ADR-071 (clamp255),
> ADR-505 (rebar 3D DXF export), ADR-362 (DIMSTYLE), N.12 (SSoT ratchet), N.0.2 (Boy Scout)

---

## 1. Πλαίσιο / Problem Statement

Κατά την κεντρικοποίηση των κυανών (ADR-571) βρέθηκε ότι η **μετατροπή χρωμάτων** (hex ↔ rgb ↔ int ↔ ACI ↔ HSL/HSV)
ήταν **διάσπαρτη σε ~15+ διπλότυπα** που είχαν **αποκλίνει**. Ο Giorgio ζήτησε **full enterprise + full SSoT,
big-player-grade** (Revit / Maxon Cinema 4D / Figma): **ΕΝΑ** κεντρικό color primitive module, **μηδέν διπλότυπα**.
Αν οι μεγάλοι δεν προτείνουν κάτι → ακολουθούμε την πρακτική τους (single color model· δεν σκορπίζουν converters).

### 1.1 Το πραγματικό bug (entity-vs-dimstyle ACI)

Το export path είχε **δύο διαφορετικούς ACI mappers στο ΙΔΙΟ αρχείο**:
- **entities** → `dxf-ascii-writer.ts` καλούσε `hexToAci` (προσεγγιστικός **ramp** 10-hue × 24-chroma, `aci-palette.ts`)
- **dimstyles** → `dxf-dimstyle-writer.ts` καλούσε `findClosestAci` (πραγματικό `ACI_PALETTE`, `settings/standards/aci.ts`)

Ο ramp ήταν **grossly wrong**: π.χ. `#00994c` (πράσινο) → ACI 170 = `#0000FF` (μπλε!)· `#cc6600` (πορτοκαλί)
→ ACI 39 = `#4C3926` (καφέ). Άρα το ίδιο χρώμα έβγαινε διαφορετικό ACI ανάλογα με το αν ήταν entity ή dimstyle.

---

## 2. Canonical SSoT (μία πηγή ανά domain — ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΗΣΗ, όχι νέο)

| Domain | Canonical SSoT | Ρόλος |
|---|---|---|
| hex ↔ rgb/rgba, 8-digit alpha, HSL/HSV, parse, mix, contrast, luminance, channelToHex | **`config/color-math.ts`** | primitive color library |
| hex ↔ 24-bit int (`0xRRGGBB`) | **`utils/dxf-true-color.ts`** (`trueColorToHex` / `hexToTrueColor`) | int encoding |
| ACI index ↔ hex + nearest-match | **`settings/standards/aci.ts`** (`ACI_PALETTE` 256 + `findClosestAci` + `getAciColor`) | ACI table (single) |

**Αρχή big-player:** index→color (`getAciColor`/`aciToRgb`) και color→nearest-index (`findClosestAci`) παράγονται
από τον **ΙΔΙΟ** πίνακα → hex→index→hex round-trips συνεπή (όπως AutoCAD/Revit — ένας canonical ACI πίνακας).

---

## 3. Απόφαση / Τι έγινε (φάσεις κατά ρίσκο)

### Phase 0 — Characterization tests (safety net ΠΡΩΤΑ)
Κλείδωσαν την τωρινή συμπεριφορά πριν κάθε αλλαγή:
- `ui/color/__tests__/color-utils-characterization.test.ts` (throw-contract, 8-digit, rgbToHex options, parseColor+HSL/HSV)
- `ui/text-toolbar/controls/__tests__/aci-palette-characterization.test.ts`
- `export/core/__tests__/dxf-ascii-writer-aci-characterization.test.ts`
- `config/__tests__/with-opacity-characterization.test.ts`
- `config/__tests__/color-math-hsl-hsv.test.ts` (νέα color-math primitives)

### Phase A — Zero-risk fold-ins (value-preserving)
- Νεκρές `hexToAci`/`aciToHex` στο `types/dxf-export.types.ts` → **διαγράφηκαν** (το `ACI_COLORS` frozen export-contract mirror του ADR-571 έμεινε).
- **6 int→hex clones** → `trueColorToHex`: `dxf-ascii-writer.ts`, `bim-3d/converters/dxf-text-3d.ts`, `services/las-parser.ts`, `systems/properties/resolve-entity-style.ts`, `bim/materials/material-catalog-defs.ts`, `bim-3d/viewport/view-cube/view-cube-mesh.ts` (Boy Scout — βρέθηκε στο τελικό grep-proof).
- **parseHex/rgbToHex clones** → `color-math`: `detail-pdf-renderer.ts` (`hexToRgb`), `bim/hatch/hatch-gradient.ts` (`applyTint` = `mixHex(hex,'#ffffff',1-tint)`), `ui/color/eyedropper.ts` (`rgbToHex`).
- **openings ×2 πανομοιότυπα** normalizers → ΕΝΑ shared `toColorInputHex` (`ui/color/utils.ts`).
- `color-config.getContrastColor`: naive `.includes('fff')` → **σωστό WCAG** (`contrastRatio`)· `withOpacity` → `channelToHex` για το alpha byte.

### Phase B — Τα 4 families (core unification)
- **Extend `color-math`**: `parseHexAlpha` (3/6/8-digit alpha) + `Hsl`/`Hsv` types + `rgbToHsl`/`hslToRgb`/`rgbToHsv`/`hsvToRgb` (η math μεταφέρθηκε verbatim από `ui/color/utils`).
- **`ui/color/utils`** → **thin adapters** πάνω στο color-math, με διατήρηση του public contract: `parseHex` (throws· `RGBColor` shape), `rgbToHex` (FormatOptions: alpha/uppercase/short), `rgbToHsl`/`hslToRgb`/`rgbToHsv`/`hsvToRgb` (carry alpha), `parseColor` (`ParseResult`).
- **`aci-palette`** `parseHex`/`rgbToHex` → delegate color-math (διόρθωσε missing-`Math.round` + πρόσθεσε 3-digit).
- **3× Ruler settings** (Major/Minor/Background) rgba-regex → `parseColor`.

### Phase C — ACI export unification (behavior-affecting, εγκεκριμένο από Giorgio)
- **Αφαιρέθηκε ΟΛΟΚΛΗΡΟΣ ο προσεγγιστικός ramp** (`NAMED_ACI`, `RAMP_LEVELS`, `buildAciTable`) από το `aci-palette.ts`.
- `hexToAci` → `findClosestAci` (πραγματικό `ACI_PALETTE`)· `aciToRgb` → `getAciColor` + `parseHex` (ίδιος SSoT πίνακας).
- **Αποτέλεσμα:** το export βγάζει σωστά ACI· entity path == dimstyle path (μηδέν divergence)· ο text-toolbar ACI picker δείχνει τα πραγματικά AutoCAD χρώματα.

### Phase D — αυτό το ADR + `adr-index.md`.

---

## 4. Ρίσκο / Επίπτωση

| Περιοχή | Επίπτωση |
|---|---|
| Βασικά ACI χρώματα (1-9) + καθαρά γκρι | **ΑΜΕΤΑΒΛΗΤΑ** |
| Μη-βασικά/ενδιάμεσα ACI στο **export** | **Αλλάζουν → σωστά** (ήταν λάθος ramp). Επηρεάζει νέα εξαγόμενα αρχεία. |
| text-toolbar ACI picker swatches | Δείχνουν πλέον πραγματικά AutoCAD χρώματα (ήταν ramp approximation). |
| `getContrastColor` | Σωστό WCAG (είχε μηδέν runtime consumers). |
| Όλα τα υπόλοιπα (int→hex, parse/format, HSL/HSV) | **Value-preserving** (chars tests πράσινα). |

### Deltas (δείγμα, εγκεκριμένα)

| hex | ramp (πριν) | findClosestAci (μετά) |
|---|---|---|
| `#00994c` | ACI 170 = `#0000FF` ❌ | ACI 114 = `#00994C` ✅ |
| `#cc6600` | ACI 39 = `#4C3926` ❌ | ACI 32 = `#CC6600` ✅ |
| `#804020` | ACI 93 = `#66CC66` ❌ | ACI 17 = `#7F3F3F` ✅ |
| `#3366cc` | ACI 227 = `#7F3F6F` ❌ | ACI 152 = `#0066CC` ✅ |

---

## 5. Άσε ήσυχα (domain logic, ΟΧΙ generic converters)

`utilization-color`, `clash-severity-color`, `heat-load-color`, `bim-entity-color`, `color-mapping`, `modal-colors`,
`dxf-color-to-css` (intentional minimal preview), `SelectionOutlinePass srgbVec` (shader-specific), καθώς και τα
`mtext-tokenizer`/`text-toolbar.types` `parseTrueColorInt` (κάνουν int→`{r,g,b}` `DxfColor` union — **ΟΧΙ** hex string,
άρα ΔΕΝ είναι `trueColorToHex` clones). Το `ACI_COLORS` στο `dxf-export.types.ts` μένει ως frozen ezdxf export-contract mirror (ADR-571).

---

## 6. Εναλλακτικές που απορρίφθηκαν

- **Κράτημα ramp + ξεχωριστό ACI για picker/export**: απορρίφθηκε — δύο πίνακες = round-trip ασυνέπεια + το bug.
- **Νέο ενοποιημένο color module from scratch**: απορρίφθηκε — υπήρχαν ήδη 3 σωστοί SSoT· τους επεκτείναμε (N.12).

---

## 7. Verification

- `npx jest` σε όλα τα color-touched suites → **313 tests / 19 suites πράσινα** (χωρίς tsc, N.17).
- Grep-proof: μηδέν local color-converter εκτός των 3 canonical SSoT· μηδέν dangling ref στον διαγραμμένο ramp.
- Χαρακτηριστικά: το `useRibbonDimBridge`/`useRibbonLineToolBridge` (χρησιμοποιούν `findClosestAci`) παραμένουν πράσινα.

---

## 8. Changelog

- **2026-07-04** — Αρχική υλοποίηση (Phases 0→D). Consolidation ~15+ διάσπαρτων color converters σε 3 canonical SSoT·
  αφαίρεση προσεγγιστικού ACI ramp· διόρθωση entity-vs-dimstyle export bug· extend `color-math` (8-digit alpha + HSL/HSV)·
  `ui/color/utils` + `aci-palette` → thin adapters. IMPLEMENTED (UNCOMMITTED).
