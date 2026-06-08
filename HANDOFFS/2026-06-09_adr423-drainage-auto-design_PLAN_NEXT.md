# 🧠 HANDOFF — ADR-423 MEP Auto-Design: 2η discipline = ΑΠΟΧΕΤΕΥΣΗ (Drainage Auto-Design) + γενίκευση engine: PLAN MODE

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας: PLAN MODE → child ADR → υλοποίηση.** Η **ύδρευση** (ADR-426, pilot discipline) ολοκληρώθηκε end-to-end & browser-verified. Επόμενο κατά το **κλειδωμένο roadmap** του ADR-423 (σειρά: Ύδρευση→**Αποχέτευση**→Θέρμανση→…): η **αυτόματη μελέτη αποχέτευσης**. Είναι η 2η discipline → **αποδεικνύει** ότι το framework δουλεύει (νέο δίκτυο = registry entry + recognizer, ΟΧΙ νέα μηχανή) και **γεννά το πλήρες `MepDisciplineRegistry`** (που το water pilot ανέβαλε «μέχρι να έρθει η 2η discipline»).

---

## ⚠️ ΚΑΝΟΝΕΣ (αμετάβλητοι — πάγια εντολή Giorgio)
- **Ελληνικά** όλες οι απαντήσεις (LANGUAGE RULE CLAUDE.md).
- **FULL ENTERPRISE + FULL SSOT, «όπως οι μεγάλοι παίχτες / η Revit / MagiCAD / 4M FINE»** — μηδέν `any`/`as any`/`@ts-ignore`, αρχεία ≤500 γρ., functions ≤40 γρ.
- **SHARED working tree** με άλλον agent (codex). `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`.
- **COMMIT/PUSH τον κάνει ΜΟΝΟ ο Giorgio** (N.(-1)). Εσύ ΔΕΝ κάνεις commit/push. **ΜΗΝ αγγίξεις adr-index** (shared tree — εκκρεμεί ήδη για 423/424/425/426· ο Giorgio/codex).
- **Plan Mode πρώτα.** Πάρε ΕΣΥ τις Revit/standards αποφάσεις (μην ρωτάς standard professional options — μάθημα ADR-422)· ζήτα μόνο έγκριση plan + slicing.
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε ότι δεν τρέχει ήδη άλλος.
- **N.15:** μετά υλοποίηση → child-ADR changelog + ADR-423 changelog + μνήμη + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ο Giorgio committάρει).
- **N.11 i18n:** ribbon strings (Slice 2) → keys el+en ΠΡΙΝ τη χρήση (μάθημα: reuse υπάρχοντα labels όπου γίνεται).
- **ADR-040:** Slice 1 (headless engine, `systems/mep-design/`) = **ΕΚΤΟΣ**. Slice 2 (preview ghost + accept→commit) = **ΕΝΤΟΣ** → low-freq proposal store (CHECK 6C-safe, shell δεν subscribe-άρει· πρότυπο water Slice 2) + **STAGE ADR-040** αν αγγίξεις canvas-leaf mount.

---

## 0) ΚΑΤΑΣΤΑΣΗ AUTO-DESIGN (τι υπάρχει ΗΔΗ — reuse, ΜΗΝ ξαναγράψεις)

**🔵 ADR-423 MEP Auto-Design Framework** (`docs/.../ADR-423-mep-auto-design-framework.md`) — vision + decisions **LOCKED** 2026-06-08 (μηδέν κώδικας framework). ΕΝΑ engine Source→Distribution→Terminals + Discipline Registry. Πλήρης taxonomy 8 disciplines/~30 classifications. Stages: 0 Recognition→1 Demand→2 Placement→3 Routing→4 Sizing→5 3D/BOQ→6 Calc/Compliance(CORE)→7 Deliverables→8 Interop(import-only). Σειρά κλειδωμένη.

**🟢 ADR-425 Stage 0 Semantic Recognition** (`systems/recognition/`) — agnostic kernel (spaces/elements/recognizer/engine/registry, μηδέν discipline imports) + **sanitary recognizer/source/classifier pilot** (DONE 2026-06-08). Δίνει `RecognitionModel` (rooms + terminals + source). [[project_adr425_stage0_recognition]]

**🟢 ADR-426 Water-Supply Auto-Design (pilot, child 423)** (`systems/mep-design/water/`) — Slice 1 headless + Slice 2 preview+commit + elevation-at-source **DONE + BROWSER-VERIFIED**. **ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΠΡΟΤΥΠΟ ΠΟΥ ΑΝΤΙΓΡΑΦΕΙΣ 1:1.** Δομή:
  - `water-design-types` (`WaterNetworkProposal` = cold+hot `ProposedNetwork`)· `loading-units`(EN806 LU)· `sizing`(DIN1988 ΣLU→DN)· `demand`· `connector-resolve`/`source-resolve`· `orthogonal-router`(`routeOrthogonalTrunkBranch`, Manhattan trunk-branch, suffix-sum LU→φθίνουσες DN· architected για A* swap)· `design-water-supply`(orchestrator)· `supply-discipline`(`WATER_SUPPLY_DISCIPLINE` descriptor = registry-entry seed)· `index` + `__tests__`.
  - **Slice 2 (ΕΝΤΟΣ ADR-040):** `water-proposal-store`(low-freq)· `commit/build-water-supply-commit`(proposal→{segments,systems})· `CreateMepSegmentsCommand`(batch, 1 undo, deferred `drawing:entity-created`)· `useWaterProposalGhostPreview`(reuse `MepSegmentGhostRenderer` + palette override)· `useRibbonWaterAutoSupplyBridge`(Generate/Accept/Reject) + command-keys + i18n.
  [[project_adr426_water_supply_auto_design]]

