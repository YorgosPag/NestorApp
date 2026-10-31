#!/usr/bin/env node
/**
 * CHECK 3.109 — Πύλη του απομονωμένου χώρου εργασίας (ADR-925).
 *
 * «Κάνει πράκτορας commit κατευθείαν στο `main`, αντί στο δικό του κλαδί;»
 *
 * Ο διακόπτης `enforce` ζει στο `.agent-worktree-policy.json` και ξεκίνησε κλειστός, γιατί
 * ενώ το κύριο αντίγραφο έχει ακόμη αδέσμευτη δουλειά πρακτόρων, η πύλη θα τους σταματούσε
 * όλους. Γυρίζει σε `true` στο επόμενο καθαρό σημείο.
 *
 * Ο άνθρωπος δεν κρίνεται: μόνο το `CLAUDECODE` ξεχωρίζει πράκτορα, και ο Giorgio κρατά
 * πάντα τον τρόπο να διορθώσει κάτι επείγον στο `main`.
 */

'use strict';

const path = require('node:path');
const { MAIN_BRANCH } = require('./lib/agent-worktree/config');
const { git } = require('./lib/agent-worktree/git');
const { commitInput } = require('./lib/gate-input');

const ROOT = path.resolve(__dirname, '..');
const POLICY_FILE = '.agent-worktree-policy.json';

function isBlocked({ enforce, isAgent, branch }) {
  return enforce === true && isAgent && branch === MAIN_BRANCH;
}

function main() {
  const { enforce } = commitInput(ROOT).readJson(POLICY_FILE);
  const branch = git(ROOT, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const isAgent = process.env.CLAUDECODE === '1';
  if (!isBlocked({ enforce, isAgent, branch })) {
    console.log(`✅ CHECK 3.109: κλαδί ${branch} · επιβολή ${enforce ? 'ενεργή' : 'ανενεργή'}.`);
    return;
  }
  console.error('❌ CHECK 3.109: πράκτορας δεν κάνει commit στο main.');
  console.error('   Δούλεψε σε δικό σου χώρο: npm run wt:new -- <εργασία> (ADR-925).');
  process.exit(1);
}

if (require.main === module) main();

module.exports = { isBlocked };
