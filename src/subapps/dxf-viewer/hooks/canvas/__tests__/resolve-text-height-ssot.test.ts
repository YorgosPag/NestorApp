/**
 * ADR-737 §18 — ΤΟ ΚΑΡΦΩΜΑ ΤΗΣ ΑΛΥΣΙΔΑΣ ΥΨΟΥΣ ΚΕΙΜΕΝΟΥ.
 *
 * Πριν από αυτή τη σουίτα, **κανένα** test δεν ρωτούσε τι επιστρέφει το `resolveTextHeight` —
 * και γι' αυτό ο SSoT μπορούσε να απαντά **λάθος** (default `DEFAULT_FONT_SIZE` = 12 αντί για
 * `DEFAULT_HEIGHT` = 2,5) επί μήνες, με 7 σημεία να τον παρακάμπτουν γράφοντας το καθένα το
 * δικό του `|| 2.5`. Τα 7 τοπικά αντίγραφα ήταν το **σύμπτωμα**· ο χαλασμένος SSoT η **αιτία**.
 *
 * Κάθε `it` εδώ αντιστοιχεί σε **μία μετάλλαξη που πρέπει να γίνεται κόκκινη**:
 *   M1 default → ξανά 12 · M2 `||` → `??` · M3 αφαίρεση κλάδου run ·
 *   M3β αφαίρεση του `h > 0` · M4 `readMTextGeometry` χωρίς στένωση τύπου.
 *
 * ⚠️ Αν προσθέσεις `it` εδώ, ρώτα «ποια μετάλλαξη το κάνει κόκκινο;». Αν η απάντηση είναι
 * «καμία», το test δεν καρφώνει τίποτα — δεν είναι κάλυψη, είναι διακόσμηση.
 */

import { describe, it, expect } from '@jest/globals';
import { resolveTextHeight } from '../dxf-text-style-extractor';
import { testEntityHit } from '../canvas-click-entity-hit';
import { TEXT_SIZE_LIMITS } from '../../../config/text-rendering-config';
import { readMTextGeometry } from '../../../types/entities';
import type { Entity, TextLikeEntity } from '../../../types/entities';
import type { DxfTextNode } from '../../../text-engine/types';

/** AST με ΕΝΑ run του δοσμένου ύψους — το σχήμα που γράφει ο importer και το grip-resize. */
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
  };
}

describe('ADR-737 §18 — resolveTextHeight: η προεπιλογή είναι το CAD πρότυπο, όχι το pixel fallback', () => {
  it('M1: οντότητα χωρίς καμία πηγή ύψους ⇒ 2,5 (ISO 3098 / AutoCAD) — ΠΟΤΕ 12', () => {
    expect(resolveTextHeight({})).toBe(2.5);
    expect(resolveTextHeight({})).toBe(TEXT_SIZE_LIMITS.DEFAULT_HEIGHT);
    // Ρητά: το `DEFAULT_FONT_SIZE` (12) είναι fallback σε **pixels** (ADR-142) και δεν έχει
    // καμία δουλειά σε drawing units. Ήταν ακριβώς το «bounds ~5x inflated» του 2026-02-20.
    expect(resolveTextHeight({})).not.toBe(TEXT_SIZE_LIMITS.DEFAULT_FONT_SIZE);
  });

  it('M2: `height === 0` είναι ΕΓΚΥΡΟ DXF («ορίζεται από το TextStyle») ⇒ πέφτει στην επόμενη πηγή', () => {
    // Με `??` αντί για `||` θα κρατούσε το 0 ⇒ **αόρατο κείμενο**.
    expect(resolveTextHeight({ height: 0, fontSize: 3 })).toBe(3);
    expect(resolveTextHeight({ height: 0 })).toBe(2.5);
    expect(resolveTextHeight({ height: 0, fontSize: 0 })).toBe(2.5);
  });

  it('τιμές που ΥΠΑΡΧΟΥΝ διαβάζονται κανονικά (flat height πριν το fontSize κάτοπτρο)', () => {
    expect(resolveTextHeight({ height: 4 })).toBe(4);
    expect(resolveTextHeight({ fontSize: 7 })).toBe(7);
    expect(resolveTextHeight({ height: 4, fontSize: 7 })).toBe(4);
  });

  it('M3: το run του textNode ΥΠΕΡΙΣΧΥΕΙ των flat πεδίων (το AST είναι η αυθεντική πηγή)', () => {
    // Το σχήμα «shadowed» του ADR-635: μια κλίμακα/grip-resize γράφει στο run· όποιος
    // διαβάζει μόνο τα flat πεδία βλέπει την ΠΑΛΙΑ τιμή.
    expect(resolveTextHeight({ textNode: nodeWithRunHeight(9), height: 2, fontSize: 2 })).toBe(9);
  });

  it('M3β: run με ύψος 0 αγνοείται — ίδια σημασιολογία με το `||` παρακάτω', () => {
    // Τα δύο σκέλη (`h > 0` στο run, `||` στα flat) λένε ΤΟ ΙΔΙΟ και πρέπει να αλλάζουν μαζί.
    expect(resolveTextHeight({ textNode: nodeWithRunHeight(0), height: 2 })).toBe(2);
    expect(resolveTextHeight({ textNode: nodeWithRunHeight(0) })).toBe(2.5);
  });
});

