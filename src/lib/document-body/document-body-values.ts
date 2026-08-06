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
import { normalizeGreekHomoglyphs, splitIntoWords, type TextWord } from '@/utils/greek-text';
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

/** Διαχωριστικά που χωρίζουν ετικέτα από τιμή και **δεν** ανήκουν σε καμία από τις δύο. */
const LABEL_VALUE_SEPARATOR = /^[\s:=.\-–·]+/;

/** Ό,τι απομένει μετά την ετικέτα, χωρίς το διαχωριστικό της. */
export function takeRest(text: string, fromIndex: number): string | null {
  const rest = text.slice(fromIndex).replace(LABEL_VALUE_SEPARATOR, '').trim();
  return rest.length > 0 ? rest : null;
}
