/**
 * @fileoverview Αντιγραφή της **αποθηκευμένης θέσης** από σχήμα σε σχήμα — ADR-332 D27 Β-ΙΙ.
 * @module utils/address/stored-address-position
 *
 * Η θέση ταξιδεύει ανάμεσα σε **τρία** σχήματα διεύθυνσης (`CompanyAddress` της φόρμας,
 * `AddressInfo` του παράγωγου `addresses[]`, `ProjectAddress` του χάρτη). Κάθε μεταφορά
 * που την ξεχνά τη **σβήνει σιωπηλά** στο επόμενο save — το μάθημα του ADR-759 Φ3 και του
 * D15, όπου τρεις κατασκευαστές είχαν αποκλίνει για το τι περνά.
 *
 * ⚠️ Επιστρέφει **μόνο** τα πεδία που υπάρχουν: το Firestore απορρίπτει `undefined`, και
 * ένα κλειδί με `undefined` εδώ θα έσπαγε ολόκληρο το save (ADR-332 D18).
 */

import type { StoredAddressPosition } from '@/types/address-position';

export function pickStoredAddressPosition(
  source: Readonly<StoredAddressPosition>,
): StoredAddressPosition {
  const picked: StoredAddressPosition = {};
  if (source.coordinates) {
    picked.coordinates = { lat: source.coordinates.lat, lng: source.coordinates.lng };
  }
  if (source.geocodingMetadata) picked.geocodingMetadata = { ...source.geocodingMetadata };
  if (source.source) picked.source = source.source;
  if (typeof source.verifiedAt === 'number') picked.verifiedAt = source.verifiedAt;
  // §D32 — το ίχνος αποτυχίας είναι **μέρος** της θέσης: χωρίς αυτό εδώ, κάθε μεταφορά σχήματος το σβήνει.
  if (source.geocodeAttempt) {
    picked.geocodeAttempt = { ...source.geocodeAttempt, resolvedFor: { ...source.geocodeAttempt.resolvedFor } };
  }
  return picked;
}

/** Τα πεδία που **είναι** η θέση — αντικαθίστανται ολόκληρα, ποτέ μερικώς. */
const STORED_POSITION_FIELDS = ['coordinates', 'geocodingMetadata', 'source', 'verifiedAt', 'geocodeAttempt'] as const;

/**
 * Γράφει τη θέση πάνω στη διεύθυνση, **ολόκληρη**: ό,τι λείπει από τη θέση **αφαιρείται**, δεν μένει
 * μπαγιάτικο (ίδιος κανόνας με το `applyAddressPosition` του γραφέα).
 *
 * 🔑 Μία διατύπωση για τρεις καταναλωτές: τις επαφές (`applyContactAddressPosition`), την
 * ολοκλήρωση μετά την αποθήκευση (διακομιστής) και την υιοθέτησή της από την οθόνη (ADR-332 D29).
 */
export function withStoredAddressPosition<T extends object>(
  address: T,
  position: Readonly<StoredAddressPosition>,
): T {
  const next = { ...address } as Record<string, unknown>;
  for (const field of STORED_POSITION_FIELDS) delete next[field];
  return { ...next, ...pickStoredAddressPosition(position) } as T;
}

/**
 * Το αποτύπωμα μιας θέσης — **χωρίς** τη στιγμή επαλήθευσης.
 *
 * 🔴 Η στιγμή δεν είναι θέση· είναι το πότε τη μάθαμε. Με το `verifiedAt` μέσα, δύο αναγνώσεις της
 * **ίδιας** θέσης διαφέρουν όποτε η μηχανή ξαναρωτήθηκε — δηλαδή «άλλαξε» κάτι που δεν άλλαξε.
 *
 * §D32 — ίδιος λόγος για το `geocodeAttempt.at`: το ίχνος αποτυχίας **είναι** μέρος της θέσης
 * (`status` · `revision` · `resolvedFor`), η στιγμή του όχι. Με το `at` μέσα, κάθε δεύτερο «δεν
 * βρέθηκε» για το ίδιο κείμενο ήταν δεύτερη γραφή — η ολοκλήρωση έπαυε να είναι ιδεμποτική.
 */
export function storedPositionSignature(source: Readonly<StoredAddressPosition> | undefined): string {
  if (!source) return '{}';
  const { verifiedAt: _when, geocodeAttempt, ...where } = pickStoredAddressPosition(source);
  if (!geocodeAttempt) return JSON.stringify(where);
  const { at: _attemptedAt, ...attempt } = geocodeAttempt;
  return JSON.stringify({ ...where, geocodeAttempt: attempt });
}
