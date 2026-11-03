/**
 * **Ποιες μηχανές αναζήτησης μπαίνουν, και πού** (ADR-923 §5.13 Ε2 · Σ5): μόνο οι ονομαστικές, μόνο στο `/suppliers/`.
 *
 * Το υπόλοιπο site μένει κλειστό, όπως το θέλει το `src/middleware.ts`. Το `robots.txt` είναι παράκληση, το middleware επιβολή,
 * και τα δύο πρέπει να λένε το ίδιο: χωρίς αυτή την εξαίρεση ο Googlebot παίρνει 403 και το `Allow` του `robots.txt` δεν μετρά.
 *
 * ⚠️ Το user-agent πλαστογραφείται. Δεν πειράζει εδώ: η διαδρομή είναι ήδη δημόσια σε κάθε φυλλομετρητή, άρα η εξαίρεση δεν ανοίγει
 *    δεδομένα. Κόβει μόνο θόρυβο, και εργαλεία σάρωσης μένουν έξω από τη λίστα.
 * ⚠️ Τρέχει στο Edge: καμία εισαγωγή.
 *
 * @module lib/middleware/search-engine-access
 */

const OPEN_TO_SEARCH_ENGINES = '/suppliers/';

/** Μόνο όσες οδηγούν επισκέπτες. Όχι εργαλεία SEO, όχι ανιχνευτές για εκπαίδευση μοντέλων. */
const SEARCH_ENGINE_CRAWLERS: readonly string[] = ['googlebot', 'bingbot', 'duckduckbot', 'applebot'];

/** `userAgent` σε πεζά, όπως το έχει ήδη το middleware. */
export function isSearchEngineOnOpenPath(pathname: string, userAgent: string): boolean {
  return pathname.startsWith(OPEN_TO_SEARCH_ENGINES) && SEARCH_ENGINE_CRAWLERS.some((crawler) => userAgent.includes(crawler));
}