describe('ADR-737 §18 — ύψος ΧΑΡΑΚΤΗΡΑ vs ύψος ΠΛΑΙΣΙΟΥ: δύο μεγέθη, ποτέ ξανά ένα όνομα', () => {
  it('MTEXT: το `definedHeight` ΔΕΝ διαρρέει ποτέ ως ύψος γραμματοσειράς', () => {
    // Το test που **δεν μπορούσε να υπάρξει** πριν τη μετονομασία: όσο το πεδίο λεγόταν
    // `height`, ταίριαζε δομικά στο slot του `resolveTextHeight` και επέστρεφε το κουτί.
    const mtext = { definedHeight: 50, fontSize: 2.5 } as { definedHeight: number; fontSize: number };
    expect(resolveTextHeight(mtext)).toBe(2.5);
    expect(resolveTextHeight(mtext)).not.toBe(50);
  });

  it('MTEXT χωρίς καμία πηγή char height ⇒ 2,5 — ΟΧΙ το ύψος πλαισίου', () => {
    expect(resolveTextHeight({ definedHeight: 120 } as { definedHeight: number })).toBe(2.5);
  });

  it('M4: `readMTextGeometry` δεν δέχεται `height` από MTEXT ούτε από ΠΑΛΙΑ αποθηκευμένα δεδομένα', () => {
    // ⚠️ Ρεαλιστικό σενάριο, όχι θεωρητικό: οντότητες γραμμένες ΠΡΙΝ τη μετονομασία κουβαλούν
    // ακόμη `height` = ύψος πλαισίου. Ο μεταγλωττιστής δεν βλέπει persisted JSON — μόνο αυτό
    // το test στέκεται ανάμεσα στο legacy έγγραφο και σε γράμματα ύψους 50.
    const legacyMText = {
      id: 'mtext_0', type: 'mtext', layerId: 'l', visible: true,
      position: { x: 0, y: 0 }, text: 'X', width: 30, height: 50,
    } as unknown as TextLikeEntity;
    expect(readMTextGeometry(legacyMText).fallbackHeight).toBeUndefined();

    // Με `fontSize` παρόν, αυτό — και μόνο αυτό — είναι το char height.
    const withFontSize = { ...legacyMText, fontSize: 2.5 } as unknown as TextLikeEntity;
    expect(readMTextGeometry(withFontSize).fallbackHeight).toBe(2.5);
  });

  it('TEXT: εκεί το `height` ΕΙΝΑΙ char height και περνά κανονικά ως εφεδρεία', () => {
    const text = {
      id: 'text_0', type: 'text', layerId: 'l', visible: true,
      position: { x: 0, y: 0 }, text: 'X', height: 2.5,
    } as unknown as TextLikeEntity;
    expect(readMTextGeometry(text).fallbackHeight).toBe(2.5);
  });
});

describe('ADR-737 §18 — ο ζωντανός καταναλωτής: hit-test (η βλάβη που βρήκε ο μεταγλωττιστής)', () => {
  const mkText = (extra: Record<string, unknown>): Entity => ({
    id: 'text_0', type: 'text', layerId: 'l', visible: true,
    position: { x: 0, y: 0 }, text: 'AB', ...extra,
  } as unknown as Entity);

  const mkMText = (extra: Record<string, unknown>): Entity => ({
    id: 'mtext_0', type: 'mtext', layerId: 'l', visible: true,
    position: { x: 0, y: 0 }, text: 'AB', width: 0, ...extra,
  } as unknown as Entity);

  it('TEXT: το κουτί χτυπήματος κρέμεται ΚΑΤΩ από το position (σημείο εισαγωγής = γραμμή βάσης)', () => {
    const e = mkText({ height: 10 });
    expect(testEntityHit({ x: 1, y: -5 }, e, 0)).toBe(true);   // μέσα, κάτω από τη βάση
    expect(testEntityHit({ x: 1, y: 5 }, e, 0)).toBe(false);   // πάνω από τη βάση ⇒ έξω
    expect(testEntityHit({ x: 1, y: -11 }, e, 0)).toBe(false); // κάτω από το ύψος ⇒ έξω
  });

  it('TEXT: το ύψος του run υπερισχύει — grip-resize χωρίς εγγραφή στα flat πεδία', () => {
    // Πριν, το hit-test διάβαζε `entity.height ?? entity.fontSize ?? 2.5` ⇒ έμενε στο ΠΑΛΙΟ
    // κουτί (ύψος 2) ενώ ο χρήστης έβλεπε γράμματα ύψους 20.
    const resized = mkText({ height: 2, fontSize: 2, textNode: nodeWithRunHeight(20, 'AB') });
    expect(testEntityHit({ x: 1, y: -15 }, resized, 0)).toBe(true);
    expect(testEntityHit({ x: 1, y: -15 }, mkText({ height: 2 }), 0)).toBe(false);
  });

  it('MTEXT: το κουτί χρησιμοποιεί char height — ΟΧΙ το `definedHeight`', () => {
    // Το ζωντανό bug που εντόπισε ο μεταγλωττιστής μόλις έφυγε η ομωνυμία: πλαίσιο 50 ως
    // ύψος γραμματοσειράς ⇒ το hit-test άρπαζε κλικ 40 μονάδες μακριά από τα γράμματα.
    const e = mkMText({ definedHeight: 50, fontSize: 2.5 });
    expect(testEntityHit({ x: 1, y: -40 }, e, 0)).toBe(false);
    expect(testEntityHit({ x: 1, y: -1 }, e, 0)).toBe(true);
  });

  it('MTEXT: το ρητό πλάτος στήλης υπερισχύει της εκτίμησης· `width: 0` = χωρίς αναδίπλωση', () => {
    // `||` όχι `??`: πλάτος 0 σημαίνει «καμία στήλη», άρα πέφτουμε στην εκτίμηση από το κείμενο.
    expect(testEntityHit({ x: 25, y: -1 }, mkMText({ width: 30, fontSize: 2.5 }), 0)).toBe(true);
    expect(testEntityHit({ x: 25, y: -1 }, mkMText({ width: 0, fontSize: 2.5 }), 0)).toBe(false);
  });
});
