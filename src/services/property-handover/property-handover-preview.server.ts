import 'server-only';

/**
 * @fileoverview **«Τι θα παραδοθεί;»** — οι παραδόσεις ενός ακινήτου και τα αρχεία του, κριμένα (ADR-916 §5.1).
 * @related property-handover-set.server.ts (η ΜΙΑ σύνθεση — την ίδια διαβάζει και ο εκτελεστής της αντιγραφής)
 * @module services/property-handover/property-handover-preview.server
 *
 * 🔑 **Καμία δική της κρίση**: ό,τι δείχνει εδώ στο γραφείο είναι **ακριβώς** ό,τι θα αντιγράψει ο εκτελεστής
 * (`loadHandoverSet`) — η όψη και η πράξη δεν μπορούν να διαφωνήσουν (ADR-916 Φ-Γ1, άγκυρα Γ13).
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { propertyHandoverFromDocument } from '@/lib/property-handover/property-handover-from-document';
import type { PropertyHandoverPreview } from '@/types/property-handover';

import { handoverSetPreviewFiles, loadHandoverSet } from './property-handover-set.server';
import { propertyHandoversQuery } from './property-handover-write.service';

/** `null` ⇒ το ακίνητο δεν υπάρχει ή δεν ανήκει στον μισθωτή (ο καλών απαντά 404). */
export async function previewPropertyHandover(
  adminDb: AdminFirestore,
  companyId: string,
  propertyId: string,
): Promise<PropertyHandoverPreview | null> {
  const [set, handoverSnap] = await Promise.all([
    loadHandoverSet(adminDb, companyId, propertyId),
    propertyHandoversQuery(adminDb, companyId, propertyId).get(),
  ]);
  if (set === null) return null;
  return {
    handovers: handoverSnap.docs.flatMap((doc) => {
      const handover = propertyHandoverFromDocument(doc.data(), doc.id);
      return handover ? [handover] : [];
    }),
    files: handoverSetPreviewFiles(set),
  };
}
