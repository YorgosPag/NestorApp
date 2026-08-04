/**
 * ADR-733 — explodeTextEntity (TEXT/MTEXT → glyph-outline γεωμετρία) tests.
 *   - per-glyph contours → LWPOLYLINE (κλειστά)· multi-contour glyph → GROUP ανά γράμμα
 *   - world transform: position/rotation (y-flip συζυγία με τον renderer)
 *   - em μέσω `emSizeForTextHeight` (sCapHeight) + baseline από `baselineOffsetFromAnchor`
 *   - style inheritance (χρώμα/layer ΝΑΙ — text πεδία ΟΧΙ)· unresolved font → null
 *
 * Το `resolveEntityFont` του barrel mock-άρεται (stub opentype Font με ντετερμινιστικά
 * τετράγωνα glyphs)· τα υπόλοιπα SSoTs (layout, em, baseline) τρέχουν πραγματικά — το
 * `measureTextAdvanceWorld` του layout πέφτει στο monospace tier (κενό fontCache σε jest).
 */

import { explodeEntity, isExplodable } from '../explode-entity';
import { explodeTextEntity } from '../explode-text';
import type { Entity, GroupEntity, LWPolylineEntity, TextEntity } from '../../../types/entities';
import type { Font, Path as OtPath, PathCommand } from 'opentype.js';
import { resolveEntityFont } from '../../../text-engine/fonts';

jest.mock('../../../text-engine/fonts', () => ({
  ...jest.requireActual('../../../text-engine/fonts'),
  resolveEntityFont: jest.fn(),
}));

const mockResolve = resolveEntityFont as jest.MockedFunction<typeof resolveEntityFont>;

// ─── Stub opentype font ───────────────────────────────────────────────────────
// unitsPerEm 1000, sCapHeight 700 ⇒ em = height ÷ 0.7. Advance = 0.6 × size ανά χαρακτήρα.
// Glyphs (y-down, baseline στο y): default = ΕΝΑ κλειστό τετράγωνο πλευράς 0.5×size·
// 'O' = ΔΥΟ contours (εξωτερικό + εσωτερικό)· 'C' = καμπύλη Q (ελέγχει το flatten).

const ADV = 0.6;
const asPath = (commands: PathCommand[]): OtPath => ({ commands } as unknown as OtPath);

const square = (x: number, y: number, s: number): PathCommand[] => [
  { type: 'M', x, y },
  { type: 'L', x: x + s, y },
  { type: 'L', x: x + s, y: y - s },
  { type: 'L', x, y: y - s },
  { type: 'Z' },
];

function glyphFor(ch: string, x: number, y: number, size: number): OtPath {
  const s = 0.5 * size;
  if (ch === 'O') return asPath([...square(x, y, s), ...square(x + s / 4, y - s / 4, s / 2)]);
  if (ch === 'C') {
    return asPath([
      { type: 'M', x, y },
      { type: 'Q', x1: x + s / 2, y1: y - s, x: x + s, y },
      { type: 'Z' },
    ]);
  }
  return asPath(square(x, y, s));
}

const stubFont = {
  unitsPerEm: 1000,
  ascender: 800,
  descender: -200,
  tables: { os2: { sCapHeight: 700 } },
  getAdvanceWidth: (text: string, size: number) => [...text].length * ADV * size,
  getPath: (text: string, x: number, y: number, size: number) => glyphFor(text, x, y, size),
  getPaths: (text: string, x: number, y: number, size: number) => {
    const out: OtPath[] = [];
    let pen = x;
    for (const ch of text) {
      out.push(glyphFor(ch, pen, y, size));
      pen += ADV * size;
    }
    return out;
  },
} as unknown as Font;

// ─── Fixtures ────────────────────────────────────────────────────────────────

const HEIGHT = 10;
const EM = HEIGHT / 0.7;           // emSizeForTextHeight με sCapHeight 700/1000
const ASC = 0.8 * EM;              // ascender × em — baseline drop για anchor 'top'
const SIDE = 0.5 * EM;             // πλευρά τετραγώνου glyph

