# HANDOFF — 🔴 BUG: attached BIM στοιχείο εξαφανίζεται μετά από 3Δ gizmo rotate/tilt

**Ημερομηνία:** 2026-06-01
**Συντάκτης:** Opus 4.8 (μετά ADR-404 Phase 3 + πρώτη απόπειρα fix)
**ADRs:** ADR-401 (attach-to-structural) ↔ ADR-402 (3Δ gizmo editing) ↔ ADR-404 (tilt)
**Μοντέλο:** Opus 4.8, **Plan Mode** (debug cross-cutting 3+ domains).
**Commit:** **Ο Giorgio κάνει τα commit — ΠΟΤΕ ο agent** (N.(-1)).
**⚠️ Working tree μοιράζεται με άλλον agent** (ADR-401 persist). Βλ. §7.

---

## 0. ΠΡΩΤΟ ΒΗΜΑ
1. `git status` / `git log`. **ΜΗΝ αγγίξεις αρχεία άλλου agent· ΠΟΤΕ `git add -A`· ΠΟΤΕ commit/push/`--no-verify`.**
2. Διάβασε αυτό το handoff ΟΛΟ. Μετά: ADR-404 changelog (τελευταίες εγγραφές) + ADR-401 §C (host→attached follow).
3. **Phase 1 RECOGNITION με RUNTIME INSTRUMENTATION** (§4) — το static analysis ΔΕΝ έφτασε· χρειάζεται console.log στο πραγματικό repro.

---

## 1. ΤΟ ΣΥΜΠΤΩΜΑ (επιβεβαιωμένο από Giorgio στο browser)
Σε 3Δ (`localhost:3000/dxf/viewer`), επιλέγω **attached** στοιχείο (τοίχο/κολώνα που η κορυφή του είναι attached σε δοκάρι, ADR-401) και το **περιστρέφω/γέρνω** με το gizmo (χρωματιστά δαχτυλίδια). **Μόλις αφήνω το ποντίκι (commit) → το στοιχείο εξαφανίζεται εντελώς.**

- **Μη-καταστροφικό:** δεν persist-άρει (DB μένει στην αρχική θέση)· **F5 το επαναφέρει**. Καθαρά transient render στο gizmo commit/resync.
- **Rotate (Y δαχτυλίδι) ΚΑΙ tilt (X/Z δαχτυλίδια)** → και τα δύο εξαφανίζουν.
- **Γιατί τώρα:** μόλις διορθώθηκε ADR-401 persistence bug (commit `6c6e3b55`) όπου το attach γινόταν revert από snapshot. Τώρα οι attached μένουν σταθερά `attached` → εκτέθηκε προϋπάρχον κενό στο gizmo pipeline.

## 2. REPRO
1. Τοίχος με `topBinding: storey-ceiling` → δοκάρι από πάνω → auto-attach (persist-άρει `topBinding: "attached"`).
2. Επίλεξε τον τοίχο σε 3Δ → περίστρεψε/γείρε με gizmo ring → release → **εξαφανίζεται**.

---

## 3. ΤΙ ΕΓΙΝΕ ΗΔΗ (από αυτή τη συνεδρία)

### 3.1 ✅ Fix attempt (b) — ΕΓΙΝΕ αλλά ΔΕΝ έλυσε το vanish (κράτησέ το, είναι σωστό)
**Αρχείο (uncommitted, ο Giorgio θα το κάνει commit):** `bim-3d/animation/bim3d-preview-rebuild.ts` + ADR-404 doc.
**Τι:** το preview rebuild (tilt + resize) τώρα **re-resolve-άρει τα attach top/base profiles** (mirror `BimSceneLayer.syncWalls`/`syncColumns`: `buildWallHostInputs` + `resolveWall/ColumnTop/BaseProfile`, `floorElevationMm=0`) για τοίχο+κολώνα → preview === commit (κανένα flat-top drift). Non-attached → byte-for-byte fast path. NEW helpers `wallPreviewProfiles`/`columnPreviewProfiles`. 249/249 gizmo/animation tests, tsc 0.
**Γιατί δεν έλυσε το vanish:** το **plan-rotate (Y-ring)** ΔΕΝ περνά από το preview-rebuild — χρησιμοποιεί **rigid path** (`captureTransform`/`applyRotate`) που πιάνει το ΗΔΗ profiled original mesh. Το fix αφορά μόνο tilt/resize preview. **Είναι όμως γνήσια βελτίωση SSoT (κράτησέ το).**

