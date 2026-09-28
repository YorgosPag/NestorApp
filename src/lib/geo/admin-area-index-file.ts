/**
 * @fileoverview **ΤΟ ΕΥΡΕΤΗΡΙΟ ΤΩΝ ΠΕΡΙΟΧΩΝ** — ό,τι μπορεί να βρει η αναζήτηση τόπου.
 * @related ADR-883 · `scripts/build-admin-boundaries.ts` (γραφέας) · `admin-area-search.ts` (αναζήτηση)
 * @module lib/geo/admin-area-index-file
 *
 * 🔑 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΠΟ ΤΗΝ ΙΕΡΑΡΧΙΑ**: το `administrative-hierarchy.json` είναι **3,9 MB**
 * *(20.720 οντότητες, με οικισμούς και ταχυδρομικούς κωδικούς)*. Η αναζήτηση της αρχικής
 * σελίδας χρειάζεται μόνο *όνομα · βαθμίδα · γονέα* — και **μόνο** για οντότητες που καταλήγουν
 * σε όριο, ώστε **κάθε** πρόταση να δίνει σχήμα στον χάρτη. Μια πρόταση που οδηγεί σε
 * «όριο μη διαθέσιμο» είναι υπόσχεση που αθετείται. Οι οικισμοί (§5.10) δεν έχουν δικό τους
 * όριο — δείχνουν του γονέα τους, που το έχει πάντα.
 *
 * ⚠️ **Φύλλο χωρίς runtime εισαγωγές από `@/`** — το διαβάζει και ο γεννήτορας (`tsx`).
 */

import type { AdminAreaChild } from './admin-area-of-point';

/** Η δημόσια θέση του ευρετηρίου, κάτω από `public/`. */
export const ADMIN_AREA_INDEX_FILE = 'data/admin-area-index.json';

/**
 * Μία γραμμή: `[id, επίσημο όνομα, βαθμίδα, γονέας]`.
 *
 * 🔑 **Το ΕΠΙΣΗΜΟ όνομα, όπως το γράφει το μητρώο** — από 2026-09-27 **με τη γραφή του**
 * (`Δήμος Κορδελιού - Ευόσμου`, ADR-893). Η πηγή (ΕΛΣΤΑΤ/ΥΠΕΣ) γράφει τις βαθμίδες 1–6 κεφαλαία.
 *
 * ⚠️ **Η απόφαση της 2026-09-25 ΙΣΧΥΕΙ — άλλαξε ο τρόπος, όχι η αρχή**: «μισοτονισμένο όνομα
 * είναι χειρότερο από κεφαλαίο». Τότε η μόνη υποψήφια ήταν **επινόηση** τόνων από λεξικό
 * κοινοτήτων (69,6% κάλυψη, διφορούμενο: `Αγίας` ≠ `Αγιάς`) — σωστά απορρίφθηκε. Το ADR-893
 * **δεν επινοεί**: κάθε τόνος **αποδεικνύεται** από τον ν. 3852/2010 ή το Wikidata με ίδιες
 * λέξεις, κανόνα μονοτονικού και ομοφωνία· ό,τι δεν αποδεικνύεται μένει κεφαλαίο και
 * **ονομάζεται** στην αναφορά (`scripts/data/admin-display-names.json`).
 *
 * 🔑 **Ο γονέας ενός οικισμού είναι ΠΑΝΤΑ περιοχή με όριο** — ο γεννήτορας τον δένει στον
 * πλησιέστερο πρόγονο **με αρχείο ορίου** (§5.10). Έτσι «ποιο όριο δείχνει ο οικισμός;» έχει
 * **μία** απάντηση, το `parentId`, χωρίς αναζήτηση.
 *
 * ⚠️ **Πλειάδα, όχι αντικείμενο, επίτηδες**: ~15.000 γραμμές × τέσσερα ονόματα πεδίων θα
 * ήταν ~300 KB **μόνο κλειδιά**, σε αρχείο που κατεβαίνει όταν ανοίξει το πεδίο.
 *
 * Το **πέμπτο** στοιχείο (προαιρετικό, ADR-893 §7) = άλλα **πλήρη** ονόματα του ίδιου τόπου — η παλιά
 * γραφή της ΕΛΣΤΑΤ για όσα διορθώθηκαν. Μόνο όπου υπάρχει: 3 γραμμές, όχι 15.000 κενοί πίνακες.
 */
export type AdminAreaIndexRow =
  | readonly [id: string, name: string, level: number, parentId: string | null]
  | readonly [id: string, name: string, level: number, parentId: string | null, alternateNames: readonly string[]];

/**
 * Η βαθμίδα των **οικισμών** — η μόνη χωρίς δικό της όριο (η πηγή δίνει **σημεία**, ADR-883 §5.10).
 * Επιλογή οικισμού ⇒ το όριο του γονέα + πινέζα στο χωριό.
 */
export const SETTLEMENT_LEVEL = 8;

