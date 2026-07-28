/**
 * ADR-650 M2 μέρος Β — breakline z-resolution ground truth.
 *
 * Η κρίσιμη διάκριση του Civil 3D: **standard** breakline (η γραμμή κουβαλά `elevation`)
 * vs **proximity** breakline (2D γραμμή → z από το πλησιέστερο μετρημένο σημείο). Αν οι δύο
 * δρόμοι μπερδευτούν, η επιφάνεια βγαίνει «σωστή στην όψη» αλλά λάθος στα υψόμετρα — ακριβώς
 * το είδος σφάλματος που φεύγει σε παραγωγή. Γι' αυτό ελέγχεται με νούμερα, όχι με shape.
 */

import { buildBreaklineFromEntity, isBreaklineCandidate } from '../topo-breakline-pick';
import { makeWorldToDisplayProjector } from '../../geo-referencing/geo-transform';
import type { TopoPoint } from '../topo-types';
import type { Entity, LineEntity, LWPolylineEntity, PolylineEntity } from '../../../types/entities';

/**
 * Μη-γεωαναφερμένο έργο. **Ρητό, όχι παραλειπόμενο**: ο projector είναι υποχρεωτική παράμετρος
 * ακριβώς για να μη γράφει κανείς κλήση που «δεν ξέρει» σε ποιο πλαίσιο δουλεύει (ADR-718 §Α).
 * Ένα test που τον παρέλειπε θα ήταν πράσινο για λάθος λόγο.
 */
const NO_GEO = null;

const line = (v: Partial<LineEntity> = {}): LineEntity => ({
  id: 'l1', type: 'line', layerId: '0',
  start: { x: 0, y: 0 }, end: { x: 100, y: 0 },
  ...v,
});

const lwpolyline = (v: Partial<LWPolylineEntity> = {}): LWPolylineEntity => ({
  id: 'lw1', type: 'lwpolyline', layerId: '0',
  vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
  ...v,
});

const polyline = (v: Partial<PolylineEntity> = {}): PolylineEntity => ({
  id: 'p1', type: 'polyline', layerId: '0',
  vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
  ...v,
});

/** Δύο σημεία με ΞΕΚΑΘΑΡΑ διαφορετικά z, ώστε η «πλησιέστερη» επιλογή να είναι ελέγξιμη. */
const POINTS: readonly TopoPoint[] = [
  { x: 0, y: 0, z: 10 },
  { x: 100, y: 0, z: 90 },
];

describe('isBreaklineCandidate', () => {
  it('accepts the linear entities and nothing else', () => {
    expect(isBreaklineCandidate(line())).toBe(true);
    expect(isBreaklineCandidate(polyline())).toBe(true);
    expect(isBreaklineCandidate(lwpolyline())).toBe(true);
    const text = { id: 't1', type: 'text', layerId: '0', position: { x: 0, y: 0 }, content: 'x', height: 2 } as unknown as Entity;
    expect(isBreaklineCandidate(text)).toBe(false);
  });
});

describe('buildBreaklineFromEntity — standard (elevation) breakline', () => {
  it('lwpolyline.elevation puts EVERY vertex at that same z', () => {
    const built = buildBreaklineFromEntity(lwpolyline({ elevation: 42.5, closed: true }), POINTS, NO_GEO);
    expect(built).not.toBeNull();
    expect(built!.source).toBe('elevation');
    expect(built!.closed).toBe(true);
    expect(built!.vertices.map((v) => v.z)).toEqual([42.5, 42.5, 42.5]);
    // Το elevation ΝΙΚΑΕΙ τα σημεία — δεν αναμειγνύεται με proximity z (10 / 90).
    expect(built!.vertices[0]).toEqual({ x: 0, y: 0, z: 42.5 });
  });

  it('elevation = 0 is a real elevation, not "missing" (falsy trap)', () => {
    const built = buildBreaklineFromEntity(lwpolyline({ elevation: 0 }), POINTS, NO_GEO);
    expect(built!.source).toBe('elevation');
    expect(built!.vertices.every((v) => v.z === 0)).toBe(true);
  });
});

describe('buildBreaklineFromEntity — proximity breakline', () => {
  it('a 2D line takes each vertex z from the NEAREST survey point', () => {
    const built = buildBreaklineFromEntity(line(), POINTS, NO_GEO);
    expect(built).not.toBeNull();
    expect(built!.source).toBe('proximity');
    expect(built!.vertices).toEqual([
      { x: 0, y: 0, z: 10 },    // κοντύτερα στο (0,0,10)
      { x: 100, y: 0, z: 90 },  // κοντύτερα στο (100,0,90)
    ]);
  });

  it('an lwpolyline WITHOUT elevation falls back to proximity (not silently z=0)', () => {
    const built = buildBreaklineFromEntity(lwpolyline(), POINTS, NO_GEO);
    expect(built!.source).toBe('proximity');
    expect(built!.vertices[0].z).toBe(10);
    expect(built!.vertices[2].z).toBe(90); // (100,100) → πλησιέστερο το (100,0,90)
  });

  it('a plain 2D polyline is a proximity breakline too', () => {
    const built = buildBreaklineFromEntity(polyline(), POINTS, NO_GEO);
    expect(built!.source).toBe('proximity');
    expect(built!.vertices.map((v) => v.z)).toEqual([10, 90]);
  });
});

