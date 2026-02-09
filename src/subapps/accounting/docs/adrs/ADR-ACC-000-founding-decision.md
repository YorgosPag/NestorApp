# ADR-ACC-000: Founding Decision — Enterprise Accounting Subapp

| Metadata | Value |
|----------|-------|
| **Status** | DRAFT |
| **Date** | 2026-02-09 |
| **Category** | Accounting / Architecture |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Parent App** | NestorApp (`src/subapps/accounting/`) |

---

## 1. Vision

Πλήρες λογιστικό πρόγραμμα ως **αποσπώμενη υπο-εφαρμογή** (subapp) του NestorApp. Σχεδιασμένο για:

- **Αρχική χρήση**: Ατομική επιχείρηση αρχιτέκτονα-μηχανικού (Γιώργος Παγώνης)
- **Μελλοντική επέκταση**: ΟΕ, ΕΠΕ, ΑΕ
- **Πιθανή εμπορική εκμετάλλευση**: SaaS για ατομικές επιχειρήσεις

### Βασικές Αρχές

1. **Modular Architecture** — κάθε λειτουργία ως ανεξάρτητο module
2. **AI-First** — τεχνητή νοημοσύνη σε κάθε στάδιο (classification, data extraction, suggestions)
3. **Portable** — αποσπώμενη από το NestorApp χωρίς breaking changes
4. **Compliance-Ready** — myDATA/ΑΑΔΕ, ΕΛΠ, ΕΦΚΑ
5. **CRM Integration** — σύνδεση με υπάρχον CRM (Firestore contacts)

---

## 2. Company Type Strategy — Πυραμίδα Layers

```
Layer 1 (Sole Proprietor):  Β' Κατηγορίας — Έσοδα/Έξοδα + ΦΠΑ + myDATA + Τιμολόγηση
Layer 2 (ΟΕ/ΕΕ):           + Μερίδια εταίρων + Κατανομή κερδών
Layer 3 (ΕΠΕ):             + Γ' Κατηγορίας — Γενικό Καθολικό + Ισολογισμός
Layer 4 (ΑΕ):              + Μετοχικό κεφάλαιο + ΔΣ + ΓΕΜΗ
```

### Phase 1: Ατομική Επιχείρηση (CURRENT TARGET)

