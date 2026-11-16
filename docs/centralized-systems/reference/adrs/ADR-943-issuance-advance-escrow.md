# ADR-943 — Προκαταβολή ανάθεσης με κράτηση: ο ιδιοκτήτης πληρώνει, ο πάροχος κρατά, ο μηχανικός πληρώνεται στην έναρξη

| | |
|---|---|
| **Status** | 🚧 IN PROGRESS — Φ0 ✅ · Φ1 τομέας υλοποιημένος (2026-11-16) · Φ2–Φ6 εκκρεμούν |
| **Date** | 2026-11-16 |
| **Category** | Document Registry / Payments |
| **Canonical Location** | `src/lib/document-validity/issuance-advance*.ts` (τομέας) · `src/server/payments/` (κράτηση, πληρωτέα αντικείμενα) |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Σχετικά** | ADR-915 §42 (προσφορά πριν από την ανάθεση — Π-1 … Π-8) · §45 (εκκρεμότητα ανάθεσης) · ADR-ACC-030 (online πληρωμές, port παρόχου, Everypay) · ADR-195 (ίχνος) · ADR-872 (ιδεμποτία) · ADR-862 (χώρος συνεργασίας) |

---

## 1. Το πρόβλημα

Η ανάθεση έκδοσης ΠΕΑ (ADR-915 §42) τελειώνει σε **εγκεκριμένο πρόσωπο και τιμή**. Ο μηχανικός μπορεί να θέλει **προκαταβολή
πριν ξεκινήσει**. Ερώτημα Giorgio: εκδίδει τιμολόγιο εκ των προτέρων, ή ζητά χρήματα και εκδίδει παραστατικό μετά;
Απαίτηση: πρακτική μεγάλων παικτών, full enterprise, full SSoT, χωρίς εκπτώσεις.

## 2. Έρευνα (2026-11-16)

### 2.1 Ελληνικό πλαίσιο

