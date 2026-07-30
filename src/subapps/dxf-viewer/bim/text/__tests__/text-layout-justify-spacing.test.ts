/**
 * ADR-635 Φ C.21 (Δ) — ΜΙΑ ΤΕΝΤΩΜΕΝΗ ΓΡΑΜΜΗ ΠΡΕΠΕΙ ΝΑ ΚΡΑΤΑΕΙ ΤΟ ΔΙΑΣΤΙΧΟ ΤΗΣ.
 *
 * ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (βρέθηκε 2026-07-30 στο audit του ADR-737 §11-2): το `stretchLine`
 * (`text-layout-justify.ts`) ξαναέχτιζε τη γραμμή **κυριολεκτικά**:
 *
 *     return { spans: out, widthWorld: width, xOffsetWorld: line.xOffsetWorld };
 *
 * Το `spacingRatio` — που προστέθηκε στο `TextLayoutLine` από το Φ C.21 (Δ) — **έλειπε**. Άρα
 * κάθε γραμμή παραγράφου με πλήρη στοίχιση (`\pxqj` / `\pxqd`, εκτός της τελευταίας) έβγαινε
 * με `spacingRatio === undefined`.
 *
 * ΓΙΑΤΙ ΕΙΝΑΙ ΣΟΒΑΡΟ (δεν είναι καλλωπισμός): και οι ΔΥΟ καταναλωτές πολλαπλασιάζουν αυτό το
 * πεδίο για να βρουν το y της γραμμής —
 *   • `TextRenderer.paintLayoutLines`  → `y += line.spacingRatio * screenHeight`
 *   • `explode-text.explodeTextEntity` → `y += line.spacingRatio * height`
 * — και το `totalExtraLineRatio` το αθροίζει για να τοποθετήσει την ΠΡΩΤΗ γραμμή. `undefined * n`
 * είναι **NaN**, το NaN μολύνει το άθροισμα, και ο καμβάς αγνοεί σιωπηλά κάθε συντεταγμένη NaN:
 * ολόκληρο το MTEXT **εξαφανίζεται** αντί να ζωγραφιστεί λίγο πιο πάνω/κάτω.
 *
 * Ο compiler ΔΕΝ το έπιασε: το `src/subapps/dxf-viewer/**` είναι εκτός του root `tsconfig.json`
 * (CHECK 3.29 / ADR-663), οπότε το «λείπει υποχρεωτικό πεδίο» δεν είχε ποιος να το δει.
 *
 * Τα tests εδώ τρέχουν τον ΠΡΑΓΜΑΤΙΚΟ αγωγό (tokenizer → parser → `layoutTextBlock`) — καμία
 * χειροποίητη γραμμή, κανένα πείραγμα δεδομένων για να μπούμε στη διαδρομή.
 */
import { layoutTextBlock, totalExtraLineRatio } from '../text-layout';
import { tokenizeMtext } from '../../../text-engine/parser/mtext-tokenizer';
import { parseMtext } from '../../../text-engine/parser/mtext-parser';
import type { DxfText } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { DxfTextNode } from '../../../text-engine/types';

const H = 10;
/** Αρκετά στενή στήλη ώστε το σώμα να αναδιπλωθεί σε ≥3 οπτικές γραμμές. */
const FRAME = 120;
/** Πολλές λέξεις + εσωτερικά κενά: το τέντωμα χρειάζεται διάκενα για να δουλέψει. */
const BODY = 'ΑΛΦΑ ΒΗΤΑ ΓΑΜΜΑ ΔΕΛΤΑ ΕΨΙΛΟΝ ΖΗΤΑ ΗΤΑ ΘΗΤΑ ΙΩΤΑ ΚΑΠΠΑ ΛΑΜΔΑ ΜΙ ΝΙ ΞΙ';

function node(raw: string): DxfTextNode {
  return parseMtext(tokenizeMtext(raw), { height: H });
}

function text(over: Partial<DxfText>): DxfText {
  return {
    id: 't', type: 'text', visible: true, position: { x: 0, y: 0 }, text: '', height: H, ...over,
  } as DxfText;
}

/** Το ίδιο `layoutTextBlock` που καλούν renderer / explode / κουτί. */
function layoutOf(raw: string) {
  return layoutTextBlock(text({ textNode: node(raw), width: FRAME }), H, {});
}

describe('ADR-635 Φ C.21 (Δ) — πλήρης στοίχιση ΔΕΝ καταπίνει το διάστιχο', () => {
  it('η πλήρης στοίχιση όντως τεντώνει (αλλιώς το test παρακάτω δεν αποδεικνύει τίποτα)', () => {
    const plain = layoutOf(BODY);
    const justified = layoutOf(`\\pxqj;${BODY}`);
    expect(justified.length).toBeGreaterThan(1);
    expect(justified.length).toBe(plain.length);
    // Τουλάχιστον μία γραμμή (όχι η τελευταία) πλάτυνε ώς τη στήλη — δηλαδή πέρασε από το
    // `stretchLine`, τη συνάρτηση που έχανε το πεδίο.
    const widened = justified.filter((l, i) => i < justified.length - 1
      && l.widthWorld > plain[i].widthWorld);
    expect(widened.length).toBeGreaterThan(0);
  });

  it.each([
    ['χωρίς ρητό \\ps', `\\pxqj;${BODY}`],
    ['με \\psm1.5 (μη προεπιλεγμένο διάστιχο)', `\\pxqj;\\psm1.5;${BODY}`],
  ])('%s — ΚΑΘΕ γραμμή κρατά πεπερασμένο spacingRatio', (_label, raw) => {
    for (const line of layoutOf(raw)) {
      expect(line.spacingRatio).toBeDefined();
      expect(Number.isFinite(line.spacingRatio)).toBe(true);
    }
  });

  it('το διάστιχο των τεντωμένων γραμμών ταυτίζεται με το ΑΣΤΟΙΧΙΣΤΟ ίδιο κείμενο', () => {
    // Η στοίχιση είναι ΟΡΙΖΟΝΤΙΑ απόφαση — δεν επιτρέπεται να μετακινήσει τίποτα κατακόρυφα.
    const plain = layoutOf(`\\psm1.5;${BODY}`);
    const justified = layoutOf(`\\pxqj;\\psm1.5;${BODY}`);
    expect(justified.map(l => l.spacingRatio)).toEqual(plain.map(l => l.spacingRatio));
  });

  it('το άθροισμα που τοποθετεί ΤΗΝ ΠΡΩΤΗ γραμμή μένει αριθμός (όχι NaN)', () => {
    // Αυτό ακριβώς περνά στο `resolveMultilineExtentsFromExtra` σε renderer ΚΑΙ explode· ένα
    // NaN εδώ κάνει ΟΛΟ το μπλοκ να μη ζωγραφιστεί, όχι απλώς μια γραμμή να πέσει λάθος.
    const extra = totalExtraLineRatio(layoutOf(`\\pxqj;\\psm1.5;${BODY}`));
    expect(Number.isNaN(extra)).toBe(false);
    expect(extra).toBeGreaterThan(0);
  });
});
