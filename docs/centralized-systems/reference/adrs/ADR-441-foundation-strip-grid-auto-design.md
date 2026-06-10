# ADR-441 — Αυτόματη Εσχάρα Πεδιλοδοκών / Ενοποιημένο Πέδιλο (Foundation Strip-Grid Auto-Design)

**Status**: 🟡 PROPOSED / DRAFT — συζήτηση σε εξέλιξη με Giorgio (2026-06-11). ΔΕΝ υλοποιήθηκε κώδικας ακόμη.
**Date**: 2026-06-11
**Author**: Opus (συνομιλία Giorgio)
**Σχέση**: επεκτείνει ADR-436 (BIM Foundation Discipline — pad/strip/tie-beam). Δες επίσης ADR-363 (wall region/perimeter tools), ADR-423 (MEP auto-design pattern).

---

## 1. Πλαίσιο / Πρόβλημα

Ο Giorgio θέλει να προσθέσουμε στο auto-design τον τύπο **«εσχάρα / ενοποιημένο πέδιλο»** (strip footing grid). Αφορμή: σχέδιο θεμελίωσης κτιρίου (2 στιγμιότυπα που έστειλε):

- **Μπλε** = πέδιλα/πεδιλοδοκοί στο κατώτερο επίπεδο — **συνεχείς ορθογώνιες λωρίδες διατομής ~1.0 m (πλάτος) × 0.50 m (ύψος)**, ενωμένες σε **εσχάρα** (grid) που σχηματίζει 4 φατνώματα.
- **Πράσινο** = συνδετήριες δοκοί / κορμός πεδιλοδοκού (πατάνε πάνω στα μπλε).
- **Κόκκινο** = τοιχία + κολώνες (πατάνε πάνω στα μπλε, στους κόμβους & περίμετρο).

Στη 2η εικόνα (μόνο τα μπλε) φαίνεται **ενιαία συνεχής μάζα με 4 ορθογώνια ανοίγματα** → οι μεσαίες/κοινές λωρίδες είναι **ΜΙΑ ενιαία** (όχι δύο παράλληλες), δηλαδή το boolean union στις διασταυρώσεις γίνεται σωστά (καμία διπλομέτρηση όγκου).

Μαζί, μπλε (φαρδιά βάση) + πράσινο (στενός κορμός) = κλασική διατομή **ανεστραμμένου-Τ πεδιλοδοκού**.

---

## 2. Δομική θεωρία (γιατί είναι σωστό)

| Τύπος | IFC / Revit family | Σχήμα | Πότε |
|---|---|---|---|
| Μεμονωμένο πέδιλο (spread/isolated) | `IfcFooting PAD_FOOTING` / Isolated Foundation | Ορθογώνιο/τετράγωνο, παραμετρικό W×L×T, **διακριτό** | Κάτω από μία κολώνα |
| Συνεχές πέδιλο / πεδιλοδοκός (strip) | `IfcFooting STRIP_FOOTING` / Wall Foundation | Γραμμική λωρίδα | Κάτω από φέρον τοίχο |
| Εσχάρα πεδιλοδοκών (grillage / σταυρωτοί) | πλέγμα STRIP_FOOTING | Λωρίδες σε 2 διευθύνσεις, ενωμένες | Πλαισιωτός φορέας, μέτριο έδαφος, αντισεισμική συν-λειτουργία, πέδιλα που θα επικαλύπτονταν |
| Κοιτόστρωση (mat/raft) | `IfcSlab` (foundation) | Ενιαία πλάκα | Κακό έδαφος / πολύ πυκνά πέδιλα |

- **Τετράγωνο** πέδιλο → κεντρικό/συμμετρικό φορτίο. **Ορθογώνιο** → ροπή σε μία διεύθυνση ή περιορισμός χώρου (περιμετρικό/γωνιακό κοντά σε όριο).
- Όταν μεμονωμένα πέδιλα **εφάπτονται/επικαλύπτονται** → ενοποιούνται σε **κοινό πέδιλο (combined)** ή **πεδιλοδοκό/εσχάρα**.
- **Το ορθογώνιο σχήμα/διατομή είναι το standard** — το επιβεβαίωσε ο Giorgio με την εικόνα.

