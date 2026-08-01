#!/usr/bin/env node
/**
 * CHECK 3.35 — ο σαρωτής: «φτάνει φίλτρο μισθωτή σε **αυτό** το query;»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΤΟΝ ΓΕΝΝΗΣΕ (ADR-745 §9.5 → ADR-747)
 *
 * Δύο πύλες υπήρχαν ήδη και **καμία δεν διεκδικούσε το κενό ανάμεσά τους**:
 *
 *   CHECK 3.15 (`check-firestore-index-coverage.js`, γρ. 38-44) γράφει ρητά:
 *       «Direct `query()` + `getDocs()` usage is covered by CHECK 3.10.»
 *
 *   CHECK 3.10 (`check-firestore-companyid.sh`, γρ. 52-61) παίρνει **12 γραμμές
 *   προς τα κάτω** από κάθε `query(` και μαρκάρει μόνο αν το block περιέχει
 *   `where(` χωρίς `companyId`.
 *
 * Στο **κυρίαρχο idiom του έργου** το block δεν περιέχει κανένα `where(`:
 *
 *     const constraints: QueryConstraint[] = [];
 *     if (options?.type) constraints.push(where('type', '==', options.type));   // 16 γραμμές ΠΑΝΩ
 *     …
 *     return query(getCol(CONTACTS_COLLECTION, conv), ...constraints);          // ΤΕΛΕΥΤΑΙΑ γραμμή
 *
 * ⇒ `grep -q "where("` αποτυγχάνει ⇒ **μηδέν παραβιάσεις, πάντα**. Γι' αυτό το
 * `.firestore-companyid-baseline.json` έλεγε «0 violations — fully cleaned» ενώ
 * το `getAllContacts` έστελνε **αφιλτράριστη** λίστα επαφών επί μήνες
 * (ADR-745 §9.5: κάθε μη-super-admin έπαιρνε permission-denied σε **ολόκληρο** το query).
 *
 * 🔴 ΤΟ ΣΧΗΜΑ, ΟΧΙ ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: **«η πύλη κοιτά σχήμα κειμένου· ο κώδικας
 * γράφτηκε σε άλλο σχήμα».** Το ίδιο σφάλμα εμφανίζεται **τρεις** φορές, και ο
 * σαρωτής απαντά και στις τρεις με το ίδιο εργαλείο — **ακολούθησε το όνομα**:
 *
 *   1. client spread   `const c=[]; c.push(where(…)); query(col, ...c)`
 *   2. admin αλυσίδα   `db.collection(X).where(…)` — άλλο σχήμα, το 3.10 δεν το κοιτά καν
 *   3. admin επανανάθεση `let q=db.collection(X)…; if (!isSuperAdmin) q=q.where(COMPANY_ID,…)`
 *
 * Το (3) δεν ήταν στην αρχική προδιαγραφή — βρέθηκε **μετρώντας**: παρήγαγε
 * ψευδώς θετικά σε νόμιμο κώδικα. Χωρίς αυτό η πύλη θα γεννιόταν θορυβώδης.
 *
 * ⚠️ ΤΙ ΔΕΝ ΚΑΝΕΙ (και δεν πρέπει να «διορθωθεί» χωρίς μέτρηση)
 *  - Δεν ακολουθεί constraints/queries **διά μέσου αρχείων**. Cross-file ⇒ `unanalyzable`,
 *    **ποτέ** violation: η άγνοια δεν είναι ενοχή (πήχης ≤10% false-positive της Google
 *    για blocking checks).
 *  - Δεν κρίνει **πολιτική** (ποιος δικαιούται cross-tenant). Αυτό είναι δουλειά του
 *    `scopeQueryToTenant` (ADR-702) — εδώ κρίνεται μόνο αν το φίλτρο **υπάρχει**.
 *
 * @module scripts/_shared/firestore-tenant-scope-scan
 * @see ADR-747
 */

'use strict';

const fs = require('node:fs');
const ts = require('typescript');

const {
  loadCollectionsMap,
  loadFieldConstants,
  loadTenantOverrides,
  resolveTenantFor,
  buildCollectionAliasMap,
  resolveCollectionArg,
  resolveFieldArg,
} = require('./firestore-ast-loaders');

