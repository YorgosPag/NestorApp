/**
 * GET /api/accounting/assets/summary — Σύνοψη μητρώου παγίων (κάρτες οθόνης), ίδιες παράμετροι με τη λίστα.
 * Auth: withAuth · Rate: standard
 *
 * @module api/accounting/assets/summary
 * @enterprise ADR-ACC-010 §2.1.1 («σελίδα ≠ καθολικό» — κάρτες σύνοψης)
 */

import 'server-only';

import { summarizeFixedAssetList } from '@/subapps/accounting/services/list-summaries/fixed-asset-list-summary';
import { fixedAssetFiltersOf } from '../../_shared/list-filters';
import { listSummaryRoute } from '../../_shared/list-summary-route';

export const GET = listSummaryRoute({
  fallbackError: 'Failed to summarize fixed assets',
  filtersOf: fixedAssetFiltersOf,
  collect: (repository, filters) => repository.collectFixedAssetList(filters),
  summarize: summarizeFixedAssetList,
});
