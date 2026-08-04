/**
 * ADR-753 Φ4 — anchorOffset: ο ΕΝΑΣ κανόνας «πού ξεκινούν τα γράμματα σχετικά με την άγκυρα».
 *
 * ⚠️ Οι αξιώσεις εδώ είναι **σημασιολογικές**, όχι αντιγραφή του τύπου. Το μάθημα του ADR-753
 * §8 (και του ελαττώματος υπογράμμισης του ADR-739 Φ.Ε): ένα test που ξαναγράφει
 * `right → -advance` κλειδώνει τη ΣΥΜΠΕΡΙΦΟΡΑ χωρίς να τη διασταυρώνει με το νόημα — αν ο
 * κώδικας και το test αλλάξουν μαζί, μένει πράσινο ενώ η οθόνη είναι λάθος. Εδώ ρωτάμε τι
 * ΣΗΜΑΙΝΕΙ κάθε αγκύρωση: αριστερά ⇒ το κείμενο **αρχίζει** στην άγκυρα· δεξιά ⇒ **τελειώνει**
 * στην άγκυρα· κέντρο ⇒ το **μέσο** του κάθεται στην άγκυρα.
 */

import { anchorOffset, entityAlignmentToAnchor, type HorizontalTextAnchor } from '../text-horizontal-anchor';

const ANCHORS: readonly HorizontalTextAnchor[] = ['left', 'center', 'right'];

/** Το κλειστό διάστημα που καταλαμβάνει ένα run πλάτους `w`, σχετικά με την άγκυρα (=0). */
function runExtent(anchor: HorizontalTextAnchor, w: number): { start: number; end: number } {
  const start = anchorOffset(anchor, w);
  return { start, end: start + w };
}

describe('anchorOffset — το νόημα κάθε αγκύρωσης', () => {
  const W = 37.5; // μη στρογγυλό επίτηδες: ένα «/2» που έγινε «/1» ή «*2» δεν κρύβεται

  it("'left': το κείμενο ΑΡΧΙΖΕΙ πάνω στην άγκυρα", () => {
    expect(runExtent('left', W).start).toBe(0);
  });

  it("'right': το κείμενο ΤΕΛΕΙΩΝΕΙ πάνω στην άγκυρα", () => {
    expect(runExtent('right', W).end).toBe(0);
  });

  it("'center': το ΜΕΣΟ του κειμένου κάθεται πάνω στην άγκυρα", () => {
    const { start, end } = runExtent('center', W);
    expect((start + end) / 2).toBe(0);
  });

  it("'center': ίση προεξοχή αριστερά και δεξιά της άγκυρας", () => {
    const { start, end } = runExtent('center', W);
    expect(-start).toBeCloseTo(end, 12);
  });

  it('κάθε αγκύρωση αποδίδει run ΑΚΡΙΒΩΣ πλάτους `advance` — μόνο η θέση αλλάζει', () => {
    for (const a of ANCHORS) {
      const { start, end } = runExtent(a, W);
      expect(end - start).toBeCloseTo(W, 12);
    }
  });

  it('οι τρεις αγκυρώσεις είναι ΔΙΑΚΡΙΤΕΣ για μη μηδενικό πλάτος', () => {
    const offsets = ANCHORS.map((a) => anchorOffset(a, W));
    expect(new Set(offsets).size).toBe(3);
  });

  it("διάταξη σε LTR: right ≤ center ≤ left (το δεξιά-αγκυρωμένο κείμενο ξεκινά πιο αριστερά)", () => {
    expect(anchorOffset('right', W)).toBeLessThan(anchorOffset('center', W));
    expect(anchorOffset('center', W)).toBeLessThan(anchorOffset('left', W));
  });
});

describe('anchorOffset — αδιάστατο: px, κόσμος και mm από την ΙΔΙΑ συνάρτηση', () => {
  it('ομογενές πρώτου βαθμού: αλλαγή μονάδας = πολλαπλασιασμός του αποτελέσματος', () => {
    // Αυτό ΕΙΝΑΙ η άδεια να το καλούν τρία πλαίσια συντεταγμένων. Αν πάψει να ισχύει (π.χ.
    // μπει σταθερά/στρογγυλοποίηση), η μετατροπή στον καλούντα παύει να είναι ισοδύναμη.
    const scale = 2.54; // mm → μια οποιαδήποτε άλλη μονάδα
    for (const a of ANCHORS) {
      expect(anchorOffset(a, 10 * scale)).toBeCloseTo(anchorOffset(a, 10) * scale, 12);
    }
  });

  it('μηδενικό πλάτος → μηδενική μετατόπιση σε κάθε αγκύρωση (εκφυλισμένο run)', () => {
    // `Math.abs` επίτηδες: το `-advance/2` με `advance = 0` δίνει IEEE **−0**, όπως έδινε και ο
    // παλιός ενσωματωμένος κώδικας. Ουδέτερο σε κάθε πράξη — μόνο το `Object.is` το ξεχωρίζει.
    for (const a of ANCHORS) expect(Math.abs(anchorOffset(a, 0))).toBe(0);
  });
});

describe('entityAlignmentToAnchor — η ΜΙΑ απάντηση για το «justify»', () => {
  it("'justify' → 'left': το πλήρως στοιχισμένο κείμενο γεμίζει τη στήλη από την αριστερή ακμή", () => {
    expect(entityAlignmentToAnchor('justify')).toBe('left');
  });

  it('undefined → left (προεπιλογή DXF: απούσα ομάδα 72)', () => {
    expect(entityAlignmentToAnchor(undefined)).toBe('left');
  });

  it('οι τρεις κανονικές τιμές περνούν αυτούσιες', () => {
    for (const a of ANCHORS) expect(entityAlignmentToAnchor(a)).toBe(a);
  });

  it('η αποκοπή στην οθόνη και η εξαγωγή PDF παίρνουν την ΙΔΙΑ απάντηση', () => {
    // Το `clip-entity` και το `scene-vector-emitter` καλούν αυτή τη συνάρτηση. Η αξίωση δεν
    // είναι η τιμή — είναι ότι υπάρχει **μία** συνάρτηση να διαφωνήσει με τον εαυτό της.
    const inputs = ['left', 'center', 'right', 'justify', undefined] as const;
    for (const v of inputs) expect(entityAlignmentToAnchor(v)).toBe(entityAlignmentToAnchor(v));
    expect(inputs.map(entityAlignmentToAnchor)).toEqual(['left', 'center', 'right', 'left', 'left']);
  });
});
