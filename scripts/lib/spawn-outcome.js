#!/usr/bin/env node
/**
 * SSoT — «έτρεξε όντως το εργαλείο που ζήτησε μια πύλη;» (ADR-598 G13 · G14 · ADR-757).
 *
 * ── ΓΙΑΤΙ ΥΠΑΡΧΕΙ ──────────────────────────────────────────────────────────────
 * Ο κανόνας του σπιτιού (ADR-598 §7): **μια πύλη που αποτυγχάνει για τον λάθος λόγο κρύβει
 * τον σωστό**. Το μοντέλο είναι το τετράστατο του Monitoring Plugins / Nagios: CRITICAL =
 * «μέτρησα και είναι κακό», UNKNOWN = «δεν μπόρεσα να μετρήσω». Και τα δύο μπλοκάρουν —
 * αλλά **δεν** είναι το ίδιο μήνυμα.
 *
 * Γεννήθηκε στο `tsc-runner.js` (τρεις πύλες tsc, τρεις λάθος ιδέες για το «απέτυχε»).
 * Εξήχθη εδώ **2026-09-16** όταν χρειάστηκε και η δεύτερη οικογένεια: η μηχανή πολιτικής
 * αδειών (CHECK 12). Εκεί η ίδια σύγχυση κόστισε **ψευδές** μήνυμα: `mktemp` απέτυχε,
 * το `2>/dev/null` πέταξε την αιτία, και ο hook ανέφερε «license-checker produced no
 * output» για ένα εργαλείο που **δεν ξεκίνησε ποτέ**. Δεύτερο αντίγραφο του ταξινομητή θα
 * ήταν ακριβώς το δίδυμο που απαγορεύει ο N.18.
 *
 * ── ΤΙ ΔΙΑΦΕΡΕΙ ΑΝΑ ΕΡΓΑΛΕΙΟ, ΚΑΙ ΜΕΝΕΙ ΣΤΟΝ ΚΑΛΟΥΝΤΑ ─────────────────────────
 *   · `textSignatures` — κείμενο που αλλάζει την ερμηνεία ΠΡΙΝ το σήμα (το OOM του V8:
 *     τυπώνει και μετά κάνει abort, άρα κουβαλά και σήμα — βλ. `Μ2β` στο tsc-runner.test).
 *   · `nonZeroIsFailure` — το `tsc` βγαίνει ≠0 όταν **βρίσκει** σφάλματα (κανονικό)· το
 *     `pnpm licenses list` βγαίνει ≠0 μόνο όταν **δεν** μέτρησε.
 *   · `describeSignal` — τι σημαίνει ένα σήμα για το συγκεκριμένο εργαλείο.
 * Ό,τι χρειάζεται το ΠΕΡΙΕΧΟΜΕΝΟ της εξόδου (`no-output`, `unparseable`) το αποφασίζει ο
 * καλών: μόνο εκείνος ξέρει τι payload περίμενε. Οι τιμές ζουν εδώ ώστε όλοι να μιλούν
 * το ίδιο λεξιλόγιο.
 */

'use strict';

const SPAWN_OUTCOME = Object.freeze({
  RAN: 'ran',
  SPAWN_FAILED: 'spawn-failed',
  KILLED: 'killed',
  OUTPUT_TRUNCATED: 'output-truncated',
  EXITED_NONZERO: 'exited-nonzero',
  NO_OUTPUT: 'no-output',
  UNPARSEABLE: 'unparseable',
});

const TRUNCATED_DETAIL = 'stdout exceeded maxBuffer — output is incomplete, parsing it would undercount';

function combineOutput(result) {
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

const defaultSignalDetail = (signal) => `terminated by ${signal}`;

/**
 * Καθαρός ταξινομητής πάνω σε αποτέλεσμα σχήματος `spawnSync`.
 *
 * ⚠️ Η σειρά είναι φέρουσα: `error` (περικοπή, μετά αποτυχία εκκίνησης) → κείμενο → σήμα →
 * κωδικός εξόδου → RAN. Αν το σήμα ελεγχθεί πριν το κείμενο, κάθε OOM του V8 γίνεται
 * «killed»· αν ο κωδικός πριν το σήμα, ένας σκοτωμένος γίνεται «exited-nonzero».
 *
 * @param {{error?: {code?: string, message?: string}, status?: number|null, signal?: string|null, stdout?: string, stderr?: string}} result
 * @param {{textSignatures?: {outcome: string, detail: string, match: (text: string) => boolean}[],
 *          nonZeroIsFailure?: boolean, describeSignal?: (signal: string) => string}} [options]
 * @returns {{outcome: string, detail: string|null}}
 */
function classifySpawnResult(result, options = {}) {
  const { textSignatures = [], nonZeroIsFailure = false, describeSignal = defaultSignalDetail } = options;
  if (result.error && result.error.code === 'ENOBUFS') {
    return { outcome: SPAWN_OUTCOME.OUTPUT_TRUNCATED, detail: TRUNCATED_DETAIL };
  }
  if (result.error) {
    return { outcome: SPAWN_OUTCOME.SPAWN_FAILED, detail: String(result.error.message || result.error) };
  }
  const combined = combineOutput(result);
  const hit = textSignatures.find((sig) => sig.match(combined));
  if (hit) return { outcome: hit.outcome, detail: hit.detail };
  if (result.signal) {
    return { outcome: SPAWN_OUTCOME.KILLED, detail: describeSignal(result.signal) };
  }
  if (nonZeroIsFailure && result.status !== 0) {
    return { outcome: SPAWN_OUTCOME.EXITED_NONZERO, detail: `exit status ${result.status}` };
  }
  return { outcome: SPAWN_OUTCOME.RAN, detail: null };
}

/** Τα τελευταία N χαρακτήρες της εξόδου του εργαλείου — η απόδειξη που παλιά χανόταν. */
function outputTail(text, limit = 2000) {
  const trimmed = String(text || '').trim();
  if (trimmed.length <= limit) return trimmed;
  return `…(truncated, last ${limit} chars)…\n${trimmed.slice(-limit)}`;
}

/**
 * Το μήνυμα μιας πύλης που **δεν έχει μέτρηση**. Ρητά `UNKNOWN`, ώστε κανείς να μην το διαβάσει
 * ως «βρέθηκε πρόβλημα», και πάντα με τα τελευταία λόγια του ίδιου του εργαλείου.
 * `notice` = τι ΔΕΝ σημαίνει για τη συγκεκριμένη πύλη · `extraLines` = πεδία του εργαλείου
 * (π.χ. το ταβάνι heap του tsc).
 */
function formatUnmeasured({ outcome, detail, command, status, signal, output, tool = 'tool', notice, extraLines = [] }) {
  return [
    `⚠️  UNKNOWN — the measurement did not happen (state: ${outcome}).`,
    `   ${notice || 'This is NOT a finding: nothing was measured. Fix the run, then read the result.'}`,
    `   why:     ${detail || 'no further detail'}`,
    `   command: ${command}`,
    ...extraLines,
    `   exit:    status=${status === undefined ? 'n/a' : status} signal=${signal || 'none'}`,
    `   ── ${tool} output (tail) ─────────────────────────────────────────────`,
    outputTail(output) || `   (${tool} produced no output at all)`,
  ].join('\n');
}

module.exports = {
  SPAWN_OUTCOME,
  TRUNCATED_DETAIL,
  classifySpawnResult,
  combineOutput,
  outputTail,
  formatUnmeasured,
};
