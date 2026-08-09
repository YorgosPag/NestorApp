/**
 * @jest-environment jsdom
 *
 * ΑΓΚΥΡΕΣ — ADR-782 Φ2: **τι φτάνει στην οθόνη**.
 *
 * Το `basemap-attribution.test.ts` αποδεικνύει ότι η ζωγραφική *ρωτά*. Εδώ αποδεικνύεται το άλλο
 * μισό: ότι η επιφάνεια που της απαντά «ναι» όντως **γράφει τη μνεία**. Χωρίς αυτό, το μητρώο θα
 * ήταν τελετουργικό — μια εγγραφή που λέει «κάποιος αποδίδει» ενώ κανείς δεν αποδίδει.
 *
 * ⚠️ Ο έλεγχος γίνεται στο **αποδοθέν DOM**, όχι στο αρχείο πηγής: το ερώτημα της άδειας είναι
 * «το βλέπει ο χρήστης;», και ένα grep στο JSX θα απαντούσε «υπάρχει ο κώδικας», που δεν είναι
 * το ίδιο πράγμα.
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';

jest.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { BasemapAttributionLeaf } from '../BasemapAttributionLeaf';
import {
  resetBasemapStore,
  setBasemapEnabled,
  setBasemapOpacity,
} from '../../../systems/basemap/basemap-store';
import { setApproximateAnchor } from '../../../systems/basemap/basemap-availability';
import {
  hasBasemapAttributionSurface,
  resetBasemapAttributionSurfaces,
} from '../../../systems/basemap/basemap-attribution-surface';
import { resolveBasemapPaint } from '../../../systems/basemap/basemap-paint-decision';

/** Το έργο ξέρει πού είναι, ο χάρτης είναι αναμμένος — η κατάσταση όπου η μνεία είναι υποχρεωτική. */
function mapIsOn(): void {
  setBasemapEnabled(true);
  setApproximateAnchor({ lat: 40.64, lon: 22.94, originKey: 'test' });
}

beforeEach(() => {
  resetBasemapStore();
  resetBasemapAttributionSurfaces();
  setApproximateAnchor(null);
});

afterAll(() => {
  resetBasemapStore();
  resetBasemapAttributionSurfaces();
  setApproximateAnchor(null);
});

describe('Α8 — η μνεία φαίνεται ΟΣΟ ο χάρτης είναι αναμμένος', () => {
  it('αναμμένος χάρτης ⇒ το κείμενο του παρόχου είναι στο DOM, ΑΜΕΤΑΦΡΑΣΤΟ', () => {
    mapIsOn();
    render(<BasemapAttributionLeaf />);

    // Ακριβώς η μορφή που δέχεται η οδηγία του OSMF — ούτε κλειδί i18n, ούτε παραλλαγή.
    expect(screen.getByRole('complementary')).toHaveTextContent('© OpenStreetMap contributors');
  });

  it('η λέξη «OpenStreetMap» είναι ΣΥΝΔΕΣΜΟΣ προς τη σελίδα της άδειας', () => {
    mapIsOn();
    render(<BasemapAttributionLeaf />);

    const link = screen.getByRole('link', { name: 'OpenStreetMap' });
    expect(link).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
    // Άνοιγμα σε νέα καρτέλα χωρίς να δίνεται πρόσβαση στο `window.opener` της εφαρμογής.
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('σβηστός χάρτης ⇒ ΤΙΠΟΤΑ στην οθόνη (η μνεία δεν είναι μόνιμο chrome)', () => {
    render(<BasemapAttributionLeaf />);
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('μηδενική αδιαφάνεια ⇒ τίποτα — δεν αποδίδουμε χάρτη που δεν φαίνεται', () => {
    mapIsOn();
    setBasemapOpacity(0);
    render(<BasemapAttributionLeaf />);
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('χωρίς γεωαναφορά ⇒ τίποτα (ο χάρτης δεν ζωγραφίζεται, άρα δεν υπάρχει τι να αποδοθεί)', () => {
    setBasemapEnabled(true);
    render(<BasemapAttributionLeaf />);
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('🔴 άναμμα ΜΕΤΑ την προσάρτηση ⇒ η μνεία εμφανίζεται χωρίς νέο render από τον γονέα', () => {
    // Το πραγματικό σενάριο: ο χρήστης πατά «Χάρτης» στη μπάρα ορόφων. Αν το leaf δεν ήταν
    // εγγεγραμμένο στα stores, η μνεία θα εμφανιζόταν μόνο στην επόμενη άσχετη αλλαγή.
    render(<BasemapAttributionLeaf />);
    expect(screen.queryByRole('complementary')).toBeNull();

    act(() => { mapIsOn(); });
    expect(screen.getByRole('complementary')).toHaveTextContent('OpenStreetMap');
  });
});

describe('Α9 — 🔴 η προσάρτηση ΞΕΚΛΕΙΔΩΝΕΙ τη ζωγραφική, η αποπροσάρτηση την κλειδώνει ξανά', () => {
  it('χωρίς το leaf ο χάρτης αρνείται· με το leaf ζωγραφίζει· μετά την αποπροσάρτηση αρνείται ξανά', () => {
    mapIsOn();
    expect(resolveBasemapPaint()).toEqual({ show: false, refusal: 'unattributed' });

    const { unmount } = render(<BasemapAttributionLeaf />);
    expect(hasBasemapAttributionSurface()).toBe(true);
    expect(resolveBasemapPaint().show).toBe(true);

    unmount();
    expect(hasBasemapAttributionSurface()).toBe(false);
    expect(resolveBasemapPaint()).toEqual({ show: false, refusal: 'unattributed' });
  });

  it('η εγγραφή γίνεται ΑΝΕΞΑΡΤΗΤΑ από το αν φαίνεται κείμενο (αλλιώς το σύστημα κλειδώνει)', () => {
    // Χάρτης σβηστός ⇒ το leaf δεν γράφει τίποτα· η επιφάνεια όμως ΥΠΑΡΧΕΙ, αλλιώς το άναμμα
    // θα έβρισκε `unattributed` και ο χάρτης δεν θα άναβε ποτέ.
    render(<BasemapAttributionLeaf />);
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(hasBasemapAttributionSurface()).toBe(true);
  });
});

describe('Α10 — συμμόρφωση με τις πύλες αυτού του αποθετηρίου', () => {
  it('καμία ωμή τιμή χρώματος και κανένα native tooltip στο αποδοθέν DOM', () => {
    mapIsOn();
    const { container } = render(<BasemapAttributionLeaf />);
    const html = container.innerHTML;

    // CHECK 3.38-3.43: σημασιολογικά tokens, ποτέ ωμό hex/rgb ούτε ωμή κλίμακα Tailwind.
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html).not.toMatch(/\b(?:text|bg|border)-(?:slate|gray|zinc|neutral|stone)-\d{2,3}\b/);
    // CHECK 3.23: native tooltip ratchet — ο σύνδεσμος δεν κρύβει πληροφορία σε `title`.
    expect(container.querySelector('[title]')).toBeNull();
  });
});
