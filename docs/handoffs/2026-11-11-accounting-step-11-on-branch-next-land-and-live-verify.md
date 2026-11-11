# HANDOFF — 2026-11-11 — Λογιστική: βήμα 11 (δημόσια σελίδα πληρωμής) στο κλαδί → land + ζωντανή επαλήθευση

**Worktree**: `C:\Nestor_Worktrees\accounting-next` · **Κλαδί**: `agent/accounting-next`
**Η νέα συνεδρία συνεχίζει ΣΤΟ ΙΔΙΟ worktree.**
- Στο `main` κανένα commit. `wt:land` και push **ΜΟΝΟ** με ρητή εντολή Giorgio.
- Κανένα test / scan / `jscpd` χωρίς έγκριση (N.(-2)). Κανένα `tsc` (N.17). Commit στο κλαδί με ρητή λίστα αρχείων.
- Τις τεχνικές αποφάσεις τις παίρνει ο πράκτορας (κριτήριο: Stripe / Xero / QuickBooks / SAP ή καλύτερα). Στον Giorgio μόνο «ναι/όχι» για εγγραφή δεδομένων στην παραγωγή, land, push και αύξηση σφράγισης πύλης.
- Προηγούμενο handoff (ισχύουν τα §ΜΗΝ του): `2026-11-11-accounting-15-2-landed-next-step-11-public-payment-page.md`.

## 1. Κατάσταση
- Το `main` (τοπικό) είναι στο `8afda425`. Το `origin/main` είναι στο `026b50ee`, άρα το §15.2 (`bbaa61c2`) **δεν** έχει γίνει push.
- **Στο κλαδί, χωρίς land:**
  - `5fbc6f3e` feat(accounting): δημόσια σελίδα πληρωμής τιμολογίου — **ADR-ACC-018 §16** (πλήρης περιγραφή εκεί).
  - `09aba458` refactor(accounting): `PRIVATE_CHANNEL_HEADERS` → `src/lib/http/private-response-headers.ts` · το PDF χρησιμοποιεί τον ΕΝΑ `formatIBAN` (`types/contacts/banking.ts`).
  - Το commit αυτού του handoff.
- **Γιατί δεν έγινε land (εντολή Giorgio, 2026-11-11)**: το git αρνήθηκε. Το κύριο αντίγραφο `C:\Nestor_Pagonis` (κλαδί `main`) έχει **σταδιοποιημένη δουλειά άλλου πράκτορα**: ADR-937 (προσανατολισμός ακινήτου / ηλιακή έκθεση), ~55 αρχεία. Μέσα σε αυτά είναι και τα `.i18n-shell-slice.json` · `src/i18n/generated/shell-slice.manifest.json` · `src/types/i18n.ts`. **ΜΗΝ** αγγίξεις αυτή τη δουλειά (ούτε stash ούτε επαναφορά). Περιμένεις να δεσμευτεί.
  - Έλεγχος από τον Giorgio σε **ξεχωριστό** τερματικό PowerShell: `cd C:\Nestor_Pagonis; git status --short`. Η συνεδρία του worktree **αρνείται** κάθε git προς το κύριο αντίγραφο, ακόμη και με `!`.
  - Μετά τη δέσμευσή του, και μόνο με «κάνε land»: `npm run wt:land -- accounting-next`. Αναμένεται σύγκρουση rebase στα **παραγόμενα** αρχεία. Λύση **μόνο με γεννήτορες**: `npm run generate:i18n-types` και `npm run generate:i18n-shell-slice:index`, μετά σταδιοποίηση του `src/i18n/generated/`. Ποτέ με το χέρι. Αν το rebase πειράξει και τη σφράγιση `lazyRouteMountSeal` (88), ξαναμέτρα πάνω στο νέο `main`.

## 2. Τι υλοποιήθηκε (σύντομα · πλήρες: ADR-ACC-018 §16)
- **Είδος κοινοποίησης** `invoice_payment` πάνω στο ΕΝΑ σύστημα (`src/server/sharing/*` + `ShareEntityRegistry`):
  - resolver `services/sharing/resolvers/invoice-payment.resolver.ts`.
  - κριτής `invoicePaymentAuthority` (μισθωτής + `isPayableByLink`).
  - αναγγελέας ανοίγματος → `INVOICE_PAYMENT_LINK_OPENED`.
  - πολιτική `defaultExpiresInHours` (72 για τα υπάρχοντα, 720 για τιμολόγιο), την ίδια διαβάζουν διακομιστής και διάλογος.
