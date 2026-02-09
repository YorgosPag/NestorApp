# ADR-ACC-010: Portability & Abstraction Layers

| Metadata | Value |
|----------|-------|
| **Status** | DRAFT |
| **Date** | 2026-02-09 |
| **Category** | Accounting / Architecture |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Parent** | [ADR-ACC-000](./ADR-ACC-000-founding-decision.md) |
| **Module** | Cross-cutting (All Modules) |

---

## 1. Context

Η λογιστική εφαρμογή σχεδιάζεται ως **αποσπώμενη υπο-εφαρμογή** (portable subapp) του NestorApp. Αυτό σημαίνει:

1. **Σήμερα**: Λειτουργεί μέσα στο NestorApp (Next.js + Firebase + Vercel)
2. **Αύριο**: Μπορεί να αποσπαστεί και να λειτουργήσει:
   - Ως **standalone SaaS** για ατομικές επιχειρήσεις
   - Με **διαφορετικό backend** (PostgreSQL αντί Firestore)
   - Με **διαφορετικό auth** (NextAuth αντί Firebase Auth)
   - Ως **white-label** product

### Αρχιτεκτονική Φιλοσοφία

```
┌──────────────────────────────────────────────────────┐
│                   ACCOUNTING SUBAPP                  │
│                                                      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │ UI Layer   │ │ Business   │ │ Data Layer │       │
│  │ (React)    │ │ Logic      │ │ (Abstract) │       │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘       │
│        │              │              │               │
│  ══════╪══════════════╪══════════════╪═══════════    │
│        │       ABSTRACTION BOUNDARY  │               │
│  ══════╪══════════════╪══════════════╪═══════════    │
│        ▼              ▼              ▼               │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │ UI Kit     │ │ Host App   │ │ Repository │       │
│  │ Adapter    │ │ Services   │ │ Adapter    │       │
│  └────────────┘ └────────────┘ └────────────┘       │
└──────────────────────────────────────────────────────┘
        │              │              │
        ▼              ▼              ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Shadcn/  │  │ NestorApp│  │ Firestore│
  │ Radix UI │  │ Services │  │ / Postgres│
  └──────────┘  └──────────┘  └──────────┘
```

---

## 2. Abstraction Interfaces

### 2.1 Repository Layer (Data Access)

```typescript
/**
 * Κεντρικό interface για όλες τις data operations.
 * Κάθε module χρησιμοποιεί αυτό — ποτέ direct Firestore calls.
 */
interface IAccountingRepository {
  // === Journal Entries ===
  createJournalEntry(
    companyId: string,
    entry: CreateJournalEntryInput
  ): Promise<JournalEntry>;

  getJournalEntries(
    companyId: string,
    filters: JournalEntryFilters
  ): Promise<PaginatedResult<JournalEntry>>;

  updateJournalEntry(
    companyId: string,
    entryId: string,
    updates: Partial<JournalEntry>
  ): Promise<JournalEntry>;

  deleteJournalEntry(
    companyId: string,
    entryId: string
  ): Promise<void>;

  // === Invoices ===
  createInvoice(
    companyId: string,
    invoice: CreateInvoiceInput
  ): Promise<Invoice>;

  getInvoice(
    companyId: string,
    invoiceId: string
  ): Promise<Invoice | null>;

  getInvoices(
    companyId: string,
    filters: InvoiceFilters
  ): Promise<PaginatedResult<Invoice>>;

  getNextInvoiceNumber(
    companyId: string,
    series: string
  ): Promise<number>;

  // === Bank Transactions ===
  importBankTransactions(
    companyId: string,
    batch: BankImportBatch
  ): Promise<ImportResult>;

  getBankTransactions(
    companyId: string,
    filters: BankTransactionFilters
  ): Promise<PaginatedResult<BankTransaction>>;

  // === Fixed Assets ===
  createFixedAsset(
    companyId: string,
    asset: CreateFixedAssetInput
  ): Promise<FixedAsset>;

  getFixedAssets(
    companyId: string,
    filters: FixedAssetFilters
  ): Promise<PaginatedResult<FixedAsset>>;

  // === EFKA ===
  getEfkaPayments(
    companyId: string,
    year: number
  ): Promise<EFKAPayment[]>;

  createEfkaPayment(
    companyId: string,
    payment: CreateEFKAPaymentInput
  ): Promise<EFKAPayment>;

  // === Tax ===
  getTaxCalculation(
    companyId: string,
    year: number
  ): Promise<TaxResult | null>;

  saveTaxCalculation(
    companyId: string,
    year: number,
    result: TaxResult
  ): Promise<void>;

  // === Reports / Aggregations ===
  getIncomeExpenseSummary(
    companyId: string,
    year: number,
    quarter?: 1 | 2 | 3 | 4
  ): Promise<IncomeExpenseSummary>;

  getVATSummary(
    companyId: string,
    year: number,
    quarter: 1 | 2 | 3 | 4
  ): Promise<VATQuarterSummary>;
}
```

