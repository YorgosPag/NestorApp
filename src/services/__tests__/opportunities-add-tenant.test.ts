/**
 * Ο κανόνας `crmCanCreate` απορρίπτει ευκαιρία χωρίς `companyId`. Η εταιρεία βγαίνει
 * από τον ενεργό χώρο, και ο υπεύθυνος είναι ο δημιουργός όταν δεν ορίστηκε άλλος.
 */

const mockSetDoc = jest.fn(async () => undefined);
const mockRequireAuthContext = jest.fn();
const mockResolveEffectiveCompanyId = jest.fn();

jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  setDoc: (...args: unknown[]) => (mockSetDoc as jest.Mock)(...args),
  doc: jest.fn(() => 'ref'),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  orderBy: jest.fn(),
  serverTimestamp: jest.fn(() => 'now'),
}));
jest.mock('@/services/enterprise-id.service', () => ({
  generateOpportunityId: () => 'opp_1',
}));
jest.mock('@/services/firestore', () => ({
  firestoreQueryService: { requireAuthContext: () => mockRequireAuthContext() },
  resolveEffectiveCompanyId: (ctx: unknown) => mockResolveEffectiveCompanyId(ctx),
}));

import { addOpportunity } from '../opportunities.service';

const INPUT = {
  title: 'Maria',
  contactId: '',
  assignedTo: '',
  status: 'active',
  stage: 'initial_contact',
} as const;

const writtenDoc = () => (mockSetDoc as jest.Mock).mock.calls[0][1] as Record<string, unknown>;

describe('addOpportunity — tenant και υπεύθυνος', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuthContext.mockResolvedValue({ uid: 'u1', companyId: 'comp_claim' });
    mockResolveEffectiveCompanyId.mockReturnValue('comp_workspace');
  });

  it('γράφει την εταιρεία του ενεργού χώρου και τον δημιουργό', async () => {
    await addOpportunity(INPUT);

    expect(writtenDoc()).toMatchObject({
      id: 'opp_1',
      companyId: 'comp_workspace',
      createdBy: 'u1',
      assignedTo: 'u1',
    });
  });

  it('σέβεται ρητό υπεύθυνο', async () => {
    await addOpportunity({ ...INPUT, assignedTo: 'u2' });

    expect(writtenDoc().assignedTo).toBe('u2');
  });

  it('super-admin χωρίς ζητούμενο χώρο: πέφτει στο claim του', async () => {
    mockResolveEffectiveCompanyId.mockReturnValue(null);

    await addOpportunity(INPUT);

    expect(writtenDoc().companyId).toBe('comp_claim');
  });

  it('χωρίς εταιρεία δεν γράφει τίποτα', async () => {
    mockResolveEffectiveCompanyId.mockReturnValue(null);
    mockRequireAuthContext.mockResolvedValue({ uid: 'u1', companyId: null });

    await expect(addOpportunity(INPUT)).rejects.toThrow('VALIDATION_ERROR');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});
