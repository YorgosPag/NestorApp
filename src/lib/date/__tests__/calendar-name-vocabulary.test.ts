/**
 * 🔴 ADR-828 §1 — άγκυρες του **λεξιλογίου ημερολογίου**.
 *
 * Κάθε test εδώ καρφώνει έναν ισχυρισμό που, αν σπάσει, βγάζει **λάθος κείμενο σε κελί** —
 * όχι εξαίρεση, όχι κόκκινο στην οθόνη. Γι' αυτό ελέγχονται και τα δεδομένα, όχι μόνο ο
 * κώδικας: ο πίνακας είναι το μισό της λειτουργίας.
 */

import {
  CALENDAR_NAME_CANDIDATES,
  CALENDAR_NAME_LISTS,
  GREEK_MONTHS,
  matchCalendarName,
  type CalendarNameForm,
} from '../calendar-name-vocabulary';
import { matchNameList } from '@/lib/string/name-list-match';
import { normalizeForLabelMatch } from '@/utils/greek-text';

/** Οι εγγραφές μιας **στήλης**, όπως τις εκθέτει το λεξιλόγιο στον ανιχνευτή σειρών. */
function entriesOf(listId: string, form: string): readonly string[] {
  const candidate = CALENDAR_NAME_CANDIDATES.find((c) => c.key === `${listId}:${form}`);
  expect(candidate).toBeDefined();
  return candidate!.entries;
}

describe('δομή του πίνακα', () => {
  it('κάθε εγγραφή έχει κάθε μορφή που δηλώνει η λίστα, μη κενή', () => {
    for (const list of CALENDAR_NAME_LISTS) {
      list.entries.forEach((entry, index) => {
        for (const form of list.forms) {
          const value = (entry as Record<string, string>)[form];
          expect(`${list.id}[${index}].${form} = ${value ?? '<λείπει>'}`).toBe(
            `${list.id}[${index}].${form} = ${value}`,
          );
          expect(value.length).toBeGreaterThan(0);
        }
      });
    }
  });

  it('μήνες 12, ημέρες 7', () => {
    expect(entriesOf('greek-month', 'full')).toHaveLength(12);
    expect(entriesOf('english-month', 'full')).toHaveLength(12);
    expect(entriesOf('greek-weekday', 'full')).toHaveLength(7);
    expect(entriesOf('english-weekday', 'full')).toHaveLength(7);
  });

  /**
   * 🔴 Η σύγκρουση που θα περνούσε αθόρυβα: δύο **διαφορετικές** εγγραφές που
   * κανονικοποιούνται στο ίδιο κλειδί. Τότε η μία γίνεται απρόσιτη και το γέμισμα συνεχίζει
   * τη λάθος λίστα. Σύγκρουση **εντός** της ίδιας εγγραφής (αγγλικό `May` = full + abbrev)
   * είναι νόμιμη και λύνεται από τη σειρά των `forms` — δες το επόμενο describe.
   */
  it('κανένα κανονικοποιημένο κλειδί δεν δείχνει σε δύο διαφορετικές εγγραφές', () => {
    const owners = new Map<string, string>();
    const collisions: string[] = [];

    for (const list of CALENDAR_NAME_LISTS) {
      list.entries.forEach((entry, index) => {
        for (const form of list.forms) {
          const key = normalizeForLabelMatch((entry as Record<string, string>)[form]);
          const owner = `${list.id}#${index}`;
          const previous = owners.get(key);
          if (previous !== undefined && previous !== owner) {
            collisions.push(`"${key}": ${previous} ↔ ${owner}`);
          }
          owners.set(key, owner);
        }
      });
    }

    expect(collisions).toEqual([]);
  });
});

