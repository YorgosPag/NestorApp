# HANDOFF — ADR-040 Root-Cause #2: Auto-Save Storm → SSoT Scene-Write Origin (FULL ENTERPRISE)

**Date:** 2026-06-11 · **Author:** Opus 4.8 (investigation + design) · **Status:** 🔴 DESIGN DONE, implementation NOT started
**Prereq context:** root-causes #1 (bitmap cache) + #3 (buildings listener dedup) ΗΔΗ DONE (βλ. `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` γρ. 21, εκκρεμεί browser-verify+commit από Giorgio). Αυτό είναι το **τελευταίο** root cause.

> ⚠️ **SHARED TREE.** Το working tree μοιράζεται με τον foundation agent (ADR-441) + άλλους (codex1/codex2). **`git add` ΜΟΝΟ τα δικά σου αρχεία, ΠΟΤΕ `-A`.** Commit τον κάνει **ο Giorgio**, όχι εσύ (N.(-1)).
> ⚠️ Η αλλαγή αγγίζει ~22 persistence hooks που ο foundation agent μπορεί να επεξεργάζεται. Το API change είναι **backward-compatible (optional param)** ώστε να ΜΗΝ σπάσει in-flight δουλειά του. Συντονίσου / προτίμησε Plan Mode.

---

## ΤΟ ΣΥΜΠΤΩΜΑ (Giorgio console)
- `DxfFirestore Storage save` version 181→182→183→184→185 σε ~25s (~950KB upload + POST /api/cad-files έκαστο) — **storm αποθηκεύσεων χωρίς ο χρήστης να αλλάζει τίποτα**.
- Συνεισφέρει στο main-thread pressure (κάθε save = JSON.stringify 950KB + upload + metadata write).

## Η ΑΙΤΙΑ (επιβεβαιωμένη με κώδικα — ground truth)

Το `useAutoSaveSceneManager.ts:159` κάνει **override** το `setLevelScene` → `setLevelSceneWithAutoSave`. **Κάθε** κλήση (από οποιαδήποτε πηγή) κάνει reset το 2s debounce (`:181-186`) → προγραμματίζει save.

Loop:
1. Save → Firestore metadata write.
2. Το write παράγει `onSnapshot` echo σε **~22 BIM persistence hooks** (wall/column/foundation/slab/opening/beam/roof/railing/furniture/floorplan-symbol/floor-finish/thermal-space/space-separator/6×mep/electrical-panel/…).
3. Κάθε hook στο snapshot callback κάνει diff-merge· αν `dequal` δει διαφορά (π.χ. `updatedAt` timestamp drift, geometry recompute) → `mutated=true` → `lm.setLevelScene(levelId, {...scene, entities:[...]})`.
4. Το `useSceneManager.setLevelScene:23` έχει **ΜΟΝΟ reference guard** (`prev[levelId]===scene`, γρ. 26) — οι hooks περνούν ΠΑΝΤΑ νέο object (spread) → guard ΠΟΤΕ δεν πιάνει → `setLevelSceneWithAutoSave` → **reset debounce** → βήμα 1.
5. ~22 hooks × ανά snapshot tick → το debounce γίνεται reset συνεχώς + κάθε save γεννά νέο echo → storm.

### Υπάρχουσες (ανεπαρκείς) άμυνες — ΜΗΝ τις θεωρήσεις λύση
- `useBimFirestoreWriteGrace` (`hooks/data/useBimFirestoreWriteGrace.ts`, `WRITE_GRACE_MS=2000`): per-entity, per-hook grace. Εμποδίζει re-hydrate ΤΗΣ entity από το δικό της echo — ΟΧΙ το `setLevelScene` storm (μη-dirty entities στο ίδιο snapshot περνούν).
- `isLoadingFromFirestoreRef` (auto-save manager): μόνο κατά το αρχικό load, release στο επόμενο rAF. ΔΕΝ καλύπτει τα μετέπειτα echoes.
- `dirtyIdsRef`: μόνο όσο in-flight το τοπικό write.
- Καμία χρήση `snapshot.metadata.hasPendingWrites`/`fromCache`. Καμία έννοια `origin`/`source`/`provenance` πουθενά (επιβεβαιωμένο grep).
- Μόνο `useGridGuidePersistence` έχει own-echo signature-compare — δεν υπάρχει στα BIM entity hooks.