**Reuse map (πρωτογενή στοιχεία αποχέτευσης — ΟΛΑ υπάρχουν):** `mep-segment` με `classification:'sanitary-drainage'` + `slopePercent` (Φ14)· **φρεάτιο** = `mep-manifold` kind `'drainage-collector'` (N inlets→1 outlet)· **σιφώνι/floor-drain** + **sanitary fixture drain connectors** (`san-drain`/`fd-drain`, Φ14)· **κατακόρυφες στήλες (risers)** Φ15· auto-fittings reconciler· 2D σύμβολα (catch-basin grating) + 3D + BOQ ΗΛΜ. Δες μνήμες [[project_adr408_phi14_drainage]] [[project_adr408_phi15_riser]].

**🔴 ΤΟ ΝΕΟ TASK:** designDrainage → DrainageNetworkProposal → preview/commit, **+ γενίκευση** του `systems/mep-design/` σε shared engine + **πλήρες `MepDisciplineRegistry`**.

---

## 1) ΑΠΟΧΕΤΕΥΣΗ vs ΥΔΡΕΥΣΗ — οι κρίσιμες διαφορές (Revit-grade, ΟΧΙ νέα μηχανή)

| Άξονας | Ύδρευση (έτοιμο) | **Αποχέτευση (νέο)** |
|---|---|---|
| Flow model | pressurised, radial από source | **gravity-slope** (βαρύτητα, κλίση downhill) |
| Κατεύθυνση γράφου | Source(συλλέκτης)→terminals | **ΑΝΤΙΣΤΡΟΦΗ: terminals(είδη)→collection(φρεάτια)→outfall** (τα είδη=πηγές λυμάτων· outfall=sink) |
| Demand standard | EN806/DIN1988 **Loading Units** | **EN12056-2 Discharge Units (DU)** (διαφορετικός πίνακας ανά είδος) |
| Sizing | ΣLU→DN (φθίνον προς terminals) | **ΣDU→DN (ΑΥΞΑΝΟΝ προς outfall)** + min DN ανά είδος (WC=DN100, νιπτήρας=DN40, ντουζ/μπάνιο=DN50) |
| Routing | Manhattan trunk-branch οριζόντιο | **branch drains→collector→main→outfall με ΚΛΙΣΗ (1–2% fall, EN12056)** + κατακόρυφες στήλες (risers Φ15) σε multi-floor· εξασφάλιση μονότονης καθόδου |
| Χρώμα/palette | cold teal / hot warm-red | **καφέ (drain-pipe category, ήδη SSoT `resolveSegmentClassificationColor`)** |
| Vent stack / αερισμός | — | **deferred** (flag στο ADR· EN12056 secondary ventilation = later slice) |

**Revit-grade αποφάσεις (πάρ' τες ΕΣΥ, lock στο child ADR):** EN12056-2 System I/II (επίλεξε & τεκμηρίωσε· Ευρώπη=συνήθως System I μερικώς γεμάτο)· DU table ανά fixture kind· min slopes ανά DN (π.χ. DN100 ≥1%, DN50 ≥1.5–2%)· cumulative DU **αυξάνει** προς outfall· pluggable `DrainageSizingStandard`/`DischargeDemandStandard` πίσω από τον descriptor (ίδιο pattern με water). Vent/storm/grease = flagged future slices.

---

## 2) ΤΟ ΖΗΤΟΥΜΕΝΟ ΣΧΕΔΙΟ (Plan Mode — max reuse, mirror water 1:1)

**A) Γενίκευση (η framework υπόσχεση):** ανέβασε τα κοινά του water pilot σε shared `systems/mep-design/` (engine-agnostic): `ProposedNetwork`/`*NetworkProposal` base types, `orthogonal-router` (ήδη generic), proposal-store pattern, ghost pattern, batch `CreateMepSegmentsCommand` (ήδη generic), commit builder shape. **NEW `MepDisciplineRegistry`** (ADR-423 §4 SSoT): `{disciplineId, terminalRecognizers, sourceKind, classification, flowModel, sizingStandard, demandStandard, paletteColor, routingConstraints, slicing}` — με 2 entries: `WATER_SUPPLY` (από `supply-discipline`) + νέο `SANITARY_DRAINAGE`. Στόχος: νέα discipline = 1 registry entry + 1 recognizer (ήδη υπάρχει sanitary recognizer στο ADR-425).

