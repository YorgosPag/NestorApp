/**
 * ADR-898 §21.6 Ε6 — **χώρος έργου δεν μετακινείται σε κτίριο άλλου έργου**, και **κανένας** χώρος δεν δένεται σε κτίριο
 * άλλου χώρου εργασίας. Ως τις 2026-10-05 το `PATCH {buildingId}` δεχόταν οποιοδήποτε κτίριο και ο καταρράκτης ξανάγραφε
 * σιωπηλά το έργο **και το `companyId`** του χώρου.
 *
 * 🔑 Ο φύλακας του πόρου (`requireBuildingInTenant`) τρέχει **αληθινός**: ψεύτικος θα επικύρωνε μόνο ότι τον καλέσαμε,
 *   όχι ότι αρνείται.
 */

jest.mock('server-only', () => ({}));

const mockRead: string[] = [];
const mockDocs: Record<string, Record<string, Record<string, unknown>>> = { buildings: {}, projects: {} };
const mockDb = {
  collection: (name: string) => ({
    doc: (id: string) => ({
      get: async () => {
        mockRead.push(`${name}/${id}`);
        const data = mockDocs[name]?.[id];
        return { exists: data !== undefined, data: () => data };
      },
    }),
  }),
};
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => mockDb }));

const mockAudit = jest.fn(async (..._args: unknown[]) => undefined);
jest.mock('@/lib/auth/audit', () => ({ logAuditEvent: (...args: unknown[]) => mockAudit(...args) }));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { AuthContext } from '@/lib/auth/types';
import { POLICY_ERROR_CODES } from '@/lib/policy/policy-error-codes';
import { policyErrorMessageOf } from '@/lib/policy/policy-error-translator';

import {
  assertBuildingInSpaceProject,
  projectOfSpace,
  resolveNewSpaceAnchor,
  type SpaceGuardCaller,
} from '../space-building-project-guard';

const db = mockDb as unknown as AdminFirestore;
const CALLER: SpaceGuardCaller = {
  ctx: { uid: 'u1', companyId: 'comp_1', globalRole: 'company_admin' } as unknown as AuthContext,
  path: '/api/parking/[id]',
};

const SPOT = { buildingId: 'A', projectId: 'prj_1' };
const move = (buildingId: string | null, existing: Record<string, unknown> = SPOT) =>
  assertBuildingInSpaceProject(db, CALLER, 'p5', { buildingId }, existing);

beforeEach(() => {
  mockRead.length = 0;
  mockAudit.mockClear();
  mockDocs.buildings = {
    A: { companyId: 'comp_1', projectId: 'prj_1' },
    B: { companyId: 'comp_1', projectId: 'prj_1' },
    Z: { companyId: 'comp_1', projectId: 'prj_2' },
    ORPHAN: { companyId: 'comp_1' },
    FOREIGN: { companyId: 'comp_2', projectId: 'prj_9' },
    // Ξένο κτίριο που «τυχαίνει» να δηλώνει το ΔΙΚΟ μας έργο — ο κανόνας του έργου μόνος του θα το άφηνε.
    FOREIGN_SAME_PROJECT: { companyId: 'comp_2', projectId: 'prj_1' },
    NO_TENANT: { projectId: 'prj_1' },
  };
  mockDocs.projects = { prj_1: { companyId: 'comp_1' }, prj_9: { companyId: 'comp_2' } };
});

