# ADR-448 — Storey-Aware DXF Viewer (όροφοι → BIM elevations, υπόγειο, θεμελίωση, multi-storey ανέγερση)

- **Status**: 🟡 PROPOSED — Phase 1 recognition complete (code = SoT, 2026-06-12). Phases 1-4 planned, μη υλοποιημένες.
- **Date**: 2026-06-12
- **Author**: Giorgio Pagonis + Claude (Opus 4.8)
- **Scope**: DXF Viewer subapp — σύνδεση του single-floor BIM editing με τη δομή ορόφων του κτιρίου (καρτέλα «Όροφοι»).
- **Related**: ADR-369 (BIM elevation convention / z-chain), ADR-237 + ADR-420 (Level ↔ Floor linking), ADR-399 (floor navigation tabs / multi-floor 3D), ADR-309 (context-aware floorplan type), ADR-441 (GRID-FIRST θεμελίωση/ανέγερση — GEN-COL/GEN-SLAB), ADR-436 (foundation discipline), ADR-358 (stair ↔ floor).
- **Impact**: 🟡 ADDITIVE — νέο SSoT context provider + wiring σε υπάρχοντα defaults. Καμία breaking αλλαγή στο storage schema (τα entities παραμένουν level-relative).

---

## 1. Πλαίσιο / Πρόβλημα

Ο μηχανικός θέλει να κτίζει **ολόκληρη την ελληνική οικοδομή** (θεμελίωση → υπόγειο → ισόγειο → όροφοι 1-N) μέσα στον DXF Viewer, με **σωστές στάθμες** ανά όροφο, και η εφαρμογή να **γνωρίζει τη δομή** του κτιρίου (πόσοι όροφοι, υπόγειο ναι/όχι, τύπος θεμελίωσης).

**Σύμπτωμα-αφορμή:** η **εδαφόπλακα** (`kind='ground'` @ FFL 0) και τα **δάπεδα** (`kind='floor'` @ FFL 0) εμφανίζονται **coplanar**. Η αιτία **ΔΕΝ** είναι bug — είναι το **κενό storey-awareness**: στο single-floor editing όλα τα δομικά πέφτουν σε **hardcoded datum 0 / ύψος 3000**, χωρίς context που να λέει «αυτό το level είναι ο όροφος Χ, με FFL/ύψος/τύπο = …». Όταν ο χρήστης βάζει εδαφόπλακα **και** δάπεδα στο **ίδιο** level, βγαίνουν συνεπίπεδα.

**Πεδίο εφαρμογής:** ελληνικές πολυκατοικίες πρώτα· μονοκατοικίες αργότερα.

---

## 2. Τι ΥΠΑΡΧΕΙ ήδη (code research §1, code = SoT, επαληθευμένο 2026-06-12)

### 2A. Floors / Buildings data model — **ΠΛΗΡΕΣ** ✅

- **`FloorDocument`** (`src/app/api/floors/floors.types.ts`):
  - `number` — signed integer (−N=υπόγειο, 0=ισόγειο, +N=όροφος)
  - `kind?: FloorKind` = `'foundation'|'basement'|'ground'|'standard'|'roof'|'mezzanine'` (`src/utils/floor-naming.ts`)
  - `elevation` — **ΜΕΤΡΑ**, FFL relative to building base (μέσω `[key:string]: unknown` + Zod)
  - `height?` — **ΜΕΤΡΑ**, floor-to-floor (default `DEFAULT_FLOOR_HEIGHT_M = 3.0`)
  - `finishThickness?` — **mm**, FFL → Top-of-Structural-Slab (default `DEFAULT_FLOOR_FINISH_THICKNESS_MM = 80`)
  - `longName?` (Ελληνικά canonical), `buildingId`, `projectId`, `companyId`
- **`Building`** (`src/types/building/contracts.ts`): `floors` (count), `baseElevation?` (μ). **ΔΕΝ** υπάρχει `hasBasement` flag → συνάγεται (`floor.number<0` ή `kind==='basement'`).
- **Firestore:** `COLLECTIONS.FLOORS='floors'` (flat, filter `buildingId`)· `COLLECTIONS.BUILDINGS='buildings'`.
- **UI:** καρτέλα «Όροφοι» = `FloorsTabContent.tsx` (Number | Name | Elevation | Height) + `FloorInlineCreateForm.tsx`.
- **Services/Hooks:** `useFloorsByBuilding.ts` (shared ref-counted subscription, SSoT)· `floor.factory.ts`· `floor-mutation-gateway.ts`· `floor-height-cascade.service.ts`· `useFloorsTabState.ts`.

