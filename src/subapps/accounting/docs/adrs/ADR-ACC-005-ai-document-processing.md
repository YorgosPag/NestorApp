# ADR-ACC-005: AI Document Processing — Expense Tracker

| Metadata | Value |
|----------|-------|
| **Status** | DRAFT |
| **Date** | 2026-02-09 |
| **Category** | Accounting / AI / Expenses |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Parent** | [ADR-ACC-000](./ADR-ACC-000-founding-decision.md) |
| **Module** | M-006: Expense Tracker |

---

## 1. Context

Ο αρχιτέκτονας-μηχανικός λαμβάνει δεκάδες παραστατικά μηνιαίως:
- Τιμολόγια προμηθευτών (λογιστής, δικηγόρος, υπεργολάβοι)
- Αποδείξεις λιανικής (καύσιμα, αναλώσιμα, κατασκευαστικά υλικά)
- Λογαριασμοί ΔΕΚΟ (ΔΕΗ, νερό, τηλέφωνο)
- Συνδρομές (λογισμικό, cloud, hosting)
- Αποδείξεις μετακινήσεων (διόδια, parking, εισιτήρια)

### Πρόβλημα

Η χειροκίνητη καταχώρηση είναι:
- **Χρονοβόρα** — 5-10 λεπτά ανά παραστατικό
- **Επιρρεπής σε λάθη** — λάθος κατηγορία, λάθος ΦΠΑ, χαμένα παραστατικά
- **Βαρετή** — ο Γιώργος θέλει να ασχολείται με αρχιτεκτονική, όχι data entry

### Λύση

AI-powered pipeline που:
1. **Σκανάρει** PDF/φωτογραφία παραστατικού
2. **Αναγνωρίζει** τύπο εγγράφου (τιμολόγιο, απόδειξη, λογαριασμός)
3. **Εξάγει** δεδομένα (ΑΦΜ, ποσά, ΦΠΑ, ημερομηνία, περιγραφή)
4. **Κατηγοριοποιεί** αυτόματα (καύσιμα, ενοίκιο, ΔΕΚΟ, κλπ.)
5. **Προτείνει** εγγραφή στο Βιβλίο Ε-Ε
6. **Ο χρήστης επιβεβαιώνει** ή διορθώνει (human-in-the-loop)

---

## 2. Pipeline Architecture

### 2.1 Ροή Επεξεργασίας

```
[INPUT]
  Χρήστης upload PDF / φωτογραφία / email attachment
  ↓
[STAGE 1: Document Ingestion]
  - File validation (type, size)
  - Image preprocessing (αν χρειάζεται)
  - Storage → Firebase Storage
  ↓
[STAGE 2: AI Document Classification]
  - Input: εικόνα/PDF
  - Output: documentType (invoice, receipt, utility_bill, bank_statement, other)
  - Model: OpenAI gpt-4o-mini (vision)
  - Confidence threshold: 0.8
  ↓
[STAGE 3: AI Data Extraction]
  - Input: εικόνα/PDF + documentType
  - Output: ExtractedDocumentData (structured)
  - Model: OpenAI gpt-4o (vision) — πιο ακριβές
  - Structured Output (JSON schema)
  ↓
[STAGE 4: AI Smart Categorization]
  - Input: ExtractedDocumentData
  - Output: ExpenseCategory + myDATA code + E3 code
  - Based on: vendor name, description, amount patterns
  - Learning: Ιστορικό κατηγοριοποιήσεων (same vendor → same category)
  ↓
[STAGE 5: Human Review]
  - Προβολή extracted data + AI suggestion
  - Χρήστης: Confirm / Edit / Reject
  ↓
[STAGE 6: Auto-Book]
  - Δημιουργία JournalEntry (M-002)
  - myDATA classification (M-004)
  - Σύνδεση με CRM contact (αν vendor = γνωστή επαφή)
```

### 2.2 Alternative Inputs

```
[A] Web Upload    → Σελίδα /accounting/expenses/scan
[B] Mobile Camera → PWA camera capture (μελλοντικό)
[C] Email Forward → Forward receipt email → auto-ingest (μελλοντικό)
[D] Telegram      → "Καταχώρησε αυτή τη δαπάνη" + φωτογραφία
[E] Manual Entry  → Χειροκίνητη καταχώρηση (χωρίς AI)
```

---

