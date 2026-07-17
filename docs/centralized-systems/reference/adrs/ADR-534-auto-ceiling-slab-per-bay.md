# ADR-534 — Αυτόματη πλάκα οροφής ανά φάτνωμα (Auto-Ceiling-Slab per Structural Bay)

**Status:** ✅ APPROVED (Φάσεις 1+2+3a+3b+4 implemented, UNCOMMITTED) · **Date:** 2026-06-26
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
| **Φ2** | **Υποδιαίρεση σε φατνώματα** (άξονες εσωτ. δοκαριών/τοιχίων) + per-bay **πάχος** (EC2 §7.4.2 l/d) | ✅ **IMPLEMENTED** (UNCOMMITTED) |
| **Φ3a** | BOQ **net-of-overlap** σκυροδέματος (πλάκα αφαιρεί `∩×min(beamDepth,slabThk)`) | ✅ **ΗΔΗ** (υπό ADR-363 §5.5i+) |
| **Φ3b** | T-beam **`b_eff`** (EC2 §5.3.2.1) — section property + report + flexural-cap (sagging→b_eff) | ✅ **IMPLEMENTED** (COMMITTED) |
| **Φ3c-A** | `b_eff` read-only γραμμή στο **αριστερό panel** δοκού (Revit instance property) | ✅ **IMPLEMENTED** (COMMITTED aa1a0cd0) |
| **Φ3c-B1** | **Live organism injection** του `b_eff` (`BeamFlangeStore`) → ρ/οπλισμός panel+2Δ/3Δ/PDF καταναλώνουν b_eff | ✅ **IMPLEMENTED** (UNCOMMITTED) |
| **Φ3c-B2** | Edge/L-beam detection (`flangeSides:1` — πλάκα μία πλευρά → περιμετρική δοκός) | ✅ **IMPLEMENTED** (UNCOMMITTED) |
| **Φ3c-B3a** | Soffit **rebar** clip 3Δ (ο κλωβός οπλισμού κόβεται στο soffit, μηδέν προεξοχή στην πλάκα) | ✅ **IMPLEMENTED** (UNCOMMITTED) |
| **Φ3c-B3b** | Soffit **finish/σοβάς** clip 3Δ — **δοκάρια** (ενιαίος σοβάς silhouette) | ✅ **IMPLEMENTED** (UNCOMMITTED) |
| **Φ3c-B3b′** | Soffit **finish/σοβάς** clip 3Δ — **ΤΟΙΧΟΙ** (κάθετος silhouette **+** `hup` top-cap) | ✅ **IMPLEMENTED** (UNCOMMITTED) |
| Φ3c-B3c | I-shape **steel** beam soffit clip (μεταλλική σαρωμένη) + **tilted** per-element σοβάς clip | DEFER (σπάνιοι συνδυασμοί) |
| **Φ4** | Per-bay **ceiling finishes** στο soffit (μπλε/κίτρινο/σπατουλαριστό/σοβάς, Revit RCP) | ✅ **IMPLEMENTED** (UNCOMMITTED) |
| **Φ5** | **Ο σοβάς της ΠΛΑΚΑΣ** ως finish-member (soffit `down` + ενιαίο top-cap `up` + **περιμετρική φάσα** silhouette, associative, id-based self-exclusion) | ✅ **Φ5a+Φ5b+Φ5c IMPLEMENTED** · Φ5d (BOQ) DEFER |

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

- **2026-07-18 (Φ7b — TRUE 45° MITER ΣΤΙΣ ΓΩΝΙΕΣ: αντικαθιστά το overlap corner-join του Φ7)** — Giorgio
  (C4D 234109): «στις κάθετες ακμές του κτιρίου η γωνία σοβατίζεται **ΔΙΠΛΑ** (και από τις δύο όψεις)».
  **Root cause:** το Φ7 corner-join (`buildFaceProfiles` `EndExtend`) επέκτεινε **ΚΑΙ ΤΙΣ ΔΥΟ** κάθετες
  όψεις κατά το πάχος στο junction → τα δύο (t,z) profiles έκαναν overlap σε τετράγωνο ~πάχος×πάχος →
  coincident faces (z-fighting) + διπλό πάχος στη γωνία. **DIAGNOSTIC (measure-not-guess, jest):** L-γωνία
  25mm → μετρήθηκε **~312mm²** επικάλυψη plan footprints (`structural-finish-corner-overlap-diag.test.ts`).
  **Απόφαση Giorgio: Λ-Β true 45° miter** (Revit «Miter» join, έναντι Λ-Α butt / Λ-Γ offset-ring).
  **FOUNDATION (measured):** τα strips **ήδη φέρουν** την κοινή mitered κορυφή στο junction (south.bOuter =
  east.aOuter = tip· από `computeMiteredOuter`, extended κατά τον άξονα ΠΕΡΑ από το core t-span) — το Φ7
  απλώς τα πετούσε. **FIX (additive, reuse-only):** (1) αφαιρέθηκε η γωνιακή επέκταση — το welded body
  τελειώνει στο **core-length** (`stripRectM` χωρίς `ext`· διαγράφηκαν `EndExtend/groupEnds/isCornerEnd`).
  (2) NEW `collectMiterWedges` (pure SSoT): ανά junction-end παράγει ένα **miter τρίγωνο** `[core, core+
  πάχος·perp, tip]` × z-range, αντλώντας το `tip` **αυτούσιο** από τα `aOuter/bOuter`· το outward normal
  προκύπτει από το `dir` (ΟΧΙ `group.perp`, που είναι διαγώνιο σε κοντές όψεις λόγω `outwardPerpOf`
  mid-points). Δύο γειτονικές όψεις → δύο τρίγωνα εκατέρωθεν της διαγωνίου core→tip → **πλήρες τετράγωνο,
  μονή κάλυψη, μηδέν overlap, μηδέν κενό, διαγώνιος αρμός 45°**. (3) 3Δ: `buildFinishSkinFromStripGroups`
  εξωθεί τα wedges ως τριγωνικά prisms μέσω του **ίδιου** `stripPrismGeometry`/`addFinishPrism` SSoT
  (guard `<4`→`<3`· `stripPrismGeometry` δέχεται ήδη ≥3). **Files:** MOD `structural-finish-face-profile.ts`
  (−`EndExtend/groupEnds/isCornerEnd/cross`, +`MiterWedge`/`collectMiterWedges`), MOD `structural-finish-3d.ts`
  (+`addMiterWedge` + wedge loop· guard <3). **Tests:** face-profile CORNER case → body core-length (0.1 όχι
  0.125)· NEW/repurposed `structural-finish-corner-overlap-diag.test.ts` (body overlap→0· 2 wedges→κοινή
  κορυφή (125,-25)· free-end→0 wedges). **304/304 finishes + 3D finish GREEN**, jscpd καθαρό, tsc SKIP (N.17).
  **ΕΚΤΟΣ ADR-040** (pure finish geometry + converter· 2Δ outline αναλλοίωτο — ήδη mitered). **✅ Google-level:
  YES** — big-player miter, reuse του υπάρχοντος `computeMiteredOuter` (μηδέν νέο miter math), additive/χαμηλό
  regression risk, diagnostic-first. 🔴 C4D-verify (Giorgio) + commit. **hup ΠΑΡΑΜΕΝΕΙ** (ξεχωριστό — §Φ7b hup).
  | Opus
