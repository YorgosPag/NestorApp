import 'server-only';

/**
 * @fileoverview **«Τι θα παραδοθεί — και ποιος οφείλει την επόμενη κίνηση;»** — οι παραδόσεις ενός ακινήτου, κριμένες για το
 *   γραφείο, και τα αρχεία του (ADR-916 §5.1 · §5.15 Φ-Δ).
 * @related property-handover-set.server.ts (η ΜΙΑ σύνθεση — την ίδια διαβάζει και ο εκτελεστής της αντιγραφής) ·
 *          lib/property-handover/handover-office-status.ts (η ΜΙΑ κρίση της καρτέλας)
 * @module services/property-handover/property-handover-preview.server
 *
 * 🔑 **Καμία δική της κρίση**: ό,τι δείχνει εδώ στο γραφείο είναι **ακριβώς** ό,τι θα αντιγράψει ο εκτελεστής
 * (`loadHandoverSet`) — η όψη και η πράξη δεν μπορούν να διαφωνήσουν (ADR-916 Φ-Γ1, άγκυρα Γ13). Το ίδιο για την
 * κατάσταση: `handoverOfficeStatusOf` συνθέτει τις **ίδιες** κρίσεις με τη μηχανή.
 *
 * 🔒 **Ελάχιστα προς τα έξω**: από την επαφή του αγοραστή η πόρτα προσθέτει **μόνο** ονοματεπώνυμο (ποτέ τηλέφωνο · ΑΦΜ)·
 *    για τη σφραγίδα μόνο «ρυθμίστηκε;» (ποτέ τα ονόματα των μεταβλητών που λείπουν). Η πόρτα είναι **μόνο** του γραφείου
 *    (`properties:properties:view`, ίδιος μισθωτής).
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { propertyHandoverSnapshotOf, type PropertyHandoverSnapshot } from '@/lib/property-handover/handover-plan';
import { handoverOfficeStatusOf } from '@/lib/property-handover/handover-office-status';
import { propertyHandoverFromDocument } from '@/lib/property-handover/property-handover-from-document';
import { sealConfigurationOf } from '@/server/pdf-seal/seal-config.server';
import { readDeliveredRows, type HandoverLedgerProof } from '@/server/property-handover-delivery/handover-delivery-ledger.server';
import type { PropertyHandover, PropertyHandoverOfficeEntry, PropertyHandoverPreview } from '@/types/property-handover';

import { handoverRecipientNamesOf } from './property-handover-recipient-name.server';
import { handoverSetPreviewFiles, loadHandoverSet, type HandoverSet } from './property-handover-set.server';
import { handoverUnprovenLinesOf } from './property-handover-unproven-lines.server';
import { propertyHandoversQuery } from './property-handover-write.service';

async function readSnapshot(adminDb: AdminFirestore, propertyId: string): Promise<PropertyHandoverSnapshot | null> {
  const snap = await adminDb.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
  return snap.exists ? propertyHandoverSnapshotOf(propertyId, snap.data() ?? {}) : null;
}

/**
 * Φ-Δ.4 — οι πηγές που **έχουν** παραδοθεί, σε οποιαδήποτε παράδοση. Το **ίδιο** ερώτημα καθολικού με τον εκτελεστή
 * (`readDeliveredRows`, ήδη με δείκτη) — λίγες παραδόσεις ανά ακίνητο (μία ανά ιδιοκτήτη, Δ6).
 */
async function ledgersOf(adminDb: AdminFirestore, handovers: readonly PropertyHandover[]): Promise<ReadonlyMap<string, readonly HandoverLedgerProof[]>> {
  const rows = await Promise.all(handovers.map((handover) => readDeliveredRows(adminDb, handover)));
  return new Map(handovers.map((handover, i) => [handover.id, rows[i] ?? []]));
}

/** Το όνομα κάθε πηγής του συνόλου, όπως το βλέπει το γραφείο — για τις γραμμές χωρίς απόδειξη (Φ-Δ.7γ). */
function setNamesOf(set: HandoverSet): ReadonlyMap<string, string> {
  return new Map([...set.deliver, ...set.review, ...set.internal].map((file) => [file.doc.id, file.preview.displayName]));
}

/** `null` ⇒ το ακίνητο δεν υπάρχει ή δεν ανήκει στον μισθωτή (ο καλών απαντά 404). */
export async function previewPropertyHandover(
  adminDb: AdminFirestore,
  companyId: string,
  propertyId: string,
): Promise<PropertyHandoverPreview | null> {
  const [set, handoverSnap, snapshot] = await Promise.all([
    loadHandoverSet(adminDb, companyId, propertyId),
    propertyHandoversQuery(adminDb, companyId, propertyId).get(),
    readSnapshot(adminDb, propertyId),
  ]);
  if (set === null) return null;
  const handovers = handoverSnap.docs.flatMap((doc) => {
    const handover = propertyHandoverFromDocument(doc.data(), doc.id);
    return handover ? [handover] : [];
  });
  const recipientNames = await handoverRecipientNamesOf(adminDb, companyId, handovers.map((h) => h.recipientContactId));
  const ledgers = await ledgersOf(adminDb, handovers);
  const deliveredSourceIds = new Set([...ledgers.values()].flat().map((row) => row.sourceFileId));
  const names = setNamesOf(set);
  const sealConfigured = sealConfigurationOf(process.env).kind === 'configured';
  const context = { snapshot, sealConfigured, nowValue: nowISO() };
  const entries = await Promise.all(handovers.map(async (handover): Promise<PropertyHandoverOfficeEntry> => ({
    handover,
    recipientName: recipientNames.get(handover.recipientContactId) ?? null,
    status: handoverOfficeStatusOf(handover, context),
    unprovenLines: await handoverUnprovenLinesOf(adminDb, handover, ledgers.get(handover.id) ?? [], names),
  })));
  return { handovers: entries, seal: { configured: sealConfigured }, files: handoverSetPreviewFiles(set, deliveredSourceIds) };
}
