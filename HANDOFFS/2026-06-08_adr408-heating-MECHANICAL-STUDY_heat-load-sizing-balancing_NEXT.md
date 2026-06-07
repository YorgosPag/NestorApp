# HANDOFF — ΘΕΡΜΑΝΣΗ ΩΣ ΜΗΧΑΝΟΛΟΓΙΚΗ ΜΕΛΕΤΗ (Heat Load + Sizing + Υδραυλική Εξισορρόπηση)

**Ημερομηνία:** 2026-06-08
**Εντολή Giorgio:** «ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ (Revit/4M-FineHEAT) — FULL ENTERPRISE + FULL SSOT. ΠΛΗΡΕΣ scope.»
**Μοντέλο:** Opus 4.8 (αρχιτεκτονική/νέο subsystem)
**Πρότυπο (κλειδωμένο):** Ελληνικό **ΤΟΤΕΕ/ΚΕΝΑΚ** (ΤΟΤΕΕ 20701-1 υπολογισμοί, ΤΟΤΕΕ 20701-3 κλιματικά δεδομένα), με βάση EN 12831.
**Scope (κλειδωμένο):** ΠΛΗΡΕΣ — (1) θερμικά φορτία, (2) διαστασιολόγηση σωμάτων & σωλήνων, (3) υδραυλική εξισορρόπηση.
**Execution (κλειδωμένο):** **Plan Mode recognition ΠΡΩΤΑ** → ADR → plan → (πιθανόν Orchestrator μετά από approval Giorgio).

**⚠️ COMMIT/PUSH: ΜΟΝΟ ο Giorgio.** Working tree **SHARED** με άλλον agent.
**⚠️ `git add` ΜΟΝΟ δικά σου αρχεία — ΠΟΤΕ `-A`. ΜΗΝ adr-index. ΜΗΝ `--no-verify`. N.17: ΕΝΑ tsc τη φορά.**

---

## 0) ΠΟΥ ΕΙΜΑΣΤΕ — ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (code = source of truth)

### Α. BIM authoring θέρμανσης (ADR-408) — ΟΛΟΚΛΗΡΩΜΕΝΟ (pending verify/commit Giorgio)
Όλα τα **«τι υπάρχει»** entities δουλεύουν: γεωμετρία + δίκτυο + 3D placement + BOQ.
- `mep-radiator` (καλοριφέρ, τερματικό, 2 connectors supply/return· tab έχει panel **Thermal** → πιθανό `thermalOutput` param — ΕΠΙΒΕΒΑΙΩΣΕ).
- `mep-boiler` (λέβητας, πηγή· tab Thermal).
- `mep-underfloor` (ενδοδαπέδια, area entity, `totalLengthM`, σερπαντίνα).
- `mep-segment` (σωλήνας domain `pipe`· `diameter`, `classification`, `length`).
- `mep-manifold` (συλλέκτης· N outlets).
- Δίκτυο: `MepSystem` (source owns classification, members inherit) + auto-fittings.
- **BOQ auto-feed DONE σήμερα** (2026-06-08): MEP→Προμετρήσεις με placeholder ΗΛΜ codes.

### Β. ΘΕΡΜΙΚΟ ΚΕΛΥΦΟΣ (ADR-396, ETICS/θερμοπρόσοψη) — ΥΠΑΡΧΕΙ· ΕΙΝΑΙ ΤΟ INPUT ΤΩΝ ΦΟΡΤΙΩΝ
Φάκελος `src/subapps/dxf-viewer/bim/thermal/`:
- **`assembly-u-value.ts`** → `computeAssemblyUValue(layers)` pure (Rsi+Σd/λ+Rse, ISO 6946). `ThermalLayer` type.
- **`kenak-thermal-config.ts`** → SSoT ΚΕΝΑΚ: `ClimateZone` (A/B/C/D, ΤΟΤΕΕ 20701-3)· `KENAK_MAX_U_WALL` ανά ζώνη (ΤΟΤΕΕ 20701-1)· `REFERENCE_BARE_WALL_LAYERS`· `ClimateZoneOption`.
- `wall-assembly-thermal.ts`, `thermal-envelope-types.ts` (`ENVELOPE_MATERIAL_OPTIONS`), `wall-material-catalog.ts` (λ ανά υλικό).
- UI: `ThermalEnvelopeHost.tsx`, `ThermalEnvelopeDialog.tsx` (ανά-όροφο, advisory soft-warn).
- **`Building.climateZone`** ρύθμιση κτιρίου (`src/types/building/contracts.ts`).

