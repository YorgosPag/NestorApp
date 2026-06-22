# ADR-512 — Εξαγωγή Tekton `.TEK` (αρχιτεκτονικά)

**Status:** 🟢 Φάση 1 (τοίχοι) + 🟢 Φάση 2 (κουφώματα→nested `<open>`) **BROWSER-VERIFIED στον Τέκτονα** 2026-06-21 (2Δ+3Δ θέση/μεγέθη σωστά) — UNCOMMITTED, 🔴 commit. 🟡 Φάση 2b (έπιπλα→`<plane>` κουτιά) + 🟢 Φάση A (στέγη→native `<autoroof>` κεκλιμένη) **ΤΕΤΡΑΡΙΧΤΗ+ΔΙΡΡΙΧΤΗ ΖΩΓΡΑΦΙΖΟΝΤΑΙ** — v5 gable-fix: αέτωμα `<angle>`=π/2 (ground-truth από `ΣΤΕΓΗ_ΔΙΡΡΥΧΤΗ_ΚΑΘΕΤΑ_ΑΕΤΩΜΑΤΑ.tek`)· τετράριχτη browser-verified από Giorgio, δίρριχτη verified hand-patched (`ΠΕΙΡΑΜΑ_gable.tek`) 2026-06-22. **κώδικας έτοιμος**, 🔴 Giorgio re-export από Nestor + final browser-verify + commit. Commit μόνο Giorgio.
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

### `<autoroof>` (στέγη — native, κεκλιμένη με «νερά») — DECODED (Φάση A)
Decoded από `ΔΙΑΦΟΡΑ.tek` (record n=1 = hip roof 10×5m, n=3/n=4 = flat). Η στέγη ΔΕΝ είναι `<plane>` —
έχει δικό της native element που χειρίζεται κλίση:
- `<type>8</type>` (autoroof)· `<elevation>` = στάθμη βάσης/γείσου (eaves datum, μέτρα)· `<width>` = πάχος (μέτρα).
- `<point><record>` = footprint κορυφή `pX/pY` (μέτρα) + **`<angle>` = κλίση της πλευράς από το οριζόντιο σε RADIANS**.
  Μία εγγραφή ανά κορυφή (ακμή i = κορυφή i→i+1). **ΣΗΜΑΣΙΟΛΟΓΙΑ (v5, ground-truth από `ΣΤΕΓΗ_ΔΙΡΡΥΧΤΗ_ΚΑΘΕΤΑ_ΑΕΤΩΜΑΤΑ.tek`):**
  `0` = **οριζόντιο** νερό (επίπεδη στέγη)· `0.366519` (21°) = κεκλιμένο νερό· **`π/2` (1.5708, 90°) = ΚΑΤΑΚΟΡΥΦΗ πλευρά = αέτωμα (gable end)**.
  ⚠️ Το αέτωμα ΔΕΝ είναι `angle=0` — με `0` ο Τέκτων το βλέπει ως οριζόντιο και η στέγη με ανάμεικτες κλίσεις (δίρριχτη) ΔΕΝ ζωγραφίζεται.
- `<v3list>` = ΟΛΕΣ οι όψεις (faces): κάθε `<onev3list>` = ένα face, λίστα `<v3>` με `pvX/pvY/pvZ` σε **world
  μέτρα**, per-vertex z. **Περιλαμβάνει ΚΑΙ τα «νερά» (κεκλιμένα, γείσο z=base → κορφιάς z=base+rise) ΚΑΙ τα
  αετώματα (κατακόρυφα τρίγωνα στις gable ακμές)** — ground-truth δίρριχτη = 2 νερά + 2 αετώματα (v6). Τα νερά
  από `geometry.faces`· τα αετώματα από `buildGableFaces` (`geometry.ridges`). Επίπεδη → degenerate (1 vertex / κενό).
- **Mapping (FULL SSoT, μηδέν re-derive):** `<point>` ← `params.outline` + `params.edges[i].slope` μέσω του
  SSoT `roofSlopeToRatio` → `atan(ratio)`. `<v3list>` ← το **ήδη υπολογισμένο** `geometry.faces[].outline`
  (canvas xy + mm z) → μέτρα. Color/πάχος/elevation από `params`. Δες `collectTekRoofs`/`toTekRoof`.
