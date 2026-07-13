# ADR-652 — Block Library (βιβλιοθήκη DXF blocks: έπιπλα / είδη υγιεινής / κ.λπ.)

| | |
|---|---|
| **Status** | 🔵 PROPOSED (Milestones 1 + 1.5 + 2 + 3 + 4 + 5 υλοποιημένα) |
| **Date** | 2026-07-13 |
| **Category** | DXF Viewer / Content Library |
| **Related** | ADR-410 (CC0 furniture), ADR-411 (BIM mesh library), ADR-600 (single-click placement SSoT), ADR-640 (BlockEntity / INSERT preserve), ADR-397 (append-entity SSoT), ADR-040 (canvas perf), ADR-363 §Phase 6.5 (material library — ο πυρήνας που μοιραζόμαστε), ADR-413 (registry host pattern) |

## Πλαίσιο (γιατί)

Όταν στέλνουν στον χρήστη DXF με σχεδιασμένα blocks (έπιπλα, είδη υγιεινής, αυτοκίνητα, δέντρα κ.λπ.),
το import ήδη τα διαβάζει και τα βάζει ως `BlockEntity` στη σκηνή (ADR-640) — **αλλά ο ορισμός του block
πετιόταν μετά το import**: δεν υπήρχε βιβλιοθήκη/registry για να τα ξαναβάλει. Ζητούμενο (Revit/ArchiCAD-
grade): (Α) *import + επανάχρηση* ό,τι φέρνει ο χρήστης, και (Β) *έτοιμη/αδειοδοτημένη βιβλιοθήκη*, με
**ίχνος προέλευσης + άδειας ανά αντικείμενο** (νομική ασφάλεια).

Σειρά υλοποίησης (κάθε milestone ≤1 phase/session):
- **M1** — Τοποθέτηση + in-session «Τα Blocks μου» (τροφοδοτείται από το τρέχον import· χωρίς cloud). ← *αυτό το ADR*
- **M1.5** — Contextual ribbon tab «Τοποθέτηση Block»: rotation/scale του επόμενου κλικ. ← *αυτό το ADR*
- **M2** — Cloud persistence (user scope) + φόρμα προέλευσης/άδειας. ← *αυτό το ADR*
- **M3** — Έτοιμη/partner βιβλιοθήκη (`scope:'system'`, seed) + promote flow (`redistributable` gate) + κατηγορίες/φίλτρο/αναζήτηση + διαγραφή. ← *αυτό το ADR*
- **M4** — Thumbnails (διανυσματικά, inline στο doc) + επεξεργασία metadata (μετονομασία/κατηγορία/άδεια). ← *αυτό το ADR*
- **M5** — Mirror (καθρέφτισμα) + μη-ομοιόμορφη κλίμακα (x≠y) στην τοποθέτηση (AutoCAD INSERT-faithful). ← *αυτό το ADR*

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
- `block-library-types.ts` — `InSessionBlockDef`, `BlockBoundsMm`, `BlockLibraryParamOverrides` (M5: `scaleX`/`scaleY`/`rotation`/`uniform`)· + M2 data model (`BlockLibraryItem`/provenance/license, `DEFAULT_USER_IMPORT_LICENSE`).
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

## Απόφαση (M1.5) — contextual ribbon tab «Τοποθέτηση Block»

Ο χρήστης ρυθμίζει **γωνία (μοίρες) + ομοιόμορφη κλίμακα** πριν το κλικ· το `BlockLibraryParamOverrides`
(ήδη typed extension point του M1) είναι ο φορέας. Ροή: ribbon → `setParamOverrides` (ο SSoT setter του
ADR-600 πυρήνα) → `buildParams` → επόμενο κλικ τοποθετεί με το νέο transform. **Καμία δεύτερη κατοικία του
transform** — ο bridge γράφει απευθείας στον setter του πυρήνα.

### Δύο ΑΝΤΙΘΕΤΕΣ φορές — μην τις μπερδέψεις
| Φορά | Store | Τι μεταφέρει |
|---|---|---|
| palette → tool | `block-library-selection-store` | **ποιο** block (event-time read· M1) |
| tool → ribbon | `block-library-tool-bridge-store` | **πώς** τοποθετείται: rotation/scale (M1.5) |

### SSoT: ο asset picker του `useToolHandleBridge` έγινε ΠΡΟΑΙΡΕΤΙΚΟΣ
Οι 3 υπάρχοντες καταναλωτές (furniture / floorplan-symbol / mep-fixture-library) έχουν **asset picker** στο
ribbon· το block-library **ΔΕΝ** έχει — το «ποιο block» το κατέχει το palette. Αντί για numeric-only sibling
clone του furniture bridge (ακριβώς το λάθος που απαγορεύει ο **N.18**), το `ToolHandleLike` +
`ToolHandleBridgeConfig` **διευρύνθηκαν** ώστε τα `assetId`/`setAssetId`/`assetIdKey`/`buildOptions` να είναι
optional. Backward-compatible: **μηδέν αλλαγές** στους 3 υπάρχοντες bridges (δηλώνουν ακόμα required τα δικά
τους πεδία → πλήρες type-safety). Το block-library είναι ο **πρώτος numeric-only** καταναλωτής του ΙΔΙΟΥ factory.

### Αρχεία (M1.5)
- `ui/ribbon/hooks/bridge/block-library-tool-bridge-store.ts` — handle (isActive/overrides/setParamOverrides).
- `ui/ribbon/hooks/bridge/block-library-command-keys.ts` — `BLOCK_LIBRARY_RIBBON_KEYS` + `isBlockLibraryRibbonKey`.
- `ui/ribbon/hooks/useRibbonBlockLibraryBridge.ts` — `useToolHandleBridge` ΧΩΡΙΣ picker· key→field (`rotation`/`scale`), defaults 0°/1:1.
- `ui/ribbon/data/contextual-block-library-tab.ts` — tab + `BLOCK_LIBRARY_CONTEXTUAL_TRIGGER = 'block-library-tool-active'`· options από τον SSoT `literalNumberOptions` (ΟΧΙ 4ο χειρόγραφο clone του rotation ladder).
- `hooks/drawing/useBlockLibraryTool.ts` — `useExtension` δημοσιεύει το handle (cleanup με identity-guard).
- Wiring: `contextual-triggers.ts` (barrel) · `resolve-tool-active-trigger.ts` (`['block-library', …]`) ·
  `ribbon-contextual-config.ts` (RAW tabs) · `useDxfBimBridges.ts` → `useDxfViewerRibbon.ts` →
  `useRibbonCommands{,-types,-dispatch}.ts` (combobox route).
- i18n `dxf-viewer-shell` (el+en): `ribbon.tabs.blockLibraryPlacement`, `ribbon.panels.blockLibraryTransform`,
  `ribbon.commands.blockLibraryEditor.{rotation,scale}`.

**Μονάδες (ground truth, όχι υπόθεση)**: `BlockPlacementParams.rotation` = **μοίρες** (όπως το DXF group code
50 του INSERT) → το ribbon δίνει μοίρες **απευθείας**, καμία μετατροπή. Το tab επιτρέπει ρητά δεκαδικές
(22.5°) και αρνητικές (−90°) μοίρες· στο scale επιτρέπει δεκαδικά αλλά **όχι** αρνητικά (αρνητικό scale =
καθρέφτισμα, δεν ανήκει σε αυτό το πεδίο).

## Απόφαση (M2) — cloud persistence + προέλευση/άδεια

