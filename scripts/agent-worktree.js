#!/usr/bin/env node
/**
 * Χώρος εργασίας πράκτορα (ADR-925): κάθε εργασία σε δικό της worktree και κλαδί.
 *
 *   npm run wt:new -- <εργασία>      νέο αντίγραφο από το main
 *   npm run wt:list                  ενεργά αντίγραφα + ελεύθερος δίσκος
 *   npm run wt:land -- <εργασία>     ένταξη στο τοπικό main, αμέσως μετά από κάθε commit (ποτέ push)
 *   npm run wt:remove -- <εργασία>   σβήσιμο αντιγράφου (συλλέγει πρώτα τα handoffs· αρνείται αν δεν τα πάρει όλα)
 *   npm run wt:handoffs -- <εργασία> συλλογή των handoffs στο HANDOFFS/ του κύριου αντιγράφου
 *   npm run wt:handoffs -- --all     το ίδιο για κάθε ενεργό worktree πράκτορα
 */

'use strict';

const path = require('node:path');
const { HANDOFF_DIR, locate } = require('./lib/agent-worktree/config');
const { primaryDir } = require('./lib/agent-worktree/git');
const { harvestHandoffs } = require('./lib/agent-worktree/handoffs');
const { createWorkspace, listWorkspaces, removeWorkspace, requireWorkspace } = require('./lib/agent-worktree/lifecycle');
const { land } = require('./lib/agent-worktree/land');

const ALL_FLAG = '--all';

const REASONS = {
  tracked: 'το ομώνυμο του κύριου αντιγράφου είναι tracked στο git· δεν γράφεται',
  'destination-newer': 'το ομώνυμο του κύριου αντιγράφου είναι νεότερο και διαφέρει',
};

/** Η αναφορά μιας συλλογής, ίδια για land · remove · handoffs. Επιστρέφει αν όλα συλλέχθηκαν. */
function printHarvest(result, primary) {
  if (!result) return true;
  const destination = path.join(primary, HANDOFF_DIR);
  if (result.error) console.error(`⚠️ Η συλλογή handoffs απέτυχε: ${result.error}`);
  result.copied.forEach((name) => console.log(`   📄 ${path.join(destination, name)}`));
  if (result.unchanged.length > 0) console.log(`   ${result.unchanged.length} handoff ήδη συλλεγμένα, αμετάβλητα.`);
  result.conflicts.forEach(({ name, reason }) => console.error(`⚠️ Σύγκρουση handoff ${name}: ${REASONS[reason] || reason}.`));
  return !result.error && result.conflicts.length === 0;
}

function describeState({ missing, dirty }) {
  if (missing) return 'ο φάκελος λείπει, καθάρισέ το με wt:remove';
  return dirty ? 'αδέσμευτη δουλειά' : 'καθαρό';
}

function printList() {
  const { workspaces, freeBytes } = listWorkspaces();
  console.log(`Ελεύθερα στον δίσκο: ${(freeBytes / 1024 ** 3).toFixed(1)} GB`);
  if (workspaces.length === 0) console.log('Κανένα ενεργό worktree.');
  workspaces.forEach((item) => {
    const state = describeState(item);
    console.log(`  ${item.branch} · ${item.ahead} commit μπροστά · ${state} · ${item.dir}`);
  });
}

function printRemoved(task) {
  const result = removeWorkspace(task);
  if (result.nothingFound) {
    console.log(`Δεν υπάρχει τίποτα για σβήσιμο: ${result.dir} · ${result.branch}.`);
    return;
  }
  if (result.branchKept) console.log(`⚠️ Το ${result.branch} κρατήθηκε, μαζί με τα commits του.\n   ${result.branchKept}`);
  printHarvest(result.handoffs, primaryDir(process.cwd()));
  if (!result.residue) {
    console.log(`✅ Σβήστηκε το ${result.dir}.`);
    return;
  }
  console.error(`⚠️ Έμεινε το ${result.dir} (${result.residue}): κάποια διεργασία το κρατά, συνήθως τερματικό ή συνεδρία με cwd μέσα του.`);
  console.error(`   Κλείσ' την και ξανατρέξε: npm run wt:remove -- ${task}`);
  process.exitCode = 1;
}

function printLanded(task) {
  const result = land(task);
  const note = result.reverified ? ' (ξανακρίθηκε πάνω στο τρέχον main)' : '';
  console.log(`✅ Το ${result.branch} εντάχθηκε στο main: ${result.head}${note}. Δεν έγινε push.`);
  if (!printHarvest(result.handoffs, primaryDir(process.cwd()))) {
    console.error(`   Τα handoffs έμειναν στο worktree. Λύσε τη σύγκρουση και τρέξε: npm run wt:handoffs -- ${task}`);
    process.exitCode = 1;
  }
}

/** `--all`: κάθε ενεργό worktree πράκτορα που υπάρχει στον δίσκο· αλλιώς το ένα που ζητήθηκε. */
function harvestTargets(task) {
  const cwd = process.cwd();
  if (task === ALL_FLAG) return listWorkspaces({ cwd }).workspaces.filter((item) => !item.missing);
  return [requireWorkspace(cwd, locate(task))];
}

function printHandoffs(task) {
  const primary = primaryDir(process.cwd());
  const targets = harvestTargets(task);
  if (targets.length === 0) console.log('Κανένα ενεργό worktree.');
  let complete = true;
  targets.forEach((entry) => {
    console.log(`${entry.branch} · ${entry.dir}`);
    const result = harvestHandoffs(entry.dir, primary);
    if (result.copied.length + result.unchanged.length + result.conflicts.length === 0) console.log('   Κανένα handoff.');
    complete = printHarvest(result, primary) && complete;
  });
  if (!complete) process.exitCode = 1;
}

function printCreated(task) {
  const result = createWorkspace(task);
  console.log(`✅ ${result.branch}\n   ${result.dir}`);
}

const COMMANDS = {
  new: printCreated,
  list: printList,
  land: printLanded,
  remove: printRemoved,
  handoffs: printHandoffs,
};

function main([command, task]) {
  const run = COMMANDS[command];
  if (!run) throw new Error(`Άγνωστη εντολή «${command}». Διαθέσιμες: ${Object.keys(COMMANDS).join(', ')}.`);
  run(task);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
