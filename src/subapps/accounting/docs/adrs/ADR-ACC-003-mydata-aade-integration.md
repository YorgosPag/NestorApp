# ADR-ACC-003: myDATA / ΑΑΔΕ Integration

| Metadata | Value |
|----------|-------|
| **Status** | DRAFT |
| **Date** | 2026-02-09 |
| **Category** | Accounting / Tax Authority Integration |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Parent** | [ADR-ACC-000](./ADR-ACC-000-founding-decision.md) |
| **Module** | M-004: myDATA |

---

## 1. Context

Κάθε παραστατικό (τιμολόγιο, ΑΠΥ, πιστωτικό) πρέπει **υποχρεωτικά** να διαβιβαστεί ηλεκτρονικά στην πλατφόρμα **myDATA** (my Digital Accounting and Tax Application) της ΑΑΔΕ.

### Τι είναι το myDATA

- **Ψηφιακή πλατφόρμα** της ΑΑΔΕ για ηλεκτρονική τήρηση βιβλίων
- **Υποχρεωτική** από 01/01/2024 για όλες τις επιχειρήσεις
- Κάθε παραστατικό λαμβάνει **MARK** (Μοναδικός Αριθμός Καταχώρησης)
- Τα δεδομένα χρησιμοποιούνται για **αυτόματη προσυμπλήρωση** Ε3 / ΦΠΑ δηλώσεων

### Απαιτήσεις Εφαρμογής

1. **Αυτόματη διαβίβαση** μετά την έκδοση τιμολογίου
2. **Retry mechanism** αν αποτύχει η επικοινωνία
3. **Audit trail** — πλήρες ιστορικό αποστολών
4. **Classification** — σωστοί χαρακτηρισμοί εσόδων (category1_x)
5. **Received documents** — χαρακτηρισμός εισερχόμενων (category2_x)
6. **Cancellation** — ακύρωση παραστατικού μέσω API
7. **Reconciliation** — αντιστοίχιση με ηλεκτρονικά βιβλία ΑΑΔΕ

---

## 2. myDATA API Overview

### 2.1 Endpoints

| Environment | Base URL |
|-------------|----------|
| **Production** | `https://mydatapi.aade.gr/myDATA` |
| **Development** | `https://mydataapidev.aade.gr/myDATA` |

### 2.2 Authentication

```
Headers:
  aade-user-id: {ΑΦΜ χρήστη}
  ocp-apim-subscription-key: {API key από ΑΑΔΕ dev portal}
```

