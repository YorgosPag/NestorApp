# ADR-646: Scale Tool — Ανάλυση Κενών & Χάρτης Ολοκλήρωσης

**Status:** 🟢 IMPLEMENTED (Φάσεις 1+2+3 ✅ 2026-07-13· **Φάση 4 UI (#6+#7) ✅ 2026-07-13**· **Φάση 5 (perf LOD) ✅ 2026-07-13**· **Φάση 6 (perf definitive — matrix ghost) ✅ 2026-07-13**)
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

### 🟡 #6 — Καμία οπτική βοήθεια UI — ✅ ΔΙΟΡΘΩΘΗΚΕ (2026-07-13, Φάση 4, contextual ribbon tab)
- **Σύμπτωμα:** μόνο command-line στιλ (πληκτρολόγηση + `tool-hints`). Δεν υπήρχε on-screen numeric box,
  presets (×2 / ×0.5), ούτε ένδειξη ότι υπάρχουν τα `C`/`R`/`N`. Ο χρήστης δεν τα ανακάλυπτε.
- **Απόφαση (SSoT):** contextual **ribbon tab** (mirror `xline`/`array` — το `StatusBar.tsx` είναι legacy
  hardcoded-strings/div-soup, ΟΧΙ το σωστό surface). Το scale είναι modal operation → **κατέχει** το ribbon
  context όσο είναι ενεργό (mirror του animation tool: early priority πριν το selection resolution, αλλιώς
  η επιλογή — π.χ. γραμμή → «Στυλ Γραμμής» — θα σκίαζε το scale tab).
- **Υλοποίηση:** NEW `ui/ribbon/data/contextual-scale-tool-tab.ts` (Copy toggle / Non-uniform toggle /
  Reference action + editable numeric factor combobox με presets), `hooks/bridge/scale-tool-command-keys.ts`,
  `hooks/useRibbonScaleToolBridge.ts` (self-contained, subscribe `ScaleToolStore`). Το factor field κάνει
  **full commit** μέσω hook-registered **commit-sink** (`ScaleToolStore.setCommitSink`/`commitUniformScale`
  ← `executeScale`) → ίδιο μονοπάτι με typed-Enter. Toggles/action = pure store writes (mirror keyboard
  `C`/`N`/`R`, incl. sub-phase transitions· pre-start non-uniform armed → τιμάται στο base-point pick).
  Wiring: trigger barrel + `RIBBON_CONTEXTUAL_TABS` + `useActiveContextualTrigger` early return +
  dispatch/toggle/action route tables + `useDxfViewerRibbon` instantiation. i18n el+en. +8 bridge tests.

### 🟢 #7 — Dead code (minor) — ✅ ΔΙΟΡΘΩΘΗΚΕ (2026-07-13, Φάση 4, removed)
- `systems/scale/scale-reference-calc.ts` `computeNonUniformRef` **αφαιρέθηκε** (grep = 0 call sites). Το FSM
  συλλέγει κάθε άξονα διαδοχικά (`ref_*_x` → `confirmRefNewX`, μετά `ref_*_y` → `confirmRefNewY`) καλώντας
  `computeUniformRef` ×2 → ένα combined 6-point variant δεν θα προσεγγιζόταν ποτέ. Doc-comment στη θέση του.

### 🔴 #8 — Freeze σε scale ΠΟΛΛΩΝ οντοτήτων (perf) — ✅ ΜΕΡΙΚΩΣ ΔΙΟΡΘΩΘΗΚΕ (2026-07-13, LOD/cap· matrix-ghost εκκρεμεί)
- **Σύμπτωμα (Giorgio 2026-07-13):** επιλογή πολλών οντοτήτων → κλιμάκωση → **ο browser κολλάει** κατά το drag.
- **Ρίζα (CODE=SoT):** `hooks/tools/useScalePreview.ts` `renderCopies` — ανά **frame** του drag κάνει
  **full `scaleEntity` + `drawRealEntityPreview` (model build + style resolve + composite) για ΚΑΘΕ**
  επιλεγμένη οντότητα. Κόστος = O(N) βαριά renders/frame → main thread block (η ίδια O(N)-ανά-frame παγίδα
  που το ADR-040 απαγορεύει στον κύριο καμβά· το scale ghost παραβίαζε τον δικό του κανόνα). Το **commit**
  είναι O(N) μία φορά (ανεκτό) — ο ένοχος είναι το preview.
- **Προσδοκία (μεγάλοι):** κανείς δεν ξαναϋπολογίζει vertices ανά frame. Figma/Illustrator/PowerPoint →
  **ΕΝΑΣ affine matrix** πάνω σε cached ghost (O(1)/frame), bake στο release. AutoCAD/BricsCAD → **απλοποιημένο
  drag preview** για τεράστιες επιλογές (sample + extent), regen στο commit.
- **Υλοποίηση Φάση 5 (interim, low-risk — «και τα δύο σταδιακά», Giorgio):** νέο pure SSoT
  `systems/scale/scale-preview-lod.ts`. Πάνω από `SCALE_PREVIEW_FULL_FIDELITY_MAX`=400 το preview
  γίνεται **stride-sampled subset (400) full-fidelity + ΕΝΑ scaled union-bbox** (χρυσό closed polyline
  μέσω του ΙΔΙΟΥ real-preview path — μηδέν νέα world→screen math). Το union bbox υπολογίζεται στην
  **unscaled** επιλογή, **cached ανά drag** (`useRef` keyed by selection identity) → μόνο O(1) scaling/frame.
  Cost: O(cap)/frame αντί O(N). Commit αμετάβλητο (ψήνει τα πάντα). +9 tests, jscpd clean.
- **Φάση 6 (definitive) ✅ IMPLEMENTED 2026-07-13:** ο πραγματικός big-player fix = **matrix ghost**.
  Render το ghost της επιλογής **ΜΙΑ φορά** σε offscreen raster στην αρχή του drag, μετά **ΕΝΑΣ** composed
  affine matrix (`ctx.transform` + `drawImage`) ανά frame → **O(1)/frame**, ανεξάρτητο πλήθους. Ο matrix
  ξαναϋπολογίζεται από το **live** `getImmediateTransform()` → world-locked σε wheel-zoom/pan mid-drag·
  non-uniform (sx≠sy) → circle→ellipse δωρεάν. Opt-in `matrixGhost` capability στο **shared skeleton**
  `use-transform-ghost-preview.ts` (έτοιμο για move/rotate). Το Φ.5 LOD μένει **fallback** για oversize
  raster (bbox > cap). Bake αμετάβλητο (commit ψήνει τα πάντα). Reuse: `computeUnionBBox` (Φ.5),
  `drawRealEntityPreview` (one-time capture), `BimPreviewRenderer`· μίμηση `DxfBackdropCache` (ADR-516).

---

## Χάρτης Υλοποίησης (επόμενη συνεδρία)

**Φάση 1 — Interactive scaling (το ζουμί· #1 + #2).** Το preview ήδη υπολογίζει τον συντελεστή· λείπει
μόνο το click-commit + σωστό ratio. Ένα SSoT `computeLiveScale` για preview & commit· cases `direct`
και `ref_new_*` στο click routing. *(1-2 αρχεία, χαμηλό ρίσκο.)*

**Φάση 2 — Ασφαλής μεταχείριση μη-υποστηριζόμενων (#3). ✅ IMPLEMENTED 2026-07-13 (υβριδικά).**
Skip-with-message για parametric BIM + πραγματικό scale για τα καθαρά γεωμετρικά (βλ. #3 παραπάνω).

**Φάση 3 — Γεωμετρική ορθότητα (#4, #5). ✅ IMPLEMENTED 2026-07-13.** Arc→**true elliptical arc** σε
non-uniform (νέος render SSoT για μερική έλλειψη)· rotated rectangle → parallelogram polyline bake.

**Φάση 4 — UI affordance (#6) + καθαρισμός (#7). ✅ IMPLEMENTED 2026-07-13.** Contextual **ribbon tab**
«Κλιμάκωση» (Copy/Non-uniform toggles + Reference action + editable factor combobox, full-commit μέσω
commit-sink)· `computeNonUniformRef` αφαιρέθηκε. *(3 new + ~11 wiring αρχεία, 1 domain· ribbon SSoT.)*

**Φάση 5 — Perf LOD/cap (#8). ✅ IMPLEMENTED 2026-07-13.** Bounded drag preview (sample + extent box)
πάνω από το cap· `scale-preview-lod.ts` SSoT. *(1 new + 1 mod + 1 test· χαμηλό ρίσκο.)*

**Φάση 6 — Perf definitive: matrix ghost (#8). ✅ IMPLEMENTED 2026-07-13.** Cached offscreen ghost +
single composed affine (O(1)/frame) στο shared `use-transform-ghost-preview.ts` (opt-in `matrixGhost`)·
νέα SSoT `transform-ghost-matrix.ts` (pure) + `transform-ghost-matrix-cache.ts` (DOM cache class). Wired
για SCALE· έτοιμο για move/rotate. *(2 new + 2 mod + 1 test· perf-critical, ADR-040/625· Plan Mode.)*

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

- **2026-07-13** — **Φάση 6 IMPLEMENTED (#8 perf — ΟΡΙΣΤΙΚΟ fix για freeze σε scale χιλιάδων οντοτήτων).**
  Το Φ.5 LOD ανακούφισε αλλά ΠΑΛΙ κολλούσε σε ακραία κλίμακα (Giorgio). Definitive big-player fix
  (**Figma/Illustrator/AutoCAD/Revit/C4D**): render το ghost της επιλογής **ΜΙΑ φορά** σε offscreen raster
  στην αρχή του drag, μετά **ΕΝΑΣ** composed affine matrix (`ctx.transform` + `drawImage`) ανά frame →
  **O(1)/frame**. Ο matrix = `compose(worldToScreen(live) ∘ scaleAboutBase(world) ∘ offscreenPx→world)`·
  όλα affine αφού `CoordinateTransforms.worldToScreen` είναι affine → world-locked σε wheel-zoom/pan
  mid-drag (live `getImmediateTransform()`), non-uniform → circle→ellipse δωρεάν. **NEW** `hooks/tools/
  transform-ghost-matrix.ts` (pure affine SSoT: `composeAffine`/`scaleAboutBaseWorldAffine`/
  `worldToScreenAffine`/`offscreenToWorldAffine`/`captureRectFromBBox`/`buildCaptureTransform`· 11 jest,
  incl. world-lock invariant) + `transform-ghost-matrix-cache.ts` (DOM `TransformGhostMatrixCache` class —
  mirrors ADR-516 `DxfBackdropCache` arm/capture/blit — + `MatrixGhostConfig` opt-in + `runMatrixGhost`).
  **MOD** `use-transform-ghost-preview.ts` (opt-in `matrixGhost` capability: render-once ref + blit,
  fallback σε `renderCopies` όταν λείπει/oversize) + `useScalePreview.ts` (`getWorldAffine =
  scaleAboutBaseWorldAffine(base, live, live)`· `captureDragRef` extracted SSoT — shared με το LOD
  fallback, μηδέν clone). **Reuse:** `computeUnionBBox` (Φ.5), `drawRealEntityPreview` (one-time capture),
  `BimPreviewRenderer`, το ΕΝΑ rAF harness (ADR-398/625 — **κανένα** δεύτερο loop). **Φ.5 LOD** = fallback
  για oversize raster (bbox × scale0 > `MATRIX_GHOST_MAX_CSS`=4096 CSS px). Honest tradeoff: το raster
  κόβεται στο drag-start zoom → ήπιο blur + lineweight scale στο ghost σε ακραίο zoom-in (crisp στο commit·
  Figma/Revit-grade). 52 jest πράσινα, jscpd:diff clean. ΟΧΙ tsc (N.17). _(Shared tree: surgical edits μόνο.)_
- **2026-07-13** — **Φάση 4 IMPLEMENTED (#6 UI affordance + #7 dead-code).** Contextual **ribbon tab**
  «Κλιμάκωση» (SSoT surface, mirror `xline`/`array`· το `StatusBar.tsx` legacy = απορρίφθηκε). **NEW**
  `ui/ribbon/data/contextual-scale-tool-tab.ts` (Copy/Non-uniform toggles + Reference action + editable
  numeric factor combobox με ×2/×0.5/×-1 presets), `ui/ribbon/hooks/bridge/scale-tool-command-keys.ts`,
  `ui/ribbon/hooks/useRibbonScaleToolBridge.ts` (self-contained, subscribe `ScaleToolStore`). Το factor
  field κάνει **full commit** μέσω hook-registered **commit-sink** (`ScaleToolStore.setCommitSink`/
  `commitUniformScale` ← `executeScale` στο `useScaleTool`, module-level εκτός reactive state → μηδέν
  render churn ADR-040) → ίδιο μονοπάτι με typed-Enter. Toggles/action = pure store writes (mirror keyboard
  `C`/`N`/`R` + sub-phase transitions· pre-start non-uniform armed → τιμάται στο base-point pick του
  `handleScaleClick`). Το scale είναι **modal** → early-priority return στο `useActiveContextualTrigger`
  (mirror animation· αλλιώς η επιλογή-στόχος σκίαζε το tab). Wiring: `contextual-triggers` barrel +
  `RIBBON_CONTEXTUAL_TABS` + dispatch/toggle/action route tables (`useRibbonCommands*`) + `useDxfViewerRibbon`
  instantiation. i18n el+en (tab/panels/commands). **#7:** `computeNonUniformRef` αφαιρέθηκε (grep 0 call
  sites· FSM = per-axis `computeUniformRef` ×2). +8 bridge tests· dispatch coverage 32→33 routes· jscpd:diff
  clean. ΟΧΙ tsc (N.17). _(Shared tree: co-authored ADR-646 με τον Φ5/Φ6 agent — surgical edits μόνο.)_
- **2026-07-13** — **Φάση 5 IMPLEMENTED (#8 perf — freeze σε scale πολλών οντοτήτων).** Root cause (CODE=SoT):
  `useScalePreview.renderCopies` έκανε full `scaleEntity` + `drawRealEntityPreview` για ΚΑΘΕ επιλεγμένη
  οντότητα ανά **frame** → O(N) βαριά renders/frame → main-thread freeze (η O(N)-ανά-frame παγίδα του ADR-040).
  Απόφαση Giorgio: «και τα δύο σταδιακά» → interim LOD/cap τώρα, matrix-ghost (Φ.6) μετά. **NEW** pure SSoT
  `systems/scale/scale-preview-lod.ts` (`resolveScalePreviewLod`/`sampleIds`/`computeUnionBBox`/
  `scaleBBoxAboutBase`/`buildExtentBoxEntity`). Πάνω από cap=400 → stride-sampled 400 full-fidelity + ΕΝΑ
  scaled union-bbox (gold closed polyline μέσω του ίδιου real-preview path)· union bbox cached ανά drag
  (`useRef` keyed by selection identity) → O(1) scaling/frame. Commit αμετάβλητο. +1 test (9 tests, 23
  suites/179 GREEN)· jscpd:diff clean. Co-staged ADR-040 (`useScalePreview` = preview-canvas file, CHECK 6D).
  **Εκκρεμεί Φ.6:** matrix ghost στο shared skeleton (definitive, O(1)/frame, move/rotate/scale). ΟΧΙ tsc (N.17).
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
