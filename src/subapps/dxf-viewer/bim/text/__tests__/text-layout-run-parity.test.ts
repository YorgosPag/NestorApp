/**
 * ADR-635 Φ C.21 — ΙΣΟΤΙΜΙΑ ΜΕΤΡΗΣΗΣ/ΒΑΦΗΣ ΑΝΑ RUN.
 *
 * ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (Giorgio 2026-07-29, `47_ergasia.dxf`): λέξεις που στο AutoCAD είναι
 * χωριστές εμφανίζονταν κολλημένες (`ΦΕΚ405`, `Αναθεώρησητου`), το κείμενο ξεχείλιζε από τη
 * δεξιά πλευρά της στήλης, και ΟΛΟ το μπλοκ φαινόταν έντονο (bold) + υπογραμμισμένο ενώ στο
 * AutoCAD μόνο ο τίτλος είναι.
 *
 * ΜΙΑ ΑΙΤΙΑ ΓΙΑ ΟΛΑ: το `TextLayoutSpan` κρατούσε τα `bold`/`italic`/`fontFamily` **μόνο όταν
 * ήταν αληθή** (`...(piece.style.bold ? { bold: true } : {})`). Έτσι το «ρητά ΨΕΥΔΕΣ» και το
 * «δεν δηλώθηκε» γίνονταν το ίδιο πράγμα (`undefined`), και ο renderer έπεφτε πίσω στο στυλ
 * του **μπλοκ** (`span.bold ?? richStyle.bold`). Το μπλοκ style είναι το στυλ του ΠΡΩΤΟΥ run —
 * στο δείγμα `bold:true, underline:true`. Αποτέλεσμα: η διάταξη **μετρούσε** κανονικά (b0) και
 * ο renderer **έβαφε** έντονα (b1) ⇒ κάθε span ζωγραφιζόταν πλατύτερο απ' όσο μετρήθηκε ⇒
 * καβαλούσε το επόμενο (φαινομενικά «χαμένο κενό») και η γραμμή ξεπερνούσε τη στήλη.
 *
 * Η ΘΕΡΑΠΕΙΑ ΕΙΝΑΙ ΔΟΜΙΚΗ, ΟΧΙ ΜΠΑΛΩΜΑ: το span μεταφέρει ΤΟ ΙΔΙΟ αντικείμενο στυλ με το
 * οποίο μετρήθηκε το `widthWorld`, και ο renderer δεν έχει πια σε τι άλλο να πέσει πίσω.
 * Το αναλλοίωτο που το κλειδώνει:
 *
 *     measureTextAdvanceWorld(span.text, span.heightWorld, span.style) === span.widthWorld
 *
 * Αν κάποιος ξαναβάλει «προαιρετικό» πεδίο στυλ στο span, αυτό το test πέφτει.
 */
import { layoutTextBlock, totalExtraLineRatio } from '../text-layout';
import { CHARACTER_METRICS } from '../../../config/text-rendering-config';
import { tokenizeMtext } from '../../../text-engine/parser/mtext-tokenizer';
import { parseMtext } from '../../../text-engine/parser/mtext-parser';
import { measureTextAdvanceWorld } from '../../../text-engine/fonts';
import type { DxfText } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { DxfTextNode } from '../../../text-engine/types';

const H = 10;

/** Το στυλ μπλοκ που παράγει ο `extractFirstRunStyle` για το δείγμα: bold + underline. */
const BLOCK_STYLE_OF_SAMPLE = {
  bold: true, italic: false, underline: true, overline: false, strikethrough: false,
  fontFamily: 'Arial', obliqueAngle: 0, tracking: 1, runColor: '#FFFFFF',
} as const;

function node(raw: string): DxfTextNode {
  return parseMtext(tokenizeMtext(raw), { height: H });
}

function text(over: Partial<DxfText>): DxfText {
  return {
    id: 't', type: 'text', visible: true, position: { x: 0, y: 0 }, text: '', height: H, ...over,
  } as DxfText;
}

