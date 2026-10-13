/**
 * @fileoverview **Η δήλωση του ΠΕΑ από το γραφείο** — το μπλοκ **και** η αξίωση νομιμότητας, στην ίδια εγγραφή.
 * @related ADR-777 §8.94 · ADR-838 · `lib/energy-certificate/*` · `./property-patch-helpers.ts` · `./route.ts`
 * @module api/properties/[id]/property-energy-patch
 *
 * 🔑 **Η γενική διαδρομή του γραφείου γράφει το σώμα αυτούσιο**, και εδώ αυτό δεν αρκεί για δύο λόγους:
 *
 * 1. Η ισχύς του ΠΕΑ ζει στο κανάλι νομιμότητας (`legality`), που ο πελάτης **δεν** επιτρέπεται να στείλει — μια
 *    βαθμίδα «επαληθευμένο από μητρώο» γραμμένη από φόρμα θα ήταν ισχυρισμός χωρίς προέλευση. Τη γράφει ο server, από
 *    το μπλοκ, με τη στιγμή της δήλωσης.
 * 2. Το `update({ energy })` του Firestore **αντικαθιστά ολόκληρο** το αντικείμενο· τα πεδία του παλιού σχήματος
 *    (`certificateId` · `certificateDate` · `validUntil`) θα χάνονταν σιωπηλά σε κάθε αποθήκευση.
 */

import { readEnergyCertificate } from '@/lib/energy-certificate/energy-certificate';
import { withEnergyPerformanceClaim } from '@/lib/energy-certificate/energy-certificate-claim';
import { readLegalityClaims } from '@/lib/legality/legality-claim-reading';
import { isPlainRecord } from '@/lib/type-guards';

/** Τα πεδία του παλιού σχήματος που το μπλοκ δεν κατέχει — επιβιώνουν αυτούσια. */
const LEGACY_ENERGY_KEYS = ['certificateId', 'certificateDate', 'validUntil'] as const;

function legacyEnergyFieldsOf(stored: unknown): Record<string, unknown> {
  if (!isPlainRecord(stored)) return {};
  return Object.fromEntries(
    LEGACY_ENERGY_KEYS.filter((key) => stored[key] !== undefined && stored[key] !== null).map((key) => [key, stored[key]]),
  );
}

/**
 * **Ό,τι γράφεται όταν το σώμα φέρει `energy`** — ή τίποτα, όταν δεν το φέρει.
 *
 * @param declared το `energy` του σώματος, **μετά** το `storedEnergyCertificateSchema` (ήδη κανονικοποιημένο)
 * @param at η στιγμή της δήλωσης — γίνεται `assertedAt` της αξίωσης **μόνο** αν η δήλωση άλλαξε
 */
export function energyDeclarationPatch(
  propertyId: string,
  declared: unknown,
  existing: Record<string, unknown>,
  at: string,
): Record<string, unknown> {
  if (declared === undefined) return {};
  const certificate = readEnergyCertificate(declared);
  return {
    energy: { ...legacyEnergyFieldsOf(existing.energy), ...certificate },
    legality: withEnergyPerformanceClaim(readLegalityClaims(existing.legality), certificate, propertyId, at),
  };
}
