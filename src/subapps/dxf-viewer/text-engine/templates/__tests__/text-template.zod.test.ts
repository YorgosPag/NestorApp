/**
 * ADR-344 Phase 7.B — Zod validation unit tests.
 */

import {
  TEXT_TEMPLATE_NAME_MAX,
  collectIssues,
  createTextTemplateInputSchema,
  updateTextTemplateInputSchema,
} from '../text-template.zod';
import { TITLE_BLOCK_EL } from '../defaults';

const VALID_CONTENT = TITLE_BLOCK_EL.content;

const VALID_CREATE_INPUT = {
  companyId: 'comp_abc',
  name: 'Ταμπέλα Έργου Α',
  category: 'title-block' as const,
  content: VALID_CONTENT,
};

describe('createTextTemplateInputSchema', () => {
  it('accepts a well-formed payload', () => {
    const result = createTextTemplateInputSchema.safeParse(VALID_CREATE_INPUT);
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = createTextTemplateInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      name: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(collectIssues(result.error).join('\n')).toMatch(/name.*must be non-empty/);
    }
  });

  it(`rejects a name longer than ${TEXT_TEMPLATE_NAME_MAX} characters`, () => {
    const result = createTextTemplateInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      name: 'x'.repeat(TEXT_TEMPLATE_NAME_MAX + 1),
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown category', () => {
    const result = createTextTemplateInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      category: 'sticker',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty companyId', () => {
    const result = createTextTemplateInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      companyId: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects content with zero paragraphs', () => {
    const result = createTextTemplateInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      content: { ...VALID_CONTENT, paragraphs: [] },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(collectIssues(result.error).join('\n')).toMatch(/at least one paragraph/);
    }
  });

  it('rejects an invalid attachment code', () => {
    const result = createTextTemplateInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      content: { ...VALID_CONTENT, attachment: 'XX' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra top-level fields (strict mode)', () => {
    const result = createTextTemplateInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      isDefault: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects rotation that is not finite', () => {
    const result = createTextTemplateInputSchema.safeParse({
      ...VALID_CREATE_INPUT,
      content: { ...VALID_CONTENT, rotation: Number.NaN },
    });
    expect(result.success).toBe(false);
  });
});

describe('updateTextTemplateInputSchema', () => {
  it('accepts a name-only patch', () => {
    const result = updateTextTemplateInputSchema.safeParse({ name: 'Νέο Όνομα' });
    expect(result.success).toBe(true);
  });

  it('accepts a category-only patch', () => {
    const result = updateTextTemplateInputSchema.safeParse({ category: 'stamp' });
    expect(result.success).toBe(true);
  });

  it('accepts a content-only patch', () => {
    const result = updateTextTemplateInputSchema.safeParse({ content: VALID_CONTENT });
    expect(result.success).toBe(true);
  });

  it('rejects an empty patch', () => {
    const result = updateTextTemplateInputSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(collectIssues(result.error).join('\n')).toMatch(/at least one field/);
    }
  });

  it('rejects unknown patch fields (strict mode)', () => {
    const result = updateTextTemplateInputSchema.safeParse({
      name: 'ok',
      companyId: 'comp_xyz',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a name exceeding the limit', () => {
    const result = updateTextTemplateInputSchema.safeParse({
      name: 'x'.repeat(TEXT_TEMPLATE_NAME_MAX + 5),
    });
    expect(result.success).toBe(false);
  });
});

describe('collectIssues', () => {
  it('serialises Zod issues into "path: message" strings', () => {
    const result = createTextTemplateInputSchema.safeParse({
      companyId: '',
      name: '',
      category: 'title-block',
      content: VALID_CONTENT,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = collectIssues(result.error);
      expect(issues).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^companyId: /),
          expect.stringMatching(/^name: /),
        ]),
      );
    }
  });
});
