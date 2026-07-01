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

### 3.1 Pure generic SSoT — `bim/geometry/member-column-cutback.ts` (+ beam facade)

**Γενίκευση 2026-07-01:** ο πυρήνας κοπής/net-area είναι **member-agnostic** (δοκάρι **Ή τοίχος** ↔ κολόνα) → ζει στο `member-column-cutback.ts`. Το `beam-column-cutback.ts` έγινε **beam facade** (beam-specific axis/framing + backward-compat aliases `computeBeamCutbackOutline`/`computeBeamCutbackNetAreaM2` = οι generic συναρτήσεις· zero blast radius στα ~6 beam call-sites/tests).

- `computeMemberCutbackOutline(memberOutline: Pt2[], columnFootprints: Pt2[][]) → Pt2[][] | null`
  - `null` → **καμία ουσιαστική τομή** (identity)· ο caller κρατά το αρχικό outline αυτούσιο (byte-for-byte, zero regression — μηδέν polygon-clipping round-trip).
  - `Pt2[][]` → outer rings των κομματιών (1 κομμάτι = κοίλο polygon γωνιακής κοπής· ≥2 = κολόνα που χωρίζει το μέλος· `[]` = μέλος εξ ολοκλήρου μέσα σε κολόνα → δεν σχεδιάζεται).
  - Cheap bbox-reject ανά κολόνα → zero-cost fast path. Area-identity check πιάνει και bbox-overlap-χωρίς-γεωμετρική-τομή.
- `computeMemberCutbackNetAreaM2(memberOutline, columnFootprints, canvasToM2) → number | null` — net plan area (m²) μέσω `multiPolygonArea` (**hole-correct**). `null` → καμία τομή.
- `computeMemberCutbackRetentionRatio(memberOutline, columnFootprints) → number | null` — **NEW (wall)**: λόγος net/gross plan footprint ∈ (0,1], **unit-independent** → ο caller τον εφαρμόζει σε οποιαδήποτε derived ποσότητα (π.χ. FACE area/volume τοίχου μετά τα openings) χωρίς μετατροπή μονάδων. `null` → identity.
- SSoT reuse (N.0.2): `safeDifference`/`multiPolygonArea` (robust polygon-clipping wrappers). Τα column world footprints είναι **ήδη rotated/composite-baked** (`computeColumnGeometry`) → λοξές/σύνθετες (Γ-shape) κολόνες δουλεύουν χωρίς ειδική μεταχείριση.

### 3.2 3Δ — `bim-3d/converters/bim-three-structural-converters.ts` `beamToMesh`
Στο rectangular path (πριν το `buildShape`): `trimmed = computeBeamCutbackOutline(outline, columnFootprints)`. `null` → ίσιο box extrude (byte-for-byte). Πολλά κομμάτια → **ένα geometry** μέσω `extrudeShapesAndRotate` (THREE.ExtrudeGeometry δέχεται array of shapes → ένα mesh, ένα material). `[]` → null (δεν σχεδιάζεται). Τα `columns` περνιούνται **ήδη** (5ο param, ADR-449 Slice 6). Ο σοβάς skin κρατά το πλήρες outline (αμετάβλητος).

### 3.3 BOQ — `hooks/data/beam-boq-feed.ts`
`beamNetCoreGeometry`: override `geometry.area`/`volume` με net (mirror `foundationStripNetGeometry`). Net plan area × depth → net volume. Column wins → **πλήρης αφαίρεση** (όχι half-split όπως οι ομοειδείς foundation strips). I-shape → passthrough (volume = διατομή×μήκος, εκτός του area×depth μοντέλου → DEFER).

