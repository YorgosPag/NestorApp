# Handoff — ADR-929: Α1 είναι LIVE (ανέβηκε με ξένο push) · επόμενο: ζωντανός έλεγχος καπνού → έρευνα Α2 → Plan Mode Α2(β)

**Ημερομηνία:** 2026-11-09 (τέλος 7ης συνεδρίας) · **Worktree:** `C:\Nestor_Worktrees\raster-plan-recognition` · **Κλαδί:** `agent/raster-plan-recognition`
**Πλήρες πλαίσιο (ΔΙΑΒΑΣΕ ΠΡΩΤΑ):** `HANDOFFS/2026-11-09_ADR-929_A1-code-done-0-of-165_next-A2-research-then-plan_handoff.md`
(τι έγινε στο Α1, ανοιχτά 1–6, εύρημα Α2/N.8, scripts μέτρησης). Αυτό το αρχείο προσθέτει ΜΟΝΟ ό,τι άλλαξε μετά.

## Κανόνες (Giorgio) — αμετάβλητοι
Κάθε βήμα μόνο με «ναι», ένα τη φορά · πριν από κώδικα **πραγματικό SSoT audit με grep** · ποιότητα Revit/ArchiCAD/Figma/Zillow/
Idealista και πέρα · έρευνα διαδικτύου όπου δεν είσαι σίγουρος · όχι tsc · κανένα test χωρίς έγκριση · κανένα όνομα/διαδρομή του
φακέλου δεδομένων ή της εικόνας στην οθόνη · commit μόνο στο `agent/*` με ρητή λίστα · **ΟΧΙ commit στο main** · `wt:land` και push
**μόνο** με εντολή Giorgio · τεκμήριο κουτιού VLM: αναμονή νομικής απόφασης — **μην το αγγίξεις**.

## Τι άλλαξε μετά το προηγούμενο handoff
1. **Land** (εντολή Giorgio): `5161d605` στο `main` (`sheet-layout.ts` + 2 handoffs), πάνω στο `231e37cb`. Pre-commit 77/77.
2. **Το Α1 είναι στην παραγωγή χωρίς δική μας εντολή push**: άλλος πράκτορας έκανε push το `23097706` (ADR-934 M-b4, docs) που
   κάθεται πάνω στο `5161d605` ⇒ `origin/main` περιέχει το Α1· deploy Netcup επιτυχές («live 2309770»). Επιβεβαιωμένο με
   `git branch -a --contains 5161d605` (περιέχεται σε `origin/main`). Ο Giorgio ενημερώθηκε.
3. Το κλαδί `agent/raster-plan-recognition` είναι 1 commit πίσω από το `main` (το ξένο docs commit) — αδιάφορο, το `wt:land` κάνει rebase.

## ΕΠΟΜΕΝΟ (κάθε ένα με «ναι»)
0. **Ζωντανός έλεγχος καπνού (προαιρετικός, πρώτος)** στο nestorconstruct.gr: τρέχει η αναγνώριση κάτοψης στο production build;
   φορτώνει ο Worker ευθυγράμμισης χωρίς σφάλμα κονσόλας; η πινακίδα ΔΕΝ βγάζει υποψήφιους τοίχους; Η μέτρηση (165 → 0) έχει ήδη
   γίνει τοπικά με τον ίδιο κώδικα παραγωγής — το live ελέγχει μόνο bundle/Worker.
   ⚠️ **Πριν ανεβάσεις εικόνα**: grep αν η ροή αναγνώρισης στην παραγωγή αποθηκεύει την εικόνα (Storage/Firestore). Αν ναι, ή αν δεν
   είσαι σίγουρος → ρώτα τον Giorgio **ποια εικόνα** επιτρέπεται. Μην ανεβάσεις εικόνα του φακέλου δεδομένων χωρίς ρητό «ναι».
   Browser: Claude in Chrome (φόρτωσε όλα τα εργαλεία σε ΕΝΑ ToolSearch, νέα καρτέλα).
1. **Έρευνα διαδικτύου Α2** (AutoCAD Raster Design, Scan2CAD κ.ά.: μάσκες πριν/μετά τη διανυσματοποίηση, αυξητική επανεξαγωγή).
2. **Plan Mode Α2(β)** με SSoT audit (grep: `plan-align-client.ts`, `plan-align.worker.ts`, `PlanAlignMessage`, `handlePlanWorker`,
   `readingReview`, `planRecognitionStore`, `fuse(`, `viewSegmentsOf`, `assertReadingView`). Αγγίζει πυρήνα + `systems/` ⇒ N.8.
3. Μετά: κώδικας Β1 → jest (Α1 + Β1) → μεταλλάξεις → επαναμέτρηση + §6.9 #21 → changelog ADR-929 (Φάση 3, Α1 ΔΕΝ γράφτηκε) → commit.
