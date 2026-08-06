/**
 * @fileoverview Πώς κόβεται μια **τιμή** μέσα από πρόζα (Λ1β, ADR-759 §4.6).
 *
 * 🔴 **Κάθε συνάρτηση εδώ επιστρέφει ΚΟΜΜΑΤΙ ΚΕΙΜΕΝΟΥ, ποτέ τιμή τύπου.** Ο εντοπισμός και η
 * ανάλυση είναι δύο δουλειές: η ανάλυση ζει **μία** φορά, στο `SURVEY_BINDING_SPECS[…].parse`,
 * και είναι η ίδια για την πινακίδα και για το σώμα. Ένας δεύτερος αναλυτής εδώ θα σήμαινε ότι
 * την ημέρα που αλλάξει ο κανόνας, οι δύο διαδρομές θα γράφουν **διαφορετική τιμή για το ίδιο
 * σχέδιο** — σιωπηλά, και με το όνομα του μηχανικού πάνω.
 *
 * Ο αριθμός αναλύεται **μόνο** εσωτερικά, για να απαντηθεί «ποιος από τους τέσσερις;» — και το
 * αποτέλεσμα της επιλογής είναι πάλι το **κείμενο** εκείνου του αριθμού.
 *
 * @module lib/document-body/document-body-values
 */

import { parseStrictDecimal } from '@/lib/survey-record/survey-number';
import {
  matchesWordSequenceAt,
  normalizeGreekHomoglyphs,
  splitIntoWords,
  type TextWord,
} from '@/utils/greek-text';
import type { BodyMeasureUnit, BodyNumberSelect, BodyTokenShape } from '@/config/document-body-vocabulary';

// ── Λέξεις ────────────────────────────────────────────────────────────────────

/**
 * Χαρακτήρες που περιβάλλουν λέξη χωρίς να της ανήκουν.
 *
 * Το «17).» και το «Νεάπολης.» είναι **μία** λέξη για τον `splitIntoWords` (η στίξη μπαίνει
 * στο ίδιο run), οπότε η αποθηκευμένη τιμή θα κουβαλούσε την παρένθεση της πρότασης.
 */
const EDGE_PUNCTUATION = /^[\s.,;:()]+|[\s.,;:()]+$/g;

/** Λέξη → η μορφή που **αποθηκεύεται**: αυτούσια, χωρίς τη στίξη της πρότασης γύρω της. */
export function cleanToken(raw: string): string {
  return raw.replace(EDGE_PUNCTUATION, '');
}

/** Ημερομηνία όπως τη γράφει το σχέδιο: `30/7/2026`, `2-5-1996`, `18.01.1993`. */
const DATE_TOKEN = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/;

/**
 * Έχει η λέξη το σχήμα που απαιτεί ο κανόνας;
 *
 * 🔴 **Αυτό είναι που ξεχωρίζει τις τρεις σημασίες του «Π.Ε.»** (ADR-759 §2β.3): αριθμός ⇒
 * Πράξη Εφαρμογής· όνομα ⇒ Περιφερειακή Ενότητα. Και τα δύο υπάρχουν στο **ίδιο** αρχείο, και
 * η διάκριση **δεν** βγαίνει από τη μορφή του ακρωνυμίου — βγαίνει από το τι ακολουθεί.
 */
export function hasShape(word: TextWord, shape: BodyTokenShape): boolean {
  switch (shape) {
    case 'digits':
      return /^\d+$/.test(word.normalized);
    // Ένα και μόνο γράμμα: οι κορυφές του οικοπέδου (`Α,Β,Γ,Δ,Α`). Χωρίς αυτόν τον
    // περιορισμό η λίστα θα ρουφούσε τη συνέχεια της πρότασης («…Α, στο Ο.Τ. Γ 753»).
    case 'letter':
      return /^\p{L}$/u.test(word.normalized);
    case 'letters':
      return /^\p{L}+$/u.test(word.normalized);
    case 'date':
      return DATE_TOKEN.test(cleanToken(word.raw));
    case 'any':
      return word.normalized.length > 0;
  }
}

/**
 * Λέξεις που **συνδέουν** μέλη λίστας χωρίς να είναι μέλη.
 *
 * «Πολεοδομικών Ενοτήτων 16 **και** 17»: χωρίς αυτό η λίστα σταματά στο πρώτο μέλος. Το `&`
 * («012431 **&** 012432») δεν χρειάζεται — ο `splitIntoWords` το ρίχνει ήδη ως διαχωριστικό.
 */
const LIST_CONNECTORS: readonly string[] = ['και'];

// ── Αριθμοί ───────────────────────────────────────────────────────────────────

