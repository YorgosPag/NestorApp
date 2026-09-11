/**
 * @jest-environment node
 *
 * Άγκυρα — **Ο ΟΡΧΗΣΤΡΩΤΗΣ ΑΠΟΘΗΚΕΥΕΙ ΤΟΝ ΧΩΡΟ-ΣΤΟΧΟ** (ADR-849 §6δ Β1)
 *
 * 🔴 **Γιατί υπάρχει**: ο τύπος εγγυάται ότι ο παραγωγός **δίνει** `workspace`· τίποτα
 * δεν εγγυόταν ότι το έγγραφο **τον κρατά**. Χωρίς αυτή την άγκυρα, η μετάλλαξη «σβήσε
 * το `workspace` από το `meta`» επιζούσε — και το `/n/{id}` θα ξανάβαζε σιωπηλά τον
 * χώρο του θεατή, με κάθε άλλη σουίτα πράσινη.
 *
 * Κόβονται **μόνο** τα σύνορα I/O (Firestore · ρυθμίσεις · σκέλος email)· ο ορχηστρωτής
 * τρέχει αληθινός.
 */

const mockCreate = jest.fn();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({ collection: () => ({ doc: () => ({ create: mockCreate }) }) }),
}));
jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
}));
jest.mock('@/server/notifications/user-notification-settings-store', () => ({
  loadUserNotificationSettings: async (userId: string) =>
    jest
      .requireActual('@/services/user-notification-settings/user-notification-settings.types')
      .getDefaultNotificationSettings(userId),
}));
jest.mock('@/server/notifications/notification-email-leg', () => ({
  queueNotificationEmail: jest.fn(async () => ({ kind: 'queued' })),
}));

import {
  NOTIFICATION_EVENT_TYPES,
  SOURCE_SERVICES,
} from '@/config/notification-events';
import { viewDestination } from '@/lib/notifications/notification-destination';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { orgWorkspace } from '@/types/workspace-membership';

const CONTENT = {
  eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_INTEREST,
  recipientId: 'u1',
  tenantId: 'comp_1',
  title: '1 άνθρωπος ψάχνει ακίνητο σαν το δικό σας',
  source: { service: SOURCE_SERVICES.CRM },
  eventId: 'prop_1:demand-band:1',
  entityId: 'prop_1',
} as const;

/** Το `meta` του εγγράφου που γράφτηκε — η **αλήθεια**, όχι το αίτημα. */
function storedMeta(): Record<string, unknown> {
  expect(mockCreate).toHaveBeenCalledTimes(1);
  return mockCreate.mock.calls[0][0].meta as Record<string, unknown>;
}

beforeEach(() => {
  mockCreate.mockReset();
  mockCreate.mockResolvedValue(undefined);
});

describe('🔴 Ο χώρος-στόχος ΓΡΑΦΕΤΑΙ στο έγγραφο', () => {
  it('Ο1 🔑 — προορισμός + χώρος ⇒ `meta.workspace` (ΟΧΙ `companyId` στην κορυφή)', async () => {
    await dispatchNotification({
      ...CONTENT,
      ...viewDestination('/properties/prop_1', orgWorkspace('comp_1')),
    });

    expect(storedMeta().workspace).toEqual({ kind: 'org', companyId: 'comp_1' });
    // ADR-787 Ε-3 §8: ετικέτα, ΠΟΤΕ δεύτερος άξονας απομόνωσης.
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('companyId');
    expect(mockCreate.mock.calls[0][0].actions).toEqual([
      { id: 'view', label: 'view', url: '/properties/prop_1' },
    ]);
  });

  it('Ο2 — χωρίς προορισμό και χωρίς χώρο ⇒ κανένα πεδίο (η Firestore απορρίπτει `undefined`)', async () => {
    await dispatchNotification({ ...CONTENT });

    expect(storedMeta()).not.toHaveProperty('workspace');
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('actions');
  });
});
