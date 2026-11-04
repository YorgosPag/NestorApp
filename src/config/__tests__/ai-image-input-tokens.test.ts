/**
 * ADR-929 Δ16 #2 — η εκτίμηση tokens εικόνας **πριν** την κλήση, ανά οικογένεια μοντέλου (κανόνες του παρόχου,
 * developers.openai.com/api/docs/guides/images-vision, 2026-11-04).
 */

import { AI_COST_CONFIG, imageDetailFor, imageInputTokens, tokenCostUsd } from '../ai-analysis-config';

describe('imageInputTokens', () => {
  it('tile families: the provider\'s own worked example (1024² at high = 765 tokens)', () => {
    expect(imageInputTokens('gpt-4o', 1024, 1024)).toBe(765);
    // 2048 × 4096 ⇒ 1024 × 2048 ⇒ 768 × 1536 ⇒ 2 × 3 πλακίδια.
    expect(imageInputTokens('gpt-4o', 2048, 4096)).toBe(85 + 170 * 6);
  });

  it('patch families: 32 px patches × multiplier, rounded up', () => {
    expect(imageInputTokens('gpt-5.4', 1000, 1000)).toBe(Math.ceil(32 * 32 * 1.2));
  });

  it('an image the provider would reject (over the patch limit) has no estimate', () => {
    expect(imageInputTokens('gpt-5.4', 4000, 4000)).toBeNull();
    expect(imageInputTokens('gpt-5.6-terra', 5000, 4700)).not.toBeNull();
  });

  it('an unknown family or empty image has no estimate: no cost is ever guessed', () => {
    expect(imageInputTokens('gpt-unknown', 100, 100)).toBeNull();
    expect(imageInputTokens('gpt-4o', 0, 100)).toBeNull();
    expect(imageDetailFor('gpt-unknown')).toBeNull();
  });

  it('asks full resolution where the family keeps it, high otherwise', () => {
    expect(imageDetailFor('gpt-5.6-terra')).toBe('original');
    expect(imageDetailFor('gpt-4o')).toBe('high');
  });

  it('every model with an image rule also has a price row', () => {
    for (const model of Object.keys(AI_COST_CONFIG.IMAGE_INPUT)) {
      expect(tokenCostUsd(model, 1, 1)).not.toBeNull();
    }
  });
});
