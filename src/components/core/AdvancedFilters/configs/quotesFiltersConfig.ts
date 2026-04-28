/**
 * 📋 ENTERPRISE QUOTES FILTERS CONFIGURATION
 *
 * Single source of truth per i filtri della pagina /procurement/quotes.
 * Pattern parallelo a procurementFiltersConfig.ts.
 *
 * NB: Le label NON devono iniziare con knownNamespaces (`common`, `navigation`,
 * `properties`, `building`, `filters`, `parking`, `storage`) perché
 * `FilterField.translateLabel` fa namespace switch e ritornerebbe oggetti
 * invece di stringhe (= React error). Per questo le keys del filter panel
 * vivono sotto `filterPanel.*` al ROOT di quotes.json (non `filters.*`).
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
  { value: SELECT_CLEAR_VALUE, label: 'filterPanel.allStatuses' },
  ...QUOTE_STATUSES.map((s) => ({ value: s, label: `quotes.statuses.${s}` })),
];

const TRADE_OPTIONS = [
  { value: SELECT_CLEAR_VALUE, label: 'filterPanel.allTrades' },
  ...TRADE_CODES.map((c) => ({ value: c, label: `trades.${c}` })),
];

const SOURCE_OPTIONS = [
  { value: SELECT_CLEAR_VALUE, label: 'filterPanel.allSources' },
  { value: 'manual',      label: 'quotes.sources.manual' },
  { value: 'scan',        label: 'quotes.sources.scan' },
  { value: 'portal',      label: 'quotes.sources.portal' },
  { value: 'email_inbox', label: 'quotes.sources.email_inbox' },
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
          label: 'filterPanel.search',
          placeholder: 'filterPanel.search',
          width: 2,
          ariaLabel: 'Search quotes',
        },
        {
          id: 'status',
          type: 'select',
          label: 'filterPanel.status',
          placeholder: 'filterPanel.allStatuses',
          width: 1,
          options: STATUS_OPTIONS,
        },
        {
          id: 'trade',
          type: 'select',
          label: 'filterPanel.trade',
          placeholder: 'filterPanel.allTrades',
          width: 1,
          options: TRADE_OPTIONS,
        },
        {
          id: 'source',
          type: 'select',
          label: 'filterPanel.source',
          placeholder: 'filterPanel.allSources',
          width: 1,
          options: SOURCE_OPTIONS,
        },
      ],
    },
  ],
};
