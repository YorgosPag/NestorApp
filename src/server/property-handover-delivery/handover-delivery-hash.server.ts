import 'server-only';

/**
 * @fileoverview **ΤΟ SHA-256 ΚΑΘΕ ΠΑΡΑΔΟΜΕΝΟΥ ΑΡΧΕΙΟΥ** — ο κατακερματισμός των γραμμών του καθολικού (ADR-916 Φ-Γ2 Σ2).
 * @related lib/property-handover/handover-delivery-plan.ts (`planHandoverHashing` — τι τώρα · digest v2) ·
 *          server/storage/object-sha256.server.ts (ο μετρητής) · handover-delivery-ledger.server.ts (η μία εγγραφή)
 * @module server/property-handover-delivery/handover-delivery-hash.server
 *
 * 🔑 **Γιατί χωριστό βήμα και όχι μέσα στην αντιγραφή**: η αντιγραφή είναι GCS rewrite μέσα στο Google — τα bytes δεν
 *    περνούν από εμάς, και πρέπει να μένει γρήγορη. Το sha256 θέλει **ανάγνωση** ⇒ δικός του πόρος (bytes), δικός του
 *    προϋπολογισμός. Ένας κώδικας για όλες τις γραμμές χωρίς sha256 — φρέσκες και παλιές (Π5: συμφιλίωση, όχι γεγονός).
 * 🔑 **Τι μετριέται**: πρώτα το **αντίγραφο του αγοραστή** (αυτό κρατά)· αν λείπει ή άλλαξε, η **γενιά-πηγή** που
 *    αντιγράφηκε (ίδια bytes). Κάθε υποψήφια μετριέται **μόνο** αν το crc32c + μέγεθος της γενιάς της είναι **αυτά της
 *    γραμμής** — δηλαδή τα bytes που παραδόθηκαν. Αλλιώς δεν γράφεται τίποτα: ποτέ αποτύπωμα ξένων bytes.
 * 🛡️ **Ποτέ δεν πετά**: αποτυχία γραμμής = `lastError`· η γραμμή μένει χωρίς sha256 και η επόμενη εκτέλεση ξαναδοκιμάζει.
 */

import type { File } from '@google-cloud/storage';
import type { DocumentData } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { getErrorMessage } from '@/lib/error-utils';
import { planHandoverHashing } from '@/lib/property-handover/handover-delivery-plan';
import { fileRecordBucket } from '@/server/files/file-record-bucket';
import { sha256OfStoredObject } from '@/server/storage/object-sha256.server';
import { statObjects } from '@/server/storage/placement-copy';

import { handoverCopyRecordRef, type HandoverCopyContext } from './handover-delivery-copy.server';
import { recordDeliverySha256, type HandoverLedgerProof, type HandoverSha256Origin } from './handover-delivery-ledger.server';

export interface HandoverHashBudget {
  readonly maxBytes: number;
  /** `Date.now()` μετά από το οποίο **δεν** ξεκινά νέο αρχείο — `null` ⇒ μόνο ο προϋπολογισμός bytes. */
  readonly deadlineAt: number | null;
}

export type HandoverHashContext = Pick<HandoverCopyContext, 'adminDb' | 'handover' | 'recipientUserId'>;

export interface HandoverHashRun {
  /** **Όλες** οι γραμμές, με το sha256 συμπληρωμένο όπου αποδείχτηκε σε αυτή την εκτέλεση. */
  readonly rows: readonly HandoverLedgerProof[];
  readonly hashed: number;
  /** Γραμμές που μένουν χωρίς sha256 — όσο > 0, το αποτύπωμα (και το Πρωτόκολλο) εκκρεμεί. */
  readonly pending: number;
  /**
   * Σ4 (Ο13) — γραμμές που δοκιμάστηκαν **σε αυτή** την εκτέλεση και **καμία** υποψήφια δεν κρατά πια τα bytes τους
   * (όχι σφάλμα δικτύου: αυτό είναι `lastError` και ξαναδοκιμάζεται). Η σταθερή σειρά του `planHandoverHashing` φέρνει
   * τέτοια γραμμή **πρώτη** σε κάθε επόμενη εκτέλεση, άρα ο αριθμός δεν «αναβοσβήνει».
   */
  readonly unverifiable: number;
  readonly lastError: string | null;
}

/** Μία θέση που **ίσως** κρατά τα παραδομένα bytes. `generation` ⇒ μόνο αυτή η γενιά γίνεται δεκτή. */
interface HashCandidate {
  readonly origin: HandoverSha256Origin;
  readonly record: DocumentData | undefined;
  readonly generation: string | null;
}