- ⚠️ Browser-calibration knobs: (α) winding `<point>` (CCW vs CW)· (β) αντιστοίχιση angle↔ακμή· (γ) αν ο
  Τέκτων recompute-άρει το v3list από point+angle (τότε το point/angle είναι ο primary driver).

### `<line>` (type 4) / `<arc>` (type 5) — DECODED (για Φ-D primitives)
Decoded από `ΔΙΑΦΟΡΑ.tek` (5 lines = ορθογώνιο+διαγώνιος· 1 arc + 1 circle):
- **`<line><record>`**: `<v0X><v0Y><elevation0>` → `<v1X><v1Y><elevation1>` = ευθύγραμμο τμήμα (μέτρα) +
  `color/render_color/thickness/pen` + `<material>` block + mark settings.
- **`<arc><record>`**: `<circle>0=τόξο/1=κύκλος<centreX><centreY><p0X><p0Y><p1X><p1Y>`. Κύκλος: p0 = σημείο
  περιφέρειας (radius = dist centre→p0), p1=(0,0). Τόξο: p0 = αρχή, p1 = τέλος (radius = dist centre→p0).
- ⚠️ `<hatch>` ΗΤΑΝ ΚΕΝΟ στο δείγμα → η γραμμοσκίαση ΔΕΝ αποθηκεύτηκε ως `<hatch>` (Φ-B θα μείνει flat-plane
  fallback ή χρειάζεται δείγμα με ορατή γραμμοσκίαση).

## Αρχιτεκτονική — **Template-based** (full SSoT)
Δεν παράγουμε ~24k γραμμές από το μηδέν. Κρατάμε **sanitized σκελετό** (head+global+building+άδειο floor, με μηδενισμένα usid/SID/user/runtime για privacy) και **εγχέουμε μόνο τα records** στους markers του `<floor>`. Ανθεκτικό· lazy-loaded (εκτός main bundle).

### Modules (NEW)
- `export/core/tek/tek-skeleton.template.ts` — AUTO-GENERATED sanitized σκελετός + markers `<!--TEK_WALL_RECORDS-->`/`<!--TEK_OBJECT_RECORDS-->`/**`<!--TEK_PLANE_RECORDS-->`** (Φ2b· μέσα στο `<plane>`)/**`<!--TEK_AUTOROOF_RECORDS-->`** (Φ-A· μέσα στο `<autoroof>`) (data file).
- `export/core/tek/tek-record-templates.ts` — AUTO-GENERATED `WALL_RECORD_TEMPLATE` + **`OPEN_RECORD_TEMPLATE`** (Φ2) + **`PLANE_RECORD_TEMPLATE`/`PLANE_POINT_TEMPLATE`** (Φ2b) + **`AUTOROOF_RECORD_TEMPLATE`/`AUTOROOF_POINT_TEMPLATE`/`AUTOROOF_V3_TEMPLATE`** (Φ-A· placeholders ID/ELEVATION/WIDTH/COLOR/V3LIST/POINTS, X/Y/ANGLE, X/Y/Z).
- `export/core/tek/tek-types.ts` — `TekWall`/`TekXMatrix`/**`TekOpening`** (Φ2) / **`TekPlane`/`TekPlanePoint`** (Φ2b) / **`TekRoof`/`TekRoofPoint`/`TekRoofFace`** (Φ-A).
- `export/core/tek/tek-geometry.ts` — `mmToMeters` (reuse `sceneUnitsToMeters`), **`buildXMatrix`** (γενικό column-major SSoT primitive)· `buildWallXMatrix` + **`buildOpeningXMatrix`** (Φ2)· **`footprintRingToMeters`** (Φ2b· flat ring, Z=elevation) + **`roofFaceRingToMeters`** (Φ-A· per-vertex z, mm→m — κεκλιμένα «νερά»).
- `export/core/tek/tek-xml-writer.ts` — `tekNum`/`escapeXml`/`colorHex6`/`xmatrixXml`/`buildWallRecordXml`/`injectTekEntities` + **`buildOpenRecordXml`/`buildOpenXml`** (Φ2) + **`buildPlaneRecordXml`/`buildPlanePointsXml`** (Φ2b) + **`buildAutoroofRecordXml`/`buildRoofPointsXml`/`buildRoofV3ListXml`** (Φ-A)· `injectTekEntities` πήρε 3ο `planesXml` + 4ο `autoroofsXml` param (default '').
- `export/core/tek/bim-to-tek.ts` — `collectTekWalls`: straight walls + **nested `<open>`** (Φ2). **`collectTekPlanes`** (Φ2b): `isTekPlaneEntity` (έπιπλα· Φ3 slabs = +τύπος) → `extractEntityFootprintRing`+`extractHeightMm` → `<plane>`. **`collectTekRoofs`/`toTekRoof`** (Φ-A): `isRoofEntity` → `<autoroof>` — footprint+κλίση από `params.outline`/`params.edges` (μέσω `roofSlopeToRatio`→`atan`)· «νερά» από το **ήδη-υπολογισμένο** `geometry.faces[].outline` (μηδέν re-derive).
- `export/formats/tek-export-adapter.ts` — `assembleTekDocument` (pure) + `buildTekDocument` (lazy template) + `exportFloorToTek`.

### Wiring (MOD)
`export/types.ts` `ExportFormat`+='tek'· `export-service.ts` `runTekExport` (active→1 .tek· πολλοί→zip· all-single=DEFER)· `ExportDialog.tsx` `FORMAT_OPTIONS`+='tek'· `useExportDialogState.ts` tek=BIM-required scope (όπως ifc)· i18n `export.formats.tek` el+en. (`ExportHost.handleSubmit`: tek πέφτει αυτόματα στο `runExport`.) Φ2b+Φ-A: `tek-export-adapter.assembleTekDocument` καλεί `collectTekPlanes`→`planesXml` + `collectTekRoofs`→`autoroofsXml`→`injectTekEntities` (4ο/5ο όρισμα).

## Reuse
`mmToSceneUnits`/`sceneUnitsToMeters` (scene-units SSoT)· `resolveExportEntities`/`resolveExportFloors`· `buildFloorFilename`/`triggerExportDownload`/`createStoredZip`· `isWallEntity`/`isOpeningEntity`/**`isFurnitureEntity`**/**`isRoofEntity`** (Φ-A)+params· `computeOpeningGeometry` (Φ2)· **`extractEntityFootprintRing`+`extractHeightMm`** (Φ2b· γενικοί export extractors, ίδιοι με DXF/IFC)· **`roofSlopeToRatio`** (Φ-A· SSoT slope-unit conversion, ίδιο που χρησιμοποιεί ο roof solver) + **`geometry.faces[].outline`** (ήδη-υπολογισμένα «νερά»).

