# ADR-448 — Storey-Aware DXF Viewer (όροφοι → BIM elevations, υπόγειο, θεμελίωση, multi-storey ανέγερση)

- **Status**: 🟢 Phases 1-4 υλοποιημένες (2026-06-13)· **Phase 4b follow-up — frame cascade** (η Φ4 ήταν slab-only/μερική: δοκάρια + attached κολώνες/τοίχοι ΔΕΝ τεντώνονταν· code = SoT διόρθωση) (2026-06-13, uncommitted· 🔴 browser-verify + commit εκκρεμούν). Vertical-continuity validation → DEFER νέο ADR.
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

### Phase 2 — Per-storey BIM defaults + foundation/εδαφόπλακα gating ✅ DONE (2026-06-13, uncommitted)

- BIM tool defaults κληρονομούν από `ActiveStoreyContext`: τοίχος/κολώνα ύψος=`storeyHeightMm`· «Οροφές/Δάπεδα» (ceiling/roof slab) FFL=**floor-relative storey height** (`nextFloorElevationMm − floorElevationMm`)· εδαφόπλακα/θεμελίωση soft warning όταν `!isLowestOccupiedStorey`.
- **SSoT module** `systems/levels/storey-creation-defaults.ts`: `readActiveStoreyContext()` (non-React `getState()`, mirror `bim3d-resync`) + `resolveStoreyHeightMm` + `resolveStoreyCeilingElevationMm` + `shouldWarnFoundationOnStorey`. Pattern: `override ?? storey?.X ?? legacy`. Store `context=null` → legacy αμετάβλητο (μηδέν regression).
- 5 seams: `wall-completion` / `column-completion` / `column-anchor-ghosts` (ghost=commit) / `column-from-grid` (GEN-COL `withFoundationBase` — storey height μόνο στο `baseHeight`, `baseOffset+baseDrop` continuity ανέπαφο) / `slab-completion` (ceiling/roof μόνο).
- Foundation gating: `EventBus 'bim:foundation-on-upper-storey'` → `useFoundationTool.activate()` (warn 1×/activation) + ground-slab batch → toast warning (soft, Revit-style· δεν μπλοκάρει).
- GEN-COL continuity (ADR-441, ήδη): κάτω όροφος → θεμελίωση· upper-storey κολώνες stacking.
- Constants → fallback (4.3).

### Phase 3 — Wizard «φόρτωσε ΟΛΟΥΣ τους ορόφους» ✅ DONE (2026-06-13, uncommitted)

- **NEW** `systems/levels/ensure-levels-for-building.ts` (pure): `ensureLevelsForBuilding(resolver, floors, buildingId)` = **loop πάνω από το per-floor SSoT** `findOrCreateLevelForFloor` (ΔΕΝ το ξαναγράφει). Sort basement → roof (`floor.number`), σειριακό `await` (ντετερμινιστική σειρά / μηδέν level-store race), idempotent (όροφος με υπάρχον Level → reuse).
- **Wizard** (`FloorplanImportWizard.tsx`): `loadAllFloors` state (**default ON**) + checkbox στο building step (semantic `<label>` + `Checkbox`)· flag στο `WizardCompleteMeta` + `handleUploadComplete` (και τα 2 paths). i18n `floorplanImport.allFloors.{label,hint}` (el/en `files-media`).
- **LevelPanel.onComplete** (`ui/components/LevelPanel.tsx`): ο selected-floor `findOrCreateLevelForFloor` + `setCurrentLevel` **αμετάβλητα** (no race)· αν `meta.loadAllFloors && buildingId` → `setAllFloorsBuildingId` → reactive effect (`useFloorsByBuilding` shared subscription + `runningRef` re-entry guard) τρέχει `ensureLevelsForBuilding` στο background (idempotent: ο επιλεγμένος όροφος ήδη linked → skip).
- **Order/elevation finding (code = SoT):** το `addLevel` δίνει `order: levels.length` (creation-order)· η storey σειρά οδηγείται από το **linked `floor.elevation`** (ADR-399), όχι από το `level.order` → ο loop χρειάζεται μόνο create + link ανά `floorId` (reuse `floor-stack-elevation`, μηδέν νέα elevation math).
- 5 jest (`ensure-levels-for-building.test.ts`: per-floor count / basement→roof order / idempotent re-import / pre-existing reuse / floor-less skip) + IDE diagnostics clean σε όλα τα touched.

