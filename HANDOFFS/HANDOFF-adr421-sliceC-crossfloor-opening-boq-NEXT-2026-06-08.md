# HANDOFF — ADR-421 SLICE C follow-up: CROSS-FLOOR OPENING BOQ RE-FEED (2026-06-08)

**Γλώσσα:** Ελληνικά. **Working tree:** ΚΟΙΝΟ με άλλον agent — **ΟΧΙ commit/push** (ο Giorgio κάνει commit· `git add` ΜΟΝΟ τα δικά σου αρχεία). **ΜΗΝ αγγίξεις `adr-index.md`.**
**Ποιότητα (Giorgio):** «όπως οι μεγάλοι παίκτες, όπως η Revit — FULL ENTERPRISE + FULL SSOT».
**Workflow:** N.0.1 ADR-driven — **PHASE 1 RECOGNITION ΠΡΩΤΑ** (διάβασε τον τρέχοντα κώδικα· code = source of truth), μετά **Plan Mode** (η σωστή λύση έχει ≥1 πραγματική απόφαση — δες §2/§4· ρώτα τον Giorgio με AskUserQuestion), μετά υλοποίηση.
**Μοντέλο:** **Opus 4.8 συνιστάται** (correctness-sensitive: cross-floor persistence + BOQ aggregation + signature-group + stale-doc subtlety). Sonnet μόνο αν ο Giorgio το επιλέξει ρητά μετά το Plan.

---

## 0. TL;DR — ΤΙ ΘΑ ΚΑΝΕΙΣ

Όταν ο χρήστης **επεξεργάζεται έναν Τύπο κουφώματος** (Edit Type → π.χ. πλάτος 900→1000), τα κουφώματα αυτού του τύπου **σε ΟΛΟΥΣ τους ορόφους** πρέπει να ενημερώσουν το **BOQ** (Πίνακας Υλικών), όπως κάνει η Revit project-wide. Σήμερα:
- ✅ **Active floor**: το `useOpeningTypeReresolution` ξανα-ρέει geometry + το per-opening auto-save κάνει `upsertOpeningGroupForOpening` → BOQ σωστό.
- ✅ **Geometry σε άλλους ορόφους**: self-heal στο load (hydration «type wins» — βλ. το follow-up auto-type-on-load που μόλις έγινε).
- ❌ **BOQ σε άλλους ορόφους**: μένει **stale** μέχρι να ανοίξει ο όροφος. **ΑΥΤΟ κλείνεις.**

Wall/slab/roof το έχουν ήδη λύσει (`refeedBoqForTypeAcrossFloors` κ.λπ.). **Το opening ΛΕΙΠΕΙ** γιατί το opening BOQ δουλεύει διαφορετικά (signature-group aggregation, ΟΧΙ per-entity) — γι' αυτό ήταν deferred.

---

## 1. ΓΙΑΤΙ ΤΟ OPENING ΕΙΝΑΙ ΔΙΑΦΟΡΕΤΙΚΟ (recognition-verified 2026-06-08)

| | wall / slab / roof | **opening** |
|---|---|---|
| BOQ μοντέλο | **per-entity** row (1 row ανά entity) | **signature-group** (1 row ανά `floorplanId + signature`, signature = kind+width+height+sillHeight+openDirection) |
| Refeed πηγή | re-resolve **in-memory** entity → `bimToBoqBridge.upsertBoqItemForBim` | `upsertOpeningGroupForOpening` → `recomputeSignatureGroup` **διαβάζει Firestore** (`FLOORPLAN_OPENINGS WHERE companyId/projectId/floorplanId/kind`) και ξαναχτίζει το aggregate row |
| Χρειάζεται re-persist docs; | **ΟΧΙ** (geometry re-resolved on read) | **ΝΑΙ/εξαρτάται** — δες §3 (το crux) |

