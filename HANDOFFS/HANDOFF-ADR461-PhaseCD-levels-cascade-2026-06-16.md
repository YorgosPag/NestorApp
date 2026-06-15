# HANDOFF — ADR-461 Phase C + D (μαζί): DXF Levels + Elevation Cascade (special levels)

**Ημερομηνία:** 2026-06-16
**Συντάκτης:** Opus 4.8 (συνεδρία ADR-461 Phase B — μόλις ολοκληρώθηκε & browser-verified)
**Θέμα:** Phase **C** (foundation/penthouse → ορατά & σχεδιάσιμα DXF Levels στον viewer) **+** Phase **D** (elevation cascade: οι ειδικές στάθμες μένουν foundation-κάτω / penthouse-πάνω συνεπείς σε κάθε edit· επίλυση numbering edge-case). **FULL ENTERPRISE + FULL SSoT + Revit-grade** (Revit «Building Story» OFF, elevation = SSoT).

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ Ελληνικά (CLAUDE.md LANGUAGE RULE).
> ⚠️ **COMMIT/PUSH:** Ο Giorgio τα κάνει, ΟΧΙ εσύ (N.(-1)). ΠΟΤΕ `git add -A`.
> ⚠️ **SHARED WORKING TREE:** Δουλεύει κι άλλος agent (ADR-460, αγγίζει `bim/structural/*`, `column-*`). `git add` ΜΟΝΟ τα δικά σου αρχεία. Το Phase C/D αγγίζει `subapps/dxf-viewer/systems/levels/*`, `api/floors/*cascade*`, `building-management/tabs/*` → μάλλον δεν συγκρούεται, αλλά πρόσεξε.
> ⚠️ **TSC (N.17):** Πριν τρέξεις `tsc` έλεγξε ότι δεν τρέχει ήδη άλλος (`Get-CimInstance Win32_Process … *tsc*`). Ένα tsc τη φορά, ΠΟΤΕ παράλληλα.
> ⚠️ **MODEL (N.14):** Cross-cutting (dxf levels + server cascade + table state), 8-12 αρχεία, 2 domains → **Opus**. Δήλωσέ το & περίμενε «ok».
> ⚠️ **i18n (N.11):** ΚΑΘΕ νέο `t('key')` → ΠΡΩΤΑ keys σε `el` ΚΑΙ `en`, ΜΕΤΑ κώδικας. ICU single-brace `{x}`.
> ⚠️ **ADR-driven (N.0.1):** PHASE 1 (re-read CURRENT CODE — τα file:line παρακάτω) → plan → **ΕΓΚΡΙΣΗ Giorgio ΠΡΙΝ κώδικα** → υλοποίηση → ADR-461 changelog + adr-index + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY (N.15).
> ⚠️ **SSoT (N.0.2/N.12):** REUSE `isBuildingStorey`/`SPECIAL_LEVEL_KINDS`/`countBuildingStoreys` (`src/utils/floor-naming.ts`). ΜΗΝ φτιάξεις νέο predicate/array. ΜΗΝ πιάσεις ADR-459/460.

---

## ΜΕΡΟΣ 0 — ΚΑΤΑΣΤΑΣΗ (τι προηγήθηκε)

**Phase A** (pure model) + **Phase B** (UI «Όροφοι» + server persistence) = **DONE + BROWSER-VERIFIED, UNCOMMITTED** (104 jest, tsc clean). Τι υπάρχει ΗΔΗ & REUSE-άρεις:
- `src/utils/floor-naming.ts`: `FloorKind` περιλαμβάνει `'foundation'` & `'stair-penthouse'`· SSoT predicates **`SPECIAL_LEVEL_KINDS=['foundation','roof','stair-penthouse']`**, **`isBuildingStorey(kind)`**, **`countBuildingStoreys(floors)`**· `generateAutoLongName` → «Θεμελίωση» / «Απόληξη Κλιμακοστασίου».
- Server: `handleCreateFloor` πλέον **persist-άρει `kind`** (Phase B boy-scout). Άρα τα floor records έχουν `kind` στη Firestore.
- Building-level: `hasFoundation`/`foundationDepth` + `hasStairPenthouse`/`stairPenthouseHeight` (Zod + contracts + PATCH passthrough).
- `generateFloorStack` εκπέμπει foundation (κάτω) + penthouse (πάνω) specs με σωστό `kind`.

