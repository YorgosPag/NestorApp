/**
 * ADR-742 Φάση Β — το σύνορο αποκάλυψης των routes υποβάθρου.
 *
 * ΤΡΙΑ πράγματα φυλάει αυτό το αρχείο, και τα τρία είναι **αόρατα** σε
 * λειτουργικό έλεγχο (η οθόνη δείχνει κάτι λογικό σε κάθε περίπτωση):
 *
 * 1. Το μεταμφιεσμένο 404 είναι **ίσο** με το γνήσιο — αλλιώς το κείμενο γίνεται
 *    μαντείο ύπαρξης και η σιωπή δεν κρύβει τίποτα.
 * 2. Το «κλειδωμένο» **δεν** μεταμφιέζεται. Μέχρι το ADR-742 έμπαινε στον ίδιο
 *    κλάδο με το cross-tenant (`msg.includes('Cross-tenant') || msg.includes('locked')`)
 *    και έβγαινε κι αυτό `409 FORBIDDEN`. Είναι το **αντίθετο**: μαρτυρά ότι ο
 *    πόρος υπάρχει *και σου ανήκει* — πληροφορία που ο χρήστης δικαιούται.
 * 3. Κάθε διαδρομή δίνει **το δικό της** «δεν βρέθηκε» και το ίδιο callback
 *    εξυπηρετεί γνήσιο και μεταμφιεσμένο· έτσι η ταυτότητα είναι **δομική**.
 *
 * @see ADR-742 §3.3 · §3.4
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body,
    }),
  },
}));

import {
  backgroundErrorResponse,
  backgroundNotFoundResponse,
} from '../_background-error-response';
import {
  BackgroundLockedError,
  BackgroundNotFoundError,
} from '@/services/floorplan-background/background-ownership';
import { CrossTenantAccessError } from '@/lib/auth/tenant-ownership';

const BG_ID = 'bg_01K9ZQ7X8N4M2P';
const CALLER_COMPANY = 'comp_kalonta';
const OWNER_COMPANY = 'comp_allou';

const NORMAL_USER = { globalRole: 'internal_user' } as const;
const SUPER_ADMIN = { globalRole: 'super_admin' } as const;

/** Ό,τι ρίχνει η υπηρεσία όταν το υπόβαθρο ανήκει σε άλλον πελάτη. */
const crossTenant = () =>
  new CrossTenantAccessError({
    message: 'Cross-tenant patch denied',
    name: 'FloorplanBackgroundCrossTenantError',
    resource: 'Floorplan background',
    resourceId: BG_ID,
    expectedCompanyId: CALLER_COMPANY,
    actualCompanyId: OWNER_COMPANY,
  });

/** Το τυπικό «δεν βρέθηκε» των PATCH / calibrate. */
const standardNotFound = () => backgroundNotFoundResponse(BG_ID);

describe('ADR-742 §3.4 — μεταμφιεσμένο 404 για υπόβαθρα', () => {
  it('🔴 είναι ΙΣΟ με το γνήσιο «δεν βρέθηκε»', () => {
    const foreign = backgroundErrorResponse({
      err: crossTenant(),
      ctx: NORMAL_USER,
      notFound: standardNotFound,
    });
    const missing = backgroundErrorResponse({
      err: new BackgroundNotFoundError(BG_ID),
      ctx: NORMAL_USER,
      notFound: standardNotFound,
    });

    expect(foreign).toEqual(missing);
    expect(foreign).toEqual({
      status: 404,
      body: { error: `Background not found: ${BG_ID}`, code: 'NOT_FOUND' },
    });
  });

  it('δεν μαρτυρά τίποτα για την πραγματική εταιρεία-ιδιοκτήτη', () => {
    const res = backgroundErrorResponse({
      err: crossTenant(),
      ctx: NORMAL_USER,
      notFound: standardNotFound,
    });

    expect(JSON.stringify(res)).not.toContain(OWNER_COMPANY);
    expect(JSON.stringify(res)).not.toContain('Cross-tenant');
    expect(JSON.stringify(res)).not.toContain('FORBIDDEN');
  });

  it('σέβεται το ΔΙΚΟ ΤΗΣ «δεν βρέθηκε» κάθε διαδρομή — π.χ. το σχήμα του DELETE', () => {
    // Το DELETE απαντά `{ deleted: false }`, όχι `{ error, code }`. Η μεταμφίεση
    // πρέπει να ακολουθεί **αυτό**, αλλιώς το σχήμα και μόνο προδίδει τη διαφορά.
    const deleteNotFound = () => ({ status: 404, body: { deleted: false } });

    const foreign = backgroundErrorResponse({
      err: crossTenant(),
      ctx: NORMAL_USER,
      notFound: deleteNotFound,
    });

    expect(foreign).toEqual(deleteNotFound());
  });
});

describe('ADR-742 §3.3 — η εξαίρεση του bypass ρόλου', () => {
  it('ο super-admin παίρνει ειλικρινές 403 με τη διάγνωση', () => {
    const res = backgroundErrorResponse({
      err: crossTenant(),
      ctx: SUPER_ADMIN,
      notFound: standardNotFound,
    });

    expect(res).toEqual({
      status: 403,
      body: { error: 'Cross-tenant patch denied', code: 'FORBIDDEN' },
    });
  });

  it('οι δύο ρόλοι παίρνουν ΔΙΑΦΟΡΕΤΙΚΗ απάντηση για το ίδιο σφάλμα', () => {
    const asAdmin = backgroundErrorResponse({
      err: crossTenant(),
      ctx: SUPER_ADMIN,
      notFound: standardNotFound,
    });
    const asUser = backgroundErrorResponse({
      err: crossTenant(),
      ctx: NORMAL_USER,
      notFound: standardNotFound,
    });

    expect(asAdmin).not.toEqual(asUser);
  });
});

describe('🔴 το «κλειδωμένο» ΔΕΝ είναι cross-tenant', () => {
  it('βγαίνει ως 409 LOCKED — και στους ΔΥΟ ρόλους το ίδιο', () => {
    const err = new BackgroundLockedError(BG_ID);

    const asUser = backgroundErrorResponse({
      err,
      ctx: NORMAL_USER,
      notFound: standardNotFound,
    });

    expect(asUser).toEqual({
      status: 409,
      body: { error: 'Background is locked', code: 'LOCKED' },
    });
    expect(
      backgroundErrorResponse({ err, ctx: SUPER_ADMIN, notFound: standardNotFound }),
    ).toEqual(asUser);
  });

  it('ΔΕΝ μεταμφιέζεται σε 404 — ο πόρος υπάρχει και σου ανήκει', () => {
    const locked = backgroundErrorResponse({
      err: new BackgroundLockedError(BG_ID),
      ctx: NORMAL_USER,
      notFound: standardNotFound,
    });

    expect(locked).not.toEqual(standardNotFound());
    expect(locked?.status).not.toBe(404);
  });
});

describe('τα ξένα σφάλματα δεν τα διεκδικεί', () => {
  it('άγνωστο σφάλμα → null, ώστε το route να κρατήσει το δικό του σχήμα 500', () => {
    expect(
      backgroundErrorResponse({
        err: new Error('firestore exploded'),
        ctx: NORMAL_USER,
        notFound: standardNotFound,
      }),
    ).toBeNull();
  });

  it('μη-Error τιμή → null', () => {
    expect(
      backgroundErrorResponse({ err: 'κάτι', ctx: NORMAL_USER, notFound: standardNotFound }),
    ).toBeNull();
  });
});