### 2.2 Contact Provider (CRM Integration)

```typescript
/**
 * Αφαίρεση εξάρτησης από NestorApp CRM.
 * Σήμερα: Firestore contacts collection
 * Αύριο: Standalone contacts table ή εξωτερικό CRM
 */
interface IContactProvider {
  /** Αναζήτηση επαφής κατά όνομα */
  searchContacts(
    query: string,
    options?: ContactSearchOptions
  ): Promise<ContactResult[]>;

  /** Επαφή κατά ID */
  getContact(contactId: string): Promise<ContactResult | null>;

  /** Επαφή κατά ΑΦΜ */
  getContactByVat(vatNumber: string): Promise<ContactResult | null>;

  /** Λίστα όλων (paginated) */
  listContacts(
    filters?: ContactListFilters
  ): Promise<PaginatedResult<ContactResult>>;

  /** Δημιουργία νέας επαφής */
  createContact(input: CreateContactInput): Promise<ContactResult>;

  /** Ενημέρωση στοιχείων */
  updateContact(
    contactId: string,
    updates: UpdateContactInput
  ): Promise<ContactResult>;
}

/** Ελαχιστοποιημένο interface — μόνο ό,τι χρειάζεται η λογιστική */
interface ContactResult {
  id: string;
  displayName: string;
  companyName: string | null;
  vatNumber: string | null;
  taxOffice: string | null;        // ΔΟΥ
  profession: string | null;
  address: ContactAddress | null;
  email: string | null;
  phone: string | null;
  contactType: 'individual' | 'company';
}
```

### 2.3 Document Analyzer (AI Integration)

```typescript
/**
 * Αφαίρεση εξάρτησης από OpenAI.
 * Σήμερα: OpenAI gpt-4o / gpt-4o-mini
 * Αύριο: Claude, Gemini, local LLM, ή manual mode
 */
interface IDocumentAnalyzer {
  /** Αναγνώριση τύπου εγγράφου */
  classifyDocument(
    imageUrl: string
  ): Promise<DocumentClassification>;

  /** Εξαγωγή δεδομένων από παραστατικό */
  extractDocumentData(
    imageUrl: string,
    documentType: DocumentType
  ): Promise<ExtractedDocumentData>;

  /** Κατηγοριοποίηση δαπάνης */
  categorizeExpense(
    description: string,
    vendorName: string | null,
    amount: number
  ): Promise<ExpenseCategorization>;
}

interface DocumentClassification {
  type: DocumentType;
  confidence: number;           // 0-1
}

interface ExpenseCategorization {
  categoryId: string;           // e.g., 'supplies'
  confidence: number;
  suggestedE3Code: string;
  suggestedMyDataCode: string;
}
```

### 2.4 Auth Provider

```typescript
/**
 * Αφαίρεση εξάρτησης από Firebase Auth.
 * Σήμερα: Firebase Auth
 * Αύριο: NextAuth, Clerk, Supabase Auth, ή custom
 */
interface IAuthProvider {
  /** Τρέχων χρήστης */
  getCurrentUser(): AuthUser | null;

  /** Company ID του τρέχοντος χρήστη */
  getCurrentCompanyId(): string | null;

  /** Έλεγχος role */
  hasPermission(permission: AccountingPermission): boolean;

  /** Subscribe σε auth state changes */
  onAuthStateChanged(
    callback: (user: AuthUser | null) => void
  ): () => void;
}

interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

type AccountingPermission =
  | 'accounting:read'
  | 'accounting:write'
  | 'accounting:invoices:create'
  | 'accounting:invoices:void'
  | 'accounting:mydata:submit'
  | 'accounting:tax:calculate'
  | 'accounting:settings:manage'
  | 'accounting:admin';
```

