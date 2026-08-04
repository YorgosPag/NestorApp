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

function tick(
  label: string,
  startMm: number,
  sizeMm: number,
  active = false,
  hovered = false,
): TableIndicatorTick {
  return { label, startMm, sizeMm, active, hovered };
}

const COLUMNS = [tick('A', 0, 20), tick('B', 20, 30, true)];
const ROWS = [tick('1', 0, 10), tick('2', 10, 8, true)];

/** ADR-739 §43 — το τετραγωνάκι της γωνίας σε ηρεμία· οι σουίτες αυτές ρωτούν τις ζώνες. */
const NO_CORNER = { active: false, hovered: false } as const;

describe('stampTableIndicator', () => {
  it('ζωγραφίζει γράμματα στηλών ΚΑΙ αριθμούς γραμμών', () => {
    const { rc, log } = fakeContext(4);
    stampTableIndicator(rc, { columns: COLUMNS, rows: ROWS, widthMm: 50, heightMm: 18 , corner: NO_CORNER });
    expect(log.texts.map((p) => p.text)).toEqual(['A', 'B', '1', '2']);
  });

  it('η ενεργή στήλη/γραμμή παίρνει το χρώμα του ΔΡΟΜΕΑ — ίδια ερώτηση, ίδιο λεξιλόγιο', () => {
    const { rc, log } = fakeContext(4);
    stampTableIndicator(rc, { columns: COLUMNS, rows: ROWS, widthMm: 50, heightMm: 18 , corner: NO_CORNER });
    const b = log.texts.find((p) => p.text === 'B');
    const a = log.texts.find((p) => p.text === 'A');
    expect(b?.color).toBe(TABLE_INDICATOR.activeTextHex);
    expect(a?.color).toBe(TABLE_INDICATOR.textHex);
    expect(log.fills).toContain(TABLE_INDICATOR.activeFillHex);
  });

  it('η ενεργή ετικέτα είναι έντονη — η διαφορά διαβάζεται και σε ασπρόμαυρη εκτύπωση', () => {
    const { rc, log } = fakeContext(4);
    stampTableIndicator(rc, { columns: COLUMNS, rows: ROWS, widthMm: 50, heightMm: 18 , corner: NO_CORNER });
    expect(log.texts.find((p) => p.text === 'B')?.font).toContain('bold');
    expect(log.texts.find((p) => p.text === 'A')?.font).not.toContain('bold');
  });

  it('🔴 LOD: πίνακας-κουκκίδα ⇒ ΚΑΜΙΑ ζώνη', () => {
    // Οι ζώνες έχουν σταθερό πάχος σε px· σε έντονο zoom-out θα ήταν πλατύτερες από τον
    // ίδιο τον πίνακα — ένα γκρίζο πλαίσιο γύρω από το τίποτα.
    const { rc, log } = fakeContext(0.2);
    stampTableIndicator(rc, { columns: COLUMNS, rows: ROWS, widthMm: 50, heightMm: 18 , corner: NO_CORNER });
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
      corner: NO_CORNER,
    });
    expect(log.texts.map((p) => p.text)).not.toContain('A');
    expect(log.texts.map((p) => p.text)).toContain('B');
    expect(log.fills.length).toBeGreaterThan(log.texts.length);
  });

  it('ζωγραφίζει και τη γωνία που ενώνει τις δύο ζώνες', () => {
    const { rc, log } = fakeContext(4);
    stampTableIndicator(rc, { columns: COLUMNS, rows: ROWS, widthMm: 50, heightMm: 18 , corner: NO_CORNER });
    // 🔴 ADR-739 §43 — **ΗΤΑΝ 5, ΕΓΙΝΑΝ 6.** Η γωνία έπαψε να είναι κενό τετράγωνο: κουτί +
    // **τρίγωνο**. 1 κουτί γωνίας + 1 τρίγωνο + 2 στήλες + 2 γραμμές = 6 γεμίσματα.
    expect(log.fills).toHaveLength(6);
  });

  /** 🔴 ADR-739 §30 — το ημιδιαφανές πλύσιμο της υποδιαίρεσης κάτω από το ποντίκι. */
  describe('§30 — hover', () => {
    it('ΕΝΑ επιπλέον γέμισμα, μόνο στην υποδιαίρεση κάτω από το ποντίκι', () => {
      const { rc, log } = fakeContext(4);
      stampTableIndicator(rc, {
        columns: [tick('A', 0, 20, false, true), tick('B', 20, 30, true)],
        rows: ROWS,
        widthMm: 50,
        heightMm: 18,
        corner: NO_CORNER,
      });
      // 6 όπως πριν (§43: κουτί γωνίας + τρίγωνο) + 1 πλύσιμο = 7· το πλύσιμο είναι το hover.
      expect(log.fills).toHaveLength(7);
      expect(log.fills.filter((f) => f === TABLE_INDICATOR.hoverWashRgba)).toHaveLength(1);
    });

    it('χωρίς hover ⇒ κανένα πλύσιμο (η κανονική κατάσταση κάθε καρέ)', () => {
      const { rc, log } = fakeContext(4);
      stampTableIndicator(rc, { columns: COLUMNS, rows: ROWS, widthMm: 50, heightMm: 18 , corner: NO_CORNER });
      expect(log.fills).not.toContain(TABLE_INDICATOR.hoverWashRgba);
    });

    /**
     * 🔴 Η περίπτωση για την οποία επιλέχθηκε **πλύσιμο** αντί για τρίτο χρώμα γεμίσματος:
     * hover πάνω στην ήδη ενεργή στήλη. Το ενεργό μπλε μένει — από πάνω του μπαίνει η σκιά.
     * Ένα `hoverFillHex` εδώ ή θα έσβηνε τη δήλωση της ενεργής, ή δεν θα φαινόταν καθόλου.
     */
    it('🔴 hover ΠΑΝΩ ΣΤΗΝ ΕΝΕΡΓΗ: το ενεργό γέμισμα ΜΕΝΕΙ και η σκιά μπαίνει από πάνω', () => {
      const { rc, log } = fakeContext(4);
      stampTableIndicator(rc, {
        columns: [tick('A', 0, 20), tick('B', 20, 30, true, true)],
        rows: ROWS,
        widthMm: 50,
        heightMm: 18,
        corner: NO_CORNER,
      });
      const activeAt = log.fills.indexOf(TABLE_INDICATOR.activeFillHex);
      const washAt = log.fills.indexOf(TABLE_INDICATOR.hoverWashRgba);
      expect(activeAt).toBeGreaterThanOrEqual(0);
      expect(washAt).toBeGreaterThan(activeAt);
      // Και η ετικέτα κρατά το **λευκό** της ενεργής: το hover δεν αλλάζει «πού πάει το πλήκτρο».
      expect(log.texts.find((p) => p.text === 'B')?.color).toBe(TABLE_INDICATOR.activeTextHex);
    });

    it('🔴 LOD: κάτω από το κατώφλι δεν υπάρχει ούτε πλύσιμο — δεν φωτίζεται ό,τι δεν φαίνεται', () => {
      const { rc, log } = fakeContext(0.2);
      stampTableIndicator(rc, {
        columns: [tick('A', 0, 20, false, true)],
        rows: ROWS,
        widthMm: 50,
        heightMm: 18,
        corner: NO_CORNER,
      });
      expect(log.fills).toHaveLength(0);
    });
  });

  /**
   * 🔴 ADR-739 §43 — **ΤΟ ΚΟΥΜΠΙ «ΕΠΙΛΟΓΗ ΟΛΩΝ»**.
   *
   * Ελέγχεται το **σχήμα** και όχι μόνο το χρώμα: ένα τρίγωνο που ζωγραφίζεται με τη σωστή
   * μπογιά αλλά τέσσερις κορυφές (δηλαδή ορθογώνιο) θα περνούσε κάθε έλεγχο χρώματος και θα
   * έδειχνε ένα συμπαγές τετράγωνο στην οθόνη.
   */
  describe('§43 — η γωνία «επιλογή όλων»', () => {
    /** Η **τελευταία** διαδρομή με ακριβώς 3 κορυφές — το τρίγωνο, ό,τι κι αν έχει βαφτεί πριν. */
    const triangleOf = (log: PaintLog) =>
      log.fillPaths.find((f) => f.subpaths.length === 1 && f.subpaths[0].length === 3);

    it('🔴 ζωγραφίζει ΤΡΙΓΩΝΟ — τρεις κορυφές, μία υποδιαδρομή', () => {
      const { rc, log } = fakeContext(4);
      stampTableIndicator(rc, {
        columns: COLUMNS,
        rows: ROWS,
        widthMm: 50,
        heightMm: 18,
        corner: NO_CORNER,
      });
      expect(triangleOf(log)).toBeDefined();
    });

    /**
     * ⚠️ §41.7 — **δεν αντιγράφουμε το πράσινο `#217346` του Excel**: αντιγράφουμε τον κανόνα
     * «η γωνία φοράει ό,τι φοράει μια υποδιαίρεση». Άρα το μελάνι του τριγώνου οφείλει να είναι
     * **κυριολεκτικά** το ίδιο με το μελάνι ενός γράμματος — όχι ένα τέταρτο hex που τυχαίνει
     * να ταιριάζει σήμερα.
     */
    it('🔴 σε ηρεμία: κουτί ουδέτερο + τρίγωνο στο ΙΔΙΟ μελάνι με ένα γράμμα', () => {
      const { rc, log } = fakeContext(4);
      stampTableIndicator(rc, {
        columns: COLUMNS,
        rows: ROWS,
        widthMm: 50,
        heightMm: 18,
        corner: NO_CORNER,
      });
      expect(log.fills[0]).toBe(TABLE_INDICATOR.fillHex);
      expect(triangleOf(log)?.color).toBe(TABLE_INDICATOR.textHex);
    });

    it('🔴 όλα επιλεγμένα: κουτί ΕΝΕΡΓΟ + τρίγωνο στο μελάνι της ενεργής ετικέτας', () => {
      const { rc, log } = fakeContext(4);
      stampTableIndicator(rc, {
        columns: COLUMNS,
        rows: ROWS,
        widthMm: 50,
        heightMm: 18,
        corner: { active: true, hovered: false },
      });
      expect(log.fills[0]).toBe(TABLE_INDICATOR.activeFillHex);
      expect(triangleOf(log)?.color).toBe(TABLE_INDICATOR.activeTextHex);
    });

    it('hover ⇒ το ΙΔΙΟ πλύσιμο με τις υποδιαιρέσεις, ούτε τρίτο χρώμα ούτε δεύτερος κανόνας', () => {
      const { rc, log } = fakeContext(4);
      stampTableIndicator(rc, {
        columns: COLUMNS,
        rows: ROWS,
        widthMm: 50,
        heightMm: 18,
        corner: { active: false, hovered: true },
      });
      expect(log.fills.filter((f) => f === TABLE_INDICATOR.hoverWashRgba)).toHaveLength(1);
    });

    it('κάτω από το LOD δεν ζωγραφίζεται ΤΙΠΟΤΑ — ούτε το κουμπί', () => {
      const { rc, log } = fakeContext(0.5);
      stampTableIndicator(rc, {
        columns: COLUMNS,
        rows: ROWS,
        widthMm: 50,
        heightMm: 18,
        corner: { active: true, hovered: true },
      });
      expect(log.fills).toHaveLength(0);
    });
  });

});