**Αρχεία-κλειδιά (διάβασέ τα στο PHASE 1):**
- `src/subapps/dxf-viewer/bim/family-types/family-type-side-effects.ts` — ο pure fan-out (wall/slab/roof). **Έχει ΗΔΗ `findOpeningsByTypeId` (γρ. 65)** + comment που εξηγεί γιατί δεν υπάρχει `refeedOpeningBoqForTypeAcrossFloors` ακόμη (γρ. 54-64). **Εδώ προσθέτεις το opening variant.**
- `src/subapps/dxf-viewer/hooks/data/useFamilyTypeBoqRefeed.ts` — ο host hook (στο `WallPersistenceHost`). **γρ. 50** φιλτράρει `category !== wall/slab/roof` → **πρόσθεσε `opening` branch.**
- `src/subapps/dxf-viewer/bim/services/opening-boq-sync.ts` — `upsertOpeningGroupForOpening(opening, prevParams, context)` + `recomputeSignatureGroup` + `fetchOpeningsForSignature`. `OpeningBoqContext` = `{companyId, projectId, buildingId, floorplanId, floorId?}`.
- `src/subapps/dxf-viewer/bim/services/opening-boq-grouper.ts` — pure: `computeOpeningSignature(params)` / `signatureKey` / `signatureGroupBoqId(floorplanId, sig)` / `buildOpeningGroupPayload`.
- `src/subapps/dxf-viewer/bim/family-types/opening-type-resolution.ts` — `resolveOpeningEffective(cached, {typeId, typeOverrides})` (store-backed «type wins») + `findOpeningsByTypeId`.

**Plumbing — ΛΥΜΕΝΟ (μην ψάχνεις):** το `floorplanId` που θέλει το opening BOQ **= `level.sceneFileId`** (`systems/levels/config.ts` `Level.sceneFileId`). Ο active floorplanId = `levelManager.fileRecordId` (= active level sceneFileId). Το `FloorLevelLike` (στο family-type-side-effects.ts) έχει ΗΔΗ `id` + `floorId?` + `sceneFileId?` → **όλα διαθέσιμα στον fan-out**. Ο host `useFamilyTypeBoqRefeed` ήδη φιλτράρει levels by buildingId + έχει `loadFileV2` + `boqContextBase {companyId, projectId, buildingId}`.

---

## 2. ΤΟ CRUX — STALE DOCS ΣΕ NON-ACTIVE FLOORS (διάβασε προσεκτικά)

Το `recomputeSignatureGroup` (opening-boq-sync.ts:109) χτίζει το BOQ row διαβάζοντας τα **persisted** `FLOORPLAN_OPENINGS` docs και το `data.params` τους. **ΠΡΟΒΛΗΜΑ:** σε non-active floors, μετά από type edit, τα docs ακόμη κρατούν τα **παλιά** effective params (drift-cache· ξαναγράφονται μόνο όταν ανοίξει ο όροφος + auto-save). Άρα:
- Σκέτο recompute των signature groups **ΔΕΝ** θα δείξει το νέο πλάτος (τα docs λένε ακόμη 900).
- Το **OLD** signature group δεν συρρικνώνεται (τα docs ταιριάζουν ακόμη στο old sig).

### Δύο πιθανές προσεγγίσεις (απόφαση Giorgio στο Plan):

**Approach A — Re-persist + recompute (πιο Revit-true, self-healing, FULL SSOT reuse):**
Για κάθε non-active floor, για κάθε opening doc με `typeId === editedTypeId`:
1. re-resolve effective params (`resolveOpeningEffective(doc.params, {typeId, typeOverrides})` — store ΗΔΗ updated από το command),
2. αν διαφέρει → **persist** το updated opening doc (params + geometry),
3. **recompute** τα affected signature groups (old sig από doc.params + new sig) μέσω `upsertOpeningGroupForOpening(updatedOpening, prevParams, context)` — **reuse 1:1** το υπάρχον SSoT.
- ➕ Πλήρως σωστό· τα docs self-heal· μηδέν νέα BOQ logic (reuse `upsertOpeningGroupForOpening`).
- ➖ Γράφει opening docs σε όλους τους ορόφους (περισσότερα Firestore writes· αλλά ίδιο pattern με active-floor self-heal· fire-and-forget). Χρειάζεται persist path εκτός active floor (δες `opening-firestore-service` save API).

**Approach B — Effective-aware recompute (λιγότερα writes, ΟΧΙ doc re-persist):**
Κάνε το `recomputeSignatureGroup`/`fetchOpeningsForSignature` **effective-aware**: για κάθε fetched doc, re-resolve `resolveOpeningEffective(doc.params, {typeId: doc.typeId, ...})` ΠΡΙΝ το signature-match + το payload build. Έτσι το BOQ δείχνει τον νέο τύπο χωρίς re-persist (τα docs self-heal αργότερα στο load). Recompute old+new sig per floorplanId.
- ➕ Λιγότερα writes (μόνο BOQ rows).
- ➖ Χρειάζεται προσοχή: πρέπει να ξέρεις **ποια** signatures να recompute (old type sig + new type sig)· τα per-instance `typeOverrides` περιπλέκουν (διαφορετικό sig ανά override). Λιγότερο «πηγή αλήθειας = το doc» (το doc μένει stale ώσπου να ανοίξει ο όροφος).

