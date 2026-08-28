/**
 * ΑΓΚΥΡΑ — το λεξιλόγιο μεγέθους: «σε τι μετριέται αυτό, και τι γίνεται όταν αλλάξει η κλίμακα;»
 *
 * Γιατί υπάρχει: το `view-scale.test.ts` ήταν πράσινο επαληθεύοντας τα ΜΑΘΗΜΑΤΙΚΑ, ενώ η κλίμακα
 * σχεδίου δεν άγγιζε τα κείμενα επί μήνες. Οι μετρήσεις εδώ ρωτούν τη συμπεριφορά που βλέπει ο
 * άνθρωπος: «γύρισα τον διακόπτη — τι μεγάλωσε, και τι σωστά έμεινε ακίνητο;»
 *
 * @see ../entity-size — το λεξιλόγιο
 * @see ../annotation-scale — ο ΕΝΑΣ υπολογισμός paper→model που τυλίγει
 */

import {
  resolveSizeToModel,
  modelSizeToPaper,
  followsDrawingScale,
  sizeOrLegacyModel,
  type EntitySize,
  type SizeContext,
} from '../entity-size';
import { paperHeightToModel } from '../annotation-scale';
import type { SceneUnits } from '../scene-units';

const ALL_UNITS: readonly SceneUnits[] = ['mm', 'cm', 'm', 'in', 'ft'];

function ctx(drawingScale: number, sceneUnits: SceneUnits = 'm'): SizeContext {
  return { drawingScale, sceneUnits };
}

describe('βάση `paper` — ακολουθεί την κλίμακα σχεδίου', () => {
  it('η αλλαγή 1:100 → 1:200 ΔΙΠΛΑΣΙΑΖΕΙ το μέγεθος στον κόσμο', () => {
    // Η ερώτηση του περιστατικού, εκτελεσμένη: το ΙΔΙΟ αποθηκευμένο μέγεθος, δύο κλίμακες.
    const size: EntitySize = { basis: 'paper', mm: 2.5 };
    const at100 = resolveSizeToModel(size, ctx(100));
    const at200 = resolveSizeToModel(size, ctx(200));
    expect(at200 / at100).toBeCloseTo(2, 10);
  });

  it('η οντότητα ΔΕΝ ξαναγράφεται — η ίδια πρόθεση δίνει και τις δύο απαντήσεις', () => {
    const size: EntitySize = { basis: 'paper', mm: 2.5 };
    const before = JSON.stringify(size);
    resolveSizeToModel(size, ctx(50));
    resolveSizeToModel(size, ctx(500));
    // Καμία εντολή συγχρονισμού, κανένα ANNOUPDATE: το αντικείμενο είναι αμετάβλητο.
    expect(JSON.stringify(size)).toBe(before);
  });

  it('ίδιο ΦΥΣΙΚΟ μέγεθος σε κάθε σύστημα μονάδων (2,5mm × 100 = 250mm παντού)', () => {
    const size: EntitySize = { basis: 'paper', mm: 2.5 };
    const inMm = resolveSizeToModel(size, ctx(100, 'mm'));
    for (const units of ALL_UNITS) {
      const value = resolveSizeToModel(size, ctx(100, units));
      // Μετατροπή πίσω σε χιλιοστά μέσω του ΙΔΙΟΥ SSoT — αν συμφωνούν, το φυσικό μέγεθος είναι ένα.
      const asMm = (value / paperHeightToModel(1, 1, units)) * paperHeightToModel(1, 1, 'mm');
      expect(asMm).toBeCloseTo(inMm, 6);
    }
  });

  it('περνά από τον ΕΝΑ υπολογισμό — ταυτόσημο με ό,τι κάνουν πίνακες/διαστάσεις', () => {
    for (const units of ALL_UNITS) {
      expect(resolveSizeToModel({ basis: 'paper', mm: 4 }, ctx(50, units)))
        .toBe(paperHeightToModel(4, 50, units));
    }
  });
});

describe('βάση `model` — ΔΕΝ ακολουθεί ποτέ την κλίμακα', () => {
  it('εισαγόμενο DXF μένει ακίνητο σε κάθε κλίμακα («το αρχείο έχει ήδη μιλήσει»)', () => {
    const size: EntitySize = { basis: 'model', value: 250 };
    for (const n of [1, 20, 50, 100, 200, 500]) {
      expect(resolveSizeToModel(size, ctx(n))).toBe(250);
    }
  });

  it('μη πεπερασμένη τιμή δεν δηλητηριάζει τα όρια', () => {
    expect(resolveSizeToModel({ basis: 'model', value: NaN }, ctx(100))).toBe(0);
  });
});

