'use client';

/**
 * @fileoverview **Τα μηνύματα ευρημάτων εισαγωγής, εκτός πρώτου καρέ** (ADR-923 §5.5.1 · ADR-744 §34).
 * @module components/catalog/imports/import-issue-messages
 *
 * 🔑 Ο πίνακας ΚΑΙ το hook που τον διαβάζει ζουν εδώ, όχι στο `import-text.ts`: οι «λέξεις» της οθόνης δεν σέρνουν τη μηχανή
 *    ευρημάτων του καταλόγου (`../shared/CatalogIssues` ⇒ namespace `catalog`) στην κλειστότητα όποιου θέλει μόνο το
 *    `useImportText` — π.χ. της τεμπέλικης αναφοράς xChange (`import-surfaces.tsx`, ADR-744 §27).
 */

import { useCallback } from 'react';

import { defineDeferredMessageTable } from '@/i18n/deferred-message-table';
import { useDeferredMessage } from '@/i18n/hooks/useDeferredMessageTable';
import { CATALOG_IMPORT_NAMESPACES } from '@/i18n/namespace-bundles';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { ImportIssue } from '@/subapps/catalog/types/catalog-import';
import { IMPORT_ISSUE_CODES, type ImportIssueCode } from '@/subapps/catalog/vocabulary/catalog-import';
import { useIssueMessage, useIssuePending } from '../shared/CatalogIssues';
import { useImportText } from './import-text';

export const IMPORT_ISSUE_TABLE = defineDeferredMessageTable('catalog-import-issues', CATALOG_IMPORT_NAMESPACES, () =>
  import('./import-issue-keys').then((module) => module.IMPORT_ISSUE_KEYS),
);

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
