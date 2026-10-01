/**
 * =============================================================================
 * ΠΟΙΟ URL ΔΕΙΧΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ; — ο ΕΝΑΣ αναγνώστης του πελάτη
 * =============================================================================
 *
 * **Το ερώτημα**: *«Έχω ένα `FileRecord` στο χέρι — με ποιο URL ζητώ τα bytes του για να τα
 * **δείξω**;»* — και **μόνο** αυτό.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΣΤΗΚΕ — ΜΕΤΡΗΜΕΝΟ 2026-10-01
 * ─────────────────────────────────────────────────────────────────────────────
 * Κάθε αναγνώστης έγραφε `file.downloadUrl` — **36 αρχεία / 92 σημεία**. Αλλά το `downloadUrl` είναι
 * **παράγωγο** του `storagePath` (+ `storagePlacement`), όχι αλήθεια: εγγραφές από seed, παλιές ροές ή
 * διορθώσεις στο χέρι **δεν το έχουν**, ενώ τα bytes **υπάρχουν**. Μετρημένο: το ακίνητο
 * `prop_48a7caf6…` έχει **2** έτοιμες φωτογραφίες (2,0 MB / 3,3 MB στο Storage) χωρίς `downloadUrl` ⇒ η
 * κεφαλίδα έδειχνε εικονίδιο-σπίτι και η καρτέλα «Φωτογραφίες» τις **έκρυβε**.
 *
 * 🏆 **Πρακτική GCS / Figma / Zillow CDN**: η βάση κρατά το **όνομα του αντικειμένου**· το URL είναι
 * **συνάρτηση** του ονόματος. Εδώ η συνάρτηση υπάρχει ήδη — ο **ένας** γραφέας `buildProxyUrl` — και ο
 * αναγνώστης απλώς **τον ρωτά**. Κανένας δεύτερος builder.
 *
 * ⚠️ **ΔΕΝ ρωτά «επιτρέπεται;»**: αυτό το κρίνει ο proxy (`/api/storage/file`, μισθωτής από το μονοπάτι).
 * Μια πρόβλεψη εδώ θα ήταν **δεύτερος κριτής**, ελεύθερος να διαφωνήσει με τον πρώτο (μάθημα
 * `storage-path-custody`). Ο αναγνώστης λέει **ποιο** URL· ο proxy λέει **αν**.
 *
 * 🔑 **Ονομασμένη έκβαση, ποτέ σιωπηλό `undefined`**: «δεν υπάρχει μονοπάτι» (π.χ. μετά από purge) και
 * «άγνωστη θέση bytes» (ADR-895 — ποτέ μαντεψιά κάδου) είναι **διαφορετικές** αιτίες, με διαφορετικό log.
 *
 * ⚠️ **Καθαρό module** — κανένα I/O, κανένα React· εισάγεται από πελάτη και διακομιστή.
 *
 * @module lib/files/file-display-url
 * @see lib/storage/storage-object-url — ο γραφέας (`buildProxyUrl`) και ο αντίστροφος αναγνώστης
 * @see lib/files/file-storage-placement — η θέση bytes (ADR-895)
 */

import { buildProxyPreview, buildProxyUrl, type ProxyImagePreview } from '@/lib/storage/storage-object-url';

import { isPreviewableContentType } from './file-preview-ladder';

import { fileStoragePlacementOf, isFileStoragePlacement } from './file-storage-placement';

/** Ό,τι χρειάζεται από μια εγγραφή — **δομικό**, ώστε να το ικανοποιεί κάθε `FileRecord` ή προβολή του. */
export interface FileDisplayUrlSubject {
  readonly downloadUrl?: string | null;
  readonly storagePath?: string | null;
  readonly storagePlacement?: unknown;
  /** Ο τύπος των bytes — αποφασίζει αν υπάρχει προεπισκόπηση (ADR-899). */
  readonly contentType?: string | null;
}

/** Γιατί δεν βγήκε URL. **Κλειστό σύνολο.** */
export type FileDisplayUrlGap =
  /** Ούτε `downloadUrl` ούτε `storagePath` — π.χ. εγγραφή μετά από purge/GDPR. */
  | 'no-storage-path'
  /** Το `storagePlacement` έχει τιμή εκτός λεξιλογίου (ADR-895) — ο κάδος **δεν** μαντεύεται. */
  | 'unknown-placement';

export type FileDisplayUrl =
  | {
      readonly kind: 'url';
      readonly url: string;
      /** `stored` = το `downloadUrl` της εγγραφής · `derived` = παράχθηκε από το `storagePath`. Για παρατηρησιμότητα. */
      readonly origin: 'stored' | 'derived';
      /**
       * Παράγωγα κατ' απαίτηση (`src` + `srcset`, ADR-899) — `null` όταν ο τύπος δεν προεπισκοπείται
       * ή δεν υπάρχει μονοπάτι. Ανεξάρτητο από το `downloadUrl`: ό,τι έχει όνομα αντικειμένου έχει κλίμακα.
       * Το `url` μένει **το αρχείο** (λήψη/άνοιγμα)· το `preview` είναι **η εικόνα που δείχνεται**.
       */
      readonly preview: ProxyImagePreview | null;
    }
  | { readonly kind: 'unavailable'; readonly why: FileDisplayUrlGap };

const nonEmpty = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * **Με ποιο URL δείχνεται αυτό το αρχείο;**
 *
 * 1. Αποθηκευμένο `downloadUrl` ⇒ αυτό, αυτούσιο (μπορεί να είναι και παλιό URL τρίτου — δεν ξαναγράφεται).
 * 2. Αλλιώς `storagePath` ⇒ το proxy URL του **ενός** γραφέα, με τη θέση bytes της εγγραφής.
 * 3. Αλλιώς ονομασμένη απουσία.
 */
export function fileDisplayUrlOf(record: FileDisplayUrlSubject): FileDisplayUrl {
  const placement = record.storagePlacement;
  const knownPlacement = placement === undefined || placement === null || isFileStoragePlacement(placement);
  const preview =
    nonEmpty(record.storagePath) && knownPlacement && isPreviewableContentType(record.contentType)
      ? buildProxyPreview(record.storagePath, fileStoragePlacementOf(record))
      : null;

  if (nonEmpty(record.downloadUrl)) return { kind: 'url', url: record.downloadUrl, origin: 'stored', preview };
  if (!nonEmpty(record.storagePath)) return { kind: 'unavailable', why: 'no-storage-path' };
  if (!knownPlacement) return { kind: 'unavailable', why: 'unknown-placement' };
  return {
    kind: 'url',
    url: buildProxyUrl(record.storagePath, fileStoragePlacementOf(record)),
    origin: 'derived',
    preview,
  };
}

/** Συντόμευση για οθόνες: το URL ή `null` — ⚠️ μόνο όπου η αιτία της απουσίας δεν αλλάζει τι δείχνεται. */
export function fileDisplayUrl(record: FileDisplayUrlSubject): string | null {
  const resolved = fileDisplayUrlOf(record);
  return resolved.kind === 'url' ? resolved.url : null;
}
