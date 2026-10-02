'use client';

/**
 * @fileoverview **Ποιο θέμα βάφει ο χάρτης φόντου** — το θέμα της εφαρμογής **όπως έχει ΕΦΑΡΜΟΣΤΕΙ** στο `<html>`.
 * @related ADR-891 §9 (Φ3) · ADR-890 §18.4 · `protomaps-style.ts` · `lib/appearance/useHydratedTheme.ts` (ADR-815)
 * @module lib/maps/use-basemap-scheme
 *
 * Πριν την ενυδάτωση το θέμα είναι άγνωστο ⇒ `APP_DEFAULT_THEME` (αυτό που βάφει και η σελίδα). Ο χάρτης είναι
 * καμβάς WebGL που φορτώνει στυλ και πλακίδια **μετά** το πρώτο effect, οπότε η διόρθωση προλαβαίνει την πρώτη
 * ζωγραφιά· και ακόμη κι αν όχι, η αλλαγή στυλ είναι diff χωρίς νέα λήψη πλακιδίων.
 *
 * 🔴 **Γιατί η ΕΦΑΡΜΟΣΜΕΝΗ κλάση και όχι το `resolvedTheme`** (μετρημένο ζωντανά 2026-10-02, ADR-890 §18.4): το
 *   `next-themes` αλλάζει πρώτα την κατάσταση React και εφαρμόζει την κλάση στο `<html>` σε **effect**, δηλαδή **μετά**
 *   το render. Κάθε `useMemo([scheme])` που διαβάζει token (`readThemeColor`) έτρεχε στο ενδιάμεσο και κρατούσε τα
 *   χρώματα του **προηγούμενου** θέματος: φωτεινό θέμα με όρια, μοτίβο και ετικέτες του σκοτεινού. Εδώ το θέμα αλλάζει
 *   **όταν τα tokens έχουν ήδη αλλάξει** — μία διόρθωση για κάθε καταναλωτή, χωρίς κανείς να το ξέρει.
 */

import { useSyncExternalStore } from 'react';

import { APP_DEFAULT_THEME } from '@/lib/appearance/theme-storage-key';
import { useHydratedTheme } from '@/lib/appearance/useHydratedTheme';
import type { BasemapScheme } from './basemap-catalog';

/** `resolvedTheme` → θέμα χάρτη. Το `system` έχει ήδη λυθεί· ό,τι άγνωστο πέφτει στο προεπιλεγμένο. */
export function basemapSchemeOf(resolvedTheme: string | undefined): BasemapScheme {
  const theme = resolvedTheme ?? APP_DEFAULT_THEME;
  return theme === 'light' ? 'light' : 'dark';
}

/**
 * Το θέμα που **φοράει** τώρα το `<html>` — `null` όταν καμία κλάση θέματος δεν έχει μπει ακόμη. Η κλάση είναι το
 * `attribute="class"` του `ThemeProvider` (`app/layout.tsx`).
 */
export function appliedBasemapScheme(root: Element): BasemapScheme | null {
  if (root.classList.contains('light')) return 'light';
  if (root.classList.contains('dark')) return 'dark';
  return null;
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

const readApplied = () => appliedBasemapScheme(document.documentElement);
/** Ο διακομιστής δεν έχει `<html>` με κλάση ⇒ «άγνωστο», και η ενυδάτωση βλέπει το ίδιο. */
const readServer = () => null;

export function useBasemapScheme(): BasemapScheme {
  const applied = useSyncExternalStore(subscribe, readApplied, readServer);
  const { resolvedTheme } = useHydratedTheme();
  return applied ?? basemapSchemeOf(resolvedTheme);
}