- **Διαδρομές**: `GET /api/shares/[shareId]/invoice-payment` (όψη) και `…/pdf`. Απαιτούν κουπόνι επίσκεψης και `findActiveShareOf`, ελέγχουν μισθωτή (`server/accounting/public-invoice/tenant-invoice.ts`) και διαβάζουν λογαριασμούς από το `withCurrentPaymentAccounts`.
- **Προβολή με ρητή λίστα πεδίων**: `subapps/accounting/services/public-invoice/invoice-public-view.ts`. Κατάσταση από το `services/payments/invoice-payment-link.ts` (`payable` · `paid` · `cancelled` · `not-payable`, υπόλοιπο = `invoiceOpenAmount`).
- **Σελίδα**: `/shared/[token]`, μέσω της επιφάνειας `components/shared/pages/invoice-payment/invoice-payment-surfaces.tsx` (`defineLazySurfaces`). Namespace `accounting-public-payment`.
- **Email**: `server/accounting/public-invoice/invoice-email-payment-link.ts`. Κουμπί στο σώμα + γραμμή στο συνημμένο PDF (`paymentPageUrl`) + `paymentLinkShareId` στο `EmailSendRecord`. Ανάκληση αν αποτύχει η αποστολή.
- **Μενού τιμολογίου**: «Σύνδεσμος πληρωμής» → `InvoicePaymentLinkDialog` (τυλίγει τον ΕΝΑ `UnifiedShareDialog`).
- **SSoT που ενοποιήθηκαν**:
  - `invoice-payment-instructions.ts`: πληρωτέο · αιτιολογία · δικαιούχος · EPC payload, από τα αρχεία jsPDF.
  - `invoice-pdf-document.ts`: λογότυπο · όνομα αρχείου · ΚΑΔ · απόδοση.
  - `share-active-lookup.ts`: πρώην `activeTourShareId`.
  - `shareLinkPath`.
  - `phoneHref` / `webHref` δίπλα στο `emailHref` (`lib/validation/text-link-segments.ts`).
- **Σφράγιση CHECK 3.34**: `lazyRouteMountSeal` 87 → 88, με «ναι» Giorgio και γραμμένο why.

## 3. ΕΠΟΜΕΝΟ (με τη σειρά)
1. **Land**: όταν δεσμευτεί η δουλειά του ADR-937 στο κύριο αντίγραφο, και μόνο με εντολή Giorgio (§1).
2. **Push**: μόνο με εντολή Giorgio. Ανεβάζει **και** το §15.2 **και** το §16.
3. **Ζωντανή επαλήθευση §15.2** στο nestorconstruct.gr: §2 του handoff `…15-2-landed…`. Περιλαμβάνει την αλλαγή IBAN Eurobank→Optima χωρίς κλείσιμο, τη χειροκίνητη άρνηση `bicMismatch` και το QR του Α-7 να δείχνει `PIRBGRAA`.
4. **Ζωντανή επαλήθευση §16** με το πρόχειρο **Α-7**:
   - Μενού τιμολογίου → «Σύνδεσμος πληρωμής» → δημιουργία. Η λήξη πρέπει να είναι 30 μέρες.
   - Άνοιγμα σε **ιδιωτικό** παράθυρο. Έλεγχοι: ταινία «Προσχέδιο» · ποσό = υπόλοιπο · `PIRBGRAA` · αντιγραφή IBAN/RF/ποσού · σάρωση EPC QR με εφαρμογή τράπεζας **χωρίς** εκτέλεση · λήψη PDF (ίδιο όνομα αρχείου) · εκτύπωση · πλάτος 320px.
   - Αλλαγή γλώσσας el/en από το κέλυφος.
   - Ανάκληση → η σελίδα δείχνει «δεν είναι διαθέσιμο».
   - Αποστολή email σε **δική του** διεύθυνση Giorgio: κουμπί «Προβολή & πληρωμή online» + γραμμή-σύνδεσμος στο συνημμένο PDF. Στη λίστα συνδέσμων φαίνεται ετικέτα = παραλήπτης.
   - Ίχνος `INVOICE_PAYMENT_LINK_OPENED`: δεν υπάρχει οθόνη ιστορικού. Αν χρειαστεί, μόνο με ανάγνωση και «ναι» Giorgio.
   - Η **ακύρωση** δοκιμάζεται μόνο σε **νέο** δοκιμαστικό πρόχειρο, με «ναι» Giorgio. **ΠΟΤΕ** στα Α-3…Α-6.