- **Subscription key**: Εκδίδεται από το [ΑΑΔΕ Developer Portal](https://www.aade.gr/myDATA)
- **1 key ανά ΑΦΜ** (ένα για production, ένα για development)
- **Δεν λήγει** — αλλά μπορεί να ανακληθεί

### 2.3 API Methods

| Method | Endpoint | Σκοπός |
|--------|----------|--------|
| **SendInvoices** | `POST /SendInvoices` | Αποστολή παραστατικών (1 ή batch) |
| **CancelInvoice** | `POST /CancelInvoice` | Ακύρωση παραστατικού (με MARK) |
| **RequestDocs** | `GET /RequestDocs` | Λήψη παραστατικών (εισερχόμενα) |
| **RequestTransmittedDocs** | `GET /RequestTransmittedDocs` | Λήψη εκδοθέντων (επαλήθευση) |
| **RequestMyIncome** | `GET /RequestMyIncome` | Σύνοψη εσόδων |
| **RequestMyExpenses** | `GET /RequestMyExpenses` | Σύνοψη εξόδων |
| **SendIncomeClassification** | `POST /SendIncomeClassification` | Χαρακτηρισμός εσόδων |
| **SendExpensesClassification** | `POST /SendExpensesClassification` | Χαρακτηρισμός εξόδων |

### 2.4 Data Format

- **Format**: XML (mandatory — JSON δεν υποστηρίζεται)
- **Encoding**: UTF-8
- **XSD Schema**: Παρέχεται από ΑΑΔΕ (versioned)

---

## 3. Document Type Mapping

### 3.1 Εκδιδόμενα Παραστατικά (Εκδότης = εμείς)

| App Type | myDATA invoiceType | myDATA Κωδικός | Περιγραφή |
|----------|-------------------|----------------|-----------|
| `service_invoice` | 2.1 | Τιμολόγιο Παροχής Υπηρεσιών | Υπηρεσίες → νομικά πρόσωπα |
| `sales_invoice` | 1.1 | Τιμολόγιο Πώλησης | Κατασκευαστικά / πώληση αγαθών |
| `service_receipt` | 11.2 | Απόδειξη Παροχής Υπηρεσιών | Υπηρεσίες → ιδιώτες |
| `retail_receipt` | 11.1 | Απόδειξη Λιανικής Πώλησης | Πώληση → ιδιώτες |
| `credit_invoice` | 5.1 | Πιστωτικό Τιμολόγιο | Ακύρωση / μερική επιστροφή |

### 3.2 Λαμβανόμενα Παραστατικά (Εκδότης = τρίτος)

Δεν εκδίδουμε — λαμβάνουμε & χαρακτηρίζουμε (category2_x):

| Τύπος | Χρήση | Χαρακτηρισμός |
|-------|-------|---------------|
| Τιμολόγιο προμηθευτή | Λογιστής, δικηγόρος | `category2_3` (Λήψη υπηρεσιών) |
| Απόδειξη ΔΕΚΟ | ΔΕΗ, νερό | `category2_4` (Γενικά έξοδα) |
| Απόδειξη λιανικής | Αναλώσιμα, καύσιμα | `category2_5` (Λοιπά έξοδα) |
| Τιμολόγιο αγοράς παγίου | Εξοπλισμός >1.500€ | `category2_7` (Αγορές παγίων) |

---

## 4. Income Classification (Χαρακτηρισμός Εσόδων)

Κάθε εκδιδόμενο παραστατικό χρειάζεται **income classification**:

### 4.1 Classification Matrix

| Τύπος Παραστατικού | Income Category | E3 Code | Περιγραφή |
|--------------------|-----------------|---------|-----------|
| ΤΠΥ (2.1) — Υπηρεσίες | `category1_3` | `E3_561_003` | Έσοδα από Παροχή Υπηρεσιών |
| ΤΠ (1.1) — Κατασκευές | `category1_1` | `E3_561_001` | Έσοδα από Πώληση Αγαθών |
| ΑΠΥ (11.2) | `category1_3` | `E3_561_003` | Παροχή Υπηρεσιών (λιανική) |
| Πιστωτικό (5.1) | Αντιλογισμός | — | Αντίστροφο αρχικής κατηγορίας |

### 4.2 Classification XML Structure

```xml
<incomeClassification>
  <icls:classificationType>E3_561_003</icls:classificationType>
  <icls:classificationCategory>category1_3</icls:classificationCategory>
  <icls:amount>500.00</icls:amount>
</incomeClassification>
```

### 4.3 Auto-Classification Logic

```typescript
function getIncomeClassification(
  invoiceType: string,
  kadCode: string
): { category: string; e3Code: string } {
  // Κατασκευαστικά → category1_1
  if (kadCode === '41202003' || kadCode === '41201001') {
    return { category: 'category1_1', e3Code: 'E3_561_001' };
  }
  // Υπηρεσίες → category1_3
  if (kadCode === '71112000') {
    return { category: 'category1_3', e3Code: 'E3_561_003' };
  }
  // Fallback
  return { category: 'category1_5', e3Code: 'E3_561_005' };
}
```

---

## 5. Expense Classification (Χαρακτηρισμός Εξόδων)

Λαμβανόμενα παραστατικά χαρακτηρίζονται με **expense classification**:

### 5.1 Classification Matrix

| App Category | myDATA Expense | E3 Code | Περιγραφή |
|-------------|----------------|---------|-----------|
| `third_party_fees` | `category2_3` | `E3_585_001` | Λήψη υπηρεσιών |
| `rent` | `category2_3` | `E3_585_002` | Λήψη υπηρεσιών (ενοίκιο) |
| `utilities` | `category2_4` | `E3_585_002` | Γενικά έξοδα |
| `telecom` | `category2_4` | `E3_585_002` | Γενικά έξοδα |
| `fuel` | `category2_5` | `E3_585_006` | Λοιπά έξοδα |
| `vehicle_expenses` | `category2_5` | `E3_585_006` | Λοιπά έξοδα |
| `office_supplies` | `category2_5` | `E3_585_006` | Λοιπά έξοδα |
| `software` | `category2_5` | `E3_585_006` | Λοιπά έξοδα |
| `equipment` (>1.500€) | `category2_7` | — | Αγορές παγίων |
| `efka` | `category2_12` | `E3_585_005` | Ασφαλιστικές εισφορές |
| `professional_tax` | `category2_12` | `E3_585_009` | Φόροι-Τέλη |
| `depreciation` | `category2_11` | `E3_587_001` | Αποσβέσεις |
| `other_expense` | `category2_14` | `E3_585_016` | Πληροφοριακά |

### 5.2 Classification XML Structure

```xml
<expensesClassification>
  <ecls:classificationType>E3_585_001</ecls:classificationType>
  <ecls:classificationCategory>category2_3</ecls:classificationCategory>
  <ecls:amount>200.00</ecls:amount>
</expensesClassification>
```

---

## 6. SendInvoices — Αποστολή Παραστατικού

### 6.1 XML Payload Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<InvoicesDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0"
             xmlns:icls="http://www.aade.gr/myDATA/incomeClassification/v1.0"
             xmlns:ecls="http://www.aade.gr/myDATA/expensesClassification/v1.0">
  <invoice>
    <!-- Εκδότης -->
    <issuer>
      <vatNumber>XXXXXXXXX</vatNumber>
      <country>GR</country>
      <branch>0</branch>
    </issuer>

    <!-- Λήπτης (αν δεν είναι ιδιώτης) -->
    <counterpart>
      <vatNumber>YYYYYYYYY</vatNumber>
      <country>GR</country>
      <branch>0</branch>
      <name>Εταιρεία Α.Ε.</name>
      <address>
        <street>Οδός 1</street>
        <number>10</number>
        <postalCode>54621</postalCode>
        <city>Θεσσαλονίκη</city>
      </address>
    </counterpart>

    <!-- Επικεφαλίδα -->
    <invoiceHeader>
      <series>A</series>
      <aa>42</aa>
      <issueDate>2026-01-15</issueDate>
      <invoiceType>2.1</invoiceType>
      <currency>EUR</currency>
    </invoiceHeader>

    <!-- Τρόποι πληρωμής -->
    <paymentMethods>
      <paymentMethodDetails>
        <type>3</type>  <!-- 1=Μετρητά, 2=Επιταγή, 3=Κατάθεση, 5=Πίστωση -->
        <amount>520.00</amount>
        <paymentMethodInfo>GR68 0110 2230 0000 2234 0068 448</paymentMethodInfo>
      </paymentMethodDetails>
    </paymentMethods>

    <!-- Γραμμές -->
    <invoiceDetails>
      <lineNumber>1</lineNumber>
      <netValue>500.00</netValue>
      <vatCategory>1</vatCategory>  <!-- 1=24%, 2=13%, 3=6%, 8=0% -->
      <vatAmount>120.00</vatAmount>
      <!-- Χαρακτηρισμός εσόδου -->
      <incomeClassification>
        <icls:classificationType>E3_561_003</icls:classificationType>
        <icls:classificationCategory>category1_3</icls:classificationCategory>
        <icls:amount>500.00</icls:amount>
      </incomeClassification>
      <!-- Παρακράτηση φόρου -->
      <withheldAmount>100.00</withheldAmount>
      <withheldPercentCategory>1</withheldPercentCategory>  <!-- 1=20% -->
    </invoiceDetails>

    <!-- Σύνολα -->
    <invoiceSummary>
      <totalNetValue>500.00</totalNetValue>
      <totalVatAmount>120.00</totalVatAmount>
      <totalWithheldAmount>100.00</totalWithheldAmount>
      <totalDeductionsAmount>0.00</totalDeductionsAmount>
      <totalStampDutyAmount>0.00</totalStampDutyAmount>
      <totalFeesAmount>0.00</totalFeesAmount>
      <totalOtherTaxesAmount>0.00</totalOtherTaxesAmount>
      <totalGrossValue>620.00</totalGrossValue>
      <!-- Income classification σε summary level -->
      <incomeClassification>
        <icls:classificationType>E3_561_003</icls:classificationType>
        <icls:classificationCategory>category1_3</icls:classificationCategory>
        <icls:amount>500.00</icls:amount>
      </incomeClassification>
    </invoiceSummary>
  </invoice>
</InvoicesDoc>
```

### 6.2 Response

```xml
<ResponseDoc>
  <response>
    <index>1</index>
    <invoiceUid>XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX</invoiceUid>
    <invoiceMark>400001234567890</invoiceMark>
    <statusCode>Success</statusCode>
  </response>
</ResponseDoc>
```

| Πεδίο | Περιγραφή | Αποθήκευση |
|-------|-----------|------------|
| `invoiceUid` | Μοναδικό ID ΑΑΔΕ | `invoice.mydataUid` |
| `invoiceMark` | MARK — αριθμός καταχώρησης | `invoice.mydataMark` |
| `statusCode` | `Success` ή `Error` | `invoice.mydataStatus` |

---

## 7. VAT Category Mapping

> ✅ **Επαληθευμένο 2026-11-09** έναντι ΑΑΔΕ *myDATA ERP v2.0.2* §8.2 + XSD `VatType` (1–10). Η προηγούμενη
> μορφή αυτού του πίνακα (2026-02) έδινε το **8** ως «εξαιρούμενο ΦΠΑ» — **λάθος**: το 8 είναι εγγραφές
> χωρίς ΦΠΑ (μισθοδοσία, αποσβέσεις), όχι γραμμή τιμολογίου. Ο κώδικας (`vat-rates.ts`) είχε 0% → 8· διορθώθηκε σε 7.

| myDATA vatCategory | Ποσοστό | Χρήση |
|--------------------|---------|-------|
| 1 | 24% | Κανονικός |
| 2 | 13% | Μειωμένος |
| 3 | 6% | Υπερμειωμένος |
| 4 | 17% | Νησιωτικός κανονικός |
| 5 | 9% | Νησιωτικός μειωμένος |
| 6 | 4% | Νησιωτικός υπερμειωμένος |
| 7 | 0% | **Άνευ ΦΠΑ** — απαιτεί **αιτία εξαίρεσης** (`vatExemptionCategory`, §8.3, κωδ. 1–31) |
| 8 | — | Εγγραφές χωρίς ΦΠΑ (π.χ. μισθοδοσία, αποσβέσεις) — **όχι** για γραμμή τιμολογίου |
| 9 | 3% | αρ. 31 ν.5057/2023 |
| 10 | 4% | αρ. 31 ν.5057/2023 |

**SSoT κώδικα**: συντελεστής → κατηγορία στο `GREEK_VAT_RATES` (`services/config/vat-rates.ts`)· αναζήτηση
μέσω `myDataVatCategoryOf()` (`services/mydata/mydata-codes.ts`). Η εφαρμογή γνωρίζει 24 / 13 / 6 / 0.

---

## 8. Payment Method Mapping

> ✅ **Επαληθευμένο 2026-11-09** έναντι ΑΑΔΕ *myDATA ERP v2.0.2* §8.12. Ο προηγούμενος πίνακας (1 = Μετρητά,
> 3 = Κατάθεση, 4 = Κάρτα) ήταν **λάθος**. SSoT κώδικα: `MYDATA_PAYMENT_METHOD_CODES` (`services/mydata/mydata-codes.ts`).

| myDATA type | Τρόπος Πληρωμής (ΑΑΔΕ) | App PaymentMethod |
|-------------|------------------------|-------------------|
| 1 | Επαγγελματικός Λογαριασμός Πληρωμών Ημεδαπής | `bank_transfer` |
| 2 | Επαγγελματικός Λογαριασμός Πληρωμών Αλλοδαπής | — |
| 3 | Μετρητά | `cash` |
| 4 | Επιταγή | `check` |
| 5 | Επί Πιστώσει | `credit` |
| 6 | Web Banking | — |
| 7 | POS / e-POS | `card` |
| 8 | Άμεσες Πληρωμές IRIS | — |
| — | **μη διαβιβάσιμο** (θέλει ανάλυση ποσών ανά τρόπο) | `mixed` |
| — | **μη διαβιβάσιμο** (μη ταμειακή εγγραφή) | `non_cash` |

Κανόνας ΑΑΔΕ (§4.2.4 παρ. 5): το άθροισμα των ποσών πληρωμής = `totalGrossValue`.

---

## 9. Withholding Tax Mapping

> ✅ **Επαληθευμένο 2026-11-09** έναντι ΑΑΔΕ *myDATA ERP v2.0.2* §8.4 + XSD `WithheldType` (1–18). Ο
> προηγούμενος πίνακας (1 = 20% ελ. επαγγελματίες, 5 = 3% τεχνικά έργα) ήταν **λάθος**.

| myDATA withheldPercentCategory | Περίπτωση (ΑΑΔΕ §8.4) | % |
|-------------------------------|------------------------|---|
| 1 | Περιπτ. β' — Τόκοι | 15% |
| 2 | Περιπτ. γ' — Δικαιώματα | 20% |
| 3 | Περιπτ. δ' — Αμοιβές Συμβουλών Διοίκησης | 20% |
| 4 | Περιπτ. δ' — **Τεχνικά Έργα** | **3%** |
| 5 | Υγρά καύσιμα και προϊόντα καπνοβιομηχανίας | 1% |
| 6 | Λοιπά Αγαθά | 4% |
| 7 | Παροχή Υπηρεσιών | 8% |
| 8 | Προκαταβλητέος Φόρος Αρχιτεκτόνων/Μηχανικών — Μελέτες και Σχέδια | 4% |
| 9 | Προκαταβλητέος Φόρος Αρχιτεκτόνων/Μηχανικών — λοιπά έργα | 10% |
| 10 | Προκαταβλητέος Φόρος Αμοιβών Δικηγόρων | 15% |
| 11–18 | Μισθωτές υπηρεσίες, ναυτικοί, εισφορά αλληλεγγύης, ΣΑΔΦ, λοιπές, μερίσματα | — |

**Στον κώδικα** (`myDataWithholdingCategoryOf`) αντιστοιχίζεται **μόνο** το μονοσήμαντο **3% → 4**. Τα
ποσοστά της εφαρμογής **1%** («αντιπρόσωποι» στο `types/invoice.ts` — όμως στο §8.4 το 1% είναι καύσιμα)
και **20%** (αμοιβές ελ. επαγγελματιών — καμία γραμμή του §8.4 δεν είναι ρητά αυτή) **μπλοκάρουν** τη
διαβίβαση μέχρι να απαντήσει λογιστής (§20 #5, #6).

---

## 10. Architecture — Service Layer

### 10.1 MyData Service

```typescript
interface IMyDataService {
  /** Αποστολή τιμολογίου → ΑΑΔΕ */
  submitInvoice(invoice: Invoice): Promise<MyDataSubmissionResult>;

  /** Ακύρωση τιμολογίου (με MARK) */
  cancelInvoice(mark: string): Promise<MyDataCancellationResult>;

  /** Λήψη εισερχόμενων παραστατικών */
  fetchReceivedDocuments(
    dateFrom: string,
    dateTo: string
  ): Promise<ReceivedDocument[]>;

  /** Λήψη εκδοθέντων (για επαλήθευση) */
  fetchTransmittedDocuments(
    dateFrom: string,
    dateTo: string
  ): Promise<TransmittedDocument[]>;

  /** Χαρακτηρισμός εξόδων (εισερχόμενο παραστατικό) */
  classifyExpense(
    mark: string,
    classification: ExpenseClassificationPayload
  ): Promise<MyDataClassificationResult>;

  /** Σύνοψη εσόδων (αντιστοίχιση) */
  getMyIncome(year: number): Promise<IncomeSummary[]>;

  /** Σύνοψη εξόδων (αντιστοίχιση) */
  getMyExpenses(year: number): Promise<ExpenseSummary[]>;
}
```

### 10.2 XML Builder

```typescript
interface IMyDataXmlBuilder {
  /** Invoice → XML payload */
  buildInvoiceXml(invoice: Invoice): string;

  /** Ακύρωση → XML */
  buildCancelXml(mark: string): string;

  /** Χαρακτηρισμός εξόδων → XML */
  buildExpenseClassificationXml(
    mark: string,
    entries: ExpenseClassificationEntry[]
  ): string;

  /** Parse response XML → typed object */
  parseResponse(xml: string): MyDataResponse;
}
```

### 10.3 Retry & Queue

```typescript
interface IMyDataQueue {
  /** Enqueue αποστολή (αν API down) */
  enqueue(invoiceId: string, action: 'submit' | 'cancel'): Promise<void>;

  /** Process pending items (retry) */
  processQueue(): Promise<MyDataQueueResult>;

  /** Retry strategy */
  retryPolicy: {
    maxRetries: 3;
    delayMs: [5000, 15000, 60000];   // 5s, 15s, 60s
    backoff: 'exponential';
  };
}
```

---

## 11. Submission Flow

### 11.1 Αυτόματη Αποστολή

```
[1] Invoice created (status: draft)
    ↓
[2] User confirms → status: pending
    ↓
[3] MyDataService.submitInvoice(invoice)
    ├─ Build XML payload
    ├─ POST /SendInvoices
    ├─ Parse response
    ↓
[4] Success?
    ├─ YES → Αποθήκευση MARK + UID
    │        invoice.mydataStatus = 'accepted'
    │        invoice.mydataMark = response.mark
    │        invoice.mydataUid = response.uid
    │        → Log στο mydata_submissions
    │
    └─ NO  → Αποθήκευση errors
             invoice.mydataStatus = 'rejected'
             invoice.mydataErrors = response.errors
             → Enqueue for retry (αν network error)
             → Notify user (αν validation error)
```

### 11.2 Ακύρωση Παραστατικού

```
[1] User: "Ακύρωση τιμολογίου Α-042"
    ↓
[2] Validation:
    - Πρέπει να έχει MARK (ήδη submitted)
    - Αν έχει πληρωθεί → Warning
    ↓
[3] MyDataService.cancelInvoice(mark)
    ├─ POST /CancelInvoice?mark={MARK}
    ↓
[4] Success?
    ├─ YES → invoice.mydataStatus = 'cancelled'
    │        → Δημιουργία πιστωτικού (5.1)
    │        → Log στο mydata_submissions
    │
    └─ NO  → Show error → manual retry
```

### 11.3 Χαρακτηρισμός Εισερχομένων

```
[1] Fetch εισερχόμενα: RequestDocs(dateFrom, dateTo)
    ↓
[2] Για κάθε νέο παραστατικό:
    ├─ AI Classification → category suggestion
    ├─ User confirms/corrects category
    ↓
[3] SendExpensesClassification(mark, classification)
    ↓
[4] Log & αποθήκευση στο received_documents
```

---

## 12. TypeScript Types

### 12.1 Submission Record

```typescript
interface MyDataSubmission {
  submissionId: string;           // Auto-generated
  invoiceId: string;              // → invoices collection
  action: 'submit' | 'cancel' | 'classify';

  // Request
  requestXml: string;             // Αποθηκεύουμε για audit
  requestedAt: string;

  // Response
  responseXml: string | null;
  mark: string | null;            // MARK αριθμός
  uid: string | null;             // Unique ID ΑΑΔΕ
  statusCode: 'Success' | 'Error' | 'Pending';
  errors: MyDataError[];

  // Meta
  retryCount: number;
  environment: 'production' | 'development';
  createdAt: string;
}

interface MyDataError {
  code: string;                   // ΑΑΔΕ error code
  message: string;                // Ελληνικό μήνυμα
  field: string | null;           // Σχετικό πεδίο (αν υπάρχει)
}
```

### 12.2 Received Document

```typescript
interface ReceivedDocument {
  docId: string;                  // Auto-generated
  mark: string;                   // MARK εισερχόμενου
  uid: string;                    // UID ΑΑΔΕ

  // Εκδότης
  issuerVat: string;              // ΑΦΜ εκδότη
  issuerName: string;
  issuerBranch: number;

  // Παραστατικό
  invoiceType: string;            // myDATA type code
  series: string;
  number: string;
  issueDate: string;

  // Ποσά
  netValue: number;
  vatAmount: number;
  grossValue: number;

  // Χαρακτηρισμός εξόδων (δικός μας)
  classified: boolean;
  expenseCategory: string | null;       // category2_x
  e3Code: string | null;
  classifiedAt: string | null;

  // Σύνδεση με journal entry
  journalEntryId: string | null;

  // Meta
  fetchedAt: string;
  createdAt: string;
}
```

---

## 13. Firestore Structure

```
accounting/{companyId}/
  ├── settings/
  │   └── mydata                       ← API config (encrypted keys)
  │       ├── environment: 'production' | 'development'
  │       ├── aadeUserId: string       ← ΑΦΜ
  │       ├── subscriptionKey: string  ← Encrypted API key
  │       └── autoSubmit: boolean      ← Αυτόματη αποστολή;
  │
  ├── mydata_submissions/{subId}       ← Ιστορικό αποστολών (audit trail)
  │
  ├── received_documents/{docId}       ← Εισερχόμενα παραστατικά
  │
  └── mydata_queue/{queueId}           ← Retry queue (pending items)
```

### 13.1 Composite Indexes

```
mydata_submissions:
  - (invoiceId ASC, createdAt DESC)    ← Ιστορικό ανά τιμολόγιο
  - (statusCode ASC, createdAt ASC)    ← Pending/failed items

received_documents:
  - (classified ASC, issueDate ASC)    ← Αχαρακτήριστα πρώτα
  - (issueDate ASC)                    ← Χρονολογική σειρά
```

---

## 14. Error Handling

### 14.1 Κατηγορίες Σφαλμάτων

| Τύπος | Handling | Retry; |
|-------|----------|--------|
| **Network error** (timeout, DNS) | Enqueue for retry | ✅ Ναι (3 φορές) |
| **HTTP 500** (server error ΑΑΔΕ) | Enqueue for retry | ✅ Ναι (3 φορές) |
| **HTTP 401** (auth error) | Notify user — check API key | ❌ Όχι |
| **Validation error** (wrong data) | Show specific error to user | ❌ Όχι — fix & resubmit |
| **Duplicate MARK** | Already submitted — ignore | ❌ Όχι |

### 14.2 Κοινά Validation Errors ΑΑΔΕ

| Error Code | Μήνυμα | Λύση |
|------------|--------|------|
| `INV_001` | Μη έγκυρος τύπος παραστατικού | Σωστό invoiceType |
| `INV_002` | Μη έγκυρο ΑΦΜ εκδότη | Ελέγξτε ΑΦΜ στις ρυθμίσεις |
| `INV_003` | Μη έγκυρο ΑΦΜ λήπτη | Ελέγξτε ΑΦΜ πελάτη |
| `INV_004` | Λάθος ποσά (net + vat ≠ gross) | Αυτόματος επανυπολογισμός |
| `INV_005` | Λάθος κατηγορία χαρακτηρισμού | Ελέγξτε classification |
| `INV_006` | Διπλότυπο παραστατικό | Ήδη submitted — MARK υπάρχει |
| `INV_007` | Μη έγκυρη ημερομηνία | Ημερομηνία εκτός τρέχουσας περιόδου |

---

## 15. Security

### 15.1 API Key Storage

- **Firestore**: Encrypted at rest (Firebase default)
- **Vercel env**: `MYDATA_SUBSCRIPTION_KEY` (αν server-side only)
- **ΔΕΝ** αποθηκεύουμε σε client-side code ή localStorage
- API calls γίνονται **μόνο server-side** (Next.js API routes)

### 15.2 Rate Limiting

- ΑΑΔΕ API: Δεν δημοσιεύει official rate limits
- Εφαρμογή: Max **10 requests/minute** (defensive)
- Batch support: Μέχρι **50 invoices** ανά SendInvoices call

### 15.3 Audit Trail

- Κάθε request/response αποθηκεύεται στο `mydata_submissions`
- **XML payloads** αποθηκεύονται πλήρη (για debugging & compliance)
- Retention: Τουλάχιστον **5 χρόνια** (φορολογικός κανόνας)

---

## 16. UI Pages

| Route | Σελίδα | Λειτουργία |
|-------|--------|------------|
| `/accounting/mydata` | Dashboard | Κατάσταση αποστολών, pending, errors |
| `/accounting/mydata/submissions` | Ιστορικό | Όλες οι αποστολές (audit trail) |
| `/accounting/mydata/received` | Εισερχόμενα | Λαμβανόμενα — χαρακτηρισμός |
| `/accounting/mydata/settings` | Ρυθμίσεις | API key, environment, auto-submit |
| `/accounting/mydata/reconciliation` | Αντιστοίχιση | Σύγκριση app vs ΑΑΔΕ |

### 16.1 Dashboard Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  myDATA — Κατάσταση          Φεβ 2026                      │
│─────────────────────────────────────────────────────────────│
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │  ✅ Accepted  │ │  ⏳ Pending   │ │  ❌ Errors    │        │
│  │     42       │ │      2       │ │      0       │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
│  ΤΕΛΕΥΤΑΙΕΣ ΑΠΟΣΤΟΛΕΣ                                      │
│  ─────────────────────────────                              │
│  ✅ Α-042 │ ΤΠΥ  │ 500,00€ │ MARK: 4000123456 │ 15/01     │
│  ✅ Α-043 │ ΤΠ   │2.500,00€│ MARK: 4000123457 │ 22/01     │
│  ⏳ Α-044 │ ΑΠΥ  │ 200,00€ │ Pending...       │ 05/02     │
│                                                             │
│  ΕΙΣΕΡΧΟΜΕΝΑ ΓΙΑ ΧΑΡΑΚΤΗΡΙΣΜΟ: 3 νέα                      │
│  [Χαρακτήρισε →]                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 17. Environment Configuration

### 17.1 Development Flow

```
[1] Εγγραφή στο ΑΑΔΕ Developer Portal
    → Λήψη development subscription key
[2] Χρήση development endpoint
    → https://mydataapidev.aade.gr/myDATA
[3] Δοκιμαστικές αποστολές (ΔΕΝ πηγαίνουν σε production)
[4] Validation testing — έλεγχος XML schemas
```

### 17.2 Production Switch

```typescript
interface MyDataConfig {
  environment: 'development' | 'production';
  baseUrl: string;            // Auto-set based on environment
  aadeUserId: string;         // ΑΦΜ
  subscriptionKey: string;    // API key
  autoSubmit: boolean;        // Αυτόματη αποστολή μετά έκδοση
  retryEnabled: boolean;      // Retry queue ενεργό
  xmlVersion: string;         // Schema version (π.χ. '1.0.8')
}
```

---

## 18. XML Library Decision

| Βιβλιοθήκη | License | Μέγεθος | Αξιολόγηση |
|------------|---------|---------|------------|
| `fast-xml-parser` | MIT ✅ | 45KB | Γρήγορο, JS-native, XML→JSON + JSON→XML |
| `xml2js` | MIT ✅ | 50KB | Δημοφιλές, αλλά callback-based |
| `xmlbuilder2` | MIT ✅ | 120KB | Πλούσιο API, builder pattern |

**Απόφαση**: `fast-xml-parser` — MIT license, μικρό, γρήγορο, υποστηρίζει XML build & parse.

---

## 19. Dependencies

| Module | Σχέση | Περιγραφή |
|--------|-------|-----------|
| **M-001** (Company Setup) | **BLOCKED BY** | Χρειάζεται ΑΦΜ, API key |
| **M-003** (Invoicing) | **TRIGGERED BY** | Κάθε τιμολόγιο → αποστολή |
| **M-002** (Income/Expense) | **FEEDS** | Εισερχόμενα → journal entries |
| **M-005** (VAT Engine) | **READS** | VAT category per document |
| **ACC-001** (Chart of Accounts) | **READS** | Classification mapping |

---

## 20. Open Questions

| # | Ερώτηση | Status |
|---|---------|--------|
| 1 | ΑΑΔΕ Developer Portal credentials — χρειάζεται εγγραφή Γιώργου | PENDING |
| 2 | Αυτόματη αποστολή (auto-submit) ή manual confirm; | DEFAULT: auto-submit |
| 3 | XML schema version — ΑΑΔΕ ενημερώνει περιοδικά | ✅ 2026-11-09: **v2.0.2** (Σεπτ. 2026)· namespace `http://www.aade.gr/myDATA/invoice/v1.0` (αμετάβλητο). Σταθερά: `MYDATA_SPEC_VERSION` |
| 4 | Ποιος πάροχος ηλεκτρονικής τιμολόγησης; (εμπορική απόφαση) | OPEN — η πόρτα (§22) είναι ουδέτερη |
| 5 | Παρακράτηση **20%** αμοιβών ελ. επαγγελματιών → ποια κατηγορία του §8.4; | OPEN — λογιστής |
| 6 | Το **1%** της εφαρμογής («αντιπρόσωποι») — ποια περίπτωση; (§8.4: 1% = καύσιμα) | OPEN — λογιστής |
| 7 | Κωδικοί Ε3 (`classificationType`, π.χ. `E3_561_001`) ανά υπηρεσία — πηγή: `syndiasmoi_xaraktirismwn_v2.0.2.xlsx` της ΑΑΔΕ | OPEN — λογιστής |
| 8 | `totalGrossValue` με παρακράτηση = καθαρό + ΦΠΑ − παρακράτηση; (συνάγεται από §4.2.4 παρ. 5: πληρωμές = συνολική αξία) | OPEN — επιβεβαίωση στο δοκιμαστικό `mydataapidev` |
| 9 | Πεδίο φόρμας για **αιτία εξαίρεσης ΦΠΑ** (0%) — μέχρι τότε κάθε 0% μπλοκάρει | ✅ 2026-11-09 — §22.1 |

---

## 22. Στρώμα προετοιμασίας — χωρίς δίκτυο (2026-11-09)

**Απόφαση Giorgio (2026-11-09)**: η σύνδεση (myDATA και πάροχος) γίνεται **αργότερα**· ό,τι κώδικας
χρειάζεται για να είναι έτοιμη γράφεται **τώρα**. Όρια: καμία κλήση δικτύου, καμία αποθήκευση, καμία
επιλογή παρόχου.

| Αρχείο (`services/mydata/`) | Ρόλος |
|---|---|
| `mydata-codes.ts` | SSoT κωδικών ΑΑΔΕ v2.0.2 (§8.1/8.2/8.3/8.4/8.12) — μόνο μονοσήμαντες αντιστοιχίσεις· τα υπόλοιπα `null` ⇒ μπλοκάρουν |
| `mydata-payload.types.ts` | Το **κοινό** συμβόλαιο (`InvoicesDoc`, ίδια ονόματα στοιχείων με το XSD) για τα δύο κανάλια |
| `mydata-preflight.ts` | Έλεγχος πριν τη διαβίβαση → κωδικοί προβλημάτων (όχι κείμενο) |
| `mydata-payload-builder.ts` | Τιμολόγιο → payload· ποτέ payload από άκυρο τιμολόγιο. Εκδότης GR χωρίς επωνυμία/διεύθυνση, λήπτης GR χωρίς επωνυμία (§5.1 παρ. 3)· παρακράτηση κατανεμημένη ανά γραμμή |
| `transmission-channel.ts` | Πόρτα `InvoiceTransmissionChannel` (`mydata_direct` \| `einvoicing_provider`) με κλειδί ιδεμποτίας. **Αντικαθιστά** το `IMyDataService` (που δεν υλοποιήθηκε ποτέ) |
| `mydata-status-transitions.ts` | Πίνακας μεταβάσεων `MyDataDocumentStatus` + `createDraftMyDataMeta()` |
| `__tests__/fake-transmission-channel.ts` | Ντετερμινιστικό κανάλι μόνο για tests |

**Ένας γραφέας της κατάστασης myDATA.** Τα `POST /api/accounting/invoices` και `PATCH …/[id]` δέχονταν
`mydata` από τον πελάτη (schemas `.passthrough()`) ⇒ ένα πρόχειρο μπορούσε να δηλωθεί `accepted` με
ψεύτικο ΜΑΡΚ, χωρίς να φτάσει ποτέ στην ΑΑΔΕ, και να γίνει αμετάβλητο. Πλέον
`stripServerOwnedInvoiceFields()` (`invoice-schemas.ts`) το κόβει ρητά· στο POST ο διακομιστής γράφει
πάντα `createDraftMyDataMeta()`.

### 22.1 Αιτία εξαίρεσης ΦΠΑ — κατάλογος, φόρμα, PDF (2026-11-09)

**Πρόβλημα**: κάθε γραμμή 0% (κατηγορία 7) μπλόκαρε τη διαβίβαση (`VAT_EXEMPTION_MISSING`), επειδή το
`InvoiceLineItem.vatExemptionCategory` δεν είχε πεδίο φόρμας· και ο ν. 4308/2014 άρθρο 9 απαιτεί το τιμολόγιο
να **παραπέμπει στη διάταξη** της απαλλαγής — το PDF δεν έγραφε καμία.

**Πηγές (επαληθευμένες)**: ΑΑΔΕ *myDATA v2.0.2* §8.3 (κατά λέξη, 31 κωδικοί με δύο στήλες: ν. 2859/2000 και
ν. 5144/2024)· κωδικοποιημένος Κώδικας ΦΠΑ της ΑΑΔΕ (04/2026) για τους τίτλους άρθρων· ν. 5144/2024 σε ισχύ από
**11/10/2024** (ΦΕΚ Α' 162). ⚠️ Πίνακες τρίτων (invoicemaker, SingularLogic) **διαφωνούν μεταξύ τους**
(π.χ. κωδ. 16) — απορρίφθηκαν.

| Αρχείο | Ρόλος |
|---|---|
| `services/config/vat-exemption-reasons.ts` | **Ο ΕΝΑΣ κατάλογος**: κωδικός + ομάδα (μόνο ταυτότητες)· `vatCodeEditionAt(issueDate)` · `vatExemptionCitation(t, code, issueDate)` — μία συνάρτηση για φόρμα, καρτέλα και PDF |
| `i18n/locales/{el,en}/accounting-vat-exemptions.json` | Το κείμενο: διατύπωση ΑΑΔΕ ανά έκδοση (`legacy`/`current`), τίτλος άρθρου, ομάδες. Namespace λεξιλογίου τομέα, πρότυπο `accounting-tax-offices` |
| `mydata-codes.ts` | `isValidMyDataVatExemption` = μέλος του καταλόγου (όχι πια εύρος 1–31)· `requiresVatExemption` · `isVatExemptionMissing` — **ένας κανόνας** για φόρμα και `mydata-preflight.ts` |
| `shared/vat-rate-transition.ts` (ήταν `invoices/forms/invoice-line-vat.ts`, §22.3) | Μετάβαση συντελεστή: εκτός 0% η αιτία γίνεται `null` — από επιλογέα **και** από preset |
| `shared/VatExemptionReasonField.tsx` | Radix Select ομαδοποιημένο (μόνο στο 0%), `aria-invalid` + μήνυμα όσο λείπει· `VatExemptionLineNote` στην καρτέλα τιμολογίου |
| `pdf/invoice-pdf-vat-exemption.ts` | Ενότητα κάτω από τα σύνολα: «Γραμμές 1, 2: Χωρίς ΦΠΑ - άρθρο 44 του Κώδικα ΦΠΑ (ν. 5144/2024)» — `createBundleTranslate` στη γλώσσα του **εγγράφου** (το PDF φτιάχνεται και στον διακομιστή) |

**Αποφάσεις**: (α) Η διάταξη που τυπώνεται ακολουθεί την **ημερομηνία έκδοσης** — ίδιος κωδικός ΑΑΔΕ, άλλο άρθρο.
(β) ~~**Καμία προσυμπλήρωση**~~ — **αντικαταστάθηκε από τη §22.4** (2026-11-09: η εταιρεία δηλώνει πλέον ποια απαλλαγή): το `vatRegime: 'exempt'` της εταιρείας δεν λέει **ποια** απαλλαγή (μικρές
επιχειρήσεις ή απαλλασσόμενη δραστηριότητα) — θα ήταν μαντεψιά. (γ) ~~Ο διακομιστής **δεν** επικυρώνει ακόμη
το πεδίο~~ — **αντικαταστάθηκε από τη §22.2** (2026-11-09): οι γραμμές επικυρώνονται σε POST και PATCH.

### 22.2 Επικύρωση γραμμών και ποσών στον διακομιστή (2026-11-09)

**Πρόβλημα**: `POST /api/accounting/invoices` και `PATCH …/[id]` δέχονταν `lineItems: z.array(z.record(z.unknown()))`
⇒ αποθηκευόταν οτιδήποτε: άγνωστος συντελεστής, κωδικός αιτίας εκτός §8.3 ή σε γραμμή 24%, λάθος καθαρό. Η ίδια ρίζα
(«ο διακομιστής εμπιστεύεται ποσά του πελάτη, ο υπολογισμός ποσών σε τέσσερα αντίγραφα») έκρυβε δύο σφάλματα:
1. **Όριο πίστωσης νεκρό**: ο έλεγχος άθροιζε `lineItems[].grossAmount` — πεδίο που **καμία** γραμμή δεν έχει ⇒ 0 €
   πάντα, το όριο δεν μπλόκαρε ποτέ (το test το «επιβεβαίωνε» στέλνοντας γραμμή `{ grossAmount: 500 }`).
2. **Λανθάνον `NET_TOTAL_MISMATCH` / `VAT_TOTAL_MISMATCH`**: η φόρμα άθροιζε **αστρογγύλευτα** καθαρά, ο preflight
   ελέγχει το άθροισμα των **στρογγυλεμένων** `line.netAmount` ⇒ τιμολόγιο μπορούσε να μπλοκάρει για ένα λεπτό.

**Αρχή** (πρακτική ERP — απόφαση Giorgio): **ένας υπολογισμός ποσών, τον ξανατρέχει ο διακομιστής**· ό,τι παράγωγο
στέλνει ο πελάτης πρέπει να **ισούται** με αυτόν, αλλιώς **400 με ακριβή διαδρομή** (`lineItems.2.vatExemptionCategory`,
`totalVatAmount` + αναμενόμενη τιμή). Ασυνεπή φορολογικά δεδομένα **ποτέ** δεν διορθώνονται σιωπηλά.

| Αρχείο | Ρόλος |
|---|---|
| `utils/invoice-amounts.ts` | **Ο ΕΝΑΣ υπολογισμός**: `lineNetAmount` · `lineVatAmount` (μετακόμισε από τον preflight) · `invoiceAmountsOf` → σύνολα + ανάλυση ΦΠΑ, όλα αθροίσματα **στρογγυλεμένων γραμμών** (σημασιολογία myDATA). Αναγνώστες: φόρμα, προεπισκόπηση, διακομιστής, preflight, payload builder |
| `api/accounting/invoices/invoice-schemas.ts` | `InvoiceLineItemSchema` (`satisfies z.ZodType<InvoiceLineItem>`): συντελεστής ∈ `GREEK_VAT_RATES`, `mydataCode` ∈ `MYDATA_INCOME_TYPES`, αιτία ∈ κατάλογο §8.3, αιτία **μόνο** όπου `requiresVatExemption`, `netAmount` = `lineNetAmount`. `refineInvoiceAmounts`: γραμμές ⇒ σύνολα υποχρεωτικά και ίσα· σύνολα χωρίς γραμμές ⇒ απόρριψη· ανάλυση ΦΠΑ ίση (ανεξαρτήτως σειράς). ≤ `MAX_INVOICE_LINES` (500). Κοινό σε POST/PATCH |
| `types/common.ts` | Ρίζα `MYDATA_INCOME_TYPES`· ο τύπος `MyDataIncomeType` παράγεται από αυτήν |
| `invoices/route.ts` | Όριο πίστωσης από `invoiceAmountsOf(lineItems).totalGrossAmount` — υπολογισμένο, όχι δηλωμένο |
| `InvoiceForm.tsx` · `InvoicePreview.tsx` | Διαβάζουν το SSoT (τρία αντίγραφα αφαιρέθηκαν) |

**Αποφάσεις**: (α) Γραμμή 0% **χωρίς** αιτία **αποθηκεύεται** (πρόχειρο)· τη μπλοκάρει ο preflight στη διαβίβαση.
(β) Άγνωστα πεδία γραμμής **κόβονται** (zod strip) — το σχήμα είναι το συμβόλαιο. (γ) Ο διακομιστής **ελέγχει** τα
σύνολα· **δεν** τα γράφει ακόμη ο ίδιος (ούτε `balanceDue`/`withholdingAmount`). (δ) `sales-accounting-bridge` και
`reversal-service` γράφουν απευθείας στο repository, όχι μέσω API — εκτός εμβέλειας.

### 22.3 Αιτία εξαίρεσης στην υπηρεσία (`ServicePreset`) (2026-11-09)

**Πρότυπο** (NetSuite tax code με αιτιολόγηση · Xero default tax ανά είδος): η αιτία απαλλαγής **δηλώνεται μία φορά
στην υπηρεσία** και η γραμμή την κληρονομεί — δεν επιλέγεται σε κάθε τιμολόγιο.

| Αρχείο | Ρόλος |
|---|---|
| `types/invoice.ts` | `ServicePreset.vatExemptionCategory?: number \| null` |
| `components/shared/vat-rate-transition.ts` | `withVatRate` / `withVatExemption` — **γενικές** (`VatBearing`): ο ίδιος κανόνας για γραμμή, preset και κατάσταση φόρμας. Μετακόμισε από `invoices/forms/invoice-line-vat.ts` |
| `mydata-codes.ts` | `hasVatExemptionContradiction` — **ένας** κανόνας αντίφασης για τον διακομιστή: γραμμές (`invoice-schemas.ts`) **και** presets |
| `api/accounting/setup/presets/route.ts` | Κωδικός ∈ §8.3 και όχι αντίφαση, αλλιώς 400· αποθήκευση `?? null` |
| `components/setup/PresetVatFields.tsx` | Συντελεστής + αιτία (μόνο στο 0%), παραπομπή του νόμου που ισχύει σήμερα (`accountingToday`) — σε προσθήκη **και** επεξεργασία (η επεξεργασία δεν είχε επιλογέα ΦΠΑ) |
| `ServicePresetsSection.tsx` | Η γραμμή προβολής preset 0% δείχνει `VatExemptionLineNote` (παραπομπή ή «λείπει») |
| `LineItemsEditor.tsx` | `applyPreset`: συντελεστής **και** αιτία από την υπηρεσία· καθαρό + ποσά γραμμής από `invoice-amounts.ts` (δύο ακόμη αντίγραφα αφαιρέθηκαν) |

**Αποφάσεις**: (α) Υπηρεσία 0% **χωρίς** αιτία αποθηκεύεται (σημάδι «λείπει»), όπως το πρόχειρο τιμολόγιο. (β) Υπηρεσία
χωρίς αιτία **δεν σβήνει** αιτία που ο χρήστης διάλεξε ήδη στη γραμμή 0% — σιωπή ≠ «καμία αιτία». (γ) Υπηρεσία με
συντελεστή ≠ 0% καθαρίζει την αιτία της γραμμής (ίδια μετάβαση με τον επιλογέα).

### 22.4 Δηλωμένη απαλλαγή της επιχείρησης (2026-11-09)

**Πρόβλημα**: το προφίλ είχε μόνο `vatRegime: 'normal' | 'exempt'` — **όχι ποια** απαλλαγή — γι' αυτό η §22.1(β)
απαγόρευσε κάθε προσυμπλήρωση: η απαλλασσόμενη επιχείρηση ξεκινούσε κάθε γραμμή στο 24% και διάλεγε αιτία με το χέρι
σε κάθε τιμολόγιο. Επιπλέον ο `PUT /api/accounting/setup` **δεν επικύρωνε** το `vatRegime` (αποθηκευόταν οτιδήποτε).
⚠️ Το `'common'` του `company-profile-field-mask.ts` είναι `FieldScope` της μάσκας, **όχι** τιμή του `vatRegime` — καμία
ασυμφωνία λεξιλογίου.

**Πρότυπο** (Xero default tax rate / NetSuite default tax code του οργανισμού): η απαλλαγή **δηλώνεται μία φορά στο
προφίλ** και η **νέα** γραμμή ξεκινά 0% + αυτή την αιτία· η γραμμή μένει ελεύθερη, η υπηρεσία (§22.3) υπερισχύει.

**Πηγή**: [Οδηγός ΑΑΔΕ 29/01/2026](https://www.aade.gr/sites/default/files/2026-01/odigos_mikr_epixeiriseon.pdf) —
από 1/1/2025 το καθεστώς μικρών επιχειρήσεων είναι τα άρθρα **44–44ζ** ν. 5144/2024 (εγχώριο **44α**, όριο 10.000 €·
Α.1011/2026). Ο κωδικός myDATA **15** παραμένει. «Απαλλασσόμενη» ≠ «μικρή επιχείρηση» (π.χ. κωδ. 7, άρθρο 27) ⇒ ο
επιλογέας δείχνει **όλο** τον κατάλογο, **καμία** μαντεψιά του 15.

| Αρχείο | Ρόλος |
|---|---|
| `types/company.ts` | Ρίζα `COMPANY_VAT_REGIMES` (ο τύπος `CompanyVatRegime` παράγεται)· `vatExemptionCategory?: number \| null` |
| `services/setup/company-vat-regime.ts` | **Ο ΕΝΑΣ κριτής**: `companyLineVatDefault` (καθεστώς → αφετηρία γραμμής) · `withVatRegime` (σε κανονικό η αιτία καθαρίζει) · `parseCompanyVatRegime` (είσοδος PUT: άγνωστο καθεστώς / κωδικός εκτός §8.3 / αντίφαση ⇒ 400). Η αντίφαση κρίνεται από τον **ίδιο** `hasVatExemptionContradiction` των γραμμών και των presets |
| `services/config/vat-rates.ts` | `GREEK_EXEMPT_VAT_RATE` — η γραμμή `exempt_0` του πίνακα (φρουρός στο test) |
| `company-profile-field-mask.ts` | `vatExemptionCategory: 'common'` (εξάντληση από κατασκευή) |
| `api/accounting/setup/route.ts` | `parseCompanyVatRegime` πριν από κάθε εγγραφή· αποθήκευση `?? null` |
| `components/setup/FiscalInfoSection.tsx` | Επιλογές από τη ρίζα· στο `exempt` το **υπάρχον** `VatExemptionReasonField` + εξήγηση |
| `invoices/forms/invoice-line-defaults.ts` | `newInvoiceLineItem(n, vat)` μέσω `withVatRate`/`withVatExemption` · `isPristineInvoiceLine` · `reseedPristineInvoiceLines` |
| `LineItemsEditor.tsx` · `InvoiceForm.tsx` | Prop `lineVatDefault` (υποχρεωτικό)· `useCompanyLineVatDefault` |

**Αποφάσεις**: (α) Απαλλασσόμενη **χωρίς** κωδικό αποθηκεύεται· οι γραμμές ξεκινούν 0% **χωρίς** αιτία και τις
μπλοκάρει ο preflight — ποτέ σιωπηλή συμπλήρωση. (β) **Race**: η φόρμα φτιάχνει την πρώτη γραμμή πριν φτάσει το
προφίλ· όταν φτάσει, αλλάζουν **μόνο οι ανέγγιχτες** γραμμές (βαθιά ισότητα με τη νέα γραμμή της προηγούμενης
αφετηρίας) — ό,τι άγγιξε ο άνθρωπος μένει, και η **επεξεργασία** τιμολογίου δεν αλλάζει ποτέ. (γ) Το
διασυνοριακό καθεστώς (ΑΦΜ με επίθεμα «-EX» σε κάθε τιμολόγιο, Οδηγός ΑΑΔΕ) **εκτός εμβέλειας**.

### 22.5 Πρόταση μεταχείρισης ΦΠΑ από τον πελάτη — τόπος παροχής υπηρεσιών (2026-11-09)

**Πρόβλημα**: για πελάτη ΕΕ ή εκτός ΕΕ ο χρήστης έπρεπε να ξέρει μόνος του ότι ο ΦΠΑ είναι 0%, ποια αιτία και ποιος
τύπος παραστατικού ισχύουν — και ο επιλογέας τύπου **δεν πρόσφερε καν** τους 2.2/2.3. Επιπλέον το `CustomerSelector`
**δεν είχε πεδίο χώρας** (η χώρα ερχόταν μόνο από την επαφή), το ΑΦΜ είχε `maxLength=9` (δεν χωρά ΑΦΜ ΦΠΑ ΕΕ), και το
λεξιλόγιο χωρών (ADR-332) είχε μόνο 8 από τα 27 κράτη μέλη.

**Πρότυπο** (Xero «tax rate by contact» · NetSuite tax determination): εδώ **πιο έξυπνα** — καμία χειρόγραφη ρύθμιση
ανά επαφή που παλιώνει· η μεταχείριση **παράγεται** από τα γεγονότα που ήδη υπάρχουν (χώρα + ΑΦΜ) και φτάνει ως
**πρόταση με πηγή**, ποτέ ως σιωπηλή εφαρμογή — ο τόπος παροχής είναι νομική κρίση.

**Πηγές (επαληθευμένες)**:
- ν. 5144/2024 **άρθρο 18** (κωδικοποίηση ΑΑΔΕ 04/2026, [n.5144_2024.pdf](https://www.aade.gr/sites/default/files/2026-04/n.5144_2024.pdf)):
  §2α (λήπτης υποκείμενος ⇒ τόπος εγκατάστασης του λήπτη) · §2β (μη υποκείμενος ⇒ έδρα του παρόχου) · §1β (νομικό
  πρόσωπο με ΑΦΜ ΦΠΑ = υποκείμενος ⇒ **τεκμήριο** = δηλωμένο ΑΦΜ) · **§4** (υπηρεσίες σχετικές με **ακίνητα** —
  αρχιτέκτονες, επίβλεψη — ⇒ τόπος του ακινήτου: **κρίσιμη επιφύλαξη για τεχνική εταιρεία**) · §15 (μη υποκείμενος
  εκτός ΕΕ ⇒ εκτός Ελλάδας **μόνο** για σύμβουλους, μηχανικούς, γραφεία μελετών, δικηγόρους, λογιστές κ.λπ.).
- Κωδικός §8.3 **4** («Χωρίς ΦΠΑ - άρθρο 14 → 18», ήδη στον κατάλογο §22.1).
- myDATA REST API **v2.0.1** ([official_erp.pdf](https://www.aade.gr/sites/default/files/2026-03/myDATA%20API%20Documentation%20v2.0.1_official_erp.pdf)),
  σφάλματα **243** («χώρα … πρέπει να είναι στην Ευρώπη αλλά όχι στην Ελλάδα») / **244** («δεν πρέπει να είναι στην
  ΕΕ») / **287** ⇒ ο τύπος (2.2/2.3) πρέπει να συμβαδίζει με τη χώρα — γι' αυτό προτείνεται **μαζί**.
- ⚠️ **Ειλικρίνεια**: η ΑΑΔΕ **δεν** δημοσιεύει πίνακα «τύπος 2.2 → αιτία 4». Η αντιστοίχιση προκύπτει από το άρθρο
  18 και επιβεβαιώνεται από πρακτικό οδηγό λογισμικού (Epsilon Net)· αν η ΑΑΔΕ δημοσιεύσει κάτι άλλο, αλλάζει
  **μία** σταθερά (`PLACE_OF_SUPPLY_EXEMPTION_CODE`).

| Αρχείο | Ρόλος |
|---|---|
| `services/config/eu-member-states.ts` | **Ρίζα** των 27 κρατών μελών (ISO alpha-2, `GR` — **όχι** `EL`, που είναι πρόθεμα VIES)· `isEuMemberState` |
| `utils/address/country-codes.ts` + `common:countries.*` | +19 κράτη μέλη στο λεξιλόγιο χώρας (ADR-332) — επιλέξιμα σε τιμολόγιο **και** σε διευθύνσεις επαφών |
| `services/tax/customer-vat-treatment.ts` | **Ο ΕΝΑΣ κριτής** (καθαρός): `assessCustomerVatTreatment(customer, type)` → `suggestion` / `unknown_country` / `none`. Επιστρέφει **ταυτότητες** (σενάριο `eu_business`/`non_eu_business`/`non_eu_consumer`, κωδ. 4, τύπος, βάση `art18_2a`/`art18_15`, επιφυλάξεις), ποτέ κείμενο — κοινός για φόρμα και (αργότερα) preflight. `lineVatDefaultOf` · `customerVatSuggestionKey` |
| `invoices/forms/customer-vat-application.ts` | `planCustomerVatApplication` — **μία** συνάρτηση για προεπισκόπηση **και** εφαρμογή (μέσω των υπαρχόντων `withVatRate`/`withVatExemption`)· `revertCustomerVatApplication` — αναίρεση **χωρίς απώλεια**: επαναφέρει μόνο γραμμές που άλλαξε η εφαρμογή και κρατούν ακόμη τον ΦΠΑ της |
| `invoices/forms/use-customer-vat-suggestion.ts` | Κατάσταση: απόρριψη ανά ταυτότητα (αλλάζει χώρα/ΑΦΜ ⇒ ξαναβγαίνει) · εφαρμογή · αναίρεση· αποδεκτή πρόταση ⇒ αφετηρία **νέων** γραμμών |
| `invoices/forms/CustomerVatSuggestionNotice.tsx` | `<aside role="status">`: σενάριο · παραπομπή (`vatExemptionCitation`, ίδια με το PDF) · παράγραφος άρθρου 18 · επιφυλάξεις · **ακριβής προεπισκόπηση** («Γραμμές 1, 3: …», «Τύπος: ΤΠΥ → ΤΠΥ Ενδοκοινοτικό») · Εφαρμογή / Απόρριψη / Αναίρεση |
| `invoices/forms/use-company-line-vat-default.ts` | Το `useCompanyLineVatDefault` της §22.4, **μεταφερμένο αυτούσιο** (το `InvoiceForm.tsx` ήταν 490/500 γραμμές) |
| `CustomerSelector.tsx` | Επιλογέας χώρας (Radix, `ADDRESS_COUNTRY_OPTIONS`)· χώρα επαφής ως **κωδικός**· `maxLength=9` και μοναδικότητα ΑΦΜ **μόνο** για ελληνικό πελάτη |
| `InvoiceForm.tsx` | Επιλογέας τύπου από τη ρίζα `INVOICE_TYPES` (εμφανίζονται 2.2/2.3)· `lineVatDefault` = αποδεκτή πρόταση πελάτη, αλλιώς εταιρεία |

**Αποφάσεις** (Giorgio 2026-11-09): (α) **Ποτέ σιωπηλή εφαρμογή** — μόνο με πάτημα, μετά από προεπισκόπηση, με
αναίρεση. (β) **Προτεραιότητα** γραμμή > υπηρεσία (§22.3) > πελάτης > εταιρεία (§22.4): η εφαρμογή **δεν αγγίζει**
γραμμή που έχει ήδη 0% **με** αιτία. (γ) Ιδιώτης ΕΕ ⇒ **καμία** πρόταση (§2β, ελληνικός ΦΠΑ). (δ) Ιδιώτης εκτός ΕΕ ⇒
πρόταση **με όρο** §15. (ε) Άγνωστη χώρα ⇒ ένδειξη, **καμία μαντεψιά**. (στ) Το ΑΦΜ είναι **δηλωμένο**, όχι
επαληθευμένο — το VIES (δίκτυο) εκτός εμβέλειας, και η πρόταση το λέει. (ζ) **Μόνο υπηρεσίες**: ενδοκοινοτική
παράδοση (κωδ. 14) / εξαγωγή (κωδ. 8) θέλουν τύπους 1.2/1.3 που η εφαρμογή **δεν** εκδίδει ⇒ `sales_invoice` χωρίς
πρόταση· το πιστωτικό ακολουθεί το αρχικό. (η) Περιοχές εκτός φορολογικού εδάφους ΦΠΑ (Άγιον Όρος, Κανάρια)
**δεν** μοντελοποιούνται — άλλος ένας λόγος που είναι πρόταση.

**Εκτός εμβέλειας**: έλεγχος VIES · ένδειξη «Αντίστροφη επιβάρυνση» στο PDF του 2.2 (θέλει έρευνα ν. 4308/2014) ·
τύποι 1.2/1.3 · ίχνος της απόφασης (πρόταση/αποδοχή) στο τιμολόγιο · το `resolveCustomer` της γέφυρας πωλήσεων
γράφει πάντα `country: 'GR'`.

### 22.6 Αιτία εξαίρεσης → EN 16931: κατηγορία ΦΠΑ (UNCL5305) + VATEX (2026-11-10)

**Πρόβλημα**: η ηλεκτρονική τιμολόγηση (πάροχοι B2B, B2G Peppol, και η λήψη `/EN16931` που η ΑΑΔΕ υποχρεώνει τον πάροχο
να σερβίρει — myDATA v2.0.2) δεν μιλά §8.3 αλλά EN 16931: **BT-118/151** κατηγορία (UNTDID 5305), **BT-121** κωδικός
VATEX, **BT-120** κείμενο. Οι 31 αιτίες δεν είχαν καμία αντιστοίχιση.

**Πηγές (επαληθευμένες, 2026-11-10)**:
- ΑΑΔΕ myDATA REST API **v2.0.2** (ERP + Πάροχοι, 09/2026) και σελίδα τεχνικών προδιαγραφών: **καμία** αντιστοίχιση
  §8.3 → VATEX / UNCL5305 — μόνο η υποχρέωση λήψης `/EN16931`.
- ΓΓΠΣ, *Ελληνικός μορφότυπος PEPPOL BIS 3.0 (CIUS) v8.1* (03/10/2025), σελ. 77–92: η αντιστοίχιση γίνεται «κατά
  περίπτωση» με τον νόμο και την Οδηγία 2006/112· το VATEX «δεν καλύπτει ολοκληρωτικά» τις απαλλαγές· όπου δεν υπάρχει
  ακριβής αντιστοίχιση ⇒ **BT-118=O, BT-121=VATEX-EU-O**, η ελληνική διάταξη στο BT-120· στο B2G το BT-121 είναι
  υποχρεωτικό. Ο πίνακας VATEX εκεί είναι παλαιότερος (λείπουν 135-1, 144, 146-1E, 153, 159).
- Ευρωπαϊκή Επιτροπή, *VATEX code list* **v9.0** (δημοσίευση 12/10/2026, ισχύς 15/11/2026): 62 κωδικοί `eu`· εθνικοί
  μόνο `FR` — **κανένας ελληνικός**.
- OpenPeppol BIS Billing 3.0: **PEPPOL-EN16931-P0104…P0111** (VATEX → κατηγορία: G→G, O→O, IC→**K**, AE→AE, D/F/I/J→E)·
  EN 16931-1 **BR-O-02** (κατηγορία O ⇒ **χωρίς** ΑΦΜ πωλητή/αγοραστή), **BR-O-11/12** (το O αποκλείει κάθε άλλη
  κατηγορία), **BR-G-02** (G ⇒ **με** ΑΦΜ πωλητή), BR-AE-02 / BR-IC-02 (ταυτοποίηση αγοραστή), BR-x-10 (αιτία).
- Ευρωπαϊκή Επιτροπή, *Technical guidance for tax codes in EN 16931* **v1** (TAG eInvoicing, 2024-07-01 —
  ενημερωτικός, όχι δεσμευτικός): #1 γενική απαλλαγή ⇒ **E** + VATEX που κρίνει ο πωλητής· #4 εξαγωγές «goods **and
  services**» εκτός ΕΕ (και ΕΟΧ / Ελβετία) ⇒ **G + VATEX-EU-G**, χωρίς ΑΦΜ αγοραστή· #5 χρηματοοικονομικές ⇒ E +
  VATEX-EU-135-1· #6 περιθώριο ταξιδιωτικών ⇒ **E** (εκτός ΕΕ VATEX-EU-309· εντός ΕΕ προτείνει `VATEX-EU-306`, ⚠️ που
  **δεν υπάρχει** στον κατάλογο v9 ⇒ BR-CL-22 θα απέρριπτε — **δεν** εκπέμπεται, αρκεί το BT-120).
- Πρακτική: Oracle NetSuite — κατηγορία + VATEX **πάνω στον φορολογικό κωδικό**, πολλοί κωδικοί ανά ποσοστό όταν αλλάζει
  το VATEX· ρητή εφεδρεία (`SG_UNDEF`) αντί για σιωπηλή.

⚠️ **Η σύγκρουση που καθόρισε τον σχεδιασμό**: η εφεδρεία «O» της ΓΓΠΣ είναι ασύμβατη με τα BR-O-02 / BR-O-11 για
πωλητή με ΑΦΜ ΦΠΑ (κάθε ελληνική επιχείρηση). Γι' αυτό **δεν** μπαίνει στα δεδομένα· εφαρμόζεται μόνο στο προφίλ B2G,
**σημαδεμένη**.

| Αρχείο | Ρόλος |
|---|---|
| `services/config/en16931-vat-codes.ts` | **Ρίζα** (όπως το `eu-member-states.ts`): κατηγορίες UNCL5305 του EN 16931 · VATEX v9 (`VatexCode`) · δεσμός P0104–P0111 **ως τύπος** (`VatexCodeFor<C>`: λάθος ζεύγος = σφάλμα μεταγλώττισης) · `EN16931_CATEGORY_RULES` (BR-x-02/05/10/11 ως δεδομένα, με τα ids των κανόνων) |
| `services/config/vat-exemption-reasons.ts` | **Επέκταση** του ΕΝΟΣ καταλόγου: `en16931` σε κάθε αιτία — `fixed` (κατηγορία + VATEX + `fidelity`) · `byCustomerScenario` · `unmapped`· `en16931MappingOf` |
| `services/tax/en16931-vat-treatment.ts` | **Ο ΕΝΑΣ επιλυτής** (καθαρός): `resolveEn16931VatTreatment(facts, profile)` → `resolved` {κατηγορία, VATEX, ακρίβεια, βάση, σενάριο, κανόνες} / `needs_review` (`unmapped` · `scenario_mismatch` · `unknown_country`). Το σενάριο από το `assessCustomerVatTreatment` (§22.5) — δεν ξαναγράφεται |

**Πίνακας** (παγωμένος στο `vat-exemption-reasons-en16931.test.ts`· αλλάζει **μόνο** μαζί με αυτή την ενότητα):

| §8.3 | Κατηγορία / VATEX | Ακρίβεια | Βάση |
|---|---|---|---|
| 1, 2 | O / EU-O | exact | εκτός πεδίου |
| 3 | O / EU-O | article | παράδοση αγαθών εκτός Ελλάδας |
| 4 | `eu_business` AE / EU-AE · `non_eu_*` G / EU-G | exact · exact | Οδηγία 44 · 196 · 226 §11α· G αντί O (BR-O-02 / BR-G-02 · οδηγός EC #4) |
| 6 | E / EU-79-C | exact | Οδηγία 79γ (σημείωση VATEX: «may be handled as such») |
| 7, 9, 10, 11, 19 | E / — | article | απαλλαγή βέβαιη, υποπαράγραφος όχι (132/135 · 155–163 · 160 · 148/151 · 346) |
| 20 | E / — | article | περιθώριο ταξιδιωτικών (Οδηγία 306 · οδηγός EC #6· 309 μόνο εκτός ΕΕ, 306 εκτός καταλόγου) |
| 23 | E / — | article | δημοπρασίες με περιθώριο (Οδηγία 333): F / I / J δένουν **όλοι** με E (P0109–P0111) |
| 8, 28 | G / EU-G | article | Οδηγία 146 / 147 (μεταφορές 148 / 146-1E: εξειδίκευση) |
| 12, 13 | E / EU-148 | article | πλοία ανοικτής θαλάσσης |
| 14 | K / EU-IC | exact | ενδοκοινοτική παράδοση (P0106) |
| 15 | E / — | exact | μικρές επιχειρήσεις (Οδηγία 284)· κανένας VATEX της ΕΕ |
| 16 | AE / EU-AE | exact | αντίστροφη επιβάρυνση εσωτερικού (P0107) |
| 22 | E / EU-F | article | περιθώριο μεταχειρισμένων (I / J: εξειδίκευση) |
| 5, 17, 18, 21, 24, 25, 26, 27, 29, 30, 31 | unmapped | — | χρόνος · κατ' αποκοπή · αγρότες · καπνά · ακίνητα · ΠΟΛ · λοιπά · OSS/IOSS (ΦΠΑ οφειλόμενος αλλού ≠ απαλλαγή· καμία επίσημη πηγή — μόνο εσωτερική αντιστοίχιση παρόχου σε E, που **δεν** υιοθετήθηκε) |

**Αποφάσεις** (Giorgio 2026-11-10: «όπως οι μεγάλοι παίκτες, και πιο έξυπνα»): (α) **Ένας κατάλογος** — η αντιστοίχιση
είναι ιδιότητα της αιτίας (πρότυπο NetSuite). (β) **Κατά σενάριο** — η αιτία 4 λύνεται από τον κριτή της §22.5, χωρίς
πολλαπλούς κωδικούς ανά ποσοστό. (γ) **Ακρίβεια ανά γραμμή** (`exact` / `article` / `unmapped`) — ό,τι δεν ξέρουμε δεν
γίνεται «O». (δ) **Δύο προφίλ**: `en16931` (καθαρό) και `gr-b2g-peppol` (εφεδρεία ΓΓΠΣ μόνο σε κενό VATEX, με `basis:
'gsis_fallback'` και `supersededCategory`)· αντίφαση/άγνωστη χώρα **ποτέ** δεν καλύπτονται από εφεδρεία. (ε) BT-120 = η
υπάρχουσα `vatExemptionCitation` — καμία νέα πηγή κειμένου.

**Εκτός εμβέλειας**: σειριοποιητής UBL · ένδειξη «Αντίστροφη επιβάρυνση» στο PDF (Οδηγία 226 §11α) · εξειδίκευση
υποπαραγράφου (132-1x, 148-x, I/J) ανά γραμμή/υπηρεσία · κωδικοί δήλωσης ΦΠΑ (→ **§22.7**) · VIES.

### 22.7 Αιτία εξαίρεσης → δήλωση ΦΠΑ: πεδίο Φ2 του εκδότη + χαρακτηρισμός ΦΠΑ του λήπτη (2026-11-10)

**Πρόβλημα**: η προσυμπλήρωση της δήλωσης ΦΠΑ από το myDATA είναι **δεσμευτική** (από 1/1/2024)· η αξία μιας γραμμής 0%
πάει σε πεδίο εκροών του Φ2 ανάλογα με την αιτία, και όταν ο **λήπτης** χαρακτηρίζει το ίδιο παραστατικό, η αιτία 16
**επιβάλλει** χαρακτηρισμό (σφάλμα 317). Καμία από τις 31 αιτίες δεν είχε αντιστοίχιση.

**Πηγές (επαληθευμένες, κατεβασμένες και διαβασμένες 2026-11-10)**:
- ΑΑΔΕ myDATA REST API **v2.0.2** ERP (09/2026): §8.11 — χαρακτηρισμοί ΦΠΑ **VAT_361** εσωτερικό · 362 πάγια · 363 λοιπές
  εισαγωγές · 364 ενδοκ. αποκτήσεις · 365 ενδοκ. λήψεις υπηρεσιών · **366 λοιπές πράξεις λήπτη** · **NOT_VAT_295**· μόνο
  στον χαρακτηρισμό **εξόδων** (§5.x παρατ. 3). Σφάλματα **317** (αιτία 16 ⇒ 366) · **334** (ίδια αιτία, κατηγορία ΦΠΑ
  **24% ή 17%** = §8.2 κωδ. 1 / 4, τύπος 366) · 325–329 (συνδυασμοί κατηγορίας × αιτίας στον λήπτη) · 341.
- `syndiasmoi_xaraktirismwn_v2.0.2_0.xlsx`: **μόνο** συνδυασμοί E3 — **κανένας** VAT_ (επαληθευμένο σε όλα τα 53 φύλλα).
- Έντυπο **050 ΦΠΑ έκδοση 2025** (Α.1077/2025) + εγκύκλιος **Ε.2071/2025**: 342 ενδοκ. παραδόσεις · 345 ενδοκ. παροχές
  υπηρεσιών άρθρ. 18.2.α · 348 εξαγωγές & απαλλαγές πλοίων/αεροσκαφών · 349 λοιπές εκροές χωρίς ΦΠΑ **με** δικαίωμα
  έκπτωσης · 310 απαλλασσόμενες & εξαιρούμενες **χωρίς** δικαίωμα έκπτωσης.
- ν. 5144/2024 (κωδικοποίηση ΑΑΔΕ 04/2026): **άρθρο 35 §2** α (δραστηριότητες στο εξωτερικό) · γ (27 λδ, 29, 30, 31, 32,
  33) · β / δ (εξαιρέσεις του 27)· **44α §1** (μικρές επιχειρήσεις απαλλάσσονται από την υποβολή δήλωσης)· **45**.
- ΑΑΔΕ, *Εγχειρίδιο ηλεκτρονικού εμπορίου* (12/2023) ερ. 19: OSS ⇒ **349**. ΑΑΔΕ, *Συχνές ερωτήσεις myDATA* (02/2023):
  αιτία 22 στο **τιμολόγιο** ⇒ «χωρίς να συσχετίζεται με κωδικό της Περιοδικής ΦΠΑ».
- ⚠️ **Η ΑΑΔΕ δεν δημοσιεύει πίνακα «αιτία → πεδίο Φ2»**. Πίνακες τρίτων (Entersoft wiki, Κορρές/Taxheaven) **απορρίφθηκαν**.
  Απόφαση Giorgio: **ΑΑΔΕ + νόμος**, με πηγή και ακρίβεια ανά γραμμή.

| Αρχείο | Ρόλος |
|---|---|
| `services/config/vat-return-form.ts` | **Ρίζα**: πεδία εκροών χωρίς ΦΠΑ του Φ2 2025 ως δεδομένα (`field`, `deductible` από την επικεφαλίδα του εντύπου) |
| `services/mydata/mydata-codes.ts` | §8.11: `MYDATA_EXPENSE_VAT_CLASSIFICATIONS` · `MYDATA_SELF_ASSESSED_VAT_CATEGORIES` (σφάλμα 334) |
| `services/config/vat-exemption-reasons.ts` | **Επέκταση** του ΕΝΟΣ καταλόγου: `vatReturn: { output, recipient }` — `field` (πεδίο + ακρίβεια + πηγές) · `byCustomerScenario` · `not_filed` · `not_reported` · `unmapped`· λήπτης `required` / `by_purchase`. `MappingFidelity` γενικό (το `En16931Fidelity` είναι πλέον alias) |
| `services/tax/customer-vat-treatment.ts` | `resolveByCustomerScenario` — η **μία** γέφυρα δεδομένων ανά σενάριο προς τον κριτή της §22.5· τη χρησιμοποιούν **και** ο επιλυτής EN 16931 (το `catalogTreatment` απλοποιήθηκε, ίδια συμπεριφορά) **και** ο επιλυτής Φ2 |
| `services/tax/vat-return-treatment.ts` | **Ο ΕΝΑΣ επιλυτής**: `resolveVatReturnTreatment` (εκδότης → `resolved` / `not_filed` / `not_reported` / `needs_review`) · `recipientVatClassificationOf` (λήπτης) |

**Πίνακας** (παγωμένος στο `vat-exemption-reasons-vat-return.test.ts`· αλλάζει **μόνο** μαζί με αυτή την ενότητα):

| §8.3 | Εκδότης → Φ2 | Ακρίβεια | Πηγή |
|---|---|---|---|
| 14 | 342 | exact | πεδίο Φ2 · άρθρο 33 |
| 4 | `eu_business` 345 · `non_eu_*` 349 | exact | πεδίο Φ2 (18.2.α) · 35 §2α — σενάριο από §22.5 |
| 8, 28 | 348 | exact | πεδίο «Εξαγωγές» · 35 §2γ (άρθρο 29) |
| 12, 13 | 348 | exact | πεδίο «απαλλαγές πλοίων» · 35 §2γ (άρθρο 32) |
| 3 | 349 | article | 35 §2α |
| 9, 10 | 349 | article | 35 §2γ (άρθρα 30 / 31) |
| 16 | 349 · **λήπτης VAT_366, κατ. 1 / 4** | article · exact | 45 + ορισμός 349 · σφάλματα 317 / 334 |
| 29, 30 | 349 | exact | ΑΑΔΕ, εγχειρίδιο e-commerce ερ. 19 |
| 7 | 310 | article | άρθρο 27 χωρίς δικαίωμα έκπτωσης — **εκτός** 35 §2 β / γ(λδ) / δ, που πάνε στο 349 |
| 15 | `not_filed` | — | 44α §1 |
| 22 | `not_reported` (τιμολόγιο) | — | ΑΑΔΕ FAQ 02/2023 |
| 1, 2, 5, 6, 11, 17–21, 23–27, 31 | `unmapped` | — | καμία επίσημη πηγή· 11 = άρθρο 32 ολόκληρο (348 **ή** 349) |

Λήπτης για όλες εκτός 16: `by_purchase` — ο χαρακτηρισμός ΦΠΑ κρίνεται από τη **φύση της αγοράς** (εσωτερικό, πάγιο,
ενδοκοινοτική απόκτηση…), όχι από την αιτία του εκδότη.

**Αποφάσεις** (Giorgio 2026-11-10): (α) **Ένας κατάλογος** — η αντιστοίχιση είναι ιδιότητα της αιτίας, δίπλα στο `en16931`.
(β) **Πηγή ανά γραμμή** (`sources`, ταυτότητες) — επίσημη ΑΑΔΕ ή νόμος, ποτέ τρίτος. (γ) **Ρητές απαντήσεις χωρίς πεδίο**
(`not_filed`, `not_reported`) ≠ `unmapped`: το «δεν υπάρχει πεδίο» είναι γνώση, το «δεν ξέρουμε» είναι ανάγκη ελέγχου.
(δ) **Ο τόπος παροχής κρίνεται ΜΙΑ φορά** (`resolveByCustomerScenario`) για EN 16931 και Φ2. (ε) Οι κατηγορίες
αυτοεπιβάρυνσης ζουν στο `mydata-codes.ts` και τις επισυνάπτει ο επιλυτής — ο κατάλογος δεν εισάγει τιμή από το
`mydata-codes.ts` (που ήδη εισάγει τιμή από τον κατάλογο): **κανένας κύκλος αρχικοποίησης**.

**Εκτός εμβέλειας**: UI / ετικέτες Φ2 · υπολογισμός Φ2 στη `vat-engine` · χαρακτηρισμός εξόδων (SendExpensesClassification) ·
πεδία 313–315 (κύκλος εργασιών / αγορές, όχι αιτία) · 908 (μικτό κέρδος άρθρου 50 — αιτία 20) · Άγιον Όρος (339).
Πρώτος καταναλωτής παραγωγής: ο έλεγχος πριν την έκδοση (**§22.8**) — **ΜΗΝ** σβηστεί ως νεκρό.

### 22.8 Έλεγχος πριν την έκδοση — ένας έλεγχος, βαθμίδες, μετάβαση στο πεδίο (2026-11-10)

**Πρόβλημα**: (α) οι επιλυτές §22.6 / §22.7 έδιναν ρητό `needs_review`, αλλά **κανείς** δεν τους διάβαζε στην παραγωγή
(κίνδυνος «νεκρός κώδικας», CHECK 3.22)· (β) ο `mydata-preflight.ts` έβρισκε 14 προβλήματα που **σταματούν** τη
διαβίβαση, χωρίς **κανένα** κείμενο i18n και χωρίς να φαίνονται στη φόρμα — ο χρήστης τα μάθαινε αργά· (γ) η ΑΑΔΕ
απορρίπτει χώρα λήπτη που δεν ταιριάζει με τον τύπο (243 / 244 / 287) και κανένας τοπικός έλεγχος δεν το έπιανε.

**Πρακτική μεγάλων (έρευνα 2026-11-10)**: EN 16931 Schematron (ConnectingEurope) — κάθε κανόνας `flag="fatal"` ή
`"warning"`· SAP — μηνύματα E / W· Stripe — απορρίπτει **πριν** την οριστικοποίηση (`last_finalization_error`)· GOV.UK
*Error summary* — σύνοψη + **σύνδεσμος σε κάθε πεδίο** + ίδιο κείμενο inline (WCAG 3.3.1, G139). **Πέρα από αυτούς**:
ζωντανά καθώς γράφει (όχι μόνο στην υποβολή) και κάθε εύρημα λέει **ποιο σφάλμα ΑΑΔΕ προλαβαίνει**.

**Πηγές (επίσημες)**: myDATA REST API ERP **v1.0.9** §7 (αγγλ., 07/2024) και **v1.0.12** (11/2025): 217 «αιτία
υποχρεωτική στην κατηγορία 7» · 242 / 243 / 244 / 287 χώρα εκδότη / λήπτη «για αυτόν τον τύπο»· Παράρτημα 8.1 — 2.2
«Ενδοκοινοτική Παροχή Υπηρεσιών», 2.3 «Παροχή Υπηρεσιών σε λήπτη Τρίτης Χώρας». ⚠️ **Η ΑΑΔΕ δεν δημοσιεύει πίνακα «τύπος →
χώρα»** (ελέγχθηκαν v1.0.9 ERP, v1.0.12 ERP, v2.0.2 Providers) ⇒ ελέγχονται **μόνο** τα 2.2 / 2.3, όπου το λέει ο τίτλος.

| Αρχείο | Ρόλος |
|---|---|
| `services/invoices/review-severity.ts` | **Ρίζα** βαθμίδων `block` (δεν διαβιβάζεται) · `warn` (κρίνει ο άνθρωπος) · `info` (η εφαρμογή δεν ξέρει) |
| `services/mydata/mydata-preflight.ts` | `MYDATA_PREFLIGHT_SEVERITY` (`satisfies Record`) · `isBlockingPreflightIssue` · **`preflightMyDataDraft`** = ό,τι κρίνεται από το περιεχόμενο (όχι κατάσταση / νόμισμα / ΜΑΡΚ)· `preflightMyDataInvoice` = ζωή παραστατικού + draft, ίδια έξοδος· νέος **`COUNTERPART_COUNTRY_TYPE_MISMATCH`** (`warn`) |
| `services/mydata/mydata-payload-builder.ts` | Σταματά **μόνο** σε `block`· τα `warn` ταξιδεύουν ως `warnings` στο `ok: true` |
| `services/tax/invoice-vat-review.ts` | **Πρώτος καταναλωτής** των §22.6 / §22.7: ανά γραμμή 0% με αιτία, `needs_review` των δύο επιλυτών **ομαδοποιημένο ανά λόγο** (ένα εύρημα, `dimensions: vat_return / en16931`). `SCENARIO_MISMATCH` / `COUNTRY_UNKNOWN` = `warn`· `UNMAPPED` = `info` |
| `services/invoices/invoice-review.ts` | **Συνθέτης, χωρίς δικό του κανόνα**: `reviewInvoiceDraft` → ευρήματα με βαθμίδα, **άγκυρα** (γραμμή / πελάτης / παραστατικό / επιχείρηση — σημασιολογικά, όχι DOM), γραμμή, αιτία, διαστάσεις, σφάλματα ΑΑΔΕ (μόνο επαληθευμένα: 217 · 243/244/287)· ταξινόμηση βαθμίδα → γραμμή |
| `forms/invoice-field-ids.ts` | Η **μία** πηγή `id` πεδίων της φόρμας + άγκυρα → `id` (`CustomerSelector`, `InvoiceForm`, `LineItemsEditor` παίρνουν τα `id` από εδώ) |
| `forms/use-invoice-review.ts` | Πρόχειρο **όπως θα σταλεί** (αρίθμηση + καθαρό από `invoice-amounts.ts`)· όσο ο ΑΦΜ εκδότη είναι άγνωστος (προφίλ σε φόρτωση) το `ISSUER_VAT_INVALID` **δεν** εμφανίζεται |
| `forms/InvoiceReviewSummary.tsx` · `invoice-review-presentation.tsx` | Σύνοψη πάνω από τις ενέργειες: ομάδες ανά βαθμίδα με **σχήμα** εικονιδίου (OctagonX / TriangleAlert / Info — όχι μόνο χρώμα, ADR-771), «Μετάβαση στο πεδίο»· inline ευρήματα κάτω από την αιτία της γραμμής (`aria-describedby`)· ένα κείμενο για σύνοψη και γραμμή· σύνδεσμος λίστας από `formatList` |
| `accounting.json` el + en | `invoices.review.*` — και οι 15 κωδικοί του preflight, που δεν είχαν ποτέ κείμενο |

**Αποφάσεις** (Giorgio 2026-11-10: «όπως οι μεγάλοι, χωρίς εκπτώσεις»): (α) **Ένας πίνακας, βαθμίδες** — τα
μπλοκαρίσματα του preflight **και** οι ανάγκες ελέγχου ΦΠΑ μαζί. (β) **Καμία βαθμίδα δεν εμποδίζει την αποθήκευση**
(πρόχειρο, §22.2α / §22.4α)· `block` = «δεν θα διαβιβαστεί». (γ) Χώρα × τύπος = **`warn`**, όχι `block`, γιατί ο κανόνας
βγαίνει από τον τίτλο, όχι από επίσημο πίνακα· με επίσημη πηγή γίνεται `block` σε μία γραμμή. (δ) Βαθμίδα = ιδιότητα
του κωδικού, δηλωμένη **δίπλα** στον έλεγχό του· ο συνθέτης κάνει μόνο ένωση. (ε) Η φόρμα και η διαβίβαση ρωτούν
**τις ίδιες** συναρτήσεις.

**Εκτός εμβέλειας**: προφίλ `gr-b2g-peppol` (καμία επιλογή B2G στη φόρμα) · χαρακτηρισμός λήπτη αιτίας 16 ως `info` ·
αποθήκευση ευρημάτων στον διακομιστή · διόρθωση με ένα κλικ (υπάρχει ήδη η πρόταση §22.5 για τον τύπο) · VIES ·
ένδειξη αντίστροφης επιβάρυνσης στο PDF.

**Τι μένει για τη φάση σύνδεσης**: σειριοποίηση XML (§18), προσαρμογείς HTTP, αποθήκευση κλειδιών (§15.1),
συλλογή υποβολών + κανόνες + δείκτες, ουρά/επανάληψη με ντετερμινιστικό ID υποβολής, UI (κουμπί
αποστολής, ΜΑΡΚ/QR στο PDF), λήψη και χαρακτηρισμός εξόδων, κωδικοί Ε3 (§20 #7), επιλογή παρόχου (§20 #4).

⚠️ **Ιστορικό — γιατί ο κώδικας προετοιμασίας κινδυνεύει**: το `services/external/mydata-service.stub.ts`
της Phase 3 (§21) **διαγράφηκε ως νεκρός κώδικας** (`9a92a079`, «delete dead code — batch 9»), επειδή
κανείς δεν το εισήγαγε. Το ίδιο ισχύει για όποιο αρχείο του στρώματος δεν έχει ακόμη καταναλωτή
παραγωγής (CHECK 3.22). **ΜΗΝ** τα διαγράψεις ως «νεκρά»: είναι το έδαφος της φάσης σύνδεσης.

### 22.9 Ένδειξη «Αντίστροφη επιβάρυνση» στο PDF (2026-11-10)

**Πρόβλημα**: το PDF έγραφε μόνο την παραπομπή απαλλαγής (ν. 4308/2014 άρθρο 9 §1 **ιβ**). Τιμολόγιο 2.2 με αιτία 4
σε επιχείρηση ΕΕ, ή με αιτία 16, έβγαινε **χωρίς** την αναφορά της **ιγ** — νομικά ελλιπές παραστατικό.

**Πηγές (επίσημες, έρευνα 2026-11-10)**: ν. 4308/2014 άρθρο 9 §1 περ. ιγ — «Όταν ο λήπτης είναι υπόχρεος καταβολής του
Φ.Π.Α., η αναφορά «Αντίστροφη επιβάρυνση»» · Οδηγία 2006/112/ΕΚ άρθρο 226 §11α («Reverse charge») και άρθρο 219α §2
(στην αντίστροφη επιβάρυνση ισχύουν οι κανόνες τιμολόγησης του κράτους του **προμηθευτή** ⇒ ελληνικοί) · ΔΕΕ
**C-247/21** (Luxury Trust Automobil): η αναφορά είναι υποχρεωτική **κατά λέξη**· άλλη διατύπωση δεν την αντικαθιστά,
και η διόρθωση ισχύει μόνο ex nunc. ⚠️ Το κείμενο του EUR-Lex δεν ανακτήθηκε αυτούσιο (fetch απέτυχε)· τα 226 §11α /
219α στηρίζονται σε αναζήτηση στο eur-lex και στις επεξηγηματικές σημειώσεις της Επιτροπής (2010/45/ΕΕ).

| Αρχείο | Ρόλος |
|---|---|
| `services/tax/reverse-charge.ts` | `isReverseChargeLine` · `reverseChargeLineNumbers` — **μόνο η ερώτηση**: λήπτης υπόχρεος ⇔ ο ένας επιλυτής §22.6 δίνει κατηγορία **`AE`** (UNCL5305 «VAT reverse charge»), προφίλ `en16931`. Είσοδος = `InvoiceVatReviewInput` (ίδια facts με τον έλεγχο §22.8) |
| `services/pdf/invoice-pdf-vat-exemption.ts` | `reverseChargeNoteTexts` + κοινός `drawVatNoteBlock`: η σημείωση ΦΠΑ σχεδιάζει **πρώτα** «ΑΝΤΙΣΤΡΟΦΗ ΕΠΙΒΑΡΥΝΣΗ / REVERSE CHARGE» (περ. ιγ), μετά την παραπομπή (περ. ιβ) |
| `accounting-vat-exemptions.json` el + en | `pdf.reverseCharge.heading` / `.line` (ICU πληθυντικός γραμμών)· el περιέχει **αυτούσια** τη φράση «Αντίστροφη επιβάρυνση», en «Reverse charge» |

**Αποφάσεις**: (α) **Κανένα νέο δεδομένο** στον κατάλογο — η κατηγορία `AE` **είναι** ο ορισμός «ο λήπτης είναι
υπόχρεος»· αιτία 16 πάντα, αιτία 4 μόνο στο σενάριο `eu_business` (κρίνει ο ένας κριτής §22.5). (β) Αιτία 4 με
αντίφαση (`needs_review`) **δεν** παίρνει ένδειξη — καμία μαντεψιά· τη δείχνει ως `warn` ο έλεγχος §22.8. (γ) Η
ενδοκοινοτική παράδοση αγαθών (`K`) **δεν** είναι αντίστροφη επιβάρυνση (226 §11, όχι §11α). (δ) Η φράση
γράφεται **κατά λέξη** (C-247/21)· η δίγλωσση επικεφαλίδα ακολουθεί την υπάρχουσα «ΑΠΑΛΛΑΓΗ ΦΠΑ / VAT EXEMPTION».

**Εκτός εμβέλειας**: ένδειξη στην προεπισκόπηση της φόρμας (`InvoicePreview.tsx`) · παραπομπή άρθρου (196 Οδηγίας /
ν. 5144/2024) δίπλα στην ένδειξη — δεν επαληθεύτηκε ανά περίπτωση · πεδίο XML myDATA · προφίλ `gr-b2g-peppol`.

### 22.10 Ζωντανή επαλήθευση §22.9 + τα τρία ελαττώματα που φάνηκαν (2026-11-10)

**Επαλήθευση §22.9 στο nestorconstruct.gr** (δοκιμαστικά τιμολόγια, πρόχειρα, **χωρίς** διαβίβαση):

| Τιμολόγιο | Σενάριο | Αποτέλεσμα |
|---|---|---|
| Α-3 | 2.2 · DE · αιτία 4 | ✅ «Γραμμή 1: Αντίστροφη επιβάρυνση…» και μετά η απαλλαγή (άρθρο 18) |
| Α-4 | 2.2 · DE · αιτίες 4 + 16 | ✅ «Γραμμές 1, 2: …» (πληθυντικός) και απαλλαγή ανά γραμμή (άρθρα 18 / 45) |
| Α-5 | ΤΠΥ · GR · αιτία 15 | ✅ **Χωρίς** μπλοκ αντίστροφης επιβάρυνσης, μόνο απαλλαγή (άρθρο 44) |

**Ελαττώματα που υπήρχαν ήδη στην παραγωγή** (δεν τα έφερε η §22.9):
- **(α)** Επικάλυψη στην κεφαλίδα του PDF.
- **(β)** Η διεύθυνση του πελάτη χανόταν χωρίς οδό, και η χώρα έβγαινε ωμός κωδικός.
  - Και τα δύο: **ADR-ACC-018 §14**.
- **(γ)** Μετά από **κάθε** επιτυχή «Δημιουργία», η φόρμα πήγαινε στο `?view=undefined` («Invoice not found»).
  - Ο POST απαντά `created({ invoiceId, … })`, ενώ η φόρμα διάβαζε `result.data?.id ?? result.id`.

| Αρχείο | Ρόλος |
|---|---|
| `types/invoice.ts` | `InvoiceCreatedResponse`: **ένα** συμβόλαιο απάντησης· ο route το δηλώνει (`created<InvoiceCreatedResponse>`), η φόρμα το διαβάζει |
| `components/invoices/forms/invoice-submit.ts` | `submitInvoice(body, editInvoiceId, t)`: μέσω του **ενός** μεταφορέα `apiClient` (ξετυλίγει το `data`, πετά σε μη-2xx). Η άρνηση περνά από το ίδιο `invoiceSubmitErrorMessage` (`apiErrorBodyOf` + `statusCode`) ⇒ ίδια μηνύματα. Ο `apiClient` δεν επαναλαμβάνει POST χωρίς κλειδί ιδεμποτίας ⇒ καμία διπλή έκδοση |
| `components/invoices/details/InvoiceDetails.tsx` | «Invoice not found» / «Back» (ωμά αγγλικά, N.11) ⇒ `invoices.notFound` (νέο, el + en) / `forms.back` |

**Εκτός εμβέλειας**:
- Το `creditWarning` της απάντησης δεν το δείχνει ακόμη κανείς στη φόρμα.
- Η αχρησιμοποίητη μεταβλητή `quarter` στο `InvoiceForm.handleSubmit`.
- Η κύρια συνάρτηση του `handleSubmit` μένει > 40 γρ.

---

## 21. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-09 | ADR Created — myDATA/ΑΑΔΕ integration | Γιώργος + Claude Code |
| 2026-02-09 | XML format (mandatory — ΑΑΔΕ δεν υποστηρίζει JSON) | Claude Code |
| 2026-02-09 | XML library: `fast-xml-parser` (MIT, lightweight) | Claude Code |
| 2026-02-09 | Retry policy: 3 retries, exponential backoff (5s/15s/60s) | Claude Code |
| 2026-02-09 | Server-side only — API calls μέσω Next.js API routes | Claude Code |
| 2026-02-09 | Audit trail: Πλήρη XML payloads, retention 5+ χρόνια | Claude Code |
| 2026-02-09 | Auto income classification based on KAD + invoice type | Claude Code |
| 2026-02-09 | **Phase 1 implemented** — types/common.ts: MyDataIncomeType (4 codes), MyDataExpenseType (9 codes), MyDataDocumentStatus (5 states) | Claude Code |
| 2026-02-09 | **Phase 2 implemented** — types/mydata.ts: MyDataEnvironment, MyDataConfig, MyDataSubmissionAction, MyDataResponseStatus, MyDataError, MyDataSubmission, MyDataVatCategory (8 codes), ReceivedDocument. types/interfaces.ts: IMyDataService (submit, cancel, classify, fetch) | Claude Code |
| 2026-02-09 | **Phase 3 implemented** — services/external/mydata-service.stub.ts: `MyDataServiceStub implements IMyDataService` — all 5 methods throw "not configured" error. Awaiting ΑΑΔΕ production/test credentials from Γιώργος. Will be replaced with real REST API implementation | Claude Code |
| (μεταγενέστερα) | ⚠️ Το stub της Phase 3 **διαγράφηκε** ως νεκρός κώδικας (`9a92a079`)· το `IMyDataService` έμεινε χωρίς υλοποίηση και χωρίς καλούντα | — |
| 2026-11-09 | **Στρώμα προετοιμασίας (§22)** — χωρίς δίκτυο: κωδικοί ΑΑΔΕ v2.0.2, payload, έλεγχος πριν τη διαβίβαση, πόρτα για απευθείας myDATA **και** πάροχο, πίνακας μεταβάσεων. **Διορθώσεις** έναντι της επίσημης τεκμηρίωσης: §7 (0% = 7, όχι 8 — και στο `vat-rates.ts`), §8 (τρόποι πληρωμής), §9 (παρακρατήσεις). Αφαιρέθηκε το `IMyDataService`. **Ένας γραφέας** της κατάστασης myDATA (POST/PATCH κόβουν το `mydata` του πελάτη). Νέο προαιρετικό `InvoiceLineItem.vatExemptionCategory` | Giorgio + Claude Code |
| 2026-11-09 | **Αιτία εξαίρεσης ΦΠΑ (§22.1, κλείνει §20 #9)** — κατάλογος 31 κωδικών §8.3 (ΑΑΔΕ v2.0.2) με διάταξη ν. 2859/2000 **και** ν. 5144/2024 ανά ημερομηνία έκδοσης· πεδίο φόρμας στο 0%· ένας κανόνας «λείπει» για φόρμα και preflight· παραπομπή στο PDF (ν. 4308/2014 άρθρο 9) και στην καρτέλα. Namespace `accounting-vat-exemptions` | Giorgio + Claude Code |
| 2026-11-09 | **Επικύρωση γραμμών και ποσών στον διακομιστή (§22.2)** — σχήμα γραμμής zod κοινό σε POST/PATCH (συντελεστής, κωδικός myDATA, αιτία §8.3, αιτία μόνο στο 0%, καθαρό = ποσότητα × τιμή)· σύνολα/ανάλυση ΦΠΑ ίσα με τον **έναν** υπολογισμό `utils/invoice-amounts.ts`, αλλιώς 400 με διαδρομή. **Διορθώσεις**: όριο πίστωσης (έβλεπε πάντα 0 €) · λανθάνον `NET/VAT_TOTAL_MISMATCH` της φόρμας. Αντικαθιστά τη §22.1(γ) | Giorgio + Claude Code |
| 2026-11-09 | **Αιτία εξαίρεσης στην υπηρεσία (§22.3)** — `ServicePreset.vatExemptionCategory`, κληρονομείται από τη γραμμή στο `applyPreset`· μετάβαση συντελεστή/αιτίας γενική (`shared/vat-rate-transition.ts`)· ένας κανόνας αντίφασης (`hasVatExemptionContradiction`) για γραμμές και presets· η επεξεργασία preset απέκτησε επιλογέα ΦΠΑ | Giorgio + Claude Code |
| 2026-11-09 | **Δηλωμένη απαλλαγή της επιχείρησης (§22.4, αντικαθιστά §22.1(β))** — `vatExemptionCategory` στο προφίλ (μόνο σε `exempt`)· ένας κριτής `services/setup/company-vat-regime.ts` (αφετηρία γραμμής · μετάβαση · είσοδος PUT με 400 σε άγνωστο καθεστώς/κωδικό/αντίφαση — ο PUT δεν επικύρωνε καθόλου το `vatRegime`)· νέα γραμμή τιμολογίου 0% + αιτία· προφίλ που φτάνει μετά τη φόρμα αλλάζει μόνο ανέγγιχτες γραμμές. Πηγή: Οδηγός ΑΑΔΕ 29/01/2026 (άρθρα 44–44ζ) | Giorgio + Claude Code |
| 2026-11-09 | **Πρόταση ΦΠΑ από τον πελάτη (§22.5)** — ένας καθαρός κριτής τόπου παροχής (ν. 5144/2024 άρθρο 18 §2α/§15, επιφύλαξη §4 ακίνητα): επιχείρηση ΕΕ ⇒ 0% + κωδ. 4 + τύπος 2.2· εκτός ΕΕ ⇒ 2.3· ιδιώτης ΕΕ ⇒ καμία πρόταση. Πρόταση με πηγή και ακριβή προεπισκόπηση, **ποτέ** σιωπηλά· αναίρεση χωρίς απώλεια. Ρίζα 27 κρατών μελών· +19 χώρες στο λεξιλόγιο (ADR-332)· επιλογέας χώρας στον πελάτη· 2.2/2.3 στον επιλογέα τύπου | Giorgio + Claude Code |
| 2026-11-10 | **Αιτία εξαίρεσης → EN 16931 (§22.6)** — κατηγορία UNCL5305 + VATEX v9 σε κάθε αιτία §8.3, **μέσα** στον ένα κατάλογο (σταθερή / κατά σενάριο πελάτη / unmapped, με βαθμό ακρίβειας)· ρίζα VATEX με δεσμό κατηγορίας P0104–P0111 ως τύπο και κανόνες BR ανά κατηγορία ως δεδομένα· ένας επιλυτής με προφίλ `en16931` / `gr-b2g-peppol` (εφεδρεία ΓΓΠΣ O + VATEX-EU-O **σημαδεμένη**, λόγω σύγκρουσης με BR-O-02/11). Η ΑΑΔΕ δεν δημοσιεύει αντιστοίχιση — επαληθευμένο | Giorgio + Claude Code |
| 2026-11-10 | **Αιτία εξαίρεσης → δήλωση ΦΠΑ (§22.7)** — πεδίο εκροών Φ2 2025 (342/345/348/349/310, `not_filed`, `not_reported`, `unmapped`) και χαρακτηρισμός ΦΠΑ λήπτη (§8.11· αιτία 16 ⇒ VAT_366 με κατηγορία 24%/17%, σφάλματα 317/334) **μέσα** στον ένα κατάλογο, με πηγή (ΑΑΔΕ ή ν. 5144/2024 άρθρα 35 §2, 44α, 45) και ακρίβεια ανά γραμμή· ρίζα πεδίων Φ2· ένας επιλυτής· η κρίση τόπου παροχής έγινε κοινή (`resolveByCustomerScenario`) για EN 16931 και Φ2. Η ΑΑΔΕ δεν δημοσιεύει πίνακα «αιτία → Φ2» — επαληθευμένο | Giorgio + Claude Code |
| 2026-11-10 | **Έλεγχος πριν την έκδοση (§22.8)** — ένας πίνακας στη φόρμα τιμολογίου, ζωντανά, βαθμίδες `block` / `warn` / `info` (EN 16931 fatal/warning · SAP E/W) ως δεδομένα ανά κωδικό· συνθέτης του `mydata-preflight` (νέο `preflightMyDataDraft`) και του πρώτου καταναλωτή των §22.6/§22.7 (`invoice-vat-review`)· μετάβαση στο πεδίο (GOV.UK error summary) από μία πηγή `id`· ο builder σταματά μόνο σε `block`· νέος έλεγχος χώρας λήπτη × 2.2/2.3 (`warn` — η ΑΑΔΕ δεν δημοσιεύει πίνακα, επαληθευμένο σε v1.0.9 / v1.0.12 / v2.0.2) | Giorgio + Claude Code |
| 2026-11-10 | **Ένδειξη «Αντίστροφη επιβάρυνση» στο PDF (§22.9)** — ν. 4308/2014 άρθρο 9 §1 ιγ (Οδηγία 226 §11α · 219α §2 · ΔΕΕ C-247/21: κατά λέξη)· κριτήριο = κατηγορία `AE` του ενός επιλυτή §22.6 (αιτία 16 · αιτία 4 με επιχείρηση ΕΕ), κανένα νέο δεδομένο· μπλοκ πριν από την παραπομπή απαλλαγής, el + en | Giorgio + Claude Code |
| 2026-11-10 | **Ζωντανή επαλήθευση §22.9 + 3 ελαττώματα (§22.10)** — Α-3/Α-4/Α-5 ✅ (ενικός, πληθυντικός, κανένα μπλοκ σε GR/αιτία 15). Διορθώσεις: κεφαλίδα PDF με προϋπολογισμό στηλών και πλήρης διεύθυνση πελάτη (ADR-ACC-018 §14, ν. 4308/2014 άρθρο 9 §1 ε)· η δημιουργία τιμολογίου πηγαίνει στο σωστό id (`InvoiceCreatedResponse` + `apiClient`)· «δεν βρέθηκε» μέσω i18n | Giorgio + Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
