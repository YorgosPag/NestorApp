/**
 * @fileoverview **ΠΟΙΑ ΠΕΡΙΟΧΗ ΕΝΝΟΕΙ Ο ΑΝΘΡΩΠΟΣ;** — αναζήτηση διοικητικών περιοχών, όπως γράφει ο κόσμος.
 * @related ADR-883 · `admin-area-index-file.ts` (δεδομένα) · `utils/greek-text.ts` (κανονικοποίηση)
 * @module lib/geo/admin-area-search
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΕΣΣΕΡΑ ΠΡΑΓΜΑΤΑ ΠΟΥ Ο ΑΥΣΤΗΡΟΣ ΤΑΙΡΙΑΣΤΗΣ ΔΕΝ ΑΝΤΕΧΕΙ — ΚΑΙ Ο ΚΟΣΜΟΣ ΤΑ ΚΑΝΕΙ ΟΛΑ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Γράφει ονόματα ΠΟΥ ΔΕΝ ΥΠΑΡΧΟΥΝ ΠΙΑ.** *«Δήμος Ελευθερίου Κορδελιού Ευόσμου»* είναι
 *    δύο παλιοί δήμοι· σήμερα είναι ο **Δήμος Κορδελιού-Ευόσμου** με δύο δημοτικές ενότητες,
 *    και το «Ελευθερίου» ζει μόνο στη μία. Ένα «όλες οι λέξεις μέσα στο όνομα» δεν βρίσκει
 *    **τίποτα**. ⇒ Κάθε περιοχή κρίνεται και με τη **γενεαλογία** της, και μετρά το
 *    **ποσοστό** των λέξεων που καλύφθηκαν — όχι «όλες ή τίποτα».
 * 2. **Κλίνει.** Ο άνθρωπος γράφει *«Εύοσμος»*, η πηγή *«Ευόσμου»*. ⇒ Ίδιο θέμα με καταλήξεις
 *    του **ίδιου κλιτικού παραδείγματος** (`admin-area-words`, §5.11) — μισή λέξη («Ξυλοπ») ταιριάζει
 *    **μόνο** ως πρόθεμα, και ολόκληρη λέξη κατατάσσεται **πάνω** από πρόθεμα (Algolia `exact`).
 * 3. **Γράφει greeklish.** *«evosmos»*, *«kordelio»*, *«thessaloniki»*. ⇒ Μεταγραφή με το
 *    **υπάρχον** `transliterateGreekToLatin` **και** φωνητικό δίπλωμα και στις δύο πλευρές
 *    (`ch`→`h`, `ou`→`u`, `ei`→`i` …), ώστε *«Pireas»* να βρίσκει τον *«ΠΕΙΡΑΙΩΣ»*.
 * 4. **Κάνει λάθη.** *«Ξυλούπολη»*, *«Αλεξανρουπολη»*. ⇒ Δεύτερο στάδιο με ανοχή ορθογραφίας
 *    (`admin-area-vocabulary`) — **μόνο** όταν το ακριβές δεν βρήκε τίποτα (Typesense/Algolia `min`),
 *    ώστε μια σωστή ερώτηση να μη γεμίζει ποτέ με άσχετα «μήπως εννοούσατε».
 *
 * 🔑 **Η βαθμίδα που δηλώνει ο άνθρωπος ΜΕΤΡΑΕΙ**: όποιος γράφει «Δήμος» ψάχνει δήμο. Η
 * λέξη δεν ψάχνεται ως όνομα (θα ταίριαζε με **κάθε** δήμο) — γίνεται **προτίμηση**.
 *
 * **Layering**: καθαρό φύλλο + ένας τεμπέλης φορτωτής (ίδια μηχανή με την ιεραρχία).
 */

import { createLazyJsonSnapshot } from '@/lib/data/lazy-json-snapshot';
import { createModuleLogger } from '@/lib/telemetry';
import { ADMIN_AREA_INDEX_FILE, readAdminAreaIndex, type AdminArea } from './admin-area-index-file';
import {
  NO_GRADE,
  buildAdminAreaVocabulary,
  gradeIsWhole,
  gradeTypos,
  gradeVocabulary,
  vocabularyIds,
  type AdminAreaVocabulary,
} from './admin-area-vocabulary';
import {
  LEVEL_WORDS,
  formsOf,
  greekWords,
  nameWordForms,
  sameWordAny,
} from './admin-area-words';

