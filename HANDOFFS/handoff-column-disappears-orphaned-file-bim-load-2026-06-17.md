# HANDOFF — «Η κολώνα εμφανίζεται και εξαφανίζεται» + ADR-293 autosave error (orphaned file + BIM load-clobber)

**Ημερομηνία:** 2026-06-17 · **Μοντέλο προηγ. συνεδρίας:** Opus 4.8 · **Γλώσσα απαντήσεων: ΕΛΛΗΝΙΚΑ πάντα.**

---

## 0. ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (ΑΠΑΡΑΒΑΤΟΙ)
- **ΟΧΙ commit / ΟΧΙ push** — ο Giorgio κάνει commit ΜΟΝΟΣ του. Εσύ μόνο γράφεις/τεστάρεις.
- **Shared working tree** με άλλον agent → όταν stage-άρεις, `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ** `git add -A`/`.`.
- **FULL ENTERPRISE + FULL SSoT, Revit-grade** (ρητή εντολή Giorgio). ΠΡΙΝ γράψεις κώδικα → **πραγματικό SSoT audit (grep)** για reuse· μηδέν διπλότυπα.
- `any`/`as any`/`@ts-ignore` ΑΠΑΓΟΡΕΥΟΝΤΑΙ. Hardcoded strings ΑΠΑΓΟΡΕΥΟΝΤΑΙ (i18n SSoT). Inline styles ΟΧΙ. Functions ≤40 γρ / code files ≤500 γρ.
- **N.17 (single-tsc):** πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει ήδη άλλος (`Get-CimInstance Win32_Process … *tsc*`). ΕΝΑ tsc τη φορά.
- Ο Giorgio ενέκρινε **Επιλογή 3 = ΚΑΙ ΤΑ ΔΥΟ fixes**: (Α) ανθεκτικό BIM load + (Β) heal του orphaned αρχείου. **Πρώτα το (Α)** (άμεση ανακούφιση, χαμηλό ρίσκο), μετά το (Β).

---

## 1. ΣΥΜΠΤΩΜΑ (Giorgio)
- Στο **Ισόγειο** είχε εισάγει κάτοψη DXF → μετά **διέγραψε όλες τις οντότητες DXF** → άρχισε να τοποθετεί **κολώνες σε άδειο καμβά** (μόνο οδηγοί/guides υπάρχουν).
- Σε **κάθε** τοποθέτηση κολώνας: console **ERROR** `canonicalScenePath is required for DXF scene saves (ADR-293)` (fileId `file_80efad96-6a75-40f9-8478-0ebaa5cfbcaf`).
- Μετά από hard reload η κολώνα **«εμφανίζεται για μια στιγμή και ύστερα εξαφανίζεται»**.
- ΚΡΙΣΙΜΗ παρατήρηση Giorgio: **«όταν τοποθετώ οντότητες DXF στον όροφο ΜΑΖΙ με τα BIM, το σύστημα σταθεροποιείται»**.

---

## 2. ΔΙΑΓΝΩΣΗ (ΟΛΟΚΛΗΡΩΜΕΝΗ — SSoT audit έγινε ήδη)

### 2.0 ΚΑΛΑ ΝΕΑ: τα δεδομένα ΔΕΝ χάνονται
Firestore MCP query: το `floorplan_columns` έχει **2 column docs** σωστά αποθηκευμένα:
```
companyId : comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757
projectId : proj_12788b6a-ea19-41cd-90a0-a340e6bacaab
floorId   : flr_215e39f3-d958-4f97-ac59-6639131767d1   ← το BIM scope key (ADR-420)
floorplanId: file_80efad96-6a75-40f9-8478-0ebaa5cfbcaf  ← provenance (orphaned!)
+ footingId fnd_82169e3f-…, reinforcement, geometry — όλα οκ
```
Άρα το **BIM write δουλεύει**. Το πρόβλημα είναι **load/render**, ΟΧΙ persistence των κολώνων.

### 2.1 Η αρχιτεκτονική: DUAL PERSISTENCE (ADR-390 Φ4 / ADR-420)
Κάθε BIM entity έχει **δύο** αποθηκεύσεις:
- **(SSoT) per-entity Firestore** `floorplan_columns`/`_walls`/… keyed by durable **`floorId`** (`flr_*`, IfcBuildingStorey). Γράφει/διαβάζει `useColumnPersistence` κ.λπ. — **δουλεύει**.
- **(cache) scene blob** `.scene.json` μέσω `autoSaveV2`. Στο **load** το BIM του snapshot **πετιέται** (`reconcileLoadedSceneBim`) και πρέπει να **ξαναγεμίσει** από τη per-entity subscription. Το blob είναι παράγωγο — βλ. `hooks/scene/scene-write-origin.ts`.

### 2.2 ΡΙΖΑ #1 — Orphaned αρχείο Ισογείου → ADR-293 error
Το `file_80efad96` **δεν υπάρχει** ούτε σε `files` ούτε σε `cadFiles` (επιβεβαιωμένο με MCP· και το ίδιο το app's `DxfFirestoreService.getFileStoragePath(fileId)` επιστρέφει `null` — γι' αυτό βγαίνει το error).
- Στο load (`useLevelSceneLoader.ts:138`) `loadFileV2(sceneFileId)` → record null/no-scene → πέφτει στο **else `«Scene not found»`** (γρ. 210-213) → `setLevelScene(createEmptyScene(),'load')`. **ΔΕΝ** φτάνει ποτέ το `setSaveContext({canonicalScenePath…})` (γρ. 191-194, gated σε `fileRecord.storagePath`).
- ΟΜΩΣ ο autosave target έχει ήδη οριστεί: `setFileRecordId(sceneFileId)` (γρ. 99) → `fileRecordId = file_80efad96` **χωρίς** canonicalScenePath.
- → Κάθε τοπική επεξεργασία → `setLevelScene(active,'local-edit')` (π.χ. `useColumnPersistence.ts:320` — χωρίς origin) → autosave → `getFileStoragePath(file_80efad96)=null` → **ADR-293 throw** (πιάνεται, μη-fatal, αλλά θορυβώδες + το scene blob ΔΕΝ σώζεται).

### 2.3 ΡΙΖΑ #2 — BIM load-clobber race (το «εμφανίζεται/εξαφανίζεται»)
Στον `useLevelSceneLoader.ts` οι **«empty scene»** γραφές γίνονται με σκέτο `createEmptyScene()` **ΧΩΡΙΣ** BIM preservation (σε αντίθεση με το `reconcileLoadedSceneBim` path):
- γρ. **213** (`Scene not found`), **218** (catch), **114/122/155** (no-file / dup / cross-floor).
Σειρά γεγονότων (BIM-only, orphaned αρχείο):
1. Level load: `existingScene` άδειο → δεν κάνει fast-return (γρ. 108-109).
2. `loadScene()` async: `await loadFileV2(file_80efad96)` (αργεί).
3. **ΕΝΩ περιμένει**, η per-entity subscription (`floorplan_columns where floorId=flr_215e39f3`) πυροδοτεί → `setLevelScene(active, +2 columns)` → **οι κολώνες ΕΜΦΑΝΙΖΟΝΤΑΙ** ✨.
4. `loadFileV2` resolves → null → γρ. 213 `setLevelScene(createEmptyScene(),'load')` → **σβήνει τις κολώνες** ✗ (το `'load'` γράφει in-memory ΑΣΧΕΤΑ με το origin — ο origin gate αφορά μόνο το autosave, ΟΧΙ το in-memory state).

**Γιατί «DXF+BIM σταθεροποιεί»:** αν υπάρχουν DXF entities, είτε (α) `existingScene.entities.length>0` → **fast-return** (γρ. 109) → ο loader δεν τρέχει το wipe, είτε (β) το blob φορτώνει με entities → γρ. 160 true → **`reconcileLoadedSceneBim` ΔΙΑΤΗΡΕΙ** το in-memory BIM. Επιβεβαιώνει 100% τη διάγνωση.

---

## 3. ΠΡΟΤΕΙΝΟΜΕΝΗ ΛΥΣΗ (Revit-grade, FULL SSoT — πάρε ΕΣΥ τις enterprise αποφάσεις, ζήτα έγκριση plan)

### FIX (Α) — Ανθεκτικό BIM load (ΠΡΩΤΑ· λύνει το ορατό «εξαφανίζεται»)
**Αρχή:** καμία load-time γραφή σκηνής (ειδικά οι «empty»/`'load'`) ΔΕΝ πρέπει να clobber-άρει live in-memory BIM που γέμισε per-entity subscription. Το BIM-preservation υπάρχει ΗΔΗ ως SSoT: `scene-bim-load-policy.reconcileLoadedSceneBim(loaded, existing)` (κρατά DXF-only του loaded + existing in-memory BIM).
- **Πέρνα ΟΛΕΣ τις load-time empty/loaded γραφές** του `useLevelSceneLoader.ts` (γρ. 114, 122, 155, **213**, 218) μέσα από `reconcileLoadedSceneBim(createEmptyScene(), sceneManager.getLevelScene(currentLevelId))` αντί για σκέτο `createEmptyScene()` — ΕΝΑ helper, μηδέν διπλότυπο. Έτσι ένα late "scene not found" διατηρεί τις κολώνες που πρόλαβε η subscription.
- ⚠️ SSoT audit ΠΡΩΤΑ: μην προσθέσεις νέα συνάρτηση αν το `reconcileLoadedSceneBim` αρκεί (αρκεί). Σκέψου helper τύπου `applyLoadedScene(sceneManager, levelId, loaded)` αν επαναλαμβάνεται το pattern σε 5 σημεία.
- Jest: επέκτεινε `systems/levels/__tests__/scene-bim-load-policy.test.ts` (preserve-on-empty-load).

### FIX (Β) — Heal / σωστό target για file-less όροφο (λύνει το ADR-293 error + persistence του DXF scene)
**Δύο enterprise δρόμοι — αποφάσισε ΕΣΥ (Revit-grade) ποιον/συνδυασμό:**
1. **Heal (provision-on-first-save):** όταν ο όροφος έχει `floorId` αλλά το `sceneFileId` είναι orphaned (loadFileV2 null), στο πρώτο save **δημιούργησε** files/cadFiles record + canonical storagePath (μέσω του ίδιου SSoT που χρησιμοποιεί το import — `/api/cad-files` `upsertCadFileWithPolicy`, ADR-288) ώστε το `deriveScenePath` να παράγει έγκυρο `canonicalScenePath`. ΑΠΑΙΤΕΙ: βρες πώς το import (uploadSmart / floorplan-import pipeline) χτίζει το canonical DXF storagePath (δομή `companies/.../files/{fileId}.dxf` — βλ. `src/services/upload/utils/storage-path.ts` που είναι deep entity-scoped· βρες τον DXF-specific builder). **ΜΗΝ** συνθέσεις αυθαίρετο path — χρησιμοποίησε τον υπάρχοντα SSoT.
2. **Graceful suppress:** όταν loadFileV2 null (orphaned/not-found), κάλεσε `resetDxfAutoSaveTarget()` (όπως ήδη κάνει το cross-floor branch, γρ. 156) ΚΑΙ στο else «Scene not found» (γρ. 210-213). Έτσι `fileRecordId=null` → ο autosave δεν επιχειρεί scene-blob save → **μηδέν ADR-293 error**. Το BIM persist-άρεται ανεξάρτητα (floorId). **Κόστος:** ο DXF scene αυτού του ορόφου δεν θα σώζεται ως blob — αλλά εφόσον είναι file-less, ούτως ή άλλως δεν σώζεται· (i) αν θες DXF persistence εκεί → χρειάζεσαι το #1.

**Revit-grade σύνθεση (πρόταση):** #2 για άμεση παύση του error (καθαρό, idempotent), + #1 ως «provision on demand» ώστε ένας file-less όροφος που αποκτά DXF entities να αποκτά πραγματικό αρχείο (όπως η Revit κρατά κάθε storey ως ιδιο drawing space). Πάρε την απόφαση + ζήτα έγκριση plan.

### Επιπλέον (διερεύνηση που ΕΚΚΡΕΜΕΙ)
- **Γιατί χάθηκε το record;** Το import είχε δημιουργήσει το `file_80efad96` (η κάτοψη φορτώθηκε). Μετά τη διαγραφή entities το record λείπει. Πιθανό lifecycle bug (διαγραφή αρχείου όταν αδειάζει η σκηνή; ή το import δεν persist-άρει ποτέ files-doc για floorplan import;). ⚠️ Caveat: το Firestore **MCP** ίσως δείχνει άλλο DB απ' το running app — ΑΛΛΑ το app's `getFileStoragePath` επίσης null, άρα το record λείπει και στο DB του app. Άξιζε ένα query στο `loadFileV2` path/scene-API για να δεις τι ψάχνει.

---

## 4. ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ (paths + γραμμές)
| Ρόλος | Path | Σημεία |
|---|---|---|
| **Load path (ΡΙΖΑ #2)** | `systems/levels/hooks/useLevelSceneLoader.ts` | empty writes 114/122/155/**213**/218· reconcile 171-175· saveContext inject 180-208 (gated storagePath)· setFileRecordId 99 |
| **BIM load policy SSoT** | `systems/levels/scene-bim-load-policy.ts` | `reconcileLoadedSceneBim` (γρ. 47-60) = το preservation helper· `stripForeignFloorBim`· `replaceFootingsFromModel` |
| **Autosave (ΡΙΖΑ #1)** | `hooks/scene/useAutoSaveSceneManager.ts` | single fileName/fileId για όλο το hook· path resolution 222-261· saveContext build 272-285· ADR-293 πέφτει κάτω |
| **ADR-293 throw** | `services/dxf-firestore-storage.impl.ts` | γρ. 174-177 |
| **Path helpers** | `services/dxf-firestore.service.ts` | `deriveScenePath` 381-387· `getFileStoragePath` 395-404 (null on missing doc) |
| **BIM scope SSoT (ADR-420)** | `bim/persistence/bim-floor-scope.ts` | `resolveBimScope` (floorId preferred)· `resolveBimPersistenceScope`· `buildBimScopeConstraints` |
| **Column persistence** | `hooks/data/useColumnPersistence.ts` | per-entity write/subscription· setLevelScene 320 (no origin=local-edit) |
| **Canonical storage path** | `src/services/upload/utils/storage-path.ts` | deep entity-scoped· βρες DXF-specific builder για το heal (#1) |
| **cadFiles dual-write (ADR-288)** | `/api/cad-files` `upsertCadFileWithPolicy` | το SSoT που το import χρησιμοποιεί για files+cadFiles |

**Σχετικά ADRs:** ADR-390 (symmetric BIM delete/undo — dual persistence), **ADR-420** (BIM floor-scope SSoT), **ADR-293** (canonical scene path, no legacy fallback), ADR-288 (cad file metadata centralization), ADR-459 Φ7 (foreign-floor strip), ADR-399 (cross-floor link guard).
**Σχετικές μνήμες:** `reference_bim_dual_persistence_load_ssot`, `reference_bim_persistence_scope_ssot`.

**Firestore facts (αυτό το project):** companyId `comp_9c7c1a50-…`, projectId `proj_12788b6a-…`, Ισόγειο floorId `flr_215e39f3-…`, orphaned sceneFileId `file_80efad96-…`, levelId/layerId `lvl_21982f3b-…`.

---

## 5. 🔴 ΕΚΚΡΕΜΗ COMMITS (uncommitted αυτής + προηγ. συνεδρίας — ο Giorgio κάνει commit· stage ΜΟΝΟ δικά σου, ΟΧΙ -A)

1. **«Έλξη» removal από grip hover-menu** (VERIFIED-pending): `systems/grip/grip-menu-resolver.ts`, `grip-menu-actions.ts`, NEW `systems/grip/__tests__/grip-menu-resolver.test.ts` (17 jest GREEN), `i18n/locales/{el,en}/tool-hints.json` (-`gripMenu.stretch`), `ADR-349-stretch-command.md` (v1.3), `ADR-397-…ssot.md` (§15), `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.
2. **Foundation cross-level autosave-origin fix (latent — ΟΧΙ ο actual bug)**: `bim/foundations/foundation-cross-level-writer.ts` (`mutateFoundationScene` → `origin:'system-reconcile'`), `ADR-459-…connectivity.md` (v8.2 changelog + status), `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`. Έγκυρη βελτίωση (foundation cross-level write δεν πρέπει να τρομπάρει DXF autosave) — αλλά **ΔΕΝ** ήταν η ρίζα του «κολώνα εξαφανίζεται». Ο Giorgio αποφασίζει αν κρατηθεί.
3. **Pre-existing (πρώτο handoff, ο Giorgio commit-άρει):** ADR-397 πλήρες ROTATE handle (Σ1+Σ2+Σ3+ESC) + Grip colors swap/consolidation (migration v6→7). Λίστα αρχείων στο `HANDOFFS/handoff-remove-grip-hover-stretch-2026-06-17.md` §2.

