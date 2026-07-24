# ADR-688 — Αντιγραφή / Επικόλληση-στο-σημείο / Διπλασιασμός ΟΝΤΟΤΗΤΑΣ μέσα στον 3D κάμβα

**Status:** 🟢 Φ0 (full clone coverage) + Φ1 (Ctrl+C / paste-at-pick / Ctrl+D) + **Φ3 (Ctrl+drag move-copy)** IMPLEMENTED (2026-07-24, Opus 4.8). jest ✓ (13 + 8 + 10 tests) · jscpd ✓. 🔴 εκκρεμεί browser verify (Giorgio). Φ2 (context menu) = PROPOSED.
**Μοντέλο:** Opus 4.8 · **Γλώσσα:** Ελληνικά
**Σχετικά:** ADR-466 (cross-floor entity clipboard), ADR-577 (unified copy tool), ADR-363 §7.2 (BIM clone persistence), ADR-402 (3D→universal selection bridge), ADR-403/605/618 (3D placement pick machinery), ADR-539 (Polygon-Mode face-appearance clipboard), ADR-040 (leaf subscriber pattern)

---

## 1. Το αίτημα (Giorgio, 2026-07-24)

Όταν ο χρήστης είναι στον **3D κάμβα** και θέλει να **αντιγράψει / διπλασιάσει** μια οντότητα (BIM, MEP,
MESH, DXF) — **δεν γινόταν**. Το μόνο Ctrl+C/V στο 3D αντέγραφε **υλικό όψης** (Polygon Mode, ADR-539), όχι
γεωμετρία. Big-player parity ζητούμενο: Revit «Copy», ArchiCAD, C4D Ctrl+drag, Figma Ctrl+D — όλοι
αντιγράφουν οντότητες μέσα στο 3D.

**Αποφάσεις (Plan Mode):** Φ1 = Ctrl+C/V + **Ctrl+D** τώρα (Alt/Ctrl+drag = επόμενη φάση)· paste στο **3D
pick point** (κέρσορας→work-plane, OSNAP)· **πλήρης** clone coverage· **και raw DXF** στο 3D.

## 2. Τι ΥΠΑΡΧΕΙ ΗΔΗ (audit grep-anchored — reuse, μηδέν νέο clone)

| Κομμάτι | Αρχείο | Κατάσταση |
|---|---|---|
| **Clone SSoT** (`delta: Point2D`, BIM+DXF split) | `bim/transforms/build-entity-clone-command.ts::buildEntityCloneCommand` | ✅ Reuse |
| **BIM clone identity + persistence broadcast** | `bim/transforms/bim-clone-persistence.ts::mintBimCloneIdentity` | ⚠️ **στενό** (βλ. §3) |
| **Entity clipboard** (Ctrl+C/V, cross-floor, paste-in-place) | `hooks/tools/useEntityClipboard.ts` (ADR-466) | ✅ Μονίμως mounted (και σε 3D) |
| **3D→universal selection bridge** | `bim-3d/systems/selection/use-3d-selection-universal-bridge.ts` (ADR-402) | ✅ 3D επιλογή → `SelectedEntitiesStore` |
| **Pick-point machinery** (raycast κέρσορα→work-plane→scene units, OSNAP) | `bim-3d/placement/resolve-work-plane-hit.ts` + `world-to-scene-point.ts` | ✅ Reuse (ADR-403/618) |
| **Move-geometry SSoT** (translate ανά BIM τύπο) | `bim/utils/bim-move-geometry.ts::calculateBimMovedGeometry` | ✅ Καλύπτει MEP/mesh/solid |
| **Face-appearance clipboard** (Polygon Mode Ctrl+C/V) | `bim-3d/viewport/use-polygon-clipboard-shortcuts.ts` (ADR-539) | ⚠️ σύγκρουση — δες §4 |

**Κλειδί:** το `useEntityClipboard` δεν unmount-άρει ποτέ στο 3D (ζει στο πάντα-mounted `CanvasSection` tree)
και το `selectedEntityIds` του διαβάζεται από το ίδιο universal `SelectedEntitiesStore` όπου γράφει το 3D
bridge. Άρα **data + listeners ήταν ήδη έτοιμα στο 3D — έλειπε μόνο ο trigger** (και το clone κενό).

## 3. Το ΚΕΝΟ #1 — silent drop σε MEP / mesh / solid (latent bug, ΚΑΙ στο 2D)