### 2B. DXF Levels ↔ Floor link + Import Wizard — **ΥΠΑΡΧΕΙ** ✅

- **`Level`** (`src/subapps/dxf-viewer/systems/levels/config.ts`): `floorId?` (FK→Floor) + `buildingId?` + `sceneFileId?` + `floorplanType?`. **ΔΕΝ κρατά elevation** — μόνο `floorId`.
- **Levels system:** `useLevels.ts` (`currentLevelId`, `getLevelScene`), `LevelsSystem.tsx`, `useLevelOperations.ts`, `level-floor-resolution.ts` (`findOrCreateLevelForFloor`, ADR-420), `cross-floor-link.ts` (ADR-399).
- **Import Wizard:** `FloorplanImportWizard.tsx` (6 βήματα). Level creation στο `LevelPanel.tsx` → `findOrCreateLevelForFloor`: **1 level ανά επιλεγμένο floor**.

### 2C. Elevation flow (3D) — multi-floor **ΣΩΣΤΟ** ✅

- `bim-3d/scene/floor-stack-elevation.ts` = pure SSoT: `resolveBuildingDatumElevationM` (datum = ground floor ή lowest) + `resolveFloorDatumRelativeElevationMm` (datum-relative mm).
- `hooks/data/useFloors3DAggregator.ts` → ανά level με `floorId` βρίσκει `floor.elevation` → `floorElevationMm` → `BimSceneLayer.syncMultiFloor`. **Σωστή στοίβαξη.**

---

## 3. Τι ΛΕΙΠΕΙ — ΤΟ ΚΕΝΟ (§1C)

| Σημείο | Κατάσταση | Αρχείο |
|---|---|---|
| Multi-floor 3D «Όλοι οι όροφοι» | ✅ ΣΩΣΤΟ | `useFloors3DAggregator` |
| **Single-floor scope (ΕΝΕΡΓΟ editing)** | ❌ `floorElevationMm=0` hardcoded — αγνοεί τον πραγματικό όροφο | `bim3d-resync.ts:76` (το `activeLevelId` υπάρχει :77) |
| `nextFloorElevationMm` | ❌ ΠΟΤΕ δεν τροφοδοτείται → storey-ceiling walls/columns fallback σε `baseZ + params.height` | vertical contexts |
| `DEFAULT_COLUMN_HEIGHT_MM=3000` | ❌ hardcoded — όχι από `floor.height` | `column-types.ts:353` (consumers: `column-completion:139`, `column-from-grid:55`, `column-anchor-ghosts:102`) |
| `SLAB_KIND_DEFAULT_LEVEL_ELEVATION_MM` ceiling/roof=3000 | ❌ hardcoded | `slab-types.ts:224` (consumer `slab-completion:99`) |
| `ACTIVE_LEVEL_FLOOR_MM=0` | level-relative datum (conceptually OK) αλλά εμποδίζει storey-awareness | attach coordinators + `column-from-grid.ts` |
| `storeyId`/`offsetFromStorey`/`floorId` (στα *Params) | ❌ schema-validated αλλά μόνο από `getEntityAbsoluteElevation()` (BOQ/IFC) — ΟΧΙ live 3D | — |
| `useFloorsByBuilding` → `FloorOption` | ⚠️ χαρτογραφεί `elevation`/`kind` αλλά **ΟΧΙ** `height`/`finishThickness` | `useFloorsByBuilding.ts:75-87` |
| Basement | partial: `floor.number<0` σωστά στο `floor-stack-elevation.ts`· ground-coupling εκτός v1 | — |

**Ρίζα coplanar:** Στο single-floor editing τα entities αποθηκεύονται level-relative με datum 0 (σωστό). Λείπουν για per-storey editing: (α) **storey height** (από `floor.height`, όχι 3000), (β) **storey kind** (για gating εδαφόπλακας/θεμελίωσης), (γ) **nextFloorElevationMm** (storey ceiling), (δ) **building structure awareness**.

