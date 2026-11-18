/**
 * =============================================================================
 * Μητρώο λήξεων — το ΠΡΟΣΟΝ μιας προσφοράς από ΒΙΤΡΙΝΑ του `/pro` (ADR-945 §7.1 Δ4 · §7.5)
 * =============================================================================
 *
 * **«Με ποιο προσόν υπογράφει αυτή η βιτρίνα αυτό το έγγραφο;»** Το ΠΕΑ το υπογράφει **πρόσωπο με άδεια**, άρα το
 * προσόν της προσφοράς **παράγεται** από ό,τι η βιτρίνα δήλωσε δημόσια — ποτέ από το αίτημα του ιδιώτη.
 *
 * 🔑 **Ο ΙΔΙΟΣ κριτής με τον κατάλογο** (`showcaseHasQualification`, φίλτρο `document:<είδος>` του `/pro`): ό,τι ο
 *    κατάλογος δείχνει ως «μπορεί να εκδώσει» είναι **ακριβώς** ό,τι δέχεται η πρόσκληση — ποτέ κάρτα που υπόσχεται κάτι
 *    που η πράξη αρνείται.
 * 🔑 **Σειρά = σειρά του εκδότη** στον κατάλογο ειδών (`documentKindSpec`): η πρώτη απάντηση είναι η ίδια κάθε φορά.
 * 🔑 Ο αριθμός μητρώου είναι **της απόδειξης που κάλυψε το προσόν** — η άδεια (ρητή ή μέσω ειδικότητας, §34 Λ3) ή η
 *    ειδικότητα· ειδικότητα χωρίς δηλωμένη εγγραφή ⇒ `null` (δηλωμένο, όχι μαντεψιά).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 *
 * @module lib/document-validity/issuance-showcase-credential
 */

import { ISSUER_QUALIFICATION_SPECS, type IssuerQualification } from '@/config/document-validity/document-issuers';
import { documentKindSpec, type DocumentKind } from '@/config/document-validity/document-validity';
import { showcaseHasQualification } from '@/lib/agency/occupation-query';
import { licencesHeldThroughCredentials } from '@/lib/agency/showcase-licence';
import type { ProfessionalAttestation } from '@/types/professional-identity';
import type { PublicShowcase } from '@/types/agency-profile';
import type { IssuanceCredential } from './issuance-assignment';

function registryNumberOf(attestation: ProfessionalAttestation): string | null {
  return attestation.state === 'unknown' ? null : attestation.registration.number;
}

/** Ο αριθμός μητρώου της απόδειξης που καλύπτει **αυτό** το προσόν στη βιτρίνα. */
function qualificationRegistryNumber(showcase: PublicShowcase, qualification: IssuerQualification): string | null {
  const spec = ISSUER_QUALIFICATION_SPECS[qualification];
  if (spec.kind === 'licence') {
    const held = showcase.licences.find((licence) => licence.licence === spec.licence)
      ?? licencesHeldThroughCredentials(showcase.credentials).find((licence) => licence.licence === spec.licence);
    return held === undefined ? null : registryNumberOf(held.attestation);
  }
  const credential = showcase.credentials.find(({ occupation }) => spec.escoUris.includes(occupation.escoUri));
  return credential === undefined ? null : registryNumberOf(credential.attestation);
}

/**
 * Το προσόν της βιτρίνας για αυτό το είδος — `null` = η βιτρίνα **δεν** μπορεί να το εκδώσει (ή το είδος το εκδίδει
 * αρχή, όχι επαγγελματίας). Το επιστρεφόμενο προσόν περνά πάντα το `qualifiesFor` του μειωτή.
 */
export function showcaseIssuanceCredential(showcase: PublicShowcase, kind: DocumentKind): IssuanceCredential | null {
  const { issuer } = documentKindSpec(kind);
  if (issuer.kind !== 'professional') return null;
  const qualification = issuer.qualifications.find((candidate) => showcaseHasQualification(showcase, candidate));
  return qualification === undefined ? null : { qualification, registryNumber: qualificationRegistryNumber(showcase, qualification) };
}
