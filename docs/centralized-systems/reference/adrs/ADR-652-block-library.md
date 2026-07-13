# ADR-652 — Block Library (βιβλιοθήκη DXF blocks: έπιπλα / είδη υγιεινής / κ.λπ.)

| | |
|---|---|
| **Status** | 🔵 PROPOSED (Milestone 1 υλοποιημένο) |
| **Date** | 2026-07-13 |
| **Category** | DXF Viewer / Content Library |
| **Related** | ADR-410 (CC0 furniture), ADR-411 (BIM mesh library), ADR-600 (single-click placement SSoT), ADR-640 (BlockEntity / INSERT preserve), ADR-397 (append-entity SSoT), ADR-040 (canvas perf) |

## Πλαίσιο (γιατί)

Όταν στέλνουν στον χρήστη DXF με σχεδιασμένα blocks (έπιπλα, είδη υγιεινής, αυτοκίνητα, δέντρα κ.λπ.),
το import ήδη τα διαβάζει και τα βάζει ως `BlockEntity` στη σκηνή (ADR-640) — **αλλά ο ορισμός του block
πετιόταν μετά το import**: δεν υπήρχε βιβλιοθήκη/registry για να τα ξαναβάλει. Ζητούμενο (Revit/ArchiCAD-
grade): (Α) *import + επανάχρηση* ό,τι φέρνει ο χρήστης, και (Β) *έτοιμη/αδειοδοτημένη βιβλιοθήκη*, με
**ίχνος προέλευσης + άδειας ανά αντικείμενο** (νομική ασφάλεια).

Σειρά υλοποίησης (κάθε milestone ≤1 phase/session):
- **M1** — Τοποθέτηση + in-session «Τα Blocks μου» (τροφοδοτείται από το τρέχον import· χωρίς cloud). ← *αυτό το ADR*
- **M2** — Cloud persistence (user scope) + φόρμα προέλευσης/άδειας.
- **M3** — Έτοιμη/partner βιβλιοθήκη (`scope:'system'|'company'`, `redistributable` gate, built-in read-only).

## Απόφαση (M1)

Αδελφή βιβλιοθήκη δίπλα στην `bim-mesh-library` (3D glTF, ADR-411): η **Block Library** για **2D DXF
vector blocks** (`BlockEntity`). **Καμία νέα «μηχανή»** — επαναχρησιμοποιεί ΟΛΟ το υπάρχον scaffolding.

Το «ποιο block τοποθετώ» ζει σε **SSoT selection store** (palette → tool), και το placement tool το
διαβάζει σε **event-time** (κλικ/ghost), όχι σε React state (ADR-040). Το placement διέρχεται από το
invariant FSM του ADR-600 (`createSingleClickPlacementTool`) — ίδιο μοτίβο με furniture/mep-fixture.

### Ροή χρήστη (M1)
1. **Insert → «Blocks»** (action `toggle-block-library-panel`) → ανοίγει το palette «Τα Blocks μου».
2. Το palette λιστάρει τα session blocks (footprint preview + όνομα).
3. **Κλικ σε κάρτα** → `setSelectedBlockName(name)` + `handleToolChange('block-library')` (ενεργοποίηση tool).
4. **Κλικ στον καμβά** → undoable append του `BlockEntity` (fresh instance, base στο clicked point).

### Reuse map (SSoT — τι ΔΕΝ ξαναγράφτηκε)
| Ανάγκη | Υπάρχον SSoT |
|---|---|
| Block ως entity / expand / bounds | `systems/block/block-instance.ts`, `block-expander.ts`, `systems/zoom/utils/bounds-entity.ts` (`getEntityBounds` case 'block', `calculateTightBounds`) |
| Placement FSM (1-click + ghost) | `hooks/drawing/create-single-click-placement-tool.ts` (ADR-600) |
| Commit + undo + first-save event | `bim/scene/append-entity-to-scene.ts` (`appendEntityToScene`, ADR-397) |
| Floating palette shell | `@/components/ui/floating` `FloatingPanel` (mirror `GuidePanel`) |
| Toggle-panel action + state | `useToolbarState` + `useDxfViewerState` action switch (mirror guide panel) |
| Import capture point | `hooks/scene/useSceneState.ts` (δίπλα στο `emitImportedEntityCreateEvents`, shared .tek+DXF) |

## Αρχιτεκτονική (M1 αρχεία)

