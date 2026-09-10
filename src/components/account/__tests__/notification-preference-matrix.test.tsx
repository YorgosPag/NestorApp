/**
 * Άγκυρα — **Η ΜΗΤΡΑ ΠΡΟΤΙΜΗΣΕΩΝ ΤΗΣ ΟΘΟΝΗΣ ΡΥΘΜΙΣΕΩΝ** (ADR-849 Α3)
 *
 * Τρεις ερωτήσεις: (Π) *λέει η οθόνη την αλήθεια;* — κανένας διακόπτης για ό,τι δεν κλείνει, κανένα
 * email ενεργό για τύπο που ο άνθρωπος έκλεισε ολόκληρο· (Δ) *κάνει κάθε διακόπτης ό,τι λέει;*·
 * (Ο) *έχει κάθε διακόπτης όνομα;* — «Νέο lead, Και με email», όχι «διακόπτης».
 */

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { NotificationPreferenceMatrix, preferenceRowId } from '@/components/account/NotificationPreferenceMatrix';
import { DELIVERY_CONTROL_IDS, FREQUENCY_LABEL_KEYS } from '@/components/account/notification-settings-config';
import { emptyEmailCategories } from '@/services/user-notification-settings/user-notification-settings.email-types';
import { PREFERENCE_TABLE } from '@/services/user-notification-settings/notification-preference-table';
import {
  getDefaultNotificationSettings,
  type UserNotificationSettings,
} from '@/services/user-notification-settings/user-notification-settings.types';

const PREFS = 'common-account:account.notificationSettings.preferences';
const MATCH = 'properties.demandListingMatch';
const MATCH_REF = { category: 'properties', settingKey: 'demandListingMatch' };
const MATCH_LABEL = 'common-account:account.notificationSettings.categories.properties.demandListingMatch';
const LEAD = 'crm.newLead';

const MANDATORY_ROWS = PREFERENCE_TABLE.flatMap(({ rows }) => rows.filter((row) => row.mandatory));

function settingsWith(patch: Partial<UserNotificationSettings> = {}): UserNotificationSettings {
  return { ...getDefaultNotificationSettings('u'), ...patch };
}

/** Ταίριασμα σιγασμένο για email — ο κύριος διακόπτης του μένει ανοιχτός. */
function matchEmailMuted(patch: Partial<UserNotificationSettings> = {}): UserNotificationSettings {
  return settingsWith({ emailCategories: { ...emptyEmailCategories(), properties: { demandListingMatch: 'off' } }, ...patch });
}

function renderMatrix(settings: UserNotificationSettings = settingsWith()) {
  const onTypeEnabled = jest.fn();
  const onTypeEmail = jest.fn();
  render(<NotificationPreferenceMatrix settings={settings} onTypeEnabled={onTypeEnabled} onTypeEmail={onTypeEmail} />);
  return { onTypeEnabled, onTypeEmail };
}

function cell(path: string, column: 'notify' | 'email'): HTMLElement {
  const element = document.getElementById(`${preferenceRowId(path)}-${column}`);
  if (element === null) throw new Error(`Δεν βρέθηκε διακόπτης ${path}/${column} — η άγκυρα δεν κοίταξε τίποτα.`);
  return element;
}

