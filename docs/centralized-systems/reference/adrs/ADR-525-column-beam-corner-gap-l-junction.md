# ADR-525 — L-κολόνα γεμίζει αυτόματα το γωνιακό κενό δύο κάθετων δοκαριών (corner-gap auto-junction)

- **Status**: **Accepted — Implemented & ✅ BROWSER-VERIFIED (Giorgio 2026-06-25, UNCOMMITTED — commit εκκρεμεί)** (2026-06-25)
- **Date**: 2026-06-25
- **Domain**: DXF Viewer — BIM / Columns / Placement snap (structural junction)
- **Author**: κατόπιν εντολής Giorgio (2026-06-25)
- **Related**: ADR-523 (column-head multi-reference snap — ΤΟ ΠΡΟΤΥΠΟ· ίδιο pattern σε ΤΟΙΧΟ),
  ADR-398 (Column placement snap — §3.9/§3.11 center-on-axis· §3.17 adopt-rect auto-size single-click·
  §3.20 alignment guides), ADR-514 (Unified BIM cursor snap — ο εγκέφαλος), ADR-508 (Unified
  linear-member framing — `buildMemberAxisFrame`/`GhostFaceFrame`), ADR-499 (autoSized organism —
  `autoSized:false` user-wins), ADR-449 (junction weld — `useStructuralAutoAttach`), ADR-040 (preview
  canvas perf — architecture-critical, CHECK 6B/6D)
- **Ratchet impact**: ΚΑΝΕΝΑ νέο registry/ratchet. ΕΝΑ νέο focused pure module
  (`column-beam-corner-snap.ts`) + reuse `lineIntersectionPoint`/`buildMemberAxisFrame`/`buildCenteredAxisFaceFrame`.
  FULL SSoT — μηδέν νέα geometry primitive, μηδέν διπλό math.

---

## 1. Context — το ζητούμενο (Giorgio, 2026-06-25 + στιγμιότυπο)

Στο στιγμιότυπο: δύο δοκάρια χωρίς στήριξη, **κάθετα μεταξύ τους** (Δοκάρι «1» κατακόρυφο, Δοκάρι «2»
οριζόντιο). Αν προεκταθούν, οι παρειές τους συναντιούνται σε γωνία «Γ». Ο χρήστης επιλέγει το εργαλείο
κολόνα **«Σχήμα Γ»** (L-shape) και φέρνει το φάντασμα στο κενό.

> «Ο κώδικάς μας να **αναγνωρίζει το κενό** ανάμεσα στα δοκάρια. Όταν πηγαίνω εκεί με το φάντασμα της
> L-κολόνας, να **τοποθετείται στο σωστό σημείο**: στην **συμβολή των νοητών προεκτάσεων των ΕΞΩΤΕΡΙΚΩΝ
> ΠΑΡΕΙΩΝ** των δύο κάθετων δοκαριών. Οι **εξωτερικές παρειές της κολόνας να ταυτίζονται** με αυτές τις
> νοητές γραμμές, η **κορυφή (γωνία) του φαντάσματος** με την **τομή** των δύο νοητών προεκτάσεων. Να
> γίνεται **αυτόματη διαστασιολόγηση** ώστε οι **στενές παρειές των σκελών** της L-κολόνας να **ενώνονται
> (weld) με τις στενές παρειές (άκρα) των δοκαριών**.»

Δηλ.: η εξωτ. γωνία της L πέφτει στην τομή των 2 εξωτ.-παρειών-προεκτάσεων· κάθε σκέλος αυτο-διαστασιολογείται
ώστε το άκρο του να φτάνει flush στο άκρο του αντίστοιχου δοκαριού → boundary element της συμβολής (EC8).

## 2. Findings — CODE = SOURCE OF TRUTH (SSoT audit 2026-06-25)

