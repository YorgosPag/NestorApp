# ADR-545 — Ενιαίο σταυρόνημα (crosshair) CAD 2D ↔ 3D (ένας render-κώδικας, δύο καμβάδες)

**Status:** ⚰️ **RETIRED / SUPERSEDED από ADR-549 Phase 8 (2026-06-29)** — ο Canvas2D `CrosshairCompositor`
αποσύρθηκε υπέρ του **OS hardware cursor** (CSS `cursor: url(png)`, τέλειο 1:1, μηδέν compositor latency).
Τα αρχεία (`CrosshairCompositor`/`CrosshairOverlay`/`BimCrosshairOverlay3D`/`crosshair-compositor-*`/
`crosshair-3d-center`/`hover-add-badge`) **διαγράφηκαν**. Το έγγραφο μένει ως ιστορικό. · **Date:** 2026-06-27
**Type:** Architecture (DXF Viewer — cursor/crosshair, 2D↔3D SSoT)
**Builds on:** ADR-040 (compositor crosshair, micro-leaf subscriber) · ADR-515 (centre-square/aperture snap-hide) · ADR-513 (crosshair suppression — NavWheel) · ADR-538 (shared hover «+/−» badge SSoT) · ADR-542 (3D snap markers — ίδιο projection/occluder seam) · ADR-535 Φ5 (Canvas2D overlay πάνω από WebGL + `GripDepthOccluder`)
**Related:** `CrosshairCompositor` · `crosshair-compositor-layout` · `ImmediatePositionStore.registerDirectRender` · `ImmediateSnapStore` · `Snap3DOverlayStore` · `makeGripPlanToCanvas` · `resolveHoverBadge`
**Παράλληλο:** ADR-543/544 (ενιαίος τοίχος/κολώνα 2D↔3D — ίδια αρχιτεκτονική «ένας κώδικας, δύο καμβάδες»)

---

## 1. Πρόβλημα / Ζητούμενο (Giorgio 2026-06-27)

Στον **2D** καμβά υπάρχει πλήρες CAD **σταυρόνημα** (AutoCAD/Revit): ακολουθεί τον κέρσορα 1:1 (compositor
`translate3d`, off-main-thread), δείχνει το «+/−» add-badge δίπλα του, και **«κουμπώνει» στο σημείο έλξης
(OSNAP)** όταν είναι ενεργό. Στο **3D** viewport υπήρχε **μόνο ο OS κέρσορας** (βελάκι) + ένα μεμονωμένο
hover badge (`HoverAddBadge3D`).

Giorgio: «*ο κέρσορας 2D/3D δεν είναι ενιαίος, πιθανό διπλότυπο, όχι μία πηγή αλήθειας*». **Ζητούμενο:**
**ΕΝΑ** σταυρόνημα-SSoT, κοινό 2D+3D — όχι παράλληλο 3D αντίγραφο.

---

## 2. Εύρημα audit (code = source of truth)

| Στοιχείο | SSoT (πριν) | Κοινό; |
|---|---|---|
| Render σταυρονήματος (DOM + geometry + aperture + badge) | `CrosshairOverlay.tsx` (μονολιθικό, 2D-only) | ❌ μόνο 2D |
| Geometry/style helpers | `crosshair-compositor-layout.ts` | ✅ ήδη pure/κοινά |
| Badge κείμενο/χρώμα | `resolveHoverBadge` (ADR-538) | ✅ ήδη κοινό |
| Cursor settings | `getCursorSettings` / `subscribeToCursorSettings` | ✅ singleton |
| Θέση κέρσορα (2D) | `ImmediatePositionStore.registerDirectRender` | ⚠️ **singleton ΕΝΑΣ callback** |
| Aperture snap-hide (2D) | `ImmediateSnapStore` (ADR-515) | 2D-only store |
| 3D snap marker (plan-mm point) | `Snap3DOverlayStore` + `makeGripPlanToCanvas` (ADR-542) | 3D-only |

**Κρίσιμο:** το `CanvasLayerStack3dLeaf` (που κάνει render το `BimViewport3D`) mount-άρεται **μέσα** στο
`CanvasLayerStack`, **δίπλα** στο 2D `CrosshairOverlay` → **συνυπάρχουν** σε 3D mode.

### 2.1 Γιατί ΑΠΟΡΡΙΦΘΗΚΕ το «mount ίδιου CrosshairOverlay στο 3D» (Option A)
1. **Singleton σύγκρουση:** το `registerDirectRender` κρατά **έναν** callback (last-wins). Δύο instances →
   στην επιστροφή από 3D ο 2D callback μένει `null` → **σπάει το 2D σταυρόνημα**.
2. **Camera projection:** στο 3D το snap point είναι σε plan-mm και η οθόνη του **αλλάζει σε κάθε orbit**.
   Το screen-static μοντέλο (μία θέση/mousemove) δεν το ακολουθεί — χρειάζεται per-frame projection.

---

