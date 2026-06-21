# ADR-512 — Εξαγωγή Tekton `.TEK` (αρχιτεκτονικά)

**Status:** 🟢 Φάση 1 (τοίχοι) **BROWSER-VERIFIED στον Τέκτονα** (εμφάνιση+διαστάσεις σωστά) 2026-06-21 — UNCOMMITTED, 🔴 commit (μόνο Giorgio).
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
- **xmatrix DECODED** (δείγμα τοίχου (0,0)→(5,0) πάχος 0.25 → `x00=5,x11=0.25,rest=0`, `height=3`):
  `(x00,x10)=E−S` (διάνυσμα μήκους)· `(x01,x11)=n̂·thickness` (n̂=μοναδιαίο κάθετο)· `(x20,x21)=σημείο εκκίνησης (παρειά)`.

## Αρχιτεκτονική — **Template-based** (full SSoT)
Δεν παράγουμε ~24k γραμμές από το μηδέν. Κρατάμε **sanitized σκελετό** (head+global+building+άδειο floor, με μηδενισμένα usid/SID/user/runtime για privacy) και **εγχέουμε μόνο τα records** στους markers του `<floor>`. Ανθεκτικό· lazy-loaded (εκτός main bundle).

### Modules (NEW)
- `export/core/tek/tek-skeleton.template.ts` — AUTO-GENERATED sanitized σκελετός + markers `<!--TEK_WALL_RECORDS-->`/`<!--TEK_OBJECT_RECORDS-->` (data file).
- `export/core/tek/tek-record-templates.ts` — AUTO-GENERATED parameterized `WALL_RECORD_TEMPLATE` (placeholders ID/NAME/HEIGHT/ELEVATION/COLOR/XMATRIX/OPEN).
- `export/core/tek/tek-types.ts` — `TekWall`/`TekXMatrix`.
- `export/core/tek/tek-geometry.ts` — `metersPerCanvasUnit` (reuse `mmToSceneUnits`), `mmToMeters`, `buildWallXMatrix` (decoded τύπος· origin −n̂·t/2 centerline→παρειά).
- `export/core/tek/tek-xml-writer.ts` — `tekNum`/`escapeXml`/`colorHex6`/`xmatrixXml`/`buildWallRecordXml`/`injectTekEntities` (pure· template ως όρισμα).
- `export/core/tek/bim-to-tek.ts` — `collectTekWalls` (straight walls → records· curved/polyline→skip+warning).
- `export/formats/tek-export-adapter.ts` — `assembleTekDocument` (pure) + `buildTekDocument` (lazy template) + `exportFloorToTek`.

### Wiring (MOD)
`export/types.ts` `ExportFormat`+='tek'· `export-service.ts` `runTekExport` (active→1 .tek· πολλοί→zip· all-single=DEFER)· `ExportDialog.tsx` `FORMAT_OPTIONS`+='tek'· `useExportDialogState.ts` tek=BIM-required scope (όπως ifc)· i18n `export.formats.tek` el+en. (`ExportHost.handleSubmit`: tek πέφτει αυτόματα στο `runExport`.)

## Reuse
`mmToSceneUnits` (scene-units SSoT)· `resolveExportEntities`/`resolveExportFloors`· `buildFloorFilename`/`triggerExportDownload`/`createStoredZip`· `isWallEntity`+`WallEntity.params`.

## Tests
19 jest: geometry (canvas→meters, xmatrix=decoded)· writer (num/escape/color/record-fill/inject)· mapper (straight→record, curved→skip)· adapter (scope filter, injection). 102 export-suite GREEN, tsc clean.

## Εκκρεμότητες / DEFER
- 🔴 **browser-verify (Τέκτων)**: 1 τοίχος round-trips (θέση/μήκος/γωνία/πάχος)· επιβεβαίωση **centerline-vs-παρειά** half-thickness offset (πρόσημο) + πιθανό **Y-flip** (canvas Y-down vs Τέκτων Y-up) → 1-γραμμή calibration.
- Φάση 2: **κουφώματα** (nested `<open>`) + **έπιπλα** (`<object>`, χρειάζεται object δείγμα).
- Φάση 3: **στατικά** (pillar/beam/slab/footing — node-based, χρειάζεται μοντέρνο γεμάτο δείγμα).
- Multi-floor `all-single` (πολλαπλά `<floor>`)· curved/polyline τοίχοι.
- ⚠️ version-specific (fileversion 516)· μπορεί να σπάσει σε νέα έκδοση Τέκτονα.

## Changelog
- **2026-06-21 (b)** — **Browser-verified ✅** (Τέκτων: εμφάνιση+διαστάσεις σωστά). **Calibration fix:** ο Τέκτων διαβάζει το xmatrix **column-major** (length axis=(x00,x01), thickness=(x10,x11)) → χρειάστηκε **transpose** (swap x01↔x10). Δεν φάνηκε στο αρχικό decode γιατί το δείγμα ήταν **οριζόντιος τοίχος** (x01=x10=0 → degenerate, οι δύο αναγνώσεις ταυτίζονται)· οι **λοξοί** τοίχοι του Giorgio αποκάλυψαν τον ρόμβο (sheared footprint). ΜΑΘΗΜΑ: για decode affine matrix, χρησιμοποίησε **μη-degenerate (λοξό)** δείγμα — το axis-aligned κρύβει row/column-major + transpose. **SSoT fix (ίδια συνεδρία):** `metersPerCanvasUnit`→reuse `sceneUnitsToMeters`· `escapeXml`→NEW `src/lib/xml/escape-xml.ts` SSoT. 15 jest. 🔴 commit.
- **2026-06-21** — Φάση 1 (τοίχοι). Decode `.TEK`=XML v9.1 + xmatrix. Template-based exporter (sanitized σκελετός + parameterized wall record), 7 NEW modules + wiring 5 σημεία + i18n. 19 jest, tsc clean. UNCOMMITTED· 🔴 browser-verify.
