/**
 * Άγκυρα — **ΟΙ ΕΓΓΡΑΦΕΣ ΤΟΥ ΠΕΛΑΤΗ ΣΤΙΣ ΡΥΘΜΙΣΕΙΣ ΕΙΔΟΠΟΙΗΣΕΩΝ** (ADR-849 Α3)
 *
 * (Γ) *γράφει κάθε μέθοδος ΜΟΝΟ το πεδίο της;* — αλλιώς ένας διακόπτης θα έσβηνε τους υπόλοιπους·
 * (Φ) *μπορεί ο πελάτης να «κλείσει» υποχρεωτικό τύπο;* — δεν πρέπει: καμία επιφάνεια δεν το
 * προσφέρει, και η πολιτική θα τον έστελνε ούτως ή άλλως (υπόσχεση που δεν τηρείται).
 */

const mockUpdateDoc = jest.fn((..._args: unknown[]) => Promise.resolve());

jest.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}` }),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
}));
jest.mock('@/lib/firestore-now', () => ({ nowTimestamp: () => 'NOW' }));
jest.mock('@/services/realtime', () => ({ RealtimeService: { dispatch: jest.fn() } }));
jest.mock('@/services/firestore', () => ({ firestoreQueryService: { subscribeDoc: jest.fn() } }));

import type { Firestore } from 'firebase/firestore';

import { userNotificationSettingsService as service } from '@/services/user-notification-settings/UserNotificationSettingsService';

const MATCH = { category: 'properties', settingKey: 'demandListingMatch' } as const;
const NEW_DEVICE = { category: 'security', settingKey: 'newDeviceLogin' } as const;

function writtenFields(): unknown {
  expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  return mockUpdateDoc.mock.calls[0]?.[1];
}

beforeAll(() => service.initialize({} as Firestore));
beforeEach(() => mockUpdateDoc.mockClear());

describe('Γ — κάθε μέθοδος γράφει ΜΟΝΟ το πεδίο της', () => {
  it('Γ1 🔑 — email τύπου: ΜΟΝΟ `emailCategories.<κατ>.<κλειδί>` (+ updatedAt)', async () => {
    await service.setEmailTypeMode('u1', MATCH, 'off');
    expect(writtenFields()).toEqual({ 'emailCategories.properties.demandListingMatch': 'off', updatedAt: 'NOW' });
    expect(mockUpdateDoc.mock.calls[0]?.[0]).toEqual({ path: expect.stringMatching(/\/u1$/) });
  });

  it('Γ2 — ξανά `on`: ίδιο πεδίο, ίδια μορφή (idempotent)', async () => {
    await service.setEmailTypeMode('u1', MATCH, 'on');
    expect(writtenFields()).toEqual({ 'emailCategories.properties.demandListingMatch': 'on', updatedAt: 'NOW' });
  });

  it('Γ3 — κύριος διακόπτης: ΜΟΝΟ `categories.<κατ>.<κλειδί>`', async () => {
    await service.toggleCategorySetting('u1', { category: 'crm', setting: 'newLead', enabled: false });
    expect(writtenFields()).toEqual({ 'categories.crm.newLead': false, updatedAt: 'NOW' });
  });
});

describe('Φ — ο πελάτης δεν γράφει ό,τι δεν επιτρέπεται', () => {
  it('Φ1 🔴 — email υποχρεωτικού τύπου ⇒ άρνηση, ΚΑΜΙΑ εγγραφή', async () => {
    await expect(service.setEmailTypeMode('u1', NEW_DEVICE, 'off')).rejects.toThrow(/Mandatory/);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('Φ2 🔴 — κύριος διακόπτης υποχρεωτικού τύπου ⇒ άρνηση, ΚΑΜΙΑ εγγραφή', async () => {
    await expect(
      service.toggleCategorySetting('u1', { category: 'security', setting: 'passwordChange', enabled: false }),
    ).rejects.toThrow(/Mandatory/);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('Φ3 — άγνωστος διακόπτης (ή `__proto__`) ⇒ άρνηση, ΚΑΜΙΑ εγγραφή', async () => {
    for (const setting of ['ghost', '__proto__']) {
      await expect(
        service.toggleCategorySetting('u1', { category: 'crm', setting, enabled: false }),
      ).rejects.toThrow(/Unknown/);
    }
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});
