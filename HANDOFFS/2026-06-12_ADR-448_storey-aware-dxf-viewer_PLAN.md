# HANDOFF — ADR-448: Storey-Aware DXF Viewer (όροφοι → BIM elevations, υπόγειο, θεμελίωση, multi-storey ανέγερση)

**Date:** 2026-06-12 · **Branch:** main · **Μοντέλο: Opus** · **Shared working tree** (ΑΛΛΟΣ agent δουλεύει ταυτόχρονα — ειδικά **icon-agent** σε `ui/ribbon/data/*.ts`· **git add ΜΟΝΟ δικά σου hunks, ΠΟΤΕ `git add -A`**).

> 🎯 **ΕΝΤΟΛΗ GIORGIO (διαρκής):** «όπως οι μεγάλοι, όπως η Revit. FULL ENTERPRISE + FULL SSoT.» Απάντα **ΕΛΛΗΝΙΚΑ**.
> ⚠️ **COMMIT/PUSH τα κάνει ΜΟΝΟ ο Giorgio — ΠΟΤΕ ο agent** (CLAUDE.md N.(-1)). Ο agent ετοιμάζει & σταματά.
> ⚠️ **ΚΑΝΟΝΕΣ:** N.8 (5+ files/2+ domains → orchestrator-scale, ΡΩΤΑ mode ΠΡΩΤΑ). N.14 (δήλωσε μοντέλο). N.17 (ΕΝΑ tsc τη φορά — έλεγξε process· **ή χρησιμοποίησε IDE `mcp__ide__getDiagnostics`** που ΔΕΝ spawn-άρει tsc, αν τρέχει άλλος agent tsc). function ≤40γρ, file ≤500γρ, no `any`, i18n ICU single-brace `{var}`. N.0.1 ADR-driven (Phase 1 recognition — **code=SoT**).

---

## 0. ΣΤΟΧΟΣ

Η σελίδα **DXF Viewer** να γίνει **storey-aware**: να αντλεί τα δεδομένα ορόφων (υψόμετρα/ύψη/τύπο/υπόγειο) από την **καρτέλα «Όροφοι»** του κτιρίου, ώστε ο μηχανικός να **κτίζει ολόκληρο το κτίριο** (θεμελίωση → υπόγειο → ισόγειο → όροφοι 1-8) με σωστές στάθμες, και η εφαρμογή να **γνωρίζει τη δομή** (πόσοι όροφοι, υπόγειο ναι/όχι, τύπος θεμελίωσης).

**Πεδίο εφαρμογής (Giorgio):** ελληνικές **οικοδομές** (πολυκατοικίες) πρώτα· μονοκατοικίες αργότερα. Σήμερα μόνο **διώροφη μεζονέτα** (1ος+2ος) είναι καταχωρημένη.

**Το σύμπτωμα που ξεκίνησε τη συζήτηση:** η **εδαφόπλακα** (`kind='ground'`@FFL 0) και τα **δάπεδα** (`kind='floor'`@FFL 0) εμφανίζονται **coplanar**. Αιτία = **ΟΧΙ bug**, αλλά το ΚΕΝΟ: στο single-floor editing όλα πέφτουν σε hardcoded datum 0 — δεν υπάρχει **storey context** που να λέει «αυτό το level είναι ο όροφος Χ, FFL/ύψος/τύπος = …».

---

## 1. RESEARCH FINDINGS (code = SoT, 2026-06-12, 3 parallel agents)

### 1A. Floors / Buildings data model — **ΥΠΑΡΧΕΙ ΠΛΗΡΕΣ** ✅