- **2026-07-18 (Φ7 — UNIFIED WELDED ΔΕΡΜΑ ΑΝΑ ΟΜΟΕΠΙΠΕΔΗ ΟΨΗ: μηδέν εσωτερική ραφή πρόσοψης)** — Giorgio
  (C4D OBJ + 3Δ): κάθετες + οριζόντιες ραφές σοβά στην πρόσοψη ΠΑΡΕΜΕΙΝΑΝ μετά το Φ6a (tolerance). **Root
  cause (grep+diagnostic-verified, ΟΧΙ tolerance):** ο 3Δ builder εξωθούσε **ΕΝΑ κλειστό prism ΑΝΑ
  `FinishStrip`**. Μια ομοεπίπεδη πρόσοψη με ανοίγματα/βήματα αποσυντίθεται (`mergeSilhouetteBandsToStrips`)
  σε ΠΟΛΛΑ ορθογώνια strips (μη-ορθογώνια περιοχή = «Π» γύρω από παράθυρο ΔΕΝ γίνεται ΕΝΑ strip) → τα
  πλευρικά side-faces δύο γειτονικών prisms = οι ραφές. **DIAGNOSTIC (predict-then-measure, jest):** πρόσοψη
  300mm + 1 παράθυρο + φάσα → **4 strips → 4 prisms → 4 εσωτερικές coplanar ραφές** (ΚΑΜΙΑ πραγματικό όριο).
  Απέδειξε ότι **Λ1 (merge strips) ΑΔΥΝΑΤΟΝ** να τις σβήσει (irreducible ορθογώνιο tiling του «Π» ≥3), και z-drift
  μελών (κολόνα vs τοίχος z-extent) δίνει επιπλέον spurious κάθετη ραφή. **Λύση Λ2b (big-player — Revit «join
  geometry» / C4D weld), Giorgio «το καλύτερο/πιο επαγγελματικό/μέγιστη ευελιξία»:** ανά **ομοεπίπεδη όψη**
  ενώνουμε τα (t×z) ορθογώνια των strips σε ΕΝΑ πολύγωνο **με τρύπες** (τα ανοίγματα) στο τοπικό κατακόρυφο
  επίπεδο, και εξωθούμε **ΜΙΑ φορά** κατά το πάχος (outward perp) → ΕΝΑ συνεχές welded δέρμα, μηδέν εσωτερικό
  τοίχωμα. Ραφή μένει ΜΟΝΟ σε πραγματικό όριο (γωνία = άλλο group, αλλαγή υλικού/χρώματος = άλλο bucket,
  άνοιγμα = τρύπα). Απορροφά ΚΑΙ το z-drift (το (t,z) union weld σβήνει και την κάθετη spurious ραφή).
  **Corner-join (Giorgio C4D 234109 — «στις γωνίες οι κάθετες ακμές δεν ενώνονται»):** κάθε όψη
  εξωθείται στο δικό της perp → στη γωνία δύο κάθετων όψεων έμενε ακάλυπτο τετράγωνο ~πάχος×πάχος. FIX:
  `buildFaceProfiles` ανιχνεύει τα **junction άκρα** (άκρο κοντά σε ΜΗ-παράλληλη γειτονική όψη) και
  επεκτείνει εκεί το (t,z) profile κατά το πάχος → τα outer bands κάνουν overlap → η γωνία γεμίζει
  (Revit «join geometry»). Ελεύθερα άκρα → καμία επέκταση (μηδέν nub)· collinear αλλαγή υλικού → καμία
  (η ραφή υλικού μένει).
  **hup (Giorgio C4D 234109 «Wall_structural-finish-hup- δεν χρειάζεται»):** model-verified (Firestore
  proj_5a495bad — ceiling slab outline = ΑΚΡΙΒΩΣ η περίμετρος → οι τοίχοι καλύπτονται πλήρως, σωστά
  σβήνουν) ότι το `hup` ήταν αποκλειστικά οι **ΠΑΝΩ όψεις ΠΛΑΚΩΝ** (δάπεδο z=0 + οροφή z=3000). Μια πάνω
  όψη πλάκας ΔΕΝ σοβατίζεται (δάπεδο→screed, δώμα→μόνωση). FIX: αφαιρέθηκε η συνεισφορά **πλακών** από το
  `computeMergedStructuralTopCap` (αναιρεί μερικώς το Φ5 slab-up)· οι πλάκες κρατούν ΜΟΝΟ το soffit
  (`down`→`hslab`, η οροφή)· εκτεθειμένες κορυφές τοίχων/κολόνων/δοκαριών (parapet/pilotis) μένουν.
  MOD `structural-finish-scene-horizontal.ts` + update slab-soffit test. **FULL
  SSoT, reuse-only:** `mergeSilhouetteBandsToStripGroups` (νέο grouped API· το flat `mergeSilhouetteBandsToStrips`
  = `groups.flatMap` → **byte-for-byte** για DXF/BOQ)· `safeUnion` (polygon-clipping SSoT) για την ένωση·
  `THREE.ExtrudeGeometry` με holes + matrix (t,z,u)→world (ίδια `ROT_X_NEG_90` σύμβαση). **Files:** NEW
  `structural-finish-face-profile.ts` (pure: `FinishStripGroup` → (t,z) profile με τρύπες), NEW
  `bim/geometry/shared/polygon-clipping-ring.ts` (SSoT `pairRingToPt2`/`pt2SignedArea`/`pt2FootprintToClipPolygon`
  — κεντρικοποίηση **προϋπάρχοντος** τριπλού clone finishes silhouette/horizontal/face-profile, N.0.2 boy-scout).
  MOD `structural-finish-vertical-merge.ts` (+`FinishStripGroup`/`...StripGroups`), `structural-finish-3d.ts`
  (+`buildFinishSkinFromStripGroups` + extracted `finalizeFinishMesh` κοινό με `addFinishPrism` → μηδέν clone·
  **αφαιρέθηκε dead `buildFinishSkinFromStrips`**), `structural-finish-silhouette-3d.ts` (wire → grouped),
  `structural-finish-silhouette.ts` + `structural-finish-horizontal.ts` (χρήση SSoT ring utils). **Tests:** NEW
  `structural-finish-face-profile.test.ts` (παράθυρο→1 profile/1 πολύγωνο/1 τρύπα), NEW
  `structural-finish-silhouette-3d.test.ts` (πρόσοψη+παράθυρο→**1 mesh** όχι 4, non-pickable, baseElevation baked),
  NEW `structural-finish-facade-seam-diagnostic.test.ts` (ground-truth μέτρηση). **258/258 finishes + 28/28 3D
  finish GREEN**, DXF collector byte-for-byte, jscpd καθαρό. tsc SKIP (N.17). **ΕΚΤΟΣ ADR-040** (pure finish
  geometry + converter). **✅ Google-level: YES** — surface-level weld (big-player), ΟΧΙ fragile strip-merge· ΕΝΑ
  SSoT profile· DXF/BOQ αναλλοίωτα· diagnostic-first (measured, όχι εικασία). 🔴 browser/C4D-verify (Giorgio) +
  commit. | Opus
