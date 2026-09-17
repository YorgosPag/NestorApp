/**
 * @jest-environment node
 *
 * =============================================================================
 * 🔑 ΑΓΚΥΡΑ: Η ΠΟΡΤΑ ΤΩΝ ΔΙΑΔΡΟΜΩΝ ΑΡΧΕΙΩΝ (ADR-866 §2.6.9 Β1)
 * =============================================================================
 *
 * | # | ερώτημα | μετάλλαξη που πιάνει |
 * |---|---|---|
 * | Π1 | άγνωστο είδος ⇒ **400**, και **καμία** πόρτα δεν ανοίγει; | `?? 'company'` μετά το `custodyKindFromParam` |
 * | Π2 | απουσία ⇒ **η εταιρική πόρτα** με **την ίδια** ικανότητα; | ανταλλαγή κλάδων |
 * | Π3 | `personal` ⇒ ο χειριστής παίρνει **μόνο** `uid`, ποτέ `companyId`; | `ctx: actor.ctx` στον προσωπικό κλάδο |
 * | Π4 | ο `userId` του αιτήματος **αγνοείται**; | ανάγνωση `?userId=` |
 *
 * Οι δύο πόρτες (`withAuth` · `withPersonalOrOrgAuth`) είναι mock που **καταγράφουν** ποια άνοιξε —
 * εδώ κρίνεται η **δρομολόγηση**, όχι η ταυτοποίηση (εκείνη έχει δικές της σουίτες).
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';

let opened: string[] = [];
let companyPermissions: unknown = null;

jest.mock('@/lib/auth', () => ({
  withAuth:
    (handler: (req: unknown, ctx: unknown, cache: unknown) => unknown, options: { permissions: unknown }) =>
    (req: unknown) => {
      opened.push('company');
      companyPermissions = options.permissions;
      return handler(req, { uid: 'uid_member', companyId: 'comp_1' }, {});
    },
}));

jest.mock('@/lib/auth/personal-scope-middleware', () => ({
  withPersonalOrOrgAuth:
    (handler: (req: unknown, actor: unknown) => unknown) =>
    (req: unknown) => {
      opened.push('personal');
      return handler(req, { scope: 'personal', ctx: { uid: 'uid_citizen' } });
    },
}));

import { withFileCustodyAuth, type FileCustodyCaller } from '../file-custody-route';

let seen: FileCustodyCaller[] = [];

const route = withFileCustodyAuth(
  async (_req, caller) => {
    seen.push(caller);
    return NextResponse.json({ ok: true });
  },
  { permissions: 'dxf:files:view' },
);

const call = (query: string) => route(new NextRequest(`http://localhost/api/download?fileId=f1${query}`));

beforeEach(() => {
  opened = [];
  seen = [];
  companyPermissions = null;
});

describe('Π — η πόρτα διαλέγει διαμέρισμα, δεν μαντεύει', () => {
  it('🔴 Π1 — άγνωστο είδος ⇒ 400, και ΚΑΜΙΑ πόρτα δεν άνοιξε', async () => {
    const response = await call('&custody=everyone');

    expect(response.status).toBe(400);
    expect(opened).toEqual([]);
    expect(seen).toEqual([]);
  });

  it('Π2 — χωρίς παράμετρο ⇒ η ΕΤΑΙΡΙΚΗ πόρτα, με την ΙΔΙΑ ικανότητα (μηδέν αλλαγή)', async () => {
    await call('');

    expect(opened).toEqual(['company']);
    expect(companyPermissions).toBe('dxf:files:view');
    expect(seen[0]?.custody).toBe('company');
  });

  it('🔑 Π3 — `personal` ⇒ ο χειριστής παίρνει ΜΟΝΟ `uid`', async () => {
    await call('&custody=personal');

    expect(opened).toEqual(['personal']);
    expect(seen).toEqual([{ custody: 'personal', uid: 'uid_citizen' }]);
  });

  it('🔴 Π4 — `userId` στο σύρμα ΑΓΝΟΕΙΤΑΙ: ο κάτοχος είναι η επαληθευμένη ταυτότητα', async () => {
    await call('&custody=personal&userId=uid_victim');

    expect(seen).toEqual([{ custody: 'personal', uid: 'uid_citizen' }]);
  });
});
