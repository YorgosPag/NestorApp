/**
 * ProposalGhostOverlay — SSoT dedicated-canvas overlay tests.
 *
 * The scheduler subscription is mocked (no real RAF), and a stub 2D context is installed (jsdom
 * has no canvas backend). Verifies: idle ⇒ renders null + never paints; active + a valid viewport
 * ⇒ mounts its own canvas + paints; a 0×0 viewport ⇒ guarded (no paint, no throw).
 */

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import type { ViewTransform } from '../../../rendering/types/Types';

// No real scheduler — the initial paint comes from the proposal-change effect, not the frame.
jest.mock('../../../rendering/core/immediate-transform-frame', () => ({
  subscribeImmediateTransformFrame: jest.fn(() => () => {}),
}));

import { ProposalGhostOverlay, type ProposalGhostPaint } from '../ProposalGhostOverlay';

const ctxStub = { setTransform: jest.fn(), clearRect: jest.fn() };

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ctxStub) as never;
});

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

const TRANSFORM: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 } as ViewTransform;

function renderOverlay(active: boolean, viewport: { width: number; height: number }, paint: ProposalGhostPaint) {
  return render(
    <ProposalGhostOverlay
      active={active}
      transform={TRANSFORM}
      viewport={viewport}
      paint={paint}
      dataOverlay="test-proposal"
    />,
  );
}

describe('ProposalGhostOverlay', () => {
  it('renders null and never paints while idle (inactive)', () => {
    const paint = jest.fn();
    const { container } = renderOverlay(false, { width: 100, height: 80 }, paint);
    expect(container.querySelector('canvas')).toBeNull();
    expect(paint).not.toHaveBeenCalled();
  });

  it('mounts its own dedicated canvas and paints when active with a valid viewport', () => {
    const paint = jest.fn();
    const { container } = renderOverlay(true, { width: 100, height: 80 }, paint);
    const canvas = container.querySelector('canvas[data-dxf-overlay="test-proposal"]');
    expect(canvas).not.toBeNull();
    expect(paint).toHaveBeenCalledTimes(1);
    // The paint receives the stub context + the (live) transform + the viewport.
    expect(paint).toHaveBeenCalledWith(ctxStub, expect.anything(), { width: 100, height: 80 });
  });

  it('guards a 0×0 viewport — clears but never paints (no throw)', () => {
    const paint = jest.fn();
    renderOverlay(true, { width: 0, height: 0 }, paint);
    expect(paint).not.toHaveBeenCalled();
  });
});