- **2026-07-18 (Φ6a — SEAMLESS δέρμα: tolerance coplanar merge· UNCOMMITTED)** — Giorgio (C4D 213613):
  «ΚΑΙ κάθετες ΚΑΙ οριζόντιες ραφές στην πρόσοψη». Ζητούμενο: ένα αδιάσπαστο δέρμα (Revit/ArchiCAD).
  - **RECOGNITION (ground-truth repro) — η υπόθεση handoff «λείπει ο merge στη ζώνη πλάκας» ΑΝΑΤΡΑΠΗΚΕ:**
    repro απέδειξε ότι ο `mergeSilhouetteBandsToStrips` **ΗΔΗ** ενώνει τοίχο+φάσα σε ΜΙΑ λωρίδα `[0,3000]`
    **όταν** *ακριβώς* ομοεπίπεδα + ίδιο spec. Root cause: το κλειδί ομαδοποίησης απαιτούσε **τέλεια**
    ομοεπιπεδότητα (`perpOff` @1e-3mm)· η πραγματική γεωμετρία έχει μικρά offsets (outline πλάκας vs
    footprint τοίχου· σχεδόν-συνευθειακοί τοίχοι) → διαφορετικό κλειδί → ραφή (κάθετη ΚΑΙ οριζόντια).
  - **Fix — `structural-finish-vertical-merge.ts` two-pass cluster-then-decompose:** super-key (angle/side/
    υλικό/κατάταξη/πάχος/χρώμα) + clustering του `perpOff` εντός `COPLANAR_MERGE_TOL_MM`. **Relative metric**
    ως προς άξονα anchor (`dot(aCore−ref.aCore, refPerp)` — ΟΧΙ απόλυτος perpOff· σε building coords ×10⁴mm
    το ANG_TOL μεγεθύνεται ~20mm θόρυβο)· **anchor-min clustering** (κανένα chaining)· `toRect` με **κοινό
    άξονα** anchor (συνεπή t → z-stack merge). Κάτω από το `CoplanarGroup` = byte-for-byte αμετάβλητο.
  - **⚠️ Απόφαση ανοχής (deviation από εγκεκριμένο plan 25→5mm):** integration BOQ-ταυτότητα test
    (κολόνα+δοκάρι 20mm apart) απέδειξε ότι **25mm ενώνει πραγματικό σκαλί 20mm** (t-γειτονικές όψεις →
    `coreAt` corruption ×3000 ύψος → επιφάνεια +12k). **5mm** = γεφυρώνει μόνο numerical drift (sub-mm έως
    λίγα mm), κρατά ραφή σε ≥~1-2cm structural jogs. **Tunable** (doc στο const): αν C4D δείξει φάσα >5mm
    (μη-flush) αυξάνεται ΜΟΝΟ αφού επιβεβαιωθεί ότι δεν σπάει BOQ-ταυτότητα. Tests: 4 νέα (drift<τ→1 strip·
    σκαλί>τ→2· αλλαγή υλικού→2· anchor no-chaining). File 244→323 (<500), μηδέν clones.
  - **⚠️ ΟΠΤΙΚΟ ΑΝΕΠΑΛΗΘΕΥΤΟ — C4D έλεγχος Giorgio:** αν οι ραφές μένουν → offset>5mm ή spec-mismatch →
    pivot (αύξηση ανοχής / source-side snap· ο tolerance μηχανισμός μένει χρήσιμος).
- **2026-07-18 (Φ6b — PAINT on face ΚΑΙ στην πλάκα· UNCOMMITTED)** — Revit «Paint» per-face overrides
  δουλεύουν πλέον σε πλάκα, σε **3 σημεία** που διαβάζουν ΟΛΑ το ΙΔΙΟ `params.outline.vertices` (συνεπές
  `finishFaceRef`): (1) render split — `structural-finish-scene-silhouette.ts` slab loop στο
  `pushFinishOverrideEdges`· (2) 2Δ picker — `finish-pick-scene.ts` `isSlabEntity` branch (`params.outline`,
  όχι `geometry.footprint`)· (3) writer — `SetFinishFaceOverrideCommand` resolve `params.outline`. Seamless
  (Φ6a) ΔΕΝ συγκρούεται: το override ζει στο super-key → σπάει το cluster στο σύνορο υλικού (test (c) Φ6a).
  Tests: picker (slab paintable / no-finish skip) + command (params.outline → side:0). Verify: 552 finish
  tests GREEN. (Τοίχοι = follow-up· ο command/picker δεν λύνει ακόμη wall footprint.)
- **2026-07-18 (Φ6c — ΠΛΑΚΑ ΩΣ FINISH-MEMBER ΚΑΙ ΣΤΗΝ 2Δ ΚΑΤΟΨΗ + DXF EXPORT· parity με 3Δ)** — η
  κατακόρυφη περιμετρική «φάσα» σοβά της πλάκας φαινόταν μόνο στο 3Δ scene· τώρα εξάγεται και στα δύο
  υπόλοιπα paths. Το `computeStructuralFinishSilhouette` απέκτησε προαιρετικό `slabs?:
  SlabFinishMemberSource[]` (backward-compatible, `= []`) που τρέχει τα `pushFinishOverrideEdges` +
  band-generation ίδια με τοίχους/κολόνες/δοκάρια. Consumers: `dxf-renderer-frame-builders.ts`
  (2Δ κάτοψη — `DxfSlab.slabEntity`, «δύο shapes» ADR-659) + `overlay-dxf-collector.ts` (DXF export —
  `isSlabEntity` + `isFinishActive`/`componentVisible`). Και οι δύο guards κρατούν πλέον slabs στο
  early-return ώστε ένας μεμονωμένος όροφος-δώμα (μόνο πλάκα) να παράγει φάσα. Tilted/legacy πλάκες
  φιλτράρονται εσωτερικά (`slabIsFinishMember`). Test: `structural-finish-silhouette-2d`.