---

## Η ΛΥΣΗ — FULL ENTERPRISE + FULL SSOT: «Scene Write Origin» (transaction-origin pattern)

**Αρχιτεκτονική δικαιολόγηση (Revit-grade):** Στα μεγάλα συστήματα (Revit model DB, Figma multiplayer, Yjs/ProseMirror) **κάθε mutation κουβαλά origin**, και τα side-effects (persistence) είναι **gated στο origin**. Εδώ ισχύει η θεμελιώδης αρχή:

> **Τα per-entity Firestore docs είναι το SSoT των BIM entities· το DXF scene blob (950KB) είναι παράγωγο cache.** Άρα ένα `remote-echo` (που πάντα αντανακλά ΗΔΗ-persisted doc state) **ΠΟΤΕ δεν χρειάζεται να ξανα-σώσει το blob**. Όπως στο Revit: η αναγέννηση view/cache ΔΕΝ «βρομίζει» (dirty) το document.

### Component 1 — SSoT απόφασης (ΕΝΑ σημείο, μηδέν scattered flags)
**NEW** `src/subapps/dxf-viewer/hooks/scene/scene-write-origin.ts`:
```ts
/** Γιατί άλλαξε η σκηνή — SSoT provenance για το auto-save gating (ADR-040). */
export type SceneWriteOrigin =
  | 'local-edit'        // user command / drawing / grip-drag / paste / delete → ΠΡΕΠΕΙ autosave
  | 'remote-echo'       // Firestore snapshot reconciliation (ήδη persisted) → ΟΧΙ autosave
  | 'load'              // initial load / restore / bootstrap → ΟΧΙ autosave
  | 'system-reconcile'; // derived idempotent writes (hosting/fitting/connector reconcilers,
                        // ADR-441/-408) — το source edit ήδη προγραμμάτισε save → ΟΧΙ autosave

export const DEFAULT_SCENE_WRITE_ORIGIN: SceneWriteOrigin = 'local-edit';

/** Η ΜΟΝΑΔΙΚΗ απόφαση «σχηματίζει αυτό το write auto-save;». Καμία αλλού. */
export function originSchedulesAutoSave(origin: SceneWriteOrigin): boolean {
  return origin === 'local-edit';
}
```
**Default = `local-edit`** → opt-OUT migration (safe): τα υπάρχοντα user-edit call sites (commands) δουλεύουν αμετάβλητα· ταγκάρουμε ΜΟΝΟ τα μη-τοπικά paths. Ελάχιστη επιφάνεια, μηδέν regression για user edits.

### Component 2 — Thread το origin μέσω του scene-write API
- `useSceneManager.ts:6` (type) + `:23` (impl): `setLevelScene: (levelId, scene, origin?: SceneWriteOrigin) => void`. Ο base manager ΑΓΝΟΕΙ το origin για το state (απλώς αποθηκεύει scene) — απλώς το **forward** στο override. Κράτα τον reference guard.
- `useAutoSaveSceneManager.ts:159` `setLevelSceneWithAutoSave(levelId, scene, origin = DEFAULT_SCENE_WRITE_ORIGIN)`:
  - **ΠΑΝΤΑ** καλεί `base.setLevelScene(levelId, scene)` (το in-memory + React state ΠΡΕΠΕΙ να ενημερωθεί για ΟΛΑ τα origins — ώστε το UI να δείχνει και remote edits).
  - Το debounce gate γίνεται: `if (originSchedulesAutoSave(origin) && autoSaveEnabled && fileName && !isLoadingFromFirestoreRef.current && !isEmptyScene)`. Όλα τα υπόλοιπα ίδια.
- ⚠️ Το `SceneManagerState['setLevelScene']` type αλλάζει σε optional 3ο param → **backward compatible**, ΟΛΑ τα υπάρχοντα call sites compile-άρουν χωρίς αλλαγή.

