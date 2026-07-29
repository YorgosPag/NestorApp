/**
 * ADR-635 Φ C.20 — πλούσιο MTEXT: χρώμα ανά run, αναδίπλωση στη στήλη (group 41), στηλοθέτες.
 *
 * ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (Giorgio 2026-07-29, `47_ergasia.dxf`): μόλις φάνηκαν τα μεγάλα MTEXT,
 * φάνηκαν και τρία ξεχωριστά σφάλματα μαζί:
 *   1. **όλα κόκκινα** — το inline `\C<n>;` (ACI) αγνοούνταν, νικούσε το group-62 της οντότητας·
 *   2. **καμία αναδίπλωση** — ο κωδικός 41 δεν διαβαζόταν ποτέ, άρα δεν υπήρχε στήλη·
 *   3. **`^I` ως σκουπίδια** — ο tokenizer δεν ήξερε caret notation, τα tab τυπώνονταν.
 *
 * Οι τρεις μοιράζονται ΜΙΑ αιτία: το εισαγόμενο MTEXT ισοπεδωνόταν σε «ένα κείμενο, ένα στυλ,
 * ένα χρώμα». Τα tests εδώ κλειδώνουν τη λύση στο επίπεδο της **διάταξης**, που είναι το κοινό
 * SSoT renderer + κουτιού/λαβών.
 */
import { layoutTextBlock, layoutLineStrings, MTEXT_DEFAULT_TAB_INTERVAL_EM } from '../text-layout';
import { isTextBoxFrameConstrained, effectiveTextWidth } from '../text-box';
import { resolveRunColorHex } from '../../../text-engine/render/run-color';
import { tokenizeMtext } from '../../../text-engine/parser/mtext-tokenizer';
import { parseMtext } from '../../../text-engine/parser/mtext-parser';
import { measureTextAdvanceWorld } from '../../../text-engine/fonts';
import type { DxfText } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { DxfTextNode } from '../../../text-engine/types';

/**
 * Το πλάτος γραμματοσειράς στο jest εξαρτάται από το fallback (καμία φορτωμένη γραμματοσειρά),
 * γι' αυτό ΚΑΘΕ προσδοκία πλάτους παράγεται από την ΙΔΙΑ μέτρηση που χρησιμοποιεί η διάταξη.
 * Σκληροκωδικωμένο «πλάτος χαρακτήρα» θα έκανε το test να μετρά το mock, όχι τη συμπεριφορά.
 */
const H = 10;
const advance = (s: string): number => measureTextAdvanceWorld(s, H, {});

function text(over: Partial<DxfText>): DxfText {
  return { id: 't', type: 'text', visible: true, position: { x: 0, y: 0 }, text: '', height: H, ...over } as DxfText;
}

/** Πραγματικό AST από ωμό MTEXT περιεχόμενο — ίδια διαδρομή με τον εισαγωγέα. */
function node(raw: string): DxfTextNode {
  return parseMtext(tokenizeMtext(raw), { height: H });
}

// ── 1. Χρώμα ανά run ──────────────────────────────────────────────────────────

describe('χρώμα run (ACI + TrueColor)', () => {
  it('το ACI γίνεται χρώμα — ΟΧΙ κληρονομιά (η αιτία του «όλα κόκκινα»)', () => {
    expect(resolveRunColorHex({ kind: 'ACI', index: 1 })).toBe('#FF0000');
    expect(resolveRunColorHex({ kind: 'ACI', index: 7 })).toBe('#FFFFFF');
  });

  it('ByLayer / ByBlock / εκτός εύρους → undefined (κληρονομεί την οντότητα)', () => {
    expect(resolveRunColorHex({ kind: 'ByLayer' })).toBeUndefined();
    expect(resolveRunColorHex({ kind: 'ByBlock' })).toBeUndefined();
    expect(resolveRunColorHex({ kind: 'ACI', index: 0 })).toBeUndefined();
    expect(resolveRunColorHex({ kind: 'ACI', index: 256 })).toBeUndefined();
    expect(resolveRunColorHex(undefined)).toBeUndefined();
  });

  it('TrueColor διατηρείται (καμία παλινδρόμηση στην παλιά μοναδική διαδρομή)', () => {
    expect(resolveRunColorHex({ kind: 'TrueColor', r: 18, g: 52, b: 86 })).toBe('#123456');
  });

  it('ΔΥΟ χρώματα μέσα στο ΙΔΙΟ MTEXT φτάνουν σε ξεχωριστά spans', () => {
    const t = text({ text: 'ΛΕΥΚΟΚΟΚΚΙΝΟ', textNode: node('\\C7;ΛΕΥΚΟ\\C1;ΚΟΚΚΙΝΟ') });
    const spans = layoutTextBlock(t, H, {}).flatMap(l => l.spans);
    expect(spans.map(s => s.color)).toEqual(['#FFFFFF', '#FF0000']);
    expect(spans.map(s => s.text)).toEqual(['ΛΕΥΚΟ', 'ΚΟΚΚΙΝΟ']);
  });
});

