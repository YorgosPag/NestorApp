# ADR-789 — Το λεξιλόγιο της κάτοψης: `PlanarPoint`, και ο θάνατος του `z: 0`

**Κατάσταση**: ✅ ΥΛΟΠΟΙΗΜΕΝΟ (Φάσεις Α+Β) · 🔶 Φάση Δ σχεδιασμένη και μετρημένη, **δεν** εκτελέστηκε
**Ημερομηνία**: 2026-08-22
**Αφορμή**: `.claude-rules/pending-ratchet-work.md` → «Point2D→Point3D `z:0` lift» (Boy-Scout flag ADR-528, 2026-06-25)
**Ίδιο σχήμα**: ADR-749 (*μία μηχανή, μία αλήθεια*) · ADR-752 (*ένα anchor χωρίς gate είναι σχόλιο*) · ADR-583/716 (*ΕΝΑΣ βρόχος min/max*)
**Πύλη**: SSoT registry module `planar-point-lift` (CHECK 3.7, ratchet) · **Άγκυρα**: `planar-point-vocabulary.test.ts`

---

## 1. Το ερώτημα

> **Το `z: 0` δίπλα σε `x: p.x, y: p.y` είναι ΜΕΤΑΤΡΟΠΗ ΤΥΠΟΥ ή ΓΕΩΜΕΤΡΙΚΗ ΔΗΛΩΣΗ;**

Οι δύο απαντήσεις δίνουν **διαφορετικό κώδικα**. Αν είναι μετατροπή τύπου, το σωστό είναι μία
κεντρική συνάρτηση `liftTo3D` — αυτό πρότεινε η εγγραφή του pending. Αν είναι γεωμετρική
δήλωση, η ενοποίηση **κρύβει** τη δήλωση και ο επόμενος που θα χρειαστεί z≠0 δεν θα δει πού
να πιάσει.

Η μέτρηση απάντησε **και τα δύο, σε διαφορετικά σημεία** — και γι' αυτό το `liftTo3D` **δεν
γράφτηκε ποτέ**.

---

## 2. ⚠️ Και τα τρία προηγούμενα νούμερα ήταν λάθος

| Πηγή | Ισχυρισμός | Μετρημένο 2026-08-22 |
|---|---|---|
| pending entry (2026-06-25) | «~20 inline αντίγραφα» | **8× υποτίμηση** |
| handoff §2 (2026-08-22) | «169 σημεία / 92 αρχεία» | **~2× υπερτίμηση** — μετρούσε και `{x: p.x + dx, …, z: 0}`, που **δεν είναι lift, είναι μετασχηματισμός** |
| **ADR-789** (multiline-aware, ταυτοτικό `{x:A.x, y:A.y, z:0}`) | — | **89 σημεία / 67 αρχεία** |

Ταξινομημένα σε **δύο δομικά διαφορετικές οικογένειες**:

| Οικογένεια | Σχήμα | Σημεία | Απάντηση |
|---|---|---|---|
| **Γ1** | `verts.map((p) => ({ x: p.x, y: p.y, z: 0 }))` | **40 / 35 αρχεία** | **μετατροπή τύπου** |
| **Γ2** | `{ x: position.x, y: position.y, z: 0 }` χωρίς `.map` | **49 / 34 αρχεία** | **δήλωση τομέα** |

Το `toXY0` του `beam-column-cutback.ts:280` που ονόμαζε η εγγραφή **δεν υπάρχει πια** — είχε
παλιώσει και ως προς το περιεχόμενο, όχι μόνο ως προς τον αριθμό.

**Αναπαραγωγή** (multiline-aware· ο δείκτης ονόματος στο regex αποκλείει τα μη-ταυτοτικά):

```python
lift  = r'\{\s*x:\s*([A-Za-z_$][\w$]*(?:\.[\w$]+|\[[^\]]*\])*)\.x\s*,\s*y:\s*\1\.y\s*,\s*z:\s*0\s*\}'
inmap = r'\.map\(\s*\(?\s*[A-Za-z_$][\w$]*\s*(?::[^)]*)?\)?\s*(?::\s*[^=]+)?=>\s*\(?\s*' + lift
```

---

## 3. 🔴 Δεν υπήρχε φραγμός τύπου. **Ποτέ δεν υπήρχε.**

