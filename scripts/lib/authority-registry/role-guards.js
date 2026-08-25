'use strict';

/**
 * CHECK 3.68 / Κ1′ — **Ο ΦΡΟΥΡΟΣ ΡΟΛΟΥ ΜΕΣΑ ΣΤΟΝ HANDLER** (ADR-801 §2.11).
 *
 * **«Αποφασίζει μια διαδρομή ΑΡΝΗΣΗ με βάση τον ρόλο του καλούντος, μέσα στο σώμα
 * της, αντί να το δηλώσει στο σύνορο;»**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΟ ΥΠΑΡΧΟΝ ΚΡΙΤΗΡΙΟ ΗΤΑΝ ΤΥΦΛΟ — ΚΑΙ ΔΕΝ ΗΤΑΝ «ΛΑΘΟΣ ΜΕΤΑΒΛΗΤΗ»
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο Κ1 ρωτά *«υπάρχουν **≥2 ρόλοι** μαζί;»* — μετρημένη απόφαση για ψευδώς θετικά
 * <10% (ADR-801 §2.5). Ένας **μονορολικός** φρουρός δεν είναι σύνολο, άρα ήταν
 * αόρατος. Η πρώτη διάγνωση είπε *«λάθος μεταβλητή»*· η **μέτρηση την ανέτρεψε**:
 * ήταν **λάθος ΓΛΩΣΣΑ**. Μια σάρωση κειμένου ρωτά *«ποια γραμμή γράφει
 * `ctx.globalRole`;»*, ενώ το ερώτημα είναι *«ποια **απόφαση άρνησης** εξαρτάται
 * **αποκλειστικά** από τον ρόλο του καλούντος;»* — και αυτό **μόνο** το AST το
 * απαντά. Η κληρονομημένη απογραφή (regex `ctx.globalRole` πάνω σε `src/app/api`)
 * δήλωνε **0** φρουρούς· η ίδια μέρα, με AST πάνω σε **όλο** το `src/`: **6**.
 *
 * | Τι έχανε το regex | Παράδειγμα | Γιατί |
 * |---|---|---|
 * | άλλο όνομα δέκτη | `auth.globalRole !== 'super_admin' && …` | το μοτίβο έλεγε `ctx.` |
 * | εκτός `src/app/api` | `admin-migration-runner.ts` — ο **κοινός** φρουρός **όλων** των migrations | η εμβέλεια ήταν φάκελος |
 * | ενδιάμεση μεταβλητή | `const isAdmin = …; if (!isAdmin) → 403` | η γραμμή της άρνησης δεν αναφέρει ρόλο |
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΚΡΙΤΗΡΙΟ — ΤΡΕΙΣ ΣΥΝΘΗΚΕΣ ΜΑΖΙ, ΚΑΙ ΚΑΘΕ ΜΙΑ ΤΗΝ ΑΠΟΦΑΣΙΣΕ ΨΕΥΔΩΣ ΘΕΤΙΚΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Φρουρός είναι ένας έλεγχος όπου **και οι τρεις** ισχύουν:
 *
 * **(α) Η συνθήκη είναι ΑΠΟΚΛΕΙΣΤΙΚΑ ρόλου του ΚΑΛΟΥΝΤΟΣ.** Ένας τελεστέος που
 * μιλά για **πόρο** (ιδιοκτησία, μισθωτής, δεδομένα) βγάζει τον έλεγχο από την
 * κλάση: εκεί ο ρόλος είναι **μέρος** του κριτηρίου, και η ανύψωσή του θα έκλεινε
 * τη διαδρομή σε **όλους** πλην υπερδιαχειριστή — *θα έσπαγε λειτουργία ενώ θα
 * έμοιαζε σκλήρυνση* (ADR-801 §2.10).
 *
 * ⚠️ **ΚΑΛΟΥΝΤΟΣ, ΟΧΙ ΔΕΔΟΜΕΝΟΥ.** Το `globalRole` ως **γυμνός ταυτοποιητής**
 * είναι παράμετρος σώματος αιτήματος υπό **επικύρωση** (`isValidGlobalRole` ⇒
 * **400**), όχι ταυτότητα. Χωρίς αυτή τη διάκριση: **2 ψευδώς θετικά στα 11**
 * (`bootstrap-admin-logic` · `claims-handler`), **μετρημένα**.
 *
 * **(β) Κάποιο σκέλος ΑΡΝΕΙΤΑΙ — 401/403 ή `throw`.** Το **400** είναι επικύρωση
 * εισόδου και το **409** σύγκρουση κατάστασης· κανένα δεν είναι άρνηση
 * εξουσιοδότησης.
 *
 * **(γ) Η άρνηση είναι ΑΜΕΣΗ — ποτέ πίσω από ΔΕΥΤΕΡΗ απόφαση.** Εδώ χωρίζεται ο
 * «φρουρός ρόλου» από την «**παράκαμψη** ελέγχου **από** τον ρόλο»:
 *
 * ```ts
 * if (!isRoleBypass(auth.globalRole)) {     // ← ΔΕΝ είναι φρουρός ρόλου:
 *   if (txn.matchedByName === auth.email) { //   ο ρόλος ΕΞΑΙΡΕΙ από κανόνα που
 *     return problemResponse(…403…);        //   κρίνει ΤΑΥΤΟΤΗΤΑ, όχι ρόλο
 *   }
 * }
 * ```
 *
 * Χωρίς τη συνθήκη (γ): **3 ψευδώς θετικά στα 11** (segregation of duties ·
 * dependency check), **μετρημένα**. Με τις τρεις μαζί: **6 ευρήματα, 0% ψευδώς
 * θετικά** — πήχης Google για μπλοκάρουσα πύλη: **<10%**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΤΑΥΤΟΤΗΤΑ ΕΙΝΑΙ Η **ΣΥΝΘΗΚΗ**, ΟΧΙ Η ΓΡΑΜΜΗ ΚΑΙ ΟΧΙ ΤΟ ΑΡΧΕΙΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * · **γραμμή** ⇒ κάθε μετακίνηση κώδικα φαίνεται «νέα παραβίαση» και η πύλη
 *   μπλοκάρει τη **θεραπεία** (το σφάλμα που το `Κ2` του CHECK 3.53 υπάρχει για να
 *   μην ξανασυμβεί)·
 * · **αρχείο** ⇒ **δεύτερος** φρουρός στο **ίδιο** αρχείο κληρονομεί σιωπηλά τη
 *   δήλωση του πρώτου — δηλαδή η δήλωση γίνεται λευκή επιταγή.
 *
 * 🔶 **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: δύο φρουροί με **κυριολεκτικά ταυτόσημη** συνθήκη στο ίδιο
 * αρχείο μοιράζονται ταυτότητα. Είναι ο ίδιος έλεγχος γραμμένος δύο φορές — και
 * **αυτό** το πιάνει το CHECK 3.28 (jscpd), όχι αυτή η πύλη.
 *
 * @module scripts/lib/authority-registry/role-guards
 */

