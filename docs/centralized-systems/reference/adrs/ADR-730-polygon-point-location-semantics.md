# ADR-730 — Σημασιολογία «μέσα στο πολύγωνο»: τριαδική θέση + ρητή φυσική ανοχή

**Κατάσταση**: Accepted · **Ημ/νία**: 2026-07-29 · **Έκδοση**: v1
**Σχετικά**: ADR-725 (κάλυψη υψομέτρου ορίου) · ADR-720 (σημεία χωρίς υψόμετρο) ·
ADR-716 (μονάδες) · ADR-584 / CHECK 3.28 (jscpd) · ADR-294 / CHECK 3.7 (SSoT ratchet)

---

## 1. Το πρόβλημα

`bim/geometry/shared/polygon-utils.ts → pointInPolygon()` είναι σκέτο **crossing-number
ray-casting** και επιστρέφει **boolean**. Το σχόλιό του τεκμηρίωνε:

> «True όταν το point βρίσκεται **μέσα ή στην ακμή** του πολυγώνου.»

Καμία γραμμή του σώματος δεν ελέγχει ακμή. Δεν υπάρχει ανοχή, δεν υπάρχει έλεγχος απόστασης.

**Γιατί ένα boolean είναι δομικά ανίκανο εδώ**: για σημείο **επί** του συνόρου το ερώτημα «είναι
μέσα;» είναι κακώς ορισμένο. Ο half-open κανόνας `yi > y !== yj > y` σπάει την ισοπαλία προς μία
μόνο κατεύθυνση, άρα η απάντηση εξαρτάται από τη **φορά της ακμής** — όχι από τη γεωμετρία.

**Μετρημένο, όχι θεωρητικό** (`polygon-point-location.test.ts`, §ΤΟ ΨΕΜΑ): για τετράγωνο
`(0,0)–(10000,0)–(10000,10000)–(0,10000)` ο ωμός έλεγχος απαντά στις **τέσσερις κορυφές του**:

```
[true, false, false, false]
```

Ίδιο σχήμα, ίδιο ερώτημα, **δύο διαφορετικές απαντήσεις**.

### 1.1 Το ψέμα διαδόθηκε — τρεις φορές

Κλώνος κώδικα κλωνοποιεί και το σχόλιό του:

| Θέση | Τι υποσχόταν | Τι έκανε |
|---|---|---|
| `polygon-utils.ts` | «μέσα **ή στην ακμή**» | μηδέν έλεγχος ακμής |
| `check-boundary-elevation-coverage.ts` | «εντός/**επί** του ορίου» | καλούσε το παραπάνω |
| `wall-tilt-attach-clip-3d.test.ts` | «tolerant στα όρια **μέσω μικρού bias**» | **κανένα bias** στο σώμα |

### 1.2 🔴 Ο κίνδυνος — σφάλμα **τιμής**

Μετρημένο στο πραγματικό εργοτάξιο του ADR-725: **10** βολές κάθονται πάνω στη γραμμή του
οικοπέδου (≤5 cm)· **2** από αυτές έχουν υψόμετρο. Το `N = 6` της ζωντανής επαλήθευσης βγήκε
σωστό **κατά τύχη**.

Το `check-boundary-elevation-coverage` αναβαθμίζει σε `high` όταν `N === 0` (ADR-725 §3.4).
Οικόπεδο του οποίου οι μόνες βολές είναι **οι κορυφές του** — απολύτως συνηθισμένο σε αστικό
τεμάχιο — μπορούσε να μετρηθεί «0 μετρημένα σημεία εντός» ⇒ **ψευδές `high`**. Δηλαδή ακριβώς η
παραβίαση του «μηδέν ψευδώς θετικά» που το ADR-725 χτίστηκε για να αποφύγει (§9: QA που κραυγάζει
παύει να διαβάζεται).

### 1.3 🔴🔴 Και **πέντε** υλοποιήσεις του ίδιου βρόχου

| # | Θέση | Όνομα | Πώς επιβίωσε |
|---|---|---|---|
| 1 | `bim/geometry/shared/polygon-utils.ts` | `pointInPolygon` | ο «κύριος» |
| 2 | `bim/geometry/shared/segment-polygon-coverage.ts` | `pointInPolygon` | **ίδιος φάκελος**· ίδιο όνομα ⇒ αόρατο στο 3.18 |
| 3 | `bim-3d/converters/roof-tile-tessellation.ts` | `pointInPolygon2D` | **άλλο όνομα** ⇒ αόρατο στο 3.18 |
| 4 | `services/clip/clip-geometry.ts` | `pointInPolygon` | άλλη υπογραφή (tuples) |
| 5 | `bim-3d/converters/__tests__/wall-tilt-attach-clip-3d.test.ts` | `pointInPolygon` | **σε test** ⇒ έξω από κάθε grep audit |

📌 Ο #5 βρέθηκε **μόνο** επειδή ο έλεγχος συγκρούσεων του registry pattern τρέχει χωρίς
`grep -v __tests__`. Και τα δύο προηγούμενα audits τον έχασαν. **Το «4 υλοποιήσεις» ήταν κι αυτό
υποεκτίμηση** — όπως το «~40 αρχεία» πριν από αυτό.

---

## 2. Έρευνα — τι κάνουν πραγματικά οι μεγάλοι

Πραγματική έρευνα 2026-07-29 (όχι γνώση εκπαίδευσης· η υπόθεση εκκίνησης επαληθεύτηκε
**και συμπληρώθηκε**).

### 2.1 Σχολή Α — OGC / JTS / GEOS / PostGIS: **τριαδική θέση, μηδέν ανοχή**

Το `RayCrossingCounter` του JTS **δεν** επιστρέφει boolean. Το API του είναι:

```java
static int locatePointInRing(Coordinate p, Coordinate[] ring)  // → Location
boolean isOnSegment()      // «the point lies exactly on one of the supplied segments»
int     getLocation()      // INTERIOR | BOUNDARY | EXTERIOR
```

Δύο πράγματα που μετράνε για εμάς:

1. **Ο έλεγχος συνόρου ζει ΜΕΣΑ στον ίδιο βρόχο και βραχυκυκλώνει** — «if the result of this
   method is true, no further segments need be supplied, since the result will never change again».
2. **Τα `within` / `covers` / `contains` δεν είναι αλγόριθμοι** — είναι *παράγωγα κατηγορήματα*
   πάνω σε αυτόν τον ΕΝΑ υπολογισμό.

Το PostGIS συνιστά ρητά `ST_CoveredBy` **αντί** `ST_Within`, «since it has a simpler definition
which does not have the quirk that *boundaries are not within their geometry*».

**Το όριό της**: το JTS χρησιμοποιεί extended-precision orientation test και **δεν έχει καμία
παράμετρο ανοχής**. `BOUNDARY` σημαίνει *ακριβώς* επί του τμήματος.

### 2.2 Σχολή Β — ESRI / ArcGIS: **φυσική ανοχή**

Κάθε geodataset φέρει **XY tolerance** (συνώνυμο: cluster tolerance) με **προεπιλογή 0,001 m =
1 mm**, και για non-geodatabase feature classes «its value is equivalent to 0.001 meter, and this
default value **cannot be changed**». Είναι **χιλιοστά εδάφους**, όχι epsilon μηχανής.

**Το όριό της**: η ανοχή είναι **κρυμμένη** στο spatial reference. Ο καταναλωτής δεν ξέρει ποια
ισχύει και δεν μπορεί να τη διαφοροποιήσει ανά ερώτημα.

### 2.3 Το κενό — και γιατί καμία σχολή δεν αρκεί μόνη

Η σχολή Α είναι **άχρηστη για δεδομένα DXF/CSV**: βολή τοπογράφου στα 3 mm από τη γραμμή δεν
είναι **ποτέ** «ακριβώς επί». Η σχολή Β έχει τη σωστή έννοια ανοχής αλλά την κρύβει.

---

## 3. Η απόφαση

**Ένας** υπολογισμός θέσης, **τριαδικός** (JTS), με **ρητή ανοχή σε mm** (ESRI), σε **ένα
πέρασμα**. Τα κατηγορήματα παράγονται· δεν ξαναϋπολογίζουν.

`bim/geometry/shared/polygon-point-location.ts`:

```ts
type PolygonPointLocation = 'interior' | 'boundary' | 'exterior';
const DEFAULT_BOUNDARY_TOLERANCE_MM = 1;          // = ArcGIS XY tolerance

locatePointInPolygon(point, vertices, { boundaryToleranceMm }?): PolygonPointLocation
pointInPolygonCovers(...)  // !== 'exterior'   ← OGC covers  (μετρήσεις / QA)
pointInPolygonWithin(...)  // === 'interior'   ← OGC within  (γνήσια εντός)
```

### 3.1 🎯 Πού πάει πιο πέρα και από τις δύο σχολές

1. **Τριαδική θέση ΚΑΙ φυσική ανοχή μαζί.** Κανένας από τους δύο δεν τα έχει και τα δύο.
2. **Η ανοχή είναι παράμετρος υπογραφής σε mm**, όχι κρυφή ρύθμιση του dataset. Ο καταναλωτής τη
   βλέπει, τη διαφοροποιεί ανά ερώτημα, και τη διαβάζει στον κώδικα.
3. **`boundaryToleranceMm: 0` εκφυλίζεται ΑΚΡΙΒΩΣ στη σημασιολογία του JTS** — μόνο σημείο
   ακριβώς επί ακμής χαρακτηρίζεται `'boundary'`. Μία συνάρτηση, και οι δύο κόσμοι, μηδέν κρυφή
   τιμή. (Καρφωμένο: §«ανοχή 0 εκφυλίζεται…», 5 tests.)

### 3.2 Γιατί το ωμό `pointInPolygon` **μένει αμετάβλητο**

Οι 74 κλήσεις σε 28 αρχεία **δεν θέλουν όλες το ίδιο**:

| Οικογένεια | Θέλει | Παραδείγματα |
|---|---|---|
| **Κανόνας γεμίσματος even-odd** | 🔴 **ΩΜΟ** crossing-number | `hatch-pattern-geometry`, `HatchRenderer`, `image-fill-export`, `clip-region` |
| Hit-test / επιλογή | `covers` με ανοχή pick | `wall-attach-pick`, `stair-sub-element-hit`, 5 renderers |
| Δείγμα μέσου ακμής | αδιάφορο (εκφυλισμένο εκ κατασκευής) | `segment-polygon-coverage`, `mep-underfloor`, `roof-lower-envelope` |
| **QA / μέτρηση** | 🎯 **`covers` σε mm** | `check-boundary-elevation-coverage`, `cut-fill-crosscheck` |

Στο **γέμισμα** το σύνορο είναι **σύμβαση απόδοσης**: ανοχή θα **πάχαινε τα νησιά** και θα
χαλούσε το hatch. Άρα καθολική αλλαγή θα ήταν **ενεργά επιβλαβής**, όχι απλώς μεγάλη. Το ωμό
διατηρείται γιατί είναι **το σωστό εργαλείο εκεί** — όχι από αδράνεια. Αυτό γράφτηκε ρητά στο
docstring του, ώστε ο επόμενος να μην το «αναβαθμίσει».

### 3.3 Δύο έννοιες «μέσα» — πώς δεν γίνονται το επόμενο χρέος

Ο κίνδυνος του δρόμου «νέα συνάρτηση δίπλα στην παλιά» είναι ότι ο χρήστης μαντεύει ποια θέλει.
Αντίμετρα:

- **Ονομασία κατά OGC** (`covers` / `within`) — καθιερωμένο λεξιλόγιο, όχι δικό μας.
- **Re-export από το `polygon-utils`**, ώστε και οι τρεις σημασιολογίες να φαίνονται **δίπλα-δίπλα**
  στο σημείο εισαγωγής.
- **Ο ωμός δείχνει στους άλλους δύο** και λέει πότε ΔΕΝ πρέπει να τους χρησιμοποιήσεις.
- **Καταχώριση `point-in-polygon-semantics`** στο `.ssot-registry.json` (tier 3) — έκτη
  υλοποίηση = μπλοκαρισμένο commit.

---

## 4. Υλοποίηση

```ts
for (let i = 0, j = n - 1; i < n; j = i++) {
  const vi = vertices[i], vj = vertices[j];
  if (withinEdgeBbox(point, vi, vj, tol) && pointToSegmentDistance(point, vi, vj) <= tol) {
    return 'boundary';                       // ← short-circuit, κατά JTS isOnSegment()
  }
  const crosses = vi.y > point.y !== vj.y > point.y
    && point.x < ((vj.x - vi.x) * (point.y - vi.y)) / (vj.y - vi.y) + vi.x;
  if (crosses) inside = !inside;
}
return inside ? 'interior' : 'exterior';
```

- **Μηδέν νέα μαθηματικά**: η απόσταση έρχεται από το SSoT `pointToSegmentDistance`
  (`systems/guides/guide-types.ts`, 18 καταναλωτές). N.12.
- **`withinEdgeBbox`** = φθηνή απόρριψη πριν το `Math.sqrt`: σημείο έξω από το bbox της ακμής
  **διογκωμένο κατά `tol`** δεν μπορεί να απέχει ≤ `tol`. Ώστε η επαναχρησιμοποίηση του SSoT να
  μη γίνει κόστος.
- **Ανοχή**: `undefined` ⇒ προεπιλογή· `0` / αρνητική / μη-πεπερασμένη ⇒ `0`. **Ποτέ σιωπηλό NaN.**

### 4.1 Μονάδες (ADR-716)

Η ανοχή είναι σε **canonical mm** και προϋποθέτει ότι σημείο + πολύγωνο είναι στο **ίδιο** mm
frame. Το `worldToLocal` (ADR-650 M1) είναι **καθαρή αφαίρεση origin** ⇒ οι μονάδες μένουν mm,
άρα ο τοπογραφικός καταναλωτής είναι έγκυρος. **Καταναλωτής σε canvas units ΔΕΝ περνά ανοχή σε
mm** — γι' αυτό ο `roof-tile-tessellation` (canvas units) έμεινε ρητά στο ωμό.

**Μετρημένο, όχι υποτιθέμενο**: σε μεγέθη ΕΓΣΑ'87 (~4,7·10⁹ mm) το ulp του float64 είναι
~10⁻⁶ mm — **6+ τάξεις κάτω** από την ανοχή. Η ζώνη του 1 mm **δεν** καταρρέει σε world
συντεταγμένες. Καρφωμένο (§«μεγέθη ΕΓΣΑ», 2 tests) αντί να επαναληφθεί ως λαϊκή σοφία.

---

## 5. Αλλαγές ανά αρχείο

| Αρχείο | Αλλαγή |
|---|---|
| `bim/geometry/shared/polygon-point-location.ts` | **ΝΕΟ** — ο SSoT |
| `bim/geometry/shared/polygon-utils.ts` | αληθινό docstring· `vertices` **διευρύνθηκε** `Point3D[]` → `PlanarPoint[]`· re-export των τριών σημασιολογιών |
| `bim/geometry/shared/segment-polygon-coverage.ts` | κλώνος **#2 διαγράφηκε** → import |
| `bim-3d/converters/roof-tile-tessellation.ts` | κλώνος **#3** → adapter υπογραφής (βαθμωτά) |
| `services/clip/clip-geometry.ts` | κλώνος **#4** → adapter αναπαράστασης (tuples) + `WeakMap` προβολή |
| `bim-3d/converters/__tests__/wall-tilt-attach-clip-3d.test.ts` | κλώνος **#5 διαγράφηκε** → import |
| `systems/topography/qa/check-boundary-elevation-coverage.ts` | 🎯 `pointInPolygon` → **`pointInPolygonCovers`** + διόρθωση 2ου ψεύτικου σχολίου |
| `.ssot-registry.json` | νέο module `point-in-polygon-semantics` (tier 3) |

### 5.1 Η `WeakMap` προβολή στο `clip-geometry` — γιατί

Η αναπαράσταση `Array<[number, number]>` είναι **καθιερωμένη** για overlays/lasso σε ~40 αρχεία
(`overlays/types.ts`, stores, commands, event map, grips) — **δεν** αλλάζει εδώ. Ο adapter όμως θα
έκανε O(n) μετατροπή **ανά σημείο** (λάσσο ~200 κορυφές × ~10K οντότητες). `WeakMap` κλειδωμένο
στον πίνακα ⇒ O(n) **ανά δακτύλιο**, και όταν ο πίνακας γίνει σκουπίδι φεύγει και η προβολή.

⚠️ Προϋπόθεση: οι πίνακες πολυγώνου **δεν μεταλλάσσονται επί τόπου**. Ισχύει — αντικαθίστανται με
νέο πίνακα σε κάθε αλλαγή (`setDraftPolygon`, `.map(...)`).

---

## 6. Επαλήθευση

**34 νέα tests**, `polygon-point-location.test.ts` — **mutation-verified, 4/4 μεταλλάξεις
σκότωσαν tests**:

| Μετάλλαξη | Νεκρά tests |
|---|---|
| αφαίρεση του `return 'boundary'` (short-circuit) | **23** |
| `<= tol` → `< tol` | **4** |
| bbox χωρίς διόγκωση κατά `tol` | **7** |
| `DEFAULT_BOUNDARY_TOLERANCE_MM` 1 → 0 | **7** |

Κάλυψη: κορυφές (και οι 4), μέσο οριζόντιας/κατακόρυφης/κεκλιμένης ακμής, ανακλαστική κορυφή +
ακμή κοίλου Γ, εγκοπή, ±0,5/1/2 mm εκατέρωθεν, διαγώνια έξω από κορυφή, ρητή μεγάλη ανοχή,
εκφυλισμός σε JTS με ανοχή 0, αρνητική/NaN ανοχή, παραγωγή covers/within, η **άγκυρα
αυθαιρεσίας** του ωμού, μεγέθη ΕΓΣΑ.

**Πύλες καταναλωτών** (στοχευμένα, όχι όλο το `bim`):

| Σουίτα | Αποτέλεσμα |
|---|---|
| `bim/geometry` | **106 suites / 1.337 tests** ✅ |
| `systems/topography` + `ui/panels/topography` | **62 / 594** ✅ — **ίδιο με τη βάση του ADR-729** |
| `services/clip` + `services/__tests__` + `bim-3d/converters` + `bim/finishes` + `bim/walls` | **195 / 2.093** ✅ |
| `npm run jscpd:diff` (6 αρχεία) | ✅ **μηδέν νέοι κλώνοι** |

---

## 7. Γνωστά όρια — διάβασέ τα πριν επεκτείνεις

1. **Οι υπόλοιποι ~70 καταναλωτές δεν μετακινήθηκαν.** Ο καθένας πρέπει να απαντήσει «θέλω
   `within` ή `covers`;» **όταν τον αγγίξεις** (Boy Scout, N.0.2). Ρητή απόφαση Giorgio 2026-07-29:
   καθολική αλλαγή = μεγάλο ρίσκο **και λάθος** για τα fill rules.
2. **Το `pointInPolygonWithin` ΔΕΝ ταυτίζεται με το ωμό `pointInPolygon`.** Στο σύνορο το πρώτο
   λέει ντετερμινιστικά `false`, το δεύτερο απαντά αυθαίρετα. Δεν είναι drop-in αντικατάσταση —
   είναι **διαφορετική, καλύτερα ορισμένη** ερώτηση.
3. **Η κλάση «ίδιος βρόχος, ΑΛΛΟ όνομα» δεν πιάνεται από το CHECK 3.7.** Οι patterns του registry
   είναι name-based. Την καλύπτει **μόνο** το CHECK 3.28 (jscpd, token-based). Ακριβώς έτσι έζησαν
   ο #3 (`pointInPolygon2D`) και ο #5 (σε test).
4. **Πολύγωνα με τρύπες (rings) δεν υποστηρίζονται** — ένας δακτύλιος τη φορά, όπως και πριν. Ο
   καταναλωτής συνθέτει (βλ. `hatch-pattern-geometry` island styles).
5. **Δεν υπάρχει επιτάχυνση δείκτη.** O(n) ανά ερώτημα. Το JTS έχει `IndexedPointInAreaLocator`
   για «πολλά σημεία, ίδιο πολύγωνο». Αν εμφανιστεί τέτοιο φορτίο (π.χ. δεκάδες χιλιάδες βολές σε
   ένα όριο), **αυτό** είναι το επόμενο βήμα — όχι δεύτερος αλγόριθμος.

---

## 8. Changelog

| Ημ/νία | Έκδοση | Αλλαγή |
|---|---|---|
| 2026-07-29 | v1 | Αρχική. Τριαδική θέση + ανοχή mm· 5 κλώνοι → 1 SSoT + 2 adapters· ο τοπογραφικός έλεγχος κάλυψης γυρίζει σε `covers`· 34 tests mutation-verified 4/4· registry module `point-in-polygon-semantics`. |
