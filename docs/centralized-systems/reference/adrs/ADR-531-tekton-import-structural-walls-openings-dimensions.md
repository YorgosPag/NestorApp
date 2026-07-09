# ADR-531 — Tekton .TEK import Φ5b: 3Δ τοίχοι, κουφώματα & διαστάσεις

**Status:** ✅ APPROVED (Φ5b.1 υλοποιημένο, browser-verify pending· Φ5b.2 επόμενη φάση)
**Date:** 2026-06-25
**Domains:** io/tek (extract + 2Δ map)
**Related:** ADR-526 (Tekton import Φ1–Φ5a: σκάλες + 2Δ primitives), ADR-363 (BIM wall/opening),
ADR-362 (dimensions). **Δεν** επεκτείνει το ADR-526 (uncommitted, άλλου agent) — ξεχωριστό ADR.

---

## 1. Context / Problem

Ο `.tek` importer (ADR-526 Φ5a) έφερνε **μόνο** 2Δ primitives (`<line>`/`<arc>`/`<text>`) + σκάλες.
Το αρχείο `Ισόγειο 312.tek.txt` (και κάθε αρχιτεκτονικό Tekton) περιέχει επιπλέον, ανά όροφο,
containers που **σιωπηρά παραλείπονταν**: `<dim>` (διάσταση), `<wall>` (3Δ τοίχος) και
`<wall><open>` (κουφώματα). Ο σχολιασμός `tek-scene-extract.ts` το προέβλεπε ρητά («Φ5b:
walls/openings/slabs/roofs»). Δεν ήταν bug — ήταν μη-υλοποιημένη φάση.

## 2. Decision (φασικό)

- **Φ5b.1 (ΤΟ ΠΑΡΟΝ) — 2Δ primitives.** Γρήγορο, ορατό, χαμηλού ρίσκου: τοίχος/κούφωμα/διάσταση
  → γραμμές + κείμενο στην κάτοψη. Browser-verify πρώτα.
- **Φ5b.2 (ΕΠΟΜΕΝΟ) — πλήρη BIM entities.** Τοίχος → `createWall`, κουφώματα → `createOpening`
  (hosted), διάσταση → `DimensionEntity`. Οι extractors (Βήμα 1) είναι **κοινοί** — αλλάζει μόνο
  ο mapper.

## 3. Πραγματικό schema (από το αρχείο — επαληθευμένο, ΟΧΙ μάντεμα)

- **`<dim><record>` (type 0):** η γεωμετρία ζει στις **`<seg>`** πατιές (`end0/end1` = άκρα γραμμής,
  `gap0/gap1` = κενό κειμένου, `<s>` = τιμή «2.10», `<xmatrix>` = θέση κειμένου). `<size>` = ύψος
  κειμένου (0.159m). Μετρούμενο μήκος = |p1−p0| = 2.10m.
- **`<wall><record>` (type 1) — MATRIX-PLACED:** start = (x20,x21), u-άξονας = (x00,x01) → end,
  μήκος |u| ≈ 5.03m, v-άξονας = (x10,x11) = πάχος band. `<height>`, `<inner_width>`.
- **`<wall><open><record>` ×N (type 2):** `<xmatrix>` x00 = πλάτος (1.4m), pos = (x20,x21),
  `<elevation>` = περβάζι, `<top>` = ανώφλι.

## 4. Architecture (Φ5b.1)

**ΝΕΑ αρχεία** (μηδέν λογική στα κοινά Φ5a αρχεία — collision-safe):
- **`io/tek/tek-structural-extract.ts`** — `extractDimRecords`, `extractWallRecords` (+ nested
  openings). Reuse `recordsInFloors`/`isEntityType`/`readXMatrix` (έγιναν `export` στο
  `tek-primitive-extract.ts`) + τους DOM helpers του `tek-xml-reader`. Μηδέν διπλό traversal.
