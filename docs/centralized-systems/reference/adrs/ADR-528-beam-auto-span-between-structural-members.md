# ADR-528 — Δοκάρι γεφυρώνει αυτόματα το κενό ανάμεσα σε δύο δομικά μέλη (beam auto-span, weld στις παρειές)

- **Status**: **Accepted — Implemented (UNCOMMITTED — browser-verify & commit εκκρεμούν, Giorgio 2026-06-25)** (2026-06-25)
- **Date**: 2026-06-25
- **Domain**: DXF Viewer — BIM / Beams / Framing / Placement snap (structural span)
- **Author**: κατόπιν εντολής Giorgio (2026-06-25)
- **Related**: **ADR-525** (L-κολόνα corner-gap auto-junction — **ΤΟ ΑΝΤΙΣΤΡΟΦΟ ΠΡΟΤΥΠΟ**· εκεί η κολόνα
  γεμίζει το κενό 2 δοκαριών, εδώ το δοκάρι γεφυρώνει το κενό 2 μελών), ADR-508 (Unified linear-member
  framing — `MemberGhostSnapResult`/`GhostFaceFrame`), ADR-514 (Unified BIM cursor snap — ο εγκέφαλος
  `resolveBimCursorSnap`), ADR-398 (Column/member placement snap — §3.10 scene targets, smart ghost),
  ADR-449 (junction weld — `useStructuralAutoAttach`), ADR-363 (beam tool FSM), ADR-040 (preview canvas
  perf — architecture-critical, CHECK 6B/6D)
- **Ratchet impact**: ΚΑΝΕΝΑ νέο registry/ratchet. ΕΝΑ νέο focused pure module (`beam-span-snap.ts`) +
  reuse `polygonCentroid` / `projectPolygonOnAxis` / `projectPointOnAxis` / `geometry-vector-utils`.
  FULL SSoT — μηδέν νέα geometry primitive, μηδέν inline math.

---

## 1. Context — το ζητούμενο (Giorgio, 2026-06-25 + στιγμιότυπο)

Στο στιγμιότυπο: κάτοψη με κολόνες/τοίχους **κυκλωμένα κόκκινα** και **κιτρινοπράσινες νοητές γραμμές**
που τα ενώνουν = «εδώ είναι εφικτό να μπει δοκάρι».

> «Η εφαρμογή να **αναγνωρίζει** όταν επιλέγω την εντολή **Δοκάρι** και βάζω τον κέρσορα **ανάμεσα σε δύο
> τείχια ή δύο κολόνες ή μία κολόνα και ένα τείχιο**, ότι εκεί μπαίνει δοκάρι. Μόλις βάζω τον κέρσορα στη
> **νοητή ευθεία** ανάμεσα στα δύο μέλη, να αντιλαμβάνεται τη θέση τους και να **ενώνει το δοκάρι στις
> κατάλληλες παρειές** αυτών των οντοτήτων.»

Δηλ.: το ghost του δοκαριού «κουμπώνει» στη νοητή γραμμή που συνδέει δύο δομικά μέλη (column–column /
wall–wall / column–wall)· τα **δύο άκρα** του δοκαριού προσγειώνονται **flush στις αντικριστές παρειές**
των δύο μελών (weld συμβολής). **= ΑΚΡΙΒΩΣ ΤΟ ΑΝΤΙΣΤΡΟΦΟ του ADR-525.**

## 2. Findings — CODE = SOURCE OF TRUTH (SSoT audit 2026-06-25)

- **Πρότυπο (αντίστροφο):** `resolveColumnBeamCornerSnap` (`column-beam-corner-snap.ts`, ADR-525) — detector
  ζεύγους (nearest-wins) + προβολή/τομή σε άξονα + reuse vector-math. Ο νέος resolver είναι ο **καθρέφτης** του.
- **Beam pipeline:** `useBeamTool` FSM (`awaitingStart → awaitingEnd`)· ghost μέσω `generateBeamPreview` →
  `makeBeamGhostBeforeClick` → `resolveBimCursorSnap({toolKind:'beam'})`· brain beam branch →
  `resolveMemberGhostSnapFromStore` → `MemberGhostSnapResult { start, end, status, faceFrame? }`.
- **Scene targets:** `sceneSnapTargetsStore` → `footprints` (**ΟΛΕΣ οι κολόνες** ως 2Δ πολύγωνα),
  `wallTargets` (`{axis, outline}`). Ένα μέλος-στήριγμα = απλώς το **κλειστό outline του**.
