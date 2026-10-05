/**
 * Unit tests for the audit-trail value resolver.
 *
 * Pins the 2026-04-11 regression: form option values persist as snake_case
 * (`fire_department`, `public_entity`, ...) while the canonical i18n catalogs
 * referenced by `AUDIT_VALUE_CATALOGS` normalize enum keys to camelCase per
 * ADR-279. The resolver must transparently bridge the two representations or
 * the audit timeline silently renders raw keys.
 *
 * @module components/shared/audit/__tests__/audit-value-resolver
 */

import { resolveAuditValue } from '../audit-value-resolver';

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

const t = (key: string): string => i18next.__store.get(key) ?? key;

function seed(entries: Record<string, string>): void {
  i18next.__store.clear();
  for (const [key, value] of Object.entries(entries)) {
    i18next.__store.set(key, value);
  }
}

describe('resolveAuditValue', () => {
  beforeEach(() => {
    i18next.__store.clear();
    i18next.exists.mockClear();
    i18next.t.mockClear();
  });

  describe('category (contacts-form:options.serviceCategories)', () => {
    beforeEach(() => {
      seed({
        'options.serviceCategories.ministry': 'Υπουργείο',
        'options.serviceCategories.publicEntity': 'Δημόσιος Φορέας',
        'options.serviceCategories.independentAuthority': 'Ανεξάρτητη Αρχή',
        'options.serviceCategories.socialSecurity': 'ΕΦΚΑ',
        'options.serviceCategories.urbanPlanning': 'Πολεοδομία',
        'options.serviceCategories.landRegistry': 'Κτηματολόγιο',
        'options.serviceCategories.fireDepartment': 'Πυροσβεστική',
      });
    });

    it('translates values whose stored form is already camelCase', () => {
      expect(resolveAuditValue('category', 'ministry', t)).toBe('Υπουργείο');
    });

    it('translates snake_case stored values via camelCase normalization', () => {
      expect(resolveAuditValue('category', 'public_entity', t)).toBe('Δημόσιος Φορέας');
      expect(resolveAuditValue('category', 'independent_authority', t)).toBe('Ανεξάρτητη Αρχή');
      expect(resolveAuditValue('category', 'social_security', t)).toBe('ΕΦΚΑ');
      expect(resolveAuditValue('category', 'urban_planning', t)).toBe('Πολεοδομία');
      expect(resolveAuditValue('category', 'land_registry', t)).toBe('Κτηματολόγιο');
      expect(resolveAuditValue('category', 'fire_department', t)).toBe('Πυροσβεστική');
    });

    it('returns undefined for unknown enum values (caller renders raw)', () => {
      expect(resolveAuditValue('category', 'does_not_exist', t)).toBeUndefined();
    });
  });

  describe('documentType (snake_case → camelCase normalization)', () => {
    it('resolves identity_card → identityCard', () => {
      seed({ 'options.identity.identityCard': 'Ταυτότητα' });
      expect(resolveAuditValue('documentType', 'identity_card', t)).toBe('Ταυτότητα');
    });
  });

  // Ο κατάλογος του περιγραφέα (`TrackedFieldDef.enumCatalog`): το `kind` είναι όνομα πεδίου σε
  // 15+ οντότητες με άλλο λεξιλόγιο, άρα ο χάρτης ανά όνομα δεν μπορεί να το λύσει.
  describe('declared catalog (entity + field) wins over the field-name catalog', () => {
    const FLOOR_KIND = { ns: 'floors', path: 'kind' } as const;

    it('translates a floor `kind` that has no field-name catalog', () => {
      seed({ 'kind.stairPenthouse': 'Απόληξη κλιμακοστασίου', 'kind.ground': 'Ισόγειο' });
      expect(resolveAuditValue('kind', 'stair-penthouse', t, FLOOR_KIND)).toBe('Απόληξη κλιμακοστασίου');
      expect(resolveAuditValue('kind', 'ground', t, FLOOR_KIND)).toBe('Ισόγειο');
    });

    it('leaves the same field name untranslated when the entity declares no catalog', () => {
      seed({ 'kind.ground': 'Ισόγειο' });
      expect(resolveAuditValue('kind', 'ground', t)).toBeUndefined();
    });

    it('is asked before the field-name catalog, not after', () => {
      seed({
        'options.serviceCategories.ministry': 'Υπουργείο',
        'declared.ministry': 'Από τον περιγραφέα',
      });
      expect(resolveAuditValue('category', 'ministry', t, { ns: 'x', path: 'declared' })).toBe(
        'Από τον περιγραφέα',
      );
    });

    it('does not fall through to the field-name catalog on a miss', () => {
      seed({ 'options.serviceCategories.ministry': 'Υπουργείο' });
      expect(resolveAuditValue('category', 'ministry', t, { ns: 'x', path: 'declared' })).toBeUndefined();
    });
  });

  describe('unregistered fields', () => {
    it('falls back to common:audit.values.{value}', () => {
      seed({ 'audit.values.approved': 'Εγκεκριμένο' });
      expect(resolveAuditValue('status', 'approved', t)).toBe('Εγκεκριμένο');
    });

    it('formats ISO-8601 dates when no catalog hit exists', () => {
      expect(resolveAuditValue('createdAt', '2026-04-11', t)).toMatch(
        /\d{2}\/\d{2}\/\d{4}/,
      );
    });
  });
});
