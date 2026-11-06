#!/usr/bin/env node
/**
 * CHECK 3.114 — **Η ΠΥΛΗ ΤΟΥ ΕΝΟΣ ΓΡΑΦΕΑ ΤΟΥ ΣΤΑΔΙΟΥ ΕΥΚΑΙΡΙΑΣ** (ADR-930).
 *
 * Η ΕΡΩΤΗΣΗ: «μπορεί κάποιος να αλλάξει το στάδιο μιας ευκαιρίας ΕΞΩ από την πόρτα `POST /api/opportunities/[id]/stage` —
 * δηλαδή χωρίς έλεγχο σύγκρουσης, χωρίς στοιχεία κλεισίματος, χωρίς ίχνος;»
 *
 * Ένα σύνορο για κάθε δρόμο προς τη βάση:
 *   Κ1 — `src/` (Admin SDK): κάθε αρχείο που ονομάζει τη συλλογή ή καλεί έναν γραφέα είναι δηλωμένο, με λόγο
 *        (`lib/write-authority/symbol-owner-gate`, ίδια κρίση με 3.112/3.113). Εκεί ζουν και: ο ΕΝΑΣ καλών του
 *        φράχτη `requireOpportunityInTenant` (ο κριτής κατόχου) και ο ΕΝΑΣ καλών του `applyOpportunityOwnerTransfer`
 *        (η πόρτα `…/owner`, ADR-930 §3.8 — πρώην Κ7).
 *   Κ2 — πελάτης (ADR-930 §3.10 Βήμα Β, 2026-11-06): το `match /opportunities` του `firestore.rules` ΔΕΝ αφήνει ΚΑΜΙΑ
 *        εγγραφή — `create`, `update`, `delete` δηλωμένα `if false`, και κανένα άλλο `allow` που γράφει.
 *        Ως σήμερα η Κ2 σύγκρινε τη λίστα κλειδώματος του `update` με `STAGE_OWNED_FIELDS ∪ OWNER_OWNED_FIELDS`, και οι
 *        Κ5/Κ6 καθρέφτιζαν τον κριτή κατόχου στους κανόνες. Με κλειστούς κανόνες ο κριτής ζει σε ΕΝΑ σημείο
 *        (`decideOpportunityAccess`, server) — δεύτερη έκφραση να συγκριθεί δεν υπάρχει πια.
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
const AI_EXECUTOR = 'src/services/ai-pipeline/tools/executor-shared-types.ts';

/** Οι πράξεις εγγραφής που ΠΡΕΠΕΙ να δηλωθούν κλειστές (το `write` τις καλύπτει και τις τρεις). */
const WRITE_OPS = ['create', 'update', 'delete'];

const stripComments = (text) => text.replace(/\/\/.*$/gm, '');

/** Το σώμα του `match /opportunities/{…}` χωρίς σχόλια — ή `null`. */
function opportunitiesRulesBlock(text) {
  const block = /match \/opportunities\/\{[^}]+\}\s*\{([\s\S]*?)\n    \}/.exec(text);
  return block ? stripComments(block[1]) : null;
}

/** Οι δηλώσεις `allow <πράξεις>: <έκφραση>;` του μπλοκ. */
function allowStatements(block) {
  return [...block.matchAll(/\ballow\s+([a-z,\s]+?)\s*:\s*([\s\S]*?);/g)].map((m) => ({
    ops: m[1].split(',').map((op) => op.trim()).filter(Boolean),
    closed: /^if\s+false$/.test(m[2].trim()),
    expression: m[2].trim().replace(/\s+/g, ' '),
  }));
}

/** Κ2: ο πελάτης δεν γράφει καθόλου — κάθε πράξη εγγραφής δηλωμένη `if false`, καμία ανοιχτή. */
function rulesClosedFindings(input, STATES) {
  const block = input.exists(RULES_FILE) ? opportunitiesRulesBlock(input.read(RULES_FILE)) : null;
  if (!block) {
    return [{ state: STATES.SOURCE_DRIFT, file: RULES_FILE, detail: 'δεν βρέθηκε το `match /opportunities/{…}` — η πύλη δεν κρίνει στα τυφλά' }];
  }
  const findings = [];
  const declaredClosed = new Set();
  for (const statement of allowStatements(block)) {
    const writes = statement.ops.flatMap((op) => (op === 'write' ? WRITE_OPS : WRITE_OPS.filter((w) => w === op)));
    if (writes.length === 0) continue;
    if (statement.closed) {
      writes.forEach((op) => declaredClosed.add(op));
    } else {
      findings.push({
        state: STATES.OUTSIDE,
        file: RULES_FILE,
        detail: `\`allow ${statement.ops.join(', ')}: ${statement.expression}\` — ο browser γράφει ευκαιρία χωρίς κριτή, σχήμα και ιστορικό (μόνο ο server γράφει)`,
      });
    }
  }
  const undeclared = WRITE_OPS.filter((op) => !declaredClosed.has(op));
  if (undeclared.length > 0) {
    findings.push({
      state: STATES.SOURCE_DRIFT,
      file: RULES_FILE,
      detail: `δεν δηλώνεται ρητά κλειστό: ${undeclared.join(', ')} — γράψε \`allow create, update, delete: if false;\``,
    });
  }
  return findings;
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
    ...rulesClosedFindings(input, STATES),
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
  ok: 'η ευκαιρία γράφεται ΜΟΝΟ από τον server — στάδιο, κάτοχος και πεδία περνούν από τις πόρτες τους με κριτή, σύγκρουση και ίχνος',
  registryFile: REGISTRY_FILE,
  outsideState: 'opportunity-touched-outside-owner',
  extraFindings,
  report: {
    title: '📈 CHECK 3.114 — Πύλη του ενός γραφέα του σταδίου ευκαιρίας (ADR-930)',
    width: 36,
    remedy: [
      'ΘΕΡΑΠΕΙΑ: το στάδιο αλλάζει ΜΟΝΟ με `POST /api/opportunities/[id]/stage` (γραφέας: `opportunity-stage-transition.server.ts`).',
      'Ο κάτοχος αλλάζει ΜΟΝΟ με `POST /api/opportunities/[id]/owner` (γραφέας: `opportunity-owner-transfer.server.ts`).',
      'Τα πεδία: `POST /api/opportunities` · `PATCH|DELETE /api/opportunities/[id]` (γραφέας: `opportunities-server.service.ts`).',
      `Νέο αρχείο που αγγίζει τη συλλογή = γραμμή στο ${REGISTRY_FILE}, με λόγο. Κανόνες: \`allow create, update, delete: if false;\`.`,
    ],
  },
});

if (require.main === module) process.exit(main());

module.exports = { measure, report, main, loadRegistry, STATES, BLOCKING, REGISTRY_FILE, RULES_FILE, AI_EXECUTOR };
