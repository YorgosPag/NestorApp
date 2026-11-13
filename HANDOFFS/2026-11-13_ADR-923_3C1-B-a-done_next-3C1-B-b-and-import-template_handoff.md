# HANDOFF — ADR-923 · 3Γ.1-Γ ✅ + 3Γ.1-Β (α) ✅ (commit στο κλαδί, ΟΧΙ land/push) · ΕΠΟΜΕΝΟ: 3Γ.1-Β (β) + πρότυπο ανάγνωσης εισαγωγής

- Ημερομηνία: 2026-11-13
- Worktree: `C:\Nestor_Worktrees\catalog-editions` · κλαδί `agent/catalog-editions` (η νέα συνεδρία συνεχίζει στο **ίδιο** worktree).
- Κανόνες Giorgio: tests **μόνο με έγκριση** · **κανένα tsc** · commit μόνο στο `agent/*` (ποτέ στο `main`) · **`wt:land` και push ΜΟΝΟ με
  εντολή Giorgio** · εγγραφή στην παραγωγή μόνο με «ναι» · απαντήσεις στα ελληνικά · ποιότητα «μεγάλων παικτών» χωρίς εκπτώσεις, έρευνα
  όπου υπάρχει αμφιβολία · **πριν από κώδικα: πραγματικό SSoT audit (grep)** για ό,τι υπάρχει ήδη.
- Σχέδιο (εγκεκριμένο): `C:\Users\user\.claude\plans\lazy-coalescing-quail.md` — **η §21.6 του ADR-923 το υπερισχύει** όπου διαφέρουν
  (σειρά IEC 61293, πολιτική κενού μέρους, πρότυπο ανάγνωσης).

## ΚΑΤΑΣΤΑΣΗ (κλαδί `agent/catalog-editions`, τοπικό `main` = `0ecb5f14`, τίποτα σε push)
- `c75a6714` **3Γ.1-Γ**: `printedForm` (import/proposal-values.ts) σβήνει **μόνο** το κενό ψηφίο→γράμμα ⇒ «50Hz» ≡ επιλογή «50 Hz».
  `IMPORT_PAGE_DERIVATION` 7→8. Tests 79/79 · 2 μεταλλάξεις κόκκινες.
- **commit αυτού του handoff — 3Γ.1-Β (α)** (ADR-923 §21.6): μοντέλο `CompositeDisplay` · zod · όρια · `validate-family-composites.ts` ·
  `values/composite-display.ts` (`composeDisplay`, `COMPOSITE_MISSING_MARK`) · `values/measurement-in-unit.ts` (εξήχθη από `catalog-table.ts`) ·
  `familyDefinitionOf` αντιγράφει το πεδίο · `withoutFamilyAttribute` / `emptyFamilyDraft` · ιστορικό + i18n + `src/types/i18n.ts`.
  Tests 140/140 · 2 μεταλλάξεις κόκκινες. Λεπτομέρειες: ADR-923 §21.6 + changelog.

## ΑΠΟΦΑΣΕΙΣ GIORGIO (2026-11-13, «ναι σε όλα»)
1. Ένδειξη παροχής **κατά IEC 61293**: «1~ 230 V 50 Hz» (φάσεις πρώτα με `affix.after='~'`, διαχωριστής κενό).
2. Μέρος που λείπει: **επεξεργαστής προϊόντος ονομάζει την ιδιότητα** («1~ 230 V [Συχνότητα: κενό]» — κλειδί i18n), πίνακας/εκτύπωση/
   κάρτες «—» (`COMPOSITE_MISSING_MARK`). Το κάνει ο καλών μέσω `missingText` της **μίας** `composeDisplay`.
3. **Πρότυπο ανάγνωσης εισαγωγής** από την ίδια δήλωση (κανείς από τους μεγάλους δεν το κάνει) — υλοποιείται κι αυτό.

## ΕΠΟΜΕΝΟ 1 — 3Γ.1-Β (β): οι καταναλωτές (SSoT audit πρώτα!)
- **Γραμμή πίνακα `composite`**: `types/family.ts` `FamilyTableRow` += `{ kind:'composite', id, compositeId, labelOverride, merge }` ·
  zod `tableRowSchema` · `validate-family-table-spec.ts` (`compositeId` υπαρκτό ⇒ νέος κωδικός, π.χ. `tableRowCompositeUnknown`, + i18n + γεννήτορας) ·
  `table/catalog-table.ts` `previewRow` + `realCells` (το `RealTableColumn` χρειάζεται `compositeOf(compositeId)` ή `valueOf` ανά ιδιότητα — **ένας**
  builder για οθόνη **και** εκτύπωση, Typst δεν αλλάζει) · `family-draft.ts` `rowMentions`: σβήσιμο ένδειξης ⇒ φεύγουν οι γραμμές της
  (και όταν η `withoutCompositePart` αδειάσει μια ένδειξη!) · `components/catalog/families/family-table-preview.ts` · `TableRowEditor.tsx` ·
  `TABLE_ROW_KIND_KEYS` (`components/catalog/shared/catalog-labels.ts`;) · i18n.
