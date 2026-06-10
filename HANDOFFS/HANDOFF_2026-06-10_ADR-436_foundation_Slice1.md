# HANDOFF — ADR-436 Θεμελίωση / Foundation Discipline → Slice 1 (pad)

**Date:** 2026-06-10 · **Model:** Opus 4.8 · **Από:** προηγούμενη συνεδρία (Slice 0 DONE)

---

## 0. Γλώσσα & βασικοί κανόνες (CLAUDE.md)

- **Απαντάς ΠΑΝΤΑ στα Ελληνικά** (LANGUAGE RULE, overrides everything).
- **ΠΟΤΕ git commit/push** χωρίς ρητή εντολή Giorgio (N.(-1)). **Ο Giorgio κάνει το commit, ΟΧΙ εσύ.**
- **Shared working tree** με άλλον agent → `git add` **ΜΟΝΟ τα δικά σου** αρχεία, ΠΟΤΕ `git add -A`.
- **N.17:** ΕΝΑ `tsc` τη φορά — έλεγξε ότι δεν τρέχει άλλος (`Get-CimInstance Win32_Process … *tsc*`) ΠΡΙΝ ξεκινήσεις.
- **ΜΗΝ** αγγίζεις `adr-index.md` (shared tree).
- Στόχος: **«όπως η Revit, FULL ENTERPRISE + FULL SSOT».** Μηδέν `any`/`as any`/`@ts-ignore`. Search πριν γράψεις.

---

## 1. Τι είναι το έργο

Νέο BIM **foundation/θεμελίωση** discipline στην υποεφαρμογή `/dxf/viewer` (`src/subapps/dxf-viewer/`). Το ανωδομικό μοντέλο (wall/column/beam/slab) υπάρχει· **έλειπε εντελώς η θεμελίωση**. ADR: `docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md` (**ΔΙΑΒΑΣΕ ΤΟ ΠΡΩΤΑ** — έχει όλο το research + locked αρχιτεκτονική).

### Locked αρχιτεκτονική (ΜΗΝ την ξανασυζητάς)
- Νέο `FoundationEntity` με **discriminated-union** `FoundationParams` ανά `kind`.
- `FoundationKind = 'pad' | 'strip' | 'tie-beam'` — **ΜΟΝΟ point/line**, όλα `ifcType:'IfcFooting'`, `predefinedType` από `FOUNDATION_IFC_MAP`.
- **Region-based πλάκες θεμελίωσης (εδαφόπλακα/κοιτόστρωση) = REUSE slab** (kinds `ground`/`foundation` ΥΠΑΡΧΟΥΝ ήδη στο `slab-types.ts:46`). ΟΧΙ `mat` foundation kind. Αυτό = ξεχωριστό Slice 3 (slab polish), ΟΧΙ τώρα.
- Elevation (ADR-369): `topElevationMm` **αρνητικό** (below grade)· στερεό κρέμεται ΚΑΤΩ κατά `thicknessMm` (όπως slab/beam).

---

## 2. Slice 0 — DONE (μην το ξαναγράψεις)

**NEW αρχεία:**
- `src/subapps/dxf-viewer/bim/types/foundation-types.ts` — `FoundationKind`, `FoundationProfile`, `FoundationAnchor`, params union (`PadFootingParams`/`StripFootingParams`/`TieBeamParams`), `FoundationGeometry`, `FoundationEntity`, `FOUNDATION_IFC_MAP`, defaults (`DEFAULT_FOUNDATION_TOP_ELEVATION_MM=-1000`, `DEFAULT_PAD_*`, `ANCHOR_OFFSETS`), `buildDefaultFoundationParams(kind)`.
- `src/subapps/dxf-viewer/bim/types/foundation.schemas.ts` — Zod `discriminatedUnion('kind',…)` + superRefine (pad profile stepped/sloped) + `FoundationEntitySchema`.
- `src/services/factories/foundation.factory.ts` — `createFoundation(input)` (ifcType IfcFooting, predefinedType από SSoT map, enterprise id `fnd_`).
- 3 test suites (50 tests, ΟΛΑ πράσινα): `bim/types/__tests__/foundation-types.test.ts`, `foundation.schemas.test.ts`, `services/factories/__tests__/foundation.factory.test.ts`.

