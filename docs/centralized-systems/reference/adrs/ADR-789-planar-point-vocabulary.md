# ADR-789 — Το λεξιλόγιο της κάτοψης: `PlanarPoint`, και ο θάνατος του `z: 0`

**Κατάσταση**: ✅ ΥΛΟΠΟΙΗΜΕΝΟ — Φάσεις Α+Β (`ad90eeae`) · **Φάση Δ** (2026-08-22) · 🔶 επτά ανοιχτά με ονόματα (§9)
**Ημερομηνία**: 2026-08-22
**Αφορμή**: `.claude-rules/pending-ratchet-work.md` → «Point2D→Point3D `z:0` lift» (Boy-Scout flag ADR-528, 2026-06-25)
**Ίδιο σχήμα**: ADR-749 (*μία μηχανή, μία αλήθεια*) · ADR-752 (*ένα anchor χωρίς gate είναι σχόλιο*) · ADR-583/716 (*ΕΝΑΣ βρόχος min/max*)
**Πύλη**: SSoT registry module `planar-point-lift` (CHECK 3.7, ratchet, **4 patterns**, baseline **12 → 2**)
**Άγκυρες**: `planar-point-vocabulary.test.ts` (25) · `stored-plan-profile.test.ts` (12, Φάση Δ)

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

## 8. ✅ Φάση Δ — ΤΟ ΑΠΟΘΗΚΕΥΜΕΝΟ ΠΡΟΦΙΛ ΚΑΤΟΨΗΣ (2026-08-22)

### 8.1 🔴 Το εύρημα που ανέτρεψε τον σχεδιασμό: το `.strict()`

Η προηγούμενη έκδοση της §8 υπέθετε ότι η στένωση «αγγίζει **20** Zod schemas». **Λάθος
κατεύθυνση.** Το `Point3DSchema` είναι `.strict()`, και αυτό αλλάζει το ερώτημα ριζικά —
αποδεδειγμένο **εκτελώντας** (zod 3.25.76):

```
παλιό doc { vertices: [{x,y,z:0}, …] }  →  Polygon3D (z optional)   OK
νέο   doc { vertices: [{x,y}, …] }      →  Polygon3D (z optional)   OK
παλιό doc { vertices: [{x,y,z:0}, …] }  →  Polygon2D (.strict())    REJECT: unrecognized_keys
νέο   doc { vertices: [{x,y}, …] }      →  Polygon2D (.strict())    OK
```

**Αν στενέψει το schema, ΚΑΘΕ παλιό έγγραφο σταματά να ανοίγει.** Άρα η σωστή πράξη δεν
είναι «στένωσε και τα δύο» ούτε «μην κάνεις τίποτα», αλλά **ασύμμετρη**:

| | Τι απαντά | Πράξη |
|---|---|---|
| **Τύπος TS** | «τι **ΓΡΑΦΩ**» | ⬇ στενεύει σε `PlanProfile` (2Δ) |
| **Zod schema** | «τι **ΔΕΧΟΜΑΙ**» | ⟲ **αμετάβλητο** — `z` προαιρετικό |

🏆 Αυτός είναι ο **νόμος του Postel** («conservative in what you send, liberal in what you
accept») — το βιομηχανικό *tolerant reader*. Η απόκλιση `z.infer` έναντι χειρόγραφου τύπου
**δεν είναι τρίτη αλήθεια**: είναι **δύο ερωτήματα** (ADR-749 στη σωστή του κατεύθυνση).
Και είναι δωρεάν: μετρήθηκε ότι οι **52** εξαγόμενοι `*Parsed` τύποι (`z.infer`) έχουν
**ΜΗΔΕΝ καταναλωτές** εκτός των schema files, και **καμία πύλη** δεν τους συγκρίνει με τους
χειρόγραφους. **Μηδέν migration, μηδέν έγγραφο σε κίνδυνο.**

### 8.2 Η πρακτική των μεγάλων — ομόφωνη, και πού τους ξεπερνάμε

