/**
 * ADR-344 Phase 8 — Zod schema tests for custom-dictionary input.
 */

import { describe, expect, it } from 'vitest';
import {
  CUSTOM_DICTIONARY_TERM_MAX,
  collectIssues,
  createCustomDictionaryEntryInputSchema,
  updateCustomDictionaryEntryInputSchema,
} from '../custom-dictionary.zod';

describe('createCustomDictionaryEntryInputSchema', () => {
  it('accepts a valid Greek entry', () => {
    const result = createCustomDictionaryEntryInputSchema.safeParse({
      companyId: 'company-1',
      term: 'οπτοπλινθοδομή',
      language: 'el',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid English entry', () => {
    const result = createCustomDictionaryEntryInputSchema.safeParse({
      companyId: 'company-1',
      term: 'BIM',
      language: 'en',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty companyId', () => {
    const result = createCustomDictionaryEntryInputSchema.safeParse({
      companyId: '',
      term: 'οπτοπλινθοδομή',
      language: 'el',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty term', () => {
    const result = createCustomDictionaryEntryInputSchema.safeParse({
      companyId: 'company-1',
      term: '',
      language: 'el',
    });
    expect(result.success).toBe(false);
  });

  it('rejects whitespace-only term', () => {
    const result = createCustomDictionaryEntryInputSchema.safeParse({
      companyId: 'company-1',
      term: '   ',
      language: 'el',
    });
    expect(result.success).toBe(false);
  });

  it('rejects multi-word term (whitespace inside)', () => {
    const result = createCustomDictionaryEntryInputSchema.safeParse({
      companyId: 'company-1',
      term: 'two words',
      language: 'el',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = collectIssues(result.error);
      expect(issues.join(' ')).toMatch(/whitespace/);
    }
  });

  it('rejects leading/trailing whitespace', () => {
    const result = createCustomDictionaryEntryInputSchema.safeParse({
      companyId: 'company-1',
      term: ' οπτοπλινθοδομή ',
      language: 'el',
    });
    expect(result.success).toBe(false);
  });

  it(`rejects term longer than ${CUSTOM_DICTIONARY_TERM_MAX}`, () => {
    const result = createCustomDictionaryEntryInputSchema.safeParse({
      companyId: 'company-1',
      term: 'α'.repeat(CUSTOM_DICTIONARY_TERM_MAX + 1),
      language: 'el',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown language', () => {
    const result = createCustomDictionaryEntryInputSchema.safeParse({
      companyId: 'company-1',
      term: 'word',
      language: 'fr',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateCustomDictionaryEntryInputSchema', () => {
  it('accepts a term-only patch', () => {
    const result = updateCustomDictionaryEntryInputSchema.safeParse({
      term: 'updatedTerm',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a language-only patch', () => {
    const result = updateCustomDictionaryEntryInputSchema.safeParse({
      language: 'en',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty patch', () => {
    const result = updateCustomDictionaryEntryInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid term length in patch', () => {
    const result = updateCustomDictionaryEntryInputSchema.safeParse({
      term: 'α'.repeat(CUSTOM_DICTIONARY_TERM_MAX + 1),
    });
    expect(result.success).toBe(false);
  });
});
