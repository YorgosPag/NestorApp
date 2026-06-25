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
- **Εκκρεμεί calibration (browser-verify Giorgio):** ακριβές χρώμα/μήκος βέλους, italic κειμένου
  (αν το `TextEntity` το υποστηρίζει), αριθμός γραμμών υαλοπίνακα ανά `style`.

## Changelog
- **2026-06-25** — Φ5b.1: extract `<dim>`/`<wall>`/`<open>` + 2Δ mappers. 16 jest.
- **2026-06-25** — Φ5b.1+: faithful symbol replay (wall-cutouts + window glass + dimension arrows/witness/
  text). 2 νέα pure modules + extended types/extractor + rewritten mapper. 26 jest. BIM αναβλήθηκε.
- **2026-06-25** — Φ5b.1++: data-driven calibration (Δρόμος Α confirmed). `<dtext_color>` κίτρινο κείμενο,
  end_style=8 → βελάκια+extension (όχι 45°), σύμβολο παραθύρου με πλαίσιο+μπινί. Tunable constants για
  browser-verify. **52 jest GREEN** (io/tek). Μηδέν νέα αρχεία — calibration των Φ5b.1+ modules.
