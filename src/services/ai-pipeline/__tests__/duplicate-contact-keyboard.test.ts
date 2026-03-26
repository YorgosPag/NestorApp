/* eslint-disable no-restricted-syntax */
/**
 * DUPLICATE CONTACT KEYBOARD — Unit Tests (Google-level)
 *
 * Tests the 3 pure functions: keyboard factory, detection guard, callback parser.
 * Skips Firestore CRUD (storePendingContactAction, getPendingContactAction, deletePendingContactAction).
 *
 * @see ADR-171 (Autonomous AI Agent — duplicate contact detection)
 * @module __tests__/duplicate-contact-keyboard
 */

// ── Mocks ──
jest.mock('server-only', () => ({}));
jest.mock('@/app/api/communications/webhooks/telegram/telegram/types', () => ({}));
jest.mock('../shared/contact-lookup', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));
jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: { AI_PENDING_ACTIONS: 'ai_pending_actions' },
}));
jest.mock('@/services/enterprise-id.service', () => ({
  generatePendingId: jest.fn(),
}));
jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn() }),
}));

// ── Import after mocks ──
import {
  createDuplicateContactKeyboard,
  isDuplicateContactCallback,
  parseDuplicateContactCallback,
} from '../duplicate-contact-keyboard';

// ============================================================================
// createDuplicateContactKeyboard
// ============================================================================

describe('createDuplicateContactKeyboard', () => {
  it('returns markup with 3 rows of 1 button each', () => {
    const result = createDuplicateContactKeyboard('pnd_abc123');
    expect(result.inline_keyboard).toHaveLength(3);
    result.inline_keyboard.forEach((row) => {
      expect(row).toHaveLength(1);
    });
  });

  it('sets update callback_data as dc:u:{id}', () => {
    const result = createDuplicateContactKeyboard('pnd_abc123');
    expect(result.inline_keyboard[0][0].callback_data).toBe('dc:u:pnd_abc123');
  });

  it('sets create_new callback_data as dc:n:{id}', () => {
    const result = createDuplicateContactKeyboard('pnd_abc123');
    expect(result.inline_keyboard[1][0].callback_data).toBe('dc:n:pnd_abc123');
  });

  it('sets cancel callback_data as dc:x:{id}', () => {
    const result = createDuplicateContactKeyboard('pnd_abc123');
    expect(result.inline_keyboard[2][0].callback_data).toBe('dc:x:pnd_abc123');
  });
});

// ============================================================================
// isDuplicateContactCallback
// ============================================================================

describe('isDuplicateContactCallback', () => {
  it('returns true for update callback', () => {
    expect(isDuplicateContactCallback('dc:u:pnd_1')).toBe(true);
  });

  it('returns true for cancel callback', () => {
    expect(isDuplicateContactCallback('dc:x:pnd_1')).toBe(true);
  });

  it('returns false for feedback callback', () => {
    expect(isDuplicateContactCallback('fb:p:fbk_1')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isDuplicateContactCallback('')).toBe(false);
  });
});

// ============================================================================
// parseDuplicateContactCallback
// ============================================================================

describe('parseDuplicateContactCallback', () => {
  it('parses update action', () => {
    expect(parseDuplicateContactCallback('dc:u:pnd_abc')).toEqual({
      pendingId: 'pnd_abc',
      action: 'update',
    });
  });

  it('parses create_new action', () => {
    expect(parseDuplicateContactCallback('dc:n:pnd_abc')).toEqual({
      pendingId: 'pnd_abc',
      action: 'create_new',
    });
  });

  it('parses cancel action', () => {
    expect(parseDuplicateContactCallback('dc:x:pnd_abc')).toEqual({
      pendingId: 'pnd_abc',
      action: 'cancel',
    });
  });

  it('returns null for unknown action code', () => {
    expect(parseDuplicateContactCallback('dc:z:pnd_abc')).toBeNull();
  });

  it('returns null for wrong prefix', () => {
    expect(parseDuplicateContactCallback('fb:u:pnd_abc')).toBeNull();
  });

  it('returns null for too few parts', () => {
    expect(parseDuplicateContactCallback('dc:u')).toBeNull();
  });

  it('joins parts[2+] for pendingId containing colons', () => {
    expect(parseDuplicateContactCallback('dc:n:part1:part2')).toEqual({
      pendingId: 'part1:part2',
      action: 'create_new',
    });
  });
});
