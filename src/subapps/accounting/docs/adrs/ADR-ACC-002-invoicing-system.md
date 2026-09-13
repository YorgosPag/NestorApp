# ADR-ACC-002: Invoicing System — Σύστημα Τιμολόγησης

| Metadata | Value |
|----------|-------|
| **Status** | ACTIVE |
| **Date** | 2026-02-09 |
| **Category** | Accounting / Invoicing |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Parent** | [ADR-ACC-000](./ADR-ACC-000-founding-decision.md) |
| **Module** | M-003: Invoicing |

---

## 1. Context

Ο αρχιτέκτονας-μηχανικός εκδίδει τιμολόγια για:
- **Αρχιτεκτονικές υπηρεσίες** (ΚΑΔ 71112000): μελέτες, ΠΕΑ, άδειες, ρυθμίσεις αυθαιρέτων, ηλεκτρονικές ταυτότητες κτιρίων
- **Κατασκευαστικά έργα** (ΚΑΔ 41202003 / 41201001): εργολαβίες κατασκευής

Κάθε τιμολόγιο πρέπει υποχρεωτικά να διαβιβαστεί στο **myDATA/ΑΑΔΕ** (ADR-ACC-003).

### Απαιτήσεις
- Έκδοση ΟΛΩ τύπων παραστατικών
- Αυτόματος υπολογισμός ΦΠΑ 24%
- Αυτόματη παρακράτηση φόρου (20% ή 3% ανάλογα ΚΑΔ)
- Σύνδεση πελάτη με CRM contacts
- myDATA διαβίβαση (MARK αριθμός)
- Σειρές αρίθμησης (modular)
- AI-assisted invoice drafting
- PDF generation & εκτύπωση

---

## 2. Document Types (Τύποι Παραστατικών)

### 2.1 Εκδιδόμενα Παραστατικά

| myDATA Τύπος | Κωδικός | Ελληνικά | Χρήση | Phase |
|-------------|---------|----------|-------|-------|
| 2.1 | `service_invoice` | Τιμολόγιο Παροχής Υπηρεσιών (ΤΠΥ) | Μελέτες, ΠΕΑ, άδειες → νομικά πρόσωπα ή ΔΦ με ΑΦΜ | 1 |
| 1.1 | `sales_invoice` | Τιμολόγιο Πώλησης | Κατασκευαστικά έργα (υλικά + εργασία) | 1 |
| 11.1 | `retail_receipt` | Απόδειξη Λιανικής Πώλησης | Πώληση σε ιδιώτη (χωρίς ΑΦΜ) | 1 |
| 11.2 | `service_receipt` | Απόδειξη Παροχής Υπηρεσιών (ΑΠΥ) | Υπηρεσία σε ιδιώτη (ΠΕΑ σε ιδιώτη) | 1 |
| 5.1 | `credit_invoice` | Πιστωτικό Τιμολόγιο | Ακύρωση/μερική επιστροφή | 1 |
| 2.2 | `service_invoice_eu` | ΤΠΥ Ενδοκοινοτικό | Υπηρεσία σε EU (μη ενεργό — ΟΧΙ ενδοκοινοτικές) | 2+ |
| 2.3 | `service_invoice_3rd` | ΤΠΥ Τρίτες Χώρες | Υπηρεσία εκτός EU | 2+ |

### 2.2 Συνηθέστερα Σενάρια Γιώργου

| Σενάριο | Τύπος | ΚΑΔ | Παρακράτηση |
|---------|-------|-----|-------------|
| ΠΕΑ σε εταιρεία | ΤΠΥ (2.1) | 71112000 | 20% (αν >300€) |
| ΠΕΑ σε ιδιώτη | ΑΠΥ (11.2) | 71112000 | 0% |
| Αρχιτεκτονική μελέτη σε εταιρεία | ΤΠΥ (2.1) | 71112000 | 20% (αν >300€) |
| Άδεια (μέσω ΤΕΕ) | ΤΠΥ (2.1) | 71112000 | 20% (αν >300€) |
| Κατασκευαστικό έργο | ΤΠ (1.1) | 41202003/41201001 | 3% (αν >300€) |
| Ακύρωση τιμολογίου | Πιστωτικό (5.1) | — | Αντιλογισμός |

