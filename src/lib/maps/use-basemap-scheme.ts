'use client';

/**
 * @fileoverview **Ποιο θέμα βάφει ο χάρτης φόντου** — το θέμα της εφαρμογής, από το SSoT `useHydratedTheme`.
 * @related ADR-891 §9 (Φ3) · `protomaps-style.ts` · `lib/appearance/useHydratedTheme.ts` (ADR-815)
 * @module lib/maps/use-basemap-scheme
 *
 * Πριν την ενυδάτωση το θέμα είναι άγνωστο ⇒ `APP_DEFAULT_THEME` (αυτό που βάφει και η σελίδα). Ο χάρτης είναι
 * καμβάς WebGL που φορτώνει στυλ και πλακίδια **μετά** το πρώτο effect, οπότε η διόρθωση προλαβαίνει την πρώτη
 * ζωγραφιά· και ακόμη κι αν όχι, η αλλαγή στυλ είναι diff χωρίς νέα λήψη πλακιδίων.
 */

import { APP_DEFAULT_THEME } from '@/lib/appearance/theme-storage-key';
import { useHydratedTheme } from '@/lib/appearance/useHydratedTheme';
import type { BasemapScheme } from './basemap-catalog';

/** `resolvedTheme` → θέμα χάρτη. Το `system` έχει ήδη λυθεί· ό,τι άγνωστο πέφτει στο προεπιλεγμένο. */
export function basemapSchemeOf(resolvedTheme: string | undefined): BasemapScheme {
  const theme = resolvedTheme ?? APP_DEFAULT_THEME;
  return theme === 'light' ? 'light' : 'dark';
}

export function useBasemapScheme(): BasemapScheme {
  return basemapSchemeOf(useHydratedTheme().resolvedTheme);
}
