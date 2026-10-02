/**
 * @fileoverview **Ο καταχωρητής ενοτήτων της οθόνης «Βελτίωσε την αγγελία σου»** (ADR-842 Φ4 · ADR-898 Φ3β-2).
 * @related `OwnerListingImproveContent.tsx` (ο αναγνώστης) · ADR-842 §5 (οι οικογένειες χαρακτηριστικών που έρχονται)
 * @module components/owner-property/improve/improve-sections
 *
 * 🔑 **Καταχωρητής, όχι μονοκόμματη φόρμα** (απόφαση Giorgio): σήμερα **μία** ενότητα, η αντικειμενική. Οι οικογένειες
 * του ADR-842 (ενέργεια/κατάσταση · δωμάτια/εμβαδά · συστήματα · παροχές) μπαίνουν ως **μία γραμμή + ένα component**,
 * χωρίς να αγγίξουν τη σελίδα ή τις άλλες ενότητες. Ο πίνακας είναι **ολικός** (`Record`): νέο αναγνωριστικό στη
 * λίστα ⇒ ο μεταγλωττιστής ζητά την ενότητα.
 *
 * ⚠️ **Στατικές εισαγωγές, επίτηδες.** Το slice i18n της διαδρομής βγαίνει από τη **στατική** κλειστότητα εισαγωγών·
 * ένα `next/dynamic` εδώ θα έβγαζε τις ερωτήσεις από το slice και θα ζωγράφιζε ωμά κλειδιά ώσπου να φορτώσει ο
 * χώρος ονομάτων (ADR-744 §18). Όταν μια ενότητα γίνει βαριά, το όριο μπαίνει **μέσα** της, όχι εδώ.
 */

import type { ComponentType } from 'react';

import { objectiveValueFormOf } from '@/lib/objective-value/objective-value-form-of-type';
import type { ObjectiveValueImproveSubject } from '@/lib/objective-value/objective-value-improve-subject';
import type { PublicListing } from '@/types/public-listing';

import { ObjectiveValueImproveSection } from './ObjectiveValueImproveSection';

/** Η σειρά της λίστας = η σειρά στην οθόνη. */
export const IMPROVE_SECTION_IDS = ['objectiveValue'] as const;
export type ImproveSectionId = (typeof IMPROVE_SECTION_IDS)[number];

/** Ό,τι παίρνει κάθε ενότητα από τον κάτοχο (ιδιώτη ή γραφείο) — καμία ενότητα δεν ξέρει ποιο έγγραφο είναι. */
export interface ImproveSectionProps {
  readonly subject: ObjectiveValueImproveSubject;
}

/**
 * Ο τίτλος κάθε ενότητας ζει στο `objective-value:improve.sections.<id>.title` — κλειδί από το **αναγνωριστικό**, όχι
 * πεδίο εδώ: ο γεννήτορας του slice λύνει το template ως πρόθεμα, ενώ κλειδί μέσα σε πίνακα θα έμενε ανεπίλυτο.
 */
export interface ImproveSectionDefinition {
  /** Έχει νόημα η ενότητα για ΑΥΤΗ την αγγελία; (κρίνεται πάνω στη δημόσια προβολή — ό,τι βλέπει ο αγοραστής) */
  readonly isApplicable: (listing: PublicListing) => boolean;
  readonly Component: ComponentType<ImproveSectionProps>;
}

export const IMPROVE_SECTIONS: Readonly<Record<ImproveSectionId, ImproveSectionDefinition>> = {
  objectiveValue: {
    // Ποια είδη αποτιμώνται το λέει ο ΕΝΑΣ πίνακας εντύπων — καμία δεύτερη λίστα ειδών εδώ.
    isApplicable: (listing) => objectiveValueFormOf(listing.type) !== null,
    Component: ObjectiveValueImproveSection,
  },
};

/** Οι ενότητες που έχουν νόημα για την αγγελία, με τη σειρά της λίστας. */
export function applicableImproveSections(listing: PublicListing): readonly ImproveSectionId[] {
  return IMPROVE_SECTION_IDS.filter((id) => IMPROVE_SECTIONS[id].isApplicable(listing));
}
