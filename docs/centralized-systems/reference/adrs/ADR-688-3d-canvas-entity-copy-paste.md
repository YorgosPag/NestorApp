# ADR-688 — Αντιγραφή / Επικόλληση-στο-σημείο / Διπλασιασμός ΟΝΤΟΤΗΤΑΣ μέσα στον 3D κάμβα

**Status:** 🟢 Φ0 (full clone coverage) + Φ1 (Ctrl+C / paste-at-pick / Ctrl+D) IMPLEMENTED (2026-07-24, Opus 4.8). jest ✓ (13 + 8 tests) · jscpd ✓. 🔴 εκκρεμεί browser verify (Giorgio). Φ2 (context menu) / Φ3 (Alt/Ctrl+drag) = PROPOSED.
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

## 6. Αρχεία

- `bim/transforms/bim-clone-persistence.ts` — Φ0: `BimPersistedType` + `BIM_ID_GENERATORS` → 22 τύποι.
- `bim-3d/viewport/use-bim3d-entity-clipboard.ts` — **ΝΕΟ** Φ1 hook (Ctrl+C/V/D, paste-at-pick).
- `bim-3d/viewport/use-bim3d-placement-and-pick-hooks.ts` — mount του νέου hook.
- `hooks/useDxfToolbarShortcuts.ts` — 3D guard στο 2D clipboard block.
- Tests: `bim/transforms/__tests__/bim-clone-persistence.test.ts` (+coverage), `bim-3d/viewport/__tests__/use-bim3d-entity-clipboard.test.ts` (**ΝΕΟ**, 8 tests).

## 7. Follow-ups

- **Φ2:** 3D context-menu «Αντιγραφή / Επικόλληση / Διπλασιασμός» εκτός Polygon Mode (i18n keys ΠΡΩΤΑ, N.11).
- **Φ3:** Alt/Ctrl+drag move-copy με 3D ghost preview (εντολή Giorgio, επόμενη συνεδρία).
- **Verify (Giorgio):** 3D → επίλεξε wall/column/MEP/imported-mesh/generic-solid → Ctrl+C → κίνησε κέρσορα →
  Ctrl+V (αντίγραφο στο σημείο)· Ctrl+D (offset)· σε Polygon Mode το Ctrl+C/V μένει face-appearance· reload →
  persist. Ειδικά επιβεβαίωσε τα divergent-persistence types (mep-segment) ότι επιβιώνουν reload.

## 8. Changelog

- **2026-07-24 (Opus 4.8):** Φ0 (full clone coverage, 8→22 τύποι· διορθώνει latent 2D+3D drop) + Φ1 (3D
  entity clipboard: Ctrl+C reuse / paste-at-pick / Ctrl+D duplicate, priority vs Polygon-Mode, 2D double-fire
  guard). jest 13+8 ✓, jscpd ✓. 🔴 browser verify εκκρεμεί.
