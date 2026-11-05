# HANDOFF — ADR-929 · Φ4 (σύντηξη + λύτης διαστάσεων) και τα ανοιχτά #1 #2 #3

**Ημερομηνία:** 2026-11-05 · **Worktree:** `C:\Nestor_Worktrees\raster-plan-recognition` · **Κλαδί:** `agent/raster-plan-recognition`
**ADR:** `docs/centralized-systems/reference/adrs/ADR-929-raster-plan-recognition.md` (§6 γραμμή Φ4 · §6.4 · «Διακόπτης AI ανά εταιρεία»)

## 0. Κατάσταση εκκίνησης (επαλήθευσε πρώτα)
- **Στο `main` και στην παραγωγή:** `cf373756` (handoff Φ3 + διακόπτης AI ανά εταιρεία, Δ15 #1). Το `main` έχει ήδη προχωρήσει από άλλες συνεδρίες (π.χ. `c091092f`).
  ⇒ **Πρώτο βήμα:** `git fetch` · `git log --oneline -3 origin/main` · `git rebase origin/main` μέσα στο worktree.
- ⚠️ **Μάθημα land:** το `wt:land` κάνει rebase στο **τοπικό** `main` και **δεν** κάνει fetch. Αν το τοπικό `main` είναι πίσω από το `origin/main`, το push απορρίπτεται, και η ένωση μπορεί να «καταπιεί» ξένο commit. Πρακτική που δούλεψε: rebase του κλαδιού στο `origin/main` → ένωση των δικών σου commits με `reset --soft origin/main` + commit (πλήρες hook) → `wt:land` (απλό ff) → `git push origin main`.
- **Live (2026-11-05):** `GET /api/settings/ai-processing` ⇒ `enabled · platform-default · legal: pending · effective: false · canEdit: true`. Η καρτέλα «Τεχνητή νοημοσύνη» στις Ρυθμίσεις εταιρείας φαίνεται σωστά. Ο διακόπτης **δεν** πατήθηκε στην παραγωγή (θα έγραφε απόφαση + ιστορικό).
- **Κανένα** αδέσμευτο αρχείο, τίποτα στο παρασκήνιο.

## 1. Μικρό εύρημα πρώτα (≤ 30′)
**Πιθανό κόλλημα της σελίδας Ρυθμίσεων εταιρείας.** Στην πρώτη ζωντανή δοκιμή η `/o/<χώρος>/settings/company` έμεινε >15″ στο «Τμήματα και υπεύθυνοι της επιχείρησης…». Στη δεύτερη φόρτωσε κανονικά, χωρίς σφάλματα κονσόλας.
Ύποπτο (μη επιβεβαιωμένο): `CompanySettingsPageContent.tsx`: αρχική κατάσταση `loading: true` και `fetchOrgStructure` → `if (!user) return;` **χωρίς** να κλείσει το loading. Αν το `useAuth().user` αργήσει ή μείνει `null`, η σελίδα μένει για πάντα στη φόρτωση. Επιβεβαίωσε (ανάγνωση του `useAuth` + δοκιμή), διόρθωσε (Boy Scout, N.0.2) και πρόσθεσε τεστ.

## 2. Τα ανοιχτά — περιμένουν τον Giorgio
- **#1 Σάρωση άδειας Παλαιολόγου:** η αποστολή στην OpenAI γίνεται **μόνο από τον Giorgio**. Τα αρχεία υπάρχουν στο `C:/Users/user/AppData/Local/Temp/claude/77bac0f4391d9911/825b351b-145a-4391-a77b-6b1cd4fb9e6b/scratchpad/golden` (sha256 όψης `4d831f75…` = `view.json`, `confirmed: true`, αλήθεια στο `reading-truth.json`). Εντολή: δες το προηγούμενο handoff `HANDOFFS/2026-11-04_ADR-929_F3-open-items_handoff.md` §1 #1. Μετά: `python -I read_score.py <dir>` και ενημέρωση του §6.4 + «Επιλογή μοντέλου». **Πρότεινε** μεταφορά του `golden` δίπλα στο `F:\Shared\_Nestor_Plan_Golden` (το Temp σβήνεται).
  ⚠️ Το allowance της παραγωγής αρνείται πλέον χωρίς τον όρο `aiPlanReading`. Το σενάριο μέτρησης καλεί τον προσαρμογέα **απευθείας**, άρα δεν επηρεάζεται. Επαλήθευσέ το πριν το τρέξει ο Giorgio.
- **#2 Νέα μέτρηση της δέσης:** μόνο με εντολή Giorgio και ελεύθερη μνήμη (`read-repeat.js` / `binding_overlay.py`).
- **#3 README χρυσού συνόλου:** θέλει ρητό «ναι» του Giorgio.
- **Δ15 #3 πολιτική απορρήτου v2** με όρο `aiPlanReading`: χωρίς αυτήν **δεν στέλνεται τίποτα στην παραγωγή**. Νομικό κείμενο ⇒ έγκριση Giorgio, `npm run legal:freeze` (ADR-861, CHECK 3.85).
- **Απόφαση Giorgio:** με κλειστό διακόπτη, μια ανάγνωση από την κρυφή μνήμη επιστρέφεται ακόμη (δεν φεύγει τίποτα, είναι ήδη πληρωμένη). «Κλειστό = ούτε παλιές» ⇒ μία γραμμή στο `plan-reading.service.ts`.

## 3. Φ4 — Σύντηξη + λύτης διαστάσεων (ADR-929 §6, γραμμή Φ4)
Σταθμισμένα ελάχιστα τετράγωνα πάνω στη γεωμετρία της Φ2 + αναγνώσεις της Φ3 · βεβαιότητα ανά τιμή · ερωτήσεις προς τον χρήστη όπου διαφωνούν · προτεινόμενη κλίμακα (Δ4) · **δέση γεωμετρικά** (εύρημα #5: πλαίσιο + προσανατολισμός κειμένου → πλησιέστερες κάθετες παρειές), με το VLM μόνο ως ένδειξη (Δ1).
- **Πριν από κώδικα:** SSoT audit (grep) για υπάρχοντες λύτες / least-squares / constraint solvers στο `src/lib/geometry` και στο `src/subapps/dxf-viewer/bim/`. Έρευνα πρακτικής (ArchiCAD/Revit dimension constraints, Plans2BIM, Zillow floor plans, ακαδημαϊκά: raster-to-vector + dimension consistency) και, αν γίνεται, κάτι καλύτερο.
- 5+ αρχεία / 2+ τομείς ⇒ **N.8: ρώτα Giorgio** (Plan Mode ή Orchestrator) πριν ξεκινήσεις. N.14: δήλωσε μοντέλο.

## 4. Κανόνες
- Δουλειά **μόνο** σε αυτό το worktree και κλαδί · commit της δικής σου δουλειάς με **ρητή λίστα αρχείων** · **ποτέ** στο `main` · `wt:land` + push **μόνο** με εντολή Giorgio.
- Καμία αποστολή εικόνας σε AI από τον πράκτορα · καμία μέτρηση χωρίς εντολή.
- Όχι `tsc` (N.17) · `jscpd:diff` πριν το «done» (N.18) · `npm run test:ai-pipeline:all` αν αγγίξεις `src/services/ai-pipeline/` (N.10) · νέα κλειδιά i18n ⇒ `npm run generate:i18n-types`.
- ADR-929 changelog στο ίδιο commit με τον κώδικα (N.0.1).
