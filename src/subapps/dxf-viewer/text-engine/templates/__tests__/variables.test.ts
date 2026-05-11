/**
 * ADR-344 Phase 7.C — Variable registry tests.
 *
 * Asserts:
 *   1. Every `PlaceholderPath` declared in the registry has a matching
 *      i18n label key in BOTH `el` and `en` locale files. Catches drift
 *      between code-side registry and translator-facing JSON.
 *   2. Every `{{namespace.key}}` token used by built-in templates is a
 *      known path in the registry. Catches typos in template authoring.
 *   3. Predicate helpers behave correctly on known + unknown paths.
 */

import {
  PLACEHOLDER_REGISTRY,
  ALL_PLACEHOLDER_PATHS,
  isKnownPlaceholder,
  getPlaceholderMetadata,
  type PlaceholderPath,
} from '../resolver/variables';
import { BUILT_IN_TEXT_TEMPLATES } from '../defaults';
import { extractPlaceholders } from '../extract-placeholders';
import elLocale from '@/i18n/locales/el/textTemplates.json';
import enLocale from '@/i18n/locales/en/textTemplates.json';

type LocaleTree = Record<string, unknown>;

function resolveLocaleKey(tree: LocaleTree, dottedKey: string): unknown {
  return dottedKey.split('.').reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, tree as unknown);
}

describe('PLACEHOLDER_REGISTRY', () => {
  it('exposes 17 placeholder paths (Phase 7.C scope)', () => {
    expect(ALL_PLACEHOLDER_PATHS).toHaveLength(17);
  });

  it('returns paths sorted alphabetically', () => {
    const sorted = [...ALL_PLACEHOLDER_PATHS].sort();
    expect(ALL_PLACEHOLDER_PATHS).toEqual(sorted);
  });

  it('every entry declares a labelI18nKey under the textTemplates namespace', () => {
    for (const path of ALL_PLACEHOLDER_PATHS) {
      const meta = PLACEHOLDER_REGISTRY[path];
      expect(meta.labelI18nKey.startsWith('textTemplates:placeholders.')).toBe(true);
    }
  });

  it('every label key resolves in the Greek locale file', () => {
    for (const path of ALL_PLACEHOLDER_PATHS) {
      const meta = PLACEHOLDER_REGISTRY[path];
      const dotted = meta.labelI18nKey.replace(/^textTemplates:/, '');
      const value = resolveLocaleKey(elLocale as LocaleTree, dotted);
      expect(typeof value).toBe('string');
      expect(value).not.toBe('');
    }
  });

  it('every label key resolves in the English locale file', () => {
    for (const path of ALL_PLACEHOLDER_PATHS) {
      const meta = PLACEHOLDER_REGISTRY[path];
      const dotted = meta.labelI18nKey.replace(/^textTemplates:/, '');
      const value = resolveLocaleKey(enLocale as LocaleTree, dotted);
      expect(typeof value).toBe('string');
      expect(value).not.toBe('');
    }
  });

  it('source matches the namespace prefix of the path', () => {
    for (const path of ALL_PLACEHOLDER_PATHS) {
      const meta = PLACEHOLDER_REGISTRY[path];
      const [namespace] = path.split('.');
      expect(meta.source).toBe(namespace);
    }
  });

  it('every placeholder used by a built-in template is a known path', () => {
    for (const tpl of BUILT_IN_TEXT_TEMPLATES) {
      for (const raw of extractPlaceholders(tpl.content)) {
        expect(isKnownPlaceholder(raw)).toBe(true);
      }
    }
  });
});

describe('isKnownPlaceholder', () => {
  it('returns true for a registered path', () => {
    expect(isKnownPlaceholder('project.name')).toBe(true);
  });

  it('returns false for an unknown path', () => {
    expect(isKnownPlaceholder('project.naem')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isKnownPlaceholder('')).toBe(false);
  });
});

describe('getPlaceholderMetadata', () => {
  it('returns metadata for a known path', () => {
    const meta = getPlaceholderMetadata('date.today');
    expect(meta?.source).toBe('date');
    expect(meta?.labelI18nKey).toBe('textTemplates:placeholders.date.today');
  });

  it('returns undefined for an unknown path', () => {
    expect(getPlaceholderMetadata('foo.bar')).toBeUndefined();
  });

  it('exposes a sample value for the management UI preview', () => {
    for (const path of ALL_PLACEHOLDER_PATHS) {
      const meta = getPlaceholderMetadata(path as PlaceholderPath);
      expect(meta?.sample.length).toBeGreaterThan(0);
    }
  });
});
