# ADR-534 — Αυτόματη πλάκα οροφής ανά φάτνωμα (Auto-Ceiling-Slab per Structural Bay)

**Status:** ✅ APPROVED (Φάση 1 implemented, UNCOMMITTED) · **Date:** 2026-06-26
**Type:** Feature (DXF/BIM Viewer — slab discipline). Revit/ETABS-grade, μονολιθική πλακοδοκός.
**Builds on:** ADR-441 (slabs from grid · `buildSlabBaysFromGuides`) · ADR-528/529 (beam auto-span) · ADR-436 (slab discipline) · ADR-369 (elevation convention)
**Related:** ADR-507 (hatch room detection) · ADR-423/424 (space recognition) · ADR-420 (floor finishes — mirror target για Φ4)

---

## 1. Πρόβλημα / Ζητούμενο (Giorgio 2026-06-26)

Ο μηχανικός τοποθετεί κολόνες + δοκάρια (freehand, ADR-528/529). Τα τεμνόμενα δοκάρια δημιουργούν
**φατνώματα** (bays). Ζητείται **αυτόματη πλάκα οροφής**, **ομοεπίπεδη στην κορυφή των δοκαριών**
(μονολιθική κατασκευή), **μία πλάκα ανά φάτνωμα** — όπως το συνεχές δοκάρι = N δοκάρια ανά άνοιγμα.

## 2. Μηχανική απόφαση (EC2/EC8 — επίσημη πρακτική)

**Μονολιθική πλακοδοκός (T-beam, EC2 §5.3.2.1):** σε χυτό RC, πλάκα + δοκάρια χύνονται μαζί →
**πάνω όψη πλάκας = πάνω όψη δοκαριού** = στάθμη ορόφου. Η πλάκα είναι το **θλιβόμενο πέλμα** του
δοκαριού (effective flange `b_eff`). Το ολικό ύψος δοκαριού `h` περιλαμβάνει την πλάκα· το ορατό
downstand κάτω από την πλάκα = `h − t_slab`. Το δοκάρι ΔΕΝ μεγαλώνει σε `h + t_slab`.

**«Ενιαία» πλάκα ≠ σταθερό πάχος:** η ενότητα είναι η μονολιθική **συνέχεια** (σκυρόδεμα + οπλισμός
πάνω από τα δοκάρια). Διαφορετικό πάχος ανά φάτνωμα (EC2 §7.4.2 l/d) είναι θεμιτό: **πάνω όψη
ομοεπίπεδη**, το πάχος επεκτείνεται **προς τα κάτω** (το **soffit κάνει σκαλοπάτι στη γραμμή του
δοκαριού**). Big players: SAFE/ETABS = slab-property zones ανά area· Revit = floor elements ανά
περιοχή. → **Per-bay μοντέλο** (μία πλάκα ανά φάτνωμα, κοινή κορυφή, συνέχεια στα δοκάρια).

## 3. Λύση — Φασικό roadmap

| Φάση | Περιεχόμενο | Κατάσταση |
|------|-------------|-----------|
| **Φ1** | **Auto-πλάκα οροφής ανά φάτνωμα** (ανίχνευση από δοκάρια+κολόνες, flush top, ενιαίο πάχος) | ✅ **IMPLEMENTED** (αυτό το ADR) |
| Φ2 | Per-bay auto-**πάχος** (EC2 §7.4.2 l/d δίεδρη/αμφιέρειστη/συνεχής· extend `suggestSlabThickness`) | DEFER |
| Φ3 | Monolithic σύζευξη (BOQ **net-of-overlap** + T-beam `b_eff` + soffit step) | DEFER |
| Φ4 | Per-bay **ceiling finishes** (mirror `floor-finishes`: μπλε/κίτρινο/σπατουλαριστό/σοβάς) | DEFER |

## 4. Φάση 1 — Υλοποίηση (room-based, FULL SSoT reuse)

