/**
 * 🔴 ADR-771 Φ.1 — **Η ΓΩΝΙΑ ΦΤΑΝΕΙ ΟΝΤΩΣ ΣΤΟΝ ΚΑΜΒΑ**: η άγκυρα που έλειπε.
 *
 * ## Γιατί δεν αρκεί το CHECK 3.41
 * Η πύλη διακριτότητας διαβάζει το `TABLE_BOUND_STATE.exceptionMarks` και βεβαιώνει ότι οι
 * δύο καταστάσεις **δηλώνουν** διαφορετική γωνία. Δεν μπορεί όμως να δει αν ο ζωγράφος
 * **τιμά** τη δήλωση: ένας ζωγράφος που αγνοεί το πεδίο και βάφει πάντα πάνω-αριστερά θα
 * άφηνε την πύλη κατάφωτα πράσινη ενώ η οθόνη δείχνει το ίδιο ακριβώς ελάττωμα.
 *
 * Αυτό είναι το σχήμα «**δήλωση χωρίς εκτέλεση**» που το ADR-752 ονόμασε ρητά (*«ένα anchor
 * χωρίς gate είναι σχόλιο»*) — εδώ στην αντίστροφη μορφή του: **gate χωρίς anchor**.
 *
 * ## 🔴 Το κενό που το γέννησε, μετρημένο
 * Όταν άλλαξε η γωνία της σύγκρουσης, **και τα 170** υπάρχοντα tests του φακέλου έμειναν
 * πράσινα. Καμία άγκυρα δεν κλείδωνε **πού** ζωγραφίζεται το τρίγωνο — μόνο *ότι*
 * ζωγραφίζεται (`table-bound-state-paper-isolation`) και *με τι ένταση* η λωρίδα
 * (`table-write-back-strip-intensity`). Η θέση ήταν ανοχύρωτη και προς τις δύο κατευθύνσεις.
 *
 * @see rendering/entities/table/stamp-table-bound-state.ts — ο ζωγράφος
 * @see scripts/check-state-channel-distinctness.js — CHECK 3.41, η άλλη μισή απόδειξη
 */

import { stampTableBoundState } from '../stamp-table-bound-state';
import { TABLE_BOUND_STATE } from '../../../../config/color-config';
import { clearPrintColorPolicy } from '../../../../config/print-color-policy';
import type { StampTableContext } from '../stamp-table-layout';
import type { BoundExceptionMark } from '../../../../bim/table/binding/table-bound-marks';

/** Ένα σημείο διαδρομής, όπως έφτασε στον καμβά. */
interface Point {
  readonly kind: 'moveTo' | 'lineTo';
  readonly x: number;
  readonly y: number;
}

interface Recorder {
  readonly rc: StampTableContext;
  /** Τα σημεία κάθε τριγώνου, χωρισμένα στα `beginPath`. */
  readonly paths: Point[][];
  readonly fills: string[];
}

function recorder(): Recorder {
  const paths: Point[][] = [];
  const fills: string[] = [];
  let current: Point[] = [];

  const ctx = {
    save: () => {},
    restore: () => {},
    beginPath: () => {
      current = [];
      paths.push(current);
    },
    moveTo: (x: number, y: number) => current.push({ kind: 'moveTo', x, y }),
    lineTo: (x: number, y: number) => current.push({ kind: 'lineTo', x, y }),
    closePath: () => {},
    fill: () => {},
    stroke: () => {},
    setLineDash: () => {},
    set fillStyle(value: string) {
      fills.push(value);
    },
    get fillStyle() {
      return fills[fills.length - 1] ?? '';
    },
    canvas: { width: 800, height: 600 },
  } as unknown as CanvasRenderingContext2D;

  return {
    paths,
    fills,
    // `toScreen` ταυτοτικό και `pxPerMm: 4` ⇒ οι συντεταγμένες που ελέγχουμε είναι
    // ΑΚΡΙΒΩΣ οι sheet-mm, χωρίς αριθμητικό θόρυβο στη μέση της απόδειξης.
    rc: {
      ctx,
      toScreen: (u: number, v: number) => ({ x: u, y: v }),
      pxPerMm: 4,
      textAngleRad: 0,
      surfaceHex: '#1d283a',
    } as StampTableContext,
  };
}

/** Κελί φαρδύ και ψηλό αρκετά ώστε το τρίγωνο να ΜΗΝ συρρικνώνεται (side = 6/4 = 1,5 mm). */
const CELL = { x: 15, y: 8, w: 25, h: 6 } as const;
const SIDE_MM = TABLE_BOUND_STATE.markSizePx / 4;