/**
 * Ονόματα που, όταν τυλίγουν ή παράγουν το query, **εγγυώνται** το φίλτρο.
 * Είναι τα SSoT του ADR-702/742 — ο κανόνας ελέγχει τη **χρήση** τους.
 */
const SCOPE_HELPER_RE = /\b(scopeQueryToCompany|scopeQueryToTenant|tenantScopedCollection|tenantScopedDependencyQuery)\b/;

/**
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ ΕΔΩ ΚΡΙΤΗΡΙΟ ΕΠΙΠΕΔΟΥ ΑΡΧΕΙΟΥ
 *
 * Ο πειρασμός είναι να πεις «το αρχείο αναφέρει `firestoreQueryService` ή
 * `resolveEffectiveCompanyId`, άρα είναι εντάξει». **Αυτό είναι ακριβώς το σφάλμα
 * που γεννά αυτή την πύλη.** Το `contacts-query.service.ts` είχε **έξι**
 * συναρτήσεις: οι πέντε περνούσαν από τον SSoT, η `getAllContacts` **όχι**
 * (ADR-745 §9.5). Κριτήριο επιπέδου αρχείου θα την έβαφε πράσινη επειδή οι
 * **γειτόνισσές** της ήταν σωστές — και η διαρροή θα ζούσε άλλους έξι μήνες,
 * τώρα με πύλη να την πιστοποιεί.
 *
 * Η μόνη αποδεκτή εγγύηση είναι **ανά σημείο κλήσης**: η αλυσίδα να τυλίγεται
 * όντως σε {@link SCOPE_HELPER_RE}. Οτιδήποτε άλλο κρίνεται από τα πεδία που
 * μετρήθηκαν στο ίδιο το query.
 */

/**
 * Ρητή εξαίρεση στο σημείο χρήσης, με **λόγο**:
 *     // tenant-scope-exempt: public capability token — ο δεσμός ΕΙΝΑΙ η εξουσιοδότηση
 *
 * Ο λόγος είναι **υποχρεωτικός**: χωρίς αυτόν η εξαίρεση δεν αναγνωρίζεται.
 * (Ίδιο δόγμα με το `eslint-disable-next-line <rule> -- reason`.)
 */
const EXEMPT_RE = /tenant-scope-exempt:\s*\S+/;

/** @typedef {'violation'|'ok'|'unanalyzable'|'exempt'|'not-tenant-scoped'} SiteStatus */

/**
 * @typedef {Object} Site
 * @property {'R1-client'|'R2-admin'} rule
 * @property {string}      file
 * @property {number}      line
 * @property {string|null} collectionKey
 * @property {string|null} collectionName
 * @property {string}      tenantMode
 * @property {string[]}    fields
 * @property {SiteStatus}  status
 * @property {string}      detail
 */

/**
 * Φτιάξε το αντικείμενο συμφραζομένων **μία φορά** ανά εκτέλεση (τα JSON/AST των
 * καταλόγων δεν αλλάζουν μεταξύ αρχείων).
 *
 * @returns {{collections: Map<string,string>, fields: Map<string,string>, tenant: Map<string,object>}}
 */
function createScanContext() {
  return {
    // Υποσυλλογές ΝΑΙ: το `.collection()` του Admin SDK τις δέχεται εξίσου.
    // (Το CHECK 3.15 τις αφήνει έξω επίτηδες — βλ. loadCollectionsMap.)
    collections: loadCollectionsMap({ includeSubcollections: true }),
    fields: loadFieldConstants(),
    tenant: loadTenantOverrides(),
  };
}

// ---------------------------------------------------------------------------
// Βοηθοί
// ---------------------------------------------------------------------------

/** Γραμμή που είναι σχόλιο ή κενή — μέρος του «μπλοκ αιτιολογίας». */
const COMMENT_OR_BLANK_RE = /^\s*(\/\/|\/\*|\*|$)/;

