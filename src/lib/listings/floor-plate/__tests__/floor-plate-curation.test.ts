/**
 * Άγκυρες της κρίσης επιμέλειας ορόφου (ADR-907 §11.6). Πρόθεμα **Ε** (επιμέλεια).
 * Τα δεδομένα μιμούνται τον όροφο δοκιμής: τρεις μονάδες (πώληση · κρατημένη · πωλημένη) σε κάδρο 100 × 50.
 */

import { isPublishableFloorPlateUnits } from '../floor-plate-publication';
import {
  curateFloorPlate,
  type FloorPlateCurationInput,
  type FloorPlateOutlineCandidate,
  type FloorPlateUnitFacts,
} from '../floor-plate-curation';

const FRAME = { minX: 0, minY: 0, maxX: 100, maxY: 50 };

/** Ορθογώνιο στον χώρο του υποβάθρου (Y προς τα πάνω). */
function rect(x: number, y: number, w: number, h: number): { x: number; y: number }[] {
  return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
}

function outline(overlayId: string, unitId: string | null, x: number, over: Partial<FloorPlateOutlineCandidate> = {}): FloorPlateOutlineCandidate {
  return { overlayId, role: 'property', vertices: rect(x, 10, 20, 20), unitId, ...over };
}

const FACTS: ReadonlyMap<string, FloorPlateUnitFacts> = new Map([
  ['prop_self', { commercialStatus: 'for-sale', publicListingId: 'prop_self' }],
  ['prop_b', { commercialStatus: 'reserved', publicListingId: null }],
  ['prop_c', { commercialStatus: 'sold', publicListingId: null }],
  ['prop_d', { commercialStatus: 'for-rent', publicListingId: 'prop_d' }],
]);

function input(outlines: readonly FloorPlateOutlineCandidate[], over: Partial<FloorPlateCurationInput> = {}): FloorPlateCurationInput {
  return { selfUnitId: 'prop_self', frame: FRAME, outlines, unitFacts: FACTS, ...over };
}

const FLOOR = [outline('ovrl_a', 'prop_self', 5), outline('ovrl_b', 'prop_b', 30), outline('ovrl_c', 'prop_c', 55)];

describe('Ε-1 — Ο ΟΡΟΦΟΣ ΒΓΑΙΝΕΙ ΜΕ ΣΧΗΜΑ ΚΑΙ ΚΑΤΑΣΤΑΣΗ, ΤΙΠΟΤΕ ΑΛΛΟ', () => {
  it('τρεις μονάδες ⇒ «αυτό το ακίνητο» και δύο γείτονες με την κατάστασή τους, στη σειρά τους', () => {
    const curated = curateFloorPlate(input(FLOOR));

    expect(curated.ok && curated.units.map((unit) => unit.state)).toEqual(['self', 'reserved', 'unavailable']);
  });

  it('το περίγραμμα γίνεται κλάσματα της εικόνας από πάνω-αριστερά (αναστροφή Y)', () => {
    const curated = curateFloorPlate(input([outline('ovrl_a', 'prop_self', 5)]));

    // (5,10)-(25,30) σε κάδρο 100×50 ⇒ x: 0.05…0.25 · y: 1−10/50=0.8 … 1−30/50=0.4
    expect(curated.ok && curated.units[0].outline).toEqual([0.05, 0.8, 0.25, 0.8, 0.25, 0.4, 0.05, 0.4]);
  });

  it('🔴 καμία ταυτότητα μη δημόσιου γείτονα δεν υπάρχει στην έξοδο', () => {
    const curated = curateFloorPlate(input(FLOOR));

    expect(JSON.stringify(curated)).not.toMatch(/prop_b|prop_c|ovrl_/);
  });

  it('γείτονας με ΔΙΚΗ του δημόσια αγγελία γίνεται σύνδεσμος· η ίδια η μονάδα ποτέ', () => {
    const curated = curateFloorPlate(input([...FLOOR, outline('ovrl_d', 'prop_d', 78)]));
    const units = curated.ok ? curated.units : [];

    expect(units[3]).toMatchObject({ state: 'available', listingId: 'prop_d' });
    expect('listingId' in units[0]).toBe(false);
  });

  it('🔑 ό,τι βγάζει η κρίση περνά τον τελευταίο έλεγχο πριν από το ράφι', () => {
    const curated = curateFloorPlate(input(FLOOR));

    expect(curated.ok && isPublishableFloorPlateUnits(curated.units)).toBe(true);
  });

  it('αδήλωτη εμπορική κατάσταση γείτονα ⇒ «μη διαθέσιμο», ποτέ ελεύθερο', () => {
    const facts = new Map([...FACTS, ['prop_b', { commercialStatus: undefined, publicListingId: null }]]);
    const curated = curateFloorPlate(input(FLOOR, { unitFacts: facts }));

    expect(curated.ok && curated.units[1].state).toBe('unavailable');
  });
});

