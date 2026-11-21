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
 *
 * 🔑 **Κάθε ενότητα λέει και την ΚΑΤΑΣΤΑΣΗ της** (`status`, ADR-946 · λίστα ενοτήτων με σύνοψη): τι έχει απαντηθεί και
 * αν ζητά προσοχή — καθαρή συνάρτηση πάνω στα δεδομένα που η σελίδα **ήδη** κρατά, κανένα νέο fetch. Ολικό `Record`
 * ⇒ νέα ενότητα χωρίς κατάσταση δεν μεταγλωττίζεται. Τη λέξη τη βάζει το `improve-section-entries.ts`.
 */

import { createElement, type ReactElement } from 'react';

import type { EnergyClass } from '@/constants/energy-classes';
import { readCommonCharges } from '@/lib/common-charges/common-charges';
import type { CommonChargesImproveSubject } from '@/lib/common-charges/common-charges-improve-subject';
import { readEnergyCertificate, type EnergyCertificateAbsence } from '@/lib/energy-certificate/energy-certificate';
import type { EnergyCertificateImproveSubject } from '@/lib/energy-certificate/energy-certificate-improve-subject';
import { isLandProperty } from '@/constants/property-classification';
import type { ObjectiveValueBounds } from '@/lib/objective-value/objective-value-bounds';
import { objectiveValueFormOf } from '@/lib/objective-value/objective-value-form-of-type';
import { offersObjectiveValue } from '@/lib/objective-value/objective-value-offer-kinds';
import type { ObjectiveValueImproveSubject } from '@/lib/objective-value/objective-value-improve-subject';
import type { TerrainImproveSubject } from '@/lib/terrain/publication/terrain-improve-subject';
import type { PublicListingLookup } from '@/services/realtime/hooks/usePublicListings';
import type { PublicListing } from '@/types/public-listing';

import { CommonChargesImproveSection } from './CommonChargesImproveSection';
import { EnergyCertificateImproveSection } from './EnergyCertificateImproveSection';
import { ObjectiveValueImproveSectionView } from './ObjectiveValueImproveSection';
import { publishedTerrainOf, TerrainImproveSection } from './TerrainImproveSection';
import type { ObjectiveValueImproveState } from './useObjectiveValueImprove';

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
 * **Ό,τι κρατά η σελίδα, μία φορά**, για όλες τις ενότητες: οι κάτοχοι · η κατάσταση της αντικειμενικής (την
 * μοιράζονται ενότητα, λίστα και πλαϊνό) · η ζωντανή δημόσια αγγελία (το τοπογραφικό που δημοσιεύεται τώρα).
 */
export interface ImproveContext {
  readonly subjects: ImproveSubjects;
  readonly objectiveValue: ObjectiveValueImproveState;
  readonly publicListing: PublicListingLookup;
}

/** Η κατάσταση μιας ενότητας — δεδομένα, όχι λέξεις (τις βάζει το `improve-section-entries.ts`). */
export type ImproveSectionStatus =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'commonCharges'; readonly monthlyAmount: number | null }
  | { readonly kind: 'energyCertificate'; readonly energyClass: EnergyClass | null; readonly absence: EnergyCertificateAbsence | null }
  | { readonly kind: 'terrain'; readonly published: boolean }
  | { readonly kind: 'objectiveValue'; readonly bounds: ObjectiveValueBounds; readonly openQuestions: number };

/**
 * Ο τίτλος κάθε ενότητας ζει στο `objective-value:improve.sections.<id>.title` — κλειδί από το **αναγνωριστικό**, όχι
 * πεδίο εδώ: ο γεννήτορας του slice λύνει το template ως πρόθεμα, ενώ κλειδί μέσα σε πίνακα θα έμενε ανεπίλυτο.
 */
export interface ImproveSectionDefinition {
  /** Έχει νόημα η ενότητα για ΑΥΤΗ την αγγελία; (κρίνεται πάνω στη δημόσια προβολή — ό,τι βλέπει ο αγοραστής) */
  readonly isApplicable: (listing: PublicListing) => boolean;
  /** Η ενότητα, δεμένη στον **δικό της** κάτοχο από τη δέσμη. */
  readonly render: (context: ImproveContext) => ReactElement;
  /** Τι έχει απαντηθεί — για τη λίστα ενοτήτων. */
  readonly status: (context: ImproveContext) => ImproveSectionStatus;
}

