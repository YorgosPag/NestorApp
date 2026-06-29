# ADR-552: Analytical Overlay Dispatch Canvas — 7 καμβάδες → 1 (υλοποίηση ADR-551 §5.2 #1)

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟡 IMPLEMENTED (UNCOMMITTED) |
| **Date** | 2026-06-29 |
| **Last Updated** | 2026-06-29 |
| **Category** | Canvas & Rendering |
| **Location** | `src/subapps/dxf-viewer/components/dxf-layout/analytical-overlays/` |
| **Author** | Claude (υλοποίηση κατόπιν εντολής Giorgio) |
| **Related ADRs** | **ADR-551** §5.2 #1 (census — η ευκαιρία), ADR-040 (2D perf / micro-leaf), ADR-422 (heat-load/pipe-sizing/balancing L1/L3/L4), ADR-483 (M/V/N diagrams), ADR-485 (utilization), ADR-490 (warnings), ADR-408 §Φ15 (riser-through) |

---

## Summary

Το ADR-551 κατέγραψε ότι το 2D viewport κρατούσε **7 ξεχωριστά `<canvas>` analytical overlays** μόνιμα στο DOM (καθένα με δικό του `getContext('2d')` + backing store), ενώ **6 από αυτά είναι συνήθως άδεια** (αμοιβαία αποκλειόμενα στην πράξη). Αυτό το ADR υλοποιεί την ευκαιρία **§5.2 #1**: τα 7 ενοποιούνται σε **ΕΝΑΝ** «analytical dispatch canvas», με το ίδιο SSoT πρότυπο που έχει ήδη ο 2D `PreviewCanvas` (ΕΝΑΣ καμβάς, dispatch σε painters).

**Αποτέλεσμα:** 2D max canvases **24 → 18**· typical **~16 → ~10**. Μηδέν αλλαγή οπτικού αποτελέσματος, μηδέν αλλαγή λογικής (paint κώδικας μεταφέρθηκε **verbatim**).

---

## Context — γιατί όχι imperative push (όπως PreviewCanvas tool-ghosts)

Ο `PreviewCanvas` χρησιμοποιεί **push**: κάθε tool-ghost hook επιστρέφει `null` και ζωγραφίζει στον κοινό καμβά μέσω imperative handle. **Δεν ταιριάζει εδώ**, γιατί κάθε analytical overlay έκανε full `clearRect` του καμβά — αν μοιράζονταν καμβά με push, θα έσβηναν μεταξύ τους.

Άρα **pull model**: ο dispatch κατέχει τον καμβά, κάνει size+clear **ΜΙΑ** φορά, και καλεί τους ενεργούς painters με σειρά (z-order). Κάθε painter ζωγραφίζει μόνο το περιεχόμενό του (κανένα clear/resize).

**Γιατί ήταν ασφαλής η συγχώνευση (από ADR-551 §1 audit):** και τα 7 overlays ήταν **πανομοιότυπα** — leaf subscriptions (`ViewMode3DStore.mode` + δικό τους toggle/store) → derived data (memo/data-hook) → `useEffect` (dpr size + clear + paint, gated σε `active`) → `<canvas z-10 pointer-events-none>`. Κανένα RAF/pointer-handler/2ο canvas/hover. Mount μόνο στο `canvas-layer-stack-2d-overlays-leaf.tsx`.

---

## Decision

### Αρχιτεκτονική (3 επίπεδα)

```
canvas-layer-stack-2d-overlays-leaf.tsx
  └─ <AnalyticalDispatchCanvas transform viewport />   ← ΕΝΑΣ <canvas data-dxf-overlay="analytical">
       ├─ useRiserThroughPainter()        → AnalyticalPainter | null   (z-order: 1ος)
       ├─ useHeatLoadPainter()            → …
       ├─ usePipeSizingPainter()          → …
       ├─ useHydraulicBalancingPainter()  → …
       ├─ useStructuralUtilizationPainter() → …
       ├─ useStructuralDiagramPainter()   → …
       └─ useStructuralWarningPainter()   → AnalyticalPainter | null   (z-order: τελευταίος = topmost)
       useEffect → paintAnalyticalFrame(canvas, painters, transform, viewport)
```

### Κοινός τύπος + pure renderer (`analytical-painter.ts`)
```ts
export type AnalyticalPainter = (ctx, transform: ViewTransform, viewport: Viewport) => void;
export function paintAnalyticalFrame(canvas, painters: readonly (AnalyticalPainter|null)[], transform, viewport): void;
// dpr-aware resize (μόνο όταν αλλάζει) → setTransform → clearRect ΜΙΑ φορά → for p of painters: if (p) p(ctx, transform, viewport)
```

### Painter hooks (7× `use-*-painter.ts`)
Κάθε hook μετέφερε **αυτούσιες** τις subscriptions + data derivation + paint helpers του αντίστοιχου πρώην `*Overlay.tsx`, και επιστρέφει `useMemo<AnalyticalPainter|null>` — `null` όταν ανενεργό/κενό (gate στο δικό του store), αλλιώς closure που capture-άρει τα low-freq δεδομένα. **`transform`/`viewport` περνούν ως args** (όχι capture) → ο painter μένει memoized στα δεδομένα του και δεν αλλάζει ταυτότητα σε κάθε pan/zoom· ο dispatch effect ξανατρέχει στο `transform`/`viewport`.

