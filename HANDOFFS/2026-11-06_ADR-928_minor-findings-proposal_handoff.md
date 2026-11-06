# Handoff — ADR-928: πρόταση για τα τρία μικρότερα ευρήματα (§5.24.5) · ΧΩΡΙΣ κώδικα

**Ημερομηνία**: 2026-11-06 · **Worktree**: `C:\Nestor_Worktrees\adr-928-live-verify-2` · **Κλαδί**: `agent/adr-928-live-verify-2`
Η νέα συνεδρία συνεχίζει **σε αυτό** το worktree (EnterWorktree path).
Προηγούμενο handoff (ιστορικό): `HANDOFFS/2026-11-06_ADR-928_fixes-8-9_handoff.md`.

## Κατάσταση
- Τα #8/#9 διορθώθηκαν (`d46fa317`): **landed στο `main` + pushed** (`3d19874c..d46fa317`). Deploy Netcup σε εξέλιξη.
  - #9: `SearchableCombobox` — κλικ ανοίγει · βέλος/καθαρισμός μέσω `keepKeyboardOnNonActivatingSurface` (ADR-739 §70) ·
    `onInteractOutside` αγνοεί το anchor (το βέλος κλείνει). Άγκυρα `searchable-combobox-pointer-open.test.tsx` 4/4 κόκκινη→πράσινη.
  - #8: κυρίως ψευδώς θετικό (τυλιγμένο `<label>` ονομάζει)· διορθώθηκε όνομα `radiogroup` + ρητό `id`/`htmlFor` στο `NewAgreementDialog`.
- ⏳ **Επαλήθευση #8/#9 στην παραγωγή**: εκκρεμεί, μόνο με εντολή Giorgio (μετά το deploy).
- Το κλαδί = `main` + αυτό το handoff (commit μόνο στο κλαδί).

## ΕΠΟΜΕΝΟ (εγκεκριμένο): ΠΡΟΤΑΣΗ — όχι υλοποίηση
Για καθένα από τα τρία: **SSoT audit με grep** (υπάρχει ήδη κοινό component/πρότυπο;) → τι κάνουν οι μεγάλοι
(Procore, Autodesk Construction Cloud, DocuSign/PandaDoc, Figma/Google — έρευνα στο διαδίκτυο σε αμφιβολία) → **πρόταση
με αρχεία + ρίσκο**, και **σταμάτα** για απόφαση Giorgio. Κανένας κώδικας, κανένα test, καμία ενημέρωση ADR χωρίς «ναι».

1. **«Έκδοση» / «Αποδοχή» χωρίς επιβεβαίωση** (αμετάκλητες πράξεις συμφωνητικού). Ψάξε υπάρχον κοινό διάλογο επιβεβαίωσης
   (π.χ. `ConfirmDialog`/`AlertDialog` στο `src/components/ui/`, ή `ReasonDialog.tsx` στο `procurement/subcontracts/`)
   και πώς το κάνουν άλλες αμετάκλητες πράξεις του έργου. Κριτήριο μεγάλων: επιβεβαίωση **με συνέπειες** (τι κλειδώνει,
   ποιος ειδοποιείται), όχι γενικό «Είστε σίγουροι;» — ή undo όπου γίνεται (Gmail).
2. **«Έκδοση εντολής» χωρίς toast** (οι άλλες πράξεις έχουν). Βρες πού ζει η πράξη (grep `subcontracts.workOrders` /
   `issue` στο `work-orders/` + `WorkOrdersPanel.tsx`) και το πρότυπο toast των αδελφών (`useNotifications().success`).
3. **Λεπτομέρεια σύμβασης ~15–20 s** σε άμεσο άνοιγμα. **Μέτρησε πρώτα** (με έγκριση για browser) πριν προτείνεις:
   πιθανός φόρτος μηχανής. Αν επιβεβαιωθεί: waterfall δικτύου / ψυχρό compile dev / ερωτήματα Firestore.

## Παγίδες (μετρημένες)
- **Κανόνας N.(-2)** (CLAUDE.md του `main`, 2026-11-05): κανένα test/jscpd/scan, καμία πρωτοβουλία, καμία ενημέρωση
  ADR/pending/MEMORY **χωρίς ρητή έγκριση**. Πρόταση σε μία γραμμή και στάση.
- Browser: το εργαλείο κολλά συχνά (`document_idle` 45 s)· μετά από 2–3 αποτυχίες σταμάτα και ρώτα.
- Ο φύλακας του worktree αρνείται σύνθετες εντολές git (`cd … &&`, μεταβλητές) ⇒ σκέτες εντολές.
- `grep -rn … src` χωρίς στενό φάκελο ⇒ timeout· στόχευσε φακέλους.
- Hook: `CHECK_WORKER_TIMEOUT_MS=360000 git commit -F <msg>` στο παρασκήνιο. Το CHECK 3.7 μπλοκάρει χειρόγραφο
  `preventBlur`/`keepInputFocus` — υπάρχει `src/lib/a11y/non-activating-surface.ts`.

## Κανόνες (Giorgio)
- Commit **μόνο** στο `agent/adr-928-live-verify-2`, ρητή λίστα αρχείων. **Ποτέ** στο `main`.
- `wt:land` και push **μόνο** με εντολή Giorgio.
- Όχι `tsc` · όχι `--no-verify` · όχι `git add -A` · όχι σκέτο `git stash`. Tests **μόνο** με έγκριση.
- Γνωστή κόκκινη εκτός εύρους: `src/lib/auth/__tests__/personal-scope-consumers.test.ts`.
- Ποιότητα μεγάλων παικτών, full SSoT, grep πριν από κάθε αρχείο, έρευνα στο διαδίκτυο σε αμφιβολία. Ποτέ κωδικοί στον browser.
