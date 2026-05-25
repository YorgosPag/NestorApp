/**
 * ADR-366 Phase 9 / C.1.a — AnimationStore tests.
 */

import { useAnimationStore } from '../../animation/AnimationStore';
import type {
  BimAnimationDoc,
  Waypoint,
} from '../../animation/animation-types';

const WP_A: Waypoint = {
  position: { x: 0, y: 0, z: 0 },
  target: { x: 0, y: 0, z: 0 },
  fov: 50,
  easingToNext: 'linear',
};
const WP_B: Waypoint = {
  position: { x: 10, y: 0, z: 0 },
  target: { x: 0, y: 0, z: 0 },
  fov: 50,
  easingToNext: 'ease-in',
};
const WP_C: Waypoint = {
  position: { x: 10, y: 10, z: 0 },
  target: { x: 0, y: 0, z: 0 },
  fov: 50,
  easingToNext: 'ease-out',
};

function resetStore() {
  useAnimationStore.getState().reset();
}

describe('AnimationStore — config setters', () => {
  beforeEach(resetStore);

  it('starts with default config (empty waypoints, 8s @ 30fps, Y-axis CCW)', () => {
    const s = useAnimationStore.getState();
    expect(s.waypoints).toEqual([]);
    expect(s.durationSec).toBe(8);
    expect(s.fps).toBe(30);
    expect(s.axis).toBe('y');
    expect(s.direction).toBe('ccw');
    expect(s.splitTracks).toBe(false);
    expect(s.activeWaypointIndex).toBeNull();
    expect(s.loadedDocId).toBeNull();
  });

  it('setDurationSec updates duration', () => {
    useAnimationStore.getState().setDurationSec(12);
    expect(useAnimationStore.getState().durationSec).toBe(12);
  });

  it('setFps / setAxis / setDirection / setSplitTracks update independently', () => {
    const a = useAnimationStore.getState();
    a.setFps(60);
    a.setAxis('x');
    a.setDirection('cw');
    a.setSplitTracks(true);
    const next = useAnimationStore.getState();
    expect(next.fps).toBe(60);
    expect(next.axis).toBe('x');
    expect(next.direction).toBe('cw');
    expect(next.splitTracks).toBe(true);
  });
});

