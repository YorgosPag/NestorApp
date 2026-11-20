/**
 * ADR-946 §3.1 — οι βαθμίδες μετρούν τον ΔΙΑΘΕΣΙΜΟ χώρο (παράθυρο − μπάρα), όχι το παράθυρο.
 * Μετρημένο περιστατικό: 900px + ανοιχτή μπάρα ⇒ η ενότητα έμενε 332px με το `md:`.
 */
import {
  PANE_TIER_MIN_REM,
  SIDEBAR_WIDTH_ICON_REM,
  SIDEBAR_WIDTH_REM,
  paneTierVariant,
} from '@/constants/pane-tiers';
import { SIDEBAR_WIDTH, SIDEBAR_WIDTH_ICON } from '@/components/ui/sidebar-context';

const minWidthsRem = (variants: readonly string[]): number[] =>
  variants.map((variant) => Number(/min-width: ([\d.]+)rem/.exec(variant)?.[1]));

describe('pane tiers — διαθέσιμος χώρος', () => {
  it('Π1: δύο στήλες από 840px διαθέσιμου χώρου (Material 3 Expanded)', () => {
    expect(PANE_TIER_MIN_REM.split * 16).toBe(840);
  });

  it('Π2: κάθε κατώφλι παραθύρου = βαθμίδα + ό,τι πιάνει η μπάρα σε εκείνη την κατάσταση', () => {
    for (const tier of ['split', 'wide'] as const) {
      const min = PANE_TIER_MIN_REM[tier];
      expect(minWidthsRem(paneTierVariant(tier))).toEqual([min + SIDEBAR_WIDTH_REM, min + SIDEBAR_WIDTH_ICON_REM, min]);
    }
  });

  it('Π3: ο κανόνας της ανοιχτής μπάρας δεν έχει επιλογέα (καλύπτει και σελίδες χωρίς κέλυφος)', () => {
    const [open, icon, offcanvas] = paneTierVariant('split');
    expect(open).toBe(`@media (min-width: ${PANE_TIER_MIN_REM.split + SIDEBAR_WIDTH_REM}rem) { & }`);
    expect(icon).toContain("[data-collapsible='icon'] ~ [data-shell-inset] &");
    expect(offcanvas).toContain("[data-collapsible='offcanvas'] ~ [data-shell-inset] &");
  });

  it('Π4: 900px με ανοιχτή μπάρα ⇒ ΕΝΑ pane (το περιστατικό της παραγωγής)', () => {
    expect(900 / 16).toBeLessThan(PANE_TIER_MIN_REM.split + SIDEBAR_WIDTH_REM);
  });

  it('Π5: η μπάρα διαβάζει τα πλάτη της από την ΙΔΙΑ πηγή', () => {
    expect(SIDEBAR_WIDTH).toBe(`${SIDEBAR_WIDTH_REM}rem`);
    expect(SIDEBAR_WIDTH_ICON).toBe(`${SIDEBAR_WIDTH_ICON_REM}rem`);
  });
});
