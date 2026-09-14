/**
 * ADR-841 §7 Α21.19 — «Εισαγωγή από τα στοιχεία της εταιρείας»: σύγκριση ανά πεδίο + εφαρμογή στο πρόχειρο.
 *
 * 🔑 Οι κριτές είναι **αληθινοί** (`libphonenumber`, `normalisePublicWebsite`): άγκυρα που μιμείται τον κριτή
 * επιβεβαιώνει τον εαυτό της.
 */

import {
  applyImport,
  compareCardWithSource,
  defaultDecisions,
  differenceCount,
  withoutProvenance,
} from '../showcase-card-import';
import { emptyLocationDraft, wireOfDrafts, type ShowcaseLocationDraft } from '../showcase-card-draft';
import type { CompanyContactSource } from '@/types/showcase-card-import';

const SOURCE: CompanyContactSource = {
  address: {
    street: 'Σαμοθράκης',
    number: '16',
    postalCode: '56334',
    locality: 'Θεσσαλονίκη',
    origin: 'company-profile',
    checkedAt: null,
  },
  phones: ['2310 123456', '6912345678'],
  email: 'Info@Pagonis.gr',
  website: 'www.pagonis.gr',
};

function hq(patch: Partial<ShowcaseLocationDraft>): ShowcaseLocationDraft {
  return { ...emptyLocationDraft('headquarters'), ...patch };
}

const statuses = (drafts: readonly ShowcaseLocationDraft[], website: string, source = SOURCE) =>
  Object.fromEntries(compareCardWithSource(drafts, website, source).rows.map(({ key, status }) => [key, status]));

describe('showcase-card-import — σύγκριση', () => {
  it('Ι1 κενή κάρτα ⇒ κάθε πεδίο «fill», και μετράει στο κουμπί', () => {
    const comparison = compareCardWithSource([], '', SOURCE);
    expect(comparison.rows.map(({ status }) => status)).toEqual(['fill', 'fill', 'fill', 'fill', 'fill']);
    expect(differenceCount(comparison)).toBe(5);
  });

  it('Ι2 «+30 2310123456» στην κάρτα = «2310 123456» στην εταιρεία ⇒ same, ΟΧΙ σύγκρουση', () => {
    const card = hq({ phones: [{ number: '+30 2310123456', extension: '' }] });
    expect(statuses([card], '')['phones:+302310123456']).toBe('same');
  });

  it('Ι3 `https://www.pagonis.gr/` = `www.pagonis.gr` ⇒ same', () => {
    expect(statuses([], 'https://www.pagonis.gr/').website).toBe('same');
  });

  it('Ι4 διαφορετική ιστοσελίδα ⇒ differs, και η προεπιλογή ΚΡΑΤΑ της κάρτας', () => {
    const comparison = compareCardWithSource([], 'https://other.gr/', SOURCE);
    expect(statuses([], 'https://other.gr/').website).toBe('differs');
    const applied = applyImport([], 'https://other.gr/', comparison, defaultDecisions(comparison));
    expect(applied.website).toBe('https://other.gr/');
  });

  it('Ι5 ρητή επιλογή «της εταιρείας» ⇒ αντικαθιστά, με κανονική μορφή', () => {
    const comparison = compareCardWithSource([], 'https://other.gr/', SOURCE);
    const applied = applyImport([], 'https://other.gr/', comparison, new Set(['website']));
    expect(applied.website).toBe('https://www.pagonis.gr/');
    expect(applied.websiteOrigin).toBe('company-profile');
  });

  it('Ι6 ταβάνι 3 τηλεφώνων ⇒ «no-room», ποτέ σιωπηλή παράλειψη', () => {
    const card = hq({
      phones: [
        { number: '2310 111111', extension: '' },
        { number: '2310 222222', extension: '' },
        { number: '2310 333333', extension: '' },
      ],
    });
    expect(statuses([card], '')['phones:+302310123456']).toBe('no-room');
  });

  it('Ι6β άκυρο τηλέφωνο στην πηγή ⇒ «invalid-source», δεν προτείνεται', () => {
    const comparison = compareCardWithSource([], '', { ...SOURCE, phones: ['12'] });
    const row = comparison.rows.find(({ field }) => field === 'phones');
    expect(row?.status).toBe('invalid-source');
    expect(defaultDecisions(comparison).has(row?.key ?? '')).toBe(false);
  });

  it('Ι7 ίδια οδός με άλλα κεφαλαία ⇒ same· άλλη οδός ⇒ differs', () => {
    const same = hq({ street: { street: 'ΣΑΜΟΘΡΑΚΗΣ', number: '16', postalCode: '56334' } });
    const other = hq({ street: { street: 'Τσιμισκή', number: '12', postalCode: '54624' } });
    expect(statuses([same], '').street).toBe('same');
    expect(statuses([other], '').street).toBe('differs');
  });

  it('Ι7β πηγή χωρίς στοιχείο ⇒ καμία γραμμή για αυτό', () => {
    const rows = compareCardWithSource([], '', { address: null, phones: [], email: null, website: null }).rows;
    expect(rows).toEqual([]);
  });
});

