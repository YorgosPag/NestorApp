/**
 * ADR-915 Φ2 — ο ΕΝΑΣ κριτής (`documentStanding`) και η ανάποδη όψη (`dependentsOf`). Συνθετικά δεδομένα μόνο.
 */

import { CONVEYANCE_CHECKLIST, EXPIRING_WINDOW_DAYS } from '@/config/conveyance-checklist/catalog';
import { documentKindSpec } from '@/config/document-validity/document-validity';
import { conveyanceRequirements } from '@/lib/conveyance/conveyance-requirements';
import { isExpiredOn } from '@/lib/legality/legality-signal';
import { publicationRequirements } from '@/lib/legality/publication-requirements';
import { ruleExpiresOn } from '../document-expiry';
import {
  absentDependentsOf,
  dependentsOf,
  documentStanding,
  requirementCoveredBy,
  type DocumentRequirement,
  type NeededOn,
  type TrackedDocument,
} from '../document-requirement';

const continuous: NeededOn = { kind: 'continuous' };
const on = (day: string): NeededOn => ({ kind: 'on', day });
const standing = (expiresOn: string | null, asOf: string, neededOn: NeededOn = continuous, warnWindowDays = 7) =>
  documentStanding({ expiresOn, asOf, neededOn, warnWindowDays });

describe('documentStanding — ο ΕΝΑΣ κριτής', () => {
  it('άγνωστη ή αδιάβαστη λήξη ⇒ `expiry-unknown`, ποτέ `valid`', () => {
    expect(standing(null, '2026-10-02')).toEqual({ state: 'expiry-unknown', expiresOn: null, validAtNeed: null });
    expect(standing('31/12/2030', '2026-10-02').state).toBe('expiry-unknown');
  });

  it('η τελευταία μέρα είναι ΜΕΣΑ: λήγει σήμερα ⇒ `expiring` · χθες ⇒ `expired`', () => {
    expect(standing('2026-10-02', '2026-10-02').state).toBe('expiring');
    expect(standing('2026-10-01', '2026-10-02').state).toBe('expired');
  });

  it('παράθυρο: ακριβώς N ημέρες ⇒ `expiring` · N+1 ⇒ `valid`', () => {
    expect(standing('2026-10-09', '2026-10-02').state).toBe('expiring');
    expect(standing('2026-10-10', '2026-10-02').state).toBe('valid');
    expect(standing('2026-11-30', '2026-10-02', continuous, 60).state).toBe('expiring');
  });

  it('`on`: ισχύει την ημέρα (ίδια μέρα μέσα) · δεν ισχύει ⇒ `expiring` ακόμη κι αν απέχει μήνες', () => {
    expect(standing('2027-01-01', '2026-10-02', on('2027-01-01'))).toEqual({ state: 'valid', expiresOn: '2027-01-01', validAtNeed: true });
    expect(standing('2026-12-01', '2026-10-02', on('2026-12-15'))).toEqual({ state: 'expiring', expiresOn: '2026-12-01', validAtNeed: false });
  });

  it('`unscheduled` ή αδιάβαστη μέρα ⇒ `validAtNeed: null`', () => {
    expect(standing('2030-01-01', '2026-10-02', { kind: 'unscheduled' }).validAtNeed).toBeNull();
    expect(standing('2030-01-01', '2026-10-02', on('σύντομα')).validAtNeed).toBeNull();
  });

  it('`continuous`: `validAtNeed` = «ισχύει σήμερα»', () => {
    expect(standing('2026-10-02', '2026-10-02').validAtNeed).toBe(true);
    expect(standing('2026-10-01', '2026-10-02').validAtNeed).toBe(false);
  });

  it('ισοτιμία με το `isExpiredOn` της νομιμότητας (ίδια σημασιολογία «τελευταία μέρα μέσα»)', () => {
    const asOf = '2026-10-02';
    for (const until of ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2036-07-16']) {
      expect(standing(until, asOf).state === 'expired').toBe(isExpiredOn(until, asOf));
    }
  });
});

const PROPERTY = 'prop_synthetic_1';

function requirement(overrides: Partial<DocumentRequirement>): DocumentRequirement {
  return {
    documentKind: 'energy-certificate', subject: { propertyId: PROPERTY },
    process: { kind: 'listing-publication', listingId: 'lst_1' }, neededOn: continuous, policy: 'warn',
    warnWindowDays: 0, basis: { kind: 'statute', statute: 's' }, presence: 'tracked', attestation: null, ...overrides,
  };
}

const pea = (expiresOn: string | null): TrackedDocument =>
  ({ kind: 'energy-certificate', subject: { propertyId: PROPERTY }, fileId: null, expiresOn });