| Χαρακτηριστικό | Τιμή |
|----------------|-------|
| **Λογιστικό σύστημα** | Απλογραφικό (Β' Κατηγορίας) |
| **Κύριο βιβλίο** | Βιβλίο Εσόδων-Εξόδων |
| **ΦΠΑ** | 24% — Τριμηνιαία δήλωση |
| **Φορολογικό έτος** | Ημερολογιακό (Ιανουάριος - Δεκέμβριος) |
| **Φόρος εισοδήματος** | Κλίμακα φυσικών προσώπων (ελεύθεροι επαγγελματίες) |
| **Ασφαλιστικός φορέας** | ΕΦΚΑ (πρώην ΤΣΜΕΔΕ/ΤΕΕ) |
| **myDATA** | Αυτόματη διαβίβαση μέσω ΑΑΔΕ API |

### Στοιχεία Επιχείρησης Γιώργου (από Taxisnet)

| Πεδίο | Τιμή |
|-------|-------|
| Κατάσταση | ΕΝΕΡΓΗ |
| Διεύθυνση | Σαμοθράκης 16, ΤΚ 56334, Ελευθέριο |
| Κατηγορία βιβλίων | Β' — Απλογραφικά |
| Λήξη διαχειριστικής περιόδου | 31/12 |
| ΦΠΑ | ΝΑΙ — Κανονικό καθεστώς |
| Ενδοκοινοτικές | ΟΧΙ |
| Επάγγελμα | Αρχιτέκτονας Μηχανικός |
| Επιμελητήριο | ΤΕΕ (Τεχνικό Επιμελητήριο Ελλάδος) |

### ΚΑΔ — Ενεργές Δραστηριότητες (από Taxisnet)

| ΚΑΔ | Δραστηριότητα | Είδος | Από |
|-----|---------------|-------|-----|
| **71112000** | Υπηρεσίες αρχιτεκτόνων για κτίρια | Κύρια | 01/12/2008 |
| **41202003** | Γενικές κατασκευαστικές εργασίες για μη οικιστικά κτίρια (ίδια υλικά) | Δευτερεύουσα | 01/12/2008 |
| **41201001** | Γενικές κατασκευαστικές εργασίες για οικιστικά κτίρια (ίδια υλικά) | Δευτερεύουσα | 01/12/2008 |

**Σημασία για τιμολόγηση:**
- Αρχιτεκτονικές μελέτες / ΠΕΑ / Άδειες → ΚΑΔ **71112000** + παρακράτηση **20%** (αν >300€ σε νομικό)
- Κατασκευαστικά έργα → ΚΑΔ **41202003** ή **41201001** + παρακράτηση **3%** (αν >300€)

### Ιστορικές ΚΑΔ (ανενεργές — για reference)

| ΚΑΔ | Δραστηριότητα | Περίοδος |
|-----|---------------|----------|
| 74200000 | Δραστηριότητες αρχιτεκτόνων και μηχανικών | ~1900–1987 |
| 74202000 | Αρχιτεκτονικές υπηρεσίες | 1987–2008 |
| 45211200 | Γενικές κατασκευαστικές εργασίες για πολυκατοικίες | 2001–2008 |

---

## 3. Module Architecture

### 3.1 Core Modules (Phase 1 — Ατομική)

```
accounting/
  ├── modules/
  │   ├── company-setup/         ← M-001: Ρύθμιση επιχείρησης (ΑΦΜ, ΚΑΔ, ΔΟΥ)
  │   ├── income-expense/        ← M-002: Βιβλίο Εσόδων-Εξόδων
  │   ├── invoicing/             ← M-003: Τιμολόγηση (ΤΠΥ, ΑΠΥ, πιστωτικά)
  │   ├── mydata/                ← M-004: myDATA/ΑΑΔΕ integration
  │   ├── vat-engine/            ← M-005: ΦΠΑ (υπολογισμός, τριμηνιαία δήλωση)
  │   ├── expense-tracker/       ← M-006: Δαπάνες (AI classification)
  │   ├── efka-tracker/          ← M-007: ΕΦΚΑ εισφορές
  │   ├── fixed-assets/          ← M-008: Πάγια + Αποσβέσεις
  │   ├── bank-reconciliation/   ← M-009: Τραπεζικοί λογαριασμοί
  │   └── reports/               ← M-010: Αναφορές + Εκτυπώσεις
  │
  ├── ai/                        ← AI integration layer
  │   ├── document-classifier/   ← Αναγνώριση τύπου εγγράφου (τιμολόγιο, απόδειξη, κλπ.)
  │   ├── data-extractor/        ← Εξαγωγή δεδομένων από PDF/scan
  │   └── smart-categorizer/     ← Αυτόματη κατηγοριοποίηση δαπανών
  │
  ├── config/                    ← Configuration
  │   ├── chart-of-accounts.ts   ← Λογαριασμοί (ΕΛΠ)
  │   ├── vat-rates.ts           ← Συντελεστές ΦΠΑ
  │   ├── kad-registry.ts        ← ΚΑΔ codes
  │   ├── expense-categories.ts  ← Κατηγορίες δαπανών
  │   └── company-types.ts       ← Discriminator: ατομική/ΟΕ/ΕΠΕ/ΑΕ
  │
  ├── types/                     ← TypeScript interfaces
  ├── services/                  ← Business logic
  ├── hooks/                     ← React hooks
  ├── components/                ← UI components
  └── integration/               ← Entry point (DI, layout, routing)
```

### 3.2 Module Descriptions

| Module | ID | Σκοπός | AI Integration |
|--------|----|--------|----------------|
| **Company Setup** | M-001 | Ρύθμιση επιχείρησης, ΑΦΜ, ΚΑΔ, ΔΟΥ, σειρές τιμολογίων | — |
| **Income/Expense Book** | M-002 | Βιβλίο Εσόδων-Εξόδων (SSoT) | — |
| **Invoicing** | M-003 | Έκδοση ΤΠΥ, ΑΠΥ, Πιστωτικών. Σειρές αρίθμησης. CRM contacts integration | AI: draft τιμολογίου |
| **myDATA** | M-004 | Αυτόματη διαβίβαση παραστατικών στο ΑΑΔΕ μέσω API | — |
| **VAT Engine** | M-005 | Υπολογισμός ΦΠΑ, τριμηνιαία δήλωση, ΦΠΑ εκροών/εισροών | — |
| **Expense Tracker** | M-006 | Καταγραφή δαπανών από PDF/scan/χειροκίνητα | AI: classification + extraction |
| **EFKA Tracker** | M-007 | Εισφορές ΕΦΚΑ/ΤΕΕ, πληρωμές, υπολείπονται | — |
| **Fixed Assets** | M-008 | Μητρώο παγίων, αποσβέσεις (φορολογικές) | — |
| **Bank Reconciliation** | M-009 | Τραπεζικοί λογαριασμοί, αντιστοίχιση κινήσεων | AI: smart matching |
| **Reports** | M-010 | Εκτυπώσεις, ΦΠΑ αναφορές, Εσόδων-Εξόδων, κλπ. | — |

---

## 4. AI Integration Strategy

Η AI pipeline (ADR-080) ήδη υποστηρίζει document classification. Για το accounting:

### 4.1 Document AI (Expense Tracker — M-006)

```
PDF/Scan εισέρχεται
  ↓
[1] AI Document Classifier → τιμολόγιο_αγοράς / απόδειξη / τραπεζικό_extract / κλπ.
[2] AI Data Extractor → ΑΦΜ εκδότη, ποσό, ΦΠΑ, ημερομηνία, περιγραφή
[3] AI Smart Categorizer → κατηγορία δαπάνης (καύσιμα, ενοίκιο, κλπ.)
[4] Human Review → ο χρήστης επιβεβαιώνει/διορθώνει
[5] Auto-book → εγγραφή στο Βιβλίο Εσόδων-Εξόδων
```

### 4.2 Invoice AI (Invoicing — M-003)

```
Χρήστης: "Τιμολόγησε τον Παπαδόπουλο 500€ για ενεργειακό πιστοποιητικό"
  ↓
[1] AI Intent → admin_create_invoice
[2] AI Entity Extraction → πελάτης: Παπαδόπουλος, ποσό: 500€, υπηρεσία: ΠΕΑ
[3] CRM Lookup → βρες επαφή "Παπαδόπουλος"
[4] Draft Invoice → ΤΠΥ με ΦΠΑ 24% = 620€
[5] Human Review → admin επιβεβαιώνει
[6] myDATA → αυτόματη διαβίβαση
```

### 4.3 Bank AI (Reconciliation — M-009)

```
Τραπεζική κίνηση εισέρχεται
  ↓
[1] AI Pattern Recognition → αναγνώριση επαναλαμβανόμενων πληρωμών
[2] AI Smart Matching → αντιστοίχιση με τιμολόγιο/δαπάνη
[3] Human Confirm → ο χρήστης επιβεβαιώνει
```

---

## 5. Data Architecture (Firestore)

### 5.1 Collections

```
accounting/
  ├── {companyId}/                         ← Multi-company support
  │   ├── settings                         ← Company config (ΑΦΜ, ΚΑΔ, ΔΟΥ, σειρές)
  │   ├── fiscal_years/{yearId}            ← Φορολογικά έτη
  │   ├── journal_entries/{entryId}        ← Εγγραφές εσόδων/εξόδων
  │   ├── invoices/{invoiceId}             ← Εκδοθέντα τιμολόγια
  │   ├── received_documents/{docId}       ← Εισερχόμενα παραστατικά (δαπάνες)
  │   ├── vat_periods/{periodId}           ← Περίοδοι ΦΠΑ (τρίμηνα)
  │   ├── fixed_assets/{assetId}           ← Πάγια
  │   ├── bank_accounts/{accountId}        ← Τραπεζικοί λογαριασμοί
  │   │   └── transactions/{txId}          ← Κινήσεις
  │   ├── efka_payments/{paymentId}        ← Πληρωμές ΕΦΚΑ
  │   ├── mydata_submissions/{subId}       ← myDATA αποστολές (audit trail)
  │   └── contacts_link/                   ← Σύνδεση με CRM contacts
  │
  └── shared/
      ├── chart_of_accounts                ← Λογιστικό σχέδιο ΕΛΠ
      ├── vat_rates                         ← Συντελεστές ΦΠΑ (config)
      ├── kad_registry                      ← ΚΑΔ codes
      └── expense_categories               ← Κατηγορίες δαπανών
```

### 5.2 Key Document Schemas

#### Invoice (Τιμολόγιο)

```typescript
interface Invoice {
  invoiceId: string;              // Auto-generated
  series: string;                 // Σειρά (π.χ. "Α")
  number: number;                 // Αύξων αριθμός
  type: InvoiceType;              // ΤΠΥ | ΑΠΥ | ΠΙΣΤΩΤΙΚΟ | ...
  issueDate: string;              // ISO date
  // Πελάτης
  customerContactId: string;      // → CRM contact
  customerName: string;           // Snapshot
  customerVatNumber: string;      // ΑΦΜ πελάτη
  customerTaxOffice: string;      // ΔΟΥ πελάτη
  // Γραμμές
  lineItems: InvoiceLineItem[];
  // Σύνολα
  netAmount: number;              // Καθαρό ποσό
  vatAmount: number;              // ΦΠΑ
  totalAmount: number;            // Σύνολο
  vatRate: number;                // Συντελεστής ΦΠΑ
  // myDATA
  mydataMark: string | null;      // ΜΑΡΚ αριθμός (μετά διαβίβαση)
  mydataUid: string | null;       // UID
  mydataStatus: 'pending' | 'submitted' | 'accepted' | 'rejected';
  // Πληρωμή
  paymentMethod: PaymentMethod;
  paymentStatus: 'pending' | 'partial' | 'paid';
  // Meta
  fiscalYear: number;
  quarter: 1 | 2 | 3 | 4;
  kadCode: string;                // ΚΑΔ δραστηριότητας
  createdAt: string;
  updatedAt: string;
}
```

#### Journal Entry (Εγγραφή Εσόδων/Εξόδων)

```typescript
interface JournalEntry {
  entryId: string;
  type: 'income' | 'expense';
  date: string;                   // Ημερομηνία συναλλαγής
  description: string;
  category: string;               // Κατηγορία (service_income, fuel, rent, κλπ.)
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
  vatRate: number;
  // Πηγή
  sourceType: 'invoice' | 'received_document' | 'manual';
  sourceId: string | null;        // invoiceId ή receivedDocId
  // Αντιστοίχιση
  contactId: string | null;       // → CRM contact
  bankTransactionId: string | null;
  // AI
  aiClassified: boolean;
  aiConfidence: number | null;
  // Meta
  fiscalYear: number;
  quarter: 1 | 2 | 3 | 4;
  createdAt: string;
}
```

---

## 6. External Integrations

| Integration | API | Σκοπός | Phase |
|-------------|-----|--------|-------|
| **ΑΑΔΕ myDATA** | REST API | Διαβίβαση παραστατικών | Phase 1 |
| **ΑΑΔΕ ΓΓΠΣ** | SOAP/REST | Αναζήτηση ΑΦΜ, επαλήθευση | Phase 1 |
| **NestorApp CRM** | Firestore | Contacts (πελάτες/προμηθευτές) | Phase 1 |
| **NestorApp AI Pipeline** | Internal | Document classification, data extraction | Phase 1 |
| **Τράπεζες** | Manual CSV/OFX | Import τραπεζικών κινήσεων | Phase 1 |
| **Τράπεζες** | Open Banking API | Auto-sync κινήσεων | Phase 2+ |
| **ΕΦΚΑ** | Manual | Καταχώρηση εισφορών | Phase 1 |

---

## 7. Tax Engine Architecture

### 7.1 ΦΠΑ Engine

```typescript
interface VATEngine {
  // Config-driven rates
  rates: VATRate[];               // 24%, 13%, 6%, 0% (εξαιρούμενα)

  // Τριμηνιαίοι υπολογισμοί
  calculateQuarter(year: number, quarter: 1|2|3|4): VATDeclaration;

  // Εκκαθαριστική
  calculateAnnual(year: number): VATAnnualDeclaration;
}
```

### 7.2 Income Tax Engine (Ατομική)

```typescript
interface IncomeTaxEngine {
  // Κλίμακα φυσικών προσώπων (ελεύθεροι επαγγελματίες)
  brackets: TaxBracket[];         // 9%, 22%, 28%, 36%, 44%

  // Προκαταβολή φόρου
  prepaymentRate: number;         // 55% (ελ. επαγγελματίας) ή 100% (>3 χρόνια)

  // Τέλος επιτηδεύματος
  professionalTax: number;        // 650€/έτος (κανονικό) ή 325€ (μικρές πόλεις)

  calculateAnnualTax(income: number, expenses: number): TaxResult;
}
```

### 7.3 Παρακράτηση Φόρου (Withholding Tax) — Μηχανικός/Αρχιτέκτονας

Η εφαρμογή πρέπει να χειρίζεται **3 διαφορετικούς συντελεστές παρακράτησης**:

| Τύπος | Συντελεστής | Πότε | Όριο |
|-------|-------------|------|------|
| **Αμοιβή επαγγελματικών υπηρεσιών** | 20% | Πελάτης = νομικό πρόσωπο ή ΔΦ με επιχ. δραστηριότητα | >300€ |
| **Κατασκευαστικά / Τεχνικά έργα** | 3% | Εργολαβία κατασκευής | >300€ |
| **Μελέτες + Σχέδια (προκαταβολή)** | 4% | Εκπόνηση μελετών, πριν έγκριση | Εφαρμόζεται πάντα |
| **Επίβλεψη έργων (προκαταβολή)** | 10% | Επίβλεψη εκτέλεσης | Εφαρμόζεται πάντα |

```typescript
interface WithholdingTaxEngine {
  /** Κανόνες παρακράτησης */
  rules: WithholdingRule[];

  /** Υπολογισμός παρακράτησης ανά τιμολόγιο */
  calculate(invoice: Invoice): WithholdingResult;
  // Αν ποσό ≤ 300€ → 0% (για 20% & 3%)
  // Αν πελάτης = ιδιώτης → 0%
  // Αν πελάτης = νομικό πρόσωπο + υπηρεσίες → 20%
  // Αν πελάτης = δημόσιο + κατασκευή → 3%

  /** Βεβαιώσεις αμοιβών (ΑΠΥ) — ετήσια */
  // Κωδικός 1: Αμοιβές ΜΕ παρακράτηση 20%
  // Κωδικός 10: Αμοιβές ΧΩΡΙΣ παρακράτηση (<300€)
  generateAnnualCertificate(year: number): WithholdingCertificate;
}
```

### 7.4 ΕΦΚΑ Engine (ΤΣΜΕΔΕ/ΤΕΕ — Ακριβή Ποσά)

**Γιώργος: 1η κατηγορία σε ΟΛΑ (Κύρια, Επικουρική, Εφάπαξ)**

#### Ανάλυση ανά Κλάδο — Πραγματικά Ποσά (12/2025)

| Κλάδος | Μηνιαία Εισφορά | Σημείωση |
|--------|-----------------|----------|
| Κλάδος Σύνταξης | 180,58€ | Κύρια σύνταξη |
| Κλάδος Υγείας σε Είδος | 58,25€ | Παροχές σε είδος |
| Κλάδος Υγείας σε Χρήμα | 5,82€ | Παροχές σε χρήμα |
| ΟΑΕΔ | 10,00€ | Εισφορά ανεργίας |
| Επικουρική Ασφάλιση | 45,43€ | 1η κατηγορία |
| Εφάπαξ Παροχή | 30,29€ | 1η κατηγορία |
| **ΜΗΝΙΑΙΑ ΕΙΣΦΟΡΑ** | **330,37€** | |
| **Ετήσιο σύνολο** | **3.964,44€** | 12 × 330,37€ |

#### 6 Κατηγορίες Κύριας Ασφάλισης (2026 — +2,5%)

| Κατηγορία | Μηνιαία 2026 | Ετήσιο |
|-----------|-------------|--------|
| **1η (ελάχιστη)** ← Γιώργος | 261,01€ | 3.132,12€ |
| 2η | 311,22€ | 3.734,64€ |
| 3η | 370,99€ | 4.451,88€ |
| 4η | 443,90€ | 5.326,80€ |
| 5η | 529,96€ | 6.359,52€ |
| 6η (μέγιστη) | 686,53€ | 8.238,36€ |

#### 3 Κατηγορίες Επικουρικής (2026)

| Κατηγορία | Μηνιαία |
|-----------|--------|
| **1η** ← Γιώργος | 46,61€ |
| 2η | 56,18€ |
| 3η | 66,95€ |

#### 3 Κατηγορίες Εφάπαξ (2026)

| Κατηγορία | Μηνιαία |
|-----------|--------|
| **1η** ← Γιώργος | 31,08€ |
| 2η | 37,06€ |
| 3η | 44,22€ |

#### Πληρωμή

- **Εμπρόθεσμη πληρωμή**: Τέλος μήνα (πχ. 30/01 για 12/2025)
- **Πρόσθετα τέλη**: Αν ληξιπρόθεσμο, προστίθεται τόκος (πχ. 2,34€)
- **ΚΕΑΟ**: Αν δεν εξοφληθεί εντός ~40 ημερών → βεβαίωση στο ΚΕΑΟ
- **Κωδικός RF**: Μοναδικός ανά ασφαλισμένο, για πληρωμή μέσω τράπεζας/ΕΛΤΑ
- **Επιλογή κατηγορίας**: Μέχρι 31/1 κάθε έτους, δεσμευτική για όλο το έτος
- **Ετήσια αύξηση**: ~2,5% (config-driven)

```typescript
interface EFKAContributionBreakdown {
  /** Κλάδοι κύριας ασφάλισης */
  pension: number;            // Κλάδος Σύνταξης (180,58€ στην 1η)
  healthInKind: number;       // Υγεία σε Είδος (58,25€)
  healthInCash: number;       // Υγεία σε Χρήμα (5,82€)
  unemployment: number;       // ΟΑΕΔ (10,00€)
  /** Κλάδοι επικουρικής & εφάπαξ */
  supplementary: number;      // Επικουρική (45,43€ στην 1η)
  lumpSum: number;            // Εφάπαξ (30,29€ στην 1η)
  /** Σύνολα */
  monthlyTotal: number;       // 330,37€
  annualTotal: number;        // 3.964,44€
}

interface EFKAEngine {
  /** Config-driven κατηγορίες (ενημερώνονται ετήσια) */
  mainCategories: EFKACategory[];          // 6 κατηγορίες
  supplementaryCategories: EFKACategory[]; // 3 κατηγορίες
  lumpSumCategories: EFKACategory[];       // 3 κατηγορίες

  /** Υπολογισμός μηνιαίας εισφοράς (αναλυτικά ανά κλάδο) */
  calculateMonthly(selectedCategories: {
    main: 1|2|3|4|5|6;
    supplementary: 1|2|3;
    lumpSum: 1|2|3;
  }): EFKAContributionBreakdown;

  /** Παρακολούθηση πληρωμών (ανά μήνα) */
  trackPayments(year: number): EFKAPaymentRecord[];

  /** Ανίχνευση ληξιπρόθεσμων + πρόσθετα τέλη */
  calculateLateFees(overdueMonths: number[]): number;

  /** Deadline reminder: 31/1 κάθε έτους */
  getCategorySelectionDeadline(year: number): Date;

  /** RF κωδικός πληρωμής (μοναδικός ανά ασφαλισμένο) */
  paymentReferenceCode: string;
}
```

### 7.5 ΤΕΕ e-Αμοιβές Engine

Ο μηχανικός δηλώνει ηλεκτρονικά τις αμοιβές του μέσω του portal MyTEE.

**Μέθοδοι υπολογισμού αμοιβών:**

| Μέθοδος | Περιγραφή | Παράδειγμα |
|---------|-----------|------------|
| Ποσοστό επί προϋπολογισμού | % επί εκτιμώμενου κόστους | Αρχιτεκτονική μελέτη |
| Κατά μονάδα | Τιμή × μονάδες | Τοπογραφικά |
| Κατ' αποκοπήν | Σταθερό ποσό | Συμφωνημένη αμοιβή |
| Χρόνος απασχόλησης | Ωριαία/ημερήσια | Συμβουλευτικές |

**Ειδικές προσαυξήσεις:**
- Μόνο Προμελέτη: +40%
- Προμελέτη + Οριστική: +25% σε κάθε στάδιο

**Συντελεστής 2025**: tk = 1,435 (ενημερώνεται ετήσια)

```typescript
interface TEEFeesEngine {
  /** Συντελεστής τρέχοντος έτους */
  currentCoefficient: number;              // tk = 1,435 (2025)

  /** Υπολογισμός αμοιβής μελέτης */
  calculateStudyFee(params: {
    method: 'percentage' | 'per_unit' | 'lump_sum' | 'time_based';
    estimatedBudget?: number;
    studyStage: 'preliminary' | 'final' | 'both';
  }): TEEFeeResult;
  // preliminary only → +40% surcharge
  // both stages → +25% each

  /** Σύνδεση με e-Άδειες */
  linkToEPermit(permitId: string, feeDeclarationId: string): void;
}
```

---

## 8. Invoicing System

### 8.1 Παραστατικά (Document Types)

| Κωδικός myDATA | Τύπος | Ελληνικά | Phase |
|----------------|-------|----------|-------|
| 1.1 | `sales_invoice` | Τιμολόγιο Πώλησης | 1 |
| 2.1 | `service_invoice` | Τιμολόγιο Παροχής Υπηρεσιών (ΤΠΥ) | 1 |
| 11.1 | `retail_receipt` | Απόδειξη Λιανικής / ΑΠΥ | 1 |
| 5.1 | `credit_invoice` | Πιστωτικό Τιμολόγιο | 1 |
| 11.2 | `service_receipt` | Απόδειξη Παροχής Υπηρεσιών | 1 |

### 8.2 Σειρές Αρίθμησης

```typescript
interface InvoiceSeries {
  seriesId: string;
  prefix: string;                 // π.χ. "Α", "Β"
  currentNumber: number;          // Τελευταίος αριθμός
  documentType: InvoiceType;      // Τι τύπο παραστατικού εξυπηρετεί
  isActive: boolean;
  createdAt: string;
}
```

- **Phase 1**: 1 σειρά (Α-1, Α-2, Α-3...)
- **Μελλοντικά**: Πολλαπλές σειρές ανά τύπο (modular)

---

## 9. Expense Categories (Ατομική)

| Κατηγορία | Κωδικός | myDATA Κατηγορία | Παραδείγματα |
|-----------|---------|-------------------|--------------|
| Αμοιβές τρίτων | `fees` | category2_1 | Λογιστής, δικηγόρος |
| Ενοίκιο γραφείου | `rent` | category2_3 | Ενοίκιο |
| ΔΕΗ/Νερό/Θέρμανση | `utilities` | category2_4 | Λογαριασμοί ΔΕΚΟ |
| Τηλεφωνία/Internet | `telecom` | category2_4 | Cosmote, Vodafone |
| Καύσιμα | `fuel` | category2_5 | Βενζίνη, diesel |
| Ασφάλεια αυτοκινήτου | `insurance` | category2_5 | Motor insurance |
| Αναλώσιμα γραφείου | `office_supplies` | category2_7 | Χαρτί, μελάνια |
| Λογισμικό/Subscriptions | `software` | category2_7 | CAD, Office 365 |
| Εισφορές ΕΦΚΑ | `efka` | category2_12 | Ασφαλιστικές εισφορές |
| Τέλος επιτηδεύματος | `professional_tax` | category2_12 | Τέλος επιτηδεύματος |
| Λοιπά έξοδα | `other` | category2_14 | Μη κατηγοριοποιημένα |
| Αποσβέσεις | `depreciation` | category2_11 | Αποσβέσεις παγίων |

---

## 10. Routing & Navigation

```
/accounting                          ← Dashboard
/accounting/setup                    ← M-001: Company setup
/accounting/book                     ← M-002: Βιβλίο Εσόδων-Εξόδων
/accounting/invoices                 ← M-003: Τιμολόγια (λίστα)
/accounting/invoices/new             ← M-003: Νέο τιμολόγιο
/accounting/invoices/[id]            ← M-003: Προβολή/επεξεργασία
/accounting/expenses                 ← M-006: Δαπάνες
/accounting/expenses/scan            ← M-006: AI scan
/accounting/vat                      ← M-005: ΦΠΑ τρίμηνα
/accounting/efka                     ← M-007: ΕΦΚΑ
/accounting/assets                   ← M-008: Πάγια
/accounting/bank                     ← M-009: Τράπεζες
/accounting/reports                  ← M-010: Αναφορές
/accounting/mydata                   ← M-004: myDATA status
```

---

## 11. Portability Strategy

Για να είναι η εφαρμογή **αποσπώμενη**:

| Dependency | Strategy |
|-----------|----------|
| **Firestore** | Abstract via `IAccountingRepository` interface |
| **CRM Contacts** | Abstract via `IContactProvider` interface |
| **AI Pipeline** | Abstract via `IDocumentAnalyzer` interface |
| **Authentication** | Abstract via `IAuthProvider` interface |
| **i18n** | Self-contained locale files inside subapp |
| **UI Components** | Use shared UI kit (Radix) but no hard coupling |

Αν αποσπαστεί:
- Replace `IAccountingRepository` → PostgreSQL/MySQL adapter
- Replace `IContactProvider` → standalone contact module
- Replace `IDocumentAnalyzer` → direct OpenAI calls
- Replace `IAuthProvider` → NextAuth/Auth0

---

## 12. Phase Plan

### Phase 1: Core Ατομική (CURRENT)

| # | Module | Προτεραιότητα | Depends On |
|---|--------|---------------|------------|
| 1 | M-001: Company Setup | CRITICAL | — |
| 2 | M-003: Invoicing | CRITICAL | M-001 |
| 3 | M-004: myDATA | CRITICAL | M-003 |
| 4 | M-002: Income/Expense Book | HIGH | M-001 |
| 5 | M-005: VAT Engine | HIGH | M-002 |
| 6 | M-006: Expense Tracker (AI) | HIGH | M-002 |
| 7 | M-009: Bank Reconciliation | MEDIUM | M-002 |
| 8 | M-007: EFKA Tracker | MEDIUM | M-001 |
| 9 | M-008: Fixed Assets | MEDIUM | M-002 |
| 10 | M-010: Reports | MEDIUM | M-002, M-005 |

### Phase 2: ΟΕ Extension

- Partner shares + profit distribution
- Shared accounting book

### Phase 3: ΕΠΕ Extension

- Double-entry bookkeeping (Γ' Κατηγορίας)
- General Ledger (Γενικό Καθολικό)
- Balance Sheet (Ισολογισμός)

### Phase 4: ΑΕ Extension

- Share capital management
- Board of Directors records
- ΓΕΜΗ integration

---

## 13. Multi-User Architecture

Η εφαρμογή θα υποστηρίζει **πολλαπλούς χρήστες** με δικό τους login.

| Ρόλος | Δικαιώματα | Παράδειγμα |
|-------|-----------|------------|
| **owner** | Πλήρης πρόσβαση, ρυθμίσεις, διαγραφές | Γιώργος |
| **accountant** | Καταχώρηση, τιμολόγηση, αναφορές | Λογιστής, μέλος οικογένειας |
| **viewer** | Μόνο ανάγνωση, αναφορές | Σύμβουλος |

Χρησιμοποιεί το υπάρχον Firebase Auth — κάθε χρήστης ανήκει σε εταιρεία (`companyId`).

---

## 14. Open Questions

| # | Ερώτηση | Κατάσταση |
|---|---------|-----------|
| 1 | ~~ΚΑΔ codes~~ | ✅ RESOLVED — 3 ενεργά ΚΑΔ (71112000, 41202003, 41201001) |
| 2 | myDATA API credentials — χρειάζεται εγγραφή στο ΑΑΔΕ dev portal | PENDING |
| 3 | ~~Ειδικός χειρισμός τεχνικών μελετών (ΤΕΕ αμοιβές)~~ | ✅ RESOLVED — Section 7.5 |
| 4 | ~~Παρακράτηση φόρου 20% σε αμοιβές μηχανικού~~ | ✅ RESOLVED — Section 7.3 |
| 5 | Ηλεκτρονικά βιβλία ΑΑΔΕ — σχέση με Βιβλία Ε-Ε | NEEDS RESEARCH |
| 6 | Τράπεζα: CSV import ή Open Banking API; | Phase 1: CSV, Phase 2+: API |
| 7 | ~~Multi-user~~ | ✅ RESOLVED — Section 13, δικό τους login |
| 8 | ~~Ασφαλιστική κατηγορία ΕΦΚΑ~~ | ✅ RESOLVED — 1η κατηγορία σε ΟΛΑ, 330,37€/μήνα |
| 9 | ΤΕΕ MyTEE credentials — API ή manual sync; | NEEDS DISCUSSION |

---

## 15. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-09 | ADR Created — Founding decision for accounting subapp | Γιώργος Παγώνης + Claude Code |
| 2026-02-09 | Location: `src/subapps/accounting/` (portable subapp) | Γιώργος Παγώνης |
| 2026-02-09 | Phase 1: Ατομική επιχείρηση (απλογραφικό, Β' κατηγορίας) | Γιώργος Παγώνης |
| 2026-02-09 | AI-first: AI integration σε κάθε στάδιο | Γιώργος Παγώνης |
| 2026-02-09 | myDATA: Αυτόματη διαβίβαση μέσω ΑΑΔΕ API | Γιώργος Παγώνης |
| 2026-02-09 | CRM: Σύνδεση με υπάρχουσες Firestore contacts | Γιώργος Παγώνης |
| 2026-02-09 | ADR numbering: ACC-xxx (ανεξάρτητη αρίθμηση, portable) | Claude Code |
| 2026-02-09 | Παρακράτηση φόρου: 20% υπηρεσίες, 3% κατασκευές, 4%/10% μελέτες/επίβλεψη — αυτόματος χειρισμός | Γιώργος + Claude Research |
| 2026-02-09 | ΤΕΕ e-Αμοιβές: Πλήρες σύστημα (ποσοστό, μονάδα, αποκοπή, χρόνος) + e-Άδειες link | Γιώργος + Claude Research |
| 2026-02-09 | ΕΦΚΑ: 6 κατηγορίες κύριας (261-687€/μήνα), config-driven, ετήσια update | Claude Research |
| 2026-02-09 | Multi-user: ΝΑΙ, δικό τους login, roles (owner/accountant/viewer) | Γιώργος Παγώνης |
| 2026-02-09 | ΚΑΔ imported: 71112000 (κύρια/αρχιτεκτονικές), 41202003 + 41201001 (δευτερ./κατασκευές) | Γιώργος (Taxisnet) |
| 2026-02-09 | Β' Απλογραφικά, Κανονικό ΦΠΑ, ΟΧΙ ενδοκοινοτικές — επιβεβαιώθηκε από Taxisnet | Γιώργος (Taxisnet) |
| 2026-02-09 | ΕΦΚΑ: 1η κατηγορία ΟΛΑ — 330,37€/μήνα (6 κλάδοι). Πραγματικά ποσά από ειδοποιητήριο 12/2025 | Γιώργος (ΕΦΚΑ PDF) |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
