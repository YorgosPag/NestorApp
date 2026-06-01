# HANDOFF — ADR-401 · Wall-top «αγκάλιασμα» δοκαριού σε γωνιακή διασταύρωση (triangular-gap fix)

- **Ημερομηνία**: 2026-06-01
- **Συντάκτης**: Claude (Opus 4.8)
- **Για**: ΝΕΑ συνεδρία (καθαρό context) — **geometry enhancement** του attach-top. ΟΧΙ νέα feature, ΟΧΙ bug στο wiring (το attach δουλεύει ήδη).
- **🎯 Μοντέλο (N.14)**: **Opus** — geometry (per-corner profile + footprint clip), ~3-4 αρχεία, cross-cutting στο wall-solid pipeline.
- **⚠️ COMMIT/PUSH**: **ΤΑ ΚΑΝΕΙ Ο GIORGIO**, ΟΧΙ ο agent. Stage μόνο τα δικά σου hunks.
- **🚨 Multi-agent**: το working tree **μοιράζεται με άλλον agent (ADR-402 3D rotation / ADR-404 tilt)**. ΜΗΝ αγγίξεις τα αρχεία του: `bim-3d/animation/bim3d-preview-rebuild.ts`, `bim-3d/animation/bim3d-edit-interaction-handlers.ts`, `bim-3d/animation/bim3d-edit-command-builders.ts`, `bim-3d/gizmo/bim-gizmo-*.ts`, `bim3d-tilt-bridge.ts`, `bim3d-edit-math.ts`, `bim/transforms/bim-rotate-geometry.ts`, `ADR-402`/`ADR-404` docs. Αν χρειαστεί κοινό geometry αρχείο, stage **μόνο το δικό σου hunk**.

---

## 0. ΠΡΩΤΟ ΒΗΜΑ
`"C:\Program Files\Git\cmd\git.exe" log --oneline -5` — επιβεβαίωσε τα commits:
- **`8ae18632`** «feat(bim): ADR-401 3D manual attach pick-host (wall/column/stair)» — η προηγούμενη συνεδρία.
- **`0d65998d`** «wip(bim): ADR-402 3D editing + ADR-404 tilt…» — snapshot ξένης δουλειάς.
Ο Giorgio μπορεί να έχει κάνει push/άλλα commits — ΜΗΝ υποθέσεις.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (Giorgio live, 2026-06-01)

Setup: ένας τοίχος, από **πάνω** ένα **δοκάρι**. Ο χρήστης **περιστρέφει τον τοίχο** κάποιες μοίρες (ώστε ο τοίχος να περνά κάτω από το δοκάρι **υπό γωνία**), μετά «Σύνδεση Κορυφής».

**Σύμπτωμα**: η σύνδεση γίνεται (η κορυφή κόβεται στην κάτω παρειά του δοκαριού), ΑΛΛΑ επειδή τοίχος+δοκάρι ενώνονται **υπό γωνία**, μένουν **ΔΥΟ κενά τριγωνικά κομμάτια** δίπλα από το δοκάρι — ένα σε κάθε πλευρά. Ο τοίχος **δεν αγκαλιάζει πλήρως** το δοκάρι· σταματά πριν ακουμπήσει και η άλλη παρειά του.

### Root cause (επιβεβαιωμένο σχεδιαστικά)
Ο resolver κορυφής κόβει τον τοίχο με βάση το **profile κατά μήκος του ΑΞΟΝΑ** του τοίχου μόνο. Επειδή ο τοίχος έχει **πάχος**, οι δύο παρειές του (αριστερή/δεξιά) διασχίζουν τις ακμές του δοκαριού σε **διαφορετικό σημείο** κατά μήκος του άξονα όταν η διασταύρωση είναι υπό γωνία. Αποτέλεσμα: η κοπή βγαίνει **κάθετη στον άξονα** (single-level / axis-sampled), αντί **διαγώνια** ακολουθώντας το αποτύπωμα του δοκαριού → δύο γωνίες της κορυφής μένουν λάθος (μία κάτω από το δοκάρι αλλά άκοπη, η απέναντι κομμένη ενώ δεν χρειαζόταν) = τα δύο τρίγωνα.

### Revit parity (στόχος)
Η κορυφή του τοίχου πρέπει να ακολουθεί το **footprint της κάτω παρειάς** του host **σε όλο το πλάτος** του τοίχου → διαγώνια γραμμή κοπής, πλήρης κάλυψη, μηδέν κενά.

---

## 2. PLAN (Phase 1 = RECOGNITION πρώτα!)

**ΠΡΟΣΟΧΗ — διάβασε ΤΟΝ ΚΩΔΙΚΑ πριν σχεδιάσεις** (ο παρακάτω χάρτης είναι head-start, ΟΧΙ ground truth· code = SSoT, ADR = docs):

