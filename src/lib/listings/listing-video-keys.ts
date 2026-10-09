/**
 * @fileoverview **Η ΟΡΑΤΗ ΣΗΜΕΙΩΣΗ ΚΑΤΩ ΑΠΟ ΤΟ ΒΙΝΤΕΟ** — «τίνος υλικό είναι αυτό;», ανά προέλευση της αγγελίας.
 * @related ADR-907 §10.6 · lib/listings/listing-authorship (`LISTING_MATERIAL_KEYS`) · components/listing-detail/ListingVideos
 * @module lib/listings/listing-video-keys
 *
 * 🔴 **ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΠΕΔΙΟ ΤΟΥ `LISTING_MATERIAL_KEYS`, ΟΠΩΣ ΤΟ `modelNote` — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΥΦΟΣ.** Η πρώτη γραφή το
 * έβαλε εκεί. Ο τεμαχιστής i18n αποδίδει κλειδιά **ανά αρχείο**: κάθε διαδρομή που εισάγει το `listing-authorship`
 * πληρώνει **όλες** τις προτάσεις του, και η `/listing/[id]/floorplan` πέρασε το ταβάνι της (**1684 > 1502 bytes**,
 * 2026-10-09) για σημείωση βίντεο που δεν δείχνει ποτέ. Η θεραπεία του μητρώου είναι **όριο, όχι μεγαλύτερος αριθμός**:
 * αυτό το module το εισάγει **μόνο** το φύλλο του βίντεο.
 *
 * 🔑 **Ο παρονομαστής μένει ο ίδιος** — `Record<ListingAuthorship, …>`: νέα κλάση γνώσης **σπάει τη μεταγλώττιση εδώ**
 * μέχρι να απαντηθεί «πώς λέγεται στον άνθρωπο;». Μόνο ο **τόπος** χωρίζει, όχι το ιδίωμα.
 *
 * ⚠️ **ΔΕΝ αποθηκεύεται πουθενά** (αντίθετα από το `videoAlt`, που ταξιδεύει ως τιμή στο δημοσιευμένο `videos[]` και
 * γι' αυτό μένει στο `LISTING_MATERIAL_KEYS`, όπου το διαβάζει ο γραφέας του διακομιστή).
 */

import type { ListingAuthorship } from '@/types/public-listing';

/** Με πρόθεμα namespace: τα κλειδιά ταξιδεύουν ως τιμές και καταλήγουν αυτούσια σε `t()`. */
export const LISTING_VIDEO_NOTE_KEYS: Readonly<Record<ListingAuthorship, string>> = {
  'owner-declared': 'listing-detail:video.note.ownerDeclared',
  agency: 'listing-detail:video.note.agency',
} as const;
