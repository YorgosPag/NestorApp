/**
 * ADR-652 M4 — thumbnails + επεξεργασία metadata (pure layer).
 *
 * Καλύπτει:
 *  1. τον ουδέτερο flattener `entityToPolylines` (Entity → σημεία, μέσω των ΥΠΑΡΧΟΝΤΩΝ
 *     tessellation SSoTs — καμία νέα curve math),
 *  2. τον builder `buildBlockThumbnail` (ντετερμινιστικό, εντός viewBox, Y αναστραμμένο,
 *     φραγμένο σε σημεία, `null` όταν δεν υπάρχει γραμμική γεωμετρία),
 *  3. την ενσωμάτωση στο palette (session = ζωντανό preview, cloud = preview από το doc),
 *  4. τους κανόνες του M4: `canEditBlockEntry` + `isBlockNameTaken` (το όνομα ΕΙΝΑΙ κλειδί
 *     ταυτότητας — δύο κάρτες με ίδιο όνομα ⇒ τοποθέτηση λάθος γεωμετρίας).
 *
 * Ground truth της γεωμετρίας: τα ΠΡΑΓΜΑΤΙΚΑ system blocks (ADR-415 preset → members).
 */

import type { Entity } from '../../../types/entities';
import {
  entityToPolylines,
  entitiesToPolylines,
} from '../../../rendering/entities/shared/entity-polylines';
import {
  BLOCK_THUMBNAIL_VIEWBOX,
  MAX_THUMBNAIL_POINTS,
  buildBlockThumbnail,
} from '../block-thumbnail';
import {
  canEditBlockEntry,
  isBlockNameTaken,
  mergeBlockPaletteEntries,
} from '../block-palette-entries';
import { buildSystemBlockMembers } from '../system-block-geometry';
import { SYSTEM_BLOCKS_SEED } from '../../data/system-blocks-seed';
import type {
  BlockLibraryItem,
  InSessionBlockDef,
} from '../block-library-types';

const BOUNDS = { minX: 0, minY: 0, maxX: 100, maxY: 50 };

function line(id: string, x1: number, y1: number, x2: number, y2: number): Entity {
  return {
    id,
    type: 'line',
    layerId: '0',
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    visible: true,
  } as unknown as Entity;
}

function cloudItem(overrides: Partial<BlockLibraryItem> = {}): BlockLibraryItem {
  return {
    id: 'blklib_1',
    scope: 'user',
    companyId: 'cmp_a',
    projectId: null,
    createdBy: 'user_1',
    builtin: false,
    name: 'CHAIR',
    category: 'furniture',
    boundsMm: BOUNDS,
    geometryUrl: 'https://storage.test/g.json',
    provenance: { sourceType: 'user-import', importedAt: 1, importedBy: 'user_1' },
    license: { type: 'unknown', redistributable: false },
    ...overrides,
  };
}

function sessionDef(name: string, members: readonly Entity[]): InSessionBlockDef {
  return { name, localMembers: members, boundsMm: BOUNDS };
}

// ---------------------------------------------------------------------------
// 1. entityToPolylines — ο ουδέτερος flattener
// ---------------------------------------------------------------------------

