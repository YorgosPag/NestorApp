# ADR-923 · Ανάθεση Α (εξαγωγή ETIM xChange) — handoff ολοκλήρωσης

**Ημερομηνία:** 2026-11-03 · **Worktree:** `C:\Nestor_Worktrees\adr-923-xchange-export` · **Κλαδί:** `agent/adr-923-xchange-export`
**Βάση κλαδιού:** `bad7f0f3` (παλιά) — το τοπικό `main` είναι πλέον `f766205e`.
**Brief:** `C:\Nestor_Worktrees\adr-923-phase3-close\HANDOFFS\2026-11-03_ADR-923_brief-A_xchange-export.md`

## 1. Κατάσταση

Ο κώδικας της Α είναι **γραμμένος αλλά ΑΔΕΣΜΕΥΤΟΣ** (working tree αυτού του worktree, όχι stash). Το commit
μπλοκάρει στην πύλη **CHECK 3.34** (φρεσκάδα i18n shell slice, ADR-744). Ο subagent που τον έγραψε αποσύρθηκε·
η νέα συνεδρία παραλαμβάνει τη δουλειά ως δική της.

Αρχεία σε εξέλιξη (`git status`):
- Τροποποιημένα: `.claude-rules/pending-ratchet-work.md`, `ADR-923-supplier-product-catalog-pim.md`,
  `PublicationsContent.tsx`, `catalog-labels.ts`, `locales/{el,en}/catalog.json`, `price-quote.server.ts`,
  `catalog-routes.ts`, `etim-xchange-roundtrip.test.ts`, `catalog-to-xchange.ts`, `catalog-issues.ts`,
  `vocabulary/etim.ts`, `src/types/i18n.ts`.
- Νέα: `src/app/api/catalog/xchange-export/`, `src/components/catalog/interop/`,
  `src/server/catalog/xchange-export.server.ts` (+ test), `src/services/catalog/catalog-interop-api.client.ts`,
  `interop/etim/xchange-export-assembly.ts`, `interop/etim/xchange-pricing.ts` (+ test),
  `src/subapps/catalog/types/xchange-export.ts`.

Τι κάνει:
- Διαδρομή `GET /api/catalog/xchange-export?language=…[&priceListId=…]`, μέσω `catalogReadRoute`/`pricingView`.
- Το `quoteWithin` χωρίστηκε σε `readQuoteBasis` + `quoteOnBasis`.
- Διάλογος εξαγωγής στη σελίδα δημοσιεύσεων.
- Νέα §5.14.1 στο ADR-923 (Z10–Z18).
- Jest πράσινο. Μεταλλάξεις 17/18· ο επιζών είναι προϋπάρχων έλεγχος που δεν μπορεί να αποτύχει.

## 2. Αποφάσεις ιδιοκτήτη που ΙΣΧΥΟΥΝ (μην τις ξανανοίξεις)

- **Α·Ε1:** ο προμηθευτής επιλέγει **ρητά** το ακροατήριο τιμής σε κάθε εξαγωγή.
  - Προεπιλογή: η δημόσια τιμή καταλόγου, δηλαδή η τιμή του ανώνυμου θεατή.
  - Εναλλακτικά: λίστα πελάτη μέσω `priceListId`.
  - **Ένα ακροατήριο ανά αρχείο.** Η αναφορά καταγράφει λίστα, έκδοση και ημερομηνία.
- **Α·Ε2:** οι κρυφοί SKU **δεν** εξάγονται. Κρίνονται με την ίδια ετυμηγορία ορατότητας για το ακροατήριο που επιλέχθηκε και μετρώνται στην αναφορά.

## 3. Τι μένει — με σειρά

### 3.1 Πύλη 3.34 · απόφαση: **(Γ) διόρθωση της ρίζας ΠΡΩΤΑ** (εντολή «χωρίς εκπτώσεις»)
- **Μέτρηση:** η slice της `/catalog/imports` βγαίνει **28372 bytes**, ενώ το ταβάνι είναι **28216** (σφραγίδα 22573 + 25%). Είναι δηλαδή **156 bytes πάνω**. Την ξεπερνούν τα δύο νέα κλειδιά `issues.xchangePriceListNotOffered` και `issues.xchangeSupplierNameMissing`.
- **Ρίζα:** όλα τα `catalog.issues.*` φορτώνονται στο πρώτο καρέ κάθε σελίδας καταλόγου, ενώ χρειάζονται μόνο όταν εμφανιστεί σφάλμα. Το ίδιο πρόβλημα ανάγκασε την Ανάθεση Β (`6c5a6bee`) να βάλει τον `qrOriginNotPublic` στις αποτυχίες έκδοσης αντί για 422. Είναι ήδη καταχωρισμένο στο `.claude-rules/pending-ratchet-work.md`.
- **Πριν από τον κώδικα:**
  1. Διάβασε το ADR-744 και το `docs/gates/3.34.md`.
  2. Βρες πώς χτίζει τη slice ο γεννήτορας `generate:i18n-shell-slice:*`.
  3. Κάνε grep αν υπάρχει ήδη μηχανισμός για namespace ή υποδέντρο που φορτώνεται κατ' απαίτηση (ADR-280 namespace loaders, CHECK 3.36/3.108).
  4. Ψάξε πώς το κάνουν οι μεγάλοι: i18next lazy namespaces, Figma, Next.js-intl message splitting.
- **Στόχος:**
  - Τα `issues.*` να φορτώνονται μόνο όταν χρειάζονται, πάνω στον υπάρχοντα μηχανισμό και χωρίς δεύτερο.
  - Η slice της `/catalog/imports` να **πέσει**. Μετά ξανασφραγίζεται **προς τα κάτω** με τον γεννήτορα.
  - Τα δύο νέα κλειδιά μπαίνουν χωρίς reseal προς τα πάνω.
