# ADR-484 — Cross-level Foundation Properties (κοινός SSoT selection resolver) + διασαφήνιση ανάθεσης επιπέδου

**Status:** 🟢 DONE (UNCOMMITTED 2026-06-18 Opus) · **Σχετικά:** ADR-459 (foundation-level SSoT / cross-level organism — η πηγή των footings), ADR-463 (Foundation Reinforcement UX + Properties panel), ADR-436 (foundation discipline + UpdateFoundationParamsCommand), ADR-420/399 (BIM persistence scope — durable floorId), ADR-366/363 (BimPropertiesShell/Router), ADR-040 (low-freq store reads).
**Ημ/νία:** 2026-06-18 · **Γλώσσα:** Ελληνικά.
**Πηγή:** `HANDOFFS/HANDOFF_2026-06-18_FOUNDATION-cross-level-properties-and-level-assignment.md`.

---

## 1. Context — δύο συνδεδεμένα θέματα στα πέδιλα

### (A) BUG — cross-level Properties άδειο
Επιλέγοντας πέδιλο που ανήκει σε **άλλο** επίπεδο από τον ενεργό όροφο (π.χ. ενεργός = «Ισόγειο», πέδιλο στον foundation level), το δεξί panel «Ιδιότητες» έμενε **άδειο** και ΔΕΝ εμφανιζόταν contextual ribbon tab. Πέδιλο στον **ενεργό** όροφο → δούλευε κανονικά.

**Ρίζα:** ΟΛΟΙ οι consumers του primary-selected entity (`BimPropertiesShell`, `BimPropertiesRouter`, `FoundationPropertiesTab`, ο contextual resolver `useActiveContextualTrigger`) έψαχναν **ΜΟΝΟ** στο `currentScene.entities` του ενεργού ορόφου. Τα πέδιλα όμως ζουν cross-level (collection `floorplan_foundations`, στον foundation level) και αφαιρούνται ρητά από τα entities ενός μη-foundation ορόφου (`useFoundationLevelSync.stripFootings`). Άρα `find` → `null` → άδειο panel + κανένα tab.

### (B) Διασαφήνιση — γιατί «διαφορετικά επίπεδα»
**ΔΕΝ υπάρχει per-kind level assignment.** `building-foundation-level.ts` → `floors.find(f => f.kind === 'foundation')` = **ΕΝΑΣ** foundation level ανά κτίριο· όλα τα kinds (pad/strip/tie-beam) ανήκουν εκεί. Τα διαφορετικά **υψόμετρα** ανά kind (tie-beam ψηλότερα, EC8) = by design (`defaultFoundationTopElevationMm`). Η εικόνα «πράσινο στο Ισόγειο / καφέ στη θεμελίωση» οφείλεται στο **provenance του write-path**, ΟΧΙ στο kind:
- **Χειροκίνητο placement** (`useSpecialTools` → `addFoundationToScene` → `appendEntityToScene(currentLevelId)`) → το πέδιλο μπαίνει στο **active scene** + persist στο active-floor scope → είναι στο `currentScene` → panel δούλευε.
- **Cross-level writer** (auto-design / column-attach, `foundation-cross-level-writer`) → γράφει στο **foundation-level scope** → cross-level → ΟΧΙ στο `currentScene` → panel άδειο.

➡️ Το intended Revit-canonical model είναι «όλα τα πέδιλα στον foundation level». Το χειροκίνητο placement που τα άφηνε σε μη-foundation ενεργό όροφο ήταν **ασυνέπεια ανάθεσης** (provenance-based, ΟΧΙ kind-based). **Slice 2 (2026-06-18, Giorgio): υλοποιήθηκε auto-redirect** — βλ. §3.bis. (Τα προϋπάρχοντα δοκιμαστικά δεδομένα στο Ισόγειο τα σβήνει ο Giorgio· **κανένα migration** — μόνο forward fix.)

## 2. Decision — ΜΙΑ αλήθεια επιλογής → ΕΝΑΣ resolver (Revit-grade)