// ── 2. Αναδίπλωση στη στήλη (group 41) ───────────────────────────────────────

describe('αναδίπλωση στη στήλη του MTEXT', () => {
  it('χωρίς πλάτος ΔΕΝ αναδιπλώνει — μία γραμμή, όπως πριν (μηδέν παλινδρόμηση)', () => {
    expect(layoutLineStrings(text({ text: 'ΕΝΑ ΔΥΟ ΤΡΙΑ ΤΕΣΣΕΡΑ' }), H, {})).toHaveLength(1);
  });

  it('σπάει σε ΟΡΙΟ ΛΕΞΗΣ και ΔΕΝ κρατά το κενό του σπασίματος', () => {
    // Στήλη λίγο στενότερη από «ΕΝΑ ΔΥΟ» ⇒ κάθε λέξη πάει σε δική της γραμμή.
    const frame = advance('ΕΝΑ ΔΥΟ') - 1;
    const lines = layoutLineStrings(text({ text: 'ΕΝΑ ΔΥΟ ΤΡΙΑ', width: frame }), H, {});
    expect(lines).toEqual(['ΕΝΑ', 'ΔΥΟ', 'ΤΡΙΑ']);
  });

  it('καμία γραμμή δεν ξεπερνά τη στήλη', () => {
    const frame = advance('αλφα βητα γα');
    const t = text({ text: 'αλφα βητα γαμμα δελτα εψιλον ζητα ητα θητα ιωτα', width: frame });
    for (const line of layoutTextBlock(t, H, {})) expect(line.widthWorld).toBeLessThanOrEqual(frame);
  });

  it('μία ΜΟΝΗ λέξη φαρδύτερη από τη στήλη κόβεται σε χαρακτήρες (δεν ξεχειλίζει επ΄ άπειρον)', () => {
    const lines = layoutLineStrings(text({ text: 'ΑΚΑΤΑΜΑΧΗΤΟΣ', width: advance('ΑΚΑΤ') }), H, {});
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe('ΑΚΑΤΑΜΑΧΗΤΟΣ');
  });

  it('τα ρητά `\\P` παραμένουν αλλαγές γραμμής και μέσα στη στήλη', () => {
    const t = text({ text: 'ΑΛΦΑ\nΒΗΤΑ', textNode: node('ΑΛΦΑ\\PΒΗΤΑ'), width: advance('ΑΛΦΑΒΗΤΑΓΑΜΜΑ') });
    expect(layoutLineStrings(t, H, {})).toEqual(['ΑΛΦΑ', 'ΒΗΤΑ']);
  });
});

// ── 3. Στηλοθέτες ────────────────────────────────────────────────────────────