### 2.5 Notification Provider

```typescript
/**
 * Αφαίρεση εξάρτησης από Telegram/Email channels.
 * Σήμερα: Telegram + Mailgun
 * Αύριο: Push notifications, SMS, in-app only
 */
interface INotificationProvider {
  /** Αποστολή ειδοποίησης */
  sendNotification(notification: AccountingNotification): Promise<void>;

  /** Μαζικές ειδοποιήσεις (reminders) */
  sendBatchNotifications(
    notifications: AccountingNotification[]
  ): Promise<BatchNotificationResult>;
}

interface AccountingNotification {
  type:
    | 'vat_deadline'
    | 'efka_payment_due'
    | 'tax_installment_due'
    | 'invoice_overdue'
    | 'mydata_submission_failed'
    | 'certificate_reminder';
  recipientId: string;
  title: string;
  body: string;
  priority: 'high' | 'medium' | 'low';
  channels: ('app' | 'telegram' | 'email')[];
  metadata: Record<string, string>;
}
```

### 2.6 File Storage Provider

```typescript
/**
 * Αφαίρεση εξάρτησης από Firebase Storage.
 * Σήμερα: Firebase Storage
 * Αύριο: S3, Cloudflare R2, local disk
 */
interface IFileStorageProvider {
  /** Upload αρχείου (τιμολόγιο PDF, expense photo) */
  uploadFile(params: FileUploadParams): Promise<FileUploadResult>;

  /** Download URL */
  getDownloadUrl(path: string): Promise<string>;

  /** Διαγραφή αρχείου */
  deleteFile(path: string): Promise<void>;

  /** Λίστα αρχείων */
  listFiles(
    prefix: string,
    options?: FileListOptions
  ): Promise<FileListResult>;
}

interface FileUploadParams {
  file: File | Buffer;
  path: string;                   // e.g., 'accounting/{companyId}/invoices/INV-2026-001.pdf'
  contentType: string;
  metadata?: Record<string, string>;
}
```

---

## 3. Dependency Injection

### 3.1 Accounting Context (Provider Pattern)

```typescript
interface AccountingProviders {
  repository: IAccountingRepository;
  contacts: IContactProvider;
  documentAnalyzer: IDocumentAnalyzer;
  auth: IAuthProvider;
  notifications: INotificationProvider;
  fileStorage: IFileStorageProvider;
}

/**
 * React Context — inject μία φορά στο root, χρήση παντού.
 */
const AccountingContext = createContext<AccountingProviders | null>(null);

function useAccounting(): AccountingProviders {
  const ctx = useContext(AccountingContext);
  if (!ctx) {
    throw new Error(
      'useAccounting must be used within AccountingProvider'
    );
  }
  return ctx;
}
```

### 3.2 NestorApp Adapter (Current Implementation)

```typescript
/**
 * Σημερινή υλοποίηση: NestorApp + Firebase
 */
const nestorProviders: AccountingProviders = {
  repository: new FirestoreAccountingRepository(db),
  contacts: new NestorContactProvider(db),
  documentAnalyzer: new OpenAIDocumentAnalyzer(openaiConfig),
  auth: new FirebaseAuthProvider(auth),
  notifications: new NestorNotificationProvider(telegramBot, mailgun),
  fileStorage: new FirebaseStorageProvider(storage),
};

function NestorAccountingApp() {
  return (
    <AccountingContext.Provider value={nestorProviders}>
      <AccountingRouter />
    </AccountingContext.Provider>
  );
}
```

### 3.3 Standalone Adapter (Future)

```typescript
/**
 * Μελλοντική υλοποίηση: Standalone + PostgreSQL
 */
const standaloneProviders: AccountingProviders = {
  repository: new PostgresAccountingRepository(pgPool),
  contacts: new PostgresContactProvider(pgPool),
  documentAnalyzer: new ClaudeDocumentAnalyzer(claudeConfig),
  auth: new NextAuthProvider(nextAuth),
  notifications: new EmailOnlyNotificationProvider(resend),
  fileStorage: new S3StorageProvider(s3Client),
};
```

---

## 4. Module Boundary Rules

### 4.1 Import Rules

