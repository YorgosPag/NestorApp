# ADR-526 — Εισαγωγή Tekton `.TEK` (σκάλες πρώτα)

**Status:** 🟢 Φάση 1 (parser + stair extractor + BIM mapper + scene builder + import service) **IMPLEMENTED + UNIT-VERIFIED** (18 jest GREEN) + **REAL-FILE-VERIFIED** στο `ΣΚΑΛΑ.tek` (FESPA 9.1.0.46) 2026-06-25. 🟢 Φάση 2 (UI wiring: ribbon κουμπί «Εισαγωγή Τέκτονα» + native file picker + scene-load + stair first-save) **CODE-COMPLETE** (tsc clean) — 🔴 browser-verify εκκρεμεί. 🟢 Φάση 3 (**EXPORT** σκαλών `<stair>` type 21 → `.tek`, ο αντίστροφος του import) **CODE-COMPLETE + UNIT-VERIFIED** (νέα tek-stair-export suite + ενημερωμένα tek-export/adapter suites — όλα GREEN) 2026-06-25 — 🔴 Τέκτων round-trip verify (Giorgio) εκκρεμεί. UNCOMMITTED. Commit μόνο Giorgio.
**Σχετικά:** [[ADR-512]] (Tekton `.TEK` EXPORT — ο καθρέφτης write-side· ίδιο σχήμα/μονάδες/Y-flip). Stair model: ADR-358 (stair subsystem), ADR-401 (attach-to-structural).

## Context / Πρόβλημα
Ο **Τέκτων (FESPA, 4M)** είναι κυρίαρχος στατικός/αρχιτεκτονικός στην Ελλάδα. Έχουμε ήδη EXPORT προς `.TEK` (ADR-512). Ο Giorgio έδωσε δείγμα **3Δ σκάλας** (`ΣΚΑΛΑ.tek`, ελικοειδής/winder, 16 βαθμίδες, ύψος 2.90 m) και ζήτησε: (1) να την **αναγνωρίσουμε σε 2Δ & 3Δ**, (2) να **εισάγεται** στην εφαρμογή, (3) επιβεβαίωση ότι **εξάγουμε** σκάλες προς Τέκτονα.

**Νομικό/interoperability:** ίδιο σκεπτικό με ADR-512 — το `.TEK` v9.1 (fileversion 516) είναι **απλό UTF-8 XML** που έφτιαξε ο χρήστης· καμία αποσυμπίληση, formats δεν προστατεύονται copyright, interoperability ΕΕ Οδ. 2009/24. Στοχεύουμε **ΜΟΝΟ** τη σημερινή XML μορφή.

**Ευρήματα από decode του δείγματος:**
- Δομή: `tekton > body > building > floor[] > stair > record` (⚠️ οι όροφοι είναι κάτω από `<building>`, **όχι** άμεσα στο `<body>`).
- `<stair>` = entity **type 21**, πλήρως παραμετρικό. Μόνο ο 1ος όροφος είχε σκάλα· οι υπόλοιποι `<stair></stair>` άδειοι.
- Συντεταγμένες σε **ΜΕΤΡΑ**, Y «προς τα πάνω» (CAD). Ο καμβάς μας έχει Y «προς τα κάτω» → **Y-flip** (αντίστροφο της `buildXMatrix` του export).

## Σχήμα `<stair>` (type 21) — decoded
```
<record>
 <type>21</type><n>..</n><taglist/>
 <point2d>… <record><pX/><pY/></record> …</point2d>   ← πολλαπλές: ακμές βαθμίδων,
 <point2d>…</point2d>                                    εσωτ./εξωτ. περίγραμμα, γραμμή πορείας
 <intlist>… 2 1 2 1 …</intlist>                          ← τύπος τμήματος (1=τόξο/2=ευθεία)
 <start_elevation/> <end_elevation/>   ← στάθμες (μέτρα): ύψος = end − start
 <steps/> <landings/>                  ← πλήθος πατημάτων / πλατύσκαλων
 <stair_width/>                        ← καθαρό πλάτος (μέτρα)
 <horiz_b/>                            ← ΠΑΤΗΜΑ / going (μέτρα)
 <vert_b/>                             ← ΡΙΧΤΙ / riser (μέτρα)
 <slope_h/>                            ← πάχος πλάκας/μηρού (μέτρα)
 <min_step_width/>                     ← ελάχ. πλάτος winder (>0 ⇒ ελικοειδής)
 <wlength/> <steps_numbering/>
 …χρώματα/πένες ανά συστατικό (horiz_/vert_/slope_/sideL_/handrailL_/columnL_…)
</record>
```
**Δείγμα `ΣΚΑΛΑ.tek`:** start=0, end=2.9, steps=16, width=0.80, horiz_b≈0.2743, vert_b≈0.17059, slope_h=0.15, min_step_width=0.07, 6 point2d πολυγραμμές (8/8/17/18/18/18 κορυφές).