**LOCKED DECISIONS (Giorgio, αμετάβλητες):** Θεμελίωση & Απόληξη = ειδικές στάθμες (drawable Levels, Revit «Building Story» OFF)· ΟΧΙ μετρημένοι όροφοι· απόληξη default 2.40m· elevation = SSoT (ADR-451).

---

## ΜΕΡΟΣ 1 — GROUND TRUTH Phase C (DXF Levels) — file:line, κώδικας = αλήθεια

### ⭐ Το βασικό εύρημα: το levels pipeline είναι ΗΔΗ kind-agnostic → οι ειδικές στάθμες θα γίνουν Levels ΑΥΤΟΜΑΤΑ
Εφόσον τα floor records υπάρχουν με σωστό `kind`/`longName` (Phase B το εξασφαλίζει), **τα παρακάτω δουλεύουν χωρίς αλλαγή** (REUSE):
- `systems/levels/ensure-levels-for-building.ts:45` `ensureLevelsForBuilding(resolver, floors, buildingId)` — loop σε ΟΛΟΥΣ τους ορόφους, **καμία kind-filter**. `BuildingFloorInput` (γρ. 25-31) = `{ id, number?, label? }`. Δημιουργεί Level για κάθε floor.
- `ui/components/level-panel-hooks.ts:45` `useAllFloorsBackfill` — caller· περνά `label: f.longName ?? f.name` → «Θεμελίωση»/«Απόληξη Κλιμακοστασίου».
- `systems/levels/level-floor-resolution.ts` `findOrCreateLevelForFloor` — SSoT linking floor→Level (Level κρατά `floorId`, ΟΧΙ elevation· elevation ανακτάται at-render από `FloorOption.elevation`).
- `ui/components/LevelPanel.tsx` (level switcher) — `levels.map(...)` **χωρίς filter** → εμφανίζει αυτόματα.
- `ui/wizard/LevelSelectionStep.tsx:67` + `features/floorplan-import/FloorplanImportWizard.tsx` (Step 4) — **χωρίς filter**· `onComplete` (LevelPanel.tsx:392-454) → `findOrCreateLevelForFloor` + `triggerAllFloorsBackfill`.
- `systems/levels/useFloorsByBuilding.ts:95` — **ήδη** χαρτογραφεί `kind` → `FloorOption.kind`.
- `systems/levels/active-storey-context.ts:101` `buildActiveStoreyContext` — **ήδη** γεμίζει `storeyKind`.

### Τι ΠΡΕΠΕΙ να αγγίξει το Phase C (η πραγματική δουλειά = creation defaults ανά kind)
| # | Αρχείο:γραμμή | Αλλαγή |
|---|---|---|
| C1 | `systems/levels/storey-creation-defaults.ts` (τέλος — public API: `resolveStoreyCeilingRelativeMm`, `resolveStoreyHeightMm`, `shouldWarnFoundationOnStorey`) | **NEW per-kind creation defaults** (η ουσία): π.χ. `resolveStoreyDefaultTools(storey)` / `resolveStoreyDefaultEntityTypes(storey)` που ανά `storey.storeyKind` επιστρέφει ποια BIM εργαλεία/templates προτείνονται. `foundation` → πέδιλα/πεδιλοδοκοί/κοιτόστρωση. `stair-penthouse` → σκάλα/πλάκα-δώματος. counted storeys → σημερινά defaults. **REUSE `SPECIAL_LEVEL_KINDS`**. |
| C2 | `systems/levels/active-storey-context.ts:83,86` | **Boy-scout SSoT:** hardcoded `=== 'foundation'` → `SPECIAL_LEVEL_KINDS.includes(kind)` στο `resolveIsLowestOccupied` (αλλιώς το predicate δεν είναι ενιαίο). |
| C3 | `ui/components/LevelPanel.tsx` (level card) + `features/floorplan-import/FloorplanImportWizard.tsx` (Step 4 floor item) | **Προαιρετικό UX (Revit-grade):** badge «Ειδική στάθμη» όταν το floor του level έχει `kind ∈ SPECIAL_LEVEL_KINDS` — REUSE κεντρικό `<Badge variant="info">` (όπως `FloorsTabContent.tsx:318`). |
| C4 | ribbon/toolbar gating (αν χρειαστεί) | Νέο `useStoreyKindGating()` που διαβάζει `useActiveStoreyContext().storeyKind` → ενεργοποιεί τα tools του C1. **Ψάξε πρώτα αν υπάρχει υπάρχον tool-gating SSoT πριν φτιάξεις νέο.** |

