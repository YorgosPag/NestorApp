/**
 * @fileoverview **Τα μηνύματα ευρημάτων του καταλόγου, εκτός πρώτου καρέ** (ADR-923 §5.2 · ADR-744 §34).
 * @module components/catalog/shared/catalog-issue-messages
 *
 * Ο πίνακας `κωδικός → κλειδί` ζει πίσω από `import()` — το όριο που ο γεννήτορας του slice ήδη σέβεται. Μέχρι να φτάσει
 * (μαζί με το πλήρες `catalog`), η οθόνη λέει τη μία γενική λέξη του `useIssuePending`, που **είναι** στο slice.
 */

import { defineDeferredMessageTable } from '@/i18n/deferred-message-table';
import { CATALOG_NAMESPACES } from '@/i18n/namespace-bundles';

export const CATALOG_ISSUE_TABLE = defineDeferredMessageTable('catalog-issues', CATALOG_NAMESPACES, () =>
  import('./catalog-issue-keys').then((module) => module.ISSUE_KEYS),
);