**B) Drainage engine (Slice 1 headless, ΕΚΤΟΣ ADR-040):** φάκελος `systems/mep-design/drainage/` (mirror `water/`):
  - `drainage-design-types` (`DrainageNetworkProposal` = ένα `ProposedNetwork` gravity + outfall + servedTerminals + ΣDU + warnings).
  - `discharge-units` (EN12056 DU ανά kind)· `drainage-sizing` (ΣDU→DN, min-DN ανά είδος, ΑΥΞΑΝΟΝ)· `slope-assignment` (κλίση/fall ανά τμήμα, μονότονη κάθοδος)· `demand`/`connector-resolve` (drain connectors)· `outfall-resolve` (collector→sewer· λείπει→warning).
  - `gravity-router` (reuse/extend `routeOrthogonalTrunkBranch`: terminals→collector→outfall, αντίστροφη συσσώρευση DU, slope-aware z· risers Φ15 σε cross-floor). v1 ΟΧΙ wall-aware (A* = swap, ίδιο contract — κοινό με water Slice 3).
  - `design-drainage` (orchestrator: RecognitionModel→DrainageNetworkProposal)· `drainage-discipline` descriptor· `index` + `__tests__` (headless print όπως water: ΣDU, DN ladder, slopes).

**C) Drainage preview+commit (Slice 2, ΕΝΤΟΣ ADR-040, mirror water Slice 2):** `drainage-proposal-store` (low-freq)· `commit/build-drainage-commit` (reuse `completeMepSegmentFromTwoClicks` + `buildDefaultPipeNetworkParams` + `CreateMepSegmentsCommand`· classification=sanitary-drainage· slope→params)· ghost (reuse `MepSegmentGhostRenderer` + καφέ palette override + grating glyph για collectors)· ribbon «Αυτόματη Αποχέτευση» (Generate/Accept/Reject) + bridge + command-keys + i18n el+en. Accept = 1 atomic CompoundCommand· fittings αυτόματα (reconciler).

**Πρότεινε slicing:** Slice 1 headless (engine+tests+print) → έγκριση → Slice 2 preview+commit. (Όπως ζήτησε ο Giorgio στο water: headless πρώτα.)

---

## 3) ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗ γράψεις κώδικα πριν την έγκριση του plan + child ADR.
- ΜΗΝ ξαναγγίξεις water (`systems/mep-design/water/`) πέρα από την **γενίκευση** κοινών (κράτα το water πράσινο: 20 tests).
- ΜΗΝ commit/push/adr-index (Giorgio). ΜΗΝ `git add -A`.
- ΜΗΝ φτιάξεις νέα drainage primitives — **ΟΛΑ υπάρχουν** (segment+slope, drainage-collector, drains, risers). Μόνο ο «εγκέφαλος» (demand/router/sizing) λείπει.
- ΜΗΝ τρέξεις 2ο tsc (N.17). Vent/storm/grease = flag, ΟΧΙ τώρα.

## 4) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ (νέα session, Opus)
1. Διάβασε αυτό το handoff + ADR-423 (§2.1 taxonomy, §4 registry, §σειρά) + ADR-426 doc + φάκελο `systems/mep-design/water/` (ΟΛΟ — το αντιγράφεις) + `systems/recognition/` (sanitary recognizer) + μνήμες [[project_adr423_mep_auto_design]] [[project_adr426_water_supply_auto_design]] [[project_adr425_stage0_recognition]] [[project_adr408_phi14_drainage]] [[project_adr408_phi15_riser]].
2. Επιβεβαίωσε signatures: `designWaterSupply`, `routeOrthogonalTrunkBranch`, `WaterNetworkProposal`/`ProposedNetwork`, `WATER_SUPPLY_DISCIPLINE`, `build-water-supply-commit`, `CreateMepSegmentsCommand`, `useWaterProposalGhostPreview`, recognizer `RecognitionModel`, drainage primitives (`drainage-collector` manifold kind, `san-drain`/`fd-drain` connectors, `slopePercent`, `resolveSegmentClassificationColor`).
3. **Δημιούργησε child ADR** (επόμενο ελεύθερο νούμερο — έλεγξε τον υψηλότερο· το pilot ήταν **ADR-426**, άρα ~**ADR-427** «Sanitary Drainage Auto-Design», child του 423) με τις standards αποφάσεις (EN12056 DU/slopes) + το slicing.
4. **Μπες Plan Mode** → παρουσίασε plan (γενίκευση + registry + drainage Slice 1) + ζήτα έγκριση.
5. Μετά έγκριση → υλοποίηση Slice 1 (headless+tests) → browser-N/A → Slice 2 → browser-verify με Giorgio. N.15 updates.

## 5) ΜΕΤΑ ΑΠΟ ΑΥΤΟ
3η discipline = **Θέρμανση** (hydronic — radiator/boiler/underfloor primitives ήδη functional· closed-loop supply+return· demand=heat-load ADR-422 ΤΟΤΕΕ/ΚΕΝΑΚ). Μετά: Ηλεκτρ.Ισχυρά→HVAC→Ηλεκτρ.Ασθενή→Πυρόσβεση→Αέριο (ADR-423 §σειρά). Παράλληλη βελτίωση κοινού router: **water Slice 3 A* wall-aware** (ωφελεί ΟΛΕΣ τις disciplines).
