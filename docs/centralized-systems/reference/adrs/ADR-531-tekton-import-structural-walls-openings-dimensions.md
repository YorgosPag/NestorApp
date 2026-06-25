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

## 6. Scope / Follow-up (Φ5b.2)
- Πλήρη BIM: `createWall` (`category,start,end,height,thickness,base/topBinding`), `createOpening`
  (`wallId`,`offsetFromStart`=προβολή pos στον άξονα, `width/height/sillHeight`, + `hostedOpeningIds`),
  `DimensionEntity` (`aligned`, default DimStyle, `defPoints` από p0/p1).
- **Calibration (browser):** πάχος τοίχου (`inner_width` 0.09 vs matrix v-scale 0.25)· ύψος/περβάζι
  κουφώματος (`top`−`elevation`)· φορά jambs.
- Slabs/roofs Tekton → μελλοντικά.

## Changelog
- **2026-06-25** — Φ5b.1: extract `<dim>`/`<wall>`/`<open>` + 2Δ mappers. 5 αρχεία (2 νέα + 3 additive)
  + types + 3 export helpers. 16 jest.
