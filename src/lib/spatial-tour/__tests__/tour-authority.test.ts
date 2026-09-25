/**
 * @fileoverview Άγκυρες του διανομέα εξουσίας της περιήγησης (ADR-884 Φ0.3 · Φ0.5 · Φ0.13).
 *
 * 🔑 Κάθε ομάδα δείχνει **και** τις δύο ετυμηγορίες — ένας φρουρός που λέει πάντα «ναι» (ή πάντα «όχι»)
 * πρέπει να κοκκινίζει εδώ.
 */

import { TOUR_ACCESS_STANDINGS } from '@/constants/spatial-tour-vocabulary';
import { decideCapability } from '@/lib/auth/authority';
import {
  describeOwnershipCallSites,
  PURE_VERDICT_PROBE,
  withOwner,
} from '@/lib/auth/__tests__/_harness/ownership-callsite-contract';
import {
  mayManageTour,
  mayUploadTourCapture,
  tourAccessStanding,
  tourCustodyOf,
  type TourActor,
  type TourSubjectRecord,
} from '@/lib/spatial-tour/tour-authority';
import type { TourAccessRequest, TourCaptureGrant } from '@/types/spatial-tour';

const NOW = Date.parse('2026-09-25T12:00:00.000Z');
const FUTURE = '2026-10-25T12:00:00.000Z';
const PAST = '2026-09-01T12:00:00.000Z';

const AGENCY = 'comp_agency';
const RIVAL = 'comp_rival';

const PUBLISHER = { globalRole: 'internal_user', permissions: ['listings:listings:publish'] } as const;
const NO_RIGHTS = { globalRole: 'external_user', permissions: [] } as const;

const actor = (uid: string, companyId: string | null, capability: TourActor['capability'] = NO_RIGHTS): TourActor => ({
  listing: { uid, companyId },
  capability,
});

const personal: TourSubjectRecord = { kind: 'owner-property', property: { authorUserId: 'anna', authorCompanyId: null } };
const brokered: TourSubjectRecord = { kind: 'owner-property', property: { authorUserId: 'anna', authorCompanyId: AGENCY } };
const company: TourSubjectRecord = { kind: 'company-property', property: { companyId: AGENCY } };

describe('Π — ο παρονομαστής', () => {
  it('οι δύο όψεις του κριτή ρόλων που χρησιμοποιούν τα tests είναι πράγματι «ναι» και «όχι»', () => {
    expect(decideCapability({ subject: PUBLISHER, action: 'listings:listings:publish' }).verdict).toBe('granted-by-permission');
    expect(decideCapability({ subject: NO_RIGHTS, action: 'listings:listings:publish' }).verdict).toBe('denied-insufficient');
  });
});

describe('Κ1 — ο κάτοχος ΠΑΡΑΓΕΤΑΙ από τη ρίζα', () => {
  it('ιδιώτης ⇒ προσωπικό διαμέρισμα · μεσίτης ⇒ γραφείο · εταιρεία ⇒ μισθωτής', () => {
    expect(tourCustodyOf(personal)).toEqual({ userId: 'anna' });
    expect(tourCustodyOf(brokered)).toEqual({ companyId: AGENCY });
    expect(tourCustodyOf(company)).toEqual({ companyId: AGENCY });
  });

  it('🔴 εταιρική ρίζα χωρίς μισθωτή είναι βλάβη, ΟΧΙ προσωπική', () => {
    expect(tourCustodyOf({ kind: 'company-property', property: { companyId: '' } })).toBeNull();
    expect(tourCustodyOf({ kind: 'company-property', property: {} })).toBeNull();
  });
});

