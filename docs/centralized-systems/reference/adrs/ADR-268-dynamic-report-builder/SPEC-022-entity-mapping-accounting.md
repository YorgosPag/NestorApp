# SPEC-022: Πλήρης Χαρτογράφηση — Λογιστική (Accounting)

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.0
**Last Updated**: 2026-03-29
**Source of Truth**: Κώδικας (`src/subapps/accounting/types/`)
**Entities**: 6 — Invoices, Journal Entries, VAT Summaries, Bank Transactions, Expense Documents, EFKA

---

## Περιεχόμενα

- [Οντότητα 1: Invoices (Τιμολόγια)](#οντότητα-1-invoices-τιμολόγια)
- [Οντότητα 2: Journal Entries (Ημερολόγιο Ε-Ε)](#οντότητα-2-journal-entries-ημερολόγιο-ε-ε)
- [Οντότητα 3: VAT Summaries (ΦΠΑ)](#οντότητα-3-vat-summaries-φπα)
- [Οντότητα 4: Bank Transactions (Τραπεζικές Κινήσεις)](#οντότητα-4-bank-transactions-τραπεζικές-κινήσεις)
- [Οντότητα 5: Expense Documents (Παραστατικά Εξόδων)](#οντότητα-5-expense-documents-παραστατικά-εξόδων)
- [Οντότητα 6: EFKA (Ασφαλιστικά)](#οντότητα-6-efka-ασφαλιστικά)
- [§5 Σχέσεις μεταξύ Οντοτήτων (Cross-Entity)](#5-σχέσεις-μεταξύ-οντοτήτων-cross-entity)
- [§6 Report Builder Impact](#6-report-builder-impact)
- [§7 Στατιστικά](#7-στατιστικά)

---

# Οντότητα 1: Invoices (Τιμολόγια)

## §1 Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `accounting_invoices` |
| **TypeScript** | `Invoice` (`src/subapps/accounting/types/invoice.ts`) |
| **ID Pattern** | `inv_YYYY_NNN` (series + sequential number) |
| **Tenant Isolation** | Implicit (single-tenant accounting subapp) |
| **ADR References** | ADR-ACC-002 (Invoicing), ADR-ACC-003 (myDATA), ADR-ACC-018 (Print Layout), ADR-ACC-019 (Email), ADR-ACC-020 (Withholding Tax) |

## §2 Πλήρης Κατάλογος Πεδίων

### 2.1 Κύρια Πεδία

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `invoiceId` | string | Yes | Firestore doc ID |
| 2 | `series` | string | Yes | Σειρά αρίθμησης (π.χ. 'A', 'B') |
| 3 | `number` | number | Yes | Αύξων αριθμός |
| 4 | `type` | InvoiceType | Yes | 7 τύποι: `service_invoice` / `sales_invoice` / `retail_receipt` / `service_receipt` / `credit_invoice` / `service_invoice_eu` / `service_invoice_3rd` |
| 5 | `issueDate` | string (ISO) | Yes | Ημερομηνία έκδοσης |
| 6 | `dueDate` | string (ISO) | No | Ημερομηνία λήξης πληρωμής |
| 7 | `currency` | CurrencyCode | Yes | Νόμισμα (default: EUR) |
| 8 | `totalNetAmount` | number | Yes | Σύνολο καθαρών ποσών |
| 9 | `totalVatAmount` | number | Yes | Σύνολο ΦΠΑ |
| 10 | `totalGrossAmount` | number | Yes | Γενικό σύνολο (net + ΦΠΑ) |
| 11 | `paymentMethod` | PaymentMethod | Yes | 6 τρόποι: `cash` / `bank_transfer` / `card` / `check` / `credit` / `mixed` |
| 12 | `paymentStatus` | enum | Yes | `unpaid` / `partial` / `paid` |
| 13 | `totalPaid` | number | Yes | Σύνολο πληρωμών |
| 14 | `balanceDue` | number | Yes | Υπόλοιπο |
| 15 | `projectId` | string | No | Αναφορά σε project |
| 16 | `unitId` | string | No | Αναφορά σε unit (ADR-198) |
| 17 | `relatedInvoiceId` | string | No | Αρχικό τιμολόγιο (για πιστωτικά) |
| 18 | `journalEntryId` | string | No | Αναφορά σε εγγραφή Ε-Ε |
| 19 | `withholdingRate` | number | No | Συντελεστής παρακράτησης (0, 1, 3, 20) — ADR-ACC-020 |
| 20 | `withholdingAmount` | number | No | Ποσό παρακράτησης (snapshot) — ADR-ACC-020 |
| 21 | `notes` | string | No | Σημειώσεις |
| 22 | `fiscalYear` | number | Yes | Φορολογικό έτος |
| 23 | `createdAt` | string (ISO) | Yes | Timestamp δημιουργίας |
| 24 | `updatedAt` | string (ISO) | Yes | Timestamp ενημέρωσης |

### 2.2 Nested: `issuer` (InvoiceIssuer — snapshot εκδότη)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 25 | `issuer.name` | string | Yes | Επωνυμία |
| 26 | `issuer.vatNumber` | string | Yes | ΑΦΜ |
| 27 | `issuer.taxOffice` | string | Yes | ΔΟΥ |
| 28 | `issuer.address` | string | Yes | Διεύθυνση |
| 29 | `issuer.city` | string | Yes | Πόλη |
| 30 | `issuer.postalCode` | string | Yes | ΤΚ |
| 31 | `issuer.phone` | string | No | Τηλέφωνο |
| 32 | `issuer.mobile` | string | No | Κινητό (ADR-ACC-018) |
| 33 | `issuer.email` | string | No | Email |
| 34 | `issuer.website` | string | No | Website (ADR-ACC-018) |
| 35 | `issuer.profession` | string | Yes | Δραστηριότητα/Επάγγελμα |
| 36 | `issuer.bankAccounts[]` | Array | Yes | Τραπεζικοί λογαριασμοί |
| 36a | `issuer.bankAccounts[].bankName` | string | Yes | Τράπεζα |
| 36b | `issuer.bankAccounts[].iban` | string | Yes | IBAN |

### 2.3 Nested: `customer` (InvoiceCustomer — στοιχεία πελάτη)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 37 | `customer.contactId` | string | No | Firestore contact ID |
| 38 | `customer.name` | string | Yes | Επωνυμία/Ονοματεπώνυμο |
| 39 | `customer.vatNumber` | string | No | ΑΦΜ (υποχρεωτικό για ΤΠΥ/ΤΠ) |
| 40 | `customer.taxOffice` | string | No | ΔΟΥ |
| 41 | `customer.address` | string | No | Διεύθυνση |
| 42 | `customer.city` | string | No | Πόλη |
| 43 | `customer.postalCode` | string | No | ΤΚ |
| 44 | `customer.country` | string | Yes | Χώρα (default: 'GR') |
| 45 | `customer.email` | string | No | Email αποστολής |

### 2.4 Nested: `lineItems[]` (InvoiceLineItem)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 46 | `lineItems[].lineNumber` | number | Yes | Αύξων αριθμός γραμμής |
| 47 | `lineItems[].description` | string | Yes | Περιγραφή υπηρεσίας/αγαθού |
| 48 | `lineItems[].quantity` | number | Yes | Ποσότητα |
| 49 | `lineItems[].unit` | string | Yes | Μονάδα μέτρησης |
| 50 | `lineItems[].unitPrice` | number | Yes | Τιμή μονάδας (χωρίς ΦΠΑ) |
| 51 | `lineItems[].vatRate` | number | Yes | Συντελεστής ΦΠΑ (24/13/6/0) |
| 52 | `lineItems[].netAmount` | number | Yes | Καθαρό ποσό (qty × unitPrice) |
| 53 | `lineItems[].mydataCode` | MyDataIncomeType | Yes | myDATA classification |

### 2.5 Nested: `vatBreakdown[]` (VatBreakdown)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 54 | `vatBreakdown[].vatRate` | number | Yes | Συντελεστής ΦΠΑ |
| 55 | `vatBreakdown[].netAmount` | number | Yes | Καθαρό ποσό για αυτόν τον συντελεστή |
| 56 | `vatBreakdown[].vatAmount` | number | Yes | Ποσό ΦΠΑ |

### 2.6 Nested: `payments[]` (InvoicePayment)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 57 | `payments[].paymentId` | string | Yes | Μοναδικό ID πληρωμής |
| 58 | `payments[].date` | string (ISO) | Yes | Ημερομηνία πληρωμής |
| 59 | `payments[].amount` | number | Yes | Ποσό πληρωμής (EUR) |
| 60 | `payments[].method` | PaymentMethod | Yes | Τρόπος πληρωμής |
| 61 | `payments[].notes` | string | No | Σημειώσεις πληρωμής |

### 2.7 Nested: `mydata` (InvoiceMyDataMeta)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 62 | `mydata.status` | MyDataDocumentStatus | Yes | 5 καταστάσεις: `draft` / `sent` / `accepted` / `rejected` / `cancelled` |
| 63 | `mydata.mark` | string | No | ΜΑΡΚ αριθμός ΑΑΔΕ |
| 64 | `mydata.uid` | string | No | UID παραστατικού myDATA |
| 65 | `mydata.authCode` | string | No | Authentication code |
| 66 | `mydata.submittedAt` | string (ISO) | No | Ημερομηνία υποβολής |
| 67 | `mydata.respondedAt` | string (ISO) | No | Ημερομηνία αποδοχής/απόρριψης |
| 68 | `mydata.errorMessage` | string | No | Μήνυμα σφάλματος |

### 2.8 Nested: `emailHistory[]` (EmailSendRecord — ADR-ACC-019)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 69 | `emailHistory[].sentAt` | string (ISO) | Yes | Timestamp αποστολής |
| 70 | `emailHistory[].recipientEmail` | string | Yes | Παραλήπτης |
| 71 | `emailHistory[].subject` | string | Yes | Subject email |
| 72 | `emailHistory[].mailgunMessageId` | string | No | Mailgun ID |
| 73 | `emailHistory[].status` | enum | Yes | `sent` / `failed` |
| 74 | `emailHistory[].error` | string | No | Μήνυμα σφάλματος |

## §3 Enums

| Enum | Τιμές |
|------|-------|
| **InvoiceType** | `service_invoice`, `sales_invoice`, `retail_receipt`, `service_receipt`, `credit_invoice`, `service_invoice_eu`, `service_invoice_3rd` (7) |
| **PaymentMethod** | `cash`, `bank_transfer`, `card`, `check`, `credit`, `mixed` (6) |
| **PaymentStatus** | `unpaid`, `partial`, `paid` (3) |
| **MyDataDocumentStatus** | `draft`, `sent`, `accepted`, `rejected`, `cancelled` (5) |
| **MyDataIncomeType** | `category1_1`, `category1_3`, `category1_4`, `category1_5` (4) |
| **EmailSendStatus** | `sent`, `failed` (2) |

## §4 Subcollections

Κανένα — όλα τα nested data (lineItems, payments, vatBreakdown, emailHistory) αποθηκεύονται embedded στο ίδιο document.

**Σχετικές collections (ξεχωριστές):**
- `accounting_invoice_counters/{seriesCode}` — Σειρές αρίθμησης (InvoiceSeries)
- `accounting_settings/service_presets` — Service presets (ServicePresetsDocument)

---

# Οντότητα 2: Journal Entries (Ημερολόγιο Ε-Ε)

## §1 Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `accounting_journal_entries` |
| **TypeScript** | `JournalEntry` (`src/subapps/accounting/types/journal.ts`) |
| **ID Pattern** | `je_YYYY_NNN` |
| **ADR References** | ADR-ACC-001 (Chart of Accounts) |

## §2 Πλήρης Κατάλογος Πεδίων

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `entryId` | string | Yes | Firestore doc ID |
| 2 | `date` | string (ISO) | Yes | Ημερομηνία εγγραφής |
| 3 | `type` | EntryType | Yes | `income` / `expense` |
| 4 | `category` | AccountCategory | Yes | 5 income + 19 expense + custom_xxx κατηγορίες |
| 5 | `description` | string | Yes | Περιγραφή εγγραφής |
| 6 | `netAmount` | number | Yes | Καθαρό ποσό (EUR) |
| 7 | `vatRate` | number | Yes | Συντελεστής ΦΠΑ (24/13/6/0) |
| 8 | `vatAmount` | number | Yes | Ποσό ΦΠΑ (EUR) |
| 9 | `grossAmount` | number | Yes | Μικτό ποσό (net + ΦΠΑ) |
| 10 | `vatDeductible` | boolean | Yes | Εκπίπτει ο ΦΠΑ; |
| 11 | `paymentMethod` | PaymentMethod | Yes | Τρόπος πληρωμής |
| 12 | `contactId` | string | No | Αναφορά σε contact |
| 13 | `contactName` | string | No | Denormalized: όνομα επαφής |
| 14 | `invoiceId` | string | No | Αναφορά σε τιμολόγιο |
| 15 | `mydataCode` | MyDataIncomeType / MyDataExpenseType | Yes | myDATA classification |
| 16 | `e3Code` | string | Yes | E3 φορολογικός κωδικός |
| 17 | `fiscalYear` | number | Yes | Φορολογικό έτος |
| 18 | `quarter` | FiscalQuarter | Yes | Τρίμηνο (1/2/3/4) |
| 19 | `notes` | string | No | Σημειώσεις |
| 20 | `createdAt` | string (ISO) | Yes | Timestamp δημιουργίας |
| 21 | `updatedAt` | string (ISO) | Yes | Timestamp ενημέρωσης |

## §3 Enums

| Enum | Τιμές |
|------|-------|
| **EntryType** | `income`, `expense` (2) |
| **IncomeCategory** | `service_income`, `construction_income`, `construction_res_income`, `rental_income`, `asset_sale_income`, `other_income` (6) |
| **ExpenseCategory** | `third_party_fees`, `rent`, `utilities`, `telecom`, `fuel`, `vehicle_expenses`, `vehicle_insurance`, `office_supplies`, `software`, `equipment`, `travel`, `training`, `advertising`, `efka`, `professional_tax`, `bank_fees`, `tee_fees`, `depreciation`, `other_expense` (19) |
| **AccountCategory** | IncomeCategory + ExpenseCategory + `custom_${string}` (25 + custom) |
| **FiscalQuarter** | `1`, `2`, `3`, `4` (4) |
| **PaymentMethod** | (βλ. Invoice) |
| **MyDataIncomeType** | `category1_1`, `category1_3`, `category1_4`, `category1_5` (4) |
| **MyDataExpenseType** | `category2_2`, `category2_3`, `category2_4`, `category2_5`, `category2_6`, `category2_7`, `category2_11`, `category2_12`, `category2_14` (9) |

## §4 Subcollections

Κανένα.

---

# Οντότητα 3: VAT Summaries (ΦΠΑ)

## §1 Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | Computed — δεν αποθηκεύεται ως collection, υπολογίζεται runtime από journal entries + invoices |
| **TypeScript** | `VATQuarterSummary`, `VATAnnualSummary` (`src/subapps/accounting/types/vat.ts`) |
| **ADR References** | ADR-ACC-004 (VAT Engine) |
| **Σημείωση** | Αυτή η οντότητα είναι **aggregate/computed** — τα δεδομένα πηγάζουν από journal entries και invoices |

## §2 Πλήρης Κατάλογος Πεδίων — VATQuarterSummary

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `fiscalYear` | number | Yes | Φορολογικό έτος |
| 2 | `quarter` | FiscalQuarter | Yes | Τρίμηνο |
| 3 | `period` | PeriodRange | Yes | Περίοδος (from/to) |
| 4 | `status` | VATQuarterStatus | Yes | `open` / `calculated` / `submitted` / `paid` |
| 5 | `totalOutputVat` | number | Yes | Σύνολο ΦΠΑ εκροών |
| 6 | `totalInputVat` | number | Yes | Σύνολο ΦΠΑ εισροών (πριν εκπτωσιμότητα) |
| 7 | `totalDeductibleInputVat` | number | Yes | Σύνολο εκπεστέου ΦΠΑ εισροών |
| 8 | `vatPayable` | number | Yes | ΦΠΑ προς απόδοση (output - deductibleInput) |
| 9 | `vatCredit` | number | Yes | Πιστωτικό υπόλοιπο |
| 10 | `calculatedAt` | string (ISO) | Yes | Ημερομηνία υπολογισμού |
| 11 | `submittedAt` | string (ISO) | No | Ημερομηνία υποβολής |

### 2.1 Nested: `outputBreakdown[]` (VATRateBreakdown)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 12 | `outputBreakdown[].vatRate` | number | Yes | Συντελεστής ΦΠΑ |
| 13 | `outputBreakdown[].totalNetAmount` | number | Yes | Σύνολο καθαρών ποσών |
| 14 | `outputBreakdown[].totalVatAmount` | number | Yes | Σύνολο ΦΠΑ |
| 15 | `outputBreakdown[].entryCount` | number | Yes | Πλήθος εγγραφών |

### 2.2 Nested: `inputBreakdown[]` (VATInputRateBreakdown)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 16 | `inputBreakdown[].vatRate` | number | Yes | Συντελεστής ΦΠΑ |
| 17 | `inputBreakdown[].totalNetAmount` | number | Yes | Σύνολο καθαρών ποσών |
| 18 | `inputBreakdown[].totalVatAmount` | number | Yes | Σύνολο ΦΠΑ |
| 19 | `inputBreakdown[].entryCount` | number | Yes | Πλήθος εγγραφών |
| 20 | `inputBreakdown[].totalDeductibleVat` | number | Yes | Σύνολο εκπεστέου ΦΠΑ |
| 21 | `inputBreakdown[].totalNonDeductibleVat` | number | Yes | Σύνολο μη εκπεστέου ΦΠΑ |

### 2.3 Πεδία — VATAnnualSummary

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 22 | `fiscalYear` | number | Yes | Φορολογικό έτος |
| 23 | `quarters` | VATQuarterSummary[] | Yes | Τα 4 τρίμηνα |
| 24 | `annualOutputVat` | number | Yes | Ετήσιος ΦΠΑ εκροών |
| 25 | `annualDeductibleInputVat` | number | Yes | Ετήσιος εκπεστέος ΦΠΑ εισροών |
| 26 | `annualVatPayable` | number | Yes | Ετήσιος ΦΠΑ προς απόδοση |
| 27 | `annualVatCredit` | number | Yes | Ετήσιο πιστωτικό υπόλοιπο |
| 28 | `totalVatPaid` | number | Yes | Ήδη αποδοθέν ΦΠΑ |
| 29 | `settlementAmount` | number | Yes | Υπόλοιπο εκκαθάρισης |

## §3 Enums

| Enum | Τιμές |
|------|-------|
| **VATQuarterStatus** | `open`, `calculated`, `submitted`, `paid` (4) |
| **FiscalQuarter** | `1`, `2`, `3`, `4` |

## §4 Βοηθητικοί Τύποι (Config)

| Type | Πεδία | Χρήση |
|------|-------|-------|
| **VATRate** | code, rate, mydataCategory, label, validFrom, validTo (6) | Ορισμός συντελεστή ΦΠΑ |
| **VATDeductibilityRule** | category, deductiblePercent, legalBasis, notes (4) | Κανόνας εκπτωσιμότητας |

---

# Οντότητα 4: Bank Transactions (Τραπεζικές Κινήσεις)

## §1 Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `accounting_bank_transactions` |
| **TypeScript** | `BankTransaction` (`src/subapps/accounting/types/bank.ts`) |
| **ID Pattern** | Firestore auto (ή import-based) |
| **ADR References** | ADR-ACC-008 (Bank Reconciliation) |

## §2 Πλήρης Κατάλογος Πεδίων

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `transactionId` | string | Yes | Firestore doc ID |
| 2 | `accountId` | string | Yes | Αναφορά σε BankAccountConfig |
| 3 | `valueDate` | string (ISO) | Yes | Ημερομηνία αξίας |
| 4 | `transactionDate` | string (ISO) | Yes | Ημερομηνία εκτέλεσης |
| 5 | `direction` | TransactionDirection | Yes | `credit` / `debit` |
| 6 | `amount` | number | Yes | Ποσό (πάντα θετικό) |
| 7 | `currency` | CurrencyCode | Yes | Νόμισμα |
| 8 | `balanceAfter` | number | No | Υπόλοιπο μετά τη συναλλαγή |
| 9 | `bankDescription` | string | Yes | Περιγραφή τράπεζας |
| 10 | `counterparty` | string | No | Αντισυμβαλλόμενος |
| 11 | `paymentReference` | string | No | Αιτιολογία πληρωμής |
| 12 | `matchStatus` | MatchStatus | Yes | `unmatched` / `auto_matched` / `manual_matched` / `excluded` |
| 13 | `matchedEntityId` | string | No | ID αντιστοιχισμένης εγγραφής |
| 14 | `matchedEntityType` | enum | No | `invoice` / `journal_entry` / `efka_payment` / `tax_payment` |
| 15 | `matchConfidence` | number | No | Βαθμός εμπιστοσύνης (0-100) |
| 16 | `importBatchId` | string | Yes | ID batch εισαγωγής |
| 17 | `notes` | string | No | Σημειώσεις χρήστη |
| 18 | `createdAt` | string (ISO) | Yes | Timestamp δημιουργίας |
| 19 | `updatedAt` | string (ISO) | Yes | Timestamp ενημέρωσης |

## §3 Enums

| Enum | Τιμές |
|------|-------|
| **TransactionDirection** | `credit`, `debit` (2) |
| **MatchStatus** | `unmatched`, `auto_matched`, `manual_matched`, `excluded` (4) |
| **MatchedEntityType** | `invoice`, `journal_entry`, `efka_payment`, `tax_payment` (4) |

## §4 Σχετική Collection: Bank Accounts

**Collection**: `accounting_bank_accounts`
**TypeScript**: `BankAccountConfig`

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `accountId` | string | Yes | Firestore doc ID |
| 2 | `bankName` | string | Yes | Τράπεζα |
| 3 | `iban` | string | Yes | IBAN |
| 4 | `label` | string | Yes | Ετικέτα εμφάνισης |
| 5 | `type` | BankAccountType | Yes | `checking` / `savings` / `business` |
| 6 | `currency` | CurrencyCode | Yes | Νόμισμα |
| 7 | `isActive` | boolean | Yes | Ενεργός |
| 8 | `bankCode` | string | No | SWIFT/BIC |
| 9 | `notes` | string | No | Σημειώσεις |
| 10 | `createdAt` | string (ISO) | Yes | Timestamp |

## §5 Σχετική Collection: Import Batches

**Collection**: `accounting_import_batches`
**TypeScript**: `ImportBatch`

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `batchId` | string | Yes | Firestore doc ID |
| 2 | `accountId` | string | Yes | Τραπεζικός λογαριασμός |
| 3 | `fileName` | string | Yes | Όνομα αρχείου CSV |
| 4 | `status` | ImportBatchStatus | Yes | `processing` / `completed` / `failed` |
| 5 | `totalRows` | number | Yes | Γραμμές αρχείου |
| 6 | `importedCount` | number | Yes | Εισαχθείσες |
| 7 | `skippedCount` | number | Yes | Παραλείψεις/Διπλότυπα |
| 8 | `errors` | string[] | Yes | Σφάλματα |
| 9 | `importedAt` | string (ISO) | Yes | Ημερομηνία εισαγωγής |

---

# Οντότητα 5: Expense Documents (Παραστατικά Εξόδων)

## §1 Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `accounting_expense_documents` |
| **TypeScript** | `ReceivedExpenseDocument` (`src/subapps/accounting/types/documents.ts`) |
| **ID Pattern** | Firestore auto |
| **ADR References** | ADR-ACC-005 (AI Document Processing) |

## §2 Πλήρης Κατάλογος Πεδίων

### 2.1 Κύρια Πεδία

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `documentId` | string | Yes | Firestore doc ID |
| 2 | `type` | DocumentType | Yes | 7 τύποι: `purchase_invoice` / `receipt` / `utility_bill` / `telecom_bill` / `fuel_receipt` / `bank_statement` / `other` |
| 3 | `status` | DocumentProcessingStatus | Yes | `processing` / `review` / `confirmed` / `rejected` |
| 4 | `fileUrl` | string | Yes | Firebase Storage URL |
| 5 | `fileName` | string | Yes | Όνομα αρχείου |
| 6 | `mimeType` | string | Yes | MIME type |
| 7 | `fileSize` | number | Yes | Μέγεθος (bytes) |
| 8 | `confirmedCategory` | ExpenseCategory | No | Επιβεβαιωμένη κατηγορία |
| 9 | `confirmedNetAmount` | number | No | Επιβεβαιωμένο καθαρό ποσό |
| 10 | `confirmedVatAmount` | number | No | Επιβεβαιωμένο ΦΠΑ |
| 11 | `confirmedDate` | string (ISO) | No | Επιβεβαιωμένη ημερομηνία |
| 12 | `confirmedIssuerName` | string | No | Επιβεβαιωμένος εκδότης |
| 13 | `journalEntryId` | string | No | Αναφορά σε Ε-Ε (μετά confirmation) |
| 14 | `notes` | string | No | Σημειώσεις χρήστη |
| 15 | `fiscalYear` | number | Yes | Φορολογικό έτος |
| 16 | `createdAt` | string (ISO) | Yes | Timestamp δημιουργίας |
| 17 | `updatedAt` | string (ISO) | Yes | Timestamp ενημέρωσης |

### 2.2 Nested: `extractedData` (ExtractedDocumentData — AI-extracted)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 18 | `extractedData.issuerName` | string | No | AI: Επωνυμία εκδότη |
| 19 | `extractedData.issuerVatNumber` | string | No | AI: ΑΦΜ εκδότη |
| 20 | `extractedData.issuerAddress` | string | No | AI: Διεύθυνση εκδότη |
| 21 | `extractedData.documentNumber` | string | No | AI: Αριθμός παραστατικού |
| 22 | `extractedData.issueDate` | string (ISO) | No | AI: Ημερομηνία έκδοσης |
| 23 | `extractedData.netAmount` | number | No | AI: Καθαρό ποσό |
| 24 | `extractedData.vatAmount` | number | No | AI: ΦΠΑ |
| 25 | `extractedData.grossAmount` | number | No | AI: Μικτό ποσό |
| 26 | `extractedData.vatRate` | number | No | AI: Συντελεστής ΦΠΑ |
| 27 | `extractedData.paymentMethod` | PaymentMethod | No | AI: Τρόπος πληρωμής |
| 28 | `extractedData.overallConfidence` | number | Yes | AI: Βαθμός εμπιστοσύνης (0-100) |

### 2.3 Nested: `extractedData.lineItems[]` (ExtractedLineItem)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 29 | `extractedData.lineItems[].description` | string | Yes | Περιγραφή |
| 30 | `extractedData.lineItems[].quantity` | number | No | Ποσότητα |
| 31 | `extractedData.lineItems[].unitPrice` | number | No | Τιμή μονάδας |
| 32 | `extractedData.lineItems[].netAmount` | number | Yes | Καθαρό ποσό |
| 33 | `extractedData.lineItems[].vatRate` | number | No | Συντελεστής ΦΠΑ |

## §3 Enums

| Enum | Τιμές |
|------|-------|
| **DocumentType** | `purchase_invoice`, `receipt`, `utility_bill`, `telecom_bill`, `fuel_receipt`, `bank_statement`, `other` (7) |
| **DocumentProcessingStatus** | `processing`, `review`, `confirmed`, `rejected` (4) |
| **ExpenseCategory** | (βλ. Journal Entries — 19 τιμές) |

## §4 Σχετική Collection: Vendor Learning

**Collection**: Implied — `accounting_vendor_learning/{vendorVatNumber}`
**TypeScript**: `VendorCategoryLearning`

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `vendorVatNumber` | string | Yes | ΑΦΜ (doc ID) |
| 2 | `vendorName` | string | Yes | Επωνυμία |
| 3 | `suggestedCategory` | ExpenseCategory | Yes | Προτεινόμενη κατηγορία |
| 4 | `categoryHistory[]` | Array | Yes | Ιστορικό: category, count, lastUsed |
| 5 | `totalDocuments` | number | Yes | Σύνολο εγγράφων |
| 6 | `updatedAt` | string (ISO) | Yes | Τελευταία ενημέρωση |

---

# Οντότητα 6: EFKA (Ασφαλιστικά)

## §1 Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collections** | `accounting_efka_payments` (payments), `accounting_efka_config` (config) |
| **TypeScript** | `EFKAAnnualSummary`, `EFKAPayment`, `EFKAMonthlyBreakdown`, `EFKAYearConfig`, `EFKAUserConfig` (`src/subapps/accounting/types/efka.ts`) |
| **ADR References** | ADR-ACC-006 (EFKA Contributions), ADR-ACC-017 (Board of Directors & EFKA) |
| **Σημείωση** | Πολύπλοκη δομή — ΕΦΚΑΙδεύθερος επαγγελματίας + εταιρικά variants (ΟΕ/ΕΠΕ/ΑΕ) |

## §2 Πλήρης Κατάλογος Πεδίων — EFKAAnnualSummary

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `year` | number | Yes | Φορολογικό έτος |
| 2 | `totalPaid` | number | Yes | Σύνολο καταβληθεισών εισφορών |
| 3 | `totalDue` | number | Yes | Σύνολο οφειλομένων |
| 4 | `balanceDue` | number | Yes | Υπόλοιπο (due - paid) |
| 5 | `taxDeductibleAmount` | number | Yes | Ποσό εκπεστέο φορολογικά |
| 6 | `paidMonths` | number | Yes | Αριθμός πληρωμένων μηνών |
| 7 | `overdueMonths` | number | Yes | Αριθμός εκπρόθεσμων |

### 2.1 Nested: `monthlyBreakdown[]` (EFKAMonthlyBreakdown)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 8 | `monthlyBreakdown[].month` | number | Yes | Μήνας (1-12) |
| 9 | `monthlyBreakdown[].year` | number | Yes | Έτος |
| 10 | `monthlyBreakdown[].mainPensionAmount` | number | Yes | Κύρια σύνταξη |
| 11 | `monthlyBreakdown[].supplementaryAmount` | number | Yes | Επικουρική |
| 12 | `monthlyBreakdown[].lumpSumAmount` | number | Yes | Εφάπαξ |
| 13 | `monthlyBreakdown[].healthAmount` | number | Yes | Υγεία |
| 14 | `monthlyBreakdown[].totalMonthly` | number | Yes | Σύνολο μήνα |

### 2.2 Nested: `payments[]` (EFKAPayment)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 15 | `payments[].paymentId` | string | Yes | Μοναδικό ID |
| 16 | `payments[].year` | number | Yes | Φορολογικό έτος |
| 17 | `payments[].month` | number | Yes | Μήνας (1-12) |
| 18 | `payments[].amount` | number | Yes | Ποσό πληρωμής |
| 19 | `payments[].dueDate` | string (ISO) | Yes | Ημερομηνία λήξης |
| 20 | `payments[].status` | EFKAPaymentStatus | Yes | `upcoming` / `due` / `paid` / `overdue` / `keao` |
| 21 | `payments[].paidDate` | string (ISO) | No | Ημερομηνία πληρωμής |
| 22 | `payments[].bankTransactionRef` | string | No | Αναφορά τράπεζας (matching) |
| 23 | `payments[].partnerId` | string | No | ID εταίρου (null = ατομική) |
| 24 | `payments[].notes` | string | No | Σημειώσεις |

## §3 Config Types — EFKAYearConfig

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `year` | number | Yes | Φορολογικό έτος |
| 2 | `mainPensionCategories[]` | EFKACategoryRate[] | Yes | 6 κατηγορίες κύριας σύνταξης |
| 3 | `supplementaryCategories[]` | EFKACategoryRate[] | Yes | 3 κατηγορίες επικουρικής |
| 4 | `lumpSumCategories[]` | EFKACategoryRate[] | Yes | 3 κατηγορίες εφάπαξ |
| 5 | `healthContributionMonthly` | number | Yes | Μηνιαία εισφορά υγείας |
| 6 | `legalReference` | string | Yes | ΦΕΚ αναφοράς |

### EFKACategoryRate (per entry)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `code` | string | Yes | Κωδικός (π.χ. 'main_1') |
| 2 | `label` | string | Yes | Ετικέτα (π.χ. '1η Κατηγορία - 210€') |
| 3 | `monthlyAmount` | number | Yes | Μηνιαίο ποσό |
| 4 | `annualAmount` | number | Yes | Ετήσιο ποσό |
| 5 | `branch` | enum | Yes | `main_pension` / `supplementary` / `lump_sum` |

### EFKAUserConfig

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `selectedMainPensionCode` | string | Yes | Επιλεγμένη κύρια σύνταξη |
| 2 | `selectedSupplementaryCode` | string | Yes | Επιλεγμένη επικουρική |
| 3 | `selectedLumpSumCode` | string | Yes | Επιλεγμένο εφάπαξ |
| 4 | `efkaRegistrationNumber` | string | Yes | ΑΜΑ ΕΦΚΑ |
| 5 | `activityStartDate` | string (ISO) | Yes | Έναρξη δραστηριότητας |
| 6 | `notes` | string | No | Σημειώσεις |

## §4 Εταιρικά Variants

### PartnershipEFKASummary (ΟΕ)

| # | Πεδίο | Τύπος | Περιγραφή |
|---|-------|-------|-----------|
| 1 | `year` | number | Φορολογικό έτος |
| 2 | `partnerSummaries[]` | PartnerEFKASummary[] | Ανά εταίρο: partnerId, partnerName, summary (EFKAAnnualSummary) |
| 3 | `totalAllPartnersPaid` | number | Σύνολο πληρωμών |
| 4 | `totalAllPartnersDue` | number | Σύνολο οφειλόμενων |

### EPEEFKASummary (ΕΠΕ)

| # | Πεδίο | Τύπος | Περιγραφή |
|---|-------|-------|-----------|
| 1 | `year` | number | Φορολογικό έτος |
| 2 | `managerSummaries[]` | ManagerEFKASummary[] | Ανά διαχειριστή |
| 3 | `totalAllManagersPaid` | number | Σύνολο πληρωμών |
| 4 | `totalAllManagersDue` | number | Σύνολο οφειλόμενων |

### AEEFKASummary (ΑΕ — Dual Mode)

| # | Πεδίο | Τύπος | Περιγραφή |
|---|-------|-------|-----------|
| 1 | `year` | number | Φορολογικό έτος |
| 2 | `employeeBoardMembers[]` | EmployeeBoardMemberEFKA[] | Μισθωτοί (<3% μετοχών): monthlyCompensation, employeeContribution (12.47%), employerContribution (21.13%), totalAnnual |
| 3 | `selfEmployedBoardMembers[]` | ManagerEFKASummary[] | Αυτοαπασχολούμενοι (≥3% μετοχών) |
| 4 | `totalEmployeeEFKA` | number | Σύνολο εργοδοτικών ΕΦΚΑ |
| 5 | `totalSelfEmployedEFKA` | number | Σύνολο αυτοαπασχολούμενων |
| 6 | `totalAllEFKA` | number | Γενικό σύνολο |

## §5 Enums

| Enum | Τιμές |
|------|-------|
| **EFKAPaymentStatus** | `upcoming`, `due`, `paid`, `overdue`, `keao` (5) |
| **EFKACategoryBranch** | `main_pension`, `supplementary`, `lump_sum` (3) |
| **EFKANotificationType** | `payment_due`, `payment_overdue`, `keao_warning`, `rate_change` (4) |

---

# §5 Σχέσεις μεταξύ Οντοτήτων (Cross-Entity)

## 5.1 Διάγραμμα Σχέσεων

```
                         ┌─────────────────────────────┐
                         │      ΛΟΓΙΣΤΙΚΗ (GROUP F)     │
                         └─────────────┬───────────────┘
                                       │
          ┌────────────────────────────┼────────────────────────────┐
          │                            │                            │
  ┌───────┴───────┐           ┌────────┴────────┐          ┌───────┴───────┐
  │   INVOICES    │           │  JOURNAL ENTRIES │          │  BANK TRANS   │
  │ acct_invoices │───────────│  acct_journal_   │──────────│  acct_bank_   │
  │               │  journal  │  entries         │  match   │  transactions │
  │  §lineItems[] │  EntryId  │                  │  Entity  │               │
  │  §payments[]  │           │                  │  Id      │  §matchedId   │
  │  §vatBrkdown[]│           └────────┬─────────┘          └───────┬───────┘
  │  §emailHist[] │                    │                            │
  │  §mydata      │                    │ aggregate                  │ match
  └───────┬───────┘                    │                            │
          │                    ┌───────┴────────┐          ┌────────┴───────┐
          │ related            │  VAT SUMMARIES │          │     EFKA       │
          │ InvoiceId          │  (computed)    │          │  acct_efka_    │
          │                    │  quarterly +   │          │  payments      │
          │                    │  annual        │          │  §payments[]   │
          │                    └────────────────┘          │  §monthlyBrkdn │
          │                                                └────────────────┘
          │
  ┌───────┴───────┐
  │   EXPENSE     │
  │   DOCUMENTS   │
  │ acct_expense_ │──── journalEntryId ────→ JOURNAL ENTRIES
  │ documents     │
  │ §extractedData│
  │ §lineItems[]  │
  └───────────────┘
```

## 5.2 Αναλυτικός Πίνακας Σχέσεων — Εσωτερικές (Accounting ↔ Accounting)

| # | Από | Πεδίο | Προς | Σχέση | Περιγραφή |
|---|-----|-------|------|-------|-----------|
| 1 | **invoices** | `journalEntryId` | **journal_entries** | 1:1 | Τιμολόγιο → εγγραφή Ε-Ε |
| 2 | **invoices** | `relatedInvoiceId` | **invoices** | 1:1 | Πιστωτικό → αρχικό τιμολόγιο |
| 3 | **journal_entries** | `invoiceId` | **invoices** | 1:1 | Εγγραφή Ε-Ε → τιμολόγιο |
| 4 | **bank_transactions** | `matchedEntityId` (type=invoice) | **invoices** | N:1 | Κίνηση → τιμολόγιο |
| 5 | **bank_transactions** | `matchedEntityId` (type=journal_entry) | **journal_entries** | N:1 | Κίνηση → εγγραφή Ε-Ε |
| 6 | **bank_transactions** | `matchedEntityId` (type=efka_payment) | **efka_payments** | N:1 | Κίνηση → πληρωμή ΕΦΚΑ |
| 7 | **bank_transactions** | `matchedEntityId` (type=tax_payment) | **tax_installments** | N:1 | Κίνηση → δόση φόρου |
| 8 | **bank_transactions** | `accountId` | **bank_accounts** | N:1 | Κίνηση → λογαριασμός |
| 9 | **bank_transactions** | `importBatchId` | **import_batches** | N:1 | Κίνηση → batch εισαγωγής |
| 10 | **expense_documents** | `journalEntryId` | **journal_entries** | 1:1 | Παραστατικό → εγγραφή Ε-Ε |
| 11 | **efka.payments[]** | `bankTransactionRef` | **bank_transactions** | 1:1 | Πληρωμή ΕΦΚΑ → κίνηση |
| 12 | **vat_summaries** | (aggregate) | **journal_entries** | 1:N | Σύνοψη ΦΠΑ ← εγγραφές |
| 13 | **vat_summaries** | (aggregate) | **invoices** | 1:N | Σύνοψη ΦΠΑ ← τιμολόγια |

## 5.3 Αναλυτικός Πίνακας Σχέσεων — Εξωτερικές (Accounting → Υπόλοιπο App)

| # | Από | Πεδίο | Προς | Σχέση | Περιγραφή |
|---|-----|-------|------|-------|-----------|
| 14 | **invoices** | `customer.contactId` | **contacts** | N:1 | Πελάτης τιμολογίου |
| 15 | **invoices** | `projectId` | **projects** | N:1 | Τιμολόγιο → έργο |
| 16 | **invoices** | `unitId` | **units** | N:1 | Τιμολόγιο → μονάδα (ADR-198) |
| 17 | **journal_entries** | `contactId` | **contacts** | N:1 | Εγγραφή → επαφή |
| 18 | **efka** | `payments[].partnerId` | **contacts** | N:1 | Πληρωμή ΕΦΚΑ → εταίρος (ΟΕ/ΕΠΕ) |
| 19 | **invoices** | (via PO matching) | **purchase_orders** | N:M | Αντιστοίχιση τιμολογίου-παραγγελίας |

---

# §6 Report Builder Impact

## 6.1 Invoices — Report Builder

**Tier 1 (Flat Table) — Primary columns:**

| Στήλη | Πεδίο | Τύπος | Σημείωση |
|-------|-------|-------|----------|
| Σειρά-Αριθμός | `series` + `number` | text | Computed: "A-042" |
| Τύπος | `type` | enum | 7 τύποι |
| Ημ/νία Έκδοσης | `issueDate` | date | |
| Ημ/νία Λήξης | `dueDate` | date | |
| Πελάτης | `customer.name` | text | |
| ΑΦΜ Πελάτη | `customer.vatNumber` | text | |
| Email Πελάτη | `customer.email` | text | |
| Χώρα Πελάτη | `customer.country` | text | |
| Τρόπος Πληρωμής | `paymentMethod` | enum | |
| Κατ. Πληρωμής | `paymentStatus` | enum | |
| Καθαρό | `totalNetAmount` | currency | |
| ΦΠΑ | `totalVatAmount` | currency | |
| Μικτό | `totalGrossAmount` | currency | |
| Πληρωμένα | `totalPaid` | currency | |
| Υπόλοιπο | `balanceDue` | currency | |
| Παρακράτηση % | `withholdingRate` | number | ADR-ACC-020 |
| Παρακράτηση € | `withholdingAmount` | currency | ADR-ACC-020 |
| myDATA Status | `mydata.status` | enum | |
| myDATA MARK | `mydata.mark` | text | |
| Νόμισμα | `currency` | text | |
| Σημειώσεις | `notes` | text | |
| Χρήση | `fiscalYear` | number | |

**Tier 1 — Computed/Joined:**

| Στήλη | Join | Τύπος |
|-------|------|-------|
| Έργο | `projects.name` via `projectId` | text |
| Μονάδα | `units.code` via `unitId` | text |
| Αρ. Γραμμών | COUNT `lineItems` | number |
| Αρ. Πληρωμών | COUNT `payments` | number |
| Ημέρες Καθυστέρησης | `dueDate` vs `NOW()` | number |
| Σχετ. Τιμολόγιο | `relatedInvoiceId` → series+number | text |

**Tier 2 (Row Expansion) — Arrays:**

| Array | Expanded Columns |
|-------|-----------------|
| `lineItems[]` | lineNumber, description, quantity, unit, unitPrice, vatRate, netAmount, mydataCode |
| `payments[]` | date, amount, method, notes |
| `vatBreakdown[]` | vatRate, netAmount, vatAmount |
| `emailHistory[]` | sentAt, recipientEmail, status |

**Tier 3 (Card PDF) — Layout:**

```
┌──────────────────────────────────────────────┐
│ ΤΙΜΟΛΟΓΙΟ: A-042                              │
│ Τύπος: ΤΠΥ — Τιμολόγιο Παροχής Υπηρεσιών    │
├──────────────────────────────────────────────┤
│ ΕΚΔΟΤΗΣ            │ ΠΕΛΑΤΗΣ                  │
│ [issuer snapshot]  │ [customer snapshot]       │
├──────────────────────────────────────────────┤
│ ΓΡΑΜΜΕΣ:                                      │
│ # │ Περιγραφή │ Ποσ. │ Τιμή │ ΦΠΑ │ Σύνολο  │
│ 1 │ ΠΕΑ       │ 1    │ 300  │ 24% │ 300.00  │
├──────────────────────────────────────────────┤
│ Καθαρό: 300.00 │ ΦΠΑ: 72.00 │ ΣΥΝΟΛΟ: 372.00│
│ Παρακράτηση: 60.00 (20%)                      │
│ Πληρωτέο: 312.00                              │
├──────────────────────────────────────────────┤
│ ΠΛΗΡΩΜΕΣ:                                     │
│ 09/02/2026 │ 312.00 │ Τραπ. Μεταφορά         │
├──────────────────────────────────────────────┤
│ myDATA: ✅ Accepted │ MARK: 400123456          │
└──────────────────────────────────────────────┘
```

## 6.2 Journal Entries — Report Builder

**Tier 1 (Flat Table):**

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Ημ/νία | `date` | date |
| Τύπος | `type` | enum |
| Κατηγορία | `category` | enum |
| Περιγραφή | `description` | text |
| Καθαρό | `netAmount` | currency |
| ΦΠΑ % | `vatRate` | number |
| ΦΠΑ € | `vatAmount` | currency |
| Μικτό | `grossAmount` | currency |
| Εκπίπτει ΦΠΑ | `vatDeductible` | boolean |
| Τρόπος Πληρωμής | `paymentMethod` | enum |
| Επαφή | `contactName` | text |
| myDATA Code | `mydataCode` | text |
| E3 Code | `e3Code` | text |
| Τρίμηνο | `quarter` | enum |
| Χρήση | `fiscalYear` | number |
| Σημειώσεις | `notes` | text |

**Tier 1 — Computed/Joined:**

| Στήλη | Join | Τύπος |
|-------|------|-------|
| Τιμολόγιο | `invoices.series+number` via `invoiceId` | text |
| Επαφή (ID) | `contacts.displayName` via `contactId` | text |

**Tier 2:** Δεν υπάρχουν arrays — flat entity.

**Tier 3 (Card PDF):** Δεν εφαρμόζεται — journal entries χρησιμοποιούνται μόνο σε tabular reports.

## 6.3 VAT Summaries — Report Builder

**Tier 1 (Flat Table — per quarter):**

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Χρήση | `fiscalYear` | number |
| Τρίμηνο | `quarter` | enum |
| Status | `status` | enum |
| ΦΠΑ Εκροών | `totalOutputVat` | currency |
| ΦΠΑ Εισροών | `totalInputVat` | currency |
| Εκπεστέο ΦΠΑ | `totalDeductibleInputVat` | currency |
| ΦΠΑ Απόδοσης | `vatPayable` | currency |
| Πιστωτικό | `vatCredit` | currency |
| Υπολογισμός | `calculatedAt` | date |
| Υποβολή | `submittedAt` | date |

**Tier 2 (Row Expansion):**

| Array | Expanded Columns |
|-------|-----------------|
| `outputBreakdown[]` | vatRate, totalNetAmount, totalVatAmount, entryCount |
| `inputBreakdown[]` | vatRate, totalNetAmount, totalVatAmount, entryCount, totalDeductibleVat, totalNonDeductibleVat |

## 6.4 Bank Transactions — Report Builder

**Tier 1 (Flat Table):**

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Ημ/νία Αξίας | `valueDate` | date |
| Ημ/νία Εκτέλεσης | `transactionDate` | date |
| Κατεύθυνση | `direction` | enum |
| Ποσό | `amount` | currency |
| Νόμισμα | `currency` | text |
| Υπόλοιπο | `balanceAfter` | currency |
| Περιγραφή | `bankDescription` | text |
| Αντισυμβαλλόμενος | `counterparty` | text |
| Αιτιολογία | `paymentReference` | text |
| Αντιστοίχιση | `matchStatus` | enum |
| Τύπος Match | `matchedEntityType` | enum |
| Εμπιστοσύνη | `matchConfidence` | number |
| Σημειώσεις | `notes` | text |

**Tier 1 — Computed/Joined:**

| Στήλη | Join | Τύπος |
|-------|------|-------|
| Λογαριασμός | `bank_accounts.label` via `accountId` | text |
| Τράπεζα | `bank_accounts.bankName` via `accountId` | text |
| IBAN | `bank_accounts.iban` via `accountId` | text |
| Batch | `import_batches.fileName` via `importBatchId` | text |
| Matched Entity | details via `matchedEntityId` | text |

**Tier 2:** Δεν υπάρχουν arrays — flat entity.

## 6.5 Expense Documents — Report Builder

**Tier 1 (Flat Table):**

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Τύπος | `type` | enum |
| Status | `status` | enum |
| Αρχείο | `fileName` | text |
| Μέγεθος | `fileSize` | number |
| AI: Εκδότης | `extractedData.issuerName` | text |
| AI: ΑΦΜ | `extractedData.issuerVatNumber` | text |
| AI: Ημ/νία | `extractedData.issueDate` | date |
| AI: Καθαρό | `extractedData.netAmount` | currency |
| AI: ΦΠΑ | `extractedData.vatAmount` | currency |
| AI: Μικτό | `extractedData.grossAmount` | currency |
| AI: Εμπιστοσύνη | `extractedData.overallConfidence` | number |
| Κατηγορία (confirmed) | `confirmedCategory` | enum |
| Ποσό (confirmed) | `confirmedNetAmount` | currency |
| ΦΠΑ (confirmed) | `confirmedVatAmount` | currency |
| Ημ/νία (confirmed) | `confirmedDate` | date |
| Εκδότης (confirmed) | `confirmedIssuerName` | text |
| Χρήση | `fiscalYear` | number |

**Tier 1 — Computed/Joined:**

| Στήλη | Join | Τύπος |
|-------|------|-------|
| Εγγραφή Ε-Ε | `journal_entries.description` via `journalEntryId` | text |

**Tier 2 (Row Expansion):**

| Array | Expanded Columns |
|-------|-----------------|
| `extractedData.lineItems[]` | description, quantity, unitPrice, netAmount, vatRate |

## 6.6 EFKA — Report Builder

**Tier 1 (Flat Table — per payment):**

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Έτος | `year` | number |
| Μήνας | `month` | number |
| Ποσό | `amount` | currency |
| Λήξη | `dueDate` | date |
| Status | `status` | enum |
| Πληρωμή | `paidDate` | date |
| Εταίρος | via `partnerId` → contact name | text |
| Σημειώσεις | `notes` | text |

**Tier 1 — Computed/Joined (from annual summary):**

| Στήλη | Join | Τύπος |
|-------|------|-------|
| Σύνολο Πληρωμένων | `totalPaid` | currency |
| Σύνολο Οφειλόμενων | `totalDue` | currency |
| Υπόλοιπο | `balanceDue` | currency |
| Εκπεστέο Φορολογικά | `taxDeductibleAmount` | currency |
| Μήνες Πληρωμένοι | `paidMonths` | number |
| Μήνες Εκπρόθεσμοι | `overdueMonths` | number |

**Tier 2 (Row Expansion):**

| Array | Expanded Columns |
|-------|-----------------|
| `monthlyBreakdown[]` | month, mainPensionAmount, supplementaryAmount, lumpSumAmount, healthAmount, totalMonthly |
| `payments[]` | paymentId, month, amount, dueDate, status, paidDate, bankTransactionRef |

**Tier 3 (Card PDF — Annual EFKA Report):**

```
┌──────────────────────────────────────────────┐
│ ΕΦΚΑ — ΕΤΗΣΙΑ ΣΥΝΟΨΗ 2026                    │
├──────────────────────────────────────────────┤
│ Κατηγορία Κύριας: 1η (210€/μήνα)             │
│ Κατηγορία Επικουρ.: 1η (72€/μήνα)            │
│ Κατηγορία Εφάπαξ: 1η (26€/μήνα)              │
│ Υγεία: 55€/μήνα                               │
│ Σύνολο/μήνα: 363€                             │
├──────────────────────────────────────────────┤
│ ΜΗΝΙΑΙΑ ΑΝΑΛΥΣΗ:                              │
│ Μήνας │ Κύρια │ Επικ. │ Εφάπαξ │ Υγεία │ Σύν │
│ Ιαν   │ 210   │ 72    │ 26     │ 55    │ 363 │
│ ...   │ ...   │ ...   │ ...    │ ...   │ ... │
├──────────────────────────────────────────────┤
│ ΠΛΗΡΩΜΕΣ:                                     │
│ Μήνας │ Ποσό │ Λήξη │ Status │ Πληρωμή       │
│ Ιαν   │ 363  │ 31/1 │ ✅ paid │ 28/1/2026     │
│ ...                                           │
├──────────────────────────────────────────────┤
│ ΣΥΝΟΛΑ: Πληρωμένα: 4,356€ │ Οφειλόμενα: 0€   │
│ Εκπεστέο φορολογικά: 4,356€                   │
└──────────────────────────────────────────────┘
```

---

# §7 Στατιστικά

## Ανά Οντότητα

| Οντότητα | Κύρια Πεδία | Nested Πεδία | Σύνολο Πεδίων | Enums | Nested Arrays | Subcollections |
|----------|-------------|--------------|---------------|-------|---------------|----------------|
| **Invoices** | 24 | 50 (issuer 12, customer 9, lineItems 8, vatBrkdn 3, payments 5, mydata 7, emailHist 6) | **74** | 6 | 4 (lineItems, vatBrkdn, payments, emailHist) | 0 |
| **Journal Entries** | 21 | 0 | **21** | 8 | 0 | 0 |
| **VAT Summaries** | 11 + 8 (annual) | 10 (outputBrkdn 4, inputBrkdn 6) | **29** | 2 | 2 (outputBrkdn, inputBrkdn) | 0 |
| **Bank Transactions** | 19 | 0 | **19** | 3 | 0 | 0 |
| **Expense Documents** | 17 | 16 (extractedData 11, lineItems 5) | **33** | 3 | 1 (lineItems) | 0 |
| **EFKA** | 7 + 6 (config) | 17 (monthlyBrkdn 7, payments 10) | **30** (+variants) | 3 | 2 (monthlyBrkdn, payments) | 0 |

## Σύνολα SPEC-022

| Μετρική | Τιμή |
|---------|------|
| **Οντότητες** | 6 (+ 3 εταιρικά EFKA variants) |
| **Σύνολο Πεδίων** | ~206 (κύρια + nested) |
| **Enums** | 25+ (πολλά shared μεταξύ οντοτήτων) |
| **Nested Arrays** | 9 |
| **Subcollections** | 0 |
| **Εσωτερικές Σχέσεις** | 13 (accounting ↔ accounting) |
| **Εξωτερικές Σχέσεις** | 6 (accounting → contacts, projects, units, purchase_orders) |
| **Σύνολο Σχέσεων** | **19** |
| **Firestore Collections** | 8 (invoices, journal, bank_trans, bank_accounts, import_batches, expense_docs, efka_payments, efka_config) |
| **Computed Entities** | 1 (VAT Summaries — aggregate, not persisted) |
| **AI Integration** | 1 (Expense Documents — OpenAI gpt-4o-mini vision) |
| **Regulatory Compliance** | ΦΠΑ (Ν.2859/2000), ΕΦΚΑ (Ν.4387/2016, ΠΟΛ), myDATA (ΑΑΔΕ), Παρακράτηση (ADR-ACC-020) |