- **`io/tek/tek-structural-to-scene.ts`** — 2Δ mappers:
  - `tekWallToEntities` → footprint = unit-square `[0,1]²` μέσω `<xmatrix>` (4 γραμμές) + ανά
    κούφωμα: γραμμή πλάτους + 2 κάθετες λαβές (jambs) στο πάχος τοίχου.
  - `tekDimToEntities` → οι `<seg>` γραμμές (με κενό) + κείμενο τιμής (replay, μηδέν geometry math).
  - Μονάδες/Y-flip/χρώμα μέσω των ΙΔΙΩΝ SSoT με τα line/arc (`tekMetersToScene`, `colorHex6`).

**Additive-only** (κοινά Φ5a αρχεία — μόνο imports + spread):
- `tek-import-types.ts` — `TekDimRecord`/`TekDimSeg`/`TekWallRecord`/`TekOpeningRecord` + extend
  `TekSceneParseResult` (`dims`, `walls`).
- `tek-scene-extract.ts` — 2 extractor calls + 2 spreads + warnings.
- `tek-scene-builder.ts` — `parsed.walls.flatMap(tekWallToEntities)` + `parsed.dims.flatMap(...)`.
- `tek-import.ts` — stats `dimCount`/`wallCount`/`openingCount`.

## 5. Tests
- `tek-structural-extract.test.ts` (5) — dim seg + wall fields + 2 openings + bad-type warning.
- `tek-structural-to-scene.test.ts` (4) — counts (4+6 wall, 2+1 dim), footprint span ~5m, χρώμα.
- `tek-import.test.ts` (+1) — end-to-end counts (dim 1 / wall 1 / openings 2 → 12 lines + 1 text).
- 16 tests GREEN. `tsc --noEmit` background (N.17).

## 6. Φ5b.1+ — Faithful symbol replay (ΑΠΟΦΑΣΗ Giorgio: «ακριβώς όπως ο Τέκτονας, χωρίς αλλαγές μετά»)

Browser-verify του Φ5b.1 (export round-trip) έδειξε ότι οι **ωμές γραμμές δεν αρκούν**: παράθυρα ως
απλά ορθογώνια, γραμμές κουφωμάτων **προεξέχουν** από την παρειά, διάσταση χωρίς βελάκια/κείμενο.
Ο Giorgio επέλεξε **faithful γεωμετρικό σύμβολο** (ΟΧΙ BIM — το BIM αναβάλλεται). Και τα 2 κουφώματα
= **παράθυρα με ποδιά 1μ**.

**Υλοποίηση (όλα σε δικά μου Φ5b.1 αρχεία — μηδέν collision):**
- **NEW pure `tek-window-symbol.ts`** — `openingAxisInterval` (προβολή ανοίγματος στον άξονα),
  `buildWallCutoutSegments` (παρειές κομμένες στα ανοίγματα + jamb returns + caps), `buildWindowSymbolSegments`
  (υαλοπίνακας κεντραρισμένος). **Διορθώνει το «προεξέχει»** (πραγματικά κενά).
- **NEW pure `tek-dimension-symbol.ts`** — γραμμή (seg, με κενό) + βοηθητικές (από `<inter>` refPoints)
  + πλάγιες παύλες 45° (`end_style` 8) + κείμενο τιμής. Χρωματικές ομάδες (γραμμές=χρώμα διάστασης,
  ticks=«μπορντώ»).
- **Rewrite `tek-structural-to-scene.ts`** — καλεί τα 2 symbol modules, χρωματισμός ανά ομάδα.
- **Extend types + extractor** — window (`side/frame_width/frame_thickness/jamb_width/jamb_thickness/
  ledge_height`), dimension (`end_style`, `<inter>` refPoints).
- Tests: `tek-window-symbol.test.ts` + `tek-dimension-symbol.test.ts` + updated suites. **26 jest GREEN.**

**Calibration (browser, αναμένονται 1–2 γύροι):** ακριβής σχεδιαστική σύμβαση υαλοπίνακα/πλαισίου ανά
`style`/`side`· χρώμα/μήκος tick διάστασης· πάχος band (v-scale 0.25 vs inner_width 0.09).