### 3.4 2Δ κάτοψη — scene post-pass + `BeamRenderer`
- NEW `hooks/canvas/dxf-scene-beam-cutback.ts` `applyBeamColumnCutback2D(entities)`: cross-element pass πάνω στο **converted** `DxfEntityUnion[]` (μετά το per-entity WeakMap cache → πάντα fresh όταν κινείται κολόνα). Θέτει DERIVED `geometry.displayOutline` στα τεμνόμενα δοκάρια. Identity fast-path (χωρίς κολόνες/δοκάρια → ίδιο reference)· μόνο τα κομμένα δοκάρια γίνονται νέα objects (μηδέν περιττό churn).
- Γιατί post-pass (όχι `convertEntity`): το trim εξαρτάται από ΑΛΛΑ entities (τις κολόνες) → δεν χωράει στο per-entity cache (κλειδώνει στο beam ref· κολόνα κινείται, beam ref ίδιο → stale). Wired και στις δύο διαδρομές (`convertSceneToDxf` + hook `useMemo`).
- `BeamRenderer` διαβάζει `geometry.displayOutline ?? [outline.vertices]` σε **fill / stroke / hover / hatch-clip / hit-test** (multi-piece μέσω `buildPiecesPath`) → ίδια γεωμετρία σε bitmap pass, interactive overlay ΚΑΙ hit-test (ένα entity, μία αλήθεια). **ADR-040-safe** (pure draw, zero subscriptions· CHECK 6D — ADR-040 staged).

### 3.5 Άξονας στο σημείο επαφής (centerline-to-column-contact, Revit location-line)

Ο διακεκομμένος **κεντρικός άξονας** του δοκαριού πρέπει να καταλήγει ΑΚΡΙΒΩΣ στην παρειά της κολόνας που πλαισιώνει το άκρο του (σημείο επαφής), όχι να μπαίνει μέσα ούτε να σταματά πριν — Revit location-line σύμβαση.

- Pure SSoT `computeBeamAxisToColumnContact(axisStart, axisEnd, beamOutline, columnFootprints) → [Pt2,Pt2] | null` (στο `beam-column-cutback.ts`). Ανά άκρο: **pull-back** (άκρο μέσα σε κολόνα → εσωτερική παρειά = μεγαλύτερο crossing με t<1) ή **extend** (άκρο έξω, κολόνα πιο πέρα με body-overlap → κοντινή παρειά = μικρότερο crossing με t>1, εντός `AXIS_EXT_CAP=1.5`). Unclamped line-edge `t` + `pointInPolygon` (SSoT `polygon-utils`). Cheap bbox-reject (ίδιο με το outline cutback). `null` → identity (ο caller κρατά τον αρχικό άξονα).
- **DERIVED `geometry.displayAxisPolyline?: Polyline3D`** (mirror του `displayOutline`, ΠΟΤΕ persisted). Το ίδιο post-pass `applyBeamColumnCutback2D` το θέτει μαζί με το `displayOutline` (μόνο straight 2-σημείων άξονας + κομμάτια>0· curved/split → αυτούσιος, DEFER axis-split).
- `BeamRenderer` line 177: `(geometry.displayAxisPolyline ?? geometry.axisPolyline).points`. **ADR-040-safe** (pure read). 2Δ-only — 3Δ/BOQ αμετάβλητα. +5 jest.

---

## 4. Persistence

`BeamGeometry.displayOutline?` / `displayAxisPolyline?` είναι **optional + DERIVED**. Ο beam serializer παραλείπει το `geometry` (re-derivable). Το trimmed outline **ΔΕΝ persist-άρεται ΠΟΤΕ** — re-derived client-side από persisted `params` + live column footprints σε κάθε scene reconcile. Συνεπές με σοβά (ADR-449) + foundation net (ADR-441 Slice 4).

---

## 5. DEFER (v1 όρια)