function stamp(state: BoundExceptionMark['state']): Recorder {
  const rec = recorder();
  stampTableBoundState(rec.rc, {
    strips: [],
    marks: [{ rowId: 'r1', colId: 'cX', state, rect: { ...CELL } }],
    stale: false,
  });
  return rec;
}

beforeEach(() => clearPrintColorPolicy());

describe('ADR-771 Φ.1 — η γωνία του σημαδιού εξαίρεσης', () => {
  it('η ΠΑΡΑΚΑΜΨΗ αγκυρώνει στην πάνω-ΑΡΙΣΤΕΡΗ κορυφή του κελιού', () => {
    const { paths } = stamp('overridden');
    const triangle = paths.at(-1)!;

    expect(triangle[0]).toEqual({ kind: 'moveTo', x: CELL.x, y: CELL.y });
    expect(triangle[1]).toEqual({ kind: 'lineTo', x: CELL.x + SIDE_MM, y: CELL.y });
    expect(triangle[2]).toEqual({ kind: 'lineTo', x: CELL.x, y: CELL.y + SIDE_MM });
  });

  it('η ΣΥΓΚΡΟΥΣΗ αγκυρώνει στην πάνω-ΔΕΞΙΑ κορυφή — το δεύτερο κανάλι (WCAG 1.4.1)', () => {
    const { paths } = stamp('conflict');
    const triangle = paths.at(-1)!;
    const right = CELL.x + CELL.w;

    expect(triangle[0]).toEqual({ kind: 'moveTo', x: right, y: CELL.y });
    expect(triangle[1]).toEqual({ kind: 'lineTo', x: right - SIDE_MM, y: CELL.y });
    expect(triangle[2]).toEqual({ kind: 'lineTo', x: right, y: CELL.y + SIDE_MM });
  });

  it('οι δύο καταστάσεις ΔΕΝ μοιράζονται κανένα σημείο — διακρίνονται χωρίς χρώμα', () => {
    const key = (p: Point) => `${p.x},${p.y}`;
    const a = new Set(stamp('overridden').paths.at(-1)!.map(key));
    const b = new Set(stamp('conflict').paths.at(-1)!.map(key));
    expect([...a].filter((p) => b.has(p))).toEqual([]);
  });

  it('το τρίγωνο μένει ΜΕΣΑ στο κελί και στις δύο γωνίες', () => {
    for (const state of ['overridden', 'conflict'] as const) {
      for (const p of stamp(state).paths.at(-1)!) {
        expect(p.x).toBeGreaterThanOrEqual(CELL.x);
        expect(p.x).toBeLessThanOrEqual(CELL.x + CELL.w);
        expect(p.y).toBeGreaterThanOrEqual(CELL.y);
        expect(p.y).toBeLessThanOrEqual(CELL.y + CELL.h);
      }
    }
  });

  it('σε στενό κελί συρρικνώνεται αντί να ξεχειλίσει στον γείτονα — και στις δύο γωνίες', () => {
    const narrow = { x: 15, y: 8, w: 0.4, h: 6 } as const;
    for (const state of ['overridden', 'conflict'] as const) {
      const rec = recorder();
      stampTableBoundState(rec.rc, {
        strips: [],
        marks: [{ rowId: 'r1', colId: 'cX', state, rect: { ...narrow } }],
        stale: false,
      });
      for (const p of rec.paths.at(-1)!) {
        expect(p.x).toBeGreaterThanOrEqual(narrow.x);
        expect(p.x).toBeLessThanOrEqual(narrow.x + narrow.w);
      }
    }
  });

  it('η γωνία ΔΙΑΒΑΖΕΤΑΙ από το config — δεν είναι σταθερά μέσα στον ζωγράφο', () => {
    // Αν κάποιος «απλοποιήσει» τον ζωγράφο σε `if (state === 'conflict')`, το πεδίο θα
    // πάψει να είναι η αλήθεια και η πύλη 3.41 θα κρίνει κάτι που δεν ζωγραφίζεται.
    expect(TABLE_BOUND_STATE.exceptionMarks.overridden.corner).toBe('top-left');
    expect(TABLE_BOUND_STATE.exceptionMarks.conflict.corner).toBe('top-right');

    const anchorOf = (state: BoundExceptionMark['state']) => stamp(state).paths.at(-1)![0];
    expect(anchorOf('overridden').x).toBe(CELL.x);
    expect(anchorOf('conflict').x).toBe(CELL.x + CELL.w);
  });

  it('κάθε κατάσταση βάφεται με το ΔΙΚΟ της hex, από το ίδιο config', () => {
    expect(stamp('overridden').fills).toContain(TABLE_BOUND_STATE.exceptionMarks.overridden.hex);
    expect(stamp('conflict').fills).toContain(TABLE_BOUND_STATE.exceptionMarks.conflict.hex);
  });
});
