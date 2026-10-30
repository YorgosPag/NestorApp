#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.105 — Η ΠΥΛΗ ΤΟΥ ΕΝΟΣ ΓΡΑΦΕΑ ΤΟΥ ΕΔΑΦΟΥΣ ΤΗΣ ΑΓΓΕΛΙΑΣ (ADR-920 §12)
 * =============================================================================
 *
 * «Γράφει κάποιος το `PublicListing.terrain` έξω από τον ΕΝΑ binder — γεννά πηγή εδάφους έξω από πόρτα που
 *  ξαναπροβάλλει — ή παράγει δημοσιεύσιμο στιγμιότυπο έξω από τον ψήστη;»
 *
 * 🔴 ΓΙΑΤΙ: το έδαφος είναι ΠΑΡΑΓΩΓΟ μετρημένου τοπογραφικού τρίτου (Δ2: δημοσιεύεται μόνο παράγωγο, ποτέ η πηγή).
 * Ο binder δέχεται ΜΟΝΟ ό,τι έψησε το ράφι — URL content-addressed και κάρτα από το ΙΔΙΟ στιγμιότυπο. Δεύτερος γραφέας
 * θα δημοσίευε bytes που κανείς δεν επικύρωσε σε ΜΟΝΙΜΗ διεύθυνση· δεύτερος παραγωγός στιγμιοτύπου θα παρέκαμπτε το
 * ράφι· πηγή γεννημένη έξω από πόρτα με επαναπροβολή θα έμενε αόρατη στην αγγελία.
 *
 * ── ΤΑ ΚΡΙΤΗΡΙΑ ───────────────────────────────────────────────────────────────────────
 *  Κ1 `terrain: { provenance … }` ή χρήση του δείκτη προέλευσης ΜΟΝΟ στον binder· `terrain: readStoredTerrain(…)` ΜΟΝΟ
 *     στους δηλωμένους κρίκους σχήματος· ο binder και κάθε κρίκος ΟΝΤΩΣ γράφουν (αλλιώς «0 = κανείς δεν κοίταξε»)
 *  Κ2 κάθε καλών του `buildPublishedTerrainFileRecord` είναι πόρτα με κάλυψη `refresh` στο `MATERIAL_DOORS` (CHECK 3.76)
 *  Κ3 `buildListingTerrainSnapshot` / `listingTerrainCardOf` έξω από το `src/lib/terrain/` ΜΟΝΟ στους δηλωμένους
 *  Κ4 κάθε δήλωση έχει λόγο ≥ 40 χαρακτήρων και ΟΝΤΩΣ κάνει ό,τι δηλώνει· κάθε δηλωμένο αρχείο υπάρχει
 *
 * ⚠️ ΤΙ ΔΕΝ ΒΛΕΠΕΙ (δηλωμένο): εγγραφή με διαδρομή-κείμενο (`update({ 'terrain.value': … })`) ή `terrain` χτισμένο σε
 * μεταβλητή ΧΩΡΙΣ `provenance` και χωρίς τον δείκτη προέλευσης. Τον ΚΑΛΟΥΝΤΑ του binder τον φυλά η CHECK 3.76· το
 * σχήμα του αποθηκευμένου εγγράφου, ο κριτής `readStoredTerrain`. ⚠️ AST, ΠΟΤΕ ΚΕΙΜΕΝΟ.
 *
 * @see ADR-920 §12 · docs/gates/3.105.md · αδελφές: CHECK 3.76 · 3.104 (`lib/write-authority/ast`)
 */

'use strict';

const ast = require('./lib/write-authority/ast');
const { defineRegistryGate } = require('./lib/write-authority/gate-runner');
const { openGateInput } = require('./lib/gate-input');
const { MATERIAL_DOORS, DOOR_COVER } = require('./lib/listing-model-custody/material-doors-contract');

const { ts, PROJECT_ROOT, calleeName } = ast;
const REGISTRY_FILE = '.listing-terrain-authority.json';
const FIELD = 'terrain';
const MIN_REASON_LENGTH = 40;

