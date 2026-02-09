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

| myDATA vatCategory | Ποσοστό | Χρήση |
|--------------------|---------|-------|
| 1 | 24% | Κανονικό (υπηρεσίες, αγαθά) |
| 2 | 13% | Μειωμένο (τρόφιμα, ξενοδοχεία, νερό) |
| 3 | 6% | Υπερμειωμένο (φάρμακα, βιβλία, ΔΕΗ) |
| 4 | 17% | Νησιωτικό κανονικό |
| 5 | 9% | Νησιωτικό μειωμένο |
| 6 | 4% | Νησιωτικό υπερμειωμένο |
| 7 | 0% | Μηδενικό (ενδοκοινοτικές, εξαγωγές) |
| 8 | — | Εξαιρούμενο ΦΠΑ (ενοίκια, ασφάλειες, τράπεζες) |

**Γιώργος: Κανονικό ΦΠΑ 24% — χωρίς νησιωτικό, χωρίς ενδοκοινοτικές**

Πρακτικά χρησιμοποιούμε: **1** (24%), **3** (6% — ΔΕΗ), **8** (εξαιρούμενο — ενοίκιο, ασφάλεια)

---

## 8. Payment Method Mapping

| myDATA type | Τρόπος Πληρωμής | App PaymentMethod |
|-------------|-----------------|-------------------|
| 1 | Μετρητά | `cash` |
| 2 | Επιταγή | `check` |
| 3 | Τραπεζική κατάθεση / Μεταφορά | `bank_transfer` |
| 4 | Πιστωτική κάρτα | `card` |
| 5 | Επί Πιστώσει | `credit` |
| 6 | Web Banking | `bank_transfer` |
| 7 | POS / e-POS | `card` |

---

## 9. Withholding Tax Mapping

| myDATA withheldPercentCategory | Ποσοστό | Χρήση |
|-------------------------------|---------|-------|
| 1 | 20% | Αμοιβές ελ. επαγγελματιών (μηχανικοί, δικηγόροι) |
| 2 | 20% | Αμοιβές (νομικά πρόσωπα μη-κερδοσκοπικά) |
| 3 | 20% | Δικαιώματα (royalties) |
| 4 | 20% | Αμοιβές εξωτερικού |
| 5 | 3% | Αμοιβές τεχνικών έργων |
| 6 | 3% | Αμοιβές εργολάβων / υπεργολάβων |
| 10 | 10% | Επίβλεψη / Μελέτες (προκαταβολή) |
| 15 | 4% | Μελέτες / Σχέδια (προκαταβολή) |

**Γιώργος χρησιμοποιεί κυρίως:**
- **1** (20%) — Αρχιτεκτονικές υπηρεσίες σε νομικά πρόσωπα (>300€)
- **5** (3%) — Κατασκευαστικά έργα (>300€)

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
| 3 | XML schema version — ΑΑΔΕ ενημερώνει περιοδικά | NEEDS CHECK |

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

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