Revit-canonical αρχή: ένα στοιχείο δείχνει/επεξεργάζεται τις ιδιότητές του **ανεξάρτητα** από το ενεργό view/level. ΕΝΑΣ κοινός SSoT resolver, reused από ΟΛΟΥΣ τους consumers — μηδέν διπλό lookup, μηδέν cross-level lookup «μόνο στο foundation tab».

## 3. Αρχιτεκτονική

### NEW — κοινός resolver (SSoT)
- **`systems/selection/resolve-selected-entity.ts`** — pure `resolveSelectedEntityFrom(id, sceneEntities, crossLevelEntities)`: ψάχνει (1) active scene, (2) fallback cross-level footings. Active πρώτα (anti-echo shadow). Zero React/Firestore deps.
- **`hooks/selection/useResolvedSelectedEntity.ts`** — reactive hook wrapper· πηγή cross-level = `useFoundationLevelStore.entities` (**low-freq** → ADR-040-safe, η ΙΔΙΑ πηγή που τροφοδοτεί 3D/organism, **μηδέν νέο Firestore subscription**).

### MODIFY — αντικατάσταση `currentScene.entities.find` με τον resolver
- `ui/bim-properties/BimPropertiesShell.tsx` (sub-tabs gate)
- `ui/wall-advanced-panel/BimPropertiesRouter.tsx` (per-type panel routing)
- `ui/foundation-advanced-panel/FoundationPropertiesTab.tsx` (read)
- `app/ribbon-contextual-config.ts` `useActiveContextualTrigger` (contextual tab cross-level· +`crossLevelEntities` dep)

### MODIFY — cross-level-aware write
- `ui/ribbon/hooks/bridge/useFoundationParamsDispatcher.ts`: αν το πέδιλο ζει στο active scene → υπάρχον **undoable** `UpdateFoundationParamsCommand`. Αλλιώς (cross-level) → `createFoundationCrossLevelWriter(scope, target, levelManager).update(...)` με geometry/validation recompute από τις **ΙΔΙΕΣ** pure SSoT (`computeFoundationGeometry` + `validateFoundationParams`) που χρησιμοποιεί το command — μηδέν duplication. **Trade-off:** cross-level edit = fire-and-forget (μη-undoable), συνεπές με το υπάρχον cross-level auto-design pattern.

### 3.bis MODIFY — Revit-canonical level assignment (Slice 2)
Τα foundation elements (pad/strip/tie-beam, freehand + from-wall) δρομολογούνται **ΠΑΝΤΑ** στον foundation level — όπως στη Revit ανήκουν στο structural foundation plan. **ΕΝΑ** SSoT σημείο: το routing μπαίνει στον υπάρχοντα insertion point `bim/foundations/add-foundation-to-scene.ts` (όλα τα creation paths το μοιράζονται):
- `foundationLevelStore.target ≠ null` (ενεργός ≠ foundation level) → `createFoundationCrossLevelWriter(scope, target, accessor).create(entity)` (Firestore foundation scope + foundation scene + store· **reuse** του υπάρχοντος cross-level write SSoT που ήδη χρησιμοποιεί το auto-design).
- αλλιώς (ενεργός = foundation level / single-level / degenerate scope) → κανονικό `appendEntityToScene` active append.
- **Υψόμετρα:** `topElevationMm = defaultFoundationTopElevationMm(kind)` (foundation datum, ΟΧΙ active-floor) → σωστά χωρίς προσαρμογή (tie-beam ψηλότερα, pad/strip στη στάθμη).
- `useSpecialTools` περνά `scope` (companyId/projectId[από levels]/userId μέσω `useAuth`).
- **Αφαιρέθηκε** το πλέον παραπλανητικό soft warning `bim:foundation-on-upper-storey` από το `useFoundationTool.activate` (το πέδιλο δεν «κολλάει» πια σε λάθος όροφο). Το ground-slab warning (`useRibbonSlabBridge`) διατηρείται.