### Πρακτική των μεγάλων παικτών (ρητή δικαιολόγηση)
| Ερώτημα | Revit / ArchiCAD / AutoCAD | Τι κάναμε |
|---|---|---|
| Πώς αποθηκεύεται ένα αντικείμενο βιβλιοθήκης; | **Αρχείο ανά asset** (`.rfa` / `.gsm` / source `.dwg`) + κατάλογος με metadata | Firestore doc = metadata· **Storage blob = το «αρχείο»** (`companies/{companyId}/block-library/{blklib_*}.json`) |
| Πότε μπαίνει στη βιβλιοθήκη; | **Ρητή ενέργεια** χρήστη (Revit «Save Family», AutoCAD `WBLOCK`, ArchiCAD «Save as Object») — ΠΟΤΕ αυτόματο upload ό,τι ανοίξεις | Κουμπί 💾 στην κάρτα → φόρμα άδειας. Το import ΔΕΝ ανεβάζει τίποτα |
| Πότε φορτώνεται η γεωμετρία; | **Lazy** — ο browser δείχνει κατάλογο, το asset έρχεται όταν το ζητήσεις | Το palette δείχνει bounds/metadata· το blob κατεβαίνει στο κλικ επιλογής (`hydrateCloudBlockDef`) |
| Δύο ορισμοί με ίδιο όνομα; | **AutoCAD: ένας ορισμός ανά όνομα** στο σχέδιο (block redefinition, όχι δεύτερος) | Ονοματική σύγκρουση import↔βιβλιοθήκη → **ΜΙΑ κάρτα** (η cloud)· last-wins ανά όνομα στο registry |

### SSoT: ΕΝΑΣ πυρήνας βιβλιοθηκών, όχι δεύτερη μηχανή
Η προφανής υλοποίηση («αντίγραψε τον `MaterialLibraryService`») θα ήταν sibling clone του ίδιου
multi-scope CRUD + cache + subscribe-merge + builtin guard — ακριβώς το λάθος που απαγορεύει ο **N.18**
(και το `jscpd:diff` το έπιασε στην πράξη). Αντ' αυτού εξήχθη ο **`bim/services/scoped-library-service.ts`**:
- `ScopedLibraryService<T>` — multi-scope `list`/`subscribe` (ένα listener ανά bucket + merge + equality
  guard), `create`/`patch`/`remove`/`getById`, cache TTL, builtin guard, tenant `companyId` σε κάθε
  tenant-scoped query (CHECK 3.10).
- Τα **κανονικά scope buckets** (`systemScopeBucket` / `companyScopeBucket` / `projectScopeBucket` /
  `userScopeBucket` / `optionalProjectScopeBucket`) — η σημασιολογία των scopes ζει σε ΕΝΑ σημείο.

**Topology extension point (2026-07-14, ADR-652 Deferred migration).** Ο πυρήνας γεννήθηκε για
**top-level** collection (`block_library`/`bim_materials`, `companyId` ως ΠΕΔΙΟ). Οι βιβλιοθήκες
`family-types` / `stair-presets` ζουν σε **SUBcollection** (`COMPANIES/{companyId}/…`). Προστέθηκε
**backward-compatible** διεύρυνση (default = top-level, μηδέν αλλαγή σε Material/Block):
- `ScopedLibraryConfig.collectionRefFactory?` — προαιρετική factory που καθορίζει ΑΠΟΚΛΕΙΣΤΙΚΑ το
  collection path· ο πυρήνας το χρησιμοποιεί σε `list`/`fetchBucket`/`docRef`. Ο `subscribe()`
  (top-level tenant injection μέσω `firestoreQueryService`) κάνει **fail-loud** αν δοθεί factory —
  οι subcollection καταναλωτές χρησιμοποιούν ΜΟΝΟ `list()` (getDocs-based, topology-aware).
- `userScopeBucket(userId, ownerField='createdBy')` — το πεδίο ιδιοκτησίας παραμετροποιήθηκε
  (`ownerId` για family/stair) ώστε η εκπεμπόμενη query να μένει ΑΚΡΙΒΩΣ η ίδια (μηδέν rules/index risk).
- `createSubcollectionScopedLibrary<T>(...)` — ο **κοινός συνθέτης** για την τυπική 3-scope subcollection
  βιβλιοθήκη· family-types + stair-presets (δίδυμα) τον καλούν αντί για δύο πανομοιότυπα constructor
  bodies (N.18 — το `jscpd:diff` έπιασε το αρχικό sibling clone, εξήχθη ΕΔΩ).

**Και οι δύο** υπηρεσίες τον συνθέτουν: ο `MaterialLibraryService` ξαναγράφτηκε πάνω του με **αμετάβλητο
public API** (19/19 τα υπάρχοντα tests του) και ο `BlockLibraryService` προσθέτει ΜΟΝΟ ό,τι είναι
block-specific. Ίδια ιστορία στα stores: το μοτίβο «Map + version + subscribe» εμφανιζόταν σε δύο
σημεία → **`@/lib/state/createKeyedVersionedStore`** (stable snapshot για `useSyncExternalStore`), τον
οποίο τυλίγουν και το in-session registry και το cloud store.

### Ροή δεδομένων (M2)
```
import DXF ──► session registry (γεωμετρία στη μνήμη) ──┐
                                                        ├─► mergeBlockPaletteEntries ──► palette
BlockLibraryRegistryHost ──► cloud store (metadata) ────┘            │
   (Firestore subscription, always-on)                               │ κλικ σε cloud κάρτα
                                                                     ▼
                                            hydrateCloudBlockDef ──► session registry ──► ΤΟ ΙΔΙΟ tool
```
**Μία διαδρομή τοποθέτησης**: ό,τι κι αν διάλεξε ο χρήστης, μέχρι να φτάσει στο tool είναι ένας
`InSessionBlockDef` στο ΙΔΙΟ registry — καμία δεύτερη αναπαράσταση γεωμετρίας, κανένα δεύτερο FSM.

### Αρχεία (M2)
**Πυρήνας / SSoT**
- `bim/services/scoped-library-service.ts` — ο κοινός μηχανισμός βιβλιοθηκών (**νέο SSoT**).
- `bim/services/MaterialLibraryService.ts` — ξαναγράφτηκε ως καταναλωτής (ίδιο API).
- `lib/state/createKeyedVersionedStore.ts` — keyed store + version + stable snapshot (**νέο SSoT**).

**Block library**
- `bim/services/BlockLibraryService.ts` — save (blob→doc) / list / subscribe / delete + **νομικό gate**.
- `bim/block-library/block-geometry-blob.ts` — pure (de)serialisation + validation (v1· strip `selected`).
- `bim/block-library/block-geometry-storage.ts` — upload/fetch του blob (JSON bytes, ίδιο συμβόλαιο με το scene blob).
- `bim/block-library/block-library-cloud-store.ts` — cloud metadata (ΧΩΡΙΣ γεωμετρία).
- `bim/block-library/block-palette-entries.ts` — pure merge session+cloud (dedup ανά όνομα).
- `bim/block-library/hydrate-cloud-block.ts` — lazy geometry → registry (idempotent).
- `bim/block-library/block-library-registry.ts` — thin wrapper πάνω στον κοινό primitive.
- `app/BlockLibraryRegistryHost.tsx` — always-on Firestore subscription (mirror `UserMaterialRegistryHost`)· mount στο `DxfViewerTopBar`.

**UI**
- `ui/panels/block-library/{BlockLibraryPanel,BlockLibraryCard,BlockSaveToLibraryDialog}.tsx` + `hooks/useBlockLibraryPalette.ts`.
- i18n `dxf-viewer-shell` (el+en): `blockLibrary.{categories,licenses,save,badges,errors}.*`.

**Υποδομή**
- Enterprise id `blklib` (prefixes + class + convenience + service re-export) — SOS N.6.
- `COLLECTIONS.BLOCK_LIBRARY` = `block_library`· `buildBlockLibraryGeometryPath` (storage-path SSoT).
- `firestore.rules` (user-scope doc = ιδιωτικό, διαβάζεται ΜΟΝΟ από τον δημιουργό), `firestore.indexes.json`
  (3 composite), `storage.rules` (company-scoped, `application/json` ≤5MB), + coverage manifests (CHECK 3.15/3.16).

## Απόφαση (M3) — έτοιμη/partner βιβλιοθήκη + δημοσίευση + φίλτρα

### Το περιεχόμενο ΥΠΗΡΧΕ ΗΔΗ (το κρίσιμο SSoT εύρημα του M3)

