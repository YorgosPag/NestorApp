# HANDOFF — ADR-479 Slice 2: UI Preset Selector (Structural Project Presets, Revit-grade)

**Ημ/νία:** 2026-06-18 · **Από:** Opus session (ADR-479 Slice 1 ολοκληρώθηκε) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Τύπος:** 🟢 PLAN-FIRST — νέο UI feature, ΔΕΝ έχει γραφτεί κώδικας UI ακόμη. Ξεκίνα με **plan mode + SSoT grep audit**.
**Shared working tree** με άλλον agent — **git add ΜΟΝΟ τα δικά σου, ΠΟΤΕ `git add -A`/`.`**.
**commit/push = Giorgio** (ΟΧΙ ο agent). **tsc = Giorgio** (N.17, ένα tsc τη φορά). **jest = τρέχει κανονικά.**
**Στόχος ποιότητας (Giorgio):** «Όπως οι μεγάλοι παίκτες (Revit). FULL ENTERPRISE + FULL SSoT.»

---

## 0. ΤΟ ΟΡΑΜΑ

Σαν **Revit Project Template (.rte)**: ο μηχανικός διαλέγει ένα preset και το κτίριο «γεννιέται» ήδη σωστό
(κανονισμός, υλικά, σεισμικά, έδαφος, occupancy) αντί να ορίζει το κάθε πεδίο. Το **backend είναι ΕΤΟΙΜΟ**
(Slice 1) — λείπει **μόνο το UI selector** που καλεί το ήδη υπάρχον store action.

---

## 1. ΤΙ ΠΑΡΕΔΩΣΕ ΤΟ SLICE 1 (DONE, UNCOMMITTED, 33 jest GREEN, tsc-clean)

**Backend preset system — ΟΛΑ έτοιμα:**
- `bim/structural/presets/structural-preset-defaults.ts` → **`buildStructuralSettingsForPreset(kind)`** (pure factory),
  `STRUCTURAL_PRESET_DEFINITIONS` (i18n labelKey/descriptionKey ανά preset), `STRUCTURAL_PRESET_ORDER`,
  `isStructuralPresetKind`. Presets: **`greek-rc-ec8`**, **`greek-rc-legacy`**, **`blank`**.
- `bim/structural/presets/reference-static-report.ts` → `THERMI_288_08` (machine SSoT πραγματικής μελέτης).
- `bim/structural/presets/structural-preset-types.ts` → `StructuralPresetKind`, `StructuralPresetDefinition`.
- `bim/structural/presets/index.ts` → barrel (import από εδώ).
- **Store action ΕΤΟΙΜΟ:** `state/structural-settings-store.ts` → **`applyStructuralPreset(kind)`**
  (resolve→set all building settings→debounced persist) + `setSeismicGroundType/AccelRatio`.

**➡️ Το UI χρειάζεται ΜΟΝΟ:** dropdown/combobox με τα `STRUCTURAL_PRESET_ORDER` → onChange καλεί
`useStructuralSettingsStore.getState().applyStructuralPreset(kind)`. Τίποτα άλλο στο backend.

---

## 2. 🚨 ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (GREP) — ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ (εντολή Giorgio)

Τρέξε ΚΑΙ διάβασε τα αποτελέσματα ΠΡΙΝ σχεδιάσεις — μην φτιάξεις διπλότυπο combobox/dropdown/locale pattern:

```bash
# (α) Πού καλούνται ΗΔΗ οι building-level setters από UI — ΜΙΜΗΣΟΥ ΑΥΤΟ ΤΟ PATTERN (bridge → store)
grep -rn "\.setCodeId(\|\.setOccupancy(\|\.setSoilBearingCapacityKpa(" src/subapps/dxf-viewer/ui --include=*.ts --include=*.tsx

# (β) Το ΥΠΑΡΧΟΝ combobox SSoT στο ribbon (ΜΗΝ φτιάξεις νέο dropdown)
cat src/subapps/dxf-viewer/ui/ribbon/components/buttons/RibbonCombobox.tsx | head -60
#   και το canonical Select (ADR-001) για non-ribbon:
sed -n '1,40p' src/components/ui/select.tsx

# (γ) Το ΥΠΑΡΧΟΝ structural bridge pattern (codeId combobox ↔ store) — το πιο κοντινό analog
sed -n '180,210p' src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/foundation-structural-bridge.ts

# (δ) Building modal (ADR-468) — πιθανός Revit-grade χώρος (per-building, «project template»)
grep -rn "structural\|Structural" src/subapps/dxf-viewer/ui/components/FloorManagementDialog.tsx

# (ε) Stair presets UI — analog για το πώς δείχνεις λίστα presets (ΚΑΙ για Slice 3 persisted)
sed -n '1,60p' src/subapps/dxf-viewer/ui/stair-advanced-panel/sections/StairPresetsSection.tsx

# (στ) Υπάρχει ΗΔΗ οποιοδήποτε "preset" UI στο structural; (να μην ξαναφτιάξεις)
grep -rin "preset" src/subapps/dxf-viewer/ui/ribbon src/subapps/dxf-viewer/ui/*structural* 2>/dev/null
```

**Αναμενόμενα ευρήματα (από το Slice 1 audit):**
- Οι building-level ρυθμίσεις (codeId/occupancy/soil/seismic) εκτίθενται μέσω **ribbon structural bridges**
  (`{beam,column,foundation,slab}-structural-bridge.ts`) που wire-άρουν `RibbonCombobox` → store setters.
  **SSoT combobox = `RibbonCombobox.tsx`** (ribbon) / **`src/components/ui/select.tsx`** (ADR-001, non-ribbon).
