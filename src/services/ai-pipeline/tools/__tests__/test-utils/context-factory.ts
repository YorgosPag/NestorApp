/**
 * CONTEXT FACTORY — Creates AgenticContext instances for testing
 *
 * Google-level: Each test gets isolated context with sensible defaults.
 * Override any field via partial argument.
 *
 * @module __tests__/test-utils/context-factory
 */

import type { AgenticContext } from '../../executor-shared';

const DEFAULT_COMPANY_ID = 'test-company-001';
const ADMIN_SENDER_ID = '5618410820';
const CUSTOMER_SENDER_ID = '999999';

export function createAdminContext(overrides?: Partial<AgenticContext>): AgenticContext {
  return {
    companyId: DEFAULT_COMPANY_ID,
    isAdmin: true,
    channel: 'telegram',
    channelSenderId: ADMIN_SENDER_ID,
    requestId: `test-req-${Date.now()}`,
    telegramChatId: ADMIN_SENDER_ID,
    contactMeta: null,
    ...overrides,
  };
}

export function createCustomerContext(overrides?: Partial<AgenticContext>): AgenticContext {
  return {
    companyId: DEFAULT_COMPANY_ID,
    isAdmin: false,
    channel: 'telegram',
    channelSenderId: CUSTOMER_SENDER_ID,
    requestId: `test-req-${Date.now()}`,
    contactMeta: {
      contactId: 'cont_test_001',
      displayName: 'Δημήτριος Οικονόμου',
      linkedUnitIds: ['unit_001'],
      projectRoles: [{ projectId: 'proj_001', role: 'buyer' }],
    },
    ...overrides,
  };
}
