# HANDOFF — ADR-441 Slice 9 DONE (uncommitted) + Slice 10 crossing auto-trigger (IN INVESTIGATION)

**Date:** 2026-06-12 · **Branch:** main · **Μοντέλο: Opus** · **Shared working tree** (άλλος agent → grips/snapping/rotation ADR-397 + ribbon tabs ADR-443/444 — ΜΗΝ τα αγγίξεις)

> 🎯 **ΕΝΤΟΛΗ GIORGIO (διαρκής):** «όπως οι μεγάλοι, όπως η Revit. FULL ENTERPRISE + FULL SSoT.» Απάντα **ΕΛΛΗΝΙΚΑ**.
>
> ⚠️ **ΚΑΝΟΝΕΣ:** ΠΟΤΕ `git commit`/`push` — **ο Giorgio κάνει commit**. `git add` **ΜΟΝΟ δικά σου**, **ΠΟΤΕ `-A`**. Firestore MCP = **read-only**. N.17 ένα tsc τη φορά. function ≤40γρ, file ≤500γρ, no `any`, i18n ICU.
>
> 📋 **RUNBOOK (πλάνο Slice 10):** `C:\Users\user\.claude\plans\floating-scribbling-lovelace.md` — διάβασέ το ΠΡΩΤΟ.

---

## 1. SLICE 9 — Binding-aware managed identity ✅ DONE & DB-VERIFIED (UNCOMMITTED)

**Τι λύνει:** μετακίνηση άξονα κανάβου → τα grid strips ενημερώνονται **in-place** (κρατούν id + width + χειροκίνητη έδραση), δεν ξαναδημιουργούνται — όσο το grid-segment (ζεύγος οριοθετών αξόνων) υπάρχει. Revit datum-move.

**Root cause που διορθώθηκε:** ο `reconcileGridStrips` ταυτοποιούσε με `gridStripSignature` (= `segmentKey` **+ coords**)· σε κάθε μετακίνηση άλλαζαν τα coords → άλλαζε το signature → ίδιο segment delete+create → χανόταν id + instance override (ΚΑΙ σε απλή μετακίνηση, όχι μόνο crossing). Το `segmentKeyFromBindings` ήταν ΗΔΗ coordinate-free, χρησιμοποιούνταν μόνο ως prefix.

**Fix:** match σε σκέτο `segmentKey`. Matched + αλλαγή coords/έδρασης → **in-place managed update** (`toUpdate: RehostedStrip[]`, αντικ. `toReJustify`): coords←target, διατομή←existing, έδραση χειροκίνητη→preserve / auto→re-justify. `gridStripSignature`→change-detector πια. segmentKey-only-target→create· segmentKey-only-existing→delete· dedup διπλών→delete.

**ΑΡΧΕΙΑ ΜΟΥ (Slice 9 — git add ΜΟΝΟ αυτά):**
- `src/subapps/dxf-viewer/bim/foundations/foundation-grid-reconcile.ts` (core rewrite: segmentKey identity + computeManagedUpdate + toUpdate)
- `src/subapps/dxf-viewer/bim/foundations/foundation-grid-commit.ts` (destructure `toUpdate`· `reflowUpdates = toUpdate`· `reJustified: toUpdate.length`) — **ΠΡΟΣΟΧΗ: έχει ΚΑΙ προσωρινό diagnostic, βλ. §3**
- `src/subapps/dxf-viewer/bim/foundations/__tests__/foundation-grid-reconcile.test.ts` (5 νέα tests: coordinate-follow, simple-move manual, simple-move auto, crossing carry-over, dedup)
- `docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md` (changelog Slice 9)

**Tests:** 128 foundation + 18 bridge/emitter (146) PASS· 16 reconcile (5 νέα). tsc 0 errors στα δικά μου.

**DB-verified (read-only):**
- Test 1 (simple move C + Y1, χωρίς crossing): **ΚΑΙ ΤΑ 17 ids ΟΛΟΪΔΙΑ**, μηδέν delete/create. Η χειροκίνητη `fnd_0d156f33` ΠΑΝΩ στον μετακινούμενο Y1 κράτησε id + `justification:right` + `justificationManual:true` + width 600 + coords ακολούθησαν. ✅
- Crossing **με κουμπί «Εσχάρα»**: τέλεια καθαρή τοπολογία (delete stale-pair `pair(A,be38435f)`, create `pair(A,7baf5045)`, manual carry-over στον άξονα που επιβιώνει `0f5bef39`, legit-recreate στο φάτνωμα A-B που έπαψε). ✅ → **η λογική reconcile είναι ΣΩΣΤΗ**.

