/**
 * @fileoverview **Βαθμίδες διαθέσιμου χώρου (pane tiers)** — πόσες στήλες χωρούν **δίπλα στην μπάρα**, όχι στο παράθυρο.
 * @related ADR-946 §3.1 · ADR-797 (`shell-surface.css` §1: `--shell-sidebar-occupied`) · `tailwind.config.ts` (`pane-split:` · `pane-wide:`)
 * @module constants/pane-tiers
 *
 * 🔴 **Γιατί όχι `md:` / `xl:`** (μετρημένο στην παραγωγή 2026-11-20): το `md:` ρωτά το **παράθυρο**. Στα 900px με
 *   ανοιχτή μπάρα (272px) το περιεχόμενο έμενε **332px** και η κάρτα επισκόπησης έσπαγε («TEST-2 / ADR- / 834»).
 * 🔑 **Material 3 (window size classes)**: λίστα + λεπτομέρεια δίπλα-δίπλα μόνο από **Expanded ≥ 840dp** — μετρημένα
 *   στον χώρο **που μένει** για τα panes. Κάτω από αυτό: ένα pane, drill-down.
 * 🔑 **Γιατί όχι `@container`**: δημιουργεί stacking context **και** containing block για `fixed` (ADR-797 §3) — θα
 *   εγκλώβιζε την κάτω μπάρα ενεργειών του κινητού. Εδώ: media query **×** κατάσταση μπάρας, μηδέν containment,
 *   μηδέν JavaScript, σωστό από το **πρώτο** paint του SSR.
 * ⚠️ **Μονοτονία**: μικρότερη μπάρα ⇒ μικρότερο κατώφλι παραθύρου. Γι' αυτό ο κανόνας της **ανοιχτής** μπάρας γράφεται
 *   **χωρίς** επιλογέα κατάστασης: καλύπτει και σελίδες χωρίς κέλυφος, συντηρητικά.
 * ⚠️ Το αρχείο φορτώνεται από το `tailwind.config.ts` (Node) ⇒ **καμία** εισαγωγή `@/…`, καμία εξάρτηση.
 */

/** Πλάτος ανοιχτής μπάρας (rem) — SSoT για `ui/sidebar-context` (`--sidebar-width`). */
export const SIDEBAR_WIDTH_REM = 16;
/** Πλάτος μπάρας διπλωμένης σε εικονίδια (rem) — SSoT για `--sidebar-width-icon`. */
export const SIDEBAR_WIDTH_ICON_REM = 3;

/**
 * Ελάχιστος **διαθέσιμος** χώρος (rem) ανά βαθμίδα.
 * - `split` 52,5rem = **840px** — Material 3 Expanded: λίστα + λεπτομέρεια.
 * - `wide` 88rem = λίστα 16 + πλαϊνό 20 + 2 κενά 3 + **ενότητα ≥ 45rem** (η σειρά των 5 μετρικών διαβάζεται
 *   χωρίς σπάσιμο λέξης — στα 1440px με 3 στήλες η ενότητα ήταν ~500px και έσπαγε) + διάδρομος κελύφους 4.
 */
export const PANE_TIER_MIN_REM = { split: 52.5, wide: 88 } as const;

export type PaneTier = keyof typeof PANE_TIER_MIN_REM;

/** Πόσο αφαιρεί η μπάρα σε κάθε κατάσταση (`data-collapsible` του `ui/sidebar`, ίδιο με `shell-surface.css` §1). */
const SIDEBAR_STATES: readonly { readonly selector: string | null; readonly occupiedRem: number }[] = [
  { selector: null, occupiedRem: SIDEBAR_WIDTH_REM },
  { selector: "[data-collapsible='icon'] ~ [data-shell-inset]", occupiedRem: SIDEBAR_WIDTH_ICON_REM },
  { selector: "[data-collapsible='offcanvas'] ~ [data-shell-inset]", occupiedRem: 0 },
];

/** Οι συμβολοσειρές του `addVariant` για μία βαθμίδα: μία ανά κατάσταση μπάρας. */
export function paneTierVariant(tier: PaneTier): string[] {
  const minPane = PANE_TIER_MIN_REM[tier];
  return SIDEBAR_STATES.map(({ selector, occupiedRem }) => {
    const query = `@media (min-width: ${minPane + occupiedRem}rem)`;
    return selector === null ? `${query} { & }` : `${query} { ${selector} & }`;
  });
}