- **Γεωμετρία SSoT (όλα reuse):** κέντρο μέλους = `polygonCentroid` (`polygon-utils`)· προβολές outline/cursor
  σε άξονα = `projectPolygonOnAxis`/`projectPointOnAxis` (`polygon-axis-projection`)· vector-math =
  `geometry-vector-utils` (sub/add/scale — **μάθημα ADR-525: ΟΧΙ inline math**).
- **Weld:** αυτόματο μέσω `useStructuralAutoAttach` (γειτνίαση παρειά-με-παρειά, ADR-449) → **μηδέν νέος
  κώδικας weld**· η flush τοποθέτηση των άκρων αρκεί.

## 3. Decision

**ΝΕΟ pure module `bim/framing/beam-span-snap.ts`** + **νέος tier auto-span** στο beam branch του
`resolveBimCursorSnap` (gated `beamSpanGhost`). Mirror του ADR-525 (αντίστροφη φορά).

### 3.1 Γεωμετρία (orientation-agnostic, «Revit centerline trimmed-to-face»)

1. **Detector:** κάθε ζεύγος μελών (κολόνες footprints + τοίχοι outline). Νοητή ευθεία = **κέντρο→κέντρο**
   (`polygonCentroid`), μοναδιαία διεύθυνση `u`.
2. **Αντικριστές παρειές = ακραίες προβολές** κάθε outline στον `u`, προς το άλλο μέλος:
   `sA = projectPolygonOnAxis(A, A.center, u).alongMax`· `sB = |κ→κ| + projectPolygonOnAxis(B, B.center, u).alongMin`.
3. **Άκρα δοκαριού (centerline):** `start = A.center + sA·u`, `end = A.center + sB·u` — flush στις παρειές.
   Το σώμα (πλάτος ribbon) εκτείνεται ±ημι-πλάτος κάθετα· ο coordinator κάνει cutback/weld.
4. **Gating:** ο cursor πρέπει να είναι **ΑΝΑΜΕΣΑ** στις δύο παρειές (`sA ≤ along_c ≤ sB`) ΚΑΙ **κάθετα κοντά**
   στη νοητή ευθεία (`perp_c ≤ SPAN_CAPTURE_MM` = 600mm). Κενό απαραίτητο (`sB > sA` — όχι επικάλυψη).
5. **§adjacency (Giorgio 2026-06-25, EC2/EC8 — fix στιγμιότυπου):** απόρριψη ζεύγους που έχει **τρίτη
   στήριξη ανάμεσα** (`hasSupportBetween`: κέντρο k εντός `(sA,sB)` + `perp_k ≤ capture`). → ΠΟΤΕ span πάνω
   από ενδιάμεση κολόνα/τοίχο· σε σειρά 1-2-3-4 ο cursor μεταξύ 2&3 δίνει **bay 2-3**, ΟΧΙ ενιαίο 1→4.
6. **Nearest-wins:** ανάμεσα σε όλα τα έγκυρα **διαδοχικά** ζεύγη, ελάχιστη `perp_c`.
7. **§whole-line (`resolveBeamSpanChain`, Shift):** η ευθεία του φατνώματος του cursor → μάζεμα όλων των
   στηρίξεων κάθετα κοντά της → ταξινόμηση κατά μήκος → **N διαδοχικά φατνώματα** (συνεχής δοκός N ανοιγμάτων).

### 3.2 Wiring (preview ≡ commit by construction)

- `MemberGhostSnapResult.span?` (νέο optional boolean) σηματοδοτεί **πλήρες auto-span**.
- `BimCursorSnapInput.beamSpanGhost?` flag threaded: preview (`makeBeamGhostBeforeClick`) + commit
  (`useBeamTool.resolveStartAnchor`) → `resolveBimCursorSnap`. **Auto-span tier ΠΡΩΤΙΣΤΟ** στο beam branch
  (το κενό είναι μακριά από παρειές → μηδέν αλληλεπικάλυψη με το face-snap). Gated μόνο straight/cantilever
  (όχι curved, όχι from-wall, **όχι τοίχος** → ο τοίχος αμετάβλητος).
- **Preview:** το υπάρχον `makeBeamGhostBeforeClick` χτίζει το WYSIWYG ghost από `start→end` (centerline)
  → το φάντασμα **ήδη γεφυρώνει** χωρίς νέο render path.
- **Commit (single-click per-bay):** όταν `placement.span`, το ΠΡΩΤΟ κλικ καλεί `commitSpanFromState` →
  `buildDefaultBeamParams(start, end)` (centerline, ΟΧΙ location-line auto-flush) → append → **auto-weld**.
  Mirror του ADR-525 single-click. Συνεχής αλυσίδα (μένει awaitingStart).
