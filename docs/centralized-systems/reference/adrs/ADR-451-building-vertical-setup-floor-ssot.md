# ADR-451 — Building Vertical Setup & Floor SSoT (Revit level-driven)

**Status:** 🟢 Slices 0-3 + Slice 4 (rename-propagation) Implemented — pending browser-verify + commit (2026-06-13)
**Discipline:** Floors API · Building setup UI · DXF Viewer levels · BIM storey datum
**Related:** ADR-450 (floor-elevation cascade + ceiling SSoT-unify — αυτό το ADR το ενοποιεί), ADR-448 (storey-aware DXF viewer — DEFER «vertical-continuity → νέο ADR» = αυτό), ADR-369 (elevation convention §9), ADR-399 (floor-stack datum), ADR-436/441 (foundation discipline — ο ΤΥΠΟΣ θεμελίωσης per-element)

---

## 1. Context / Problem

Η καρτέλα «Όροφοι» (σελίδα Κτιρίων) επέτρεπε ασυνεπή κατακόρυφη δομή (όροφος 2 χωρίς 0/1, χωρίς θεμελίωση, χωρίς προειδοποίηση). Παράλληλα συνυπήρχαν **δύο ασύμβατα μοντέλα cascade** για το `elevation`↔`height`:

1. **server** (ADR-450 §1): αλλαγή `height` → σπρώχνει τα υψόμετρα των πάνω ορόφων.
2. **client** (`useFloorsTabState.handleSaveEdit`): αλλαγή `elevation` → ομοιόμορφη μετατόπιση ΟΛΩΝ των άλλων ορόφων κατά το ίδιο delta + confirm dialog.

Δεν υπήρχε ΕΝΑΣ κανόνας → συγκρούονταν. Επίσης ο DXF Viewer δεν επεξεργαζόταν ορόφους (μονόδρομη ροή).

**Revit / big-player:** Τα Levels είναι το SSoT της κατακόρυφης θέσης. Το floor-to-floor height προκύπτει από τα Levels — μία πηγή. Setup με υπόγεια/ισόγειο/ορόφους που παράγει συνεπή στοίβα.

## 2. Decision — 6 κλειδωμένες αποφάσεις (Giorgio «συμφωνώ με όλα», 2026-06-13)

1. **Continuity = soft Warning με override**, ΟΧΙ hard block (Revit way· ο χρήστης κύριος).
2. **Υπόγειο = count** (0,1,2…) → υποστηρίζει −1/−2 (διπλό υπόγειο, πιλοτή+υπόγειο).
3. **Θεμελίωση = auto-derived datum** (building-level «έχει; default ΝΑΙ + βάθος»), ΟΧΙ counted storey. Ο **ΤΥΠΟΣ** (πεδιλοδοκοί/κοιτόστρωση/πέδιλα) πάει per-element στο DXF (`floorplan_foundations`, ADR-436/441), ΟΧΙ στο setup.
4. **⭐ `elevation` = SSoT** (απόλυτη αλήθεια Level), **`height` = παράγωγο** (`height[i]=elevation[i+1]−elevation[i]`). **ΕΝΑ ενοποιημένο cascade, server-authoritative.**
5. **Quick Setup** (υπόγεια/ισόγειο/όροφοι → παράγει στοίβα) + σταδιακή επεξεργασία στην καρτέλα.
6. **DXF Viewer = full CRUD ορόφων μέσω ΙΔΙΟΥ `/api/floors`** · `useFloorsByBuilding` live sync · Levels (`lvl_*`) = projection, ΟΧΙ αντίγραφο.

### 2.1 Το ενοποιημένο μοντέλο (#4 — θεμέλιο)

Όροφοι sorted by `number`: f₀ … fₙ. `elevation[i]` = stored/authoritative ΚΑΘΕ ορόφου. `height[i] = elevation[i+1] − elevation[i]` (i=0…n−1) = παράγωγο **persisted projection** (το διαβάζουν κολώνες ADR-450 §2). `height[n]` (τελευταίος) = explicit (δεν έχει όροφο από πάνω).

| Ο χρήστης αλλάζει | Server | Ποιος κουνιέται |
|---|---|---|
| **`elevation` ορόφου k** (Revit «move a Level») | re-derive `height[k-1]`=elev[k]−elev[k-1] & `height[k]`=elev[k+1]−elev[k] | **μόνο** ο k (γείτονες αλλάζουν ύψος, όχι θέση) |
| **`height` ορόφου k** (push) | ADR-450 `cascadeFloorElevations`: shift κάθε `elev[j>k]` κατά delta | k + όλοι από πάνω (rigid) |

Entity re-stretch: το elevation-branch ξανατεντώνει τις entities των θιγόμενων ορόφων (reuse `cascadeFloorHeightToEntities`). Elevation wins όταν αλλάξουν και τα δύο.

## 3. Implementation

### Slice 1 — Unified server cascade (#4) ✅
- NEW `src/app/api/floors/floor-stack-reconcile.service.ts`:
  - `deriveAdjacentHeightsFromElevation(db, buildingId, changedFloorId, companyId, updatedBy)` — elevation-branch (re-derive 2 γειτονικά ύψη· self-healing· idempotent· audit `field:'height'`· METRES). Επιστρέφει `heightsUpdated` για entity re-stretch.
  - `reconcileFloorStackAfterEdit(db, …, edit)` — ΕΝΑ entry point που dispatch-άρει: elevation → derive + per-storey `cascadeFloorHeightToEntities`· height → `cascadeFloorHeightToEntities` + `cascadeFloorElevations` (ADR-450, ανέπαφο).
