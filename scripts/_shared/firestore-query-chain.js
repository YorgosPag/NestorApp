#!/usr/bin/env node
/**
 * **Ο αναλυτής αλυσίδας του Admin SDK** — «ποιο ερώτημα φεύγει ΠΡΑΓΜΑΤΙΚΑ από αυτή τη γραμμή;»
 * ────────────────────────────────────────────────────────────────────────────────────────
 *
 * Κοινό SSoT για CHECK 3.91 (ADR-870). Ο σαρωτής του CHECK 3.35
 * ({@link module:scripts/_shared/firestore-tenant-scope-scan}) απαντά **άλλη** ερώτηση
 * («φτάνει φίλτρο μισθωτή;») και μαζεύει μόνο **ονόματα πεδίων** — όχι τελεστές, όχι
 * ταξινόμηση, όχι κλάδους. Για δείκτη χρειάζεται ολόκληρο το σχήμα.
 *
 * ═══ 🔴 ΓΙΑΤΙ ΑΓΚΥΡΩΝΕΙ ΣΤΟ **ΤΕΡΜΑ** ΚΑΙ ΟΧΙ ΣΤΟ `.collection()` ════════════════════════
 *
 * Το CHECK 3.35 αγκυρώνει στο `.collection(X)` και **ανεβαίνει** τη συντακτική αλυσίδα. Αυτό
 * βλέπει `db.collection(X).where(…).get()` — και **τίποτε άλλο**. Μετρημένο 2026-09-21:
 *
 *     const tasksRef = adminDb.collection(COLLECTIONS.TASKS);        // ← εδώ σταματά η αλυσίδα
 *     const snapshot = await tasksRef                                 // ← εδώ ζουν τα φίλτρα
 *       .where('reminderDate', '<=', now)
 *       .where('reminderSent', '!=', true)
 *       .limit(50).get();
 *
 * Το 3.35 κατατάσσει αυτό το σημείο **`not-tenant-scoped` — «χωρίς where(), δεν είναι list
 * query»**. Είναι list query, φιλτράρει, και **δεν** έχει `companyId`. Ίδιο και για τα
 * `email_ingestion_queue` (5 σημεία) και `first_contact_invitations`.
 *
 * 🔑 ΤΟ ΣΧΗΜΑ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΠΟΥ ΓΕΝΝΗΣΕ ΤΟ 3.35: «η πύλη κοιτά ένα σχήμα κειμένου· ο κώδικας
 * γράφτηκε σε άλλο». Ο σαρωτής του 3.35 απαριθμεί **τρεις** τέτοιες μορφές στην κεφαλίδα
 * του. Αυτή είναι η **τέταρτη**: η ρίζα δεσμεύεται σε όνομα και τα φίλτρα μπαίνουν αλλού.
 * Αγκύρωση στο τέρμα την κάνει **αδύνατη**, αντί για «μια ακόμη περίπτωση».
 *
 * ═══ ΚΑΙ ΓΙΑΤΙ ΑΠΑΡΙΘΜΕΙ ΚΛΑΔΟΥΣ ══════════════════════════════════════════════════════════
 *
 * Στο Admin SDK το **δυναμικό είναι ο κανόνας**: `if (filters.x) query = query.where(…)`.
 * Συγχώνευση όλων των `if` σε ΕΝΑ σχήμα παράγει ερώτημα που **κανείς δεν τρέχει** — ακριβώς
 * το σφάλμα που γέννησε το ADR-869 («η πύλη έκρινε την προβολή ισοτήτων ενός άλλου
 * ερωτήματος»). Εδώ κάθε `if`/`else`/τριαδικός είναι **ομάδα επιλογών**, και κρίνεται κάθε
 * συνδυασμός: μία διαδρομή που σκάει είναι σφάλμα παραγωγής, όσο σπάνια κι αν είναι.
 *
 * @module scripts/_shared/firestore-query-chain
 * @see ADR-870
 */

'use strict';

