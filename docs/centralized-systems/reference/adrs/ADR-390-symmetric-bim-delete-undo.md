# ADR-390 — Symmetric BIM Entity Delete/Undo Persistence

| Πεδίο | Τιμή |
|---|---|
| **Status** | ✅ **DONE** 2026-05-27 — Phase 1-3 (delete→undo restore) · 🟢 **Phase 5 (2026-06-21, UNCOMMITTED) — CREATE-side symmetry: manual-draw/Ctrl-COPY create is now an undoable `CreateBimEntityCommand`** (πριν: bare `appendEntityToScene` → ο create ΕΚΤΟΣ undo history → Ctrl+Z δεν αφαιρούσε κολώνα/δοκάρι/πλάκα) |
| **Date** | 2026-05-27 |
| **Category** | DXF Viewer — Commands / Persistence / Audit Trail |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-390-symmetric-bim-delete-undo.md` |
| **Author** | Claude Opus 4.7 + Γιώργος Παγώνης |
| **Companions** | ADR-379 (BIM entity audit coverage), ADR-380 (stair + slab-opening audit), ADR-195 (Entity Audit Trail master), ADR-294 (SSoT Ratchet), ADR-363 (BIM Drawing Mode), ADR-358 (Stair persistence), ADR-381 (DXF Viewer duplication audit master) |
| **Plan file** | `~/.claude/plans/polymorphic-herding-lovelace.md` |
| **Industry alignment** | Revit (`UndoDelete` restores DB record + audit row), AutoCAD (`UNDO ERASE` restores entity + drawing-database write), ArchiCAD (Teamwork: `restored` audit action distinct από `created`) |

---

## Historical Note — commit-tag mismatch (ADR-381 vs ADR-390)

Πέντε commits (`f6d81500` → `4a927853`, all 2026-05-27) carry message tag **"ADR-381 Phase A"**:

| Commit | Subject |
|---|---|
| `f6d81500` | `feat(dxf): ADR-381 research + Phase A starter (slab)` |
| `6e6c3843` | `feat(dxf): ADR-381 Phase A column wiring + 6 audit-clients` |
| `b40a6607` | `feat(dxf): ADR-381 Phase A wall+beam+slab-opening wiring` |
| `9616cf44` | `feat(dxf): ADR-381 Phase A opening+stair (7/7 complete)` |
| `4a927853` | `chore(dxf): ADR-381 SceneEntity→AnySceneEntity cast fix` |

Όταν γράφτηκαν τα commits, υποτέθηκε ότι αυτή η εργασία θα γινόταν ADR-381. Διαπιστώθηκε αργότερα ότι **ADR-381 ήδη υπήρχε ως "DXF Viewer Subsystem Duplication Audit (Master)"** (research doc από ίδια ημερομηνία, παράλληλη συνεδρία) — naming collision αναπόφευκτη. Επιλέχθηκε **νέο ADR-390** για το symmetric delete/undo work γιατί:

1. **Single Responsibility**: 1 ADR = 1 architectural decision (industry standard). ADR-381 παραμένει master audit roadmap (ADR-382→389).
2. **Discoverability**: filename = topic (`ADR-390-symmetric-bim-delete-undo.md`) — grep `delete undo BIM` ευρίσκει directly.
3. **Safety**: ΟΧΙ rebase σε pushed commits (per CLAUDE.md N.(-1)). Commits παραμένουν historical artifact, traceable via αυτή την §Historical Note + git log keyword `Phase A`.

Tradeoff: future agent που grep-άρει "ADR-381 Phase A" θα βρει 5 commits αλλά καμία αναφορά στο ADR-381 master file — αυτή η ενότητα γεφυρώνει το gap.

---

## 1. Context — δύο bugs

### Bug A — Zombie write στο undo (data corruption)

Όταν ο user διαγράφει BIM entity (πχ slab) και πατάει Ctrl+Z, το entity ξαναγραφόταν στο Firestore με το **ίδιο UUID** + νέο audit row `action='created'`. Verified live 2026-05-27: `slab_b3f00d8c…` deleted @ ts X, re-created @ ts X+187s.

**Root cause:** `DeleteEntityCommand.undo()` αποκαθιστούσε μόνο το scene (`sceneManager.addEntity(snapshot)`) — δεν υπήρχε inverse Firestore restore. Ο auto-save effect (`useSlabPersistence:306-324` και αντίστοιχα στα 6 άλλα hooks) έβλεπε stale `lastSaved=undefined` (cleared by `deleteSlab`) → guard `if (lastSaved && dequal(...)) return` fails → debounced persist → zombie write με misleading `'created'` audit row.

### Bug B — Ghost render μετά από hard refresh

Ο user έβλεπε BIM entities στο canvas (wall/column/beam/slab-opening) που **δεν υπήρχαν** στις per-entity Firestore collections.

**Root cause:** BIM entities έχουν **dual persistence** — (a) per-entity collections (`floorplan_*`) μέσω `useXPersistence` hooks, και (b) full-scene JSON στο DXF document μέσω `DxfFirestoreService.autoSaveV2`. Σε hard refresh, scene loads από DXF JSON → BIM entities present in scene. Το subscribe-loop guard `neverSaved = !lastSavedParamsRef.current.has(id)` (Slab:240, Wall:231, Column:194, Beam:194, Opening:260, SlabOpening:192, Stair:244) επέστρεφε `true` για fresh `lastSavedParamsRef` Map μετά από refresh → entity kept in scene παρά την απουσία στο Firestore collection → ghost render.

### Industry alignment

| CAD App | Behavior σε undo of delete |
|---|---|
| Revit | `UndoDelete` restores DB record (ElementId reused) + `Edit_DocumentChange` log entry distinct από original `Create` |
| AutoCAD | `UNDO ERASE` restores entity in drawing database + audit row `action=RESTORED` (ENTERPRISE Civil 3D log) |
| ArchiCAD (Teamwork) | `restored` action emitted στο team log, distinct από `created` |
| Bentley MicroStation | Undo cache restores element header + writes audit χωρίς re-issuing GUID |

7/7 industry players → undo of delete restores **scene + DB + audit (`restored`, ΟΧΙ `created`)**. Pre-ADR-390 codebase είχε **accidental** zombie write — σωστό outcome για λάθος λόγο.

**Intended outcome:** Symmetric architecture όπου delete + undo επικοινωνούν εξπλίσιτα με persistence layer μέσω events. Audit trail αποτυπώνει `created → deleted → restored` (ΟΧΙ `created → deleted → created` που είναι ψέμα). Ghost render διορθώνεται μέσω σωστού "pending first save" tracking.

---

## 2. Architecture (event flow)

```
═══════════════════ DELETE (unchanged) ═══════════════════
  User: Del / toolbar
       ▼
  useSmartDelete.handleSmartDelete()
       ├── executeCommand(DeleteEntityCommand)
       │        └─► DeleteEntityCommand.execute()
       │                ├─ snapshot = deepClone(entity)
       │                └─ sceneManager.removeEntity(id)
       │
       └── eventBus.emit('bim:<type>-delete-requested', {id})
                ▼
         useXPersistence.deleteX()
                ├─ svc.deleteX(id)           ─► Firestore deleteDoc
                ├─ recordXChange('deleted')  ─► audit row
                ├─ lastSavedParamsRef.delete(id)
                ├─ dirtyIdsRef.delete(id)
                └─ deletedIdsRef.add(id)     ← tombstone (universal)

