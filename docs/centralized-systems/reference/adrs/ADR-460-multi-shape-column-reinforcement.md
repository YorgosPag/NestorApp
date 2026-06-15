# ADR-460 — Multi-shape Column & Wall Reinforcement Automation (SSoT)

**Status:** 🟢 Slices 1-10 IMPLEMENTED 2026-06-15 (Opus) — UNCOMMITTED (🔴 browser-verify + commit). Επεκτείνει ADR-456 (ποσότητες/οπλισμός) + ADR-457 (detail sheet).
**Discipline:** Δομοστατικά / Structural Engineering
**Scope:** Όλη η αυτοματοποίηση οπλισμού (compute, layout, 2Δ/3Δ render, detail-sheet PDF, settings panel, Auto, validator) επεκτείνεται από **μόνο-ορθογωνική** σε **ΟΛΟΥΣ τους 9 τύπους διατομής** κολώνας: `rectangular, circular, L-shape, T-shape, I-shape, U-shape, polygon, shear-wall, composite`. Παννομιότυπη λειτουργία, ένα SSoT, μηδέν διπλότυπα.

---

## 1. Context & Problem

Πριν το ADR-460 και οι 9 τύποι διατομής είχαν **πλήρη γεωμετρία** (footprint + 3D extrude + grips + σοβάς), αλλά **όλη η αλυσίδα οπλισμού ήταν rectangular-only**: ~15 σκληρές πύλες `kind !== 'rectangular'` απέκλειαν compute/layout, cross-ties, confinement, 2Δ rebar, 3Δ κλωβό, τα 7 builders του detail-sheet, και το settings panel ήταν ορατό μόνο σε `rectangular || shear-wall`.

Στόχος (εντολή Giorgio): **τα ίδια ακριβώς** σε όλους τους τύπους — ίδιες ρυθμίσεις, ίδιοι υπολογισμοί, ίδιο PDF λεπτομέρειας, ίδιες προβολές 2Δ/3Δ. Εύρος: **όλοι οι τύποι μαζί** + **πλήρης σχεδιασμός τοιχώματος** (boundary elements + κατανεμημένος οπλισμός κορμού).

---

## 2. Architecture — μία engine, dispatch ανά «detailing mode»

Θεμέλιο: το υπάρχον `materializeColumnLocalPolygonMm(params)` (`bim/geometry/column-geometry.ts`) δίνει το **section outline σε LOCAL mm, κεντραρισμένο, για ΚΑΘΕ σχήμα** — ίδιο σύστημα συντεταγμένων με το rebar layout. Πάνω σε αυτό:

**SSoT classifier** `resolveColumnReinforcementSection(params)` (`bim/structural/reinforcement/column-section-outline.ts`) → `{ kind, outlineMm, mode, isCircular, diameterMm, minThicknessMm, maxDimensionMm, perimeterMm, grossAreaMm2, bboxWidth/Depth, wallAxis }`. Το `mode` ∈ `perimeter | circular | wall`:

| Mode | Σχήματα | Διάταξη |
|---|---|---|
| `perimeter` | rectangular, L, T, I, U, polygon, composite (μη επιμήκη) | Ράβδοι στο **inset outline** (κορυφή σε κάθε γωνία + ενδιάμεσες στο max βήμα) + στεφάνι που ακολουθεί το outline (concave-aware rounded corners) + cross-ties |
| `circular` | circular | Ράβδοι **ακτινικά** σε κύκλο + δακτύλιος/σπείρα |
| `wall` | shear-wall + επιμήκη L/T/U/composite (λόγος ≥ 4, EC8 §5.1.2) | **Boundary elements** (κρυφοκολώνες, ζώνες άκρων lc) + **κατανεμημένος οπλισμός κορμού** (κατακόρυφες ράβδοι 2 παρειών + web S-ties), EC8 §5.4.3.4 |

**Dispatcher** `resolveColumnRebarLayout(r, section)` + `resolveColumnCrossTies(layout, section, r)` (`column-rebar-layout-resolve.ts`) → ΟΛΟΙ οι consumers (ποσότητες/2Δ/3Δ/detail-sheet) καλούν αυτό. Το rectangular διοχετεύεται στο **υπάρχον** `computeColumnRebarLayout` (fast-path → μηδέν regression, ίδιοι αριθμοί). Το `ColumnRebarLayout` παραμένει ΕΝΑ interface (+ optional `stirrupCenterlineLengthMm`, `extraStirrupPathsMm`, `crossTieAnchorsMm`).

