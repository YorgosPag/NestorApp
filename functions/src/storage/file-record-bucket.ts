/**
 * =============================================================================
 * FILE RECORD BUCKET — ο ΕΝΑΣ επιλογέας κάδου στα Cloud Functions (ADR-895 Α2 · Α7)
 * =============================================================================
 *
 * Ο server (`src/server/files/file-record-bucket.ts`) έχει τον δικό του επιλογέα· αυτό
 * εδώ είναι το **ίδιο** σχήμα στην πλευρά των Cloud Functions, που είναι χωριστό npm unit
 * και δεν μπορεί να εισάγει `src/` απευθείας. Η ΛΟΓΙΚΗ θέσης (`FILE_STORAGE_PLACEMENTS`,
 * `fileStoragePlacementOf`, `fileStorageBucketNameOf`) έρχεται εδώ με ΠΡΟΒΟΛΗ (ADR-874 ·
 * CHECK 3.93) από `src/lib/files/file-storage-placement.ts` — μηδέν χειρόγραφο αντίγραφο.
 * Μόνο τα ΟΝΟΜΑΤΑ κάδων χτίζονται εδώ, όπως ακριβώς χτίζονται στο `config/gcs-buckets.ts`.
 *
 * 🗑️ ADR-899 §2.2 (2026-10-31): ο επιλογέας κάδου **ανά εγγραφή** (`fileRecordBucket`) αφαιρέθηκε — οι δύο καταναλωτές
 * του (`scheduledFilePurge` · `onDeleteFloorplanBackground`) έσβηναν bytes αρχείου **παρακάμπτοντας** τον ΕΝΑ γραφέα purge
 * (χωρίς συνοδευτικά, χωρίς πλήρη κριτή δέσμευσης). Τα Functions **δεν** σβήνουν πια bytes `FileRecord`: παραδίδουν στην
 * ουρά του κάδου (`lib/files/file-trash-fields`). Εδώ μένουν μόνο τα ονόματα κάδων (σημάδι/σάρωση ορφανών, ADR-895 Α7).
 *
 * @module functions/storage/file-record-bucket
 * @enterprise ADR-895 Α2 + Α7 — ΕΝΑΣ επιλογέας, όχι N διάσπαρτες `admin.storage().bucket()`
 * @see ../../../src/lib/files/file-storage-placement.ts — η λογική θέσης (leaf, προβάλλεται)
 * @see ../../../src/server/files/file-record-bucket.ts — το αδελφάκι στον server
 */

import * as admin from 'firebase-admin';

import {
  FILES_EU_BUCKET_SUFFIX,
  type FileStorageBucketNames,
} from '../generated/lib/files/file-storage-placement';

/**
 * Project id — η ΙΔΙΑ πηγή που δίνει ο ίδιος ο Admin SDK bootstrap σε κάθε Cloud Function
 * (`admin.initializeApp()` χωρίς ορίσματα, `functions/src/index.ts`): το SDK γεμίζει το
 * `options.projectId` αυτόματα από το runtime environment. Το `GCLOUD_PROJECT` είναι το
 * ντετερμινιστικό fallback που θέτει το ίδιο το Cloud Functions runtime.
 */
function projectId(): string {
  return admin.app().options.projectId ?? process.env.GCLOUD_PROJECT ?? '';
}

/**
 * Ονόματα κάδων ανά θέση — η ΜΟΝΗ πηγή ονομάτων κάδων στα Cloud Functions (ADR-895 Α2).
 * Συνάρτηση, όχι top-level const: αποφεύγει την αξιολόγηση `admin.storage()` στη στιγμή
 * του module load (πριν προλάβει να τρέξει το `admin.initializeApp()` του `index.ts`).
 */
export function fileStorageBucketNames(): FileStorageBucketNames {
  return {
    'legacy-default': admin.storage().bucket().name,
    'eu-originals': process.env.GCS_FILES_EU_BUCKET ?? `${projectId()}${FILES_EU_BUCKET_SUFFIX}`,
  };
}
