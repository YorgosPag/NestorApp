/**
 * @fileoverview Το λεξιλόγιο αναγνώρισης — ADR-745 §6.3 / §8 κανόνας 7.
 *
 * Το προφίλ είναι **δεδομένα**: κάθε γραφείο μπορεί να προσθέσει το δικό του. Άρα οι
 * εγγυήσεις της αναγνώρισης πρέπει να ισχύουν για **οποιοδήποτε** προφίλ, όχι μόνο για το
 * ενσωματωμένο — γι᾽ αυτό οι ισχυρισμοί εδώ τρέχουν και πάνω σε προφίλ που το πραγματικό
 * αρχείο δεν παράγει ποτέ.
 */

import {
  compileProfile,
  findLabelOccurrences,
  GREEK_SURVEYOR_PROFILE,
  normalizeForLabelMatch,
  splitIntoWords,
  TITLE_BLOCK_FIELD_KEYS,
  type TitleBlockProfile,
} from '../title-block-vocabulary';

const occurrences = (text: string, profile = GREEK_SURVEYOR_PROFILE) =>
  findLabelOccurrences(splitIntoWords(text), compileProfile(profile));

describe('κανονικοποίηση σύγκρισης', () => {
  it('🔴 διπλώνει το λατινικό H του «ΣΥΝΤΑΞΗ» ΠΡΙΝ πέσουν τα πεζά', () => {
    // Η σειρά είναι ο ίδιος ο μηχανισμός: αν πρώτα πεζώσει, το λατινικό H γίνεται `h`,
    // που δεν είναι ομόγλυφο κανενός πεζού — και η βλάβη γίνεται μη αναστρέψιμη.
    expect(normalizeForLabelMatch('ΣΥΝΤΑΞ' + String.fromCodePoint(0x0048))).toBe(
      normalizeForLabelMatch('ΣΥΝΤΑΞΗ'),
    );
  });

  it('αφήνει άθικτα τα γνήσια λατινικά — δεν «ελληνοποιεί» ιστότοπους', () => {
    expect(normalizeForLabelMatch('www.nikolaou.com.gr')).toBe('wwwnikolaoucomgr');
  });

  it('η στίξη των συντομογραφιών δεν εμποδίζει τη σύγκριση', () => {
    expect(normalizeForLabelMatch('ΑΡ.ΣΧΕΔΙΟΥ')).toBe(normalizeForLabelMatch('ΑΡΣΧΕΔΙΟΥ'));
  });
});

describe('κόψιμο σε λέξεις', () => {
  it('κρατά τις θέσεις στο ΠΡΩΤΟΤΥΠΟ — εκεί κόβεται μετά η τιμή', () => {
    const [first, second] = splitIntoWords('ΕΡΓΟΔΟΤΗΣ: ΖΕΡΒΑ');
    expect(first).toMatchObject({ raw: 'ΕΡΓΟΔΟΤΗΣ', start: 0, end: 9 });
    expect(second).toMatchObject({ raw: 'ΖΕΡΒΑ', start: 11 });
  });

  it('τα σκέτα διαχωριστικά δεν είναι λέξεις', () => {
    expect(splitIntoWords('ΜΕΛΕΤΕΣ - ΕΦΑΡΜΟΓΕΣ').map((w) => w.raw)).toEqual([
      'ΜΕΛΕΤΕΣ',
      'ΕΦΑΡΜΟΓΕΣ',
    ]);
  });
});

describe('εντοπισμός ετικέτας', () => {
  it('🔴 το όριο λέξης εμποδίζει το «ΜΕΛΕΤΗ» να φάει το «ΜΕΛΕΤΗΣ»', () => {
    expect(occurrences('ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ').map((o) => o.key)).toEqual(['studyDate']);
    expect(occurrences('ΜΕΛΕΤΗΤΗΣ').map((o) => o.key)).toEqual(['designers']);
  });

  it('🔴 μακρύτερη ετικέτα ΠΡΩΤΑ — ακόμη κι όταν η κοντή είναι πρόθεμά της', () => {
    // Το ενσωματωμένο προφίλ δεν έχει τέτοιο ζεύγος, οπότε μόνο του δεν αποδεικνύει
    // τίποτα. Ένα δεύτερο γραφείο όμως το φτιάχνει με μία γραμμή δεδομένων — και τότε η
    // σειρά μεταγλώττισης είναι η διαφορά ανάμεσα στο «ΜΕΛΕΤΗ ΕΦΑΡΜΟΓΗΣ» και στο
    // «ΜΕΛΕΤΗ + ένα ξεκρέμαστο ΕΦΑΡΜΟΓΗΣ».
    const profile: TitleBlockProfile = {
      ...GREEK_SURVEYOR_PROFILE,
      rules: [
        { key: 'studyType', labels: ['ΜΕΛΕΤΗ'] },
        { key: 'drawingType', labels: ['ΜΕΛΕΤΗ ΕΦΑΡΜΟΓΗΣ'] },
      ],
    };
    const found = occurrences('ΜΕΛΕΤΗ ΕΦΑΡΜΟΓΗΣ: ΟΔΟΠΟΙΙΑ', profile);
    expect(found.map((o) => o.key)).toEqual(['drawingType']);
    expect(found[0].end).toBe('ΜΕΛΕΤΗ ΕΦΑΡΜΟΓΗΣ'.length);
  });

  it('ετικέτα που δεν ξεκινά το κελί εντοπίζεται, αλλά ξέρει ότι δεν είναι πρώτη', () => {
    const found = occurrences('ΕΡΓΟΔΟΤΗΣ : ... ΥΠΟΓΡΑΦΗ');
    expect(found.map((o) => [o.key, o.wordIndex])).toEqual([
      ['employer', 0],
      ['signature', 1],
    ]);
  });

  it('κείμενο χωρίς ετικέτα δεν παράγει ψεύτικες', () => {
    expect(occurrences('ΤΟΠΟΓΡΑΦΙΚΕΣ ΜΕΛΕΤΕΣ - ΕΦΑΡΜΟΓΕΣ')).toEqual([]);
    expect(occurrences('ΙΟΥΛΙΟΣ 2026')).toEqual([]);
  });
});

describe('το λεξιλόγιο πεδίων', () => {
  it('🔴 περιέχει ΣΥΝΤΑΞΗ και ΥΠΟΓΡΑΦΗ — αλλιώς μολύνουν το διπλανό πεδίο', () => {
    expect(TITLE_BLOCK_FIELD_KEYS).toContain('drawnBy');
    expect(TITLE_BLOCK_FIELD_KEYS).toContain('signature');
  });

  it('κάθε κλειδί έχει τουλάχιστον μία γραφή στο ενσωματωμένο προφίλ', () => {
    const covered = new Set(GREEK_SURVEYOR_PROFILE.rules.map((r) => r.key));
    expect([...TITLE_BLOCK_FIELD_KEYS].filter((k) => !covered.has(k))).toEqual([]);
  });

  it('καμία γραφή δεν είναι μοιρασμένη σε δύο κλειδιά — η αναγνώριση θα ήταν διφορούμενη', () => {
    const all = GREEK_SURVEYOR_PROFILE.rules.flatMap((r) =>
      r.labels.map((l) => normalizeForLabelMatch(l)),
    );
    expect(new Set(all).size).toBe(all.length);
  });
});