```
ALLOWED (inside accounting subapp):
  ✅ import { useAccounting } from '@/subapps/accounting/providers'
  ✅ import { JournalEntry } from '@/subapps/accounting/types'
  ✅ import { calculateIncomeTax } from '@/subapps/accounting/services/tax-engine'
  ✅ import { Button } from '@/components/ui/button'   (shared UI kit)

FORBIDDEN (direct host dependencies):
  ❌ import { db } from '@/lib/firebase'
  ❌ import { collection, getDocs } from 'firebase/firestore'
  ❌ import { useAuth } from '@/hooks/useAuth'
  ❌ import { sendTelegramMessage } from '@/services/telegram'
```

### 4.2 Folder Structure

```
src/subapps/accounting/
├── docs/
│   └── adrs/                          ← ADR τεκμηρίωση
│
├── types/
│   ├── index.ts                       ← Re-exports
│   ├── journal.ts                     ← JournalEntry, Category, etc.
│   ├── invoice.ts                     ← Invoice, InvoiceLine, etc.
│   ├── tax.ts                         ← TaxResult, TaxBracket, etc.
│   ├── efka.ts                        ← EFKAPayment, EFKAConfig, etc.
│   ├── bank.ts                        ← BankTransaction, etc.
│   ├── assets.ts                      ← FixedAsset, DepreciationRecord
│   └── mydata.ts                      ← MyDataDocument, SubmissionResult
│
├── interfaces/
│   ├── index.ts                       ← Re-exports
│   ├── repository.ts                  ← IAccountingRepository
│   ├── contact-provider.ts            ← IContactProvider
│   ├── document-analyzer.ts           ← IDocumentAnalyzer
│   ├── auth-provider.ts               ← IAuthProvider
│   ├── notification-provider.ts       ← INotificationProvider
│   └── file-storage-provider.ts       ← IFileStorageProvider
│
├── providers/
│   ├── AccountingContext.tsx           ← React Context + useAccounting()
│   └── index.ts
│
├── adapters/
│   ├── nestor/                        ← NestorApp-specific implementations
│   │   ├── FirestoreAccountingRepository.ts
│   │   ├── NestorContactProvider.ts
│   │   ├── OpenAIDocumentAnalyzer.ts
│   │   ├── FirebaseAuthProvider.ts
│   │   ├── NestorNotificationProvider.ts
│   │   ├── FirebaseStorageProvider.ts
│   │   └── index.ts
│   │
│   └── standalone/                    ← Future standalone implementations
│       └── README.md                  ← Migration guide
│
├── config/
│   ├── account-categories.ts          ← Category definitions (ACC-001)
│   ├── vat-rates.ts                   ← VAT config (ACC-004)
│   ├── tax-scales.ts                  ← Tax brackets (ACC-009)
│   ├── efka-rates.ts                  ← EFKA config (ACC-006)
│   ├── depreciation-rates.ts          ← Asset rates (ACC-007)
│   └── mydata-mappings.ts             ← myDATA codes (ACC-003)
│
├── services/
│   ├── journal-service.ts             ← Business logic: entries
│   ├── invoice-service.ts             ← Business logic: invoicing
│   ├── vat-engine.ts                  ← VAT calculations
│   ├── tax-engine.ts                  ← Income tax calculations
│   ├── efka-service.ts                ← EFKA tracking
│   ├── depreciation-engine.ts         ← Asset depreciation
│   ├── bank-reconciliation-service.ts ← Bank matching
│   ├── mydata-service.ts              ← ΑΑΔΕ API
│   └── expense-tracker-service.ts     ← AI document processing
│
├── hooks/
│   ├── useJournalEntries.ts
│   ├── useInvoices.ts
│   ├── useVATSummary.ts
│   ├── useTaxEstimate.ts
│   ├── useEfkaPayments.ts
│   ├── useFixedAssets.ts
│   ├── useBankReconciliation.ts
│   └── useMyDataStatus.ts
│
├── components/
│   ├── journal/                       ← Βιβλίο Ε-Ε
│   ├── invoices/                      ← Τιμολόγηση
│   ├── expenses/                      ← Expense Tracker
│   ├── vat/                           ← ΦΠΑ Dashboard
│   ├── tax/                           ← Φόρος Εισοδήματος
│   ├── efka/                          ← ΕΦΚΑ Tracker
│   ├── assets/                        ← Πάγια
│   ├── bank/                          ← Τράπεζα
│   ├── reports/                       ← Αναφορές
│   └── shared/                        ← Shared components
│
├── pages/                             ← Route pages
│   ├── AccountingDashboard.tsx
│   ├── JournalPage.tsx
│   ├── InvoicesPage.tsx
│   └── ...
│
├── i18n/
│   ├── el.ts                          ← Ελληνικά
│   └── en.ts                          ← English (μελλοντικό)
│
└── index.ts                           ← Public API entry point
```