- **Δεν υπάρχει** ακόμη preset UI → clean slate, ΑΛΛΑ μίμηση υπάρχοντος combobox pattern (μηδέν νέο dropdown).

---

## 3. ΑΠΟΦΑΣΗ ΣΧΕΔΙΑΣΜΟΥ (πάρ' την στο plan, ρώτησε αν αμφιβάλλεις)

**ΠΟΥ μπαίνει ο preset selector;** Δύο υποψήφιοι — διάλεξε με Revit-grade κριτήριο:

| Επιλογή | Χώρος | Revit-αντιστοιχία | Σύσταση |
|---|---|---|---|
| **A (σύσταση)** | **FloorManagementDialog** (ADR-468 building modal, per-building) | Project template (set once ανά κτίριο) | 🟢 Πιο πιστό — preset = building-wide, μία φορά |
| B | Ribbon structural panel (per-selection) | Type properties | 🟡 Transient context· λιγότερο «template» |

**Σύσταση:** **A** — ο preset είναι building-level (όπως όλα τα `StructuralSettings`). Μπαίνει στο
building modal δίπλα στις υπάρχουσες δομοστατικές ρυθμίσεις. Δευτερευόντως, μπορεί ΚΑΙ ribbon shortcut.

⚠️ Αν αγγίξεις render-critical αρχεία (ADR-040 λίστα) → διάβασε ADR-040 πρώτα. Το FloorManagementDialog
**δεν** είναι high-freq → ασφαλές.

---

## 4. i18n (N.11 — keys ΠΡΩΤΑ, μηδέν hardcoded)

Τα labelKeys υπάρχουν ΗΔΗ στο `STRUCTURAL_PRESET_DEFINITIONS`:
`structural.preset.greekRcEc8.{label,description}`, `structural.preset.greekRcLegacy.*`,
`structural.preset.blank.*`. **Πρόσθεσέ τα ΠΡΩΤΑ** και στα δύο:
- `src/i18n/locales/el/dxf-viewer-shell.json` (εκεί ζει το `structural.*` namespace)
- `src/i18n/locales/en/dxf-viewer-shell.json`

Προτεινόμενες τιμές EL: «Ελληνικό RC (Ευρωκώδικες)», «Ελληνικό RC (ΕΚΩΣ-ΕΑΚ)», «Κενό». EN αντίστοιχα.

---

## 5. ΣΧΕΔΙΟ SLICE 2 (πρόχειρο — επιβεβαίωσε με grep/plan)

1. i18n keys EL+EN (§4).
2. Selector component (μίμηση `RibbonCombobox`/`select.tsx`) με options = `STRUCTURAL_PRESET_ORDER.map`
   → label μέσω `t(def.labelKey)`.
3. onChange → `applyStructuralPreset(kind)` (ήδη persist-άρει· μηδέν νέο wiring).
4. Τοποθέτηση στο FloorManagementDialog (επιλογή A) — δίπλα στις building structural ρυθμίσεις.
5. Test (αν component logic) + browser-verify: διάλεξε «Ελληνικό RC (EC8)» → settings = C25/30/eurocode/
   ground B/soil 150· persist+reload κρατά.

---

## 6. ΑΡΧΕΙΑ SLICE 1 ΓΙΑ COMMIT (ο Giorgio θα κάνει commit — git add ΜΟΝΟ ΑΥΤΑ)

**NEW:**
- `src/subapps/dxf-viewer/bim/structural/presets/reference-static-report.ts`
- `src/subapps/dxf-viewer/bim/structural/presets/structural-preset-types.ts`
- `src/subapps/dxf-viewer/bim/structural/presets/structural-preset-defaults.ts`
- `src/subapps/dxf-viewer/bim/structural/presets/index.ts`
- `src/subapps/dxf-viewer/bim/structural/presets/__tests__/reference-static-report.test.ts`
- `docs/centralized-systems/reference/adrs/ADR-479-structural-project-presets.md`
- `docs/centralized-systems/reference/structural-guides/` (README.md, greek-static-report-guide.md, static-report-reference-parameters.json)

**MODIFIED:**
- `src/subapps/dxf-viewer/state/structural-settings-store.ts`
- `src/subapps/dxf-viewer/state/__tests__/structural-settings-store.test.ts`
- `docs/centralized-systems/reference/adr-index.md`
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`

> ⚠️ Shared tree: άλλα uncommitted αρχεία (ADR-477/478, eurocode-provider.ts κ.ά.) ΔΕΝ είναι δικά μου — μην τα stage-άρεις.

---

## 7. SSoT ΧΑΡΤΗΣ (μην ξαναφτιάξεις)

| Χρειάζεσαι | Υπάρχον SSoT |
|---|---|
| Apply preset → settings + persist | `applyStructuralPreset(kind)` (store) — ΕΤΟΙΜΟ |
| Λίστα presets + labels | `STRUCTURAL_PRESET_DEFINITIONS` / `STRUCTURAL_PRESET_ORDER` (presets/index) |
| Combobox (ribbon) | `RibbonCombobox.tsx` |
| Dropdown (non-ribbon, ADR-001) | `src/components/ui/select.tsx` |
| Building modal | `FloorManagementDialog.tsx` (ADR-468) |
| Presets list UI analog | `StairPresetsSection.tsx` |
| i18n namespace | `dxf-viewer-shell.json` (`structural.*`) |

---

## 8. ΣΧΕΤΙΚΑ
ADR-479 (αυτό) · ADR-456 (structural settings SSoT) · ADR-468 (building modal) · ADR-443 (structural ribbon) ·
ADR-001 (Select canonical) · ADR-040 (render perf — μόνο αν αγγίξεις high-freq). Memory:
`project_adr479_structural_project_presets`.
