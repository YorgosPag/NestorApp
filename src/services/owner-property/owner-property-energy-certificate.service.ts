/**
 * @fileoverview **Ο γραφέας του ενεργειακού πιστοποιητικού του ιδιώτη** (ADR-777 §8.94) — το μπλοκ **και** η αξίωσή του.
 * @related `lib/energy-certificate/energy-certificate.ts` (σχήμα · διόρθωση · αναγνώστης) ·
 *   `lib/energy-certificate/energy-certificate-claim.ts` (η αξίωση νομιμότητας) · `owner-property-amendment.ts`
 *   (η κοινή συναλλαγή) · `app/api/owner-properties/_shared/listing-amendments.ts`
 * @module services/owner-property/owner-property-energy-certificate.service
 *
 * 🔑 **Πράξη μετά τη δημοσίευση, όχι πεδίο των 8** (ADR-842 Α2): η `/offers/new` δεν μεγαλώνει.
 * 🔑 **Μερική διόρθωση**: αλλάζουν **μόνο** τα κλειδιά που στάλθηκαν· ρητό `null` = «σβήσε την απάντηση».
 * 🔑 **Μπλοκ και αξίωση στην ΙΔΙΑ εγγραφή**: η ισχύς του ΠΕΑ ζει στο κανάλι νομιμότητας (ADR-838) — δύο εγγραφές θα
 * άφηναν παράθυρο όπου η αγγελία δείχνει νέα κλάση με την αξίωση της παλιάς.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import {
  applyEnergyCertificatePatch,
  type EnergyCertificatePatch,
} from '@/lib/energy-certificate/energy-certificate';
import {
  energyIssuedOnContradicts,
  withEnergyPerformanceClaim,
} from '@/lib/energy-certificate/energy-certificate-claim';
import type { ListingActor } from '@/lib/owner-property/listing-custody';
import { createModuleLogger } from '@/lib/telemetry';
import { ownerPeaFileScope, peaSourceFacts } from '@/server/energy-certificate/energy-certificate-file-scope';
import { amendOwnerProperty } from '@/services/owner-property/owner-property-amendment';
import type { OwnerPropertyWriteResult } from '@/services/owner-property/owner-property-write-result';

const logger = createModuleLogger('owner-property-energy-certificate.service');

/** **Το ΠΕΑ** σε υπάρχουσα αγγελία ιδιώτη. Η διόρθωση έχει ήδη περάσει το `energyCertificatePatchSchema`. */
export function setOwnerPropertyEnergyCertificate(
  adminDb: AdminFirestore,
  ownerPropertyId: string,
  patch: EnergyCertificatePatch,
  actor: ListingActor,
): Promise<OwnerPropertyWriteResult> {
  return amendOwnerProperty(adminDb, {
    ownerPropertyId,
    actor,
    logger,
    failureMessage: 'Το ενεργειακό πιστοποιητικό δεν αποθηκεύτηκε',
    // ADR-915 Φ3β-2 — τα γεγονότα του αρχείου-πηγής διαβάζονται ΕΚΤΟΣ συναλλαγής: ανήκουν σε αμετάβλητα bytes, και
    // σε επανάληψη η ανάγνωση απλώς ξαναγίνεται (καμία παρενέργεια).
    amend: async (existing, at) => {
      const energy = applyEnergyCertificatePatch(existing.energy, patch);
      const facts = await peaSourceFacts(adminDb, ownerPeaFileScope(actor.uid, existing), energy);
      if (energyIssuedOnContradicts(energy, facts)) {
        return {
          kind: 'refuse',
          result: { kind: 'invalid-energy-certificate', violations: ['issued-on-contradicts-document'] },
        };
      }
      return {
        kind: 'amend',
        fields: { energy, legality: withEnergyPerformanceClaim(existing.legality, energy, existing.id, at, facts) },
      };
    },
  });
}
