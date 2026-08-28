/**
 * ΛΕΞΙΛΟΓΙΟ ΜΕΓΕΘΟΥΣ — ΣΤΑΔΙΟ 1β: ΟΙ ΑΓΚΥΡΕΣ ΤΗΣ ΥΙΟΘΕΤΗΣΗΣ.
 *
 * Το Στάδιο 1 έδωσε λεξιλόγιο (`utils/entity-size.ts`) **χωρίς καταναλωτές**. Εδώ καρφώνεται
 * η υιοθέτηση: ότι το κείμενο ρωτά πλέον «σε τι μετριέμαι;» πριν πει «πόσο είμαι», και ότι η
 * απάντηση φτάνει σε **όλους** τους γεωμετρικούς δρόμους από **ένα** σημείο.
 *
 * Κάθε ομάδα αντιστοιχεί σε **μία μετάλλαξη που πρέπει να γίνεται κόκκινη**:
 *   Μ1 `resolveTextHeightLive` → σκέτο `resolveTextHeight` (η κλίμακα παύει να μετρά)
 *   Μ2 `sizeOrLegacyModel` ερμηνεύει το απόν ως `paper` (τα παλιά σχέδια μεγαλώνουν σιωπηλά)
 *   Μ3 `resolveTextSize` επιστρέφει την αποθηκευμένη `value` αντί για την αλυσίδα ύψους
 *       (⇒ grip-resize σε **εισαγόμενο** κείμενο δεν φαίνεται — το σχήμα `ANNOUPDATE`)
 *   Μ4 ο importer παύει να δηλώνει `basis:'model'` (το ξένο DXF αρχίζει να κουνιέται)
 *   Μ5 το κείμενο διπλώνεται με άλλον υπολογισμό από τον πίνακα (δύο μηχανές, δύο αριθμοί)
 *
 * ⚠️ Αν προσθέσεις test εδώ, ρώτα «ποια μετάλλαξη το κάνει κόκκινο;». Αν η απάντηση είναι
 * «καμία», δεν είναι άγκυρα — είναι διακόσμηση (CHECK 3.54).
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import {
  resolveTextHeight,
  resolveTextHeightLive,
  resolveTextHeightIn,
  resolveTextSize,
} from '../dxf-text-style-extractor';
import { projectSceneTextToDxf, type TextSceneShape } from '../../../bim/text/project-scene-text';
import { tableMmToWorldLive } from '../../../bim/table/table-entity-geometry';
import { followsDrawingScale, type ScaleIndependentSize } from '../../../utils/entity-size';
import { useDrawingScaleStore, DEFAULT_DRAWING_SCALE } from '../../../state/drawing-scale-store';
import { convertText } from '../../../utils/dxf-text-converters';
import { testEntityHit } from '../canvas-click-entity-hit';
import { calculateTextBounds } from '../../../rendering/hitTesting/bounds-primitives';
import type { Entity } from '../../../types/entities';
import type { EntityModel } from '../../../rendering/types/Types';
import type { DxfTextNode } from '../../../text-engine/types';

/** AST με ΕΝΑ run — το σχήμα που γράφει ο importer και που ξαναγράφει το grip-resize. */
function nodeWithRunHeight(height: number, text = 'ABC'): DxfTextNode {
  return {
    paragraphs: [{
      runs: [{
        text,
        style: {
          fontFamily: '', bold: false, italic: false, underline: false, overline: false,
          strikethrough: false, height, widthFactor: 1, obliqueAngle: 0, tracking: 1, color: -1,
        },
      }],
      indent: 0, leftMargin: 0, rightMargin: 0, tabs: [],
      justification: 0, lineSpacingMode: 'multiple', lineSpacingFactor: 1,
    }],
    attachment: 'BL',
    lineSpacing: { mode: 'multiple', factor: 1 },
    rotation: 0, isAnnotative: false, annotationScales: [], currentScale: '',
  } as unknown as DxfTextNode;
}

const setScale = (drawingScale: number): void => {
  useDrawingScaleStore.setState({ drawingScale });
};

const PAPER_2_5: ScaleIndependentSize = { basis: 'paper', mm: 2.5 };

beforeEach(() => setScale(DEFAULT_DRAWING_SCALE));
afterAll(() => setScale(DEFAULT_DRAWING_SCALE));

