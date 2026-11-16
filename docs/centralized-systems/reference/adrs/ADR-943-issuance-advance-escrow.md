# ADR-943 — Προκαταβολή ανάθεσης με κράτηση: ο ιδιοκτήτης πληρώνει, ο πάροχος κρατά, ο μηχανικός πληρώνεται στην έναρξη

| | |
|---|---|
| **Status** | 🚧 IN PROGRESS — Φ0 ✅ · Φ1 τομέας ✅ · Φ2 γενίκευση checkout ✅ · Φ3 marketplace ✅ (2026-11-16) · Φ4–Φ6 εκκρεμούν |
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

⚠️ **Ποσοστά παρακράτησης μετά την έναρξη** — ευέλικτη **0%** · μέτρια **50%** · αυστηρή **100%** της προκαταβολής
(`RETAINED_AFTER_START_PERCENT`, ένα σημείο). Πριν από την έναρξη: πάντα πλήρης επιστροφή (Κ-5). Οδηγία Giorgio
(2026-11-16): «όπως οι μεγάλοι παίκτες». Έρευνα:
- [ΑΚ 700](https://www.taxheaven.gr/law/π.δ.456/1984/arthro/700) (σύμβαση έργου): ο εργοδότης καταγγέλλει **οποτεδήποτε**
  ως την αποπεράτωση· ο εργολάβος δικαιούται τη **συμφωνημένη αμοιβή**, μείον ό,τι εξοικονόμησε και ό,τι κέρδισε (ή
  σκόπιμα δεν κέρδισε) αλλού. Η προκαταβολή είναι ≤ σύνολο (Φ1), άρα παρακράτηση έως 100% της **προκαταβολής** μένει
  κάτω από το νόμιμο ταβάνι **όταν** η προκαταβολή δεν ξεπερνά «αμοιβή − εξοικονόμηση».
- Airbnb: τυποποιημένες βαθμίδες (Flexible → Firm)· Upwork / Angi / Thumbtack: για υπηρεσίες, η παρακράτηση μετά την
  έναρξη ακολουθεί τη **δουλειά που έγινε** και τους όρους της σύμβασης (δευτερογενείς πηγές — τα επίσημα κείμενα
  δεν βρέθηκαν).
- Καταναλωτής μέσα στις 14 ημέρες υπαναχώρησης, με ρητό αίτημα έναρξης: οφείλεται **αναλογικό** τίμημα (Οδηγία
  2011/83 άρθρο 14(3), §2.5) — εκεί η παρακράτηση δεν μπορεί να ξεπεράσει την αξία της παρασχεθείσας υπηρεσίας.

**Οι τιμές 0/50/100 κρατήθηκαν**. Ανοιχτά §8 #7–#8: όριο της προκαταβολής ως ποσοστό του συνόλου, και πλαφόν
«αναλογικό τίμημα» για καταναλωτή μέσα στις 14 ημέρες (ν.2251/1994 άρθρο 3ε και καταχρηστικοί όροι — δεν διαβάστηκαν).

### 5.6 Φ2 — τι υλοποιήθηκε (2026-11-16): το checkout πληρώνει «πληρωτέο αντικείμενο»

Στόχος: η πληρωμή τιμολογίου **αμετάβλητη στη συμπεριφορά**, και το checkout έτοιμο να δεχτεί δεύτερο είδος χωρίς να
αγγιχτεί ξανά ο πυρήνας του (συγχρονισμός · webhook · συμφιλίωση · κλείσιμο · επιστροφή browser).

| Πού | Τι |
|---|---|
| `server/payments/payable-subject.ts` (**νέο**, καθαρό) | `PAYABLE_SUBJECT_KINDS` (κλειστό) · `PayableSubject` (διάκριση `kind`) · **ο ένας κωδικοποιητής** `payableSubjectOf` / `storedPayableSubjectOf` · διαδρομή επιστροφής ανά είδος (`isReturnPathOfKind` · `isPayableReturnPath`) · εμβέλεια απόπειρας (`sameAttemptScope`) |
| `server/payments/payable-subject-registry.ts` (**νέο**) | `recordPayableMovement` — εξαντλητικό `switch` στο είδος ⇒ ο ΕΝΑΣ γραφέας του είδους· `PayableMovementOutcome` `recorded` · `duplicate` · `subject-absent` |
| `server/accounting/payments/invoice-payable-subject.ts` (**νέο**) | ο handler του τιμολογίου: `recordInvoicePayment` με ντετερμινιστικό `paymentId` και δράστη τον πάροχο — **μεταφερμένος αυτούσιος** από τον συγχρονισμό |
| `payment-checkout-store.ts` | `PaymentCheckoutRecord.subject` αντί για `invoiceId`/`shareId` · `storedCheckoutOf` · `listPendingCheckoutsOf(subject)` (ένα **ρητό** ερώτημα ανά είδος — ορατό στις πύλες δεικτών 3.15/3.91, όχι μεταβλητό όνομα πεδίου) |
| `payment-checkout-closing.ts` | μετακινήθηκε από `accounting/payments/` (ήταν ήδη ουδέτερο ως προς είδος) · `closePendingCheckoutsOf(subject)` |
| συγχρονισμός · συμφιλίωση · επιστροφές · έκβαση απόπειρας · cookie | ρωτούν το μητρώο / τον κωδικοποιητή· `invoice-absent` → `subject-absent` |

**Μορφή στη βάση — γιατί όχι ένθετο `subject` στο έγγραφο**: τα πεδία μένουν στο πάνω επίπεδο (`invoiceId`, `shareId`) και
το είδος γράφεται στο `subjectKind`· έγγραφο **χωρίς** `subjectKind` = τιμολόγιο. Έτσι: **καμία μετάπτωση** παλιών
εγγράφων, η αναζήτηση `shareId ==` δεν αλλάζει, **κανένας** νέος δείκτης. Στη **μνήμη** όμως το αντικείμενο είναι ένα πεδίο με
διάκριση, ώστε ο compiler να αναγκάζει κάθε αναγνώστη να ρωτήσει «ποιο είδος;». Είδος που δεν ξέρει ο κώδικας ⇒ η συνεδρία
είναι **ανύπαρκτη** (ποτέ «διαβάζεται ως τιμολόγιο»).

**Ονομασία**: `PayableSubject`, **όχι** `CheckoutSubject` — το δεύτερο υπάρχει ήδη στο port με άλλη σημασία (ό,τι χρειάζεται ο
πάροχος για να ρωτήσει). Ο πάροχος δεν μαθαίνει ποτέ **τι** πληρώνεται.

**Απόφαση Giorgio (2026-11-16, Α1)**: το είδος `issuance-advance` **δεν** μπαίνει στη Φ2. Μπαίνει στη **Φ4**, μαζί με τον
πραγματικό γραφέα του (actor `system` στο `stageIssuanceAction`). Λόγος: κανένα είδος που δέχεται χρήματα χωρίς γραφέα, και
κανένας κώδικας που δεν εκτελείται. Το εξαντλητικό `switch` και οι εξαντλητικοί πίνακες (`RETURN_PATH_OF_KIND`) θα
**αναγκάσουν** τη Φ4 να δηλώσει γραφέα, διαδρομή επιστροφής (`/document-request` — `DOCUMENT_REQUEST_PATH`, χωρίς
διαπιστευτήριο: η σελίδα κρατά τον σύνδεσμο στο `sessionStorage` της καρτέλας) και εμβέλεια (`assignmentId`).

**Επαλήθευση**: jest 12 σουίτες / 104 tests (με έγκριση Giorgio) — οι υπάρχουσες του ACC-030 αμετάβλητες εκτός από ένα
όνομα αποτελέσματος (`subject-absent`), και η νέα `payable-subject.test.ts` (παλιό έγγραφο ⇒ τιμολόγιο · άγνωστο είδος ⇒
ανύπαρκτο · γραφή ⇄ ανάγνωση · ανοιχτή ανακατεύθυνση · ρητό ερώτημα εμβέλειας · ιδεμποτία γραφέα).

### 5.7 Φ3 — τι υλοποιήθηκε (2026-11-16): ικανότητα marketplace + EveryPay Marketplace + δικαιούχοι

Έρευνα API ([API reference](https://docs.everypay.gr/api-reference/) · [Basic concepts](https://docs.everypay.gr/marketplace-link/basic-concepts/) ·
[Seller KYC](https://docs.everypay.gr/marketplace-link/seller-kyc/) · [Webhooks](https://docs.everypay.gr/tools/webhooks/), 2026-11-16):
πωλητής `POST/GET/PUT /sellers` (κατάσταση `Authorized`/`Suspended`/`Closed`) · μεταφορά `POST /payments/{id}/transfers`
(`seller`, `amount`, `commission_amount` < `amount`, `description`, `on_hold` 1/0· μόνο captured, `split=1`, χωρίς δόσεις,
χωρίς πλήρη επιστροφή) · αποδέσμευση `PUT /transfers/{id}` `on_hold=0` · λίστα `GET /transfers?payment=&seller=` ·
αντιλογισμός `POST /reversals {transfer, amount?}` · επιστροφή μόνο για **ανεκκαθάριστη** split πληρωμή · webhook
`SELLER_KYC.STATUS` (`seller_token`, `status`, `category_status`, `kyc_process_url`). 🔴 **Κανένα webhook για
transfers / payouts / reversals** στην τεκμηρίωση ⇒ η κατάστασή τους **διαβάζεται** (cron, Φ5). **Κανένα κλειδί ιδεμποτίας.**

| Πού | Τι |
|---|---|
| `server/payments/payment-marketplace.ts` (**νέο**) | το συμβόλαιο: `PayeeRegistration` · `PayeeAccount` · `PayeeTransfer` · `MarketplaceCapability` (`registerPayee` · `readPayee` · `ensureTransfer` · `readTransfer` · `releaseTransfer` · `reconcileTransferReversal` · `reconcilePaymentRefund`) |
| `payment-provider.ts` | `PaymentProvider.marketplace: MarketplaceCapability \| null` (ρητό `null`, όχι προαιρετικό) · σήμα `payee-kyc` · διάγνωση `kyc:<κατάσταση>` |
| `providers/everypay/everypay-marketplace.ts` · `…-readers.ts` (**νέα**) | adapter + αναγνώστες με φρουρούς· άγνωστη κατάσταση ⇒ `unknown`, **ποτέ** `authorized`· μεταφορά χωρίς σημαία κράτησης ⇒ μη αναγνώσιμη |
| `everypay-config.ts` · `environment-contract.ts` · `.env.example` | `EVERYPAY_MARKETPLACE` — δεκτό **μόνο** `enabled`· αλλιώς `marketplace: null` (καμία κλήση σε endpoint που ο λογαριασμός δεν έχει) |
| `payment-payee-store.ts` · `payment-payee-service.ts` (**νέα**) | συλλογή `payment_payees`: ΕΝΑΣ δικαιούχος ανά (πάροχος, χρήστης) — ταυτότητα `ppye` ντετερμινιστική· **κράτηση θέσης** πριν από τον πάροχο· KYC από σήμα, εξουσιοδότηση από API |
| `payment-webhook-handler.ts` | `payee-kyc` ⇒ `syncPayeeFromKycSignal` |
| `firestore.rules` · `coverage-manifest.ts` · `payment-payees.rules.test.ts` | deny-all (CHECK 3.16) |
| `enterprise-id-*` | `PAYMENT_PAYEE: 'ppye'` · `generateDeterministicPaymentPayeeId` |

**🔑 Πού ξεπερνάμε τους μεγάλους — δηλωτικές πράξεις χρημάτων.** Ο πάροχος δεν δέχεται κλειδί ιδεμποτίας. Το Stripe το
λύνει με `Idempotency-Key`· εδώ δεν υπάρχει. Η εντολή «επίστρεψε 3 €» μετά από timeout («έγινε ή όχι;») θα επέστρεφε δύο
φορές. Κάθε πράξη χρημάτων λοιπόν δηλώνει **τελική κατάσταση** («συνολικά επιστραμμένα 3 €», «υπάρχει **η** μεταφορά Χ→Υ») και
ο adapter **διαβάζει πρώτα**, στέλνει **μόνο τη διαφορά** (πρότυπο ελεγκτή Kubernetes). Στόχος πάνω από το ποσό ⇒ σφάλμα, ποτέ
σιωπηλή περικοπή. Δεύτερη μεταφορά για την ίδια πληρωμή/πωλητή ⇒ σφάλμα, ποτέ δεύτερη. ⚠️ Δεν σειριοποιεί **ταυτόχρονους**
καλούντες — αυτό το κάνει ο καλών (Φ4–Φ5: lease στο έγγραφο της ανάθεσης).

**Απόκλιση από το handoff (τεκμηριωμένη)**: το `split=1` στην έναρξη πληρωμής **δεν** μπήκε στη Φ3. Είναι ιδιότητα της
**συνεδρίας** (κάρτα: `POST /notifications` · IRIS: `POST /payments` στη χρέωση πηγής), άρα θέλει πεδίο στο έγγραφο της
συνεδρίας — μπαίνει στη **Φ4** μαζί με το είδος `issuance-advance`, όπως αποφασίστηκε (Α1) για το ίδιο το είδος.

**Επαλήθευση**: jest 14 σουίτες / 127 tests — νέες `everypay-marketplace.test.ts` (αναγνώστες · webhook KYC · μία μεταφορά ·
αποδέσμευση μία φορά · δηλωτικός αντιλογισμός/επιστροφή) και `payment-payee.test.ts` (κράτηση θέσης · ένας πωλητής · KYC από
σήμα, εξουσιοδότηση από API · κανένα IBAN/ΑΦΜ στη βάση). Η σουίτα κανόνων τρέχει στο emulator (CI).

## 6. Πού ξεπερνάμε τους μεγάλους
1. Πολιτική ακύρωσης **μέσα στην ίδια έγκριση** με την τιμή (ο Airbnb τη δείχνει, δεν την «υπογράφει» μαζί με όρους που αναθεωρούνται).
2. Υπαναχώρηση καταναλωτή **ρητή και καταγεγραμμένη** τη στιγμή της πληρωμής.
3. Φορολογικό στοιχείο **δεμένο στα χρήματα που κινήθηκαν** (ΜΑΡΚ ανά σκοπό), όχι ελεύθερο πεδίο.
4. Ελάχιστα δεδομένα: IBAN/KYC στον PSP, όχι σε εμάς.
5. Ιδεμποτία χρημάτων **χωρίς** κλειδί ιδεμποτίας του παρόχου: δηλωτικές πράξεις (§5.7).

## 7. Εκτός εμβέλειας
Ο φάκελος αρχείων της κατοικίας και το μοίρασμά του (άλλος πράκτορας) · διαβίβαση myDATA από την εφαρμογή · προμήθεια πλατφόρμας.

## 8. Ανοιχτά προς επαλήθευση
1. Merchant of record στο EveryPay Marketplace.
2. Split με IRIS.
3. Webhooks transfer/payout — **δεν τεκμηριώνονται** (2026-11-16)· σχέδιο: ανάγνωση από cron (Φ5).
4. Refund πληρωμής με κρατημένο (μη αποδοσμένο) transfer. Τεκμηρίωση: refund **μόνο** για ανεκκαθάριστη split πληρωμή,
   και η εκκαθάριση γίνεται όταν οι μεταφορές καλύψουν το ποσό ⇒ με κρατημένη μεταφορά ολόκληρου του ποσού, ακύρωση πριν
   την έναρξη = **αντιλογισμός + επιστροφή**· αν μετά τον αντιλογισμό η πληρωμή ξαναγίνεται «ανεκκαθάριστη» δεν δηλώνεται.
   Εναλλακτική προς κρίση στη Φ4/Φ5: μεταφορά **κατά την αποδέσμευση** (πρότυπο Stripe «separate charges and transfers»)
   — αν ο πάροχος επιτρέπει split πληρωμή χωρίς μεταφορά για εβδομάδες. Κλείνει στη Φ6 (sandbox).
5. Τύπος myDATA παραστατικού προκαταβολής + συμψηφισμός (λογιστής).
6. Ελληνικό κείμενο ν.2251/1994 άρθρο 3ε.
7. Ανώτατο όριο προκαταβολής ως ποσοστό του συνόλου (ΑΚ 700: η παρακράτηση ως «αμοιβή − εξοικονόμηση»).
8. Πλαφόν «αναλογικό τίμημα» για καταναλωτή μέσα στις 14 ημέρες (Οδηγία 2011/83 άρθρο 14(3)) — θέλει αξία της αυτοψίας.
9. Μορφή σε φόρμα των `is_c2c` / `on_hold` (`1`/`0`) · `kyc_process_url` στη δημιουργία πωλητή · υπογραφή του webhook KYC
   με την ίδια κεφαλίδα — ζωντανά στη Φ6.
10. Κατάρρευση μετά την επιτυχή εγγραφή πωλητή και πριν γραφτεί η αναφορά ⇒ πιθανός δεύτερος πωλητής (ο πάροχος δεν
    τεκμηριώνει αναζήτηση πωλητή με ΑΦΜ) — εντοπισμός στο dashboard.

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-11-16 | Φ0: έρευνα (ΚΦΑ 16, ν.4308 11/13, ΔΕΔ 843/2023, PSD2/EBA, EveryPay Marketplace, Airbnb/Upwork/Houzz/Stripe, Οδηγία 2011/83) · SSoT audit · αποφάσεις Κ-1…Κ-8 (Giorgio: αποδέσμευση στην έναρξη · τυποποιημένες πολιτικές · προμήθεια 0) · σχέδιο Φ1–Φ6. |
| 2026-11-16 | Φ1: καθαρός τομέας (§5.5) — `issuance-advance.ts` · `issuance-advance-reducer.ts` · actor `system` · πεδία εγγραφής/σχήματος με defaults · τελικός ΜΑΡΚ με συμψηφισμό · σουίτα `issuance-advance.test.ts`. Απόκλιση: `advanceReceipt` αντί για `receipts[]`. |
| 2026-11-16 | Φ2 (§5.6): γενίκευση checkout σε «πληρωτέο αντικείμενο» χωρίς αλλαγή συμπεριφοράς — `payable-subject.ts` (λεξιλόγιο + κωδικοποιητής) · `payable-subject-registry.ts` (γραφέας ανά είδος) · `invoice-payable-subject.ts` · `PaymentCheckoutRecord.subject` (στη βάση ίδια πεδία + `subjectKind`, καμία μετάπτωση) · `payment-checkout-closing.ts` μετακινήθηκε στο `server/payments/`. Απόφαση Giorgio Α1: το `issuance-advance` μπαίνει στη Φ4 μαζί με τον γραφέα του. Jest 12/104. |
| 2026-11-16 | Φ3 (§5.7): έρευνα EveryPay Marketplace API (sellers · transfers · reversals · payouts · KYC webhook — κανένα webhook transfer/payout, κανένα κλειδί ιδεμποτίας) · `MarketplaceCapability` με **δηλωτικές** πράξεις χρημάτων · adapter + αναγνώστες · `EVERYPAY_MARKETPLACE` · συλλογή `payment_payees` (deny-all, `ppye`, κράτηση θέσης) · σήμα `payee-kyc`. Ποσοστά παρακράτησης 0/50/100 κρατήθηκαν μετά από έρευνα (ΑΚ 700, Airbnb, Οδηγία 2011/83 14(3))· §8 #7–#10 νέα. Απόκλιση: `split=1` στη Φ4. Jest 14/127. |