### Γ. ΤΙ ΛΕΙΠΕΙ ΕΝΤΕΛΩΣ (το παρόν task)
- **Δεν υπάρχει heat-load calculation engine** (απώλειες ανά χώρο). Το grep `heatLoad` βρήκε μόνο envelope/locale/building contracts — ΟΧΙ engine.
- **Δεν φαίνεται να υπάρχει «θερμικός χώρος» / Space / Room entity** (όγκος + χρήση + θερμοκρασία setpoint + ACH). Υπάρχει `footprint-region-classifier.ts` (περιοχές δαπέδου) + `FloorFinish` (ADR-419 «ένα polygon ανά δωμάτιο») που ίσως χρησιμεύσουν ως room proxy — **ΚΡΙΣΙΜΗ recognition**.
- Δεν υπάρχει sizing (σώματα/σωλήνες) ούτε hydraulic balancing.

---

## 1) ΣΤΟΧΟΣ

Πλήρης μηχανολογική μελέτη κεντρικής θέρμανσης «σαν Revit/4M», με ελληνικό ΤΟΤΕΕ/ΚΕΝΑΚ, FULL ENTERPRISE + FULL SSOT, χτισμένη ΠΑΝΩ στο υπάρχον BIM (ADR-408 entities) + θερμικό κέλυφος (ADR-396).

Παράγει, ανά χώρο και ανά σύστημα:
1. **Θερμικό φορτίο** (W) — απώλειες αγωγής + αερισμού/διείσδυσης (+ reheat/θερμογέφυρες).
2. **Διαστασιολόγηση**: ισχύς καλοριφέρ (W ανά χώρο) + διάμετρος σωλήνα ανά κλάδο.
3. **Υδραυλική εξισορρόπηση**: παροχές, πτώσεις πίεσης, index circuit, preset βαλβίδων.

---

## 2) RECOGNITION (PHASE 1 — Plan Mode, ΠΡΙΝ ΚΩΔΙΚΑ)

Διάβασε & κατάγραψε (code = truth):
1. **`bim/thermal/*`** πλήρως — τι εκθέτει το `computeAssemblyUValue` + `kenak-thermal-config` (ζώνες, U_max). Υπάρχει design outdoor temperature ανά ζώνη; (αν όχι → πρέπει να προστεθεί στο config, ΤΟΤΕΕ 20701-3).
2. **Θερμικοί χώροι**: ψάξε `footprint-region-classifier`, `FloorFinish`/`floor-finish` entity, envelope-perimeter — μπορούμε να παράγουμε per-room όγκο/εμβαδό/περίμετρο εκτεθειμένων επιφανειών; Υπάρχει «χρήση χώρου» (κουζίνα/υπνοδωμάτιο/μπάνιο);
3. **MEP entities params**: `mep-radiator-types.ts` (υπάρχει `thermalOutput`/`nominalPower`/`deltaT`/`exponent`;)· `mep-segment-types.ts` (`diameter`, `flowRate`;)· `mep-manifold` loops.
4. **`Building.climateZone`** + όποιο building-level setting θερμοκρασιών.
5. **Walls/openings**: πώς παίρνουμε U + εμβαδά εξωτερικών τοίχων/κουφωμάτων/οροφής/δαπέδου ανά χώρο (envelope graph; opening areas;).
6. **Επόμενος ελεύθερος ADR**: από `adr-index.md` (ΟΧΙ filename scan· το CLAUDE.md «ADR-370» είναι STALE — υπάρχει μέχρι **ADR-421**, οπότε πιθανότατα **ADR-422**). ⚠️ ΜΗΝ αγγίξεις το adr-index (shared) — απλώς διάβασέ το.

