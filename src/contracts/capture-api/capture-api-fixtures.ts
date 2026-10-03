/**
 * @fileoverview **ΤΑ ΚΟΙΝΑ ΠΑΡΑΔΕΙΓΜΑΤΑ ΤΟΥ ΣΥΜΒΟΛΑΙΟΥ** (golden fixtures) — τα ΙΔΙΑ bytes κρίνονται από τρεις κριτές.
 * @related ADR-904 Ε6 · `capture-api-schemas.ts` · `capture-api-parity.test.ts` · `contracts/capture-api/fixtures.json`
 * @module contracts/capture-api/capture-api-fixtures
 *
 * 🏆 **Πέρα από το «spec + codegen»**: ένα spec λέει τι **σχήμα** έχει ένα σώμα· δεν αποδεικνύει ότι ο διακομιστής
 * **δέχεται** ό,τι λέει. Εδώ κάθε παράδειγμα δηλώνει την ετυμηγορία του, και ελέγχεται:
 *  1. από το σχήμα zod — **ο γεννήτορας αρνείται να γράψει** fixture που διαφωνεί με το σχήμα (CHECK 3.98)·
 *  2. από τον αναγνώστη του διακομιστή (`readCaptureDeclaration`) — κάθε **έγκυρη** δήλωση του συμβολαίου γίνεται δεκτή·
 *  3. από τα tests αποκωδικοποίησης του πελάτη Kotlin — εξάγονται μαζί με το `openapi.json`.
 *
 * ⚠️ Ο δημιουργός με λογαριασμό (`creator.userId`) πρέπει να είναι ο **δράστης** — τα παραδείγματα χρησιμοποιούν
 * {@link FIXTURE_ACTOR_UID}, και ο έλεγχος ισοτιμίας περνά τον ίδιο δράστη στον αναγνώστη.
 *
 * **Layering**: leaf — μόνο δεδομένα.
 */

/** Ο δράστης των παραδειγμάτων — ο αναγνώστης του διακομιστή δέχεται `creator.userId` μόνο αν είναι αυτός. */
export const FIXTURE_ACTOR_UID = 'fixture-actor-uid';

export interface CaptureApiFixture {
  /** Μοναδικό, σταθερό — γίνεται όνομα test και στον Kotlin. */
  readonly name: string;
  /** Το όνομα του σχήματος στο `components.schemas`. */
  readonly component: string;
  readonly valid: boolean;
  readonly body: unknown;
}

const RIGHTS = {
  creator: { name: 'Νίκος Παπαδόπουλος', userId: FIXTURE_ACTOR_UID, url: null },
  licensors: [],
  copyrightNotice: '© 2026 Νίκος Παπαδόπουλος',
  webStatementOfRights: null,
  license: { purpose: 'listing-marketing', term: { kind: 'perpetual' } },
} as const;

const DECLARATION = {
  source: 'camera-360',
  audience: 'public-listing',
  milestone: null,
  rights: RIGHTS,
  originalFilename: 'R0010042.JPG',
} as const;

const declaration = (overrides: Readonly<Record<string, unknown>>) => ({ ...DECLARATION, ...overrides });
const rights = (overrides: Readonly<Record<string, unknown>>) => declaration({ rights: { ...RIGHTS, ...overrides } });
const party = (name: string) => ({ name, userId: null, url: null });

