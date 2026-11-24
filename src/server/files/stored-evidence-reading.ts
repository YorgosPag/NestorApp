/**
 * =============================================================================
 * Η ΑΠΟΘΗΚΕΥΜΕΝΗ ΑΝΑΓΝΩΣΗ ενός αρχείου επαφής + η ΜΙΑ συναλλαγή των αποφάσεων πάνω της (ADR-950 §4.5 · §10)
 * =============================================================================
 *
 * Κοινό έδαφος των δύο γραφέων αποφάσεων («Αγνοήσεις» · «Διορθώσεις ανάγνωσης»): **ίδια** ανάγνωση από τον δίσκο,
 * **ίδιοι** έλεγχοι κατόχου, **ίδιος** κανόνας «μόνο το πεδίο, ποτέ `updatedAt`».
 *
 * 🔑 Η ανάγνωση βγαίνει σε **δύο** μορφές: `machine` (ό,τι διάβασε η AI + τα τεκμήριά της) και `reading` (η ίδια με τις
 *    διορθώσεις του ανθρώπου από πάνω — ό,τι δείχνει ο πίνακας). Το κλειδί μιας «Αγνόησης» υπολογίζεται στη **δεύτερη**,
 *    ώστε διακομιστής και οθόνη να μιλούν για την ίδια τιμή.
 * 🔴 **ΠΟΤΕ `updatedAt` / `revision`**: η απόφαση **περιγράφει** την ανάγνωση, δεν αλλάζει τα bytes· αλλιώς κάθε
 *    αποτύπωμα ελέγχου μεταβίβασης του αρχείου θα γινόταν σιωπηλά «μη τρέχον».
 *
 * @module server/files/stored-evidence-reading
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import type { EvidenceReading } from '@/lib/contacts/contact-evidence-comparison';
import {
  applyEvidenceCorrections,
  EVIDENCE_CORRECTIONS_FIELD,
  readEvidenceCorrections,
} from '@/lib/contacts/contact-evidence-corrections';
import { isPlainRecord } from '@/lib/type-guards';
import {
  DocumentEvidenceFieldSchema,
  EvidenceAddressVerificationSchema,
  EvidenceFieldConsensusSchema,
} from '@/schemas/ai-analysis';
import type { EvidenceCorrection } from '@/types/file-record';

export type StoredFileData = Record<string, unknown>;

export interface StoredEvidenceReading {
  /** Ό,τι διάβασε η μηχανή, με τα τεκμήρια διακομιστή. */
  readonly machine: EvidenceReading;
  /** Η ίδια ανάγνωση με τις διορθώσεις του ανθρώπου — ό,τι βλέπει ο πίνακας. */
  readonly reading: EvidenceReading;
  readonly purpose: string | null;
  readonly corrections: readonly EvidenceCorrection[];
}

const StoredEvidenceFieldsSchema = z.array(DocumentEvidenceFieldSchema);
const StoredConsensusSchema = z.array(EvidenceFieldConsensusSchema);

/**
 * ⚠️ Κρίνει **μόνο** τα πεδία της ανάγνωσης, όχι όλη την ανάλυση: ο δίσκος κρατά `aiModel: null` /
 * `description: null` (γράφει ο `classify-background`), που το πλήρες σχήμα θα απέρριπτε ⇒ καμία απόφαση ποτέ.
 */
function machineReadingOf(data: StoredFileData): { readonly machine: EvidenceReading; readonly purpose: string | null } {
  const analysis = isPlainRecord(data.ingestion) ? data.ingestion.analysis : undefined;
  if (!isPlainRecord(analysis)) return { machine: { fields: [] }, purpose: null };
  const fields = StoredEvidenceFieldsSchema.safeParse(analysis.fields);
  const purpose = typeof analysis.evidencePurpose === 'string' ? analysis.evidencePurpose : null;
  // ADR-950 §8 — τα τεκμήρια αλλάζουν το κλειδί (διορθωμένη οδός · διαφωνία ψηφίου): ίδια είσοδος με τον πίνακα.
  const consensus = StoredConsensusSchema.safeParse(analysis.fieldConsensus);
  const verification = EvidenceAddressVerificationSchema.safeParse(analysis.addressVerification);
  return {
    machine: {
      fields: fields.success ? fields.data : [],
      ...(consensus.success ? { fieldConsensus: consensus.data } : {}),
      ...(verification.success ? { addressVerification: verification.data } : {}),
    },
    purpose,
  };
}

/** Η αποθηκευμένη ανάγνωση: μηχανή · διορθώσεις · και οι δύο μαζί. Άκυρη ⇒ κενή. */
export function storedEvidenceReading(data: StoredFileData): StoredEvidenceReading {
  const { machine, purpose } = machineReadingOf(data);
  const corrections = readEvidenceCorrections(data[EVIDENCE_CORRECTIONS_FIELD]);
  return { machine, reading: applyEvidenceCorrections(machine, purpose, corrections), purpose, corrections };
}

export type ContactFileRefusal = { readonly kind: 'not-found' } | { readonly kind: 'not-a-contact-file' };

/** Η κρίση του γραφέα πάνω στο έγγραφο: η έκβαση, και — αν γράφει — **ποιο** πεδίο με ποια τιμή. */
export interface ContactFileDecision<TOutcome> {
  readonly outcome: TOutcome;
  readonly write?: { readonly field: string; readonly value: unknown };
}

/**
 * **Μία** συναλλαγή πάνω σε αρχείο επαφής: ξένος μισθωτής = ανύπαρκτο (ένα 404, κανένα μαντείο ύπαρξης) · μόνο αρχεία
 * επαφής · γράφεται **μόνο** το πεδίο της απόφασης.
 */
export async function decideOnContactFile<TOutcome>(
  db: AdminFirestore,
  target: { readonly fileId: string; readonly companyId: string },
  decide: (data: StoredFileData) => ContactFileDecision<TOutcome>,
): Promise<TOutcome | ContactFileRefusal> {
  const ref = db.collection(COLLECTIONS.FILES).doc(target.fileId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : undefined;
    const owner = typeof data?.companyId === 'string' ? data.companyId : null;
    if (data === undefined || !isPayloadOwnedByCompany({ companyId: owner }, target.companyId)) return { kind: 'not-found' };
    if (data.entityType !== ENTITY_TYPES.CONTACT) return { kind: 'not-a-contact-file' };
    const { outcome, write } = decide(data);
    // 🔴 ΜΟΝΟ το πεδίο — κανένα `updatedAt` (βλ. κεφαλίδα).
    if (write !== undefined) tx.update(ref, { [write.field]: write.value });
    return outcome;
  });
}
