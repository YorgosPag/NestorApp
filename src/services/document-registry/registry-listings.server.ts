/**
 * @fileoverview Μητρώο λήξεων — οι ΔΗΜΟΣΙΕΥΜΕΝΕΣ ΑΓΓΕΛΙΕΣ και οι απαιτήσεις τους (ADR-915 Φ4β · Φ4δ Ε11).
 * @related services/mandate/showcase-presence.service.ts (`agencyId ==` — το ιδίωμα) · lib/legality/publication-requirements.ts
 * @module services/document-registry/registry-listings.server
 *
 * 🔴 **Γιατί δεν αρκούσε η Φ4β**: οι αγγελίες διαβάζονταν **μόνο** για ακίνητα που είχαν ήδη έγγραφο. Αγγελία χωρίς
 *    κανένα ΠΕΑ — ακριβώς η παράβαση (ενεργειακή κατηγορία υποχρεωτική σε κάθε αγγελία, μάθημα Idealista) — ήταν
 *    **αόρατη**. Τώρα:
 *  - `public_listings` `agencyId == companyId` — μία ισότητα, ήδη σε χρήση από τη βιτρίνα· το `agencyId` **είναι** το
 *    `companyId` του γραφείου (ADR-841 Α1.6)·
 *  - ∪ `getAll` για τα γνωστά ακίνητα: παλιές προβολές με `agencyId: null` δεν χάνονται μέχρι την επανασύνθεσή τους.
 * 🔑 **«Υπάρχει» = «δημοσιευμένη»**: η απόσυρση **σβήνει** το έγγραφο (`publish-public-listing`). Ανάγνωση **μόνο** μέσω
 *    του συνόρου `publicListingFromDocument` (CHECK 3.74).
 * 🔑 **Το όριο έχει αριθμό**: αγγελία με το όνομα του γραφείου που **δεν** αντιστοιχεί σε ακίνητο ή εντολή υπό τη
 *    θεματοφυλακή του (π.χ. εντολή σε ακίνητο που διαχειρίζεται άλλο γραφείο) **μετριέται** — ποτέ σιωπηλά.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { chunkArray } from '@/lib/array-utils';
import type { DocumentRequirement } from '@/lib/document-validity/document-requirement';
import { publicationRequirements } from '@/lib/legality/publication-requirements';
import { publicListingFromDocument } from '@/lib/listings/public-listing-from-document';
import type { PublicListing } from '@/types/public-listing';
import { REGISTRY_GET_ALL_CHUNK } from './document-registry.types';

interface AgencyListings {
  readonly listings: readonly PublicListing[];
  readonly truncated: boolean;
}

/** Οι δημοσιευμένες αγγελίες με το όνομα **αυτού** του γραφείου. */
export async function readAgencyListings(db: AdminFirestore, companyId: string, cap: number): Promise<AgencyListings> {
  // tenant-scope-exempt: το `public_listings` είναι δημοσιευμένη προβολή (`unscopedCategory: 'published-projection'`)·
  // το `agencyId` είναι το κλειδί του `agency_profiles/{companyId}`, που ο κανόνας δίνει σε ανώνυμο (ADR-841 §7 Α1).
  // Το φίλτρο είναι στενότερο από το αφιλτράριστο ερώτημα που ο ίδιος κανόνας ήδη επιτρέπει — ίδιο με τη βιτρίνα.
  const snapshot = await db
    .collection(COLLECTIONS.PUBLIC_LISTINGS)
    .where('agencyId', '==', companyId)
    .limit(cap + 1)
    .get();
  const listings = snapshot.docs
    .slice(0, cap)
    .map((doc) => publicListingFromDocument(doc.data(), doc.id))
    .filter((listing): listing is PublicListing => listing !== null);
  return { listings, truncated: snapshot.size > cap };
}

/** Οι δημοσιευμένες αγγελίες αυτών των ακινήτων (`id` αγγελίας = `id` ακινήτου) — σε ομάδες, ποτέ μία ανά γραμμή. */
export async function readListingsById(db: AdminFirestore, ids: readonly string[]): Promise<readonly PublicListing[]> {
  const listings: PublicListing[] = [];
  for (const group of chunkArray([...new Set(ids)], REGISTRY_GET_ALL_CHUNK)) {
    const snapshots = await db.getAll(...group.map((id) => db.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(id)));
    for (const snapshot of snapshots) {
      const listing = snapshot.exists ? publicListingFromDocument(snapshot.data(), snapshot.id) : null;
      if (listing !== null) listings.push(listing);
    }
  }
  return listings;
}

interface ScopedListingRequirements {
  readonly requirements: readonly DocumentRequirement[];
  /** Πόσες αγγελίες **δεν** ανήκουν σε ακίνητο ή εντολή υπό τη θεματοφυλακή του γραφείου. */
  readonly unscoped: number;
}

/**
 * Οι απαιτήσεις των αγγελιών **εντός** εμβέλειας — μία φορά ανά αγγελία, όσες πηγές κι αν τη βρήκαν.
 * @param inScope — τα ακίνητα (εταιρείας ή εντολής) που ο καλών **έχει ήδη κρίνει** του γραφείου.
 */
export function listingRequirementsOf(
  listings: readonly PublicListing[],
  inScope: ReadonlySet<string>,
): ScopedListingRequirements {
  const unique = new Map(listings.map((listing) => [listing.id, listing]));
  const requirements: DocumentRequirement[] = [];
  let unscoped = 0;
  for (const listing of unique.values()) {
    if (!inScope.has(listing.id)) {
      unscoped += 1;
      continue;
    }
    requirements.push(...publicationRequirements({ listingId: listing.id, propertyId: listing.id, offerKinds: listing.offerKinds }));
  }
  return { requirements, unscoped };
}
