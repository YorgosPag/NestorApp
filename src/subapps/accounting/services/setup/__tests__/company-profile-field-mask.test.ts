/**
 * @jest-environment node
 *
 * @fileoverview **Η ΜΠΑΓΙΑΤΙΚΗ ΟΘΟΝΗ ΔΕΝ ΞΑΝΑΓΡΑΦΕΙ ΠΟΤΕ ΣΙΩΠΗΛΑ** — μάσκα πεδίων προφίλ
 *   (ADR-841 §7 Α23 Φ3.2 Γ3).
 * @related subapps/accounting/services/setup/company-profile-field-mask.ts
 *
 * Σενάρια: Figma (ανά ιδιότητα) · AIP-134 (μάσκα, `*`) · AIP-161 (άγνωστο πεδίο) · Stripe (ό,τι δεν
 * στάλθηκε μένει) · Protobuf `oneof` (η νέα μορφή σβήνει τα πεδία της παλιάς).
 */

import type { CompanyProfile, CompanySetupInput } from '../../../types/company';
import {
  COMPANY_PROFILE_FIELDS,
  changedProfileFields,
  mergeProfileFields,
  parseProfileFieldMask,
} from '../company-profile-field-mask';

const COMMON = {
  businessName: 'ΠΑΓΩΝΗΣ Ο.Ε.',
  profession: 'Κατασκευές',
  vatNumber: '123456789',
  taxOffice: 'Δ.Ο.Υ. Θεσσαλονίκης',
  address: 'Σαμοθράκης 16',
  city: 'Θεσσαλονίκη',
  postalCode: '54248',
  phone: '2310000000',
  mobile: null,
  email: null,
  website: null,
  mainKad: { code: '41.20', description: 'Κατασκευή κτιρίων', type: 'primary', activeFrom: '2020-01-01' },
  secondaryKads: [],
  bookCategory: 'simplified',
  vatRegime: 'normal',
  fiscalYearEnd: 12,
  currency: 'EUR',
  invoiceSeries: [],
} as const;

const PARTNER = { partnerId: 'p1', fullName: 'Γιώργος', profitSharePercent: 100 };
const SHAREHOLDER = { shareholderId: 's1', fullName: 'Γιώργος', dividendSharePercent: 100 };

function oe(overrides: Record<string, unknown> = {}): CompanySetupInput {
  return { ...COMMON, entityType: 'oe', gemiNumber: null, partners: [PARTNER], ...overrides } as unknown as CompanySetupInput;
}

function ae(overrides: Record<string, unknown> = {}): CompanySetupInput {
  return {
    ...COMMON, entityType: 'ae', bookCategory: 'double_entry', gemiNumber: '001234567000',
    shareholders: [SHAREHOLDER], shareCapital: 25000, ...overrides,
  } as unknown as CompanySetupInput;
}

