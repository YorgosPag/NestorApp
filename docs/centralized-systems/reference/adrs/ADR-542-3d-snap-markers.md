# ADR-542 — Σημάδια έλξης (OSNAP) στην 3D προβολή (ίδιο 2D glyph + label + μηχανή)

**Status:** 🟢 IMPLEMENTED (UNCOMMITTED) — 3D snap marker (┘ «Γωνία κολώνας» / ▲ «Μέσο κολώνας» / ⊕ «Κέντρο») · **Date:** 2026-06-27
**Type:** Feature (DXF Viewer — 3D viewport snap feedback). Full SSoT με το 2D.
**Builds on:** ADR-538 (3D hover glow + badge, ίδιος 2D κώδικας) · ADR-535 (Canvas2D overlay projection στο 3D) · ADR-402 (`syncSnapEngineViewport3D` — 3D-camera pixel tolerance) · ADR-370 (ΕΝΑ generic BIM characteristic snap) · ADR-137/ADR-515 (snap glyph geometry + per-type colour) · ADR-040 (micro-leaf)
**Related:** `getGlobalSnapEngine` (snapping) · `GripDepthOccluder` (ADR-535 Φ5b)

---

## 1. Πρόβλημα / Ζητούμενο (Giorgio 2026-06-27)

Στον **2D** κάμβα, hover με το σταυρόνημα κοντά σε χαρακτηριστικό σημείο δομικής οντότητας (π.χ. κολόνας) →
εμφανίζεται **σημάδι έλξης** + **ετικέτα**: στη γωνία πορτοκαλί **┘** + «Γωνία κολώνας», στο μέσο πράσινο
γεμάτο **▲** + «Μέσο κολώνας», στο κέντρο **⊕** + «Κέντρο». Στο **3D**: **τίποτα**. Ζητούμενο: στο 3D, hover
→ **τα ίδια σημάδια + τις ίδιες ειδοποιήσεις**, με **σύστημα full SSoT — μία και μοναδική πηγή αλήθειας,
μηδέν διπλότυπος κώδικας**.

**Αποφάσεις (ερωτήσεις στον Giorgio):**
- **Execution** → Plan Mode (καθαρή αρχιτεκτονική με υψηλό reuse· όχι orchestrator).
- **Occlusion** → **«μόνο μπροστινά»**: σημάδι πίσω από όγκο **δεν** δείχνει (reuse του GPU depth-occluder των λαβών).

---

## 2. Αρχιτεκτονική — μία πηγή αλήθειας

Το 2D σύστημα έλξης ήταν ΗΔΗ πλήρως κεντρικοποιημένο. Το μόνο που αναπόφευκτα διαφέρει 2D↔3D είναι το
**projection** (2D `CoordinateTransforms.worldToScreen` vs 3D camera). Άρα σπάσαμε **μόνο** το presentational
κομμάτι σε κοινό SSoT και προσθέσαμε **μόνο** το 3D wiring.

| Επίπεδο | SSoT | 2D | 3D |
|---|---|---|---|
| **Γεωμετρία** (γωνίες/μέσα/κέντρο + label root) | `bim/utils/bim-characteristic-points.ts` | ✅ | ✅ (ίδιο) |
| **Μηχανή έλξης** | `getGlobalSnapEngine()` → `BimCharacteristicSnapEngine` (ADR-370) | ✅ | ✅ (ίδιο singleton) |
| **Tolerance ανά zoom** | `syncSnapEngineViewport3D` (ADR-402) | (2D viewport) | ✅ (3D camera) |
| **View-model** | `toSnapIndicatorView` (ProSnapResult → `{point,type,description}`) | ✅ | ✅ |
| **Ετικέτα** «Γωνία/Μέσο/Κέντρο» + ουσιαστικό | `snapping/snap-description-keys.ts resolveBimSnapLabelText` | ✅ | ✅ |
| **Χρώμα ανά τύπο** | `rendering/ui/snap/snap-visual-config.ts resolveSnapColor` | ✅ | ✅ |
| **Glyph + label (presentational, screen-space)** | **NEW** `canvas-v2/overlays/SnapIndicatorGlyph.tsx` | ✅ | ✅ |
| **Projection plan→px** | `bim-3d/grips/grip-3d-screen-project.ts makeGripPlanToCanvas` (ADR-535) | — | ✅ |
| **Occlusion** | `bim-3d/grips/grip-3d-depth-occluder.ts GripDepthOccluder` (ADR-535 Φ5b) | — | ✅ |
| **Visibility gate** (grid/guide σιωπηλά) | `snapping/extended-types.ts isSnapMarkerVisible` (ADR-515) | ✅ | ✅ |

### Το κοινό seam (refactor, μηδέν αλλαγή συμπεριφοράς)

`SnapIndicatorOverlay.tsx` έσπασε σε:
- **`SnapIndicatorGlyph`** (NEW) — η **ΜΙΑ** οπτική πηγή: παίρνει **έτοιμη screen-space** θέση + `type` +
  `description` και ζωγραφίζει `SnapShape` (το ίδιο SVG glyph) + ετικέτα + χρώμα. **Δεν** κάνει projection.
- **`SnapIndicatorOverlay`** (2D wrapper) — κρατά **μόνο** το 2D projection (`worldToScreen`) + το
  `isSnapMarkerVisible` gate, μετά καλεί `SnapIndicatorGlyph`. Ίδιο default export + props → μηδέν αλλαγή στους callers.

