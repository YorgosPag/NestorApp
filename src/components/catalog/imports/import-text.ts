'use client';

/**
 * @fileoverview Οι λέξεις της οθόνης εισαγωγής (ADR-923 §5.5.1): δικό της namespace, γιατί το `catalog` φορτώνεται σε κάθε
 *   σελίδα καταλόγου και αυτά δεν έχουν δουλειά εκεί.
 * @module components/catalog/imports/import-text
 *
 * 🔑 Στατικοί πίνακες κλειδιών, ποτέ `t(\`status.${x}\`)`: ο γεννήτορας του route slice και το CHECK 3.8 βλέπουν μόνο ό,τι είναι
 *    γραμμένο, και ο `Record` σπάει τη μεταγλώττιση αν λείψει τιμή του λεξιλογίου.
 */

import { useCallback } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { CATALOG_IMPORT_NAMESPACES } from '@/i18n/namespace-bundles';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { ImportIssue, ImportPageSetAside } from '@/subapps/catalog/types/catalog-import';
import {
  IMPORT_ISSUE_CODES,
  type ImportBatchStatus,
  type ImportFieldStatus,
  type ImportIssueCode,
  type ImportPriceField,
  type ImportProposalStatus,
  type ImportRowAction,
} from '@/subapps/catalog/vocabulary/catalog-import';
import { useDeferredMessage } from '@/i18n/hooks/useDeferredMessageTable';
import { useIssueMessage, useIssuePending } from '../shared/CatalogIssues';
import { IMPORT_ISSUE_TABLE } from './import-issue-messages';

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

const isImportCode = (code: ImportIssue['code']): code is ImportIssueCode => (IMPORT_ISSUE_CODES as readonly string[]).includes(code);

/** Το μήνυμα ενός ευρήματος, από όποιο από τα δύο σύνολα κι αν ήρθε. */
export function useImportIssueMessage(needed = false): (issue: ImportIssue) => string {
  const { t, uiLanguage } = useImportText();
  const catalogMessage = useIssueMessage(needed);
  // ADR-744 §34: ο πίνακας της εισαγωγής φτάνει εκτός πρώτου καρέ· μέχρι τότε η ίδια γενική λέξη με του καταλόγου.
  const pending = useIssuePending();
  const translate = useDeferredMessage(IMPORT_ISSUE_TABLE, { language: uiLanguage, needed, t, pending });
  return useCallback((issue: ImportIssue) => (
    isImportCode(issue.code) ? translate(issue.code, issue.params) : catalogMessage(issue as CatalogIssue)
  ), [catalogMessage, translate]);
}