### 3.ter MODIFY — file-level cross-floor guard στους aggregators (Slice 3, belt-and-suspenders)
**Ρίζα:** legacy shared `sceneFileId` (δύο όροφοι δείχνουν στο ίδιο `.scene.json` — root cause ADR-399 sticky-fileId). Ο file-level guard `isCrossFloorSceneLink` εφαρμοζόταν **ΜΟΝΟ** στο `useLevelSceneLoader` (2D active). Οι all-floors aggregators βασίζονταν στο per-entity `stripForeignFloorBim`, που **κρατά τα untagged** (χωρίς `floorId`) entities → cross-floor leak όταν shared fileId + untagged.
- **NEW SSoT** `systems/levels/cross-floor-link.ts → resolveFloorScopedScene(fileRecord, levelFloorId)`: pure, επιστρέφει το `fileRecord.scene` μόνο όταν έγκυρο **ΚΑΙ** όχι cross-floor (αλλιώς `null`). ΕΝΑ σημείο απόφασης — μηδέν διπλασιασμός της τριπλής συνθήκης στους 3 aggregators.
- **3 aggregators** καλούν `resolveFloorScopedScene(rec, ownFloorId)` αντί για inline `rec?.scene && Array.isArray(...)`:
  - `useFloors3DAggregator` (3Δ) + `useBuildingFloorScenes` (2Δ underlay): trip → `null` → **πέφτουν στο υπάρχον ADR-469 per-entity fallback** (own-floor entities από `floorplan_*`).
  - `useFoundationLevelSync`: trip → `baseEntities=[]` (τα footings έρχονται ανεξάρτητα από το floorId-scoped model subscription — αμετάβλητα).
- **Αρχή:** ο guard προστατεύει σε file-level **ΠΡΙΝ** το aggregate, ανεξάρτητα από entity tagging.

### 3.quater MODIFY — foundation top elevation ΑΠΟ ΤΙΣ ΡΥΘΜΙΣΕΙΣ ΟΡΟΦΟΥ (Slice 4)
**Ρίζα (πραγματική, από έρευνα δεδομένων):** ο χρήστης έβλεπε πράσινα strip στο Ισόγειο
+ καφέ pad στη Θεμελίωση σε διαφορετικά υψόμετρα. **Δύο ανεξάρτητες αιτίες:**
1. **DATA**: 4 strip πέδιλα αποθηκευμένα με `floorId=Ισόγειο` (legacy, pre-Slice-2 manual
   placement). Ο active-floor subscription (`floorId`-scoped, `bim-floor-scope`) τα δείχνει
   στο Ισόγειο — ο κώδικας σωστός, τα δεδομένα λάθος. Remediation: in-app deletion (Giorgio).
2. **CODE**: το auto-design pad έπαιρνε `topElevationMm` από τη **βάση κολώνας**
   (`auto-foundation-layout.ts:153 → col.baseZmm` = 0 στο ισόγειο), ΟΧΙ από τη στάθμη
   θεμελίωσης. Τα defaults (-1000 / -500) ήταν hardcoded.

**Fix (Revit-canonical):** η στάθμη άνω παρειάς πεδίλου παράγεται από το **FFL του ορόφου
Θεμελίωσης** (ρυθμίσεις «Όροφοι Κτιρίου» → «Βάθος θεμελίωσης» → F στο -1m):
- **NEW pure** `resolveFoundationTopElevationMm(foundationLevelElevationMm, kind)` στο
  `bim/types/foundation-types.ts`: pad/strip = FFL· tie-beam = FFL + `TIE_BEAM_RISE_MM`
  (EC8)· `null` FFL → default constants (μηδέν regression).
- **NEW SSoT reader** `bim/foundations/foundation-level-elevation.ts →
  resolveActiveFoundationLevelElevationMm()`: reuse `useFoundationLevelStore`
  (`target.floorElevationMm` cross-level / `activeFloorElevationMm` όταν foundation=active·
  ADR-040 low-freq).
