#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.106 — Η ΠΥΛΗ ΤΟΥ ΕΝΟΣ ΓΡΑΦΕΑ ΤΟΥ ΣΧΗΜΑΤΟΣ ΚΑΤΑΛΟΓΟΥ (ADR-923 §5.9)
 * =============================================================================
 *
 * «Γράφει κάποιος σχήμα καταλόγου (ιδιότητα · ομάδα · οικογένεια μέτρησης · κατηγορία · οικογένεια) ΕΞΩ από
 *  τη μηχανή αποθήκευσης — δηλαδή χωρίς επικύρωση απέναντι στη βιβλιοθήκη, χωρίς CAS, χωρίς ίχνος;»
 *
 * 🔑 ΓΙΑΤΙ: οι κανόνες Firestore κλείνουν τον ΠΕΛΑΤΗ (`allow write: if false`), όχι τον Admin SDK. Ένα δεύτερο
 * `db.collection(COLLECTIONS.CATALOG_FAMILIES).doc(x).set(…)` στον διακομιστή θα έγραφε οικογένεια που δείχνει σε
 * ιδιότητα που δεν υπάρχει, θα ξεκλείδωνε αλλαγή τύπου σε χρησιμοποιημένη ιδιότητα (παράγωγο `attributeIds`
 * εκτός συγχρονισμού) ή θα έσπαγε το `ancestorIds` ενός κλάδου — και κανείς δεν θα το μάθαινε (χωρίς ίχνος).
 * Ίδια οικογένεια με CHECK 3.87 · 3.88 · 3.89 · 3.102.
 *
 * ── ΤΑ ΚΡΙΤΗΡΙΑ ───────────────────────────────────────────────────────────────────────────
 *  Κ1 εγγραφή (`set/update/create/delete` · `setDoc/updateDoc/deleteDoc/addDoc`) σε `COLLECTIONS.CATALOG_*`
 *     ΜΟΝΟ στη μηχανή αποθήκευσης
 *  Κ2 η αναφορά εγγράφου της μηχανής (`catalogDocRef(`) ΜΟΝΟ στα δηλωμένα αρχεία — αλλιώς είναι πόρτα γύρω από Κ1
 *  Κ3 εξαίρεση ΜΟΝΟ με λόγο (`// catalog-schema-authority-exempt: <λόγος>` στη γραμμή πάνω)
 *  Κ4 καλωδίωση: η μηχανή ΟΝΤΩΣ κάνει συναλλαγή + ίχνος, κάθε γραφέας ΟΝΤΩΣ περνά από τη συναλλαγή της
 *  Κ5 η πόρτα απευθείας εγγραφής (MCP `WRITE_ALLOWED_COLLECTIONS`) μένει ΚΛΕΙΣΤΗ για κάθε `catalog_*`
 *  Κ6 (Φάση 2β, ADR-923 §5.10 Θωράκιση 1) ο ΜΟΝΟΣ δρόμος για παράγωγα (`stageDerived`) γράφει ΜΟΝΟ `derived`:
 *     (α) το σώμα του δεν αγγίζει αναθεώρηση / σφραγίδα / ίχνος (αλλιώς κάθε επανυπολογισμός = ψευδή 409 + ψεύτικο
 *     ιστορικό), (β) τον καλεί ΜΟΝΟ η μηχανή του συνόλου (αλλιώς είναι πόρτα που γράφει χωρίς κρίση του συνόλου)
 *     Φάση 3β (ADR-923 §5.11): η **έκδοση τιμοκαταλόγου** είναι επίσης μηχανή συνόλου (ρίζα των γραμμών της), και ο
 *     δρόμος της **σποράς** (`stageCopied` — γραμμές αντιγραμμένες από αμετάβλητη έκδοση, ΧΩΡΙΣ ίχνος ανά γραμμή)
 *     ανήκει στον ίδιο κανόνα (β): εκτός μηχανής συνόλου θα ήταν εγγραφή χωρίς ιστορικό
 *
 * @see ADR-923 §5.9 · docs/gates/3.106.md · αδελφή: CHECK 3.102
 */

'use strict';

const ast = require('./lib/write-authority/ast');
const { openGateInput } = require('./lib/gate-input');
const { defineScanGate } = require('./lib/write-authority/gate-runner');

const { ts, PROJECT_ROOT } = ast;

