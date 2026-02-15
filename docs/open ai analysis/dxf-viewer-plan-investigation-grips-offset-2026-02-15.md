# DXF Viewer Plan-Mode Investigation Report

Date: 2026-02-15
Scope: `src/subapps/dxf-viewer`
Subject: Click-vs-crosshair vertical mismatch, grip behavior regressions, and grip SSoT inconsistencies

## Executive Summary

Τα προβλήματα που περιγράφεις είναι **πραγματικά** και προκύπτουν από **μη πλήρη Single Source of Truth** σε 3 επίπεδα:

1. Συντεταγμένες pointer/click (πολλαπλές πηγές και όχι πάντα ίδιο element snapshot)
2. Grip interaction semantics (DXF grips = click-to-commit model, όχι drag-release commit)
3. Grip rendering/styling rules (διαφορετικοί κανόνες για DXF entities vs colored layers)

Αποτέλεσμα: ασυνέπεια σε Y-offset, rollback αίσθηση στα grips, και διαφορετικά χρώματα/μεγέθη/συμπεριφορά.

---

## Finding 1: Y-only Click vs Crosshair Mismatch (High)

### Evidence
- `src/subapps/dxf-viewer/hooks/canvas/useCanvasMouse.ts:325`
  - Το container handler γράφει `updatePosition(screenPos)` με `screenPos` από **container rect**.
- `src/subapps/dxf-viewer/systems/cursor/useCentralizedMouseHandlers.ts:302`
  - Το DxfCanvas handler γράφει pointer από **DxfCanvas rect** (`setImmediatePosition(screenPos)` + cursor updates).
- `src/subapps/dxf-viewer/systems/cursor/useCentralizedMouseHandlers.ts:650`
  - Σε small-selection path χρησιμοποιείται `cursor.position` (state) για click world conversion.
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1834`
  - Γίνεται world conversion από `screenPoint` με snapshot του **container**.

### Why this matches your symptom
- Όταν δύο διαφορετικά coordinate origins (container vs canvas) συνυπάρχουν, το offset εμφανίζεται συχνά μόνο σε έναν άξονα.
- Εδώ το X συνήθως ευθυγραμμίζεται, ενώ το Y επηρεάζεται από top/height διαφοροποιήσεις και ruler offsets.

### Confidence
- **High**

---

## Finding 2: Vertical Drift Risk from Transform Sync Split (High)

### Evidence
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:176`
  - Υπάρχει ειδική λογική για viewport-height αλλαγή που τροποποιεί **μόνο offsetY**.
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:387`
  - `newOffsetY = currentTransform.offsetY + deltaHeight`.
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:195`
  - Ήδη documented historical issue: λάθος `screenToWorld` με Y-offset.
- `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfCanvas.tsx:...`
  - Render path δουλεύει με refs/current values, ενώ input handlers δέχονται `transform` prop.

### Why this matters
- Σε resize/toolbar open-close στιγμές, render και input μπορεί να βλέπουν διαφορετικό transform timing.
- Το πρόβλημα χτυπά κυρίως στον Y άξονα (offsetY-only compensation).

### Confidence
- **Medium-High**

---

## Finding 3: Rectangle Grip “Returns to Original Position” (High)

### Evidence
- `src/subapps/dxf-viewer/hooks/useDxfGripInteraction.ts:480+`
  - Η commit λογική γίνεται σε **δεύτερο click** όταν phase=`following`.
- `src/subapps/dxf-viewer/hooks/useDxfGripInteraction.ts:434`
  - Στο mouse move γίνεται μόνο preview update (`currentWorldPos`), όχι commit.
- Δεν υπάρχει drag-release commit path στο συγκεκριμένο interaction hook.

### Why this matches your symptom
- Αν ο χρήστης περιμένει AutoCAD-style drag-and-release commit, εδώ το σύστημα λειτουργεί click-activate → move cursor → click-commit.
- Αν release γίνει χωρίς commit click, φαίνεται σαν να “επιστρέφει” στην αρχική θέση.

### Confidence
- **High**

---