| Σύστημα | Προφίλ | Τοποθέτηση |
|---|---|---|
| **IFC** | `IfcArbitraryClosedProfileDef` (**2Δ**) | `IfcAxis2Placement` |
| **Revit** | «Profiles must lie in the **XY plane**» | `SketchPlane` / `Level` |
| **ArchiCAD** | `API_Polygon` = `API_Coord` (**2Δ**) | story + height |
| **MAXON Cinema 4D** | spline points σε **τοπικές** συντεταγμένες | object matrix |
| **Figma** | `vectorNetwork.vertices` = `{x, y}` | `relativeTransform` |

🏆 **Και οι πέντε κρατούν τη σχέση «προφίλ ↔ επίπεδο» στην ΤΕΚΜΗΡΙΩΣΗ** — γι' αυτό το Revit
χρειάζεται τη φράση «*must* lie in the XY plane» και το C4D το «*ideally* oriented».
**Δεν μπορούν** να την επιβάλουν: C++/C# είναι ονομαστικές. Εδώ το λέει ο **τύπος**, και ο
μεταγλωττιστής απορρίπτει το `z: 0` στο σημείο εγγραφής (*excess property check* σε object
literal) — **η ακριβής μορφή** και των 12 παραβιάσεων.

Το δέντρο είχε **ήδη** το αποτύπωμα της αποτυχίας τους: το `wall-covering-types.ts:139`
έγραφε «Optional cached **2D** strip outline» ενώ ο τύπος από κάτω έλεγε `Point3D[]`.
**Το σχόλιο ήξερε την αλήθεια· ο τύπος έλεγε ψέματα** (σχήμα CHECK 3.36).

⚠️ **Το branded / phantom type ΑΠΟΡΡΙΦΘΗΚΕ, και ο λόγος είναι μετρημένος.** Στα *σημεία* θα
ήταν η ονομαστική τυποποίηση Revit/Rhino που το §5 **διέγνωσε ως αιτία** των 89 lift. Στο
*δοχείο* δεν χρειάζεται: η στένωση **ήδη** μπλοκάρει το ελάττωμα σε χρόνο μεταγλώττισης.
Brand χωρίς μετρημένη περίπτωση = ένας ακόμη από τους **606 αδρανείς φρουρούς** (ADR-749 §5).

### 8.3 Τι έγινε

**`PlanProfile`** (`bim-base.ts`) = `{ readonly vertices: readonly Point2D[] }`. Χρησιμοποιεί
το `Point2D` του `rendering/types/Types` — **δεν** φτιάχτηκε νέος τύπος σημείου, γιατί **368**
αρχεία του `bim/` το εισάγουν ήδη από εκεί.

**Δεν** αντικαθιστά το `Polygon3D`: εκείνο μένει για ό,τι είναι **γνήσια χωρικό**, και είναι
**μετρημένο** ποιο — `railing-geometry.ts:62` (`const z = params.baseElevationMm`) ·
`stair-region-fill.ts:87` (`let z = baseZ`, μεταβάλλεται ανά πατούσα) ·
`stairwell-opening-outline.ts:75` (`z = outlineZ` = πάνω παρειά πλάκας). **Καθολική στένωση
του `Polygon3D` (103 χρήσεις) θα έσπαγε ακριβώς αυτά.**

**Έντεκα** αποθηκευμένα πεδία στένεψαν: `SlabParams.outline` · `SlabGeometry.polygon` ·
`RoofParams.outline` · `RoofGeometry.footprint` · `FloorFinishParams.footprint` ·
`ThermalSpaceParams.footprint` · `MepUnderfloorParams.footprint` · `ColumnGeometry.footprint` ·
`WallParams.polylineVertices` · `WallCoveringRenderGeometry.outline` ·
`computeFootprint()` / `getGhostFootprint()`.

⚠️ Το `computeFootprint` ήταν το μόνο **σπάσιμο τύπου επιστροφής** (οι καταναλωτές παίρνουν
λιγότερα) — και αποδείχθηκε **μη πρόβλημα με μέτρηση**: οι πραγματικοί καταναλωτές
(`clearance-dims.ts:30`, `neighbor-clearance-dims.ts:65/153/301`) δήλωναν **ΗΔΗ**
`readonly Point2D[]`. Το interface ήταν ο μόνος που έλεγε `Point3D`.