## 3. AI Models & Strategy

### 3.1 Model Selection

| Stage | Model | Λόγος | Κόστος/call |
|-------|-------|-------|-------------|
| Classification | `gpt-4o-mini` | Γρήγορο, φθηνό, αρκετά ακριβές | ~$0.002 |
| Data Extraction | `gpt-4o` | Ακρίβεια OCR, πολύπλοκα layouts | ~$0.01 |
| Categorization | `gpt-4o-mini` | Pattern matching, σύντομο prompt | ~$0.001 |

**Εκτιμώμενο κόστος**: ~$0.013 ανά παραστατικό (~50 παραστατικά/μήνα = **~$0.65/μήνα**)

### 3.2 Existing AI Pipeline Integration

Η εφαρμογή ήδη διαθέτει AI pipeline (ADR-080). Χρησιμοποιούμε:
- `OpenAIAnalysisProvider` — ήδη υλοποιημένος
- `gpt-4o-mini` / `gpt-4o` — ήδη configured
- Structured Outputs — ήδη χρησιμοποιούνται (ADR-131)

Δεν χρειάζεται νέο AI framework — **επέκταση** του υπάρχοντος.

---

## 4. Document Types

### 4.1 Classification Categories

| Κωδικός | Τύπος | Περιγραφή | Αναμενόμενα Πεδία |
|---------|-------|-----------|-------------------|
| `purchase_invoice` | Τιμολόγιο Αγοράς | Τιμολόγιο από προμηθευτή | ΑΦΜ, σειρά, αρ., ποσά |
| `receipt` | Απόδειξη Λιανικής | Απόδειξη (POS, βενζινάδικο) | Ποσό, ΦΠΑ, ημ/νία |
| `utility_bill` | Λογαριασμός ΔΕΚΟ | ΔΕΗ, ΕΥΑΘ, Cosmote | Ποσό, περίοδος, κωδικός |
| `bank_statement` | Τραπεζικό Extract | Κίνηση λογαριασμού | → M-009 (Bank Reconciliation) |
| `efka_notice` | Ειδοποιητήριο ΕΦΚΑ | Μηνιαία εισφορά | Ποσό, μήνας, κλάδοι |
| `credit_note` | Πιστωτικό (λαμβανόμενο) | Πιστωτικό από προμηθευτή | Αντιλογισμός |
| `other` | Άλλο | Μη αναγνωρισμένο | Manual classification |

### 4.2 OpenAI Classification Schema

```typescript
const DOCUMENT_CLASSIFICATION_SCHEMA = {
  name: 'document_classification',
  strict: true,
  schema: {
    type: 'object',
    required: ['documentType', 'confidence', 'reasoning'],
    additionalProperties: false,
    properties: {
      documentType: {
        type: 'string',
        enum: [
          'purchase_invoice', 'receipt', 'utility_bill',
          'bank_statement', 'efka_notice', 'credit_note', 'other'
        ],
      },
      confidence: {
        type: 'number',  // 0.0 - 1.0
      },
      reasoning: {
        type: 'string',  // Γιατί αυτός ο τύπος
      },
    },
  },
};
```

---

## 5. Data Extraction Schema

### 5.1 Extracted Document Data

```typescript
interface ExtractedDocumentData {
  // === Τύπος ===
  documentType: string;

  // === Εκδότης ===
  issuer: {
    name: string | null;          // Επωνυμία εκδότη
    vatNumber: string | null;     // ΑΦΜ
    taxOffice: string | null;     // ΔΟΥ
    address: string | null;
    phone: string | null;
  };

  // === Παραστατικό ===
  document: {
    series: string | null;        // Σειρά
    number: string | null;        // Αριθμός
    issueDate: string | null;     // Ημ/νία (ISO)
    dueDate: string | null;       // Ληξη πληρωμής
  };

  // === Ποσά ===
  amounts: {
    netAmount: number | null;     // Καθαρό
    vatRate: number | null;       // ΦΠΑ %
    vatAmount: number | null;     // ΦΠΑ ποσό
    totalAmount: number | null;   // Σύνολο
    currency: string;             // "EUR" default
  };

  // === Γραμμές (αν αναγνωρίζονται) ===
  lineItems: Array<{
    description: string;
    quantity: number | null;
    unitPrice: number | null;
    amount: number;
    vatRate: number | null;
  }>;

  // === Τρόπος Πληρωμής ===
  paymentMethod: string | null;   // cash, card, bank_transfer

  // === Περιγραφή ===
  description: string;            // AI-generated σύντομη περιγραφή

  // === AI Metadata ===
  extractionConfidence: number;   // 0.0 - 1.0
  rawText: string | null;         // OCR raw text (αν διαθέσιμο)
}
```

