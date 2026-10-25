/**
 * @fileoverview **Η ΔΗΛΩΜΕΝΗ ΑΠΟΔΟΣΗ ΠΕΡΙΟΧΗΣ** — ο εκδότης λέει τη βαθμίδα που η θέση δεν φτάνει, ο server την ελέγχει.
 * @related ADR-890 §21 · `admin-area-of-point.ts` (η μετρημένη απόδοση, `measuredDepth`) · `admin-area-index-file.ts`
 *   (γενεαλογία) · `geo-area.ts` (`areasOverlap`, ο ΕΝΑΣ κριτής κύκλου ⇄ περιοχής)
 * @module lib/geo/admin-area-declaration
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΠΡΟΒΛΗΜΑ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Θέση `center` από τον geocoder ⇒ απόδοση ως τον **δήμο** (`DEPTH_BY_ACCURACY`): ένα «κέντρο» πέφτει σε τυχαία κοινότητα,
 * άρα η μέτρηση **σωστά** σταματά εκεί. Αλλά η αγγελία τότε λείπει από κάθε σελίδα και αναζήτηση Δ.Ε. (§20: ρηχή απόδοση
 * = «εκτός»), ενώ ο εκδότης **ξέρει** σε ποιο χωριό είναι το σπίτι του.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Ο ΚΑΝΟΝΑΣ — «ΜΕΤΡΗΜΕΝΟ ΠΡΟΘΕΜΑ + ΔΗΛΩΜΕΝΗ ΟΥΡΑ», ΠΟΤΕ ΑΝΑΠΟΔΑ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Πρότυπο: Google Address Validation, που κρίνει **κάθε συστατικό χωριστά** και ονομάζει
 * `UNCONFIRMED_AND_SUSPICIOUS` τη «γειτονιά που δεν ταιριάζει με την υπόλοιπη διεύθυνση». Εδώ η «υπόλοιπη διεύθυνση»
 * είναι **η γεωμετρία**, που είναι αυστηρότερη από κάθε κείμενο. Η δήλωση γίνεται δεκτή **μόνο αν**:
 *
 * 1. η περιοχή υπάρχει στο ευρετήριο (`unknown-area`)·
 * 2. η γενεαλογία της **περιέχει** κάθε μετρημένη ταυτότητα (`contradicts-measured`) — μια δήλωση **ποτέ** δεν
 *    υπερισχύει μέτρησης· η αντίφαση είναι το σήμα «φουσκωμένης περιοχής» και καταγράφεται από τον καλούντα·
 * 3. προσθέτει έστω μία βαθμίδα **βαθύτερα** από τη μέτρηση (`not-deeper`)·
 * 4. η βαθύτερη δηλωμένη περιοχή **τέμνει τον κύκλο αβεβαιότητας** της θέσης (`outside-uncertainty`) — τον ΙΔΙΟ κύκλο
 *    που κρίνει την αναζήτηση (`listingSearchArea`), όχι δεύτερη ακτίνα.
 *
 * ⚠️ **Η δήλωση δεν αγγίζει τη θέση.** Πινέζα, `accuracy` και σχήμα χάρτη μένουν ό,τι μέτρησε η μηχανή: ο εκδότης
 * δηλώνει **περιοχή**, όχι **σημείο** — ποτέ ψεύτικη ακρίβεια.
 *
 * 🔑 **Οικισμός ως δήλωση**: ο οικισμός (βαθμίδα 8) δεν αποθηκεύεται, αλλά η γενεαλογία του **είναι** η κοινότητα και η
 * Δ.Ε. του — από το `parentId` του ευρετηρίου, ποτέ από το πρόθεμα της ταυτότητας (θα ήταν δεύτερος πίνακας).
 */

import type { GeoCircle, GeoRegion } from '@/types/geo/coordinates';
import { adminAreaAncestors, type AdminArea } from './admin-area-index-file';
import { adminAreaFieldOfLevel, type AdminAreaAssignment, type AdminAreaField } from './admin-area-of-point';
import { areasOverlap } from './geo-area';

