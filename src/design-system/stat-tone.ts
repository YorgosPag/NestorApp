/**
 * @fileoverview **Ο ΤΟΝΟΣ ΚΑΡΤΑΣ ΣΤΑΤΙΣΤΙΚΟΥ — ένας κατάλογος, ένας χάρτης** (ADR-770 §18 · ADR-777 §8.101).
 * @module design-system/stat-tone
 * @related design-system/color-bridge.ts (`COLOR_BRIDGE.text` — η πηγή κάθε κλάσης εδώ) ·
 *   components/property-management/dashboard/StatsCard.tsx · components/reports/core/ReportKPIGrid.tsx
 *
 * 🔴 **ΤΟ ΕΥΡΗΜΑ** (2026-11-11, ζωντανά στις Αναφορές): δύο κάρτες στατιστικού κρατούσαν **δίδυμους** χάρτες για τον
 * ίδιο κατάλογο 10 τόνων. Ο χάρτης του `ReportKPIGrid` έστελνε `blue`/`purple`/`cyan`/`pink`/`indigo` σε `text-primary` —
 * στο σκοτεινό θέμα `--primary` ≡ `--card` (`217 33% 17%`) ⇒ τα εικονίδια ήταν **αόρατα** (CHECK 3.38). Ο χάρτης του
 * `StatsCard` είχε ήδη θεματικά tokens και τα εικονίδιά του φαίνονταν. Τώρα υπάρχει **ένας**.
 *
 * 🔑 `gray` = **ουδέτερη** κάρτα (GitHub · Linear · Stripe): το χρώμα σε στατιστικό σημαίνει κατάσταση, όχι ποικιλία.
 * 🔑 `Record<StatTone, …>`: νέος τόνος **δεν μεταγλωττίζεται** μέχρι να πάρει κλάση εδώ (ήταν `color: string` και το
 *    ανύπαρκτο `"teal"` έβαφε `undefined`, ADR-770 §18).
 */

import { COLOR_BRIDGE } from './color-bridge';

/** Ο ΚΛΕΙΣΤΟΣ κατάλογος τόνων κάρτας στατιστικού. */
export type StatTone =
  | 'blue' | 'gray' | 'green' | 'purple' | 'red' | 'orange'
  | 'cyan' | 'pink' | 'yellow' | 'indigo';

/** Η κλάση **μελανιού** κάθε τόνου (ετικέτα · εικονίδιο) — μόνο θεματικά tokens, ποτέ `text-primary`. */
export const STAT_TONE_TEXT: Readonly<Record<StatTone, string>> = {
  blue: COLOR_BRIDGE.text.info,
  gray: COLOR_BRIDGE.text.muted,
  green: COLOR_BRIDGE.text.success,
  purple: COLOR_BRIDGE.text.purple,
  red: COLOR_BRIDGE.text.danger,
  orange: COLOR_BRIDGE.text.warning,
  cyan: COLOR_BRIDGE.text.info,
  pink: COLOR_BRIDGE.text.purple,
  yellow: COLOR_BRIDGE.text.warning,
  indigo: COLOR_BRIDGE.text.info,
};