### Phase 4 — Existing-entity height cascade (slab re-stretch) ✅ DONE (2026-06-13, uncommitted)

**Code = SoT reconciliation.** Από τα 3 αρχικά bullets, τα 2 **ήδη υπήρχαν** στον κώδικα:

| Αρχικό bullet | Κατάσταση (code = SoT) |
|---|---|
| Foundation/εδαφόπλακα lowest-storey gating + warning | ✅ **DONE στη Φ2** — `shouldWarnFoundationOnStorey` + EventBus `bim:foundation-on-upper-storey` + toast. |
| `floor.height` αλλαγή → re-cascade σε **υπάρχοντες** τοίχους/κολώνες | ✅ **Προϋπήρχε** (ADR-369 §9 Q5) — `floor-height-cascade.service.ts` `cascadeFloorHeightToEntities`, wired στο `floors.handlers.ts` PUT (trigger όταν αλλάζει `updates.height`). |
| Multi-storey stacking / σωστό FFL / «όλοι οι όροφοι» | ✅ **Καλύφθηκε** από Φ1 (storey-ceiling render) + Φ3 (all-floors levels). |

**Πραγματικό κενό (το Φ4 deliverable):** ο cascade κάλυπτε walls + columns αλλά **ΟΧΙ slabs** → υπάρχοντα ceiling/roof slabs έμεναν στο παλιό `levelElevation`, ενώ τα νέα (Φ2) έπαιρναν το νέο storey height = **inconsistency**.

**Λύση — slab cascade (SSoT extension, ΟΧΙ rewrite):** ο `floor-height-cascade.service.ts` έγινε **data-driven `CASCADE_TARGETS` registry** (Boy-Scout: walls/columns/slabs = 1 entry έκαστο, μηδέν duplicate per-collection loop). Όταν αλλάζει `floor.height`:
- walls/columns (`topBinding='storey-ceiling'`) → `params.height` (αμετάβλητη λογική + κοινό `STRETCH_TARGET` spec).
- **NEW** ceiling/roof slabs (`params.kind==='ceiling'||'roof'`) → `params.levelElevation = floor.height*1000`. floor/ground/foundation slabs → skip.
- **Idempotent no-op skip** (`oldValue===newValue` → ούτε batch write ούτε audit· νέο, βελτιώνει και walls/columns). EntityAudit ανά entity (`entityType:'slab'` ήδη valid). `CascadeResult` +`slabsUpdated`.

**Live-viewer reactivity (verify-only):** για τον ενεργό όροφο το storey-ceiling **render** (Φ1b) ακολουθεί ήδη δυναμικά το ταβάνι από το `ActiveStoreyContext`· ο cascade αφορά την **persisted αλήθεια** για μη-ενεργές όψεις + BOQ (Firestore subscription των BIM persistence hooks ανανεώνει — δεν χτίστηκε νέα μηχανή).

**Vertical-continuity validation** (λείπει ενδιάμεσος όροφος / κολώνα δεν στοιχίζεται με κάτω) → **DEFER ξεχωριστό ADR** (risk isolation· είναι validation/warnings, όχι cascade).

### Phase 4b — Frame cascade (δοκάρια + attached κολώνες/τοίχοι) ✅ DONE (2026-06-13, uncommitted)

**Code = SoT.** Η Φ4 (slab-only) έκλεισε **πρόωρα**: ο Giorgio είδε στο 3D ότι, σε αλλαγή ύψους ορόφου, οι slabs ανέβαιναν (DB 3000→3500) αλλά **δοκάρια + κολώνες + τοίχοι έμεναν στα 3000**. Διάγνωση (code + live):

