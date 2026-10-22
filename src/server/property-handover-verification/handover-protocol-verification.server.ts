/**
 * @fileoverview **Η ΠΟΡΤΑ ΕΠΑΛΗΘΕΥΣΗΣ — Η ΑΝΑΓΝΩΣΗ ΤΟΥ ΜΗΤΡΩΟΥ** (ADR-916 Φ-Γ2 Σ6).
 * @module server/property-handover-verification/handover-protocol-verification.server
 * @related lib/property-handover/handover-protocol-verification.ts (η κρίση) ·
 *          app/api/handover-protocols/[protocolId]/verification/route.ts (η διαδρομή)
 *
 * 🔑 **Δύο αναγνώσεις κατά ταυτότητα, κανένα ερώτημα** ⇒ κανένας δείκτης Firestore: το πρωτόκολλο (`phpr`, από το QR ή το
 *    manifest) και η παράδοσή του (ο δείκτης στην **τελευταία** αναθεώρηση). Και οι δύο από τα σύνορά τους (CHECK 3.74).
 * 🔒 **Δημόσιο μητρώο εκδότη, όχι ανάγνωση ενοικιαστή**: η ταυτότητα `phpr` είναι uuid v4 που τυπώνεται **μόνο** στο ίδιο
 *    το Πρωτόκολλο· η απάντηση κρατά όσα τυπώνει ήδη το χαρτί (αναθεώρηση · ημερομηνία · πλήθος · αποτύπωμα) και **κανένα**
 *    όνομα, εταιρεία ή ακίνητο. Γι' αυτό καμία συνθήκη `companyId`: ο τρίτος δεν έχει χώρο εργασίας.
 * ⚠️ Αλλοιωμένο έγγραφο ⇒ `unknown`, ποτέ σφάλμα προς τα έξω.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { propertyHandoverFromDocument } from '@/lib/property-handover/property-handover-from-document';
import { propertyHandoverProtocolFromDocument } from '@/lib/property-handover/property-handover-protocol-from-document';
import { registryAnswerOf, type HandoverProtocolRegistryAnswer } from '@/lib/property-handover/handover-protocol-verification';

/** **Ρωτά το μητρώο** για ένα πρωτόκολλο — και, αν δόθηκε, για **αυτά** τα bytes. */
export async function readHandoverProtocolRegistryAnswer(
  adminDb: AdminFirestore,
  protocolId: string,
  pdfSha256: string | null,
): Promise<HandoverProtocolRegistryAnswer> {
  const snap = await adminDb.collection(COLLECTIONS.PROPERTY_HANDOVER_PROTOCOLS).doc(protocolId).get();
  const protocol = propertyHandoverProtocolFromDocument(snap.data(), protocolId);
  if (protocol === null) return registryAnswerOf(null, null, pdfSha256);
  const handoverSnap = await adminDb.collection(COLLECTIONS.PROPERTY_HANDOVERS).doc(protocol.handoverId).get();
  const handover = propertyHandoverFromDocument(handoverSnap.data(), protocol.handoverId);
  // Παράδοση άλλου μισθωτή στο ίδιο id ⇒ ο δείκτης δεν μετρά: «τρέχον» μόνο από τη ΔΙΚΗ του παράδοση.
  const latest = handover !== null && handover.companyId === protocol.companyId ? handover.protocol : null;
  return registryAnswerOf(protocol, latest, pdfSha256);
}