### Νέα/τροποποιημένα modules
- **NEW** `column-section-outline.ts` (classifier), `column-perimeter-layout.ts`, `column-circular-layout.ts`, `column-wall-reinforcement.ts`, `column-rebar-layout-resolve.ts` (dispatcher).
- **SSoT reuse**: νέο `insetPolygonMiter` (winding-aware, concave-safe, miter — διατηρεί κάθετη απόσταση `d`) στο `polygon-utils.ts` (το υπάρχον `insetClosedPolygon` averaged-normal υπο-εισάγει τις γωνίες → ακατάλληλο για στεφάνι).
- **Generalized**: `buildRoundedStirrupPath` (concave/reflex corners)· `column-rebar-layout` (`distributeBarsAlongPolygon`, `closedPolylineLengthMm`)· `column-cross-ties` (`buildTiesFromAnchors`)· `column-confinement` (optional `layout` param)· `column-reinforcement-compute` (optional `section` param → shape-aware ποσότητες/ρ, wall boundary+web steel)· providers/`suggest-reinforcement` (perimeter-based bar count, `minThicknessMm` για βήμα, wall `suggestWallIntent`, circular).
- **Data model** `ColumnReinforcement` += optional `wall?: WallReinforcementIntent` + `spiralPitchMm`. Zod `column.schemas.ts`: +wall sub-schema, +`spiralPitchMm`, **+διόρθωση κενού** (`crossTiePattern` έλειπε από το `.strict()` schema → στριβόταν στο parse).
- **Consumers**: `column-rebar-2d`, `column-rebar-3d` (κλωβός), τα 7 detail-sheet builders, `column-validator` (gate removal + shape-correct grossArea/ρ), `DxfRenderer.drawColumnReinforcement2D` (gate removal), settings (`resolveColumnPanelVisibility` structural → όλα· `buildSectionContext`/`resolveStructuralReadout` shape-aware).

---

## 3. ΜΑΘΗΜΑΤΑ
- `insetClosedPolygon` (ETICS, averaged-normal) **υπο-εισάγει** γωνίες 90° κατά ~cos45° → λάθος για centerline στεφανιού. Σωστό = **miter** `m = d·(n1+n2)/(1+n1·n2)` με **winding-aware** inward normals (left normal για CCW· concave reflex χειρίζονται φυσικά).
- `.strict()` Zod schema → ΚΑΘΕ νέο/υπάρχον persisted πεδίο ΠΡΕΠΕΙ να υπάρχει στο schema, αλλιώς σιωπηρά στρίβεται (το `crossTiePattern` ήταν τέτοιο κενό).
- Geometry-is-SSoT: ΕΝΑ dispatcher τρέφει 2Δ/3Δ/ποσότητες/detail-sheet → καμία απόκλιση μεταξύ προβολών.

---

## 4. DEFER
- Granular UI editing των wall fields (boundary/web Ø/βήμα) + circular spiral pitch combos — το Auto τα παράγει shape-aware· επεξεργάζονται τα κοινά longitudinal/stirrup/cover.
- Πλουσιότερο schedule τοιχώματος (ξεχωριστές γραμμές boundary/web).
- I-shape ως χαλύβδινη διατομή (τώρα ως concrete perimeter).
- Boundary-element placement σε **μη-ορθογώνια** άκρα Γ/Τ/Π είναι bbox-προσέγγιση (ακριβές σε shear-wall/επιμήκες ορθογώνιο).
- Multi-loop inset για πολύ λεπτά μέλη (cover ≈ μισό πάχος).

---

## 5. Verification
- **Jest**: `column-section-outline` (6), `column-multishape-layout` (perimeter/circular/wall/dispatcher/cross-ties), `column-multishape-suggest` (circular/wall/rect), + ΟΛΟ το υπάρχον structural/detail-sheet/validators suite GREEN (529+ tests, μηδέν regression — rect αριθμητικά ταυτόσημο).
- **Browser** (Firestore-records-first): ανά τύπο (circular/L/T/I/U/polygon/composite/shear-wall) → φτιάξε κολώνα → «Auto» → επαλήθευσε 2Δ κάτοψη (ράβδοι+στεφάνι), 3Δ κλωβό, panel ρ/βάρος, PDF λεπτομέρειας (plan/elevation/schedule/titleblock/3D).
- **tsc** `--noEmit` (N.17 serialized).

---

## 6. Changelog
- **2026-06-15** (Opus) — ADR-460 created. Slices 1-10 implemented (multi-shape SSoT engine + dispatcher + wall design + all consumers). UNCOMMITTED. 🔴 browser-verify + commit. ⚠️ `DxfRenderer.ts` τροποποιήθηκε (ADR-040 governance — stage ADR-040 + ADR-460 μαζί στο commit, CHECK 6B/6D).
- **2026-06-15** (Opus, follow-up) — UI: το control «μοτίβο cross-tie» (διαμάντι/πλέγμα) γίνεται **ανενεργό (disabled)** σε **κυκλική + τοίχωμα** (mode ≠ perimeter) — δεν έχει εφαρμογή εκεί (ο δακτύλιος/σπείρα περισφίγγει όλες τις ράβδους· wall ties = auto). SSoT `resolveColumnFieldDisabled(commandKey, params)` (`column-command-keys.ts`) → `ColumnPropertyRow` `disabled` prop. 4 jest.
