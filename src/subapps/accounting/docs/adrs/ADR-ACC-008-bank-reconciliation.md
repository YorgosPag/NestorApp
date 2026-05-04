# ADR-ACC-008: Bank Reconciliation — Τραπεζική Συμφωνία

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-09 |
| **Category** | Accounting / Banking |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Parent** | [ADR-ACC-000](./ADR-ACC-000-founding-decision.md) |
| **Module** | M-009: Bank Reconciliation |

---

## 1. Context

Ο Γιώργος έχει **1 τραπεζικό λογαριασμό** (Εθνική Τράπεζα) που χρησιμοποιεί για:
- Εισπράξεις τιμολογίων (τραπεζική κατάθεση)
- Πληρωμές ΕΦΚΑ
- Πληρωμές λογαριασμών (ΔΕΚΟ, τηλεφωνία)
- Πληρωμές προμηθευτών
- Αγορές μέσω κάρτας (POS/e-commerce)

### Πρόβλημα

- Οι τραπεζικές κινήσεις δεν συνδέονται αυτόματα με τιμολόγια/δαπάνες
- Ο Γιώργος πρέπει χειροκίνητα να ελέγχει "ποιος πλήρωσε τι"
- Κινήσεις που δεν αντιστοιχούν σε τιμολόγιο/δαπάνη = "ορφανές"
- Αντιστοίχιση = βασικό εργαλείο ελέγχου ταμειακής ροής

### Λύση

1. **Import** τραπεζικών κινήσεων (CSV/OFX)
2. **Auto-matching** με τιμολόγια/δαπάνες (AI-assisted)
3. **Manual matching** για μη αναγνωρισμένες κινήσεις
4. **Dashboard** ταμειακής ροής

---

## 2. Bank Account Configuration

### 2.1 Στοιχεία Λογαριασμού

```typescript
interface BankAccount {
  accountId: string;                // Auto-generated
  companyId: string;
  status: 'active' | 'inactive';

  // === Στοιχεία Τράπεζας ===
  bankName: string;                 // "ΕΘΝΙΚΗ ΤΡΑΠΕΖΑ"
  iban: string;                     // "GR68 0110 2230 0000 2234 0068 448"
  currency: string;                 // "EUR"
  accountType: 'checking' | 'savings' | 'business';

  // === Display ===
  label: string;                    // "Εθνική — Κύριος λογαριασμός"
  isDefault: boolean;               // Προεπιλεγμένος

  // === Υπόλοιπο ===
  currentBalance: number | null;    // Τελευταίο γνωστό υπόλοιπο
  balanceDate: string | null;       // Ημ/νία υπολοίπου
  lastImportDate: string | null;    // Τελευταίο import

  // === Meta ===
  createdAt: string;
  updatedAt: string;
}
```

### 2.2 Γιώργος — Phase 1

| Παράμετρος | Τιμή |
|-----------|-------|
| Τράπεζα | Εθνική Τράπεζα |
| IBAN | GR68 0110 2230 0000 2234 0068 448 |
| Νόμισμα | EUR |
| Τύπος | Τρεχούμενος (business) |

> **Modular**: Η αρχιτεκτονική υποστηρίζει πολλαπλούς λογαριασμούς, αλλά Phase 1 = 1 λογαριασμός.

---

## 3. Transaction Import

### 3.1 Import Formats

| Format | Πηγή | Support |
|--------|------|---------|
| **CSV** | Εθνική e-banking export | Phase 1 ✅ |
| **OFX/QFX** | Open Financial Exchange | Phase 1 ✅ |
| **MT940** | SWIFT banking standard | Phase 2 |
| **Open Banking API** | PSD2 API (auto-sync) | Phase 2+ |
| **Manual** | Χειροκίνητη καταχώρηση | Phase 1 ✅ |

### 3.2 CSV Parser — Εθνική Τράπεζα

Τυπικό format Εθνικής:

```csv
Ημερομηνία;Αιτιολογία;Ποσό;Υπόλοιπο
15/01/2026;ΚΑΤΑΘΕΣΗ - ΠΑΠΑΔΟΠΟΥΛΟΣ ΑΕ;520,00;15.320,00
16/01/2026;ΠΛΗΡΩΜΗ ΕΦΚΑ RF123456;-330,37;14.989,63
17/01/2026;POS - SHELL ΑΥΤΟΚ/ΤΑ;-50,00;14.939,63
18/01/2026;WEB BANKING - ΔΕΗ;-85,00;14.854,63
```

```typescript
interface CSVParserConfig {
  bankName: string;
  delimiter: ';' | ',' | '\t';
  dateFormat: string;               // "DD/MM/YYYY"
  dateColumn: number;               // 0
  descriptionColumn: number;        // 1
  amountColumn: number;             // 2
  balanceColumn: number | null;     // 3
  encoding: string;                 // "windows-1253" (Ελληνικά)
  skipRows: number;                 // Header rows
  decimalSeparator: ',' | '.';
  thousandSeparator: '.' | ',';
}

const NBG_CSV_CONFIG: CSVParserConfig = {
  bankName: 'ΕΘΝΙΚΗ ΤΡΑΠΕΖΑ',
  delimiter: ';',
  dateFormat: 'DD/MM/YYYY',
  dateColumn: 0,
  descriptionColumn: 1,
  amountColumn: 2,
  balanceColumn: 3,
  encoding: 'windows-1253',
  skipRows: 1,
  decimalSeparator: ',',
  thousandSeparator: '.',
};
```

### 3.3 Bank Transaction Type

```typescript
type TransactionDirection = 'credit' | 'debit';
// credit = εισερχόμενο (πληρωμή πελάτη)
// debit = εξερχόμενο (πληρωμή μας)

type MatchStatus =
  | 'unmatched'          // Δεν αντιστοιχεί σε τίποτα
  | 'auto_matched'       // AI αντιστοίχιση
  | 'manual_matched'     // Χρήστης αντιστοίχισε
  | 'excluded';          // Εξαιρέθηκε (προσωπικό, μεταφορά)

interface BankTransaction {
  transactionId: string;            // Auto-generated
  accountId: string;                // → bank_accounts
  companyId: string;

  // === Κίνηση ===
  date: string;                     // ISO date
  valueDate: string | null;         // Ημ/νία αξίας (αν διαφέρει)
  description: string;              // Αιτιολογία τράπεζας
  amount: number;                   // Θετικό = credit, Αρνητικό = debit
  direction: TransactionDirection;
  balance: number | null;           // Υπόλοιπο μετά

  // === Matching ===
  matchStatus: MatchStatus;
  matchedToType: 'invoice' | 'expense' | 'efka' | 'vat' | 'other' | null;
  matchedToId: string | null;       // invoiceId / expenseDocId / efkaPaymentId
  matchConfidence: number | null;   // AI confidence (0-1)
  matchedBy: 'ai' | 'user' | null;
  matchedAt: string | null;

  // === Import ===
  importBatchId: string;            // Ποιο import batch
  importSource: 'csv' | 'ofx' | 'manual' | 'api';
  rawData: string | null;           // Αρχική γραμμή CSV

  // === Duplicate Detection ===
  hash: string;                     // SHA256(date + amount + description)
  isDuplicate: boolean;

  // === Meta ===
  createdAt: string;
  updatedAt: string;
}
```

---

## 4. Auto-Matching Engine

### 4.1 Matching Strategy

```
[Rule 1] EXACT AMOUNT MATCH (Priority: HIGH)
  Κίνηση +520,00€ → Τιμολόγιο Α-042 (πληρωτέο: 520,00€)
  Confidence: 0.90 (αν 1 τιμολόγιο με αυτό το ποσό)

[Rule 2] DESCRIPTION KEYWORDS (Priority: MEDIUM)
  "ΠΛΗΡΩΜΗ ΕΦΚΑ RF123456" → ΕΦΚΑ πληρωμή
  "POS - SHELL" → Δαπάνη καυσίμων
  "ΔΕΗ" → Δαπάνη ΔΕΚΟ
  Confidence: 0.85

[Rule 3] CONTACT NAME IN DESCRIPTION (Priority: MEDIUM)
  "ΠΑΠΑΔΟΠΟΥΛΟΣ ΑΕ" → CRM contact → Τιμολόγιο pending
  Confidence: 0.80

[Rule 4] RECURRING PATTERN (Priority: LOW)
  Κάθε μήνα -330,37€ + "ΕΦΚΑ" → ΕΦΚΑ εισφορά
  Confidence: 0.95 (μετά 2+ εμφανίσεις)

[Rule 5] AI FUZZY MATCH (Fallback)
  OpenAI: Ανάλυση description + ποσό + ημερομηνία
  Confidence: variable
```

