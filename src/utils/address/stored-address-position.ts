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
  return picked;
}