const path = require('node:path');
const ts = require('typescript');

const { parseSource } = require('../contrast-promise/ts-read');

/** Η ιδιότητα που **ΕΙΝΑΙ** ο ρόλος του καλούντος. Ζει μόνο σε `AuthContext`/claims. */
const ROLE_PROPERTY = 'globalRole';

/**
 * Κατηγορήματα που **τυλίγουν** τον ρόλο και απαντούν boolean.
 *
 * 🔴 **ΤΟ ΠΡΩΤΟ ΕΠΙΧΕΙΡΗΜΑ ΓΙΑ ΑΥΤΗ ΤΗ ΛΙΣΤΑ ΗΤΑΝ ΛΑΘΟΣ, ΚΑΙ ΤΟ ΑΠΕΔΕΙΞΕ
 * ΜΕΤΑΛΛΑΞΗ ΠΟΥ ΒΓΗΚΕ ΠΡΑΣΙΝΗ.** Έλεγε *«εκτός το `isValidGlobalRole`, γιατί
 * κρίνει δεδομένο»* — αλλά η προσθήκη του **δεν αλλάζει τίποτα**: η διάκριση
 * *δεδομένο ↔ ταυτότητα* γίνεται από το **ΟΡΙΣΜΑ** (γυμνός ταυτοποιητής από
 * destructuring του σώματος έναντι `<κάτι>.globalRole`), όχι από το όνομα της
 * συνάρτησης. Μετρημένο: και οι **τέσσερις** ζωντανές κλήσεις του
 * `isValidGlobalRole` παίρνουν γυμνό ταυτοποιητή ή `member.globalRole` σε
 * **ternary που δεν αρνείται**. *Μια μετάλλαξη που δεν αλλάζει συμπεριφορά δεν
 * αποδεικνύει τίποτα* (μάθημα CHECK 3.40 / `Μ6`).
 *
 * ⚠️ Η λίστα υπάρχει για **έναν** λόγο: να αναγνωρίζει ότι το `isRoleBypass(x)`
 * είναι **ο ρόλος**, ώστε το `!isRoleBypass(ctx.globalRole)` να μετρά ως συνθήκη
 * ρόλου. Αφαίρεσέ το και ο κυρίαρχος φρουρός του δέντρου γίνεται **αόρατος**.
 */