```ts
// bim/types/bim-base.ts:18
export interface Point3D { readonly x: number; readonly y: number; readonly z?: number }
export interface Point2D { x: number; y: number }   // rendering/types/Types.ts:22
```

`strict: true`, **χωρίς** `exactOptionalPropertyTypes`. Τα 89 lift **δεν ικανοποιούσαν κανέναν
περιορισμό** — ήταν runtime work που γεννούσε 89 νέα αντικείμενα ανά κλήση για να γεμίσει ένα
πεδίο που **κανείς δεν διαβάζει**.

### 3.1 🔴 ΔΥΟ `Point3D`, ΔΙΑΦΟΡΕΤΙΚΟ ΣΥΜΒΟΛΑΙΟ

| Ορισμός | `z` | Importers |
|---|---|---|
| `rendering/types/Types.ts:33` — `interface Point3D extends Point2D { z: number }` | **ΥΠΟΧΡΕΩΤΙΚΟ** | 43 |
| `bim/types/bim-base.ts:18` — `{ readonly z?: number }` | **ΠΡΟΑΙΡΕΤΙΚΟ** | 223 |

**Ίδιο όνομα, άλλη υπόσχεση**, και ο αναγνώστης μιας υπογραφής **δεν μπορεί να ξέρει ποιο**.
Γι' αυτό η λύση **δεν** στηρίχθηκε στην προαιρετικότητα του `z`: εξαρτάται από ποιο `Point3D`.
(Καθαρό ADR-749, **ανοιχτό** — §9.)

### 3.2 Καμία συνάρτηση κάτοψης δεν διαβάζει `.z` — μετρημένο

| Αρχείο | γραμμές | αναγνώσεις `.z` |
|---|---|---|
| `polygon-utils.ts` | 460 | **0** (7 εμφανίσεις, **όλες εγγραφές** του 0) |
| `polygon-clip-utils` · `polygon-azimuth-utils` · `xy-bounds` · `polygon-point-location` · `polygon-interior-point` · `straight-skeleton{,-faces}` | — | **0** |
| `polygon-offset-utils` | — | **1**, και είναι `z: v.z ?? 0` — pass-through που **ήδη χειρίζεται την απουσία** |

Και σε όλο το δέντρο: `grep "(footprint|outline|displayFootprint|vertices)…\.z"` → **μηδέν**.
Οι πραγματικοί αναγνώστες `.z` είναι σκάλες, MEP routing, στέγες, breaklines — **άλλα δεδομένα**.

### 3.3 Το lift ήταν round-trip που **αποδεδειγμένα δεν κάνει τίποτα**

```
buildShape(Point3D[]) → toShapePoints() → projectVerticesTo2D()      // πετά το z ΑΜΕΣΩΣ
clipPolygonByConvex2D(Point2D[]) → lift → clipPolygonBySH → map({x,y})   // τριπλό ταξίδι
offsetPolyline: lift → offsetPolyline → projectVerticesTo2D          // το σχόλιο το έλεγε: «strip it back off»
wall: 2D store → lift(z:0) → Point3D model → projectVerticesTo2D → 2D   // wall-preview-store.ts:196
```

### 3.4 Δέκα workarounds για φραγμό που δεν υπήρχε — και τα docblocks το **ομολογούσαν**

| # | Θέση | Μορφή |
|---|---|---|
| 1 | `polygon-clip-utils.ts:106` | `const lift` (ιδιωτικό) |
| 2 | `mep-design/routing/offset-pairing.ts:92` | `const to3d` |
| 3 | `column-rect-decomposition.ts:63` | `toXY` — *«**Pseudo-3D** για το pointInPolygon (που δουλεύει σε XY)»* |
| 4 | `column-section-outline.ts:85` | `toXY` — *«Point2D → **ψευδο-Point3D** (z=0) για τα polygon-utils»* |
| 5 | `check-boundary-elevation-coverage.ts:71` | `lift` — *«το polygon-utils δουλεύει σε 3Δ κορυφές με **αδιάφορο z**»* |
| 6 | `bathroom-layout/layout-geometry.ts:20` | **`export function lift`** — δημόσιο SSoT σε λάθος γειτονιά |
| 7-8 | `polygon2DCentroid` · `polygon2DAreaCentroid` | wrappers που **καταπίνουν** το lift (η στρατηγική του ADR-528) |
| 9 | `roof-lower-envelope.ts:179` | **`as readonly Point3D[]`** — cast, η χειρότερη μορφή |
| 10 | `column-adopt-rect.ts:183` + `column-from-faces.ts:77` | **δύο ιδιωτικά `polygonBbox(readonly Point2D[])`** |