| Πηγή | Εύρημα | Βεβαιότητα |
|---|---|---|
| [ΚΦΑ ν.2859/2000 άρθρο 16](https://www.taxheaven.gr/law/2859/2000/arthro/16) §1 | ο ΦΠΑ γεννάται/απαιτείται με την **παροχή** | κείμενο νόμου (taxheaven) |
| ίδιο, §2β | για υπηρεσίες, αν το στοιχείο εκδοθεί **πριν** την παροχή ⇒ απαιτητός **με την έκδοση** | κείμενο νόμου |
| ίδιο, §2δ | «με την είσπραξη της προκαταβολής» — **μόνο** για υπηρεσίες με τόπο φορολόγησης τον λήπτη (διασυνοριακές) | κείμενο νόμου |
| [ν.4308/2014 άρθρο 11](https://www.taxheaven.gr/law/4308/2014/arthro/11) | τιμολόγιο: υποχρέωση με την παροχή· έκδοση έως 15η επόμενου μήνα | κείμενο νόμου |
| [ν.4308/2014 άρθρο 13](https://www.taxheaven.gr/law/4308/2014/arthro/13) | στοιχείο λιανικής (ιδιώτης): με την ολοκλήρωση της υπηρεσίας | κείμενο νόμου |
| [ΔΕΔ 843/2023](https://www.taxheaven.gr/circulars/47483/ded-843-2023) (παραθέτει ΠΟΛ 1003/2014) | η Διοίκηση **δεν** δέχτηκε ότι προκαταβολή απαλλάσσει από παραστατικό | δευτερογενές |

**Συμπέρασμα:** **όχι τιμολόγιο εκ των προτέρων** (ΦΠΑ απαιτητός για χρήματα που ίσως δεν εισπραχθούν, και πιστωτικό αν
δεν πληρωθεί). **Αίτημα πληρωμής** → παραστατικό **με την είσπραξη** (η συντηρητική ανάγνωση της ΔΕΔ) → **συμψηφισμός** στο τελικό.

⚠️ **ΔΕΝ επαληθεύτηκε — προς λογιστή:** ο τύπος myDATA του παραστατικού προκαταβολής και ο τρόπος συμψηφισμού στο τελικό.
Η εφαρμογή **δεν** τα δηλώνει ως κανόνα· ελέγχει μόνο ότι τα **ποσά** των ΜΑΡΚ συμφωνούν με τα χρήματα που κινήθηκαν.

### 2.2 Ποιος κρατά τα χρήματα — PSD2

- [EBA Q&A 2020_5355](https://www.eba.europa.eu/single-rule-book-qa/qna/view/publicId/2020_5355): η εξαίρεση «εμπορικού
  αντιπροσώπου» ισχύει μόνο όταν η πλατφόρμα ενεργεί για **ένα** μέρος. Πλατφόρμα που εισπράττει από τον ιδιοκτήτη για λογαριασμό
  του μηχανικού και προστατεύει και τους δύο δεν χωρά εύκολα ([Clifford Chance 2017](https://www.cliffordchance.com/content/dam/cliffordchance/briefings/2017/11/impact-of-psd2-on-online-marketplaces-operating-in-europe.pdf)).
- Άρα **ποτέ** χρήματα τρίτου στον λογαριασμό εμπόρου της πλατφόρμας (σημερινό ACC-030). Η κράτηση γίνεται από **αδειοδοτημένο
  PSP**: [EveryPay Marketplace](https://docs.everypay.gr/marketplace-link/basic-concepts/).

### 2.3 EveryPay Marketplace ([API reference](https://docs.everypay.gr/api-reference/), [seller KYC](https://docs.everypay.gr/marketplace-link/seller-kyc/))

| Θέμα | Στοιχείο |
|---|---|
| Πωλητής | `POST /sellers` (επωνυμία, ΑΦΜ, IBAN, `is_c2c` …) · `status` Authorized/Suspended/Closed · KYC σε hosted `kyc_process_url` · webhook `SELLER_KYC.STATUS` |
| Πληρωμή | `split=1` (και στα Payment Notifications — «Marketplace-only») |
| Κράτηση | `POST /payments/{id}/transfers {seller, amount, commission_amount, on_hold}` · `PUT /transfers/{id}` (αποδέσμευση) |
| Επιστροφή | refund **μόνο πριν** το settlement· μετά ⇒ `POST /reversals {transfer, amount?}` |
| Απόδοση | payouts ανά πωλητή (`daily` προεπιλογή), `payouts_on_hold` |

⚠️ **Ανοιχτά (§8):** merchant of record · split με IRIS · webhooks transfer/payout · refund με κρατημένο transfer.

### 2.4 Μεγάλοι παίκτες

| Παίκτης | Πρακτική | Πηγή |
|---|---|---|
| Airbnb | χρέωση στην κράτηση· απόδοση ~1 εργάσιμη **μετά το check-in**· **προδηλωμένες τυποποιημένες** πολιτικές (Flexible/Moderate/Limited/Firm) | [payouts](https://www.airbnb.com/resources/hosting-homes/a/how-you-get-paid-for-hosting-20) · [policies](https://www.airbnb.com/resources/hosting-homes/a/choose-the-right-cancellation-policy-for-you-19) |
| Upwork | milestone χρηματοδοτείται **πριν** την εργασία· αποδέσμευση με έγκριση ή αυτόματα | δευτερογενές (support 403) |
| Houzz Pro | retainer πληρωμένος ⇒ εφαρμόζεται σε προγραμματισμένη πληρωμή τιμολογίου· «Applied» | [help](https://pro.houzz.com/pro-help/r/how-to-create-and-apply-retainers-and-credits) |
| Stripe | κράτηση εξουσιοδότησης κάρτας ~7 ημέρες — **ακατάλληλη** για εβδομάδες | [docs](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method) |

### 2.5 Καταναλωτής

Οδηγία 2011/83 άρθρα 9, 14(3), 16(α): υπαναχώρηση 14 ημερών σε εξ αποστάσεως υπηρεσίες· έναρξη μέσα στην περίοδο **μόνο με ρητό
αίτημα**· τότε οφείλεται **αναλογικό** τίμημα (ΔΕΕ C-641/19). ⚠️ Το ελληνικό κείμενο (ν.2251/1994 άρθρο 3ε) δεν διαβάστηκε.

## 3. SSoT audit (grep, 2026-11-16)

| Κομμάτι | Εύρημα | Συνέπεια |
|---|---|---|
| Προσφορά/έγκριση/στάδια | `issuance-quote.ts` · `issuance-stage.ts` · `reduceIssuance` (`issuance-assignment.ts`, 475 γρ.) | **επέκταση**· νέα λογική σε νέα αρχεία (όριο 500) |
| Παραστατικό ΜΑΡΚ | `IssuanceReceipt` + `receiptMatchesQuote` — μόνο **ένα**, ίσο με το σύνολο | γίνεται **λίστα με σκοπό** (`advance`/`final`) |
| Πληρωμές | ACC-030: port `PaymentProvider` (ουδέτερο) · checkout **δεμένο** σε `invoiceId/shareId` · sync → `recordInvoicePayment` | **γενίκευση** σε «πληρωτέο αντικείμενο» |
| Λογαριασμός εμπόρου | `paymentProviderForCompany` = ένας, του περιβάλλοντος | η κράτηση **δεν** περνά από αυτόν — marketplace |
| escrow / payout / seller / split | **κανένα** εύρημα σε όλο το `src/` | νέα ικανότητα του port |
| Χώρος μηχανικού | προσωπικός χώρος **χωρίς** λογιστική (`personal-workspace-surface.ts`)· `EngagedIssuanceContent` με μία πράξη (`delivery-change`) | πράξεις μηχανικού στον χώρο |
| IBAN | `contacts/{id}/bank_accounts` (επαφή **του γραφείου**) | **δεν** χρησιμοποιείται: IBAN/KYC ζουν στον PSP |
| Ίχνος | `recordIssuanceAudit` — ποσά/παραστατικά **χωρίς** πεδίο (κενό §42.6) | νέα πεδία |

## 4. Αποφάσεις

- **Κ-1 — Αίτημα πληρωμής, όχι τιμολόγιο** (§2.1). Παραστατικό του μηχανικού με την είσπραξη· τελικό με υπόλοιπο.
- **Κ-2 — Κράτηση σε αδειοδοτημένο PSP** (§2.2): EveryPay Marketplace· ο μηχανικός = πωλητής με KYC του παρόχου. Προμήθεια
  πλατφόρμας **0** (ρύθμιση `commission_amount`, απόφαση Giorgio 2026-11-16).
- **Κ-3 — Μία απόφαση, πλήρης πληροφορία** (επέκταση ADR-915 Π-1): ποσό προκαταβολής + πολιτική ακύρωσης ανήκουν στους
  **όρους της προσφοράς**· εγκρίνονται μαζί με τιμή και πρόσωπο· αναθεώρηση ⇒ νέα έγκριση (Houzz).
- **Κ-4 — Αποδέσμευση στην έναρξη** (Airbnb, απόφαση Giorgio): ο μηχανικός δηλώνει «έγινε η αυτοψία» ⇒ **48 ώρες** αντίρρησης
  του ιδιοκτήτη ⇒ αυτόματη αποδέσμευση. Αντίρρηση ⇒ το transfer μένει κρατημένο, αποφασίζει το γραφείο.
- **Κ-5 — Τυποποιημένες πολιτικές** (Airbnb, απόφαση Giorgio): `flexible` · `moderate` · `strict`, ένας κατάλογος. **Πριν** την
  έναρξη: πάντα πλήρης επιστροφή. **Μετά**: κατά την πολιτική, πάντα μέσα στα όρια της υπαναχώρησης.
- **Κ-6 — Υπαναχώρηση ενσωματωμένη** (§2.5): στην πληρωμή, ρητό αίτημα έναρξης + αναγνώριση· καταγράφεται.
- **Κ-7 — Παραστατικά δεμένα στα χρήματα**: ΜΑΡΚ `advance` = ποσό που **εισπράχθηκε**· ΜΑΡΚ `final` = σύνολο − προκαταβολή.
- **Κ-8 — Webhook = σήμα, API = αλήθεια** + cron (αρχές ACC-030)· κατάσταση προκαταβολής **παράγωγη** από γεγονότα.

## 5. Σχέδιο

### 5.1 Τομέας (`src/lib/document-validity/`)
`issuance-advance.ts` (όροι, πολιτικές, `advanceStateOf`) · `issuance-advance-reducer.ts` (πράξεις `advance-funded` · `start-work` ·
`object-start` · `advance-released` · `advance-refunded`, actor `system`) · `QuoteTerms.advance` · `receipts[]` με σκοπό ·
νέα πεδία ίχνους · schema με defaults (τα παλιά έγγραφα διαβάζονται, το `receipt` ως `final`).

### 5.2 Πληρωμές (`src/server/payments/`)
Checkout με `subject` (`invoice` | `issuance-advance`) · μητρώο `payable-subjects.ts` · cookie επιστροφής από το μητρώο ·
`PaymentProvider.marketplace` (payee · KYC · split · held transfer · release · reversal · refund) · `everypay-marketplace.ts` ·
συλλογή `payment_payees` (deny-all) · νέες ταυτότητες · cron.

### 5.3 Ροές
Προσφορά (με προκαταβολή + πολιτική) → έγκριση → πληρωμή (σελίδα έγκρισης + email, προϋπόθεση KYC μηχανικού) → κράτηση →
«έγινε η αυτοψία» → 48ω → αποδέσμευση → ΜΑΡΚ προκαταβολής → τελικός ΜΑΡΚ. Ακύρωση: refund/reversal κατά πολιτική.

### 5.4 Φάσεις
Φ0 ADR · Φ1 τομέας · Φ2 γενίκευση checkout (η πληρωμή τιμολογίου αμετάβλητη) · Φ3 marketplace port + EveryPay ·
Φ4 προσφορά → κράτηση + UI · Φ5 έναρξη/αποδέσμευση/ακύρωση/αντίρρηση + cron · Φ6 ζωντανή επαλήθευση sandbox.

### 5.5 Φ1 — τι υλοποιήθηκε (2026-11-16)

| Πού | Τι |
|---|---|
| `issuance-advance.ts` (**νέο**) | `CANCELLATION_POLICIES` · `RETAINED_AFTER_START_PERCENT` · `ADVANCE_POLICY` (48ω) · `AdvanceTerms` · `AdvanceEvent` (`funded` · `work-started` · `start-objected` · `released` · `refunded`) · **`advanceStateOf`** (η μία κρίση) · `isAdvanceReleaseDue` · `canObjectToStart` · `advanceCollectedMinor` · `refundDueOnCancelOf` · `finalRemainderMinor` |
| `issuance-advance-reducer.ts` (**νέο**) | `reduceIssuanceAdvance` — actor ανά πράξη, στάδια ανά πράξη (επιστροφή/αποδέσμευση/ΜΑΡΚ και μετά από ακύρωση), ιδεμποτία από αναφορά παρόχου |
| `issuance-actor.ts` | actor **`system`** (`source: 'payments'`) |
| `issuance-assignment.ts` | `advanceEvents` · `advanceReceipt` στην εγγραφή· ο `reduceIssuance` αναθέτει τις πράξεις προκαταβολής· όροι με προκαταβολή ≤ σύνολο· **καμία αναθεώρηση** μετά την πρώτη κίνηση χρημάτων· τελικός ΜΑΡΚ = σύνολο − εισπραχθέν |
| `issuance-quote.ts` | `QuoteTerms.advance` · `receiptMatchesQuote(…, advanceCollectedMinor)` |
| `issuance-request.ts` · `issuance-assignment-schema.ts` | `advanceTermsSchema` (αίτημα + δίσκος, `default(null)`) · `advanceEvents` `default([])` · `advanceReceipt` `default(null)` — τα παλιά έγγραφα διαβάζονται χωρίς μετάπτωση |
| `issuance-quote-draft.ts` | `advance: null` ώσπου να μπουν τα πεδία της φόρμας (Φ4) |
| `__tests__/issuance-advance.test.ts` (**νέο**) + fixtures 17 σουιτών (`advance: null`) | άγκυρες Κ-3/4/5/7/8 |

**Απόκλιση από το σχέδιο §5.1** (τεκμηριωμένη): αντί για `receipts[]` με σκοπό, **δύο ονομασμένες θέσεις** — `receipt`
(τελικό, αμετάβλητο από το §42) και `advanceReceipt`. Οι σκοποί είναι ακριβώς δύο, ο τύπος τους κλειστός, και καμία
αναγνώστρια του `receipt` δεν αλλάζει σημασία (καμία μετάπτωση).

⚠️ **Προς επιβεβαίωση Giorgio**: τα ποσοστά παρακράτησης μετά την έναρξη — ευέλικτη **0%** · μέτρια **50%** · αυστηρή
**100%** (`RETAINED_AFTER_START_PERCENT`, ένα σημείο). Πριν από την έναρξη: πάντα πλήρης επιστροφή (Κ-5).

## 6. Πού ξεπερνάμε τους μεγάλους
1. Πολιτική ακύρωσης **μέσα στην ίδια έγκριση** με την τιμή (ο Airbnb τη δείχνει, δεν την «υπογράφει» μαζί με όρους που αναθεωρούνται).
2. Υπαναχώρηση καταναλωτή **ρητή και καταγεγραμμένη** τη στιγμή της πληρωμής.
3. Φορολογικό στοιχείο **δεμένο στα χρήματα που κινήθηκαν** (ΜΑΡΚ ανά σκοπό), όχι ελεύθερο πεδίο.
4. Ελάχιστα δεδομένα: IBAN/KYC στον PSP, όχι σε εμάς.

## 7. Εκτός εμβέλειας
Ο φάκελος αρχείων της κατοικίας και το μοίρασμά του (άλλος πράκτορας) · διαβίβαση myDATA από την εφαρμογή · προμήθεια πλατφόρμας.

## 8. Ανοιχτά προς επαλήθευση
1. Merchant of record στο EveryPay Marketplace.
2. Split με IRIS.
3. Webhooks transfer/payout.
4. Refund πληρωμής με κρατημένο (μη αποδοσμένο) transfer.
5. Τύπος myDATA παραστατικού προκαταβολής + συμψηφισμός (λογιστής).
6. Ελληνικό κείμενο ν.2251/1994 άρθρο 3ε.

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-11-16 | Φ0: έρευνα (ΚΦΑ 16, ν.4308 11/13, ΔΕΔ 843/2023, PSD2/EBA, EveryPay Marketplace, Airbnb/Upwork/Houzz/Stripe, Οδηγία 2011/83) · SSoT audit · αποφάσεις Κ-1…Κ-8 (Giorgio: αποδέσμευση στην έναρξη · τυποποιημένες πολιτικές · προμήθεια 0) · σχέδιο Φ1–Φ6. |
| 2026-11-16 | Φ1: καθαρός τομέας (§5.5) — `issuance-advance.ts` · `issuance-advance-reducer.ts` · actor `system` · πεδία εγγραφής/σχήματος με defaults · τελικός ΜΑΡΚ με συμψηφισμό · σουίτα `issuance-advance.test.ts`. Απόκλιση: `advanceReceipt` αντί για `receipts[]`. |
