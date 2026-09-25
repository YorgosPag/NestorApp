/**
 * @fileoverview **ΠΟΙΑ ΠΕΡΙΟΧΗ ΕΝΝΟΕΙ Ο ΑΝΘΡΩΠΟΣ;** — αναζήτηση διοικητικών περιοχών, όπως γράφει ο κόσμος.
 * @related ADR-883 · `admin-area-index-file.ts` (δεδομένα) · `utils/greek-text.ts` (κανονικοποίηση)
 * @module lib/geo/admin-area-search
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΡΙΑ ΠΡΑΓΜΑΤΑ ΠΟΥ Ο ΑΥΣΤΗΡΟΣ ΤΑΙΡΙΑΣΤΗΣ ΔΕΝ ΑΝΤΕΧΕΙ — ΚΑΙ Ο ΚΟΣΜΟΣ ΤΑ ΚΑΝΕΙ ΟΛΑ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Γράφει ονόματα ΠΟΥ ΔΕΝ ΥΠΑΡΧΟΥΝ ΠΙΑ.** *«Δήμος Ελευθερίου Κορδελιού Ευόσμου»* είναι
 *    δύο παλιοί δήμοι· σήμερα είναι ο **Δήμος Κορδελιού-Ευόσμου** με δύο δημοτικές ενότητες,
 *    και το «Ελευθερίου» ζει μόνο στη μία. Ένα «όλες οι λέξεις μέσα στο όνομα» δεν βρίσκει
 *    **τίποτα**. ⇒ Κάθε περιοχή κρίνεται και με τη **γενεαλογία** της, και μετρά το
 *    **ποσοστό** των λέξεων που καλύφθηκαν — όχι «όλες ή τίποτα».
 * 2. **Κλίνει.** Ο άνθρωπος γράφει *«Εύοσμος»*, η πηγή *«Ευόσμου»*. ⇒ Ταίριασμα **θέματος**
 *    (η λέξη χωρίς τη δίψηφη κατάληξη) για λέξεις ≥ 5 γραμμάτων.
 * 3. **Γράφει greeklish.** *«evosmos»*, *«kordelio»*, *«thessaloniki»*. ⇒ Μεταγραφή με το
 *    **υπάρχον** `transliterateGreekToLatin` **και** φωνητικό δίπλωμα και στις δύο πλευρές
 *    (`ch`→`h`, `ou`→`u`, `ei`→`i` …), ώστε *«Pireas»* να βρίσκει τον *«ΠΕΙΡΑΙΩΣ»*.
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
  LEVEL_WORDS,
  formsOf,
  greekWords,
  nameWordForms,
  nameWords,
  sameWordAny,
  wordMatches,
} from './admin-area-words';

const logger = createModuleLogger('admin-area-search');

/** Μια περιοχή έτοιμη για αναζήτηση — οι λέξεις της υπολογίζονται **μία** φορά. */
interface SearchEntry {
  readonly area: AdminArea;
  /** Οι λέξεις του **ίδιου** του ονόματος, σε ελληνική και σε λατινική μορφή. */
  readonly own: readonly string[];
  /** Οι ίδιες λέξεις **ανά λέξη ονόματος** (ελληνική + λατινική μορφή) — για την «καθαρή» αντιστοίχιση. */
  readonly ownWords: readonly (readonly string[])[];
  /** Οι λέξεις των **προγόνων** — επιτρέπουν «Ελευθερίου … Ευόσμου». */
  readonly lineage: readonly string[];
}

export interface AdminAreaIndex {
  readonly areas: ReadonlyMap<string, AdminArea>;
  readonly entries: readonly SearchEntry[];
}

function lineageWords(area: AdminArea, areas: ReadonlyMap<string, AdminArea>): string[] {
  const lineage: string[] = [];
  let parent = area.parentId === null ? undefined : areas.get(area.parentId);
  for (let guard = 8; parent !== undefined && guard > 0; guard -= 1) {
    lineage.push(...nameWords(parent.name));
    parent = parent.parentId === null ? undefined : areas.get(parent.parentId);
  }
  return lineage;
}

function buildEntries(areas: ReadonlyMap<string, AdminArea>): SearchEntry[] {
  return [...areas.values()].map((area) => {
    const ownWords = nameWordForms(area.name);
    return { area, own: ownWords.flat(), ownWords, lineage: lineageWords(area, areas) };
  });
}

/** Ο τεμπέλης αναγνώστης του ευρετηρίου — ίδια μηχανή με την ιεραρχία και τα αποτυπώματα. */
export const ADMIN_AREA_INDEX_SOURCE = createLazyJsonSnapshot<AdminAreaIndex>({
  url: `/${ADMIN_AREA_INDEX_FILE}`,
  build: (payload) => {
    const areas = readAdminAreaIndex(payload);
    return { areas, entries: buildEntries(areas) };
  },
  onFailure: (error) => {
    logger.warn('Δεν φορτώθηκε το ευρετήριο περιοχών — καμία πρόταση περιοχής', {
      error: error instanceof Error ? error.message : String(error),
    });
  },
});

