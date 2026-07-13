'use client';

/**
 * ADR-652 M2 — Cloud item → τοποθετήσιμος ορισμός (lazy geometry hydration).
 *
 * Ο ΜΟΝΟΣ συνδετής μεταξύ της μόνιμης βιβλιοθήκης και του placement tool: κατεβάζει το
 * geometry blob του `BlockLibraryItem` και το κάνει upsert στο in-memory registry — από
 * εκεί και πέρα το cloud block είναι **ΤΟ ΙΔΙΟ πράγμα** με ένα imported block (ίδιο
 * `InSessionBlockDef`, ίδιο tool, ίδιο ghost, ίδιο commit). Καμία δεύτερη διαδρομή
 * τοποθέτησης, καμία δεύτερη αναπαράσταση γεωμετρίας.
 *
 * Lazy by design (Revit/ArchiCAD browser): το palette δείχνει 500 κάρτες χωρίς να
 * κατεβάσει ούτε ένα byte γεωμετρίας· το blob έρχεται στο κλικ επιλογής.
 *
 * Idempotent: δεύτερο κλικ στην ίδια κάρτα δεν ξανακατεβάζει (ο ορισμός είναι ήδη εκεί).
 * Ονοματική σύγκρουση με imported block → last-wins ανά όνομα (πρακτική AutoCAD: ένας
 * ορισμός ανά όνομα σχεδίου).
 *
 * @see ./block-geometry-storage.ts — το κατέβασμα + validation του blob
 * @see ./block-library-registry.ts — ο προορισμός (τοποθετήσιμοι ορισμοί)
 */

import { fetchBlockGeometry } from './block-geometry-storage';
import { getSessionBlockDef, upsertSessionBlockDef } from './block-library-registry';
import type { BlockLibraryItem, InSessionBlockDef } from './block-library-types';

/**
 * Εξασφαλίζει ότι η γεωμετρία του `item` βρίσκεται στο registry και επιστρέφει τον
 * ορισμό. `null` όταν το blob λείπει/είναι άκυρο — ο καλών ΔΕΝ ενεργοποιεί το tool
 * (καλύτερα «δεν έγινε τίποτα» παρά tool που τοποθετεί το κενό).
 */
export async function hydrateCloudBlockDef(
  item: BlockLibraryItem,
): Promise<InSessionBlockDef | null> {
  const existing = getSessionBlockDef(item.name);
  if (existing && existing.localMembers.length > 0) return existing;

  // `companyId: null` = system/partner block (ADR-652 M3) → το blob ζει στο κοινό
  // `system/block-library/` path, ΟΧΙ κάτω από εταιρεία. Ο path builder το γνωρίζει.
  const blob = await fetchBlockGeometry({ companyId: item.companyId, blockId: item.id });
  if (!blob) return null;

  const def: InSessionBlockDef = {
    name: item.name,
    localMembers: blob.entities,
    // Το blob φέρει τα δικά του bounds (ground truth της γεωμετρίας)· το doc metadata
    // είναι το fallback αν ποτέ γραφτεί blob χωρίς αυτά.
    boundsMm: blob.boundsMm ?? item.boundsMm,
  };
  upsertSessionBlockDef(def);
  return def;
}
