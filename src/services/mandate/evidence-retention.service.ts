/**
 * @fileoverview **ΤΟ ΠΕΡΑΣΜΑ ΔΙΑΤΗΡΗΣΗΣ ΤΩΝ ΑΠΟΔΕΙΚΤΙΚΩΝ** — κλείδωμα · διάθεση · υιοθεσία (ADR-864 §20).
 * @related lib/mandate/evidence-retention.ts (ο κριτής) · services/mandate/evidence-registry.ts ·
 *   services/mandate/attestation-evidence.ts (η στενή διεπαφή bucket) · lib/cron/jobs/mandate-evidence-retention.job.ts
 * @module services/mandate/evidence-retention.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΣΕΙΡΑ ΚΑΘΕ ΒΗΜΑΤΟΣ ΕΙΝΑΙ Η ΕΓΓΥΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 * **Κλείδωμα**: πρώτα `retention` σε **Locked** (η πλατφόρμα αρνείται πλέον διαγραφή πριν την ημερομηνία, και
 * **κανείς** —ούτε ο φορέας— δεν τη μειώνει), **μετά** αφαίρεση του `temporaryHold`, **τελευταίο** το μητρώο.
 * Αποτυχία στο πρώτο ⇒ τίποτα άλλο: το hold μένει (fail-closed — π.χ. bucket χωρίς object retention).
 * Κατάρρευση ανάμεσα ⇒ το επόμενο πέρασμα ξανακάνει το ίδιο (το Locked δέχεται ξανά την ίδια ημερομηνία).
 *
 * **Διάθεση**: διαγραφή στο bucket **πριν** το μητρώο· αν η πλατφόρμα αρνηθεί, το μητρώο **δεν** λέει ψέματα.
 *
 * **Υιοθεσία** (δίχτυ): αντικείμενο κάτω από τη ρίζα χωρίς εγγραφή ⇒ αν η βάση το αναφέρει, γράφεται εγγραφή·
 * αλλιώς **αναφέρεται** ως αδέσποτο και **ποτέ** δεν σβήνεται (ποιος ξέρει τι αποδεικνύει).
 *
 * ⚠️ Δεν πιάνει σφάλματα σάρωσης σκόπιμα — ο dispatcher τα στέλνει στο monitor του slug.
 *
 * **Layering**: server-only.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { EVIDENCE_RETENTION_RULE, evidenceRetentionStepOf } from '@/lib/mandate/evidence-retention';
import { MANDATE_EVIDENCE_ROOT, evidencesOfMandate, parseEvidencePath } from '@/lib/mandate/mandate-evidence';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { createModuleLogger } from '@/lib/telemetry';
import type { EvidenceBucket } from '@/services/mandate/attestation-evidence';
import { evidenceRecordFromDocument, readLiveEvidenceRecords, registerSealedEvidence, updateEvidenceRecord } from '@/services/mandate/evidence-registry';
import type { OwnerPropertyEvidenceAction } from '@/services/owner-property/owner-property-audit';
import { recordOwnerPropertyEvidenceEvent } from '@/services/owner-property/owner-property-audit';
import type { MandateEvidenceRecord } from '@/types/mandate-evidence-record';
import type { OwnerProperty } from '@/types/owner-property';
import { mandatesOf } from '@/types/owner-property-mandate';

const logger = createModuleLogger('evidence-retention');

/** Πόσες εγγραφές ανά κατάσταση κοιτάζει ένα πέρασμα — το όριο λέγεται στην αναφορά (`truncated`). */
const SCAN_LIMIT = 200;

/** Ο δρων του ίχνους — ίδιο σχήμα με `system:cron-purge`. */
export const EVIDENCE_RETENTION_ACTOR = 'system:cron-evidence-retention';

export interface EvidenceRetentionReport {
  readonly considered: number;
  readonly retained: number;
  readonly disposed: number;
  readonly kept: number;
  readonly adopted: number;
  /** Αντικείμενα που **καμία** εγγραφή ή εντολή δεν αναφέρει — για άνθρωπο, ποτέ για διαγραφή. */
  readonly stray: number;
  readonly failed: number;
  readonly truncated: boolean;
}

type StepOutcome = 'retained' | 'disposed' | 'kept' | 'failed';

async function readProperty(adminDb: AdminFirestore, ownerPropertyId: string): Promise<OwnerProperty | null> {
  const snapshot = await adminDb.collection(COLLECTIONS.OWNER_PROPERTIES).doc(ownerPropertyId).get();
  return ownerPropertyFromDocument(snapshot.data(), ownerPropertyId);
}

