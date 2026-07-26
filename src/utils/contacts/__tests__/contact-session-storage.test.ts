/**
 * @file Anchor tests για τη δικλείδα ανθεκτικής επιλογής επαφής (ADR-332 D20).
 *
 * Το ελάττωμα που φυλάνε: το `<Suspense>` της σελίδας Επαφών πετάει ολόκληρο το
 * υποδέντρο όταν οποιοσδήποτε απόγονος κάνει suspend· η επιλεγμένη επαφή (React
 * state) χανόταν, ενώ η λίστα επιβίωνε από το module cache. Τα tests καλύπτουν
 * και τα δύο μονοπάτια που μπορούν να **χειροτερέψουν** το bug αν σπάσουν:
 * (α) η επαναφορά να μη βρίσκει την επαφή, (β) ο μηδενισμός να μη σβήνει το
 * κλειδί — οπότε μια διαγραμμένη επαφή θα «επανερχόταν».
 */

import {
  readSelectedContactId,
  writeSelectedContactId,
  restoreSelectedContact,
  isSelectionWriteAllowed,
  resolveLateSelectionRestore,
} from '../contact-session-storage';

const STORAGE_KEY = 'contact-selected';

interface TestContact {
  id?: string;
  name: string;
}

const CONTACTS: TestContact[] = [
  { id: 'cont_aaa', name: 'ALFA' },
  { id: 'cont_bbb', name: 'BETA' },
  { id: 'cont_ccc', name: 'GAMMA' },
];

