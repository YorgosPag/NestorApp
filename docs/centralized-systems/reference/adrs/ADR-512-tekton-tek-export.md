# ADR-512 — Εξαγωγή Tekton `.TEK` (αρχιτεκτονικά)

**Status:** 🟢 Φάση 1 (τοίχοι) + 🟢 Φάση 2 (κουφώματα→nested `<open>`) **BROWSER-VERIFIED στον Τέκτονα** 2026-06-21 (2Δ+3Δ θέση/μεγέθη σωστά) — UNCOMMITTED, 🔴 commit. 🟡 Φάση 2b (έπιπλα→`<plane>` κουτιά) **κώδικας έτοιμος** 2026-06-22, 🔴 browser-verify+commit. Commit μόνο Giorgio.
**Σχετικά:** ADR-505 (Unified Export) — επέκταση με 4η μορφή.

## Context / Πρόβλημα
Ο **Τέκτων (4M)** είναι κυρίαρχος στατικός/αρχιτεκτονικός στην Ελλάδα. Θέλουμε εξαγωγή του μοντέλου μας σε `.TEK` ώστε οι χρήστες να συνεχίζουν στον Τέκτονα.

**Εύρημα (decode πραγματικών αρχείων):** το **σημερινό `.TEK` (v9.1, fileversion 516) είναι απλό XML, UTF-8** → εφικτό & νομικά καθαρό (παράγουμε ανοιχτό αρχείο που έφτιαξε ο χρήστης, μηδέν decompiling· τα formats δεν προστατεύονται με copyright· interoperability ΕΕ Οδ. 2009/24). Παλιά αρχεία (v5.1, 2011) = εντελώς άλλη μορφή (brace/token `pillar { … }`, fileversion 290) → **στοχεύουμε ΜΟΝΟ τη σημερινή XML**.

**Απόφαση scope:** αρχιτεκτονικά πρώτα (τοίχοι→κουφώματα→έπιπλα). Στατικά (pillar/beam/slab/footing) = μελλοντική φάση (χρειάζεται μοντέρνο δείγμα με γεμάτο στατικό· τα δείγματα που έχουμε είναι είτε v9.1-άδειο-στατικό είτε v5.1-παλιό).

## Σχήμα `.TEK` v9.1 (decoded)
```
<tekton><head>fileversion 516, version 9.1.0.46, +runtime(usid/user/savetime…)</head>
 <body><global><parameters>…</parameters></global>
  <building><parameters>…</parameters> +allowed_tension tables
   <floor><parameters/> <grid/> <wall>…records…</wall> <object>…</object>
          <node/><pillar/><beam/><slab/><footing/>  (στατικά)
</floor></body></tekton>
```
- Συντεταγμένες σε **ΜΕΤΡΑ**. Θέση/μήκος/γωνία μέσω `<xmatrix>` (2D affine).
- **xmatrix DECODED — COLUMN-MAJOR** (browser-verified σε λοξούς τοίχους): ο Τέκτων διαβάζει
  point(u,v) → `X=x00·u+x10·v+x20`, `Y=x01·u+x11·v+x21`. Άρα **άξονας μήκους u=(x00,x01)=E−S**·
  **άξονας πάχους v=(x10,x11)=n̂·thickness**· `(x20,x21)=σημείο εκκίνησης (παρειά=centerline−n̂·t/2)`.
  (Το αρχικό row-major decode από οριζόντιο δείγμα ήταν degenerate → έβγαλε ρόμβους· βλ. changelog.)

### `<open>` (κουφώματα — nested στο `<wall><record><open>`) — DECODED (Φάση 2)
Κάθε κούφωμα = `<record>` μέσα στο `<open>` του host τοίχου. Decoded από `ΤΟΙΧΟΣ+ΠΟΡΤΑ+ΠΑΡΑΘΥΡΟ.tek`:
- `<elevation>` = ποδιά (sill) σε μέτρα· `<top>` = υπέρθυρο (head = sill+height) σε μέτρα.
- `<style>` 0=παράθυρο (υαλοπίνακας) / 1=πόρτα (φύλλο)· `<side>` 0/1 (μεντεσές/φορά, cosmetic).
- `<type>273</type>` (γενικό opening), `door_type/door_type_res/frame/jamb/thzone` = σταθερά από δείγμα.
- **xmatrix κουφώματος (world frame τοίχου)**: `u=(x00,x01)=â·width` (πλάτος κατά μήκος)· `v=(x10,x11)=n̂`
  **ΜΟΝΑΔΙΑΙΟ** κάθετο (magnitude 1, ΟΧΙ ·thickness — ο Τέκτων κόβει στο πάχος του host)· `(x20,x21)=centerline_start+â·offset`.
  Λοξό-safe: â/n̂ από τα ΙΔΙΑ άκρα που τροφοδοτούν το wall xmatrix → κληρονομεί το verified convention.