**Συμπέρασμα:** η εσχάρα πεδιλοδοκών (ορθογώνιες λωρίδες ενωμένες) είναι απολύτως ορθό, πολύ συνηθισμένο σύστημα.

---

## 3. Τι κάνει η Revit (απάντηση: ένα-ένα ανά κατηγορία, ΟΧΙ ταυτόχρονα)

Η Revit είναι **authoring**, όχι structural auto-designer. Τα στοιχεία τοποθετούνται **ξεχωριστά, ανά κατηγορία** (με batch):

- **Wall Foundation** (πεδιλοδοκός/strip) → host από τοίχο· επιλέγεις **πολλούς τοίχους μαζί** → μπαίνει σε όλους· διασταυρώσεις → **auto-join/miter**.
- **Isolated Foundation** (πέδιλο) → batch «at columns».
- **Foundation Slab** (κοιτόστρωση) → σχεδιάζεις boundary.
- **Grade beam / συνδετήρια δοκός** → είναι **Structural Framing** (άλλη κατηγορία) → μπαίνει **χωριστά**.

➡️ **Πεδιλοδοκός και συνδετήρια = διαφορετικές κατηγορίες → η Revit ΔΕΝ τα βάζει σε μία εντολή.** Το true auto-design ολόκληρου συστήματος το κάνουν analysis εργαλεία/add-ins (Robot, Tekla, Dynamo), όχι το core της Revit.

**Ευκαιρία (value-add πάνω από Revit):** εμείς ΜΠΟΡΟΥΜΕ να παράγουμε όλο το σύστημα ταυτόχρονα (εσχάρα + προαιρετικά συνδετήριες) σε μία εντολή / ένα undo, κρατώντας **διακριτά entities** για σωστό BOQ/IFC/audit.

---

## 4. Έρευνα κώδικα (2026-06-11) — ΤΙ ΥΠΑΡΧΕΙ / ΤΙ ΛΕΙΠΕΙ

Όλα στο `src/subapps/dxf-viewer/`.

### 4.1 Υπάρχει (απευθείας reusable — SEARCH FIRST, μην ξαναφτιάξεις)

