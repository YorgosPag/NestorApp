# Handoff — ADR-928 Φ3γ-0c στην παραγωγή → κουμπί «Έλεγχος για ενημερώσεις» → εγκρίσεις v2 → πρότυπα → «Νέο» → Φ3γ-2

**Ημερομηνία:** 2026-11-04 · **Worktree:** `C:\Nestor_Worktrees\adr-928-phase3b` · **Κλαδί:** `agent/adr-928-phase3b`
(η νέα συνεδρία συνεχίζει **στο ίδιο** worktree και κλαδί — δεν φτιάχνει νέο).

## Πηγή της αλήθειας
- ADR: `docs/centralized-systems/reference/adrs/ADR-928-subcontract-offer-agreement.md`. Διάβασε πρώτα τη **§5.20**
  (Φ3γ-0c, κανόνας upstream). Μετά τη §5.19 (οθόνη βιβλιοθήκης) και τη §5.18 (επεξεργαστής).
- Πλάνο Φ3γ-0c: `C:\Users\user\.claude\plans\splendid-snuggling-dream.md`. Πλάνο Φ3γ-2/3:
  `C:\Users\user\.claude\plans\twinkling-hatching-badger.md`.
- Προηγούμενο handoff: `HANDOFFS/2026-11-04_ADR-928_F3c0a-live_handoff.md`.

## Κατάσταση (2026-11-04)
- ✅ **Στην παραγωγή**: `4f8b84f7` (land + push `c16a02f6..4f8b84f7`, deploy success). Περιέχει τη Φ3γ-0c:
  - κανόνας upstream στη σπορά·
  - `stageProposedVersion` / `stageClosedProposal`·
  - `comparisonBaseOf`·
  - άγκυρα «διπλή λέξη»·
  - διορθωμένα κείμενα: `subject.multi_project`, `personnel.obligations`, `schedule.deadlines`, `price.fixed`.
- ✅ **Εγκρίσεις στην παραγωγή από τον πράκτορα (εντολή Giorgio): 25/29.** Δεν πατήθηκε «Ελέγχθηκε νομικά» (μένουν 25
  «Θέλει νομικό έλεγχο»). Η `execution.obligations` (πρόστιμο 10 €) εγκρίθηκε με ρητό «ΝΑΙ» του Giorgio· είναι πιστή στο
  έγγραφο του 2005.
- ⏳ **Σε αναμονή στην παραγωγή (έκδοση 1, με το λάθος κείμενο):** `personnel.obligations`, `subject.multi_project`,
  `schedule.deadlines`, `price.fixed`. **ΜΗΝ τις εγκρίνεις** — περιμένουν την έκδοση 2 από τη σπορά.
- ⏳ Πρότυπα σε αναμονή: `reinforcement.placement` (περιμένει 1 ρήτρα) · `plastering.three_coat` (περιμένει 3).

## 🔴 Το κενό που βρέθηκε μετά το deploy (ΠΡΩΤΗ δουλειά)
Η ενημέρωση **δεν ξεκινά από την οθόνη**. Το μόνο κουμπί σποράς σε ήδη σπαρμένο χώρο είναι το «Γράψε τα έτοιμα πρότυπα»
(`components/procurement/subcontracts/library/TemplatesTab.tsx:67`), που φαίνεται **μόνο** όταν ένα πρότυπο είναι
έτοιμο. Τα πρότυπα περιμένουν τις 4 ρήτρες, και οι ρήτρες περιμένουν τη σπορά: αδιέξοδο. Ο διακομιστής είναι σωστός
(jest 282/282)· λείπει μόνο η πόρτα.

