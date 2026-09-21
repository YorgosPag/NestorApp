/**
 * @fileoverview **ΑΓΚΥΡΕΣ: «ΧΡΕΙΑΖΕΤΑΙ ΟΡΓΑΝΙΣΜΟ ΑΥΤΗ Η ΑΝΑΓΝΩΣΗ;»** (2026-09-21)
 * @related services/firestore/auth-context · services/firestore/firestore-query.service
 *
 * 🔴 Η ζωντανή βλάβη: ο αυτόνομος (ADR-809) και κάθε άνθρωπος στο `/o/me` έβλεπαν
 * `[UserNotificationSettingsService] Subscription error … MissingTenantError`, και το
 * καμπανάκι του έμενε **σιωπηλά άδειο** — γιατί η ΜΙΑ πύλη του `firestoreQueryService`
 * ζητούσε οργανισμό **πριν** κοιτάξει ότι η συλλογή ανήκει σε **άνθρωπο** (`mode: 'userId'`).
 * Οι κανόνες το επέτρεπαν (`request.auth.uid`)· ο πελάτης όχι.
 *
 * Κ1-Κ3: η απαίτηση στο `auth-context`. Ποια απαίτηση επιλέγει το service ανά συλλογή:
 * `firestore-query-context.test.ts` (χρειάζεται ΑΛΛΟ mock του ίδιου module).
 */

// ---------------------------------------------------------------------------
// Κ1-Κ3 — auth-context, με πραγματική υλοποίηση και ψεύτικο Firebase Auth
// ---------------------------------------------------------------------------

let mockClaims: Record<string, unknown> = {};

jest.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: {
      uid: 'u1',
      getIdTokenResult: async () => ({ claims: mockClaims }),
    },
  },
  waitForAuthReady: jest.fn(async () => true),
}));

jest.mock('../super-admin-active-company', () => ({
  getClientWorkspaceScope: () => ({ url: null, switcher: null }),
  requestedWorkspace: () => ({ kind: 'default' }),
}));

import { isMissingTenantError, requireAuthContext, requireUserContext } from '../auth-context';

describe('auth-context — δύο απαιτήσεις, μία υλοποίηση', () => {
  beforeEach(() => { mockClaims = {}; });

  it('Κ1: χωρίς εταιρεία, η απαίτηση οργανισμού ρίχνει MissingTenantError (σχεδιασμένη κατάσταση)', async () => {
    const error = await requireAuthContext().then(() => null, (e: unknown) => e);
    expect(isMissingTenantError(error)).toBe(true);
  });

  it('Κ2: χωρίς εταιρεία, η απαίτηση ανθρώπου επιστρέφει την ταυτότητα με companyId null', async () => {
    await expect(requireUserContext()).resolves.toEqual({
      uid: 'u1',
      companyId: null,
      isSuperAdmin: false,
      requested: { kind: 'default' },
    });
  });

  it('Κ3: με εταιρεία, οι δύο απαιτήσεις δίνουν ΤΗΝ ΙΔΙΑ ταυτότητα', async () => {
    mockClaims = { companyId: 'comp_a' };
    await expect(requireUserContext()).resolves.toEqual(await requireAuthContext());
  });
});