- **`FloorDocument`** (`src/app/api/floors/floors.types.ts`):
  - `number` — **signed integer** (−N=υπόγειο, 0=ισόγειο, +N=όροφος)
  - `kind?: FloorKind` = `'foundation'|'basement'|'ground'|'standard'|'roof'|'mezzanine'` (`src/utils/floor-naming.ts`)
  - `elevation` — **ΜΕΤΡΑ**, FFL relative to building base point (αποθηκεύεται μέσω `[key:string]: unknown` index signature + Zod schemas· UI auto-suggest = γείτονας.elevation + γείτονας.height × Δnumber)
  - `height?: number|null` — **ΜΕΤΡΑ**, floor-to-floor (default 3.0)
  - `finishThickness?: number` — **mm**, FFL → Top-of-Structural-Slab (default 80mm = 20 μάρμαρο + 60 screed)
  - `longName?` (Ελληνικά: «Ισόγειο»/«1ος Όροφος»/«Υπόγειο»), `buildingId`, `projectId`, `companyId`
- **`Building`** (`src/types/building/contracts.ts`): `floors` (count integer, ΟΧΙ array), `baseElevation?` (μ, relative to project base), `baseElevationReference`, `siteOrigin`, `climateZone`. **ΔΕΝ** υπάρχει `hasBasement` flag → συνάγεται (`floor.number<0` ή `kind==='basement'`).
- **Firestore:** `COLLECTIONS.FLOORS = 'floors'` (top-level flat, filter `buildingId`)· `COLLECTIONS.BUILDINGS = 'buildings'` (`src/config/firestore-collections.ts`). `FLOOR_SCOPED_BIM_COLLECTIONS` = 26 BIM collections με `floorId` FK.
- **UI:** Σελίδα Κτίρια → `src/components/building-management/tabs/FloorsTabContent.tsx` (tab «Όροφοι», στήλες **Number | Name | Elevation | Height**) + `FloorInlineCreateForm.tsx`.
- **Services/Hooks:** `useFloorsByBuilding.ts` (real-time subscription, ref-counted)· `floor.factory.ts` (ADR-369: kind/longName/finishThickness)· `floor-mutation-gateway.ts` (create/update/delete policy)· `floor-height-cascade.service.ts` (height change → cascade τοίχους/κολώνες)· `useFloorsTabState.ts` (CRUD + `floorGaps` detection).
- **ADR-369 4-tier z-chain:** `Survey Point → Building.baseElevation → floor.elevation → entity.levelElevation`.

### 1B. DXF Levels + Import Wizard — **link ΥΠΑΡΧΕΙ** ✅

