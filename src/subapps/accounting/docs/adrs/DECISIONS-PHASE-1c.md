# Accounting Phase 1c — Αποφάσεις Σχεδιασμού

**Ημερομηνία**: 2026-03-30
**Status**: IMPLEMENTED (2026-03-30)
**Scope**: Accounting Audit Log + Hooks Wiring + Bank Zod Validation
**Μέθοδος**: Ερωτήσεις → Αποφάσεις Γιώργου → Τεκμηρίωση

---

## Πηγές Έρευνας

Η σχεδιαστική διαδικασία βασίστηκε σε enterprise research:
- **SAP S/4HANA**: CDHDR/CDPOS change documents, field-level audit, OB52 period control
- **Oracle NetSuite**: System Notes per record, Transaction Audit Trail, period close checklist
- **QuickBooks**: Audit Log (creates/edits/deletes, sign-in events, admin actions)
- **Xero**: History & Notes per document, lock date mechanism
- **AWS Architecture**: Event-driven invoice processing, idempotent balance updates
- **ΑΑΔΕ/myDATA 2026**: B2B e-invoicing mandate (Feb 2026 >1M, Oct 2026 all), MARK ID traceability
- **ISO 20022**: camt.053 bank statement format replacing MT940 (SWIFT migration 2025)
- **Zod**: Runtime validation at system boundaries, safeParse pattern, schema-first types

---

## Ερωτήσεις & Αποφάσεις

### Q1: Audit Trail — Scope & Granularity

**Ερώτηση**: Ποιες ενέργειες θα καταγράφονται στο audit log;

**Τι κάνουν οι μεγάλοι:**

| Σύστημα | Audit Scope |
|---------|-------------|
| **SAP S/4HANA** | Κάθε change document (CDHDR/CDPOS): field-level tracking, before/after values |
| **NetSuite** | System Notes: record-level audit σε κάθε transaction + configuration |
| **QuickBooks** | Audit Log: creates/edits/deletes, sign-in/sign-out, admin actions |
| **Xero** | History & Notes: per-document timeline |
| **ΑΑΔΕ/myDATA** | Υποχρεωτική ιχνηλατησιμότητα, unique MARK ID ανά submission |

**Οι 3 επιλογές:**

**A) Minimal — Μόνο financial mutations (~6-8 events):**
- Create/Update/Cancel invoice, journal, payment, balance

**B) Medium — Financial + Period + Admin (~15 events):**
- Όλα τα A + period close/lock/reopen, credit limit, disputes, bank match, reconciliation

**C) Full — SAP/NetSuite field-level (~25+ events):**
- Όλα τα B + before/after values, login/logout, config changes, exports

**Απόφαση Γιώργου**: ✅ **B — Medium** (Financial + Period + Admin, ~15 event types)

**Λόγος**: Καλύπτει ΑΑΔΕ/myDATA compliance + enterprise visibility χωρίς το overhead
του field-level tracking. Τα critical financial events + admin actions αρκούν.
Μπορεί να επεκταθεί σε C αργότερα αν χρειαστεί.

**Event Types που θα υλοποιηθούν**:
1. `INVOICE_CREATED` — Νέο τιμολόγιο
2. `INVOICE_UPDATED` — Ενημέρωση τιμολογίου (draft/rejected only)
3. `INVOICE_CANCELLED` — Ακύρωση (void)
4. `INVOICE_CREDIT_NOTE` — Έκδοση πιστωτικού
5. `JOURNAL_CREATED` — Νέα εγγραφή ημερολογίου
6. `JOURNAL_REVERSED` — Αντιλογιστική εγγραφή
7. `PAYMENT_RECORDED` — Καταγραφή πληρωμής
8. `BALANCE_UPDATED` — Ενημέρωση υπολοίπου πελάτη
9. `BALANCE_RECONCILED` — Batch reconciliation
10. `PERIOD_CLOSED` — Κλείσιμο περιόδου
11. `PERIOD_LOCKED` — Κλείδωμα περιόδου (permanent)
12. `PERIOD_REOPENED` — Ξανάνοιγμα περιόδου
13. `CREDIT_LIMIT_CHANGED` — Αλλαγή πιστωτικού ορίου
14. `DISPUTE_FLAGGED` — Αμφισβήτηση τιμολογίου
15. `BANK_MATCHED` — Αντιστοίχιση τραπεζικής κίνησης

