/**
 * @fileoverview **Ο ΦΟΡΤΩΤΗΣ ΤΩΝ ΟΡΙΩΝ** — ένα όριο ανά περιοχή, κατ' απαίτηση, μία φορά.
 * @related ADR-883 · `admin-boundary-file.ts` (συμβόλαιο) · `lib/data/lazy-json-snapshot.ts` (μηχανή)
 * @module lib/geo/admin-boundaries
 *
 * 🔑 **ΚΑΜΙΑ ΝΕΑ ΜΗΧΑΝΗ ΦΟΡΤΩΣΗΣ.** Η cache, το single-flight και η σωστή συμπεριφορά σε
 * αποτυχία *(«άφησε την cache άδεια ώστε η επόμενη προσάρτηση να ξαναδοκιμάσει»)* ζουν στο
 * `createLazyJsonSnapshot` και έχουν πληρωθεί με περιστατικό. Εδώ υπάρχει **ένα
 * στιγμιότυπο ανά περιοχή** — ο χάρτης κλειδιών είναι η μόνη προσθήκη.
 *
 * ⚠️ **Ο χάρτης δεν αδειάζει ποτέ, επίτηδες**: ο επισκέπτης βλέπει λίγα όρια ανά συνεδρία
 * (λίγα KB το καθένα), και η επιστροφή σε προηγούμενο όριο γίνεται **ακαριαία**.
 */

import { createLazyJsonSnapshot, createLazySnapshot, type LazyJsonSnapshot } from '@/lib/data/lazy-json-snapshot';
import { createModuleLogger } from '@/lib/telemetry';
import type { GeoPoint, GeoRegion } from '@/types/geo/coordinates';
import { boundaryOwnerId } from './admin-area-index-file';
import { ADMIN_AREA_INDEX_SOURCE } from './admin-area-search';
import { adminBoundaryPath, readAdminBoundary } from './admin-boundary-file';
import { geoJsonRings } from './geo-geojson';

const logger = createModuleLogger('admin-boundaries');

/** Ένας οικισμός με τη θέση του μέσα στο όριο (§5.10) — ό,τι χρειάζεται η πινέζα του χάρτη. */
export interface AdminPlace {
  readonly adminId: string;
  readonly point: GeoPoint;
}

/**
 * Το όριο **έτοιμο για χρήση**: η γεωμετρία για τον χάρτη **και** η περιοχή για τον κριτή,
 * φτιαγμένες μία φορά — ώστε η ταυτότητα της περιοχής να μένει σταθερή ανάμεσα σε
 * αποδόσεις και κανένα `useMemo` πιο κάτω να μην ξαναϋπολογίζει χωρίς λόγο.
 */
export interface LoadedAdminBoundary {
  readonly geometry: GeoJSON.MultiPolygon;
  readonly region: GeoRegion;
  readonly level: number;
  /** Οι οικισμοί του ορίου με τη θέση τους (§5.10) — ό,τι έγραψε ο γεννήτορας. */
  readonly places: ReadonlyMap<string, GeoPoint>;
  /**
   * **Ο τόπος που ζήτησε ο άνθρωπος μέσα στο όριο** — η θέση του οικισμού όταν επιλέχθηκε
   * οικισμός, `null` όταν επιλέχθηκε η ίδια η περιοχή ή όταν η θέση δεν επαληθεύτηκε.
   */
  readonly place: AdminPlace | null;
}

const sources = new Map<string, LazyJsonSnapshot<LoadedAdminBoundary>>();

const logFailure = (adminId: string) => (error: unknown) => {
  logger.warn('Δεν φορτώθηκε το όριο περιοχής', {
    adminId,
    error: error instanceof Error ? error.message : String(error),
  });
};

/** Το αρχείο ορίου μιας περιοχής **που έχει δικό της** όριο (βαθμίδες 3–7). */
function ownBoundarySource(adminId: string): LazyJsonSnapshot<LoadedAdminBoundary> {
  return createLazyJsonSnapshot<LoadedAdminBoundary>({
    url: adminBoundaryPath(adminId),
    build: (payload) => {
      const boundary = readAdminBoundary(payload, adminId);
      // Πετά ⇒ ο φορτωτής το γράφει ως αποτυχία («δεν ξέρω»), ποτέ ως κενό όριο.
      if (boundary === null) throw new TypeError(`Το όριο ${adminId} δεν έχει το αναμενόμενο σχήμα`);
      return {
        geometry: boundary.geometry,
        level: boundary.level,
        places: boundary.places,
        place: null,
        region: {
          adminId,
          rings: geoJsonRings(boundary.geometry),
          bbox: boundary.bbox,
          toleranceM: boundary.toleranceM,
        },
      };
    },
    onFailure: logFailure(adminId),
  });
}

function placeOf(places: ReadonlyMap<string, GeoPoint>, adminId: string): AdminPlace | null {
  const point = places.get(adminId);
  return point === undefined ? null : { adminId, point };
}

/**
 * 🔑 **ΟΙΚΙΣΜΟΣ (ADR-883 §5.10) = το όριο του γονέα, με ΔΙΚΗ ΤΟΥ ταυτότητα.** Η πηγή δίνει
 * σημεία, όχι πολύγωνα ⇒ ευρετήριο (ποιος είναι ο γονέας;) → όριο του γονέα (το **ίδιο**
 * στιγμιότυπο που θα έπαιρνε η κοινότητα — καμία δεύτερη λήψη) → η περιοχή **ξαναβαφτίζεται**
 * με το `id` του οικισμού, γιατί ο κριτής (`resolveListingSearch`) απορρίπτει όριο «άλλης
 * περιοχής» από αυτή που γράφει η διεύθυνση.
 */
function settlementBoundarySource(adminId: string): LazyJsonSnapshot<LoadedAdminBoundary> {
  return createLazySnapshot<LoadedAdminBoundary>({
    produce: async () => {
      await ADMIN_AREA_INDEX_SOURCE.load();
      const area = ADMIN_AREA_INDEX_SOURCE.peek()?.areas.get(adminId);
      if (area === undefined) throw new Error(`Unknown settlement ${adminId}`);

      const owner = adminBoundarySource(boundaryOwnerId(area));
      await owner.load();
      const boundary = owner.peek();
      if (boundary === null) throw new Error(`Parent boundary of ${adminId} failed to load`);
      return {
        ...boundary,
        place: placeOf(boundary.places, adminId),
        region: { ...boundary.region, adminId },
      };
    },
    onFailure: logFailure(adminId),
  });
}

/**
 * Οικισμός; — από το ίδιο το `id` (`settlement:…`, πρόθεμα βαθμίδας 8 της ιεραρχίας, ADR-772), ώστε
 * οι περιοχές με δικό τους όριο να **μην** περιμένουν το ευρετήριο.
 */
const SETTLEMENT_ID = /^settlement:/;

/** Το στιγμιότυπο του ορίου μιας περιοχής — το ίδιο αντικείμενο σε κάθε κλήση. */
export function adminBoundarySource(adminId: string): LazyJsonSnapshot<LoadedAdminBoundary> {
  const existing = sources.get(adminId);
  if (existing) return existing;

  const source = SETTLEMENT_ID.test(adminId) ? settlementBoundarySource(adminId) : ownBoundarySource(adminId);
  sources.set(adminId, source);
  return source;
}