- **Η L-διατομή υποστηρίζει ανεξάρτητα πάχη σκελών:** `lshapeMetrics`/`buildLshapeLocal`
  (`column-geometry.ts`) → bbox `width × depth`, `armWidth` = πάχος κατακόρυφου σκέλους (τοπικός x),
  `armLength` = πάχος οριζόντιου σκέλους (τοπικός y). **Άρα όταν τα δύο δοκάρια έχουν διαφορετικά πάχη
  (π.χ. 250 & 300), κάθε σκέλος παίρνει ΑΚΡΙΒΩΣ το πάχος του — μηδέν συμβιβασμός, ακριβής γωνία.**
- **Member frames:** `buildMemberAxisFrame(axis, outline)` (`column-face-snap-helpers.ts`) → `{a,u,alongMin,alongMax,halfThickness}`.
  Από εδώ βγαίνουν εξωτ. παρειές (`axis ± halfThickness·n`) + κοντά άκρα (`alongMin/alongMax`).
- **Τομή ευθειών SSoT:** `lineIntersectionPoint(a0,ua,b0,ub)` (`polygon-axis-projection.ts`) — point+dir
  infinite-line· το doc του αναφέρει ρητά «column-beam-align». **Reuse, μηδέν νέο intersection helper.**
- **Auto-size single-click πρότυπο:** ADR-398 §3.17 adopt-rect → `commitColumnAt(s, center, 'center',
  rot, { width, depth, kind, autoSized:false })` (one-shot override, μηδέν 2ο κλικ-γωνία).
- **Weld:** αυτόματο μέσω `useStructuralAutoAttach` (γειτνίαση παρειά-με-παρειά, ADR-449) → **μηδέν νέος
  κώδικας weld**· η flush τοποθέτηση αρκεί.
- **Πρότυπο:** ADR-523 `resolveColumnHeadReferenceSnap` = αδελφό multi-reference snap σε **ΤΟΙΧΟ**· εδώ
  ανάλογος tier (`lCornerHit`) σε **2 δοκάρια** με auto-sizing.

## 3. Decision

**ΝΕΟ pure module `bim/columns/column-beam-corner-snap.ts`** + **νέος tier `lCornerHit`** στον
`resolveColumnFaceSnapFromTargets` (gated `lShapeGhost`). Η γεωμετρία είναι **πλήρως ντετερμινιστική**
(δεν χρειάζεται ο cursor για τον προσανατολισμό· ο cursor μόνο ενεργοποιεί τον tier κοντά στο κενό):

### 3.1 Γεωμετρία (orientation-agnostic)

1. **Detector:** ζεύγη δοκαριών με `|û_h·û_v| ≤ sin(5°)` (κάθετα). Το οριζόντιο σκέλος ανατίθεται στο
   πιο X-ευθυγραμμισμένο (rotation ≈ 0 σε axis-aligned).
2. **Εξωτερική παρειά** κάθε δοκαριού = η πλευρά **αντίθετα** από το σώμα του άλλου (sign από προβολή του
   μέσου του άλλου στην κάθετο). **Κορυφή P = `lineIntersectionPoint`** των 2 εξωτ. παρειών.
3. **Σκέλος i:** μήκος = απόσταση(P → κοντινό άκρο δοκαριού i) (flush weld)· πάχος = `2·halfThickness_i`.
   → `width=L_h`, `depth=L_v`, `armLength=2·half_h`, `armWidth=2·half_v` (mm).
4. **Προσανατολισμός:** `rotation = atan2(ê_h)` (κατεύθυνση οριζόντιου σκέλους προς το άκρο του δοκαριού)·
   `flipY = cross(ê_h, ê_v) < 0` (χειρότητα). Καλύπτει και τις 4 διατάξεις χωρίς χειροκίνητο flip.
5. **Κέντρο:** `position = P − R(τοπική θέση εξωτ. γωνίας)` → η εξωτ. γωνία της L πέφτει ΑΚΡΙΒΩΣ στο P.

### 3.2 Wiring (preview ≡ commit by construction)

