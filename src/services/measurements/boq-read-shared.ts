/**
 * Κοινοί **καθαροί κανόνες ανάγνωσης** BOQ — μία γραφή, δύο SDK
 *
 * Ό,τι απαντά σε ερώτημα του πεδίου ορισμού («ποιο όνομα δείχνει αυτός ο
 * κωδικός;», «ταιριάζει αυτή η γραμμή στον όρο αναζήτησης;») και το χρειάζονται
 * **και** το client μονοπάτι (UI) **και** το admin μονοπάτι (πράκτορας).
 *
 * Ο διαχωρισμός από το `boq-document-normalize.ts` είναι σκόπιμος: εκεί ζει η
 * μετάφραση *σχήματος* (έγγραφο → αντικείμενο), εδώ η *σημασιολογία* (τι
 * σημαίνει «ταιριάζει», τι σημαίνει «άγνωστη κατηγορία»). Δύο ερωτήματα, δύο
 * αρχεία — ώστε η αλλαγή του ενός να μη σέρνει το άλλο.
 *
 * ⚠️ Καμία εισαγωγή Firebase εδώ. Το module ελέγχεται χωρίς Firestore.
 *
 * @module services/measurements/boq-read-shared
 * @see ADR-175 (BOQ) · ADR-734 §8.3 (γιατί κεντρικοποιήθηκε)
 */

import type { BOQCategory, BOQItem } from '@/types/boq';
import type { BOQStats } from './contracts';

/** Μηδενικά στατιστικά — η απάντηση για «καμία γραμμή». */
export const EMPTY_BOQ_STATS: BOQStats = {
  total: 0,
  draft: 0,
  submitted: 0,
  approved: 0,
  certified: 0,
  locked: 0,
  totalEstimatedCost: 0,
};

/**
 * Στατιστικά από γραμμές — καθαρός υπολογισμός, μηδενική πρόσβαση δεδομένων.
 *
 * ⚠️ Το κόστος είναι **μεικτή ποσότητα × άθροισμα μοναδιαίων κοστών**, δηλαδή η
 * φύρα εφαρμόζεται **πριν** τον πολλαπλασιασμό. Αν οι δύο διαδρομές ανάγνωσης
 * απέκλιναν εδώ, η οθόνη και ο πράκτορας θα ανέφεραν διαφορετικό συνολικό κόστος
 * για το ίδιο κτίριο — σφάλμα **τιμής**, όχι μορφής.
 */
export function computeBoqStats(items: readonly BOQItem[]): BOQStats {
  let totalEstimatedCost = 0;
  for (const item of items) {
    const grossQuantity = item.estimatedQuantity * (1 + item.wasteFactor);
    const unitCost = item.materialUnitCost + item.laborUnitCost + item.equipmentUnitCost;
    totalEstimatedCost += grossQuantity * unitCost;
  }

  return {
    total: items.length,
    draft: items.filter((i) => i.status === 'draft').length,
    submitted: items.filter((i) => i.status === 'submitted').length,
    approved: items.filter((i) => i.status === 'approved').length,
    certified: items.filter((i) => i.status === 'certified').length,
    locked: items.filter((i) => i.status === 'locked').length,
    totalEstimatedCost,
  };
}

/**
 * Χάρτης `categoryCode → εμφανιζόμενο όνομα`, όπως τον περιμένει το
 * `computeBuildingSummary()`.
 *
 * ⚠️ Ο **κανόνας εφεδρείας είναι μέρος του συμβολαίου**: κωδικός που δεν βρέθηκε
 * στις κατηγορίες εμφανίζεται **ως ο ίδιος ο κωδικός**, ποτέ κενός. Αν οι δύο
 * διαδρομές ανάγνωσης απέκλιναν εδώ, η σύνοψη του πράκτορα θα έγραφε `OIK-2`
 * εκεί όπου η οθόνη γράφει «Σκυροδέματα» — ίδια αστοχία, άλλο πρόσωπο.
 */
export function buildCategoryNameMap(
  items: readonly BOQItem[],
  categories: readonly BOQCategory[],
): Map<string, string> {
  const names = new Map<string, string>();
  for (const category of categories) {
    names.set(category.code, category.nameEL);
  }
  for (const item of items) {
    if (!names.has(item.categoryCode)) {
      names.set(item.categoryCode, item.categoryCode);
    }
  }
  return names;
}

/**
 * Ταίριασμα ελεύθερου κειμένου σε γραμμή επιμέτρησης.
 *
 * Γίνεται **στη μνήμη** και όχι στη Firestore επειδή η Firestore δεν έχει
 * αναζήτηση υποσυμβολοσειράς. Τα πεδία που εξετάζονται (τίτλος, κωδικός
 * κατηγορίας, περιγραφή) είναι **μέρος του συμβολαίου του εργαλείου**
 * `boq_search_items`: η περιγραφή που διαβάζει το μοντέλο τα δηλώνει ρητά, άρα
 * αλλαγή εδώ χωρίς αλλαγή εκεί κάνει την περιγραφή ψεύτικη.
 *
 * @param term Ήδη σε πεζά. Ο καλών κανονικοποιεί μία φορά για όλη τη λίστα.
 */
export function matchesBoqSearchText(item: BOQItem, term: string): boolean {
  return (
    item.title.toLowerCase().includes(term) ||
    item.categoryCode.toLowerCase().includes(term) ||
    (item.description?.toLowerCase().includes(term) ?? false)
  );
}

/** Εφαρμόζει το φίλτρο κειμένου σε λίστα· κενός/άδειος όρος ⇒ η λίστα ως έχει. */
export function applyBoqSearchText(
  items: readonly BOQItem[],
  searchText: string | undefined,
): BOQItem[] {
  const term = searchText?.trim().toLowerCase();
  if (!term) return [...items];
  return items.filter((item) => matchesBoqSearchText(item, term));
}
