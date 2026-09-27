/**
 * ADR-884 Φ1 — άγκυρες του καθαρού πυρήνα του θεατή (πλαίσιο · γράφος · θέαση · μετάβαση · κατάσταση).
 * Κάθε `describe` ονομάζει την **απόφαση** που φυλάει· οι αριθμοί είναι από το ADR-884 §4.8 (έρευνα 2026-09-27).
 */

import { degToRad, radToDeg } from '@/lib/geometry/angle';
import type { TourManifestStop } from '@/lib/spatial-tour/tour-manifest-stop';
import type { TourNode } from '@/types/spatial-tour';

import { bearingBetween, horizontalFov, viewBearing, yawForBearing } from '../tour-viewer-bearing';
import { buildViewerGraph, firstNodeOfLevel, initialNode, neighboursOf } from '../tour-viewer-graph';
import { initialViewerState, tourViewerReducer } from '../tour-viewer-state';
import { crossfadeOpacityAt, planTransition, rotationYawAt } from '../tour-viewer-transition';
import {
  FOV_DEFAULT, FOV_MAX, FOV_MIN, PITCH_LIMIT, clampView, initialView, viewAfterDrag, viewAfterKey, viewAfterPinch,
  viewAfterWheel,
} from '../tour-viewer-view';

const deg = (rad: number) => Math.round(radToDeg(rad) * 1000) / 1000;
const F0 = { kind: 'floor', floorId: 'flr_0' } as const;
const F1 = { kind: 'floor', floorId: 'flr_1' } as const;
const node = (id: string, levelKey: TourNode['levelKey'], position: TourNode['position'], to: string[] = []): TourNode => ({
  id, levelKey, position, links: to.map((toNodeId) => ({ toNodeId, via: 'manual' as const, bearingRad: null })),
});
const stop = (nodeId: string, headingDeg = 0): TourManifestStop => ({
  captureId: `tcap_${nodeId}`, nodeId, capturedAt: '2026-09-01T00:00:00.000Z', headingRad: degToRad(headingDeg), tilesetHash: 'h', faceSize: 1024,
});

describe('πλαίσιο — διόπτευση δεξιόστροφα από τον βορρά (x=ανατολή · y=βορράς)', () => {
  const o = { x: 0, y: 0, z: 0 };
  it.each([
    [{ x: 0, y: 1, z: 0 }, 0],
    [{ x: 1, y: 0, z: 0 }, 90],
    [{ x: 0, y: -1, z: 0 }, 180],
    [{ x: -1, y: 0, z: 0 }, 270],
  ])('προς %o ⇒ %d°', (to, expected) => expect(deg(bearingBetween(o, to) ?? NaN)).toBe(expected));

  it('ίδιο σημείο ⇒ καμία κατεύθυνση (όχι 0° = «βορράς» κατά λάθος)', () => {
    expect(bearingBetween(o, { x: 0, y: 0, z: 3 })).toBeNull();
  });

  it('διόπτευση = heading + yaw, περιτυλιγμένη· yawForBearing είναι το αντίστροφο', () => {
    expect(deg(viewBearing(degToRad(350), degToRad(20)))).toBe(10);
    expect(deg(yawForBearing(degToRad(350), degToRad(10)))).toBe(20);
    expect(deg(yawForBearing(degToRad(10), degToRad(350)))).toBe(-20);
  });

  it('οριζόντιο πεδίο: 16:9 με 65° κατακόρυφα ⇒ ~98° (το ~90° του Street View)· άκυρος λόγος ⇒ το κατακόρυφο', () => {
    expect(Math.round(radToDeg(horizontalFov(FOV_DEFAULT, 16 / 9)))).toBe(97);
    expect(horizontalFov(FOV_DEFAULT, 0)).toBe(FOV_DEFAULT);
  });
});