describe('Ε-2 — ΕΝΑ ΑΝΕΞΗΓΗΤΟ ΠΕΡΙΓΡΑΜΜΑ ΑΡΝΕΙΤΑΙ ΟΛΟΚΛΗΡΟ ΤΟΝ ΟΡΟΦΟ, ΜΕ ΟΝΟΜΑ', () => {
  it.each([
    ['άδετο περίγραμμα μονάδας', outline('ovrl_x', null, 78), 'unlinked-outline'],
    ['μονάδα άλλου χώρου ή ανύπαρκτη', outline('ovrl_x', 'prop_foreign', 78), 'foreign-unit'],
    ['δεύτερο περίγραμμα για την ίδια μονάδα', outline('ovrl_x', 'prop_b', 78), 'duplicate-unit'],
    ['σχήμα που δεν είναι πολύγωνο', outline('ovrl_x', 'prop_d', 78, { vertices: null }), 'not-a-polygon'],
    ['άγνωστος ρόλος', outline('ovrl_x', 'prop_d', 78, { role: 'balcony' }), 'unknown-role'],
    ['κορυφή έξω από το κάδρο', outline('ovrl_x', 'prop_d', 95), 'outside-frame'],
    ['δύο μόνο κορυφές', outline('ovrl_x', 'prop_d', 78, { vertices: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }), 'too-few-vertices'],
    ['μη πεπερασμένη συντεταγμένη', outline('ovrl_x', 'prop_d', 78, { vertices: [{ x: NaN, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 1 }] }), 'not-finite'],
    ['εκφυλισμένο σχήμα (γραμμή)', outline('ovrl_x', 'prop_d', 78, { vertices: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }] }), 'degenerate'],
  ] as const)('🔴 %s ⇒ καμία κάτοψη, και η άρνηση δείχνει ΠΟΙΟ περίγραμμα', (_name, broken, why) => {
    expect(curateFloorPlate(input([...FLOOR, broken]))).toEqual({ ok: false, why, overlayId: 'ovrl_x' });
  });

  it('🔴 δίδυμο περίγραμμα (ίδιο σχήμα, άλλη μονάδα) ⇒ `coincident-outlines`', () => {
    const twin = outline('ovrl_twin', 'prop_d', 30);

    expect(curateFloorPlate(input([...FLOOR, twin]))).toEqual({ ok: false, why: 'coincident-outlines', overlayId: 'ovrl_twin' });
  });

  it('🔴 η μονάδα της αγγελίας δεν είναι ανάμεσά τους ⇒ `self-missing`, χωρίς περίγραμμα να φταίει', () => {
    const neighboursOnly = [outline('ovrl_b', 'prop_b', 30), outline('ovrl_c', 'prop_c', 55)];

    expect(curateFloorPlate(input(neighboursOnly))).toEqual({ ok: false, why: 'self-missing', overlayId: null });
    expect(curateFloorPlate(input([]))).toEqual({ ok: false, why: 'self-missing', overlayId: null });
  });
});

describe('Ε-3 — Ο,ΤΙ ΔΕΝ ΕΙΝΑΙ ΜΟΝΑΔΑ ΔΕΝ ΒΓΑΙΝΕΙ ΠΟΤΕ, ΚΑΙ ΔΕΝ ΕΜΠΟΔΙΖΕΙ', () => {
  it.each(['footprint', 'annotation', 'auxiliary'])('το «%s» παραλείπεται — ακόμη κι άδετο, ακόμη κι έξω από το κάδρο', (role) => {
    const working = outline('ovrl_w', null, 500, { role });
    const curated = curateFloorPlate(input([working, ...FLOOR]));

    expect(curated.ok && curated.units).toHaveLength(3);
  });

  it.each(['parking', 'storage'])('το «%s» είναι μονάδα: βγαίνει με κατάσταση, και άδετο αρνείται τον όροφο', (role) => {
    const linked = curateFloorPlate(input([...FLOOR, outline('ovrl_p', 'prop_d', 78, { role })]));
    const unlinked = curateFloorPlate(input([...FLOOR, outline('ovrl_p', null, 78, { role })]));

    expect(linked.ok && linked.units).toHaveLength(4);
    expect(unlinked).toMatchObject({ ok: false, why: 'unlinked-outline' });
  });
});
