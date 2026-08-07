#!/usr/bin/env node
/**
 * ADR-772 §9 — Διαβάζει **τον πίνακα** του λεξιλογίου διοικητικής ιεραρχίας.
 *
 * Η μοναδική είσοδος: `src/utils/address/administrative-hierarchy-vocabulary.ts`.
 * Από εκεί βγαίνουν **τρία** πράγματα, και **κανένα δεν ξαναγράφεται με το χέρι**:
 *
 *   1. τα **επίπεδα** (`ADMIN_LEVEL_VOCABULARY` κλειδιά) — δηλαδή ποιες ρίζες ονομάτων
 *      είναι διοικητικές· χειρόγραφη λίστα εδώ θα ήταν **δεύτερη αυθεντία** και θα
 *      απέκλινε σιωπηλά, ακριβώς όπως οι δύο λίστες namespace του CHECK 3.34.
 *   2. τα **δοχεία** (`interface VocabularyContainers`) — κλειδί → όνομα τύπου, ώστε ο
 *      σαρωτής να ξέρει *ποιους* τύπους να ανοίξει.
 *   3. οι **διεκδικήσεις**: ποια ονόματα πεδίων διεκδικεί κάθε γραμμή σε κάθε δοχείο.
 *
 * ⚠️ ΟΛΗ Η ΑΛΥΣΙΔΑ, ΟΧΙ ΤΟ ΠΡΩΤΟ ΟΝΟΜΑ. Το `companyAddress` του επιπέδου `region` είναι
 * `['regionName', 'region']`: το πρώτο είναι το κανονικό, το δεύτερο το αναγνωστικό
 * εναλλακτικό. Ένας σαρωτής που κοιτάζει μόνο το πρώτο θα έλεγε ότι το `region` του
 * `CompanyAddress` είναι αδιεκδίκητο — **μετρημένο ψευδώς θετικό**, όχι υποθετικό.
 *
 * ⚠️ ΚΑΙ ΟΙ ΤΡΕΙΣ ΠΙΝΑΚΕΣ. Το `ProjectAddress.neighborhood` το διεκδικεί το **επίπεδο
 * `community`** (ADR-772 §5), όχι η γραμμή `neighborhood` — που είναι εκεί σκόπιμα
 * `NOT_STORED`. Ένωση των τριών πινάκων ανά δοχείο· διαφορετικά η ίδια σύγκρουση που ο
 * §5 αφήνει **ανοιχτή κατ' απόφαση** θα εμφανιζόταν ως παράβαση.
 *
 * ⚠️ AST, ΟΧΙ REGEX — και **parse, όχι μεταγλώττιση** (`ts.createSourceFile`: χωρίς
 * program, χωρίς διαγνωστικά· δεν είναι `tsc`, βλ. CLAUDE.md N.17 και το ίδιο σκεπτικό
 * στο `scripts/lib/module-graph/parse-module.js`).
 *
 * @module scripts/lib/address-vocabulary/vocabulary-table
 * @see ADR-772 — το λεξιλόγιο της διοικητικής ιεραρχίας
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

/** Ο πίνακας. Είναι **η** αυθεντία· αν λείψει, η πύλη πέφτει κλειστά. */
const VOCABULARY_FILE = 'src/utils/address/administrative-hierarchy-vocabulary.ts';

const LEVEL_TABLE = 'ADMIN_LEVEL_VOCABULARY';
const CONTAINERS_INTERFACE = 'VocabularyContainers';
/** Οι πίνακες που συνεισφέρουν διεκδικήσεις — **όλοι**, βλ. σχόλιο αρχείου. */
const CLAIM_TABLES = [LEVEL_TABLE, 'POSTAL_FIELD_VOCABULARY', 'HIERARCHY_ADJACENT_VOCABULARY'];

const propName = (node) => {
  const n = node.name;
  if (!n) return null;
  return ts.isIdentifier(n) || ts.isStringLiteral(n) ? n.text : null;
};