### 3.2 Recognition που ΕΓΙΝΕ (αλυσίδα κατανοητή)
Διαβάστηκαν: `bim3d-preview-rebuild.ts` → `bim3d-edit-interaction-handlers.ts` → `bim3d-edit-live-preview.ts` → `bim3d-resync.ts` → `BimSceneLayer.ts` (sync/syncWalls/syncColumns) → `BimToThreeConverter.ts` (wallToMesh).

**Commit flow (`onEditPointerUp`, bim3d-edit-interaction-handlers γρ.169-183):**
```
const committed = dispatchOutcome(ctx, ctx.controller.endDrag());  // execute command → triggers resync
if (committed) ctx.preview.commit();   // drops refs· rigid: αφήνει το rotated original· resize/tilt: αφήνει flat preview + hidden originals
else ctx.preview.reset();
```
- **rigid (move/Y-rotate):** `captureTransform`→`applyRotate`→`commit()` αφήνει το rotated original στη σκηνή.
- **resize/tilt (X/Z):** `captureResize`→`applyResize(buildTiltPreviewObject/buildResizePreviewObject)`→`commit()` αφήνει το preview object + originals κρυμμένα (`visible=false`).
- **resync:** `dispatchOutcome`→`getGlobalCommandHistory().execute(cmd)`→ (κάποια στιγμή) `resyncBimScene`→`manager.syncBimEntities`→`BimSceneLayer.sync()` που κάνει **`clearGroup()` + rebuild** (γρ.73-79). `syncWalls` (γρ.217-256): για `topBinding==='attached'` → `resolveWallTopProfile` + `wallToMesh(..., profile, baseProfile)`.

**ΠΑΡΑΔΟΞΟ (γιατί το static analysis ΔΕΝ έφτασε):** το `wallToMesh` (BimToThreeConverter γρ.238-295) έχει **fall-back στο flat solid**: αν `buildStraightWallWithOpenings` βγάλει 0 children → null (γρ.230) → πέφτει στο `buildWallShape` solid path → ορατό flat. Άρα *θεωρητικά* δεν θα έπρεπε να βγάζει null/vanish. **Όμως ο τοίχος ΟΝΤΩΣ εξαφανίζεται** → άρα κάποια από τις υποθέσεις §4 ισχύει και πρέπει να επιβεβαιωθεί RUNTIME.

---

## 4. ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ — RUNTIME INSTRUMENTATION (κάν' το ΠΡΩΤΟ)

Το vanish ⟹ **ή ο resync τρέχει και το `wallToMesh` βγάζει null για τον attached τοίχο, ή ο resync δεν τρέχει/τρέχει με snapshot χωρίς τον τοίχο, ή ο rotate απορρίπτεται από το persist και γίνεται rollback με κακό timing.** Βάλε προσωρινά `console.log` (ΟΧΙ `logger.*`, να φαίνεται στο browser console) και κάνε το repro:

1. **`BimSceneLayer.syncWalls` (γρ.230-255):** log ανά attached τοίχο: `wall.id`, `topBinding`, `profile?.hasAttach`, αν `wallToMesh` επέστρεψε `null`, και `entities.walls.length` (μήπως ο τοίχος ΛΕΙΠΕΙ από το snapshot).
2. **`wallToMesh` (BimToThreeConverter γρ.264-294):** log ποιο path πάρθηκε (pieces vs solid), αν `buildStraightWallWithOpenings`→null, αν `buildWallShape`→null.
3. **`resyncBimScene` / `bim3d-resync`:** log ότι έτρεξε + `s.walls.length` τη στιγμή του resync (μετά το command).
4. **Persist path:** άνοιξε το console για **PERMISSION_DENIED / validation errors** στο rotate attached στοιχείου (`useBimEntityMovedPersistEffect`). Το «δεν persist-άρει» είναι ΙΣΧΥΡΟ στοιχείο ότι ο rotate απορρίπτεται/γίνεται rollback → πιθανό render-loop/rollback (βλ. memory [[feedback_firestore_reject_loop]]).