---

## 4. Απόφαση

**Active Storey Context SSoT** + per-storey BIM defaults + wizard all-floors + building awareness, με **πλήρη reuse** του υπάρχοντος elevation SSoT (`floor-stack-elevation.ts`, `useFloorsByBuilding`, ADR-369 z-chain). **ΜΗΝ ξαναγραφτεί elevation math.**

### 4.1 Datum του single-floor 3D — **Revit-faithful, unified SSoT** (απόφαση Giorgio 2026-06-12)

Εντολή Giorgio: «όπως η Revit, FULL ENTERPRISE + FULL SSoT». Στη Revit ο όροφος εμφανίζεται **πάντα** στο πραγματικό του υψόμετρο (true world Z) — δεν υπάρχει «single floor at 0».

**Απόφαση:** το single-floor 3D scope αντλεί `floorElevationMm` από την **ΙΔΙΑ** `floor-stack-elevation.ts` SSoT που χρησιμοποιεί το «Όλοι οι όροφοι» (μέσω του `ActiveStoreyContext`). Το hardcoded `0` στο `bim3d-resync.ts:76` γίνεται **fallback μόνο** όταν δεν υπάρχει floor-link.

- **Όφελος:** single-floor & multi-floor ενοποιούνται κάτω από **ΕΝΑ** elevation SSoT (FULL SSoT). Ο ενεργός όροφος «κάθεται» στο πραγματικό FFL (Revit-faithful).
- **Σύμβαση storage:** τα entities **ΠΑΡΑΜΕΝΟΥΝ level-relative** (αποθηκεύονται με datum 0, όπως η Revit αποθηκεύει level-relative)· **μόνο το render datum** του 3D γίνεται storey-aware. Καμία data migration.
- **Acceptance criterion Φ1:** το camera framing / zoom-to-fit του single-floor 3D ακολουθεί το νέο offset (fit-to-bounds περιλαμβάνει το `floorElevationMm`) → ο χρήστης ΔΕΝ χάνει το μοντέλο όταν αλλάζει όροφο.

### 4.2 Active Storey Context (το θεμέλιο)

NEW SSoT provider (`systems/levels/active-storey-context.ts` + hook `useActiveStoreyContext`): από `useLevels().currentLevelId` → `Level.floorId` → `useFloorsByBuilding(buildingId)` → floor doc, παράγει **ΕΝΑ** immutable context:

```ts
interface ActiveStoreyContext {
  floorId: string | null;
  storeyKind: FloorKind | null;        // foundation|basement|ground|standard|roof|mezzanine
  storeyNumber: number | null;         // signed (−=υπόγειο)
  storeyHeightMm: number;              // floor.height × 1000 (fallback DEFAULT_FLOOR_HEIGHT_M × 1000)
  finishThicknessMm: number;           // floor.finishThickness (default DEFAULT_FLOOR_FINISH_THICKNESS_MM)
  floorElevationMm: number;            // datum-relative (floor-stack-elevation SSoT) — render datum 4.1
  nextFloorElevationMm: number | null; // (nextFloor.elevation − thisFloor.elevation) × 1000 — storey ceiling
  isLowestOccupiedStorey: boolean;     // κατώτατος (ισόγειο ή υπόγειο) → επιτρέπει εδαφόπλακα/θεμελίωση
  buildingHasBasement: boolean;        // any floor.number<0 ή kind==='basement'
}
```

### 4.3 Σύμβαση constants

`DEFAULT_COLUMN_HEIGHT_MM` / `SLAB_KIND_DEFAULT_LEVEL_ELEVATION_MM` **διατηρούνται ως fallback** όταν δεν υπάρχει floor. Όταν υπάρχει `ActiveStoreyContext`, τα BIM defaults κληρονομούν από αυτό (κολώνα ύψος = `storeyHeightMm`· ceiling/roof FFL = `nextFloorElevationMm`).

### 4.4 Εδαφόπλακα vs δάπεδα (λύση coplanar)

