'use client';

/**
 * ADR-782 §24 — η **μοναδική** πόρτα Firestore για τη χειροκίνητη τοποθέτηση υποβάθρου.
 *
 * Διαβάζει και γράφει **ένα** πεδίο του `projects/{id}`: το `basemapPlacement`. Δίδυμο του
 * `geo-referencing/geo-reference-persistence.ts` — μία εφάπαξ ανάγνωση ανά αλλαγή έργου, εγγραφή
 * μέσω της **μίας** πύλης μεταβολών έργου (`updateProjectWithPolicy`, ADR-742).
 *
 * ## 🔴 Η κόκκινη γραμμή, ξανά — εδώ ως **σύνολο πεδίων**
 * Αυτό το module αγγίζει **αποκλειστικά** το `basemapPlacement`. Δεν εισάγει, δεν διαβάζει και
 * δεν γράφει `basePoint` / `northRotation` / `surveyPoint`: η χειροκίνητη τοποθέτηση **ΠΟΤΕ** δεν
 * γίνεται επίσημη γεωαναφορά (απόφαση Giorgio 2026-08-10, ADR-782 §23.1). Η προστασία είναι το
 * ίδιο το `updates` που φεύγει — άγκυρα που διαβάζει το **πραγματικό** patch, όχι σχόλιο.
 *
 * ⚠️ Το `getDoc` σε **συγκεκριμένο** έγγραφο δεν είναι `query()`: δεν χρειάζεται (ούτε δέχεται)
 * φίλτρο `companyId` — την απομόνωση μισθωτή την επιβάλλουν οι κανόνες Firestore πάνω στο ίδιο το
 * έγγραφο (`firestore.rules` `match /projects/{projectId}`). Ίδιο σχήμα με τα δύο αδέλφια module.
 *
 * @see ./basemap-placement-schema.ts — η μετατροπή μέτρα ⇄ mm (καθαρή)
 * @see ../../app/BasemapPlacementHost.tsx — ο κύκλος ζωής (υδάτωση + σύνδεση γραφέα)
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { updateProjectWithPolicy } from '@/services/projects/project-mutation-gateway';
import {
  basemapPlacementFromProject,
  basemapPlacementToProject,
  type ProjectBasemapPlacementFields,
} from './basemap-placement-schema';
import type { GeoReference } from '../geo-referencing/geo-transform';

/**
 * Εφάπαξ ανάγνωση της αποθηκευμένης τοποθέτησης.
 *
 * @returns Το runtime {@link GeoReference} (mm), ή `null` όταν το έγγραφο λείπει, δεν δηλώνει
 *          τοποθέτηση, ή τη δηλώνει με τιμές που δεν είναι θέση.
 */
export async function loadProjectBasemapPlacement(
  projectId: string,
): Promise<GeoReference | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
  if (!snap.exists()) return null;
  return basemapPlacementFromProject(snap.data() as ProjectBasemapPlacementFields);
}

/**
 * Γράφει (ή σβήνει) την τοποθέτηση.
 *
 * `null` = «ο χρήστης πάτησε επαναφορά»: το πεδίο μηδενίζεται ρητά αντί να μείνει η παλιά τιμή.
 * Χωρίς αυτό, η επαναφορά θα φαινόταν να δουλεύει μέχρι την επόμενη ανανέωση σελίδας — δηλαδή θα
 * ήταν **χειρότερη** από το να μην υπάρχει καθόλου.
 */
export async function persistProjectBasemapPlacement(
  projectId: string,
  geo: GeoReference | null,
): Promise<void> {
  await updateProjectWithPolicy({
    projectId,
    updates: { basemapPlacement: geo === null ? null : basemapPlacementToProject(geo) },
  });
}
