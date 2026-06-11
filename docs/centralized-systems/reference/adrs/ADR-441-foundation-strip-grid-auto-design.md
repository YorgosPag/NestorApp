# ADR-441 — Αυτόματη Εσχάρα Πεδιλοδοκών / Ενοποιημένο Πέδιλο (Foundation Strip-Grid Auto-Design)

**Status**: 🟢 IN PROGRESS — αποφάσεις LOCKED (2026-06-11), υλοποίηση σε slices. **Slice 0+1+2+3+JOIN+4+5a+6 DONE** (Slice 1 rules+indexes DEPLOYED· Slice 3+JOIN+4+5a+6 εκκρεμούν browser-verify+commit). v1 (associative grid hosting + εσχάρα + follow-on-move + corner-fill γωνιών + BOQ net-volume + justification + **reconciling regeneration: split-safe + corner-fill-role-safe + idempotent**) ΟΛΟΚΛΗΡΩΘΗΚΕ. Σχέδιο: §10. DEFER: Slice 5 (5a-control/5a-grid/tie-beams)· Slice 6 (6b re-bind ορφανών· 6c reconcile-with-confirm)· ATOE bridge.
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

## 10. Σχέδιο υλοποίησης (LOCKED 2026-06-11) — 4 slices

**Αποφάσεις Giorgio:** (1) αφετηρία = **associative grid hosting** (Revit way)· (2) πηγή εσχάρας = **ο κάναβος (grid)**· (3) αναπαράσταση = **διακριτοί πεδιλοδοκοί + join**· (4) **ΟΧΙ** συνδετήριες v1· scope = **όλα τα slices 0→3** (έγκριση ανά slice)· grid = **per-όροφο** (Revit-grade).

**Canonical hosting model (SSoT, generic):** slot-based `GuideBinding { guideId, slot }` όπου `slot ∈ {start-x,start-y,end-x,end-y,center-x,center-y}`, σε `BimEntity.guideBindings?` (base). Υπερκαλύπτει foundation-specific tags· επιτρέπει αύριο wall/column/beam χωρίς re-write.