- **NEW optional override** `foundationLevelElevationMm` στο `FoundationParamOverrides`·
  `buildDefaultFoundationParams`: `topElevationMm = overrides.topElevationMm ??
  resolveFoundationTopElevationMm(overrides.foundationLevelElevationMm, kind)` (ρητό user-set
  ribbon υπερισχύει).
- **Wired creation paths:** auto-design (`useAutoFoundationDesign.buildAutoFooting` →
  `target.floorElevationMm`)· manual single+2-click+from-wall (`useFoundationTool`)· grid
  πεδιλοδοκοί+συνδετήριες (`foundation-grid-commit`, `tie-beam-grid-commit`). Grid ghost
  preview = 2Δ κάτοψη (XY) → ανεπηρέαστο.

### 3.quinquies NOTE — Slice 3 (aggregator guard) disposition
Η Slice 3 (`resolveFloorScopedScene` + 3 aggregators) ήταν **σωστή αλλά ΑΣΧΕΤΗ** με το
παραπάνω symptom (τα πέδιλα έρχονται από per-entity `floorId` subscription, ΟΧΙ από το
all-floors scene blob). Παραμένει ως **defense-in-depth** για legacy shared `sceneFileId`
(tested, μηδέν regression). Το πραγματικό fix αυτού του bug = Slice 4 (data + elevation).

## 4. Reuse vs New (SSoT audit)
**Reuse:** `useFoundationLevelStore` (πηγή footings), `foundation-cross-level-writer`, `computeFoundationGeometry`/`validateFoundationParams`, `resolveBimPersistenceScope`, `resolveContextualTrigger`.
**New:** ΕΝΑ pure resolver + 1 hook wrapper + 6 jest.

## 5. ADR-040 σημείωση
Η subscription στο `foundation-level-store` ΔΕΝ παραβιάζει τον micro-leaf κανόνα: είναι **low-freq** store (γράφεται μόνο σε αλλαγή ορόφου/δομική μεταβολή), ΟΧΙ high-freq (hover/cursor/transform) → μηδέν 60fps re-renders.

## 6. Tests
- `systems/selection/__tests__/resolve-selected-entity.test.ts` — 6 GREEN (null/active/fallback/anti-shadow/null-scene/ghost).
- `bim/foundations/__tests__/add-foundation-to-scene.test.ts` — 3 GREEN (active append / cross-level redirect / degenerate fallback).
- +253 foundation+tools+selection jest GREEN (regression).

## 7. DEFER
- Cross-level **manual** edit undoable (Slice 6 έκανε το **grid** reconcile undoable μέσω `ReconcileCrossLevelFoundationsCommand`· το manual single-entity edit μένει fire-and-forget στον writer).
- Migration των legacy strips από blob ορόφου σε λάθος όροφο (τώρα: in-app delete μία φορά· Slice 5 τα κρύβει στο all-floors 3Δ).
- Optional info toast «το πέδιλο τοποθετήθηκε στη θεμελίωση» (αντικατάσταση του αφαιρεθέντος warning).
- Audit `recordFoundationChange('created')` στον cross-level writer (κοινό κενό με auto-design — boy-scout).
- Secondary cosmetics: `QuickProperties3DHoverPopover` (no `case 'foundation'`), `focus-order.ts` `SEMANTIC_TYPE_ORDER` (χωρίς `'foundation'`).