- `ColumnFaceSnap.sizing?` (νέο optional) μεταφέρει την auto-διαστασιολόγηση (width/depth/armWidth/armLength/flipY mm).
- `lShapeGhost` flag (`kind==='L-shape'`) threaded: preview-helpers + mouse-handler-up → `resolveBimCursorSnap`
  → `resolveColumnFaceSnapFromTargets`. `lCornerHit` ΠΡΩΤΙΣΤΟ στο `nearestHit` (ρητή πρόθεση τοποθέτησης).
- **Preview:** `assemblePlacementGhost` περνά `sizing` ως 4ο arg στον `buildEntity` → overrides
  `{width, depth, lshape, autoSized:false}`.
- **Commit (single-click):** `mouse-handler-up` γράφει `setColumnFaceSizing`· `useColumnTool`
  awaitingPosition: όταν υπάρχει sizing → **single-click commit** (mirror adopt-rect §3.17) με
  `commitColumnAt(..., { width, depth, kind:'L-shape', lshape, autoSized:false })`. **Weld αυτόματο.**
- **Οδηγοί:** οι 2 εξωτ.-παρειές-προεκτάσεις ως `PlacementAlignmentGuide[]` (§3.20 array, preview-only).

## 4. Files

**NEW:**
- `bim/columns/column-beam-corner-snap.ts` — pure detector + γεωμετρία + L mapping + guides.
- `bim/columns/__tests__/column-beam-corner-snap.test.ts` — 12 jest (γεωμετρία, sizing, 4 orientations,
  gating, preview≡commit via `computeColumnGeometry`).

**MODIFIED (reuse-only wiring):**
- `bim/columns/column-face-snap.ts` — `ColumnFaceSnap.sizing?` + `lCornerHit` tier + `lShapeGhost` param.
- `bim/placement/bim-cursor-snap.ts` — thread `lShapeGhost`.
- `bim/placement/placement-ghost-assembly.ts` — `buildEntity` 4ο arg `sizing`.
- `hooks/drawing/column-preview-helpers.ts` — builder εφαρμόζει sizing + `lShapeGhost` flag.
- `systems/cursor/ColumnPlacementGhostStatusStore.ts` — `setColumnFaceSizing`/`getColumnFaceSizing`.
- `systems/cursor/mouse-handler-up.ts` — γράφει sizing + `lShapeGhost`.
- `hooks/drawing/useColumnTool.ts` — single-click commit όταν υπάρχει sizing.
- `hooks/drawing/column-commit-build.ts` — `ColumnSizeOverride.lshape?`.

## 5. Testing

- **jest:** `column-beam-corner-snap.test.ts` (12) + `placement-ghost-assembly.test.ts` (+1 sizing
  passthrough). Full column+placement regression: **641/641 GREEN**.
- **tsc:** deferred (N.17 — άλλος agent έτρεχε tsc στο shared tree)· type-critical paths καλύφθηκαν από
  ts-jest (το test εισάγει column-beam-corner-snap → column-face-snap → assembly → computeColumnGeometry).
- **🔴 Browser-verify (Giorgio):** 2 κάθετα unsupported δοκάρια → εργαλείο L → φάντασμα κουμπώνει στη γωνία·
  κορυφή στην τομή· εξωτ. παρειές ταυτισμένες· σκέλη ως τα άκρα δοκαριών· single-click commit· auto-weld.
- ⚠️ **CHECK 6B/6D:** stage **ADR-040 + ADR-525 (+ ADR-398/514/523)** μαζί στο commit.

## 6. Changelog

- **2026-06-25** — Initial. NEW `column-beam-corner-snap.ts` (corner-gap auto-junction, orientation-agnostic,
  ανεξάρτητα πάχη σκελών) + `lCornerHit` tier + single-click sizing flow. FULL SSoT reuse. 12+1 jest, 641/641
  column+placement GREEN. UNCOMMITTED — browser-verify εκκρεμεί.