const fs = require('node:fs');
const ts = require('typescript');

const {
  loadCollectionsMap,
  loadFieldConstants,
  loadCustodyPartitions,
  buildPartitionAliasMap,
  buildCollectionAliasMap,
  resolveCollectionArgs,
  resolveFieldArg,
} = require('./firestore-ast-loaders');

const RANGE_OPS = new Set(['<', '<=', '>', '>=', '!=', 'not-in']);
const EQUALITY_OPS = new Set(['==', 'in']);
const ARRAY_OPS = new Set(['array-contains', 'array-contains-any']);

/** Μέθοδοι που συνεχίζουν την αλυσίδα χωρίς να την τερματίζουν. */
const CHAIN_METHODS = new Set(['where', 'orderBy', 'limit', 'limitToLast', 'offset',
  'select', 'startAfter', 'startAt', 'endAt', 'endBefore', 'withConverter',
  // ⚠️ `count()`/`aggregate()` ΔΕΝ εκτελούν — φτιάχνουν συσσωματωτή που θέλει `.get()`.
  // Στους τερματικούς, το `query.count().get()` μετριόταν **δύο φορές** (μετρημένο στο
  // `api/conversations/route.ts:178`): μία για το `count()` και μία για το `get()`.
  'count', 'aggregate']);
/** Μέθοδοι που **εκτελούν** το ερώτημα — εκεί αγκυρώνει ο σαρωτής. */
const TERMINALS = new Set(['get', 'stream', 'onSnapshot']);

/**
 * Βοηθοί του ADR-742 που **επιστρέφουν** αναφορά συλλογής ή query, και τι μισθωτή βάζουν.
 *
 * `collectionArg` = η θέση του ορίσματος που δηλώνει τη συλλογή· `-1` ⇒ το πρώτο όρισμα
 * είναι **η ίδια η αλυσίδα** και ο αναλυτής κατεβαίνει μέσα της.
 * `tenant` = `always` (μπαίνει πάντα) ή `optional` (μπορεί να μην μπει — super admin,
 * προσωπικός χώρος, `skipCompanyFilter`) ⇒ **δύο** παραλλαγές, και οι δύο κρίνονται.
 */
const ROOT_HELPERS = new Map([
  ['tenantScopedCollection', { collectionArg: 0, tenant: 'optional' }],
  ['tenantScopedDependencyQuery', { collectionArg: 1, tenant: 'optional' }],
  ['scopeQueryToTenant', { collectionArg: -1, tenant: 'optional' }],
  ['scopeQueryToCompany', { collectionArg: -1, tenant: 'always' }],
]);

/** Το πεδίο που βάζουν οι βοηθοί του ADR-742 — ένα, σταθερό, από το SSoT τους. */
const TENANT_FIELD = 'companyId';

/**
 * @typedef {{kind:'eq'|'range'|'ac', field:string, branch:object|null}
 *          |{kind:'order', field:string, direction:string, branch:object|null}
 *          |{kind:'unresolved', why:string, branch:object|null}} Clause
 */

/**
 * @typedef {Object} ChainSite
 * @property {string}      file
 * @property {number}      line
 * @property {string|null} collectionKey
 * @property {string|null} collectionName
 * @property {boolean}     group          collectionGroup αντί για collection
 * @property {Clause[]}    clauses
 * @property {boolean}     rootUnknown
 */

/** Φτιάξε τα συμφραζόμενα **μία** φορά ανά εκτέλεση (τα JSON/AST δεν αλλάζουν ανά αρχείο). */
function createChainContext() {
  return {
    collections: loadCollectionsMap({ includeSubcollections: true }),
    fields: loadFieldConstants(),
    partitions: loadCustodyPartitions(),
  };
}

// ---------------------------------------------------------------------------
// Βοηθοί AST
// ---------------------------------------------------------------------------

