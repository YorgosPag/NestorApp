# ADR-403 — 3D Viewport BIM Element Placement (Column)

| Field | Value |
|---|---|
| Status | 🟢 ACCEPTED — Column placement DONE (pending commit, 🔴 browser verify) |
| Date | 2026-06-01 |
| Owner | Giorgio / Claude (Opus 4.8) |
| Related | ADR-402 (3Δ BIM editing), ADR-366 (3Δ viewport), ADR-363 (BIM column tool/FSM), ADR-399 (multi-floor 3Δ), ADR-398 (column corner snap), ADR-040 (micro-leaf), ADR-009 (3Δ units) |

---

## Context

Στο `/dxf/viewer`, η ADR-402 έφερε **επεξεργασία** υπαρχόντων δομικών στοιχείων στο 3Δ
(move/rotate/resize gizmos). Όμως η **δημιουργία** νέου στοιχείου παρέμενε αδύνατη στο
3Δ: επιλέγοντας «Κολώνα» από το ribbon ενώ ήσουν σε 3Δ, το εργαλείο ενεργοποιούνταν
(δεν υπάρχει gate) αλλά **το κλικ δεν τοποθετούσε τίποτα**.

**Αιτία (αρχιτεκτονική):** όλος ο μηχανισμός τοποθέτησης κολώνας ήταν δεμένος
αποκλειστικά στον 2Δ καμβά — ο μόνος κώδικας που καλεί `columnTool.onCanvasClick()`
είναι το `useCanvasClickHandler` (2Δ pipeline). Το `BimViewport3D` κάθεται από πάνω
(z-50) και «καταπίνει» τα pointer events (`stopPropagation`), ενώ ο 3Δ click handler
(`useBim3DPointerHandlers`) ξέρει **μόνο** επιλογή/περιστροφή υπαρχόντων στοιχείων.

**Κρίσιμη διαπίστωση (έρευνα 3 Explore agents):**
- Το `useColumnTool.onCanvasClick(point)` περιμένει `Point2D` στις **scene units** — το
  `clickPoint` αποθηκεύεται **verbatim** ως `params.position` με το `sceneUnits` δίπλα
  (`buildDefaultColumnParams`). Καμία μετατροπή στη διαδρομή.
- Το column tool παραμένει **ενεργό** σε 3Δ (mounted στο `CanvasSection` μέσω
  `useSpecialTools`, χωρίς 3Δ gate).
- Μετά τη δημιουργία, το 3Δ **συγχρονίζεται αυτόματα**:
  `addColumnToScene → ColumnPersistenceHost → setColumns → BimViewport3D subscription →
  resyncBimScene`. Δεν χρειάζεται τίποτα extra για να εμφανιστεί η νέα κολώνα.

**Συνέπεια:** Η 3Δ τοποθέτηση είναι **γέφυρα** — 3Δ κλικ → προβολή στο floor XY-plane →
`Point2D` (scene units) → υπάρχον column FSM. Μηδέν διπλασιασμός εντολών/builders.

---

## Decision

### Εύρος (απόφαση Giorgio 2026-06-01)
- **Μόνο Κολώνα** σε αυτή τη φάση· η αρχιτεκτονική (raycast + convert + ghost + EventBus
  bridge) είναι **επεκτάσιμη** για τοίχο/δοκάρι/πλάκα αργότερα.
- **Όροφος:** πάντα ο **ενεργός** όροφος (single → y=0· multi «Όλοι» → elevation του
  ενεργού ορόφου από το `FloorStackEntry`). Ίδια συμπεριφορά με 2Δ.

### Αρχιτεκτονική

Νέο hook **`useBim3DColumnPlacement({ managerRef, canvasEl })`** mounted μέσα στο
`BimViewport3D` (δίπλα στο `useBim3DEditInteraction`, ίδιο shape ADR-402: ένα `useEffect`
+ AbortController-gated DOM listeners, χωρίς `useSyncExternalStore` — ADR-040).

Ροή:
1. **Gate:** armed μόνο όταν `toolStateStore.activeTool === 'column'` **ΚΑΙ** `selectIs3D`.
   Subscribe σε `toolStateStore` + `useViewMode3DStore` → setup/teardown.
2. **Raycast δαπέδου** (SSoT `raycast-floor-point.ts`): `clientToNdc` (reuse, εξήχθη από
   `BimEntityRaycaster`) → `raycaster.ray.intersectPlane(computeFloorPlane(elev))`.
   `resolveActiveFloorElevationMm()`: single → 0· all → elevation ενεργού ορόφου.
