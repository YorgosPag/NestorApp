/**
 * @jest-environment node
 *
 * ADR-943 §5.7 — δικαιούχοι marketplace: ΕΝΑΣ πωλητής ανά (πάροχος, χρήστης) ακόμη και με ταυτόχρονες εγγραφές
 * (κράτηση θέσης), και το webhook KYC ως σήμα — η εξουσιοδότηση από το API.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { MarketplaceCapability, PayeeAccount, PayeeRegistration } from '../payment-marketplace';
import { registerMarketplacePayee, syncPayeeFromKycSignal } from '../payment-payee-service';
import { paymentPayeeIdOf, payeeRecordOf, REGISTRATION_LEASE_MS } from '../payment-payee-store';
import type { PaymentProvider } from '../payment-provider';

type Doc = Record<string, unknown>;

/** Ελάχιστο Firestore μίας συλλογής: doc get/update · where(==).limit().get() · runTransaction(get/set/update). */
function fakeDb(docs: Record<string, Doc>) {
  const refOf = (id: string) => ({
    id,
    get: async () => ({ id, exists: id in docs, data: () => docs[id] }),
    update: async (patch: Doc) => { docs[id] = { ...docs[id], ...patch }; },
  });
  const db = {
    collection: () => ({
      doc: refOf,
      where: (field: string, _op: string, value: unknown) => ({
        limit: () => ({
          get: async () => ({
            docs: Object.entries(docs).filter(([, data]) => data[field] === value).map(([id, data]) => ({ id, data: () => data })),
          }),
        }),
      }),
    }),
    runTransaction: async <T>(work: (tx: unknown) => Promise<T>): Promise<T> => work({
      get: (ref: ReturnType<typeof refOf>) => ref.get(),
      set: (ref: ReturnType<typeof refOf>, data: Doc) => { docs[ref.id] = data; },
      update: (ref: ReturnType<typeof refOf>, patch: Doc) => { docs[ref.id] = { ...docs[ref.id], ...patch }; },
    }),
  };
  return db as unknown as Firestore;
}

const REGISTRATION: PayeeRegistration = {
  email: 'eng@example.test', phone: '+302100000000', description: 'Ενεργειακός επιθεωρητής', legalName: 'Μηχανικός Α',
  tradeName: 'Μηχανικός Α', taxNumber: '000000000', address: 'Αθήνα', iban: 'GR0000000000000000000000000',
  ibanBeneficiary: 'Μηχανικός Α', consumerToConsumer: false,
};

function providerWith(capability: Partial<MarketplaceCapability> | null): PaymentProvider {
  const provider: Partial<PaymentProvider> = {
    id: 'everypay',
    marketplace: capability === null ? null : {
      registerPayee: jest.fn(), readPayee: jest.fn(), ensureTransfer: jest.fn(), readTransfer: jest.fn(),
      releaseTransfer: jest.fn(), reconcileTransferReversal: jest.fn(), reconcilePaymentRefund: jest.fn(), ...capability,
    },
  };
  return provider as PaymentProvider;
}

const ACCOUNT: PayeeAccount = { reference: 'sel_1', status: 'unknown', kycProcessUrl: 'https://kyc/sel_1' };
const PAYEE_ID = paymentPayeeIdOf('everypay', 'uid_1');

