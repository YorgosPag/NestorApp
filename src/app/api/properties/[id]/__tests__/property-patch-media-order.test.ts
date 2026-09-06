/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΗΣ ΠΟΡΤΑΣ** — τι δέχεται το PATCH ως δήλωση σειράς (Α14.7.5).
 * @related ADR-841 §7 Α14.7.5 · api/properties/[id]/property-patch-helpers
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΑΓΚΥΡΑ ΓΙΑ **ΕΝΑ ΠΕΔΙΟ ΣΧΗΜΑΤΟΣ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `PropertyPatchSchema` είναι **`.passthrough()`**: επικυρώνει ονομαστικά 13 πεδία και
 * αφήνει **ό,τι άλλο** να περάσει, με μόνο φρουρό μια λίστα **άρνησης** πέντε ονομάτων.
 * ⇒ Η γραμμή που επικυρώνει το `publishedMediaOrder` είναι **αφαιρέσιμη χωρίς να σπάσει
 * τίποτα**: το πεδίο θα συνέχιζε να γράφεται, απλώς **χωρίς κανέναν έλεγχο**.
 *
 * 🔑 **Αυτό ακριβώς είναι το σχήμα που χρειάζεται άγκυρα**: όχι κώδικας που θα σπάσει,
 * αλλά προστασία που θα **εξατμιστεί σιωπηλά**.
 */

import { PropertyPatchSchema } from '../property-patch-helpers';
import { PUBLISHED_MEDIA_LIMIT } from '@/services/upload/utils/storage-path-public-shelf';

const ID = 'file_0f2c1a50-f370-466d-bdf7-aa7b2b2d7757';

describe('Π1 — Η ΠΟΡΤΑ ΔΕΧΕΤΑΙ ΤΗ ΔΗΛΩΣΗ ΣΕΙΡΑΣ', () => {
  it('🔴 πίνακας ταυτοτήτων περνά', () => {
    const parsed = PropertyPatchSchema.safeParse({ publishedMediaOrder: [ID, 'file_b'] });
    expect(parsed.success).toBe(true);
  });

  it('🔴 απόν πεδίο περνά — η δήλωση είναι ΠΡΟΑΙΡΕΤΙΚΗ', () => {
    expect(PropertyPatchSchema.safeParse({ name: 'Δ1' }).success).toBe(true);
  });

  it('🔴 ΚΕΝΟΣ πίνακας περνά — «κανένα δηλωμένο» είναι έγκυρη πράξη (αναίρεση)', () => {
    expect(PropertyPatchSchema.safeParse({ publishedMediaOrder: [] }).success).toBe(true);
  });
});

describe('Π2 — Η ΠΟΡΤΑ ΑΠΟΡΡΙΠΤΕΙ Ο,ΤΙ ΔΕΝ ΕΙΝΑΙ ΔΗΛΩΣΗ', () => {
  it.each([
    ['συμβολοσειρά', ID],
    ['αριθμός', 42],
    ['αντικείμενο', { 0: ID }],
    ['πίνακας αριθμών', [1, 2]],
    ['πίνακας με κενή συμβολοσειρά', [ID, '']],
    ['πίνακας με null', [ID, null]],
  ])('🔴 %s ⇒ ΑΠΟΡΡΙΨΗ', (_label, value) => {
    expect(PropertyPatchSchema.safeParse({ publishedMediaOrder: value }).success).toBe(false);
  });

  it('🔴 ταυτότητα πάνω από 128 χαρακτήρες ⇒ ΑΠΟΡΡΙΨΗ', () => {
    const long = 'f'.repeat(129);
    expect(PropertyPatchSchema.safeParse({ publishedMediaOrder: [long] }).success).toBe(false);
  });
});