### Component 3 — Ταγκάρισμα των μη-τοπικών call sites (η μηχανική δουλειά)
Στο **snapshot-callback** `lm.setLevelScene(...)` κάθε persistence hook → πρόσθεσε `'remote-echo'`:
| Hook | call-site γρ. (από investigation) |
|---|---|
| useWallPersistence | 248 |
| useColumnPersistence | 248 |
| useSlabPersistence | 222 |
| useOpeningPersistence | 272 |
| useFoundationPersistence | 243 |
| useBeamPersistence | 237 |
| useSlabOpeningPersistence | 226 |
| useRoofPersistence | 214 |
| useRailingPersistence | 222 |
| useFurniturePersistence | 220 |
| useFloorplanSymbolPersistence | 223 |
| useFloorFinishPersistence | 175 |
| useThermalSpacePersistence | 174 |
| useSpaceSeparatorPersistence | 168 |
| useMepFixturePersistence | 228 |
| useMepSegmentPersistence | 233 |
| useMepManifoldPersistence | 230 |
| useMepRadiatorPersistence | 233 |
| useMepBoilerPersistence | 233 |
| useMepWaterHeaterPersistence | 233 |
| useMepUnderfloorPersistence | 232 |
| useElectricalPanelPersistence | 226 |

- **Reconcilers** → `'system-reconcile'`: `useHostingReconciler.ts:102`, `useMepFittingAutoReconciliation.ts:335,504`, `useMepConnectorReconciliation.ts:152`. (Το source edit τους ήδη προγραμμάτισε save· οι παράγωγες scene αλλαγές αντανακλούν persisted doc state.)
- **Loaders / restore** → `'load'`: `useLevelSceneLoader` + όποιο restore path καλεί setLevelScene κατά το bootstrap.
- ⛔ **ΜΗΝ** ταγκάρεις τα **delete-callback** `setLevelScene` (π.χ. `useFoundationPersistence:365`, `useWallPersistence:395`) — το delete είναι **local user action** → μένει default `local-edit` (ΠΡΕΠΕΙ να σωθεί).

### Component 4 — Belt-and-suspenders (N.7.2 #4): scene-level content guard (προαιρετικό hardening)
Το origin tagging είναι **αρκετό** για να σταματήσει το storm. Ως δεύτερη γραμμή, μπορείς (όχι υποχρεωτικά) να προσθέσεις στο `setLevelSceneWithAutoSave` ένα cheap short-circuit: αν `origin==='local-edit'` αλλά το scene είναι content-equal με το προηγούμενο για το level (π.χ. entity-count + shallow signature), skip το debounce reset. ΠΡΟΣΟΧΗ στο cost — μην κάνεις deep dequal 950KB ανά κλήση· προτίμησε φθηνό signature.

### Component 5 — Kill το redundant read (δευτερεύον)
`dxf-firestore.service.ts:214-230` `autoSaveV2`: το `if/else` καλεί **ίδιο** `saveToStorageImpl`. Το `getFileMetadataImpl(fileId)` (γρ. 221) = full Firestore getDoc ανά save, μηδέν επίδραση. Αφαίρεσέ το → κάλεσε `saveToStorageImpl` κατευθείαν.

---

## SSOT ENFORCEMENT (γιατί αυτό είναι «full SSoT»)
- **ΜΙΑ** συνάρτηση (`originSchedulesAutoSave`) αποφασίζει autosave-ή-όχι. Μηδέν scattered `suppressAutoSave` booleans σε 22 σημεία (αυτό ήταν το naïve fix του παλιού handoff — **ΑΠΟΡΡΙΦΘΗΚΕ**, παράγει 22 σκόρπια flags).
- **ΕΝΑ** type (`SceneWriteOrigin`) = vocabulary για κάθε scene mutation.
- Το origin γίνεται μέρος του scene-write contract (type-enforced από TS· νέο origin → compile error αν δεν το χειριστείς στο `originSchedulesAutoSave`).

## TESTS (Google presubmit-grade)
1. `scene-write-origin.test.ts`: truth table `originSchedulesAutoSave` (local-edit→true, τα άλλα 3→false).
2. `useAutoSaveSceneManager` (fake timers): `setLevelScene(l, scene, 'remote-echo')` → `DxfFirestoreService.autoSaveV2` **NOT** called μετά το debounce window· `'local-edit'` → **called** μία φορά. Mock το service.
3. (προαιρετικό) integration: ένας persistence hook snapshot echo → επιβεβαίωσε ότι το setLevelScene καλείται με `'remote-echo'` (spy).
4. Regression: τρέξε τα υπάρχοντα persistence-hook suites που αγγίζεις.

