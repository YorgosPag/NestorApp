/**
 * ΑΓΚΥΡΕΣ — ο hook της πυκνότητας μέσα στη React (ADR-811)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΑΠΟΔΕΙΚΝΥΟΥΝ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ότι η επιλογή **ταξιδεύει ολόκληρη**: `setDensity` → `<html>` → αποθήκευση →
 * **και πίσω στο component**. Το τελευταίο βήμα είναι αυτό που ξεχνιέται: το
 * `storage` event **δεν** πυροδοτεί στο έγγραφο που έγραψε (προδιαγραφή HTML),
 * οπότε χωρίς δικό μας γεγονός ο επιλογέας θα άλλαζε την οθόνη και θα έδειχνε
 * την **παλιά** τιμή — προτίμηση που εφαρμόζεται και δεν φαίνεται εφαρμοσμένη.
 *
 * ⚠️ ΔΕΝ αποδεικνύουν ότι ο browser υπολογίζει τα pixel — το jsdom δεν λύνει
 * `var()`. Αυτό μετρήθηκε ζωντανά (ADR-811 §5) και είναι **άλλο** ερώτημα.
 */

import { act, render, screen } from '@testing-library/react';
import React from 'react';

import {
  DEFAULT_DENSITY,
  DENSITY_ATTRIBUTE,
  DENSITY_ROLES,
  DENSITY_STORAGE_KEY,
  type DensityRole,
} from '@/styles/design-tokens/generated/appearance';

import { useDensity } from '../useDensity';

const OTHER = DENSITY_ROLES.find((r) => r !== DEFAULT_DENSITY) as DensityRole;

function Probe() {
  const { density, densities, setDensity } = useDensity();
  return (
    <div>
      <span data-testid="current">{density}</span>
      <span data-testid="count">{densities.length}</span>
      {densities.map((role) => (
        <button key={role} type="button" data-testid={`set-${role}`} onClick={() => setDensity(role)}>
          {role}
        </button>
      ))}
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute(DENSITY_ATTRIBUTE);
});

describe('Π — ο παρονομαστής', () => {
  test('Π1 — υπάρχει δεύτερος ρόλος να επιλεγεί', () => {
    expect(OTHER).toBeDefined();
    expect(OTHER).not.toBe(DEFAULT_DENSITY);
  });
});

describe('Ρ — η ροή της επιλογής', () => {
  test('Ρ1 — χωρίς attribute δείχνει την προεπιλογή (δεν σκάει, δεν κρύβεται)', () => {
    render(<Probe />);
    expect(screen.getByTestId('current').textContent).toBe(DEFAULT_DENSITY);
  });

  test('Ρ2 — εκθέτει ΟΛΟΥΣ τους παραγόμενους ρόλους, όχι χειρόγραφη λίστα', () => {
    render(<Probe />);
    expect(screen.getByTestId('count').textContent).toBe(String(DENSITY_ROLES.length));
    for (const role of DENSITY_ROLES) {
      expect(screen.getByTestId(`set-${role}`)).toBeTruthy();
    }
  });

  test('Ρ3 — η επιλογή φτάνει στο <html> ΚΑΙ γυρίζει πίσω στο component', () => {
    // 🔴 Το δεύτερο μισό είναι το κρίσιμο: χωρίς το δικό μας γεγονός, το
    // `<html>` θα άλλαζε και το `current` θα έμενε στην παλιά τιμή.
    render(<Probe />);
    act(() => {
      screen.getByTestId(`set-${OTHER}`).click();
    });
    expect(document.documentElement.getAttribute(DENSITY_ATTRIBUTE)).toBe(OTHER);
    expect(screen.getByTestId('current').textContent).toBe(OTHER);
  });

  test('Ρ4 — η επιλογή αποθηκεύεται', () => {
    render(<Probe />);
    act(() => {
      screen.getByTestId(`set-${OTHER}`).click();
    });
    expect(window.localStorage.getItem(DENSITY_STORAGE_KEY)).toBe(OTHER);
  });

  test('Ρ5 — αλλαγή σε ΑΛΛΗ καρτέλα φτάνει εδώ', () => {
    // Το `storage` event είναι ο μηχανισμός των άλλων καρτελών. Ένας χρήστης με
    // δύο ανοιχτές καρτέλες δεν πρέπει να βλέπει δύο διαφορετικές διατάξεις.
    render(<Probe />);
    act(() => {
      window.localStorage.setItem(DENSITY_STORAGE_KEY, OTHER);
      document.documentElement.setAttribute(DENSITY_ATTRIBUTE, OTHER);
      window.dispatchEvent(new Event('storage'));
    });
    expect(screen.getByTestId('current').textContent).toBe(OTHER);
  });

  test('Ρ6 — επιστροφή στην προεπιλογή δουλεύει και προς τις δύο κατευθύνσεις', () => {
    // Ο παρονομαστής της Ρ3: χωρίς αυτό, μια υλοποίηση που «κολλάει» στην πρώτη
    // αλλαγή θα ήταν πράσινη.
    render(<Probe />);
    act(() => { screen.getByTestId(`set-${OTHER}`).click(); });
    expect(screen.getByTestId('current').textContent).toBe(OTHER);
    act(() => { screen.getByTestId(`set-${DEFAULT_DENSITY}`).click(); });
    expect(screen.getByTestId('current').textContent).toBe(DEFAULT_DENSITY);
    expect(document.documentElement.getAttribute(DENSITY_ATTRIBUTE)).toBe(DEFAULT_DENSITY);
  });

  test('Ρ7 — αποσυνδέει τους ακροατές του στο unmount (καμία διαρροή)', () => {
    const added = new Set<string>();
    const removed = new Set<string>();
    const origAdd = window.addEventListener;
    const origRemove = window.removeEventListener;
    window.addEventListener = function (type: string, ...rest: unknown[]) {
      added.add(type);
      // eslint-disable-next-line prefer-spread
      return origAdd.apply(window, [type, ...rest] as never);
    } as typeof window.addEventListener;
    window.removeEventListener = function (type: string, ...rest: unknown[]) {
      removed.add(type);
      // eslint-disable-next-line prefer-spread
      return origRemove.apply(window, [type, ...rest] as never);
    } as typeof window.removeEventListener;
    try {
      const view = render(<Probe />);
      expect(added.has('storage')).toBe(true);
      view.unmount();
      expect(removed.has('storage')).toBe(true);
    } finally {
      window.addEventListener = origAdd;
      window.removeEventListener = origRemove;
    }
  });
});
