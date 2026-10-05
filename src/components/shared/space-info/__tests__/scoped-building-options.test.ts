/**
 * ADR-898 §21.6 Ε6-α/β — **ο ΕΝΑΣ φορτωτής επιλογών κτιρίου** (θέση · αποθήκη · μονάδα): φιλτράρει με τον κανόνα του
 * έργου και **πετά** όταν μια ανάγνωση αποτύχει. Οι δύο υπηρεσίες τρέχουν αληθινές πάνω σε ψεύτικο `apiClient` — το
 * `catch { return [] }` που έκανε την αποτυχία «άδεια λίστα» ζούσε **μέσα** τους.
 */

const mockGet = jest.fn<Promise<unknown>, [string]>();
jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: (url: string) => mockGet(url) },
  ApiClientError: { isApiClientError: () => false },
}));
jest.mock('@/services/realtime', () => ({ RealtimeService: { dispatch: jest.fn() } }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { API_ROUTES } from '@/config/domain-constants';

import { loadScopedBuildingOptions } from '../scoped-building-options';

const LABELS = { noProjectGroup: 'Χωρίς έργο', locale: 'el' };
const BUILDINGS = [
  { id: 'a1', name: 'Κτήριο Α', projectId: 'prj_1' },
  { id: 'a2', name: 'Κτήριο Α', projectId: 'prj_2' },
  { id: 'b1', name: 'Κτήριο Β', projectId: 'prj_1' },
];
const PROJECTS = [{ id: 'prj_1', name: 'ΕΡΓΟ Α' }, { id: 'prj_2', name: 'ΕΡΓΟ Β' }];

function answer(routes: Record<string, unknown>) {
  mockGet.mockImplementation(async (url) => {
    const body = routes[url];
    if (body instanceof Error) throw body;
    return body;
  });
}

beforeEach(() => mockGet.mockReset());

describe('loadScopedBuildingOptions', () => {
  it('στοιχείο ΜΕ έργο ⇒ μόνο τα κτίρια του έργου του, χωρίς δεύτερη ανάγνωση', async () => {
    answer({ [API_ROUTES.BUILDINGS.LIST]: { buildings: BUILDINGS } });
    const options = await loadScopedBuildingOptions({ projectId: 'prj_1', buildingId: 'a1' }, LABELS);
    expect(options.map((option) => option.id)).toEqual(['a1', 'b1']);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('μονάδα χωρίς κτίριο αλλά ΜΕ έργο («Not Placed») ⇒ πάλι μόνο του έργου της', async () => {
    answer({ [API_ROUTES.BUILDINGS.LIST]: { buildings: BUILDINGS } });
    const options = await loadScopedBuildingOptions({ projectId: 'prj_2', buildingId: null }, LABELS);
    expect(options.map((option) => option.id)).toEqual(['a2']);
  });

  it('στοιχείο ΧΩΡΙΣ έργο ⇒ όλα, με το έργο τους ως ομάδα', async () => {
    answer({ [API_ROUTES.BUILDINGS.LIST]: { buildings: BUILDINGS }, [API_ROUTES.PROJECTS.LIST]: { projects: PROJECTS } });
    const options = await loadScopedBuildingOptions({}, LABELS);
    expect(options).toEqual([
      { id: 'a1', name: 'Κτήριο Α', group: 'ΕΡΓΟ Α' },
      { id: 'b1', name: 'Κτήριο Β', group: 'ΕΡΓΟ Α' },
      { id: 'a2', name: 'Κτήριο Α', group: 'ΕΡΓΟ Β' },
    ]);
  });

  it('🔴 η λίστα κτιρίων αποτυγχάνει ⇒ ΠΕΤΑ (όχι «κανένα κτίριο»)', async () => {
    answer({ [API_ROUTES.BUILDINGS.LIST]: new Error('503') });
    await expect(loadScopedBuildingOptions({ projectId: 'prj_1' }, LABELS)).rejects.toThrow('503');
  });

  it('🔴 απάντηση χωρίς λίστα ⇒ ΠΕΤΑ', async () => {
    answer({ [API_ROUTES.BUILDINGS.LIST]: {} });
    await expect(loadScopedBuildingOptions({ projectId: 'prj_1' }, LABELS)).rejects.toThrow();
  });

  it('🔴 η λίστα έργων αποτυγχάνει ⇒ ΠΕΤΑ (όχι ομάδες με ωμές ταυτότητες έργων)', async () => {
    answer({ [API_ROUTES.BUILDINGS.LIST]: { buildings: BUILDINGS }, [API_ROUTES.PROJECTS.LIST]: new Error('408') });
    await expect(loadScopedBuildingOptions({}, LABELS)).rejects.toThrow('408');
  });

  it('κενή λίστα από τον server ⇒ κενές επιλογές (το ΜΟΝΟ «δεν υπάρχουν»)', async () => {
    answer({ [API_ROUTES.BUILDINGS.LIST]: { buildings: [] }, [API_ROUTES.PROJECTS.LIST]: { projects: [] } });
    await expect(loadScopedBuildingOptions({}, LABELS)).resolves.toEqual([]);
  });
});