/**
 * Έχει το σημείο ρητή εξαίρεση **με λόγο**;
 *
 * Ψάχνει στη γραμμή του query **και σε ολόκληρο το συνεχόμενο μπλοκ σχολίων από
 * πάνω του**, σταματώντας στην πρώτη γραμμή κώδικα.
 *
 * 🔴 ΓΙΑΤΙ ΟΛΟΚΛΗΡΟ ΤΟ ΜΠΛΟΚ ΚΑΙ ΟΧΙ «Η ΑΠΟ ΠΑΝΩ ΓΡΑΜΜΗ»: ο κανόνας απαιτεί
 * **λόγο**. Ένας σοβαρός λόγος δεν χωράει σε μία γραμμή — θέλει παραπομπή στον
 * κανόνα των rules, στο ADR, στο τι σπάει αν αλλάξει. Η πρώτη εκδοχή κοιτούσε
 * μία γραμμή και **απέρριπτε την τεκμηριωμένη εξαίρεση ενώ δεχόταν τη βιαστική** —
 * δηλαδή τιμωρούσε ακριβώς τη συμπεριφορά που θέλει να ενθαρρύνει.
 *
 * @param {string[]} lines
 * @param {number} lineIndex 0-based
 */
function isExempt(lines, lineIndex) {
  if (EXEMPT_RE.test(lines[lineIndex] || '')) return true;
  for (let i = lineIndex - 1; i >= 0; i--) {
    const line = lines[i] || '';
    if (!COMMENT_OR_BLANK_RE.test(line)) break;   // φτάσαμε σε κώδικα
    if (EXEMPT_RE.test(line)) return true;
  }
  return false;
}

/**
 * Η περικλείουσα συνάρτηση ενός κόμβου (ή το SourceFile αν είναι top-level).
 * @param {ts.Node} node
 * @returns {ts.Node}
 */
function enclosingScope(node) {
  let s = node;
  while (
    s.parent &&
    !ts.isFunctionDeclaration(s) && !ts.isFunctionExpression(s) &&
    !ts.isArrowFunction(s) && !ts.isMethodDeclaration(s) && !ts.isSourceFile(s)
  ) {
    s = s.parent;
  }
  return s;
}

/**
 * Μάζεψε ονόματα πεδίων από στοιχεία που υποτίθεται ότι είναι `where(...)` κλήσεις.
 * @returns {boolean} `true` αν κάτι ήταν μη-αναλύσιμο
 */
function collectWhereFields(elements, fieldConstants, out) {
  let unresolved = false;
  for (const el of elements) {
    if (!ts.isCallExpression(el)) {
      // spread μέσα σε push(...), ternary, κλπ.
      if (!ts.isSpreadElement(el)) continue;
      unresolved = true;
      continue;
    }
    const callee = el.expression.getText();
    if (callee !== 'where') continue;                 // orderBy/limit/startAfter: αδιάφορα
    const field = resolveFieldArg(el.arguments[0], fieldConstants);
    if (field) out.add(field);
    else unresolved = true;
  }
  return unresolved;
}

/**
 * 🔑 Η ΚΑΡΔΙΑ ΤΟΥ ΚΑΝΟΝΑ 1 — **ακολούθησε το όνομα πίσω στη δήλωσή του**.
 *
 * Μαζεύει πεδία από: `const x = [where(…)]` · `x.push(where(…))` · `x = [where(…)]`
 * μέσα στην περικλείουσα συνάρτηση. Αυτό ακριβώς είναι που το grep γραμμών δεν
 * μπορεί να κάνει **ποτέ**, και είναι ο λόγος ύπαρξης όλου του αρχείου.
 *
 * @returns {{found: boolean, unresolved: boolean}}
 */
function collectFieldsFromIdentifier(scope, name, fieldConstants, out) {
  let found = false;
  let unresolved = false;

  (function scan(n) {
    // const x = [ … ]
    if (
      ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name
    ) {
      found = true;
      if (n.initializer && ts.isArrayLiteralExpression(n.initializer)) {
        if (collectWhereFields(n.initializer.elements, fieldConstants, out)) unresolved = true;
      } else if (n.initializer) {
        unresolved = true;   // αρχικοποιείται από κλήση/import — δεν το ακολουθούμε
      }
    }

    // x.push(where(…), …)
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.getText() === 'push' &&
      n.expression.expression.getText() === name
    ) {
      found = true;
      if (collectWhereFields(n.arguments, fieldConstants, out)) unresolved = true;
    }

    // x = [ … ]
    if (
      ts.isBinaryExpression(n) &&
      n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(n.left) && n.left.text === name &&
      ts.isArrayLiteralExpression(n.right)
    ) {
      found = true;
      if (collectWhereFields(n.right.elements, fieldConstants, out)) unresolved = true;
    }

    ts.forEachChild(n, scan);
  })(scope);

  return { found, unresolved };
}