describe('entityToPolylines', () => {
  it('γραμμή → ένα ανοιχτό τμήμα δύο σημείων', () => {
    const [poly] = entityToPolylines(line('l', 0, 0, 10, 5));
    expect(poly.closed).toBe(false);
    expect(poly.points).toEqual([{ x: 0, y: 0 }, { x: 10, y: 5 }]);
  });

  it('κλειστή πολυγραμμή → κρατά το `closed` (δεν διπλασιάζει την πρώτη κορυφή)', () => {
    const entity = {
      id: 'p',
      type: 'polyline',
      layerId: '0',
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
      closed: true,
      visible: true,
    } as unknown as Entity;

    const [poly] = entityToPolylines(entity);
    expect(poly.closed).toBe(true);
    expect(poly.points).toHaveLength(3);
  });

  it('κύκλος → ΚΛΕΙΣΤΗ πολυγραμμή πάνω στον κύκλο (delegate στο arc SSoT)', () => {
    const entity = {
      id: 'c',
      type: 'circle',
      layerId: '0',
      center: { x: 0, y: 0 },
      radius: 10,
      visible: true,
    } as unknown as Entity;

    const [poly] = entityToPolylines(entity);
    expect(poly.closed).toBe(true);
    expect(poly.points.length).toBeGreaterThanOrEqual(8);
    for (const p of poly.points) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(10, 6);
    }
  });

  it('πολυγραμμή με bulge → τοξωτά σημεία (περνά από το bulge SSoT, όχι ευθεία χορδή)', () => {
    const entity = {
      id: 'b',
      type: 'lwpolyline',
      layerId: '0',
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      bulges: [1], // ημικύκλιο
      closed: false,
      visible: true,
    } as unknown as Entity;

    const [poly] = entityToPolylines(entity);
    // Ευθεία χορδή θα έδινε 2 σημεία· το τόξο δίνει σαφώς περισσότερα, εκτός του άξονα y=0.
    expect(poly.points.length).toBeGreaterThan(3);
    expect(poly.points.some((p) => Math.abs(p.y) > 1)).toBe(true);
  });

  it('κείμενο / διάσταση → κενό (δεν έχουν γραμμική αναπαράσταση εδώ)', () => {
    const text = {
      id: 't',
      type: 'text',
      layerId: '0',
      position: { x: 0, y: 0 },
      text: 'A',
      height: 2,
      visible: true,
    } as unknown as Entity;

    expect(entityToPolylines(text)).toEqual([]);
  });

  it('φωλιασμένο block → τα members του στον ΙΔΙΟ χώρο (μέσω του placement SSoT)', () => {
    const nested = {
      id: 'blk',
      type: 'block',
      layerId: '0',
      name: 'INNER',
      position: { x: 100, y: 0 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      entities: [line('m', 0, 0, 10, 0)],
      visible: true,
    } as unknown as Entity;

    const [poly] = entityToPolylines(nested);
    expect(poly.points[0].x).toBeCloseTo(100, 6);
    expect(poly.points[1].x).toBeCloseTo(110, 6);
  });

  it('entitiesToPolylines: ενώνει ΟΛΕΣ τις οντότητες μιας λίστας', () => {
    const polys = entitiesToPolylines([line('a', 0, 0, 1, 0), line('b', 0, 1, 1, 1)]);
    expect(polys).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 2. buildBlockThumbnail
// ---------------------------------------------------------------------------

describe('buildBlockThumbnail', () => {
  /** Όλα τα ζεύγη συντεταγμένων ενός path `d`. */
  function coordsOf(d: string): Array<{ x: number; y: number }> {
    return [...d.matchAll(/[ML](-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => ({
      x: Number(m[1]),
      y: Number(m[2]),
    }));
  }

  it('παράγει path ΕΝΤΟΣ του viewBox (aspect-fit + περιθώριο)', () => {
    const { thumbnail } = buildBlockThumbnail([line('l', 0, 0, 1000, 200)]);
    expect(thumbnail).not.toBeNull();

    for (const p of coordsOf(thumbnail!.d)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(BLOCK_THUMBNAIL_VIEWBOX);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(BLOCK_THUMBNAIL_VIEWBOX);
    }
  });

  it('ΑΝΑΣΤΡΕΦΕΙ τον άξονα Y (CAD Y-πάνω → SVG Y-κάτω)', () => {
    // Κατακόρυφη γραμμή: το ΠΑΝΩ άκρο (y=100) πρέπει να πάρει ΜΙΚΡΟΤΕΡΟ SVG y από το κάτω.
    const { thumbnail } = buildBlockThumbnail([line('v', 0, 0, 0, 100)]);
    const [bottom, top] = coordsOf(thumbnail!.d);

    expect(top.y).toBeLessThan(bottom.y);
  });

  it('είναι ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ (ίδια γεωμετρία → ίδιο path· το seed είναι idempotent)', () => {
    const members = buildSystemBlockMembers(SYSTEM_BLOCKS_SEED[0].preset, SYSTEM_BLOCKS_SEED[0].id);
    const a = buildBlockThumbnail(members).thumbnail;
    const b = buildBlockThumbnail(members).thumbnail;

    expect(a).not.toBeNull();
    expect(a!.d).toBe(b!.d);
  });

  it('ΚΑΘΕ system block του καταλόγου παράγει preview (η έτοιμη βιβλιοθήκη δεν έχει κενές κάρτες)', () => {
    for (const entry of SYSTEM_BLOCKS_SEED) {
      const members = buildSystemBlockMembers(entry.preset, entry.id);
      const { thumbnail } = buildBlockThumbnail(members);

      expect(thumbnail).not.toBeNull();
      expect(thumbnail!.d.length).toBeGreaterThan(10);
    }
  });

  it('χωρίς γραμμική γεωμετρία (μόνο κείμενο) → null (ο καλών πέφτει στο footprint)', () => {
    const text = {
      id: 't',
      type: 'text',
      layerId: '0',
      position: { x: 0, y: 0 },
      text: 'A',
      height: 2,
      visible: true,
    } as unknown as Entity;

    expect(buildBlockThumbnail([text]).thumbnail).toBeNull();
  });

  it('φράζει τα σημεία και το ΔΗΛΩΝΕΙ (`truncated`) — μηδέν σιωπηλή περικοπή, φραγμένο doc', () => {
    const many = Array.from({ length: MAX_THUMBNAIL_POINTS }, (_, i) =>
      line(`l${i}`, i, 0, i, 10),
    );
    const { thumbnail, truncated } = buildBlockThumbnail(many);

    expect(truncated).toBe(true);
    const points = coordsOf(thumbnail!.d);
    expect(points.length).toBeLessThanOrEqual(MAX_THUMBNAIL_POINTS);
  });

  it('αγνοεί μη-πεπερασμένες συντεταγμένες αντί να παράγει άκυρο path', () => {
    const broken = {
      id: 'r',
      type: 'rectangle',
      layerId: '0',
      visible: true,
    } as unknown as Entity;

    const { thumbnail } = buildBlockThumbnail([broken, line('l', 0, 0, 10, 10)]);
    expect(thumbnail!.d).not.toContain('NaN');
  });
});

// ---------------------------------------------------------------------------
// 3. Palette — μία αναπαράσταση preview για τις δύο πηγές
// ---------------------------------------------------------------------------

describe('mergeBlockPaletteEntries — thumbnail (M4)', () => {
  it('session block: preview ΖΩΝΤΑΝΑ από τη γεωμετρία της μνήμης', () => {
    const [entry] = mergeBlockPaletteEntries([sessionDef('S', [line('l', 0, 0, 10, 0)])], []);

    expect(entry.source).toBe('session');
    expect(entry.thumbnail).not.toBeNull();
    expect(entry.thumbnail!.d.startsWith('M')).toBe(true);
  });

  it('cloud block: preview από το DOC — μηδέν λήψη γεωμετρίας για μια κάρτα', () => {
    const item = cloudItem({ thumbnail: { v: 1, d: 'M0,0L10,10' } });
    const [entry] = mergeBlockPaletteEntries([], [item]);

    expect(entry.thumbnail).toEqual({ v: 1, d: 'M0,0L10,10' });
  });

  it('cloud doc ΠΡΙΝ το M4 (χωρίς thumbnail) → null ⇒ fallback στο footprint (μηδέν κενή κάρτα)', () => {
    const [entry] = mergeBlockPaletteEntries([], [cloudItem()]);
    expect(entry.thumbnail).toBeNull();
    expect(entry.boundsMm).toEqual(BOUNDS);
  });
});

// ---------------------------------------------------------------------------
// 4. Κανόνες M4 — επεξεργασία + μοναδικότητα ονόματος
// ---------------------------------------------------------------------------

describe('canEditBlockEntry', () => {
  const ME = 'user_1';

  it('δικό μου cloud block → ναι (ακόμα και ήδη δημοσιευμένο: διόρθωση ≠ ξεδημοσίευση)', () => {
    const [mine] = mergeBlockPaletteEntries([], [cloudItem()]);
    const [published] = mergeBlockPaletteEntries([], [cloudItem({ scope: 'company' })]);

    expect(canEditBlockEntry(mine, ME)).toBe(true);
    expect(canEditBlockEntry(published, ME)).toBe(true);
  });

  it('builtin (έτοιμη βιβλιοθήκη) → ΟΧΙ· ξένο block → ΟΧΙ· session → ΟΧΙ (πρώτα αποθήκευση)', () => {
    const [builtin] = mergeBlockPaletteEntries(
      [],
      [cloudItem({ id: 'blklib_sys', scope: 'system', builtin: true, companyId: null })],
    );
    const [foreign] = mergeBlockPaletteEntries([], [cloudItem({ createdBy: 'other_user' })]);
    const [session] = mergeBlockPaletteEntries([sessionDef('S', [line('l', 0, 0, 1, 1)])], []);

    expect(canEditBlockEntry(builtin, ME)).toBe(false);
    expect(canEditBlockEntry(foreign, ME)).toBe(false);
    expect(canEditBlockEntry(session, ME)).toBe(false);
  });
});

describe('isBlockNameTaken — το όνομα είναι ΚΛΕΙΔΙ ΤΑΥΤΟΤΗΤΑΣ', () => {
  const entries = mergeBlockPaletteEntries(
    [sessionDef('IMPORTED', [line('l', 0, 0, 1, 1)])],
    [cloudItem({ id: 'blklib_a', name: 'CHAIR' }), cloudItem({ id: 'blklib_b', name: 'SINK' })],
  );

  it('πιάνει σύγκρουση με ΑΛΛΟ block (case/space-insensitive)', () => {
    expect(isBlockNameTaken(entries, 'SINK', 'blklib_a')).toBe(true);
    expect(isBlockNameTaken(entries, '  sink  ', 'blklib_a')).toBe(true);
  });

  it('πιάνει σύγκρουση και με SESSION block (ίδιο registry, ίδιο κλειδί)', () => {
    expect(isBlockNameTaken(entries, 'imported', 'blklib_a')).toBe(true);
  });

  it('ΔΕΝ θεωρεί σύγκρουση το ΙΔΙΟ το block (μετονομασία σε ό,τι ήδη λέγεται)', () => {
    expect(isBlockNameTaken(entries, 'CHAIR', 'blklib_a')).toBe(false);
  });

  it('ελεύθερο όνομα / κενό → όχι σύγκρουση', () => {
    expect(isBlockNameTaken(entries, 'ΝΕΟ ΟΝΟΜΑ', 'blklib_a')).toBe(false);
    expect(isBlockNameTaken(entries, '   ', 'blklib_a')).toBe(false);
  });
});