/** Μια περιοχή του ευρετηρίου, με ονόματα πεδίων — ό,τι βλέπει ο υπόλοιπος κώδικας. */
export interface AdminArea {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly parentId: string | null;
  /** Άλλα ονόματα του ίδιου τόπου (ADR-893 §7) — η αναζήτηση τα βρίσκει, η οθόνη δείχνει το `name`. */
  readonly alternateNames?: readonly string[];
}

/**
 * **Ποιας περιοχής το όριο δείχνει ο χάρτης όταν επιλεγεί αυτή;** — η ίδια, ή, για οικισμό, ο
 * γονέας του (που είναι πάντα περιοχή με όριο). Η ΜΙΑ διατύπωση του κανόνα: κατάλογος
 * επαγγελματιών (κάλυψη ανά περιοχή) και φορτωτής ορίων ρωτούν **εδώ**.
 */
export function boundaryOwnerId(area: AdminArea): string {
  return area.level === SETTLEMENT_LEVEL && area.parentId !== null ? area.parentId : area.id;
}

function readAlternates(value: unknown): readonly string[] | null {
  return Array.isArray(value) && value.length > 0 && value.every((name) => typeof name === 'string') ? value : null;
}

function readRow(value: unknown): AdminArea | null {
  if (!Array.isArray(value) || (value.length !== 4 && value.length !== 5)) return null;
  const [id, name, level, parentId, alternates] = value as unknown[];
  if (typeof id !== 'string' || typeof name !== 'string' || typeof level !== 'number') return null;
  if (parentId !== null && typeof parentId !== 'string') return null;
  if (value.length === 4) return { id, name, level, parentId };
  const alternateNames = readAlternates(alternates);
  return alternateNames === null ? null : { id, name, level, parentId, alternateNames };
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

/** Το κλειδί των **ριζών** στο {@link adminAreaChildrenIndex}: γονέας εκτός ευρετηρίου (Αποκεντρωμένη, βαθμίδα 2). */
export const ADMIN_AREA_ROOT_KEY = '';

/**
 * **Ευρετήριο → «παιδιά ανά γονέα»** — η ΜΙΑ κατασκευή της ιεραρχίας για τον κριτή περιοχής
 * (`admin-area-of-point.ts`). Τη ζητούν ο server (απόδοση περιοχής αγγελίας, ADR-890 Φ0) **και** ο γεννήτορας
 * ζωνών (ADR-889 Φ5): δύο γραφές θα σήμαιναν ότι μια ζώνη και μια αγγελία στο ίδιο σημείο θα μπορούσαν να
 * καταλήξουν σε διαφορετική Δημοτική Ενότητα.
 */
export function adminAreaChildrenIndex(areas: ReadonlyMap<string, AdminArea>): ReadonlyMap<string, readonly AdminAreaChild[]> {
  const children = new Map<string, AdminAreaChild[]>();
  for (const area of areas.values()) {
    const key = area.parentId !== null && areas.has(area.parentId) ? area.parentId : ADMIN_AREA_ROOT_KEY;
    const siblings = children.get(key) ?? [];
    siblings.push({ id: area.id, level: area.level });
    children.set(key, siblings);
  }
  return children;
}

/**
 * Σχήμα `id` της ιεραρχίας: `<βαθμίδα>:<κωδικός>` (`municipality:0708`). Ό,τι άλλο απορρίπτεται, ώστε
 * κανένας αναγνώστης να μη ζητά αρχείο με αυθαίρετο όνομα από τη διεύθυνση (`?area=`, `/area/[id]`).
 */
const ADMIN_AREA_ID = /^[a-z_]+:[0-9]+$/;

export function isAdminAreaId(value: string): boolean {
  return ADMIN_AREA_ID.test(value);
}

/**
 * Όσα βήματα ανεβαίνει η γενεαλογία το πολύ — φρουρός απέναντι σε κύκλο στα δεδομένα. Ένας αριθμός για
 * κάθε αναρρίχηση γονέων (και για τη γενεαλογία λέξεων του `admin-area-search.ts`).
 */
export const ADMIN_AREA_ANCESTOR_DEPTH = 8;

/**
 * **Οι πρόγονοι μιας περιοχής**, από τον άμεσο γονέα προς τα πάνω — πάνω στον σκέτο χάρτη του ευρετηρίου,
 * ώστε να τη ρωτά και ο διακομιστής (σελίδα περιοχής, ADR-890 Φ1) χωρίς το ευρετήριο αναζήτησης.
 * Η **μία** υλοποίηση: το `adminAreaLineage` του `admin-area-search.ts` αναθέτει εδώ (ADR-890 §10.6).
 */
export function adminAreaAncestors(areas: ReadonlyMap<string, AdminArea>, adminId: string): readonly AdminArea[] {
  const ancestors: AdminArea[] = [];
  let current = areas.get(adminId);
  for (let guard = ADMIN_AREA_ANCESTOR_DEPTH; current?.parentId && guard > 0; guard -= 1) {
    const parent = areas.get(current.parentId);
    if (parent === undefined) break;
    ancestors.push(parent);
    current = parent;
  }
  return ancestors;
}
