/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΑ — **ο πίνακας ρόλος × τύπος της καθολικής αναζήτησης** (ADR-829 §7).
 *
 * Τρέχουν το πραγματικό `withAuth`, το πραγματικό `checkPermission`, ο πραγματικός κατάλογος ρόλων
 * και ο πραγματικός handler. Αντικαθίστανται μόνο η βάση και το audit, για να μετρηθεί τι ΡΩΤΗΘΗΚΕ
 * και τι ΓΡΑΦΤΗΚΕ. Το αναμενόμενο είναι η χειρόγραφη `SEARCH_ROLE_POLICY`.
 *
 * ⚠️ ΟΡΙΟ — κανένας ρόλος έργου εδώ: η αναζήτηση είναι ερώτημα εμβέλειας χώρου.
 */

/* global describe, it, expect, beforeEach, jest */

import { NextRequest } from 'next/server';
import { buildRequestContext } from '@/lib/auth/auth-context';
import { GLOBAL_ROLES, type GlobalRole, type PermissionId } from '@/lib/auth/types';
import { SEARCH_ENTITY_TYPES, type SearchEntityType } from '@/types/search';
import * as searchRoute from '../route';
import { SEARCH_ROLE_POLICY } from './search-role-policy.fixture';

interface StoredEntry {
  readonly tenantId: string;
  readonly entityType: SearchEntityType;
  readonly entityId: string;
  readonly search: { readonly normalized: string; readonly prefixes: readonly string[] };
  readonly title: string;
  readonly subtitle: string;
  readonly status: string;
  readonly links: { readonly href: string };
  readonly readReach?: string;
  readonly deleted?: boolean;
}

const mockIndex: { entries: StoredEntry[]; asked: SearchEntityType[] } = { entries: [], asked: [] };
const mockAudit = jest.fn(async (..._args: unknown[]) => undefined);