- **Slice 0 — Hosting types (✅ DONE):** `bim/hosting/guide-binding-types.ts` (GuideBinding/GuideBindingSlot/HostedEntityMixin + extractBoundGuideIds/hasGuideBindings)· `BimEntity.guideBindings?` (`bim/types/bim-base.ts`)· Zod `bim/types/guide-binding.schemas.ts` + foundation entity schema. Backward-compatible (optional· entity schemas `.passthrough()`). 11 jest + 383 regression PASS.
- **Slice 1 — Grid persistence per-όροφο (✅ DONE + DEPLOYED):** mirror foundation Firestore· 1 doc/floor (`floorplan_grid_guides`, grd_* enterprise-id)· `GridGuideFirestoreService` (createGrid setDoc / updateGrid)· `useGridGuidePersistence` (hydrate `clear`+`restoreGroup`/`restoreGuide`· debounced 1000ms save με anti-echo signature guard· per-floor reset `store.clear()` on scope change)· `GridGuidePersistenceHost` mounted στο DxfViewerTopBar· serialization `guideToSnapshot` (strips temporary + undefined keys, Firestore-safe). + firestore.rules match block + 4 indexes **DEPLOYED στο pagonis-87766**. 14 jest PASS.
- **Slice 2 — Εσχάρα από grid (1ο ορατό) (✅ DONE):** `bim/foundations/foundation-from-grid.ts` (`buildStripGridFromGuides`· intersection-to-intersection segments → zero-overlap join· strips born-hosted με slot-based `guideBindings`· dedup σχεδόν-ταυτόσημων offsets· invisible-skip· `<2 άξονες/διεύθυνση`→`insufficient-guides`)· orchestrator `bim/foundations/foundation-grid-commit.ts` (`commitFoundationGridFromGuides` → ΕΝΑ atomic `CreateFoundationsCommand`, 1 undo)· batch command `core/commands/entity-commands/CreateFoundationsCommand.ts` (πιστό mirror `CreateMepSegmentsCommand`: scene via `ISceneManager`, Firestore via deferred `drawing:entity-created`/`bim:foundation-delete-requested` σε microtask — persistence-correct create **και** undo). **ΔΙΟΡΘΩΣΗ σχεδίου vs draft:** (α) **ribbon `action` (`foundation.actions.fromGrid`), ΟΧΙ canvas tool** — η εσχάρα διαβάζει υπάρχοντα κάναβο, καμία canvas αλληλεπίδραση → ταιριάζει στο one-shot πρότυπο των MEP auto-design bridges, όχι σε fake tool· (β) **`CreateFoundationsCommand` αντί generic `CompoundCommand<CreateEntityCommand>`** — το `CreateEntityCommand` δεν εκπέμπει `drawing:entity-created` → strips δεν θα persist-άρανε ποτέ. Wiring: `useRibbonFoundationBridge.onAction` (`handleFromGrid`)· ribbon subVariant στο `foundationGroup`· events `bim:foundations-from-grid{built,ignored}` / `bim:foundations-from-grid-failed{reason}`· toast μέσω `useDxfViewerNotifications` (ICU plurals)· i18n el/en. 16 jest (7 grid builder + 3 commit + 6 command). ΕΚΤΟΣ ADR-040 (one-shot batch, καμία preview-store/canvas/renderer/guide-render αλλαγή· grid read μέσω `getGlobalGuideStore()` στο event-time, χωρίς high-freq subscription). BOQ overlap στους κόμβους = `safeUnion` offline (DEFER Slice 4).
- **Slice 3 — Follow-on-move (✅ DONE):** μετακινείς άξονα κανάβου → όλα τα hosted strips ακολουθούν live (60fps) + persist on drag-complete (Revit associative grid). Pure-first αρχιτεκτονική:
  - NEW `bim/hosting/derive-params-from-guides.ts` — `deriveFoundationParamsFromGuides(params, bindings, getOffset)`: slot→coordinate writes (start-x→start.x… center-x→position.x), immutable, idempotent (no-change→`null`). XZ/διαγραμμένος άξονας (offset undefined) → slot αγνοείται.
  - NEW `bim/hosting/guide-hosting-reconciler.ts` — pure `buildHostingIndex` (inverted index `Map<guideId,Set<entityId>>`) + `reconcileHostedFoundations` (only-changed updates· geometry+validation re-derived από SSoT `computeFoundationGeometry`/`validateFoundationParams`).
  - NEW `hooks/data/useHostingReconciler.ts` + `app/HostingReconcilerHost.tsx` — **το μόνο stateful κομμάτι (ADR-040)**: imperative `guide-store.subscribe`, **RAF-throttled 1×/frame**, per-tick diff των bound-axis offsets (skip unrelated notifies), only-changed `setLevelScene`. Loop-free (ακούει μόνο guide-store). Mount στο `DxfViewerTopBar` δίπλα στα persistence hosts.
  - **Persist on drag-complete:** settle-debounce (350ms) → `EventBus.emit('bim:entities-moved')` με τις moved strips → reuse `useBimEntityMovedPersistEffect` (ADR-436), **κανένα νέο persist path**.
  - **Persist bindings (ΚΡΙΣΙΜΟ):** MOD `FoundationDoc` + `entityToSaveInput` (`foundation-firestore-service.ts`) + `docToEntity` (`useFoundationPersistence.ts`) → `guideBindings` round-trip· **καμία αλλαγή firestore.rules** (create rule = `hasAll` allowlist, επιτρέπει το nested field· update rule δεν το απαγορεύει).
  - Stage ADR-040 (changelog entry· νέα αρχεία ΕΚΤΟΣ CHECK 6B/6D paths). 22 jest (8 derive + 6 reconciler + 4 firestore-service guideBindings + 4 υπάρχοντα regression) + tsc καθαρό δικά μου. DEFER: wall/column/beam hosting (derive→strategy registry ανά kind), XZ/διαγώνιοι άξονες, per-tick guide-offset snapshot persistence για undo-after-reload.