## 7. Scope / Follow-up
- **BIM (αναβλήθηκε):** `createWall`/`createOpening`/`DimensionEntity` — μόνο αν ζητηθεί ρητά
  (ο Giorgio προτίμησε faithful replay τώρα).
- Slabs/roofs Tekton → μελλοντικά.

## 6b. Φ5b.1++ — Calibration συμβόλου (data-driven, target screenshots `221240`/`221306`)

Browser-verify πρώτου γύρου + zoomed στιγμιότυπα του **πρωτότυπου Τέκτονα** (`Ισόγειο 312.tek`)
αποκάλυψαν τη σωστή σχεδιαστική σύμβαση. **Απόφαση Giorgio: Δρόμος Α (faithful), ΟΧΙ BIM** —
calibration των ίδιων pure modules (μηδέν νέα αρχεία):

- **Κείμενο διάστασης = κίτρινο.** Το `<dim>` έχει **ξεχωριστό** `<dtext_color>` (π.χ. `FFFF80`)
  για το κείμενο, ανεξάρτητο από το `<color>` (πράσινο) της γραμμής. Νέο πεδίο `TekDimRecord.dtextColor`
  (extractor) → ο mapper χρωματίζει το κείμενο με `dtext_color` (fallback στο `color`).
- **End markers = βελάκια, ΟΧΙ 45° παύλες.** `end_style=8` → ανοιχτό arrowhead (2 πτερύγια) προς τα
  έξω + κάθετη extension παύλα ανά άκρο (`arrowHead`+`perpTick` αντικαθιστούν το `obliqueTick`).
  Tunable: `ARROW_LEN_FACTOR`, `ARROW_HALF_ANGLE_RAD`, `EXT_TICK_LEN_FACTOR`.
- **Χρώμα βέλους:** `DIM_ARROW_COLOR_OVERRIDE` (default `null` → χρώμα γραμμής, faithful στο data·
  το target δείχνει κοκκινωπά άκρα — αλλάζει με ένα string αν χρειαστεί στο browser-verify).
- **Σύμβολο παραθύρου:** πλαίσιο (2 ράγες inset κατά `frame_thickness` + 2 caps) + διπλός υαλοπίνακας
  (2 κεντρικές γραμμές) + **κεντρικό μπινί (mullion)** — αντί 2 απλών γραμμών. Tunable:
  `FRAME_RAIL_FALLBACK_FRAC`, `GLASS_HALF_SEP_FRAC`.
- **Επιβεβαιωμένα από το data (όχι μάντεμα):** v-band τοίχου = 0.25m (σωστό), **και τα 2 ανοίγματα
  = παράθυρα** (`elevation=1` ποδιά 1μ, `top=2.2` — όχι πόρτα· το «τόξο» στα στιγμιότυπα = η σκάλα).
- **Εκκρεμεί calibration (browser-verify Giorgio):** italic κειμένου (αν το `TextEntity` το
  υποστηρίζει), ακριβές μοτίβο frame ανά `side` (μονόπλευρο 0.15 ζώνη vs συμμετρικό).

## 6c. Φ5b.1+++ — DXF ground-truth calibration (`Ισόγειο 312.dxf.txt`)

Ο Giorgio έδωσε το **ίδιο σχέδιο σε DXF** (Tekton explode → raw LINE/ARC/TEXT) = το ΑΚΡΙΒΕΣ
ground truth. Αποκωδικοποίηση επιβεβαίωσε/διόρθωσε:

- **Διάσταση = 3 ξεχωριστά χρώματα (layers):** γραμμή `COLOR_2` (πράσινο), κείμενο `COLOR_20`
  (κίτρινο `dtext_color`), **βέλη+witness `COLOR_241` (μπορντώ)**. → `DIM_ARROW_COLOR='#800000'`
  (η προηγούμενη «arrow=χρώμα γραμμής» ήταν λάθος).