---

## 3. Invoice Data Schema

### 3.1 Invoice (Τιμολόγιο)

```typescript
interface Invoice {
  // ── Ταυτότητα ──
  invoiceId: string;                    // Auto-generated UUID
  series: string;                       // Σειρά (π.χ. "Α")
  number: number;                       // Αύξων αριθμός (αυτόματος)
  displayNumber: string;                // "Α-42" (computed)
  type: InvoiceType;                    // Enum: service_invoice, sales_invoice, κλπ.
  mydataType: string;                   // myDATA κωδικός (2.1, 1.1, κλπ.)

  // ── Ημερομηνίες ──
  issueDate: string;                    // Ημ/νία έκδοσης (ISO)
  serviceDate: string | null;           // Ημ/νία ολοκλήρωσης υπηρεσίας (αν ≠ issue)
  dueDate: string | null;               // Ημ/νία πληρωμής (αν πίστωση)

  // ── Εκδότης (εμείς) ──
  issuer: {
    companyId: string;                  // → accounting settings
    // Snapshot (δεν αλλάζει αν αλλάξουν τα settings)
    name: string;
    vatNumber: string;                  // ΑΦΜ
    taxOffice: string;                  // ΔΟΥ
    address: string;
    profession: string;                 // "Αρχιτέκτονας Μηχανικός"
    kadCode: string;                    // ΚΑΔ δραστηριότητας
  };

  // ── Πελάτης ──
  customer: {
    contactId: string;                  // → CRM contacts (Firestore)
    // Snapshot
    name: string;
    vatNumber: string;                  // ΑΦΜ πελάτη (κενό αν ιδιώτης χωρίς)
    taxOffice: string;                  // ΔΟΥ πελάτη
    address: string;
    customerType: 'company' | 'individual' | 'public_sector';
  };

  // ── Γραμμές ──
  lineItems: InvoiceLineItem[];

  // ── Σύνολα ──
  subtotalNet: number;                  // Καθαρό ποσό (προ ΦΠΑ)
  vatAmount: number;                    // ΦΠΑ
  totalGross: number;                   // Σύνολο (μετά ΦΠΑ)
  withholdingTaxAmount: number;         // Παρακράτηση φόρου (20% ή 3%)
  withholdingTaxRate: number;           // 0.20 | 0.03 | 0
  totalPayable: number;                 // Πληρωτέο (gross - withholding)

  // ── ΦΠΑ ──
  vatRate: number;                      // 0.24 (24%)
  vatExemptionReason: string | null;    // Αν ΦΠΑ 0%

  // ── Πληρωμή ──
  paymentMethod: PaymentMethod;
  paymentStatus: 'pending' | 'partial' | 'paid';
  payments: InvoicePayment[];           // Ιστορικό πληρωμών

  // ── myDATA ──
  mydataStatus: 'draft' | 'pending' | 'submitted' | 'accepted' | 'rejected';
  mydataMark: string | null;            // ΜΑΡΚ αριθμός (μετά αποδοχή)
  mydataUid: string | null;             // Μοναδικό ID ΑΑΔΕ
  mydataSubmittedAt: string | null;
  mydataErrors: string[];               // Τυχόν σφάλματα ΑΑΔΕ

  // ── Πιστωτικό (αν type = credit_invoice) ──
  relatedInvoiceId: string | null;      // Αναφορά στο αρχικό τιμολόγιο
  creditReason: string | null;

  // ── Φορολογικά ──
  fiscalYear: number;
  quarter: 1 | 2 | 3 | 4;
  kadCode: string;                      // ΚΑΔ (71112000 ή 412xxxxx)

  // ── myDATA Classification ──
  incomeClassification: {
    category: string;                   // "1.3" (Έσοδα Παροχής Υπηρεσιών)
    e3Code: string;                     // Κωδικός Ε3
  };

  // ── Meta ──
  notes: string;                        // Σημειώσεις/παρατηρήσεις
  internalNotes: string;                // Εσωτερικές σημειώσεις (δεν εκτυπώνονται)
  createdAt: string;
  updatedAt: string;
  createdBy: string;                    // userId
}
```

### 3.2 Invoice Line Item (Γραμμή Τιμολογίου)