3. **Μετατροπή** (SSoT `world-to-scene-point.ts`): `worldToDxfPlan(world)` (mm) `×
   mmToSceneUnits(units)` → 2Δ σημείο στις scene units. `units` από το **ίδιο**
   `columnToolBridgeStore.getSceneUnits()` που τρέφει το column tool → αδύνατη απόκλιση
   μονάδων (αλλιώς το γνωστό 1000× off-screen bug).
4. **Ghost** (`ColumnPlacementGhost`): ημιδιαφανές mesh μέσω των **ίδιων** SSoT builders
   (`buildDefaultColumnParams → computeColumnGeometry → columnToMesh`), διαβάζοντας
   kind/anchor/overrides από το `columnToolBridgeStore`. Ακολουθεί τον κέρσορα
   (pointermove), non-pickable (δεν παρεμβαίνει σε hover/selection raycasts).
5. **Click → EventBus bridge:** emit `bim:place-column-3d` με το (scene-units) σημείο.
   Listener στο `useColumnTool` → `onCanvasClick(point)` → **ολόκληρο** το υπάρχον commit
   path (enterprise id, scene append, EventBus `drawing:entity-created`). Orbit-drag guard
   (>5px μετακίνηση από pointerdown → αγνοείται· αποφυγή τυχαίας τοποθέτησης).
6. **Auto-resync:** η νέα κολώνα εμφανίζεται μόνη της στο 3Δ (υπάρχουσα αλυσίδα).

**WYSIWYG:** ghost == commit (και τα δύο διαβάζουν το raw floor point).

### Deferred
- **OSNAP σε 3Δ placement:** ο 2Δ snap engine (`findSnapPoint` / `findColumnDrawCornerSnap`)
  είναι viewport-coupled· η ένταξή του σε 3Δ είναι Phase 2.
- Τοποθέτηση τοίχου/δοκαριού/πλάκας (διαφορετικό FSM — τοίχος 2 κλικ, πλάκα πολλά).

---

## Files

### Νέα — `bim-3d/placement/`
| Αρχείο | Ρόλος |
|---|---|
| `world-to-scene-point.ts` | SSoT: 3D world (m) → 2Δ scene-units point (`worldToDxfPlan` × `mmToSceneUnits`). |
| `raycast-floor-point.ts` | SSoT: screen → world point στο δάπεδο ενεργού ορόφου + `resolveActiveFloorElevationMm`. |
| `ColumnPlacementGhost.ts` | Scene-side ημιδιαφανές ghost (reuse `columnToMesh`), pattern `BimGizmoOverlay`. |
| `use-bim3d-column-placement.ts` | Orchestration hook (gate + listeners + EventBus bridge). |
| `__tests__/*` (4 αρχεία) | 22 tests (conversion / raycast+elevation / ghost lifecycle / hook wiring). |

### Τροποποιημένα (μικρά)
| Αρχείο | Αλλαγή |
|---|---|
| `bim-3d/systems/raycaster/BimEntityRaycaster.ts` | export `clientToNdc` (SSoT, ήταν private). |
| `systems/events/EventBus.ts` | νέο event `bim:place-column-3d: { point: Point2D }`. |
| `hooks/drawing/useColumnTool.ts` | `useEffect` listener `bim:place-column-3d` → `onCanvasClick` (ref-stable). |
| `bim-3d/viewport/BimViewport3D.tsx` | mount `useBim3DColumnPlacement` (1 γραμμή + import). |

**Σημείωση:** `ThreeJsSceneManager.ts` (όριο 500 γρ.) **δεν** αγγίχτηκε — το ghost παίρνει
`scene`/`camera` από τα public `manager.scene` / `manager.getCamera()`.

---

## Verification
- ✅ 22/22 placement tests PASS (`npx jest src/subapps/dxf-viewer/bim-3d/placement`).
- ⏳ `npx tsc --noEmit` (background).
- 🔴 Browser `/dxf/viewer`: 3Δ → «Κολώνα» → ghost ακολουθεί κέρσορα → κλικ τοποθετεί στο
  ακριβές σημείο (σύγκριση με 2Δ) → continuous placement → Esc τερματίζει → undo αναιρεί →
  multi-floor «Όλοι» τοποθετεί στον ενεργό όροφο.

---

## Changelog
- **2026-06-01** — Column placement σε 3Δ (this document). 4 νέα αρχεία + 4 μικρά
  modified, 22 tests. Pending commit + browser verify.