### Κύριες υποθέσεις (έλεγξέ τες με σειρά)
- **Υ1 (πιθανότερη):** Ο rotate attached στοιχείου **απορρίπτεται από το persist** (validation/permission ή detach/attach conflict) → Firestore rollback → optimistic local state είχε ήδη clear-άρει/rebuild-άρει → race → vanish. *Σύνδεση:* «δεν persist-άρει, F5 επαναφέρει». **Έλεγξε ΠΡΩΤΑ αυτό.**
- **Υ2:** Ο rotated attached τοίχος → `resolveWallTopProfile` βγάζει degenerate profile (host beam δεν βρίσκεται πλέον στη νέα θέση) → `wallToMesh` null χωρίς να πέφτει σωστά στο fallback (έλεγξε αν το pieces path **πετάει** αντί να επιστρέφει null → throw αμπαλάρει τον τοίχο).
- **Υ3:** Ο resync τρέχει με snapshot όπου ο τοίχος έχει stale/missing `geometry` (το command δεν το ξανα-υπολόγισε για attached) → `wall.geometry.outerEdge` undefined → throw στο `computeWallOpeningPieces`/`buildWallShape`.

### Προτεινόμενη κατεύθυνση fix (αφού επιβεβαιωθεί root cause)
- Αν **Υ1** (persist reject): φτιάξε τον persist να **δέχεται** το rotate/tilt attached στοιχείου (ή να μην κάνει rollback που σβήνει το mesh). **ΜΗΝ σπάσεις** τα `signalEntitiesAttached`/`bim:entities-attached` (δουλεύουν).
- Αν **Υ2/Υ3** (wallToMesh null/throw): είτε guard στο `syncWalls` (try/catch ή fallback profile=undefined όταν degenerate), είτε εξασφάλισε recompute geometry στο command πριν το resync. **Flat/μη-attached path να μείνει byte-for-byte.**

**Έλεγχος attach state:** `params.topBinding === 'attached'` / `params.attachTopToIds` (& base).

---

## 5. ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ
- `bim-3d/animation/bim3d-edit-interaction-handlers.ts` — γρ.169-183 commit· γρ.73-97 capture (rigid vs resize/tilt)· γρ.255-274 dispatchOutcome→execute.
- `bim-3d/animation/bim3d-edit-live-preview.ts` — `commit()` γρ.135 (drops refs, ΔΕΝ restore)· `captureTransform`/`applyRotate` (rigid)· `captureResize`/`applyResize`.
- `bim-3d/animation/bim3d-preview-rebuild.ts` — **(δικό μου fix b)** profiles πλέον· tilt+resize.
- `bim-3d/scene/bim3d-resync.ts` — `resyncBimScene`→`syncBimEntities`.
- `bim-3d/scene/BimSceneLayer.ts` — `sync()` γρ.63-80 (clearGroup+rebuild)· `syncWalls` γρ.217-256· `syncColumns` γρ.258-290.
- `bim-3d/converters/BimToThreeConverter.ts` — `wallToMesh` γρ.238-295 (fall-back paths!)· `buildStraightWallWithOpenings` γρ.184-234.
- **Persist (άλλου agent — ΜΗΝ σπάσεις, μόνο διάγνωσε):** `hooks/data/useBimEntityMovedPersistEffect.ts`, `bim/hooks/use-stair-persistence.ts`, `core/commands/entity-commands/Attach*/Detach*Command.ts`, `systems/events/EventBus.ts` (`bim:entities-attached`).

---

## 6. 🔴 BROWSER ΕΛΕΓΧΟΙ ΠΟΥ ΜΕΝΟΥΝ (δεν έγιναν)