/**
 * Αριθμητικό κυριολεκτικό σε **ελληνική** γραφή.
 *
 * Η πρώτη εναλλακτική απαιτεί ομάδα χιλιάδων (`1.364,05`), η δεύτερη καλύπτει τα υπόλοιπα
 * (`500`, `0,8`, `20`). Η σειρά μετράει: αντίστροφα, το «1.364,05» θα διαβαζόταν ως «1».
 */
const NUMBER_LITERAL = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g;

/** Οι γραφές κάθε μονάδας, **μακρύτερη πρώτα** ώστε το `τ.μ.` να μη διαβαστεί ως `μ.`. */
const UNIT_SPELLINGS: Record<BodyMeasureUnit, readonly string[]> = {
  none: [],
  metre: ['μ.', 'μ'],
  squareMetre: ['τ.μ.', 'τ.μ', 'τμ.', 'τμ'],
  percent: ['%'],
};

interface NumberHit {
  readonly literal: string;
  readonly value: number;
  readonly end: number;
}

/**
 * Ακολουθεί τον αριθμό η μονάδα που περιμένουμε;
 *
 * ⚠️ **Ο έλεγχος «δεν ακολουθεί γράμμα» δεν είναι σχολαστικισμός**: χωρίς αυτόν η γραφή `μ`
 * της μονάδας «μέτρα» ταιριάζει στο **«μέγιστο»**, και το «Ποσοστό κάλυψης 50%, 60% (μέγιστο…)»
 * θα έδινε «60 μέτρα». Ένας εύλογος αριθμός σε λάθος μέγεθος είναι χειρότερος από κανέναν.
 */
function unitFollows(text: string, from: number, unit: BodyMeasureUnit): boolean {
  if (unit === 'none') return true;
  const after = normalizeGreekHomoglyphs(text.slice(from)).replace(/^\s+/, '').toLowerCase();
  return UNIT_SPELLINGS[unit].some((spelling) => {
    if (!after.startsWith(spelling.toLowerCase())) return false;
    const next = after.charAt(spelling.length);
    return next === '' || !/\p{L}/u.test(next);
  });
}

/** Όλοι οι αριθμοί του κειμένου που φέρουν τη ζητούμενη μονάδα, με τη σειρά που γράφτηκαν. */
function scanNumbers(text: string, unit: BodyMeasureUnit): NumberHit[] {
  const hits: NumberHit[] = [];
  for (const match of text.matchAll(NUMBER_LITERAL)) {
    const end = match.index + match[0].length;
    if (!unitFollows(text, end, unit)) continue;
    const value = parseStrictDecimal(match[0]);
    if (value === null) continue;
    hits.push({ literal: match[0], value, end });
  }
  return hits;
}

/** Ανοχή ισότητας αθροίσματος — το `0,8 + 0,5` δίνει `1,3000000000000003` σε δυαδικό κινητό. */
const SUM_EPSILON = 1e-9;

/**
 * Η **μοναδική** τριάδα «α + β = γ» μέσα σε μια σειρά αριθμών.
 *
 * 🔑 Ο Συντελεστής Δόμησης γράφεται *«0,8 με κοινωνικό συντελεστή 0,8+0,5 = 1,3»*: **τέσσερις**
 * αριθμοί, ο πρώτος επαναλαμβανόμενος. Η επιλογή με θέση («ο 1ος, ο 3ος, ο 4ος») είναι
 * απομνημόνευση **αυτής** της διατύπωσης· η σχέση «βασικός + κοινωνικός = σύνολο» είναι ο
 * **ορισμός** των τριών μεγεθών και διαλέγει σωστά ό,τι σειρά κι αν έχουν.
 *
 * ⚠️ Επιστρέφει `null` όταν οι τριάδες που κλείνουν είναι **περισσότερες από μία** (με
 * διαφορετικές τιμές): αμφισημία δεν λύνεται με «πάρε την πρώτη». Η αποτυχία εδώ σημαίνει ότι
 * το πεδίο δεν προτείνεται — που είναι σωστό, γιατί το εναλλακτικό είναι να γραφτεί λάθος
 * συντελεστής δόμησης σε βεβαίωση μηχανικού.
 */
