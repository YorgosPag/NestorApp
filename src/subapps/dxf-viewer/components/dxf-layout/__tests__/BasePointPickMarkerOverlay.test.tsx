/**
 * @jest-environment jsdom
 *
 * ADR-652 M6.1 — BasePointPickMarkerOverlay: το ghost marker εμφανίζεται ΜΟΝΟ όσο το pick-base-point
 * store είναι armed ΚΑΙ υπάρχει realtime cursor· διαφορετικά δεν αποδίδει τίποτα (gate-at-mount).
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { BasePointPickMarkerOverlay } from '../BasePointPickMarkerOverlay';
import {
  armPickBasePoint,
  disarmPickBasePoint,
  __resetPickBasePointForTests,
} from '../../../systems/block/pick-base-point-store';
import { setRealtimeWorldCursor } from '../../../systems/cursor/ImmediatePositionStore';
import type { ViewTransform, Viewport } from '../../../rendering/types/Types';

const transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
const viewport = { width: 800, height: 600 } as unknown as Viewport;

const renderOverlay = () =>
  render(<BasePointPickMarkerOverlay transform={transform} viewport={viewport} />);

describe('ADR-652 M6.1 — BasePointPickMarkerOverlay', () => {
  beforeEach(() => {
    __resetPickBasePointForTests();
    setRealtimeWorldCursor(null);
  });

  it('renders nothing while not armed', () => {
    setRealtimeWorldCursor({ x: 10, y: 20 });
    const { container } = renderOverlay();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders the marker (square + crosshair) while armed with a live cursor', () => {
    setRealtimeWorldCursor({ x: 10, y: 20 });
    armPickBasePoint();
    const { container } = renderOverlay();

    expect(container.querySelector('svg')).not.toBeNull();
    // halo rect + marker square
    expect(container.querySelectorAll('rect')).toHaveLength(2);
    // four crosshair arms
    expect(container.querySelectorAll('line')).toHaveLength(4);
  });

  it('renders nothing while armed but without a cursor yet', () => {
    armPickBasePoint();
    setRealtimeWorldCursor(null);
    const { container } = renderOverlay();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('disarming hides the marker', () => {
    setRealtimeWorldCursor({ x: 5, y: 5 });
    armPickBasePoint();
    const { container } = renderOverlay();
    expect(container.querySelector('svg')).not.toBeNull();

    act(() => disarmPickBasePoint());
    expect(container.querySelector('svg')).toBeNull();
  });
});
