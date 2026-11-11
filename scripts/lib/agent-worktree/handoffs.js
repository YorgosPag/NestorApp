'use strict';
/**
 * Συλλογή των handoffs ενός worktree στο κύριο αντίγραφο (ADR-925 §9, 2026-11-11).
 *
 * Το handoff γράφεται στο `HANDOFFS/` του worktree, που είναι αγνοημένο από το git. Αν δεν
 * συλλεγεί, χάνεται με το `git worktree remove` και δεν μπαίνει ποτέ στο backup, που
 * αντιγράφει μόνο το κύριο αντίγραφο.
 *
 * Κανόνες, ώστε η συλλογή να μην καταστρέφει ποτέ τίποτα:
 *  · πηγή: μόνο τα UNTRACKED `HANDOFFS/*.md` (τα tracked ταξιδεύουν ήδη με το git)·
 *  · προορισμός tracked στο κύριο αντίγραφο: ποτέ εγγραφή (θα λέρωνε το `main`)·
 *  · ίδια bytes ⇒ τίποτα (ιδεμποτικό)· νεότερη πηγή ⇒ αντικατάσταση·
 *    παλαιότερη ή ίσης ηλικίας πηγή με άλλο περιεχόμενο ⇒ σύγκρουση, καμία εγγραφή·
 *  · ατομική γραφή με διατήρηση του mtime της πηγής.
 */

const fs = require('node:fs');
const path = require('node:path');
const { writeFileAtomic } = require('../fs/atomic-write');
const { HANDOFF_DIR, HANDOFF_EXTENSION } = require('./config');
const { isTracked, untrackedFiles } = require('./git');

/** Μόνο άμεσα παιδιά του φακέλου: υποφάκελοι δεν είναι handoffs. */
function handoffName(relative) {
  const [dir, name, ...rest] = relative.split('/');
  const isHandoff = dir === HANDOFF_DIR && rest.length === 0 && Boolean(name) && name.endsWith(HANDOFF_EXTENSION);
  return isHandoff ? name : null;
}

/** Τα ονόματα των untracked handoffs του worktree. Άδειο αν ο φάκελος δεν υπάρχει. */
function pendingHandoffs(worktreeDir) {
  if (!fs.existsSync(path.join(worktreeDir, HANDOFF_DIR))) return [];
  return untrackedFiles(worktreeDir, `${HANDOFF_DIR}/`).map(handoffName).filter(Boolean).sort();
}

const sameBytes = (a, b) => fs.readFileSync(a).equals(fs.readFileSync(b));

/** @returns {'copy' | 'unchanged' | 'tracked' | 'destination-newer'} */
function decide(source, destination, tracked) {
  const target = fs.statSync(destination, { throwIfNoEntry: false });
  if (!target) return tracked ? 'tracked' : 'copy';
  if (sameBytes(source, destination)) return 'unchanged';
  if (tracked) return 'tracked';
  return fs.statSync(source).mtimeMs > target.mtimeMs ? 'copy' : 'destination-newer';
}

function copyHandoff(source, destination) {
  const { mtime } = fs.statSync(source);
  writeFileAtomic(destination, fs.readFileSync(source), { mtime });
}

/**
 * @param {string} worktreeDir
 * @param {string} primaryDir
 * @returns {{ copied: string[], unchanged: string[], conflicts: { name: string, reason: string }[] }}
 */
function harvestHandoffs(worktreeDir, primaryDir) {
  const result = { copied: [], unchanged: [], conflicts: [] };
  for (const name of pendingHandoffs(worktreeDir)) {
    const source = path.join(worktreeDir, HANDOFF_DIR, name);
    const destination = path.join(primaryDir, HANDOFF_DIR, name);
    const action = decide(source, destination, isTracked(primaryDir, `${HANDOFF_DIR}/${name}`));
    if (action === 'copy') {
      copyHandoff(source, destination);
      result.copied.push(name);
    } else if (action === 'unchanged') {
      result.unchanged.push(name);
    } else {
      result.conflicts.push({ name, reason: action });
    }
  }
  return result;
}

/**
 * Δεύτερος, ανεξάρτητος έλεγχος πριν από σβήσιμο: ποια handoffs του worktree ΔΕΝ υπάρχουν
 * byte-ίδια στο κύριο αντίγραφο. Δεν εμπιστεύεται την αναφορά της συλλογής.
 */
function unharvested(worktreeDir, primaryDir) {
  return pendingHandoffs(worktreeDir).filter((name) => {
    const destination = path.join(primaryDir, HANDOFF_DIR, name);
    return !fs.existsSync(destination) || !sameBytes(path.join(worktreeDir, HANDOFF_DIR, name), destination);
  });
}

/** Για το `wt:land`: η αποτυχία της συλλογής δεν ακυρώνει ένταξη που ήδη έγινε, αναφέρεται. */
function tryHarvest(worktreeDir, primaryDir) {
  try {
    return harvestHandoffs(worktreeDir, primaryDir);
  } catch (error) {
    return { copied: [], unchanged: [], conflicts: [], error: error.message };
  }
}

/**
 * Για το `wt:remove`: συλλογή και επαλήθευση, αλλιώς εξαίρεση ΠΡΙΝ σβηστεί οτιδήποτε.
 * @returns {ReturnType<typeof harvestHandoffs>}
 */
function secureHandoffs(worktreeDir, primaryDir) {
  const result = harvestHandoffs(worktreeDir, primaryDir);
  const names = [...result.conflicts.map((item) => item.name), ...unharvested(worktreeDir, primaryDir)];
  if (names.length > 0) {
    const list = [...new Set(names)].map((name) => `  ${path.join(worktreeDir, HANDOFF_DIR, name)}`).join('\n');
    throw new Error(
      `Handoffs που δεν συλλέχθηκαν στο ${path.join(primaryDir, HANDOFF_DIR)}. Δεν σβήνω τίποτα.\n${list}\n` +
        'Σύγκρινε κάθε ένα με το ομώνυμο του κύριου αντιγράφου, κράτα το σωστό και ξανατρέξε.',
    );
  }
  return result;
}

module.exports = { harvestHandoffs, pendingHandoffs, secureHandoffs, tryHarvest, unharvested };