// ---------------------------------------------------------------------------
// ΚΑΝΟΝΑΣ 1 — Client SDK: query(ref, ...constraints)
// ---------------------------------------------------------------------------

function scanClientQueries(filePath, src, sf, ctx, lines, sites) {
  if (!/\bquery\s*\(/.test(src)) return;
  const alias = buildCollectionAliasMap(sf);

  (function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'query') {
      const args = node.arguments;
      if (args.length > 0) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));

        // — ποια συλλογή; `collection(db, X)` · `getCol(X, conv)` · σκέτο X
        let coll = resolveCollectionArg(args[0], alias, ctx.collections);
        if (!coll && ts.isCallExpression(args[0])) {
          for (const a of args[0].arguments) {
            const r = resolveCollectionArg(a, alias, ctx.collections);
            if (r) { coll = r; break; }
          }
        }

        // — ποια πεδία φιλτράρονται;
        const fields = new Set();
        let unresolved = false;
        for (let i = 1; i < args.length; i++) {
          const a = args[i];
          if (ts.isSpreadElement(a)) {
            if (ts.isIdentifier(a.expression)) {
              const r = collectFieldsFromIdentifier(enclosingScope(node), a.expression.text, ctx.fields, fields);
              if (!r.found || r.unresolved) unresolved = true;
            } else unresolved = true;
          } else if (ts.isCallExpression(a)) {
            if (collectWhereFields([a], ctx.fields, fields)) unresolved = true;
          } else if (ts.isIdentifier(a)) {
            const r = collectFieldsFromIdentifier(enclosingScope(node), a.text, ctx.fields, fields);
            if (!r.found || r.unresolved) unresolved = true;
          }
        }

        sites.push(classify({
          rule: 'R1-client', file: filePath, line: line + 1, coll, fields, unresolved,
          // ΟΧΙ κριτήριο επιπέδου αρχείου — βλ. σχόλιο πάνω από το SCOPE_HELPER_RE.
          ctx, exempt: isExempt(lines, line), ssotGuaranteed: false,
        }));
      }
    }
    ts.forEachChild(node, visit);
  })(sf);
}

// ---------------------------------------------------------------------------
// ΚΑΝΟΝΑΣ 2 — Admin SDK: .collection(X)….where(…)
// ---------------------------------------------------------------------------

function scanAdminQueries(filePath, src, sf, ctx, lines, sites) {
  if (!/\.collection(Group)?\s*\(/.test(src)) return;
  const alias = buildCollectionAliasMap(sf);

  (function visit(node) {
    const isCollCall =
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      (node.expression.name.getText() === 'collection' || node.expression.name.getText() === 'collectionGroup');

    if (isCollCall) {
      const coll = resolveCollectionArg(node.arguments[0], alias, ctx.collections);
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));

      const fields = new Set();
      let hasWhere = false;
      let unresolved = false;

      // — ανέβα τη συντακτική αλυσίδα .where().orderBy().limit()…
      let cur = node;
      while (
        cur.parent && ts.isPropertyAccessExpression(cur.parent) &&
        cur.parent.parent && ts.isCallExpression(cur.parent.parent) &&
        cur.parent.parent.expression === cur.parent
      ) {
        const call = cur.parent.parent;
        if (cur.parent.name.getText() === 'where') {
          hasWhere = true;
          const f = resolveFieldArg(call.arguments[0], ctx.fields);
          if (f) fields.add(f); else unresolved = true;
        }
        cur = call;
      }

      // — τυλιγμένο **επί τόπου** σε SSoT helper; `scopeQueryToCompany(db.collection(X)…, id)`
      let wrapped =
        !!cur.parent && ts.isCallExpression(cur.parent) && SCOPE_HELPER_RE.test(cur.parent.expression.getText());

      // — 🔑 δεσμεύεται σε όνομα; τότε δύο ακόμη πράγματα μπορεί να συμβαίνουν αργότερα
      const bound = boundNameOf(cur);
      if (bound) {
        const scope = enclosingScope(node);
        // (α) επανανάθεση με φίλτρο: `q = q.where(COMPANY_ID, …)` — η 3η μορφή του σχήματος
        const r = collectChainedReassignments(scope, bound, ctx.fields, fields);
        if (r.sawWhere) hasWhere = true;
        if (r.unresolved) unresolved = true;
        // (β) το όνομα δίνεται **σε** SSoT helper: `scopeQueryToCompany(col, companyId)`
        if (!wrapped && isPassedToScopeHelper(scope, bound)) wrapped = true;
      }

      sites.push(classify({
        rule: 'R2-admin', file: filePath, line: line + 1, coll, fields, unresolved,
        ctx, exempt: isExempt(lines, line), ssotGuaranteed: !!wrapped,
        requiresWhere: true, hasWhere,
      }));
    }
    ts.forEachChild(node, visit);
  })(sf);
}

