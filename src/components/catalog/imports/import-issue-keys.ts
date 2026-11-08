/**
 * @fileoverview **Ο δρόμος από τον κωδικό ευρήματος εισαγωγής στο κλειδί του** (ADR-923 §5.5.1 · ADR-744 §34).
 * @module components/catalog/imports/import-issue-keys
 *
 * 🔒 **Φορτώνεται ΜΟΝΟ μέσω `import()`** (`import-issue-messages.ts`): ο υπολογισμένος δείκτης κάνει τον εξαγωγέα να κρατά
 *    όλες τις τιμές, και τα ευρήματα δεν ζωγραφίζονται στο πρώτο καρέ. Το φυλάει το `catalog-issue-deferral.test.ts`.
 */

import type { ImportIssueCode } from '@/subapps/catalog/vocabulary/catalog-import';

export const IMPORT_ISSUE_KEYS: Readonly<Record<ImportIssueCode, string>> = {
  misaligned: 'issues.misaligned',
  sharedDisagrees: 'issues.sharedDisagrees',
  levelUnsupported: 'issues.levelUnsupported',
  modelCodeMissing: 'issues.modelCodeMissing',
  skuUnknown: 'issues.skuUnknown',
  priceIncomplete: 'issues.priceIncomplete',
  priceAmountPrecision: 'issues.priceAmountPrecision',
  priceUnitUnknown: 'issues.priceUnitUnknown',
  measurementUnitMissing: 'issues.measurementUnitMissing',
  unitUnconfirmed: 'issues.unitUnconfirmed',
  attributeRepeated: 'issues.attributeRepeated',
  tableStructureDisputed: 'issues.tableStructureDisputed',
  noValueReplacesValue: 'issues.noValueReplacesValue',
  unknownKeepsValue: 'issues.unknownKeepsValue',
  noValueReasonUnreadable: 'issues.noValueReasonUnreadable',
  identityKeysDisagree: 'issues.identityKeysDisagree',
};