---

### Q2: Audit Trail — Storage Architecture

**Ερώτηση**: Πού αποθηκεύονται τα audit entries;

**Τι κάνουν οι μεγάλοι:**

| Σύστημα | Storage Pattern |
|---------|----------------|
| **SAP S/4HANA** | Ξεχωριστοί πίνακες CDHDR (header) + CDPOS (items). Composite indexes. Immutable, append-only |
| **NetSuite** | Flat `system_note` table + indexes σε recordType + recordId + timestamp. Append-only |
| **QuickBooks** | Internal audit_log table — flat, append-only, read-only access |
| **Entersoft** | Ξεχωριστός πίνακας ελέγχου ανά module, append-only |

**Οι 3 επιλογές:**

**A) Flat collection χωρίς indexes:**
- 1 document per event, query by entityId only
- Con: Δεν μπορείς cross-entity queries

**B) Subcollection per entity (`invoices/{id}/audit_log`):**
- Co-located, αλλά δεν κάνει cross-entity queries

**C) Hybrid — Flat collection + Composite Indexes:**
- Flat `accounting_audit_log` collection
- Index 1: `entityType + entityId + timestamp` → ιστορικό per document
- Index 2: `eventType + timestamp` → cross-entity analytics (π.χ. "ΟΛΕΣ οι ακυρώσεις Μαρτίου")
- Index 3: `userId + timestamp` → user activity audit (π.χ. "τι έκανε ο χρήστης Υ")
- Pro: Enterprise-grade — ΚΑΙ per-entity ΚΑΙ cross-entity queries
- Con: 3 composite indexes (μηδενικό κόστος runtime/κώδικα)

**Απόφαση Γιώργου**: ✅ **C — Hybrid (Flat collection + 3 Composite Indexes)**

**Λόγος**: Ίδιο pattern με SAP (CDHDR indexes) και NetSuite (system_note indexes).
Flat collection = append-only, immutable. 3 composite indexes = enterprise-grade querying
χωρίς overhead. Κανένας μεγάλος παίκτης δεν κάνει flat χωρίς indexes.

**Firestore Collection**: `accounting_audit_log`

**Document Schema**:
```typescript
interface AccountingAuditEntry {
  auditId: string;           // Enterprise ID (prefix: alog_)
  eventType: AccountingAuditEventType; // 15 event types
  entityType: 'invoice' | 'journal' | 'balance' | 'period' | 'bank_transaction';
  entityId: string;          // ID του affected document
  userId: string;            // Ποιος έκανε την ενέργεια
  timestamp: string;         // ISO 8601
  details: string;           // Human-readable περιγραφή
  metadata: Record<string, string | number | boolean | null>; // Extra context
}
```

**Composite Indexes** (firestore.indexes.json):
1. `entityType ASC + entityId ASC + timestamp DESC`
2. `eventType ASC + timestamp DESC`
3. `userId ASC + timestamp DESC`

---

### Q3: Audit Trail — Immutability & Retention

**Ερώτηση**: Τα audit logs είναι immutable; Πόσο καιρό κρατούνται;

**Τι κάνουν οι μεγάλοι:**

| Σύστημα | Immutability | Retention |
|---------|-------------|-----------|
| **SAP S/4HANA** | 100% immutable — ΚΑΝΕΝΑ delete/update. Archiving μόνο σε cold storage μετά 7+ χρόνια |
| **NetSuite** | Append-only, read-only. SOX compliance: 7 χρόνια minimum |
| **ΑΑΔΕ/ΚΦΔ (Ν.4987/2022)** | 5 χρόνια υποχρεωτική φύλαξη λογιστικών αρχείων. Παραγραφή 5 ετών |
| **EU GDPR** | Audit logs ΔΕΝ υπόκεινται σε right-to-erasure αν legal obligation (Άρθρο 17§3b) |