- Clearance / bearing setback (exact cut μόνο v1).
- I-shape δοκάρι cutback (BOQ + 3Δ· rectangular μόνο v1).
- Hole-aware 2Δ rendering (κολόνα εξ ολοκλήρου μέσα σε δοκάρι → το net **area** είναι σωστό· το rendered outline παραλείπει το hole — δεν προκύπτει σε τυπικά πλαίσια όπου η κολόνα είναι φαρδύτερη).
- Curved beam cutback (straight/cantilever rectangular v1).
- Priority overrides (πάντα στήλες > δοκάρια· user-defined join order = μετέπειτα).
- **Axis-split** (διαμπερής κολόνα στο ΜΕΣΟ → ο άξονας μένει ενιαίος αντί να σπάει σε 2 κομμάτια· τα 2 ελεύθερα άκρα δεν χρειάζονται προσαρμογή — μόνο τα framed-into-column).
- **Τοίχος (ΦB/ΦC v1):** hover-halo (`drawPerimeterOutline`) + `hitTest` + DNA layer-lines (`drawDnaLayerLines`) κρατούν το πλήρες ring (2Δ)· faced (Polygon-Mode) core + openings/DNA/profile/curved paths κρατούν πλήρες footprint (3Δ, uncut → occlusion). Ο **flat single-layer** τοίχος (τυπική περίπτωση) κόβεται πλήρως σε 2Δ+3Δ+BOQ. Vertical overlap = ύψος τοίχου (κολόνα πλήρους ορόφου· μερική-ύψους = DEFER).

---

## 6. Changelog