- **Slice JOIN — Corner-fill γωνιών (✅ DONE):** έκλεισε τα ακάλυπτα `w/2 × w/2` τεταρτημόρια στις **4 εξωτερικές γωνίες** της εσχάρας (οι λωρίδες σταματούσαν στο centerline → ορατά κενά γωνιών· εσωτερικοί κόμβοι ήδη πλήρως καλυμμένοι από επικάλυψη). **Follow-move-safe** (κρίσιμο): η επέκταση δεν είναι σκέτη αλλαγή start/end (το Slice 3 derive θα την ακύρωνε σε κάθε move) αλλά **νέο optional `extend?: number` (mm, signed) στο `GuideBinding` endpoint** = σταθερή απόσταση *σχετικά με τον (μετακινούμενο) άξονα*, άρα επιβιώνει του re-derive. MOD: `bim/hosting/guide-binding-types.ts` (`GuideBinding.extend?`) + `bim/types/guide-binding.schemas.ts` (`extend: z.number().optional()` — `.strict()` schema, αλλιώς restore σκάει) + `bim/hosting/derive-params-from-guides.ts` (honor `extend` με mm→scene conversion μέσω SSoT `mmScaleFor`, ΜΟΝΟ στο extend term· idempotent διατηρείται) + `bim/foundations/foundation-from-grid.ts` (extend `±width/2` ΜΟΝΟ σε **γωνιακά** endpoints = extreme-parallel-axis × extreme-perpendicular-axis· refactor σε `emitVerticalStrips`/`emitHorizontalStrips` helpers για ≤40γρ· geometry baked στο build + binding tag, ίδια φόρμουλα με derive → consistent). **ΟΧΙ** επέκταση μη-γωνιακών περιμετρικών άκρων (θα προεξείχαν «δόντια»). 25 jest (10 derive incl. 4 extend + 13 grid builder incl. 6 corner-fill + 2 existing updated) + tsc καθαρό. ΕΚΤΟΣ ADR-040 (όλα pure type/schema/build/derive — καμία scene-write/renderer/guide-render). DEFER Slice 4 BOQ: η επικάλυψη/extend κάνει double-count όγκου στους κόμβους → `safeUnion` offline.

**Επόμενα slices (σχεδιασμός — LOCKED 2026-06-11):**
- **Slice 4 — BOQ θεμελίωσης + net volume (safeUnion) (✅ DONE):** (Α) σύνδεση θεμελίωσης στο schedule (preset/columns/registry/UI toggle/i18n — δεν υπήρχε καθόλου foundation στο BOQ) + (Β) καθαρός (de-duplicated) όγκος εσχάρας μέσω boolean **union**. Η επικάλυψη στους κόμβους (`w × w` block ανά διασταύρωση, εγγενής στη μονολιθική αναπαράσταση) διπλομετρά τον όγκο· λύση χωρίς αλλαγή γεωμετρίας/όψης (Revit/Tekla way). NEW `bim/geometry/foundation-grid-boq.ts` (`computeFoundationGridNet` thickness-bucketed `safeUnion`· `foundationStripNetGeometry` per-strip net = gross − ½·Σ επικαλύψεων μέσω `safeIntersection`· Σ μεριδίων == union, exact για uniform πάχος) + NEW `hooks/data/foundation-boq-feed.ts` (`applyFoundationGridNet` pre-pass μόνο σε hosted grid strips). Boy-Scout SSoT: **export** `multiPolygonArea` από `polygon-utils.ts` (ήταν private duplicate ×2). Schedule: `ScheduleEntityType`+`AnyBimEntity`+`mapFoundation`+`PRESET_REGISTRY`+`FOUNDATION_COLUMNS`+`ScheduleEntityToggle`+`BimScheduleDialog` (pre-pass στο `useMemo`)+i18n el/en. Η στήλη όγκου δείχνει **net** ανά λωρίδα → άθροισμα = καθαρός όγκος, χωρίς νέα totals-infra. ΕΚΤΟΣ ADR-040 (καμία canvas/renderer αλλαγή). DEFER: ATOE/accounting bridge (`bimToBoqBridge` σε `useFoundationPersistence`)· μεταβλητό πάχος ανά grid (uniform=exact). 24 net+preset jest + 238 regression + tsc καθαρό.
- **Slice 5 — Foundation Justification + έκκεντρα πέδιλα + συνδετήριες (tie-beams):** σήμερα οι λωρίδες είναι **κεντρικές (concentric)** πάνω στον άξονα (`w/2` εκατέρωθεν) = δομικά ιδανικό default (φορτίο από κεντροβαρικό, μηδενική εκκεντρότητα). ΑΛΛΑ σε **όριο οικοπέδου / υπάρχον κτίριο** ο μηχανικός χρειάζεται **έκκεντρο** πέδιλο (ανάπτυξη μόνο προς τα μέσα, αλλιώς το `w/2` overhang περνά το όριο). Revit-grade λύση = παράμετρος **Justification (Location Line)** ανά πέδιλο.
  - **ΑΝΑΘΕΩΡΗΣΗ ΜΗΧΑΝΙΣΜΟΥ (2026-06-11, Giorgio «όπως η Revit, full SSoT»):** η αρχική draft πρότεινε `GuideBinding.extend`· μετά από Recognition στον κώδικα (code=SoT) επιλέχθηκε **καθαρότερη geometry-param λύση** (= η Revit «Location Line»: type/instance param, ΟΧΙ coordinate hack). Το justification είναι **semantic πεδίο στα `params`** (`'center'|'left'|'right'`, relative στη φορά start→end), honored στο `buildBandFootprint` ως **κάθετο shift `sign·w/2`** του centerline κατά τον CCW normal. Πλεονεκτήματα vs extend: **follow-move-safe αυτόματα** (το param επιβιώνει του `{...params}` spread στο `deriveFoundationParamsFromGuides` — δεν χρειάζεται binding μηχανισμός)· **tracks width** (offset από τρέχον width στο geometry-time, όχι fixed mm)· **single-source**· **persist ΔΩΡΕΑΝ** (round-trips μέσα στο `params`, μηδέν Firestore αλλαγή)· δουλεύει & σε **χειροκίνητες** λωρίδες (όχι μόνο grid-hosted).
  - **Slice 5a — Justification mechanism (✅ DONE 2026-06-11 Opus):** NEW `StripJustification` type + `justification?` πεδίο σε `StripFootingParams`/`TieBeamParams` (`bim/types/foundation-types.ts`, optional → backward-compatible) + SSoT `JUSTIFICATION_NORMAL_SIGN` map (`{center:0,left:1,right:-1}`) + `DEFAULT_STRIP_JUSTIFICATION='center'`. Honored στο `buildBandFootprint` (`bim/geometry/foundation-geometry.ts`, κάθετη μετατόπιση centerline κατά `sign·hw` πριν το band· `center`→0→**identical footprint, zero regression**). Schema `StripJustificationSchema` + `.optional()` σε strip/tie-beam (`foundation.schemas.ts`, `.strict()`-safe). Override plumbing στο `FoundationParamOverrides` + `buildDefaultFoundationParams` line branch (`foundation-completion.ts`, conditional spread → Firestore-safe undefined). **Default `center` → καμία οπτική/συμπεριφορική αλλαγή.** 54 jest (geometry left/right/center + area/volume invariance + idempotent· derive follow-move-safe preserve· schema accept/reject) + 190/192 foundation regression (2 fails = pre-existing stale `foundation-preview-helpers.test.ts`, WYSIWYG refactor — ΟΧΙ δικά μου). ΕΚΤΟΣ ADR-040 (pure type/schema/geometry/builder — καμία scene-write/renderer/grip). Μηδέν persistence/rules αλλαγή.
  - **DEFER (επόμενες εγκρίσεις):** **5a-control** (πώς ο χρήστης ΘΕΤΕΙ justification: placement-time ribbon combobox μέσω `FoundationParamOverrides` + edit-time grip/properties toggle + i18n ICU)· **5a-grid** (auto **inward** justification στις περιμετρικές λωρίδες του `buildStripGridFromGuides` + **συμφιλίωση με corner-fill** — το ±w/2 longitudinal extend σχεδιάστηκε για centered· με έκκεντρες περιμετρικές χρειάζεται επανεξέταση + BOQ net-volume verify)· **5b** έκκεντρα pad μέσω `anchor` (υπάρχει)· **5c** strap/συνδετήριες ισορρόπησης (`tie-beam` kind· §8.6 ροπή εκκεντρότητας). Σχέση §8 (κεντρικά vs έκκεντρα + strap beams).

