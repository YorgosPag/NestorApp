# ADR-461 — Special Levels: Foundation + Stair Penthouse (Revit Building-Story OFF)

**Status:** 🟢 Phase A + Phase B Implemented (model + generation + «Όροφοι» UI/server persistence + tests) — pending browser-verify + commit · Phases C/D pending
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

⚠️ **Γνωστό edge-case (Phase B/D):** με 0 υπόγεια η foundation παίρνει `number = −1`, που θα μπορούσε αργότερα να συγκρουστεί με χειροκίνητη προσθήκη υπογείου (−1). Το `kind` τα ξεχωρίζει σημασιολογικά· ο idempotent number-skip του `BuildingVerticalSetupForm` αποτρέπει διπλά κατά τη re-generation. Οριστική επίλυση (αν χρειαστεί) στο Phase D (elevation cascade).

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
- ⚠️ Numbering edge-case 0-υπογείων (§2.2) — Phase D.

## 6. Changelog
- **2026-06-15 (Opus 4.8):** ADR δημιουργήθηκε. Phase A implemented (reuse `FloorKind` αντί `role`· `'stair-penthouse'` + `isBuildingStorey`/`countBuildingStoreys` SSoT· building `hasStairPenthouse`/`stairPenthouseHeight`· `generateFloorStack` foundation+penthouse specs· tests). Phases B/C/D pending.
- **2026-06-15 (Opus 4.8):** Phase B implemented — «Όροφοι» UI + server persistence. Boy-scout fix: `handleCreateFloor` threadάρει πλέον `kind` (+ συνοδά ADR-369 πεδία) που πριν χάνονταν. `BuildingVerticalSetupForm` toggle απόληξης + 4 πεδία στο `generateFloorStack` + `kind`-aware `createFloor`. Πίνακας: special badge + count = `countBuildingStoreys`. List handler & building PATCH χωρίς αλλαγή (passthrough). +5 jest. **SSoT cleanup (audit Giorgio):** badge → κεντρικό `Badge`· checkboxes (foundation + penthouse) → κεντρικό `Checkbox`. Phases C/D pending.