describe('Π — η οθόνη λέει την αλήθεια', () => {
  it('Π1 — κάθε μη υποχρεωτική γραμμή του πίνακα έχει ΔΥΟ διακόπτες', () => {
    renderMatrix();
    const rows = PREFERENCE_TABLE.flatMap((entry) => entry.rows).filter((row) => !row.mandatory);
    expect(rows.length).toBeGreaterThan(20);
    for (const row of rows) {
      expect(cell(row.path, 'notify').getAttribute('role')).toBe('switch');
      expect(cell(row.path, 'email').getAttribute('role')).toBe('switch');
    }
  });

  it('Π2 🔴 — υποχρεωτικοί τύποι: ΚΑΝΕΝΑΣ διακόπτης, «Πάντα» και στις δύο στήλες, ορατή εξήγηση', () => {
    renderMatrix();
    expect(MANDATORY_ROWS).toHaveLength(4);
    for (const row of MANDATORY_ROWS) {
      expect(document.getElementById(`${preferenceRowId(row.path)}-notify`)).toBeNull();
      expect(document.getElementById(`${preferenceRowId(row.path)}-email`)).toBeNull();
    }
    expect(screen.getAllByText(`${PREFS}.always`)).toHaveLength(MANDATORY_ROWS.length * 2);
    expect(screen.getAllByText(`${PREFS}.mandatoryNote`)).toHaveLength(
      PREFERENCE_TABLE.filter((entry) => entry.hasMandatory).length,
    );
  });

  it('Π3 — κύριος διακόπτης κλειστός ⇒ το email της γραμμής ανενεργό, με την τιμή του ορατή', () => {
    const defaults = getDefaultNotificationSettings('u');
    renderMatrix(settingsWith({
      categories: { ...defaults.categories, properties: { ...defaults.categories.properties, demandListingMatch: false } },
    }));
    expect(cell(MATCH, 'notify').getAttribute('aria-checked')).toBe('false');
    expect(cell(MATCH, 'email').hasAttribute('disabled')).toBe(true);
    expect(cell(MATCH, 'email').getAttribute('aria-checked')).toBe('true');
    expect(cell(LEAD, 'email').hasAttribute('disabled')).toBe(false);
  });

  it('Π4 🔑 — email καθολικά κλειστά ⇒ στήλη ανενεργή, τιμές ΔΙΑΤΗΡΗΜΕΝΕΣ και ορατές, εξήγηση', () => {
    renderMatrix(matchEmailMuted({ emailEnabled: false }));
    expect(cell(MATCH, 'email').hasAttribute('disabled')).toBe(true);
    expect(cell(MATCH, 'email').getAttribute('aria-checked')).toBe('false');
    expect(cell(LEAD, 'email').hasAttribute('disabled')).toBe(true);
    expect(cell(LEAD, 'email').getAttribute('aria-checked')).toBe('true');
    expect(cell(LEAD, 'notify').hasAttribute('disabled')).toBe(false);
    expect(screen.getByText(`${PREFS}.emailsOffNote`)).toBeTruthy();
  });

  it('Π5 — συχνότητα `disabled` (με `emailEnabled` ανοιχτό) είναι ΕΠΙΣΗΣ «κλειστά»', () => {
    renderMatrix(settingsWith({ emailFrequency: 'disabled' }));
    expect(cell(LEAD, 'email').hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(`${PREFS}.emailsOffNote`)).toBeTruthy();
  });

  it('Π6 — ο υπότιτλος της στήλης email λέει τη συχνότητα· με τα email κλειστά, σιωπά', () => {
    renderMatrix(settingsWith({ emailFrequency: 'daily' }));
    expect(screen.getAllByText(FREQUENCY_LABEL_KEYS.daily)).toHaveLength(PREFERENCE_TABLE.length);
  });

  it('Π6β — email κλειστά: κανένας υπότιτλος συχνότητας (θα υποσχόταν σύνοψη που δεν φεύγει)', () => {
    renderMatrix(settingsWith({ emailEnabled: false, emailFrequency: 'daily' }));
    expect(screen.queryByText(FREQUENCY_LABEL_KEYS.daily)).toBeNull();
  });

  it('Π6γ — email ανοιχτά: ΚΑΜΙΑ εξήγηση «τα email είναι κλειστά»', () => {
    renderMatrix();
    expect(screen.queryByText(`${PREFS}.emailsOffNote`)).toBeNull();
  });
});

describe('Δ — κάθε διακόπτης κάνει ό,τι λέει', () => {
  it('Δ1 — ο κύριος διακόπτης ζητά τον ΔΙΚΟ του διακόπτη', () => {
    const { onTypeEnabled, onTypeEmail } = renderMatrix();
    fireEvent.click(cell(MATCH, 'notify'));
    expect(onTypeEnabled).toHaveBeenCalledWith(MATCH_REF, false);
    expect(onTypeEmail).not.toHaveBeenCalled();
  });

  it('Δ2 🔑 — το email ζητά `off` ΜΟΝΟ για αυτόν τον τύπο, και το άνοιγμα ζητά `on`', () => {
    const { onTypeEnabled, onTypeEmail } = renderMatrix();
    fireEvent.click(cell(MATCH, 'email'));
    expect(onTypeEmail).toHaveBeenCalledWith(MATCH_REF, 'off');
    expect(onTypeEnabled).not.toHaveBeenCalled();
  });

  it('Δ3 — σιγασμένος τύπος: κλειστός διακόπτης email, και το άνοιγμα ζητά `on`', () => {
    const { onTypeEmail } = renderMatrix(matchEmailMuted());
    expect(cell(MATCH, 'email').getAttribute('aria-checked')).toBe('false');
    fireEvent.click(cell(MATCH, 'email'));
    expect(onTypeEmail).toHaveBeenCalledWith(MATCH_REF, 'on');
  });

  it.each([
    ['emailEnabled κλειστό ⇒ ο διακόπτης email', { emailEnabled: false }, DELIVERY_CONTROL_IDS.email],
    ['συχνότητα `disabled` ⇒ ο επιλογέας συχνότητας', { emailFrequency: 'disabled' as const }, DELIVERY_CONTROL_IDS.emailFrequency],
  ])('Δ4 — «Μετάβαση στη ρύθμιση email» ΕΣΤΙΑΖΕΙ (%s) και δεν γράφει', (_case, patch, targetId) => {
    const target = document.createElement('button');
    target.id = targetId;
    document.body.appendChild(target);
    try {
      const { onTypeEnabled, onTypeEmail } = renderMatrix(settingsWith(patch));
      fireEvent.click(screen.getByText(`${PREFS}.emailsOffAction`));
      expect(document.activeElement).toBe(target);
      expect(onTypeEnabled).not.toHaveBeenCalled();
      expect(onTypeEmail).not.toHaveBeenCalled();
    } finally {
      target.remove();
    }
  });
});

describe('Ο — κάθε διακόπτης έχει όνομα', () => {
  it('Ο1 — όνομα = γραμμή + στήλη («…ταιριάζει στη ζήτησή μου, Και με email»)', () => {
    renderMatrix();
    expect(screen.getByRole('switch', { name: `${MATCH_LABEL} ${PREFS}.columns.email` })).toBe(cell(MATCH, 'email'));
    expect(screen.getByRole('switch', { name: `${MATCH_LABEL} ${PREFS}.columns.notify` })).toBe(cell(MATCH, 'notify'));
  });
});