**Φρουρός 12 → 2.** Τα δύο που μένουν (`offset-entity-geometry:70` · `offset-pairing:92`)
**δεν** γράφουν σε αποθηκευμένο πεδίο — είναι round-trip μέσα σε κοινό util και ανήκουν στο
ανοιχτό #4 (§9). Η baseline ενημερώθηκε **χειρουργικά** (30 διαγραφές, **0 προσθήκες**) —
κοινό working tree, ολική αναγέννηση θα «ευλογούσε» παραβιάσεις άλλου agent.

### 8.4 🔴 Ο φρουρός μετρούσε ΜΙΑ από ΤΡΕΙΣ μορφές

Το §11 δήλωνε «0% ψευδώς θετικά, 12 γνήσια υπόλοιπα». Αληθές — **για τη μορφή που κοιτούσε**.
Και τα τρία patterns απαιτούν `ΟΝΟΜΑ.x`:

| Μορφή | Παράδειγμα | Πλήθος (παραγωγή) | Έκβαση |
|---|---|---|---|
| **α.** ιδιότητα | `verts.map(v => ({x: v.x, y: v.y, z: 0}))` | 51 | φρουρούμενη ✅ |
| **β.** δεικτοδότηση | `outer.map(pr => ({x: pr[0], y: pr[1], z: 0}))` | **1** | **ήταν αόρατη** → 4ο pattern + διορθώθηκε |
| **γ.** βαθμωτά | `{ x: -hw, y: -hd, z: 0 }` | **~253** | **αόρατη** → §9 #5 |

Η **β** ζούσε στο `stairwell-opening-outline.ts:65`, όπου το `polygonArea` δέχεται **ήδη**
`PlanarPoint` — καθαρό no-op. Προστέθηκε **τέταρτο pattern** με απόδειξη ζωής· ψευδώς θετικά
μετρημένα **0** σε όλο το `src/`.

Η **γ** ζούσε στους builders του `column-geometry.ts` — **33 στιγμιότυπα σε ένα αρχείο**, όλα
στην αλυσίδα που τροφοδοτεί το `ColumnGeometry.footprint` που μόλις στένεψε. Καθαρίστηκαν
(N.0.2): **33 → 0**. Τα υπόλοιπα **δεν** γίνονται pattern: η κλάση περιέχει **εξ ορισμού** την
οικογένεια **Γ2** (§6), που είναι **δήλωση τομέα** και όχι μετατροπή τύπου ⇒ ένα τέτοιο pattern
θα είχε ψευδώς θετικά **πολύ πάνω** από τον πήχη <10%.

### 8.5 Η ενοποίηση των 23 schemas — και γιατί ΔΕΝ ήταν προαπαιτούμενο

Το handoff εκτιμούσε ότι τα 23 διπλότυπα είναι **προαπαιτούμενο** («δεν αλλάζεις ένα schema 23
φορές»). Η §8.1 **ακύρωσε το επιχείρημα**: το schema **δεν αλλάζει καθόλου**. Έγινε ούτως ή
άλλως, ως καθαρό SSoT: **20** `Point3DSchema` + **3** `Polygon3DSchema` (επαληθευμένα
**byte-ταυτόσημα** με hash) → **ένα** `bim/types/geometry.schemas.ts`, με `PlanProfileSchema`
ως ονομασμένο ρόλο.

Μετρημένο με jscpd στα **ίδια** 21 αρχεία: **37 κλώνοι / 16,00% → 18 / 5,66%.**

#### 8.5.1 🔴 …και η ΙΔΙΑ η πύλη έδειξε ότι το `Point3DSchema` ήταν το **ένα από έξι**

Το commit **μπλοκαρίστηκε από το CHECK 3.28**: **19 κλώνοι** σε **11** αρχεία, όλοι ζωντανοί
**πριν** αυτή τη δουλειά — απλώς **κανείς δεν τους είχε δει μαζί**, γιατί δεν είχαν ποτέ
σταδιοποιηθεί στο ίδιο commit. Η πύλη diff **δεν είναι απογραφή** (N.18): έγινε απογραφή
**κατά λάθος**, τη στιγμή που 20 αδέλφια αρχεία βρέθηκαν στο ίδιο diff.

