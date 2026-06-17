# HANDOFF — ADR-459 Cross-Level Footing Rendering (all-floors) + scope-drift fix

**Ημ/νία:** 2026-06-17 · **Από:** Opus session · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά στις απαντήσεις.

---

## 0. ΤΙ ΖΗΤΑΕΙ Ο GIORGIO (το νέο task)

Revit-grade auto-foundation. Τα **cross-level πέδιλα** (αυτο-σχεδιασμένα, ζουν στον όροφο Θεμελίωσης) ΔΕΝ
εμφανίζονται σωστά:
1. **3Δ «Όλοι οι όροφοι»** → το πέδιλο **δεν φαίνεται**.
2. **Πλοήγηση στον όροφο Θεμελίωσης** → το πέδιλο **εμφανίζεται και αμέσως εξαφανίζεται** (flicker).

Ζητούμενο: **Full Enterprise + Full SSoT**, όπως η Revit. **ΠΡΙΝ γράψεις κώδικα → πραγματικό SSOT AUDIT
(grep)** για reuse, ΜΗΔΕΝ διπλότυπα. Μπες σε **PLAN MODE**, παρουσίασε plan, μετά υλοποίησε.

---

## 1. 🚨 ΟΙ ΔΥΟ ΠΡΑΓΜΑΤΙΚΕΣ ΑΙΤΙΕΣ (επιβεβαιωμένες με Firestore MCP audit)

### Fix A (αρχιτεκτονικό — η κύρια αιτία του «δεν φαίνεται στο all-floors»)
Οι all-floors aggregators διαβάζουν το BIM κάθε ορόφου από το **scene SNAPSHOT** του (`.scene.json`), ΟΧΙ από
το per-entity collection `floorplan_foundations`. Τα auto πέδιλα persist-άρονται σωστά στο `floorplan_foundations`
(SSoT) **αλλά δεν είναι στο snapshot** του ορόφου Θεμελίωσης → αόρατα στο all-floors.
- **ΠΡΙΝ** ένα παλιό bug («ghost baked στο snapshot») τα έκανε **κατά λάθος** ορατά. Η σταθεροποίηση αυτής της
  session (NEW `stripForeignFloorBim`) αφαίρεσε **σωστά** το baking — και αποκάλυψε ότι το **σωστό** μονοπάτι
  (aggregator να διαβάζει από `floorplan_foundations`) **δεν υπήρξε ποτέ**.
- Αρχεία aggregators: `hooks/data/useFloors3DAggregator.ts` (3Δ) + `hooks/data/useBuildingFloorScenes.ts` (2Δ
  underlay source). Διαβάζουν `getLevelScene()` / `DxfFirestoreService.loadFileV2(sceneFileId)` snapshots.
- **Κατεύθυνση Fix A (Revit-grade SSoT):** οι aggregators να αντλούν τα πέδιλα του ορόφου Θεμελίωσης από το
  **model SSoT** (`floorplan_foundations` per-entity), όχι από το snapshot cache. Reuse `subscribeFoundations` /
  `buildBimScopeConstraints` / `FoundationFirestoreService`. ΠΡΟΣΟΧΗ: το dual-persistence κρατά **σκόπιμα**
  own-floor BIM στο snapshot για το multi-floor 3Δ — μην το χαλάσεις· πρόσθεσε per-entity sourcing για τα
  cross-level πέδιλα, μην αντικαταστήσεις το υπάρχον.

### Fix B (data/scope drift — η αιτία του flicker «εμφανίζεται/εξαφανίζεται»)
Το πέδιλο στο `floorplan_foundations` (`fnd_84c683e8`) έχει:
- `floorId: flr_c25e29a6` (όροφος «F»/Θεμελίωση) ✅ σωστό
- `floorplanId: file_80efad96` ❌ **ανήκει στο Ισόγειο** (flr_215e39f3), ΟΧΙ στο «F» (που έχει file_2bf08dc9)