| Κομμάτι | Αρχείο / signature | Ρόλος |
|---|---|---|
| **Boolean union πολυγώνων** | `bim/geometry/shared/safe-polygon-boolean.ts` → `safeUnion/safeIntersection/safeDifference` | Wrapper polygon-clipping@0.15.7 (MIT), crash-proof, meter-scale robust. Ήδη ενώνει επικαλυπτόμενα αποτυπώματα (`building-footprint.ts`). **Άμεσα reusable για εσχάρα.** |
| **Ανίχνευση περιοχών/ορθογωνίων** | `bim/walls/perimeter-from-faces.ts` (`extractClosedPolygons`, `perimeterFacesToRects`, `unionTouchingPolygons` via safeUnion, `getCachedRegionPerimeters` WeakMap), `bim/walls/wall-in-region.ts` (`extractLineSegments`, `findRectanglesFromSegments`, `findEnclosingRectangle`, `buildWallFillingRect`) | Corner-graph rectangle detector + κλειστά polygons από DXF lines. Κοινό SSoT wall+column region. |
| **Strip από τοίχο (1)** | `bim/foundations/foundation-from-wall.ts` → `buildStripFromWall(wall, overrides, levelId, sceneUnits)` | Εξάγει start/end + width=wall.thickness → `completeFoundationFromTwoClicks(...,'strip',...)`. Re-export `pickWallEntityAt` (κοινό hit-test). |
| **Foundation geometry/entity** | `bim/geometry/foundation-geometry.ts` → `computeFoundationGeometry` (strip/tie-beam = `buildBandFootprint` band start→end× width· pad = rect+anchor+rotation), `hooks/drawing/foundation-completion.ts` → `buildFoundationEntity`, `buildDefaultFoundationParams`, `completeFoundationFromTwoClicks` | Pure builders. strip & tie-beam = ΙΔΙΟ geometry, διαφορά IFC + default width. |
| **Batch pattern (N entities σε loop)** | `hooks/drawing/use-wall-commit.ts` → `buildFillingWalls`, `commitInRegionRects`, `commitPerimeterFaces` | Πρότυπο για `buildFoundationsFromAllWalls`. Κάθε entity → `onCreated` ένα-ένα + EventBus toast (`bim:walls-from-perimeter`). |
| **Wall auto-join / miter** | `bim/walls/wall-region-autojoin.ts` (`extendFillingWallToNeighbors`, ray-extend endpoints), `bim/walls/wall-trims.ts` (miter trim engine bevel/butt + `applyTrimPatches`), `addWallToScene` (recompute trims όλων) | Πρότυπο join στις διασταυρώσεις (γεωμετρικό extension, ΟΧΙ boolean). |
| **CompoundCommand (atomic undo)** | `core/commands/CompoundCommand.ts` | Atomic execute/undo, nested, serializable. (Το wall batch ΔΕΝ το χρησιμοποιεί — undo ανά entity.) |
| **Insert foundation** | `bim/foundations/add-foundation-to-scene.ts` → `addFoundationToScene` | Thin wrapper `appendEntityToScene(...,'foundation')`. Χωρίς miter (foundations δεν join-αρονται σήμερα). |
| **Tool / ribbon** | `hooks/drawing/useFoundationTool.ts` (FSM: pad single-click, strip/tie-beam 2-click, from-wall 1-click· `placementMode: 'freehand'\|'from-wall'`), `bim/foundations/foundation-preview-store.ts`, `systems/tools/tool-definitions.ts` (4 ids), `ui/ribbon/data/home-tab-draw.ts`, `ui/ribbon/data/contextual-foundation-tab.ts` | Entry points + contextual panels (pad-only / line-only / elevation). |
| **Region foundation = slab** | (ADR-436 §3.6) εδαφόπλακα/κοιτόστρωση = REUSE `SlabEntity` (kinds ground/foundation) | Για «ενιαίο σώμα» αναπαράσταση, μία επιλογή = slab με openings. |

### 4.2 Λείπει (νέος κώδικας)

1. **`buildStripGridFromWalls(walls[], overrides, levelId, sceneUnits)`** — batch loop (mirror `buildFillingWalls`): κάθε φέρων τοίχος → `buildStripFromWall` → array `FoundationEntity`.
2. **Ένωση στις διασταυρώσεις** — είτε (α) **trim/miter** σαν τους τοίχους (διακριτά entities, χωρίς overlap), είτε (β) **safeUnion** των band footprints σε ΕΝΑ σώμα (polygon-with-holes). Χωρίς αυτό → διπλό υλικό/όγκος στις διασταυρώσεις, λάθος BOQ.
3. **Dedup overlapping strips** — παράλληλοι κοντινοί τοίχοι (διαχωριστικός + φέρων) → bands επικαλύπτονται· dedup (ίδιος άξονας ± tol) ή merge.
4. **Νέο placement mode + FSM branch** στο `useFoundationTool` (π.χ. `'grid'` / `'from-all-walls'`) + commit (mirror `commitPerimeterFaces`).
5. **Atomic undo** για όλη την εσχάρα (10-50 strips) → `CompoundCommand` (το wall batch δεν το κάνει· για εσχάρα ο χρήστης περιμένει 1 undo).
6. **Ribbon entry** — νέο subvariant/tool id + EventBus toast («Δημιουργήθηκαν N πεδιλοδοκοί»).
7. **(Αν «ενιαίο σώμα»)** νέα αναπαράσταση: είτε νέο foundation kind με polygon-with-holes geometry, είτε reuse SlabEntity (foundation kind) με slab-openings.

---

## 5. Ανοιχτές αποφάσεις (ΕΚΚΡΕΜΟΥΝ — συνέχεια συζήτησης με Giorgio)