Η προφανής υλοποίηση («γράψε κατάλογο με σχήματα επίπλων/ειδών υγιεινής») θα ήταν **δεύτερη
βιβλιοθήκη γεωμετρίας**: η εφαρμογή έχει ΗΔΗ **16 παραμετρικά 2D σύμβολα κάτοψης** δικής μας
συγγραφής (ADR-415 Δ1 — είδη υγιεινής / κουζίνα / έπιπλα, `source: 'parametric (own)'`).
Το seed λοιπόν **παράγεται** από τον `FLOORPLAN_SYMBOL_CATALOG`: ο ίδιος drawer SSoT
(`floorplan-symbol-symbol.ts`) που ζωγραφίζει τα σύμβολα, παράγει και τα BLOCK-LOCAL members
των system blocks. Διόρθωση στο σύμβολο ⇒ το επόμενο seed run την κουβαλά. **Μηδέν νέα γεωμετρία.**

Νομικά αυτό είναι και η **προϋπόθεση** του `scope:'system'`: δική μας συγγραφή ⇒ `cc0` /
`redistributable: true` ⇒ επιτρέπεται να αναδιανεμηθεί σε όλους τους πελάτες. Ένα ξένο DXF του
χρήστη δεν θα περνούσε ποτέ αυτό το gate.

### Πρακτική των μεγάλων παικτών (ρητή δικαιολόγηση)
| Ερώτημα | Revit / ArchiCAD / Figma | Τι κάναμε |
|---|---|---|
| Πώς μπαίνει περιεχόμενο στην κοινή βιβλιοθήκη; | **Ρητή δημοσίευση** ΥΠΑΡΧΟΝΤΟΣ αντικειμένου (ArchiCAD «publish to office library», Figma «publish to team library») — ΟΧΙ δεύτερο αντίγραφο | `promoteBlock()` αλλάζει ΜΟΝΟ το `scope` του ΙΔΙΟΥ doc· ίδιο id, ίδιο geometry blob |
| Νομικό gate στην προαγωγή; | **ΔΕΝ έχουν** — υποθέτουν ότι το office library περιέχει ό,τι δικαιούσαι | **Το προσθέτουμε εμείς** (ρητή απόκλιση): `redistributable === true` αλλιώς μπλοκ + εξήγηση + δυνατότητα διόρθωσης άδειας επί τόπου |
| Πώς βρίσκεις αντικείμενο σε 500; | **Αναζήτηση + κατηγορία + ποια βιβλιοθήκη** (Revit family browser, Figma assets) | `LibraryFilterBar` + `matchesLibraryFilter` — τα ίδια τρία, κοινά με το panel υλικών |
| Το built-in περιεχόμενο επεξεργάζεται; | **Όχι** — read-only, το φορτώνεις και το αλλάζεις στο δικό σου | `builtin: true` ⇒ ο πυρήνας απορρίπτει patch/delete· η κάρτα δεν δείχνει καν τα κουμπιά |

### Δύο ΠΡΑΓΜΑΤΙΚΑ κενά που έκλεισε το M3 (ήταν λανθάνοντα από το M2)
1. **Το system geometry path ήταν company-scoped.** Ο `buildBlockLibraryGeometryPath` δεχόταν
   μόνο `companyId: string` και ο `hydrateCloudBlockDef` έκανε `if (!item.companyId) return null`
   ⇒ ένα `scope:'system'` block (companyId `null`) **δεν θα κατέβαινε ΠΟΤΕ** — μη τοποθετήσιμη
   κάρτα. Πλέον: `companyId: string | null` → `system/block-library/{blockId}.json` +
   `storage.rules` (read = κάθε authenticated, write = super-admin/seed).
2. **Αυτο-προαγωγή σε `system` από client.** Ο κανόνας update του `block_library` έλεγχε μόνο το
   *τρέχον* scope (`resource.data.scope != 'system'`), όχι το *νέο* ⇒ χρήστης μπορούσε να θέσει
   `scope:'system'` στο δικό του doc και να το κάνει ορατό σε **όλους τους πελάτες**. Προστέθηκε
   `request.resource.data.scope != 'system'`.

### SSoT: ένα gate, ένα φίλτρο, ένας κατάλογος κατηγοριών
- **`block-scope-guard.ts`** (νέο) — ο νομικός έλεγχος ζει ΜΙΑ φορά· τον καλούν ΚΑΙ ο `saveBlock`
  ΚΑΙ ο `promoteBlock` (αλλιώς το promote θα ήταν πίσω πόρτα του gate) — ίδιος κανόνας και στο UI
  (`canPromoteToSharedScope` → disabled κουμπί + εξήγηση, όχι δεύτερη κρίση).
- **`ui/panels/shared/library-filter.ts` + `LibraryFilterBar.tsx`** (νέα) — αναζήτηση/κατηγορία/
  scope chips: το palette των block **και** το `MaterialsLibraryPanel` (που ξαναγράφτηκε ως
  καταναλωτής — είχε δικό του χειρόγραφο φίλτρο) πλέον μοιράζονται ένα.
- **`BLOCK_CATEGORIES` / `BLOCK_LICENSE_TYPES`** — οι τύποι ΠΑΡΑΓΟΝΤΑΙ από τους καταλόγους· η
  φόρμα και το φίλτρο τους διαβάζουν (πριν: χειρόγραφη λίστα στη φόρμα, διπλότυπη του τύπου).
- **`BlockLicenseFields` / `BlockDialogFooter`** — τα κοινά κομμάτια των δύο φορμών (το `jscpd`
  έπιασε το footer ως πραγματικό clone στην πρώτη γραφή — N.18).

### Αρχεία (M3)
**Περιεχόμενο / seed**
- `bim/block-library/system-block-geometry.ts` — preset (ADR-415) → BLOCK-LOCAL polylines (ντετερμινιστικά ids).
- `bim/data/system-blocks-seed.ts` — ο κατάλογος προς σπορά (παράγεται από τον `FLOORPLAN_SYMBOL_CATALOG`· `cc0`/`redistributable`).
- `scripts/seed-block-library.ts` + `npm run seed:block-library` — Admin SDK: blob → `system/block-library/*.json`, μετά doc (`blklib_sys_*`, `builtin:true`, `companyId:null`). Idempotent.

**Gate / service**
- `bim/block-library/block-scope-guard.ts` — `assertBlockScopeAllowed` (save + promote) / `canPromoteToSharedScope` (UI).
- `bim/services/BlockLibraryService.ts` — `promoteBlock()` (ίδιο doc, μόνο scope+license)· ο `saveBlock` καταναλώνει τον κοινό guard.

**Υποδομή**
- `services/upload/utils/storage-path.ts` — `companyId: string | null` ⇒ system path.
- `bim/block-library/{block-geometry-storage,hydrate-cloud-block}.ts` — system locator (χωρίς εταιρεία).
- `storage.rules` — `/system/block-library/{fileName}` (read: authenticated· write/delete: super-admin).
- `firestore.rules` — `block_library` update: `request.resource.data.scope != 'system'`.

**UI**
- `ui/panels/shared/{library-filter.ts,LibraryFilterBar.tsx}` — κοινό φίλτρο βιβλιοθηκών.
- `ui/panels/block-library/{BlockPromoteDialog,BlockLicenseFields,BlockDialogFooter}.tsx` + `BlockLibraryCard` (badge scope + ενέργειες) + `BlockLibraryPanel` (φίλτρα + ConfirmDialog διαγραφής) + `useBlockLibraryPalette` (`promoteEntry`/`deleteEntry` μέσω κοινού `runEntryAction`).
- `ui/panels/materials/MaterialsLibraryPanel.tsx` — καταναλωτής του κοινού φίλτρου.
- `layout/FloatingPanelsSection.tsx` + `app/DxfViewerContent.tsx` — threading `projectId` (ξεκλειδώνει τη δημοσίευση σε scope «έργου»).
- i18n `dxf-viewer-shell` (el+en): `blockLibrary.{scopes,filter,promote,delete}.*`, `categories.kitchen`, `badges.system`.

## Απόφαση (M4) — thumbnails + επεξεργασία metadata

### Πρακτική των μεγάλων παικτών (ρητή δικαιολόγηση + ρητή ΑΠΟΚΛΙΣΗ)