### 4.3 Public API (entry point)

```typescript
// src/subapps/accounting/index.ts

// Types — χρήσιμα εκτός subapp
export type {
  JournalEntry,
  Invoice,
  TaxResult,
  EFKAPayment,
  FixedAsset,
  BankTransaction,
} from './types';

// Interfaces — για custom adapters
export type {
  IAccountingRepository,
  IContactProvider,
  IDocumentAnalyzer,
  IAuthProvider,
  INotificationProvider,
  IFileStorageProvider,
  AccountingProviders,
} from './interfaces';

// Provider — για host app integration
export {
  AccountingProvider,
  useAccounting,
} from './providers';

// Config — reusable
export {
  ACCOUNT_CATEGORIES,
  VAT_RATES,
  TAX_SCALES,
  EFKA_RATES,
  DEPRECIATION_RATES,
} from './config';

// Root component
export { AccountingApp } from './AccountingApp';
```

---

## 5. Internationalization (i18n)

### 5.1 Self-contained Strategy

```typescript
/**
 * Η λογιστική εφαρμογή έχει τα ΔΙΚΑ ΤΗΣ i18n strings.
 * ΔΕΝ εξαρτάται από τα i18n του NestorApp.
 *
 * Phase 1: Μόνο ελληνικά (hardcoded)
 * Phase 2: i18n με namespace 'accounting'
 */
const accountingStrings = {
  el: {
    dashboard: {
      title: 'Λογιστικό',
      income: 'Έσοδα',
      expenses: 'Έξοδα',
      profit: 'Κέρδος',
      vat: 'ΦΠΑ',
      tax: 'Φόρος',
    },
    journal: {
      newEntry: 'Νέα Εγγραφή',
      date: 'Ημερομηνία',
      description: 'Περιγραφή',
      amount: 'Ποσό',
      category: 'Κατηγορία',
      vatRate: 'Συντελεστής ΦΠΑ',
      netAmount: 'Καθαρό Ποσό',
      taxableAmount: 'Φορολογητέο',
    },
    invoice: {
      create: 'Νέο Τιμολόγιο',
      series: 'Σειρά',
      number: 'Αριθμός',
      customer: 'Πελάτης',
      total: 'Σύνολο',
      status: 'Κατάσταση',
      draft: 'Πρόχειρο',
      issued: 'Εκδόθηκε',
      sent: 'Στάλθηκε',
      paid: 'Πληρώθηκε',
      voided: 'Ακυρωμένο',
    },
    // ... rest of strings
  },
};
```

### 5.2 Phase 1 Approach (MVP)

- Ελληνικά **hardcoded** σε components (const strings)
- Αφαίρεση εξάρτησης από `next-intl` ή `i18next`
- Εύκολη μετατροπή: Extract strings → i18n namespace

### 5.3 Phase 2 Approach (Internationalization)

```typescript
import { useAccountingTranslation } from '../i18n';

function JournalEntryForm() {
  const t = useAccountingTranslation();

  return (
    <form>
      <label>{t('journal.date')}</label>
      <label>{t('journal.description')}</label>
      <label>{t('journal.amount')}</label>
    </form>
  );
}
```

---

## 6. UI Kit Abstraction

### 6.1 Shared UI Components

Η λογιστική εφαρμογή χρησιμοποιεί τα **NestorApp UI components** (Shadcn/Radix), αλλά μέσω re-exports:

```typescript
// src/subapps/accounting/components/shared/ui.ts

/**
 * Re-export UI components.
 * Αν αποσπαστεί η εφαρμογή, αλλάζει ΜΟΝΟ αυτό το αρχείο.
 */
export { Button } from '@/components/ui/button';
export { Input } from '@/components/ui/input';
export { Label } from '@/components/ui/label';
export { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
export { Badge } from '@/components/ui/badge';
export { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
```

### 6.2 Χρήση

```typescript
// Inside accounting components:
import { Button, Card, Table } from '../shared/ui';
// NOT:
// import { Button } from '@/components/ui/button';  ← ❌ direct dependency
```