describe('buildBreaklineFromEntity — refusals (ΠΟΤΕ σιωπηλά)', () => {
  it('returns null for a 2D line when no survey points are loaded', () => {
    expect(buildBreaklineFromEntity(line(), [], NO_GEO)).toBeNull();
  });

  it('BUT an elevation-carrying lwpolyline works with zero points (it needs none)', () => {
    const built = buildBreaklineFromEntity(lwpolyline({ elevation: 7 }), [], NO_GEO);
    expect(built!.source).toBe('elevation');
    expect(built!.vertices.every((v) => v.z === 7)).toBe(true);
  });

  it('returns null for fewer than 2 vertices', () => {
    expect(buildBreaklineFromEntity(polyline({ vertices: [{ x: 0, y: 0 }] }), POINTS, NO_GEO)).toBeNull();
    expect(buildBreaklineFromEntity(lwpolyline({ vertices: [], elevation: 5 }), POINTS, NO_GEO)).toBeNull();
  });

  it('returns null for a non-linear entity', () => {
    const circle = { id: 'c1', type: 'circle', layerId: '0', center: { x: 0, y: 0 }, radius: 5 } as unknown as Entity;
    expect(buildBreaklineFromEntity(circle, POINTS, NO_GEO)).toBeNull();
  });
});

/**
 * ADR-718 §Α — ΤΑ ΔΥΟ ΠΛΑΙΣΙΑ.
 *
 * Η οντότητα ζει σε DISPLAY· ο `TopoPoint` δηλώνεται WORLD. Πριν τη διόρθωση, το
 * `nearestElevation` συνέκρινε **DISPLAY κορυφή με WORLD σημεία**: σε γεωαναφερμένο έργο η
 * απόσταση κυριαρχείται από τη μετάθεση (~4·10⁸ mm), οπότε **κάθε** κορυφή κληρονομούσε το z
 * του ίδιου αυθαίρετου σημείου. Η ασυνέχεια φαινόταν σωστή, επιβαλλόταν στην τριγωνοποίηση και
 * παραμόρφωνε το ανάγλυφο — **χωρίς κανένα ορατό σύμπτωμα**.
 *
 * Το `describe` έχει **αρνητικό μάρτυρα** (τελευταίο test): ο ίδιος builder με `null` projector
 * πάνω σε WORLD σημεία αναπαράγει τη βλάβη. Αν κάποιος αφαιρέσει το `unproject`, το πρώτο test
 * σκάει — δεν μένει σιωπηλά πράσινο.
 */
describe('buildBreaklineFromEntity — τα δύο πλαίσια (ADR-718 §Α)', () => {
  /** Το πραγματικό origin της υπόθεσης (ADR-650) — ίδια σταθερά με το `topo-display-frame.test`. */
  const ORIGIN_WORLD = { x: 407_565_290, y: 4_502_055_670 };
  const PROJECTOR = makeWorldToDisplayProjector({ originWorld: ORIGIN_WORLD, rotationDeg: 0 });

  /** Τα ΙΔΙΑ δύο z της υπόθεσης, αλλά στο πλαίσιο που τα σημεία όντως ζουν: WORLD. */
  const WORLD_POINTS: readonly TopoPoint[] = [
    { x: ORIGIN_WORLD.x, y: ORIGIN_WORLD.y, z: 10 },
    { x: ORIGIN_WORLD.x + 100, y: ORIGIN_WORLD.y, z: 90 },
  ];

  it('οι κορυφές γεννιούνται σε WORLD, όχι σε DISPLAY', () => {
    const built = buildBreaklineFromEntity(line(), WORLD_POINTS, PROJECTOR);
    expect(built!.vertices[0].x).toBeCloseTo(ORIGIN_WORLD.x, 6);
    expect(built!.vertices[1].x).toBeCloseTo(ORIGIN_WORLD.x + 100, 6);
  });

  it('κάθε κορυφή βρίσκει το ΔΙΚΟ της πλησιέστερο σημείο (δύο διακριτά z)', () => {
    const built = buildBreaklineFromEntity(line(), WORLD_POINTS, PROJECTOR);
    expect(built!.source).toBe('proximity');
    expect(built!.vertices.map((v) => v.z)).toEqual([10, 90]);
  });

  it('το elevation περνά ΑΥΤΟΥΣΙΟ — ο rigid μετασχηματισμός δεν αγγίζει Z (M10b)', () => {
    const built = buildBreaklineFromEntity(
      lwpolyline({ elevation: 42.5 }), WORLD_POINTS, PROJECTOR,
    );
    expect(built!.source).toBe('elevation');
    expect(built!.vertices.every((v) => v.z === 42.5)).toBe(true);
    // …αλλά το Χ,Υ μετακινήθηκε: το Z αμετάβλητο ΔΕΝ σημαίνει «τίποτα δεν έγινε».
    expect(built!.vertices[0].x).toBeCloseTo(ORIGIN_WORLD.x, 6);
  });

  it('ΑΡΝΗΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: χωρίς unproject, όλες οι κορυφές παίρνουν το ΙΔΙΟ z', () => {
    const buggy = buildBreaklineFromEntity(line(), WORLD_POINTS, NO_GEO);
    // Η υπογραφή της βλάβης είναι η ΚΑΤΑΡΡΕΥΣΗ των z σε μία τιμή — όχι μια συγκεκριμένη τιμή.
    expect(new Set(buggy!.vertices.map((v) => v.z)).size).toBe(1);
    // Ενώ η διορθωμένη διαδρομή διακρίνει και τα δύο:
    const fixed = buildBreaklineFromEntity(line(), WORLD_POINTS, PROJECTOR);
    expect(new Set(fixed!.vertices.map((v) => v.z)).size).toBe(2);
  });
});
