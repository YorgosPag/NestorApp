/**
 * ADR-344 Phase 7.A — Built-in defaults invariant tests.
 *
 * These tests pin the structural invariants every built-in template
 * must satisfy. If a future change breaks one of them (forgotten
 * placeholder, duplicate id, empty paragraph, etc.) the build fails.
 */

import { extractPlaceholders } from '../extract-placeholders';
import {
  BUILT_IN_TEXT_TEMPLATES,
  BUILT_IN_TEXT_TEMPLATES_BY_CATEGORY,
  BUILT_IN_TEXT_TEMPLATES_BY_ID,
  TITLE_BLOCK_EL,
  TITLE_BLOCK_EN,
  SIGNOFF_STAMP_EL,
  GENERAL_NOTES_EL,
  REVISION_TABLE_EL,
  SCALE_BAR_MULTI,
} from '../defaults';

describe('BUILT_IN_TEXT_TEMPLATES — structural invariants', () => {
  it('ships at least one template per primary category', () => {
    const cats = new Set(BUILT_IN_TEXT_TEMPLATES.map((t) => t.category));
    expect(cats).toContain('title-block');
    expect(cats).toContain('stamp');
    expect(cats).toContain('notes');
    expect(cats).toContain('revision');
    expect(cats).toContain('scale-bar');
  });

  it('every template has companyId=null and isDefault=true', () => {
    for (const t of BUILT_IN_TEXT_TEMPLATES) {
      expect(t.companyId).toBeNull();
      expect(t.isDefault).toBe(true);
      expect(t.createdAt).toBeNull();
      expect(t.updatedAt).toBeNull();
    }
  });

  it('every template id starts with "builtin/" and is unique', () => {
    const ids = new Set<string>();
    for (const t of BUILT_IN_TEXT_TEMPLATES) {
      expect(t.id).toMatch(/^builtin\/[a-z0-9-]+$/);
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
    }
  });

  it('every template has a non-empty i18n key', () => {
    for (const t of BUILT_IN_TEXT_TEMPLATES) {
      expect(t.nameI18nKey).toMatch(/^textTemplates:defaults\./);
    }
  });

  it('every template has at least one paragraph with at least one run', () => {
    for (const t of BUILT_IN_TEXT_TEMPLATES) {
      expect(t.content.paragraphs.length).toBeGreaterThan(0);
      expect(t.content.paragraphs[0].runs.length).toBeGreaterThan(0);
    }
  });

  it('declared placeholders match scanned placeholders exactly', () => {
    for (const t of BUILT_IN_TEXT_TEMPLATES) {
      const scanned = extractPlaceholders(t.content);
      expect([...t.placeholders]).toEqual(scanned);
    }
  });

  it('placeholders are sorted and unique', () => {
    for (const t of BUILT_IN_TEXT_TEMPLATES) {
      const sorted = [...t.placeholders].sort();
      expect([...t.placeholders]).toEqual(sorted);
      expect(new Set(t.placeholders).size).toBe(t.placeholders.length);
    }
  });
});

describe('BUILT_IN_TEXT_TEMPLATES_BY_ID', () => {
  it('exposes every template by id', () => {
    for (const t of BUILT_IN_TEXT_TEMPLATES) {
      expect(BUILT_IN_TEXT_TEMPLATES_BY_ID.get(t.id)).toBe(t);
    }
  });

  it('size matches the list', () => {
    expect(BUILT_IN_TEXT_TEMPLATES_BY_ID.size).toBe(BUILT_IN_TEXT_TEMPLATES.length);
  });
});

describe('BUILT_IN_TEXT_TEMPLATES_BY_CATEGORY', () => {
  it('every bucket contents matches the source list filter', () => {
    for (const [cat, bucket] of BUILT_IN_TEXT_TEMPLATES_BY_CATEGORY) {
      const expected = BUILT_IN_TEXT_TEMPLATES.filter((t) => t.category === cat);
      expect([...bucket]).toEqual(expected);
    }
  });
});

describe('TITLE_BLOCK templates', () => {
  it('use bottom-right attachment for sheet-corner placement', () => {
    expect(TITLE_BLOCK_EL.content.attachment).toBe('BR');
    expect(TITLE_BLOCK_EN.content.attachment).toBe('BR');
  });

  it('share the same placeholder set across locales', () => {
    expect(TITLE_BLOCK_EL.placeholders).toEqual(TITLE_BLOCK_EN.placeholders);
  });

  it('reference the project namespace', () => {
    expect(TITLE_BLOCK_EL.placeholders).toContain('project.name');
    expect(TITLE_BLOCK_EL.placeholders).toContain('drawing.scale');
  });
});

describe('Other defaults — quick spot checks', () => {
  it('SIGNOFF_STAMP_EL anchors top-left', () => {
    expect(SIGNOFF_STAMP_EL.content.attachment).toBe('TL');
  });

  it('GENERAL_NOTES_EL uses 1.2× line spacing for readability', () => {
    expect(GENERAL_NOTES_EL.content.lineSpacing.factor).toBeCloseTo(1.2);
  });

  it('REVISION_TABLE_EL anchors top-right', () => {
    expect(REVISION_TABLE_EL.content.attachment).toBe('TR');
  });

  it('SCALE_BAR_MULTI uses locale "multi"', () => {
    expect(SCALE_BAR_MULTI.locale).toBe('multi');
  });
});