// ---------------------------------------------------------------------------
describe('Μ1/Μ2 — ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΗΣ ΜΕΤΑΒΑΣΗΣ: ό,τι δεν δηλώνει βάση ΔΕΝ κουνιέται', () => {
  // Αυτό —και μόνο αυτό— είναι που αφήνει τους 21 καταναλωτές του παλιού αναγνώστη ήσυχους.
  const legacySamples: ReadonlyArray<[string, Parameters<typeof resolveTextHeight>[0]]> = [
    ['κενή οντότητα (προεπιλογή 2,5)', {}],
    ['flat height', { height: 4 }],
    ['flat fontSize (κάτοπτρο)', { fontSize: 7 }],
    ['height 0 τότε επόμενη πηγή', { height: 0, fontSize: 3 }],
    ['run του AST υπερισχύει', { textNode: nodeWithRunHeight(9), height: 2, fontSize: 2 }],
    ['run ύψους 0 αγνοείται', { textNode: nodeWithRunHeight(0), height: 2 }],
  ];

  it.each(legacySamples)(
    'Μ1: %s => ΤΑΥΤΟΣΗΜΟ με τον resolveTextHeight, σε ΚΑΘΕ κλίμακα',
    (_label, entity) => {
      const expected = resolveTextHeight(entity);
      for (const scale of [1, 50, 100, 200, 500]) {
        setScale(scale);
        expect(resolveTextHeightLive(entity)).toBe(expected);
      }
    },
  );

  it('Μ2: το απόν annotationSize ερμηνεύεται ως model — ΠΟΤΕ ως paper', () => {
    const legacy = { height: 2.5 };
    expect(resolveTextSize(legacy)).toEqual({ basis: 'model', value: 2.5 });
    // Η ερώτηση που θα κάνει το UI του Σταδίου 3: «ακολουθεί την κλίμακα;» -> ΟΧΙ.
    expect(followsDrawingScale(resolveTextSize(legacy))).toBe(false);
    // Αν ερμηνευόταν ως paper, στο προεπιλεγμένο 1:100 θα γινόταν 250 — 100 φορές μεγαλύτερο.
    setScale(100);
    expect(resolveTextHeightLive(legacy)).toBe(2.5);
    expect(resolveTextHeightLive(legacy)).not.toBe(250);
  });
});