## 3. Απόφαση — shared-core extraction (Option B, αληθινό SSoT)

Ο **render-κώδικας** του σταυρονήματος εξάγεται σε **ΕΝΑ** `CrosshairCompositor`, κοινό και για τα δύο viewports.
Διαφέρει **μόνο** ο per-host **driver θέσης/snap**.

```
                       ┌─────────────────────────────┐
                       │   CrosshairCompositor (SSoT) │  DOM (4 arms + aperture + badge)
                       │  applyStaticStyles/applyBadge│  geometry (crosshair-compositor-layout)
                       │  applyTransform / setSnapActive│ settings (getCursorSettings) + badge (resolveHoverBadge)
                       └──────────────┬──────────────┘
            imperative ref            │            imperative ref
        ┌───────────────────┐        │        ┌────────────────────────┐
        │ CrosshairOverlay  │ (2D)   │   (3D) │ BimCrosshairOverlay3D   │
        │ registerDirectRender│      │        │ mousemove (cursor px)   │
        │ ImmediateSnapStore │       │        │ RAF: makeGripPlanToCanvas│
        └───────────────────┘        │        │ + GripDepthOccluder      │
                                      │        │ + Snap3DOverlayStore     │
                                      │        └────────────────────────┘
```

### 3.1 Imperative handle (`CrosshairCompositorHandle`)
- `applyTransform(pos)` — μετακίνηση κέντρου (host-container-local px)· `null` ⇒ hide. Κρατά την τελευταία
  θέση ώστε settings/suppression/resize να ξανα-εφαρμόζουν **χωρίς** ο host να την ξανα-ταΐζει (decoupled
  από κάθε position store).
- `setSnapActive(bool)` — ADR-515 κρύψιμο κεντρικού τετραγώνου όταν φωτίζεται έλξη.

### 3.2 2D wrapper (`CrosshairOverlay.tsx`, v5)
Thin: `registerDirectRender → applyTransform` (η 2D ταΐζει την **ήδη κουμπωμένη** screen θέση → jump),
`subscribeSnapResult → setSnapActive` (ADR-515). **Byte-identical** συμπεριφορά με το προηγούμενο v4.

### 3.3 3D wrapper (`BimCrosshairOverlay3D.tsx`)
- **Cursor follow:** window `mousemove` → canvas-local px → `applyTransform` (zero-lag, όπως το 2D).
- **Snap jump:** `useRafWhile(snapActive, draw)` — κάθε frame reproject το plan point μέσω **live camera**
  (`makeGripPlanToCanvas`, ο ΙΔΙΟΣ projector του `BimSnapIndicatorOverlay3D`), occlusion-cull
  (`GripDepthOccluder`, «μόνο μπροστινά»), camera-motion gate (`useCameraMotionGate`).
- **Απόφαση snap-vs-cursor:** pure SSoT `resolveCrosshair3DCenter` (`crosshair-3d-center.ts`) — snap «κουμπώνει»
  μόνο αν projectable **&&** camera settled **&&** μη-occluded· αλλιώς ακολουθεί τον κέρσορα. 9 jest.
- **OS κέρσορας:** `cursor-none` στον inner canvas container (το CAD σταυρόνημα αντικαθιστά το βελάκι, Revit/
  AutoCAD)· τα sibling κουμπιά κρατούν `cursor-default` του root.

### 3.4 Dedup
- Το `HoverAddBadge3D.tsx` **διαγράφηκε** — το badge έρχεται πλέον από τον κοινό compositor (ένα badge code path).
- **`projectSnap3DMarker` (NEW SSoT, `viewport/snap/project-snap3d-marker.ts`):** η προβολή του ενεργού
  `Snap3DOverlayStore` marker (plan-mm → canvas-local px) + off-screen + occlusion + camera-motion
  απόφαση ήταν **διπλότυπη** ανάμεσα στο `BimSnapIndicatorOverlay3D` και (αρχικά) στο νέο crosshair.
  Κεντρικοποιήθηκε σε ΕΝΑ helper (reuse `makeGripPlanToCanvas` + `GripDepthOccluder`) που **και τα δύο**
  overlays καλούν τώρα. Έτσι το `resolveCrosshair3DCenter` απλοποιήθηκε σε 2 inputs (cursor, snapProjected).
- **`useGripDepthOccluder` (overlay-raf):** το lifecycle `new GripDepthOccluder()`+dispose ήταν copy-paste
  σε 4 overlays (grips/snap/placement/crosshair)· ενοποιήθηκε σε ΕΝΑ hook (συνεργασία με ADR-544).

---

## 4. Αρχεία

