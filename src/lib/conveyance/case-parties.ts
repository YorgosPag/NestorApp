/**
 * Conveyance — ένα πρόσωπο της υπόθεσης (ADR-915 §22): η ΜΙΑ κατασκευή του.
 *
 * Η ταυτότητα (`key`) ενός πωλητή είναι η επαφή του: η ίδια επαφή δύο φορές είναι **ένα** πρόσωπο (ιδεμπότητα), και οι
 * γραμμές του (`itemId@key`) δεν εξαρτώνται από τη θέση του στη λίστα. Πωλητής χωρίς γνωστή επαφή (έργο χωρίς
 * `linkedCompanyId`) παίρνει το σταθερό `UNIDENTIFIED_SELLER_KEY` — ποτέ τυχαίο κλειδί που θα άλλαζε σε κάθε ανάγνωση.
 *
 * **Layering**: leaf.
 *
 * @module lib/conveyance/case-parties
 */

import type { ConveyancePartyKind, ConveyanceSellerParty } from '@/types/conveyance-case';

/** Το κλειδί του πωλητή που δεν έχει (ακόμη) επαφή. */
export const UNIDENTIFIED_SELLER_KEY = 'seller';

/** Η ταυτότητα του πωλητή μέσα στην υπόθεση — από την επαφή του. */
export function sellerKeyOf(contactId: string | null): string {
  return contactId ?? UNIDENTIFIED_SELLER_KEY;
}

export function sellerParty(contactId: string | null, kind: ConveyancePartyKind): ConveyanceSellerParty {
  return { key: sellerKeyOf(contactId), contactId, kind };
}
