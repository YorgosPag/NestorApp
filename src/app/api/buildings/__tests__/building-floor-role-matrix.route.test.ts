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
 * ⚠️ ΟΡΙΟ — οι ρόλοι έργου (`project_manager` κ.λπ.) ΔΕΝ κρίνονται εδώ. Οι διαδρομές δεν δίνουν `projectId` στον κριτή,
 * άρα σήμερα είναι νεκροί σε αυτές (ADR-829 §7.1 «ΑΝΟΙΧΤΟ — ο ρόλος έργου»). Το Τ3 κοκκινίζει τη στιγμή που αλλάξει αυτό.
 */

/* global describe, it, expect, beforeEach, jest */

import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';
import { buildRequestContext } from '@/lib/auth/auth-context';
import { PREDEFINED_ROLES } from '@/lib/auth/role-catalogue';
import { GLOBAL_ROLES, type GlobalRole, type PermissionId } from '@/lib/auth/types';
import { createEntity } from '@/lib/firestore/entity-creation.service';
import { linkEntity } from '@/lib/firestore/entity-linking.service';
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
  logAuditEvent: async () => undefined,
}));
jest.mock('@/lib/firestore/entity-creation.service', () => ({ createEntity: jest.fn(async () => ({ id: 'bld_new' })) }));
jest.mock('@/lib/firestore/entity-linking.service', () => ({ linkEntity: jest.fn(async () => undefined) }));
jest.mock('@/lib/firestore/soft-delete-engine', () => ({ softDelete: jest.fn(async () => undefined) }));
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

describe('Τ3 — οι ρόλοι έργου μένουν έξω, δηλωμένα (ADR-829 §7.1 «ΑΝΟΙΧΤΟ — ο ρόλος έργου»)', () => {
  it('Τ3.1 — ο πίνακας κρίνει ακριβώς τους ρόλους που δεν είναι ρόλοι έργου', () => {
    const notProjectRoles = Object.entries(PREDEFINED_ROLES).filter(([, role]) => !role.isProjectRole).map(([id]) => id);
    expect(notProjectRoles.sort()).toEqual([...GLOBAL_ROLES].sort());
  });

  it('Τ3.2 — καμία διαδρομή του εύρους δεν δίνει έργο στον κριτή: όταν αλλάξει, ο πίνακας θέλει ρόλους έργου', () => {
    const files = [
      ...new Set(POLICY_OPERATIONS.map((op) => ROLE_POLICY[op].routeFile as string)),
      'src/app/api/buildings/building-update.handler.ts',
      'src/app/api/buildings/buildings-list.handler.ts',
    ];
    for (const file of files) {
      expect(fs.readFileSync(file, 'utf8')).not.toContain('permissionOptions');
    }
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

  // 🔴 ΑΝΟΙΧΤΟ ΕΥΡΗΜΑ (ADR-829 §7.1): `it.failing` μέχρι τη διόρθωση. Μόλις διορθωθεί κοκκινίζει, και γίνεται σκέτο `it`.
  it.failing('Τ4.6 — 🔴 POST /api/floors δεν δένει όροφο σε ξένο έργο', async () => {
    signIn('company_admin');
    const response = await (floorsRoute.POST as unknown as Route)(
      requestOf('POST', '/api/floors', { ...FLOOR_BODY, buildingId: 'bld_a', projectId: 'prj_b' }));

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(writeFloorBirth).not.toHaveBeenCalled();
  });

  it('Τ4.7 — GET /api/floors χωρίς φίλτρο δεν γυρίζει ξένους ορόφους', async () => {
    signIn('internal_user');
    const response = await (floorsRoute.GET as unknown as Route)(requestOf('GET', '/api/floors'));
    const text = await response.text();

    expect(response.status).toBeLessThan(300);
    expect(text).not.toContain(FOREIGN_MARK);
  });
});
