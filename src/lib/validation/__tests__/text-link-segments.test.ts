/**
 * @fileoverview ADR-751 — κείμενο → τμήματα συνδέσμων, **με θέσεις**.
 *
 * Ο λόγος που το module υπάρχει είναι ότι οι υπάρχοντες εξαγωγείς πετούν τις θέσεις. Άρα
 * τα tests εδώ δεν επαναλαμβάνουν «βρίσκει το τηλέφωνο;» — αυτό το κλειδώνει ήδη το
 * `text-extraction.test.ts` — αλλά «**πού** είναι, και **επιβιώνει ολόκληρο το κείμενο**;».
 *
 * Οι τρεις εγγυήσεις του module (χωρίς κενά · χωρίς επικάλυψη · θέσεις στο ΑΡΧΙΚΟ string)
 * είναι το πράγμα που θα σπάσει σιωπηλά αν κάποιος «βελτιώσει» ένα regex — γι' αυτό
 * ελέγχονται ως **ιδιότητες πάνω σε όλα τα δείγματα**, όχι μία φορά σε ένα ευνοϊκό.
 */

import {
  hasTextLink,
  splitTextIntoLinkSegments,
  type TextLinkSegment,
} from '../text-link-segments';

/** Το κελί της οθόνης του Giorgio, η γραμμή πινακίδας του G753, και ό,τι τα περιβάλλει. */
const SAMPLES: readonly string[] = [
  '',
  'georgios.pagonis@gmail.com',
  'ΕΔΡΑ ΝΕΟΧΩΡΟΥΔΑ 2310-788493 κιν 6949727121',
  'Τηλ: 2310788493',
  'Επικοινωνία: info@nestorconstruct.gr · www.nestorconstruct.gr · 6949727121',
  'Ο.Τ. Γ 753 - ΟΙΚ.: 01β - 1:200',
  'ΙΟΥΛΙΟΣ 2026',
  'δες www.nestorconstruct.gr/έργα, μετά',
  'support2310788493@example.gr',
  'https://www.nestorconstruct.gr',
  '2310788493 6949727121',
  'χωρίς τίποτα εδώ',
  '   ',
];

const rejoin = (segments: readonly TextLinkSegment[]): string =>
  segments.map((segment) => segment.text).join('');

const linksOf = (text: string): readonly TextLinkSegment[] =>
  splitTextIntoLinkSegments(text).filter((segment) => segment.kind !== 'text');

describe('splitTextIntoLinkSegments — οι τρεις εγγυήσεις, σε ΚΑΘΕ δείγμα', () => {
  it.each(SAMPLES)('τα τμήματα ξανασυνθέτουν ακριβώς το αρχικό: %p', (source) => {
    expect(rejoin(splitTextIntoLinkSegments(source))).toBe(source);
  });

  it.each(SAMPLES)('κάθε θέση δείχνει στο ΑΡΧΙΚΟ string: %p', (source) => {
    for (const segment of splitTextIntoLinkSegments(source)) {
      expect(source.slice(segment.start, segment.end)).toBe(segment.text);
    }
  });

  it.each(SAMPLES)('τα τμήματα είναι συνεχόμενα και δεν επικαλύπτονται: %p', (source) => {
    let cursor = 0;
    for (const segment of splitTextIntoLinkSegments(source)) {
      expect(segment.start).toBe(cursor);
      expect(segment.end).toBeGreaterThan(segment.start);
      cursor = segment.end;
    }
    expect(cursor).toBe(source.length);
  });

  it.each(SAMPLES)('κανένα κενό τμήμα δεν παράγεται: %p', (source) => {
    for (const segment of splitTextIntoLinkSegments(source)) {
      expect(segment.text).not.toBe('');
    }
  });
});

