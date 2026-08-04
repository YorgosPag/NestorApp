/**
 * ADR-753 Φ4 — χαρακτηρισμός: **η αγκύρωση καθορίζει ποιοι χαρακτήρες επιβιώνουν της αποκοπής.**
 *
 * 🔴 Γιατί γράφτηκε: όταν μεταλλάχθηκε το πρόσημο του `anchorOffset` (ο ΕΝΑΣ κανόνας «πού
 * ξεκινούν τα γράμματα»), οι σουίτες του `glyph-run-draw` και του `bim/table` έγιναν κόκκινες —
 * το `services/clip` **έμεινε πράσινο, γιατί δεν είχε ΚΑΝΕΝΑ test**. Το handoff της Φ4 έγραφε
 * «το δίχτυ υπάρχει ήδη»· μετρήθηκε ότι υπήρχε για **2 από τα 5** σημεία. Αυτό είναι το ένα.
 *
 * Η αξίωση δεν είναι αριθμητική — είναι σημασιολογική: ένα δεξιά-αγκυρωμένο κείμενο απλώνεται
 * **αριστερά** της άγκυρας, άρα πέφτει ΕΞΩ από ένα παράθυρο που ξεκινά στην άγκυρα· ένα
 * κεντραρισμένο χάνει το μισό του. Αν η μετατόπιση αντιστραφεί, αλλάζουν τα ΓΡΑΜΜΑΤΑ που
 * μένουν στην οθόνη, όχι κάποιο δεκαδικό.
 */

import { clipEntity } from '../clip-entity';
import { RectClipRegion } from '../clip-region';
import type { Entity, TextEntity } from '../../../types/entities';

// charW = 0.6 × charH (η μονοδιάστημη παραδοχή του clipText) ⇒ 6 μονάδες ανά χαρακτήρα.
const CHAR_H = 10;
const CHAR_W = CHAR_H * 0.6;
const TEXT = 'ABCDEF';
const TOTAL_W = TEXT.length * CHAR_W; // 36

/** Παράθυρο που αρχίζει ΑΚΡΙΒΩΣ στην άγκυρα και εκτείνεται δεξιά. */
const WINDOW = new RectClipRegion({ xMin: 0, yMin: -100, xMax: 100, yMax: 100 });

function textAt(alignment: TextEntity['alignment']): TextEntity {
  return {
    id: 't1', type: 'text', visible: true,
    position: { x: 0, y: 0 }, text: TEXT, height: CHAR_H, alignment,
  } as TextEntity;
}

const survivingText = (e: Entity[]): string | undefined =>
  e.length === 0 ? undefined : (e[0] as TextEntity).text;

describe('clipText — η αγκύρωση επιλέγει ποια γράμματα μένουν', () => {
  it("'left': το κείμενο απλώνεται ΔΕΞΙΑ της άγκυρας ⇒ επιβιώνει ολόκληρο", () => {
    expect(survivingText(clipEntity(textAt('left'), WINDOW))).toBe('ABCDEF');
  });

  it("'right': απλώνεται ΑΡΙΣΤΕΡΑ της άγκυρας ⇒ πέφτει εξ ολοκλήρου έξω", () => {
    expect(clipEntity(textAt('right'), WINDOW)).toEqual([]);
  });

  it("'center': μισό αριστερά, μισό δεξιά ⇒ επιβιώνει το ΔΕΞΙ μισό", () => {
    // localStart = −18· οι χαρακτήρες 0-2 κάθονται στο [−18, 0), ο 2ος τελειώνει ΠΑΝΩ στο 0
    // αλλά αρχίζει στο −6 ⇒ δεν είναι πλήρως μέσα. Μένουν οι 3,4,5.
    expect(survivingText(clipEntity(textAt('center'), WINDOW))).toBe('DEF');
  });

  it("'justify' (μόνο MTEXT) αντιμετωπίζεται όπως 'left' — γεμίζει από την αριστερή ακμή", () => {
    const mtext = { ...textAt('left'), type: 'mtext', alignment: 'justify' } as unknown as Entity;
    expect(survivingText(clipEntity(mtext, WINDOW))).toBe('ABCDEF');
  });

  it('η νέα θέση εισαγωγής είναι η αριστερή ακμή του ΠΡΩΤΟΥ χαρακτήρα που έμεινε', () => {
    // Ο άμεσος μάρτυρας της μετατόπισης: κέντρο ⇒ −TOTAL_W/2 + 3·CHAR_W = 0.
    const out = clipEntity(textAt('center'), WINDOW);
    expect((out[0] as TextEntity).position.x).toBeCloseTo(-TOTAL_W / 2 + 3 * CHAR_W, 9);
  });

  it('το αποκομμένο κείμενο ξαναγράφεται ως αριστερά-αγκυρωμένο στη νέα του θέση', () => {
    // Αλλιώς η αγκύρωση θα εφαρμοζόταν ΔΕΥΤΕΡΗ φορά πάνω στο ήδη μετατοπισμένο σημείο.
    const out = clipEntity(textAt('center'), WINDOW);
    expect((out[0] as TextEntity).alignment).toBe('left');
  });
});
