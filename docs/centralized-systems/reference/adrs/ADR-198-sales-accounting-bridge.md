# ADR-198: Sales-to-Accounting Bridge (Transaction Chain Pattern)

**Status**: IMPLEMENTED & VERIFIED
**Date**: 2026-03-11
**Category**: Backend Systems / Accounting Integration
**Related**: ACC-001 (Invoice Types), ACC-002 (Journal Entries), ACC-004 (VAT Engine)

## Context

Quando un venditore — Όταν ο πωλητής κάνει κράτηση μονάδας με προκαταβολή, το ποσό αποθηκεύεται μόνο στο `commercial.reservationDeposit` του unit. Δεν δημιουργείται κανένα λογιστικό παραστατικό:

- Δεν εκδίδεται απόδειξη προκαταβολής
- Δεν καταγράφεται ΦΠΑ
- Δεν γίνεται εγγραφή στο βιβλίο εσόδων-εξόδων
- Δεν υπάρχει audit trail λογιστικών κινήσεων

Η εφαρμογή ήδη διαθέτει πλήρες accounting module (Phase 1) με invoicing, journal entries, VAT engine, bank matching. Χρειάζεται μόνο η **γέφυρα** μεταξύ Sales → Accounting.

**Industry Pattern**: SAP RE-FX (Sales Order → Billing Document → Journal Posting), Oracle Property Manager, Yardi Voyager — **Transaction Chain** linking.

## Decision

### Transaction Chain Pattern

Κάθε πώληση μονάδας δημιουργεί μία **αλυσίδα συναλλαγών** (transaction chain) που συνδέει όλα τα παραστατικά μέσω κοινού `transactionChainId`:

```
Κράτηση + Προκαταβολή €5.000
    ↓
Τιμολόγιο Πώλησης (ΤΠ 1.1) — Προκαταβολή
    → netAmount: €4.032,26 | ΦΠΑ 24%: €967,74 | gross: €5.000
    → Journal entry: construction_res_income
    ↓
--- Αργότερα: Πώληση τελική τιμή €150.000 ---
    ↓
Τιμολόγιο Πώλησης (ΤΠ 1.1) — Υπόλοιπο
    → netAmount: (€150.000 - €5.000) / 1.24 = €116.935,48
    → relatedInvoiceId → deposit invoice
    ↓
--- Ή: Ακύρωση κράτησης ---
    ↓
Πιστωτικό Τιμολόγιο (5.1) — Επιστροφή
    → creditAmount: €5.000
    → relatedInvoiceId → deposit invoice
```

### Discriminated Union Events

Τρεις τύποι events ενεργοποιούν τη γέφυρα:

| Event Type | Trigger | Invoice Type | myDATA |
|------------|---------|-------------|--------|
| `deposit_invoice` | Κράτηση με προκαταβολή | ΤΠ 1.1 (Sales Invoice) | category1_1 |
| `final_sale_invoice` | Πώληση μονάδας | ΤΠ 1.1 (Sales Invoice) | category1_1 |
| `credit_invoice` | Ακύρωση κράτησης | 5.1 (Credit Invoice) | category1_1 |

### Architecture

```
SalesActionDialogs (Client)
  ↓ fire-and-forget POST
/api/sales/{unitId}/accounting-event (API Route)
  ↓
SalesAccountingBridge (Server Service)
  ├─ resolveContactInfo() — buyer data from Firestore
  ├─ getIssuerFromProfile() — company data from accounting_settings
  ├─ createAccountingServices() — reuse existing accounting infra
  │   ├─ repository.createInvoice() — atomic numbering
  │   └─ service.createJournalEntryFromInvoice() — auto journal
  ├─ update unit.commercial.transactionChainId — Firestore Admin SDK
  └─ notifyAccountingOffice() — fire-and-forget Mailgun email
```

### Email Notification (Accounting Office)

Μετά τη δημιουργία invoice, στέλνεται αυτόματα email στο λογιστήριο:

| Setting | Value |
|---------|-------|
| Env var | `ACCOUNTING_NOTIFY_EMAIL` |
| Provider | Mailgun (EU region) via `sendReplyViaMailgun()` |
| Pattern | Fire-and-forget — δεν μπλοκάρει πώληση |
| Graceful skip | Αν δεν υπάρχει email → skip χωρίς error |

**Email content ανά event type:**
- **Deposit**: Κράτηση μονάδας, ποσό, αριθμός τιμολογίου, link στα invoices
- **Final sale**: Πώληση, τελική τιμή, υπόλοιπο, link
- **Credit**: Ακύρωση, ποσό επιστροφής, αιτία, link

| File | Purpose |
|------|---------|
| `src/services/sales-accounting/accounting-notification.ts` | Email builders + send logic |

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| Bridge Types | `src/services/sales-accounting/types.ts` | Discriminated union: `SalesAccountingEvent` |
| Bridge Service | `src/services/sales-accounting/sales-accounting-bridge.ts` | Server-side orchestration |
| Barrel | `src/services/sales-accounting/index.ts` | Re-exports |
| API Route | `src/app/api/sales/[unitId]/accounting-event/route.ts` | POST endpoint with auth + rate limit |
| UI Card | `src/components/sales/cards/TransactionChainCard.tsx` | Invoice chain display in SaleInfoContent |
| Email Notify | `src/services/sales-accounting/accounting-notification.ts` | Mailgun email to accounting office |

