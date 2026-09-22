/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ ΚΑΤΟΠΤΡΟ ΤΩΝ CLAIMS ΓΡΑΦΕΤΑΙ ΑΠΟ ΤΟΝ ΕΝΑ ΓΡΑΦΕΑ** — ADR-853 §16 (Ε-Α).
 * @related lib/auth/claims-mirror-fields.ts · lib/auth/set-claims-with-mirror.ts
 *
 *   Π — τα πεδία ΠΑΡΑΓΟΝΤΑΙ από το `MATERIALISED_FIELDS` και συμφωνούν με τους κανόνες
 *   Τ — η καθαρή προβολή: απουσία ⇒ `null`, ποτέ «κράτα την παλιά τιμή»
 *   Γ — 🔴 ο γραφέας: claims και κάτοπτρο στην ΙΔΙΑ πράξη (το ζωντανό εύρημα της Τασίας)
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('server-only', () => ({}));

const seatGet = jest.fn();
jest.mock('@/lib/workspace/workspace-member-ref', () => ({
  workspaceMemberRef: (_db: unknown, companyId: string, uid: string) => ({
    path: `companies/${companyId}/workspace_members/${uid}`,
    get: () => seatGet(companyId, uid),
  }),
}));

const setCustomUserClaims = jest.fn().mockResolvedValue(undefined);
const mirrorSet = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({ collection: () => ({ doc: () => ({ set: mirrorSet }) }) }),
  getAdminAuth: () => ({ setCustomUserClaims }),
  isFirebaseAdminAvailable: () => true,
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { CLAIM_MIRRORED_FIELDS, claimMirrorOf } from '../claims-mirror-fields';
import { MATERIALISED_FIELDS } from '../identity-materialisation';
import { setClaimsWithMirror } from '../set-claims-with-mirror';

const RULES = join(__dirname, '..', '..', '..', '..', 'firestore.rules');

/** Τα πεδία που ελέγχει το `mirrorsOwnClaims` των κανόνων — η τρίτη πηγή, που δεν εισάγει TS. */
function rulesMirroredFields(): string[] {
  const rules = readFileSync(RULES, 'utf8');
  const body = /function mirrorsOwnClaims\(data\)\s*\{([\s\S]*?)\n\s*\}/.exec(rules)?.[1] ?? '';
  return [...body.matchAll(/data\.get\('(\w+)'/g)].map((m) => m[1]).sort();
}

beforeEach(() => {
  seatGet.mockReset();
  setCustomUserClaims.mockClear();
  mirrorSet.mockClear();
});

describe('Π — τα πεδία έχουν ΜΙΑ πηγή', () => {
  it('Π1 — ό,τι δηλώνει `claims` το `MATERIALISED_FIELDS`, και τίποτα άλλο', () => {
    const declared = Object.entries(MATERIALISED_FIELDS)
      .filter(([, owner]) => owner === 'claims')
      .map(([field]) => field);
    expect([...CLAIM_MIRRORED_FIELDS]).toEqual(declared);
    expect(CLAIM_MIRRORED_FIELDS.length).toBeGreaterThan(0);
  });

  it('Π2 — οι κανόνες (`mirrorsOwnClaims`) ελέγχουν ΑΚΡΙΒΩΣ τα ίδια πεδία', () => {
    const rules = rulesMirroredFields();
    expect(rules.length).toBeGreaterThan(0); // παρονομαστής: ο εξαγωγέας όντως βρήκε το σώμα
    expect([...CLAIM_MIRRORED_FIELDS].sort()).toEqual(rules);
  });

  it('Π3 — το `emailVerified` ΔΕΝ είναι πεδίο των claims (κάτοχος: Auth)', () => {
    expect(CLAIM_MIRRORED_FIELDS).not.toContain('emailVerified' as never);
  });
});

describe('Τ — η καθαρή προβολή', () => {
  it('Τ1 — claims με χώρο ⇒ το κάτοπτρο λέει ό,τι το claim', () => {
    expect(claimMirrorOf({ companyId: 'comp_x', globalRole: 'internal_user', permissions: ['a'] }))
      .toEqual({ companyId: 'comp_x', globalRole: 'internal_user' });
  });

  it.each([[{}], [{ companyId: null, globalRole: null }], [{ companyId: '', globalRole: '' }], [{ companyId: 42, globalRole: {} }]])(
    '🔴 Τ2 — απουσία / σκουπίδι (%j) ⇒ `null`, ΠΟΤΕ «κράτα την παλιά»',
    (claims) => {
      expect(claimMirrorOf(claims)).toEqual({ companyId: null, globalRole: null });
    },
  );
});

describe('Γ — ο ΕΝΑΣ γραφέας γράφει ΚΑΙ το κάτοπτρο', () => {
  it('🔴 Γ1 — το εύρημα Ε-Α: δίνεται χώρος ⇒ `companyId`/`globalRole` στο έγγραφο, στην ίδια πράξη', async () => {
    seatGet.mockResolvedValue({
      exists: true,
      data: () => ({ uid: 'u1', globalRole: 'internal_user', status: 'active', permissionSetIds: [] }),
    });
    const { claimsUpdatedAt } = await setClaimsWithMirror('u1', { companyId: 'comp_x', globalRole: 'internal_user' });

    expect(mirrorSet).toHaveBeenCalledTimes(1);
    const [written, opts] = mirrorSet.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(written).toMatchObject({ companyId: 'comp_x', globalRole: 'internal_user', claimsUpdatedAt });
    expect(opts).toEqual({ merge: true });
  });

  it('Γ2 — claim χωρίς χώρο ⇒ το κάτοπτρο γράφει `companyId: null` (δεν κρατά τον παλιό)', async () => {
    await setClaimsWithMirror('u2', { globalRole: 'external_user' });
    const [written] = mirrorSet.mock.calls[0] as [Record<string, unknown>];
    expect(written).toMatchObject({ companyId: null, globalRole: 'external_user' });
  });

  it('Γ3 — ΚΑΝΕΝΑ `emailVerified` / `permissions` από τον γραφέα claims', async () => {
    await setClaimsWithMirror('u3', { globalRole: 'external_user', permissions: ['admin_access'] });
    const [written] = mirrorSet.mock.calls[0] as [Record<string, unknown>];
    expect(written).not.toHaveProperty('emailVerified');
    expect(written).not.toHaveProperty('permissions');
  });
});