const STATES = {
  BINDER: 'binder-writes-terrain',
  SCHEMA_LINK: 'schema-link-through-judge',
  DOOR: 'source-record-refresh-door',
  DERIVATION_OWNER: 'declared-derivation-owner',
  SECOND_WRITER: 'terrain-written-outside-binder',
  UNDECLARED_LINK: 'terrain-judged-outside-schema-link',
  SILENT_DECLARATION: 'declared-file-does-not-do-it',
  SOURCE_OUTSIDE_DOOR: 'terrain-source-outside-refresh-door',
  STRAY_DERIVATION: 'terrain-derived-outside-owner',
  NO_REASON: 'declaration-without-reason',
  SOURCE_DRIFT: 'source-drift',
};
const BLOCKING = [
  STATES.SECOND_WRITER, STATES.UNDECLARED_LINK, STATES.SILENT_DECLARATION, STATES.SOURCE_OUTSIDE_DOOR,
  STATES.STRAY_DERIVATION, STATES.NO_REASON, STATES.SOURCE_DRIFT,
];

function loadRegistry(root, input = openGateInput({ root })) {
  return input.readJson(REGISTRY_FILE);
}

/** `(x)` · `x as T` · `x satisfies T` · `x!` ⇒ `x`. */
function unwrap(expression) {
  let current = expression;
  while (current && (ts.isParenthesizedExpression(current) || ts.isAsExpression(current)
    || ts.isSatisfiesExpression(current) || ts.isNonNullExpression(current))) current = current.expression;
  return current;
}

