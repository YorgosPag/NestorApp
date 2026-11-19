/**
 * @fileoverview SSoT — **ποιο στοιχείο OSM είναι αυτό το χαρακτηριστικό πλακιδίου** (και ποια στρώση κρατά τα κτίρια).
 * @related ADR-777 · SPEC-777A §13.5 · ADR-891 (το δικό μας αρχείο Protomaps) · ADR-937 (χάρτης προσανατολισμού)
 * @module lib/geo/osm/protomaps-osm-identity
 *
 * 🔑 **ΜΙΑ ταυτότητα, τρεις καταναλωτές**: ο χάρτης στην οθόνη (κλικ ⇒ κτίριο, 0 δίκτυο), ο διακομιστής που διαβάζει
 *    το **ίδιο** αρχείο (επαλήθευση §14.4 κ.2) και ο τονισμός (`['==', ['id'], …]`). Γραμμένη δύο φορές, η μία πλευρά θα
 *    τόνιζε κτίριο που η άλλη δεν θα αναγνώριζε.
 *
 * 📏 **ΜΕΤΡΗΜΕΝΟ (2026-11-19, `greece-20260926.pmtiles`, z15 Θέρμη)**: `feature.id = 2^45 + OSM way id`. Επαληθεύτηκε στο
 *    OSM API: `35184972705813` ⇒ way **600616981** (Lidl, Πανόραμα 55236) · `35185350375225` ⇒ way **978286393**.
 *    🔶 Η κωδικοποίηση **node / relation ΔΕΝ μετρήθηκε** ⇒ `null` ονομαστικά, ποτέ μαντεψιά. Είναι το ίδιο όριο με τον
 *    επιλογέα του Overpass (`osm-building.ts`: μόνο `way`, οι σχέσεις = **0,24 %** των κτιρίων, μετρημένο) — ένα κτίριο-σχέση
 *    συμπεριφέρεται σαν κενό του OSM, και το §13.6 έχει ήδη απάντηση: πινέζα ή σχεδίαση.
 *
 * ⚠️ Τα id ξεπερνούν το `2^32` αλλά μένουν **κάτω από `2^53`** (`2^45 + 2^44 ≈ 5,3·10^13`) ⇒ ασφαλής ακέραιος JS. Ο έλεγχος
 *    `Number.isSafeInteger` υπάρχει για να το **αποδεικνύει** σε κάθε κλήση, όχι για να το ελπίζει.
 *
 * **Layering**: leaf — καθαρές σταθερές + συναρτήσεις, πελάτης **και** διακομιστής. Καμία εξάρτηση από δίκτυο/React
 * (το `maplibre-gl` μόνο ως `import type` — σβήνεται στη μεταγλώττιση, CHECK 3.75).
 */

import type { ExpressionSpecification } from 'maplibre-gl';

import type { OsmElementType } from '@/types/geo/public-place';

/** Το όνομα της στρώσης **μέσα στο πλακίδιο** (MVT `source-layer`) που κρατά τα κτίρια του Protomaps. */
export const PROTOMAPS_BUILDINGS_SOURCE_LAYER = 'buildings';

/**
 * Το `id` της **στρώσης στυλ** (`@protomaps/basemaps`) που ζωγραφίζει τα κτίρια.
 *
 * ⚠️ **Άλλη έννοια από το {@link PROTOMAPS_BUILDINGS_SOURCE_LAYER}**, ας λένε σήμερα την ίδια λέξη: το ένα ονομάζει
 *    δεδομένα στο αρχείο, το άλλο στρώση του στυλ. Ο χάρτης ρωτά το δεύτερο (`queryRenderedFeatures({ layers })`), ο
 *    αναγνώστης του αρχείου το πρώτο. Στον εφεδρικό χάρτη (raster) η στρώση **δεν υπάρχει**.
 */
export const PROTOMAPS_BUILDINGS_STYLE_LAYER = 'buildings';

