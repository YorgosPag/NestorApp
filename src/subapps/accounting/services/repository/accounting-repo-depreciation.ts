/**
 * @fileoverview Accounting Repository — Καταχώριση απόσβεσης στο Βιβλίο Ε-Ε (ΕΝΑΣ γραφέας, ατομικός, ιδεμπότητος)
 * @description Η εγγραφή απόσβεσης ΜΙΑΣ χρήσης για ΕΝΑ πάγιο, η εγγραφή Ε-Ε της διαφοράς, η προβολή του παγίου και το
 *   ίχνος ελέγχου γράφονται στην ΙΔΙΑ συναλλαγή — μαζί ή καθόλου.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ:
 *   - Φάση 4 (2026-10-15): `createDepreciationRecord` (τυχαίο id) + `updateFixedAsset` ήταν δύο ανεξάρτητες εγγραφές ⇒
 *     δεύτερη εκτέλεση = διπλή απόσβεση· σφάλμα ανάμεσα = μισή καταχώριση.
 *   - Φάση 5 (2026-10-15): η απόσβεση ΔΕΝ έφτανε στο βιβλίο (`journalEntryId` πάντα `null`) ⇒ φόρος / P&L δεν την
 *     έβλεπαν. Η εγγραφή Ε-Ε γράφεται ΕΔΩ, στην ίδια συναλλαγή: ποτέ έξοδο χωρίς απόσβεση ή απόσβεση χωρίς έξοδο.
 *
 * Συμβόλαιο (ADR-ACC-010 §2.1.1 Φάσεις 4–5):
 *   - id εγγραφής = ντετερμινιστικό (μισθωτής, πάγιο, χρήση) ⇒ ΜΙΑ εγγραφή ανά (πάγιο, χρήση) από κατασκευής·
 *   - id εγγραφής Ε-Ε = ντετερμινιστικό (εγγραφή, αναθεώρηση) + `create` ⇒ ταυτόχρονη εκτέλεση = σύγκρουση, ποτέ διπλό·
 *   - η ΑΠΟΦΑΣΗ (`request.decide`) τρέχει μέσα στη συναλλαγή πάνω στα ΦΡΕΣΚΑ έγγραφα· «σωστό = καταχωρημένο» ⇒ τίποτα·
 *   - διόρθωση / αναίρεση = ΝΕΑ εγγραφή διαφοράς (SAP repeat run) — η παλιά εγγραφή Ε-Ε δεν αλλάζει ποτέ·
 *   - η περίοδος 12 ΤΟΥ ΜΙΣΘΩΤΗ πρέπει να είναι ΑΝΟΙΧΤΗ τη στιγμή του commit (όχι μόνο όταν ξεκίνησε η εκτέλεση).
 *
 * @see ADR-ACC-010 §2.1.1 (Φάσεις 4–5) · ADR-ACC-007 §5.1
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { chunkArray } from '@/lib/array-utils';
import { ownedOrNull } from '@/lib/auth/tenant-ownership';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  generateDeterministicDepreciationJournalEntryId,
  generateDeterministicDepreciationRecordId,
} from '@/services/enterprise-id.service';

import type {
  DepreciationDecision,
  DepreciationPostedChange,
  DepreciationPostingOutcome,
  DepreciationPostingRequest,
  DepreciationRecord,
  FixedAsset,
} from '../../types/assets';
import type { TenantContext } from '../../types/common';
import type { JournalEntry } from '../../types/journal';
import type { PostingPeriodDenial } from '../../types/fiscal-period';
import { depreciationPeriodIdFor } from '../engines/depreciation-booking';
import { postingPeriodDenialOf } from '../fiscal-period-transitions';

import { depreciationAuditEntries } from '../audit/depreciation-audit';
import { appendAuditEntryInTransaction } from './accounting-repo-audit';
import { fiscalPeriodRef, ownedFiscalPeriodOf } from './accounting-repo-fiscal-periods';
import { isoNow, sanitizeForFirestore } from './firestore-helpers';

/** Το πάγιο δεν υπάρχει ή ανήκει σε άλλον μισθωτή — ίδιο σφάλμα και για τα δύο (καμία διαρροή ύπαρξης). */
export class DepreciationAssetNotFoundError extends Error {
  constructor(readonly assetId: string) {
    super(`Fixed asset not found: ${assetId}`);
    this.name = 'DepreciationAssetNotFoundError';
  }
}

/** Έγγραφα ανά `getAll` στην προεπισκόπηση. */
const RECORD_READ_BATCH = 100;