**Οι 2 επιλογές:**

**A) Strict Immutable — Νομική υποχρέωση:**
- Audit service: ΜΟΝΟ `create` + `list/query` (read-only). ΚΑΝΕΝΑ `update`/`delete`
- Retention: 5+ χρόνια (ΚΦΔ compliance)
- Cleanup: Μόνο manual admin batch μετά 5 χρόνια (future phase)

**B) Soft Immutable — Pragmatic:**
- Admin archive μετά 2 χρόνια σε cold collection

**Απόφαση Γιώργου**: ✅ **A — Strict Immutable**

**Λόγος**: Νομική υποχρέωση ΚΦΔ (5 χρόνια). Ίδιο pattern με SAP (zero delete) και
NetSuite (append-only, read-only). Firestore κόστος αμελητέο (~1KB/entry).
GDPR δεν εφαρμόζεται σε audit logs (legal obligation exemption).

**Repository API** (μόνο read + create):
- `createAuditEntry(entry)` — Append new entry (ΜΟΝΟ create)
- `listAuditEntries(filters, limit)` — Query by entityType/entityId/eventType/userId/dateRange
- **ΔΕΝ υπάρχει** `updateAuditEntry` ή `deleteAuditEntry` — by design

---

### Q4: Hooks — Balance Update & Posting Validation Trigger Points

**Ερώτηση**: Σε ποια endpoints θα καλείται αυτόματα `updateCustomerBalance()` και `validatePostingAllowed()`;

**Τι κάνουν οι μεγάλοι:**

| Σύστημα | Trigger Points |
|---------|---------------|
| **SAP B1** | Invoice post, payment post, credit note, void → ALL trigger `OCRD.Balance` synchronously |
| **NetSuite** | Every transaction save → recalculate `Customer.balance` real-time |
| **SAP S/4HANA** | OB52 period check ΠΡΙΝ κάθε journal/invoice posting. Closed → reject |

**Τρέχουσα κατάσταση** (πριν Phase 1c):

| Endpoint | Balance Update | Posting Validation |
|----------|---------------|-------------------|
| POST /invoices | ❌ | ❌ |
| DELETE /invoices/[id] | ❌ | — |
| PATCH /invoices/[id] | ❌ | — |
| POST /journal | — | ❌ |
| POST /balances | ✅ (reconcile) | — |

**Απόφαση Γιώργου**: ✅ **4 Hook Points**

**Hook 1 — `POST /invoices` (create):**
- ΠΡΙΝ create: `validatePostingAllowed(issueDate)` → αν ΟΧΙ OPEN → 422
- ΠΡΙΝ create: `checkCreditLimit(balance, amount)` → αν `allowed === false` → 422
- ΜΕΤΑ create: `updateCustomerBalance(customerId, fiscalYear)`

**Hook 2 — `DELETE /invoices/[id]` (cancel/void/credit note):**
- ΜΕΤΑ cancel: `updateCustomerBalance(customerId, fiscalYear)`

**Hook 3 — `PATCH /invoices/[id]` (update):**
- ΜΕΤΑ update: `updateCustomerBalance(customerId, fiscalYear)` (μόνο αν αλλάζουν payments/amounts)

**Hook 4 — `POST /journal` (create):**
- ΠΡΙΝ create: `validatePostingAllowed(date)` → αν ΟΧΙ OPEN → 422
- ΟΧΙ balance update (journals δεν επηρεάζουν AR balance εκτός αν linked σε invoice)

**Λόγος**: Ακριβώς τα trigger points SAP B1 + NetSuite. Synchronous calls στο ίδιο
request (όχι fire-and-forget). Credit limit check μόνο στο create invoice (ίδιο με SAP KNKK).

---

### Q5: Bank Zod — Validation Schemas

**Ερώτηση**: Ποια Zod schemas χρειάζονται τα bank endpoints;

**Τρέχουσα κατάσταση:**

