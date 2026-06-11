# HANDOFF — ADR-441 Slice 3 (Follow-on-Move / Associative Grid Hosting)

**Date:** 2026-06-11 · **Branch:** main · **Shared working tree** (άλλος agent δουλεύει ταυτόχρονα στα accounting) · **Μοντέλο: Opus**

> 🎯 **ΕΝΤΟΛΗ GIORGIO:** «Να το κάνεις ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ, ΟΠΩΣ Η REVIT. ΥΛΟΠΟΙΗΣΗ ΜΕ ΣΥΣΤΗΜΑ — FULL ENTERPRISE + FULL SSOT.» **SEARCH FIRST.** Απάντα **ΕΛΛΗΝΙΚΑ**.
>
> ⚠️ **ΚΑΝΟΝΕΣ (απαράβατοι):** ΠΟΤΕ `git commit`/`push` — **ο Giorgio κάνει commit**. `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ `-A`** (shared tree). **N.17: ΕΝΑ tsc τη φορά** (έλεγξε ότι δεν τρέχει ήδη άλλος πριν ξεκινήσεις). Renderer/canvas/guide-render/scene-write touch → **stage ADR-040** (CHECK 6B/6D). N.6 enterprise-id για κάθε νέο doc. function ≤40γρ, file ≤500γρ, no `any`/`as any`, i18n ICU plurals (ΟΧΙ _one/_other).

---

## 0. ΔΙΑΒΑΣΕ ΠΡΩΤΑ (Recognition — N.0.1 Phase 1)
1. **`docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md`** — ΟΛΟ, ιδίως **§10 (Slice 3)** + changelog (τι έγινε Slice 0/1/2) + §8.8 (γιατί guides = structural grid).
2. **`ADR-040-preview-canvas-performance.md`** — ΥΠΟΧΡΕΩΤΙΚΟ. Ο reconciler γράφει στη σκηνή σε high-frequency (guide drag 60fps) → **imperative, RAF-throttled, ΟΧΙ React re-render**. Διάβασε τους cardinal rules (orchestrators ΜΗΝ `useSyncExternalStore`, leaves μόνο, bitmap-cache key).
3. **Αυτό το handoff** (§3 = το σχέδιο Slice 3· §2 = SSoT signatures που ΗΔΗ επιβεβαιώθηκαν).

---

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ (Slice 0 + 1 + 2 — DONE + COMMITTED)

**Αποφάσεις Giorgio (LOCKED):** (1) αφετηρία = associative grid hosting· (2) πηγή εσχάρας = ο κάναβος (grid)· (3) διακριτοί πεδιλοδοκοί + join· (4) ΟΧΙ συνδετήριες v1· grid = per-όροφο· scope = όλα τα slices 0→3, έγκριση ανά slice.

**Canonical hosting model (SSoT):** slot-based `GuideBinding { guideId, slot }` με `slot ∈ {start-x,start-y,end-x,end-y,center-x,center-y}`, στο `BimEntity.guideBindings?` (base, optional → backward-compatible). Αρχεία: `bim/hosting/guide-binding-types.ts` + `bim/types/guide-binding.schemas.ts`.

- **Slice 0 (hosting types) — DONE+committed** (`d069b7cf`): `GuideBinding`/`GuideBindingSlot`/`HostedEntityMixin` + `extractBoundGuideIds`/`hasGuideBindings`· `BimEntity.guideBindings?`· Zod (entity schemas `.passthrough()`).
- **Slice 1 (grid persistence per-όροφο) — DONE+DEPLOYED** (`123e70d8`, `88e8166a`): `floorplan_grid_guides` (1 doc/όροφο, `grd_*` enterprise-id)· `GridGuideFirestoreService`· `useGridGuidePersistence` (hydrate clear+restore· debounced 1000ms + anti-echo· per-floor reset)· `GridGuidePersistenceHost`. Rules+4 indexes **DEPLOYED pagonis-87766**.
- **Slice 2 (εσχάρα από κάναβο) — DONE+committed** (`ee8a20f9` feat + `f89124c4` i18n + `142c8d68`/`4133d213` tests):
  - NEW `bim/foundations/foundation-from-grid.ts` — `buildStripGridFromGuides(reader, overrides, levelId, sceneUnits)`: intersection-to-intersection segments (zero-overlap join), **born-hosted με guideBindings**, dedup, invisible-skip, `<2 άξονες/διεύθυνση → insufficient-guides`.
  - NEW `bim/foundations/foundation-grid-commit.ts` — orchestrator `commitFoundationGridFromGuides(deps)` → 1 atomic command.
  - NEW `core/commands/entity-commands/CreateFoundationsCommand.ts` — batch (mirror `CreateMepSegmentsCommand`: deferred-microtask `drawing:entity-created` apply / `bim:foundation-delete-requested` revert → persistence-correct create **και** undo).
  - MOD: `useRibbonFoundationBridge.onAction` (handleFromGrid) · `foundation-command-keys` (fromGrid) · `home-tab-draw` (ribbon subVariant «Εσχάρα από κάναβο» = `action`, ΟΧΙ tool) · `drawing-event-map` (`bim:foundations-from-grid`/`-failed`) · `useDxfViewerNotifications` (toast) · i18n el/en (`foundationGrid.*`, ICU plurals).
  - 16 jest PASS. tsc καθαρό. ΕΚΤΟΣ ADR-040.

**ΜΑΘΗΜΑΤΑ Slice 2 (μην τα ξανακάνεις λάθος):**
- ❌ `CreateEntityCommand` (sceneManager.addEntity) **δεν εκπέμπει `drawing:entity-created`** → strips ΔΕΝ persist-άρουν. ✅ Πρότυπο = `CreateMepSegmentsCommand` (deferred-microtask EventBus).
- ❌ Fake canvas tool για one-shot batch. ✅ Ribbon `action` button (mirror MEP auto-design bridges).

**Uncommitted αυτή τη στιγμή:** ΜΟΝΟ `ADR-441-...md` (doc, ο Giorgio commit). `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`=gitignored. MEMORY=εκτός repo.

---

## 2. SSoT ΠΟΥ ΥΠΑΡΧΟΥΝ — REUSE αυτούσια (signatures ΕΠΙΒΕΒΑΙΩΜΕΝΑ αυτή τη συνεδρία)

| Τι | Πού | Signature / σημείωση |
|---|---|---|
| **Hosting types** | `bim/hosting/guide-binding-types.ts` | `GuideBinding{guideId,slot}`, `GuideBindingSlot`, `extractBoundGuideIds(bindings)→string[]`, `hasGuideBindings(entity)` type-guard |
| **Guide store** | `systems/guides/guide-store.ts` | `getGlobalGuideStore()` singleton· `subscribe(listener)→unsub` (γρ.72)· `getVersion()` (γρ.88)· `getGuides()`/`getGuideById(id)`/`getGuidesByAxis(axis)`· **move paths: `moveGuideById(id,offset)` (γρ.222) + `moveDiagonalGuideById` (γρ.230) → `notify()`** (γρ.77, version++ + listeners). Όλα τα write ops καλούν `notify()`. |
| **Guide shape** | `systems/guides/guide-types.ts` | `Guide{id, axis:'X'\|'Y'\|'XZ', offset:number, visible, locked, startPoint?, endPoint?}`. **axis 'X' = κατακόρυφη → offset = x· axis 'Y' = οριζόντια → offset = y.** XZ διαγώνια. |
| **Foundation params** | `bim/types/foundation-types.ts` | strip/tie-beam: `{kind, start:Point3D, end:Point3D, width, thicknessMm, topElevationMm, sceneUnits}`· pad: `{kind, position:Point3D, width, length, rotation, anchor, profile,...}`. Discriminated union by `kind`. |
| **Geometry re-derive** | `bim/geometry/foundation-geometry.ts` | `computeFoundationGeometry(params)` — **pure**, strip/tie-beam = `buildBandFootprint` band start→end×width. Re-derive geometry όταν αλλάζουν τα params. |
| **Entity factory** | `@/services/factories/foundation.factory` | `createFoundation({id?, params, geometry, layerId, visible, validation})` — IFC mixin auto. |
| **Validator** | `bim/validators/foundation-validator` | `validateFoundationParams(params)→{hardErrors, bimValidation}` |
| **Scene write (imperative)** | `systems/entity-creation/LevelSceneManagerAdapter.ts` | `addEntity/removeEntity/updateEntity(id,partial)/**updateEntities(Map<id,partial>)** (batch, 1 commitScene)`. Pending-scene cache για batch mutations στο ίδιο sync tick. |
| **Foundation persistence** | `hooks/data/useFoundationPersistence.ts` | subscribe+diff-merge+dirty· **persist μόνο σε `primarySelectedFoundation` params change**· `useBimEntityMovedPersistEffect(isFoundation, serviceRef, dirtyIdsRef, persist)` ακούει **`bim:entities-moved`** → persist ΟΛΕΣ τις moved (non-selected) entities. |
| **Foundation Firestore** | `bim/foundations/foundation-firestore-service.ts` | `FoundationDoc`, `entityToSaveInput(entity)`, `docToEntity` (στο persistence hook). **⚠️ ΣΗΜΕΡΑ ΔΕΝ persist-άρει `guideBindings`** → δες §3.4. |
| **Moved-entities persist event** | `systems/events/drawing-event-map.ts` | `'bim:entities-moved': { movedEntities: ReadonlyArray<AnySceneEntity> }` — carries post-move entities directly (stale-state guard). Reuse για persist μετά το follow-move. |
| **RAF scheduler** | `rendering/core/UnifiedFrameScheduler.ts` | RAF orchestrator (ADR-040)· πρότυπο throttle 1×/frame. |
| **Level manager** | `systems/levels` (`useLevels`) | `getLevelScene(levelId)/setLevelScene(levelId,scene)/currentLevelId`. Imperative scene write path (ADR-040). |

---

## 3. SLICE 3 — FOLLOW-ON-MOVE (το «move-no-break» payoff)

**Στόχος (Revit/Tekla/ProtaStructure):** μετακινείς άξονα κανάβου → **όλα τα hosted στοιχεία ακολουθούν αυτόματα**, live (60fps drag) + persist on drag-complete. Τα strips του Slice 2 είναι ΗΔΗ born-hosted με `guideBindings` → έχουν την πληροφορία· λείπει ο μηχανισμός που τα re-derives όταν αλλάζει ο άξονας.

### 3.1 ΑΡΧΙΤΕΚΤΟΝΙΚΗ (4 κομμάτια, pure-first)

1. **NEW `bim/hosting/derive-params-from-guides.ts`** — pure per-kind strategy registry.
   - `deriveHostedParams(entity, guideOffsetById: (id)=>number|undefined): params | null`
   - Για κάθε binding: γράψε το αντίστοιχο coordinate από το **τρέχον** guide offset:
     `start-x→params.start.x`, `start-y→params.start.y`, `end-x→params.end.x`, `end-y→params.end.y`, `center-x→params.position.x`, `center-y→params.position.y`.
   - Επιστρέφει νέα `params` (immutable) **ΜΟΝΟ αν άλλαξε** κάτι (αλλιώς null → skip write). Idempotent: re-derive με ίδια offsets = ίδια params.
   - **ΟΧΙ kind-specific math εδώ** — μόνο coordinate-slot writes. Η γεωμετρία βγαίνει από `computeFoundationGeometry` (SSoT).

2. **NEW `bim/hosting/guide-hosting-reconciler.ts`** — pure reconciler.
   - **Inverted index** `Map<guideId, Set<entityId>>` — rebuild **ΜΟΝΟ on scene add/remove** (ΟΧΙ κάθε guide move). Helper `buildHostingIndex(entities)`.
   - `reconcile(entities, guideOffsetById)` → λίστα `{id, nextParams, nextGeometry}` updates **ΜΟΝΟ για όσα άλλαξαν** (μέσω `deriveHostedParams` + `computeFoundationGeometry`). Pure — μηδέν side-effects.

3. **NEW `bim/hosting/HostingReconcilerSubscriber.ts`** (ή hook `useHostingReconciler`) — **το ΜΟΝΟ stateful κομμάτι· ADR-040.**
   - `getGlobalGuideStore().subscribe(...)` → **RAF-throttled 1×/frame** (coalesce 60fps drag· πρότυπο `UnifiedFrameScheduler`).
   - On tick: διάβασε current guide offsets → `reconcile(scene.entities, ...)` → αν updates>0 → **imperative `LevelManager.setLevelScene`** (μέσω `updateEntities` batch· **ΟΧΙ React re-render**, ΟΧΙ `useSyncExternalStore` σε orchestrator).
   - **Loop guard:** το setLevelScene ΔΕΝ πρέπει να ξανα-trigger-άρει τον reconciler ατέρμονα. Ο reconciler ακούει το **guide-store** (όχι το scene), οπότε scene write δεν re-fires· αλλά πρόσεξε version/echo.

4. **Persist on drag-complete (ΟΧΙ 60fps):**
   - MOD το σημείο που ολοκληρώνεται το guide drag — **επιβεβαίωσε** ποιο: handoff draft έλεγε `hooks/canvas/useCanvasContainerHandlers.ts`· **SEARCH FIRST** ποιος καλεί `moveGuideById` σε pointer-up (guide drag commit). Εκεί → μετά τον τελικό reconcile → `EventBus.emit('bim:entities-moved', { movedEntities })` με τις affected hosted entities → ο **υπάρχων** `useBimEntityMovedPersistEffect` (ADR-436) τις persist-άρει (non-selected included). **Μην φτιάξεις νέο persist path αν το `bim:entities-moved` καλύπτει.**

### 3.2 PERSIST guideBindings (ΚΡΙΣΙΜΟ — αλλιώς χάνεται το hosting σε reload)
Σήμερα `entityToSaveInput`/`docToEntity` (`foundation-firestore-service.ts` + `useFoundationPersistence`) **ΔΕΝ** περιλαμβάνουν `guideBindings`. Αποτέλεσμα: reload → strips επανέρχονται **χωρίς bindings** → follow-on-move νεκρό μετά refresh.
- MOD `FoundationDoc` (+`guideBindings?`) + `entityToSaveInput` (persist) + `docToEntity` (restore). Firestore-safe serialization (readonly array of `{guideId,slot}` — plain objects, OK). **Rules/indexes: ΚΑΝΕΝΑ νέο** (το `guideBindings` είναι nested field στο υπάρχον foundation doc· δες αν τα rules επιτρέπουν το πεδίο — πιθανόν `.passthrough()`-style ή allowlist· **έλεγξε firestore.rules foundation match block**).

### 3.3 ΣΕΙΡΑ ΥΛΟΠΟΙΗΣΗΣ (incremental, test ανά βήμα)
1. `derive-params-from-guides.ts` + tests (slot→coordinate, idempotent, no-change→null, pad center).
2. `guide-hosting-reconciler.ts` + tests (inverted index build, reconcile returns only-changed, multi-entity per guide).
3. persist guideBindings (FoundationDoc round-trip test: entityToSaveInput→docToEntity preserves bindings).
4. `HostingReconcilerSubscriber` + mount (stage ADR-040· integration: move guide → entity params updated imperatively).
5. drag-complete → `bim:entities-moved` persist wiring.

### 3.4 ΡΙΣΚΑ (ΕΛΕΓΞΕ ΠΡΩΤΑ)
1. **ADR-040 performance:** reconciler τρέχει σε guide drag (60fps). Πρέπει RAF-coalesced + only-changed writes + zero React re-render στους orchestrators. Λάθος εδώ = FPS drop. **Stage ADR-040, CHECK 6B/6D.**
2. **Loop / echo:** scene write → μην re-trigger guide notify. Reconciler ακούει guide-store ΜΟΝΟ.
3. **Index staleness:** inverted index rebuild on scene add/remove — όχι σε κάθε move. Πρόσεξε πότε αλλάζει το entity set (Slice 2 batch create, delete, undo).
4. **Persist storm:** persist ΜΟΝΟ on drag-complete (pointer-up), ΟΧΙ ανά frame. Reuse `bim:entities-moved` + grace-period guard (`useBimFirestoreWriteGrace`).
5. **Subscriber lifecycle:** mount once (όπως `GridGuidePersistenceHost`/persistence hosts), per active level. Unsubscribe on unmount.
6. **Diagonal/XZ guides:** v1 αγνόησε (τα strips από Slice 2 δεν δένονται σε XZ).

### 3.5 TESTS (Google presubmit)
- `derive-params-from-guides.test.ts`: κάθε slot → σωστό coordinate· no-op όταν ίδια offsets· pad center-x/y.
- `guide-hosting-reconciler.test.ts`: inverted index· reconcile only-changed· N entities ανά guide.
- `foundation-firestore-service` round-trip: guideBindings persist+restore.
- (integration αν εφικτό) move guide → affected entity params change, non-affected αμετάβλητα.

---

## 4. ΚΑΝΟΝΕΣ / WORKING TREE
- **Δικά σου (Slice 3, ο Giorgio commit):** `bim/hosting/derive-params-from-guides.ts`, `bim/hosting/guide-hosting-reconciler.ts`, `bim/hosting/HostingReconcilerSubscriber.ts` (+__tests__), MOD `bim/foundations/foundation-firestore-service.ts` + `hooks/data/useFoundationPersistence.ts` (docToEntity bindings) + το guide-drag-complete αρχείο + (αν χρειαστεί) mount host + ADR-441 doc. **Stage ADR-040** όπου αγγίζεις scene-write/canvas.
- **ΑΛΛΟΥ agent (ΜΗΝ αγγίξεις):** `src/subapps/accounting/*`. **ΠΟΤΕ `git add -A`.**
- N.17: ΕΝΑ tsc τη φορά (έλεγξε process πρώτα: `Get-CimInstance Win32_Process ... *tsc*`).
- N.15 docs: ADR-441 changelog+§10 (Slice 3 DONE) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY. **ΜΗΝ** adr-index (shared tree).

## 5. QUICK START
1. Recognition: ADR-441 §10 + ADR-040 cardinal rules + §2 αυτού του handoff (signatures).
2. `git status` (Slice 0/1/2 committed· ADR-441 doc ίσως uncommitted).
3. **SEARCH FIRST** ποιος καλεί `moveGuideById` σε pointer-up (guide drag commit) — αυτό είναι το persist hook point (§3.1.4).
4. Υλοποίησε §3.3 incremental (pure→reconciler→persist bindings→subscriber→drag-persist), test ανά βήμα.
5. Stage ADR-040 όπου αγγίζεις scene-write. ΜΗΝ commit/push.
