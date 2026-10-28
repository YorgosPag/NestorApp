/**
 * Πότε μπαγιατεύει μόνη της μια όψη τιμών (ADR-923 §5.11 «3δ» Ζ · ADR-905 §3).
 */

import { PRICING_VIEW_MAX_AGE_MS, pricingFreshUntil } from '../pricing-view-freshness';

const NOW = Date.parse('2026-08-01T00:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

describe('pricingFreshUntil', () => {
  it('κανένα όριο ⇒ το δίχτυ', () => {
    expect(pricingFreshUntil(NOW, [])).toBe(iso(NOW + PRICING_VIEW_MAX_AGE_MS));
  });

  it('το ΠΡΩΤΟ μελλοντικό όριο, ανεξάρτητα από τη σειρά', () => {
    const later = iso(NOW + 3_600_000);
    const sooner = iso(NOW + 60_000);
    expect(pricingFreshUntil(NOW, [later, sooner])).toBe(sooner);
  });

  it('παρελθόν, «τώρα», `null` και άκυρα αγνοούνται (το «τώρα» δεν είναι μέλλον — θα ξαναρωτούσε αμέσως, για πάντα)', () => {
    expect(pricingFreshUntil(NOW, [iso(NOW - 1), iso(NOW), null, 'όχι-ημερομηνία'])).toBe(iso(NOW + PRICING_VIEW_MAX_AGE_MS));
  });

  it('όριο πέρα από το δίχτυ ⇒ το δίχτυ', () => {
    expect(pricingFreshUntil(NOW, [iso(NOW + PRICING_VIEW_MAX_AGE_MS + 1)])).toBe(iso(NOW + PRICING_VIEW_MAX_AGE_MS));
  });
});