/** Η περίοδος 12 της χρήσης δεν δέχεται εγγραφές τη στιγμή του commit (SAP: posting period closed). */
export class DepreciationPeriodClosedError extends Error {
  constructor(readonly code: PostingPeriodDenial, readonly periodId: string) {
    super(`Depreciation posting refused (${code}) for period ${periodId}`);
    this.name = 'DepreciationPeriodClosedError';
  }
}

interface PostingReads {
  readonly recordRef: DocumentReference;
  readonly assetRef: DocumentReference;
  readonly current: DepreciationRecord | null;
  readonly asset: FixedAsset;
  readonly periodBlocker: PostingPeriodDenial | null;
}

/** ΟΛΕΣ οι αναγνώσεις ΠΡΙΝ από κάθε εγγραφή (κανόνας συναλλαγών Firestore). */
async function readForPosting(
  db: Firestore,
  transaction: Transaction,
  tenant: TenantContext,
  request: DepreciationPostingRequest
): Promise<PostingReads> {
  const recordId = generateDeterministicDepreciationRecordId(tenant.companyId, request.assetId, request.fiscalYear);
  const recordRef = db.collection(COLLECTIONS.ACCOUNTING_DEPRECIATION_RECORDS).doc(recordId);
  const assetRef = db.collection(COLLECTIONS.ACCOUNTING_FIXED_ASSETS).doc(request.assetId);
  const periodId = depreciationPeriodIdFor(request.fiscalYear);
  const periodRef = fiscalPeriodRef(db, tenant, periodId);

  const recordSnap = await transaction.get(recordRef);
  const assetSnap = await transaction.get(assetRef);
  const periodSnap = await transaction.get(periodRef);

  // Σιωπηλή πολιτική του SSoT: ξένο πάγιο = ανύπαρκτο (καμία διαρροή ύπαρξης· κενό companyId ≠ tenant).
  const asset = ownedOrNull(assetSnap.exists ? (assetSnap.data() as FixedAsset) : null, tenant.companyId, {
    resource: 'fixed asset',
    resourceId: request.assetId,
  });
  if (asset === null) throw new DepreciationAssetNotFoundError(request.assetId);
  return {
    recordRef,
    assetRef,
    current: recordSnap.exists ? (recordSnap.data() as DepreciationRecord) : null,
    asset,
    periodBlocker: postingPeriodDenialOf(ownedFiscalPeriodOf(periodSnap, tenant, periodId)),
  };
}

type PostDecision = Extract<DepreciationDecision, { kind: 'post' }>;

/** Ταυτότητα μιας σύγκλισης: ποια αναθεώρηση, ποια εγγραφή Ε-Ε, πότε. */
interface PostingIdentity {
  readonly recordId: string;
  readonly revision: number;
  readonly journalEntryId: string;
  readonly now: string;
}

function identityOf(reads: PostingReads): PostingIdentity {
  const recordId = reads.recordRef.id;
  const revision = (reads.current?.revision ?? 0) + 1;
  return { recordId, revision, journalEntryId: generateDeterministicDepreciationJournalEntryId(recordId, revision), now: isoNow() };
}

/** Η εγγραφή Ε-Ε της διαφοράς, με την προέλευσή της (φρουρός της γενικής διαδρομής: `journal-subsystem-ownership`). */
function journalDocOf(tenant: TenantContext, reads: PostingReads, decision: PostDecision, id: PostingIdentity): JournalEntry {
  return {
    ...decision.journal,
    source: {
      kind: 'depreciation', depreciationRecordId: id.recordId, assetId: reads.asset.assetId,
      fiscalYear: decision.record.fiscalYear, revision: id.revision,
    },
    entryId: id.journalEntryId,
    companyId: tenant.companyId,
    createdBy: tenant.userId,
    status: 'ACTIVE',
    createdAt: id.now,
    updatedAt: id.now,
  };
}

/** Η εγγραφή απόσβεσης μετά τη σύγκλιση — κρατά ΟΛΕΣ τις εγγραφές Ε-Ε της, με τη σειρά. */
function recordDocOf(tenant: TenantContext, reads: PostingReads, decision: PostDecision, id: PostingIdentity): DepreciationRecord {
  return {
    ...decision.record,
    recordId: id.recordId,
    companyId: tenant.companyId,
    createdBy: reads.current?.createdBy ?? tenant.userId,
    journalEntryId: id.journalEntryId,
    journalEntryIds: [...(reads.current?.journalEntryIds ?? []), id.journalEntryId],
    revision: id.revision,
  };
}

