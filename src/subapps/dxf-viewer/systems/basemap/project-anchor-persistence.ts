'use client';

/**
 * ADR-782 §21 — η **μοναδική** ανάγνωση Firestore για την κατά προσέγγιση θέση του έργου.
 *
 * Διαβάζει **μόνο** τις δηλωμένες διευθύνσεις του `projects/{id}` (ADR-186 πολλαπλές διευθύνσεις).
 * Μία εφάπαξ ανάγνωση ανά αλλαγή έργου, όπως ο δίδυμος `geo-reference-persistence` — καμία
 * εγγραφή, ποτέ: αυτό το υποσύστημα **διαβάζει** τη δηλωμένη διεύθυνση και δεν έχει καμία δουλειά
 * να τη μεταβάλλει.
 *
 * ⚠️ **Γιατί επιστρέφει τις διευθύνσεις και όχι έτοιμη άγκυρα**: η κρίση «είναι αυτή η θέση
 * αρκετά καλή;» είναι **καθαρή** και ζει στο `project-anchor-resolution`, όπου ελέγχεται με unit
 * tests χωρίς Firestore. Ένα module που διάβαζε **και** έκρινε θα έκανε την κρίση δοκιμάσιμη μόνο
 * μέσα από ψεύτικη βάση δεδομένων — δηλαδή θα δοκιμαζόταν σπανιότερα και χειρότερα.
 *
 * ⚠️ Το `getDoc` σε **συγκεκριμένο** έγγραφο δεν είναι `query()`: δεν χρειάζεται (ούτε δέχεται)
 * φίλτρο `companyId` — η απομόνωση μισθωτή επιβάλλεται από τους κανόνες Firestore στο ίδιο το
 * έγγραφο. Ίδιο σχήμα με το `geo-reference-persistence` και το `OpeningTagStyleHost`.
 *
 * @see ./project-anchor-resolution.ts — η κρίση (καθαρή)
 * @see ../../app/ProjectAnchorHost.tsx — ο κύκλος ζωής
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { ProjectAddress } from '@/types/project/addresses';

interface ProjectAddressDoc {
  readonly addresses?: ProjectAddress[];
}

/**
 * Εφάπαξ ανάγνωση των δηλωμένων διευθύνσεων του έργου.
 *
 * @returns Ο πίνακας διευθύνσεων, ή `undefined` όταν το έγγραφο λείπει ή δεν δηλώνει καμία.
 */
export async function loadProjectAddresses(
  projectId: string,
): Promise<readonly ProjectAddress[] | undefined> {
  const snap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
  if (!snap.exists()) return undefined;
  return (snap.data() as ProjectAddressDoc).addresses;
}
