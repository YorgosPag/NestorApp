# HANDOFF — Tekton `.TEK` export, ΦΑΣΗ 2b: ΕΠΙΠΛΑ ως `<plane>` boxes (ADR-512)

**Ημ/νία:** 2026-06-22
**Κατάσταση:** Φ1 τοίχοι + Φ2 κουφώματα ✅ **BROWSER-VERIFIED** (UNCOMMITTED). Έπιπλα = ΤΩΡΑ, decode ΟΛΟΚΛΗΡΩΘΗΚΕ, μένει υλοποίηση.
**Απόφαση Giorgio:** έπιπλα → **«κουτιά πραγματικού μεγέθους»** (footprint rectangle στις πραγματικές διαστάσεις+θέση+γωνία+ύψος). ΟΧΙ 3D mesh (3DS route απορρίφθηκε — βαρύ/GPL/εύθραυστο).

---

## 0. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- **Commit ΜΟΝΟ ο Giorgio** (N.(-1)). **Working tree ΜΟΙΡΑΖΕΤΑΙ** → stage ΜΟΝΟ δικά μου.
- **SSoT audit (grep) ΠΡΙΝ κώδικα** — reuse, μηδέν διπλότυπα (ο Giorgio το ελέγχει σκληρά).
- tsc: ΕΝΑ τη φορά (N.17). Απαντάς ΕΛΛΗΝΙΚΑ. GOL + SSOT.

## 1. ΤΙ ΕΧΕΙ ΓΙΝΕΙ (ΜΗΝ το ξαναφτιάξεις)
- **Φ1 τοίχοι + Φ2 κουφώματα**: πλήρη, 27 jest, 121 export-suite GREEN, tsc clean, **browser-verified Τέκτων 2Δ+3Δ**. UNCOMMITTED.
- Αρχεία Φ1+Φ2: `export/core/tek/{tek-skeleton.template,tek-record-templates,tek-types,tek-geometry,tek-xml-writer,bim-to-tek}.ts` + `export/formats/tek-export-adapter.ts` + `src/lib/xml/escape-xml.ts`.
- **SSoT primitives ΗΔΗ υπάρχουν** (reuse για έπιπλα):
  - `buildXMatrix(ox,oy,ux,uy,vx,vy)` (tek-geometry) — γενικό column-major affine.
  - `mmToMeters` / `MM_TO_M` (reuse `sceneUnitsToMeters`).
  - `tekNum` / `colorHex6` / `escapeXml` / `injectTekEntities` (tek-xml-writer).
  - Κουφώματα reuse `computeOpeningGeometry` (SSoT θέση+rotation) — **ΑΚΟΛΟΥΘΗΣΕ ΤΟ ΙΔΙΟ PATTERN για έπιπλα.**

## 2. DECODE `<plane>` (type 10) — από `ΠΛΑΚΑ.tek.txt` (browser-authored)
Η «πλάκα» στον Τέκτονα = `<plane>` block (ΟΧΙ `<slab>` — αυτό έμεινε κενό!). Καθαρό ορθογώνιο record (n=1):
```
<record>
 <type>10</type><n>1</n><taglist>\n</taglist>
 <color>BC80FC</color><top_color>7C7C7C</top_color><bot_color>7C7C7C</bot_color><perimetric_color>7C7C7C</perimetric_color>
 <width>0.15</width><pen>2</pen><crss_hatch_*>…</crss_hatch_*><point3d>
  <record><pointX>8.624</pointX><pointY>7.55</pointY><pointZ>0</pointZ><is_visible>1</is_visible></record>
  <record><pointX>10.624</pointX><pointY>7.55</pointY><pointZ>0</pointZ><is_visible>1</is_visible></record>
  <record><pointX>10.624</pointX><pointY>9.55</pointY><pointZ>0</pointZ><is_visible>1</is_visible></record>
  <record><pointX>8.624</pointX><pointY>9.55</pointY><pointZ>0</pointZ><is_visible>1</is_visible></record>
 </point3d>
 <material>×3</material>
 <line_type>0</line_type><density>1</density><local_ver_sides>0</local_ver_sides><energy_performance_regulation>0</energy_performance_regulation>
 <elev1>0</elev1><h1>1</h1><elev2>0</elev2><h2>3</h2><hexahedron>0</hexahedron><hex_mirror>0</hex_mirror>
</record>
```
**Decoded:** points = πολύγωνο σε **world ΜΕΤΡΑ** (X,Y,Z), CCW. Διαστάσεις: X 8.624→10.624 = **2.0m**, Y 7.55→9.55 = **2.0m** (ο Giorgio το επιβεβαίωσε). `width`=πάχος πλάκας (0.15). `elev1/elev2`=στάθμες, `h1/h2`=ύψη (για κεκλιμένες/roof· flat→template defaults). `pointZ` διάφορο μηδενός = κεκλιμένο plane (το 1ο record n=2 ήταν κεκλιμένο: Z έως 1.414).
- Exact lines στο δείγμα: `C:\Users\user\Downloads\ΠΛΑΚΑ.tek.txt` 24239-24258 (το n=1 record). 3 planes συνολικά (n=2 κεκλιμένο, n=3 πεντάγωνο, n=1 το καθαρό ορθογώνιο 2×2).

