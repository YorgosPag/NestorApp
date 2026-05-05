/**
 * Tests for `address-corrections-telemetry.service`.
 *
 * Validates the public payload contract (`validateRecordCorrectionInput`) and
 * the Admin SDK write path. The Firebase Admin SDK is mocked at module level
 * so the test does not require credentials or a real Firestore.
 */

const setMock = jest.fn().mockResolvedValue(undefined);
const docMock = jest.fn(() => ({ set: setMock }));
const collectionMock = jest.fn(() => ({ doc: docMock }));
const getAdminFirestoreMock = jest.fn(() => ({ collection: collectionMock }));
const serverTimestampMock = jest.fn(() => ({ __sentinel: 'serverTimestamp' }));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => getAdminFirestoreMock(),
  FieldValue: { serverTimestamp: () => serverTimestampMock() },
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generateAddressCorrectionLogId: () => 'acl_test123',
}));

import {
  recordCorrection,
  validateRecordCorrectionInput,
  type RecordCorrectionInput,
} from '../address-corrections-telemetry.service';

const validInput: RecordCorrectionInput = {
  contextEntityType: 'contact',
  contextEntityId: 'cont_abc123',
  userInput: { street: 'Τσιμισκή 10', city: 'Θεσσαλονίκη' },
  nominatimResolved: { street: 'Τσιμισκή', number: '10', city: 'Θεσσαλονίκη' },
  confidence: 0.92,
  variantUsed: 2,
  partialMatch: false,
  action: 'accepted-top',
  fieldActions: { street: 'kept', city: 'kept' },
  durationFromInputToActionMs: 4500,
  undoOccurred: false,
  finalAddress: { street: 'Τσιμισκή 10', city: 'Θεσσαλονίκη' },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('validateRecordCorrectionInput', () => {
  it('accepts a fully-formed payload', () => {
    expect(() => validateRecordCorrectionInput(validInput)).not.toThrow();
  });

  it('rejects unknown contextEntityType', () => {
    expect(() =>
      validateRecordCorrectionInput({ ...validInput, contextEntityType: 'invalid' as never }),
    ).toThrow(/contextEntityType/);
  });

  it('rejects unknown action', () => {
    expect(() =>
      validateRecordCorrectionInput({ ...validInput, action: 'rejected-everything' as never }),
    ).toThrow(/action/);
  });

  it('rejects confidence outside [0,1]', () => {
    expect(() =>
      validateRecordCorrectionInput({ ...validInput, confidence: 1.5 }),
    ).toThrow(/confidence/);
    expect(() =>
      validateRecordCorrectionInput({ ...validInput, confidence: -0.1 }),
    ).toThrow(/confidence/);
  });

  it('rejects non-numeric duration', () => {
    expect(() =>
      validateRecordCorrectionInput({
        ...validInput,
        durationFromInputToActionMs: 'soon' as never,
      }),
    ).toThrow(/duration/);
  });

  it('rejects malformed fieldActions entry', () => {
    expect(() =>
      validateRecordCorrectionInput({
        ...validInput,
        fieldActions: { street: 'invalid-action' as never },
      }),
    ).toThrow(/fieldActions/);
  });

  it('rejects non-object payloads', () => {
    expect(() => validateRecordCorrectionInput(null)).toThrow();
    expect(() => validateRecordCorrectionInput(42)).toThrow();
  });
});

describe('recordCorrection', () => {
  it('writes a tenant-scoped doc with server timestamp and enterprise id', async () => {
    const result = await recordCorrection(validInput, {
      uid: 'user-1',
      companyId: 'company-a',
    });
    expect(result).toEqual({ success: true, id: 'acl_test123' });
    expect(collectionMock).toHaveBeenCalledWith('address_corrections_log');
    expect(docMock).toHaveBeenCalledWith('acl_test123');
    const written = setMock.mock.calls[0][0];
    expect(written.companyId).toBe('company-a');
    expect(written.userId).toBe('user-1');
    expect(written.contextEntityType).toBe('contact');
    expect(written.timestamp).toEqual({ __sentinel: 'serverTimestamp' });
    expect(written.acceptedSuggestionRank).toBeNull();
    // Companion guarantee — we never accept companyId/userId from the client.
    expect(written.companyId).not.toBe(
      (validInput as unknown as { companyId?: string }).companyId,
    );
  });

  it('preserves acceptedSuggestionRank when provided', async () => {
    await recordCorrection(
      { ...validInput, action: 'accepted-suggestion', acceptedSuggestionRank: 2 },
      { uid: 'user-1', companyId: 'company-a' },
    );
    const written = setMock.mock.calls[0][0];
    expect(written.acceptedSuggestionRank).toBe(2);
    expect(written.action).toBe('accepted-suggestion');
  });

  it('returns failure when Admin Firestore is unavailable', async () => {
    getAdminFirestoreMock.mockReturnValueOnce(null as never);
    const result = await recordCorrection(validInput, {
      uid: 'user-1',
      companyId: 'company-a',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('firestore-unavailable');
  });

  it('captures Firestore errors and returns failure object', async () => {
    setMock.mockRejectedValueOnce(new Error('boom'));
    const result = await recordCorrection(validInput, {
      uid: 'user-1',
      companyId: 'company-a',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/boom/);
  });
});