**ΚΡΙΣΙΜΟ (root fix v2):** οι τοίχοι/περίμετρος μιας κάτοψης είναι συνήθως **DXF γραμμές** (από αρχείο
DXF), ΟΧΙ BIM οντότητες. → Ανίχνευση δωματίων με τον **ΙΔΙΟ proven μηχανισμό** της γραμμοσκίασης /
θερμαινόμενων χώρων (ADR-507 Φ3), που διαβάζει DXF γραμμές:

1. **Segments = `extractLineSegments(entities, {tessellateCurves})`** — DXF γραμμές + πολυγραμμές +
   separators + καμπύλα. **Τα δοκάρια/κολόνες ΔΕΝ μπαίνουν** → καμία λωρίδα-πάνω-σε-δοκάρι.
2. **`findClosedPolygonsFromLines(segments, mergeTol, 0)`** — half-edge planar faces = ο ΣΩΣΤΟΣ room
   detector (`auto-area-geometry`). `mergeTol = resolveRegionLoopTolWorld(sceneUnits)` (SSoT).
3. **Φίλτρο λωρίδων τοίχων:** ο διαμερισμός δίνει ΚΑΙ τα λεπτά faces ανάμεσα στις διπλές γραμμές
   τοίχων· κόβονται με **υδραυλικό πλάτος** `2·area/perimeter < MIN_ROOM_WIDTH (350mm)` + ελάχ. εμβαδόν.
4. **Flush top:** `levelElevation = max(beam.topElevation)` → ομοεπίπεδα με την κορυφή των δοκαριών.
5. **Δημιουργία:** `completeSlabFromPolygonClicks(room, layerId, {kind:'ceiling', levelElevation}, …)`
   (SSoT slab builder)· `kind='ceiling'` ήδη έγκυρο· persistence/render/3D αμετάβλητα.
6. **Trigger:** ribbon action **«Πλάκα οροφής (auto)»** (Δομικά → Πλάκες· one-shot, idempotent by
   room centroid). `commitCeilingSlabsFromStructure` → `CreateSlabsCommand` (undoable).

**Αρχεία (Φ1):** NEW `bim/slabs/ceiling-slab-from-structure.ts` (room detection + builder) · NEW
`bim/slabs/ceiling-slab-commit.ts` (orchestrator, idempotent) · `slab-command-keys.ts`
(+`fromStructureCeiling`) · `useRibbonSlabBridge.ts` (handler) · `structural-tab.ts` (κουμπί) · i18n el/en.
(Το `slab-from-grid.ts` πήρε internal refactor — `regionMinusSubtrahends` εξαγωγή από `bayOutline` — που
έμεινε αν και το ceiling δεν το χρησιμοποιεί πλέον.)

**DEFER:** beam-subdivision (δωμάτιο → δομικά φατνώματα από άξονες δοκαριών)· holes/αίθρια· gap-bridging
για πόρτες (gapTol=0 → κλειστοί βρόχοι). Sliver filter = heuristic (browser-verify/tunable).

## 5. Επαλήθευση
- **jest:** `ceiling-slab-from-structure` (4 φατνώματα 12×12 σκηνή Giorgio· flush top· no-footprint) +
  `ceiling-slab-commit` (idempotency: 1η→4, 2η→0 up-to-date) + `slab-from-grid`/`slab-grid-commit`
  regression GREEN (το `bayOutline` refactor). ts-jest (N.17).
- **Firestore MCP:** μετά το action → query `floorplan_slabs` → N docs `kind:'ceiling'`,
  `levelElevation == beam.topElevation`.
- **Browser (Giorgio):** η σκηνή των screenshots → «Πλάκα οροφής (auto)» → πλάκες ομοεπίπεδες στην
  κορυφή των δοκαριών σε 3D, μία ανά φάτνωμα.