const CATALOG_COLLECTIONS = [
  'COLLECTIONS.CATALOG_ATTRIBUTES',
  'COLLECTIONS.CATALOG_ATTRIBUTE_GROUPS',
  'COLLECTIONS.CATALOG_MEASUREMENT_FAMILIES',
  'COLLECTIONS.CATALOG_CATEGORIES',
  'COLLECTIONS.CATALOG_FAMILIES',
  // Φάση 2β (ADR-923 §5.10) — τα δεδομένα
  'COLLECTIONS.CATALOG_PRODUCT_MODELS',
  'COLLECTIONS.CATALOG_PRODUCTS',
  'COLLECTIONS.CATALOG_ASSETS',
  'COLLECTIONS.CATALOG_SETTINGS',
  'COLLECTIONS.CATALOG_UNIQUE_VALUES',
  // Φάση 3β (ADR-923 §5.11) — η τιμολόγηση
  'COLLECTIONS.CATALOG_PRICE_LISTS',
  'COLLECTIONS.CATALOG_PRICE_LIST_VERSIONS',
  'COLLECTIONS.CATALOG_PRICE_LIST_LINES',
  'COLLECTIONS.CATALOG_DISCOUNT_GROUPS',
  'COLLECTIONS.CATALOG_CUSTOMER_GROUPS',
  'COLLECTIONS.CATALOG_CUSTOMER_ASSIGNMENTS',
  'COLLECTIONS.CATALOG_DISCOUNT_CONDITIONS',
  'COLLECTIONS.CATALOG_PRICING_SLOTS',
  // Φάση 3δ (ADR-923 §5.11 «3δ» Ζ · ADR-905) — τα σήματα όψεων τιμών: γράφει ΜΟΝΟ ο γραφέας τους, καλεσμένος από τη μηχανή
  'COLLECTIONS.CATALOG_PRICING_VIEW_SIGNALS',
];
/** Τα ονόματα των συλλογών στη βάση — για την πόρτα του MCP (Κ5). */
const CATALOG_COLLECTION_NAMES = [
  'catalog_attributes', 'catalog_attribute_groups', 'catalog_measurement_families', 'catalog_categories', 'catalog_families',
  'catalog_product_models', 'catalog_products', 'catalog_assets', 'catalog_settings', 'catalog_unique_values',
  'catalog_price_lists', 'catalog_price_list_versions', 'catalog_price_list_lines', 'catalog_discount_groups',
  'catalog_customer_groups', 'catalog_customer_assignments', 'catalog_discount_conditions', 'catalog_pricing_slots',
  'catalog_pricing_view_signals',
];

const STORE = 'src/server/catalog/catalog-store.server.ts';
const LIBRARY_READS = 'src/server/catalog/catalog-library-reads.server.ts';
const KINDS = 'src/server/catalog/catalog-kinds.ts';
const DIRECT_WRITE_DOOR = 'mcp-server/src/security/access-control.ts';

const UNIQUE_RESERVATIONS = 'src/server/catalog/unique-reservations.server.ts';
const AGGREGATE = 'src/server/catalog/catalog-aggregate.server.ts';
/** Φάση 3β — η μηχανή συνόλου της έκδοσης τιμοκαταλόγου και ο σχεδιαστής των υποδοχών ασάφειας. */
const PRICE_AGGREGATE = 'src/server/catalog/price-version-aggregate.server.ts';
const PRICING_SLOTS = 'src/server/catalog/pricing-slots.server.ts';
/** Φάση 3δ — ο ΕΝΑΣ γραφέας των σημάτων όψεων τιμών (ADR-905): τον καλεί ΜΟΝΟ η μηχανή, μέσα στη συναλλαγή. */
const PRICING_VIEW_SIGNALS = 'src/server/catalog/pricing-view-signal.server.ts';

/** Ποια αρχεία επιτρέπεται να καλούν `catalogDocRef(` (Κ2) — η μηχανή γράφει, οι αναγνώσεις διαβάζουν. */
const DOC_REF_USERS = new Set([STORE, LIBRARY_READS]);
/** Οι αναφορές εγγράφου της μηχανής (Κ2) → ποια αρχεία τις καλούν. Η κράτηση διαβάζεται μόνο από τον σχεδιαστή της. */
const DOC_REF_FUNCTIONS = {
  catalogDocRef: DOC_REF_USERS,
  uniqueValueRef: new Set([STORE, UNIQUE_RESERVATIONS]),
  pricingSlotRef: new Set([STORE, PRICING_SLOTS]),
  pricingViewSignalRef: new Set([PRICING_VIEW_SIGNALS]),
};
/** Ποιος καλεί τον δρόμο των παραγώγων (Κ6β): μόνο η μηχανή του συνόλου, που κρίνει το σύνολο πριν γράψει. */
const DERIVED_USERS = new Set([STORE, AGGREGATE, PRICE_AGGREGATE]);
/** Ποιος σπέρνει γραμμές χωρίς ίχνος ανά γραμμή (Κ6β, Φάση 3β): μόνο η μηχανή συνόλου της έκδοσης. */
const COPIED_USERS = new Set([STORE, PRICE_AGGREGATE]);
/** Ό,τι το σώμα του `stageDerived` ΔΕΝ πρέπει να αγγίζει (Κ6α). */
const DERIVED_FORBIDDEN = ['revision', 'updatedAt', 'updatedBy', 'changes.push', 'recordTrackedEntityWrite'];