Το `buildClonesFromEntities` κόβει ταυτότητα μέσω `mintBimCloneIdentity` → `isBimPersistedType` →
`BIM_ID_GENERATORS`, που περιείχε **μόνο 8 δομικούς τύπους** (wall, opening, slab, slab-opening, column,
beam, stair, floor-finish). Κάθε άλλος BIM τύπος (MEP fixtures/segments/manifolds/radiators/boilers/
water-heaters/underfloor, electrical-panel, foundation, furniture, roof, space-separator, **imported-mesh**,
**generic-solid**) → `mintBimCloneIdentity` γύριζε `null` → `skipped`. Κι επειδή το `isBimEntity` τα έβγαζε
από τα DXF sources, **έπεφταν στο κενό: ούτε BIM clone, ούτε DXF clone** — και στο 2D clipboard (ADR-466)
και οπουδήποτε.

**Ρίζα:** ασυμφωνία δύο λιστών. Το geometry-move SSoT (`calculateBimMovedGeometry`) κάλυπτε ήδη αυτούς τους
τύπους· οι enterprise-id generators υπήρχαν όλοι· οι `use*Persistence` hooks (ADR-594 factory) ακούν ήδη
`drawing:entity-created`. Μόνο η clone-identity λίστα ήταν στενή.

**Λύση (Φ0):** επέκταση `BimPersistedType` + `BIM_ID_GENERATORS` ώστε να καλύπτουν **όλους** τους τύπους που
το `calculateBimMovedGeometry` υποστηρίζει (22 τύποι). Το `broadcastBimCloneCreated/Deleted/Restored`
(`PasteEntitiesCommand`) φιλτράρει με το ΙΔΙΟ `isBimPersistedType` → μία αλλαγή διορθώνει ταυτότητα +
persistence + undo/redo μαζί.

**ΣΚΟΠΙΜΑ ΕΞΩ (host-derived):** `railing` (auto-hosted σε σκάλα, ADR-407), `wall-covering` (ακολουθεί
wall), `thermal-space` (derived region), `mep-fitting` (από segment endpoints), `floorplan-symbol`. Ο mover
τα αφήνει στον host τους (`default: null`) → κλωνοποιούνται **μέσω του host**, όχι ανεξάρτητα (Revit parity).
Η λίστα clone-identity **ΠΡΕΠΕΙ να μένει ευθυγραμμισμένη** με τις non-null περιπτώσεις του mover.

## 4. Το ΚΕΝΟ #2 — trigger + priority (σύγκρουση Polygon-Mode + double-paste)

- **Polygon Mode:** το `use-polygon-clipboard-shortcuts.ts` δεσμεύει Ctrl+C/V για **υλικό όψης** αλλά ΜΟΝΟ
  όταν `usePolygonMode3DStore.active`. → Το entity clipboard δρα **μόνο όταν Polygon Mode ΑΝΕΝΕΡΓΟ**
  (αμοιβαία αποκλειόμενα, καθαρός διαχωρισμός).
- **Double-paste:** το 2D `useDxfToolbarShortcuts` (Ctrl+C/V → `clipboard:*-requested`) **δεν είχε 3D guard**
  → πυροδοτούνταν και στο 3D. Χωρίς φραγμό, Ctrl+V στο 3D θα έκανε ΚΑΙ 2D paste-in-place ΚΑΙ 3D paste-at-pick.

**Λύση (Φ1):** νέος `bim-3d/viewport/use-bim3d-entity-clipboard.ts` (window-capture leaf, καθρέφτης του
polygon hook, ADR-040 — μηδέν `useSyncExternalStore`) που κατέχει το entity clipboard στο 3D· ΚΑΙ 3D guard
στο 2D `useDxfToolbarShortcuts` (`!selectIs3D(...)`) ώστε το 2D in-place clipboard να μη διπλο-πυροδοτεί.

## 5. Ροή (Φ1)

```
keydown (capture, window)  — gate: 3D active · Polygon Mode OFF · όχι σε form field · plain Ctrl (όχι Shift/Alt)
  Ctrl+C → EventBus.emit('clipboard:copy-requested')  → useEntityClipboard.copySelection (snapshot universal sel)
  Ctrl+V → snapshots = EntityClipboardStore.read()
           anchor = AABB centre snapshots (scene units, getEntityBounds)
           hit = resolveWorkPlaneHit(mgr, canvas, lastCursorX/Y, 0)     // OSNAP-corrected plan mm
           delta = planMmToScenePoint(hit.planMm) − anchor              // fallback: offset 300mm αν miss
           buildEntityCloneCommand(snapshots, delta, sm) → execute() → reselect cloneIds
  Ctrl+D → sources = τρέχουσα universal επιλογή (live scene) · delta = offset 300mm
           buildEntityCloneCommand(sources, delta, sm) → execute() → reselect
  handled ⇒ preventDefault() + stopImmediatePropagation()
```