/** Ξετύλιξε `X as const` → `X`. */
const unwrapAsConst = (e) => (e && ts.isAsExpression(e) ? e.expression : e);

/**
 * Τα ονόματα πεδίων που δηλώνει ένα **κελί**.
 *
 * Τρεις μορφές, καμία σιωπηλή: αλυσίδα (`['a','b']`) → **όλα** τα ονόματα · `NOT_STORED`
 * → ρητά κανένα · οτιδήποτε άλλο → `null`, που ο καλών μεταφράζει σε σφάλμα ανάγνωσης.
 * Το `null` **δεν** συγχέεται με το «κενή αλυσίδα»: το πρώτο σημαίνει «δεν κατάλαβα»,
 * το δεύτερο «δεν κρατιέται». Η διαφορά τους είναι όλο το ADR-772.
 */
function readSlot(node) {
  const expr = unwrapAsConst(node);
  if (!expr) return null;
  if (ts.isIdentifier(expr)) return expr.text === 'NOT_STORED' ? [] : null;
  if (!ts.isArrayLiteralExpression(expr)) return null;
  const names = [];
  for (const el of expr.elements) {
    if (!ts.isStringLiteral(el)) return null;
    names.push(el.text);
  }
  return names.length ? names : null;
}

/**
 * Ένα κελί ανά δοχείο: είτε σκέτο slot (ταχυδρομικά / γειτονικά), είτε αντικείμενο
 * `{ name, id }` (επίπεδα). Και οι δύο μορφές δίνουν **λίστα ονομάτων**.
 */
function readCell(valueNode) {
  const expr = unwrapAsConst(valueNode);
  if (expr && ts.isObjectLiteralExpression(expr)) {
    const names = [];
    for (const prop of expr.properties) {
      if (!ts.isPropertyAssignment(prop)) return null;
      const slot = readSlot(prop.initializer);
      if (slot === null) return null;
      names.push(...slot);
    }
    return names;
  }
  return readSlot(expr);
}

/** `export const X = { … }` → το object literal, ή `null`. */
function findConstObject(sourceFile, name) {
  let found = null;
  const visit = (node) => {
    if (found) return;
    if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)
        && node.name.text === name && node.initializer) {
      const init = unwrapAsConst(node.initializer);
      if (ts.isObjectLiteralExpression(init)) found = init;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return found;
}

/** `interface VocabularyContainers { form: AddressWithHierarchyValue; … }` */
function readContainers(sourceFile) {
  let decl = null;
  const visit = (node) => {
    if (!decl && ts.isInterfaceDeclaration(node) && node.name.text === CONTAINERS_INTERFACE) decl = node;
    else if (!decl) ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  if (!decl) return null;

  const containers = [];
  for (const member of decl.members) {
    if (!ts.isPropertySignature(member) || !member.type) continue;
    const key = propName(member);
    if (!key) continue;
    if (!ts.isTypeReferenceNode(member.type) || !ts.isIdentifier(member.type.typeName)) return null;
    containers.push({ key, typeName: member.type.typeName.text });
  }
  return containers.length ? containers : null;
}

/** `import type { A, B } from 'spec'` → Map<τοπικό όνομα, spec>. */
function readImportedTypeSources(sourceFile) {
  const map = new Map();
  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const bindings = stmt.importClause && stmt.importClause.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const el of bindings.elements) map.set(el.name.text, stmt.moduleSpecifier.text);
  }
  return map;
}

/**
 * Διάβασε τον πίνακα.
 *
 * **Fail-closed παντού**: κάθε αδυναμία ανάγνωσης είναι `throw`, ποτέ «άδειο αποτέλεσμα».
 * Ένας σαρωτής που επιστρέφει `0 διεκδικήσεις` επειδή δεν βρήκε τον πίνακα θα έβαφε
 * **κάθε** πεδίο ως αδήλωτο — ή, με την αντίστροφη λογική, τίποτα. Και οι δύο εκδοχές
 * είναι το «0 = κανείς δεν κοίταξε» που το CLAUDE.md τεκμηριώνει σε πέντε σημεία.
 *
 * @param {string} projectRoot
 * @returns {{file:string, levelRoots:string[], containers:{key:string,typeName:string,specifier:string|null}[],
 *            claims:Map<string,Set<string>>, rows:object[]}}
 */