| Endpoint | Validation |
|----------|-----------|
| POST /bank/transactions | Manual if-checks (μπακάλικο) |
| POST /bank/match | Manual if-checks (μπακάλικο) |
| POST /bank/import | FormData + CSV custom parsers (OK) |

**Τι κάνουν οι μεγάλοι:**

| Σύστημα | Pattern |
|---------|---------|
| **SAP** | BAPI parameter validation — strict types, mandatory fields, value ranges πριν business logic |
| **NetSuite** | SuiteTalk API — XSD schema validation σε κάθε request |
| **Stripe** | Strict schema validation σε κάθε endpoint. Invalid → 400 αμέσως |

**Απόφαση Γιώργου**: ✅ **2 Zod Schemas + safeParseBody()**

**Schema 1 — `CreateBankTransactionSchema`:**
```typescript
z.object({
  accountId: z.string().min(1).max(128),
  valueDate: z.string().min(10).max(30),
  direction: z.enum(['credit', 'debit']),
  amount: z.number().positive().max(999_999_999),
  currency: z.string().length(3).default('EUR'),
  bankDescription: z.string().max(500).optional(),
  counterparty: z.string().max(200).nullable().optional(),
  paymentReference: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).passthrough()
```

**Schema 2 — `MatchBankTransactionSchema`:**
```typescript
z.object({
  transactionId: z.string().min(1).max(128),
  journalEntryId: z.string().min(1).max(128),
}).passthrough()
```

**Bank/import**: ΔΕΝ χρειάζεται Zod — CSV custom parsers (parseCSVDate, parseCSVAmount)
ήδη κάνουν row-level validation. Ίδιο pattern με SAP/NetSuite file imports.

**Λόγος**: Validate at the boundary, reject early. Ίδιο pattern με τα υπάρχοντα
CreateInvoiceSchema και CreateJournalEntrySchema. Αντικαθιστά manual if-checks.

---

### Q6: Hooks — Synchronous ή Fire-and-Forget;

**Ερώτηση**: Τα balance updates και audit logs εκτελούνται synchronous ή async;

**Τι κάνουν οι μεγάλοι:**

| Σύστημα | Balance Update | Audit Log |
|---------|---------------|-----------|
| **Google (Zanzibar/Spanner)** | Atomic transaction — data + audit + derived state μαζί. Fail → rollback ALL |
| **SAP B1** | Synchronous — `OCRD.Balance` στο ίδιο DB transaction με invoice posting |
| **SAP S/4HANA** | Synchronous — ACDOCA + BKPF + change documents = same commit |
| **NetSuite** | Synchronous — balance + system notes = same transaction |
| **Stripe** | Balance: synchronous. Notifications: async |

**Οι 3 επιλογές:**

**A) Both Synchronous — Google/SAP/NetSuite pattern:**
- Balance + Audit = στο ίδιο request, πριν response
- Αν αποτύχει → 500 error, δεν ολοκληρώνεται η εργασία
- +50-100ms latency (1-2 extra Firestore writes) — αμελητέο

**B) Balance Sync + Audit Fire-and-Forget:**
- Audit: `.catch(() => {})` — μπορεί να χαθεί σιωπηλά
- Shortcut μικρών SaaS

**C) Both Fire-and-Forget:**
- Balance drift risk — ΑΠΑΡΑΔΕΚΤΟ

**Απόφαση Γιώργου**: ✅ **A — Both Synchronous**

**Λόγος**: Google/SAP/NetSuite pattern. Κάθε mutation = atomic: data + balance + audit
γράφονται μαζί. Αν ένα αποτύχει → rollback. Zero eventual consistency σε financial data.
Audit logs = νομική υποχρέωση (ΚΦΔ) — δεν χάνονται σιωπηλά. +50ms αμελητέο σε
accounting operations.

**Σημαντικό**: Αυτό σημαίνει ότι ο τρέχων κώδικας στο `DELETE /invoices/[id]` που κάνει
`logAuditEvent(...).catch(() => {})` (fire-and-forget) θα **αντικατασταθεί** με synchronous
audit call μέσω του νέου accounting audit service.