1. **Πηγή / trigger της εσχάρας:**
   - (Α) Από τους **τοίχους** (batch· πιο κοντά στην υποδομή + στην εικόνα). ← πρόταση Opus
   - (Β) Από **περίγραμμα/region** (σχεδιάζεις γραμμές → ανίχνευση φατνωμάτων).
   - (Γ) Από **κολώνες** (πέδιλα στις κολώνες + συνδετήριες/grid lines).

2. **Αναπαράσταση αποτελέσματος:**
   - (Α) **Διακριτοί πεδιλοδοκοί + join** στις διασταυρώσεις (Revit-like· 1 entity ανά γραμμή· BOQ/IFC ανά στοιχείο· φαίνεται ενιαίο· θέλει trim engine).
   - (Β) **Ένα ενοποιημένο σώμα** (safeUnion → 1 entity polygon-με-τρύπες· όπως η εικόνα· απλούστερο visual + BOQ· χάνεις ανά-στοιχείο ανάλυση· νέο kind ή reuse slab).

3. **Συνδετήριες δοκοί ταυτόχρονα;**
   - (Α) Όχι, μόνο πεδιλοδοκοί (v1 εστιασμένο). ← πρόταση Opus για v1
   - (Β) Ναι, πεδιλοδοκοί + συνδετήριες σε ένα undo (value-add, μεγαλύτερο scope).

---

## 6. Πρόταση Opus (draft — προς συζήτηση)

**v1 = «Εσχάρα πεδιλοδοκών από τοίχους», διακριτά entities με join, χωρίς συνδετήριες:**
- Trigger: μία εντολή (ribbon button) που παίρνει όλους τους φέροντες τοίχους της σκηνής → `buildStripGridFromWalls`.
- Join: reuse pattern `extendFillingWallToNeighbors` (extend endpoints) ή trim· για σωστή BOQ υπολογίζουμε **unioned area/volume** με `safeUnion` (χωρίς να merge-άρουμε τα entities).
- Entities: διακριτό `FoundationEntity` (strip) ανά τοίχο → σωστό BOQ/IFC/audit (ADR-436).
- Undo: `CompoundCommand` (atomic για όλη την εσχάρα).
- Εκτέλεση: **Plan Mode** (cohesive foundation domain) ή **Orchestrator** (5+ αρχεία, geometry/batch/ribbon/command) — απόφαση Giorgio (N.8). Μοντέλο: **Opus**.

**Εναλλακτική (αν ο Giorgio θέλει ακριβώς την εικόνα):** «ενιαίο σώμα» via `safeUnion` → 1 entity (slab-foundation με openings ή νέο kind) — απλούστερο, αλλά χάνει την ανά-πεδιλοδοκό ανάλυση.

---

## 7. Επόμενα βήματα

1. **[ΕΚΚΡΕΜΕΙ — Giorgio]** Απαντήσεις στις 3 ανοιχτές αποφάσεις (§5).
2. Μετά: Plan Mode (ή Orchestrator) με ακριβές file plan βάσει §4.2.
3. Υλοποίηση reusing §4.1 (safeUnion, buildStripFromWall, batch pattern, CompoundCommand).
4. Tests (geometry union, batch, FSM) + N.15 docs.

---

## 8. Ευρύτερη φιλοσοφία & στρατηγική (καταγραφή συζήτησης Giorgio, 2026-06-11)

Ο Giorgio εξήγησε τη συνολική φιλοσοφία — η εσχάρα πεδιλοδοκών είναι **το πρώτο κομμάτι** ενός μεγαλύτερου στόχου. Καταγράφεται εδώ ως κατεύθυνση.

### 8.1 Διπλό mode εφαρμογής
1. **Design from scratch** — ο χρήστης σχεδιάζει 2D/3D οντότητες στον καμβά (το σημερινό).
2. **Import-driven erection** — εισάγεις **DXF σχέδια μηχανικών** (στατικά / αρχιτεκτονικά / Η/Μ, π.χ. πλήρη σχέδια αδείας) και **ανεγείρεις ημι-αυτόματα το 3D μοντέλο**, **bottom-up**: θεμελίωση → υπόγειο/-α → ισόγειο → όροφοι. Εστίαση: **οπλισμένο σκυρόδεμα** (όχι μεταλλικές, προς το παρόν).

