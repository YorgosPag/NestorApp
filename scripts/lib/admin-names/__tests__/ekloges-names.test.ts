/**
 * @fileoverview Άγκυρες της τρίτης πηγής (ekloges.ypes.gr) — ADR-893 Φ2.
 *
 * Το απόσπασμα είναι **αυτούσιο** από το `stat/e/statics.js` (λήψη 2026-09-27, CRLF και κενά όπως
 * ήταν): δήμοι 9170/9305 (δύο `Ηρακλείου`, Αττική και Κρήτη), 9232 (Φυλής, με το χαλασμένο `’νω`),
 * 9056 (Αριστοτέλη), 9204 (Νίκαιας – Αγ. Ι. Ρέντη) και οι ενότητές τους.
 */

import { eklogesMunicipalitiesFor, parseEklogesStatics, repairEklogesText } from '../ekloges-names';

const STATICS = [
  '\r\n      window.static={\r\n        epik:[[1,"Επικράτειας",18617,10816286,21,4]],',
  '\r\n        dhm:[[9170,"Ηρακλείου",59,60],[9305,"Ηρακλείου",213,55],[9232,"Φυλής",60,64],[9056,"Αριστοτέλη",35,9],',
  '[9204,"Νίκαιας - Αγίου Ιωάννη Ρέντη",139,41]],',
  '\r\n        den:[[119,"Ηρακλείου",59,9170],[1907,"Γοργολαΐνη",7,9305],[1912,"Ηρακλείου",176,9305],',
  '[1919,"Νέας Αλικαρνασσού",18,9305],[1922,"Τεμένους",7,9305],[1923,"Παλιανης",5,9305],',
  '[1101,"’νω Λιοσίων",43,9232],[1106,"Ζεφυρίου",12,9232],[1112,"Φυλής",5,9232],',
  '[5202,"Αρναίας",12,9056],[5209,"Παναγίας",6,9056],[5212,"Σταγίρων-Ακάνθου",17,9056],',
  '[4001,"Αγίου Ιωάννου Ρέντη",20,9204],[4011,"Νικαίας",119,9204]],',
  '\r\n        party:[[2,1,"ΝΕΑ ΔΗΜΟΚΡΑΤΙΑ","FF0C99FF",1]]\r\n      };',
].join('');

describe('parseEklogesStatics — ανάλυση ΧΩΡΙΣ εκτέλεση', () => {
  const names = parseEklogesStatics(STATICS);

  it('διαβάζει δήμους και ενότητες, κάθε ενότητα με τον δήμο της', () => {
    expect(names.municipalities).toHaveLength(5);
    expect(names.units).toHaveLength(14);
    expect(names.units.find((unit) => unit.id === 4011)).toEqual({ id: 4011, name: 'Νικαίας', municipalityId: 9204 });
  });

  it('επισκευάζει το χαλασμένο `Ά` (Windows-1253 διαβασμένο ως ISO-8859-7)', () => {
    expect(names.units.find((unit) => unit.id === 1101)?.name).toBe('Άνω Λιοσίων');
    expect(repairEklogesText('’σσου-Λεχαίου')).toBe('Άσσου-Λεχαίου');
  });

  it('ΔΕΝ «επισκευάζει» τον χαμένο τόνο (`Παλιανης`) — αυτόν τον κόβει ο έλεγχος μονοτονικού', () => {
    expect(names.units.find((unit) => unit.id === 1923)?.name).toBe('Παλιανης');
  });

  it('ό,τι δεν είναι πίνακας πλειάδων ⇒ σφάλμα, όχι κενό', () => {
    expect(() => parseEklogesStatics('window.static={ epik:[] }')).toThrow(/dhm/);
    expect(() => parseEklogesStatics('window.static={ dhm:[[1,"Α",1,1]], den:[["x","Β",1,1]] }')).toThrow(/άκυρη γραμμή/);
  });
});

describe('eklogesMunicipalitiesFor — ταύτιση δήμου κατά ΣΥΝΟΛΟ ενοτήτων, όχι κατά όνομα', () => {
  const names = parseEklogesStatics(STATICS);

  it('δύο δήμοι «Ηρακλείου»: οι ενότητες ξεχωρίζουν την Κρήτη', () => {
    expect(eklogesMunicipalitiesFor(['ΗΡΑΚΛΕΙΟΥ', 'ΓΟΡΓΟΛΑΪΝΗ', 'ΝΕΑΣ ΑΛΙΚΑΡΝΑΣΣΟΥ', 'ΤΕΜΕΝΟΥΣ', 'ΠΑΛΙΑΝΗΣ'], names)).toEqual([9305]);
  });

  it('δήμος με μία ενότητα κοινού ονόματος ⇒ ΟΛΟΙ οι ισόπαλοι (η ομοφωνία κρίνει μετά)', () => {
    expect(eklogesMunicipalitiesFor(['ΗΡΑΚΛΕΙΟΥ'], names).slice().sort()).toEqual([9170, 9305]);
  });

  it('λιγότερες από τις μισές ενότητες ⇒ κανένας δήμος (όχι «ο καλύτερος»)', () => {
    expect(eklogesMunicipalitiesFor(['ΑΡΝΑΙΑΣ', 'ΑΛΛΗ', 'ΤΡΙΤΗ'], names)).toEqual([]);
    expect(eklogesMunicipalitiesFor([], names)).toEqual([]);
  });
});
