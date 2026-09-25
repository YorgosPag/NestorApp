/**
 * @fileoverview **ΤΟ ΕΥΡΕΤΗΡΙΟ ΤΩΝ ΠΕΡΙΟΧΩΝ ΜΕ ΟΡΙΟ** — ό,τι μπορεί να βρει η αναζήτηση τόπου.
 * @related ADR-883 · `scripts/build-admin-boundaries.ts` (γραφέας) · `admin-area-search.ts` (αναζήτηση)
 * @module lib/geo/admin-area-index-file
 *
 * 🔑 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΠΟ ΤΗΝ ΙΕΡΑΡΧΙΑ**: το `administrative-hierarchy.json` είναι **3,9 MB**
 * *(20.720 οντότητες, με οικισμούς και ταχυδρομικούς κωδικούς)*. Η αναζήτηση της αρχικής
 * σελίδας χρειάζεται μόνο *όνομα · βαθμίδα · γονέα* — και **μόνο** για οντότητες που έχουν
 * όριο, ώστε **κάθε** πρόταση να καταλήγει σε σχήμα στον χάρτη. Μια πρόταση που οδηγεί σε
 * «όριο μη διαθέσιμο» είναι υπόσχεση που αθετείται.
 *
 * ⚠️ **Φύλλο χωρίς runtime εισαγωγές από `@/`** — το διαβάζει και ο γεννήτορας (`tsx`).
 */

/** Η δημόσια θέση του ευρετηρίου, κάτω από `public/`. */
export const ADMIN_AREA_INDEX_FILE = 'data/admin-area-index.json';

/**
 * Μία γραμμή: `[id, επίσημο όνομα, βαθμίδα, γονέας]`.
 *
 * 🔑 **Το ΕΠΙΣΗΜΟ όνομα, αυτούσιο** (`ΔΗΜΟΣ ΚΟΡΔΕΛΙΟΥ - ΕΥΟΣΜΟΥ`) — και είναι απόφαση: η
 * πηγή γράφει τις βαθμίδες 3–6 **κεφαλαία χωρίς τόνους**, που είναι **σωστή** ελληνική
 * ορθογραφία. Μετατροπή σε πεζά θα απαιτούσε **επινόηση τόνων**: μετρημένο 2026-09-25, το
 * λεξικό των κοινοτήτων τονίζει μόνο **69,6%** των λέξεων και είναι **διφορούμενο**
 * (`Αγίας` ≠ `Αγιάς` — **άλλα** χωριά). Μισοτονισμένο όνομα είναι χειρότερο από κεφαλαίο.
 *
 * ⚠️ **Πλειάδα, όχι αντικείμενο, επίτηδες**: ~7.400 γραμμές × τέσσερα ονόματα πεδίων θα
 * ήταν ~150 KB **μόνο κλειδιά**, σε αρχείο που κατεβαίνει στην αρχική σελίδα.
 */
export type AdminAreaIndexRow = readonly [id: string, name: string, level: number, parentId: string | null];

/** Μια περιοχή του ευρετηρίου, με ονόματα πεδίων — ό,τι βλέπει ο υπόλοιπος κώδικας. */
export interface AdminArea {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly parentId: string | null;
}

function readRow(value: unknown): AdminArea | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const [id, name, level, parentId] = value as unknown[];
  if (typeof id !== 'string' || typeof name !== 'string' || typeof level !== 'number') return null;
  if (parentId !== null && typeof parentId !== 'string') return null;
  return { id, name, level, parentId };
}

/**
 * Διαβάζει το ευρετήριο — **πετά** αν δεν έχει το σχήμα του, ώστε ο τεμπέλης φορτωτής να
 * το καταγράψει ως αποτυχία («δεν ξέρω») και όχι ως κενό ευρετήριο («καμία περιοχή»).
 */
export function readAdminAreaIndex(payload: unknown): ReadonlyMap<string, AdminArea> {
  const data = (payload as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) throw new TypeError('Το ευρετήριο περιοχών δεν έχει το αναμενόμενο σχήμα');

  const areas = new Map<string, AdminArea>();
  for (const value of data) {
    const area = readRow(value);
    if (area !== null) areas.set(area.id, area);
  }
  return areas;
}
