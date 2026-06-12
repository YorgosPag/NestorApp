/**
 * ADR-443 — Tests for the composed structural tool icon (base × method).
 *
 * Guarantees that every {base, method} combination used by the «Δομικά» tab
 * renders an <svg> without throwing, that the caller's sizing className is
 * applied, that the badge is aria-hidden (decorative), and that distinct methods
 * produce distinct markup (no silent icon collision at the render layer).
 */

import React from 'react';
import { render } from '@testing-library/react';
import { StructuralToolIcon } from '../StructuralToolIcon';
import { type StructuralBase } from '../structural-icon-bases';
import { type StructuralMethod } from '../structural-icon-methods';

const BASES: StructuralBase[] = ['wall', 'column', 'beam', 'foundation-pad', 'foundation-strip'];
const METHODS: StructuralMethod[] = [
  'single', 'on-entity', 'region-lines', 'region-inside', 'region-box',
  'from-perimeter', 'discrete-from-perimeter', 'discrete-from-perimeter-walls',
  'from-grid', 'tie',
];

describe('ADR-443 — StructuralToolIcon (base × method composition)', () => {
  it('renders an aria-hidden <svg> for every base × method without throwing', () => {
    for (const base of BASES) {
      for (const method of METHODS) {
        const { container } = render(<StructuralToolIcon base={base} method={method} />);
        const svg = container.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg?.getAttribute('aria-hidden')).toBe('true');
      }
    }
  });

  it('applies the caller-provided sizing className', () => {
    const { container } = render(
      <StructuralToolIcon base="wall" method="single" className="dxf-ribbon-btn-icon-large" />,
    );
    expect(container.querySelector('svg')?.getAttribute('class')).toBe('dxf-ribbon-btn-icon-large');
  });

  it('renders no method badge for `single` but does for other methods (same base)', () => {
    const single = render(<StructuralToolIcon base="wall" method="single" />).container.innerHTML;
    const box = render(<StructuralToolIcon base="wall" method="region-box" />).container.innerHTML;
    expect(box).not.toBe(single);
    expect(box.length).toBeGreaterThan(single.length);
  });

  it('produces distinct markup across all ten methods for a fixed base (no badge collision)', () => {
    const markups = METHODS.map(
      (method) => render(<StructuralToolIcon base="column" method={method} />).container.innerHTML,
    );
    expect(new Set(markups).size).toBe(METHODS.length);
  });
});
