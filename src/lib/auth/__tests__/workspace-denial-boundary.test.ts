/**
 * @jest-environment node
 *
 * Το **σύνορο** της άρνησης χώρου — «όχι» και «δεν ξέρω» δεν βγαίνουν το ίδιο
 *
 * ⚠️ **`node`, ΟΧΙ jsdom — και είναι μέρος της ορθότητας.** Το jsdom **δεν
 * ορίζει `Request`**, οπότε η εισαγωγή του `next/server` σκάει με
 * *«Request is not defined»* — σφάλμα **περιβάλλοντος** που διαβάζεται ως
 * *«η πύλη είναι σπασμένη»* (ίδιο μάθημα με το CHECK 3.46).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (ADR-787 Κ-2 / §5.1 ε)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο απαντητής (`workspace-membership.ts`) ξεχωρίζει `not-a-member` · `suspended`
 * · `unknown`. Αν το **σύνορο** τα ισοπεδώσει σε ένα status, η διάκριση που
 * πληρώσαμε για να υπάρχει **χάνεται στο τελευταίο μέτρο**:
 *
 * - **401 σε `unknown`** ⇒ ο πελάτης νομίζει ότι έληξε η ταυτότητά του και
 *   **πετάει τον άνθρωπο έξω από τη συνεδρία** — για μια στιγμιαία αστοχία
 *   διακομιστή. Δηλαδή *«δεν ξέρω»* μεταφρασμένο σε *«δεν είσαι»* (**N.12**).
 * - **λεπτομέρεια χώρου σε `forbidden`** ⇒ η άρνηση μαρτυρά ότι ο χώρος
 *   **υπάρχει**, και η διεύθυνση γίνεται όργανο απαρίθμησης (**Ε-5 §4 #1**).
 *
 * ⚠️ Οι άγκυρες τρέχουν το **πραγματικό** `withAuth`: μόνο το
 * `buildRequestContext` είναι προσομοιωμένο, γιατί αυτό **παράγει** την αιτία.
 * Έλεγχος της ίδιας της `createUnauthorizedResponse` θα ήταν έλεγχος του κριτή
 * από τον εαυτό του — εδώ κρίνεται **τι φεύγει στο σύρμα**.
 *
 * @module lib/auth/__tests__/workspace-denial-boundary
 */

jest.mock('../auth-context', () => ({
  buildRequestContext: jest.fn(),
  isAuthenticated: (ctx: { isAuthenticated: boolean }) => ctx.isAuthenticated === true,
}));

import { withAuth } from '../middleware';
import { buildRequestContext } from '../auth-context';
import type { NextRequest } from 'next/server';

const mockBuildContext = buildRequestContext as unknown as jest.Mock;

/** Ο χειριστής δεν πρέπει να τρέξει ποτέ σε άρνηση. */
const handler = jest.fn(async () => new Response('ok') as never);

const request = {} as NextRequest;

async function denyWith(reason: string) {
  mockBuildContext.mockResolvedValue({ isAuthenticated: false, reason });
  const route = withAuth(handler);
  const response = await route(request);
  return { response, body: await response.json() };
}

beforeEach(() => {
  handler.mockClear();
  mockBuildContext.mockReset();
});

describe('Σ. Το σύνορο ξεχωρίζει «όχι» από «δεν ξέρω»', () => {
  it('Σ1 — `workspace_unavailable` ⇒ **503**, ΠΟΤΕ 401', async () => {
    const { response, body } = await denyWith('workspace_unavailable');

    // 🔴 Ένα 401 εδώ θα έλεγε «ξανασυνδέσου» για αστοχία που δεν αφορά την
    //    ταυτότητα του ανθρώπου.
    expect(response.status).toBe(503);
    expect(response.status).not.toBe(401);
    expect(body.code).toBe('WORKSPACE_UNAVAILABLE');
    expect(handler).not.toHaveBeenCalled();
  });

  it('Σ2 — `workspace_forbidden` ⇒ **403**, και ΔΕΝ μαρτυρά ύπαρξη χώρου', async () => {
    const { response, body } = await denyWith('workspace_forbidden');

    expect(response.status).toBe(403);
    expect(body.code).toBe('WORKSPACE_FORBIDDEN');
    // Το κείμενο προς τα έξω δεν λέει τίποτα για το αν ο χώρος υπάρχει.
    expect(JSON.stringify(body)).not.toMatch(/exists|υπάρχει|member of/i);
    expect(handler).not.toHaveBeenCalled();
  });

  it('Σ3 — οι δύο αιτίες ΔΕΝ βγαίνουν με το ίδιο status', async () => {
    // Μετάλλαξη που τις ενώνει (μία επιστροφή για τα δύο) κοκκινίζει εδώ.
    const unavailable = await denyWith('workspace_unavailable');
    const forbidden = await denyWith('workspace_forbidden');

    expect(unavailable.response.status).not.toBe(forbidden.response.status);
  });

  it('Σ4 — οι ΠΑΛΙΕΣ αιτίες ταυτότητας μένουν 401 (καμία παλινδρόμηση)', async () => {
    for (const reason of ['missing_token', 'invalid_token', 'missing_claims']) {
      const { response, body } = await denyWith(reason);
      expect(response.status).toBe(401);
      expect(body.code).toBe('UNAUTHORIZED');
    }
  });
});