- **Slice 6 — Idempotent / reconciling «Εσχάρα από κάναβο» + migration ορφανών:** root cause (Giorgio 2026-06-11): παλιοί πεδιλοδοκοί δεν ακολουθούσαν τη μετακίνηση άξονα (legacy χωρίς `guideBindings`, προ-Slice-3) **και** κάθε «Εσχάρα από κάναβο» έκανε **τυφλή** παραγωγή (πλήρες νέο set → διπλοί). Revit/Tekla way = grid=SSoT, members hosted+follow, **generation idempotent/managed** (ξέρει τα existing, δεν διπλασιάζει· νέος άξονας → σκόπιμο re-run, ΟΧΙ μαγική auto-create).
  - **Slice 6 (full reconcile) — managed regeneration via signature-set diff (✅ DONE 2026-06-11 Opus):** το αρχικό 6a (exact-key skip / add-only) **αναθεωρήθηκε**: έλυνε το re-run ίδιου κανάβου αλλά **έσπαγε σε αλλαγή τοπολογίας** (Giorgio repro): (α) **ενδιάμεσος** οδηγός υποδιαιρεί bays → split λωρίδες με νέα keys → δημιουργούνται **πάνω** στις παλιές whole· (β) **εξωτερικός** οδηγός → παλιά περιμετρική γίνεται εσωτερική αλλά **κρατά** το corner-fill `extend` (προεξέχει). Κοινή ρίζα: incremental-add ≠ managed-reconcile. **ΛΥΣΗ = signature-set diff** (Revit/Tekla managed regeneration): NEW pure `gridStripSignature(strip) → string|null` = `segmentKey | rounded(start) | rounded(end)` (grid-ταυτότητα + γεωμετρία· το `extend` αλλάζει τα coords → ξεχωρίζει περιμετρική vs εσωτερική· μη-grid → `null`). NEW pure `foundation-grid-reconcile.ts` `reconcileGridStrips(target, existing) → {toCreate, toDelete, unchanged}`: target-sig ∉ existing → create· existing-sig ∉ target → delete· σε αμφότερα → αμετάβλητη (**κρατά id, μηδέν write**)· null-sig (legacy ορφανές/χειροκίνητες) **ΠΟΤΕ** delete. NEW `core/commands/entity-commands/DeleteFoundationsCommand.ts` = inverse του `CreateFoundationsCommand` (scene remove + deferred `bim:foundation-delete-requested`· undo = re-add + `drawing:entity-created` re-persist αρχικά ids). Orchestrator `commitFoundationGridFromGuides`: build full target → reconcile vs existing grid-managed → εκτελεί **ΕΝΑ** `CompoundCommand([Delete?, Create?])` (1 undo)· no-op → `reason:'up-to-date'`· result `{created, deleted, unchanged}`. **REVERT** η 6a προσθήκη `coveredKeys`/`skippedCount` (ο builder ξαναγίνεται full-target). UI: event `bim:foundations-from-grid {created, deleted}`· toast `built`/`reconciled`/`upToDate` (ICU el/en). 48 jest (13 segment+signature, 6 reconcile, 6 delete-cmd, 6 create-cmd, 11 builder, 5 orchestrator + reconcile scenarios) + tsc. ΕΚΤΟΣ ADR-040 (pure build/reconcile + commands· grid read event-time). **Αποτέλεσμα: split-safe + corner-fill-role-safe + idempotent· τέρμα οι διπλοί, η παλιά ακραία επανέρχεται στο centerline· 1 Ctrl+Z αναιρεί όλο το reconcile· minimal mutation, stable ids.**
  - **DEFER:** **6b** = re-bind/migration **legacy ορφανών** (key=null χωρίς bindings· ταίριαξε geometry σε τρέχοντες guides → attach bindings → persist· χωρίς διαγραφή — οι παλιοί αρχίζουν να ακολουθούν)· **6c** = «Ενημέρωση εσχάρας» ξεχωριστή action με confirm (αν χρειαστεί reconcile χωρίς το auto-replace του main click).