| Ερώτημα | Revit / ArchiCAD / AutoCAD | Figma | Τι κάναμε |
|---|---|---|---|
| Τι δείχνει η κάρτα του καταλόγου; | **Raster preview** ψημένο μέσα στο asset (`.rfa` preview bitmap / `.gsm` preview picture / block thumbnail στο DesignCenter) | **Ζωντανό vector** του component | **Vector preview, προϋπολογισμένο** |
| Κατεβαίνει η γεωμετρία για να ζωγραφιστεί μια κάρτα; | **ΠΟΤΕ** — θα κατέρρεε σε 500 αντικείμενα | Ναι, αλλά **δωρεάν**: όλο το αρχείο είναι ήδη στη μνήμη | **ΠΟΤΕ** — το preview ταξιδεύει μέσα στο metadata doc |
| Πότε παράγεται; | **Μία φορά, στην εγγραφή** του asset | Σε κάθε render | **Μία φορά, στην εγγραφή** (`saveBlock` / seed) |
| Πώς διορθώνονται τα στοιχεία ενός αντικειμένου; | **Επί τόπου** (Revit «Family Properties» / ArchiCAD «Object Settings») — ΧΩΡΙΣ να ξαναχτιστεί το αρχείο | «Rename» στο assets panel | `updateBlock()` — **ίδιο doc, ίδιο blob, ίδιο id** |

**Κρατάμε τον κύκλο ζωής των μεγάλων** (preview προϋπολογισμένο, αποθηκευμένο ΜΕΣΑ στον
κατάλογο, μηδέν geometry download για μια κάρτα) και **αποκλίνουμε ΡΗΤΑ στο μέσο**: αντί για
raster PNG στο Storage, αποθηκεύουμε **διανυσματικό μονοπάτι** (`thumbnail: {v, d}`) μέσα στο
ίδιο Firestore doc. Οι τέσσερις λόγοι — και γιατί η απόκλιση είναι *βελτίωση*, όχι συμβιβασμός:

1. **Το seed τρέχει σε Node** (Admin SDK, `scripts/seed-block-library.ts`) — **δεν υπάρχει DOM
   canvas**. Ένα PNG θα απαιτούσε headless canvas (νέα εξάρτηση + έλεγχος άδειας, SOS N.5) ή
   δεύτερη υλοποίηση «raster στον browser / κάτι άλλο στο seed». Ο vector builder είναι καθαρά
   μαθηματικά ⇒ **ΕΝΑΣ κώδικας** τρέχει σε browser, Node και tests.
2. **Μηδέν επιπλέον δικτύωση**: το doc έρχεται ήδη από τη συνδρομή του palette. Ένα PNG θα ήταν
   ένα ακόμα HTTP request **ανά κάρτα** (και ένα ακόμα Storage object να διαγραφεί/να ορφανέψει).
3. **Theme-correct + resolution-free**: `stroke="currentColor"` (N.3) σε light/dark/hover, καθαρό
   σε κάθε DPR. Ένα PNG ψήνει χρώμα και ανάλυση.
4. **Είναι ήδη το σπιτικό μοτίβο**: linetype / arrowhead / line-style / hatch-pattern thumbnails
   είναι ΟΛΑ «καθαρά δεδομένα → inline SVG», παραγόμενα από τον ΙΔΙΟ SSoT που ζωγραφίζει ο
   renderer. Το block thumbnail μπαίνει στην ίδια οικογένεια, δεν ανοίγει δεύτερη.

> Το preview **δεν είναι δεύτερη πηγή αλήθειας**: είναι παράγωγο, απλοποιημένο και **φραγμένο**
> στιγμιότυπο (regenerable από το blob όποτε θέλουμε), και **καμία τοποθέτηση δεν το διαβάζει** —
> το tool περνά πάντα από το `hydrateCloudBlockDef` → registry → ίδιο FSM.

### SSoT: το κενό που έκλεισε — ουδέτερος flattener `Entity[] → πολυγραμμές`
Η εφαρμογή είχε **όλα** τα κομμάτια tessellation ως SSoT (`geometry-bulge-utils` /
`geometry-arc-utils` / `geometry-ellipse-utils` / `geometry-spline-utils` / `rectangleEntityVertices`)
αλλά **κανέναν ουδέτερο συνθέτη**: οι τρεις backends (Canvas2D renderer, DXF writer, vector-PDF
emitter) ζωγραφίζουν/γράφουν κατευθείαν — **κανένας δεν επιστρέφει σημεία**. Ένας καταναλωτής που
θέλει μόνο **σχήμα** δεν είχε τι να καλέσει.

**`rendering/entities/shared/entity-polylines.ts`** (νέο SSoT) είναι ακριβώς αυτός ο συνθέτης, με
**μηδέν νέα μαθηματικά καμπύλης** (κάθε τύπος delegate-άρει στον υπάρχοντα SSoT του· φωλιασμένο
block → `expandBlockInstance`, ο ίδιος placement SSoT). Ρητή απόφαση **να ΜΗΝ** ξαναγραφτούν οι
τρεις backends πάνω του: ο καθένας χρειάζεται περισσότερα από σχήμα (χρώμα/πάχος ανά entity,
γεμίσματα, κείμενο, native arcs για ακρίβεια εκτύπωσης) — ένας κοινός flattener θα ισοπέδωνε ό,τι
τους διαφοροποιεί.

### Μετονομασία: το όνομα ΕΙΝΑΙ κλειδί ταυτότητας (πραγματικό ρίσκο που κλείστηκε)
Το `block-library-registry`, το `hydrateCloudBlockDef` και ο dedup του palette κλειδώνουν **όλα**
στο **όνομα** (πρακτική AutoCAD: ένας ορισμός ανά όνομα). Άρα μια αφελής μετονομασία θα μπορούσε:
- να δημιουργήσει **δύο κάρτες με ίδιο όνομα** ⇒ last-wins στο registry ⇒ το tool τοποθετεί τη
  γεωμετρία του ΕΝΟΣ κάτω από την κάρτα του ΑΛΛΟΥ. → `isBlockNameTaken` (pure SSoT· ελέγχει ΚΑΙ
  τα session blocks, στη ΓΕΜΑΤΗ λίστα — όχι στη φιλτραρισμένη) φράζει τη φόρμα (save **και** edit).
- να αφήσει **ορισμό-φάντασμα** με το παλιό όνομα στο registry (αν είχε γίνει hydration) ⇒ θα
  ξαναεμφανιζόταν ως «μη αποθηκευμένο» session block με κουμπί 💾. → `removeSessionBlockDef(old)`
  μετά από επιτυχή μετονομασία (νέο `remove` στον κοινό `createKeyedVersionedStore`, ωφελεί και
  τα δύο stores — όχι τοπικό hack).

### Το gate ξανατρέχει και στην επεξεργασία (αλλιώς = πίσω πόρτα)
Ο `updateBlock` καλεί τον **ΙΔΙΟ** `assertBlockScopeAllowed` πάνω στο **τρέχον** scope με τη **νέα**
άδεια: ένα ήδη δημοσιευμένο block **δεν** μπορεί να «υποβαθμίσει» την άδειά του σε μη-αναδιανεμήσιμη
και να παραμείνει κοινόχρηστο. Το `scope` δεν είναι καν πεδίο του `UpdateBlockLibraryItemInput` —
η ορατότητα αλλάζει ΜΟΝΟ από τη ρητή «Δημοσίευση».

### Αρχεία (M4)
**Πυρήνας**
- `rendering/entities/shared/entity-polylines.ts` — **νέο SSoT**: `entityToPolylines` / `entitiesToPolylines`.
- `bim/block-library/block-thumbnail.ts` — `buildBlockThumbnail` (pure, ντετερμινιστικό, aspect-fit,
  Y-flip, όριο `MAX_THUMBNAIL_POINTS=900` με ρητό `truncated`) + `getBlockThumbnail` (WeakMap identity cache).
- `lib/state/createKeyedVersionedStore.ts` — `remove(key)` στον κοινό primitive.
- `bim/block-library/block-library-registry.ts` — `removeSessionBlockDef`.
- `bim/block-library/block-library-types.ts` — `BlockThumbnailVector`, `BlockLibraryItem.thumbnail`
  (αντικατέστησε το αχρησιμοποίητο `thumbnailUrl`), `UpdateBlockLibraryItemInput`, error `NAME_TAKEN`.
