# ADR-656 — Ελληνικό Τοπογραφικό: Παρουσίαση & Compliance (Ισοϋψείς · Labels Σημείων · Κάναβος ΕΓΣΑ87)

- **Status**: 🟢 M9 DONE · 🔴 M10/M11 NOT STARTED — blueprint (έρευνα αγοράς + ελληνικές προδιαγραφές +
  αρχιτεκτονικό σχέδιο) ολοκληρωμένο· M9 (πάχος ισοϋψών) υλοποιήθηκε (βλ. Changelog v2). M10 (labels σημείων) →
  Plan Mode, M11 (κάναβος ΕΓΣΑ87) → Orchestrator — επόμενα sessions.
- **Date**: 2026-07-14
- **Category**: DXF Viewer / Topography / Presentation & Compliance
- **Σχετικά**:
  - **ADR-650** (Τοπογραφικές Αποτυπώσεις & Ισοϋψείς — ο πυρήνας pipeline points→TIN→contours→export). Το παρόν
    ADR είναι το **presentation/compliance layer** πάνω στο 650· δεν το αντικαθιστά.
  - ADR-057 (`completeEntity` — undo/persist/render/export για FREE), ADR-462 (canonical mm),
    ADR-635 (culling gap σε geo-referenced ±1e6), ADR-040 (micro-leaf canvas subscribers),
    ADR-639 (WebGL line layer), ADR-034 (License policy).

> **Πηγή**: μελέτη 2 screenshots (ισοϋψείς + wizard σημείων, 2026-07-14) από τον Giorgio + βαθιά έρευνα
> κώδικα (3 παράλληλοι Explore πράκτορες, έγκριση Giorgio) + web research ελληνικών φορέων.

---

## Context (το πρόβλημα / γιατί)

Ο Giorgio μελέτησε το τρέχον τοπογραφικό στον DXF viewer και εντόπισε **3 ελλείψεις/λάθη παρουσίασης** σε
σχέση με το τι κάνουν οι «μεγάλοι παίκτες» (Civil 3D / Trimble BC / Carlson) και τι απαιτούν οι ελληνικοί
φορείς (Κτηματολόγιο / ΤΕΕ / ΕΓΣΑ87):

1. **Ισοϋψείς** — οι **κύριες (index)** δεν ξεχωρίζουν οπτικά από τις **απλές (intermediate)**. Στο screenshot
   όλες οι καμπύλες έχουν ίδιο πάχος (hairline).
2. **Σημεία αποτύπωσης** — **δεν εμφανίζεται κανένα label** πάνω στα 121 σημεία: ούτε υψόμετρο (Ζ), ούτε
   αριθμός σημείου, ούτε κωδικός, ούτε Χ/Υ στις κορυφές ορίου.
3. **Κάναβος συντεταγμένων ΕΓΣΑ87** — **δεν υπάρχει** περιμετρική αρίθμηση + coordinate grid μέσα στο
   τοπογραφικό. (Το screen «ΠΛΕΓΜΑ / F7» είναι βοηθητικός κάναβος σχεδίασης — άλλο πράγμα.)

**Στόχος αυτού του ADR**: να τεκμηριώσει (α) τι κάνουν οι μεγάλοι παίκτες, (β) τι απαιτεί το ελληνικό
πλαίσιο, (γ) τι υπάρχει/λείπει στον κώδικα σήμερα, (δ) το ακριβές blueprint υλοποίησης για κάθε έλλειψη.

---

## 1. Τι κάνουν οι μεγάλοι παίκτες (Civil 3D / Trimble / Carlson / USGS)

### 1.1 Ισοϋψείς: κύριες (index) vs ενδιάμεσες (intermediate)
Παγκόσμιος cartographic κανόνας — **όχι** προαιρετικό στιλ:

