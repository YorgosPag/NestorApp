# ADR-554 — MEP Proposal-Ghost Dispatch Canvas (7 → 1)

**Status:** 🟡 IMPLEMENTED (UNCOMMITTED)
**Date:** 2026-06-29
**Domain:** Canvas & Rendering / DXF Viewer / MEP auto-design
**Implements:** ADR-551 §5.2 #2
**Related:** ADR-552 (analytical dispatch canvas — sibling pattern), ADR-040 (preview-canvas micro-leaf), ADR-426–434 (the 7 MEP auto-design disciplines)

---

## 1. Πρόβλημα

Οι 7 MEP auto-design proposal ghosts (water/drainage/heating/electrical/HVAC/fire/gas — census #15–#21) είχαν ο καθένας **δικό του `<canvas>`** μέσω του shared `ProposalGhostOverlay`. Πρακτικά **ένα proposal review κάθε φορά** → 6 άδειοι (ή ανύπαρκτοι) canvas backing stores + **7 ξεχωριστές scheduler subscriptions** (`subscribeImmediateTransformFrame`, μία ανά discipline).

## 2. Απόφαση

ΕΝΑ **zero-lag dispatch canvas** (`ProposalDispatchCanvas`) που αντικαθιστά και τα 7, ακριβώς όπως το ADR-552 έκανε για τα analytical overlays — αλλά **zero-lag** (scheduler-driven), όχι React-`useEffect`-driven, γιατί τα proposals πρέπει να ακολουθούν pan/zoom frame-for-frame.

**Pull model:** ο dispatch κάνει size+clear **ΜΙΑ** φορά και καλεί τους 7 painter hooks με σειρά z-order. Κάθε hook self-subscribes στο δικό του low-freq proposal store και επιστρέφει memoized painter (`null` όταν δεν υπάρχει review). Paint κώδικας **verbatim** από τα 7 πρώην mounts.

### SSoT — ΕΝΑΣ frame renderer για analytical + proposal

Το `paintAnalyticalFrame` (ADR-552) και το proposal frame renderer θα ήταν **byte-identical** (size+clear+ordered-paint). Αντί για διπλότυπο (που θα έσκαγε στο CHECK 3.18 structural-duplicates ratchet), εξήχθη **ΕΝΑΣ** shared renderer:

- **ΝΕΟ** `overlay-dispatch/overlay-dispatch-frame.ts` — `paintOverlayDispatchFrame` + `OverlayDispatchPainter` (ο μόνος frame renderer).
- `analytical-overlays/analytical-painter.ts` → thin re-export aliases (`paintAnalyticalFrame = paintOverlayDispatchFrame`, `AnalyticalPainter = OverlayDispatchPainter`) → οι 7 analytical hooks + dispatch + test **αμετάβλητοι**.
- Το `ProposalDispatchCanvas` χρησιμοποιεί τον shared renderer απευθείας.

Η διαφορά analytical↔proposal είναι **μόνο** ο trigger του repaint (React effect vs zero-lag scheduler) + οι painters + το z-index (analytical z-10, proposal z-[14]) — ο per-frame βρόχος είναι κοινός.

## 3. Zero-lag μηχανισμός

Το `ProposalDispatchCanvas` κρατά `paintersRef`/`viewportRef` (ενημερώνονται κάθε render) και:
- **ΜΙΑ** `subscribeImmediateTransformFrame('proposal-dispatch', …)` → ο scheduler callback διαβάζει `getImmediateTransform()` στο draw time (zero-lag pan/zoom), για όλους τους 7 disciplines.
- `useEffect` σε painter-identity/viewport → repaint σε proposal change/resize (όπου το transform δεν άλλαξε).

ADR-040: leaf component (παιδί του preview-mounts group)· ο shell `CanvasLayerStack` **δεν** αποκτά νέο `useSyncExternalStore` (CHECK 6C safe). Αθροιστικά οι **ίδιες** low-freq subscriptions με τα 7 πρώην overlays, σε ΕΝΑ component· καμία 60fps.

## 4. Αρχεία

| Αρχείο | Αλλαγή |
|--------|--------|
| `components/dxf-layout/overlay-dispatch/overlay-dispatch-frame.ts` | **ΝΕΟ** shared `paintOverlayDispatchFrame` + `OverlayDispatchPainter`. |
| `components/dxf-layout/overlay-dispatch/__tests__/overlay-dispatch-frame.test.ts` | **ΝΕΟ** 6/6 jest. |
| `components/dxf-layout/analytical-overlays/analytical-painter.ts` | Thin re-export aliases στον shared renderer (μηδέν churn στους analytical importers). |
| `components/dxf-layout/proposal-overlays/ProposalDispatchCanvas.tsx` | **ΝΕΟ** zero-lag dispatch (7 hooks, z-[14]). |
| `components/dxf-layout/proposal-overlays/use-{water,drainage,heating,electrical,hvac,fire,gas}-proposal-painter.ts` | **ΝΕΑ** 7 painter hooks (paint verbatim από τα πρώην mounts). |
| `components/dxf-layout/canvas-layer-stack-preview-mounts.tsx` | 7 imports+mounts → 1 `<ProposalDispatchCanvas>` (CHECK 6D → stage ADR-040). |
| `components/dxf-layout/canvas-layer-stack-{water,drainage,heating,electrical,hvac,fire,gas}-proposal-ghost.tsx` | **ΔΙΑΓΡΑΦΗ** (7). |
| `components/dxf-layout/ProposalGhostOverlay.tsx` + `__tests__/ProposalGhostOverlay.test.tsx` | **ΔΙΑΓΡΑΦΗ** (η React-render test αντικαθίσταται από την pure `overlay-dispatch-frame` test). |

**Reuse αμετάβλητα:** `proposal-ghost-paint.ts` (`paintGhostSegments`), `MepWireRenderer.drawCircuitWires`, τα 7 proposal stores, `mmToSceneUnits`, `resolveSegmentClassificationColor`/`hexToRgba`, `subscribeImmediateTransformFrame`, `getImmediateTransform`.

## 5. Census impact (ADR-551)

2D max **18 → 12**, typical **~10 → ~4**. Canvas DOM nodes για proposals: 0–7 (conditional) → **1** (always). Scheduler registrations: **7 → 1**.

## 6. Risks
- **Auto-clear-on-unmount trade-off (ADR-551 §5.4):** πριν, `active=false` → unmount → καθαρό. Τώρα όλοι οι painters `null` → ο dispatch κάνει `clearRect` (κενός, αόρατος canvas, πάντα στο DOM). Stale pixels αδύνατα (clear-once πριν κάθε frame). Καλύπτεται από test «all-null clears».
- **Z-order / mutual-exclusivity:** πρακτικά ένα proposal κάθε φορά· αν συνυπήρχαν, ordered passes (water→gas) = ίδιο με την παλιά DOM στοίβαξη. Μηδέν regression.

## 7. Verification
- `cd src/subapps/dxf-viewer && npx jest overlay-dispatch-frame` → 6/6 (+ analytical-painter 6/6 μέσω alias).
- Browser (Giorgio): κάθε discipline «Generate» → ghost εμφανίζεται/σβήνει σωστά· pan/zoom zero-lag· DevTools → ΕΝΑ `<canvas data-dxf-overlay="proposal-dispatch">`, κανένα `water-proposal`/… παλιό.

## Changelog
- **2026-06-29** — Initial. Υλοποίηση ADR-551 §5.2 #2: 7 proposal ghosts → 1 zero-lag dispatch canvas. Shared `paintOverlayDispatchFrame` SSoT (analytical + proposal, μηδέν duplicate). 12/12 jest. UNCOMMITTED — εκκρεμεί διαγραφή 9 orphaned αρχείων (Giorgio authorization) + browser-verify + commit.