describe('dependentsOf — τι σταματά αν λήξει αυτό', () => {
  it('`continuous` ⇒ `stops` από την επομένη της λήξης', () => {
    const [dependent] = dependentsOf(pea('2036-07-16'), [requirement({})]);
    expect([dependent.impact, dependent.stopsOn]).toEqual(['stops', '2036-07-17']);
  });

  it('`on`: λήγει πριν ⇒ `stops` · λήγει την ίδια μέρα ή μετά ⇒ `unaffected`', () => {
    const signing = requirement({ neededOn: on('2026-12-15'), policy: 'block' });
    expect(dependentsOf(pea('2026-12-14'), [signing])[0].impact).toBe('stops');
    expect(dependentsOf(pea('2026-12-15'), [signing])[0]).toMatchObject({ impact: 'unaffected', stopsOn: null });
  });

  it('άγνωστη λήξη ή άγνωστη μέρα ⇒ `undetermined`, ποτέ `unaffected`', () => {
    expect(dependentsOf(pea(null), [requirement({})])[0].impact).toBe('undetermined');
    expect(dependentsOf(pea('2030-01-01'), [requirement({ neededOn: { kind: 'unscheduled' } })])[0].impact).toBe('undetermined');
  });

  it('μόνο το ίδιο είδος ΚΑΙ το ίδιο ακίνητο', () => {
    const others = [
      requirement({ documentKind: 'building-identity' }),
      requirement({ subject: { propertyId: 'prop_synthetic_2' } }),
    ];
    expect(dependentsOf(pea('2030-01-01'), others)).toEqual([]);
  });

  it('σειρά: `block` πρώτα, μετά η νωρίτερη μέρα· το άγνωστο στο τέλος της ομάδας', () => {
    const listing = requirement({});
    const unscheduled = requirement({ process: { kind: 'conveyance', caseId: 'c2' }, policy: 'block', neededOn: { kind: 'unscheduled' } });
    const signing = requirement({ process: { kind: 'conveyance', caseId: 'c1' }, policy: 'block', neededOn: on('2031-01-01') });
    const order = dependentsOf(pea('2030-01-01'), [listing, unscheduled, signing]).map((d) => d.requirement.process);
    expect(order).toEqual([signing.process, unscheduled.process, listing.process]);
  });
});

describe('Φ4δ — ο ΕΝΑΣ κριτής κάλυψης (Ε9) και το «λείπει» (Ε7)', () => {
  const project = (fileId: string): TrackedDocument => ({ kind: 'energy-certificate', subject: null, fileId, expiresOn: '2030-01-01' });
  const signing = (fileId: string | null) => requirement({
    process: { kind: 'conveyance', caseId: 'c1' }, policy: 'block', neededOn: on('2031-01-01'),
    attestation: fileId === null ? null : { fileId, issuedOn: '2020-01-01' },
  });

  it('ΠΕΑ επιπέδου έργου: καλύπτει ΜΟΝΟ την υπόθεση που ενέκρινε ρητά αυτό το αρχείο', () => {
    expect(requirementCoveredBy(project('f-project'), signing('f-project'))).toBe(true);
    expect(requirementCoveredBy(project('f-project'), signing('f-other'))).toBe(false);
    expect(requirementCoveredBy(project('f-project'), signing(null))).toBe(false);
    expect(dependentsOf(project('f-project'), [signing('f-project')])[0]).toMatchObject({ impact: 'stops', stopsOn: '2030-01-02' });
  });

  it('έγκριση άλλου είδους δεν δένει, ακόμη και με ίδιο αρχείο', () => {
    expect(requirementCoveredBy(project('f-project'), { ...signing('f-project'), documentKind: 'building-identity' })).toBe(false);
  });

  it('`absent`: κάθε απαίτηση χωρίς έγγραφο, `block` πρώτα, χωρίς μέρα διακοπής', () => {
    const order = absentDependentsOf([requirement({}), signing(null)]);
    expect(order.map((d) => [d.requirement.policy, d.impact, d.stopsOn])).toEqual([['block', 'absent', null], ['warn', 'absent', null]]);
  });
});