1. **Δοκάρια** ορίζουν την οροφή μέσω `params.topElevation` (`beam-types.ts:122`) και **δεν ήταν στο `CASCADE_TARGETS`** → stale.
2. Στη δόμηση «από κάναβο» (ADR-441/401) κολώνες & τοίχοι γίνονται `topBinding:'attached'` (attach σε beam/slab)· ο gate `topBinding==='storey-ceiling'` τους **παρέκαμπτε** → `params.height` παγωμένο.
3. Render attach = **lower-envelope** (`column-vertical-profile.ts` `resolveColumnTopProfile` = `min(nominal, host_underside)`)· κλιπάρει μόνο προς τα κάτω → δεν επεκτείνεται προς υψωμένο host.

**Λύση — ABSOLUTE/self-healing extension του ΙΔΙΟΥ registry** (ΟΧΙ rewrite, Boy-Scout SSoT):
- **NEW beam target** (`FLOORPLAN_BEAMS`): `params.topElevation = floor.height*1000 + offsetFromStorey`. Sloped beam (`topElevationEnd?`, ADR-401): 2ο field update που **διατηρεί το span της κλίσης** (`newTop + (oldEnd−oldStart)`), μέσω νέου optional `CascadeTarget.extraUpdates?` hook. `zOffset` ανέπαφο (render-time, ADR-369 §854).
- **Διεύρυνση gate** `STRETCH_TARGET.shouldCascade` → `{storey-ceiling, attached}` (skip `absolute`/`unconnected`/undefined — user-pinned). Η υπάρχουσα formula `mm + topOffset − baseOffset` δίνει σωστό nominal· μετά το beam/slab cascade το host face ανεβαίνει, οπότε το lower-envelope του render δίνει σωστή υψωμένη κορυφή.
- `CascadeResult` +`beamsUpdated`. Idempotent no-op skip ισχύει (absolute formula → ίδιο height = no write).

**Render αμετάβλητο** (column/wall-top-profile): η lower-envelope είναι σωστή· απλώς τροφοδοτείται με υψωμένο nominal + host. EntityAudit `entityType:'beam'` ήδη valid.

---

## 7. Decisions log (αποφάσεις Giorgio / Revit-grade)

- **Single-floor datum** → Real FFL via unified SSoT (4.1) — Giorgio «όπως η Revit».
- **Ceiling/roof slab FFL (Phase 2)** → **floor-relative storey height** (`nextFloorElevationMm − floorElevationMm`), ΟΧΙ raw datum-relative `nextFloorElevationMm`. Λόγος: τα entities στο single-floor scope δημιουργούνται level-relative με FFL=0 (`column-from-grid ACTIVE_LEVEL_FLOOR_MM=0`)· το slab `levelElevation` = «top face = FFL» με ceiling default 3000 = «storey 3.00m» (`slab-types.ts:221`) → είναι floor-relative. Raw datum τιμή θα έσπαζε σε άνω ορόφους (όροφος @7000 → οροφή @10500 αντί 3500).
- **Wizard all-floors** → toggle με default **ON** (Giorgio: «φόρτωσε όλους τους ορόφους»).
- **floor.height cascade** → νέα entities πρώτα (Φ1-2)· existing entities re-cascade = Φ4 (risk isolation). **Φ4 cascade value = `floor.height*1000` απευθείας** (= ο ορισμός storey height που άλλαξε ο χρήστης = floor-relative ceiling FFL στο single-floor scope) → ντετερμινιστικό, μηδέν extra floor-stack read server-side.
- **Mode** → Plan Mode ανά φάση (όχι orchestrator).

---

## 8. Changelog