const mkText = (text: string, extra: Record<string, unknown> = {}): TextEntity =>
  ({
    id: 't1', type: 'text', layerId: 'lyr_t', color: '#123456',
    position: { x: 10, y: 20 }, text, height: HEIGHT, ...extra,
  } as unknown as TextEntity);

beforeEach(() => {
  mockResolve.mockReset();
  mockResolve.mockReturnValue({ font: stubFont, cacheName: 'stub-font' });
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ADR-733 — isExplodable: text/mtext', () => {
  it('flags text + mtext as explodable', () => {
    expect(isExplodable(mkText('A') as Entity)).toBe(true);
    expect(isExplodable({ ...mkText('A'), type: 'mtext' } as unknown as Entity)).toBe(true);
  });
});

describe('ADR-733 — explodeTextEntity: glyph contours', () => {
  it('single-contour glyphs → one closed LWPOLYLINE per letter, at world positions', () => {
    const out = explodeTextEntity(mkText('AB')) as LWPolylineEntity[];
    expect(out).toHaveLength(2);
    expect(out.every((e) => e.type === 'lwpolyline' && e.closed === true)).toBe(true);

    // Τοπικά: baseline στο +ASC (y-down)· world y = 20 − y_local (y-flip γύρω από position).
    const v0 = out[0].vertices[0];
    expect(v0.x).toBeCloseTo(10, 6);
    expect(v0.y).toBeCloseTo(20 - ASC, 6);
    // Κορυφή του glyph (y_local = ASC − SIDE) → world υψηλότερα κατά SIDE.
    expect(out[0].vertices[2].y).toBeCloseTo(20 - ASC + SIDE, 6);
    // Δεύτερο γράμμα: pen advance 0.6×em δεξιότερα.
    expect(out[1].vertices[0].x).toBeCloseTo(10 + ADV * EM, 6);
  });

  it('multi-contour glyph (Ο) → ΕΝΑ GROUP ανά γράμμα με τα contours μέλη', () => {
    const out = explodeTextEntity(mkText('O')) as Entity[];
    expect(out).toHaveLength(1);
    const group = out[0] as GroupEntity;
    expect(group.type).toBe('group');
    expect(group.members).toHaveLength(2);
    expect(group.members.every((m: Entity) => m.type === 'lwpolyline')).toBe(true);
  });

  it('Bezier (Q) contour flatten-άρεται σε > 3 κορυφές με χορδική ανοχή', () => {
    const out = explodeTextEntity(mkText('C')) as LWPolylineEntity[];
    expect(out).toHaveLength(1);
    expect(out[0].vertices.length).toBeGreaterThan(3);
  });

  it('rotation 90° — world = position + R(θ)·(x, −y_local)', () => {
    const out = explodeTextEntity(mkText('A', { rotation: 90 })) as LWPolylineEntity[];
    // v0 τοπικά (0, ASC) → y-up (0, −ASC) → R(90): (ASC, 0) → world (10+ASC, 20).
    expect(out[0].vertices[0].x).toBeCloseTo(10 + ASC, 6);
    expect(out[0].vertices[0].y).toBeCloseTo(20, 6);
  });

  it('inherits χρώμα/layer, στριμμένα τα text πεδία (ADR-733 §2.3)', () => {
    const out = explodeTextEntity(mkText('A')) as LWPolylineEntity[];
    expect(out[0].color).toBe('#123456');
    expect(out[0].layerId).toBe('lyr_t');
    expect(out[0].id).not.toBe('t1');
    expect('text' in out[0]).toBe(false);
    expect('position' in out[0]).toBe(false);
    expect('fontSize' in out[0]).toBe(false);
  });
});

