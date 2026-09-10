/**
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΟΥ ΦΡΕΝΟΥ ΜΗΚΟΥΣ** — «κόβεται η εντολή ΠΡΙΝ τη σπάσει το εργαλείο;»
 * @related .claude/hooks/bash-length-guard.js · .claude/hooks/heavy-mutex.js ·
 *          .claude-rules/feedback_write_tool_not_heredoc.md · ADR-783 (πύλη χωρίς δοκιμή)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΜΕΤΡΗΜΕΝΟ 10/09/2026
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το εργαλείο Bash στα Windows σπάει εντολές > ~7.000 χαρακτήρων με ψευδές
 * «unexpected EOF while looking for matching `''». 163 από τις 165 εντολές > 8.000
 * χαρακτήρων έσπασαν· 176/177 από αυτές περνούσαν `bash -n` αυτούσιες. Οι πράκτορες
 * το διάβαζαν ως «τα ελληνικά σπάνε το heredoc».
 *
 * ⚠️ **Η ΔΕΥΤΕΡΗ ΑΣΤΟΧΙΑ ΠΟΥ ΦΥΛΑΕΙ (ομάδα Μ)**: τα PreToolUse hooks τρέχουν ΠΑΡΑΛΛΗΛΑ.
 * Αν το `heavy-mutex` κλείδωνε μια βαριά εντολή που το φρένο αρνείται, το `release`
 * δεν θα έτρεχε ποτέ ⇒ κλειδί όμηρος 20′ για δουλειά που δεν έγινε.
 */

'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { MAX_COMMAND_CHARS, exceedsLimit, denyReason } = require('../bash-length-guard.js');

const HOOKS = path.join(__dirname, '..');
const GUARD = path.join(HOOKS, 'bash-length-guard.js');
const MUTEX = path.join(HOOKS, 'heavy-mutex.js');

/** Εκτελεί ένα hook ΟΠΩΣ ο harness: JSON στο stdin, με ξεχωριστό home για το κλειδί. */
function runHook(script, args, command, home) {
  return cp.spawnSync(process.execPath, [script, ...args], {
    input: JSON.stringify({ session_id: 'anchor-sid', tool_input: { command } }),
    env: { ...process.env, HOME: home, USERPROFILE: home },
    encoding: 'utf8',
  });
}

const longCommand = (prefix) => prefix + ' ' + '0'.repeat(MAX_COMMAND_CHARS);

// =============================================================================
// Ο — ΤΟ ΟΡΙΟ
// =============================================================================

describe('Ο — το όριο κόβει ΠΡΙΝ από τη μετρημένη θραύση', () => {
  it('🔑 Ο1 — κάτω από την πρώτη μετρημένη αποτυχία (~7.000)', () => {
    expect(MAX_COMMAND_CHARS).toBeLessThan(7000);
  });

  it('Ο2 — ακριβώς στο όριο περνά· ένας χαρακτήρας παραπάνω κόβεται', () => {
    expect(exceedsLimit('x'.repeat(MAX_COMMAND_CHARS))).toBe(false);
    expect(exceedsLimit('x'.repeat(MAX_COMMAND_CHARS + 1))).toBe(true);
  });

  it('Ο3 — ό,τι δεν είναι συμβολοσειρά δεν κόβεται (το hook δεν ρίχνει τον harness)', () => {
    expect(exceedsLimit(undefined)).toBe(false);
    expect(exceedsLimit(null)).toBe(false);
  });

  it('🔑 Ο4 — το μήνυμα λέει τη ΣΩΣΤΗ αιτία και τη ΣΩΣΤΗ διέξοδο', () => {
    const reason = denyReason(9000);
    expect(reason).toContain('9000');
    expect(reason).toContain('ΜΗΚΟΣ');
    expect(reason).toContain('`Write`');
    expect(reason).toContain('git commit -F');
  });
});

// =============================================================================
// Ε — ΕΚΤΕΛΕΣΗ ΟΠΩΣ Ο HARNESS
// =============================================================================

describe('Ε — το hook, εκτελεσμένο, αρνείται ΜΟΝΟ τη μεγάλη εντολή', () => {
  let home;
  beforeEach(() => { home = fs.mkdtempSync(path.join(os.tmpdir(), 'len-guard-')); });
  afterEach(() => { fs.rmSync(home, { recursive: true, force: true }); });

  it('🔑 Ε1 — μεγάλη εντολή ⇒ permissionDecision: deny', () => {
    const r = runHook(GUARD, [], longCommand("cat > f.md <<'EOF'"), home);
    const out = JSON.parse(r.stdout).hookSpecificOutput;
    expect(out.hookEventName).toBe('PreToolUse');
    expect(out.permissionDecision).toBe('deny');
  });

  it('Ε2 — μικρή εντολή ⇒ σιωπή (exit 0, κενό stdout)', () => {
    const r = runHook(GUARD, [], 'git status', home);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });
});

// =============================================================================
// Μ — ΤΟ ΚΛΕΙΔΙ ΔΕΝ ΜΕΝΕΙ ΟΜΗΡΟΣ ΕΝΤΟΛΗΣ ΠΟΥ ΔΕΝ ΘΑ ΤΡΕΞΕΙ
// =============================================================================

describe('Μ — το heavy-mutex δεν κλειδώνει ό,τι αρνείται το φρένο μήκους', () => {
  let home;
  const lockIn = (h) => path.join(h, '.claude', 'heavy-task.lock');
  beforeEach(() => { home = fs.mkdtempSync(path.join(os.tmpdir(), 'len-mutex-')); });
  afterEach(() => { fs.rmSync(home, { recursive: true, force: true }); });

  /** ⚠️ Ο μάρτυρας ότι η δοκιμή ΒΛΕΠΕΙ κλείδωμα — χωρίς αυτόν, το Μ2 θα περνούσε και σε σπασμένο στήσιμο. */
  it('Μ1 — μικρή βαριά εντολή ΚΛΕΙΔΩΝΕΙ (η δοκιμή βλέπει το κλειδί)', () => {
    runHook(MUTEX, ['acquire'], 'npx jest src/foo.test.ts', home);
    expect(fs.existsSync(lockIn(home))).toBe(true);
  });

  it('🔑 Μ2 — μεγάλη βαριά εντολή ΔΕΝ κλειδώνει', () => {
    runHook(MUTEX, ['acquire'], longCommand('npx jest src/foo.test.ts &&'), home);
    expect(fs.existsSync(lockIn(home))).toBe(false);
  });
});
