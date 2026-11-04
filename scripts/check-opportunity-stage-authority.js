#!/usr/bin/env node
/**
 * CHECK 3.114 — **Η ΠΥΛΗ ΤΟΥ ΕΝΟΣ ΓΡΑΦΕΑ ΤΟΥ ΣΤΑΔΙΟΥ ΕΥΚΑΙΡΙΑΣ** (ADR-929).
 *
 * Η ΕΡΩΤΗΣΗ: «μπορεί κάποιος να αλλάξει το στάδιο μιας ευκαιρίας ΕΞΩ από την πόρτα `POST /api/opportunities/[id]/stage` —
 * δηλαδή χωρίς έλεγχο σύγκρουσης, χωρίς στοιχεία κλεισίματος, χωρίς ίχνος;»
 *
 * Τέσσερα σύνορα, ένα για κάθε δρόμο προς τη βάση:
 *   Κ1 — `src/` (Admin SDK): κάθε αρχείο που ονομάζει τη συλλογή ή καλεί τον γραφέα είναι δηλωμένο, με λόγο
 *        (`lib/write-authority/symbol-owner-gate`, ίδια κρίση με 3.112/3.113).
 *   Κ2 — πελάτης: η λίστα του `firestore.rules` που κλειδώνει τα πεδία σταδίου είναι ΑΚΡΙΒΩΣ το `STAGE_OWNED_FIELDS`
 *        του κώδικα. Δύο λίστες που αποκλίνουν = πεδίο που ο πελάτης γράφει ενώ ο κώδικας νομίζει ότι δεν μπορεί.
 *   Κ3 — MCP: οι ευκαιρίες ΔΕΝ είναι στη λίστα απευθείας εγγραφής (`mcp-server/src/security/access-control.ts`).
 *   Κ4 — AI: οι ευκαιρίες ΔΕΝ είναι στο `ALLOWED_WRITE_COLLECTIONS` του executor.
 *
 * @see docs/gates/3.114.md
 */

'use strict';

const { defineSymbolOwnerGate } = require('./lib/write-authority/symbol-owner-gate');
const { mcpAllowListFindings } = require('./lib/write-authority/mcp-write-allowlist');

const REGISTRY_FILE = '.opportunity-stage-authority.json';
const RULES_FILE = 'firestore.rules';
const STAGE_FIELDS_SOURCE = 'src/services/crm/opportunity-stage-transition.ts';
const AI_EXECUTOR = 'src/services/ai-pipeline/tools/executor-shared-types.ts';

/** Οι συμβολοσειρές μιας λίστας `'a', 'b'` (με ή χωρίς αλλαγές γραμμής). */
const quotedNames = (body) => [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();

/** Η λίστα κλειδώματος μέσα στο `match /opportunities/{…}` — ή `null`. */
function rulesStageFields(text) {
  const block = /match \/opportunities\/\{[^}]+\}\s*\{([\s\S]*?)\n    \}/.exec(text);
  const list = block && /affectedKeys\(\)\.hasAny\(\[([\s\S]*?)\]\)/.exec(block[1].replace(/\/\/.*$/gm, ''));
  return list ? quotedNames(list[1]) : null;
}

function codeStageFields(text) {
  const match = /export const STAGE_OWNED_FIELDS = \[([\s\S]*?)\] as const;/.exec(text);
  return match ? quotedNames(match[1]) : null;
}

function rulesParityFindings(input, STATES) {
  const rules = input.exists(RULES_FILE) ? rulesStageFields(input.read(RULES_FILE)) : null;
  const code = input.exists(STAGE_FIELDS_SOURCE) ? codeStageFields(input.read(STAGE_FIELDS_SOURCE)) : null;
  if (!rules || !code) {
    return [{ state: STATES.SOURCE_DRIFT, file: rules ? STAGE_FIELDS_SOURCE : RULES_FILE, detail: 'δεν βρέθηκε η λίστα πεδίων σταδίου — η πύλη δεν κρίνει στα τυφλά' }];
  }
  return rules.join() === code.join() ? [] : [{
    state: STATES.OUTSIDE,
    file: RULES_FILE,
    detail: `οι κανόνες κλειδώνουν [${rules.join(', ')}] αλλά ο κώδικας δηλώνει [${code.join(', ')}]`,
  }];
}

function aiWriteFindings(input, STATES) {
  const text = input.exists(AI_EXECUTOR) ? input.read(AI_EXECUTOR) : null;
  const list = text && /ALLOWED_WRITE_COLLECTIONS\s*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(text);
  if (!list) return [{ state: STATES.SOURCE_DRIFT, file: AI_EXECUTOR, detail: 'δεν βρέθηκε το `ALLOWED_WRITE_COLLECTIONS` του AI' }];
  return /COLLECTIONS\.OPPORTUNITIES\b/.test(list[1].replace(/\/\/.*$/gm, ''))
    ? [{ state: STATES.OUTSIDE, file: AI_EXECUTOR, detail: 'οι ευκαιρίες στη λίστα εγγραφής του AI — παρακάμπτει την πόρτα σταδίου' }]
    : [];
}

function extraFindings(root, input, STATES) {
  return [
    ...rulesParityFindings(input, STATES),
    ...mcpAllowListFindings(input, STATES, {
      forbidden: /['"`]opportunities['"`]/,
      detail: 'οι ευκαιρίες στη λίστα απευθείας εγγραφής του MCP — παρακάμπτει την πόρτα σταδίου',
    }),
    ...aiWriteFindings(input, STATES),
  ];
}

const { measure, report, main, loadRegistry, STATES, BLOCKING } = defineSymbolOwnerGate({
  check: '3.114',
  skipEnv: 'SKIP_OPPORTUNITY_STAGE_AUTHORITY',
  ok: 'το στάδιο ευκαιρίας έχει ΕΝΑΝ γραφέα — κάθε μετακίνηση περνά από την πόρτα με έλεγχο σύγκρουσης και ίχνος',
  registryFile: REGISTRY_FILE,
  outsideState: 'opportunity-touched-outside-owner',
  extraFindings,
  report: {
    title: '📈 CHECK 3.114 — Πύλη του ενός γραφέα του σταδίου ευκαιρίας (ADR-929)',
    width: 36,
    remedy: [
      'ΘΕΡΑΠΕΙΑ: το στάδιο αλλάζει ΜΟΝΟ με `POST /api/opportunities/[id]/stage` (γραφέας: `opportunity-stage-transition.server.ts`).',
      `Νέο αρχείο που αγγίζει τη συλλογή = γραμμή στο ${REGISTRY_FILE}, με λόγο. Κανόνες ⇄ STAGE_OWNED_FIELDS: ίδια λίστα.`,
    ],
  },
});

if (require.main === module) process.exit(main());

module.exports = { measure, report, main, loadRegistry, STATES, BLOCKING, REGISTRY_FILE, RULES_FILE, STAGE_FIELDS_SOURCE, AI_EXECUTOR };