- MOD `floors.handlers.ts` `handleUpdateFloor`: διάκριση `elevationChanged`/`heightChanged` (reuse audit `changes` diff) → `reconcileFloorStackAfterEdit`.
- MOD `useFloorsTabState.ts`: **ΑΦΑΙΡΕΣΗ** client uniform-delta-shift + `cascadeElevation*` confirm. Ο client στέλνει ΕΝΑ update· server reconciles· refetch.
- NEW `__tests__/floor-stack-reconcile.service.test.ts` (11 tests).

### Slice 2 — Revit-true height UI + continuity warnings (#1, #4 UX) ✅
- MOD `FloorsTabContent.tsx`: ύψος input **read-only/γκρίζο** για ενδιάμεσους (παράγωγο), **editable μόνο ο τελευταίος** (highest number). Elevation editable παντού.
- MOD `useFloorsTabState.ts`: NEW `continuityWarnings` (missing ground / gaps / no base) + `topFloorId`. Soft banner **με override**, ΟΧΙ block.
- NEW i18n keys (`el`+`en`): `continuityMissingGround`, `continuityNoBase`, `derivedHeightHint`.

### Slice 3 — Building Vertical Setup + Quick Setup (#2/#3/#5) ✅
- MOD `types/building/elevation.schemas.ts` + `contracts.ts` + `building-services.ts`: NEW `hasFoundation?` (default true) + `foundationDepth?` (metres) στο `BuildingElevationPatchSchema`. Building PATCH handler = passthrough → persist.
- NEW `building-vertical-setup.ts` (pure `generateFloorStack` generator, normalise −0) + `__tests__` (7 tests).
- NEW `BuildingVerticalSetupForm.tsx`: inputs υπόγεια/όροφοι/τυπικό ύψος/θεμελίωση+βάθος → δημιουργεί στοίβα μέσω `createFloorWithPolicy` (low→high) + `updateBuildingWithPolicy` foundation. Wired στο `FloorsTabContent` («Γρήγορη ρύθμιση» button). i18n `quickSetup.*` (el+en).
- DXF Levels = lazy projection (`findOrCreateLevelForFloor` on viewer open) — ΚΑΝΕΝΑ νέο write στο `floors` από εδώ.

### Slice 4 — DXF full-CRUD ορόφων (#6) 🟡 ΜΕΡΙΚΟ
- ✅ **Rename propagation**: MOD `systems/levels/hooks/useLevelOperations.ts` `renameLevel` → όταν `level.floorId` set, propagate name στο floor SSoT μέσω `updateFloorWithPolicy` (non-fatal). Level = projection.
- 🔴 **DEFER** (χρειάζονται νέο DXF UI + product-απόφαση):
  - **Create** floor από DXF Level panel (νέο floor-creation UI με number/elevation/height).
  - **Delete**: ⚠️ **product-απόφαση** — διαγραφή DXF Level → διαγραφή ολόκληρου building floor (units/πελάτες/floorplans); Revit ναι, αλλά εδώ ο Floor κουβαλά building-management δεδομένα. **Χρειάζεται έγκριση Giorgio** πριν wire `deleteFloorWithPolicy`.
  - **Elevation/height editor** στο Level panel → `updateFloorWithPolicy` (net-new UI).

## 4. Files
**NEW:** `floor-stack-reconcile.service.ts`(+test)· `building-vertical-setup.ts`(+test)· `BuildingVerticalSetupForm.tsx`· `ADR-451-*.md`.
**MOD:** `floors.handlers.ts`· `useFloorsTabState.ts`· `FloorsTabContent.tsx`· `types/building/elevation.schemas.ts`· `types/building/contracts.ts`· `building-services.ts`· `systems/levels/hooks/useLevelOperations.ts`· `i18n/locales/{el,en}/building-tabs.json`.

## 5. Consequences
- ✅ ΕΝΑ server-authoritative κανόνας elevation↔height· μηδέν client/server σύγκρουση· ADR-450 height-push ανέπαφο.
- ✅ Revit-true UX: elevation = αλήθεια, height = παράγωγο read-only (top editable).
- ✅ Quick Setup bootstrap + foundation datum building-level.
- ⚠️ Slice 4 #6 μερικό (rename done· create/delete/elevation-edit deferred — delete θέλει product-απόφαση).

## 6. Verification
- Jest: `floor-stack-reconcile` (11) + `building-vertical-setup` (7) + regression ADR-450/449 (45 floors API + storey). Όλα PASS.
- Browser (project pagonis-87766, building bldg_1fa41c6d): άλλαξε υψόμετρο 1ου 3→3.5 → ΜΟΝΟ ο 1ος κουνιέται, ύψη γειτόνων βγαίνουν μόνα· ύψος ενδιάμεσων read-only· Quick Setup παράγει σωστή στοίβα· rename DXF level → όνομα ορόφου ενημερώνεται.

## 7. Changelog
- **2026-06-13** — Slices 0-3 + Slice 4 (rename-propagation) implemented (Opus). #4 unified cascade θεμέλιο· #1 warnings· #4 UX Revit-true height· #2/#3/#5 Quick Setup + foundation datum· #6 rename propagation (create/delete/elevation-edit deferred). 18 jest. Pending browser-verify + commit.