**MODIFIED (SSoT total-records):** `bim/types/bim-base.ts` (`BimElementType+='foundation'`), `config/bim-object-styles.ts` (`BimCategory`+`BIM_CATEGORY_LINE_COLORS.foundation='#6b7a8f'`+`BIM_CATEGORIES`+`MODEL_BIM_CATEGORIES`+`DEFAULT_OBJECT_STYLES.foundation`), `bim/discipline/bim-discipline.ts` (`foundation:'structural'`), `config/bim-subcategories.ts` (`foundation:[]` — γέμισέ το στο Slice 1), `bim/materials/material-catalog-defs.ts` (`elem-foundation` color `0x9a9488`), `bim-3d/materials/MaterialCatalog3D.ts` (`getElementMaterial3D` union +`'foundation'`), `bim/types/ifc-entity-mixin.ts` (+`IfcFooting` σε union+array+enum). Enterprise ID: `enterprise-id-prefixes.ts` (`FOUNDATION:'fnd'`), `-class.ts`, `-convenience.ts`, `.service.ts` (`generateFoundationId`).

**Verification Slice 0:** 50/50 jest, tsc καθαρό στα 12 αρχεία. **Known pre-existing tsc errors (ΟΧΙ δικά σου, ΜΗΝ τα διορθώσεις):** `mesh-to-object3d.ts:124` (gizmo agent, `string`→union), 2 untracked `proposal-ghost-3d-builders.ts`/`ProposalGhost3DMount.tsx` (άλλος agent).

---

## 3. Slice 1 — ΤΟ ΕΡΓΟ ΣΟΥ: `pad` (μεμονωμένο πέδιλο) full 2Δ + 3Δ

**Ξεκίνα σε Plan Mode** (ο Giorgio το ενέκρινε). Σκοπός: ο χρήστης να ΣΧΕΔΙΑΖΕΙ + ΒΛΕΠΕΙ ένα `pad` footing σε 2Δ κάτοψη και 3Δ. Μόνο `pad` profile=`flat` (stepped/sloped = Slice 1b). Μοτίβο = **mirror της ΚΟΛΩΝΑΣ** (point-based, single-click + anchor).

### Αρχεία να δημιουργήσεις (mirror column), με τα reference paths:

| Concern | NEW foundation αρχείο | MIRROR από (reference) |
|---|---|---|
| Geometry kernel | `bim/geometry/foundation-geometry.ts` (`computeFoundationGeometry`) | `bim/geometry/column-geometry.ts` |
| 2Δ renderer | `bim/renderers/FoundationRenderer.ts` (extends `BaseEntityRenderer`, dispatch by kind) | `bim/renderers/ColumnRenderer.ts` |
| 2Δ palette | `bim/foundations/foundation-render-palette.ts` | `bim/columns/column-render-palette.ts` |
| 2Δ hatch | `bim/foundations/foundation-hatch-patterns.ts` (concrete) | `bim/columns/column-hatch-patterns.ts` |
| 2Δ grips | `bim/foundations/foundation-grips.ts` | `bim/columns/column-grips.ts` |
| Scene insert | `bim/foundations/add-foundation-to-scene.ts` | `bim/columns/add-column-to-scene.ts` |
| Preview store | `bim/foundations/foundation-preview-store.ts` | `bim/columns/column-anchor-ghosts.ts`/`column-perimeter-confirm-store.ts` pattern |
| 3Δ converter | `bim-3d/converters/foundation-to-three.ts` (`foundationToMesh`) | `bim-3d/converters/bim-three-structural-converters.ts` (`columnToMesh`) |
| Tool hook | `hooks/drawing/useFoundationTool.ts` | `hooks/drawing/useColumnTool.ts` |
| Entity factory (tool) | `hooks/drawing/foundation-completion.ts` (`buildFoundationEntity`) | `hooks/drawing/column-completion.ts` |
| Update command | `core/commands/entity-commands/UpdateFoundationParamsCommand.ts` | `core/commands/entity-commands/UpdateColumnParamsCommand.ts` |
| Ribbon tab | `ui/ribbon/data/contextual-foundation-tab.ts` | `ui/ribbon/data/contextual-column-tab.ts` |
| Ribbon bridge | `ui/ribbon/hooks/useRibbonFoundationBridge.ts` | `ui/ribbon/hooks/useRibbonColumnBridge.ts` |
| Ribbon keys | `ui/ribbon/hooks/bridge/foundation-command-keys.ts` | `ui/ribbon/hooks/bridge/column-command-keys.ts` |
| Firestore | `bim/foundations/foundation-firestore-service.ts` | `bim/columns/column-firestore-service.ts` |
| Persistence hook | `hooks/data/useFoundationPersistence.ts` | `hooks/data/useColumnPersistence.ts` |
| Persistence host | `app/FoundationPersistenceHost.tsx` (mount στο `DxfViewerTopBar`) | `app/ColumnPersistenceHost.tsx` |