- **2026-07-17 (Φ5 — Ο ΣΟΒΑΣ ΤΗΣ ΠΛΑΚΑΣ, Φ5a τύποι + Φ5b soffit/top· UNCOMMITTED)** — Giorgio (C4D
  screenshots 161710/162020): «ΣΤΗΝ ΠΛΑΚΑ ΔΕΝ ΤΟΠΟΘΕΤΕΙΤΑΙ ΣΟΒΑΣ ΣΕ ΚΑΜΜΙΑ ΠΛΕΥΡΑ … ΣΕ ΟΛΕΣ ΤΙΣ
  ΠΛΕΥΡΕΣ ΚΑΙ ΝΑ ΣΕΒΕΤΑΙ ΤΑ ΣΗΜΕΙΑ ΕΠΑΦΗΣ … αν ο χρήστης τοποθετήσει πάνω στην πλάκα δομική οντότητα,
  εκεί να μην υπάρχει σοβάς» (associative).
  - **Διάγνωση:** το `SlabParams` **δεν είχε `finish`** — η πλάκα υπήρχε στο `bim/finishes/` μόνο ως
    `HorizontalSlabObstacle` (κρύβει σοβά ΑΛΛΩΝ). Ήταν ο τελευταίος δομικός τύπος που έλειπε.
  - **Φ5a (τύποι + SSoT, dormant):** `SlabParams.finish?: StructuralFinishSpec` (mirror `WallParams`)·
    **NEW κεντρικό** `structural-finish.schemas.ts` (`StructuralFinishSpecSchema` — πρώτο finish zod
    schema· τα 4 params το κάνουν import αντί inline)· **NEW** `slab-finish-source.ts` (`slabIsFinishMember`
    predicate + `SLAB_FINISH_KINDS` {floor,ceiling,roof} + `slabDnaHasPlaster` + `slabFinishZExtent`,
    mirror `wall-finish-source`)· `buildDefaultSlabParams` δίνει default finish στις finish-kinds· το
    `slabZExtent` **ΜΕΤΑΚΙΝΗΘΗΚΕ** στο slab-finish-source (μηδέν διπλό).
  - **Φ5b (soffit + top, το 80% της αξίας):** N.7.1 **EXTRACT** `structural-finish-horizontal-obstacles.ts`
    (το `scene-horizontal` ήταν 481/500)· `HorizontalSlabObstacle` +`id`+kind/finish/dna (optional)·
    **`collectSlabSoffitFace`** (`down` — η οροφή του από-κάτω χώρου, cover-subtracted, self-excluded)·
    η **πάνω** παρειά μπαίνει στο ενιαίο `computeMergedStructuralTopCap` (mirror τοίχου)· **Απόφαση Δ:**
    `coversAtPlane(...excludeIds)` **id-based** self-exclusion ανά επίπεδο (ΟΧΙ blanket z-filter → μια
    `ground` coplanar non-member εξακολουθεί να καλύπτει)· `slabDownSkin` στο sync· **Απόφαση Β:** suppress
    του `soffitFinish` paint όταν ενεργός `finish` (`attachSoffitFinish` + `drawSoffitFinishTint`, μηδέν
    διπλό δέρμα, 2Δ↔3Δ parity).
  - **Tests:** `slab-finish-source.test.ts` (kind gate ×5, plaster detection, predicate 3 gates,
    zExtent) + `structural-finish-slab-soffit.test.ts` (soffit down, associative wall-below,
    self-exclusion bug 100928 σε slab μορφή, Απόφαση Δ ground-covers-wall guard). Σύνολο finishes: 793 GREEN.
  - **Φ5c (περιμετρική φάσα — silhouette member, 2026-07-17):** η πλάκα γίνεται `SilhouetteMember` της
    ΙΔΙΑΣ `computeStructuralFinishSilhouette` (mirror τοίχου, ADR-449): flat finish-member slab →
    πλήρες footprint + z-band=thickness → `safeUnion` ανά z-band τυλίγει το περίγραμμα + σβήνει μόνο του
    στις επαφές. **ΜΗΔΕΝ νέο math** (`toMember`.`map(toPt2)` πετά το z του `Polygon3D`). **Απόφαση Α:**
    options-object refactor του `computeStructuralFinishSilhouette` (9 positional → `SilhouetteFinishInput`,
    mirror `HorizontalFinishInput`· 3 production + 13 test call sites)· **Απόφαση Β:** NEW
    `bim/geometry/slab-tilt.ts` `isSlabTilted` SSoT (κεντρικοποίηση inline του `wall-host-plan-builder:246`)·
    **Απόφαση Γ:** slab loop (`slabIsFinishMember` + tilted guard) + `slabs` group/collection στο sync +
    slabs στο sceneUnits fallback **(Ρίσκο Δ:** όροφος με ΜΟΝΟ πλάκα). Tilted → εξαιρείται (flat union μόνο,
    ADR-404). Tests: `structural-finish-slab-perimeter.test.ts` (member / kind-gate / tilted / contact-
    subtraction union<separate). **⚠️ ΟΠΤΙΚΟ αποτέλεσμα φάσας ΑΝΕΠΑΛΗΘΕΥΤΟ — χρειάζεται C4D έλεγχος
    Giorgio** (μπαλκόνι=εκτεθειμένη→σοβάς σωστός· ενδιάμεσο δάπεδο=θαμμένη ακμή→σβήνει· δώμα/parapet=;·
    Ρίσκο Γ classifier interior/exterior από **τοίχους** → πλάκα-δώμα χωρίς τοίχους ταξινομείται default).
  - **DEFER Φ5d (BOQ + edge cases):** BOQ πλάκας (soffit+top κυρίαρχα → **ΟΧΙ** αντιγραφή column/beam)·
    «δομικό μέλος που ΠΑΤΑΕΙ ΠΑΝΩ στην πλάκα σβήνει το top-plaster κάτω από τη βάση του» (χρειάζεται
    member-base ως cover στο cap).
- **2026-07-17 (Φ3c-B3b′ — soffit σοβά clip για ΤΟΙΧΟΥΣ· ο ροζ σοβάς διαπερνούσε την πλάκα)** —
  Giorgio (OBJ → Cinema 4D R15, σοβάς βαμμένος ροζ): «ΟΙ ΣΟΒΑΔΕΣ ΤΩΝ ΤΟΙΧΩΝ ΔΕΝ ΣΕΒΟΝΤΑΙ ΤΗΝ ΥΠΑΡΞΗ ΤΗΣ
  ΠΛΑΚΑΣ ΚΑΙ ΤΗΝ ΔΙΑΠΕΡΝΟΥΝ.» **Το ίδιο bug που λύθηκε στο Φ3c-B3b για τα δοκάρια, αλλά ΠΟΤΕ για τους
  τοίχους.**
  **RECOGNITION (N.0.1) — probe ΠΡΙΝ τον κώδικα, γιατί τα C4D objects λέγονταν `Wall_structural-finish-hup-*`
  (= το ΟΡΙΖΟΝΤΙΟ καπάκι) και η προφανής υποψία ήταν λάθος στόχος.** Μετρημένο (τοίχος 0→3000, πλάκα
  οροφής 3000/πάχος 200 → soffit 2800):
  | μονοπάτι | πριν | διάγνωση |
  |---|---|---|
  | κάθετος silhouette | zTop **3000** | 🔴 **η αιτία** — διαπερνά 200mm |
  | `hup` cap (πλάκα καλύπτει πλήρως) | **0 faces** | ✅ αφαιρείται σωστά |
  | `hup` cap (πλάκα **flush** στην παρειά) | 1 face **@3000** | 🔴 οι «λεπτές λωρίδες» = το 25mm χείλος σοβά |
  Δηλαδή **ΕΝΑ αίτιο, ΔΥΟ συμπτώματα**: το άκλιπο `zTop` τρέφει ΚΑΙ τα δύο mesh. Clip μόνο στον κάθετο θα
  άφηνε το καπάκι να **αιωρείται** στα 3000 πάνω από σοβά κομμένο στα 2800.
  **ΑΙΤΙΑ:** το `wallObstacleZExtent` επέστρεφε `zBotMm + params.height` (πλήρες ύψος, μηδέν soffit clip),
  ενώ το `beamZExtent(b, topClipMm)` δεχόταν clip από το Φ3c-B3b. Το `attached` branch **δεν** το κάλυπτε:
  λύνει μόνο top-attach σε **δοκάρι**· ένας `storey-ceiling` τοίχος κάτω από **πλάκα** δεν περνά από εκεί.
  **ΛΥΣΗ (mirror, μηδέν νέο math):** NEW `buildWallTopClipById(entities, floorElevationMm)` — αυτολεξεί
  mirror του `buildBeamTopClipById`, ΙΔΙΟ `buildCeilingSlabHosts` + `resolveMemberTopClipZmm`, ίδια σύμβαση
  «entry μόνο όταν `clip < top`» → απών = πλήρες ύψος (byte-for-byte). Το map τρέφει **ΚΑΙ** τον κάθετο
  silhouette (9ο optional param `wallTopClipById`) **ΚΑΙ** το οριζόντιο `HorizontalFinishInput` → ΕΝΑ z και
  για τα δύο. Σύμβαση Revit «Join Geometry» (ADR-534): η **πλάκα νικά**, το μέλος κόβεται στο soffit,
  **render-only** — το δομικό ύψος (`params.height`) μένει άθικτο.
  **ΕΞΑΡΤΑΤΑΙ** από το topside guard του `resolveMemberTopClipZmm` (ίδια μέρα, παρακάτω): χωρίς αυτό η
  πλάκα-**δάπεδο** που ο τοίχος πατά πάνω της θα κέρδιζε το `min()` → clip = βάση → **ύψος 0 → εξαφανισμένος**
  σοβάς αντί για κομμένος. Τα δύο fixes πρέπει να ταξιδεύουν μαζί.
  **ΣΚΟΠΙΜΗ ΔΙΑΚΡΙΣΗ:** το clip μπαίνει ΜΟΝΟ στα finish **members** — **ΟΧΙ** στα coverage **obstacles**
  (`wallObstacles`, `wallObs`). Ένα obstacle απαντά «καλύπτει το **δομικό σώμα** την όψη του γείτονα σε
  αυτή τη ζώνη;» — το σώμα δεν κόβεται (T-beam). Clip εκεί θα «ξεκάλυπτε» ψευδώς τη ζώνη soffit→top.
  **N.0.2 boy-scout (ίδιο diff):** το `wallObstacleZExtent` (silhouette) + `wallZExtent` (horizontal) ήταν
  **αυτολεξεί δίδυμα** — και το clip χρειαζόταν **και στα δύο** → ενώθηκαν σε ΕΝΑ SSoT `wallFinishZExtent`
  (`wall-finish-source.ts`· attached-top resolution → soffit clip → `Math.min`, κάτω παρειά ανέγγιχτη).
  Εκκαθαρίστηκαν και τα 3 υπόλοιπα **προϋπάρχοντα** jscpd clones του `scene-horizontal` (αποδεδειγμένα με
  jscpd στο pristine HEAD: **4 clones πριν → 0 μετά**): `HorizontalBeamSource extends BeamFinishOutlineSource`
  (ίδια θεραπεία με `SilhouetteBeamSource`) + NEW `finishUnitsOf()` + NEW `buildCoverObstacles()`.
  **Files:** `wall-finish-source.ts` (+`wallFinishZExtent`) · `structural-finish-scene-silhouette.ts`
  (−`wallObstacleZExtent`, +9ο param) · `structural-finish-scene-horizontal.ts` (−`wallZExtent`,
  +`wallTopClipById`, +2 SSoT helpers) · `bim-scene-structural-finish-sync.ts` (+`buildWallTopClipById`).
  2Δ plan + DXF export περνούν `undefined` → **byte-for-byte** αμετάβλητα.
  **jest:** NEW `structural-finish-wall-soffit-clip.test.ts` (10 tests — mirror του beam προτύπου: κάθετος
  clip· `hup` cap plane· no-op σε άλλο id· **obstacle ΔΕΝ κόβεται**· κάτω παρειά ανέγγιχτη· attached+clip →
  το χαμηλότερο νικά). **227/227 finishes GREEN** (217 baseline + 10)· jscpd:diff καθαρό.
  🔴 **ΕΚΚΡΕΜΕΙ browser-verify (Giorgio):** `Δοκιμη ισογεια κατοικια.tek` → 3Δ → «Σοβάς» ON → ο σοβάς σταματά
  στο soffit· ιδανικά + OBJ → C4D (έτσι βρέθηκε).

