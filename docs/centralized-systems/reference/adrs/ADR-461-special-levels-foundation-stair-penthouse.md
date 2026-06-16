# ADR-461 — Special Levels: Foundation + Stair Penthouse (Revit Building-Story OFF)

**Status:** 🟢 Phase A + B + C + D Implemented (model + generation + «Όροφοι» UI/server + DXF levels + kind-aware elevation cascade + advisory tool-gating + tests, tsc clean) — pending browser-verify + commit
**Discipline:** Floor kind SSoT (`floor-naming`) · Building setup UI · DXF Viewer levels · BIM storey datum
**Related:** ADR-451 (building vertical setup & floor SSoT — master· επεκτείνεται εδώ), ADR-448 (storey-aware DXF), ADR-450 (floor-elevation cascade), ADR-369 (elevation convention §9 / FloorKind), ADR-436/441 (foundation discipline — ο ΤΥΠΟΣ θεμελίωσης per-element)
**Model:** Opus 4.8

---

## 1. Context / Problem

Στην καρτέλα «Όροφοι» (ADR-451 Quick Setup) η **θεμελίωση** ήταν μόνο building-level *datum* (`hasFoundation`/`foundationDepth`) — δεν γινόταν ποτέ ορατή **στάθμη** στον πίνακα ή στον καμβά. Η **απόληξη κλιμακοστασίου** (κλειστός χώρος πάνω από το δώμα — stair head / μηχανοστάσιο) δεν υπήρχε καθόλου (ούτε flag, ούτε τύπος, ούτε στάθμη).

Ο μηχανικός θέλει να **σχεδιάζει** πάνω σε αυτές τις δύο στάθμες (κάτοψη θεμελίωσης = πέδιλα/πεδιλοδοκοί· κάτοψη απόληξης = σκάλα/δώμα), άρα πρέπει να είναι **drawable DXF Levels** — ορατές στον πίνακα ορόφων & στον level switcher — **αλλά ΟΧΙ μετρημένοι όροφοι** (το «Όροφοι: N» δεν τις μετράει).

**Revit / big-player:** Τα Levels foundation & roof/penthouse υπάρχουν ως πλήρη Levels με το flag **«Building Story» OFF** → σχεδιάζεις πάνω τους, αλλά δεν μετρώνται ως όροφοι. Αυτό ακριβώς αναπαράγουμε.

## 2. Decision — κλειδωμένες αποφάσεις (Giorgio, 2026-06-15)

1. **Φύση:** Θεμελίωση & Απόληξη = **ειδικές στάθμες** (special levels) — δικό τους DXF Level + γραμμή στον πίνακα «Όροφοι», αλλά **εκτός** του «Όροφοι: N». (Revit «Building Story» OFF.)
2. **Απόληξη = toggle** «Έχει απόληξη κλιμακοστασίου» + ύψος (καθρέφτης του «Έχει θεμελίωση»). **Default ON** όταν υπάρχει ≥1 όροφος.
3. **Ύψος απόληξης default = 2.40 m**.
4. **Παράδειγμα:** 0 υπόγεια + ισόγειο + 2 όροφοι → **5 στάθμες**: `Θεμελίωση · Ισόγειο · 1ος · 2ος · Απόληξη`. (1 υπόγειο → 6: `Θεμελίωση · Υπόγειο · Ισόγειο · 1ος · 2ος · Απόληξη`.)

### 2.1 ⭐ Μηχανισμός = REUSE `FloorKind`, ΟΧΙ νέο `role` (SSoT· N.0.2/N.12)

PHASE 1 finding (κώδικας = αλήθεια): υπάρχει **ήδη** SSoT `FloorKind` στο `src/utils/floor-naming.ts`:

```
FloorKind = 'foundation' | 'basement' | 'ground' | 'standard' | 'roof' | 'mezzanine'
```

με πλήρες auto-naming (`'foundation'→"Θεμελίωση"/"F"`), Zod (`FloorKindSchema` παράγεται από `FLOOR_KIND_VALUES`), persisted στο `FloorDocument.kind`. Ένα **νέο `role` discriminator** θα ήταν διπλό SSoT → απορρίφθηκε.