### Αρχεία να τροποποιήσεις (registration):
- `bim-3d/stores/Bim3DEntitiesStore.ts` — πρόσθεσε `foundations: readonly FoundationEntity[]` slice + `setFoundations` + `EMPTY_BIM_ENTITIES`.
- `bim-3d/scene/bim3d-resync.ts` — πρόσθεσε foundations στο snapshot.
- `bim-3d/scene/BimSceneLayer.ts` — `private syncFoundations(entities, ctx)` + call στο `syncFloorEntities` (κληρονομεί visibility/building/multi-floor δωρεάν μέσω `resolveEntity`).
- `bim-3d/converters/BimToThreeConverter.ts` — re-export `foundationToMesh`.
- `systems/tools/tool-definitions.ts` — tool IDs (`foundation-pad`).
- `app/ribbon-contextual-config.ts` — register `CONTEXTUAL_FOUNDATION_TAB` + trigger (`entity.type==='foundation'`).
- `config/bim-subcategories.ts` — γέμισε `foundation:['hidden-lines','centerline','cut-pattern']` + (αν χρειαστεί) wired set.
- `config/bim-object-styles.ts` — πρόσθεσε `subcategories` στο `foundation` style (hidden-lines dashed). Επαλήθευσε exact `LinePatternKey` από `config/bim-line-patterns.ts`.

### Κρίσιμα τεχνικά (Revit-grade)
- **3Δ elevation:** `foundationToMesh` → `mesh.position.y = (topElevationMm − thicknessMm) * MM_TO_M + buildingBaseElevationM` (κρέμεται ΚΑΤΩ). Reuse `buildShape(footprint.vertices)` + `extrudeAndRotate(shape, thicknessMm*MM_TO_M)` + `tagMesh(mesh, id, 'foundation', matId, levelId)` + `attachEdgesProjection(mesh,'foundation')` από `bim-3d/converters/bim-three-shape-helpers.ts`. Material: `getElementMaterial3D('foundation')`.
- **2Δ foundation-plan σύμβαση:** το πέδιλο είναι κάτω από στάθμη → **διακεκομμένο (hidden)** περίγραμμα + concrete hatch + κεντρικός σταυρός (column footprint indicator). Αυτό διαφοροποιεί οπτικά το foundation από column/slab.
- **Pad = point-based:** single-click placement + 9-position anchor + free rotation (mirror `useColumnTool` FSM `idle→awaitingPosition→committed`, Tab anchor cycle).
- **Enterprise IDs:** `createFoundation` factory ΗΔΗ έτοιμο (prefix `fnd`). Firestore: `setDoc()` + enterprise id, ΠΟΤΕ `addDoc` (N.6). Collection: `floorplan_foundations`.

### Constraints
- **ΕΚΤΟΣ ADR-040** (η θεμελίωση δεν αγγίζει micro-leaf canvas αρχιτεκτονική — εκτός αν προσθέσεις preview ghost overlay· τότε STAGE ADR-040).
- **i18n (N.11):** όλα τα labels σε `src/i18n/locales/el/dxf-viewer-shell.json` + `en/` (ΟΧΙ hardcoded strings).
- **N.15:** μετά την υλοποίηση → update ADR-436 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + `MEMORY.md` (`project_adr436_foundation.md`). ΟΧΙ adr-index.

### Πρώτα βήματα
1. Διάβασε ADR-436 (ιδίως §3, §4, §5, §6).
2. Διάβασε `column-types.ts`, `ColumnRenderer.ts`, `columnToMesh` (στο `bim-three-structural-converters.ts`), `useColumnTool.ts`, `contextual-column-tab.ts` ως πρότυπα.
3. Plan Mode → παρουσίασε plan για Slice 1 → έγκριση → υλοποίηση.

---

## 4. Verification στο τέλος Slice 1
- `npx jest foundation` πράσινο + νέα geometry/renderer/converter/tool tests.
- `tsc --noEmit` (N.17 single) — 0 νέα errors στα δικά σου.
- Browser: σχεδίασε ένα pad footing → φαίνεται 2Δ (διακεκομμένο+hatch) + 3Δ (κάτω από στάθμη). **Ο Giorgio κάνει browser-verify + commit.**

---

## 5. Memory pointers
- `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr436_foundation.md` (πλήρες context Slice 0 + roadmap).
- `MEMORY.md` → «Pending Design» → γραμμή ADR-436.
