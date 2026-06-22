/**
 * ADR-398 §3.10 — scene snap-targets SSoT (το ΕΝΑ store που μοιράζονται κολώνα/τοίχος/δοκάρι).
 *
 * Επαληθεύει: (1) ο collector διαχωρίζει σωστά κολόνες/δοκάρια/τοίχους/πλάκες· (2) ο selector
 * δίνει τα σωστά flat member sets ανά tool (τοίχος=wall+beam+slab, δοκάρι=beam+slab)· (3) ο
 * store refresh/set/reset/get round-trip.
 */

import {
  collectSceneSnapTargets,
  selectGhostMembers,
  sceneSnapTargetsStore,
} from '../scene-snap-targets';
import type { Entity } from '../../../types/entities';

function beam(id: string): Entity {
  return {
    id, type: 'beam',
    geometry: {
      axisPolyline: { points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] },
      outline: { vertices: [{ x: 0, y: -150 }, { x: 1000, y: -150 }, { x: 1000, y: 150 }, { x: 0, y: 150 }] },
    },
  } as unknown as Entity;
}
function wall(id: string): Entity {
  return {
    id, type: 'wall',
    geometry: {
      axisPolyline: { points: [{ x: 0, y: 500 }, { x: 1000, y: 500 }] },
      outerEdge: { points: [{ x: 0, y: 600 }, { x: 1000, y: 600 }] },
      innerEdge: { points: [{ x: 0, y: 400 }, { x: 1000, y: 400 }] },
    },
  } as unknown as Entity;
}
function slab(id: string): Entity {
  return {
    id, type: 'slab',
    geometry: { polygon: { vertices: [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 2000 }, { x: 0, y: 2000 }] } },
  } as unknown as Entity;
}
function column(id: string): Entity {
  return {
    id, type: 'column',
    geometry: { footprint: { vertices: [{ x: -100, y: -100 }, { x: 100, y: -100 }, { x: 100, y: 100 }, { x: -100, y: 100 }] } },
  } as unknown as Entity;
}

describe('collectSceneSnapTargets — διαχωρισμός ανά είδος', () => {
  it('μαζεύει κολόνες/δοκάρια/τοίχους/πλάκες σε ξεχωριστά arrays', () => {
    const t = collectSceneSnapTargets([beam('b1'), wall('w1'), slab('s1'), column('c1')]);
    expect(t.footprints).toHaveLength(1);
    expect(t.beamTargets.map((x) => x.id)).toEqual(['b1']);
    expect(t.wallTargets.map((x) => x.id)).toEqual(['w1']);
    expect(t.slabTargets).toHaveLength(4); // 4 ακμές πλάκας
  });

  it('κενή σκηνή → όλα κενά', () => {
    const t = collectSceneSnapTargets([]);
    expect(t.footprints).toHaveLength(0);
    expect(t.beamTargets).toHaveLength(0);
    expect(t.wallTargets).toHaveLength(0);
    expect(t.slabTargets).toHaveLength(0);
  });

  it('§3.12 — ΚΥΚΛΟΣ → lineTargets (χορδές) που φέρουν arc meta {center,radius,0,360}', () => {
    const circle = { id: 'circ1', type: 'circle', center: { x: 10, y: 20 }, radius: 1000 } as unknown as Entity;
    const t = collectSceneSnapTargets([circle]);
    expect(t.lineTargets.length).toBeGreaterThan(2); // tessellated chords
    expect(t.lineTargets.every((x) => x.arc !== undefined)).toBe(true);
    expect(t.lineTargets[0].arc).toEqual({ center: { x: 10, y: 20 }, radius: 1000, startAngle: 0, endAngle: 360 });
  });

  it('§3.12 — ΤΟΞΟ → lineTargets που φέρουν arc meta με τα ΠΡΑΓΜΑΤΙΚΑ άκρα', () => {
    const arc = { id: 'arc1', type: 'arc', center: { x: 0, y: 0 }, radius: 500, startAngle: 30, endAngle: 200 } as unknown as Entity;
    const t = collectSceneSnapTargets([arc]);
    expect(t.lineTargets.length).toBeGreaterThan(2);
    expect(t.lineTargets[0].arc).toEqual({ center: { x: 0, y: 0 }, radius: 500, startAngle: 30, endAngle: 200 });
  });
});

describe('selectGhostMembers — flat member set ανά tool', () => {
  const t = collectSceneSnapTargets([beam('b1'), wall('w1'), slab('s1')]);

  it('τοίχος → wall+beam+slab (όλα τα μέλη)', () => {
    const members = selectGhostMembers(t, ['wall', 'beam', 'slab']);
    expect(members.map((m) => m.id).sort()).toEqual(['b1', 's1#edge0', 's1#edge1', 's1#edge2', 's1#edge3', 'w1'].sort());
  });

  it('δοκάρι → beam+slab (ΟΧΙ τοίχοι)', () => {
    const members = selectGhostMembers(t, ['beam', 'slab']);
    expect(members.some((m) => m.id === 'w1')).toBe(false);
    expect(members.some((m) => m.id === 'b1')).toBe(true);
    expect(members.filter((m) => m.id.startsWith('s1#edge'))).toHaveLength(4);
  });

  it('σταθερή σειρά wall→beam→slab (ντετερμινισμός)', () => {
    const members = selectGhostMembers(t, ['wall', 'beam', 'slab']);
    expect(members[0].id).toBe('w1');
    expect(members[1].id).toBe('b1');
  });
});

describe('sceneSnapTargetsStore — refresh/set/reset/get', () => {
  afterEach(() => sceneSnapTargetsStore.reset());

  it('refresh(entities) → get() επιστρέφει collected στόχους', () => {
    sceneSnapTargetsStore.refresh([beam('b1'), column('c1')]);
    const t = sceneSnapTargetsStore.get();
    expect(t.beamTargets).toHaveLength(1);
    expect(t.footprints).toHaveLength(1);
  });

  it('reset() → όλα κενά', () => {
    sceneSnapTargetsStore.refresh([beam('b1')]);
    sceneSnapTargetsStore.reset();
    expect(sceneSnapTargetsStore.get().beamTargets).toHaveLength(0);
  });

  it('set(targets) → direct write (escape hatch)', () => {
    sceneSnapTargetsStore.set({ footprints: [[{ x: 0, y: 0 }]], beamTargets: [], wallTargets: [], slabTargets: [] });
    expect(sceneSnapTargetsStore.get().footprints).toHaveLength(1);
  });
});