```typescript
interface InvoiceLineItem {
  lineNumber: number;                   // 1, 2, 3...
  description: string;                  // "Ενεργειακό Πιστοποιητικό (ΠΕΑ)"
  quantity: number;                     // 1
  unit: string;                         // "τεμ.", "ώρες", "τ.μ."
  unitPrice: number;                    // Τιμή μονάδας (καθαρή)
  discount: number;                     // Έκπτωση (0-100%)
  netAmount: number;                    // quantity × unitPrice × (1 - discount)
  vatRate: number;                      // 0.24
  vatAmount: number;                    // netAmount × vatRate
  totalAmount: number;                  // netAmount + vatAmount
}
```

### 3.3 Payment Method

```typescript
type PaymentMethod =
  | 'cash'                              // Μετρητά
  | 'bank_transfer'                     // Τραπεζική κατάθεση
  | 'card'                              // Κάρτα (χρεωστική/πιστωτική)
  | 'check'                             // Επιταγή
  | 'credit'                            // Πίστωση (πληρωμή αργότερα)
  | 'mixed';                            // Μικτός τρόπος

interface InvoicePayment {
  paymentId: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  bankTransactionId: string | null;     // → bank reconciliation
  notes: string;
}
```

---

## 4. Invoice Series (Σειρές Αρίθμησης)

### 4.1 Schema

```typescript
interface InvoiceSeries {
  seriesId: string;
  prefix: string;                       // "Α", "Β", "ΠΙΣ"
  description: string;                  // "Κύρια σειρά τιμολογίων"
  documentTypes: InvoiceType[];         // Ποια παραστατικά εξυπηρετεί
  currentNumber: number;                // Τελευταίος αριθμός
  startNumber: number;                  // Αρχικός (συνήθως 1)
  fiscalYear: number;                   // Σε ποιο έτος ανήκει
  resetOnNewYear: boolean;              // Μηδενίζει κάθε χρόνο;
  isActive: boolean;
  createdAt: string;
}
```

### 4.2 Phase 1 Configuration

| Σειρά | Prefix | Document Types | Σημείωση |
|-------|--------|----------------|----------|
| Κύρια | Α | ΤΠΥ, ΤΠ, ΑΠΥ, ΑΛΠ | Μία σειρά για όλα (Phase 1) |
| Πιστωτικά | ΠΙΣ | Πιστωτικό | Ξεχωριστή σειρά |

### 4.3 Μελλοντικά (Phase 2+)

- Πολλαπλές σειρές ανά τύπο (Α: ΤΠΥ, Β: ΑΠΥ)
- Σειρά ανά υποκατάστημα
- Σειρά ανά ΚΑΔ (αρχιτεκτονικά vs κατασκευαστικά)

---

## 5. Withholding Tax Logic (Παρακράτηση Φόρου)

### 5.1 Decision Tree

```
Τιμολόγιο εκδίδεται
  ↓
Πελάτης = ιδιώτης;
  ΝΑΙ → Παρακράτηση = 0%
  ΟΧΙ ↓
Ποσό ≤ 300€;
  ΝΑΙ → Παρακράτηση = 0% (αλλά δηλώνεται στο ΑΠΥ με κωδ. 10)
  ΟΧΙ ↓
ΚΑΔ = 71112000 (υπηρεσίες);
  ΝΑΙ → Παρακράτηση = 20%
  ΟΧΙ ↓
ΚΑΔ = 412xxxxx (κατασκευές);
  ΝΑΙ → Παρακράτηση = 3%
  ΟΧΙ → Παρακράτηση = 0% (fallback)
```

### 5.2 Υπολογισμός

```
Καθαρό ποσό:       1.000,00€
ΦΠΑ 24%:            +240,00€
Μικτό σύνολο:      1.240,00€
Παρακράτηση 20%:    -200,00€  (επί του καθαρού)
Πληρωτέο:          1.040,00€
```

**Σημαντικό**: Η παρακράτηση υπολογίζεται επί του **καθαρού** ποσού (προ ΦΠΑ).

### 5.3 Implementation