Δεν ήταν ένα διπλότυπο· ήταν **έξι λεξιλόγια πεδίων**, το καθένα με **δική του** ερώτηση —
`bim/types/shared-params.schemas.ts`:

| Ομάδα | Ερώτηση | Καταναλωτές |
|---|---|---|
| `STOREY_PLACEMENT_FIELDS` | «σε ποιον όροφο, και πόσο πιο πάνω;» | τοίχος · κολόνα · δοκός · πλάκα · θεμέλιο |
| `SCENE_HOST_FIELDS` | «από ποιον κρέμομαι, και πώς φαίνομαι;» | 6 MEP + έπιπλα |
| `PLACED_BODY_FIELDS` | «πού κάθομαι και τι κουτί πιάνω;» | 5 MEP + ηλεκτρικός πίνακας |
| `STRUCTURAL_BINDING_FIELDS` | «σε τι δένω βάση/κορυφή;» | τοίχος · κολόνα |
| `I_SHAPE_PROFILE_FIELDS` | «τι διατομή Ι/H;» | δοκός · κολόνα |
| `addBindingIssues()` | οι **τρεις κανόνες συνέπειας** του δεσίματος | τοίχος · κολόνα |

🔑 **ΣΧΗΜΑΤΑ (shape objects), ΟΧΙ `z.object(...).merge()`** — και ο λόγος είναι το ίδιο το
`.strict()` της §8.1: ένα έτοιμο `ZodObject` κουβαλά **δικό του** `unknownKeys`, άρα η
συγχώνευση θα άλλαζε **το συμβόλαιο ανάγνωσης**. Το spread ενός σχήματος παράγει **ακριβώς**
το ίδιο `ZodObject` με πριν: ίδιος `z.infer`, ίδια `.strict()`, **μηδέν migration**.

⚠️ **Τα έπιπλα ΔΕΝ πήραν το `PLACED_BODY_FIELDS`**, και δεν είναι παράλειψη: λένε
`rotationDeg`/`widthMm`/`depthMm`/`heightMm` — **άλλο λεξιλόγιο**, και η «ενοποίηση» εκεί θα
ήταν **μετονομασία αποθηκευμένων πεδίων**, δηλαδή ακριβώς η πράξη που η §8.1 απέδειξε
επικίνδυνη. Πήραν **μόνο** το `SCENE_HOST_FIELDS`, που είναι ίδιο κατά λέξη.

⚠️ **Το `addBindingIssues` παίρνει το `entity` ως όρισμα** ώστε τα μηνύματα να μένουν
**byte-ταυτόσημα** με πριν (`WallParams:` / `ColumnParams:`). Ένα κοινό μήνυμα θα ήταν
σιωπηλή αλλαγή συμβολαίου σφάλματος για κάθε καταναλωτή που το διαβάζει.

Επαλήθευση: **118 suites / 1.657 tests** πράσινα σε `walls` · `columns` · `entities` · `slabs`,
**27 suites / 381 tests** στα `bim/types`.

### 8.6 Άγκυρα — και γιατί δεν είναι σχόλιο

`bim/types/__tests__/stored-plan-profile.test.ts` (**12 tests**). Δύο ερωτήματα, **και τα δύο
σε χρόνο εκτέλεσης** (το jest σβήνει τους τύπους — μάθημα §10):

- **Α.** `Object.keys(v) === ['x','y']` — ελέγχει την **ΑΠΟΥΣΙΑ ΚΛΕΙΔΙΟΥ**, όχι την τιμή. Ένα
  `z: undefined` θα περνούσε το `toBeUndefined()` και θα **έσπαγε το Firestore**.
- **Β.** Οι κορυφές εισόδου έχουν `z` που είναι **getter ο οποίος πετάει**. Ό,τι το αγγίξει —
  έστω για να το αντιγράψει — σκάει και **ονομάζει** τον builder. Το `Β0` αποδεικνύει ότι ο
  ίδιος ο φρουρός **μπορεί** να πυροδοτήσει.

