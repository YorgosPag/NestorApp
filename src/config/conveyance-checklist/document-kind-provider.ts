/**
 * Ο πάροχος μιας γραμμής που παρακολουθεί το μητρώο λήξεων **παράγεται** από τον κατάλογο ειδών (ADR-915 §18).
 *
 * 🔑 Ίδιο ιδίωμα με το `validity: documentKindSpec(kind).rule`: ό,τι ξέρει ο ΕΝΑΣ κατάλογος δεν ξαναγράφεται ανά γραμμή.
 * Πριν, το `provider` γραφόταν με το χέρι και ανακάτευε δύο ερωτήσεις (ΠΕΑ = «ποιος το εκδίδει», φορολογική = «ποιος το
 * φέρνει») χωρίς κανέναν να ελέγχει ότι συμφωνεί με τον κατάλογο.
 *
 * - εκδίδει **επαγγελματίας** ⇒ `engineer` (τον ορίζει ο ιδιοκτήτης· το φέρνει ο οικοδεσπότης — `PROVIDER_FULFILMENT`)
 * - εκδίδει **αρχή** με αυτοεξυπηρέτηση ⇒ ο υπόχρεος (`owner` ⇒ στη μεταβίβαση ο πωλητής)
 *
 * @module config/conveyance-checklist/document-kind-provider
 */

import type { DocumentObligor } from '@/config/document-validity/document-issuers';
import { documentKindSpec, type DocumentKind } from '@/config/document-validity/document-validity';
import type { ChecklistProvider } from '@/config/conveyance-checklist/types';

/** Ο υπόχρεος, στη γλώσσα της μεταβίβασης. `Record` ⇒ νέος υπόχρεος χωρίς αντιστοίχιση = σφάλμα μεταγλώττισης. */
const CONVEYANCE_PROVIDER_BY_OBLIGOR: Readonly<Record<DocumentObligor, ChecklistProvider>> = {
  owner: 'seller',
};

export function checklistProviderOfKind(kind: DocumentKind): ChecklistProvider {
  const spec = documentKindSpec(kind);
  return spec.issuer.kind === 'professional' ? 'engineer' : CONVEYANCE_PROVIDER_BY_OBLIGOR[spec.obligor];
}
