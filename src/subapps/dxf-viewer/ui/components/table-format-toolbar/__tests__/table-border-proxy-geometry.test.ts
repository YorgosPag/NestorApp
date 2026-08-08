/**
 * ADR-750 Φ6 — **η γεωμετρία της ζώνης**: πού είναι κάθε γραμμή, και ποια εννοεί ένα κλικ.
 *
 * Καθαρή αριθμητική, χωρίς render: το `getBoundingClientRect` του jsdom επιστρέφει μηδενικά,
 * οπότε ένα test «κλικ στη ζώνη» μέσα από το component θα επαλήθευε **τον φύλακα**, όχι τον
 * κανόνα. Ο κανόνας δοκιμάζεται εδώ, στο επίπεδο όπου ζει.
 */

import {
  TABLE_BORDER_PROXY_BOX,
  nearestTableBorderDialogPosition,
  tableBorderProxyLine,
  tableBorderProxyLineLength,
} from '../format-cells-dialog/table-border-proxy-geometry';
import {
  TABLE_BORDER_DIALOG_POSITIONS,
  type TableBorderDialogPositionId,
} from '@/subapps/dxf-viewer/bim/table/table-border-dialog-positions';

const { width: W, height: H } = TABLE_BORDER_PROXY_BOX;
const ALL = TABLE_BORDER_DIALOG_POSITIONS;
/** Ένα κελί: καμία «μεσαία» γραμμή δεν υπάρχει (δες `isTableBorderDialogPositionAvailable`). */
const SINGLE_CELL: readonly TableBorderDialogPositionId[] = ALL.filter(
  (id) => id !== 'insideH' && id !== 'insideV',
);

describe('η γεωμετρία', () => {
  it('κάθε θέση έχει τμήμα, και κανένα δεν είναι εκφυλισμένο', () => {
    for (const id of ALL) {
      expect(tableBorderProxyLineLength(id)).toBeGreaterThan(0);
    }
  });

  it('οι τέσσερις πλευρές αγγίζουν τα άκρα του κουτιού', () => {
    expect(tableBorderProxyLine('top')).toEqual({ x1: 0, y1: 0, x2: W, y2: 0 });
    expect(tableBorderProxyLine('bottom')).toEqual({ x1: 0, y1: H, x2: W, y2: H });
    expect(tableBorderProxyLine('left')).toEqual({ x1: 0, y1: 0, x2: 0, y2: H });
    expect(tableBorderProxyLine('right')).toEqual({ x1: W, y1: 0, x2: W, y2: H });
  });

  it('οι διαγώνιοι είναι μακρύτερες από κάθε πλευρά — γι\' αυτό το μοτίβο κλιμακώνεται ανά θέση', () => {
    expect(tableBorderProxyLineLength('diagonal:down')).toBeGreaterThan(
      tableBorderProxyLineLength('top'),
    );
  });
});

describe('ποια θέση εννοεί το κλικ', () => {
  it('κοντά στην πάνω ακμή ⇒ «πάνω»', () => {
    expect(nearestTableBorderDialogPosition({ x: W * 0.25, y: 1 }, ALL)).toBe('top');
  });

  it('κοντά στην κάτω ακμή ⇒ «κάτω»', () => {
    expect(nearestTableBorderDialogPosition({ x: W * 0.75, y: H - 1 }, ALL)).toBe('bottom');
  });

  it('κοντά στην αριστερή ακμή ⇒ «αριστερά»', () => {
    expect(nearestTableBorderDialogPosition({ x: 1, y: H * 0.25 }, ALL)).toBe('left');
  });

  it('πάνω στη μεσαία οριζόντια ⇒ «εσωτερική οριζόντια»', () => {
    // Στο ίδιο ύψος με τη μεσαία, αλλά μακριά από τη μεσαία κάθετη και από τις διαγωνίους.
    expect(nearestTableBorderDialogPosition({ x: W * 0.18, y: H / 2 }, ALL)).toBe('insideH');
  });

  it('🔴 σε ΕΝΑ κελί η μεσαία δεν είναι υποψήφια — το κλικ πάει στην επόμενη πλησιέστερη', () => {
    const answer = nearestTableBorderDialogPosition({ x: W * 0.18, y: H / 2 }, SINGLE_CELL);
    expect(answer).not.toBe('insideH');
    expect(answer).not.toBeNull();
    expect(SINGLE_CELL).toContain(answer);
  });

  it('πάνω στη διαγώνιο ↘, μακριά από κάθε ακμή ⇒ «διαγώνιος προς τα κάτω»', () => {
    expect(nearestTableBorderDialogPosition({ x: W * 0.3, y: H * 0.3 }, SINGLE_CELL))
      .toBe('diagonal:down');
  });

  it('πάνω στη διαγώνιο ↗ ⇒ «διαγώνιος προς τα πάνω»', () => {
    expect(nearestTableBorderDialogPosition({ x: W * 0.3, y: H * 0.7 }, SINGLE_CELL))
      .toBe('diagonal:up');
  });

  it('χωρίς καμία υποψήφια ⇒ `null`, ποτέ μαντεψιά', () => {
    expect(nearestTableBorderDialogPosition({ x: 1, y: 1 }, [])).toBeNull();
  });

  it('ισοπαλία ⇒ ντετερμινιστικά η πρώτη κατά σειρά μητρώου', () => {
    // Το ακριβές κέντρο: μεσαίες και διαγώνιοι απέχουν όλες μηδέν.
    const answer = nearestTableBorderDialogPosition({ x: W / 2, y: H / 2 }, ALL);
    expect(answer).toBe(ALL.find((id) => id === 'insideH'));
  });
});