### 5.2 OpenAI Extraction Prompt Strategy

```typescript
const EXTRACTION_SYSTEM_PROMPT = `
Είσαι ειδικός λογιστής. Εξέτασε αυτό το ελληνικό παραστατικό και εξάγαγε τα δεδομένα.

ΚΑΝΟΝΕΣ:
1. Ποσά ΠΑΝΤΑ σε αριθμούς (π.χ. 120.50, ΟΧΙ "εκατόν είκοσι")
2. Ημερομηνίες σε ISO format (YYYY-MM-DD)
3. ΑΦΜ: 9 ψηφία (ελληνικό)
4. ΦΠΑ: Αν δεν φαίνεται ρητά, υπολόγισε από net+total
5. Αν κάτι δεν είναι ευανάγνωστο → null (ΟΧΙ guess)
6. description: Σύντομη περιγραφή στα ελληνικά (max 100 chars)
`;
```

---

## 6. Smart Categorization

### 6.1 Strategy: Multi-signal Classification

Η κατηγοριοποίηση χρησιμοποιεί **3 σήματα**:

```
Signal 1: Vendor Name (40% weight)
  "SHELL" → fuel
  "COSMOTE" → telecom
  "ΔΕΗ" → utilities
  "ΕΦΚΑ" → efka

Signal 2: Description/Content (40% weight)
  "βενζίνη" → fuel
  "μελάνι εκτυπωτή" → office_supplies
  "ετήσια συνδρομή AutoCAD" → software

Signal 3: Historical Pattern (20% weight)
  Same vendor → Same category (confidence boost)
```

### 6.2 Vendor → Category Mapping (Bootstrap)

```typescript
const VENDOR_CATEGORY_HINTS: Record<string, ExpenseCategory> = {
  // Καύσιμα
  'SHELL': 'fuel',
  'BP': 'fuel',
  'ΕΚΟ': 'fuel',
  'AVIN': 'fuel',
  'AEGEAN': 'fuel',

  // ΔΕΚΟ
  'ΔΕΗ': 'utilities',
  'ΔΕΔΔΗΕ': 'utilities',
  'ΕΥΑΘ': 'utilities',
  'ΔΕΥΑΘ': 'utilities',
  'ΦΥΣΙΚΟ ΑΕΡΙΟ': 'utilities',

  // Τηλεπικοινωνίες
  'COSMOTE': 'telecom',
  'VODAFONE': 'telecom',
  'WIND': 'telecom',
  'NOVA': 'telecom',
  'FORTHNET': 'telecom',

  // Λογισμικό
  'AUTODESK': 'software',
  'MICROSOFT': 'software',
  'GOOGLE': 'software',
  'ADOBE': 'software',
  'GITHUB': 'software',

  // Ασφάλειες
  'ΕΘΝΙΚΗ ΑΣΦΑΛΙΣΤΙΚΗ': 'vehicle_insurance',
  'INTERAMERICAN': 'vehicle_insurance',
  'EUROLIFE': 'vehicle_insurance',
  'GENERALI': 'vehicle_insurance',

  // Τράπεζες
  'ΕΘΝΙΚΗ ΤΡΑΠΕΖΑ': 'bank_fees',
  'ALPHA BANK': 'bank_fees',
  'EUROBANK': 'bank_fees',
  'ΠΕΙΡΑΙΩΣ': 'bank_fees',

  // ΕΦΚΑ
  'ΕΦΚΑ': 'efka',
  'ΤΣΜΕΔΕ': 'efka',
  'ΚΕΑΟ': 'efka',

  // ΤΕΕ
  'ΤΕΕ': 'tee_fees',
  'ΤΕΧΝΙΚΟ ΕΠΙΜΕΛΗΤΗΡΙΟ': 'tee_fees',
};
```

### 6.3 Learning Loop

