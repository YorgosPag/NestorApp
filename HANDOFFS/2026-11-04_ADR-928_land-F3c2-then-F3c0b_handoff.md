# Handoff — ADR-928: land + push της Φ3γ-2 → ζωντανός έλεγχος → Φ3γ-0b (επεξεργαστής προτύπου + συγγραφή ρήτρας)

**Ημερομηνία:** 2026-11-04 · **Worktree:** `C:\Nestor_Worktrees\adr-928-phase3b` · **Κλαδί:** `agent/adr-928-phase3b`
(η νέα συνεδρία συνεχίζει **στο ίδιο** worktree και κλαδί — δεν φτιάχνει νέο).

## Πηγή της αλήθειας
- ADR-928 (`docs/centralized-systems/reference/adrs/ADR-928-subcontract-offer-agreement.md`):
  **§5.21** (Φ3γ-2) · **§5.19** (βιβλιοθήκη στην οθόνη, Φ3γ-0) · §5.20 (Φ3γ-0c + ανοιχτά ευρήματα) · §5.18 (επεξεργαστής) ·
  §5.2 / §5.2.1 / §5.2.2 / §5.3 (ρήτρες, διακυβέρνηση, γλώσσες, πρότυπα) · §5.13 (Φ1, γραφείς ρητρών/προτύπων).
- Προηγούμενο handoff: `HANDOFFS/2026-11-04_ADR-928_F3c2-done_handoff.md`.
- Ο κώδικας κερδίζει όπου διαφωνεί με το ADR.

## Κατάσταση
- Στο κλαδί, **χωρίς push**:
  - `19a47051` — όχι «δεν έχεις δικαίωμα» πριν απαντήσει ο κριτής (§5.20)·
  - `4cb6416e` — Φ3γ-2: γραμμές · όροι · σχέδιο πληρωμών ως γενικές ενότητες, γέφυρα όρος ↔ ρήτρα, διόρθωση αόρατου
    ευρήματος δεσμευμένης παραμέτρου (§5.21). jest 34 σουίτες / 378 · μεταλλάξεις 3/3 · hook πράσινο.
- Στην παραγωγή: ως το `58c9aab5` (Φ3γ-0c).
- ❌ Η Φ3γ-2 **δεν** έχει ελεγχθεί σε browser.

## Βήμα 1 — land + push (μόνο με ρητή εντολή Giorgio στο prompt)
1. `git fetch` · rebase του κλαδιού στο τρέχον `main`. Συγκρούσεις συνήθως μόνο σε `src/types/i18n.ts` +
   `src/i18n/generated/shell-slice.manifest.json` ⇒ `checkout --ours` + ξαναπαραγωγή + `git add` +
   `GIT_EDITOR=true git rebase --continue`.
2. `npm run generate:i18n-types` + `npm run generate:i18n-shell-slice` · commit της ξαναπαραγωγής αν άλλαξε κάτι (στο κλαδί).
3. `npm run wt:land -- adr-928-phase3b` · push από το worktree: `git push origin main` (deploy στο Netcup).
4. Περίμενε το deploy (GitHub Actions → Netcup) πριν τον ζωντανό έλεγχο.

## Βήμα 2 — ζωντανός έλεγχος στο nestorconstruct.gr (όχι τοπικά)
Έργο «ΔΟΚΙΜΗ — διαγραφή» (`proj_142e0e06-7ae1-4d92-82f3-41278b937ffa`), πρόχειρο **ΠΡΟΣ-2026-001**
(`sca_dd291abb-67d6-48b0-a1dd-7068ff726753`):
1. «Προσθήκη γραμμής» ⇒ σύνολο + προεπισκόπηση ακολουθούν· γραμμή χωρίς ποσότητα ⇒ «τουλάχιστον».
2. Στάδια 90% ⇒ εύρημα · «Υπόλοιπο» ⇒ 100%.
3. Κράτηση 4% ⇒ «Θέλει έγκριση» στο πεδίο της κράτησης με τον **τίτλο** της ρήτρας · λόγος εκεί ⇒ αποθήκευση ⇒ απόκλιση
   εκκρεμής · η κάρτα της ρήτρας δείχνει λόγο + σύνδεσμο.
4. «Περιοδικά, κάθε 2 εβδομάδες, Παρασκευή» ⇒ φράση «Όπως θα τυπωθεί» + ημερολόγιο.
5. Κανόνας επιμέτρησης με λίστα «- …» ⇒ αποθήκευση ⇒ F5 ⇒ ίδιος.
6. en · πλοήγηση ενοτήτων με πλήθος ευρημάτων · κινητό (καρτέλες) — το `resize_window` δεν άλλαζε μεγιστοποιημένο
   παράθυρο: δοκίμασε πρώτα αποκατάσταση παραθύρου ή DevTools device mode.
7. ΜΗΝ πατήσεις «Ελέγχθηκε νομικά».
Ό,τι βρεθεί ⇒ διόρθωση στο κλαδί (νέα συνεδρία δεν χρειάζεται) + ADR §5.21 «Επαλήθευση στην παραγωγή».

## Βήμα 3 — Φ3γ-0b σε Plan Mode (έγκριση Giorgio πριν τον κώδικα)
Στόχος: **επεξεργαστής προτύπου ειδικότητας** + **συγγραφή ρήτρας** (νέα ρήτρα / νέα έκδοση με σώμα, παραμέτρους, ζώνες).
Τι υπάρχει ήδη (SSoT — χρησιμοποίησέ τα, όχι διπλότυπα):
- Ενότητες γενικές (Φ3γ-2): `components/procurement/subcontracts/sections/` — `LinesSection` (`path="lines"`) ·
  `TermsSection` (`path="defaultTerms"`) · `PaymentPlanSection` (`path="defaultTerms.paymentPlan"`) · `SharesEditor` ·
  `LocalizedTextFields` · `BoundTermZone` (`BoundTermsView.setReason = null` για πρότυπο).