const IDENTITY_ROLE_PREDICATES = new Set(['isRoleBypass', 'hasGlobalRole']);

/** Οι κωδικοί που σημαίνουν **άρνηση εξουσιοδότησης** — ποτέ 400 (επικύρωση) ή 409 (σύγκρουση). */
const DENIAL_STATUS = new Set(['401', '403']);

/** Ονόματα κλήσεων που **είναι** άρνηση, όποιον κωδικό κι αν κουβαλούν από μέσα. */
const DENIAL_NAME = /forbidden|unauthori[sz]ed|denied|deny/i;

// =============================================================================
// (α) ΕΙΝΑΙ Η ΕΚΦΡΑΣΗ ΠΑΡΑΓΟΜΕΝΗ ΑΠΟΚΛΕΙΣΤΙΚΑ ΑΠΟ ΤΟΝ ΡΟΛΟ ΤΟΥ ΚΑΛΟΥΝΤΟΣ;
// =============================================================================

/** Είναι ο κόμβος σταθερά με την οποία **συγκρίνεται** ρόλος; */
function isRoleLiteral(node) {
  return ts.isStringLiteral(node)
    || node.kind === ts.SyntaxKind.NullKeyword
    || (ts.isIdentifier(node) && node.text === 'undefined');
}

function calleeName(call) {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return '';
}

/**
 * Είναι αυτή η έκφραση **αποκλειστικά** συνάρτηση του ρόλου του καλούντος;
 *
 * ⚠️ Στους λογικούς συνδυασμούς απαιτούνται **ΚΑΙ ΤΑ ΔΥΟ** σκέλη ρόλου. Ένα «ή»
 * θα δεχόταν `isSuperAdmin || data.authorId === ctx.uid` ως «καθαρά ρόλου» και θα
 * ανύψωνε έλεγχο **ιδιοκτησίας** — η κλάση σφάλματος που απαγορεύει ρητά το
 * ADR-801 §2.10.
 */
function isCallerRoleExpression(node, roleLocals) {
  if (node === undefined || node === null) return false;

  if (ts.isParenthesizedExpression(node)) return isCallerRoleExpression(node.expression, roleLocals);
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
    return isCallerRoleExpression(node.operand, roleLocals);
  }

  // `ctx.globalRole` / `auth.globalRole` / `identity.globalRole` — ο δέκτης δεν έχει
  // σημασία, η **ιδιότητα** είναι μονοσήμαντη.
  if (ts.isPropertyAccessExpression(node) && node.name.text === ROLE_PROPERTY) return true;
  if (ts.isElementAccessExpression(node)
      && node.argumentExpression !== undefined
      && ts.isStringLiteral(node.argumentExpression)
      && node.argumentExpression.text === ROLE_PROPERTY) return true;

  if (ts.isCallExpression(node)) {
    const name = calleeName(node);
    if (IDENTITY_ROLE_PREDICATES.has(name)) {
      // ⚠️ **ΤΟ ΟΡΙΣΜΑ ΕΙΝΑΙ ΤΟ ΚΡΙΤΗΡΙΟ, ΟΧΙ ΤΟ ΟΝΟΜΑ.** Μηδενικού πληθυσμού
      //    κλάδος «κλήση χωρίς όρισμα» **αφαιρέθηκε**: μετρήθηκε ότι δεν υπάρχει
      //    καμία `isRoleBypass()` σε όλο το `src/` (ADR-749 §5).
      return node.arguments.some((a) => isCallerRoleExpression(a, roleLocals));
    }
    // `ADMIN_ROLES.includes(ctx.globalRole)` / `.has(...)` — δοκιμή μέλους πάνω σε ρόλο.
    if ((name === 'includes' || name === 'has')
        && node.arguments.some((a) => isCallerRoleExpression(a, roleLocals))) return true;
    return false;
  }

  // τοπικό όνομα που **κρατά** έκφραση ρόλου: `const isSuperAdmin = isRoleBypass(ctx.globalRole)`
  if (ts.isIdentifier(node)) return roleLocals.has(node.text);

  if (ts.isBinaryExpression(node)) {
    const kind = node.operatorToken.kind;
    if (kind === ts.SyntaxKind.AmpersandAmpersandToken
        || kind === ts.SyntaxKind.BarBarToken
        || kind === ts.SyntaxKind.QuestionQuestionToken) {
      return isCallerRoleExpression(node.left, roleLocals)
        && isCallerRoleExpression(node.right, roleLocals);
    }
    if (kind === ts.SyntaxKind.EqualsEqualsEqualsToken
        || kind === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
      const left = isCallerRoleExpression(node.left, roleLocals);
      const right = isCallerRoleExpression(node.right, roleLocals);
      return (left && isRoleLiteral(node.right)) || (right && isRoleLiteral(node.left)) || (left && right);
    }
    return false;
  }

  return false;
}

