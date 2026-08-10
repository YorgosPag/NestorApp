/**
 * ADR-782 §21 — τα **κλειδιά μετάφρασης** για την προέλευση της θέσης και για τον λόγο άρνησης.
 *
 * ## Γιατί πίνακας και όχι `switch` μέσα σε κάθε component
 * Την ίδια πληροφορία τη δείχνουν **δύο** επιφάνειες (ο διακόπτης στη μπάρα ορόφων και οι
 * ρυθμίσεις υποβάθρου). Δύο τοπικοί `switch` είναι δύο λεξιλόγια για ένα ερώτημα: την ημέρα που
 * προστίθεται λόγος, το ένα θα τον δείχνει και το άλλο θα βάφει κενό — και η βλάβη θα φαίνεται ως
 * «λείπει μετάφραση», δηλαδή ως πρόβλημα i18n αντί για πρόβλημα λογικής (σχήμα ADR-749).
 *
 * ## 🔑 Ο τύπος είναι ο φρουρός
 * Είναι **`Record<...>` πλήρες**, όχι `Partial`: προσθέτοντας τιμή στο
 * {@link ProjectAnchorRefusal} ή στο {@link ApproximateAnchorOrigin}, ο **μεταγλωττιστής**
 * απαιτεί κλειδί εδώ. Χωρίς αυτό, ένας νέος λόγος θα προσγειωνόταν σιωπηλά ως κενή γραμμή στην
 * οθόνη — ο χρήστης θα έβλεπε σβηστό χάρτη **χωρίς εξήγηση**, που είναι ακριβώς η κατάσταση που
 * όλο αυτό το υποσύστημα υπάρχει για να εξαλείψει.
 *
 * ⚠️ Τα κλειδιά ζουν στο namespace **`dxf-viewer-shell`** (el + en), όπως τα υπόλοιπα του
 * υποβάθρου. Πρώτα το κλειδί στα locale, ποτέ `defaultValue` με κείμενο (N.11).
 */

import type { ApproximateAnchorOrigin, ProjectAnchorRefusal } from './basemap-availability';

/** «Από πού ξέρουμε αυτή τη θέση;» — φράση που διαβάζει ο χρήστης. */
export const ANCHOR_ORIGIN_LABEL_KEY: Record<ApproximateAnchorOrigin, string> = {
  projectAddressGeocoded: 'basemap.anchorOrigin.geocoded',
  projectAddressPinned: 'basemap.anchorOrigin.pinned',
  projectAddressStored: 'basemap.anchorOrigin.stored',
};

/**
 * «Γιατί δεν υπάρχει χάρτης, και τι να κάνω;»
 *
 * Κάθε κείμενο ονομάζει τη **θεραπεία**, όχι μόνο το σύμπτωμα: ένας λόγος που δεν λέει στον
 * χρήστη πού να πάει είναι εξήγηση χωρίς έξοδο.
 */
export const ANCHOR_REFUSAL_HINT_KEY: Record<ProjectAnchorRefusal, string> = {
  'no-address': 'basemap.unavailableReason.noAddress',
  'no-coordinates': 'basemap.unavailableReason.noCoordinates',
  'invalid-coordinates': 'basemap.unavailableReason.invalidCoordinates',
  'too-coarse': 'basemap.unavailableReason.tooCoarse',
  'low-confidence': 'basemap.unavailableReason.lowConfidence',
};
