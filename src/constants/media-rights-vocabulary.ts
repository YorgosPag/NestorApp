/**
 * @fileoverview **ΓΙΑ ΤΙ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΧΡΗΣΙΜΟΠΟΙΗΘΕΙ ΜΙΑ ΦΩΤΟΓΡΑΦΙΑ** — κλειστό λεξιλόγιο αδειών.
 * @related ADR-884 Φ0.14 · ADR-866 §5.6.1 · IPTC Photo Metadata (Licensor · Web Statement of Rights)
 * @module constants/media-rights-vocabulary
 *
 * Τα πνευματικά δικαιώματα μιας φωτογραφίας ανήκουν στον **δημιουργό** της, εκτός αν υπάρχει γραπτή
 * άδεια (NAR · VHT v. Zillow, ADR-866 §5.6.1). Η άδεια δεν είναι ελεύθερο κείμενο: είναι **σκοπός** από
 * κλειστό σύνολο + **διάρκεια** — ώστε η απόσυρση στη λήξη να γίνεται **χωρίς** να τη θυμηθεί κανείς.
 *
 * **Layering**: leaf — καμία εξάρτηση.
 */

/**
 * Οι σκοποί, **από τον στενότερο στον ευρύτερο**:
 * - `listing-marketing` — μάρκετινγκ **αυτού** του ακινήτου (η προεπιλογή για μέσα μεσίτη)
 * - `owner-reuse`       — γραπτή άδεια επαναχρησιμοποίησης στον ιδιοκτήτη (ADR-866 §5.6.1 Δ2)
 * - `unrestricted`      — ο δικαιούχος δεν θέτει περιορισμό χρήσης
 */
export const MEDIA_LICENSE_PURPOSES = ['listing-marketing', 'owner-reuse', 'unrestricted'] as const;
export type MediaLicensePurpose = (typeof MEDIA_LICENSE_PURPOSES)[number];

/**
 * Πόσο κρατά η άδεια.
 * - `mandate`   — **όσο ισχύει η εντολή** (ADR-827): παράταση εντολής ⇒ παράταση άδειας, χωρίς να ξαναγραφτεί τίποτα
 * - `date`      — έως συγκεκριμένη στιγμή
 * - `perpetual` — χωρίς λήξη
 */
export const MEDIA_LICENSE_TERM_KINDS = ['mandate', 'date', 'perpetual'] as const;
export type MediaLicenseTermKind = (typeof MEDIA_LICENSE_TERM_KINDS)[number];

/** IPTC: έως **τρεις** δικαιούχοι (`Licensor`) ανά εικόνα. */
export const MAX_MEDIA_LICENSORS = 3;

export function isMediaLicensePurpose(value: unknown): value is MediaLicensePurpose {
  return typeof value === 'string' && (MEDIA_LICENSE_PURPOSES as readonly string[]).includes(value);
}

export function isMediaLicenseTermKind(value: unknown): value is MediaLicenseTermKind {
  return typeof value === 'string' && (MEDIA_LICENSE_TERM_KINDS as readonly string[]).includes(value);
}