## 3. DECODE objects (type 7) — ΓΙΑ ΑΝΑΦΟΡΑ (δεν το χρησιμοποιούμε· επιλέχθηκε plane route)
- 3 δείγματα (ΕΠΙΠΛΟ/-2/-3): object xmatrix = **καθαρή περιστροφή, ΠΑΝΤΑ μοναδιαία** (magnitude 1), `x00=cosφ,x01=sinφ,x10=−sinφ,x11=cosφ` (column-major, ίδιο με τοίχους· 45°→0.707). **ΚΡΙΣΙΜΟ:** objects = **σταθερά αντικείμενα βιβλιοθήκης** (`<type>2072/2089</type>`)· ΜΟΝΟ `size_z` (ύψος)+`x3ds_uscale`, **καμία ελεύθερη διάσταση κάτοψης**. Γι' αυτό απορρίφθηκε το object route για τα δικά μας (arbitrary-size) έπιπλα. Custom mesh = `x3ds_fname` (εξωτερικό .3ds· βαρύ).

## 4. ΥΛΟΠΟΙΗΣΗ ΕΠΙΠΛΩΝ (plane-box) — ΣΧΕΔΙΟ
### 4a. SSoT AUDIT ΠΡΙΝ (grep — υποχρεωτικό)
- **Furniture geometry**: `bim/geometry/` — βρες `computeFurnitureGeometry` (επιστρέφει `geometry.footprint: Polygon3D` = 4 rotated κορυφές σε scene units). **REUSE το** (μηδέν re-derive άξονα/γωνίας — ίδιο pattern με κουφώματα/`computeOpeningGeometry`). Type guard `isFurnitureEntity` (entities.ts:878). `FurnitureParams.{position,rotationDeg,widthMm,depthMm,heightMm,mountingElevationMm,sceneUnits}` (furniture-types.ts).
- **Units**: reuse `mmToMeters` + `sceneUnitsToMeters(furniture.params.sceneUnits)` για footprint points (scene→μέτρα), `mmToMeters(heightMm)` για ύψος.
- **affine/xml**: reuse `buildXMatrix` (αν χρειαστεί), `tekNum`, `colorHex6`, `escapeXml`, `injectTekEntities`.

