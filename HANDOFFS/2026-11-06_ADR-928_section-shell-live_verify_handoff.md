# Handoff — ADR-928: κέλυφος ενότητας προμηθειών ✅ στην παραγωγή · επόμενο: ΠΛΗΡΗΣ ζωντανή επαλήθευση

**Ημερομηνία**: 2026-11-06 · **Worktree**: `C:\Nestor_Worktrees\adr-928-live-verify` · **Κλαδί**: `agent/adr-928-live-verify`
(φτιάχτηκε από το `main` `3fdb55f5`). Η νέα συνεδρία συνεχίζει **σε αυτό** το worktree.

## Κατάσταση (τι έγινε, όλα landed + pushed + live)
- `4ae3804e` **fix(procurement): one section shell** — `ProcurementSectionShell`
  (`src/subapps/procurement/components/ProcurementSectionShell.tsx`): ένα κέλυφος (`PageContainer` + `<header>` με
  `ProcurementSubNav`, `scroll: 'self' | 'shell'`) σε **όλες** τις σελίδες της ενότητας, μαζί με κύριες συμβάσεις
  (λίστα + λεπτομέρεια), RFQ detail και έλεγχο προσφοράς. Οι δύο τελευταίες με λεπτούς φακέλους
  (`CompanyRfqDetailClient`, `CompanyQuoteReviewClient`), γιατί τους κοινούς κορμούς τους αποδίδει και το έργο.
- `3fdb55f5` **fix(procurement): the section shell on the form pages too** — `rfqs/new` · `quotes/scan` ·
  `procurement/new` στο κέλυφος· το ένθετο `<main>` τους έγινε `<section>`· νέο slice `procurement/new` (446 bytes)·
  `rfqs/new` σφραγίστηκε ξανά 5.391 → 7.053 με `why`. **ADR-744 §35**: πρόταση μόνο (slices τμήματος για ένθετα layouts).
- Deploy: `live 3fdb55f` (GitHub Actions run 42207687096). Τεκμηρίωση: ADR-928 §5.24.1 + changelog.
- ⚠️ Ο φάκελος `C:\Nestor_Worktrees\adr-928-phase3b` έμεινε στον δίσκο (EBUSY)· git worktree + κλαδί ήδη σβησμένα.
  Σβήσιμο: `npm run wt:remove -- adr-928-phase3b` από το κύριο αντίγραφο, ή με το χέρι — **με επιβεβαίωση Giorgio**.

## ΔΕΝ έχει ελεγχθεί ακόμη σε browser — αυτό είναι το επόμενο βήμα
Workspace `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757` · δοκιμαστικό έργο
`proj_142e0e06-7ae1-4d92-82f3-41278b937ffa` «ΔΟΚΙΜΗ — διαγραφή». Βάση: `https://nestorconstruct.gr/o/<ws>/procurement`.

### Α. Κέλυφος (μόνο ανάγνωση — χωρίς έγκριση)
Για **κάθε** σελίδα: υποπλοήγηση ορατή, σωστή ενεργή καρτέλα, μία περιοχή κύλισης (η υποπλοήγηση μένει ορατή),
**κανένα** ωμό κλειδί (`nav.*`) ούτε στην ψυχρή φόρτωση (F5), κανένα σφάλμα κονσόλας/hydration.
- αρχική `/procurement` · `rfqs` · `quotes` · `purchase-orders` · `vendors` · `materials` · `agreements` · `analytics`
- `subcontracts` (κύριες συμβάσεις) + λεπτομέρεια σύμβασης · `subcontracts/library` (+ ρήτρα, πρότυπο)
- `rfqs/[id]` · `quotes/[id]/review` · **φόρμες** `rfqs/new` · `quotes/scan` · `procurement/new`
- **Διπλή υποπλοήγηση ΔΕΝ πρέπει να υπάρχει** στις ίδιες οθόνες μέσα στο έργο
  (`projects/<proj>/procurement/rfq/<id>`, `.../quote/<id>/review`, `.../po/new`) — εκεί τις καρτέλες τις δίνει το έργο.
- Ο επεξεργαστής συμφωνητικού (§5.23.1) γεμίζει σωστά το ύψος μέσα στην περιοχή κύλισης του κελύφους.
- en locale · κινητό 390 px (καμία οριζόντια κύλιση).

### Β. Θετική ροή — ΓΡΑΦΕΙ ΑΜΕΤΑΚΛΗΤΑ στην παραγωγή ⇒ ΡΩΤΑ ΠΡΩΤΑ τον Giorgio
«Νέα κύρια σύμβαση» → ανακατεύθυνση σε εταιρικό URL → έκδοση → αποδοχή → «Νέα εντολή εργασίας» (από τη σελίδα της
σύμβασης **και** από το έργο «ΔΟΚΙΜΗ — διαγραφή») → πάνελ με ΕΕ-1 → έγγραφο: «Έργο» = δήλωση κύριας σύμβασης, ενότητα
«Εντολές εργασίας» με κτίρια/έναρξη/διάρκεια. Επίσης: γραμμή λίστας «N εντολές · M έργα», combobox έργου μέσα σε
Dialog (§5.20 #2 — ανοιχτό εύρημα).

### Γ. Ευρήματα
Διόρθωση στο κλαδί `agent/adr-928-live-verify` → commit με ρητή λίστα → ADR-928 §5.24 «ζωντανός έλεγχος» + changelog.
`wt:land` / push **μόνο με εντολή Giorgio**.

## Κανόνες (Giorgio, ισχύουν)
- Commit **μόνο** στο `agent/adr-928-live-verify`, με ρητή λίστα αρχείων. **Ποτέ** στο `main`. `wt:land`/push μόνο με εντολή.
- Όχι `tsc` · όχι `--no-verify` · όχι `git add -A` · όχι σκέτο `git stash`. Tests μόνο με έγκριση.
- Γνωστή κόκκινη εκτός εύρους, μην την αγγίξεις: `src/lib/auth/__tests__/personal-scope-consumers.test.ts`.
- Ποιότητα «μεγάλων παικτών», full SSoT, **grep πριν από κάθε αρχείο**, έρευνα στο διαδίκτυο όταν υπάρχει αμφιβολία.
- Ποτέ κωδικοί/διαπιστευτήρια στον browser.

## Παγίδες που μετρήθηκαν
- Pre-commit hook **> 10′** ⇒ `git commit -F <αρχείο>` στο παρασκήνιο, μετά `git log -1`.
- Ο φύλακας του worktree αρνείται `git -C <κύριο αντίγραφο>` ⇒ όλα από το worktree.
- `wt:land` κρατά τον τίτλο του **πρώτου** commit του κλαδιού ⇒ ένα commit ανά κλαδί, ή `git rebase main` πριν το land
  (παραλείπει commits που έχουν ήδη μπει), και έλεγχος τίτλου πριν το push.
- `.i18n-shell-slice.json`: **ποτέ** επανεγγραφή με `JSON.stringify` ⇒ Edit + `generate:i18n-shell-slice -- --measure`
  (το `--measure` ΔΕΝ γράφει· η σφράγιση γράφεται με το χέρι, με `why`).
- Κέλυφος έξω από όριο `next/dynamic` ⇒ αποδίδεται στον server ⇒ χρειάζεται slice διαδρομής (`registerRouteSlice`).
- Chrome `type` δεν γράφει ελληνικά · μην ανοίγεις διαλόγους `confirm`.
