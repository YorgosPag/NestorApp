# ADR-923 §5.14.1 · Εξαγωγή ETIM xChange — handoff επόμενων βημάτων

**Ημερομηνία:** 2026-11-03 · **Παραγωγή:** https://nestorconstruct.gr (Netcup)
**Worktree:** `C:\Nestor_Worktrees\xchange-report-typography` · **Κλαδί:** `agent/xchange-report-typography`
**Βάση:** `main` = `origin/main` = `0b3a80f3` (ADR-928). Το κλαδί έχει γίνει rebase πάνω της.
**Workspace δοκιμής:** `/o/comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757/catalog/publications` (συνδεδεμένος ο Giorgio στο Chrome)

## 1. Τι έγινε (στο κλαδί, ΟΧΙ στο main)
Commit `92d9ac10` — `fix(i18n): one typography rule for abbreviation periods; xChange report plurals; ADR-279 ADR-923`
- `src/i18n/sentence-period.ts` (νέο): κανόνας «η τελεία της συντομογραφίας κλείνει και την πρόταση» (`…μ.μ..` ⇒ `…μ.μ.`),
  ένας κανόνας σε κάθε διαδρομή: postProcessor `sentencePeriod` στο `src/i18n/config.ts` (πριν το `pseudo`), `formatBundleText`
  στο `src/i18n/bundle-translate.ts`, `createRealI18n` στο `src/test-utils/real-i18n.ts`.
- ICU plural: `catalog.xchangeExport.report.hidden` (el), `catalog.xchangeExport.reason.visibleNoPrice` (el),
  `catalog.issues.fenceConfirmationRequired` (el + en).
- Άγκυρα `src/i18n/__tests__/sentence-period.test.ts` (7 tests· μετάλλαξη του κανόνα ⇒ 4 κόκκινα).
- Παραγόμενα (`src/types/i18n.ts`, `shell-slice.manifest.json`, route slice publications) ξαναπαράχθηκαν με τους γεννήτορες.
- ADR-279 (decision log), ADR-923 (changelog), `.claude-rules/pending-ratchet-work.md` (476 μηνύματα `{count}` χωρίς plural).
- ⚠️ Δεν επαληθεύτηκε αν το `git rebase --continue` ξανάτρεξε το pre-commit hook στο `92d9ac10` (το `8c0d4bd1` πριν το rebase
  πέρασε το πλήρες hook). Τα tests ξανάτρεξαν μετά το rebase: catalog + i18n 55/564 · shell slice 605 · types freshness 56 — πράσινα.

## 2. Ζωντανή επαλήθευση του e7d3ecc2 (έγινε σε αυτή τη συνεδρία)
| # | Σημείο | Αποτέλεσμα |
|---|---|---|
| 1 | Εξαγωγή, δημόσιο κοινό | ✅ έγκυρο JSON 2.0, αναφορά δίπλα στη λήψη. ⚠️ 8/8 SKU κρυφά ⇒ αρχείο με `Product: []` (βλ. §3 Α) |
| 2 | Λίστα πελάτη | ✅ «Δοκιμή 6α B2B» (`net_list`): `GrossListPrice "140.40"` + `PriceOnRequest`. Λίστα κόστους ⇒ 422 `xchangePriceListNotOffered`. Το handoff έλεγε λάθος «λίστα πελάτη ⇒ μόνο NetPrice»: το πεδίο το ορίζει ο **τύπος τιμής** της λίστας (ADR-923 Ζ13). Λίστα `net_customer` πώλησης δεν υπάρχει ⇒ «μόνο NetPrice» αδοκίμαστο |
| 3 | Χωρίς επωνυμία | ⏸️ εκκρεμεί (εγγραφή) |
| 4 | Ευρήματα σε φόρμες | ✅ εισαγωγές: μεταφρασμένο `modelCodeMissing`, χωριστά chunks πίνακα (8,4 KB κατάλογος · 957 B εισαγωγή) μετά το πρώτο καρέ. ⏸️ φόρμες: εκκρεμεί (εγγραφή) |
| 5 | Ψυχρή φόρτωση | ✅ 12 σελίδες καταλόγου: κανένα ωμό κλειδί στο SSR HTML· `products` καθαρό και μετά την ενυδάτωση |
| 6 | Αγγλικά | ⏸️ εκκρεμεί (η αλλαγή γλώσσας γράφει στο προφίλ). API `language=en` ⇒ `en-GB` ✅ |

## 3. ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ (με τη σειρά)
**Εγκρίσεις Giorgio 2026-11-03:** land + push του κλαδιού ✅ · εγγραφές στην παραγωγή για τα σημεία 3, 4, 6 ✅.

