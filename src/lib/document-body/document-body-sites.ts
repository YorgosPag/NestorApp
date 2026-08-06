/**
 * @fileoverview **Πού** ταιριάζει ένας κανόνας μέσα σε κείμενο, και **τι** κόβεται εκεί.
 *
 * 🔑 **Γιατί ξεχωριστό αρχείο από τον `read-document-body`.** Μέχρι τη Φ4 υπήρχε **ένας**
 * καταναλωτής (ο βαθμωτός αναγνώστης) και οι εντοπιστές ζούσαν μέσα του. Η Φ4β έφερε τον
 * **δεύτερο**: ο αναγνώστης των λιστών κάνει ακριβώς την ίδια δουλειά — «βρες την ετικέτα,
 * κόψε την τιμή» — αλλά πάνω σε **μία γραμμή** αντί για ολόκληρη ενότητα. Αντιγραμμένοι, οι
 * δύο θα απέκλιναν την ημέρα που αλλάξει ένας εντοπιστής, και ο έλεγχος του N.18 θα τους
 * έπιανε ως δίδυμα. Άρα: **οι εντοπιστές είναι ένα πράγμα, οι δύο αναγνώστες τούς καλούν**.
 *
 * ⚠️ Καμία συνάρτηση εδώ δεν ξέρει τι είναι «πεδίο» ή «γραμμή λίστας». Δέχονται κείμενο και
 * επιστρέφουν **κομμάτια κειμένου** — η σημασία μπαίνει ένα στρώμα πιο πάνω.
 *
 * @see ADR-759 §4.6 / §4.10
 * @module lib/document-body/document-body-sites
 */

import type { BodyMatch, BodyTake } from '@/config/document-body-vocabulary';
import { matchesWordSequenceAt, splitIntoWords, type TextWord } from '@/utils/greek-text';
import {
  cleanToken,
  hasShape,
  takeList,
  takeMarked,
  takeNumberLiteral,
  takeRest,
  takeToken,
  takeUntil,
} from './document-body-values';

/** Οι λέξεις μιας φράσης καταλόγου, σε μορφή σύγκρισης. */
export const phraseOf = (text: string): readonly string[] =>
  splitIntoWords(text).map((word) => word.normalized);

/** Τα τμήματα μιας γραμμής: ό,τι υπάρχει ανάμεσα σε στηλοθέτες — οι στήλες της φόρμας. */
export const segmentsOf = (line: string): readonly string[] => line.split('\t');

/** Πού ταίριαξε ένας κανόνας, με ό,τι χρειάζεται το `take` για να κόψει την τιμή. */
export interface MatchSite {
  /** Το κείμενο μέσα στο οποίο κόβεται η τιμή (τμήμα ή ολόκληρη γραμμή). */
  readonly text: string;
  readonly words: readonly TextWord[];
  /** Δείκτης της πρώτης λέξης **μετά** την ετικέτα. */
  readonly from: number;
  /** Θέση χαρακτήρα όπου αρχίζει/τελειώνει η ετικέτα (ίσες όταν δεν υπάρχει ετικέτα). */
  readonly labelStart: number;
  readonly labelEnd: number;
  /** Η ολόκληρη γραμμή — το συμφραζόμενο που δείχνεται στον άνθρωπο. */
  readonly line: string;
}

/** Ένα σημείο χωρίς ετικέτα: όλο το κείμενο, από την αρχή του. */
function wholeTextSite(text: string, line: string): MatchSite {
  return { text, words: splitIntoWords(text), from: 0, labelStart: 0, labelEnd: 0, line };
}

// ── Εντοπιστές ────────────────────────────────────────────────────────────────

/** Κάθε τμήμα που **αρχίζει** με μία από τις ετικέτες, με τη σειρά που γράφτηκαν. */
export function findAtSegmentStart(
  lines: readonly string[],
  labels: readonly string[],
): MatchSite[] {
  const sites: MatchSite[] = [];
  for (const line of lines) {
    for (const segment of segmentsOf(line)) {
      const words = splitIntoWords(segment);
      if (words.length === 0) continue;
      for (const label of labels) {
        const phrase = phraseOf(label);
        if (phrase.length === 0 || !matchesWordSequenceAt(words, 0, phrase)) continue;
        sites.push({
          text: segment,
          words,
          from: phrase.length,
          labelStart: words[0].start,
          labelEnd: words[phrase.length - 1].end,
          line,
        });
      }
    }
  }
  return sites;
}