## 6. Changelog
- **2026-06-26 (§monolithic-cut — καθαρό 3D, μηδέν z-fighting)** — Giorgio: η πλάκα φτάνει σωστά στην
  εξωτερική παρειά & καλύπτει δοκάρια/κολόνες (T-beam, σωστό), αλλά στο 3D «παλεύουν τα χρώματα» (z-fighting:
  beam top == slab top == 3000 → επικάλυψη όγκων). **Fix (render-only, Revit «Join Geometry»):** το ορατό 3D
  στερεό δοκαριού/κολόνας **κόβεται στο soffit της καλύπτουσας πλάκας** (`levelElevation − thickness`) → η
  πλάκα καπακώνει καθαρά, κρέμεται το downstand κάτω, μηδέν z-fighting. **Δομικό ύψος αμετάβλητο** (η πλάκα =
  πέλμα). **FULL SSoT reuse:** `slabHostInput` (soffit) + `hostUndersideAt` (point-in-slab) — οι ΙΔΙΕΣ που
  κόβουν ΗΔΗ τις attached κολόνες. NEW `bim-3d/scene/monolithic-slab-clip.ts` (`buildCeilingSlabHosts` +
  `resolveMemberTopClipZmm`)· `beamToMesh`/`columnToMesh` += optional `clipTopZmm` (box-extrude / flat+attached
  paths· no-op όταν δεν δοθεί → byte-for-byte)· wiring σε `BimSceneLayer.syncBeams` + `bim-scene-attach-syncs.
  syncColumns`. 5 helper + 73 converter regression GREEN. **DEFER:** BOQ net-of-overlap· finish/rebar exact
  clip· I-shape steel clip. 🔴 browser-re-verify (stage ADR-040+534 — CHECK 6B/6D 3D converters).
- **2026-06-26 (v4 — DXF+BIM combined, ΕΝΙΑΙΟ περίγραμμα)** — **Browser-verify v3:** «no-footprint» toast.
  **Ρίζα (Firestore-verified):** το δομικό πλαίσιο του Giorgio **ΔΕΝ κλείνει** μόνο από δοκάρια+κολόνες —
  η **πάνω πλευρά δεν έχει δοκάρι** (κενό ~4.85m ανάμεσα στην πάνω-αριστερή & πάνω-δεξιά κολόνα)· κλείνει
  από **DXF τοίχο**. Το v3 (`computeBuildingFootprint`, μόνο BIM) δεν την έβλεπε → κανένα hole. **Giorgio:
  πώς να χειριστούμε DXF+BIM συνύπαρξη;** **Fix v4:** ΕΝΑ γράφημα ακμών = **DXF γραμμές + ΑΚΜΕΣ δοκαριών/
  κολόνων** → `findClosedPolygonsFromLines` (gap-bridging πορτών) → όλα τα faces → **`safeUnion`** → **ΕΝΙΑΙΟ
  περίγραμμα κτιρίου** (outer ring κάθε union polygon, γεμάτο). Έτσι: πλευρά-DXF + πλευρά-δοκάρι κλείνουν
  μαζί· εσωτερικά χωρίσματα + τόξα πορτών **διαλύονται**· η πλάκα καλύπτει & τα δομικά μέλη (μονολιθικά).
  Φίλτρο **υδραυλικού πλάτους** (≥600mm) κόβει μεμονωμένα δοκάρια (thin strips). Tests: καθαρό πλαίσιο→1,
  **μικτό 3 DXF + 1 δοκάρι→1**, DXF+χώρισμα→1 (διαλυμένο), single beam→no-bays. 7 ceiling + 25 slab GREEN.
  🔴 browser-re-verify. **DEFER:** υποδιαίρεση σε φατνώματα από **εσωτερικά** δοκάρια (τώρα→ΕΝΙΑΙΑ).