/** Η αντικειμενική: ποσό ή εύρος μόλις απαντήσει η μηχανή· «δεν υπολογίζεται» όταν η θέση ή το είδος δεν το επιτρέπουν. */
function objectiveValueStatus({ zone }: ObjectiveValueImproveState): ImproveSectionStatus {
  if (zone.kind === 'idle' || zone.kind === 'loading') return { kind: 'loading' };
  if (zone.kind === 'failed' || zone.improvement.kind !== 'ready') return { kind: 'unavailable' };
  const { bounds, questions } = zone.improvement;
  // Μόνο όσες μένουν: η λίστα της μηχανής κρατά ΚΑΙ τις απαντημένες («Τι ξέρει ήδη ο υπολογισμός») — ίδιο κριτήριο με
  // την ενότητα (`ObjectiveValueImproveQuestions`), αλλιώς η λίστα λέει «5» εκεί που η ενότητα λέει «καμία».
  const openQuestions = questions.filter((question) => question.state === 'open').length;
  return { kind: 'objectiveValue', bounds, openQuestions };
}

export const IMPROVE_SECTIONS: Readonly<Record<ImproveSectionId, ImproveSectionDefinition>> = {
  commonCharges: {
    // Το «τίθεται η ερώτηση;» το έχει ήδη κρίνει η προβολή, με τον ΕΝΑΝ κριτή: κουτί `null` ⇒ καμία ενότητα.
    isApplicable: (listing) => listing.commonCharges !== null,
    render: ({ subjects }) => createElement(CommonChargesImproveSection, { subject: subjects.commonCharges }),
    // Ο ΙΔΙΟΣ αναγνώστης με την ενότητα και τον server (η αισιόδοξη επικάλυψη φαίνεται μόλις επιβεβαιωθεί).
    status: ({ subjects }) => ({
      kind: 'commonCharges',
      monthlyAmount: readCommonCharges(subjects.commonCharges.charges).monthlyAmount,
    }),
  },
  energyCertificate: {
    // ADR-777 §8.94 — ίδιο σχήμα: το «σηκώνει η διάθεση ΠΕΑ;» το έκρινε η προβολή (`LEGALITY_OFFER_MATRIX`, όχι γη).
    isApplicable: (listing) => listing.energyCertificate !== null,
    render: ({ subjects }) => createElement(EnergyCertificateImproveSection, { subject: subjects.energyCertificate }),
    status: ({ subjects }) => {
      const certificate = readEnergyCertificate(subjects.energyCertificate.certificate);
      return { kind: 'energyCertificate', energyClass: certificate.class, absence: certificate.absence };
    },
  },
  terrain: {
    // ADR-920 Β4.9 — Δ1: ανάγλυφο μόνο σε γη (οικόπεδο · αγροτεμάχιο), ο ΕΝΑΣ κριτής του τύπου. Μετά το ΠΕΑ (που η γη
    // δεν έχει) και πριν την αντικειμενική: για οικόπεδο, το έδαφος είναι το πιο ουσιώδες που λείπει από την αγγελία.
    isApplicable: (listing) => isLandProperty(listing.type),
    render: ({ subjects, publicListing }) =>
      createElement(TerrainImproveSection, { subject: subjects.terrain, lookup: publicListing }),
    status: ({ publicListing }) =>
      publicListing.state === 'loading'
        ? { kind: 'loading' }
        : { kind: 'terrain', published: publishedTerrainOf(publicListing) !== null },
  },
  objectiveValue: {
    // Ποια είδη αποτιμώνται το λέει ο ΕΝΑΣ πίνακας εντύπων· σε ποια διάθεση φαίνεται, ο ΕΝΑΣ πίνακας διαθέσεων
    // (ADR-898 §23: μόνο πώληση). Η ενότητα ρωτά για ό,τι θα δει ο αγοραστής — σε μίσθωση δεν βλέπει τίποτα.
    isApplicable: (listing) => objectiveValueFormOf(listing.type) !== null && offersObjectiveValue(listing.offerKinds),
    // `preview: false` — η προεπισκόπηση αγοραστή ζει στο πλαϊνό της σελίδας (ένα αντίτυπο, ADR-946).
    render: ({ subjects, objectiveValue }) =>
      createElement(ObjectiveValueImproveSectionView, { subject: subjects.objectiveValue, state: objectiveValue, preview: false }),
    status: ({ objectiveValue }) => objectiveValueStatus(objectiveValue),
  },
};

/** Οι ενότητες που έχουν νόημα για την αγγελία, με τη σειρά της λίστας. */
export function applicableImproveSections(listing: PublicListing): readonly ImproveSectionId[] {
  return IMPROVE_SECTION_IDS.filter((id) => IMPROVE_SECTIONS[id].isApplicable(listing));
}