describe('η περίπτωση της οθόνης — κελί που είναι ΟΛΟ ένας σύνδεσμος', () => {
  it('ένα σκέτο e-mail γίνεται ΕΝΑ τμήμα, χωρίς κείμενο γύρω του', () => {
    const segments = splitTextIntoLinkSegments('georgios.pagonis@gmail.com');
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      kind: 'email',
      text: 'georgios.pagonis@gmail.com',
      start: 0,
      end: 26,
      href: 'mailto:georgios.pagonis@gmail.com',
    });
  });

  it('ένα τμήμα σημαίνει μηδενική απόκλιση kerning: το κελί ζωγραφίζεται όπως πριν', () => {
    // Δεν είναι διακοσμητικό test. Η τοποθέτηση πολλαπλών τμημάτων μετράει προθέματα, που
    // χάνει το ζεύγος kerning στο όριο· όταν το τμήμα είναι ΕΝΑ, όριο δεν υπάρχει.
    expect(splitTextIntoLinkSegments('info@a.gr')).toHaveLength(1);
    expect(splitTextIntoLinkSegments('www.a.gr')).toHaveLength(1);
    expect(splitTextIntoLinkSegments('6949727121')).toHaveLength(1);
  });
});

describe('μικτό κείμενο — υπογραμμίζεται ΜΟΝΟ το τμήμα του συνδέσμου', () => {
  it('«Τηλ: 2310788493» → πρόλογος + τηλέφωνο', () => {
    expect(splitTextIntoLinkSegments('Τηλ: 2310788493')).toEqual([
      { kind: 'text', text: 'Τηλ: ', start: 0, end: 5 },
      { kind: 'phone', text: '2310788493', start: 5, end: 15, href: 'tel:2310788493' },
    ]);
  });

  it('η πραγματική γραμμή πινακίδας: δύο τηλέφωνα, με το κείμενο ανάμεσα άθικτο', () => {
    const source = 'ΕΔΡΑ ΝΕΟΧΩΡΟΥΔΑ 2310-788493 κιν 6949727121';
    const links = linksOf(source);
    expect(links.map((l) => l.text)).toEqual(['2310-788493', '6949727121']);
    // Ο σύνδεσμος κρατά την παύλα όπως γράφτηκε· ο προορισμός την καθαρίζει.
    expect(links.map((l) => l.href)).toEqual(['tel:2310788493', 'tel:6949727121']);
  });

  it('δύο τηλέφωνα χωρισμένα ΜΟΝΟ με κενό παίρνουν χωριστές θέσεις', () => {
    const links = linksOf('2310788493 6949727121');
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({ start: 0, end: 10 });
    expect(links[1]).toMatchObject({ start: 11, end: 21 });
  });

  it('τρία είδη στην ίδια γραμμή, με τη σειρά που γράφτηκαν', () => {
    const source = 'Επικοινωνία: info@nestorconstruct.gr · www.nestorconstruct.gr · 6949727121';
    expect(linksOf(source).map((l) => l.kind)).toEqual(['email', 'url', 'phone']);
  });
});

describe('επικαλύψεις — ένας χαρακτήρας ανήκει σε ΕΝΑ τμήμα', () => {
  it('τηλέφωνο κρυμμένο μέσα σε e-mail δεν σπάει το e-mail στα δύο', () => {
    const segments = splitTextIntoLinkSegments('support2310788493@example.gr');
    expect(segments).toHaveLength(1);
    expect(segments[0].kind).toBe('email');
  });

  it('το e-mail δεν διαβάζεται ποτέ και ως ιστοσελίδα', () => {
    expect(linksOf('info@nestorconstruct.gr').map((l) => l.kind)).toEqual(['email']);
  });
});