- `bim/block-library/block-palette-entries.ts` — `BlockPaletteEntry.thumbnail` (**μία** αναπαράσταση:
  session = ζωντανό, cloud = από το doc) + `canEditBlockEntry` + `isBlockNameTaken`.
- `bim/services/BlockLibraryService.ts` — `updateBlock()` (πάνω στον ΥΠΑΡΧΟΝΤΑ `ScopedLibraryService.patch`
  — κανένας νέος writer) + thumbnail στο `saveBlock`.
- `scripts/seed-block-library.ts` — thumbnail στο system doc (ίδιος builder, Node).

**UI**
- `ui/panels/block-library/BlockThumbnailPreview.tsx` — ΕΝΑΣ renderer (path → inline SVG· fallback
  στο footprint των `boundsMm` για doc προ-M4 ή block χωρίς γραμμική γεωμετρία).
- `ui/panels/block-library/BlockMetadataFields.tsx` — το **κοινό σώμα** φόρμας (όνομα+κατηγορία+άδεια)
  + `initialBlockMetadataForm` / `toBlockMetadataValues`· το `jscpd` το ΕΠΙΑΣΕ ως clone (N.18).
- `ui/panels/block-library/BlockEditDialog.tsx` (νέο) + `BlockSaveToLibraryDialog` (καταναλωτής του κοινού σώματος)
  + `BlockLibraryCard` (preview + ✏️) + `BlockLibraryPanel` (wiring + έλεγχος ονόματος στη γεμάτη λίστα)
  + `hooks/useBlockLibraryPalette` (`updateEntry` + καθάρισμα φαντάσματος στη μετονομασία).
- i18n `dxf-viewer-shell` (el+en): `blockLibrary.edit.*`, `blockLibrary.errors.{updateFailed,nameTaken}`.

## Απόφαση (M5) — mirror + μη-ομοιόμορφη κλίμακα στην τοποθέτηση

Το M1.5 tab εξέθετε ΜΟΝΟ **ομοιόμορφη** κλίμακα (ένα πεδίο, `allowNegative:false`). Το M5
προσθέτει τα δύο πράγματα που ο πιο σχετικός μεγάλος παίκτης θεωρεί δεδομένα: **mirror**
(καθρέφτισμα) και **μη-ομοιόμορφο** scale (x≠y). Το data model τα υποστήριζε ήδη
(`BlockEntity.scale: Point2D`) — έλειπε μόνο η έκθεση UI + το πλάτεμα ενός type.

### Πρακτική των μεγάλων παικτών (ρητή δικαιολόγηση — απόφαση Giorgio 2026-07-13)
| Player | non-uniform | mirror | Πώς |
|---|---|---|---|
| **AutoCAD `INSERT`** (ο DXF-native reference) | ✅ | ✅ | ξεχωριστά X/Y scale + **«Uniform Scale» checkbox** (τσεκαρισμένο by default)· **αρνητικό scale = mirror** |
| ArchiCAD | ✅ | ✅ (flip) | A/B stretch |
| Cinema 4D (MAXON) | ✅ (per-axis) | ✅ | αρνητικό scale |
| Figma | ✅ | ✅ (flip H/V) | W/H + **lock αναλογιών** (ίδιο uniform toggle) |
| **Revit** | ❌ **σκόπιμα** (type-driven) | ✅ (Mirror) | dimensional integrity |

**Απόφαση (AutoCAD INSERT verbatim):** έκθεσε **Κλίμακα X** + **Κλίμακα Y** ως ξεχωριστά πεδία με
`allowNegative:true` (**αρνητικό = mirror στον άξονα**) + ένα **«Ομοιόμορφη» lock toggle**
(default **ON**). Οι μεγάλοι το **προτείνουν** ρητά (AutoCAD/Figma το έχουν σαν checkbox/lock),
οπότε ακολουθούμε full enterprise + full SSoT ΧΩΡΙΣ απόκλιση:
- Uniform ON (default) → ίδια εμπειρία με προ-M5 (ένα νούμερο οδηγεί και τους δύο άξονες).
- Uniform OFF → X, Y ανεξάρτητα.
- Αρνητικό σε άξονα → mirror. Uniform ON + αρνητικό → **point reflection** (και οι δύο άξονες
  αρνητικοί = 180°), ΑΚΡΙΒΩΣ όπως το AutoCAD (true mirror = uncheck uniform + ένας άξονας αρνητικός).

### SSoT audit (grep-verified 2026-07-13 — τι βρέθηκε, τι επαναχρησιμοποιήθηκε)
Το repo είχε **ήδη** το ίδιο idiom σε δύο σημεία — reuse, μηδέν νέος μηχανισμός (N.18):
1. **`ui/block-advanced-panel/` (ADR-641)** — το αριστερό Properties palette ενός **ήδη
   τοποθετημένου** block εκθέτει `scaleX`+`scaleY` ως ξεχωριστά numeric πεδία (per-axis idiom).
   Δεν είχε uniform lock ούτε mirror (`min:0.0001`)· το M5 tab είναι ο πρώτος που τα προσθέτει.
2. **Scale tool (ADR-646)** — `contextual-scale-tool-tab.ts` έχει preset **`-1` (×-1)** +
   `allowNegative:true` («AutoCAD parity») ΚΑΙ **`type:'toggle'` "Non-uniform"** μέσω του κοινού
   ribbon-toggle SSoT (`useRibbonToggleCommands`). Το M5 uniform toggle δρομολογείται από τον
   **ΙΔΙΟ** dispatch (προστέθηκε `isBlockLibraryToggleKey` + `blockLibraryBridge` route).
3. **`utils/mirror-math.ts`** — SSoT: mirror ενός `block` = **αρνητικό scale σε έναν άξονα**
   (`scale:{x, y:-y}`). Επιβεβαιώνει «αρνητικό scale = mirror» ως canonical μοντέλο — το M5 UI
   γράφει ακριβώς αυτό, οπότε render/export/mirror-tool μένουν συνεπή.

### Uniform coupling: ζει στον bridge (όχι στον γενικό factory)
Ο `useToolHandleBridge` factory (M1.5) είναι numeric-only και **δεν** μοντελοποιεί coupled
fields/toggle (YAGNI μέχρι 2ο καταναλωτή, N.18). Το M5 uniform-lock coupling («όσο locked, το
γράψιμο ενός άξονα γράφει και τους δύο· ON → Y συγκλίνει στο X») είναι block-specific, οπότε ο
`useRibbonBlockLibraryBridge` το κατέχει τοπικά — ΑΛΛΑ πάνω στα ΙΔΙΑ shared primitives
(`useInertBridgeExtras`/`useStableBridge`· inline read κάτω από το jscpd threshold, όχι clone του
`readToolOverrideNumber`, γιατί μετά το `uniform?: boolean` ο handle δεν είναι πλέον assignable
στο numeric-only `ToolNumericOverrideHandle`). Ο core `setParamOverrides` κάνει **merge partial
patch**, άρα το boolean `uniform` συνυπάρχει με τα numeric overrides χωρίς νέο setter.

### WYSIWYG ghost (ADR-040) — μηδέν επιπλέον δουλειά
Το scale ρέει μέσα από το `buildParams` (`useBlockLibraryTool`), που τροφοδοτεί ΚΑΙ το commit ΚΑΙ
το `computeBlockFootprint`/`buildGhostBlockEntity`. Άρα το mirror/non-uniform ghost δουλεύει
**αυτόματα** πριν το κλικ — καμία δεύτερη διαδρομή, κανένα `useSyncExternalStore` σε orchestrator.

### Αρχεία (M5)
- `bim/block-library/block-library-types.ts` — `BlockLibraryParamOverrides`: `scale?:number` →
  `scaleX?`/`scaleY?` (αρνητικό=mirror) + `uniform?:boolean` (default ON).
- `hooks/drawing/useBlockLibraryTool.ts` — `buildParams`: scaleX/scaleY → `Point2D` (incl. negative).
- `ui/ribbon/hooks/bridge/block-library-command-keys.ts` — `params.{scaleX,scaleY}` + `toggles.uniform`
  + `isBlockLibraryToggleKey`.
