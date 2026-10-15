/**
 * @fileoverview Accounting — ΔΗΛΩΣΕΙΣ των λιστών οθόνης (ταξινόμηση + κλειστό σύνολο φίλτρων)
 * @description Config SSoT για το `readAccountingListPage` (ADR-ACC-010 §2.1.1 Φάση 3β). Κάθε συνδυασμός στο
 *   `shapes` απαιτεί δείκτη `(companyId, …φίλτρα, πεδίο ταξινόμησης)` — το επιβάλλει η άγκυρα
 *   `__tests__/accounting-list-index.test.ts`, που διαβάζει ΑΥΤΟ το αρχείο. Νέος συνδυασμός ⇒ νέα γραμμή εδώ
 *   **και** νέος δείκτης στο `firestore.indexes.json` (deploy από τον Giorgio ΠΡΙΝ το push).
 *
 * Οι συνδυασμοί είναι όσοι ζητά πραγματικά το UI — όχι το καρτεσιανό γινόμενο των φίλτρων.
 *
 * @see ADR-ACC-010 §2.1.1
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';

import type { JournalEntryFilters } from '../../types/journal';
import type { InvoiceFilters } from '../../types/invoice';
import type { BankTransactionFilters } from '../../types/bank';
import type { FixedAssetFilters } from '../../types/assets';
import type { AccountingListSpec } from './accounting-repo-list';

/** Βιβλίο Εσόδων-Εξόδων — `JournalPageContent` (έτος ± τύπος ± τρίμηνο) · καρτέλα επαφής. */
export const JOURNAL_LIST: AccountingListSpec<JournalEntryFilters> = {
  collection: COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES,
  order: { field: 'date', direction: 'desc' },
  fields: { type: FIELDS.TYPE, fiscalYear: 'fiscalYear', quarter: 'quarter', contactId: FIELDS.CONTACT_ID },
  shapes: [
    [],
    ['type'],
    ['fiscalYear'],
    ['fiscalYear', 'type'],
    ['fiscalYear', 'quarter'],
    ['fiscalYear', 'quarter', 'type'],
    ['contactId'],
  ],
};

/** Τιμολόγια — `InvoicesPageContent` (έτος ± τύπος ± κατάσταση πληρωμής) · `TransactionChainCard` (ακίνητο). */
export const INVOICE_LIST: AccountingListSpec<InvoiceFilters> = {
  collection: COLLECTIONS.ACCOUNTING_INVOICES,
  order: { field: 'issueDate', direction: 'desc' },
  fields: { type: FIELDS.TYPE, paymentStatus: 'paymentStatus', fiscalYear: 'fiscalYear', propertyId: FIELDS.PROPERTY_ID },
  shapes: [
    ['fiscalYear'],
    ['fiscalYear', 'type'],
    ['fiscalYear', 'paymentStatus'],
    ['fiscalYear', 'paymentStatus', 'type'],
    ['propertyId'],
  ],
};

/** Τραπεζικές κινήσεις — `BankPageContent` (κατεύθυνση ± αντιστοίχιση) · `ReconciliationPageContent` (όλες). */
export const BANK_TRANSACTION_LIST: AccountingListSpec<BankTransactionFilters> = {
  collection: COLLECTIONS.ACCOUNTING_BANK_TRANSACTIONS,
  order: { field: 'transactionDate', direction: 'desc' },
  fields: { accountId: 'accountId', direction: 'direction', matchStatus: 'matchStatus' },
  shapes: [
    [],
    ['accountId'],
    ['direction'],
    ['matchStatus'],
    ['direction', 'matchStatus'],
  ],
};

/** Πάγια — `AssetsPageContent` (κατηγορία ± κατάσταση) · έτος κτήσης. */
export const FIXED_ASSET_LIST: AccountingListSpec<FixedAssetFilters> = {
  collection: COLLECTIONS.ACCOUNTING_FIXED_ASSETS,
  order: { field: 'acquisitionDate', direction: 'desc' },
  fields: { category: 'category', status: FIELDS.STATUS, acquisitionYear: 'acquisitionFiscalYear' },
  shapes: [
    [],
    ['category'],
    ['status'],
    ['category', 'status'],
    ['acquisitionYear'],
  ],
};
