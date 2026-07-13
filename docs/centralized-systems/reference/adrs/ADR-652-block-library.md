# ADR-652 — Block Library (βιβλιοθήκη DXF blocks: έπιπλα / είδη υγιεινής / κ.λπ.)

| | |
|---|---|
| **Status** | 🔵 PROPOSED (Milestones 1 + 1.5 + 2 + 3 υλοποιημένα) |
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

## Νομική ασφάλεια (by design)
Ο τύπος `BlockLibraryItem.license` (M2) κρατά ανά αντικείμενο τύπο άδειας + `redistributable`. Default για
user-import → `unknown` / `redistributable:false`. Promote σε shared/system scope → μπλοκάρεται εκτός αν
`redistributable === true`. (Επιπλέον product-level όρος χρήσης — εκτός κώδικα.)

## Verification
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
- **Thumbnails**: το palette δείχνει footprint από τα `boundsMm` (μηδέν κόστος)· raster preview στο Storage → όταν ζητηθεί.
- **Επεξεργασία metadata** σωσμένου block (μετονομασία/αλλαγή κατηγορίας) — ο πυρήνας έχει `patch`,
  δεν υπάρχει ακόμα φόρμα (το promote αγγίζει μόνο scope+license).
- **`.ssot-registry.json`**: οι νέοι SSoT (`scoped-library-service`, `createKeyedVersionedStore`,
  `library-filter`, `block-scope-guard`) ΔΕΝ δηλώθηκαν ακόμα ως modules (απαιτεί `npm run ssot:baseline`,
  που αγγίζει κοινό baseline ενώ το working tree μοιράζεται με άλλον agent) — να γίνει σε ήσυχο tree.
- **Rules test suite** για το `block_library` (είναι στο `FIRESTORE_RULES_PENDING`, «full matrix with
  the BIM batch») — το M3 σφίγγει τον κανόνα update, δεν προσθέτει suite.
- **Mirror (αρνητικό scale)** + μη-ομοιόμορφο scale x≠y: το `BlockEntity` τα υποστηρίζει ήδη (`scale: Point2D`), αλλά το M1.5 tab εκθέτει ΜΟΝΟ ομοιόμορφο — χωριστό control όταν ζητηθεί.

## Ρίσκα / σημεία προσοχής
- **ADR-040**: το placement tool/ghost διαβάζει selection + transform σε event-time· κανένα `useSyncExternalStore` σε orchestrators (CanvasSection = pass-through). Το `computeBlockFootprint` χρησιμοποιεί το transient `buildGhostBlockEntity` (χωρίς per-frame clone).
- **Serialization SSoT** (M2): θα χρησιμοποιηθεί ο υπάρχων entity serializer, όχι νέο JSON schema.
- **Anonymous blocks**: αποθηκεύονται μόνο named/πραγματικά (`shouldPreserveBlockName`), όχι `*X`/`*D`.

## Changelog
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