describe('βάση `screen` — αμετάβλητη ΚΑΙ από κλίμακα ΚΑΙ από ζουμ', () => {
  it('ίδια pixels σε κάθε ζουμ ⇒ διαφορετικές μονάδες κόσμου', () => {
    const size: EntitySize = { basis: 'screen', px: 10 };
    const zoomedOut = resolveSizeToModel(size, { ...ctx(100), pxPerSceneUnit: 5 });
    const zoomedIn = resolveSizeToModel(size, { ...ctx(100), pxPerSceneUnit: 50 });
    expect(zoomedOut).toBeCloseTo(2, 10);
    expect(zoomedIn).toBeCloseTo(0.2, 10);
  });

  it('η κλίμακα σχεδίου ΔΕΝ την αγγίζει — μια λαβή δεν τυπώνεται ποτέ', () => {
    const size: EntitySize = { basis: 'screen', px: 10 };
    const a = resolveSizeToModel(size, { ...ctx(50), pxPerSceneUnit: 20 });
    const b = resolveSizeToModel(size, { ...ctx(500), pxPerSceneUnit: 20 });
    expect(a).toBe(b);
  });

  it('καμβάς πριν το layout (scale 0) → 0, όχι άπειρο', () => {
    expect(resolveSizeToModel({ basis: 'screen', px: 10 }, { ...ctx(100), pxPerSceneUnit: 0 }))
      .toBe(0);
  });
});

describe('μετάβαση — τίποτα δεν αλλάζει σιωπηλά', () => {
  it('απόν μέγεθος ⇒ ερμηνεύεται ως `model` ⇒ ΑΚΡΙΒΩΣ η σημερινή συμπεριφορά', () => {
    const resolved = sizeOrLegacyModel(undefined, 250);
    expect(resolved).toEqual({ basis: 'model', value: 250 });
    expect(resolveSizeToModel(resolved, ctx(200))).toBe(250);
  });

  it('δηλωμένο μέγεθος κερδίζει το legacy πεδίο', () => {
    const declared: EntitySize = { basis: 'paper', mm: 2.5 };
    expect(sizeOrLegacyModel(declared, 999)).toBe(declared);
  });

  it('η ρητή μετατροπή είναι ΑΚΡΙΒΩΣ αντίστροφη (round-trip σε κάθε μονάδα)', () => {
    for (const units of ALL_UNITS) {
      for (const scale of [1, 50, 100, 500]) {
        const paper = modelSizeToPaper(250, ctx(scale, units));
        expect(resolveSizeToModel(paper, ctx(scale, units))).toBeCloseTo(250, 6);
      }
    }
  });

  it('μετά τη μετατροπή, το αντικείμενο ΑΡΧΙΖΕΙ να ακολουθεί την κλίμακα', () => {
    // Παλιό κείμενο 250 μονάδων σε σκηνή ΧΙΛΙΟΣΤΩΝ, γραμμένο στο 1:100 → 2,5mm χαρτιού
    // (το κανονικό ISO 3098). Οι μονάδες της σκηνής ΜΕΤΡΑΝΕ: τα ίδια 250 σε σκηνή μέτρων
    // είναι 250 m, δηλαδή 2.500 mm χαρτιού — γι' αυτό το `ctx` δηλώνεται ρητά εδώ.
    const converted = modelSizeToPaper(250, ctx(100, 'mm'));
    expect(converted.mm).toBeCloseTo(2.5, 10);
    // ...και πλέον διπλασιάζεται μαζί με την κλίμακα, όπως κάθε σημείωση.
    expect(resolveSizeToModel(converted, ctx(200, 'mm'))).toBeCloseTo(500, 6);
  });
});

describe('`followsDrawingScale` — η ερώτηση που κάνει το UI ορατότητας', () => {
  it('μόνο το `paper` ακολουθεί', () => {
    expect(followsDrawingScale({ basis: 'paper', mm: 2.5 })).toBe(true);
    expect(followsDrawingScale({ basis: 'model', value: 250 })).toBe(false);
    expect(followsDrawingScale({ basis: 'screen', px: 10 })).toBe(false);
    expect(followsDrawingScale(undefined)).toBe(false);
  });
});
