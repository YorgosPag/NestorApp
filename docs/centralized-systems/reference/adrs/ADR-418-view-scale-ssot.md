# ADR-418: Real View Scale (1:N) SSoT — Revit-style zoom indicator

| Metadata | Value |
|----------|-------|
| **Status** | ✅ APPROVED |
| **Date** | 2026-06-05 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `utils/view-scale.ts` + `config/dpi-config.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Related** | ADR-358 (scene units), ADR-375 (annotation drawing scale), ADR-043 (zoom constants), ADR-094 (device pixel ratio), ADR-040 (micro-leaf), ADR-400 (viewport persistence) |

---

## Context / Problem

When importing a floorplan in **metres** via the Import Wizard, the drawing appeared
correct after fit-to-screen (zoom ≈ 5496%) but collapsed to a tiny dot at the "100%"
zoom button. Giorgio reported this as a suspected global mis-scaling.

Investigation proved the application is **NOT** mis-scaled:

- DXF (metres) and BIM (mm) **co-exist correctly**. New BIM entities are stamped
  `params.sceneUnits` from `resolveSceneUnits(currentScene)` and their geometry is
  multiplied by `mmToSceneUnits(units)` (ADR-358). A 3 m wall on a metre floorplan
  renders at the same scale — no 1000× mismatch.
- Fit-to-screen works correctly (scale ≈ 55 = 55 px per metre).

The real defect was the **zoom indicator itself**: it showed `scale * 100` ("5496%"),
i.e. *pixels per scene-unit*. That number is meaningless to a CAD engineer because a
scene-unit can be mm / cm / m. The `zoomTo100` button set `scale = 1.0 * dpr`
(1 px = 1 scene-unit), which for a metre drawing is an 18 px dot. Worse, the transform
is persisted in the URL (`?s=`, ADR-400), so the dot "stuck" across reloads.

## Decision

Replace the pixel-ratio percentage with a **real drawing scale 1:N** (Revit/AutoCAD
style), folding in the active scene units and the screen DPI. The "100%" button becomes
**1:1 actual size**, and scale presets (1:20 … 1:500) zoom so the drawing appears at that
true ratio on screen.

This **view scale** is distinct from the **annotation/plot scale** owned by
`DrawingScaleWidget` (ADR-375, persisted per level): the latter is *how the drawing will
be printed* (Revit "View Scale"); the former is *how big it looks on screen right now*.
The displays carry tooltips clarifying the distinction.

## Coordinate-space resolution (critical)

`ImmediateTransformStore.scale` is in **CSS pixels** per scene-unit. The 2D context is
pre-scaled by `devicePixelRatio` in `CanvasUtils.setupCanvasContext`
(`ctx.setTransform(dpr,0,0,dpr,0,0)`), so all drawing happens in CSS-px space. The
conversion therefore applies **no extra `dpr` factor**; the `dpr` parameter is reserved
(default 1) for a future device-true mode.

## Formula (SSoT in `utils/view-scale.ts`)

```
SCREEN_DPI = 96 ; MM_PER_INCH = 25.4           // config/dpi-config.ts
pxPerMmCss = SCREEN_DPI / MM_PER_INCH                  // 3.7795
modelMmPerSceneUnit(u) = 1 / mmToSceneUnits(u)         // m→1000, cm→10, mm→1