export function uniqueSumTriple(
  values: readonly number[],
): { readonly a: number; readonly b: number; readonly total: number } | null {
  // Το `j > i` αποκλείει εξ ορισμού το κάτοπτρο «β+α»· η δεδομένη σειρά αποκαθίσταται στο τέλος.
  const found: { lo: number; hi: number; total: number }[] = [];

  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      for (let k = 0; k < values.length; k += 1) {
        if (k === i || k === j) continue;
        const [a, b, total] = [values[i], values[j], values[k]];
        if (a <= 0 || b <= 0) continue;
        if (Math.abs(a + b - total) > SUM_EPSILON) continue;
        // Οι **θέσεις** είναι πολλές όταν μια τιμή επαναλαμβάνεται («0,8» δύο φορές)·
        // οι **τιμές** πρέπει να είναι μία, αλλιώς δεν ξέρουμε ποια τριάδα εννοεί το σχέδιο.
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        if (!found.some((f) => f.lo === lo && f.hi === hi && f.total === total)) {
          found.push({ lo, hi, total });
        }
      }
    }
  }

  if (found.length !== 1) return null;

  // «α» είναι ο προσθετέος που **γράφτηκε πρώτος** — στην ελληνική διατύπωση ο βασικός
  // συντελεστής προηγείται του κοινωνικού («0,8 + 0,5 = 1,3»).
  const { lo, hi, total } = found[0];
  const firstIndexOf = (value: number): number => values.findIndex((v) => v === value);
  const a = firstIndexOf(lo) <= firstIndexOf(hi) ? lo : hi;
  return { a, b: a === lo ? hi : lo, total };
}

/** Το **κείμενο** του αριθμού που ζητά ο κανόνας — ποτέ ο ίδιος ο αριθμός. */
export function takeNumberLiteral(
  text: string,
  unit: BodyMeasureUnit,
  select: BodyNumberSelect,
): string | null {
  const hits = scanNumbers(text, unit);
  if (hits.length === 0) return null;

  if ('nth' in select) {
    const hit = hits[select.nth - 1];
    return hit ? hit.literal : null;
  }

  const triple = uniqueSumTriple(hits.map((h) => h.value));
  if (!triple) return null;
  const wanted = select.sum === 'addend-a' ? triple.a : select.sum === 'addend-b' ? triple.b : triple.total;
  const hit = hits.find((h) => h.value === wanted);
  return hit ? hit.literal : null;
}

// ── Λέξεις μετά από ετικέτα ───────────────────────────────────────────────────

