/**
 * ADR-567 §join-is-not-occupation (ADR-911 Φ3α-2) — «η ένωση τοίχων δεν είναι κατάληψη».
 *
 * Πραγματικοί `WallEntity` (ίδιο `buildWallEntity` με το εργαλείο). Κάθε «περνά» συνοδεύεται από
 * την απόδειξη ότι ο ΩΜΟΣ λόγος εμβαδού θα το έκοβε — αλλιώς η άγκυρα θα ήταν πράσινη και κενή.
 *
 * Διάταξη: διαμπερής τοίχος στον άξονα y=0, πάχος 250 (παρειές y=±125), από x=-2000 έως 2000.
 */

import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import type { Entity } from '../../../types/entities';
import type { WallEntity, WallParams } from '../../types/wall-types';
import {
  DEFAULT_OVERLAP_RATIO_THRESHOLD,
  findStructuralOverlap,
  findStructuralOverlapForEntity,
  partitionByStructuralOverlap,
  structuralFootprintOf,
} from '../structural-placement-overlap';
import { joinedWallPairFootprints } from '../wall-join-overlap';

function wall(id: string, ax: number, ay: number, bx: number, by: number, thickness: number): WallEntity {
  const params: WallParams = {
    ...buildDefaultWallParams({ x: ax, y: ay }, { x: bx, y: by }, {}, 'mm'),
    thickness,
    dna: undefined,
  };
  const built = buildWallEntity(params, 'layer-0', 'straight', 'mm');
  if (!built.ok) throw new Error(`wall build failed: ${built.hardErrors.join(',')}`);
  return { ...built.entity, id };
}

const asEntity = (w: WallEntity): Entity => w as unknown as Entity;

/** Η κρίση του SSoT, όπως τη ζητούν οι φρουροί τοποθέτησης. */
const judged = (cand: WallEntity, existing: WallEntity) => findStructuralOverlapForEntity(asEntity(cand), [asEntity(existing)]);

/** Ο ΩΜΟΣ λόγος εμβαδού (χωρίς γνώση ένωσης) — η παλιά κρίση, για να φαίνεται τι άλλαξε. */
const rawJudged = (cand: WallEntity, existing: WallEntity) =>
  findStructuralOverlap(structuralFootprintOf(asEntity(cand))!, [asEntity(existing)], { candidateType: 'wall' });

const THROUGH = wall('through', -2000, 0, 2000, 0, 250);

describe('ένωση ≠ κατάληψη — ό,τι ενώνεται περνά, όσο κοντό κι αν είναι', () => {
  it('κοντός τοίχος με το άκρο στον άξονα του γείτονα περνά (ο ωμός λόγος τον έκοβε)', () => {
    // Καθαρό μήκος 100 + 125 μέσα στον γείτονα: ωμός λόγος 125/225 = 55 %.
    const stub = wall('stub', 0, 0, 0, 225, 100);
    expect(rawJudged(stub, THROUGH)?.ratio).toBeCloseTo(125 / 225, 6);
    expect(judged(stub, THROUGH)).toBeNull();
  });

  it('συμμετρικά: μακρύς τοίχος με το άκρο στον άξονα ΚΟΝΤΟΥ γείτονα περνά', () => {
    // Ο κοντός (100×150) υπάρχει ήδη· ο μακρύς τελειώνει στον άξονά του.
    const shortExisting = wall('short', 0, -75, 0, 75, 100);
    const long = wall('long', 0, 0, 850, 0, 100);
    expect(rawJudged(long, shortExisting)?.ratio).toBeGreaterThanOrEqual(DEFAULT_OVERLAP_RATIO_THRESHOLD);
    expect(judged(long, shortExisting)).toBeNull();
    // Και με αντίστροφη σειρά χτισίματος: το άκρο που κόβεται ανήκει τότε στον ΥΠΑΡΧΟΝΤΑ τοίχο.
    expect(judged(shortExisting, long)).toBeNull();
  });

  it('γωνία Γ δύο κοντών τοίχων με κοινό άκρο αξόνων περνά', () => {
    const a = wall('a', 0, 0, 150, 0, 100);
    const b = wall('b', 0, 0, 0, 150, 100);
    expect(judged(a, b)).toBeNull();
    expect(joinedWallPairFootprints(a, b)?.kind).toBe('joined');
  });

  it('ένωση υπό γωνία 45° περνά', () => {
    const stub = wall('stub45', 0, 0, 200, 200, 100);
    expect(judged(stub, THROUGH)).toBeNull();
  });

  it('η κρίση δεν κάθεται σε τιμή των δεδομένων: θόρυβος ±0,001 mm γύρω από τον άξονα δεν την αλλάζει', () => {
    for (const dy of [-0.001, 0, 0.001]) {
      expect(judged(wall(`stub${dy}`, 0, dy, 0, 225, 100), THROUGH)).toBeNull();
    }
  });

  it('άκρο πάνω στην παρειά (χωρίς επέκταση) περνά όπως πάντα', () => {
    expect(judged(wall('butt', 0, 125, 0, 225, 100), THROUGH)).toBeNull();
  });

  it('το κόψιμο φέρνει το άκρο ΑΚΡΙΒΩΣ στην παρειά του γείτονα — ούτε λιγότερο ούτε περισσότερο', () => {
    const pair = joinedWallPairFootprints(wall('stub', 0, 0, 0, 225, 100), THROUGH);
    if (pair?.kind !== 'joined') throw new Error('expected a joined pair');
    expect(Math.min(...pair.a.map((p) => p.y))).toBeCloseTo(125, 6);
    expect(Math.max(...pair.a.map((p) => p.y))).toBeCloseTo(225, 6);
    // Ο διαμπερής δεν έχει άκρο μέσα στον κοντό ⇒ μένει ολόκληρος.
    expect(Math.min(...pair.b.map((p) => p.x))).toBeCloseTo(-2000, 6);
    expect(Math.max(...pair.b.map((p) => p.x))).toBeCloseTo(2000, 6);
  });

  it('άκρο στην ΠΡΟΕΚΤΑΣΗ του γείτονα, έξω από το μήκος του, δεν κόβεται', () => {
    // Το άκρο (2300, 50) είναι μέσα στη λωρίδα y=±125 αλλά 300 mm πέρα από το τέλος του γείτονα.
    const pair = joinedWallPairFootprints(wall('beyond', 2300, 50, 2300, 1000, 100), THROUGH);
    if (pair?.kind !== 'joined') throw new Error('expected a joined pair');
    expect(Math.min(...pair.a.map((p) => p.y))).toBeCloseTo(50, 6);
  });
});

