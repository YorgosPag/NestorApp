# HANDOFF — ADR-441 Slice 2 (Εσχάρα πεδιλοδοκών από κάναβο) + Slice 3 (follow-on-move)

**Date:** 2026-06-11 · **Branch:** main · **Shared working tree** (άλλος agent δουλεύει ταυτόχρονα) · **Μοντέλο: Opus**

> 🎯 **ΕΝΤΟΛΗ GIORGIO:** «Να το κάνεις ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ, ΟΠΩΣ Η REVIT. ΥΛΟΠΟΙΗΣΗ ΜΕ ΣΥΣΤΗΜΑ — FULL ENTERPRISE + FULL SSOT.» **SEARCH FIRST.** Απάντα **ΕΛΛΗΝΙΚΑ**.
>
> ⚠️ **ΚΑΝΟΝΕΣ (απαράβατοι):** ΠΟΤΕ `git commit`/`push` — **ο Giorgio κάνει commit**. `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ `-A`** (shared tree). N.17: ΕΝΑ tsc τη φορά (έλεγξε για άλλον πρώτα). Renderer/canvas/preview/guide-render touch → stage **ADR-040** (CHECK 6B/6D). N.6 enterprise-id για κάθε νέο doc. function ≤40γρ, file ≤500γρ, no `any`/`as any`, i18n keys (ΟΧΙ hardcoded· ICU plurals ΟΧΙ _one/_other).

---

## 0. ΔΙΑΒΑΣΕ ΠΡΩΤΑ
- **`docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md`** — ΟΛΟ, ιδίως **§10 σχέδιο 4 slices + canonical hosting model** + changelog (τι έγινε σε Slice 0/1).
- **`ADR-436-bim-foundation-discipline.md`** — foundation data model/geometry/tools (pad/strip/tie-beam).
- **`ADR-189-construction-grid-guide-system.md`** — το σύστημα κανάβου/guides.
- Πλήρες σχέδιο: αυτό το handoff (§3 Slice 2 = το επόμενο βήμα).

---

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ (Slice 0 + Slice 1 — DONE, εκκρεμεί ΜΟΝΟ commit από Giorgio)

**Αποφάσεις Giorgio (LOCKED):** (1) αφετηρία = associative grid hosting· (2) πηγή εσχάρας = **ο κάναβος (grid)**· (3) **διακριτοί πεδιλοδοκοί + join**· (4) **ΟΧΙ** συνδετήριες v1· grid = **per-όροφο** (Revit-grade)· scope = όλα τα slices 0→3, έγκριση ανά slice.

**Canonical hosting model (SSoT, generic — ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΟ):** slot-based `GuideBinding { guideId, slot }` με `slot ∈ {start-x,start-y,end-x,end-y,center-x,center-y}`, στο `BimEntity.guideBindings?` (base). Αρχείο: `src/subapps/dxf-viewer/bim/hosting/guide-binding-types.ts` (+ `extractBoundGuideIds`/`hasGuideBindings`). Zod: `bim/types/guide-binding.schemas.ts`.

**Slice 0 (hosting types) — DONE:** NEW `bim/hosting/guide-binding-types.ts` + `bim/types/guide-binding.schemas.ts`· MOD `bim/types/bim-base.ts` (`BimEntity.guideBindings?`) + `foundation.schemas.ts`. Backward-compat (entity schemas `.passthrough()`). 11 jest + 383 regression.

**Slice 1 (grid persistence per-όροφο) — DONE + ΗΔΗ DEPLOYED στο pagonis-87766:**
- NEW `systems/guides/guide-persistence-types.ts` (`GridGuideDoc`/`GuideSnapshot` + `guideToSnapshot`/`guidesToSnapshots`/`snapshotToGuide`· strips temporary + undefined keys = Firestore-safe).
- NEW `systems/guides/guide-firestore-service.ts` (`GridGuideFirestoreService` createGrid/updateGrid/subscribeGrid· **1 doc/όροφο** `floorplan_grid_guides`).
- NEW `hooks/data/useGridGuidePersistence.ts` (hydrate `clear`+`restoreGroup`/`restoreGuide`· debounced 1000ms save + **anti-echo signature guard**· **per-floor reset** `store.clear()` on scope change).
- NEW `app/GridGuidePersistenceHost.tsx` (null-render) + MOD `DxfViewerTopBar.tsx` (mount).
- MOD enterprise-id `GRID_GUIDE:'grd'` + `generateGridGuideDocId` (3 αρχεία)· `firestore-collections.ts` (FLOORPLAN_GRID_GUIDES + FLOOR_SCOPED_BIM_COLLECTIONS)· `firestore.rules` (match block) · `firestore.indexes.json` (4 composite).
- 14 jest PASS (σύνολο Slice 0+1 = 25). tsc καθαρό στα δικά μου αρχεία (exit 0).
- **Rules + indexes ΗΔΗ deployed** — ΜΗΝ ξανα-deploy εκτός αν αλλάξεις rules/indexes.

**Γνωστός περιορισμός v1:** undo guide-move μετά εναλλαγή ορόφου = no-op (store cleared)· δεν καθαρίζεται το global command history (shared, αποφυγή side-effects).

---

## 2. ΦΙΛΟΣΟΦΙΑ — ΓΙΑΤΙ ΤΑ STRIPS ΓΕΝΝΙΟΥΝΤΑΙ «HOSTED» (Revit way)

Στη Revit/Tekla/ProtaStructure ο κάναβος = SSoT· τα στοιχεία είναι **constrained** σε αυτόν. Άρα στο Slice 2 **κάθε strip πρέπει να γεννηθεί με `guideBindings`** (slot-based), ώστε στο Slice 3 (follow-on-move) όταν μετακινείς άξονα → τα strips ακολουθούν αυτόματα. **ΜΗΝ** φτιάξεις «ελεύθερα» strips χωρίς bindings — χάνεται όλο το νόημα του grid-first.

---

## 3. SLICE 2 — ΕΣΧΑΡΑ ΠΕΔΙΛΟΔΟΚΩΝ ΑΠΟ GRID (ΤΟ ΕΠΟΜΕΝΟ ΒΗΜΑ· 1ο ΟΡΑΤΟ ΑΠΟΤΕΛΕΣΜΑ)

**Στόχος:** ribbon button «Εσχάρα από κάναβο» → one-shot batch → strips στις γραμμές/τομές του υπάρχοντος κανάβου, **διακριτά** `FoundationEntity` (kind='strip'), join στις διασταυρώσεις, **1 undo**, born-hosted με `guideBindings`.

### 3.1 SSoT που ΥΠΑΡΧΟΥΝ — REUSE αυτούσια (SEARCH FIRST, ΜΗΝ ξαναγράψεις)
| Τι | Πού | Signature |
|---|---|---|
| **Strip builder** | `hooks/drawing/foundation-completion.ts` | `completeFoundationFromTwoClicks(start:Point2D, end:Point2D, layerId:string, kind:'strip', overrides:{width?:mm, thicknessMm?:mm}, sceneUnits): BuildFoundationEntityResult` |
| Default params | `hooks/drawing/foundation-completion.ts` | `buildDefaultFoundationParams` (πάρε default width/thickness — εικόνα Giorgio ~1000mm×500mm) |
| Geometry (band) | `bim/geometry/foundation-geometry.ts` | `computeFoundationGeometry`, `buildBandFootprint` |
| Strip-από-1-τοίχο (πρότυπο) | `bim/foundations/foundation-from-wall.ts` | `buildStripFromWall` |
| **Batch pattern** | `hooks/drawing/use-wall-commit.ts` | `buildFillingWalls` (loop → onCreated ένα-ένα → EventBus toast) |
| Add to scene | `bim/foundations/add-foundation-to-scene.ts` | `addFoundationToScene(entity, accessor)` → `appendEntityToScene` + `EventBus 'drawing:entity-created' {entity,tool:'foundation'}` (ΕΝΕΡΓΟΠΟΙΕΙ persistence ADR-436) |
| **Atomic undo** | `core/commands/CompoundCommand.ts` | `new CompoundCommand(name, commands[])` + `.add(cmd)` → `.execute()`/`.undo()` |
| Guide lines | `systems/guides/guide-store.ts` | `getGlobalGuideStore().getGuidesByAxis('X'/'Y'/'XZ')` → `Guide[]` (`.id`, `.offset`, `.visible`, `.locked`) |
| safeUnion (BOQ) | `bim/geometry/shared/safe-polygon-boolean.ts` | `safeUnion` (offline area, ΟΧΙ στο commit path) |
| Hosting types | `bim/hosting/guide-binding-types.ts` | `GuideBinding`, `GuideBindingSlot` |

### 3.2 ΑΛΓΟΡΙΘΜΟΣ — NEW `bim/foundations/foundation-from-grid.ts`
`buildStripGridFromGuides(store: GuideStore, overrides: FoundationParamOverrides, levelId: string, sceneUnits: SceneUnits): BuildGridResult`
1. `xGuides = store.getGuidesByAxis('X').filter(g=>g.visible)` (offset = x). Όμοια `yGuides` ('Y', offset = y). **XZ διαγώνια → αγνοούνται v1.**
2. Sorted **unique** offsets + παράλληλο array των guide ids (κάθε `xOffsets[i]` ↔ `xGuides[i].id`). Dedup offsets που απέχουν < `GRID_DEDUP_TOL` (≈1mm) → αποφυγή zero-length.
3. **Edge:** `xOffsets.length < 2 || yOffsets.length < 2` → `{ ok:false, reason:'insufficient-guides', strips:[], ignoredCount:0 }` (UI toast, ΟΧΙ throw).
4. **Intersection-to-intersection segments (ΚΛΕΙΔΙ για zero-overlap join):**
   - Για κάθε X-guide στο `xOff` (id=`xId`): για `i in [0..yOffsets.length-2]`:
     `start={x:xOff,y:yOffsets[i]}`, `end={x:xOff,y:yOffsets[i+1]}`.
     **guideBindings** = `[{xId,'start-x'},{xId,'end-x'},{yIds[i],'start-y'},{yIds[i+1],'end-y'}]`.
   - Για κάθε Y-guide στο `yOff` (id=`yId`): για `i in [0..xOffsets.length-2]`:
     `start={x:xOffsets[i],y:yOff}`, `end={x:xOffsets[i+1],y:yOff}`.
     **guideBindings** = `[{yId,'start-y'},{yId,'end-y'},{xIds[i],'start-x'},{xIds[i+1],'end-x'}]`.
   - Σύνολο = `nX*(nY-1) + nY*(nX-1)` strips (3×3 → 12).
5. Κάθε segment → `completeFoundationFromTwoClicks(start,end,levelId,'strip',overrides,sceneUnits)`. Αν `ok` → πρόσθεσε **τα guideBindings στο entity** (`{...entity, guideBindings}`) → push. Αν `!ok` → `ignoredCount++`.
6. Return `{ ok:true, strips, ignoredCount }`.
**Edge cases:** invisible guides φιλτράρονται· locked guides ΣΥΜΠΕΡΙΛΑΜΒΑΝΟΝΤΑΙ (ορατός κάναβος)· διπλά offsets → dedup· re-run → duplicates (v1 δεν εμποδίζει· DEFER spatial guard).

### 3.3 BATCH COMMIT — NEW `hooks/drawing/use-foundation-grid-commit.ts`
Πρότυπο `use-wall-commit.ts`. `commitGridFromGuides()`:
1. `buildStripGridFromGuides(...)`. Αν `!ok` → `EventBus.emit('bim:foundation-grid-failed',{reason})` → return.
2. `CompoundCommand('Εσχάρα πεδιλοδοκών')` με ένα **CreateEntityCommand** (ή ισοδύναμο που καλεί `addFoundationToScene`) ανά strip → `getGlobalCommandHistory().execute(compound)` (**ΕΛΕΓΞΕ** πώς τα draw commands παίρνουν `sceneManager`/accessor — ρίσκο, δες §3.6).
3. `EventBus.emit('bim:foundations-from-grid',{built, ignored})`.
**ΠΡΟΣΟΧΗ:** κάθε strip πρέπει να φτάσει στο persistence (Slice 1-persist ADR-436 ακούει `drawing:entity-created` με tool='foundation'). Βεβαιώσου ότι το create path εκπέμπει αυτό το event (μέσω `addFoundationToScene`).

### 3.4 TOOL + RIBBON (one-shot, ΟΧΙ canvas click)
- MOD `hooks/drawing/useFoundationTool.ts` — `FoundationPlacementMode + 'from-grid'`· `onCanvasClick` guard (return false, καμία canvas αλληλεπίδραση).
- MOD `hooks/tools/useSpecialTools.ts` — on `activeTool==='foundation-strip-from-grid'` → `commitGridFromGuides()` + revert σε `select`.
- MOD `ui/toolbar/types.ts` (`ToolType + 'foundation-strip-from-grid'`), `systems/tools/tool-definitions.ts` (`requiresCanvas:false`), `ui/ribbon/data/home-tab-draw.ts` (subVariant στο `draw.bim.foundationGroup`).
- MOD `systems/events/drawing-event-map.ts` (`'bim:foundations-from-grid':{built:number;ignored:number}`) + `useDxfViewerNotifications.ts` (toast, πρότυπο `bim:walls-from-perimeter`).
- i18n: `src/i18n/locales/el|en/dxf-viewer-shell.json` — ribbon label/tooltip + status + notification (ICU `{count, plural, one{...} other{...}}`).

### 3.5 TESTS (πρότυπο foundation suites)
- NEW `foundation-from-grid.test.ts`: σωστός αριθμός segments N×M, clip/dedup, edge (<2 guides), **guideBindings tagging** (slots σωστά ανά X/Y strip), invisible-skip.
- NEW `use-foundation-grid-commit.test.ts`: batch → CompoundCommand, undo αναιρεί όλα, EventBus emit, ignored count.

### 3.6 ΡΙΣΚΑ Slice 2 (ΕΛΕΓΞΕ ΠΡΩΤΑ)
1. **CreateEntityCommand ↔ sceneManager:** το `use-foundation-grid-commit` χρειάζεται πρόσβαση σε scene accessor/sceneManager. Δες πώς το παίρνουν τα υπάρχοντα draw commands (π.χ. `canvas-mouse-drag-handlers` / `useSpecialTools` context). ΜΗΝ ανακτάς singleton inline — πέρνα το ως arg (testable).
2. **BOQ overlap:** naive Σ(volume) υπερεκτιμά στις διασταυρώσεις (width²·thickness ανά κόμβο) → BOQ layer = `safeUnion` offline (τεκμηρίωσέ το στο ADR-436). ΜΗΝ merge-άρεις entities.
3. **ADR-040:** generation = one-shot batch (ΧΩΡΙΣ preview store) → κατ' αρχήν **δεν** χρειάζεται ADR-040 staging. ΑΛΛΑ αν αγγίξεις renderer/canvas/guide-render → stage ADR-040 (CHECK 6B/6D).
4. **Large grid:** 20×20 ≈ 760 strips synchronous (v1 αποδεκτό· DEFER idle-batch).

---

## 4. SLICE 3 — FOLLOW-ON-MOVE (μετά το Slice 2· το «move-no-break» payoff)
- NEW `bim/hosting/derive-params-from-guides.ts` (per-kind strategy registry) + `bim/foundations/foundation-guide-strategy.ts` (register strip/tie-beam/pad: start/end/center.x/y ← bound guide offset → `computeFoundationGeometry`).
- NEW `bim/hosting/guide-hosting-reconciler.ts` (pure· **inverted index** `Map<guideId,Set<entityId>>` rebuild μόνο on scene add/remove) + `bim/hosting/HostingReconcilerSubscriber.ts` (`getGlobalGuideStore().subscribe` **RAF-throttled** 1×/frame· imperative `LevelManager.setLevelScene` — ADR-040).
- MOD `hooks/canvas/useCanvasContainerHandlers.ts` — emit `grid:guide-moved` on drag-complete → persist affected (Slice 1 hook).
- MOD `bim/foundations/foundation-firestore-service.ts` (`FoundationDoc + guideBindings`) + `entityToSaveInput`/`docToEntity` (persist/restore bindings).
- **Hook point ΕΠΙΒΕΒΑΙΩΜΕΝΟ:** `guide-store.ts` `moveGuideById`(γρ.226)/`moveDiagonalGuideById`(γρ.236) → `notify()`· `subscribe()`(72)+`getVersion()`(88) καλύπτουν ΟΛΑ τα move paths (drag 60fps, command, AI). **Stage ADR-040** (CHECK 6B/6D).

---

## 5. ΕΚΚΡΕΜΕΙ ΑΝΕΞΑΡΤΗΤΑ (προηγ. session — δικά μου αρχεία, ο Giorgio commit)
**§5(Β) Location Line = Finish Face ίσιου τοίχου** — DONE, εκκρεμεί browser-verify + commit:
- MOD `hooks/drawing/wall-completion.ts` (NEW `defaultEdgeAlignmentPoint`), `wall-preview-helpers.ts`, `use-wall-tool-event-listeners.ts` + ADR-363. ΑΣΧΕΤΟ με ADR-441 — δικό του commit.

---

## 6. ΚΑΤΑΣΤΑΣΗ WORKING TREE (ο Giorgio κάνει commit)
- **Δικά μου, uncommitted (ADR-441 Slice 0+1):** `bim/hosting/` (+__tests__), `bim/types/guide-binding.schemas.ts`, `bim/types/bim-base.ts`(M), `bim/types/foundation.schemas.ts`(M), `systems/guides/guide-persistence-types.ts`, `systems/guides/guide-firestore-service.ts`, `systems/guides/__tests__/guide-{persistence-types,firestore-service}.test.ts`, `hooks/data/useGridGuidePersistence.ts`, `app/GridGuidePersistenceHost.tsx`, `app/DxfViewerTopBar.tsx`(M), `services/enterprise-id-{prefixes,class,convenience}.ts`(M), `config/firestore-collections.ts`(M), `firestore.rules`(M), `firestore.indexes.json`(M), `docs/.../ADR-441-...md`(M). Επίσης `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`(M).
- **ΑΛΛΟΥ agent (ΜΗΝ αγγίξεις):** `src/subapps/accounting/*`, ADR-440. **ΠΟΤΕ `git add -A`.**
- **Wall files (§5Β):** ξεχωριστό commit.

---

## 7. QUICK START (νέα session)
1. Διάβασε ADR-441 (§10 + changelog) + ADR-436 + αυτό το handoff (§3 = το επόμενο βήμα).
2. **Επιβεβαίωσε state:** `git status` (τα Slice 0+1 αρχεία πρέπει να είναι εκεί ή ήδη committed από Giorgio). Slice 0+1 = DONE, deployed.
3. SEARCH FIRST (§3.1) → υλοποίησε **Slice 2** FULL ENTERPRISE + FULL SSOT, Revit-grade (strips born-hosted με guideBindings).
4. Tests + N.15 docs (ADR-441 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY). **ΜΗΝ** adr-index (shared tree). **ΜΗΝ** commit/push.
5. N.17: ΕΝΑ tsc τη φορά. Μετά Slice 2 → πρότεινε Slice 3.
