/**
 * =============================================================================
 * ΒΡΑΧΥΒΙΟ ΥΠΟΓΕΓΡΑΜΜΕΝΟ URL — ο ΕΝΑΣ γεννήτορας (ADR-862 Φ0 Β8)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Δώσε στον φυλλομετρητή μια **πρόσκαιρη** άδεια να πάρει αυτό το
 * αντικείμενο **απευθείας** — χωρίς να περάσουν τα bytes από τον διακομιστή.»*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🌐 Η ΠΡΑΚΤΙΚΗ ΤΗΣ ΑΓΟΡΑΣ, ΚΑΙ ΓΙΑΤΙ Ο ΧΡΟΝΟΣ ΖΩΗΣ ΕΙΝΑΙ ΤΟ ΠΑΝ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το Autodesk Construction Cloud δίνει `item_id` → ο διακομιστής → **βραχύβιο
 * υπογεγραμμένο URL**· τα bytes **δεν** περνούν από το API. Η τεκμηρίωση της Google
 * για τα V4 signed URLs λέει: *«use the shortest expiry that fits your use case —
 * an hour or less for a download link, never more than a day for anything
 * sensitive»*, και *«treat signed URLs as secrets: do not log them»*.
 *
 * 🔴 **ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΑΝΤΙΘΕΤΟ ΤΟΥ `downloadUrl` ΠΟΥ ΚΟΥΒΑΛΑΕΙ ΤΟ ΕΡΓΟ.** Το
 * `getDownloadURL()` του Firebase επιστρέφει **μόνιμο** token URL που **παρακάμπτει
 * τους κανόνες Storage** — επίσημα τεκμηριωμένο. Όποιος το είδε μία φορά, το έχει
 * για πάντα. Μετρημένο 2026-09-16: **334 εμφανίσεις σε 123 αρχεία**.
 *
 * ⇒ Αυτό το module είναι ο **αντίποδας**: άδεια με **ημερομηνία λήξης**, που ο
 * διακομιστής δίνει **αφού** έχει κρίνει.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΟ ΥΠΟΓΕΓΡΑΜΜΕΝΟ URL **ΔΕΝ** ΕΙΝΑΙ ΦΡΟΥΡΟΣ — ΕΙΝΑΙ Η **ΣΥΝΕΠΕΙΑ** ΤΟΥ ΦΡΟΥΡΟΥ
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ **ΜΗΝ το καλέσεις πριν κρίνεις.** Η υπογραφή λέει *«ο κάτοχος αυτού του
 * συνδέσμου επιτρέπεται»*, όχι *«ο καλών επιτρέπεται»*: μόλις φύγει, ταξιδεύει
 * χωρίς ταυτότητα. Η σειρά είναι **πάντα** `fileResource.load()` →
 * `containerVisibilityRefusal()` → **μετά** αυτό.
 *
 * @module lib/storage/signed-download-url
 * @see app/api/files/_shared/owned-file-bytes — η αλυσίδα που προηγείται
 * @see lib/storage/storage-path-custody — «ποιανού είναι αυτή η διαδρομή;»
 */

import 'server-only';

import { getAdminBucket } from '@/lib/firebaseAdmin';
import { attachmentDisposition } from '@/lib/http/content-disposition';

// =============================================================================
// Ο ΧΡΟΝΟΣ ΖΩΗΣ
// =============================================================================

/**
 * **15 λεπτά** — η προεπιλογή, και είναι σκόπιμα η **αυστηρή** άκρη της σύστασης.
 *
 * Αρκεί με άνεση για να ξεκινήσει και να ολοκληρωθεί μια λήψη· δεν αρκεί για να
 * γίνει ο σύνδεσμος «αρχείο» σε chat ή σε σελιδοδείκτη.
 */
export const SIGNED_DOWNLOAD_TTL_MS = 15 * 60 * 1000;

/**
 * **7 ημέρες** — το **απόλυτο** όριο των V4 signed URLs της Google (604.800s).
 *
 * ⛔ Δεν είναι επιλογή· είναι το ταβάνι που επιβάλλει ο πάροχος, και υπάρχει εδώ
 * **μόνο** για να μπορεί ο φρουρός να απορρίψει αίτημα που το ξεπερνά **πριν**
 * φτάσει στο SDK — αλλιώς η αποτυχία έρχεται ως αδιάγνωστο σφάλμα δικτύου.
 */
