/**
 * Unit tests for the shared service-form i18n resolver.
 *
 * These tests exist specifically to prevent a repeat of the 2026-04-11 regression
 * where option labels keyed `options.serviceCategories.*` silently rendered as
 * raw keys in the "Δημόσια Υπηρεσία" → Βασικά Στοιχεία → Κατηγορία dropdown,
 * because the previous implementation only translated keys prefixed with
 * `contacts.`.
 *
 * @module components/generic/i18n/__tests__/translate-field-value
 */

import {
  SERVICE_FORM_NAMESPACES,
  translateFieldValue,
} from '../translate-field-value';

// Mock i18next before importing the subject — translateFieldValue uses the
// default export of `i18next` directly (`i18next.exists(key, { ns })`).
jest.mock('i18next', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      __store: store,
      exists: jest.fn((key: string) => store.has(key)),
      t: jest.fn((key: string) => store.get(key) ?? key),
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const i18next = require('i18next').default as {
  __store: Map<string, string>;
  exists: jest.Mock;
  t: jest.Mock;
};

// Simple translator stub that delegates to the mocked store, mirroring the
// shape of the real react-i18next `t` we receive at runtime.
const t = (key: string): string => i18next.__store.get(key) ?? key;

beforeEach(() => {
  i18next.__store.clear();
  i18next.exists.mockClear();
  i18next.t.mockClear();
});

describe('translateFieldValue', () => {
  describe('pass-through cases', () => {
    it('returns undefined when value is undefined', () => {
      expect(translateFieldValue(undefined, t)).toBeUndefined();
    });

    it('returns empty string unchanged', () => {
      expect(translateFieldValue('', t)).toBe('');
    });

    it('returns literal text without a dot unchanged', () => {
      expect(translateFieldValue('Κατηγορία', t)).toBe('Κατηγορία');
    });

    it('does not call i18next.exists for literal text', () => {
      translateFieldValue('plain value', t);
      expect(i18next.exists).not.toHaveBeenCalled();
    });
  });

  describe('regression: options.* keys', () => {
    it('resolves options.serviceCategories.ministry — the exact shortName bug pattern', () => {
      // This key lives in the `contacts-form` namespace, not `contacts`.
      // The legacy resolver only matched `contacts.*`, so this returned raw.
      i18next.__store.set('options.serviceCategories.ministry', 'Υπουργείο');
      expect(
        translateFieldValue('options.serviceCategories.ministry', t),
      ).toBe('Υπουργείο');
    });

    it('resolves every option in the service categories catalog', () => {
      const catalog = {
        'options.serviceCategories.ministry': 'Υπουργείο',
        'options.serviceCategories.region': 'Περιφέρεια',
        'options.serviceCategories.municipality': 'Δήμος',
        'options.serviceCategories.publicEntity': 'Δημόσιος Φορέας',
        'options.serviceCategories.other': 'Άλλο',
      };
      for (const [k, v] of Object.entries(catalog)) i18next.__store.set(k, v);
      for (const [k, v] of Object.entries(catalog)) {
        expect(translateFieldValue(k, t)).toBe(v);
      }
    });

    it('passes the configured namespace list to i18next.exists', () => {
      i18next.__store.set('options.x.y', 'ok');
      translateFieldValue('options.x.y', t);
      expect(i18next.exists).toHaveBeenCalledWith(
        'options.x.y',
        expect.objectContaining({ ns: SERVICE_FORM_NAMESPACES }),
      );
    });
  });

  describe('contacts.* legacy keys', () => {
    it('resolves keys that exist as-is (full path)', () => {
      i18next.__store.set('contacts.service.fields.name.label', 'Όνομα');
      expect(
        translateFieldValue('contacts.service.fields.name.label', t),
      ).toBe('Όνομα');
    });

    it('falls back to stripping the contacts. prefix when direct lookup fails', () => {
      // Common case: caller passes `contacts.service.fields.category.label`
      // but the key inside contacts.json is stored at root as
      // `service.fields.category.label`.
      i18next.__store.set('service.fields.category.label', 'Κατηγορία');
      expect(
        translateFieldValue('contacts.service.fields.category.label', t),
      ).toBe('Κατηγορία');
    });

    it('does NOT strip other prefixes (options.*, forms.*, company.*)', () => {
      // Negative test: the strip fallback is scoped to `contacts.` only.
      // `options.x.y` should fail cleanly, not accidentally look up `x.y`.
      expect(translateFieldValue('options.x.y', t)).toBe('options.x.y');
      expect(translateFieldValue('company.street', t)).toBe('company.street');
    });
  });

  describe('missing keys', () => {
    it('returns the original key when no namespace has it', () => {
      expect(translateFieldValue('options.missing.key', t)).toBe(
        'options.missing.key',
      );
    });

    it('returns the original key even when the contacts. fallback also fails', () => {
      expect(
        translateFieldValue('contacts.totally.missing', t),
      ).toBe('contacts.totally.missing');
    });
  });
});
