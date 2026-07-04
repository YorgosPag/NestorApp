# ADR-572 — Alignment Traces (ίχνη ευθυγράμμισης) SSoT Audit & Centralization Plan

> **Status:** 🟢 IMPLEMENTED (Γ2 + Γ1) / 🟦 RESOLVED-NO-CHANGE (Γ3) — χαρτογράφηση ΟΛΩΝ των «ιχνών
> ευθυγράμμισης» (γραμμές **και** κείμενα) του DXF Viewer + κλείσιμο των μικρο-αποκλίσεων.
> **Γ2** (locale γωνίας) & **Γ1** (leader style SSoT) υλοποιήθηκαν· **Γ3** (2D↔3D χρώμα) αξιολογήθηκε
> και **δεν** ενοποιήθηκε συνειδητά (βλ. §4 Γ3 — per-context tuning + zero-regression).
> **Date:** 2026-07-04
> **Subapp:** `src/subapps/dxf-viewer` (https://nestorconstruct.gr/dxf/viewer)
> **Author:** Giorgio + agent
> **Related:** ADR-357 (Object Snap Tracking), ADR-562 Φ9 (AutoAlign alignment traces σε δημιουργία/λαβές/
> μετακίνηση διάστασης), ADR-397 (rotation consumer), ADR-363/507/543 (grip ghost readouts),
> ADR-560 (body-drag local resolve), ADR-040 (canvas performance CHECK 6D), ADR-279/280 (i18n reachability).

---

## 1. Πλαίσιο / Problem Statement

Ο Giorgio ζήτησε βαθιά χαρτογράφηση **όλων** των ιχνών ευθυγράμμισης (alignment / object-snap tracking
traces) στον DXF Viewer — **τόσο τις γραμμές όσο και τα κείμενα/ετικέτες** — και να διαπιστωθεί αν είναι
κεντρικοποιημένα (SSoT) ή σκόρπια, ώστε να αποφασιστεί αν χρειάζεται ενοποίηση.

Ως «ίχνη ευθυγράμμισης» ορίζουμε τις εφήμερες οπτικές βοήθειες που εμφανίζονται **κατά την αλληλεπίδραση**
(σχεδίαση, σύρσιμο λαβής, μετακίνηση, περιστροφή) όταν ο κέρσορας/σημείο ευθυγραμμίζεται με υπάρχοντα
σημεία ή άξονες:
- **Λευκές/πράσινες διακεκομμένες γραμμές** ευθυγράμμισης (H/V/polar paths + intersection halos) — AutoAlign / OSNAP tracking.
- **Πορτοκαλί POLAR ακτίνα** (γωνιακή στοίχιση).
- **Ετικέτες** πάνω/δίπλα στα ίχνη: απόσταση (π.χ. «1,25 m») + γωνία (π.χ. «45°»).

**Απάντηση σε μία γραμμή:** Το σύστημα είναι **σχεδόν υποδειγματικά κεντρικοποιημένο**. Υπάρχει **ΕΝΑΣ**
μαθηματικός πυρήνας, **ΕΝΑΣ** store για τα action-family traces, κοινοί low-level painters (μοιρασμένοι
ακόμη και μεταξύ 2D και 3D viewport), και **ΕΝΑΣ** formatter μήκους / γωνίας. Εντοπίστηκαν **λίγες,
οριοθετημένες αποκλίσεις** — καμία δεν είναι παράλληλη μηχανή γεωμετρίας ή rendering.

**Μεθοδολογία:** 3 παράλληλοι Explore agents (SSoT core / σκόρπιες γραμμές / κείμενα-ετικέτες) πάνω σε
`src/subapps/dxf-viewer`, + χειροκίνητη επιβεβαίωση των production ευρημάτων (γρ.-by-γρ. read).

---

## 2. Έρευνα — Ο κεντρικός εγκέφαλος (SSoT)

### 2.1 Γραμμές — αρχιτεκτονική (ADR-357 + ADR-562 Φ9)

| Στρώμα | Αρχείο | Ρόλος |
|---|---|---|
| **Πυρήνας γεωμετρίας** | `systems/tracking/tracking-resolver.ts` | `resolveTrackingSnap` — H/V + polar paths, intersections/projections, clean-corner. Καθαρή γεωμετρία, μηδέν React/store. |
| | `systems/tracking/ambient-tracking-compose.ts` | `composeTrackingSnap` — acquired ⊕ ambient anchors → `resolveTrackingSnap` + adaptive quantize. **Το ένα engine** που καλούν όλοι. |
| **Wrapper #1 (hover/rotation)** | `systems/tracking/resolve-alignment-tracking.ts` | `resolveAlignmentTracking` — drawing hover + rotation. |
| **Wrapper #2 (actions)** | `hooks/dimensions/dim-alignment-tracking.ts` | `resolveDimAlignmentTracking` / `resolveActionAlignmentTracking` — dim create / grip / body-drag / 2-click MOVE, με ρητά ref-points. |
| **Wrapper #3 (rotation)** | `hooks/tools/rotation-tracking-overlay.ts` | `resolveRotationTracking` — pivot ως ref + POLAR/ORTHO angle-lock πριν το alignment. |
| **Anchor sources** | `hooks/dimensions/useDimensionGrips.ts` (`getDimGripAlignmentAnchors`), `systems/line/line-grips.ts` (`getLineGripAlignmentAnchors`), `systems/tracking/ambient-alignment-source.ts` (`collectAmbientAlignmentAnchors`) | Τροφοδοτούν anchors ανά περίπτωση (grip-kind / ambient BIM). |
| **Stores (zero-React)** | `systems/cursor/GripAlignmentTrackingStore.ts` | **ΕΝΑΣ** store — ενοποιήθηκε από παλιό dim-only `DimAlignmentTrackingStore` (2026-07-04). |
| | `systems/tracking/TrackingPointStore.ts` | Acquired points (hover 1s / Shift-click, FIFO max 7, decay). |
| | `systems/tracking/ambient-alignment-config-store.ts` | AutoAlign toggle/tunables (localStorage). |
| | `systems/constraints/polar-tracking-store.ts` | POLAR state. |
| **Lifecycle-clear** | `systems/cursor/GripDragStore.ts`, `systems/drag/EntityBodyDragStore.ts` | `clear*()` → `clearGripAlignmentTracking()` (ίχνη δεν «κρέμονται» σε release/ESC). |
| **Low-level painters** | `canvas-v2/preview-canvas/tracking-paint.ts` | `paintTrackingMarkers` / `paintAlignmentPaths` (dashed) / `paintIntersections` / `paintTooltip`. |
| | `canvas-v2/preview-canvas/polar-tracking-line-paint.ts` | `paintPolarTrackingLine` (πορτοκαλί). |
| | `canvas-v2/preview-canvas/alignment-guide-paint.ts` | `paintAlignmentGuide` (παρειά κολόνας). |
| **Orchestration painters** | `paintGripAlignmentTracking` / `paintDimActionTracking` (`dim-alignment-tracking.ts`), `paintRotationTracking` (`rotation-tracking-overlay.ts`) | Thin — συνθέτουν τους low-level painters πάνω σε `ComposedTracking`. |
| **Στυλ SSoT** | `canvas-v2/preview-canvas/overlay-line-style.ts` | `OVERLAY_LINE_COLORS` + dash — μία οικογένεια στυλ για όλα τα 2D overlay lines. |

**Consumers (ΟΛΟΙ thin wrappers, κανένας δικό του engine):** `useGripGhostPreview`, `useEntityBodyDragPreview`,
`useDimGripGhostPreview`, `useMovePreview`, `useMoveTool`, `drawing-hover-handler` (`processDrawingHover`),
`systems/cursor/mouse-handler-move.ts` (γράφει store μία φορά/frame), `systems/cursor/mouse-handler-up.ts`
(commit parity + clear).

**Tolerances (ADR-562 Φ9.4):** `DEFAULT_ALIGN_TOLERANCE_PX = 3` (OSNAP hover aperture, δημιουργία),
`ACTION_ALIGN_TOLERANCE_PX = 8` (interactive action drags — grip/body/MOVE· ευρύτερο «tracking pull»),
και τα δύο στο `dim-alignment-tracking.ts`.

**3D parity (αξιοσημείωτο θετικό):** `bim-3d/viewport/tracking/tracking-3d-store.ts` +
`bim-3d/viewport/overlay-dispatch/use-tracking-pass.ts` **ξαναχρησιμοποιούν τους ΙΔΙΟΥΣ 2D painters**
(`paintAlignmentPaths` / `paintIntersections` / `paintTrackingMarkers` / `paintTooltip`) μέσω camera
projector → 2D και 3D μοιράζονται τον ίδιο render SSoT (τροφοδοσία: `bim-3d/placement/use-bim3d-wall-placement.ts`).

### 2.2 Κείμενα / ετικέτες — αρχιτεκτονική

| Στρώμα | Αρχείο | Ρόλος |
|---|---|---|
| **Text painter SSoT** | `canvas-v2/preview-canvas/overlay-text-style.ts` | `drawOverlayLabel` = **το ΜΟΝΟ** `ctx.fillText` για όλα τα 2D overlay labels (font `OVERLAY_TEXT_PX=11`, anti-collision `CURSOR_LABEL_SLOTS`). Κανένα σκόρπιο `fillText` σε άλλον tracking painter. |
| **Formatter μήκους** | `config/display-length-format.ts` | `formatLengthForDisplay(mm)` → «9,75 m» (mm→display unit, locale, μονάδα). **SSoT μήκους** σε όλα τα tracking labels· η μονάδα «mm/m» έρχεται από `DISPLAY_UNIT_LABELS` (ποτέ hardcoded). |
| **Formatter γωνίας** | `rendering/entities/shared/distance-label-utils.ts` → `formatting/FormatterRegistry.ts` | `formatAngleLocale(deg, decimals)` → «45,5°» (locale-aware· το `°` ζει στο `templates.angle` του registry). |
| **POLAR label** | `systems/constraints/polar-utils.ts` | `formatPolarLabel(angle, distMm)` — πορτοκαλί POLAR tooltip. |
| **3D text→texture** | `bim-3d/dimensions/Dimension3DRenderer.ts` | `createLabelTexture` (`strokeText`/`fillText` → sprite) — SSoT για όλα τα 3D overlay labels (`TempSnapLabelOverlay`, `TempMoveReadoutOverlay`), τροφοδοτούμενο από `bim/labels/move-readout.ts`. |

---

## 3. Ευρήματα — οι αποκλίσεις (ΟΧΙ πλήρως κεντρικοποιημένα)

Ταξινομημένες κατά αξία/κίνδυνο. **Καμία δεν είναι παράλληλη μηχανή** — είναι μικρο-αποκλίσεις στυλ/format.

### Γ1 — [PRODUCTION, μικρό] Bespoke dashed leaders
**Αρχείο:** `hooks/tools/grip-ghost-preview-draw-helpers.ts` (γρ. 68-104, **επιβεβαιωμένο**).
`drawDashedSegment` (rotate-reference guides `rotateRefLine`/`rotateAlignLine` + hot-grip rubber-band) και
`drawMoveReadoutLeader` (move-distance leader) ζωγραφίζουν inline `ctx.setLineDash([...])` με **hardcoded**
`HOT_GRIP_RUBBER_BAND_DASH = [6,4]` και χρώματα (`GHOST_DEFAULTS.color`, `MOVE_READOUT_LEADER_COLOR =
'rgba(255,255,255,0.5)'`) → **δεν** περνούν από `overlay-line-style.ts` / `OVERLAY_LINE_COLORS`. Είναι
οπτικά «guide/tracking» γραμμές με bespoke υλοποίηση παράλληλα στο SSoT.

### Γ2 — [PRODUCTION, μικρό] Inline `°` στο angle-μέρος των tracking labels
**Αρχεία/γραμμές (επιβεβαιωμένα):** χτίζουν το label ως `` `${angle.toFixed(0)}° / ${formatLengthForDisplay(...)}` ``
— το **μήκος**-μέρος είναι ήδη SSoT, αλλά το **angle**-μέρος γράφεται inline με `toFixed` + literal `'°'` →
**δεν** καλεί `formatAngleLocale`/`FormatterRegistry` → **λάθος locale decimal separator** (πάντα `.`, όχι `,`),
σε αντίθεση με `direction-arc-paint.ts` / `wall-hud-paint.ts` / `column-hud-paint.ts` που καλούν σωστά `formatAngleLocale`.

**Action-family (4 σημεία — αρχική λίστα handoff):** `paintDimActionTracking` (`dim-alignment-tracking.ts`),
`paintGripAlignmentTracking` (`dim-alignment-tracking.ts`), `paintRotationTracking` (`rotation-tracking-overlay.ts`),
`formatPolarLabel` (`systems/constraints/polar-utils.ts`).

**⚠️ Creation-family (4 σημεία — εύρημα SSoT audit κατά την υλοποίηση, Giorgio ενέκρινε επέκταση):** τα ΙΔΙΑ
alignment-trace labels στη *δημιουργία* (ίδιος painter `drawTrackingAlignment`/`drawPolarTrackingLine`, ίδιο bug):
`drawing-hover-handler.ts:145` (dim tracking), `drawing-hover-overlays.ts:232` (ambient tracking) & `:155`
(POLAR bearing), `bim-3d/placement/use-bim3d-wall-placement.ts:154` (3D wall placement). Χωρίς αυτά, στα el
η γωνία θα ήταν «45.5°» στη δημιουργία αλλά «45,5°» στο grip-drag — ακριβώς η **ασυνέπεια** που το ADR-572
θέλει να εξαλείψει. Revit/AutoCAD/Figma: locale-correct γωνία **παντού** (δημιουργία & επεξεργασία).

### Γ3 — [3D, μεσαίο] Ασύνδετα 3D color/dash tokens
**Αρχείο:** `bim-3d/placement/TempAlignmentLineOverlay.ts` (Three.js `LineDashedMaterial`, dashed μπλε
γραμμή flush-wall). Η **γεωμετρία** πηγάζει σωστά από SSoT (`WallFaceSnapEngine.alignmentRef`), αλλά το
**χρώμα/dash** είναι δικά του constants στο `bim-3d/gizmo/gizmo-constants.ts` (`ALIGNMENT_LINE_COLOR =
0x4a90d9`, `ALIGNMENT_LINE_DASH = 0.12`), ασύνδετα από `OVERLAY_LINE_COLORS.drawingGuide` (2D). Το paint
pipeline είναι αναγκαστικά ξεχωριστό (WebGL scene graph vs Canvas2D overlay), αλλά τα **color tokens**
θα μπορούσαν να μοιραστούν — το `use-tracking-pass.ts` απέδειξε ότι το 3D μπορεί να ευθυγραμμιστεί με το 2D SSoT.

### Γ4 — [DEBUG-only, χαμηλός κίνδυνος] Παράλληλες inline γραμμές
`debug/CursorSnapAlignmentDebugOverlay.ts` (δική του dashed distance line σε RAF loop, `window.__cursorSnapAlignmentDebug`),
`debug/OriginMarkersDebugOverlay.ts`, `debug/CalibrationGridRenderer.ts`. Δεν τρέχουν σε production χωρίς
ρητό `window.__*` flag → χαμηλή προτεραιότητα, δεν προτείνεται fix (by-design debug tools).

### Γ5 — [ΔΙΑΦΟΡΕΤΙΚΟ feature, ΟΧΙ duplicate] — προς αποσαφήνιση, όχι fix
- `systems/axis-cut/axis-cut-line-renderer.ts` (`drawSectionLine`, `SECTION_LINE_DASH=[10,6]`) — BIM section markers.
- `systems/guides/*` (`GuideRenderer` + markers/annotations renderers· state hooks `useGuideState`/`useGuideActions`) —
  μόνιμοι Revit-style reference planes/grids με δικά τους `GUIDE_COLORS`/`DEFAULT_GUIDE_STYLE`.
Πιάνονται από τα search patterns («dashed», «guide», «reference line») αλλά είναι **νόμιμα ξεχωριστά
features** (μόνιμα markers/guides vs εφήμερα snap-tracking ίχνη) → **δεν** χρειάζονται ενοποίηση.

### Παρατήρηση αρχιτεκτονικής (όχι απόκλιση) — body-drag mixed pattern
Το `useEntityBodyDragPreview.ts` σκόπιμα κάνει **local resolve per-frame** (`resolveActionAlignmentTracking`
απευθείας στο draw, ADR-560 «μηδέν timing-skew») αντί store-read, ενώ το `mouse-handler-move` **επίσης**
γεμίζει το `GripAlignmentTrackingStore` για body-drag. Και τα δύο καλούν τον **ίδιο** resolver → όχι λογικό
duplicate, αλλά ελαφρά διπλή-εγγραφή/ανάγνωση — αξίζει προσοχή αν συνεχιστεί refactor (όχι σε αυτό το scope).

---

## 4. Σχέδιο κεντρικοποίησης (πώς θα προχωρήσει — μετά τη συζήτηση Giorgio)

> **Boy Scout / N.0.2.** Τα Γ1-Γ3 είναι μικρές, στοχευμένες ενοποιήσεις. **Καμία δεν αλλάζει συμπεριφορά** —
> μόνο ενοποιεί το «από πού έρχεται» το dash/χρώμα/format. Προτεραιότητα: Γ2 (locale-correctness, πραγματικό
> bug για el) > Γ1 (style SSoT) > Γ3 (3D token sharing).

### ✅ Γ2 (IMPLEMENTED 2026-07-04 — locale bug + label composer SSoT) — 8 σημεία (action + creation family)
- Αντικατάσταση των inline `` `${angle.toFixed(0)}°` `` με τον locale-aware SSoT.
- **🆕 Label composer SSoT (2ος γύρος — SSoT audit Giorgio):** το SSoT audit αποκάλυψε ότι η **σύνθεση** του label
  `` `${formatAngleLocale(angle,dec)} / ${formatLengthForDisplay(dist)}` `` ήταν **διπλότυπη σε 8 σημεία** (προϋπήρχε
  inline). Δημιουργήθηκε **ΕΝΑΣ** composer `formatSnapTrackingLabel(angleDeg, distanceMm, angleDecimals=0)` στο
  `rendering/entities/shared/distance-label-utils.ts` (το δηλωμένο SSoT «eliminates duplicate implementations», σπίτι
  του `formatAngleLocale`). **Και τα 8 sites** καλούν πλέον τον composer· το `formatPolarLabel` έγινε thin wrapper
  (`formatSnapTrackingLabel(angle, mm, 1)`). Καθαρίστηκαν όλα τα πλέον-αχρησιμοποίητα imports (`formatAngleLocale`/
  `formatLengthForDisplay`) στα 6 consumer αρχεία (εκτός `drawing-hover-overlays` που κρατά `formatLengthForDisplay`).
- **Decimals:** alignment/tracking → **0** (default composer)· POLAR → **1**. Μηδέν visual regression πέρα από τον
  σωστό locale separator.
- **Υλοποιημένα αρχεία (8 sites):** `dim-alignment-tracking.ts` (×2), `rotation-tracking-overlay.ts`, `polar-utils.ts`
  (action) + `drawing-hover-handler.ts`, `drawing-hover-overlays.ts` (×2), `use-bim3d-wall-placement.ts` (creation) →
  όλα μέσω του `formatSnapTrackingLabel`.
- **Test:** `polar-utils.test.ts` — assertions κλειδώνουν το `formatAngleLocale` delegation + νέα `describe` για τον
  composer (default 0 decimals, override 1, `formatPolarLabel === composer`). **7 suites / 63 tests GREEN.**
- **Αποτέλεσμα:** locale-correct γωνία **παντού** + **ΜΙΑ** πηγή για ολόκληρη τη σύνθεση του tracking label.

### ✅ Γ1 (IMPLEMENTED 2026-07-04 — style SSoT) — `grip-ghost-preview-draw-helpers.ts` + `overlay-line-style.ts`
- Οι leaders είναι **διακριτή αλλά συγγενής** οικογένεια overlay-line (σκόπιμα «discreet», ADR-363): dash `[6,4]` +
  width `1`, διαφορετική από τα guide lines (dash `[8,5]`, width `0.5`). Λύση = sibling **leader-family** στο ΙΔΙΟ
  SSoT (`overlay-line-style.ts`), ΟΧΙ visual ενοποίηση με τα guide lines (θα ήταν regression).
- **Προστέθηκαν στο `overlay-line-style.ts`:** `OVERLAY_LEADER_DASH=[6,4]`, `OVERLAY_LEADER_WIDTH_PX=1`,
  `OVERLAY_LINE_COLORS.moveLeader='rgba(255,255,255,0.5)'` (το πρώην bespoke ημιδιαφανές λευκό → named token),
  και `applyOverlayLeaderStyle(ctx, color)` (sibling του `applyOverlayLineStyle`).
- **`grip-ghost-preview-draw-helpers.ts`:** αφαιρέθηκαν τα local `HOT_GRIP_RUBBER_BAND_DASH` / `MOVE_READOUT_LEADER_COLOR`·
  `drawDashedSegment` → `applyOverlayLeaderStyle(ctx, GHOST_DEFAULTS.color)` (rubber-band «κουμπώνει» στο ghost →
  χρώμα derived semantic)· `drawMoveReadoutLeader` → `applyOverlayLeaderStyle(ctx, OVERLAY_LINE_COLORS.moveLeader)`.
- **DRY core (SSoT audit Giorgio):** τα δύο public helpers (`applyOverlayLineStyle` + `applyOverlayLeaderStyle`) είχαν
  ταυτόσημα bodies (strokeStyle/width/dash/cap) → εξήχθη private `applyOverlayStroke(ctx, color, widthPx, dash)` που
  και οι δύο καλούν· μηδέν διπλότυπο stroke-state κώδικα.
- **Μηδέν visual regression:** ίδιο dash `[6,4]`, ίδιο width `1`, ίδια χρώματα· ο helper προσθέτει μόνο `lineCap='butt'`
  (canvas default → no-op). **Ρίσκο:** χαμηλό· αγγίζει `hooks/tools/` preview draw → ADR-040 CHECK 6D (staged ADR).

### 🟦 Γ3 (RESOLVED 2026-07-04 — ΔΕΝ ενοποιήθηκε, συνειδητή απόφαση) — `TempAlignmentLineOverlay.ts` + `gizmo-constants.ts`
**Απόφαση: ΟΧΙ coupling.** Αξιολογήθηκε πλήρως — η ενοποίηση απορρίπτεται με enterprise/Revit-grade σκεπτικό:
1. **Zero visual regression (ΑΠΑΡΑΒΑΤΟ):** το 3D είναι μπλε `0x4a90d9` («Revit reference blue»)· **κανένα** 2D token
   δεν είναι μπλε (`alignment`=γκρι #CCCCCC, `drawingGuide`=πορτοκαλί #FF9800, `listeningDim`=κυανό #29B6F6). Κάθε
   πραγματικό «κοινό token» ή αλλάζει το 3D χρώμα (regression) ή φτιάχνει fake token που το χρησιμοποιεί μόνο το 3D.
2. **Οι μεγάλοι παίκτες δεν το προτείνουν:** Revit/AutoCAD/SketchUp/C4D κάνουν **per-context tuning** των alignment
   χρωμάτων (2D μαύρος καμβάς vs 3D shaded σκηνή). Το «reference blue» είναι ρητά distinct από το κυανό snap glyph.
   Οδηγία Giorgio: «αν οι μεγάλοι παίκτες δεν το προτείνουν → ακολούθησε τη δική τους πρακτική» → κράτα το ξεχωριστό.
3. **Ασύμβατες μονάδες dash:** 3D = world metres (`0.12`/`0.08`), 2D = screen px (`[8,5]`) → αδύνατο κοινό dash.
4. **Ήδη κεντρικοποιημένα:** τα 3D tokens ζουν στο `gizmo-constants.ts` (3D constants SSoT) — όχι σκόρπια magic numbers.
- **Code change: καμία** (και multi-agent safety: το `gizmo-constants.ts` ήταν ήδη modified από άλλον agent).

### Εκτός scope (τεκμηρίωση μόνο)
- Γ4 (debug tools) — δεν αλλάζουν.
- Γ5 (axis-cut / guides) — νόμιμα ξεχωριστά features, δεν ενοποιούνται.
- body-drag mixed pattern — αρχιτεκτονική παρατήρηση, ξεχωριστή απόφαση αν/όταν γίνει refactor.

---

## 5. SSoT reuse (N.0 / N.12 — τι υπάρχει ήδη και θα επαναχρησιμοποιηθεί)

| Ανάγκη | Υπάρχον SSoT | Αρχείο |
|---|---|---|
| Alignment γεωμετρία | `composeTrackingSnap` → `resolveTrackingSnap` | `systems/tracking/ambient-tracking-compose.ts` + `tracking-resolver.ts` |
| Alignment paint (2D+3D) | `paintAlignmentPaths`/`paintIntersections`/`paintTooltip`/`paintTrackingMarkers` | `canvas-v2/preview-canvas/tracking-paint.ts` |
| Overlay line στυλ | `OVERLAY_LINE_COLORS` + dash | `canvas-v2/preview-canvas/overlay-line-style.ts` |
| Overlay text | `drawOverlayLabel` | `canvas-v2/preview-canvas/overlay-text-style.ts` |
| Format μήκους | `formatLengthForDisplay` | `config/display-length-format.ts` |
| Format γωνίας (locale) | `formatAngleLocale` → `FormatterRegistry` | `rendering/entities/shared/distance-label-utils.ts` |

---

## 6. Verification plan (για την υλοποίηση — μετά τη συζήτηση, όχι τώρα)

- **jest:** `systems/tracking/__tests__/*`, `hooks/dimensions/__tests__/dim-alignment-tracking-tolerance.test.ts`,
  `hooks/dimensions/__tests__/useDimensionGrips-alignment-anchors.test.ts`,
  `hooks/tools/__tests__/rotation-tracking-overlay.test.ts`,
  `systems/cursor/__tests__/body-drag-alignment-tracking.test.ts` → πρέπει να μείνουν GREEN.
  Για Γ2: νέο/επεκταμένο assertion ότι το angle label περνά από `formatAngleLocale` (locale separator).
- **browser-verify:** grip-drag / 2-click MOVE / rotation hot-grip / dim-create → ίδια εμφάνιση ίχνους
  (γραμμή+halo+tooltip) + **locale-correct** γωνία στο el (`«45°»` με `,` όπου χρειάζεται decimals).
- ❌ **ΟΧΙ `tsc`** από agent (N.17) — type-check από Giorgio / pre-commit hook.
- ⚠️ **ADR-040 CHECK 6D:** το Γ1 αγγίζει `hooks/tools/` preview draw, το Γ2 αγγίζει `dim-alignment-tracking.ts`
  (cursor-adjacent) → **stage ΑΥΤΟ το ADR** μαζί με τον κώδικα, αλλιώς μπλοκάρει το pre-commit.

---

## 7. Changelog

- **2026-07-04 (IMPLEMENTED — Γ2 + Γ1· RESOLVED — Γ3)** —
  - **Γ2** (locale γωνίας): αντικατάσταση inline `` `${angle.toFixed()}°` `` με `formatAngleLocale` σε **8 σημεία**.
    SSoT audit (grep) ΠΡΙΝ την υλοποίηση αποκάλυψε ότι η αρχική λίστα handoff (4 action-family sites) ήταν
    **ελλιπής** — τα creation-time δίδυμα (`drawing-hover-handler.ts`, `drawing-hover-overlays.ts` ×2,
    `use-bim3d-wall-placement.ts`) είχαν το ΙΔΙΟ locale bug. Ο Giorgio ενέκρινε επέκταση (full SSoT, Revit-grade
    consistency δημιουργία↔επεξεργασία). Test `polar-utils.test.ts` ξαναγράφτηκε να κλειδώνει το `formatAngleLocale`
    delegation. Verified: 7 suites / 61 tests GREEN.
  - **Γ1** (leader style SSoT): προστέθηκε sibling **leader-family** στο `overlay-line-style.ts` (`OVERLAY_LEADER_DASH`,
    `OVERLAY_LEADER_WIDTH_PX`, `OVERLAY_LINE_COLORS.moveLeader`, `applyOverlayLeaderStyle`)· τα bespoke inline
    `setLineDash([6,4])`/`strokeStyle` στο `grip-ghost-preview-draw-helpers.ts` δρομολογήθηκαν μέσω του helper.
    Μηδέν visual regression (ταυτόσημες τιμές).
  - **2ος γύρος — SSoT audit (εντολή Giorgio):** (α) label composer `formatSnapTrackingLabel` — κεντρικοποίηση της
    8× διπλότυπης σύνθεσης `<γωνία> / <μήκος>` σε ΕΝΑ SSoT (`distance-label-utils.ts`)· `formatPolarLabel` → thin
    wrapper. (β) DRY private `applyOverlayStroke` core στο `overlay-line-style.ts` (τα δύο apply-helpers είχαν
    ταυτόσημα bodies). +2 composer tests. Προϋπάρχον διπλότυπο (δεν το δημιούργησε ο agent) → κεντρικοποιήθηκε.
  - **3ος γύρος — εξαντλητική επαλήθευση (SSoT audit Giorgio «είσαι σίγουρος;»):** enumeration ΟΛΩΝ των call sites
    των tracking painters (`drawPolarTrackingLine` ×5, `drawTrackingAlignment` ×3) αποκάλυψε **9ο** σκόρπιο σημείο που
    τα `.toFixed`-greps δεν έπιασαν: `drawing-hover-overlays.ts:191` (γραμμή στρέψης κολόνας ADR-508) έχτιζε το angle
    label bespoke `` `${Math.round(snappedDeg)}°` `` (angle-only, χωρίς distance) → δρομολογήθηκε στο angle-SSoT
    `formatAngleLocale(snappedDeg, 0)`. **Πλέον ΟΛΑ τα 9 label sites** (8 composition + 1 angle-only) + `formatPolarLabel`
    περνούν από SSoT. Επαλήθευση: 79 tests GREEN.
  - **Γ3** (2D↔3D χρώμα): **RESOLVED — δεν ενοποιήθηκε** (per-context tuning· 3D μπλε ≠ κανένα 2D token· ασύμβατα
    dash units· zero-regression + big-player practice). Καμία αλλαγή κώδικα. Λεπτομέρειες §4 Γ3.
- **2026-07-04 (PROPOSED — audit)** — Δημιουργία. Βαθιά χαρτογράφηση όλων των ιχνών ευθυγράμμισης (γραμμές
  **και** κείμενα) του DXF Viewer μέσω 3 παράλληλων Explore agents + χειροκίνητης επιβεβαίωσης. Πόρισμα: το
  σύστημα (ADR-357 + ADR-562 Φ9) είναι σχεδόν υποδειγματικά κεντρικοποιημένο (ΕΝΑΣ πυρήνας, ΕΝΑΣ store,
  κοινοί 2D+3D painters, ΕΝΑΣ formatter). Εντοπίστηκαν 3 μικρο-αποκλίσεις προς ενοποίηση (Γ1 bespoke leaders,
  Γ2 inline `°` locale bug, Γ3 ασύνδετα 3D color tokens) + 2 by-design ξεχωριστά (Γ4 debug, Γ5 axis-cut/guides).
  Σχέδιο κλεισίματος με προτεραιότητα Γ2>Γ1>Γ3. **Καμία υλοποίηση κώδικα** — εκκρεμεί συζήτηση Giorgio.
