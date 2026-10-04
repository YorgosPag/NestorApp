/**
 * @module services/places/public-unit-write
 * @description **Η ΜΟΝΗ ΠΟΡΤΑ ΓΡΑΦΗΣ της δημόσιας μονάδας** (`public_units`, ADR-900 §8 #2, 2β.4).
 *
 * 🔑 **Δύο φάσεις, όπως οι κλειδαριές κατοχής** (`ownership-claim-locks.ts`): το Firestore θέλει **όλες** τις
 * αναγνώσεις μιας συναλλαγής πριν από κάθε εγγραφή. Άρα `readPublicUnitSlot` (αναγνώσεις) → κρίση →
 * `writePublicUnit` (εγγραφή). Τις καλεί **μόνο** το `ownership-claim-locks.ts`, μέσα στην **ίδια** συναλλαγή με
 * τις κλειδαριές ΚΑΕΚ/ΑΦΜ — άρα και οι δύο δρόμοι προς `verified` (αυτόματη κρίση · ουρά ελέγχου) γεννούν τη
 * μονάδα από **ένα** σημείο, ατομικά με την απόδειξη: καμία απόδειξη χωρίς μονάδα, καμία μονάδα χωρίς απόδειξη.
 *
 * Η αλυσίδα επαναχρησιμοποιεί ό,τι υπάρχει (καμία δεύτερη αλήθεια): δήλωση (`ownerPropertyFromDocument`) →
 * σύνθεση (`composePlaceUnitRef`, ΚΑΕΚ μόνο `verified` + `/Κ/Ο`) → κλειδί (`placeUnitKey`, `cadastral`) →
 * σπόρος HMAC (`publicUnitSeed`) → ταυτότητα (`generateDeterministicPublicUnitId`) → γεγονότα (`public-unit-facts`).
 *
 * ⚠️ Όπως τα αδέλφια (`public-place-write.service.ts`): **καμία** ταυτότητα χρήστη δεν γράφεται εδώ — η
 * συλλογή είναι `read: if true`. Η διαφωνία δεσμού πάει σε **log**, όχι στο έγγραφο.
 */

import 'server-only';

import type { DocumentReference, Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { composePlaceUnitRef } from '@/lib/geo/place-unit';
import { placeUnitKey } from '@/lib/geo/place-unit-key.server';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import {
  mergeIntoUnit,
  newPublicUnit,
  publicUnitFactsOf,
  retireUnit,
  type PublicUnitFacts,
} from '@/lib/places/public-unit-facts';
import { createModuleLogger } from '@/lib/telemetry';
import { publicUnitSeed } from '@/server/places/public-unit-seed';
import { generateDeterministicPublicUnitId } from '@/services/enterprise-id.service';
import type { PublicUnit } from '@/types/geo/public-place';

const logger = createModuleLogger('public-unit-write');

/** Ό,τι διάβασε η συναλλαγή. `none` = αυτή η απόδειξη **δεν** γεννά μονάδα (και αυτό δεν είναι σφάλμα). */
export type PublicUnitSlot =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'unit';
      readonly ref: DocumentReference;
      readonly facts: PublicUnitFacts;
      readonly existing: PublicUnit | null;
    };

const NO_UNIT: PublicUnitSlot = { kind: 'none' };

/**
 * Οι αναγνώσεις — **μέσα** στη συναλλαγή, πριν από κάθε εγγραφή. `kaek` = ο κανονικός ΚΑΕΚ που **θα**
 * επαληθευτεί· ο έλεγχος «ιδιοκτησία `/Κ/Ο`, όχι γεωτεμάχιο» γίνεται από τον `composePlaceUnitRef`.
 */
export async function readPublicUnitSlot(
  db: AdminFirestore,
  tx: Transaction,
  ownerPropertyId: string,
  kaek: string | null,
): Promise<PublicUnitSlot> {
  if (kaek === null) return NO_UNIT;
  const propertySnap = await tx.get(db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(ownerPropertyId));
  const property = ownerPropertyFromDocument(propertySnap.data(), ownerPropertyId);
  if (property === null) return NO_UNIT;

  const unitRef = composePlaceUnitRef(property, { status: 'verified', kaek });
  const facts = unitRef === null ? null : publicUnitFactsOf(unitRef);
  if (unitRef === null || facts === null) return NO_UNIT;
  // Το μυστικό ζητείται ΜΟΝΟ όταν όντως γεννιέται μονάδα (fail-closed εκεί, πουθενά αλλού).
  const key = placeUnitKey(unitRef);
  const seed = key === null ? null : publicUnitSeed(key);
  if (seed === null) return NO_UNIT;

  const ref = db.collection(COLLECTIONS.PUBLIC_UNITS).doc(generateDeterministicPublicUnitId(seed));
  const snap = await tx.get(ref);
  return { kind: 'unit', ref, facts, existing: snap.exists ? (snap.data() as PublicUnit) : null };
}

/** Η εγγραφή — γέννηση ή νέα βεβαίωση της **ίδιας** μονάδας (κύκλος UPRN). */
export function writePublicUnit(tx: Transaction, slot: PublicUnitSlot, at: string): void {
  if (slot.kind === 'none') return;
  if (slot.existing === null) {
    tx.set(slot.ref, newPublicUnit(slot.ref.id, slot.facts, at));
    return;
  }
  const merged = mergeIntoUnit(slot.existing, slot.facts, at);
  if (merged.linkDisagreement) {
    // Ο δεσμός ΔΕΝ ξαναγράφεται από δήλωση· το κρίνει ο θεματοφύλακας (σχήμα Address Custodian του UPRN).
    logger.warn('unit-link-disagreement', { data: { unitId: slot.ref.id } });
  }
  tx.set(slot.ref, merged.unit);
}

/**
 * Η απόσυρση — `historical`, **ποτέ** διαγραφή (κύκλος UPRN). Την καλεί **μόνο** η ανάκληση
 * (`ownership-claim-locks.ts` → `releaseClaimLocks`), όταν έπεσε η **τελευταία** έγκυρη βεβαίωση του ΚΑΕΚ.
 * Μονάδα που δεν γεννήθηκε ποτέ ή είναι ήδη ιστορική ⇒ τίποτα (ιδεμποτία). Επιστρέφει αν **όντως** αποσύρθηκε.
 */
export function retirePublicUnit(tx: Transaction, slot: PublicUnitSlot, at: string): boolean {
  if (slot.kind === 'none' || slot.existing === null || slot.existing.status === 'historical') return false;
  tx.set(slot.ref, retireUnit(slot.existing, at));
  return true;
}
