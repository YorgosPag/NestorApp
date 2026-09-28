/**
 * @fileoverview Άγκυρα: ο τόπος βρίσκεται και με το ΠΑΛΙΟ του όνομα — ADR-893 §7.
 *
 * Η ΕΛΣΤΑΤ έγραφε «ΔΙΣΤΥΩΝ»· το επίσημο είναι «Δυστίων». Ανάμεσά τους **δύο** αλλαγές σε μη γειτονικές
 * θέσεις και άλλο πρόθεμα 5 χαρακτήρων ⇒ ούτε η απόσταση 1 ούτε η γενική πτώση τα γεφυρώνουν. Χωρίς
 * το `alternateNames`, κάθε εξωτερική πηγή με την παλιά γραφή (Nominatim, ΜΑΜΑ) θα έχανε τον τόπο.
 */

import {
  buildAdminNameIndex,
  exactNameMatches,
  inflectedNameMatchesWithin,
  nearNameMatchesWithin,
  type AdminPlace,
} from '../admin-name-index';

const DYSTIA: AdminPlace = {
  id: 'municipal_unit:290603',
  name: 'Δημοτική Ενότητα Δυστίων',
  level: 6,
  parentId: 'municipality:2906',
  alternateNames: ['Δημοτική Ενότητα ΔΙΣΤΥΩΝ'],
};
const STAGIRA: AdminPlace = {
  id: 'municipal_unit:130201',
  name: 'Δημοτική Ενότητα Σταγίρων-Ακάνθου',
  level: 6,
  parentId: 'municipality:1302',
  alternateNames: ['Δημοτική Ενότητα ΣΤΑΓΕΙΡΩΝ-ΑΚΑΝΘΟΥ'],
};
const index = buildAdminNameIndex([DYSTIA, STAGIRA]);
const everywhere = (): boolean => true;

describe('buildAdminNameIndex — κάθε όνομα του τόπου είναι κλειδί', () => {
  it('η ΠΑΛΙΑ γραφή βρίσκει τον ίδιο τόπο, ακριβώς', () => {
    expect(exactNameMatches(index, 6, 'ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ ΔΙΣΤΥΩΝ')).toEqual([DYSTIA]);
    expect(exactNameMatches(index, 6, 'Δημοτική Ενότητα Σταγείρων-Ακάνθου')).toEqual([STAGIRA]);
  });

  it('η ΝΕΑ γραφή εξακολουθεί να τον βρίσκει', () => {
    expect(exactNameMatches(index, 6, 'Δημοτική Ενότητα Δυστίων')).toEqual([DYSTIA]);
  });

  it('🔴 όνομα + ψευδώνυμο που ταιριάζουν ΚΑΙ τα δύο ανεκτικά ⇒ ΜΙΑ ομάδα, όχι ψευδές «διφορούμενο»', () => {
    // Τεχνητό ζεύγος: η ετικέτα απέχει ΜΙΑ αλλαγή από το όνομα ΚΑΙ μία από το ψευδώνυμο.
    const twin: AdminPlace = { id: 'x:1', name: 'Αβγδε', level: 6, parentId: null, alternateNames: ['Αβγδζ'] };
    const twinIndex = buildAdminNameIndex([twin]);
    expect(nearNameMatchesWithin(twinIndex, 6, 'Αβγδη', everywhere)).toEqual([[twin]]);
    // Κοινό πρόθεμα 5 με το όνομα ΚΑΙ με το ψευδώνυμο ⇒ και τα δύο κλειδιά ταιριάζουν στη γενική πτώση.
    const inflected: AdminPlace = { id: 'x:2', name: 'Αβγδεκλ', level: 6, parentId: null, alternateNames: ['Αβγδεμν'] };
    expect(inflectedNameMatchesWithin(buildAdminNameIndex([inflected]), 6, 'Αβγδεων', everywhere)).toEqual([[inflected]]);
  });

  it('ψευδώνυμο που διπλώνεται στο ΙΔΙΟ κλειδί με το όνομα δεν διπλοεγγράφει τον τόπο', () => {
    const same = buildAdminNameIndex([{ ...DYSTIA, alternateNames: ['ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ ΔΥΣΤΙΩΝ'] }]);
    expect(exactNameMatches(same, 6, 'Δυστίων')).toHaveLength(0);
    expect(exactNameMatches(same, 6, 'Δημοτική Ενότητα Δυστίων')).toHaveLength(1);
  });
});