describe('Π3 — ΤΟ ΟΡΙΟ ΕΙΝΑΙ ΤΟ ΥΠΑΡΧΟΝ, ΟΧΙ ΔΕΥΤΕΡΟΣ ΑΡΙΘΜΟΣ', () => {
  it('🔴 δήλωση ΑΚΡΙΒΩΣ στο `PUBLISHED_MEDIA_LIMIT` περνά', () => {
    const exact = Array.from({ length: PUBLISHED_MEDIA_LIMIT }, (_, i) => `file_${i}`);
    expect(PropertyPatchSchema.safeParse({ publishedMediaOrder: exact }).success).toBe(true);
  });

  it('🔴 δήλωση ΕΝΑ πάνω από το όριο ⇒ ΑΠΟΡΡΙΨΗ — καμία αόριστη λίστα σε έγγραφο', () => {
    const over = Array.from({ length: PUBLISHED_MEDIA_LIMIT + 1 }, (_, i) => `file_${i}`);
    expect(PropertyPatchSchema.safeParse({ publishedMediaOrder: over }).success).toBe(false);
  });

  /**
   * ⚠️ **Η ΑΓΚΥΡΑ ΤΟΥ ΑΡΙΘΜΟΥ, ΟΧΙ ΤΗΣ ΤΙΜΗΣ**: δεν γράφεται «24» εδώ. Ένα σκληρό `24`
   * θα ήταν **δεύτερος αριθμός** — ακριβώς αυτό που η Α14.4 απαγορεύει — και θα έμενε
   * πράσινο ενώ το πραγματικό όριο άλλαζε.
   */
  it('🔴 ΤΟ ΟΡΙΟ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΑΝΤΙΚΕΙΜΕΝΟ με του ραφιού', () => {
    const atLimit = Array.from({ length: PUBLISHED_MEDIA_LIMIT }, (_, i) => `file_${i}`);
    const overLimit = [...atLimit, 'file_extra'];

    expect(PropertyPatchSchema.safeParse({ publishedMediaOrder: atLimit }).success).toBe(true);
    expect(PropertyPatchSchema.safeParse({ publishedMediaOrder: overLimit }).success).toBe(false);
  });
});

// ============================================================================
// Π4 — Η ΔΕΥΤΕΡΗ ΔΗΛΩΣΗ: ΟΙ ΚΑΤΟΨΕΙΣ (ADR-841 §7 Α17.7)
// ============================================================================

/**
 * 🔴 **ΙΔΙΟ ΣΧΗΜΑ, ΜΕΓΑΛΥΤΕΡΟ ΒΑΡΟΣ.** Το `publishedMediaOrder` **δεν μπορεί** να
 * δημοσιεύσει τίποτα· το `publishedFloorplans` **μπορεί** — είναι σκέλος συμμετοχής.
 * Άρα η γραμμή του σχήματος δεν είναι τελετουργία: χωρίς αυτήν, το `.passthrough()` θα
 * δεχόταν **οτιδήποτε** σε πεδίο που **βγάζει bytes στον κόσμο**.
 */
describe('Π4 — Η ΠΟΡΤΑ ΤΩΝ ΚΑΤΟΨΕΩΝ', () => {
  it('🔴 πίνακας ταυτοτήτων περνά', () => {
    expect(PropertyPatchSchema.safeParse({ publishedFloorplans: [ID] }).success).toBe(true);
  });

  it('🔴 ΚΕΝΟΣ πίνακας περνά — «καμία κάτοψη» είναι έγκυρη πράξη (ανάκληση)', () => {
    expect(PropertyPatchSchema.safeParse({ publishedFloorplans: [] }).success).toBe(true);
  });

  it.each([
    ['συμβολοσειρά', ID],
    ['αριθμός', 7],
    ['αντικείμενο', { 0: ID }],
    ['πίνακας με κενή συμβολοσειρά', [ID, '']],
    ['πίνακας με null', [ID, null]],
  ])('🔴 %s ⇒ ΑΠΟΡΡΙΨΗ', (_label, value) => {
    expect(PropertyPatchSchema.safeParse({ publishedFloorplans: value }).success).toBe(false);
  });

  it('🔴 ΤΟ ΙΔΙΟ όριο με τη σειρά — ΕΝΑ ράφι, ΕΝΑ όριο (Α17.7.5)', () => {
    const atLimit = Array.from({ length: PUBLISHED_MEDIA_LIMIT }, (_, i) => `plan_${i}`);
    expect(PropertyPatchSchema.safeParse({ publishedFloorplans: atLimit }).success).toBe(true);
    expect(
      PropertyPatchSchema.safeParse({ publishedFloorplans: [...atLimit, 'plan_extra'] }).success,
    ).toBe(false);
  });

  it('🔴 ΚΑΙ ΟΙ ΔΥΟ ΔΗΛΩΣΕΙΣ ΜΑΖΙ περνούν — δεν αποκλείει η μία την άλλη', () => {
    expect(
      PropertyPatchSchema.safeParse({
        publishedMediaOrder: [ID],
        publishedFloorplans: [ID],
      }).success,
    ).toBe(true);
  });
});