## ΣΕΙΡΑ ΥΛΟΠΟΙΗΣΗΣ (Plan Mode συνιστάται — ~26 αρχεία, 1 domain)
1. NEW `scene-write-origin.ts` + test.
2. `useSceneManager.ts` + `useAutoSaveSceneManager.ts` (το core gate) + test. ← **εδώ σταματά το storm**, ακόμη και πριν ταγκάρεις τα hooks (default local-edit κρατά user edits· τα hooks θα ταγκαριστούν στο βήμα 3).
   ⚠️ Προσοχή: μέχρι να ταγκάρεις τα hooks (βήμα 3), το storm ΠΑΡΑΜΕΝΕΙ (default local-edit). Το core change είναι ασφαλές αλλά **το storm κλείνει μόνο αφού γίνει το βήμα 3**.
3. Ταγκάρισμα 22 hooks (`'remote-echo'`) + reconcilers (`'system-reconcile'`) + loaders (`'load'`). Μηχανικό, ένα-ένα, με grep verify ότι έπιασες ΜΟΝΟ τα snapshot callbacks (όχι delete).
4. `autoSaveV2` redundant read kill.
5. tsc (N.17: ΕΝΑ tsc τη φορά, έλεγξε prior) + jest regression.
6. Update ADR-040 changelog (CHECK 6D? — όχι, αυτά τα αρχεία δεν είναι micro-leaf· αλλά είναι ADR-040 perf domain → **stage ADR-040 changelog** για ασφάλεια) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` γρ. 21 (σβήσε το «#2 ΑΠΟΜΕΝΕΙ»).

## ACCEPTANCE (browser-verify)
- Άνοιξε πυκνό σχέδιο, **μην κάνεις καμία αλλαγή** 30s → στην κονσόλα **μηδέν** `DxfFirestore Storage save` version bumps (πριν: 181→185 σε 25s).
- Κάνε **μία** πραγματική αλλαγή (μετακίνησε τοίχο) → **ακριβώς ένα** save (μετά το 2s debounce).
- Άλλος χρήστης/tab αλλάζει entity → το δικό σου scene **ενημερώνεται οπτικά** (remote-echo περνά στο state) αλλά **δεν** πυροδοτεί δικό σου save.
- Delete entity → σώζεται (local-edit). Undo/redo → σώζεται.

## ΠΡΟΣΟΧΕΣ / NUANCES
- Η σκέψη «remote-echo δεν σώζει το blob → το blob μένει stale re: άλλου χρήστη edit» είναι **OK by design**: τα BIM docs είναι authoritative, ο loader/persistence hooks ξανα-hydrate-άρουν το scene από docs στο επόμενο load. Μην «διορθώσεις» αυτό re-saving — θα ξαναφέρεις το storm.
- Ο hosting reconciler (ADR-441) στο drag-settle κάνει `EventBus.emit('bim:entities-moved')` → ο move-persist effect γράφει **BIM docs** (όχι scene blob). Αυτό είναι local-edit-derived persistence, ανεξάρτητο από το scene autosave· το `'system-reconcile'` στο setLevelScene του reconciler είναι σωστό (η scene αλλαγή είναι παράγωγη).
- Backward-compat: optional 3ο param → ο foundation agent's κώδικας δεν σπάει. Αν προσθέσεις required param → σπάει ΟΛΑ τα call sites + shared-tree conflicts. **ΚΡΑΤΑ ΤΟ OPTIONAL.**

## REFERENCES (exact)
- `src/subapps/dxf-viewer/hooks/scene/useSceneManager.ts:6,23-36` (base, reference-only guard)
- `src/subapps/dxf-viewer/hooks/scene/useAutoSaveSceneManager.ts:159-280` (override + debounce :181-186, gate :179)
- `src/subapps/dxf-viewer/hooks/data/useBimFirestoreWriteGrace.ts` (per-entity grace, ΟΧΙ scene-level)
- `src/subapps/dxf-viewer/services/dxf-firestore.service.ts:214-230` (autoSaveV2 dead branch)
- 22 `use*Persistence.ts` + 3 reconcilers (call-site γραμμές στον πίνακα παραπάνω)
- ADR-040 changelog (πρόσθεσε entry), `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt:21`