## Απόφαση — Αρχιτεκτονική (pure pipeline, mirror του DXF import)
Νέος φάκελος `src/subapps/dxf-viewer/io/tek/` (read-side, καθρέφτης του `export/core/tek/`):

| Module | Ρόλος |
|---|---|
| `tek-import-types.ts` | Ενδιάμεσοι τύποι (`TekPoint2D`, `TekStairRecord`, `TekParseResult`) — μέτρα, μηδέν geometry math |
| `tek-xml-reader.ts` | Γενικοί DOM helpers (native `DOMParser`, **καμία νέα εξάρτηση** — N.5)· `TekParseError` |
| `tek-stair-extract.ts` | `tekton>body>building>floor>stair` walk → `TekStairRecord[]` (faithful, καμία μετατροπή) |
| `tek-stair-to-bim.ts` | `TekStairRecord` → `StairEntity` (inverse units + Y-flip + basePoint/direction/variant) |
| `tek-scene-builder.ts` | `TekParseResult` → `SceneModel` (bounds από `geometry.bbox`) |
| `tek-import.ts` | Service-level: `File`/content → `SceneModel` (καθρέφτης `DxfImportService`) |

**SSoT reuse (μηδέν re-impl):** `mmToSceneUnits` (μονάδες), `buildDefaultStairParams` + `buildStairEntity` (StairParams defaults + geometry compute). Εδώ μένει ΜΟΝΟ η Tekton-specific λογική.

### Μετατροπές (αντίστροφες του ADR-512)
- **Μονάδες:** Τέκτων μέτρα → scene units = `μέτρα × 1000 × mmToSceneUnits(units)`. Σκηνή σε **mm** (1 m = 1000 mm).
- **Y-flip:** `canvasY = −tektonY` (ακριβώς αντίστροφο της Y-negation στο `buildXMatrix`).

### Χαρτογράφηση παραμέτρων (decisions)
- **stepCount = `round(ΔΥψος / vert_b)`** (= πλήθος ριχτιών, **17** στο δείγμα) — πιο αξιόπιστο από το Tekton `<steps>` (=16, μετρά πατήματα· διαφέρει κατά 1). Fallback στο `<steps>` αν λείπει ρίχτι.
- **rise = `ΔΥψος / stepCount`** ⇒ `totalRise === ΔΥψος` **ακριβές** (διατήρηση ύψους ορόφου 2900 mm), ~ίσο με το ρίχτι του Τέκτονα.
- **tread = horiz_b**, **width = stair_width**, **waistThickness = slope_h × 1000** (mm, BOQ).
- **basePoint + direction + turnAngle:** από τη **γραμμή πορείας** (= η μεγαλύτερη πολυγραμμή σε κορυφές, μετά από φιλτράρισμα outlier label-anchors > 20 m από τον διάμεσο). `direction` = heading 1ου τμήματος, `turnAngle` = heading τελευταίου − πρώτου.
- **variant:** `|turnAngle| < 20°` → `straight`, αλλιώς `winder` με `winderCount ≈ round(|turn|/30°)`. (Δείγμα → winder, turn 90°, winderCount 3.)

**Όριο Φάσης 1 (ειλικρίνεια):** η παραμετρική σκάλα τοποθετείται σωστά (θέση/κλίμακα/βαθμίδες/ύψος/τύπος) και αποδίδεται 2Δ+3Δ από τη δική μας geometry engine. Η **pixel-perfect** αναπαραγωγή του ελικοειδούς footprint του Τέκτονα (ακριβής κατανομή winders) είναι επόμενη φάση — εναλλακτικές: `sketch` variant με walklinePath, ή διατήρηση των αυθεντικών point2d ως 2Δ overlay.

