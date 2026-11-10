# Handoff — ADR-923 §5.5.2 Β8 · βήμα Α ΔΕΣΜΕΥΜΕΝΟ (`af1b8a12`) · ΕΠΟΜΕΝΟ: βήμα Β (μοντέλο λύσης + popover)

**Ημερομηνία:** 2026-11-10 · **Worktree:** `C:\Nestor_Worktrees\catalog-editions` · **Κλαδί:** `agent/catalog-editions`
**Προηγούμενο:** `HANDOFFS/2026-11-10_ADR-923_B8-live-verified_next-explainable-actionable-box_handoff.md`
**Εγκεκριμένο σχέδιο (διάβασέ το ΟΛΟΚΛΗΡΟ):** `C:\Users\user\.claude\plans\cheerful-plotting-duckling.md`
**Εντολή Giorgio:** «όπως οι μεγάλοι» (Revit · ArchiCAD · Cinema 4D · Figma · Zillow · Idealista, και καλύτερα), FULL ENTERPRISE + FULL SSOT, χωρίς εκπτώσεις· έρευνα web όπου δεν είσαι σίγουρος· **πραγματικό SSoT audit (grep) ΠΡΙΝ από κάθε κώδικα**.

## 1. Κατάσταση
- ✅ **Βήμα Α δεσμευμένο** `af1b8a12` στο `agent/catalog-editions` (pre-commit ✅). **ΟΧΙ** land, **ΟΧΙ** push (εντολή Giorgio: μόνο με δική του εντολή).
  - `ImportAlternative { text, anchor }` + προαιρετικό `alternatives` σε `ExtractedCell` / `ImportProposalField` (`src/subapps/catalog/types/catalog-import.ts`).
  - `flagRepeated` (`src/subapps/catalog/import/cell-identity.ts`) = ΕΝΑ σημείο για εύρημα `attributeRepeated` **και** εναλλακτικές· καλείται από `settleRepeat` και `settleTradeCells` (`trade-identity-fields.ts`)· `proposalFieldOf` (`field-diff.ts`) τις περνά όπως το `corroboratedBy`.
  - 🔴→✅ Διόρθωση `human-edits.ts`: διόρθωση σε διεύθυνση με **δύο** κελιά ενώνει τα κελιά στο κελί που τύπωσε την τιμή του ανθρώπου (κρατά την άγκυρά του)· `ImportValueEdit.sourceTexts` (μόνο όταν > 1) για τον έλεγχο «άλλαξε η πηγή»· `sourceText` = «Α · Β».
  - `KeepValueChoices` στο `src/components/catalog/imports/ProposalFieldRow.tsx`: κουμπί «Κράτα «…»» ανά τιμή ⇒ υπάρχον `onEdit(text)`. Κλειδιά `review.keepValue` · `review.keepValueGroup` (el+en) — **ξαναχρησιμοποίησέ τα στο popover**.
  - Tests: `human-edits` 15/15 · `aries-table-reading` + `trade-identity-import` 67/67 · `aries-page-reading` ✅. ADR-923 Β8 «βήμα Α» + changelog γραμμένα.
- ⚠️ Το `main` προχώρησε κατά 2 ξένα commits (`ba856147` πωλήσεις ADR-935 · `c2b07091` handoff ADR-929), κανένα στον κατάλογο. **Πρώτη κίνηση: `git rebase main`** στο worktree (σύγκρουση σε `src/types/i18n.ts` / `shell-slice.manifest.json` ⇒ πάρε του main και ξανάτρεξε `npm run generate:i18n-types` + `npm run generate:i18n-shell-slice`, **με έγκριση**).
- ⏳ Ζωντανά το βήμα Α: θέλει push **και** ξαναχτίσιμο πρότασης σελ. 87 (εγγραφή παραγωγής ⇒ «ναι» Giorgio).

