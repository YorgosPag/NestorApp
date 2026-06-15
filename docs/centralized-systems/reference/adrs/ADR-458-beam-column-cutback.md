# ADR-458 — Beam-to-Column **Cutback** (Revit join-geometry, «η κολόνα νικάει»)

**Status:** Accepted · Implemented (UNCOMMITTED) — 2026-06-15 (Opus)
**Quality bar:** FULL ENTERPRISE + FULL SSOT, Revit-grade (big-player).
**Related:** ADR-449 (structural finish skin), ADR-441 Slice 4 (foundation net-volume), ADR-363 (BIM drawing mode), ADR-040 (canvas perf), ADR-369 (elevation convention).

---

## 1. Πρόβλημα

Ο Giorgio τοποθέτησε **κολόνα που τέμνει δοκάρι υπό λοξή γωνία (15°)**. Ο **πυρήνας του δοκαριού έμπαινε ΜΕΣΑ στο σώμα της κολόνας και ΔΕΝ κοβόταν** → (α) διπλο-μετρημένος όγκος στο BOQ (η ζώνη επικάλυψης μετριέται και στα δύο), (β) βρώμικη γεωμετρία (z-fighting, διπλές ακμές στη συμβολή).

«Τι κάνουν οι μεγάλοι;» → Revit **Join Geometry** με priority **στήλες > δοκάρια**: η ΚΟΛΟΝΑ νικάει, το δοκάρι **κόβεται στην παρειά της** (net volume — η επικάλυψη ανήκει στην κολόνα, μετριέται ΜΙΑ φορά).

---

## 2. Απόφαση

**DERIVED cutback, ΠΟΤΕ persisted.** Τα structural params του δοκαριού (`width`/`depth`/`startPoint`/`endPoint`) παραμένουν **immutable SSoT**· το κομμένο outline υπολογίζεται on-the-fly από τα persisted params + τα **live column footprints**, μέσω boolean `safeDifference` (κολόνα νικάει). Ίδια σύμβαση με τον σοβά (ADR-449) + το foundation net-volume (ADR-441 Slice 4): geometry recomputed on-load, μετακίνηση/περιστροφή/διαγραφή κολόνας → re-derive, μηδέν stale persisted γεωμετρία.

Ρέει σε **2Δ κάτοψη + 3Δ + BOQ** από **ΕΝΑ pure SSoT** (τρεις consumers). Ο σοβάς silhouette (ADR-449) **μένει αμετάβλητος** (το union κολόνα+δοκάρι ήδη χειρίζεται την επικάλυψη του σοβά — το cutback αφορά τον **πυρήνα**).

**Revit-grade αποφάσεις:** column wins πάντα· **exact cut v1** (χωρίς clearance/bearing setback → DEFER)· DERIVED (re-derive on column change).

---

## 3. Αρχιτεκτονική (FULL SSoT)

### 3.1 Pure SSoT — `bim/geometry/beam-column-cutback.ts`
- `computeBeamCutbackOutline(beamOutline: Pt2[], columnFootprints: Pt2[][]) → Pt2[][] | null`
  - `null` → **καμία ουσιαστική τομή** (identity)· ο caller κρατά το αρχικό outline αυτούσιο (byte-for-byte, zero regression — μηδέν polygon-clipping round-trip).
  - `Pt2[][]` → outer rings των κομματιών (1 κομμάτι = κοίλο polygon γωνιακής κοπής· ≥2 = κολόνα που χωρίζει το δοκάρι· `[]` = δοκάρι εξ ολοκλήρου μέσα σε κολόνα → δεν σχεδιάζεται).
  - Cheap bbox-reject ανά κολόνα → zero-cost fast path (η συντριπτική πλειονότητα δεν αγγίζει το δοκάρι). Area-identity check πιάνει και bbox-overlap-χωρίς-γεωμετρική-τομή.
- `computeBeamCutbackNetAreaM2(beamOutline, columnFootprints, canvasToM2) → number | null` — net plan area (m²) μέσω `multiPolygonArea` (**hole-correct**). `null` → καμία τομή.
- SSoT reuse (N.0.2): `safeDifference`/`multiPolygonArea` (robust polygon-clipping wrappers). Τα column world footprints είναι **ήδη rotated/composite-baked** (`computeColumnGeometry`) → λοξές/σύνθετες (Γ-shape) κολόνες δουλεύουν χωρίς ειδική μεταχείριση.

