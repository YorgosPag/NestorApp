/**
 * ADR-737 §11-4 — `isTextLikeEntity` + `readMTextGeometry`: ΕΝΑ σημείο ανάγνωσης, μηδέν casts.
 *
 * Ο `emitMText` δέχεται `Entity` και διάβαζε **8 φορές** μέσα από `(e as MTextEntity)`. Το cast
 * δεν ήταν στιλιστικό: ο εισαγόμενος MTEXT ταξιδεύει ως **`type:'text'`** (δείκτης
 * `dxfSourceType:'mtext'`), άρα ο μεταγλωττιστής «επιβεβαίωνε» έναν τύπο που στην παραγωγή
 * σχεδόν ποτέ δεν ίσχυε. Δούλευε **μόνο** επειδή τα πεδία τύχαινε να υπάρχουν και στα δύο
 * σχήματα — ακριβώς το σχήμα του §7-2, όπου το `width` το διάβαζαν τρεις καταναλωτές ενώ ο τύπος
 * `TextEntity` **δεν το δήλωνε καν**.
 *
 * ⚠️ ΤΑ TESTS ΕΔΩ ΚΑΤΑΣΚΕΥΑΖΟΥΝ ΟΝΤΟΤΗΤΕΣ ΜΕ ΤΟ ΧΕΡΙ — και είναι θεμιτό, σε αντίθεση με τον
 * κανόνα του `dxf-roundtrip-mtext-columns.test.ts`: εκεί ελέγχεται **αγωγός** (και μια χειροκίνητη
 * οντότητα θα πιστοποιούσε νεκρό δίδυμο), εδώ ελέγχεται **καθαρή συνάρτηση** πάνω σε δύο σχήματα
 * τύπων. Η εγγύηση αγωγού για το §11-4 είναι ότι τα 14 pipeline tests του §11-1 μένουν πράσινα.
 */

import { describe, it, expect } from '@jest/globals';
import {
  isTextLikeEntity,
  readMTextGeometry,
  type Entity,
  type MTextEntity,
  type TextEntity,
} from '../entities';
import type { MTextColumnsData } from '../../utils/dxf-embedded-object';

const COLUMNS: MTextColumnsData = {
  columnType: 'dynamic', count: 2,
  definedHeight: 8, totalWidth: 42, totalHeight: 8,
  width: 20, gutterWidth: 2,
  autoHeight: false, reversedFlow: false,
  heights: [8, 8],
};

/** Ο εισαγόμενος MTEXT: `type:'text'` + δείκτης προέλευσης — η **συνήθης** μορφή στην παραγωγή. */
const IMPORTED_MTEXT: TextEntity = {
  id: 'txt_1', type: 'text', layerId: 'L',
  position: { x: 100, y: 50 }, text: 'alpha',
  fontSize: 2.5, width: 30, dxfSourceType: 'mtext', mtextColumns: COLUMNS,
};

/** Η γνήσια οντότητα MTEXT — ίδια γεωμετρία, άλλο σχήμα τύπου. */
const NATIVE_MTEXT: MTextEntity = {
  id: 'mtx_1', type: 'mtext', layerId: 'L',
  position: { x: 100, y: 50 }, text: 'alpha',
  fontSize: 2.5, width: 30, mtextColumns: COLUMNS,
};

describe('ADR-737 §11-4 — isTextLikeEntity', () => {
  it.each<[string, Entity, boolean]>([
    ['εισαγόμενο MTEXT (type:text)', IMPORTED_MTEXT, true],
    ['γνήσιο MTEXT', NATIVE_MTEXT, true],
    ['γραμμή — ΟΧΙ κείμενο', { id: 'l1', type: 'line', layerId: 'L', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }, false],
    ['κύκλος — ΟΧΙ κείμενο', { id: 'c1', type: 'circle', layerId: 'L', center: { x: 0, y: 0 }, radius: 1 }, false],
  ])('%s → %s', (_label, entity, expected) => {
    expect(isTextLikeEntity(entity)).toBe(expected);
  });
});

describe('ADR-737 §11-4 — readMTextGeometry: ΙΔΙΑ απάντηση για τα ΔΥΟ σχήματα', () => {
  it('τα δύο σχήματα με ίδια γεωμετρία δίνουν ΤΑΥΤΟΣΗΜΟ αποτέλεσμα', () => {
    // Αυτό είναι όλο το νόημα του accessor: το cast «λειτουργούσε» επειδή τα πεδία συνέπιπταν —
    // εδώ η σύμπτωση γίνεται **ελεγχόμενη ιδιότητα**.
    expect(readMTextGeometry(IMPORTED_MTEXT)).toEqual(readMTextGeometry(NATIVE_MTEXT));
  });

  it('διαβάζει θέση / πλάτος / στήλες από το ΕΙΣΑΓΟΜΕΝΟ σχήμα', () => {
    expect(readMTextGeometry(IMPORTED_MTEXT)).toEqual({
      position: { x: 100, y: 50 },
      width: 30,
      fallbackHeight: 2.5,
      columns: COLUMNS,
    });
  });

  it('απόν `width` → `0` (= «χωρίς πλαίσιο»), ΟΧΙ undefined', () => {
    // Το `MTextEntity.width` είναι υποχρεωτικό, το `TextEntity.width` προαιρετικό. Ο writer
    // πολλαπλασιάζει το πλάτος με την κλίμακα — ένα `undefined * s` θα έγραφε `NaN` στο group 41.
    const { width } = readMTextGeometry({ ...IMPORTED_MTEXT, width: undefined });
    expect(width).toBe(0);
  });

  it('`fallbackHeight`: το `fontSize` ΝΙΚΑ το `height` — η σειρά είναι του `emitMText`', () => {
    // Αρνητικό pin στη ΣΕΙΡΑ, όχι απλώς στην ύπαρξη: αντιστροφή της αλλάζει το group 40 κάθε
    // οντότητας που έχει και τα δύο πεδία.
    expect(readMTextGeometry({ ...IMPORTED_MTEXT, fontSize: 3, height: 5 }).fallbackHeight).toBe(3);
    expect(readMTextGeometry({ ...IMPORTED_MTEXT, fontSize: undefined, height: 5 }).fallbackHeight).toBe(5);
    expect(readMTextGeometry({ ...IMPORTED_MTEXT, fontSize: undefined, height: undefined }).fallbackHeight)
      .toBeUndefined();
  });

  it('χωρίς στήλες → `undefined` (δεν εφευρίσκουμε κενό αντικείμενο)', () => {
    // Ο writer ρωτά `if (columns && …)` — ένα κενό `{}` θα άνοιγε ενότητα `101` με μηδενικά,
    // δηλαδή θα έγραφε στηλοποίηση σε οντότητα που δεν έχει.
    expect(readMTextGeometry({ ...NATIVE_MTEXT, mtextColumns: undefined }).columns).toBeUndefined();
  });
});