- **2026-07-17 (§monolithic-cut BUGFIX — «καλύπτουσα» = topside guard· αόρατες κολόνες ανάμεσα σε 2 πλάκες)** —
  Giorgio (screenshots): οι κολόνες **ανάμεσα σε 2 πλάκες** δεν εμφανίζονταν στο 3Δ· οι pilotis (θεμελίωση→ισόγειο)
  ναι. **RECOGNITION (N.0.1):** το `ABOVE_SLAB_KINDS` φιλτράρει **είδη** (`ground`/`foundation` έξω), ΟΧΙ **θέσεις**.
  Η πλάκα-**δάπεδο** (`kind:'floor'`) του ΙΔΙΟΥ ορόφου περνά το φίλτρο ειδών, το footprint της περιέχει (plan) την
  κολόνα που **πατά πάνω της**, και το soffit της είναι κάτω από τη βάση της → κέρδιζε το `min()` στο
  `resolveMemberTopClipZmm` → `max(bottom, clip) = bottom` → `clipTopZmm == baseAbsMm` → **`effectiveHeightMm = 0`**
  (`columnToMesh` flat-extrude) → αόρατη κολόνα. Οι pilotis επιβίωναν **κατά τύχη**: το `foundation` από κάτω τους
  είναι ήδη εξαιρεμένο → ταίριαζε μόνο ΕΝΑΣ host (η από πάνω). Λανθάνον **ίδιο** bug στα δοκάρια (`syncBeams`,
  κοινός resolver) — δεν είχε αναφερθεί. **Fix (1 γραμμή σημασιολογίας, FULL SSoT reuse, μηδέν νέο math):**
  «καλύπτουσα» πλάκα ≡ **η ΑΝΩ παρειά της είναι πάνω από τη βάση του μέλους** → per-host guard
  `hostTopsideAt(h, pt) > bottomZmm + HOST_Z_EPS` πριν μπει στο `min()`. Reuse `hostTopsideAt` + `HOST_Z_EPS`
  (`host-footprint-eval.ts`, ADR-401 (γ))· το `slabHostInput` δίνει ΗΔΗ `topsideZmm`/`topsideZmmAt` (tilted) → μηδέν
  νέο input. `null` topside (host χωρίς άνω παρειά, π.χ. `roofHostInput`) → legacy «καλύπτουσα» (back-compat· το
  `buildCeilingSlabHosts` περνά **μόνο** από `slabHostInput`, άρα άπρακτο σήμερα). **Γιατί topside κι όχι
  `soffit > bottom`:** το topside διακρίνει «πλάκα που **στηρίζει**» (top ≤ bottom → αγνόησε) από «χοντρή πλάκα που
  **θάβει**» (top > bottom > soffit → clip σε bottom = θαμμένο μέλος, Revit «Join Geometry»)· ο απλός soffit guard
  θα έκανε το θαμμένο μέλος ορατό → z-fighting = regression του ίδιου του §monolithic-cut. **Απόδειξη:** το
  προϋπάρχον test «clamp: πολύ χαμηλό soffit → bottom» πέρασε **αμετάβλητο** (κωδικοποιούσε τη θαμμένη περίπτωση,
  όχι το bug). +2 regression tests (πλάκα-δάπεδο topside==bottom → no-op· κολόνα δάπεδο+οροφή → clip 2800).
  **7/7 GREEN.** N.17: όχι tsc (jest only). ADR-040: εκτός (καθαρό geometry helper, μηδέν store/subscription).
  🔴 browser-verify (Giorgio) + commit — stage ADR-534 (CHECK 6B/6D).
- **2026-06-26 (Φ3c-B3b — Soffit finish/σοβάς clip 3Δ, UNCOMMITTED)** — Giorgio order: «ο σοβάς να κόβεται στο
  soffit όπως ο οπλισμός/στερεό». **RECOGNITION (N.0.1):** ο ενεργός 3Δ σοβάς δοκαριού είναι ο **ενιαίος
  silhouette** (`syncStructuralFinishSkin` → `computeStructuralFinishSilhouette`· το per-element path είναι
  suppressed για επίπεδες δοκούς)· η κατακόρυφη έκταση `beamZExtent` = `topElevation+zOffset` (πλήρες ύψος)
  → ο σοβάς προεξείχε στην πλάκα. **Υλοποίηση (FULL SSoT reuse, mirror του `columnExtents` pattern):** νέα
  `buildBeamTopClipById` στον 3Δ caller — **ΙΔΙΟ** `resolveMemberTopClipZmm` + `buildCeilingSlabHosts`
  (§monolithic-cut, beamTop = `topElevation+zOffset`) με B3a/στερεό → `Map<beamId, clipZmm>` (entry μόνο σε
  πραγματική κάλυψη `clip<top`). Pre-resolved map περνά ως **νέο optional 7ο όρισμα** `beamTopClipById` στον pure
  `computeStructuralFinishSilhouette` → `beamZExtent(b, clip)` clamp-άρει **μόνο** το `zTopMm` (η κάτω παρειά/
  downstand μένει πλήρης). **2Δ plan (`dxf-renderer-frame-builders`) + DXF export (`overlay-dxf-collector`):
  undefined → byte-for-byte** (το vertical clip δεν αφορά κάτοψη/export). Tests: νέο `structural-finish-beam-soffit-clip`
  (3) — no-clip → zTop 3000, clip 2800 → zTop 2800, clip-άλλου-id → no-op· **139/139 finishes + 3Δ finish converters
  GREEN**. **ADR-040:** ο 3Δ caller (`bim-3d/scene/*`) δεν αλλάζει subscriptions/orchestrators (sync pass, pure
  read)· δεν αγγίζεται 2Δ entity renderer → 6B/6D εκτός. N.17: όχι full tsc (ts-jest). 🔴 browser-verify (Giorgio).
  DEFER: Φ3c-B3c (I-shape steel beam soffit clip).