**Μετάλλαξη επαληθευμένη**: επαναφορά του lift στο `slab-completion` ⇒ **και** το `Α1`
κοκκινίζει **και** η πύλη 3.7 μπλοκάρει (μηδενική ανοχή, το αρχείο είναι πλέον καθαρό).

🔴 **Η παγίδα Β έπιασε πραγματικό αναγνώστη**: ο `buildDefaultMepUnderfloorParams` περνά από το
**bim** `offsetPolyline` (`polygon-offset-utils.ts:125`), που γράφει `z: v.z ?? 0` — δηλαδή
**ΚΑΤΑΣΚΕΥΑΖΕΙ `z: 0`** από 2Δ είσοδο. Είναι το *preserve-if-present* idiom, **σωστό** για
σκάλες και **ψεύτικο** για προφίλ κάτοψης, και ο φρουρός **δεν μπορεί να το δει** (δεν είναι
`z: 0`). Δηλώθηκε ως **ονομασμένο όριο** στο `Β5` αντί να χαλαρώσει σιωπηλά η άγκυρα — το
αποθηκευμένο `footprint` μένει 2Δ και το `Α5` το κλειδώνει. Ανήκει στο #4 (§9).

## 9. 🔶 Ανοιχτά, με ονόματα και αριθμούς

⚠️ **Ξαναμετρημένα 2026-08-22.** Δύο από τα τρία προηγούμενα νούμερα ήταν λάθος.

1. 🔴 **ΤΡΙΑ `Point3D`, όχι δύο — και ΠΕΝΤΕ `Point2D`.**
   `bim/types/bim-base.ts:53` (`z?`, **183** αρχεία) · `rendering/types/Types.ts:33`
   (`z` **υποχρεωτικό**, **38**) · `core/canvas/primitives/coordinates.ts:21` (`z`
   υποχρεωτικό). **Ίδιο όνομα, άλλο συμβόλαιο.**

   🔑 **Και δεν είναι τυχαίο διπλότυπο**: **31 από τα 38** αρχεία του `rendering.Point3D`
   είναι **σκάλες**, συν helix/spiral καμπύλες και offsets — ακριβώς η «γνήσια χωρική»
   οικογένεια που ονομάζει το §6. Τα δύο συμβόλαια είναι **σωστά διαφορετικά**· λάθος είναι
   **μόνο** ότι μοιράζονται όνομα. Άρα η πράξη είναι **μετονομασία**, ΟΧΙ συγχώνευση
   (ADR-749: δύο ερωτήματα ⇒ δύο ονόματα, ποτέ ένα).

   Απόδειξη ότι το κόστος πληρώνεται **ήδη**: τα `bim-mirror-geometry.ts` και
   `bim-rotate-geometry.ts` **εισάγουν και τους δύο ορισμούς**, με aliases `BimPoint3D` /
   `RenderPoint3D`, για να μπορούν να συνυπάρξουν. **Δικό του ADR.**

2. ✅ **ΕΚΛΕΙΣΕ** — 23 διπλότυπα schema → `bim/types/geometry.schemas.ts` (§8.5).

3. **Το `polygonBbox` επιστρέφει `BoundingBox3D` με `z: 0` σε min ΚΑΙ max** — η έξοδος λέει
   ότι το κουτί έχει **μηδενικό ύψος**. Το ειλικρινές `Bbox` / `bboxOf` (`xy-bounds`)
   **υπάρχει ήδη**. ~20 καλούντες. Το ίδιο σχήμα αναπαράγεται αυτούσιο στο
   `wall-covering-strip-geometry.ts::stripBounds`.

