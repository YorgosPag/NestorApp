#!/usr/bin/env node
/**
 * build-firestore-rules — compile the authored firestore.rules SSoT into a
 * minified deploy artifact that fits under Firebase's hard 256 KiB ruleset limit.
 *
 * WHY (ADR-298 / N.7 GOL + N.12 SSoT):
 *   `firestore.rules` is the Single Source of Truth — fully commented, documented,
 *   and the file every test (`tests/firestore-rules/_harness/emulator.ts`) and the
 *   coverage manifest (CHECK 3.16) read directly. Accumulated rule blocks
 *   (ADR-406/407/408 …) pushed the SOURCE past 256 KiB, so the
 *   `firebaserules.googleapis.com:test` deploy precheck rejects it with a generic
 *   400 INVALID_ARGUMENT. Google's pattern: keep the human-readable source as the
 *   SSoT, DERIVE a minified artifact for the wire. Never hand-edit the artifact.
 *
 * WHAT (semantics-preserving — provably no behaviour change):
 *   - strips whole-line `//` comments and trailing inline `//` comments
 *     (string-safe: `//` inside a single-quoted literal is preserved)
 *   - strips leading/trailing whitespace and blank lines
 *   - preserves every token and newline separator (Firestore rules are
 *     newline-tolerant; only comments + indentation are removed)
 *
 * The output `firestore.rules.compiled` is what `firebase.json` deploys; the
 * `predeploy` hook regenerates it before every deploy so it can never drift.
 *
 * Run: `node scripts/build-firestore-rules.js` (also `npm run rules:build`).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SOURCE_PATH = path.resolve(__dirname, '..', 'firestore.rules');
const OUTPUT_PATH = path.resolve(__dirname, '..', 'firestore.rules.compiled');
const FIREBASE_RULESET_LIMIT_BYTES = 256 * 1024; // 262144 — hard platform limit.

/**
 * Remove an inline/whole-line `//` comment from a single rules line, ignoring any
 * `//` that appears inside a single-quoted string literal. Firestore rules use
 * single quotes for strings and have no block comments, so a one-pass scan with a
 * quote-state flag is exact.
 * @param {string} line
 * @returns {string} the line with its comment (if any) removed
 */
function stripComment(line) {
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'") {
      inString = !inString;
    } else if (!inString && ch === '/' && line[i + 1] === '/') {
      return line.slice(0, i);
    }
  }
  return line;
}

function build() {
  const source = fs.readFileSync(SOURCE_PATH, 'utf8');
  const compiled = source
    .split('\n')
    .map((line) => stripComment(line).trim())
    .filter((line) => line.length > 0)
    .join('\n');
  const out = compiled.endsWith('\n') ? compiled : compiled + '\n';

  const sourceBytes = Buffer.byteLength(source, 'utf8');
  const compiledBytes = Buffer.byteLength(out, 'utf8');

  if (compiledBytes >= FIREBASE_RULESET_LIMIT_BYTES) {
    console.error(
      `✖ Compiled firestore rules are ${compiledBytes} bytes — still over the ` +
        `${FIREBASE_RULESET_LIMIT_BYTES}-byte (256 KiB) Firebase limit. ` +
        `Further reduction needed (split logic into reusable functions / drop dead blocks).`,
    );
    process.exit(1);
  }

  fs.writeFileSync(OUTPUT_PATH, out, 'utf8');
  const pct = ((1 - compiledBytes / sourceBytes) * 100).toFixed(1);
  console.log(
    `✓ firestore.rules.compiled written — ${sourceBytes} → ${compiledBytes} bytes ` +
      `(−${pct}%, ${FIREBASE_RULESET_LIMIT_BYTES - compiledBytes} bytes under the 256 KiB limit).`,
  );
}

build();