jest.mock('server-only', () => ({}));
jest.mock('@/lib/auth/auth-context', () => ({ buildRequestContext: jest.fn() }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/lib/middleware/with-rate-limit', () => ({ withHighRateLimit: <T,>(handler: T) => handler }));
jest.mock('@/lib/auth/audit', () => ({
  ...jest.requireActual('@/lib/auth/audit'),
  logAuditEvent: (...args: unknown[]) => mockAudit(...args),
}));
jest.mock('@/lib/firebaseAdmin', () => {
  type Filters = Record<string, unknown>;
  const queryOver = (filters: Filters) => ({
    where: (field: string, _op: string, value: unknown) => queryOver({ ...filters, [field]: value }),
    orderBy: () => queryOver(filters),
    limit: () => queryOver(filters),
    get: async () => {
      mockIndex.asked.push(filters.entityType as SearchEntityType);
      const docs = mockIndex.entries.filter((entry) =>
        entry.tenantId === filters.tenantId && entry.entityType === filters.entityType);
      return { docs: docs.map((entry) => ({ data: () => entry })) };
    },
  });
  return {
    getAdminFirestore: () => ({ collection: () => queryOver({}) }),
    isFirebaseAdminAvailable: () => true,
    getAdminAuth: jest.fn(),
  };
});

type Route = (request: NextRequest) => Promise<Response>;

// Χωρίς τελικό σίγμα: ο κανονικοποιητής το διπλώνει, και το δείγμα εδώ δεν περνά από αυτόν.
const TERM = 'κατοψη';
const ALL_TYPES = Object.values(SEARCH_ENTITY_TYPES);

function entryOf(entityType: SearchEntityType, overrides: Partial<StoredEntry> = {}): StoredEntry {
  return {
    tenantId: 'co_a',
    entityType,
    entityId: `${entityType}_1`,
    search: { normalized: TERM, prefixes: [TERM] },
    title: TERM,
    subtitle: '',
    status: 'active',
    links: { href: `/${entityType}/1` },
    ...(entityType === 'file' ? { readReach: 'tenant' } : {}),
    ...overrides,
  };
}

function signIn(globalRole: GlobalRole, permissions?: readonly PermissionId[]): void {
  (buildRequestContext as jest.Mock).mockResolvedValue({
    uid: 'u_a', email: 'a@a.gr', companyId: 'co_a', globalRole, mfaEnrolled: true, isAuthenticated: true, permissions,
  });
}

async function search(query = `q=${TERM}`): Promise<{ status: number; found: string[] }> {
  const route = searchRoute.GET as unknown as Route;
  const response = await route(new NextRequest(`http://localhost/api/search?${query}`));
  if (response.status !== 200) return { status: response.status, found: [] };
  const body = (await response.json()) as { data: { results: Array<{ entityType: string }> } };
  return { status: 200, found: body.data.results.map((result) => result.entityType).sort() };
}

const auditedTypes = (): string[] => {
  const details = mockAudit.mock.calls[0][4] as { newValue: { value: { entityTypes: string[] } } };
  return [...details.newValue.value.entityTypes].sort();
};

beforeEach(() => {
  mockAudit.mockClear();
  mockIndex.asked = [];
  mockIndex.entries = ALL_TYPES.map((entityType) => entryOf(entityType));
});

describe('Τ0 — ο πίνακας είναι κλειστός', () => {
  it('Τ0.1 — κάθε καθολικός ρόλος έχει γραμμή', () => {
    expect(Object.keys(SEARCH_ROLE_POLICY).sort()).toEqual([...GLOBAL_ROLES].sort());
  });

  it('Τ0.2 — ο πλήρης ρόλος βρίσκει κάθε τύπο: νέος τύπος δεν ξεφεύγει', () => {
    expect([...(SEARCH_ROLE_POLICY.company_admin ?? [])].sort()).toEqual([...ALL_TYPES].sort());
  });
});

describe('Τ1 — κάθε ρόλος: τι ρωτήθηκε, τι βρέθηκε, τι γράφτηκε στο audit', () => {
  for (const role of GLOBAL_ROLES) {
    const expected = SEARCH_ROLE_POLICY[role];

    if (expected === null) {
      it(`${role} ⇒ 403, χωρίς κανένα ερώτημα`, async () => {
        signIn(role);
        expect((await search()).status).toBe(403);
        expect(mockIndex.asked).toEqual([]);
      });
      continue;
    }

    it(`${role} ⇒ ${expected.length} τύποι`, async () => {
      signIn(role);
      const { status, found } = await search();
      const sorted = [...expected].sort();
      expect(status).toBe(200);
      expect(found).toEqual(sorted);
      expect([...mockIndex.asked].sort()).toEqual(sorted);
      expect(auditedTypes()).toEqual(sorted);
    });
  }
});

describe('Τ2 — το φίλτρο μπαίνει ΠΡΙΝ από το ερώτημα', () => {
  it('Τ2.1 — τύπος που ζητήθηκε ρητά χωρίς δικαίωμα: κενό, όχι ερώτημα, όχι 403', async () => {
    signIn('internal_user');
    const { status, found } = await search(`q=${TERM}&types=contact,file`);
    expect(status).toBe(200);
    expect(found).toEqual([]);
    expect(mockIndex.asked).toEqual([]);
    expect(auditedTypes()).toEqual([]);
  });

  it('Τ2.2 — η ζήτηση περιορίζει: ζητά έργα, ρωτά μόνο έργα', async () => {
    signIn('company_admin');
    await search(`q=${TERM}&types=project`);
    expect(mockIndex.asked).toEqual(['project']);
  });

  it('Τ2.3 — ρητή παραχώρηση στο claim ανοίγει τον τύπο της, κανέναν άλλο', async () => {
    signIn('internal_user', ['crm:contacts:view']);
    const { found } = await search();
    expect(found).toEqual([...(SEARCH_ROLE_POLICY.internal_user ?? []), 'contact'].sort());
  });

  it('Τ2.4 — το `requiredPermission` του εγγράφου δεν εξουσιοδοτεί: διαβάζεται ο πίνακας', async () => {
    mockIndex.entries = [{ ...entryOf('contact'), requiredPermission: 'projects:projects:view' } as StoredEntry];
    signIn('internal_user');
    expect((await search()).found).toEqual([]);
  });

  it('Τ2.5 — ο χώρος μένει φίλτρο: ξένη εγγραφή δεν βγαίνει ούτε στον διαχειριστή', async () => {
    mockIndex.entries = [entryOf('project', { tenantId: 'co_b' })];
    signIn('company_admin');
    expect((await search()).found).toEqual([]);
  });
});

describe('Τ3 — ο φράχτης εμβέλειας των αρχείων', () => {
  it('Τ3.1 — παλιά εγγραφή αρχείου χωρίς σφραγίδα δεν βγαίνει, ούτε στον διαχειριστή', async () => {
    mockIndex.entries = [entryOf('file', { readReach: undefined })];
    signIn('company_admin');
    expect((await search()).found).toEqual([]);
  });

  it('Τ3.2 — αρχείο με σφραγίδα βγαίνει', async () => {
    mockIndex.entries = [entryOf('file')];
    signIn('company_admin');
    expect((await search()).found).toEqual(['file']);
  });

  it('Τ3.3 — ο φράχτης αφορά τα αρχεία: έργο χωρίς σφραγίδα βγαίνει', async () => {
    mockIndex.entries = [entryOf('project')];
    signIn('company_admin');
    expect((await search()).found).toEqual(['project']);
  });

  it('Τ3.4 — ταφόπλακα δεν βγαίνει', async () => {
    mockIndex.entries = [entryOf('project', { deleted: true })];
    signIn('company_admin');
    expect((await search()).found).toEqual([]);
  });
});