- **Paste positioning:** το AABB-κέντρο του copied set τοποθετείται στο σημείο του κέρσορα (work-plane +
  OSNAP). Fallback offset αν ο ray αστοχήσει τη floor plane.
- **Undo/redo:** το υπάρχον command stack (`PasteEntitiesCommand`, ADR-466). **Persistence:** αυτόματη μέσω
  του `broadcastBimCloneCreated` (BIM) / scene autosave (DXF, ADR-420).
- **DXF:** raw DXF geometry κλωνοποιείται με id-swap (υπάρχον μονοπάτι) — καλύπτεται όπου είναι επιλέξιμο.

## 5.1 Ροή (Φ3 — Ctrl+drag move-copy, CAD-style)

**Απόφαση modifier (Giorgio, Plan Mode):** **Ctrl** (CAD-standard, ίδιο με το 2D body-drag copy — Revit «Copy»
με drag, C4D/SketchUp/ArchiCAD Ctrl+drag). **Όχι** Alt: το Ctrl είναι η πρακτική των μεγάλων παικτών ΚΑΙ
συνεπές με το 2D `CtrlKeyTracker`. Disambiguation vs το ADR-408 base-point (που ήταν στο ίδιο Ctrl+pointerdown).

```
onEditPointerDown  (gizmo drag lifecycle, ADR-402):
  copyModifier = Ctrl || ⌘
  αν copyModifier && controller.beginDrag() ΠΙΑΣΕΙ λαβή gizmo → copyDrag.active = true (COPY, frozen at press)
  αν copyModifier && ΔΕΝ πιάσει λαβή          → trySetBasePoint (ADR-408, ΑΝΕΠΑΦΟ)
  αλλιώς (non-Ctrl)                            → grip reshape → gizmo beginDrag (ως έχει)
onEditPointerMove:  applyLivePreview (τα real meshes ακολουθούν τον κέρσορα· το original μένει ήδη ως dim ghost)
onEditPointerUp  → dispatchOutcome:
  αν copyDrag.active && outcome.kind==='move':
     delta = resolveMovePlanDeltaCanvas(outcome, primary, axisLock)   // ΚΟΙΝΟ SSoT με το move command
     αν delta==(0,0) (pure-vertical) → false → πέφτει σε κανονικό vertical move
     αλλιώς → buildEntityCloneCommand(sources, delta, sm) → execute → reselect clones → return 'copy'
  αλλιώς → buildEditCommand(...) → execute → return 'move'
  caller: 'move' → preview.commit()· 'copy'/no-op → preview.reset() (το original ΓΥΡΝΑ στην πηγή)
```

- **Reuse-only:** μηδέν νέο clone/ghost/drag/command. Ο `EditOriginalGhost` (ADR-550) εμφανίζεται **ήδη** σε
  κάθε drag· το clone SSoT (`buildEntityCloneCommand`) + το unit-scaled plan delta (`resolveMovePlanDeltaCanvas`,
  ΚΟΙΝΟ με το move command → ghost≡commit≡copy) + το `sceneEntitiesForEdit` + το `reselect` (universal SSoT, Φ1).
- **Undo:** ένα βήμα (`PasteEntitiesCommand`). **Persistence:** αυτόματη (Φ0 broadcast). **Multi-select:** κλωνοποιεί
  όλη την επιλογή. **OSNAP:** από το υπάρχον gizmo snap (το outcome delta είναι ήδη snapped).
- **Όρια Φ3:** plan-only (καθαρά κατακόρυφο Ctrl+drag → κανονικό vertical move· elevation-copy = μελλοντικό)·
  μεμονωμένο opening (dedicated drag, gizmo suppressed) → όχι copy-drag (κλώνος μέσω Ctrl+C/V/D)· rotate/resize-copy
  εκτός scope. Drag-time το original φαίνεται dim (υπάρχων ghost)· λειτουργικά το αποτέλεσμα σωστό (original στην
  πηγή + αντίγραφο στον προορισμό).

## 6. Αρχεία

- `bim/transforms/bim-clone-persistence.ts` — Φ0: `BimPersistedType` + `BIM_ID_GENERATORS` → 22 τύποι.
- `bim-3d/viewport/use-bim3d-entity-clipboard.ts` — **ΝΕΟ** Φ1 hook (Ctrl+C/V/D, paste-at-pick).
- `bim-3d/viewport/use-bim3d-placement-and-pick-hooks.ts` — mount του νέου hook.
- `hooks/useDxfToolbarShortcuts.ts` — 3D guard στο 2D clipboard block.
- Tests: `bim/transforms/__tests__/bim-clone-persistence.test.ts` (+coverage), `bim-3d/viewport/__tests__/use-bim3d-entity-clipboard.test.ts` (**ΝΕΟ**, 8 tests).