/** `x as T` · `(x)` · `x!` — διάφανα περιτυλίγματα που κρύβουν την αλυσίδα από τον σαρωτή. */
function unwrap(expr) {
  let e = expr;
  while (e && (ts.isAsExpression(e) || ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e))) {
    e = e.expression;
  }
  return e;
}

/** Η περικλείουσα συνάρτηση ενός κόμβου (ή το SourceFile αν είναι top-level). */
function enclosingScope(node) {
  let s = node;
  while (s.parent && !ts.isFunctionDeclaration(s) && !ts.isFunctionExpression(s)
    && !ts.isArrowFunction(s) && !ts.isMethodDeclaration(s) && !ts.isSourceFile(s)) {
    s = s.parent;
  }
  return s;
}

/**
 * Υπό ποια συνθήκη ζει ο κόμβος, μέσα στη συνάρτησή του;
 *
 * Επιστρέφει τον κόμβο της συνθήκης **ως ταυτότητα ομάδας** και ποια πλευρά της. Έτσι το
 * `if (x) q=q.where('status','==',s); else q=q.where('status','!=','archived')` δεν παράγει
 * ποτέ σχήμα με **και τα δύο** — που θα ήταν ερώτημα που κανείς δεν τρέχει.
 */
function branchOf(node, scope) {
  let n = node;
  while (n && n !== scope && n.parent) {
    const p = n.parent;
    if (ts.isIfStatement(p)) {
      if (p.thenStatement === n) return { id: p, side: 'then', hasElse: !!p.elseStatement };
      if (p.elseStatement === n) return { id: p, side: 'else', hasElse: true };
    }
    if (ts.isConditionalExpression(p)) {
      if (p.whenTrue === n) return { id: p, side: 'then', hasElse: true };
      if (p.whenFalse === n) return { id: p, side: 'else', hasElse: true };
    }
    n = p;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Ρήτρες
// ---------------------------------------------------------------------------

/** `where(field, op, v)` → ρήτρα ισότητας/εύρους/πίνακα. */
function whereClause(call, fieldConstants) {
  const field = resolveFieldArg(call.arguments[0], fieldConstants);
  if (field === null) return { kind: 'unresolved', why: 'δυναμικό πεδίο σε where()' };
  const opArg = call.arguments[1];
  if (!opArg || !ts.isStringLiteral(opArg)) {
    return { kind: 'unresolved', why: `δυναμικός τελεστής σε where('${field}')` };
  }
  const op = opArg.text;
  if (EQUALITY_OPS.has(op)) return { kind: 'eq', field };
  if (ARRAY_OPS.has(op)) return { kind: 'ac', field };
  if (RANGE_OPS.has(op)) return { kind: 'range', field };
  return { kind: 'unresolved', why: `άγνωστος τελεστής '${op}'` };
}

/** `orderBy(field, dir?)` → ρήτρα ταξινόμησης. */
function orderByClause(call, fieldConstants) {
  const field = resolveFieldArg(call.arguments[0], fieldConstants);
  if (field === null) return { kind: 'unresolved', why: 'δυναμικό πεδίο σε orderBy()' };
  const dirArg = call.arguments[1];
  if (dirArg && !ts.isStringLiteral(dirArg)) {
    return { kind: 'unresolved', why: `δυναμική φορά σε orderBy('${field}')` };
  }
  const direction = dirArg && dirArg.text === 'desc' ? 'DESCENDING' : 'ASCENDING';
  return { kind: 'order', field, direction };
}

/** Μία κλήση της αλυσίδας → ρήτρα, ή `null` όταν δεν αφορά τον δείκτη (limit/select/cursor). */
function clauseOf(call, methodName, fieldConstants) {
  if (methodName === 'where') return whereClause(call, fieldConstants);
  if (methodName === 'orderBy') return orderByClause(call, fieldConstants);
  return null;
}

// ---------------------------------------------------------------------------
// Κατάβαση της αλυσίδας
// ---------------------------------------------------------------------------

/**
 * Κατέβα μια έκφραση-αλυσίδα ως τη **ρίζα** της, μαζεύοντας τις κλήσεις στον δρόμο.
 *
 * @returns {{root: object, calls: {call: ts.CallExpression, name: string}[]}}
 */
function descend(expr) {
  let cur = unwrap(expr);
  const calls = [];
  while (cur && ts.isCallExpression(cur) && ts.isPropertyAccessExpression(cur.expression)) {
    const name = cur.expression.name.getText();
    if (name === 'collection' || name === 'collectionGroup') {
      return { root: { type: 'collection', node: cur, group: name === 'collectionGroup' }, calls };
    }
    if (!CHAIN_METHODS.has(name) && !TERMINALS.has(name)) return { root: { type: 'unknown' }, calls };
    calls.push({ call: cur, name });
    cur = unwrap(cur.expression.expression);
  }
  if (cur && ts.isCallExpression(cur) && ts.isIdentifier(cur.expression) && ROOT_HELPERS.has(cur.expression.text)) {
    return { root: { type: 'helper', node: cur, helper: ROOT_HELPERS.get(cur.expression.text) }, calls };
  }
  if (cur && ts.isIdentifier(cur)) return { root: { type: 'name', name: cur.text }, calls };
  return { root: { type: 'unknown' }, calls };
}

/** Οι μαζεμένες κλήσεις (τέρμα→ρίζα) γίνονται ρήτρες με σειρά **ρίζα→τέρμα**. */
function callsToClauses(calls, fieldConstants, scope, inheritedBranch) {
  const out = [];
  for (let i = calls.length - 1; i >= 0; i--) {
    const clause = clauseOf(calls[i].call, calls[i].name, fieldConstants);
    if (clause) out.push({ ...clause, branch: branchOf(calls[i].call, scope) || inheritedBranch || null });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ο σαρωτής ενός αρχείου
// ---------------------------------------------------------------------------

/**
 * Σάρωσε **ένα** αρχείο και επίστρεψε ένα {@link ChainSite} ανά τέρμα × κλάδο συλλογής.
 *
 * @param {string} filePath
 * @param {ReturnType<typeof createChainContext>} ctx
 * @returns {ChainSite[]}
 */
function scanFileChains(filePath, ctx) {
  const src = fs.readFileSync(filePath, 'utf8');
  if (!/\.collection(Group)?\s*\(/.test(src) && !hasRootHelper(src)) return [];

  const sf = ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, true,
    /\.tsx$/.test(filePath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const partitionAlias = buildPartitionAliasMap(sf, ctx.partitions);
  const alias = buildCollectionAliasMap(sf, partitionAlias);
  const resolver = { ctx, sf, alias, partitionAlias };

  /** @type {ChainSite[]} */
  const sites = [];
  (function visit(node) {
    if (isTerminalCall(node)) collectSite(node, resolver, sites, filePath);
    ts.forEachChild(node, visit);
  })(sf);
  return sites;
}

function hasRootHelper(src) {
  for (const name of ROOT_HELPERS.keys()) if (src.includes(name)) return true;
  return false;
}

function isTerminalCall(node) {
  return ts.isCallExpression(node)
    && ts.isPropertyAccessExpression(node.expression)
    && TERMINALS.has(node.expression.name.getText());
}

/** Λύσε **ένα** τέρμα σε σημεία (ένα ανά κλάδο συλλογής) και βάλ' τα στη λίστα. */
function collectSite(node, resolver, sites, filePath) {
  const { ctx, sf } = resolver;
  const scope = enclosingScope(node);
  const resolved = resolveChain(node, resolver, scope, 0, new Set(), null);
  if (resolved.rootUnknown && resolved.clauses.length === 0) return;

  const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  const branches = resolved.colls.length > 0 ? resolved.colls : [null];
  for (const coll of branches) {
    sites.push({
      file: filePath,
      line: line + 1,
      collectionKey: coll ? coll.key : null,
      collectionName: coll ? coll.name : null,
      group: resolved.group,
      clauses: resolved.clauses,
      rootUnknown: resolved.rootUnknown,
    });
  }
  void ctx;
}

/**
 * Λύσε μια αλυσίδα: ρήτρες + ποια συλλογή. Ακολουθεί ονόματα (δήλωση **και** επαναναθέσεις)
 * και βοηθούς-ρίζες, με φράγμα βάθους ώστε αμοιβαία αναφορά να μη γίνει βρόχος.
 */
function resolveChain(expr, resolver, scope, depth, seen, inheritedBranch) {
  const { ctx } = resolver;
  const { root, calls } = descend(expr);
  const clauses = callsToClauses(calls, ctx.fields, scope, inheritedBranch);
  const base = resolveRoot(root, resolver, scope, depth, seen, inheritedBranch);
  return {
    colls: base.colls,
    group: base.group,
    rootUnknown: base.rootUnknown,
    clauses: [...base.clauses, ...clauses],
  };
}

/** Η ρίζα μιας αλυσίδας: `.collection()`, βοηθός του ADR-742, ή όνομα που δέθηκε αλλού. */
function resolveRoot(root, resolver, scope, depth, seen, inheritedBranch) {
  const empty = { colls: [], group: false, rootUnknown: true, clauses: [] };
  if (root.type === 'collection') {
    return {
      colls: resolveCollectionArgs(root.node.arguments[0], resolver.alias, resolver.ctx.collections, resolver.partitionAlias),
      group: root.group,
      rootUnknown: false,
      clauses: [],
    };
  }
  if (root.type === 'helper') return resolveHelperRoot(root, resolver, scope, depth, seen, inheritedBranch);
  if (root.type === 'name') {
    if (depth >= 4 || seen.has(root.name)) return empty;
    return resolveBoundName(root.name, resolver, scope, depth + 1, new Set([...seen, root.name]));
  }
  return empty;
}

/**
 * Βοηθός-ρίζα του ADR-742. Ο μισθωτής μπαίνει ως **ρήτρα ισότητας** — και όταν μπορεί να
 * μη μπει (`optional`), ως ρήτρα σε **δική της ομάδα κλάδου**: έτσι κρίνονται **και οι δύο**
 * παραλλαγές, όπως ακριβώς κάνει το CHECK 3.15 με `default` / `super_admin`.
 */
function resolveHelperRoot(root, resolver, scope, depth, seen, inheritedBranch) {
  const { helper, node } = root;
  const inner = helper.collectionArg === -1
    ? resolveChain(node.arguments[0], resolver, scope, depth + 1, seen, inheritedBranch)
    : {
      colls: resolveCollectionArgs(node.arguments[helper.collectionArg], resolver.alias,
        resolver.ctx.collections, resolver.partitionAlias),
      group: false,
      rootUnknown: false,
      clauses: [],
    };
  const tenantClause = {
    kind: 'eq',
    field: TENANT_FIELD,
    branch: helper.tenant === 'always' ? null : { id: node, side: 'then', hasElse: false },
  };
  return { ...inner, clauses: [...inner.clauses, tenantClause] };
}

/**
 * Ένα όνομα που κρατά query: μάζεψε τη **δήλωσή** του και **κάθε επανανάθεση** μέσα στη
 * συνάρτηση. Οι ρήτρες που μπαίνουν υπό συνθήκη κληρονομούν τον κλάδο της εντολής.
 */
function resolveBoundName(name, resolver, scope, depth, seen) {
  const out = { colls: [], group: false, rootUnknown: true, clauses: [] };
  (function scan(n) {
    const source = assignmentSourceFor(n, name);
    if (source) {
      const branch = branchOf(n, scope);
      const r = resolveChain(source, resolver, scope, depth, seen, branch);
      if (!r.rootUnknown) { out.colls = r.colls; out.group = r.group; out.rootUnknown = false; }
      out.clauses.push(...r.clauses);
    }
    ts.forEachChild(n, scan);
  })(scope);
  return out;
}

/** `const q = <chain>` ή `q = <chain>` → η έκφραση της ανάθεσης, αλλιώς `null`. */
function assignmentSourceFor(node, name) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
    && node.name.text === name && node.initializer) {
    return node.initializer;
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    && ts.isIdentifier(node.left) && node.left.text === name && ts.isCallExpression(node.right)) {
    return node.right;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Απαρίθμηση κλάδων → σχήματα
// ---------------------------------------------------------------------------

/**
 * Όλοι οι **συνδυασμοί κλάδων** μιας αλυσίδας. Σταθερές ρήτρες μπαίνουν παντού· κάθε ομάδα
 * συνθήκης συνεισφέρει «then», «else» ή «τίποτα» (όταν δεν υπάρχει `else`).
 *
 * ⚠️ Πλαφόν 256: μια διαδρομή με 9+ ανεξάρτητα φίλτρα δεν κρίνεται «περίπου» — δηλώνεται
 * **ρητά** μη αναλύσιμη. Σιωπηλή περικοπή θα ήταν πράσινο που σημαίνει «δεν κοίταξα».
 *
 * @param {Clause[]} clauses
 * @returns {{combos: Clause[][]|null, overflow: boolean, groups: number}}
 */
function enumerateBranches(clauses) {
  const fixed = clauses.filter((cl) => !cl.branch);
  /** @type {Map<object, {hasElse: boolean, then: Clause[], else: Clause[]}>} */
  const groups = new Map();
  for (const cl of clauses) {
    if (!cl.branch) continue;
    const g = groups.get(cl.branch.id) || { hasElse: false, then: [], else: [] };
    g.hasElse = g.hasElse || cl.branch.hasElse;
    g[cl.branch.side].push(cl);
    groups.set(cl.branch.id, g);
  }

  let combos = [fixed];
  for (const g of groups.values()) {
    const options = g.hasElse && g.else.length > 0 ? [g.then, g.else] : [g.then, []];
    const next = [];
    for (const base of combos) for (const option of options) next.push([...base, ...option]);
    combos = next;
    if (combos.length > 256) return { combos: null, overflow: true, groups: groups.size };
  }
  return { combos, overflow: false, groups: groups.size };
}

/**
 * Ένας συνδυασμός ρητρών → `QueryShape` του {@link module:scripts/_shared/firestore-index-matcher}.
 *
 * @param {string} collection
 * @param {Clause[]} clauses
 * @param {string} variant
 * @returns {import('./firestore-index-matcher').QueryShape}
 */
function toQueryShape(collection, clauses, variant = 'admin') {
  const shape = {
    collection,
    equalityFields: [],
    orderBy: [],
    arrayContainsField: null,
    rangeFields: [],
    variant,
  };
  for (const cl of clauses) {
    if (cl.kind === 'eq' && !shape.equalityFields.includes(cl.field)) shape.equalityFields.push(cl.field);
    else if (cl.kind === 'range' && !shape.rangeFields.includes(cl.field)) shape.rangeFields.push(cl.field);
    else if (cl.kind === 'ac') shape.arrayContainsField = cl.field;
    else if (cl.kind === 'order') shape.orderBy.push({ field: cl.field, direction: cl.direction });
  }
  return shape;
}

// ⚠️ ΜΟΝΟ ΟΣΑ ΕΧΟΥΝ ΚΑΛΟΥΝΤΑ. Η πρώτη εκδοχή εξήγαγε επιπλέον `descend`, `branchOf`,
// `enclosingScope`, `ROOT_HELPERS`, `TERMINALS`, `TENANT_FIELD` — **κανένα** με καλούντα.
// Ένας exporter χωρίς caller δεν είναι «δημόσιο API», είναι νεκρός κώδικας που δηλώνει
// συμβόλαιο το οποίο κανείς δεν επαληθεύει (ADR-869 §12.5 · CHECK 3.22).
module.exports = {
  createChainContext,
  scanFileChains,
  enumerateBranches,
  toQueryShape,
};