## Tests
48 jest tek-core (Φ1 15 + Φ2 12 + Φ2b 9 + **Φ-A 12** incl. dedup) + adapter: geometry (canvas→meters, wall+opening xmatrix decoded, decode-parity, footprint flat + **roof face per-vertex z**)· writer (num/escape/color/record-fill/inject + open-record/wrap + plane-record/points + **autoroof record/points/v3list fill, κενά faces→κενό v3list**)· mapper (straight→record, curved→skip, opening nested `<open>`, style/handing/orphan + furniture→plane + **roof→autoroof flat angle 0, edge 30°→atan rad, faces→v3list per-vertex z, color από entity/fallback, roof ΟΧΙ σε planes**)· adapter (scope filter, wall+plane+**autoroof** injection). **144 export-suite GREEN**, tsc clean (δικά μου· 9 προϋπάρχοντα errors άλλων agents).

## Εκκρεμότητες / DEFER
- 🔴 **commit** (μόνο Giorgio) — Φ1+Φ2 browser-verified, Φ2b κώδικας έτοιμος, UNCOMMITTED.
- 🔴 **Φ2b έπιπλα browser-verify** (Τέκτων): (1) **κουτί ύψους** — `width` vs `h1/h2`: ξεκίνα `width=heightM`, calibrate αν δεν εξωθεί. (2) **CCW/σειρά** κορυφών footprint — flip αν χρειαστεί. (3) **Z/elevation** — `pointZ=mountingM` vs `elev1`.
- 🔴 **Φ-A στέγη browser-verify** (Τέκτων): native `<autoroof>` (decoded από `ΔΙΑΦΟΡΑ.tek`). Calibration knobs: (1) **winding** `<point>` (CCW δικό μας vs CW δείγματος — flip αν λάθος)· (2) **αντιστοίχιση `<angle>`↔ακμή** (κορυφή i → ακμή i→i+1)· (3) αν ο Τέκτων **recompute-άρει** το `<v3list>` από point+angle (τότε αρκεί point/angle· αλλιώς το v3list από `geometry.faces` πρέπει να ταιριάζει winding)· (4) επίπεδη στέγη (angle 0, κενά faces) ζωγραφίζεται;
- 🔴 **Φ-D primitives→export** (line/circle/arc — DECODED από `ΔΙΑΦΟΡΑ.tek`): `<line>` type 4 (v0→v1)· `<arc>` type 5 (circle 0/1 + centre + p0/p1). Χρειάζεται `collectTekLines/Arcs` + templates + markers (ΟΧΙ ακόμη υλοποιημένο).
- ⚠️ **Φ-B γραμμοσκίαση**: το `<hatch>` ΗΤΑΝ ΚΕΝΟ στο δείγμα → ο Τέκτων δεν αποθήκευσε τη γραμμοσκίαση ως `<hatch>`. Flat-plane fallback ή νέο δείγμα με ορατή γραμμοσκίαση.
- ⚠️ **Object route ΑΠΟΡΡΙΦΘΗΚΕ** (αρχείο): τα `<object>` records είναι library-based (`<type>2072</type>`, σταθερές διαστάσεις) → ακατάλληλα για arbitrary-size έπιπλα. Επιλέχθηκε `<plane>` (footprint+εξώθηση). Το `<plane>` reuse-able και για στατικά slabs (Φ3).
- Φάση 3: **στατικά** (pillar/beam/slab/footing — node/plane-based, χρειάζεται μοντέρνο γεμάτο δείγμα).
- Multi-floor `all-single` (πολλαπλά `<floor>`)· curved/polyline τοίχοι.
- ⚠️ version-specific (fileversion 516)· μπορεί να σπάσει σε νέα έκδοση Τέκτονα.

