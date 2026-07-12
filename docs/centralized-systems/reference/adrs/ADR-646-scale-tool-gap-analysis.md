# ADR-646: Scale Tool — Ανάλυση Κενών & Χάρτης Ολοκλήρωσης

**Status:** 🟡 IN PROGRESS (Φάσεις 1+2+3 ✅ IMPLEMENTED 2026-07-13· Φάση 4 εκκρεμεί)
**Date:** 2026-07-12
**Domain:** DXF Viewer — Modify Tools
**Base:** [ADR-348](ADR-348-scale-command.md) (Scale Command)· σχετικά: ADR-418 (view-scale), ADR-625 (transform ghost preview SSoT)
**Shortcut:** `SC` · **Ribbon:** Home → Modify → Κλιμάκωση

---

## Context

Ο Giorgio ζήτησε (2026-07-12) audit «τι λείπει από το Scale». Το εργαλείο υπάρχει (ADR-348)
και καλύπτει τον πυρήνα, αλλά η **έρευνα στον κώδικα** (όχι στο ADR) αποκάλυψε αποκλίσεις από
(α) την ίδια την προδιαγραφή του ADR-348 και (β) τη συμπεριφορά των μεγάλων CAD (AutoCAD/BricsCAD).

> **Αρχή (N.0.1):** CODE = SOURCE OF TRUTH. Όπου το ADR-348 λέει «✅ Live preview during mouse
> drag» ενώ ο κώδικας δεν κλειδώνει τον συντελεστή με κλικ, **ισχύει ο κώδικας** — το ADR-348 ήταν
> aspirational σε αυτό το σημείο.

Αυτό το ADR καταγράφει την **τρέχουσα πραγματική κατάσταση**, τα **κενά με σειρά σημασίας**
(σύμπτωμα → ρίζα με `file:line` → βιομηχανική προσδοκία → σκίτσο διόρθωσης), και έναν **χάρτη
υλοποίησης** για την επόμενη συνεδρία. **Καμία αλλαγή κώδικα σε αυτή τη φάση.**

---

## Τρέχουσα κατάσταση — τι δουλεύει (verified in code)

| Δυνατότητα | Πηγή |
|---|---|
| FSM `idle→selecting→base_point→scale_input` | `hooks/tools/useScaleTool.ts` |
| Uniform + Non-uniform (πλήκτρο `N`) | `useScaleTool.ts` `dispatchScaleKey` |
| Copy mode (`C`) — κλώνοι, originals άθικτα | `core/commands/entity-commands/ScaleEntityCommand.ts` |
| Reference mode (`R`) — uniform & non-uniform (πληκτρολογημένο) | `useScaleTool.ts` `handleEnterConfirm` + `systems/scale/scale-reference-calc.ts` |
| Numeric buffer + Enter, αρνητικός συντελεστής (mirror+scale) | `dispatchScaleKey` (leading `-`) |
| Live ghost preview + tooltip `×factor` | `hooks/tools/useScalePreview.ts` (μέσω ADR-625 skeleton) |
| Κλείδωμα κλειδωμένων layers (skip + μήνυμα) | `useScaleTool.ts` `filterLockedEntities` |
| Grip handoff (pre-seeded base + reference vector) | `useScaleTool.ts` `onActivate` + `GripHandoffStore` |
| Undo/redo/serialize | `ScaleEntityCommand` (extends `SnapshotTransformCommand`) |
| Per-entity transform: line, circle→ellipse, ellipse, polyline/lwpolyline, spline, text, mtext, point, leader, dimension, hatch, rect, block(INSERT), group | `systems/scale/scale-entity-transform.ts` (SSoT) |

---

## Κενά (με σειρά σημασίας)

### 🔴 #1 — Δεν κλειδώνεις τον συντελεστή με ΚΛΙΚ (pick 2ου σημείου) — ✅ ΔΙΟΡΘΩΘΗΚΕ (2026-07-13)
- **Σύμπτωμα:** Scale → κλικ σημείο βάσης → κουνάς το ποντίκι, βλέπεις ghost + tooltip `×1.234` →
  **κλικ για κλείδωμα → δεν γίνεται τίποτα.** Δουλεύει ΜΟΝΟ με πληκτρολόγηση αριθμού + Enter.
