# HANDOFF — ADR-456 Slice 3b: Καμπύλες γωνίες στεφανιών (rounded stirrup bends, Revit-grade)

**Ημερομηνία:** 2026-06-14
**ADR:** ADR-456 — Στατικά: Ποσότητες & Οπλισμός (Slice 3 σχεδίαση οπλισμού)
**Μοντέλο:** Opus (geometry SSoT + 2Δ/3Δ render, ADR-040-aware)
**Στόχος:** Τα στεφάνια/συνδετήρες στις **αλλαγές διεύθυνσης (γωνίες)** να έχουν **καμπύλα τμήματα** που **αγκαλιάζουν** το κολωνοσίδερο της γωνίας — όχι απότομη ορθογώνια κοπή. Όπως Revit/Tekla. **FULL ENTERPRISE + FULL SSOT.**

---

## 🚨 ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (διάβασε ΠΡΩΤΑ)
1. **Γλώσσα:** Απαντάς ΠΑΝΤΑ Ελληνικά στον Giorgio.
2. **COMMIT:** τον κάνει **Ο GIORGIO**, ΟΧΙ εσύ (N.(-1)). Μην κάνεις commit/push.
3. **Shared working tree:** δουλεύει ΚΑΙ άλλος agent → `git add` **ΜΟΝΟ δικά σου**, ΠΟΤΕ `-A`.
4. **ADR-040:** το 2Δ αγγίζει `DxfRenderer` (CHECK 6B/6C/6D). Διάβασε ADR-040, stage το στο commit, μην βάλεις hover/selection state σε bitmap cache key.
5. **N.17:** ΕΝΑ tsc τη φορά — process-check πριν, background.
6. **Plan πρώτα (N.0.1):** Phase 1 Recognition → plan → έγκριση Giorgio ΠΡΙΝ κώδικα.
7. **Make Revit-grade decisions yourself** (feedback memory): πάρε εσύ την enterprise απόφαση, ζήτα μόνο έγκριση plan.

---

## 1. Τι ΥΠΑΡΧΕΙ ήδη (Slice 3 — IMPLEMENTED, UNCOMMITTED)

**Geometry SSoT** (pure, tested — 39 jest GREEN):
- `bim/structural/reinforcement/column-rebar-layout.ts`:
  - `computeColumnRebarLayout(r, widthMm, depthMm)` → `{ longitudinalBarsMm: Point2D[], stirrupRingMm: Point2D[] (4-corner ΟΡΘΟΓΩΝΙΟ polygon), barDiameterMm, stirrupDiameterMm }` — **LOCAL mm κεντραρισμένα**.
  - `computeStirrupLevelsMm(r, w, d, h)` → στάθμες z (πύκνωση κρίσιμων ζωνών lcr).
- `bim/structural/reinforcement/column-reinforcement-types.ts`: `ColumnStirrups { diameterMm, spacingMm, spacingCriticalMm?, type? }`· `StirrupType = 'closed-hooked'|'closed-welded'|'spiral'` (+ ORDER/DEFAULT/isStirrupType).
- `bim/structural/reinforcement/column-reinforcement-compute.ts`: ποσότητες ανά τύπο (μήκος/βάρος). **Η περίμετρος στεφανιού = `stirrupPerimeterMm` (ορθογώνιο)** — η καμπύλωση θα το αλλάξει ελαφρώς (βλ. §4 quantity).
- `bim/structural/reinforcement/column-confinement.ts`: EC8 α=αₙ·αₛ.

**Render (καταναλώνουν το ΙΔΙΟ SSoT):**
- **2Δ:** `bim/renderers/column-rebar-2d.ts` → `drawColumnRebar2D(ctx, params, pxPerMm, worldToScreen)`. Ζωγραφίζει το στεφάνι ως **κλειστό ορθογώνιο** (`moveTo`+`lineTo`×4+`closePath`) + γάντζο 135° (μόνο `closed-hooked`) + κουκκίδες ράβδων. Καλείται scene-level από `DxfRenderer.drawColumnReinforcement2D` (μέσα στο cached bitmap).
- **3Δ:** `bim-3d/converters/column-rebar-3d.ts` → `buildColumnRebarCage(column, baseY, heightMm, levelId)`. **`ringSegments`** = 4 **ευθείς κύλινδροι** ανά στάθμη (εδώ είναι η απότομη γωνία!)· `spiralSegments` = ανερχόμενη έλικα (4 ευθείες/στροφή)· `hookSegments` = γάντζος προς κέντρο. Όλα ως **InstancedMesh κυλίνδρων** (ακτίνα=Ø/2). Υλικό = **`MeshBasicMaterial` κοινό module-singleton** (άφωτο — ΜΗΝ το αλλάξεις σε lit, βλ. §6 Lessons). `frustumCulled=false`. Σύμβαση: plan `(sx,sy)`→three `(sx, y, −sy)` (AXIS_FLIP), κατακόρυφα meters baseY.
- **Toggle** `showReinforcement` (default OFF) σε καρτέλα Προβολή + contextual tab κολώνας.