### `<plane>` (έπιπλα ως κουτιά πραγματικού μεγέθους) — DECODED (Φάση 2b)
**Απόφαση Giorgio:** τα `<object>` records είναι **library-based** (`<type>2072</type>` = σταθερά Tekton-library
αντικείμενα, ΜΟΝΟ `size_z`+scale, **καμία ελεύθερη διάσταση κάτοψης**) → ακατάλληλα για arbitrary-size έπιπλα.
Επιλέχθηκε το `<plane>` route: το έπιπλο γίνεται **footprint πολύγωνο** που ο Τέκτων **εξωθεί** σε κουτί.
Decoded από `ΠΛΑΚΑ.tek` (καθαρό n=1 record, ορθογώνιο 2×2m):
- `<point3d>` = λίστα `<record>` με `pointX/pointY/pointZ` σε **world ΜΕΤΡΑ** (CCW πολύγωνο).
- `<width>` = **πάχος εξώθησης** = ύψος επίπλου (μέτρα)· το επίπεδο εξωθείται κατά αυτό.
- `pointZ` = στάθμη (= mounting elevation)· `elev1/h1/elev2/h2` για κεκλιμένα/roof (flat → σταθερά δείγματος).
- Footprint/ύψος μέσω των **γενικών export extractors** `extractEntityFootprintRing` + `extractHeightMm`
  (`bim-to-dxf-primitives` — οι ΙΔΙΟΙ που τρέφουν DXF/IFC) → scene→μέτρα. **ΕΝΑΣ extractor για ΟΛΑ τα
  formats**, μηδέν 2η διαδρομή. `collectTekPlanes` γενικό → Φ3 structural slabs = +τύπος στο filter.

## Αρχιτεκτονική — **Template-based** (full SSoT)
Δεν παράγουμε ~24k γραμμές από το μηδέν. Κρατάμε **sanitized σκελετό** (head+global+building+άδειο floor, με μηδενισμένα usid/SID/user/runtime για privacy) και **εγχέουμε μόνο τα records** στους markers του `<floor>`. Ανθεκτικό· lazy-loaded (εκτός main bundle).