const DECLARATION_FIXTURES: readonly CaptureApiFixture[] = [
  { name: 'declaration-camera-perpetual', component: 'CaptureDeclaration', valid: true, body: DECLARATION },
  { name: 'declaration-phone-milestone', component: 'CaptureDeclaration', valid: true, body: declaration({ source: 'phone', audience: 'project-team', milestone: 'finishes' }) },
  { name: 'declaration-external-photographer', component: 'CaptureDeclaration', valid: true, body: rights({ creator: party('Studio 360 ΙΚΕ'), licensors: [party('Μεσιτικό Γραφείο Α')] }) },
  { name: 'declaration-term-mandate', component: 'CaptureDeclaration', valid: true, body: rights({ license: { purpose: 'owner-reuse', term: { kind: 'mandate', mandateId: 'mnd_01' } } }) },
  { name: 'declaration-term-date', component: 'CaptureDeclaration', valid: true, body: rights({ license: { purpose: 'unrestricted', term: { kind: 'date', until: '2027-12-31T00:00:00.000Z' } } }) },
  { name: 'declaration-no-filename', component: 'CaptureDeclaration', valid: true, body: declaration({ originalFilename: null }) },
  { name: 'declaration-bim-render-source', component: 'CaptureDeclaration', valid: false, body: declaration({ source: 'bim-render' }) },
  { name: 'declaration-unknown-audience', component: 'CaptureDeclaration', valid: false, body: declaration({ audience: 'everyone' }) },
  { name: 'declaration-unknown-milestone', component: 'CaptureDeclaration', valid: false, body: declaration({ milestone: 'roof' }) },
  { name: 'declaration-blank-copyright', component: 'CaptureDeclaration', valid: false, body: rights({ copyrightNotice: '   ' }) },
  { name: 'declaration-too-many-licensors', component: 'CaptureDeclaration', valid: false, body: rights({ licensors: [party('A'), party('B'), party('C'), party('D')] }) },
  { name: 'declaration-term-date-not-iso', component: 'CaptureDeclaration', valid: false, body: rights({ license: { purpose: 'unrestricted', term: { kind: 'date', until: 'next year' } } }) },
  { name: 'declaration-term-unknown-kind', component: 'CaptureDeclaration', valid: false, body: rights({ license: { purpose: 'unrestricted', term: { kind: 'forever' } } }) },
  { name: 'declaration-missing-rights', component: 'CaptureDeclaration', valid: false, body: declaration({ rights: undefined }) },
];

const REQUEST_FIXTURES: readonly CaptureApiFixture[] = [
  { name: 'start-jpeg-8k', component: 'StartUploadBody', valid: true, body: { contentType: 'image/jpeg', contentLength: 15_728_640 } },
  { name: 'start-zero-length', component: 'StartUploadBody', valid: false, body: { contentType: 'image/jpeg', contentLength: 0 } },
  { name: 'start-fractional-length', component: 'StartUploadBody', valid: false, body: { contentType: 'image/jpeg', contentLength: 1.5 } },
  { name: 'finalize-complete', component: 'FinalizeBody', valid: true, body: { ticket: 'v1.eyJ1cGxvYWRJZCI6InR1cGxfMDEifQ.c2ln', declaration: DECLARATION } },
  { name: 'finalize-short-ticket', component: 'FinalizeBody', valid: false, body: { ticket: 'short', declaration: DECLARATION } },
  { name: 'redeem-accept', component: 'InvitationRedeemBody', valid: true, body: { token: 'tinv_0123456789abcdef', action: 'accept' } },
  { name: 'redeem-implicit-action', component: 'InvitationRedeemBody', valid: false, body: { token: 'tinv_0123456789abcdef' } },
];

const RESPONSE_FIXTURES: readonly CaptureApiFixture[] = [
  {
    name: 'start-response', component: 'StartUploadResponse', valid: true,
    body: { uploadId: 'tupl_01', ticket: 'v1.eyJ1cGxvYWRJZCI6InR1cGxfMDEifQ.c2ln', sessionUri: 'https://storage.googleapis.com/upload/storage/v1/b/bucket/o?uploadType=resumable&upload_id=XYZ', expiresAt: '2026-10-03T18:00:00.000Z' },
  },
  {
    name: 'finalize-response-with-extra-fields', component: 'FinalizeResponse', valid: true,
    body: {
      replayed: false,
      capture: {
        id: 'tcap_01', tourId: 'tour_01', nodeId: null, capturedAt: '2026-10-03T12:00:00.000Z', source: 'camera-360',
        audience: 'public-listing', milestone: null, tileset: { state: 'pending', contentHash: null }, createdAt: '2026-10-03T12:05:00.000Z',
        headingRad: 0, provenance: 'as-built', uploadedBy: FIXTURE_ACTOR_UID,
      },
    },
  },
  { name: 'refused-not-equirect', component: 'TourRefusedBody', valid: true, body: { error: 'TOUR_REFUSED', reason: 'not-equirect' } },
  { name: 'refused-unknown-reason', component: 'TourRefusedBody', valid: false, body: { error: 'TOUR_REFUSED', reason: 'drop-table' } },
  { name: 'link-refused-wrong-recipient', component: 'InvitationLinkRefusedBody', valid: true, body: { error: 'LINK_REFUSED', reason: 'wrong-recipient' } },
];