describe('Κ2 — αγγελία ιδιώτη/μεσίτη: μέσω `mayPerform`', () => {
  const CASES: ReadonlyArray<readonly [string, TourSubjectRecord, TourActor, string]> = [
    ['ο ιδιοκτήτης στη δική του', personal, actor('anna', null), 'granted'],
    ['ο ιδιοκτήτης σε ανατεθειμένη (συγγραφέας)', brokered, actor('anna', null), 'granted'],
    ['ο μεσίτης του γραφείου', brokered, actor('boris', AGENCY), 'granted'],
    ['ο ανταγωνιστής', brokered, actor('carl', RIVAL, PUBLISHER), 'denied-custody'],
    ['🔴 ο μεσίτης σε ΠΡΟΣΩΠΙΚΟ ακίνητο ξένου — ακόμη και με δικαίωμα δημοσίευσης', personal, actor('boris', AGENCY, PUBLISHER), 'denied-custody'],
  ];
  for (const [label, record, who, expected] of CASES) {
    it(`${label} ⇒ ${expected}`, () => expect(mayManageTour(record, who)).toBe(expected));
  }
});

describe('Κ3 — εταιρική αγγελία: ίδιος μισθωτής ΚΑΙ δικαίωμα ρόλου', () => {
  it('μέλος με δικαίωμα δημοσίευσης ⇒ granted', () => {
    expect(mayManageTour(company, actor('boris', AGENCY, PUBLISHER))).toBe('granted');
  });
  it('μέλος χωρίς δικαίωμα ⇒ denied-capability (θεραπεία: ρόλος, όχι χώρος)', () => {
    expect(mayManageTour(company, actor('boris', AGENCY))).toBe('denied-capability');
  });
  it('🔴 ξένος μισθωτής ΜΕ δικαίωμα ⇒ denied-tenant (η μετάλλαξη «χωρίς έλεγχο μισθωτή» κοκκινίζει εδώ)', () => {
    expect(mayManageTour(company, actor('carl', RIVAL, PUBLISHER))).toBe('denied-tenant');
  });
  it('🔴 κενό δεν ταιριάζει με κενό', () => {
    const orphan: TourSubjectRecord = { kind: 'company-property', property: { companyId: '' } };
    expect(mayManageTour(orphan, actor('x', null, PUBLISHER))).toBe('denied-tenant');
  });
  it('η παράκαμψη πλατφόρμας την κρίνει ο κριτής ρόλων, όχι αυτό το αρχείο', () => {
    expect(mayManageTour(company, actor('root', null, { globalRole: 'super_admin', permissions: [] }))).toBe('granted');
  });
});

const grant = (overrides: Partial<TourCaptureGrant> = {}): TourCaptureGrant => ({
  granteeUid: 'photo',
  tourId: 'stour_1',
  scopes: ['tour:capture:upload'],
  expiresAt: FUTURE,
  revokedAt: null,
  revokedBy: null,
  createdAt: PAST,
  createdBy: 'anna',
  reason: 'λήψη πριν τη δημοσίευση',
  invitationId: null,
  ...overrides,
});

describe('Κ4 — ανέβασμα λήψης: υπεύθυνος Ή φωτογράφος με ενεργή άδεια (Φ0.5)', () => {
  const photographer = actor('photo', null);
  it('ο υπεύθυνος ανεβάζει χωρίς άδεια', () => {
    expect(mayUploadTourCapture(personal, actor('anna', null), null, NOW)).toBe('granted-as-manager');
  });
  it('ο φωτογράφος με ενεργή άδεια ανεβάζει — ΧΩΡΙΣ να γίνεται υπεύθυνος', () => {
    expect(mayUploadTourCapture(personal, photographer, grant(), NOW)).toBe('granted-by-capture-grant');
    expect(mayManageTour(personal, photographer)).toBe('denied-custody');
  });
  it.each([
    ['χωρίς άδεια', null, 'no-capture-grant'],
    ['άδεια ΑΛΛΟΥ ανθρώπου', grant({ granteeUid: 'someone-else' }), 'no-capture-grant'],
    ['ληγμένη', grant({ expiresAt: PAST }), 'expired'],
    ['ανακληθείσα', grant({ revokedAt: PAST }), 'revoked'],
    ['μόνο θέαση', grant({ scopes: ['tour:view'] }), 'scope-missing'],
  ] as const)('%s ⇒ %s', (_label, g, expected) => {
    expect(mayUploadTourCapture(personal, photographer, g, NOW)).toBe(expected);
  });
});