- **Βέλος = κλειστό τρίγωνο** (3 γραμμές: 2 πτερύγια + βάση), μήκος ≈ ύψος κειμένου (0.12m/0.119m),
  ημιγωνία ~12° (0.025/0.12). `ARROW_LEN_FACTOR=1.0`, `ARROW_HALF_ANGLE_RAD=0.206`.
- **🔴 Άνοιγμα #1 = ΠΟΡΤΑ, #2 = ΠΑΡΑΘΥΡΟ** (διαχωρισμός ανά `style`: 1=πόρτα, 0=παράθυρο). Το DXF
  δείχνει για το #1 **ARC** (κέντρο=αρμός, ακτίνα=πλάτος−2·jamb=1.3, ~88°) + φύλλο. **Νέο
  `buildDoorSymbolSegments`** (φύλλο + τεταρτοκυκλικό τόξο ως polyline, slanted-safe via û/n̂):
  μεντεσές t=tmin+jamb/|u|, f=`frame_width`/πάχος· **DXF-validated** η κλειστή θέση πέφτει ΑΚΡΙΒΩΣ
  στον δεύτερο αρμό. Απόφαση Giorgio: faithful (πόρτα+παράθυρο), ΟΧΙ «και τα δύο παράθυρα».
- **Calibration flag:** πλευρά μεντεσέ/φορά ανοίγματος ανά `side` (εδώ side=3) — άλλες τιμές
  μπορεί να χρειαστούν mirror (hinge στο tmax ή φύλλο προς −n̂).

## Changelog
- **2026-06-25** — Φ5b.1: extract `<dim>`/`<wall>`/`<open>` + 2Δ mappers. 16 jest.
- **2026-06-25** — Φ5b.1+: faithful symbol replay (wall-cutouts + window glass + dimension arrows/witness/
  text). 2 νέα pure modules + extended types/extractor + rewritten mapper. 26 jest. BIM αναβλήθηκε.
- **2026-06-25** — Φ5b.1++: data-driven calibration (Δρόμος Α confirmed). `<dtext_color>` κίτρινο κείμενο,
  end_style=8 → βελάκια+extension (όχι 45°), σύμβολο παραθύρου με πλαίσιο+μπινί. Tunable constants για
  browser-verify. **52 jest GREEN** (io/tek). Μηδέν νέα αρχεία — calibration των Φ5b.1+ modules.
- **2026-06-25** — Φ5b.1+++: **DXF ground-truth calibration** (`Ισόγειο 312.dxf.txt`). 3 χρώματα διάστασης
  (γραμμή πράσινη / κείμενο κίτρινο / βέλη μπορντώ `COLOR_241`), βέλος = κλειστό τρίγωνο (DXF αναλογίες).
  **Άνοιγμα #1=πόρτα (νέο `buildDoorSymbolSegments` τόξο, DXF-validated) / #2=παράθυρο** — διαχωρισμός
  ανά `style` (`isDoorStyle`). Απόφαση Giorgio: faithful πόρτα+παράθυρο. **56 jest GREEN** (io/tek).