- `ui/ribbon/data/contextual-block-library-tab.ts` — X/Y comboboxes (allowNegative, preset −1) + uniform toggle.
- `ui/ribbon/hooks/useRibbonBlockLibraryBridge.ts` — rewrite: rotation/scaleX/scaleY (uniform coupling)
  + uniform toggle read/write· composes shared primitives.
- `ui/ribbon/hooks/{useRibbonToggleCommands,useRibbonCommands}.ts` — route του uniform toggle μέσω
  του κοινού toggle dispatch (mirror του scale tool).
- i18n `dxf-viewer-shell` (el+en): `ribbon.commands.blockLibraryEditor.{scaleX,scaleY,uniform}`
  (αντικατέστησαν το `.scale`).

## Νομική ασφάλεια (by design)
Ο τύπος `BlockLibraryItem.license` (M2) κρατά ανά αντικείμενο τύπο άδειας + `redistributable`. Default για
user-import → `unknown` / `redistributable:false`. Promote σε shared/system scope → μπλοκάρεται εκτός αν
`redistributable === true`. (Επιπλέον product-level όρος χρήσης — εκτός κώδικα.)

## Verification
- **Jest M5** (17): `ui/ribbon/hooks/__tests__/useRibbonBlockLibraryBridge.test.tsx` (12 —
  defaults 0°/1/1· read ανά άξονα· write rotation· **uniform ON→ζευγάρωμα X&Y**· **OFF→ανεξάρτητα**·
  **αρνητικό=mirror passthrough**· reject 0/NaN· **toggle default ON + OFF→uniform:false + ON→Y=X**·
  inactive no-op· ξένο key no-op· tab wiring: combobox keys = rotation/scaleX/scaleY, toggle key
  ξεχωριστά, αυστηρός combo↔toggle guard split) + `bim/block-library/__tests__/block-library-m5-mirror-nonuniform.test.ts`
  (5 — `buildParams` overrides→`Point2D`: non-uniform x≠y, **αρνητικό=mirror**, μόνο-scaleX→default Y,
  κανένα scale→{1,1}, ghost footprint ΙΔΙΟΣ δρόμος = 4 γωνίες). **Dispatch golden αμετάβλητο** (35
  combobox routes — το uniform toggle είναι ξεχωριστό μονοπάτι). **jscpd:diff καθαρό** σε 8 src αρχεία.
  Regression: 44/44 στα θιγόμενα suites (+ foundation/m1-wiring/dispatch).
