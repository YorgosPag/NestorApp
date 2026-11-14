/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΦΟΡΜΑΣ ΤΩΝ ΑΔΕΙΩΝ** — ανά άδεια του λεξιλογίου: «δεν την έχει» ή «την έχει, με αυτά τα
 * στοιχεία» (ADR-915 §21 · §40.5).
 * @related components/mandate/ShowcaseLicenceField.tsx (το πεδίο) · lib/agency/showcase-licence.ts (η βιτρίνα) ·
 *   lib/contacts/contact-licences.ts (η επαφή)
 * @module lib/professional/licence-drafts
 *
 * 🔑 **Μία κατάσταση φόρμας για βιτρίνα ΚΑΙ επαφή** — εξήχθη από το πεδίο ώστε να τη ζητούν καθαρά modules χωρίς να
 *    εισάγουν component. Καθαρό leaf: μόνο το λεξιλόγιο και τύποι.
 */

import {
  PROFESSIONAL_LICENCES,
  PROFESSIONAL_LICENCE_SPECS,
  type ProfessionalLicence,
} from '@/config/professional-licences';
import { isChapteredRegistry } from '@/constants/professional-registries';
import type { ShowcaseLicenceWire } from '@/lib/agency/showcase-wire';
import type { RegulatedAttestation } from '@/types/agency-profile';

/** Μία δηλωμένη άδεια στη φόρμα — ο αριθμός και (σε αρχή με παραρτήματα) ο εκδότης, ίσως ακόμη κενά. */
export interface LicenceDraft {
  readonly number: string;
  readonly chapter: string;
}

/** Ανά άδεια: `null` = δεν την έχει · draft = την έχει, με αυτά τα στοιχεία. */
export type LicenceDrafts = Readonly<Record<ProfessionalLicence, LicenceDraft | null>>;

/** `Record` ολικός ⇒ νέα άδεια χωρίς γραμμή εδώ = σφάλμα μεταγλώττισης, όχι σιωπηλή απουσία από τη φόρμα. */
export const NO_LICENCE_DRAFTS: LicenceDrafts = { 'energy-inspector': null, 'electrical-installer': null };

/** Ό,τι κρατά μια αποθηκευμένη άδεια (βιτρίνας ή επαφής) — αρκεί για τη φόρμα. */
interface HeldLicence {
  readonly licence: ProfessionalLicence;
  readonly attestation: RegulatedAttestation;
}

/** Από τις αποθηκευμένες άδειες στη φόρμα. */
export function licenceDraftsOf(licences: readonly HeldLicence[]): LicenceDrafts {
  const drafts: Record<ProfessionalLicence, LicenceDraft | null> = { ...NO_LICENCE_DRAFTS };
  for (const { licence, attestation } of licences) {
    const { registration } = attestation;
    drafts[licence] = {
      number: registration.number,
      chapter: registration.authorityKind === 'chapter' ? registration.chapter : '',
    };
  }
  return drafts;
}

/**
 * Από τη φόρμα στη δήλωση — μόνο όσες δηλώνει· ο εκδότης **μόνο** όπου η αρχή τον έχει. Τα κενά φτάνουν στον σχηματισμό
 * (`formShowcaseLicences`), που αρνείται **ονομαστικά**. Άδεια που δίνει ήδη η ειδικότητα **δεν** δηλώνεται: μια παλιά
 * ρητή δήλωση της ίδιας άδειας **ενοποιείται** με την αποθήκευση — αλλιώς ο γραφέας της βιτρίνας θα αρνιόταν για πάντα.
 */
export function licenceWireOf(drafts: LicenceDrafts, heldThrough: readonly HeldLicence[]): ShowcaseLicenceWire[] {
  return PROFESSIONAL_LICENCES.flatMap((licence) => {
    const draft = drafts[licence];
    if (draft === null || heldThrough.some((held) => held.licence === licence)) return [];
    const chaptered = isChapteredRegistry(PROFESSIONAL_LICENCE_SPECS[licence].authority);
    return [
      chaptered
        ? { licence, registrationNumber: draft.number, registrationChapter: draft.chapter }
        : { licence, registrationNumber: draft.number },
    ];
  });
}