### 4.2 Matching Interface

```typescript
interface IMatchingEngine {
  /** Auto-match μία κίνηση */
  matchTransaction(
    transaction: BankTransaction,
    candidates: MatchCandidate[]
  ): MatchResult;

  /** Auto-match batch (μετά import) */
  matchBatch(
    transactions: BankTransaction[]
  ): Promise<MatchResult[]>;

  /** Εύρεση υποψηφίων αντιστοίχισης */
  findCandidates(
    transaction: BankTransaction
  ): Promise<MatchCandidate[]>;
}

interface MatchCandidate {
  type: 'invoice' | 'expense' | 'efka' | 'vat';
  id: string;
  amount: number;
  date: string;
  description: string;
  contactName: string | null;
  score: number;                    // 0-1
}

interface MatchResult {
  transactionId: string;
  matched: boolean;
  candidate: MatchCandidate | null;
  confidence: number;
  rule: string;                     // Ποιος κανόνας έκανε match
}
```

### 4.3 AI Matching Prompt

```typescript
const BANK_MATCHING_PROMPT = `
Αντιστοίχισε αυτή την τραπεζική κίνηση με ένα από τα υποψήφια:

ΚΙΝΗΣΗ:
  Ημ/νία: {date}
  Αιτιολογία: "{description}"
  Ποσό: {amount}€

ΥΠΟΨΗΦΙΑ:
{candidates}

Απάντησε με τον αριθμό του υποψηφίου (ή 0 αν κανένα δεν ταιριάζει).
Εξήγησε γιατί.
`;
```

---

## 5. Duplicate Detection

### 5.1 Hash-based Detection

```typescript
function generateTransactionHash(tx: {
  date: string;
  amount: number;
  description: string;
}): string {
  const raw = `${tx.date}|${tx.amount}|${tx.description}`;
  return sha256(raw);
}
```

### 5.2 Import Dedup

Κατά το import, κάθε κίνηση ελέγχεται:
1. **Hash match**: Ίδιο hash → duplicate → skip
2. **Fuzzy match**: Ίδια ημ/νία + ίδιο ποσό + παρόμοια αιτιολογία → warning
3. **Date range overlap**: Import range επικαλύπτεται με previous import → warning

---

## 6. Reconciliation Workflow

### 6.1 Import Flow

```
[1] Χρήστης κατεβάζει CSV από e-banking
    ↓
[2] Upload CSV στο /accounting/bank/import
    ↓
[3] Parse CSV → BankTransaction[]
    ├─ Duplicate detection
    ├─ Encoding handling (windows-1253 → UTF-8)
    ├─ Amount normalization (1.520,00 → 1520.00)
    ↓
[4] Auto-match batch
    ├─ Κάθε credit → ψάξε pending invoices
    ├─ Κάθε debit → ψάξε pending expenses/EFKA
    ↓
[5] Review screen
    ├─ Auto-matched (green) → confirm
    ├─ Unmatched (yellow) → manual match / exclude
    ↓
[6] Confirm all → update payment statuses
    ├─ Invoice: paymentStatus → 'paid'
    ├─ Expense: paymentStatus → 'paid'
    ├─ EFKA: status → 'paid'
```

### 6.2 Manual Matching UI

