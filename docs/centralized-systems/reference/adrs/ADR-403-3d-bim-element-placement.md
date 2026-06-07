# ADR-403 — 3D Viewport BIM Element Placement (Column)

| Field | Value |
|---|---|
| Status | 🟢 ACCEPTED — Column placement DONE + ✅ browser-verified 2026-06-01· **Phase 2 OSNAP DONE 2026-06-01 (pending commit, 🔴 browser verify)** |
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

### Phase 2 — OSNAP (✅ DONE 2026-06-01)
Όταν το OSNAP είναι **ON**, το ghost (και το committed σημείο) **κουμπώνει** στο
πλησιέστερο χαρακτηριστικό σημείο (corner/endpoint/midpoint/intersection) υπάρχοντος
στοιχείου — ίδια εμπειρία με το 2Δ (ADR-398). Αρχιτεκτονική:
- **`placement-snap.ts`** (νέο SSoT, δικός χώρος ADR-403): `resolvePlacementSnap(planMm)` —
  ~6γραμμο wrap του κοινού snap engine (`getGlobalSnapEngine().findSnapPoint`), **σε plan mm**.
  OSNAP off → `null` (free placement)· hit → `{ snappedMm, markerMm }`· no-feature → `null`.
  **Χωρίς** `excludeEntityId` (η νέα κολώνα δεν υπάρχει ακόμα). Δεν κάνει import το ADR-402
  `bim3d-snap-bridge.ts` (territory isolation) — αναπαράγει το `makeResizeSnapFn` pattern.
- **`PlacementSnapMarker.ts`** (νέο): 3Δ κυανό wireframe square στο snap target (mirror του
  ADR-402 gizmo drag marker — depth-test off, screen-constant scale· δεν κάνει import το gizmo).
- **Units (anti-1000×):** ο snap engine δουλεύει σε **mm**· η μετατροπή σε scene units γίνεται
  ΜΟΝΟ στο τέλος (`planMmToScenePoint`). Νέοι SSoT helpers `worldToPlanMm` + `planMmToScenePoint`
  στο `world-to-scene-point.ts` (το `worldToScenePoint` = σύνθεσή τους — DRY).
- **WYSIWYG:** το ΙΔΙΟ snap τρέχει σε `onMove` και `onClick` → ghost == commit.

### Deferred (ΟΧΙ τώρα)
- Τοποθέτηση τοίχου/δοκαριού/πλάκας (διαφορετικό FSM — τοίχος 2 κλικ, πλάκα πολλά).
  ℹ️ **Update 2026-06-07:** το **linear 2-click** πλέον υλοποιήθηκε για `mep-segment`
  (σωλήνας/αεραγωγός) — βλ. Changelog· το ίδιο pattern (bridge με `phase`+`startPoint` +
  rubber-band ghost) επεκτείνεται σε τοίχο/δοκάρι αργότερα.
- Snap σε στοιχεία **άλλου** ορόφου (multi-floor «Όλοι»): μόνο ενεργού ορόφου (συνέπεια
  με την elevation του Phase 1).

---

## Files

### Νέα — `bim-3d/placement/`
| Αρχείο | Ρόλος |
|---|---|
| `world-to-scene-point.ts` | SSoT: 3D world (m) → 2Δ scene-units point (`worldToDxfPlan` × `mmToSceneUnits`)· **+Phase 2** `worldToPlanMm` (→ mm, snap space) + `planMmToScenePoint` (mm → scene). |
| `raycast-floor-point.ts` | SSoT: screen → world point στο δάπεδο ενεργού ορόφου + `resolveActiveFloorElevationMm`. |
| `ColumnPlacementGhost.ts` | Scene-side ημιδιαφανές ghost (reuse `columnToMesh`), pattern `BimGizmoOverlay`. |
| `use-bim3d-column-placement.ts` | Orchestration hook (gate + listeners + EventBus bridge + **Phase 2 snap+marker wiring**). |
| **`placement-snap.ts`** (Phase 2) | SSoT OSNAP resolver (`resolvePlacementSnap`) σε plan mm· wrap κοινού snap engine. |
| **`PlacementSnapMarker.ts`** (Phase 2) | 3Δ κυανό snap marker (mirror gizmo drag marker, χωρίς import ADR-402). |
| `__tests__/*` (5 αρχεία) | 32 tests (conversion+snap-path / raycast+elevation / ghost lifecycle / hook wiring incl. snap / **placement-snap 5**). |

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
- ✅ 32/32 placement tests PASS — 5 suites (`npx jest src/subapps/dxf-viewer/bim-3d/placement`).
- ✅ `npx tsc --noEmit` clean.
- 🔴 **Phase 2 browser verify εκκρεμεί:** 3Δ → «Κολώνα» → πλησίασε γωνία υπάρχουσας κολώνας/τοίχου
  → ghost **κουμπώνει** + κυανό marker → κλικ τοποθετεί ΑΚΡΙΒΩΣ στη γωνία (σύγκριση με 2Δ) →
  OSNAP off → free placement.
- ✅ Browser `/dxf/viewer` 2026-06-01 (Giorgio): 3Δ → «Κολώνα» → ghost ακολουθεί κέρσορα →
  σταυρόνημα cursor → κλικ τοποθετεί στον ενεργό όροφο. Επιλογή υπάρχουσας κολώνας →
  move gizmo· ενεργοποίηση εργαλείου → gizmo σβήνει (single-mode). Σωστή ροή place vs edit.

---