- **2026-06-26 (v3 — οριστική προδιαγραφή Giorgio)** — **Browser-verify v2:** κάλυψε ΜΟΝΟ το ένα δωμάτιο
  (το άλλο είχε ευθύ άνοιγμα πόρτας) + ακολούθησε τόξα πορτών. **Οριστική προδιαγραφή Giorgio:** η
  ανίχνευση πρέπει να γίνεται από την **ύπαρξη/θέση ΔΟΚΑΡΙΩΝ & ΚΟΛΩΝΩΝ** (+ τοιχία), ΟΧΙ από DXF γραμμές·
  **ΕΝΙΑΙΑ** πλάκα όσο δεν διακόπτεται από δομικό μέλος· DXF εσωτερικοί τοίχοι + τόξα πορτών **αγνοούνται**.
  **Fix:** χρήση των **`computeBuildingFootprint(walls, columns, beams).holes`** = τα **εσωτερικά κενά** που
  περικλείει το δομικό πλαίσιο. 1 hole (καμία εσωτερική διακοπή) → 1 ΕΝΙΑΙΑ πλάκα· εσωτερικά δοκάρια/τοιχία
  → N holes = N φατνώματα (το union τα διαχωρίζει). Μόνο BIM μέλη μετράνε → DXF/πόρτες αγνοούνται by
  construction. Tests ξαναγράφτηκαν: περιμετρικό→1, σταυρός→4, single beam→no-bays, DXF-only→no-bays. 7
  ceiling + 25 slab regression GREEN. 🔴 browser-re-verify. **DEFER:** εξωτερική-παρειά επέκταση (κάλυψη &
  των δοκαριών — τώρα φτάνει στο εσωτερικό κενό).
- **2026-06-26 (v2 — root fix)** — **Browser-verify v1 ΑΠΕΤΥΧΕ:** οι πλάκες έβγαιναν **λεπτές λωρίδες
  ΠΑΝΩ στα δοκάρια** αντί να σκεπάζουν τα δωμάτια (Firestore-verified: 5 slabs με outline = beam strips
  210/200/188mm). **Ρίζα:** η περίμετρος/τοίχοι ήταν **DXF γραμμές**, αλλά το `computeBuildingFootprint`
  βλέπει **μόνο BIM** δοκάρια/κολόνες → το «αποτύπωμα» ήταν το πλαίσιο δοκαριών. **Fix:** μετάβαση σε
  **room detection** (`extractLineSegments` → `findClosedPolygonsFromLines`, ο ΙΔΙΟΣ μηχανισμός με τη
  γραμμοσκίαση· διαβάζει DXF γραμμές, ΟΧΙ δοκάρια) + sliver filter (υδραυλικό πλάτος). Builder signature
  `(entities, …)`. Tests ξαναγράφτηκαν: 1 δωμάτιο→1 πλάκα, διπλός τοίχος→2 (λωρίδα φιλτράρεται),
  beam-only→no-rooms (το v1 bug). 6 ceiling + 25 slab regression GREEN. 🔴 browser-re-verify + undo των 5
  λάθος v1 slabs.
- **2026-06-26 (v1)** — **Φ1 IMPLEMENTED (UNCOMMITTED).** Bay detection member-based (computeBuildingFootprint
  ΜΕΙΟΝ εσωτερικά δοκάρια+κολόνες, εξωτερική ακμή = εξωτερική παρειά)· flush top = beam.topElevation·
  `kind='ceiling'`· ribbon action «Πλάκα οροφής (auto)». **SSoT extraction:** `regionMinusSubtrahends`
  + `collectSubtrahends` εξήχθησαν από `bayOutline` (κοινά grid + ceiling). **Bug fix (cut bridge):**
  εσωτερικοί κόπτες επεκτείνονται πέρα από το όριο ώστε να κόβουν πλήρως τα φατνώματα (τα περιμετρικά
  δοκάρια προεξέχουν → 125mm γέφυρα κρατούσε 1 region). Tests: ceiling-slab-from-structure (3) +
  ceiling-slab-commit (3) + slab-from-grid/grid-commit regression (25) GREEN. ⚠️ Προϋπάρχον (HEAD)
  failing test: `structural-tab` type-88 (`type:'dropdown'` του ADR-521 column-types — άλλος agent, ΟΧΙ
  αυτή η αλλαγή). 🔴 browser-verify + Firestore re-check + commit (Giorgio· stage ADR-534 + adr-index +
  ADR-436 pointer). DEFER Φ2-4.