```
┌─────────────────────────────────────────────────────────────┐
│  🏦 Αντιστοίχιση Κίνησης                                   │
│─────────────────────────────────────────────────────────────│
│                                                             │
│  ΚΙΝΗΣΗ: +520,00€ │ 15/01/2026                             │
│  "ΚΑΤΑΘΕΣΗ - ΠΑΠΑΔΟΠΟΥΛΟΣ ΑΕ"                              │
│                                                             │
│  ΥΠΟΨΗΦΙΑ:                                                  │
│  ┌──────────────────────────────────────────────────┐       │
│  │ ⭐ Τιμολόγιο Α-042 │ Παπαδόπουλος ΑΕ │ 520,00€ │ 96%  │
│  │    Τιμολόγιο Α-038 │ Παπαδόπουλος ΑΕ │ 620,00€ │ 45%  │
│  │    Τιμολόγιο Α-041 │ Ιωάννου ΕΠΕ     │ 520,00€ │ 40%  │
│  └──────────────────────────────────────────────────┘       │
│                                                             │
│  [✅ Αντιστοίχισε Α-042]  [🔍 Αναζήτηση]  [❌ Εξαίρεση]   │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Cash Flow Dashboard

### 7.1 Overview

```
┌─────────────────────────────────────────────────────────────┐
│  🏦 Τραπεζική Συμφωνία — Ιαν 2026                          │
│  Εθνική Τράπεζα │ GR68 ...0448                             │
│─────────────────────────────────────────────────────────────│
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ 💰 Υπόλοιπο  │ │ 📥 Εισπράξεις│ │ 📤 Πληρωμές  │        │
│  │  14.854,63€  │ │   3.520,00€  │ │   1.265,37€  │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
│  ┌──────────────┐ ┌──────────────┐                          │
│  │ ✅ Matched    │ │ ⚠️ Unmatched │                          │
│  │    28 / 32   │ │     4        │                          │
│  └──────────────┘ └──────────────┘                          │
│                                                             │
│  ΚΙΝΗΣΕΙΣ                                                   │
│  ────────                                                   │
│  15/01 │ ✅ │ +520,00€  │ ΠΑΠΑΔΟΠΟΥΛΟΣ ΑΕ   │ → Α-042     │
│  16/01 │ ✅ │ -330,37€  │ ΕΦΚΑ RF123456      │ → ΕΦΚΑ 12/25│
│  17/01 │ ✅ │  -50,00€  │ SHELL              │ → Καύσιμα   │
│  18/01 │ ✅ │  -85,00€  │ ΔΕΗ                │ → ΔΕΚΟ      │
│  20/01 │ ⚠️ │ -150,00€  │ ΜΕΤΑΦΟΡΑ ΣΕ...     │ [Match →]   │
│  22/01 │ ✅ │+3.000,00€ │ ΝΕΣΤΩΡ ΕΠΕ         │ → Α-043     │
│                                                             │
│  [📤 Import CSV]  [🔄 Auto-match]  [📊 Report]              │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Cash Flow Chart (Μηνιαίο)

```
€
16.000 ┤                              ╭─
15.000 ┤         ╭─────╮    ╭────────╯
14.000 ┤    ╭────╯     ╰────╯
13.000 ┤────╯
       └──────────────────────────────────
        1/1   5/1   10/1  15/1  20/1  25/1  31/1
```

---

## 8. Excluded Transactions

Κάποιες κινήσεις δεν αντιστοιχούν σε έσοδο/έξοδο:

| Τύπος | Παράδειγμα | Handling |
|-------|-----------|----------|
| Μεταφορά μεταξύ λογαριασμών | "ΜΕΤΑΦΟΡΑ ΣΕ ΤΑΜΙΕΥΤΗΡΙΟ" | Exclude |
| Προσωπική κίνηση | Ανάληψη ATM | Exclude |
| Τόκοι τράπεζας | "ΤΟΚΟΙ ΚΑΤΑΘ." | Auto → `other_income` |
| Τραπεζικά έξοδα | "ΕΞΟΔΑ ΚΙΝΗΣΗΣ" | Auto → `bank_fees` |
| Προμήθεια κάρτας | "ΠΡΟΜΗΘΕΙΑ POS" | Auto → `bank_fees` |

