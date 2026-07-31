/**
 * ADR-742 — ο εκτελεστής παραδίδει **τον καλούντα**, όχι έναν ρόλο.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: όλη η απόφαση αποκάλυψης κρέμεται από **μία** μεταβλητή, το
 * `ctx.globalRole`. Τα υπόλοιπα tests αποδεικνύουν ότι η χαρτογράφηση κρίνει
 * σωστά *δεδομένου* ενός ρόλου — κανένα δεν αποδεικνύει ότι φτάνει εκεί ο
 * **σωστός** ρόλος.
 *
 * 🔴 Η αστοχία είναι απόλυτα αθόρυβη: ένα καρφωμένο `'super_admin'` στον
 * εκτελεστή θα έδινε σε **κάθε** χρήστη το ειλικρινές 403 — όλα τα endpoints θα
 * δούλευαν, όλα τα άλλα tests θα έμεναν πράσινα, και το μαντείο ύπαρξης θα ήταν
 * ξανά ανοιχτό για όλο το πεδίο ορισμού με μία γραμμή.
 */

var authCtx = {
  uid: 'user_1',
  companyId: 'comp_kalonta',
  email: 'giorgio@example.com',
  globalRole: 'internal_user',
  mfaEnrolled: true,
  isAuthenticated: true as const,
};

jest.mock('@/lib/auth', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) =>
      callback(request, authCtx, { cache: true }),
}));

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T>(h: T) => h,
}));

import { makeDxfRouteRunner } from '../_domain-route';

describe('makeDxfRouteRunner', () => {
  it('🔴 παραδίδει στη χαρτογράφηση ΤΟΝ ΚΑΛΟΥΝΤΑ, όχι σταθερό ρόλο', async () => {
    const seen: unknown[] = [];
    const run = makeDxfRouteRunner((_err, ctx) => {
      seen.push(ctx.globalRole);
      return { status: 500 } as never;
    });

    await run(
      {} as never,
      { permissions: 'dxf:files:view', onError: () => undefined },
      async () => {
        throw new Error('boom');
      },
    );

    expect(seen).toEqual(['internal_user']);
  });

  it('η καταγραφή βλέπει την ΑΛΗΘΕΙΑ — το ίδιο σφάλμα, πριν τη μεταμφίεση', async () => {
    const logged: unknown[] = [];
    const boom = new Error('Cross-tenant patch denied');
    const run = makeDxfRouteRunner(() => ({ status: 404 }) as never);

    await run(
      {} as never,
      { permissions: 'dxf:files:view', onError: (err) => logged.push(err) },
      async () => {
        throw boom;
      },
    );

    // Το log κρατά το ΙΔΙΟ αντικείμενο σφάλματος· η σιωπή αφορά μόνο το σύρμα.
    expect(logged).toEqual([boom]);
  });

  it('όταν δεν σκάει τίποτα, η απόκριση του endpoint περνά αυτούσια', async () => {
    const ok = { status: 200 } as never;
    const run = makeDxfRouteRunner(() => ({ status: 500 }) as never);

    const res = await run(
      {} as never,
      { permissions: 'dxf:files:view', onError: () => undefined },
      async () => ok,
    );

    expect(res).toBe(ok);
  });
});