describe('αναγνώριση', () => {
  it('ΙΑΝΟΥΑΡΙΟΣ, Ιανουάριος και ιανουάριος δίνουν την ίδια εγγραφή', () => {
    const shapes = ['ΙΑΝΟΥΑΡΙΟΣ', 'Ιανουάριος', 'ιανουάριος', 'ιανουαριος'];
    for (const shape of shapes) {
      expect(matchCalendarName(shape)).toEqual({
        listId: 'greek-month',
        index: 0,
        form: 'full',
      });
    }
  });

  it('η γενική αναγνωρίζεται ΩΣ γενική, όχι ως ονομαστική', () => {
    expect(matchCalendarName('Ιουλίου')).toEqual({
      listId: 'greek-month',
      index: 6,
      form: 'genitive',
    });
  });

  it('ΔΕΥΤΕΡΑ είναι η πρώτη ελληνική ημέρα', () => {
    expect(matchCalendarName('ΔΕΥΤΕΡΑ')).toEqual({
      listId: 'greek-weekday',
      index: 0,
      form: 'full',
    });
  });

  /** Το `May` ανήκει σε δύο στήλες· κερδίζει η **πρώτη δηλωμένη**, ώστε να συνεχίσει `June`. */
  it('το αγγλικό May διαβάζεται ως πλήρες όνομα, όχι ως συντομογραφία', () => {
    expect(matchCalendarName('May')?.form).toBe('full');
  });

  /**
   * 🔴 Λατινικό `Mar` και ελληνικό `Μαρ` **δεν** επιτρέπεται να συγχέονται: το homoglyph
   * folding διπλώνει λατινικά σε ελληνικά μόνο όταν η λέξη περιέχει ήδη ελληνικό γράμμα.
   * Αν αυτό αλλάξει, ένας αγγλικός πίνακας θα άρχιζε να συμπληρώνεται με ελληνικούς μήνες.
   */
  it('το λατινικό Mar δεν διαβάζεται ως ελληνικός Μάρτιος', () => {
    expect(matchCalendarName('Mar')?.listId).toBe('english-month');
    expect(matchCalendarName('Μαρ')?.listId).toBe('greek-month');
  });

  it('ό,τι δεν είναι ημερολογιακό όνομα δίνει null', () => {
    expect(matchCalendarName('Δοκός')).toBeNull();
    expect(matchCalendarName('')).toBeNull();
    expect(matchCalendarName('123')).toBeNull();
  });

  it('το φίλτρο μορφών αποκλείει τη συντομογραφία', () => {
    const forms: readonly CalendarNameForm[] = ['full', 'genitive'];
    expect(matchCalendarName('ΜΑΡ', ['greek-month'], forms)).toBeNull();
    expect(matchCalendarName('ΜΑΡΤΙΟΣ', ['greek-month'], forms)?.index).toBe(2);
  });

  it('το φίλτρο λιστών αποκλείει τις ημέρες', () => {
    expect(matchCalendarName('ΔΕΥΤΕΡΑ', ['greek-month'])).toBeNull();
  });

  /**
   * Το δίχτυ ασφαλείας της μετανάστευσης: όλες οι γραφές που ήξερε ο **ιδιωτικός** πίνακας
   * του `survey-date.ts` πρέπει να εξακολουθούν να λύνονται στον ίδιο μήνα.
   */
  it('όλες οι γραφές του παλιού πίνακα του survey-date καλύπτονται', () => {
    const legacy: readonly (readonly [number, readonly string[]])[] = [
      [1, ['ΙΑΝΟΥΑΡΙΟΣ', 'ΙΑΝΟΥΑΡΙΟΥ']],
      [2, ['ΦΕΒΡΟΥΑΡΙΟΣ', 'ΦΕΒΡΟΥΑΡΙΟΥ']],
      [3, ['ΜΑΡΤΙΟΣ', 'ΜΑΡΤΙΟΥ']],
      [4, ['ΑΠΡΙΛΙΟΣ', 'ΑΠΡΙΛΙΟΥ']],
      [5, ['ΜΑΙΟΣ', 'ΜΑΙΟΥ']],
      [6, ['ΙΟΥΝΙΟΣ', 'ΙΟΥΝΙΟΥ']],
      [7, ['ΙΟΥΛΙΟΣ', 'ΙΟΥΛΙΟΥ']],
      [8, ['ΑΥΓΟΥΣΤΟΣ', 'ΑΥΓΟΥΣΤΟΥ']],
      [9, ['ΣΕΠΤΕΜΒΡΙΟΣ', 'ΣΕΠΤΕΜΒΡΙΟΥ']],
      [10, ['ΟΚΤΩΒΡΙΟΣ', 'ΟΚΤΩΒΡΙΟΥ']],
      [11, ['ΝΟΕΜΒΡΙΟΣ', 'ΝΟΕΜΒΡΙΟΥ']],
      [12, ['ΔΕΚΕΜΒΡΙΟΣ', 'ΔΕΚΕΜΒΡΙΟΥ']],
    ];

    for (const [month, names] of legacy) {
      for (const name of names) {
        const match = matchCalendarName(name, ['greek-month'], ['full', 'genitive']);
        expect(`${name} → ${match === null ? 'null' : match.index + 1}`).toBe(
          `${name} → ${month}`,
        );
      }
    }
  });
});