```typescript
interface ExclusionRule {
  pattern: RegExp;
  action: 'exclude' | 'auto_categorize';
  category: ExpenseCategory | IncomeCategory | null;
  description: string;
}

const EXCLUSION_RULES: ExclusionRule[] = [
  { pattern: /ΜΕΤΑΦΟΡΑ\s+(ΣΕ|ΑΠΟ)/i, action: 'exclude',
    category: null, description: 'Μεταφορά μεταξύ λογαριασμών' },
  { pattern: /ΑΝΑΛΗΨΗ\s+ATM/i, action: 'exclude',
    category: null, description: 'Προσωπική ανάληψη' },
  { pattern: /ΤΟΚΟΙ\s+ΚΑΤΑΘ/i, action: 'auto_categorize',
    category: 'other_income', description: 'Τόκοι καταθέσεων' },
  { pattern: /ΕΞΟΔΑ\s+ΚΙΝΗΣΗΣ|ΠΡΟΜΗΘΕΙΑ|COMMISSION/i, action: 'auto_categorize',
    category: 'bank_fees', description: 'Τραπεζικά έξοδα' },
];
```

---

## 9. Import Batch Tracking

```typescript
interface ImportBatch {
  batchId: string;
  accountId: string;
  companyId: string;

  // === Import ===
  fileName: string;
  fileFormat: 'csv' | 'ofx' | 'manual';
  importedAt: string;
  importedBy: string;               // userId

  // === Στατιστικά ===
  totalTransactions: number;
  duplicatesSkipped: number;
  autoMatched: number;
  unmatched: number;
  excluded: number;

  // === Περίοδος ===
  dateFrom: string;
  dateTo: string;

  // === Status ===
  status: 'imported' | 'reviewed' | 'completed';
}
```

---

## 10. Firestore Structure

```
accounting/{companyId}/
  ├── bank_accounts/{accountId}        ← Λογαριασμοί
  │
  ├── bank_transactions/{txId}         ← Κινήσεις
  │
  ├── bank_imports/{batchId}           ← Import batches
  │
  └── settings/
      └── bank_reconciliation          ← CSV config, exclusion rules
```

### 10.1 Composite Indexes

```
bank_transactions:
  - (accountId ASC, date DESC)         ← Κινήσεις ανά λογαριασμό
  - (matchStatus ASC, date DESC)       ← Unmatched πρώτα
  - (importBatchId ASC, date ASC)      ← Ανά import batch
  - (hash ASC)                         ← Duplicate detection
```

---

## 11. Pending Payments View

Συνδυαστικό view: ποιά τιμολόγια/δαπάνες δεν έχουν πληρωθεί:

```
┌─────────────────────────────────────────────────────────────┐
│  ⏳ Εκκρεμείς Πληρωμές                                     │
│─────────────────────────────────────────────────────────────│
│                                                             │
│  ΕΙΣΠΡΑΚΤΕΑ (Τιμολόγια χωρίς πληρωμή):                    │
│  ──────────                                                 │
│  Α-044 │ Δημητρίου ΟΕ    │ 1.200,00€ │ 05/02 │ 4 ημ. ago  │
│  Α-045 │ Καραμανλής ΑΕ   │   800,00€ │ 08/02 │ 1 ημ. ago  │
│  Σύνολο εισπρακτέων: 2.000,00€                             │
│                                                             │
│  ΠΛΗΡΩΤΕΑ (Δαπάνες χωρίς πληρωμή):                        │
│  ──────────                                                 │
│  EXP-112 │ Λογιστής Κ.    │   300,00€ │ 01/02 │ 8 ημ. ago  │
│  ΕΦΚΑ    │ Φεβρουάριος    │   338,64€ │ 28/02 │ σε 19 ημ.  │
│  Σύνολο πληρωτέων: 638,64€                                 │
│                                                             │
│  ΚΑΘΑΡΗ ΘΕΣΗ: +1.361,36€                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 12. Dependencies

| Module | Σχέση | Περιγραφή |
|--------|-------|-----------|
| **M-002** (Income/Expense) | **READS** | Journal entries for matching |
| **M-003** (Invoicing) | **READS** | Unpaid invoices → match credits |
| **ACC-005** (Expense Tracker) | **READS** | Unpaid expenses → match debits |
| **ACC-006** (EFKA) | **READS** | EFKA payments → match debits |
| **ACC-004** (VAT) | **READS** | VAT payments → match debits |
| **M-001** (Company Setup) | **BLOCKED BY** | IBAN, bank config |
| **M-010** (Reports) | **FEEDS** | Cash flow reports |

---

## 13. Open Questions

| # | Ερώτηση | Status |
|---|---------|--------|
| 1 | CSV format Εθνικής: Τo encoding πάντα windows-1253; | DEFAULT: Yes (config) |
| 2 | Open Banking API: PSD2 πρόσβαση μέσω Εθνικής; | Phase 2+ (research) |
| 3 | Πολλαπλοί λογαριασμοί: Μελλοντικά, πόσοι; | DEFAULT: 1 (modular) |

---

## 14. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-09 | ADR Created — Bank Reconciliation | Γιώργος + Claude Code |
| 2026-02-09 | Phase 1: CSV import (Εθνική Τράπεζα), Phase 2: Open Banking | Claude Code |
| 2026-02-09 | 5-rule matching engine (exact amount, keywords, contact, recurring, AI) | Claude Code |
| 2026-02-09 | Hash-based duplicate detection (SHA256) | Claude Code |
| 2026-02-09 | Exclusion rules: μεταφορές, ΑΤΜ, τόκοι, προμήθειες | Claude Code |
| 2026-02-09 | CSV encoding: windows-1253 (configurable per bank) | Claude Code |
| 2026-02-09 | Pending payments view: εισπρακτέα + πληρωτέα | Claude Code |
| 2026-02-09 | 1 bank account Phase 1, modular for more | Γιώργος |
| 2026-03-30 | **Phase 2d implemented** — ReconciliationPageContent (split-view), CandidatesPanel with confidence badges + tier + match reasons tooltip, BatchActionsToolbar ("Auto-match all" → matchBatch), CandidateGroupCard (N:M), useMatchCandidates/useMatchActions hooks. Engine fully wired UI→API→service. | Claude Code |
| 2026-05-04 | **Verification** — Phase B audit confirms full wiring: ReconciliationPageContent + BankPageContent both wired to engine. AUDIT-2026-03-29 flag resolved. Status updated DRAFT→IMPLEMENTED. | Claude Code |
| 2026-02-09 | **Phase 2 implemented** — types/bank.ts: TransactionDirection, MatchStatus (4 states), BankAccountConfig, BankTransaction (~20 fields), CSVParserConfig + CSVColumnMapping (per-bank parsing), MatchCandidate, MatchResult, ImportBatch, BankTransactionFilters. Imports CurrencyCode from contacts/banking. types/interfaces.ts: IMatchingEngine (findCandidates, matchTransaction, matchBatch, unmatchTransaction), ICSVImportService (getSupportedBanks, parseCSV, importTransactions) | Claude Code |
| 2026-02-09 | **Phase 3 implemented** — services/config/csv-parsers/: 4 bank configs (NBG tab/win1253, Eurobank ;/utf8, Piraeus ,/win1253, Alpha ;/utf8) + index.ts registry. services/external/csv-import-service.ts: `CSVImportService implements ICSVImportService` — `parseCSV()` + `importTransactions()` with batch tracking. services/engines/matching-engine.ts: `MatchingEngine implements IMatchingEngine` — scoring: exact amount +40pts, near ±5% +25pts, exact date +30pts, near ±7d +15pts, counterparty +20pts, EFKA keywords +20pts. Auto-match threshold 85. `findCandidates()`, `matchTransaction()`, `matchBatch()`, `unmatchTransaction()` | Claude Code |
| 2026-02-09 | **Phase 4 implemented** — API: `GET/POST /api/accounting/bank/transactions`, `POST /api/accounting/bank/match`. Hook: `useBankTransactions(filters)`. UI: `BankPageContent` (3 filters: account/direction/matchStatus + Import CSV button), `TransactionsList` (table: date/description/amount with color credit/debit/matchStatus badges), `ImportCSVDialog` (dialog: bank selection NBG/Eurobank/Piraeus/Alpha + file upload), `MatchingPanel` (split layout: unmatched transactions + match candidates with confidence badges + match button) | Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