Εδαφόπλακα (`kind='ground'`) = **κατώτατος** όροφος (ισόγειο/υπόγειο)· δάπεδα (`kind='floor'`) = **άνω** όροφοι. Με σωστό storey-per-level, ζουν σε διαφορετικά levels/`floorElevationMm` → **δεν** ξανα-πέφτουν coplanar. Τα εργαλεία εδαφόπλακας/θεμελίωσης gated σε `isLowestOccupiedStorey`.

---

## 5. Σύμβαση (cross-references)

- **ADR-369** — z-chain `Survey Point → Building.baseElevation → floor.elevation → entity.levelElevation`. Το ADR-448 **δεν** αλλάζει τη σύμβαση· προσθέτει το **storey context** ως καταναλωτή της.
- **ADR-237 / ADR-420** — Level ↔ Floor link (`Level.floorId`). Το context διαβάζει αυτόν τον σύνδεσμο.
- **ADR-399** — multi-floor 3D + floor tabs. Το single-floor datum (4.1) ευθυγραμμίζεται με το ίδιο SSoT.
- **ADR-441** — GEN-COL/GEN-SLAB «από κάναβο». Το GEN-COL static continuity (κολώνες κατώτατου ορόφου → θεμελίωση) + εδαφόπλακα gating ενσωματώνονται στο storey awareness.
- **ADR-309** — `floorplanType` ('building'/'floor'). Ο wizard all-floors (Φ3) χτίζει πάνω σε αυτό.

---

## 6. Phased Plan

### Phase 1 — Active Storey Context SSoT (ΤΟ ΘΕΜΕΛΙΟ)

1. **Extend** `FloorOption` + `mapFloorsResult` (`useFloorsByBuilding.ts`) → προσθήκη `height?`, `finishThickness?` (read-through από FLOORS doc). *(SSoT-critical — το context χρειάζεται height/finishThickness που σήμερα δεν χαρτογραφούνται.)*
2. **NEW** `systems/levels/active-storey-context.ts` (pure) + `useActiveStoreyContext` hook → παράγει `ActiveStoreyContext` (reuse `floor-stack-elevation.ts` + `useFloorsByBuilding`).
3. **Wire** `floorElevationMm` (από context) στο `bim3d-resync.ts:76` αντί hardcoded `0` (fallback `0` χωρίς floor) → απόφαση 4.1.
4. **Wire** `storeyHeightMm` / `nextFloorElevationMm` στα `WallVerticalContext` / `ColumnVerticalContext`.
5. **Acceptance:** camera framing follows (4.1). Unit tests στο pure context (datum/height/next/lowest/basement).

### Phase 2 — Per-storey BIM defaults + foundation/εδαφόπλακα gating

- BIM tool defaults κληρονομούν από `ActiveStoreyContext`: κολώνα ύψος=`storeyHeightMm`· «Οροφές/Δάπεδα από κάναβο» FFL=`nextFloorElevationMm`· εδαφόπλακα/θεμελίωση μόνο όταν `isLowestOccupiedStorey`.
- GEN-COL continuity (ADR-441, ήδη): κάτω όροφος → θεμελίωση· upper-storey κολώνες stacking.
- Constants → fallback (4.3).

### Phase 3 — Wizard «φόρτωσε ΟΛΟΥΣ τους ορόφους»

- Επέκταση `FloorplanImportWizard` / `LevelPanel.onComplete`: όταν επιλέγεται **κτίριο**, δημιουργία levels για **ΟΛΟΥΣ** τους ορόφους (`useFloorsByBuilding`), καθένα linked στο `floorId` του, σωστό order/label/elevation.
- **Toggle** «Φόρτωσε όλο το κτίριο» (default ON) vs «μόνο επιλεγμένο όροφο».

### Phase 4 — Building structure awareness + κατακόρυφη συνέχεια

- Foundation/εδαφόπλακα tools κλειδώνουν στον lowest όροφο· warning σε άνω όροφο.
- Multi-storey ανέγερση: κολώνες stacking· δάπεδα/οροφές σωστό FFL· «Όλοι οι όροφοι» = πλήρες κτίριο.
- **Cascade** (decision): αλλαγή `floor.height` → **νέα entities** παίρνουν νέο default (Φ1-2)· re-cascade σε **υπάρχοντα** DXF entities = Φ4 (reuse/extend `floor-height-cascade.service.ts`).

---

## 7. Decisions log (αποφάσεις Giorgio / Revit-grade)

