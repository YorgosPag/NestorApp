#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.118 — Η ΠΥΛΗ ΤΟΥ ΕΝΟΣ ΓΡΑΦΕΑ ΤΗΣ ΕΠΑΦΗΣ ΤΟΥ ΧΩΡΟΥ (ADR-951)
 * =============================================================================
 *
 * «Γράφει κάποιος τον δεσμό `companies/{companyId}.selfContact` ΕΞΩ από τον ΕΝΑ γραφέα;»
 *
 * 🔴 ΓΙΑΤΙ: ο δεσμός «ο χώρος ΕΙΝΑΙ αυτή η επαφή» έχει κρίσεις που ζουν ΜΟΝΟ στον γραφέα
 * (`self-contact-store.server.ts`): η επαφή υπάρχει, ανήκει στον ίδιο χώρο, είναι `type:'company'`, είναι ενεργή, ο χώρος
 * δεν δείχνει ήδη άλλη — όλα ΜΕΣΑ σε συναλλαγή, με Ιστορικό. Οι κανόνες κλείνουν τον πελάτη, ΟΧΙ το Admin SDK: ένας
 * δεύτερος γραφέας (π.χ. ένα PATCH προφίλ που «περνά και το selfContact») θα έδενε τον χώρο με επαφή άλλου χώρου ή
 * με πρόσωπο, χωρίς ίχνος. Αυτή η πύλη εμποδίζει τον ΕΠΟΜΕΝΟ γραφέα να γεννηθεί σιωπηλά.
 *
 * ── ΤΑ ΚΡΙΤΗΡΙΑ ──────────────────────────────────────────────────────────────────────
 *  Κ1 το όνομα του πεδίου (`SELF_CONTACT_FIELD`) χρησιμοποιείται ΜΟΝΟ από τους δηλωμένους κατόχους (γραφέας · ο ΕΝΑΣ
 *     αναγνώστης `selfContactOf`)
 *  Κ2 το όνομα ως ΚΥΡΙΟΛΕΚΤΙΚΟ: string `'selfContact'` / `'selfContact.…'` έξω από τη δήλωσή του · κλειδί `selfContact`
 *     σε object literal που περνά σε εγγραφή (`set` · `update` · `create` · `setDoc` · `updateDoc`) έξω από τον γραφέα
 *  Κ3 εξαίρεση ΜΟΝΟ με λόγο
 *  Κ4 καλωδίωση: οι δηλωμένοι κάτοχοι υπάρχουν και κάνουν ό,τι δηλώνουν (ο γραφέας γράφει σε συναλλαγή)
 *  Κ5 οι άλλες πόρτες μένουν ΚΛΕΙΣΤΕΣ: κανόνες `companies` (`allow write: if false`) · MCP · AI
 *
 * 🔓 Εξαίρεση ΜΟΝΟ με λόγο, στη γραμμή πάνω: `// self-contact-authority-exempt: <λόγος>`.
 *
 * @see ADR-951 · docs/gates/3.118.md · αδελφές: CHECK 3.102 · 3.114
 */

'use strict';

const ast = require('./lib/write-authority/ast');
const { openGateInput } = require('./lib/gate-input');
const { defineScanGate } = require('./lib/write-authority/gate-runner');
const { mcpAllowListFindings } = require('./lib/write-authority/mcp-write-allowlist');

const { ts, PROJECT_ROOT, calleeName } = ast;

const FIELD = 'selfContact';
const FIELD_CONSTANT = 'SELF_CONTACT_FIELD';
const WRITER = 'src/server/company/self-contact-store.server.ts';
const REFERENCE = 'src/lib/company/self-contact-ref.ts';
const RULES_FILE = 'firestore.rules';
const AI_EXECUTOR = 'src/services/ai-pipeline/tools/executor-shared-types.ts';

/** Οι δηλωμένοι κάτοχοι του ονόματος, με το πώς ΑΠΟΔΕΙΚΝΥΟΥΝ τον ρόλο τους (Κ4). Κλειστό σύνολο. */
const FIELD_OWNERS = {
  [WRITER]: 'runTransaction(',
  [REFERENCE]: 'export function selfContactOf',
};

const WRITE_CALLS = new Set(['set', 'update', 'create', 'setDoc', 'updateDoc']);
const exemptions = ast.exemptionsFor('self-contact-authority-exempt');