const logger = createModuleLogger('admin-area-search');

/** Μια περιοχή έτοιμη για αναζήτηση — οι λέξεις της υπολογίζονται **μία** φορά. */
interface SearchEntry {
  readonly area: AdminArea;
  /** Οι λέξεις του **ίδιου** του ονόματος, σε ελληνική και σε λατινική μορφή. */
  readonly own: readonly string[];
  /** Οι ίδιες λέξεις **ανά λέξη ονόματος** (ελληνική + λατινική μορφή) — για την «καθαρή» αντιστοίχιση. */
  readonly ownWords: readonly (readonly string[])[];
  /** Οι λέξεις του ονόματος ως δείκτες του λεξιλογίου — η βαθμολογία είναι αναγνώσεις πίνακα (§5.11). */
  readonly ownIds: Int32Array;
  /**
   * Οι λέξεις των **προγόνων** (δείκτες) — επιτρέπουν «Ελευθερίου … Ευόσμου». Μόνο δείκτες: ~20 συμβολοσειρές
   * ανά περιοχή × 15.000 ήταν ο μισός garbage collector του χτισίματος (§5.11).
   */
  readonly lineageIds: Int32Array;
}

export interface AdminAreaIndex {
  readonly areas: ReadonlyMap<string, AdminArea>;
  readonly entries: readonly SearchEntry[];
  /** Κάθε λέξη ονόματος/γενεαλογίας **μία** φορά — εκεί ψάχνει η ανοχή ορθογραφίας (§5.11). */
  readonly vocabulary: AdminAreaVocabulary;
}

/** Όσα βήματα ανεβαίνει η γενεαλογία το πολύ — φρουρός απέναντι σε κύκλο στα δεδομένα. */
const LINEAGE_DEPTH = 8;

const NO_IDS = new Int32Array(0);

function concatIds(a: Int32Array, b: Int32Array): Int32Array {
  const joined = new Int32Array(a.length + b.length);
  joined.set(a);
  joined.set(b, a.length);
  return joined;
}

/** Γενεαλογία = λέξεις του γονέα + γενεαλογία του γονέα — **με μνήμη**: κάθε πρόγονος χτίζεται μία φορά. */
function lineageBuilder(
  areas: ReadonlyMap<string, AdminArea>,
  ownIds: ReadonlyMap<string, Int32Array>,
): (area: AdminArea) => Int32Array {
  const built = new Map<string, Int32Array>();
  const lineageOf = (area: AdminArea, depth: number): Int32Array => {
    const known = built.get(area.id);
    if (known !== undefined) return known;
    const parent = area.parentId === null ? undefined : areas.get(area.parentId);
    if (parent === undefined || depth === 0) return NO_IDS;
    const lineage = concatIds(ownIds.get(parent.id) ?? NO_IDS, lineageOf(parent, depth - 1));
    built.set(area.id, lineage);
    return lineage;
  };
  return (area) => lineageOf(area, LINEAGE_DEPTH);
}

/**
 * ⚠️ **Κάθε λέξη μεταγράφεται ΜΙΑ φορά, κάθε γενεαλογία χτίζεται ΜΙΑ φορά** (§5.11, profiling):
 * η γενεαλογία ξαναζητούσε τις λέξεις κάθε προγόνου για καθεμία από τις ~15.000 περιοχές (ο Δήμος
 * Λαγκαδά ~200 φορές) και η μεταγραφή έτρεχε για κάθε **εμφάνιση** λέξης — μετρημένο **1,3 s**
 * χτίσιμο στο desktop, δηλαδή παγωμένη οθόνη σε κινητό την πρώτη φορά που ανοίγει το πεδίο.
 * Το λεξιλόγιο = οι λέξεις των ονομάτων (οι λέξεις γενεαλογίας είναι λέξεις ονομάτων προγόνων).
 */
