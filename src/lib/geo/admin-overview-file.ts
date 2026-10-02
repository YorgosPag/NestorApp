/**
 * @fileoverview **ΤΑ ΠΑΝΕΛΛΑΔΙΚΑ ΑΡΧΕΙΑ ΕΠΙΣΚΟΠΗΣΗΣ ΟΡΙΩΝ** — όλοι οι Δήμοι / όλες οι Δ.Ε. σε **ένα** αρχείο ανά
 * βαθμίδα, για τον χωροπληθή χάρτη τιμών (ADR-890 §14.3). Σχήμα, διαδρομή, ανάγνωση.
 * @related `scripts/build-admin-overview.ts` (γραφέας) · `admin-boundary-file.ts` (ένα όριο τη φορά, ADR-883)
 * @module lib/geo/admin-overview-file
 *
 * 🔑 **Γιατί ΔΕΥΤΕΡΟ σχήμα ορίων και όχι τα αρχεία του ADR-883**: εκείνα είναι ένα ανά περιοχή, γιατί ο
 * επισκέπτης βλέπει **ένα** όριο τη φορά. Ο χωροπληθής βλέπει **όλα** μαζί: 948 αιτήματα αντί για ένα. Και
 * η απλοποίηση εδώ είναι **τοπολογική** (κάθε κοινή ακμή μία φορά) — τα αρχεία ανά περιοχή δεν μπορούν να
 * είναι, γιατί ο γείτονας δεν υπάρχει μέσα τους. Ίδια πηγή, ίδια άδεια, ίδια `id`.
 *
 * 🔑 **Η γεωμετρία δεν κουβαλά τιμές.** Οι τιμές έρχονται χωριστά και δένονται με `feature-state` πάνω στο
 * `properties.id` (`promoteId`): η γεωμετρία είναι μακρόβια και ίδια για κάθε πηγή/τμήμα.
 *
 * ⚠️ **Φύλλο χωρίς εισαγωγές χρόνου εκτέλεσης από `@/`** — το διαβάζει ο γεννήτορας με `tsx`.
 */

import { adminBoundaryFileName } from './admin-boundary-file';

/** Όπου ζουν — κάτω από `public/`, άρα σερβίρονται στατικά (CDN). */
export const ADMIN_OVERVIEW_DIR = 'data/admin-overview';

/** Αλλάζει **μόνο** με ασύμβατη αλλαγή σχήματος· προσθετικό πεδίο δεν την ανεβάζει (ADR-890 §12.1). */
export const ADMIN_OVERVIEW_FORMAT_VERSION = 1;

/**
 * Οι βαθμίδες επισκόπησης, από την αδρότερη στη λεπτότερη.
 * - `regional_unit`: 75 Π.Ε. — τα παιδιά μιας Περιφέρειας στη σελίδα της (ADR-890 §16).
 * - `municipality`: 333 Δήμοι.
 * - `municipal_unit`: τα **φύλλα** — 948 Δ.Ε. + οι Δήμοι **χωρίς** Δ.Ε. (αυτοί είναι το δικό τους φύλλο).
 */
export const ADMIN_OVERVIEW_TIERS = ['regional_unit', 'municipality', 'municipal_unit'] as const;
export type AdminOverviewTier = (typeof ADMIN_OVERVIEW_TIERS)[number];

/**
 * Η περιοχή στον χάρτη: `id` της ιεραρχίας + ο Δήμος της (για την αναγωγή κάτω από το κατώφλι) + τα ονόματα.
 * 🔑 Τα ονόματα ταξιδεύουν **εδώ**: το κείμενο του κλικ τα χρειάζεται, και η εναλλακτική θα ήταν το ευρετήριο
 * αναζήτησης (1,3 MB) για 1.035 ονόματα.
 */
export interface AdminOverviewProperties {
  readonly id: string;
  readonly name: string;
  /** Ο Δήμος μιας Δ.Ε.· `null` για Δήμο (ή Δήμο-φύλλο χωρίς Δ.Ε.). */
  readonly parent: string | null;
  readonly parentName: string | null;
  /**
   * **Σημείο ετικέτας** `[lon, lat]` — ο πόλος απροσπέλαστου του μεγαλύτερου πολυγώνου (ADR-890 §15). Σε **κάθε**
   * περιοχή κάθε βαθμίδας από το §18 (ο χάρτης της αναζήτησης γράφει κι αυτός την τιμή πάνω στην περιοχή)· τα αρχεία
   * **παιδιών** το κληρονομούν αυτούσιο. Προσθετικό πεδίο, άρα ίδια εκδοχή (§12.1).
   * 🔑 Προϋπολογισμένο, όχι από το MapLibre: εκείνο βάζει ετικέτα σε **κάθε** πολύγωνο ενός MultiPolygon και σε κάθε
   * κομμάτι πλακιδίου — νησίδα ή σύνορο πλακιδίου ⇒ διπλή τιμή πάνω στον χάρτη.
   */
  readonly label?: readonly [lon: number, lat: number];
}