- **Commit (Shift = whole-line):** `useCanvasClickHandler` προωθεί `shiftKey` → `useBeamTool.onCanvasClick`
  → `commitSpanChain` → `resolveBeamSpanChain` → loop `onBeamCreated` (N δοκάρια). Ίδιο SSoT στηρίξεων
  (`collectSpanSupportOutlines`) με το preview → preview ≡ commit.
- **Guide (η νοητή ευθεία):** `MemberGhostSnapResult.guide?` (canonical `PlacementAlignmentGuide`) →
  `makeBeamGhostBeforeClick` το επισυνάπτει ως `alignmentGuide` → το **υπάρχον paint pipeline** το ζωγραφίζει
  (ίδιο SSoT με τους column οδηγούς· δείχνει ΠΟΙΟ φάτνωμα κούμπωσε). Μηδέν νέος painter.

### 3.3 Decisions (Giorgio 2026-06-25, Revit/ETABS + EC2/EC8)

- **Per-bay (default):** **ένα δοκάρι ανά φάτνωμα** διαδοχικών στηρίξεων (στατικά σωστό· συνεχής δοκός =
  N διακριτά ανοίγματα με κόμβο δοκού-υποστυλώματος σε ΚΑΘΕ κολόνα). 1 κλικ = το φάτνωμα του cursor.
- **Shift (whole-line):** 1 κλικ = όλα τα φατνώματα της ευθείας (N δοκάρια μονομιάς).
- **Πλάτος** = ribbon default· **άξονας** = κέντρο→κέντρο· **άκρα flush** στις παρειές (weld = ADR-449).
- **Μέλη** = κολόνες + τοίχοι (επεκτάσιμο σε δοκάρια — additive).

## 4. Files

**NEW:**
- `bim/framing/beam-span-snap.ts` — pure detector + γεωμετρία + nearest-wins. FULL SSoT reuse.
- `bim/framing/placement-alignment-guide.ts` — **canonical SSoT `PlacementAlignmentGuide`** (μετακινήθηκε
  από `column-tangent-snap` σε neutral framing home· precedent: `GhostFaceFrame` ADR-508). Re-export alias
  στο `column-tangent-snap` → οι 7 importers (columns + paint pipeline + hover handler) αμετάβλητοι.