**Στόχος (LOCKED ως αρχή):** δραστική **επιτάχυνση του 3D στησίματος** — ο μηχανικός δίνει περίγραμμα/εντολές, το σύστημα γεμίζει — **ημι-αυτόματο, παραμετρικό, πολυπαραγοντικό**.

### 8.2 Παραμετρική θεμελίωση (το αίτημα του Giorgio)
Δίνεις **περίγραμμα** → εντολή «φτιάξε εσχάρα πεδίλων **N×M φατνώματα**», με:
- αυξομείωση πλήθους/διαστάσεων φατνωμάτων,
- **κεντρικά ή έκκεντρα** πέδιλα,
- **μετακίνηση πέδιλου χωρίς να «σπάει»** η εσχάρα (μη-ομοιόμορφα φατνώματα),
- **διαφορετικά πάχη/ύψη** ανά πέδιλο/φάτνωμα → **πολυπαραμετρικό**.
Μετά: **συνδετήριες** (κεντρικές/έκκεντρες, με πάχη/ύψη), μετά **τοιχία/κολώνες**.

### 8.3 Πώς το κάνουν ΟΝΤΩΣ οι μεγάλοι — **GRID-FIRST (κάναβος αξόνων)**
**Όλα** τα σοβαρά εργαλεία σκυροδέματος (Revit, Tekla, CSI ETABS/SAFE, **ProtaStructure**, Allplan, SCIA, Graitec) ξεκινούν από **κάναβο αξόνων** (Α/Β/Γ… × 1/2/3…) με **μεταβλητές αποστάσεις**:
- οι **τομές** = κόμβοι (κολώνες), τα **κουτιά** = φατνώματα → ο «πίνακας N×M» = παραμετρικός κάναβος·
- **associative**: μετακινείς άξονα → **όλα τα hosted στοιχεία ακολουθούν** (= το «move χωρίς να σπάει»)· τα στοιχεία είναι **constrained στο grid**, όχι ανεξάρτητα.

➡️ **Σωστή αρχιτεκτονική: ο κάναβος = SSoT· πέδιλα/συνδετήριες/κολώνες/δοκοί = «παιδιά» του.** Λύνει ταυτόχρονα: πίνακας, αυξομείωση, move-no-break, παραμετρικότητα — σε **όλους** τους ορόφους. Η «εσχάρα από περίγραμμα» = **ειδική περίπτωση** (grid → strips στις γραμμές).

### 8.4 Ο πιο κοντινός «μεγάλος»: **ProtaStructure** (+ CSI SAFE, Graitec, Allplan)
Κάνει **ακριβώς** τον workflow του Giorgio για σκυρόδεμα: import αρχιτεκτονικό DWG ως υπόβαθρο → κολώνες/δοκοί στον κάναβο (snap στις γραμμές) → **auto-generate foundations** (isolated/strip/raft, αυτόματη διαστασιολόγηση από φορτία) → storey propagation → analysis → σχέδια.

### 8.5 Η αλήθεια για «αυτόματο 2D → 3D» (honesty)
- **Καθαρή Revit**: imported CAD = **underlay**, χειροκίνητο trace (ή Dynamo). Δεν «διαβάζει» την κάτοψη.
- **Ημι-αυτόματα** (ProtaStructure/SAFE): αναγνώριση **γραμμές → άξονες/μέλη**, με επιβεβαίωση χρήστη.
- **AI «κάτοψη → 3D»** (Snaptrude, TestFit, Hypar, ARKio, startups): **emerging, human-in-the-loop**.
- ➡️ **Το πλήρως αυτόματο «DXF → έτοιμο 3D» ΔΕΝ είναι λυμένο πουθενά.** Όλοι κάνουν **ημι-αυτόματο, grid-driven, με τον μηχανικό στο τιμόνι** — δηλαδή **ακριβώς** τον στόχο του Giorgio. Ρεαλιστικό & state-of-the-art.

