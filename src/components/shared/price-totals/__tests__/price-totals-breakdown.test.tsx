/**
 * Άγκυρες — ADR-777 §8.60.14.13: **η κάρτα στατιστικού ζωγραφίζει υποσύνολα, όχι έναν αριθμό.**
 */
import { render, screen, within } from '@testing-library/react';
import { Euro } from 'lucide-react';
import { StatsCard } from '@/components/property-management/dashboard/StatsCard';
import type { PriceTotalsRow } from '@/lib/listings/listing-price-label';
import { PriceTotalsBreakdown } from '../PriceTotalsBreakdown';

const ROWS: readonly PriceTotalsRow[] = [
  { key: 'sale', label: 'Πώληση · 2 ακίνητα', value: '2.430.000 €' },
  { key: 'rent', label: 'Ενοικίαση · 1 ακίνητο', value: '500 €/μήνα' },
  { key: 'unpriced', label: 'Χωρίς καταγεγραμμένη τιμή · 1 ακίνητο', value: null },
];

describe('ΠΑ. PriceTotalsBreakdown', () => {
  it('ΠΑ1 — `<dl>` με έναν όρο ανά κλάση, στη σειρά που δόθηκε', () => {
    const { container } = render(<PriceTotalsBreakdown rows={ROWS} />);
    const terms = [...container.querySelectorAll('dl > div > dt')].map((node) => node.textContent);
    expect(terms).toEqual(ROWS.map((row) => row.label));
  });

  it('ΠΑ2 — η κλάση χωρίς ποσό ΔΕΝ γεννά `<dd>` (ονομάζεται, δεν μηδενίζεται)', () => {
    const { container } = render(<PriceTotalsBreakdown rows={ROWS} />);
    const values = [...container.querySelectorAll('dd')].map((node) => node.textContent);
    expect(values).toEqual(['2.430.000 €', '500 €/μήνα']);
  });

  it('ΠΑ3 — η επιγραφή ΔΕΝ κόβεται (`truncate` θα έκρυβε το πλήθος)', () => {
    const { container } = render(<PriceTotalsBreakdown rows={ROWS} />);
    for (const term of container.querySelectorAll('dt')) {
      expect(term.className).not.toMatch(/\btruncate\b/);
    }
  });
});

describe('ΠΒ. StatsCard', () => {
  it('🔴 ΠΒ1 — με υποσύνολα: ΚΑΝΕΝΑΣ ενιαίος αριθμός, όλες οι γραμμές ορατές', () => {
    const { container } = render(
      <StatsCard title="Συνολική Αξία" value="2.430.500 €" priceBreakdown={ROWS} icon={Euro} color="gray" />,
    );
    const list = container.querySelector('dl');
    expect(list).not.toBeNull();
    expect(within(list as HTMLElement).getByText('500 €/μήνα')).toBeTruthy();
    expect(within(list as HTMLElement).getByText('2.430.000 €')).toBeTruthy();
    // ο ενιαίος αριθμός (αν κάποιος τον περάσει) ΔΕΝ ζωγραφίζεται δίπλα στα υποσύνολα
    expect(screen.queryByText('2.430.500 €')).toBeNull();
  });

  it('ΠΒ2 — χωρίς υποσύνολα: το σημερινό ένα ποσό, χωρίς `<dl>`', () => {
    const { container } = render(<StatsCard title="Συνολική Αξία" value="900 €/μήνα" icon={Euro} color="gray" />);
    expect(container.querySelector('dl')).toBeNull();
    expect(screen.getByText('900 €/μήνα')).toBeTruthy();
  });
});