| Στοιχείο | Κύρια / Index | Απλή / Intermediate |
|---|---|---|
| **Πάχος** | Χοντρή (~0.35–0.50 mm) | Λεπτή (~0.13–0.18 mm) — **λόγος ~2×–3×** |
| **Χρώμα** | Πιο έντονο/σκούρο | Πιο ξεθωριασμένο (ίδια οικογένεια) |
| **Τύπος** | Συνεχής | Συνεχής (και οι δύο) |
| **Ετικέτα υψομέτρου** | **ΜΟΝΟ οι κύριες** | Χωρίς αριθμό |

- **Civil 3D**: δύο ξεχωριστά contour styles/layers (`_Major` / `_Minor`)· major = index κάθε 5η, labeled.
- **USGS standard**: index contour χοντρή γραμμή με νούμερο, 4 intermediate ανάμεσα.
- **Depression contours** (βυθίσματα): επιπλέον «δοντάκια» (hachures) προς τα μέσα — future, όχι τώρα.

### 1.2 Labels σημείων: ΠΟΤΕ όλα, ΜΟΝΟ επιλεκτικά
Το χειρότερο λάθος = X,Y σε **κάθε** σημείο (121 σημεία → μπάχαλο). Οι μεγάλοι παίκτες **δεν** το κάνουν.
Στα COGO points κάθε σημείο έχει «point label style» που δείχνει **επιλεκτικά** πεδία:

| Τύπος σημείου | Τι εμφανίζεται πάνω στο σχέδιο |
|---|---|
| **Κορυφές ορίου οικοπέδου** | **X, Y (+ Z)** + αρ. κορυφής — ΠΑΝΤΑ |
| **Τριγωνομετρικά / στάσεις** | X, Y, Z + όνομα |
| **Σημεία εδάφους (spot heights)** | **ΜΟΝΟ Ζ** (κουκίδα + δεκαδικό, π.χ. `•103.72`)· προαιρετικά αρ./κωδικός |
| **Σημεία πάνω σε ισοϋψή** | Τίποτα (η ισοϋψής έχει ήδη label) |

- Οι πλήρεις συντεταγμένες X,Y **δεν** γράφονται σε κάθε σημείο — μπαίνουν σε **πίνακα συντεταγμένων** στην
  άκρη ή μόνο στις **κορυφές ορίου**.

### 1.3 Κάναβος συντεταγμένων (coordinate grid / graticule)
Στα σοβαρά τοπογραφικά **πάντα** υπάρχει περιμετρικά ο κάναβος συντεταγμένων:
- **Grid crosses / ticks** στις στρογγυλές τιμές (κάθε **50 ή 100 m**), με **αρίθμηση Easting/Northing** στο
  περιθώριο — προτιμότερο από πλήρες πλέγμα γιατί δεν «λερώνει» το σχέδιο.
- Μαζί με **κλίμακα (bar + αριθμητική)**, **βέλος Βορρά**, **υπόμνημα**.

---

## 2. Ελληνικές απαιτήσεις (επίσημοι φορείς — web research)

- **Κύριες ισοϋψείς = πενταπλάσιο της ισοδιάστασης**, σχεδιασμένες εντονότερες/παχύτερες, **με ετικέτα
  υψομέτρου**· οι ενδιάμεσες λεπτές χωρίς label. (Επιβεβαιώνει το «Κύρια κάθε 5» του UI.)
- **Κάναβος ΕΓΣΑ87 (EPSG:2100) υποχρεωτικός** στο εξαρτημένο τοπογραφικό διάγραμμα, μαζί με **κλίμακα, βέλος
  Βορρά, υπόμνημα**.
- **Συντεταγμένες Χ,Υ + υψόμετρα ΜΟΝΟ στις κορυφές ορίου** + **πίνακας συντεταγμένων κορυφών** (Α/Α · Χ · Υ ·
  Ζ · κωδικός) — το ίδιο που ήδη τεκμηριώνει το ADR-650 §M7.
- Νόμιμο export πάντα με **ακριβείς** κορυφές (όχι smoothed) — ADR-650 M3 το τηρεί ήδη.

