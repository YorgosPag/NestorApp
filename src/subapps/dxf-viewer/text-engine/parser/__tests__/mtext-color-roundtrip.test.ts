/**
 * ADR-737 §11-6 — `ByLayer` / `ByBlock` ΕΠΙΒΙΩΝΟΥΝ ΤΟΥ ROUND-TRIP.
 *
 * Ο `serializeColor` έγραφε **σωστά** `\C256;` (ByLayer) και `\C0;` (ByBlock) — οι κανονικοί
 * κωδικοί του DXF, ίδιοι με το `ezdxf.colors.BYLAYER/BYBLOCK`. Ο parser όμως περνούσε τον αριθμό
 * **αυτούσιο** σε `{kind:'ACI', index:256}`: «κληρονομώ» γινόταν «χρώμα υπ' αριθμόν 256».
 *
 * 🐛 **ΤΡΙΤΗ ΟΨΗ ΤΗΣ ΒΛΑΒΗΣ Ε.** Η Ε ήταν «γράφουμε κάτι που δεν διαβάζουμε», το §11-5
 * «διαβάζουμε κάτι που δεν ξαναγράφουμε»· αυτή είναι **«γράφουμε και ξαναδιαβάζουμε — άλλο
 * πράγμα»**, η πιο ύπουλη από τις τρεις, γιατί κανένα πλήθος κωδικών δεν αλλάζει και το string
 * είναι **ήδη σταθερό σημείο από το πρώτο πέρασμα**. Μόνο η σύγκριση του AST τη δείχνει.
 *
 * 🎯 ΓΙΑΤΙ ΕΙΝΑΙ ΠΡΑΓΜΑΤΙΚΗ ΚΑΙ ΟΧΙ ΘΕΩΡΗΤΙΚΗ: η μόνη διαδρομή που παράγει «επιστροφή σε
 * κληρονομιά» μέσα σε ένα MTEXT είναι το **κλείσιμο ομάδας `{…}`** — το συνηθέστερο ιδίωμα του
 * AutoCAD, και ακριβώς το σχήμα της πραγματικής ετικέτας εμβαδού του `47_ergasia.dxf`
 * (`\A1;{\C7;…}`). Χωρίς τη διόρθωση, κάθε τέτοιο κείμενο έπαυε να ακολουθεί το χρώμα του layer
 * μετά από **έναν** κύκλο export→import: το layer γινόταν πράσινο, το κείμενο έμενε πίσω.
 *
 * ⚠️ Η ΟΘΟΝΗ ΔΕΝ ΤΟ ΕΔΕΙΧΝΕ: το `resolveRunColorHex` επιστρέφει `undefined` **και** για ByLayer
 * **και** για `ACI 256` (εκτός του έγκυρου εύρους 1..255) ⇒ ίδια ζωγραφική, διαφορετικό AST.
 * Γι' αυτό η βλάβη έζησε αόρατη: **η ισοδυναμία στην απόδοση έκρυβε την ανισότητα στα δεδομένα.**
 */

import { parse, roundTrip, serialize } from './mtext-roundtrip-harness';
import type { DxfColor } from '../../types/text-toolbar.types';
import {
  ACI_BY_BLOCK,
  ACI_BY_LAYER,
  encodeAciColorInt,
  parseAciColorInt,
} from '../../types/text-toolbar.types';

/** Το χρώμα κάθε παιδιού του AST, με τη σειρά ζωγραφικής. */
function colorsOf(raw: string): readonly DxfColor[] {
  return parse(raw).paragraphs[0].runs.map((r) => r.style.color);
}

describe('ADR-737 §11-6 — ο χάρτης ACI ↔ DxfColor είναι ΑΜΦΙΔΡΟΜΟΣ', () => {
  it.each<[string, DxfColor, number]>([
    ['ByLayer ↔ 256', { kind: 'ByLayer' }, ACI_BY_LAYER],
    ['ByBlock ↔ 0', { kind: 'ByBlock' }, ACI_BY_BLOCK],
    ['ACI 7 ↔ 7', { kind: 'ACI', index: 7 }, 7],
    ['ACI 1 ↔ 1', { kind: 'ACI', index: 1 }, 1],
    ['ACI 255 ↔ 255 (το τελευταίο ΧΡΩΜΑ)', { kind: 'ACI', index: 255 }, 255],
  ])('%s', (_label, color, code) => {
    expect(encodeAciColorInt(color)).toBe(code);
    expect(parseAciColorInt(code)).toEqual(color);
  });

  it('ο κύκλος κωδικός → χρώμα → κωδικός είναι η ταυτότητα για ΚΑΘΕ έγκυρο ACI', () => {
    // Εξαντλητικά 0..256: ένας χάρτης με «σχεδόν σωστό» κατώφλι (π.χ. 255 αντί 256) πέφτει εδώ.
    for (let code = 0; code <= ACI_BY_LAYER; code++) {
      expect(encodeAciColorInt(parseAciColorInt(code))).toBe(code);
    }
  });
});

