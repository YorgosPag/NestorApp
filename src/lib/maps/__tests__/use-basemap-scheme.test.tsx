/**
 * ADR-890 §18.4 — **το θέμα του χάρτη ακολουθεί την ΕΦΑΡΜΟΣΜΕΝΗ κλάση του `<html>`**, όχι την κατάσταση React.
 * Μετρημένο ζωντανά: με το `resolvedTheme` τα `useMemo([scheme])` διάβαζαν τα tokens του **προηγούμενου** θέματος
 * (φωτεινό θέμα, όρια/μοτίβο/ετικέτες του σκοτεινού), επειδή το `next-themes` βάζει την κλάση σε effect.
 */

import { act, renderHook } from '@testing-library/react';

import { appliedBasemapScheme, basemapSchemeOf, useBasemapScheme } from '../use-basemap-scheme';

const root = document.documentElement;

afterEach(() => root.classList.remove('light', 'dark'));

describe('useBasemapScheme', () => {
  it('η κλάση αλλάζει ⇒ το θέμα του χάρτη αλλάζει ΤΟΤΕ — όταν τα tokens είναι ήδη του νέου θέματος', async () => {
    root.classList.add('dark');
    const { result } = renderHook(() => useBasemapScheme());
    expect(result.current).toBe('dark');
    await act(async () => {
      root.classList.replace('dark', 'light');
      await Promise.resolve(); // ο MutationObserver ειδοποιεί σε microtask
    });
    expect(result.current).toBe('light');
  });

  it('χωρίς κλάση θέματος ⇒ πέφτει στο `resolvedTheme`, και χωρίς αυτό στο προεπιλεγμένο', () => {
    expect(appliedBasemapScheme(root)).toBeNull();
    const { result } = renderHook(() => useBasemapScheme());
    expect(result.current).toBe(basemapSchemeOf(undefined));
  });
});