**ADR-448 doc:** `docs/centralized-systems/reference/adrs/ADR-448-storey-aware-dxf-viewer.md`.

---

## ΜΕΡΟΣ 2 — GROUND TRUTH Phase D (Elevation Cascade) — RISK REGISTER

### ⭐ Το βασικό εύρημα: τα cascade services είναι kind-ΤΥΦΛΑ. Sort by `number` → ευάλωτα σε numbering collision.
Τα `FloorRow`/`FloorElevationRef` interfaces ΔΕΝ έχουν `kind`. «Top/lowest floor» = θέση στο `sort-by-number` array. Αυτό σπάει με τις ειδικές στάθμες.

| # | RISK | Αρχείο:γραμμή | Τρέχουσα συμπεριφορά | Phase D fix |
|---|---|---|---|---|
| **R1** | `FloorRow` χωρίς `kind` στα cascades | `api/floors/floor-stack-reconcile.service.ts:44-51` (`readBuildingFloors:60-82`, `deriveAdjacentHeightsFromElevation:107-151`)· `floor-elevation-cascade.service.ts:25-30,93` | foundation/penthouse = κανονικοί όροφοι στο derive/sort | Πρόσθεσε `kind` στα `FloorRow`/`FloorElevationRef` (το `readBuildingFloors` φέρνει ήδη το doc — απλώς πέρασε `kind`)· χρησιμοποίησε για special handling |
| **R2** | `topFloorId = floors[last]` | `useFloorsTabState.ts:241-244` (καταναλώνεται `FloorsTabContent.tsx:231` για editable height) | αν penthouse είναι last → ο top **counted** όροφος χάνει το editable height, το penthouse το παίρνει λάθος | `topFloorId` = ο τελευταίος όπου `isBuildingStorey(kind)`· το penthouse height = editable ΞΕΧΩΡΙΣΤΑ (explicit, ΟΧΙ derived) |
| **R3** | `isIntermediate` περιλαμβάνει special numbers | server `floors.handlers.ts:347` + client `useFloorsTabState.ts:378` | foundation(−1) κάνει το ισόγειο να φαίνεται intermediate → **αδυναμία διαγραφής (422)** | Εξαίρεσε τα special-level numbers από τη σύγκριση (`isBuildingStorey`) |
| **R4** | `resolveStoreyPosition` δεν εξαιρεί special | `…/useHeatLoadInputs.ts:107-108` | foundation→'lowest', penthouse→'highest' στο thermal model (λάθος εξωτ. δάπεδο/στέγη) | Filter counted storeys πριν τη σύγκριση |
| **R5** ⚠️ | `resolveBuildingDatumElevationM` fallback παίρνει foundation | `bim-3d/scene/floor-stack-elevation.ts:41-57` | χωρίς ground(0), η foundation (min elevation) γίνεται datum → **όλο το 3D μοντέλο ανεβαίνει κατά foundationDepth** | fallback min να εξαιρεί `kind ∈ SPECIAL_LEVEL_KINDS` (χρειάζεται `kind` στο `FloorElevationRef`) |
| **R6** ⚠️ | Duplicate `number` (foundation −1 vs χειροκίνητο υπόγειο −1) | server `floors.handlers.ts:173-182` (strict `number` equality) | **409 Conflict** | βλ. ΜΕΡΟΣ 2.1 (απόφαση numbering) |

`isBuildingStorey`/`countBuildingStoreys` **δεν χρησιμοποιούνται πουθενά στα cascade services σήμερα** — αυτό είναι το κενό. `cascadeFloorHeightToEntities` (`floor-height-cascade.service.ts:148`, `CASCADE_TARGETS:93-125`) είναι floor-scoped → ΟΚ ως έχει.

