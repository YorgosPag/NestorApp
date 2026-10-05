/**
 * ADR-898 §21.6 Ε6 — **χώρος έργου δεν μετακινείται σε κτίριο άλλου έργου**. Ως τις 2026-10-05 το `PATCH {buildingId}`
 * δεχόταν οποιοδήποτε κτίριο και ο καταρράκτης ξανάγραφε σιωπηλά το έργο του χώρου.
 */

jest.mock('server-only', () => ({}));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { POLICY_ERROR_CODES } from '@/lib/policy/policy-error-codes';
import { policyErrorMessageOf } from '@/lib/policy/policy-error-translator';

import { assertBuildingInSpaceProject, projectOfSpace } from '../space-building-project-guard';

type Doc = Record<string, unknown>;

const BUILDINGS: Record<string, Doc> = {
  A: { projectId: 'prj_1' },
  B: { projectId: 'prj_1' },
  Z: { projectId: 'prj_2' },
  ORPHAN: {},
};

function fakeDb() {
  const read: string[] = [];
  const db = {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          read.push(`${name}/${id}`);
          return { data: () => (name === 'buildings' ? BUILDINGS[id] : undefined) };
        },
      }),
    }),
  };
  return { db: db as unknown as AdminFirestore, read };
}

const SPOT = { buildingId: 'A', projectId: 'prj_1' };

describe('assertBuildingInSpaceProject', () => {
  it('κτίριο ΑΛΛΟΥ έργου ⇒ 409 με κωδικό πολιτικής', async () => {
    const { db } = fakeDb();
    await expect(assertBuildingInSpaceProject(db, 'p5', { buildingId: 'Z' }, SPOT)).rejects.toMatchObject({
      statusCode: 409,
      errorCode: POLICY_ERROR_CODES.SPACE_BUILDING_OTHER_PROJECT,
    });
  });

  it('κτίριο χωρίς έργο · κτίριο που δεν υπάρχει ⇒ επίσης άρνηση (δεν είναι «του έργου του»)', async () => {
    const { db } = fakeDb();
    await expect(assertBuildingInSpaceProject(db, 'p5', { buildingId: 'ORPHAN' }, SPOT)).rejects.toMatchObject({ statusCode: 409 });
    await expect(assertBuildingInSpaceProject(db, 'p5', { buildingId: 'GHOST' }, SPOT)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('άλλο κτίριο του ΙΔΙΟΥ έργου ⇒ περνά (θέση ≠ ανάθεση)', async () => {
    const { db } = fakeDb();
    await expect(assertBuildingInSpaceProject(db, 'p5', { buildingId: 'B' }, SPOT)).resolves.toBeUndefined();
  });

  it('χώρος χωρίς δικό του έργο ⇒ κρίνεται με το έργο του ΚΤΙΡΙΟΥ του', async () => {
    const { db } = fakeDb();
    await expect(assertBuildingInSpaceProject(db, 'p5', { buildingId: 'Z' }, { buildingId: 'A' })).rejects.toMatchObject({ statusCode: 409 });
    await expect(assertBuildingInSpaceProject(db, 'p5', { buildingId: 'B' }, { buildingId: 'A' })).resolves.toBeUndefined();
  });

  it('ασύνδετος χώρος (ούτε έργο ούτε κτίριο) ⇒ ανάθεση οπουδήποτε', async () => {
    const { db } = fakeDb();
    await expect(assertBuildingInSpaceProject(db, 'p5', { buildingId: 'Z' }, {})).resolves.toBeUndefined();
  });

  it('σώμα που δεν αγγίζει το κτίριο · αποσύνδεση · ίδιο κτίριο ⇒ καμία ανάγνωση', async () => {
    const { db, read } = fakeDb();
    await assertBuildingInSpaceProject(db, 'p5', { number: 'Π-5' }, SPOT);
    await assertBuildingInSpaceProject(db, 'p5', { buildingId: null }, SPOT);
    await assertBuildingInSpaceProject(db, 'p5', { buildingId: 'A' }, SPOT);
    expect(read).toEqual([]);
  });
});

describe('projectOfSpace', () => {
  it('δικό του · του κτιρίου του · κανένα', async () => {
    const { db } = fakeDb();
    expect(await projectOfSpace(db, { projectId: 'prj_9', buildingId: 'A' })).toBe('prj_9');
    expect(await projectOfSpace(db, { buildingId: 'Z' })).toBe('prj_2');
    expect(await projectOfSpace(db, {})).toBeNull();
  });
});

describe('το 409 φτάνει στον άνθρωπο μεταφρασμένο — πάνω στα ΠΡΑΓΜΑΤΙΚΑ locale JSON', () => {
  it.each(['el', 'en'])('%s: το μήνυμα υπάρχει και δεν είναι το ίδιο το κλειδί', (language) => {
    const bundle = JSON.parse(readFileSync(join(process.cwd(), 'src/i18n/locales', language, 'building.json'), 'utf8')) as {
      policyErrors: Record<string, string>;
    };
    const t = (key: string) => bundle.policyErrors[key.replace('policyErrors.', '')] ?? key;
    const refusal = Object.assign(new Error('conflict'), { errorCode: POLICY_ERROR_CODES.SPACE_BUILDING_OTHER_PROJECT });
    const message = policyErrorMessageOf(refusal, t);
    expect(message).not.toBeNull();
    expect(message).not.toContain('policyErrors.');
  });
});
