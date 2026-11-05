/**
 * CHECK 3.114 Κ5 + Κ6 — **λένε ο server και οι κανόνες το ΙΔΙΟ για το «ποιος αγγίζει αυτή την ευκαιρία»;** (ADR-930
 * §«Εξουσία κατόχου»).
 *
 * Ο κριτής του server (`src/services/crm/opportunity-access.ts`) και το `match /opportunities` του `firestore.rules`
 * είναι ΔΥΟ εκφράσεις του ίδιου πίνακα — ο ένας κρίνει το Admin SDK, ο άλλος τον browser. Αν αποκλίνουν, η οθόνη
 * δείχνει κάρτα που σέρνεται αλλά η φόρμα (client SDK) απορρίπτεται, ή το αντίστροφο.
 *
 *   Κ5 — ο ανατεθειμένος: ΝΑΙ στο `update` (`crmIsAssignee`), ΟΧΙ στο `delete` — καθρέφτης των `intent: edit | delete`.
 *   Κ6 — ο «διαχειριστής»: οι ρόλοι του `role-catalogue.ts` που δίνουν την ικανότητα του κριτή
 *        (`OPPORTUNITY_MANAGE_PERMISSION`) == ο ρόλος που ονομάζει το `isCompanyAdminOfCompany` των κανόνων.
 *        Δοθεί αύριο η ικανότητα στον `sales_agent` ⇒ ο server τον αφήνει σε ΟΛΕΣ, οι κανόνες όχι ⇒ ΚΟΚΚΙΝΟ.
 *
 * ⚠️ ΤΙ ΔΕΝ ΒΛΕΠΕΙ: ικανότητα δοσμένη ως **ρητό claim** σε έναν άνθρωπο (ADR-801 §2.8) — οι κανόνες δεν διαβάζουν
 *    claims ικανοτήτων. Ο server θα τον άφηνε, ο browser όχι: ασφαλής κατεύθυνση (στενότερο), όχι διαρροή.
 */

'use strict';

const ast = require('./ast');

const { ts } = ast;

const RULES_FILE = 'firestore.rules';
const ROLE_CATALOGUE = 'src/lib/auth/role-catalogue.ts';
const ACCESS_JUDGE = 'src/services/crm/opportunity-access.ts';

const stripComments = (text) => text.replace(/\/\/.*$/gm, '');

/** Το σώμα του `match /opportunities/{…}` χωρίς σχόλια — ή `null`. Το ΕΝΑ σημείο που το βρίσκει (Κ2 · Κ5). */
function opportunitiesRulesBlock(text) {
  const block = /match \/opportunities\/\{[^}]+\}\s*\{([\s\S]*?)\n    \}/.exec(text);
  return block ? stripComments(block[1]) : null;
}

/** Η έκφραση του `allow <op>:` μέσα στο μπλοκ (ως το επόμενο `allow`). */
function allowExpression(block, op) {
  const match = new RegExp(`allow ${op}\\s*:([\\s\\S]*?)(?=\\ballow\\s|$)`).exec(block);
  return match ? match[1] : null;
}

function assigneeFindings(input, STATES) {
  const block = input.exists(RULES_FILE) ? opportunitiesRulesBlock(input.read(RULES_FILE)) : null;
  const update = block && allowExpression(block, 'update');
  const remove = block && allowExpression(block, 'delete');
  if (!update || !remove) {
    return [{ state: STATES.SOURCE_DRIFT, file: RULES_FILE, detail: 'δεν βρέθηκαν τα `allow update` / `allow delete` των ευκαιριών' }];
  }
  const findings = [];
  const outside = (detail) => findings.push({ state: STATES.OUTSIDE, file: RULES_FILE, detail });
  if (!/crmIsAssignee\(resource\.data\)/.test(update)) outside('το `update` δεν αφήνει τον ανατεθειμένο — ο server (`intent: edit`) τον αφήνει');
  if (/crmIsAssignee\(/.test(remove)) outside('το `delete` αφήνει τον ανατεθειμένο — ο server (`intent: delete`) ΟΧΙ');
  for (const [op, expression] of [['update', update], ['delete', remove]]) {
    if (!/crmWriterIsPrivileged\(resource\.data\)/.test(expression)) outside(`το \`${op}\` δεν περνά από το \`crmWriterIsPrivileged\` (διαχειριστής · δημιουργός)`);
  }
  return findings;
}

/** Η ικανότητα του κριτή, από το ίδιο το αρχείο του — ποτέ δεύτερο αντίγραφο εδώ. */
function judgePermission(text) {
  const match = /OPPORTUNITY_MANAGE_PERMISSION\s*:\s*PermissionId\s*=\s*'([^']+)'/.exec(text);
  return match ? match[1] : null;
}

