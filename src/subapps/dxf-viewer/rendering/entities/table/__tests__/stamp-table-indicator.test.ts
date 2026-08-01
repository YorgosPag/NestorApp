/**
 * ADR-739 Φ.Δ βήμα 7 — ο **δείκτης πίνακα** στον καμβά (AutoCAD `TABLEINDICATOR`).
 *
 * Ελέγχεται **τι ζωγραφίστηκε πραγματικά**, όχι τι επιστράφηκε: ο stamper δεν επιστρέφει
 * τίποτα, οπότε η μόνη έγκυρη μαρτυρία είναι οι κλήσεις πάνω στο context.
 *
 * ## ADR-739 Φ.Δ βήμα 8 — γιατί έφυγε το τοπικό ψεύτικο context
 * Αυτό το αρχείο έχτιζε **δικό του** `CanvasRenderingContext2D` ~30 γραμμών, δίπλα στον
 * κοινό {@link createCtx} που υπάρχει ακριβώς γι' αυτόν τον λόγο (N.0.2 / N.18 — sibling
 * clone ανεξάρτητα ονόματος). Το τίμημα φάνηκε στο βήμα 8: όταν ο ζωγράφος απέκτησε
 * `translate`/`rotate`, ο κοινός καταγραφέας τα έμαθε και **αυτός εδώ έσκασε** — δηλαδή η
 * διπλή γνώση κόστισε ακριβώς όσο προβλεπόταν. Τώρα υπάρχει **ένας** καταγραφέας, και
 * επιπλέον αυτή η σουίτα κληρονομεί δωρεάν τη δυνατότητα να **δει τη στροφή**.
 *
 * @see rendering/entities/table/__tests__/table-paint-recorder.ts — ο ΕΝΑΣ καταγραφέας
 */

import { stampTableIndicator } from '../stamp-table-indicator';
import { TABLE_INDICATOR } from '../../../../config/color-config';
import { createPaintLog, createRc, type PaintLog } from './table-paint-recorder';
import type { TableIndicatorTick } from '../../../../bim/table/table-cell-reference';

/** Ένα πλαίσιο που καταγράφει· `pxPerMm` περνά απ' έξω ώστε να δοκιμάζεται το LOD. */
function fakeContext(pxPerMm: number) {
  const log: PaintLog = createPaintLog();
  return {
    log,
    // Ταυτοτική προβολή επί την κλίμακα: η **περιστροφή** ελέγχεται χωριστά, στη σουίτα
    // που την αφορά (`table-rotated-text.test.ts`).
    rc: createRc(log, { pxPerMm, toScreen: (u, v) => ({ x: u * pxPerMm, y: v * pxPerMm }) }),
  };
}

function tick(label: string, startMm: number, sizeMm: number, active = false): TableIndicatorTick {
  return { label, startMm, sizeMm, active };
}

const COLUMNS = [tick('A', 0, 20), tick('B', 20, 30, true)];
const ROWS = [tick('1', 0, 10), tick('2', 10, 8, true)];

describe('stampTableIndicator', () => {
  it('ζωγραφίζει γράμματα στηλών ΚΑΙ αριθμούς γραμμών', () => {
    const { rc, log } = fakeContext(4);
    stampTableIndicator(rc, { columns: COLUMNS, rows: ROWS, widthMm: 50, heightMm: 18 });
    expect(log.texts.map((p) => p.text)).toEqual(['A', 'B', '1', '2']);
  });

  it('η ενεργή στήλη/γραμμή παίρνει το χρώμα του ΔΡΟΜΕΑ — ίδια ερώτηση, ίδιο λεξιλόγιο', () => {
    const { rc, log } = fakeContext(4);
    stampTableIndicator(rc, { columns: COLUMNS, rows: ROWS, widthMm: 50, heightMm: 18 });
    const b = log.texts.find((p) => p.text === 'B');
    const a = log.texts.find((p) => p.text === 'A');
    expect(b?.color).toBe(TABLE_INDICATOR.activeTextHex);
    expect(a?.color).toBe(TABLE_INDICATOR.textHex);
    expect(log.fills).toContain(TABLE_INDICATOR.activeFillHex);
  });

  it('η ενεργή ετικέτα είναι έντονη — η διαφορά διαβάζεται και σε ασπρόμαυρη εκτύπωση', () => {
    const { rc, log } = fakeContext(4);
    stampTableIndicator(rc, { columns: COLUMNS, rows: ROWS, widthMm: 50, heightMm: 18 });
    expect(log.texts.find((p) => p.text === 'B')?.font).toContain('bold');
    expect(log.texts.find((p) => p.text === 'A')?.font).not.toContain('bold');
  });

  it('🔴 LOD: πίνακας-κουκκίδα ⇒ ΚΑΜΙΑ ζώνη', () => {
    // Οι ζώνες έχουν σταθερό πάχος σε px· σε έντονο zoom-out θα ήταν πλατύτερες από τον
    // ίδιο τον πίνακα — ένα γκρίζο πλαίσιο γύρω από το τίποτα.
    const { rc, log } = fakeContext(0.2);
    stampTableIndicator(rc, { columns: COLUMNS, rows: ROWS, widthMm: 50, heightMm: 18 });
    expect(log.texts).toHaveLength(0);
    expect(log.fills).toHaveLength(0);
  });

  it('στενή στήλη ⇒ το ορθογώνιο μένει, η ετικέτα φεύγει', () => {
    // Η ζώνη πρέπει να φαίνεται **συνεχής**: μια τρύπα εκεί μοιάζει με σφάλμα ζωγραφικής.
    const { rc, log } = fakeContext(1);
    stampTableIndicator(rc, {
      columns: [tick('A', 0, 2), tick('B', 2, 60)],
      rows: [tick('1', 0, 30), tick('2', 30, 30, true)],
      widthMm: 62,
      heightMm: 60,
    });
    expect(log.texts.map((p) => p.text)).not.toContain('A');
    expect(log.texts.map((p) => p.text)).toContain('B');
    expect(log.fills.length).toBeGreaterThan(log.texts.length);
  });

  it('ζωγραφίζει και τη γωνία που ενώνει τις δύο ζώνες', () => {
    const { rc, log } = fakeContext(4);
    stampTableIndicator(rc, { columns: COLUMNS, rows: ROWS, widthMm: 50, heightMm: 18 });
    // 1 γωνία + 2 στήλες + 2 γραμμές = 5 γεμίσματα.
    expect(log.fills).toHaveLength(5);
  });
});