/** «Τα ακίνητά μου» (ADR-904 Κ7, 1.1.0) — υπεύθυνος, φωτογράφος με ενεργή **και** με ληγμένη άδεια, σελίδα και τέλος. */
const MANAGED_TARGET = { subject: { kind: 'owner-property', id: 'oprop_01' }, label: 'Μεζονέτα στην Κηφισιά', access: { kind: 'manager' } } as const;
const GRANT_ACCESS = { kind: 'capture-grant', standing: 'active', expiresAt: '2026-10-10T00:00:00.000Z', reason: 'Λήψη σαλονιού και κουζίνας' } as const;
const GRANTED_TARGET = { subject: { kind: 'company-property', id: 'prop_07' }, label: null, access: GRANT_ACCESS } as const;
const grantTarget = (access: Readonly<Record<string, unknown>>) => ({ ...GRANTED_TARGET, access: { ...GRANT_ACCESS, ...access } });

const TARGET_FIXTURES: readonly CaptureApiFixture[] = [
  { name: 'targets-page-with-next', component: 'CaptureTargetsResponse', valid: true, body: { targets: [GRANTED_TARGET, MANAGED_TARGET], nextPageToken: 'eyJzIjoib3duIiwiYSI6Im9wcm9wXzAxIn0' } },
  { name: 'targets-last-page', component: 'CaptureTargetsResponse', valid: true, body: { targets: [], nextPageToken: '' } },
  { name: 'target-grant-expired', component: 'CaptureTarget', valid: true, body: grantTarget({ standing: 'expired', expiresAt: '2026-09-01T00:00:00.000Z' }) },
  { name: 'target-manager-extra-fields', component: 'CaptureTarget', valid: true, body: { ...MANAGED_TARGET, tourId: 'tour_01' } },
  { name: 'target-unknown-kind', component: 'CaptureTarget', valid: false, body: { ...MANAGED_TARGET, subject: { kind: 'building', id: 'b_01' } } },
  { name: 'target-unknown-access', component: 'CaptureTarget', valid: false, body: { ...MANAGED_TARGET, access: { kind: 'viewer' } } },
  { name: 'target-grant-unknown-standing', component: 'CaptureTarget', valid: false, body: grantTarget({ standing: 'pending' }) },
  { name: 'target-grant-missing-expiry', component: 'CaptureTarget', valid: false, body: grantTarget({ expiresAt: undefined }) },
  { name: 'targets-missing-next-token', component: 'CaptureTargetsResponse', valid: false, body: { targets: [] } },
  { name: 'malformed-page-token', component: 'MalformedQueryBody', valid: true, body: { error: 'MALFORMED_QUERY', malformed: ['pageToken'] } },
];

/** **Όλα τα παραδείγματα**, σε σταθερή σειρά — η σειρά είναι μέρος του παραγόμενου αρχείου. */
export const CAPTURE_API_FIXTURES: readonly CaptureApiFixture[] = [
  ...DECLARATION_FIXTURES,
  ...REQUEST_FIXTURES,
  ...RESPONSE_FIXTURES,
  ...TARGET_FIXTURES,
];
