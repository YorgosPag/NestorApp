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
  ImportLineBindLevel,
  ImportLineRefusal,
  ImportRowAction,
} from '@/subapps/catalog/vocabulary/catalog-import';
import type { AssetFetchFailure } from '@/subapps/catalog/vocabulary/asset-fetch';
import type { ReviewMarkTone } from '@/subapps/catalog/import/review-marks';
import type { ProposalView } from './proposal-summary';

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

/** §5.5.2 Α6: οι προβολές της πρότασης — τις ονομάζουν η μπάρα σύνοψης **και** η σημείωση «φαίνεται επειδή το επέλεξες» (Β8). */
export const PROPOSAL_VIEW_KEYS: Readonly<Record<ProposalView, string>> = {
  pending: 'review.viewPending',
  changes: 'review.viewChanges',
  all: 'review.viewAll',
};

/** §5.5.2 Β8: η κατάσταση ενός πλαισίου πάνω στο PDF, με λέξη — υπόμνημα και `aria-label` από το ίδιο σημείο. */
export const REVIEW_TONE_KEYS: Readonly<Record<ReviewMarkTone, string>> = {
  pending: 'review.overlay.tonePending',
  accepted: 'review.overlay.toneAccepted',
  problem: 'review.overlay.toneProblem',
  unmapped: 'review.overlay.toneUnmapped',
  dismissed: 'review.overlay.toneDismissed',
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
/** §5.5.2 Β3 Γ4: γιατί δεν ξαναερμηνεύτηκε ο πίνακας. */
export const LINE_REFUSAL_KEYS: Readonly<Record<ImportLineRefusal, string>> = {
  readingMissing: 'review.lines.refusalReadingMissing',
  readingVision: 'review.lines.refusalReadingVision',
  readingClipped: 'review.lines.refusalReadingClipped',
  tablesDrifted: 'review.lines.refusalTablesDrifted',
  proposalClosed: 'review.lines.refusalProposalClosed',
  lineUnknown: 'review.lines.refusalLineUnknown',
  priceTargetMissing: 'review.lines.refusalPriceTargetMissing',
  priceLineTaken: 'review.lines.refusalPriceLineTaken',
  axisOptionsInvalid: 'review.lines.refusalAxisOptionsInvalid',
  axisLineMissing: 'review.lines.refusalAxisLineMissing',
  axisLineAmbiguous: 'review.lines.refusalAxisLineAmbiguous',
};

export const LINE_LEVEL_KEYS: Readonly<Record<ImportLineBindLevel, string>> = {
  shared: 'review.lines.levelShared',
  leaf: 'review.lines.levelLeaf',
};

/** §5.5.2 Β3 Γ8: η κατάσταση μιας γραμμής χωρίς πεδίο, με λέξη. */
export const LINE_STATE_KEYS = {
  pending: 'review.lines.statePending',
  ignored: 'review.lines.stateIgnored',
  mapped: 'review.lines.stateMapped',
  saving: 'review.lines.stateSaving',
  refused: 'review.lines.stateRefused',
  failed: 'review.lines.stateFailed',
} as const;
export type LineState = keyof typeof LINE_STATE_KEYS;

export const LINE_LEVEL_HINT_KEYS: Readonly<Record<ImportLineBindLevel, string>> = {
  shared: 'review.lines.levelHintShared',
  leaf: 'review.lines.levelHintLeaf',
};

/** ADR-934 §5.2.2 Μ-β4: γιατί δεν κατέβηκε ένα μέσο — ένα μήνυμα ανά κωδικό, ο `Record` σπάει τη μεταγλώττιση αν λείψει. */
export const ASSET_FETCH_FAILURE_KEYS: Readonly<Record<AssetFetchFailure, string>> = {
  notFound: 'assetFetch.failure.notFound',
  httpError: 'assetFetch.failure.httpError',
  timeout: 'assetFetch.failure.timeout',
  tooLarge: 'assetFetch.failure.tooLarge',
  notPublic: 'assetFetch.failure.notPublic',
  dnsFailed: 'assetFetch.failure.dnsFailed',
  tooManyRedirects: 'assetFetch.failure.tooManyRedirects',
  invalidUri: 'assetFetch.failure.invalidUri',
  notAFile: 'assetFetch.failure.notAFile',
  unknownContent: 'assetFetch.failure.unknownContent',
  kindMismatch: 'assetFetch.failure.kindMismatch',
  typeConflict: 'assetFetch.failure.typeConflict',
  contentUnavailable: 'assetFetch.failure.contentUnavailable',
};
