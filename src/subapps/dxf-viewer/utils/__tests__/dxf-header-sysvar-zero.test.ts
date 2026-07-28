/**
 * 🔴 **ΤΟ ΜΗΔΕΝ ΕΙΝΑΙ ΤΙΜΗ, ΟΧΙ ΑΠΟΥΣΙΑ** — `parseHeader` και τα sysvars με σημαίνον `0`.
 *
 * Το περιστατικό (2026-07-29): ο `parseHeader` έγραφε `parseInt(value) || DEFAULT`. Το ιδίωμα
 * αυτό **δεν ξεχωρίζει** το «δεν διαβάστηκε αριθμός» από το «διαβάστηκε νόμιμο μηδέν», και τα
 * δύο sysvars που διαβάζουμε έχουν σημαίνον μηδέν:
 *
 *   • `$INSUNITS 0`    = **unitless** → η σκάλα τεκμηρίων (ADR-716 σκαλί 2) πρέπει να **απέχει**
 *                        και να πέσει στην ευρετική. Με `0 → 4` γινόταν «δηλωμένα χιλιοστά».
 *   • `$MEASUREMENT 0` = **English** ⇒ `acad.pat` (μοτίβα σε ίντσες). Με `0 → 1` κάθε imperial
 *                        αρχείο διαβαζόταν ως metric.
 *
 * ⚠️ **Γιατί δεν το έπιασε κανένα από τα υπάρχοντα tests:** το `ERGASIA_47_HEADER` του fixture
 * δηλώνει `insunits: 0, measurement: 0` **χειρόγραφα** ως `DxfHeaderData` — δηλαδή περιγράφει τι
 * *λέει το αρχείο*, παρακάμπτοντας εντελώς τον parser. Το ίδιο το `makeErgasia47Dxf()` παρήγαγε
 * σωστό DXF **κείμενο**, αλλά κανείς δεν το περνούσε από τον `parseHeader` για να συγκρίνει.
 * Τα tests εδώ κλείνουν ακριβώς αυτό το κενό: **κείμενο → parser → ground truth**.
 */

import { DxfEntityParser } from '../dxf-entity-parser';
import { insunitsCodeToSceneUnits } from '../scene-units';
import {
  ERGASIA_47_EXTENTS, ERGASIA_47_HEADER, makeDxf, makeErgasia47Dxf,
} from './fixtures/dxf-fixtures';

const parse = (dxf: string) => DxfEntityParser.parseHeader(dxf.split('\n'));

describe('parseHeader — sysvars όπου το 0 είναι τιμή', () => {
  it('🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ — `$INSUNITS 0` μένει 0 (unitless), δεν γίνεται 4 (mm)', () => {
    expect(parse(makeDxf({ insunits: 0 })).insunits).toBe(0);
  });

  it('🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ — `$MEASUREMENT 0` μένει 0 (English), δεν γίνεται 1 (metric)', () => {
    expect(parse(makeDxf({ insunits: 4, measurement: 0 })).measurement).toBe(0);
  });

  it('το πραγματικό `47_ergasia.dxf`: ο parser συμφωνεί με το ground truth του fixture', () => {
    // Η γέφυρα που έλειπε: το `ERGASIA_47_HEADER` περιγράφει το αρχείο· εδώ το **αποδεικνύουμε**
    // περνώντας το ίδιο DXF κείμενο από τον parser.
    const parsed = parse(makeErgasia47Dxf());
    expect(parsed.insunits).toBe(ERGASIA_47_HEADER.insunits);
    expect(parsed.measurement).toBe(ERGASIA_47_HEADER.measurement);
    expect(parsed.extmin).toEqual(ERGASIA_47_EXTENTS.min);
    expect(parsed.extmax).toEqual(ERGASIA_47_EXTENTS.max);
  });

  it('ΤΟ ΝΟΗΜΑ, όχι ο αριθμός: unitless ⇒ ο κλάδος «απέχω» της σκάλας γίνεται προσιτός', () => {
    // `insunitsCodeToSceneUnits` επιστρέφει `null` στο 0 ρητά «ώστε ο caller να πέσει στο
    // `detectSceneUnits`» (scene-units.ts). Όσο ο parser έγραφε 4, αυτός ο κλάδος ήταν **νεκρός**
    // για κάθε πραγματικά unitless αρχείο — η ευρετική δεν έτρεχε ΠΟΤΕ, και η μονάδα
    // παρουσιαζόταν ως «δηλωμένη» ενώ κανείς δεν την είχε δηλώσει.
    expect(insunitsCodeToSceneUnits(parse(makeDxf({ insunits: 0 })).insunits)).toBeNull();
    expect(insunitsCodeToSceneUnits(parse(makeDxf({ insunits: 6 })).insunits)).toBe('m');
  });

  it('ΑΠΟΥΣΙΑ μεταβλητής ⇒ τα ιστορικά defaults (μηδέν regression)', () => {
    const h = parse(makeDxf({ insunits: null, measurement: null }));
    expect(h.insunits).toBe(4);
    expect(h.measurement).toBe(1);
  });

  it('μη-αριθμητική τιμή ⇒ default (το `??` δεν καταπίνει σκουπίδια)', () => {
    const dxf = [
      '0', 'SECTION', '2', 'HEADER',
      '9', '$INSUNITS', '70', 'ΧΑΛΑΣΜΕΝΟ',
      '9', '$MEASUREMENT', '70', '',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n');
    const h = parse(dxf);
    expect(h.insunits).toBe(4);
    expect(h.measurement).toBe(1);
  });

  it('κανονικές μη-μηδενικές τιμές περνούν αυτούσιες', () => {
    const h = parse(makeDxf({ insunits: 6, measurement: 1 }));
    expect(h.insunits).toBe(6);
    expect(h.measurement).toBe(1);
  });
});
