# HANDOFF — ADR-456 Slice 2: UI Οπλισμού στο Property Panel Κολώνας

**Ημερομηνία:** 2026-06-14
**ADR:** ADR-456 — Στατικά: Ποσότητες Σκυροδέματος & Οπλισμός
**Status εισόδου:** Slice 1 (1A+1B) ✅ DONE + UNCOMMITTED (50 jest GREEN, tsc clean). Slice 2 = ΑΥΤΟ το handoff.
**Μοντέλο:** Opus (αρχιτεκτονικό + cross-cutting UI).

---

## 🚨 ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (διάβασε ΠΡΩΤΑ)

1. **Γλώσσα:** Απαντάς ΠΑΝΤΑ στα Ελληνικά στον Giorgio.
2. **Shared working tree:** Δουλεύει ΚΑΙ άλλος agent ταυτόχρονα. → `git add` **ΜΟΝΟ τα δικά σου αρχεία**, ΠΟΤΕ `git add -A`.
3. **COMMIT:** Τον κάνει **ο Giorgio**, ΟΧΙ εσύ. Μην κάνεις commit/push ποτέ (N.(-1)).
4. **ΕΝΑ tsc τη φορά (N.17):** Πριν τρέξεις `tsc --noEmit`, έλεγξε ότι δεν τρέχει άλλος (`Get-CimInstance Win32_Process … *tsc*`). Τρέξ' τον background.
5. **Enterprise + SSoT (ρητή εντολή Giorgio):** «Revit-grade, full enterprise + full SSoT». Δες §4 παρακάτω.

---

## 1. Τι έχτισε το Slice 1 (το θεμέλιο που καλεί το UI)

Νέο SSoT module **`src/subapps/dxf-viewer/bim/structural/`**:

| Αρχείο | Παρέχει (καλείται από το UI) |
|---|---|
| `concrete-grades.ts` | `CONCRETE_GRADE_ORDER` (dropdown options), `DEFAULT_CONCRETE_GRADE='C25/30'`, `concreteWeightKg(volumeM3)`, `CONCRETE_GRADES`, `isConcreteGrade` |
| `rebar-catalog.ts` | `REBAR_DIAMETERS_MM` [6..32] (Ø dropdown options), `barMassPerMeterKg`, `nextRebarDiameterMm` |
| `codes/index.ts` | `STRUCTURAL_CODE_ORDER` (dropdown κανονισμού), `DEFAULT_STRUCTURAL_CODE='eurocode'`, `resolveStructuralCode(id)` |
| `codes/structural-code-types.ts` | `StructuralCodeProvider` (`.suggestColumnReinforcement(ctx)`, `.columnReinforcementLimits(ctx,Ø)`), `StructuralCodeId`, `ColumnSectionContext` |
| `reinforcement/column-reinforcement-types.ts` | `ColumnReinforcement` {longitudinal{diameterMm,count}, stirrups{diameterMm,spacingMm,spacingCriticalMm?}, coverMm} |
| `reinforcement/column-reinforcement-compute.ts` | `computeColumnReinforcementQuantities(ctx,r)` → {longitudinalLengthM, weights, stirrupCount, totalSteelWeightKg, ratio}, `formatLongitudinalLabel(r)`→«4Ø16», `formatStirrupsLabel(r)`→«Ø8/100-200» |

**ColumnParams ΗΔΗ έχει** (column-types.ts ~L324-331): `concreteGrade?: ConcreteGrade` + `reinforcement?: ColumnReinforcement`. Zod schemas + validator (ρ_min/ρ_max) επίσης έτοιμα.

**🔑 SSoT MANDATE:** Το UI **ΔΕΝ γράφει καμία στατική λογική/μαθηματικά**. Καλεί ΑΠΟΚΛΕΙΣΤΙΚΑ τα παραπάνω. Ετικέτες «4Ø16»/βάρη/ρ% → από τους formatters/compute, ΟΧΙ inline.

---

## 2. ΠΟΥ ζει το column UI (από recognition)

**Το panel «Ιδιότητες Κολώνας» ΕΙΝΑΙ contextual ribbon tab, ΟΧΙ sidebar.**

| Σκοπός | Αρχείο | Γραμμές |
|---|---|---|
| Tab definition (όλα τα panels κολώνας) | `ui/ribbon/data/contextual-column-tab.ts` | 190-653 |
| **TEMPLATE = panel «Σοβάς» (ADR-449)** | ίδιο αρχείο | 459-515 |
| Command keys registry | `ui/ribbon/hooks/bridge/column-command-keys.ts` | 12-182 (`COLUMN_FINISH_KEYS` 163-182 = template) |
| **Bridge (read/write hub)** | `ui/ribbon/hooks/useRibbonColumnBridge.ts` | `dispatchParams` 155-173, `onComboboxChange`/`getComboboxState` 247-354 |
| Finish helper SSoT (template) | `ui/ribbon/hooks/bridge/finish-param.ts` | `resolveFinishComboboxState` 55-63, `applyFinishComboboxChange` 69-79 |
| **Mutation command** | `core/commands/entity-commands/UpdateColumnParamsCommand.ts` | constructor 37-43 (καλεί geometry+validate atomically) |
| Radix Select (ADR-001) | `@/components/ui/select` | usage: `ui/wall-advanced-panel/sections/WallDnaEditor.tsx` L28-34, 438-467 |
| i18n (panels+fields) | `src/i18n/locales/{el,en}/dxf-viewer-shell.json` | panels ~1091-1101, commands ~2643-2708 |

