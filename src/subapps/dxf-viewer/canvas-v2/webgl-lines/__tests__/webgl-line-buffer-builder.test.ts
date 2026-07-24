/**
 * ADR-639 Στάδιο 5 — buffer-builder structure & invariants.
 *
 * Segment counts (LINE→1, open poly(n)→n-1, closed→n), bucketing by (width,alpha),
 * DESC length sort, per-vertex LINEAR colour, ownedEntityIds membership, and the
 * MAX_BUCKETS backstop routing surplus back to Canvas2D. Style resolution and layer
 * skipping are injected → pure test, no store setup. N.17-safe (jest only).
 */

import * as THREE from 'three';
import { buildWebglLineBuffers, MAX_BUCKETS } from '../webgl-line-buffer-builder';
// ADR-694 Φ10 — ανεξάρτητος μάρτυρας για τη μεταφορά sRGB→linear (δικό μας SSoT, όχι THREE).
import { srgbToLinearUnit } from '../../../config/color-math';
import type { DxfEntityUnion } from '../../dxf-canvas/dxf-types';
import type { ResolvedRenderStyle } from '../../dxf-canvas/dxf-renderer-style-resolve';

const SOLID = (colorHex: string, lineWidthPx = 1, alpha = 1): ResolvedRenderStyle => ({
  colorHex, lineWidthPx, alpha, dashMm: [],
});
const NEVER_SKIP = () => false;

function line(id: string, x1: number, y1: number, x2: number, y2: number): DxfEntityUnion {
  return { id, type: 'line', visible: true, start: { x: x1, y: y1 }, end: { x: x2, y: y2 } } as DxfEntityUnion;
}
function poly(id: string, pts: Array<[number, number]>, closed = false): DxfEntityUnion {
  return {
    id, type: 'polyline', visible: true, closed,
    vertices: pts.map(([x, y]) => ({ x, y })),
  } as DxfEntityUnion;
}

describe('buildWebglLineBuffers — segment counts', () => {
  it('LINE → 1 segment', () => {
    const r = buildWebglLineBuffers([line('l', 0, 0, 3, 4)], () => SOLID('#ffffff'), NEVER_SKIP);
    expect(r.buckets).toHaveLength(1);
    expect(r.buckets[0].worldLengths).toHaveLength(1);
    expect(r.buckets[0].worldLengths[0]).toBeCloseTo(5, 6); // 3-4-5
    expect(r.buckets[0].positions).toHaveLength(6);
  });

  it('open polyline(n) → n-1 segments', () => {
    const r = buildWebglLineBuffers([poly('p', [[0, 0], [1, 0], [2, 0], [3, 0]])], () => SOLID('#ffffff'), NEVER_SKIP);
    expect(r.buckets[0].worldLengths).toHaveLength(3);
  });

  it('closed polyline(n) → n segments', () => {
    const r = buildWebglLineBuffers([poly('p', [[0, 0], [1, 0], [1, 1]], true)], () => SOLID('#ffffff'), NEVER_SKIP);
    expect(r.buckets[0].worldLengths).toHaveLength(3);
  });
});

describe('buildWebglLineBuffers — bucketing & sort', () => {
  it('groups by (width, alpha) and separates distinct widths', () => {
    const r = buildWebglLineBuffers(
      [line('a', 0, 0, 1, 0), line('b', 0, 0, 2, 0)],
      (e) => SOLID('#ffffff', e.id === 'a' ? 1 : 3),
      NEVER_SKIP,
    );
    expect(r.buckets).toHaveLength(2);
  });

  it('sorts segments DESC by world length within a bucket', () => {
    const r = buildWebglLineBuffers(
      [line('short', 0, 0, 1, 0), line('long', 0, 0, 10, 0), line('mid', 0, 0, 5, 0)],
      () => SOLID('#ffffff'),
      NEVER_SKIP,
    );
    const w = r.buckets[0].worldLengths;
    expect([...w]).toEqual([...w].slice().sort((a, b) => b - a));
    expect(w[0]).toBeCloseTo(10, 6);
  });
});

/**
 * ADR-694 Φ10 — ΓΙΑΤΙ ΑΥΤΟ ΤΟ describe ΞΑΝΑΓΡΑΦΤΗΚΕ.
 *
 * Η προηγούμενη μορφή ήταν **ταυτολογία**:
 *
 *     const expected = new THREE.Color().setStyle('#808080');   // ...και η υλοποίηση κάνει
 *     // ακριβώς `_color.setStyle(hex)` → σύγκριση της THREE με τον ΕΑΥΤΟ της.
 *
 * Αν κάποιος γύριζε το `THREE.ColorManagement.enabled` σε `false`, **και οι δύο** πλευρές θα
 * γύριζαν μαζί σε ωμό sRGB, το test θα έμενε **πράσινο**, και οι γραμμές του DXF θα σχεδιάζονταν
 * ορατά ξεπλυμένες στην οθόνη. Ένα test που δεν μπορεί να αποτύχει για την ιδιότητα που
 * υποτίθεται ότι προστατεύει δεν είναι test — είναι σχόλιο.
 *
 * Τώρα η αναμενόμενη τιμή έρχεται από **ανεξάρτητη** υλοποίηση: το `srgbToLinearUnit` του
 * `config/color-math` (IEC 61966-2-1, δικό μας SSoT, καμία σχέση με THREE). Οι δύο δρόμοι
 * συμφωνούν **μόνο** όσο το ColorManagement είναι ON και ο working χώρος είναι Linear-sRGB —
 * που είναι ακριβώς η αδήλωτη παραδοχή όλου του χρωματικού αγωγού του layer.
 */