// ---------------------------------------------------------------------------
describe('Μ1 — ΤΟ ΖΗΤΟΥΜΕΝΟ: κείμενο σε mm ΧΑΡΤΙΟΥ ακολουθεί την Κλίμακα σχεδίου', () => {
  const paperText = { annotationSize: PAPER_2_5, height: 2.5 };

  it('1:100 προς 1:200 ΔΙΠΛΑΣΙΑΖΕΙ το ύψος (σκηνή σε mm)', () => {
    setScale(100);
    const at100 = resolveTextHeightLive(paperText);
    setScale(200);
    const at200 = resolveTextHeightLive(paperText);
    expect(at100).toBe(250);
    expect(at200).toBe(500);
    expect(at200 / at100).toBe(2);
  });

  it('η ίδια απάντηση φτάνει στο ΚΟΥΤΙ — μία μετάφραση, όχι δύο', () => {
    // `projectSceneTextToDxf` είναι ο ΕΝΑΣ δρόμος για render / λαβές / όρια / snap / 3D.
    // Αν το ύψος διπλασιάζεται αλλά το κουτί όχι, το κλικ σταματά να πιάνει τα γράμματα.
    const shape = { type: 'text', position: { x: 0, y: 0 }, text: 'A', ...paperText } as TextSceneShape;
    setScale(100);
    expect(projectSceneTextToDxf(shape, 'id').height).toBe(250);
    setScale(200);
    expect(projectSceneTextToDxf(shape, 'id').height).toBe(500);
  });

  it('η βάση paper ΔΕΝ κοιτά καθόλου το flat/run ύψος (είναι μπαγιάτικο κάτοπτρο)', () => {
    // Μετά από παλιό resize, τα flat/run πεδία κρατούν μονάδες κόσμου· η πρόθεση είναι τα mm.
    const stale = { annotationSize: PAPER_2_5, height: 999, textNode: nodeWithRunHeight(777) };
    setScale(100);
    expect(resolveTextHeightLive(stale)).toBe(250);
  });

  it('followsDrawingScale λέει ΝΑΙ μόνο εδώ — η ερώτηση του φίλτρου του Σταδίου 3', () => {
    expect(followsDrawingScale(resolveTextSize({ annotationSize: PAPER_2_5 }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('Μ4 — ΤΟ ΞΕΝΟ ΑΡΧΕΙΟ ΕΧΕΙ ΜΙΛΗΣΕΙ: εισαγόμενο κείμενο μένει ΑΚΙΝΗΤΟ', () => {
  const importTextEntity = () =>
    convertText({ '10': '0', '20': '0', '1': 'ΑΛΦΑ', '40': '3.5' }, 'lyr_x', 0);

  it('ο importer δηλώνει ΡΗΤΑ basis model με το group 40', () => {
    const entity = importTextEntity();
    expect(entity).not.toBeNull();
    expect((entity as unknown as { annotationSize?: unknown }).annotationSize)
      .toEqual({ basis: 'model', value: 3.5 });
  });

  it('και γι αυτό το ύψος του δεν αλλάζει σε καμία κλίμακα', () => {
    const imported = importTextEntity() as unknown as Parameters<typeof resolveTextHeight>[0];
    for (const scale of [1, 50, 100, 200]) {
      setScale(scale);
      expect(resolveTextHeightLive(imported)).toBe(3.5);
    }
  });

  it('Μ3: το δηλωμένο value ΔΕΝ σκιάζει την αλυσίδα ύψους — αλλιώς το resize «δεν πιάνει»', () => {
    // Ρεαλιστικό σενάριο: ο χρήστης τραβά λαβή σε ΕΙΣΑΓΟΜΕΝΟ κείμενο. Ο writer γράφει —όπως
    // πάντα— στο run του AST· δεν ξέρει τίποτα για λεξιλόγιο. Αν η αποθηκευμένη `value`
    // υπερίσχυε, ο χρήστης θα έβλεπε τα γράμματα να επιστρέφουν στο παλιό μέγεθος.
    const resized = {
      annotationSize: { basis: 'model', value: 3.5 } as ScaleIndependentSize,
      height: 3.5,
      textNode: nodeWithRunHeight(35),
    };
    expect(resolveTextSize(resized)).toEqual({ basis: 'model', value: 35 });
    expect(resolveTextHeightLive(resized)).toBe(35);
  });
});

// ---------------------------------------------------------------------------
describe('Μ5 — ΙΣΟΤΙΜΙΑ: κείμενο και πίνακας διπλώνονται με την ΙΔΙΑ αρχή', () => {
  it('ύψος κειμένου paper 2,5mm ισούται με 2,5 επί τις μονάδες ανά sheet-mm του πίνακα', () => {
    // Η απόδειξη ότι δεν φτιάχτηκε δεύτερη μηχανή μετατροπής (N.18): και οι δύο δρόμοι
    // καταλήγουν στο ΕΝΑ `paperHeightToModel`. Αν κάποιος γράψει δικό του πολλαπλασιασμό
    // με την κλίμακα, αυτή η γραμμή κοκκινίζει.
    for (const scale of [1, 20, 50, 100, 200, 500]) {
      setScale(scale);
      expect(resolveTextHeightLive({ annotationSize: PAPER_2_5 })).toBeCloseTo(
        2.5 * tableMmToWorldLive(), 10,
      );
    }
  });

  it('η ενέσιμη (καθαρή) παραλλαγή δίνει ό,τι και η ζωντανή — ίδια συνάρτηση, άλλη πηγή', () => {
    setScale(200);
    const e = { annotationSize: PAPER_2_5 };
    expect(resolveTextHeightIn(e, { drawingScale: 200, sceneUnits: 'mm' })).toBe(resolveTextHeightLive(e));
    // ...και οι μονάδες σκηνής περνούν πραγματικά μέσα: σκηνή σε μέτρα, ίδιο ΦΥΣΙΚΟ ύψος.
    expect(resolveTextHeightIn(e, { drawingScale: 200, sceneUnits: 'm' })).toBeCloseTo(0.5, 10);
  });
});

// ---------------------------------------------------------------------------
describe('Μ6 — Η ΣΥΝΕΠΕΙΑ ΣΤΗΝ ΟΘΟΝΗ: το κλικ και τα όρια μεγαλώνουν ΜΑΖΙ με τα γράμματα', () => {
  // Ο κατάλογος (`text-height-reader-allowlist.test.ts`) φυλάει το **σχήμα** των κλήσεων.
  // Εδώ μετριέται η **συμπεριφορά** των δύο δρόμων που ο χρήστης αγγίζει πιο συχνά: αν
  // αποκλίνουν, το σύμπτωμα είναι «βλέπω το κείμενο, το κλικ δεν το πιάνει».
  const paperText = {
    id: 'text_paper', type: 'text', layerId: 'lyr_x', visible: true,
    position: { x: 0, y: 0 }, text: 'AB',
    annotationSize: PAPER_2_5, height: 2.5,
  } as unknown as Entity;

  it('κλικ: σημείο στα -400 μονάδες είναι ΕΞΩ στο 1:100 και ΜΕΣΑ στο 1:200', () => {
    // Το κουτί κρέμεται κάτω από τη γραμμή βάσης: ύψος 250 στο 1:100, 500 στο 1:200.
    setScale(100);
    expect(testEntityHit({ x: 1, y: -400 }, paperText, 0)).toBe(false);
    setScale(200);
    expect(testEntityHit({ x: 1, y: -400 }, paperText, 0)).toBe(true);
  });

  it('όρια (broad phase): το ύψος του bbox ΔΙΠΛΑΣΙΑΖΕΤΑΙ από 1:100 σε 1:200', () => {
    setScale(100);
    const b100 = calculateTextBounds(paperText as unknown as EntityModel, 0);
    setScale(200);
    const b200 = calculateTextBounds(paperText as unknown as EntityModel, 0);
    expect(b100.height).toBeGreaterThan(0);
    expect(b200.height / b100.height).toBeCloseTo(2, 6);
  });
});
