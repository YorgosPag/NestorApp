/**
 * ADR-366 §C.1.b — TimelineWaypointForm React component tests.
 *
 * Pure controlled-component tests. onPatch is a jest.fn(); each field change
 * is asserted via the patch payload shape.
 */

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { TimelineWaypointForm } from '../TimelineWaypointForm';
import type { Waypoint } from '../animation-types';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function makeWaypoint(overrides: Partial<Waypoint> = {}): Waypoint {
  return {
    position: { x: 1, y: 2, z: 3 },
    target: { x: 4, y: 5, z: 6 },
    fov: 50,
    easingToNext: 'linear',
    ...overrides,
  };
}

afterEach(cleanup);

describe('TimelineWaypointForm', () => {
  it('position X change patches the position vec preserving y/z', () => {
    const onPatch = jest.fn();
    const { getAllByLabelText } = render(
      <TimelineWaypointForm waypoint={makeWaypoint()} onPatch={onPatch} />,
    );
    const xs = getAllByLabelText('x');
    fireEvent.change(xs[0]!, { target: { value: '7' } });
    expect(onPatch).toHaveBeenCalledWith({ position: { x: 7, y: 2, z: 3 } });
  });

  it('target Y change patches the target vec preserving x/z', () => {
    const onPatch = jest.fn();
    const { getAllByLabelText } = render(
      <TimelineWaypointForm waypoint={makeWaypoint()} onPatch={onPatch} />,
    );
    const ys = getAllByLabelText('y');
    fireEvent.change(ys[1]!, { target: { value: '99' } });
    expect(onPatch).toHaveBeenCalledWith({ target: { x: 4, y: 99, z: 6 } });
  });

  it('FOV input change patches fov', () => {
    const onPatch = jest.fn();
    const { container } = render(
      <TimelineWaypointForm waypoint={makeWaypoint()} onPatch={onPatch} />,
    );
    const fovInput = container.querySelector(
      'input[type="number"][min="10"]',
    ) as HTMLInputElement;
    fireEvent.change(fovInput, { target: { value: '85' } });
    expect(onPatch).toHaveBeenCalledWith({ fov: 85 });
  });

  it('easing select change patches easingToNext', () => {
    const onPatch = jest.fn();
    const { container } = render(
      <TimelineWaypointForm waypoint={makeWaypoint()} onPatch={onPatch} />,
    );
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'ease-in-out' } });
    expect(onPatch).toHaveBeenCalledWith({ easingToNext: 'ease-in-out' });
  });

  it('renders the bezier editor inside the <details> expander', () => {
    const onPatch = jest.fn();
    const { getByText } = render(
      <TimelineWaypointForm waypoint={makeWaypoint()} onPatch={onPatch} />,
    );
    // Reset button label is unique to BezierCurveEditor — proves the
    // editor mounted inside the form.
    expect(getByText('animation.easing.bezier.reset')).toBeInTheDocument();
  });

  it('reset button clears customBezier (active variant)', () => {
    const onPatch = jest.fn();
    const waypoint = makeWaypoint({
      customBezier: { p1: [0.2, 0.5], p2: [0.8, 0.5] },
    });
    const { getByText } = render(
      <TimelineWaypointForm waypoint={waypoint} onPatch={onPatch} />,
    );
    fireEvent.click(getByText('animation.easing.bezier.reset'));
    expect(onPatch).toHaveBeenCalledWith({ customBezier: undefined });
  });
});
