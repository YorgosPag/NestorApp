/**
 * GET /api/accounting/journal/summary — Σύνοψη Ημερολογίου (κάρτες οθόνης), ίδιες παράμετροι με τη λίστα.
 * Auth: withAuth · Rate: standard
 *
 * @module api/accounting/journal/summary
 * @enterprise ADR-ACC-010 §2.1.1 («σελίδα ≠ καθολικό» — κάρτες σύνοψης)
 */

import 'server-only';

import { summarizeJournalList } from '@/subapps/accounting/services/list-summaries/journal-list-summary';
import { journalEntryFiltersOf } from '../../_shared/list-filters';
import { listSummaryRoute } from '../../_shared/list-summary-route';

export const GET = listSummaryRoute({
  fallbackError: 'Failed to summarize journal entries',
  filtersOf: journalEntryFiltersOf,
  collect: (repository, filters) => repository.collectJournalEntryList(filters),
  summarize: summarizeJournalList,
});