async function trace(property: OwnerProperty | null, action: OwnerPropertyEvidenceAction, record: MandateEvidenceRecord, detail: string | null): Promise<void> {
  if (property === null) return;
  await recordOwnerPropertyEvidenceEvent(property, action, EVIDENCE_RETENTION_ACTOR, record, detail);
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Κλείδωμα (ή επέκταση): Locked → απελευθέρωση hold (όχι σε δικαστική δέσμευση) → μητρώο → ίχνος. */
async function lockRetention(
  adminDb: AdminFirestore,
  bucket: EvidenceBucket,
  record: MandateEvidenceRecord,
  property: OwnerProperty | null,
  step: { readonly relationshipEndedAt: string; readonly retainUntil: string },
  nowISO: string,
): Promise<StepOutcome> {
  const object = bucket.file(record.path);
  try {
    // Προθεσμία ήδη περασμένη (σχέση που έληξε πριν από 6+ έτη) ⇒ τίποτα να κλειδωθεί· η διάθεση ακολουθεί.
    if (Date.parse(step.retainUntil) > Date.parse(nowISO)) await object.setMetadata({ retention: { mode: 'Locked', retainUntilTime: step.retainUntil } });
  } catch (error) {
    logger.error('Η διατήρηση ΔΕΝ κλειδώθηκε — το hold μένει', { data: { evidenceId: record.id }, error: errorText(error) });
    return 'failed';
  }
  try {
    if (record.legalHold === null) await object.setMetadata({ temporaryHold: false });
    await updateEvidenceRecord(adminDb, record.id, {
      state: 'retained',
      relationshipEndedAt: step.relationshipEndedAt,
      retainUntil: step.retainUntil,
      ruleId: EVIDENCE_RETENTION_RULE.id,
    });
  } catch (error) {
    logger.error('Η διατήρηση κλειδώθηκε αλλά το μητρώο δεν ενημερώθηκε — επανάληψη στο επόμενο πέρασμα', { data: { evidenceId: record.id }, error: errorText(error) });
    return 'failed';
  }
  await trace(property, 'evidence_retention_scheduled', record, step.retainUntil);
  return 'retained';
}

/** Διάθεση: bucket πρώτα, μητρώο (ταφόπλακα με αποτύπωμα) μετά, ίχνος τελευταίο. */
async function dispose(adminDb: AdminFirestore, bucket: EvidenceBucket, record: MandateEvidenceRecord, property: OwnerProperty | null, nowISO: string): Promise<StepOutcome> {
  try {
    await bucket.file(record.path).delete({ ignoreNotFound: true });
    await updateEvidenceRecord(adminDb, record.id, { state: 'disposed', disposedAt: nowISO });
  } catch (error) {
    logger.error('Το αποδεικτικό δεν διατέθηκε', { data: { evidenceId: record.id }, error: errorText(error) });
    return 'failed';
  }
  await trace(property, 'evidence_disposed', record, record.digest);
  return 'disposed';
}

async function stepRecord(adminDb: AdminFirestore, bucket: EvidenceBucket, record: MandateEvidenceRecord, nowISO: string): Promise<StepOutcome> {
  const property = await readProperty(adminDb, record.ownerPropertyId);
  const step = evidenceRetentionStepOf(record, property === null ? [] : mandatesOf(property), nowISO);
  if (step.kind === 'retain') return lockRetention(adminDb, bucket, record, property, step, nowISO);
  if (step.kind === 'dispose') return dispose(adminDb, bucket, record, property, nowISO);
  return 'kept';
}

/** Υιοθεσία ενός αντικειμένου χωρίς εγγραφή — `'adopted' | 'stray' | 'registered'`. */
async function adoptObject(adminDb: AdminFirestore, name: string, nowISO: string): Promise<'adopted' | 'stray' | 'registered'> {
  const parsed = parseEvidencePath(name);
  if (parsed === null) return 'stray';
  const existing = await adminDb.collection(COLLECTIONS.MANDATE_EVIDENCE).doc(parsed.evidenceId).get();
  if (existing.exists) return 'registered';

  const property = await readProperty(adminDb, parsed.ownerPropertyId);
  const found = (property === null ? [] : mandatesOf(property))
    .flatMap((mandate) => evidencesOfMandate(mandate).map((evidence) => ({ agencyCompanyId: mandate.agencyCompanyId, evidence })))
    .find(({ evidence }) => evidence.id === parsed.evidenceId && evidence.path === name);
  if (found === undefined) {
    logger.warn('Αδέσποτο αποδεικτικό — καμία εγγραφή, καμία εντολή· ΔΕΝ σβήνεται', { data: { path: name } });
    return 'stray';
  }
  const registered = await registerSealedEvidence(adminDb, found.evidence, { ownerPropertyId: parsed.ownerPropertyId, agencyCompanyId: found.agencyCompanyId, sealedAt: nowISO });
  return registered ? 'adopted' : 'stray';
}

async function adoptUnregistered(adminDb: AdminFirestore, bucket: EvidenceBucket, nowISO: string): Promise<{ readonly adopted: number; readonly stray: number }> {
  const [objects] = await bucket.getFiles({ prefix: `${MANDATE_EVIDENCE_ROOT}/` });
  let adopted = 0;
  let stray = 0;
  for (const object of objects) {
    const outcome = await adoptObject(adminDb, object.name, nowISO);
    if (outcome === 'adopted') adopted += 1;
    if (outcome === 'stray') stray += 1;
  }
  return { adopted, stray };
}

/**
 * **Ένα πέρασμα.** Υιοθεσία **πρώτα**, ώστε ό,τι μόλις μπήκε στο μητρώο να κριθεί στο ίδιο πέρασμα.
 */
export async function runEvidenceRetention(adminDb: AdminFirestore, bucket: EvidenceBucket, nowISO: string): Promise<EvidenceRetentionReport> {
  const { adopted, stray } = await adoptUnregistered(adminDb, bucket, nowISO);
  const { records, truncated } = await readLiveEvidenceRecords(adminDb, SCAN_LIMIT);

  const counts: Record<StepOutcome, number> = { retained: 0, disposed: 0, kept: 0, failed: 0 };
  for (const record of records) {
    counts[await stepRecord(adminDb, bucket, record, nowISO)] += 1;
  }

  const report: EvidenceRetentionReport = { considered: records.length, ...counts, adopted, stray, truncated };
  logger.info('Πέρασμα διατήρησης αποδεικτικών', { data: { ...report } });
  return report;
}

// =============================================================================
// ΔΙΚΑΣΤΙΚΗ ΔΕΣΜΕΥΣΗ — υπερισχύει κάθε προθεσμίας (Vault · Purview «holds always win»)
// =============================================================================

export type LegalHoldOutcome =
  | { readonly kind: 'placed' | 'released' }
  | { readonly kind: 'absent' }
  /** Υπάρχει ήδη δικαστική δέσμευση — ποτέ σιωπηλή αντικατάσταση του λόγου της πρώτης (ADR-864 §21). */
  | { readonly kind: 'already-held' }
  | { readonly kind: 'failed' };

/** Πού ανήκει το αποδεικτικό που ζητείται — γραφείο **και** ακίνητο, όπως στη διεύθυνση. */
export interface EvidenceHoldScope {
  readonly evidenceId: string;
  readonly agencyCompanyId: string;
  readonly ownerPropertyId: string;
}

/**
 * Η εγγραφή **του γραφείου, σε αυτό το ακίνητο** — ή `null`. 🔒 ADR-864 §21: ξένο γραφείο ή άλλο ακίνητο ⇒
 * η **ίδια** απουσία (ADR-742 §7.1), ώστε η διαδρομή να μη γίνει μαντείο ύπαρξης αποδεικτικών άλλου μισθωτή.
 */
async function readRecord(adminDb: AdminFirestore, scope: EvidenceHoldScope): Promise<MandateEvidenceRecord | null> {
  const snapshot = await adminDb.collection(COLLECTIONS.MANDATE_EVIDENCE).doc(scope.evidenceId).get();
  const record = snapshot.exists ? evidenceRecordFromDocument(snapshot.data(), scope.evidenceId) : null;
  return record !== null && record.agencyCompanyId === scope.agencyCompanyId && record.ownerPropertyId === scope.ownerPropertyId
    ? record
    : null;
}

/**
 * **Τοποθέτηση**: `temporaryHold` **πρώτα** (η πλατφόρμα αρνείται διαγραφή ακόμη κι αν η προθεσμία πέρασε), μητρώο μετά.
 * ⚠️ Ο **κριτής δικαιώματος** ζει στη διαδρομή που θα την καλέσει (ADR-801) — εδώ μόνο η πράξη.
 */
export async function placeEvidenceLegalHold(
  adminDb: AdminFirestore,
  bucket: EvidenceBucket,
  input: EvidenceHoldScope & { readonly placedBy: string; readonly reason: string; readonly nowISO: string },
): Promise<LegalHoldOutcome> {
  const record = await readRecord(adminDb, input);
  if (record === null || record.state === 'disposed') return { kind: 'absent' };
  if (record.legalHold !== null) return { kind: 'already-held' };
  try {
    await bucket.file(record.path).setMetadata({ temporaryHold: true });
    await updateEvidenceRecord(adminDb, record.id, { legalHold: { placedBy: input.placedBy, placedAt: input.nowISO, reason: input.reason } });
    return { kind: 'placed' };
  } catch (error) {
    logger.error('Η δικαστική δέσμευση δεν μπήκε', { data: { evidenceId: record.id }, error: errorText(error) });
    return { kind: 'failed' };
  }
}

/**
 * **Αφαίρεση**: μητρώο **πρώτα** (ώστε σάρωση στο ενδιάμεσο να μη διαθέσει με ψεύτικο «καμία δέσμευση» — το hold
 * ισχύει ακόμη), μετά το hold — **μόνο** αν η σχέση έχει ήδη λήξει (`retained`): σε `sealed` το hold είναι της σχέσης.
 */
export async function releaseEvidenceLegalHold(
  adminDb: AdminFirestore,
  bucket: EvidenceBucket,
  input: EvidenceHoldScope,
): Promise<LegalHoldOutcome> {
  const record = await readRecord(adminDb, input);
  if (record === null || record.state === 'disposed' || record.legalHold === null) return { kind: 'absent' };
  try {
    await updateEvidenceRecord(adminDb, record.id, { legalHold: null });
    if (record.state === 'retained') await bucket.file(record.path).setMetadata({ temporaryHold: false });
    return { kind: 'released' };
  } catch (error) {
    logger.error('Η δικαστική δέσμευση δεν αφαιρέθηκε', { data: { evidenceId: record.id }, error: errorText(error) });
    return { kind: 'failed' };
  }
}