Δηλαδή το `target.sceneFileId` (από `resolveBuildingFoundationLevel`) δείχνει στο **αρχείο του Ισογείου**. Ο
κώδικας (`systems/levels/building-foundation-level.ts`) είναι λογικά σωστός (παίρνει `level.sceneFileId` του
level με `floorId === foundationFloor.id`) → άρα **το level του ορόφου «F» έχει sceneFileId = αρχείο Ισογείου**
= πιθανή **data inconsistency** (corrupted level↔file association από τα πολλά re-imports/tests).
- **Κατεύθυνση Fix B:** (α) έλεγξε τη σύνδεση level↔αρχείου (levels system / `files` collection) για τον όροφο
  «F»· (β) σκέψου guard στο `resolveBuildingFoundationLevel` ώστε `sceneFileId` να ΜΗΝ είναι αρχείο άλλου
  floorId· (γ) **εναλλακτικά**, ο Giorgio μπορεί να φτιάξει **καθαρό test project** (νέο κτίριο: Ισόγειο +
  όροφος Θεμελίωσης) — τα δεδομένα αυτού του project είναι «λερωμένα» από τα tests.

---

## 2. SSOT AUDIT MAP — ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (reuse, ΜΗΝ ξαναφτιάξεις)

| Υπάρχον | Path | Ρόλος |
|---|---|---|
| **Persistence scope SSoT** | `bim/persistence/bim-floor-scope.ts` | `resolveBimPersistenceScope` / `buildBimScopeConstraints` / `bimScopeWriteFields` (floorId-preferred) |
| **Single-level footing persist (canonical pattern)** | `hooks/data/useFoundationPersistence.ts` | subscribe `floorplan_foundations` + diff-merge — το πρότυπο για per-entity sourcing |
| **Foundation Firestore service** | `bim/foundations/foundation-firestore-service.ts` | `subscribeFoundations` / `saveFoundation` / `deleteFoundation` (collection `floorplan_foundations`) |
| **Cross-level writer** | `bim/foundations/foundation-cross-level-writer.ts` | create/update/remove στον όροφο Θεμελίωσης (Firestore + scene + **optimistic store**) |
| **Foundation level resolver** | `systems/levels/building-foundation-level.ts` | `resolveBuildingFoundationLevel` (Fix B εδώ) |
| **Foundation-level store** | `state/foundation-level-store.ts` | cross-level snapshot + `upsertEntity`/`removeEntity` (NEW αυτή τη session) |
| **Sync owner** | `hooks/useFoundationLevelSync.ts` | τροφοδοτεί το store (in-memory ή loadFileV2) |
| **3Δ all-floors aggregator** | `hooks/data/useFloors3DAggregator.ts` | Fix A (3Δ) — `extractBim3DEntities(scene)` ανά floor |
| **2Δ all-floors source** | `hooks/data/useBuildingFloorScenes.ts` | Fix A (2Δ) — raw SceneModel ανά non-active floor |
| **Scene BIM load/strip policy** | `systems/levels/scene-bim-load-policy.ts` | `reconcileLoadedSceneBim` (load) + **NEW `stripForeignFloorBim`** (write+read guard· reuse `isBimOrStairEntity`) |
| **Auto-design engine** | `bim/foundations/auto-foundation-layout.ts` + `auto-foundation-reconcile.ts` | plan + idempotent diff (rotation-aware) |
| **Apply / delete commands** | `core/commands/entity-commands/ApplyFoundationLayoutCommand.ts` + `DeleteCrossLevelFootingsCommand.ts` | undoable batch |
| **Auto-design hook** | `hooks/useAutoFoundationDesign.tsx` | level-wide auto + info toast |

**Grep στόχοι:** `floorplan_foundations|subscribeFoundations|buildBimScopeConstraints|extractBim3DEntities|
useBuildingFloorScenes|useFloors3DAggregator|loadFileV2|resolveBuildingFoundationLevel|sceneFileId|
stripForeignFloorBim|reconcileLoadedSceneBim|useFoundationPersistence`.

---

## 3. ΤΙ ΕΓΙΝΕ ΑΥΤΗ ΤΗ SESSION (ADR-459 Phase 7 — όλα UNCOMMITTED)

Λεπτομέρειες: ADR-459 §6j + changelog v8. Περίληψη:
- **Auto-Foundation-Design**: `auto-foundation-layout` (union-find overlap/clearance 100mm + combined
  load-centroid, εμβ.≥ΣN/σ) + `auto-foundation-reconcile` (idempotent diff, **rotation-aware**) +
  `ApplyFoundationLayoutCommand` + `useAutoFoundationDesign` (αντικ. `useColumnFootingNotification`). Auto-reinforce
  στη σύνδεση (no prompt). `FoundationCommonParams.autoDesigned` (+Zod).
