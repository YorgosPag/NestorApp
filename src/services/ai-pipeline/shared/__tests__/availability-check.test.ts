/**
 * AVAILABILITY CHECK TESTS
 *
 * Tests appointment availability checking: free/busy dates,
 * time conflicts, Firestore error fallback, and briefing generation.
 *
 * @see UC-001 (Appointment Module)
 * @module __tests__/availability-check
 */

// ── Mock server-only ──
jest.mock('server-only', () => ({}));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: jest.fn(),
}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
}));

jest.mock('@/lib/error-utils', () => ({
  getErrorMessage: jest.fn((e: unknown) => e instanceof Error ? e.message : String(e)),
}));

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: { APPOINTMENTS: 'appointments' },
}));

jest.mock('@/config/firestore-field-constants', () => ({
  FIELDS: { COMPANY_ID: 'companyId', STATUS: 'status' },
}));

import { checkAvailability } from '../availability-check';
import type { AvailabilityCheckParams } from '../availability-check';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

// ============================================================================
// HELPERS
// ============================================================================

function createParams(overrides?: Partial<AvailabilityCheckParams>): AvailabilityCheckParams {
  return {
    companyId: 'comp_001',
    requestedDate: '2026-04-15',
    requestedTime: '10:00',
    requestId: 'req_001',
    ...overrides,
  };
}

function setupFirestoreMock(docs: Array<Record<string, unknown>> = []) {
  const mockGet = jest.fn(async () => ({
    docs: docs.map((data, i) => ({
      id: `appt_${i}`,
      data: () => data,
    })),
  }));

  const mockQuery = {
    where: jest.fn().mockReturnThis(),
    get: mockGet,
  };

  (getAdminFirestore as jest.Mock).mockReturnValue({
    collection: jest.fn(() => mockQuery),
  });

  return { mockGet, mockQuery };
}

// ============================================================================
// TESTS
// ============================================================================

describe('checkAvailability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns free when no date requested', async () => {
    const result = await checkAvailability(createParams({ requestedDate: null }));

    expect(result.isDateFree).toBe(true);
    expect(result.hasTimeConflict).toBe(false);
    expect(result.existingAppointments).toHaveLength(0);
    expect(result.operatorBriefing).toContain('δεν ζήτησε');
  });

  it('returns free when no appointments on date', async () => {
    setupFirestoreMock([]);

    const result = await checkAvailability(createParams());

    expect(result.isDateFree).toBe(true);
    expect(result.hasTimeConflict).toBe(false);
    expect(result.operatorBriefing).toContain('δεν υπάρχουν');
  });

  it('returns busy with appointments listed', async () => {
    setupFirestoreMock([
      {
        requester: { name: 'Γιάννης' },
        appointment: { requestedDate: '2026-04-15', requestedTime: '09:00' },
        status: 'approved',
      },
    ]);

    const result = await checkAvailability(createParams());

    expect(result.isDateFree).toBe(false);
    expect(result.existingAppointments).toHaveLength(1);
    expect(result.existingAppointments[0].requesterName).toBe('Γιάννης');
    expect(result.operatorBriefing).toContain('1 ραντεβού');
  });

  it('detects time conflict when same time exists', async () => {
    setupFirestoreMock([
      {
        requester: { name: 'Νίκος' },
        appointment: { requestedDate: '2026-04-15', requestedTime: '10:00' },
        status: 'pending_approval',
      },
    ]);

    const result = await checkAvailability(createParams({ requestedTime: '10:00' }));

    expect(result.hasTimeConflict).toBe(true);
    expect(result.operatorBriefing).toContain('ΣΥΓΚΡΟΥΕΤΑΙ');
  });

  it('no time conflict when different time', async () => {
    setupFirestoreMock([
      {
        requester: { name: 'Νίκος' },
        appointment: { requestedDate: '2026-04-15', requestedTime: '09:00' },
        status: 'approved',
      },
    ]);

    const result = await checkAvailability(createParams({ requestedTime: '11:00' }));

    expect(result.hasTimeConflict).toBe(false);
    expect(result.operatorBriefing).toContain('διαθέσιμη');
  });

  it('returns graceful fallback on Firestore error', async () => {
    (getAdminFirestore as jest.Mock).mockReturnValue({
      collection: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => { throw new Error('Connection failed'); }),
      })),
    });

    const result = await checkAvailability(createParams());

    expect(result.isDateFree).toBe(true);
    expect(result.hasTimeConflict).toBe(false);
    expect(result.operatorBriefing).toContain('σφάλμα');
  });

  it('shows "ελεύθερη" in briefing for free date with time', async () => {
    setupFirestoreMock([]);

    const result = await checkAvailability(createParams({ requestedTime: '14:00' }));

    expect(result.operatorBriefing).toContain('ελεύθερη');
  });

  it('shows "πλήρως διαθέσιμη" when no time requested', async () => {
    setupFirestoreMock([]);

    const result = await checkAvailability(createParams({ requestedTime: null }));

    expect(result.operatorBriefing).toContain('πλήρως διαθέσιμη');
  });

  it('falls back to "Άγνωστος" when requester name missing', async () => {
    setupFirestoreMock([
      {
        requester: {},
        appointment: { requestedDate: '2026-04-15', requestedTime: '09:00' },
        status: 'approved',
      },
    ]);

    const result = await checkAvailability(createParams());

    expect(result.existingAppointments[0].requesterName).toBe('Άγνωστος');
  });

  it('handles multiple appointments on same date', async () => {
    setupFirestoreMock([
      {
        requester: { name: 'Γιάννης' },
        appointment: { requestedDate: '2026-04-15', requestedTime: '09:00' },
        status: 'approved',
      },
      {
        requester: { name: 'Μαρία' },
        appointment: { requestedDate: '2026-04-15', requestedTime: '11:00' },
        status: 'pending_approval',
      },
    ]);

    const result = await checkAvailability(createParams());

    expect(result.existingAppointments).toHaveLength(2);
    expect(result.operatorBriefing).toContain('2 ραντεβού');
  });
});