- Κριτές: `validateTradeTemplateDefinition` + `validateTemplateAgainstLibrary` (το πρότυπο θέλει **ελεύθερη** ζώνη· μονοπάτια
  `clauses.N.parameterOverrides.<key>` και `clauses.N.bound.<key>`) ⇒ χρειάζεται προβολή δεσιμάτων με **αυτό** το μονοπάτι
  (ίδιο `COMMERCIAL_TERM_BINDINGS[…].termPath`, άλλος `clausePath`) — όχι δεύτερη γέφυρα.
- Πυρήνας πρόχειρου: `hooks/drafts/useRevisionedDraft.ts` (`hold`/`reset`, `behind`, `adoptLatestBase`) · `useShownDraftIssues`.
- Ρήτρες: `clauses/validate-clause-version.ts` · `validate-clause-body.ts` · `validate-parameter-definition.ts` ·
  `clause-body-builders.ts` · `clause-blocks-text.ts` (κείμενο ↔ μπλοκ, **χωρίς** παραμέτρους — η συγγραφή θέλει και
  `{param}` inline) · `render-clause-body` / `renderClauseBlocks` · `tolerance-verdict` · `clause-governance` (τέσσερα μάτια,
  `refuseOwnRequest`) · `stageProposedVersion` (`clause-library-writer`) · `ClauseVersionDiffView` · `ClauseReviewPanel`.
- Οθόνη βιβλιοθήκης: `useLibraryScreen` · `useLibraryActions` · `useSubcontractLibraryAuthority` · `library-action-blocks` ·
  `VersionActionBar` · `TemplatesTab` · `ClauseParameterInput` · `ParameterZoneBadge` · `EditorField` · `FieldIssues`.
- Γενικά: `MoneyField`/`PercentField`/`MilliQuantityField` · `EnumSelect` · `SortableList` + `reorderByMove` ·
  `replaceAt`/`removeAt` · `UomSelect` · `documentLocaleOf` · `enterprise-id-convenience` · `useConfirmDialog`.
Έρευνα όπου δεν είσαι σίγουρος: Ironclad (clause library / playbooks), DocuSign CLM, SAP Ariba (clause library, templates),
LegalOn, Juro, Procore templates.

## Ανοιχτά (§5.20, εκτός Φ3γ-0b — μπορούν να μπουν στο Plan)
1. Στα αγγλικά η κεφαλίδα δείχνει τον αγγλικό τίτλο του προτύπου ενώ το πεδίο αλλάζει τον ελληνικό ⇒ τίτλος στη **γλώσσα του
   εγγράφου**.
2. «Νέο» (`NewAgreementDialog.tsx:130`): ο `SearchableCombobox` υπεργολάβου δεν ανοίγει αξιόπιστα με κλικ (Dialog ↔ Popover).
3. `TemplatesTab.tsx:61`: κωδικοί ρητρών αντί για τίτλους στα πρότυπα σε αναμονή.
4. Ratchet: κατάλογος `DiscountTiersField` / `PriceListGeneralTab` → `modelOfDisplay` (`pending-ratchet-work.md`).

## Παγίδες που μετρήθηκαν
- Το pre-commit hook διαρκεί **> 10′** ⇒ τρέξε το `git commit` στο **παρασκήνιο** με έξοδο σε αρχείο του scratchpad, μετά
  `grep "ΑΠΕΤΥΧΕ|exited 1|❌"`.
- CHECK 3.38: `text-primary` σε κείμενο μπλοκάρει (σκοτεινό θέμα 1,00:1) ⇒ `text-foreground` / tokens σκοπού.
- CHECK 3.81: «Nestor» σκέτο σε locale ⇒ «Nestor App».
- Φρένο βαριών εργασιών `C:\Users\user\.claude\heavy-task.lock`: άλλη συνεδρία το κρατά συχνά ⇒ `until` στο παρασκήνιο,
  δούλεψε στο μεταξύ, ποτέ παράκαμψη.
- Το Bash του worktree αρνείται εντολές με τη λέξη `source` ή σύνθετο `git` (`$(...)`) ⇒ Grep tool / απλές εντολές.
- Πεδίο κειμένου που ξαναχτίζεται από δομημένη τιμή σε κάθε πλήκτρο τρώει κενά/«- » ⇒ τοπικό πρόχειρο κειμένου.
- Chrome: το `type` δεν γράφει ελληνικά · το στιγμιότυπο κολλά λίγο μετά από εγγραφή.
- `HANDOFFS/` στο gitignore ⇒ `git add -f`. Προϋπάρχον κόκκινο: `src/lib/auth/__tests__/` (6 σουίτες).

## Κανόνες
- Commit **μόνο** στο `agent/adr-928-phase3b`, με ρητή λίστα αρχείων. **ΠΟΤΕ** commit στο `main`.
- `wt:land` και push **μόνο** με ρητή εντολή Giorgio.
- Όχι tsc, όχι `--no-verify`, όχι `git add -A`. Ζωντανή επαλήθευση στην παραγωγή.
- Ποιότητα: όπως Revit / ArchiCAD / Cinema 4D / Figma / Procore / Ironclad — full enterprise + full SSoT, χωρίς εκπτώσεις·
  πραγματικό SSoT audit με grep πριν από κάθε κώδικα· έρευνα στο διαδίκτυο όπου υπάρχει αβεβαιότητα.