---

## 3) ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΠΡΟΤΑΣΗ (high-level — ΕΠΙΚΥΡΩΣΕ/ΔΙΟΡΘΩΣΕ σε Plan Mode, FULL SSOT)

Νέο **ADR-422 (επιβεβαίωσε)** «BIM Μηχανολογική Μελέτη Θέρμανσης (ΤΟΤΕΕ/ΚΕΝΑΚ)». 5 στρώματα, pure-SSoT engines + thin UI:

- **L0 — Θερμικός χώρος (Space/Thermal Zone):** ΑΝ δεν υπάρχει room entity → όρισέ τον (footprint polygon + χρήση + setpoint Ti + ACH). Reuse FloorFinish/region αν γίνεται· **ΡΩΤΑ Giorgio** (νέο entity vs reuse). Είναι το θεμέλιο — χωρίς χώρους δεν υπάρχει per-room φορτίο.
- **L1 — Heat Load engine** (`bim/thermal/heat-load/*.ts`, pure): ΤΟΤΕΕ 20701-1 / EN 12831:
  Φ = Φ_transmission [Σ U·A·ΔΤ·f_k] + Φ_ventilation [0.34·n·V·ΔΤ] (+ θερμογέφυρες + reheat/intermittency). ΔΤ = Ti − Te(ζώνη). Inputs: `computeAssemblyUValue` (κέλυφος) + `kenak-thermal-config` (ζώνη→Te) + L0 (V, χρήση→Ti, n).
- **L2 — Radiator sizing**: match Φ_room με ισχύ σώματος, διόρθωση ΔΤ (logarithmic mean ή ΤΟΤΕΕ exponent n· nominal @ ΔΤ=50K). Γράψε πίσω στο `mep-radiator.params` (sizing result, derived cache· geometry/qty = SSoT).
- **L3 — Pipe sizing**: m = Φ/(c·ΔΤ_system) → διάμετρος από όρια ταχύτητας (m/s) / R (Pa/m). Γράψε `mep-segment.params.diameter` (ή sizing cache).
- **L4 — Hydraulic balancing**: πτώση πίεσης ανά βρόχο (Darcy-Weisbach + τοπικές αντιστάσεις fittings) → index circuit → preset βαλβίδων/προρρύθμιση συλλέκτη.
- **UI/Report:** πίνακας μελέτης ανά χώρο/σύστημα (mirror BOQ schedule pattern)· badges στα contextual tabs (Thermal panel radiator/χώρου)· πιθανό PDF φύλλο μελέτης (δες accounting/gantt pdf SSoT).

---

## 4) FULL SSOT — ΜΗΝ FORK
- Reuse `computeAssemblyUValue` + `kenak-thermal-config` + `thermal-envelope-types` + `wall-material-catalog` (λ). ΜΗΝ ξαναγράψεις U-value math ούτε κλιματικές ζώνες.
- Reuse υπάρχοντα MEP entities/params (radiator/segment/manifold) — πρόσθεσε sizing fields ως **derived cache** στα params (όχι νέο entity για το αποτέλεσμα).
- Reuse envelope graph/opening areas (μην ξαναϋπολογίσεις εμβαδά).
- Engines **pure + idempotent + side-effect free** (όπως `mep-*-geometry.ts`), με tests (ΤΟΤΕΕ worked examples).
- ΜΗΝ persist-άρεις αποτέλεσμα ως truth όπου παράγεται από inputs (mirror ADR-395 geometry-as-SSoT).

---

