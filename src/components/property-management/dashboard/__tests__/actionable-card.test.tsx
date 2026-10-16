/**
 * Άγκυρες — ADR-840 §7.8: **η κάρτα ταμπλό που κάνει κάτι είναι κουμπί· η εναλλαγή λέει την κατάστασή της.**
 *
 * Μετρημένο στην οθόνη (2026-10-16): κάθε κάρτα του ταμπλό ακινήτων ήταν «κλικαρίσιμη» (και οι πληροφοριακές), η
 * ενεργή εναλλαγή φαινόταν ΜΟΝΟ από το χρώμα, και οι μετρικές πληρότητας είχαν `role="button"` χωρίς Enter/Space.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { Home } from 'lucide-react';

import { StatsCard } from '../StatsCard';
import { CoverageCard } from '../CoverageCard';
import { PRESSED_CARD_CLASS } from '../actionable-card';
import type { CoverageStats } from '@/hooks/usePropertiesStats';

const COVERAGE: CoverageStats = {
  totalProperties: 5,
  propertiesWithPhotos: 1,
  propertiesWithFloorplans: 0,
  propertiesWithDocuments: 0,
  photosPercentage: 20,
  floorplansPercentage: 0,
  documentsPercentage: 0,
};

describe('ΑΚ. StatsCard — πράξη και κατάσταση', () => {
  it('🔴 ΑΚ1 — χωρίς πράξη: ΚΑΝΕΝΑ κουμπί, καμία στάση στο Tab, κανένας δείκτης', () => {
    const { container } = render(<StatsCard title="Σύνολο" value={5} icon={Home} color="blue" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('[tabindex]')).toBeNull();
    expect(container.innerHTML).not.toMatch(/cursor-pointer/);
  });

  it('🔴 ΑΚ2 — με πράξη: κουμπί που ενεργοποιείται με κλικ, Enter ΚΑΙ Space', () => {
    const onClick = jest.fn();
    render(<StatsCard title="Στην αγορά" value={1} icon={Home} color="green" onClick={onClick} />);
    const card = screen.getByRole('button');
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.keyDown(card, { key: 'a' });
    expect(onClick).toHaveBeenCalledTimes(3);
    expect(card.getAttribute('tabindex')).toBe('0');
  });

  it('🔴 ΑΚ3 — εναλλαγή: `aria-pressed` + περίγραμμα, όχι μόνο χρώμα', () => {
    const { rerender } = render(<StatsCard title="Στην αγορά" value={1} icon={Home} color="green" onClick={() => {}} pressed={false} />);
    expect(screen.getByRole('button', { pressed: false }).className).not.toContain(PRESSED_CARD_CLASS);
    rerender(<StatsCard title="Στην αγορά" value={1} icon={Home} color="green" onClick={() => {}} pressed />);
    expect(screen.getByRole('button', { pressed: true }).className).toContain(PRESSED_CARD_CLASS);
  });

  it('ΑΚ4 — πράξη χωρίς δηλωμένη κατάσταση: ΚΑΝΕΝΑ `aria-pressed` (απλή πράξη, όχι εναλλαγή)', () => {
    render(<StatsCard title="Σύνολο" value={5} icon={Home} color="blue" onClick={() => {}} />);
    expect(screen.getByRole('button').hasAttribute('aria-pressed')).toBe(false);
  });
});

describe('ΑΠ. CoverageCard — οι τρεις μετρικές είναι εναλλαγές', () => {
  it('🔴 ΑΠ1 — η ενεργή σημαία είναι πατημένη, οι άλλες όχι', () => {
    render(<CoverageCard coverage={COVERAGE} activeMissing={{ missingPhotos: true }}
      onMissingPhotosClick={() => {}} onMissingFloorplansClick={() => {}} onMissingDocumentsClick={() => {}} />);
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(2);
  });

  it('🔴 ΑΠ2 — Enter ενεργοποιεί (ήταν `role="button"` χωρίς πληκτρολόγιο)', () => {
    const onPhotos = jest.fn();
    render(<CoverageCard coverage={COVERAGE} activeMissing={{}} onMissingPhotosClick={onPhotos} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(onPhotos).toHaveBeenCalledTimes(1);
  });

  it('ΑΠ3 — μετρική χωρίς χειριστή: πληροφοριακή (μόνο όσες έχουν πράξη γίνονται κουμπιά)', () => {
    render(<CoverageCard coverage={COVERAGE} onMissingPhotosClick={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