/** Κάθε εμφάνιση μιας φράσης **οπουδήποτε** μέσα σε γραμμή. */
export function findLeadIn(lines: readonly string[], labels: readonly string[]): MatchSite[] {
  const sites: MatchSite[] = [];
  for (const line of lines) {
    const words = splitIntoWords(line);
    for (let i = 0; i < words.length; i += 1) {
      for (const label of labels) {
        const phrase = phraseOf(label);
        if (phrase.length === 0 || !matchesWordSequenceAt(words, i, phrase)) continue;
        sites.push({
          text: line,
          words,
          from: i + phrase.length,
          labelStart: words[i].start,
          labelEnd: words[i + phrase.length - 1].end,
          line,
        });
      }
    }
  }
  return sites;
}

/** Η πρώτη γραμμή με περιεχόμενο — η πρόζα κάτω από την επικεφαλίδα. */
export function findSectionProse(lines: readonly string[]): MatchSite[] {
  for (const line of lines) {
    if (splitIntoWords(line).length === 0) continue;
    return [wholeTextSite(line, line)];
  }
  return [];
}

/**
 * Η **τελευταία** γραμμή που τελειώνει σε ημερομηνία — η γραμμή υπογραφής.
 *
 * Σαρώνει από το τέλος γιατί αυτό ακριβώς ρωτάμε: *πότε υπογράφτηκε*. Το ίδιο έγγραφο
 * περιέχει τέσσερις άλλες ημερομηνίες (ΦΕΚ, απόφαση νομάρχη, μεταγραφή), **καμία** στο τέλος
 * γραμμής — άρα το κριτήριο δεν είναι απλώς «η τελευταία που βρήκα».
 */
export function findLineTailDate(lines: readonly string[]): MatchSite[] {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const words = splitIntoWords(lines[i]);
    const last = words[words.length - 1];
    if (!last || !hasShape(last, 'date')) continue;
    return [
      {
        text: lines[i],
        words,
        from: words.length - 1,
        labelStart: last.start,
        labelEnd: last.start,
        line: lines[i],
      },
    ];
  }
  return [];
}

/**
 * Η **πρώτη λέξη με το ζητούμενο σχήμα**, οπουδήποτε στη γραμμή.
 *
 * 🔴 **Γεννήθηκε από μετρημένο εύρημα (ADR-759 §2β.7): η ενότητα Ι έχει ΔΥΟ διαφορετικούς
 * διαχωριστές στις τρεις της γραμμές** — `2946 **-** 18/01/1993` και `475**,** 25/06/2004`.
 * Κάθε κανόνας θέσης ή διαχωριστή διαβάζει **μία από τις τρεις**. Το σχήμα δεν εξαρτάται από
 * κανέναν από τους δύο: η ημερομηνία είναι ημερομηνία όπως κι αν χωρίστηκε από τον αριθμό.
 */
export function findFirstOfShape(
  lines: readonly string[],
  shape: Parameters<typeof hasShape>[1],
): MatchSite[] {
  for (const line of lines) {
    const words = splitIntoWords(line);
    const index = words.findIndex((word) => hasShape(word, shape));
    if (index < 0) continue;
    return [
      {
        text: line,
        words,
        from: index,
        labelStart: words[index].start,
        labelEnd: words[index].start,
        line,
      },
    ];
  }
  return [];
}

/** Ένα **συγκεκριμένο τμήμα** (στήλη) της γραμμής — η θέση είναι η ετικέτα. */
export function findSegment(lines: readonly string[], index: number): MatchSite[] {
  const sites: MatchSite[] = [];
  for (const line of lines) {
    const segment = segmentsOf(line)[index];
    if (segment === undefined || splitIntoWords(segment).length === 0) continue;
    sites.push(wholeTextSite(segment, line));
  }
  return sites;
}