- **2026-07-01** — **ΦC: 3Δ πραγματική τομή τοίχου + SSoT dedup ring builder (Opus, UNCOMMITTED· commit #3).** Ο τοίχος τελειώνει στην παρειά της κολόνας και στο 3Δ (μηδέν εμβύθιση στο σώμα της κολόνας), parity με 2Δ/BOQ. Mirror του beam 3Δ cutback: στον flat solid path (`buildWallCoreBody`, legacy extrude) → `computeMemberCutbackOutline(ring, columnFootprintsM)` → πολλά `buildShape` → **ένα** `extrudeShapesAndRotate`· `null` → ίσιο single-shape extrude (byte-for-byte)· `[]` → τοίχος εξ ολοκλήρου μέσα σε κολόνα (δεν σχεδιάζεται). Τα column footprints κλιμακώνονται με ΤΟ ΙΔΙΟ `sceneToM` (ADR-462, κοινός χώρος μέτρων). Συντίθεται με το υπάρχον `pullBackStraightWallEndsFromColumns` (end-butt) — μηδέν σύγκρουση (pulled-back endpoint έξω από κολόνα → cutback identity εκεί· mid-wall → cutback κάνει τη δουλειά). **SSoT dedup (Boy Scout, N.0.2):** ο `buildWallFootprintRing` υπήρχε **διπλός** (`bim-three-shape-helpers.ts` 3Δ + ο νέος pure στη ΦA)· ενοποιήθηκε — ζει στο pure `wall-geometry.ts` (χωρίς THREE dep), ο 3Δ helper τον import+re-export (backward-compat). **DEFER v1:** faced (Polygon-Mode paint) core + openings/DNA/profile/curved paths κρατούν πλήρες footprint (uncut· mid-wall σε αυτούς = occlusion από το solid κολόνας, όπως πριν)· ο flat single-layer τοίχος (η τυπική περίπτωση) κόβεται πραγματικά. Πυρήνας = ο ήδη tested `computeMemberCutbackOutline` (12 jest) → 3Δ wiring browser-verified (mirror beam, ίδια σύμβαση). ⚠️ CHECK 6D (ADR-040) — stage ADR-458 + ADR-040. 🔴 browser-verify (3Δ: τοίχος τελειώνει στην παρειά, cut-plane/transparency δείχνει καθαρή τομή) + commit #3.
- **2026-07-01** — **ΦB: 2Δ κάτοψη cut «κολόνα ορατή» (Opus, UNCOMMITTED· commit #2).** Ο τοίχος κόβεται στην παρειά της κολόνας στην κάτοψη (η κολόνα μένει διακριτό box — απόφαση Giorgio, όχι πλήρης συγχώνευση). NEW `WallGeometry.displayFootprint?` (DERIVED, ΠΟΤΕ persisted — mirror του beam `displayOutline`) + NEW post-pass `hooks/canvas/dxf-scene-wall-cutback.ts` `applyWallColumnCutback2D` (αδελφό του beam, `computeMemberCutbackOutline`, identity fast-path). Wired **μετά** το beam post-pass και στις 2 διαδρομές του `useDxfSceneConversion` (`convertSceneToDxf` + hook memo). `WallRenderer`: NEW `traceWallBody` (cut pieces multi-subpath ?? πλήρες ring) σε **fill + stroke**· `drawMaterialHatch` κλιπάρει στα pieces (αλλιώς το hatch έκρυβε το cut). +5 jest (post-pass) — σύνολο 57 GREEN (member 12 + wall-boq 5 + wall-scene 5 + beam regression 35). **DEFER v1:** hover-halo `drawPerimeterOutline` + `hitTest` + DNA `drawDnaLayerLines` κρατούν το πλήρες ring (μη-κρίσιμα· ο τοίχος=μία οντότητα, η επιλογή full-extent είναι Revit-correct· column hit-priority αμετάβλητη → μηδέν regression). ⚠️ CHECK 6D (ADR-040) — stage ADR-458 + ADR-040. 🔴 browser-verify (2Δ: τοίχος σταματά στην παρειά, διαμπερής κολόνα→2 κομμάτια) + commit #2.
- **2026-07-01** — **Γενίκευση σε ΤΟΙΧΟ + BOQ net volume (Opus, UNCOMMITTED· commit #1 από φασικό roll-out).** «Τι κάνουν οι μεγάλοι όταν κολόνα κάθεται σε τοίχο;» → ίδια αρχή με δοκάρι: **η κολόνα νικάει**, ο τοίχος κόβεται στην παρειά, ο κόμβος μετριέται ΜΙΑ φορά. **Φ0 (SSoT γενίκευση):** ο pure πυρήνας μετακινήθηκε σε `member-column-cutback.ts` (member = beam **ή** wall)· το `beam-column-cutback.ts` = beam facade (beam-specific axis/framing + aliases → μηδέν αλλαγή σε beam call-sites/tests). NEW `computeMemberCutbackRetentionRatio` (unit-independent net/gross ratio). **ΦA (BOQ net volume):** `wall-boq-feed.ts` `wallNetCoreGeometry` εφαρμόζει το ratio στο FACE area/volume (συνθέτει πάνω σε openings/attached net — ADR-395 G6 / ADR-401)· NEW pure `buildWallFootprintRing` (`wall-geometry.ts`, plan ring outer+inner reversed, reuse από BOQ + μελλοντικό 2Δ post-pass). Identity fast-path (καμία κολόνα/τομή → gross byte-for-byte). v1 απλοποίηση (mirror beam): κατακόρυφη επικάλυψη = ύψος τοίχου (κολόνα πλήρους ορόφου). +17 jest (member-column-cutback 12 + wall-boq-feed 5)· 37/37 GREEN μαζί με beam regression. **2Δ κάτοψη cut (displayFootprint + WallRenderer) + 3Δ πραγματική τομή = επόμενα commits (ΦB/ΦC).** 🔴 commit #1 (BOQ-only, μηδέν visual risk).
- **2026-06-25** — **Footprint-aware framing-extend fix (ADR-529 promotion, Opus, UNCOMMITTED).** Όταν μια κολόνα προαγόταν σε **Γ/L boundary element** (ADR-529 Φ2, beam promotes corner column), το north-flush auto-span δοκάρι φαινόταν να **πέφτει νότια + να υπερ-επεκτείνεται** μέχρι το κατακόρυφο σκέλος. **Ρίζα:** η αποθηκευμένη γεωμετρία του δοκαριού ήταν **ακέραιη** (κανένας reframe δεν τρέχει στο `bim:column-params-updated`)· το `framingInwardExtent` (ADR-493 pre-pass) επέκτεινε το carve-outline προς το **`polygonCentroid`**, που για ασύμμετρες διατομές (L/T/U) **μετατοπίζεται** προς το σκέλος → υπερ-επέκταση + ασύμμετρο reprofiling του cutback. **Fix:** «κέντρο κατά τον άξονα» = **footprint midpoint** `(alongMin+alongMax)/2` των παρειών (position-independent, kind-agnostic — ίδιο SSoT root με `projectColumnFootprintOnAxis`/ADR-494), αντί centroid. Κύκλος/ορθογώνιο: midpoint = centroid (μηδέν regression). Αφαιρέθηκαν τα πλέον αχρησιμοποίητα `polygonCentroid`/`projectPointOnAxis`/`toXY0`. +2 jest (ασύμμετρη Γ: footprint-midpoint ΟΧΙ centroid· north-flush διατήρηση + cut στην παρειά)· σύνολο **19 GREEN**. Display-only — μηδέν persisted churn. 🔴 browser-verify (Δοκάρι→προαγωγή Γ→δοκάρι north-flush, χωρίς νότια πτώση/υπερ-επέκταση) + commit (stage ADR-458 + ADR-529).
- **2026-06-15** — **v2 axis-to-contact IMPLEMENTED (Opus, UNCOMMITTED).** Ο διακεκομμένος κεντρικός άξονας του δοκαριού δεν κατέληγε στην παρειά της κολόνας (έμπαινε μέσα ή σταματούσε πριν). NEW pure `computeBeamAxisToColumnContact` (pull-back/extend ανά άκρο, `AXIS_EXT_CAP=1.5`, unclamped line-edge t + SSoT `pointInPolygon`) + DERIVED `BeamGeometry.displayAxisPolyline` (mirror `displayOutline`, ΠΟΤΕ persisted) που το ίδιο post-pass `applyBeamColumnCutback2D` θέτει + `BeamRenderer` reads `displayAxisPolyline ?? axisPolyline`. 2Δ-only (3Δ/BOQ αμετάβλητα). +5 jest (σύνολο 18). ADR-040-safe. DEFER axis-split (διαμπερής μεσαία κολόνα). 🔴 browser-verify (άξονας καταλήγει στην παρειά κολόνας σε περιστραμμένο δοκάρι) + commit. ΣΗΜ: τα grips ΠΑΡΑΜΕΝΟΥΝ στο ορθογώνιο (Revit-correct — location-line editable geometry, όχι το visual cut· συνειδητή απόφαση Giorgio 2026-06-15).
- **2026-06-15** — **v1 (Slices B1-B4) IMPLEMENTED (Opus, UNCOMMITTED).** Firestore-first repro (`col_fb3215e9…` Γ-shape rotation 15° height 4000 storey-ceiling 3000· `beam_d9d8da55…` straight top 3000): το δυτικό ~47mm του δοκαριού έμπαινε στη λοξή παρειά της κολόνας χωρίς κοπή. B1 pure SSoT `beam-column-cutback.ts` (`computeBeamCutbackOutline`/`computeBeamCutbackNetAreaM2`, safeDifference, fast-path identity, 7 jest). B2 3Δ `beamToMesh` (per-piece `extrudeShapesAndRotate`). B3 BOQ net core (`beamNetCoreGeometry`, mirror foundation net, +2 jest). B4 2Δ post-pass `applyBeamColumnCutback2D` → `BeamGeometry.displayOutline` → `BeamRenderer` multi-piece (fill/stroke/hover/hatch/hit-test, +4 jest). Σύνολο 13 νέα jest. ΜΑΘΗΜΑ: cross-element derived geometry δεν χωράει στο per-entity cache → post-pass πάνω στο converted array. 🔴 browser-verify (2Δ+3Δ κοπή στη λοξή παρειά· BOQ net) + tsc(Giorgio) + commit.
