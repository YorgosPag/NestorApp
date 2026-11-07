/**
 * @fileoverview Accounting Repository — Αντιλογισμός εγγραφής Βιβλίου Ε-Ε (ΕΝΑΣ γραφέας, ατομικός, ιδεμπότητος)
 * @description Η αντιλογιστική εγγραφή (storno), η σήμανση της αρχικής `REVERSED` και το ίχνος ελέγχου γράφονται
 *   στην ΙΔΙΑ συναλλαγή — μαζί ή καθόλου. Καλούντες: το βιβλίο (`POST /journal/[id]/reversal`) και η ακύρωση
 *   τιμολογίου (`reversal-service`). Δεύτερος δρόμος αντιλογισμού ΔΕΝ υπάρχει.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-11-07):
 *   - ο μόνος αντιλογισμός ήταν της ακύρωσης τιμολογίου: `createJournalEntry` (τυχαίο id) ΚΑΙ ΜΕΤΑ `updateJournalEntry`
 *     — σφάλμα ανάμεσα = storno χωρίς σήμανση στην αρχική, και η επανάληψη έγραφε ΔΕΥΤΕΡΟ storno·
 *   - χειροκίνητη εγγραφή δεν αντιλογιζόταν καθόλου — μόνο `DELETE` (το βιβλίο έχανε το ίχνος του λάθους)·
 *   - ο αντιλογισμός έπαιρνε ημέρα UTC (`isoNow().split('T')`) και δεν ρωτούσε ΠΟΤΕ αν η περίοδός του είναι ανοιχτή.
 *
 * Συμβόλαιο (ADR-ACC-010 §2.1.1 Φ8):
 *   - id αντιλογισμού = ντετερμινιστικό από την αρχική + `create` ⇒ δεύτερο storno δομικά αδύνατο·
 *   - ΟΛΕΣ οι αποφάσεις (κατάσταση, άρνηση, σύνδεσμος παραστατικού, περίοδος) πάνω στα ΦΡΕΣΚΑ έγγραφα της συναλλαγής·
 *   - ήδη αντιλογισμένη ⇒ `already_reversed` με το ΙΔΙΟ storno (ιδεμπότητα, όχι σφάλμα)·
 *   - ημερομηνία: η πρώτη υποψήφια με ανοιχτή περίοδο (`reversalDateCandidates`)· καμία ⇒ `JournalReversalPeriodError`.
 *
 * @see ADR-ACC-010 §2.1.1 Φάση 8 · accounting-repo-depreciation.ts (ίδιο σχήμα)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { ownedOrNull } from '@/lib/auth/tenant-ownership';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDeterministicJournalReversalEntryId } from '@/services/enterprise-id.service';

import type { TenantContext } from '../../types/common';
import type { JournalEntry } from '../../types/journal';
import type { FiscalPeriod, PostingPeriodDenial } from '../../types/fiscal-period';
import type { JournalReversalOutcome, JournalReversalRequest } from '../../types/journal-reversal';
import { postingPeriodDenialOf } from '../fiscal-period-transitions';
import { fiscalPeriodKeyForDate } from '../fiscal-period-keys';
import { reversalDateCandidates, reversalRefusalOf } from '../journal/journal-reversal-policy';
import { journalReversalAuditEntries } from '../audit/journal-reversal-audit';
import { JournalReversalPeriodError } from '../journal/journal-reversal-errors';

import { appendAuditEntryInTransaction } from './accounting-repo-audit';
import { applyJournalDefaults } from './accounting-repo-financial';
import { fiscalPeriodRef, ownedFiscalPeriodOf } from './accounting-repo-fiscal-periods';
import { getFiscalYearFromDate, getQuarterFromDate, isoNow, sanitizeForFirestore } from './firestore-helpers';

interface PeriodCheck {
  readonly date: string;
  readonly period: FiscalPeriod | null;
  readonly denial: PostingPeriodDenial | null;
}

/** Η ημερομηνία που κρατήθηκε, και η περίοδος της αρχικής (για τη σήμανση cross-period). */
interface DatedReversal {
  readonly chosen: PeriodCheck;
  readonly originalPeriod: FiscalPeriod | null;
}

