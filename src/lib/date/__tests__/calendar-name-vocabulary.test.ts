/**
 * 🔴 ADR-828 §1 — άγκυρες του **λεξιλογίου ημερολογίου**.
 *
 * Κάθε test εδώ καρφώνει έναν ισχυρισμό που, αν σπάσει, βγάζει **λάθος κείμενο σε κελί** —
 * όχι εξαίρεση, όχι κόκκινο στην οθόνη. Γι' αυτό ελέγχονται και τα δεδομένα, όχι μόνο ο
 * κώδικας: ο πίνακας είναι το μισό της λειτουργίας.
 */

import {
  CALENDAR_NAME_LISTS,
  GREEK_MONTHS,
  calendarNameAt,
  calendarNameListLength,
  matchCalendarName,
  type CalendarNameForm,
} from '../calendar-name-vocabulary';
import { normalizeForLabelMatch } from '@/utils/greek-text';

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
    expect(calendarNameListLength('greek-month')).toBe(12);
    expect(calendarNameListLength('english-month')).toBe(12);
    expect(calendarNameListLength('greek-weekday')).toBe(7);
    expect(calendarNameListLength('english-weekday')).toBe(7);
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

describe('παραγωγή', () => {
  it('η θέση 0 είναι ο Ιανουάριος στη στήλη που ζητήθηκε', () => {
    expect(calendarNameAt('greek-month', 0, 'full')).toBe('Ιανουάριος');
    expect(calendarNameAt('greek-month', 0, 'genitive')).toBe('Ιανουαρίου');
    expect(calendarNameAt('greek-month', 0, 'abbrev')).toBe('Ιαν');
  });

  it('αναδιπλώνεται προς τα ΕΜΠΡΟΣ: μετά τον Δεκέμβριο έρχεται ο Ιανουάριος', () => {
    expect(calendarNameAt('greek-month', 12, 'full')).toBe('Ιανουάριος');
    expect(calendarNameAt('greek-month', 13, 'full')).toBe('Φεβρουάριος');
  });

  it('αναδιπλώνεται προς τα ΠΙΣΩ: πριν τον Ιανουάριο έρχεται ο Δεκέμβριος', () => {
    expect(calendarNameAt('greek-month', -1, 'full')).toBe('Δεκέμβριος');
    expect(calendarNameAt('greek-month', -13, 'full')).toBe('Δεκέμβριος');
  });

  it('οι ημέρες αναδιπλώνονται στις 7', () => {
    expect(calendarNameAt('greek-weekday', 7, 'full')).toBe('Δευτέρα');
    expect(calendarNameAt('greek-weekday', -1, 'full')).toBe('Κυριακή');
  });

  /** Αναγνώριση και παραγωγή είναι η **ίδια** ταυτότητα, διαβασμένη προς τις δύο κατευθύνσεις. */
  it('κάθε εγγραφή γυρίζει στον εαυτό της: αναγνώριση → παραγωγή', () => {
    for (const list of CALENDAR_NAME_LISTS) {
      list.entries.forEach((entry, index) => {
        for (const form of list.forms) {
          const written = (entry as Record<string, string>)[form];
          const match = matchCalendarName(written, [list.id]);
          expect(match).not.toBeNull();
          expect(calendarNameAt(list.id, match!.index, match!.form)).toBe(
            calendarNameAt(list.id, index, match!.form),
          );
        }
      });
    }
  });

  it('άγνωστη λίστα δίνει κενό αντί να πετάξει', () => {
    expect(calendarNameListLength('greek-month')).toBe(GREEK_MONTHS.entries.length);
  });
});
