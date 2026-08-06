/**
 * ADR-763 §6 — **ποιες συναρτήσεις δείχνει η λίστα**, δεδομένης κατηγορίας και όρου
 * αναζήτησης. Καθαρή συνάρτηση.
 *
 * ## 🔴 Η αναζήτηση ΑΚΥΡΩΝΕΙ την κατηγορία — και είναι parity, όχι απλοποίηση
 * Στο Excel, μόλις πατήσεις «Μετάβαση», το αναπτυσσόμενο γυρίζει μόνο του σε «Συνιστάται» και
 * η λίστα δείχνει αποτελέσματα από **όλες** τις οικογένειες. Ο λόγος είναι ο ίδιος που
 * υπάρχει το πεδίο: ο χρήστης που ψάχνει με λέξεις **δεν ξέρει την κατηγορία** — αν την ήξερε,
 * θα διάλεγε από το μενού. Ένα φίλτρο «Κείμενο ΚΑΙ ‹στρογγυλοποίηση›» θα επέστρεφε κενό και ο
 * χρήστης θα συμπέραινε ότι η συνάρτηση δεν υπάρχει.
 *
 * ## 🔴 Η ΚΑΤΑΤΑΞΗ ΕΙΝΑΙ Η ΠΡΟΔΙΑΓΡΑΦΗ, ΟΧΙ ΤΟ ΦΙΛΤΡΟ
 * Ένα σκέτο «περιέχει» βάζει το `COUNTIFS` πάνω από το `COUNT` όταν πληκτρολογείς `COUNT`,
 * επειδή η αλφαβητική σειρά το θέλει — δηλαδή η ακριβής απάντηση κρύβεται κάτω από τις
 * παραλλαγές της. Τέσσερα κλιμάκια, με **σταθερή** αλφαβητική σειρά μέσα σε καθένα:
 *  1. ακριβές όνομα · 2. όνομα που **αρχίζει** από τον όρο · 3. όνομα που τον περιέχει ·
 *  4. **περιγραφή** που τον περιέχει — εδώ ζει η αναζήτηση με ελληνικές λέξεις.
 *
 * @module subapps/dxf-viewer/bim/table/formula/catalog/formula-catalog-search
 * @see docs/centralized-systems/reference/adrs/ADR-763-table-insert-function-dialog.md §6
 */

import type { FormulaCatalogEntry, FormulaCategoryFilter } from './formula-catalog-taxonomy';

export interface FormulaCatalogQuery {
  readonly entries: readonly FormulaCatalogEntry[];
  readonly category: FormulaCategoryFilter;
  /** Ο όρος αναζήτησης, ωμός. Κενός ή μόνο κενά ⇒ καθαρό φιλτράρισμα κατηγορίας. */
  readonly query: string;
  /**
   * Τα ονόματα της «Πιο πρόσφατης χρήσης», **με τη σειρά τους** (νεότερο πρώτο).
   *
   * Η σειρά είναι το περιεχόμενο της κατηγορίας: αλφαβητικοποιημένη, η λίστα θα απαντούσε
   * «ποιες συναρτήσεις έχεις χρησιμοποιήσει» αντί για «ποια χρησιμοποίησες μόλις τώρα» — που
   * είναι η μόνη ερώτηση για την οποία υπάρχει.
   */
  readonly recent: readonly string[];
  /**
   * Η **μεταφρασμένη** περιγραφή ενός ονόματος, ή `''` όταν δεν είναι τεκμηριωμένο.
   *
   * Περνά ως συνάρτηση επειδή το κείμενο ζει στο i18n και αυτό το module είναι καθαρό: μια
   * εισαγωγή του `t` εδώ θα έδενε την ταξινόμηση με το React και θα την έκανε αδοκίμαστη
   * χωρίς provider.
   */
  readonly describe: (name: string) => string;
}

/** Η φιλτραρισμένη και ταξινομημένη λίστα, έτοιμη για απόδοση. */
export function queryFormulaCatalog(params: FormulaCatalogQuery): readonly FormulaCatalogEntry[] {
  const { entries, category, query, recent, describe } = params;
  const term = query.trim().toLocaleUpperCase('el');

  if (term.length === 0) return byCategory(entries, category, recent);

  const ranked: Array<{ readonly entry: FormulaCatalogEntry; readonly rank: number }> = [];
  for (const entry of entries) {
    const rank = rankOf(entry, term, describe);
    if (rank !== null) ranked.push({ entry, rank });
  }

  // Ο κατάλογος φτάνει **ήδη** αλφαβητικός, οπότε μια σταθερή ταξινόμηση κατά κλιμάκιο αρκεί:
  // το `Array.prototype.sort` είναι σταθερό από την ES2019 και μετά, σε κάθε μηχανή.
  return ranked.sort((a, b) => a.rank - b.rank).map((scored) => scored.entry);
}

/**
 * Το κλιμάκιο μιας εγγραφής, ή `null` όταν δεν ταιριάζει καθόλου.
 *
 * ⚠️ Η σύγκριση γίνεται σε **κεφαλαία με ελληνικό locale** και στα δύο σκέλη: το ελληνικό
 * τελικό σίγμα και ο τονισμός σημαίνουν ότι μια αφελής `toUpperCase()` δίνει διαφορετικό
 * αποτέλεσμα από τη σύγκριση που περιμένει ο χρήστης όταν γράφει «άθροισμα» έναντι «ΑΘΡΟΙΣΜΑ».
 */
function rankOf(
  entry: FormulaCatalogEntry,
  term: string,
  describe: (name: string) => string,
): number | null {
  const name = entry.name.toLocaleUpperCase('el');
  if (name === term) return 0;
  if (name.startsWith(term)) return 1;
  if (name.includes(term)) return 2;
  return describe(entry.name).toLocaleUpperCase('el').includes(term) ? 3 : null;
}

/** Καθαρό φιλτράρισμα κατηγορίας — οι δύο εικονικές επιλογές πρώτα. */
function byCategory(
  entries: readonly FormulaCatalogEntry[],
  category: FormulaCategoryFilter,
  recent: readonly string[],
): readonly FormulaCatalogEntry[] {
  if (category === 'all') return entries;
  if (category === 'recent') {
    // Χαρτογράφηση **από τα πρόσφατα**, όχι φιλτράρισμα του καταλόγου: μόνο έτσι διατηρείται
    // η σειρά χρήσης. Το `filter(Boolean)` πετά ό,τι έμεινε στο `localStorage` από παλαιότερη
    // έκδοση και δεν καλείται πια — αλλιώς η λίστα θα διαφήμιζε `#NAME?`.
    const byName = new Map(entries.map((entry) => [entry.name, entry]));
    return recent
      .map((name) => byName.get(name))
      .filter((entry): entry is FormulaCatalogEntry => entry !== undefined);
  }
  return entries.filter((entry) => entry.category === category);
}