### 3.2 3Δ — `bim-3d/converters/bim-three-structural-converters.ts` `beamToMesh`
Στο rectangular path (πριν το `buildShape`): `trimmed = computeBeamCutbackOutline(outline, columnFootprints)`. `null` → ίσιο box extrude (byte-for-byte). Πολλά κομμάτια → **ένα geometry** μέσω `extrudeShapesAndRotate` (THREE.ExtrudeGeometry δέχεται array of shapes → ένα mesh, ένα material). `[]` → null (δεν σχεδιάζεται). Τα `columns` περνιούνται **ήδη** (5ο param, ADR-449 Slice 6). Ο σοβάς skin κρατά το πλήρες outline (αμετάβλητος).

### 3.3 BOQ — `hooks/data/beam-boq-feed.ts`
`beamNetCoreGeometry`: override `geometry.area`/`volume` με net (mirror `foundationStripNetGeometry`). Net plan area × depth → net volume. Column wins → **πλήρης αφαίρεση** (όχι half-split όπως οι ομοειδείς foundation strips). I-shape → passthrough (volume = διατομή×μήκος, εκτός του area×depth μοντέλου → DEFER).

### 3.4 2Δ κάτοψη — scene post-pass + `BeamRenderer`
- NEW `hooks/canvas/dxf-scene-beam-cutback.ts` `applyBeamColumnCutback2D(entities)`: cross-element pass πάνω στο **converted** `DxfEntityUnion[]` (μετά το per-entity WeakMap cache → πάντα fresh όταν κινείται κολόνα). Θέτει DERIVED `geometry.displayOutline` στα τεμνόμενα δοκάρια. Identity fast-path (χωρίς κολόνες/δοκάρια → ίδιο reference)· μόνο τα κομμένα δοκάρια γίνονται νέα objects (μηδέν περιττό churn).
- Γιατί post-pass (όχι `convertEntity`): το trim εξαρτάται από ΑΛΛΑ entities (τις κολόνες) → δεν χωράει στο per-entity cache (κλειδώνει στο beam ref· κολόνα κινείται, beam ref ίδιο → stale). Wired και στις δύο διαδρομές (`convertSceneToDxf` + hook `useMemo`).
- `BeamRenderer` διαβάζει `geometry.displayOutline ?? [outline.vertices]` σε **fill / stroke / hover / hatch-clip / hit-test** (multi-piece μέσω `buildPiecesPath`) → ίδια γεωμετρία σε bitmap pass, interactive overlay ΚΑΙ hit-test (ένα entity, μία αλήθεια). **ADR-040-safe** (pure draw, zero subscriptions· CHECK 6D — ADR-040 staged).

---

## 4. Persistence

`BeamGeometry.displayOutline?` είναι **optional + DERIVED**. Ο beam serializer παραλείπει το `geometry` (re-derivable). Το trimmed outline **ΔΕΝ persist-άρεται ΠΟΤΕ** — re-derived client-side από persisted `params` + live column footprints σε κάθε scene reconcile. Συνεπές με σοβά (ADR-449) + foundation net (ADR-441 Slice 4).

---

## 5. DEFER (v1 όρια)

- Clearance / bearing setback (exact cut μόνο v1).
- I-shape δοκάρι cutback (BOQ + 3Δ· rectangular μόνο v1).
- Hole-aware 2Δ rendering (κολόνα εξ ολοκλήρου μέσα σε δοκάρι → το net **area** είναι σωστό· το rendered outline παραλείπει το hole — δεν προκύπτει σε τυπικά πλαίσια όπου η κολόνα είναι φαρδύτερη).
- Curved beam cutback (straight/cantilever rectangular v1).
- Priority overrides (πάντα στήλες > δοκάρια· user-defined join order = μετέπειτα).

---

## 6. Changelog

- **2026-06-15** — **v1 (Slices B1-B4) IMPLEMENTED (Opus, UNCOMMITTED).** Firestore-first repro (`col_fb3215e9…` Γ-shape rotation 15° height 4000 storey-ceiling 3000· `beam_d9d8da55…` straight top 3000): το δυτικό ~47mm του δοκαριού έμπαινε στη λοξή παρειά της κολόνας χωρίς κοπή. B1 pure SSoT `beam-column-cutback.ts` (`computeBeamCutbackOutline`/`computeBeamCutbackNetAreaM2`, safeDifference, fast-path identity, 7 jest). B2 3Δ `beamToMesh` (per-piece `extrudeShapesAndRotate`). B3 BOQ net core (`beamNetCoreGeometry`, mirror foundation net, +2 jest). B4 2Δ post-pass `applyBeamColumnCutback2D` → `BeamGeometry.displayOutline` → `BeamRenderer` multi-piece (fill/stroke/hover/hatch/hit-test, +4 jest). Σύνολο 13 νέα jest. ΜΑΘΗΜΑ: cross-element derived geometry δεν χωράει στο per-entity cache → post-pass πάνω στο converted array. 🔴 browser-verify (2Δ+3Δ κοπή στη λοξή παρειά· BOQ net) + tsc(Giorgio) + commit.