```typescript
function calculateWithholding(invoice: {
  netAmount: number;
  kadCode: string;
  customerType: 'company' | 'individual' | 'public_sector';
}): { rate: number; amount: number } {
  // Ιδιώτες → 0%
  if (invoice.customerType === 'individual') {
    return { rate: 0, amount: 0 };
  }

  // Ποσό ≤ 300€ → 0%
  if (invoice.netAmount <= 300) {
    return { rate: 0, amount: 0 };
  }

  // Υπηρεσίες (71xxxxxx) → 20%
  if (invoice.kadCode.startsWith('71')) {
    return { rate: 0.20, amount: invoice.netAmount * 0.20 };
  }

  // Κατασκευές (41xxxxxx) → 3%
  if (invoice.kadCode.startsWith('41')) {
    return { rate: 0.03, amount: invoice.netAmount * 0.03 };
  }

  return { rate: 0, amount: 0 };
}
```

---

## 6. CRM Integration (Πελάτες)

### 6.1 Contact → Customer Mapping

Η εφαρμογή χρησιμοποιεί τις **υπάρχουσες CRM contacts** (Firestore) ως πελάτες.

```
CRM Contact                      Invoice Customer
─────────────                    ─────────────────
contactId              →         customer.contactId
displayName            →         customer.name
vatNumber (ΑΦΜ)        →         customer.vatNumber
taxOffice (ΔΟΥ)        →         customer.taxOffice
address                →         customer.address
type (individual/co.)  →         customer.customerType
```

### 6.2 Snapshot Pattern

Κατά την έκδοση τιμολογίου, τα στοιχεία πελάτη αποθηκεύονται ως **snapshot** στο τιμολόγιο. Αν αργότερα αλλάξουν τα στοιχεία στο CRM, τα παλιά τιμολόγια **δεν επηρεάζονται** (φορολογική απαίτηση — το τιμολόγιο αντικατοπτρίζει τα στοιχεία κατά την ημ/νία έκδοσης).

### 6.3 ΑΦΜ Validation

- **Ελληνικό ΑΦΜ**: 9 ψηφία, αλγόριθμος modulo
- **ΑΑΔΕ lookup**: Επαλήθευση μέσω ΓΓΠΣ API (μελλοντικό)
- **EU VAT**: VIES validation (αν ενεργοποιηθούν ενδοκοινοτικές)

```typescript
function validateGreekVAT(afm: string): boolean {
  if (afm.length !== 9 || !/^\d{9}$/.test(afm)) return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(afm[i]) * Math.pow(2, 8 - i);
  }
  const check = (sum % 11) % 10;
  return check === parseInt(afm[8]);
}
```

---

## 7. Invoice Workflow (Ροή Έκδοσης)

### 7.1 Manual Flow

```
[1] ΔΗΜΙΟΥΡΓΙΑ
    Χρήστης → "Νέο Τιμολόγιο"
    Επιλογή: τύπος, πελάτης (CRM), γραμμές, ΚΑΔ
    Auto-fill: ΦΠΑ, παρακράτηση, σύνολα
    ↓
[2] PREVIEW
    Προεπισκόπηση τιμολογίου (PDF-like)
    Ο χρήστης ελέγχει τα ποσά
    ↓
[3] ΕΚΔΟΣΗ
    Αυτόματη αρίθμηση (σειρά + αύξων)
    Status → 'draft' → 'pending' (myDATA)
    ↓
[4] myDATA ΔΙΑΒΙΒΑΣΗ
    Αυτόματη αποστολή στο ΑΑΔΕ (ADR-ACC-003)
    ΜΑΡΚ αριθμός → αποθηκεύεται
    Status → 'accepted' ή 'rejected'
    ↓
[5] PDF & ΑΠΟΣΤΟΛΗ (Υβριδικό)
    Generate PDF με ΜΑΡΚ
    Κουμπί "📧 Αποστολή email" → ο χρήστης επιλέγει
    (ΟΧΙ αυτόματο — manual trigger)
    ↓
[6] ΠΛΗΡΩΜΗ
    Καταγραφή πληρωμής (μετρητά/τράπεζα/κάρτα)
    → Αυτόματη εγγραφή στο Βιβλίο Ε-Ε (M-002)
    → Bank reconciliation matching (M-009)
```

### 7.2 AI-Assisted Flow (μέσω Telegram/Voice)