async function readOriginal(db: Firestore, tx: Transaction, tenant: TenantContext, entryId: string): Promise<JournalEntry | null> {
  const snap = await tx.get(db.collection(COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES).doc(entryId));
  const owned = ownedOrNull(snap.exists ? (snap.data() as JournalEntry) : null, tenant.companyId, {
    resource: 'journal entry',
    resourceId: entryId,
  });
  return owned === null ? null : applyJournalDefaults(owned);
}

/** Γεννήθηκε η εγγραφή από επιβεβαιωμένο παραστατικό εξόδου; (ο σύνδεσμος ζει ΜΟΝΟ στο παραστατικό) */
async function isDocumentLinked(db: Firestore, tx: Transaction, tenant: TenantContext, entryId: string): Promise<boolean> {
  const snap = await tx.get(
    db.collection(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS)
      .where('companyId', '==', tenant.companyId)
      .where('journalEntryId', '==', entryId)
      .limit(1)
  );
  return !snap.empty;
}

async function checkPeriod(db: Firestore, tx: Transaction, tenant: TenantContext, date: string): Promise<PeriodCheck> {
  const periodKey = fiscalPeriodKeyForDate(date);
  if (periodKey === null) return { date, period: null, denial: 'PERIOD_NOT_FOUND' };
  const period = ownedFiscalPeriodOf(await tx.get(fiscalPeriodRef(db, tenant, periodKey)), tenant, periodKey);
  return { date, period, denial: postingPeriodDenialOf(period) };
}

/** Η πρώτη υποψήφια με ανοιχτή περίοδο· αλλιώς άρνηση με την ΤΕΛΕΥΤΑΙΑ (σήμερα). Μόνο αναγνώσεις. */
async function chooseReversalDate(
  db: Firestore,
  tx: Transaction,
  tenant: TenantContext,
  original: JournalEntry,
  request: JournalReversalRequest
): Promise<DatedReversal> {
  const checks: PeriodCheck[] = [];
  for (const date of reversalDateCandidates(request.datePolicy, original.date, request.today)) {
    checks.push(await checkPeriod(db, tx, tenant, date));
  }
  const chosen = checks.find((check) => check.denial === null);
  if (chosen === undefined) {
    const last = checks[checks.length - 1];
    throw new JournalReversalPeriodError(last.denial ?? 'PERIOD_NOT_FOUND', last.date, last.period);
  }
  const originalPeriod = checks[0].date === original.date ? checks[0].period : null;
  return { chosen, originalPeriod };
}

/** Αντίθετο ποσό χωρίς `-0` (0 ΦΠΑ ⇒ 0, όχι `-0` στο Firestore και στις συγκρίσεις). */
function negated(amount: number): number {
  return amount === 0 ? 0 : -amount;
}

/** Η γενεαλογία του storno (`JOURNAL_LINEAGE_FIELDS`): ποιανού, ποιος το ζήτησε, γιατί, και αν άλλαξε περίοδο. */
function lineageOf(
  original: JournalEntry,
  request: JournalReversalRequest,
  dated: DatedReversal
): Pick<JournalEntry, 'isReversal' | 'originalEntryId' | 'reversalTrigger' | 'cancellationReasonCode' | 'cancellationNotes'
  | 'crossPeriodReversal' | 'originalPeriod' | 'reversalPeriod'> {
  const crossPeriod = dated.chosen.date !== original.date;
  return {
    isReversal: true,
    originalEntryId: original.entryId,
    reversalTrigger: request.trigger,
    cancellationReasonCode: request.reasonCode,
    ...(request.reasonNotes ? { cancellationNotes: request.reasonNotes } : {}),
    ...(crossPeriod ? {
      crossPeriodReversal: true,
      ...(dated.originalPeriod ? { originalPeriod: dated.originalPeriod.periodNumber } : {}),
      ...(dated.chosen.period ? { reversalPeriod: dated.chosen.period.periodNumber } : {}),
    } : {}),
  };
}