function buildIndex(areas: ReadonlyMap<string, AdminArea>): AdminAreaIndex {
  const formsByWord = new Map<string, string[]>();
  const memoFormsOf = (word: string): string[] => {
    const known = formsByWord.get(word) ?? formsOf(word);
    formsByWord.set(word, known);
    return known;
  };
  const ownWords = new Map([...areas.values()].map((area) => [area.id, nameWordForms(area.name, memoFormsOf)]));
  const own = new Map([...ownWords].map(([id, words]) => [id, words.flat()]));
  const vocabulary = buildAdminAreaVocabulary([...own.values()].flat());
  const ownIds = new Map([...own].map(([id, words]) => [id, vocabularyIds(vocabulary, words)]));
  const lineageOf = lineageBuilder(areas, ownIds);

  const entries = [...areas.values()].map((area) => ({
    area,
    own: own.get(area.id) ?? [],
    ownWords: ownWords.get(area.id) ?? [],
    ownIds: ownIds.get(area.id) ?? NO_IDS,
    lineageIds: lineageOf(area),
  }));
  return { areas, entries, vocabulary };
}

/** Ο τεμπέλης αναγνώστης του ευρετηρίου — ίδια μηχανή με την ιεραρχία και τα αποτυπώματα. */
export const ADMIN_AREA_INDEX_SOURCE = createLazyJsonSnapshot<AdminAreaIndex>({
  url: `/${ADMIN_AREA_INDEX_FILE}`,
  build: (payload) => buildIndex(readAdminAreaIndex(payload)),
  onFailure: (error) => {
    logger.warn('Δεν φορτώθηκε το ευρετήριο περιοχών — καμία πρόταση περιοχής', {
      error: error instanceof Error ? error.message : String(error),
    });
  },
});

/** Φτιάχνει ευρετήριο από έτοιμες περιοχές — για τον φορτωτή **και** για τις άγκυρες. */
export function buildAdminAreaIndex(areas: ReadonlyMap<string, AdminArea>): AdminAreaIndex {
  return buildIndex(areas);
}

/** Η ερώτηση του ανθρώπου, χωρισμένη σε **τόπο** και **δηλωμένη βαθμίδα**. */
interface ParsedQuery {
  readonly words: readonly (readonly string[])[];
  readonly level: number | null;
}

function parseQuery(query: string): ParsedQuery {
  let level: number | null = null;
  const words: string[][] = [];
  for (const word of greekWords(query)) {
    const levelWord = LEVEL_WORDS.get(word);
    if (levelWord !== undefined) {
      level = levelWord ?? level;
      continue;
    }
    if (word.length >= 2) words.push(formsOf(word));
  }
  return { words, level };
}

/**
 * Βάρη της κατάταξης — δες την κεφαλίδα για τον λόγο καθενός.
 * - `whole`: ολόκληρη λέξη (με κλίση) πάνω από σκέτο πρόθεμα — «Άργος» ⇒ Άργους, όχι Αργοστόλι (§5.11).
 * - `typo`: κάθε λάθος κοστίζει περισσότερο από κάθε προτίμηση βαθμίδας — λιγότερα λάθη πρώτα.
 */
const WEIGHT = { covered: 100, own: 20, level: 40, whole: 10, typo: 15, tightness: 0.5 } as const;
/**
 * Όταν δεν δηλώθηκε βαθμίδα: ο δήμος είναι αυτό που εννοεί συνήθως ο κόσμος (πρότυπο Zillow: πόλη πρώτα).
 * Ο **οικισμός τελευταίος** (§5.10): «Λαγκαδάς» είναι ο Δήμος, όχι το ομώνυμο χωριό — όποιος θέλει το
 * χωριό το βρίσκει στη λίστα, ή γράφει «οικισμός».
 */
const LEVEL_PREFERENCE: Readonly<Record<number, number>> = { 5: 4, 6: 3, 4: 2, 3: 1, 7: 0, 8: -1 };

/** Ο καλύτερος βαθμός (μικρότερος) ανάμεσα στις λέξεις μιας περιοχής — `NO_GRADE` αν καμία δεν ταιριάζει. */
function bestGrade(ids: Int32Array, grades: Int8Array): number {
  let best = NO_GRADE;
  for (let i = 0; i < ids.length; i += 1) {
    const grade = grades[ids[i]];
    if (grade !== NO_GRADE && (best === NO_GRADE || grade < best)) best = grade;
  }
  return best;
}