/**
 * 🔴 ADR-828 Φ4β — οι υποψήφιες είναι πλέον το **δημόσιο συμβόλαιο** του λεξιλογίου προς
 * τον ανιχνευτή σειρών.
 *
 * ⚠️ Η **αναδίπλωση** δεν ελέγχεται πια εδώ, και δεν έμεινε ακάλυπτη: μετακόμισε μαζί με τα
 * ονόματα στη σειρά, και τα tests της ζουν εκεί που ζει τώρα η απάντηση —
 * `bim/table/__tests__/table-fill-series.test.ts` («μετά τον ΔΕΚΕΜΒΡΙΟ», «προς τα ΠΙΣΩ»,
 * «οι ΗΜΕΡΕΣ αναδιπλώνονται στις 7»). Ένα test που θα την έλεγχε **και** εδώ θα ήταν
 * δεύτερος ισχυρισμός για μία συμπεριφορά, δηλαδή δύο σημεία που μπορούν να αποκλίνουν.
 */
describe('υποψήφιες προς τον ανιχνευτή σειρών', () => {
  it('η θέση 0 είναι ο Ιανουάριος σε κάθε στήλη', () => {
    expect(entriesOf('greek-month', 'full')[0]).toBe('Ιανουάριος');
    expect(entriesOf('greek-month', 'genitive')[0]).toBe('Ιανουαρίου');
    expect(entriesOf('greek-month', 'abbrev')[0]).toBe('Ιαν');
  });

  it('🔑 μία υποψήφια ανά (λίστα × στήλη) — καμία λιγότερη, καμία παραπάνω', () => {
    const expected = CALENDAR_NAME_LISTS.reduce((sum, list) => sum + list.forms.length, 0);
    expect(CALENDAR_NAME_CANDIDATES).toHaveLength(expected);
    expect(new Set(CALENDAR_NAME_CANDIDATES.map((c) => c.key)).size).toBe(expected);
  });

  it('καμία υποψήφια δεν έχει κενή εγγραφή — το κενό θα γινόταν άδειο κελί', () => {
    for (const candidate of CALENDAR_NAME_CANDIDATES) {
      for (const entry of candidate.entries) expect(entry.length).toBeGreaterThan(0);
    }
  });

  /** Αναγνώριση και παραγωγή είναι η **ίδια** ταυτότητα, διαβασμένη προς τις δύο κατευθύνσεις. */
  it('κάθε εγγραφή γυρίζει στον εαυτό της: αναγνώριση → θέση → ίδια λέξη', () => {
    for (const candidate of CALENDAR_NAME_CANDIDATES) {
      candidate.entries.forEach((written, index) => {
        const match = matchNameList(written, [candidate]);
        expect(match).not.toBeNull();
        expect(match!.entries[match!.index]).toBe(written);
        // Η **πρώτη** εμφάνιση κερδίζει· καμία ημερολογιακή στήλη δεν έχει διπλή εγγραφή,
        // οπότε εδώ η θέση πρέπει να ταυτίζεται με τον δείκτη του πίνακα.
        expect(match!.index).toBe(index);
      });
    }
  });

  it('🔑 το αγγλικό May είναι FULL πριν από ABBREV — αλλιώς η στήλη αλλάζει μορφή στη μέση', () => {
    const match = matchNameList('May', CALENDAR_NAME_CANDIDATES);
    expect(match!.key).toBe('english-month:full');
    expect(match!.entries[match!.index + 1]).toBe('June');
  });

  it('το μήκος της λίστας μηνών είναι το μήκος του πίνακα δεδομένων', () => {
    expect(entriesOf('greek-month', 'full')).toHaveLength(GREEK_MONTHS.entries.length);
  });
});