```
Admin: "Τιμολόγησε τον Παπαδόπουλο 500€ για ΠΕΑ"
  ↓
[1] AI Intent → admin_create_invoice (νέο UC module)
[2] AI Entities → recipient: "Παπαδόπουλος", amount: 500, service: "ΠΕΑ"
[3] CRM Lookup → findContactByName("Παπαδόπουλος")
[4] Auto-determine:
    - Τύπος: ΤΠΥ (πελάτης = εταιρεία) ή ΑΠΥ (πελάτης = ιδιώτης)
    - ΚΑΔ: 71112000 (υπηρεσίες)
    - ΦΠΑ: 500 × 24% = 120€
    - Παρακράτηση: 500 × 20% = 100€ (αν εταιρεία + >300€)
    - Πληρωτέο: 500 + 120 - 100 = 520€
[5] Admin confirms via Telegram
[6] Invoice created → myDATA → PDF
```

---

## 8. Invoice PDF Template

### 8.1 Layout

```
┌─────────────────────────────────────────────────────┐
│  ΕΚΔΟΤΗΣ                              ΤΙΜΟΛΟΓΙΟ     │
│  Παγώνης Νέστ. Γεώργιος               Παροχής       │
│  Αρχιτέκτων Μηχανικός                 Υπηρεσιών     │
│  ΑΦΜ: xxxxxxxxx                                     │
│  ΔΟΥ: xxxxxxxx                        Σειρά: Α      │
│  Σαμοθράκης 16, 563 34                Αρ.: 42       │
│  Ελευθέριο Κορδελιό, Θεσσαλονίκη     Ημ/νία: ...   │
│  Τ: 2310 55 95 95 | Μ: 6974 050 023                 │
│─────────────────────────────────────────────────────│
│  ΠΕΛΑΤΗΣ                                             │
│  Επωνυμία: ...                                       │
│  ΑΦΜ: ...                ΔΟΥ: ...                   │
│  Διεύθυνση: ...                                      │
│─────────────────────────────────────────────────────│
│  # │ Περιγραφή          │ Ποσ. │ Τιμή  │ Σύνολο    │
│  1 │ Ενεργειακό Πιστ.   │  1   │500,00 │ 500,00    │
│─────────────────────────────────────────────────────│
│                            Καθαρό:      500,00€      │
│                            ΦΠΑ 24%:     120,00€      │
│                            Μικτό:       620,00€      │
│                            Παρακρ. 20%: -100,00€     │
│                            ─────────────────         │
│                            ΠΛΗΡΩΤΕΟ:    520,00€      │
│─────────────────────────────────────────────────────│
│  Τρόπος πληρωμής: Τραπεζική κατάθεση                │
│  ΕΘΝΙΚΗ ΤΡΑΠΕΖΑ                                      │
│  IBAN: GR68 0110 2230 0000 2234 0068 448             │
│─────────────────────────────────────────────────────│
│  myDATA MARK: XXXXXXXXXXXXXXXX                       │
│  ΚΑΔ: 71112000                                       │
│─────────────────────────────────────────────────────│
│  Σημειώσεις: ...                                     │
│  Γλώσσα: Ελληνικά                                    │
└─────────────────────────────────────────────────────┘
```

### 8.2 PDF Generation

- **Server-side**: React PDF (`@react-pdf/renderer`) ή `puppeteer`
- **License**: MIT (επιτρεπτή)
- **Template**: Config-driven (logo, IBAN, σημειώσεις)
- **MARK**: Εμφανίζεται μόνο αν myDATA accepted

---

## 9. Service Types (Τυπολόγιο Υπηρεσιών)

Προκαθορισμένες υπηρεσίες για γρήγορη τιμολόγηση:

| Κωδικός | Υπηρεσία | ΚΑΔ | Μονάδα | Σημείωση |
|---------|----------|-----|--------|----------|
| `pea` | Πιστοποιητικό Ενεργειακής Απόδοσης (ΠΕΑ) | 71112000 | τεμ. | |
| `arch_study` | Αρχιτεκτονική Μελέτη | 71112000 | τεμ. | |
| `building_permit` | Οικοδομική Άδεια | 71112000 | τεμ. | Μέσω e-Άδειες |
| `legalization` | Ρύθμιση Αυθαιρέτου | 71112000 | τεμ. | N.4495/2017 |
| `building_id` | Ηλεκτρονική Ταυτότητα Κτιρίου | 71112000 | τεμ. | |
| `inspection` | Αυτοψία / Τεχνική Έκθεση | 71112000 | ώρες | |
| `supervision` | Επίβλεψη Έργου | 71112000 | μήνα | |
| `consulting` | Τεχνική Συμβουλευτική | 71112000 | ώρες | |
| `construction` | Κατασκευαστικές Εργασίες | 41202003 | κ.α. | Εργολαβία |
| `construction_res` | Κατασκευαστικές Εργασίες (Οικιστικά) | 41201001 | κ.α. | Εργολαβία |
| `custom` | Άλλη Υπηρεσία | config | — | Ελεύθερη περιγραφή |

**Config-driven**: Ο χρήστης μπορεί να προσθέσει δικές του υπηρεσίες.

---

## 10. Issuer Defaults (Στοιχεία Εκδότη)

Αποθηκεύονται στο `accounting/{companyId}/settings/invoicing`:

```typescript
interface InvoicingSettings {
  issuer: {
    displayName: string;     // "Παγώνης Νέστ. Γεώργιος"
    profession: string;      // "Αρχιτέκτων Μηχανικός"
    address: {
      street: string;        // "Σαμοθράκης 16"
      postalCode: string;    // "563 34"
      city: string;          // "Ελευθέριο Κορδελιό"
      region: string;        // "Θεσσαλονίκη"
    };
    phone: string;           // "2310 55 95 95"
    mobile: string;          // "6974 050 023"
  };
  bankAccounts: Array<{
    bankName: string;        // "ΕΘΝΙΚΗ ΤΡΑΠΕΖΑ"
    iban: string;            // "GR68 0110 2230 0000 2234 0068 448"
    isDefault: boolean;      // true
  }>;
  language: 'el';            // Μόνο ελληνικά
  cashLimit: 500;            // Hard block >500€
  emailDelivery: 'hybrid';   // 'auto' | 'hybrid' | 'manual'
}
```

> **Σημείωση**: Τα ευαίσθητα στοιχεία (ΑΦΜ, ΔΟΥ) αποθηκεύονται στο company settings (ADR-ACC-000), ΟΧΙ hardcoded.

---

## 11. Firestore Structure

```
accounting/{companyId}/
  ├── settings/
  │   └── invoicing                     ← Series config, defaults, IBAN, issuer
  │
  ├── invoice_series/{seriesId}         ← Σειρές αρίθμησης
  │
  ├── invoices/{invoiceId}              ← Τιμολόγια
  │   └── payments/{paymentId}          ← Πληρωμές (subcollection)
  │
  └── service_catalog/{serviceId}       ← Κατάλογος υπηρεσιών
```

---

## 12. UI Pages

| Route | Σελίδα | Λειτουργία |
|-------|--------|------------|
| `/accounting/invoices` | Λίστα Τιμολογίων | Φίλτρα: ημ/νία, πελάτης, status, myDATA |
| `/accounting/invoices/new` | Νέο Τιμολόγιο | Φόρμα έκδοσης |
| `/accounting/invoices/[id]` | Προβολή | Details + PDF preview + payment history |
| `/accounting/invoices/[id]/edit` | Επεξεργασία | Μόνο αν draft (πριν myDATA) |
| `/accounting/invoices/[id]/pdf` | PDF | Generate & download |
| `/accounting/invoices/[id]/credit` | Πιστωτικό | Δημιουργία πιστωτικού για αυτό |

---

## 13. Validation Rules

| Κανόνας | Τύπος | Μήνυμα |
|---------|-------|--------|
| Πελάτης required | error | "Επιλέξτε πελάτη" |
| ≥1 γραμμή | error | "Προσθέστε τουλάχιστον μία γραμμή" |
| Ποσό > 0 | error | "Το ποσό πρέπει να είναι θετικό" |
| ΑΦΜ πελάτη (αν εταιρεία) | error | "Εισάγετε ΑΦΜ πελάτη" |
| ΑΦΜ format | error | "Μη έγκυρο ΑΦΜ" |
| ΚΑΔ required | error | "Επιλέξτε ΚΑΔ δραστηριότητας" |
| Μεγάλο ποσό (>10.000€) | warning | "Ελέγξτε το ποσό" |
| Πληρωμή μετρητά >500€ | **error** | "Απαγορεύεται πληρωμή μετρητών >500€ (Ν.4446/2016)" |