- **2026-06-13** — **Phase 4b DONE — frame cascade** (η Φ4 ήταν slab-only/μερική· uncommitted). **Code = SoT:** ο Giorgio είδε στο 3D ότι σε αλλαγή ύψους ορόφου οι slabs ανέβαιναν αλλά **δοκάρια + attached κολώνες/τοίχοι έμεναν στα 3000**. Διάγνωση: (1) beams ορίζουν την οροφή μέσω `params.topElevation` αλλά δεν ήταν στο `CASCADE_TARGETS`· (2) στη δόμηση «από κάναβο» κολώνες/τοίχοι γίνονται `topBinding:'attached'` → ο gate `storey-ceiling`-only τους παρέκαμπτε· (3) render attach = lower-envelope (κλιπάρει μόνο κάτω). **MOD** `src/app/api/floors/floor-height-cascade.service.ts` (extend ΥΠΑΡΧΟΝ registry, Boy-Scout SSoT — μηδέν duplicate loop): NEW beam target (`FLOORPLAN_BEAMS` → `params.topElevation = floor.height*1000 + offsetFromStorey`· sloped beam `topElevationEnd?` preserve-span μέσω νέου optional `CascadeTarget.extraUpdates?` hook· `zOffset` ανέπαφο)· διεύρυνση `STRETCH_TARGET.shouldCascade` → `{storey-ceiling, attached}` (skip absolute/unconnected/undefined)· `CascadeResult` +`beamsUpdated`· `CascadeParams` +`topElevation`/`topElevationEnd`/`offsetFromStorey`. Render (column/wall-top-profile) αμετάβλητο — lower-envelope σωστή, τροφοδοτείται με υψωμένο nominal+host. **MOD** `__tests__/floor-height-cascade.service.test.ts` (+Phase 4b: beam flat/offset/sloped preserve-κλίση· attached column/wall height cascade· skip absolute/unconnected· idempotent· `beamsUpdated`+audit `entityType:'beam'`). EntityAudit `entityType:'beam'` ήδη valid (μηδέν CHECK 3.17 baseline). **Absolute/self-healing** (όχι delta) → διορθώνει και stale state (live beams @3000 ενώ floor=3.5). 🔴 browser-verify (άλλαξε ύψος ορόφου → ΟΛΟ το πλαίσιο τεντώνεται) + commit (shared tree· git add ΜΟΝΟ δικά μου hunks). (Opus 4.8)
- **2026-06-13** — **Phase 4 DONE → ADR-448 CLOSED** (existing-entity slab cascade, uncommitted). **Code = SoT reconciliation:** από τα 3 αρχικά §6 bullets, 2 προϋπήρχαν (foundation gating=Φ2· wall/column cascade=ADR-369 §9 Q5)· το πραγματικό κενό = ο `floor-height-cascade.service.ts` κάλυπτε walls+columns αλλά ΟΧΙ slabs → υπάρχοντα ceiling/roof slabs έμεναν στο παλιό `levelElevation`. **MOD** `src/app/api/floors/floor-height-cascade.service.ts`: data-driven `CASCADE_TARGETS` registry (Boy-Scout SSoT — walls/columns μοιράζονται `STRETCH_TARGET` spec, slab = 1 entry· μηδέν duplicate loop). NEW slab target → ceiling/roof (`params.kind`) `params.levelElevation = floor.height*1000`· floor/ground/foundation skip· **idempotent no-op skip** (`oldValue===newValue` → ούτε write ούτε audit, βελτιώνει και walls/columns)· EntityAudit `entityType:'slab'` (ήδη valid στο `AuditEntityType`)· `CascadeResult` +`slabsUpdated`. Handler αμετάβλητος (αγνοεί το result). **NEW** `__tests__/floor-height-cascade.service.test.ts` (6 tests: slab ceiling/roof cascade· skip floor/ground/foundation· idempotent no-op· slab audit `entityType:'slab'`· wall/column+offset regression· no-match no-op). 6/6 jest + IDE diagnostics clean (2 αρχεία). **Απόφαση (Revit-grade):** cascade value=`floor.height*1000` απευθείας (ντετερμινιστικό· μηδέν floor-stack read). Vertical-continuity validation → DEFER νέο ADR. 🔴 browser-verify (άλλαξε ύψος ορόφου με ceiling slab → οροφή ξανα-τεντώνεται μαζί με τοίχους/κολώνες) + commit (shared tree· git add ΜΟΝΟ δικά μου hunks). (Opus 4.8)
- **2026-06-13** — **Phase 3 DONE** (wizard «φόρτωσε ΟΛΟΥΣ τους ορόφους», uncommitted). **NEW** `systems/levels/ensure-levels-for-building.ts` (pure `ensureLevelsForBuilding` = loop reuse `findOrCreateLevelForFloor`· sort basement→roof· σειριακό await· idempotent) + `__tests__/ensure-levels-for-building.test.ts` (5 tests). **MOD** `features/floorplan-import/FloorplanImportWizard.tsx` (`loadAllFloors` state default ON + checkbox building step + `WizardCompleteMeta.loadAllFloors` + handleUploadComplete 2 paths)· `ui/components/LevelPanel.tsx` (reactive backfill: `useFloorsByBuilding(allFloorsBuildingId)` + `runningRef`-guarded effect → `ensureLevelsForBuilding`· onComplete sets building id πίσω από `meta.loadAllFloors`· selected-floor + `setCurrentLevel` αμετάβλητα → no race)· i18n `floorplanImport.allFloors.{label,hint}` (el/en `files-media`). **Code finding (code = SoT):** `addLevel order=levels.length` (creation-order)· storey σειρά οδηγείται από linked `floor.elevation` (ADR-399) → ο loop χρειάζεται μόνο create+link ανά `floorId`. 5 jest + IDE diagnostics clean σε όλα τα touched. 🔴 browser-verify (κτίριο με ≥2 ορόφους + toggle ON → Levels για ΟΛΟΥΣ, σωστό label/σειρά, idempotent στο re-import) + commit (shared tree· git add ΜΟΝΟ δικά μου hunks). DEFER Φ4 existing-entity cascade. (Opus 4.8)
- **2026-06-13** — **Phase 2 DONE** (per-storey creation defaults + foundation gating, uncommitted). **NEW** `systems/levels/storey-creation-defaults.ts` (SSoT resolvers: `readActiveStoreyContext` non-React `getState()` mirror `bim3d-resync`· `resolveStoreyHeightMm`· `resolveStoreyCeilingElevationMm` floor-relative· `shouldWarnFoundationOnStorey`) + `__tests__/storey-creation-defaults.test.ts`. **MOD seams** (pattern `override ?? storey ?? legacy`): `wall-completion.ts` (height=storeyHeightMm)· `column-completion.ts` (height)· `column-anchor-ghosts.ts` (ghost height = commit)· `column-from-grid.ts` `withFoundationBase` (storey height στο `baseHeight`· **GEN-COL `baseOffset`+`baseDrop` continuity ανέπαφο** — ADR-441)· `slab-completion.ts` (ceiling/roof → **floor-relative** ceiling FFL `nextFloorElevationMm−floorElevationMm`· floor/ground/foundation αμετάβλητα). **Foundation gating** (soft, Revit-style — δεν μπλοκάρει): NEW EventBus `'bim:foundation-on-upper-storey'` (`drawing-event-map-bim.ts`)· emit από `useFoundationTool.activate()` (1×/activation) + ground-slab batch· toast warning (`useDxfViewerNotifications.ts` + i18n key `storeyGating.foundationUpperStorey` el/en). **Safe by construction:** store `context=null` → `storey?.X===undefined` → legacy constant (μηδέν regression· υπάρχοντα suites αμετάβλητα). Code finding (code=SoT): seams b/d δίνουν grid/ghost «δωρεάν» (column-from-grid→buildDefaultColumnParams)· `column-anchor-ghosts` έχει ΔΙΚΟ `buildGhostParams` → ρητό seam για ghost==final. 🔴 browser-verify (floor.height≠3000 → νέος τοίχος/κολώνα γεννιέται στο storey height + render 1b) + commit (shared tree· git add ΜΟΝΟ δικά μου). DEFER Φ3 wizard + Φ4 existing-entity cascade. (Opus 4.8)
- **2026-06-12** — ADR δημιουργήθηκε. Phase 1 recognition complete (code = SoT, 3 αρχεία gap επαληθευμένα). Απόφαση 4.1 (Revit-faithful unified datum SSoT). Phases 1-4 planned, μη υλοποιημένες. (Opus 4.8)
- **2026-06-13** — **Phase 1 Slice 1b DONE** (storey-ceiling render height, uncommitted). **Απόφαση Giorgio = «πλήρες Revit»**: ένας flat `topBinding='storey-ceiling'` τοίχος/κολώνα (το default) πλέον **ακολουθεί δυναμικά** το πραγματικό storey ceiling στο render (Revit «Top: Up to Level»), αντί baked `params.height`. **Code finding (code=SoT):** το flat 3D height ήταν `wall.params.height` (`BimToThreeConverter:350`/`bim-three-structural-converters:71`), όχι render-time ceiling — γι' αυτό το «στενό» 1b είχε μηδέν ορατό αποτέλεσμα. Λύση: `nominalHeightMm = resolveWall/ColumnNominalTopZmm − resolve…BaseZmm` (SSoT resolvers, ΗΔΗ υπάρχουν) υπολογίζεται στο `bim-scene-attach-syncs` (όπου ζει το ctx) και περνά override στους converters (`renderWall`/`flatColumn` shallow-clone height). **Safe by construction:** χωρίς storey context `nominalTop−base ≡ params.height` (μηδέν regression)· degenerate params → `Number.isFinite` guard → undefined → legacy fallback. Threading `nextFloorElevationMm`: `SyncContext`+`FloorStackEntry`+`BimSceneLayer.sync/buildContext/syncMultiFloor`+`scene-manager-actions`+`ThreeJsSceneManager.syncBimEntities`+`bim3d-resync` (single από store)+`useFloors3DAggregator` (multi, reuse `buildActiveStoreyContext`). 10 jest (`storey-ceiling-render-height`) + 3 fixed (`BimSceneLayer-multifloor` 9ο arg) + 87 regression PASS + IDE clean. Shared tree: ο ADR-449 agent πρόσθεσε `walls` param στο `columnToMesh` δίπλα (συνυπάρχουν). 🔴 browser-verify (floor.height ≠ 3000 → τοίχοι/κολώνες φτάνουν στο πραγματικό ταβάνι· current data 3000=3000 → αμετάβλητο) + commit. (Opus 4.8)
- **2026-06-13** — **Phase 1 Slice 1a DONE** (datum SSoT, uncommitted). NEW `systems/levels/active-storey-context.ts` (pure `buildActiveStoreyContext` + `ActiveStoreyContext` + `DEFAULT_STOREY_HEIGHT_MM`, reuse `floor-stack-elevation.ts` — μηδέν νέα elevation math), `active-storey-store.ts` (dedicated Zustand SSoT, 1 writer/N readers), `useActiveStoreySync.ts` (sole writer hook + `useActiveStoreyContext` reader). MOD `useFloorsByBuilding.ts` (`FloorOption`+`mapFloorsResult`: +`height`/+`finishThickness`), `useLevelId3DSync.ts` (mount sync hook — non-cardinal, μηδέν ADR-040 burden), `bim3d-resync.ts:76` (single-floor render datum `0` → `useActiveStoreyStore.getState().context?.floorElevationMm ?? 0`). 15/15 jest (`active-storey-context.test.ts`) + μηδέν IDE diagnostics στα 6 touched files. Camera framing αμετάβλητο (live `setFromObject` bounds ακολουθούν). 🔴 browser-verify + commit. DEFER Slice 1b (storey-ceiling `nextFloorElevationMm` → `SyncContext`/vertical contexts) + Φ2-4. (Opus 4.8)