```typescript
interface VendorCategoryLearning {
  vendorVat: string;            // ΑΦΜ vendor (unique identifier)
  vendorName: string;
  suggestedCategory: ExpenseCategory;
  confirmedCategory: ExpenseCategory;  // Τι επιβεβαίωσε ο χρήστης
  confidence: number;
  occurrences: number;          // Πόσες φορές ίδιος vendor → ίδια κατηγορία
  lastUsedAt: string;
}
```

Μετά από **3 επιβεβαιώσεις** ίδιου vendor → ίδια κατηγορία, το AI auto-classifies χωρίς human review (confidence = 0.95+).

---

## 7. Human Review UI

### 7.1 Review Screen

```
┌─────────────────────────────────────────────────────────────┐
│  📄 Νέα Δαπάνη — AI Review                                 │
│─────────────────────────────────────────────────────────────│
│                                                             │
│  ┌──────────────┐  ΕΚΔΟΤΗΣ                                  │
│  │              │  Επωνυμία: SHELL HELLAS A.E.               │
│  │  [Preview    │  ΑΦΜ: 094080303                           │
│  │   εικόνας]   │  ────────────────────────                  │
│  │              │  ΠΑΡΑΣΤΑΤΙΚΟ                               │
│  │              │  Τύπος: Απόδειξη Λιανικής                  │
│  │              │  Ημ/νία: 15/01/2026                        │
│  └──────────────┘  Αρ.: 1234                                │
│                    ────────────────────────                  │
│                    ΠΟΣΑ                                      │
│                    Καθαρό: 40,32€                            │
│                    ΦΠΑ 24%: 9,68€                            │
│                    Σύνολο: 50,00€                            │
│                    ────────────────────────                  │
│                    ΚΑΤΗΓΟΡΙΑ (AI Suggestion)                 │
│                    🤖 Καύσιμα [confidence: 96%]              │
│                    ────────────────────────                  │
│                    Περιγραφή: Ανεφοδιασμός καυσίμων          │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ ✅ Confirm   │ │ ✏️ Edit      │ │ ❌ Reject    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Edit Mode

Αν ο χρήστης πατήσει "Edit":
- Όλα τα πεδία γίνονται editable
- Κατηγορία: Dropdown με όλες τις ExpenseCategories (ACC-001)
- ΦΠΑ rate: Dropdown (24%, 13%, 6%, 0%)
- Αυτόματος επανυπολογισμός ποσών

### 7.3 Batch Review

Για πολλαπλά παραστατικά:

```
┌─────────────────────────────────────────────────────────────┐
│  📄 Batch Review — 5 νέα παραστατικά                        │
│─────────────────────────────────────────────────────────────│
│  ✅ │ SHELL          │ Καύσιμα     │  50,00€ │ 96% │ Auto  │
│  ✅ │ COSMOTE        │ Τηλεφωνία   │  45,00€ │ 98% │ Auto  │
│  ⚠️ │ ΑΦΟΙ ΙΩΑΝΝΟΥ  │ ???         │ 320,00€ │ 42% │ Review│
│  ✅ │ ΔΕΗ            │ ΔΕΗ/Νερό    │  85,00€ │ 99% │ Auto  │
│  ✅ │ ΕΦΚΑ           │ ΕΦΚΑ        │ 330,37€ │ 99% │ Auto  │
│─────────────────────────────────────────────────────────────│
│  [✅ Confirm All Auto]  [⚠️ Review Pending (1)]             │
└─────────────────────────────────────────────────────────────┘
```

**Auto-confirm rule**: Confidence ≥ 90% + ≥3 historical matches → auto-confirm badge.

---

## 8. Received Document Schema

```typescript
interface ReceivedExpenseDocument {
  // === Ταυτότητα ===
  docId: string;                    // Auto-generated (exp_XXXXX)
  status: 'processing' | 'review' | 'confirmed' | 'rejected';

  // === Upload ===
  fileUrl: string;                  // Firebase Storage URL
  fileName: string;
  fileType: 'pdf' | 'image' | 'email';
  fileSize: number;
  uploadedAt: string;
  uploadSource: 'web' | 'telegram' | 'email' | 'mobile';

  // === AI Classification (Stage 2) ===
  aiDocumentType: string;           // purchase_invoice, receipt, κλπ.
  aiClassificationConfidence: number;

  // === AI Extraction (Stage 3) ===
  extractedData: ExtractedDocumentData | null;
  aiExtractionConfidence: number;