---

## 14. Income Classification (myDATA)

| Τύπος Παραστατικού | Κατηγορία Εσόδων | Κωδικός Ε3 |
|--------------------|--------------------|------------|
| ΤΠΥ (2.1) — Υπηρεσίες | category1_3 (Έσοδα Παροχής Υπηρεσιών) | 561_003 |
| ΤΠ (1.1) — Κατασκευές | category1_1 (Έσοδα Πώλησης Αγαθών) | 561_001 |
| ΑΠΥ (11.2) | category1_3 | 561_003 |
| Πιστωτικό (5.1) | Αντιλογισμός αρχικής κατηγορίας | — |

---

## 15. Dependencies

| Module | Σχέση | Περιγραφή |
|--------|-------|-----------|
| **M-001** (Company Setup) | **BLOCKED BY** | Χρειάζεται settings (ΑΦΜ, ΔΟΥ, ΚΑΔ, IBAN) |
| **M-002** (Income/Expense Book) | **FEEDS** | Κάθε τιμολόγιο → εγγραφή εσόδου |
| **M-004** (myDATA) | **TRIGGERS** | Κάθε τιμολόγιο → myDATA διαβίβαση |
| **M-005** (VAT Engine) | **FEEDS** | ΦΠΑ εκροών → τριμηνιαία δήλωση |
| **M-009** (Bank Reconciliation) | **LINKS** | Πληρωμή → αντιστοίχιση τραπεζ. κίνησης |
| **CRM Contacts** | **READS** | Πελάτης = CRM contact |

---

## 16. Open Questions

| # | Ερώτηση | Status | Απάντηση |
|---|---------|--------|----------|
| 1 | IBAN — ποια τράπεζα; | RESOLVED | Εθνική Τράπεζα: `GR68 0110 2230 0000 2234 0068 448` |
| 2 | Logo/Header — στοιχεία εκδότη | RESOLVED | Παγώνης Νέστ. Γεώργιος, Αρχιτέκτων Μηχανικός, Σαμοθράκης 16, 563 34, Ελευθέριο Κορδελιό, Θεσσαλονίκη, Τ: 2310 55 95 95, Μ: 6974 050 023 |
| 3 | Γλώσσα τιμολογίου | RESOLVED | Μόνο ελληνικά |
| 4 | Μετρητά >500€ | RESOLVED | **Αυστηρό block** — δεν επιτρέπεται έκδοση |
| 5 | Auto-email τιμολογίου | RESOLVED | **Υβριδικό** — κουμπί "Αποστολή email" (όχι αυτόματο, ο χρήστης επιλέγει) |

---

## 17. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-09 | ADR Created — Invoicing system design | Γιώργος + Claude Code |
| 2026-02-09 | Phase 1: 1 σειρά (Α), modular για πολλαπλές | Γιώργος |
| 2026-02-09 | Snapshot pattern: στοιχεία πελάτη freeze κατά έκδοση | Claude Code |
| 2026-02-09 | Παρακράτηση: auto-detect από ΚΑΔ + customerType + ποσό | Claude Code |
| 2026-02-09 | Service catalog: 11 προκαθορισμένες + custom | Claude Code |
| 2026-02-09 | PDF: server-side generation (react-pdf ή puppeteer) | Claude Code |
| 2026-02-09 | IBAN: Εθνική Τράπεζα GR68 0110 2230 0000 2234 0068 448 | Γιώργος |
| 2026-02-09 | Header: "Παγώνης Νέστ. Γεώργιος — Αρχιτέκτων Μηχανικός" | Γιώργος |
| 2026-02-09 | Γλώσσα: Μόνο ελληνικά (no dual language) | Γιώργος |
| 2026-02-09 | Μετρητά >500€: Hard block (ΟΧΙ warning) | Γιώργος |
| 2026-02-09 | Email αποστολή: Υβριδικό — manual trigger, όχι αυτόματο | Γιώργος |
| 2026-02-09 | **Phase 1 implemented** — types/invoice.ts: Invoice, InvoiceType (7 τύποι), InvoiceLineItem, InvoicePayment, InvoiceIssuer, InvoiceCustomer, VatBreakdown, InvoiceMyDataMeta, InvoiceSeries, InvoiceFilters, Create/Update inputs. Imports CurrencyCode from contacts/banking | Claude Code |
| 2026-02-09 | **Phase 2 implemented** — types/interfaces.ts: IAccountingRepository with createInvoice, getInvoice, updateInvoice, listInvoices, getNextInvoiceNumber, getInvoiceSeries methods | Claude Code |

