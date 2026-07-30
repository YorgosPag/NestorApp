/**
 * ADR-737 §11-2 — ΤΟ `\A#;` ΜΕΤΑΚΙΝΕΙ ΟΝΤΩΣ ΧΑΡΑΚΤΗΡΕΣ.
 *
 * Το ADR-737 κέρδισε πιστότητα round-trip για το `\A`, ΟΧΙ οπτική ορθότητα: το πεδίο
 * `TextRunStyle.verticalAlign` διαβαζόταν, ταξίδευε και εξαγόταν, αλλά **κανένας renderer δεν
 * το διάβαζε** — 49 μετρημένες εμφανίσεις στο `47_ergasia.dxf` δεν μετακινούσαν ούτε έναν
 * χαρακτήρα. Εδώ μετριέται η μετακίνηση, μέσα από τον ΠΡΑΓΜΑΤΙΚΟ αγωγό
 * (tokenizer → parser → `layoutTextBlock`), στο ΙΔΙΟ `layoutTextBlock` που καλούν ο
 * `TextRenderer` και το `explode-text`.
 *
 * ── ΤΟ ΜΕΤΡΗΜΕΝΟ ΚΡΙΤΗΡΙΟ ────────────────────────────────────────────────────────────────
 * Οι 5 ετικέτες εμβαδού του δείγματος έχουν τη μορφή
 *     `\A1;{\C7;Ε\H0.7x;\S^ τίτλου;\H1.4286x;=231.04τ.μ.}`   (ύψος μπλοκ 0,6 — κωδ. 40)
 * δηλαδή γραμμή με ανάμεικτα ύψη **0,6 και 0,42** (διαφορά 30%) και αγκύρωση TL. Ο δείκτης
 * `_τίτλου` πρέπει να **κατέβει κατά (0,6 − 0,42)/2 = 0,09** μονάδες κόσμου — 15% του ύψους
 * κειμένου. Χωρίς τη διόρθωση κάθεται στην ΚΟΡΥΦΗ της γραμμής, επειδή ο ζωγράφος έδινε σε όλα
 * τα spans το ίδιο y με `textBaseline = 'top'`.
 *
 * ── ΑΡΝΗΤΙΚΟ PIN (μη το αφαιρέσεις) ──────────────────────────────────────────────────────
 * Ο τύπος του ezdxf είναι **no-op σε γραμμή ενιαίου ύψους**. Αν κάποια «βελτίωση» αρχίσει να
 * μετακινεί κάθε κείμενο του σχεδίου, τα tests της τελευταίας ενότητας πέφτουν.
 */

import { layoutTextBlock } from '../text-layout';
import { tokenizeMtext } from '../../../text-engine/parser/mtext-tokenizer';
import { parseMtext } from '../../../text-engine/parser/mtext-parser';
import type { DxfText } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { TextVerticalAnchor } from '../../../text-engine/types';

/** Ύψος μπλοκ της πραγματικής ετικέτας (κωδ. 40 στο `47_ergasia.dxf`). */
const H = 0.6;
/** Η ΠΡΑΓΜΑΤΙΚΗ συμβολοσειρά της ετικέτας εμβαδού από το δείγμα. */
const AREA_LABEL = '\\A1;{\\C7;Ε\\H0.7x;\\S^ τίτλου;\\H1.4286x;=231.04τ.μ.}';

function layoutOf(raw: string, anchor?: TextVerticalAnchor, height = H) {
  const t = {
    id: 't', type: 'text', visible: true, position: { x: 0, y: 0 }, text: '', height,
    textNode: parseMtext(tokenizeMtext(raw), { height }),
    ...(anchor ? { textStyle: { textBaseline: anchor } } : {}),
  } as unknown as DxfText;
  return layoutTextBlock(t, height, {});
}

/** Τα spans της πρώτης οπτικής γραμμής, με το ύψος και τη μετατόπισή τους. */
function spansOf(raw: string, anchor?: TextVerticalAnchor) {
  return layoutOf(raw, anchor)[0].spans.map((s) => ({
    text: s.text, h: s.heightWorld, dy: s.yOffsetWorld,
  }));
}