> **Σύσταση:** ρώτα τον Giorgio με **AskUserQuestion** (A vs B). Δεδομένου του «όπως η Revit, FULL ENTERPRISE», το **Approach A** είναι πιο πιθανό (self-healing source-of-truth), αλλά πες του το trade-off writes. Μην αποφασίσεις μόνος.

### Επιπλέον απόφαση: signature scope
Ο fan-out δεν έχει per-opening `prevParams`. Πρέπει να recompute **old + new** signatures. Πηγές:
- NEW sig: από τον updated τύπο (store) εφαρμοσμένο στα openings του τύπου.
- OLD sig: είτε (A) από τα stale doc.params πριν τα ξαναγράψεις, είτε χρειάζεσαι το prev type snapshot. Σημείωση: το `UpdateFamilyTypeCommand` κρατά snapshot για undo — **έλεγξε αν μπορείς να πάρεις prev typeParams** από το command/event (σήμερα το event payload = μόνο `{typeId, category}` — ίσως χρειαστεί επέκταση payload, ή derive OLD sig από τα docs πριν το re-persist [Approach A το δίνει δωρεάν]).

---

## 3. ΣΗΜΕΙΑ ΕΝΣΩΜΑΤΩΣΗΣ (στοχευμένο git add — ΜΟΝΟ δικά σου)

**Code (MOD/NEW):**
- `bim/family-types/family-type-side-effects.ts` → **NEW `refeedOpeningBoqForTypeAcrossFloors(args)`** (mirror δομής `refeedSlabBoqForTypeAcrossFloors` + `sceneForLevel`· αλλά opening-specific: floorplanId = `level.sceneFileId`, recompute signature groups αντί per-entity upsert). Reuse `findOpeningsByTypeId` (υπάρχει).
- `hooks/data/useFamilyTypeBoqRefeed.ts` → γρ. 50 πρόσθεσε `opening`· dispatch `refeedOpeningBoqForTypeAcrossFloors(shared)`. **ΠΡΟΣΟΧΗ:** το `shared` σήμερα δίνει `levels` με `floorId` αλλά **βεβαιώσου ότι περνά και `sceneFileId`** (το `FloorLevelLike` το έχει· έλεγξε ότι το `snap.levels` το κουβαλά — τα `useLevels().levels` είναι `Level[]` που έχουν `sceneFileId`). Πιθανώς χρειάζεται και `projectId` ήδη υπάρχει στο `boqContextBase`.
- (Approach A) ίσως `opening-boq-sync.ts` — καμία αλλαγή (reuse `upsertOpeningGroupForOpening`)· χρειάζεσαι opening **persist** εκτός active floor → δες `bim/walls/opening-firestore-service.ts` (save/update API) + `opening-doc-hydration.ts §openingDocToEntity` για doc→entity.
- (Approach B) `opening-boq-sync.ts` — κάνε `fetchOpeningsForSignature` effective-aware (import `resolveOpeningEffective`).

**Tests (NEW/MOD):**
- `bim/family-types/__tests__/family-type-side-effects.test.ts` **υπάρχει** → επέκτεινε με opening cases (mirror των wall/slab/roof tests: fake levels με sceneFileId, fake loadFileV2, fake BOQ upsert/recompute, assert recompute κλήθηκε ανά floor με σωστό floorplanId + old/new sig). Inject το recompute/upsert όπως τα άλλα variants κάνουν inject `upsertBoq`.

---

