# DXF Viewer Grips Deep Research Report (Selection, Hot/Warm, Drag) - 2026-02-14

## 0) Scope
Αυτή η αναφορά καλύπτει:
1. Πώς γίνεται σήμερα η επιλογή grips και η μετακίνηση grips στο `dxf-viewer`.
2. Πού υπάρχουν ασυνέπειες/σφάλματα/σπασίματα αρχιτεκτονικής.
3. Πώς το κάνει η Autodesk (AutoCAD reference behavior) και τι πρέπει να αλλάξει για Autodesk-grade αποτέλεσμα.

---

## 1) Πραγματικό flow σήμερα (όπως υλοποιείται στον κώδικα)

### 1.1 Overlay grips (πολύγωνα/layers)
Κύριος runtime άξονας:
- `src/subapps/dxf-viewer/hooks/grips/useGripSystem.ts`
- `src/subapps/dxf-viewer/hooks/canvas/useCanvasMouse.ts`
- `src/subapps/dxf-viewer/hooks/layers/useOverlayLayers.ts`
- `src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerRenderer.ts`
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx`

Συνοπτικά:
1. Το `CanvasSection` κρατά state για `hoveredVertexInfo`, `hoveredEdgeInfo`, `selectedGrips`, `draggingVertices`, `draggingEdgeMidpoint`, `dragPreviewPosition` μέσω `useGripSystem`.
2. Σε `onMouseMove` (LayerCanvas callback μέσα στο `CanvasSection`) γίνεται hover detection για vertex πρώτα, μετά edge midpoint, με throttle 100ms.
3. Σε `handleContainerMouseDown` (`useCanvasMouse`) γίνεται:
- Shift+click toggle για vertex grips.
- απλό click: select + drag start.
- edge midpoint: immediate drag state για insert vertex.
4. Σε `handleContainerMouseUp` (`useCanvasMouse`) γίνεται commit drag:
- multi-vertex move via `MoveMultipleOverlayVerticesCommand`.
- edge midpoint add/update vertex μέσω overlay store calls.
5. `useOverlayLayers` μετατρέπει το grip state σε layer props (`hoveredVertexIndex`, `selectedGripIndices`, `dragState`) και ο `LayerRenderer` ζωγραφίζει cold/warm/hot grips.

### 1.2 DXF entity grips (γραμμές/κύκλοι/τόξα κ.λπ.)
Κύριος runtime άξονας:
- `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfRenderer.ts`
- `src/subapps/dxf-viewer/rendering/core/EntityRendererComposite.ts`
- `src/subapps/dxf-viewer/rendering/entities/BaseEntityRenderer.ts`
- `src/subapps/dxf-viewer/systems/cursor/useCentralizedMouseHandlers.ts`

Συνοπτικά:
1. Ο `DxfRenderer` βάζει `showGrips/grips` όταν entity είναι selected.
2. Τα grips αποδίδονται visual από renderers.
3. Δεν υπάρχει ενεργό runtime pipeline που να κάνει click σε DXF grip -> hot grip -> drag transform για την ίδια DXF οντότητα στον τρέχον flow.

---

## 2) Autodesk reference (πώς πρέπει να συμπεριφέρεται)
Βάσει Autodesk help:
- Grip editing modes με default `STRETCH`, και cycle με `Space`/`Enter` (Move/Rotate/Scale/Mirror).
- Multi-grip stretch με `Shift` + επιλογή πολλαπλών grips.
- Multifunctional grips με `Ctrl` ή dynamic grip menu (`GRIPMULTIFUNCTIONAL`).
- Ρυθμίσεις συμπεριφοράς/appearance από system variables (`GRIPS`, `GRIPSIZE`, `GRIPOBJLIMIT`, `GRIPBLOCK`, `GRIPTIPS`, κ.λπ.).

Πηγές:
- https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-DidYouKnow/files/GUID-BBEA1F71-EB16-4D49-80D9-970A6909F508.htm
- https://help.autodesk.com/cloudhelp/2021/ENU/AutoCAD-Core/files/GUID-01DE459C-21A7-4E92-A1D6-E2C36CD89F0C.htm
- https://help.autodesk.com/cloudhelp/2021/ENU/AutoCAD-LT/files/GUID-8656E4AA-593D-45B1-B134-D44BD0B2EC8D.htm
- https://help.autodesk.com/cloudhelp/2022/ENU/AutoCAD-Core/files/GUID-97AD30F3-A1A3-4027-91B7-49008841A447.htm
- https://help.autodesk.com/cloudhelp/2022/ENU/AutoCAD-LT/files/GUID-705F3A42-4A2F-4B5C-A2A6-0CF8949B8ED5.htm
- https://help.autodesk.com/cloudhelp/2022/ENU/AutoCAD-Core/files/GUID-8ADD9045-DD1B-416E-92E4-839C6FADC109.htm
- https://help.autodesk.com/cloudhelp/2022/ENU/AutoCAD-Core/files/GUID-325AE351-DEC3-41E9-BC9D-22A08D805261.htm
- https://help.autodesk.com/cloudhelp/2019/ENU/AutoCAD-LT/files/GUID-A88576CB-7CDD-4DC4-819C-EA0F892E72CB.htm

---

## 3) Findings (ασυνέπειες/σφάλματα)

## F1 - DXF grips φαίνονται κυρίως render-only, όχι πλήρες interaction
Severity: Critical
Evidence:
- `DxfRenderer.ts` ενεργοποιεί grips όταν selected.
- Δεν βρέθηκε κλήση `setGripInteractionState(...)` μέσα στο active DxfCanvas interaction path.
- Ο hot/warm/active κύκλος για DXF grips δεν τροφοδοτείται από πραγματικό input manager.
Impact:
- Ο χρήστης βλέπει grips σε DXF entities αλλά δεν έχει Autodesk-grade click-select-drag grip editing behavior.

## F2 - Παράλληλο/legacy grip pipeline εκτός active flow
Severity: High
Evidence:
- `hooks/useGripMovement.ts` και `systems/grip-interaction/GripInteractionManager.ts` υπάρχουν αλλά δεν συνδέονται στο ενεργό canvas interaction path.
Impact:
- Διπλή αρχιτεκτονική, αυξημένο ρίσκο drift και confusion για μελλονικές αλλαγές.

## F3 - Split interaction ownership (container + canvas)
Severity: High
Evidence:
- Grip drag/selection σε `useCanvasMouse` (container handlers).
- Παράλληλα selection/marquee/hit-test/snap σε `useCentralizedMouseHandlers` (canvas handlers).
Impact:
- Πολύπλοκο event ordering, δύσκολο deterministic debugging, αυξημένη πιθανότητα edge regressions.

## F4 - `newVertexCreated` branch πρακτικά ανενεργό
Severity: Medium
Evidence:
- `DraggingEdgeMidpointState.newVertexCreated` αρχικοποιείται `false`.
- Δεν εντοπίστηκε σημείο που το κάνει `true` πριν το mouse-up branch.
Impact:
- Dead branch, θόρυβος στη λογική, πιθανή παρανόηση για intended live insert/update flow.

## F5 - Edge midpoint insert/update έξω από command pattern
Severity: High
Evidence:
- Σε `useCanvasMouse` edge midpoint drag end χρησιμοποιεί απευθείας `overlayStore.addVertex/updateVertex`.
- Multi-vertex move χρησιμοποιεί command (`MoveMultipleOverlayVerticesCommand`).
Impact:
- Ασυνέπεια undo/redo semantics μεταξύ τύπων grip edit.

## F6 - `multiGripEdit`/`snapToGrips` ρυθμίσεις δεν εφαρμόζονται καθαρά στο interaction runtime
Severity: High
Evidence:
- Οι ρυθμίσεις υπάρχουν σε πολλά stores/types.
- Το active click/drag path (`useCanvasMouse`) δεν κάνει σαφή gate το behavior βάσει `multiGripEdit`.
- `snapToGrips` κυρίως εμφανίζεται σε settings/storage, όχι σε ενιαίο interaction gate.
Impact:
- Ο χρήστης αλλάζει setting αλλά η συμπεριφορά μπορεί να μην αντανακλά συνεπώς τη ρύθμιση.

## F7 - Πολλαπλές πηγές αλήθειας για grip defaults/state
Severity: High
Evidence:
- Defaults και contracts σε `types/gripSettings.ts`, `settings-core/defaults.ts`, `settings/FACTORY_DEFAULTS.ts`, `stores/GripStyleStore.ts`, runtime overrides σε `DxfViewerContent.tsx`.
- Mapping `enabled` ↔ `showGrips` σε διάφορα σημεία.
Impact:
- Configuration drift και μη ντετερμινιστικό startup/runtime behavior.

## F8 - Forced grip rendering bypass
Severity: Medium
Evidence:
- Στο `BaseEntityRenderer.ts` υπάρχει commented guard που πρακτικά παρακάμπτει το `showGrips` check.
Impact:
- Ρίσκο παραβίασης user setting και απρόβλεπτη εμφάνιση grips.

## F9 - Hover throttling 100ms στο grip detection
Severity: Medium
Evidence:
- `CanvasSection.tsx` grip hover throttle = 100ms (~10fps).
Impact:
- Laggy feedback σε hot/warm transitions σε σύγκριση με CAD-grade αίσθηση.

## F10 - Incomplete Autodesk parity features
Severity: Medium
Evidence:
- Δεν φαίνεται ολοκληρωμένη υλοποίηση grip mode cycling (Stretch/Move/Rotate/Scale/Mirror).
- Δεν φαίνεται multifunctional grip menu/Ctrl cycling pipeline.
- Δεν φαίνεται GRIPOBJLIMIT-style suppress policy στον active grip renderer path.
Impact:
- Σημαντική απόσταση από Autodesk interaction model.

---

## 4) Τι θα υλοποιούσα για να γίνει Autodesk-grade

### Phase A - Unification (must)
1. Ένα canonical `GripInteractionSystem` για ΟΛΑ (overlay + DXF entities).
2. Αφαίρεση/retire legacy pipelines (`useGripMovement`, `GripInteractionManager`) ή πλήρης ενσωμάτωση στο canonical path.
3. Μία authoritative ροή event handling (όχι split container/canvas ownership για τον ίδιο κανόνα).

### Phase B - Behavior parity
1. Cold/Warm/Hot deterministic state machine.
2. Click grip -> hot grip -> default STRETCH.
3. `Space/Enter` mode cycle: Stretch/Move/Rotate/Scale/Mirror.
4. Shift multi-grip selection με σταθερό deterministic ordering.
5. Ctrl multifunctional grip options + context menu.

### Phase C - Settings parity
1. Ενοποίηση `enabled/showGrips` και όλων των defaults σε ένα source.
2. Runtime enforcement για `multiGripEdit`, `snapToGrips`, `showGripTips`, `maxGripsPerEntity`.
3. Προσθήκη `gripObjectLimit` policy (AutoCAD GRIPOBJLIMIT-style).

### Phase D - Undo/Redo consistency
1. Όλες οι grip operations μέσω command pattern (και edge midpoint insert/update).
2. Consistent transactional behavior για single/multi grip edits.

### Phase E - Performance and diagnostics
1. Adaptive hover throttle (frame-budget aware, όχι fixed 100ms).
2. Grip diagnostics overlay (active grip, mode, latency, candidate).
3. Telemetry: hover-to-hot latency, drag commit time, undo failures, dropped frames.

---

## 5) Suggested acceptance criteria
1. DXF και overlay grips έχουν ίδιο interaction contract (hover→hot→drag→commit).
2. Multi-grip και single-grip edits είναι undo/redo safe με ίδιο command path.
3. Settings changes (`multiGripEdit`, `snapToGrips`, `showGrips`) εφαρμόζονται άμεσα και προβλέψιμα.
4. Hover feedback <= 1 frame average under normal scene load.
5. Autodesk-style mode cycling και Ctrl multifunction behavior επαληθευμένα.

---

## 6) Executive Summary
Το σύστημα grips έχει καλή οπτική βάση για overlays, αλλά σε επίπεδο interaction architecture είναι split και μερικώς ασυνεπές. Για να φτάσει Autodesk-grade επίπεδο χρειάζεται ενοποίηση σε έναν canonical grip interaction engine, πλήρη command-based commit για όλες τις επεμβάσεις, και αυστηρή εναρμόνιση settings/runtime behavior.
