#!/usr/bin/env node
'use strict';
/**
 * Worker entry point for run-checks-parallel.js.
 *
 * Runs a single check script in a sandboxed VM context so that:
 *   - process.argv returns the per-check file list (no shared-state race).
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

const { scriptPath, args, cwd } = workerData;

// Set repo-root CWD for this worker. All workers set the same value so
// any race is benign. Scripts intercept chdir via the proxy below anyway.
try { process.chdir(cwd); } catch (_) {}

const absScript = path.resolve(cwd, scriptPath);

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
    if (prop === 'argv') return ['node', absScript, ...args];
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

const code = fs.readFileSync(absScript, 'utf8');
vm.runInContext(code, ctx, { filename: absScript, lineOffset: 0 });