## 4. PRE-COMMIT GATES / ΠΑΓΙΔΕΣ
- **ADR-040 (CHECK 6B/6C/6D):** ΔΕΝ αγγίζεις canvas/renderer/orchestrator → **χωρίς ADR-040 staging**. (Ο host hook έχει zero high-freq subscriptions — κράτα το έτσι: ένας EventBus listener.)
- **N.6 enterprise-id:** το BOQ group id = `signatureGroupBoqId(floorplanId, sig)` (deterministic, υπάρχει) — **μην** φτιάξεις νέο id pattern.
- **CHECK 3.10 (firestore companyId):** κάθε νέο `query()`+`where()` ΠΡΕΠΕΙ να έχει `companyId` (το `fetchOpeningsForSignature` ήδη το έχει — αν προσθέσεις query, κράτα το).
- **CHECK 3.17 (entity-audit):** το `opening-boq-sync.ts` έχει σχόλιο (γρ. 118-122) για inlined `COLLECTIONS.BOQ_ITEMS` ώστε να μην false-positive-άρει ο scanner — **μην το σπάσεις** αν αγγίξεις το αρχείο.
- **N.7.1:** functions ≤40 γρ, αρχεία ≤500 (το family-type-side-effects.ts είναι ήδη ~297 γρ· το opening variant + helper μπορεί να το πάει κοντά — αν περάσει 500, split το opening σε δικό του module `opening-boq-side-effects.ts` και import).
- **tsc:** τα ΜΟΝΑ αναμενόμενα pre-existing errors άλλων agents: `mesh-to-object3d.ts(124)`, `DeleteEntityCommand.ts(54)` ('roof'), `drawing-preview-generator.ts(116)` ('floor-finish'), `apply-entity-preview.ts(316)`. Οτιδήποτε άλλο = δικό σου. **N.17: ΕΝΑ tsc τη φορά** (check `node.exe *tsc*` πρώτα, background run).
- **Verify:** `npx jest family-type-side-effects` + `npx jest opening-boq` (grouper + sync αν υπάρχει).

---

## 5. ΜΕΤΑ ΤΗΝ ΥΛΟΠΟΙΗΣΗ (N.0.1 PHASE 3 + N.15)
- Update **ADR-412 §3.5/Φ5** (opening cross-floor BOQ refeed DONE) **+ ADR-421 §changelog** (follow-up done) + **σβήσε** το item (b) από `.claude-rules/pending-ratchet-work.md` (μένει μόνο (a) wall→generic command migration).
- Update `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ADR-421 group) + memory `project_adr421_opening_types.md` + `MEMORY.md`.
- Ενημέρωσε το comment στο `family-type-side-effects.ts` γρ. 54-64 (το «documented follow-up» → DONE).
- **ΜΗΝ** adr-index. Commit = Giorgio.

---

## 6. ΠΛΗΡΕΣ CONTEXT — ΤΙ ΕΓΙΝΕ ΗΔΗ ΣΤΟ ADR-421 SLICE C (για να μην ψάχνεις)
SLICE A+B+C DONE (17 τύποι end-to-end + Revit Family/Type, ΜΗΔΕΝ fork στο generic ADR-412 framework). **Follow-ups ΗΔΗ DONE 2026-06-08 (Opus):**
1. **type-aware gating** — typed κούφωμα → ribbon Kind/Width/Height read-only (Revit-style)· `OPENING_TYPE_GOVERNED_COMBOBOX_KEYS` SSoT + `RibbonComboboxState.disabled` + defense-in-depth guard στο `useRibbonOpeningBridge`.
2. **auto-type-on-create/load** — `resolveAutoOpeningTypeId` wired σε `buildOpeningEntity` (create) + `openingDocToEntity` (load: `doc.typeId ?? auto`, legacy self-heal non-destructive). Πλήρης Revit «place→auto-type→edit via Type».

**Όλα 🔴 pending browser-verify + commit (Giorgio· κοινό tree).**

**Εναπομείναντα opening follow-ups (pending-ratchet) μετά από ΑΥΤΟ:**
- **(a) wall→generic command migration** (Boy-Scout· `UpdateWallFamilyTypeCommand`/`DeleteWallFamilyTypeCommand` → generic `UpdateFamilyTypeCommand`/`DeleteFamilyTypeCommand` που ήδη χρησιμοποιεί το opening· **blocked** ώσπου να γίνει verify/commit το wall family-type άλλου agent).

### Revit-true split (κλειδωμένο):
TYPE owns kind/width/height/frame/material/glazing/fireRating · INSTANCE owns wallId/offsetFromStart/sillHeight/handing/openDirection · operationType = derived.

### Μαθήματα (μην πατήσεις τις ίδιες νάρκες):
1. opening BOQ = **signature-group reads Firestore** → non-active floors = stale docs (το crux §2).
2. `floorplanId === level.sceneFileId` (μην ψάχνεις άλλο plumbing).
3. Reuse `upsertOpeningGroupForOpening` (Approach A) — μηδέν νέα BOQ logic· είναι ΗΔΗ το SSoT που τρέχει στο active floor.
4. `family-type-side-effects.ts` έχει ΗΔΗ `findOpeningsByTypeId` + τον λόγο deferral documented (γρ. 54-64).