- **Ρίζα:** `useScaleTool.ts` `handleScaleClick` (γρ. 185-197) → σε φάση `scale_input` καλεί
  `routeReferenceClick` (γρ. 238-245), που έχει case ΜΟΝΟ για `ref_p1_*`/`ref_p2_*` — για `direct`
  κάνει **no-op**. Το click είναι συνδεδεμένο (`hooks/canvas/useCanvasClickHandler.ts:195`), απλώς
  αγνοείται.
- **Δευτερεύον:** ο live συντελεστής = `dist / 100` (hardcoded 100 — αυθαίρετο), `useScalePreview.ts`
  `computeLiveScale` (γρ. 39), αντί για ratio ως προς την πρώτη θέση cursor.
- **Προσδοκία (AutoCAD/BricsCAD + ADR-348 §Industry «Live preview during mouse drag ✅»):** μετά το
  σημείο βάσης, κλικ 2ου σημείου κλειδώνει `factor = dist(base,pt) / refDist`.
- **Fix sketch:** στο `routeReferenceClick` (ή στο `handleScaleClick`) πρόσθεσε case `direct` →
  `executeScale(live, live)` με το ΙΔΙΟ `computeLiveScale`· κάνε το `computeLiveScale` το SSoT
  (μοιράζεται preview + commit) και όρισε το reference distance ρητά (πρώτο mouse-move δείγμα ή
  σταθερό world ref), όχι hardcoded 100.

### 🔴 #2 — Reference mode: δεν δείχνεις το «νέο μήκος» με κλικ — ✅ ΔΙΟΡΘΩΘΗΚΕ (2026-07-13)
- **Σύμπτωμα:** στη φάση `ref_new_x`/`ref_new_y` μπορείς μόνο να **πληκτρολογήσεις** μήκος· κλικ = no-op.
- **Ρίζα:** ίδια (`routeReferenceClick` χωρίς case `ref_new_*`).
- **Προσδοκία:** ο AutoCAD επιτρέπει pick σημείου για το νέο μήκος (μετρά απόσταση base→pick).
- **Fix sketch:** case `ref_new_x`/`ref_new_y` → μήκος = `dist(base, pt)` → `computeUniformRef(...)`.

### 🟠 #3 — BIM & άλλες οντότητες = σιωπηλό no-op — ✅ ΔΙΟΡΘΩΘΗΚΕ (2026-07-13, υβριδικά)
- **Σύμπτωμα:** κλιμάκωση σε τοίχο/κολώνα/δοκό/πλάκα/σκάλα/πέδιλο/array/scale-bar/σύμβολα → **τίποτα**,
  χωρίς μήνυμα.