describe('γράφος — μόνο κόμβοι με στάση, προς τις δύο κατευθύνσεις, όροφοι από κάτω', () => {
  const nodes = [
    node('a', F0, { x: 0, y: 0, z: 0 }, ['b', 'ghost']),
    node('b', F0, { x: 0, y: 5, z: 0 }),
    node('ghost', F0, { x: 9, y: 9, z: 0 }),
    node('u', F1, null, ['a']),
  ];
  const graph = buildViewerGraph({ nodes, stops: [stop('u'), stop('a'), stop('b'), stop('a')] }, [
    { key: F1, label: 'Όροφος 1', ordinal: 1 },
    { key: F0, label: 'Ισόγειο', ordinal: 0 },
  ]);

  it('κόμβος χωρίς στάση δεν γίνεται προορισμός· διπλή στάση του ίδιου κόμβου αγνοείται', () => {
    expect(graph.stops.has('ghost')).toBe(false);
    expect(graph.stops.size).toBe(3);
    expect([...graph.adjacency.values()].flat()).not.toContain('ghost');
    expect(neighboursOf(graph, 'a').map((n) => n.nodeId).sort()).toEqual(['b', 'u']);
  });

  it('σύνδεσμος Α→Β επιτρέπει Β→Α', () => {
    expect(neighboursOf(graph, 'b').map((n) => n.nodeId)).toEqual(['a']);
  });

  it('διόπτευση γείτονα από τις θέσεις· χωρίς θέση ⇒ null (ποτέ επινοημένη)', () => {
    const toB = neighboursOf(graph, 'a').find((n) => n.nodeId === 'b');
    expect(deg(toB?.bearing ?? NaN)).toBe(0);
    expect(neighboursOf(graph, 'a').find((n) => n.nodeId === 'u')?.bearing).toBeNull();
  });

  it('όροφοι ταξινομημένοι κατά σειρά· κάτοψη μόνο όταν όλοι οι κόμβοι έχουν θέση', () => {
    expect(graph.levels.map((l) => [l.label, l.hasPlan])).toEqual([['Ισόγειο', true], ['Όροφος 1', false]]);
    expect(initialNode(graph)).toBe('a');
    expect(firstNodeOfLevel(graph, 'floor:flr_1')).toBe('u');
  });

  it('αρίθμηση σημείων ανά όροφο, ντετερμινιστική από τη σειρά των στάσεων', () => {
    expect(['a', 'b', 'u'].map((id) => graph.stops.get(id)?.number)).toEqual([1, 2, 1]);
  });

  it('χωρίς κάτοψη: το βελάκι του ΙΔΙΟΥ κόμβου (Φ2β) — ποτέ το αντίστροφο του άλλου άκρου', () => {
    const L = { kind: 'local', ordinal: 0 } as const;
    const withBearing: TourNode[] = [
      { id: 'p', levelKey: L, position: null, links: [{ toNodeId: 'q', via: 'manual', bearingRad: degToRad(30) }] },
      { id: 'q', levelKey: L, position: null, links: [] },
    ];
    const g = buildViewerGraph({ nodes: withBearing, stops: [stop('p'), stop('q')] }, []);
    expect(deg(neighboursOf(g, 'p')[0].bearing ?? NaN)).toBe(30);
    // Από το q προς το p δεν ξέρουμε κατεύθυνση — το 30°+180° θα ήταν επινόηση χωρίς θέσεις.
    expect(neighboursOf(g, 'q')[0]).toEqual(expect.objectContaining({ nodeId: 'p', bearing: null }));
  });

  it('όροφος που δεν δηλώθηκε δεν κρύβεται — εμφανίζεται χωρίς ετικέτα', () => {
    const g = buildViewerGraph({ nodes, stops: [stop('a')] }, []);
    expect(g.levels).toEqual([expect.objectContaining({ id: 'floor:flr_0', label: null })]);
  });
});

describe('θέαση — όρια και «αρπάζω τον κόσμο»', () => {
  it('όρια: πεδίο 30°–90°, κλίση ±85°, yaw περιτυλιγμένο', () => {
    const v = clampView({ yaw: degToRad(270), pitch: degToRad(120), fov: degToRad(200) });
    expect([deg(v.yaw), deg(v.pitch), v.fov]).toEqual([-90, 85, FOV_MAX]);
    expect(clampView({ yaw: 0, pitch: 0, fov: 0 }).fov).toBe(FOV_MIN);
  });

  it('σύρσιμο δεξιά ⇒ κοιτάζω αριστερά· ταχύτητα ανάλογη του πεδίου', () => {
    const v = initialView();
    const wide = viewAfterDrag(v, 100, 0, 1000);
    const narrow = viewAfterDrag({ ...v, fov: FOV_MIN }, 100, 0, 1000);
    expect(wide.yaw).toBeLessThan(0);
    expect(Math.abs(narrow.yaw)).toBeLessThan(Math.abs(wide.yaw));
    expect(viewAfterDrag(v, 0, 1e6, 10).pitch).toBe(PITCH_LIMIT);
  });

  it('ροδέλα κάτω ⇒ ευρύτερο· τσίμπημα ανοίγει ⇒ στενότερο', () => {
    const v = initialView();
    expect(viewAfterWheel(v, 100).fov).toBeGreaterThan(v.fov);
    expect(viewAfterPinch(v, v.fov, 100, 200).fov).toBeLessThan(v.fov);
    expect(viewAfterPinch(v, v.fov, 0, 200)).toBe(v);
  });

  it('πλήκτρα: βέλη στρέφουν, +/- μεγεθύνουν, άλλο πλήκτρο ⇒ null (δεν καταναλώνεται)', () => {
    const v = initialView();
    expect(deg(viewAfterKey(v, 'ArrowRight')?.yaw ?? NaN)).toBe(15);
    expect(viewAfterKey(v, '+')?.fov).toBeLessThan(v.fov);
    expect(viewAfterKey(v, 'Tab')).toBeNull();
  });
});

