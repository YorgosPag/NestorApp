#!/usr/bin/env node
/**
 * **Πρωτογενείς αναγνώσεις AST** για την πύλη CHECK 3.45 — τίποτα που να ξέρει από αντίθεση.
 *
 * Εξήχθη επειδή το **CHECK 3.28 (jscpd, N.18) έπιασε δύο κλώνους μέσα στο ίδιο commit**:
 * η «αρχικοποίηση ενός `const NAME = …`» ήταν γραμμένη **δύο φορές με δύο ονόματα**
 * (`initializerOf` / `declarationInitializer`), και το προοίμιο διάσχισης των ονομαστικών
 * εισαγωγών **άλλες δύο**. Ακριβώς το sibling clone που ο έλεγχος πιάνει *ανεξάρτητα
 * ονόματος* — και που αργότερα θα απέκλινε σιωπηλά.
 *
 * ⚠️ Ο διαχωρισμός δεν είναι αισθητικός: εδώ ζουν οι **αναγνώσεις**, στα άλλα δύο modules οι
 * **ερωτήσεις** (ποιες επιφάνειες · ποιες υποσχέσεις). Ένα module που απαντούσε και τα δύο θα
 * ήταν module χωρίς ερώτηση.
 */

'use strict';

const fs = require('node:fs');
const ts = require('typescript');

/**
 * Το AST ενός αρχείου πηγής — **parse-only**, ποτέ `tsc` (N.17): καμία επίλυση τύπων, καμία
 * ανάγνωση `tsconfig`, μηδέν πρόγραμμα. Μερικά ms ανά αρχείο.
 */
function parseSource(absFile) {
  return ts.createSourceFile(
    absFile, fs.readFileSync(absFile, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS,
  );
}

/**
 * Η αρχικοποίηση ενός `const NAME = …` οπουδήποτε μέσα στο αρχείο, ή `null`.
 *
 * Ψάχνει σε **όλο** το δέντρο και όχι μόνο στα top-level statements: το `export const` είναι
 * `VariableStatement → VariableDeclarationList → VariableDeclaration`, και μια σταθερά μπορεί
 * κάλλιστα να ζει μέσα σε μπλοκ.
 */
function initializerOf(sourceFile, name) {
  let found = null;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      found = node.initializer ?? null;
    }
    if (found === null) ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return found;
}

/**
 * Κάθε **ονομαστική** εισαγωγή του αρχείου, με το τοπικό ΚΑΙ το αρχικό όνομα χωριστά —
 * το `import { f as g }` είναι ο λόγος που τα δύο δεν ταυτίζονται, και ο λόγος που ένας
 * σαρωτής που κοιτά μόνο το ένα βγάζει **σιωπηλή απουσία**.
 */
function* namedImports(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause === undefined) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause.namedBindings;
    if (bindings === undefined || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      yield {
        local: element.name.text,
        original: (element.propertyName ?? element.name).text,
        moduleSpecifier: statement.moduleSpecifier.text,
      };
    }
  }
}

/**
 * Κάθε `export const NAME = '…'` του αρχείου, ως `{ name, value }`.
 *
 * Υπάρχει για να μπορεί ένας καταναλωτής να **ανακαλύψει** σταθερές αντί να τις απαριθμήσει.
 * Το {@link initializerOf} απαντά «δώσε μου **αυτό** το όνομα», δηλαδή απαιτεί να ξέρεις εκ
 * των προτέρων τι υπάρχει — και αυτό ακριβώς είναι η χειρόγραφη λίστα που αποκλίνει σιωπηλά
 * (σχήμα CHECK 3.34 / 3.37). Εδώ η ερώτηση αντιστρέφεται: «τι **υπάρχει**;».
 *
 * ⚠️ Μόνο **εξαγόμενες** και μόνο **κυριολεκτικές συμβολοσειρές**: μια μη εξαγόμενη σταθερά
 * δεν είναι συμβόλαιο, και μια υπολογισμένη τιμή δεν διαβάζεται χωρίς `tsc` (N.17).
 */
function* exportedStringConstants(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const exported = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (exported !== true) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      const init = declaration.initializer;
      if (init === undefined || !ts.isStringLiteral(init)) continue;
      yield { name: declaration.name.text, value: init.text };
    }
  }
}

module.exports = { exportedStringConstants, initializerOf, namedImports, parseSource };