/** Κάθε δηλωμένος γραφέας, με το πώς ΑΠΟΔΕΙΚΝΥΕΙ ότι περνά από τη μηχανή (Κ4). Κλειστό σύνολο. */
const WIRING = {
  // Φάση 3δ: η μηχανή ΟΦΕΙΛΕΙ να σηματοδοτεί — αλλιώς γραφή τιμών χωρίς σήμα = οθόνη μπαγιάτικη ως το F5 (ADR-905 §4.2).
  [STORE]: ['runTransaction(', 'recordTrackedEntityWrite(', 'signalPricingViewsInTx(', 'noteWrite('],
  'src/server/catalog/attribute-writer.server.ts': ['runCatalogTransaction('],
  'src/server/catalog/attribute-group-writer.server.ts': ['runCatalogTransaction('],
  'src/server/catalog/measurement-family-writer.server.ts': ['runCatalogTransaction('],
  'src/server/catalog/category-writer.server.ts': ['runCatalogTransaction('],
  'src/server/catalog/family-writer.server.ts': ['runCatalogTransaction('],
  // Φάση 2β — δεδομένα: κάθε γραφέας στη συναλλαγή· η μηχανή του συνόλου κρίνει, κρατά και γράφει παράγωγα.
  'src/server/catalog/product-model-writer.server.ts': ['runCatalogTransaction(', 'commitAggregate('],
  'src/server/catalog/product-writer.server.ts': ['runCatalogTransaction(', 'commitAggregate('],
  'src/server/catalog/asset-writer.server.ts': ['runCatalogTransaction('],
  'src/server/catalog/catalog-settings-writer.server.ts': ['runCatalogTransaction('],
  'src/server/catalog/completeness-recompute.server.ts': ['runCatalogTransaction(', 'commitAggregate('],
  [AGGREGATE]: ['judgeAggregate(', 'planUniqueReservations(', 'stageReservationPlan(', 'stageDerived('],
  // Φάση 3β — τιμολόγηση: κάθε γραφέας στη συναλλαγή· η έκδοση κλειδώνει τις γραμμές της.
  'src/server/catalog/price-list-writer.server.ts': ['runCatalogTransaction('],
  'src/server/catalog/pricing-group-writer.server.ts': ['runCatalogTransaction('],
  'src/server/catalog/customer-assignment-writer.server.ts': ['runCatalogTransaction('],
  'src/server/catalog/discount-condition-writer.server.ts': ['runCatalogTransaction('],
  'src/server/catalog/price-version-writer.server.ts': ['runCatalogTransaction('],
  'src/server/catalog/price-line-writer.server.ts': ['runCatalogTransaction(', 'readDraftForLines(', 'stageLinesTouched('],
  'src/server/catalog/price-publication.server.ts': ['runCatalogTransaction(', 'assertRevision('],
  [PRICE_AGGREGATE]: ['stageDerived(', 'stageCopied(', "status !== 'draft'"],
  [PRICING_SLOTS]: ['stagePricingSlot('],
  [PRICING_VIEW_SIGNALS]: ['FieldValue.increment(1)'],
  // Οι υποδοχές (όπως οι κρατήσεις) δεν είναι είδη: ευρετήριο του γραφέα, χωρίς ιστορικό.
  [KINDS]: CATALOG_COLLECTIONS.filter(
    (key) => !['COLLECTIONS.CATALOG_UNIQUE_VALUES', 'COLLECTIONS.CATALOG_PRICING_SLOTS', 'COLLECTIONS.CATALOG_PRICING_VIEW_SIGNALS'].includes(key),
  ),
};

const WRITE_METHODS = new Set(['set', 'update', 'create', 'delete']);
const CLIENT_WRITES = new Set(['setDoc', 'updateDoc', 'deleteDoc', 'addDoc']);
const exemptions = ast.exemptionsFor('catalog-schema-authority-exempt');

