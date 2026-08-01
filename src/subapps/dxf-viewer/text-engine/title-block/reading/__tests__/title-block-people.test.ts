/**
 * @fileoverview Πρόσωπα από την τυπογραφική ιεραρχία — ADR-745 §2.2β / §6.1.
 *
 * Το πραγματικό αρχείο αποδεικνύει ότι δουλεύει· τα συνθετικά αποδεικνύουν **γιατί**
 * δουλεύει. Χωρίς τα δεύτερα, μια υλοποίηση που συγκρίνει με τα καρφωμένα 1,0 και 0,53
 * περνά ολόκληρη τη σουίτα και σπάει στην πρώτη πινακίδα άλλου γραφείου.
 */

import { mtextToSegments, type MtextSegment } from '../mtext-segments';
import { extractPeople, heightLevels } from '../title-block-people';
import { GREEK_SURVEYOR_PROFILE } from '../title-block-vocabulary';
import { G753_TITLEBLOCK_ROWS } from './fixtures/g753-titleblock.fixture';

const DESIGNERS_CELL = G753_TITLEBLOCK_ROWS.find((r) => r.raw.includes('ΜΑΥΡΟΜΙΧΑΛΗΣ'))!;
const readReal = () =>
  extractPeople(mtextToSegments(DESIGNERS_CELL.raw), GREEK_SURVEYOR_PROFILE);

const segment = (text: string, heightFactor: number): MtextSegment => ({ text, heightFactor });

describe('πρόσωπα — πραγματικό κελί ΜΕΛΕΤΗΤΗΣ', () => {
  it('🔴 δύο πρόσωπα με τις ειδικότητές τους — όχι ένα, όχι τέσσερα', () => {
    expect(readReal().people.map((p) => [p.displayName, p.professionText])).toEqual([
      ['ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ', 'ΑΓΡΟΝΟΜΟΣ ΤΟΠΟΓΡΑΦΟΣ ΜΗΧΑΝΙΚΟΣ Α.Π.Θ.'],
      ['ΝΙΚΟΛΑΟΥ ΕΥ. ΙΩΑΝΝΗΣ', 'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ Τ.Ε.'],
    ]);
  });

  it('🔴 οι δύο μηχανικοί κατατάσσονται στο ΙΔΙΟ επίπεδο (σωρευτικό 0,5334 × 1,875 ≈ 1)', () => {
    // Αν η ανοχή ισότητας ύψους φύγει, το 1,000125 γίνεται δικό του επίπεδο και ο δεύτερος
    // μηχανικός υποβιβάζεται σε «ειδικότητα του πρώτου».
    const levels = heightLevels(mtextToSegments(DESIGNERS_CELL.raw));
    expect(levels).toHaveLength(4);
    expect(levels[0]).toBeCloseTo(1, 2);
    expect(levels[1]).toBeCloseTo(0.5334, 3);
  });

  it('τα στοιχεία επικοινωνίας του γραφείου δίνονται και στα ΔΥΟ πρόσωπα', () => {
    // Το αρχείο τα γράφει μία φορά για όλους· ποιος τα κρατά στην καρτέλα του είναι
    // απόφαση του Λ2, με άνθρωπο — ο Λ1 δεν τη μαντεύει.
    for (const person of readReal().people) {
      expect(person.phones).toEqual(['2310788493', '6949727121']);
      expect(person.emails).toEqual(['info@nikolaou.com.gr']);
      expect(person.websites).toEqual(['www.nikolaou.com.gr']);
      expect(person.officeSeat).toBe('ΝΕΟΧΩΡΟΥΔΑ');
    }
  });

  it('🔴 η επωνυμία δραστηριότητας ΔΕΝ πετιέται — πάει στο unparsed', () => {
    // Δεν υπάρχει πεδίο γι᾽ αυτήν στο μοντέλο. Ορατή απώλεια, όχι σιωπηλή.
    expect(readReal().unparsed).toEqual(['ΤΟΠΟΓΡΑΦΙΚΕΣ ΜΕΛΕΤΕΣ - ΕΦΑΡΜΟΓΕΣ']);
  });

  it('η γραμμή «site: … e-mail: …» καταναλώνεται ΠΛΗΡΩΣ — δεν αφήνει σκουπίδια', () => {
    expect(readReal().unparsed.join(' ')).not.toContain('site');
    expect(readReal().unparsed.join(' ')).not.toContain('mail');
  });
});

describe('πρόσωπα — η κατάταξη είναι ο κανόνας, όχι οι αριθμοί του γραφείου', () => {
  it('🔴 με άλλους συντελεστές (1 / 0,7 / 0,4) το αποτέλεσμα είναι το ίδιο', () => {
    const read = extractPeople(
      [
        segment('ΠΑΠΑΔΟΠΟΥΛΟΥ ΜΑΡΙΑ', 1),
        segment('ΑΡΧΙΤΕΚΤΩΝ ΜΗΧΑΝΙΚΟΣ', 0.7),
        segment('ΕΔΡΑ ΚΑΤΕΡΙΝΗ 2351012345', 0.4),
      ],
      GREEK_SURVEYOR_PROFILE,
    );
    expect(read.people).toEqual([
      {
        displayName: 'ΠΑΠΑΔΟΠΟΥΛΟΥ ΜΑΡΙΑ',
        professionText: 'ΑΡΧΙΤΕΚΤΩΝ ΜΗΧΑΝΙΚΟΣ',
        phones: ['2351012345'],
        emails: [],
        websites: [],
        officeSeat: 'ΚΑΤΕΡΙΝΗ',
      },
    ]);
    expect(read.unparsed).toEqual([]);
  });

  it('🔴 δεύτερη γραμμή στο ίδιο ΨΗΛΟ επίπεδο = δεύτερο πρόσωπο, όχι ειδικότητα', () => {
    const read = extractPeople(
      [segment('Α ΠΡΩΤΟΣ', 1), segment('Β ΔΕΥΤΕΡΟΣ', 1)],
      GREEK_SURVEYOR_PROFILE,
    );
    expect(read.people.map((p) => p.displayName)).toEqual(['Α ΠΡΩΤΟΣ', 'Β ΔΕΥΤΕΡΟΣ']);
    expect(read.people.every((p) => p.professionText === '')).toBe(true);
  });

  it('δεύτερη ειδικότητα για το ίδιο πρόσωπο δεν αντικαθιστά την πρώτη — πάει στο unparsed', () => {
    const read = extractPeople(
      [segment('Α ΠΡΩΤΟΣ', 1), segment('ΕΙΔΙΚΟΤΗΤΑ Α', 0.5), segment('ΕΙΔΙΚΟΤΗΤΑ Β', 0.5)],
      GREEK_SURVEYOR_PROFILE,
    );
    expect(read.people[0].professionText).toBe('ΕΙΔΙΚΟΤΗΤΑ Α');
    expect(read.unparsed).toEqual(['ΕΙΔΙΚΟΤΗΤΑ Β']);
  });

  it('κελί μιας μόνο γραμμής δίνει ένα πρόσωπο χωρίς ειδικότητα', () => {
    const read = extractPeople([segment('ΜΟΝΟΣ ΜΕΛΕΤΗΤΗΣ', 1)], GREEK_SURVEYOR_PROFILE);
    expect(read.people).toHaveLength(1);
    expect(read.people[0].professionText).toBe('');
  });

  it('κενό κελί δεν παράγει φανταστικό πρόσωπο', () => {
    expect(extractPeople([], GREEK_SURVEYOR_PROFILE)).toEqual({ people: [], unparsed: [] });
  });
});