- **Ρίζα:** `scale-entity-transform.ts` `scaleEntity` `default: {}`.
- **Απόφαση Giorgio (2026-07-13):** «όπως οι μεγάλοι — Revit/ArchiCAD/Maxon/Figma-level, full enterprise».
- **Υλοποίηση (υβριδική, όπως οι μεγάλοι):**
  - **Parametric BIM** (wall/opening/slab/slab-opening/column/beam/foundation/roof/MEP/railing/furniture/
    …/**stair**) → **skip-with-message** (Revit «Elements cannot be scaled»). SSoT gate
    `isScalableEntityType()` (mirror του `scaleEntity` switch)· ο tool κάνει `partitionSelection`
    (mirror `filterLockedEntities`) → `scaleTool.scaleUnsupportedSkipped` / `allUnsupportedAbort`.
  - **Καθαρά γεωμετρικά που έκαναν σιωπηλό no-op → τώρα κλιμακώνονται:** `xline`/`ray` (anchors,
    direction=unit άθικτο)· `angle-measurement` (3 σημεία)· `center-mark`/`centerline` (σημεία·
    annotative size/extension paper-mm **διατηρούνται**)· `annotation-symbol`/`scale-bar` → **position-only**
    (annotative + scale-invariant length διατηρούνται — AutoCAD annotative)· `opening-info-tag`
    (position + `widthMm` world-mm)· `array` (recursive `hiddenSources` + spacing params ανά kind).
- **Fidelity boundaries (100% ειλικρίνεια):** (α) `image`/`raster` ΔΕΝ είναι scene `Entity` — ζει στο
  ξεχωριστό `FloorplanBackground` (`BackgroundTransform`)· εκτός scope του `scaleEntity` (χωριστή
  ενσωμάτωση, follow-up). (β) `region`/`polygon` δεν υπάρχουν ως entity types. (γ) `array` σε **non-uniform
  + array-level rotation** = προσεγγιστικό (ίδιο caveat με #5)· uniform = ακριβές. Το array είναι
  associative → regeneration downstream· **browser-verify PENDING**.

### 🟠 #4 — Τόξο (arc) σε non-uniform = γεωμετρικά λάθος — ✅ ΔΙΟΡΘΩΘΗΚΕ (2026-07-13, true elliptical arc)
- **Σύμπτωμα:** non-uniform scale σε τόξο → λάθος σχήμα.
- **Ρίζα:** `scale-entity-transform.ts` `scaleArc` — σε non-uniform **αγνοούσε το `sy`**, κλιμάκωνε
  radius μόνο με `|sx|`· το τόξο **δεν** μετατρεπόταν σε ελλειπτικό.
- **Απόφαση Giorgio (2026-07-13):** «όπως οι μεγάλοι — Revit/ArchiCAD/Cinema4D/Figma-level, full
  enterprise» → **πραγματικό elliptical arc** (όχι polyline bake), όπως ο AutoCAD (arc→ELLIPSE με params).
- **Κρίσιμο εύρημα (grep, CODE=SoT):** ο viewer **δεν ζωγράφιζε** μερική έλλειψη — `EllipseRenderer`
  σχεδίαζε πάντα πλήρη έλλειψη (`ctx.ellipse … 0..TAU`) αγνοώντας `startParam/endParam`, το
  `validateEllipseEntity` δεν τα επέστρεφε καν, και ο DXF importer μετατρέπει κάθε `ELLIPSE`→`circle`.
  Το `scaleCircleToEllipse` «δούλευε» μόνο επειδή η έλλειψη ήταν **πλήρης**.
- **Υλοποίηση:** (α) νέος SSoT `rendering/entities/shared/geometry-ellipse-utils.ts` (`ellipsePointAt`,
  `tessellateEllipseArc`) — convention ίδια με snap `intersection-calculators` + array `EllipseStrategy`
  (point = center + R(rot)·(major·cos t, minor·sin t)· rotation μοίρες· params rad CCW από +major).
  (β) `EllipseRenderer.renderEllipseGeometry` τιμά πλέον `startParam/endParam` → tessellated path μέσω
  `worldToScreen` (Y-flip-correct· η full ellipse μένει native — μηδέν regression). (γ) `validateEllipseEntity`
  επιστρέφει `startParam/endParam`. (δ) `scaleArc` non-uniform → `{type:'ellipse', center, majorAxis,
  minorAxis, rotation, startParam, endParam}`: axes/rotation μέσω του νέου SSoT `nonUniformEllipseAxes`
  (κοινό με circle→ellipse), map της **visible CCW range** (`arcVisibleCcwRange`) → params μέσω
  `circleAngleToEllipseParam` (local-frame projection· χειρίζεται swap rotation-90 **και** mirror signs).
  Uniform → μένει circular arc.

### 🟡 #5 — Rectangle: αγνοείται η περιστροφή — ✅ ΔΙΟΡΘΩΘΗΚΕ (2026-07-13, parallelogram bake)
- **Ρίζα:** `scaleRectangle` χρησιμοποιούσε x/y/width/height χωρίς `rotation` → non-uniform scale σε
  **στραμμένο** ορθογώνιο βγαίνει λάθος.
- **Υλοποίηση (πρακτική μεγάλων — AutoCAD/ArchiCAD/Figma):** rotated + non-uniform → **bake σε closed
  polyline** 4 κορυφών (παραλληλόγραμμο — δεν παραμένει ορθογώνιο). Reuse του corner SSoT
  `rectangleEntityVertices` (χειρίζεται ΚΑΙ corner1/corner2 ΚΑΙ x/y/w/h + rotation) → `scalePoint` ανά
  κορυφή. Uniform (οποιοδήποτε rotation) Ή axis-aligned rect → μένει rect (η ομοιόμορφη κλίμακα δεν
  παραμορφώνει το ορθογώνιο).

### 🟡 #6 — Καμία οπτική βοήθεια UI
- Μόνο command-line στιλ (πληκτρολόγηση + `tool-hints`). Δεν υπάρχει on-screen numeric box, presets
  (×2 / ×0.5), ούτε ένδειξη ότι υπάρχουν τα `C`/`R`/`N`. Ο χρήστης δεν τα ανακαλύπτει.
- **Fix sketch:** contextual ribbon tab ή status-bar options (mirror άλλων modify tools) με κουμπιά
  Copy/Reference/Non-uniform + πεδίο συντελεστή.

### 🟢 #7 — Dead code (minor)
- `systems/scale/scale-reference-calc.ts` `computeNonUniformRef` **δεν χρησιμοποιείται** (ο tool καλεί
  `computeUniformRef` ×2 ανά άξονα). Είτε κατανάλωσέ το είτε αφαίρεσέ το (dead-code ratchet).

---

## Χάρτης Υλοποίησης (επόμενη συνεδρία)

**Φάση 1 — Interactive scaling (το ζουμί· #1 + #2).** Το preview ήδη υπολογίζει τον συντελεστή· λείπει
μόνο το click-commit + σωστό ratio. Ένα SSoT `computeLiveScale` για preview & commit· cases `direct`
και `ref_new_*` στο click routing. *(1-2 αρχεία, χαμηλό ρίσκο.)*

**Φάση 2 — Ασφαλής μεταχείριση μη-υποστηριζόμενων (#3). ✅ IMPLEMENTED 2026-07-13 (υβριδικά).**
Skip-with-message για parametric BIM + πραγματικό scale για τα καθαρά γεωμετρικά (βλ. #3 παραπάνω).

**Φάση 3 — Γεωμετρική ορθότητα (#4, #5). ✅ IMPLEMENTED 2026-07-13.** Arc→**true elliptical arc** σε
non-uniform (νέος render SSoT για μερική έλλειψη)· rotated rectangle → parallelogram polyline bake.

**Φάση 4 — UI affordance (#6) + καθαρισμός (#7).** Contextual controls για C/R/N + συντελεστή·
κατανάλωση/αφαίρεση `computeNonUniformRef`.

*(Κάθε φάση ξεχωριστή συνεδρία ≤70% context· ADR-driven, ADR-348 + αυτό το ADR ενημερώνονται ίδιο commit.)*

---

## Consequences

- **Θετικά:** το πιο ορατό κενό (#1) είναι μικρό σε προσπάθεια αλλά μεγάλο σε UX — φέρνει το εργαλείο
  σε parity με AutoCAD «drag-to-scale». Η καταγραφή αποτρέπει επανα-ανακάλυψη των ίδιων gaps.
- **Ρίσκα:** το #3 (BIM) είναι σχεδιαστική απόφαση, όχι απλό bug — χρειάζεται έγκριση Giorgio πριν
  επιλεγεί skip-with-message vs partial support.
- **SSoT:** κάθε διόρθωση περνά από τα υπάρχοντα SSoT (`scale-entity-transform`, `scale-reference-calc`,
  `useScalePreview`) — καμία νέα math/command class.

## Changelog

- **2026-07-13** — **Φάση 3 IMPLEMENTED (#4 arc→true elliptical arc, #5 rotated rect→parallelogram).**
  Απόφαση Giorgio: «όπως οι μεγάλοι — Revit/ArchiCAD/Cinema4D/Figma-level, full enterprise· τα tokens/χρόνος
  δεν με προβληματίζουν» → **πραγματικό elliptical arc**, όχι polyline bake. Grep audit (CODE=SoT) αποκάλυψε
  ότι ο viewer **δεν ζωγράφιζε** μερική έλλειψη → επεκτάθηκε το scope στο rendering:
  - **NEW** `rendering/entities/shared/geometry-ellipse-utils.ts` — SSoT sampler για elliptical arc
    (`ellipsePointAt`/`tessellateEllipseArc`/`ellipseArcSegments`), convention ίδια με snap+array.
  - `EllipseRenderer.renderEllipseGeometry` τιμά `startParam/endParam` (tessellated path, Y-flip-correct·
    full ellipse μένει native). `validateEllipseEntity` επιστρέφει `startParam/endParam`.
  - `scale-entity-transform.ts`: νέο `nonUniformEllipseAxes` SSoT (κοινό circle+arc), `circleAngleToEllipseParam`
    (local-frame projection· swap + mirror-safe), `scaleArc` non-uniform → EllipseEntity με params,
    `scaleRectangle` rotated+non-uniform → closed polyline (reuse `rectangleEntityVertices`).
  - +1 test suite (`scale-entity-geometry-phase3`, 7 tests: arc uniform/no-swap/swap/endpoints + rect ×3).
    jscpd:diff clean. Co-staged ADR-040 (EllipseRenderer = entity renderer). Follow-up: #6/#7 (Φ4).
- **2026-07-13** — **Φάση 2 IMPLEMENTED (#3, υβριδικά — απόφαση Giorgio «full enterprise, όπως οι μεγάλοι»).**
  SSoT gate `isScalableEntityType()` στο `scale-entity-transform.ts` (mirror του switch). Parametric BIM +
  `stair` → skip-with-message μέσω `partitionSelection` στο `useScaleTool.ts` (mirror `filterLockedEntities`)
  + νέα i18n `scaleTool.scaleUnsupportedSkipped`/`allUnsupportedAbort` (el+en). Νέα scale transforms
  (πρώην `default:{}`): xline, ray, angle-measurement, center-mark, centerline (annotative-preserving),
  annotation-symbol + scale-bar (position-only), opening-info-tag (position+widthMm), array (recursive
  sources + per-kind spacing). +1 test suite (scale-entity-extra-types, 9 tests) + 2 partition tests.
  Fidelity: image/raster (FloorplanBackground) + array browser-verify = follow-ups (documented στο #3).
- **2026-07-13** — **Φάση 1 IMPLEMENTED** (#1 click-to-scale + #2 reference-pick). Νέο SSoT
  `computeLiveScale` στο `scale-reference-calc.ts` (moved από `useScalePreview.ts`) — ο live συντελεστής
  είναι πλέον **λόγος** ως προς το πρώτο cursor sample μετά το σημείο βάσης (`ScaleToolStore.dragRefPoint`,
  captured στο preview με guard `>1e-6`), όχι το hardcoded `dist/100`. Το preview tooltip, τα WYSIWYG
  copies **και** το click-commit μοιράζονται τον ΙΔΙΟ συντελεστή (μηδέν divergence). `handleScaleClick`:
  case `direct` → `executeScale(live, live)` (αγνοείται αν δεν έχει στηθεί drag reference)· cases
  `ref_new_x`/`ref_new_y` → νέο μήκος = `dist(base, pt)` → shared `confirmRefNewX`/`confirmRefNewY`
  (extracted, καλούνται και από typed-Enter και από click — SSoT, μηδέν clone/jscpd). Files: `ScaleToolStore.ts`,
  `scale-reference-calc.ts`, `useScalePreview.ts`, `useScaleTool.ts` + 2 test suites (15 tests). Φάσεις 2-4 εκκρεμούν.
- **2026-07-12** — Δημιουργία (findings-only). Audit του Scale tool κατόπιν αιτήματος Giorgio· 7 κενά
  εντοπισμένα στον κώδικα (verified `file:line`), ταξινομημένα, με 4-φασικό roadmap. Καμία αλλαγή κώδικα.