describe('ADR-753 §21 — οριζόντια αγκύρωση: η γεωμετρία ξεκινά εκεί που ξεκινούν τα γράμματα', () => {
  // 🔴 Γιατί γράφτηκε: μεταλλάσσοντας το πρόσημο του `anchorOffset` (τον ΕΝΑ κανόνα που
  // μοιράζονται renderer / explode / clip / πίνακας), οι σουίτες του `glyph-run-draw` και του
  // `bim/table` κοκκίνισαν — το `explode` έμεινε **πράσινο**. Το explode οφείλει να παράγει
  // γεωμετρία ταυτόσημη με ό,τι βλέπει ο χρήστης· χωρίς αυτό το δίχτυ, μια μετατόπιση κατά
  // ολόκληρο το πλάτος της λέξης δεν θα φαινόταν πουθενά.
  //
  // Οι αξιώσεις είναι **σχέσεις**, όχι απόλυτοι αριθμοί: το `line.widthWorld` βγαίνει από το
  // monospace tier του `measureTextAdvanceWorld` (κενό fontCache σε jest), οπότε ένας απόλυτος
  // αριθμός θα κλείδωνε τον μετρητή, όχι την αγκύρωση.
  const startX = (textAlign: 'left' | 'center' | 'right'): number => {
    const out = explodeTextEntity(mkText('AB', { textStyle: { textAlign } })) as LWPolylineEntity[];
    return out[0].vertices[0].x;
  };

  it("'left': το πρώτο γράμμα ξεκινά ΠΑΝΩ στο σημείο εισαγωγής (μηδενική μετατόπιση)", () => {
    expect(startX('left')).toBeCloseTo(10, 6); // position.x του mkText
  });

  it('διάταξη LTR: δεξιά < κέντρο < αριστερά — αντιστροφή προσήμου το σπάει', () => {
    expect(startX('right')).toBeLessThan(startX('center'));
    expect(startX('center')).toBeLessThan(startX('left'));
  });

  it('το κέντρο μετατοπίζει ΑΚΡΙΒΩΣ το μισό του δεξιά — «/2» που έγινε «/1» το σπάει', () => {
    expect(2 * (startX('left') - startX('center'))).toBeCloseTo(startX('left') - startX('right'), 6);
  });

  it('η αγκύρωση είναι ΚΑΘΑΡΗ ΜΕΤΑΤΟΠΙΣΗ: ίδια γεωμετρία, ίδιο y, μόνο το x ολισθαίνει', () => {
    const shape = (a: 'left' | 'right'): LWPolylineEntity[] =>
      explodeTextEntity(mkText('AB', { textStyle: { textAlign: a } })) as LWPolylineEntity[];
    const [l, r] = [shape('left'), shape('right')];
    expect(r).toHaveLength(l.length);
    const dx = l[0].vertices[0].x - r[0].vertices[0].x;
    expect(dx).toBeGreaterThan(0);
    l.forEach((glyph, gi) => {
      glyph.vertices.forEach((v, vi) => {
        expect(v.x - r[gi].vertices[vi].x).toBeCloseTo(dx, 6); // ίδιο Δx παντού
        expect(v.y).toBeCloseTo(r[gi].vertices[vi].y, 6);      // το y δεν αγγίζεται
      });
    });
  });
});

describe('ADR-733 — όρια: unresolved font / κενό κείμενο', () => {
  it('span χωρίς φορτωμένη outline γραμματοσειρά → null (no-op, όχι λάθος γεωμετρία)', () => {
    mockResolve.mockReturnValue(null);
    expect(explodeTextEntity(mkText('A'))).toBeNull();
    expect(explodeEntity(mkText('A') as Entity)).toBeNull();
  });

  it('κενό κείμενο → null', () => {
    expect(explodeTextEntity(mkText(''))).toBeNull();
  });

  it('explodeEntity δρομολογεί text στο text engine (ίδιο αποτέλεσμα)', () => {
    const out = explodeEntity(mkText('A') as Entity) as LWPolylineEntity[];
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('lwpolyline');
  });
});
