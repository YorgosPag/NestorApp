/**
 * Άγκυρα — **EMAIL ΑΝΑ ΤΥΠΟ ΣΤΗ ΣΕΛΙΔΑ ΠΡΟΤΙΜΗΣΕΩΝ** (ADR-849 Α2)
 *
 * Δύο ερωτήσεις: (Μ) *έχει το μητρώο γραμμή για ΚΑΘΕ διακόπτη του μοντέλου, με ετικέτα και
 * στις δύο γλώσσες;* — αλλιώς ο σύνδεσμος «Να μη λαμβάνω τέτοια email» ανοίγει σελίδα χωρίς
 * τη γραμμή του· (Δ) *κάνει κάθε διακόπτης ό,τι λέει;*
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key}|${JSON.stringify(options)}` : key),
  }),
}));

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { EmailTypePreferences, emailTypeRow } from '@/components/notifications/EmailTypePreferences';
import { NOTIFICATION_PREFERENCE_GROUPS } from '@/config/notification-preference-rows';
import authEl from '@/i18n/locales/el/auth.json';
import authEn from '@/i18n/locales/en/auth.json';
import commonAccountEl from '@/i18n/locales/el/common-account.json';
import commonAccountEn from '@/i18n/locales/en/common-account.json';
import { getDefaultNotificationSettings } from '@/services/user-notification-settings/user-notification-settings.types';

const MATCH = 'properties.demandListingMatch';

/** `'ns:a.b.c'` → η τιμή του `a.b.c` στο bundle — ή `undefined`. */
function resolve(bundle: unknown, fullKey: string): unknown {
  const path = fullKey.slice(fullKey.indexOf(':') + 1);
  return path.split('.').reduce<unknown>(
    (node, part) => (typeof node === 'object' && node !== null ? Reflect.get(node, part) : undefined),
    bundle,
  );
}

describe('Μ — το μητρώο γραμμών είναι ΠΛΗΡΕΣ', () => {
  it('Μ1 🔴 — κάθε διακόπτης του μοντέλου εμφανίζεται ΑΚΡΙΒΩΣ μία φορά', () => {
    const model = Object.entries(getDefaultNotificationSettings('u').categories)
      .flatMap(([category, row]) => Object.keys(row).map((key) => `${category}.${key}`))
      .sort();
    const registry = NOTIFICATION_PREFERENCE_GROUPS
      .flatMap((group) => group.settings.map((row) => `${group.category}.${row.key}`))
      .sort();
    expect(registry).toEqual(model);
  });

  it('Μ2 — κάθε ετικέτα υπάρχει ΚΑΙ στα ελληνικά ΚΑΙ στα αγγλικά', () => {
    for (const group of NOTIFICATION_PREFERENCE_GROUPS) {
      for (const key of [group.titleKey, group.descriptionKey, ...group.settings.map((row) => row.labelKey)]) {
        expect([key, typeof resolve(commonAccountEl, key), typeof resolve(commonAccountEn, key)]).toEqual([
          key,
          'string',
          'string',
        ]);
      }
    }
  });

  it('Μ3 — τα νέα κλειδιά της σελίδας υπάρχουν και στις δύο γλώσσες', () => {
    for (const key of ['title', 'focusTitle', 'allTitle', 'always', 'emailsOffNote']) {
      expect(typeof resolve(authEl, `auth:emailPreferences.types.${key}`)).toBe('string');
      expect(typeof resolve(authEn, `auth:emailPreferences.types.${key}`)).toBe('string');
    }
  });
});

describe('Δ — οι διακόπτες', () => {
  function renderPrefs(overrides: Partial<React.ComponentProps<typeof EmailTypePreferences>> = {}) {
    const onToggle = jest.fn();
    render(<EmailTypePreferences mutedTypes={[]} focus={[]} emailsOn busy={false} onToggle={onToggle} {...overrides} />);
    return onToggle;
  }
  const switchById = (id: string): HTMLElement => {
    const element = document.getElementById(id);
    if (element === null) throw new Error(`Δεν βρέθηκε διακόπτης ${id} — η άγκυρα δεν κοίταξε τίποτα.`);
    return element;
  };

  it('Δ1 🔑 — ο τύπος του email ΜΠΡΟΣΤΑ, και το κλείσιμό του ζητά ΜΟΝΟ αυτόν', () => {
    const onToggle = renderPrefs({ focus: [MATCH] });
    expect(screen.getByText('auth:emailPreferences.types.focusTitle')).toBeTruthy();
    fireEvent.click(switchById(`focus-${MATCH}`));
    expect(onToggle).toHaveBeenCalledWith(MATCH, 'off');
  });

  it('Δ2 — σιγασμένος τύπος: κλειστός διακόπτης, και το άνοιγμα ζητά `on`', () => {
    const onToggle = renderPrefs({ mutedTypes: [MATCH] });
    const toggle = switchById(`all-${MATCH}`);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith(MATCH, 'on');
  });

  it('Δ3 🔴 — υποχρεωτικοί τύποι: «Πάντα», ΚΑΝΕΝΑΣ διακόπτης', () => {
    renderPrefs();
    expect(document.getElementById('all-security.newDeviceLogin')).toBeNull();
    expect(screen.getAllByText('auth:emailPreferences.types.always')).toHaveLength(4);
  });

  it('Δ4 — email καθολικά κλειστά: διακόπτες απενεργοποιημένοι, τιμές ορατές, εξήγηση', () => {
    renderPrefs({ emailsOn: false, mutedTypes: [MATCH] });
    const toggle = switchById(`all-${MATCH}`);
    expect(toggle.hasAttribute('disabled')).toBe(true);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('auth:emailPreferences.types.emailsOffNote')).toBeTruthy();
  });

  it('Δ5 — χωρίς εμβέλεια: καμία ενότητα «αυτού του μηνύματος»', () => {
    renderPrefs();
    expect(screen.queryByText('auth:emailPreferences.types.focusTitle')).toBeNull();
  });

  it('Δ6 — η γραμμή ενός διακόπτη: γνωστός ⇒ η ετικέτα του, άγνωστος ⇒ null', () => {
    expect(emailTypeRow(MATCH)?.labelKey).toBe(
      'common-account:account.notificationSettings.categories.properties.demandListingMatch',
    );
    expect(emailTypeRow('properties.ghost')).toBeNull();
  });
});
