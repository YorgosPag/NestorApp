/**
 * ΑΓΚΥΡΑ ADR-869 §12.1 — Η ΘΕΜΑΤΟΦΥΛΑΚΗ ΤΗΣ ΕΓΓΡΑΦΗΣ.
 *
 * **Η ερώτηση**: *«γράφει κάποιος ραντεβού χωρίς να περάσει από τον ιδιοκτήτη του “πότε”;»*
 *
 * Το `effectiveDate` είναι **παραγόμενο**: αν ένας γραφέας το παραλείψει, το έγγραφο
 * γράφεται κανονικά, **δεν** σπάει τίποτα, και απλώς γίνεται **αόρατο** στο ερώτημα
 * εύρους του ημερολογίου — δηλαδή το ραντεβού υπάρχει και κανείς δεν το βλέπει. Είναι
 * ακριβώς το είδος αστοχίας που κανένας τύπος και κανένα unit test του γραφέα δεν πιάνει.
 *
 * 🔑 Γι' αυτό ο έλεγχος είναι **στατικός και πλήρης**: απαριθμεί **κάθε** αρχείο που γράφει
 * στη συλλογή και απαιτεί να ζητά το πρόγραμμα από το SSoT. Νέος γραφέας ⇒ αυτόματα
 * καλύπτεται, χωρίς να τον θυμηθεί κανείς.
 *
 * ⚠️ **ΜΗΝ** το «διορθώσεις» προσθέτοντας εξαίρεση. Αν ένας γραφέας δεν μπορεί να
 * χρησιμοποιήσει το SSoT, η απάντηση είναι να μάθει το SSoT τη νέα περίπτωση.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const WRITE_CALL = /\.set\(|\.update\(|setDoc\(|addDoc\(/;

/**
 * 🔑 Ζητά **ΚΛΗΣΗ**, όχι εισαγωγή.
 *
 * Η πρώτη εκδοχή αυτού του ελέγχου ζητούσε τη διαδρομή του module στο κείμενο — και
 * **μετρήθηκε ότι δεν δαγκώνει**: μετάλλαξη που αφαίρεσε τη *χρήση* και άφησε την
 * *εισαγωγή* πέρασε πράσινη. Μια αχρησιμοποίητη εισαγωγή δεν παράγει τίποτα.
 */
const SSOT_CALL = /\bwithAppointmentSchedule\s*\(|\bappointmentConfirmationPatch\s*\(/;

/** Κάθε αρχείο του `src/` που αναφέρει τη συλλογή ραντεβού. */
function filesMentioningAppointments(): string[] {
  const out = execFileSync(
    'git',
    ['grep', '-l', '--', 'COLLECTIONS.APPOINTMENTS', 'src'],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  return out.split('\n').map((s) => s.trim()).filter((s) => s.endsWith('.ts') || s.endsWith('.tsx'));
}

/** …από αυτά, όσα **γράφουν**. */
function appointmentWriters(): string[] {
  return filesMentioningAppointments().filter((rel) => {
    if (rel.includes('__tests__')) return false;
    return WRITE_CALL.test(readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
  });
}

describe('ADR-869 §12.1 — κάθε γραφέας ραντεβού ζητά το πρόγραμμα από το SSoT', () => {
  it('ο παρονομαστής δεν είναι κενός — αλλιώς ο έλεγχος δεν κοίταξε τίποτα', () => {
    // Χωρίς αυτό, ένα σπασμένο `git grep` θα έκανε τον επόμενο έλεγχο **κενά πράσινο**.
    expect(appointmentWriters().length).toBeGreaterThanOrEqual(3);
  });

  it('κανένας γραφέας δεν συναρμολογεί ραντεβού μόνος του', () => {
    const offenders = appointmentWriters().filter((rel) => {
      const source = readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      return !SSOT_CALL.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it('κανείς έξω από το SSoT δεν γράφει το παραγόμενο πεδίο με το χέρι', () => {
    const handWritten = filesMentioningAppointments().filter((rel) => {
      if (rel.includes('__tests__') || rel.includes('appointment-schedule')) return false;
      const source = readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      return /['"`]appointment\.effectiveDate['"`]\s*:/.test(source);
    });

    expect(handWritten).toEqual([]);
  });
});
