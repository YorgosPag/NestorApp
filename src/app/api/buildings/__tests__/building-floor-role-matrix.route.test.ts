/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΑ — **ο πίνακας ρόλων κτιρίων και ορόφων** (ADR-829 §7.1).
 *
 * Τρέχουν το πραγματικό `withAuth`, το πραγματικό `checkPermission`, ο πραγματικός κατάλογος ρόλων, οι πραγματικοί
 * handlers και οι πραγματικοί φράχτες χώρου. Αντικαθίστανται μόνο τα άκρα: η ταυτότητα του αιτήματος, η βάση και οι
 * τελικοί γραφείς. Το αναμενόμενο είναι η χειρόγραφη δήλωση `ROLE_POLICY`, όχι ο κατάλογος (OWASP Authorization Testing
 * Automation Cheat Sheet): αλλιώς μια λάθος παραχώρηση θα μετακινούσε και τις δύο πλευρές.
 *
 * Οι ρόλοι έργου κρίνονται στο Τ3 (ADR-926): ο αναγνώστης μέλους αντικαθίσταται, το έργο βγαίνει από τον πραγματικό πόρο.
 */

/* global describe, it, expect, beforeEach, jest */

import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';
import { logAuditEvent } from '@/lib/auth/audit';
import { buildRequestContext } from '@/lib/auth/auth-context';
import { readProjectMember, type ProjectMemberRead } from '@/lib/auth/project-member-read';
import { PROJECT_SCOPED_ACTIONS } from '@/lib/auth/project-scoped-actions';
import { PREDEFINED_ROLES } from '@/lib/auth/role-catalogue';
import { GLOBAL_ROLES, type GlobalRole, type PermissionId } from '@/lib/auth/types';
import { createEntity } from '@/lib/firestore/entity-creation.service';
import { linkEntity } from '@/lib/firestore/entity-linking.service';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { assertDeletionAllowed } from '@/lib/firestore/deletion-guard';
import { softDelete } from '@/lib/firestore/soft-delete-engine';
import { withVersionCheck } from '@/lib/firestore/version-check';
import { recordEntityUpdate } from '@/services/audit/record-entity-update';
import * as buildingsRoute from '../route';
import * as buildingRoute from '../[buildingId]/route';
import * as linkProjectRoute from '../[buildingId]/link-project/route';
import * as floorsRoute from '../../floors/route';
import { writeFloorBirth } from '../../floors/floor-birth';
import { removeFloor } from '../../floors/floor-removal';
import {
  POLICY_OPERATIONS,
  PROJECT_ROLE_POLICY,
  PROJECT_STRUCTURE_WRITERS,
  ROLE_POLICY,
  ROUTES_OUTSIDE_POLICY,
  type PolicyOperation,
  type RouteFile,
} from './building-floor-role-policy.fixture';
import { seedTenantDocuments, tenantWrites } from './tenant-fake-firestore.fixture';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/auth/auth-context', () => ({ buildRequestContext: jest.fn() }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/lib/firebaseAdmin', () => {
  const { tenantFakeDb } = jest.requireActual('./tenant-fake-firestore.fixture');
  return { getAdminFirestore: () => tenantFakeDb(), isFirebaseAdminAvailable: () => true, getAdminAuth: jest.fn() };
});
jest.mock('@/lib/api/admin-db', () => {
  const { tenantFakeDb } = jest.requireActual('./tenant-fake-firestore.fixture');
  return { requireAdminFirestore: () => tenantFakeDb() };
});
jest.mock('@/lib/middleware/with-rate-limit', () => ({ withStandardRateLimit: <T,>(handler: T) => handler }));
jest.mock('@/lib/auth/audit', () => ({
  ...jest.requireActual('@/lib/auth/audit'),
  logAuditEvent: jest.fn(async () => undefined),
}));
jest.mock('@/lib/auth/project-member-read', () => ({
  ...jest.requireActual('@/lib/auth/project-member-read'),
  readProjectMember: jest.fn(async () => ({ outcome: 'absent' })),
}));
jest.mock('@/lib/firestore/entity-creation.service', () => ({ createEntity: jest.fn(async () => ({ id: 'bld_new' })) }));
jest.mock('@/lib/firestore/entity-linking.service', () => ({ linkEntity: jest.fn(async () => undefined) }));
jest.mock('@/lib/firestore/soft-delete-engine', () => ({ softDelete: jest.fn(async () => undefined) }));
jest.mock('@/lib/firestore/deletion-guard', () => ({
  ...jest.requireActual('@/lib/firestore/deletion-guard'),
  assertDeletionAllowed: jest.fn(async () => undefined),
}));
jest.mock('@/lib/firestore/version-check', () => ({
  withVersionCheck: jest.fn(async () => ({ newVersion: 2, docId: 'x' })),
  ConflictError: class ConflictError extends Error {},
}));
jest.mock('@/services/audit/record-entity-update', () => ({
  recordEntityUpdate: jest.fn(async () => ({ auditId: null })),
}));
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(), diffFieldsWithResolution: async () => [] },
}));
jest.mock('@/services/places/public-place-read.service', () => ({ verifyPlaceRef: async () => 'exists' }));
jest.mock('@/services/listings/listing-scope-republish', () => ({ republishListingsForProject: jest.fn() }));
jest.mock('@/app/api/geocoding/geocoding-engine', () => ({ geocodeWithVerdict: jest.fn() }));
jest.mock('@/services/listings/address-position-completion-schedule', () => ({ scheduleAddressPositionCompletion: jest.fn() }));
jest.mock('../../floors/floor-birth', () => ({ writeFloorBirth: jest.fn(async () => ({ floorId: 'flr_new' })) }));
jest.mock('../../floors/floor-removal', () => ({ removeFloor: jest.fn(async () => undefined) }));
jest.mock('../../floors/floor-slot-companion', () => ({ floorSlotCompanion: () => undefined }));
jest.mock('../../floors/floor-update-effects', () => ({
  buildFloorUpdates: jest.requireActual('../../floors/floor-update-effects').buildFloorUpdates,
  runFloorUpdateEffects: jest.fn(async () => ({ warnings: [] })),
}));