## Απάντηση στις 3 ερωτήσεις Giorgio
1. **Αναγνώριση 2Δ** → ✅ ΝΑΙ (point2d πολυγραμμές = ακριβές κάτοψης).
2. **Αναγνώριση 3Δ** → ✅ ΝΑΙ (πλήρως ανακατασκευάσιμη — όλα τα παραμετρικά υπάρχουν· χαρτογραφείται στο `StairEntity`/winder).
3. **Εισαγωγή στην εφαρμογή** → 🟢 Engine έτοιμο & verified (Φ1)· 🔴 UI wiring (Φ2) για clickable import στον browser.
4. **Εξαγωγή σκαλών ΠΡΟΣ Τέκτονα** → 🟡 ΜΕΡΙΚΩΣ: υπάρχει `.tek` exporter (ADR-512: τοίχοι/κουφώματα/πλάκες/στέγες) + το skeleton δηλώνει `bp_staircase->*` defaults, **αλλά** το `bim-to-tek.ts` **δεν εκπέμπει ακόμα `<stair>` type-21**. Προσθήκη εφικτή (το format αποκωδικοποιήθηκε εδώ).

## Φάση 2 — UI wiring (CODE-COMPLETE, 🔴 browser-verify)
Υλοποιημένα σημεία ένταξης (reuse υπάρχοντος DXF import path, **μηδέν νέο dialog**):
- `ui/ribbon/data/insert-tab.ts`: κουμπί «Εισαγωγή Τέκτονα» (panel `dxfFiles`, `action: 'import-tek'`, i18n `ribbon.commands.importTek` el+en).
- `app/useDxfViewerCallbacks.ts`: action `import-tek` → `EventBus.emit('dxf:import-tek-requested')` (pattern ExportHost, αποφεύγει TDZ closure στο `handleFileImportWithEncoding`).
- `systems/events/drawing-event-map.ts`: νέο typed event `dxf:import-tek-requested`.
- `app/DxfViewerDialogs.tsx`: hidden `<input type=file accept=".tek,.txt">` + listener → `handleFileImportWithEncoding(file)` (ίδιο entry με DXF· μηδέν διπλό pipeline).
- `hooks/scene/useSceneState.ts` `handleFileImport`: branch `isTekFileName(file.name)` → `importTekFile` (level-resolution κοινό). Μετά το `setLevelScene`, **first-save κάθε σκάλας** via `EventBus.emit('drawing:entity-created', { entity, tool: 'stair' })` → ο `StairPersistenceHost` γράφει στο Firestore `floorplan_stairs`. Warnings/errors → `notifications`.

## Φάση 3 — EXPORT σκαλών `<stair>` (type 21) → `.tek` (CODE-COMPLETE, 🔴 Τέκτων round-trip)

Ο αντίστροφος της Φ1: `StairEntity` → `<stair><record>` (type 21), ενσωματωμένος στον υπάρχοντα
tek exporter (ADR-512) δίπλα σε τοίχους/πλάκες/στέγες/γραμμές/τόξα. **Απόφαση = FAITHFUL** (όχι
lossy re-parametrization): τα scalars + οι πολυγραμμές προκύπτουν από την **ήδη υπολογισμένη**
`StairGeometry`, ώστε ο Τέκτων να αναγνωρίζει 2Δ ΑΜΕΣΩΣ και (παραμετρικός) να ανακατασκευάζει 3Δ.

### Pipeline (mirror του wall/roof export, μηδέν νέα διαδρομή)

| Module | Προσθήκη |
|---|---|
| `export/core/tek/tek-types.ts` | `TekStair` + `TekStairPoint` (μέτρα, Y-flipped) |
| `export/core/tek/tek-record-templates.ts` | `STAIR_RECORD_HEAD` + `STAIR_RECORD_TAIL` (πιστή αντιγραφή scalars/χρωμάτων από `ΣΚΑΛΑ.tek`· placeholders) |
| `export/core/tek/tek-xml-writer.ts` | `buildStairPoint2dXml` / `buildStairIntlistXml` / `buildStairRecordXml` + `TEK_STAIR_MARKER` + 7ο όρισμα `stairsXml` στο `injectTekEntities` |
| `export/core/tek/bim-to-tek.ts` | `collectTekStairs(entities, metersPerSceneUnit)` + `toTekStair` |
| `export/formats/tek-export-adapter.ts` | κλήση `collectTekStairs(selected, f)` + `stairsXml` στο inject |
| `export/core/tek/tek-skeleton.template.ts` | `<!--TEK_STAIR_RECORDS-->` μέσα στο `<stair>` |

