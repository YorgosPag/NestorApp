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

import { getErrorMessage } from '@/lib/error-utils';
import { planHandoverHashing } from '@/lib/property-handover/handover-delivery-plan';
import { sha256OfStoredObject } from '@/server/storage/object-sha256.server';

import { candidatesOf, liveRowBytes, type HandoverEvidenceContext, type HashCandidate } from './handover-delivery-evidence.server';
import { recordDeliverySha256, type HandoverLedgerProof } from './handover-delivery-ledger.server';
import { releaseOrphanedSourceBytes } from './handover-delivery-orphan-release.server';
import { hasOpenRecovery, recoverDeliveredRow } from './handover-delivery-recovery.server';

export interface HandoverHashBudget {
  readonly maxBytes: number;
  /** `Date.now()` μετά από το οποίο **δεν** ξεκινά νέο αρχείο — `null` ⇒ μόνο ο προϋπολογισμός bytes. */
  readonly deadlineAt: number | null;
}

export type HandoverHashContext = HandoverEvidenceContext;

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

/** Το sha256 μιας υποψήφιας — **μόνο** αν η γενιά της κρατά τα bytes της γραμμής (κοινή μέτρηση με την πόρτα του κλεισίματος). */
async function measureCandidate(row: HandoverLedgerProof, candidate: HashCandidate): Promise<string | null> {
  const file = await liveRowBytes(row, candidate);
  if (file === null) return null;
  const measured = await sha256OfStoredObject(file);
  return measured.kind === 'hashed' ? measured.sha256 : null;
}

/**
 * Μία γραμμή: η πρώτη υποψήφια που αποδεικνύεται γράφεται **μία** φορά. Καμία ζωντανή υποψήφια (χωρίς σφάλμα δικτύου —
 * εκείνο πετά) ⇒ Φ-Δ.7β: ανάκτηση από το soft delete. `null` ⇒ τίποτα δεν αποδείχτηκε.
 */
async function hashRow(ctx: HandoverHashContext, row: HandoverLedgerProof, candidates: readonly HashCandidate[]): Promise<string | null> {
  for (const candidate of candidates) {
    const sha256 = await measureCandidate(row, candidate);
    if (sha256 === null) continue;
    const written = await recordDeliverySha256(ctx.adminDb, ctx.handover.id, { ...row, sha256, origin: candidate.origin });
    // Ο24 — η απόδειξη έκλεισε: αν η συναλλαγή βρήκε την πηγή σβησμένη, τα bytes της παραδίδονται στον sweeper.
    if (written.kind === 'hashed') await releaseOrphanedSourceBytes(ctx.adminDb, ctx.handover.id, row.sourceFileId);
    return written.kind === 'hashed' ? written.sha256 : null;
  }
  return recoverDeliveredRow(ctx, row);
}

/**
 * Φ-Δ.7β δίχτυ — γραμμές **με** sha256 αλλά ανοιχτό ημερολόγιο (η απόδειξη γράφτηκε, η επαναδιαγραφή όχι): κλείνουν, ώστε
 * να μη μείνει **ποτέ** ζωντανό αντικείμενο που επαναφέραμε. Αποτυχία ⇒ η επόμενη εκτέλεση ξαναδοκιμάζει.
 */
async function settleOpenRecoveries(ctx: HandoverHashContext, rows: readonly HandoverLedgerProof[]): Promise<string | null> {
  let lastError: string | null = null;
  for (const row of rows) {
    if (row.sha256 === null || !hasOpenRecovery(row)) continue;
    await recoverDeliveredRow(ctx, row).catch((error: unknown) => { lastError = getErrorMessage(error); });
  }
  return lastError;
}

/**
 * **Κατακερματίζει** τις γραμμές χωρίς sha256, όσες χωρούν στον προϋπολογισμό bytes και στην προθεσμία. Ιδεμπότητο:
 * γραμμή με sha256 δεν ξαναδιαβάζεται ποτέ· δύο ταυτόχρονες εκτελέσεις γράφουν **ένα** αποτύπωμα (συναλλαγή).
 * Φ-Δ.7γ — κλεισμένη γραμμή **δεν** ξαναδοκιμάζεται και **δεν** εκκρεμεί: η απόφαση γράφτηκε, η απόδειξη της είναι το `closure`.
 */
export async function hashDeliveredRows(ctx: HandoverHashContext, rows: readonly HandoverLedgerProof[], budget: HandoverHashBudget): Promise<HandoverHashRun> {
  const plan = planHandoverHashing(rows.filter((row) => row.closure === null), budget.maxBytes);
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
  lastError = (await settleOpenRecoveries(ctx, out)) ?? lastError;
  const pending = out.filter((row) => row.sha256 === null && row.closure === null).length;
  return { rows: out, hashed: proven.size, pending, unverifiable, lastError };
}