- **Κάρτες εκδότη**: `publishing/publication-chapters.ts` (+ `publication-entries.ts`, που αναφέρει `tableSpec`).
- **Καρτέλα επεξεργαστή** `FamilyCompositesTab.tsx` (πρότυπο `FamilyTableTab` + `SortableList`) στο `FamilyEditor` · `FamilyTab` += `composites` ·
  `tabOfIssue`: `compositeDisplays…` ⇒ `composites` (+ test) · `nextLocalId('cd', …)`.
- **Επεξεργαστής προϊόντος**: γραμμή μόνο-ανάγνωσης (ονομάζει την ιδιότητα που λείπει).
- Δημόσια βιτρίνα (`public-value-text.ts`) **εκτός** — εύρημα για αργότερα.
- Αρχεία < 500 γραμμές, συναρτήσεις ≤ 40· `publication-chapters.ts` είναι ήδη **299** γραμμές ⇒ νέο αρχείο αντί φούσκωμα.

## ΕΠΟΜΕΝΟ 2 — πρότυπο ανάγνωσης εισαγωγής (απόφαση 3)
Σήμερα `import/cell-fragments.ts` `lineFragments`: κάθε στόχος με τον κωδικοποιητή του + **κατ' αποκλεισμό** για τον τελευταίο. Πρόταση:
όταν οι στόχοι της γραμμής (Γ13) είναι **ακριβώς** τα μέρη μιας σύνθετης ένδειξης της οικογένειας, τα κομμάτια (`partsOf`) αντιστοιχίζονται
**με τη δηλωμένη σειρά**· ο κωδικοποιητής κάθε στόχου **επιβεβαιώνει** (δεν μαντεύει). Ερώτημα σχεδίου προς Giorgio πριν τον κώδικα: η σειρά
του φυλλαδίου («230V-50Hz-1Ph») ≠ σειρά IEC της ένδειξης («1~ 230 V 50 Hz») ⇒ πρότυπο = **σύνολο** μερών + αντιστοίχιση με κωδικοποιητή,
και σειρά μόνο ως **ισοπαλία**; Έρευνα (Rossum/ABBYY templates, Akeneo SDM) πριν αποφασιστεί. `IMPORT_PAGE_DERIVATION` 8→9 αν αλλάξει παράγωγο.

## ΕΠΟΜΕΝΟ 3 — εγγραφές στην παραγωγή (καθεμία με «ναι»)
3 ιδιότητες (`connection_voltage` V EF003625 · `supply_frequency` επιλογή 50 Hz/60 Hz/50/60 Hz EF005455 · `phases` αριθμός 1–3) · δέσιμο στο
Fan coil · σύνθετη ένδειξη «Ηλεκτρική παροχή» (IEC 61293) · κανόνας «όταν φάσεις = 3 ⇒ τάση ≥ 380 V» (ρώτα σφάλμα/προειδοποίηση) ·
σελ. 85 απόφαση γραμμής → 3 στόχοι · «1Ph» → 1 · ζωντανή δοκιμή μνήμης τιμών. Push πρώτα (με εντολή), μετά ζωντανός έλεγχος.

## ΠΑΓΙΔΕΣ
- Ο isolated worktree αρνείται σύνθετες bash εντολές με git/μεταβλητές ⇒ απλές εντολές· scripts στον scratchpad (`python -I`, με
  `sys.stdout.reconfigure(encoding="utf-8")` — το `-I` αγνοεί το `PYTHONIOENCODING`).
- Το Grep (ripgrep) σε όλο το `src` κάνει timeout ⇒ στένεψε τη διαδρομή (`src/subapps/catalog`).
- Νέα κλειδιά i18n ⇒ `npm run generate:i18n-types` (CHECK 3.33).
- `familyDefinitionOf` είναι το SSoT επεξεργαστή + γραφέα: **κάθε νέο πεδίο οικογένειας μπαίνει εκεί**, αλλιώς σβήνεται σιωπηλά.
- Φρένο βαριών εργασιών: `C:\Users\user\.claude\heavy-task.lock` ⇒ περίμενε, μην παρακάμπτεις.

## ΜΗΝ
- push / `wt:land` χωρίς εντολή · tsc · `--no-verify` · απλό `git stash` · εγγραφή στην παραγωγή χωρίς «ναι» · «ΤΙΜΗ €» πριν το §5.16.