// ── 1. Το αναλλοίωτο ισοτιμίας ───────────────────────────────────────────────

describe('Φ C.21 — το span μεταφέρει ΤΟ στυλ της μέτρησής του', () => {
  /** Ακριβώς η ραφή του δείγματος: `…^I^IΦΕΚ \fArial|b0…;405\fArial|b0…;/τ.Δ`. */
  const SEAM = 'Τροποποίηση Ρυμοτομίας^I^I03-08-1985^I^IΦΕΚ '
    + '\\fArial|b0|i0|c0|p34;405\\fArial|b0|i0|c161|p34;/τ.Δ';

  it('κάθε span μετριέται ΞΑΝΑ στο ίδιο πλάτος με το δικό του style', () => {
    const t = text({ textNode: node(SEAM), textStyle: { ...BLOCK_STYLE_OF_SAMPLE } });
    const spans = layoutTextBlock(t, H, { bold: true, fontFamily: 'Arial' }).flatMap(l => l.spans);
    expect(spans.length).toBeGreaterThan(3);
    for (const s of spans) {
      expect(measureTextAdvanceWorld(s.text, s.heightWorld, s.style)).toBeCloseTo(s.widthWorld, 9);
    }
  });

  it('το κενό στη ραφή επιβιώνει ΚΑΙ στο κείμενο ΚΑΙ στη γεωμετρία', () => {
    const t = text({ textNode: node(SEAM) });
    const spans = layoutTextBlock(t, H, {}).flatMap(l => l.spans);
    const fek = spans.find(s => s.text === 'ΦΕΚ ');
    const num = spans.find(s => s.text === '405');
    expect(fek).toBeDefined();
    expect(num).toBeDefined();
    // Το «405» ξεκινά ΜΕΤΑ το πλήρες πλάτος του «ΦΕΚ » (μαζί με το κενό) — όχι πάνω του.
    expect(num!.xWorld).toBeCloseTo(fek!.xWorld + fek!.widthWorld, 9);
    expect(num!.xWorld).toBeGreaterThan(fek!.xWorld + measureTextAdvanceWorld('ΦΕΚ', H, fek!.style));
  });
});

// ── 2. Το bold του πρώτου run ΔΕΝ διαρρέει (η αιτία του ξεχειλίσματος) ────────

describe('Φ C.21 — ρητό b0 νικά το στυλ του μπλοκ', () => {
  it('run με b0 μένει κανονικό ακόμη κι όταν το μπλοκ είναι bold', () => {
    const t = text({
      textNode: node('\\fArial|b1|i0;ΤΙΤΛΟΣ\\fArial|b0|i0;ΣΩΜΑ'),
      textStyle: { ...BLOCK_STYLE_OF_SAMPLE },
    });
    const spans = layoutTextBlock(t, H, { bold: true, fontFamily: 'Arial' }).flatMap(l => l.spans);
    expect(spans.map(s => s.text)).toEqual(['ΤΙΤΛΟΣ', 'ΣΩΜΑ']);
    expect(spans[0].style.bold).toBe(true);
    expect(spans[1].style.bold).toBe(false);
  });

  it('το italic του run περνά αυτούσιο (ίδια κατηγορία λάθους)', () => {
    const spans = layoutTextBlock(
      text({ textNode: node('\\fArial|b0|i1;ΠΛΑΓΙΑ\\fArial|b0|i0;ΟΡΘΙΑ') }), H, { italic: true },
    ).flatMap(l => l.spans);
    expect(spans[0].style.italic).toBe(true);
    expect(spans[1].style.italic).toBe(false);
  });
});

// ── 3. Διακοσμήσεις ΑΝΑ RUN, όχι ανά γραμμή ──────────────────────────────────

