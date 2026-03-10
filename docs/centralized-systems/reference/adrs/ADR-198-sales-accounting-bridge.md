# ADR-198: Sales-to-Accounting Bridge (Transaction Chain Pattern)

**Status**: APPROVED
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
  └─ update unit.commercial.transactionChainId — Firestore Admin SDK
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| Bridge Types | `src/services/sales-accounting/types.ts` | Discriminated union: `SalesAccountingEvent` |
| Bridge Service | `src/services/sales-accounting/sales-accounting-bridge.ts` | Server-side orchestration |
| Barrel | `src/services/sales-accounting/index.ts` | Re-exports |
| API Route | `src/app/api/sales/[unitId]/accounting-event/route.ts` | POST endpoint with auth + rate limit |
| UI Card | `src/components/sales/cards/TransactionChainCard.tsx` | Invoice chain display in SaleInfoContent |

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

## Consequences

### Positive

- Κάθε deposit/sale/cancellation δημιουργεί αυτόματα λογιστικό παραστατικό
- Πλήρες audit trail: Invoice → Journal Entry → VAT → E-E Book
- Αξιοποιεί 100% το υπάρχον accounting module χωρίς duplication
- Fire-and-forget = μηδενική επίπτωση στο UX πωλήσεων
- Transaction chain = πλήρης ιχνηλασιμότητα ανά μονάδα

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

## Changelog

| Date | Change |
|------|--------|
| 2026-03-11 | ADR created — APPROVED |
