/**
 * GET /api/accounting/invoices/summary — Σύνοψη λίστας τιμολογίων (κάρτες οθόνης), ίδιες παράμετροι με το LIST.
 * Auth: withAuth · Rate: standard
 *
 * @module api/accounting/invoices/summary
 * @enterprise ADR-ACC-010 §2.1.1 («σελίδα ≠ καθολικό» — κάρτες σύνοψης)
 */

import 'server-only';

import { summarizeInvoiceList } from '@/subapps/accounting/services/list-summaries/invoice-list-summary';
import { accountingToday } from '@/subapps/accounting/utils/accounting-day';
import { invoiceFiltersOf } from '../../_shared/list-filters';
import { listSummaryRoute } from '../../_shared/list-summary-route';

export const GET = listSummaryRoute({
  fallbackError: 'Failed to summarize invoices',
  filtersOf: invoiceFiltersOf,
  collect: (repository, filters) => repository.collectInvoiceList(filters),
  summarize: (invoices) => summarizeInvoiceList(invoices, accountingToday()),
});