/** Οι υποψήφιες κάθε γραμμής — εγγραφές μόνο του **σωστού** κατόχου (αγοραστής · μισθωτής), με **μία** ανάγνωση. */
async function candidatesOf(ctx: HandoverHashContext, rows: readonly HandoverLedgerProof[]): Promise<Map<string, HashCandidate[]>> {
  if (rows.length === 0) return new Map();
  const files = ctx.adminDb.collection(COLLECTIONS.FILES);
  const snaps = await ctx.adminDb.getAll(
    ...rows.map((row) => handoverCopyRecordRef(ctx.adminDb, ctx.recipientUserId, row.copyFileId)),
    ...rows.map((row) => files.doc(row.sourceFileId)),
  );
  return new Map(rows.map((row, i) => {
    const copy = snaps[i]?.data();
    const source = snaps[rows.length + i]?.data();
    return [row.sourceFileId, [
      { origin: 'copy', record: copy?.userId === ctx.recipientUserId ? copy : undefined, generation: null },
      // Χωρίς γνωστή γενιά-πηγή δεν αποδεικνύεται ποια bytes παραδόθηκαν ⇒ καμία εφεδρεία.
      { origin: 'source', record: source?.companyId === ctx.handover.companyId && row.sourceGeneration !== null ? source : undefined, generation: row.sourceGeneration },
    ]];
  }));
}

/** Το αντικείμενο μιας εγγραφής, με τα μεταδεδομένα της **τρέχουσας** γενιάς — `null` αν λείπει κάτι. */
async function storedObjectOf(record: DocumentData | undefined): Promise<File | null> {
  const path: unknown = record?.storagePath;
  if (record === undefined || typeof path !== 'string' || path === '') return null;
  const [file] = await statObjects(fileRecordBucket(record), [path]);
  return file ?? null;
}

/** Το sha256 μιας υποψήφιας — **μόνο** αν η γενιά της κρατά τα bytes της γραμμής (crc32c + μέγεθος, γενιά αν ζητήθηκε). */
async function measureCandidate(row: HandoverLedgerProof, candidate: HashCandidate): Promise<string | null> {
  const file = await storedObjectOf(candidate.record);
  if (file === null) return null;
  const { crc32c, size, generation } = file.metadata;
  if (crc32c !== row.crc32c || Number(size) !== row.size) return null;
  if (candidate.generation !== null && String(generation) !== candidate.generation) return null;
  const measured = await sha256OfStoredObject(file);
  return measured.kind === 'hashed' ? measured.sha256 : null;
}

/** Μία γραμμή: η πρώτη υποψήφια που αποδεικνύεται γράφεται **μία** φορά. `null` ⇒ καμία δεν αποδείχτηκε. */
async function hashRow(ctx: HandoverHashContext, row: HandoverLedgerProof, candidates: readonly HashCandidate[]): Promise<string | null> {
  for (const candidate of candidates) {
    const sha256 = await measureCandidate(row, candidate);
    if (sha256 === null) continue;
    const written = await recordDeliverySha256(ctx.adminDb, ctx.handover.id, { ...row, sha256, origin: candidate.origin });
    return written.kind === 'hashed' ? written.sha256 : null;
  }
  return null;
}

/**
 * **Κατακερματίζει** τις γραμμές χωρίς sha256, όσες χωρούν στον προϋπολογισμό bytes και στην προθεσμία. Ιδεμπότητο:
 * γραμμή με sha256 δεν ξαναδιαβάζεται ποτέ· δύο ταυτόχρονες εκτελέσεις γράφουν **ένα** αποτύπωμα (συναλλαγή).
 */
export async function hashDeliveredRows(ctx: HandoverHashContext, rows: readonly HandoverLedgerProof[], budget: HandoverHashBudget): Promise<HandoverHashRun> {
  const plan = planHandoverHashing(rows, budget.maxBytes);
  const candidates = await candidatesOf(ctx, plan.hash);
  const proven = new Map<string, string>();
  let lastError: string | null = null;
  let unverifiable = 0;
  for (const row of plan.hash) {
    if (budget.deadlineAt !== null && Date.now() >= budget.deadlineAt) break;
    try {
      const sha256 = await hashRow(ctx, row, candidates.get(row.sourceFileId) ?? []);
      if (sha256 !== null) proven.set(row.sourceFileId, sha256);
      else {
        unverifiable += 1;
        lastError = `Χωρίς αποδείξιμο αποτύπωμα: ${row.sourceFileId}`;
      }
    } catch (error) {
      lastError = getErrorMessage(error);
    }
  }
  const out = rows.map((row) => (row.sha256 !== null ? row : { ...row, sha256: proven.get(row.sourceFileId) ?? null }));
  return { rows: out, hashed: proven.size, pending: out.filter((row) => row.sha256 === null).length, unverifiable, lastError };
}
