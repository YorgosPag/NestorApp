/**
 * ΑΓΚΥΡΑ — **τα κουμπιά κτιρίων και ορόφων λένε ό,τι και ο διακομιστής** (ADR-829 §7.1).
 *
 * Ο πραγματικός `useBuildingCapabilities` πάνω στον πραγματικό PEP και τον πραγματικό κριτή, απέναντι στην ΙΔΙΑ δήλωση
 * πολιτικής που κρίνει το `building-floor-role-matrix.route.test.ts`. Έτσι κουμπί και διαδρομή δεν μπορούν να αποκλίνουν
 * χωρίς να κοκκινίσει η μία από τις δύο σουίτες.
 */

import { renderHook, waitFor } from '@testing-library/react';

import { ROLE_POLICY, POLICY_OPERATIONS } from '@/app/api/buildings/__tests__/building-floor-role-policy.fixture';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { PROJECT_SCOPED_ACTIONS } from '@/lib/auth/project-scoped-actions';
import { GLOBAL_ROLES } from '@/lib/auth/types';
import { useBuildingCapabilities, type BuildingCapabilities } from '../useBuildingCapabilities';

interface FakeAuth {
  user: { globalRole: string; permissions: string[] | null } | null;
  loading: boolean;
}

let mockAuthState: FakeAuth = { user: null, loading: false };

jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => mockAuthState }));
jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

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

describe('ADR-926 Κ7 — η απάντηση του διακομιστή για το έργο', () => {
  const INTERNAL: FakeAuth = { user: { globalRole: 'internal_user', permissions: null }, loading: false };
  const NOTHING = Object.fromEntries(PROJECT_SCOPED_ACTIONS.map((action) => [action, false]));

  const inProject = (projectId: string | null) => {
    mockAuthState = INTERNAL;
    return renderHook(({ id }) => useBuildingCapabilities(id), { initialProps: { id: projectId } });
  };

  beforeEach(() => (apiClient.get as jest.Mock).mockReset());

  it('ο PM βλέπει τα κουμπιά δομής στο έργο του, όχι τη διαγραφή ορόφου', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      viewerCapabilities: { ...NOTHING, 'buildings:buildings:update': true, 'projects:floors:create': true },
    });
    const { result } = inProject('prj_a');

    await waitFor(() => expect(result.current.canUpdateBuilding).toBe(true));
    expect(result.current.canCreateFloor).toBe(true);
    expect(result.current.canDeleteBuilding).toBe(false);
    expect(result.current.canDeleteFloor).toBe(false);
  });

  it('χωρίς έργο δεν γίνεται αίτημα, και κρίνει μόνο η εταιρεία', () => {
    const { result } = inProject(null);

    expect(apiClient.get).not.toHaveBeenCalled();
    expect(result.current.canUpdateBuilding).toBe(false);
  });

  it('αποτυχία του διακομιστή ⇒ κανένα επιπλέον κουμπί', async () => {
    (apiClient.get as jest.Mock).mockRejectedValue(new Error('503'));
    const { result } = inProject('prj_a');

    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(result.current.canUpdateBuilding).toBe(false);
  });

  it('η απάντηση του έργου Α δεν ισχύει όταν ο άνθρωπος περάσει στο έργο Β', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ viewerCapabilities: { ...NOTHING, 'buildings:buildings:update': true } });
    (apiClient.get as jest.Mock).mockReturnValueOnce(new Promise(() => undefined));
    const { result, rerender } = inProject('prj_a');
    await waitFor(() => expect(result.current.canUpdateBuilding).toBe(true));

    rerender({ id: 'prj_b' });

    expect(result.current.canUpdateBuilding).toBe(false);
  });
});