### Σχετικά αρχεία (επιβεβαιωμένα paths)
- **`src/subapps/dxf-viewer/bim/geometry/wall-top-profile.ts`** — `resolveWallTopProfile` / `evaluateWallTopAt`. Εδώ ζει το axis-based lower-envelope. **Καρδιά του fix**: χρειάζεται per-side/per-corner αποτίμηση (αριστερή & δεξιά παρειά ξεχωριστά), όχι μόνο axis-centerline.
- **`src/subapps/dxf-viewer/bim/geometry/wall-host-plan-builder.ts`** — `HostFootprintInput` (+`undersideZmmAt?`), `buildHostUndersidePlans`. Ο host πρέπει να εκτίθεται ως **2D footprint πολύγωνο** ώστε να γίνεται clip στο πλάτος του τοίχου (entry/exit της ΚΑΘΕ παρειάς).
- **`src/subapps/dxf-viewer/bim-3d/converters/wall-piece-geometry.ts`** — `buildSlopedWallPieceGeometry`. **Μισό υπάρχει ήδη**: το base-attach work πρόσθεσε per-corner top/bottom (4 ανεξάρτητες γωνίες, `WallBaseLocalFn`, `zBotAM/zBotBM`). Πρέπει το ΑΝΤΙΣΤΟΙΧΟ για top: 4 ανεξάρτητες κορυφές `zTopA/zTopB` ανά breakpoint, με τα breakpoints να περιλαμβάνουν τα entry/exit της κάθε παρειάς (όχι μόνο του άξονα).
- **`src/subapps/dxf-viewer/bim-3d/converters/BimToThreeConverter` + `bim-3d/scene/BimSceneLayer.syncWalls`** — χτίζουν τα host inputs + καλούν τον resolver. Πιθανό να χρειαστεί να περάσει το footprint πολύγωνο.
- **2D τομή / BOQ**: αν το profile γίνει per-side, έλεγξε ότι το `wallSection` (2D κάτοψη/τομή) + `computeWallGeometry` (BOQ area) παραμένουν συνεπή (κατά πάσα πιθανότητα η κάτοψη δεν αλλάζει — μόνο 3D + ίσως τομή).

### Precedent (αξιοποίησέ το — μη φτιάξεις από το μηδέν)
Το **base-attach** (ADR-401 Phase γ) ήδη έλυσε το ΑΝΑΛΟΓΟ πρόβλημα για τον **πάτο** με per-corner profile + κεκλιμένο/σκαλωτό wedge. Δες στο ADR-401 §8 changelog τα entries «Phase (γ) base-attach γ1/γ2» και «E2 follow-up» (tilted slab/beam). Το `buildSlopedWallPieceGeometry` ΗΔΗ δέχεται ανεξάρτητες γωνίες — το top πρέπει να φτάσει στο ίδιο επίπεδο γενίκευσης με το base.

### Βήματα (πρόταση — επιβεβαίωσε στο Plan Mode)
1. RECOGNITION: διάβασε `wall-top-profile.ts` + `wall-host-plan-builder.ts` + `buildSlopedWallPieceGeometry` + πώς το base-attach κάνει per-corner. Σύγκρινε με ADR-401 §2 (resolver) + ενημέρωσε το ADR αν αποκλίνει.
2. Host ως footprint πολύγωνο (beam = rectangle από axis+width· slab = outline). Per-side entry/exit κατά μήκος του άξονα → breakpoints.
3. `resolveWallTopProfile` → per-side top (αριστερή/δεξιά), lower-envelope ΑΝΑ παρειά (κράτα το axis variant ως fallback/2D).
4. `buildSlopedWallPieceGeometry`: top με ανεξάρτητες `zTopA/zTopB` ανά breakpoint (mirror του base wedge).
5. Tests: γωνιακή διασταύρωση → μηδέν κενά (4 top corners σωστά)· ίσιος τοίχος (0°) = byte-for-byte fast path (κανένα regression)· πολλαπλά hosts lower-envelope.
6. ADR-401 §8 changelog + (αν χρειαστεί) §2 resolver diagram. Ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + adr-index + memory (N.15) ΜΟΝΟ όταν δουλεύει + verify.

⚠️ **Fast path**: ίσιος/μη-attached τοίχος ΠΡΕΠΕΙ να μένει byte-for-byte (καμία αλλαγή performance/geometry). Η γωνιακή λογική ενεργοποιείται μόνο όταν `topBinding==='attached'` ΚΑΙ υπάρχει γωνία.

---

## 3. ΤΙ ΕΧΕΙ ΓΙΝΕΙ ΗΔΗ (μην το ξανακάνεις)

- **3D manual attach pick-host** = ✅ DONE & committed `8ae18632`. `useBim3DAttachPick` (3D raycast→emit `bim:attach-host-picked-3d`) → 2D `useWallAttachTool.dispatchAttachToHost` (SSoT). Δουλεύει για τοίχο/κολώνα/σκάλα σε 3D. **🔴 browser-verify το βασικό attach ακόμη εκκρεμεί** — αλλά το γωνιακό-κενό είναι ΞΕΧΩΡΙΣΤΟ geometry θέμα (αυτό το handoff).
- **2D hover host-pick fix** (`CanvasSection` `entityPickingActive += wallAttachTool.isActive`) = committed `8ae18632`.
- attach persistence (auto-attach revert) = committed `6c6e3b55` (browser-verified).
- ⚠️ Το πρόβλημα ΔΕΝ είναι το «attach δεν γίνεται» — το attach γίνεται. Είναι **καθαρά geometry** (η κορυφή δεν αγκαλιάζει το γωνιακό αποτύπωμα).

---

## 4. Refs
- ADR: `docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md` (§2 resolver, §8 changelog — δες base-attach γ1/γ2 για το per-corner precedent)
- Memory: `project_adr401_wall_top_constraints.md`
- Commits: `8ae18632` (3D attach), `0d65998d` (ξένο WIP), `6c6e3b55` (persistence)
