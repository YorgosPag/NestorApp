# HANDOFF — Εξαγωγή σκαλών `<stair>` προς Τέκτονα (ADR-526 Φ3 / ADR-512)

**Ημερομηνία:** 2026-06-25
**Τι αναλαμβάνεις:** να κάνει η εφαρμογή μας **export σκαλών** σε αρχείο Τέκτονα (`.tek`). Σήμερα ο tek exporter
βγάζει τοίχους/κουφώματα/πλάκες/στέγες/γραμμές/τόξα — **ΟΧΙ σκάλες**. Είναι ο **αντίστροφος** του import που
μόλις ολοκληρώθηκε (ADR-526 Φ1+Φ2).
**Ποιότητα:** Revit-grade, **FULL ENTERPRISE + FULL SSOT**. ΠΡΙΝ γράψεις κώδικα → **πραγματικό SSoT audit (grep)**.

---

## 0. ΑΠΑΡΑΒΑΤΟΙ ΚΑΝΟΝΕΣ (διάβασέ τους ΠΡΩΤΑ)
- **Απαντάς ΕΛΛΗΝΙΚΑ** πάντα (CLAUDE.md language rule).
- **ΟΧΙ commit / ΟΧΙ push** — ο Giorgio κάνει commit, όχι εσύ (N.(-1)). Ετοίμασε, μην committάρεις.
- **Το working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** Άγγιξε ΜΟΝΟ τα αρχεία του export-σκάλας. Μην μαζέψεις/αλλάξεις
  άσχετα. Αν δεις uncommitted αλλαγές αλλού (π.χ. columns, ADR-524) **μην τις πειράξεις** — είναι άλλου.
- **N.17 — ΕΝΑ tsc τη φορά.** Πριν τρέξεις `tsc --noEmit`, έλεγξε ότι δεν τρέχει ήδη άλλος:
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*tsc*' }`.
  Αν τρέχει → περίμενε. Τρέξε στο παρασκήνιο, μη μπλοκάρεις.
- **ADR-driven (N.0.1):** Phase 1 recognition (grep ΚΩΔΙΚΑ, όχι μόνο ADR) → implement → ενημέρωσε ADR-526 changelog.
- **N.7.2 checklist + δήλωση Google-level στο τέλος.** Functions ≤40 γρ, files ≤500 γρ.

---

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ (ADR-526 Φ1+Φ2 — IMPORT, UNCOMMITTED)
Νέος φάκελος **`src/subapps/dxf-viewer/io/tek/`** (read-side, καθρέφτης του `export/core/tek/`):
- `tek-import-types.ts`, `tek-xml-reader.ts` (DOMParser), `tek-stair-extract.ts`, `tek-stair-to-bim.ts`,
  `tek-scene-builder.ts`, `tek-import.ts` + 3 test suites (**18 jest GREEN**, tsc clean, real-file verified).
- UI wiring: ribbon κουμπί «Εισαγωγή Τέκτονα», event `dxf:import-tek-requested`, branch στο
  `useSceneState.handleFileImport` (`isTekFileName`→`importTekFile`).
- **ADR:** `docs/centralized-systems/reference/adrs/ADR-526-tekton-tek-import-stairs.md` — **διάβασέ το ΟΛΟ**,
  έχει το πλήρως αποκωδικοποιημένο σχήμα `<stair>`.
- **Κεντρικοποίηση που έγινε (χρησιμοποίησέ την):** στο `export/core/tek/tek-geometry.ts` προστέθηκαν
  `metersToScene` + `tekMetersToScene` (inverse). Νέα SSoT `utils/statistics.ts` (`median`).

⚠️ Όλα UNCOMMITTED. Μην βασιστείς ότι έγιναν commit.

---

