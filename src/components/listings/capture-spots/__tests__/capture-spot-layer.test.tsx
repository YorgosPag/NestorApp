/**
 * @fileoverview 📍 **ΤΟ ΕΠΙΠΕΔΟ ΤΩΝ ΣΗΜΕΙΩΝ ΛΗΨΗΣ, ΕΚΤΕΛΕΣΜΕΝΟ** (ADR-897 Φ2).
 * @related ../CaptureSpotLayer.tsx
 *
 * Λ1 — ο κώνος ζωγραφίζεται **μόνο** για τον τρέχοντα, με το **δηλωμένο** πλάτος φακού;
 * Λ2 — κάθε σημείο είναι κουμπί με όνομα, που ενεργοποιείται με κλικ **και** Enter/Space;
 * Λ3 — χωρίς `onActivate` είναι διακοσμητικό (τίποτα εστιάσιμο, τίποτα στο δέντρο προσβασιμότητας);
 * Λ4 — μηδέν inline style (N.3), `viewBox` στις διαστάσεις της εικόνας (όχι 0..100 — ο κώνος δεν παραμορφώνεται).
 * Λ5 — στόχος αφής ≥ 20 px **οθόνης** γύρω από κάθε σημείο (μετρημένο: 8×8 px σε κινητό 390).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { conePath } from '@/lib/geometry/view-cone';

import { CaptureSpotLayer, type CaptureSpotMarker } from '../CaptureSpotLayer';
import { captureSpotMetrics } from '../capture-spot-metrics';

const IMAGE = { width: 2000, height: 1000 };
const MARKERS: CaptureSpotMarker[] = [
  { key: '0', label: 'Φωτογραφία 1', spot: { x: 0.25, y: 0.5, headingRad: 0, fovRad: 1.2 } },
  { key: '1', label: 'Φωτογραφία 2', spot: { x: 0.75, y: 0.5, headingRad: Math.PI / 2, fovRad: 0.8 } },
];

describe('Λ1 — κώνος μόνο για τον τρέχοντα, με το δηλωμένο πλάτος', () => {
  it('ένας κώνος, με το `fovRad` του τρέχοντος', () => {
    const { container } = render(
      <CaptureSpotLayer image={IMAGE} markers={MARKERS} currentKey="1" onActivate={jest.fn()} ariaLabel="Κάτοψη" />,
    );
    const expected = conePath(0.8 / 2, captureSpotMetrics(IMAGE).cone);
    const cones = [...container.querySelectorAll('path')].filter((path) => path.getAttribute('d') === expected);
    expect(cones).toHaveLength(1);
    expect(cones[0].getAttribute('transform')).toBe('translate(1500 500) rotate(90)');
  });

  it('χωρίς τρέχοντα ⇒ κανένας κώνος, κανένα `aria-current`', () => {
    const { container } = render(<CaptureSpotLayer image={IMAGE} markers={MARKERS} currentKey={null} onActivate={jest.fn()} />);
    const big = conePath(1.2 / 2, captureSpotMetrics(IMAGE).cone);
    expect([...container.querySelectorAll('path')].some((path) => path.getAttribute('d') === big)).toBe(false);
    expect(container.querySelector('[aria-current]')).toBeNull();
  });
});

describe('Λ2 — κουμπιά με όνομα, κλικ και πληκτρολόγιο', () => {
  it('κλικ, Enter και Space ενεργοποιούν το σωστό σημείο', async () => {
    const onActivate = jest.fn();
    render(<CaptureSpotLayer image={IMAGE} markers={MARKERS} currentKey="0" onActivate={onActivate} ariaLabel="Κάτοψη" />);
    const second = screen.getByRole('button', { name: 'Φωτογραφία 2' });
    await userEvent.click(second);
    second.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onActivate.mock.calls).toEqual([['1'], ['1'], ['1']]);
    expect(screen.getByRole('button', { name: 'Φωτογραφία 1' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('group', { name: 'Κάτοψη' })).toBeInTheDocument();
  });
});

describe('Λ3 — χωρίς `onActivate`, διακοσμητικό', () => {
  it('κανένα κουμπί, τίποτα εστιάσιμο', () => {
    const { container } = render(<CaptureSpotLayer image={IMAGE} markers={MARKERS} currentKey="0" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(container.querySelector('[tabindex]')).toBeNull();
  });
});

describe('Λ4 — μηδέν inline style, viewBox της εικόνας', () => {
  it('καμία ιδιότητα `style`, viewBox = πλάτος × ύψος', () => {
    const { container } = render(<CaptureSpotLayer image={IMAGE} markers={MARKERS} currentKey="0" onActivate={jest.fn()} />);
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 2000 1000');
    expect(container.querySelector('[style]')).toBeNull();
  });
});

describe('Λ5 — στόχος αφής σε pixel οθόνης (WCAG 2.5.8, ADR-897 §6)', () => {
  it('κάθε διαδραστικό σημείο έχει αόρατο δακτύλιο σταθερού πάχους οθόνης, που ενεργοποιεί το ΙΔΙΟ σημείο', async () => {
    const onActivate = jest.fn();
    const { container } = render(<CaptureSpotLayer image={IMAGE} markers={MARKERS} currentKey="0" onActivate={onActivate} />);
    const rings = [...container.querySelectorAll('[data-tap-ring]')];
    expect(rings).toHaveLength(MARKERS.length);
    for (const ring of rings) {
      expect(ring).toHaveAttribute('vector-effect', 'non-scaling-stroke');
      expect(Number(ring.getAttribute('stroke-width'))).toBeGreaterThanOrEqual(20);
      expect(ring).toHaveAttribute('aria-hidden');
    }
    // ⚠️ Ο τρέχων ζωγραφίζεται τελευταίος (από πάνω) ⇒ η σειρά στο DOM δεν είναι η σειρά των σημείων· διαλέγουμε με τη θέση.
    const second = rings.find((ring) => ring.getAttribute('cx') === String(MARKERS[1].spot.x * IMAGE.width));
    await userEvent.click(second as Element);
    expect(onActivate).toHaveBeenCalledWith('1');
  });

  it('η «μύτη» κατεύθυνσης (ζωγραφίζεται ΠΑΝΩ από τον δακτύλιο) δεν τρώει την αφή', () => {
    const { container } = render(<CaptureSpotLayer image={IMAGE} markers={MARKERS} currentKey="0" onActivate={jest.fn()} />);
    const paths = [...container.querySelectorAll('path')];
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) expect(path.getAttribute('class')).toContain('pointer-events-none');
  });

  it('διακοσμητικό επίπεδο ⇒ κανένας δακτύλιος', () => {
    const { container } = render(<CaptureSpotLayer image={IMAGE} markers={MARKERS} currentKey="0" />);
    expect(container.querySelector('[data-tap-ring]')).toBeNull();
  });
});