- `bim/framing/__tests__/beam-span-snap.test.ts` — 11 jest (per-bay flush / orientation / **§adjacency
  4-collinear** / #4 ως τοίχος / gating ×4 / nearest-wins / **whole-line chain** ×3).

**MODIFIED (reuse-only wiring):**
- `bim/framing/beam-span-snap.ts` — §adjacency (`hasSupportBetween`) + `resolveBeamSpanChain` (whole-line) +
  `collectSpanSupportOutlines` SSoT (στηρίξεις = footprints + wallTargets.outline) + `guide` στο result.
- `bim/framing/linear-member-face-snap.ts` — `MemberGhostSnapResult.span?` + `guide?` (PlacementAlignmentGuide).
- `bim/placement/bim-cursor-snap.ts` — `beamSpanGhost?` + auto-span tier (reuse `collectSpanSupportOutlines`, propagate guide).
- `hooks/drawing/beam-preview-helpers.ts` — thread `beamSpanGhost` + attach `alignmentGuide` (νοητή ευθεία).
- `hooks/drawing/useBeamTool.ts` — `resolveStartAnchor` → `spanEnd` (per-bay single-click) + `commitSpanChain` (Shift) + `shiftKey` param.
- `hooks/canvas/useCanvasClickHandler.ts` — forward `shiftKey` στο beam `onCanvasClick` (whole-line).

**SSoT centralization (Giorgio audit 2026-06-25 — DIATAGI: κεντρικοποίηση & προϋπαρχόντων διπλοτύπων):**
- `bim/geometry/shared/polygon-utils.ts` — **NEW `polygon2DCentroid(verts: Point2D[])`** SSoT (z=0 lift
  εσωτερικά). Αντικαθιστά το inline `polygonCentroid(outline.map(p=>({…,z:0})))` που είχα γράψει (διπλότυπο).
- `bim/utils/bim-characteristic-points.ts` — `centroid2D` (προϋπάρχον inline αντίγραφο) → delegate στο νέο
  `polygon2DCentroid` (κεντρικοποίηση του ΗΔΗ υπάρχοντος διπλοτύπου).
- `bim/columns/column-tangent-snap.ts` — `PlacementAlignmentGuide` interface → re-export alias του canonical.

**Flagged (large scattered pattern → pending-ratchet, ΟΧΙ inline — N.0.2):** το `verts.map(p=>({x,y,z:0}))`
Point2D→Point3D lift εμφανίζεται σε ~20 σημεία (πολλαπλά downstream: area/triangulate/centroid). Μεγάλο
sweep → καταγράφηκε στο `.claude-rules/pending-ratchet-work.md` αντί για inline fix.

## 5. Testing

- **jest:** `beam-span-snap.test.ts` (11) GREEN. Full framing+placement regression: **126/126 GREEN**.
- **tsc:** deferred (N.17 — άλλος agent έτρεχε tsc στο shared tree)· type-critical paths καλύφθηκαν από
  ts-jest (smoke import `useBeamTool`/`beam-preview-helpers`/`useCanvasClickHandler`/`bim-cursor-snap`).
- **🔴 Browser-verify (Giorgio):** εργαλείο Δοκάρι → cursor σε φάτνωμα διαδοχικών κολόνων → 1 δοκάρι flush
  + νοητή ευθεία (guide)· **Shift+κλικ** σε σειρά συγγραμμικών → N δοκάρια μονομιάς· auto-weld.
- ⚠️ **CHECK 6B/6D:** stage **ADR-040 + ADR-528 (+ ADR-508/514/525)** μαζί στο commit.

## 6. Open / Deferred

- **Shift whole-line PREVIEW (multi-bay solid ghost):** ο commit τοποθετεί N δοκάρια, αλλά το preview path
  (`drawing-hover-handler.drawPreview`) ζωγραφίζει **ένα** entity → το ghost υπό Shift δείχνει το φάτνωμα του
  cursor (+ guide), όχι ταυτόχρονα τα N solid ghosts. Πλήρες WYSIWYG multi-bay preview → χρειάζεται
  multi-entity preview infra + shift-in-hover store (ξεχωριστό ADR). _Ο per-bay default είναι πλήρως WYSIWYG._
- **Beams ως στηρίγματα** (secondary beam spanning) — additive στο `collectSpanSupportOutlines`, εκτός scope.

## 7. Changelog

- **2026-06-25** — Initial. NEW `beam-span-snap.ts` (auto-span detector, orientation-agnostic, centerline
  trimmed-to-face) + `beamSpanGhost` tier ΠΡΩΤΙΣΤΟ + `MemberGhostSnapResult.span` single-click commit. FULL
  SSoT reuse (`polygon2DCentroid`/`projectPolygonOnAxis`/`projectPointOnAxis`/vector-utils). 10 jest, 137/137
  framing+placement GREEN. UNCOMMITTED — browser-verify εκκρεμεί.
- **2026-06-25 (Giorgio SSoT audit)** — Κεντρικοποίηση 2 διπλοτύπων: (α) NEW `polygon2DCentroid` SSoT
  (`polygon-utils`) → αντικατέστησε το inline `toZ0`+`polygonCentroid` που είχα γράψει ΚΑΙ το προϋπάρχον
  `centroid2D` (`bim-characteristic-points`)· (β) `PlacementAlignmentGuide` μετακινήθηκε σε canonical
  `bim/framing/placement-alignment-guide.ts` (re-export από `column-tangent-snap`) → το `SpanGuideLine`
  διπλότυπο διαγράφηκε, reuse του τύπου που ήδη ζωγραφίζει το paint pipeline. 188/188 jest GREEN.
- **2026-06-25 (Giorgio §adjacency + whole-line, στιγμιότυπο 113244)** — Στατική διόρθωση EC2/EC8: σε σειρά
  συγγραμμικών στηρίξεων το δοκάρι **δεν** γεφυρώνει το ακραίο ζεύγος προσπερνώντας ενδιάμεσες (χάνεται ο
  αντισεισμικός κόμβος). NEW `hasSupportBetween` (adjacency filter) → per-bay· NEW `resolveBeamSpanChain`
  (Shift = όλη η σειρά, N δοκάρια)· NEW `collectSpanSupportOutlines` SSoT (στηρίξεις, reuse brain+tool)·
  guide (νοητή ευθεία) μέσω `alignmentGuide` (reuse paint pipeline). Shift forwarded `useCanvasClickHandler`
  →`useBeamTool`. 11 jest (incl. σενάριο στιγμιότυπου), 126/126 framing+placement GREEN.
