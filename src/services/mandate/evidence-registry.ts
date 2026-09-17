/**
 * @fileoverview **ΤΟ ΜΗΤΡΩΟ ΤΩΝ ΠΑΓΩΜΕΝΩΝ ΑΠΟΔΕΙΚΤΙΚΩΝ** — γέννηση εγγραφής, ανάγνωση, μετάβαση (ADR-864 §20).
 * @related types/mandate-evidence-record.ts · services/mandate/attestation-evidence.ts ·
 *   services/mandate/evidence-retention.service.ts
 * @module services/mandate/evidence-registry
 *
 * 🔑 **Ιδεμποτητική γέννηση** (`create` + «υπάρχει ήδη» = επιτυχία): τη γράφουν **δύο** δρόμοι — η σφράγιση
 * μετά την εγγραφή της βεβαίωσης (κύριος) και η **υιοθεσία** από τη σάρωση του bucket (δίχτυ, για κατάρρευση
 * ανάμεσα στην εγγραφή και τη σφράγιση). Δεύτερη κλήση **δεν** ξαναγράφει κατάσταση που ήδη προχώρησε.
 *
 * ⛔ Συλλογή **μόνο διακομιστή** (`firestore.rules`: read/write false). **Layering**: server-only.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { EvidenceRetentionView } from '@/lib/mandate/mandate-evidence';
import { createModuleLogger } from '@/lib/telemetry';
import type { MandateEvidenceRecord } from '@/types/mandate-evidence-record';
import { MANDATE_EVIDENCE_STATES } from '@/types/mandate-evidence-record';
import type { AttestationEvidence } from '@/types/owner-property-mandate';

const logger = createModuleLogger('evidence-registry');

/** gRPC `ALREADY_EXISTS` — το `create` σε υπάρχον έγγραφο. */
const ALREADY_EXISTS = 6;

export interface EvidenceCustody {
  readonly ownerPropertyId: string;
  readonly agencyCompanyId: string;
  readonly sealedAt: string;
}

const registry = (adminDb: AdminFirestore) => adminDb.collection(COLLECTIONS.MANDATE_EVIDENCE);

export function sealedEvidenceRecord(evidence: AttestationEvidence, custody: EvidenceCustody): MandateEvidenceRecord {
  return {
    id: evidence.id,
    ownerPropertyId: custody.ownerPropertyId,
    agencyCompanyId: custody.agencyCompanyId,
    path: evidence.path,
    digest: evidence.digest,
    sizeBytes: evidence.sizeBytes,
    contentType: evidence.contentType,
    fileName: evidence.fileName,
    sealedAt: custody.sealedAt,
    state: 'sealed',
    relationshipEndedAt: null,
    retainUntil: null,
    ruleId: null,
    legalHold: null,
    disposedAt: null,
  };
}