/** Οι τιμές του `kind` που σημαίνουν **κτίριο** στη στρώση κτιρίων (οι υπόλοιπες είναι π.χ. `address`). */
export const PROTOMAPS_BUILDING_KINDS = ['building', 'building_part'] as const;

/**
 * Το ίδιο κριτήριο ως **έκφραση φίλτρου MapLibre** — για κάθε στρώση που ζωγραφίζει μόνο κτίρια.
 * Συνάρτηση (νέος πίνακας σε κάθε κλήση): το στυλ της MapLibre κρατά και μπορεί να μεταλλάξει ό,τι του δοθεί.
 */
export function protomapsBuildingKindFilter(): ExpressionSpecification {
  return ['in', ['get', 'kind'], ['literal', [...PROTOMAPS_BUILDING_KINDS]]];
}

/** **Είναι κτίριο αυτό το χαρακτηριστικό;** — το ίδιο κριτήριο με το {@link protomapsBuildingKindFilter}. */
export function isProtomapsBuildingKind(kind: unknown): boolean {
  return typeof kind === 'string' && (PROTOMAPS_BUILDING_KINDS as readonly string[]).includes(kind);
}

/** `2^45` — η βάση των `way` (μετρημένη· δες την κεφαλίδα). */
const WAY_ID_BASE = 2 ** 45;

/**
 * Πόσο μεγάλο επιτρέπεται να είναι το way id: **κάτω από `2^44`**.
 *
 * 🔑 Κρατά την αποκωδικοποίηση **μέσα** στη μετρημένη ζώνη: ό,τι είναι πάνω από `2^45 + 2^44` ανήκει σε άλλη (αμέτρητη)
 *    κωδικοποίηση και δεν γίνεται σιωπηλά «way». Τα σημερινά way id είναι ~`1,5·10^9` — τέσσερις τάξεις μεγέθους κάτω.
 */
const WAY_ID_CEILING = 2 ** 44;

/** Μια αναφορά OSM όπως τη χρειάζεται η χειρονομία `picked-osm-building` (το id ως **συμβολοσειρά**). */
export interface ProtomapsOsmRef {
  readonly elementType: Extract<OsmElementType, 'way'>;
  readonly elementId: string;
}

/**
 * **id χαρακτηριστικού πλακιδίου → αναφορά OSM**, ή `null` όταν η κωδικοποίηση δεν είναι η μετρημένη (`way`).
 *
 * ⚠️ `null` **δεν** σημαίνει «δεν είναι κτίριο» — σημαίνει «δεν ξέρουμε ποιο στοιχείο OSM είναι». Ο καλών πηγαίνει στη
 *    δεύτερη βαθμίδα (διακομιστής), όχι στο «δεν υπάρχει κτίριο».
 */
export function osmRefOfTileFeatureId(id: unknown): ProtomapsOsmRef | null {
  if (typeof id !== 'number' || !Number.isSafeInteger(id)) return null;
  const wayId = id - WAY_ID_BASE;
  if (wayId <= 0 || wayId >= WAY_ID_CEILING) return null;
  return { elementType: 'way', elementId: String(wayId) };
}

/**
 * **way id → id χαρακτηριστικού πλακιδίου** — το αντίστροφο, για τον τονισμό (`['==', ['id'], …]`) και για την εύρεση
 * ενός **συγκεκριμένου** κτιρίου μέσα στο αρχείο.
 *
 * @param elementId Το OSM id ως συμβολοσειρά (`OsmReference.elementId`). Ό,τι δεν είναι θετικός ακέραιος της ζώνης ⇒ `null`.
 */
export function tileFeatureIdOfOsmWay(elementId: string): number | null {
  if (!/^[1-9]\d{0,15}$/.test(elementId)) return null;
  const wayId = Number(elementId);
  if (wayId >= WAY_ID_CEILING) return null;
  const id = WAY_ID_BASE + wayId;
  return Number.isSafeInteger(id) ? id : null;
}