4. 🔴 **ΔΥΟ `offsetPolyline`, ίδιο όνομα, ΑΛΛΟ ΣΥΜΒΟΛΑΙΟ** *(νέο εύρημα)*:

   | | `rendering/entities/shared/geometry-offset-utils.ts:111` | `bim/geometry/shared/polygon-offset-utils.ts:112` |
   |---|---|---|
   | υπογραφή | `(polyline, d, {join, miterLimit})` | `(vertices, d, **sign**, **closed**)` |
   | αλγόριθμος | miter/bevel· ανιχνεύει κλειστό από ταύτιση άκρων | `vertexNormal` + ρητό sign |
   | z | `z: pivot.z` (γνήσιο preserve) | `z: v.z ?? 0` (**κατασκευάζει** z) |

   Δύο σχόλια το προδίδουν ήδη, και κανείς δεν τα διάβασε μαζί: το `offset-pairing.ts:25`
   δηλώνει «**FULL SSoT**: the offset is `offsetPolyline`» σε αρχείο όπου το όνομα είναι
   **διπλό**· και το `envelope-shell.ts:23` γράφει «**ΔΕΝ εμπιστευόμαστε** το `sign` του
   `offsetPolyline` (αναξιόπιστο)» — κάποιος **βρήκε ήδη** τη δεύτερη αναξιόπιστη και την
   **παρέκαμψε**, χωρίς να δει ότι είναι δεύτερη.

   Εδώ ανήκουν και τα **2 εναπομείναντα** lift του φρουρού, και το δηλωμένο όριο `Β5` της
   §8.6. **Δικό του ADR.**

5. 🔶 **~253 `z: 0` σε literal από ΒΑΘΜΩΤΑ** *(νέο· §8.4 μορφή γ)*: **304** συνολικά
   `{ x: …, y: …, z: 0 }` στην παραγωγή, από τα οποία **51** είναι η γνωστή, φρουρούμενη
   κλάση. Η υπόλοιπη περιέχει **εξ ορισμού** την οικογένεια **Γ2** (§6) ⇒ **δεν** γίνεται
   pattern χωρίς ταξινόμηση ανά περίπτωση (πήχης ψευδώς θετικών <10%). Τα **33** του
   `column-geometry.ts` έκλεισαν.

6. 🔴 **Το `SlabOpeningParams.outline` αποθηκεύει το υψόμετρο ΔΥΟ ΦΟΡΕΣ** *(νέο)*: το
   `stairwell-opening-plan.ts:142` περνά `overlap.slab.topZmm` ⇒ οι κορυφές παίρνουν **μη
   μηδενικό** z, ενώ το ίδιο interface έχει **ήδη** πεδίο `elevationOverride` («z override·
   default = `hostSlab.params.levelElevation`»). **Δύο συγγραφείς, δύο συμβάσεις, ένα
   πεδίο** — και η άγκυρα `slab-opening-grips.test.ts:151` ξέρει **μόνο τη μία** (απαιτεί
   `z === 0`, που ισχύει μόνο για τα χειροκίνητα openings).

   Γι' αυτό το `slab-opening` **ΔΕΝ** στένεψε σε αυτόν τον γύρο: η στένωση θα έριχνε σιωπηλά
   το z του φρεατίου. Είναι **απόφαση τομέα** ποιο από τα δύο πεδία είναι η αυθεντία.

7. 🔶 **18 κλώνοι** έμειναν στα `*.schemas.ts` (από 37) — κοινά σώματα params σημειακών
   οντοτήτων (`furniture` ↔ `mep-radiator` ↔ `mep-manifold` ↔ `mep-water-heater` …).
   Προϋπάρχοντες, και **άλλο ερώτημα** από το λεξιλόγιο σημείου.

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

Registry module **`planar-point-lift`** (Tier 1, CHECK 3.7), **τέσσερα** patterns: το ταυτοτικό
array-lift μέσα σε `.map(` · ο μονοσήμαντος lift που **δηλώνει** `Point3D` επιστροφή (arrow) ·
η **ίδια κλάση σε μορφή `function`** · **(Φάση Δ)** η ίδια κλάση με **ΔΕΙΚΤΟΔΟΤΗΣΗ**
(`{ x: pr[0], y: pr[1], z: 0 }`).

🔴 **Το τέταρτο γεννήθηκε επειδή τα τρία πρώτα απαιτούν ΟΛΑ `ΟΝΟΜΑ.x`** — ήταν δομικά τυφλά
σε ζεύγη-πίνακες (`Pair = [number, number]` του polygon-clipping). Μετρημένο **1** ζωντανό
(`stairwell-opening-outline.ts:65`) που ο φρουρός ανέφερε **ΚΑΘΑΡΟ** (§8.4). Ψευδώς θετικά:
**0** σε όλο το `src/`.