/** Γέννηση εγγραφής — `true` αν υπάρχει μετά την κλήση (νέα **ή** ήδη υπαρκτή). Ποτέ δεν ρίχνει. */
export async function registerSealedEvidence(
  adminDb: AdminFirestore,
  evidence: AttestationEvidence,
  custody: EvidenceCustody,
): Promise<boolean> {
  try {
    await registry(adminDb).doc(evidence.id).create(sealedEvidenceRecord(evidence, custody));
    return true;
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === ALREADY_EXISTS) return true;
    logger.error('Το αποδεικτικό δεν μπήκε στο μητρώο', {
      data: { evidenceId: evidence.id, ownerPropertyId: custody.ownerPropertyId },
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/** Το σύνορο ανάγνωσης: έγγραφο → εγγραφή, ή `null` για ό,τι δεν είναι εγγραφή μητρώου. */
export function evidenceRecordFromDocument(data: unknown, id: string): MandateEvidenceRecord | null {
  if (data === null || typeof data !== 'object') return null;
  const record = data as Partial<MandateEvidenceRecord>;
  const known = (MANDATE_EVIDENCE_STATES as readonly string[]).includes(String(record.state));
  if (!known || typeof record.agencyCompanyId !== 'string' || typeof record.ownerPropertyId !== 'string' || typeof record.path !== 'string') return null;
  return {
    ...(record as MandateEvidenceRecord),
    id,
    relationshipEndedAt: record.relationshipEndedAt ?? null,
    retainUntil: record.retainUntil ?? null,
    ruleId: record.ruleId ?? null,
    legalHold: record.legalHold ?? null,
    disposedAt: record.disposedAt ?? null,
  };
}

/** Οι εγγραφές που **δεν** έχουν διατεθεί — ό,τι μπορεί ακόμη να χρειάζεται βήμα. */
export async function readLiveEvidenceRecords(adminDb: AdminFirestore, limit: number): Promise<{ readonly records: readonly MandateEvidenceRecord[]; readonly truncated: boolean }> {
  // tenant-scope-exempt: καθολική σάρωση συντήρησης από cron (Admin SDK). Η διατήρηση είναι υποχρέωση του
  // ΦΟΡΕΑ προς κάθε ιδιοκτήτη, όχι λειτουργία ενός γραφείου — το πέρασμα οφείλει να δει κάθε αποδεικτικό.
  // Καμία απάντηση δεν φεύγει προς πελάτη.
  // Δύο ερωτήματα ισότητας αντί για `in`: κανένας σύνθετος δείκτης, και το όριο ισχύει ανά κατάσταση.
  const snapshots = await Promise.all((['sealed', 'retained'] as const).map((state) => registry(adminDb).where('state', '==', state).limit(limit + 1).get()));
  const records = snapshots
    .flatMap((snapshot) => snapshot.docs.slice(0, limit))
    .map((doc) => evidenceRecordFromDocument(doc.data(), doc.id))
    .filter((record): record is MandateEvidenceRecord => record !== null);
  return { records, truncated: snapshots.some((snapshot) => snapshot.docs.length > limit) };
}

/** Οι εγγραφές ενός ακινήτου — για την οθόνη («διατηρείται έως»). */
export async function readEvidenceRecordsOfProperty(adminDb: AdminFirestore, ownerPropertyId: string): Promise<readonly MandateEvidenceRecord[]> {
  // tenant-scope-exempt: ανάγνωση ΓΟΝΕΑ — «τα αποδεικτικά ΑΥΤΟΥ του ακινήτου», αφού ο καλών έχει ήδη κριθεί
  // μέρος της εντολής (`mandatesPartyTo`)· η οθόνη φιλτράρει ξανά ανά ορατό αποδεικτικό.
  const snapshot = await registry(adminDb).where('ownerPropertyId', '==', ownerPropertyId).get();
  return snapshot.docs
    .map((doc) => evidenceRecordFromDocument(doc.data(), doc.id))
    .filter((record): record is MandateEvidenceRecord => record !== null);
}

/** «Ως πότε» ανά αποδεικτικό ενός ακινήτου — η είσοδος του `evidenceViewOf`. Αποτυχία ανάγνωσης ⇒ κενός χάρτης (η οθόνη λέει τον κανόνα). */
export async function retainUntilByEvidenceOf(adminDb: AdminFirestore, ownerPropertyId: string): Promise<ReadonlyMap<string, EvidenceRetentionView>> {
  try {
    const records = await readEvidenceRecordsOfProperty(adminDb, ownerPropertyId);
    return new Map(records.map((record) => [record.id, { retainUntil: record.retainUntil, disposedAt: record.disposedAt }]));
  } catch (error) {
    logger.warn('Το μητρώο αποδεικτικών δεν διαβάστηκε — η οθόνη δείχνει τον κανόνα', { data: { ownerPropertyId }, error: error instanceof Error ? error.message : String(error) });
    return new Map();
  }
}

export type EvidenceRecordPatch = Partial<Pick<MandateEvidenceRecord, 'state' | 'relationshipEndedAt' | 'retainUntil' | 'ruleId' | 'legalHold' | 'disposedAt'>>;

export async function updateEvidenceRecord(adminDb: AdminFirestore, id: string, patch: EvidenceRecordPatch): Promise<void> {
  await registry(adminDb).doc(id).update(patch);
}