## 2. ΕΠΟΜΕΝΟ — βήμα Β (σχέδιο §1, §2, §3, §4, §5)
1. **`src/components/catalog/imports/review-remedy.ts`** (καθαρό): `remedyOf(entry: ReviewBoxTarget, ctx: { decidable, canManage, canPrice, hasPriceTarget })` ⇒ `{ why, actions }`. `RemedyAction` = `keepValue{text}` (μία ανά τιμή, από `field.alternatives` + `field.sourceText`· χωρίς `alternatives` ⇒ `editField`) · `lineTool{mode:'map'|'new'|'price'}` · `ignoreLine` · `pickPriceTarget`. Μη αποφασίσιμη πρόταση ⇒ μόνο «γιατί». + `__tests__/review-remedy.test.ts`.
2. **`review-reason-text.ts`**: μετακίνηση του τοπικού `useReasonText` από `ImportReviewOverlay.tsx` ως `useReviewReasonText` + περίπτωση `unmapped`· το καλούν popover **και** λίστα (`ProposalUnmappedLines` αντί για ωμό `t(LINE_REFUSAL_KEYS[…])`).
3. **`use-review-selection.ts`**: `requestRemedy(target, action)` (επιλογή + `intent`) + `clearIntent()`· καταναλωτές `ProposalUnmappedLines` (ανοίγει το ΙΔΙΟ `LineAttributeToolsSlot` / `PriceLineDialogSlot`) · `ProposalFieldRow` (διόρθωση) · `ImportPriceTarget` (εστίαση `price-target-${batch.id}`). `ignoreLine` ⇒ `workspace.decideLine` όπως η λίστα. Καμία δεύτερη υλοποίηση ενέργειας.
4. **`ReviewBoxPopover.tsx`**: ΕΝΑ popover ανά στρώση (store πάνω στο `createExternalStore`, όπως `review-hover-store.ts`)· `@/components/ui/popover` + `PopoverAnchor`, `onOpenAutoFocus` preventDefault (μη-modal)· hover ~300ms άνοιγμα / ~200ms κλείσιμο με διάδρομο (WCAG 1.4.13)· focus ⇒ αμέσως· Tab ⇒ μέσα, Esc/Shift+Tab ⇒ πίσω στο πλαίσιο· αφή = toggletip. Περιεχόμενο: ετικέτα + τυπωμένη τιμή + τόνος (εικονίδιο + λέξη, CHECK 3.41) · «γιατί» · κουμπιά (`@/components/ui/button`) · πολλοί στόχοι ⇒ ο χειρότερος + «και N ακόμη» (`boxMore`). Ποτέ `title=` (CHECK 3.23)· z-index από `useDropdownTokens` (CHECK 3.50).
5. **Σύνδεση**: `ImportSourcePane` / `ImportBatchWorkspace` περνούν `ctx` (`priceTargetOf`, `canPrice`, decidable) και `onRemedy`.
6. i18n el+en (νέα μόνο όπου δεν υπάρχει κλειδί: `review.remedy.unmappedWhy` · `pickPriceTarget` · `title`) · ADR-923 Β8 «βήμα Β» + changelog.
- Μετά: **βήμα Γ** (φάντασμα: hover σε «Κράτα» ⇒ διακεκομμένο πλαίσιο στο `alternative.anchor`, `review-ghost-store.ts` · συνέχεια τιμοκαταλόγου `intent priceTarget{thenLine}` ⇒ μετά την αποθήκευση ανοίγει ο διάλογος τιμής της ίδιας γραμμής · «Τιμή» δεν κρύβεται πια όταν λείπει τιμοκατάλογος).

**Μέθοδος:** N.14 πρότεινε μοντέλο και περίμενε «ok» → `git rebase main` → SSoT audit (grep) για ό,τι αγγίζεις → υλοποίηση → tests/γεννήτορες **μόνο με «ναι»** → commit με ρητή λίστα.

## 3. ⚖️ Ανοιχτές αποφάσεις Giorgio (υπενθύμισε, μην τις αγγίξεις)
1. Κασέτα ως ξεχωριστή οικογένεια «Fan coil κασέτα» (`prefixOf`). 2. «Η μακρύτερη αρχή κερδίζει» στο `selectOptionCandidates`. 3. Νέα εισαγωγή xChange για επαλήθευση M-b4 (εγγραφή παραγωγής). 4. Γραμμή ADR-923 για την Επαναφορά. 5. ADR-770 §18.7 #1 `<Button variant="default">`.
- Προτάσεις μιας γραμμής από πριν (μόνο με «ναι»): «Απόφαση 1» ADR-923 (~γρ. 647) λέει «πρώτος στόχος», πλέον «χειρότερος» · push σε καρφωμένο sha.

## 4. ΜΗΝ
- Κανένα test / πύλη / tsc / γεννήτορας χωρίς έγκριση. Καμία πληρωμένη ανάγνωση AI, καμία εγγραφή παραγωγής (ούτε Αποδοχή/Απόρριψη/Αγνόηση/Αντιστοίχιση/«Κράτα») χωρίς «ναι».
- Commit μόνο στο `agent/catalog-editions` με ρητή λίστα· **ποτέ** στο main. `HANDOFFS/*.md` ⇒ `git add -f`. **Ποτέ `--no-verify`**. `wt:land` και push **ΜΟΝΟ** με εντολή Giorgio.
- Ο φύλακας του worktree αρνείται σύνθετες εντολές με μεταβλητές/`$(...)` — απλές εντολές, μία-μία.
- Αρχεία ≤500 γραμμές, συναρτήσεις ≤40.