/** Ό,τι χρειάζεται η επικύρωση — το ευρετήριο (γενεαλογία) και τα όρια (τομή με τον κύκλο). */
export interface AdminAreaDeclarationSources {
  readonly areas: ReadonlyMap<string, AdminArea>;
  /** Τα άμεσα παιδιά μιας περιοχής (με οικισμούς) — για τις επιλογές του {@link declarableAdminAreas}. */
  readonly childrenOf: (parentId: string) => readonly AdminArea[];
  /** Το όριο ως περιοχή που κρίνεται, ή `null` = «δεν ξέρω» (ποτέ «κενό»). */
  readonly regionOf: (adminId: string) => Promise<GeoRegion | null>;
}

/** Γιατί απορρίφθηκε μια δήλωση — ονομαστικά, ώστε η φόρμα να το πει και η καταγραφή να το μετρήσει. */
export type AdminAreaDeclarationRejection =
  | 'unknown-area'
  | 'contradicts-measured'
  | 'not-deeper'
  | 'outside-uncertainty'
  | 'boundary-unavailable';

export type AdminAreaDeclarationVerdict =
  | { readonly kind: 'applied'; readonly assignment: AdminAreaAssignment }
  | { readonly kind: 'rejected'; readonly reason: AdminAreaDeclarationRejection };

type DeclaredIds = Partial<Record<AdminAreaField, string>>;

interface DeclaredLevel {
  readonly level: number;
  readonly field: AdminAreaField;
  readonly id: string;
}

/** Η περιοχή και οι πρόγονοί της, ως «βαθμίδα με πεδίο → ταυτότητα». Ο οικισμός (χωρίς πεδίο) παραλείπεται. */
function lineageLevels(areas: ReadonlyMap<string, AdminArea>, area: AdminArea): readonly DeclaredLevel[] {
  const levels: DeclaredLevel[] = [];
  for (const node of [area, ...adminAreaAncestors(areas, area.id)]) {
    const field = adminAreaFieldOfLevel(node.level);
    if (field !== null) levels.push({ level: node.level, field, id: node.id });
  }
  return levels;
}

/**
 * Λέει η γενεαλογία **άλλη** ταυτότητα σε μετρημένη βαθμίδα; Συγκρίνονται μόνο οι βαθμίδες που έχει **και η γενεαλογία**:
 * η γενεαλογία φτάνει πάντα ως την Περιφέρεια, άρα κάθε **ρηχότερη** μετρημένη βαθμίδα ελέγχεται· μια μετρημένη βαθμίδα
 * **βαθύτερα** από τη δήλωση δεν είναι αντίφαση — η δήλωση είναι απλώς ρηχότερη (`not-deeper`).
 */
function agreesWithMeasured(measured: AdminAreaAssignment, declared: DeclaredIds): boolean {
  for (let level = 3; level <= measured.measuredDepth; level += 1) {
    const field = adminAreaFieldOfLevel(level);
    if (field === null) continue;
    const measuredId = measured[field];
    const declaredId = declared[field];
    if (measuredId !== null && declaredId !== undefined && declaredId !== measuredId) return false;
  }
  return true;
}

/**
 * **Εφαρμόζει μια δήλωση πάνω σε μετρημένη απόδοση** — ή εξηγεί γιατί δεν την εφάρμοσε.
 *
 * @param measured Η απόδοση του σημείου (`assignAdminArea`) — πάντα η βάση· η δήλωση μόνο συμπληρώνει.
 * @param declaredAreaId Οποιαδήποτε ταυτότητα του ευρετηρίου (Δ.Ε., κοινότητα ή οικισμός).
 * @param where Ο κύκλος αβεβαιότητας της θέσης — ο ίδιος με της αναζήτησης (`listingSearchArea`).
 */