0. **Land + push**: `npm run wt:land -- xchange-report-typography` (background) → push. Μετά το deploy: δες στην παραγωγή την
   αναφορά εξαγωγής («δεν εξήχθησαν», «1 ορατό», **μία** τελεία μετά το «μ.μ.»).
1. **Σημείο 3**: προσωρινή αφαίρεση επωνυμίας χώρου (ρυθμίσεις καταλόγου / προφίλ προμηθευτή) → εξαγωγή ⇒ μεταφρασμένο
   `xchangeSupplierNameMissing` → **επαναφορά** επωνυμίας `ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε.` (ΑΦΜ `EL801832652`). Κράτα την ακριβή αρχική τιμή πριν τη σβήσεις.
2. **Σημείο 4**: διπλός κωδικός ομάδας ιδιοτήτων · κείμενο σε αριθμητικό πεδίο προϊόντος · PDF ως φωτογραφία στα μέσα ⇒ ακριβές
   μήνυμα (ή στιγμιαία «Χρειάζεται διόρθωση.»), ποτέ `issues.xxx`. Η υποβολή πρέπει να **απορρίπτεται**· αν κάτι γραφτεί, αναίρεσέ το.
3. **Σημείο 6**: γλώσσα → English, ευρήματα + αναφορά εξαγωγής στα αγγλικά, **επιστροφή σε Ελληνικά**.
4. **Α. Απόφαση Giorgio: εξαγωγή χωρίς κανένα ορατό προϊόν** — «όπως οι μεγάλοι παίκτες, ή καλύτερα»:
   - Έρευνα πρώτα (πώς χειρίζονται εξαγωγή/δημοσίευση που θα έβγαινε άδεια: Akeneo, Salsify, Pimcore, Figma export, Google
     Takeout, Shopify product export, ETIM/BMEcat εργαλεία). Υπόθεση προς επαλήθευση: **προέλεγχος πριν τη λήψη** (dry-run
     μέτρηση από τον server, ίδια μηχανή με την εξαγωγή) ⇒ αντί για κουμπί που κατεβάζει άδειο αρχείο, κατάσταση «0 προϊόντα
     ορατά σε αυτό το κοινό» με την **αιτία** (π.χ. «καμία ρύθμιση ορατότητας ⇒ όλα κρυφά») και **σύνδεσμο στη διόρθωση**
     (σελίδα ορατότητας/τιμοκαταλόγων)· η λήψη μένει δυνατή μόνο ρητά.
   - **SSoT audit με grep ΠΡΙΝ από κώδικα**: `src/server/catalog/xchange-export.server.ts`, `xchange-export-assembly.ts`,
     `xchange-pricing.ts`, `use-xchange-export.ts`, `XChangeExportDialog.tsx`, `XChangeExportReport.tsx`· ψάξε αν υπάρχει ήδη
     προέλεγχος/«empty state»/preflight σε εκδόσεις PDF (`catalog/publications`), εισαγωγές, ή κοινά components κενής κατάστασης
     (`common-empty-states`). Επέκτεινε, μη διπλασιάζεις. Η μέτρηση να βγαίνει από την **ίδια** συνάρτηση με την εξαγωγή.
   - ADR-923 §5.14.1: νέα απόφαση + changelog, στο ίδιο commit.

## 4. Γνωστά ανοιχτά (από πριν)
- `catalogReadRoute` χωρίς `Cache-Control: no-store` σε αποκρίσεις με τιμές (επιβεβαιώθηκε ζωντανά: `cache-control: null`).
- Δίδυμος αναγνώστης `readExportData` / `readCatalogData` — στο `pending-ratchet-work.md`.
- `priceListId=bogus!` ⇒ 404 αντί 400 (το `entityIdSchema` το δέχεται)· το μήνυμα σφάλματος ανάγνωσης λέει «catalog write rejected» σε GET.
- `MinimalProductDescription` = κωδικός SKU όταν το SKU δεν έχει όνομα (δεδομένα, όχι κώδικας).
- Ο Giorgio μπορεί να θέλει απόφαση 24ωρου για όλη την εφαρμογή (glibc el_GR = 24ωρο από 2023· CLDR/ICU 76 = h12) — μόνο αν ζητηθεί.
- Worktree `C:\Nestor_Worktrees\adr-923-xchange-export` (παλιό) δεν έχει αφαιρεθεί.

## 5. Κανόνες
Commit μόνο στο `agent/xchange-report-typography`, ρητή λίστα, πλήρες hook. Όχι `--no-verify`, `SKIP_*`, `git add -A`, `stash`,
`tsc`, `firebase deploy`. Στο `main` κανένα commit.