**Hook point (επιβεβαιωμένο):** `guide-store.ts` `moveGuideById`/`moveDiagonalGuideById` → `notify()`· `subscribe()`+`getVersion()` καλύπτουν όλα τα move paths.

## 9. Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-06-11 | Opus | **Slice 6 fix (scale-aware signature tolerance).** Browser-verify (Giorgio screenshot): σε σκηνή ΜΕΤΡΩΝ η πρώην ακραία κάθετη εισχωρούσε `w/2` μέσα στη νέα. ΡΙΖΑ: `SIGNATURE_COORD_TOL=1` σκην. μονάδα «έτρωγε» το corner-fill overhang (`width/2 × 0.001 ≈ 0.25` σε μέτρα) → περιμετρική (με overhang) & εσωτερική (χωρίς) έπαιρναν ΙΔΙΟ signature → ο reconciler δεν αντικαθιστούσε τη stale περιμετρική. FIX: tol `1→0.001` (sub-mm σε κάθε κλίμακα· διακρίνει overhang ≥~0.1, απορροφά float-noise <<0.001) + ακέραιος `coordBucket` (καθαρό deterministic token). +2 segment regression (μέτρα overhang 0.25 ξεχωρίζει· sub-tol noise ίδιο) +1 orchestrator regression (μέτρα εξωτερικός οδηγός→deleted>0). 27 foundation-grid jest πράσινα. |
| 2026-06-11 | Opus | **Slice 6 DONE (Reconciling «Εσχάρα από κάναβο» — signature-set diff).** Το 6a (exact-key skip) **αναθεωρήθηκε**: έσπαγε σε αλλαγή τοπολογίας (Giorgio repro): ενδιάμεσος οδηγός → split πάνω σε whole· εξωτερικός → παλιά περιμετρική κρατά corner-fill. ΛΥΣΗ = managed regeneration (Revit/Tekla). NEW pure `gridStripSignature` (=`segmentKey\|round(start)\|round(end)`· extend ξεχωρίζει περιμετρική/εσωτερική· μη-grid→null) + NEW pure `foundation-grid-reconcile.ts` `reconcileGridStrips(target,existing)→{toCreate,toDelete,unchanged}` (sig-set diff· null-sig legacy/manual ΠΟΤΕ delete) + NEW `DeleteFoundationsCommand` (inverse CreateFoundationsCommand, deferred persistence events). Orchestrator → ΕΝΑ `CompoundCommand([Delete?,Create?])` (1 undo)· no-op→`reason:'up-to-date'`· result `{created,deleted,unchanged}`. REVERT 6a `coveredKeys`/`skippedCount`. UI: event `{created,deleted}`· toast `built`/`reconciled`/`upToDate` (ICU el/en). 48 jest + tsc. ΕΚΤΟΣ ADR-040. Μηδέν rules. split-safe + corner-fill-role-safe + idempotent + minimal-mutation/stable-ids. 🔴 browser-verify+commit. DEFER: 6b re-bind ορφανών· 6c reconcile-with-confirm UI. |
| 2026-06-11 | Opus | **Slice 5a DONE (Foundation Justification — geometry-param mechanism) + ΑΝΑΘΕΩΡΗΣΗ μηχανισμού.** Giorgio «όπως η Revit, full enterprise + full SSoT» → αναθεωρήθηκε η κλειδωμένη draft (`GuideBinding.extend`) σε **geometry-param** (Revit «Location Line»: semantic param στα `params`, honored στο geometry· follow-move-safe αυτόματα μέσω του `{...params}` spread στο derive· tracks width· single-source· persist δωρεάν· δουλεύει & σε χειροκίνητες λωρίδες). NEW `StripJustification` type + `justification?` σε strip/tie-beam params + SSoT `JUSTIFICATION_NORMAL_SIGN` map + `DEFAULT_STRIP_JUSTIFICATION` (foundation-types.ts)· κάθετο shift `sign·hw` του centerline στο `buildBandFootprint` (foundation-geometry.ts, center→0→identical/zero-regression)· `StripJustificationSchema.optional()` σε strip/tie-beam (foundation.schemas.ts)· override plumbing (foundation-completion.ts conditional spread). Default `center` → καμία ορατή αλλαγή. 54 jest (geometry/derive-follow-move-safe/schema) + 190/192 foundation regression (2 fails pre-existing stale preview-helpers, ΟΧΙ δικά μου). ΕΚΤΟΣ ADR-040. Μηδέν persistence/rules. DEFER: 5a-control (UI set), 5a-grid (auto perimeter + corner-fill reconcile + BOQ verify), 5b pad anchor, 5c strap/tie-beams. |
| 2026-06-11 | Opus | **Slice 4 DONE (BOQ θεμελίωσης + net volume safeUnion) + §10 +Slice 5 σχεδιασμός.** Εύρημα: η θεμελίωση ΔΕΝ ήταν καθόλου στο schedule/BOQ → Slice 4 = (Α) σύνδεση + (Β) anti-double-count. NEW `bim/geometry/foundation-grid-boq.ts` (computeFoundationGridNet thickness-bucketed safeUnion + foundationStripNetGeometry per-strip net via safeIntersection, Σ μεριδίων==union exact uniform) + NEW `hooks/data/foundation-boq-feed.ts` (applyFoundationGridNet pre-pass hosted grid strips). Boy-Scout: export `multiPolygonArea` από polygon-utils (private duplicate ×2 → SSoT· refactor footprint-region-classifier). Schedule wiring: types ScheduleEntityType +foundation, schedule-preset-columns FOUNDATION_COLUMNS, schedule-presets AnyBimEntity+mapFoundation+PRESET_REGISTRY, ScheduleEntityToggle, BimScheduleDialog (pre-pass useMemo), i18n el/en entityType.foundation. Στήλη όγκου = net ανά λωρίδα → άθροισμα=καθαρός όγκος (χωρίς totals-infra). +§10 Slice 5 (Justification/έκκεντρα πέδιλα + tie-beams μέσω GuideBinding.extend). 24 net+preset jest + 238 regression + tsc καθαρό. ΕΚΤΟΣ ADR-040. DEFER ATOE bridge + μεταβλητό πάχος. 🔴 browser-verify+commit. |
| 2026-06-11 | Opus | **Slice JOIN DONE (corner-fill γωνιών εσχάρας, follow-move-safe).** Έκλεισε τα ακάλυπτα `w/2 × w/2` τεταρτημόρια στις 4 εξωτερικές γωνίες (λωρίδες σταματούσαν στο centerline). Λύση = optional `extend?: number` (mm, signed) στο `GuideBinding` endpoint (σταθερή απόσταση σχετικά με τον άξονα → επιβιώνει του Slice 3 re-derive· σκέτη αλλαγή start/end θα ακυρωνόταν σε κάθε follow-move). MOD: `guide-binding-types.ts` (`extend?`) + `guide-binding.schemas.ts` (`.strict()` +`extend` optional) + `derive-params-from-guides.ts` (honor extend, mm→scene μέσω SSoT `mmScaleFor` ΜΟΝΟ στο extend term, idempotent ok) + `foundation-from-grid.ts` (extend `±width/2` ΜΟΝΟ σε γωνιακά endpoints = extreme-parallel × extreme-perpendicular· refactor `emitVerticalStrips`/`emitHorizontalStrips` ≤40γρ· geometry baked στο build ίδια φόρμουλα με derive). ΟΧΙ επέκταση μη-γωνιακών (αποφυγή «δοντιών»). 25 jest (4 extend derive + 6 corner-fill grid + updates) + tsc καθαρό. ΕΚΤΟΣ ADR-040. DEFER Slice 4 BOQ double-count→safeUnion. |
| 2026-06-11 | Opus | Αρχική σύνταξη (DRAFT): καταγραφή συζήτησης Giorgio (εικόνες εσχάρας πεδιλοδοκών, δομική θεωρία, Revit comparison «ένα-ένα ανά κατηγορία») + ευρήματα έρευνας κώδικα (τι υπάρχει/τι λείπει: safeUnion + region detection + buildStripFromWall + batch pattern + CompoundCommand υπάρχουν· batch-from-walls + crossing-join/union + grid FSM/ribbon λείπουν) + 3 ανοιχτές αποφάσεις (trigger / αναπαράσταση / συνδετήριες) + πρόταση v1. Status PROPOSED — συνέχεια συζήτησης. ΟΧΙ κώδικας ακόμη. |
| 2026-06-11 | Opus | +§8 Ευρύτερη φιλοσοφία & στρατηγική (καταγραφή 2ης συζήτησης Giorgio): διπλό mode (design-from-scratch + import-driven bottom-up erection θεμελίωση→όροφοι, σκυρόδεμα)· παραμετρική θεμελίωση N×M φατνώματα (αυξομείωση/κεντρικά-έκκεντρα/move-no-break/variable πάχη-ύψη)· **GRID-FIRST** = πώς το κάνουν όλοι οι μεγάλοι (Revit/Tekla/ETABS-SAFE/ProtaStructure/Allplan/SCIA/Graitec· associative grid→hosted follow)· ProtaStructure=πιο κοντινός workflow· honesty: πλήρως-αυτόματο 2D→3D ΔΕΝ λύθηκε πουθενά, όλοι ημι-αυτόματο human-in-the-loop· κεντρικά vs έκκεντρα + strap beams· σύσταση=structural grid ως SSoT. ΑΝΟΙΧΤΟ: υπάρχοντες guides (useGuideState/Actions) == grid ή διαφορετικό (υπό διερεύνηση). |
| 2026-06-11 | Opus | **Slice 1 DONE + DEPLOYED.** Grid persistence per-όροφο (mirror foundation Firestore): NEW `systems/guides/guide-persistence-types.ts` (GridGuideDoc/GuideSnapshot + guideToSnapshot/snapshotToGuide serialization, strips temporary + undefined-keys) + `guide-firestore-service.ts` (GridGuideFirestoreService createGrid/updateGrid/subscribeGrid, 1 doc/floor) + `hooks/data/useGridGuidePersistence.ts` (hydrate clear+restore· debounced 1000ms save + anti-echo signature guard· per-floor reset on scope change) + `app/GridGuidePersistenceHost.tsx`. MOD: enterprise-id (GRID_GUIDE 'grd' + generateGridGuideDocId ×3 αρχεία)· firestore-collections (FLOORPLAN_GRID_GUIDES + FLOOR_SCOPED)· DxfViewerTopBar mount· firestore.rules match block· firestore.indexes 4 composite. **DEPLOYED rules+indexes → pagonis-87766.** 14 jest PASS. ΜΑΘΗΜΑ: entity schemas `.passthrough()` → guideBindings backward-compat χωρίς schema bloat. |
| 2026-06-11 | Opus | **Αποφάσεις LOCKED + Slice 0 DONE.** Giorgio: (1) associative grid hosting πρώτα· (2) πηγή=κάναβος· (3) διακριτοί+join· (4) ΟΧΙ συνδετήριες v1· scope=όλα 0→3 έγκριση ανά slice· grid per-όροφο. +§10 σχέδιο 4 slices + canonical slot-based hosting model. Status PROPOSED→IN PROGRESS. **Slice 0** (hosting types): NEW `bim/hosting/guide-binding-types.ts` + `bim/types/guide-binding.schemas.ts`· MOD `bim/types/bim-base.ts` (`BimEntity.guideBindings?`) + `foundation.schemas.ts`. Backward-compatible. 11 jest + 383 regression PASS. Recognition: επιβεβαιώθηκε hook point `guide-store.moveGuideById/moveDiagonalGuideById→notify`, `BimEntity` base, foundation persistence mirror checklist. |
| 2026-06-11 | Opus | **Slice 3 DONE (follow-on-move / associative grid hosting).** Μετακίνηση άξονα κανάβου → όλα τα hosted strips ακολουθούν live (60fps) + persist on settle (Revit/Tekla). NEW `bim/hosting/derive-params-from-guides.ts` (pure slot→coordinate, immutable, idempotent→null) + `bim/hosting/guide-hosting-reconciler.ts` (pure `buildHostingIndex` inverted index + `reconcileHostedFoundations` only-changed, geometry+validation re-derived από SSoT) + `hooks/data/useHostingReconciler.ts` + `app/HostingReconcilerHost.tsx` (ADR-040: imperative guide-store subscribe, RAF-throttled 1×/frame, per-tick bound-axis offset diff, only-changed setLevelScene, loop-free). Persist: settle-debounce 350ms → `bim:entities-moved` → reuse `useBimEntityMovedPersistEffect` (κανένα νέο path). Persist bindings: MOD `FoundationDoc`+`entityToSaveInput`+`docToEntity` (guideBindings round-trip· καμία αλλαγή firestore.rules — `hasAll` allowlist). Stage ADR-040 (changelog). 22 jest + tsc καθαρό. ΕΚΤΟΣ CHECK 6B/6D paths. DEFER: wall/column hosting (strategy registry), XZ άξονες, undo-after-reload offset snapshot. |
| 2026-06-11 | Opus | **Slice 2 DONE.** «Εσχάρα πεδιλοδοκών από κάναβο»: NEW `bim/foundations/foundation-from-grid.ts` (pure `buildStripGridFromGuides` — intersection-to-intersection zero-overlap segments, born-hosted slot-based guideBindings, dedup, invisible-skip, `<2 άξονες`→insufficient-guides) + `bim/foundations/foundation-grid-commit.ts` (orchestrator → 1 atomic command) + `core/commands/entity-commands/CreateFoundationsCommand.ts` (batch, mirror CreateMepSegmentsCommand: deferred-microtask `drawing:entity-created`/`bim:foundation-delete-requested` → persistence-correct create+undo). MOD: `useRibbonFoundationBridge.onAction` (handleFromGrid) + `foundation-command-keys` (fromGrid action) + `home-tab-draw` (subVariant) + `drawing-event-map` (2 events) + `useDxfViewerNotifications` (toast) + i18n el/en (ICU plurals). **ΔΙΟΡΘΩΣΗ σχεδίου:** ribbon `action` ΟΧΙ canvas tool (one-shot, mirror MEP auto-design)· `CreateFoundationsCommand` ΟΧΙ `CompoundCommand<CreateEntityCommand>` (το τελευταίο δεν εκπέμπει `drawing:entity-created` → δεν θα persist-άρανε). 16 jest PASS, tsc καθαρό δικά μου. ΕΚΤΟΣ ADR-040. Εκκρεμεί Slice 3 (follow-on-move). |
| 2026-06-11 | Opus | +§8.8 ΕΥΡΗΜΑ (έρευνα guides): το `systems/guides/` (ADR-189) ΕΙΝΑΙ ήδη πλούσιος structural grid — named άξονες Α/Β/Γ×1/2/3 + bubbles + bay dimensions + groups + presets 4/5/6/8m + GuideSnapEngine + IFC4 IFCGRID/IFCGRIDAXIS + full command set/undo. **ΛΕΙΠΟΥΝ 2 κρίσιμα** για Revit-grade grid που οδηγεί ανέγερση: (1) **persistence** (guides=session-only, καμία Firestore) (2) **associative hosting** (καμία BIM entity δεν φέρει guideId/gridAxisId → move άξονα δεν παρασύρει στοιχεία = το «move-no-break» που ζητά ο Giorgio). Δευτερεύοντα: per-floor scope, bubble extents, crop. Συμπέρασμα: ~80% έτοιμο· grid=SSoT ανέγερσης χρειάζεται persistence+associative-hosting. Σχέση ADR-189+436+441. |