- **2026-07-09** — **ADR-608: `<dim>` → native `DimensionEntity` (ενιαίος οργανισμός, όχι exploded
  primitives)** (Opus, Giorgio browser: «στον Τέκτονα οι διαστάσεις μετακινούνται σαν ένας οργανισμός·
  σε εμάς εισάγονται σαν μεμονωμένες οντότητες»). **Root cause:** το `<dim>` διαβαζόταν σωστά
  (`extractDimRecords` → `TekDimRecord`), αλλά το `tekDimToEntities` το **εκρήγνυε** σε dumb
  `LineEntity`+`TextEntity` → χάνονταν associativity/style/grips (μεμονωμένες γραμμές/κείμενα).
  **Fix:** νέος SSoT mapper `tek-dim-to-dimension.ts` `tekDimToDimensionEntities` → κάθε `<seg>` = ΕΝΑ
  native `LinearDimensionEntity` (`defPoints` από end0/end1 ή `<inter>` refPoints· `rotation` από την
  κατεύθυνση γραμμής· styleId = ενεργό dim style· overrides χρωμάτων truecolor+ACI: πράσινη γραμμή/ext
  `<color>`, κίτρινο κείμενο `<dtext_color>`). Ο δικός μας `buildDimensionGeometry` (SSoT) κάνει **δωρεάν**
  το gap (πράσινη γραμμή σπάει πριν τα σύμβολα) + κεντράρισμα κειμένου στον άξονα — τα 2 παρατηρήματα
  Giorgio. **×scale caveat:** τα end0/end1 είναι paper-scaled (μήκος 2.6) ενώ η ετικέτα δείχνει το
  πραγματικό (5.20) → το έτοιμο `<s>` string μπαίνει ως `userText` override (preserve-and-replay, όχι
  re-measured). **Dead-code sweep same-commit:** αφαιρέθηκαν `tekDimToEntities` + `tek-dimension-symbol.ts`
  (+test) — μηδέν διπλό dimension mapping (SSoT). scene-builder swap σε `tekDimToDimensionEntities`. Tests:
  νέο `tek-dim-to-dimension.test.ts` (6) + ενημέρωση structural/import integration· **82/82 GREEN** (io/tek)·
  jscpd:diff clean. ⏳ Εκκρεμεί browser-verify Giorgio (import → διάσταση ως ενιαίος οργανισμός).
- **2026-07-09** — **ADR-608: Τέκτων-parity χρωμάτων/βελών διάστασης (4 ξεχωριστά χρώματα + τύπος άκρου)**
  (Opus, Giorgio: «η εισαγόμενη διάσταση να είναι πανομοιότυπη με τον Τέκτονα»). Το `<dim><record>` κρατά
  **4 ΞΕΧΩΡΙΣΤΑ** χρώματα (panel «Εμφάνιση», ground-truth από `DIASTASI.tek`): γραμμή `<color>` (πράσινη
  `00FF00`), κείμενο `<dtext_color>` (κίτρινο `FFFF80`) — ήδη σωστά· **βέλη/άκρα `<ends_color>` (μπορντώ
  `A40050`)** + **οδηγοί/witness `<drv_color>` (μπλε `809CFC`)** — έλειπαν (τα witness έβγαιναν πράσινα =
  line color, τα βέλη πράσινα). **Fix (SSoT audit πρώτα, μηδέν διπλότυπα):** `TekDimRecord` +`endsColor`/
  `drvColor` (direct children του record, μετά τα `<seg>`/`<inter>`)· `extractDimRecords` διαβάζει
  `ends_color`/`drv_color`· `dimOverrides` χαρτογραφεί → `arrowColor`/`arrowTrueColor` = ends (μπορντώ),
  `dimclre`/`dimclreTrueColor` = drv (μπλε, όχι πια line color). **Τύπος άκρου:** `end_style=8` = «Βέλος 2»
  (τριγωνικό γεμάτο, panel-verified) → `dimblk='closedFilled'` μέσω named map `TEK_END_STYLE_ARROW_BLOCK`
  (μόνο verified τιμές· άγνωστο style → κληρονομεί το ενεργό DimStyle, μηδέν μαντεψιά). Reuse hex→χρώμα SSoT
  (`tekColorToHex`/`hexToAci`/`hexToTrueColor`) + arrowhead block SSoT (`ARROWHEAD_BLOCKS`). Ο renderer
  τα τιμά ήδη (γρ.183 witness `dimclreTrueColor`, γρ.259-262 arrows `arrowTrueColor` truecolor-wins). **84/84
  GREEN** (io/tek, +2 mapper tests) · jscpd:diff clean.
