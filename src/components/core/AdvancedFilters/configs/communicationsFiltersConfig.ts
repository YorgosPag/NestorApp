/**
 * =============================================================================
 * COMMUNICATIONS FILTERS CONFIG
 * =============================================================================
 *
 * Filter configuration for CRM Communications/Inbox module.
 * Following the same pattern as storageFiltersConfig.ts
 *
 * @module components/core/AdvancedFilters/configs/communicationsFiltersConfig
 * @enterprise ADR-030 - Zero Hardcoded Values
 */

import type { FilterPanelConfig } from '../types';
import { CONVERSATION_STATUS } from '@/types/conversations';
import { COMMUNICATION_CHANNELS } from '@/types/communications';

// ============================================================================
// FILTER STATE TYPE
// ============================================================================

export interface CommunicationsFilterState {
  searchTerm?: string;
  channel?: string;
  status?: string;
  dateRange?: {
    from?: Date;
    to?: Date;
  };
}

// ============================================================================
// DEFAULT FILTERS
// ============================================================================

export const defaultCommunicationsFilters: CommunicationsFilterState = {
  searchTerm: '',
  channel: 'all',
  status: 'all',
  dateRange: {
    from: undefined,
    to: undefined,
  },
};

// ============================================================================
// FILTER CONFIGURATION
// ============================================================================

/**
 * Communications filter panel configuration
 * Uses i18n keys for labels (resolved in component)
 */
export const communicationsFiltersConfig: FilterPanelConfig = {
  title: 'crm:inbox.filters.title',
  searchPlaceholder: 'crm:inbox.search',
  rows: [
    {
      id: 'communications-basic',
      fields: [
        {
          id: 'searchTerm',
          type: 'search',
          label: 'crm:inbox.search',
          placeholder: 'crm:inbox.search',
          ariaLabel: 'Search conversations',
          width: 2,
        },
        {
          id: 'channel',
          type: 'select',
          label: 'crm:inbox.filters.channel',
          placeholder: 'crm:inbox.filters.channel',
          ariaLabel: 'Filter by channel',
          width: 1,
          options: [
            { value: 'all', label: 'crm:inbox.filters.all' },
            { value: COMMUNICATION_CHANNELS.TELEGRAM, label: 'crm:inbox.channels.telegram' },
            { value: COMMUNICATION_CHANNELS.EMAIL, label: 'crm:inbox.channels.email' },
            { value: COMMUNICATION_CHANNELS.WHATSAPP, label: 'crm:inbox.channels.whatsapp' },
            { value: COMMUNICATION_CHANNELS.SMS, label: 'crm:inbox.channels.sms' },
          ],
        },
        {
          id: 'status',
          type: 'select',
          label: 'crm:inbox.filters.status',
          placeholder: 'crm:inbox.filters.status',
          ariaLabel: 'Filter by status',
          width: 1,
          options: [
            { value: 'all', label: 'crm:inbox.filters.all' },
            { value: CONVERSATION_STATUS.ACTIVE, label: 'crm:inbox.status.active' },
            { value: CONVERSATION_STATUS.CLOSED, label: 'crm:inbox.status.closed' },
            { value: CONVERSATION_STATUS.ARCHIVED, label: 'crm:inbox.status.archived' },
          ],
        },
      ],
    },
  ],
};
