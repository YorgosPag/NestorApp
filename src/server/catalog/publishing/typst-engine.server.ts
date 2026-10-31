import 'server-only';

/**
 * =============================================================================
 * Ο ΕΚΤΕΛΕΣΤΗΣ ΤΟΥ TYPST (ADR-923 §5.6 · §5.6.1) — το ΕΝΑ σημείο που ξεκινά τη μηχανή
 * =============================================================================
 *
 * | Φρουρός | Γιατί |
 * |---|---|
 * | `spawn` χωρίς φλοιό, ορίσματα ως πίνακας | καμία τιμή δεν ερμηνεύεται από shell |
 * | περιβάλλον κλειστό (`TEMP`/`PATH` μόνο) | η μηχανή δεν βλέπει τα κλειδιά της εφαρμογής |
 * | `--root` = φάκελος εργασίας | καμία ανάγνωση έξω από αυτόν |
 * | `--ignore-system-fonts` + `--font-path` | μόνο γραμματοσειρές του μητρώου (CHECK 3.69), ίδιο PDF σε κάθε μηχάνημα |
 * | χρονικό όριο με `kill` | κολλημένη απόδοση δεν τρώει τον διακομιστή |
 * | ουρά μίας δουλειάς | 4,5–8,6 s CPU ανά 345 σελίδες· δύο μαζί θα πάγωναν τις αιτήσεις |
 *
 * 🔑 **Δηλωμένη απουσία**: το Typst δεν υπάρχει ακόμη στην παραγωγή. Η έλλειψη είναι {@link TypstUnavailableError} με
 *    όνομα, όχι τυχαίο `ENOENT`: η έκδοση καταγράφει `engineUnavailable` και το UI το λέει καθαρά.
 * @module server/catalog/publishing/typst-engine.server
 */

import { spawn } from 'node:child_process';

import { createPriorityTaskQueue } from '@/lib/async/priority-task-queue';

/** Η έκδοση με την οποία μετρήθηκε ο εκδότης (§21). Άλλη έκδοση αλλάζει bytes, άρα μπαίνει στο κλειδί ιδεμποτίας. */
export const TYPST_EXPECTED_VERSION = '0.15.1';

/** Όριο απόδοσης: 345 σελίδες μετρήθηκαν 4,5–8,6 s· το πολλαπλάσιο καλύπτει βαριές εικόνες σε αδύναμο μηχάνημα. */
export const TYPST_RENDER_TIMEOUT_MS = 5 * 60 * 1000;
export const TYPST_PREVIEW_TIMEOUT_MS = 20 * 1000;
const STDERR_LIMIT_CHARS = 8000;

export class TypstUnavailableError extends Error {
  constructor(readonly reason: 'missing' | 'versionMismatch', detail: string) {
    super(`typst unavailable (${reason}): ${detail}`);
    this.name = 'TypstUnavailableError';
  }
}

export class TypstFailedError extends Error {
  constructor(readonly outcome: 'failed' | 'timeout', readonly diagnostics: string) {
    super(`typst ${outcome}`);
    this.name = 'TypstFailedError';
  }
}

export interface TypstInvocation {
  readonly cwd: string;
  readonly args: readonly string[];
  readonly timeoutMs: number;
}

/** Η πόρτα προς τη μηχανή — οι δοκιμές δίνουν δική τους, ώστε η ροή να ελέγχεται χωρίς εκτελέσιμο. */
export type TypstRunner = (invocation: TypstInvocation) => Promise<void>;

const binaryPath = (): string => process.env.CATALOG_TYPST_BIN?.trim() || 'typst';

function closedEnvironment(): NodeJS.ProcessEnv {
  const { PATH, Path, TEMP, TMP, SystemRoot } = process.env;
  return { PATH: PATH ?? Path, TEMP, TMP, SystemRoot };
}

function runProcess(invocation: TypstInvocation): Promise<{ readonly stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath(), [...invocation.args], { cwd: invocation.cwd, env: closedEnvironment(), shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new TypstFailedError('timeout', stderr)); }, invocation.timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString('utf8')).slice(-STDERR_LIMIT_CHARS); });
    child.on('error', (cause: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(cause.code === 'ENOENT' ? new TypstUnavailableError('missing', binaryPath()) : cause);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout });
      else reject(new TypstFailedError('failed', stderr));
    });
  });
}

/** Το `typst 0.15.1 (abc)` → `0.15.1`. */
export function parseTypstVersion(output: string): string | null {
  return /\btypst\s+(\d+\.\d+\.\d+)/i.exec(output)?.[1] ?? null;
}

/** Υπάρχει η μηχανή, και είναι η έκδοση που μετρήθηκε; Αλλιώς ονομασμένη άρνηση. */
export async function assertTypstAvailable(): Promise<string> {
  const { stdout } = await runProcess({ cwd: process.cwd(), args: ['--version'], timeoutMs: 10_000 });
  const version = parseTypstVersion(stdout);
  if (version !== TYPST_EXPECTED_VERSION) throw new TypstUnavailableError('versionMismatch', stdout.trim());
  return version;
}

const queue = createPriorityTaskQueue(1);

/** Ο πραγματικός εκτελεστής: μία απόδοση τη φορά ανά διεργασία, η προεπισκόπηση προηγείται της πλήρους έκδοσης. */
export const runTypst: TypstRunner = (invocation) =>
  queue.schedule(`${invocation.cwd}:${invocation.args.join(' ')}`, { priority: invocation.timeoutMs <= TYPST_PREVIEW_TIMEOUT_MS ? 0 : 1, group: 'catalog-typst' }, async () => {
    await runProcess(invocation);
  });