🔴 Το #10 είναι το σοβαρότερο: το commit `1bcae033` («**ΕΝΑΣ** βρόχος min/max σε όλη τη
γεωμετρία», ADR-716/583) **απέτυχε ακριβώς εκεί** — τα δύο επέζησαν επειδή παίρνουν `Point2D`
και το κοινό παίρνει `Point3D`. **Ο φραγμός τύπου νίκησε προηγούμενη εκστρατεία
κεντρικοποίησης.** Και το `check-boundary-closure.ts:33` κρατούσε **και τα δύο** σχήματα
(`verts2d` + `verts3d`) ως πεδία της ίδιας δομής — ο φραγμός έγινε **κατάσταση**.

### 3.5 Η στρατηγική του ADR-528 δεν κλιμακώνεται — μετρημένο

«Ένα 2D wrapper ανά 3D συνάρτηση» είναι **O(συναρτήσεων)**: χρειάζεται `polygon2DArea`,
`polygon2DBbox`, `polygon2DCCW`, `polygon2DPerimeter`, `polygon2DSelfIntersecting`…
**Σταμάτησε στα 2 από ~11.** Τα υπόλοιπα 9 τα πλήρωσαν τα 89 inline lift.

---

## 4. Το SSoT **υπήρχε ήδη** — και δεν λέγεται `liftTo3D`

```ts
// bim/geometry/shared/polygon-point-location.ts:62 (ADR-730)
/** Ελάχιστο read-only επίπεδο σημείο — ό,τι εκθέτει x/y (Point2D, Point3D, κορυφή, λαβή). */
export interface PlanarPoint { readonly x: number; readonly y: number }
```

**Τέσσερις** συναρτήσεις το έκαναν ήδη σωστά: `pointInPolygon` (ADR-730) ·
`projectVerticesTo2D` (ADR-597 §17.11) · `bboxOf` · `buildClosedShape` (ADR-676).

⚠️ Και όμως το `column-rect-decomposition.ts` **ακόμα λιφτάρισε για το `pointInPolygon`** — μια
συνάρτηση που δεν το χρειαζόταν **εδώ και δύο ADR**. *Ο φραγμός αφαιρέθηκε, το workaround έμεινε.*

### 4.1 Τρεις ορθογραφίες για ένα ερώτημα

Πριν το ADR-789 η ίδια ερώτηση γραφόταν **τρεις** τρόπους: `Point3D`, `PlanarPoint`, και
ανώνυμο inline `readonly { readonly x: number; readonly y: number }[]` (`minPolygonInteriorAngleDeg`,
`isConvexPolygon`, `bboxOf`, `buildClosedShape`, `buildFacedSolidBody`). Πλέον **μία**.

---

## 5. 🏆 Η έρευνα: οι μεγάλοι πληρώνουν για κάτι που η TypeScript δίνει δωρεάν