describe('μετάβαση — στροφή προς τον σύνδεσμο, σβήσιμο, ίδια διόπτευση στην άφιξη', () => {
  const base = { yaw: 0, fromHeading: 0, toHeading: degToRad(90), linkBearing: degToRad(90), reducedMotion: false };

  it('στρέφεται προς τον σύνδεσμο με τη σύντομη φορά, μετά σβήνει', () => {
    const plan = planTransition({ ...base, yaw: degToRad(170), linkBearing: degToRad(-170) });
    expect(deg((plan.rotate?.toYaw ?? NaN) - (plan.rotate?.fromYaw ?? NaN))).toBe(20);
    expect(plan.fadeMs).toBeGreaterThan(0);
  });

  it('άφιξη: κοιτάζει προς τα πού περπάτησε (διόπτευση 90° ⇒ yaw 0 σε πανόραμα με heading 90°)', () => {
    expect(deg(planTransition(base).arrivalYaw)).toBe(0);
  });

  it('χωρίς διόπτευση: καμία στροφή, διατηρείται η διόπτευση που κοίταζε', () => {
    const plan = planTransition({ ...base, yaw: degToRad(30), linkBearing: null });
    expect(plan.rotate).toBeNull();
    expect(deg(plan.arrivalYaw)).toBe(-60);
  });

  it('♿ λιγότερη κίνηση ⇒ ούτε στροφή ούτε σβήσιμο, ίδια άφιξη', () => {
    const plan = planTransition({ ...base, reducedMotion: true });
    expect(plan).toEqual({ rotate: null, fadeMs: 0, arrivalYaw: planTransition(base).arrivalYaw });
  });

  it('καμπύλη: αρχή/τέλος ακριβή, εκτός χρόνου περιορισμένη', () => {
    const rotate = { fromYaw: 0, toYaw: 1, durationMs: 100 };
    expect([rotationYawAt(rotate, -5), rotationYawAt(rotate, 50), rotationYawAt(rotate, 500)]).toEqual([0, 0.5, 1]);
    expect([crossfadeOpacityAt(300, 150), crossfadeOpacityAt(0, 0)]).toEqual([0.5, 1]);
  });
});

describe('κατάσταση — καμία κούρσα, ιδεμπότητο', () => {
  const s0 = initialViewerState('a');

  it('πήγαινε εκεί που είσαι ⇒ ίδιο αντικείμενο', () => {
    expect(tourViewerReducer(s0, { kind: 'go', nodeId: 'a' })).toBe(s0);
  });

  it('αίτημα κατά τη μετάβαση ⇒ ουρά μίας θέσης, το τελευταίο κερδίζει', () => {
    let s = tourViewerReducer(s0, { kind: 'go', nodeId: 'b' });
    s = tourViewerReducer(s, { kind: 'go', nodeId: 'c' });
    s = tourViewerReducer(s, { kind: 'go', nodeId: 'd' });
    expect(s).toEqual({ nodeId: 'a', targetNodeId: 'b', queuedNodeId: 'd' });
    s = tourViewerReducer(s, { kind: 'arrived' });
    expect(s).toEqual({ nodeId: 'b', targetNodeId: 'd', queuedNodeId: null });
  });

  it('επιστροφή στον τρέχοντα προορισμό ακυρώνει την ουρά· «έφτασα» χωρίς μετάβαση ⇒ τίποτα', () => {
    let s = tourViewerReducer(s0, { kind: 'go', nodeId: 'b' });
    s = tourViewerReducer(s, { kind: 'go', nodeId: 'c' });
    expect(tourViewerReducer(s, { kind: 'go', nodeId: 'b' }).queuedNodeId).toBeNull();
    expect(tourViewerReducer(s0, { kind: 'arrived' })).toBe(s0);
  });

  it('εγκατάλειψη ⇒ μένει εκεί που ήταν, η ουρά προχωρά (αλλά όχι «πήγαινε εκεί που είσαι»)', () => {
    let s = tourViewerReducer(s0, { kind: 'go', nodeId: 'b' });
    s = tourViewerReducer(s, { kind: 'go', nodeId: 'c' });
    expect(tourViewerReducer(s, { kind: 'abandoned' })).toEqual({ nodeId: 'a', targetNodeId: 'c', queuedNodeId: null });
    s = tourViewerReducer(tourViewerReducer(s0, { kind: 'go', nodeId: 'b' }), { kind: 'go', nodeId: 'a' });
    expect(tourViewerReducer(s, { kind: 'abandoned' })).toEqual({ nodeId: 'a', targetNodeId: null, queuedNodeId: null });
    expect(tourViewerReducer(s0, { kind: 'abandoned' })).toBe(s0);
  });
});