**Φ3 (Ctrl+drag move-copy):**
- `bim-3d/animation/bim3d-edit-copy-commit.ts` — **ΝΕΟ** (`commitCopyDrag`: move outcome → clone SSoT + reselect).
- `bim-3d/animation/bim3d-edit-drag-commit.ts` — **ΝΕΟ** (extracted `dispatchOutcome`, tri-state 'move'/'copy'/false — file-size N.7.1).
- `bim-3d/animation/bim3d-edit-command-builders.ts` — export `resolveMovePlanDeltaCanvas` (SSoT plan delta) + move branch το χρησιμοποιεί.
- `bim-3d/animation/bim3d-edit-interaction-handlers.ts` — `EditInteractionCtx` (+`copyDrag`,+`reselect`), `onEditPointerDown` Ctrl disambiguation, preview-disposition tri-state, `settleAfterEditDrag` reset, `hideTransientOverlays` helper (de-dup up/cancel).
- `bim-3d/animation/use-bim3d-edit-interaction.ts` — wire `copyDrag` + `reselect` (universal selection, ref).
- Tests: `bim-3d/animation/__tests__/bim3d-edit-copy-commit.test.ts` (**ΝΕΟ**, 5) + `bim3d-edit-move-delta.test.ts` (**ΝΕΟ**, 5).

## 7. Follow-ups

- **Φ2:** 3D context-menu «Αντιγραφή / Επικόλληση / Διπλασιασμός» εκτός Polygon Mode (i18n keys ΠΡΩΤΑ, N.11).
- **Φ3 elevation-copy:** κατακόρυφο copy-drag (axis-Y) — χρειάζεται το clone SSoT να δέχεται z-delta.
- **Verify (Giorgio) Φ1:** 3D → επίλεξε wall/column/MEP/imported-mesh/generic-solid → Ctrl+C → κίνησε κέρσορα →
  Ctrl+V (αντίγραφο στο σημείο)· Ctrl+D (offset)· σε Polygon Mode το Ctrl+C/V μένει face-appearance· reload →
  persist. Ειδικά επιβεβαίωσε τα divergent-persistence types (mep-segment) ότι επιβιώνουν reload.
- **Verify (Giorgio) Φ3:** 3D → επίλεξε wall/column/MEP → κράτα **Ctrl** + σύρε λαβή gizmo (οριζόντια) → άφησε →
  αντίγραφο στον προορισμό, πρωτότυπο στην πηγή, τα clones επιλεγμένα· undo = ένα βήμα· χωρίς Ctrl = κανονικό move·
  **Ctrl+κλικ στο σώμα** (χωρίς σύρσιμο λαβής) = base-point (ADR-408 ανέπαφο)· multi-select copy-drag· reload → persist.

## 8. Changelog

- **2026-07-24 (Opus 4.8):** Φ0 (full clone coverage, 8→22 τύποι· διορθώνει latent 2D+3D drop) + Φ1 (3D
  entity clipboard: Ctrl+C reuse / paste-at-pick / Ctrl+D duplicate, priority vs Polygon-Mode, 2D double-fire
  guard). jest 13+8 ✓, jscpd ✓. 🔴 browser verify εκκρεμεί.
- **2026-07-24 (Opus 4.8):** Φ3 (Ctrl+drag move-copy, CAD-style). Modifier = **Ctrl** (απόφαση Giorgio, ίδιο με
  2D· Alt απορρίφθηκε). Copy-flag frozen at press στο `onEditPointerDown` (Ctrl+λαβή gizmo → copy· Ctrl+σώμα →
  ADR-408 base-point ανέπαφο)· commit μέσω κοινού `resolveMovePlanDeltaCanvas` (SSoT με το move) + clone SSoT +
  universal reselect· preview-disposition tri-state ('copy' → original γυρνά στην πηγή). Extracted `dispatchOutcome`
  → `bim3d-edit-drag-commit.ts` + `commitCopyDrag` → `bim3d-edit-copy-commit.ts` (N.7.1)· de-dup teardown
  (`hideTransientOverlays`). jest +10 ✓, jscpd ✓. Plan-only (vertical/rotate/resize-copy = follow-up). 🔴 browser verify εκκρεμεί.
