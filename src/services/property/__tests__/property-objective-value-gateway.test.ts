/**
 * ADR-898 Φ3β-3 — **η πόρτα γραφής του γραφείου για την αντικειμενική** (`updatePropertyObjectiveValueWithPolicy`).
 *
 * Συμβόλαιο: ΔΕΝ πετά ποτέ — η ουρά της οθόνης θέλει αποτέλεσμα. 422 ⇒ οι κωδικοί · 403 ⇒ `locked` · άλλο 4xx ⇒
 * `other` · 5xx/δίκτυο ⇒ `failed` (επανάληψη). Κλειδωμένο ακίνητο ⇒ ούτε αίτημα δεν φεύγει (η ΜΙΑ λίστα, ADR-249).
 */

jest.mock('@/services/properties.service', () => ({
  createProperty: jest.fn(),
  deleteProperty: jest.fn(),
  updateProperty: jest.fn(),
  updatePropertyCoverage: jest.fn(),
  updateMultiplePropertiesOwner: jest.fn(),
}));
jest.mock('@/services/filesystem/file-mutation-gateway', () => ({ propagateEntityLabelRenameWithPolicy: jest.fn() }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { ApiClientError } from '@/lib/api/api-client-types';
import { updateProperty as updatePropertyRecord } from '@/services/properties.service';

import { updatePropertyObjectiveValueWithPolicy } from '../property-mutation-gateway';

const mockedUpdate = updatePropertyRecord as jest.MockedFunction<typeof updatePropertyRecord>;

const call = (commercialStatus: string | null = 'for-sale') =>
  updatePropertyObjectiveValueWithPolicy({ propertyId: 'prop_1', currentProperty: { commercialStatus }, patch: { hasElevator: true } });

const failWith = (status: number, body?: unknown) =>
  mockedUpdate.mockRejectedValue(new ApiClientError('x', status, undefined, undefined, undefined, undefined, body));

beforeEach(() => mockedUpdate.mockReset());

describe('updatePropertyObjectiveValueWithPolicy', () => {
  it('στέλνει ΜΟΝΟ το μπλοκ των δηλώσεων (ο server το εφαρμόζει σε συναλλαγή) · επιτυχία ⇒ `saved`', async () => {
    mockedUpdate.mockResolvedValue({ success: true });
    await expect(call()).resolves.toEqual({ kind: 'saved' });
    expect(mockedUpdate).toHaveBeenCalledWith('prop_1', { objectiveValueDeclarations: { hasElevator: true } });
  });

  it.each(['sold', 'rented'])('%s ⇒ `locked` χωρίς αίτημα', async (status) => {
    await expect(call(status)).resolves.toEqual({ kind: 'rejected', reasons: ['locked'] });
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('422 ⇒ οι κωδικοί του server· άγνωστος κωδικός ⇒ `other` (ποτέ ωμό κλειδί)', async () => {
    failWith(422, { violations: ['permitDateInFuture', 'whoKnows'] });
    await expect(call()).resolves.toEqual({ kind: 'rejected', reasons: ['permitDateInFuture', 'other'] });
  });

  it('403 ⇒ `locked` (πουλήθηκε στο μεταξύ) · 400 ⇒ `other` · 503/500 ⇒ `failed` (επανάληψη)', async () => {
    failWith(403);
    await expect(call()).resolves.toEqual({ kind: 'rejected', reasons: ['locked'] });
    failWith(400);
    await expect(call()).resolves.toEqual({ kind: 'rejected', reasons: ['other'] });
    failWith(503);
    await expect(call()).resolves.toEqual({ kind: 'failed' });
    mockedUpdate.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(call()).resolves.toEqual({ kind: 'failed' });
  });
});