## 2. ΤΟ ΣΧΗΜΑ `<stair>` (entity type 21) — ΑΠΟΚΩΔΙΚΟΠΟΙΗΜΕΝΟ
Δείγμα ground-truth: **`C:\Users\user\Downloads\ΣΚΑΛΑ.tek.txt`** (γρ. **26618–26832**, FESPA 9.1.0.46).
Θέση στο δέντρο: `tekton > body > building > floor > stair > record`.
```
<record>
 <type>21</type><n>1</n><taglist/>
 <point2d>…<record><pX/><pY/></record>…</point2d>   ← ΠΟΛΛΑΠΛΑ: ακμές βαθμίδων + εσωτ./εξωτ.
 <point2d>…</point2d>                                   περίγραμμα + γραμμή πορείας (ΜΕΤΡΑ, Y-up)
 <intlist>…2 1 2 1…</intlist>                           ← τύπος τμήματος (1=τόξο/2=ευθεία)
 <start_elevation/><end_elevation/>   στάθμες (μέτρα)·   ύψος = end−start
 <steps/><landings/>                  πλήθος πατημάτων / πλατύσκαλων
 <stair_width/>                       καθαρό πλάτος (μέτρα)
 <horiz_b/>  ΠΑΤΗΜΑ (going, μέτρα)     <vert_b/>  ΡΙΧΤΙ (riser, μέτρα)   <slope_h/> μηρός (μέτρα)
 <min_step_width/>  (>0 ⇒ winders)    <wlength/>  <steps_numbering/>
 …χρώματα/πένες ανά συστατικό: horiz_c/vert_c/slope_c/sideL_c/handrailL_c/columnL_c (+ *_render_c, *_p)…
</record>
```
Τιμές δείγματος: start=0, end=2.9, steps=16, width=0.80, horiz_b≈0.2743, vert_b≈0.17059, slope_h=0.15.

**ΑΠΟΦΑΣΗ ΠΡΟΣΕΓΓΙΣΗΣ (Revit-grade = FAITHFUL):** σε αντίθεση με το import (που πήγε παραμετρικά), το EXPORT
πρέπει να βγάζει την **ΠΡΑΓΜΑΤΙΚΗ γεωμετρία** που έχουμε ήδη υπολογισμένη, ώστε ο Τέκτων να ζωγραφίσει ΑΚΡΙΒΩΣ
τη σκάλα μας — όχι lossy re-parametrization. Πηγή = το `StairGeometry` (treads/risers/walkline/bbox).

---

## 3. SSoT ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΧΡΗΣΙΜΟΠΟΙΗΣΕΙΣ (grep & reuse — ΜΗΝ ξαναγράψεις)
**Export pipeline (mirror αυτό ΑΚΡΙΒΩΣ):**
- `export/core/tek/bim-to-tek.ts` — collectors: `collectTekWalls` / `collectTekPlanes` / `collectTekRoofs`
  (mirror → **`collectTekStairs`**). Χρησιμοποιεί `sceneUnitsToMeters` + `footprintRingToMeters`.
- `export/core/tek/tek-xml-writer.ts` — builders: `buildWallRecordXml` (γρ.60), `buildPlaneRecordXml` (γρ.97),
  `buildAutoroofRecordXml` (γρ.144) (mirror → **`buildStairRecordXml`** + `buildPoint2dListXml`).
- `export/core/tek/tek-types.ts` — `TekWall`/`TekPlane`/`TekRoof` types (mirror → **`TekStair`**).
- `export/formats/tek-export-adapter.ts` — `assembleTekDocument` (γρ.39) καλεί τους collectors και
  `injectTekEntities(template, wallsXml, '', planesXml, autoroofsXml, linesXml, arcsXml)` (γρ.54). Πρόσθεσε
  `stairsXml` ΕΔΩ (+ στο `injectTekEntities`, βρες πού μπαίνει μέσα στο `<floor>` του skeleton).
- `export/core/tek/tek-skeleton.template.ts` — έχει ήδη `bp_staircase->*` defaults (header). Βρες το anchor
  μέσα στο `<floor>` όπου εγχέονται τα records.

**Γεωμετρία/μονάδες (forward, ΗΔΗ υπάρχουν — SSoT):**
- `export/core/tek/tek-geometry.ts`: `sceneUnitsToMeters`, `mmToMeters`, `footprintRingToMeters`
  (scene→μέτρα **+ Y-flip** `−v.y` ΗΔΗ μέσα). Το Y-flip SSoT είναι ΕΔΩ — μην το ξαναγράψεις.