  // === AI Categorization (Stage 4) ===
  aiSuggestedCategory: ExpenseCategory | null;
  aiCategorizationConfidence: number;

  // === Human Review (Stage 5) ===
  confirmedCategory: ExpenseCategory | null;
  confirmedAmounts: {
    netAmount: number;
    vatRate: number;
    vatAmount: number;
    totalAmount: number;
  } | null;
  reviewedBy: string | null;        // userId
  reviewedAt: string | null;

  // === Booking (Stage 6) ===
  journalEntryId: string | null;    // → journal_entries
  mydataClassified: boolean;        // Χαρακτηρισμός myDATA (ACC-003)

  // === Vendor ===
  vendorVat: string | null;
  vendorName: string | null;
  contactId: string | null;         // → CRM contact

  // === Meta ===
  fiscalYear: number;
  quarter: 1 | 2 | 3 | 4;
  createdAt: string;
  updatedAt: string;
}
```

---

## 9. Telegram Integration

### 9.1 Admin Command (UC Module)

Νέο UC module: **UC-017: Admin Expense Capture**

```
Admin: [φωτογραφία παραστατικού]
Admin: "Καταχώρησε αυτή τη δαπάνη"
  ↓
AI Pipeline:
  [1] Detect: photo + expense intent
  [2] Download photo → Firebase Storage
  [3] AI Classification + Extraction
  [4] AI Categorization
  ↓
Bot: "📄 Αναγνωρίστηκε: Απόδειξη SHELL
      Ποσό: 50,00€ (ΦΠΑ 24%: 9,68€)
      Κατηγορία: Καύσιμα
      ✅ Καταχωρήθηκε στο Βιβλίο Ε-Ε"
```

### 9.2 Corrections via Telegram

```
Admin: "Άλλαξε την τελευταία δαπάνη σε 'Έξοδα Οχήματος'"
  → UC-017 correction flow
```

---

## 10. File Storage

### 10.1 Firebase Storage Structure

```
accounting/{companyId}/expenses/
  ├── 2026/
  │   ├── 01/                          ← Ιανουάριος
  │   │   ├── exp_abc123_original.pdf  ← Αρχικό αρχείο
  │   │   ├── exp_abc123_thumb.jpg     ← Thumbnail (preview)
  │   │   └── exp_def456_original.jpg
  │   ├── 02/
  │   └── ...
```

### 10.2 File Limits

| Παράμετρος | Τιμή |
|-----------|-------|
| Max file size | 10MB |
| Allowed types | PDF, JPG, PNG, WEBP, HEIC |
| Thumbnail | 200x200px auto-generated |
| Retention | Αόριστα (φορολογική υποχρέωση 5+ χρόνια) |

---

## 11. Processing Queue

### 11.1 Queue Architecture

Χρησιμοποιούμε το ίδιο pattern με το email pipeline (ADR-070):

```typescript
interface ExpenseProcessingQueue {
  queueId: string;
  docId: string;                  // → received_expense_documents
  stage: 'classify' | 'extract' | 'categorize';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: 3;
  error: string | null;
  createdAt: string;
  processedAt: string | null;
}
```

### 11.2 Processing Trigger

```
Web Upload → after() trigger → queue processing
Telegram   → webhook → after() trigger → queue processing
```

Χρησιμοποιούμε Next.js 15 `after()` (ίδιο pattern με email pipeline) — κανένα cron, immediate processing.

---

## 12. Firestore Structure

```
accounting/{companyId}/
  ├── received_expenses/{docId}        ← Uploaded documents + AI results
  │
  ├── expense_queue/{queueId}          ← Processing queue
  │
  ├── vendor_learning/{vendorVat}      ← AI learning per vendor
  │
  └── settings/
      └── expense_tracker              ← Config (auto-confirm threshold, κλπ.)
```

### 12.1 Composite Indexes

```
received_expenses:
  - (status ASC, createdAt DESC)       ← Pending review first
  - (fiscalYear ASC, quarter ASC)      ← Ανά περίοδο
  - (confirmedCategory ASC, createdAt DESC)  ← Ανά κατηγορία

vendor_learning:
  - (occurrences DESC)                 ← Most frequent vendors