describe('Φ C.21 — υπογράμμιση ανά run', () => {
  it('`\\L…\\l` υπογραμμίζει ΜΟΝΟ τον τίτλο', () => {
    const spans = layoutTextBlock(
      text({ textNode: node('\\LΔιάταγμα Ρυμοτομίας\\l 04-04-1979') }), H, {},
    ).flatMap(l => l.spans);
    expect(spans[0].text).toBe('Διάταγμα Ρυμοτομίας');
    expect(spans[0].decoration.underline).toBe(true);
    expect(spans[1].decoration.underline).toBe(false);
  });

  it('overline / strikethrough ταξιδεύουν το ίδιο', () => {
    const spans = layoutTextBlock(
      text({ textNode: node('\\OΑΝΩ\\o\\KΔΙΑΓΡ\\kΑΠΛΟ') }), H, {},
    ).flatMap(l => l.spans);
    expect(spans.map(s => [s.decoration.overline, s.decoration.strikethrough])).toEqual([
      [true, false], [false, true], [false, false],
    ]);
  });

  it('κείμενο ΧΩΡΙΣ AST κληρονομεί τις διακοσμήσεις του μπλοκ (legacy path)', () => {
    const spans = layoutTextBlock(
      text({ text: 'ΑΠΛΟ', textStyle: { underline: true } }), H, {},
    ).flatMap(l => l.spans);
    expect(spans[0].decoration.underline).toBe(true);
  });
});

// ── 4. Στοίχιση παραγράφου `\pxq…` μέσα στη στήλη ────────────────────────────

describe('Φ C.21 — στοίχιση παραγράφου (κωδ. `\\pxq`)', () => {
  /** Αρκετά μεγάλο ώστε να αναδιπλωθεί σε ≥3 γραμμές μέσα στο πλαίσιο. */
  const BODY = 'αλφα βητα γαμμα δελτα epsilon ζητα ητα θητα ιωτα καππα λαμδα μυ νυ ξι ομικρον πι';
  const FRAME = 120;

  function lines(code: string) {
    return layoutTextBlock(text({ textNode: node(`${code}${BODY}`), width: FRAME }), H, {});
  }

  it('αριστερή (προεπιλογή) — καμία μετατόπιση, καμία παλινδρόμηση', () => {
    for (const l of lines('')) expect(l.xOffsetWorld).toBe(0);
  });

  it('`\\pxqc;` κεντράρει ΚΑΘΕ γραμμή στο υπόλοιπο της στήλης', () => {
    const out = lines('\\pxqc;');
    expect(out.length).toBeGreaterThan(1);
    for (const l of out) expect(l.xOffsetWorld).toBeCloseTo((FRAME - l.widthWorld) / 2, 9);
  });

  it('`\\pxqr;` σπρώχνει κάθε γραμμή στο δεξί περιθώριο', () => {
    for (const l of lines('\\pxqr;')) expect(l.xOffsetWorld).toBeCloseTo(FRAME - l.widthWorld, 9);
  });

  it('`\\pxqj;` τεντώνει ΟΛΕΣ τις γραμμές ΕΚΤΟΣ της τελευταίας', () => {
    const out = lines('\\pxqj;');
    expect(out.length).toBeGreaterThan(1);
    out.slice(0, -1).forEach(l => expect(l.widthWorld).toBeCloseTo(FRAME, 6));
    // Ο τυπογραφικός κανόνας: η τελευταία γραμμή μένει αριστερή, δεν απλώνεται στη στήλη.
    expect(out[out.length - 1].widthWorld).toBeLessThan(FRAME);
  });

  it('το τέντωμα ΔΕΝ χάνει και ΔΕΝ αναδιατάσσει κείμενο', () => {
    const flat = (ls: readonly { spans: readonly { text: string }[] }[]) =>
      ls.map(l => l.spans.map(s => s.text).join('')).join('|');
    expect(flat(lines('\\pxqj;'))).toBe(flat(lines('')));
  });

  it('χωρίς στήλη (κωδ. 41 = 0) η στοίχιση παραγράφου δεν έχει νόημα → 0', () => {
    const out = layoutTextBlock(text({ textNode: node(`\\pxqc;${BODY}`) }), H, {});
    for (const l of out) expect(l.xOffsetWorld).toBe(0);
  });
});

// ── 5. Διάστιχο παραγράφου `\ps…` ────────────────────────────────────────────

