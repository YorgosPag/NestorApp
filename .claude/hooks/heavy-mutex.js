#!/usr/bin/env node
/**
 * Φρένο βαριών εντολών — ΕΝΑ κλειδί, μία βαριά εργασία τη φορά.
 *
 * ΓΙΑΤΙ: μετρημένο 31/08/2026 σε i5-4440S (4 πυρήνες, χωρίς hyper-threading):
 *   μία `jest` γεμίζει το CPU στο 100% μόνη της, ενώ μια συνεδρία σε αδράνεια
 *   κοστίζει ~0%. Ο περιορισμός είναι οι πυρήνες, ΟΧΙ η RAM — άρα το ταβάνι
 *   ανήκει στις ΒΑΡΙΕΣ ΕΡΓΑΣΙΕΣ, όχι στο πλήθος συνεδριών ή διεργασιών.
 *   (Ταβάνι πλήθους θα ήταν λάθος μοχλός: 25 chrome = 1,6% CPU vs 2 jest = 45%.)
 *
 * Χρήση: node heavy-mutex.js acquire   (PreToolUse)
 *        node heavy-mutex.js release   (PostToolUse)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const LOCK = path.join(os.homedir(), '.claude', 'heavy-task.lock');
const STALE_MINUTES = 90;

/** Εντολές που μονοπωλούν το μηχάνημα. */
const HEAVY = [
  /\bjest\b/,
  /\bnext\s+build\b/,
  /\btsc\b/,
  /\bssot:audit\b/,
  /\bnpm\s+(run\s+)?test\b/,
  /\bpnpm\s+(run\s+)?test\b/,
  /\bjscpd\b/,
];

/**
 * Εξαιρέσεις — ΠΟΤΕ δεν μπλοκάρονται.
 * Το `git commit` τρέχει το pre-commit hook, που τρέχει tests: αν το φρένο
 * το έπιανε, ο Giorgio δεν θα μπορούσε να κάνει commit όσο τρέχει άλλο jest.
 */
const EXEMPT = [
  /\bgit\s+commit\b/,
  /\bgit\s+push\b/,
  /heavy-mutex/,
];

function isHeavy(cmd) {
  if (EXEMPT.some((re) => re.test(cmd))) return false;
  return HEAVY.some((re) => re.test(cmd));
}

function readLock() {
  try {
    const raw = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
    const ageMin = (Date.now() - raw.startedAt) / 60000;
    if (ageMin > STALE_MINUTES) return null; // μπαγιάτικο -> ελεύθερο
    return { ...raw, ageMin };
  } catch {
    return null; // δεν υπάρχει ή είναι χαλασμένο -> ελεύθερο
  }
}

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

function main() {
  const mode = process.argv[2];
  const input = readStdin();
  const cmd = (input.tool_input && input.tool_input.command) || '';
  const sid = input.session_id || 'unknown';

  if (!isHeavy(cmd)) return; // σιωπή: exit 0, καμία παρέμβαση

  if (mode === 'release') {
    const held = readLock();
    if (held && held.sessionId === sid) {
      try { fs.unlinkSync(LOCK); } catch {}
    }
    return;
  }

  // acquire
  const held = readLock();
  if (held && held.sessionId !== sid) {
    const mins = Math.round(held.ageMin);
    const other = String(held.command).slice(0, 90);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          'ΦΡΕΝΟ ΒΑΡΙΩΝ ΕΡΓΑΣΙΩΝ: τρέχει ήδη βαριά εντολή σε άλλη συνεδρία ' +
          '(' + held.sessionId.slice(0, 8) + ', εδώ και ' + mins + ' λεπτά): ' + other +
          '. Το μηχάνημα έχει 4 πυρήνες και μία τέτοια εντολή τους γεμίζει. ' +
          'Κάνε άλλη δουλειά στο μεταξύ και ξαναδοκίμασε αργότερα — ΜΗΝ την τρέξεις ' +
          'με άλλο τρόπο για να παρακάμψεις το φρένο.',
      },
    }));
    return;
  }

  try {
    fs.mkdirSync(path.dirname(LOCK), { recursive: true });
    fs.writeFileSync(LOCK, JSON.stringify({
      sessionId: sid,
      command: cmd.slice(0, 200),
      startedAt: Date.now(),
    }));
  } catch {}
}

main();
