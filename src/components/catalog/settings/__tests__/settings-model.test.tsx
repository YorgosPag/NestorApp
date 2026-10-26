/**
 * ADR-923 §5.10.4 Β5 — ρυθμίσεις καταλόγου: πρόχειρο, κλειδώματα **πριν** από την αποστολή, πίνακας.
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TooltipProvider } from '@/components/ui/tooltip';
import type { LocaleUsage } from '@/hooks/catalog/useCatalogLocaleUsage';
import type { HumanLanguage } from '@/i18n/languages';
import { validateCatalogSettings } from '@/subapps/catalog/schema/validate-catalog-settings';
import type { CatalogSettingsDefinition } from '@/subapps/catalog/types/catalog-settings';

import { SettingsMatrix } from '../SettingsMatrix';
import { settingsCellLock, settingsChangeAffectsCompleteness, toggleChannelLocale } from '../settings-model';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key), i18n: { language: 'el' } }),
}));

const MFP: CatalogSettingsDefinition = {
  channelLocales: { print: ['el'], storefront: ['el', 'en'], portal: ['el'], quote: ['el'] },
};
const used = (...locales: HumanLanguage[]): ReadonlyMap<HumanLanguage, LocaleUsage> =>
  new Map<HumanLanguage, LocaleUsage>([['el', locales.includes('el') ? 'used' : 'unused'], ['en', locales.includes('en') ? 'used' : 'unused']]);

describe('settings-model', () => {
  it('εναλλαγή κρατά τη σειρά του HUMAN_LANGUAGES (en πριν el ⇒ el, en)', () => {
    const withoutEl = toggleChannelLocale(MFP, 'storefront', 'el');
    expect(withoutEl.channelLocales.storefront).toEqual(['en']);
    expect(toggleChannelLocale(withoutEl, 'storefront', 'el').channelLocales.storefront).toEqual(['el', 'en']);
    expect(toggleChannelLocale(MFP, 'print', 'en').channelLocales.print).toEqual(['el', 'en']);
  });

  it('lastLocale: το μόνο κελί ενός καναλιού κλειδώνει — ο ΙΔΙΟΣ κανόνας με τον validateCatalogSettings', () => {
    expect(settingsCellLock(MFP, 'print', 'el', null)).toBe('lastLocale');
    expect(validateCatalogSettings(toggleChannelLocale(MFP, 'print', 'el')).map((i) => i.code)).toContain('channelLocalesRequired');
  });

  it('inUse: κλειδώνει ΜΟΝΟ το τελευταίο κανάλι μιας γλώσσας με τιμές · αλλού ελεύθερο · η προσθήκη ποτέ', () => {
    expect(settingsCellLock(MFP, 'storefront', 'en', used('en'))).toBe('inUse');
    expect(settingsCellLock(MFP, 'storefront', 'en', used())).toBeNull();
    const twoChannels = toggleChannelLocale(MFP, 'portal', 'en');
    expect(settingsCellLock(twoChannels, 'storefront', 'en', used('en'))).toBeNull();
    expect(settingsCellLock(MFP, 'print', 'en', used('en'))).toBeNull();
  });

  it('άγνωστη χρήση (η ερώτηση απέτυχε) ⇒ ΔΕΝ κλειδώνει — κρίνει ο διακομιστής', () => {
    const unknown = new Map<HumanLanguage, LocaleUsage>([['en', 'unknown']]);
    expect(settingsCellLock(MFP, 'storefront', 'en', unknown)).toBeNull();
  });

  it('επηρεάζει την πληρότητα μόνο όταν αλλάζουν οι γλώσσες', () => {
    expect(settingsChangeAffectsCompleteness(MFP, MFP)).toBe(false);
    expect(settingsChangeAffectsCompleteness(MFP, toggleChannelLocale(MFP, 'quote', 'en'))).toBe(true);
  });
});

describe('SettingsMatrix', () => {
  it('κελί με όνομα «κανάλι · γλώσσα», κλειδωμένο με ΛΟΓΟ στην περιγραφή · κλικ εναλλάσσει τα ελεύθερα', async () => {
    const onToggle = jest.fn();
    render(<TooltipProvider><SettingsMatrix settings={MFP} usage={used('en')} disabled={false} onToggle={onToggle} /></TooltipProvider>);
    const locked = screen.getByRole('checkbox', { name: 'channels.storefront · language.en' });
    expect((locked as HTMLButtonElement).disabled).toBe(true);
    expect(document.getElementById(locked.getAttribute('aria-describedby')!)?.textContent).toContain('settings.lock.inUse');
    await userEvent.click(screen.getByRole('checkbox', { name: 'channels.quote · language.en' }));
    expect(onToggle).toHaveBeenCalledWith('quote', 'en');
    expect(within(screen.getByRole('table')).getAllByRole('rowheader')).toHaveLength(4);
  });
});