---

### Q7: Audit Service — API Design (Explicit vs Automatic)

**Ερώτηση**: Πώς καλείται ο audit service; Χειροκίνητα ή αυτόματα;

**Τι κάνουν οι μεγάλοι:**

| Σύστημα | Pattern |
|---------|---------|
| **Google** | Automatic — infrastructure interceptors, κανένας developer δεν γράφει audit calls χειροκίνητα |
| **SAP S/4HANA** | Automatic — BAPI framework γράφει change documents αυτόματα |
| **NetSuite** | Automatic — SuiteScript framework δημιουργεί system notes αυτόματα σε κάθε record save |
| **Django** | Semi-auto — `@auditlog.register(Model)` decorator → αυτόματα μετά |
| **Spring Boot** | Semi-auto — `@Audited` annotation → αυτόματα μετά |

**Οι 2 επιλογές:**

**A) Explicit calls στα endpoints:**
- `await logAccountingEvent(...)` σε κάθε endpoint χειροκίνητα
- Con: Developer ξεχνάει → compliance gap

**B) Automatic — Audited Repository Wrapper:**
- `createAuditedRepository(repo, userId)` → κάθε mutation αυτόματα γράφει audit
- Reads: δεν γράφουν audit (zero overhead)
- Mutations (create/update/delete): αυτόματο audit entry
- Pro: Zero compliance risk, scales σε Φάσεις 2-4, DRY
- Con: ~100-150 γραμμές wrapper code (one-time investment)

**Απόφαση Γιώργου**: ✅ **B — Automatic (Audited Repository Wrapper)**

**Λόγος**: Google/SAP/NetSuite pattern. Κανένας developer δεν πρέπει να θυμάται
να καλέσει audit manually. Infrastructure layer το κάνει αυτόματα. Αν εξαρτάσαι
από τον developer → κάποια στιγμή ξεχνάει → κενό audit trail → παραβίαση ΚΦΔ.

**Υλοποίηση**:
```typescript
function createAuditedRepository(
  repo: IAccountingRepository,
  userId: string
): IAccountingRepository {
  // Wraps every mutation method (createInvoice, updateInvoice, etc.)
  // with automatic audit entry creation
  // Read methods (getInvoice, listInvoices, etc.) pass through unchanged
}
```

**Mutation methods που θα γράφουν audit αυτόματα**:
- `createInvoice` → INVOICE_CREATED
- `updateInvoice` → INVOICE_UPDATED
- `createJournalEntry` → JOURNAL_CREATED
- `createBankTransaction` → (no audit — bulk imports)
- `updateBankTransaction` → BANK_MATCHED (when matchStatus changes)
- `upsertCustomerBalance` → BALANCE_UPDATED
- `updateFiscalPeriod` → PERIOD_CLOSED / PERIOD_LOCKED / PERIOD_REOPENED (by status)
- `createFiscalPeriods` → (no audit — bulk setup)

**Read methods (pass-through, NO audit)**:
- `getInvoice`, `listInvoices`, `getJournalEntry`, `listJournalEntries`, etc.

---

### Q8: Audit — Enterprise ID Prefix

**Ερώτηση**: Ποιο prefix για τα audit entry IDs;

**Σύστημα**: `src/services/enterprise-id.service.ts` — Single Source of Truth (60+ generators)
**Κανόνας CLAUDE.md N.6**: ΜΟΝΑΔΙΚΗ ΠΗΓΗ IDs = enterprise-id.service.ts. ΑΠΑΓΟΡΕΥΕΤΑΙ addDoc()/inline IDs.

**Υπάρχοντα accounting prefixes:**
- `inv_` → invoices
- `je_` → journal entries
- `cbal_` → customer balances
- `fp_` → fiscal periods
- `btx_` → bank transactions
- `ibatch_` → import batches

**Απόφαση Γιώργου**: ✅ **`alog_` + `generateAuditLogId()`**

**Παράδειγμα ID**: `alog_1743350400000_a1b2c3d4`