const isSourcedLiteral = (node) => ts.isObjectLiteralExpression(node)
  && node.properties.some((p) => p.name && p.name.getText().replace(/^['"]|['"]$/g, '') === 'provenance');

/** Χρήση (όχι import/export) του δείκτη προέλευσης. */
const isSourceRefUse = (node, name) => ts.isIdentifier(node) && node.text === name
  && !ts.isImportSpecifier(node.parent) && !ts.isExportSpecifier(node.parent);

/** Όσα ενδιαφέρουν την πύλη σε ένα αρχείο, σε ένα πέρασμα. */
function scan(sf, registry) {
  const facts = { sourced: [], judged: [], calls: [] };
  ast.walk(sf, (node) => {
    if (ts.isPropertyAssignment(node) && node.name.getText().replace(/^['"]|['"]$/g, '') === FIELD) {
      const value = unwrap(node.initializer);
      if (isSourcedLiteral(value)) facts.sourced.push(ast.lineOf(sf, node));
      else if (ts.isCallExpression(value) && calleeName(value) === registry.judgeFunction) facts.judged.push(ast.lineOf(sf, node));
    }
    if (isSourceRefUse(node, registry.sourceRefName) && !ts.isVariableDeclaration(node.parent)) facts.sourced.push(ast.lineOf(sf, node));
    const call = ast.callSiteOf(sf, node);
    if (call) facts.calls.push(call);
  });
  return facts;
}

const isRefreshDoor = (rel) => MATERIAL_DOORS[rel] !== undefined && MATERIAL_DOORS[rel].cover === DOOR_COVER.REFRESH;

/** Κ1 + Κ2 + Κ3 για ένα αρχείο. */
function findingsIn(rel, facts, registry) {
  const findings = [];
  const at = (state, line, detail) => findings.push({ state, file: rel, line, detail });
  if (rel !== registry.binder) {
    for (const line of facts.sourced) {
      at(STATES.SECOND_WRITER, line, `γράφει έδαφος αγγελίας — το \`PublicListing.terrain\` το γράφει ΜΟΝΟ ο ${registry.binder}`);
    }
  }
  if (registry.schemaLinks[rel] === undefined) {
    for (const line of facts.judged) {
      at(STATES.UNDECLARED_LINK, line, `\`${FIELD}: ${registry.judgeFunction}(…)\` εκτός δηλωμένου κρίκου σχήματος (${REGISTRY_FILE} → schemaLinks)`);
    }
  }
  const builders = new Set(registry.sourceRecordBuilders);
  if (!isRefreshDoor(rel)) {
    for (const call of facts.calls.filter((c) => builders.has(c.name))) {
      at(STATES.SOURCE_OUTSIDE_DOOR, call.line, `καλεί \`${call.name}\` χωρίς γραμμή \`refresh\` στο MATERIAL_DOORS (CHECK 3.76) — η αγγελία δεν θα το μάθαινε ποτέ`);
    }
  }
  const derivers = new Set(registry.derivers);
  if (!rel.startsWith(registry.derivationHome) && registry.derivationOwners[rel] === undefined) {
    for (const call of facts.calls.filter((c) => derivers.has(c.name))) {
      at(STATES.STRAY_DERIVATION, call.line, `καλεί \`${call.name}\` — δημοσιεύσιμο έδαφος παράγει ΜΟΝΟ ο ψήστης του ραφιού (και η πόρτα, ως ξηρή εκτέλεση)`);
    }
  }
  return findings;
}

/** Ετυμηγορία μιας δήλωσης: λόγος → «το κάνει;» → ✅. */
function judgeDeclaration(file, reason, doesIt, okState) {
  if (reason !== null && (typeof reason !== 'string' || reason.trim().length < MIN_REASON_LENGTH)) {
    return { state: STATES.NO_REASON, file, detail: `δήλωση χωρίς λόγο ≥ ${MIN_REASON_LENGTH} χαρακτήρων` };
  }
  return doesIt ? { state: okState, file } : { state: STATES.SILENT_DECLARATION, file, detail: 'δηλωμένο αλλά δεν το κάνει πια — σβήσε τη γραμμή ή διόρθωσε τον κώδικα' };
}

/** Κ1 (η άλλη μεριά) + Κ2 (ζωντανή πόρτα) + Κ4. Αρχείο εκτός προφίλτρου = ΜΗΔΕΝ, ποτέ σιωπή. */
function declaredFindings(root, registry, factsByFile, input = openGateInput({ root })) {
  const factsOf = (file) => factsByFile.get(file) || { sourced: [], judged: [], calls: [] };
  const declared = [registry.binder, ...Object.keys(registry.schemaLinks), ...Object.keys(registry.derivationOwners)];
  const missing = declared.filter((f) => !input.exists(f));
  const findings = missing.map((file) => ({ state: STATES.SOURCE_DRIFT, file, detail: 'δηλωμένο αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ' }));
  const live = (file) => !missing.includes(file);
  if (live(registry.binder)) findings.push(judgeDeclaration(registry.binder, null, factsOf(registry.binder).sourced.length > 0, STATES.BINDER));
  for (const [file, reason] of Object.entries(registry.schemaLinks).filter(([f]) => live(f))) {
    findings.push(judgeDeclaration(file, reason, factsOf(file).judged.length > 0, STATES.SCHEMA_LINK));
  }
  for (const [file, reason] of Object.entries(registry.derivationOwners).filter(([f]) => live(f))) {
    const derives = factsOf(file).calls.some((c) => registry.derivers.includes(c.name));
    findings.push(judgeDeclaration(file, reason, derives, STATES.DERIVATION_OWNER));
  }
  for (const [file, facts] of factsByFile) {
    if (isRefreshDoor(file) && facts.calls.some((c) => registry.sourceRecordBuilders.includes(c.name))) findings.push({ state: STATES.DOOR, file });
  }
  return findings;
}

function relevancePattern(registry) {
  const names = [registry.sourceRefName, registry.judgeFunction, ...registry.sourceRecordBuilders, ...registry.derivers];
  return new RegExp(`\\b${FIELD}['"]?\\s*:|${names.join('|')}`);
}

const { measure, report, main } = defineRegistryGate({
  check: '3.105',
  skipEnv: 'SKIP_LISTING_TERRAIN_AUTHORITY',
  ok: 'το έδαφος της αγγελίας έχει ΕΝΑΝ γραφέα, ΜΙΑ πόρτα πηγής και ΕΝΑΝ ψήστη',
  projectRoot: PROJECT_ROOT, loadRegistry, relevant: relevancePattern, scan, findingsIn, declaredFindings, states: STATES,
  report: {
    title: '⛰️  CHECK 3.105 — Πύλη του ενός γραφέα του εδάφους της αγγελίας (ADR-920 §12)',
    blocking: BLOCKING,
    healthy: [STATES.BINDER, STATES.SCHEMA_LINK, STATES.DOOR, STATES.DERIVATION_OWNER],
    width: 38,
    remedy: [
      'ΘΕΡΑΠΕΙΑ: το έδαφος φτάνει στην αγγελία ΜΟΝΟ ως ράφι → `withPublishedTerrain`. Νέα πόρτα εδάφους = γραμμή',
      `\`refresh\` στο MATERIAL_DOORS + κορμός \`publishPropertyMaterial\`. Δήλωση στο ${REGISTRY_FILE} μόνο με λόγο.`,
    ],
  },
});

if (require.main === module) process.exit(main());

module.exports = { measure, report, main, loadRegistry, STATES, BLOCKING, REGISTRY_FILE };