const STATES = {
  OWNER: 'declared-owner-uses-field',
  EXEMPT: ast.EXEMPTION_STATES.EXEMPT,
  FIELD_OUTSIDE: 'self-contact-field-outside-owner',
  LITERAL_FIELD: 'self-contact-literal-field-name',
  OWNER_UNPROVEN: 'declared-owner-unproven',
  OUTSIDE: 'direct-write-door-open',
  EXEMPT_NO_REASON: ast.EXEMPTION_STATES.EXEMPT_NO_REASON,
  SOURCE_DRIFT: 'source-drift',
};
const BLOCKING = [
  STATES.FIELD_OUTSIDE, STATES.LITERAL_FIELD, STATES.OWNER_UNPROVEN, STATES.OUTSIDE, STATES.EXEMPT_NO_REASON,
  STATES.SOURCE_DRIFT,
];

const DETAIL = {
  [STATES.FIELD_OUTSIDE]: `\`${FIELD_CONSTANT}\` έξω από τους κατόχους — εγγραφή μέσω \`${WRITER}\`, ανάγνωση μέσω \`selfContactOf\``,
  [STATES.LITERAL_FIELD]: `το όνομα \`${FIELD}\` γραμμένο με το χέρι — ο δεσμός γράφεται ΜΟΝΟ από \`${WRITER}\``,
};

const isFieldName = (text) => text === FIELD || text.startsWith(`${FIELD}.`);

/** Χρήση ονόματος ως τιμή: όχι εισαγωγή/εξαγωγή, όχι το όνομα της ίδιας της δήλωσης. */
function isValueUse(node) {
  const { parent } = node;
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) return false;
  return !(ts.isVariableDeclaration(parent) && parent.name === node);
}

/** Κλειδί μεταφράσεων (`t('selfContact.title')`) — όνομα κειμένου, όχι πεδίο της βάσης. */
const isTranslationKey = (node) => ts.isCallExpression(node.parent) && calleeName(node.parent) === 't'
  && node.parent.arguments[0] === node;

/** Κ2β: object literal με κλειδί `selfContact` που περνά σε κλήση εγγραφής. */
function literalWriteKey(call) {
  if (!WRITE_CALLS.has(calleeName(call))) return false;
  return call.arguments.some((arg) => (ast.literalKeys(arg) || []).some(isFieldName));
}

/** Η κατάσταση του κόμβου για αυτή την πύλη — ή `null` όταν δεν την αφορά. */
function stateOf(node, rel) {
  if (ts.isIdentifier(node) && node.text === FIELD_CONSTANT && isValueUse(node)) {
    return FIELD_OWNERS[rel] ? STATES.OWNER : STATES.FIELD_OUTSIDE;
  }
  if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && isFieldName(node.text)) {
    return rel === REFERENCE || isTranslationKey(node) ? null : STATES.LITERAL_FIELD;
  }
  if (ts.isCallExpression(node) && literalWriteKey(node)) return rel === WRITER ? null : STATES.LITERAL_FIELD;
  return null;
}

/** Κ1 + Κ2 + Κ3 για ένα αρχείο. */
function findingsIn(sf, rel) {
  const findings = [];
  ast.walk(sf, (node) => {
    const state = stateOf(node, rel);
    if (state === STATES.OWNER) findings.push({ state, file: rel });
    else if (state) findings.push(exemptions.classify(sf, node, rel, state, DETAIL[state]));
  });
  return findings;
}