describe('AnimationStore — waypoint actions', () => {
  beforeEach(resetStore);

  it('addWaypoint appends and selects new waypoint', () => {
    useAnimationStore.getState().addWaypoint(WP_A);
    const s1 = useAnimationStore.getState();
    expect(s1.waypoints).toEqual([WP_A]);
    expect(s1.activeWaypointIndex).toBe(0);

    useAnimationStore.getState().addWaypoint(WP_B);
    const s2 = useAnimationStore.getState();
    expect(s2.waypoints.length).toBe(2);
    expect(s2.activeWaypointIndex).toBe(1);
  });

  it('insertWaypointAt clamps index to [0, length]', () => {
    const a = useAnimationStore.getState();
    a.addWaypoint(WP_A);
    a.addWaypoint(WP_B);
    a.insertWaypointAt(-5, WP_C);
    expect(useAnimationStore.getState().waypoints[0]).toEqual(WP_C);

    a.insertWaypointAt(999, WP_A);
    const after = useAnimationStore.getState().waypoints;
    expect(after[after.length - 1]).toEqual(WP_A);
  });

  it('removeWaypoint drops element + shifts activeWaypointIndex correctly', () => {
    const a = useAnimationStore.getState();
    a.addWaypoint(WP_A);
    a.addWaypoint(WP_B);
    a.addWaypoint(WP_C);
    a.setActiveWaypointIndex(2);

    a.removeWaypoint(1);
    const s = useAnimationStore.getState();
    expect(s.waypoints.length).toBe(2);
    expect(s.waypoints[1]).toEqual(WP_C);
    // ActiveIndex was 2, removed lower → shifted to 1
    expect(s.activeWaypointIndex).toBe(1);
  });

  it('removeWaypoint of active sets active to clamped lower index', () => {
    const a = useAnimationStore.getState();
    a.addWaypoint(WP_A);
    a.addWaypoint(WP_B);
    a.setActiveWaypointIndex(1);
    a.removeWaypoint(1);
    const s = useAnimationStore.getState();
    expect(s.waypoints.length).toBe(1);
    expect(s.activeWaypointIndex).toBe(0);
  });

  it('updateWaypoint applies partial patch', () => {
    const a = useAnimationStore.getState();
    a.addWaypoint(WP_A);
    a.updateWaypoint(0, { fov: 75 });
    const s = useAnimationStore.getState();
    expect(s.waypoints[0]!.fov).toBe(75);
    expect(s.waypoints[0]!.position).toEqual(WP_A.position);
  });

  it('updateWaypoint ignores out-of-range index', () => {
    const a = useAnimationStore.getState();
    a.addWaypoint(WP_A);
    a.updateWaypoint(5, { fov: 99 });
    expect(useAnimationStore.getState().waypoints[0]!.fov).toBe(WP_A.fov);
  });

  it('reorderWaypoints moves entry from src to dst', () => {
    const a = useAnimationStore.getState();
    a.addWaypoint(WP_A);
    a.addWaypoint(WP_B);
    a.addWaypoint(WP_C);
    a.reorderWaypoints(0, 2);
    const s = useAnimationStore.getState();
    expect(s.waypoints[0]).toEqual(WP_B);
    expect(s.waypoints[1]).toEqual(WP_C);
    expect(s.waypoints[2]).toEqual(WP_A);
  });

  it('reorderWaypoints follows the active waypoint όταν επιλεγμένο είναι το moved', () => {
    const a = useAnimationStore.getState();
    a.addWaypoint(WP_A);
    a.addWaypoint(WP_B);
    a.addWaypoint(WP_C);
    a.setActiveWaypointIndex(0);
    a.reorderWaypoints(0, 2);
    expect(useAnimationStore.getState().activeWaypointIndex).toBe(2);
  });

  it('setActiveWaypointIndex clamps within waypoints range', () => {
    const a = useAnimationStore.getState();
    a.addWaypoint(WP_A);
    a.addWaypoint(WP_B);
    a.setActiveWaypointIndex(99);
    expect(useAnimationStore.getState().activeWaypointIndex).toBe(1);
    a.setActiveWaypointIndex(-3);
    expect(useAnimationStore.getState().activeWaypointIndex).toBe(0);
    a.setActiveWaypointIndex(null);
    expect(useAnimationStore.getState().activeWaypointIndex).toBeNull();
  });
});

describe('AnimationStore — loadFromDoc / reset', () => {
  beforeEach(resetStore);

  it('loadFromDoc replaces state και κρατά loadedDocId', () => {
    const doc = {
      id: 'anm_bim_abc123',
      projectId: 'proj1',
      companyId: 'co1',
      name: 'Test Animation',
      waypoints: [WP_A, WP_B],
      durationSec: 12,
      fps: 60,
      axis: 'x',
      direction: 'cw',
      splitTracks: true,
      codec: 'h264',
      renderConfig: { width: 1920, height: 1080, qualityPreset: 'standard' },
      createdBy: 'user1',
      updatedBy: 'user1',
      createdAt: {} as never,
      updatedAt: {} as never,
    } as unknown as BimAnimationDoc;

    useAnimationStore.getState().loadFromDoc(doc);
    const s = useAnimationStore.getState();
    expect(s.waypoints.length).toBe(2);
    expect(s.durationSec).toBe(12);
    expect(s.fps).toBe(60);
    expect(s.axis).toBe('x');
    expect(s.direction).toBe('cw');
    expect(s.splitTracks).toBe(true);
    expect(s.activeWaypointIndex).toBe(0);
    expect(s.loadedDocId).toBe('anm_bim_abc123');
  });

  it('reset restores initial defaults και καθαρίζει loadedDocId', () => {
    const a = useAnimationStore.getState();
    a.addWaypoint(WP_A);
    a.setDurationSec(20);
    a.reset();
    const s = useAnimationStore.getState();
    expect(s.waypoints).toEqual([]);
    expect(s.durationSec).toBe(8);
    expect(s.loadedDocId).toBeNull();
    expect(s.activeWaypointIndex).toBeNull();
  });
});
