/**
 * ADR-650 M5α.2 — the layer must pass EVERY glyph prop through.
 *
 * Regression guard for a bug that failed completely silently: `ClashMarkerLayer` rendered
 * `<ClashMarkerGlyph severity={m.severity} soft={m.soft} />` — a hand-picked list. When the
 * topography QA report started marking one flag as `selected`, the prop was built correctly, put
 * into the array correctly, handed to the layer correctly… and dropped on that line. No type
 * error (the extra key is simply unused), no test failure, no console warning. The only symptom
 * was a user saying «the selected point does not look any different».
 *
 * So this asserts the contract at the seam, not the appearance: whatever the glyph understands,
 * the layer forwards.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { ClashMarkerLayer } from '../ClashMarkerLayer';
import type { ClashMarkerGlyphProps } from '../ClashMarkerGlyph';

/** The selected glyph draws an extra halo ring outside the box — r=11 is its fingerprint. */
function haloCount(container: HTMLElement): number {
  return container.querySelectorAll('circle[r="11"]').length;
}

const noopSubscribe = (): (() => void) => () => {};
const projectAll = (): { x: number; y: number } => ({ x: 0, y: 0 });

describe('ClashMarkerLayer → ClashMarkerGlyph prop forwarding', () => {
  it('forwards `selected` so the focused marker renders its halo', () => {
    const markers: ClashMarkerGlyphProps[] = [
      { severity: 'high', soft: false, selected: false },
      { severity: 'high', soft: false, selected: true },
      { severity: 'low', soft: false, selected: false },
    ];
    const { container } = render(
      <ClashMarkerLayer markers={markers} project={projectAll} subscribe={noopSubscribe} />,
    );
    expect(haloCount(container)).toBe(1);
  });

  it('draws no halo when nothing is selected (the clash overlay\'s case)', () => {
    const markers: ClashMarkerGlyphProps[] = [
      { severity: 'high', soft: false },
      { severity: 'medium', soft: true },
    ];
    const { container } = render(
      <ClashMarkerLayer markers={markers} project={projectAll} subscribe={noopSubscribe} />,
    );
    expect(haloCount(container)).toBe(0);
  });

  it('still forwards `soft` (dashed ring) — the pre-existing prop must not regress', () => {
    const markers: ClashMarkerGlyphProps[] = [{ severity: 'low', soft: true }];
    const { container } = render(
      <ClashMarkerLayer markers={markers} project={projectAll} subscribe={noopSubscribe} />,
    );
    expect(container.querySelector('circle[stroke-dasharray]')).not.toBeNull();
  });

  it('renders one glyph per marker', () => {
    const markers: ClashMarkerGlyphProps[] = [
      { severity: 'high', soft: false },
      { severity: 'medium', soft: false },
      { severity: 'low', soft: false, selected: true },
    ];
    const { container } = render(
      <ClashMarkerLayer markers={markers} project={projectAll} subscribe={noopSubscribe} />,
    );
    expect(container.querySelectorAll('svg')).toHaveLength(3);
  });
});