- **2026-06-26 (Φ3c-B3a — Soffit rebar clip 3Δ, UNCOMMITTED)** — Giorgio order: «ο οπλισμός να κόβεται στο
  soffit όπως ήδη κόβεται το στερεό». **RECOGNITION (N.0.1):** το ορατό 3Δ στερεό κόβεται ΗΔΗ στο soffit
  (`beamToMesh` → `clipTopZmm` = `resolveMemberTopClipZmm`, §monolithic-cut)· ο κλωβός οπλισμού (`buildBeamRebarCage`
  → `buildLinearMemberRebarCage`) **ΔΕΝ** → προεξείχε στην πλάκα. **2Δ rebar (`beam-rebar-2d`) = ΚΑΜΙΑ αλλαγή:**
  είναι **κάτοψη** → το soffit clip είναι Z (κατακόρυφο), αόρατο σε plan (άρα CHECK 6D εκτός — δεν αγγίχθηκε
  entity renderer). **Υλοποίηση (FULL SSoT reuse, μηδέν νέο math):** το ΙΔΙΟ `clipTopZmm` (absolute mm) που κόβει
  το στερεό περνά `beamToMesh → attachBeamRebar`· νέα `beamRebarTopClipY` map-άρει absolute mm → world m στο ΙΔΙΟ
  datum με την κάτω παρειά (`bottomFaceY + (clipTopZmm − beamBottomAbsMm)·MM_TO_M`)· `buildBeamRebarCage`/
  `buildLinearMemberRebarCage` δέχονται προαιρετικό `topClipY` → `clampY = min(y, topClipY)` στο `localToThree`
  (διαμήκεις + συνδετήρες). `undefined` ή clip ≥ κορυφής → no-op (byte-for-byte, μηδέν regression· tie-beam path
  ανέγγιχτο). Tests: νέο `linear-member-rebar-3d-clip` (3) — no-clip φτάνει 0.45–0.48m, `topClipY=0.30` → καμία
  κορυφή >0.30, clip-πάνω-από-κλωβό = no-op· 7/7 + 21/21 regression (footing-rebar / beam-slope / structural-finish-3d-beam
  / beam-ishape) GREEN. **ADR-040:** δεν αγγίζονται micro-leaf/store/subscription files (μόνο `bim-3d/converters/*`,
  render-time pure read) → CHECK 6B/6D δεν ενεργοποιείται· stage ADR-534 μαζί. N.17: όχι full tsc (ts-jest).
  🔴 browser-verify (Giorgio). DEFER: Φ3c-B3b (finish/σοβάς soffit clip + I-shape steel).
- **2026-06-26 (Φ3c-B2 — Edge/L-beam `flangeSides:1` auto-detection, UNCOMMITTED)** — Giorgio order: «όπως οι
  μεγάλοι παίκτες (Revit), full SSoT». **RECOGNITION (N.0.1):** ο detector (`resolveBeamEffectiveFlangeWidthMm`,
  `beam-flange-context.ts`) έδινε πάντα `flangeSides:2` → υπερεκτίμηση `b_eff` στις περιμετρικές δοκούς (ένα
  μόνο πέλμα). Το `computeEffectiveFlangeWidthMm` δεχόταν **ήδη** `flangeSides:1|2` (Φ3b) → έλειπε μόνο η
  γεωμετρική ανίχνευση. **Υλοποίηση (FULL SSoT reuse, pure, ADR-040 εκτός):** νέα `resolveFlangeSides` —
  δειγματοληψία της πλάκας **εκατέρωθεν του άξονα** μέσω **reuse `buildMemberAxisFrame`** (`column-face-snap-helpers`):
  offset `±perp · 1.5·halfThickness` (καθαρά έξω από τον κορμό, ίδιο coordinate space → μηδέν unit conversion) σε
  3 σημεία κατά μήκος (0.25/0.5/0.75) → reuse `hostUndersideAt` ανά πλευρά. Μία πλευρά καλυμμένη → `1` (L-beam)·
  εκατέρωθεν → `2` (T-beam)· εκφυλισμένο/`0` → `2` (συντηρητικό, μηδέν regression). Ο άξονας DERIVED από το
  footprint (μεγαλύτερη ακμή, `deriveBeamAxis2D`) → source-agnostic, ορθό για λοξές/justified δοκούς. **Καμία
  αλλαγή στους consumers** (store/reader/panel/2Δ/3Δ/PDF παίρνουν αυτόματα το διορθωμένο `b_eff`). Tests: +1
  L-beam fixture (`edgeSlab` → `b_eff = b_w + 1·0.2·l_0 = 1500`), 23/23 GREEN (beam-flange-context + derive-beam-flange
  + effective-flange-width/-design). **Verify:** ts-jest + static import (acyclic: `bim/structural → bim/columns`).
  N.17: όχι full tsc. 🔴 browser-verify (Giorgio). DEFER: Φ3c-B3 (finish/rebar soffit clip).
- **2026-06-26 (Φ3c-B1 — Live organism injection του `b_eff`, UNCOMMITTED)** — Giorgio order: «το ρ/οπλισμός
  να ΧΡΗΣΙΜΟΠΟΙΟΥΝ το b_eff real-time» (λύση της επιφύλαξης του Φ3c-A — η γραμμή ήταν πληροφοριακή). **RECOGNITION
  (N.0.1, trace full pipeline):** το flexural-cap wiring ήταν ΗΔΗ έτοιμο (Φ3b: `flexuralCompressionWidthMm` →
  `M_Rd,lim` σαγκ. χρησιμοποιεί `b_eff`)· λείπε μόνο ο **live producer** (store) + η κατανάλωσή του. ΕΥΡΗΜΑ:
  η bridge `effectiveReinforcement` του panel καλούσε την **pure** `resolveActiveBeamReinforcement(beam, provider)`
  ΧΩΡΙΣ overrides → ο πίνακας ρ% **δεν** ήταν topology-aware (drift από το docstring που υπόσχεται parity με
  2Δ/3Δ/PDF). **Υλοποίηση (FULL SSoT, mirror `BeamTorsionStore`):** NEW transient `BeamFlangeStore`
  (`createDerivedMapStore<number>`, N.0.2 boilerplate)· NEW **pure** `buildBeamFlangeWidthMap(entities,
  coveringHosts, supportTypeByBeamId)` που **reuse-άρει τον ΙΔΙΟ detector** `resolveBeamEffectiveFlangeWidthMm`
  (μένει pure — ο organism core χτίζει τα hosts μέσω `buildCeilingSlabHosts`, όπως `BeamDetailHost`/`BeamPropertiesTab`)·
  ο `supportType` έρχεται από τον topology-aware χάρτη του ίδιου pass → το `l_0` του b_eff συνεπές με τον οπλισμό.
  **Writer:** `structural-organism-core.runOrganismDiagnostics` γράφει το store στο ΙΔΙΟ low-freq pass (ADR-040
  safe) δίπλα στα Torsion/Span/MaxWidth. **Reader:** `resolveActiveBeamFlangeWidthMm(beamId)` (mirror
  `resolveActiveBeamTorsion`). **Consumers:** `resolveActiveBeamReinforcement` πήρε 6ο optional param
  `effectiveFlangeWidthMm` → `buildBeamSectionContext`· `resolveActiveBeamReinforcementForEntity` περνά πλέον το
  store value (→ live 2Δ/3Δ rebar + PDF schedule). **Bridge unification (SSoT fix του drift):** η panel
  `effectiveReinforcement` δρομολογείται πλέον μέσω του store-coupled `resolveActiveBeamReinforcementForEntity`
  (αντί της pure χωρίς overrides) → ο πίνακας καταναλώνει τα ΙΔΙΑ DERIVED μεγέθη (b_eff **+ στρέψη/στήριξη/άνοιγμα**,
  που έλειπαν λόγω drift) με 2Δ/3Δ/PDF· fallback (απών οπλισμός) επίσης flange/support-aware. **⚠️ Behavioral
  implication (flag → browser-verify):** η ενοποίηση φέρνει στο panel ρ% ΚΑΙ τα topology effects (cantilever/
  continuous/torsion) που το docstring ήδη υπόσχεται αλλά ο κώδικας δεν εφάρμοζε — όχι μόνο b_eff. Σωστή SSoT
  σύγκλιση, αλλά ορατή αλλαγή στο ρ% topology-aware δοκών. **Scope boundary:** ο member-agnostic facade
  `resolveActiveMemberReinforcement` (organism `reinforcement-checks`) ΔΕΝ άλλαξε (μένει b_w → μηδέν regression
  στους ρ-checks). **Tests: +4 GREEN** (`derive-beam-flange-width`: covered→b_eff / continuous→μικρότερο /
  no-host→empty / non-beam skip)· flange regression 22/22 GREEN. ⚠️ Pre-existing HEAD failures (όχι δικά μου,
  handoff-flagged): `reinforcement-checks` raft (`maxFreeSpanM`). **ADR-040 ΔΕΝ αφορά** (organism core = low-freq
  pass· bridge = panel· μηδέν canvas/3D converter — CHECK 6B/6D εκτός). tsc SKIP (N.17 OOM)· verify με ts-jest +
  static import check. 🔴 browser-verify (Giorgio): δοκός-πλακοδοκός κάτω από πλάκα → υψηλότερος cap σαγκ. ροπής
  → πιθανώς λιγότερος κάτω διαμήκης σε φορτισμένη T-δοκό (vs ορθογώνια)· panel ρ% === PDF schedule. **DEFER:**
  Φ3c-B2 (edge/L-beam `flangeSides:1`), Φ3c-B3 (finish/rebar soffit clip).