- **2026-07-09** — **ADR-608: μέγεθος βέλους από GROUND-TRUTH explode** (Giorgio: εξήγαγε τα βέλη σε
  `DIASTASI-ΒΕΛΗ.dxf` — στην πραγματικότητα Tekton XML με το «Βέλος 2» σπασμένο σε `<line>` primitives).
  **Μέτρηση:** κάθε τρίγωνο βέλους = **μήκος 0.12m** (κατά τον άξονα) × **πλάτος βάσης 0.05m**. Κρίσιμο:
  το `arrow_len` (λ=0.3) **ΔΕΝ** είναι μήκος-σε-μέτρα — το σχεδιασμένο μήκος = **0.4 × λ** (0.3→0.12).
  Η προηγούμενη υπόθεση (arrow_len=μέτρα) ήταν λάθος· η μέτρηση τη διόρθωσε → το Τέκτων-βέλος είναι
  **μικρότερο** (1.89mm) από το style default (2.5mm), όχι μεγαλύτερο. **Fix (scale-independent):** νέο
  `arrowLenM` (extractor `arrow_len`) + `resolveArrowSizeMm` → κρατά την ΑΝΑΛΟΓΙΑ σχεδιασμένου-βέλους-
  προς-ύψος-κειμένου (`0.4·arrowLenM / textSizeM`) και την εφαρμόζει στο ενεργό `dimtxt` (text & arrow
  περνούν από το ΙΔΙΟ dimscale/pxPerMm → αρκεί η αναλογία)· clamp [1,8]mm ώστε να μη βγει τεράστιο/
  μικροσκοπικό. `dimasz` override στον mapper. Named consts `TEK_ARROW_DRAWN_PER_MARK=0.4`. **85/85 GREEN**
  (io/tek, +1 dimasz test) · jscpd:diff clean. ⏳ Εκκρεμή: (α) browser-verify Giorgio (μπορντώ βέλη / μπλε
  οδηγοί / μέγεθος)· (β) πλάτος βέλους — το SSoT `closedFilled` έχει half-width 0.15 vs Τέκτων 0.21 (κοινό
  block, δεν πειράχτηκε)· (γ) πορτοκαλί ομοαξωνική γραμμή στην κορυφή βέλους — κανένα πεδίο στο record.
- **2026-07-09** — **ADR-608: μέγεθος βέλους → ΡΗΤΗ browser-βαθμονόμηση (step-by-step, Giorgio)** — το
  proportional (αναλογία βέλους/κειμένου) έβγαζε λάθος μέγεθος στη δοκιμή. Νέα προσέγγιση: ο Giorgio δίνει
  ρητές διαστάσεις & βαθμονομούμε. **Βήμα 1:** η κάθετη γραμμή/βάση του «Βέλος 2» = **0.050m** (drawing units,
  ταιριάζει τη ground-truth μέτρηση). Formula: ο renderer σχεδιάζει base = `0.3 × dimasz × dimscale × mmToScene`
  (`closedFilled` half-width 0.15→ratio 0.3· dimscale=`DEFAULT_DRAWING_SCALE` 100· scene=mm) → `dimasz =
  base_mm/(0.3×100) = 1.667mm`. Named consts `TEK_ARROW_BASE_M=0.05`/`ARROW_BASE_RATIO=0.3`/`TEK_RENDER_DIMSCALE=100`
  — ο συντ. βαθμονόμησης απορροφά απόκλιση κλίμακας (νέα μέτρηση Giorgio → αλλάζω ΜΟΝΟ το `TEK_ARROW_BASE_M`).
  Αφαιρέθηκε το proportional `resolveArrowSizeMm(rec,dimtxt)`. **85/85 GREEN** · jscpd clean. ⚠️ `closedFilled`
  δένει base↔length (ratio 0.3): αν ο Giorgio ζητήσει ανεξάρτητο μήκος → Tekton-specific arrowhead block (επόμενο).