describe('showcase-card-import — εφαρμογή', () => {
  const applyDefaults = (drafts: readonly ShowcaseLocationDraft[], website = '') => {
    const comparison = compareCardWithSource(drafts, website, SOURCE);
    return applyImport(drafts, website, comparison, defaultDecisions(comparison));
  };

  it('Ι8 🔴 ο διακόπτης «Δημοσίευση οδού» ΜΕΝΕΙ κλειστός — η οδός κρατιέται στο πρόχειρο, όχι στο σύρμα', () => {
    const [created] = applyDefaults([]).drafts;
    expect(created.role).toBe('headquarters');
    expect(created.publishStreet).toBe(false);
    expect(created.street).toEqual({ street: 'Σαμοθράκης', number: '16', postalCode: '56334' });
    const formed = wireOfDrafts([{ ...created, place: { landId: 'land_1', buildingId: null } }], '');
    expect('wire' in formed && formed.wire.locations[0].street).toBe(null);
  });

  it('Ι9 ⛔ κανένα `label`, κανένας τόπος — μόνο ερώτημα εντοπισμού', () => {
    const labelled = hq({ label: 'Κεντρικό' });
    const [result] = applyDefaults([labelled]).drafts;
    expect(result.label).toBe('Κεντρικό');
    expect(result.place).toBeNull();
    expect(result.placeHint).toBe('Σαμοθράκης 16, 56334, Θεσσαλονίκη');
  });

  it('Ι10 τα input ΔΕΝ μεταλλάσσονται — η αναίρεση είναι το προηγούμενο στιγμιότυπο', () => {
    const before = [hq({})];
    const snapshot = JSON.stringify(before);
    applyDefaults(before);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('Ι11 κενές γραμμές καναλιών γεμίζουν πρώτες· προέλευση σημειώνεται και σβήνει με επεξεργασία', () => {
    const [result] = applyDefaults([hq({})]).drafts;
    expect(result.phones.map(({ number }) => number)).toEqual(['+30 231 012 3456', '+30 691 234 5678']);
    expect(result.emails).toEqual(['info@pagonis.gr']);
    expect(result.provenance).toEqual({ street: 'company-profile', phones: 'company-profile', emails: 'company-profile' });
    expect(withoutProvenance(result, 'phones').provenance).toEqual({ street: 'company-profile', emails: 'company-profile' });
  });

  it('Ι12 idempotent — δεύτερη σύγκριση μετά την εφαρμογή ⇒ 0 διαφορές', () => {
    const first = applyDefaults([]);
    expect(differenceCount(compareCardWithSource(first.drafts, first.website, SOURCE))).toBe(0);
  });

  it('Ι13 ΓΕΜΗ: η προέλευση και η ημερομηνία ελέγχου ταξιδεύουν στη γραμμή', () => {
    const registry: CompanyContactSource = {
      ...SOURCE,
      address: { ...SOURCE.address!, origin: 'business-registry', checkedAt: '2026-09-12T10:00:00.000Z' },
    };
    const row = compareCardWithSource([], '', registry).rows.find(({ field }) => field === 'street');
    expect(row).toMatchObject({ origin: 'business-registry', checkedAt: '2026-09-12T10:00:00.000Z' });
  });
});
