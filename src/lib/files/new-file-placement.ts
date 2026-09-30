/**
 * 🌍 **ΣΕ ΠΟΙΑ ΘΕΣΗ ΓΕΝΝΙΕΤΑΙ ΕΝΑ ΝΕΟ ΑΡΧΕΙΟ** — ADR-895 §4 (πολιτική) · Φ3
 *
 * Ο **ΕΝΑΣ** κριτής της πολιτικής. Τον καλεί **μόνο** ο συγγραφέας της εγγραφής, **τη στιγμή της γέννησης**, και η απάντηση
 * γράφεται στο `FileRecord.storagePlacement` — την **αλήθεια** (`file-storage-placement.ts`). Από εκεί και πέρα κανείς δεν
 * ξαναρωτά την πολιτική: μια αλλαγή της **δεν** ερμηνεύει ποτέ ξανά παλιά αρχεία (αυτό είναι δουλειά της μετάβασης, Α9).
 *
 * 🔑 **Πανόραμα: η θέση ακολουθεί την καραντίνα**, δηλαδή την περιήγηση όπως τη δέσμευσε το υπογεγραμμένο εισιτήριο.
 * Περιήγηση `tour-eu` ⇒ τα bytes είναι ήδη στην ΕΕ ⇒ `eu-originals` (αντιγραφή εντός περιοχής). Περιήγηση `legacy-default`
 * ⇒ τα bytes και τα πλακίδια της ζουν στον κανονικό κάδο ⇒ `legacy-default`. Ποτέ «ΕΕ για όλα»: θα περνούσαν bytes από τις
 * ΗΠΑ πριν φτάσουν στην ΕΕ και τα παράγωγά τους θα έμεναν εκεί — ψεύτικη τοποθεσία. Μονάδα τοποθεσίας = ο **περιέκτης**
 * (Autodesk ACC ανά hub, Atlassian pinning)· η περιήγηση περνά στην ΕΕ **ολόκληρη** (Φ4).
 *
 * ⏳ Φ5: νέα μέλη στο {@link NewFileContext} (ανέβασμα αρχείων) — **εδώ**, ποτέ δεύτερη πολιτική.
 *
 * @module lib/files/new-file-placement
 */

import type { TourMediaPlacement } from '@/constants/spatial-tour-vocabulary';

import type { FileStoragePlacement } from './file-storage-placement';

/** Η περίσταση γέννησης ενός αρχείου — ό,τι χρειάζεται η πολιτική, τίποτα παραπάνω. */
export type NewFileContext = {
  readonly kind: 'tour-capture';
  /** Ο κάδος της καραντίνας, όπως τον **δέσμευσε** το εισιτήριο — εκεί είναι ήδη τα bytes. */
  readonly ingestPlacement: TourMediaPlacement;
};

/** Κάθε θέση μέσων περιήγησης έχει **δηλωμένη** απάντηση — νέα θέση χωρίς γραμμή εδώ δεν μεταγλωττίζεται. */
const TOUR_INGEST_TO_FILE_PLACEMENT: Readonly<Record<TourMediaPlacement, FileStoragePlacement>> = {
  'legacy-default': 'legacy-default',
  'tour-eu': 'eu-originals',
};

/** **Η θέση ενός νέου αρχείου.** */
export function placementForNewFile(context: NewFileContext): FileStoragePlacement {
  switch (context.kind) {
    case 'tour-capture':
      return TOUR_INGEST_TO_FILE_PLACEMENT[context.ingestPlacement];
  }
}