describe('στηλοθέτες (`^I` → `\\t` → θέση)', () => {
  it('ο tokenizer μετατρέπει το `^I` σε πραγματικό tab, ΟΧΙ σε κείμενο «^I»', () => {
    const flat = tokenizeMtext('Α^IΒ').filter(t => t.kind === 'text').map(t => (t as { value: string }).value);
    expect(flat.join('')).toBe('Α\tΒ');
  });

  it('`^ ` = κυριολεκτικό caret· ένα σκέτο `^` σε πρόζα μένει ανέπαφο', () => {
    const join = (raw: string): string =>
      tokenizeMtext(raw).filter(t => t.kind === 'text').map(t => (t as { value: string }).value).join('');
    expect(join('Α^ Β')).toBe('Α^Β');
    expect(join('2^3')).toBe('2^3');
  });

  it('το tab στέλνει το επόμενο κομμάτι σε στάση, όχι δίπλα-δίπλα', () => {
    const step = MTEXT_DEFAULT_TAB_INTERVAL_EM * H;
    const spans = layoutTextBlock(text({ text: 'Α\tΒ' }), H, {}).flatMap(l => l.spans);
    expect(spans).toHaveLength(2);
    expect(spans[0].xWorld).toBe(0);
    expect(spans[1].xWorld).toBe(step);
  });

  it('διαδοχικά tab προχωρούν σε ΔΙΑΔΟΧΙΚΕΣ στάσεις (δεν καταρρέουν σε μία)', () => {
    const step = MTEXT_DEFAULT_TAB_INTERVAL_EM * H;
    const spans = layoutTextBlock(text({ text: 'Α\t\t\tΒ' }), H, {}).flatMap(l => l.spans);
    expect(spans[spans.length - 1].xWorld).toBe(3 * step);
  });

  it('ρητές στάσεις νικούν την προεπιλογή — και μετρώνται σε em, ΟΧΙ σε μονάδες σχεδίου', () => {
    // `t1.7` σε ύψος 10 ⇒ 17 μονάδες σχεδίου (ezdxf: στάσεις = πολλαπλάσια του char height).
    const t = text({ text: 'Α\tΒ', textNode: node('\\pxt1.7;Α^IΒ') });
    const spans = layoutTextBlock(t, H, {}).flatMap(l => l.spans);
    expect(spans[1].xWorld).toBeCloseTo(17, 6);
  });

  it('το πρόθεμα `x` ΔΕΝ τρώει πια το πρώτο πεδίο (πραγματικός κωδικός του σχεδίου)', () => {
    // `\pxi-3,l3,sm1.5,t3;` — πριν χανόταν ολόκληρο το `i-3` επειδή το «κλειδί» ήταν το `x`.
    const para = node('\\pxi-3,l3,sm1.5,t3;ΚΕΙΜΕΝΟ').paragraphs[0];
    expect(para.indent).toBe(-3);
    expect(para.leftMargin).toBe(3);
    expect(para.tabs).toEqual([3]);
  });

  it('γραμματικές στοιχίσεις `\\pxqc;` / `\\pxqj;` διαβάζονται (πριν αγνοούνταν όλες)', () => {
    expect(node('\\pxqc;ΚΕΙΜΕΝΟ').paragraphs[0].justification).toBe(1);
    expect(node('\\pxqj;ΚΕΙΜΕΝΟ').paragraphs[0].justification).toBe(3);
    expect(node('\\pxqr;ΚΕΙΜΕΝΟ').paragraphs[0].justification).toBe(2);
  });
});

// ── 4. Ισοτιμία κουτιού ↔ απόδοσης ───────────────────────────────────────────

describe('το κουτί βλέπει τις ΟΠΤΙΚΕΣ γραμμές (σύμβαση ισοτιμίας ADR-557)', () => {
  it('«θα αναδιπλωθεί;» μετριέται ΧΩΡΙΣ τη στήλη — αλλιώς δεν θα ήταν ποτέ true', () => {
    expect(isTextBoxFrameConstrained(text({ text: 'CDE', width: 8 }))).toBe(true);
    expect(isTextBoxFrameConstrained(text({ text: 'CDE', width: 100 }))).toBe(false);
  });

  it('αναδιπλώνεται → πλάτος κουτιού = στήλη· δεν αναδιπλώνεται → αγκαλιάζει τα glyphs', () => {
    expect(effectiveTextWidth(text({ text: 'CDE', width: 8 }))).toBe(8);
    expect(effectiveTextWidth(text({ text: 'CDE', width: 1000 }))).toBeCloseTo(advance('CDE'), 6);
  });

  it('το πλήθος γραμμών του κουτιού μετρά την αναδίπλωση, όχι μόνο τα `\\P`', () => {
    const t = text({ text: 'ΕΝΑ ΔΥΟ ΤΡΙΑ', width: advance('ΕΝΑ ΔΥΟ') - 1 });
    expect(layoutTextBlock(t, H, {})).toHaveLength(3);
  });
});
