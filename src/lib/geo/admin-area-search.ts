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
import { normalizeForSearch, transliterateGreekToLatin } from '@/utils/greek-text';
import { ADMIN_AREA_INDEX_FILE, readAdminAreaIndex, type AdminArea } from './admin-area-index-file';

const logger = createModuleLogger('admin-area-search');

/** Μια περιοχή έτοιμη για αναζήτηση — οι λέξεις της υπολογίζονται **μία** φορά. */
interface SearchEntry {
  readonly area: AdminArea;
  /** Οι λέξεις του **ίδιου** του ονόματος, σε ελληνική και σε λατινική μορφή. */
  readonly own: readonly string[];
  /** Οι λέξεις των **προγόνων** — επιτρέπουν «Ελευθερίου … Ευόσμου». */
  readonly lineage: readonly string[];
}

export interface AdminAreaIndex {
  readonly areas: ReadonlyMap<string, AdminArea>;
  readonly entries: readonly SearchEntry[];
}

/**
 * Λέξεις που **ονομάζουν βαθμίδα**, όχι τόπο — ποτέ δεν ψάχνονται ως όνομα.
 * Η τιμή είναι η βαθμίδα που υπονοούν (`null` = μέρος σύνθετου όρου, χωρίς δική του).
 */
const LEVEL_WORDS: ReadonlyMap<string, number | null> = new Map([
  ['περιφερεια', 3], ['περιφερειασ', 3], ['perifereia', 3], ['region', 3],
  ['περιφερειακη', 4], ['νομοσ', 4], ['νομου', 4], ['πε', 4], ['nomos', 4],
  ['δημοσ', 5], ['δημου', 5], ['dimos', 5], ['dhmos', 5], ['municipality', 5],
  ['δημοτικη', 6], ['δε', 6], ['ενοτητα', null], ['ενοτητασ', null],
  ['κοινοτητα', 7], ['τοπικη', 7], ['κοινοτητασ', 7], ['koinotita', 7],
]);

/**
 * Ελληνικό κείμενο → λέξεις σύγκρισης: χωρίς τόνους, πεζά, `ς`→`σ`, χωρίς στίξη.
 * ⚠️ Η παύλα **χωρίζει** λέξεις *πριν* την κανονικοποίηση — το `normalizeForSearch` τη
 * σβήνει, και το «ΕΛΕΥΘΕΡΙΟΥ-ΚΟΡΔΕΛΙΟΥ» θα γινόταν **μία** λέξη που δεν ταιριάζει ποτέ.
 */
function greekWords(text: string): string[] {
  return normalizeForSearch(text.replace(/[-–—/]/g, ' '))
    .replace(/ς/g, 'σ')
    .split(/[\s,·]+/)
    .filter((word) => word.length > 0);
}

/**
 * **Φωνητικό δίπλωμα λατινικών** — δύο διαφορετικές γραφές του ίδιου ήχου γίνονται ίδιες.
 * ⚠️ Εφαρμόζεται **και στις δύο πλευρές**: η μεταγραφή της πηγής και το greeklish του
 * ανθρώπου διπλώνονται με τον **ίδιο** κανόνα, αλλιώς δεν συναντιούνται ποτέ.
 */
function foldLatin(word: string): string {
  return word
    .replace(/ch/g, 'h')
    .replace(/ph/g, 'f')
    .replace(/ks/g, 'x')
    .replace(/ou/g, 'u')
    .replace(/e[uf]/g, 'ev')
    .replace(/a[uf]/g, 'av')
    .replace(/[eo]i/g, 'i')
    .replace(/ai/g, 'e')
    .replace(/y/g, 'i')
    .replace(/w/g, 'o')
    .replace(/(.)\1/g, '$1');
}

/** Όλες οι μορφές μιας λέξης που αξίζει να συγκριθούν: η ελληνική και η λατινική της. */
function formsOf(word: string): string[] {
  const latin = foldLatin(transliterateGreekToLatin(word));
  return latin === word ? [word] : [word, latin];
}

function nameWords(name: string): string[] {
  return greekWords(name)
    .filter((word) => !LEVEL_WORDS.has(word))
    .flatMap(formsOf);
}

/** Ταιριάζει η λέξη του ανθρώπου σε λέξη της πηγής; Πρόθεμα, ή πρόθεμα **θέματος** (κλίση). */
function wordMatches(asked: string, known: string): boolean {
  if (known.startsWith(asked)) return true;
  return asked.length >= 5 && known.startsWith(asked.slice(0, -2));
}

function buildEntries(areas: ReadonlyMap<string, AdminArea>): SearchEntry[] {
  return [...areas.values()].map((area) => {
    const lineage: string[] = [];
    let parent = area.parentId === null ? undefined : areas.get(area.parentId);
    for (let guard = 8; parent !== undefined && guard > 0; guard -= 1) {
      lineage.push(...nameWords(parent.name));
      parent = parent.parentId === null ? undefined : areas.get(parent.parentId);
    }
    return { area, own: nameWords(area.name), lineage };
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
/** Όταν δεν δηλώθηκε βαθμίδα: ο δήμος είναι αυτό που εννοεί συνήθως ο κόσμος (πρότυπο Zillow: πόλη πρώτα). */
const LEVEL_PREFERENCE: Readonly<Record<number, number>> = { 5: 4, 6: 3, 4: 2, 3: 1, 7: 0 };

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
