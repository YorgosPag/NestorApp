# HANDOFF — Joint Reinforcement (αναμονές/ματίσεις/αγκυρώσεις) 3Δ render + BOQ takeoff — 2026-06-17

> Συνέχεια εργασίας στον **Στατικό Οργανισμό** (ADR-459) του DXF viewer.
> **Commit τον κάνει ο Giorgio, ΟΧΙ ο agent (N.(-1)). Working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent → `git add` ΜΟΝΟ δικά μου αρχεία.**
> **Στυλ: FULL ENTERPRISE + FULL SSOT, Revit-grade. ΠΡΙΝ κώδικα → πραγματικό SSoT audit (grep). Απάντηση ΠΑΝΤΑ στα Ελληνικά.**

---

## 1. ΤΙ ΡΩΤΗΣΕ Ο GIORGIO (με εικόνα: «Π»-πύλη — 2 πέδιλα + 2 κολώνες + 1 δοκάρι, 3Δ render οπλισμού)

Στους **κόμβους** (πέδιλο↔κολώνα, κολώνα↔δοκάρι) ΔΕΝ φαίνονται **ματίσεις / επικαλύψεις / αναμονές (dowels) / αγκυρώσεις / έξτρα οπλισμός κόμβου**. Ερωτήματα:
1. Γιατί στο 3Δ κάθε μέλος έχει τον δικό του ανεξάρτητο κλωβό που απλώς «τελειώνει» στο όριο, χωρίς να δείχνει τη σύνδεση;
2. Ο έξτρα οπλισμός κόμβων **υπολογίζεται** ως ποσότητα / βάρος / μήκος / είδος σιδήρου / διατομή; ΝΑΙ ή ΟΧΙ;
3. Ή το πρόβλημα είναι **μόνο** ότι δεν προβάλλεται 3Δ;
4. Τι θα έκαναν οι «μεγάλοι» (Revit) στη θέση μας;

---

## 2. ΕΠΑΛΗΘΕΥΜΕΝΗ ΔΙΑΓΝΩΣΗ (πραγματικό grep audit, 2026-06-17)