describe('παραγωγοί — οι υπάρχοντες κατάλογοι ΕΙΝΑΙ οι απαιτήσεις', () => {
  const conveyance = conveyanceRequirements({ items: CONVEYANCE_CHECKLIST, caseId: 'case_1', propertyId: PROPERTY, targetSigningDate: '2026-12-15' });

  it('μεταβίβαση: ακριβώς οι γραμμές με `documentKind`, `block`, για την υπογραφή', () => {
    expect(conveyance.map((r) => [r.documentKind, r.policy, r.neededOn, r.warnWindowDays])).toEqual([
      ['building-identity', 'block', on('2026-12-15'), EXPIRING_WINDOW_DAYS],
      ['energy-certificate', 'block', on('2026-12-15'), EXPIRING_WINDOW_DAYS],
      // ADR-915 §14 — τα τρία έγγραφα του πωλητή με τυπωμένη λήξη.
      ['enfia-certificate', 'block', on('2026-12-15'), EXPIRING_WINDOW_DAYS],
      ['tax-clearance', 'block', on('2026-12-15'), EXPIRING_WINDOW_DAYS],
      ['insurance-clearance', 'block', on('2026-12-15'), EXPIRING_WINDOW_DAYS],
    ]);
  });

  it('μεταβίβαση χωρίς ημέρα υπογραφής ⇒ `unscheduled`, όχι «δεν χρειάζεται»', () => {
    const undated = conveyanceRequirements({ items: CONVEYANCE_CHECKLIST, caseId: 'c', propertyId: PROPERTY, targetSigningDate: null });
    expect(undated.map((r) => r.neededOn.kind)).toEqual(Array(5).fill('unscheduled'));
  });

  it('κάθε γραμμή με `documentKind` παίρνει τον κανόνα ΤΟΥ είδους (καμία δεύτερη πηγή)', () => {
    const bound = CONVEYANCE_CHECKLIST.flatMap((i) => (i.documentKind === undefined ? [] : [[i.validity, i.documentKind] as const]));
    expect(bound).toHaveLength(5);
    for (const [validity, kind] of bound) expect(validity).toBe(documentKindSpec(kind).rule);
  });

  it('Α1: πώληση/μίσθωση ⇒ το ΠΕΑ είναι `warn`, συνεχώς — η αγγελία ΔΕΝ μπλοκάρεται', () => {
    const sell = publicationRequirements({ listingId: 'l', propertyId: PROPERTY, offerKinds: ['sell'] });
    const energy = sell.find((r) => r.documentKind === 'energy-certificate');
    expect(energy).toMatchObject({ policy: 'warn', neededOn: continuous, basis: { kind: 'statute' }, warnWindowDays: 60 });
    expect(publicationRequirements({ listingId: 'l', propertyId: PROPERTY, offerKinds: ['leaseOut'] }).map((r) => r.documentKind))
      .toEqual(['energy-certificate']);
  });

  it('βραχυχρόνια: το ΠΕΑ δηλώνεται ως ανοιχτή ερώτηση · ο ΑΜΑ δεν είναι έγγραφο με ισχύ', () => {
    const short = publicationRequirements({ listingId: 'l', propertyId: PROPERTY, offerKinds: ['leaseShort'] });
    expect(short.map((r) => [r.documentKind, r.basis.kind])).toEqual([['energy-certificate', 'unresolved']]);
  });

  it('Φ4δ Ε7: «λείπει» μόνο όπου ο νόμος θέλει το έγγραφο ΣΤΗΝ αγγελία — ΠΕΑ ναι · ταυτότητα κτιρίου όχι · ανοιχτή ερώτηση όχι', () => {
    const presence = (offerKinds: Parameters<typeof publicationRequirements>[0]['offerKinds']) =>
      publicationRequirements({ listingId: 'l', propertyId: PROPERTY, offerKinds }).map((r) => [r.documentKind, r.presence, r.attestation]);
    expect(presence(['sell'])).toEqual(expect.arrayContaining([['energy-certificate', 'required', null]]));
    expect(presence(['sell']).filter(([kind]) => kind === 'building-identity').every(([, p]) => p === 'tracked')).toBe(true);
    expect(presence(['leaseShort'])).toEqual([['energy-certificate', 'tracked', null]]);
  });

  it('Φ4δ: ο σκέτος κατάλογος (χωρίς γεγονότα υπόθεσης) δεν ισχυρίζεται «λείπει»', () => {
    expect(conveyance.every((r) => r.presence === 'tracked' && r.attestation === null)).toBe(true);
  });

  it('μία διάθεση `raised` αρκεί πάνω από μία `unresolved`', () => {
    const mixed = publicationRequirements({ listingId: 'l', propertyId: PROPERTY, offerKinds: ['leaseShort', 'sell'] });
    expect(mixed.find((r) => r.documentKind === 'energy-certificate')?.basis.kind).toBe('statute');
  });

  it('ένα ΠΕΑ, δύο διαδικασίες: η υπογραφή μπλοκάρεται ΠΡΩΤΗ, η αγγελία προειδοποιείται μετά', () => {
    const listing = publicationRequirements({ listingId: 'l', propertyId: PROPERTY, offerKinds: ['sell'] });
    const expiresOn = ruleExpiresOn(documentKindSpec('energy-certificate').rule, '2016-12-01');
    const dependents = dependentsOf(pea(expiresOn), [...listing, ...conveyance]);
    expect(dependents.map((d) => [d.requirement.process.kind, d.requirement.policy, d.impact, d.stopsOn])).toEqual([
      ['conveyance', 'block', 'stops', '2026-12-02'],
      ['listing-publication', 'warn', 'stops', '2026-12-02'],
    ]);
  });
});
