'use client';

/**
 * @fileoverview Οι λέξεις της οθόνης εισαγωγής (ADR-923 §5.5.1): δικό της namespace, γιατί το `catalog` φορτώνεται σε κάθε
 *   σελίδα καταλόγου και αυτά δεν έχουν δουλειά εκεί.
 * @module components/catalog/imports/import-text
 *
 * 🔑 Στατικοί πίνακες κλειδιών, ποτέ `t(\`status.${x}\`)`: ο γεννήτορας του route slice και το CHECK 3.8 βλέπουν μόνο ό,τι είναι
 *    γραμμένο, και ο `Record` σπάει τη μεταγλώττιση αν λείψει τιμή του λεξιλογίου.
 * ⚠️ Μόνο λέξεις: το μήνυμα ευρήματος (`useImportIssueMessage`) ζει στο `import-issue-messages.ts`, ώστε η μηχανή ευρημάτων
 *    του καταλόγου να μη μπαίνει στην κλειστότητα όποιου θέλει μόνο το `useImportText` (ADR-744 §27).
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { CATALOG_IMPORT_NAMESPACES } from '@/i18n/namespace-bundles';
import type { ImportPageSetAside, ImportPageTextless, ImportTradeField } from '@/subapps/catalog/types/catalog-import';
import type {
  ImportBatchStatus,
  ImportFieldStatus,
  ImportPriceField,
  ImportProposalStatus,
  ImportRowAction,
} from '@/subapps/catalog/vocabulary/catalog-import';

export function useImportText() {
  const { t, i18n } = useTranslation(CATALOG_IMPORT_NAMESPACES);
  return { t, uiLanguage: i18n.language };
}

export const FIELD_STATUS_KEYS: Readonly<Record<ImportFieldStatus, string>> = {
  new: 'status.new',
  changed: 'status.changed',
  unchanged: 'status.unchanged',
  conflict: 'status.conflict',
};

export const SET_ASIDE_KEYS: Readonly<Record<ImportPageSetAside['role'], string>> = {
  accessories: 'batch.setAsideAccessories',
  other: 'batch.setAsideOther',
  unmapped: 'batch.setAsideUnmapped',
};

export const TEXTLESS_KEYS: Readonly<Record<ImportPageTextless['kind'], string>> = {
  absent: 'batch.textlessAbsent',
  lost: 'batch.textlessLost',
};

export const PROPOSAL_STATUS_KEYS: Readonly<Record<ImportProposalStatus, string>> = {
  pending: 'proposalStatus.pending',
  applied: 'proposalStatus.applied',
  rejected: 'proposalStatus.rejected',
};

export const BATCH_STATUS_KEYS: Readonly<Record<ImportBatchStatus, string>> = {
  awaitingFile: 'batchStatus.awaitingFile',
  mapping: 'batchStatus.mapping',
  extracting: 'batchStatus.extracting',
  reviewing: 'batchStatus.reviewing',
  closed: 'batchStatus.closed',
  discarded: 'batchStatus.discarded',
};

export const ROW_ACTION_KEYS: Readonly<Record<ImportRowAction, string>> = {
  create: 'action.create',
  update: 'action.update',
};

export const PRICE_FIELD_KEYS: Readonly<Record<ImportPriceField, string>> = {
  netPrice: 'mapping.price.netPrice',
  priceQuantity: 'mapping.price.priceQuantity',
  unitCode: 'mapping.price.unitCode',
  discountGroup: 'mapping.price.discountGroup',
};

/** Οι ετικέτες των πεδίων ταυτότητας εμπορίου (ADR-934 Σ1γ), στον επιλογέα στήλης και στη γραμμή της πρότασης. */
export const TRADE_FIELD_KEYS: Readonly<Record<ImportTradeField, string>> = {
  gtin: 'mapping.trade.gtin',
  mpn: 'mapping.trade.mpn',
  brand: 'mapping.trade.brand',
  noGtinReason: 'mapping.trade.noGtinReason',
};

/** Η σειρά τους στον επιλογέα: πρώτα ο κωδικός που ταυτίζει. */
export const IMPORT_TRADE_FIELDS: readonly ImportTradeField[] = ['gtin', 'mpn', 'brand', 'noGtinReason'];
