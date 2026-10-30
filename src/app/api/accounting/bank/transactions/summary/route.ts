/**
 * GET /api/accounting/bank/transactions/summary — Σύνοψη τραπεζικών κινήσεων (κάρτες οθόνης), ίδιες παράμετροι με τη λίστα.
 * Auth: withAuth · Rate: standard
 *
 * @module api/accounting/bank/transactions/summary
 * @enterprise ADR-ACC-010 §2.1.1 («σελίδα ≠ καθολικό» — κάρτες σύνοψης)
 */

import 'server-only';

import { summarizeBankTransactionList } from '@/subapps/accounting/services/list-summaries/bank-transaction-list-summary';
import { bankTransactionFiltersOf } from '../../../_shared/list-filters';
import { listSummaryRoute } from '../../../_shared/list-summary-route';

export const GET = listSummaryRoute({
  fallbackError: 'Failed to summarize bank transactions',
  filtersOf: bankTransactionFiltersOf,
  collect: (repository, filters) => repository.collectBankTransactionList(filters),
  summarize: summarizeBankTransactionList,
});