describe('ADR-737 §11-6 — ΔΥΟ ΠΕΡΑΣΜΑΤΑ μέσα από τον πραγματικό αγωγό', () => {
  it('κλείσιμο ομάδας: το επόμενο run ΕΞΑΚΟΛΟΥΘΕΙ να κληρονομεί', () => {
    // Πριν: `{\C1;Α}Β` → `\C1;Α\C256;Β` → 2ο πέρασμα το «Β» = ACI 256 (χρώμα, όχι κληρονομιά).
    expect(colorsOf('{\\C1;Α}Β')).toEqual([{ kind: 'ACI', index: 1 }, { kind: 'ByLayer' }]);
    expect(colorsOf(roundTrip('{\\C1;Α}Β'))).toEqual([{ kind: 'ACI', index: 1 }, { kind: 'ByLayer' }]);
  });

  it.each([
    ['κλείσιμο ομάδας πίσω σε ByLayer', '{\\C1;Α}Β'],
    ['ρητό \\C256; ενδιάμεσα', 'Α\\C1;Β\\C256;Γ'],
    ['ρητό \\C0; (ByBlock)', 'Α\\C1;Β\\C0;Γ'],
    ['φωλιασμένες ομάδες', '{\\C1;Α{\\C3;Β}Γ}Δ'],
    ['κληρονομιά ΚΑΙ σε στοίβα', '{\\C1;Α\\S1^2;}Β'],
    ['true-color και επιστροφή', '{\\c255;Α}Β'],
    ['η πραγματική ετικέτα εμβαδού', '\\A1;{\\C7;Ε\\H0.7x;\\S^ τίτλου;\\H1.4286x;=231.04τ.μ.}'],
  ])('%s — το AST ταυτίζεται στα δύο περάσματα', (_label, raw) => {
    expect(colorsOf(roundTrip(raw))).toEqual(colorsOf(raw));
  });

  it('ΣΤΑΘΕΡΟ ΣΗΜΕΙΟ: το τρίτο πέρασμα δίνει το ίδιο string με το δεύτερο', () => {
    const once = roundTrip('{\\C1;Α}Β');
    expect(roundTrip(once)).toBe(once);
  });

  it('🔬 ΓΙΑΤΙ ΤΟ ΣΤΑΘΕΡΟ ΣΗΜΕΙΟ ΔΕΝ ΑΡΚΟΥΣΕ: το string ήταν ήδη σταθερό ΜΕ τη βλάβη', () => {
    // Τεκμηρίωση μεθόδου, όχι διακόσμηση: `\C256;` γραφόταν και ξαναγραφόταν πανομοιότυπα σε
    // κάθε πέρασμα — μόνο η ΣΗΜΑΣΙΑ του άλλαζε. Ένα test που συγκρίνει strings ήταν δομικά
    // ανίκανο να το δει· γι' αυτό όλα τα παραπάνω συγκρίνουν AST.
    const raw = '{\\C1;Α}Β';
    expect(serialize(parse(raw))).toContain('\\C256;');
    expect(roundTrip(roundTrip(raw))).toBe(roundTrip(raw));
  });
});

describe('ADR-737 §11-6 — ΜΗΔΕΝ ΘΟΡΥΒΟΣ (αρνητικά pins)', () => {
  it('κείμενο χωρίς κανένα \\C δεν αποκτά κωδικό χρώματος', () => {
    // Η βάση είναι ByLayer· αν ο χάρτης «ξεχνούσε» ότι ByLayer ≡ βάση, κάθε run θα έπαιρνε \C256;.
    expect(roundTrip('Α\\H5;Β')).not.toMatch(/\\C/);
  });

  it('το ACI 256 ΔΕΝ είναι ζωγραφίσιμο χρώμα — μένει κληρονομιά και μετά τη διόρθωση', () => {
    // Αρνητικό pin απέναντι σε «λύση» που θα έκανε το 256 έγκυρο δείκτη παλέτας.
    expect(parseAciColorInt(ACI_BY_LAYER).kind).toBe('ByLayer');
    expect(parseAciColorInt(ACI_BY_BLOCK).kind).toBe('ByBlock');
  });
});
