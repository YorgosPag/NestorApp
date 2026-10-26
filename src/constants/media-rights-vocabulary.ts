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
 * Οι σκοποί — ΡΙΖΑ του λεξιλογίου (CHECK 3.73). Κάθε σκοπός ανήκει σε ένα **πλαίσιο** ({@link MEDIA_LICENSE_CONTEXTS}):
 * - `listing-marketing`   — μάρκετινγκ **αυτού** του ακινήτου (η προεπιλογή για μέσα μεσίτη)
 * - `owner-reuse`         — γραπτή άδεια επαναχρησιμοποίησης στον ιδιοκτήτη (ADR-866 §5.6.1 Δ2)
 * - `catalog-publication` — δημοσίευση στους καταλόγους **αυτού** του χώρου: έντυπο, βιτρίνα, PDF (ADR-923 §5.10.3)
 * - `reseller-reuse`      — ο προμηθευτής επιτρέπει στους μεταπωλητές του (εμπόρους · εργολάβους) να ξαναχρησιμοποιούν
 *                           το μέσο στους **δικούς** τους καταλόγους/ιστότοπους (πρακτική «dealer asset kit»)
 * - `unrestricted`        — ο δικαιούχος δεν θέτει περιορισμό χρήσης
 */
export const MEDIA_LICENSE_PURPOSES = [
  'listing-marketing',
  'owner-reuse',
  'catalog-publication',
  'reseller-reuse',
  'unrestricted',
] as const;
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

/**
 * 🔑 **ΤΑ ΠΛΑΙΣΙΑ** — ποιοι σκοποί και ποιες διάρκειες έχουν νόημα **πού** (ADR-923 §5.10.3). Ένα λεξιλόγιο, πολλά πλαίσια:
 * - `listing`: μέσα αγγελίας/περιήγησης (ADR-884 · ADR-866). Αυτό εκθέτει το **συμβόλαιο της εφαρμογής κινητού** —
 *   η εφαρμογή λήψης ακινήτων **δεν** πρέπει να προσφέρει «μεταπώληση από αντιπρόσωπο».
 * - `catalog`: μέσα καταλόγου προϊόντων (ADR-923). **Χωρίς** `mandate`: η εντολή είναι έννοια ακινήτου (ADR-827)·
 *   ένα φυλλάδιο κατασκευαστή δεν λήγει με την εντολή κανενός.
 * Δεμένα στις ρίζες (`satisfies`): σκοπός ή διάρκεια εκτός λεξιλογίου δεν μεταγλωττίζεται.
 */
export const MEDIA_LICENSE_CONTEXTS = {
  listing: {
    purposes: ['listing-marketing', 'owner-reuse', 'unrestricted'],
    termKinds: ['mandate', 'date', 'perpetual'],
  },
  catalog: {
    purposes: ['catalog-publication', 'reseller-reuse', 'unrestricted'],
    termKinds: ['date', 'perpetual'],
  },
} as const satisfies Record<string, { readonly purposes: readonly MediaLicensePurpose[]; readonly termKinds: readonly MediaLicenseTermKind[] }>;

export type MediaLicenseContext = keyof typeof MEDIA_LICENSE_CONTEXTS;
export type MediaLicensePurposeIn<C extends MediaLicenseContext> = (typeof MEDIA_LICENSE_CONTEXTS)[C]['purposes'][number];

/** Επιτρέπεται αυτός ο σκοπός **σε αυτό** το πλαίσιο; */
export function isMediaLicensePurposeIn(context: MediaLicenseContext, value: unknown): value is MediaLicensePurpose {
  return (MEDIA_LICENSE_CONTEXTS[context].purposes as readonly unknown[]).includes(value);
}

/** Επιτρέπεται αυτή η διάρκεια **σε αυτό** το πλαίσιο; */
export function isMediaLicenseTermKindIn(context: MediaLicenseContext, value: unknown): value is MediaLicenseTermKind {
  return (MEDIA_LICENSE_CONTEXTS[context].termKinds as readonly unknown[]).includes(value);
}

