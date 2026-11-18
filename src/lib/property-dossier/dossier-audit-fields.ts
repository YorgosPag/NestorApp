/**
 * @fileoverview ADR-916 Φ-Ε1 — τα **ονόματα πεδίων** του Ιστορικού του φακέλου για ό,τι αφορά την **πρόσβαση**, ανά ρόλο.
 * @module lib/property-dossier/dossier-audit-fields
 *
 * 🔑 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ — μετρημένο ζωντανά 2026-11-18.** Ο φάκελος ήταν ο μόνος από τους τρεις οικοδεσπότες συμμετοχής που
 *    **δεν** έγραφε στο δικό του Ιστορικό: αποδοχή · ανανέωση · εύρος · ανάκληση πήγαιναν στην οντότητα `engagement`
 *    (που καμία οθόνη δεν διαβάζει), τα ανοίγματα μόνο στο βιβλίο του αρχείου, και η πρόσκληση έβγαινε με ωμά κλειδιά
 *    (`invitation.owner_lawyer`). Ο αδελφός της έκδοσης (`ISSUANCE_AUDIT_FIELDS`) λύνει ακριβώς αυτό: **ένα όνομα πεδίου
 *    ανά είδος**, δηλωμένο σε κοινό module ώστε **γραφέας** (`dossier-access-audit.ts`) και **αναγνώστης**
 *    (`audit-direct-written-fields.ts` → namespaces λεξιλογίου) να διαβάζουν την ΙΔΙΑ δήλωση.
 *
 * 🔑 Ένα πεδίο **ανά ρόλο**: η ετικέτα λέει **ποιος** («Δικηγόρος — πρόσβαση»), όπως το «Ανάθεση έκδοσης ΠΕΑ — στάδιο».
 *    Το όνομα του προσώπου είναι ο δράστης της γραμμής (`performedByName`), ποτέ τιμή.
 *
 * **Layering**: leaf — μόνο δεδομένα, μηδέν I/O.
 */

import type { DossierEngagementRole } from '@/types/engagement';

/** Τα πεδία του Ιστορικού **ενός** ρόλου (ετικέτες στο `common-audit:audit.fields.*`). */
export interface DossierAccessAuditFields {
  /** Η πρόσκληση: `invited:<email>` · `resent:<email>` · `revoked` (κατάλογος `property-market:dossier.access.audit.invitation`). */
  readonly invitation: string;
  /** Η κατάσταση της πρόσβασης (κατάλογος `conveyance:engagement.states` — ο ΕΝΑΣ για κάθε συμμετοχή). */
  readonly access: string;
  /** Η λήξη της πρόσβασης (ISO· ο αναγνώστης τη μορφοποιεί ως ημερομηνία). */
  readonly accessUntil: string;
  /** Μία καρτέλα που μπαίνει (`— → καρτέλα`) ή βγαίνει (`καρτέλα → —`) από το εύρος. */
  readonly reachTab: string;
  /** Ένα αρχείο που εξαιρείται (`— → όνομα`) ή επανέρχεται (`όνομα → —`)· τιμή = `fileId`, λέξη = όνομα της στιγμής. */
  readonly excludedFile: string;
  /** Η ιδιότητα που δήλωσε στην αποδοχή (αριθμός μητρώου · σύλλογος). */
  readonly credential: string;
  /** Άνοιγμα (προβολή) αρχείου: `— → όνομα`, τιμή = `fileId`. */
  readonly documentView: string;
  /** Λήψη αρχείου: `— → όνομα`, τιμή = `fileId`. */
  readonly documentDownload: string;
}

/** Τα πεδία ενός ρόλου από το πρόθεμά του — ένας κανόνας ονοματοδοσίας, όχι δεκαέξι χειρόγραφα ονόματα. */
function dossierAccessFieldsOf(prefix: string): DossierAccessAuditFields {
  return {
    invitation: `${prefix}DossierInvitation`,
    access: `${prefix}DossierAccess`,
    accessUntil: `${prefix}DossierAccessUntil`,
    reachTab: `${prefix}DossierReachTab`,
    excludedFile: `${prefix}DossierExcludedFile`,
    credential: `${prefix}DossierCredential`,
    documentView: `${prefix}DossierDocumentView`,
    documentDownload: `${prefix}DossierDocumentDownload`,
  };
}

export const DOSSIER_ACCESS_AUDIT_FIELDS: Readonly<Record<DossierEngagementRole, DossierAccessAuditFields>> = {
  owner_lawyer: dossierAccessFieldsOf('ownerLawyer'),
  notary: dossierAccessFieldsOf('notary'),
};