scaleToRatio:  N = modelMmPerSceneUnit(u) * pxPerMmCss / scaleCss
ratioToScale:  scaleCss = modelMmPerSceneUnit(u) * pxPerMmCss / N   (clampScale)
```

Worked example: metres @ scale 55 → N ≈ 69 → "1:69". 1:1 actual size → scale ≈ 3779.5.

## Architecture

| Concern | Owner |
|---------|-------|
| Physical-screen constants | `config/dpi-config.ts` (`SCREEN_DPI`, `MM_PER_INCH`, `pxPerMmCss`) |
| Pure conversion + presets + formatting | `utils/view-scale.ts` (`scaleToRatio`, `ratioToScale`, `formatViewScale`, `VIEW_SCALE_RATIO_PRESETS`, `VIEW_SCALE_MENU_PRESETS`, `isViewRatioActive`) |
| Reactive view scale (micro-leaf) | `systems/zoom/hooks/useViewScale.ts` (subscribes ZoomStore scale + current scene units) |
| Zoom operations | `ZoomManager.zoomToRatio` / `zoomToActualSize` (replace `zoomTo100`) — **ο ΜΟΝΟΣ απόλυτος δρόμος**, §Απόλυτος προορισμός |
| Εντολή κλίμακας από έξω | event `canvas-zoom-to-ratio` → `useFitToView` → `zoomSystem.zoomToRatio` |
| Displays (1:N) | `RulerCornerBox`, `ToolbarStatusBar` (via `StatusBarViewScaleLeaf`), `ZoomControls`/`ZoomControlsWidget`, `SidebarSection` (`SidebarZoomLeaf`) |
| Reload guard | `useAutoFitOnFileChange` — degenerate restore (content diagonal < `MIN_VISIBLE_CONTENT_PX`) re-fits |

### ADR-040 compliance
`useViewScale()` subscribes to high-frequency zoom state and is consumed **only inside
leaf components** (`ZoomDisplayLeaf`, `ZoomPresetButtons`, `StatusBarViewScaleLeaf`,
`SidebarZoomLeaf`, `ZoomControlsWidget`). Orchestrators (`CanvasLayerStack`,
`StandaloneStatusBar`) resolve scene units **imperatively at call time** and gain no new
subscription. `StandaloneStatusBar` no longer subscribes to zoom at all (improvement).

## Consequences

- ✅ The indicator is now meaningful to engineers ("1:69" not "5496%").
- ✅ "1:1" shows true physical size; presets zoom to real ratios.
- ✅ Stale `?s=1` dot URLs self-recover via the degenerate-restore guard.
- ✅ Units pipeline (ADR-358) untouched — display-only + pure conversion + zoom targets.
- 🟡 Deferred (pending-ratchet): migrate the ~9 hardcoded `dpi: 96` in lineweight
  renderers to `SCREEN_DPI`; relocate `useCurrentSceneModel` to `systems/levels/`.
- 🗑️ Deleted dead `ui/toolbar/ScaleControls.tsx` (never rendered, wrong `1/zoom` formula).

## Απόλυτος προορισμός vs σχετικό βήμα (2026-08-27)

Δύο **διαφορετικές** ερωτήσεις μοιράζονταν έναν δρόμο:

| Ερώτηση | Παράδειγμα | Σωστός δρόμος |
|---|---|---|
| «κάνε **βήμα**» (σχετικό) | κουμπιά ±20%, ροδάκι | `zoomAtScreenPoint(factor)` → wheel path |
| «πήγαινε **εκεί**» (απόλυτο) | 1:100 από το widget/μενού | `ZoomManager.zoomToRatio` |

Ο δρόμος του ροδακιού έχει **anti-fling clamp** (`WHEEL_MAX_DELTA = 300`): το `deltaY` κόβεται, άρα
ο πραγματικός factor δεν βγαίνει ποτέ έξω από **[÷1,73, ×1,73]**. Σωστό για hardware εισόδους —
**μοιραίο** για προορισμό. Το `wheelDeltaForFactor` (η αντιστροφή) **δεν** κόβει, οπότε η σύνθεση
των δύο δεν είναι ταυτότητα: σιωπηλός κορεσμός, χωρίς σφάλμα, χωρίς log.

**Το μετρημένο σύμπτωμα** (από 1:32, το στιγμιότυπο του περιστατικού):

| Ζητήθηκε | Απαιτούμενο deltaY | Προσγειώθηκε |
|---|---|---|
| 1:20 | −258 | 1:20 ✅ |
| 1:50 | +245 | 1:50 ✅ |
| 1:100 | +625 | **1:55,3** ❌ |
| 1:200 | +1005 | **1:55,3** ❌ |
| 1:500 | +1508 | **1:55,3** ❌ |
| 1:1 | −1901 | **1:18,5** ❌ |

Τρεις διαφορετικοί στόχοι, **μία** τιμή: η υπογραφή του κορεσμού. Μικρά άλματα δούλευαν — γι' αυτό
η βλάβη έμοιαζε με «κολλάει καμιά φορά» αντί για «είναι σπασμένο».

🔴 **Η ρίζα δεν ήταν το clamp — ήταν ότι το ADR-418 έφτιαξε τον σωστό δρόμο και τον πήρε ΜΟΝΟ ο
ένας από τους δύο καταναλωτές.** Το μενού της γωνίας των χαράκων καλούσε `zoomSystem.zoomToRatio`
(σωστά)· το widget του ribbon, επειδή ζει **έξω** από το `CanvasLayerStack` και δεν βλέπει το
`zoomSystem`, «τα κατάφερε μόνο του» μέσω `canvasOps.zoomToScale`. Δύο αδέλφια, ένα σωστό.

**Η θεραπεία**: το widget ταξιδεύει με event (`canvas-zoom-to-ratio`) — **ακριβώς το σχήμα που
ήδη χρησιμοποιεί το `canvas-fit-to-view`** για την ίδια ακριβώς αιτία — και καταλήγει στον ΕΝΑ
`zoomToRatio`. Ο σπασμένος `useCanvasOperations.zoomToScale` **διαγράφηκε** (ήταν ο μοναδικός του
καταναλωτής): προτιμότερο να λείπει ο δρόμος παρά να υπάρχει και να παραπλανά.

## Η ζωντανή βάση του ZoomManager (2026-08-27)

Ο `ZoomManager` κρατούσε **δικό του** `currentTransform`, ενημερωμένο μόνο από τις δικές του
πράξεις — ενώ το **pan** γράφει κατευθείαν στο SSoT (`useCentralizedMouseHandlers` →
`onTransformChange`), όπως και fit / restore-viewport / reset-to-origin. Δεύτερη πηγή αλήθειας
δίπλα στο `ImmediateTransformStore`: μετά από pan, το επόμενο zoom υπολόγιζε **σωστό factor πάνω σε
λάθος αγκύρωση**.

Θεραπεία: **injected getter** (4ο όρισμα του constructor, `getImmediateTransform`), με
`syncFromLiveTransform()` πριν από κάθε πράξη που χτίζει πάνω στην τρέχουσα κατάσταση. Η κλάση
μένει καθαρή (δεν εισάγει store, testable)· χωρίς getter η συμπεριφορά είναι η παλιά.

## Changelog

- **2026-06-05** — Initial implementation. New `dpi-config.ts` + `view-scale.ts` SSoT +
  `useViewScale` hook + 11 unit tests. `ZoomManager`/`useZoom`/`CanvasContext` gain
  `zoomToRatio`/`zoomToActualSize`, drop `zoomTo100`. Displays migrated to 1:N. Reload
  degenerate-view guard added. i18n el/en. ScaleControls deleted.
- **2026-08-27** — 🔴 **Το ribbon widget κλίμακας δεν έφτανε ποτέ στον στόχο του.** Το
  `set-view-ratio` δρομολογούνταν μέσα από τον δρόμο του ροδακιού και κορενόταν από το anti-fling
  clamp (μετρημένο: από 1:32 τα 1:100/1:200/1:500 προσγειώνονταν **όλα** στο 1:55,3). Τώρα εκπέμπει
  `canvas-zoom-to-ratio` → `useFitToView` → `zoomSystem.zoomToRatio` — ο ΙΔΙΟΣ δρόμος με το μενού
  της γωνίας των χαράκων. Διαγράφηκε ο `useCanvasOperations.zoomToScale` (νεκρός + παγίδα)·
  προειδοποίηση-νάρκη στο `wheelDeltaForFactor`. **Δεύτερο εύρημα**: ο `ZoomManager` χτίζει πλέον
  πάνω στη **ζωντανή** κατάσταση (injected `getImmediateTransform`), όχι σε αντίγραφο που το pan
  άφηνε μπαγιάτικο. **Άγκυρα**: `systems/zoom/__tests__/view-ratio-landing.test.ts` — 13 tests που
  ρωτούν «ΠΟΥ προσγειώθηκα;» αντί για τα μαθηματικά· επαληθευμένη με **2/2 μεταλλάξεις** (επαναφορά
  του wheel δρόμου → 8 κόκκινα· αφαίρεση του συγχρονισμού → 1 κόκκινο).