| Αρχείο | Αλλαγή |
|---|---|
| `canvas-v2/overlays/CrosshairCompositor.tsx` | **NEW** — κοινός render-πυρήνας + imperative handle |
| `canvas-v2/overlays/CrosshairOverlay.tsx` | **REWRITE** → thin 2D wrapper (drivers: ImmediatePositionStore + ImmediateSnapStore) |
| `bim-3d/viewport/BimCrosshairOverlay3D.tsx` | **NEW** — thin 3D wrapper (RAF projection + occluder + Snap3DOverlayStore) |
| `bim-3d/viewport/crosshair-3d-center.ts` | **NEW** — pure snap-vs-cursor SSoT (2-input) |
| `bim-3d/viewport/snap/project-snap3d-marker.ts` | **NEW** — shared projection SSoT (snap glyph + crosshair) |
| `bim-3d/viewport/snap/BimSnapIndicatorOverlay3D.tsx` | migrate inline project+occlude → `projectSnap3DMarker` (dedup) |
| `bim-3d/viewport/overlay-raf.ts` | `useGripDepthOccluder` hook (occluder lifecycle dedup, w/ ADR-544) |
| `bim-3d/viewport/__tests__/crosshair-3d-center.test.ts` | **NEW** — 4 jest |
| `bim-3d/viewport/snap/__tests__/project-snap3d-marker.test.ts` | **NEW** — 4 jest |
| `bim-3d/viewport/BimViewport3D.tsx` | wire crosshair· delete HoverAddBadge3D· `cursor-none` στον container |
| `bim-3d/viewport/HoverAddBadge3D.tsx` | **DELETED** (subsumed) |
| `systems/hover/hover-add-badge.ts` | ενημέρωση σχολίου SSoT (3D consumer πλέον `BimCrosshairOverlay3D`) |

---

## 5. ADR-040 συμμόρφωση
- Ο compositor οδηγείται **imperatively** (refs, zero high-frequency React state).
- Το 3D RAF τρέχει **μόνο** όσο υπάρχει ενεργό snap (`useRafWhile`)· το cursor-follow είναι mousemove-driven.
- Καμία νέα subscription orchestrator· τα stores είναι low-freq (`Snap3DOverlayStore`) ή imperative.

## 6. Εκκρεμότητες
- 🔴 **browser-verify:** (α) 2D σταυρόνημα αμετάβλητο (follow + snap jump + badge + aperture),
  (β) 3D σταυρόνημα ακολουθεί κέρσορα χωρίς τράκαρισμα, (γ) jump στο OSNAP point, (δ) «+/−» badge στο hover,
  (ε) επιστροφή 2D→3D→2D δεν σπάει κανένα από τα δύο.
- Commit (Giorgio· targeted, shared tree· stage ADR-040 + ADR-545 για CHECK 6B/6D).

---

## Changelog
- **2026-06-27** — Αρχική υλοποίηση (UNCOMMITTED): shared `CrosshairCompositor`, 2D→thin wrapper, νέο
  `BimCrosshairOverlay3D`, pure `crosshair-3d-center`, διαγραφή `HoverAddBadge3D`.
- **2026-06-27 (fix)** — capture-phase cursor listener: το 3D `handleMouseMove` (`e.stopPropagation`)
  σκότωνε τους bubble window listeners → το σταυρόνημα φαινόταν μόνο πάνω σε BIM (snap/RAF path). Capture
  φάση → ακολουθεί τον κέρσορα πάντα (BIM/DXF/κενό).
- **2026-06-27 (SSoT dedup, Giorgio audit)** — αφαίρεση διπλότυπου που είχα δημιουργήσει: η projection
  του snap marker μπήκε σε ΕΝΑ `projectSnap3DMarker` που καλούν ΚΑΙ ο snap glyph ΚΑΙ ο crosshair·
  `resolveCrosshair3DCenter` → 2-input· occluder lifecycle → `useGripDepthOccluder` (4 overlays, w/ ADR-544).
- **2026-06-29** — ⚰️ **RETIRED (SUPERSEDED από ADR-549 Phase 8).** Το bisection απέδειξε ότι **κάθε**
  web-canvas/DOM σταυρόνημα κολυμπάει (residual = compositor present-latency του page layer, αναπόφευκτο σε
  αδύναμη GPU). Λύση big-player (Figma/Google): το σταυρόνημα γίνεται **OS hardware cursor** (CSS `cursor: url(png)`)
  → η GPU το ζωγραφίζει στο cursor plane → εγγυημένα 1:1. Ο κοινός `CrosshairCompositor` και ΟΛΑ τα wrappers/
  helpers του (`CrosshairOverlay`, `BimCrosshairOverlay3D`, `crosshair-compositor-paint`/`-layout`,
  `crosshair-3d-center`, `hover-add-badge`) **διαγράφηκαν** (11 αρχεία). Ο νέος SSoT = `systems/cursor/`
  `crosshair-cursor-image.ts` (pure PNG builder) + `useCrosshairCursor.ts` (hook). Βλ. ADR-549 changelog 2026-06-29
  Phase 8. **Τίμημα (αποδεκτό):** PNG ≤32px, όχι center snap-glue (το «+/−» badge & το glue δεν αναπαράγονται σε
  hardware cursor) — το snap marker (SVG overlay) + το κλικ-στο-snap παραμένουν άθικτα.