- **ΜΗΝ φτιάξεις** δικά σου `RAD_TO_DEG`/`normalizeDeg`/`median`/bounds — υπάρχουν:
  `rendering/entities/shared/geometry-angle-utils.ts` (`radToDeg`/`normalizeAngleDiff`/`degToRad`),
  `utils/rotation-math.ts` (`angleBetweenPointsDeg`), `utils/statistics.ts` (`median`),
  `bim/utils/bim-bounds.ts` (`calculateBimEntity2DBounds`, έχει `case 'stair'`).

**Πηγή δεδομένων σκάλας:**
- `bim/types/stair-types.ts` — `StairEntity`, `StairParams` (tread/rise/width/totalRise/stepCount/waistThickness),
  **`StairGeometry`** (`treads: Polygon3D[]`, `risers: Segment3D[]`, `walkline: Polyline3D`, `bbox`, …).
- `bim/geometry/stairs/StairGeometryService.ts` — `computeStairGeometry(params)` (αν χρειαστείς recompute).
- Type guard: `isStairEntity` / `e.type === 'stair'`.

---

## 4. ΣΧΕΔΙΟ ΥΛΟΠΟΙΗΣΗΣ (πρόταση — επικύρωσέ το με grep πρώτα)
1. **SSoT AUDIT (grep)** για καθένα από: stair→tek mapping, point2d serialization, scene→meters, Y-flip,
   γωνίες, bounds. Επιβεβαίωσε ότι κανένα δεν υπάρχει ήδη αλλού πριν γράψεις.
2. `tek-types.ts`: `TekStair` (scalars + οι point2d πολυγραμμές σε μέτρα).
3. `bim-to-tek.ts`: `collectTekStairs(entities)` → για κάθε `StairEntity`: scalars από `params`
   (tread→horiz_b, rise→vert_b, width→stair_width, totalRise→end_elevation, waist→slope_h, stepCount→steps),
   polylines από `geometry` (treads outline + walkline) → μέτρα μέσω `footprintRingToMeters`/`sceneUnitsToMeters`.
4. `tek-xml-writer.ts`: `buildStairRecordXml(s: TekStair)` + helper `buildPoint2dListXml(points)`.
   Σταθερά πεδία (χρώματα/πένες/type 21) από το δείγμα.
5. `tek-export-adapter.ts`: κάλεσε `collectTekStairs`, πέρασε `stairsXml` στο `injectTekEntities`,
   έγχυσε μέσα στο `<floor>`.
6. **Tests** (mirror `tek-export.test.ts` / `dxf-to-tek.test.ts`): assemble με fake template, assert
   `<type>21`, scalars, point2d counts. + tsc (N.17).
7. Ενημέρωσε **ADR-526 §Φ3** + ADR-512 (αν προστεθεί stair στο export scope).
8. **Browser/Τέκτων verify** = ο Giorgio (re-import στον Τέκτονα). Δήλωσέ το ως 🔴 εκκρεμές.

**Validation:** το round-trip είναι ο τελικός έλεγχος — export από εμάς → άνοιγμα στον Τέκτονα → ίδια σκάλα.
Έχεις το δείγμα `ΣΚΑΛΑ.tek.txt` ως ground-truth για να συγκρίνεις το XML που παράγεις.

---

## 5. ΑΝΟΙΧΤΑ ΣΗΜΕΙΑ ΑΠΟΦΑΣΗΣ (ρώτα τον Giorgio αν χρειαστεί)
- **Ποιες πολυγραμμές** βγάζουμε: μόνο περίγραμμα+walkline (ελαφρύ) ή και κάθε tread ξεχωριστά (πιστό);
  Ξεκίνα με περίγραμμα+walkline+steps, δες το round-trip, πύκνωσε αν χρειαστεί.
- **intlist** (τόξα vs ευθείες): για ευθείες σκάλες όλα «2». Για winders/καμπύλες θέλει mapping — DEFER αν δύσκολο.
- **Multi-floor:** ο adapter σήμερα δουλεύει στον ενεργό όροφο. Κράτα το ίδιο scope.

---

## 6. QUICK COMMANDS
- Tests: `npx jest src/subapps/dxf-viewer/export/core/tek --silent`
- tsc (αφού ελέγξεις N.17): `npx tsc --noEmit -p tsconfig.json` (background)
- Δείγμα: `C:\Users\user\Downloads\ΣΚΑΛΑ.tek.txt` (stair @ γρ. 26618–26832)
