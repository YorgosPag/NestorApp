/**
 * Ο κύκλος ζωής στις αναγνώσεις του πράκτορα (ADR-281 · ADR-329 §3.9 · ADR-171).
 */

import {
  countLive,
  planLiveCount,
  retiredStatusNamed,
} from '../handlers/firestore-live-scope';
import { planScopedRead } from '../handlers/firestore-query-plan';
import type { AgenticContext, QueryFilter } from '../executor-shared-types';

const TENANT: QueryFilter = { field: 'companyId', operator: '==', value: 'co-1' };

const ctxOf = (isAdmin: boolean): AgenticContext =>
  ({ companyId: 'co-1', isAdmin, requestId: 'r', channel: 'test', channelSenderId: 's' }) as unknown as AgenticContext;

describe('retiredStatusNamed', () => {
  it('αναγνωρίζει ρητή αναφορά σε αρχείο ή κάδο', () => {
    expect(retiredStatusNamed([{ field: 'status', operator: '==', value: 'archived' }])).toBe(true);
    expect(retiredStatusNamed([{ field: 'status', operator: 'in', value: ['sold', 'deleted'] }])).toBe(true);
  });

  it('ζωντανή κατάσταση, άλλο πεδίο ή άρνηση δεν είναι ρητή αναφορά', () => {
    expect(retiredStatusNamed([{ field: 'status', operator: '==', value: 'sold' }])).toBe(false);
    expect(retiredStatusNamed([{ field: 'type', operator: '==', value: 'archived' }])).toBe(false);
    expect(retiredStatusNamed([{ field: 'status', operator: '!=', value: 'archived' }])).toBe(false);
  });
});

describe('planScopedRead — ο τέταρτος κρίκος', () => {
  it('συλλογή με κύκλο ζωής ⇒ μόνο ζωντανά', () => {
    const plan = planScopedRead({ collection: 'properties', filters: [] }, ctxOf(true));
    expect(plan).toMatchObject({ ok: true, liveOnly: true });
  });

  it('συλλογή χωρίς κύκλο ζωής ⇒ κανένας περιορισμός', () => {
    const plan = planScopedRead({ collection: 'tasks', filters: [] }, ctxOf(true));
    expect(plan).toMatchObject({ ok: true, liveOnly: false });
  });

  it('διαχειριστής που ονομάζει αποσυρμένη κατάσταση ⇒ τη βλέπει', () => {
    const plan = planScopedRead(
      { collection: 'properties', filters: [{ field: 'status', operator: '==', value: 'archived' }] },
      ctxOf(true),
    );
    expect(plan).toMatchObject({ ok: true, liveOnly: false });
  });

  it('🔴 μη διαχειριστής που ονομάζει αποσυρμένη κατάσταση ⇒ άρνηση', () => {
    const plan = planScopedRead(
      { collection: 'properties', filters: [{ field: 'status', operator: '==', value: 'archived' }] },
      ctxOf(false),
    );
    expect(plan.ok).toBe(false);
  });
});

describe('planLiveCount', () => {
  it('ελεύθερη κατάσταση ⇒ αφαίρεση δύο μετρήσεων', () => {
    const plan = planLiveCount([TENANT]);
    expect(plan.kind).toBe('subtract');
    expect(plan.kind === 'subtract' && plan.retired).toEqual([
      TENANT,
      { field: 'status', operator: 'in', value: ['deleted', 'archived'] },
    ]);
  });

  it('καρφωμένη κατάσταση ⇒ μία μέτρηση, χωρίς δεύτερο `in`', () => {
    const pinned: QueryFilter = { field: 'status', operator: 'in', value: ['sold'] };
    expect(planLiveCount([TENANT, pinned])).toEqual({ kind: 'single', filters: [TENANT, pinned] });
  });

  it('υπάρχον `not-in` διευρύνεται — `in` μαζί του θα το απέρριπτε το Firestore', () => {
    const plan = planLiveCount([TENANT, { field: 'status', operator: 'not-in', value: ['sold'] }]);
    expect(plan).toEqual({
      kind: 'single',
      filters: [TENANT, { field: 'status', operator: 'not-in', value: ['sold', 'deleted', 'archived'] }],
    });
  });
});

describe('countLive', () => {
  it('αφαιρεί τις αποσυρμένες από το σύνολο', async () => {
    const countOf = jest.fn(async (filters: readonly QueryFilter[]) =>
      filters.some((f) => f.field === 'status') ? 2 : 10,
    );
    expect(await countLive(countOf, [TENANT])).toBe(8);
  });

  it('μηδέν σύνολο ⇒ καμία δεύτερη μέτρηση', async () => {
    const countOf = jest.fn(async () => 0);
    expect(await countLive(countOf, [TENANT])).toBe(0);
    expect(countOf).toHaveBeenCalledTimes(1);
  });
});
