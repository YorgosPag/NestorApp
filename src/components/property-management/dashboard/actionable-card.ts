/**
 * @fileoverview **Η κάρτα ταμπλό που κάνει κάτι** — μία συμπεριφορά για κάθε κάρτα με πράξη.
 * @related ADR-840 §7.8 · ADR-771 (κανάλι κατάστασης) · ADR-770 §19 (πατημένο)
 * @module components/property-management/dashboard/actionable-card
 *
 * Ζούσε **δύο φορές, και καμία σωστά**: το `StatsCard` έδινε `onClick` σε `div` (καμία στάση στο Tab), η
 * `CoverageCard` έδινε `role="button"` + `tabIndex` **χωρίς** Enter/Space — εστίαση χωρίς πράξη. Και στις δύο η
 * ενεργή εναλλαγή φαινόταν **μόνο** από το χρώμα.
 *
 * 🔑 Χωρίς πράξη ⇒ **καμία** ιδιότητα: η πληροφοριακή κάρτα δεν δείχνει δείκτη ούτε σταματά το Tab.
 */

import type React from 'react';

import { COLOR_BRIDGE } from '@/design-system/color-bridge';

/** Ίδιο δαχτυλίδι εστίασης με το `Button`: η κάρτα με πράξη είναι κουμπί, και φαίνεται έτσι στο πληκτρολόγιο. */
export const ACTIONABLE_CARD_CLASS =
  'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/** Πατημένη εναλλαγή: περίγραμμα τονισμού **και** πάχος — δεύτερο κανάλι πέρα από το χρώμα (ADR-771). */
export const PRESSED_CARD_CLASS = `border-2 ${COLOR_BRIDGE.selectionControl.accentOutline}`;

export interface ActionableCardProps {
  readonly onClick: () => void;
  readonly onKeyDown: (event: React.KeyboardEvent) => void;
  readonly role: 'button';
  readonly tabIndex: 0;
  readonly 'aria-pressed'?: boolean;
}

/**
 * @param onActivate Η πράξη της κάρτας· `undefined` ⇒ πληροφοριακή κάρτα, κενό αντικείμενο.
 * @param pressed Κατάσταση εναλλαγής φίλτρου· `undefined` ⇒ απλή πράξη, όχι εναλλαγή (κανένα `aria-pressed`).
 */
export function actionableCardProps(
  onActivate: (() => void) | undefined,
  pressed?: boolean,
): ActionableCardProps | Record<string, never> {
  if (!onActivate) return {};
  return {
    onClick: onActivate,
    // Enter/Space — όπως σε κάθε `role="button"` (WAI-ARIA APG)· το Space δεν πρέπει να κυλήσει τη σελίδα.
    onKeyDown: (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onActivate();
    },
    role: 'button',
    tabIndex: 0,
    ...(pressed !== undefined && { 'aria-pressed': pressed }),
  };
}