═══════════════════ UNDO (NEW — ADR-390) ═════════════════
  User: Ctrl+Z
       ▼
  CommandHistory.undo() → DeleteEntityCommand.undo()
       ├─ sceneManager.addEntity(snapshot)
       └─ EventBus.emit('bim:entity-restore-requested', {  ← NEW
              entityType, entitySnapshot, source: 'undo-delete'
          })
                ▼
         useXPersistence (type-matched listener via SSoT hook)
                ├─ if (payload.entityType !== <hookType>) return
                ├─ pendingFirstSaveIdsRef.add(id)   ← NEW
                ├─ deletedIdsRef.delete(id)
                └─ persistRestore(snapshot)
                       ├─ svc.saveX(input)         ─► Firestore setDoc
                       ├─ recordXChange('restored') ─► audit row (NEW action)
                       ├─ lastSavedParamsRef.set
                       └─ pendingFirstSaveIdsRef.delete
```

---

## 3. Key architectural decisions

### Decision 1 — Single generic event `bim:entity-restore-requested`

**ΟΧΙ** 7 specific events. Restore payload uniformly carries full snapshot — type-discriminated via `entityType` field. Future entity types (roof, ramp) register listener χωρίς EventBus.ts edit. Matches SSoT spirit (ADR-294).

```ts
// src/subapps/dxf-viewer/systems/events/EventBus.ts:214-222
'bim:entity-restore-requested': {
  entityType: 'wall' | 'opening' | 'slab' | 'slab-opening' | 'column' | 'beam' | 'stair';
  entitySnapshot: AnySceneEntity;
  source: 'undo-delete' | 'redo-restore';
};
```

### Decision 2 — Audit action `'restored'` (ΟΧΙ `'created' + metadata`)

- `'restored'` ήδη δηλωμένο στο `AuditAction` union (`src/types/audit-trail.ts:51`)
- UI rendering ήδη υπήρχε (`src/components/shared/audit/activity-tab-config.ts:69-74`, `RefreshCw` icon, success color, `audit.actions.restored` i18n key)
- Μόνο gap: missing από `VALID_ACTIONS` allowlist (`src/app/api/audit-trail/record/route.ts:38-42`) — one-line addition
- Semantic correctness: ξεκάθαρο trail `created → deleted → restored`

### Decision 3 — `pendingFirstSaveIdsRef` αντικαθιστά `neverSaved` guard

Νέο `useRef<Set<string>>(new Set())` σε κάθε hook. Populated σε `drawing:entity-created` AND `bim:entity-restore-requested`. Cleared σε persist success. Subscribe-loop guard γίνεται:

```ts
// pre-ADR-390 (Bug B):
const neverSaved = !lastSavedParamsRef.current.has(entity.id);
if (neverSaved) keep;  // ← ghost render — kept entities that never had Firestore doc