- **DELETED superseded (δικά μου):** `column-footing-suggestion`, `pad-extend`, `CreateColumnFootingCommand`,
  `ExtendFootingToColumnCommand`, `useColumnFootingNotification` + tests.
- **3Δ delete cross-level πεδίλου:** `DeleteCrossLevelFootingsCommand` + branch στο `useSmartDelete`.
- **rotation-follow:** μεμονωμένο πέδιλο κληρονομεί `column.rotation` (`rotationDeg` σε layout/reconcile).
- **Ghost stabilization:** NEW `stripForeignFloorBim` σε autosave (`useAutoSaveSceneManager`) + 2Δ/3Δ aggregators.
- jest: layout 8 + reconcile 5 + delete 2 + policy 11 + aggregator 5 (όλα GREEN).

**⚠️ Γνωστό pre-existing (Giorgio «ας το αφήσουμε»):** autosave ενεργού ορόφου `canonicalScenePath is required
(ADR-293)` — `getFileStoragePath` επιστρέφει null → scene snapshot δεν σώζεται. ΔΕΝ μπλοκάρει auto-design/
rotation (persist μέσω per-entity + cross-level writer). Resilient fix (fallback σε `file.processedData.
processedDataPath`) προσφέρθηκε — εκκρεμεί απόφαση.

**⚠️ Stale Turbopack:** το `collectBimDeleteIds is not defined` ήταν stale build (ο `smart-delete-bim-events.ts`
προστέθηκε από ΑΛΛΟΝ agent mid-session). Restart dev server το λύνει — ο πηγαίος κώδικας είναι σωστός.

---

## 4. TEST SCENE (Firestore — «λερωμένο» από tests)

- Project `proj_12788b6a-ea19-41cd-90a0-a340e6bacaab` · Company `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757` ·
  Building `bldg_58f47bf1-4d41-4276-9929-bed8f1aa1a9d`.
- Floors: **«F»/Θεμελίωση** `flr_c25e29a6` (file_2bf08dc9) · **Ισόγειο** `flr_215e39f3` (file_80efad96, 2 κολόνες) ·
  **1ος** `flr_b48332d1` (file_9d056241).
- `floorplan_foundations`: 1 doc `fnd_84c683e8` (floorId=flr_c25e29a6, **floorplanId=file_80efad96 ← το drift**).
- `floorplan_columns`: 2 doc στο flr_215e39f3 με `footingId`.
- Firestore MCP: read OK· **storage WRITE denied** (allowlist· δεν μπορείς να καθαρίσεις scene.json χειροκίνητα).

---

## 5. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- **COMMIT/PUSH = Giorgio**, ΟΧΙ εσύ. **Shared working tree** (άλλος agent δουλεύει ταυτόχρονα) → `git add`
  **ΜΟΝΟ τα δικά σου** αρχεία, ΠΟΤΕ `git add -A`. (⚠️ `useSmartDelete.ts` + `smart-delete-bim-events.ts`
  τα πείραξε κι άλλος agent — πρόσεξε στο staging.)
- **tsc = Giorgio** (PowerShell denied για agent). **jest** τρέχει κανονικά (`npx jest <path> --silent`).
- **PLAN MODE πρώτα** → SSOT audit → plan → έγκριση → υλοποίηση → jest → docs (ADR-459 + ΕΚΚΡΕΜΟΤΗΤΕΣ + memory).
- **GOL:** 40-line functions / 500-line files / no `any` / no `@ts-ignore` / ADR-040 low-freq.
- Απαντάς **Ελληνικά**.

## 6. ΠΡΩΤΟ ΒΗΜΑ
1. SSOT audit (grep §2) — κατάλαβε πώς οι aggregators αντλούν BIM + πώς το `useFoundationPersistence` διαβάζει
   per-entity.
2. PLAN MODE → plan Fix A (per-entity sourcing στους aggregators) + Fix B (level↔file / resolveBuildingFoundationLevel
   guard). Ρώτα τον Giorgio αν προτιμά **καθαρό test project** πριν το Fix B.
3. Υλοποίηση → jest → docs. ΟΧΙ commit.
