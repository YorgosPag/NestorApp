/**
 * ADR-782 §25 — άγκυρες της γραμμής πλαισίου: **το χειριστήριο του υποβάθρου δεν εξαφανίζεται
 * μαζί με τους ορόφους**.
 *
 * 🔴 Γιατί υπάρχει αυτό το αρχείο: το ελάττωμα έζησε επειδή **κανένα** test δεν κλείδωνε το
 * σημείο προσάρτησης. Ο διακόπτης ζούσε μέσα στο `<nav>` του `FloorTabBar`, που κάνει
 * `return null` χωρίς κτίριο/ορόφους — και τα 62 πράσινα tests του υποβάθρου δοκίμαζαν την
 * **κρίση** (`getBasemapAvailability`, τον λόγο άρνησης, τις ρυθμίσεις), ποτέ το **αν φτάνει
 * στην οθόνη**. Ίδιο σχήμα με το §21/§23: «πράσινη κάλυψη πάνω σε μονοπάτι που κανείς δεν
 * περπατά», μία στροφή πιο έξω.
 *
 * ⚠️ Η `Ζ1` είναι η ουσιώδης: αν κάποιος ξαναφέρει τον διακόπτη μέσα στο `FloorTabBar`, **αυτή**
 * γίνεται κόκκινη — γιατί εκεί το `visible: false` τον σβήνει. Καμία άλλη άγκυρα δεν το πιάνει.
 *
 * @see ../ViewerContextStrip
 * @see ../BasemapControlGroup
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewerContextStrip } from '../ViewerContextStrip';
import { getBasemapState, resetBasemapStore } from '../../../systems/basemap/basemap-store';
import { setProjectAnchor } from '../../../systems/basemap/basemap-availability';
import type { UseFloorTabsResult } from '../../../hooks/data/useFloorTabs';

jest.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Ο hook των ορόφων μιλάει σε Firestore + LevelsSystem· εδώ κρίνεται η **προσάρτηση**, όχι εκείνος.
const mockFloorTabs = jest.fn<UseFloorTabsResult, []>();
jest.mock('../../../hooks/data/useFloorTabs', () => ({
  useFloorTabs: () => mockFloorTabs(),
}));

const TOGGLE_ARIA = 'basemap.toggleAria';
const GENERIC_HINT = 'basemap.unavailableHint';
const NO_ADDRESS_HINT = 'basemap.unavailableReason.noAddress';
const SETTINGS_ARIA = 'basemap.settings.openAria';

/** Κατάσταση «έργο χωρίς κτίριο/ορόφους» — ό,τι έβλεπε ο χρήστης που δεν μπορούσε να δει χάρτη. */
function noFloors(): UseFloorTabsResult {
  return {
    visible: false,
    tabs: [],
    activeFloorId: null,
    onSelectTab: jest.fn(),
    floor3DScope: 'single',
    onSelectAllFloors: jest.fn(),
    floorVisibilityModes: new Map(),
    onToggleFloorVisible: jest.fn(),
  };
}

/** Κατάσταση «κτίριο με έναν όροφο» — η μπάρα ορόφων αποδίδεται κανονικά. */
function withFloors(): UseFloorTabsResult {
  return {
    ...noFloors(),
    visible: true,
    tabs: [{ floorId: 'flr_1', number: 0, label: 'Ισόγειο', levelId: 'lvl_1', hasFloorplan: true }],
    activeFloorId: 'flr_1',
  };
}

const ANCHORED = {
  kind: 'anchored',
  anchor: { lat: 40.63, lon: 22.94, originKey: 'projectAddressStored' },
} as const;

beforeEach(() => {
  resetBasemapStore();
  setProjectAnchor(null);
  mockFloorTabs.mockReturnValue(noFloors());
});

describe('ViewerContextStrip — project-level επιφάνεια, building-level καρτέλες (ADR-782 §25)', () => {
  it('🎯 Ζ1: ΧΩΡΙΣ ορόφους ο διακόπτης του χάρτη ΥΠΑΡΧΕΙ — και δεν υπάρχει καμία μπάρα ορόφων', () => {
    render(<ViewerContextStrip />);

    // Χωρίς θέση είναι ανενεργός, αλλά **υπαρκτός**: ο χρήστης βλέπει ότι η λειτουργία υπάρχει.
    expect(screen.getByRole('button', { name: GENERIC_HINT })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('🎯 Ζ2: ΧΩΡΙΣ ορόφους ο ΛΟΓΟΣ άρνησης φτάνει στην ετικέτα — η άρνηση είναι απάντηση, όχι σιωπή', () => {
    setProjectAnchor({ kind: 'refused', reason: 'no-address' });
    render(<ViewerContextStrip />);

    // Ο ονομασμένος λόγος, όχι το γενικό πάτωμα: ο χρήστης μαθαίνει ΤΙ να κάνει.
    expect(screen.getByRole('button', { name: NO_ADDRESS_HINT })).toBeDisabled();
    expect(screen.queryByRole('button', { name: GENERIC_HINT })).not.toBeInTheDocument();
  });

  it('🎯 Ζ3: ΧΩΡΙΣ ορόφους ο διακόπτης ΛΕΙΤΟΥΡΓΕΙ — ορατός δεν σημαίνει ενεργός', async () => {
    setProjectAnchor(ANCHORED);
    const user = userEvent.setup();
    render(<ViewerContextStrip />);

    const toggle = screen.getByRole('button', { name: TOGGLE_ARIA });
    expect(toggle).toBeEnabled();

    const before = getBasemapState().enabled;
    await user.click(toggle);
    expect(getBasemapState().enabled).toBe(!before);
  });

  it('🎯 Ζ4: ΧΩΡΙΣ ορόφους υπάρχουν ΚΑΙ οι ρυθμίσεις — χάνονταν και οι δύο μαζί', () => {
    setProjectAnchor(ANCHORED);
    render(<ViewerContextStrip />);

    expect(screen.getByRole('button', { name: SETTINGS_ARIA })).toBeEnabled();
  });

  it('🎯 Ζ5: ΜΕ ορόφους ο διακόπτης ΔΕΝ κάθεται μέσα στο tablist (ARIA: μόνο tab παιδιά)', () => {
    setProjectAnchor(ANCHORED);
    mockFloorTabs.mockReturnValue(withFloors());
    render(<ViewerContextStrip />);

    const tablist = screen.getByRole('tablist');
    const toggle = screen.getByRole('button', { name: TOGGLE_ARIA });
    expect(tablist).not.toContainElement(toggle);
  });

  it('🎯 Ζ6: ΜΕ ορόφους ο χάρτης παραμένει ΠΡΩΤΟΣ-ΑΡΙΣΤΕΡΑ — η μετακόμιση δεν άλλαξε τη σειρά (§10)', () => {
    setProjectAnchor(ANCHORED);
    mockFloorTabs.mockReturnValue(withFloors());
    render(<ViewerContextStrip />);

    const group = screen.getByRole('group', { name: 'basemap.label' });
    const tablist = screen.getByRole('tablist');
    // «Πού είμαι» πριν από «ποιον όροφο βλέπω» — απόφαση Giorgio 2026-08-09.
    expect(group.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Ισόγειο/ })).toBeInTheDocument();
  });
});