**Πηγές:**
- [ΤΕΕ — Υποδείγματα τοπογραφικών διαγραμμάτων (Ν.4030/12)](http://portal.tee.gr/portal/page/portal/teetkm/EPAGGELMATIKA/SYNERGASIA_TEETKM_YPHRESIES_DOMHSHS/top_diag)
- [XYZ — Εξαρτημένο Τοπογραφικό Διάγραμμα στο ΕΓΣΑ87](https://xyz.gr/exartimeno-topografiko-diagramma-sto-elliniko-geodaitiko-systima-anaforas-87-egsa-87/)
- [mtopo — Τοπογραφικό Κτηματολογίου](https://mtopo.gr/our_services/topografiko-diagramma-ktimatologiou/)
- [Samaras & Partners — Κατηγορίες Τοπογραφικού Διαγράμματος](https://www.samarasgroup.gr/)
- [Scout Adventure — Ισοϋψείς καμπύλες & ισοδιάσταση (κύριες/δευτερεύουσες)](https://www.scout-adventure.gr/product/%CE%B9%CF%83%CE%BF%CF%8B%CF%88%CE%B5%CE%AF%CF%82-%CE%BA%CE%B1%CE%BC%CF%80%CF%8D%CE%BB%CE%B5%CF%82-%CE%BA%CE%B1%CE%B9-%CE%B9%CF%83%CE%BF%CE%B4%CE%B9%CE%AC%CF%83%CF%84%CE%B1%CF%83%CE%B7/)
- [gipedometria — Ισοϋψείς καμπύλες](https://gipedometria.weebly.com/)

---

## 3. Ευρήματα κώδικα — τι ΥΠΑΡΧΕΙ / τι ΛΕΙΠΕΙ

> Frame: όλες οι world συντεταγμένες **ΕΙΝΑΙ ΕΓΣΑ87 σε canonical mm** (ADR-462). Το `topo-local-origin.ts`
> αφαιρεί origin μόνο για float64 stability στο TIN/marching και το ξαναπροσθέτει — **δεν** αποθηκεύεται στο
> view transform. Άρα `ΕΓΣΑ87_m = worldMm / 1000` άμεσα. Τα `ox/oy` στο URL = pan offset, **όχι** geo offset.

### 3.1 Έλλειψη 1 — Ισοϋψείς MAJOR vs MINOR
**ΥΠΑΡΧΕΙ ήδη** ο διαχωρισμός σε layer + χρώμα + label:
- `systems/topography/contour-config.ts:53-62` — `TOPO-CONTOUR-MAJOR/MINOR/LABEL` + χρώματα (καφέ οικογένεια:
  major `#8B4513`, minor `#B5651D`).
- `systems/topography/topo-to-entities.ts:42-54` — ανά line: `layerId` + `color` κατά `line.isMajor`· labels
  μόνο σε majors (`:86`, gate `config.labelMajors`).
- `systems/topography/contour-chainer.ts:53-56` — `isMajorLevel` (major όταν `k % majorEvery === 0`), οδηγείται
  από το UI `TopographyPanel.tsx:149-153` («Κύρια κάθε 5»).

**ΛΕΙΠΕΙ (το κύριο κενό) — ΠΑΧΟΣ**: κανένα `lineweight` δεν ορίζεται πουθενά (ούτε per-layer στο
`ensure-contour-layers.ts:24-28 LAYER_SPECS`, ούτε per-entity στο `toPolylineEntity`). Αποτέλεσμα: major & minor
ζωγραφίζονται **ίδιο 1px hairline** → οπτικά αδιάκριτα.

**Παρατήρηση προς επαλήθευση**: στο screenshot οι γραμμές φαίνονται **πράσινες**, όχι καφέ (tooltip: «ΧΡΩΜΑ:
ΑπόΕπίπεδο»). Πιθανή αιτία: παλιές ισοϋψείς προ-χρώματος ή print/canvas color-adaptation
(`adaptEntityColorForCanvas`). Πρέπει να επιβεβαιωθεί ότι το καφέ φτάνει στον καμβά κατά την υλοποίηση M9.

### 3.2 Έλλειψη 2 — Labels σημείων — GREENFIELD
- **Τα raw survey points ΔΕΝ ζωγραφίζονται καθόλου** σήμερα· **κανένα** point-label rendering δεν υπάρχει.
- Μοντέλο `systems/topography/topo-types.ts:22` `TopoPoint {x,y,z,code?}` — **δεν έχει `pointNumber`**. Το
  `pointId` αναγνωρίζεται στο mapping (`topo-column-mapping.ts HEADER_HINTS`) αλλά **απορρίπτεται** στο
  `mapRowToPoint:100-113` (κρατά μόνο x,y,z,code).
- Οι **κορυφές ορίου με Χ/Υ/Ζ υπάρχουν ήδη** (μόνο για export tables): `deliverables/survey-tables.ts:94`
  `buildPlotMeasurements` (Z sampled από TIN via `sampler.zAtMm`). Boundary στο `TopoPointStore`
  (`setTopoBoundary:132`, τύπος `TopoBoundary:120`). Pick handler `hooks/canvas/canvas-click-topo-boundary.ts:38`.
- **SSoT για επαναχρήση**: `TextEntity` (`types/entities.ts:191`) + το pattern `topo-to-entities.ts:57
  toLabelEntity` — φτιάχνει `TextEntity` με `generateEntityId()`, ρέει μέσω `completeEntity` (ADR-057) →
  undo/persist/render/export **ΔΩΡΕΑΝ** (καμία νέα canvas layer).

### 3.3 Έλλειψη 3 — Κάναβος ΕΓΣΑ87 (TOPO-GRID) — GREENFIELD (οθόνη + export)
- **Δεν υπάρχει· το ADR-650 δεν το αναφέρει** (όλα τα «κάνναβος» hits εκεί = cut/fill volume method ή CRS
  params, όχι display grid). Ξεχωριστό από το screen «ΠΛΕΓΜΑ (F7)».
- Το F7 grid (πρότυπο προς clone): `components/dxf-layout/GridUnderlayCanvas.tsx:38` +
  `rendering/ui/grid/GridRenderer.ts` (έχει ήδη `renderGridCrosses:291`), mount `CanvasLayerStack.tsx:294-299`
  (z0). Adaptive step math: `systems/rulers-grid/grid-calculations.ts:120/199`.
- Transform SSoT: `rendering/core/CoordinateTransforms.ts:69 worldToScreen`. Περιμετρική αρίθμηση analog:
  `rendering/ui/ruler/RulerRenderer.ts`. Coord readout: `ui/toolbar/ToolbarCoordinatesDisplay.tsx`.
- Layer registration: canvas render-layer (ADR-040 micro-leaf, `canvas-layer-stack-leaves.tsx`) **ή** DXF entity
  layer (`ensure-contour-layers.ts:42` pattern). Ο export χρειάζεται το δεύτερο.

---

## 4. Blueprint υλοποίησης

> Αρχές: SSoT reuse (κανένας νέος μηχανισμός όπου υπάρχει), ADR-057 `completeEntity` για entities,
> ADR-040 micro-leaf για canvas, N.7.2 checklist, N.18 anti-dup (`jscpd:diff` πριν «done»),
> N.11 (layer names = config constants, όχι `t()`· UI copy = `t()`).

### M9 — Πάχος κύριων ισοϋψών (μικρό, per-layer)
- **Αρχεία**: `ensure-contour-layers.ts` (LAYER_SPECS +`lineweight`), `contour-config.ts` (σταθερές mm),
  προαιρετικά `TopographyPanel.tsx` (verify «ΠΑΧΟΣ» on).
- **Σχέδιο**: δώσε `lineweight` στα MAJOR/MINOR specs (major ~0.35–0.50mm, minor ~0.13–0.18mm, λόγος ~2.5×). Τα
  entities μένουν **ByLayer** → ο υπάρχων SSoT cascade (`dxf-renderer-style-resolve.ts:85` +
  `resolve-entity-style.ts` + `config/lineweight-iso-catalog.ts`) το εφαρμόζει αυτόματα. Απαιτεί
  `getShowLineweight()` on (το status-bar «ΠΑΧΟΣ» ήδη on). **Επαλήθευση**: το καφέ χρώμα φτάνει στον καμβά.
- **Εκτίμηση**: 1-2 αρχεία, 1 domain → Sonnet.

### M10 — Labels σημείων (spot Ζ · αρ./κωδικός · Χ,Υ κορυφών)
- **Αρχεία**: `topo-types.ts` (+`pointNumber?`), `topo-column-mapping.ts` (διάδοση `pointId`→`pointNumber`),
  `topo-dxf-points.ts` (`pointFromEntity`), **νέο** `topo-point-labels.ts` (pure builder), `contour-config.ts`
  (νέα layer names/colors: `TOPO-POINT-ELEV`, `TOPO-POINT-CODE`, `TOPO-POINT-NUM`, `TOPO-BOUNDARY-XY`),
  `ensure-*-layers` (mint), `TopographyPanel.tsx` (toggles), hook τύπου `useTopoContours` για commit.
- **Σχέδιο**:
  - Πυρήνας `buildSurveyPointLabelEntities(points, boundary, layers, opts)` (πρότυπο `toLabelEntity`) → `TextEntity[]`.
  - **Επιλεκτικότητα (ο πυρήνας του σωστού)**: default = μόνο **Ζ (spot height)**· προαιρετικά αρ./κωδικός·
    **Χ,Υ ΜΟΝΟ στις κορυφές ορίου** (από `buildPlotMeasurements` `survey-tables.ts:94`). **Ποτέ** X,Y στα 121.
  - 3 ανεξάρτητα UI toggles: (α) Υψόμετρα Ζ, (β) Αρ.+Κωδικός, (γ) Χ,Υ κορυφών (default μόνο σε boundary).
  - Commit μέσω `completeEntities` (ADR-057) → undo/persist/render/export δωρεάν.
- **Εκτίμηση**: 6-8 αρχεία, 1-2 domains → Plan Mode ή μικρός Orchestrator.

### M11 — Κάναβος ΕΓΣΑ87 (TOPO-GRID) — pure SSoT + 2 καταναλωτές (οθόνη + export)
- **Αρχεία**:
  - **Νέο pure** `systems/topography/topo-grid-model.ts`: `(worldBounds, stepMm, egsaOrigin) → { crosses[], ticks[], perimeterLabels[] }`. **ΕΝΑΣ** SSoT· adaptive round step (50/100m) από `grid-calculations.ts`.
  - **Καταναλωτής Α (οθόνη)**: νέο `TopoGridUnderlayCanvas.tsx` (clone `GridUnderlayCanvas`) + micro-leaf
    (ADR-040: **όχι** `useSyncExternalStore` στο shell — CHECK 6C), mount στο `CanvasLayerStack` σε z-index πάνω
    από το F7 grid. Labels screen-space (reflow σε pan/zoom). Reuse `GridRenderer.renderGridCrosses` +
    `RulerRenderer`-style περιμετρικά labels.
  - **Καταναλωτής Β (export)**: builder ίδιο model → `line`/`text` entities, ρέει στο M7 export
    (`deliverables/useSurveyExport.ts`) → μπαίνει στο DXF/PDF (νόμιμο τοπογραφικό).
  - **Toggle/store**: παράλληλο του `globalGridStore` (ξεχωριστό από F7) + shortcut sibling στο
    `keyboard-shortcuts.ts:558`.
- **Σχέδιο compliance**: μαζί με τον κάναβο, τεκμηρίωση για μελλοντικά **κλίμακα-bar / βέλος Βορρά / υπόμνημα**
  (title-block ADR-651 συνέργεια).
- **Εκτίμηση**: 5+ αρχεία, 2 domains (topography + canvas/rendering) → **Orchestrator** (έγκριση Giorgio, N.8).

### N.7.2 checklist (για όλα τα M9-M11)
| # | Ερώτηση | Απάντηση |
|---|---|---|
| 1 | Proactive/reactive | **Proactive** — labels/grid παράγονται στο generate/import moment |
| 2 | Race condition | **Όχι** — καθαροί builders, commit μέσω completeEntity |
| 3 | Idempotent | **Ναι** — ensure-layers + regenerate αντικαθιστά, δεν διπλασιάζει |
| 4 | Belt-and-suspenders | Grid = pure model + 2 καταναλωτές από ίδιο SSoT |
| 5 | SSoT | **Ναι** — `topo-grid-model` ένα, `TextEntity`/`completeEntity` reuse |
| 6 | Await/fire-forget | **Await** για correctness του commit |
| 7 | Lifecycle owner | Hooks (`useTopoContours`-style) όπως το M1 |

---

## 5. Open questions / trade-offs

- **Χρώμα ισοϋψών**: κράτημα του AutoCAD καφέ (`#8B4513`/`#B5651D`) vs το τρέχον πράσινο του screenshot. Πρόταση:
  καφέ (πρότυπο κλάδου) — να επιβεβαιωθεί γιατί εμφανίζεται πράσινο σήμερα (M9 investigation).
- **Label auto-placement**: οι κύριοι παίκτες (Bentley «Label Optimizer», ML) αποφεύγουν επικαλύψεις labels. M10
  ξεκινά με απλό placement (mid-vertex / δίπλα σε κουκίδα)· auto-declutter = future differentiator (ADR-650 §5).
- **Grid: canvas vs entity για export**: επιλέχθηκε **και τα δύο** (pure model + 2 καταναλωτές) ώστε οθόνη =
  γρήγορο/reflow και export = νόμιμη geometry, χωρίς διπλή αλήθεια.

---

## Changelog
- **v2** (2026-07-14): **M9 ΥΛΟΠΟΙΗΘΗΚΕ** — πάχος κύριων ισοϋψών μέσω του υπάρχοντος ByLayer cascade (κανένας
  νέος μηχανισμός). Αλλαγές:
  - `contour-config.ts`: νέες σταθερές `TOPO_MAJOR_LINEWEIGHT_MM = 0.5` / `TOPO_MINOR_LINEWEIGHT_MM = 0.18`
    (ISO `LineweightMm`, λόγος ~2.8× — cartographic index/intermediate κανόνας Civil 3D / USGS / ΤΕΕ).
  - `ensure-contour-layers.ts`: το `LayerSpec` παίρνει `lineweight?`· τα MAJOR/MINOR layers δημιουργούνται με
    το spec weight. **Idempotent reconcile** για υπάρχοντα (legacy) scenes: existing layer με sentinel weight
    (`undefined`/-3/-2/-1) **αναβαθμίζεται** στο spec· concrete (χειροκίνητο user override) **δεν** πειράζεται.
  - Τα contour entities μένουν lineweight-free → κληρονομούν το layer weight μέσω `resolveEntityStyle`
    (γρ. 181-186) → `resolveEntityRenderStyle` → gate `getShowLineweight()` (status-bar «ΠΑΧΟΣ» ήδη on).
  - Test: `__tests__/ensure-contour-layers.test.ts` (4 tests — mint· sentinel-upgrade· user-override-respect·
    idempotency). ✅ pass. N.18 jscpd:diff καθαρό.
  - **Open item χρώματος** (§5): επιβεβαιώθηκε ότι ο τρέχων κώδικας βάζει concrete καφέ (`#8B4513`/`#B5651D`)
    στα contour entities· το `adaptEntityColorForCanvas` αναμειγνύει προς άσπρο για contrast, **δεν** παράγει
    πράσινο. Το πράσινο του screenshot = πιθανότατα παλιά δεδομένα προ-χρωματισμού. Re-generate → καφέ + σωστό
    πάχος. Αν παραμείνει πράσινο σε νέα generate → ξεχωριστό data investigation.
- **v1** (2026-07-14): Αρχική δημιουργία — έρευνα αγοράς + ελληνικές προδιαγραφές + ευρήματα κώδικα (3 Explore
  πράκτορες) + blueprint M9/M10/M11 για τις 3 ελλείψεις παρουσίασης του τοπογραφικού. Status BLUEPRINT (καμία
  αλλαγή κώδικα). Cross-ref ADR-650.
