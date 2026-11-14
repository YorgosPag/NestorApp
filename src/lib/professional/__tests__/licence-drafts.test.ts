/**
 * ADR-915 §21 · §40.5 — η κατάσταση φόρμας των αδειών: από αποθηκευμένες άδειες στη φόρμα και πίσω στη δήλωση.
 */

import { formShowcaseLicences } from '@/lib/agency/showcase-licence';
import { NO_LICENCE_DRAFTS, licenceDraftsOf, licenceWireOf } from '@/lib/professional/licence-drafts';

function formed(...declared: Parameters<typeof formShowcaseLicences>[0]) {
  const result = formShowcaseLicences(declared);
  if ('reason' in result) throw new Error(`fixture rejected: ${result.reason}`);
  return result.licences;
}

const [INSPECTOR] = formed({ licence: 'energy-inspector', registrationNumber: '2600' });
const [INSTALLER] = formed({ licence: 'electrical-installer', registrationNumber: '4521', registrationChapter: 'ΠΕ Θεσσαλονίκης' });

describe('licenceDraftsOf', () => {
  it('καμία άδεια ⇒ όλες null', () => {
    expect(licenceDraftsOf([])).toEqual(NO_LICENCE_DRAFTS);
  });

  it('εθνική αρχή ⇒ κενός εκδότης · αρχή με παραρτήματα ⇒ ο εκδότης', () => {
    expect(licenceDraftsOf([INSPECTOR, INSTALLER])).toEqual({
      'energy-inspector': { number: '2600', chapter: '' },
      'electrical-installer': { number: '4521', chapter: 'ΠΕ Θεσσαλονίκης' },
    });
  });
});

describe('licenceWireOf', () => {
  it('μόνο όσες δηλώνει· εκδότης μόνο όπου η αρχή τον έχει', () => {
    const drafts = { 'energy-inspector': { number: '2600', chapter: 'αγνοείται' }, 'electrical-installer': { number: '4521', chapter: 'ΠΕ Χ' } };
    expect(licenceWireOf(drafts, [])).toEqual([
      { licence: 'energy-inspector', registrationNumber: '2600' },
      { licence: 'electrical-installer', registrationNumber: '4521', registrationChapter: 'ΠΕ Χ' },
    ]);
    expect(licenceWireOf(NO_LICENCE_DRAFTS, [])).toEqual([]);
  });

  it('άδεια που ήδη δίνεται αλλού δεν ξαναδηλώνεται', () => {
    expect(licenceWireOf({ ...NO_LICENCE_DRAFTS, 'energy-inspector': { number: '2600', chapter: '' } }, [INSPECTOR])).toEqual([]);
  });

  it('round-trip: αποθηκευμένο → φόρμα → δήλωση → ίδιο αποθηκευμένο', () => {
    expect(formShowcaseLicences(licenceWireOf(licenceDraftsOf([INSPECTOR, INSTALLER]), []))).toEqual({
      licences: [INSPECTOR, INSTALLER],
    });
  });
});