- **Jest M4** (30): `bim/block-library/__tests__/block-library-m4-thumbnail.test.ts` (23 — ο ουδέτερος
  flattener ανά τύπο (γραμμή/κλειστή πολυγραμμή/κύκλος/**bulge**/κείμενο→κενό/**φωλιασμένο block**)·
  ο builder: εντός viewBox, **Y αναστραμμένο**, **ντετερμινιστικός** (⇒ idempotent seed), `null` χωρίς
  γραμμική γεωμετρία, φραγμένος με ρητό `truncated`, NaN-safe· **ΚΑΘΕ** system block του καταλόγου
  παράγει preview (μηδέν κενή κάρτα στην έτοιμη βιβλιοθήκη)· palette: session=ζωντανό / cloud=από το
  doc / προ-M4 doc→fallback· `canEditBlockEntry` + `isBlockNameTaken`) + 7 στο `BlockLibraryService.test.ts`
  (thumbnail στο doc & **μόνο ένα** Storage object· text-only→χωρίς πεδίο· `updateBlock`: μετονομασία
  χωρίς άγγιγμα γεωμετρίας/scope/id, trim + κενό όνομα, **ΙΔΙΟ gate** σε δημοσιευμένο block, ιδιωτικό
  block ελεύθερο, builtin/not-found reject). Regression: **698/698** στα θιγόμενα suites.
- **jscpd:diff** (N.18): ΕΠΙΑΣΕ πραγματικό clone (το κοινό JSX σώμα των δύο φορμών) → εξαγωγή στο
  `BlockMetadataFormFields`· τελικός έλεγχος **καθαρός** σε 16 αρχεία.
- **Jest M3** (27): `bim/block-library/__tests__/block-library-m3-system-content.test.ts` (21 — ο seed
  κατάλογος καλύπτει ΟΛΟΝ τον κατάλογο του ADR-415 & είναι όλος `redistributable`· η παραγόμενη
  γεωμετρία είναι BLOCK-LOCAL με τις διαστάσεις του preset & ντετερμινιστική· system path ≠ company
  path· το gate σε 4 σενάρια· δικαιώματα καρτών (builtin read-only, ξένο block, ήδη δημοσιευμένο)·
  το φίλτρο) + 6 στο `BlockLibraryService.test.ts` (promote: gate ΙΔΙΟ με το save, διόρθωση άδειας
  στην ίδια κίνηση, project scope, builtin reject, not-found). Regression: 450/450 στα θιγόμενα suites
  (μαζί με 19/19 `MaterialLibraryService` + τα υπάρχοντα panel tests μετά την εξαγωγή του φίλτρου).
- **Jest M2** (24): `bim/services/__tests__/BlockLibraryService.test.ts` (15 — blob-πριν-doc, `blklib_*` id, tenant/lifecycle πεδία, multi-scope merge *χωρίς* τα user blocks άλλου χρήστη, builtin guard, **νομικό gate**) + `bim/block-library/__tests__/block-library-m2-cloud.test.ts` (9 — blob roundtrip/απόρριψη σκουπιδιών, palette merge + dedup ονόματος, lazy hydration idempotent/αποτυχία). Regression: 19/19 `MaterialLibraryService` μετά την εξαγωγή του πυρήνα.
- **Jest M1** (13/13): `bim/block-library/__tests__/block-library-foundation.test.ts` (capture + place) + `block-library-m1-wiring.test.ts` (registry/selection/bounds/capture-integration/footprint — το footprint επικυρώνεται έναντι του πραγματικού `getEntityBounds`/block-expander SSoT).
- **jscpd:diff** στα staged src (N.18) πριν «done».
- Manual (μέσω /run): import DXF με blocks → «Blocks» → palette → κλικ κάρτας → κλικ καμβά → τοποθέτηση + Ctrl+Z.

## Deferred (επόμενα slices — ρητά ΕΚΤΟΣ M1/M1.5/M2/M3)
- **Το seed δεν έχει τρέξει ακόμα σε production** (`npm run seed:block-library` — απαιτεί Admin
  credentials· ο Giorgio το εκτελεί). Μέχρι τότε η έτοιμη βιβλιοθήκη είναι κενή στο cloud, ο
  κώδικας όμως είναι πλήρης (και το `storage.rules`/`firestore.rules` deploy είναι προϋπόθεση).
- **Raster preview**: ρητά **ΑΠΟΡΡΙΦΘΗΚΕ** στο M4 (βλ. §Απόφαση M4 — Node seed χωρίς DOM canvas,
  +1 request/κάρτα, ψημένο χρώμα). Αν ποτέ μπει περιεχόμενο που ΔΕΝ είναι vector (π.χ. asset με
  εικόνα/υλικά), τότε — και μόνο τότε — ξανασυζητιέται.
- **Re-thumbnail σε αλλαγή γεωμετρίας**: δεν υπάρχει ροή που αλλάζει τη γεωμετρία ενός σωσμένου block
  (το `updateBlock` αγγίζει μόνο metadata). Αν προστεθεί «αντικατάσταση γεωμετρίας», ΠΡΕΠΕΙ να
  ξαναχτίζει και το `thumbnail` στην ίδια κίνηση (ο builder είναι ήδη ένας).
- ~~**Υποψήφια migration στους νέους SSoT**~~ **✅ ΟΛΟΚΛΗΡΩΘΗΚΕ (2026-07-14, βλ. Changelog)**:
  (α) `bim-family-type-service.ts` + `stair-presets-service.ts` συνθέτουν πλέον τον `ScopedLibraryService`
  μέσω του κοινού `createSubcollectionScopedLibrary` (subcollection topology). (β) `entityToSegments()`
  έγινε thin adapter πάνω στο `entityToPolylines`. Οι 7 baselined παραβάσεις → 0.

## Ρίσκα / σημεία προσοχής
- **ADR-040**: το placement tool/ghost διαβάζει selection + transform σε event-time· κανένα `useSyncExternalStore` σε orchestrators (CanvasSection = pass-through). Το `computeBlockFootprint` χρησιμοποιεί το transient `buildGhostBlockEntity` (χωρίς per-frame clone).
- **Serialization SSoT** (M2): θα χρησιμοποιηθεί ο υπάρχων entity serializer, όχι νέο JSON schema.
- **Anonymous blocks**: αποθηκεύονται μόνο named/πραγματικά (`shouldPreserveBlockName`), όχι `*X`/`*D`.

## Changelog
- **2026-07-14** — **Deferred SSoT ratchet migrations** ΟΛΟΚΛΗΡΩΘΗΚΑΝ (και τα 3· ΟΧΙ νέο milestone —
  pure internal SSoT dedup, μηδέν αλλαγή συμπεριφοράς). **SSoT audit (grep, όχι μνήμη)**: ο
  `ScopedLibraryService` ΔΕΝ εξέφραζε subcollection topology (κάρφωνε top-level `collection(db, name)`)·
  τα family/stair ζουν σε `COMPANIES/{companyId}/…` και το user bucket τους κρατά ιδιοκτησία σε `ownerId`
  (όχι `createdBy`). **(Α)+(Β)** `bim-family-type-service.ts` + `stair-presets-service.ts` συνθέτουν πλέον
  τον πυρήνα για το ΔΙΑΒΑΣΜΑ (3-scope merge + 5min cache + tenant isolation) μέσω του νέου κοινού
  `createSubcollectionScopedLibrary` — οι ΕΓΓΡΑΦΕΣ (Zod validation / category schema / stampTenantAndScope /
  undo restore / savePreset) μένουν domain-specific (δεν ταιριάζουν στο γενικό `create/patch`). Οι 3 fetch
  helpers/service (user/company/project) + το χειροκίνητο merge+cache διαγράφηκαν. **Backward-compatible
  διεύρυνση πυρήνα**: `collectionRefFactory?` + `userScopeBucket(userId, ownerField)` + fail-loud
  `subscribe` guard (βλ. §M2 topology extension). **ΑΚΡΙΒΩΣ οι ίδιες εκπεμπόμενες queries** (ίδιο σύνολο
  `where`: companyId+scope+[ownerId|projectId]· η σειρά είναι άσχετη για Firestore/index) → μηδέν
  rules/index/CHECK-3.10/3.15/3.16 risk. **(Γ)** `GeometryUtils.entityToSegments()` (μερικός switch
  line/polyline/arc) → **thin arrow-const adapter** πάνω στο ουδέτερο `entityToPolylines` (M4· τώρα καλύπτει
  ΚΑΙ bulge/circle/ellipse/spline/rect/block)· η μετατροπή «πολυγραμμή → Segment[]» ζει σε τοπικό
  `polylinesToSegments`· μηδέν νέα curve math. Ο μοναδικός καταναλωτής (`EntityMergeService`, join) φιλτράρει
  closed entities upstream, οπότε φτάνουν μόνο open line/polyline/arc — endpoints/connectivity/result-type
  αμετάβλητα (η πυκνότητα tessellation τόξου μετατοπίζεται από fixed-24 σε principled 12°/segment, ίδιος
  όμως ο ίδιος καμπύλος — `JoinEntityCommand` πράσινο). **N.18**: το `jscpd:diff` έπιασε το αναμενόμενο
  A/B sibling clone (constructor init) → εξαγωγή στον κοινό συνθέτη· τελικός έλεγχος καθαρός. **Tests**:
  543/543 στα θιγόμενα suites (family-types + stairs + geometry + polylines) + Material/Block/Join πράσινα·
  προστέθηκε `firebase/auth` mock στα 2 migrated service tests (ο engine τραβά firestore-query.service).
  **Ratchet**: 7 baselined παραβάσεις (family ×3 + stair ×3 + GeometryUtils ×1) → **0**· `ssot:baseline` κατέβηκε.
- **2026-07-13** — **M5** υλοποιημένο (mirror + μη-ομοιόμορφη κλίμακα στην τοποθέτηση).
  **Big-player (απόφαση Giorgio)**: AutoCAD `INSERT` verbatim — **Κλίμακα X + Κλίμακα Y** (αρνητικό =
  καθρέφτισμα) + **«Ομοιόμορφη» lock toggle** (default ON = προ-M5 εμπειρία). Οι μεγάλοι το προτείνουν
  ρητά (AutoCAD checkbox / Figma lock), άρα μηδέν απόκλιση. **SSoT audit (grep, όχι μνήμη)**: το per-axis
  idiom υπήρχε ΗΔΗ σε `block-advanced-panel` (ADR-641) + το «negative=mirror»/toggle idiom στο scale tool
  (ADR-646)· το `mirror-math.ts` κλειδώνει «mirror block = αρνητικό scale». **Reuse**: το uniform toggle
  δρομολογείται μέσω του ΙΔΙΟΥ `useRibbonToggleCommands` SSoT (route `isBlockLibraryToggleKey` +
  `blockLibraryBridge`)· το coupling ζει τοπικά στον bridge (block-specific· ο numeric-only factory δεν
  το μοντελοποιεί, YAGNI/N.18) πάνω στα shared primitives. **WYSIWYG ghost** δουλεύει αυτόματα (ίδιο
  `buildParams` για commit + footprint, ADR-040). Type: `scale?:number` → `scaleX?`/`scaleY?`/`uniform?`.
  Tests: 12 bridge + 5 tool = 17· dispatch golden αμετάβλητο (35 routes)· jscpd καθαρό· 44/44 regression.
- **2026-07-13** — **Loose ends** (registry ratchet + rules test suite· ΟΧΙ νέο milestone).
  **(Α) `.ssot-registry.json`**: δηλώθηκαν ως modules οι 5 νέοι SSoT των M2/M3/M4 —
  `scoped-library-service` (bucket factories = η σημασιολογία των scopes, ΜΙΑ φορά·
  forbidden `where('scope','==','<literal>')`), `keyed-versioned-store` (Map+version+subscribe
  primitive· forbidden re-declared contract), `library-filter` (search+category+scope predicate·
  forbidden δεύτερο interface/inline predicate), `block-scope-guard` (ΕΝΑΣ έλεγχος `redistributable`·
  forbidden inline gate), `entity-polylines` (Entity→σημεία· forbidden νέος per-type switch).
  Όλα τα `forbiddenPatterns` είναι grep ERE **χωρίς** `(?:)`/lookahead — επικυρωμένα με πραγματικό
  `grep -E` πριν τη δήλωση· `npm run test:registry-golden` **86/86 πράσινο**. `npm run ssot:baseline`
  → 353 modules, 90 files / 135 violations (οι 4 νέες γνωστές παραβάσεις — family-type/stair-presets ×3,
  GeometryUtils ×1 — είναι υπαρκτός legacy κώδικας, μπήκαν baselined ως ratchet targets, βλ. Deferred·
  ΔΕΝ «ευλογήθηκε» staged αρχείο άλλου agent). **Το token-based structural clone** (που ο regex ratchet
  είναι τυφλός να δει) το φυλά ήδη το jscpd (CHECK 3.28) — ρητά σημειωμένο στα module descriptions.
  **(Β) Rules test suite** `tests/firestore-rules/suites/block-library.rules.test.ts` (graduated από
  `FIRESTORE_RULES_PENDING` → `FIRESTORE_RULES_COVERAGE`): πάνω στο ΥΠΑΡΧΟΝ ADR-298 harness (matrix
  manifest + `assertCell` + seeder), κανένα δεύτερο harness. Νέα `blockLibraryMatrix` (bespoke: το `user`
  scope είναι ιδιωτικό ΕΝΤΟΣ tenant — ούτε ο company admin το διαβάζει) + νέα `Reason` `not_owner` + νέος
  seeder `seedBlockLibraryItem`. **Πραγματικό εύρημα ασφαλείας που το suite ΤΩΡΑ φυλά**: για `list`, οι
  κανόνες αξιολογούνται πάνω στο **query** (rules ≠ filters) — τα list cells στέλνουν το ΠΡΑΓΜΑΤΙΚΟ user
  bucket query του `ScopedLibraryService` (`scope=='user' && createdBy==caller && companyId==tenant`)·
  attack tests: colleague ΔΕΝ μπορεί να διευρύνει το query σε ξένο bucket. Καλύπτει read/list/create/
  update/delete × personas + hardening: system=seed-only+read-all, **ΑΠΑΓΟΡΕΥΣΗ αυτο-προαγωγής σε
  `system`** (το κενό του M3), companyId immutable, promote user→company. Το `assertCell` επεκτάθηκε να
  δέχεται πολλαπλά `listFilter` (multi-`where` query· ένα filter μένει έγκυρο). **CHECK 3.16 static: OK·
  emulator suite: 44/44 πράσινο.**
- **2026-07-13** — **M4** υλοποιημένο (thumbnails + επεξεργασία metadata).
  **Thumbnails**: κρατήσαμε τον κύκλο ζωής των μεγάλων (preview προϋπολογισμένο ΜΕΣΑ στον κατάλογο,
  μηδέν geometry download για μια κάρτα) και **αποκλίναμε ρητά στο μέσο** — **vector, όχι raster**:
  το seed των system blocks τρέχει σε **Node χωρίς DOM canvas** (ένα PNG θα ζητούσε headless canvas
  ή δεύτερη υλοποίηση), το doc έρχεται ήδη από τη συνδρομή (μηδέν +1 request/κάρτα), και το inline
  SVG είναι theme-correct (`currentColor`) — που είναι ΚΑΙ το υπάρχον σπιτικό μοτίβο thumbnail
  (linetype/arrowhead/line-style/hatch). **SSoT**: εξήχθη ο ΟΥΔΕΤΕΡΟΣ `entity-polylines`
  (`Entity[] → πολυγραμμές`) — το κενό ήταν πραγματικό: υπήρχαν όλα τα tessellation SSoTs αλλά κανένας
  συνθέτης που να επιστρέφει σημεία (οι 3 backends ζωγραφίζουν/γράφουν κατευθείαν)· μηδέν νέα curve math.
  **Επεξεργασία**: `updateBlock()` πάνω στον ΥΠΑΡΧΟΝΤΑ `ScopedLibraryService.patch` (κανένας νέος
  writer)· ο ΙΔΙΟΣ νομικός guard ξανατρέχει στο τρέχον scope (αλλιώς η φόρμα θα ήταν πίσω πόρτα του
  gate)· το `scope` ΔΕΝ είναι πεδίο της φόρμας. **Δύο πραγματικά ρίσκα έκλεισαν** γύρω από το ότι το
  ΟΝΟΜΑ είναι κλειδί ταυτότητας: (α) διπλό όνομα ⇒ τοποθέτηση λάθος γεωμετρίας → `isBlockNameTaken`
  (φράζει save **και** edit, ελέγχει και τα session blocks)· (β) ορισμός-φάντασμα με το παλιό όνομα
  μετά τη μετονομασία → `removeSessionBlockDef` (νέο `remove` στον κοινό `createKeyedVersionedStore`).
  Το `jscpd` ΕΠΙΑΣΕ ξανά πραγματικό clone (κοινό JSX σώμα φορμών) → `BlockMetadataFormFields`· τελικός
  έλεγχος καθαρός (N.18). Tests: 23 νέα (flattener/builder/palette/κανόνες) + 7 νέα service · 698/698
  στα θιγόμενα suites.
- **2026-07-13** — **M3** υλοποιημένο (έτοιμη βιβλιοθήκη + δημοσίευση + φίλτρα + διαγραφή).
  **SSoT**: το seeded περιεχόμενο **παράγεται** από τον υπάρχοντα κατάλογο συμβόλων του ADR-415
  (16 παραμετρικά, δικής μας συγγραφής ⇒ `cc0`/`redistributable`) — καμία δεύτερη γεωμετρία·
  ο νομικός έλεγχος εξήχθη στον κοινό `block-scope-guard` (τον καλούν save **και** promote — αλλιώς
  το promote γινόταν πίσω πόρτα του gate)· το φίλτρο βιβλιοθήκης έγινε κοινό SSoT
  (`library-filter` + `LibraryFilterBar`) και το `MaterialsLibraryPanel` ξαναγράφτηκε ως καταναλωτής·
  οι κατάλογοι κατηγοριών/αδειών έγιναν SSoT arrays (ο τύπος παράγεται από αυτούς).
  **Δύο πραγματικά κενά έκλεισαν**: (α) το geometry path ήταν company-scoped ⇒ system block ΔΕΝ θα
  κατέβαινε ποτέ (`companyId: string | null` → `system/block-library/*` + storage rule)· (β) ο κανόνας
  update επέτρεπε **αυτο-προαγωγή σε `system`** (ορατό σε όλους τους πελάτες) → μπλοκαρίστηκε.
  `promoteBlock` = ίδιο doc, μόνο `scope`+`license` (ArchiCAD/Figma publish semantics, ΟΧΙ αντίγραφο).
  Το `jscpd` έπιασε ΔΥΟ πραγματικά clones (params object + dialog footer) → εξαγωγή
  (`BlockDialogFooter`)· τελικός έλεγχος καθαρός (N.18). Tests: 21 νέα (seed catalog/γεωμετρία/path/
  gate/δικαιώματα καρτών/φίλτρο) + 6 νέα `promoteBlock` · 450/450 στα θιγόμενα suites.
- **2026-07-13** — **M2** υλοποιημένο (cloud persistence + προέλευση/άδεια). **SSoT**: εξήχθη ο κοινός
  `ScopedLibraryService` (+ κανονικά scope buckets) — ο `MaterialLibraryService` ξαναγράφτηκε ως καταναλωτής
  με αμετάβλητο API (19/19 τα tests του)· το `createKeyedVersionedStore` ενοποίησε registry + cloud store.
  Ο πρώτος `jscpd:diff` ΕΠΙΑΣΕ clone (τα δύο `buildXBuckets`) → εξαγωγή στον πυρήνα· τελικός έλεγχος καθαρός (N.18).
  Γεωμετρία = blob στο Storage (v1 schema, strip `selected`), metadata = `block_library` doc (`blklib_*`, SOS N.6).
  Lazy hydration cloud→registry ⇒ **μία** διαδρομή τοποθέτησης. **Νομικό gate** στον service: κοινόχρηστο scope
  απαιτεί `redistributable` (tested — μπλοκάρει ΠΡΙΝ από κάθε εγγραφή)· user-import default `unknown`/`false`.
  Rules (user-scope doc = ιδιωτικό ακόμα και εντός εταιρείας) + 3 indexes + storage rules + coverage manifests.
  Tests: 15/15 `BlockLibraryService` + 9/9 blob/merge/hydration· 318/318 στα θιγόμενα suites.
- **2026-07-13** — **M1.5** υλοποιημένο: contextual tab «Τοποθέτηση Block» (rotation μοίρες / ομοιόμορφο scale) + `block-library-tool-bridge-store` (tool → ribbon) + `useRibbonBlockLibraryBridge`. **SSoT**: ο asset picker του `useToolHandleBridge` έγινε προαιρετικός → το block-library είναι ο πρώτος numeric-only καταναλωτής του ΙΔΙΟΥ factory (μηδέν αλλαγές στους 3 υπάρχοντες bridges· αποφεύχθηκε sibling clone, N.18). Options από τον SSoT `literalNumberOptions`. 10/10 νέα jest (bridge read/write + tab↔bridge key wiring + trigger registration + numeric-only invariant)· 546/546 στα θιγόμενα suites· jscpd καθαρό. Dispatch golden pins 33→34 routes.
- **2026-07-13** — M1 υλοποιημένο (θεμέλιο + wiring): capture μετά το import, `useBlockLibraryTool` (ADR-600), dispatch/lifecycle, κουμπί «Blocks» + palette «Τα Blocks μου», selection SSoT. 13/13 jest. Contextual tab + cloud → επόμενα milestones.