describe('όρια τμημάτων — ο σύνδεσμος δεν παίρνει μαζί του σημεία στίξης', () => {
  it('το κόμμα μετά από διεύθυνση μένει έξω από τον σύνδεσμο', () => {
    const links = linksOf('δες www.nestorconstruct.gr/έργα, μετά');
    expect(links).toHaveLength(1);
    expect(links[0].text).toBe('www.nestorconstruct.gr/έργα');
    expect(links[0].href).toBe('https://www.nestorconstruct.gr/έργα');
  });

  it('το τηλέφωνο δεν παίρνει μαζί το κενό που ακολουθεί', () => {
    const links = linksOf('2310-788493 και τέλος');
    expect(links[0].text).toBe('2310-788493');
    expect(links[0].end).toBe(11);
  });

  it('διεύθυνση με σχήμα μένει ως έχει· χωρίς σχήμα παίρνει https', () => {
    expect(linksOf('https://www.nestorconstruct.gr')[0].href).toBe('https://www.nestorconstruct.gr');
    expect(linksOf('www.nestorconstruct.gr')[0].href).toBe('https://www.nestorconstruct.gr');
  });
});

describe('δεν επινοεί συνδέσμους', () => {
  it('αριθμοί σχεδίου και ημερομηνίες μένουν κείμενο', () => {
    expect(linksOf('Ο.Τ. Γ 753 - ΟΙΚ.: 01β - 1:200')).toEqual([]);
    expect(linksOf('ΙΟΥΛΙΟΣ 2026')).toEqual([]);
  });

  it('κείμενο χωρίς τίποτα δίνει ΕΝΑ τμήμα κειμένου', () => {
    expect(splitTextIntoLinkSegments('χωρίς τίποτα εδώ')).toEqual([
      { kind: 'text', text: 'χωρίς τίποτα εδώ', start: 0, end: 16 },
    ]);
  });

  it('κενό κείμενο δίνει κανένα τμήμα', () => {
    expect(splitTextIntoLinkSegments('')).toEqual([]);
  });
});

describe('η διέξοδος για αριθμητικά κελιά', () => {
  // Ελληνικό σταθερό = «2» + εννιά ψηφία. Μια δεκαψήφια ποσότητα ή ένας κωδικός είναι
  // αδιάκριτος από τηλέφωνο· ο πίνακας ξέρει ότι το κελί είναι υπολογισμένο, το regex όχι.
  it('δεκαψήφιος αριθμός ΕΙΝΑΙ έγκυρο τηλέφωνο — γι᾽ αυτό υπάρχει η διέξοδος', () => {
    expect(linksOf('2000000000')).toHaveLength(1);
  });

  it('με kinds χωρίς phone, ο ίδιος αριθμός μένει κείμενο', () => {
    const segments = splitTextIntoLinkSegments('2000000000', { kinds: ['email', 'url'] });
    expect(segments).toEqual([{ kind: 'text', text: '2000000000', start: 0, end: 10 }]);
  });

  it('ο αποκλεισμός των τηλεφώνων δεν αγγίζει τα άλλα είδη', () => {
    const source = 'info@a.gr 2310788493';
    const kinds = splitTextIntoLinkSegments(source, { kinds: ['email', 'url'] })
      .filter((s) => s.kind !== 'text')
      .map((s) => s.kind);
    expect(kinds).toEqual(['email']);
  });
});

describe('hasTextLink συμφωνεί με splitTextIntoLinkSegments', () => {
  // 🔴 Δύο μονοπάτια για την ίδια ερώτηση μπορούν να αποκλίνουν. Το φθηνό υπάρχει επειδή
  // τρέχει σε κάθε κίνηση ποντικιού πάνω από πίνακα· αν πει «όχι» εκεί που το πλήρες λέει
  // «ναι», ο σύνδεσμος ζωγραφίζεται αλλά ο δείκτης δεν αλλάζει ποτέ — αόρατο ελάττωμα.
  it.each(SAMPLES)('ίδια απάντηση για: %p', (source) => {
    expect(hasTextLink(source)).toBe(linksOf(source).length > 0);
  });

  it.each(SAMPLES)('ίδια απάντηση και με περιορισμένα είδη: %p', (source) => {
    const kinds = ['email', 'url'] as const;
    const full = splitTextIntoLinkSegments(source, { kinds }).some((s) => s.kind !== 'text');
    expect(hasTextLink(source, { kinds })).toBe(full);
  });
});
