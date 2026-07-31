/**
 * ADR-742 Φάση Β — το **ένατο σημείο**: `setBackgroundScale`.
 *
 * ΤΙ ΗΤΑΝ: η υπηρεσία κλίμακας έγραφε τη δική της τετράδα γραμμών μέσα στη
 * συναλλαγή και τερμάτιζε με `throw new Error('Cross-tenant scale write denied')`
 * — **σκέτο `Error`**. Το route δεν είχε άλλον τρόπο να το αναγνωρίσει από το
 * να ψάξει `msg.includes('Cross-tenant')`: μια αθώα αλλαγή διατύπωσης θα
 * μετέτρεπε σιωπηλά την άρνηση ασφαλείας σε `500`, και κανένα test δεν θα
 * κοκκίνιζε.
 *
 * ΤΙ ΦΥΛΑΕΙ ΤΟ ΑΡΧΕΙΟ: ότι η υπηρεσία **δεν ξαναγράφει** τον έλεγχο αλλά καλεί
 * τον SSoT, και ότι το σφάλμα φτάνει στο route **τυποποιημένο**, με τα δομημένα
 * πεδία που χρειάζεται η μεταμφίεση.
 */

const mockTxGet = jest.fn();
const mockTxUpdate = jest.fn();

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => ({ doc: (id: string) => ({ id }) }),
    runTransaction: async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({ get: mockTxGet, update: mockTxUpdate }),
  }),
}));

import { setBackgroundScale } from '../floorplan-scale.service';
import { BackgroundNotFoundError } from '../background-ownership';
import { CrossTenantAccessError } from '@/lib/auth/tenant-ownership';

const BG_ID = 'bg_01K9ZQ7X8N4M2P';
const CALLER_COMPANY = 'comp_kalonta';
const OWNER_COMPANY = 'comp_allou';

const VALID_INPUT = {
  companyId: CALLER_COMPANY,
  backgroundId: BG_ID,
  scale: { unitsPerMeter: 1000, sourceUnit: 'mm' } as const,
  updatedBy: 'user_1',
};

function snapshot(row: Record<string, unknown> | null) {
  return { exists: row !== null, data: () => row ?? {} };
}

beforeEach(() => {
  mockTxGet.mockReset();
  mockTxUpdate.mockReset();
});

describe('setBackgroundScale — ιδιοκτησία μέσα στη συναλλαγή', () => {
  it('δικό μας υπόβαθρο ⇒ γράφει την κλίμακα', async () => {
    mockTxGet.mockResolvedValue(snapshot({ companyId: CALLER_COMPANY }));

    await expect(setBackgroundScale(VALID_INPUT)).resolves.toEqual({
      unitsPerMeter: 1000,
      sourceUnit: 'mm',
    });
    expect(mockTxUpdate).toHaveBeenCalledTimes(1);
  });

  it('🔴 ξένο υπόβαθρο ⇒ ΤΥΠΟΠΟΙΗΜΕΝΟ CrossTenantAccessError, όχι σκέτο Error', async () => {
    mockTxGet.mockResolvedValue(snapshot({ companyId: OWNER_COMPANY }));

    await expect(setBackgroundScale(VALID_INPUT)).rejects.toBeInstanceOf(CrossTenantAccessError);
    // Καμία εγγραφή δεν έφυγε.
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('το σφάλμα κουβαλά το resourceId — χωρίς αυτό το route δεν μπορεί να μεταμφιεστεί', async () => {
    mockTxGet.mockResolvedValue(snapshot({ companyId: OWNER_COMPANY }));

    let caught: unknown;
    try {
      await setBackgroundScale(VALID_INPUT);
    } catch (err) {
      caught = err;
    }

    const err = caught as CrossTenantAccessError;
    expect(err.resourceId).toBe(BG_ID);
    expect(err.expectedCompanyId).toBe(CALLER_COMPANY);
    expect(err.actualCompanyId).toBe(OWNER_COMPANY);
    expect(err.message).toBe('Cross-tenant scale write denied');
  });

  it('ανύπαρκτο υπόβαθρο ⇒ BackgroundNotFoundError, ΟΧΙ cross-tenant', async () => {
    mockTxGet.mockResolvedValue(snapshot(null));

    const promise = setBackgroundScale(VALID_INPUT);

    await expect(promise).rejects.toBeInstanceOf(BackgroundNotFoundError);
    await expect(promise).rejects.not.toBeInstanceOf(CrossTenantAccessError);
  });

  it('🔴 υπόβαθρο με κενό companyId ΔΕΝ ανήκει σε καλούντα με χαλασμένο token', async () => {
    // Η παγίδα του κενού (ADR-742 §4) — `'' === ''` θα περνούσε.
    mockTxGet.mockResolvedValue(snapshot({ companyId: '' }));

    await expect(
      setBackgroundScale({ ...VALID_INPUT, companyId: '' }),
    ).rejects.toBeInstanceOf(CrossTenantAccessError);
  });

  it('άκυρη κλίμακα απορρίπτεται ΠΡΙΝ ανοίξει συναλλαγή', async () => {
    await expect(
      setBackgroundScale({ ...VALID_INPUT, scale: { unitsPerMeter: 0, sourceUnit: 'mm' } }),
    ).rejects.toThrow('Invalid scale.unitsPerMeter');
    expect(mockTxGet).not.toHaveBeenCalled();
  });
});
