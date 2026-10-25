import {
  hasAnyLocalizedText,
  normalizeLocalizedText,
  resolveLocalizedText,
} from '../localized-text';

describe('resolveLocalizedText', () => {
  it('returns the requested language when present', () => {
    expect(resolveLocalizedText({ el: 'Ισχύς', en: 'Power' }, 'en')).toBe('Power');
  });

  it('falls back to the default language, then to any available language', () => {
    expect(resolveLocalizedText({ el: 'Ισχύς' }, 'en')).toBe('Ισχύς');
    expect(resolveLocalizedText({ en: 'Power' }, 'el')).toBe('Power');
  });

  it('treats blank strings as missing', () => {
    expect(resolveLocalizedText({ en: '   ', el: 'Ισχύς' }, 'en')).toBe('Ισχύς');
    expect(resolveLocalizedText({ el: '' }, 'el')).toBe('');
    expect(resolveLocalizedText(undefined, 'el')).toBe('');
  });
});

describe('normalizeLocalizedText', () => {
  it('trims values and drops blanks and non-human languages', () => {
    expect(normalizeLocalizedText({ el: '  Ισχύς ', en: ' ', pseudo: 'x', fr: 'Puissance' })).toEqual({ el: 'Ισχύς' });
  });

  it('ignores non-string values', () => {
    expect(normalizeLocalizedText({ el: 42, en: null })).toEqual({});
  });
});

describe('hasAnyLocalizedText', () => {
  it('is true only when at least one language is non-blank', () => {
    expect(hasAnyLocalizedText({ en: 'Power' })).toBe(true);
    expect(hasAnyLocalizedText({ el: ' ' })).toBe(false);
    expect(hasAnyLocalizedText(undefined)).toBe(false);
  });
});
