// =============================================================================
// UC-017: GANTT DATA FETCHER — UNIT TESTS
// =============================================================================

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));
jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: {
    CONSTRUCTION_PHASES: 'construction_phases',
    CONSTRUCTION_TASKS: 'construction_tasks',
    CONSTRUCTION_RESOURCE_ASSIGNMENTS: 'construction_resource_assignments',
  },
}));
jest.mock('@/config/firestore-field-constants', () => ({
  FIELDS: { COMPANY_ID: 'companyId', BUILDING_ID: 'buildingId' },
}));

const mockPhaseDocs = [
  { id: 'ph_001', data: () => ({ buildingId: 'bld_001', companyId: 'comp_001', name: 'Foundation', order: 1, status: 'inProgress', progress: 50, plannedStartDate: '2026-04-01', plannedEndDate: '2026-08-01', code: 'PH-001' }) },
  { id: 'ph_002', data: () => ({ buildingId: 'bld_001', companyId: 'comp_001', name: 'Structure',  order: 2, status: 'planning',    progress: 0,  plannedStartDate: '2026-08-01', plannedEndDate: '2026-12-01', code: 'PH-002' }) },
];
const mockTaskDocs = [
  { id: 'tsk_001', data: () => ({ phaseId: 'ph_001', buildingId: 'bld_001', companyId: 'comp_001', name: 'Excavation', order: 1, status: 'inProgress', progress: 60, plannedStartDate: '2026-04-01', plannedEndDate: '2026-06-01', code: 'TSK-001' }) },
];
const mockAssignmentDocs = [
  { id: 'ra_001', data: () => ({ taskId: 'tsk_001', phaseId: 'ph_001', buildingId: 'bld_001', companyId: 'comp_001', resourceType: 'worker', resourceName: 'Ανδρέας Π.', allocatedHours: 40 }) },
];

const mockGet = jest.fn();
const mockWhere = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();

const mockCollection = jest.fn((name: string) => {
  const base = { where: mockWhere, limit: mockLimit, get: mockGet };
  if (name === 'construction_phases')              mockGet.mockResolvedValueOnce({ docs: mockPhaseDocs });
  else if (name === 'construction_tasks')          mockGet.mockResolvedValueOnce({ docs: mockTaskDocs });
  else if (name === 'construction_resource_assignments') mockGet.mockResolvedValueOnce({ docs: mockAssignmentDocs });
  else                                             mockGet.mockResolvedValueOnce({ docs: [] });
  return base;
});

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({ collection: mockCollection }),
}));

import { fetchGanttScheduleData } from '../gantt-data-fetcher';

describe('fetchGanttScheduleData', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches phases, tasks, and resource assignments', async () => {
    const result = await fetchGanttScheduleData('comp_001', 'bld_001', 'req_test');

    expect(result.phases).toHaveLength(2);
    expect(result.tasks).toHaveLength(1);
    expect(result.resourceAssignments).toHaveLength(1);
  });

  it('maps phase doc id into phase object', async () => {
    const result = await fetchGanttScheduleData('comp_001', 'bld_001', 'req_test');
    expect(result.phases[0].id).toBe('ph_001');
    expect(result.phases[0].name).toBe('Foundation');
  });

  it('sorts phases by order ascending', async () => {
    const result = await fetchGanttScheduleData('comp_001', 'bld_001', 'req_test');
    expect(result.phases[0].order).toBeLessThanOrEqual(result.phases[1].order ?? Infinity);
  });

  it('maps task doc id into task object', async () => {
    const result = await fetchGanttScheduleData('comp_001', 'bld_001', 'req_test');
    expect(result.tasks[0].id).toBe('tsk_001');
  });

  it('uses BUILDING_ID filter when buildingId provided', async () => {
    await fetchGanttScheduleData('comp_001', 'bld_001', 'req_test');
    expect(mockWhere).toHaveBeenCalledWith('buildingId', '==', 'bld_001');
  });

  it('uses COMPANY_ID filter when no buildingId', async () => {
    // reset mock to return empty docs
    mockGet.mockResolvedValue({ docs: [] });
    await fetchGanttScheduleData('comp_001', null, 'req_test');
    expect(mockWhere).toHaveBeenCalledWith('companyId', '==', 'comp_001');
  });
});