### Α. Ο τρέχων bug (μετά το fix)
- **Tilt** attached τοίχο/κολώνα (X/Z) → release → **μένει ορατό** με σωστή attached κορυφή;
- **Rotate** (Y) attached → release → μένει ορατό; *(τώρα: ❌ εξαφανίζεται)*
- Non-attached τοίχος/κολώνα rotate/tilt → ΟΚ (regression check).

### Β. ADR-404 Phase 3 (2Δ cut-plane projection — committed 6866899a/bbd06f1d, ΔΕΝ verified)
- Γείρε **κολώνα** → 2Δ κάτοψη: **δύο περιγράμματα** (cut plane = παχύ/cut+hatch· βάση = λεπτό) **ενωμένα με γραμμές** στις γωνίες. ✅ Giorgio το είδε σωστό — αλλά re-verify μετά τυχόν αλλαγές.
- Γείρε **τοίχο** → ίδιο (cut=παχύ, βάση=λεπτή, σωστή πλευρά ⟂ run).
- **Στρογγυλή/Γ/Τ κολώνα** → projection δουλεύει.
- **Δοκάρι/πλάκα** → 2Δ κάτοψη **ΔΕΝ αλλάζει** (μόνο τομή).
- **BOQ** ίδιο πριν/μετά την κλίση.
- **Διαφορετικό cutPlaneMm** (view range) → μετατόπιση αλλάζει αναλόγως.

### Γ. ADR-404 Phase 1+2 (committed 340f51d1/84ab4e62, ΔΕΝ verified)
- **Gizmo X/Z δαχτυλίδια:** drag → γέρνει live → release μένει → **undo** επαναφέρει.
- **Snap** 15° + **Shift = ελεύθερη γωνία**.
- **Φορά κλίσης σωστή** (να μη γέρνει ανάποδα — αν ναι, trivial sign flip στο `bim3d-tilt-bridge.ts`).

### Δ. Γνωστά όρια (ΟΧΙ bugs — μην τα περάσεις για σφάλμα)
- Attached + τοίχος με ανοίγματα tilt → flat-path limitation (το 3Δ shear δεν εφαρμόζεται σε profiled solid).
- Multi-select tilt → όχι (single-only). Section column/wall = single-slice (όχι πλήρες lean).

---

## 7. ΠΑΓΙΔΕΣ + MULTI-AGENT
- **⚠️ Shared working tree.** Άλλος agent δουλεύει ADR-401 persist (commit `6c6e3b55`: `signalEntitiesAttached` + `bim:entities-attached`). **ΜΗΝ τα πειράξεις — δουλεύουν.** Μόνο διάγνωσε.
- **`git add <specific>` πάντα**· verify `git diff --cached` πριν· **ΠΟΤΕ `-A`**· ΠΟΤΕ `checkout/restore` σε αρχεία άλλου agent.
- Uncommitted αυτή τη στιγμή (ο Giorgio θα κάνει commit): `bim3d-preview-rebuild.ts` + `ADR-404-3d-bim-element-tilt.md` (fix b).
- ADR-040 CHECK 6B/6D: αγγίζεις converter/renderer/scene → stage ADR μαζί.
- Files ≤500 γρ (N.7.1). ΜΗΝ διαβάσεις full bg `.output`.

## 8. DEFINITION OF DONE
- [ ] Runtime instrumentation → root cause του vanish επιβεβαιωμένο (Υ1/Υ2/Υ3).
- [ ] Fix· attached rotate+tilt → στοιχείο **μένει ορατό** στο commit.
- [ ] Non-attached path byte-for-byte (regression).
- [ ] Persist: το rotate/tilt attached **σώζεται** (όχι «δεν persist-άρει»), ΧΩΡΙΣ να σπάσει το ADR-401 attach.
- [ ] Browser verify §6 Α (+ ιδανικά Β/Γ).
- [ ] ADR-401/402/404 changelog + trackers N.15 (ΕΚΚΡΕΜΟΤΗΤΕΣ + adr-index + memory).
- [ ] **Ο Giorgio κάνει το commit.**
