/**
 * 📋 ENTERPRISE QUOTES FILTERS CONFIGURATION
 *
 * Single source of truth per i filtri della pagina /procurement/quotes.
 * Pattern parallelo a procurementFiltersConfig.ts.
 *
 * @see ADR-327 §Layout Unification — Quotes Filters SSoT
 */

import type { FilterPanelConfig } from '../types';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import { TRADE_CODES } from '@/subapps/procurement/types/trade';
import { QUOTE_STATUSES } from '@/subapps/procurement/types/quote';

// =============================================================================
// 📋 QUOTES FILTER STATE TYPE
// =============================================================================

export interface QuotesFilterState {
  [key: string]: unknown;
  searchTerm: string;
  status: string[];   // single-value (max 1)
  trade: string[];    // single-value (max 1)
  source: string[];   // single-value (max 1)
}

// =============================================================================
// 📋 DEFAULT FILTERS
// =============================================================================

export const defaultQuotesFilters: QuotesFilterState = {
  searchTerm: '',
  status: [],
  trade: [],
  source: [],
};

// =============================================================================
// 📋 FILTER CONFIG
// =============================================================================

const STATUS_OPTIONS = [
  { value: SELECT_CLEAR_VALUE, label: 'filters.allStatuses' },
  ...QUOTE_STATUSES.map((s) => ({ value: s, label: `statuses.${s}` })),
];

const TRADE_OPTIONS = [
  { value: SELECT_CLEAR_VALUE, label: 'filters.allTrades' },
  ...TRADE_CODES.map((c) => ({ value: c, label: `trades.${c}` })),
];

const SOURCE_OPTIONS = [
  { value: SELECT_CLEAR_VALUE, label: 'filters.allSources' },
  { value: 'manual',      label: 'sources.manual' },
  { value: 'scan',        label: 'sources.scan' },
  { value: 'portal',      label: 'sources.portal' },
  { value: 'email_inbox', label: 'sources.email_inbox' },
];

export const quotesFiltersConfig: FilterPanelConfig = {
  title: 'header.title',
  i18nNamespace: 'quotes',
  rows: [
    {
      id: 'quotes-row1',
      fields: [
        {
          id: 'searchTerm',
          type: 'search',
          label: 'filters.search',
          placeholder: 'filters.search',
          width: 2,
          ariaLabel: 'Search quotes',
        },
        {
          id: 'status',
          type: 'select',
          label: 'filters.status',
          placeholder: 'filters.allStatuses',
          width: 1,
          options: STATUS_OPTIONS,
        },
        {
          id: 'trade',
          type: 'select',
          label: 'filters.trade',
          placeholder: 'filters.allTrades',
          width: 1,
          options: TRADE_OPTIONS,
        },
        {
          id: 'source',
          type: 'select',
          label: 'filters.source',
          placeholder: 'filters.allSources',
          width: 1,
          options: SOURCE_OPTIONS,
        },
      ],
    },
  ],
};
