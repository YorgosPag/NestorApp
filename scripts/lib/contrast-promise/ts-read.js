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
 * Το `export { original as name } from '…'` που επανεξάγει το `name`, ή `null`.
 *
 * Χωρίς αυτό, μια σταθερά που φτάνει στον καλούντα **μέσα από barrel/επανεξαγωγή** δεν έχει
 * αρχικοποίηση στο αρχείο από το οποίο εισάγεται ⇒ «ανεπίλυτη», ενώ η τιμή της είναι γραμμένη.
 */
function reExportOf(sourceFile, name) {
  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement) || statement.moduleSpecifier === undefined) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const clause = statement.exportClause;
    if (clause === undefined || !ts.isNamedExports(clause)) continue;
    for (const element of clause.elements) {
      if (element.name.text !== name) continue;
      return {
        original: (element.propertyName ?? element.name).text,
        moduleSpecifier: statement.moduleSpecifier.text,
      };
    }
  }
  return null;
}

/**
 * Κάθε `export const NAME = …` του αρχείου, ως `{ name, initializer }`.
 *
 * Υπάρχει για να μπορεί ένας καταναλωτής να **ανακαλύψει** σταθερές αντί να τις απαριθμήσει.
 * Το {@link initializerOf} απαντά «δώσε μου **αυτό** το όνομα», δηλαδή απαιτεί να ξέρεις εκ
 * των προτέρων τι υπάρχει — και αυτό ακριβώς είναι η χειρόγραφη λίστα που αποκλίνει σιωπηλά
 * (σχήμα CHECK 3.34 / 3.37). Εδώ η ερώτηση αντιστρέφεται: «τι **υπάρχει**;».
 *
 * ⚠️ Μόνο **εξαγόμενες**: μια μη εξαγόμενη σταθερά δεν είναι συμβόλαιο.
 *
 * 🔴 **Επιστρέφει τον κόμβο, ΟΧΙ την τιμή** (ADR-909 Β2.5). Η προηγούμενη εκδοχή έδινε μόνο
 * κυριολεκτικές συμβολοσειρές και **πετούσε σιωπηλά** κάθε άλλη αρχικοποίηση — οπότε τη μέρα που
 * το `TABLE_PAPER_HEX = '#ffffff'` έγινε `= PRINT_PAPER_HEX`, η σταθερά **εξαφανίστηκε** από την
 * ανακάλυψη αντί να αποτύχει. Το «δεν διαβάζεται» είναι απόφαση του **καταναλωτή** (που ξέρει
 * αν οφείλει να σκάσει), όχι φίλτρο εδώ.
 */
function* exportedConstants(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const exported = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (exported !== true) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      yield { name: declaration.name.text, initializer: declaration.initializer ?? null };
    }
  }
}

module.exports = { exportedConstants, initializerOf, namedImports, parseSource, reExportOf };