### Modules (NEW)
- `export/core/tek/tek-skeleton.template.ts` — AUTO-GENERATED sanitized σκελετός + markers `<!--TEK_WALL_RECORDS-->`/`<!--TEK_OBJECT_RECORDS-->`/**`<!--TEK_PLANE_RECORDS-->`** (Φ2b· μέσα στο `<plane>`) (data file).
- `export/core/tek/tek-record-templates.ts` — AUTO-GENERATED `WALL_RECORD_TEMPLATE` + **`OPEN_RECORD_TEMPLATE`** (Φ2) + **`PLANE_RECORD_TEMPLATE`/`PLANE_POINT_TEMPLATE`** (Φ2b· placeholders COLOR/WIDTH/POINTS, X/Y/Z).
- `export/core/tek/tek-types.ts` — `TekWall`/`TekXMatrix`/**`TekOpening`** (Φ2) / **`TekPlane`/`TekPlanePoint`** (Φ2b).
- `export/core/tek/tek-geometry.ts` — `mmToMeters` (reuse `sceneUnitsToMeters`), **`buildXMatrix`** (γενικό column-major SSoT primitive)· `buildWallXMatrix` + **`buildOpeningPlacement`** (Φ2)· **`footprintRingToMeters`** (Φ2b· γενικό footprint ring scene→μέτρα + Z=elevation).
- `export/core/tek/tek-xml-writer.ts` — `tekNum`/`escapeXml`/`colorHex6`/`xmatrixXml`/`buildWallRecordXml`/`injectTekEntities` + **`buildOpenRecordXml`/`buildOpenXml`** (Φ2) + **`buildPlaneRecordXml`/`buildPlanePointsXml`** (Φ2b)· `injectTekEntities` πήρε 3ο `planesXml` param (default '').
- `export/core/tek/bim-to-tek.ts` — `collectTekWalls`: straight walls → records + **group openings ανά `wallId` → nested `<open>`** (Φ2)· curved/ορφανά→skip+warning· returns `openingCount`. **`collectTekPlanes`** (Φ2b): `isFurnitureEntity` → `extractEntityFootprintRing`+`extractHeightMm` (γενικοί export extractors) → `<plane>` record (width=ύψος).
- `export/formats/tek-export-adapter.ts` — `assembleTekDocument` (pure) + `buildTekDocument` (lazy template) + `exportFloorToTek`.

### Wiring (MOD)
`export/types.ts` `ExportFormat`+='tek'· `export-service.ts` `runTekExport` (active→1 .tek· πολλοί→zip· all-single=DEFER)· `ExportDialog.tsx` `FORMAT_OPTIONS`+='tek'· `useExportDialogState.ts` tek=BIM-required scope (όπως ifc)· i18n `export.formats.tek` el+en. (`ExportHost.handleSubmit`: tek πέφτει αυτόματα στο `runExport`.) Φ2b: `tek-export-adapter.assembleTekDocument` καλεί `collectTekPlanes`→`planesXml`→`injectTekEntities`.

## Reuse
`mmToSceneUnits`/`sceneUnitsToMeters` (scene-units SSoT)· `resolveExportEntities`/`resolveExportFloors`· `buildFloorFilename`/`triggerExportDownload`/`createStoredZip`· `isWallEntity`/`isOpeningEntity`/**`isFurnitureEntity`**+params· `computeOpeningGeometry` (Φ2)· **`extractEntityFootprintRing`+`extractHeightMm`** (Φ2b· γενικοί export extractors, ίδιοι με DXF/IFC).

## Tests
36 jest tek-core (Φ1 15 + Φ2 12 + Φ2b 9) + adapter: geometry (canvas→meters, wall+opening xmatrix decoded, decode-parity, **footprint scene→μέτρα+elev**)· writer (num/escape/color/record-fill/inject + open-record/wrap + **plane-record/points fill**)· mapper (straight→record, curved→skip, opening→nested `<open>`, style/handing/orphan + **furniture→plane 2×2m, rot 90° rotated rect, mounting→pointZ, non-furniture skip, scene-unit invariance**)· adapter (scope filter, wall+plane injection). **131 export-suite GREEN**, tsc clean (δικά μου).

## Εκκρεμότητες / DEFER
- 🔴 **commit** (μόνο Giorgio) — Φ1+Φ2 browser-verified, Φ2b κώδικας έτοιμος, UNCOMMITTED.
- 🔴 **Φ2b έπιπλα browser-verify** (Τέκτων): (1) **κουτί ύψους** — `width` vs `h1/h2`: ξεκίνα `width=heightM`, calibrate αν δεν εξωθεί. (2) **CCW/σειρά** κορυφών footprint — flip αν χρειαστεί. (3) **Z/elevation** — `pointZ=mountingM` vs `elev1`.
- ⚠️ **Object route ΑΠΟΡΡΙΦΘΗΚΕ** (αρχείο): τα `<object>` records είναι library-based (`<type>2072</type>`, σταθερές διαστάσεις) → ακατάλληλα για arbitrary-size έπιπλα. Επιλέχθηκε `<plane>` (footprint+εξώθηση). Το `<plane>` reuse-able και για στατικά slabs (Φ3).
- Φάση 3: **στατικά** (pillar/beam/slab/footing — node/plane-based, χρειάζεται μοντέρνο γεμάτο δείγμα).
- Multi-floor `all-single` (πολλαπλά `<floor>`)· curved/polyline τοίχοι.
- ⚠️ version-specific (fileversion 516)· μπορεί να σπάσει σε νέα έκδοση Τέκτονα.

## Changelog
- **2026-06-22** — **Φάση 2b: ΕΠΙΠΛΑ ως `<plane>` κουτιά**. Decode `<plane>` (type 10) από `ΠΛΑΚΑ.tek`: `<point3d>`=footprint πολύγωνο σε world μέτρα, `<width>`=πάχος εξώθησης, `pointZ`=στάθμη. Object route (`<type>2072</type>`) απορρίφθηκε ως library-based (σταθερές διαστάσεις). NEW `PLANE_RECORD_TEMPLATE`/`PLANE_POINT_TEMPLATE` (auto-gen), `TekPlane`/`TekPlanePoint`, `footprintRingToMeters`, `buildPlaneRecordXml`/`buildPlanePointsXml`, `collectTekPlanes`· `<!--TEK_PLANE_RECORDS-->` marker στο `<plane>`· `injectTekEntities` 3ο `planesXml` param. width=ύψος=εξώθηση. **SSoT audit (Giorgio):** αρχικά χρησιμοποιούσα `computeFurnitureGeometry` (params-recompute)· ευθυγραμμίστηκε με τους **γενικούς export extractors `extractEntityFootprintRing` + `extractHeightMm`** (bim-to-dxf-primitives) — οι ΙΔΙΟΙ που τρέφουν DXF/IFC → ΕΝΑΣ footprint/height extractor για ΟΛΑ τα formats, μηδέν 2η διαδρομή, `collectTekPlanes` γενικό (Φ3 slabs = +τύπος στο filter). 9 NEW jest (36 tek-core σύνολο, 131 export-suite GREEN), tsc clean (δικά μου). 🔴 browser-verify (width vs h1/h2· CCW· Z) + commit.
- **2026-06-21 (c2)** — **Φ2 BROWSER-VERIFIED ✅** στον Τέκτονα (τοίχος+κούφωμα: 2Δ+3Δ θέση/πλάτος σωστά). Επαλήθευση: opening origin = ακριβώς centerline (y ταυτίζεται), offset+πλάτος σωστά, κάθετο=wall normal — μηδέν calibration χρειάστηκε (ο SSoT `computeOpeningGeometry` έδωσε σωστό κέντρο). 🔴 commit.
- **2026-06-21 (c)** — **Φάση 2: ΚΟΥΦΩΜΑΤΑ** (πόρτες/παράθυρα → nested `<open>`). Decode `<open>` record από `ΤΟΙΧΟΣ+ΠΟΡΤΑ+ΠΑΡΑΘΥΡΟ.tek` (elevation=ποδιά, top=υπέρθυρο, style 0/1=παράθυρο/πόρτα). NEW `OPEN_RECORD_TEMPLATE`, `TekOpening`, `buildXMatrix` (γενικό SSoT primitive — wall+opening περνούν από εκεί), `buildOpeningPlacement`, `buildOpenRecordXml`/`buildOpenXml`· `collectTekWalls` group openings ανά `wallId`→nested `<open>` (+orphan warnings, +`openingCount`). Opening xmatrix = column-major με ΜΟΝΑΔΙΑΙΟ κάθετο (host κόβει στο πάχος)· λοξό-safe μέσω reuse των wall άκρων (verified convention). 12 NEW jest (27 σύνολο, 121 export-suite GREEN), tsc clean. **Έπιπλα BLOCKED** (δείγμα 0°+library-id· βλ. DEFER). 🔴 browser-verify+commit.
- **2026-06-21 (b)** — **Browser-verified ✅** (Τέκτων: εμφάνιση+διαστάσεις σωστά). **Calibration fix:** ο Τέκτων διαβάζει το xmatrix **column-major** (length axis=(x00,x01), thickness=(x10,x11)) → χρειάστηκε **transpose** (swap x01↔x10). Δεν φάνηκε στο αρχικό decode γιατί το δείγμα ήταν **οριζόντιος τοίχος** (x01=x10=0 → degenerate, οι δύο αναγνώσεις ταυτίζονται)· οι **λοξοί** τοίχοι του Giorgio αποκάλυψαν τον ρόμβο (sheared footprint). ΜΑΘΗΜΑ: για decode affine matrix, χρησιμοποίησε **μη-degenerate (λοξό)** δείγμα — το axis-aligned κρύβει row/column-major + transpose. **SSoT fix (ίδια συνεδρία):** `metersPerCanvasUnit`→reuse `sceneUnitsToMeters`· `escapeXml`→NEW `src/lib/xml/escape-xml.ts` SSoT. 15 jest. 🔴 commit.
- **2026-06-21** — Φάση 1 (τοίχοι). Decode `.TEK`=XML v9.1 + xmatrix. Template-based exporter (sanitized σκελετός + parameterized wall record), 7 NEW modules + wiring 5 σημεία + i18n. 19 jest, tsc clean. UNCOMMITTED· 🔴 browser-verify.
