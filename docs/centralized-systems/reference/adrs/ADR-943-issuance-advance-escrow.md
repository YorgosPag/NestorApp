# ADR-943 — Προκαταβολή ανάθεσης με κράτηση: ο ιδιοκτήτης πληρώνει, ο πάροχος κρατά, ο μηχανικός πληρώνεται στην έναρξη

| | |
|---|---|
| **Status** | 🚧 IN PROGRESS — Φ0 ✅ · Φ1 τομέας ✅ · Φ2 γενίκευση checkout ✅ · Φ3 marketplace ✅ (2026-11-16) · Φ4α όροι + έγκριση ✅ (2026-11-17) · Φ4β πληρωμή → κράτηση ✅ (2026-11-17, jest εκκρεμεί έγκριση) · Φ5α ✅ · Φ5β σελίδα ιδιοκτήτη + αίτημα πληρωμής γραφείου ✅ (2026-11-17) · Φ5γ – Φ6 εκκρεμούν |
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
αίτημα**· τότε οφείλεται **αναλογικό** τίμημα (ΔΕΕ C-641/19). Ελληνικό κείμενο (διαβάστηκε 2026-11-17, §5.8):
[ν.2251/1994 άρθρο 3ε](https://www.lawspot.gr/nomothesia/n-2251-1994/arthro-3e-nomos-2251-1994-dikaioma-ypanahorisis/) (δικαίωμα) ·
[άρθρο 3ι §3–§4](https://www.lawspot.gr/nomothesia/n-2251-1994/arthro-3i-nomos-2251-1994-ypohreoseis-toy-katanaloti-se/) (αναλογικό ποσό ·
τίποτα χωρίς ενημέρωση ή ρητή συγκατάθεση) · [άρθρο 3ιβ (α)](https://www.lawspot.gr/nomothesia/n-2251-1994/arthro-3iv-nomos-2251-1994-exaireseis-apo-dikaioma/)
(καμία υπαναχώρηση μετά την πλήρη παροχή με ρητή συγκατάθεση και αναγνώριση). ⚠️ Το νέο άρθρο 3ιστ (ν.5317/2026 άρθρο 72) αφορά
**χρηματοοικονομικές** υπηρεσίες (Οδηγία 2023/2673) — **όχι** αυτή την περίπτωση.

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

### 5.8 Φ4α — τι υλοποιήθηκε (2026-11-17): όροι της προκαταβολής + έγκριση με πίνακα ακύρωσης

Οδηγία Giorgio (2026-11-17): «όπως οι μεγάλοι παίκτες — κι αν μπορείς, εξυπνότερα». Τέσσερις αποφάσεις, με έρευνα:

| # | Απόφαση | Πηγή |
|---|---|---|
| Δ-1 | **Ανώτατη προκαταβολή 50% του συνόλου** (`ADVANCE_POLICY.maxPercentOfTotal`, `maxAdvanceMinorOf` — ένα σημείο, κρίνεται στον μειωτή **και** στο πρόχειρο της φόρμας από την ίδια `isAdvanceTermsValid`) | [Airbnb «Pay part now, part later»](https://airbnb.com/help/article/2143) (πρώτη δόση συνήθως 50%, αποδέσμευση στο check-in = το πρότυπο Κ-4) · Upwork χρηματοδοτεί 100% αλλά αποδεσμεύει **με την έγκριση της παράδοσης** ([support](https://support.upwork.com/hc/en-us/articles/211063748)), όχι στην έναρξη · ΑΚ 700 |
| Δ-2 | **Μεταφορά στην πληρωμή, κρατημένη** (`on_hold`) — όχι «στην αποδέσμευση» | [EveryPay Basic Concepts](https://docs.everypay.gr/marketplace-link/basic-concepts/): τα αμεταβίβαστα «δεν πρέπει να μένουν επ' αόριστον», να περνούν στον πωλητή «άμεσα». Κλείνει το σκέλος σχεδίασης του §8 #4· η συμπεριφορά επιστροφής μετά από αντιλογισμό μένει για το sandbox (Φ6). |
| Δ-3 | **Πλαφόν αναλογικού τιμήματος για ΚΑΘΕ ιδιοκτήτη** — καμία κατάταξη του αγοραστή | Airbnb · Etsy · Booking ζητούν δήλωση επαγγελματία **μόνο** από τον πάροχο ([Airbnb](https://airbnb.com/help/article/1321)) |
| Δ-4 | **Αξία αυτοψίας υποχρεωτική** σε κάθε προσφορά με προκαταβολή (`AdvanceTerms.inspectionValueMinor`, 0 < αξία ≤ σύνολο) | ν.2251/1994 3ι §4: χωρίς ενημέρωση για το ποσό δεν οφείλεται τίποτα |

**Ο κανόνας της ακύρωσης** (`refundDueOnCancelOf(facts, atIso)` — η ΜΙΑ κρίση): πριν από την έναρξη πάντα ολόκληρη η
προκαταβολή· μετά την έναρξη η πολιτική (0/50/100)· **μέσα στις 14 ημέρες** από την έγκριση (`isWithinWithdrawalPeriod`,
ελληνικές ημέρες, η 14η περιλαμβάνεται) η παρακράτηση **το πολύ** η αξία της αυτοψίας (3ι §3), και **μηδέν** χωρίς ρητό
αίτημα έναρξης (`withdrawalWaiverAt === null`, 3ι §4 α ii).

**🔑 Πέρα από τους μεγάλους — πίνακας ακύρωσης σε ποσά** (`cancellationScheduleOf` · `IssuanceAdvanceSchedule`): ο Airbnb
περιγράφει την πολιτική με λόγια· εδώ ο ιδιοκτήτης βλέπει, **πριν** εγκρίνει, «πριν την αυτοψία ⇒ επιστρέφονται Χ · μέσα σε 14
ημέρες ⇒ Υ · μετά ⇒ Ζ», υπολογισμένα από τους **ίδιους** κανόνες με την πραγματική επιστροφή — ποτέ δεύτερος υπολογισμός. Ο
επαγγελματίας βλέπει τον ίδιο πίνακα στη φόρμα του πριν στείλει.

| Πού | Τι |
|---|---|
| `issuance-advance.ts` | `maxPercentOfTotal` · `withdrawalDays` · `inspectionValueMinor` · `maxAdvanceMinorOf` · `CancellationFacts` · `isWithinWithdrawalPeriod` · `refundDueOnCancelOf(facts, atIso)` · `cancellationScheduleOf` |
| `issuance-request.ts` | `advanceTermsSchema.inspectionValueMinor` (κανένα αποθηκευμένο έγγραφο δεν είχε προκαταβολή — καμία μετάπτωση) |
| `issuance-audit-fields.ts` · `issuance-assignment-audit.server.ts` · `audit-value-catalogs.ts` · `common-audit` | πεδία ιστορικού `…QuoteTotal` · `…AdvanceAmount` (ευρώ `"40.00"`, μονάδα στο όνομα — το ιστορικό δεν παγώνει μορφή γλώσσας) · `…AdvanceState` (κατάλογος `issuance.advance.state`) · `…WithdrawalWaiver` — κλείνει και το κενό §42.6 |
| `issuance-quote-draft.ts` · `IssuanceAdvanceFields.tsx` · `IssuanceAdvanceSchedule.tsx` · `issuance-advance-labels.ts` | πεδία προκαταβολής στη φόρμα (σύνδεσμος **και** γραφείο — ένα σύνολο πεδίων)· πολιτική **χωρίς** προεπιλογή |
| `issuance-link-view.ts` · `DocumentRequestQuote.tsx` · `DocumentRequestCard.tsx` | ο υπεύθυνος βλέπει προκαταβολή + πίνακα ακύρωσης πριν εγκρίνει |
| `.i18n-shell-slice.json` | νέα σφράγιση `/document-request` 12065 → 15282 με `why` (στατικά: μέρος του «τι εγκρίνω») |

**Επαλήθευση**: jest `issuance-advance.test.ts` + `issuance-assignment-audit.test.ts` — 25 tests (όριο 50% · αξία αυτοψίας ·
προθεσμία σε ώρα Ελλάδας · πλαφόν 3ι §3 · μηδέν χωρίς ρητό αίτημα · πίνακας = ίδιοι κανόνες · ιστορικό χρημάτων).

**Επόμενο — Φ4β** (πληρωμή → κράτηση): γραφέας `system` στο `IssuanceWriter` · είδος `issuance-advance` στο
`payable-subject.ts` + handler στο μητρώο · `split=1` στη συνεδρία · checkout από τη σελίδα έγκρισης με checkbox Κ-6 και
προϋπόθεση δικαιούχο `authorized` · `ensureTransfer({hold: true})` μετά την είσπραξη με lease · route + UI KYC στο
`(me)/profile` · ειδοποιήσεις.

### 5.9 Φ4β — τι υλοποιήθηκε (2026-11-17): πληρωμή → κράτηση

Έρευνα (2026-11-17, [API reference](https://docs.everypay.gr/api-reference/) · [Basic concepts](https://docs.everypay.gr/marketplace-link/basic-concepts/)):
`split` (0/1) υπάρχει στο `POST /notifications` («Marketplace-only parameter») **και** στο `POST /payments` (άρα και στη χρέωση
πηγής IRIS)· το `POST /iris/sessions` **δεν** έχει `split`. Ο πωλητής «can receive transfers — `true` only if the status is
`Authorized`». Τα αμεταβίβαστα «should be transferred promptly».

**Αποφάσεις (με έρευνα — οδηγία Giorgio «όπως οι μεγάλοι»):**

| # | Απόφαση | Γιατί |
|---|---|---|
| Ε-1 | **Πρώτα τρόπος απόδοσης, μετά χρήματα**: η πληρωμή ξεκινά **μόνο** αν ο μηχανικός είναι ενεργός στον χώρο της ανάθεσης και ο δικαιούχος του `authorized` **στο API** (`readyPayeeOf`)· αλλιώς ο ιδιοκτήτης ακούει «περιμένουμε τον μηχανικό» και ο μηχανικός ειδοποιείται (μία φορά/ημέρα) | Airbnb/Upwork ζητούν payout method πριν από την απόδοση· εδώ η μεταφορά γίνεται **στην πληρωμή** (Δ-2) και ο πάροχος δέχεται μεταφορές μόνο σε `Authorized` — άρα είσπραξη χωρίς δικαιούχο θα άφηνε χρήματα αμεταβίβαστα, αντίθετα με το «promptly» |
| Ε-2 | **Πληρώνει ο σύνδεσμος που ενέκρινε** (`readRedeemedInvitationByToken`: ίδια υπογραφή + nonce, κατάσταση `accepted`), όσο η απόφαση της ανάθεσης δείχνει **αυτό** το `invitationId` | καμία νέα πρόσκληση/διαπιστευτήριο· η πληρωμή είναι **ακολουθία** της έγκρισης (Airbnb: πληρωμή μέσα στη ροή κράτησης) |
| Ε-3 | **Κράτηση και lease στη ΣΥΝΕΔΡΙΑ** (`PaymentCheckoutRecord.marketplace`), όχι στην ανάθεση ούτε σε νέα συλλογή | η μεταφορά είναι «αυτής της πληρωμής»· το έγγραφο το βρίσκουν ήδη webhook/συμφιλίωση/επιστροφή· καμία νέα συλλογή, κανόνας ή δείκτης (μία ισότητα `marketplace.transferDue`) |
| Ε-4 | **Οφειλή πριν από την πράξη**: `transferDue: true` γράφεται μαζί με τη μίσθωση· το cron (`sweepHeldTransfers`) ξαναπιάνει κάθε οφειλή | καμία πληρωμή αμεταβίβαστη σιωπηλά, ακόμη κι αν ο διακομιστής καταρρεύσει ανάμεσα σε είσπραξη και μεταφορά |
| Ε-5 | **Κ-6 = ένα κουτί, δύο δηλώσεις** + σώμα με δύο `z.literal(true)` · η στιγμή = `withdrawalWaiverAt` της συνεδρίας ⇒ γεγονός `funded` | 3ι §4 α ii (ρητό αίτημα) **και** 3ιβ (α) (αναγνώριση) — ο διακομιστής αρνείται σώμα χωρίς τα δύο |

| Πού | Τι |
|---|---|
| `payable-subject.ts` | είδος **`issuance-advance`** `{companyId, assignmentId, withdrawalWaiverAt}` · επιστροφή `^/document-request$` · εμβέλεια = ίδια ανάθεση ίδιου μισθωτή |
| `payment-checkout-store.ts` | `CheckoutMarketplace {payeeReference, transferReference, transferDue, lease}` · **προκαταβολή χωρίς αναγνώσιμη κράτηση ⇒ ανύπαρκτη συνεδρία** (ποτέ χρήματα τρίτου ως πληρωμή εμπόρου) · ρητό ερώτημα `companyId ==` + `assignmentId ==` · `listCheckoutsAwaitingTransfer` |
| `payment-provider.ts` · `everypay-adapter.ts` | `split` στο `CheckoutRequest` / `CheckoutSubject` · κάρτα `split=1` · IRIS `split=1` στη χρέωση πηγής· τιμολόγιο: **καμία** παράμετρος (σώμα αμετάβλητο) |
| `payment-checkout-launch.ts` (**νέο**) | η εκκίνηση στον πάροχο — **μεταφέρθηκε** από το checkout τιμολογίου (δεύτερος καλών, κανένα δίδυμο) |
| `payment-held-transfer.ts` (**νέο**) | `ensureHeldTransfer` (μίσθωση + δηλωτική `ensureTransfer({hold: true, commissionMinor: 0})`) · `sweepHeldTransfers` (cron) · ταυτότητα κατόχου `ptls` |
| `issuance-assignments.server.ts` · `…-audit.server.ts` | γραφέας **`system`** (καμία CAS — τη δέσμευση την κρίνει ο μειωτής) · δράστης στο ιστορικό `provider:everypay` |
| `issuance-advance-payment.server.ts` (**νέο**) | ο handler του είδους: πληρωμή ⇒ `advance-funded` · επιστροφή ⇒ `advance-refunded` · μετά την είσπραξη ⇒ κρατημένη μεταφορά (και στο `duplicate`) · άρνηση μειωτή ⇒ **`subject-refused`** (νέα έκβαση, θέλει άνθρωπο) · `readHostedIssuanceContext` |
| `issuance-advance-checkout.ts` (**νέο**) · `api/issuance-link/advance-checkout` | όψη · έναρξη (ιδεμποτία στο σύνορο, CHECK 3.92) · έκβαση απόπειρας· §29 κωδικός και εδώ |
| `issuance-invitation-answer.ts` · `api/issuance-link/unlock` | απαντημένος σύνδεσμος με προκαταβολή ⇒ η όψη `advance` (αλλιώς η αρχική άρνηση `already-used`) |
| `invitation-redeem.ts` · `invitation-guards.ts` | `readRedeemedInvitationByToken` · `refusalOfRedeemedInvitation` |
| `DocumentRequestAdvance.tsx` · `useAdvancePayment.ts` | το βήμα «Πληρωμή προκαταβολής» (πίνακας ακύρωσης ξανά · κουτί Κ-6 · κάρτα/IRIS · αναμονή επιβεβαίωσης) |
| `components/shared/payments/*` (**νέα**) | `usePaymentAttemptWatch` · `checkout-launch` · `returned-attempt` — **μεταφέρθηκαν** από τη σελίδα του τιμολογίου (ο ΕΝΑΣ βρόχος, η ΜΙΑ οδήγηση) |
| `issuance-answer-receipt.ts` · email | η απόδειξη έγκρισης με προκαταβολή φέρει **κουμπί πληρωμής** (ο ίδιος σύνδεσμος) |
| `api/account/payouts` · `ReceivePaymentsCard` · `payout-account.ts` | **«Λήψη πληρωμών»** στο `(me)/profile` (όριο `next/dynamic` — η κάρτα φορτώνει ασύγχρονα): εγγραφή στον πάροχο · hosted KYC · email από το token, όχι από τη φόρμα · IBAN/ΑΦΜ **δεν** αποθηκεύονται |
| `issuance-advance-notifier.ts` · `notification-events.ts` | `…_ADVANCE_FUNDED` (μηχανικός + γραφείο) · `…_ADVANCE_PAYEE_REQUIRED` (μηχανικός, προφίλ) · προτίμηση `documentIssuancePayments` |
| `payment-reconcile.job.ts` | τρίτο πέρασμα: οφειλόμενες μεταφορές |

**Επαλήθευση**: jest **δεν** τρέχτηκε σε αυτή τη συνεδρία (ο κανόνας N.(-2) ζητά ρητή έγκριση). Γράφτηκαν: `payment-held-transfer.test.ts`
(νέα — μία μεταφορά κρατημένη · προμήθεια 0 · μίσθωση · μίσθωση που έληξε · οφειλή μετά από βλάβη · cron)· `payable-subject.test.ts`
(+ είδος προκαταβολής · κράτηση υποχρεωτική · ρητό ερώτημα · μητρώο)· `everypay-adapter.test.ts` (+ `split`).

### 5.10 Φ5 — αποφάσεις (2026-11-17) και Φ5α: αυτοψία → αυτόματη αποδέσμευση

Οδηγία Giorgio (2026-11-17): «όπως οι μεγάλοι, χωρίς εκπτώσεις — κι αν μπορείς, εξυπνότερα». Έρευνα και αποφάσεις για
ολόκληρη τη Φ5 (υλοποίηση σε υποφάσεις, η καθεμία με δικό της commit):

| # | Απόφαση | Πηγή / γιατί |
|---|---|---|
| Ζ-1 | Η **σελίδα προκαταβολής** του ιδιοκτήτη ζει όσο ζουν τα χρήματα (ολοκλήρωση + 30 ημ., πλαφόν 120 ημ.), όχι 7 ημέρες· **νέος σύνδεσμος σε κάθε email** | [Stripe hosted invoice](https://support.stripe.com/questions/invoice-link-expiration): λήξη 30 ημ. μετά την προθεσμία, ≤120 ημ.· «resend» δίνει πάντα έγκυρο σύνδεσμο ([docs](https://docs.stripe.com/invoicing/hosted)) |
| Ζ-2 | **Πληρωτής** = ο ιδιοκτήτης της απόφασης, από οποιονδήποτε ζωντανό σύνδεσμο προκαταβολής της ανάθεσης (κλείνει §8 #11) | ίδιο πρότυπο Stripe |
| Ζ-3 | **Αντίρρηση** από τον ιδιοκτήτη στη σελίδα του (και από το γραφείο για λογαριασμό του) | Κ-4 · η αντίρρηση ανήκει σε όποιον πλήρωσε |
| Ζ-4 | **Ακύρωση = αυτόματος διακανονισμός κατά την πολιτική** (`refundDueOnCancelOf`), χωρίς ελεύθερο ποσό· το γραφείο βλέπει τα ποσά πριν επιβεβαιώσει | [Airbnb](https://www.airbnb.com/help/article/3066/refunds-for-cancellations): η πολιτική ορίζει την επιστροφή |
| Ζ-5 | **Διαφορά ⇒ απόφαση γραφείου** (όλα στον μηχανικό · όλα πίσω · διαίρεση), με αιτιολογία — η μόνη απόκλιση από την πολιτική | [Upwork dispute](https://www.upwork.com/resources/upwork-dispute-process) · [Airbnb Resolution Center](https://www.airbnb.com/help/article/1370) |
| Ζ-6 | **Ένας εκτελεστής χρημάτων**: κάθε κίνηση γράφεται πρώτα ως **εντολή** στη συνεδρία (`marketplace.settlement`) και εκτελείται δηλωτικά με την ΙΔΙΑ μίσθωση — αμέσως **και** από το cron. Σειρά: αντιλογισμός → επιστροφή → αποδέσμευση | [Stripe Connect](https://docs.stripe.com/connect/marketplace/tasks/refunds-disputes): η επιστροφή **δεν** αντιλογίζει τη μεταφορά· EveryPay: refund μόνο σε ανεκκαθάριστη split (§8 #4) |
| Ζ-7 | **Αυτόματη αποδέσμευση** = εντολή με `dueAt` = τέλος παραθύρου, γραμμένη στην αυτοψία· όταν έρθει η ώρα **ο τομέας ξαναρωτιέται** — αντίρρηση στο μεταξύ ⇒ η εντολή σβήνει χωρίς κίνηση | belt + suspenders· κανένα ερώτημα πάνω σε όλες τις αναθέσεις |
| Ζ-8 | **Άρνηση είσπραξης** (`subject-refused`, §8 #12) ⇒ εντολή πλήρους επιστροφής | κανένα χρήμα χωρίς λόγο |

**Υποφάσεις**: **Φ5α** (εδώ) αυτοψία + εκτελεστής + αυτόματη αποδέσμευση · **Φ5β** σελίδα προκαταβολής του ιδιοκτήτη
(Ζ-1/Ζ-2/Ζ-3: σύνδεσμος, αντίρρηση, αίτημα πληρωμής από το γραφείο) · **Φ5γ** ακύρωση με χρήματα, διαφορά, άρνηση
είσπραξης (Ζ-4/Ζ-5/Ζ-8) · **Φ5δ** ΜΑΡΚ προκαταβολής + πίνακας γραφείου. Κάθε λόγος διακανονισμού (`SETTLEMENT_BASES`)
μπαίνει **μαζί** με τον παραγωγό του (απόφαση Α1): στη Φ5α μόνο `window-elapsed`.

**Φ5α — τι υλοποιήθηκε:**

| Πού | Τι |
|---|---|
| `issuance-advance.ts` | `AdvanceGlance` · **`advanceGlanceOf`** — η μία «ματιά» (όροι · κατάσταση · πότε αποδεσμεύεται · εισπραχθέν) για κάθε οθόνη |
| `server/payments/payment-checkout-lease.ts` (**νέο**) | **η ΜΙΑ μίσθωση χρημάτων** της συνεδρίας (`claimCheckoutLease` · `releaseCheckoutLease`) — εξήχθη από την κρατημένη μεταφορά, δεύτερος καταναλωτής ο διακανονισμός: μεταφορά και διακανονισμός δεν τρέχουν ποτέ μαζί |
| `payment-checkout-store.ts` | `CheckoutMarketplace.settlement` (`CheckoutSettlementOrder`: δηλωτικά ποσά · λόγος · `dueAt`)· μη αναγνώσιμη εντολή ⇒ ανύπαρκτη συνεδρία · `listCheckoutsWithDueSettlement` (μία ανισότητα, αυτόματος δείκτης) · `findFundedAdvanceCheckout` (ίδιο ερώτημα εμβέλειας με την έναρξη) |
| `server/payments/payment-settlement.ts` (**νέο**) | **ο ΕΝΑΣ εκτελεστής**: `scheduleSettlement` (τα ποσά καλύπτουν ακριβώς τη συνεδρία) · `executeSettlement` (κρίση τομέα → αντιλογισμός → επιστροφή → αποδέσμευση → καταγραφή → η εντολή σβήνει· βλάβη ⇒ η εντολή μένει) · `sweepDueSettlements` |
| `payable-subject-registry.ts` | `judgePayableSettlement` (`proceed` · `void` · `hold`) · `recordPayableSettlement` — εξαντλητικά ανά είδος (τιμολόγιο: ποτέ κρατημένα χρήματα) |
| `issuance-advance-settlement.server.ts` (**νέο**) | η κρίση της αυτόματης αποδέσμευσης πάνω στην **τρέχουσα** κατάσταση (`isAdvanceReleaseDue` + ποσό = εισπραχθέν) · καταγραφή `advance-released` από τον ΕΝΑ γραφέα `system` + ειδοποίηση |
| `issuance-engagement-action.server.ts` (**νέο**) | **ο ΕΝΑΣ δρόμος πράξης μηχανικού** (δική του ενεργή συμμετοχή, κρίση της μέσα στη συναλλαγή, ίδιος γραφέας/μειωτής) — εξήχθη από το «Αίτημα νέας ημερομηνίας» (ADR-915 §45.20), δεύτερος καταναλωτής η αυτοψία |
| `issuance-advance-start.service.ts` (**νέο**) · `api/engagements/[engagementId]/issuance/start-work` | **«Έγινε η αυτοψία»**: `work-started` ⇒ εντολή αυτόματης αποδέσμευσης στο `objectionUntil`· ξαναπάτημα ⇒ ο μειωτής λέει `unchanged` και ο προγραμματισμός ξανατρέχει (ιδεμποτικός) — καμία αποδέσμευση δεν ξεχνιέται · `_shared/issuance-action-response.ts` (ένας πίνακας αρνήσεων για κάθε πράξη μηχανικού) |
| `EngagedAdvance.tsx` · `EngagedIssuanceContent` · `IssuanceAgreementView.advance` | ο μηχανικός βλέπει ποσό, πολιτική, «αποδεσμεύεται στις …», και το κουμπί με επιβεβαίωση των συνεπειών (48ω αντίρρησης, μετά αυτόματη αποδέσμευση) |
| `issuance-advance-notifier.ts` · `notification-events.ts` | `announceAdvanceMilestone` — ένας δρόμος για κάθε ορόσημο (`funded` · `work-started` · `released`)· το «κατατέθηκε» της Φ4β τον χρησιμοποιεί αμετάβλητο (ίδιο `eventId`) · νέα `…_ADVANCE_WORK_STARTED` · `…_ADVANCE_RELEASED` |
| `payment-reconcile.job.ts` | **τέταρτο πέρασμα**: εντολές διακανονισμού που οφείλονται (μετά τις μεταφορές) |

**Επαλήθευση** (jest με έγκριση): νέα `payment-settlement.test.ts` (εντολή · σειρά αντιλογισμός→επιστροφή→αποδέσμευση · `void`
χωρίς κίνηση · `hold` κρατά την εντολή · βλάβη κρατά την εντολή · μεταφορά ήδη πληρωμένη ⇒ άνθρωπος · μίσθωση · cron)·
`issuance-advance.test.ts` (+ ματιά)· κοινή ψεύτικη βάση `checkout-fake-firestore.fixture.ts` (η σουίτα της μεταφοράς
μεταφέρθηκε σε αυτήν). Πληρωμές/ανάθεση: **12 σουίτες / 142 tests** + λογιστική πληρωμών **9 / 77** + χώρος ανάθεσης **2 / 16** — πράσινα.

### 5.11 Φ5β1 — τι υλοποιήθηκε (2026-11-17): η σελίδα προκαταβολής του ιδιοκτήτη (Ζ-1 · Ζ-2 · Ζ-3)

Έρευνα (2026-11-17): [Stripe hosted invoice](https://docs.stripe.com/invoicing/hosted) — μοναδικός σύνδεσμος ανά
τιμολόγιο, κάθε email φέρει έγκυρο σύνδεσμο, λήξη [30 ημ. μετά, ≤120 ημ.](https://support.stripe.com/questions/invoice-link-expiration)·
[DocuSign recipient authentication](https://www.docusign.com/blog/dsdev-implementing-docusign-recipient-authentication) —
ο access code ανήκει στον **παραλήπτη του φακέλου**, λέγεται από τον αποστολέα σε άλλο κανάλι, και (ρύθμιση «κάθε φορά»)
ζητείται σε κάθε πρόσβαση· αναφορές χρηστών: προωθημένος σύνδεσμος μένει ανοιχτός μετά την πρώτη πρόσβαση.

| # | Απόφαση | Γιατί |
|---|---|---|
| Η-1 | **Σκοπός συνδέσμου** `purpose` (`answer` · `advance{decidedAt, codeHolderId}`) στο ίδιο είδος πρόσκλησης, default `answer` ⇒ καμία μετάπτωση | ένα μυστικό, μία πόρτα, ένα σχήμα· ο σύνδεσμος `advance` **δεν** απαντά ποτέ (`answer-mismatch`) |
| Η-2 | **Κάθε email = νέος σύνδεσμος** (υπογραφή 120 ημ.)· η σελίδα σβήνει 30 ημ. μετά το τέλος των χρημάτων (`isAdvancePageLive`) | Stripe hosted invoice (Ζ-1) |
| Η-3 | **Φραγμένοι ζωντανοί σύνδεσμοι**: ως `liveLinksCap = 3` ανά απόφαση — ο νέος ανακαλεί τους παλαιότερους | πέρα από Stripe: κανένα σφάλμα δεν γεννά απεριόριστους ζωντανούς συνδέσμους· νέα αίτηση έγκρισης τους ακυρώνει όλους (ίδιο `liveIssuanceInvitationsQuery`) |
| Η-4 | **Δέσιμο στην απόφαση**: πληρωτής = ο `ownerContactId` της ισχύουσας εγκεκριμένης απόφασης, από τον σύνδεσμο που ενέκρινε **ή** από σύνδεσμο `advance` με `decidedAt === decision.at` (Ζ-2, κλείνει το μισό του §8 #11) | νέα απόφαση ⇒ `superseded` από κατασκευή· η έγκριση `recorded-instruction` αποκτά πληρωτή |
| Η-5 | **Κωδικός §29 του φακέλου**: ο σύνδεσμος `advance` ζητά τον κωδικό του **κατόχου** (`codeHolderId`): νεότερος σύνδεσμος της απόφασης με δικό του κωδικό (το γραφείο τον ζήτησε αργότερα) · αλλιώς η πρόσκληση που ενέκρινε · αλλιώς κανείς | DocuSign: ο ίδιος κωδικός που ήδη ξέρει ο ιδιοκτήτης — ένα αυτόματο email (αυτοψία) δεν μπορεί να συνοδεύεται από νέο τηλεφωνικό κωδικό. **Πέρα από DocuSign**: 5 λάθη κλειδώνουν **όλους** τους συνδέσμους του φακέλου (ο μετρητής ζει στον κάτοχο) και κάθε πράξη φέρνει ξανά τον κωδικό (καμία «ξεκλείδωτη συνεδρία») |
| Η-6 | **Αντίρρηση από σύνδεσμο** (Ζ-3): ο μειωτής δέχεται `object-start` από `link` ⇒ `{by:'owner-link'}`· τη νομιμότητα του δράστη την αποδεικνύει ο διακομιστής (`resolveAdvancePayer`), όπως τη συμμετοχή του `engagement` | ο τύπος `StartObjectionBy` την προέβλεπε ήδη· ο εκτελεστής σβήνει την εντολή αποδέσμευσης μόνος του (Ζ-7) — καμία αλλαγή στις πληρωμές |

| Πού | Τι |
|---|---|
| `issuance-advance.ts` | `ADVANCE_POLICY.linkLifetimeDays/linkAfterSettledDays/liveLinksCap` · `advanceSettledAtOf` · `isAdvancePageLive` · **`advanceTimelineOf`** (το χρονολόγιο χρημάτων, χωρίς αιτιολογίες — SSoT και για τον πίνακα γραφείου της Φ5δ) |
| `issuance-advance-reducer.ts` | `object-start` από `office` **ή** `link` (`objectionByOf`) |
| `issuance-invitation-kind.ts` · `types/issuance-invitation.ts` | `purpose` + `isAdvanceLink` · λήξη υπογραφής ανά σκοπό · σύνδεσμος με δικό του κωδικό γίνεται κάτοχος |
| `invitation-redeem.ts` | `readLiveOrRedeemedInvitationByToken` — **αντικατέστησε** το `readRedeemedInvitationByToken` (μία ανάγνωση, δύο κρίσεις)· κανένα δίδυμο |
| `issuance-advance-payer.ts` (**νέο**) | ο ΕΝΑΣ δρόμος «token ⇒ πληρωτής» (`resolveAdvancePayer` · `readPayerLink` · `accessHolderOf` · `checkPayerAccess`) — εξήχθη από το checkout, καταναλωτές όψη/πληρωμή/έκβαση/αντίρρηση |
| `issuance-advance-checkout.ts` | η όψη += `releaseAt` · `canObject` (`canObjectToStart` τη στιγμή της ανάγνωσης) · `timeline` · πύλη/κωδικός από τον κάτοχο |
| `issuance-invitation-answer.ts` | σύνδεσμος `advance` ⇒ **πάντα** η σελίδα προκαταβολής (όψη · ξεκλείδωμα), με την πραγματική άρνηση της σελίδας (`expired` · `superseded`)· η απάντηση αρνείται `answer-mismatch` |
| `issuance-advance-objection.ts` (**νέο**) · `api/issuance-link/advance-objection` | πληρωτής → κωδικός φακέλου → ο ΕΝΑΣ γραφέας με δράστη `link` → ιστορικό → ορόσημο· ιδεμποτία στην πόρτα (CHECK 3.92)· η απάντηση φέρει την όψη του διακομιστή |
| `issuance-advance-link.ts` (**νέο**) | **ο ΕΝΑΣ εκδότης** συνδέσμου προκαταβολής (συναλλαγή: όριο ζωντανών + νέος σύνδεσμος → email `advance-link`)· παραλήπτης από `readIssuancePeople` (εξήχθη από το πρόχειρο αποστολής) |
| `issuance-advance-start.service.ts` | «Έγινε η αυτοψία» ⇒ email στον ιδιοκτήτη με νέο σύνδεσμο (πότε φεύγουν τα χρήματα · «αν όλα πήγαν καλά, τίποτα») |
| `issuance-invitation-email.ts` · `issuance-advance-link-email-texts.ts` (**νέο**) | είδος `advance-link` (αυτοψία · αίτημα πληρωμής), el/en |
| `issuance-advance-notifier.ts` · `notification-events.ts` | ορόσημο `start-objected` ⇒ `…_ADVANCE_OBJECTED` (ΠΡΟΕΙΔΟΠΟΙΗΣΗ): γραφείο **με** αιτιολογία, μηχανικός **χωρίς** (`engineerBody`, Ε-9′) |
| `DocumentRequestAdvance.tsx` · `DocumentRequestAdvanceObjection.tsx` · `DocumentRequestAdvanceTimeline.tsx` (**νέα**) | «αποδίδεται αυτόματα στις … (σε Χ ώρες)» με ανανέωση ανά λεπτό · «Κάτι δεν πήγε καλά» → αιτιολογία → υποβολή · χρονολόγιο· η σελίδα υιοθετεί την όψη που επιστρέφει ο διακομιστής |

**Απόκλιση από το σχέδιο**: το `canObject` ζει στην όψη, **όχι** στο `AdvanceGlance` — η ματιά δεν παίρνει «τώρα» και οι
υπάρχοντες καταναλωτές της (μηχανικός) έμειναν αμετάβλητοι.

**Επαλήθευση**: jest με έγκριση — πληρωμές/ανάθεση/σελίδα **16 σουίτες / 186 πράσινα** (Φ5β1). Γράφτηκε: `issuance-advance.test.ts` (+ αντίρρηση με
σύνδεσμο · ο σύνδεσμος δεν γράφει τίποτα άλλο · χρονολόγιο χωρίς αιτιολογίες · ζωή σελίδας +30 ημ.).

**Φ5β2 — «Αίτημα πληρωμής / Νέος σύνδεσμος» από το γραφείο (κλείνει §8 #11):**

| # | Απόφαση | Γιατί |
|---|---|---|
| Η-7 | Το γραφείο στέλνει νέο σύνδεσμο **μόνο** όταν ο ιδιοκτήτης έχει κάτι να κάνει: `awaiting-payment` ⇒ «Αίτημα πληρωμής» · `release-pending` ⇒ «Νέος σύνδεσμος» (email αυτοψίας)· αλλιώς `nothing-to-do` | Stripe «Send invoice»· πέρα από αυτό: κανένα email χωρίς ενέργεια για τον παραλήπτη — ο ίδιος κανόνας στον διακομιστή (`momentOf`) και στην κάρτα (`actionKeyOf`) |
| Η-8 | Προαιρετικός **νέος κωδικός** §29 (διακόπτης «Ζήτα κωδικό»), ωμός **μία** φορά στο γραφείο· γίνεται ο κωδικός του φακέλου και για τα επόμενα αυτόματα email (Η-5) | έγκριση `recorded-instruction` δεν έχει κωδικό ιδιοκτήτη· το γραφείο αποφασίζει, όπως στην αρχική αποστολή |

| Πού | Τι |
|---|---|
| `issuance-advance-payment-request.ts` (**νέο**) | ανάθεση ανοιχτή + αναληφθείσα → στιγμή από τα χρήματα → ο ΕΝΑΣ εκδότης (`issueAdvanceLink`) |
| `api/document-registry/issuance-assignments/advance-link` (**νέο**) · `advance-link-refusals.ts` | `withAuth` (`properties:properties:update`) + ιδεμποτία · κάθε άρνηση → HTTP/κωδικό-κλειδί |
| `document-registry.client.ts` | `sendIssuanceAdvanceLink` |
| `RegistryIssuanceAdvanceLine.tsx` (**νέο**) · `RegistryIssuanceStep.tsx` · `issuance-labels.ts` | γραμμή «Προκαταβολή: <κατάσταση>» στην κάρτα (`advanceGlanceOf`) + κουμπί → διάλογος με `AccessCodeToggle` → `IssuedAccessCode` (επαναχρήση §29) |

**Σουίτα διακομιστή** `issuance-advance-owner-page.test.ts` (fake Firestore, μόνο email/orchestrator mocks — 14 tests): σύνδεσμος
`advance` δεμένος στην απόφαση και ποτέ φόρμα απάντησης · υπογραφή 120 ημ. · έγκριση `recorded-instruction` πληρώνει · νέα
απόφαση ⇒ `superseded` · όριο 3 ζωντανών · ζωή σελίδας +30 ημ. · κωδικός φακέλου (λάθη στον κάτοχο, νέος κωδικός γραφείου
κληρονομείται) · αντίρρηση (`owner-link`, αιτιολογία μόνο στο γραφείο, `not-objectable` δεύτερη/εκτός παραθύρου, κωδικός
απαιτείται) · αίτημα γραφείου (`nothing-to-do` · `no-email` · ώρα αποδέσμευσης στο email). **Μετάλλαξη 2/2 πιάστηκε**
(δέσιμο `decidedAt` · κάτοχος κωδικού).

### 5.12 Φ5γ — τι υλοποιήθηκε (2026-11-17): ακύρωση με χρήματα · διαφορά · άρνηση είσπραξης (Ζ-4 · Ζ-5 · Ζ-8)

**Ευρήματα audit** (κώδικας πριν από τη Φ5γ): (α) η `cancel` έγραφε μόνο `cancellation` — κρατημένα χρήματα έμεναν
κρατημένα για πάντα· (β) `advanceCollectedMinor` σε `release-pending`/`disputed` αγνοούσε τις επιστροφές· (γ) ο εκτελεστής
χωρίς μεταφορά απαντούσε για πάντα `awaiting-transfer` (η αρνημένη πληρωμή δεν αποκτά ποτέ μεταφορά)· (δ) ο συγχρονισμός
ξαναπαίζει την αρνημένη πληρωμή σε κάθε πέρασμα — χωρίς φρένο θα ξαναγεννούσε επιστροφή· (ε) η `refundDueOnCancelOf`
έκρινε πάνω στο **καθαρό** εισπραχθέν, ενώ η εντολή του παρόχου είναι δηλωτική σε **σύνολα**· (στ) μετά από ακύρωση, νέα
πρόταση γράφει πάνω στο ίδιο έγγραφο ανάθεσης — θα έσβηνε το ίχνος ζωντανών χρημάτων.

| # | Απόφαση | Πηγή / γιατί |
|---|---|---|
| Θ-1 | **Μία κρίση «ποια κίνηση οφείλεται τώρα;»** — `advanceSettlementDueOf` (νέο φύλλο `issuance-advance-settlement.ts`): σύνολα πάνω στο εισπραχθέν, με προτεραιότητα απόφαση γραφείου > διαφορά χωρίς απόφαση (τίποτα) > ακύρωση (πολιτική **τη στιγμή της ακύρωσης**) > αυτόματη αποδέσμευση. Τη ρωτούν **και** ο παραγωγός της εντολής **και** η κρίση πριν από τα χρήματα | αντικαθιστά το `judgeAutoRelease` και τη χειροποίητη εντολή της αυτοψίας — ένα σημείο, κανένα δίδυμο |
| Θ-2 | **Η εντολή συγκλίνει στον τομέα**: νέα κρίση `{ reschedule }` — εντολή που δεν μοιάζει με ό,τι λέει ο τομέας ξαναγράφεται υπό την ίδια μίσθωση (π.χ. αυτόματη αποδέσμευση που πρόλαβε ακύρωση) και εκτελείται στο ίδιο κάλεσμα αν οφείλεται ήδη (μία φορά) | επέκταση του Ζ-7: η εντολή είναι πρόθεση, ο τομέας η αλήθεια — καμία εντολή δεν «ξεχνιέται» |
| Θ-3 | **Πρώτα η εντολή, μετά το γεγονός** στην ακύρωση/απόφαση: ο ΙΔΙΟΣ μειωτής (καθαρός) υπολογίζει την εγγραφή όπως θα είναι, ο ΕΝΑΣ παραγωγός (`ensureAdvanceSettlement`) γράφει την εντολή, μετά γράφεται το γεγονός και η εντολή εκτελείται αμέσως. `busy` ⇒ άρνηση `settlement-busy`, **τίποτα** δεν γράφτηκε | βλάβη ανάμεσα ⇒ ο εκτελεστής ρωτά τον τομέα (`void`/`reschedule`)· καμία κίνηση χωρίς γεγονός, καμία κίνηση που ξεχάστηκε |
| Θ-4 | **Ακύρωση σε διαφορά ⇒ τα χρήματα παγώνουν** ως την απόφαση του γραφείου (ο διάλογος ακύρωσης το λέει) | [Upwork](https://www.upwork.com/resources/upwork-dispute-process): τα χρήματα κρατούνται όσο κρατά η διαφορά ([Respond to an Escrow Dispute](https://support.upwork.com/hc/en-us/articles/211062068-Respond-to-an-Escrow-Dispute))· η αντίρρηση αμφισβητεί ακριβώς την έναρξη πάνω στην οποία η πολιτική κρατά ποσό |
| Θ-5 | **Απόφαση διαφοράς** `resolve-advance-dispute` (γραφείο · πόσα **συνολικά** στον μηχανικό: όλα · τίποτα · διαίρεση · αιτιολογία υποχρεωτική) ⇒ γεγονός `dispute-resolved`, **οριστικό** (ίδια ⇒ `unchanged`, άλλη ⇒ άρνηση), υπερισχύει της πολιτικής, επιτρέπεται και σε ακυρωμένη ανάθεση. Γραφείο με αιτιολογία· μηχανικός και ιδιοκτήτης μόνο ποσά (Ε-9′) | [Upwork dispute](https://www.upwork.com/resources/upwork-dispute-process) · [Airbnb Resolution Center](https://www.airbnb.com/help/article/1370): ο τρίτος αποφασίζει με ποσά |
| Θ-6 | **Άρνηση είσπραξης (Ζ-8)**: εντολή `refused-payment` (όλο πίσω, στη στιγμή της πληρωμής ⇒ ίδια εντολή σε κάθε συγχρονισμό). Ο εκτελεστής επιστρέφει **χωρίς μεταφορά** μόνο όταν καμία μεταφορά δεν υπάρχει **ούτε οφείλεται** (`transferDue`)· η κρίση προχωρά μόνο για πληρωμή που η ανάθεση δεν δέχτηκε ποτέ | κανένα χρήμα χωρίς λόγο· EveryPay: refund σε ανεκκαθάριστη split πληρωμή (§8 #4) |
| Θ-7 | **Κανένας βρόχος**: ο συγχρονισμός δίνει στον handler πόσα έχει ήδη επιστρέψει ο πάροχος (`refundedTotalMinor`, ίδια ανάγνωση)· αρνημένη πληρωμή ήδη επιστραμμένη ⇒ `duplicate`, επιστροφή αρνημένης πληρωμής ⇒ `duplicate` | γενικό στο μητρώο — το τιμολόγιο το δέχεται χωρίς να το χρειάζεται |
| Θ-8 | **Όσο ζουν χρήματα, νέα πρόταση περιμένει** (`canProposeIssuance` + `hasLiveAdvanceMoney`)· η ακυρωμένη ανάθεση με ζωντανά χρήματα κρατά τη γραμμή «Προκαταβολή» στην κάρτα (μόνο η απόφαση διαφοράς — κανένας νέος σύνδεσμος) | εύρημα (στ): χωρίς αυτό η Φ5γ θα έκανε απώλεια ίχνους χρημάτων προσβάσιμη |

| Πού | Τι |
|---|---|
| `issuance-advance.ts` | `refundedMinor` σε `release-pending`/`disputed` (+ διόρθωση `advanceCollectedMinor`) · γεγονός `dispute-resolved` · `disputed.resolution` · `advanceResolutionOf` · `ADVANCE_RELEASE_BASES += 'cancellation'` · `cancellationRefundTotalOf` (σύνολα)· `refundDueOnCancelOf` = σύνολο − ήδη επιστραμμένα (ο πίνακας έγκρισης αμετάβλητος) · `advanceFundedMinor` · `advanceMovedMinor` · χρονολόγιο += `dispute-resolved` (χωρίς αιτιολογία) · `ADVANCE_POLICY.resolutionReasonMax` |
| `issuance-advance-settlement.ts` (**νέο**, φύλλο) | `advanceSettlementDueOf` (Θ-1) · `cancellationPreviewOf` (ποσά του διαλόγου ακύρωσης, ίδια κρίση) · `hasLiveAdvanceMoney` (Θ-8) |
| `issuance-advance-reducer.ts` | πράξη `resolve-advance-dispute` (Θ-5) · `advance-released` κρίνεται ανά λόγο από τον Θ-1 (λόγος + ποσό ≤ οφειλόμενο) |
| `issuance-assignment.ts` · `issuance-request.ts` · `issuance-assignment-schema.ts` | `canProposeIssuance` (Θ-8) · σώμα + αντιστοίχιση της πράξης · σχήμα του γεγονότος |
| `server/payments/payment-settlement-order.ts` (**νέο**) | `scheduleSettlement` **εξήχθη** από τον εκτελεστή: το καλεί και ο handler του μητρώου (Θ-6) χωρίς κύκλο εισαγωγών |
| `payment-settlement.ts` · `payment-checkout-store.ts` · `payable-subject-registry.ts` | επιστροφή χωρίς μεταφορά (Θ-6) · `reschedule` (Θ-2) · `SETTLEMENT_BASES` += `cancellation` · `office-resolution` · `refused-payment` (μαζί με τους παραγωγούς τους, Α1) · `sameSettlementOrder` (η ΜΙΑ σύγκριση) · `refundedTotalMinor` (Θ-7) |
| `invoice-payment-settlement-sync.ts` | `refundedTotalMinor` από την ίδια ανάγνωση (Θ-7) |
| `issuance-advance-settlement.server.ts` | η κρίση μέσω Θ-1 (+ `refused-payment`) · η καταγραφή με τον λόγο της εντολής · `orderOf` (η ΜΙΑ μετάφραση) |
| `issuance-advance-settlement-order.server.ts` (**νέο**) | **ο ΕΝΑΣ παραγωγός** `ensureAdvanceSettlement` · `settleAdvanceNow` (ποτέ δεν πετά — αλλιώς το cron) |
| `issuance-advance-office-money.server.ts` (**νέο**) | Θ-3 για `cancel` και `resolve-advance-dispute` · ανακοίνωση απόφασης · email ιδιοκτήτη (στιγμή `settlement`) |
| `issuance-assignment.service.ts` · route | η πόρτα του γραφείου περνά από το Θ-3 · άρνηση `settlement-busy` → 409 `SETTLEMENT_BUSY` |
| `issuance-advance-start.service.ts` | η αυτοψία περνά από τον ΕΝΑ παραγωγό |
| `issuance-advance-payment.server.ts` | Ζ-8/Θ-6/Θ-7 · ορόσημο `refunded` όταν καταγράφεται επιστροφή |
| `issuance-advance-notifier.ts` · `notification-events.ts` | `…_ADVANCE_REFUNDED` · `…_ADVANCE_DISPUTE_RESOLVED` (μηχανικός χωρίς αιτιολογία) |
| `issuance-advance-link.ts` · email texts | στιγμή `settlement` («Επιστρέφεται σε εσάς: Χ», από τον Θ-1) |
| `RegistryIssuanceDialogs.tsx` · `RegistryIssuanceAdvanceDispute.tsx` (**νέο**) · `RegistryIssuanceAdvanceLine.tsx` · `RegistryIssuanceStep.tsx` | ποσά στον διάλογο ακύρωσης · απόφαση διαφοράς (αντίρρηση, τρεις επιλογές, διαίρεση με την ΙΔΙΑ ανάγνωση ποσού `amountMinorOf`, σύνοψη, αιτιολογία) · γραμμή προκαταβολής και σε ακυρωμένη ανάθεση με ζωντανά χρήματα |
| `DocumentRequestAdvanceTimeline.tsx` · `.i18n-shell-slice.json` | γραμμή «αποφάσισε το γραφείο» · νέα σφράγιση `/document-request` (19289, με `why`) |

**Επαλήθευση** (jest με έγκριση Giorgio): πληρωμές/ανάθεση/σελίδα/λογιστική πληρωμών **25 σουίτες / 310 πράσινα**. Νέα `issuance-advance-settlement.test.ts` (11: ακύρωση πριν/μέσα/μετά τις 14 ημέρες · η ακύρωση προλαβαίνει την αυτόματη αποδέσμευση · σύνολα σταθερά μετά από μερική επιστροφή · διαφορά παγώνει · απόφαση υπερισχύει και σε ακυρωμένη · οριστική · νέα πρόταση περιμένει) + `payment-settlement.test.ts` (+5: επιστροφή χωρίς μεταφορά · `transferDue` περιμένει · `reschedule` τώρα/αργότερα/άκυρο). Το παλιό test «αποδέσμευση γραφείου χωρίς απόφαση» άλλαξε σκόπιμα (Θ-5). **Μετάλλαξη 2/2 πιάστηκε** (σύνολα πάνω στο καθαρό · έλεγχος `transferDue`). `jscpd:diff` 22 αρχεία: 0 κλώνοι. `tsc` όχι (N.17).

### 5.13 Φ5δ — τι υλοποιήθηκε (2026-11-17): ΜΑΡΚ προκαταβολής · πίνακας «Προκαταβολή» γραφείου · αντίρρηση από το γραφείο (Κ-7 · Ζ-3)

**Audit** (κώδικας πριν από τη Φ5δ): ο μειωτής **ήδη** έκρινε `record-advance-receipt` (μηχανικός · γραφείο · ποσό = εισπραχθέν
· ιδεμποτικό στον ίδιο ΜΑΡΚ) και `object-start` από `office` — έλειπαν οι πόρτες, οι οθόνες, η εμφάνιση. Το γραφείο έβλεπε μόνο
μία λέξη κατάστασης. Το `receiptMatchesQuote` του τελικού ΜΑΡΚ αφαιρεί ήδη το `advanceCollectedMinor` — **επαληθεύτηκε συνεπές**:
ο ΜΑΡΚ προκαταβολής κρίνεται πάνω στην ΙΔΙΑ ποσότητα.

| # | Απόφαση | Πηγή / γιατί |
|---|---|---|
| Ι-1 | **ΜΑΡΚ προκαταβολής = ό,τι εισπράχθηκε τη στιγμή της καταγραφής**, από γραφείο **ή** μηχανικό (αυτός εκδίδει το παραστατικό), με τα ΙΔΙΑ πεδία με το τελικό (`receiptFields` · `IssuanceReceiptFields`) | Κ-7 · ένα σχήμα, μία φόρμα — κανένα δίδυμο |
| Ι-2 | **Ο ΜΑΡΚ μπαίνει στο χρονολόγιο** (`receipted`, στη θέση του χρόνου του) ⇒ φαίνεται αυτόματα και στις τρεις όψεις | πρότυπο Stripe Dashboard (σελίδα πληρωμής με χρονολόγιο γεγονότων)· πέρα από αυτό: το φορολογικό στοιχείο **μέσα** στο ίδιο ιστορικό, όχι σε άλλη οθόνη |
| Ι-3 | **Ο πίνακας γραφείου διαβάζει μόνο υπάρχοντα SSoT**: ματιά · `advanceLedgerOf` (πάνω στα `advanceFundedMinor`/`advanceMovedMinor`) · `advanceSettlementDueOf` (η εκκρεμής κίνηση = σύνολο της κρίσης − ό,τι βεβαίωσε ο πάροχος) · `advanceTimelineOf` | ο πίνακας δεν «συμπεραίνει» — λέει ό,τι θα εκτελέσει ο εκτελεστής χρημάτων |
| Ι-4 | **Αντίρρηση από το γραφείο** = ίδια πράξη (`object-start`, δράστης `office` από τον actor) + **ίδια** ειδοποίηση με του συνδέσμου (γραφείο με αιτιολογία, μηχανικός χωρίς, Ε-9′)· καμία κίνηση χρημάτων — η εντολή αποδέσμευσης σβήνει μόνη της (Ζ-7) | Ζ-3 |
| Ι-5 | **Επιστροφή μετά τον ΜΑΡΚ** ⇒ η ματιά λέει «χρειάζεται πιστωτικό» (`refundedAfterReceipt`)· ο ΜΑΡΚ δεν αλλάζει, η έκδοση πιστωτικού είναι λογιστική πράξη εκτός εφαρμογής (§7) | κανένα σιωπηλό ασυνεπές ποσό στο φορολογικό ίχνος |

| Πού | Τι |
|---|---|
| `issuance-advance.ts` | `AdvanceReceiptFacts` · ματιά += `receipt` · `receiptDue` · `refundedAfterReceipt` · χρονολόγιο += `receipted` · **`advanceLedgerOf`** |
| `issuance-request.ts` | `receiptFields` (κοινά με `record-receipt`) · σώματα γραφείου `record-advance-receipt` · `object-start` · σώμα μηχανικού `issuanceAdvanceReceiptBody` |
| `issuance-assignment.service.ts` · `issuance-advance-office-money.server.ts` | `announceOfficeObjection` μετά το `changed` (η πόρτα του γραφείου ήταν ήδη μία) |
| `api/engagements/[engagementId]/issuance/advance-receipt` (**νέο**) · `conveyance-engagement-gateway.ts` · `domain-constants.ts` | πόρτα μηχανικού μέσω του ΕΝΟΣ δρόμου (`writeEngagementIssuanceAction`) · `RECEIPT_MISMATCH` |
| `issuance-engagement-host-adapter.ts` · `types/my-engagements.ts` | η όψη του μηχανικού += `advanceTimeline` |
| `IssuanceReceiptFields.tsx` (**νέο**, εξήχθη από το `ReceiptForm`) · `RegistryIssuanceQuoteForms.tsx` | ΜΑΡΚ + ημέρα για τελικό και προκαταβολή (`purpose`) |
| `IssuanceAdvanceTimelineList.tsx` (**νέο**, εξήχθη από τη σελίδα ιδιοκτήτη) · `issuance-advance-timeline-labels.ts` (**νέο**) | μία λίστα χρονολογίου, οι λέξεις ανά όψη· οι λέξεις γραφείου/μηχανικού **χωριστά** από το `issuance-advance-labels.ts`, που το εισάγει η σελίδα ιδιοκτήτη (CHECK 3.34: η διαδρομή `/document-request` μεγαλώνει μόνο κατά το ένα κλειδί `receipted`, 19289 → 19397, μέσα στη σφράγιση) |
| `RegistryIssuanceAdvancePanel.tsx` · `RegistryIssuanceAdvanceObjection.tsx` (**νέα**) · `RegistryIssuanceAdvanceLine.tsx` · `RegistryIssuanceDialogs.tsx` | «Λεπτομέρειες» (πίνακας, `next/dynamic`) · «Καταγραφή ΜΑΡΚ προκαταβολής» (όταν οφείλεται) · «Αντίρρηση για λογαριασμό του ιδιοκτήτη» (μόνο μέσα στο παράθυρο) |
| `EngagedAdvance.tsx` · `EngagedAdvanceReceipt.tsx` (**νέο**) | ο μηχανικός: ΜΑΡΚ · καταγραφή ΜΑΡΚ · χρονολόγιο |
| `DocumentRequestAdvanceTimeline.tsx` | γραμμή «ο μηχανικός εξέδωσε παραστατικό» |

**Απόκλιση από το σχέδιο**: η σουίτα διακομιστή των πράξεων γραφείου μπήκε στην υπάρχουσα `issuance-advance-owner-page.test.ts`
(ίδιο setup — μια νέα σουίτα θα ήταν δίδυμο ~60 γραμμών). Η πόρτα του **μηχανικού** δεν έχει σουίτα διακομιστή: καμία
υπάρχουσα σουίτα δεν στήνει ζωντανή συμμετοχή στο fake Firestore (ούτε για την αυτοψία της Φ5α)· η κρίση του δράστη
`engagement` καλύπτεται στον μειωτή.

**Επαλήθευση**: jest **δεν** τρέχτηκε (N.(-2): εκκρεμεί έγκριση Giorgio). Γράφτηκαν: `issuance-advance.test.ts` (+5: ματιά με
ΜΑΡΚ · επιστροφή μετά τον ΜΑΡΚ · σειρά στο χρονολόγιο · ποσά · αντίρρηση `office`) · `issuance-advance-owner-page.test.ts` (+5:
ΜΑΡΚ γραφείου ποσό/ιδεμποτία/άλλος ΜΑΡΚ · πριν από την πληρωμή · τελικός = συμφωνία − εισπραχθέν · αντίρρηση γραφείου με
ειδοποίηση · εκτός παραθύρου/δεύτερη). `tsc` όχι (N.17).

## 6. Πού ξεπερνάμε τους μεγάλους
1. Πολιτική ακύρωσης **μέσα στην ίδια έγκριση** με την τιμή (ο Airbnb τη δείχνει, δεν την «υπογράφει» μαζί με όρους που αναθεωρούνται).
2. Υπαναχώρηση καταναλωτή **ρητή και καταγεγραμμένη** τη στιγμή της πληρωμής.
3. Φορολογικό στοιχείο **δεμένο στα χρήματα που κινήθηκαν** (ΜΑΡΚ ανά σκοπό), όχι ελεύθερο πεδίο.
4. Ελάχιστα δεδομένα: IBAN/KYC στον PSP, όχι σε εμάς.
5. Ιδεμποτία χρημάτων **χωρίς** κλειδί ιδεμποτίας του παρόχου: δηλωτικές πράξεις (§5.7).
6. Πίνακας ακύρωσης **σε ποσά** πριν από την έγκριση, από τους ίδιους κανόνες με την πραγματική επιστροφή (§5.8).
7. Μεταφορά **χωρίς** κλειδί ιδεμποτίας του παρόχου, ασφαλής και σε ταυτόχρονους καλούντες: δηλωτική πράξη + μίσθωση + οφειλή που τη βλέπει το cron (§5.9 Ε-3/Ε-4).
8. **Κάθε κίνηση κρατημένων χρημάτων ως εντολή πριν από την πράξη**, με τον τομέα να ξαναρωτιέται τη στιγμή της εκτέλεσης: η αυτόματη αποδέσμευση δεν χρειάζεται κανέναν να «θυμηθεί» να την ακυρώσει όταν έρθει αντίρρηση (§5.10 Ζ-6/Ζ-7).
9. **Κωδικός του φακέλου, όχι του email**, με κοινό όριο λαθών για όλους τους συνδέσμους και χωρίς «ξεκλείδωτη συνεδρία» — και **φραγμένοι** ζωντανοί σύνδεσμοι δεμένοι στην απόφαση (§5.11 Η-3/Η-5).
10. **Η εντολή χρημάτων συγκλίνει στον τομέα** (§5.12 Θ-1/Θ-2): μία κρίση «ποια κίνηση οφείλεται;» για παραγωγό και εκτελεστή, και μια εντολή που ο τομέας δεν θέλει πια με αυτή τη μορφή **ξαναγράφεται** — η ακύρωση που προλαβαίνει την αυτόματη αποδέσμευση δεν χρειάζεται κανέναν να τη «θυμηθεί».

## 7. Εκτός εμβέλειας
Ο φάκελος αρχείων της κατοικίας και το μοίρασμά του (άλλος πράκτορας) · διαβίβαση myDATA από την εφαρμογή · προμήθεια πλατφόρμας.

## 8. Ανοιχτά προς επαλήθευση
1. Merchant of record στο EveryPay Marketplace. **2026-11-17**: στάλθηκε email στην EveryPay (info@) με αίτημα ενεργοποίησης
   Marketplace στο sandbox + τα ερωτήματα #1 · #2 · #3 (webhooks transfer/payout) · #4 · #9 · #10 (αναζήτηση πωλητή με ΑΦΜ) +
   υπενθύμιση των εκκρεμών της 13/11 (Google Pay · επαναλήψεις webhook). **2026-11-17 16:21**: η EveryPay επιβεβαίωσε
   παραλαβή (αίτημα **00128788**, «το εξετάζουμε με προτεραιότητα») — **καμία ουσιαστική απάντηση ακόμη**, το Marketplace
   **δεν** έχει ενεργοποιηθεί. Τα #1 · #2 · #3 · #4 · #9 · #10 μένουν ανοιχτά — Φ6.
2. Split με IRIS.
3. Webhooks transfer/payout — **δεν τεκμηριώνονται** (2026-11-16)· ✅ Φ5α: η αποδέσμευση διαβάζει τη μεταφορά (`readTransfer`) πριν κινηθεί και καταγράφεται μόνο μετά την απάντηση του παρόχου — κανένα webhook δεν χρειάζεται.
4. Refund πληρωμής με κρατημένο (μη αποδοσμένο) transfer. Τεκμηρίωση: refund **μόνο** για ανεκκαθάριστη split πληρωμή,
   και η εκκαθάριση γίνεται όταν οι μεταφορές καλύψουν το ποσό ⇒ με κρατημένη μεταφορά ολόκληρου του ποσού, ακύρωση πριν
   την έναρξη = **αντιλογισμός + επιστροφή**· αν μετά τον αντιλογισμό η πληρωμή ξαναγίνεται «ανεκκαθάριστη» δεν δηλώνεται.
   ✅ Σχεδίαση αποφασίστηκε (§5.8 Δ-2): μεταφορά **κατά την πληρωμή**, κρατημένη. Μένει για τη Φ6 (sandbox): αν μετά τον
   αντιλογισμό επιτρέπεται επιστροφή στον πελάτη.
5. Τύπος myDATA παραστατικού προκαταβολής + συμψηφισμός (λογιστής). **Φ5δ — έρευνα (2026-11-17), όχι επίσημη απάντηση**:
   ενδείξεις ότι η είσπραξη προκαταβολής με ηλεκτρονικό μέσο γίνεται με παραστατικό τύπου **8.4** («Απόδειξη Είσπραξης POS»)
   και **συσχετίζεται** με το μεταγενέστερο παραστατικό αξίας, ενώ ο έλεγχος συσχέτισης γίνεται από την ΑΑΔΕ μετά τη διαβίβαση
   ([Entersoft wiki](https://wiki.entersoft.eu/wiki/%CE%A3%CE%A5%CE%9D%CE%91%CE%9B%CE%9B%CE%91%CE%93%CE%95%CE%A3_%CE%9C%CE%95%CE%A3%CE%A9%CE%9D_%CE%A0%CE%9B%CE%97%CE%A1%CE%A9%CE%9C%CE%A9%CE%9D) ·
   [myDATA REST API v1.0.12](https://aade.gr/sites/default/files/2025-10/myDATA%20API%20Documentation%20v1%20.0.12_preofficial_erp.pdf)).
   Δεν βρέθηκε επίσημη πηγή για **ΑΠΥ ελεύθερου επαγγελματία** με online πληρωμή μέσω PSP marketplace ⇒ **μένει ανοιχτό για
   λογιστή**. Ο κώδικας **δεν** εξαρτάται από τον τύπο: καταγράφει ΜΑΡΚ (15 ψηφία) + ημέρα + ποσό, και ο τελικός ΜΑΡΚ
   συμψηφίζει το καθαρό εισπραχθέν. Επιστροφή μετά τον ΜΑΡΚ ⇒ ένδειξη «χρειάζεται πιστωτικό» (§5.13 Ι-5).
6. ✅ Διαβάστηκε (§2.5, §5.8): 3ε · 3ι §3–§4 · 3ιβ (α).
7. ✅ 50% (§5.8 Δ-1).
8. ✅ Υλοποιήθηκε (§5.8): αξία αυτοψίας στους όρους · πλαφόν στο `refundDueOnCancelOf`.
9. Μορφή σε φόρμα των `is_c2c` / `on_hold` (`1`/`0`) · `kyc_process_url` στη δημιουργία πωλητή · υπογραφή του webhook KYC
   με την ίδια κεφαλίδα — ζωντανά στη Φ6.
10. Κατάρρευση μετά την επιτυχή εγγραφή πωλητή και πριν γραφτεί η αναφορά ⇒ πιθανός δεύτερος πωλητής (ο πάροχος δεν
    τεκμηριώνει αναζήτηση πωλητή με ΑΦΜ) — εντοπισμός στο dashboard.
11. (§5.9) Ο σύνδεσμος πληρωμής λήγει με την **υπογραφή** της πρόσκλησης έγκρισης (7 ημέρες από την αποστολή)· έγκριση που
    **κατέγραψε το γραφείο** (`recorded-instruction`) δεν έχει σύνδεσμο ιδιοκτήτη ⇒ καμία online πληρωμή ακόμη. Σχέδιο: αίτημα
    πληρωμής από το γραφείο (νέος σύνδεσμος μόνο πληρωμής) — Φ5. ✅ Φ5β1 (§5.11): σύνδεσμος `advance` που ζει όσο τα χρήματα
    και πληρωτής από την απόφαση (και `recorded-instruction`). ✅ **ΕΚΛΕΙΣΕ** Φ5β2: «Αίτημα πληρωμής / Νέος σύνδεσμος» του γραφείου.
12. (§5.9) Είσπραξη που ο μειωτής αρνείται (ακύρωση ανάμεσα σε πληρωμή και webhook, άλλο ποσό) ⇒ `subject-refused` + σφάλμα·
    η αυτόματη επιστροφή είναι Φ5 (`reconcilePaymentRefund`). ✅ **ΕΚΛΕΙΣΕ** Φ5γ (§5.12 Θ-6/Θ-7): εντολή πλήρους επιστροφής
    `refused-payment`, επιστροφή χωρίς μεταφορά, κανένας βρόχος.
13. (§5.9) Ο δικαιούχος είναι **ανά χρήστη** (ο λογαριασμός της ενεργής συμμετοχής) — όχι ανά γραφείο του μηχανικού
    (`actingFor`). Αν ο μηχανικός αναλαμβάνει για γραφείο του, η πληρωμή πάει στον προσωπικό του δικαιούχο· η τιμολόγηση
    για το γραφείο είναι εκτός εμβέλειας.
14. (§5.9) Η κάρτα «Λήψη πληρωμών» ζει στο `(me)/profile`· το προφίλ του γραφειακού κόσμου (`o/[workspace]/account/profile`) δεν
    τη δείχνει ακόμη.

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-11-16 | Φ0: έρευνα (ΚΦΑ 16, ν.4308 11/13, ΔΕΔ 843/2023, PSD2/EBA, EveryPay Marketplace, Airbnb/Upwork/Houzz/Stripe, Οδηγία 2011/83) · SSoT audit · αποφάσεις Κ-1…Κ-8 (Giorgio: αποδέσμευση στην έναρξη · τυποποιημένες πολιτικές · προμήθεια 0) · σχέδιο Φ1–Φ6. |
| 2026-11-16 | Φ1: καθαρός τομέας (§5.5) — `issuance-advance.ts` · `issuance-advance-reducer.ts` · actor `system` · πεδία εγγραφής/σχήματος με defaults · τελικός ΜΑΡΚ με συμψηφισμό · σουίτα `issuance-advance.test.ts`. Απόκλιση: `advanceReceipt` αντί για `receipts[]`. |
| 2026-11-16 | Φ2 (§5.6): γενίκευση checkout σε «πληρωτέο αντικείμενο» χωρίς αλλαγή συμπεριφοράς — `payable-subject.ts` (λεξιλόγιο + κωδικοποιητής) · `payable-subject-registry.ts` (γραφέας ανά είδος) · `invoice-payable-subject.ts` · `PaymentCheckoutRecord.subject` (στη βάση ίδια πεδία + `subjectKind`, καμία μετάπτωση) · `payment-checkout-closing.ts` μετακινήθηκε στο `server/payments/`. Απόφαση Giorgio Α1: το `issuance-advance` μπαίνει στη Φ4 μαζί με τον γραφέα του. Jest 12/104. |
| 2026-11-16 | Φ3 (§5.7): έρευνα EveryPay Marketplace API (sellers · transfers · reversals · payouts · KYC webhook — κανένα webhook transfer/payout, κανένα κλειδί ιδεμποτίας) · `MarketplaceCapability` με **δηλωτικές** πράξεις χρημάτων · adapter + αναγνώστες · `EVERYPAY_MARKETPLACE` · συλλογή `payment_payees` (deny-all, `ppye`, κράτηση θέσης) · σήμα `payee-kyc`. Ποσοστά παρακράτησης 0/50/100 κρατήθηκαν μετά από έρευνα (ΑΚ 700, Airbnb, Οδηγία 2011/83 14(3))· §8 #7–#10 νέα. Απόκλιση: `split=1` στη Φ4. Jest 14/127. |
| 2026-11-17 | Φ4β (§5.9): έρευνα EveryPay (`split` σε notifications + payments, όχι σε IRIS sessions · μεταφορά μόνο σε `Authorized`) · αποφάσεις Ε-1…Ε-5 · είδος `issuance-advance` + γραφέας `system` · `split=1` · κράτηση/μίσθωση/οφειλή στη συνεδρία + cron · πληρωμή από τον σύνδεσμο που ενέκρινε (όψη `advance`, §29 κωδικός) · email απόδειξης με κουμπί πληρωμής · «Λήψη πληρωμών» (KYC) στο προφίλ · ειδοποιήσεις `…_ADVANCE_FUNDED` / `…_PAYEE_REQUIRED` · κοινά client modules πληρωμής (μεταφορά από το τιμολόγιο). §8 #11–#14 νέα. Jest: γράφτηκαν, εκκρεμεί έγκριση εκτέλεσης. |
| 2026-11-17 | Φ4α (§5.8): έρευνα (ν.2251/1994 3ε · 3ι · 3ιβ — η σωστή διάταξη για το αναλογικό ποσό είναι η **3ι §3**· Airbnb · Upwork · EveryPay) · αποφάσεις Δ-1…Δ-4 (Giorgio: «όπως οι μεγάλοι») · όριο 50% · αξία αυτοψίας · πλαφόν υπαναχώρησης · πίνακας ακύρωσης σε ποσά · πεδία ιστορικού χρημάτων (κλείνει §42.6) · πεδία στη φόρμα + όψη ιδιοκτήτη · νέα σφράγιση slice `/document-request`. §8 #4 (σχεδίαση) · #6 · #7 · #8 έκλεισαν. Jest 2/25. |
| 2026-11-17 | Φ5 αποφάσεις Ζ-1…Ζ-8 (έρευνα: Stripe hosted invoice · Stripe Connect refunds/reversals · Airbnb · Upwork) · **Φ5α** (§5.10): «Έγινε η αυτοψία» (πράξη μηχανικού, ο ΕΝΑΣ δρόμος εξήχθη από το αίτημα ημερομηνίας) · ο ΕΝΑΣ εκτελεστής κρατημένων χρημάτων (εντολή στη συνεδρία · η ΜΙΑ μίσθωση εξήχθη από τη μεταφορά · κρίση τομέα πριν από τα χρήματα) · αυτόματη αποδέσμευση από το cron (4ο πέρασμα) · `advanceGlanceOf` · ειδοποιήσεις ορόσημων. §8 #3 έκλεισε. Jest 12/142 + 9/77 + 2/16. |
| 2026-11-17 | **Φ5β1** (§5.11): σελίδα προκαταβολής του ιδιοκτήτη — σκοπός συνδέσμου `advance` (νέος σε κάθε email, ζωή χρημάτων +30 ημ., ≤120 ημ., φραγμένοι ζωντανοί, δέσιμο στην απόφαση) · πληρωτής από την απόφαση (Ζ-2, και `recorded-instruction`) · κωδικός §29 του φακέλου (DocuSign, κοινό όριο λαθών) · αντίρρηση ιδιοκτήτη (Ζ-3, δράστης `link`) + route · email αυτοψίας · `…_ADVANCE_OBJECTED` (μηχανικός χωρίς αιτιολογία) · χρονολόγιο χρημάτων (`advanceTimelineOf`) · `readLiveOrRedeemedInvitationByToken` αντικατέστησε το `readRedeemedInvitationByToken`. Έρευνα: Stripe hosted invoice · DocuSign recipient authentication. Jest 16/186 πράσινα. |
| 2026-11-17 | **Φ5β2** (§5.11 Η-7/Η-8): «Αίτημα πληρωμής / Νέος σύνδεσμος» από το γραφείο — μόνο όταν ο ιδιοκτήτης έχει κάτι να κάνει (πληρωμή · αντίρρηση), προαιρετικός νέος κωδικός φακέλου (μία εμφάνιση) · route `advance-link` · γραμμή προκαταβολής στην κάρτα ανάθεσης. §8 #11 έκλεισε. |
| 2026-11-17 | **Φ5γ** (§5.12): ακύρωση με χρήματα (Ζ-4) · απόφαση διαφοράς (Ζ-5) · άρνηση είσπραξης (Ζ-8) — αποφάσεις Θ-1…Θ-8 (έρευνα: Upwork dispute/escrow · Airbnb Resolution Center)· η ΜΙΑ κρίση `advanceSettlementDueOf` · εντολή που συγκλίνει στον τομέα (`reschedule`) · πρώτα η εντολή μετά το γεγονός · επιστροφή χωρίς μεταφορά · φρένο βρόχου · νέα πρόταση περιμένει όσο ζουν χρήματα · `scheduleSettlement` εξήχθη (`payment-settlement-order.ts`) · ειδοποιήσεις `…_REFUNDED` / `…_DISPUTE_RESOLVED` · email `settlement` · ποσά στον διάλογο ακύρωσης · διάλογος απόφασης διαφοράς · νέα σφράγιση slice `/document-request`. §8 #12 έκλεισε. Jest 25/310 πράσινα, μετάλλαξη 2/2. |
| 2026-11-17 | **Φ5δ** (§5.13): ΜΑΡΚ προκαταβολής από γραφείο και μηχανικό (νέα πόρτα `…/issuance/advance-receipt` μέσω του ΕΝΟΣ δρόμου πράξης μηχανικού) · πίνακας «Προκαταβολή» στο γραφείο (ποσά `advanceLedgerOf` · εκκρεμής κίνηση από το `advanceSettlementDueOf` · ΜΑΡΚ · χρονολόγιο) · αντίρρηση από το γραφείο για λογαριασμό του ιδιοκτήτη (ίδια ειδοποίηση) · ΜΑΡΚ στο χρονολόγιο των τριών όψεων · ένδειξη πιστωτικού όταν επιστρέφονται χρήματα μετά τον ΜΑΡΚ · εξαγωγές `IssuanceReceiptFields` · `IssuanceAdvanceTimelineList` · `receiptFields`. Αποφάσεις Ι-1…Ι-5. §8 #5 έρευνα (μένει ανοιχτό για λογιστή) · §8 #1 στάλθηκε αίτημα Marketplace στην EveryPay. Jest γράφτηκαν (+10), εκκρεμεί έγκριση εκτέλεσης. |