## Changelog
- **2026-06-18 (Opus, UNCOMMITTED) — Slice 1:** Cross-level Properties fix. NEW pure resolver + hook· MODIFY 4 read consumers + cross-level-aware dispatcher· 6 jest GREEN.
- **2026-06-18 (Opus, UNCOMMITTED) — Slice 2 (Giorgio «όπως η Revit»):** Revit-canonical level assignment. Foundation placement → ΠΑΝΤΑ foundation level (SSoT routing στο `add-foundation-to-scene` + cross-level writer reuse)· `useSpecialTools` auth scope· αφαίρεση misleading warning· 3 jest GREEN +253 regression. **Κανένα migration** (δοκιμαστικά δεδομένα — ο Giorgio τα σβήνει). 🔴 tsc (Giorgio) + browser-verify + commit.
- **2026-06-18 (Opus, UNCOMMITTED) — Slice 3 (belt-and-suspenders):** file-level cross-floor guard στους 3 all-floors aggregators. NEW pure `resolveFloorScopedScene` (SSoT, reuse `isCrossFloorSceneLink`)· MODIFY `useFloors3DAggregator` + `useBuildingFloorScenes` + `useFoundationLevelSync`· legacy shared `sceneFileId` δεν διαρρέει entities άλλου ορόφου ανεξάρτητα από entity tagging· 11 jest GREEN (5 νέα) +25 regression. 🔴 tsc (Giorgio) + browser-verify + commit.
- **2026-06-18 (Opus, UNCOMMITTED) — Slice 4 (foundation υψόμετρο από ρυθμίσεις ορόφου):** το auto-design pad έπαιρνε `topElevationMm` από τη βάση κολώνας (=0)· τώρα παράγεται από το FFL του ορόφου Θεμελίωσης («Βάθος θεμελίωσης»). NEW `foundation-types.resolveFoundationTopElevationMm(ffl, kind)` + `bim/foundations/foundation-level-elevation.resolveActiveFoundationLevelElevationMm()` (reuse low-freq `useFoundationLevelStore`)· `foundation-completion` override `foundationLevelElevationMm` (ρητό user-set υπερισχύει)· wired manual/from-wall/grid/auto. Browser-verified (`finalTopElevationMm:-1000`).
- **2026-06-18 (Opus, UNCOMMITTED) — Slice 5 (render isolation: foundations ΜΟΝΟ στον foundation level):** οι all-floors aggregators πετούν foundation entities από κάθε **μη-foundation** όροφο (legacy baked blob garbage δεν εμφανίζεται). NEW `scene-bim-load-policy.stripAllFoundations`· `useBuildingFloorScenes` (non-foundation → strip)· `useFloors3DAggregator` (non-foundation → `foundations:[]`). **Συμπλήρωση Slice 6:** ο **ενεργός** μη-foundation όροφος (early-return `liveActive`) έπαιρνε strip κι αυτός — gate `foundationLevelId != null` (target null ⟺ ενεργός=Θεμελίωση). 2 νέα jest. ⚠️ Όριο: 2Δ active floor = main pipeline (`currentScene`)· legacy 2Δ strips στον Ισόγειο φεύγουν μόνο με data cleanup.
- **2026-06-18 (Opus, UNCOMMITTED) — Slice 6 (grid + tie-beam routing στον foundation level — η ΡΙΖΑ):** ο grid commit (`commitFoundationGridFromGuides`) + ο tie-beam (`commitTieBeamGridFromGuides`) έγραφαν στον **ενεργό** όροφο (`LevelSceneManagerAdapter` + `CreateFoundationsCommand`→`drawing:entity-created`→active-floor persistence) → οι πεδιλοδοκοί εσχάρας κολλούσαν στο λάθος όροφο (Ισόγειο), με τον auto-trigger `bim:grid-guides-settled` να τις ξαναγεννά. FIX: όταν ενεργός ≠ Θεμελίωση, όλο το reconcile delta δρομολογείται μέσω του `FoundationCrossLevelWriter` (ίδιο SSoT με το manual `add-foundation-to-scene`) μέσω **NEW `ReconcileCrossLevelFoundationsCommand`** (atomic undo, mirror `DeleteCrossLevelFootingsCommand`). Existing strips = authoritative `foundation-level-store.entities` (scene-independent). Auto-trigger gate ελέγχει foundation strips (store) cross-level. Bridge wiring: `useAuthOptional` + `useLevelsOptional` → writer factory· `null` → αμετάβλητο single-level active path. 9 νέα jest (4 command + 2 grid + 1 tie-beam + 2 aggregator), +71 foundation regression GREEN. 🔴 tsc (Giorgio) + browser-verify + commit. **Cleanup:** τα 4 legacy strips στο blob Ισογείου → in-app delete μία φορά.