### ADR-040 συμμόρφωση
- Ο `AnalyticalDispatchCanvas` είναι **leaf** (παιδί του 2d-overlays group), **όχι** ο shell `CanvasLayerStack` → **CHECK 6C ασφαλές** (κανένα νέο `useSyncExternalStore` στον shell).
- Αθροιστικά οι **ίδιες** subscriptions με τα 7 παλιά overlays, απλώς σε ΕΝΑ component. Όλες **low-freq** (toggles / FEM analysis / diagnostics), όχι 60fps → καμία perf regression. Σε αλλαγή ενός toggle ξαναϋπολογίζονται και οι 7 painters, αλλά οι ανενεργοί επιστρέφουν `null` φθηνά (internal gate).
- Σε 3D mode (`mode !== '2d'`): όλοι οι painters → `null` → ΕΝΑΣ άδειος καμβάς αντί 7.

---

## Files

**ΝΕΑ** (`components/dxf-layout/analytical-overlays/`): `analytical-painter.ts` (type + pure renderer), `use-riser-through-painter.ts`, `use-heat-load-painter.ts`, `use-pipe-sizing-painter.ts`, `use-hydraulic-balancing-painter.ts`, `use-structural-utilization-painter.ts`, `use-structural-diagram-painter.ts`, `use-structural-warning-painter.ts`, `AnalyticalDispatchCanvas.tsx`, `__tests__/analytical-painter.test.ts`.

**MODIFIED:** `canvas-layer-stack-2d-overlays-leaf.tsx` (7 `<XOverlay>` → 1 `<AnalyticalDispatchCanvas>`· AutoArea/RegionPerimeter αμετάβλητα).

**DELETED:** `HeatLoadOverlay.tsx`, `PipeSizingOverlay.tsx`, `HydraulicBalancingOverlay.tsx`, `StructuralUtilizationOverlay.tsx`, `StructuralDiagramOverlay.tsx`, `StructuralWarningOverlay.tsx`, `RiserThroughOverlay.tsx`.

**Reuse (μηδέν νέα λογική):** `getDevicePixelRatio`, `CoordinateTransforms.worldToScreen`, `pillPath/PILL_BG_COLOR/contrastTextColor`, όλα τα data hooks/stores/color/draw modules αυτούσια.

---

## Consequences
- **Pro:** −6 canvas DOM nodes + backing stores μόνιμα στο DOM· ΕΝΑ clear/frame αντί 7· ίδιο SSoT πρότυπο με PreviewCanvas· μελλοντικό νέο analytical layer = νέος painter hook (όχι νέος `<canvas>`).
- **Con:** ο dispatch ξανα-render-άρει σε αλλαγή οποιουδήποτε από τα 7 stores (όλα low-freq → αμελητέο).
- **Verify:** GOL jest (`analytical-painter.test.ts`, 6/6 GREEN) — clear-once / z-order / skip-null / empty(3D) / dpr-resize-on-change / no-ctx. Browser: toggle κάθε analytical view → ίδιο οπτικό· pan/zoom anchored· warnings always-on· ΕΝΑΣ `<canvas data-dxf-overlay="analytical">`.
- ADR-040 CHECK 6B/6D: αλλαγή canvas-layer αρχείων → stage ADR-040 + ADR-552.

---

## Changelog

### 2026-06-29 — Υλοποίηση (UNCOMMITTED)
7 analytical overlays (`*Overlay.tsx`) → 1 `AnalyticalDispatchCanvas` + 7 painter hooks + pure `paintAnalyticalFrame` (pull model). Paint κώδικας μεταφέρθηκε verbatim· z-order διατηρήθηκε (riser→heat→pipe→balancing→utilization→diagram→**warning**). 6/6 jest GREEN. Υλοποιεί ADR-551 §5.2 #1. 🔴 browser-verify + commit (Giorgio· stage ADR-040+551+552, CHECK 6B/6D).

### 2026-06-29 — Follow-up: διόρθωση `src/subapps/dxf-viewer/jest.config.ts` (UNCOMMITTED)
Κατά την επικύρωση του test βρέθηκε ότι το subapp jest config ήταν **divergent & ποτέ λειτουργικό** από τον subapp φάκελο: (1) τα `projects[]` δεν κληρονομούσαν transform → babel χωρίς TS· (2) `@/`→ανύπαρκτο `subapp/src`· (3) glob `testPathIgnorePatterns` άκυρα ως regex → crash σε κάθε test-name filter· (4) `test/setupTests.ts` `const jest=…` συγκρούεται με CJS jest-param (root τρέχει ESM). **Fix (SSoT):** το config έγινε **thin extension** του canonical root `jest.config.js` (`{...rootConfig, rootDir:'../../../', roots:['<rootDir>/src/subapps/dxf-viewer']}`) — κληρονομεί @swc/jest, ESM, `jest.setup.js`, asset/server-only mocks, `@/`→root src. Targeted run πλέον δουλεύει (`npx jest analytical-painter` 6/6· υπαρκτό suite canvas-pill 14/14). Τα legacy `test/setupTests.ts`/`setupCanvas.ts` (σπασμένα/αχρησιμοποίητα — έσπαγαν και στο tsc baseline) **διαγράφηκαν** (καμία ζωντανή αναφορά).
