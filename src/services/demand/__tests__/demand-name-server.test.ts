/**
 * ADR-887 — το όνομα της ζήτησης στον server: στη γλώσσα του παραλήπτη, το ανθρώπινο αυτούσιο, και
 * βλάβη ανάγνωσης γλώσσας ⇒ προεπιλογή, ποτέ σιωπή.
 */

const loadUserNotificationSettingsMany = jest.fn();

jest.mock('@/server/notifications/user-notification-settings-store', () => ({
  loadUserNotificationSettingsMany: (...args: unknown[]) => loadUserNotificationSettingsMany(...args),
}));
jest.mock('@/lib/intl-formatting', () => ({
  formatCurrency: (amount: number) => `${amount} €`,
}));

// eslint-disable-next-line import/first -- τα mocks πρέπει να δηλωθούν πριν τα imports
import { demand, seek } from '@/lib/demand/__tests__/demand-fixtures';
import { demandNamerFor, loadDemandNamer } from '../demand-name-server';

const RENT_KORDELIO = demand({
  authorUserId: 'usr_en',
  seeks: [seek('leaseOut', { max: 900 })],
  place: { kind: 'near', center: { lat: 40.67, lng: 22.9 }, radiusKm: 3 },
  placeLabel: 'Κορδελιό, Θεσσαλονίκη 563 34',
  title: null,
});

beforeEach(() => jest.clearAllMocks());

describe('demandNamerFor — η γλώσσα του παραλήπτη', () => {
  it('el ⇒ ελληνικό αυτόματο όνομα · en ⇒ αγγλικό · άγνωστη ⇒ el', () => {
    expect(demandNamerFor('el')(RENT_KORDELIO)).toMatch(/^Ενοικίαση · Κορδελιό · έως 900 €/);
    expect(demandNamerFor('en')(RENT_KORDELIO)).toMatch(/^Rental · Κορδελιό · /);
    expect(demandNamerFor('xx')(RENT_KORDELIO)).toBe(demandNamerFor('el')(RENT_KORDELIO));
  });

  it('🔑 το όνομα του ανθρώπου περνά αυτούσιο, σε κάθε γλώσσα', () => {
    const named = { ...RENT_KORDELIO, title: 'Για τη Μαρία' };
    expect(demandNamerFor('en')(named)).toBe('Για τη Μαρία');
  });

  it('🔴 κανένα ωμό κλειδί μέσα στο όνομα (και στις δύο γλώσσες)', () => {
    for (const language of ['el', 'en']) {
      expect(demandNamerFor(language)(RENT_KORDELIO)).not.toMatch(/property-market:|properties-enums:|common:/);
    }
  });
});

describe('loadDemandNamer — ΜΙΑ ανάγνωση, γλώσσα ανά συγγραφέα', () => {
  it('ονομάζει κάθε ζήτηση στη γλώσσα του ΔΙΚΟΥ της συγγραφέα', async () => {
    loadUserNotificationSettingsMany.mockResolvedValue(new Map([['usr_en', { language: 'en' }]]));
    const nameOf = await loadDemandNamer(['usr_en', 'usr_el']);

    expect(loadUserNotificationSettingsMany).toHaveBeenCalledTimes(1);
    expect(nameOf(RENT_KORDELIO)).toMatch(/^Rental/);
    expect(nameOf({ ...RENT_KORDELIO, authorUserId: 'usr_el' })).toMatch(/^Ενοικίαση/);
  });

  it('🔴 βλάβη ανάγνωσης ⇒ προεπιλεγμένη γλώσσα, ΠΟΤΕ εξαίρεση (η ειδοποίηση δεν χάνεται)', async () => {
    loadUserNotificationSettingsMany.mockRejectedValue(new Error('unavailable'));
    const nameOf = await loadDemandNamer(['usr_en']);
    expect(nameOf(RENT_KORDELIO)).toMatch(/^Ενοικίαση/);
  });
});