export const SIGNED_URL_MAX_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// =============================================================================
// Η ΕΚΒΑΣΗ
// =============================================================================

export interface SignedDownloadRequest {
  /** Το object name **όπως ζει στο bucket** — από το έγγραφο, ποτέ από το αίτημα. */
  readonly storagePath: string;
  /** Χρόνος ζωής σε ms. Προεπιλογή {@link SIGNED_DOWNLOAD_TTL_MS}. */
  readonly ttlMs?: number;
  /**
   * 🔑 **Γιατί χρειάζεται μεγαλύτερος από την προεπιλογή** — υποχρεωτικό όταν ο
   * `ttlMs` ξεπερνά το προεπιλεγμένο.
   *
   * ⚠️ Δεν είναι διακοσμητικό: ο μόνος τρόπος να μη γίνει το «λίγο παραπάνω» η
   * σιωπηλή νέα προεπιλογή είναι να **κοστίζει μια πρόταση** σε κάθε σημείο κλήσης.
   * Ίδιο ιδίωμα με το `why` των πυλών αυτού του δέντρου.
   */
  readonly longLivedReason?: string;
  /**
   * Όνομα αρχείου για **λήψη** (`Content-Disposition: attachment`) — αλλιώς ο φυλλομετρητής κρατά το object
   * name (π.χ. `mevd_…` χωρίς επέκταση). RFC 6266: ASCII `filename` + UTF-8 `filename*` για ελληνικά ονόματα.
   */
  readonly downloadFileName?: string;
}

export type SignedDownloadOutcome =
  | { readonly outcome: 'signed'; readonly url: string; readonly expiresAt: number }
  /** Το αίτημα είναι λάθος — **πριν** αγγίξει το SDK. */
  | { readonly outcome: 'rejected'; readonly why: SignedDownloadRejection };

export type SignedDownloadRejection =
  | 'path-missing'
  | 'ttl-not-positive'
  | 'ttl-exceeds-provider-max'
  | 'long-lived-without-reason';

// =============================================================================
// Ο ΓΕΝΝΗΤΟΡΑΣ
// =============================================================================

/**
 * **Υπόγραψε μια πρόσκαιρη άδεια ανάγνωσης.**
 *
 * @example
 * // ΜΟΝΟ αφού ο φρουρός έχει πει «ναι»:
 * const signed = await signedDownloadUrl({ storagePath: record.storagePath });
 * if (signed.outcome !== 'signed') return serverError();
 * return NextResponse.redirect(signed.url, 307);
 */
export async function signedDownloadUrl(
  request: SignedDownloadRequest,
): Promise<SignedDownloadOutcome> {
  const { storagePath, ttlMs = SIGNED_DOWNLOAD_TTL_MS, longLivedReason, downloadFileName } = request;

  if (typeof storagePath !== 'string' || storagePath.trim().length === 0) {
    return { outcome: 'rejected', why: 'path-missing' };
  }
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    return { outcome: 'rejected', why: 'ttl-not-positive' };
  }
  if (ttlMs > SIGNED_URL_MAX_TTL_MS) {
    return { outcome: 'rejected', why: 'ttl-exceeds-provider-max' };
  }
  if (ttlMs > SIGNED_DOWNLOAD_TTL_MS && (longLivedReason ?? '').trim().length === 0) {
    return { outcome: 'rejected', why: 'long-lived-without-reason' };
  }

  const expiresAt = Date.now() + ttlMs;
  const [url] = await getAdminBucket()
    .file(storagePath.trim())
    .getSignedUrl({
      action: 'read',
      expires: expiresAt,
      ...(downloadFileName === undefined ? {} : { responseDisposition: attachmentDisposition(downloadFileName) }),
    });

  // ⛔ Το `url` **δεν** καταγράφεται: η ίδια η Google το ονομάζει μυστικό. Ένα
  //    log εδώ θα έκανε κάθε αποθηκευμένη γραμμή ημερολογίου κλειδί πρόσβασης.
  return { outcome: 'signed', url, expiresAt };
}
