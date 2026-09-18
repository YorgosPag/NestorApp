/**
 * @jest-environment node
 *
 * Άγκυρα — **ΜΙΑ ΣΥΓΧΩΝΕΥΣΗ ΜΕ ΤΙΣ ΠΡΟΕΠΙΛΟΓΕΣ, ΓΙΑ ΔΙΑΚΟΜΙΣΤΗ ΚΑΙ ΠΕΛΑΤΗ** (ADR-849)
 *
 * **Μ0 — Η ΒΑΘΜΟΝΟΜΗΣΗ.** Εκτελεί την παλιά ρηχή συγχώνευση του διακομιστή και δείχνει
 * ότι έδινε `undefined` για διακόπτη που η οθόνη έβλεπε `true`.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));
jest.mock('firebase/firestore', () => ({ Timestamp: { fromDate: (date: Date) => date } }));
jest.mock('@/lib/firestore-now', () => ({ nowTimestamp: () => 'NOW' }));

import { mergeStoredSettings } from '@/server/notifications/user-notification-settings-store';
import { transformSettingsFromFirestore } from '@/services/user-notification-settings/user-notification-settings.mapper';
import { mergeNotificationSettings } from '@/services/user-notification-settings/user-notification-settings.merge';
import { getDefaultNotificationSettings } from '@/services/user-notification-settings/user-notification-settings.types';

/** Έγγραφο γραμμένο ΠΡΙΝ υπάρξει το `demandListingMatch`, με έναν διακόπτη κλειστό. */
const OLD_DOCUMENT = { categories: { properties: { statusChange: false } } };

describe('🔴 Μ0 — η παλιά ρηχή συγχώνευση έχανε κλειδιά', () => {
  it('Μ0 — εκτελεσμένη: `demandListingMatch` = undefined', () => {
    const defaults = getDefaultNotificationSettings('u1');
    const legacy = { ...defaults.categories, ...OLD_DOCUMENT.categories };
    expect(Reflect.get(legacy.properties, 'demandListingMatch')).toBeUndefined();
  });

  it('Μ1 🔑 — η νέα: ανά κλειδί — ο κλειστός μένει κλειστός, ο νέος παίρνει την προεπιλογή', () => {
    const merged = mergeNotificationSettings('u1', OLD_DOCUMENT);
    expect(merged.categories.properties.statusChange).toBe(false);
    expect(merged.categories.properties.demandListingMatch).toBe(true);
  });
});

describe('Ε — email ανά τύπο', () => {
  it('Ε1 — απουσία ⇒ κανένας τύπος σιγασμένος, και οι έξι κατηγορίες παρούσες', () => {
    // ADR-867 Β6 — έκτη κατηγορία: `network` (μηνύματα συνεργατών).
    expect(mergeNotificationSettings('u1', {}).emailCategories).toEqual({
      crm: {}, properties: {}, tasks: {}, security: {}, procurement: {}, network: {},
    });
  });

  it('Ε1β 🔴 — παλιό έγγραφο ΧΩΡΙΣ `network` ⇒ οι προεπιλογές της, ανοιχτές (καμία migration)', () => {
    const merged = mergeNotificationSettings('u1', { categories: { crm: { newLead: false } } });
    expect(merged.categories.network).toStrictEqual({ threadMessage: true, teamJoined: true });
    expect(merged.categories.crm.newLead).toBe(false);
  });

  it('Ε2 🔴 — μόνο ΓΝΩΣΤΑ κλειδιά με ΓΝΩΣΤΗ κατάσταση περνούν', () => {
    const merged = mergeNotificationSettings('u1', {
      emailCategories: { properties: { demandListingMatch: 'off', ghostKey: 'off', mandateDecided: 'maybe' } },
    });
    expect(merged.emailCategories.properties).toEqual({ demandListingMatch: 'off' });
  });
});

describe('Τ — τιμή λάθος τύπου ⇒ η προεπιλογή, ποτέ ό,τι έγραψε το έγγραφο', () => {
  it('Τ1 — `"false"` δεν είναι `false`, άγνωστη συχνότητα δεν περνά', () => {
    const merged = mergeNotificationSettings('u1', {
      globalEnabled: 'false',
      emailFrequency: 'hourly',
      quietHours: { enabled: true },
    });
    expect(merged.globalEnabled).toBe(true);
    expect(merged.emailFrequency).toBe('daily');
    expect(merged.quietHours).toEqual({ enabled: true, startTime: '22:00', endTime: '08:00' });
  });

  it('Τ2 — χωρίς έγγραφο ⇒ οι προεπιλογές αυτούσιες', () => {
    const merged = mergeNotificationSettings('u1', undefined);
    const defaults = getDefaultNotificationSettings('u1');
    expect({ ...merged, createdAt: 0, updatedAt: 0 }).toEqual({ ...defaults, createdAt: 0, updatedAt: 0 });
  });

  it('Τ3 — ημερομηνία Timestamp (οποιουδήποτε SDK) ⇒ Date', () => {
    const at = new Date('2026-09-10T10:00:00Z');
    expect(mergeNotificationSettings('u1', { createdAt: { toDate: () => at } }).createdAt).toEqual(at);
  });
});

describe('🔑 Ο — ΕΝΑΣ δρόμος: διακομιστής και πελάτης δίνουν ΤΗΝ ΙΔΙΑ απάντηση', () => {
  // Σταθερές ημερομηνίες: χωρίς αυτές οι δύο κλήσεις φτιάχνουν προεπιλογές με
  // διαφορά χιλιοστού — κόκκινο που δεν λέει τίποτα για τη συγχώνευση.
  const at = new Date('2026-09-10T10:00:00Z');
  const stored = {
    ...OLD_DOCUMENT,
    emailEnabled: false,
    emailCategories: { properties: { demandListingMatch: 'off' } },
    language: 'en',
    createdAt: at,
    updatedAt: at,
  };

  it('Ο1 — ο αναγνώστης του διακομιστή ≡ η συγχώνευση', () => {
    expect(mergeStoredSettings('u1', stored)).toEqual(mergeNotificationSettings('u1', stored));
  });

  it('Ο2 — ο μεταφραστής του πελάτη ≡ η συγχώνευση', () => {
    expect(transformSettingsFromFirestore(stored, 'u1')).toEqual(mergeNotificationSettings('u1', stored));
  });
});