- **Αν το (Γ) αποδειχθεί μεγάλο** (>1 μέρα ή πολλά domains): **σταμάτα και ρώτα τον Giorgio** πριν πέσεις στο (Α).
  - Το (Α) είναι reseal 22573→28372, με μετρημένη αιτιολογία.
  - Το (Γ) πάει στο pending.
- **Μεταλλάξεις:** στο νέο σημείο φόρτωσης κατ' απαίτηση. Παράδειγμα: σβήσε τη φόρτωση → πρέπει να κοκκινίσει test ή πύλη.

### 3.2 Γραφή τιμών xChange · **ΕΠΑΛΗΘΕΥΣΗ με επίσημη πηγή πριν την αποδοχή**
Ο subagent έγραψε τα εξής:
- **Δημόσια λίστα (≈ BMEcat `net_list`):** πάντα `GrossListPrice`. Το `NetPrice` γράφεται μόνο όταν το ακροατήριο έχει έκπτωση.
- **Λίστα πελάτη (≈ `net_customer`):** μόνο `NetPrice`.

⚠️ **Αβεβαιότητα:** η λέξη «Gross» μπορεί να σημαίνει «πριν την έκπτωση» (Bruttolistenpreis του χονδρεμπορίου) ή «με ΦΠΑ», όπως το BMEcat `gros_list`.

**Τι κάνεις:**
1. Άνοιξε το **επίσημο σχήμα ETIM xChange** (etim-international.com, GitHub ETIM-International / xChange JSON schema) και τον ορισμό των πεδίων τιμής.
2. Δες ποια πεδία είναι υποχρεωτικά, τι σημαίνει το «Gross» και πώς δηλώνονται ΦΠΑ, νόμισμα και μονάδα τιμής.
3. Ευθυγράμμισε τον κώδικα με το σχήμα και γράψε την πηγή στην §5.14.1.
4. Αν το σχήμα το αφήνει ανοιχτό, ακολούθησε το BMEcat 2005: δεν γράφουμε ποτέ τιμή με ΦΠΑ ως λίστα.

### 3.3 Rebase και commit
1. **Rebase** στο τοπικό `main` (`f766205e`). Το `f766205e` φέρνει το μοτίβο κωδικών σφάλματος που φτάνουν στις φόρμες (ADR-923). Έλεγξε αν η διαδρομή εξαγωγής πρέπει να το ακολουθήσει, αντί για δικό της.
2. Ξαναπαράγε το `src/types/i18n.ts` και τις slices **μόνο** με τους γεννήτορες: `generate:i18n-types`, `generate:i18n-shell-slice:*`.
3. **Commit** στο `agent/adr-923-xchange-export`, με ρητή λίστα αρχείων και πλήρες hook.

### 3.4 Γνωστά ανοιχτά (μην τα χάσεις στην αναφορά)
- Δεν έγινε έλεγχος στον browser.
- Λείπει το `no-store` στο `catalogReadRoute` (απόκριση με τιμές).
- Υπάρχει δίδυμος αναγνώστης με τον `readCatalogData` του εκδότη. Είναι στο pending-ratchet και ελέγχεται κατά το N.0.2: αν η διόρθωση είναι μικρή, γίνεται τώρα.
- Προϋπάρχει κόκκινο το `catalog-label-maps.test.ts`: λείπει το `portfolioProjectImagesRequired` από τα `ISSUE_KEYS`. Είναι μικρό· διόρθωσέ το (Boy Scout).

## 4. Κανόνες (ισχύουν ακέραιοι)
- Πραγματικό SSoT audit (grep) πριν από κάθε γραμμή κώδικα.
- Full enterprise + full SSoT, επίπεδο Revit/ArchiCAD/Figma/Zillow/Idealista, χωρίς εκπτώσεις. Έρευνα στο διαδίκτυο όπου υπάρχει αμφιβολία.
- Μεταλλάξεις σε κάθε νέα διακλάδωση.
- Commit μόνο στο `agent/…`, με ρητή λίστα αρχείων και πλήρες hook. Ποτέ commit στο `main`.
- **`wt:land` και push ΜΟΝΟ με εντολή Giorgio.**
- Απαγορεύονται: `--no-verify`, `SKIP_*`, `git add -A`, `stash`, `tsc`, `firebase deploy`.
- Ζωντανές εγγραφές στην παραγωγή μόνο με «ναι» του Giorgio.
- Κάθε νέο πακέτο περνά έλεγχο άδειας N.5.
- Τα HANDOFFS αγνοούνται μέσω `.git/info/exclude`, οπότε μπαίνουν με `git add -f`.

## 5. Πλαίσιο άλλων κλαδιών (μόνο για ενημέρωση — ΜΗΝ τα αγγίξεις)
- `agent/adr-923-e6-quote` `2bd9a78d`: Ε6, με το σχέδιο του Τ4 στο `HANDOFFS/2026-11-03_ADR-923_E6-T4-design_handoff.md`.
- `agent/adr-923-publisher-qr` `6c5a6bee`: Ανάθεση Β, έτοιμη, θέλει rebase.
- `agent/adr-923-phase3-close` `a2eec6fc`.
- `agent/adr-923-phase6b` `ada1c115`: ADR-928 Φ2.
- **Σειρά land με προσοχή:** τα 6b, Τ4 και `main` αγγίζουν τις ίδιες περιοχές στο `firestore-collections.ts` και στο `firestore.rules`.