// post-ADR-390:
const pending = pendingFirstSaveIdsRef.current.has(entity.id);
if (pending) keep;  // ← μόνο in-flight first-saves bypass the drop
```

**Αποτέλεσμα:** entities loaded από DXF JSON που δεν είναι pending save AND λείπουν από Firestore → dropped → **Bug B fixed**.

### Decision 4 — Auto-save effect defense-in-depth (Bug A mitigation)

Στα 7 auto-save effects (Slab:306-324 κλπ), προσθήκη early-return:

```ts
const known = lastSavedParamsRef.current.has(entity.id);
const pending = pendingFirstSaveIdsRef.current.has(entity.id);
if (!known && !pending) return;
```

Δεν αυτο-persist-άρει entities από DXF JSON only. Belt-and-suspenders against Bug A — αν για κάποιο λόγο το restore event δεν έφτανε, ο auto-save δε θα έγραφε ζόμπι.

### Decision 5 — SSoT shared hook (`useBimEntityRestoredPersistEffect`)

Νέο hook mirror του υπάρχοντος `useBimEntityMovedPersistEffect.ts`. Κάθε persistence hook το καλεί με entity-type discriminator + persistRestore callback. Αποτρέπει 7-way copy-paste drift (industry standard SSoT pattern, ADR-294).

```ts
// src/subapps/dxf-viewer/hooks/data/useBimEntityRestoredPersistEffect.ts
export function useBimEntityRestoredPersistEffect<T extends AnySceneEntity, S>(
  entityType: BimRestoreEntityType,
  isEntityType: (e: AnySceneEntity) => e is T,
  serviceRef: MutableRefObject<S | null>,
  pendingFirstSaveIdsRef: MutableRefObject<Set<string>>,
  deletedIdsRef: MutableRefObject<Set<string>>,
  persistRestore: (entity: T) => Promise<void>,
): void;
```

---

## 4. File modifications

### NEW files (2)

1. `src/subapps/dxf-viewer/hooks/data/useBimEntityRestoredPersistEffect.ts` — SSoT bridge (~50 lines, mirror του existing `useBimEntityMovedPersistEffect`)
2. `docs/centralized-systems/reference/adrs/ADR-390-symmetric-bim-delete-undo.md` — αυτό το ADR

### MODIFIED — infrastructure (3)

| File | Change |
|---|---|
| `src/subapps/dxf-viewer/systems/events/EventBus.ts:214-222` | Add `'bim:entity-restore-requested'` event type |
| `src/subapps/dxf-viewer/core/commands/entity-commands/DeleteEntityCommand.ts` | `emitBimRestoreIfApplicable()` helper + invocation σε `DeleteEntityCommand.undo()` (line 79) + `DeleteMultipleEntitiesCommand.undo()` (line 190) |
| `src/app/api/audit-trail/record/route.ts:38-42` | Add `'restored'` στο `VALID_ACTIONS` allowlist |

### MODIFIED — audit clients (7)

Pattern: add `'restored'` σε local `XAuditAction` union. Στο `buildChanges()` switch, `'restored'` reuses `buildBimCreationChanges` (entity reappearing με full tracked fields). Καμία αλλαγή στο `src/config/audit-tracked-fields.ts`.

- `src/subapps/dxf-viewer/bim/walls/wall-audit-client.ts`
- `src/subapps/dxf-viewer/bim/columns/column-audit-client.ts`
- `src/subapps/dxf-viewer/bim/beams/beam-audit-client.ts`
- `src/subapps/dxf-viewer/bim/slabs/slab-audit-client.ts`
- `src/subapps/dxf-viewer/bim/slab-openings/slab-opening-audit-client.ts`
- `src/subapps/dxf-viewer/bim/stairs/stair-audit-client.ts`
- `src/subapps/dxf-viewer/bim/walls/opening-audit-client.ts` (note: opening lives under walls/ dir per ADR-363)

### MODIFIED — persistence hooks (7)

Per-hook delta (mechanical apply):

1. Add `pendingFirstSaveIdsRef = useRef<Set<string>>(new Set())` near άλλα refs
2. `drawing:entity-created` listener: `pendingFirstSaveIdsRef.current.add(entity.id)` πριν `persist()`
3. Subscribe loop: replace `neverSaved` με `pending` check
4. Add `deletedIdsRef = useRef<Set<string>>(new Set())` στα 5 hooks που δεν το είχαν (slab, slab-opening, column, beam, stair — wall + opening ήδη το είχαν)
5. `persist()` success: `pendingFirstSaveIdsRef.current.delete(entity.id)`
6. Auto-save effect early-return (Decision 4)
7. New `persistRestore(entity)` callback: `svc.saveX → recordXChange('restored') → lastSavedParamsRef.set → cleanup`
8. Invoke `useBimEntityRestoredPersistEffect(<type>, isXType, serviceRef, pendingFirstSaveIdsRef, deletedIdsRef, persistRestore)` next to existing `useBimEntityMovedPersistEffect` call
9. `deleteX()`: add `deletedIdsRef.current.add(id)` στα 5 hooks που το προσθέτουμε

Affected files:

- `src/subapps/dxf-viewer/hooks/data/useSlabPersistence.ts` — Phase 1 pilot
- `src/subapps/dxf-viewer/hooks/data/useWallPersistence.ts`
- `src/subapps/dxf-viewer/hooks/data/useColumnPersistence.ts`
- `src/subapps/dxf-viewer/hooks/data/useBeamPersistence.ts`
- `src/subapps/dxf-viewer/hooks/data/useSlabOpeningPersistence.ts`
- `src/subapps/dxf-viewer/hooks/data/useOpeningPersistence.ts`
- `src/subapps/dxf-viewer/bim/hooks/use-stair-persistence.ts`

**Total scope:** 2 NEW + 17 MODIFIED + 1 ADR doc.

---

## 5. Phasing & status

| Phase | Scope | Status | Commits |
|---|---|---|---|
| **Phase 1** | Event infra + Slab pilot (EventBus type + DeleteEntityCommand.undo + audit-route allowlist + new `useBimEntityRestoredPersistEffect` + full `useSlabPersistence` refactor) | ✅ DONE 2026-05-27 | `f6d81500` |
| **Phase 2** | Extend στα 6 remaining entities (mechanical apply του ίδιου delta σε wall, opening, slab-opening, column, beam, stair) | ✅ DONE 2026-05-27 | `6e6c3843`, `b40a6607`, `9616cf44`, `4a927853` |
| **Phase 3** | ADR doc + ΕΚΚΡΕΜΟΤΗΤΕΣ + adr-index + tests (`DeleteEntityCommand.undo` emit, multi-delete fan-out, integration roundtrip) | ✅ DONE 2026-05-27 | pending commit |
| **Phase 4** | Active-floor SSoT load: drop the snapshot's (derived-cache) BIM at load, repopulate from per-entity docs (preserve in-memory BIM). Save path unchanged (snapshot keeps BIM for multi-floor ADR-399). + param-edit persistence gap fix (`bim:beam/column-params-updated` → immediate persist). | ✅ DONE 2026-06-14 (active-floor portion) — UNCOMMITTED | pending |

---

## 6. Verification

### Manual (live Firestore) — recommended next session

1. Draw slab → check `floorplan_slabs/{id}` exists + audit row `'created'`.
2. Delete slab → Firestore doc gone, audit `'deleted'`.
3. **Ctrl+Z** → slab επανεμφανίζεται στο scene + Firestore doc πίσω (ίδιο UUID) + audit `'restored'` (ΟΧΙ δεύτερο `'created'`). **Bug A fixed.**
4. **Hard refresh test (Bug B):** Πριν refresh, manual delete του slab doc από Firestore console (όχι UI). Hard refresh → slab MUST NOT appear στο scene (loaded from DXF JSON αλλά Firestore SSoT λέει gone). **Bug B fixed.**
5. Multi-select delete (3 entities) + Ctrl+Z → all 3 restored + 3 audit `'restored'` rows.

### Firestore MCP queries

- `mcp__firestore__firestore_query` collection=`entity_audit_trail` filter `action='restored'` orderBy timestamp desc — επιβεβαίωση
- `mcp__firestore__firestore_count` σε όλα τα `floorplan_*` collections πριν/μετά each scenario

### Automated tests (Phase 3)

| File | Coverage |
|---|---|
| `DeleteEntityCommand.test.ts` | undo emits exactly 1 `bim:entity-restore-requested` με correct snapshot + type discriminator + source `'undo-delete'` |
| `DeleteMultipleEntitiesCommand.test.ts` | N BIM snapshots → N events (fan-out), non-BIM snapshots → 0 events |
| `useBimEntityRestoredPersistEffect.test.ts` | type-filter (wrong type = no-op), service-null guard, isEntityType guard, persistRestore invoke + tombstone clear + pending add |

### Static checks (per N.0.1 ADR-driven workflow)

- `npx tsc --noEmit` clean (verified Phase 1 + Phase 2)
- `npm run ssot:audit` — verify zero new violations
- `npm run audit-coverage:audit` — CHECK 3.17 baseline OK (restore counts as create σε coverage)
- Pre-commit hook PASS

---

## 7. Cross-references

- **ADR-195** (Audit Value Catalogs SSoT) — `'restored'` enum reuse, tracked-fields registries unchanged
- **ADR-294** (SSoT Ratchet) — single restore event + shared helper avoids 7-way drift; would otherwise have triggered `bim-audit-helpers` ratchet violation
- **ADR-363** (BIM Drawing Mode) — extends §5.10 persistence; all 7 hooks under this ADR
- **ADR-379** (BIM Audit Coverage Fix) — audit-client SSoT helpers (`buildBimCreationChanges` κλπ) reused unchanged για restore action
- **ADR-380** (Stair + Slab-Opening Audit Coverage) — same pattern extended σε `stair` + `slab-opening` audit clients
- **ADR-358** (Stair) — stair hook στο scope, inherits pattern
- **ADR-381** (DXF Viewer Duplication Audit Master) — naming-collision sibling (βλ. §Historical Note)
- **ADR-040** (Preview Canvas Performance) — Phase XXIII cross-ref για event scheduling

---

## 8. Migration & compatibility

- **No Firestore schema changes** — BIM entity docs + audit-trail collection unchanged
- **Historical audit data:** prior accidental `'deleted' → 'created'` pairs παραμένουν ως historical artifact. Acceptable — no migration script.
- **`'restored'` action validator:** flat allowlist addition, backwards-compatible. Existing audit consumers ήδη render `RefreshCw` icon για `restored` (`activity-tab-config.ts:69-74`).
- **Command serialization:** unchanged — new event emit είναι runtime side effect, δεν επηρεάζει replay/persistence format.
- **DXF JSON autoSaveV2:** **save path unchanged** — Phase 4 (2026-06-14) filters BIM **on LOAD of the active floor** (`scene-bim-load-policy.reconcileLoadedSceneBim`), not on save, so the snapshot still carries BIM for multi-floor 3D (ADR-399 `useFloors3DAggregator` reads other floors' BIM from their snapshots). Per-entity docs become authoritative for the active floor's render.

---

## 9. Changelog

| Date | Phase | Author | Notes |
|---|---|---|---|
| 2026-05-27 | Phase 1 | Opus 4.7 | EventBus type + DeleteEntityCommand.undo + audit-route allowlist + `useBimEntityRestoredPersistEffect` + slab pilot. TSC PASS. Commit `f6d81500` (mistagged "ADR-381 Phase A" — see §Historical Note). |
| 2026-05-27 | Phase 2 | Opus 4.7 | Mechanical apply σε column → wall+beam+slab-opening → opening+stair (4 commits). 6 audit-clients added `'restored'` action. 7/7 BIM entities covered. TSC PASS. Commits `6e6c3843`, `b40a6607`, `9616cf44`, `4a927853` (all mistagged). |
| 2026-05-27 | Phase 3 | Opus 4.7 | ADR-390 doc written + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` rebranded (ΑΥΖ → ADR-381 master only, ΑΥΗ → ADR-390 implementation) + adr-index entry + automated tests (DeleteEntityCommand, DeleteMultipleEntitiesCommand, useBimEntityRestoredPersistEffect). Pending commit. |
| 2026-06-14 | Phase 4 | Opus 4.8 | **Bug 1 (κολόνα κεκλιμένη) — active-floor SSoT load.** The `.scene.json` snapshot (derived cache) held STALE BIM (column `attached` while DB doc `storey-ceiling` → sloped top) and won at load. Fix: NEW `systems/levels/scene-bim-load-policy.ts` (`reconcileLoadedSceneBim` — drop snapshot BIM/stair, keep pure-DXF, preserve in-memory BIM) wired into `useLevelSceneLoader` apply. Save path untouched (multi-floor ADR-399 safe). 7 jest. **Robustness:** beam param-edit immediate-persist listeners (`bim:beam/column-params-updated`) + `persist-serializer` wired into `useBeamPersistence` (mirror column, N.0.2 — same-tick race). UNCOMMITTED. |
| 2026-06-21 | Phase 5 | Opus 4.8 | **CREATE-side symmetry (Giorgio bug: «δημιουργώ κολώνα → Ctrl+Z κάνει ΕΝΑ βήμα → η κολώνα μένει»).** ΡΙΖΑ: το manual-draw + Ctrl-COPY create πήγαινε μέσω `appendEntityToScene` που έκανε **bare `setLevelScene()`** (κανένα command) → ο create ΔΕΝ έμπαινε ποτέ στο `CommandHistory` → undo δεν τον αφαιρούσε. Το «ένα βήμα» = ο downstream auto-foundation reaction (`ApplyFoundationLayoutCommand`, το μόνο command). Αφορούσε column/beam/slab/foundation + όλους τους τύπους που περνούν από `appendEntityToScene` (όχι wall — δικό του trim-aware path). FIX (SSoT, Giorgio: «όλα τα BIM»): NEW `core/commands/entity-commands/CreateBimEntityCommand.ts` (generic, single-entity· execute/redo→`addEntity`+microtask `drawing:entity-created`· undo→`removeEntity`+microtask `bim:<type>-delete-requested`· deep-clone snapshot· microtask defer = mirror `CreateColumnsCommand`, ώστε το side-effect να τρέχει ΜΕΤΑ το `CommandHistory.execute` push → ο structural reaction κάνει `appendToLast` ΠΑΝΩ στον create → **ΕΝΑ Ctrl+Z αφαιρεί μέλος + auto-foundation, Revit-grade**). `appendEntityToScene` εκτελεί πλέον αυτό το command μέσω `getGlobalCommandHistory()` (LevelSceneManagerAdapter από τον accessor). + NEW SSoT `systems/events/bim-entity-lifecycle-events.ts` (`emitBimEntityCreated` + `emitBimEntityDeleteRequested`). **Full SSoT adoption (Giorgio audit, zero-repeat):** ΚΑΙ τα δύο lifecycle events ήταν copy-pasted σε ~11 σημεία — το delete-mapping (20-case switch) σε `emitBimDeleteEvents` (bulk smart-delete) + **8 batch/related commands** (`CreateColumns/Beams/Walls/Slabs/Foundations/MepSegments` + `MergeColumns` + `DeleteFoundations`), και το `drawing:entity-created` broadcast στα ίδια + `CreateBimEntityCommand`. ΟΛΑ delegate-άρουν πλέον στο ΕΝΑ lifecycle SSoT (μηδέν διπλότυπο· EventBus import αφαιρέθηκε από τα 8 commands εκτός Merge που κρατά το restore event). Bonus: η Ctrl-COPY undo διορθώθηκε κι αυτή. 28 jest νέα + regression GREEN (305/306· το 1 fail = `AssignWallTypeCommand`, pre-existing άλλου πράκτορα). ⚠️ shared tree: το reaction grouping (ADR-459) είναι domain άλλου πράκτορα — η αλλαγή είναι additive (δίνει `last` να γίνει group). UNCOMMITTED. 🔴 tsc (N.17) + browser-verify [κολώνα→Ctrl+Z αφαιρεί την κολώνα (+πέδιλο μαζί)· δοκάρι/πλάκα ίδιο· copy→undo] + commit. |
| 2026-06-14 | Phase 4 (Bug 2) | Opus 4.8 | **Bug 2 (δοκάρι «επιστρέφει» μισό-πλάτος στο reload) — ΑΛΗΘΙΝΗ ΑΙΤΙΑ via live Firestore+console diagnostics.** ΟΧΙ render bug: `moveBeam` (`bim/utils/bim-move-geometry.ts`, ADR-363 Φ7A) έβαζε `curveControl: undefined` σε ευθύγραμμο δοκάρι → **Firestore `updateDoc` ΑΠΟΡΡΙΠΤΕΙ explicit `undefined`** ("Unsupported field value: undefined") → η per-entity εγγραφή έσκαγε στο `catch` (σιωπηλά) σε ΚΑΘΕ straight-beam move → DB έμενε στην παλιά θέση. Fix: destructure-omit του `curveControl` από το spread, re-add ΜΟΝΟ όταν υπάρχει (curved). 3 jest [bim-move-geometry: straight no-key / scrub-stale-undefined / curved-shift]. **ΜΑΘΗΜΑ: silent `catch` σε persist έκρυψε το bug· Firestore updateDoc + `undefined` field = throw — ποτέ explicit `undefined` σε params.** Browser-verified (DB axis 3.7627, updatedAt>createdAt, μένει flush μετά hard-refresh). UNCOMMITTED. |
