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

/** Η πρόταση θέσης (ADR-904 Κ8, 1.2.0) — όροφος BIM · νέος τοπικός (και υπόγειο) · ενιαίος χώρος · μόνο χώρος. */
const hinted = (placementHint: unknown) => declaration({ placementHint });
const FLOOR_KEY = { kind: 'floor', floorId: 'flr_01' } as const;
const ROOM_HINT = { types: ['kitchen', 'living-room'], label: null } as const;
/** 1.3.0 (Κ9): η βαθμονομημένη κάτοψη του ισογείου και το σημείο πάνω της (pixel της πρωτότυπης εικόνας). */
const PLAN_HASH = '9f2c4e6a8b0d1f3e5a7c9b1d3f5e7a9c1b3d5f7e9a1c3b5d7f9e1a3c5b7d9f1e';
const CALIBRATED_PLAN = { image: { width: 3000, height: 2000, contentHash: PLAN_HASH }, metresPerPixel: 0.01 } as const;
const HINT_POINT = { planContentHash: PLAN_HASH, x: 1240.5, y: 860, radiusPx: 35 } as const;
const GROUND = { kind: 'local', ordinal: 0 } as const;
const point = (overrides: Readonly<Record<string, unknown>>) => hinted({ level: GROUND, point: { ...HINT_POINT, ...overrides } });

const PLACEMENT_HINT_FIXTURES: readonly CaptureApiFixture[] = [
  { name: 'hint-floor-and-open-plan-room', component: 'CaptureDeclaration', valid: true, body: hinted({ level: FLOOR_KEY, room: ROOM_HINT }) },
  { name: 'hint-new-local-basement', component: 'CaptureDeclaration', valid: true, body: hinted({ level: { kind: 'local', ordinal: -1 } }) },
  { name: 'hint-room-with-label', component: 'CaptureDeclaration', valid: true, body: hinted({ room: { types: ['office'], label: 'Γραφείο μηχανικού' } }) },
  { name: 'hint-four-room-types', component: 'CaptureDeclaration', valid: false, body: hinted({ room: { ...ROOM_HINT, types: ['kitchen', 'living-room', 'dining-room', 'hallway'] } }) },
  { name: 'hint-unknown-room-type', component: 'CaptureDeclaration', valid: false, body: hinted({ room: { ...ROOM_HINT, types: ['ballroom'] } }) },
  { name: 'hint-no-room-types', component: 'CaptureDeclaration', valid: false, body: hinted({ room: { ...ROOM_HINT, types: [] } }) },
  { name: 'hint-room-label-too-long', component: 'CaptureDeclaration', valid: false, body: hinted({ room: { ...ROOM_HINT, label: 'Α'.repeat(61) } }) },
  { name: 'hint-unknown-level-kind', component: 'CaptureDeclaration', valid: false, body: hinted({ level: { kind: 'storey', ordinal: 1 } }) },
  { name: 'hint-fractional-ordinal', component: 'CaptureDeclaration', valid: false, body: hinted({ level: { kind: 'local', ordinal: 1.5 } }) },
  { name: 'hint-blank-floor-id', component: 'CaptureDeclaration', valid: false, body: hinted({ level: { kind: 'floor', floorId: '  ' } }) },
  { name: 'hint-point-on-plan', component: 'CaptureDeclaration', valid: true, body: hinted({ level: GROUND, room: ROOM_HINT, point: HINT_POINT }) },
  { name: 'hint-point-without-radius', component: 'CaptureDeclaration', valid: true, body: point({ radiusPx: undefined }) },
  { name: 'hint-point-without-level', component: 'CaptureDeclaration', valid: false, body: hinted({ point: HINT_POINT }) },
  { name: 'hint-point-negative-x', component: 'CaptureDeclaration', valid: false, body: point({ x: -1 }) },
  { name: 'hint-point-huge-y', component: 'CaptureDeclaration', valid: false, body: point({ y: 100_001 }) },
  { name: 'hint-point-blank-plan-hash', component: 'CaptureDeclaration', valid: false, body: point({ planContentHash: ' ' }) },
  { name: 'hint-point-missing-plan-hash', component: 'CaptureDeclaration', valid: false, body: point({ planContentHash: undefined }) },
  { name: 'hint-point-zero-radius', component: 'CaptureDeclaration', valid: false, body: point({ radiusPx: 0 }) },
];

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
  ...PLACEMENT_HINT_FIXTURES,
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
  {
    name: 'finalize-response-with-placement-hint', component: 'FinalizeResponse', valid: true,
    body: {
      replayed: true,
      capture: {
        id: 'tcap_02', tourId: 'tour_01', nodeId: null, capturedAt: '2026-10-03T12:00:00.000Z', source: 'phone', audience: 'project-team',
        milestone: null, tileset: { state: 'ready' }, placementHint: { level: FLOOR_KEY, room: ROOM_HINT }, createdAt: '2026-10-03T12:05:00.000Z',
      },
    },
  },
  {
    name: 'finalize-response-with-hint-point', component: 'FinalizeResponse', valid: true,
    body: {
      replayed: false,
      capture: {
        id: 'tcap_03', tourId: 'tour_01', nodeId: null, capturedAt: '2026-10-03T12:00:00.000Z', source: 'camera-360', audience: 'public-listing',
        milestone: null, tileset: { state: 'pending' }, placementHint: { level: GROUND, point: HINT_POINT }, createdAt: '2026-10-03T12:05:00.000Z',
      },
    },
  },
  { name: 'refused-not-equirect', component: 'TourRefusedBody', valid: true, body: { error: 'TOUR_REFUSED', reason: 'not-equirect' } },
  { name: 'refused-unknown-reason', component: 'TourRefusedBody', valid: false, body: { error: 'TOUR_REFUSED', reason: 'drop-table' } },
  { name: 'link-refused-wrong-recipient', component: 'InvitationLinkRefusedBody', valid: true, body: { error: 'LINK_REFUSED', reason: 'wrong-recipient' } },
];