/** Η πρώτη λέξη από τη θέση `from`, **αν** έχει το ζητούμενο σχήμα. */
export function takeToken(
  words: readonly TextWord[],
  from: number,
  shape: BodyTokenShape,
): string | null {
  const word = words[from];
  if (!word || !hasShape(word, shape)) return null;
  const cleaned = cleanToken(word.raw);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Οι συνεχόμενες λέξεις **ίδιου σχήματος** από τη θέση `from`, ως ενιαίο κείμενο.
 *
 * Επιστρέφει το **κομμάτι του πρωτοτύπου** («Α,Β,Γ,Δ,Α»), όχι έτοιμη λίστα: το σπάσιμο σε
 * μέλη είναι ανάλυση, και η ανάλυση ζει στο `parse` του πεδίου.
 */
export function takeList(
  text: string,
  words: readonly TextWord[],
  from: number,
  shape: BodyTokenShape,
): string | null {
  let last = -1;
  let i = from;

  while (i < words.length) {
    if (hasShape(words[i], shape)) {
      last = i;
      i += 1;
      continue;
    }
    // Σύνδεσμος: προχωρά **μόνο** αν ακολουθεί κι άλλο μέλος — αλλιώς η λίστα τελείωσε.
    const isConnector = LIST_CONNECTORS.includes(words[i].normalized);
    const nextIsMember = i + 1 < words.length && hasShape(words[i + 1], shape);
    if (isConnector && nextIsMember) {
      i += 1;
      continue;
    }
    break;
  }

  if (last < from) return null;
  // `cleanToken` και στο **τέλος του κομματιού**: το τελευταίο μέλος κουβαλά τη στίξη της
  // πρότασης («…16 και 17**).**»), γιατί ο `splitIntoWords` βάζει παρενθέσεις και τελείες
  // στο ίδιο run με τη λέξη.
  return cleanToken(text.slice(words[from].start, words[last].end).trim());
}

/**
 * Διαχωριστικά που χωρίζουν ετικέτα από τιμή και **δεν** ανήκουν σε καμία από τις δύο.
 *
 * 🔴 **Η τελεία μέσα σε αυτή την κλάση είναι ο λόγος που το τυπωμένο κενό δεν γίνεται τιμή**
 * (ADR-759 §2β.7). Η ενότητα Θ γράφει `Αρ. Πρωτ.: ....................` — **είκοσι τελείες**,
 * που είναι το τυπωμένο κενό ενός εντύπου, όχι αριθμός πρωτοκόλλου. Επειδή η τελεία μετράει
 * ως διαχωριστικό, το `takeRest` προσπερνά ολόκληρη τη σειρά και φτάνει στην **αρχή που θα το
 * συμπληρώσει** («Εφορεία Αρχαιοτήτων Πόλης Θεσσαλονίκης»). Βγάζοντας την τελεία από εδώ, η
 * αποθηκευμένη τιμή γίνεται `....................` — τιμή εύλογη στη μορφή και ανύπαρκτη στην
 * πραγματικότητα (§2β.5). Το φυλάει ρητό test.
 */
const LABEL_VALUE_SEPARATOR = /^[\s:=.\-–·]+/;

/** Ό,τι απομένει μετά την ετικέτα, χωρίς το διαχωριστικό της. */
export function takeRest(text: string, fromIndex: number): string | null {
  const rest = text.slice(fromIndex).replace(LABEL_VALUE_SEPARATOR, '').trim();
  return rest.length > 0 ? rest : null;
}

// ── Τιμές που εκτείνονται σε ΠΟΛΛΕΣ λέξεις ────────────────────────────────────

/**
 * Οι λέξεις από τη θέση `from` **μέχρι** την πρώτη φράση-τερματιστή (ή το τέλος).
 *
 * 🔑 Χρειάστηκε επειδή η ενότητα Ι γράφει **τρία πράγματα σε σειρά χωρίς στηλοθέτη**:
 * «Συμβόλαιο **Γονικής Παροχής** ΣΥΜΒ/ΦΟΣ ΘΕΣ/ ΝΙΚΗΣ **ΚΩΝΣΤΑΝΤΙΝΑ ΚΑΛΟΓΙΑΝΝΗ**. Μεταγράφηκε…».
 * Το είδος της πράξης είναι **δύο** λέξεις, το όνομα **δύο**, και καμία από τις δύο τιμές δεν
 * έχει σταθερό πλήθος λέξεων. Ο τερματιστής είναι η **επόμενη σημαδούρα**, που στην πρόζα
 * αυτής της γραμμής βρίσκεται **δίπλα** — όχι σαράντα λέξεις μακριά, που είναι η περίπτωση
 * που το docblock του λεξιλογίου απαγορεύει.
 */
export function takeUntil(
  text: string,
  words: readonly TextWord[],
  from: number,
  stopAt: readonly string[],
): string | null {
  const stops = stopAt.map((phrase) => splitIntoWords(phrase).map((w) => w.normalized));
  let end = from;
  while (end < words.length) {
    const stopped = stops.some(
      (phrase) => phrase.length > 0 && matchesWordSequenceAt(words, end, phrase),
    );
    if (stopped) break;
    end += 1;
  }
  if (end === from) return null;
  const cleaned = cleanToken(text.slice(words[from].start, words[end - 1].end));
  return cleaned.length > 0 ? cleaned : null;
}

// ── Σημαδούρα που επαναλαμβάνεται μέσα στην ίδια γραμμή (ΦΕΚ) ─────────────────

/**
 * Λέξη που μπορεί να είναι **μέρος αναφοράς ΦΕΚ**: φέρει ψηφίο.
 *
 * Το κριτήριο είναι σκόπιμα χοντρό. Οι γραφές του δείγματος είναι πέντε διαφορετικές
 * (`963Δ/25-09-1992` · `2/τ.Δ/2006` · `49τ.Δ/` + `30-01-2006` σε **δύο** λέξεις λόγω κενού ·
 * `115/Δ/24-02-1999` · `1220Δ/30-9-.1993)` με τελεία **μέσα** στην ημερομηνία). Ένα ακριβές
 * σχήμα θα απέρριπτε τις μισές· το «φέρει ψηφίο» τις δέχεται όλες και **σταματά** σε κάθε
 * λέξη πρόζας («όπως», «διορθώθηκε», «με», «το», «Έγκριση»), που είναι ό,τι χρειάζεται.
 */
const carriesDigit = (word: TextWord): boolean => /\d/.test(word.normalized);

/** Στηλοθέτες και πολλαπλά κενά είναι **διάταξη**, όχι περιεχόμενο, όταν η τιμή περνά στήλες. */
const collapseSpace = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** Πού αρχίζει και πού τελειώνει μία αναφορά μέσα στο κείμενο. */
interface MarkedRef {
  readonly start: number;
  readonly end: number;
}

/**
 * Πού τελειώνει η αναφορά που ξεκινά στη σημαδούρα της θέσης `markerAt`.
 *
 * Τρώει τις **συνεχόμενες** λέξεις που φέρουν ψηφίο — δηλαδή τα κομμάτια του αριθμού και της
 * ημερομηνίας — και σταματά στην πρώτη λέξη πρόζας.
 */
function refEnd(words: readonly TextWord[], markerAt: number, markerLength: number): number {
  let last = markerAt + markerLength - 1;
  let i = last + 1;
  while (i < words.length && carriesDigit(words[i])) {
    last = i;
    i += 1;
  }
  return words[last].end;
}

/**
 * Οι αναφορές μιας σημαδούρας που **επαναλαμβάνεται**, με τον κανόνα που τις χωρίζει.
 *
 * 🔴 **ΤΟ ΚΟΜΜΑ ΧΩΡΙΖΕΙ, Η ΛΕΞΗ ΔΕΝΕΙ — και είναι μέτρηση, όχι θεωρία** (ADR-759 §2β.7 εύρημα 4).
 * Το G753 γράφει δύο **αλυσίδες διόρθωσης** («ΦΕΚ 2Δ/2005 όπως διορθώθηκε ΦΕΚ 2/τ.Δ/2006 **με
 * το** ΦΕΚ 49τ.Δ/2006») και **μία** λίστα («ΦΕΚ 115/Δ/1999**,** ΦΕΚ 633Δ/2001»). Οι δύο
 * αλυσίδες έχουν **μηδέν** κόμματα· η λίστα έχει **ακριβώς ένα**, στο σύνορο.
 *
 * ⇒ Νέα αναφορά αρχίζει σε σημαδούρα **μόνο** όταν ανάμεσα σε αυτήν και στην προηγούμενη
 * μεσολαβεί κόμμα. Έτσι η αλυσίδα μένει **μία** αναφορά με το `rawText` της ακέραιο, που
 * είναι κατά λέξη η απαίτηση του **Q3**: *ο reader δεν μοντελοποιεί τη σχέση διόρθωσης —
 * την αφήνει να ταξιδεύει μέσα στο κείμενο*. Δέκα εμφανίσεις της λέξης «ΦΕΚ» δίνουν έτσι
 * **έξι** αναφορές σε **πέντε** πράξεις, όχι δέκα γραμμές.
 */
function scanMarkedRefs(
  text: string,
  words: readonly TextWord[],
  marker: string,
): readonly MarkedRef[] {
  const phrase = splitIntoWords(marker).map((w) => w.normalized);
  if (phrase.length === 0) return [];

  const refs: MarkedRef[] = [];
  for (let i = 0; i < words.length; i += 1) {
    if (!matchesWordSequenceAt(words, i, phrase)) continue;
    const end = refEnd(words, i, phrase.length);
    const open = refs[refs.length - 1];
    // Το κενό ανάμεσα στην προηγούμενη αναφορά και σε αυτή τη σημαδούρα: κόμμα ⇒ νέα.
    if (open && !text.slice(open.end, words[i].start).includes(',')) {
      refs[refs.length - 1] = { start: open.start, end };
      continue;
    }
    refs.push({ start: words[i].start, end });
  }
  return refs;
}

/** Ποια όψη της σάρωσης ζητά ο κανόνας. */
export type MarkedKeep = 'before' | 'each' | 'after';

/**
 * Μία σάρωση, **τρεις όψεις**: τι προηγείται της πρώτης αναφοράς, οι ίδιες οι αναφορές, τι
 * ακολουθεί την τελευταία.
 *
 * 🔑 Γραμμένες ως τρεις ανεξάρτητοι κανόνες, οι τρεις θα ξανάβρισκαν η καθεμιά τα ίδια όρια
 * με δικό της τρόπο — και θα απέκλιναν στην πρώτη διόρθωση. Εδώ τα όρια υπολογίζονται **μία**
 * φορά και οι τρεις τα διαβάζουν: η πράξη (πριν), τα ΦΕΚ της (καθένα), η σημείωσή της (μετά)
 * **δεν μπορούν** να διαφωνήσουν για το πού τελειώνει το ένα και αρχίζει το άλλο.
 */
export function takeMarked(
  text: string,
  words: readonly TextWord[],
  marker: string,
  keep: MarkedKeep,
): readonly string[] {
  const refs = scanMarkedRefs(text, words, marker);
  if (refs.length === 0) return [];

  const slice = (from: number, to: number): readonly string[] => {
    const value = collapseSpace(text.slice(from, to));
    return value.length > 0 ? [value] : [];
  };

  switch (keep) {
    case 'before':
      return slice(0, refs[0].start);
    case 'each':
      return refs.map((ref) => collapseSpace(text.slice(ref.start, ref.end)));
    case 'after':
      return slice(refs[refs.length - 1].end, text.length);
  }
}
