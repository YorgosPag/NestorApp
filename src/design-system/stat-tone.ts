/**
 * @fileoverview **Ο ΤΟΝΟΣ ΚΑΡΤΑΣ ΣΤΑΤΙΣΤΙΚΟΥ — ένας κατάλογος, ένας χάρτης** (ADR-770 §18 · ADR-777 §8.101).
 * @module design-system/stat-tone
 * @related design-system/color-bridge.ts (`COLOR_BRIDGE.text` — η πηγή κάθε κλάσης μελανιού εδώ) ·
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
  pink: COLOR_BRIDGE.text.pink,
  yellow: COLOR_BRIDGE.text.warning,
  indigo: COLOR_BRIDGE.text.info,
};

/**
 * Το **φόντο του εικονιδίου** κάθε τόνου — ζεύγος του `STAT_TONE_TEXT`: κάθε φόντο είναι απόχρωση της **ΙΔΙΑΣ**
 * οικογένειας με το μελάνι του (info · success · warning · hue-purple · hue-pink), ώστε μελάνι και φόντο να μην αποκλίνουν ποτέ.
 * Ζούσε ως `ICON_BG_MAP` μέσα στο `ReportKPIGrid` (ADR-770 §11, 2026-11-12): purple/cyan/pink/indigo έπαιρναν όλα
 * το ουδέτερο `bg-accent` — τέσσερις τόνοι με ένα φόντο, και δύο σημεία δήλωσης για ένα εικονίδιο.
 *
 * ⚠️ **Ολόκληρες κλάσεις, ποτέ συναρμολόγηση** (`COLOR_BRIDGE.bg.info + '/20'`): ο Tailwind JIT βλέπει μόνο ό,τι
 *    γράφεται αυτούσιο στην πηγή — συναρμολογημένη κλάση δεν παράγεται και το φόντο χάνεται σιωπηλά.
 * ⛔ **Διαφάνεια ΜΟΝΟ από την κλίμακα** (5 · 10 · 15 · 20 · 25 · …): το `/12` **δεν παράγεται** από τον Tailwind 3.4
 *    — μετρήθηκε ζωντανά 2026-11-12 (live `0b404fb`): κανόνας απών, φόντο `rgba(0,0,0,0)`. Εκτός κλίμακας ⇒ `/[0.12]`.
 * 📏 Μετρημένο (τα νέα ζεύγη, `/10`): μελάνι πάνω στο φόντο του, συντεθειμένο στην κάρτα — purple φωτεινό ≥5,22:1 ·
 *    σκοτεινό ≥4,57:1 · pink φωτεινό ≥4,37:1 · σκοτεινό ≥4,45:1 (μετρημένα με `/12` — το `/10` είναι πιο ανοιχτό,
 *    άρα ίσο ή καλύτερο · WCAG 1.4.11 = 3:1).
 */
export const STAT_TONE_ICON_BG: Readonly<Record<StatTone, string>> = {
  blue: 'bg-[hsl(var(--bg-info))]/20',
  gray: 'bg-muted',
  green: 'bg-[hsl(var(--bg-success))]/10',
  purple: 'bg-[hsl(var(--hue-purple))]/10',
  red: 'bg-destructive/10',
  orange: 'bg-[hsl(var(--bg-warning))]/40',
  cyan: 'bg-[hsl(var(--bg-info))]/20',
  pink: 'bg-[hsl(var(--hue-pink))]/10',
  yellow: 'bg-[hsl(var(--bg-warning))]/40',
  indigo: 'bg-[hsl(var(--bg-info))]/20',
};
