import 'server-only';

/**
 * @fileoverview **Τα αρχεία που οφείλονται, μετά το commit του γραφέα** (ADR-916 Φ-Γ1 · Φ-Δ.4).
 * @related property-handover-write.service.ts (ο ΕΝΑΣ γραφέας — τον καλεί και του δίνει τον καταγραφέα προόδου) ·
 *          server/property-handover-delivery (ο εκτελεστής της αντιγραφής)
 * @module services/property-handover/property-handover-delivery-trigger
 *
 * Εξήχθη από τον γραφέα (N.7.1 — 490/500 γραμμές), **χωρίς** αλλαγή συμπεριφοράς: ο γραφέας εξακολουθεί να αποφασίζει
 * **πότε**, εδώ ζει μόνο το **πώς** (πρώτο κομμάτι + εκδότης Πρωτοκόλλου). Ο καταγραφέας προόδου έρχεται ως όρισμα ⇒
 * κανένας κύκλος εισαγωγών με τον γραφέα, και ο εκτελεστής **δεν** αγγίζει ποτέ τη συλλογή.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { HANDOVER_DELIVERY_INLINE_FILE_BUDGET, HANDOVER_DELIVERY_INLINE_HASH_BYTE_BUDGET } from '@/config/property-handover-delivery-policy';
import { fileDeliveryStateOf } from '@/lib/property-handover/handover-delivery-plan';
import {
  deliverHandoverFiles,
  type HandoverFileDeliveryRecorder,
  type HandoverProtocolIssuer,
} from '@/server/property-handover-delivery/handover-delivery.server';
import { releaseUnowedHandoverPreservation } from '@/server/property-handover-delivery/handover-delivery-preservation.server';
import type { PropertyHandover } from '@/types/property-handover';

export interface DueHandoverFilesOptions {
  /**
   * Ξανακοίτα και τις **παραδομένες**: το νυχτερινό δίχτυ (ένα νέο παραδοτέο αρχείο, Δ5, φτάνει μόνο του) και η απόφαση
   * γραφείου ανά αρχείο (Φ-Δ.4 — το «Παραδίδεται» φτάνει τώρα, και το «θέλουν απόφαση» μετριέται ξανά τώρα).
   */
  readonly rescanDelivered: boolean;
  /** Ο εκδότης Πρωτοκόλλου της εκτέλεσης του καλούντα· απών ⇒ ανοίγει δική του, **μόνο** αν κάποια παράδοση τρέξει. */
  readonly protocolIssuer?: HandoverProtocolIssuer;
}

/**
 * Φ-Γ2 Σ4 — η **δική** της εκτέλεση έκδοσης, για συμφιλίωση χωρίς εκδότη από τον καλούντα. ⚠️ **Δυναμική** εισαγωγή, επίτηδες:
 * (α) ο γραφέας του πρωτοκόλλου εισάγει τον γραφέα της παράδοσης (δείκτης · ίχνος) — στατική εισαγωγή θα έκλεινε κύκλο·
 * (β) φέρνει jsPDF + pdf-lib + κρυπτογραφία, που **δεν** χρειάζεται κάθε PATCH ακινήτου.
 */
async function openOwnProtocolRun(adminDb: AdminFirestore): Promise<{ readonly issue: HandoverProtocolIssuer; finish(): number }> {
  const { openHandoverProtocolRun } = await import('./property-handover-protocol-write.service');
  return openHandoverProtocolRun(adminDb);
}

/**
 * **Φ-Γ1 — τα αρχεία που οφείλονται**, ένα πρώτο κομμάτι (`HANDOVER_DELIVERY_INLINE_FILE_BUDGET`)· το cron συνεχίζει.
 */
export async function deliverDueHandoverFiles(
  adminDb: AdminFirestore,
  handovers: readonly PropertyHandover[],
  options: DueHandoverFilesOptions,
  record: HandoverFileDeliveryRecorder,
): Promise<void> {
  // Φ-Δ.7α — ό,τι ΔΕΝ οφείλεται πια (ανάκληση · ακύρωση) αφήνει τις πηγές του: αμέσως μετά την πράξη ΚΑΙ κάθε νύχτα (δίχτυ).
  for (const handover of handovers) {
    if (fileDeliveryStateOf(handover) === null) await releaseUnowedHandoverPreservation(adminDb, handover);
  }
  const due = handovers.filter((handover) => {
    const state = fileDeliveryStateOf(handover);
    return state !== null && (state !== 'delivered' || options.rescanDelivered);
  });
  if (due.length === 0) return;
  const own = options.protocolIssuer === undefined ? await openOwnProtocolRun(adminDb) : null;
  const issue = options.protocolIssuer ?? own?.issue ?? null;
  const budget = { maxFiles: HANDOVER_DELIVERY_INLINE_FILE_BUDGET, deadlineAt: null, maxHashBytes: HANDOVER_DELIVERY_INLINE_HASH_BYTE_BUDGET };
  try {
    for (const handover of due) await deliverHandoverFiles(adminDb, handover, budget, record, issue);
  } finally {
    own?.finish();
  }
}
