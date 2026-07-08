/**
 * Tests for the shared Meta webhook feedback payload parsing SSoT (ADR-586).
 * Messenger & WhatsApp encode feedback identically — this owns the decode.
 */

import {
  CATEGORY_MAP,
  parseFeedbackPayload,
  parseCategoryPayload,
} from '../meta-feedback';

describe('parseFeedbackPayload (fb_{id}_{up|down})', () => {
  it('parses a thumbs-up payload', () => {
    expect(parseFeedbackPayload('fb_abc123_up')).toEqual({
      feedbackDocId: 'abc123',
      isPositive: true,
    });
  });

  it('parses a thumbs-down payload', () => {
    expect(parseFeedbackPayload('fb_abc123_down')).toEqual({
      feedbackDocId: 'abc123',
      isPositive: false,
    });
  });

  it('preserves underscores inside the feedback doc id', () => {
    expect(parseFeedbackPayload('fb_fbk_2026_07_08_x_up')).toEqual({
      feedbackDocId: 'fbk_2026_07_08_x',
      isPositive: true,
    });
  });

  it('treats any non-"up" sentiment as negative', () => {
    expect(parseFeedbackPayload('fb_abc123_down')?.isPositive).toBe(false);
  });

  it('returns null when the doc id segment is empty', () => {
    // 'fb_up' → parts ['fb','up'] → docId slice(1,-1) === '' → null
    expect(parseFeedbackPayload('fb_up')).toBeNull();
  });
});

describe('parseCategoryPayload (fbc_{id}_{w|d|u|s})', () => {
  it.each([
    ['fbc_abc_w', 'abc', 'wrong_answer'],
    ['fbc_abc_d', 'abc', 'wrong_data'],
    ['fbc_abc_u', 'abc', 'not_understood'],
    ['fbc_abc_s', 'abc', 'slow'],
  ])('parses %s → %s / %s', (payload, docId, category) => {
    expect(parseCategoryPayload(payload)).toEqual({ feedbackDocId: docId, category });
  });

  it('returns null for an unknown category code', () => {
    expect(parseCategoryPayload('fbc_abc_z')).toBeNull();
  });

  it('returns null when the doc id segment is empty', () => {
    expect(parseCategoryPayload('fbc_w')).toBeNull();
  });

  it('CATEGORY_MAP covers exactly the four negative categories', () => {
    expect(Object.keys(CATEGORY_MAP).sort()).toEqual(['d', 's', 'u', 'w']);
  });
});