**Απόφαση:** Επεκτείνουμε το **υπάρχον** `FloorKind` με `'stair-penthouse'` (διακριτό από `'roof'`: η απόληξη είναι κλειστός χώρος *πάνω* από το δώμα, όχι η πλάκα δώματος). Το «μετράει ως όροφος;» είναι **παράγωγο** του `kind` μέσω SSoT predicate `isBuildingStorey(kind)` — κανένα νέο πεδίο στο floor record.

| FloorKind | Building Story (μετράει); | Auto long-name |
|---|---|---|
| `foundation` | ❌ special | Θεμελίωση |
| `basement` | ✅ | Υπόγειο |
| `ground` | ✅ | Ισόγειο |
| `standard` | ✅ | Νος Όροφος |
| `mezzanine` | ✅ | Μεσοπάτωμα |
| `roof` | ❌ special | Δώμα |
| **`stair-penthouse`** (NEW) | ❌ special | **Απόληξη Κλιμακοστασίου** |

### 2.2 Numbering των special levels

`elevation` = ο πραγματικός SSoT (ADR-451 #4). Το `number` δίνεται μόνο για ταξινόμηση/ταυτότητα:
- **Foundation:** `number = lowestStoreyNumber − 1`, `elevation = lowestStoreyElevation − foundationDepth`, `height = foundationDepth`.
- **Stair-penthouse:** `number = topStoreyNumber + 1`, `elevation = topStoreyElevation + topStoreyHeight`, `height = stairPenthouseHeight (2.40)`.

✅ **Edge-case (λύθηκε Phase D/R6 + follow-up):** με 0 υπόγεια η foundation παίρνει `number = −1`. (α) `handleCreateFloor` duplicate-check **kind-aware** → όχι 409. (β) **Revit-true satellite placement** (`reconcileSpecialLevelPlacement`, μετά από create/delete counted): η θεμελίωση μένει **ΠΑΝΤΑ κάτω** & η απόληξη/δώμα **ΠΑΝΤΑ πάνω** (number+elevation) — πρόσθεση υπογείου → θεμελίωση κατεβαίνει στο −2· πρόσθεση top ορόφου → απόληξη ανεβαίνει. (γ) client create-form counted-only → προτείνει −1 για υπόγειο.

## 3. Phases

| Phase | Τι | Domain | Risk |
|---|---|---|---|
| **A** ✅ | Model & generation: `FloorKind += 'stair-penthouse'` + `isBuildingStorey` predicate · building `hasStairPenthouse`/`stairPenthouseHeight` (contracts + Zod) · `generateFloorStack` εκπέμπει foundation+penthouse specs · tests. **Pure, μηδέν UI/render.** | floor-kind / building types | 🟢 |
| **B** ✅ | «Όροφοι» UI + server: toggle «Έχει απόληξη» + ύψος στο `BuildingVerticalSetupForm` · ο πίνακας δείχνει foundation/penthouse rows (special badge, εκτός count μέσω `countBuildingStoreys`) · server persistence του special `kind`. | building-management | 🟡 |
| **C** | DXF levels: foundation/penthouse → Levels μέσω `ensureLevelsForBuilding` (REUSE) · per-level creation defaults (`storey-creation-defaults`: foundation→πέδιλα, penthouse→σκάλα/δώμα) · level switcher + «Εισαγωγή Κάτοψης» δείχνουν τις 5-6 στάθμες. | dxf-viewer levels | 🟡 |
| **D** | Elevation cascade: ένταξη στο ADR-448/450 cascade ώστε edits υψομέτρων/υψών να κρατούν foundation κάτω & penthouse πάνω συνεπή. | dxf + server | 🟠 |

## 4. Implementation

### Phase A ✅ (αυτή η παράδοση)
- MOD `src/utils/floor-naming.ts`: `FloorKind += 'stair-penthouse'` + `FLOOR_KIND_VALUES` · short `"SP"` · long `"Απόληξη Κλιμακοστασίου"` · NEW `SPECIAL_LEVEL_KINDS` + `isBuildingStorey(kind)` + `countBuildingStoreys(floors)` SSoT predicates (το «Όροφοι: N» = παράγωγο). `inferKindFromNumber` comment ενημερωμένο.
  - _(Το `FloorKindSchema` Zod στο `floors.schemas.ts` παράγεται από `FLOOR_KIND_VALUES` → η επέκταση επικυρώνεται αυτόματα, μηδέν αλλαγή schema.)_
- MOD `src/types/building/elevation.schemas.ts`: `BuildingElevationPatchSchema += hasStairPenthouse?` (boolean) + `stairPenthouseHeight?` (`.min(0).max(99)`) · NEW const `DEFAULT_BUILDING_HAS_STAIR_PENTHOUSE = true` + `DEFAULT_BUILDING_STAIR_PENTHOUSE_HEIGHT_M = 2.40`.
- MOD `src/types/building/contracts.ts`: `Building += hasStairPenthouse?` / `stairPenthouseHeight?` (καθρέφτης `hasFoundation`/`foundationDepth`).
- MOD `src/components/building-management/tabs/building-vertical-setup.ts`: `GeneratedFloorSpec += kind: FloorKind` · `VerticalSetupConfig += hasFoundation?/foundationDepthM?/hasStairPenthouse?/stairPenthouseHeightM?` · `generateFloorStack` εκπέμπει foundation spec (πρώτο) + penthouse spec (τελευταίο) όταν toggles ON· κάθε storey παίρνει inferred `kind`. Back-compat: χωρίς toggles → ίδιες στάθμες (+ additive `kind`).
- MOD `__tests__/building-vertical-setup.test.ts`: +tests (foundation/penthouse specs, ordering, default 2.40, toggles OFF αμετάβλητο, kind ανά storey).

**ΟΧΙ στο Phase A:** UI, server persistence, DXF levels, rendering.

### Phase B ✅ (αυτή η παράδοση)

PHASE 1 finding (κώδικας = αλήθεια — δύο διορθώσεις στο handoff):
- Ο **list handler** (`floors.handlers.ts:handleListFloors`) επιστρέφει ήδη `kind` μέσω `{ id, ...doc.data() }` → **καμία αλλαγή**, μόνο ο client τύπος `FloorRecord` το δήλωνε λείπον.
- Το **building PATCH** (`building-update.handler.ts`) είναι passthrough (φιλτράρει μόνο `undefined` + immutable `companyId`, χωρίς allowlist) → τα `hasStairPenthouse`/`stairPenthouseHeight` persist-άρουν αυτόματα → **καμία αλλαγή handler**.

Αλλαγές:
- MOD `src/app/api/floors/floors.handlers.ts` (`handleCreateFloor`): **boy-scout fix (N.0.2)** — thread `kind` / `longName` / `nameAutoGenerated` / `longNameAutoGenerated` (+ conditional `finishThickness` / `mezzanineParentNumber`) στο `entitySpecificFields`. Πριν τα πετούσε παρότι το `CreateFloorSchema` τα επικύρωνε → **κανένας όροφος δεν persist-άρε `kind`**· τα special levels ήταν αδιάκριτα από counted storeys.
- MOD `src/components/building-management/tabs/BuildingVerticalSetupForm.tsx`: toggle «Έχει απόληξη κλιμακοστασίου» + ύψος (defaults από `DEFAULT_BUILDING_HAS_STAIR_PENTHOUSE`/`_HEIGHT_M`)· περνά και τα 4 πεδία (`hasFoundation`/`foundationDepthM`/`hasStairPenthouse`/`stairPenthouseHeightM`) στο `generateFloorStack`· `createFloor({ kind: spec.kind })` + παραλείπει το `name` override για special levels (το `formatFloorLabel(number)` θα έδινε λάθος ετικέτα — `createFloor` auto-gen «Θεμελίωση»/«Απόληξη Κλιμακοστασίου»)· persist `hasStairPenthouse`/`stairPenthouseHeight` building-level.
- MOD `src/components/building-management/building-services.ts`: `BuildingUpdatePayload += hasStairPenthouse?`/`stairPenthouseHeight?` (client τύπος που χρησιμοποιεί ο `updateBuildingWithPolicy`).
- MOD `src/components/building-management/tabs/useFloorsTabState.ts`: `FloorRecord += kind?: FloorKind` (η τιμή ρέει ήδη από τον list handler).
- MOD `src/components/building-management/tabs/FloorsTabContent.tsx`: special rows → κεντρικό `<Badge variant="info">` «Ειδική στάθμη»· footer count = `countBuildingStoreys(floors)` (counted storeys μόνο).
- MOD `src/i18n/locales/{el,en}/building-tabs.json`: `quickSetup.hasStairPenthouse` + `quickSetup.stairPenthouseHeight` + `tabs.floors.specialLevel`.
- NEW `src/app/api/floors/__tests__/floors.handlers.create-kind.test.ts`: 5 tests (kind threading· foundation/penthouse kind persistence· conditional finishThickness/mezzanineParentNumber).

**SSoT καθαρισμός (N.0.2, boy-scout, μετά από audit Giorgio):** το special-level badge χρησιμοποιεί το κεντρικό `Badge` (SSoT, `@/components/ui/badge`) αντί inline `<span>`· τα checkboxes (foundation που προϋπήρχε **+** το νέο penthouse) μεταφέρθηκαν στο κεντρικό `Checkbox` (`@/components/ui/checkbox`) αντί raw `<input type="checkbox">`.

**ΟΧΙ στο Phase B:** DXF Levels (Phase C), elevation cascade (Phase D).

## 5. Consequences
- ✅ ΕΝΑ SSoT για το «είδος στάθμης» (`FloorKind`)· κανένα διπλό `role`.
- ✅ Foundation/penthouse = πλήρεις στάθμες (drawable) χωρίς να μολύνουν το count.
- ✅ Back-compat: floors χωρίς `kind` = storeys· κτήρια χωρίς `hasStairPenthouse` = καμία απόληξη.
- ✅ Numbering edge-case 0-υπογείων (§2.2) λύθηκε (Phase D/R6 kind-aware duplicate-check).
- ✅ Satellite model: foundation re-anchors κάτω (edit βάθους ≠ ανύψωση κτηρίου)· datum εξαιρεί special levels· thermal/delete/top-height kind-aware.

## 6. Changelog
- **2026-06-16 (Opus 4.8) — C4+ soft warning «δοκάρι σε θεμελίωση → πεδιλοδοκός;» (Giorgio· UNCOMMITTED, jest GREEN):** Revit-grade non-blocking hint όταν τοποθετείται κανονικό (floor-framing) δοκάρι στη στάθμη θεμελίωσης — προτείνει πεδιλοδοκό/συνδετήρια δοκό (Structural Foundation tie-beam/grade beam). **ΠΟΤΕ δεν μπλοκάρει** (η θεμελίωση επιτρέπει beams — `resolveStoreyDefaultEntityTypes('foundation')` περιλαμβάνει 'beam'). Mirror ακριβώς του `bim:foundation-on-upper-storey` pattern: NEW pure resolver `shouldWarnBeamOnFoundation(storey)` (= `storeyKind==='foundation'`) στο `storey-creation-defaults.ts` (+4 jest)· NEW event `bim:beam-on-foundation-storey` (`drawing-event-map-bim.ts`)· emit 1×/activation στο `useBeamTool.activate()`· toast `storeyGating.beamOnFoundation` (el/en) στο `grid-build-notifications.ts`. Απάντηση σε ερώτηση Giorgio «το επιτρέπει η Revit;» → ΝΑΙ (τα levels=datums, όχι κλειδαριές εργαλείων· foundation/grade beams=κανονικό δομικό στοιχείο). Safe: store context=null → false → μηδέν emit (μηδέν regression). 🔴 browser-verify (ενεργοποίηση εργαλείου δοκαριού σε στάθμη θεμελίωσης → toast warning, η τοποθέτηση επιτρέπεται κανονικά) + commit.
- **2026-06-16 (Opus 4.8) — DXF «Στάθμες» panel ordering (browser-verify Giorgio «πάλι λάθος σειρά»· 3 jest+tsc, UNCOMMITTED):** Το `LevelPanel` έκανε `levels.map` σε creation order (ούτε καν `getLevelsSortedByOrder`). Ο 3D `sortLevelsTopDown` είναι κι αυτός μόνο `order`-based → **δεν υπήρχε kind-aware ordering SSoT**. NEW pure `systems/levels/level-display-order.ts` `orderLevelsForPanel(levels, resolveFloor)` — tier-based (Επίπεδο 1 default=top· Απόληξη `stair-penthouse`· Δώμα `roof`· counted storeys ground/standard/mezzanine/basement κατά `number` DESC· Θεμελίωση=bottom), stable ties=creation order, μηδέν mutation. Kind/number αντλούνται από το linked building `Floor`. **Πηγή (διόρθωση μετά από Firestore-verify Giorgio «η σειρά δεν άλλαξε»):** `useFloorsByBuilding(buildingId)` με `buildingId` από τις ΙΔΙΕΣ τις στάθμες (`levels.find(l => l.buildingId)`), ΟΧΙ `useProjectHierarchy().selectedBuilding` — το τελευταίο οδηγείται από τον properties navigator και είναι **τυπικά null μέσα στον DXF viewer** → floorsById κενό → όλα έπεφταν σε creation order (η αρχική αιτία). Το `useFloorsByBuilding` είναι η ίδια canonical πηγή που χρησιμοποιούν ήδη οι 3D aggregators στον viewer (FLOORS docs, kind+number). Firestore-verify επιβεβαίωσε: στάθμες έχουν `floorId`+`buildingId`, floors έχουν `kind`+`number` — τα δεδομένα ήταν σωστά, μόνο η πηγή ανάγνωσης ήταν λάθος. `Level` παραμένει χωρίς kind/elevation (satellite-model SSoT αμετάβλητο). 🔴 browser-verify (σειρά top→bottom: Επίπεδο 1, Απόληξη, [Δώμα], …όροφοι φθίνοντες…, υπόγεια, Θεμελίωση) + commit.
- **2026-06-15 (Opus 4.8):** ADR δημιουργήθηκε. Phase A implemented (reuse `FloorKind` αντί `role`· `'stair-penthouse'` + `isBuildingStorey`/`countBuildingStoreys` SSoT· building `hasStairPenthouse`/`stairPenthouseHeight`· `generateFloorStack` foundation+penthouse specs· tests). Phases B/C/D pending.
- **2026-06-15 (Opus 4.8):** Phase B implemented — «Όροφοι» UI + server persistence. Boy-scout fix: `handleCreateFloor` threadάρει πλέον `kind` (+ συνοδά ADR-369 πεδία) που πριν χάνονταν. `BuildingVerticalSetupForm` toggle απόληξης + 4 πεδία στο `generateFloorStack` + `kind`-aware `createFloor`. Πίνακας: special badge + count = `countBuildingStoreys`. List handler & building PATCH χωρίς αλλαγή (passthrough). +5 jest. **SSoT cleanup (audit Giorgio):** badge → κεντρικό `Badge`· checkboxes (foundation + penthouse) → κεντρικό `Checkbox`. Phases C/D pending.
- **2026-06-16 (Opus 4.8):** **Phase C + D implemented** (kind-aware stack + DXF levels). Numbering απόφαση = **Πρόταση Α refined (Revit-true)**: `kind`/`isBuildingStorey` οδηγεί ΟΛΗ την ταξινόμηση (counted vs special)· το `number` μένει iteration-order (δεν ταξινομείς κατά το elevation που θεραπεύεις).
  - **Phase D — kind-aware stack (satellite model):**
    - **R1** `FloorRow` (+`kind`) σε `floor-stack-reconcile.service` & `floor-elevation-cascade.service`. Special levels = **satellites** του counted backbone: foundation = `lowestCounted.elev − depth` (re-anchor **κάτω** — edit βάθους ΔΕΝ σηκώνει το κτήριο)· penthouse/roof rides up. `deriveAdjacentHeightsFromElevation` παράγει ύψη **μόνο** counted storeys (foundation depth / penthouse height = explicit), φτάνοντας στον επόμενο counted (αγνοεί ενδιάμεσο special).
    - **R5** `resolveBuildingDatumElevationM` (`floor-stack-elevation.ts`, +`kind` στο `FloorElevationRef`) εξαιρεί `SPECIAL_LEVEL_KINDS` από το fallback-min → το 3D δεν ανεβαίνει κατά `foundationDepth`.
    - **R2** `useFloorsTabState`: `topFloorId` → `heightDerivedFloorIds` (top counted + special levels = editable height· υπόλοιπα counted = derived). Consumer `FloorsTabContent` ενημερωμένος.
    - **R3** intermediate-delete (server `floors.handlers.ts` + client `useFloorsTabState`): μόνο counted storeys «σάντουιτς»· special level πάντα διαγράψιμο → foundation(−1) δεν μπλοκάρει το ισόγειο (422 λύθηκε).
    - **R4** `resolveStoreyPosition` (`useHeatLoadInputs`) φιλτράρει counted storeys → foundation/penthouse δεν γίνονται thermal lowest/highest.
    - **R6** `handleCreateFloor` kind-aware duplicate-check (single-field query, χωρίς νέο composite index): counted number unique μεταξύ counted· ≤1 ανά special kind· foundation(−1) συνυπάρχει με χειροκίνητο υπόγειο(−1) (409 λύθηκε).
  - **Phase C — DXF Levels (pipeline ήδη kind-agnostic → εμφανίζονται αυτόματα):**
    - **C2** boy-scout: `active-storey-context.resolveIsLowestOccupied` `=== 'foundation'` → `SPECIAL_LEVEL_KINDS` (ενιαίο SSoT).
    - **C1** NEW `resolveStoreyDefaultEntityTypes(kind)` + `BimToolCategory` (`storey-creation-defaults.ts`): advisory recommended disciplines ανά kind (counted→all· foundation→foundation/beam/slab· penthouse→stair/slab/wall/railing· roof→slab/roof/railing).
    - **C3** badge «Ειδική στάθμη» στο DXF level switcher (`LevelFloorLink` + `kind` στο ProjectHierarchyContext `Floor`, guarded)· FloorsTabContent badge ήδη υπήρχε.
    - **C4** Revit-style **ADVISORY** tool-gating («warn, don't block»): NEW `storey-tool-gating.ts` (`resolveBimToolCategory` + `isCommandRecommendedForStorey`) + `getCommandRecommendation` στο `RibbonCommandsApi` (default→true, μηδέν regression) wired στο `useRibbonCommands` (active storey kind)· `RibbonLargeButton`/`RibbonSplitButton` dim (opacity) + tooltip hint τα μη-σχετικά tools.
  - +tests: cascade satellite (foundation re-anchor/penthouse rides), reconcile counted-only derive, datum special-exclusion, C1 descriptor, C4 gating, lowest-occupied special-exclusion. tsc clean.
  - 🔴 **Εκκρεμεί:** browser-verify (foundation/penthouse → DXF Levels ορατά+σχεδιάσιμα· cascade συνεπές· delete ισόγειο με foundation· numbering co-existence· ribbon dim σε special level) + commit.
- **2026-06-16 (Opus 4.8) — follow-up R6+ (browser-verify finding, απόφαση Giorgio «Θεμελίωση πάντα κάτω / Απόληξη πάντα πάνω»):** Το server fix δεν αρκούσε — η client create-form πρότεινε −2 για χειροκίνητο υπόγειο (έβλεπε τη θεμελίωση −1 ως κατειλημμένο) → υπόγειο κάτω από τη θεμελίωση. **Revit-true satellite placement:**
  - NEW `reconcileSpecialLevelPlacement(db, buildingId, …)` (`floor-stack-reconcile.service`): οι ειδικές στάθμες ξανατοποθετούνται ΠΑΝΤΑ στα άκρα του counted backbone σε **number + elevation** — foundation κάτω (`minCounted.number−1`, `minCounted.elev−depth`), roof/penthouse πάνω (stacked above `maxCounted`). Idempotent· audit number+elevation· multiple specials ανά πλευρά stack-άρονται κατά σειρά. Καλείται μετά από **create & delete** counted ορόφου στους `floors.handlers` (non-fatal). → πρόσθεση υπογείου σπρώχνει τη θεμελίωση πιο κάτω· πρόσθεση top ορόφου σπρώχνει την απόληξη πιο πάνω· διαγραφή τα επαναφέρει.
  - Client `FloorsTabContent`: η create-form δέχεται **counted-only** `existingFloorNumbers`+`existingFloors` (NEW `countedFloors`/`countedFloorNumbers`) → ο stepper προτείνει −1 για υπόγειο (όχι −2)· το elevation-suggest δεν αγκυρώνεται σε ειδική στάθμη. Quick Setup αμετάβλητο (παίρνει όλα).
  - +4 jest (`reconcileSpecialLevelPlacement`: foundation κάτω, penthouse πάνω, idempotent, no-counted). tsc clean.