describe('buildWebglLineBuffers — colour (linear)', () => {
  it('uploads LINEAR rgb for the entity hex (both endpoints share it)', () => {
    const r = buildWebglLineBuffers([line('l', 0, 0, 1, 0)], () => SOLID('#808080'), NEVER_SKIP);
    // Ανεξάρτητος μάρτυρας — ΟΧΙ THREE. sRGB 0x80 → ~0.2159 γραμμικό φως, όχι 0.502.
    const expected = srgbToLinearUnit(0x80 / 255);
    const c = r.buckets[0].colors;
    expect(c[0]).toBeCloseTo(expected, 5);
    expect(c[1]).toBeCloseTo(expected, 5);
    expect(c[2]).toBeCloseTo(expected, 5);
    expect(c[3]).toBeCloseTo(expected, 5); // second vertex, same colour
    // Ρητά: ΔΕΝ ανεβαίνει η ωμή sRGB τιμή (αυτό θα σήμαινε ColorManagement OFF).
    expect(c[0]).not.toBeCloseTo(0x80 / 255, 3);
  });

  it('κρατά τα κανάλια στη σωστή σειρά (κορεσμένο χρώμα, όχι γκρι)', () => {
    const r = buildWebglLineBuffers([line('l', 0, 0, 1, 0)], () => SOLID('#e29032'), NEVER_SKIP);
    const c = r.buckets[0].colors;
    expect(c[0]).toBeCloseTo(srgbToLinearUnit(0xe2 / 255), 5);
    expect(c[1]).toBeCloseTo(srgbToLinearUnit(0x90 / 255), 5);
    expect(c[2]).toBeCloseTo(srgbToLinearUnit(0x32 / 255), 5);
  });
});

/**
 * ADR-694 Φ10 — Ο ΑΔΗΛΩΤΟΣ ΚΑΘΟΛΙΚΟΣ ΓΙΝΕΤΑΙ ΡΗΤΟΣ.
 *
 * Το `webgl-line-renderer-setup.ts` τεκμηριώνει ρητά ότι **δεν** πειράζει το
 * `ColorManagement.enabled` (είναι THREE-global, κοινό με τον BIM 3D renderer — flip θα
 * κατέστρεφε κάθε PBR χρώμα). Άρα ολόκληρος ο αγωγός στηρίζεται σε ένα καθολικό που
 * **πουθενά στον κώδικά μας δεν ορίζεται** — κληρονομείται από το default της βιβλιοθήκης
 * (`true` από r152· είμαστε σε three 0.170). Ένα αναβάθμιση/regression που θα το γύριζε αλλού
 * θα περνούσε αθόρυβα. Εδώ γίνεται εκτελεστό συμβόλαιο.
 */
describe('χρωματικός αγωγός — αμετάβλητο του περιβάλλοντος (ADR-694 Φ10)', () => {
  it('THREE.ColorManagement είναι ON — αλλιώς κάθε ανέβασμα γραμμικού χρώματος είναι λάθος', () => {
    expect(THREE.ColorManagement.enabled).toBe(true);
  });

  it('το THREE και το δικό μας SSoT συμφωνούν στη μεταφορά sRGB→linear', () => {
    for (const hex of ['#000000', '#0b0b0b', '#808080', '#e29032', '#ffffff']) {
      const three = new THREE.Color().setStyle(hex);
      expect(three.r).toBeCloseTo(srgbToLinearUnit(parseInt(hex.slice(1, 3), 16) / 255), 5);
    }
  });
});

describe('buildWebglLineBuffers — ownership & filtering', () => {
  it('excludes layer-skipped entities from buckets and ownedEntityIds', () => {
    const r = buildWebglLineBuffers(
      [line('keep', 0, 0, 1, 0), line('frozen', 0, 0, 1, 0)],
      () => SOLID('#ffffff'),
      (e) => e.id === 'frozen',
    );
    expect(r.ownedEntityIds.has('keep')).toBe(true);
    expect(r.ownedEntityIds.has('frozen')).toBe(false);
  });

  it('excludes dashed (resolved) lines', () => {
    const r = buildWebglLineBuffers(
      [line('dashed', 0, 0, 1, 0)],
      () => ({ colorHex: '#fff', lineWidthPx: 1, alpha: 1, dashMm: [5, -5] }),
      NEVER_SKIP,
    );
    expect(r.buckets).toHaveLength(0);
    expect(r.ownedEntityIds.size).toBe(0);
  });
});

describe('buildWebglLineBuffers — MAX_BUCKETS backstop', () => {
  it('keeps the most-populated buckets and routes surplus back to Canvas2D', () => {
    // MAX_BUCKETS+4 distinct widths; the widest-index buckets get FEWER segments so
    // they are the ones dropped. Each "bucket i" gets (i+1) single-segment entities.
    const entities: DxfEntityUnion[] = [];
    const widthOf: Record<string, number> = {};
    const total = MAX_BUCKETS + 4;
    for (let i = 0; i < total; i++) {
      const count = i + 1; // bucket i has i+1 segments → higher i = more populated
      for (let j = 0; j < count; j++) {
        const id = `w${i}_s${j}`;
        entities.push(line(id, 0, 0, 1, 0));
        widthOf[id] = i + 1; // distinct width per bucket
      }
    }
    const r = buildWebglLineBuffers(entities, (e) => SOLID('#fff', widthOf[e.id]), NEVER_SKIP);
    expect(r.buckets).toHaveLength(MAX_BUCKETS);
    // The 4 least-populated buckets (i = 0..3) are dropped → their entities not owned.
    expect(r.ownedEntityIds.has('w0_s0')).toBe(false);
    expect(r.ownedEntityIds.has('w3_s0')).toBe(false);
    // A high-population bucket survives.
    expect(r.ownedEntityIds.has(`w${total - 1}_s0`)).toBe(true);
  });
});
