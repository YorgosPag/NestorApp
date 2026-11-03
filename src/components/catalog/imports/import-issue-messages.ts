/**
 * @fileoverview **Τα μηνύματα ευρημάτων εισαγωγής, εκτός πρώτου καρέ** (ADR-923 §5.5.1 · ADR-744 §34).
 * @module components/catalog/imports/import-issue-messages
 */

import { defineDeferredMessageTable } from '@/i18n/deferred-message-table';
import { CATALOG_IMPORT_NAMESPACES } from '@/i18n/namespace-bundles';

export const IMPORT_ISSUE_TABLE = defineDeferredMessageTable('catalog-import-issues', CATALOG_IMPORT_NAMESPACES, () =>
  import('./import-issue-keys').then((module) => module.IMPORT_ISSUE_KEYS),
);