const request = (overrides: Partial<TourAccessRequest> = {}): TourAccessRequest => ({
  id: 'tacr_1',
  tourId: 'stour_1',
  requesterUid: 'buyer',
  message: null,
  state: 'approved',
  requestedAt: PAST,
  requestCount: 1,
  decidedAt: PAST,
  decidedBy: 'anna',
  expiresAt: FUTURE,
  revokedAt: null,
  revokedBy: null,
  ...overrides,
});

describe('Κ5 — η θέση ενός αιτήματος θέασης ΠΑΡΑΓΕΤΑΙ (Φ0.13)', () => {
  it('εγκεκριμένο εντός λήξης ⇒ active', () => expect(tourAccessStanding(request(), NOW)).toBe('active'));
  it('🔴 εγκεκριμένο ΜΕΤΑ τη λήξη ⇒ expired, χωρίς καμία εγγραφή', () => {
    expect(tourAccessStanding(request({ expiresAt: PAST }), NOW)).toBe('expired');
  });
  it('ανακληθέν ⇒ revoked (η πράξη ανθρώπου νικά τη λήξη)', () => {
    expect(tourAccessStanding(request({ revokedAt: PAST, expiresAt: PAST }), NOW)).toBe('revoked');
  });
  it('🔴 εγκεκριμένο χωρίς λήξη ⇒ unreadable, ΠΟΤΕ active', () => {
    expect(tourAccessStanding(request({ expiresAt: null }), NOW)).toBe('unreadable');
  });
  it.each(['pending', 'declined', 'withdrawn'] as const)('%s ⇒ αυτούσιο', (state) => {
    expect(tourAccessStanding(request({ state, expiresAt: null }), NOW)).toBe(state);
  });
  it('κάθε παράγωγη θέση ανήκει στο λεξιλόγιο', () => {
    const produced = [request(), request({ expiresAt: PAST }), request({ revokedAt: PAST }), request({ expiresAt: null })]
      .map((r) => tourAccessStanding(r, NOW));
    for (const standing of produced) expect(TOUR_ACCESS_STANDINGS).toContain(standing);
  });
});

// =============================================================================
// ADR-742 — ο κριτής μισθωτή της εταιρικής αγγελίας, με το ΤΡΙΠΛΟ συμβόλαιο
// =============================================================================

/**
 * 🔑 Το ζεύγος κενό/κενό (ιδιοκτήτης `''` **και** καλών `''`) κόβεται **πριν** τον SSoT από τον
 * `companyPropertyHolder` (κενό ⇒ «καμία εταιρεία» ⇒ `denied-tenant`)· το συμβόλαιο το κλειδώνει ώστε μια
 * «απλοποίηση» εκείνου του φύλακα να μην ανοίξει σιωπηλά την πόρτα (ADR-742 §7terdecies).
 */
let ownedCompanyRecord: TourSubjectRecord = company;

describeOwnershipCallSites('mayManageTour — ιδιοκτησία εταιρικής αγγελίας (ADR-742)', [
  {
    file: 'lib/spatial-tour/tour-authority.ts',
    name: 'mayManageTour (company-property)',
    arrange: (owner) => {
      ownedCompanyRecord = { kind: 'company-property', property: withOwner({}, owner) };
      return PURE_VERDICT_PROBE;
    },
    act: async (callerCompanyId) => mayManageTour(ownedCompanyRecord, actor('boris', callerCompanyId, PUBLISHER)),
    refused: (result) => result === 'denied-tenant',
  },
]);
