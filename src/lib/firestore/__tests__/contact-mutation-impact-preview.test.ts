jest.mock('server-only', () => ({}));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: jest.fn(),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { previewContactIdentityImpact } from '../contact-identity-impact-preview.service';
import { previewServiceIdentityImpact } from '../service-identity-impact-preview.service';
import { previewCompanyIdentityImpact } from '../company-identity-impact-preview.service';
import type { IndividualIdentityFieldChange } from '@/utils/contactForm/individual-identity-guard';
import type { ServiceIdentityFieldChange } from '@/utils/contactForm/service-identity-guard';

const mockedGetAdminFirestore = getAdminFirestore as jest.MockedFunction<typeof getAdminFirestore>;

interface MockSnapshot {
  size: number;
}

interface QueryMock {
  where: jest.MockedFunction<(field: string, op: string, value: unknown) => QueryMock>;
  select: jest.MockedFunction<() => QueryMock>;
  get: jest.MockedFunction<() => Promise<MockSnapshot>>;
}

function createQueryMock(size: number): QueryMock {
  const query = {
    where: jest.fn<(field: string, op: string, value: unknown) => QueryMock>(),
    select: jest.fn<() => QueryMock>(),
    get: jest.fn(async () => ({ size })),
  } as QueryMock;

  query.where.mockImplementation(() => query);
  query.select.mockImplementation(() => query);

  return query;
}

function setupFirestoreWithSequence(sequences: Partial<Record<string, number[]>>) {
  const state = new Map<string, number[]>(Object.entries(sequences).map(([key, values]) => [key, [...(values ?? [])]]));

  mockedGetAdminFirestore.mockReturnValue({
    collection: jest.fn((collectionName: string) => {
      const queue = state.get(collectionName) ?? [0];
      const nextSize = queue.length > 0 ? queue.shift() ?? 0 : 0;
      state.set(collectionName, queue);
      return createQueryMock(nextSize);
    }),
  } as never);
}

describe('contact mutation impact preview services', () => {
  beforeEach(() => {
    mockedGetAdminFirestore.mockReset();
  });

  describe('previewContactIdentityImpact', () => {
    const amkaChange: IndividualIdentityFieldChange = {
      field: 'amka',
      category: 'regulated',
      oldValue: '12345678901',
      newValue: '10987654321',
      isCleared: false,
    };

    it('returns allow without touching Firestore when there are no changes', async () => {
      const result = await previewContactIdentityImpact('contact_1', []);

      expect(result).toEqual({
        mode: 'allow',
        changes: [],
        dependencies: [],
        affectedDomains: [],
        messageKey: 'identityImpact.messages.allow',
        blockingCount: 0,
        warningCount: 0,
      });
      expect(mockedGetAdminFirestore).toHaveBeenCalledTimes(0);
    });

    it('blocks AMKA changes when attendance and employment records exist', async () => {
      setupFirestoreWithSequence({
        [COLLECTIONS.CONTACT_LINKS]: [2],
        [COLLECTIONS.ATTENDANCE_EVENTS]: [3],
        [COLLECTIONS.EMPLOYMENT_RECORDS]: [4],
      });

      const result = await previewContactIdentityImpact('contact_1', [amkaChange]);

      expect(result.mode).toBe('block');
      expect(result.dependencies).toEqual(expect.arrayContaining([
        { id: 'projectLinks', count: 2, mode: 'warn' },
        { id: 'attendanceEvents', count: 3, mode: 'block' },
        { id: 'employmentRecords', count: 4, mode: 'block' },
      ]));
      expect(result.dependencies).toHaveLength(3);
      expect(result.blockingCount).toBe(7);
      expect(result.warningCount).toBe(2);
      expect(result.affectedDomains).toEqual(expect.arrayContaining(['ikaAttendance', 'employmentCompliance', 'documentsAndIdentifiers']));
      expect(result.messageKey).toBe('identityImpact.messages.block');
    });

    it('fails closed when Firestore preview throws', async () => {
      mockedGetAdminFirestore.mockReturnValue({
        collection: jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          get: jest.fn(async () => { throw new Error('firestore unavailable'); }),
        })),
      } as never);

      const result = await previewContactIdentityImpact('contact_1', [amkaChange]);

      expect(result.mode).toBe('block');
      expect(result.dependencies).toEqual([]);
      expect(result.messageKey).toBe('identityImpact.messages.unavailable');
      expect(result.affectedDomains).toEqual(expect.arrayContaining(['ikaAttendance', 'employmentCompliance', 'documentsAndIdentifiers']));
    });
  });

  describe('previewServiceIdentityImpact', () => {
    const serviceChange: ServiceIdentityFieldChange = {
      field: 'serviceCode',
      category: 'administrative',
      oldValue: 'KEP-01',
      newValue: 'KEP-02',
      isCleared: false,
    };

    it('returns warn with project and relationship dependencies', async () => {
      setupFirestoreWithSequence({
        [COLLECTIONS.CONTACT_LINKS]: [1],
        [COLLECTIONS.CONTACT_RELATIONSHIPS]: [2, 3],
      });

      const result = await previewServiceIdentityImpact('service_1', [serviceChange]);

      expect(result.mode).toBe('warn');
      expect(result.dependencies).toEqual(expect.arrayContaining([
        { id: 'projectLinks', count: 1, mode: 'warn' },
        { id: 'contactRelationships', count: 2, mode: 'warn' },
      ]));
      expect(result.dependencies).toHaveLength(2);
      expect(result.warningCount).toBe(3);
      expect(result.affectedDomains).toEqual(['linkedProjects', 'searchAndReporting', 'relationshipViews']);
      expect(result.messageKey).toBe('identityImpact.messages.warn');
    });

    it('fails closed on Firestore errors', async () => {
      mockedGetAdminFirestore.mockReturnValue({
        collection: jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          get: jest.fn(async () => { throw new Error('firestore unavailable'); }),
        })),
      } as never);

      const result = await previewServiceIdentityImpact('service_1', [serviceChange]);

      expect(result.mode).toBe('block');
      expect(result.dependencies).toEqual([]);
      expect(result.affectedDomains).toEqual(['searchAndReporting', 'relationshipViews']);
      expect(result.messageKey).toBe('identityImpact.messages.unavailable');
    });
  });

  describe('previewCompanyIdentityImpact', () => {
    it('aggregates live and snapshot references', async () => {
      setupFirestoreWithSequence({
        [COLLECTIONS.PROJECTS]: [2],
        [COLLECTIONS.PROPERTIES]: [3],
        [COLLECTIONS.OBLIGATIONS]: [1],
        [COLLECTIONS.ACCOUNTING_INVOICES]: [4],
        [COLLECTIONS.ACCOUNTING_APY_CERTIFICATES]: [5],
      });

      const result = await previewCompanyIdentityImpact('company_1');

      expect(result).toEqual({
        totalAffected: 6,
        projects: 2,
        properties: 3,
        obligations: 1,
        parking: 0,
        storage: 0,
        invoices: 4,
        apyCertificates: 5,
      });
    });

    it('returns zeroed preview on Firestore errors', async () => {
      mockedGetAdminFirestore.mockReturnValue({
        collection: jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          get: jest.fn(async () => { throw new Error('firestore unavailable'); }),
        })),
      } as never);

      const result = await previewCompanyIdentityImpact('company_1');

      expect(result).toEqual({
        totalAffected: 0,
        projects: 0,
        properties: 0,
        obligations: 0,
        parking: 0,
        storage: 0,
        invoices: 0,
        apyCertificates: 0,
      });
    });
  });
});