**`bim/block-library/`**
- `block-library-types.ts` — `InSessionBlockDef`, `BlockBoundsMm`, `BlockLibraryParamOverrides` (scale/rotation)· + M2 data model (`BlockLibraryItem`/provenance/license, `DEFAULT_USER_IMPORT_LICENSE`).
- `block-library-registry.ts` — in-session store (upsert/list/get/version/subscribe/clear + test reset).
- `block-library-selection-store.ts` — «ποιο block» SSoT (palette → tool, event-time read).
- `capture-blocks-from-scene.ts` — pure scan: scene → distinct named defs (skip anonymous `*X`/`*D` + empty).
- `capture-session-blocks.ts` — wiring: capture + `computeBlockLocalBoundsMm` + `upsert` (accumulate, idempotent).
- `block-local-bounds.ts` — BLOCK-LOCAL AABB (reuse `calculateTightBounds`).
- `place-block-from-library.ts` — `buildBlockEntityFromDef` (commit, cloned members + fresh ids) + `buildGhostBlockEntity` (transient ghost, raw members, no clone) μέσω ενός shared assembler.
- `block-library-footprint.ts` — `computeBlockFootprint` (4 γωνίες του transformed AABB μέσω `getEntityBounds`).
- `add-block-to-scene.ts` — thin wrapper πάνω στο `appendEntityToScene` (tool: 'block-library').

**Tool / dispatch**
- `hooks/drawing/useBlockLibraryTool.ts` — ADR-600 config (buildParams/buildEntity/computeFootprint· blockName από selection store).
- `hooks/tools/useSpecialTools-placement-tools.ts` — instantiate + `useToolLifecycle(activeTool==='block-library')`.
- `hooks/canvas/canvas-click-bim-dispatch.ts` (+ `canvas-click-tool-types.ts`, `canvas-click-types.ts`) — click routing (RAW worldPoint, free-point).

**UI**
- `ui/panels/block-library/BlockLibraryPanel.tsx` — palette «Τα Blocks μου» (grid, footprint SVG preview, active highlight).
- `layout/FloatingPanelsSection.tsx` + `app/DxfViewerContent.tsx` — mount + prop threading.
- `ui/ribbon/data/insert-tab.ts` — κουμπί «Blocks»· `RibbonButtonIcon.tsx` — icon· `ui/toolbar/types.ts` — `ToolType += 'block-library'`.
- i18n: `dxf-viewer-shell` (el+en) — `tools.blockLibrary.*`, `blockLibrary.*`, `ribbon.panels/commands.blockLibrary`.

**Capture point**: `hooks/scene/useSceneState.ts` — `captureSessionBlocksFromScene(scene.entities)` δίπλα στο
`emitImportedEntityCreateEvents` και στα δύο branches (.tek + DXF), τον κοινό SSoT εντοπισμό post-import.

## Νομική ασφάλεια (by design)
Ο τύπος `BlockLibraryItem.license` (M2) κρατά ανά αντικείμενο τύπο άδειας + `redistributable`. Default για
user-import → `unknown` / `redistributable:false`. Promote σε shared/system scope → μπλοκάρεται εκτός αν
`redistributable === true`. (Επιπλέον product-level όρος χρήσης — εκτός κώδικα.)

## Verification
- **Jest** (13/13): `bim/block-library/__tests__/block-library-foundation.test.ts` (capture + place) + `block-library-m1-wiring.test.ts` (registry/selection/bounds/capture-integration/footprint — το footprint επικυρώνεται έναντι του πραγματικού `getEntityBounds`/block-expander SSoT).
- **jscpd:diff** στα staged src (N.18) πριν «done».
- Manual (μέσω /run): import DXF με blocks → «Blocks» → palette → κλικ κάρτας → κλικ καμβά → τοποθέτηση + Ctrl+Z.

## Deferred (επόμενα slices — ρητά ΕΚΤΟΣ M1)
- **Contextual ribbon tab** (rotation/scale combobox tuning) + το `block-library-tool-bridge-store` που το τροφοδοτεί → M1.5/M2 (το M1 τοποθετεί σε 1:1 / rotation 0· τα `BlockLibraryParamOverrides` είναι το typed extension point).
- **Cloud persistence** (BlockLibraryService, Storage blob, enterprise id `blklib`, `block_library` collection, RegistryHost) → M2.
- **Partner/built-in** scope + `redistributable` promote gate + κατηγορίες/filter → M3.

## Ρίσκα / σημεία προσοχής
- **ADR-040**: το placement tool/ghost διαβάζει selection + transform σε event-time· κανένα `useSyncExternalStore` σε orchestrators (CanvasSection = pass-through). Το `computeBlockFootprint` χρησιμοποιεί το transient `buildGhostBlockEntity` (χωρίς per-frame clone).
- **Serialization SSoT** (M2): θα χρησιμοποιηθεί ο υπάρχων entity serializer, όχι νέο JSON schema.
- **Anonymous blocks**: αποθηκεύονται μόνο named/πραγματικά (`shouldPreserveBlockName`), όχι `*X`/`*D`.

## Changelog
- **2026-07-13** — M1 υλοποιημένο (θεμέλιο + wiring): capture μετά το import, `useBlockLibraryTool` (ADR-600), dispatch/lifecycle, κουμπί «Blocks» + palette «Τα Blocks μου», selection SSoT. 13/13 jest. Contextual tab + cloud → επόμενα milestones.