### 2.1 Το μοντέλο συνέχειας ΥΠΑΡΧΕΙ και είναι σωστό (ADR-459 Φ4c)
`bim/structural/organism/reinforcement-continuity.ts` → `computeOrganismReinforcementContinuity(graph, entities, provider)`:
- **`footing-bearing` (πέδιλο→κολώνα):** αναμονές/**dowels** — `count`=διαμήκεις κολόνας, `diameterMm`, `lengthMm`=anchorage(lbd μέσα στο πέδιλο)+lap(l₀ μάτισμα με κολόνα). + columnDev += lap.
- **`column-bearing` (κολόνα→δοκάρι):** **anchorage** κάτω/άνω ράβδων δοκαριού στον κόμβο (EC8 §5.6.2.2). + beamDev bottom/top.
- **`top-attachment` (κολόνα↔κολόνα ορόφου):** **lap** l₀ αμφίδρομα· κολόνα↔μη-κολόνα host → anchorage (Φ4e/E1).
- Output: `ReinforcementContinuityItem[]` (kind/count/diameterMm/lengthMm/from/to) + per-member `columnDevelopmentMm`/`beamDevelopmentMm` overrides.
- Provider lap/anchorage = ΕΝΑ SSoT (`structural-code-types.ts` → `lapLengthMm`/`anchorageLengthMm`, EC2 §8.4/§8.7).

### 2.2 ΑΛΛΑ το μοντέλο είναι ΟΡΦΑΝΟ — δεν το καταναλώνει σχεδόν κανείς
**Ο ΜΟΝΑΔΙΚΟΣ consumer του `computeOrganismReinforcementContinuity` = `organism/reinforcement-checks.ts`** (validation warnings: λείπει/αναντιστοιχία κόμβου). Δηλαδή υπολογίζεται **μόνο για checks** και πετιέται.

| Συμπεριφορά | Κατάσταση | Απόδειξη (grep) |
|---|---|---|
| **3Δ render joint rebar** | ❌ ΑΝΥΠΑΡΚΤΟ | `bim-3d/converters/{column,beam,footing}-rebar-3d.ts` + `bim-three-structural-converters.ts` έχουν **ΜΗΔΕΝ** reference σε graph/continuity/dowel/anchorage/lap/joint. Αμιγώς **per-member** converters → κάθε κλωβός τελειώνει στο όριο του μέλους. |
| **BOQ/Quantities joint rebar** | ❌ ΔΕΝ μετριέται | ΟΛΟΙ οι callers του `compute{Column,Beam}ReinforcementQuantities` περνούν `continuity=undefined` (schedule-presets.ts:251, column/beam-detail-schedule, column-validator, ribbon bridges) → χρησιμοποιούν το **flat `LONGITUDINAL_LAP_FACTOR=50·Ø`** προσέγγιση. **ΚΑΝΕΝΑ** schedule δεν έχει γραμμή dowel/lap/anchorage/αναμονή (grep κενό). |
| **Per-member ανάπτυξη (lap/anchorage μέσα στο μέλος)** | ⚠️ ΠΡΟΣΕΓΓΙΣΤΙΚΗ | Τα compute **δέχονται** `continuity?` param (`ColumnLongitudinalContinuity`/`BeamLongitudinalContinuity`, αντικαθιστά το 50·Ø με το πραγματικό development) ΑΛΛΑ **κανείς δεν το περνά** → πάντα flat 50·Ø. |

### 2.3 ΑΠΑΝΤΗΣΕΙΣ ΣΤΟΝ GIORGIO
- **«Υπολογίζονται ως ποσότητες;»** → **ΟΧΙ ολοκληρωμένα.** Το per-member μήκος έχει μια χονδρική ανάπτυξη 50·Ø, αλλά οι **πραγματικές αναμονές/ματίσεις/αγκυρώσεις κόμβων ΔΕΝ μετριούνται ως διακριτά steel items** (βάρος/μήκος/διάμετρος/είδος). Το μοντέλο υπάρχει· δεν είναι συνδεδεμένο στο takeoff.
- **«Γιατί δεν φαίνονται 3Δ;»** → Κανένας 3Δ converter δεν διαβάζει το continuity/graph. Αμιγώς per-member.
- **«Πρέπει να φαίνονται;»** → **ΝΑΙ** (Revit-grade — βλ. §3).
- **«Πρόβλημα μόνο προβολής;»** → **ΟΧΙ.** Δύο κενά: (Α) 3Δ προβολή, (Β) takeoff/BOQ. Και τα δύο.

---

## 3. ΤΙ ΘΑ ΕΚΑΝΕ Η REVIT (στόχος)

- **Physical + Analytical Rebar coupling:** κάθε ράβδος = physical element με **hooks / laps / couplers**. Οι **αναμονές πεδίλου→κολόνας (starter bars)** είναι πραγματικές ράβδοι, όχι «εννοούμενες».
- **Rebar Schedule (BS 8666 shape codes):** μετράει **ΚΑΘΕ** ράβδο — incl. αναμονές/ματίσεις/αγκυρώσεις — με `Bar Mark`, `Shape`, `Ø`, `Length`, `No.`, `Total Length`, `Mass (kg)`.
- **Lap/anchorage** κατά EC2 §8.4/§8.7, EC8 §5.6 (το project ΕΧΕΙ ήδη τον provider).
- Στο 3Δ φαίνεται η **επικάλυψη** (δύο παράλληλες ράβδοι στο μήκος μάτισης), η **αναμονή** που βγαίνει από το πέδιλο μέσα στην κολόνα, και το **άγκιστρο** αγκύρωσης του δοκαριού στον κόμβο.

---

## 4. ΠΡΟΤΕΙΝΟΜΕΝΟ ΠΛΑΝΟ (FULL SSOT — reuse, μηδέν διπλότυπα)

> **Φιλοσοφία:** το continuity model = ΗΔΗ το SSoT. Δεν φτιάχνουμε math — **το ΚΑΛΩΔΙΩΝΟΥΜΕ** στους δύο orphan consumers (3Δ + BOQ). Mirror του ADR-458 cutback που είναι **scene-level post-pass** (cross-member geometry ΔΕΝ χωράει σε per-entity cache).

### Workstream A — 3Δ Joint Rebar (cross-member post-pass)
- **Νέο** `bim-3d/converters/joint-rebar-3d.ts` (ή `organism-rebar-3d.ts`): δέχεται `graph` + `OrganismContinuityResult` + entities → παράγει 3Δ meshes για dowels/laps/anchorage hooks στις θέσεις των κόμβων.
- **Reuse:** `rebar-3d-shared.ts` (`buildRods`, `toThree`, `REBAR_MATERIAL`, `MM_TO_M`) — **μηδέν νέα geometry primitives**. Θέσεις/διευθύνσεις από τα member geometries (footprint/axis) που ήδη υπάρχουν.
- **Wiring:** scene-level pass στο `BimToThreeConverter.ts` / `bim-scene-attach-syncs.ts` (έχει πρόσβαση σε ΟΛΑ τα entities) — mirror του cutback post-pass. **Gate** στο υπάρχον `isReinforcementVisible()` (rebar-visibility SSoT).
- **DERIVED, ΠΟΤΕ persisted** (ίδια αρχή με continuity/cutback).

### Workstream B — BOQ / Takeoff Joint Rebar
- **Επιλογή B1 (καθαρότερη Revit-grade):** πρόσθεσε **διακριτές γραμμές** dowel/lap/anchorage στα schedules. Νέο `computeJointReinforcementQuantities(continuityResult)` → ανά item: `lengthM = count·lengthMm·0.001`, `weightKg = lengthM · barMassPerMeterKg(diameterMm)` (**reuse `rebar-catalog.barMassPerMeterKg`** — βάρος SSoT). Feed στα `schedule-presets` + detail-sheet schedules ως ξεχωριστές σειρές («Αναμονές», «Ματίσεις», «Αγκυρώσεις»).
- **Επιλογή B2 (συμπληρωματική):** πέρασε το πραγματικό `columnDevelopmentMm`/`beamDevelopmentMm` στο per-member compute (αντί flat 50·Ø) ώστε και το μήκος του ίδιου του μέλους να γίνει joint-accurate. **ΠΡΟΣΟΧΗ διπλομέτρηση:** αν μπει και B1 (dowel ως ξεχωριστό item) ΚΑΙ B2 (development στο μέλος), μην μετρήσεις το ίδιο μάτισμα δύο φορές — Revit το χρεώνει **μία** φορά (συνήθως στο stalk member). Απόφαση κατανομής = μέρος του design.
- **Συνιστώμενο:** B1 για render+schedule parity (διακριτά «extra» joint bars) και B2 ΜΟΝΟ για τα checks/ratio (ήδη εκεί το χρειάζεται). Επιβεβαίωσε με τον Giorgio.

### Σειρά υλοποίησης (πρόταση)
1. Slice 0: SSoT audit re-confirm + ADR (νέο **ADR-472** «Joint Reinforcement Render & Takeoff» που επεκτείνει ADR-459· **verify το επόμενο ελεύθερο ADR#** — το 471 χρησιμοποιήθηκε ήδη).
2. Slice 1: Workstream A (3Δ render) — το πιο ορατό για τον Giorgio (η εικόνα του).
3. Slice 2: Workstream B1 (joint quantities + schedule lines).
4. Slice 3: 2Δ joint rebar στην κάτοψη/τομή (detail-sheet) + parity με 3Δ.
5. Tests + browser-verify + (Giorgio) commit.

---

## 5. SSoT INVENTORY — ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΑ (ΜΗΝ ΔΙΠΛΑΣΙΑΣΕΙΣ)

| Ανάγκη | Υπάρχον SSoT |
|---|---|
| Μοντέλο κόμβων (dowel/lap/anchorage, count/Ø/length) | `bim/structural/organism/reinforcement-continuity.ts` → `computeOrganismReinforcementContinuity` |
| Στατικός graph (nodes/edges, edge.kind) | `bim/structural/organism/structural-graph.ts` + `structural-organism-types.ts` |
| Lap/anchorage μήκη (EC2/ΕΚΩΣ) | provider `bim/structural/codes/*` → `lapLengthMm`/`anchorageLengthMm` |
| 3Δ ράβδοι/άγκιστρα geometry | `bim-3d/converters/rebar-3d-shared.ts` → `buildRods`, `toThree`, `REBAR_MATERIAL` |
| Per-member 3Δ rebar (πρότυπο) | `bim-3d/converters/{column,beam,footing}-rebar-3d.ts` |
| Βάρος ανά Ø (kg/m) | `bim/structural/rebar-catalog.ts` → `barMassPerMeterKg` |
| Per-member quantities (length/weight fields) | `*-reinforcement-compute.ts` → `compute*ReinforcementQuantities` (δέχονται ήδη `continuity?` param!) |
| Schedules/BOQ | `bim/schedule/schedule-presets.ts`, detail-sheet `*-schedule.ts` |
| Visibility gate οπλισμού | `bim/structural/reinforcement/rebar-visibility.ts` → `isReinforcementVisible` |
| Active (store-aware) reinforcement | `bim/structural/section-context.ts` → `resolveActive*Reinforcement` |
| Scene assembly 3Δ (post-pass hook point) | `bim-3d/converters/BimToThreeConverter.ts`, `bim-3d/scene/bim-scene-attach-syncs.ts` |

---

## 6. ΑΡΧΙΤΕΚΤΟΝΙΚΗ / ΚΑΝΟΝΕΣ
- **ADR-459** = ο home του οργανισμού (Φ4c = continuity model). Νέα δουλειά = νέο **ADR-472** (επεκτείνει 459) ή νέα φάση 459 — verify ελεύθερο #.
- **ADR-040 / CHECK 6B-6D:** αν αγγίξεις 2Δ canvas-drawing αρχεία (DxfRenderer, renderers) → staged ADR. Το 3Δ (`bim-3d/`) είναι εκτός micro-leaf, αλλά πρόσεξε τα scene attach syncs.
- **N.15:** ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR changelog + adr-index στο ίδιο commit.
- **N.17:** ΕΝΑ tsc τη φορά (έλεγξε running πριν).
- **Shared tree:** `git add` ΜΟΝΟ δικά σου. Ο άλλος agent γράφει αυτή τη στιγμή `bim/structural/detail-sheet/beam-detail-sheet.ts` (ADR-471) — **ΜΗΝ το αγγίξεις** (είχε 3 transient tsc errors από signature change region-builders).
- **Μονάδες:** 3Δ structural converters = plan XY σε **canonical-mm** → `× sceneToM` (sceneUnitsToMeters)· vertical mm → `× MM_TO_M`. Invariant στο `bim-three-structural-converters.ts` σχόλιο.

## 7. ΑΝΟΙΧΤΕΣ ΑΠΟΦΑΣΕΙΣ (ρώτα Giorgio ή πάρε Revit-grade απόφαση + ζήτα έγκριση plan)
- B1 vs B2 κατανομή μάτισης (αποφυγή διπλομέτρησης — Revit: μία φορά).
- Πλήρες physical-rebar (κάθε ράβδος ξεχωριστή, hooks/laps) vs απλοποιημένο joint-overlay (ένα group ανά κόμβο). Πρόταση: ξεκίνα overlay (γρήγορο visual win), εξέλιξε σε per-bar.
- 2Δ προβολή κόμβων (Slice 3) — μετά το 3Δ.

## 8. ΓΡΗΓΟΡΟ REPRO
`/dxf/viewer` → όροφος με «Π»-πύλη (2 κολώνες + δοκάρι + 2 πέδιλα, αυτόματος οπλισμός ON) → 3Δ (BIM 3D toggle) → παρατήρησε ότι οι κλωβοί δεν συνδέονται στους κόμβους. Στόχος μετά: αναμονές/ματίσεις/αγκυρώσεις ορατές + στο schedule.