### Χαρτογράφηση παραμέτρων (αντίστροφη της Φ1, ίδιο SSoT)
- **Μονάδες:** οι διαστάσεις σκάλας ζουν σε **scene units** (όχι per-entity mm) → `× sceneUnitsToMeters(scene.units)` (ίδιο convention με `collectTekLines/Arcs`, ΟΧΙ per-entity όπως οι τοίχοι).
- **Y-flip:** νέα SSoT `sceneXYToTekMeters` στο `tek-geometry.ts`· ΞΑΝΑΓΡΑΦΤΗΚΑΝ `footprintRingToMeters`/`roofFaceRingToMeters` να την καλούν → **ΕΝΑ** σημείο export Y-flip (boy-scout N.0.2, μηδέν behavior change).
- `tread→horiz_b`, `rise→vert_b`, `width→stair_width`, `waistThickness(mm)→slope_h` (`mmToMeters`), `basePoint.z→start_elevation`, `+totalRise→end_elevation`, `landings=geometry.landings.length`, `wlength=polylineLength(walkline)` (SSoT reuse).
- **`<steps>` = πατήματα = `stepCount − 1`** (το import αντιστρέφει: `stepCount = round(ΔΥψος/ρίχτι)` = ρίχτια· ο Τέκτων μετρά πατήματα → −1).
- **Πολυγραμμές (FESPA-fixed schema: 3 point2d + 7 intlist + 5 point2d):** βέλος (`arrowSymbol`) → slot 1· γραμμές βαθμίδων (`risers`) → slot 3· εσωτ./εξωτ. περίγραμμα (`stringers.inner/outer`) → slots 4/5· γραμμή πορείας (`walkline`) → slot 6· slots 2/7/8 κενά.
- **intlist segment-types:** straight ⇒ όλα `2` (ευθεία). **ΚΡΙΣΙΜΟ:** ο Τέκτων διαβάζει τα point2d των slots με intlist ως **ανεξάρτητα τμήματα** (γραμμή=2 σημεία, τόξο=3) → `segCount = κορυφές / 2` (ΟΧΙ N−1 συνδεδεμένης πολυγραμμής). Λάθος count = parser overrun = το αρχείο δεν ανοίγει.

### Όριο Φάσης 3 (ειλικρίνεια — προς επιβεβαίωση στο Τέκτων round-trip του Giorgio)
- **Winders/καμπύλες:** οι ελικοειδείς σκάλες τοποθετούνται σωστά (θέση/κλίμακα/scalars) αλλά οι πολυγραμμές βγαίνουν ως **ευθύγραμμα τμήματα** (intlist όλα `2`, `min_step_width=0`). Πιστή αναπαραγωγή τόξων/winder κατανομής = **Φ3b**.
- Οι ακριβείς σημασιολογίες των FESPA slots 1/2 (βέλος εσωτ./εξωτ.) + intlist groupings δεν επαληθεύτηκαν χωρίς Τέκτονα — οι επιλογές είναι λογικές/συντηρητικές και εύκολα ρυθμίσιμες αν το round-trip δείξει απόκλιση.
- **Validation = round-trip** (Giorgio): export από εμάς → άνοιγμα στον Τέκτονα → ίδια σκάλα. Ground-truth σύγκριση με `ΣΚΑΛΑ.tek`.

## Κεντρικοποίηση (SSoT audit — Giorgio 2026-06-25)
Μετά από SSoT audit, τα 5 αρχικά **διπλότυπα** helpers αντικαταστάθηκαν με υπάρχοντα SSoT:
- `RAD_TO_DEG` → `radToDeg`/`RADIANS_TO_DEGREES` (`rendering/entities/shared/geometry-angle-utils.ts`).
- `normalizeDeg` → `normalizeAngleDiff` (signed (−π,π], ίδιο αρχείο· rad-domain).
- `headingDeg(a,b)` → `angleBetweenPointsDeg` (`utils/rotation-math.ts`).
- `boundsFromStairs` (inline `geometry.bbox`) → `calculateBimEntity2DBounds` (`bim/utils/bim-bounds.ts`, έχει `case 'stair'`).
- `metersToScene` + Y-flip → **νέα SSoT στο `export/core/tek/tek-geometry.ts`**: `metersToScene` + `tekMetersToScene`
  (αντίστροφα του export — ΕΝΑ σημείο μετατροπής/Y-flip για import ΚΑΙ export).