- **`Level`** (`src/subapps/dxf-viewer/systems/levels/config.ts`): `floorId?` (FK→Floor, ADR-237) + `buildingId?` + `sceneFileId?` + `floorplanType?` + `entityLabel?`. **ΔΕΝ κρατά elevation** — μόνο `floorId`.
- **Levels system:** `systems/levels/useLevels.ts`, `LevelsSystem.tsx`, `hooks/useLevelOperations.ts`, `useLevelsFirestoreSync.ts`, `level-floor-resolution.ts` (`findOrCreateLevelForFloor`, ADR-420), `cross-floor-link.ts` (ADR-399 isolation guard).
- **Import Wizard:** `src/features/floorplan-import/FloorplanImportWizard.tsx` (**6 βήματα**: company→project→building→floor→unit/multi-level→upload). State: `hooks/useFloorplanImportState.ts`. Level creation στο `src/subapps/dxf-viewer/ui/components/LevelPanel.tsx` (~γρ.437) → `findOrCreateLevelForFloor`: **1 level ανά επιλεγμένο floor** (γι' αυτό η μεζονέτα 1ος+2ος → 2 levels).
- **Elevation resolution (3D):** `bim-3d/scene/floor-stack-elevation.ts` (`resolveBuildingDatumElevationM`, `resolveFloorDatumRelativeElevationMm`)· aggregator `hooks/data/useFloors3DAggregator.ts` → ανά level με `floorId` βρίσκει `floor.elevation` → `floorElevationMm` → `BimSceneLayer.syncMultiFloor`.

### 1C. Elevation flow + **ΤΟ ΚΕΝΟ** ⚠️

| | Κατάσταση |
|---|---|
| **Multi-floor 3D «Όλοι οι όροφοι»** | ✅ **ΣΩΣΤΟ** — `useFloors3DAggregator` → `floor.elevation` → `floorElevationMm` → converters |
| **Single-floor scope (ΕΝΕΡΓΟ editing)** | ❌ `floorElevationMm = 0` **hardcoded** (`bim-3d/scene/bim3d-resync.ts:76`) — αγνοεί τον πραγματικό όροφο |
| `nextFloorElevationMm` | ❌ **ΠΟΤΕ** δεν τροφοδοτείται από production → storey-ceiling walls/columns πέφτουν σε fallback `baseZ + params.height` |
| `DEFAULT_COLUMN_HEIGHT_MM = 3000` | ❌ hardcoded (`bim/types/column-types.ts:353`) — όχι από `floor.height` |
| `SLAB_KIND_DEFAULT_LEVEL_ELEVATION_MM` ceiling/roof = 3000 | ❌ hardcoded (`bim/types/slab-types.ts`) |
| `ACTIVE_LEVEL_FLOOR_MM = 0` | attach coordinators (`wall/column-structural-attach-coordinator.ts`) + `column-from-grid.ts` — level-relative datum, conceptually OK αλλά εμποδίζει storey-awareness |
| `storeyId`/`offsetFromStorey`/`floorId` (στα *Params) | ❌ schema-validated αλλά χρησιμοποιούνται ΜΟΝΟ από `getEntityAbsoluteElevation()` (BOQ/IFC) — **ΟΧΙ** από live 3D render |
| Basement | partial: `floor.number<0` σωστά υπολογίζεται στο `floor-stack-elevation.ts`· «ground walls/υπόγειο edge» ρητά εκτός v1 (`thermal/heat-load/ground-coupling.ts`) |

**Ρίζα του coplanar:** Στο single-floor editing **τα entities αποθηκεύονται level-relative με datum 0** (σωστό — το 3D τα offset-άρει με `floorElevationMm`). Αυτό που **λείπει** για per-storey editing: (α) **storey height** (από `floor.height`, όχι 3000), (β) **storey kind** (ισόγειο/υπόγειο/όροφος — για να ξέρει αν επιτρέπεται εδαφόπλακα/θεμελίωση), (γ) **nextFloorElevationMm** (storey ceiling), (δ) **building structure** (πόσοι όροφοι, υπόγειο). Η εδαφόπλακα ανήκει στον **κατώτατο** όροφο (ισόγειο/υπόγειο)· τα δάπεδα στους **άνω**· επειδή ο Giorgio τα έβαλε στο **ίδιο level**, βγήκαν coplanar.

---

## 2. PHASED PLAN (Revit-grade, FULL SSoT)

### Phase 1 — **Active Storey Context SSoT** (ΤΟ ΘΕΜΕΛΙΟ)

**NEW SSoT provider** (π.χ. `systems/levels/active-storey-context.ts` + hook `useActiveStoreyContext`): από το `useLevels().currentLevelId` → `Level.floorId` → `useFloorsByBuilding(buildingId)` → floor doc, παράγει **ΕΝΑ** immutable context:
```ts
interface ActiveStoreyContext {
  floorId: string | null;
  storeyKind: FloorKind | null;        // foundation|basement|ground|standard|roof|mezzanine
  storeyNumber: number | null;          // signed (−=υπόγειο)
  storeyHeightMm: number;               // floor.height × 1000 (fallback DEFAULT_STOREY_HEIGHT_MM)
  finishThicknessMm: number;            // floor.finishThickness (default 80)
  nextFloorElevationMm: number | null;  // (nextFloor.elevation − thisFloor.elevation) × 1000
  isLowestOccupiedStorey: boolean;      // ο κατώτατος (ισόγειο ή υπόγειο) → επιτρέπει εδαφόπλακα/θεμελίωση
  buildingHasBasement: boolean;         // any floor.number<0 ή kind==='basement'
}
```
- **Reuse** `floor-stack-elevation.ts` (μην ξαναγράψεις elevation math)· **reuse** `useFloorsByBuilding`.
- **Wire** το `storeyHeightMm`/`nextFloorElevationMm` στα vertical contexts (`WallVerticalContext`/`ColumnVerticalContext`) — αντικαθιστά το hardcoded 3000/μη-τροφοδοτούμενο `nextFloorElevationMm`. Έτσι: storey-ceiling walls/columns πέφτουν στο **πραγματικό** ταβάνι ορόφου.
- **Wire** το `storeyHeightMm` στα BIM defaults (κολώνα ύψος = storey height· οροφή/ceiling FFL = storey height) **αντί** για `DEFAULT_COLUMN_HEIGHT_MM`/`SLAB_KIND_DEFAULT_LEVEL_ELEVATION_MM`. (Διατήρησε τα constants ως **fallback** όταν δεν υπάρχει floor.)
- **Datum:** το level-relative 0 ΜΕΝΕΙ (entities stored relative)· το context δίνει height/kind/next, ΟΧΙ νέο datum για single-floor. (Το 3D ήδη offset-άρει σωστά.)

### Phase 2 — **Per-storey BIM defaults + foundation/εδαφόπλακα gating**

- BIM tool defaults κληρονομούν από `ActiveStoreyContext`: κολώνα ύψος=storeyHeight· **«Οροφές/Δάπεδα από κάναβο» FFL = nextFloorElevation** (όχι 0)· εδαφόπλακα/θεμελίωση μόνο όταν `isLowestOccupiedStorey`.
- **GEN-COL continuity** (ήδη υλοποιημένο): οι κολώνες του κατώτατου ορόφου φτάνουν στη θεμελίωση (`sceneFoundationTopMm`)· upper-storey κολώνες κάθονται στον όροφο από κάτω (storey stacking).
- **Εδαφόπλακα vs δάπεδα (λύση coplanar):** εδαφόπλακα (`ground`) = κατώτατος όροφος (ισόγειο/υπόγειο)· δάπεδα (`floor`) = άνω όροφοι. Με σωστό storey-per-level, ΔΕΝ ξανα-πέφτουν μαζί (διαφορετικά levels/floorElevationMm).

### Phase 3 — **Wizard «φόρτωσε ΟΛΟΥΣ τους ορόφους»** (αίτημα Giorgio)

- Άλλαξε/επέκτεινε τον `FloorplanImportWizard` (ή `LevelPanel.onComplete`) ώστε όταν επιλέγεται **κτίριο**, να δημιουργεί levels για **ΟΛΟΥΣ** τους ορόφους του (`useFloorsByBuilding`), καθένα linked στο floorId του, με σωστό order/label/elevation — **ΟΧΙ** μόνο τον επιλεγμένο. Έτσι ο μηχανικός έχει την πλήρη στοίβα ορόφων από την αρχή.
- Η εφαρμογή πλέον «ξέρει» το κτίριο: # ορόφων, υπόγειο ναι/όχι, τύπος θεμελίωσης (από `kind==='foundation'`/lowest floor).
- **Επιλογή:** «Φόρτωσε όλο το κτίριο» (όλοι όροφοι) vs «μόνο επιλεγμένο όροφο» — toggle στον wizard.

### Phase 4 — **Building structure awareness + κατακόρυφη συνέχεια**

- Τα εργαλεία θεμελίωσης/εδαφόπλακας κλειδώνουν στον **σωστό** όροφο (lowest = foundation/basement)· warning αν τρέξεις θεμελίωση σε άνω όροφο.
- **Multi-storey ανέγερση:** ο μηχανικός κτίζει ανά level· οι κολώνες κάθε ορόφου στοιβάζονται στις από κάτω· δάπεδα/οροφές στο σωστό FFL· το 3D «Όλοι οι όροφοι» δείχνει το πλήρες κτίριο (ήδη δουλεύει το stacking).
- **Cascade:** αλλαγή `floor.height` στην καρτέλα Όροφοι → cascade στις στάθμες των BIM entities του ορόφου (υπάρχει ήδη `floor-height-cascade.service.ts` — επέκτεινε σε DXF entities).

---

## 3. ADR-448 — να γραφτεί ΠΡΩΤΑ (N.0.1 ADR-driven)

**Αρχείο:** `docs/centralized-systems/reference/adrs/ADR-448-storey-aware-dxf-viewer.md` (επόμενος ελεύθερος = **448**· highest σήμερα = ADR-447). **ΜΗΝ** πειράξεις `adr-index.md` αν είναι shared tree — ή μόνο το δικό σου hunk.

Δομή ADR-448:
1. **Πλαίσιο/Πρόβλημα** — single-floor BIM hardcoded 0/3000· coplanar εδαφόπλακα/δάπεδα· ανάγκη storey-awareness για οικοδομές.
2. **Τι υπάρχει (code research §1)** — floors model, level↔floor link, multi-floor 3D works.
3. **Τι λείπει (το κενό §1C)**.
4. **Απόφαση** — Active Storey Context SSoT + per-storey defaults + wizard all-floors.
5. **Σύμβαση** — level-relative datum 0 μένει· context δίνει height/kind/next· cross-ref **ADR-369** (elevation), **ADR-237/420** (level↔floor), **ADR-399** (isolation), **ADR-441** (GEN-* εδαφόπλακα/κολώνες).
6. **Phased plan (§2)**.
7. **Changelog**.

---

## 4. KEY FILES (reference)

**Floors model:** `src/app/api/floors/floors.types.ts`, `src/utils/floor-naming.ts` (FloorKind), `src/types/building/contracts.ts`, `src/config/firestore-collections.ts`, `src/components/properties/shared/useFloorsByBuilding.ts`, `src/services/factories/floor.factory.ts`.
**Levels/wizard:** `src/subapps/dxf-viewer/systems/levels/config.ts` (Level), `useLevels.ts`, `level-floor-resolution.ts`, `src/features/floorplan-import/FloorplanImportWizard.tsx`, `src/subapps/dxf-viewer/ui/components/LevelPanel.tsx`.
**Elevation flow:** `src/subapps/dxf-viewer/bim-3d/scene/floor-stack-elevation.ts`, `hooks/data/useFloors3DAggregator.ts`, `bim-3d/scene/bim3d-resync.ts` (γρ.76 hardcoded 0), `bim/geometry/wall-top-profile.ts` (WallVerticalContext), `bim/geometry/column-vertical-profile.ts` (ColumnVerticalContext).
**Hardcoded constants:** `bim/types/column-types.ts:353` (DEFAULT_COLUMN_HEIGHT_MM=3000), `bim/types/slab-types.ts` (SLAB_KIND_DEFAULT_LEVEL_ELEVATION_MM), `bim/walls/wall-structural-attach-coordinator.ts:98` + `bim/columns/column-structural-attach-coordinator.ts:48` + `bim/columns/column-from-grid.ts:40` (ACTIVE_LEVEL_FLOOR_MM=0).
**ADR:** `docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md` (διάβασέ το — z-chain σύμβαση).

---

## 5. 🔴 ΚΑΤΑΣΤΑΣΗ REPO — UNCOMMITTED (ΜΗΝ revert — προηγ. session)

Αυτό το session (ADR-441 GEN-SLAB + fixes, **uncommitted**, ο Giorgio θα committαρει):
- **GEN-SLAB «Πλάκες από κάναβο»**: NEW `bim/slabs/slab-from-grid.ts` (`buildGroundBearingSlabs` MAT + `buildSlabBaysFromGuides` FLOOR/ROOF), `slab-grid-commit.ts`, `core/commands/entity-commands/CreateSlabsCommand.ts`, `bim/hosting/slab-hosting-strategy.ts`, `bim/foundations/foundation-level.ts` (`sceneFoundationTopMm`). MOD: `foundation-from-grid.ts` (enumerateGridBays), `foundation-grid-segments.ts` (bayKeyFromBindings), `derive-slots.ts` (deriveRectBaySlots), `hosting-strategy.ts`, `slab-firestore-service.ts`+`slab-persistence-helpers.ts` (guideBindings round-trip), `slab-command-keys.ts`, `useRibbonSlabBridge.ts`, `useDxfViewerNotifications.ts`, `drawing-event-map.ts`, `structural-tab.ts` (3 actionBtn — icon-agent shared), i18n el/en.
- **Εδαφόπλακα = ground-bearing slab** (`kind='ground'`@FFL 0 + SSoT `createDefaultGroundBuildup` DNA 405mm)· **ΟΧΙ** `kind='foundation'`/−1000 (το −1000 derive αναιρέθηκε).
- **GEN-COL static continuity**: `column-from-grid.ts`+`column-grid-commit.ts`+`column-completion.ts` (baseOffset) — κολώνες φτάνουν στη θεμελίωση ([−1000,3000]).
- **Auto-attach fixes (ADR-401)**: `useStructuralAutoAttach.ts` (skip foundation host) + `wall-structural-attach-coordinator.ts` + `column-structural-attach-coordinator.ts` (**top-host gate = `max(base, FFL)`** — floor slabs δεν τραβούν κορυφές κολωνών/τοίχων που φτάνουν στη θεμελίωση).
- **ADR-401 Phase D αντίστροφη φορά** (παλιότερο session).
- Docs: ADR-441 changelog, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, MEMORY (`project_adr441_foundation_strip_grid.md`).
- **DB-verified live** (project pagonis-87766, floorplan `file_32a7a4fb…`): πεδιλοδοκοί 12 [−1400,−1000]· συνδετήριες 12 [−1000,−500]· κολώνες 9 [−1000,3000]· τοίχοι 12· δοκάρια 12· δάπεδα 4· εδαφόπλακα 1 (`kind:ground`@0, 405mm DNA).
- **ΜΗΝ τα revert.** Όλα PASS jest + IDE type-clean.

---

## 6. ΣΕΙΡΑ & ΚΑΝΟΝΕΣ

1. **Phase 1 recognition (code=SoT):** διάβασε §1 αρχεία + ADR-369 + επιβεβαίωσε το map (research έγινε 2026-06-12, αλλά verify).
2. **Δήλωσε μοντέλο (N.14)** — Opus (architecture/cross-cutting).
3. **N.8: orchestrator-scale** (πολλά files/domains: levels + floors + BIM elevation + wizard) → **ΡΩΤΑ mode ΠΡΩΤΑ**.
4. **Γράψε ADR-448 ΠΡΩΤΑ** (N.0.1), μετά Phase 1.
5. **SSoT:** reuse `floor-stack-elevation.ts`, `useFloorsByBuilding`, ADR-369 z-chain. ΜΗΝ ξαναγράψεις elevation math.
6. **DB verify** (read-only MCP firestore) baseline → action → re-query, όπως στο προηγ. session.
7. **COMMIT ο Giorgio** (N.(-1))· shared tree → `git add` ΜΟΝΟ δικά σου hunks, ΟΧΙ `-A`· icon-agent → `structural-tab.ts`/ribbon data.
8. **N.15:** μετά υλοποίηση → ADR-448 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (νέο topic `project_adr448_storey_aware_dxf.md`).

---

## 7. ΕΡΩΤΗΣΕΙΣ ΠΡΟΣ GIORGIO (πριν Phase 1 κώδικα)

- Όταν αλλάζει `floor.height` στην καρτέλα Όροφοι → re-cascade σε υπάρχοντα DXF entities του ορόφου, ή μόνο σε νέα; (υπάρχει `floor-height-cascade.service.ts` server-side).
- Wizard «όλοι οι όροφοι»: default ON ή toggle; (Phase 3).
- Single active level: το context αλλάζει height/kind defaults — να αλλάζει ΚΑΙ το datum του 3D single-floor (να δείχνει στο πραγματικό FFL), ή μένει level-relative 0 και μόνο το «Όλοι οι όροφοι» δείχνει στοιβαγμένο;
