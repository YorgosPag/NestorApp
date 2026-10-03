/**
 * @jest-environment node
 *
 * ADR-900 §8 #2 (2β.4) — άγκυρες της δημόσιας μονάδας: γεγονότα (καθαρά) + σπόρος HMAC.
 *
 * Μ1 μόνο ΚΑΕΚ ιδιοκτησίας + κτίριο γεννούν μονάδα · Μ2 πόρτα/ΚΑΕΚ ΠΕΦΤΟΥΝ ρητά · Μ3 ισοβαθμία δεν αλλάζει στάθμη,
 * το Κτηματολόγιο την ξεπερνά · Μ4 κύκλος UPRN (historical ⇒ approved, πρώτη βεβαίωση σταθερή) · Μ5 διαφωνία
 * δεσμού = σήμα, όχι εγγραφή · Σ1 σπόρος: ίδιο κλειδί ⇒ ίδιος, άλλο μυστικό ⇒ άλλος, δήλωση ⇒ κανένας, ποτέ ο ΚΑΕΚ.
 */
import type { PlaceUnitRef } from '@/lib/geo/place-unit';
import type { PublicUnit } from '@/types/geo/public-place';
import { mergeIntoUnit, newPublicUnit, publicUnitFactsOf } from '../public-unit-facts';
import { publicUnitSeed, PUBLIC_UNIT_SEED_SECRET_ENV } from '@/server/places/public-unit-seed';

jest.mock('server-only', () => ({}));

const T0 = '2026-10-03T10:00:00.000Z';
const T1 = '2026-10-04T10:00:00.000Z';
const KAEK = '050681726003/0/1';

const ref = (over: Partial<PlaceUnitRef> = {}): PlaceUnitRef => ({
  landId: 'land_1',
  buildingId: 'pbld_1',
  floor: { number: 2, kind: null },
  unitNumber: 'Α1',
  kaek: KAEK,
  ...over,
});

describe('Μ1/Μ2 — από τη σύνθεση στα γεγονότα', () => {
  it('χωρίς ΚΑΕΚ ή χωρίς κτίριο ⇒ καμία μονάδα', () => {
    expect(publicUnitFactsOf(ref({ kaek: null }))).toBeNull();
    expect(publicUnitFactsOf(ref({ buildingId: null }))).toBeNull();
  });

  it('🔒 η πόρτα και ο ΚΑΕΚ δεν περνούν στο κοινό επίπεδο', () => {
    const facts = publicUnitFactsOf(ref());
    expect(facts).toEqual({ landId: 'land_1', buildingId: 'pbld_1', floor: { number: 2, kind: null } });
    const unit = newPublicUnit('punit_x', facts!, T0);
    expect(JSON.stringify(unit)).not.toMatch(/Α1|050681726003/);
  });
});

describe('Μ3–Μ5 — νέα βεβαίωση της ίδιας μονάδας', () => {
  const born = (): PublicUnit => newPublicUnit('punit_x', publicUnitFactsOf(ref())!, T0);

  it('Μ3 ισόβαθμη δήλωση (δεύτερος κάτοχος) ΔΕΝ ξαναγράφει τη στάθμη', () => {
    const { unit } = mergeIntoUnit(born(), publicUnitFactsOf(ref({ floor: { number: 5, kind: null } }))!, T1);
    expect(unit.level).toEqual({ value: { number: 2, kind: null }, source: 'declared', attestedAt: T0 });
  });

  it('Μ3 στάθμη πάνω σε άγνωστο ⇒ γράφεται', () => {
    const blank = newPublicUnit('punit_x', publicUnitFactsOf(ref({ floor: null }))!, T0);
    expect(blank.level).toBeNull();
    expect(mergeIntoUnit(blank, publicUnitFactsOf(ref())!, T1).unit.level?.attestedAt).toBe(T1);
  });

  it('Μ4 κύκλος UPRN: historical ⇒ approved, πρώτη βεβαίωση σταθερή, τελευταία ανανεώνεται', () => {
    const { unit } = mergeIntoUnit({ ...born(), status: 'historical' }, publicUnitFactsOf(ref())!, T1);
    expect(unit).toMatchObject({ status: 'approved', existence: { firstAttestedAt: T0, lastAttestedAt: T1 }, createdAt: T0 });
  });

  it('Μ5 άλλο κτίριο ⇒ σήμα διαφωνίας, ο δεσμός ΜΕΝΕΙ', () => {
    const merge = mergeIntoUnit(born(), publicUnitFactsOf(ref({ buildingId: 'pbld_2' }))!, T1);
    expect(merge.linkDisagreement).toBe(true);
    expect(merge.unit.buildingId).toBe('pbld_1');
  });
});

describe('Σ1 — ο σπόρος (HMAC, ποτέ ο ΚΑΕΚ)', () => {
  const cadastral = { strength: 'cadastral' as const, key: `kaek:${KAEK}` };

  afterEach(() => {
    delete process.env[PUBLIC_UNIT_SEED_SECRET_ENV];
  });

  it('ίδιο κλειδί ⇒ ίδιος σπόρος · άλλο μυστικό ⇒ άλλος · ο ΚΑΕΚ δεν φαίνεται', () => {
    process.env[PUBLIC_UNIT_SEED_SECRET_ENV] = 'secret-a';
    const a = publicUnitSeed(cadastral);
    expect(publicUnitSeed(cadastral)).toBe(a);
    expect(a).not.toContain('050681726003');
    process.env[PUBLIC_UNIT_SEED_SECRET_ENV] = 'secret-b';
    expect(publicUnitSeed(cadastral)).not.toBe(a);
  });

  it('δηλωμένο κλειδί ⇒ κανένας σπόρος (η δήλωση δεν γεννά ποτέ δημόσια μονάδα)', () => {
    process.env[PUBLIC_UNIT_SEED_SECRET_ENV] = 'secret-a';
    expect(publicUnitSeed({ strength: 'declared', key: 'bld:pbld_1|fl:2|u:A1' })).toBeNull();
  });

  it('🔴 χωρίς μυστικό ⇒ ρίχνει (fail-closed, ποτέ ασθενής ταυτότητα)', () => {
    expect(() => publicUnitSeed(cadastral)).toThrow(PUBLIC_UNIT_SEED_SECRET_ENV);
  });
});