export async function declareAdminArea(
  measured: AdminAreaAssignment,
  declaredAreaId: string,
  where: GeoCircle,
  sources: AdminAreaDeclarationSources,
): Promise<AdminAreaDeclarationVerdict> {
  const area = sources.areas.get(declaredAreaId);
  if (area === undefined) return { kind: 'rejected', reason: 'unknown-area' };

  const lineage = lineageLevels(sources.areas, area);
  const declared: DeclaredIds = Object.fromEntries(lineage.map(({ field, id }) => [field, id]));
  if (!agreesWithMeasured(measured, declared)) return { kind: 'rejected', reason: 'contradicts-measured' };

  const deeper = lineage.filter(({ level }) => level > measured.measuredDepth);
  if (deeper.length === 0) return { kind: 'rejected', reason: 'not-deeper' };

  // Η γενεαλογία πάει από το παιδί προς τα πάνω ⇒ το πρώτο στοιχείο είναι η βαθύτερη δηλωμένη περιοχή με όριο.
  const region = await sources.regionOf(deeper[0].id);
  if (region === null) return { kind: 'rejected', reason: 'boundary-unavailable' };
  if (!areasOverlap(where, region)) return { kind: 'rejected', reason: 'outside-uncertainty' };

  const added: DeclaredIds = Object.fromEntries(deeper.map(({ field, id }) => [field, id]));
  // `nearBoundary` αφορά τη ΜΕΤΡΗΜΕΝΗ βαθύτερη βαθμίδα· η δηλωμένη ουρά δεν έχει «σύνορο κοντά» — την είπε άνθρωπος
  // και την επικύρωσε η γεωμετρία. `measuredDepth` μένει αμετάβλητο: είναι ακριβώς αυτό που χωρίζει μέτρηση από δήλωση.
  return { kind: 'applied', assignment: { ...measured, ...added, nearBoundary: false } };
}

/** Πόσες περιοχές εξετάζει το πολύ ο {@link declarableAdminAreas} — φρουρός, όχι όριο που φτάνεται (δήμος ≈ 10–80). */
const MAX_DECLARABLE_CANDIDATES = 400;

/** Οι απόγονοι μιας περιοχής, κατά πλάτος, έως {@link MAX_DECLARABLE_CANDIDATES}. */
function descendantsOf(sources: AdminAreaDeclarationSources, rootId: string): readonly AdminArea[] {
  const found: AdminArea[] = [];
  const queue = [rootId];
  for (let next = 0; next < queue.length && found.length < MAX_DECLARABLE_CANDIDATES; next += 1) {
    for (const child of sources.childrenOf(queue[next])) {
      found.push(child);
      queue.push(child.id);
    }
  }
  return found.slice(0, MAX_DECLARABLE_CANDIDATES);
}

/** Η βαθύτερη μετρημένη ταυτότητα — η ρίζα των επιλογών και η εμβέλεια της πρότασης της μηχανής. */
export function deepestMeasuredId(measured: AdminAreaAssignment): string | null {
  const field = adminAreaFieldOfLevel(measured.measuredDepth);
  return field === null ? null : measured[field];
}

/**
 * **Ποιες περιοχές ΜΠΟΡΕΙ να δηλώσει ο εκδότης εδώ** — οι απόγονοι της μετρημένης περιοχής που ο
 * {@link declareAdminArea} θα **δεχόταν** (ADR-890 §21).
 *
 * 🔑 **Ισότητα κατά κατασκευή**: κάθε υποψήφια κρίνεται από τον **ΙΔΙΟ** κριτή που επικυρώνει την αποθήκευση και την
 * προβολή — όχι από δεύτερο φίλτρο που «μοιάζει». Ό,τι προσφέρει η φόρμα, το δέχεται ο server· ό,τι θα απέρριπτε, η
 * φόρμα δεν το δείχνει καν (το «μόνο τιμές από μητρώο» της Rightmove, συν γεωμετρία).
 */
export async function declarableAdminAreas(
  measured: AdminAreaAssignment,
  where: GeoCircle,
  sources: AdminAreaDeclarationSources,
): Promise<readonly AdminArea[]> {
  const rootId = deepestMeasuredId(measured);
  if (rootId === null) return [];
  const candidates = descendantsOf(sources, rootId);
  const verdicts = await Promise.all(
    candidates.map((area) => declareAdminArea(measured, area.id, where, sources)),
  );
  return candidates.filter((_, index) => verdicts[index].kind === 'applied');
}