- **Boy-scout (προϋπάρχον διπλότυπο):** `median` ήταν local στο `bim-3d/performance/baseline-tracker.ts` →
  εξήχθη σε **νέα SSoT `utils/statistics.ts`**· ο baseline-tracker μεταφέρθηκε εκεί (μηδέν regression).

## Φάση 3b — Preserve-and-replay (byte-faithful round-trip, Giorgio-approved 2026-06-25)

Μετά από πολλούς κύκλους regeneration, διαπιστώθηκε ότι η pixel-perfect αναπαραγωγή των **ιδιόκτητων Tekton 2Δ συμβόλων** (περίγραμμα + κεντρικό σύμβολο + βέλος-με-τόξα + βεντάλια + 2 βέλη άνοδος/κάθοδος + διπλή διάταξη «Π») από single-flight BIM γεωμετρία είναι ασύμφορη/εύθραυστη. **Λύση (όπως τα CAD με proxy entities):**
- **Import:** το αυθεντικό `<stair><record>` XML αποθηκεύεται αυτούσιο → `TekStairRecord.rawXml` → `StairEntity.sourceTekRecord` (+ `StairDoc.sourceTekRecord` για επιβίωση στο Firestore· rules `hasAll`, όχι `hasOnly` → επιτρέπεται χωρίς deploy).
- **Export:** `collectTekStairs` — αν `sourceTekRecord` υπάρχει → εκπομπή **ΑΥΤΟΥΣΙΑ** (byte-faithful)· αλλιώς παραμετρικό build (Νέστωρ-native σκάλες).
- Αποτέλεσμα: σκάλα Τέκτονα → Νέστωρ → Τέκτων = **ΑΚΡΙΒΩΣ ίδια** (όλα τα σύμβολα), μετατρέπεται σε 3Δ.
- Όρια: ισχύει για **μη-τροποποιημένες** εισαγμένες σκάλες (αν ο χρήστης την επεξεργαστεί στον Νέστορα, το raw record μένει stale — μελλοντικά: invalidate on edit). Νέστωρ-native σκάλες → παραμετρικό export (αναγνωρίσιμο από Τέκτονα). 118 tek+stair jest GREEN.