### 6.3 Migration Impact

Αν αποσπαστεί η εφαρμογή, **αλλάζει μόνο 1 αρχείο** (`shared/ui.ts`):

```typescript
// Standalone version:
export { Button } from './standalone-ui/button';
export { Input } from './standalone-ui/input';
// ...
```

---

## 7. Configuration Portability

### 7.1 Company Configuration

```typescript
/**
 * Εξάρτηση: Company settings.
 * Σήμερα: Firestore settings collection
 * Standalone: Local config ή DB table
 */
interface ICompanyConfigProvider {
  /** Στοιχεία εταιρείας */
  getCompanyInfo(): Promise<CompanyInfo>;

  /** Invoicing settings */
  getInvoicingSettings(): Promise<InvoicingSettings>;

  /** ΕΦΚΑ settings */
  getEfkaConfig(): Promise<EFKAUserConfig>;

  /** Bank accounts */
  getBankAccounts(): Promise<BankAccount[]>;

  /** myDATA credentials */
  getMyDataCredentials(): Promise<MyDataCredentials>;
}

interface CompanyInfo {
  name: string;
  vatNumber: string;
  taxOffice: string;           // ΔΟΥ
  profession: string;
  kadCodes: KADCode[];
  address: CompanyAddress;
  phone: string;
  mobile: string;
  email: string;
}
```

### 7.2 Environment Variables

```
# === ACCOUNTING-SPECIFIC ENV VARS ===

# myDATA API (ACC-003)
AADE_MYDATA_USER_ID=
AADE_MYDATA_SUBSCRIPTION_KEY=
AADE_MYDATA_ENV=production  # production | sandbox

# AI Document Processing (ACC-005)
AI_EXPENSE_PROVIDER=openai    # openai | claude | manual
OPENAI_API_KEY=               # (shared with NestorApp)
OPENAI_VISION_MODEL=gpt-4o

# Bank (ACC-008)
BANK_CSV_ENCODING=windows-1253
```

---

## 8. Migration Strategy

### 8.1 Phase 1: Embedded (Current)

```
NestorApp
  └── src/subapps/accounting/
        ├── adapters/nestor/     ← Firebase implementations
        ├── services/            ← Pure business logic
        ├── components/          ← React UI
        └── config/              ← Config-driven
```

- Shares: Firebase, Auth, UI kit, Routing, i18n infrastructure
- Adapter: `FirestoreAccountingRepository`

### 8.2 Phase 2: Loosely Coupled

```
NestorApp
  └── src/subapps/accounting/
        ├── adapters/nestor/     ← Still Firebase
        ├── interfaces/          ← Clean interfaces defined
        ├── services/            ← Pure business logic (NO Firebase imports)
        └── components/          ← Uses shared/ui.ts (NOT direct @/components)
```

- All Firebase calls go through `IAccountingRepository`
- All contacts through `IContactProvider`
- All AI calls through `IDocumentAnalyzer`
- UI through re-export layer

### 8.3 Phase 3: Extractable

```
packages/accounting/            ← npm package
  ├── src/
  │   ├── types/
  │   ├── interfaces/
  │   ├── services/             ← Pure business logic
  │   ├── config/
  │   └── index.ts
  ├── package.json
  └── tsconfig.json

apps/accounting-standalone/     ← Standalone Next.js app
  ├── src/
  │   ├── adapters/postgres/    ← PostgreSQL implementations
  │   ├── pages/
  │   └── providers.ts
  ├── package.json
  └── next.config.js
```

### 8.4 Migration Checklist

| Step | Description | Risk |
|------|-------------|------|
| 1 | Define all interfaces (Section 2) | None |
| 2 | Create NestorApp adapters (Firestore) | None |
| 3 | Replace direct Firebase calls in services | Low |
| 4 | Create UI re-export layer (shared/ui.ts) | None |
| 5 | Self-contained i18n strings | None |
| 6 | Extract to npm package | Medium |
| 7 | Create standalone app with PostgreSQL adapters | Medium |

---

## 9. Testing Strategy

### 9.1 Unit Tests (Business Logic)

