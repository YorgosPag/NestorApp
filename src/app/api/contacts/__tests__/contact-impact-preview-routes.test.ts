import type { Contact } from '@/types/contacts';

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T>(handler: T) => handler,
}));

var authCtx = {
  uid: 'user_1',
  companyId: 'comp_1',
  globalRole: 'company_admin',
};

jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (...args: unknown[]) => Promise<unknown>) => {
    return async (request: unknown, segmentData?: unknown) => {
      try {
        return await callback(request, authCtx, {}, segmentData);
      } catch (error) {
        const e = error as { statusCode?: number; message?: string };
        return {
          status: e.statusCode ?? 500,
          body: { success: false, message: e.message ?? 'Unknown error' },
        };
      }
    };
  },
}));

jest.mock('@/lib/auth/roles', () => ({
  isRoleBypass: jest.fn((role?: string) => role === 'super_admin'),
}));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: jest.fn(),
}));

jest.mock('@/lib/firestore/contact-identity-impact-preview.service', () => ({
  previewContactIdentityImpact: jest.fn(),
}));

jest.mock('@/lib/firestore/service-identity-impact-preview.service', () => ({
  previewServiceIdentityImpact: jest.fn(),
}));

jest.mock('@/lib/firestore/company-identity-impact-preview.service', () => ({
  previewCompanyIdentityImpact: jest.fn(),
}));

jest.mock('@/lib/api/ApiErrorHandler', () => {
  class MockApiError extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  }

  return {
    ApiError: MockApiError,
    apiSuccess: (data: unknown) => ({ status: 200, body: { success: true, data } }),
  };
});

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { previewContactIdentityImpact } from '@/lib/firestore/contact-identity-impact-preview.service';
import { previewServiceIdentityImpact } from '@/lib/firestore/service-identity-impact-preview.service';
import { previewCompanyIdentityImpact } from '@/lib/firestore/company-identity-impact-preview.service';
import { POST as individualPost } from '../[contactId]/identity-impact-preview/route';
import { POST as servicePost } from '../[contactId]/service-identity-impact-preview/route';
import { GET as companyGet } from '../[contactId]/company-identity-impact-preview/route';

const mockedGetAdminFirestore = getAdminFirestore as jest.MockedFunction<typeof getAdminFirestore>;
const mockedPreviewContactIdentityImpact = previewContactIdentityImpact as jest.MockedFunction<typeof previewContactIdentityImpact>;
const mockedPreviewServiceIdentityImpact = previewServiceIdentityImpact as jest.MockedFunction<typeof previewServiceIdentityImpact>;
const mockedPreviewCompanyIdentityImpact = previewCompanyIdentityImpact as jest.MockedFunction<typeof previewCompanyIdentityImpact>;

interface MockDocSnapshot {
  exists: boolean;
  id: string;
  data: () => Record<string, unknown> | undefined;
}

function makeFirestore(contact: Contact | null) {
  const snapshot: MockDocSnapshot = contact
    ? {
        exists: true,
        id: contact.id ?? 'contact_1',
        data: () => contact as unknown as Record<string, unknown>,
      }
    : {
        exists: false,
        id: 'missing',
        data: () => undefined,
      };

  mockedGetAdminFirestore.mockReturnValue({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(async () => snapshot),
      })),
    })),
  } as never);
}

function makeRequest(body?: unknown) {
  return {
    json: jest.fn(async () => body),
  } as never;
}

beforeEach(() => {
  authCtx = {
    uid: 'user_1',
    companyId: 'comp_1',
    globalRole: 'company_admin',
  };
  mockedGetAdminFirestore.mockReset();
  mockedPreviewContactIdentityImpact.mockReset();
  mockedPreviewServiceIdentityImpact.mockReset();
  mockedPreviewCompanyIdentityImpact.mockReset();
});

