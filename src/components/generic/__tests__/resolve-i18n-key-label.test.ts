/**
 * Unit tests for resolveI18nKeyLabel (ADR-595).
 *
 * Locks the shared "dot → t() → last-segment fallback" resolver that replaced
 * three near-identical copies (GenericFormRenderer, GenericFormTabRenderer).
 *
 * @module components/generic/__tests__/resolve-i18n-key-label
 */

// The SSoT module also exports React components; those imports are irrelevant
// to this pure-function test but pull in the heavy uploader — mock it out.
jest.mock('@/components/ui/MultiplePhotosUpload', () => ({ MultiplePhotosUpload: () => null }));
jest.mock('@/components/ui/navigation/TabsComponents', () => ({ TabsOnlyTriggers: () => null }));
jest.mock('@/components/ui/tabs', () => ({ TabsContent: () => null }));

import { resolveI18nKeyLabel } from '../form-tabs-shell';

describe('resolveI18nKeyLabel', () => {
  const t = (key: string): string => {
    const table: Record<string, string> = {
      'sections.basicInfo': 'Βασικά Στοιχεία',
    };
    return table[key] ?? key; // i18next returns the key when unresolved
  };

  it('returns an empty string for falsy input', () => {
    expect(resolveI18nKeyLabel(undefined, t)).toBe('');
    expect(resolveI18nKeyLabel('', t)).toBe('');
  });

  it('passes plain (non-key) strings through unchanged', () => {
    expect(resolveI18nKeyLabel('Πελάτης', t)).toBe('Πελάτης');
  });

  it('translates a resolvable i18n key', () => {
    expect(resolveI18nKeyLabel('sections.basicInfo', t)).toBe('Βασικά Στοιχεία');
  });

  it('falls back to the last path segment when the key is unresolved', () => {
    expect(resolveI18nKeyLabel('sections.unknownKey', t)).toBe('unknownKey');
  });
});