- **2026-07-09** — **ADR-608: custom `tektonArrow2` arrowhead block (base 0.050 + μήκος 0.120 ανεξάρτητα)**.
  Ο Giorgio επιβεβαίωσε base 0.050m (η κάθετη γραμμή) και όρισε **μήκος** (μέσο βάσης→κορυφή, όπου συγκλίνουν
  οι πλάγιες) = **0.120m**. Το `closedFilled` (half-width 0.15, base:length σταθερό 0.3) ΔΕΝ μπορεί και τα δύο →
  νέο block `tektonArrow2` στο SSoT `dim-arrowhead-blocks.ts` με `TEKTON_ARROW2_HALF_WIDTH = 0.025/0.120 ≈ 0.208`
  (γεμάτο τρίγωνο, Τέκτων αναλογία). `end_style=8`→`tektonArrow2`. `dimasz` οδηγεί πλέον το ΜΗΚΟΣ (block length
  = 1 unit): `dimasz = 0.120·1000/100 = 1.2mm` (`TEK_ARROW_LENGTH_M`). Η βάση 0.050 προκύπτει από το half-width
  του block × dimasz. Νέα μέτρηση → `TEK_ARROW_LENGTH_M` (μήκος) ή `TEKTON_ARROW2_HALF_WIDTH` (βάση). Επίσης:
  ο Giorgio διέγνωσε ×2 στο δικό του σχέδιο Τέκτονα (γεωμετρία μισή της ετικέτας)· διορθώθηκε με restart Τέκτονα
  (δεν ήταν δικό μας bug· το βέλος μετρήθηκε από ωμές συντεταγμένες, ανεπηρέαστο). **Tests: dimasz 1.2 + block
  half-width 0.208 (no silent fallback)· 595/595 GREEN** (dimensions+io/tek) · jscpd clean.
- **2026-07-09** — **ADR-608: annotation scale (κείμενο+βέλη «σαν Τέκτονας»)**. Giorgio: μετρημένα σωστά (βέλος
  0.050/0.120, δim 2.00) αλλά **μικροσκοπικά** στον καμβά. Root: οι διαστάσεις σχεδιάζονται σε ΠΡΑΓΜΑΤΙΚΟ μέγεθος
  (model-space) → μικρές σε προβολή κτιρίου (ο Τέκτων κλιμακώνει σημάνσεις). Απόφαση Giorgio (AskUserQuestion):
  «annotation scale, ρυθμιζόμενος συντελεστής, το βέλος μεγαλώνει». Fix: override `dimscale = TEK_RENDER_DIMSCALE
  × TEK_DIM_ANNOTATION_MAG` (100×3=300) → κλιμακώνει ΟΜΟΙΟΜΟΡΦΑ κείμενο+βέλος+κενά+προεκτάσεις (γνήσιο annotation
  scale, `resolveEffectiveDimscale` παίρνει το >1 override, αγνοεί το global drawingScale). Όλες οι αναλογίες
  (base:length, text:arrow) ανέπαφες. `TEK_DIM_ANNOTATION_MAG=3` = starting guess· browser-βαθμονομείται (νέα
  προτίμηση Giorgio → άλλαξε ΜΟΝΟ το MAG). **Tests: dimscale 300· 10/10 mapper GREEN** · jscpd clean.
- **2026-07-09** — **ADR-608: mirror βέλους Τέκτονα** (Giorgio screenshot: «τα βέλη είναι εκτός των 2 μέτρων»).
  Τα μπορντώ βέλη είχαν το ΣΩΜΑ (βάση) εκτός του μήκους διάστασης (μύτη προς κέντρο). Fix: mirror ΜΟΝΟ το
  `tektonArrow2` block (base `[-1,±hw]`→`[+1,±hw]`, apex/tip παραμένει στο [0,0]) → σώμα ΜΕΣΑ στο μήκος, μύτη
  έξω (στάνταρ). Targeted (το block είναι Tekton-only)· μηδέν αλλαγή σε χρώματα/κείμενο/witness/γραμμή/μέγεθος/
  γεωμετρία. Test κλειδώνει `v2[0]=1`. **19/19 GREEN** (mapper+arrowhead-pair) · jscpd clean.