**Local (gitignored):** `local_baseline_grid_2026-06-12_fresh.txt` (baseline + Test 1 confirm), `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (Slice 9 line), MEMORY `project_adr441_foundation_strip_grid.md` (Slice 9 block).

---

## 2. SLICE 10 — Auto re-split στο crossing (follow-move trigger) 🔴 IN INVESTIGATION

**Πρόβλημα (DB-confirmed):** στο crossing **μέσω drag** (όχι κουμπί), το αυτόματο τοπολογικό «Εσχάρα» **δεν εφαρμόστηκε** — έτρεξε μόνο το coordinate-follow (`useHostingReconciler`) που τέντωσε 4 οριζόντιες λωρίδες in-place με **stale bindings** `pair(A,be38435f)` (full-width, overlap στο δεξί φάτνωμα, αριστερό ακάλυπτο). Το κουμπί «Εσχάρα» το διορθώνει αμέσως → **trigger/timing bug, ΟΧΙ λογική**.

**Pipeline (πλήρως διαβασμένο):**
- `useHostingReconciler.ts` (ADR-040-critical): on release, RAF tick → `reconcileHostedFoundations` re-derives geometry **από bindings ΧΩΡΙΣ να τα αλλάζει** → σε crossing τα bindings είναι stale → wrong full-span. setLevelScene('system-reconcile') + 350ms `bim:entities-moved` persist.
- `useGridGuideSettleEmitter.ts`: 400ms μετά settle → αν `gridOffsetSignature` άλλαξε → emit `bim:grid-guides-settled`.
- `useRibbonFoundationBridge.ts` auto-listener: ακούει το event → `runFoundationGridCommit()` = ΙΔΙΑ συνάρτηση με το κουμπί.

**3 leading hypotheses (στο runbook):** (H1) `gridOffsetSignature` κάνει `sort()` → δεν πιάνει pure-swap (latent· ΟΧΙ η αιτία εδώ γιατί οι τιμές άλλαξαν)· (H2) race coordinate-follow(350ms)↔commit(400ms) → ο commit διαβάζει **stale scene**· (H3) ο commit τρέχει αλλά το moved-persist γράφει μετά τα stale → overwrite.

**ΕΠΟΜΕΝΟ ΒΗΜΑ — Phase A (διαγνωστικό, σε εξέλιξη):** Πρόσθεσα προσωρινά `console.debug('[ADR441-DIAG]...')` (βλ. §3). **Ζήτησα από Giorgio:** refresh → Console → 1 crossing-drag → copy τις `[ADR441-DIAG]` γραμμές.
- `settle-event` δεν εμφανίζεται → emitter sig gap (H1).
- `auto-commit result` με deleted/created>0 αλλά DB λάθος → execution/persist (H3).
- `reason: up-to-date`/0 ή `existingKeys` έχει stale `pair(A,be38435f)` ενώ `targetKeys` σωστά → stale scene (H2).

**Μόλις έρθουν τα logs → κλείδωσε hypothesis → Phase B deterministic fix** (βλ. runbook· πιθανότατα: signature→id-by-sorted-offset sequence ΚΑΙ/Ή commit-authoritative-on-settle με fresh scene). **ΜΗΝ** προσθέσεις `useSyncExternalStore` σε CanvasSection/CanvasLayerStack (CHECK 6C). Stage ADR-040 αν αγγίξεις critical paths.

---

## 3. 🧹 ΠΡΟΣΩΡΙΝΑ DIAGNOSTICS — ΑΦΑΙΡΕΣΕ ΠΡΙΝ ΤΟ COMMIT

Με prefix `[ADR441-DIAG]` / σχόλιο `TEMP`:
- `useRibbonFoundationBridge.ts` — 3 `console.debug` μέσα στον `bim:grid-guides-settled` listener (~γρ. 291-301).
- `foundation-grid-commit.ts` — 1 `console.debug` μετά το `reconcileGridStrips(...)` + το import `import { segmentKeyFromBindings } from './foundation-grid-segments'; // [ADR441-DIAG] TEMP`.

**Grep πριν commit:** `[ADR441-DIAG]` → πρέπει 0 αποτελέσματα. (console.* μπορεί να μπλοκάρει pre-commit hook.)

---

## 4. DB ANCHORS (project pagonis-87766, read-only MCP)
- company `comp_9c7c1a50-…757` · project `proj_3a8e2b2c-…c57` · floor `flr_161aa890-…` · grid doc `grd_26a67767-960b-4a06-8c39-dbd67e811f55` · collection `floorplan_foundations` (17).
- **Τρέχουσα κατάσταση μετά το κουμπί = ΚΑΘΑΡΗ** (3×4 grid· X: A=`b6d02652`(-11.341), `7baf5045`(-5.844), `be38435f`(-0.748)· Y: `f79075c9`(2.622),`593441c0`(9.028),`6b277b97`(14.749),`b6e8892f`(20.470)). 9 vertical + 8 horizontal = 17.
- Πρωτόκολλο: μετά από κάθε χειρονομία Giorgio → `firestore_query floorplan_foundations` + `firestore_get_document floorplan_grid_guides` → σύγκρινε segment composition.

## 5. SSoT REFS (REUSE — ΜΗΝ διπλασιάσεις)
- `reconcileGridStrips` (Slice 9, segmentKey identity) — `foundation-grid-reconcile.ts`
- `commitFoundationGridFromGuides` / `runFoundationGridCommit` (το reconcile· δουλεύει με κουμπί)
- `segmentKeyFromBindings` (coordinate-free identity, SSoT) — `foundation-grid-segments.ts`
- `gridOffsetSignature` (settle trigger· υποψήφιο για H1 fix) — `useGridGuideSettleEmitter.ts`
- `reconcileHostedFoundations` (coordinate-follow, ADR-040-critical) — `guide-hosting-reconciler.ts`

## 6. ΚΑΤΑΣΤΑΣΗ COMMIT
- **Slice 9 = έτοιμο για commit** (αφού αφαιρεθούν τα diagnostics §3 — αλλά τα diagnostics είναι σε `foundation-grid-commit.ts` που είναι Slice 9 αρχείο· **καθάρισέ τα πρώτα**). Ο Giorgio αποφασίζει commit.
- **Slice 10 = δεν ξεκίνησε fix** — μόνο διάγνωση. Περιμένει logs Phase A.