describe('contact-session-storage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    jest.restoreAllMocks();
  });

  describe('readSelectedContactId', () => {
    it('επιστρέφει το αποθηκευμένο id', () => {
      window.sessionStorage.setItem(STORAGE_KEY, 'cont_bbb');
      expect(readSelectedContactId()).toBe('cont_bbb');
    });

    it('επιστρέφει null όταν δεν υπάρχει κλειδί', () => {
      expect(readSelectedContactId()).toBeNull();
    });

    it('θεωρεί το κενό string ως «καμία επιλογή», όχι ως έγκυρο id', () => {
      window.sessionStorage.setItem(STORAGE_KEY, '');
      expect(readSelectedContactId()).toBeNull();
    });

    it('δεν πετάει όταν το sessionStorage είναι απαγορευμένο (ιδιωτική περιήγηση)', () => {
      jest.spyOn(window.Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('SecurityError');
      });

      expect(() => readSelectedContactId()).not.toThrow();
      expect(readSelectedContactId()).toBeNull();
    });
  });

  describe('writeSelectedContactId', () => {
    it('γράφει το id', () => {
      writeSelectedContactId('cont_ccc');
      expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe('cont_ccc');
    });

    it('ΣΒΗΝΕΙ το κλειδί σε null — αλλιώς διαγραμμένη επαφή θα επανερχόταν', () => {
      window.sessionStorage.setItem(STORAGE_KEY, 'cont_aaa');

      writeSelectedContactId(null);

      expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('δεν πετάει όταν το sessionStorage απορρίπτει τη γραφή (quota)', () => {
      jest.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      expect(() => writeSelectedContactId('cont_aaa')).not.toThrow();
    });
  });

  describe('restoreSelectedContact', () => {
    it('βρίσκει την επαφή του αποθηκευμένου id', () => {
      writeSelectedContactId('cont_bbb');

      expect(restoreSelectedContact(CONTACTS)).toEqual({ id: 'cont_bbb', name: 'BETA' });
    });

    it('επιστρέφει null όταν το id δείχνει σε επαφή που δεν υπάρχει πια (σκουπίδι)', () => {
      writeSelectedContactId('cont_deleted');

      expect(restoreSelectedContact(CONTACTS)).toBeNull();
    });

    it('επιστρέφει null όταν η λίστα δεν έχει φορτώσει ακόμη — ΔΕΝ κάνει ανάκτηση', () => {
      writeSelectedContactId('cont_bbb');

      expect(restoreSelectedContact([])).toBeNull();
    });

    it('επιστρέφει null χωρίς αποθηκευμένο id', () => {
      expect(restoreSelectedContact(CONTACTS)).toBeNull();
    });

    it('δεν μπερδεύει επαφές χωρίς id με «καμία επιλογή»', () => {
      const withUndefinedIds: TestContact[] = [{ name: 'χωρίς id' }, ...CONTACTS];
      window.sessionStorage.clear();

      expect(restoreSelectedContact(withUndefinedIds)).toBeNull();
    });
  });

  describe('isSelectionWriteAllowed — το `null` έχει δύο σημασίες', () => {
    it('ΑΠΑΓΟΡΕΥΕΙ τη γραφή null πριν καθίσει η λίστα — αλλιώς σβήνει το κλειδί που θα χρειαστεί', () => {
      expect(isSelectionWriteAllowed(null, false)).toBe(false);
    });

    it('ΕΠΙΤΡΕΠΕΙ τη γραφή null αφού καθίσει η λίστα — τότε σημαίνει όντως αποεπιλογή', () => {
      expect(isSelectionWriteAllowed(null, true)).toBe(true);
    });

    it('επιτρέπει πάντα τη γραφή υπαρκτού id, ακόμη και πριν καθίσει η λίστα', () => {
      expect(isSelectionWriteAllowed('cont_bbb', false)).toBe(true);
      expect(isSelectionWriteAllowed('cont_bbb', true)).toBe(true);
    });
  });

  describe('resolveLateSelectionRestore — η δεύτερη και τελευταία ευκαιρία', () => {
    it('επαναφέρει την επαφή όταν το id βρεθεί στη φορτωμένη λίστα', () => {
      writeSelectedContactId('cont_ccc');

      expect(resolveLateSelectionRestore(CONTACTS)).toEqual({
        kind: 'restored',
        contact: { id: 'cont_ccc', name: 'GAMMA' },
      });
    });

    it('χαρακτηρίζει σκουπίδι — ΟΧΙ «περίμενε» — όταν η λίστα φόρτωσε και το id λείπει', () => {
      writeSelectedContactId('cont_deleted');

      expect(resolveLateSelectionRestore(CONTACTS)).toEqual({ kind: 'garbage' });
    });

    it('δεν κάνει τίποτα χωρίς αποθηκευμένο id', () => {
      expect(resolveLateSelectionRestore(CONTACTS)).toEqual({ kind: 'nothing' });
    });
  });

  describe('🔴 D20.1 — η ακολουθία που κατέστρεφε τη δικλείδα (μετρημένη ζωντανά)', () => {
    it('κενή λίστα στο mount → η λίστα φτάνει μετά → η επιλογή ΕΠΙΒΙΩΝΕΙ', () => {
      // Ο χρήστης είχε επιλέξει σε προηγούμενη συνεδρία.
      writeSelectedContactId('cont_bbb');

      // Φρέσκο φόρτωμα: ο αρχικοποιητής τρέχει με ΚΕΝΟ module cache.
      expect(restoreSelectedContact([])).toBeNull();

      // Το παλιό effect έγραφε εδώ `null` ⇒ removeItem ⇒ μόνιμη απώλεια.
      // Η φρουρά το απαγορεύει όσο η λίστα δεν έχει καθίσει.
      expect(isSelectionWriteAllowed(null, false)).toBe(false);
      expect(readSelectedContactId()).toBe('cont_bbb');

      // Η λίστα φτάνει 325ms αργότερα — το id είναι ακόμη εκεί, η επαναφορά πετυχαίνει.
      expect(resolveLateSelectionRestore(CONTACTS)).toEqual({
        kind: 'restored',
        contact: { id: 'cont_bbb', name: 'BETA' },
      });
    });

    it('κενή λίστα στο mount → η επαφή έχει όντως διαγραφεί → το κλειδί ΣΒΗΝΕΙ', () => {
      writeSelectedContactId('cont_deleted');

      expect(isSelectionWriteAllowed(null, false)).toBe(false);

      // Μόνο ΤΩΡΑ, με φορτωμένη λίστα, το «δεν υπάρχει» είναι αξιόπιστο.
      expect(resolveLateSelectionRestore(CONTACTS)).toEqual({ kind: 'garbage' });

      writeSelectedContactId(null);
      expect(readSelectedContactId()).toBeNull();
    });
  });

  describe('πλήρης κύκλος — το σενάριο του ελαττώματος', () => {
    it('επιλογή → remount → η επιλογή επιβιώνει· μηδενισμός → δεν επιβιώνει', () => {
      // Ο χρήστης επιλέγει· το effect γραφής τρέχει.
      writeSelectedContactId('cont_bbb');

      // Το Suspense πετάει το υποδέντρο· ο αρχικοποιητής ξανατρέχει με το module cache.
      expect(restoreSelectedContact(CONTACTS)?.name).toBe('BETA');

      // Ο χρήστης διαγράφει/αποεπιλέγει· το ίδιο effect γράφει null.
      writeSelectedContactId(null);

      expect(restoreSelectedContact(CONTACTS)).toBeNull();
    });
  });
});
