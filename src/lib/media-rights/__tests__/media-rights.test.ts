/**
 * ⚓ ADR-884 Φ0.14 · ADR-866 §5.6.1 — δικαιώματα μέσου: ανάγνωση (fail-closed) και ισχύς άδειας.
 */

import { MEDIA_LICENSE_TERM_KINDS } from '@/constants/media-rights-vocabulary';
import type { MediaLicenseTerm, MediaRights } from '@/types/media-rights';

import { mediaLicenseStanding } from '../media-license-standing';
import { readMediaRights } from '../media-rights-read';

const NOW = Date.parse('2026-09-25T00:00:00.000Z');
const RIGHTS: MediaRights = {
  creator: { name: 'Νίκος', userId: 'usr_1', url: null },
  licensors: [{ name: 'Γραφείο Χ', userId: null, url: 'https://x.gr' }],
  copyrightNotice: '© 2026 Νίκος',
  webStatementOfRights: null,
  license: { purpose: 'listing-marketing', term: { kind: 'mandate', mandateId: 'mand_1' } },
};
const withTerm = (term: MediaLicenseTerm): MediaRights => ({ ...RIGHTS, license: { ...RIGHTS.license, term } });

describe('mediaLicenseStanding', () => {
  it('η άδεια «όσο ισχύει η εντολή» ρωτά την εντολή — δεν αποθηκεύει ημερομηνία', () => {
    expect(mediaLicenseStanding(RIGHTS, NOW, true)).toBe('active');
    expect(mediaLicenseStanding(RIGHTS, NOW, false)).toBe('mandate-ended');
  });

  it('ημερομηνία: πριν ⇒ ενεργή, μετά ⇒ έληξε, μη αναγνώσιμη ⇒ έληξε (fail-closed)', () => {
    expect(mediaLicenseStanding(withTerm({ kind: 'date', until: '2027-01-01T00:00:00.000Z' }), NOW, false)).toBe('active');
    expect(mediaLicenseStanding(withTerm({ kind: 'date', until: '2026-01-01T00:00:00.000Z' }), NOW, true)).toBe('expired');
    expect(mediaLicenseStanding(withTerm({ kind: 'date', until: 'ποτέ' }), NOW, true)).toBe('expired');
  });

  it('κάθε είδος διάρκειας του λεξιλογίου έχει απάντηση (κανένα `undefined`)', () => {
    const samples: Record<(typeof MEDIA_LICENSE_TERM_KINDS)[number], MediaLicenseTerm> = {
      mandate: { kind: 'mandate', mandateId: 'm' },
      date: { kind: 'date', until: '2027-01-01T00:00:00.000Z' },
      perpetual: { kind: 'perpetual' },
    };
    for (const kind of MEDIA_LICENSE_TERM_KINDS) {
      expect(mediaLicenseStanding(withTerm(samples[kind]), NOW, true)).toBe('active');
    }
  });
});

describe('readMediaRights', () => {
  it('✅ διαβάζει έγκυρα δικαιώματα', () => {
    expect(readMediaRights(RIGHTS)).toEqual(RIGHTS);
  });

  it.each([
    ['χωρίς δημιουργό', { creator: null }],
    ['χωρίς δήλωση πνευματικών δικαιωμάτων', { copyrightNotice: ' ' }],
    ['τέσσερις δικαιούχοι (IPTC: έως 3)', { licensors: Array(4).fill(RIGHTS.creator) }],
    ['δικαιούχος χωρίς όνομα', { licensors: [{ name: '' }] }],
    ['άγνωστος σκοπός', { license: { purpose: 'anything', term: { kind: 'perpetual' } } }],
    ['εντολή χωρίς id', { license: { purpose: 'listing-marketing', term: { kind: 'mandate' } } }],
  ])('🔴 %s ⇒ null — εφευρημένος δικαιούχος θα ήταν ψευδής δήλωση', (_label, patch) => {
    expect(readMediaRights({ ...RIGHTS, ...patch })).toBeNull();
  });
});
