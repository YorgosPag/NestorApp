/**
 * @fileoverview 📷 **ΟΙ ΦΩΤΟΓΡΑΦΙΕΣ ΕΝΟΣ ΑΚΙΝΗΤΟΥ, ΜΕ ΤΗ ΣΕΙΡΑ ΠΟΥ ΤΙΣ ΔΗΛΩΣΕ Ο ΑΝΘΡΩΠΟΣ** — η μία προβολή
 *   για κεφαλίδα, κάρτα πλέγματος και γκαλερί κεφαλίδας (ADR-777 §8.30).
 * @related lib/files/file-display-url (το URL) · services/listings/agency-media-publication (`agencyMediaDeclaration`)
 * @module lib/properties/property-photos
 *
 * 🔑 **Το εξώφυλλο ΔΕΝ εφευρίσκεται εδώ**: η έννοια υπάρχει ήδη — η πράξη «να μπει πρώτη» του γραφείου
 *   (`publishedMediaOrder`, ADR-841 §7 Α14.7). Η κεφαλίδα δείχνει πρώτη **την ίδια** φωτογραφία που ο κόσμος
 *   βλέπει πρώτη στην αγγελία· χωρίς δήλωση, μένει η σειρά ανάγνωσης (`createdAt DESC`).
 * 🔑 **Το URL από τον ΕΝΑ αναγνώστη** (`fileDisplayUrlOf`): εγγραφή χωρίς `downloadUrl` αλλά με `storagePath`
 *   φαίνεται· εγγραφή που **δεν** μπορεί να δειχτεί **ονομάζεται** (`unavailable`) — ποτέ σιωπηλή απουσία.
 * 🏆 **Πάνω από τους μεγάλους**: κάθε φωτογραφία ξέρει αν έχει **σημείο λήψης** στην κάτοψη (ADR-897) — η
 *   γκαλερί το λέει πάνω στη φωτογραφία, πριν ανοίξει το lightbox.
 * ⚠️ **Καθαρό module** — κανένα React, κανένα I/O.
 */

import type { ImageDimensions } from '@/lib/images/image-dimensions';
import type { ProxyImagePreview } from '@/lib/storage/storage-object-url';
import { fileDisplayUrlOf, type FileDisplayUrlGap, type FileDisplayUrlSubject } from '@/lib/files/file-display-url';
import { orderByDeclaration } from '@/lib/ordering/declared-order';
import { agencyMediaDeclaration } from '@/services/listings/agency-media-publication';

/** Ό,τι χρειάζεται από ένα αρχείο — δομικό, ώστε να το ικανοποιεί κάθε `FileRecord`. */
export interface PropertyPhotoFile extends FileDisplayUrlSubject {
  readonly id: string;
  readonly displayName?: string | null;
  readonly originalFilename?: string | null;
}

/** Τα πεδία δήλωσης του ακινήτου που αφορούν τις φωτογραφίες — ωμά, όπως έρχονται από το έγγραφο. */
export interface PropertyPhotoDeclarationSource {
  readonly publishedMediaOrder?: unknown;
  readonly publishedPhotoCaptureSpots?: unknown;
}

export interface PropertyPhoto {
  readonly fileId: string;
  readonly url: string;
  /** Παράγωγα κατ' απαίτηση για `<img srcSet>` (ADR-899) — `null` ⇒ δείξε το `url`. */
  readonly preview: ProxyImagePreview | null;
  /** Το όνομα που βλέπει ο άνθρωπος — δεδομένο, όχι κλειδί i18n. */
  readonly title: string;
  /** Έχει δηλωμένο σημείο λήψης σε κάτοψη (ADR-897). */
  readonly hasCaptureSpot: boolean;
  /** Διαστάσεις θεατή, **μόνο** μετρημένες (ADR-899 §3.7) — το lightbox ξέρει έτσι αν τη φωτογραφία την κόβει το ύψος. */
  readonly dimensions: ImageDimensions | null;
}

export interface UnavailablePropertyPhoto {
  readonly fileId: string;
  readonly why: FileDisplayUrlGap;
}

export interface PropertyPhotos {
  readonly photos: readonly PropertyPhoto[];
  /** Όσες **δεν** μπορούν να δειχτούν, με την αιτία — για log, ποτέ σιωπηλά πεταμένες. */
  readonly unavailable: readonly UnavailablePropertyPhoto[];
}

/** Η σειρά ανάγνωσης μένει ως έχει στην ουρά (η `sort` είναι σταθερή). */
const KEEP_READ_ORDER = (): number => 0;

/**
 * **Οι φωτογραφίες προς προβολή**, με τη δηλωμένη σειρά.
 *
 * @param files Τα αρχεία κατηγορίας «φωτογραφίες», στη σειρά ανάγνωσης.
 * @param declaration Τα ωμά πεδία δήλωσης του ακινήτου (περνούν από το `agencyMediaDeclaration`).
 */
export function propertyPhotosOf(
  files: readonly PropertyPhotoFile[],
  declaration: PropertyPhotoDeclarationSource,
): PropertyPhotos {
  const { order, captureSpots } = agencyMediaDeclaration(declaration);
  const ordered = orderByDeclaration(files, (file) => file.id, order, KEEP_READ_ORDER);

  const photos: PropertyPhoto[] = [];
  const unavailable: UnavailablePropertyPhoto[] = [];
  for (const file of ordered) {
    const resolved = fileDisplayUrlOf(file);
    if (resolved.kind === 'unavailable') {
      unavailable.push({ fileId: file.id, why: resolved.why });
      continue;
    }
    photos.push({
      fileId: file.id,
      url: resolved.url,
      preview: resolved.preview,
      title: file.displayName || file.originalFilename || file.id,
      hasCaptureSpot: captureSpots?.has(file.id) ?? false,
      dimensions: resolved.dimensions,
    });
  }
  return { photos, unavailable };
}