### 8.6 Κεντρικά vs έκκεντρα πέδιλα (διευκρίνιση)
- **Κεντρικό**: κολώνα στο κέντρο (συμμετρικό φορτίο).
- **Έκκεντρο**: κολώνα στην άκρη (περιμετρικά/όρια οικοπέδου) → **ροπή** → λύση με **συνδετήρια δοκό ισορρόπησης (strap/balanced beam)** ή **κοινό πέδιλο**. Οι συνδετήριες παραλαμβάνουν διαφορικές καθιζήσεις + ροπές εκκεντρότητας + σεισμικά. Στα εργαλεία = **offset/eccentricity παράμετροι**.

### 8.7 Σύσταση κατεύθυνσης (προς συζήτηση)
Πριν την «εσχάρα» ως μεμονωμένο feature, η θεμελιώδης απόφαση = **structural grid (κάναβος) ως SSoT**, με τα δομικά στοιχεία constrained σε αυτόν. **ΑΝΟΙΧΤΟ προς διερεύνηση:** υπάρχει ήδη concept «οδηγών/guides» στη 2D σχεδίαση (`useGuideState`/`useGuideActions`/`guide-click-handlers`) — **να ελεγχθεί αν οι guides = structural grid ή κάτι διαφορετικό** (named/associative/host-bearing vs απλές βοηθητικές γραμμές). Αυτό καθορίζει αν χτίζουμε grid πάνω στο υπάρχον ή από την αρχή.

### 8.8 ΕΥΡΗΜΑ (έρευνα 2026-06-11): οι υπάρχοντες «οδηγοί/guides» ΕΙΝΑΙ ήδη structural grid (ADR-189) — λείπουν 2 κρίσιμα

Διερευνήθηκε το ερώτημα της §8.7. **Καλό νέο: ΔΕΝ ξεκινάμε από το μηδέν.** Το σύστημα `systems/guides/` (ADR-189 «Construction Grid / Guide System», εμπνευσμένο Fespa/Tekton) είναι **ήδη πλούσιος κάναβος αξόνων**, ΟΧΙ απλές γραμμές Illustrator.

**Έχει ήδη (Revit/Tekla-style):**
- Ονοματισμένους άξονες **Α/Β/Γ… × 1/2/3…** (auto ή user label) + **bubbles** στο περιθώριο (`guide-annotations-renderer.ts`).
- **Διαστάσεις (bay) μεταξύ αξόνων** (B3), **groups** («Δομικός Κάνναβος»/MEP), **structural presets** (bay 4/5/6/8m, `CreateGridFromPresetCommand`).
- **Snap engine** (`GuideSnapEngine`, intersection/midpoint/fractal), τύποι X (κατακόρυφος) / Y (οριζόντιος) / XZ (διαγώνιος).
- **IFC4 export** ως `IFCGRID`/`IFCGRIDAXIS` (Revit-importable).
- Πλήρες command set (create/move/parallel/perpendicular/rotate/scale/mirror/equalize/polar-array/from-entity) με **undo/redo**, lock, visibility.
- Store: `systems/guides/guide-store.ts` (in-memory singleton, observer pattern, max 500), `Guide` interface (`id/axis/offset/label/style/groupId/parentId/startPoint/endPoint`).

**ΛΕΙΠΟΥΝ 2 κρίσιμα για πλήρες Revit-grade grid που οδηγεί αυτόματη ανέγερση:**
1. **Persistence** — οι guides είναι **session-only** (χάνονται σε reload· καμία Firestore/localStorage). Τα BIM entities persist, οι guides όχι.
2. **Associative hosting (το κρισιμότερο κενό)** — **καμία** BIM entity (wall/column/beam/foundation/slab schema) δεν φέρει `guideId`/`gridAxisId`. Μετακινείς άξονα → **τίποτα δεν ακολουθεί**. Στη Revit, στοιχείο hosted σε grid axis ακολουθεί αυτόματα. Αυτό είναι το «move-no-break» που ζητά ο Giorgio (§8.2).