/**
 * ⚠️ Η ΑΠΟΔΟΣΗ ΤΟΥ ΔΙΑΣΤΙΧΟΥ: το `spacingRatio` μιας γραμμής είναι το βήμα **προς** αυτήν, και
 * το ορίζει η **δική της** παράγραφος — όχι η προηγούμενη. Δεν είναι σύμβαση αυθαιρεσίας: ο
 * τρόπος `at-least` πρέπει να μεγαλώσει ώστε να χωρέσει τον ψηλότερο χαρακτήρα **αυτής** της
 * γραμμής, οπότε καμία άλλη απόδοση δεν είναι καν υπολογίσιμη. Άρα το `\ps…;` γράφεται στην
 * παράγραφο που θέλεις να μετακινήσεις.
 */
describe('Φ C.21 — διάστιχο παραγράφου (κωδ. `\\ps`)', () => {
  const LS = CHARACTER_METRICS.LINE_HEIGHT_RATIO;

  it('το μονό διάστιχο ΕΙΝΑΙ αυτό του AutoCAD (5/3 — DXF κωδ. 44 «3-on-5»)', () => {
    expect(LS).toBeCloseTo(5 / 3, 9);
    const out = layoutTextBlock(text({ textNode: node('Α\\PΒ') }), H, {});
    expect(out[1].spacingRatio).toBeCloseTo(LS, 9);
  });

  it('`\\psm0.9;` φτάνει ΩΣ ΤΗ ΔΙΑΤΑΞΗ — δεν πέφτει πια στον tokenizer', () => {
    const out = layoutTextBlock(text({ textNode: node('\\psm0.9;Α\\PΒ') }), H, {});
    expect(out[1].spacingRatio).toBeCloseTo(LS * 0.9, 9);
  });

  it('ΔΙΑΦΟΡΕΤΙΚΟ διάστιχο ανά παράγραφο μέσα στο ΙΔΙΟ MTEXT', () => {
    // Α+Β στο μονό διάστιχο, Γ στο 1,5 — κάθε δήλωση πάνω στην παράγραφο που μετακινεί.
    const out = layoutTextBlock(text({ textNode: node('\\psm1;Α\\PΒ\\P\\psm1.5;Γ') }), H, {});
    expect(out).toHaveLength(3);
    expect(out[1].spacingRatio).toBeCloseTo(LS, 9);
    expect(out[2].spacingRatio).toBeCloseTo(LS * 1.5, 9);
  });

  it('`\\ps*;` επαναφέρει στην προεπιλογή (δεν κρατά το προηγούμενο)', () => {
    const out = layoutTextBlock(text({ textNode: node('\\psm0.5;Α\\P\\ps*;Β\\PΓ') }), H, {});
    expect(out[2].spacingRatio).toBeCloseTo(LS, 9);
  });

  it('`at-least` μεγαλώνει με το ψηλότερο `\\H` της γραμμής· `exact` δεν το κάνει', () => {
    const tall = '\\H2x;ΨΗΛΟ';
    const atLeast = layoutTextBlock(text({ textNode: node(`Α\\P\\psa1;${tall}`) }), H, {});
    const exact = layoutTextBlock(text({ textNode: node(`Α\\P\\pse1;${tall}`) }), H, {});
    expect(atLeast[1].spacingRatio).toBeCloseTo(LS * 2, 9);
    expect(exact[1].spacingRatio).toBeCloseTo(LS, 9);
  });

  it('το ύψος μπλοκ = ΑΘΡΟΙΣΜΑ των διάστιχων, όχι (πλήθος−1)×σταθερό', () => {
    // Βήματα LS (→Β) και LS×2 (→Γ): το άθροισμα ΔΕΝ είναι (3−1)×LS ούτε 3×LS.
    const out = layoutTextBlock(text({ textNode: node('\\psm1;Α\\PΒ\\P\\psm2;Γ') }), H, {});
    expect(totalExtraLineRatio(out)).toBeCloseTo(LS + LS * 2, 9);
  });
});