### 4b. Αρχεία (NEW/MOD — όλα δικά μου)
1. **`tek-record-templates.ts`** (MOD): NEW `PLANE_RECORD_TEMPLATE` (auto-gen από lines 24239-24258, placeholders `{{POINTS}}` `{{WIDTH}}` `{{ELEV}}` `{{HEIGHT}}` ίσως `{{COLOR}}`) + `PLANE_POINT_TEMPLATE` (`<record><pointX>{{X}}</pointX><pointY>{{Y}}</pointY><pointZ>{{Z}}</pointZ><is_visible>1</is_visible></record>`). AUTO-GEN με node (μην το γράψεις στο χέρι) — δες πώς έγινε το OPEN template (JSON.stringify literal).
2. **`tek-types.ts`** (MOD): NEW `TekPlane { points: {x,y,z}[]; widthM; elevM; ... }`.
3. **`tek-geometry.ts`** (MOD): NEW helper π.χ. `furnitureFootprintMeters(footprint, f)` → 4 points σε μέτρα. (Ή κάν' το inline στον mapper αν τετριμμένο.)
4. **`tek-xml-writer.ts`** (MOD): NEW `buildPlaneRecordXml(p: TekPlane)` + `buildPlanePointsXml(points)`. **MOD `injectTekEntities`**: πρόσθεσε 3ο marker `<!--TEK_PLANE_RECORDS-->` (params `planesXml`). Update signature + όλα τα call sites + tests.
5. **`tek-skeleton.template.ts`** (MOD): βάλε marker `<!--TEK_PLANE_RECORDS-->` ΜΕΣΑ στο `<plane></plane>` του σκελετού. ⚠️ AUTO-GEN data file — βρες το `<plane></plane>` και πρόσθεσε τον marker (node script ή Edit στη συγκεκριμένη θέση· πρόσεξε είναι ΤΕΡΑΣΤΙΑ γραμμή).
6. **`bim-to-tek.ts`** (MOD): NEW `collectTekPlanes(entities)` → filter `isFurnitureEntity` → `computeFurnitureGeometry` → footprint σε μέτρα → `TekPlane` (elev=mountingElevation σε μέτρα· **width(πάχος)=ύψος επίπλου** ώστε να γίνει κουτί base→base+height — VERIFY στον browser, ίσως χρειαστεί h1/h2 αντί width). Επέστρεψε `planesXml` + `planeCount`.
7. **`tek-export-adapter.ts`** (MOD): `assembleTekDocument` → κάλεσε `collectTekPlanes`, πέρασε `planesXml` στο `injectTekEntities`.
8. **`tek-export.test.ts`** (MOD): tests — plane record fill, points, furniture→plane mapper, μέγεθος (2×2→ points σωστά), rotation (λοξό έπιπλο → rotated rectangle).

### 4c. ΑΝΟΙΧΤΑ (browser-verify iterative — όπως walls/openings)
- **Κουτί ύψους**: `width` vs `h1/h2` — ποιο δίνει το vertical extrusion; ξεκίνα με `width=heightM`, δες στον Τέκτονα, calibrate (1 γραμμή).
- **CCW/σειρά points**: το δείγμα ήταν CCW· το `computeFurnitureGeometry().footprint` — έλεγξε orientation, flip αν χρειαστεί.
- **Z/elevation**: mountingElevation → `pointZ` ή `elev1`; ξεκίνα pointZ=mountingM, elev=0.

## 5. VERIFY
- jest `export/` πράσινα· tsc (N.17 σειριακά, έλεγξε για άλλον tsc πρώτα).
- Browser Τέκτων: σχεδίασε έπιπλο σε ΟΥΣ app (εργαλείο επίπλου· πιθανώς «καρέκλα») σε γνωστή θέση+γωνία → export TEK → κουτί σωστού μεγέθους/θέσης/γωνίας/ύψους.
- N.15: ADR-512 (changelog+status) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + adr-index + memory `reference_tekton_tek_export.md`.

## 6. Reference
- ADR: `docs/centralized-systems/reference/adrs/ADR-512-tekton-tek-export.md`.
- Memory: `~/.claude/projects/C--Nestor-Pagonis/memory/reference_tekton_tek_export.md`.
- Δείγματα (Downloads): `ΠΛΑΚΑ.tek.txt` (plane decode), `ΕΠΙΠΛΟ-2/-3.tek.txt` (object rotation, reference), `ΤΟΙΧΟΣ+ΠΟΡΤΑ+ΠΑΡΑΘΥΡΟ.tek.txt` (κουφώματα).
