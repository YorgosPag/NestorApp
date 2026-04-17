/**
 * Unit tests — updatePropertyWithPolicy cascade hook (Batch 30)
 *
 * Contract: when property.name changes in an update, fire a
 * `propagateEntityLabelRenameWithPolicy` side-effect via safeFireAndForget.
 * Cover: name diff detection, trim normalization, success/failure guard,
 * fire-and-forget isolation.
 *
 * Boundaries mocked:
 *  - `@/services/properties.service` — updatePropertyRecord returns success
 *  - `@/services/filesystem/file-mutation-gateway` — propagate spy
 *  - `@/lib/safe-fire-and-forget` — execute synchronously for determinism,
 *    swallow rejections (matches production semantics)
 *
 * Assert-policy (create/delete/link) is NOT under test here — that is
 * covered by type constraints and the service's own assertions.
 */

jest.mock('@/services/properties.service', () => ({
  createProperty: jest.fn(),
  deleteProperty: jest.fn(),
  updateProperty: jest.fn(),
  updatePropertyCoverage: jest.fn(),
  updateMultiplePropertiesOwner: jest.fn(),
}));

jest.mock('@/services/filesystem/file-mutation-gateway', () => ({
  propagateEntityLabelRenameWithPolicy: jest.fn(),
}));

jest.mock('@/lib/safe-fire-and-forget', () => ({
  safeFireAndForget: jest.fn((promise: Promise<unknown>) => {
    // Execute synchronously and swallow rejections so the test can assert
    // that updatePropertyWithPolicy's return value is NOT affected by a
    // failing propagation.
    promise.catch(() => {
      /* swallowed */
    });
  }),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
}));

import { updatePropertyWithPolicy } from '../property-mutation-gateway';
import { updateProperty as updatePropertyRecord } from '@/services/properties.service';
import { propagateEntityLabelRenameWithPolicy } from '@/services/filesystem/file-mutation-gateway';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { ENTITY_TYPES } from '@/config/domain-constants';

const mockedUpdateProperty = updatePropertyRecord as jest.MockedFunction<typeof updatePropertyRecord>;
const mockedPropagate = propagateEntityLabelRenameWithPolicy as jest.MockedFunction<
  typeof propagateEntityLabelRenameWithPolicy
>;
const mockedSafeFireAndForget = safeFireAndForget as jest.MockedFunction<typeof safeFireAndForget>;

const PROPERTY_ID = 'prop_1';

beforeEach(() => {
  mockedUpdateProperty.mockReset();
  mockedPropagate.mockReset();
  mockedSafeFireAndForget.mockClear();
});

describe('updatePropertyWithPolicy — entity rename cascade hook', () => {
  test('name change → propagate called with ENTITY_TYPES.PROPERTY and new label', async () => {
    mockedUpdateProperty.mockResolvedValue({ success: true });
    mockedPropagate.mockResolvedValue({ success: true });

    const result = await updatePropertyWithPolicy({
      propertyId: PROPERTY_ID,
      currentProperty: { name: 'Studio 35 m²' },
      updates: { name: 'Studio 40 m²' },
    });

    expect(result).toEqual({ success: true });
    expect(mockedPropagate).toHaveBeenCalledTimes(1);
    expect(mockedPropagate).toHaveBeenCalledWith({
      entityType: ENTITY_TYPES.PROPERTY,
      entityId: PROPERTY_ID,
      newEntityLabel: 'Studio 40 m²',
    });
    expect(mockedSafeFireAndForget).toHaveBeenCalledTimes(1);
  });

  test('name unchanged → propagate NOT called', async () => {
    mockedUpdateProperty.mockResolvedValue({ success: true });

    await updatePropertyWithPolicy({
      propertyId: PROPERTY_ID,
      currentProperty: { name: 'Studio 35 m²' },
      updates: { name: 'Studio 35 m²' },
    });

    expect(mockedPropagate).not.toHaveBeenCalled();
    expect(mockedSafeFireAndForget).not.toHaveBeenCalled();
  });

  test('only whitespace difference → trim normalizes, propagate NOT called', async () => {
    mockedUpdateProperty.mockResolvedValue({ success: true });

    await updatePropertyWithPolicy({
      propertyId: PROPERTY_ID,
      currentProperty: { name: 'Studio 35 m²' },
      updates: { name: '  Studio 35 m²  ' },
    });

    expect(mockedPropagate).not.toHaveBeenCalled();
  });

  test('updates.name missing (undefined) → propagate NOT called', async () => {
    mockedUpdateProperty.mockResolvedValue({ success: true });

    await updatePropertyWithPolicy({
      propertyId: PROPERTY_ID,
      currentProperty: { name: 'Studio 35 m²' },
      updates: { code: 'A1' },
    });

    expect(mockedPropagate).not.toHaveBeenCalled();
  });

  test('updatePropertyRecord returns success:false → propagate NOT called', async () => {
    mockedUpdateProperty.mockResolvedValue({ success: false });

    const result = await updatePropertyWithPolicy({
      propertyId: PROPERTY_ID,
      currentProperty: { name: 'Studio 35 m²' },
      updates: { name: 'Studio 40 m²' },
    });

    expect(result).toEqual({ success: false });
    expect(mockedPropagate).not.toHaveBeenCalled();
  });

  test('propagate rejects → safeFireAndForget isolates, main result unaffected', async () => {
    mockedUpdateProperty.mockResolvedValue({ success: true });
    mockedPropagate.mockRejectedValue(new Error('propagator blew up'));

    const result = await updatePropertyWithPolicy({
      propertyId: PROPERTY_ID,
      currentProperty: { name: 'Studio 35 m²' },
      updates: { name: 'Studio 40 m²' },
    });

    expect(result).toEqual({ success: true });
    expect(mockedSafeFireAndForget).toHaveBeenCalledTimes(1);
    // Let microtasks settle so the rejection is observed and swallowed.
    await Promise.resolve();
  });
});