const STATES = {
  STORE: 'declared-store',
  EXEMPT: ast.EXEMPTION_STATES.EXEMPT,
  WRITE_OUTSIDE: 'catalog-write-outside-store',
  DOC_REF_OUTSIDE: 'catalog-doc-ref-outside-declared',
  STORE_UNASKED: 'store-unasked',
  DIRECT_DOOR_OPEN: 'direct-write-door-open',
  EXEMPT_NO_REASON: ast.EXEMPTION_STATES.EXEMPT_NO_REASON,
  SOURCE_DRIFT: 'source-drift',
  DERIVED_TRACKED: 'derived-path-tracked',
  DERIVED_OUTSIDE: 'derived-write-outside-aggregate',
};
const BLOCKING = [
  STATES.WRITE_OUTSIDE, STATES.DOC_REF_OUTSIDE, STATES.STORE_UNASKED, STATES.DIRECT_DOOR_OPEN,
  STATES.EXEMPT_NO_REASON, STATES.SOURCE_DRIFT, STATES.DERIVED_TRACKED, STATES.DERIVED_OUTSIDE,
];
const DETAIL = {
  [STATES.WRITE_OUTSIDE]: `γράφει σχήμα καταλόγου έξω από τη μηχανή — πέρασε από τους γραφείς του \`src/server/catalog/\` (${STORE})`,
  [STATES.DOC_REF_OUTSIDE]: 'αναφορά εγγράφου της μηχανής (`catalogDocRef(`/`uniqueValueRef(`) εκτός δηλωμένων αρχείων — πόρτα γύρω από τη μηχανή',
  [STATES.DERIVED_OUTSIDE]: '`stageDerived(` / `stageCopied(` εκτός μηχανής συνόλου — γράφει παράγωγα ή σπέρνει χωρίς ίχνος, χωρίς να κρίνει το σύνολο (Κ6β)',
};

/** Γράφει αυτή η κλήση σε συλλογή καταλόγου; */
function isCatalogWrite(call, refsByKey) {
  const callee = call.expression;
  const touches = (expression) => CATALOG_COLLECTIONS.some((key) => ast.refersTo(expression, refsByKey.get(key), key));
  if (ts.isIdentifier(callee) && CLIENT_WRITES.has(callee.text)) return touches(call.arguments[0]);
  if (!ts.isPropertyAccessExpression(callee) || !WRITE_METHODS.has(callee.name.text)) return false;
  return touches(callee.expression) || touches(call.arguments[0]);
}

const classify = (sf, node, rel, state) => exemptions.classify(sf, node, rel, state, DETAIL[state]);

/** Κ1 + Κ2 + Κ3 για ένα αρχείο. */
function findingsIn(sf, rel) {
  if (rel === STORE) return [{ state: STATES.STORE, file: rel }];
  const refsByKey = new Map(CATALOG_COLLECTIONS.map((key) => [key, ast.refIdentifiersOf(sf, key)]));
  const findings = [];
  ast.walk(sf, (node) => {
    if (!ts.isCallExpression(node)) return;
    if (isCatalogWrite(node, refsByKey)) findings.push(classify(sf, node, rel, STATES.WRITE_OUTSIDE));
    else if (Object.entries(DOC_REF_FUNCTIONS).some(([fn, users]) => ast.isCallTo(node, fn) && !users.has(rel))) {
      findings.push(classify(sf, node, rel, STATES.DOC_REF_OUTSIDE));
    } else if (ast.isCallTo(node, 'stageDerived') && !DERIVED_USERS.has(rel)) {
      findings.push(classify(sf, node, rel, STATES.DERIVED_OUTSIDE));
    } else if (ast.isCallTo(node, 'stageCopied') && !COPIED_USERS.has(rel)) {
      findings.push(classify(sf, node, rel, STATES.DERIVED_OUTSIDE));
    }
  });
  return findings;
}

/** Είναι κάποια `catalog_*` μέλος του συνόλου εγγραφής του MCP; (AST: σχόλιο που την ονομάζει δεν μετρά.) */
function directDoorOpen(text) {
  const sf = ast.sourceFileOf(DIRECT_WRITE_DOOR, text);
  let open = false;
  ast.walk(sf, (node) => {
    if (!ts.isVariableDeclaration(node) || node.name.getText() !== 'WRITE_ALLOWED_COLLECTIONS' || !node.initializer) return;
    ast.walk(node.initializer, (member) => {
      if (ts.isStringLiteral(member) && CATALOG_COLLECTION_NAMES.includes(member.text)) open = true;
    });
  });
  return open;
}

