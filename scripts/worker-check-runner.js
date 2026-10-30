#!/usr/bin/env node
'use strict';
/**
 * Worker entry point for run-checks-parallel.js.
 *
 * Runs a single check script in a sandboxed VM context so that:
 *   - process.argv returns the per-check file list — the REAL one of this worker thread, so the check's
 *     libraries see it too (ADR-924 §8.9), not only the script.
 *   - process.chdir() is a no-op (CWD already set to repo root).
 *   - process.exit(code) terminates only this worker thread, not the main process.
 *   - All console output flows through the worker's redirected stdout
 *     (Worker created with stdout:true in the parent), enabling ordered
 *     output collection without interleaving.
 *
 * workerData shape: { scriptPath: string, args: string[], cwd: string }
 */

const { isMainThread, workerData } = require('worker_threads');

if (isMainThread) {
  console.error('[worker-check-runner] must be loaded as a Worker thread, not run directly');
  process.exit(1);
}

const vm     = require('vm');
const fs     = require('fs');
const path   = require('path');
const Module = require('module');

const { scriptPath, args, cwd, outputFile } = workerData;

// 🔴 ΜΕΤΡΗΜΕΝΟ 2026-10-30 (ADR-924 §8.6): το σύγχρονο `process.exit()` σταματά το thread ΠΡΙΝ αδειάσει
// η ασύγχρονη ροή `worker.stdout` προς τον γονέα — έφτανε μόνο το ΠΡΩΤΟ chunk (35/35 εκτελέσεις), άρα
// ο άνθρωπος έβλεπε μία γραμμή + «exited 1». 85 από τις 90 πύλες τελειώνουν με `process.exit`.
// Η εγγραφή σε αρχείο είναι σύγχρονη στο Node ⇒ ό,τι τυπώθηκε ΠΡΙΝ το exit είναι ήδη στον δίσκο.
// Ποτέ αναμονή-για-άδειασμα: θα άφηνε τον κώδικα ΜΕΤΑ το `exit()` να συνεχίσει.
if (outputFile) {
  const fd = fs.openSync(outputFile, 'w');
  const writeSync = (chunk, encoding, callback) => {
    fs.writeSync(fd, typeof chunk === 'string' ? Buffer.from(chunk, typeof encoding === 'string' ? encoding : 'utf8') : chunk);
    const done = typeof encoding === 'function' ? encoding : callback;
    if (typeof done === 'function') done();
    return true;
  };
  process.stdout.write = writeSync;
  process.stderr.write = writeSync;
}

// Set repo-root CWD for this worker. All workers set the same value so
// any race is benign. Scripts intercept chdir via the proxy below anyway.
try { process.chdir(cwd); } catch (_) {}

const absScript = path.resolve(cwd, scriptPath);

// 🔴 ΜΕΤΡΗΜΕΝΟ 2026-10-30 (ADR-924 §8.9): τα ορίσματα ζούσαν ΜΟΝΟ στο Proxy του `process` που βλέπει το script. Κάθε
// βιβλιοθήκη που φορτώνει (`commitInput(root)`, `runSetRatchetCli`, `defineScanGate`) ρωτούσε το ΠΡΑΓΜΑΤΙΚΟ `process.argv`
// του worker — χωρίς `--index` ⇒ κρίση του δίσκου, σιωπηλά (3.93: 25 αρχεία αντί για 21). Το `process.argv` ενός worker
// thread είναι ΔΙΚΟ του (ένας worker ανά πύλη) ⇒ τίθεται εδώ, μία πηγή για script ΚΑΙ βιβλιοθήκες.
process.argv = ['node', absScript, ...args];

// ADR-924 Φ4 — ΤΟ ΣΤΙΓΜΙΟΤΥΠΟ, Η ΠΑΓΙΔΑ, ΤΟ ΚΑΤΑΣΤΙΧΟ. Η είσοδος (`gate-input`) φορτώνεται εδώ από το ΙΔΙΟ αρχείο που θα
// φορτώσει και η πύλη (κοινή cache modules του worker) ⇒ ό,τι υιοθετείται/καταγράφεται εδώ το βλέπει και η πύλη.
// Με `--index`: η όψη της εκτέλεσης (ένα στιγμιότυπο για όλες τις πύλες) + η παγίδα σε ωμές αναγνώσεις αρχείων που ο
// δίσκος ΔΕΝ ταυτίζεται με το commit. Το κατάστιχο γράφεται ΣΥΓΧΡΟΝΑ στο `exit` (εκπέμπεται και μετά από `process.exit`).
// ⚠️ Ο κώδικας της πύλης διαβάζεται ΠΡΙΝ στηθεί η παγίδα: είναι κώδικας που εκτελείται (δηλωμένο όριο §4.2), όχι δεδομένα.
const code = fs.readFileSync(absScript, 'utf8');
const { adoptCommitSnapshot, inputLedger } = require('./lib/gate-input');
const { installReadTrap } = require('./lib/gate-trap');
const { snapshot, environment } = workerData;
let trapped = [];
if (snapshot) {
  adoptCommitSnapshot(snapshot);
  trapped = installReadTrap(fs, {
    root: cwd, suspect: [...snapshot.divergent, ...snapshot.untracked], exempt: environment || [],
  });
}
if (outputFile) {
  process.on('exit', () => {
    fs.writeFileSync(`${outputFile}.ledger`, JSON.stringify({ opened: inputLedger().opened, trapped }));
  });
}

// require() rooted at the check script's directory so relative requires work.
const scriptRequire = Module.createRequire(absScript);

// Fake module object — enables `require.main === module` guards in check scripts.
const fakeModule = new Module(absScript);
fakeModule.filename = absScript;
fakeModule.loaded   = false;
fakeModule.require  = scriptRequire;
fakeModule.paths    = Module._nodeModulePaths(path.dirname(absScript));
scriptRequire.main  = fakeModule;

// Proxy that overrides argv / chdir while delegating everything else (including
// process.exit) to the real process. In Node 12+, process.exit() called from
// a worker thread terminates only that worker, not the parent process.
const scriptProcess = new Proxy(process, {
  get(target, prop, receiver) {
    if (prop === 'chdir') return () => {};
    return Reflect.get(target, prop, receiver);
  },
  set(target, prop, value, receiver) {
    return Reflect.set(target, prop, value, receiver);
  },
});

// Build VM context. `console` here is the worker thread's console which writes
// to the redirected worker.stdout stream — output is buffered by the parent.
const ctx = vm.createContext({
  process:        scriptProcess,
  require:        scriptRequire,
  module:         fakeModule,
  exports:        fakeModule.exports,
  __filename:     absScript,
  __dirname:      path.dirname(absScript),
  console,
  Buffer,
  global:         globalThis,
  globalThis,
  setTimeout,
  setInterval,
  clearTimeout,
  clearInterval,
  setImmediate,
  clearImmediate,
  queueMicrotask,
  URL,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
});

vm.runInContext(code, ctx, { filename: absScript, lineOffset: 0 });