/**
 * Τα τοπικά ονόματα του αρχείου που κρατούν έκφραση ρόλου καλούντος.
 *
 * ⚠️ **Σταθερό σημείο, όχι ένα πέρασμα**: `const a = ctx.globalRole; const b = a === 'x';`
 * — το `b` γίνεται γνωστό **μόνο** αφού γίνει γνωστό το `a`. Ένα πέρασμα θα άφηνε
 * αλυσίδες δύο κρίκων **σιωπηλά αόρατες**.
 */
function collectRoleLocals(sourceFile) {
  const locals = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    const visit = (node) => {
      if (ts.isVariableDeclaration(node)
          && ts.isIdentifier(node.name)
          && node.initializer !== undefined
          && !locals.has(node.name.text)
          && isCallerRoleExpression(node.initializer, locals)) {
        locals.add(node.name.text);
        changed = true;
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
  }
  return locals;
}

// =============================================================================
// (β)+(γ) ΑΡΝΕΙΤΑΙ ΤΟ ΣΚΕΛΟΣ, ΑΜΕΣΑ;
// =============================================================================

/** Κόμβος που εισάγει **δεύτερη απόφαση** — η διάσχιση σταματά εκεί. */
function isDecisionNode(node) {
  return ts.isIfStatement(node)
    || ts.isConditionalExpression(node)
    || ts.isSwitchStatement(node)
    || ts.isForStatement(node)
    || ts.isForInStatement(node)
    || ts.isForOfStatement(node)
    || ts.isWhileStatement(node)
    || ts.isDoStatement(node)
    || ts.isCatchClause(node);
}

/**
 * Αρνείται αυτό το σκέλος **άνευ όρων**;
 *
 * ⚠️ **Η ΔΙΑΣΧΙΣΗ ΣΤΑΜΑΤΑ ΣΕ ΚΑΘΕ ΔΕΥΤΕΡΗ ΑΠΟΦΑΣΗ.** Χωρίς αυτό, μια άρνηση
 * βαθιά μέσα σε εμφωλευμένο `if` χρεώνεται στον εξωτερικό έλεγχο ρόλου — και τότε
 * κάθε *παράκαμψη ελέγχου από τον ρόλο* διαβάζεται ως *φρουρός ρόλου*.
 */
function deniesDirectly(node) {
  if (node === undefined || node === null) return false;
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (ts.isThrowStatement(n)) { found = true; return; }
    if (ts.isNumericLiteral(n) && DENIAL_STATUS.has(n.text)) { found = true; return; }
    if (ts.isCallExpression(n) && DENIAL_NAME.test(calleeName(n))) { found = true; return; }
    if (n !== node && isDecisionNode(n)) return;
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

/** Περιέχει αυτό το statement **οποιαδήποτε** απόφαση; */
function containsDecision(node) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (ts.isIfStatement(n) || ts.isSwitchStatement(n) || ts.isConditionalExpression(n)) {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

/** Τερματίζει το σκέλος τη ροή (`return` / `throw`); */
function exitsFlow(node) {
  if (node === undefined || node === null) return false;
  if (ts.isReturnStatement(node) || ts.isThrowStatement(node)) return true;
  if (ts.isBlock(node)) return node.statements.some(exitsFlow);
  return false;
}

/** Τα statements που ακολουθούν, μέσα στο **ίδιο** μπλοκ. */
function statementsAfter(statement) {
  const parent = statement.parent;
  if (parent === undefined) return [];
  if (!ts.isBlock(parent) && !ts.isSourceFile(parent) && !ts.isCaseClause(parent)) return [];
  const list = [...parent.statements];
  const index = list.indexOf(statement);
  return index < 0 ? [] : list.slice(index + 1);
}

/**
 * **Ο ΑΝΤΕΣΤΡΑΜΜΕΝΟΣ ΦΡΟΥΡΟΣ**: `if (<ρόλος>) return …;` και **όλο** το υπόλοιπο
 * σώμα είναι άρνηση. Ζωντανή μορφή στο δέντρο (`ensureSuperAdmin`):
 *
 * ```ts
 * if (isRoleBypass(ctx.globalRole)) return null;   // ← το «επιτρέπεται»
 * logger.warn(…);
 * return createForbiddenResponse(action);          // ← το «όχι»
 * ```
 *
 * ⚠️ **Η ουρά πρέπει να είναι ΚΑΘΑΡΗ άρνηση.** Αν περιέχει **οποιαδήποτε** άλλη
 * απόφαση, τότε ο έλεγχος ρόλου είναι απλώς μια πρόωρη έξοδος και η άρνηση ανήκει
 * σε **άλλο** κριτήριο. Χωρίς αυτόν τον περιορισμό: **2 ψευδώς θετικά**,
 * μετρημένα — κάθε `if (…) return;` πάνω από έναν οποιονδήποτε 403 γινόταν φρουρός.
 */
function tailDenies(ifStatement) {
  if (ifStatement.elseStatement !== undefined) return false;
  if (!exitsFlow(ifStatement.thenStatement)) return false;
  const tail = statementsAfter(ifStatement);
  if (tail.length === 0) return false;
  if (tail.some((s) => containsDecision(s))) return false;
  return tail.some((s) => deniesDirectly(s));
}

// =============================================================================
// Η ΣΑΡΩΣΗ ΕΝΟΣ ΑΡΧΕΙΟΥ
// =============================================================================

/** Κανονικοποιημένο κείμενο συνθήκης — η **ταυτότητα** ενός φρουρού. */
function conditionText(node, sourceFile) {
  return node.getText(sourceFile).replace(/\s+/g, ' ').trim();
}

/**
 * Οι έλεγχοι ρόλου καλούντος ενός αρχείου, με ετυμηγορία «αρνείται;» στον καθένα.
 *
 * @returns {Array<{file:string,line:number,condition:string,denies:boolean,shape:string}>}
 */
function scanRoleChecks(root, rel) {
  const sourceFile = parseSource(path.join(root, rel));
  const roleLocals = collectRoleLocals(sourceFile);
  const lineOf = (node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  const checks = [];

  const visit = (node) => {
    if (ts.isIfStatement(node) && isCallerRoleExpression(node.expression, roleLocals)) {
      const direct = deniesDirectly(node.thenStatement) || deniesDirectly(node.elseStatement);
      const inverted = !direct && tailDenies(node);
      checks.push({
        file: rel,
        line: lineOf(node),
        condition: conditionText(node.expression, sourceFile),
        denies: direct || inverted,
        shape: inverted ? 'inverted' : 'if',
      });
    } else if (ts.isConditionalExpression(node) && isCallerRoleExpression(node.condition, roleLocals)) {
      checks.push({
        file: rel,
        line: lineOf(node),
        condition: conditionText(node.condition, sourceFile),
        denies: deniesDirectly(node.whenTrue) || deniesDirectly(node.whenFalse),
        shape: 'ternary',
      });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return checks;
}

/** Η ταυτότητα ενός φρουρού: **αρχείο + συνθήκη**, ποτέ γραμμή. */
function guardIdOf(check) {
  return `${check.file}::${check.condition}`;
}

module.exports = {
  ROLE_PROPERTY,
  IDENTITY_ROLE_PREDICATES,
  DENIAL_STATUS,
  isCallerRoleExpression,
  collectRoleLocals,
  deniesDirectly,
  containsDecision,
  exitsFlow,
  statementsAfter,
  tailDenies,
  scanRoleChecks,
  guardIdOf,
};
