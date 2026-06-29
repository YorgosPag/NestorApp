# ADR-555 — Unified 3D Projected-Overlay Dispatch Canvas (5 → 1)

**Status:** 🟡 IMPLEMENTED (UNCOMMITTED)
**Date:** 2026-06-29
**Domain:** Canvas & Rendering / DXF Viewer / 3D BIM viewport
**Implements:** ADR-551 §5.2 #4 + #5 + §5.3 (η cross-cutting σύσταση — «ισχυρότερο εύρημα»)
**Related:** ADR-552/554 (2D dispatch canvases — sibling pattern + shared `paintOverlayDispatchFrame`), ADR-040 (preview-canvas micro-leaf), ADR-535/537/538/542/543/544/549 (τα 5 πρώην overlays + ο cursor-swim render loop), ADR-545/513 (μη-canvas overlays που ΜΕΝΟΥΝ ξεχωριστά)

---

## 1. Πρόβλημα

Το **2D** viewport έχει **ΕΝΑΝ** shared `PreviewCanvas` με dispatch. Το **3D** αντίθετα έσπασε σε **5 ξεχωριστά camera-projected Canvas2D overlays** (ADR-551 §3 census 3D #3–#7):

| z | Πρώην leaf | Painter (reuse) | Gate (active) |
|---|---|---|---|
| 1 | `grips/DxfHoverGlowOverlay2D` (ADR-538/549) | `drawEntityGlowPrePass` | `hoveredId && isDXF` |
| 2 | `grips/BimGripOverlay2D` (ADR-535/537/543) | `UnifiedGripRenderer` | `grips.length>0` |
| 3 | `tracking/Tracking3DOverlay` (ADR-543) | `paintAlignmentPaths`/… | `is3D && tool==='wall'` |
| 4 | `wall-hud/WallHudOverlay3D` (ADR-543) | `paintWallHudCore` | `… && hasStart` |
| 5 | `placement/BimPlacementOverlay2D` (ADR-544) | `paintPlacement3DOverlay` | `meta!==null` |

Καθένα είχε **δικό του** `<canvas>` + `<div>` container + RAF loop (`useRafWhile`) + camera-motion gate (`useCameraMotionGate`) + (2 από αυτά) δικό `GripDepthOccluder`. = 5 backing stores μόνιμα στο DOM + 5 παράλληλα RAF loops + 5 motion gates + 2 occluders, ενώ ο painter/projector/lifecycle ήταν ήδη κοινός.

## 2. Απόφαση

ΕΝΑΣ **shared dispatch canvas** (`BimOverlayDispatchCanvas`) που αντικαθιστά και τα 5 — ο **3D αδελφός** του 2D `PreviewCanvas` dispatch (ADR-552/554). **z-ordered multi-pass pull model:** ο dispatch κάνει size+clear **ΜΙΑ** φορά και καλεί κάθε pass με σειρά z-order. Κάθε layer = ένα `BimOverlayPass` από το δικό του `use*Pass()` hook· ο paint κώδικας **verbatim** από τα 5 πρώην leaves.

### Γιατί αδελφός και όχι το 2D primitive αυτούσιο
Το 2D `paintOverlayDispatchFrame` (ADR-552/554) παίρνει το `transform` από React prop και κάνει repaint σε React effect / zero-lag scheduler. Οι 3D passes οδηγούνται από τη **ζωντανή κάμερα κάθε RAF frame** και χρειάζονται per-frame **camera-motion gate** + shared **GPU depth occluder** — έννοιες που το 2D primitive δεν έχει. Τα low-level κομμάτια είναι **ήδη** SSoT (`sizeCanvasToContainerDpr`, `overlay-raf.ts` lifecycle, `makeGripPlanToCanvas` projector). Άρα: **δύο αδέλφια του ίδιου pull model**, μηδέν forced generic abstraction — η ίδια απόφαση που πήρε το ADR-554 όταν χώρισε analytical/proposal αντί να επιβάλει ένα.

### Coexistence — z-ordered passes, ΟΧΙ «ένα τη φορά» (διόρθωση ADR-551)
Οι ισχυρισμοί mutual-exclusivity του ADR-551 §5.2 #4/#5 είναι **λάθος** (verified από κώδικα):
- **grip + hover ΣΥΝΥΠΑΡΧΟΥΝ:** hover entity B ενώ A selected → glow (κάτω) + grips (πάνω).
- **wallHud + tracking ΣΥΝΥΠΑΡΧΟΥΝ:** tracking ζωντανό όλο το `tool==='wall'`, wallHud το subset `&& hasStart`.
- placement vs wall-pair = genuinely exclusive (single `activeTool`).

→ Ο dispatch ΠΡΕΠΕΙ να είναι **z-ordered multi-pass**, όχι switch. (Το ADR-551 §5.2 #4/#5 διορθώνεται → IMPLEMENTED + σημείωση coexistence.)

## 3. Dirty/skip gate — διατήρηση του ADR-549 Φ3 (κρίσιμο)

Ο `DxfHoverGlowOverlay2D` (ADR-549 Φ3) **σκόπιμα δεν ξαναζωγράφιζε** όταν τίποτα δεν άλλαζε (ίδιο id + ίδιο μέγεθος + στατική κάμερα) — γιατί το re-clear + re-stroke + **GPU re-upload full-DPR texture κάθε frame** καθυστερούσε το paint του crosshair → «lag» κέρσορα στο hover. Ένα naïve dispatch (size+clear+paint κάθε frame) θα **επανέφερε** το bug όταν το hover-glow είναι το μόνο ενεργό (κοινή περίπτωση: σκέτο hover).

**Λύση:** ο `paintBimOverlayFrame` αποκτά **dirty/skip gate** που γενικεύει το ADR-549 Φ3 σε επίπεδο frame:
```
moving = isCameraMoving(camera)          // ΜΙΑ κλήση/frame (μεταλλάσσει το stored pose)
visible = passes.filter(active && !(moving && hideOnMotion))
if (!forcePaint && !moving && !visible.some(isDirty?.() !== false)) return false   // skip — κράτα pixels
ctx = sizeCanvasToContainerDpr(...)      // size + CLEAR μία φορά
for (pass of visible) { ctx.save(); pass.paint(frame); ctx.restore() }
return true
```
- **hover-glow:** `isDirty()` = (hovered id ή container size άλλαξε)· `hideOnMotion=false` (ακολουθεί την κάμερα στο orbit, όπως πριν — το frame-level `moving` εξαναγκάζει το repaint).
- **grips/wallHud/tracking/placement:** **χωρίς** `isDirty` (conservative ⇒ `undefined !== false` ⇒ πάντα repaint όταν active) + `hideOnMotion=true` — **ακριβώς η σημερινή συμπεριφορά, μηδέν regression**.
- **`forcePaint`** (από το leaf) = «το active-set άλλαξε από το τελευταίο painted frame» → εξασφαλίζει ΕΝΑ clearing frame όταν ένα layer σβήνει (incl. shrink-to-empty). Το leaf ενημερώνει το `lastSig` μόνο όταν ο frame όντως ζωγράφισε (γι' αυτό ο renderer επιστρέφει `boolean`).

Έτσι: hover-glow μόνο + στατικό → skip (ADR-549 διατηρείται)· οποιοδήποτε «βαρύ» pass active → repaint κάθε frame (σημερινή συμπεριφορά).

### Per-pass `save()/restore()` (σκόπιμη απόκλιση από το 2D primitive)
Ο 3D dispatch τυλίγει **κάθε** pass σε `ctx.save()/restore()`. Οι 3D passes αναμειγνύουν `drawEntityGlowPrePass` (θέτει shadow/alpha/lineWidth) με `UnifiedGripRenderer` σε **έναν** καμβά· το per-pass save/restore εγγυάται μη-διαρροή state. Το 2D primitive δεν το χρειάζεται (self-contained painters)· φθηνή εγγύηση εδώ, τεκμηριωμένη.

## 4. Big-player verification (κανόνας Giorgio)
- **Three.js editor / `webgl_multiple_views`** + **ADR-552/554** (ίδια app) → ΕΝΑΣ dispatch canvas με ordered passes = επιβεβαιωμένη πρακτική. ✅
- **Revit / Maxon Cinema 4D / Autodesk APS** → ένα overlay/annotation layer πάνω από το viewport, όχι N ξεχωριστά. ✅
- **Escape hatch (ADR-551 §5.4):** τα **interactive / DOM** layers μένουν ξεχωριστά — `BimCrosshairOverlay3D` (HTML, ADR-545), `BimSnapIndicatorOverlay3D` (SVG, ADR-542), `DynamicInput3DLeaf` (DOM ring, ADR-513), `CropRegionOverlay` (pointer-events handles). Δεν είναι camera-projected Canvas2D → η ενοποίηση θα τα χειροτέρευε. Τεκμηριωμένη διατήρηση κατά big-player πρακτική.

## 5. Αρχεία

| Αρχείο | Αλλαγή |
|--------|--------|
| `bim-3d/viewport/overlay-dispatch/bim-overlay-pass.ts` | **ΝΕΟ** pure primitive — `BimOverlayFrame`, `BimOverlayPass`, `paintBimOverlayFrame` (dirty/motion/forcePaint gate + per-pass save/restore, επιστρέφει `boolean`), `activePassSignature`. |
| `bim-3d/viewport/overlay-dispatch/__tests__/bim-overlay-pass.test.ts` | **ΝΕΟ** 17/17 jest (pull-model, motion gate, dirty gate, return value, signature). |
| `bim-3d/viewport/overlay-dispatch/BimOverlayDispatchCanvas.tsx` | **ΝΕΟ** leaf — ΕΝΑ canvas/RAF/motion-gate/occluder, 5 passes z-order, `forcePaint` signature. |
| `bim-3d/viewport/overlay-dispatch/use-{hover-glow,grip,tracking,wall-hud,placement}-pass.ts` | **ΝΕΑ** 5 pass hooks (paint verbatim από τα πρώην leaves· low-freq subscription το καθένα). |
| `bim-3d/viewport/BimViewport3DCanvasOverlays.tsx` | 5 imports+mounts → **1** `<BimOverlayDispatchCanvas>` (+ κρατούνται crosshair/snap/dynamic-input). |
| `bim-3d/viewport/{grips/BimGripOverlay2D,grips/DxfHoverGlowOverlay2D,wall-hud/WallHudOverlay3D,tracking/Tracking3DOverlay,placement/BimPlacementOverlay2D}.tsx` | **ΔΙΑΓΡΑΦΗ** (5) — εκκρεμεί ρητή εξουσιοδότηση Giorgio (auto-mode classifier μπλοκάρει). |

**Reuse αμετάβλητα:** `makeGripPlanToCanvas` / `makePlacementOverlayProjector` (projection SSoT), `overlay-raf.ts` (`useRafWhile`/`useCameraMotionGate`/`useGripDepthOccluder`), `sizeCanvasToContainerDpr`, `UnifiedGripRenderer` + `getGripPreviewStyle`, `drawEntityGlowPrePass`, `paintWallHudCore`, `tracking-paint` + `tracking-colors`, `paintPlacement3DOverlay`, τα 5 stores (`Grip3DOverlayStore`/`HoverStore`/`wall-3d-hud-store`/`tracking-3d-store`/`Placement3DOverlayStore`), `GripDepthOccluder`.

## 6. ADR-040 / CHECK 6B/6D
Τα `bim-3d/viewport/*` ΔΕΝ είναι στο CHECK 6B/6D pre-commit registry (μόνο `components/dxf-layout`, `canvas-v2`, `systems/`). Δεν μπλοκάρει — αλλά αυτό το ADR + ADR-040 + ADR-551 stage-άρονται μαζί (precedent ADR-552/554). ADR-040 micro-leaf: κάθε pass subscribe **μόνο** σε low-freq gate· high-freq payloads non-reactive μέσα στο `paint` → καμία 60fps subscription, CHECK 6C safe.

## 7. Census impact (ADR-551)
3D camera-projected Canvas2D overlay canvases **5 → 1**. RAF loops **5 → 1**, camera-motion gates **5 → 1**, occluder instances **2 → 1**. (3D idle WebGL ήδη 2→1 από ADR-553.)

## 8. Risks
- **ADR-549 Φ3 regression** → αποτράπηκε με το frame-level dirty/skip gate (§3) + test.
- **Camera-motion behavior change:** το hover-glow κρατά `hideOnMotion=false` → ακολουθεί την κάμερα στο orbit (όπως πριν)· τα υπόλοιπα `hideOnMotion=true` (hide-on-motion, όπως πριν). Μηδέν αλλαγή συμπεριφοράς.
- **State bleed σε shared canvas** → per-pass `save/restore` (§3).
- **Occluder sharing grip↔placement** → δεν συνυπάρχουν· ακόμη κι αν, ο occluder είναι stateless per-call (computeVisibility ανά set σημείων) → ασφαλές.

## 9. Verification
- `cd src/subapps/dxf-viewer && npx jest bim-overlay-pass grip-3d-screen-project placement-overlay-project` → GREEN (τα projection tests αμετάβλητα).
- Browser (Giorgio): hover DXF → κίτρινο glow byte-identical, crosshair **χωρίς lag**· orbit ενώ hover → glow ακολουθεί· selection → λαβές (twins + occlusion), orbit→hide/settle→show· **hover B ενώ A selected → glow + grips μαζί**· wall tool → tracking lines, μετά 1ο κλικ → + wall HUD μαζί· column tool → placement grid/dims· DevTools → **ΕΝΑ** overlay canvas (αντί 5).

## Changelog
- **2026-06-29** — Initial. Υλοποίηση ADR-551 §5.2 #4+#5 + §5.3: 5 camera-projected Canvas2D overlays → 1 z-ordered multi-pass dispatch canvas. Νέο pure `paintBimOverlayFrame` (3D αδελφός του `paintOverlayDispatchFrame`) με dirty/skip gate που διατηρεί το ADR-549 Φ3 (no hover-lag regression). Coexistence διορθώνει ADR-551 §5.2 #4/#5. 17/17 jest + projection tests GREEN. UNCOMMITTED — εκκρεμεί διαγραφή 5 orphaned leaves (Giorgio authorization) + browser-verify + commit.
