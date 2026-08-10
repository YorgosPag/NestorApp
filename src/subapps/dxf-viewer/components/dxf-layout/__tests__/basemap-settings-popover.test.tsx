/**
 * ADR-782 §18 (Φάση 2β) — τι ΜΠΟΡΕΙ να ρυθμίσει ο μηχανικός, και τι δεν του προσφέρεται ψεύτικα.
 *
 * 🔴 Γιατί υπάρχει: η αδιαφάνεια και ο πάροχος είχαν setters από τη Φάση 1 και **καμία** διεπαφή
 * (§13 #4). Η προεπιλογή 0,55 ήταν ρυθμιζόμενη στα χαρτιά και σταθερή στην πράξη.
 *
 * 🔑 Η `Ρ3` είναι η ουσιώδης: ο πίνακας παρόχων έχει **έναν**, οπότε λίστα επιλογής θα ήταν
 * χειριστήριο **που δεν μπορεί να κάνει τίποτα** (ADR-749 §5 σε μορφή διεπαφής). Η μορφή
 * **παράγεται από τον πίνακα** — και η άγκυρα κλειδώνει ότι παράγεται, όχι ότι είναι σκληρή.
 *
 * @see ../BasemapSettingsPopover
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BasemapSettingsPopover } from '../BasemapSettingsPopover';
import { getBasemapState, resetBasemapStore } from '../../../systems/basemap/basemap-store';
import { setProjectAnchor } from '../../../systems/basemap/basemap-availability';
import { BASEMAP_SOURCES } from '../../../systems/basemap/basemap-source';

jest.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const OPEN_ARIA = 'basemap.settings.openAria';
const UNAVAILABLE = 'basemap.settings.unavailable';

beforeEach(() => {
  resetBasemapStore();
  setProjectAnchor(null);
});

describe('BasemapSettingsPopover — οι ρυθμίσεις υποβάθρου (ADR-782 §18)', () => {
  it('🎯 Ρ1: χωρίς γεωαναφορά το κουμπί είναι ΑΝΕΝΕΡΓΟ και λέει τον λόγο', () => {
    render(<BasemapSettingsPopover />);

    const trigger = screen.getByRole('button', { name: UNAVAILABLE });
    expect(trigger).toBeDisabled();
    // Ένα ανενεργό κουμπί χωρίς εξήγηση είναι η χειρότερη εκδοχή — ο λόγος ΜΕΣΑ στην ετικέτα.
    expect(screen.queryByRole('button', { name: OPEN_ARIA })).not.toBeInTheDocument();
  });

  it('🎯 Ρ2: με κατά προσέγγιση θέση ενεργοποιείται και η αδιαφάνεια ΓΡΑΦΕΤΑΙ στο store', async () => {
    setProjectAnchor({ kind: 'anchored', anchor: { lat: 40.66, lon: 22.9, originKey: 'projectAddressGeocoded' } });
    const user = userEvent.setup();
    render(<BasemapSettingsPopover />);

    await user.click(screen.getByRole('button', { name: OPEN_ARIA }));

    const slider = await screen.findByRole('slider');
    slider.focus();
    await user.keyboard('{ArrowRight}');

    // Η αρχική είναι 0,55 ⇒ 55% ⇒ βήμα 5 ⇒ 60% = 0,6. Η τιμή ΓΡΑΦΤΗΚΕ, δεν έμεινε τοπική.
    expect(getBasemapState().opacity).toBeCloseTo(0.6, 6);
  });

  it('🎯 Ρ3: με ΕΝΑΝ πάροχο δεν προσφέρεται λίστα επιλογής — χειριστήριο που δεν κάνει τίποτα', async () => {
    setProjectAnchor({ kind: 'anchored', anchor: { lat: 40.66, lon: 22.9, originKey: 'projectAddressGeocoded' } });
    const user = userEvent.setup();
    render(<BasemapSettingsPopover />);

    await user.click(screen.getByRole('button', { name: OPEN_ARIA }));
    await screen.findByText('basemap.settings.title');

    // Η άγκυρα ισχύει ΟΣΟ ο πίνακας έχει έναν· με δεύτερο πάροχο πρέπει να εμφανιστεί λίστα.
    expect(Object.keys(BASEMAP_SOURCES)).toHaveLength(1);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText(/basemap\.sources\.osmStandard/)).toBeInTheDocument();
  });

  it('Ρ4: το πάνελ ονομάζει την αδιαφάνεια και εξηγεί γιατί δεν πρέπει να ανέβει άσκοπα', async () => {
    setProjectAnchor({ kind: 'anchored', anchor: { lat: 40.66, lon: 22.9, originKey: 'projectAddressGeocoded' } });
    const user = userEvent.setup();
    render(<BasemapSettingsPopover />);

    await user.click(screen.getByRole('button', { name: OPEN_ARIA }));

    expect(await screen.findByText('basemap.settings.opacityHint')).toBeInTheDocument();
  });
});