**Transform SSoT:** `bim/geometry/column-geometry.ts` → `columnLocalMmToWorld(params, localMm[])` (ίδιος transform με το footprint· rotation/anchor-safe).

---

## 2. Στόχος Slice 3b — Καμπύλες γωνίες (Revit-grade)

Στις 4 γωνίες του στεφανιού (αλλαγή διεύθυνσης) ο πραγματικός συνδετήρας **λυγίζει με ακτίνα κάμψης** (mandrel) και **αγκαλιάζει** το διαμήκη οπλισμό (κολωνοσίδερο) που κάθεται στη γωνία — δεν κάνει αιχμηρή 90° κοπή.

**Κανονισμός (EC2 — EN 1992-1-1 §8.3, Table 8.1N):** ελάχιστη διάμετρος τυμπάνου κάμψης συνδετήρα `φm,min = 4·dbw` (για dbw ≤ 16mm). Άρα:
- Εσωτερική ακτίνα κάμψης `r_in = φm/2 = 2·dbw`.
- Ακτίνα **άξονα** (centerline) συνδετήρα στη γωνία `r_cl = r_in + dbw/2 = 2.5·dbw`.
- Το τόξο της γωνίας είναι τεταρτοκύκλιο (90°) ακτίνας `r_cl`, **εφαπτόμενο** στις δύο ευθείες πλευρές (offset προς τα μέσα κατά `r_cl`). Αγκαλιάζει το διαμήκη που σιτίζεται στη γωνία (ο διαμήκης κάθεται στο inset `cover + dbw + dbL/2` → το τόξο τον περιβάλλει).

**Πεδίο:** ορθογ. κολώνα· και οι 3 τύποι στεφανιού (closed-hooked/welded/spiral). Spiral = ίδια καμπύλωση γωνιών ανά στροφή.

---

## 3. SSoT design (πρόταση — επιβεβαίωσε στο Recognition)

**ΕΝΑ νέο SSoT path generator** που το καταναλώνουν 2Δ ΚΑΙ 3Δ (μηδέν διπλή γεωμετρία):

- **NEW** στο `column-rebar-layout.ts` (ή sibling `stirrup-path.ts`):
  `buildRoundedStirrupPath(ringCornersMm: Point2D[], cornerRadiusMm: number, segmentsPerArc: number) → Point2D[]` (ΚΛΕΙΣΤΟ rounded polyline σε LOCAL mm). Κάθε γωνία → τεταρτοκύκλιο ακτίνας `r_cl` εφαπτόμενο στις πλευρές. `cornerRadiusMm = 2.5·dbw` (clamp ώστε να μη ξεπερνά τη μισή πλευρά).
  - Επέκτεινε το `ColumnRebarLayout` με `stirrupPathMm: Point2D[]` (rounded) **ΔΙΠΛΑ** στο `stirrupRingMm` (κράτα και τις 4 γωνίες για backward-compat/τόξα), **Ή** αντικατάστησε το ring με path + κράτα `cornerRadiusMm` (απόφαση Recognition).
- **2Δ** (`column-rebar-2d.ts`): ζωγράφισε το rounded path. Δύο επιλογές (διάλεξε Revit-grade):
  - (α) πολύγωνο `lineTo` πάνω στα `stirrupPathMm` (απλό, SSoT-clean), **ή**
  - (β) `ctx.arcTo`/`ctx.arc` ανά γωνία (λεία ανεξαρτήτως zoom). Προτείνεται (β) με `arcTo(corner, next, rPx)` — πιο καθαρό + scale-aware.
- **3Δ** (`column-rebar-3d.ts`): αντικατέστησε τα 4 ευθεία `ringSegments` με **swept tube κατά μήκος του rounded path** (Revit-grade λεία σωλήνα): `THREE.TubeGeometry(new THREE.CatmullRomCurve3(points3D, closed=true), tubularSegments, radius=Ø/2, radialSegments)` ανά στάθμη — **ΕΝΑ geometry/στάθμη**. Για spiral: ΕΝΑΣ συνεχής CatmullRom helix (όλες οι στάθμες + rounded γωνίες) → ΕΝΑ TubeGeometry. ⚠️ Πολλές στάθμες × TubeGeometry = πολλά draw calls → **merge** με `BufferGeometryUtils.mergeGeometries` σε 1 mesh/κολώνα (ή InstancedMesh αν κρατήσεις cylinders+torus). Κράτα `MeshBasicMaterial` singleton + `frustumCulled=false`.
- **Quantity (full SSoT, enterprise):** το μήκος συνδετήρα να **παράγεται από το ίδιο path** (perimeter ορθογωνίου − γωνιακές κοπές + μήκη τόξων) αντί για σκέτο `stirrupPerimeterMm`. Έτσι το βάρος χάλυβα ταιριάζει ΑΚΡΙΒΩΣ με τη σχεδίαση (geometry-is-SSoT). Πρόσθεσε helper `stirrupPathLengthMm(path)` ή αναλυτικό `4·(side−2r) + 2πr` και τροφοδότησέ το στο `column-reinforcement-compute`. Ενημέρωσε τα jest.

