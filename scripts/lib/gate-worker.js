'use strict';
/**
 * Μία πύλη σε worker thread — ο ΜΟΝΟΣ δρόμος του εκτελεστή (`run-checks-parallel.js`) προς τον
 * `worker-check-runner.js`. ADR-924 §8.6.
 *
 * 🔴 Η έξοδος έρχεται από ΑΡΧΕΙΟ, όχι από τη ροή `worker.stdout`. ΜΕΤΡΗΜΕΝΟ 2026-10-30: το σύγχρονο
 * `process.exit()` σταματά το thread πριν αδειάσει η ασύγχρονη ροή ⇒ έφτανε μόνο το ΠΡΩΤΟ chunk
 * (35/35 εκτελέσεις, 85 από τις 90 πύλες τελειώνουν με `process.exit`). Ο άνθρωπος έβλεπε μία γραμμή
 * και «exited 1». Ο worker γράφει σύγχρονα στο αρχείο· η ροή μένει για ό,τι γράφει κάτω από το JS.
 */

const { Worker } = require('worker_threads');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { judgeLedger } = require('./gate-trap');

const RED = '\x1b[0;31m';
const NC = '\x1b[0m';
const RUNNER = path.join(__dirname, '..', 'worker-check-runner.js');
const DECLARATIONS = '.gate-commit-view.json';

let workerSeq = 0;

/** Διαβάζει και σβήνει το αρχείο εξόδου ενός worker· απόν (πέθανε πριν το ανοίξει) ⇒ ''. */
function takeWorkerOutput(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return '';
    return `\n${RED}  ❌ Worker output unreadable (${file}): ${err.message}${NC}\n`;
  }
  try { fs.unlinkSync(file); } catch (_) { /* προσωρινό αρχείο — η αναφορά έχει ήδη διαβαστεί */ }
  return text;
}

const asksIndex = check => (check.args || []).includes('--index');

/**
 * ADR-924 Φ4 — **ΜΙΑ ΟΨΗ ΑΝΑ ΕΚΤΕΛΕΣΗ**: αν κάποια πύλη ζητά `--index`, το στιγμιότυπο του ευρετηρίου παίρνεται ΕΔΩ, μία
 * φορά, και δίνεται σε κάθε worker· μαζί και οι **δηλωμένες αναγνώσεις περιβάλλοντος** ανά πύλη (`environment` του
 * `.gate-commit-view.json`, από την ίδια όψη) — οι μόνες ωμές αναγνώσεις που η παγίδα ανέχεται.
 * @param {{ cwd: string, checks: Array<{ args?: string[] }> }} options
 * @returns {?{ snapshot: object, environment: Record<string, string[]> }}
 */
function prepareCommitRun({ cwd, checks }) {
  if (!checks.some(asksIndex)) return null;
  const { takeCommitSnapshot } = require('./git-index-snapshot');
  const snapshot = takeCommitSnapshot({ repoRoot: cwd });
  // ⚠️ Από τον ΔΙΣΚΟ, επίτηδες: η ανοχή περιγράφει τι επιτρέπεται να διαβάσει ο κώδικας που ΤΡΕΧΕΙ — και ο hook εκτελεί
  //    τον κώδικα του δίσκου (δηλωμένο όριο §4.2). Από το ευρετήριο, ένα commit που δεν σταδιοποίησε το μητρώο θα
  //    μπλόκαρε σε ανάγνωση που ο ίδιος ο κώδικας δηλώνει. Το περιεχόμενο του μητρώου το κρίνει η 3.107 στο commit.
  const declarations = fs.existsSync(path.join(cwd, DECLARATIONS))
    ? JSON.parse(fs.readFileSync(path.join(cwd, DECLARATIONS), 'utf8')) : {};
  const environment = Object.fromEntries(Object.entries(declarations.environment || {})
    .map(([id, entry]) => [id, entry.files || []]));
  return { snapshot, environment };
}

/** Το κατάστιχο που άφησε ο worker (`<έξοδος>.ledger`) — λείπει (timeout, crash) ⇒ `null`. Σβήνεται μετά την ανάγνωση. */
function takeLedger(outputFile) {
  const file = `${outputFile}.ledger`;
  try {
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.unlinkSync(file);
    return record;
  } catch {
    return null;
  }
}

/** Η δυναμική απόδειξη: πύλη με `--index` που δεν έκρινε το commit ⇒ αποτυχία με όνομα, ποτέ σιωπηλό πράσινο. */
function ledgerFailure(check, record, cwd) {
  if (!asksIndex(check) || !record) return '';
  const findings = judgeLedger(record, cwd);
  if (findings.length === 0) return '';
  return `\n${RED}  ⛔ CHECK ${check.id} — η όψη του commit ΔΕΝ έφτασε (ADR-924 Φ4):${NC}\n`
    + findings.map(f => `     • ${f}\n`).join('')
    + '     Θεραπεία: πέρασε την είσοδο της πύλης στη βιβλιοθήκη — ή δήλωσε ανάγνωση περιβάλλοντος (.gate-commit-view.json).\n';
}

/**
 * @param {{ id: string, script: string, args?: string[] }} check
 * @param {{ cwd: string, timeoutMs: number, run?: ?{ snapshot: object, environment: Record<string, string[]> } }} options
 *   `run` = `prepareCommitRun` (μία φορά ανά εκτέλεση)
 * @returns {Promise<object>} `{ ...check, exitCode, output }`
 */
function runThread(check, { cwd, timeoutMs, run = null }) {
  const outputFile = path.join(os.tmpdir(), `gate-${process.pid}-${check.id}-${++workerSeq}.log`);
  const commitRun = run && asksIndex(check)
    ? { snapshot: run.snapshot, environment: run.environment[check.id] || [] }
    : {};
  return new Promise(resolve => {
    const worker = new Worker(RUNNER, {
      workerData: { scriptPath: check.script, args: check.args || [], cwd, outputFile, ...commitRun },
      stdout: true,
      stderr: true,
    });

    let streamed = '';
    let failure = null;   // { tail } από timeout/error — το `exit` που ακολουθεί είναι η ΜΙΑ λύση
    worker.stdout.on('data', chunk => { streamed += chunk; });
    worker.stderr.on('data', chunk => { streamed += chunk; });

    const timer = setTimeout(() => {
      failure = { tail: `\n${RED}  ⏰ CHECK ${check.id} timed out after ${timeoutMs / 1000}s${NC}\n` };
      worker.terminate();
    }, timeoutMs);

    worker.on('error', err => {
      failure = { tail: `\n${RED}  ❌ Worker error [${check.id}]: ${err.message}${NC}\n` };
    });

    // Το `exit` εκπέμπεται ΠΑΝΤΑ (και μετά από `error` ή `terminate`) και αφού κλείσει το thread ⇒
    // το αρχείο εξόδου είναι πλήρες όταν το διαβάζουμε.
    worker.on('exit', code => {
      clearTimeout(timer);
      const proof = ledgerFailure(check, takeLedger(outputFile), cwd);
      const exitCode = failure || proof ? 1 : (code ?? 0);
      resolve({ ...check, exitCode, output: takeWorkerOutput(outputFile) + streamed + (failure?.tail ?? '') + proof });
    });
  });
}

module.exports = { runThread, prepareCommitRun };
