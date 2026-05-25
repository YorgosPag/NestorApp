/**
 * ADR-366 §C.1.b — TimelineEditor React component tests.
 *
 * Black-box behavior: simulate user interactions, assert AnimationStore
 * state mutations. Mocks: react-i18next identity translator. Real Zustand
 * store reset between tests via `reset()`.
 */

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { TimelineEditor } from '../TimelineEditor';
import { useAnimationStore } from '../AnimationStore';
import type { Waypoint } from '../animation-types';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function makeWaypoint(idx: number): Waypoint {
  return {
    position: { x: idx, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    fov: 50,
    easingToNext: 'linear',
  };
}

beforeEach(() => {
  useAnimationStore.getState().reset();
});

afterEach(cleanup);

describe('TimelineEditor — empty state', () => {
  it('shows empty hint when no waypoints', () => {
    const { getByText } = render(<TimelineEditor />);
    expect(getByText('animation.timeline.emptyHint')).toBeInTheDocument();
  });
});

describe('TimelineEditor — waypoint list', () => {
  it('renders one <li> per waypoint with ordinal', () => {
    useAnimationStore.getState().setWaypoints([
      makeWaypoint(0),
      makeWaypoint(1),
      makeWaypoint(2),
    ]);
    const { container, getByText } = render(<TimelineEditor />);
    expect(container.querySelectorAll('li')).toHaveLength(3);
    expect(getByText('1')).toBeInTheDocument();
    expect(getByText('3')).toBeInTheDocument();
  });

  it('clicking a waypoint sets activeWaypointIndex', () => {
    useAnimationStore.getState().setWaypoints([makeWaypoint(0), makeWaypoint(1)]);
    const { container } = render(<TimelineEditor />);
    const selectButtons = container.querySelectorAll('li > button:first-child');
    fireEvent.click(selectButtons[1]!);
    expect(useAnimationStore.getState().activeWaypointIndex).toBe(1);
  });

  it('clicking the × delete button removes the waypoint', () => {
    useAnimationStore.getState().setWaypoints([
      makeWaypoint(0),
      makeWaypoint(1),
      makeWaypoint(2),
    ]);
    const { getAllByLabelText } = render(<TimelineEditor />);
    const deleteBtns = getAllByLabelText('animation.toolbar.deleteWaypoint');
    fireEvent.click(deleteBtns[1]!);
    const wps = useAnimationStore.getState().waypoints;
    expect(wps).toHaveLength(2);
    expect(wps[0]!.position.x).toBe(0);
    expect(wps[1]!.position.x).toBe(2);
  });

  it('drag-and-drop reorders waypoints (from index 0 → 2)', () => {
    useAnimationStore.getState().setWaypoints([
      makeWaypoint(0),
      makeWaypoint(1),
      makeWaypoint(2),
    ]);
    const { container } = render(<TimelineEditor />);
    const items = container.querySelectorAll('li');
    fireEvent.dragStart(items[0]!);
    fireEvent.dragOver(items[2]!);
    fireEvent.drop(items[2]!);
    const wps = useAnimationStore.getState().waypoints;
    expect(wps[0]!.position.x).toBe(1);
    expect(wps[1]!.position.x).toBe(2);
    expect(wps[2]!.position.x).toBe(0);
  });
});

describe('TimelineEditor — config row', () => {
  it('"Add at current camera" enqueues a waypoint', () => {
    const { getByText } = render(<TimelineEditor />);
    expect(useAnimationStore.getState().waypoints).toHaveLength(0);
    fireEvent.click(getByText('animation.toolbar.addAtCurrentCamera'));
    expect(useAnimationStore.getState().waypoints).toHaveLength(1);
  });

  it('duration input updates durationSec', () => {
    const { container } = render(<TimelineEditor />);
    const inputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(inputs[0]!, { target: { value: '12' } });
    expect(useAnimationStore.getState().durationSec).toBe(12);
  });

  it('fps select updates fps', () => {
    const { container } = render(<TimelineEditor />);
    const selects = container.querySelectorAll('select');
    fireEvent.change(selects[0]!, { target: { value: '60' } });
    expect(useAnimationStore.getState().fps).toBe(60);
  });

  it('axis select updates axis', () => {
    const { container } = render(<TimelineEditor />);
    const selects = container.querySelectorAll('select');
    fireEvent.change(selects[1]!, { target: { value: 'z' } });
    expect(useAnimationStore.getState().axis).toBe('z');
  });

  it('direction select updates direction', () => {
    const { container } = render(<TimelineEditor />);
    const selects = container.querySelectorAll('select');
    fireEvent.change(selects[2]!, { target: { value: 'cw' } });
    expect(useAnimationStore.getState().direction).toBe('cw');
  });
});

describe('TimelineEditor — waypoint form gating', () => {
  it('renders TimelineWaypointForm when activeIndex is set', () => {
    useAnimationStore.getState().setWaypoints([makeWaypoint(0)]);
    useAnimationStore.getState().setActiveWaypointIndex(0);
    const { getByText } = render(<TimelineEditor />);
    expect(getByText('animation.waypoint.title')).toBeInTheDocument();
  });

  it('does NOT render TimelineWaypointForm when activeIndex is null', () => {
    useAnimationStore.getState().setWaypoints([makeWaypoint(0)]);
    useAnimationStore.getState().setActiveWaypointIndex(null);
    const { queryByText } = render(<TimelineEditor />);
    expect(queryByText('animation.waypoint.title')).toBeNull();
  });
});