## Finding 4: Midpoint Grip Moves Whole Rectangle by Design (High)

### Evidence
- `src/subapps/dxf-viewer/hooks/useDxfGripInteraction.ts:... computeDxfEntityGrips`
  - Για `polyline`, τα edge/midpoint grips δηλώνονται `movesEntity: true`.
- `src/subapps/dxf-viewer/hooks/useDxfGripInteraction.ts:493-500`
  - Αν `movesEntity=true`, εκτελείται `moveEntities(...)` (όλο το entity).

### Why this matches your symptom
- Αυτό εξηγεί ακριβώς γιατί το midpoint του ορθογωνίου μετακινεί ολόκληρο το ορθογώνιο αντί για την πλευρά.

### Confidence
- **High**

---

## Finding 5: Colored Layer Midpoint Behavior Is Different (High)

### Evidence
- `src/subapps/dxf-viewer/hooks/canvas/useCanvasMouse.ts:470+`
  - Edge-midpoint click ξεκινά `draggingEdgeMidpoint` flow.
- `src/subapps/dxf-viewer/hooks/canvas/useCanvasMouse.ts:550+`
  - Στο mouse-up, edge midpoint flow κάνει **insert/update vertex**, όχι edge-stretch.
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1068+`
  - Edge midpoint click path κάνει `addVertex`.

### Why this matches your symptom
- Τα colored layers ακολουθούν “insert vertex” semantics για midpoint, ενώ τα DXF entity grips έχουν άλλο μοντέλο.
- Άρα δεν υπάρχει ενιαία συμπεριφορά midpoint σε όλες τις οντότητες.

### Confidence
- **High**

---

## Finding 6: Grip Color/Size Mismatch Between DXF Entities and Colored Layers (High)

### Evidence
- `src/subapps/dxf-viewer/rendering/entities/BaseEntityRenderer.ts:250`
  - Edge/midpoint grips σε DXF entities: base χρώμα `UI_COLORS.GRIP_DEFAULT` (πράσινο behavior baseline).
- `src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerRenderer.ts:717`
  - Colored layer edge grips είναι `baseEdgeSize = gripSize * 0.6` (μικρότερα by design).
- `src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerRenderer.ts:724`
  - Cold edge color = `UI_COLORS.GRIP_EDGE` (γκρι by design).

### Why this matches your symptom
- Εξηγεί ακριβώς το “μεσαίο grip πιο μικρό/γκρι” και τα endpoint grips να φαίνονται διαφορετικά από άλλες οντότητες.

### Confidence
- **High**

---

## Root Cause Pattern (SSoT)

Το σύστημα δεν έχει ακόμα μία ενιαία πηγή αλήθειας για:
- pointer coordinate authority (container + canvas paths)
- grip interaction semantics (DXF click-commit vs overlay insert-vertex model)
- grip visual tokens (διαφορετικά renderer rules ανά οικογένεια οντοτήτων)

---

## Priority Fix Direction (Owner-level)

1. **Unify coordinate authority**
- Όλα τα pointer writes και click world conversions από ένα canonical element path (ίδιο snapshot source).
- Αποφυγή χρήσης `cursor.position` σε click-finalization όταν υπάρχει fresh event target snapshot.

2. **Unify grip interaction semantics**
- Απόφαση μία: είτε click-commit είτε drag-release commit, για όλες τις οντότητες.
- Midpoint semantics να οριστεί κεντρικά (edge-stretch vs entity-move vs vertex-insert) και να εφαρμοστεί οριζόντια.

3. **Unify grip styling tokens**
- Ίδια sizing/color temperature policy για DXF entities και colored layers, με role-based εξαιρέσεις μόνο αν τεκμηριωθούν.

4. **Stabilize resize/offsetY pipeline**
- Εξάλειψη transient split μεταξύ render-transform και input-transform σε resize events.

---

## Final Verdict

Τα bugs που ανέφερες δεν είναι μεμονωμένα. Είναι συνέπεια αρχιτεκτονικής ασυνέχειας σε SSoT (coordinates + grip behavior + grip style).

Status: **Confirmed / Reproducible by code path analysis**.