describe('registerMarketplacePayee', () => {
  it('πρώτη φορά ⇒ πωλητής στον πάροχο και δικαιούχος με την αναφορά του — ΧΩΡΙΣ IBAN/ΑΦΜ στη βάση', async () => {
    const docs: Record<string, Doc> = {};
    const registerPayee = jest.fn().mockResolvedValue(ACCOUNT);
    const outcome = await registerMarketplacePayee(fakeDb(docs), providerWith({ registerPayee }), 'uid_1', REGISTRATION);
    expect(outcome).toMatchObject({ kind: 'registered', payee: { providerReference: 'sel_1', userId: 'uid_1' } });
    expect(registerPayee).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(docs)).not.toContain(REGISTRATION.iban);
    expect(JSON.stringify(docs)).not.toContain(REGISTRATION.taxNumber);
  });

  it('υπάρχει ήδη ⇒ επιστρέφεται, ΚΑΜΙΑ κλήση στον πάροχο', async () => {
    const docs: Record<string, Doc> = {};
    const registerPayee = jest.fn().mockResolvedValue(ACCOUNT);
    const db = fakeDb(docs);
    await registerMarketplacePayee(db, providerWith({ registerPayee }), 'uid_1', REGISTRATION);
    await expect(registerMarketplacePayee(db, providerWith({ registerPayee }), 'uid_1', REGISTRATION))
      .resolves.toMatchObject({ kind: 'existing' });
    expect(registerPayee).toHaveBeenCalledTimes(1);
  });

  it('ζωντανή κράτηση άλλου καλούντα ⇒ in-progress, ΚΑΜΙΑ κλήση· ληγμένη ⇒ αναλαμβάνεται', async () => {
    const now = Date.now();
    const reservation = (ageMs: number): Doc => ({
      payeeId: PAYEE_ID, userId: 'uid_1', provider: 'everypay', providerReference: null, status: 'unknown', kycStatus: 'unknown',
      kycProcessUrl: null, createdAt: new Date(now - ageMs).toISOString(), updatedAt: new Date(now - ageMs).toISOString(),
    });
    const registerPayee = jest.fn().mockResolvedValue(ACCOUNT);
    await expect(registerMarketplacePayee(fakeDb({ [PAYEE_ID]: reservation(1000) }), providerWith({ registerPayee }), 'uid_1', REGISTRATION))
      .resolves.toEqual({ kind: 'in-progress' });
    expect(registerPayee).not.toHaveBeenCalled();
    await expect(registerMarketplacePayee(
      fakeDb({ [PAYEE_ID]: reservation(REGISTRATION_LEASE_MS + 1000) }), providerWith({ registerPayee }), 'uid_1', REGISTRATION,
    )).resolves.toMatchObject({ kind: 'registered' });
  });

  it('χωρίς marketplace ⇒ marketplace-unavailable, καμία εγγραφή στη βάση', async () => {
    const docs: Record<string, Doc> = {};
    await expect(registerMarketplacePayee(fakeDb(docs), providerWith(null), 'uid_1', REGISTRATION))
      .resolves.toEqual({ kind: 'marketplace-unavailable' });
    expect(docs).toEqual({});
  });
});

describe('syncPayeeFromKycSignal', () => {
  const registered = (): Record<string, Doc> => ({
    [PAYEE_ID]: {
      payeeId: PAYEE_ID, userId: 'uid_1', provider: 'everypay', providerReference: 'sel_1', status: 'unknown',
      kycStatus: 'initial', kycProcessUrl: null, createdAt: '2026-11-16T10:00:00.000Z', updatedAt: '2026-11-16T10:00:00.000Z',
    },
  });
  const signal = { kind: 'payee-kyc', payeeReference: 'sel_1', kycStatus: 'verified', kycProcessUrl: null } as const;

  it('η εξουσιοδότηση από το API, η κατάσταση KYC από το σήμα· ίδιο σήμα ξανά ⇒ unchanged', async () => {
    const docs = registered();
    const readPayee = jest.fn().mockResolvedValue({ ...ACCOUNT, status: 'authorized' });
    const db = fakeDb(docs);
    await expect(syncPayeeFromKycSignal(db, providerWith({ readPayee }), signal)).resolves.toBe('payee-updated');
    expect(payeeRecordOf(PAYEE_ID, docs[PAYEE_ID])).toMatchObject({
      status: 'authorized', kycStatus: 'verified', kycProcessUrl: 'https://kyc/sel_1',
    });
    await expect(syncPayeeFromKycSignal(db, providerWith({ readPayee }), signal)).resolves.toBe('unchanged');
  });

  it('σήμα «verified» αλλά το API λέει suspended ⇒ ο δικαιούχος ΔΕΝ γίνεται authorized', async () => {
    const docs = registered();
    const readPayee = jest.fn().mockResolvedValue({ ...ACCOUNT, status: 'suspended' });
    await syncPayeeFromKycSignal(fakeDb(docs), providerWith({ readPayee }), signal);
    expect(docs[PAYEE_ID].status).toBe('suspended');
  });

  it('άγνωστος πωλητής ⇒ unknown, καμία κλήση στο API', async () => {
    const readPayee = jest.fn();
    await expect(syncPayeeFromKycSignal(fakeDb({}), providerWith({ readPayee }), signal)).resolves.toBe('unknown');
    expect(readPayee).not.toHaveBeenCalled();
  });
});