/** Το σώμα του `match /companies/{…}` ΠΡΙΝ το πρώτο εμφωλευμένο `match`, χωρίς σχόλια — ή `null`. */
function companiesRulesHead(text) {
  const start = /match \/companies\/\{[^}]+\}\s*\{/.exec(text);
  if (!start) return null;
  const rest = text.slice(start.index + start[0].length);
  const nested = rest.search(/\bmatch \//);
  return (nested === -1 ? rest : rest.slice(0, nested)).replace(/\/\/.*$/gm, '');
}

/** Κ5α: ο browser δεν γράφει ΤΙΠΟΤΑ στο έγγραφο του χώρου — κάθε `allow` εγγραφής είναι `if false`. */
function rulesFindings(input) {
  const head = input.exists(RULES_FILE) ? companiesRulesHead(input.read(RULES_FILE)) : null;
  if (head === null) {
    return [{ state: STATES.SOURCE_DRIFT, file: RULES_FILE, detail: 'δεν βρέθηκε το `match /companies/{…}` — η πύλη δεν κρίνει στα τυφλά' }];
  }
  const writes = [...head.matchAll(/\ballow\s+([a-z,\s]+?)\s*:\s*([^;]*);/g)]
    .filter((m) => /\b(write|create|update|delete)\b/.test(m[1]));
  if (writes.length === 0) {
    return [{ state: STATES.SOURCE_DRIFT, file: RULES_FILE, detail: 'το `companies` δεν δηλώνει ρητά `allow write: if false;`' }];
  }
  return writes.filter((m) => !/^if\s+false$/.test(m[2].trim())).map((m) => ({
    state: STATES.OUTSIDE, file: RULES_FILE,
    detail: `\`allow ${m[1].trim()}: ${m[2].trim()}\` — ο browser γράφει τον χώρο, άρα και τον δεσμό, χωρίς τον γραφέα`,
  }));
}

/** Κ5γ: το έγγραφο του χώρου δεν είναι στη λίστα εγγραφής του AI. */
function aiFindings(input) {
  const text = input.exists(AI_EXECUTOR) ? input.read(AI_EXECUTOR) : null;
  const list = text && /ALLOWED_WRITE_COLLECTIONS\s*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(text);
  if (!list) return [{ state: STATES.SOURCE_DRIFT, file: AI_EXECUTOR, detail: 'δεν βρέθηκε το `ALLOWED_WRITE_COLLECTIONS` του AI' }];
  return /COLLECTIONS\.COMPANIES\b/.test(list[1].replace(/\/\/.*$/gm, ''))
    ? [{ state: STATES.OUTSIDE, file: AI_EXECUTOR, detail: 'ο χώρος στη λίστα εγγραφής του AI — παρακάμπτει τον γραφέα του δεσμού' }]
    : [];
}

/** Κ4 + Κ5. */
function wiringFindings(root, input = openGateInput({ root })) {
  const findings = [];
  for (const [owner, proof] of Object.entries(FIELD_OWNERS)) {
    const text = input.read(owner);
    if (text === null) findings.push({ state: STATES.SOURCE_DRIFT, file: owner, detail: 'δηλωμένο αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ' });
    else if (!text.includes(proof)) {
      findings.push({ state: STATES.OWNER_UNPROVEN, file: owner, detail: `δηλωμένος κάτοχος χωρίς την απόδειξή του (λείπει \`${proof}\`)` });
    }
  }
  return [
    ...findings,
    ...rulesFindings(input),
    ...mcpAllowListFindings(input, STATES, {
      forbidden: /['"`]companies['"`]/,
      detail: 'ο χώρος στη λίστα απευθείας εγγραφής του MCP — παρακάμπτει τον γραφέα του δεσμού',
    }),
    ...aiFindings(input),
  ];
}

const RELEVANT = new RegExp(`${FIELD_CONSTANT}|${FIELD}`);

const { measure, report, main } = defineScanGate({
  projectRoot: PROJECT_ROOT, relevant: RELEVANT, findingsIn, wiringFindings, states: STATES,
  check: '3.118', skipEnv: 'SKIP_SELF_CONTACT_AUTHORITY',
  ok: 'ο δεσμός «ο χώρος είναι αυτή η επαφή» γράφεται ΜΟΝΟ από τον έναν γραφέα',
  report: {
    title: '🏢 CHECK 3.118 — Πύλη του ενός γραφέα της επαφής του χώρου (ADR-951)',
    blocking: BLOCKING,
    healthy: [STATES.OWNER, STATES.EXEMPT],
    width: 36,
    remedy: [
      `ΘΕΡΑΠΕΙΑ: σύνδεση/δημιουργία/αποσύνδεση → \`linkSelfContact\` · \`createSelfContactFromWorkspace\` · \`unlinkSelfContact\` (${WRITER}).`,
      'Ανάγνωση → `selfContactOf`. ⚠️ ΜΗΝ προσθέσεις κάτοχο στο FIELD_OWNERS «επειδή βολεύει».',
    ],
  },
});

if (require.main === module) process.exit(main());

module.exports = {
  measure, report, main, findingsIn, wiringFindings, companiesRulesHead,
  STATES, BLOCKING, FIELD_OWNERS, WRITER, REFERENCE, RULES_FILE, AI_EXECUTOR,
};