---

### Phase 3 (2026-02-09)

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-09 | **Phase 3 implemented** — services/repository/firestore-accounting-repository.ts: 6 invoice CRUD methods (create, get, update, list, delete, getNextNumber). Atomic invoice counter via `db.runTransaction()` on `accounting_invoice_counters` collection. `listInvoices()` with pagination + filters (series, type, paymentStatus, fiscalYear, quarter, dateRange). services/accounting-service.ts: `createJournalEntryFromInvoice()` auto-generates income journal entry | Claude Code |

---

### Phase 4 — UI Layer (2026-02-09)

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-09 | **Phase 4 implemented** — Full UI layer for invoicing. 78 files total across all accounting modules | Claude Code |
| 2026-02-09 | **API Routes** (4 routes): `GET/POST /api/accounting/invoices`, `GET/PATCH/DELETE /api/accounting/invoices/[id]`, `GET /api/accounting/invoices/series`, `GET /api/accounting/invoices/next-number` | Claude Code |
| 2026-02-09 | **Hooks** (2): `useInvoices` (list with filters, create), `useInvoice` (single with update) | Claude Code |
| 2026-02-09 | **Invoice List**: `InvoicesPageContent` + `InvoicesTable` + `InvoiceRow` + `InvoiceFilters` (year, type, paymentStatus) | Claude Code |
| 2026-02-09 | **Invoice Form**: `InvoiceForm` + `LineItemsEditor` (dynamic add/remove, real-time VAT calc) + `CustomerSelector` + `InvoicePreview` (live totals with VAT breakdown by rate) | Claude Code |
| 2026-02-09 | **Invoice Details**: `InvoiceDetails` + `InvoiceSummaryCard` (customer, dates, status, totals) + `InvoiceActionsMenu` (print, download, email — UI stubs) | Claude Code |
| 2026-02-09 | **Dashboard**: `AccountingDashboard` with 4 stat cards (income, expenses, VAT owed, pending invoices) + quick action buttons | Claude Code |
| 2026-02-09 | **Shared UI**: `VATRateSelector` (24/13/6/0%), `PaymentMethodSelector`, `FiscalYearPicker`, `ExpenseCategoryPicker` (5 income + 19 expense categories) | Claude Code |
| 2026-02-09 | **Page Routes**: 9 Next.js pages under `/accounting/` (dashboard, invoices, new, journal, vat, bank, efka, assets, reports) | Claude Code |
| 2026-09-14 | 🗑️ **Το `useInvoices` (πληθυντικός) ΔΙΑΓΡΑΦΗΚΕ** — αχρησιμοποίητο **και** λάθος. Διάβαζε `data.invoices`, ενώ η διαδρομή απαντά `ok(result)` ⇒ `{success, data:{**items**}}`, και το `createInvoice` του διάβαζε `result.id` ενώ η διαδρομή στέλνει `created({**invoiceId**…})`. Κανένας καλών: μόνο το barrel το εξήγε — γι' αυτό **δεν** το είχε δει ούτε το knip (CHECK 3.22): το barrel export κρύβει τον νεκρό κώδικα. Η ζωντανή οθόνη `InvoicesPageContent.tsx:174` διαβάζει **σωστά** `json.data?.items` με δικό της κώδικα και **δεν** μεταναστεύει σε shared hook: αφαίρεση με **έναν** καλούντα είναι πρόωρη (Rule of Three). Το `useInvoice` (ενικός) **μένει**. Λόγος γραμμένος στο `hooks/index.ts`. Πλαίσιο: ADR-787 Φάση Β / Β2 | Claude Opus 5 |

*ADR Format based on: Michael Nygard's Architecture Decision Records*
