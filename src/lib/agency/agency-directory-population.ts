/**
 * @fileoverview **ΠΟΙΟΙ ΜΠΑΙΝΟΥΝ ΣΤΟΝ ΚΑΤΑΛΟΓΟ** — από τα έγγραφα της συλλογής στον πληθυσμό (ADR-841 §7 Α23 Φ3.3).
 * @related services/realtime/hooks/usePublicAgencies.ts (ο μόνος καλών) · lib/agency/showcase-registry-closure.ts (ο κριτής)
 * @module lib/agency/agency-directory-population
 *
 * 🔴 **ΓΙΑΤΙ ΒΓΗΚΕ ΑΠΟ ΤΟ HOOK, ΜΕΤΡΗΜΕΝΟ**: μέσα στο `onSnapshot` το φίλτρο της κλειστής ελεγχόταν **μόνο** με
 * προσομοίωση Firestore — και καμία άγκυρα δεν το έκανε: η μετάλλαξη «χωρίς φίλτρο» (M9 της Α23.1) **επέζησε**.
 * Ίδιο ιδίωμα με `capabilitiesStateOf` / `use-public-place`: ο χειριστής του στιγμιότυπου είναι **μία κλήση χωρίς
 * λογική**, και η λογική ελέγχεται ολόκληρη ως καθαρή συνάρτηση.
 *
 * **Layering**: leaf — καθαρό, χωρίς SDK.
 */

import { readShowcase } from '@/lib/agency/showcase-read';
import { isListedInDirectory } from '@/lib/agency/showcase-registry-closure';
import type { PublicShowcase } from '@/types/agency-profile';

/** Το ελάχιστο ενός εγγράφου συλλογής — ό,τι δίνει το `QueryDocumentSnapshot`, χωρίς να εισάγεται το SDK. */
export interface DirectoryDocument {
  readonly id: string;
  data(): unknown;
}

export interface DirectoryPopulation {
  /** Αναγνώσιμες **και** ενεργές στο ΓΕΜΗ — αταξινόμητες (τη σειρά την κρίνει ο καλών). */
  readonly listed: readonly PublicShowcase[];
  /** Έγγραφα χωρίς αναγνώσιμη απόδειξη (Φ6-Β) — ο καλών τα **καταγράφει**, ποτέ σιωπηλά. */
  readonly unreadableCompanyIds: readonly string[];
}

/**
 * Κλειστή στο ΓΕΜΗ ⇒ **εκτός** πληθυσμού (κατάλογος **και** αρχική αναζήτηση), **χωρίς** να είναι «μη αναγνώσιμη»:
 * δεν είναι βλάβη, είναι γεγονός του μητρώου — ο `usePublicAgency` τη βρίσκει με την ετικέτα της.
 */
export function directoryPopulationOf(documents: readonly DirectoryDocument[]): DirectoryPopulation {
  const listed: PublicShowcase[] = [];
  const unreadableCompanyIds: string[] = [];
  for (const document of documents) {
    const read = readShowcase(document.data(), document.id);
    if (read.outcome !== 'showcase') unreadableCompanyIds.push(read.companyId);
    else if (isListedInDirectory(read.showcase)) listed.push(read.showcase);
  }
  return { listed, unreadableCompanyIds };
}