**Mutation pattern** (αντιγραφή για concreteGrade/reinforcement):
```ts
dispatchParams(column, { ...column.params, concreteGrade: newGrade });
dispatchParams(column, { ...column.params, reinforcement: nextReinforcement });
```
`dispatchParams` → `UpdateColumnParamsCommand(id, nextParams, prevParams, sceneManager)` → undo/redo + geometry recompute + validation αυτόματα. Emit `bim:column-params-updated`.

---

## 3. Slice 2 — Τι να υλοποιήσεις (Revit-grade)

Νέο ribbon panel **`column-structural`** (μετά το `column-material`) στο contextual-column-tab, ΜΟΝΟ για RC kinds (rectangular/shear-wall — όχι I-shape steel). Περιεχόμενο:

**Α. Comboboxes (mirror finish-skin pattern):**
- Κατηγορία σκυροδέματος → `CONCRETE_GRADE_ORDER`
- Κανονισμός → `STRUCTURAL_CODE_ORDER` (βλ. §4 — πού αποθηκεύεται)
- Διαμήκης Ø → `REBAR_DIAMETERS_MM`
- Διαμήκης πλήθος → presets [4,6,8,10,12]
- Συνδετήρες Ø → [6,8,10,12]
- Βήμα συνδετήρων (mm) → presets [100,150,200,250,300]
- Βήμα κρίσιμο (mm) → presets [50,75,100,125,150]
- Επικάλυψη cnom (mm) → presets [20,25,30,35,40]

**Β. Action «Auto οπλισμός»** (κουμπί, mirror άλλων ribbon actions): καλεί `resolveStructuralCode(codeId).suggestColumnReinforcement(ctx)` και κάνει `dispatchParams` με το αποτέλεσμα. ctx = {widthMm, depthMm, heightMm, grossAreaMm2 = geometry.area*1e6}.

**Γ. Live readouts (read-only badges):** βάρος σκυροδέματος (`concreteWeightKg`), βάρος χάλυβα + ρ% (`computeColumnReinforcementQuantities`). Δείξε τα από τους υπάρχοντες badge mechanisms του ribbon.

**Δ. SSoT helper:** Δημιούργησε `ui/ribbon/hooks/bridge/structural-param.ts` (mirror `finish-param.ts`) με `resolveStructuralComboboxState` + `applyStructuralComboboxChange` — ΟΧΙ inline στο bridge. + `COLUMN_STRUCTURAL_KEYS` + `isColumnStructuralKey` στο column-command-keys.ts.

---

## 4. 🏛️ ENTERPRISE / SSoT DECISION — Κανονισμός = project-level (Revit)

Στο Revit ο κανονισμός είναι **project-wide setting**, ΟΧΙ per-element. Αυτό είναι το «full enterprise + SSoT» κομμάτι που ζήτησε ο Giorgio. **Σχεδίασέ το σωστά:**

- **ΜΗΝ** βάλεις `codeId` σε κάθε κολώνα (anti-SSoT).
- Δημιούργησε **`StructuralSettings` SSoT** (project/level-scoped): `{ codeId: StructuralCodeId, defaultConcreteGrade, exposureClass? }`. Ψάξε αν υπάρχει ήδη project/level settings store (π.χ. `dxf-levels`/bimRenderSettings ή project settings) να το φιλοξενήσει· αλλιώς νέο μικρό store ακολουθώντας το υπάρχον settings pattern.
- Το column UI **διαβάζει** τον ενεργό `codeId` από εκεί· το dropdown κανονισμού στο column panel αλλάζει το **project setting** (όχι την κολώνα), και επηρεάζει auto-suggest + validation παντού.
- Ενημέρωσε το validator call site να περνά τον ενεργό `codeId` (το `validateColumnParams(params, codeId)` ΗΔΗ δέχεται 2ο param).

Αν αυτό φουσκώσει το slice → σπάσε σε **Slice 2a (column reinforcement UI με codeId=default eurocode)** + **Slice 2b (StructuralSettings SSoT + project dropdown)**. Πες το στον Giorgio με plan πριν ξεκινήσεις (N.0.1).

---

## 5. Verify (browser)

`/dxf/viewer` → επίλεξε ορθογωνική κολώνα → στο contextual tab «Ιδιότητες Κολώνας» πρέπει να εμφανίζεται νέο panel «Στατικά/Οπλισμός»:
- Άλλαξε κατηγορία σκυροδέματος → βάρος σκυρ. ενημερώνεται.
- Πάτα «Auto οπλισμός» → γεμίζουν Ø/πλήθος/συνδετήρες με έγκυρο (ρ≥1%).
- Άνοιξε Ανάλυση→Πίνακας BIM→Υποστυλώματα → οι 3 στήλες οπλισμού πλέον ΓΕΜΑΤΕΣ.

## 6. DEFER (όχι σε αυτό το slice)
2Δ/3Δ εμφάνιση ράβδων/συνδετήρων στη διατομή (Slice 3)· στατικός υπολογισμός φορτίων (Slice 3+)· επέκταση σε δοκούς/πέδιλα.

---

## 7. git add (ΜΟΝΟ δικά σου — shared tree)
Όσα δημιουργήσεις/τροποποιήσεις στο Slice 2 (column-structural panel, structural-param.ts, column-command-keys.ts, useRibbonColumnBridge.ts, locales, ADR-456 changelog, τυχόν StructuralSettings). **adr-index.md ΟΧΙ** αν shared-tree conflict. Ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY.md (N.15).