/** Πόσες λέξεις του ανθρώπου πιάνει το **ίδιο** το όνομα — ο φθηνός έλεγχος που απορρίπτει σχεδόν όλες. */
function ownHits(entry: SearchEntry, perWord: readonly Int8Array[]): number {
  let own = 0;
  for (let w = 0; w < perWord.length; w += 1) if (bestGrade(entry.ownIds, perWord[w]) !== NO_GRADE) own += 1;
  return own;
}

/**
 * ⚠️ Πρώτα το όνομα, **μετά** η γενεαλογία: περιοχή που δεν ταιριάζει με το όνομά της απορρίπτεται
 * ούτως ή άλλως — η σάρωση ~20 λέξεων γενεαλογίας για ΚΑΘΕ μία ήταν το μεγαλύτερο κόστος (profiling, §5.11).
 */
function score(entry: SearchEntry, query: ParsedQuery, perWord: readonly Int8Array[]): number | null {
  const own = ownHits(entry, perWord);
  if (own === 0) return null;
  let covered = 0;
  let whole = 0;
  let typos = 0;
  for (let w = 0; w < perWord.length; w += 1) {
    const mine = bestGrade(entry.ownIds, perWord[w]);
    const hit = mine !== NO_GRADE ? mine : bestGrade(entry.lineageIds, perWord[w]);
    if (hit === NO_GRADE) continue;
    covered += 1;
    typos += gradeTypos(hit);
    if (gradeIsWhole(hit)) whole += 1;
  }

  const total = perWord.length;
  return (
    (WEIGHT.covered * covered + WEIGHT.own * own + WEIGHT.whole * whole) / total +
    (query.level === entry.area.level ? WEIGHT.level : 0) +
    (LEVEL_PREFERENCE[entry.area.level] ?? 0) -
    WEIGHT.typo * typos -
    WEIGHT.tightness * entry.own.length
  );
}

/** Ισοπαλία ⇒ αλφαβητικά. Ένας collator, όχι `localeCompare` ανά σύγκριση (δεκαπλάσιο κόστος). */
const COLLATOR = new Intl.Collator('el');

interface Ranked {
  readonly area: AdminArea;
  readonly score: number;
}

const outranks = (a: Ranked, b: Ranked): boolean =>
  a.score > b.score || (a.score === b.score && COLLATOR.compare(a.area.name, b.area.name) < 0);

/**
 * Οι `limit` καλύτερες **χωρίς** ταξινόμηση όλων: το «Κα» ταιριάζει χιλιάδες περιοχές, και η πλήρης
 * ταξινόμηση με ελληνική σύγκριση ήταν το μεγαλύτερο κόστος του πατήματος (§5.11). Ίδια σειρά με
 * `sort` (σταθερή: στην πλήρη ισοπαλία κρατά τη σειρά του ευρετηρίου).
 */
function rankWith(index: AdminAreaIndex, query: ParsedQuery, correct: boolean, limit: number): AdminArea[] {
  const perWord = query.words.map((forms) => gradeVocabulary(index.vocabulary, forms, correct));
  const top: Ranked[] = [];
  for (const entry of index.entries) {
    const value = score(entry, query, perWord);
    if (value === null) continue;
    const candidate = { area: entry.area, score: value };
    if (top.length === limit && !outranks(candidate, top[limit - 1])) continue;
    let at = top.length;
    while (at > 0 && outranks(candidate, top[at - 1])) at -= 1;
    top.splice(at, 0, candidate);
    if (top.length > limit) top.pop();
  }
  return top.map(({ area }) => area);
}

/** Οι προτάσεις, και αν βγήκαν από **διόρθωση** («μήπως εννοούσατε») αντί για ό,τι γράφτηκε. */
export interface AdminAreaRanking {
  readonly areas: readonly AdminArea[];
  readonly corrected: boolean;
}

const NO_RANKING: AdminAreaRanking = { areas: [], corrected: false };