## 5) ΑΝΟΙΧΤΑ ΕΡΩΤΗΜΑΤΑ ΓΙΑ PLAN MODE (ρώτα Giorgio με AskUserQuestion)
1. **Θερμικός χώρος**: νέο `space`/`thermal-zone` entity, ή reuse `FloorFinish`/region polygons, ή auto-derive από κλειστούς βρόχους τοίχων;
2. **Default θερμοκρασίες/ACH ανά χρήση χώρου** (ΤΟΤΕΕ πίνακες): να μπουν ως config SSoT· ποιες χρήσεις (κατοικία/γραφείο/…);
3. **ΔΤ συστήματος** (π.χ. 70/55, 80/60, ή χαμηλοθερμοκρασιακό 45/35 για ενδοδαπέδια) — ανά σύστημα.
4. **Pipe sizing κριτήριο**: ταχύτητα vs πτώση πίεσης (R Pa/m) — και όρια.
5. **Report**: PDF φύλλο μελέτης τώρα ή μετά;
6. **Διαχωρισμός φάσεων** (L0→L1→L2→L3→L4): commit/verify ανά στρώμα ή όλο μαζί;

---

## 6) ΚΑΝΟΝΕΣ
- **Plan Mode πρώτα** (recognition → ADR-422 → plan). ΜΗΝ γράψεις κώδικα πριν εγκριθεί το plan.
- **N.8**: αν το plan δείξει 5+ αρχεία / 2+ domains → πρότεινε Orchestrator + **περίμενε approval Giorgio**.
- **FULL SSOT**, code = source of truth (διάβασε πριν γράψεις).
- Working tree **SHARED** → `git add` ΜΟΝΟ δικά σου, **ΠΟΤΕ `-A`**. **COMMIT/PUSH μόνο Giorgio.**
- **ΜΗΝ** adr-index (shared). **ΜΗΝ** `--no-verify`. **N.17** ένας tsc τη φορά.
- Pre-existing tsc errors **μην τα κυνηγήσεις** (π.χ. `mesh-to-object3d:124`, locale `en/dxf-viewer-shell.json`).
- N.15: μετά την υλοποίηση → ADR-422 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory (ΟΧΙ adr-index).

## 7) ΚΡΙΣΙΜΑ ΑΡΧΕΙΑ (διάβασέ τα ΠΡΩΤΑ)
- `src/subapps/dxf-viewer/bim/thermal/assembly-u-value.ts` + `kenak-thermal-config.ts` + `thermal-envelope-types.ts` + `wall-assembly-thermal.ts`
- `docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md`
- `src/types/building/contracts.ts` (`climateZone`)
- `src/subapps/dxf-viewer/bim/types/mep-radiator-types.ts` / `mep-segment-types.ts` / `mep-manifold-types.ts` (sizing fields;)
- `src/subapps/dxf-viewer/bim/geometry/footprint-region-classifier.ts` + `envelope-perimeter.ts` + `envelope-wall-graph.ts` (room/exposed-surface candidates)
- `docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md` (entities backbone)
- `docs/centralized-systems/reference/adrs/ADR-419-*` (FloorFinish «ένα polygon ανά δωμάτιο»)
- `docs/centralized-systems/reference/adr-index.md` (επόμενος ADR — read-only)

## 8) ΣΕΙΡΑ ΕΡΓΑΣΙΑΣ
1. Plan Mode recognition (§2).
2. AskUserQuestion §5 (θερμικός χώρος + defaults + ΔΤ + sizing + report + φάσεις).
3. Γράψε/άνοιξε ADR-422 (recognition findings + αποφάσεις).
4. Παρουσίασε plan (πιθανόν Orchestrator) → approval Giorgio.
5. Υλοποίηση L0→L4 + tests (ΤΟΤΕΕ worked examples) + UI/report.
6. tsc (N.17) + jest. N.15 docs. **STOP — commit ο Giorgio.**