**ΟΧΙ δικά σου (άλλοι agents — ΜΗΝ stage-άρεις):** ADR-459/structural-organism uncommitted (foundation-firestore-service, useFoundationPersistence, useFoundationLevelSync, building-foundation-level, scene-bim-load-policy [other-agent parts], useFloors3DAggregator, useBuildingFloorScenes, foundation-level-store κ.λπ.). ⚠️ **Προσοχή:** το `scene-bim-load-policy.ts` που θα αγγίξεις στο FIX(Α) είναι **shared** με ADR-459 Φ7 — άγγιξε ΜΟΝΟ το `reconcileLoadedSceneBim` consumer-side (στο `useLevelSceneLoader`), όχι τις foundation συναρτήσεις.

---

## 6. ΠΡΩΤΟ ΒΗΜΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Διάβασε ΟΛΟ αυτό το handoff.
2. SSoT audit (grep) στα §4 paths — επιβεβαίωσε ότι το `reconcileLoadedSceneBim` είναι το μόνο preservation SSoT· βρες τον canonical DXF storagePath builder για το heal.
3. Πρότεινε plan (FIX Α πρώτα, μετά Β) + ζήτα έγκριση ΠΡΙΝ υλοποιήσεις.
4. ΟΧΙ commit/push — ο Giorgio. Απάντα στα Ελληνικά.