/** Οι ρόλοι του `PREDEFINED_ROLES` (AST) που δίνουν την ικανότητα. Σχόλιο που την ονομάζει δεν μετρά. */
function catalogueRolesGranting(text, permission) {
  const sf = ast.sourceFileOf(ROLE_CATALOGUE, text);
  const roles = [];
  const grants = (role) => role.properties.some((prop) => ts.isPropertyAssignment(prop)
    && prop.name.getText(sf) === 'permissions'
    && ts.isArrayLiteralExpression(prop.initializer)
    && prop.initializer.elements.some((el) => ts.isStringLiteral(el) && el.text === permission));
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(sf) === 'PREDEFINED_ROLES'
      && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      for (const role of node.initializer.properties) {
        if (ts.isPropertyAssignment(role) && ts.isObjectLiteralExpression(role.initializer) && grants(role.initializer)) {
          roles.push(role.name.getText(sf).replace(/['"]/g, ''));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return roles.sort();
}

/** Οι ρόλοι που ονομάζει το `isCompanyAdminOfCompany` — ο «διαχειριστής» του `crmIsCompanyAdmin`. */
function rulesAdminRoles(text) {
  const body = /function isCompanyAdminOfCompany\([^)]*\)\s*\{([\s\S]*?)\n    \}/.exec(stripComments(text));
  return body ? [...body[1].matchAll(/getGlobalRole\(\)\s*==\s*'([^']+)'/g)].map((m) => m[1]).sort() : [];
}

function roleParityFindings(input, STATES) {
  const permission = input.exists(ACCESS_JUDGE) ? judgePermission(input.read(ACCESS_JUDGE)) : null;
  const catalogue = permission && input.exists(ROLE_CATALOGUE) ? catalogueRolesGranting(input.read(ROLE_CATALOGUE), permission) : [];
  const rules = input.exists(RULES_FILE) ? rulesAdminRoles(input.read(RULES_FILE)) : [];
  if (!permission || catalogue.length === 0 || rules.length === 0) {
    const file = !permission ? ACCESS_JUDGE : catalogue.length === 0 ? ROLE_CATALOGUE : RULES_FILE;
    return [{ state: STATES.SOURCE_DRIFT, file, detail: 'δεν βρέθηκε η ικανότητα του κριτή / οι ρόλοι της / ο ρόλος των κανόνων — η πύλη δεν κρίνει στα τυφλά' }];
  }
  return catalogue.join() === rules.join() ? [] : [{
    state: STATES.OUTSIDE,
    file: ROLE_CATALOGUE,
    detail: `την ικανότητα \`${permission}\` (όλες οι ευκαιρίες) τη δίνουν [${catalogue.join(', ')}] — οι κανόνες αφήνουν μόνο [${rules.join(', ')}]`,
  }];
}

function ownerParityFindings(input, STATES) {
  return [...assigneeFindings(input, STATES), ...roleParityFindings(input, STATES)];
}

module.exports = { ownerParityFindings, opportunitiesRulesBlock, RULES_FILE, ROLE_CATALOGUE, ACCESS_JUDGE };
