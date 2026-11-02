import type { AuthContext } from '@/lib/auth';
import { recordSentEmail } from '../record-sent-email';

const mockCreateEntity = jest.fn();
const mockContactGet = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => ({ doc: () => ({ get: mockContactGet }) }),
  }),
}));
jest.mock('@/lib/firestore/entity-creation.service', () => ({
  createEntity: (...args: unknown[]) => mockCreateEntity(...args),
}));

const SPEC = {
  auth: { uid: 'u1', companyId: 'comp_a' } as AuthContext,
  contactId: 'cont_1', opportunityId: 'opp_1',
  to: 'a@example.test', subject: 'Θέμα', content: 'Κείμενο', providerMessageId: 'mg_1',
};

describe('recordSentEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContactGet.mockResolvedValue({ exists: true, data: () => ({ companyId: 'comp_a' }) });
    mockCreateEntity.mockResolvedValue({ id: 'msg_1' });
  });

  it('γράφει το email με το contactId που διαβάζει το ιστορικό', async () => {
    await expect(recordSentEmail(SPEC)).resolves.toBe('msg_1');

    expect(mockCreateEntity).toHaveBeenCalledWith('sentEmailRecord', expect.objectContaining({
      auth: SPEC.auth,
      entitySpecificFields: expect.objectContaining({
        contactId: 'cont_1', opportunityId: 'opp_1',
        type: 'email', direction: 'outbound', status: 'sent', content: 'Κείμενο',
      }),
    }));
  });

  it('ίδιο id παρόχου δίνει ίδιο έγγραφο', async () => {
    await recordSentEmail(SPEC);
    await recordSentEmail(SPEC);

    const [first, second] = mockCreateEntity.mock.calls.map(([, params]) => params.explicitId);
    expect(first).toMatch(/^msg_/);
    expect(second).toBe(first);
  });

  it('επαφή άλλου tenant δεν γράφεται', async () => {
    mockContactGet.mockResolvedValue({ exists: true, data: () => ({ companyId: 'comp_b' }) });

    await expect(recordSentEmail(SPEC)).resolves.toBeNull();
    expect(mockCreateEntity).not.toHaveBeenCalled();
  });

  it('αποτυχία εγγραφής δεν ρίχνει, το email έχει ήδη φύγει', async () => {
    mockCreateEntity.mockRejectedValue(new Error('down'));

    await expect(recordSentEmail(SPEC)).resolves.toBeNull();
  });
});