## Changelog
- **2026-06-08 (MEP segment EXT — connector-Z mate + Revit per-click elevation, Opus 4.8)** —
  Ο linear 2-click σωλήνας έγινε **Revit-grade σε 3D**: κάθε κλικ φέρει πλέον το υψόμετρό του
  (`point.z`, mm floor-relative). Πηγή ανά κλικ: `connectorZ(snap) ?? centerlineOffset@clickTime`.
  → **connector-Z mate** («Connect To»): snap σε MEP connector → το άκρο κληρονομεί το πραγματικό z
  του host· → **κλίση/risers**: αλλαγή του centreline offset ανάμεσα στα δύο clicks ⇒ κεκλιμένος
  σωλήνας (διαφορετικό start/end z, Φ-A per-endpoint). Το placement framework πλέον υποστηρίζει
  **per-click elevation** για linear entities (πρώτη χρήση). **Νέο SSoT helper**
  `resolveSnapConnectorElevationMm` (bim/mep-segments), κοινός 2D (`mouse-handler-up`) + 3D (Boy-Scout
  κατάργηση 2D duplication). `placement-snap.ts` επιφανειακό `snapEntityId`/`snapType` (geometry-only).
  Το completion/FSM (Φ-A) ήταν ήδη η SSoT — **μηδέν fork**· ΕΚΤΟΣ ADR-040· 33+138 tests, tsc 0.
- **2026-06-07 (MEP segment — first LINEAR 2-click entity, Opus 4.8)** — 3Δ τοποθέτηση
  σωλήνα/αεραγωγού (`mep-segment`, tools `mep-pipe`/`mep-duct`/`mep-drain-pipe`) με τη
  **ΙΔΙΑ 2-click** χειρονομία όπως στην κάτοψη. Πρώτη **linear** οντότητα στο placement
  framework (όλες οι προηγούμενες ήταν point-based). 3 νέα αρχεία:
  `use-bim3d-mep-segment-placement.ts` (mirror manifold hook, gate σε 3 segment tool ids),
  `MepSegmentPlacementGhost.ts` (rubber-band axis start→cursor, ορατό μόνο σε `awaitingEnd`),
  `ui/ribbon/hooks/bridge/mep-segment-tool-bridge-store.ts` (read-only projection του FSM:
  εκτός domain/overrides/units **και** `phase`+`startPoint`, ώστε το pure-Three ghost να ξέρει
  πότε/από πού να σχεδιάσει). 2 modified: `useMepSegmentTool.ts` (single-writer bridge publish,
  μηδέν αλλαγή στο FSM/commit), `BimViewport3D.tsx` (mount). Commit path 100% κοινό με 2Δ μέσω
  του ήδη δηλωμένου `bim:place-mep-segment-3d` bridge (zero fork). v1: οριζόντιος σωλήνας στο
  default centreline (free-point convention — τα clicks ΔΕΝ φέρουν z, η completion βάζει default).
  Follow-up: connector-Z mate σε 3Δ + sloped runs. 24 νέα tests + 107 mep-segment regression PASS,
  tsc 0 (δικά μου). Pending commit, 🔴 browser verify.
- **2026-06-01 (Phase 2 — OSNAP, Opus 4.8)** — OSNAP στο 3Δ column placement. 2 νέα αρχεία
  (`placement-snap.ts` SSoT resolver + `PlacementSnapMarker.ts` 3Δ marker) + 1 modified hook
  (`use-bim3d-column-placement.ts` snap+marker wiring) + 2 νέοι SSoT helpers στο
  `world-to-scene-point.ts` (`worldToPlanMm`/`planMmToScenePoint`, DRY refactor). Snap σε plan mm
  (anti-1000×)· ΙΔΙΟ snap onMove+onClick (WYSIWYG)· territory isolation από ADR-402 (αναπαραγωγή
  pattern, μηδέν import). 32/32 tests (5 suites), tsc clean. Pending commit, 🔴 browser verify.
- **2026-06-01** — Column placement σε 3Δ (this document). 4 νέα αρχεία + 4 μικρά
  modified, 22 tests. Pending commit + browser verify.
- **2026-06-01 (integration fixes, browser-verified)** — 3 διορθώσεις ενσωμάτωσης που
  αποκαλύφθηκαν στο browser test (τα isolated tests δεν τα έπιαναν):
  1. **Root bug — dead mount.** Το `useBim3DColumnPlacement` ήταν imported αλλά **ΠΟΤΕ
     καλεσμένο** στο `BimViewport3D.tsx` (το crash του προηγ. session διέκοψε στο τελευταίο
     βήμα). Ολόκληρη η αλυσίδα placement δεν εκτελούνταν → καθόλου ghost/click. Fix: προστέθηκε
     η κλήση `useBim3DColumnPlacement({ managerRef, canvasEl })` δίπλα στο `useBim3DEditInteraction`.
     (`tsc` δεν το έπιασε — `noUnusedLocals` off· τα 38 tests περνούσαν γιατί δοκιμάζουν τον
     hook απομονωμένα, όχι το mounting.)
  2. **Placement cursor.** Όσο το εργαλείο είναι ενεργό, ο κέρσορας του canvas γίνεται
     `crosshair` (mirror του 2Δ DXF canvas) αντί για το orbit-grab «χεράκι» — set/restore στο
     `setup()`/`teardown()` του hook.
  3. **Single-mode (place XOR edit).** Το arming του placement καλεί
     `useSelection3DStore.clearSelection()` → το move-gizmo μιας προηγουμένως επιλεγμένης
     οντότητας σβήνει (Revit/AutoCAD). Ποτέ gizmo + ghost ταυτόχρονα.