/** Κ6α: το σώμα του `stageDerived` (χωρίς σχόλια) — γράφει ΜΟΝΟ `derived`, χωρίς αναθεώρηση/σφραγίδα/ίχνος. */
function derivedPathFindings(storeText) {
  const sf = ast.sourceFileOf(STORE, storeText);
  let body = null;
  ast.walk(sf, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.name.text === 'stageDerived' && node.body) body = node.body;
  });
  if (body === null) return [{ state: STATES.STORE_UNASKED, file: STORE, detail: 'λείπει ο δρόμος των παραγώγων `stageDerived` (Κ6α)' }];
  const code = ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, body, sf);
  const touched = DERIVED_FORBIDDEN.filter((token) => code.includes(token));
  return touched.length === 0 ? [] : [{ state: STATES.DERIVED_TRACKED, file: STORE,
    detail: `το \`stageDerived\` αγγίζει ${touched.join(' · ')} — ο επανυπολογισμός θα έδινε ψευδή 409 / ψεύτικο ιστορικό (Κ6α)` }];
}

/** Κ4 + Κ5 + Κ6α + ύπαρξη δηλωμένων αρχείων. */
function wiringFindings(root, input = openGateInput({ root })) {
  const findings = [];
  const read = (rel) => input.read(rel);
  for (const [file, proofs] of Object.entries(WIRING)) {
    const text = read(file);
    if (text === null) {
      findings.push({ state: STATES.SOURCE_DRIFT, file, detail: 'δηλωμένο αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ' });
      continue;
    }
    const missing = proofs.filter((proof) => !text.includes(proof));
    if (missing.length > 0) {
      findings.push({ state: STATES.STORE_UNASKED, file, detail: `δεν περνά από τη μηχανή (λείπει: ${missing.join(' · ')})` });
    }
  }
  const store = read(STORE);
  if (store !== null) findings.push(...derivedPathFindings(store));
  const door = read(DIRECT_WRITE_DOOR);
  if (door === null) findings.push({ state: STATES.SOURCE_DRIFT, file: DIRECT_WRITE_DOOR, detail: 'δηλωμένο αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ' });
  else if (directDoorOpen(door)) {
    findings.push({ state: STATES.DIRECT_DOOR_OPEN, file: DIRECT_WRITE_DOOR,
      detail: 'συλλογή `catalog_*` στο `WRITE_ALLOWED_COLLECTIONS` — απευθείας εγγραφή παρακάμπτει τη μηχανή' });
  }
  return findings;
}

const RELEVANT = /COLLECTIONS\.CATALOG_|catalogDocRef\(|uniqueValueRef\(|pricingSlotRef\(|pricingViewSignalRef\(|stageDerived\(|stageCopied\(/;

const { measure, report, main } = defineScanGate({
  projectRoot: PROJECT_ROOT, relevant: RELEVANT, findingsIn, wiringFindings, states: STATES,
  check: '3.106', skipEnv: 'SKIP_CATALOG_SCHEMA_AUTHORITY',
  ok: 'κάθε εγγραφή σχήματος καταλόγου περνά από τη μηχανή',
  report: {
    title: '🗂️  CHECK 3.106 — Πύλη του ενός γραφέα του καταλόγου — σχήμα και δεδομένα (ADR-923 §5.9 · §5.10)',
    blocking: BLOCKING,
    healthy: [STATES.STORE, STATES.EXEMPT],
    width: 40,
    remedy: [
      'ΘΕΡΑΠΕΙΑ: κάθε εγγραφή σχήματος → γραφέας στο `src/server/catalog/` → `runCatalogTransaction` + `stage*`.',
      '⚠️ ΜΗΝ προσθέσεις αρχείο στο DOC_REF_USERS «επειδή βολεύει»: κάθε τέτοιο αρχείο είναι πόρτα γύρω από την επικύρωση.',
    ],
  },
});

if (require.main === module) process.exit(main());

module.exports = {
  measure, report, main, findingsIn, wiringFindings, directDoorOpen, derivedPathFindings,
  STATES, BLOCKING, WIRING, STORE, AGGREGATE, PRICE_AGGREGATE, PRICING_SLOTS, PRICING_VIEW_SIGNALS, DOC_REF_USERS, DIRECT_WRITE_DOOR, CATALOG_COLLECTIONS,
};