/** Σε ποιο όνομα δεσμεύεται το αποτέλεσμα της αλυσίδας; */
function boundNameOf(chainEnd) {
  const p = chainEnd.parent;
  if (!p) return null;
  if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(p.left)) {
    return p.left.text;
  }
  return null;
}

/**
 * Δίνεται το όνομα **ως όρισμα** σε SSoT helper αργότερα;
 *
 *     const col = db.collection(X).where('status','==','active');
 *     return scopeQueryToCompany(col, companyId).get();       // ← εδώ
 *
 * Χωρίς αυτό, ο κανονικός τρόπος χρήσης του SSoT του ADR-702/742 μετριόταν
 * **παραβίαση** — δηλαδή η πύλη τιμωρούσε ακριβώς τη συμπεριφορά που επιβάλλει.
 *
 * @param {ts.Node} scope
 * @param {string} name
 * @returns {boolean}
 */
function isPassedToScopeHelper(scope, name) {
  let found = false;
  (function scan(n) {
    if (found) return;
    if (ts.isCallExpression(n) && SCOPE_HELPER_RE.test(n.expression.getText())) {
      for (const a of n.arguments) {
        if (ts.isIdentifier(a) && a.text === name) { found = true; return; }
      }
    }
    ts.forEachChild(n, scan);
  })(scope);
  return found;
}

/**
 * `q = q.where(FIELDS.COMPANY_ID, '==', ctx.companyId)` σε **άλλη εντολή**.
 *
 * Το idiom του υπό-συνθήκη super-admin bypass. Χωρίς αυτό, νόμιμος κώδικας
 * μετριέται παραβίαση (μετρημένο: −6 ψευδώς θετικά μόνο σε αυτή τη μορφή).
 */
function collectChainedReassignments(scope, name, fieldConstants, out) {
  let sawWhere = false;
  let unresolved = false;

  (function scan(n) {
    if (
      ts.isBinaryExpression(n) &&
      n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(n.left) && n.left.text === name &&
      ts.isCallExpression(n.right)
    ) {
      let c = n.right;
      while (c && ts.isCallExpression(c) && ts.isPropertyAccessExpression(c.expression)) {
        if (c.expression.name.getText() === 'where') {
          sawWhere = true;
          const f = resolveFieldArg(c.arguments[0], fieldConstants);
          if (f) out.add(f); else unresolved = true;
        }
        c = c.expression.expression;
      }
    }
    ts.forEachChild(n, scan);
  })(scope);

  return { sawWhere, unresolved };
}

// ---------------------------------------------------------------------------
// Κατηγοριοποίηση — **ρητή**, ποτέ σιωπηλή απόρριψη
// ---------------------------------------------------------------------------

/**
 * 🔴 ΓΙΑΤΙ ΚΑΘΕ ΚΛΑΔΟΣ ΕΙΝΑΙ ΡΗΤΟΣ: η πρώτη εκδοχή αυτού του σαρωτή είχε
 * `violation: … && !!coll` — δηλαδή ό,τι δεν αναγνώριζε **εξαφανιζόταν**. Το 65%
 * των call sites έπεφτε εκεί, μαζί με το ίδιο το ιστορικό σφάλμα. Ένα εύρημα που
 * δεν κατατάσσεται είναι **δεδομένο που χάθηκε**, όχι «καθαρό».
 *
 * @returns {Site}
 */
