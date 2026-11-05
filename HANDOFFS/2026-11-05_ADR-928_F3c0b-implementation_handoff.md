# Handoff — ADR-928 Φ3γ-0b: συγγραφή ρήτρας + επεξεργαστής προτύπου (ΥΛΟΠΟΙΗΣΗ, το σχέδιο εγκρίθηκε)

**Ημερομηνία:** 2026-11-05 · **Worktree:** `C:\Nestor_Worktrees\adr-928-phase3b` · **Κλαδί:** `agent/adr-928-phase3b`
(η νέα συνεδρία συνεχίζει **στο ίδιο** worktree και κλαδί — δεν φτιάχνει νέο).

## Πηγή της αλήθειας
- ADR-928 (`docs/centralized-systems/reference/adrs/ADR-928-subcontract-offer-agreement.md`): **§5.21** (Φ3γ-2 + επαλήθευση
  στην παραγωγή) · **§5.19** (βιβλιοθήκη στην οθόνη) · §5.20 · §5.18 · §5.13 (γραφείς/κριτές Φ1) · §5.2–§5.3.
- Ο κώδικας κερδίζει όπου διαφωνεί με το ADR.

## Κατάσταση
- Στην παραγωγή (nestorconstruct.gr): ως και το `9b6cbc8e` — Φ3γ-2 + τρεις διορθώσεις του ζωντανού ελέγχου, όλα
  επαληθευμένα ζωντανά (και κινητό 390 px). Το κλαδί = `main` + μόνο το commit αυτού του handoff.
- Ο Giorgio **ενέκρινε** το σχέδιο της Φ3γ-0b (παρακάτω). Κανένας κώδικας Φ3γ-0b δεν έχει γραφτεί.
- Πρώτα: `git fetch` + `git rebase origin/main` (άλλες συνεδρίες κάνουν push συχνά).

## SSoT audit (grep, 2026-11-04) — ΥΠΑΡΧΟΥΝ, ξαναχρησιμοποίησέ τα
- **Διακομιστής: όλοι οι γραφείς υπάρχουν, κανένας νέος** (ούτε κάτοχος στο CHECK 3.113, ούτε δείκτης, ούτε κανόνες):
  `POST /api/subcontracts/clauses` (`createSubcontractClause`, `{clauseKey,title,body,parameters,proposalReason}`, propose) ·
  `POST …/clauses/[id]/versions` (`proposeSubcontractClauseVersion`, `{expectedRevision,body,parameters,proposalReason}`,
  409 `proposalPending`) · `POST /api/subcontracts/trade-templates` + `PUT …/[id]` (`{expectedRevision, definition}`, CAS,
  ολική αντικατάσταση, `code` αμετάβλητο). Schemas: `schema/clause.schema.ts:118-150`, `schema/trade-template.schema.ts:126-138`.
- **Κριτές (καθαροί, και στον browser)**: `validateClauseIdentity` · `validateClauseContent` (`clauses/validate-clause-version.ts`)
  · `validateParameterDefinitions` · `validateParameterValue` · `toleranceVerdict`/`isFreeVerdict` ·
  `validateTradeTemplateDefinition` + `validateTemplateAgainstLibrary` (`templates/validate-trade-template.ts`, μονοπάτια
  `clauses.N.parameterOverrides.<k>` / `clauses.N.bound.<k>`, το πρότυπο θέλει **ελεύθερη** ζώνη).
- **Μοντέλο σώματος**: `ClauseInline = {kind:'text'} | {kind:'param',key}` · `paragraph`/`list` (`types/clause.ts:34-47`) ·
  `clause-body-builders` · `renderClauseBlocks` · `clausePrintedBlocks` · `ClauseVersionDiffView` · `clause-usage` · `tolerance-text`
  · `translation-status.ts` (`withInlineText`, `translationSeedOf`, `InlinePosition`).
- **Οθόνη**: `useRevisionedDraft` / `useShownDraftIssues` (γενικά, `hooks/drafts/`) · ενότητες `sections/` (`LinesSection` ·
  `TermsSection` · `PaymentPlanSection` · `SharesEditor` · `LocalizedTextFields` · `BoundTermZone`, `section-types.ts` ήδη
  προβλέπει `defaultTerms` + `setReason:null`) · `ClauseParameterInput` · `ParameterZoneBadge` · `EditorField` · `FieldIssues` ·
  `EnumSelect` · `SortableList` + `reorderByMove` · `useCatalogSelection` (`NEW_SELECTION`, `selectIfCurrent`) · `ReasonDialog` ·
  `useSubcontractLibraryAuthority` · `library-action-blocks` · `Table` (`components/ui/table`).
- `draftFromTemplate` + `projectDraftAgreement` + `AgreementDocumentColumns` (δείγμα εγγράφου του προτύπου).
- **TipTap 3.23** (`@tiptap/core|pm|react|starter-kit`, MIT) εγκατεστημένο — σήμερα μόνο στη μηχανή κειμένου DXF.

