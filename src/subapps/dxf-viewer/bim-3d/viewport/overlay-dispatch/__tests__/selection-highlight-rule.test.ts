/**
 * ADR-717 v4 — το selection highlight του raw-DXF στο 3D: ο κανόνας ΚΑΙ η σύνθεση της λάμψης.
 *
 * Γιατί έχει δικά του anchors: αυτή η μία περιοχή αστόχησε ΤΡΕΙΣ φορές μέσα σε μία συνεδρία, και
 * ΚΑΘΕ λάθος εκδοχή ήταν άμεσα ορατή στον χρήστη ως **αλλοιωμένο χρώμα οντότητας** — δηλαδή ως
 * απώλεια πληροφορίας (το χρώμα DXF layer είναι δεδομένο: επίπεδο, υλικό, σύμβαση σχεδίου):
 *
 *   v1 «πάντα αναμμένο»            → κάθε επιλεγμένη οντότητα βαφόταν μπλε·
 *   v2 «πρόβλεψη του GRIPOBJLIMIT» → λαβές ΚΑΙ μπλε βαφή ΤΑΥΤΟΧΡΟΝΑ·
 *   v3 «κατάσταση των λαβών»       → ΑΚΟΜΗ μπλε, χωρίς διάγνωση.
 *
 * Και οι τρεις κυνήγησαν λάθος μεταβλητή. Το ελάττωμα δεν ήταν ΠΟΤΕ **πότε** ανάβει το highlight —
 * ήταν ότι ζωγράφιζε **ΠΑΝΩ** στη γραμμή. Οι μεγάλοι παίκτες (AutoCAD `SELECTIONEFFECT`, ArchiCAD
 * bold contours, Revit outline, Figma outline) προσθέτουν λάμψη **ΓΥΡΩ** και δεν ρωτούν ποτέ τις
 * λαβές. Τα anchors παρακάτω κλειδώνουν και τα δύο σκέλη:
 *
 *   §1 ο κανόνας ΔΕΝ έχει προϋποθέσεις (κάθε νέο gate σπάει θορυβωδώς)·
 *   §2 η λάμψη ΤΡΥΠΑΕΙ τον πυρήνα της (το χρώμα layer επιβιώνει ΑΠΟΔΕΔΕΙΓΜΕΝΑ, όχι κατ' ισχυρισμό).
 */

import {
  shouldShowSelectionHighlight,
  selectionSignature,
  paintSelectionHalo,
  SELECTION_HALO_LAYERS,
  SELECTION_HALO_CORE_PX,
} from '../use-selection-glow-pass';
import type { Point2D } from '../../../../rendering/types/Types';

// ── §1 — ο κανόνας ────────────────────────────────────────────────────────────

describe('shouldShowSelectionHighlight (ADR-717 v4 — κανάλι χωρίς προϋποθέσεις)', () => {
  it('ΚΑΜΙΑ επιλογή ⇒ σβηστό', () => {
    expect(shouldShowSelectionHighlight(0)).toBe(false);
  });

  it('ΜΙΑ επιλεγμένη ⇒ ΑΝΑΜΜΕΝΟ', () => {
    expect(shouldShowSelectionHighlight(1)).toBe(true);
  });

  it('ΠΟΛΛΕΣ επιλεγμένες ⇒ ΑΝΑΜΜΕΝΟ — ΙΔΙΑ συμπεριφορά με τη μία (καμία ασυνέπεια 1↔N)', () => {
    expect(shouldShowSelectionHighlight(4)).toBe(shouldShowSelectionHighlight(1));
    expect(shouldShowSelectionHighlight(250)).toBe(true);
  });

  it('πάνω από το GRIPOBJLIMIT ⇒ ΑΝΑΜΜΕΝΟ — εκεί οι λαβές σβήνουν και μένει μόνο αυτό', () => {
    expect(shouldShowSelectionHighlight(5000)).toBe(true);
  });

  it('ΔΕΝ δέχεται δεύτερο κριτήριο: κάθε νέο gate (λαβές / BIM / κατώφλι) σπάει ΕΔΩ', () => {
    // Η αστοχία των v1–v3 δεν ήταν λάθος τιμή — ήταν η ΥΠΑΡΞΗ κριτηρίου. Το arity είναι το
    // συμβόλαιο: ένα κανάλι «τι κρατάω» ρωτά ΜΟΝΟ αν κρατάω κάτι.
    expect(shouldShowSelectionHighlight).toHaveLength(1);
  });
});

// ── §2 — η σύνθεση της λάμψης ─────────────────────────────────────────────────

/** Ένα στιγμιότυπο της κατάστασης του ctx τη στιγμή ΕΝΟΣ `stroke()`. */
interface StrokeSnapshot {
  readonly lineWidth: number;
  readonly globalAlpha: number;
  readonly composite: string;
}

interface FakeCtx {
  readonly ctx: CanvasRenderingContext2D;
  readonly strokes: StrokeSnapshot[];
  /** Πόσες φορές χαράχτηκε νέο path — ένα ανά πινελιά, ποτέ λιγότερα (αλλιώς διπλο-stroke). */
  readonly pathCount: () => number;
  readonly finalComposite: () => string;
}

function createFakeCtx(): FakeCtx {
  const strokes: StrokeSnapshot[] = [];
  let paths = 0;
  const state = {
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    strokeStyle: '',
    lineJoin: '',
    lineCap: '',
    beginPath: () => { paths++; },
    moveTo: () => undefined,
    lineTo: () => undefined,
    setLineDash: () => undefined,
    stroke: () => {
      strokes.push({
        lineWidth: state.lineWidth,
        globalAlpha: state.globalAlpha,
        composite: state.globalCompositeOperation,
      });
    },
  };
  return {
    ctx: state as unknown as CanvasRenderingContext2D,
    strokes,
    pathCount: () => paths,
    finalComposite: () => state.globalCompositeOperation,
  };
}