function classify({ rule, file, line, coll, fields, unresolved, ctx, exempt, ssotGuaranteed, requiresWhere, hasWhere }) {
  const base = {
    rule, file, line,
    collectionKey: coll ? coll.key : null,
    collectionName: coll ? coll.name : null,
    fields: [...fields],
  };

  if (exempt) return { ...base, tenantMode: '-', status: 'exempt', detail: 'ρητή εξαίρεση με λόγο στο σημείο χρήσης' };
  if (!coll) return { ...base, tenantMode: '-', status: 'unanalyzable', detail: 'η συλλογή δεν προκύπτει στατικά' };

  const tenant = coll.key ? resolveTenantFor(ctx.tenant, coll.key) : { mode: 'companyId', fieldName: 'companyId' };
  const withMode = { ...base, tenantMode: tenant.mode };

  if (tenant.mode === 'none') {
    return { ...withMode, status: 'not-tenant-scoped', detail: 'tenant-config: mode=none' };
  }
  if (requiresWhere && !hasWhere) {
    // Σκέτο `.collection(X).get()` / `.doc(id)` — άλλη ερώτηση, το κρίνουν τα rules.
    return { ...withMode, status: 'not-tenant-scoped', detail: 'χωρίς where() — δεν είναι list query' };
  }
  // 🔴 Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟ ΣΥΜΒΟΛΑΙΟ: **πρώτα η μέτρηση του ίδιου του call site**,
  // μετά οτιδήποτε συμπερασματικό. Η ανάποδη σειρά είναι το σφάλμα που έφτιαξε
  // αυτή η πύλη για να πιάσει: το `contacts-query.service.ts` είχε **6** συναρτήσεις,
  // οι 5 περνούσαν από τον SSoT και **μία όχι** (ADR-745 §9.5). Ένα κριτήριο
  // «το αρχείο αναφέρει resolveEffectiveCompanyId» θα έβαφε πράσινη τη σπασμένη
  // επειδή οι **γειτόνισσές** της ήταν σωστές.
  if (base.fields.includes(tenant.fieldName)) {
    return { ...withMode, status: 'ok', detail: `φιλτράρει σε ${tenant.fieldName}` };
  }
  if (base.fields.includes('companyId')) {
    return { ...withMode, status: 'ok', detail: 'φιλτράρει σε companyId' };
  }
  // Μόνο **ανά-σημείο** εγγύηση μετρά: η αλυσίδα τυλίγεται όντως σε
  // scopeQueryToCompany(...). Οτιδήποτε επιπέδου αρχείου ΔΕΝ είναι απόδειξη.
  if (ssotGuaranteed) {
    return { ...withMode, status: 'ok', detail: 'η αλυσίδα τυλίγεται σε SSoT helper' };
  }
  if (unresolved) {
    return { ...withMode, status: 'unanalyzable', detail: 'δυναμικό πεδίο ή cross-file constraints' };
  }
  return {
    ...withMode,
    status: 'violation',
    detail: `καμία where('${tenant.fieldName}') — η συλλογή «${coll.name}» είναι ${tenant.mode}-scoped`,
  };
}

// ---------------------------------------------------------------------------
// Δημόσιο API
// ---------------------------------------------------------------------------

/**
 * Σάρωσε **ένα** αρχείο.
 * @param {string} filePath
 * @param {ReturnType<typeof createScanContext>} ctx
 * @returns {Site[]}
 */
function scanFile(filePath, ctx) {
  const src = fs.readFileSync(filePath, 'utf8');
  // CRLF-ανθεκτικό: το working tree είναι Windows (core.autocrlf=true).
  const lines = src.split(/\r?\n/);
  // ScriptKind ρητά: τα fixtures των tests λήγουν σε `.fixture` ώστε να μην τα
  // αγγίζουν tsc/knip/jest — χωρίς ρητό kind ο parser θα τα διάβαζε ως άγνωστα.
  const kind = /\.tsx$/.test(filePath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, true, kind);

  /** @type {Site[]} */
  const sites = [];
  scanClientQueries(filePath, src, sf, ctx, lines, sites);
  scanAdminQueries(filePath, src, sf, ctx, lines, sites);
  return sites;
}

module.exports = {
  createScanContext,
  scanFile,
  classify,
  collectFieldsFromIdentifier,
  collectChainedReassignments,
  isPassedToScopeHelper,
  enclosingScope,
  isExempt,
  SCOPE_HELPER_RE,
  EXEMPT_RE,
};