/** Η αντιλογιστική: ίδια πεδία, αντίθετα ποσά (DATEV Generalumkehr), ίδια περιγραφή — ο ρόλος φαίνεται από τα πεδία. */
function reversalDocOf(
  tenant: TenantContext,
  original: JournalEntry,
  request: JournalReversalRequest,
  dated: DatedReversal,
  now: string
): JournalEntry {
  const date = dated.chosen.date;
  return {
    ...lineageOf(original, request, dated),
    date,
    type: original.type,
    category: original.category,
    description: original.description,
    netAmount: negated(original.netAmount),
    vatRate: original.vatRate,
    vatAmount: negated(original.vatAmount),
    grossAmount: negated(original.grossAmount),
    vatDeductible: original.vatDeductible,
    paymentMethod: original.paymentMethod,
    contactId: original.contactId,
    contactName: original.contactName,
    invoiceId: original.invoiceId,
    mydataCode: original.mydataCode,
    e3Code: original.e3Code,
    fiscalYear: getFiscalYearFromDate(date),
    quarter: getQuarterFromDate(date),
    notes: original.notes,
    status: 'ACTIVE',
    entryId: generateDeterministicJournalReversalEntryId(original.entryId),
    companyId: tenant.companyId,
    createdBy: tenant.userId,
    createdAt: now,
    updatedAt: now,
  };
}

/** Γράφει: storno (`create` — σύγκρουση αν υπάρχει) + σήμανση αρχικής + ίχνος. Μόνο εγγραφές. */
function writeReversal(db: Firestore, tx: Transaction, tenant: TenantContext, original: JournalEntry, reversal: JournalEntry): void {
  const journal = db.collection(COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES);
  tx.create(journal.doc(reversal.entryId), sanitizeForFirestore(reversal as unknown as Record<string, unknown>));
  tx.update(journal.doc(original.entryId), sanitizeForFirestore({
    status: 'REVERSED',
    reversalEntryId: reversal.entryId,
    reversedAt: reversal.createdAt,
    reversedBy: tenant.userId,
    updatedAt: reversal.createdAt,
  }));
  for (const entry of journalReversalAuditEntries({ original, reversal, userId: tenant.userId })) {
    appendAuditEntryInTransaction(db, tx, tenant, entry);
  }
}

async function reverseInTransaction(
  db: Firestore,
  tx: Transaction,
  tenant: TenantContext,
  request: JournalReversalRequest
): Promise<JournalReversalOutcome> {
  const original = await readOriginal(db, tx, tenant, request.entryId);
  if (original === null) return { kind: 'not_found' };
  // `REVERSED` χωρίς σύνδεσμο (παλιά δεδομένα) μετρά ΕΠΙΣΗΣ ως αντιλογισμένη — ποτέ δεύτερο storno.
  if (original.status === 'REVERSED') {
    return { kind: 'already_reversed', originalEntryId: original.entryId, reversalEntryId: original.reversalEntryId ?? null };
  }
  const refusal = reversalRefusalOf(original, request.trigger);
  if (refusal !== null) return { kind: 'refused', reason: refusal };
  if (await isDocumentLinked(db, tx, tenant, original.entryId)) return { kind: 'refused', reason: 'DOCUMENT_LINKED' };

  const dated = await chooseReversalDate(db, tx, tenant, original, request);
  const reversal = reversalDocOf(tenant, original, request, dated, isoNow());
  writeReversal(db, tx, tenant, original, reversal);
  return {
    kind: 'reversed',
    originalEntryId: original.entryId,
    reversalEntryId: reversal.entryId,
    reversalDate: reversal.date,
    crossPeriod: reversal.crossPeriodReversal === true,
  };
}

/** Αντιλογίζει ΜΙΑ εγγραφή — ατομικά, ιδεμπότητα. Σφάλμα = σφάλμα, ποτέ fallback. */
export async function reverseJournalEntry(
  tenant: TenantContext,
  request: JournalReversalRequest
): Promise<JournalReversalOutcome> {
  return safeFirestoreOperation((db) =>
    db.runTransaction((tx) => reverseInTransaction(db, tx, tenant, request))
  );
}