describe('ADR-737 §11-2 — η πραγματική ετικέτα εμβαδού του 47_ergasia.dxf', () => {
  it('ΦΡΟΥΡΟΣ: η γραμμή έχει όντως ανάμεικτα ύψη (αλλιώς το \\A είναι εξ ορισμού no-op)', () => {
    const heights = spansOf(AREA_LABEL).map((s) => s.h);
    expect(heights.length).toBeGreaterThan(2);
    expect(Math.min(...heights)).toBeCloseTo(0.42, 6);
    expect(Math.max(...heights)).toBeCloseTo(0.6, 3);
  });

  it('ο δείκτης «_τίτλου» ΚΑΤΕΒΑΙΝΕΙ κατά 0,09 μονάδες κόσμου', () => {
    const stack = spansOf(AREA_LABEL).find((s) => s.h < 0.5);
    expect(stack).toBeDefined();
    // Αρνητικό = προς τα κάτω (το SSoT μιλά κόσμο y-πάνω· ο ζωγράφος αφαιρεί).
    expect(stack!.dy).toBeCloseTo(-0.09, 4);
    // 15% του ύψους κειμένου — το μέγεθος που κάνει τη διαφορά ορατή, όχι τυπογραφικό ψιλό.
    expect(Math.abs(stack!.dy) / H).toBeCloseTo(0.15, 3);
  });

  it('τα ΨΗΛΑ κομμάτια της ίδιας γραμμής δεν κουνιούνται', () => {
    for (const s of spansOf(AREA_LABEL).filter((x) => x.h > 0.5)) {
      expect(s.dy).toBeCloseTo(0, 4);
    }
  });
});

describe('ADR-737 §11-2 — οι τρεις τιμές, με τον τύπο του ezdxf', () => {
  /** Γραμμή με περίσσευμα ύψους ακριβώς 0,3: ψηλό 0,6 + κοντό 0,3. */
  const MIXED = (code: string): string => `Α${code}\\H0.5x;μικρό`;

  it.each([
    ['\\A0 (bottom) πάει το κοντό στη ΒΑΣΗ', '\\A0;', -0.3],
    ['\\A1 (center) το πάει στο ΚΕΝΤΡΟ', '\\A1;', -0.15],
    ['\\A2 (top) το αφήνει στην ΚΟΡΥΦΗ', '\\A2;', 0],
  ])('%s', (_label, code, expected) => {
    const small = spansOf(MIXED(code)).find((s) => s.text === 'μικρό');
    expect(small).toBeDefined();
    expect(small!.dy).toBeCloseTo(expected, 6);
  });

  it('η αγκύρωση της οντότητας είναι η ΒΑΣΗ της μετακίνησης, όχι αδιάφορη', () => {
    // Με αγκύρωση 'middle' η γραμμή είναι ΗΔΗ κεντραρισμένη ⇒ το \A1 δεν έχει τι να διορθώσει,
    // ενώ το \A2 πρέπει να ανεβάσει το κοντό κατά μισό περίσσευμα. Αν κάποιος αφαιρέσει τον όρο
    // της αγκύρωσης, το πρώτο σκέλος σπάει και κάθε MTEXT με αγκύρωση M/B μετακινείται.
    const centered = spansOf(MIXED('\\A1;'), 'middle').find((s) => s.text === 'μικρό');
    const top = spansOf(MIXED('\\A2;'), 'middle').find((s) => s.text === 'μικρό');
    expect(centered!.dy).toBeCloseTo(0, 6);
    expect(top!.dy).toBeCloseTo(0.15, 6);
  });
});

describe('ADR-737 §11-2 — ΑΡΝΗΤΙΚΟ PIN: πότε το \\A ΔΕΝ κάνει τίποτα', () => {
  it('γραμμή ΕΝΙΑΙΟΥ ύψους μένει ακίνητη για ΚΑΘΕ τιμή του \\A', () => {
    for (const code of ['\\A0;', '\\A1;', '\\A2;']) {
      const spans = spansOf(`${code}ΑΛΦΑ ΒΗΤΑ ΓΑΜΜΑ`);
      expect(spans.length).toBeGreaterThan(0);
      for (const s of spans) expect(s.dy).toBe(0);
    }
  });

  it('κείμενο ΧΩΡΙΣ \\A μένει ακίνητο ΑΚΟΜΑ ΚΑΙ σε γραμμή με ανάμεικτα ύψη', () => {
    // Σκόπιμη συντηρητική επιλογή: «απών κωδικός» ΔΕΝ σημαίνει «0 = bottom» για τη ζωγραφική —
    // αλλιώς θα μετακινούσαμε κάθε γραμμή με ανάμεικτα ύψη σε ολόκληρο το σχέδιο, χωρίς κανένα
    // αρχείο να το έχει ζητήσει. (Στο export το `?? 0` παραμένει σωστό — άλλο ερώτημα.)
    for (const s of spansOf('Α\\H0.5x;μικρό')) expect(s.dy).toBe(0);
  });

  it('απλό κείμενο χωρίς AST (legacy/in-app) παίρνει ρητό μηδέν, όχι undefined', () => {
    const t = {
      id: 't', type: 'text', visible: true, position: { x: 0, y: 0 },
      text: 'ΑΛΦΑ\nΒΗΤΑ', height: H,
    } as unknown as DxfText;
    for (const line of layoutTextBlock(t, H, {})) {
      for (const s of line.spans) expect(s.yOffsetWorld).toBe(0);
    }
  });
});
