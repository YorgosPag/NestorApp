/**
 * @fileoverview 🔴 **Το Zod schema και η allowlist του handler ΔΕΝ επιτρέπεται να αποκλίνουν.**
 *
 * ## Η παγίδα, μετρημένη στη Φ3 του ADR-759
 *
 * Τρία σημεία του repo — το ADR-759 §2.2, το `resolve-drawing-meta.ts` και ο τύπος
 * `BindingBlockReason` — έγραφαν ότι το `.passthrough()` του `UpdateDxfLevelSchema` αφήνει
 * εγγραφή σε **μη δηλωμένο** πεδίο να περάσει «αβασάνιστη». **Δεν ισχύει.** Ο
 * `handleUpdateDxfLevel` δεν κάνει spread του σώματος: χτίζει το `updates` από **ρητή allowlist**
 * `if (body.X !== undefined)`. Άρα ένα πεδίο δηλωμένο **μόνο** στο schema περνά την επικύρωση
 * και **πετιέται σιωπηλά** μετά.
 *
 * ⇒ Η πραγματική αστοχία ήταν η **αντίθετη και χειρότερη**: όχι «γράφεται χωρίς σχήμα», αλλά
 * «**δεν γράφεται ενώ όλα λένε ναι**». Και με τον κανόνα Γ9 (πρώτα ο στόχος, μετά το binding),
 * θα γραφόταν provenance που βεβαιώνει εγγραφή που **δεν έγινε ποτέ** — φάντασμα με το όνομα
 * ενός ανθρώπου πάνω του.
 *
 * ⚠️ Ένα λειτουργικό test του handler θα απαιτούσε ολόκληρο το Admin SDK. Ο έλεγχος εδώ ρωτά το
 * **ίδιο ερώτημα** στην πηγή: «κάθε πεδίο που δέχεται το συμβόλαιο, το αντιγράφει ο handler;»
 */

/* global describe, it, expect */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { UpdateDxfLevelSchema } from '../dxf-levels.schemas';

const HANDLER_SOURCE = readFileSync(join(__dirname, '..', 'dxf-levels.handlers.ts'), 'utf8');

/**
 * Τα δύο κλειδιά που ο handler **αποδομεί** αντί να αντιγράφει
 * (`const { _v: expectedVersion, levelId, ...body } = parsed.data`).
 */
const DESTRUCTURED = new Set(['levelId', '_v']);

const contractFields = Object.keys(UpdateDxfLevelSchema.shape).filter((k) => !DESTRUCTURED.has(k));

describe('🔴 UpdateDxfLevelSchema ↔ allowlist του handleUpdateDxfLevel', () => {
  it('το συμβόλαιο δεν είναι κενό (φρουρός του ίδιου του test)', () => {
    expect(contractFields.length).toBeGreaterThan(10);
  });

  it.each(contractFields)('το «%s» αντιγράφεται ρητά στο `updates`', (field) => {
    // `body.<field>` — ακριβώς η μορφή που χρησιμοποιεί ο handler για κάθε πεδίο.
    expect(HANDLER_SOURCE).toContain(`body.${field} !== undefined`);
  });

  it('🔑 τα 4 μεταδεδομένα πινακίδας (ADR-759 Φ3) είναι ΚΑΙ ΤΑ ΤΡΙΑ δηλωμένα', () => {
    for (const field of ['studyDate', 'drawingType', 'scale', 'drawingNumber']) {
      // 1. το συμβόλαιο τα δέχεται…
      expect(Object.keys(UpdateDxfLevelSchema.shape)).toContain(field);
      // 2. …και ο handler τα γράφει. (3. Ο τύπος `DxfLevelDocument` — έλεγχος μεταγλώττισης.)
      expect(HANDLER_SOURCE).toContain(`updates.${field} =`);
    }
  });
});

describe('UpdateDxfLevelSchema — τα όρια των νέων πεδίων', () => {
  const base = { levelId: 'lvl_1' };

  it('δέχεται τις πραγματικές τιμές του G753', () => {
    const parsed = UpdateDxfLevelSchema.parse({
      ...base,
      studyDate: 'ΙΟΥΛΙΟΣ 2026',
      drawingType: 'ΤΟΠΟΓΡΑΦΙΚΟ ΔΙΑΓΡΑΜΜΑ',
      scale: '1:200',
      drawingNumber: 'Τ1',
    });
    expect(parsed).toMatchObject({ scale: '1:200', drawingNumber: 'Τ1' });
  });

  it('🔑 το `studyDate` είναι ΚΕΙΜΕΝΟ — «ΙΟΥΛΙΟΣ 2026» δεν είναι ημερομηνία', () => {
    // Μια `z.string().datetime()` θα απέρριπτε ό,τι γράφει η μισή Ελλάδα στις πινακίδες της, και
    // το ADR-745 §8 κανόνας 3 απαγορεύει να πετάμε ό,τι διαβάσαμε επειδή δεν ταιριάζει σε μοτίβο.
    expect(UpdateDxfLevelSchema.safeParse({ ...base, studyDate: 'ΙΟΥΛΙΟΣ 2026' }).success).toBe(true);
  });

  it('`null` = ρητός καθαρισμός, όχι σφάλμα', () => {
    expect(UpdateDxfLevelSchema.safeParse({ ...base, scale: null }).success).toBe(true);
  });

  it('απορρίπτει τιμή εκτός ορίου μήκους — το `.passthrough()` δεν καλύπτει δηλωμένο πεδίο', () => {
    expect(UpdateDxfLevelSchema.safeParse({ ...base, scale: 'x'.repeat(61) }).success).toBe(false);
  });
});
