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
  resolveCollectionArgs,
  resolveCollectionKeys,
  loadCustodyPartitions,
  buildPartitionAliasMap,
  resolveFieldArg,
  hasReasonedExemption,
  findReasonedExemption,
  allExemptionLines,
  enclosingScope,
} = require('./firestore-ast-loaders');

// 🔑 Ο ΚΑΝΟΝΑΣ 2 ΔΕΝ ΕΧΕΙ ΔΙΚΟ ΤΟΥ ΑΝΑΛΥΤΗ ΑΛΥΣΙΔΑΣ (ADR-870). Είχε, και αυτό ήταν το
// σφάλμα: δύο αναλυτές για την ίδια αλυσίδα, με **διαφορετική** αγκύρωση — ο ένας στο
// `.collection(X)` ανεβαίνοντας, ο άλλος στο τέρμα κατεβαίνοντας — άρα δύο απαντήσεις στην
// ερώτηση «ποιο ερώτημα φεύγει από αυτή τη γραμμή;». Ο σαρωτής του 3.35 ρωτά **άλλο** πράγμα
// («φτάνει φίλτρο μισθωτή;») αλλά πάνω στο **ίδιο** αντικείμενο· το αντικείμενο έχει έναν
// ιδιοκτήτη.
const { createChainContext, scanFileChains } = require('./firestore-query-chain');

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

/**
 * ⚠️ Το `stale-exempt` **δεν είναι παραβίαση**: μια εξαίρεση που δεν καλύπτει τίποτα δεν
 * διαρρέει δεδομένα. Είναι δική της κατηγορία ώστε να μετριέται χωρίς να μολύνει το ratchet.
 * @typedef {'violation'|'ok'|'unanalyzable'|'exempt'|'not-tenant-scoped'|'stale-exempt'} SiteStatus
 */

/**
 * @typedef {Object} Site
 * @property {'R0-exempt'|'R1-client'|'R2-admin'|'R3-service'} rule
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
    // ADR-866 §2.6.7 — `X[kind]` διαμερίσματος κατόχου ⇒ ένας κλάδος ανά κάτοχο.
    partitions: loadCustodyPartitions(),
    // Ο ΚΟΙΝΟΣ αναλυτής αλυσίδας (ADR-870), φτιαγμένος **μία** φορά ανά εκτέλεση.
    chain: createChainContext(),
  };
}

/**
 * **Ένα σημείο ανά κλάδο** συλλογής: literal ⇒ ένα· διαμέρισμα κατόχου ⇒ ένα ανά κάτοχο, κάθε
 * κλάδος κρίνεται μόνος του· τίποτα ⇒ ένα `unanalyzable` (ποτέ σιωπηλή εξαφάνιση).
 *
 * @param {Site[]} sites
 * @param {{key: string|null, name: string|null}[]} colls
 * @param {(coll: {key: string|null, name: string|null}|null) => Site} make
 */
function pushPerBranch(sites, colls, make) {
  for (const coll of colls.length > 0 ? colls : [null]) sites.push(make(coll));
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
function isExempt(lines, lineIndex, consumed) {
  // ⚠️ Ο αναγνώστης είναι ΚΟΙΝΟΣ (ADR-870): το CHECK 3.91 ζητά τον ίδιο κανόνα με άλλο
  // σύνθημα. Δεύτερο αντίγραφο = δύο κανόνες που αποκλίνουν σιωπηλά.
  //
  // 🔴 ΚΑΙ ΚΡΑΤΑΜΕ **ΠΟΙΑ** ΓΡΑΜΜΗ ΤΟ ΚΑΛΥΨΕ. Χωρίς αυτό ο κανόνας ξέρει μόνο ποια σημεία
  // εξαιρούνται — ποτέ ποιες εξαιρέσεις **δεν εξαιρούν τίποτα**. Μετρημένο από τη μελέτη
  // FSE 2025: **50,8%** των suppressions δεν καταστέλλουν καμία προειδοποίηση, και κρύβουν
  // σιωπηλά ό,τι εμφανιστεί εκεί αργότερα. Ίδιο δόγμα με τους «αδρανείς φρουρούς» (N.12).
  const at = findReasonedExemption(lines, lineIndex, 'tenant-scope-exempt');
  if (at >= 0 && consumed) consumed.add(at);
  return at >= 0;
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

function scanClientQueries(filePath, src, sf, ctx, lines, sites, consumed) {
  if (!/\bquery\s*\(/.test(src)) return;
  const partitionAlias = partitionAliasOf(sf, ctx);
  const alias = buildCollectionAliasMap(sf, partitionAlias);

  (function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'query') {
      const args = node.arguments;
      if (args.length > 0) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));

        // — ποια συλλογή; `collection(db, X)` · `getCol(X, conv)` · σκέτο X
        const colls = resolveCollectionArgs(args[0], alias, ctx.collections, partitionAlias);

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

        pushPerBranch(sites, colls, (coll) => classify({
          rule: 'R1-client', file: filePath, line: line + 1, coll, fields, unresolved,
          // ΟΧΙ κριτήριο επιπέδου αρχείου — βλ. σχόλιο πάνω από το SCOPE_HELPER_RE.
          ctx, exempt: isExempt(lines, line, consumed), ssotGuaranteed: false,
        }));
      }
    }
    ts.forEachChild(node, visit);
  })(sf);
}

