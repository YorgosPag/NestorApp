/**
 * ADR-898 §21.6 Ε6-α/γ — **η άγκυρα μιας μονάδας** (χώρος εργασίας · έργο · κτίριο). Ως τις 2026-10-05 το PATCH έγραφε
 * `companyId`, `projectId` και `buildingId` αυτούσια από το σώμα. Ο φύλακας του πόρου τρέχει **αληθινός**.
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
jest.mock('@/lib/auth/audit', () => ({ logAuditEvent: jest.fn(async () => undefined) }));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { SpaceGuardCaller } from '@/lib/api/space-building-project-guard';
import type { AuthContext } from '@/lib/auth/types';
import { POLICY_ERROR_CODES } from '@/lib/policy/policy-error-codes';
import { policyErrorMessageOf } from '@/lib/policy/policy-error-translator';

import { assertPropertyAnchorWrite } from '../property-anchor-guard';

const db = mockDb as unknown as AdminFirestore;
const CALLER: SpaceGuardCaller = {
  ctx: { uid: 'u1', companyId: 'comp_1', globalRole: 'company_admin' } as unknown as AuthContext,
  path: '/api/properties/[id]',
};

const UNIT = { companyId: 'comp_1', projectId: 'prj_1', buildingId: 'A' };
const write = (body: Record<string, unknown>, existing: Record<string, unknown> = UNIT) =>
  assertPropertyAnchorWrite(db, CALLER, 'prop_1', body, existing);

const BOUNDARY = { statusCode: 409, errorCode: POLICY_ERROR_CODES.PROPERTY_PROJECT_BOUNDARY };
const NOT_FOUND = { status: 404, code: 'NOT_FOUND' };

beforeEach(() => {
  mockRead.length = 0;
  mockDocs.buildings = {
    A: { companyId: 'comp_1', projectId: 'prj_1' },
    B: { companyId: 'comp_1', projectId: 'prj_1' },
    Z: { companyId: 'comp_1', projectId: 'prj_2' },
    FOREIGN: { companyId: 'comp_2', projectId: 'prj_9' },
    FOREIGN_SAME_PROJECT: { companyId: 'comp_2', projectId: 'prj_1' },
  };
  mockDocs.projects = { prj_1: { companyId: 'comp_1' }, prj_2: { companyId: 'comp_1' }, prj_9: { companyId: 'comp_2' } };
});

describe('🔒 ο χώρος εργασίας δεν γράφεται από σώμα', () => {
  it('🔴 `companyId` άλλου χώρου εργασίας ⇒ 400', async () => {
    await expect(write({ companyId: 'comp_2' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(write({ companyId: null })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('ηχώ της αποθηκευμένης τιμής περνά (ιδεμπότητα), χωρίς ανάγνωση', async () => {
    await expect(write({ companyId: 'comp_1', name: 'Α1' })).resolves.toEqual({});
    expect(mockRead).toEqual([]);
  });
});

describe('το κτίριο: του καλούντος ΚΑΙ του έργου της μονάδας', () => {
  it('άλλο κτίριο του ΙΔΙΟΥ έργου ⇒ περνά', async () => {
    await expect(write({ buildingId: 'B', floorId: null })).resolves.toEqual({});
  });

  it('🔴 κτίριο ΑΛΛΟΥ έργου ⇒ 409 με κωδικό πολιτικής', async () => {
    await expect(write({ buildingId: 'Z' })).rejects.toMatchObject(BOUNDARY);
  });

  it('🔴 κτίριο ΑΛΛΟΥ χώρου εργασίας ⇒ 404 — και όταν δηλώνει το δικό μας έργο', async () => {
    await expect(write({ buildingId: 'FOREIGN' })).rejects.toMatchObject(NOT_FOUND);
    await expect(write({ buildingId: 'FOREIGN_SAME_PROJECT' })).rejects.toMatchObject(NOT_FOUND);
    await expect(write({ buildingId: 'GHOST' })).rejects.toMatchObject(NOT_FOUND);
  });

  it('🔴 μονάδα ΧΩΡΙΣ έργο + ξένο κτίριο ⇒ 404 (ο κανόνας του έργου θα το άφηνε)', async () => {
    await expect(write({ buildingId: 'FOREIGN' }, { companyId: 'comp_1' })).rejects.toMatchObject(NOT_FOUND);
  });

  it('μονάδα χωρίς έργο και χωρίς κτίριο ⇒ τοποθετείται σε κάθε ΔΙΚΟ μας κτίριο', async () => {
    await expect(write({ buildingId: 'Z' }, { companyId: 'comp_1' })).resolves.toEqual({});
  });

  it('ίδιο κτίριο · σώμα που δεν αγγίζει την άγκυρα ⇒ καμία ανάγνωση', async () => {
    await write({ buildingId: 'A' });
    await write({ name: 'Α1', area: 95 });
    expect(mockRead).toEqual([]);
  });
});

describe('το έργο είναι το όριο — δεν αλλάζει από σώμα', () => {
  it('🔴 άλλο έργο ⇒ 409· άδειασμα ⇒ 409', async () => {
    await expect(write({ projectId: 'prj_2' })).rejects.toMatchObject(BOUNDARY);
    await expect(write({ projectId: null })).rejects.toMatchObject(BOUNDARY);
    await expect(write({ projectId: '' })).rejects.toMatchObject(BOUNDARY);
  });

  it('ηχώ του αποθηκευμένου έργου περνά', async () => {
    await expect(write({ projectId: 'prj_1', name: 'Α1' })).resolves.toEqual({});
  });

  it('το έργο κρίνεται και όταν το «ξέρει» μόνο το κτίριο της μονάδας', async () => {
    const legacy = { companyId: 'comp_1', buildingId: 'A' };
    await expect(write({ projectId: 'prj_2' }, legacy)).rejects.toMatchObject(BOUNDARY);
    await expect(write({ buildingId: 'Z' }, legacy)).rejects.toMatchObject(BOUNDARY);
  });

  it('μονάδα χωρίς έργο το ΑΠΟΚΤΑ — μόνο αν είναι δικό μας', async () => {
    const orphan = { companyId: 'comp_1' };
    await expect(write({ projectId: 'prj_1' }, orphan)).resolves.toEqual({});
    await expect(write({ projectId: 'prj_9' }, orphan)).rejects.toMatchObject({ ...NOT_FOUND, message: 'Project not found' });
  });

  it('🔴 έργο + κτίριο που διαφωνούν στο ίδιο σώμα ⇒ 409', async () => {
    await expect(write({ projectId: 'prj_1', buildingId: 'Z' }, { companyId: 'comp_1' })).rejects.toMatchObject(BOUNDARY);
  });
});

describe('αποσύνδεση από κτίριο — η μονάδα ΚΡΑΤΑ το έργο της (Revit «Not Placed»)', () => {
  it('μονάδα με δικό της έργο ⇒ τίποτα να προστεθεί, καμία ανάγνωση', async () => {
    await expect(write({ buildingId: null, floorId: null })).resolves.toEqual({});
    expect(mockRead).toEqual([]);
  });

  it('🔴 μονάδα που το έργο της το ήξερε μόνο το κτίριο ⇒ το παίρνει μαζί της στην ΙΔΙΑ γραφή', async () => {
    await expect(write({ buildingId: null }, { companyId: 'comp_1', buildingId: 'Z' })).resolves.toEqual({ projectId: 'prj_2' });
  });

  it('μονάδα ήδη χωρίς κτίριο ⇒ τίποτα', async () => {
    await expect(write({ buildingId: null }, { companyId: 'comp_1' })).resolves.toEqual({});
  });
});

describe('ο φρουρός είναι ΚΑΛΩΔΙΩΜΕΝΟΣ στο PATCH, πριν από τη γραφή', () => {
  const route = readFileSync(join(process.cwd(), 'src/app/api/properties/[id]/route.ts'), 'utf8');

  it('καλείται πριν από το `withVersionCheck`, και ό,τι επιστρέφει μπαίνει στη γραφή', () => {
    const guard = route.indexOf('await assertPropertyAnchorWrite(');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(route.indexOf('await withVersionCheck('));
    expect(route).toContain('...anchorPatch');
  });

  it('η χοάνη σφαλμάτων περνά την άρνηση του φύλακα του πόρου (όχι 500)', () => {
    expect(route).toContain('asApiError(error)');
  });
});

describe('η άρνηση φτάνει στον άνθρωπο μεταφρασμένη — πάνω στα ΠΡΑΓΜΑΤΙΚΑ locale JSON', () => {
  it.each(['el', 'en'])('%s: το μήνυμα υπάρχει και δεν είναι το ίδιο το κλειδί', (language) => {
    const bundle = JSON.parse(readFileSync(join(process.cwd(), 'src/i18n/locales', language, 'building.json'), 'utf8')) as {
      policyErrors: Record<string, string>;
    };
    const t = (key: string) => bundle.policyErrors[key.replace('policyErrors.', '')] ?? key;
    const refusal = Object.assign(new Error('conflict'), { errorCode: POLICY_ERROR_CODES.PROPERTY_PROJECT_BOUNDARY });
    const message = policyErrorMessageOf(refusal, t);
    expect(message).not.toBeNull();
    expect(message).not.toContain('policyErrors.');
  });
});
