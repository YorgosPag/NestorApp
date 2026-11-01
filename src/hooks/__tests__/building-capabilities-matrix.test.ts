/**
 * ΑΓΚΥΡΑ — **τα κουμπιά κτιρίων και ορόφων λένε ό,τι και ο διακομιστής** (ADR-829 §7.1).
 *
 * Ο πραγματικός `useBuildingCapabilities` πάνω στον πραγματικό PEP και τον πραγματικό κριτή, απέναντι στην ΙΔΙΑ δήλωση
 * πολιτικής που κρίνει το `building-floor-role-matrix.route.test.ts`. Έτσι κουμπί και διαδρομή δεν μπορούν να αποκλίνουν
 * χωρίς να κοκκινίσει η μία από τις δύο σουίτες.
 */

import { renderHook } from '@testing-library/react';

import { ROLE_POLICY, POLICY_OPERATIONS } from '@/app/api/buildings/__tests__/building-floor-role-policy.fixture';
import { GLOBAL_ROLES } from '@/lib/auth/types';
import { useBuildingCapabilities, type BuildingCapabilities } from '../useBuildingCapabilities';

interface FakeAuth {
  user: { globalRole: string; permissions: string[] | null } | null;
  loading: boolean;
}

let mockAuthState: FakeAuth = { user: null, loading: false };

jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => mockAuthState }));

const capabilitiesOf = (auth: FakeAuth): BuildingCapabilities => {
  mockAuthState = auth;
  return renderHook(() => useBuildingCapabilities()).result.current;
};

const BUTTON_OPERATIONS = POLICY_OPERATIONS.flatMap((op) => {
  const row = ROLE_POLICY[op];
  return row.capability === null ? [] : [{ op, row, capability: row.capability }];
});

describe('ADR-829 §7.1 — τα κουμπιά ακολουθούν τη δήλωση πολιτικής', () => {
  for (const { op, row, capability } of BUTTON_OPERATIONS) {
    for (const role of GLOBAL_ROLES) {
      const verdict = row.verdicts[role];

      it(`${capability} (${op}) · ${role} ⇒ ${verdict}`, () => {
        const shown = capabilitiesOf({ user: { globalRole: role, permissions: null }, loading: false })[capability];
        expect(shown).toBe(verdict === 'allow');
      });
    }

    it(`${capability} (${op}) · internal_user με ρητό claim ⇒ φαίνεται`, () => {
      const auth = { user: { globalRole: 'internal_user', permissions: [row.permission] }, loading: false };
      expect(capabilitiesOf(auth)[capability]).toBe(true);
    });
  }

  it('κάθε κουμπί του hook έχει γραμμή στη δήλωση: νέο κουμπί δεν μένει ακρίτως', () => {
    const declared = new Set(BUTTON_OPERATIONS.map(({ capability }) => capability));
    const hookKeys = Object.keys(capabilitiesOf({ user: null, loading: false }));
    expect([...declared].sort()).toEqual(hookKeys.sort());
  });

  it('όσο φορτώνει η ταυτότητα, κανένα κουμπί δεν φαίνεται', () => {
    const capabilities = capabilitiesOf({ user: null, loading: true });
    expect(Object.values(capabilities).every((shown) => shown === false)).toBe(true);
  });
});