- **2026-06-26 (Φ3c-A — `b_eff` read-only γραμμή στο ΑΡΙΣΤΕΡΟ panel δοκού, COMMITTED aa1a0cd0)** — Giorgio order
  (μετά το Φ3b): η DERIVED `b_eff` να φαίνεται και ως Revit instance property στο docked Properties panel
  («Στατικά / Οπλισμός»), όχι μόνο στο A3 title block. **RECOGNITION (N.0.1):** το panel δεν είχε geometry
  section — render-άρει τα `BEAM_PROPERTY_GROUPS` (editable rebar + read-only readouts όγκοι/ρ%) μέσω του
  κοινού `BimPropertyRow`. **FULL SSoT reuse (μηδέν νέος μηχανισμός):** ο υπολογισμός είναι ΑΚΡΙΒΩΣ ο ίδιος
  με το title block — `BeamPropertiesTab` (έχει ήδη `currentScene`) → `buildCeilingSlabHosts(slabs)` +
  `resolveBeamEffectiveFlangeWidthMm(beam, hosts, supportType)` + topology-aware `resolveActiveBeamSupportType`
  (mirror του μπλοκ στο `BeamDetailHost`) → `effectiveFlangeWidthMm?` prop στο `BeamAdvancedPanel`.
  **Υλοποίηση:** NEW data descriptor `BEAM_EFFECTIVE_FLANGE_FIELD` (read-only `BimPropertyField`, **εκτός**
  των groups γιατί είναι **scene-conditional** — όχι pure-from-beam bridge readout)· εξαγωγή
  `BeamAdvancedSection` subcomponent (functions ≤40γρ) που εισάγει τη γραμμή `b_eff` **ακριβώς πάνω από τα
  readouts** (κεφαλή του παραγόμενου μπλοκ)· value = `round(b_eff)` mm (ίδιο format με title block)· label i18n
  `beamAdvancedPanel.sections.structural.fields.effectiveFlangeWidth` = «b_eff (mm)» (el+en, N.11). Ορατή ΜΟΝΟ
  όταν πλάκα καλύπτει τη δοκό· γυμνή/ορθογώνια δοκός → `undefined` → καμία γραμμή. **Επιφύλαξη (πληροφοριακό):**
  το ρ/οπλισμός του panel ΔΕΝ καταναλώνει ακόμα το `b_eff` (αυτό = Φ3c-B1 live organism injection) — η γραμμή
  εδώ είναι καθαρή derived ετικέτα (ίδια σημασία με το title block σήμερα). **Tests: +1 GREEN** (descriptor:
  read-only / μη-bridge-key / εκτός groups)· `beam-property-fields` 10/10 GREEN. **ADR-040 ΔΕΝ αφορά** (UI
  panel, μηδέν canvas/3D converter — CHECK 6B/6D εκτός). tsc SKIP (N.17 OOM)· τα 2 `.tsx` επαληθεύτηκαν
  στατικά (import paths + signatures), όχι browser. 🔴 browser-verify (Giorgio): δοκός κάτω από πλάκα →
  γραμμή `b_eff` στο panel· γυμνή δοκός → κρυφή. **DEFER (Φ3c-B):** live auto-design injection (B1),
  edge/L-beam `flangeSides:1` (B2), finish/rebar soffit clip (B3).
- **2026-06-26 (Φ3b — T-beam `b_eff` EC2 §5.3.2.1, UNCOMMITTED)** — Giorgio order «όπως οι μεγάλοι
  παίκτες (Revit), full enterprise + full SSoT». **RECOGNITION (N.0.1, code=SoT):** το **BOQ net-of-overlap
  σκυροδέματος ΥΠΗΡΧΕ ΗΔΗ** (Φ3a) — `computeSlabGeometry.sumBeamDeductionsM3` (η πλάκα αφαιρεί
  `∩(πλάκα,δοκάρι)×min(beamDepth,slabThk)`, Revit Material Takeoff convention), wired μέσω
  `slab-boq-feed.collectBeamFootprints`, 28 jest GREEN (υλοποιήθηκε υπό **ADR-363 §5.5i+**, ο παλιός
  roadmap «Φ3 DEFER» ήταν stale → διορθώθηκε §3). Το δοκάρι κρατά πλήρη όγκο· **+ADR-458** net column-joint
  («η κολόνα νικάει»). → Το ουσιαστικό Φ3b = **T-beam `b_eff`**. **Υλοποίηση (FULL SSoT):** NEW pure
  `codes/effective-flange-width.ts` (`computeEffectiveFlangeWidthMm`, EC2 §5.3.2.1: `b_eff = b_w + Σ b_eff,i`,
  `b_eff,i = min(0.2·b_i+0.1·l_0, 0.2·l_0, b_i)`· `zeroMomentSpanFactor` l_0 = 1.0/0.7/2.0·l simple/συνεχ./
  πρόβολος, EC2 Σχ. 5.2)· NEW pure detector `beam-flange-context.ts` (`resolveBeamEffectiveFlangeWidthMm`,
  **reuse `hostUndersideAt`+`polygon2DCentroid`+`buildCeilingSlabHosts`** SSoT — καλύπτουσα πλάκα→T-beam·
  γυμνή δοκός→`undefined`→`b_w`, μηδέν regression). **Section property:** `BeamSectionContext.effectiveFlangeWidthMm?`
  (DERIVED, geometry-is-SSoT optional override όπως `supportTypeOverride`/`designTorsionKnm`)· `buildBeamSectionContext`
  6ο optional param (κρατιέται μόνο `> b_w`). **Flexural-cap wiring (πραγματική μηχανική αξία):** στο
  `suggestBeamReinforcementFrom` η **σαγκ. (θετική) ροπή** χρησιμοποιεί `b_eff` ως πλάτος θλιβόμενης ζώνης
  (`flexuralCompressionWidthMm`: simple→b_eff, hogging συνεχ./πρόβολος→`b_w` κορμός) → υψηλότερο `M_Rd,lim`
  του T-beam· **regression-safe** (ο cap ενεργοποιείται μόνο υπό φορτίο M_Ed>0· αφόρτιστα→byte-for-byte).
  **Report:** title block δοκού «b_eff (mm)» (host υπολογίζει scene-aware μέσω του detector· i18n `beamDetail.
  titleFields.effectiveFlangeWidth` el+en). **Tests: 27 νέα GREEN** (10 flange-width + 5 detector + 3 cap-wiring
  + 9 detail-sheet incl. b_eff row)· **180/180 structural codes+detail-sheet regression GREEN**. ⚠️ Pre-existing
  HEAD failure (όχι δικό μου): `reinforcement-checks` raft fixture χωρίς `maxFreeSpanM` (git-verified αμετάβλητο
  στο working tree). **DEFER (Φ3c):** live **auto-design** injection του `b_eff` μέσω organism store (mirror
  `BeamTorsionStore` — το cap wiring είναι έτοιμο)· edge/L-beam (πλάκα μία πλευρά→`flangeSides:1`) auto-detect·
  finish/rebar soffit clip· I-shape steel clip. ADR-040 ΔΕΝ αφορά (μηδέν αλλαγή canvas/3D converters· ο
  detector είναι pure structural). tsc SKIP (N.17 OOM — verified με 207 ts-jest). 🔴 browser-verify (άνοιγμα
  beam detail δοκού κάτω από πλάκα → γραμμή «b_eff» στο title block) + commit (Giorgio· stage ADR-534 + adr-index).