/**
 * **Δύο στάδια** (Typesense `typo_tokens_threshold: 1`, Algolia `typoTolerance: min`): πρώτα ό,τι
 * γράφτηκε (ολόκληρη λέξη, κλίση, πρόθεμα)· **μόνο αν δεν βρεθεί τίποτα**, διόρθωση λαθών — ώστε
 * μια σωστή ερώτηση να μη γεμίζει ποτέ με άσχετα «μήπως εννοούσατε».
 */
export function rankAdminAreas(index: AdminAreaIndex, query: string, limit = 6): AdminAreaRanking {
  const parsed = parseQuery(query);
  if (parsed.words.length === 0) return NO_RANKING;

  const exact = rankWith(index, parsed, false, limit);
  if (exact.length > 0) return { areas: exact, corrected: false };

  const corrected = rankWith(index, parsed, true, limit);
  return corrected.length > 0 ? { areas: corrected, corrected: true } : NO_RANKING;
}

/**
 * **Οι περιοχές που ταιριάζουν, καλύτερη πρώτη.** Κενό αν η ερώτηση δεν έχει καμία λέξη
 * τόπου (π.χ. σκέτο «Δήμος»).
 */
export function searchAdminAreas(index: AdminAreaIndex, query: string, limit = 6): readonly AdminArea[] {
  return rankAdminAreas(index, query, limit).areas;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔑 «ΘΕΣΣΑΛΟΝΙΚΗ» + ENTER — ΠΟΤΕ ΤΟ ΚΕΙΜΕΝΟ ΕΙΝΑΙ ΚΑΘΑΡΑ ΠΕΡΙΟΧΗ (ADR-883 §5.8)
// ─────────────────────────────────────────────────────────────────────────────
//
// Το Zillow στο Enter παίρνει την **πρώτη πρόταση** — δηλαδή μαντεύει ακόμα και από πρόθεμα
// («Kordel» ⇒ περιοχή). Εδώ η ερώτηση είναι αυστηρότερη: **ονόμασε ο άνθρωπος ΟΛΟΚΛΗΡΟ το όνομα
// μιας περιοχής, και ΤΙΠΟΤΑ ΑΛΛΟ** εκτός από βαθμίδα ή γονέα; Αλλιώς ο geocoder (οδός, POI).
//
// | Ερώτηση | Απόφαση | Γιατί |
// |---|---|---|
// | «Θεσσαλονίκη» | Δήμος Θεσσαλονίκης | Π.Ε./Δ.Ε. ίδιου ονόματος = ίδιος τόπος σε άλλη βαθμίδα ⇒ προτίμηση βαθμίδας |
// | «Π.Ε. Θεσσαλονίκης» | η Π.Ε. | η δηλωμένη βαθμίδα **φιλτράρει** |
// | «Καλλιθέα Χαλκιδικής» | ο τόπος μέσα στη Χαλκιδική | ο γονέας **ξεχωρίζει** ομώνυμα (λέξη προγόνου) |
// | δύο ομώνυμα ίδιας βαθμίδας | **ρωτάμε** (λίστα ανοιχτή) | Rightmove «did you mean» — ποτέ τυφλή μαντεψιά |
// | «Τσιμισκή 45» | geocoder | ψηφίο ⇒ διεύθυνση/Τ.Κ., ποτέ περιοχή |
// | «Θεσ» / «Αγίου» | geocoder | πρόθεμα ή μέρος ονόματος δεν είναι «καθαρό» |
// | «Ξυλούπολη» (λάθος, §5.11) | **ρωτάμε** «μήπως εννοούσατε;» | η διόρθωση **προτείνει**, ποτέ δεν πλοηγεί· δεύτερο Enter ⇒ geocoder |

export type TypedAreaResolution =
  | { readonly kind: 'area'; readonly area: AdminArea }
  /** Ίσα καλές περιοχές ίδιας βαθμίδας — ο άνθρωπος διαλέγει, εμείς δεν μαντεύουμε. */
  | { readonly kind: 'ambiguous'; readonly areas: readonly AdminArea[] }
  /**
   * Το κείμενο **δεν** ονομάζει περιοχή, αλλά μοιάζει με κάποια (διόρθωση λαθών, §5.11) — ρωτάμε.
   * Δεν πλοηγούμε ποτέ σε διόρθωση: μπορεί να ήταν οδός που μοιάζει με χωριό.
   */
  | { readonly kind: 'suggest'; readonly areas: readonly AdminArea[] }
  | { readonly kind: 'none' };

const NO_AREA: TypedAreaResolution = { kind: 'none' };

/** Αριθμός στο κείμενο ⇒ οδός με αριθμό ή Τ.Κ. — δουλειά του geocoder, όχι των ορίων. */
const ADDRESS_MARK = /\d/;

/** Κάθε λέξη του ονόματος ειπώθηκε, και κάθε λέξη του ανθρώπου είναι του ονόματος **ή** γονέα του. */
function namesExactly(entry: SearchEntry, query: ParsedQuery, vocabulary: AdminAreaVocabulary): boolean {
  const ownSaid = entry.ownWords.every((known) => query.words.some((asked) => sameWordAny(asked, known)));
  if (!ownSaid || entry.ownWords.length === 0) return false;
  const lineage = Array.from(entry.lineageIds, (id) => vocabulary.words[id]);
  return query.words.every(
    (asked) => entry.ownWords.some((known) => sameWordAny(asked, known)) || sameWordAny(asked, lineage),
  );
}

/** Όσες προτάσεις δείχνει η λίστα ανάκλησης — η ερώτηση «μήπως εννοούσατε» δεν ξεχειλίζει τη λίστα. */
const TYPED_SUGGESTIONS = 5;

/** Όχι καθαρό όνομα: «μήπως εννοούσατε;» μόνο όταν οι προτάσεις βγήκαν από **διόρθωση** λαθών. */
function suggestionFor(index: AdminAreaIndex, query: string): TypedAreaResolution {
  const ranking = rankAdminAreas(index, query, TYPED_SUGGESTIONS);
  return ranking.corrected ? { kind: 'suggest', areas: ranking.areas } : NO_AREA;
}

/** **Η απόφαση του Enter** — καθαρή συνάρτηση, χωρίς δίκτυο. */
export function resolveTypedAdminArea(index: AdminAreaIndex, query: string): TypedAreaResolution {
  if (ADDRESS_MARK.test(query)) return NO_AREA;
  const parsed = parseQuery(query);
  if (parsed.words.length === 0) return NO_AREA;

  const exact = index.entries.filter((entry) => namesExactly(entry, parsed, index.vocabulary)).map((entry) => entry.area);
  const eligible = parsed.level === null ? exact : exact.filter((area) => area.level === parsed.level);
  if (eligible.length === 0) return suggestionFor(index, query);

  const preference = (area: AdminArea) => LEVEL_PREFERENCE[area.level] ?? 0;
  const best = Math.max(...eligible.map(preference));
  const top = eligible.filter((area) => preference(area) === best);
  return top.length === 1 ? { kind: 'area', area: top[0] } : { kind: 'ambiguous', areas: top };
}

/**
 * Η ίδια απόφαση όταν το ευρετήριο **ίσως δεν έχει φορτώσει ακόμη**: το περιμένει (single-flight)
 * αντί να πέσει σιωπηλά σε κύκλο. `none` μόνο αν η φόρτωση **απέτυχε** (ήδη καταγεγραμμένο).
 * Διευθύνσεις με αριθμό δεν κατεβάζουν καν το ευρετήριο.
 */
export async function resolveTypedAdminAreaWhenReady(query: string): Promise<TypedAreaResolution> {
  if (ADDRESS_MARK.test(query)) return NO_AREA;
  await ADMIN_AREA_INDEX_SOURCE.load();
  const index = ADMIN_AREA_INDEX_SOURCE.peek();
  return index === null ? NO_AREA : resolveTypedAdminArea(index, query);
}

/** Οι πρόγονοι μιας περιοχής, από τον **άμεσο γονέα** προς τα πάνω — για τη γραμμή γενεαλογίας. */
export function adminAreaLineage(index: AdminAreaIndex, adminId: string): readonly AdminArea[] {
  const lineage: AdminArea[] = [];
  let current = index.areas.get(adminId);
  for (let guard = 8; current?.parentId && guard > 0; guard -= 1) {
    const parent = index.areas.get(current.parentId);
    if (parent === undefined) break;
    lineage.push(parent);
    current = parent;
  }
  return lineage;
}
