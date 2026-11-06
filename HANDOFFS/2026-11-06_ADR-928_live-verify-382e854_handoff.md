# Handoff — ADR-928: ζωντανός έλεγχος του κελύφους ✅ landed + live (`382e854`) · επόμενο: επαλήθευση των διορθώσεων + θετική ροή

**Ημερομηνία**: 2026-11-06 · **Worktree**: `C:\Nestor_Worktrees\adr-928-live-verify-2` · **Κλαδί**: `agent/adr-928-live-verify-2`
(φτιάχτηκε από το `main` `382e8540`). Η νέα συνεδρία συνεχίζει **σε αυτό** το worktree.

## Κατάσταση (όλα landed + pushed + live)
- `382e8540` **fix(procurement): live check of the section shell** — ADR-928 §5.24.2 + changelog. Deploy: `live 382e854`
  (GitHub Actions run 42220503111). Ο ζωντανός έλεγχος του `3fdb55f` (el + en, εταιρεία + έργο) βρήκε τέσσερα θέματα:
  1. **5 ένθετα `<main>`** → `<section>`: `ProcurementDetailPageContent` (×3) · `AnalyticsPageContent` · `QuoteReviewClient` ·
     `RfqDetailClient` (ένας `<main>`, ADR-871 §10.5· ισχύει και μέσα στο έργο).
  2. **`/procurement/new` χωρίς ενεργή καρτέλα** → νέο `TabsNavTab.alsoActiveOn` (`route-tabs.tsx` · `tabs-types.ts`), πρόθεμα
     **ανά τμήμα**, το `excludeStartsWith` υπερισχύει· `ProcurementSubNav`: «Παραγγελίες» `alsoActiveOn: ['/procurement/new']`.
  3. **Μήνες του hub στη γλώσσα του λειτουργικού** (και ο μήνας γλιστρούσε δυτικά του UTC) → `formatCalendarMonth(…, 'month')`
     στο `src/lib/intl-formatting.ts`· ίδια κλάση στο `AddressActivityLog` + `AddressFreshnessIndicator` → `formatDateTime`.
     Κανένα `Intl.DateTimeFormat(undefined` δεν μένει στο `src/`.
  4. **Αρχική `/procurement`**: η μόνη χωρίς υποπλοήγηση στο HTML του server + το `overflow-hidden` του κελύφους έκοβε
     περιεχόμενο χωρίς κύλιση → κέλυφος στο `page.tsx` (έξω από το `ssr:false`), `scroll="shell"`, νέο slice
     `o__workspace__procurement.el.json` **493 bytes** σφραγισμένο με `why`· νεκρή εγγραφή `route-tabs.tsx` σβήστηκε από το
     `lazyRouteOpaqueNamespaces`· ο κορμός δεν προφορτώνει πια `projects*`.
  - Boy Scout: `t('detail.notFound', 'PO not found')` → `t('detail.notFound')`.
- Νέα tests (γραμμένα, **ΔΕΝ** έχουν τρέξει — θέλουν έγκριση Giorgio): `src/components/ui/navigation/__tests__/route-tabs.test.tsx`
  (3 νέα για `alsoActiveOn`) · `src/lib/__tests__/intl-calendar-month.test.ts` (νέο αρχείο).

## Επόμενο βήμα
### Α. Ζωντανή επαλήθευση του `382e854` (μόνο ανάγνωση — χωρίς έγκριση)
Workspace `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757` · έργο `proj_142e0e06-7ae1-4d92-82f3-41278b937ffa` «ΔΟΚΙΜΗ — διαγραφή».
Βάση `https://nestorconstruct.gr/o/<ws>/procurement`.
1. **Αρχική**: `fetch` του HTML ⇒ υπάρχει `[role=tablist]` και η καρτέλα «Κύριες συμβάσεις» στο HTML του server (πριν: 0)·
   καμία `BAILOUT_TO_CLIENT_SIDE_RENDERING` για το κέλυφος· κανένα ωμό κλειδί· περιοχή κύλισης `min-h-0 flex-1 overflow-y-auto`
   με την υποπλοήγηση ορατή μετά από κύλιση στο τέλος.
2. **`/procurement/new`**: ενεργή καρτέλα = «Παραγγελίες».
3. **`<main>` = 1** σε: `procurement/new` · `analytics` · `quotes/qt_0b2eb5a6-1196-4e14-84b8-2aed09cd5819/review` ·
   `rfqs/rfq_d02a39e2-b0b1-48b0-a224-f7aa1902c011` · έργο `…/procurement/po/new` · `…/rfq/rfq_d02a39e2-…` ·
   `…/quote/qt_9cd56829-a157-4b0f-afba-5628cf6e0165/review`.
4. **en locale** (διακόπτης γλώσσας στην κεφαλίδα· επαναφορά σε `el` στο τέλος): ο άξονας της τάσης του hub σε αγγλικά.
5. **Κινητό 390 px** (δεν ελέγχθηκε ποτέ): το `resize_window` ΔΕΝ άλλαξε το viewport (Chrome μεγιστοποιημένο, ζουμ 80%,
   `innerWidth` 2400) ⇒ ζήτα από τον Giorgio να βγάλει το παράθυρο από μεγιστοποίηση· έλεγχος: καμία οριζόντια κύλιση, οι 10
   καρτέλες αναδιπλώνονται (`flex-wrap`), η αρχική κυλά ως το τέλος.