export type AdminOverviewFeature = GeoJSON.Feature<GeoJSON.MultiPolygon, AdminOverviewProperties>;

/** Ένα `FeatureCollection` που το MapLibre δέχεται **αυτούσιο**· τα `v`/`meta` είναι ξένα μέλη (RFC 7946 §6.1). */
export interface AdminOverviewFile {
  readonly type: 'FeatureCollection';
  readonly v: number;
  readonly tier: AdminOverviewTier;
  /** Εγγυημένη μέγιστη απόκλιση από το αληθινό σύνορο, σε μέτρα. */
  readonly toleranceM: number;
  readonly features: readonly AdminOverviewFeature[];
}

/** Η δημόσια διαδρομή — ό,τι ζητά ο browser. */
export function adminOverviewPath(tier: AdminOverviewTier): string {
  return `/${ADMIN_OVERVIEW_DIR}/${tier}.json`;
}

/** Υποφάκελος των αρχείων **παιδιών ανά γονέα** (ADR-890 §15) — ίδιο σχήμα, ίδια τόξα με το αρχείο της βαθμίδας. */
export const ADMIN_OVERVIEW_CHILDREN_DIR = 'children';

/**
 * Αρχείο παιδιών υπάρχει **μόνο** για γονέα με τόσα παιδιά με γεωμετρία: με ένα, ο «χάρτης σύγκρισης» θα ήταν ένα
 * χρώμα χωρίς σύγκριση. Ο γεννήτορας γράφει με αυτόν τον κανόνα, η σελίδα ζητά με τον ίδιο (ADR-890 §15).
 */
export const ADMIN_OVERVIEW_CHILDREN_MIN = 2;

/**
 * Η δημόσια διαδρομή των **παιδιών** ενός Δήμου: οι Δ.Ε. του, κομμένες από την **ίδια** τοπολογική απλοποίηση με το
 * `municipal_unit.json` — ώστε ο χάρτης της σελίδας Δήμου να μην κατεβάζει τα 463 KB όλης της χώρας για δύο Δ.Ε.
 */
export function adminOverviewChildrenPath(parentId: string): string {
  return `/${ADMIN_OVERVIEW_DIR}/${ADMIN_OVERVIEW_CHILDREN_DIR}/${adminBoundaryFileName(parentId)}`;
}

function isLabel(value: unknown): value is readonly [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === 'number' && Number.isFinite(n));
}

function isOverviewFeature(value: unknown): value is AdminOverviewFeature {
  if (typeof value !== 'object' || value === null) return false;
  const feature = value as Partial<AdminOverviewFeature>;
  const properties = feature.properties as Partial<AdminOverviewProperties> | null | undefined;
  return (
    feature.type === 'Feature' &&
    feature.geometry?.type === 'MultiPolygon' &&
    typeof properties?.id === 'string' &&
    typeof properties.name === 'string' &&
    (properties.parent === null || typeof properties.parent === 'string') &&
    (properties.parentName === null || typeof properties.parentName === 'string') &&
    (properties.label === undefined || isLabel(properties.label))
  );
}

/**
 * Διαβάζει το αρχείο **με έλεγχο σχήματος**· `null` = άλλη εκδοχή ή χαλασμένο (ποτέ «καμία περιοχή»).
 * ⚠️ Χαλασμένο χαρακτηριστικό ακυρώνει **όλο** το αρχείο: μισός χάρτης θα έδειχνε κενές περιοχές ως «λίγα δεδομένα».
 */
export function readAdminOverviewFile(payload: unknown): AdminOverviewFile | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const file = payload as Partial<AdminOverviewFile>;
  if (file.type !== 'FeatureCollection' || file.v !== ADMIN_OVERVIEW_FORMAT_VERSION) return null;
  if (!ADMIN_OVERVIEW_TIERS.includes(file.tier as AdminOverviewTier)) return null;
  if (typeof file.toleranceM !== 'number' || !Array.isArray(file.features)) return null;
  if (!file.features.every(isOverviewFeature)) return null;
  return file as AdminOverviewFile;
}

/**
 * Ιδιότητες **όπως τις επιστρέφει ο χάρτης** (`queryRenderedFeatures` / κλικ) ⇒ τυπωμένες, ή `null`.
 * ⚠️ Τα πλακίδια του MapLibre **πετούν** τα `null` πεδία: `parent` που λείπει σημαίνει «κανένας Δήμος από πάνω».
 */
export function adminOverviewPropertiesOf(raw: Readonly<Record<string, unknown>> | null | undefined): AdminOverviewProperties | null {
  if (raw === null || raw === undefined || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  return {
    id: raw.id,
    name: raw.name,
    parent: typeof raw.parent === 'string' ? raw.parent : null,
    parentName: typeof raw.parentName === 'string' ? raw.parentName : null,
  };
}