**ADR-450 doc:** `docs/centralized-systems/reference/adrs/ADR-450-floor-elevation-cascade-ssot-unify.md`.

### ΜΕΡΟΣ 2.1 — ⭐ ΠΡΟΤΕΙΝΟΜΕΝΗ Revit-grade απόφαση για numbering (lock στο PHASE 1, με Giorgio plan-approval)
Στο Revit τα Levels ταξινομούνται **ΜΟΝΟ κατά Elevation** — δεν υπάρχει integer που να περιορίζει τη σειρά· το «Building Story» είναι απλό flag. Άρα η enterprise/SSoT-καθαρή λύση, ευθυγραμμισμένη με ADR-451 («elevation = SSoT»):

**Πρόταση Α (προτεινόμενη — Revit-true):** Τα cascade services & το «top/lowest counted storey» detection να βασίζονται σε **elevation-sort + `isBuildingStorey`**, ΟΧΙ σε `number`. Το `number` παραμένει μόνο identity/label. Foundation έχει πάντα το χαμηλότερο elevation, penthouse το ψηλότερο → robust ανεξαρτήτως number. Ο duplicate-check (R6) γίνεται **kind-aware**: επίτρεψε co-existence (το πολύ ένα foundation + ένα penthouse ανά building· reject μόνο διπλό counted-storey number).

**Πρόταση Β (fallback αν το elevation-sort είναι too invasive):** sentinel number range για special levels (foundation = πολύ αρνητικό convention, penthouse = πολύ θετικό) ώστε να μην συγκρούονται ποτέ με counted numbers και να ταξινομούνται πάντα στα άκρα. Λιγότερο καθαρό, αλλά μικρότερο blast-radius.

→ **Στο PHASE 1, διάβασε τα cascade services & αποφάσισε Α ή Β, δικαιολόγησέ το, ζήτα έγκριση plan.** (Ο Giorgio: «κάνε τις Revit-grade αποφάσεις μόνος σου, ζήτα μόνο έγκριση plan» — memory `feedback_make_revit_grade_decisions_yourself`.)

---

## ΜΕΡΟΣ 3 — SCOPE αυτής της παράδοσης (C + D μαζί)
1. **Phase C:** per-kind creation defaults (C1) + boy-scout predicate (C2) + προαιρετικά UX badges (C3) + tool gating αν χρειαστεί (C4). Verify ότι foundation/penthouse εμφανίζονται ως Levels & σχεδιάζονται.
2. **Phase D:** kind-aware cascade (R1) + counted-storey top/lowest detection (R2) + intermediate-delete fix (R3) + thermal position (R4) + datum fix (R5) + numbering απόφαση (R6/2.1).
3. **Tests:** cascade με foundation+penthouse στη στοίβα (elevations μένουν συνεπή)· datum δεν μετατοπίζεται· intermediate-delete επιτρέπει ισόγειο με foundation παρών· numbering co-existence. tsc (N.17).
4. **Docs (N.15):** ADR-461 changelog Phase C+D + adr-index + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY.

**ΟΧΙ στο scope:** ADR-459/460 (άλλος agent). Μην αγγίξεις `bim/structural/*` columns/rebar.

---

## ΜΕΡΟΣ 4 — ΠΡΩΤΑ ΒΗΜΑΤΑ
1. Διάβασε αυτό + ADR-461 + ADR-448 + ADR-450 + ADR-451. Δήλωσε μοντέλο (**Opus**) & περίμενε «ok».
2. **PHASE 1:** re-read τα ΜΕΡΟΣ 1 + ΜΕΡΟΣ 2 αρχεία (όλα τα file:line). Επιβεβαίωσε ότι ισχύουν (κώδικας = αλήθεια — μπορεί άλλος agent να άλλαξε κάτι). Αποφάσισε Πρόταση Α/Β για numbering.
3. **Plan → ΕΓΚΡΙΣΗ Giorgio → υλοποίηση** (C πρώτα ή παράλληλα με D — εσύ κρίνεις στο plan).
4. Docs update (N.15). **Commit = Giorgio** (git add ΜΟΝΟ δικά σου).