describe('ένωση ≠ κατάληψη — η γνήσια κατάληψη εξακολουθεί να κόβεται', () => {
  it('ομοαξονικό διπλότυπο πάνω σε ΚΟΝΤΟ τοίχο κόβεται', () => {
    const short = wall('short', 0, 0, 150, 0, 100);
    expect(judged(wall('dup', 0, 0, 150, 0, 100), short)?.blockedById).toBe('short');
  });

  it('τετράγωνος τοίχος ξανά με ΚΑΘΕΤΟ άξονα κόβεται — και με θόρυβο', () => {
    // Το ίδιο τετράγωνο 100×100 [0..100]²· ο ένας άξονας κατά x, ο άλλος κατά y.
    const alongX = wall('sq-x', 0, 50, 100, 50, 100);
    for (const d of [0, 0.001, -0.001]) {
      expect(judged(wall(`sq-y${d}`, 50 + d, 0, 50 + d, 100, 100), alongX)?.blockedById).toBe('sq-x');
    }
  });

  it('κοντός τοίχος θαμμένος εγκάρσια μέσα σε χοντρό γείτονα κόβεται', () => {
    expect(judged(wall('buried', 0, -100, 0, 100, 100), THROUGH)?.blockedById).toBe('through');
    // Τόσο κοντός που το κόψιμο των δύο άκρων (75 + 75) τον καταπίνει ολόκληρο (μήκος 100).
    const tiny = wall('tiny', 0, -50, 0, 50, 100);
    expect(joinedWallPairFootprints(tiny, THROUGH)).toEqual({ kind: 'swallowed' });
    expect(judged(tiny, THROUGH)?.ratio).toBe(1);
  });

  it('κοντός τοίχος που διαπερνά τον γείτονα ως την ΑΠΕΝΑΝΤΙ παρειά δεν παίρνει έκπτωση ένωσης', () => {
    // Το άκρο κάθεται στην απέναντι παρειά (y=-125): δεν είναι ένωση, είναι διείσδυση 250 mm.
    const through = wall('pierce', 0, -125, 0, 225, 100);
    expect(judged(through, THROUGH)?.blockedById).toBe('through');
  });

  it('παράλληλοι τοίχοι κρίνονται στα πλήρη αποτυπώματα (καμία έκπτωση)', () => {
    const base = wall('base', 0, 0, 3000, 0, 200);
    const shifted = wall('shifted', 500, 0, 3500, 0, 200);
    expect(joinedWallPairFootprints(shifted, base)).toBeNull();
    expect(judged(shifted, base)?.blockedById).toBe('base');
  });

  it('μη ευθύγραμμος τοίχος δεν θεωρείται ένωση', () => {
    const curved = { ...wall('curved', 0, 0, 0, 225, 100), kind: 'curved' } as WallEntity;
    expect(joinedWallPairFootprints(curved, THROUGH)).toBeNull();
  });
});

describe('ένωση ≠ κατάληψη — το φίλτρο παρτίδας (ο adapter της εγγραφής)', () => {
  it('παρτίδα ενωμένων κοντών τοίχων περνά ολόκληρη· το διπλότυπο μέσα της κόβεται', () => {
    const stubA = wall('stubA', -500, 0, -500, 225, 100);
    const stubB = wall('stubB', 500, 0, 500, 225, 100);
    const dupOfA = wall('dupOfA', -500, 0, -500, 225, 100);
    const result = partitionByStructuralOverlap([stubA, stubB, dupOfA], [asEntity(THROUGH)]);
    expect(result.accepted.map((w) => w.id)).toEqual(['stubA', 'stubB']);
    expect(result).toMatchObject({ blocked: 1, firstBlockedById: 'stubA', firstBlockedType: 'wall' });
  });
});
