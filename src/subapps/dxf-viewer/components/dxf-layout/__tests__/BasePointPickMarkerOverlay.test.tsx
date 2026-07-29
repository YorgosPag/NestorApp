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
// ADR-040 Phase XXII.B — το overlay διαβάζει πλέον το transform από το SSoT (leaf
// subscription), όχι από prop: το test κάνει seed το store αντί να περνά prop.
import { updateImmediateTransform } from '../../../systems/cursor/ImmediateTransformStore';
import type { Viewport } from '../../../rendering/types/Types';

const viewport = { width: 800, height: 600 } as unknown as Viewport;

const renderOverlay = () =>
  render(<BasePointPickMarkerOverlay viewport={viewport} />);

describe('ADR-652 M6.1 — BasePointPickMarkerOverlay', () => {
  beforeEach(() => {
    __resetPickBasePointForTests();
    setRealtimeWorldCursor(null);
    updateImmediateTransform({ scale: 1, offsetX: 0, offsetY: 0 });
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