const WRITE_SINKS = [createEntity, withVersionCheck, softDelete, writeFloorBirth, removeFloor, linkEntity] as unknown as jest.Mock[];

type Route = (request: NextRequest, segment?: unknown) => Promise<Response>;

const ORIGIN = 'http://localhost';
const FLOOR_BODY = { number: 2, name: 'Νέος', kind: 'standard', longName: 'Νέος όροφος', nameAutoGenerated: false, longNameAutoGenerated: false };

function requestOf(method: string, pathname: string, body?: unknown): NextRequest {
  return new NextRequest(`${ORIGIN}${pathname}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
  });
}

/** Οι στόχοι που δέχεται κάθε πράξη: δικοί μου, ή του χώρου Β. */
interface Targets {
  readonly building: string;
  readonly project: string;
  readonly floor: string;
}

const MINE: Targets = { building: 'bld_a', project: 'prj_a', floor: 'flr_a' };
const FOREIGN: Targets = { building: 'bld_b', project: 'prj_b', floor: 'flr_b' };

const INVOKE: Record<PolicyOperation, (targets: Targets) => Promise<Response>> = {
  listBuildings: (t) => (buildingsRoute.GET as unknown as Route)(requestOf('GET', `/api/buildings?projectId=${t.project}`)),
  createBuilding: (t) => (buildingsRoute.POST as unknown as Route)(requestOf('POST', '/api/buildings', { name: 'Νέο', code: 'Κτ-9', projectId: t.project })),
  updateBuilding: (t) => (buildingsRoute.PATCH as unknown as Route)(requestOf('PATCH', '/api/buildings', { buildingId: t.building, name: 'Άλλο' })),
  readBuilding: (t) => (buildingRoute.GET as unknown as Route)(requestOf('GET', `/api/buildings/${t.building}`)),
  deleteBuilding: (t) => (buildingRoute.DELETE as unknown as Route)(requestOf('DELETE', `/api/buildings/${t.building}`)),
  linkProject: (t) => (linkProjectRoute.POST as unknown as Route)(
    requestOf('POST', `/api/buildings/${t.building}/link-project`, { projectId: 'prj_a' }),
    { params: Promise.resolve({ buildingId: t.building }) },
  ),
  listFloors: (t) => (floorsRoute.GET as unknown as Route)(requestOf('GET', `/api/floors?buildingId=${t.building}`)),
  createFloor: (t) => (floorsRoute.POST as unknown as Route)(requestOf('POST', '/api/floors', { ...FLOOR_BODY, buildingId: t.building })),
  updateFloor: (t) => (floorsRoute.PATCH as unknown as Route)(requestOf('PATCH', '/api/floors', { floorId: t.floor, name: 'Άλλος' })),
  deleteFloor: (t) => (floorsRoute.DELETE as unknown as Route)(requestOf('DELETE', `/api/floors?floorId=${t.floor}`)),
};

function signIn(globalRole: GlobalRole, permissions?: readonly PermissionId[]): void {
  (buildRequestContext as jest.Mock).mockResolvedValue({
    uid: 'u_a', email: 'a@a.gr', companyId: 'co_a', globalRole, mfaEnrolled: true, isAuthenticated: true, permissions,
  });
}

const writeCount = (): number =>
  WRITE_SINKS.reduce((sum, sink) => sum + sink.mock.calls.length, 0) + tenantWrites().length;

const FOREIGN_MARK = 'Ξένο';

beforeEach(() => {
  WRITE_SINKS.forEach((sink) => sink.mockClear());
  (recordEntityUpdate as jest.Mock).mockClear();
  seedTenantDocuments({
    projects: {
      prj_a: { companyId: 'co_a', linkedCompanyId: 'cont_a', name: 'Δικό μου' },
      prj_b: { companyId: 'co_b', linkedCompanyId: 'cont_b', name: FOREIGN_MARK },
    },
    buildings: {
      bld_a: { companyId: 'co_a', name: 'Κτίριο', projectId: null },
      bld_b: { companyId: 'co_b', name: FOREIGN_MARK, projectId: 'prj_b' },
    },
    floors: {
      flr_a: { companyId: 'co_a', buildingId: 'bld_a', number: 1, name: 'Ο1' },
      flr_b: { companyId: 'co_b', buildingId: 'bld_b', number: 1, name: FOREIGN_MARK },
    },
  });
});

describe('Τ0 — ο πίνακας είναι κλειστός', () => {
  const ROUTE_MODULES: Record<RouteFile, object> = {
    'src/app/api/buildings/route.ts': buildingsRoute,
    'src/app/api/buildings/[buildingId]/route.ts': buildingRoute,
    'src/app/api/buildings/[buildingId]/link-project/route.ts': linkProjectRoute,
    'src/app/api/floors/route.ts': floorsRoute,
  };
  const HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

  it('Τ0.1 — κάθε εξαγόμενη μέθοδος των διαδρομών του εύρους έχει γραμμή, και κάθε γραμμή μέθοδο', () => {
    const exported = Object.entries(ROUTE_MODULES).flatMap(([file, routeModule]) =>
      Object.keys(routeModule).filter((name) => HTTP_METHODS.includes(name)).map((method) => `${method} ${file}`));
    const declared = POLICY_OPERATIONS.map((op) => `${ROLE_POLICY[op].method} ${ROLE_POLICY[op].routeFile}`);
    expect([...declared].sort()).toEqual([...exported].sort());
  });

  it('Τ0.2 — κάθε καθολικός ρόλος έχει ετυμηγορία σε κάθε γραμμή', () => {
    for (const op of POLICY_OPERATIONS) {
      expect(Object.keys(ROLE_POLICY[op].verdicts).sort()).toEqual([...GLOBAL_ROLES].sort());
    }
  });

  it('Τ0.3 — κάθε route.ts κάτω από buildings και floors είναι στον πίνακα ή δηλωμένο εκτός του, με λόγο', () => {
    const routesUnder = (directory: string): string[] =>
      fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) return routesUnder(full);
        return entry.name === 'route.ts' ? [path.relative(process.cwd(), full).split(path.sep).join('/')] : [];
      });
    const onDisk = [...routesUnder('src/app/api/buildings'), ...routesUnder('src/app/api/floors')];
    const declared = [...Object.keys(ROUTE_MODULES), ...Object.keys(ROUTES_OUTSIDE_POLICY)];
    expect([...declared].sort()).toEqual([...onDisk].sort());
  });
});

describe('Τ1 — κάθε ρόλος × κάθε πράξη, στον δικό του χώρο', () => {
  for (const op of POLICY_OPERATIONS) {
    for (const role of GLOBAL_ROLES) {
      const verdict = ROLE_POLICY[op].verdicts[role];

      it(`${op} · ${role} ⇒ ${verdict}`, async () => {
        signIn(role);
        const response = await INVOKE[op](MINE);

        if (verdict === 'deny') {
          expect(response.status).toBe(403);
          expect(writeCount()).toBe(0);
          return;
        }
        expect(response.status).toBeLessThan(300);
        if (ROLE_POLICY[op].writes) expect(writeCount()).toBeGreaterThan(0);
      });
    }
  }
});

describe('Τ2 — ρητή παραχώρηση στο claim (ADR-829 §7.1)', () => {
  for (const op of POLICY_OPERATIONS) {
    for (const role of GLOBAL_ROLES.filter((candidate) => ROLE_POLICY[op].verdicts[candidate] === 'deny')) {
      it(`${op} · ${role} με claim ⇒ περνά, χωρίς να ανοίγει ξένο χώρο`, async () => {
        signIn(role, [ROLE_POLICY[op].permission]);

        const mine = await INVOKE[op](MINE);
        expect(mine.status).toBeLessThan(300);

        const writesBefore = writeCount();
        const foreign = await INVOKE[op](FOREIGN);
        expect(foreign.status).toBe(404);
        expect(writeCount()).toBe(writesBefore);
      });
    }
  }
});

describe('Τ3 — οι ρόλοι έργου (ADR-926)', () => {
  /** Στόχοι μέσα στο έργο `prj_a`. */
  const IN_PROJECT: Targets = { building: 'bld_p', project: 'prj_a', floor: 'flr_p' };
  const PROJECT_OPERATIONS = Object.values(PROJECT_ROLE_POLICY).flatMap((row) => ('operation' in row ? [row.operation] : []));
  const PROJECT_ROLE_IDS = Object.entries(PREDEFINED_ROLES).filter(([, role]) => role.isProjectRole).map(([id]) => id);

  function memberOf(memberships: Readonly<Record<string, string>>): void {
    (readProjectMember as jest.Mock).mockImplementation(async ({ projectId }: { projectId: string }): Promise<ProjectMemberRead> => {
      const roleId = memberships[projectId];
      if (roleId === undefined) return { outcome: 'absent' };
      return { outcome: 'member', member: { roleId, permissionSetIds: [], effectivePermissions: [] } as never };
    });
  }

  const auditedProjectRole = (): number =>
    (logAuditEvent as jest.Mock).mock.calls.filter(([, action]) => action === 'project_role_exercised').length;

  beforeEach(() => {
    (logAuditEvent as jest.Mock).mockClear();
    (readProjectMember as jest.Mock).mockReset();
    (readProjectMember as jest.Mock).mockResolvedValue({ outcome: 'absent' });
    seedTenantDocuments({
      projects: {
        prj_a: { companyId: 'co_a', linkedCompanyId: 'cont_a', name: 'Δικό μου' },
        prj_c: { companyId: 'co_a', linkedCompanyId: 'cont_a', name: 'Άλλο δικό μου' },
        prj_b: { companyId: 'co_b', linkedCompanyId: 'cont_b', name: FOREIGN_MARK },
      },
      buildings: {
        bld_a: { companyId: 'co_a', name: 'Χωρίς έργο', projectId: null },
        bld_p: { companyId: 'co_a', name: 'Στο έργο', projectId: 'prj_a' },
        bld_c: { companyId: 'co_a', name: 'Στο άλλο έργο', projectId: 'prj_c' },
        bld_b: { companyId: 'co_b', name: FOREIGN_MARK, projectId: 'prj_b' },
      },
      floors: {
        flr_a: { companyId: 'co_a', buildingId: 'bld_a', number: 1, name: 'Ο1' },
        flr_p: { companyId: 'co_a', buildingId: 'bld_p', number: 1, name: 'Ο1' },
        // Το πεδίο του ορόφου λέει prj_a, το κτίριό του ανήκει στο prj_c: μετρά το κτίριο.
        flr_lying: { companyId: 'co_a', buildingId: 'bld_c', projectId: 'prj_a', number: 1, name: 'Ο1' },
        flr_b: { companyId: 'co_b', buildingId: 'bld_b', number: 1, name: FOREIGN_MARK },
      },
    });
  });

  it('Τ3.1 — ο πίνακας κρίνει ακριβώς τους ρόλους που δεν είναι ρόλοι έργου', () => {
    const notProjectRoles = Object.entries(PREDEFINED_ROLES).filter(([, role]) => !role.isProjectRole).map(([id]) => id);
    expect(notProjectRoles.sort()).toEqual([...GLOBAL_ROLES].sort());
  });

  it('Τ3.2 — κάθε πράξη του καταλόγου έχει γραμμή στον πίνακα, και κάθε γραμμή πράξη', () => {
    expect(Object.keys(PROJECT_ROLE_POLICY).sort()).toEqual([...PROJECT_SCOPED_ACTIONS].sort());
  });

  for (const op of PROJECT_OPERATIONS) {
    for (const roleId of PROJECT_ROLE_IDS) {
      const allowed = PROJECT_STRUCTURE_WRITERS.includes(roleId);

      it(`Τ3.3 — ${op} · μέλος ${roleId} ⇒ ${allowed ? 'allow' : 'deny'}`, async () => {
        signIn('internal_user');
        memberOf({ prj_a: roleId });
        const response = await INVOKE[op](IN_PROJECT);

        if (!allowed) {
          expect(response.status).toBe(403);
          expect(writeCount()).toBe(0);
          return;
        }
        expect(response.status).toBeLessThan(300);
        expect(writeCount()).toBeGreaterThan(0);
        expect(auditedProjectRole()).toBe(1);
      });
    }

    it(`Τ3.4 — ${op} · μη μέλος ⇒ 403`, async () => {
      signIn('internal_user');
      const response = await INVOKE[op](IN_PROJECT);

      expect(response.status).toBe(403);
      expect(writeCount()).toBe(0);
    });

    it(`Τ3.5 — ${op} · PM άλλου έργου ⇒ 403`, async () => {
      signIn('internal_user');
      memberOf({ prj_c: 'project_manager' });
      const response = await INVOKE[op](IN_PROJECT);

      expect(response.status).toBe(403);
      expect(writeCount()).toBe(0);
    });

    for (const outcome of ['unknown', 'unreadable'] as const) {
      it(`Τ3.6 — ${op} · ανάγνωση μέλους ${outcome} ⇒ 403, ο company_admin περνά`, async () => {
        (readProjectMember as jest.Mock).mockResolvedValue({ outcome, why: 'test' });
        signIn('internal_user');
        expect((await INVOKE[op](IN_PROJECT)).status).toBe(403);
        expect(writeCount()).toBe(0);

        signIn('company_admin');
        expect((await INVOKE[op](IN_PROJECT)).status).toBeLessThan(300);
        expect(auditedProjectRole()).toBe(0);
      });
    }

    it(`Τ3.7 — ${op} · PM ξένου έργου με ίδιο id σε ξένο πόρο ⇒ 404`, async () => {
      signIn('internal_user');
      memberOf({ prj_b: 'project_manager' });
      const response = await INVOKE[op](FOREIGN);

      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain(FOREIGN_MARK);
      expect(writeCount()).toBe(0);
    });

    it(`Τ3.7α — ${op} · χωρίς κανέναν ρόλο σε ξένο πόρο ⇒ 404, ο φράχτης πριν από κρίση ρόλου (Κ3)`, async () => {
      signIn('internal_user');
      const response = await INVOKE[op](FOREIGN);

      expect(response.status).toBe(404);
      expect(readProjectMember).not.toHaveBeenCalled();
      expect(writeCount()).toBe(0);
    });
  }

  it('Τ3.8 — ο PM δεν διαγράφει όροφο: η διαγραφή είναι οριστική (§4)', async () => {
    signIn('internal_user');
    memberOf({ prj_a: 'project_manager' });
    const response = await INVOKE.deleteFloor(IN_PROJECT);

    expect(response.status).toBe(403);
    expect(writeCount()).toBe(0);
  });

  it('Τ3.9 — το κτίριο στον κάδο πηγαίνει με softDelete, ποτέ με οριστική διαγραφή', async () => {
    signIn('internal_user');
    memberOf({ prj_a: 'project_manager' });
    expect((await INVOKE.deleteBuilding(IN_PROJECT)).status).toBeLessThan(300);
    expect(softDelete).toHaveBeenCalledTimes(1);
  });

  it('Τ3.9α — οι εξαρτήσεις μπλοκάρουν τον κάδο στον διακομιστή, χωρίς να περάσουμε από την προεπισκόπηση (§4)', async () => {
    (assertDeletionAllowed as jest.Mock).mockRejectedValueOnce(new ApiError(409, 'Έχει ακίνητα', 'DELETION_BLOCKED'));
    signIn('internal_user');
    memberOf({ prj_a: 'project_manager' });

    expect((await INVOKE.deleteBuilding(IN_PROJECT)).status).toBe(409);
    expect(softDelete).not.toHaveBeenCalled();
    expect(auditedProjectRole()).toBe(0);
  });

  it('Τ3.9β — από τον κάδο βγαίνει μόνο η επαναφορά: `PATCH status` απορρίπτεται', async () => {
    seedTenantDocuments({ buildings: { bld_p: { companyId: 'co_a', name: 'Στον κάδο', projectId: 'prj_a', status: 'deleted' } } });
    signIn('company_admin');
    const response = await (buildingsRoute.PATCH as unknown as Route)(
      requestOf('PATCH', '/api/buildings', { buildingId: 'bld_p', status: 'active' }));

    expect(response.status).toBe(409);
    expect(writeCount()).toBe(0);
  });

  it('Τ3.10 — Κ4: κτίριο χωρίς έργο κρίνεται μόνο από την εταιρεία', async () => {
    signIn('internal_user');
    memberOf({ prj_a: 'project_manager' });

    for (const op of ['updateBuilding', 'deleteBuilding', 'createFloor', 'updateFloor', 'linkProject'] as const) {
      expect((await INVOKE[op](MINE)).status).toBe(403);
    }
    expect(writeCount()).toBe(0);
  });

  it('Τ3.11 — AIP-203: το `projectId` του σώματος δεν δίνει ρόλο έργου', async () => {
    signIn('internal_user');
    memberOf({ prj_a: 'project_manager' });

    const patch = await (buildingsRoute.PATCH as unknown as Route)(
      requestOf('PATCH', '/api/buildings', { buildingId: 'bld_c', projectId: 'prj_a', name: 'Άλλο' }));
    const floor = await (floorsRoute.POST as unknown as Route)(
      requestOf('POST', '/api/floors', { ...FLOOR_BODY, buildingId: 'bld_c', projectId: 'prj_a' }));

    expect(patch.status).toBe(403);
    expect(floor.status).toBe(403);
    expect(writeCount()).toBe(0);
  });

  it('Τ3.12 — το έργο του ορόφου είναι του κτιρίου του, όχι το πεδίο του', async () => {
    signIn('internal_user');
    memberOf({ prj_a: 'project_manager' });
    const response = await (floorsRoute.PATCH as unknown as Route)(requestOf('PATCH', '/api/floors', { floorId: 'flr_lying', name: 'Άλλος' }));

    expect(response.status).toBe(403);
    expect(writeCount()).toBe(0);
  });

  describe('Τ3.13 — μεταφορά κτιρίου: κρίνονται και τα δύο έργα', () => {
    const move = (projectId: string | null): Promise<Response> => (buildingsRoute.PATCH as unknown as Route)(
      requestOf('PATCH', '/api/buildings', { buildingId: 'bld_p', projectId }));

    it('στόχος όπου δεν έχει ρόλο ⇒ 403', async () => {
      signIn('internal_user');
      memberOf({ prj_a: 'project_manager' });
      expect((await move('prj_c')).status).toBe(403);
      expect(writeCount()).toBe(0);
    });

    it('`viewer` στον στόχο ⇒ 403', async () => {
      signIn('internal_user');
      memberOf({ prj_a: 'project_manager', prj_c: 'viewer' });
      expect((await move('prj_c')).status).toBe(403);
      expect(writeCount()).toBe(0);
    });

    it('PM και στα δύο ⇒ περνά', async () => {
      signIn('internal_user');
      memberOf({ prj_a: 'project_manager', prj_c: 'project_manager' });
      expect((await move('prj_c')).status).toBeLessThan(300);
      // Μία γραμμή για κάθε έργο που έδωσε την πράξη.
      expect(auditedProjectRole()).toBe(2);
    });

    it('PM μόνο στον στόχο ⇒ 403: η πηγή κρίνεται πρώτη', async () => {
      signIn('internal_user');
      memberOf({ prj_c: 'project_manager' });
      expect((await move('prj_c')).status).toBe(403);
      expect(writeCount()).toBe(0);
    });

    it('έξω από έργο (`null`) ⇒ μόνο η εταιρεία', async () => {
      signIn('internal_user');
      memberOf({ prj_a: 'project_manager' });
      expect((await move(null)).status).toBe(403);
      expect(writeCount()).toBe(0);

      signIn('company_admin');
      expect((await move(null)).status).toBeLessThan(300);
    });
  });
});

describe('Τ4 — ξένος χώρος', () => {
  for (const op of POLICY_OPERATIONS) {
    it(`${op} · company_admin σε ξένο στόχο ⇒ 404, χωρίς ξένο περιεχόμενο και χωρίς εγγραφή`, async () => {
      signIn('company_admin');
      const response = await INVOKE[op](FOREIGN);

      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain(FOREIGN_MARK);
      expect(writeCount()).toBe(0);
    });
  }

  it('Τ4.1 — PATCH κτιρίου με ξένο έργο ⇒ 400, χωρίς εγγραφή', async () => {
    signIn('company_admin');
    const response = await (buildingsRoute.PATCH as unknown as Route)(
      requestOf('PATCH', '/api/buildings', { buildingId: 'bld_a', projectId: 'prj_b' }));

    expect(response.status).toBe(400);
    expect(writeCount()).toBe(0);
  });

  it('Τ4.2 — link-project με ξένο έργο ⇒ 400, χωρίς εγγραφή', async () => {
    signIn('company_admin');
    const response = await (linkProjectRoute.POST as unknown as Route)(
      requestOf('POST', '/api/buildings/bld_a/link-project', { projectId: 'prj_b' }),
      { params: Promise.resolve({ buildingId: 'bld_a' }) },
    );

    expect(response.status).toBe(400);
    expect(writeCount()).toBe(0);
  });

  it('Τ4.3 — PATCH ορόφου δεν μεταφέρει τον όροφο σε ξένο κτίριο ή έργο', async () => {
    signIn('company_admin');
    await (floorsRoute.PATCH as unknown as Route)(
      requestOf('PATCH', '/api/floors', { floorId: 'flr_a', name: 'Ο2', buildingId: 'bld_b', projectId: 'prj_b', companyId: 'co_b' }));

    const { updates } = (withVersionCheck as jest.Mock).mock.calls[0][0] as { updates: Record<string, unknown> };
    expect(Object.keys(updates)).toEqual(['name']);
  });

  it('Τ4.4 — ο super_admin περνά το όριο χώρου, δηλωμένα', async () => {
    signIn('super_admin');
    const response = await INVOKE.deleteBuilding(FOREIGN);

    expect(response.status).toBeLessThan(300);
    expect(softDelete).toHaveBeenCalledTimes(1);
  });

  it('Τ4.5 — GET /api/buildings?projectId=ξένο: ο ρόλος ανάγνωσης παίρνει 404 και με `fallback=company`', async () => {
    signIn('internal_user');
    const response = await (buildingsRoute.GET as unknown as Route)(
      requestOf('GET', '/api/buildings?projectId=prj_b&fallback=company'));

    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain(FOREIGN_MARK);
  });

  it('Τ4.5α — κρίνεται το id που ρωτάμε: το `007` ρωτά το έργο `7`, όχι το δικό μου έγγραφο `007`', async () => {
    seedTenantDocuments({
      projects: {
        '007': { companyId: 'co_a', linkedCompanyId: 'cont_a', name: 'Δικό μου' },
        7: { companyId: 'co_b', linkedCompanyId: 'cont_b', name: FOREIGN_MARK },
      },
      buildings: { bld_b: { companyId: 'co_b', name: FOREIGN_MARK, projectId: 7 } },
    });
    signIn('company_admin');
    const response = await (buildingsRoute.GET as unknown as Route)(requestOf('GET', '/api/buildings?projectId=007'));

    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain(FOREIGN_MARK);
  });

  it('Τ4.5β — ο super_admin βλέπει ξένο έργο, ακόμη και ορφανά κτίρια έργου που δεν υπάρχει πια', async () => {
    seedTenantDocuments({ buildings: { bld_b: { companyId: 'co_b', name: FOREIGN_MARK, projectId: 'prj_gone' } } });
    signIn('super_admin');
    const response = await (buildingsRoute.GET as unknown as Route)(requestOf('GET', '/api/buildings?projectId=prj_gone'));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain(FOREIGN_MARK);
  });

  for (const status of ['deleted', 'archived']) {
    it(`Τ4.5γ — έργο με status ${status} απαντά τα κτίριά του: ο φράχτης κρίνει χώρο, όχι κύκλο ζωής (ADR-281)`, async () => {
      seedTenantDocuments({
        projects: { prj_a: { companyId: 'co_a', linkedCompanyId: 'cont_a', name: 'Δικό μου', status } },
        buildings: { bld_a: { companyId: 'co_a', name: 'Το κτίριό μου', projectId: 'prj_a' } },
      });
      signIn('internal_user');
      const response = await INVOKE.listBuildings(MINE);

      expect(response.status).toBe(200);
      expect(await response.text()).toContain('Το κτίριό μου');
    });
  }

  it('Τ4.6 — POST /api/floors αγνοεί το έργο του σώματος: κτίριο χωρίς έργο μένει όροφος χωρίς έργο', async () => {
    signIn('company_admin');
    const response = await (floorsRoute.POST as unknown as Route)(
      requestOf('POST', '/api/floors', { ...FLOOR_BODY, buildingId: 'bld_a', projectId: 'prj_b', projectName: FOREIGN_MARK }));

    expect(response.status).toBe(200);
    const { fields } = (writeFloorBirth as jest.Mock).mock.calls[0][0] as { fields: Record<string, unknown> };
    expect(fields).not.toHaveProperty('projectId');
    expect(fields).not.toHaveProperty('projectName');
  });

  it('Τ4.7 — GET /api/floors χωρίς φίλτρο δεν γυρίζει ξένους ορόφους', async () => {
    signIn('internal_user');
    const response = await (floorsRoute.GET as unknown as Route)(requestOf('GET', '/api/floors'));
    const text = await response.text();

    expect(response.status).toBeLessThan(300);
    expect(text).not.toContain(FOREIGN_MARK);
  });
});