const SQUARE: Point2D[][] = [[{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }]];

describe('SELECTION_HALO_LAYERS — το προφίλ της λάμψης', () => {
  it('φθίνον πλάτος από έξω προς τα μέσα (αλλιώς δεν είναι βαθμίδα, είναι θόρυβος)', () => {
    const widths = SELECTION_HALO_LAYERS.map((l) => l.widthPx);
    expect(widths).toEqual([...widths].sort((a, b) => b - a));
    expect(new Set(widths).size).toBe(widths.length);
  });

  it('αύξουσα αδιαφάνεια προς τα μέσα — η λάμψη σβήνει προς τα έξω, όχι προς τα μέσα', () => {
    const alphas = SELECTION_HALO_LAYERS.map((l) => l.alpha);
    expect(alphas).toEqual([...alphas].sort((a, b) => a - b));
    expect(alphas.every((a) => a > 0 && a < 1)).toBe(true);
  });

  it('ΚΑΘΕ στρώση πλατύτερη από τον πυρήνα — αλλιώς η τρύπα την καταπίνει και πληρώνεται τζάμπα', () => {
    for (const layer of SELECTION_HALO_LAYERS) {
      expect(layer.widthPx).toBeGreaterThan(SELECTION_HALO_CORE_PX);
    }
  });

  it('ο πυρήνας είναι πλατύτερος από την 1px γραμμή του LineBasicMaterial (anti-aliased άκρα)', () => {
    expect(SELECTION_HALO_CORE_PX).toBeGreaterThan(1);
  });
});

describe('paintSelectionHalo — η λάμψη ΤΡΥΠΑΕΙ τη γραμμή, δεν τη βάφει', () => {
  it('μία πινελιά ανά στρώση + ΜΙΑ τρύπα, κάθε μία με δικό της path', () => {
    const fake = createFakeCtx();
    paintSelectionHalo(fake.ctx, SQUARE);
    expect(fake.strokes).toHaveLength(SELECTION_HALO_LAYERS.length + 1);
    expect(fake.pathCount()).toBe(SELECTION_HALO_LAYERS.length + 1);
  });

  it('οι στρώσεις ζωγραφίζουν κανονικά (source-over) με το πλάτος/alpha του προφίλ', () => {
    const fake = createFakeCtx();
    paintSelectionHalo(fake.ctx, SQUARE);
    const layers = fake.strokes.slice(0, SELECTION_HALO_LAYERS.length);
    expect(layers.map((s) => ({ widthPx: s.lineWidth, alpha: s.globalAlpha })))
      .toEqual(SELECTION_HALO_LAYERS.map((l) => ({ widthPx: l.widthPx, alpha: l.alpha })));
    expect(layers.every((s) => s.composite === 'source-over')).toBe(true);
  });

  it('η ΤΕΛΕΥΤΑΙΑ πινελιά είναι destination-out, alpha 1, στο πλάτος του πυρήνα', () => {
    // Αυτό ΕΙΝΑΙ η απόδειξη ότι το χρώμα layer επιβιώνει: το WebGL φαίνεται μέσα από την τρύπα.
    // alpha < 1 θα άφηνε μπλε πέπλο — δηλαδή ακριβώς το σφάλμα των v1–v3.
    const fake = createFakeCtx();
    paintSelectionHalo(fake.ctx, SQUARE);
    const punch = fake.strokes[fake.strokes.length - 1];
    expect(punch.composite).toBe('destination-out');
    expect(punch.globalAlpha).toBe(1);
    expect(punch.lineWidth).toBe(SELECTION_HALO_CORE_PX);
  });

  it('επαναφέρει το composite σε source-over — αλλιώς το επόμενο pass του dispatch θα ΕΣΒΗΝΕ', () => {
    // Ο καμβάς είναι ΚΟΙΝΟΣ (ADR-555): hover-glow / λαβές / HUD ζωγραφίζουν ΜΕΤΑ από εμάς.
    const fake = createFakeCtx();
    paintSelectionHalo(fake.ctx, SQUARE);
    expect(fake.finalComposite()).toBe('source-over');
  });

  it('κενή επιλογή ⇒ ΚΑΜΙΑ πινελιά (καμία περιττή δουλειά στον κοινό καμβά)', () => {
    const fake = createFakeCtx();
    paintSelectionHalo(fake.ctx, []);
    expect(fake.strokes).toHaveLength(0);
    expect(fake.pathCount()).toBe(0);
  });
});

// ── §3 — invalidation του cache ───────────────────────────────────────────────

describe('selectionSignature — invalidation του cache περιγραμμάτων', () => {
  it('ΑΛΛΗ ΣΕΙΡΑ = ΑΛΛΗ ταυτότητα (η σειρά καθορίζει το primary id, ADR-543)', () => {
    expect(selectionSignature(['a', 'b'])).not.toBe(selectionSignature(['b', 'a']));
  });

  it('ίδια ids ⇒ ίδια ταυτότητα ⇒ το cache επιβιώνει (καμία re-tessellation ανά frame)', () => {
    expect(selectionSignature(['a', 'b'])).toBe(selectionSignature(['a', 'b']));
  });

  it('προσθήκη/αφαίρεση αλλάζει την ταυτότητα ⇒ το cache πέφτει', () => {
    expect(selectionSignature(['a'])).not.toBe(selectionSignature(['a', 'b']));
    expect(selectionSignature([])).not.toBe(selectionSignature(['a']));
  });
});
