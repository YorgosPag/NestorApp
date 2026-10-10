/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΑ — **το `DELETE /api/floors` δεν ισοπεδώνει τις αρνήσεις του** (ADR-910 §6.2).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-10, μετρημένο ζωντανά): η άρνηση «ενδιάμεσος όροφος» έβγαινε `422` **χωρίς** `errorCode`,
 * ενώ κάθε άλλη άρνηση της στοίβας φέρει `FLOOR_*` — και κάθε άλλη τυπωμένη άρνηση (π.χ. `409 DELETION_BLOCKED`,
 * όροφος με ακίνητα) γινόταν `500 «Failed to delete floor»`. Ο handler πρέπει να αφήνει την άρνηση να φτάσει
 * **όπως είναι** στο σύνορο σφαλμάτων (`withAuth` → `ApiErrorHandler`), που της βάζει τον κωδικό της.
 */

/* global describe, it, expect, beforeEach, jest */

import type { AuthContext } from '@/lib/auth';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { FLOOR_INTERMEDIATE } from '@/lib/floor/floor-stack-integrity';
import { removeFloor } from '../floor-removal';
import { handleDeleteFloor } from '../floors.handlers';

jest.mock('server-only', () => ({}));
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, body };
    }
  },
}));
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'TS' } }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));
jest.mock('@/lib/firestore/entity-creation.service', () => ({ createEntity: jest.fn() }));
jest.mock('@/lib/firestore/version-check', () => ({
  withVersionCheck: jest.fn(),
  ConflictError: class ConflictError extends Error {},
}));
jest.mock('../floors.shared', () => ({
  loadFloorInTenant: async () => ({ ref: {}, data: { buildingId: 'bld_1', companyId: 'co_1', number: 1 } }),
  buildFloorsQuery: jest.fn(),
  resolveFloorsListParams: jest.fn(),
  sortFloors: jest.fn(),
}));
jest.mock('../floor-removal', () => ({ removeFloor: jest.fn() }));

const remove = removeFloor as jest.MockedFunction<typeof removeFloor>;
const ctx = { uid: 'u_1', companyId: 'co_1', globalRole: 'user' } as unknown as AuthContext;

const del = () =>
  handleDeleteFloor(
    { url: 'http://localhost/api/floors?floorId=flr_1' } as unknown as Parameters<typeof handleDeleteFloor>[0],
    ctx,
  );

beforeEach(() => remove.mockReset());

describe('DELETE /api/floors — οι αρνήσεις φτάνουν με τον κωδικό τους', () => {
  it('Δ1 — 🔴 ενδιάμεσος όροφος ⇒ η ΙΔΙΑ τυπωμένη άρνηση (422 FLOOR_INTERMEDIATE), όχι χειρόγραφο σώμα χωρίς κωδικό', async () => {
    const refusal = new ApiError(422, 'Cannot delete an intermediate floor.', FLOOR_INTERMEDIATE);
    remove.mockRejectedValueOnce(refusal);

    await expect(del()).rejects.toBe(refusal);
  });

  it('Δ2 — 🔴 όροφος με εξαρτήσεις ⇒ 409 DELETION_BLOCKED φτάνει ως 409, όχι ως 500', async () => {
    const refusal = new ApiError(409, 'Ο όροφος έχει ακίνητα.', 'DELETION_BLOCKED');
    remove.mockRejectedValueOnce(refusal);

    await expect(del()).rejects.toMatchObject({ statusCode: 409, errorCode: 'DELETION_BLOCKED' });
  });

  it('Δ3 — άγνωστη αστοχία ⇒ 500 (δεν μεταμφιέζεται σε άρνηση)', async () => {
    remove.mockRejectedValueOnce(new Error('firestore unavailable'));

    expect(await del()).toMatchObject({ status: 500, body: { success: false, error: 'Failed to delete floor' } });
  });

  it('Δ4 — επιτυχία ⇒ 200', async () => {
    remove.mockResolvedValueOnce(undefined);

    expect(await del()).toMatchObject({ status: 200, body: { success: true } });
  });
});
