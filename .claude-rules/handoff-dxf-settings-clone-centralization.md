# HANDOFF — Κεντρικοποίηση clones στα DXF settings panels

**Ημερομηνία:** 2026-07-20
**Αφορμή:** CHECK 3.28 (jscpd) έκοψε το commit `feat(dxf): slider units SSoT + mesh3d roundtrip + unit detection`

---

## 1. ΚΑΤΑΣΤΑΣΗ

Το slider-units commit έγινε με `SKIP_JSCPD_DIFF=1` (τεκμηριωμένο στο commit body).
Η κεντρικοποίηση των 47 clones **δεν έχει ξεκινήσει** — αυτό είναι το επόμενο βήμα.

**Δεύτερο μπλόκο που λύθηκε στην πορεία (μην το ψάξεις ξανά):** μετά το jscpd skip, το hook
κόλλησε σε **CHECK 4 (File sizes)** — `dxf-scene-builder.ts` στις **504** γραμμές. Λύθηκε με
εξαγωγή (ΟΧΙ trim) του ADR-462 canonical-mm pass σε NEW `utils/dxf-canonical-mm-scale.ts`
→ builder **472** γραμμές. 67/67 jest GREEN. Καταγράφηκε στο ADR-462 §5 ως Round 22.

---

## 2. ΓΙΑΤΙ ΕΓΙΝΕ SKIP (μην το ξανασυζητήσεις από την αρχή)

Το `jscpd --diff` σαρώνει **ολόκληρο το staged αρχείο**, όχι το diff. Επαληθεύτηκε με
`git diff --cached -U0`: **καμία** από τις flagged γραμμές δεν αγγίχτηκε από το commit — το diff
ήταν μόνο `+import SliderInput` και `+unit={SLIDER_VALUE_UNITS.*}` props.

Επιπλέον **2 από τους 51 clones είναι δομικά αδύνατο να εξαλειφθούν**:

| Clone | Περιεχόμενο |
|---|---|
| `RulerMajorLinesSettings:42-62 ↔ RulerMinorLinesSettings:41-61` (87T) | `'use client'` + 10 γραμμές imports |
| `RulerBackgroundSettings:14-36 ↔ RulerUnitsSettings:13-35` (59T) | imports + ASCII banner σχόλιο |

Δεν εξάγεις imports σε module. Το `ignorePattern` του jscpd είναι **path glob**, όχι content regex
(`node_modules/jscpd/README.md:116`) → δεν υπάρχει config-level λύση.

**⚠️ Συνέπεια: το CHECK 3.28 ΔΕΝ γίνεται πράσινο σε αυτά τα αρχεία ούτε μετά την κεντρικοποίηση.**
Κάθε μελλοντικό commit που αγγίζει `RulerMajor/Minor/Background/Units` θα χρειάζεται SKIP.
Η κεντρικοποίηση στοχεύει στο **Layer 2 CI ratchet** (`.jscpd-baseline.json`), όχι στο pre-commit hook.

---

## 3. ΕΠΟΜΕΝΟ ΒΗΜΑ — τι ακριβώς να φτιάξεις

**47 JSX clones σε 11 αρχεία**, όλα σε `src/subapps/dxf-viewer/ui/components/dxf-settings/settings/`.

### 3.1 Φτιάξε ΠΡΩΤΑ τα shared components (SSoT) σε `ui/components/shared/settings-rows/`

| Component | Τι καλύπτει | Clones που σβήνει |
|---|---|---|
| `ColorOpacityRow` | `ColorDialogTrigger` + `SliderInput` opacity μαζί | **7** (το μεγαλύτερο cross-file win, 105T έκαστος) |
| `SettingsCard` | card με `title` + `description` + children | ~8 |
| `SelectableOptionButton` | το recipe `selected ? bg.primary+getStatusBorder('info') : bg.muted+PRIMARY_HOVER+default` | ~9 |
| `ToggleRow` | label + description + `Switch` | ~4 |
| `PresetSwatchGrid` | grid COLS_5 με preset χρώματα | 2 (224T + 124T — LayersSettings) |
| `CrosshairPreviewButton` | τα quick-buttons 5%/8%/… με οριζόντια+κάθετη γραμμή | ~5 (CrosshairAppearance) |

### 3.2 Μετά rewiring, με αυτή τη σειρά (μεγαλύτερο κέρδος πρώτα)

1. `special/CrosshairBehaviorSettings.tsx` + `special/rulers/RulerBackgroundSettings.tsx` → `ColorOpacityRow` (σβήνει 7 μαζί)
2. `special/rulers/RulerMajorLinesSettings.tsx` + `RulerMinorLinesSettings.tsx` + `RulerUnitsSettings.tsx` + `RulerTextSettings.tsx` → `ToggleRow` + `ColorOpacityRow`
3. `special/LayersSettings.tsx` → `PresetSwatchGrid` + `SettingsCard` (224T + 124T)
4. `special/CrosshairAppearanceSettings.tsx` → `CrosshairPreviewButton` + `SelectableOptionButton`
5. `special/CursorSettings.tsx` → `SelectableOptionButton` + `SettingsCard` (8 self-clones)
6. `core/LineSettingsSections.tsx` → accordion section header + Select block (5 self-clones)
7. `special/GridSettings.tsx` (1), `palettes/CursorColorPalette.tsx` (1)

---

## 4. ΚΡΙΣΙΜΟ ΣΥΜΦΡΑΖΟΜΕΝΟ

- **ΣΕΙΡΙΑΚΑ, ΕΝΑΣ agent.** ΜΗΝ βάλεις παράλληλους subagents ανά αρχείο: τα 6 components
  χρησιμοποιούνται σταυρωτά και κάθε agent θα φτιάξει τη δική του εκδοχή του «card» →
  παράγεις **ακριβώς τους sibling clones** που πας να σβήσεις (N.18).
- Τρέξε `npm run jscpd:diff <staged files>` **κάθε 2-3 αρχεία**, όχι μόνο στο τέλος.
- Στο τέλος: `npm run jscpd:baseline` (κλείδωσε την πρόοδο) + ADR entry.
- **N.17: ΜΗΝ τρέξεις `tsc`.** Ο Giorgio κάνει τον έλεγχο.
- Πλήρης λίστα 51 clones: ξανατρέξε
  `npx jscpd <files> --config .jscpdrc.json --reporters json --absolute --output <dir>`
  (το wrapper `jscpd:diff` κόβει στους 15· χρειάζεται `--absolute` αλλιώς τα `name` βγαίνουν κενά).

---

## 5. ΜΗΝ ΚΑΝΕΙΣ

- ❌ Μην «διορθώσεις» το `.jscpdrc.json` κατεβάζοντας το `minTokens` ή προσθέτοντας ignores για να
  κρύψεις τους clones — είναι SSoT (N.18).
- ❌ Μην ακουμπήσεις τους 2 import/banner clones. Είναι αναπόφευκτοι, τεκμηριωμένοι εδώ.
- ❌ Μην κάνεις commit/push χωρίς ρητή εντολή (N.-1).