🔴 **Το τρίτο pattern γεννήθηκε από μετρημένο τυφλό σημείο, όχι από φαντασία.** Ο σαρωτής με
δύο patterns ανέφερε «καθαρό» ενώ το `stair-region-classifier.ts` είχε `function lift(v: Point2D):
Point3D` που το κατανάλωναν **τρεις** κλήσεις σε **point-free** μορφή (`ring.map(lift)`) — μορφή
που **δεν έχει arrow στο σημείο κλήσης**, άρα καμία γραμμή κλήσης δεν την προδίδει. Η **δήλωση**
είναι η μόνη γραμμή που τη δείχνει. Το `lift` διαγράφηκε (και οι τρεις υποδοχείς —
`shoelaceArea`, `polygonBbox`, `polygonArea` — δέχονται πλέον `PlanarPoint`).

⚠️ **Δηλωμένο όριο**: το Π3 πιάνει τη **δήλωση**, όχι το `.map(namedLift)` στο σημείο κλήσης· ο
γραμμοκεντρικός σαρωτής δεν μπορεί να ξέρει τι είναι το `namedLift`. Είναι επαρκές γιατί κάθε
τέτοιος lift **πρέπει** να δηλωθεί κάπου, και η δήλωση σαρώνεται.

- **RATCHET, όχι zero-tol** — **baseline 12 → 2** μετά τη Φάση Δ (§8.3). Τα 2 που μένουν ζουν στο ανοιχτό #4 (δύο `offsetPolyline`), άρα zero-tol θα ήταν ακόμα μονίμως κόκκινο ⇒ `SKIP_`
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
- **ΜΗΝ αφαιρέσεις το `z` από το `Point3DSchema`** — είναι `.strict()`, και η αφαίρεση κάνει
  **κάθε παλιό έγγραφο να ΑΠΟΡΡΙΠΤΕΤΑΙ** (§8.1, αποδεδειγμένο εκτελώντας). Το schema είναι
  «τι δέχομαι», ο τύπος «τι γράφω» — δύο ερωτήματα, και η ασυμμετρία είναι **σκόπιμη**.
- **ΜΗΝ** στενέψεις το `Polygon3D` καθολικά: κάγκελα · σκάλες · φρεάτιο σκάλας αποθηκεύουν
  **γνήσιο** υψόμετρο στις κορυφές (§8.3). `PlanProfile` **μόνο** όπου το υψόμετρο ζει σε
  δικό του πεδίο.
- **ΜΗΝ** στενέψεις το `SlabOpeningParams.outline` πριν λυθεί το §9 #6 — το φρεάτιο σκάλας
  γράφει εκεί **μη μηδενικό** z και η στένωση θα το έριχνε σιωπηλά.
- **ΜΗΝ** κάνεις pattern την κλάση «`z: 0` από βαθμωτά» (§9 #5): περιέχει εξ ορισμού την
  οικογένεια **Γ2**, άρα τα ψευδώς θετικά ξεπερνούν κατά πολύ τον πήχη <10%.
- **ΜΗΝ** ελέγξεις την απουσία του `z` με `toBeUndefined()` — ένα `z: undefined` θα περνούσε
  και θα **έσπαγε το Firestore**. Ελέγχεται η **ΑΠΟΥΣΙΑ ΚΛΕΙΔΙΟΥ** (§8.6).
- **ΜΗΝ** επαναφέρεις τα `polygon2DCentroid`/`polygon2DAreaCentroid`: μετά τη διεύρυνση είναι
  **ταυτόσημα** με τους γονείς τους — δύο ονόματα, ένα ερώτημα.

---

## 13. Αρχείο εντολών

```bash
npx jest src/subapps/dxf-viewer/bim/geometry/shared/__tests__/planar-point-vocabulary.test.ts
npx jest scripts/__tests__/registry-golden-regex.test.js
npx jest src/subapps/dxf-viewer/bim/types/__tests__/stored-plan-profile.test.ts
node scripts/check-ssot-imports.js <τα αρχεία σου>   # CHECK 3.7 — planar-point-lift
npm run jscpd:diff -- <τα αρχεία σου>
```