### Type Extensions

| Type | File | New Field |
|------|------|-----------|
| `UnitCommercialData` | `src/types/unit.ts` | `transactionChainId: string \| null` |
| `Invoice` | `src/subapps/accounting/types/invoice.ts` | `unitId: string \| null` |
| `InvoiceFilters` | `src/subapps/accounting/types/invoice.ts` | `unitId?: string` |

### Design Decisions

1. **ΦΠΑ 24% σε νεόδμητα**: `net = gross / 1.24` — η τιμή πώλησης ακινήτου περιλαμβάνει ΦΠΑ
2. **Fire-and-forget**: Η λογιστική δεν μπλοκάρει τη ροή πώλησης. Η πώληση πετυχαίνει ΠΑΝΤΑ.
3. **Buyer resolution server-side**: Client στέλνει `buyerContactId`, server φέρνει πλήρη στοιχεία
4. **Graceful degradation**: Αν δεν υπάρχει `company_profile` → return error χωρίς exception
5. **Accounting category**: `construction_res_income` (ΦΠΑ 24%, myDATA category1_1, e3Code 561_001)
6. **Transaction chain**: Κοινό `transactionChainId` για deposit + final + credit invoices

### Reused Existing Systems

- `createAccountingServices()` → `src/subapps/accounting/services/create-accounting-services.ts`
- `FirestoreAccountingRepository.createInvoice()` → atomic numbering
- `AccountingService.createJournalEntryFromInvoice()` → auto journal
- `enterprise-id.service.generateInvoiceAccId()` → ID generation
- `account-categories.ts` → category configs
- `withAuth` + `withStandardRateLimit` → API security
- `sendReplyViaMailgun()` → Mailgun email sending (EU region)

## Consequences

### Positive

- Κάθε deposit/sale/cancellation δημιουργεί αυτόματα λογιστικό παραστατικό
- Πλήρες audit trail: Invoice → Journal Entry → VAT → E-E Book
- Αξιοποιεί 100% το υπάρχον accounting module χωρίς duplication
- Fire-and-forget = μηδενική επίπτωση στο UX πωλήσεων
- Transaction chain = πλήρης ιχνηλασιμότητα ανά μονάδα

### Positive (Email)

- Το λογιστήριο ενημερώνεται αυτόματα χωρίς πρόσβαση στην εφαρμογή
- Περιλαμβάνει deep link στα invoices για άμεση πρόσβαση
- Graceful — αν αποτύχει, η πώληση δεν επηρεάζεται

### Negative

- Αν η λογιστική αποτύχει (π.χ. missing company_profile), ο χρήστης δεν ειδοποιείται άμεσα
- Χρειάζεται manual reconciliation αν κάτι πάει στραβά (edge case)

### Risks

- ΦΠΑ 24% hardcoded — αν αλλάξει ο συντελεστής, χρειάζεται update
- Δεν υποστηρίζει ακόμα πολλαπλές γραμμές (line items) ανά invoice

## Verification

1. Κράτηση με deposit €5.000 → invoice ΤΠ + journal entry
2. Πώληση €150.000 → invoice για €145.000 (minus deposit)
3. Ακύρωση → credit invoice €5.000
4. SaleInfoContent → TransactionChainCard με τα invoices
5. Βιβλίο Ε-Ε → εμφανίζονται τα journal entries
6. ΦΠΑ → σωστός υπολογισμός (24% σε καθαρό ποσό)
7. Graceful degradation → χωρίς company profile, η πώληση γίνεται κανονικά

### Firestore Composite Indexes Required

| Fields | Collection | Purpose |
|--------|------------|---------|
| `fiscalYear` ASC + `issueDate` DESC | `accounting_invoices` | Main invoices listing |
| `fiscalYear` ASC + `type` ASC + `issueDate` DESC | `accounting_invoices` | Filter by type |
| `fiscalYear` ASC + `paymentStatus` ASC + `issueDate` DESC | `accounting_invoices` | Filter by payment status |
| `unitId` ASC + `issueDate` DESC | `accounting_invoices` | TransactionChainCard queries |
| `unitId` ASC + `type` ASC + `createdAt` ASC | `accounting_invoices` | findDepositInvoiceId |

### Environment Variables

| Var | Purpose | Required |
|-----|---------|----------|
| `ACCOUNTING_NOTIFY_EMAIL` | Email λογιστηρίου για ειδοποιήσεις | Optional (graceful skip) |
| `FIREBASE_SERVICE_ACCOUNT_KEY_B64` | Firebase Admin SDK (server-side Firestore) | Required |
| `MAILGUN_API_KEY` | Mailgun sending | Required for email |
| `MAILGUN_DOMAIN` | Mailgun domain (nestorconstruct.gr) | Required for email |
| `MAILGUN_REGION` | `eu` | Required for email |

## Changelog

| Date | Change |
|------|--------|
| 2026-03-11 | ADR created — APPROVED |
| 2026-03-11 | Email notification via Mailgun added |
| 2026-03-11 | TransactionChainCard fix — apiClient unwraps canonical response |
| 2026-03-11 | Firestore composite indexes deployed |
| 2026-03-11 | VERIFIED in production — invoices, emails, UI card all working |