```

---

## 13. Metrics & Analytics

### 13.1 Dashboard Cards

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 📄 Upload     │ │ 🤖 AI Accuracy│ │ ⏱️ Avg Time   │ │ 💰 Total     │
│    48/month   │ │    94.2%     │ │    8 sec     │ │  4.200,00€   │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### 13.2 Accuracy Tracking

```typescript
interface AIAccuracyMetrics {
  period: string;                 // "2026-01"
  totalDocuments: number;
  autoConfirmed: number;          // Confidence ≥ 90% + history
  humanReviewed: number;
  corrected: number;              // Χρήστης άλλαξε κατηγορία
  rejected: number;
  accuracyRate: number;           // (total - corrected) / total
  avgProcessingTime: number;      // seconds
}
```

---

## 14. UI Pages

| Route | Σελίδα | Λειτουργία |
|-------|--------|------------|
| `/accounting/expenses` | Λίστα Δαπανών | Φίλτρα: περίοδος, κατηγορία, status |
| `/accounting/expenses/upload` | Upload | Drag & drop / camera |
| `/accounting/expenses/review` | AI Review | Pending review queue |
| `/accounting/expenses/[id]` | Λεπτομέρειες | Extracted data + original |
| `/accounting/expenses/new` | Χειροκίνητη | Manual entry (χωρίς AI) |
| `/accounting/expenses/analytics` | Analytics | AI accuracy, κατανομή κατηγοριών |

---

## 15. Dependencies

| Module | Σχέση | Περιγραφή |
|--------|-------|-----------|
| **ACC-001** (Chart of Accounts) | **READS** | Expense categories + VAT rules |
| **M-002** (Income/Expense) | **FEEDS** | Confirmed expense → journal entry |
| **M-004** (myDATA) | **TRIGGERS** | Expense classification → ΑΑΔΕ |
| **M-005** (VAT Engine) | **FEEDS** | VAT amounts per expense |
| **M-009** (Bank Reconciliation) | **LINKS** | Expense → bank transaction match |
| **AI Pipeline** (ADR-080) | **EXTENDS** | Uses existing OpenAI provider |
| **Firebase Storage** | **STORES** | Original documents |

---

## 16. Open Questions

| # | Ερώτηση | Status |
|---|---------|--------|
| 1 | Auto-confirm threshold: 90% confidence + 3 historical? | DEFAULT: Yes |
| 2 | Duplicate detection: Ίδιο ΑΦΜ + ίδιο ποσό + ίδια ημ/νία → warning; | DEFAULT: Warning |
| 3 | OCR fallback: Αν OpenAI vision αποτύχει, χρήση Tesseract local; | DEFAULT: No (gpt-4o αρκεί) |

---

## 17. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-09 | ADR Created — AI Document Processing / Expense Tracker | Γιώργος + Claude Code |
| 2026-02-09 | 3-stage AI pipeline: classify → extract → categorize | Claude Code |
| 2026-02-09 | Models: gpt-4o-mini (classify/categorize), gpt-4o (extract) | Claude Code |
| 2026-02-09 | Human-in-the-loop: AI suggests, user confirms/edits | Claude Code |
| 2026-02-09 | Vendor learning: Auto-confirm μετά 3 ίδιες κατηγοριοποιήσεις | Claude Code |
| 2026-02-09 | Existing AI pipeline (ADR-080) — extension, NOT new framework | Claude Code |
| 2026-02-09 | Next.js `after()` for immediate processing (ίδιο pattern email) | Claude Code |
| 2026-02-09 | Firebase Storage for document retention (5+ χρόνια) | Claude Code |
| 2026-02-09 | Telegram UC-017 for mobile expense capture | Claude Code |
| 2026-02-09 | **Phase 2 implemented** — types/documents.ts: DocumentType (7 types), DocumentProcessingStatus, ExtractedLineItem, ExtractedDocumentData, ReceivedExpenseDocument, VendorCategoryLearning, ExpenseProcessingQueue, DocumentClassification. types/interfaces.ts: IDocumentAnalyzer (classifyDocument, extractData, categorizeExpense) | Claude Code |
| 2026-02-09 | **Phase 3 implemented** — services/external/document-analyzer.stub.ts: `DocumentAnalyzerStub implements IDocumentAnalyzer` — all 3 methods (classifyDocument, extractData, categorizeExpense) throw "not configured". Placeholder for OpenAI gpt-4o Vision integration (OCR+NLP for invoice images/PDFs) | Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