- **2026-06-26 (Φ4 — ceiling soffit finishes, Revit-grade, UNCOMMITTED)** — Giorgio: «όπως οι μεγάλοι
  παίκτες (Revit), full enterprise + full SSoT». **Μοντέλο (D, Revit-correct):** το ceiling finish είναι
  **property της πλάκας** (`SlabParams.soffitFinish = {materialId}`), ΟΧΙ free-floating οντότητα — όπως η
  Revit μοντελοποιεί το ceiling finish ως υλικό/βαφή στην παρειά (RCP), bay=πλάκα 1:1. **FULL SSoT:** reuse
  του υπάρχοντος `wall-covering-material-catalog` (μία πηγή paint/plaster για τοίχους **ΚΑΙ** οροφές· +`paint-
  yellow` +`plaster-spackle` σπατουλαριστό)· reuse `UpdateSlabParamsCommand` (undoable/mergeable), slab
  contextual tab, slab persistence (**δωρεάν** — params serialized wholesale· +`soffitFinish` στο `.strict()`
  Zod schema), render helpers (`hexToRgba`/`adaptFillTintForCanvas`/`extrudeAndRotate`). **Render:** 2D RCP
  swatch (`SlabRenderer.drawSoffitFinishTint`, ceiling-gated) + 3D λεπτή χρωματιστή στρώση κάτω από το soffit
  (`bim-three-slab-converter.attachSoffitFinish`, Group upgrade). **UI:** panel «Φινίρισμα οροφής» στο slab
  contextual tab, gated `kind==='ceiling'` (νέο visibility key `ceilingFinish` + `resolveSlabPanelVisibility`)·
  bridge string-branch (`SELECT_CLEAR_VALUE` → undefined, mirror fireRating). Κάθε φάτνωμα ανεξάρτητο finish.
  **Tests: 132 GREEN** (catalog +2 υλικά· `.strict()` schema round-trip soffitFinish· ceilingFinish visibility
  gating· + slab/renderer/converter/dna regression). ⚠️ Radix Select fix (linter): `value=''`→`SELECT_CLEAR_
  VALUE` στο tab + bridge. ADR-040 ΔΕΝ αφορά (slab discipline). **DEFER:** IFC IfcCovering CEILING export·
  bulk «apply to all bays»· auto-default finish στη δημιουργία bay· texture/PBR (paint=flat χρώμα). 🔴
  browser-verify (μπλε/κίτρινο/σοβάς ανά φάτνωμα σε 3D soffit + 2D swatch) + Firestore re-check + commit.
- **2026-06-26 (Φ2 — υποδιαίρεση σε φατνώματα + per-bay πάχος, UNCOMMITTED)** — Giorgio order μετά το v4.
  Το ενιαίο περίγραμμα (v4 union) γίνεται **master region** και **υποδιαιρείται σε φατνώματα** από τους
  **άξονες των εσωτερικών δοκαριών** (location lines, ADR-529) + τις **κεντρικές γραμμές τοιχίων**, με τον
  ΙΔΙΟ SSoT `findClosedPolygonsFromLines` (NEW `bim/slabs/ceiling-bay-subdivision.ts`). **DXF χωρίσματα +
  τόξα πορτών ΔΕΝ μπαίνουν** στους κόπτες → μηδέν artifacts v3. **Internal-only φίλτρο:** οι άξονες
  περιμετρικών δοκαριών (hug την παρειά) απορρίπτονται → η πλάκα καλύπτει ΟΛΟ το περίγραμμα (T-beam flange,
  όπως v4)· επέκταση κοπτών πέρα από το όριο (ο άξονας σταματά half-width πριν την παρειά → δεν τεμαχίζει).
  **Per-bay πάχος (EC2 §7.4.2 l/d):** NEW `ceiling-bay-thickness.ts` → structural SSoT. Στο `slab-sizing.ts`
  ο κοινός πυρήνας **`sizeSlabFromContext`** εξήχθη (μηδέν duplicate)· NEW **`suggestSupportedSlabThickness`**
  (αμφιέρειστη K=1.0 / συνεχής K=1.5· span = `maxFreeSpanMm` shorter-dim· χωρίς φορτίο → κυριαρχεί το l/d).
  **Scoped (Giorgio):** το `suggestSlabThickness` μένει **byte-for-byte cantilever-only** → ο proactive
  auto-sizer ΔΕΝ αγγίζει υπάρχουσες στηριζόμενες πλάκες (μηδέν regression, συμβατό ADR-499). Ο orchestrator
  (`ceiling-slab-commit`) resolve-άρει τον active provider (ίδιο SSoT με τον member auto-sizer) → inject
  `bayThickness` callback· ο pure builder μένει provider-agnostic (optional callback). K-table ήδη υπήρχε
  (`eurocodeSpanDepthSystemFactor`, slab basic l/d=20). **Tests:** ceiling-bay-subdivision (5: χωρίς κόπτες→1,
  1 εσωτ.→2, σταυρός→4, hugging→φιλτράρεται, ασύμμετρος→διαφορετικά spans) + ceiling-slab-from-structure (+3:
  σταυρός→4, per-bay πάχος από span, DXF χώρισμα→1) + slab-sizing (+6: supported 4m→230, continuous λεπτότερο,
  μονότονο, regression `suggestSlabThickness(simple)`→ΑΚΟΜΗ undefined). 93 tests GREEN (incl. regression).
  ADR-040 ΔΕΝ αφορά (καθαρά slab discipline, καμία αλλαγή 3D converters). **DEFER:** clip boundary-beam στο
  χαμηλότερο γειτονικό soffit· shear-wall κολόνες ως dividers· two-way continuity ανά πλευρά· BOQ net (Φ3).
  🔴 browser-verify (σκηνή Giorgio: N φατνώματα, λεπτότερα→λεπτότερη πλάκα, soffit step) + commit.
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