describe('contact impact preview routes', () => {
  describe('POST /identity-impact-preview', () => {
    it('returns 200 for valid individual preview request', async () => {
      makeFirestore({
        id: 'contact_1',
        type: 'individual',
        companyId: 'comp_1',
        isFavorite: false,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        firstName: 'Maria',
        lastName: 'Papadopoulou',
      });
      mockedPreviewContactIdentityImpact.mockResolvedValue({
        mode: 'warn',
        changes: [],
        dependencies: [],
        affectedDomains: ['linkedProjects'],
        messageKey: 'identityImpact.messages.warn',
        blockingCount: 0,
        warningCount: 1,
      });

      const result = await individualPost(makeRequest({
        changes: [
          { field: 'firstName', category: 'display', oldValue: 'Maria', newValue: 'Marina', isCleared: false },
        ],
      }), { params: Promise.resolve({ contactId: 'contact_1' }) });

      expect(result).toEqual({
        status: 200,
        body: {
          success: true,
          data: expect.objectContaining({ mode: 'warn' }),
        },
      });
      // 🔴 Ο tenant του καλούντος **πρέπει** να φτάνει στη μηχανή. Μέχρι την
      // ADR-742 §7octies δεν περνιόταν καθόλου και οι μετρήσεις έτρεχαν
      // cross-tenant. Η θέση του στη λίστα ορισμάτων **είναι** ο έλεγχος.
      expect(mockedPreviewContactIdentityImpact).toHaveBeenCalledWith('contact_1', 'comp_1', [
        { field: 'firstName', category: 'display', oldValue: 'Maria', newValue: 'Marina', isCleared: false },
      ]);
    });

    it('μεταμφιέζει την άρνηση ιδιοκτησίας σε ΠΑΝΟΜΟΙΟΤΥΠΟ 404 (ADR-742 §7octies)', async () => {
      // ⚠️ ΙΣΤΟΡΙΚΟ — μην το «διορθώσεις» πίσω.
      // Μέχρι τις 2026-08-01 αυτό το test κάρφωνε `403 'Access denied - Contact
      // not found'`. Ήταν η **μισογραμμένη μεταμφίεση**: σωστό κείμενο, λάθος
      // κωδικός, περιττό πρόθεμα. Κωδικός **και** μήνυμα πρόδιδαν ότι το id
      // υπάρχει — δηλαδή μαντείο ύπαρξης (ADR-742 §3.3).
      // Η αντιστροφή σε 404 είναι **ρητή απόφαση**, όχι refactor.
      makeFirestore({
        id: 'contact_1',
        type: 'individual',
        companyId: 'other_comp',
        isFavorite: false,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        firstName: 'Maria',
        lastName: 'Papadopoulou',
      });

      const result = await individualPost(makeRequest({ changes: [] }), { params: Promise.resolve({ contactId: 'contact_1' }) });

      expect(result).toEqual({
        status: 404,
        body: { success: false, message: 'Contact not found' },
      });
      expect(mockedPreviewContactIdentityImpact).not.toHaveBeenCalled();
    });

    it('🔴 το ΓΝΗΣΙΟ «δεν βρέθηκε» είναι ΠΑΝΟΜΟΙΟΤΥΠΟ με το μεταμφιεσμένο', async () => {
      // Ο πυρήνας του δόγματος: αν τα δύο «όχι» διαφέρουν σε **οποιοδήποτε**
      // πεδίο, η μεταμφίεση δεν κρύβει τίποτα. Σύγκριση ολόκληρου του ζεύγους.
      makeFirestore(null); // το έγγραφο όντως λείπει

      const genuine = await individualPost(makeRequest({ changes: [] }), { params: Promise.resolve({ contactId: 'missing' }) });

      makeFirestore({
        id: 'contact_1',
        type: 'individual',
        companyId: 'other_comp',
        isFavorite: false,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        firstName: 'Maria',
        lastName: 'Papadopoulou',
      });

      const disguised = await individualPost(makeRequest({ changes: [] }), { params: Promise.resolve({ contactId: 'contact_1' }) });

      expect(genuine).toEqual(disguised);
    });

    it('returns 400 for non-individual contacts', async () => {
      makeFirestore({
        id: 'contact_1',
        type: 'company',
        companyId: 'comp_1',
        isFavorite: false,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        companyName: 'Acme',
        vatNumber: '099999999',
      });

      const result = await individualPost(makeRequest({ changes: [] }), { params: Promise.resolve({ contactId: 'contact_1' }) });

      expect(result).toEqual({
        status: 400,
        body: { success: false, message: 'Identity impact preview is only available for individual contacts' },
      });
    });
  });

  describe('POST /service-identity-impact-preview', () => {
    it('returns 200 for valid service preview request', async () => {
      makeFirestore({
        id: 'service_1',
        type: 'service',
        companyId: 'comp_1',
        isFavorite: false,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        serviceName: 'KEP Athens',
        serviceType: 'municipality',
      });
      mockedPreviewServiceIdentityImpact.mockResolvedValue({
        mode: 'allow',
        changes: [],
        dependencies: [],
        affectedDomains: ['searchAndReporting'],
        messageKey: 'identityImpact.messages.allow',
        blockingCount: 0,
        warningCount: 0,
      });

      const result = await servicePost(makeRequest({
        changes: [
          { field: 'serviceName', category: 'display', oldValue: 'KEP Athens', newValue: 'KEP Athens Central', isCleared: false },
        ],
      }), { params: Promise.resolve({ contactId: 'service_1' }) });

      expect(result).toEqual({
        status: 200,
        body: {
          success: true,
          data: expect.objectContaining({ mode: 'allow' }),
        },
      });
      expect(mockedPreviewServiceIdentityImpact).toHaveBeenCalled();
    });

    it('returns 400 for invalid request payload', async () => {
      makeFirestore({
        id: 'service_1',
        type: 'service',
        companyId: 'comp_1',
        isFavorite: false,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        serviceName: 'KEP Athens',
        serviceType: 'municipality',
      });

      const result = await servicePost(makeRequest({
        changes: [
          { field: 'unknownField', category: 'display', oldValue: 'x', newValue: 'y', isCleared: false },
        ],
      }), { params: Promise.resolve({ contactId: 'service_1' }) });

      expect(result).toEqual({
        status: 400,
        body: { success: false, message: 'Validation failed' },
      });
      expect(mockedPreviewServiceIdentityImpact).not.toHaveBeenCalled();
    });
  });

  describe('GET /company-identity-impact-preview', () => {
    it('returns 200 with preview payload', async () => {
      // 🔴 Μέχρι την §7octies αυτή η διαδρομή **δεν φόρτωνε καν** την επαφή:
      // καμία άδεια, κανένας φύλακας, κανένας tenant. Το ότι το test χρειάζεται
      // πλέον Firestore **είναι** η απόδειξη ότι ο φύλακας μπήκε στη ροή.
      makeFirestore({
        id: 'company_1',
        type: 'company',
        companyId: 'comp_1',
        isFavorite: false,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        companyName: 'Acme',
        vatNumber: '099999999',
      });
      mockedPreviewCompanyIdentityImpact.mockResolvedValue({
        totalAffected: 4,
        projects: 1,
        properties: 1,
        obligations: 2,
        invoices: 5,
        apyCertificates: 0,
      });

      const result = await companyGet(makeRequest(), { params: Promise.resolve({ contactId: 'company_1' }) });

      expect(result).toEqual({
        status: 200,
        body: {
          success: true,
          data: {
            totalAffected: 4,
            projects: 1,
            properties: 1,
            obligations: 2,
            invoices: 5,
            apyCertificates: 0,
          },
        },
      });
      expect(mockedPreviewCompanyIdentityImpact).toHaveBeenCalledWith('company_1', 'comp_1');
    });

    it('🔴 αρνείται ξένη επαφή με το ίδιο 404 — ήταν ΤΕΛΕΙΩΣ αφύλακτη', async () => {
      makeFirestore({
        id: 'company_1',
        type: 'company',
        companyId: 'other_comp',
        isFavorite: false,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        companyName: 'Acme',
        vatNumber: '099999999',
      });

      const result = await companyGet(makeRequest(), { params: Promise.resolve({ contactId: 'company_1' }) });

      expect(result).toEqual({
        status: 404,
        body: { success: false, message: 'Contact not found' },
      });
      expect(mockedPreviewCompanyIdentityImpact).not.toHaveBeenCalled();
    });
  });
});