```typescript
/**
 * Services test χωρίς Firebase.
 * Mock τα interfaces, test τη λογική.
 */
describe('TaxEngine', () => {
  it('calculates income tax correctly', () => {
    const result = calculateIncomeTax(36036, TAX_SCALE_2026.brackets);
    expect(result.total).toBe(8073);
  });
});

describe('VATEngine', () => {
  it('calculates quarterly VAT', () => {
    const result = calculateQuarterlyVAT(entries, VAT_RATES_2026);
    expect(result.vatPayable).toBe(1200);
  });
});
```

### 9.2 Integration Tests (Adapters)

```typescript
/**
 * Test adapters μέ emulator ή test DB.
 */
describe('FirestoreAccountingRepository', () => {
  it('creates journal entry', async () => {
    const repo = new FirestoreAccountingRepository(testDb);
    const entry = await repo.createJournalEntry('company-1', mockEntry);
    expect(entry.id).toBeDefined();
  });
});
```

### 9.3 Boundary

```
Pure Business Logic (no mocks needed):
  ✅ calculateIncomeTax()
  ✅ calculateQuarterlyVAT()
  ✅ calculateDepreciation()
  ✅ matchBankTransaction()
  ✅ generateInvoiceNumber()

Adapter Tests (mock/emulator needed):
  ✅ FirestoreAccountingRepository
  ✅ NestorContactProvider
  ✅ OpenAIDocumentAnalyzer
```

---

## 10. Security Considerations

### 10.1 Data Isolation

```typescript
/**
 * ΚΡΙΣΙΜΟ: Κάθε operation πρέπει company-scoped.
 * Το companyId πρέπει ΠΑΝΤΑ να ελέγχεται server-side.
 */
class FirestoreAccountingRepository implements IAccountingRepository {
  async getJournalEntries(
    companyId: string,
    filters: JournalEntryFilters
  ): Promise<PaginatedResult<JournalEntry>> {
    // ✅ ALWAYS scope by companyId
    const ref = collection(
      this.db,
      `accounting/${companyId}/journal_entries`
    );
    // ...
  }
}
```

### 10.2 Sensitive Data

| Data | Χειρισμός |
|------|-----------|
| myDATA credentials | Environment variables only |
| ΑΦΜ πελατών | Encrypted at rest (Firestore default) |
| IBAN | Masked in UI (GR68 **** **** **** 8448) |
| Tax calculations | Company-scoped, no cross-access |

---

## 11. Dependencies Summary

| Αφαίρεση | Interface | NestorApp Adapter | Standalone Adapter |
|---------|-----------|-------------------|-------------------|
| Data Store | `IAccountingRepository` | Firestore | PostgreSQL |
| CRM | `IContactProvider` | NestorApp Contacts | Standalone DB |
| AI | `IDocumentAnalyzer` | OpenAI | Claude / Manual |
| Auth | `IAuthProvider` | Firebase Auth | NextAuth / Clerk |
| Notifications | `INotificationProvider` | Telegram + Mailgun | Email only |
| File Storage | `IFileStorageProvider` | Firebase Storage | S3 / R2 |
| UI Kit | Re-export layer | Shadcn/Radix | Standalone kit |
| i18n | Self-contained | NestorApp i18n | Own strings |
| Config | `ICompanyConfigProvider` | Firestore settings | DB / .env |

---

## 12. Open Questions

| # | Ερώτηση | Status |
|---|---------|--------|
| 1 | NPM monorepo (turborepo/nx) ή απλό folder structure; | DEFAULT: Folder structure (Phase 1-2) |
| 2 | PostgreSQL adapter: Prisma ή Drizzle ORM; | DEFERRED: Phase 3 |
| 3 | Standalone auth: NextAuth ή Clerk; | DEFERRED: Phase 3 |

---

## 13. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-09 | ADR Created — Portability & Abstraction Layers | Γιώργος + Claude Code |
| 2026-02-09 | 6 core interfaces (Repository, Contacts, AI, Auth, Notifications, Storage) | Claude Code |
| 2026-02-09 | Provider pattern (React Context) for dependency injection | Claude Code |
| 2026-02-09 | UI re-export layer (1 file change for standalone) | Claude Code |
| 2026-02-09 | Self-contained i18n: hardcoded EL first, namespace later | Claude Code |
| 2026-02-09 | 3-phase migration: Embedded → Loosely Coupled → Extractable | Claude Code |
| 2026-02-09 | Import rules: ❌ direct Firebase, ✅ via interfaces only | Claude Code |
| 2026-02-09 | Public API via index.ts: types + interfaces + config + provider | Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