| Σύστημα | Τι κάνει | Κόστος |
|---|---|---|
| **[JTS `CoordinateXY`](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/geom/CoordinateXY.html)** | **νέα κλάση** ώστε να μην κουβαλά ψεύτικο z· το `z` μένει ορατό «intended to be ignored» | προσθετική ιεραρχία τύπων |
| **[CGAL `Projection_traits_xy_3`](https://doc.cgal.org/latest/Kernel_23/classCGAL_1_1Projection__traits__xy__3.html)** | *«adapter to apply **2D algorithms** to the projections of **3D data**»* — **καταργεί** τη μετατροπή | template traits, + `_xz_3`, `_yz_3` |
| **three.js · Revit `XYZ`/`UV` · Rhino `Point2d`/`Point3d`** | ονομαστικοί τύποι, **επιβάλλουν** τη μετατροπή | ακριβώς τα 89 lift μας |

🔑 **Η [δομική τυποποίηση](https://www.typescriptlang.org/docs/handbook/type-compatibility.html)
δίνει την *ιδέα* του CGAL χωρίς traits, χωρίς νέα κλάση, χωρίς adapter**: μια υπογραφή πάνω σε
`PlanarPoint` δέχεται `Point2D` **και** `Point3D` **και** λαβή **και** κορυφή, με **μηδέν
μετατροπή**. Οι μεγάλοι δεν το προτείνουν επειδή **δεν μπορούν** — C++/C#/Java είναι ονομαστικές.

### 5.1 Πού αποθηκεύουν οι μεγάλοι ένα προφίλ κάτοψης

| Σύστημα | Αποθήκευση | Υψόμετρο |
|---|---|---|
| **Revit** | *«Profiles must lie in the **XY plane** and will be transformed to the profile plane automatically»* | `SketchPlane` / `Level` |
| **ArchiCAD** | `API_Polygon` = πίνακας **`API_Coord` (2Δ)**· το `API_Coord3D` είναι άλλος τύπος | story + height properties |
| **Figma** | `vectorNetwork.vertices` = `{x, y}` σε τοπικό χώρο | `relativeTransform` |

**Ομόφωνο: 2Δ προφίλ + ξεχωριστός μετασχηματισμός τοποθέτησης.** Ακριβώς αυτό που το δέντρο
ήδη μισο-κάνει (`levelElevation`, `basePivotZ`, `floorElevationMm` είναι **χωριστά πεδία**).

### 5.2 ⚠️ Η προφανής «έξυπνη» κίνηση απορρίφθηκε **με μέτρηση**

Να γίνει το `z` **υποχρεωτικό** στο `bim-base.Point3D` ώστε να μην μπορεί να «γεμιστεί»:
μετρήθηκαν **131 σημεία** `z ?? 0` / `z === undefined` που εξαρτώνται από την προαιρετικότητα —
και είναι το **σωστό** preserve-if-present idiom για γνήσια 3Δ δεδομένα με lazily-filled z
(3D-readiness G11). Θα ήταν 131-σημείων εκστρατεία **προς λάθος κατεύθυνση**.

---

## 6. Η απόφαση: **τρεις ρόλοι, τρία ονόματα, μηδέν adapter**

| Ρόλος | Τύπος | Ερώτημα |
|---|---|---|
| **Τι δέχομαι** (παράμετρος) | **`PlanarPoint`** | «ό,τι εκθέτει x/y» — το traits του CGAL, δωρεάν |
| **Τι αποθηκεύω για κάτοψη** | `Point2D` | ArchiCAD `API_Coord` · Revit profile-in-XY |
| **Τι είναι γνήσια χωρικό** | `Point3D` (z προαιρετικό) | σκάλες · MEP · στέγες · breaklines |

⚠️ **Η Γ2 ΔΕΝ ενοποιείται με τη Γ1** — επιβεβαιωμένο με μέτρηση, όχι με προτίμηση:
`{ x: clickPoint.x, y: clickPoint.y, z: 0 }` στα ~15 `*-completion.ts` είναι **η άγκυρα της
οντότητας στη βάση του ορόφου**· τα `calculateMovedGeometry(e, { x: dx, y: dy, z: 0 })` είναι
**διάνυσμα** («καμία κατακόρυφη μετακίνηση»), όχι σημείο. Ένωση = ψεύτικο SSoT (ADR-749).

---

## 7. Τι έγινε (Φάσεις Α+Β)

**Φάση Α — η υπογραφή λέει την αλήθεια.** `PlanarPoint` μετακόμισε στο `bim/types/bim-base.ts`
(re-export από `polygon-point-location` ⇒ μηδέν churn) και ~20 υπογραφές διευρύνθηκαν:
`shoelaceArea` · `polygonArea` · `isPolygonCCW` · `polygonPerimeter` · `polygonBbox` ·
`isPolygonSelfIntersecting` · `polygonCentroid` · `polygonAreaCentroid` ·
`minPolygonInteriorAngleDeg` · `isConvexPolygon` · `polylinePerimeterMeters` · `pointInPolygon` ·
`projectPointTo2D` · `projectVerticesTo2D` · `clipPolygonBySH` · `polygonIntersectionAreaMm2` ·
`edgeOutwardAzimuthDeg` · `nearestEdgeOutwardAzimuthDeg` · `bboxOf` · `bboxOfAll` ·
`segmentNormal` · `vertexNormal` · `stripClosingDuplicate` · `buildShape` · `buildWallShape` ·
`toShapePoints` · `stripPrismGeometry` · `wallToMesh(columns, wallCrossFootprints)`.

🔑 **Αντιμεταβλητότητα ⇒ κάθε υπάρχων 3Δ καλών μεταγλωττίζεται αμετάβλητος. Μηδέν αλλαγή στα
call sites.** Γι' αυτό η διεύρυνση είναι ασφαλέστερη από τη στένωση, και γι' αυτό έγινε πρώτη.

**Φάση Β — θάνατος των workarounds.** Και τα 10 έφυγαν. Επιπλέον:
`displayFootprint`/`displayOutline` (**παραγόμενη cache, ΟΧΙ persisted** — επαληθεύτηκε) έγιναν
`Point2D[][]`, οπότε έσβησαν 4 lift + 1 cast + 1 `projectVerticesTo2D` που **ξέκανε** το lift
του προηγούμενου περάσματος.

**Αποτέλεσμα: Γ1 40 → 11** (και τα 11 είναι Φάση Δ, §8). **Γ2 άθικτη, εκ σχεδιασμού.**

### 7.1 Boy Scout που επέβαλε το CHECK 3.28 (jscpd)

Η πύλη κατήγγειλε **6** κλώνους. Αποδείχθηκε με `git show HEAD:` σε προσωρινό φάκελο ότι **και
οι 6 ήταν προϋπάρχοντες** — αλλά τέσσερις ήταν σε αρχεία που άγγιξα, άρα N.0.2. **6 → 0**:

1. `dxf-scene-{wall,beam}-cutback` → νέο `dxf-scene-column-cutters.ts` (η διαφορά ήταν **παράμετρος**, όχι δεύτερο σώμα).
2. `segmentNormalX`/`Y` + `vertexNormalX`/`Y` → **`segmentNormal`/`vertexNormal`**: δύο ονόματα για έναν υπολογισμό, που πλήρωνε **δύο `Math.hypot`** για το ίδιο τμήμα και είχε **δύο** ελέγχους εκφυλισμού που μπορούσαν να αποκλίνουν αθόρυβα.
3. `envelope-three-mesh` → καταναλώνει το `buildClosedShape` (ADR-676) και το δικό του `stripPrismGeometry`.
4. `beam-span-snap.closestPointOnOutline` → delegate στο `closestEdgeOnPolygonOutline`. **Ήταν ιδιωτικό δίδυμο του δηλωμένου «ΕΝΑ edge-walk SSoT», και οι δύο εκδοχές είχαν ήδη ΔΙΑΦΟΡΕΤΙΚΟ πυρήνα απόστασης** (`closestPointOnSegment` έναντι `getNearestPointOnLine`) — δύο απαντήσεις σε ένα ερώτημα.

### 7.2 Boy Scout στο ίδιο το μητρώο

Το `UNPROVEN_CEILING` του `registry-golden-regex.test.js` ήταν **ήδη σπασμένο πριν ξεκινήσω**:
604 στο `0cd00c02`, **605** μόλις μπήκε το `browser-sha256` (`9ca294ec`) **χωρίς απόδειξη** —
δηλαδή το test ήταν **κόκκινο στο main** και θα μπλόκαρε το επόμενο commit. Το ADR-789 πρόσθεσε
2 patterns **με** την απόδειξή τους (καθαρό 0) και ξεχρέωσε τρία (`browser-sha256`,
`point-in-polygon-semantics`, `geometry`). **605 → 600**, ταβάνι **603 → 600**.

---

## 8. 🔶 Φάση Δ — ΣΧΕΔΙΑΣΜΕΝΗ ΚΑΙ ΜΕΤΡΗΜΕΝΗ, ΔΕΝ ΕΚΤΕΛΕΣΤΗΚΕ

Τα **12** εναπομείναντα Γ1 lift γράφουν σε **αποθηκευμένο** πεδίο, δηλαδή αλλάζουν **συμβόλαιο
δεδομένων** — άλλο ερώτημα, άλλο commit (ακριβώς ό,τι λέει το ADR-749).

| Αρχείο | Πεδίο |
|---|---|
| `slab-completion` · `roof-completion` · `floor-finish-completion` · `thermal-space-completion` · `mep-underfloor-completion` | `outline.vertices` / `footprint.vertices` |
| `use-wall-commit` · `wall-preview-helpers` | `WallParams.polylineVertices` |
| `column-geometry:392` | `ColumnGeometry.footprint.vertices` |
| `wall-covering-strip-geometry:211` | `WallCoveringRenderGeometry.outline` |
| `create-entourage-tool:71` | `computeFootprint(): readonly Point3D[]` (ghost, εφήμερο) |
| `offset-entity-geometry:70` | είσοδος σε **z-preserving** `offsetPolyline` (νόμιμο σήμερα) |
| `mep-design/routing/offset-pairing:92` | `const to3d` |

**Τι έχει ήδη αποδειχθεί**: κανείς δεν διαβάζει το z αυτών των πεδίων (§3.2)· το
`Point3DSchema` δηλώνει `z: z.number().finite().optional()`, άρα **παλιά έγγραφα με z
εξακολουθούν να επικυρώνονται** ⇒ tolerant reader by construction, **μηδέν migration**.

**Τι μένει να αποφασιστεί**: αν τα πεδία στενέψουν σε `Point2D` (η πρακτική Revit/ArchiCAD/Figma
του §5.1) ή αν απλώς σβήσει το lift στη γραμμή εγγραφής. Το πρώτο αγγίζει **20** Zod schemas
και τα `mirrorPoint3D`/rotate transforms του `polylineVertices`. **Απόφαση Giorgio.**

---

## 9. 🔶 Ανοιχτά, με ονόματα και αριθμούς

1. **ΔΥΟ `Point3D`** (§3.1) — `rendering/types/Types.ts` (z υποχρεωτικό, 43) έναντι
   `bim/types/bim-base.ts` (z προαιρετικό, 223). **Ίδιο όνομα, άλλο συμβόλαιο.** Ο αναγνώστης
   μιας υπογραφής δεν μπορεί να ξέρει ποιο. Καθαρό ADR-749, μεγαλύτερο από αυτό το commit.
2. **20 διπλότυπα `Point3DSchema`** — ένα ανά `bim/types/*.schemas.ts`, όλα με
   `z: z.number().finite().optional()`. Persistence contract = άλλο ερώτημα.
3. **Το ίδιο το `polygonBbox` επιστρέφει `BoundingBox3D` με `z: 0`** στο min και στο max — η
   έξοδος εξακολουθεί να λέει ψέματα, όπως έλεγε η είσοδος. Δεν αλλάχθηκε γιατί αγγίζει τους
   καλούντες· το `bboxOf`/`Bbox` (`xy-bounds`) είναι ήδη ο ειλικρινής τύπος.

---

## 10. Άγκυρα — και γιατί δεν είναι σχόλιο

`bim/geometry/shared/__tests__/planar-point-vocabulary.test.ts` (**25 tests**).

⚠️ Τα Α1-Α4 («το 2Δ σχήμα περνά») είναι άγκυρες **χρόνου μεταγλώττισης**: το jest σβήνει τους
τύπους, άρα θα έμεναν πράσινα ακόμα κι αν κάποιος ξαναστένευε την υπογραφή σε `Point3D[]`.
Γι' αυτό υπάρχει το **block Δ**: περνά κορυφές των οποίων το `z` είναι **getter που πετάει**.
Αν οποιαδήποτε από τις **15** συναρτήσεις της επιφάνειας αγγίξει το `z` — έστω για να το
αντιγράψει — το test σκάει και **ονομάζει** τη συνάρτηση. Το `Δ0` αποδεικνύει ότι ο ίδιος ο
φρουρός μπορεί να πυροδοτήσει.

**Μεταλλάξεις: 6/6 κόκκινες** — `polygonCentroid` αγγίζει z · `projectPointTo2D` κρατά z ·
επιστροφή του `polygon2DCentroid` · επιστροφή του δημόσιου `lift()` · `polygonBbox` διαβάζει z ·
`pointInPolygon` διαβάζει z.

---

## 11. Πύλη

Registry module **`planar-point-lift`** (Tier 1, CHECK 3.7), **τρία** patterns: το ταυτοτικό
array-lift μέσα σε `.map(` · ο μονοσήμαντος lift που **δηλώνει** `Point3D` επιστροφή (arrow) ·
η **ίδια κλάση σε μορφή `function`**.

🔴 **Το τρίτο pattern γεννήθηκε από μετρημένο τυφλό σημείο, όχι από φαντασία.** Ο σαρωτής με
δύο patterns ανέφερε «καθαρό» ενώ το `stair-region-classifier.ts` είχε `function lift(v: Point2D):
Point3D` που το κατανάλωναν **τρεις** κλήσεις σε **point-free** μορφή (`ring.map(lift)`) — μορφή
που **δεν έχει arrow στο σημείο κλήσης**, άρα καμία γραμμή κλήσης δεν την προδίδει. Η **δήλωση**
είναι η μόνη γραμμή που τη δείχνει. Το `lift` διαγράφηκε (και οι τρεις υποδοχείς —
`shoelaceArea`, `polygonBbox`, `polygonArea` — δέχονται πλέον `PlanarPoint`).

⚠️ **Δηλωμένο όριο**: το Π3 πιάνει τη **δήλωση**, όχι το `.map(namedLift)` στο σημείο κλήσης· ο
γραμμοκεντρικός σαρωτής δεν μπορεί να ξέρει τι είναι το `namedLift`. Είναι επαρκές γιατί κάθε
τέτοιος lift **πρέπει** να δηλωθεί κάπου, και η δήλωση σαρώνεται.

- **RATCHET, όχι zero-tol** — 12 ζωντανά (Φάση Δ) ⇒ zero-tol θα ήταν μονίμως κόκκινο ⇒ `SKIP_`
  ⇒ διακοσμητικό (η παγίδα που απέρριψε ρητά το ADR-770 §3.39). **Baseline = 12**, και το
  seeding έγινε **χειρουργικά, μόνο για αυτό το module**: κοινό working tree — ολική
  αναγέννηση θα «ευλογούσε» παραβιάσεις άλλου agent (36 γραμμές, **μηδέν αφαιρέσεις**).
- **Ψευδώς θετικά: 0%** — μετρημένο σε όλο το `src/`, και τα 12 είναι γνήσια υπόλοιπα.
- **Απόδειξη ζωής** στο `pattern-proofs.js`, με `shouldSkip` που κωδικοποιεί **τις τρεις**
  κλάσεις που ΔΕΝ είναι lift: γνήσιο z · κλιμάκωση/μετατόπιση · **οικογένεια Γ2**.

⚠️ **ΜΗΝ** βάλεις στο `shouldSkip` σχόλιο που περιέχει **αυτούσιο** το idiom: η πύλη
παραλείπει γραμμές σχολίων (`COMMENT_RE` στο `scan.js`) αλλά το golden harness ελέγχει **ωμές**
γραμμές — θα φαινόταν ψευδώς θετικό που η παραγωγή δεν έχει. *(Το πλήρωσα γράφοντάς το.)*

---

## 12. ⚠️ ΜΗΝ

- **ΜΗΝ** γράψεις `liftTo3D`. Η επιφάνεια δέχεται `PlanarPoint` — πέρασε το 2Δ **αυτούσιο**.
- **ΜΗΝ** δηλώσεις `Point3D` σε συνάρτηση που δεν διαβάζει `.z`. Η υπογραφή είναι υπόσχεση.
- **ΜΗΝ** ενώσεις Γ1 και Γ2 (§6) — μετρημένα διαφορετικά ερωτήματα.
- **ΜΗΝ** κάνεις το `z` του `bim-base.Point3D` υποχρεωτικό (§5.2 — 131 σημεία, λάθος κατεύθυνση).
- **ΜΗΝ** διαβάσεις τη baseline **12** ως δείκτη υγείας: μετρά «όσα σημεία γράφουν ακόμα σε
  αποθηκευμένο πεδίο», και η θεραπεία είναι η **Φάση Δ**, όχι μικρότερος αριθμός.
- **ΜΗΝ** επαναφέρεις τα `polygon2DCentroid`/`polygon2DAreaCentroid`: μετά τη διεύρυνση είναι
  **ταυτόσημα** με τους γονείς τους — δύο ονόματα, ένα ερώτημα.

---

## 13. Αρχείο εντολών

```bash
npx jest src/subapps/dxf-viewer/bim/geometry/shared/__tests__/planar-point-vocabulary.test.ts
npx jest scripts/__tests__/registry-golden-regex.test.js
npm run jscpd:diff -- <τα αρχεία σου>
```
