/**
 * =============================================================================
 * QA E2E TESTS — Contact Individual (Φυσικό Πρόσωπο)
 * =============================================================================
 *
 * Google Test Matrix — 9 Phases:
 *   Phase 1: CREATE      — Δημιουργία + αρχική συμπλήρωση ΟΛΩΝ πεδίων (ένα-ένα)
 *   Phase 2: UPDATE      — Αλλαγή υπαρχόντων πεδίων (ένα-ένα + append)
 *   Phase 3: DELETE      — Διαγραφή/εκκαθάριση πεδίων + guards
 *   Phase 4: BATCH       — Μαζικές εγγραφές (πολλά πεδία σε 1 εντολή)
 *   Phase 5: VALIDATION  — Rejection, format validation, regressions
 *   Phase 6: GUARDS      — Guardrails: ESCO protection, FIND-U, append-only, IBAN validation
 *   Phase 7: EDGE CASES  — Stress: duplicates, typos, caps, mixed lang, large batch
 *   Phase 8: CONTEXT     — Conversation awareness: implicit refs, switch, correction
 *   Phase 9: ATTACHMENTS — Profile photo, gallery photo, document upload, no-file guard
 *
 * Prerequisites:
 *   1. npm run dev (localhost:3000 running)
 *   2. Super admin configured (Telegram chatId: 5618410820)
 *
 * Usage:
 *   npx tsx scripts/qa-tests/contact-individual.qa.ts
 *
 * @module scripts/qa-tests/contact-individual.qa
 */

import { resetCollections, runMultiPhaseSuite, type QAPhase } from './qa-test-runner';
import { createTests } from './individual/phase-1-create';
import { updateTests } from './individual/phase-2-update';
import { deleteTests } from './individual/phase-3-delete';
import { batchTests } from './individual/phase-4-batch';
import { validationTests } from './individual/phase-5-validation';
import { guardTests } from './individual/phase-6-guards';
import { edgeCaseTests } from './individual/phase-7-edge-cases';
import { contextTests } from './individual/phase-8-context';
import { attachmentTests } from './individual/phase-9-attachments';

// ── Phase Definitions ────────────────────────────────────────────────
const phases: QAPhase[] = [
  { name: 'Phase 1: CREATE (27 tests)',        tests: createTests },
  { name: 'Phase 2: UPDATE (13 tests)',        tests: updateTests },
  { name: 'Phase 3: DELETE (9 tests)',          tests: deleteTests },
  { name: 'Phase 4: BATCH (6 tests)',           tests: batchTests },
  { name: 'Phase 5: VALIDATION (10 tests)',     tests: validationTests },
  { name: 'Phase 6: GUARDS (12 tests)',         tests: guardTests },
  { name: 'Phase 7: EDGE CASES (12 tests)',     tests: edgeCaseTests },
  { name: 'Phase 8: CONTEXT (8 tests)',         tests: contextTests },
  { name: 'Phase 9: ATTACHMENTS (5 tests)',     tests: attachmentTests },
];

// ── Main ─────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const totalTests = phases.reduce((sum, p) => sum + p.tests.length, 0);

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  QA E2E — Contact Individual (Φυσικό Πρόσωπο)          ║');
  console.log('║  Google Test Matrix: CRUD/BATCH/GUARD/EDGE/CTX/ATTACH  ║');
  console.log(`║  ${totalTests} tests across ${phases.length} phases                              ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  // Pre-check: wait for localhost:3000 (dev server may be compiling ~70s)
  const MAX_WAIT_ATTEMPTS = 12; // 12 × 10s = 2 min max
  let serverReady = false;
  for (let attempt = 1; attempt <= MAX_WAIT_ATTEMPTS; attempt++) {
    try {
      await fetch('http://127.0.0.1:3000/', { signal: AbortSignal.timeout(10_000) });
      serverReady = true;
      break;
    } catch {
      if (attempt === 1) {
        console.log('\n⏳ Περιμένω localhost:3000 (dev server compile ~70s)...');
      }
      console.log(`  attempt ${attempt}/${MAX_WAIT_ATTEMPTS}...`);
      await new Promise(r => setTimeout(r, 10_000));
    }
  }
  if (!serverReady) {
    console.error('\n❌ localhost:3000 δεν απαντάει μετά από 2 λεπτά. Τρέξε πρώτα: npm run dev\n');
    process.exit(1);
  }
  console.log('✅ Dev server ready\n');

  // Reset all QA collections for clean slate
  await resetCollections();

  // Wait for pipeline worker to drain any in-flight items before starting tests
  // Without this, retried items from previous runs consume OpenAI tokens
  console.log('⏳ Draining pipeline worker (30s)...');
  await new Promise(r => setTimeout(r, 30_000));
  console.log('✅ Pipeline drained — starting tests\n');

  // Run all phases sequentially (shared state across phases)
  await runMultiPhaseSuite('Contact Individual — Φυσικό Πρόσωπο', phases);
}

main().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