/** Φτιάχνει ευρετήριο από έτοιμες περιοχές — για τον φορτωτή **και** για τις άγκυρες. */
export function buildAdminAreaIndex(areas: ReadonlyMap<string, AdminArea>): AdminAreaIndex {
  return { areas, entries: buildEntries(areas) };
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

/** Βάρη της κατάταξης — δες την κεφαλίδα για τον λόγο καθενός. */
const WEIGHT = { covered: 100, own: 20, level: 40, tightness: 0.5 } as const;
/**
 * Όταν δεν δηλώθηκε βαθμίδα: ο δήμος είναι αυτό που εννοεί συνήθως ο κόσμος (πρότυπο Zillow: πόλη πρώτα).
 * Ο **οικισμός τελευταίος** (§5.10): «Λαγκαδάς» είναι ο Δήμος, όχι το ομώνυμο χωριό — όποιος θέλει το
 * χωριό το βρίσκει στη λίστα, ή γράφει «οικισμός».
 */
const LEVEL_PREFERENCE: Readonly<Record<number, number>> = { 5: 4, 6: 3, 4: 2, 3: 1, 7: 0, 8: -1 };

function score(entry: SearchEntry, query: ParsedQuery): number | null {
  const has = (pool: readonly string[], forms: readonly string[]) =>
    forms.some((form) => pool.some((known) => wordMatches(form, known)));

  const ownHits = query.words.filter((forms) => has(entry.own, forms)).length;
  if (ownHits === 0) return null;
  const covered = query.words.filter((forms) => has(entry.own, forms) || has(entry.lineage, forms)).length;

  const total = query.words.length;
  return (
    (WEIGHT.covered * covered) / total +
    (WEIGHT.own * ownHits) / total +
    (query.level === entry.area.level ? WEIGHT.level : 0) +
    (LEVEL_PREFERENCE[entry.area.level] ?? 0) -
    WEIGHT.tightness * entry.own.length
  );
}

/**
 * **Οι περιοχές που ταιριάζουν, καλύτερη πρώτη.** Κενό αν η ερώτηση δεν έχει καμία λέξη
 * τόπου (π.χ. σκέτο «Δήμος»).
 */
export function searchAdminAreas(index: AdminAreaIndex, query: string, limit = 6): readonly AdminArea[] {
  const parsed = parseQuery(query);
  if (parsed.words.length === 0) return [];

  const ranked: { area: AdminArea; score: number }[] = [];
  for (const entry of index.entries) {
    const value = score(entry, parsed);
    if (value !== null) ranked.push({ area: entry.area, score: value });
  }
  ranked.sort((a, b) => b.score - a.score || a.area.name.localeCompare(b.area.name, 'el'));
  return ranked.slice(0, limit).map(({ area }) => area);
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

export type TypedAreaResolution =
  | { readonly kind: 'area'; readonly area: AdminArea }
  /** Ίσα καλές περιοχές ίδιας βαθμίδας — ο άνθρωπος διαλέγει, εμείς δεν μαντεύουμε. */
  | { readonly kind: 'ambiguous'; readonly areas: readonly AdminArea[] }
  | { readonly kind: 'none' };

const NO_AREA: TypedAreaResolution = { kind: 'none' };

/** Αριθμός στο κείμενο ⇒ οδός με αριθμό ή Τ.Κ. — δουλειά του geocoder, όχι των ορίων. */
const ADDRESS_MARK = /\d/;

/** Κάθε λέξη του ονόματος ειπώθηκε, και κάθε λέξη του ανθρώπου είναι του ονόματος **ή** γονέα του. */
function namesExactly(entry: SearchEntry, query: ParsedQuery): boolean {
  const ownSaid = entry.ownWords.every((known) => query.words.some((asked) => sameWordAny(asked, known)));
  if (!ownSaid || entry.ownWords.length === 0) return false;
  return query.words.every(
    (asked) => entry.ownWords.some((known) => sameWordAny(asked, known)) || sameWordAny(asked, entry.lineage),
  );
}

/** **Η απόφαση του Enter** — καθαρή συνάρτηση, χωρίς δίκτυο. */
export function resolveTypedAdminArea(index: AdminAreaIndex, query: string): TypedAreaResolution {
  if (ADDRESS_MARK.test(query)) return NO_AREA;
  const parsed = parseQuery(query);
  if (parsed.words.length === 0) return NO_AREA;

  const exact = index.entries.filter((entry) => namesExactly(entry, parsed)).map((entry) => entry.area);
  const eligible = parsed.level === null ? exact : exact.filter((area) => area.level === parsed.level);
  if (eligible.length === 0) return NO_AREA;

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
