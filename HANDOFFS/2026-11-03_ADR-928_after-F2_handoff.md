# Handoff — ADR-928 Συμφωνητικό υπεργολαβίας · μετά τη Φ2

**Ημερομηνία:** 2026-11-03 · **Worktree:** `C:\Nestor_Worktrees\adr-923-phase6b` · **Κλαδί:** `agent/adr-923-phase6b`
**Αντικαθιστά** το `HANDOFFS/2026-11-03_ADR-928_F3_handoff.md` (αφαιρέθηκε στο ίδιο commit — ένα handoff, όχι δύο).

## Η πηγή της αλήθειας
Διάβασε **ολόκληρο** το ADR: `docs/centralized-systems/reference/adrs/ADR-928-subcontract-offer-agreement.md`.
Για όσα ακολουθούν κυρίως: §5.4, §5.4.1 (προεπισκόπηση ημερολογίου πληρωμών), §5.9 (η φόρμα από το πρότυπο),
**§5.14 (Φ2: αποφάσεις 1–13 + χάρτης κώδικα)**, §6 (φάσεις), §9 (ανοιχτά ερωτήματα). Αυτό το handoff **δεν** επαναλαμβάνει το ADR.
Ο κώδικας είναι η αλήθεια· αν διαφωνεί με το ADR, ενημέρωσε το ADR (N.0.1).

## Κατάσταση
- Φ0, Φ1, Φ2 ✅ στο κλαδί (Φ2 = `ada1c115`). **Δεν** έχει γίνει `wt:land` ούτε push.
- Επαλήθευση Φ2: jest 525/525 · κανόνες emulator 134/134 · μεταλλάξεις όλες κόκκινες · πύλη 3.113 9/9 · hook πράσινος
  (το gitleaks δεν είναι εγκατεστημένο στο μηχάνημα — δεν έτρεξε).
- Συντονίστρια ADR-923: `nestor-pagonis-92` — επιβεβαίωσε «καμία επικάλυψη» για το `ada1c115`.

## Τα 4 επόμενα βήματα — τι είναι δικό σου και τι του Giorgio
1. **`wt:land` + push** — ⛔ **ΜΟΝΟ με ρητή εντολή Giorgio.** Μην το προτείνεις ως αυτονόητο· ρώτα στην αρχή αν το θέλει τώρα.
2. **Ανάπτυξη των 2 δεικτών στο Firebase** (`firestore.indexes.json`: `companyId + projectIds CONTAINS + updatedAt DESC` ·
   `companyId + status + updatedAt DESC`). Ξεχωριστή πράξη από το push (CHECK 3.86: commit ≠ deploy· το push πάει στο
   Netcup, ποτέ στο Firebase). Εξωτερική ενέργεια ⇒ **μόνο με εντολή Giorgio**. Δες `docs/gates/3.86.md` για τη σειρά.
   Χωρίς αυτό, η λίστα ανά έργο της Φ3 δίνει `FAILED_PRECONDITION` στην παραγωγή.
3. **Απόφαση Giorgio (ADR §9): ρόλος έργου για τα συμφωνητικά.** Σήμερα `subcontracts:agreements:manage` και
   `:approve_deviation` έχει εξ ορισμού **μόνο** ο `company_admin`. Δεν μπήκαν στο `PROJECT_SCOPED_ACTIONS` (ADR-926) γιατί ένα
   `multi_project` συμφωνητικό δεν έχει **ένα** έργο-πόρο (Κ3). Παρουσίασε στον Giorgio επιλογές με το τι κάνουν Procore /
   Autodesk Build (έρευνα στο διαδίκτυο) και **περίμενε** την απόφαση· μην την πάρεις μόνος.
4. **Φ3 — η οθόνη** (ADR §6):
   - Επεξεργαστής: φόρμα από το πρότυπο ειδικότητας + ζωντανή προεπισκόπηση (§5.9, §5.4.1).
   - Λίστα ανά έργο (`projectIds` array-contains).
   - Μεταφράσεις el/en των κωδικών ευρημάτων (`SUBCONTRACT_ISSUE_CODES`) και των ειδών σφάλματος — **δεν υπάρχουν ακόμη** στα locales.
   - Η οθόνη χρησιμοποιεί τους **ίδιους** καθαρούς κριτές με τον διακομιστή, όχι αντίγραφα:
     `validateAgreementDraft` · `judgeClauseSelections` · `refuseTransition` / `refuseContentEdit` / `refuseAssignment` ·
     `hasUnapprovedDeviations` · `bilingualIssues` · `SUBCONTRACT_AUTHORITY_PERMISSIONS` (κουμπιά ανά δικαίωμα).
   - Διαδρομές: `POST /api/subcontracts/agreements` · `PATCH …/[id]` · `POST …/[id]/transitions/[transition]` ·
     `POST …/[id]/assignments` · `POST …/[id]/deviations/decide`. Αναγνώσεις: ο πελάτης απευθείας (κανόνες `isInternalUserOfCompany`).

## Πρότυπο εργασίας (εντολή Giorgio)
- Πρότυπο Revit / ArchiCAD / Cinema 4D / Figma / Procore / Zillow / Idealista — full enterprise + full SSoT· όπου οι μεγάλοι
  κάνουν διαφορετικά, ακολουθούμε την πρακτική τους. Καμία έκπτωση. Όπου υπάρχει αβεβαιότητα ⇒ **έρευνα στο διαδίκτυο**.
- **Πριν από κώδικα: πραγματικό SSoT audit με grep** (φόρμες, προεπισκόπηση εγγράφων, λίστες, i18n σφαλμάτων τομέα, hooks
  ανάγνωσης Firestore). Χρησιμοποίησε ό,τι υπάρχει· μη φτιάξεις διπλότυπο.
- N.14: δήλωσε μοντέλο και περίμενε «ok» πριν τη Φ3. N.8: η Φ3 είναι 5+ αρχεία / 2+ τομείς ⇒ ρώτα Plan Mode ή Orchestrator.

## Παγίδες που μετρήθηκαν στη Φ2
- Μετάλλαξη «η έγκριση αγνοεί την τιμή» επέζησε στην πρώτη σουίτα ⇒ χρειάζεται test 12% → 13% (άλλη τιμή που επίσης θέλει έγκριση).
- Δύο διαδρομές έγκρισης/απόρριψης = κλώνος για το 3.28 ⇒ **μία** διαδρομή, απόφαση στο σώμα.
- Ένθετες υποσυλλογές στους κανόνες: `defineServerWrittenNestedAnchors` (harness), όχι αντίγραφο σουίτας.
- Γεννήτορας ADR index: `docs/centralized-systems/reference/scripts/generate-adr-index.cjs` (όχι `scripts/`).
- Αλλαγή σε `docs/gates/*.md` ⇒ `node scripts/generate-gate-index.js` (αλλιώς κόβει το 3.66).
- Μεταλλάξεις: script στο scratchpad που επαναφέρει στο `finally` (ο φύλακας αρνείται μεταβλητές στο `sed`).
- Ο φάκελος `HANDOFFS/` είναι στο gitignore ⇒ `git add -f` για νέο handoff.

## Κανόνες
- Commit **μόνο** στο `agent/adr-923-phase6b`, ρητή λίστα αρχείων. **Ποτέ** στο `main`. `wt:land` και push **μόνο** με εντολή Giorgio.
- Όχι `tsc` (N.17), όχι `--no-verify`, όχι `SKIP_*`, όχι `git add -A`, όχι bare `git stash`.
- Ειδοποίησε τη `nestor-pagonis-92` πριν αγγίξεις κοινά αρχεία (locales, rules, indexes, auth, collections).