Δευτερεύοντα κενά: per-floor/per-level scope (τώρα global singleton), bubble extents, per-view crop.

**ΣΥΜΠΕΡΑΣΜΑ:** ο «κάναβος» της §8.3 **υπάρχει ήδη ως guides (ADR-189)** — είναι ~80% του δρόμου. Για να γίνει το SSoT της αυτόματης θεμελίωσης/ανέγερσης χρειάζεται: **(α) persistence** + **(β) associative hosting** (BIM entities → constrained σε guide axes, follow-on-move). Τότε: εσχάρα πεδίλων = «πέδιλα στις τομές/γραμμές του grid», και το «N×M φατνώματα / αυξομείωση / move-no-break / παραμετρικό» βγαίνουν φυσικά. **Σχέση: ADR-189 (grid) + ADR-436 (foundation) + ADR-441 (αυτό).**

## 9. Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-06-11 | Opus | Αρχική σύνταξη (DRAFT): καταγραφή συζήτησης Giorgio (εικόνες εσχάρας πεδιλοδοκών, δομική θεωρία, Revit comparison «ένα-ένα ανά κατηγορία») + ευρήματα έρευνας κώδικα (τι υπάρχει/τι λείπει: safeUnion + region detection + buildStripFromWall + batch pattern + CompoundCommand υπάρχουν· batch-from-walls + crossing-join/union + grid FSM/ribbon λείπουν) + 3 ανοιχτές αποφάσεις (trigger / αναπαράσταση / συνδετήριες) + πρόταση v1. Status PROPOSED — συνέχεια συζήτησης. ΟΧΙ κώδικας ακόμη. |
| 2026-06-11 | Opus | +§8 Ευρύτερη φιλοσοφία & στρατηγική (καταγραφή 2ης συζήτησης Giorgio): διπλό mode (design-from-scratch + import-driven bottom-up erection θεμελίωση→όροφοι, σκυρόδεμα)· παραμετρική θεμελίωση N×M φατνώματα (αυξομείωση/κεντρικά-έκκεντρα/move-no-break/variable πάχη-ύψη)· **GRID-FIRST** = πώς το κάνουν όλοι οι μεγάλοι (Revit/Tekla/ETABS-SAFE/ProtaStructure/Allplan/SCIA/Graitec· associative grid→hosted follow)· ProtaStructure=πιο κοντινός workflow· honesty: πλήρως-αυτόματο 2D→3D ΔΕΝ λύθηκε πουθενά, όλοι ημι-αυτόματο human-in-the-loop· κεντρικά vs έκκεντρα + strap beams· σύσταση=structural grid ως SSoT. ΑΝΟΙΧΤΟ: υπάρχοντες guides (useGuideState/Actions) == grid ή διαφορετικό (υπό διερεύνηση). |
| 2026-06-11 | Opus | +§8.8 ΕΥΡΗΜΑ (έρευνα guides): το `systems/guides/` (ADR-189) ΕΙΝΑΙ ήδη πλούσιος structural grid — named άξονες Α/Β/Γ×1/2/3 + bubbles + bay dimensions + groups + presets 4/5/6/8m + GuideSnapEngine + IFC4 IFCGRID/IFCGRIDAXIS + full command set/undo. **ΛΕΙΠΟΥΝ 2 κρίσιμα** για Revit-grade grid που οδηγεί ανέγερση: (1) **persistence** (guides=session-only, καμία Firestore) (2) **associative hosting** (καμία BIM entity δεν φέρει guideId/gridAxisId → move άξονα δεν παρασύρει στοιχεία = το «move-no-break» που ζητά ο Giorgio). Δευτερεύοντα: per-floor scope, bubble extents, crop. Συμπέρασμα: ~80% έτοιμο· grid=SSoT ανέγερσης χρειάζεται persistence+associative-hosting. Σχέση ADR-189+436+441. |