5. **Καθάρισμα δοκιμαστικών** μετά την επαλήθευση (μόνο μέσω γραφέων με ίχνος, με «ναι» Giorgio): ο Eurobank «ΔΟΚΙΜΗ επανενεργοποίησης» (`bacc_0195333c-…`) και η ανενεργή Πειραιώς `PIABORAA` (`bacc_da1131b1-…`). Και οι σύνδεσμοι πληρωμής δοκιμής, με ανάκληση από τον διάλογο.

## 4. Γνωστά ανοιχτά (ADR-ACC-018 §16 «Εκτός εμβέλειας»)
- Η σελίδα **ληγμένου** συνδέσμου δείχνει τη γενική άρνηση, χωρίς στοιχεία εκδότη. Το Stripe τα δείχνει. Θα απαιτούσε `invoiceMeta` στο έγγραφο κοινοποίησης + άρνηση που τα μεταφέρει.
- Δεν υπάρχει γραφέας καταγραφής πληρωμών (`PAYMENT_RECORDED`). Η σελίδα διαβάζει τα υπάρχοντα `paymentStatus` / `balanceDue`.
- `qrUrl` myDATA (πριν από την πρώτη διαβίβαση) · παρακράτηση στο πληρωτέο · πληρωμή με κάρτα/IRIS (απαιτεί PSP).
- Το `createAccountingServices` επιστρέφει το **μη** ελεγχόμενο repository, άρα τα `INVOICE_CREATED`/`UPDATED` δεν γράφονται. Το `getInvoice` δεν ελέγχει μισθωτή (η σελίδα το κάνει μόνη της μέσω `readTenantInvoice`).
- Λίστα τραπεζών: «Παγκρήτια (πλέον CrediaBank)» και «CrediaBank» (016 vs 087).
- Τα labels του email τιμολογίου είναι χειρόγραφο δίγλωσσο `LABELS` (`invoice-email-template.ts`), όχι locales. Τα 2 νέα ακολούθησαν το υπάρχον πρότυπο.
- Το jest της 2026-11-11 έτρεξε κατά λάθος **όλη** τη σουίτα και σταμάτησε. Πρόλαβε να δείξει αποτυχίες σε **άσχετες** σουίτες (mandate-decision · catalog-import-pipeline · tour-tileset-baker · personal-scope-consumers · route-catalogue-anchor · i18n-ssr-golden · registry-baseline-reconciliation · conveyance-engagement-flow · catalog-grid-ssot). Δεν ελέγχθηκε αν προϋπήρχαν.

## 5. ΜΗΝ
- ΜΗΝ φτιάξεις δεύτερο σύστημα συνδέσμων ή δεύτερο κριτή «ενεργός σύνδεσμος» (`findActiveShareOf`).
- ΜΗΝ ξαναγράψεις οδηγίες πληρωμής, αιτιολογία ή QR: `invoice-payment-instructions.ts` · `invoice-payment-link.ts` · `withCurrentPaymentAccounts`.
- ΜΗΝ εισαγάγεις στατικά τη σελίδα τιμολογίου στο `SharedFilePageContent`, και μη χρησιμοποιήσεις τοπικό `next/dynamic` (CHECK 3.34). Μόνο μέσω `invoice-payment-surfaces.tsx`.
- ΜΗΝ ξαναβάλεις `mailto:` / `tel:` / ωμό `href` ιστοτόπου (CHECK 3.7): `emailHref` · `phoneHref` · `webHref`.
- ΜΗΝ αλλάξεις snapshot **εκδομένου** τιμολογίου. ΜΗΝ γράψεις στο `accounting_bank_accounts` εκτός `accounting-repo-bank-accounts.ts`.
- ΜΗ σβήσεις Α-3 / Α-4 / Α-5 / Α-6. Καμία διαβίβαση ΑΑΔΕ. ΜΗ διορθώσεις χειρόγραφα `src/types/i18n.ts` / `src/i18n/generated/*`.
- ΜΗΝ αγγίξεις τη σταδιοποιημένη δουλειά ADR-937 στο `C:\Nestor_Pagonis`.
