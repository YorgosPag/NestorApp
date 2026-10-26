/**
 * @fileoverview **Ο καταχωρητής ενοτήτων της οθόνης «Βελτίωσε την αγγελία σου»** (ADR-842 Φ4 · ADR-898 Φ3β-2).
 * @related `OwnerListingImproveContent.tsx` (ο αναγνώστης) · ADR-842 §5 (οι οικογένειες χαρακτηριστικών που έρχονται)
 * @module components/owner-property/improve/improve-sections
 *
 * 🔑 **Καταχωρητής, όχι μονοκόμματη φόρμα** (απόφαση Giorgio): **τέσσερις** ενότητες σήμερα — τα κοινόχρηστα (ADR-777
 * §8.93), το ενεργειακό πιστοποιητικό (§8.94), το τοπογραφικό (ADR-920 Β4.9, μόνο γη) και η αντικειμενική. Οι υπόλοιπες οικογένειες του ADR-842 (κατάσταση ·
 * δωμάτια/εμβαδά · συστήματα · παροχές)
 * μπαίνουν ως **μία γραμμή + ένα component**, χωρίς να αγγίξουν τη σελίδα ή τις άλλες ενότητες. Ο πίνακας είναι
 * **ολικός** (`Record`): νέο αναγνωριστικό στη λίστα ⇒ ο μεταγλωττιστής ζητά την ενότητα.
 *
 * 🔑 **Κάθε ενότητα έχει ΔΙΚΟ της κάτοχο** ({@link ImproveSubjects}): ως τη δεύτερη ενότητα ο τύπος ήταν ο κάτοχος της
 * αντικειμενικής, δηλαδή ο καταχωρητής ήξερε ένα μόνο είδος γραφής. Η δέσμη φτιάχνεται **μία** φορά, στη σελίδα.
 *
 * ⚠️ **Στατικές εισαγωγές, επίτηδες.** Το slice i18n της διαδρομής βγαίνει από τη **στατική** κλειστότητα εισαγωγών·
 * ένα `next/dynamic` εδώ θα έβγαζε τις ερωτήσεις από το slice και θα ζωγράφιζε ωμά κλειδιά ώσπου να φορτώσει ο
 * χώρος ονομάτων (ADR-744 §18). Όταν μια ενότητα γίνει βαριά, το όριο μπαίνει **μέσα** της, όχι εδώ.
 */

import { createElement, type ReactElement } from 'react';

import type { CommonChargesImproveSubject } from '@/lib/common-charges/common-charges-improve-subject';
import type { EnergyCertificateImproveSubject } from '@/lib/energy-certificate/energy-certificate-improve-subject';
import { isLandProperty } from '@/constants/property-classification';
import { objectiveValueFormOf } from '@/lib/objective-value/objective-value-form-of-type';
import type { ObjectiveValueImproveSubject } from '@/lib/objective-value/objective-value-improve-subject';
import type { TerrainImproveSubject } from '@/lib/terrain/publication/terrain-improve-subject';
import type { PublicListing } from '@/types/public-listing';

import { CommonChargesImproveSection } from './CommonChargesImproveSection';
import { EnergyCertificateImproveSection } from './EnergyCertificateImproveSection';
import { ObjectiveValueImproveSection } from './ObjectiveValueImproveSection';
import { TerrainImproveSection } from './TerrainImproveSection';

/** Η σειρά της λίστας = η σειρά στην οθόνη. Τα κοινόχρηστα πρώτα: μία απάντηση, και φαίνεται δίπλα στην τιμή. */
export const IMPROVE_SECTION_IDS = ['commonCharges', 'energyCertificate', 'terrain', 'objectiveValue'] as const;
export type ImproveSectionId = (typeof IMPROVE_SECTION_IDS)[number];

/** Ο κάτοχος κάθε ενότητας (ιδιώτης ή γραφείο) — καμία ενότητα δεν ξέρει ποιο έγγραφο είναι. */
export interface ImproveSubjects {
  readonly commonCharges: CommonChargesImproveSubject;
  readonly energyCertificate: EnergyCertificateImproveSubject;
  readonly objectiveValue: ObjectiveValueImproveSubject;
  readonly terrain: TerrainImproveSubject;
}

/**
 * Ο τίτλος κάθε ενότητας ζει στο `objective-value:improve.sections.<id>.title` — κλειδί από το **αναγνωριστικό**, όχι
 * πεδίο εδώ: ο γεννήτορας του slice λύνει το template ως πρόθεμα, ενώ κλειδί μέσα σε πίνακα θα έμενε ανεπίλυτο.
 */
export interface ImproveSectionDefinition {
  /** Έχει νόημα η ενότητα για ΑΥΤΗ την αγγελία; (κρίνεται πάνω στη δημόσια προβολή — ό,τι βλέπει ο αγοραστής) */
  readonly isApplicable: (listing: PublicListing) => boolean;
  /** Η ενότητα, δεμένη στον **δικό της** κάτοχο από τη δέσμη. */
  readonly render: (subjects: ImproveSubjects) => ReactElement;
}

export const IMPROVE_SECTIONS: Readonly<Record<ImproveSectionId, ImproveSectionDefinition>> = {
  commonCharges: {
    // Το «τίθεται η ερώτηση;» το έχει ήδη κρίνει η προβολή, με τον ΕΝΑΝ κριτή: κουτί `null` ⇒ καμία ενότητα.
    isApplicable: (listing) => listing.commonCharges !== null,
    render: (subjects) => createElement(CommonChargesImproveSection, { subject: subjects.commonCharges }),
  },
  energyCertificate: {
    // ADR-777 §8.94 — ίδιο σχήμα: το «σηκώνει η διάθεση ΠΕΑ;» το έκρινε η προβολή (`LEGALITY_OFFER_MATRIX`, όχι γη).
    isApplicable: (listing) => listing.energyCertificate !== null,
    render: (subjects) => createElement(EnergyCertificateImproveSection, { subject: subjects.energyCertificate }),
  },
  terrain: {
    // ADR-920 Β4.9 — Δ1: ανάγλυφο μόνο σε γη (οικόπεδο · αγροτεμάχιο), ο ΕΝΑΣ κριτής του τύπου. Μετά το ΠΕΑ (που η γη
    // δεν έχει) και πριν την αντικειμενική: για οικόπεδο, το έδαφος είναι το πιο ουσιώδες που λείπει από την αγγελία.
    isApplicable: (listing) => isLandProperty(listing.type),
    render: (subjects) => createElement(TerrainImproveSection, { subject: subjects.terrain }),
  },
  objectiveValue: {
    // Ποια είδη αποτιμώνται το λέει ο ΕΝΑΣ πίνακας εντύπων — καμία δεύτερη λίστα ειδών εδώ.
    isApplicable: (listing) => objectiveValueFormOf(listing.type) !== null,
    render: (subjects) => createElement(ObjectiveValueImproveSection, { subject: subjects.objectiveValue }),
  },
};

/** Οι ενότητες που έχουν νόημα για την αγγελία, με τη σειρά της λίστας. */
export function applicableImproveSections(listing: PublicListing): readonly ImproveSectionId[] {
  return IMPROVE_SECTION_IDS.filter((id) => IMPROVE_SECTIONS[id].isApplicable(listing));
}