/** «Τα ακίνητά μου» (ADR-904 Κ7, 1.1.0) — υπεύθυνος, φωτογράφος με ενεργή **και** με ληγμένη άδεια, σελίδα και τέλος. */
/** 1.2.0 (Κ8): οι όροφοι — μεζονέτα χωρίς BIM (ισόγειο + 1ος) · εταιρική μονάδα με όροφο BIM. 1.3.0 (Κ9): κάτοψη μόνο στο ισόγειο. */
const MAISONETTE_LEVELS = [
  { key: GROUND, ordinal: 0, label: null, calibratedPlan: CALIBRATED_PLAN },
  { key: { kind: 'local', ordinal: 1 }, ordinal: 1, label: null, calibratedPlan: null },
] as const;
const maisonetteGround = (overrides: Readonly<Record<string, unknown>>) => ({ ...MANAGED_TARGET, levels: [{ ...MAISONETTE_LEVELS[0], ...overrides }] });
const MANAGED_TARGET = {
  subject: { kind: 'owner-property', id: 'oprop_01' }, label: 'Μεζονέτα στην Κηφισιά', access: { kind: 'manager' }, levels: MAISONETTE_LEVELS,
} as const;
const GRANT_ACCESS = { kind: 'capture-grant', standing: 'active', expiresAt: '2026-10-10T00:00:00.000Z', reason: 'Λήψη σαλονιού και κουζίνας' } as const;
const GRANTED_TARGET = {
  subject: { kind: 'company-property', id: 'prop_07' }, label: null, access: GRANT_ACCESS, levels: [{ key: FLOOR_KEY, ordinal: 0, label: null, calibratedPlan: null }],
} as const;
const grantTarget = (access: Readonly<Record<string, unknown>>) => ({ ...GRANTED_TARGET, access: { ...GRANT_ACCESS, ...access }, levels: [] });

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
  { name: 'target-missing-levels', component: 'CaptureTarget', valid: false, body: { ...MANAGED_TARGET, levels: undefined } },
  { name: 'target-level-unknown-kind', component: 'CaptureTarget', valid: false, body: { ...MANAGED_TARGET, levels: [{ key: { kind: 'storey' }, ordinal: 0, label: null }] } },
  { name: 'malformed-page-token', component: 'MalformedQueryBody', valid: true, body: { error: 'MALFORMED_QUERY', malformed: ['pageToken'] } },
  { name: 'target-level-missing-calibrated-plan', component: 'CaptureTarget', valid: false, body: maisonetteGround({ calibratedPlan: undefined }) },
  { name: 'target-level-plan-zero-scale', component: 'CaptureTarget', valid: false, body: maisonetteGround({ calibratedPlan: { ...CALIBRATED_PLAN, metresPerPixel: 0 } }) },
  { name: 'target-level-plan-fractional-width', component: 'CaptureTarget', valid: false, body: maisonetteGround({ calibratedPlan: { ...CALIBRATED_PLAN, image: { ...CALIBRATED_PLAN.image, width: 10.5 } } }) },
  { name: 'refused-plan-absent', component: 'TourRefusedBody', valid: true, body: { error: 'TOUR_REFUSED', reason: 'plan-absent' } },
];

/** **Όλα τα παραδείγματα**, σε σταθερή σειρά — η σειρά είναι μέρος του παραγόμενου αρχείου. */
export const CAPTURE_API_FIXTURES: readonly CaptureApiFixture[] = [
  ...DECLARATION_FIXTURES,
  ...REQUEST_FIXTURES,
  ...RESPONSE_FIXTURES,
  ...TARGET_FIXTURES,
];
