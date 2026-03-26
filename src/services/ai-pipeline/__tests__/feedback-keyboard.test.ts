/* eslint-disable no-restricted-syntax */
/**
 * FEEDBACK KEYBOARD — Unit Tests (Google-level)
 *
 * Tests all 9 pure functions: keyboard factories, detection guards, and callback parsers.
 * Covers compact callback_data format (fb:, sa:) within Telegram's 64-byte limit.
 *
 * @see ADR-173 (AI Self-Improvement System)
 * @module __tests__/feedback-keyboard
 */

// ── Mocks ──
jest.mock('@/app/api/communications/webhooks/telegram/telegram/types', () => ({}));
jest.mock('../feedback-service', () => ({}));

// ── Import after mocks ──
import {
  createFeedbackKeyboard,
  createNegativeCategoryKeyboard,
  isFeedbackCallback,
  isCategoryCallback,
  parseFeedbackCallback,
  parseCategoryCallback,
  createSuggestedActionsKeyboard,
  isSuggestionCallback,
  parseSuggestionCallback,
} from '../feedback-keyboard';

// ============================================================================
// createFeedbackKeyboard
// ============================================================================

describe('createFeedbackKeyboard', () => {
  it('returns markup with exactly 1 row and 2 buttons', () => {
    const result = createFeedbackKeyboard('fbk_abc123');
    expect(result.inline_keyboard).toHaveLength(1);
    expect(result.inline_keyboard![0]).toHaveLength(2);
  });

  it('sets positive callback_data as fb:p:{id}', () => {
    const result = createFeedbackKeyboard('fbk_abc123');
    expect(result.inline_keyboard![0][0].callback_data).toBe('fb:p:fbk_abc123');
  });

  it('sets negative callback_data as fb:n:{id}', () => {
    const result = createFeedbackKeyboard('fbk_abc123');
    expect(result.inline_keyboard![0][1].callback_data).toBe('fb:n:fbk_abc123');
  });
});

// ============================================================================
// createNegativeCategoryKeyboard
// ============================================================================

describe('createNegativeCategoryKeyboard', () => {
  it('returns markup with 2 rows of 2 buttons each', () => {
    const result = createNegativeCategoryKeyboard('fbk_xyz');
    expect(result.inline_keyboard).toHaveLength(2);
    expect(result.inline_keyboard![0]).toHaveLength(2);
    expect(result.inline_keyboard![1]).toHaveLength(2);
  });

  it('encodes all 4 category codes (w, d, u, s)', () => {
    const result = createNegativeCategoryKeyboard('fbk_xyz');
    const allData = result.inline_keyboard!.flat().map(b => b.callback_data);
    expect(allData).toEqual([
      'fb:c:fbk_xyz:w',
      'fb:c:fbk_xyz:d',
      'fb:c:fbk_xyz:u',
      'fb:c:fbk_xyz:s',
    ]);
  });
});

// ============================================================================
// isFeedbackCallback
// ============================================================================

describe('isFeedbackCallback', () => {
  it('returns true for positive feedback', () => {
    expect(isFeedbackCallback('fb:p:fbk_123')).toBe(true);
  });

  it('returns true for category callback (fb:c: is still fb:)', () => {
    expect(isFeedbackCallback('fb:c:fbk_123:w')).toBe(true);
  });

  it('returns false for suggestion callback', () => {
    expect(isFeedbackCallback('sa:0:fbk_123')).toBe(false);
  });

  it('returns false for unrelated string', () => {
    expect(isFeedbackCallback('dc:u:pending_1')).toBe(false);
  });
});

// ============================================================================
// isCategoryCallback
// ============================================================================

describe('isCategoryCallback', () => {
  it('returns true for category callback', () => {
    expect(isCategoryCallback('fb:c:fbk_123:w')).toBe(true);
  });

  it('returns false for positive rating callback', () => {
    expect(isCategoryCallback('fb:p:fbk_123')).toBe(false);
  });
});

// ============================================================================
// parseFeedbackCallback
// ============================================================================

