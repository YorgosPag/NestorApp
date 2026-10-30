/**
 * @jest-environment node
 *
 * @fileoverview **Ο envelope των μεταπτώσεων δίνει ΦΟΡΕΑ** (ADR-704 · ADR-195, 2026-10-30).
 * @related lib/admin-migration-runner.ts · lib/admin-batch-utils.ts (`flushInBatches` τον απαιτεί για συλλογές του CDC)
 *
 * 🔴 Ο envelope είχε το `ctx` αλλά έδινε στη μετάπτωση μόνο το `db` ⇒ καμία μετάπτωση δεν μπορούσε να σφραγίσει
 * τον διαχειριστή, και κάθε γραμμή CDC έλεγε `cdc_unknown`.
 *
 * | # | Άγκυρα | Μετάλλαξη που τη ρίχνει |
 * |---|---|---|
 * | Ε1 | το `run` λαμβάνει τον φορέα του `ctx`, λυμένο μία φορά | ο envelope περνά `undefined` |
 * | Ε2 | μη-bypass ρόλος ⇒ 403 χωρίς να λυθεί φορέας ή να τρέξει το `run` | ο φρουρός μετακινείται μετά το `run` |
 */

import type { Firestore } from 'firebase-admin/firestore';
import type { AuthContext } from '@/lib/auth/types';

const resolvePerformer = jest.fn(async (p: { uid: string; fallbackName: string | null }) => ({
  id: p.uid,
  name: p.fallbackName,
}));
const FAKE_DB = { fake: true } as unknown as Firestore;

jest.mock('@/server/lib/performer-stamp', () => ({ resolvePerformer: (p: never) => resolvePerformer(p) }));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => FAKE_DB }));
jest.mock('@/lib/auth/middleware', () => ({ withAuth: jest.fn() }));
jest.mock('@/lib/middleware/with-rate-limit', () => ({ withSensitiveRateLimit: jest.fn() }));
jest.mock('@/lib/auth/audit-convenience', () => ({ logMigrationExecuted: jest.fn() }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { runMigration } from '@/lib/admin-migration-runner';

const ctxOf = (globalRole: string): AuthContext =>
  ({ uid: 'user_admin', email: 'admin@example.com', globalRole }) as unknown as AuthContext;

beforeEach(() => resolvePerformer.mockClear());

describe('Ε1 — η μετάπτωση λαμβάνει τον διαχειριστή που την τρέχει', () => {
  it('🔴 το `run` παίρνει το `db` ΚΑΙ τον λυμένο φορέα του `ctx`', async () => {
    const run = jest.fn(async () => ({ body: {} }));

    const response = await runMigration({ ctx: ctxOf('super_admin'), dryRun: true, name: 'probe' }, run);

    expect(response.status).toBe(200);
    expect(resolvePerformer).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(FAKE_DB, { id: 'user_admin', name: 'admin@example.com' });
  });
});

describe('Ε2 — παρονομαστής: ο φρουρός ρόλου πρώτα', () => {
  it('🔑 μη-bypass ρόλος ⇒ 403, κανένας φορέας, κανένα `run`', async () => {
    const run = jest.fn(async () => ({ body: {} }));

    const response = await runMigration({ ctx: ctxOf('company_admin'), dryRun: false, name: 'probe' }, run);

    expect(response.status).toBe(403);
    expect(resolvePerformer).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });
});