**Διόρθωση (εγκρίθηκε από τον Giorgio):** ένα σταθερό κουμπί **«Έλεγχος για ενημερώσεις του Nestor App»** στην κεφαλίδα
της βιβλιοθήκης (`SubcontractLibraryContent.tsx`, δίπλα στο `PageHeader` ή στο `ReviewProgress`).
- Ορατό με `authority.canSeed`. Χωρίς δικαίωμα: ανενεργό, με ορατή αιτία (`subcontracts.library.reasons.notAuthorized`).
- Καλεί το **υπάρχον** `actions.seed()` (`useLibraryActions.ts:77`) — η ίδια ιδεμποτική σπορά.
- Η αναφορά πάει στο **υπάρχον** `SeedReportNotice` (ήδη δείχνει `report.updates`).
- Χωρίς αλλαγές: «Η βιβλιοθήκη είναι ενημερωμένη». Χρειάζεται νέο κλειδί i18n el/en, και στο el **«Nestor App»**, όχι
  «Νέστορα» (CHECK 3.81).
- Spinner και κλείδωμα όσο τρέχει (μοτίβο `LibraryOnboarding`).
- Πριν τον κώδικα: SSoT audit με grep για υπάρχον κουμπί/ενέργεια σποράς ή «check for updates».

Μετά: ADR-928 §5.20 (σημείο «Η ενημέρωση φτάνει με το ίδιο κουμπί» ⇒ διόρθωση) + changelog · `generate:i18n-types` +
`generate:i18n-shell-slice` · commit στο κλαδί · land/push **μόνο** με εντολή Giorgio.

## Επόμενο, με αυτή τη σειρά (μετά το deploy της διόρθωσης)
1. Παραγωγή: «Έλεγχος για ενημερώσεις» ⇒ ειδοποίηση «4 προτάθηκαν».
2. Στην ουρά, οι 4 ρήτρες ως **Έκδοση 2** με «Διαδέχεται την πρόταση της έκδοσης 1» και σύγκριση έναντι της 1. Διάβασε
   κάθε κείμενο:
   - χωρίς «ημέρες ημέρες»·
   - η `price.fixed` χωρίς 178/179/388 ΑΚ·
   - η έκδοση 1 φαίνεται «Απορρίφθηκε» με απόφαση «Προτεινόμενη βιβλιοθήκη».

   Μετά **έγκριση** (προτείνων = σύστημα ⇒ επιτρέπεται). Ξανά «Έλεγχος» ⇒ «ενημερωμένη» (ιδεμποτία).
3. Καρτέλα «Πρότυπα ειδικότητας» ⇒ «Έτοιμο» ⇒ «Γράψε τα έτοιμα πρότυπα» ⇒ 2 πρότυπα.
4. Ροή «Νέο» στο έργο «ΔΟΚΙΜΗ — διαγραφή» (`proj_142e0e06-…`, προμήθειες → Υπεργολαβίες):
   - από πρότυπο ⇒ φόρμα | προεπισκόπηση·
   - απόκλιση εκτός ζώνης ⇒ λόγος ⇒ αποθήκευση·
   - «Έκδοση» ανενεργή με αιτία·
   - δεύτερη καρτέλα ⇒ λωρίδα σύγκρουσης·
   - F5 · el/en · κινητό.

   Επίσης αγγλικά/κινητό της βιβλιοθήκης.
5. **Φ3γ-2**: γραμμές, όροι και σχέδιο πληρωμών ως **γενικές** ενότητες (τιμή + `onChange` + ευρήματα με πρόθεμα `path`).
   Μετά **Φ3γ-0b** (συγγραφή ρήτρας + επεξεργαστής προτύπου) και μετά **Φ3γ-3** (αναθέσεις). Plan Mode πριν τον κώδικα.

## Γνωστά / βελτιώσεις
- Στο «Περιμένει έγκριση» των προτύπων οι ρήτρες φαίνονται ως κωδικοί. Πρόσθεσε τίτλο (`TemplatesTab.tsx:61`).
- Η απόφαση κλεισίματος από το σύστημα έχει `decisionReason: null`. Η ταυτότητα του αποφασίζοντος φαίνεται μέσω του
  `usePersonLabels` («Προτεινόμενη βιβλιοθήκη»).