describe('assertBuildingInSpaceProject — κανόνας του έργου', () => {
  it('κτίριο ΑΛΛΟΥ έργου ⇒ 409 με κωδικό πολιτικής', async () => {
    await expect(move('Z')).rejects.toMatchObject({
      statusCode: 409,
      errorCode: POLICY_ERROR_CODES.SPACE_BUILDING_OTHER_PROJECT,
    });
  });

  it('κτίριο χωρίς έργο ⇒ επίσης άρνηση (δεν είναι «του έργου του»)', async () => {
    await expect(move('ORPHAN')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('άλλο κτίριο του ΙΔΙΟΥ έργου ⇒ περνά (θέση ≠ ανάθεση)', async () => {
    await expect(move('B')).resolves.toBeUndefined();
  });

  it('χώρος χωρίς δικό του έργο ⇒ κρίνεται με το έργο του ΚΤΙΡΙΟΥ του', async () => {
    await expect(move('Z', { buildingId: 'A' })).rejects.toMatchObject({ statusCode: 409 });
    await expect(move('B', { buildingId: 'A' })).resolves.toBeUndefined();
  });

  it('ασύνδετος χώρος (ούτε έργο ούτε κτίριο) ⇒ ανάθεση σε κάθε ΔΙΚΟ μας κτίριο', async () => {
    await expect(move('Z', {})).resolves.toBeUndefined();
  });

  it('σώμα που δεν αγγίζει το κτίριο · αποσύνδεση · ίδιο κτίριο ⇒ καμία ανάγνωση', async () => {
    await assertBuildingInSpaceProject(db, CALLER, 'p5', { number: 'Π-5' }, SPOT);
    await move(null);
    await move('A');
    expect(mockRead).toEqual([]);
  });
});

describe('assertBuildingInSpaceProject — 🔒 το κτίριο είναι ΤΟΥ ΚΑΛΟΥΝΤΟΣ (Ε6-γ)', () => {
  const NOT_FOUND = { status: 404, code: 'NOT_FOUND', message: 'Building not found' };

  it('🔴 ασύνδετος χώρος + κτίριο ΑΛΛΟΥ χώρου εργασίας ⇒ 404 (ο κανόνας του έργου θα το άφηνε)', async () => {
    await expect(move('FOREIGN', {})).rejects.toMatchObject(NOT_FOUND);
  });

  it('🔴 ξένο κτίριο που δηλώνει το ΔΙΚΟ μας έργο ⇒ 404, όχι «περνά»', async () => {
    await expect(move('FOREIGN_SAME_PROJECT')).rejects.toMatchObject(NOT_FOUND);
  });

  it('κτίριο χωρίς χώρο εργασίας δεν ανήκει σε κανέναν ⇒ 404', async () => {
    await expect(move('NO_TENANT', {})).rejects.toMatchObject(NOT_FOUND);
  });

  it('ξένο ≡ ανύπαρκτο: ίδια απάντηση για χώρο ΜΕ έργο (κανένα μαντείο ύπαρξης 409/404)', async () => {
    const foreign = await move('FOREIGN').catch((error: unknown) => error);
    const ghost = await move('GHOST').catch((error: unknown) => error);
    expect(foreign).toMatchObject(NOT_FOUND);
    expect(ghost).toMatchObject(NOT_FOUND);
  });

  it('η απόπειρα αφήνει ίχνος ελέγχου με τη διαδρομή του καλούντος', async () => {
    await move('FOREIGN', {}).catch(() => undefined);
    expect(mockAudit).toHaveBeenCalledWith(
      CALLER.ctx,
      'access_denied',
      'FOREIGN',
      'building',
      expect.objectContaining({ metadata: expect.objectContaining({ path: CALLER.path }) }),
    );
  });

  it('ο υπεργραφέας περνά (ρητή cross-tenant ορατότητα, ADR-232)', async () => {
    const admin: SpaceGuardCaller = { ...CALLER, ctx: { ...CALLER.ctx, globalRole: 'super_admin' } as AuthContext };
    await expect(assertBuildingInSpaceProject(db, admin, 'p5', { buildingId: 'FOREIGN' }, {})).resolves.toBeUndefined();
  });
});

describe('resolveNewSpaceAnchor — η άγκυρα ενός ΝΕΟΥ χώρου (Ε6-δ)', () => {
  const anchor = (body: { buildingId?: string; projectId?: string }) => resolveNewSpaceAnchor(CALLER, body);

  it('με κτίριο ⇒ το έργο ΠΡΟΚΥΠΤΕΙ από το κτίριο, και χωρίς να το πει το σώμα', async () => {
    expect(await anchor({ buildingId: 'A' })).toEqual({ buildingId: 'A', projectId: 'prj_1' });
    expect(await anchor({ buildingId: 'A', projectId: 'prj_1' })).toEqual({ buildingId: 'A', projectId: 'prj_1' });
    expect(await anchor({ buildingId: 'ORPHAN' })).toEqual({ buildingId: 'ORPHAN', projectId: null });
  });

  it('🔴 σώμα που ονομάζει ΑΛΛΟ έργο από του κτιρίου ⇒ 409, όχι σιωπηλή γραφή', async () => {
    const refusal = { statusCode: 409, errorCode: POLICY_ERROR_CODES.BUILDING_PROJECT_MISMATCH };
    await expect(anchor({ buildingId: 'A', projectId: 'prj_2' })).rejects.toMatchObject(refusal);
    await expect(anchor({ buildingId: 'ORPHAN', projectId: 'prj_1' })).rejects.toMatchObject(refusal);
  });

  it('🔴 κτίριο ΑΛΛΟΥ χώρου εργασίας ⇒ 404', async () => {
    await expect(anchor({ buildingId: 'FOREIGN' })).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('χωρίς κτίριο (ανοιχτός χώρος) ⇒ το έργο του σώματος, μόνο αν είναι ΔΙΚΟ μας', async () => {
    expect(await anchor({ projectId: 'prj_1' })).toEqual({ buildingId: null, projectId: 'prj_1' });
    await expect(anchor({ projectId: 'prj_9' })).rejects.toMatchObject({ status: 404, message: 'Project not found' });
  });

  it('ούτε κτίριο ούτε έργο ⇒ ασύνδετος χώρος, καμία ανάγνωση', async () => {
    expect(await anchor({})).toEqual({ buildingId: null, projectId: null });
    expect(await anchor({ buildingId: '  ', projectId: '' })).toEqual({ buildingId: null, projectId: null });
    expect(mockRead).toEqual([]);
  });
});

describe('projectOfSpace', () => {
  it('δικό του · του κτιρίου του · κανένα', async () => {
    expect(await projectOfSpace(db, { projectId: 'prj_9', buildingId: 'A' })).toBe('prj_9');
    expect(await projectOfSpace(db, { buildingId: 'Z' })).toBe('prj_2');
    expect(await projectOfSpace(db, {})).toBeNull();
  });
});

describe('οι αρνήσεις πολιτικής φτάνουν στον άνθρωπο μεταφρασμένες — πάνω στα ΠΡΑΓΜΑΤΙΚΑ locale JSON', () => {
  const CODES = [POLICY_ERROR_CODES.SPACE_BUILDING_OTHER_PROJECT, POLICY_ERROR_CODES.BUILDING_PROJECT_MISMATCH];
  const cases = ['el', 'en'].flatMap((language) => CODES.map((code) => [language, code] as const));

  it.each(cases)('%s · %s: το μήνυμα υπάρχει και δεν είναι το ίδιο το κλειδί', (language, code) => {
    const bundle = JSON.parse(readFileSync(join(process.cwd(), 'src/i18n/locales', language, 'building.json'), 'utf8')) as {
      policyErrors: Record<string, string>;
    };
    const t = (key: string) => bundle.policyErrors[key.replace('policyErrors.', '')] ?? key;
    const message = policyErrorMessageOf(Object.assign(new Error('conflict'), { errorCode: code }), t);
    expect(message).not.toBeNull();
    expect(message).not.toContain('policyErrors.');
  });
});