- **Single-floor datum** → Real FFL via unified SSoT (4.1) — Giorgio «όπως η Revit».
- **Wizard all-floors** → toggle με default **ON** (Giorgio: «φόρτωσε όλους τους ορόφους»).
- **floor.height cascade** → νέα entities πρώτα (Φ1-2)· existing entities re-cascade = Φ4 (risk isolation).
- **Mode** → Plan Mode ανά φάση (όχι orchestrator).

---

## 8. Changelog

- **2026-06-12** — ADR δημιουργήθηκε. Phase 1 recognition complete (code = SoT, 3 αρχεία gap επαληθευμένα). Απόφαση 4.1 (Revit-faithful unified datum SSoT). Phases 1-4 planned, μη υλοποιημένες. (Opus 4.8)
- **2026-06-13** — **Phase 1 Slice 1b DONE** (storey-ceiling render height, uncommitted). **Απόφαση Giorgio = «πλήρες Revit»**: ένας flat `topBinding='storey-ceiling'` τοίχος/κολώνα (το default) πλέον **ακολουθεί δυναμικά** το πραγματικό storey ceiling στο render (Revit «Top: Up to Level»), αντί baked `params.height`. **Code finding (code=SoT):** το flat 3D height ήταν `wall.params.height` (`BimToThreeConverter:350`/`bim-three-structural-converters:71`), όχι render-time ceiling — γι' αυτό το «στενό» 1b είχε μηδέν ορατό αποτέλεσμα. Λύση: `nominalHeightMm = resolveWall/ColumnNominalTopZmm − resolve…BaseZmm` (SSoT resolvers, ΗΔΗ υπάρχουν) υπολογίζεται στο `bim-scene-attach-syncs` (όπου ζει το ctx) και περνά override στους converters (`renderWall`/`flatColumn` shallow-clone height). **Safe by construction:** χωρίς storey context `nominalTop−base ≡ params.height` (μηδέν regression)· degenerate params → `Number.isFinite` guard → undefined → legacy fallback. Threading `nextFloorElevationMm`: `SyncContext`+`FloorStackEntry`+`BimSceneLayer.sync/buildContext/syncMultiFloor`+`scene-manager-actions`+`ThreeJsSceneManager.syncBimEntities`+`bim3d-resync` (single από store)+`useFloors3DAggregator` (multi, reuse `buildActiveStoreyContext`). 10 jest (`storey-ceiling-render-height`) + 3 fixed (`BimSceneLayer-multifloor` 9ο arg) + 87 regression PASS + IDE clean. Shared tree: ο ADR-449 agent πρόσθεσε `walls` param στο `columnToMesh` δίπλα (συνυπάρχουν). 🔴 browser-verify (floor.height ≠ 3000 → τοίχοι/κολώνες φτάνουν στο πραγματικό ταβάνι· current data 3000=3000 → αμετάβλητο) + commit. (Opus 4.8)
- **2026-06-13** — **Phase 1 Slice 1a DONE** (datum SSoT, uncommitted). NEW `systems/levels/active-storey-context.ts` (pure `buildActiveStoreyContext` + `ActiveStoreyContext` + `DEFAULT_STOREY_HEIGHT_MM`, reuse `floor-stack-elevation.ts` — μηδέν νέα elevation math), `active-storey-store.ts` (dedicated Zustand SSoT, 1 writer/N readers), `useActiveStoreySync.ts` (sole writer hook + `useActiveStoreyContext` reader). MOD `useFloorsByBuilding.ts` (`FloorOption`+`mapFloorsResult`: +`height`/+`finishThickness`), `useLevelId3DSync.ts` (mount sync hook — non-cardinal, μηδέν ADR-040 burden), `bim3d-resync.ts:76` (single-floor render datum `0` → `useActiveStoreyStore.getState().context?.floorElevationMm ?? 0`). 15/15 jest (`active-storey-context.test.ts`) + μηδέν IDE diagnostics στα 6 touched files. Camera framing αμετάβλητο (live `setFromObject` bounds ακολουθούν). 🔴 browser-verify + commit. DEFER Slice 1b (storey-ceiling `nextFloorElevationMm` → `SyncContext`/vertical contexts) + Φ2-4. (Opus 4.8)
