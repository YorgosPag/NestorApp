import 'server-only';

/**
 * @fileoverview **«Ποιες γραμμές δεν αποδείχτηκαν — και κλείνει καμία;»** — η λίστα της καρτέλας «Παράδοση» για τον λόγο
 *               `unverifiable-rows` (ADR-916 §5.23 Φ-Δ.7γ).
 * @related lib/property-handover/handover-line-closure.ts (η ΙΔΙΑ κρίση με την πόρτα) ·
 *          server/property-handover-delivery/handover-delivery-evidence.server.ts (η ΙΔΙΑ μέτρηση με την πόρτα)
 * @module services/property-handover/property-handover-unproven-lines.server
 *
 * 🔑 **Κανένα κουμπί που η πόρτα θα αρνιόταν**: η καρτέλα μετρά με τον **ίδιο** κώδικα και κρίνει με την **ίδια** συνάρτηση.
 * 💰 **Μετρά μόνο όταν έχει νόημα**: όταν ο κατακερματισμός έχει ήδη βρει μη επαληθεύσιμη γραμμή (`unverifiable > 0`) — όχι σε
 *    κάθε φρέσκια παράδοση που απλώς περιμένει τη σειρά της — και ως `HANDOVER_LINE_CLOSURE_PROBE_LIMIT` γραμμές.
 * 🛡️ Σφάλμα μέτρησης μιας γραμμής ⇒ `recovering` (καμία προσφορά): «δεν ξέρω» δεν γίνεται ποτέ κουμπί «Κλείσιμο».
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { HANDOVER_LINE_CLOSURE_PROBE_LIMIT } from '@/config/property-handover-delivery-policy';
import { handoverLineClosureOfferOf } from '@/lib/property-handover/handover-line-closure';
import { candidatesOf, probeDeliveredRow } from '@/server/property-handover-delivery/handover-delivery-evidence.server';
import type { HandoverLedgerProof } from '@/server/property-handover-delivery/handover-delivery-ledger.server';
import type { PropertyHandover } from '@/types/property-handover';
import type { HandoverLineEvidence, HandoverUnprovenLine } from '@/types/property-handover-line-closure';

/** Οι γραμμές που αξίζει να μετρηθούν — ανοιχτές, χωρίς sha256, με σταθερή σειρά (ίδια με τον κατακερματισμό). */
function unprovenRowsOf(handover: PropertyHandover, rows: readonly HandoverLedgerProof[]): readonly HandoverLedgerProof[] {
  if ((handover.fileDelivery?.unverifiable ?? 0) === 0) return [];
  return rows
    .filter((row) => row.sha256 === null && row.closure === null)
    .sort((a, b) => a.sourceFileId.localeCompare(b.sourceFileId))
    .slice(0, HANDOVER_LINE_CLOSURE_PROBE_LIMIT);
}

/**
 * **Οι γραμμές χωρίς απόδειξη μιας παράδοσης**, με την προσφορά της καθεμίας. `names` = όνομα πηγής όπως το βλέπει το γραφείο
 * (λείπει ⇒ `null`, το αναγνωριστικό αρκεί).
 */
export async function handoverUnprovenLinesOf(
  adminDb: AdminFirestore,
  handover: PropertyHandover,
  rows: readonly HandoverLedgerProof[],
  names: ReadonlyMap<string, string>,
): Promise<readonly HandoverUnprovenLine[]> {
  const unproven = unprovenRowsOf(handover, rows);
  if (unproven.length === 0 || handover.recipient === null) return [];
  const candidates = await candidatesOf({ adminDb, handover, recipientUserId: handover.recipient.userId }, unproven);
  return Promise.all(unproven.map(async (row): Promise<HandoverUnprovenLine> => {
    const evidence = await probeDeliveredRow(row, candidates.get(row.sourceFileId) ?? [])
      .catch((): HandoverLineEvidence => ({ kind: 'recovering' }));
    return {
      sourceFileId: row.sourceFileId, name: names.get(row.sourceFileId) ?? null, size: row.size, deliveredAt: row.deliveredAt,
      offer: handoverLineClosureOfferOf(handover, evidence),
    };
  }));
}
