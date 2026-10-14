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

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { ApiError } from '@/lib/api/api-error-types';
import { readEnergyCertificate } from '@/lib/energy-certificate/energy-certificate';
import {
  energyIssuedOnContradicts,
  withEnergyPerformanceClaim,
  type EnergySourceFacts,
} from '@/lib/energy-certificate/energy-certificate-claim';
import { readLegalityClaims } from '@/lib/legality/legality-claim-reading';
import { isPlainRecord } from '@/lib/type-guards';
import { companyPeaFileScope, peaSourceFacts } from '@/server/energy-certificate/energy-certificate-file-scope';

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
 * @param facts τα γεγονότα του `sourceFileId` (ADR-915 Φ3β-2, `peaSourceFacts`) — η λήξη της αξίωσης από το αρχείο
 */
export function energyDeclarationPatch(
  propertyId: string,
  declared: unknown,
  existing: Record<string, unknown>,
  at: string,
  facts: EnergySourceFacts | null = null,
): Record<string, unknown> {
  if (declared === undefined) return {};
  const certificate = readEnergyCertificate(declared);
  return {
    energy: { ...legacyEnergyFieldsOf(existing.energy), ...certificate },
    legality: withEnergyPerformanceClaim(readLegalityClaims(existing.legality), certificate, propertyId, at, facts),
  };
}

/** Ο κωδικός της άρνησης — ίδιο όνομα με το `issued_on_contradicts_document` της μεταβίβασης (ADR-915 Φ3β). */
export const ENERGY_ISSUED_ON_CONTRADICTS_DOCUMENT = 'ENERGY_ISSUED_ON_CONTRADICTS_DOCUMENT';

/**
 * **Η δήλωση του γραφείου, διαβασμένη απέναντι στο έγγραφό της** (ADR-915 Φ3β-2): τα γεγονότα του `sourceFileId`
 * διαβάζονται **μόνο** όταν το σώμα φέρει `energy` με πηγή, μέσα από το ΕΝΑ δοχείο του ΠΕΑ (ξένο αρχείο ⇒ `null`).
 * Αντίφαση με την ανάγνωση ⇒ **422**, τίποτα δεν γράφεται.
 */
export async function companyEnergyDeclarationPatch(
  db: AdminFirestore,
  scope: { readonly companyId: string; readonly propertyId: string },
  declared: unknown,
  existing: Record<string, unknown>,
  at: string,
): Promise<Record<string, unknown>> {
  if (declared === undefined) return {};
  const certificate = readEnergyCertificate(declared);
  const facts = await peaSourceFacts(db, companyPeaFileScope(scope.companyId, scope.propertyId), certificate);
  if (energyIssuedOnContradicts(certificate, facts)) {
    throw new ApiError(422, 'Energy certificate issue date contradicts its source document', ENERGY_ISSUED_ON_CONTRADICTS_DOCUMENT);
  }
  return energyDeclarationPatch(scope.propertyId, declared, existing, at, facts);
}
