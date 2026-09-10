/**
 * @jest-environment node
 *
 * Άγκυρα — **Η ΜΙΑ ΑΠΟΦΑΣΗ «θέλει αυτόν τον τύπο; και με email;»** (ADR-849)
 *
 * Ελέγχει την πολιτική (`notification-preference-policy`) **και** τον τρόπο που τη
 * χρησιμοποιεί η απόφαση email (`emailSuppressionReason` · `decideEmailDelivery`), που
 * τη ρωτά και τη στιγμή της ουράς και τη στιγμή της αποστολής.
 */

import { EVENT_CATEGORY_MAP, NOTIFICATION_EVENT_TYPES } from '@/config/notification-events';
import { decideEmailDelivery, emailSuppressionReason } from '@/server/notifications/email-delivery-window';
import {
  categorySettingEnabled,
  emailModeFor,
} from '@/services/user-notification-settings/notification-preference-policy';
import {
  getDefaultNotificationSettings,
  type UserNotificationSettings,
} from '@/services/user-notification-settings/user-notification-settings.types';

const LISTING_MATCH = EVENT_CATEGORY_MAP[NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_LISTING_MATCH];
const MANDATE_DECIDED = EVENT_CATEGORY_MAP[NOTIFICATION_EVENT_TYPES.PROPERTIES_MANDATE_DECIDED];
const NEW_DEVICE_LOGIN = EVENT_CATEGORY_MAP[NOTIFICATION_EVENT_TYPES.SECURITY_NEW_DEVICE_LOGIN];

function base(): UserNotificationSettings {
  return getDefaultNotificationSettings('u1');
}

/** «Όχι email για ταιριάσματα αγγελιών» — ο κύριος διακόπτης μένει ανοιχτός. */
function listingMatchEmailsOff(): UserNotificationSettings {
  const settings = base();
  return { ...settings, emailCategories: { ...settings.emailCategories, properties: { demandListingMatch: 'off' } } };
}

/** Ο κύριος διακόπτης των ταιριασμάτων κλειστός (ούτε κουδούνι ούτε email). */
function listingMatchOff(settings: UserNotificationSettings = base()): UserNotificationSettings {
  return {
    ...settings,
    categories: { ...settings.categories, properties: { ...settings.categories.properties, demandListingMatch: false } },
  };
}

const ordinary = (setting?: typeof LISTING_MATCH) => ({ isMandatory: false, ...(setting ? { setting } : {}) });

describe('Π — η πολιτική (καθαρή)', () => {
  it('Π1 — κύριος διακόπτης: μόνο ρητό `false` κλείνει', () => {
    expect(categorySettingEnabled(base(), LISTING_MATCH)).toBe(true);
    expect(categorySettingEnabled(listingMatchOff(), LISTING_MATCH)).toBe(false);
    expect(categorySettingEnabled(base(), { category: 'properties', settingKey: 'newBuilding' })).toBe(true);
  });

  it('Π2 — email του τύπου: απουσία ⇒ `on`, μόνο το ρητό `off` σιγάζει', () => {
    expect(emailModeFor(base(), LISTING_MATCH)).toBe('on');
    expect(emailModeFor(listingMatchEmailsOff(), LISTING_MATCH)).toBe('off');
    expect(emailModeFor(listingMatchEmailsOff(), MANDATE_DECIDED)).toBe('on');
  });
});

describe('Σ — ο λόγος σίγασης: η σειρά είναι συμβόλαιο', () => {
  it('Σ1 🔑 — «όχι ταιριάσματα, ναι εντολές»', () => {
    const settings = listingMatchEmailsOff();
    expect(emailSuppressionReason(settings, ordinary(LISTING_MATCH))).toBe('type-email-disabled');
    expect(emailSuppressionReason(settings, ordinary(MANDATE_DECIDED))).toBeNull();
  });

  it('Σ2 — ο κύριος διακόπτης προηγείται του email του τύπου (λέει ΠΟΙΟΣ έκλεισε)', () => {
    expect(emailSuppressionReason(listingMatchOff(listingMatchEmailsOff()), ordinary(LISTING_MATCH))).toBe(
      'category-disabled',
    );
  });

  it('Σ3 — οι καθολικοί διακόπτες προηγούνται του τύπου', () => {
    const settings = { ...listingMatchEmailsOff(), emailEnabled: false };
    expect(emailSuppressionReason(settings, ordinary(LISTING_MATCH))).toBe('email-disabled');
    expect(emailSuppressionReason({ ...settings, globalEnabled: false }, ordinary(LISTING_MATCH))).toBe(
      'global-disabled',
    );
  });

  it('Σ4 🔴 — υποχρεωτικό ⇒ ΠΟΤΕ σίγαση, ό,τι κι αν λένε οι διακόπτες', () => {
    const settings = base();
    const locked: UserNotificationSettings = {
      ...settings,
      emailEnabled: false,
      categories: { ...settings.categories, security: { ...settings.categories.security, newDeviceLogin: false } },
      emailCategories: { ...settings.emailCategories, security: { newDeviceLogin: 'off' } },
    };
    expect(emailSuppressionReason(locked, { isMandatory: true, setting: NEW_DEVICE_LOGIN })).toBeNull();
  });

  it('Σ5 — χωρίς τύπο (έγγραφο πριν το ADR-849) ⇒ μόνο οι καθολικοί έλεγχοι, καμία μαντεψιά', () => {
    expect(emailSuppressionReason(listingMatchEmailsOff(), ordinary())).toBeNull();
  });
});

describe('Δ — η απόφαση παράδοσης ρωτά την ίδια πολιτική', () => {
  const now = new Date('2026-08-10T09:00:00Z');

  it('Δ1 — σιγασμένος τύπος ⇒ `suppressed` με τον λόγο', () => {
    expect(decideEmailDelivery(listingMatchEmailsOff(), { now, ...ordinary(LISTING_MATCH) })).toEqual({
      kind: 'suppressed',
      reason: 'type-email-disabled',
    });
  });

  it('Δ2 — ανοιχτός τύπος ⇒ η συχνότητα αποφασίζει όπως πριν (προεπιλογή `daily` ⇒ αναβολή)', () => {
    expect(decideEmailDelivery(listingMatchEmailsOff(), { now, ...ordinary(MANDATE_DECIDED) }).kind).toBe('defer');
  });

  it('Δ3 — υποχρεωτικό με σιγασμένο τύπο ⇒ ΤΩΡΑ', () => {
    const settings = { ...base(), emailCategories: { ...base().emailCategories, security: { newDeviceLogin: 'off' as const } } };
    expect(decideEmailDelivery(settings, { now, isMandatory: true, setting: NEW_DEVICE_LOGIN })).toEqual({
      kind: 'send-now',
    });
  });
});