describe('parseFeedbackCallback', () => {
  it('parses positive rating', () => {
    expect(parseFeedbackCallback('fb:p:fbk_abc')).toEqual({
      feedbackDocId: 'fbk_abc',
      rating: 'positive',
    });
  });

  it('parses negative rating', () => {
    expect(parseFeedbackCallback('fb:n:fbk_abc')).toEqual({
      feedbackDocId: 'fbk_abc',
      rating: 'negative',
    });
  });

  it('returns null for category callback (fb:c:*)', () => {
    expect(parseFeedbackCallback('fb:c:fbk_abc:w')).toBeNull();
  });

  it('returns null for non-feedback prefix', () => {
    expect(parseFeedbackCallback('sa:0:fbk_abc')).toBeNull();
  });

  it('returns null for missing feedbackDocId (only 2 parts)', () => {
    expect(parseFeedbackCallback('fb:p')).toBeNull();
  });

  it('joins parts[2+] for feedbackDocId containing colons', () => {
    const result = parseFeedbackCallback('fb:p:part1:part2');
    expect(result).toEqual({
      feedbackDocId: 'part1:part2',
      rating: 'positive',
    });
  });
});

// ============================================================================
// parseCategoryCallback
// ============================================================================

describe('parseCategoryCallback', () => {
  it('parses wrong_answer category', () => {
    expect(parseCategoryCallback('fb:c:fbk_1:w')).toEqual({
      feedbackDocId: 'fbk_1',
      category: 'wrong_answer',
    });
  });

  it('parses slow category', () => {
    expect(parseCategoryCallback('fb:c:fbk_1:s')).toEqual({
      feedbackDocId: 'fbk_1',
      category: 'slow',
    });
  });

  it('returns null for unknown category code', () => {
    expect(parseCategoryCallback('fb:c:fbk_1:z')).toBeNull();
  });

  it('returns null for non-category feedback callback', () => {
    expect(parseCategoryCallback('fb:p:fbk_1')).toBeNull();
  });
});

// ============================================================================
// createSuggestedActionsKeyboard
// ============================================================================

describe('createSuggestedActionsKeyboard', () => {
  it('creates 1 row with up to 3 buttons', () => {
    const result = createSuggestedActionsKeyboard('fbk_1', ['A', 'B', 'C']);
    // One button per row = full width for readability
    expect(result.inline_keyboard).toHaveLength(3);
    expect(result.inline_keyboard![0]).toHaveLength(1);
    expect(result.inline_keyboard![1]).toHaveLength(1);
    expect(result.inline_keyboard![2]).toHaveLength(1);
  });

  it('truncates suggestions beyond 3', () => {
    const result = createSuggestedActionsKeyboard('fbk_1', ['A', 'B', 'C', 'D']);
    expect(result.inline_keyboard).toHaveLength(3);
  });

  it('formats callback_data as sa:{index}:{id}', () => {
    const result = createSuggestedActionsKeyboard('fbk_1', ['Alpha']);
    expect(result.inline_keyboard![0][0].callback_data).toBe('sa:0:fbk_1');
  });

  it('prefixes button text with lightbulb emoji', () => {
    const result = createSuggestedActionsKeyboard('fbk_1', ['Check status']);
    expect(result.inline_keyboard![0][0].text).toBe('💡 Check status');
  });
});

// ============================================================================
// isSuggestionCallback
// ============================================================================

describe('isSuggestionCallback', () => {
  it('returns true for suggestion callback', () => {
    expect(isSuggestionCallback('sa:0:fbk_1')).toBe(true);
  });

  it('returns false for feedback callback', () => {
    expect(isSuggestionCallback('fb:p:fbk_1')).toBe(false);
  });
});

// ============================================================================
// parseSuggestionCallback
// ============================================================================

describe('parseSuggestionCallback', () => {
  it('parses valid suggestion callback', () => {
    expect(parseSuggestionCallback('sa:1:fbk_abc')).toEqual({
      index: 1,
      feedbackDocId: 'fbk_abc',
    });
  });

  it('returns null for index out of range (3)', () => {
    expect(parseSuggestionCallback('sa:3:fbk_abc')).toBeNull();
  });

  it('returns null for NaN index', () => {
    expect(parseSuggestionCallback('sa:xyz:fbk_abc')).toBeNull();
  });

  it('returns null for non-suggestion prefix', () => {
    expect(parseSuggestionCallback('fb:p:fbk_abc')).toBeNull();
  });

  it('joins parts[2+] for feedbackDocId containing colons', () => {
    const result = parseSuggestionCallback('sa:2:part1:part2');
    expect(result).toEqual({ index: 2, feedbackDocId: 'part1:part2' });
  });
});