/** Ολόκληρο το κείμενο, χωρίς ετικέτα — για κανόνες που κόβουν από την αρχή. */
export function findWhole(lines: readonly string[]): MatchSite[] {
  const text = lines.join(' ');
  return splitIntoWords(text).length === 0 ? [] : [wholeTextSite(text, text)];
}

/**
 * **Όλα** τα σημεία όπου ταιριάζει ο κανόνας — όχι μόνο το πρώτο.
 *
 * 🔴 Μετρημένο: στη «ΔΗΛΩΣΗ ΤΟΥ Ν.651/77» η λέξη «στις» εμφανίζεται **δύο** φορές — «υπάγεται
 * **στις** διατάξεις του Ν.1337/83» και «**στις** 2-5-1996». Με «η πρώτη εμφάνιση κερδίζει», η
 * ημερομηνία μεταγραφής **χανόταν σιωπηλά**, γιατί μετά την πρώτη ακολουθεί λέξη και όχι
 * ημερομηνία. Ο κανόνας που ισχύει είναι: **η πρώτη εμφάνιση που δίνει τιμή του δηλωμένου
 * σχήματος** — ο έλεγχος σχήματος είναι ήδη ο φύλακας, οπότε η σάρωση όλων δεν χαλαρώνει
 * τίποτα· αντίθετα, είναι ο ίδιος μηχανισμός που κρατά το «Π.Ε. 39» έξω από την Περιφερειακή
 * Ενότητα ακόμη κι αν προηγηθεί στο κείμενο.
 */
export function findSites(match: BodyMatch, lines: readonly string[]): MatchSite[] {
  switch (match.at) {
    case 'segment-start':
      return findAtSegmentStart(lines, match.labels);
    case 'lead-in':
      return findLeadIn(lines, match.labels);
    case 'section-prose':
      return findSectionProse(lines);
    case 'line-tail-date':
      return findLineTailDate(lines);
    case 'first-of-shape':
      return findFirstOfShape(lines, match.shape);
    case 'segment':
      return findSegment(lines, match.index);
    case 'whole':
      return findWhole(lines);
  }
}

// ── Κοπή ──────────────────────────────────────────────────────────────────────

/**
 * Τι κρατά ο κανόνας από το σημείο που ταίριαξε — **πάντα πίνακας**.
 *
 * 🔑 Ο πίνακας δεν είναι υπερβολή για τα βαθμωτά: το `marked/each` παράγει **περισσότερα από
 * ένα** κομμάτια από την ίδια γραμμή (η γραμμή `Γ.Π.Σ.` φέρει **δύο** ΦΕΚ). Με δύο ξεχωριστές
 * συναρτήσεις κοπής — μία «μία τιμή», μία «πολλές» — οι δύο θα ήταν δίδυμα που αποκλίνουν·
 * με μία, το βαθμωτό είναι απλώς «ο πίνακας με το πολύ ένα στοιχείο».
 */
export function cut(site: MatchSite, take: BodyTake): readonly string[] {
  const one = (value: string | null): readonly string[] => (value === null ? [] : [value]);

  switch (take.as) {
    case 'rest':
      return one(takeRest(site.text, site.labelEnd));
    case 'token':
      return one(takeToken(site.words, site.from, take.shape));
    case 'list':
      return one(takeList(site.text, site.words, site.from, take.shape));
    case 'number':
      return one(takeNumberLiteral(site.text.slice(site.labelEnd), take.unit, take.select));
    case 'phrase':
      return one(cleanToken(site.text.slice(site.labelStart, site.labelEnd)));
    case 'whole':
      return one(cleanToken(site.text.slice(site.labelEnd)) || null);
    case 'until':
      return one(takeUntil(site.text, site.words, site.from, take.stopAt));
    case 'marked':
      return takeMarked(site.text, site.words, take.marker, take.keep);
  }
}

/** Η **μία** τιμή ενός βαθμωτού κανόνα — ο πίνακας της {@link cut} με το πολύ ένα στοιχείο. */
export function cutOne(site: MatchSite, take: BodyTake): string | null {
  return cut(site, take)[0] ?? null;
}
