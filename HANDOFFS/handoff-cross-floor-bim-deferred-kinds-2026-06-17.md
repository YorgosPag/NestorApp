# HANDOFF — ADR-469 follow-up: cross-floor per-entity BIM για τα DEFERRED kinds (openings + MEP + decorative)

**Ημερομηνία:** 2026-06-17 · **Μοντέλο προηγ. συνεδρίας:** Opus 4.8 · **Γλώσσα απαντήσεων: ΕΛΛΗΝΙΚΑ πάντα.**

---

## 0. ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (ΑΠΑΡΑΒΑΤΟΙ)
- **ΟΧΙ commit / ΟΧΙ push** — ο Giorgio κάνει commit ΜΟΝΟΣ του. Εσύ μόνο γράφεις/τεστάρεις.
- **Shared working tree** με άλλον agent → όταν stage-άρεις, `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ** `git add -A`/`.`.
- **FULL ENTERPRISE + FULL SSoT, Revit-grade** (ρητή εντολή Giorgio). ΠΡΙΝ γράψεις κώδικα → **πραγματικό SSoT audit (grep)** για reuse· μηδέν διπλότυπα.
- `any`/`as any`/`@ts-ignore` ΑΠΑΓΟΡΕΥΟΝΤΑΙ. Hardcoded strings ΑΠΑΓΟΡΕΥΟΝΤΑΙ (i18n SSoT). Functions ≤40 γρ / code files ≤500 γρ.
- **N.17 (single-tsc):** πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει ήδη άλλος (`Get-CimInstance Win32_Process … *tsc*`). ΕΝΑ tsc τη φορά.

---

## 1. ΓΙΑΤΙ ΑΥΤΗ Η ΔΟΥΛΕΙΑ (context)

Στην προηγ. συνεδρία υλοποιήθηκε το **ADR-469** (UNCOMMITTED) που έλυσε το «κολώνα εμφανίζεται/εξαφανίζεται» + ADR-293 error σε **file-less / orphaned** όροφο, με 3 fixes:
- (Α) anti-vanish load, (Β) ADR-293 suppress (`useLevelSceneLoader.ts`),
- (Γ) **NEW** `bim/persistence/cross-floor-bim-loader.ts` = one-shot per-entity BIM loader, wired ως fallback στους aggregators (`useFloors3DAggregator` 3Δ + `useBuildingFloorScenes` 2Δ) όταν λείπει το `.scene.json` snapshot.

Το FIX (Γ) καλύπτει **10 kinds** (column, wall, beam, slab, roof, stair, foundation, floor-finish, thermal-space, space-separator). **ΑΥΤΟ ΤΟ HANDOFF = να καλυφθούν και τα υπόλοιπα**, ώστε ένας file-less/orphaned όροφος που **δεν** έχει επισκεφθεί στο session να δείχνει cross-floor **ΟΛΑ** τα BIM του (Revit-grade πληρότητα).

> ⚠️ ΠΡΟΫΠΟΘΕΣΗ: ο Giorgio να έχει **commit-άρει πρώτα το ADR-469** (σταθερή βάση). Αν όχι, δούλεψε πάνω στο τρέχον working-tree state.

**Σχετικά:** ADR-469 (`docs/centralized-systems/reference/adrs/ADR-469-cross-floor-per-entity-bim-load.md`), μνήμη `reference_cross_floor_per_entity_bim_load`. SSoT πατέρας: `bim/persistence/cross-floor-bim-loader.ts`.

---

## 2. ΤΙ ΑΚΡΙΒΩΣ ΘΑ ΚΑΝΕΙΣ

### 2.A — 13 private converters → export ως pure helpers → registry
Κάθε ένα από τα παρακάτω kinds έχει έναν **καθαρό, single-arg, module-level** `docToEntity(doc)` που είναι **private** μέσα στο persistence hook (επιβεβαιωμένο: καλεί μόνο `validateXParams` — μηδέν closure σε hook state). Για κάθε ένα:

1. **Εξήγαγε** τον converter σε **pure co-located module** — ΟΧΙ απλό `export` από το hook (θα τραβούσε React/EventBus chain μέσα στον loader). Ακολούθησε το **υπάρχον pattern** των structural kinds: `hooks/data/<kind>-persistence-helpers.ts` (π.χ. όπως `column-persistence-helpers.ts`, `beam-persistence-helpers.ts`). Αν δεν υπάρχει helpers file, δημιούργησέ το· μετέφερε εκεί τη συνάρτηση + το `validateXParams` import.
2. **Re-import** στο hook (το hook συνεχίζει να καλεί τον ίδιο converter — μηδέν αλλαγή συμπεριφοράς).
3. **Πρόσθεσε 1 γραμμή** στο registry `CROSS_FLOOR_BIM_LOADERS` του `cross-floor-bim-loader.ts`:
   `makeLoader<XDoc>('FLOORPLAN_X', xDocToEntity),`

| Kind | Private converter (path:γρ.) | Collection key | Doc type (από `*-firestore-service.ts`) |
|---|---|---|---|
| slab-opening | `hooks/data/useSlabOpeningPersistence.ts:95` | `FLOORPLAN_SLAB_OPENINGS` | `SlabOpeningDoc` |
| railing | `hooks/data/useRailingPersistence.ts:85` | `FLOORPLAN_RAILINGS` | `RailingDoc` |
| furniture | `hooks/data/useFurniturePersistence.ts:83` | `FLOORPLAN_FURNITURE` | `FurnitureDoc` |
| floorplan-symbol | `hooks/data/useFloorplanSymbolPersistence.ts:86` | `FLOORPLAN_SYMBOLS` | `FloorplanSymbolDoc` |
| electrical-panel | `hooks/data/useElectricalPanelPersistence.ts:83` | `FLOORPLAN_ELECTRICAL_PANELS` | `ElectricalPanelDoc` |
| mep-fixture | `hooks/data/useMepFixturePersistence.ts:84` | `FLOORPLAN_MEP_FIXTURES` | `MepFixtureDoc` |
| mep-segment | `hooks/data/useMepSegmentPersistence.ts:83` | `FLOORPLAN_MEP_SEGMENTS` | `MepSegmentDoc` |
| mep-fitting | `hooks/data/useMepFittingAutoReconciliation.ts:100` | `FLOORPLAN_MEP_FITTINGS` | `MepFittingDoc` |
| mep-manifold | `hooks/data/useMepManifoldPersistence.ts:86` | `FLOORPLAN_MEP_MANIFOLDS` | `MepManifoldDoc` |
| mep-radiator | `hooks/data/useMepRadiatorPersistence.ts:86` | `FLOORPLAN_MEP_RADIATORS` | `MepRadiatorDoc` |
| mep-boiler | `hooks/data/useMepBoilerPersistence.ts:86` | `FLOORPLAN_MEP_BOILERS` | `MepBoilerDoc` |
| mep-water-heater | `hooks/data/useMepWaterHeaterPersistence.ts:86` | `FLOORPLAN_MEP_WATER_HEATERS` | `MepWaterHeaterDoc` |
| mep-underfloor | `hooks/data/useMepUnderfloorPersistence.ts:85` | `FLOORPLAN_MEP_UNDERFLOORS` | `MepUnderfloorDoc` |

> ⚠️ ΕΛΕΓΞΕ ανά converter πριν την εξαγωγή: ότι όντως δεν κλείνει hook-scope μεταβλητή (όλοι φάνηκαν pure στο audit, αλλά verify το σώμα). Επιβεβαίωσε το ακριβές import path του κάθε `XDoc` (συνήθως `../<kind>/<kind>-firestore-service`) και ότι ο entity τύπος ανήκει στο `Entity` union (αν ΟΧΙ → εξαίρεσε, όπως έγινε με `mep-system`).

### 2.B — opening (special-case, host-wall dependency)
Ο converter `openingDocToEntity(doc, hostWall)` (**ήδη exported**, `bim/walls/opening-doc-hydration.ts:32`, `OpeningDoc`, key `FLOORPLAN_OPENINGS`) **απαιτεί το host wall entity**. Δεν μπαίνει με σκέτο `makeLoader`. Σχέδιο μέσα στο `loadFloorBimEntities`:
1. Φόρτωσε πρώτα τους **walls** (ήδη στο registry) → φτιάξε `Map<wallId, WallEntity>`.
2. Φόρτωσε τα **openings** (`getAll<OpeningDoc>('FLOORPLAN_OPENINGS', {constraints})`) → για κάθε doc, βρες το host wall από το Map → `openingDocToEntity(doc, hostWall)` → φίλτραρε τα `null` (όταν λείπει host).
3. Κράτα το **καθαρό** (pure) — ίσως ένα μικρό `loadFloorOpenings(constraints, walls)` helper· ΜΗΝ σπάσεις το γενικό registry pattern για τα υπόλοιπα.

### 2.C — Aggregators: ΚΑΜΙΑ αλλαγή αναμένεται
- `useFloors3DAggregator.extractBim3DEntities` **έχει ήδη** κατηγορίες + type-guards για ΟΛΑ αυτά (slabOpenings, openings, fixtures, panels, railings, furnitures, mepSegments/Fittings/manifolds/radiators/boilers/waterHeaters/underfloors). Μόλις ο loader τα επιστρέφει, μπαίνουν αυτόματα στα σωστά buckets.
- `useBuildingFloorScenes` → 2Δ μέσω `convertSceneToDxf` (kind-agnostic).
- (thermal-space/space-separator/floorplan-symbol δεν έχουν 3Δ bucket — 2Δ-only· φυσιολογικό, ο 3Δ extract τα αγνοεί.)

### 2.D — Tests
- Ενημέρωσε `bim/persistence/__tests__/cross-floor-bim-loader.test.ts`: το «issues one getAll per registered kind» count `10 → 23` (ή όσα προστεθούν)· πρόσθεσε τα νέα module mocks (όπως τα υπάρχοντα identity mocks). Αν προστεθεί το opening special-path → test ότι openings χωρίς host φιλτράρονται.
- Τρέξε: `npx jest src/subapps/dxf-viewer/bim/persistence/__tests__/cross-floor-bim-loader.test.ts` + τα 2 aggregator suites.

---

## 3. SSoT AUDIT ΠΟΥ ΕΓΙΝΕ ΗΔΗ (μη το ξανακάνεις — επιβεβαίωσε μόνο)
- **One-shot fetch SSoT**: `firestoreQueryService.getAll<T>(key, { constraints })` (`src/services/firestore/firestore-query.service.ts:136`) — εφαρμόζει **αυτόματα** tenant `companyId` (`buildTenantConstraints`). ΜΗΝ βάλεις companyId στα constraints.
- **Scope SSoT**: `buildBimScopeConstraints` + `resolveBimPersistenceScope` (`bim/persistence/bim-floor-scope.ts`) — `floorId` durable-preferred (ADR-420).
- **docToEntity πατέρας pattern**: structural kinds → `hooks/data/<kind>-persistence-helpers.ts` (pure). Ακολούθησέ το.
- Όλοι οι 13 converters = single-arg, module-level, καλούν μόνο `validateXParams` (pure). Εξαγώγιμοι ασφαλώς.

---

## 4. ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ
| Ρόλος | Path |
|---|---|
| **Loader SSoT (registry — εδώ προσθέτεις)** | `src/subapps/dxf-viewer/bim/persistence/cross-floor-bim-loader.ts` |
| Loader test | `src/subapps/dxf-viewer/bim/persistence/__tests__/cross-floor-bim-loader.test.ts` |
| 3Δ aggregator (extractBim3DEntities — reference, ΟΧΙ αλλαγή) | `src/subapps/dxf-viewer/hooks/data/useFloors3DAggregator.ts` |
| 2Δ aggregator (reference) | `src/subapps/dxf-viewer/hooks/data/useBuildingFloorScenes.ts` |
| Scope SSoT | `src/subapps/dxf-viewer/bim/persistence/bim-floor-scope.ts` |
| getAll SSoT | `src/services/firestore/firestore-query.service.ts` |
| opening converter | `src/subapps/dxf-viewer/bim/walls/opening-doc-hydration.ts:32` |
| ADR | `docs/centralized-systems/reference/adrs/ADR-469-cross-floor-per-entity-bim-load.md` (ενημέρωσε §2.4 + §5 changelog· μετακίνησε kinds από DEFER) |

---

## 5. ΥΠΟΧΡΕΩΣΕΙΣ ΟΛΟΚΛΗΡΩΣΗΣ (N.15)
1. Ενημέρωσε **ADR-469** (§2.4 covered kinds, §4 files, §5 changelog v1.1).
2. Ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (γραμμή ADR-469 → νέα DEFER/actions).
3. Ενημέρωσε μνήμη `reference_cross_floor_per_entity_bim_load` (kinds count).
4. `adr-index.md` δεν χρειάζεται αλλαγή (ίδιο ADR).
5. tsc (background, N.17) + jest GREEN.
6. **ΟΧΙ commit** — ο Giorgio. Stage ΜΟΝΟ δικά σου (shared tree).

---

## 6. ΠΡΩΤΟ ΒΗΜΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Διάβασε ΟΛΟ αυτό το handoff + το ADR-469.
2. Διάβασε το `cross-floor-bim-loader.ts` (το registry pattern + `makeLoader`).
3. SSoT audit: grep ένα-δύο converters να επιβεβαιώσεις purity + import paths των Doc types.
4. Πρότεινε σύντομο plan (13 exports + opening special) + ζήτα έγκριση ΠΡΙΝ υλοποιήσεις.
5. Απάντα στα Ελληνικά.