**Υλοποίηση**: Νέος generator στο `enterprise-id.service.ts`:
```typescript
generateAuditLogId(): string  // prefix: 'alog'
```

**Firestore collection**: `accounting_audit_log` (νέα, θα προστεθεί στο `firestore-collections.ts`)

---

### Q9: Firestore Collection Name

**Ερώτηση**: Πώς θα λέγεται η νέα collection;

**Τι κάνουν οι μεγάλοι:**
- **Google Cloud**: `audit_log` / `audit_logs` — module-prefixed, σαφές
- **SAP**: `CDHDR` — module-scoped change documents
- **NetSuite**: `system_note` — flat, namespaced

**Απόφαση Γιώργου**: ✅ **`ACCOUNTING_AUDIT_LOG: 'accounting_audit_log'`**

Ακολουθεί ακριβώς το existing convention:
- `ACCOUNTING_JOURNAL_ENTRIES: 'accounting_journal_entries'`
- `ACCOUNTING_CUSTOMER_BALANCES: 'accounting_customer_balances'`
- `ACCOUNTING_FISCAL_PERIODS: 'accounting_fiscal_periods'`
- **`ACCOUNTING_AUDIT_LOG: 'accounting_audit_log'`** ← νέο

---

## ΣΥΝΟΨΗ ΟΛΩΝ ΤΩΝ ΑΠΟΦΑΣΕΩΝ

| # | Θέμα | Απόφαση | Pattern |
|---|------|---------|---------|
| Q1 | Audit Scope | **B — Medium** (15 event types) | SAP/NetSuite — financial + period + admin |
| Q2 | Audit Storage | **C — Hybrid** (flat collection + 3 composite indexes) | SAP CDHDR + NetSuite system_note |
| Q3 | Audit Immutability | **A — Strict Immutable** (5 χρόνια ΚΦΔ) | SAP/NetSuite append-only, νομική υποχρέωση |
| Q4 | Hook Points | **4 endpoints** (create/cancel/update invoice + create journal) | SAP B1 OCRD.Balance triggers |
| Q5 | Bank Zod | **2 schemas** (transactions + match) | SAP BAPI / Stripe schema validation |
| Q6 | Sync Pattern | **A — Both Synchronous** (balance + audit) | Google Spanner / SAP atomic commits |
| Q7 | Audit API | **B — Automatic** (Audited Repository Wrapper) | Google interceptors / SAP BAPI framework |
| Q8 | Enterprise ID | **`alog_`** prefix + `generateAuditLogId()` | enterprise-id.service.ts SSoT |
| Q9 | Collection Name | **`accounting_audit_log`** | `accounting_` prefix convention |

---

## ΕΚΤΙΜΗΣΗ ΥΛΟΠΟΙΗΣΗΣ

**Νέα αρχεία (~5)**:
1. `services/accounting-audit-service.ts` — Audit entry creation + query helpers
2. `services/repository/accounting-repo-audit.ts` — Firestore CRUD (create + list only)
3. `services/audited-repository-wrapper.ts` — Automatic audit wrapper
4. `types/accounting-audit.ts` — AuditEntry type, EventType enum

**Τροποποιήσεις σε υπάρχοντα (~7)**:
1. `config/firestore-collections.ts` — +1 collection (ACCOUNTING_AUDIT_LOG)
2. `services/enterprise-id.service.ts` — +1 prefix (alog) + generator
3. `app/api/accounting/invoices/route.ts` — POST: +validatePostingAllowed +checkCreditLimit +balance update
4. `app/api/accounting/invoices/[id]/route.ts` — DELETE: +balance update. PATCH: +conditional balance update
5. `app/api/accounting/journal/route.ts` — POST: +validatePostingAllowed
6. `app/api/accounting/bank/transactions/route.ts` — POST: +Zod schema
7. `app/api/accounting/bank/match/route.ts` — POST: +Zod schema
8. `firestore.indexes.json` — +3 composite indexes
9. `types/interfaces.ts` — +2 repo methods (createAuditEntry, listAuditEntries)
10. `services/index.ts` — +barrel exports
11. `types/index.ts` — +barrel exports