**Constants:** `STIRRUP_MANDREL_FACTOR = 4` (φm/dbw), `STIRRUP_BEND_CL_FACTOR = 2.5` (r_cl/dbw) — με σχόλιο EC2 ref. Μην hardcode-άρεις σκόρπια.

---

## 4. Recognition pointers (διάβασε ΠΡΙΝ το plan)
- `column-rebar-layout.ts` (το SSoT που επεκτείνεις) + τα 2 tests `__tests__/column-rebar-layout.test.ts` + `column-stirrup-types.test.ts`.
- `column-rebar-3d.ts` (ringSegments/spiralSegments/buildRods/REBAR_MATERIAL/frustumCulled) + `column-rebar-2d.ts` (drawCornerHook + ring loop).
- ADR-449 `computeMiteredOuter` (`bim/finishes/structural-finish-outline-geometry.ts`) — **πρότυπο** «κοινή γωνιακή γεωμετρία SSoT για 2Δ & 3Δ». Δες πώς το ίδιο corner-math τρέφει και το 2Δ outline και το 3Δ prism. Mirror τη φιλοσοφία.
- 3Δ tube/curve: `THREE.TubeGeometry` + `CatmullRomCurve3` (closed). Έλεγξε διαθεσιμότητα `BufferGeometryUtils` (three/examples/jsm/utils) στο project ΠΡΙΝ το χρησιμοποιήσεις (license/import path).
- ADR-040 performance-critical λίστα (CLAUDE.md) — ο `DxfRenderer` είναι μέσα.

## 5. Verify (browser)
`/dxf/viewer` → ορθογ. κολώνα → «Auto οπλισμός» → toggle «Οπλισμός» ON → **2Δ κάτοψη:** στεφάνι με στρογγυλεμένες 4 γωνίες που αγκαλιάζουν τις κουκκίδες-ράβδες (όχι αιχμηρές). **3Δ/τομή:** λεία σωλήνα συνδετήρα με καμπύλες γωνίες· spiral = λεία έλικα. Άλλαξε Ø συνδετήρα → η ακτίνα κάμψης αλλάζει live. **FPS:** pan/zoom 60fps (ADR-040). **3Δ: εμφανίζεται ΑΜΕΣΩΣ μπαίνοντας στο 3Δ** (όχι μόνο μετά toggle/slider — βλ. §6).

## 6. ⚠️ LESSONS (μην τα ξανακάνεις)
- **3Δ overlay material:** χρησιμοποίησε **`MeshBasicMaterial` (άφωτο), pre-compiled/shared singleton**. Το `MeshStandardMaterial` (lit) **χάνεται στο πρώτο frame** σε on-demand-render σκηνή → ο οπλισμός «δεν ξεσκάλωνε» μέχρι toggle/slider. (Slice 3 fix #5.)
- **3Δ rebuild-on-toggle:** ο κλωβός χτίζεται σε scene-build time (`columnToMesh`) → το toggle ξανα-χτίζει μέσω `use-bim3d-vg-resync` subscription (g). Μην το σπάσεις.
- **Ανεξάρτητο από `suppressFinishSkin`:** το scene path καλεί `columnToMesh(..., suppressFinishSkin=true)` (ο ενιαίος silhouette σοβάς) — ο rebar gate-άρεται ΜΟΝΟ στο `showReinforcement`.
- **InstancedMesh bounds:** `frustumCulled=false` (bounds στο origin, όχι στα instances).
- **Persisted toggle = 3 σημεία:** config resolve + store buildRaw + server schema `app/api/dxf-levels/dxf-levels.schemas.ts` (αλλιώς strip → «επανέρχεται» OFF).

## 7. git add (ΜΟΝΟ δικά σου — Slice 3b)
NEW/MOD αναμενόμενα: `column-rebar-layout.ts` (+ path generator) + tests, `column-rebar-2d.ts`, `column-rebar-3d.ts`, ίσως `column-reinforcement-compute.ts` (+ test) αν αλλάξει το μήκος, ADR-456 changelog, ADR-040 changelog (αν αγγίξεις DxfRenderer — εδώ ΜΟΝΟ ο 2Δ renderer helper αλλάζει, ΟΧΙ ο DxfRenderer· αν δεν αγγίξεις DxfRenderer.ts δεν χρειάζεται ADR-040 stage), adr-index, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, MEMORY. ⚠️ **ΟΧΙ** το `bim-three-structural-converters.ts` αν δεν χρειαστεί (shared-tree ADR-449).

**Memory σχετικά:** `reference_structural_quantities_ssot.md`, `reference_bim_dim_labels_ssot.md`.
**Master tracker:** `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` γραμμή ADR-456 (Slice 3 UNCOMMITTED — όλη η δουλειά εκκρεμεί commit από Giorgio).
