#!/usr/bin/env node
/**
 * Χώρος εργασίας πράκτορα (ADR-925): κάθε εργασία σε δικό της worktree και κλαδί.
 *
 *   npm run wt:new -- <εργασία>      νέο αντίγραφο από το main
 *   npm run wt:list                  ενεργά αντίγραφα + ελεύθερος δίσκος
 *   npm run wt:land -- <εργασία>     ένταξη στο main, ΜΟΝΟ με εντολή Giorgio
 *   npm run wt:remove -- <εργασία>   σβήσιμο αντιγράφου
 */

'use strict';

const { createWorkspace, listWorkspaces, removeWorkspace } = require('./lib/agent-worktree/lifecycle');
const { land } = require('./lib/agent-worktree/land');

function printList() {
  const { workspaces, freeBytes } = listWorkspaces();
  console.log(`Ελεύθερα στον δίσκο: ${(freeBytes / 1024 ** 3).toFixed(1)} GB`);
  if (workspaces.length === 0) console.log('Κανένα ενεργό worktree.');
  workspaces.forEach((item) => {
    const state = item.dirty ? 'αδέσμευτη δουλειά' : 'καθαρό';
    console.log(`  ${item.branch} · ${item.ahead} commit μπροστά · ${state} · ${item.dir}`);
  });
}

function printRemoved(task) {
  const result = removeWorkspace(task);
  console.log(`✅ Σβήστηκε το ${result.dir}.`);
  if (!result.branchRemoved) console.log(`⚠️ Το ${result.branch} δεν έχει ενταχθεί και κρατήθηκε, μαζί με τα commits του.`);
}

function printLanded(task) {
  const result = land(task);
  const note = result.reverified ? ' (ξανακρίθηκε πάνω στο τρέχον main)' : '';
  console.log(`✅ Το ${result.branch} εντάχθηκε στο main: ${result.head}${note}. Δεν έγινε push.`);
}

function printCreated(task) {
  const result = createWorkspace(task);
  console.log(`✅ ${result.branch}\n   ${result.dir}`);
}

const COMMANDS = { new: printCreated, list: printList, land: printLanded, remove: printRemoved };

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
