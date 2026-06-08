# HANDOFF — ADR-422 L2: Radiator Sizing (Διαστασιολόγηση Θερμαντικών Σωμάτων, EN 442 / ΤΟΤΕΕ)

**Ημερομηνία:** 2026-06-08
**Μοντέλο:** Opus 4.8
**Εντολή Giorgio:** «ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ (Revit / 4M-FineHEAT) — **FULL ENTERPRISE + FULL SSOT**. Πλήρης συμμόρφωση ελληνικών κανονισμών.»
**Εκτέλεση:** **Plan Mode πρώτα** (πάρε ΕΣΥ τις Revit-grade αποφάσεις + ζήτα έγκριση plan· μην ρωτάς για standard professional επιλογές — μάθημα [[feedback_make_revit_grade_decisions_yourself]]). Μετά υλοποίηση.
**⚠️ SHARED working tree** με άλλον agent. `git add` **ΜΟΝΟ** δικά σου αρχεία — **ΠΟΤΕ `-A`**. **COMMIT τα κάνει ο Giorgio, ΟΧΙ εσύ** (N.(-1)).

---

## 0) ΤΙ ΘΑ ΚΑΝΕΙΣ

Υλοποίηση του **L2 — Radiator Sizing** του ADR-422: παίρνεις το **θερμικό φορτίο Φ (W) ανά χώρο** (έτοιμο από το L1) και **διαστασιολογείς το θερμαντικό σώμα** που χρειάζεται κάθε θερμικός χώρος — όπως Revit «Heating Loads → equipment sizing» / 4M-FineHEAT.

**Πυρήνας (locked, ADR-422 §3 L2):**
```
P_required_nominal = Φ_room · (ΔΤ_nominal / ΔΤ_actual)^n      ← διόρθωση EN 442
```
- `Φ_room` = `SpaceHeatLoadResult.totalW` (από τον L1 engine).
- `ΔΤ_nominal` = 50 K (πρότυπη ονομαστική συνθήκη EN 442, αντιστοιχεί σε 75/65/20).
- `ΔΤ_actual` = θερμοκρασιακή υπεροχή σώματος–χώρου για το **regime συστήματος** (D4: 80/60 · 70/55 · 45/35).
- `n` = εκθέτης σώματος (panel ≈ **1.30**, EN 442 — config SSoT, editable/per-catalog).

**Αποτέλεσμα:** ο μελετητής βλέπει στο contextual tab του καλοριφέρ (ή στο analytical readout) την **απαιτούμενη ονομαστική ισχύ** + παράγοντα διόρθωσης· το σώμα «χαρακτηρίζεται» επαρκές/ανεπαρκές vs το catalogue `thermalOutputW`.

**ΠΡΩΤΟ ΒΗΜΑ: Plan Mode** — διάβασε κώδικα (code = source of truth), σχεδίασε engine + assignment + UI, πάρε τις αποφάσεις, ζήτα έγκριση.

---

## 1) ΑΠΟΦΑΣΕΙΣ ΝΑ ΚΛΕΙΔΩΣΕΙΣ ΣΤΟ PLAN MODE (πρότεινε + δικαιολόγησε, μη ρωτάς τετριμμένα)
- **D4 ΔΤ regime (locked στο ADR):** multi-preset **80/60 · 70/55 · 45/35** (supply/return °C). ΑΠΟΦΑΣΙΣΕ ΠΟΥ αποθηκεύεται: ανά **hydronic MepSystem** (Revit «System Type» — προτεινόμενο), ή building/project config, ή per-radiator override. Fallback **75/65** (EN 442 reference) όταν δεν έχει οριστεί.
- **ΔΤ_actual method:** πρότεινε **AMTD** = (Tsupply+Treturn)/2 − Ti (η σύμβαση EN 442· 75/65/20 → AMTD=50). Η LMTD είναι εναλλακτική — επίλεξε AMTD ως default, documented + editable.
- **Εκθέτης n:** default **1.30** (panel radiator)· config SSoT· μελλοντικά per-catalog/per-kind.
- **Space ↔ Radiator assignment (Revit auto):** point-in-polygon — το `radiator.params.position` μέσα στο `thermalSpace.params.footprint`. ΑΠΟΦΑΣΙΣΕ κατανομή όταν N σώματα/χώρο: ισοκατανομή Φ_room / N (απλό, Revit-like) ή ανά ισχύ. Χώρος χωρίς σώμα → flag «ακάλυπτος».
- **Πού γράφεται το sized αποτέλεσμα:** ADR roadmap λέει «γράφει `mep-radiator.params` (derived cache)». ΠΡΟΣΟΧΗ SSoT: το `Φ_room` είναι **derived** (re-computable)· μην persist-άρεις αυτό που ξανα-υπολογίζεται. Πρότεινε: είτε **transient read-model** (όπως το L1 overlay — κανένα persist), είτε νέο **derived** field `requiredOutputW` που ξανα-υπολογίζεται στο load (όχι SSoT-violating). Το υπάρχον `thermalOutputW?` είναι το **catalogue** (input χρήστη) — ΜΗΝ το μπερδέψεις με το required.