## Changelog
- **2026-06-22 (Φ-A v6 — αετώματα ως `<v3list>` faces· κορυφές που «δεν ταυτίζονταν»)** — Μετά το v5 η δίρριχτη ζωγραφιζόταν αλλά **οι κορυφές των αετωμάτων δεν έκλειναν** (Giorgio: «η μία κορυφή σωστή, η άλλη όχι· οι γραμμές δεν ταυτίζονται»). ΡΙΖΑ (diff vs ground-truth `ΣΤΕΓΗ_ΔΙΡΡΥΧΤΗ`): το ground-truth δίρριχτη έχει **4 `<onev3list>` = 2 νερά + 2 αετώματα-τρίγωνα**· το export μας είχε **μόνο 2** (τα νερά). Ο roof solver (`solveLowerEnvelope`) παράγει μόνο τη lower envelope (κεκλιμένα νερά)· τα **αετώματα** (κατακόρυφες όψεις στις μη-κεκλιμένες ακμές) δεν ανήκουν στην envelope → λείπουν από `geometry.faces` → ο Τέκτων τα αφήνει ανοιχτά. FIX (FULL SSoT): NEW `buildGableFaces` (`tek-geometry.ts`) — για κάθε μη-κεκλιμένη ακμή A→B χτίζει κατακόρυφο face `A(base)→B(base)→ridgeApex(es)`· τα apex έρχονται από τα **ήδη-υπολογισμένα `geometry.ridges`** (on-segment test, μηδέν re-derive κορυφογραμμής). `toTekRoof.faces = [...νερά, ...αετώματα]`. Defensive σε απόντα ridges (flat/mock → []). **VERIFY:** hand-patched `ΠΕΙΡΑΜΑ_αετωματα.tek` (problem export + 2 αετώματα faces). +2 jest (δίρριχτη→4 onev3list· χωρίς ridges→graceful)· **57 tek-suite GREEN**. 🔴 Giorgio re-export από Nestor + final browser-verify + commit.
- **2026-06-22 (Φ-A v5 — gable αέτωμα `angle`=π/2 fix· ✅ VERIFIED hand-patched)** — **ΡΙΖΑ ΛΥΘΗΚΕ: η ΔΙΡΡΙΧΤΗ δεν ζωγραφιζόταν** (η ΤΕΤΡΑΡΙΧΤΗ uniform ζωγραφιζόταν — επιβεβαιώθηκε από Giorgio). Διάγνωση με **ground truth**: `ΣΤΕΓΗ_ΔΙΡΡΥΧΤΗ_ΚΑΘΕΤΑ_ΑΕΤΩΜΑΤΑ.tek` (δίρριχτη φτιαγμένη ΣΤΟΝ Τέκτονα) δείχνει ότι το `<angle>` είναι η **κλίση της πλευράς από το οριζόντιο**: `0`=οριζόντιο νερό (επίπεδη στέγη), `π/2`=**κατακόρυφη πλευρά = αέτωμα (gable end)**. Ο exporter έγραφε `atan(0)=0` για το αέτωμα (`definesSlope=false`) → ο Τέκτων το έβλεπε ως **οριζόντιο**, αδυνατούσε να συμβιβάσει 2 κεκλιμένα νερά με 2 οριζόντιες ακμές → straight-skeleton fail → αόρατη στέγη. FIX (FULL SSoT, 1 αρχείο): `bim-to-tek.ts` `toTekRoof` — `hasSlopedEdge = p.edges.some(definesSlope)`· μη-κεκλιμένη ακμή → `π/2` αν η στέγη ΕΧΕΙ νερά (αέτωμα), αλλιώς `0` (εντελώς επίπεδη στέγη). Reuse `roofSlopeToRatio` αμετάβλητο. **`volume` δεν χρειάστηκε fix** (το `roof_volume_acc=0` στο παλιό `ΕΞΑΓΩΓΗ.tek` ήταν προ-v3 export artifact· ο τρέχων `geometry.volumeM3` βγάζει σωστά θετικό — η τετράριχτη export έδειξε 2.775). **VERIFY:** hand-patched `ΠΕΙΡΑΜΑ_gable.tek` (broken δίρριχτη με τα 2 αετώματα 0→π/2) → **εμφανίστηκε στον Τέκτονα ✅**. 2 jest updated (gable test: αέτωμα→π/2· CW→CCW test: 2 νερά 0.5236 + 2 αετώματα π/2)· 55 tek-suite GREEN. **ΜΑΘΗΜΑ:** «parse-άρεται αλλά αόρατο» με ανάμεικτες κλίσεις → ζήτα **ground-truth δείγμα του ίδιου τύπου φτιαγμένο στο native εργαλείο** + απομόνωσε τη μεταβλητή με hand-patched πειράματα (volume vs angle). 🔴 Giorgio re-export από Nestor + final browser-verify + commit.
- **2026-06-22 (Φ-A v4 — CCW winding fix)** — **BUGFIX #2: η στέγη ΑΚΟΜΗ δεν εμφανιζόταν** μετά το dedup. Διάγνωση με **ανάγνωση του ΠΡΑΓΜΑΤΙΚΟΥ exported αρχείου** (`ΕΞΑΓΩΓΗ.tek`): οι coords ήταν σωστές (2-8m, κοντά origin — το 4km warning ήταν από προηγούμενο «τεράστιο» test, ΟΧΙ αυτό)· faces καθαρά (dedup ΟΚ). **ΡΙΖΑ:** το footprint `<point>` ήταν **CW** ενώ το working δείγμα **CCW** (signed area). Το canvas Y είναι «κάτω» → CCW-σε-canvas = CW-σε-Τέκτονα → ο Τέκτων χτίζει ανάποδα → αόρατη στέγη. FIX: NEW `signedAreaXY` + `reverseRoofFootprint` (αναστροφή winding **με σωστή μετατόπιση κλίσης ανά ακμή** — η angle είναι της εξερχόμενης ακμής)· `toTekRoof` normalize footprint σε CCW. **Face winding ΔΕΝ μετράει** (το δείγμα έχει ανάμεικτα CW/CCW faces → ο Τέκτων ξαναϋπολογίζει από footprint+angle) → faces αμετάβλητα. 3 jest (147 export-suite GREEN), tsc clean. **ΜΑΘΗΜΑ:** για render bug «parse-άρεται αλλά αόρατο» → διάβασε το ΠΡΑΓΜΑΤΙΚΟ output + diff winding/structure vs working δείγμα (όχι μόνο coords). 🔴 Giorgio re-export+browser-verify.
- **2026-06-22 (Φ-A v3 — dedup fix)** — **BUGFIX: η στέγη δεν εμφανιζόταν στον Τέκτονα** (browser test Giorgio: το `<autoroof>` parse-αρόταν —panel έδειχνε γωνία/υψόμετρο/πάχος σωστά— αλλά **δεν ζωγραφιζόταν**). ΡΙΖΑ (βρέθηκε με dump+diff vs δείγμα): τα `geometry.faces[].outline` είναι **closed rings με degenerate επαναλήψεις** (διαδοχικές διπλές κορυφές + κλείσιμο first==last· ακμές μηδενικού μήκους) — ο Τέκτων **απορρίπτει** τέτοια `<v3list>` faces. Τα έγκυρα faces του δείγματος = **απλά ανοιχτά πολύγωνα** (3-4 distinct, καμία επανάληψη). FIX: NEW `dedupeFaceRing` (3D σύγκριση με ε=1μm· αφαιρεί διαδοχικές διπλές + trailing closure· κρατά κορυφές με ίδιο xy/διαφορετικό z = γνήσιες κλίσης) μέσα στο `roofFaceRingToMeters`· faces που καταρρέουν <3 κορυφές → filtered. **Επιβεβαίωση:** dump με ΑΛΗΘΙΝΟ roof engine → faces τώρα ίδια δομή με δείγμα (τραπέζια/τρίγωνα). Coords ήταν ΗΔΗ σωστές (proven: στέγη@origin→μέτρα· 4km warning ήταν red herring/θέση). +2 jest (144 export-suite GREEN), tsc clean. 🔴 **Giorgio re-export (dev hot-reload) + browser-verify Τέκτων**.
- **2026-06-22 (Φ-A v2 — autoroof)** — **Φάση A: ΣΤΕΓΗ → native `<autoroof>` (κεκλιμένη)**. Decode `<autoroof>` (type 8) από `ΔΙΑΦΟΡΑ.tek` (record n=1 = hip 10×5m): `<point>` = footprint κορυφές + **`<angle>` κλίση ακμής σε RADIANS**· `<v3list>` = τα «νερά» (faces) ως `<onev3list>` 3D πολύγωνα (per-vertex z, γείσο→κορφιάς)· `<elevation>`=βάση, `<width>`=πάχος. **Αντικατέστησε** το αρχικό flat-`<plane>` MVP (η στέγη ΔΕΝ είναι plane). NEW `AUTOROOF_RECORD/POINT/V3_TEMPLATE` (auto-gen), `TekRoof`/`TekRoofPoint`/`TekRoofFace`, `roofFaceRingToMeters` (per-vertex z mm→m), `buildAutoroofRecordXml`/`buildRoofPointsXml`/`buildRoofV3ListXml`, `collectTekRoofs`/`toTekRoof`· `<!--TEK_AUTOROOF_RECORDS-->` marker μέσα στο `<autoroof>`· `injectTekEntities` 4ο `autoroofsXml` param. **FULL SSoT (Giorgio audit):** footprint+κλίση από `params.outline`/`params.edges` μέσω του **υπάρχοντος `roofSlopeToRatio`** (ίδιο που χρησιμοποιεί ο roof solver)→`atan`· «νερά» από το **ήδη-υπολογισμένο `geometry.faces[].outline`** (μηδέν re-derive γεωμετρίας). Στέγη αφαιρέθηκε από `isTekPlaneEntity` (→ furniture-only). 7 αρχεία κώδικα + 2 test· 10 Φ-A jest (46 tek-core, 142 export-suite GREEN), tsc clean (9 errors=ΑΛΛΩΝ agents). 🔴 browser-verify (winding/angle↔ακμή/v3list-recompute/flat) + commit. **ΜΑΘΗΜΑ:** το ΔΙΑΦΟΡΑ.tek ξεκλείδωσε ΚΑΙ `<line>`/`<arc>` (Φ-D) — `<hatch>` ΚΕΝΟ (Φ-B blocked).
- **2026-06-22 (Φ-A v1, ΑΝΤΙΚΑΤΑΣΤΑΘΗΚΕ)** — αρχικό MVP στέγη→flat `<plane>` (πριν το δείγμα). Υπερκεράστηκε από το native `<autoroof>` παραπάνω μόλις ήρθε το `ΔΙΑΦΟΡΑ.tek`.
- **2026-06-22** — **Φάση 2b: ΕΠΙΠΛΑ ως `<plane>` κουτιά**. Decode `<plane>` (type 10) από `ΠΛΑΚΑ.tek`: `<point3d>`=footprint πολύγωνο σε world μέτρα, `<width>`=πάχος εξώθησης, `pointZ`=στάθμη. Object route (`<type>2072</type>`) απορρίφθηκε ως library-based (σταθερές διαστάσεις). NEW `PLANE_RECORD_TEMPLATE`/`PLANE_POINT_TEMPLATE` (auto-gen), `TekPlane`/`TekPlanePoint`, `footprintRingToMeters`, `buildPlaneRecordXml`/`buildPlanePointsXml`, `collectTekPlanes`· `<!--TEK_PLANE_RECORDS-->` marker στο `<plane>`· `injectTekEntities` 3ο `planesXml` param. width=ύψος=εξώθηση. **SSoT audit (Giorgio):** αρχικά χρησιμοποιούσα `computeFurnitureGeometry` (params-recompute)· ευθυγραμμίστηκε με τους **γενικούς export extractors `extractEntityFootprintRing` + `extractHeightMm`** (bim-to-dxf-primitives) — οι ΙΔΙΟΙ που τρέφουν DXF/IFC → ΕΝΑΣ footprint/height extractor για ΟΛΑ τα formats, μηδέν 2η διαδρομή, `collectTekPlanes` γενικό (Φ3 slabs = +τύπος στο filter). 9 NEW jest (36 tek-core σύνολο, 131 export-suite GREEN), tsc clean (δικά μου). 🔴 browser-verify (width vs h1/h2· CCW· Z) + commit.
- **2026-06-21 (c2)** — **Φ2 BROWSER-VERIFIED ✅** στον Τέκτονα (τοίχος+κούφωμα: 2Δ+3Δ θέση/πλάτος σωστά). Επαλήθευση: opening origin = ακριβώς centerline (y ταυτίζεται), offset+πλάτος σωστά, κάθετο=wall normal — μηδέν calibration χρειάστηκε (ο SSoT `computeOpeningGeometry` έδωσε σωστό κέντρο). 🔴 commit.
- **2026-06-21 (c)** — **Φάση 2: ΚΟΥΦΩΜΑΤΑ** (πόρτες/παράθυρα → nested `<open>`). Decode `<open>` record από `ΤΟΙΧΟΣ+ΠΟΡΤΑ+ΠΑΡΑΘΥΡΟ.tek` (elevation=ποδιά, top=υπέρθυρο, style 0/1=παράθυρο/πόρτα). NEW `OPEN_RECORD_TEMPLATE`, `TekOpening`, `buildXMatrix` (γενικό SSoT primitive — wall+opening περνούν από εκεί), `buildOpeningPlacement`, `buildOpenRecordXml`/`buildOpenXml`· `collectTekWalls` group openings ανά `wallId`→nested `<open>` (+orphan warnings, +`openingCount`). Opening xmatrix = column-major με ΜΟΝΑΔΙΑΙΟ κάθετο (host κόβει στο πάχος)· λοξό-safe μέσω reuse των wall άκρων (verified convention). 12 NEW jest (27 σύνολο, 121 export-suite GREEN), tsc clean. **Έπιπλα BLOCKED** (δείγμα 0°+library-id· βλ. DEFER). 🔴 browser-verify+commit.
- **2026-06-21 (b)** — **Browser-verified ✅** (Τέκτων: εμφάνιση+διαστάσεις σωστά). **Calibration fix:** ο Τέκτων διαβάζει το xmatrix **column-major** (length axis=(x00,x01), thickness=(x10,x11)) → χρειάστηκε **transpose** (swap x01↔x10). Δεν φάνηκε στο αρχικό decode γιατί το δείγμα ήταν **οριζόντιος τοίχος** (x01=x10=0 → degenerate, οι δύο αναγνώσεις ταυτίζονται)· οι **λοξοί** τοίχοι του Giorgio αποκάλυψαν τον ρόμβο (sheared footprint). ΜΑΘΗΜΑ: για decode affine matrix, χρησιμοποίησε **μη-degenerate (λοξό)** δείγμα — το axis-aligned κρύβει row/column-major + transpose. **SSoT fix (ίδια συνεδρία):** `metersPerCanvasUnit`→reuse `sceneUnitsToMeters`· `escapeXml`→NEW `src/lib/xml/escape-xml.ts` SSoT. 15 jest. 🔴 commit.
- **2026-06-21** — Φάση 1 (τοίχοι). Decode `.TEK`=XML v9.1 + xmatrix. Template-based exporter (sanitized σκελετός + parameterized wall record), 7 NEW modules + wiring 5 σημεία + i18n. 19 jest, tsc clean. UNCOMMITTED· 🔴 browser-verify.