### Ροή 3D

```
use-bim3d-pointer-handlers handleMouseMove (throttle ~50ms, ίδιο cadence με hover/2D)
  → updateSnap3D → computeSnap3DHover(bimLayer.group, camera, dom, x, y):
       raycastWorldPoint            (front-most BIM surface → plan x,y + elevation)   [SSoT raycaster]
       worldToDxfPlan               (3D world → DXF-plan mm)                          [SSoT transforms]
       syncSnapEngineViewport3D     (pixel tolerance από το 3D zoom)                  [SSoT, ADR-402]
       getGlobalSnapEngine().findSnapPoint(plan)  (ίδιες γωνίες/μέσα/labels)          [SSoT, ADR-370]
       toSnapIndicatorView          (2D-shared view-model)                            [SSoT, ADR-137]
  → Snap3DOverlayStore.setSnap({ view, elevMm })   (low-freq, ADR-040)
BimSnapIndicatorOverlay3D (RAF):
  project plan→px (makeGripPlanToCanvas) → occlusion-cull (GripDepthOccluder) → wrapper transform (imperative)
  → renders SnapIndicatorGlyph (το ΙΔΙΟ glyph με τον 2D κάμβα)
```

- **elevMm** = το ύψος του front-most raycast hit → το σημάδι «κάθεται» στην επιφάνεια που δείχνει ο
  κέρσορας (η γωνία κολόνας φαίνεται εκεί που τη δείχνεις, όχι στο datum του δαπέδου).
- **Polygon Mode** (ADR-539, face paint) → το snap marker **κρύβεται** (`setSnap(null)`).
- **leave** → `setSnap(null)`.

## 3. ADR-040 συμμόρφωση

- `Snap3DOverlayStore` = **low-frequency** zustand (update στο hover throttle ~50ms, ΟΧΙ ανά frame), mirror
  του `Grip3DOverlayStore`.
- Η **per-frame** screen θέση **δεν** αποθηκεύεται/δεν προκαλεί React re-render: το `BimSnapIndicatorOverlay3D`
  την υπολογίζει στο RAF και την εφαρμόζει **imperative** σε `wrapper.style.transform` (zero high-freq React).
  Το glyph re-render-άρει (React) **μόνο** όταν αλλάζει η ταυτότητα (`type`/`description`).
- **Hide-during-motion**: όπως οι λαβές (`BimGripOverlay2D`), το σημάδι κρύβεται όσο κινείται η κάμερα και
  επανεμφανίζεται (σωστά occluded) στο settle. Ο occluder είναι **cached** σε κάμερα+count → frozen view = μηδέν κόστος.
- **Occlusion SSoT**: ο ΙΔΙΟΣ `GripDepthOccluder`. Σε ortho κάμερα ο occluder επιστρέφει all-visible (καμία απόκρυψη), όπως και στις λαβές.

## 4. Αρχεία

**NEW**
- `canvas-v2/overlays/SnapIndicatorGlyph.tsx` — κοινό screen-space glyph + label (SSoT, 2D+3D).
- `bim-3d/stores/Snap3DOverlayStore.ts` — low-freq store του ενεργού 3D σημαδιού.
- `bim-3d/viewport/snap/bim-3d-snap-hover.ts` — `computeSnap3DHover` (reuse μηχανής, μηδέν νέα λογική).
- `bim-3d/viewport/snap/BimSnapIndicatorOverlay3D.tsx` — RAF overlay (project + occlusion-cull + ίδιο glyph).
- `bim-3d/viewport/snap/__tests__/bim-3d-snap-hover.test.ts` — 5 tests (reuse contract).

**MODIFIED**
- `canvas-v2/overlays/SnapIndicatorOverlay.tsx` — delegates στο `SnapIndicatorGlyph` (ίδια συμπεριφορά/props).
- `bim-3d/viewport/use-bim3d-pointer-handlers.ts` — `updateSnap3D` στο throttled hover· clear στο leave.
- `bim-3d/viewport/BimViewport3D.tsx` — mount `<BimSnapIndicatorOverlay3D>`.

## 5. Σκόπιμα εκτός εμβέλειας (v1)

- **Raw DXF endpoints στο 3D**: ο raycast γίνεται στο `bimLayer.group` (δομικά σώματα). Τα ωμά DXF
  wireframes (ξεχωριστό dxfScene group) δεν παράγουν χαρακτηριστικά σημεία εδώ — εστίαση στο ζητούμενο (BIM).
- **Read-only Properties pipeline** (BimViewport3D χωρίς `CanvasSection`): το global snap engine
  initialize-άρεται από `useGlobalSnapSceneSync` (στο `CanvasSection`)· εκτός του κανονικού `/dxf/viewer`
  path το σημάδι απλώς δεν εμφανίζεται (κανένα crash).

## 6. Changelog

- **2026-06-27** — Αρχική υλοποίηση (ADR-542). Σπάσιμο `SnapIndicatorGlyph` SSoT· 3D snap-hover resolver
  (reuse `getGlobalSnapEngine` + `syncSnapEngineViewport3D` + `toSnapIndicatorView`)· `Snap3DOverlayStore`·
  `BimSnapIndicatorOverlay3D` (RAF projection + `GripDepthOccluder` cull, ίδιο 2D glyph/label/χρώμα)· wiring
  στους pointer handlers + mount στο `BimViewport3D`. 5 jest (snap-hover) GREEN. 🔴 browser-verify + commit.