### Β. Θετική ροή — ΓΡΑΦΕΙ ΑΜΕΤΑΚΛΗΤΑ στην παραγωγή ⇒ ΡΩΤΑ ΠΡΩΤΑ τον Giorgio
«Νέα κύρια σύμβαση» → ανακατεύθυνση σε εταιρικό URL → έκδοση → αποδοχή → «Νέα εντολή εργασίας» (από τη σελίδα της
σύμβασης **και** από το έργο «ΔΟΚΙΜΗ — διαγραφή») → πάνελ με ΕΕ-1 → έγγραφο: «Έργο» = δήλωση κύριας σύμβασης, ενότητα
«Εντολές εργασίας» με κτίρια/έναρξη/διάρκεια. Επίσης: γραμμή λίστας «N εντολές · M έργα», combobox έργου μέσα σε Dialog
(§5.20 #2 — ανοιχτό εύρημα), λεπτομέρεια κύριας σύμβασης μέσα στο κέλυφος (δεν ελέγχθηκε — δεν υπήρχε καμία).

### Γ. Ευρήματα
Πρόταση διόρθωσης → «ναι» Giorgio → διόρθωση στο `agent/adr-928-live-verify-2` → commit με ρητή λίστα → ADR-928 §5.24.2 (ή
§5.24.3) + changelog. `wt:land` / push **μόνο με εντολή Giorgio**.

## Ανοιχτά (δεν είναι μέρος του ADR-928)
- Ένα «Leave site?» εμφανίστηκε **μία** φορά αμέσως μετά την αλλαγή γλώσσας και δεν αναπαράχθηκε. Πηγή άγνωστη. Υποψήφιοι
  με `beforeunload`: `unsaved-work-guard` · `leave-guard` · `DirtyFormProvider` · `use-unsaved-guard` (το
  `user-settings-repository` αποκλείεται: κάνει μόνο flush, δεν μπλοκάρει).
- Οι καρτέλες του `RouteTabs` είναι κουμπιά με `router.push`, όχι σύνδεσμοι (χωρίς middle-click / «άνοιγμα σε νέα καρτέλα»).
  Παρατήρηση μόνο — δεν προτάθηκε ακόμη.
- Ορφανοί φάκελοι στον δίσκο (git worktree + κλαδί ήδη σβησμένα, κλειδωμένοι EPERM/EBUSY): `C:\Nestor_Worktrees\adr-928-live-verify`
  · `C:\Nestor_Worktrees\adr-928-phase3b` · `C:\Nestor_Worktrees\common-spaces`. Σβήσιμο με το χέρι όταν δεν τους κρατά
  καμία διεργασία — **με επιβεβαίωση Giorgio**.
- Ο δίσκος C: είναι στο 99% (~3 GB ελεύθερα)· το `wt:new` θέλει ≥ 1,5 GB.

## Κανόνες (Giorgio, ισχύουν)
- Commit **μόνο** στο `agent/adr-928-live-verify-2`, με ρητή λίστα αρχείων. **Ποτέ** στο `main`. `wt:land`/push μόνο με εντολή.
- Όχι `tsc` · όχι `--no-verify` · όχι `git add -A` · όχι σκέτο `git stash`. Tests μόνο με έγκριση.
- Γνωστή κόκκινη εκτός εύρους, μην την αγγίξεις: `src/lib/auth/__tests__/personal-scope-consumers.test.ts`.
- Ποιότητα «μεγάλων παικτών», full SSoT, **grep πριν από κάθε αρχείο**, έρευνα στο διαδίκτυο όταν υπάρχει αμφιβολία.
- Ποτέ κωδικοί/διαπιστευτήρια στον browser.

## Παγίδες που μετρήθηκαν
- Pre-commit hook **> 10′** ⇒ `git commit -F <αρχείο>` στο παρασκήνιο, μετά `git log -1`.
- Ο φύλακας του worktree αρνείται `git -C <κύριο αντίγραφο>` και heredoc σε `/tmp` ⇒ scripts με `Write` στο scratchpad.
- Το `wt:land` κάνει **fast-forward** όταν το `main` δεν κινήθηκε (κρατά κάθε commit με τον τίτλο του)· squash με τον τίτλο
  του **πρώτου** commit μόνο όταν χρειάζεται rebase.
- Το `iframe` προς το nestorconstruct.gr μπλοκάρεται (πολιτική πλαισίων) ⇒ πλοήγηση στην καρτέλα + `javascript_tool`·
  το HTML του server ελέγχεται με `fetch(url,{credentials:'include'})` + `DOMParser`.
- Μετά την αλλαγή γλώσσας μια πλοήγηση μπορεί να μπλοκαριστεί από «Leave site?» ⇒ `navigate` με `force: true`.
- Νέο slice διαδρομής: εγγραφή στο `routeSlices` του `.i18n-shell-slice.json` (Edit, ποτέ `JSON.stringify`) → `--measure`
  → σφράγιση με `why` → `generate:i18n-shell-slice` (γράφει artifacts + manifest). Νεκρή εγγραφή στο
  `lazyRouteOpaqueNamespaces` ⇒ ο γεννήτορας **αρνείται να γράψει** μέχρι να σβηστεί.
- Chrome `type` δεν γράφει ελληνικά · μην ανοίγεις διαλόγους `confirm`.