function stored(input: CompanySetupInput): CompanyProfile {
  return { ...input, companyId: 'comp_1', createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' } as unknown as CompanyProfile;
}

const asRecord = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;

describe('Α — changedProfileFields: μόνο ό,τι άλλαξε ο άνθρωπος', () => {
  it('🔴 Α1 — άλλαξε μόνο το τηλέφωνο ⇒ `["phone"]`', () => {
    expect(changedProfileFields(stored(oe()), oe({ phone: '2310999999' }))).toEqual(['phone']);
  });

  it('🔑 Α2 — ίδιο περιεχόμενο σε ΝΕΑ αντικείμενα (εταίροι, ΚΑΔ) ⇒ καμία αλλαγή (βαθιά ισότητα)', () => {
    const fresh = oe({ partners: [{ ...PARTNER }], mainKad: { ...COMMON.mainKad } });
    expect(changedProfileFields(stored(oe()), fresh)).toEqual([]);
  });

  it('🔑 Α3 — παλιό έγγραφο ΧΩΡΙΣ `mobile`, φόρμα με `mobile: null` ⇒ ίδιο πράγμα', () => {
    const { mobile: _omit, ...legacy } = asRecord(stored(oe()));
    expect(changedProfileFields(legacy as unknown as CompanyProfile, oe())).toEqual([]);
  });

  it('🔑 Α4 — χωρίς βάση (πρώτη ρύθμιση) ⇒ κάθε πεδίο με τιμή', () => {
    expect(changedProfileFields(null, oe())).toEqual(expect.arrayContaining(['businessName', 'partners', 'entityType']));
  });
});

describe('Β — mergeProfileFields: η μπαγιάτικη οθόνη', () => {
  it('🔴 Β1 — επωνυμία υιοθετήθηκε στο μεταξύ, η παλιά οθόνη αλλάζει τηλέφωνο ⇒ η επωνυμία ΜΕΝΕΙ', () => {
    const disk = stored(oe({ businessName: 'ΠΑΓΩΝΗΣ ΚΑΙ ΣΙΑ Ο.Ε.' }));
    const staleScreen = oe({ phone: '2310999999' });

    const merged = asRecord(mergeProfileFields(disk, staleScreen, changedProfileFields(stored(oe()), staleScreen)));

    expect(merged.businessName).toBe('ΠΑΓΩΝΗΣ ΚΑΙ ΣΙΑ Ο.Ε.');
    expect(merged.phone).toBe('2310999999');
  });

  it('🔑 Β2 — ο άνθρωπος άλλαξε ο ίδιος την επωνυμία ⇒ γράφεται (LWW ιδιότητας)', () => {
    const merged = mergeProfileFields(stored(oe({ businessName: 'Α' })), oe({ businessName: 'Β' }), ['businessName']);
    expect(merged.businessName).toBe('Β');
  });

  it('🔑 Β3 — χωρίς μάσκα (παλιός πελάτης) ⇒ πλήρης αντικατάσταση · χωρίς αποθηκευμένο ⇒ ολόκληρο', () => {
    const next = oe({ businessName: 'Β' });
    expect(mergeProfileFields(stored(oe({ businessName: 'Α' })), next, undefined)).toBe(next);
    expect(mergeProfileFields(null, next, ['phone'])).toBe(next);
  });

  it('🔑 Β4 — άδεια μάσκα ⇒ το αποθηκευμένο αυτούσιο (μαζί με `createdAt`/`companyId`)', () => {
    const disk = stored(oe({ businessName: 'Α' }));
    expect(mergeProfileFields(disk, oe({ businessName: 'Β', phone: 'x' }), [])).toEqual(disk);
  });

  it('🔴 Β5 — μπαγιάτικοι εταίροι δεν επαναφέρονται όταν άλλαξε μόνο άλλο πεδίο', () => {
    const disk = stored(oe({ partners: [PARTNER, { ...PARTNER, partnerId: 'p2' }] }));
    const merged = asRecord(mergeProfileFields(disk, oe({ city: 'Αθήνα' }), ['city']));
    expect(merged.partners).toHaveLength(2);
    expect(merged.city).toBe('Αθήνα');
  });
});

describe('Γ — αλλαγή νομικής μορφής (Protobuf `oneof` + Stripe)', () => {
  it('🔴 Γ1 — ΟΕ → ΑΕ: γράφονται μορφή + πεδία ΑΕ, ΣΒΗΝΟΝΤΑΙ οι εταίροι, η μπαγιάτικη επωνυμία ΔΕΝ γράφεται', () => {
    const disk = stored(oe({ businessName: 'ΝΕΑ ΕΠΩΝΥΜΙΑ' }));
    const screen = ae({ businessName: 'ΠΑΛΙΑ ΕΠΩΝΥΜΙΑ' });

    const merged = asRecord(mergeProfileFields(disk, screen, ['entityType']));

    expect(merged).toMatchObject({
      entityType: 'ae', bookCategory: 'double_entry', gemiNumber: '001234567000',
      shareholders: [SHAREHOLDER], shareCapital: 25000, businessName: 'ΝΕΑ ΕΠΩΝΥΜΙΑ', companyId: 'comp_1',
    });
    expect(merged).not.toHaveProperty('partners');
  });

  it('🔴 Γ2 — οθόνη ΠΑΛΙΑΣ μορφής (ΟΕ) ενώ αλλού έγινε ΑΕ ⇒ η μορφή ΜΕΝΕΙ ΑΕ, εταίροι δεν γράφονται', () => {
    const disk = stored(ae());
    const merged = asRecord(mergeProfileFields(disk, oe({ phone: '2310999999' }), ['phone', 'partners']));

    expect(merged).toMatchObject({ entityType: 'ae', shareholders: [SHAREHOLDER], phone: '2310999999' });
    expect(merged).not.toHaveProperty('partners');
  });

  it('🔑 Γ3 — `entityType` στη μάσκα με ΙΔΙΑ τιμή ⇒ όχι αλλαγή μορφής (τίποτα άλλο δεν γράφεται)', () => {
    const disk = stored(oe({ businessName: 'Α', gemiNumber: '001' }));
    const merged = asRecord(mergeProfileFields(disk, oe({ businessName: 'Β', gemiNumber: null }), ['entityType']));
    expect(merged).toMatchObject({ businessName: 'Α', gemiNumber: '001' });
  });
});

describe('Δ — parseProfileFieldMask (AIP-134 / AIP-161)', () => {
  it('🔑 Δ1 — απούσα ⇒ `full` · έγκυρη ⇒ πεδία χωρίς διπλότυπα', () => {
    expect(parseProfileFieldMask(undefined)).toEqual({ kind: 'full' });
    expect(parseProfileFieldMask(['phone', 'phone', 'city'])).toEqual({ kind: 'fields', fields: ['phone', 'city'] });
    expect(parseProfileFieldMask([])).toEqual({ kind: 'fields', fields: [] });
  });

  it.each([
    [['companyId'], ['companyId']],
    [['createdAt', 'phone'], ['createdAt']],
    [['toString'], ['toString']],
    [[42], ['42']],
    ['phone', ['string']],
    [null, ['object']],
  ])('🔴 Δ2 — μη έγκυρη μάσκα %p ⇒ `invalid` (ποτέ γραφή αυθαίρετου κλειδιού)', (mask, rejected) => {
    expect(parseProfileFieldMask(mask)).toEqual({ kind: 'invalid', rejected });
  });

  it('🔑 Δ3 — το κλειστό σύνολο καλύπτει κάθε πεδίο κάθε μορφής, χωρίς μεταδεδομένα', () => {
    const everyKey = new Set([...Object.keys(oe()), ...Object.keys(ae()), 'efkaCategory', 'members']);
    expect(new Set(COMPANY_PROFILE_FIELDS)).toEqual(everyKey);
  });
});