## ΛΕΙΠΟΥΝ (χωρίς διπλότυπα)
1. 4 κλήσεις στο `services/procurement/subcontracts/subcontract-library-api.client.ts` (`createClause` · `proposeClauseVersion` ·
   `createTradeTemplate` · `updateTradeTemplate`, τύποι `z.infer` των ίδιων schemas) + 4 πράξεις στο `useLibraryActions`.
2. `agreements/bound-terms.ts:50` καρφώνει `clauses.N.parameterValues.<k>` ⇒ **παραμετροποίηση μονοπατιού**, όχι δεύτερη γέφυρα.
3. Επεξεργαστής σώματος με παραμέτρους (το `clause-blocks-text` αρνείται παραμέτρους· το `RunEditor` της μετάφρασης τις κλειδώνει).
4. `EditorToolbar` / `ConflictBanner` / `editor-sections` δεμένα στον τύπο `AgreementEditor` ⇒ δομικός `DraftEditorChrome`.

## ΕΓΚΕΚΡΙΜΕΝΟ ΣΧΕΔΙΟ
**Φ3γ-0b-1 — συγγραφή ρήτρας (1ο commit)**
- Καθαρό (`subapps/procurement/subcontracts/clauses/`, jest): `clause-body-doc.ts` (`ClauseBlock[]` ↔ ProseMirror JSON, atom
  `clauseParam{key}`, χωρίς marks, **στρογγυλή διαδρομή για τις 29 σπαρμένες ρήτρες**) · `parameter-definition-edits.ts`
  (`newParameterDefinition` με κλειδί από ετικέτα/`CLAUSE_PARAMETER_KEY` · `withKind` = νέο σχήμα · `withSource` μόνο δεσίματα
  ίδιου είδους από `COMMERCIAL_TERM_BINDINGS` · `renameParameter` ξαναγράφει σώμα **και μεταφράσεις** · `removeParameter` ·
  `unreferencedParameters`) · `parameter-from-text.ts` («5%»/«150 €»/«30 ημέρες» ⇒ `{kind, preferred}` μέσω
  `evaluateNumericExpression` + `scaled-value`, αλλιώς `text`) · `clause-draft.ts` (seed από έκδοση σε ισχύ/τελευταία ή κενό ·
  ένας κριτής).
- Οθόνη (`components/procurement/subcontracts/library/authoring/`, lazy `import()`): διαδρομές
  `/procurement/subcontracts/library/clauses/new` και `…/clauses/[clauseId]/propose` (λεπτές σελίδες + `Suspense` + route
  slice ADR-744, URLs στο `procurement-urls.ts`) · κέλυφος φόρμα | προεπισκόπηση (κινητό: καρτέλες) · `ClauseBodyEditor`
  (TipTap: chip παραμέτρου · `{` ή κουμπί ⇒ μενού · **«Κάνε το παράμετρο»** από επιλογή κειμένου · διαγραφή chip ⇒
  `parameterUnreferenced` + «Αφαίρεση αχρησιμοποίητων») · `ParameterDefinitionCard` + `ToleranceEditor` με **χάρακα ζωνών**
  (απαγορεύεται | έγκριση | ελεύθερο | ★) και λέξεις του `tolerance-text` · προεπισκόπηση «Όπως τυπώνεται» / «Αλλαγές»
  (`ClauseVersionDiffView`) / «Επίπτωση» (`ClauseUsagePanel`) · υποβολή με λόγο (`ReasonDialog`), CAS, 409 με ορατή αιτία,
  μετά `?tab=review&clause=` · πόρτες «Νέα ρήτρα» (Ρήτρες) + «Πρότεινε αλλαγή» (`ClauseDetail`, ανενεργό με αιτία) μέσω
  `library-action-blocks` · τα τέσσερα μάτια ακέραια · προειδοποίηση «η αγγλική θα μείνει πίσω».

**Φ3γ-0b-2 — επεξεργαστής προτύπου (2ο commit)**
- `bound-terms.ts`: `boundTermsOf(…, clausePathOf)` (προεπιλογή `parameterValues`) + `templateBoundTermsOf(refs, library,
  defaultTerms)` ⇒ `clauses.N.bound.<k>` **ακριβώς** όπως ο κριτής (άγκυρα: ίδιο μονοπάτι με τον `validateTemplateAgainstLibrary`).
- `templates/template-edits.ts`: `newTemplateDefinition(trade)` · `addClauseRef`/`removeClauseRef`/`setOverride` (προτιμώμενη =
  απουσία κλειδιού) · `specimenAgreementOf(template, library)` πάνω στο `draftFromTemplate` + `projectDraftAgreement`.
