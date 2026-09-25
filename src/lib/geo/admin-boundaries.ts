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

import { createLazyJsonSnapshot, type LazyJsonSnapshot } from '@/lib/data/lazy-json-snapshot';
import { createModuleLogger } from '@/lib/telemetry';
import type { GeoRegion } from '@/types/geo/coordinates';
import { adminBoundaryPath, readAdminBoundary } from './admin-boundary-file';
import { geoJsonRings } from './geo-geojson';

const logger = createModuleLogger('admin-boundaries');

/**
 * Το όριο **έτοιμο για χρήση**: η γεωμετρία για τον χάρτη **και** η περιοχή για τον κριτή,
 * φτιαγμένες μία φορά — ώστε η ταυτότητα της περιοχής να μένει σταθερή ανάμεσα σε
 * αποδόσεις και κανένα `useMemo` πιο κάτω να μην ξαναϋπολογίζει χωρίς λόγο.
 */
export interface LoadedAdminBoundary {
  readonly geometry: GeoJSON.MultiPolygon;
  readonly region: GeoRegion;
  readonly level: number;
}

const sources = new Map<string, LazyJsonSnapshot<LoadedAdminBoundary>>();

/** Το στιγμιότυπο του ορίου μιας περιοχής — το ίδιο αντικείμενο σε κάθε κλήση. */
export function adminBoundarySource(adminId: string): LazyJsonSnapshot<LoadedAdminBoundary> {
  const existing = sources.get(adminId);
  if (existing) return existing;

  const source = createLazyJsonSnapshot<LoadedAdminBoundary>({
    url: adminBoundaryPath(adminId),
    build: (payload) => {
      const boundary = readAdminBoundary(payload, adminId);
      // Πετά ⇒ ο φορτωτής το γράφει ως αποτυχία («δεν ξέρω»), ποτέ ως κενό όριο.
      if (boundary === null) throw new TypeError(`Το όριο ${adminId} δεν έχει το αναμενόμενο σχήμα`);
      return {
        geometry: boundary.geometry,
        level: boundary.level,
        region: {
          adminId,
          rings: geoJsonRings(boundary.geometry),
          bbox: boundary.bbox,
          toleranceM: boundary.toleranceM,
        },
      };
    },
    onFailure: (error) => {
      logger.warn('Δεν φορτώθηκε το όριο περιοχής', {
        adminId,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });
  sources.set(adminId, source);
  return source;
}