- **2026-07-09** — **ADR-608: βέλος Τέκτονα outline-only** (Giorgio: «όχι γεμάτα/συμπαγές μπορντώ, μόνο περίγραμμα»).
  `tektonArrow2` `solid: true`→`false` (triangle + block flag) → ο renderer κάνει `stroke` αντί `fill`. Μόνο αυτό·
  μηδέν άλλη αλλαγή. Test κλειδώνει `solid=false`. **27/27 GREEN** (mapper+arrowhead+block-primitives) · jscpd clean.
- **2026-07-09** — **ADR-608: 2 επιπλέον γραμμές στο «Βέλος 2»** (Giorgio Tekton screenshot). Σε unit space
  (1 unit = μήκος 0.120m → κλιμακώνονται αναλογικά): (α) κάθετη παύλα στη ΜΥΤΗ 0.16m (`TIP_TICK_HALF=0.16/0.12/2`,
  centered· line `[0,∓h]`), (β) οριζόντια ομοαξονική 0.30m από μύτη→κέντρο (`LEADER_LEN=0.30/0.12=2.5`· line
  `[0,0]→[+2.5,0]`, +X=εσωτερικά μετά το mirror). Named consts + `TEKTON_ARROW2_LEN_M` SSoT. Κληρονομούν το
  μπορντώ χρώμα του βέλους (arrowhead single-color). Test κλειδώνει geometry length 3 + tick/leader coords.
  **27/27 GREEN** · jscpd clean.
- **2026-07-09** — **ADR-608: κεντρική γραμμή διάστασης ξεκινά/τελειώνει στα leader ends** (Giorgio). Νέα
  προαιρετική ιδιότητα block `dimLineInset` (unit space) — το `tektonArrow2` την ορίζει = `LEADER_LEN` (2.5).
  `DimensionRenderer` (linear): pure helper `insetDimLineSegments` τραβάει τη dim line προς μέσα κατά
  `blockInset × paperHeightToModel(dimasz,dimscale,units)` σε κάθε anchor (world units, ίδια κλίμακα με τον
  leader → ευθυγραμμίζονται) — clamp προβολής στον άξονα σε `[inset1, length−inset2]`, διατηρεί το κενό
  κειμένου (2 segments), drop όταν leaders καλύπτουν όλο το μήκος. Standard blocks (`dimLineInset` απόν) → 0,
  αμετάβλητα. Targeted (μόνο Tekton dims). **48/48 GREEN** (mapper+DimensionRenderer+arrowhead· 4 νέα inset
  unit tests + block property) · jscpd clean · DimensionRenderer 491 γρ (<500).
- **2026-07-09** — **ADR-608: leader arrows χωρίς outside-stubs / πάντα inset κεντρική** (Giorgio: «η κεντρική
  γραμμή βγαίνει έξω από τις μύτες»). Root: με MAG×3, βέλη+κείμενο δεν χωράνε σε δim 2m → `resolveTextFit`
  `arrowsOutside=true` → `drawOutsideStubs` ζωγράφιζε γραμμές ΕΞΩ από τα foot1/foot2 (πέρα από τις μύτες). Fix
  (`DimensionRenderer.drawDimLineOrArc` linear): `hasLeader = inset1|inset2 > 0` → (α) **πάντα** σχεδίασε την
  inset κεντρική γραμμή (αγνόησε το `drawDimLineInside=false` του fit)· (β) **ΠΟΤΕ** outside stubs για leader
  arrows (ο leader ήδη γεφυρώνει ως τη μύτη). Standard dims αμετάβλητα (hasLeader=false). **39/39 GREEN** ·
  jscpd clean · 493 γρ.
- **2026-07-09** — **ADR-608: κείμενο ομοαξωνικό με τη γραμμή** (Giorgio: «το κείμενο είναι έκκεντρο»). Το
  NESTOR style έχει `dimtad: 'above'` (κείμενο πάνω από τη γραμμή). Override `dimtad: 'centered'` στον mapper →
  κείμενο κεντραρισμένο στον άξονα της γραμμής διάστασης (DIMTAD=0). Μόνο αυτό. Test κλειδώνει `dimtad`.
  **11/11 mapper GREEN** · jscpd clean.