- `editor-sections.ts`: χάρτης ενοτήτων ως παράμετρος (`defaultTerms.paymentPlan` → `plan`, ολικό άθροισμα).
- Οθόνη: `/library/templates/new` + `…/templates/[templateId]` · Ταυτότητα (κωδικός αμετάβλητος, `TRADE_CODES`,
  `LocalizedTextFields`, `EnumSelect`) · `LinesSection path="lines"` · `TermsSection path="defaultTerms"` ·
  `PaymentPlanSection path="defaultTerms.paymentPlan"` · `useTemplateBoundTermsViews` (`setReason:null`) · Ρήτρες προτύπου (από
  **εγκεκριμένη** βιβλιοθήκη, `SortableList`, τιμές με «Όπως στη βιβλιοθήκη», μόνο ελεύθερη ζώνη, δεσμευμένες μόνο ανάγνωση +
  «Αλλαγή στους όρους», τίτλοι όχι κωδικοί) · δείγμα εγγράφου · `useRevisionedDraft(…,'hold')` · «τα υπάρχοντα πρόχειρα δεν
  αλλάζουν» · πόρτες «Νέο πρότυπο» + «Επεξεργασία» στο `TemplatesTab` (λύνει §5.20 #3) · §5.20 #1 (τίτλος στη γλώσσα εγγράφου).
- Εκτός: §5.20 #2 (combobox μέσα σε Dialog). Όρια: τίτλος υπάρχουσας ρήτρας δεν αλλάζει (ο διακομιστής τον γράφει μόνο στη
  δημιουργία) · χωρίς μηχανική μετάφραση · χωρίς `atoeCode`/`skuRef`.

**Επαλήθευση**: jest (στρογγυλή διαδρομή 29 · μετονομασία σε σώμα+μεταφράσεις · παράμετρος από κείμενο · template `clausePath`
= κριτής · ενότητες με `defaultTerms` · RTL chip / «Κάνε το παράμετρο» / χάρακας / CAS / πρότυπο αρνείται «θέλει έγκριση») ·
μεταλλάξεις ≥4 κόκκινες · CHECK 3.28/3.113/3.38/3.81/3.8 · γεννήτορες i18n · ADR-928 §5.22 + changelog · ζωντανά μετά από
land/push με εντολή Giorgio.

## Παγίδες που μετρήθηκαν
- Pre-commit hook **> 10′** ⇒ `git commit` στο παρασκήνιο, μετά `git log -1`.
- Το Bash του worktree αρνείται `git -C`, `cd` έξω από το worktree, και σύνθετα `$(…)`/pipes με `gh --jq` ⇒ απλές εντολές ή
  script στο scratchpad (`node` + `execFileSync`).
- `wt:land` αποτυγχάνει αν το **κύριο αντίγραφο** έχει ξένες αδέσμευτες αλλαγές σε αρχεία που αγγίζει το ff ⇒ `ListAgents` +
  `SendMessage` στη συνεδρία-κάτοχο· ποτέ άγγιγμα. Συντονίστρια: η συνεδρία ADR-923 (`nestor-pagonis-92`).
- Πριν το push έλεγξε ότι το προηγούμενο deploy (`docker-build.yml`) δεν είναι κόκκινο — ένα ξένο σπασμένο import μπλόκαρε
  κάθε deploy από το `47e05e2e`.
- `scrollWidth` λέει ψέματα για κομμένους πίνακες ⇒ `getBoundingClientRect` ανά στοιχείο. Το `resize_window` δεν μικραίνει
  μεγιστοποιημένο παράθυρο ⇒ ζήτα από τον Giorgio F12 (DevTools σε πλάι δίνει 390 px).
- `lg:`/`md:` breakpoints ρωτούν την **οθόνη**· η φόρμα ζει σε στήλη 55% ⇒ `auto-fill`+`minmax` για πλέγματα πεδίων.
- CHECK 3.38: όχι `text-primary` σε κείμενο · CHECK 3.81: «Nestor App», όχι «Nestor» · Chrome `type` δεν γράφει ελληνικά.
- `HANDOFFS/` στο gitignore ⇒ `git add -f`. Δοκιμαστικό πρόχειρο ΠΡΟΣ-2026-001: κράτηση 4% (απόκλιση σε αναμονή) + «- live
  check item» στον κανόνα της γραμμής 1 — **μην** πατήσεις «Ελέγχθηκε νομικά».

## Κανόνες
- Commit **μόνο** στο `agent/adr-928-phase3b`, ρητή λίστα αρχείων. **ΠΟΤΕ** commit στο `main`. `wt:land` και push **μόνο** με
  ρητή εντολή Giorgio. Όχι tsc, όχι `--no-verify`, όχι `git add -A`.
- Ποιότητα Revit / ArchiCAD / Cinema 4D / Figma / Procore / Ironclad — full enterprise + full SSoT, χωρίς εκπτώσεις· πραγματικό
  SSoT audit με grep **πριν** από κάθε κώδικα (το παραπάνω audit είναι αφετηρία, ξαναεπιβεβαίωσέ το στα αρχεία που αγγίζεις)·
  έρευνα στο διαδίκτυο όπου υπάρχει αβεβαιότητα, και λύσεις εξυπνότερες από τους μεγάλους.