function readVocabularyTable(projectRoot) {
  const abs = path.join(projectRoot, VOCABULARY_FILE);
  if (!fs.existsSync(abs)) {
    throw new Error(`δεν βρέθηκε ο πίνακας ${VOCABULARY_FILE} — fail-closed.`);
  }
  const sourceFile = ts.createSourceFile(
    VOCABULARY_FILE, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true,
  );

  const containerDecls = readContainers(sourceFile);
  if (!containerDecls) {
    throw new Error(`αδύνατη η ανάγνωση του \`${CONTAINERS_INTERFACE}\` στο ${VOCABULARY_FILE}.`);
  }
  const importedFrom = readImportedTypeSources(sourceFile);
  const containers = containerDecls.map((c) => ({
    ...c,
    // `null` = ο τύπος δηλώνεται ΜΕΣΑ στον ίδιο τον πίνακα (`FlatAddressFormFields`).
    specifier: importedFrom.get(c.typeName) || null,
  }));
  const containerKeys = new Set(containers.map((c) => c.key));

  const levelTable = findConstObject(sourceFile, LEVEL_TABLE);
  if (!levelTable) throw new Error(`δεν βρέθηκε το \`${LEVEL_TABLE}\` στο ${VOCABULARY_FILE}.`);
  const levelRoots = levelTable.properties
    .filter((p) => ts.isPropertyAssignment(p))
    .map(propName)
    .filter(Boolean);
  if (!levelRoots.length) throw new Error(`το \`${LEVEL_TABLE}\` δεν έδωσε κανένα επίπεδο.`);

  /** @type {Map<string, Set<string>>} */
  const claims = new Map(containers.map((c) => [c.key, new Set()]));
  const rows = [];

  for (const tableName of CLAIM_TABLES) {
    const table = findConstObject(sourceFile, tableName);
    if (!table) throw new Error(`δεν βρέθηκε ο πίνακας \`${tableName}\` στο ${VOCABULARY_FILE}.`);
    for (const rowProp of table.properties) {
      if (!ts.isPropertyAssignment(rowProp)) continue;
      const rowKey = propName(rowProp);
      const rowObj = unwrapAsConst(rowProp.initializer);
      if (!rowKey || !ts.isObjectLiteralExpression(rowObj)) {
        throw new Error(`\`${tableName}.${rowKey}\`: μη αναγνώσιμη γραμμή.`);
      }
      for (const cellProp of rowObj.properties) {
        if (!ts.isPropertyAssignment(cellProp)) continue;
        const containerKey = propName(cellProp);
        if (!containerKey || !containerKeys.has(containerKey)) {
          throw new Error(`\`${tableName}.${rowKey}.${containerKey}\`: άγνωστο δοχείο.`);
        }
        const names = readCell(cellProp.initializer);
        if (names === null) {
          throw new Error(`\`${tableName}.${rowKey}.${containerKey}\`: μη αναγνώσιμο κελί.`);
        }
        for (const n of names) claims.get(containerKey).add(n);
        rows.push({ table: tableName, row: rowKey, container: containerKey, names });
      }
    }
  }

  return { file: VOCABULARY_FILE, levelRoots, containers, claims, rows };
}

module.exports = {
  VOCABULARY_FILE,
  LEVEL_TABLE,
  CONTAINERS_INTERFACE,
  CLAIM_TABLES,
  readVocabularyTable,
  readSlot,
  readCell,
  readContainers,
  readImportedTypeSources,
  findConstObject,
};