---

## 2) SSoT ΘΕΜΕΛΙΟ — REUSE, ΜΗΝ FORK (επιβεβαιωμένο code)
- **L1 heat-load (Φ_room):** `bim/thermal/heat-load/heat-load-engine.ts` (`computeSpaceHeatLoad` → `SpaceHeatLoadResult.totalW`). Reactive: `hooks/data/useSpaceHeatLoads.ts` → `{ results: Map<spaceId,SpaceHeatLoadResult>, spaces, totalW }`. Input-gathering SSoT: `hooks/data/useHeatLoadInputs.ts`. **ΜΗΝ ξαναγράψεις τον υπολογισμό φορτίου — κατανάλωσέ τον.**
- **Καλοριφέρ (entity, ADR-408 Εύρος Β #1):** `bim/types/mep-radiator-types.ts` → `MepRadiatorParams` έχει ήδη `position: Point3D`, `width/length/bodyHeightMm`, `connectorDiameterMm`, `thermalOutputW?` (**catalogue nominal @ΔΤ50K**, input). `bim/mep-radiators/*` (geometry/firestore/grips/symbol). Contextual tab: `ui/ribbon/data/contextual-mep-radiator-tab.ts` (panels **Geometry/Thermal**/Actions — ο Thermal πίνακας υπάρχει ήδη, εκεί μπαίνει το readout) + `mep-radiator-command-keys.ts` (`params.thermalOutput`) + `useRibbonMepRadiatorBridge.ts`. **Πρότυπο readout = το L1 per-space tab readout** (disabled comboboxes via `getComboboxState` + `RibbonComboboxState.disabled`).
- **Θερμικός χώρος (L0):** `bim/types/thermal-space-types.ts` (`footprint`/`useType`/Ti μέσω `resolveThermalSpaceSetpointC`). Το Ti του χώρου = η θερμοκρασία αναφοράς για το ΔΤ_actual.
- **Point-in-polygon SSoT:** `bim/geometry/shared/polygon-utils.ts` → `pointInPolygon(point, vertices)` + `polygonCentroid`. (Ίδιο SSoT με `ThermalSpaceRenderer.hitTest`.)
- **Hydronic MepSystem (regime host candidate):** `bim/mep-systems/*` + `PlumbingSystemClassification` (hydronic-supply/return ήδη υπάρχει από ADR-408 Εύρος Α). Αν το ΔΤ regime ζει στο System → δες `UpdateMepSystemParamsCommand` + `RibbonMepNetworkClassificationWidget` pattern.
- **Analytical UI pattern:** αν θες overlay-style εμφάνιση (π.χ. badge «επαρκές/ανεπαρκές» ανά σώμα) → πρότυπο `components/dxf-layout/HeatLoadOverlay.tsx` (L1, ADR-040 leaf) + `state/bim-render-settings-store.ts` toggle pattern (`showHeatLoad`).

---

## 3) ΚΕΝΑ ΠΟΥ ΠΡΟΣΘΕΤΕΙ ΤΟ L2
1. **NEW pure engine** `bim/thermal/sizing/radiator-sizing.ts` — `computeRequiredRadiatorOutput({ roomLoadW, supplyC, returnC, indoorC, exponent })` → `{ deltaTActualK, correctionFactor, requiredNominalW }`. Pure, idempotent, full unit-tests (EN 442 worked examples: 75/65/20 → factor=1.0· 45/35/20 → factor≈3.3).
2. **NEW config SSoT** `bim/thermal/sizing/radiator-sizing-config.ts` — `ΔΤ_NOMINAL_K=50`, `DEFAULT_RADIATOR_EXPONENT=1.30`, `SYSTEM_REGIME_PRESETS` (80/60·70/55·45/35 + labels i18n), `DEFAULT_SYSTEM_REGIME` (75/65).
3. **NEW resolver** `bim/thermal/sizing/space-radiator-assignment.ts` — `assignRadiatorsToSpaces(radiators, spaces)` → Map (point-in-polygon, κατανομή Φ_room ανά σώμα). Pure.
4. **NEW hook** (αν χρειαστεί reactive) `hooks/data/useRadiatorSizing.ts` — συνδυάζει `useSpaceHeatLoads` + assignment + sizing engine → per-radiator required output. (Mirror `useSpaceHeatLoads`.)
5. **UI:** readout στον υπάρχοντα **Thermal** πίνακα του radiator tab (απαιτούμενη ισχύς + παράγοντας + επάρκεια vs catalogue) + ΔΤ regime selector (όπου αποφασίσεις ότι ζει). i18n el+en (keys πρώτα στα locales).

---

## 4) ΜΟΝΑΔΕΣ + SSoT ΠΑΓΙΔΕΣ
- `Φ_room` είναι ήδη σε **W** (ο L1 engine επιστρέφει W — μην ξανα-μετατρέψεις).
- `radiator.params.position` + `space.footprint.vertices` είναι **scene units** — το point-in-polygon είναι unit-agnostic (ίδιο σύστημα συντεταγμένων), άρα ΟΚ χωρίς μετατροπή.
- **ΜΗΝ persist-άρεις το derived Φ/required** ως SSoT (anti-SSoT· ξανα-υπολογίζεται). Transient read-model ή re-derive στο load — όπως το L1.
- **ΜΗΝ μπερδέψεις** `thermalOutputW` (catalogue input) με `requiredNominalW` (derived output). Διακριτά πεδία/concepts.

## 5) ΚΑΝΟΝΕΣ ΠΟΙΟΤΗΤΑΣ (CLAUDE.md)
- **FULL ENTERPRISE + FULL SSOT**, Revit/4M-FineHEAT grade. No `any`/`as any`/`@ts-ignore`. Functions **≤40 γρ.**, code files **≤500 γρ.** (engines/config/types εξαιρούνται). Semantic HTML, no inline styles.
- **i18n SSoT:** όλα τα labels `t('...')`, keys πρώτα σε `el` **και** `en`. Καμία hardcoded ελληνική/αγγλική string (numeric+unit «W»/«°C» επιτρέπονται, μοτίβο `ThermalSpaceRenderer`/`HeatLoadOverlay`).
- **TSC (N.17):** ΠΡΙΝ τρέξεις `tsc` έλεγξε ότι δεν τρέχει ήδη άλλος (`Get-CimInstance Win32_Process … '*tsc*'`). ΕΝΑ tsc τη φορά, background, μη μπλοκάρεις.
- **ADR-040:** το L2 πιθανότατα **ΕΚΤΟΣ** (pure engine + readout/overlay leaf). Αν αγγίξεις `CanvasLayerStack` (overlay mount) → **STAGE ADR-040** (CHECK 6B/6D), όπως έκανε το L1 `HeatLoadOverlay`.
- **N.15 (μετά):** `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + **ADR-422 changelog (L2 entry)** + memory `project_adr422_thermal_space.md` + MEMORY.md. **ΜΗΝ** `adr-index.md` (shared tree).

## 6) PENDING COMMIT (ο Giorgio θα κάνει commit — εσύ ΟΧΙ)
Uncommitted στο shared tree (ΜΗΝ βασιστείς ότι έφυγαν στο production):
- **ADR-422 L1** (αυτή η session): `bim/thermal/heat-load/derive-space-heat-loads.ts` + `heat-load-color.ts` + tests· `hooks/data/useHeatLoadInputs.ts` + `useSpaceHeatLoads.ts`· `components/dxf-layout/HeatLoadOverlay.tsx`· `ui/ribbon/components/ShowHeatLoadToggle.tsx`· edits σε `bim-render-settings-types.ts`/`-store.ts`/`CanvasLayerStack.tsx`/`view-tab-bim-settings.ts`/`RibbonPanel.tsx`/`contextual-thermal-space-tab.ts`/`thermal-space-command-keys.ts`/`useRibbonThermalSpaceBridge.ts`/i18n· ADR-422 changelog. **25/25 tests· tsc 0 στα δικά μου.**
- **ADR-422 L0** + ADR-408 heating items (καλοριφέρ/λέβητας/ενδοδαπέδια/BOQ) + πλήθος άλλων.

## 7) ROADMAP (μετά το L2)
L3 pipe sizing (m=Φ/(c·ΔΤ)→DN, γράφει `mep-segment.params.diameter`) → L4 hydraulic balancing (Darcy + index circuit + valve presets) → **Report PDF** (reuse `bim/schedule/*` + `registerGreekFont`).

## 8) ΠΗΓΕΣ ΝΑ ΔΙΑΒΑΣΕΙΣ ΠΡΩΤΑ
- `docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md` (§2 αποφάσεις D4/D5, §3 L2, §4 changelog L0+L1).
- memory `project_adr422_thermal_space.md` (L0+L1 + μάθημα SSoT input-gathering + unit-bug).
- `bim/thermal/heat-load/*` (L1 engine — ο καταναλωτής σου) + `hooks/data/useSpaceHeatLoads.ts`.
- `bim/types/mep-radiator-types.ts` + `ui/ribbon/data/contextual-mep-radiator-tab.ts` (το entity που διαστασιολογείς).
- ADR-040 list στο `CLAUDE.md` (επιβεβαίωσε ότι είσαι εκτός ή STAGE).