## Changelog
- **2026-06-25** — Φάση 1: 6 modules + 3 test suites (18 jest GREEN). Real-file verify στο `ΣΚΑΛΑ.tek`: stepCount 17, totalRise 2900 mm, tread 274, width 800, winder 90°/3. + SSoT κεντρικοποίηση (5 διπλότυπα → SSoT + median SSoT). UNCOMMITTED.
- **2026-06-25** — Φάση 3 (EXPORT): `StairEntity` → `<stair>` type 21 στον tek exporter (`TekStair`/`TekStairPoint` types· `STAIR_RECORD_HEAD`/`TAIL` templates· `buildStairPoint2dXml`/`buildStairIntlistXml`/`buildStairRecordXml`· `collectTekStairs`/`toTekStair`· `TEK_STAIR_MARKER` + 7ο inject arg· skeleton marker). FAITHFUL (γεωμετρία από `StairGeometry`). SSoT boy-scout: νέα `sceneXYToTekMeters` (ΕΝΑ Y-flip· refactor `footprintRingToMeters`/`roofFaceRingToMeters`). `<steps>=stepCount−1`. Winders→ευθύγραμμα (Φ3b). Νέα `tek-stair-export.test.ts` + ενημερωμένα tek-export/adapter suites — GREEN (81 tek jest). 🔴 Τέκτων round-trip (Giorgio). UNCOMMITTED.
- **2026-06-25 (bugfix round-trip #1):** το 1ο export δεν άνοιγε στον Τέκτονα. Αιτία: `straightSegmentTypes` έβγαζε `κορυφές−1` (μοντέλο συνδεδεμένης πολυγραμμής)· ο Τέκτων όμως διαβάζει disjoint τμήματα (γραμμή=2 σημεία) → δηλώναμε 31 γραμμές για 32 σημεία = ζητούσε 62 → parser overrun. FIX: `segCount = κορυφές/2` (επιβεβ. ground-truth: 8 σημεία→intlist 4· 17→4 γραμμές+3 τόξα). + 6η intlist `0 0 0` (flag triple) ευθυγραμμίστηκε με το δείγμα. +regression test (point-count/segment-count invariant). 76 tek jest GREEN.
- **2026-06-25 (bugfix round-trip #5):** το #7 (3 γραμμές + sentinel) **δεν έδειχνε τίποτα** + dialog «ορατές οντότητες σε ακτίνα > 4m». Αιτία: το `3.4e+38` (FLT_MAX) που πρόσθεσα ως «sentinel» ο Τέκτων το διαβάζει ως **πραγματικό σημείο στα 3.4e38m** → η σκάλα γίνεται αόρατη κουκίδα (τα trailing points του δείγματος είναι junk που ο Τέκτων αγνοεί στο δικό του read — γι' αυτό το import τα φιλτράρει). FIX: **αφαίρεση sentinel** (καθαρές γραμμές) + προσθήκη ορατού **περιγράμματος** (slot 1 = δεξιά παρειά + βάση + αριστερή παρειά, 6 σημ., intlist `2 2 2`, όπως το δείγμα) ώστε να σχεδιάζεται 2Δ αποτύπωμα. 81 tek jest GREEN. 🔴 Τέκτων round-trip #6 (Giorgio).
- **2026-06-25 (ΑΝΑΔΟΜΗΣΗ round-trip #4 — ground-truth `ΜΟΝΟΝ_ΟΡΙΣΜΟΣ_ΣΚΑΛΑΣ`):** το #6 άνοιγε χωρίς crash/hang/infinity αλλά **δεν μετατρεπόταν σε 3Δ**. Ο Giorgio έδωσε αρχείο «σκάλα ορισμένη, έτοιμη για 3Δ» → πλήρης αποκωδικοποίηση: ο Τέκτων χτίζει τις βαθμίδες **μόνος του** από **3 γραμμές ανάβασης** (αριστερή παρειά / κεντρική πορεία / δεξιά παρειά = slots 4/5/6, ένας κόμβος ανά βαθμίδα + τερματικό sentinel `3.4e+38`=FLT_MAX) + τα scalars — **ΔΕΝ** θέλει γραμμές βαθμίδων. Εμείς δίναμε γραμμές βαθμίδων (slot 3) + λάθος slots 1/2/3 + intlists. ΑΝΑΔΟΜΗΣΗ: `TekStair` → `leftLine`/`centerLine`/`rightLine` (αντί arrow/stepLines/contours)· `buildStairRecordXml` = 3 κενά point2d + 7 ΚΕΝΕΣ intlist + 3 γραμμές ανάβασης + 2 κενά· νέα σταθερά `TEK_LINE_TERMINATOR`. (Οι intlists ίσχυαν μόνο για winder με τόξα — ευθεία = όλες κενές.) 81 tek jest GREEN. 🔴 Τέκτων round-trip #5 (Giorgio· hard-refresh/incognito).
- **2026-06-25 (bugfix round-trip #3):** μετά τα fixes #1+#2 (επιβεβ. ενεργά στο export — browser cache είχε κρατήσει παλιό bundle) ο Τέκτων **κολλούσε στο 3Δ build**. Αιτία: περίγραμμα/πορεία είχαν **2 σημεία** (μόνο άκρα), ενώ ο παραμετρικός 3Δ engine περιμένει **έναν κόμβο ανά βαθμίδα** (ground-truth: `stepCount` σημεία/πολυγραμμή). FIX: `densifyToStairPoints` (reuse SSoT `samplePolylineFrame`+`polylineLength`) → inner/outer/walkline πυκνώνονται σε `stepCount` ισαπέχοντα σημεία. +regression test. 82 tek jest GREEN. 🔴 Τέκτων round-trip #4 (Giorgio).
- **2026-06-25 (bugfix round-trip #2):** το αρχείο ΑΝΟΙΓΕΙ (✅ Giorgio) αλλά **δεν χτιζόταν 3Δ**. Αιτία: εξήγαμε `vert_b = p.rise` (παράμετρος)· ο 3Δ engine του Τέκτονα χτίζει με **ρίχτια = steps+1** και απαιτεί `ρίχτια × vert_b == end−start` ΑΚΡΙΒΩΣ — η στρογγυλοποίηση έδινε `17×0.175=2.975 ≠ 3.0` → no 3D (ground-truth ήταν exact: `17×0.17058823=2.9`). FIX: `vert_b = (end−start)/(steps+1)` = `totalRise/stepCount` (διατήρηση ύψους ορόφου, ίδια λογική με import). +regression test (3Δ consistency invariant). 16 stair jest GREEN. 🔴 Τέκτων round-trip #3 (Giorgio).