/** Γράφει την απόφαση: εγγραφή Ε-Ε της διαφοράς + εγγραφή απόσβεσης + προβολή παγίου. */
function writeDecision(
  db: Firestore,
  transaction: Transaction,
  tenant: TenantContext,
  reads: PostingReads,
  decision: PostDecision
): DepreciationPostedChange {
  const { current, recordRef } = reads;
  const id = identityOf(reads);
  const { journalEntryId, now } = id;
  const journal = journalDocOf(tenant, reads, decision, id);
  const record = recordDocOf(tenant, reads, decision, id);

  // `create`: δεύτερη εκτέλεση της ΙΔΙΑΣ αναθεώρησης = σύγκρουση, ποτέ δεύτερο έξοδο.
  transaction.create(db.collection(COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES).doc(journalEntryId),
    sanitizeForFirestore(journal as unknown as Record<string, unknown>));
  const recordData = sanitizeForFirestore(record as unknown as Record<string, unknown>);
  // Υπάρχουσα εγγραφή: διαβάστηκε ΜΕΣΑ στη συναλλαγή ⇒ αλλαγή στο μεταξύ = επανάληψη, ποτέ τυφλή αντικατάσταση.
  if (current === null) transaction.create(recordRef, recordData);
  else transaction.set(recordRef, recordData);
  if (decision.assetProjection !== null) {
    transaction.update(reads.assetRef, sanitizeForFirestore({ ...decision.assetProjection, updatedAt: now } as Record<string, unknown>));
  }

  const delta = decision.journal.netAmount;
  const wasPosted = (current?.annualDepreciation ?? 0) !== 0;
  return { intent: decision.record.annualDepreciation === 0 ? 'reverse' : 'book', record, delta, journalEntryId, wasPosted };
}

async function postInTransaction(
  db: Firestore,
  transaction: Transaction,
  tenant: TenantContext,
  request: DepreciationPostingRequest
): Promise<DepreciationPostingOutcome> {
  const reads = await readForPosting(db, transaction, tenant, request);
  const decision = request.decide({ asset: reads.asset, current: reads.current });
  if (decision.kind === 'unchanged') return { kind: 'unchanged', record: reads.current };
  if (decision.kind === 'refused') return { kind: 'refused', assetId: request.assetId, reason: decision.reason };
  if (reads.periodBlocker !== null) {
    throw new DepreciationPeriodClosedError(reads.periodBlocker, depreciationPeriodIdFor(request.fiscalYear));
  }

  const change = writeDecision(db, transaction, tenant, reads, decision);
  // Το ίχνος το γράφει Ο ΓΡΑΦΕΑΣ, πάντα — ποτέ ανάλογα με το αν ο καλών θυμήθηκε τον audited wrapper.
  for (const entry of depreciationAuditEntries(change, tenant.userId)) appendAuditEntryInTransaction(db, transaction, tenant, entry);
  return { kind: 'posted', change };
}

/** Συγκλίνει την απόσβεση μιας χρήσης για ένα πάγιο — ατομικά, ιδεμπότητα. Σφάλμα = σφάλμα, ποτέ fallback. */
export async function postDepreciation(
  tenant: TenantContext,
  request: DepreciationPostingRequest
): Promise<DepreciationPostingOutcome> {
  return safeFirestoreOperation((db) =>
    db.runTransaction((transaction) => postInTransaction(db, transaction, tenant, request))
  );
}

/**
 * Οι εγγραφές απόσβεσης μιας χρήσης για συγκεκριμένα πάγια — ανάγνωση με ΤΑΥΤΟΤΗΤΑ (ντετερμινιστικό id), όχι
 * ερώτημα: κανένας δείκτης, καμία σελίδα, ούτε ξένος μισθωτής (το id περιέχει τον μισθωτή). Για την προεπισκόπηση.
 * Σφάλμα = σφάλμα (ποτέ «κανένα καταχωρημένο»: θα έδειχνε ως νέο ό,τι έχει ήδη περάσει).
 */
export async function readDepreciationRecords(
  tenant: TenantContext,
  fiscalYear: number,
  assetIds: readonly string[]
): Promise<Map<string, DepreciationRecord>> {
  if (assetIds.length === 0) return new Map();
  return safeFirestoreOperation(async (db) => {
    const collection = db.collection(COLLECTIONS.ACCOUNTING_DEPRECIATION_RECORDS);
    const found = new Map<string, DepreciationRecord>();
    for (const chunk of chunkArray([...assetIds], RECORD_READ_BATCH)) {
      const snaps = await db.getAll(...chunk.map((assetId) =>
        collection.doc(generateDeterministicDepreciationRecordId(tenant.companyId, assetId, fiscalYear))));
      snaps.forEach((snap, i) => {
        if (snap.exists) found.set(chunk[i], snap.data() as DepreciationRecord);
      });
    }
    return found;
  });
}
