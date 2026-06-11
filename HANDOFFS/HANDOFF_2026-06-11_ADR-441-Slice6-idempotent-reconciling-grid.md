# HANDOFF — ADR-441 Slice 6: Idempotent / Reconciling Εσχάρα από Κάναβο + Migration ορφανών πεδιλοδοκών

**Date:** 2026-06-11 · **Branch:** main · **Shared working tree** (άλλος agent δουλεύει ταυτόχρονα — grips/snapping/rotation: ADR-397) · **Μοντέλο: Opus**

> 🎯 **ΕΝΤΟΛΗ GIORGIO:** «ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ, ΟΠΩΣ Η REVIT — ΥΛΟΠΟΙΗΣΗ ΜΕ ΣΥΣΤΗΜΑ, FULL ENTERPRISE + FULL SSOT.» **SEARCH FIRST** (code=SoT· τα signatures στο §3 είναι επιβεβαιωμένα 2026-06-11). Απάντα **ΕΛΛΗΝΙΚΑ**.
>
> ⚠️ **ΚΑΝΟΝΕΣ (απαράβατοι):** ΠΟΤΕ `git commit`/`push` — **ο Giorgio κάνει commit**. `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ `-A`** (shared tree — μην αγγίξεις grips/snapping/rotation/SnapEngine άλλου agent). **N.17: ΕΝΑ tsc τη φορά** (έλεγξε process πρώτα· `Get-CimInstance Win32_Process … *typescript*tsc*`· ΠΟΤΕ `tsc | head` — κρύβει errors, γράψε σε αρχείο & grep). function ≤40γρ, file ≤500γρ, no `any`/`as any`/`@ts-ignore`, i18n ICU. **Confirm repro ΠΡΙΝ γράψεις κώδικα** (κανόνας Giorgio).

---

## 0. ΔΙΑΒΑΣΕ ΠΡΩΤΑ (Recognition — N.0.1 Phase 1)
1. **`ADR-441-foundation-strip-grid-auto-design.md`** — §10 (Slices 0-5a, τι υπάρχει)· §8.6 (κεντρικά/έκκεντρα)· το νέο Slice 6 γράφεται από σένα στο τέλος του Recognition.
2. **`ADR-436-…foundation.md`** — BIM Foundation Discipline.
3. Αυτό το handoff (§2 root cause· §3 signatures· §4 σχέδιο· §5 Revit-grade απαντήσεις).

---

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ (DONE — committed)
- **ADR-441 Slices 0+1+2+3+JOIN+4+5a DONE & COMMITTED** (5a = `5fff2ab2`, Foundation Justification geometry-param).
- **Slice 3 follow-on-move** δουλεύει: μετακινείς άξονα → hosted strips (με `guideBindings`) ακολουθούν live + persist. 19/19 follow-move tests PASS, persistence round-trip OK (`entityToSaveInput` γράφει bindings, `docToEntity` γρ.108 τα διαβάζει).

## 2. ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙΣ (root cause — ΕΠΙΒΕΒΑΙΩΜΕΝΟ)

Ο Giorgio παρατήρησε: **παλιοί πεδιλοδοκοί ΔΕΝ ακολουθούν** τη μετακίνηση των οδηγών, ενώ **νέοι** (από εκ νέου «Εσχάρα από κάναβο») ακολουθούν. Δύο διακριτά ζητήματα:

### 2.1 Ορφανοί πεδιλοδοκοί (legacy χωρίς bindings)
Ο follow-move (Slice 3) μετακινεί **ΜΟΝΟ** strips που κουβαλούν `guideBindings`. Οι παλιοί δημιουργήθηκαν **πριν** υπάρξει το Slice 3 binding-persistence → τα Firestore docs τους **δεν έχουν `guideBindings`** → φορτώνονται ορφανοί → δεν ακούνε κανέναν άξονα. **ΟΧΙ regression, ΟΧΙ η αλλαγή 5a** (no-op για center· follow-move κώδικας άθικτος).

### 2.2 «Εσχάρα από κάναβο» = τυφλή παραγωγή (ΟΧΙ idempotent)
Κάθε κλικ στο «Εσχάρα από κάναβο» χτίζει **πλήρες νέο set** strips, χωρίς να ξέρει τι υπάρχει ήδη → **διπλοί** (orphans + νέοι, επικαλυπτόμενοι). Η εντολή πρέπει να γίνει **idempotent / reconciling** (Revit/Tekla way).

**ΣΤΟΧΟΣ Slice 6 (Revit-grade):** η «Εσχάρα» (α) δημιουργεί **μόνο τα ακάλυπτα** segments (idempotency, τέρμα διπλοί)· (β) **re-bind ορφανών** (migration: legacy strips → ξανα-κρεμιούνται στους άξονες by geometry → αρχίζουν να ακολουθούν, χωρίς διαγραφή).

---

## 3. SSoT / SIGNATURES — REUSE αυτούσια (ΕΠΙΒΕΒΑΙΩΜΕΝΑ 2026-06-11, code=SoT)

| Τι | Πού | Σημείωση |
|---|---|---|
| **Pure grid builder** | `bim/foundations/foundation-from-grid.ts` `buildStripGridFromGuides(reader, overrides, levelId, sceneUnits)` → `{ok, strips, ignoredCount}`· strips born-hosted με slot-based `guideBindings`· helpers `emitVerticalStrips`/`emitHorizontalStrips` (push ΕΝΑ segment με bindings) | **Εδώ μπαίνει το skip-set**: extend υπογραφή με optional `coveredKeys?: ReadonlySet<string>` ώστε ο builder να ΠΑΡΑΛΕΙΠΕΙ segments ήδη καλυμμένα. Pure παραμένει. |
| **Orchestrator (έχει scene)** | `bim/foundations/foundation-grid-commit.ts` `commitFoundationGridFromGuides({guideReader, getLevelScene, setLevelScene, levelId, sceneUnits, executeCommand, overrides?})` → `{ok, reason, built, ignored}`· εκτελεί ΕΝΑ `CreateFoundationsCommand` | **Εδώ διαβάζεις τα ΥΠΑΡΧΟΝΤΑ foundations** (`getLevelScene(levelId).entities.filter(isFoundationEntity)`) → χτίζεις covered-set + βρίσκεις orphans → περνάς `coveredKeys` στον builder + κάνεις re-bind orphans. Πιθανώς 2η command (update) ή ενοποιημένο batch. |
| **Hosting bindings (SSoT)** | `bim/hosting/guide-binding-types.ts` `GuideBinding {guideId, slot, extend?}`· slot ∈ start-x/start-y/end-x/end-y/center-x/center-y· `extractBoundGuideIds`/`hasGuideBindings` | **Segment key** = από τα bindings ενός strip. Vertical: parallel-axis guide (start-x==end-x ίδιο id) + endpoint guides (start-y,end-y). Horizontal: mirror. Κλειδί π.χ. `V\|${xId}\|${min(yA,yB)}\|${max(yA,yB)}`. **NEW pure helper** `segmentKeyFromBindings(bindings)` — ΙΔΙΟ κλειδί build-time & από persisted strips. `extend` ΔΕΝ επηρεάζει το key (robust). |
| **Derive (follow-move)** | `bim/hosting/derive-params-from-guides.ts` `deriveFoundationParamsFromGuides(params, bindings, getOffset)` | Δεν αλλάζει. Μόλις ο orphan αποκτήσει bindings, ο reconciler τον πιάνει αυτόματα. |
| **Reconciler** | `bim/hosting/guide-hosting-reconciler.ts` `buildHostingIndex` + `reconcileHostedFoundations` | Δεν αλλάζει. Καταναλώνει bindings. |
| **Guide reader** | `systems/guides/guide-store.ts` `getGlobalGuideStore()` (`getGuidesByAxis('X'\|'Y')` → `Guide{id,offset,axis,visible}`) | Για το orphan re-bind: ταίριαξε geometry strip (start/end άξονας) με τρέχοντα guide offsets → βρες (parallel guide + 2 endpoint guides) → attach bindings. |
| **Persistence** | `bim/foundations/foundation-firestore-service.ts` `entityToSaveInput` (γράφει `guideBindings`) + `useFoundationPersistence.ts` `docToEntity` (γρ.108 διαβάζει)· update path = `useBimEntityMovedPersistEffect` (ADR-436) | Round-trip ΕΤΟΙΜΟ. Μετά το re-bind, ο orphan πρέπει να persist-άρει τα νέα bindings → reuse υπάρχον save/update (entityToSaveInput περιλαμβάνει bindings). |
| **Commands** | `core/commands/entity-commands/CreateFoundationsCommand.ts` (atomic batch create, deferred-microtask `drawing:entity-created`) + `UpdateFoundationParamsCommand.ts` (single update, geometry+validation recompute) | Για re-bind orphans χρειάζεσαι **update-with-bindings** path. Έλεγξε αν `UpdateFoundationParamsCommand` round-trip-άρει `guideBindings` ή αν χρειάζεται mirror batch `UpdateFoundationsCommand`. |
| **Selection helper** | `types/entities.ts` `isFoundationEntity(e)` | Φιλτράρισμα scene entities. |

---

## 4. ΣΧΕΔΙΟ — Slice 6 (FULL SSoT, phased· έγκριση ανά phase από Giorgio)

> Recognition πρώτα (code=SoT) → πρότεινε Plan 6a στον Giorgio (Plan Mode, 3-5+ αρχεία) → incremental, tsc serialized, Revit-grade.

### Slice 6a — Idempotency (skip ήδη-καλυμμένων segments) — ΚΥΡΙΟ ΠΡΩΤΟ
1. **NEW pure** `segmentKeyFromBindings(bindings): string \| null` (στο `foundation-from-grid.ts` ή νέο `foundation-grid-segments.ts`). Canonical κλειδί ανά segment από bindings (orientation + parallel guide id + sorted endpoint guide ids). Total/pure/tested.
2. **Extend** `buildStripGridFromGuides` με optional `coveredKeys?: ReadonlySet<string>` → στα `emitVerticalStrips`/`emitHorizontalStrips`, υπολόγισε το ίδιο key ανά candidate και **skip αν ∈ coveredKeys**. Default κενό → backward-compatible.
3. Στο `commitFoundationGridFromGuides`: διάβασε existing foundations → `coveredKeys = new Set(existing.filter(hasGuideBindings).map(e => segmentKeyFromBindings(e.guideBindings)))` → πέρασέ το στον builder. → **δημιουργεί ΜΟΝΟ ακάλυπτα**.
4. Tests: re-run «Εσχάρα» σε πλήρη εσχάρα → 0 νέα (idempotent)· μερική → μόνο τα missing.

**Αποτέλεσμα 6a:** τέρμα οι διπλοί. Re-run = ασφαλές (Revit/Tekla managed generate).

### Slice 6b — Migration / re-bind ορφανών — follow-on
1. **NEW pure** `rehostOrphanStrips(orphans, guideReader, sceneUnits): FoundationEntity[]` — για κάθε strip ΧΩΡΙΣ bindings (ή με bindings προς διαγραμμένους άξονες): ταίριαξε τον άξονά του (start→end) στους τρέχοντες guides (parallel offset + 2 endpoint offsets, tolerance) → χτίσε bindings (ίδια slot-λογική με `buildStripGridFromGuides`) → επέστρεψε updated entity. Όσοι δεν ταιριάζουν σε grid segment → άθικτοι (μένουν ελεύθεροι).
2. Orchestrator: μετά το create, εφάρμοσε re-bind + persist (reuse update path με guideBindings).
3. Tests: orphan πάνω σε guide segment → αποκτά bindings → ακολουθεί· orphan εκτός grid → άθικτος.

**Αποτέλεσμα 6b:** οι παλιοί legacy πεδιλοδοκοί αρχίζουν να ακολουθούν, **χωρίς διαγραφή**.

### Slice 6c — (DEFER) «Ενημέρωση εσχάρας» reconcile UI
Optional: ξεχωριστή action που reconcile = add missing + **προτείνει** αφαίρεση strips των οποίων το segment δεν υπάρχει πια στο grid (confirm dialog). Revit-grade managed update. Μετά απόφαση Giorgio.

### 4.4 ΣΕΙΡΑ (incremental, tsc serialized)
segmentKey helper + tests → builder coveredKeys → commit reads existing → tests → (6b) rehost helper + tests → orchestrator wire + persist → tsc → browser. **Έγκριση Giorgio ανά phase (6a → 6b → 6c).**

### 4.5 ΡΙΣΚΑ
1. **Segment key consistency:** το key ΠΡΕΠΕΙ να βγαίνει ίδιο build-time & από persisted bindings — αλλιώς idempotency σπάει. Test και τις 2 πηγές.
2. **Corner-fill extend:** τα γωνιακά segments έχουν `extend` στα endpoints· το key ΑΓΝΟΕΙ το extend (μόνο guide ids) → robust. Επιβεβαίωσε.
3. **Re-bind tolerance:** μη-ακριβής αντιστοίχιση offsets (floating point) → χρησιμοποίησε tolerance (δες `GRID_DEDUP_TOL` στο foundation-from-grid).
4. **shared tree:** git add ΜΟΝΟ δικά σου, ΟΧΙ -A.

---

## 5. REVIT-GRADE ΑΠΑΝΤΗΣΕΙΣ (οι 5 ερωτήσεις Giorgio — design rationale)
1. **Γιατί δεν ακολουθούσαν οι παλιοί;** Δεν είχαν `guideBindings` (legacy pre-Slice-3). §2.1.
2. **Σωστό να ξαναδημιουργούνται ξανά & ξανά;** ΟΧΙ — κενό. Πρέπει idempotent (Slice 6a).
3. **Πώς ξέρει ποιοι άξονες έχουν ήδη strips;** Από τα `guideBindings` των existing → covered-set (Slice 6a). Η πληροφορία ΥΠΑΡΧΕΙ, απλά δεν διαβάζεται στο generate.
4. **Αν βάλει κι άλλους οδηγούς — auto-create;** Revit-grade = **semi-automatic**: ΟΧΙ μαγική auto-δημιουργία. Ο χρήστης ξανατρέχει «Εσχάρα» → reconcile (add missing only). Πλήρως-associative auto = too-magic, κανείς δεν το κάνει by default.
5. **Τι κάνουν οι μεγάλοι;** Revit: footings hosted σε τοίχους/κολώνες, follow grid· νέος άξονας ΔΕΝ φτιάχνει αυτόματα μέλος. Tekla/ProtaStructure/ETABS-SAFE: «generate along grid» **managed/reconciling**, ξέρει existing, δεν διπλασιάζει. Συναίνεση: grid=SSoT, members hosted+follow, generation idempotent, προσθήκη=σκόπιμη.

---

## 6. ΚΑΝΟΝΕΣ / WORKING TREE
- **Δικά σου (αναμενόμενα):** `bim/foundations/foundation-from-grid.ts`, `bim/foundations/foundation-grid-commit.ts`, NEW `bim/foundations/foundation-grid-segments.ts` (ή reuse), NEW rehost helper, ίσως `UpdateFoundationsCommand.ts` (αν χρειάζεται batch update-with-bindings), `useRibbonFoundationBridge.ts` (handleFromGrid wire), i18n (αν 6c), + tests.
- **ΑΛΛΟΥ agent (ΜΗΝ αγγίξεις):** grips/grip-temperature/GripColorManager/BaseEntityRenderer/SnapContext/SnapEngine/RotationSnapEngine/rotation-snap-store/color-config/tolerance-config/phase-manager (ADR-397). **ΠΟΤΕ `git add -A`.**
- **ΕΚΤΟΣ ADR-040** (pure build/commit logic· καμία renderer/canvas/guide-render αλλαγή — grid read μέσω getLevelScene/guide-store στο event-time).
- N.15 docs: ADR-441 §10 +Slice 6 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1-2 γρ.) + MEMORY `[[project_adr441_foundation_strip_grid]]`. **ΜΗΝ** adr-index (shared tree).
- **COMMIT ΤΟΝ ΚΑΝΕΙ Ο GIORGIO.**

## 7. QUICK START
1. Recognition: ADR-441 §10 + §3 signatures αυτού του handoff (code=SoT· verify κάθε υπογραφή).
2. `git status` (Slices 0-5a committed· grips/snapping/ADR-397 από άλλον agent — μην τα αγγίξεις).
3. Πρότεινε στον Giorgio το σχέδιο **Slice 6a** (Plan Mode) → έγκριση → incremental. tsc serialized (ΟΧΙ `| head`). ΜΗΝ commit/push.
4. Browser-verify: σχεδίασε εσχάρα → ξανατρέξε «Εσχάρα από κάναβο» → **0 νέα/καμία διπλοεγγραφή** (6a)· (6b) παλιός orphan → μετά την εντολή αρχίζει να ακολουθεί τη μετακίνηση άξονα.