## SSoT που υπάρχουν (χρησιμοποίησέ τα — όχι διπλότυπα)
- Φ3γ-0c:
  - `library/default-library-update.ts` (`defaultLibraryUpdateOf`, `lastOfferedVersion`)·
  - `stageProposedVersion` (`server/subcontracts/clause-library-writer.server.ts`)·
  - `stageClosedProposal` (`clause-governance-writer.server.ts`)·
  - `comparisonBaseOf` (`library/review-queue.ts`)·
  - `DefaultLibrarySeedReport.clausesUpdateProposed/Deferred`.
- Φ3γ-0a:
  - `useLibraryScreen` · `useLibraryActions` (`seed`) · `SeedReportNotice` / `LibraryOnboarding`·
  - `VersionActionBar` · `ClauseReviewPanel` · `ClauseVersionDiffView`·
  - `useClauseVersions` · `useSubcontractLibraryAuthority` (`canSeed`)·
  - `SelectableList` · `ReasonDialog` · `DocumentBlocks`·
  - `clausePrintedText` / `clausePrintedBlocks`.
- Φ3γ-1:
  - `useRevisionedDraft` · `useAgreementEditor` · `judgeAgreementDraft`·
  - `issuesAt` / `issuesUnder` · `draft-clause-edits` · `EditorField` · `ClauseParameterInput`·
  - `generateSubcontractAgreementLineId`.
- Γενικά:
  - `UomSelect` · `NumericField` · `minorFromMajor` / `majorFromMinor`·
  - `basisPointsFromPercent` / `percentFromBasisPoints` · `GREEK_VAT_RATE_PERCENTS`·
  - `renderClauseBlocks` · `canonicalJson`·
  - `useCatalogSelection` · `CatalogSplit`·
  - `PRODUCT_NAME` (`constants/product-identity.ts` = «Nestor App»).

## Παγίδες που μετρήθηκαν (αυτή η συνεδρία)
- **CHECK 3.81**: «Nestor» σκέτο σε locale JSON μπλοκάρει. Γράψε «Nestor App».
- Το pre-commit διαρκεί πολλά λεπτά. Τρέξ' το foreground με timeout 600000 και έξοδο σε αρχείο του scratchpad, και μετά
  `grep "ΑΠΕΤΥΧΕ|exited 1"`. Σε background το σκότωσε ο φύλακας μνήμης.
- Rebase στο `main`: συγκρούσεις μόνο σε `src/types/i18n.ts` + `shell-slice.manifest.json` ⇒ `checkout --ours` +
  ξαναπαραγωγή + `git add` + `GIT_EDITOR=true git rebase --continue`.
- Push από το worktree: `git push origin main` (το `cd C:/Nestor_Pagonis` απαγορεύεται στη συνεδρία).
- Ο έλεγχος αδειών του Claude Code μπλόκαρε έγκριση ρήτρας για την οποία ο πράκτορας είχε εκφράσει αμφιβολία, ώσπου είπε
  ρητό «ΝΑΙ» ο Giorgio. Σε κάθε αμφιβολία: ρώτα πριν πατήσεις.
- `HANDOFFS/` στο gitignore ⇒ `git add -f`. Προϋπάρχον κόκκινο: `src/lib/auth/__tests__/` (6 σουίτες).

## Κανόνες
- Commit **μόνο** στο `agent/adr-928-phase3b`, με ρητή λίστα αρχείων. **ΠΟΤΕ** commit στο `main`.
- `wt:land` και push **μόνο** με εντολή Giorgio. Πριν το land: rebase στο τρέχον `main` + `generate:i18n-types` +
  `generate:i18n-shell-slice`.
- Όχι tsc, όχι `--no-verify`, όχι `git add -A`.
- Ζωντανή επαλήθευση στην παραγωγή, όχι τοπικά.