// ---------------------------------------------------------------------------
// ΚΑΝΟΝΑΣ 2 — Admin SDK: .collection(X)….where(…)
// ---------------------------------------------------------------------------

function scanAdminQueries(filePath, src, sf, ctx, lines, sites, consumed) {
  if (!/\.collection(Group)?\s*\(/.test(src) && !SCOPE_HELPER_RE.test(src)) return;

  // `includeUnterminated`: ο κανόνας κρίνει και τα ερωτήματα που **χτίζονται εδώ και
  // εκτελούνται αλλού**. Το CHECK 3.91 ΔΕΝ το ζητά — εκεί η ερώτηση είναι «ποιο ερώτημα
  // εκτελείται;», και ένας κατασκευαστής δεν εκτελεί. Δύο ερωτήσεις, ένας αναλυτής, ρητή
  // διαφορά — όχι δύο αναλυτές.
  for (const site of scanFileChains(filePath, ctx.chain, { includeUnterminated: true })) {
    const { fields, hasWhere, unresolved } = tenantShapeOf(site.clauses);
    const coll = site.collectionKey
      ? { key: site.collectionKey, name: site.collectionName }
      : null;

    sites.push(classify({
      rule: 'R2-admin',
      file: filePath,
      // Η ΡΙΖΑ, όχι το τέρμα: εκεί είναι γραμμένο το ερώτημα στα μάτια του ανθρώπου, και
      // εκεί έδειχνε ο κανόνας πριν τη μετάβαση — η αλλαγή αγκύρωσης δεν οφείλει να
      // μετακινήσει κάθε γραμμή κάθε αναφοράς.
      line: site.rootLine,
      coll,
      fields,
      unresolved,
      ctx,
      exempt: isExemptAtEither(lines, site, consumed),
      // Οι βοηθοί του ADR-742 εισάγουν το `companyId` ως ρήτρα μέσα στον αναλυτή, άρα
      // φαίνονται στα `fields`. Δεύτερο, ξεχωριστό κριτήριο «τυλίγεται;» θα ήταν δεύτερη
      // αυθεντία για το ίδιο ερώτημα.
      ssotGuaranteed: false,
      requiresWhere: true,
      hasWhere,
      docScoped: site.docScoped,
    }));
  }
}

/**
 * Οι ρήτρες του αναλυτή → το επίπεδο σχήμα που ρωτά ο {@link classify}.
 *
 * 🔴 **ΑΝΑ ΣΗΜΕΙΟ, ΟΧΙ ΑΝΑ ΚΛΑΔΟ** — και αυτό είναι απόφαση, όχι λεπτομέρεια. Ο αναλυτής
 * απαριθμεί κλάδους επειδή το CHECK 3.91 ρωτά **διαθεσιμότητα** («σκάει ΚΑΠΟΙΑ διαδρομή;»):
 * εκεί μία διαδρομή χωρίς δείκτη είναι σφάλμα παραγωγής. Εδώ η ερώτηση είναι **απομόνωση**,
 * και ο κανονικός κώδικας του έργου βάζει το φίλτρο **υπό συνθήκη** (`if (!isSuperAdmin)`).
 * Κρίση ανά κλάδο θα κατήγγειλε κάθε τέτοιο σημείο — μετρημένο: **5 ψευδώς θετικά**, όλα
 * νόμιμος κώδικας που περνά από τους βοηθούς του ADR-742. Η πολιτική «ποιος δικαιούται
 * cross-tenant» ανήκει στο `scopeQueryToTenant` (ADR-702)· εδώ κρίνεται αν το φίλτρο
 * **υπάρχει πουθενά** στο σημείο.
 *
 * @param {import('./firestore-query-chain').Clause[]} clauses
 */
function tenantShapeOf(clauses) {
  const fields = new Set();
  let hasWhere = false;
  let unresolved = false;
  for (const cl of clauses) {
    if (cl.kind === 'unresolved') {
      unresolved = true;
      // Άγνωστο **πεδίο** δεν σημαίνει άγνωστο **είδος**: ένα δυναμικό `where()` εξακολουθεί
      // να είναι φίλτρο, άρα το σημείο ΕΙΝΑΙ list query και οφείλει να κριθεί
      // (`unanalyzable`, ποτέ violation — η άγνοια δεν είναι ενοχή). Χωρίς αυτή τη γραμμή
      // καταλήγει «χωρίς where()», δηλαδή **εκτός εμβέλειας**: σιωπηλή αθώωση.
      if (cl.from === 'where') hasWhere = true;
      continue;
    }
    if (cl.kind === 'order') continue;      // ταξινόμηση δεν φιλτράρει
    hasWhere = true;
    if (cl.field) fields.add(cl.field); else unresolved = true;
  }
  return { fields, hasWhere, unresolved };
}

/**
 * 🔴 Η ΑΙΤΙΟΛΟΓΙΑ ΓΙΝΕΤΑΙ ΔΕΚΤΗ ΚΑΙ ΣΤΑ ΔΥΟ ΑΚΡΑ ΤΗΣ ΑΛΥΣΙΔΑΣ.
 *
 * Η αγκύρωση στο τέρμα είναι ακριβώς αυτό που κάνει ορατή την **τέταρτη μορφή** (ρίζα δεμένη
 * σε όνομα, φίλτρα σε άλλη εντολή) — αλλά στην ίδια μορφή το τέρμα απέχει από τη γραμμή όπου
 * ο άνθρωπος γράφει τον λόγο του. Μετρημένο στο `entity-audit.service.ts`: η αιτιολογία στη
 * γρ. 342, το `.get()` στη γρ. 356 — **δεκατέσσερις γραμμές**, με κώδικα ανάμεσα που κόβει
 * τον αναγνώστη μπλοκ. Ένα άκρο μόνο ⇒ **4 σημεία / 2 αρχεία** με τεκμηριωμένη εξαίρεση θα
 * γίνονταν ψευδώς κόκκινα: η πύλη θα τιμωρούσε όποιον έκανε ό,τι του ζητήθηκε.
 */
function isExemptAtEither(lines, site, consumed) {
  const atRoot = isExempt(lines, site.rootLine - 1, consumed);
  const atEnd = isExempt(lines, site.line - 1, consumed);
  return atRoot || atEnd;
}


// ---------------------------------------------------------------------------
// ΚΑΝΟΝΑΣ 3 — το κεντρικό API: `firestoreQueryService.*(KEY, { tenantOverride: 'skip' })`
// ---------------------------------------------------------------------------

/**
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ (μετρημένο 2026-08-05)
 *
 * Οι R1/R2 κοιτούν **direct** `query()` και **Admin SDK** αλυσίδες. Καμία πύλη —
 * ούτε το 3.10, ούτε το 3.15, ούτε ο R1/R2 — δεν κοιτούσε τη διαδρομή μέσω του
 * **κεντρικοποιημένου** `firestoreQueryService` (ADR-214), δηλαδή ακριβώς το API
 * που όλος ο κώδικας ενθαρρύνεται να χρησιμοποιεί. Εκεί το φίλτρο μισθωτή
 * απενεργοποιείται με **μία λέξη**:
 *
 *     firestoreQueryService.getAll('PROPERTIES', { tenantOverride: 'skip' })
 *
 * και `buildTenantConstraints` κάνει `if (tenantOverride === 'skip') return []`.
 * Μετρήθηκαν **16** τέτοια σημεία σε 11 αρχεία· το `getProperties()` — ζωντανό,
 * καλούμενο από το `useContactsState` — παρακάμπτει έτσι το `companyId` σε
 * συλλογή που η **αυθεντία** (`tenant-config.ts`) δηλώνει `companyId`-scoped,
 * **χωρίς μία γραμμή σχολίου**.
 *
 * 🔑 ΤΟ ΣΧΗΜΑ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΜΕ ΤΟ ΓΕΝΕΣΙΟΥΡΓΟ: «η πύλη κοιτά ένα σχήμα κειμένου·
 * ο κώδικας γράφτηκε σε άλλο». Η μόνη διαφορά είναι ότι εδώ το «άλλο σχήμα» είναι
 * το **συνιστώμενο** — γι' αυτό είναι χειρότερο, όχι καλύτερο.
 *
 * ⚠️ Ο κανόνας **ΔΕΝ απαγορεύει** το `skip`: υπάρχουν νόμιμες χρήσεις (shared/system
 * content, batch-get με `documentId()`, server-side κώδικας που βλέπει όλους τους
 * μισθωτές εκ σχεδιασμού). Απαιτεί **αιτιολόγηση**, με το ίδιο ακριβώς σύστημα
 * εξαίρεσης του R1/R2 (`// tenant-scope-exempt: <λόγος>`, λόγος υποχρεωτικός).
 * Η νόμιμη χρήση κοστίζει μία γραμμή· η αθέλητη σταματά.
 *
 * ⚠️ Το πρώτο όρισμα είναι **CollectionKey**, όχι όνομα συλλογής — γι' αυτό ο κανόνας
 * δεν χρησιμοποιεί το `resolveCollectionArg` (που ερμηνεύει το string literal ως
 * *όνομα*). Κλειδί που δεν προκύπτει στατικά ⇒ `unanalyzable`, **ποτέ** violation.
 */
const QUERY_SERVICE_RE = /\bfirestoreQueryService\s*\./;

/**
 * `{ … tenantOverride: 'skip' … }` — επιστρέφει τον **κόμβο** της ανάθεσης (όχι boolean),
 * ώστε ο κανόνας να ξέρει σε ποια γραμμή κάθεται η ίδια η παράκαμψη.
 *
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ Ο ΚΟΜΒΟΣ ΚΑΙ ΟΧΙ ΣΚΕΤΟ `true`: οι κλήσεις του service είναι
 * **πολυγραμμικές** (`subscribeDoc(key, id, cb, onErr, { … })` πιάνει 8 γραμμές). Ο
 * αναγνώστης γράφει τον λόγο **δίπλα στο `tenantOverride`**, όχι πάνω από την ανοιχτή
 * παρένθεση δέκα γραμμές πιο πάνω. Η πρώτη εκδοχή κοιτούσε μόνο τη γραμμή της κλήσης και
 * **απέρριπτε την τεκμηριωμένη εξαίρεση ενώ δεχόταν τη βιαστική μονόγραμμη** — ακριβώς το
 * σφάλμα που το σχόλιο του {@link isExempt} προειδοποιεί να μην επαναληφθεί.
 *
 * @returns {ts.PropertyAssignment|null}
 */
function findSkipOverride(node) {
  if (!ts.isObjectLiteralExpression(node)) return null;
  for (const p of node.properties) {
    if (
      ts.isPropertyAssignment(p) &&
      ts.isIdentifier(p.name) &&
      p.name.text === 'tenantOverride' &&
      ts.isStringLiteralLike(p.initializer) &&
      p.initializer.text === 'skip'
    ) {
      return p;
    }
  }
  return null;
}

/**
 * `'PROPERTIES'` → `[{key:'PROPERTIES', name:'properties'}]` όταν το κλειδί υπάρχει στο
 * μητρώο συλλογών· `X[kind]` διαμερίσματος ⇒ ένα ανά κλάδο (ADR-866 §2.6.7)· κενό όταν είναι
 * δυναμικό (μεταβλητή, παράμετρος, ένωση).
 */
function resolveCollectionKeyArgs(expr, collectionsMap, partitionAlias) {
  return resolveCollectionKeys(expr, partitionAlias)
    .filter((key) => collectionsMap.has(key))
    .map((key) => ({ key, name: collectionsMap.get(key) }));
}

/** Τα διαμερίσματα κατόχου όπως φαίνονται **σε αυτό** το αρχείο (με ψευδώνυμα εισαγωγής). */
function partitionAliasOf(sf, ctx) {
  return buildPartitionAliasMap(sf, ctx.partitions || new Map());
}

function scanServiceOverrides(filePath, src, sf, ctx, lines, sites, consumed) {
  if (!/tenantOverride/.test(src) || !QUERY_SERVICE_RE.test(src)) return;

  (function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(sf) === 'firestoreQueryService'
    ) {
      // Το options object δεν έχει σταθερή θέση: `getAll(key, opts)` αλλά
      // `subscribeDoc(key, id, cb, onErr, opts)`. Ψάχνουμε σε ΟΛΑ τα ορίσματα —
      // υπόθεση θέσης εδώ θα ήταν σιωπηλή απώλεια, όχι απλοποίηση.
      let skipNode = null;
      for (const a of node.arguments) {
        skipNode = findSkipOverride(a);
        if (skipNode) break;
      }
      if (skipNode) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        const skipLine = sf.getLineAndCharacterOfPosition(skipNode.getStart(sf)).line;
        const colls = resolveCollectionKeyArgs(node.arguments[0], ctx.collections, partitionAliasOf(sf, ctx));
        pushPerBranch(sites, colls, (coll) =>
          classify({
            rule: 'R3-service',
            file: filePath,
            line: line + 1,
            coll,
            fields: new Set(),
            unresolved: false,
            ctx,
            // ΔΥΟ άγκυρες: πάνω από την κλήση **ή** πάνω από το ίδιο το `tenantOverride`.
            // Και οι δύο θέσεις είναι φυσικές για τον αναγνώστη — βλ. findSkipOverride.
            exempt: isExempt(lines, line, consumed) || isExempt(lines, skipLine, consumed),
            ssotGuaranteed: false,
            skipOverride: true,
          }),
        );
      }
    }
    ts.forEachChild(node, visit);
  })(sf);
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
function classify({ rule, file, line, coll, fields, unresolved, ctx, exempt, ssotGuaranteed, requiresWhere, hasWhere, skipOverride, docScoped }) {
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
  // 🔴 ΥΠΟΣΥΛΛΟΓΗ ΚΑΤΩ ΑΠΟ ΕΓΓΡΑΦΟ: `contacts/{id}/bank_accounts`. Ο άξονας απομόνωσης είναι
  // **η διαδρομή** — το έγγραφο-γονέας είναι ήδη ένα, και ένα `where('companyId')` εκεί δεν
  // στενεύει τίποτα. Ο σαρωτής σταματούσε στην εσώτερη `.collection()` χωρίς ΠΟΤΕ να κοιτάξει
  // τον παραλήπτη της, άρα υποσυλλογή και ρίζα ήταν **αδιάκριτες**: 6 σημεία / 4 αρχεία θα
  // γεννιόνταν κόκκινα ζητώντας φίλτρο που θα ήταν ανοησία (ADR-742 «ένα gate δεν γεννιέται
  // κόκκινο»). ⚠️ ΔΕΝ είναι «ασφαλές»: λέει ότι η ερώτηση της απομόνωσης ανήκει στον ΓΟΝΕΑ —
  // ποιος έλυσε το `{id}` — και αυτή κρίνεται στο σημείο που τον έλυσε, όχι εδώ.
  if (docScoped) {
    return { ...withMode, status: 'not-tenant-scoped', detail: 'υποσυλλογή κάτω από .doc() — ο άξονας είναι η διαδρομή' };
  }
  if (requiresWhere && !hasWhere) {
    // Σκέτο `.collection(X).get()` / `.doc(id)` — άλλη ερώτηση, το κρίνουν τα rules.
    return { ...withMode, status: 'not-tenant-scoped', detail: 'χωρίς where() — δεν είναι list query' };
  }
  // R3: εδώ ΔΕΝ ρωτάμε «ποια πεδία φιλτράρονται». Το `tenantOverride: 'skip'` είναι
  // **ρητή εντολή στον πυρήνα να ΜΗΝ βάλει το φίλτρο** (`buildTenantConstraints` →
  // `if (skip) return []`). Ένα χειροκίνητο `where('tenantId', …)` δίπλα του δεν είναι
  // απάντηση: μπορεί να μπαίνει **υπό συνθήκη** — και τότε η γραμμή που κρίνεται είναι
  // ακριβώς η διαδρομή όπου δεν μπήκε. Άρα: ή αιτιολογείς, ή είναι παράβαση.
  if (skipOverride) {
    // Inline (όπως τα υπόλοιπα σύντομα returns εδώ) — και **επίτηδες** όχι στο πολυγραμμικό
    // σχήμα του τελικού κλάδου: το Μ0 του mutation suite στοχεύει το `status: 'violation',`
    // με εσοχή 4, και δεύτερη ίδια εμφάνιση θα το έκανε να μεταλλάσσει λάθος κλάδο ⇒ «5/5
    // σκοτωμένες» χωρίς να έχει τρέξει τίποτα. Η αναγνωσιμότητα εδώ είναι *συμβόλαιο*.
    return { ...withMode, status: 'violation', detail: `tenantOverride:'skip' σε ${tenant.mode}-scoped «${coll.name || coll.key}» χωρίς αιτιολόγηση` };
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
// Η ΑΝΤΙΣΤΡΟΦΗ ΕΡΩΤΗΣΗ — «ποια εξαίρεση δεν εξαιρεί τίποτα;»
// ---------------------------------------------------------------------------

/**
 * 🔴 ΤΟ 50,8%.
 *
 * Η μελέτη **FSE 2025** («An Empirical Study of Suppressed Static Analysis Warnings»,
 * 7.357 suppressions σε 46 έργα, Pylint/Checkstyle/PMD/ESLint) μέτρησε ότι **50,8% των
 * suppressions δεν επηρεάζουν καμία προειδοποίηση** — είναι πρακτικά άχρηστα — και ότι το
 * πλήθος τους **αυξάνεται μονότονα** στη ζωή ενός έργου. Το χειρότερο δεν είναι ο θόρυβος:
 * *«μερικά, συμπεριλαμβανομένων των άχρηστων, μπορεί να κρύψουν ακούσια ΜΕΛΛΟΝΤΙΚΕΣ
 * προειδοποιήσεις»*. Μια εξαίρεση που σήμερα δεν καλύπτει τίποτα είναι **προ-εγκεκριμένο
 * veto** σε ό,τι γραφτεί εκεί αύριο.
 *
 * Γι' αυτό η επιλογή «αιτιολογία inline αντί για φούσκωμα της baseline» — που η ίδια η
 * βιβλιογραφία συνιστά για μακροπρόθεσμη συντηρησιμότητα — **δεν είναι ασφαλής χωρίς αυτόν
 * τον φρουρό**. Είναι ακριβώς το δόγμα των «αδρανών φρουρών» του N.12 (`ssot:audit
 * --dormant`: 606/671 patterns χωρίς απόδειξη ζωής), στραμμένο στις εξαιρέσεις.
 *
 * ⚠️ **ΔΕΝ είναι παραβίαση**: μια άχρηστη εξαίρεση δεν διαρρέει δεδομένα. Είναι δική της
 * κατηγορία (`stale-exempt`) ώστε να **μετριέται** χωρίς να μολύνει τον αριθμό του ratchet.
 */
function collectStaleExemptions(filePath, lines, sites, consumed) {
  for (const i of allExemptionLines(lines, 'tenant-scope-exempt')) {
    if (consumed.has(i)) continue;
    sites.push({
      rule: 'R0-exempt', file: filePath, line: i + 1,
      collectionKey: null, collectionName: null, tenantMode: '-', fields: [],
      status: 'stale-exempt',
      detail: 'αιτιολογημένη εξαίρεση που δεν καλύπτει κανένα σημείο — σιωπηλό veto σε ό,τι γραφτεί εδώ αύριο',
    });
  }
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
  const consumed = new Set();
  scanClientQueries(filePath, src, sf, ctx, lines, sites, consumed);
  scanAdminQueries(filePath, src, sf, ctx, lines, sites, consumed);
  scanServiceOverrides(filePath, src, sf, ctx, lines, sites, consumed);
  collectStaleExemptions(filePath, lines, sites, consumed);
  return sites;
}

module.exports = {
  createScanContext,
  scanFile,
  classify,
  collectFieldsFromIdentifier,
  isExempt,
  findSkipOverride,
  resolveCollectionKeyArgs,
  SCOPE_HELPER_RE,
  EXEMPT_RE,
  QUERY_SERVICE_RE,
};
