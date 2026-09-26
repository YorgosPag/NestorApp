/**
 * ENTERPRISE ID GENERATION — ΟΙ ΤΑΥΤΟΤΗΤΕΣ ΤΗΣ ΧΩΡΙΚΗΣ ΠΕΡΙΗΓΗΣΗΣ (ADR-884 Φ0.7)
 *
 * Κρίκος της αλυσίδας κληρονομικότητας (βλ. `enterprise-id-access-generators.ts`):
 *
 *   SavedListingIdGenerators
 *     ↑ extends
 *   SpatialTourIdGenerators      (this file)
 *     ↑ extends
 *   CompositeKeyIdGenerators
 *
 * Προσθέτει **ονοματοδοσία, ποτέ λογική γέννησης**: οι μηχανές (`generateId`,
 * `mintDeterministicV4Id`) ζουν στην `EnterpriseIdService`.
 *
 * 🔑 **Τρεις ντετερμινιστικές, τέσσερις τυχαίες** — και η διάκριση είναι το συμβόλαιο:
 * - `stour` από (είδος ρίζας, id): δύο ταυτόχρονες «δημιουργίες» γράφουν το **ίδιο** έγγραφο
 *   (idempotent, N.7.2 #3) — ίδιο ιδίωμα με το `PublicListing.id ≡ id ρίζας`.
 * - `tacr` από (περιήγηση, άνθρωπο): **ένα** αίτημα θέασης ανά άνθρωπο — ίδιο με το `wacr`.
 * - `tcap` από (ανέβασμα) όταν γεννιέται από **ολοκλήρωση ανεβάσματος** (Κ3α): διπλό κλικ ή επανάληψη
 *   δικτύου στο «ολοκλήρωσε» γράφει την **ίδια** λήψη — ποτέ δύο λήψεις από ένα αρχείο.
 * - `tnod` / `tcap` (λήψη χωρίς ανέβασμα, π.χ. απόδοση BIM της Φ3) / `tupl` / `tcin`: τυχαία. Η πρόσκληση **δεν** είναι ντετερμινιστική επίτηδες:
 *   επαναποστολή = νέο διακριτικό, το παλιό γίνεται `revoked` μέσα στην ίδια συναλλαγή (κοινός πυρήνας, ADR-853 §20).
 *
 * @module services/enterprise-id-spatial-tour-generators
 */

import type { PlaceSource } from '@/constants/place-sources';

import { ENTERPRISE_ID_PREFIXES } from './enterprise-id-prefixes';
import { SavedListingIdGenerators } from './enterprise-id-saved-listing-generators';

const P = ENTERPRISE_ID_PREFIXES;

export abstract class SpatialTourIdGenerators extends SavedListingIdGenerators {
  /** Η **μία** περιήγηση μιας ρίζας αγγελίας. Το είδος μπαίνει στον σπόρο: ίδιο id σε άλλη ρίζα ≠ ίδια περιήγηση. */
  generateDeterministicSpatialTourId(kind: PlaceSource, rootId: string): string {
    return this.mintDeterministicV4Id(P.SPATIAL_TOUR, `${kind}:${rootId}`);
  }

  generateTourNodeId(): string {
    return this.generateId(P.TOUR_NODE).id;
  }

  generateTourCaptureId(): string {
    return this.generateId(P.TOUR_CAPTURE).id;
  }

  /** Το **ένα** αίτημα θέασης ενός ανθρώπου για μία περιήγηση. */
  generateDeterministicTourAccessRequestId(tourId: string, uid: string): string {
    return this.mintDeterministicV4Id(P.TOUR_ACCESS_REQUEST, `${tourId}:${uid}`);
  }

  generateTourCaptureInvitationId(): string {
    return this.generateId(P.TOUR_CAPTURE_INVITATION).id;
  }

  /** Ένα ανέβασμα σε καραντίνα — τυχαίο: κάθε «ξεκίνα» είναι νέα συνεδρία. */
  generateTourUploadId(): string {
    return this.generateId(P.TOUR_UPLOAD).id;
  }

  /** Η **μία** λήψη που γεννά ένα ανέβασμα — η ολοκλήρωση είναι ιδεμπότητη επειδή το id **παράγεται**. */
  generateDeterministicTourCaptureIdForUpload(uploadId: string): string {
    return this.mintDeterministicV4Id(P.TOUR_CAPTURE, `upload:${uploadId}`);
  }
}
