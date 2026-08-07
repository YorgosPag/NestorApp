#!/usr/bin/env node
/**
 * **Ποιες υποσχέσεις αντίθεσης δίνει ο κώδικας, και ποιος μπορεί να μάθει αν αθετήθηκαν**
 * (ADR-771 Φ.3 / CHECK 3.45).
 *
 * ## 🔑 Η πύλη μαθαίνει το API ΑΠΟ ΤΟ API
 * Δεν υπάρχει πίνακας «ονόματα συναρτήσεων → θέση ορίσματος». Θα ήταν **δεύτερη αυθεντία**:
 * μια έβδομη προσαρμοστική συνάρτηση θα προσγειωνόταν αόρατη, ακριβώς όπως τα έξι namespace
 * χωρίς `case` του CHECK 3.36. Αντ' αυτού διαβάζεται το AST του ίδιου του
 * `adaptive-entity-color.ts`: **κάθε** εξαγόμενη συνάρτηση με παράμετρο που λέγεται
 * «…contrast…» **είναι** υπόσχεση, και ο τύπος επιστροφής της λέει αν ο καλών **μπορεί** να
 * μάθει το αποτέλεσμα.
 *
 * ## ⚠️ ΤΙ ΑΠΟΔΕΙΚΝΥΕΙ ΚΑΙ ΤΙ ΟΧΙ — δηλωμένο όριο
 * Η πύλη αποδεικνύει ότι η αποτυχία είναι **λέξιμη και ειπωμένη**: ένα ανέφικτο κατώφλι
 * *πρέπει* να ζητηθεί μέσα από την υπογραφή που επιστρέφει `InkVerdict`, και η ετυμηγορία
 * *δεν* επιτρέπεται να πεταχτεί επιτόπου (`.ink`). **Δεν** αποδεικνύει ότι ο καλών ζωγραφίζει
 * τη διάσωση — αυτό είναι δουλειά της άγκυρας (`wall-contrast-casing.test.ts`, που καταγράφει
 * τα πραγματικά περάσματα σχεδίασης). Πύλη **και** άγκυρα, όχι η μία στη θέση της άλλης.
 *
 * @see ./presentable-surfaces.js — η άλλη μισή ερώτηση: πάνω σε τι μετριέται η υπόσχεση
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const { readTsPathAliases, resolveSpecifier, toPosix } = require('../module-graph/resolve-specifier');
const { initializerOf, namedImports, parseSource } = require('./ts-read');

/** Το σπίτι του προσαρμοστικού μελανιού — και η **μόνη** θέση όπου το API ορίζεται. */
const ADAPTIVE_MODULE = 'src/subapps/dxf-viewer/config/adaptive-entity-color.ts';

/** Ο τύπος επιστροφής που σημαίνει «ο καλών μπορεί να μάθει αν πέτυχα». */
const VERDICT_TYPE = 'InkVerdict';

/** Ο υποφάκελος που κρίνεται. Το προσαρμοστικό μελάνι είναι render-time, 2D-canvas-specific. */
const SCAN_ROOT = 'src/subapps/dxf-viewer';

const isTestFile = (rel) => /(^|\/)__tests__\//.test(rel) || /\.(test|spec)\.tsx?$/.test(rel);

/** Το δεξιότερο όνομα μιας κλήσης: `f(...)` και `mod.f(...)` δίνουν και τα δύο `f`. */
function calleeName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return null;
}

/** Αριθμητικό literal → τιμή· οτιδήποτε άλλο → `null` (ποτέ μαντεψιά). */
function numericValue(node) {
  if (node !== null && ts.isNumericLiteral(node)) return Number(node.text);
  return null;
}

/** Το module specifier από το οποίο εισάγεται το `name`, ή `null`. */
function importSourceOf(sourceFile, name) {
  for (const imported of namedImports(sourceFile)) {
    if (imported.local === name) return imported.moduleSpecifier;
  }
  return null;
}

/**
 * Ένα **αναγνωστήριο** αρχείων με μνήμη: το ίδιο `wall-render-palette.ts` το ρωτούν και τα
 * τρία σημεία του `WallRenderer`. Κρατά και τη λύση ειδικευτών (ADR-700 SSoT).
 *
 * ⚠️ Το `fileSet` είναι **duck-typed**: το `probe` καλεί μόνο `.has(path)`, οπότε ένα
 * `existsSync` κοστίζει λίγες δεκάδες syscalls αντί για πλήρη σάρωση 12.000 αρχείων. Η
 * επίλυση παραμένει η **ίδια** συνάρτηση που χρησιμοποιεί το CHECK 3.30 — μηδέν δεύτερη μηχανή.
 */
function createReader(repoRoot) {
  const cache = new Map();
  const textCache = new Map();
  const aliases = readTsPathAliases(repoRoot);
  const fileSet = { has: (p) => fs.existsSync(p) };
  const readText = (absFile) => {
    const key = toPosix(absFile);
    if (!textCache.has(key)) {
      textCache.set(key, fs.existsSync(key) ? fs.readFileSync(key, 'utf8') : null);
    }
    return textCache.get(key);
  };
  return {
    /** Φθηνή απόρριψη πριν από το AST — σωστή επειδή το όνομα του API είναι ΠΑΝΤΑ στο κείμενο. */
    mayContain(absFile, api) {
      const text = readText(absFile);
      return text !== null && mayContainPromise(text, api);
    },
    parse(absFile) {
      const key = toPosix(absFile);
      if (!cache.has(key)) cache.set(key, fs.existsSync(key) ? parseSource(key) : null);
      return cache.get(key);
    },
    resolve(spec, fromFile) {
      return resolveSpecifier(spec, toPosix(fromFile), { projectRoot: repoRoot, aliases, fileSet });
    },
  };
}

/**
 * Λύνει ένα κατώφλι σε αριθμό: literal, τοπική σταθερά, ή **εισαγόμενη** σταθερά (ένα άλμα
 * module). `null` ⇒ ανεπίλυτο, και η πύλη το θεωρεί **παραβίαση** (fail-closed): μια υπόσχεση
 * που δεν διαβάζεται δεν είναι υπόσχεση που τηρείται.
 */
function resolveThreshold(node, sourceFile, absFile, reader) {
  const direct = numericValue(node);
  if (direct !== null) return direct;
  if (node === null || !ts.isIdentifier(node)) return null;

  const local = numericValue(initializerOf(sourceFile, node.text));
  if (local !== null) return local;

  const spec = importSourceOf(sourceFile, node.text);
  if (spec === null) return null;
  const target = reader.resolve(spec, absFile);
  if (target.kind !== 'internal') return null;
  const targetAst = reader.parse(target.file);
  return targetAst === null ? null : numericValue(initializerOf(targetAst, node.text));
}

/**
 * Το **συμβόλαιο** του προσαρμοστικού API, διαβασμένο από το ίδιο το API.
 *
 * Ρίχνει σφάλμα σε άδειο αποτέλεσμα — **fail-closed**: αν αύριο μετονομαστεί η παράμετρος, η
 * πύλη πρέπει να **σκάσει**, όχι να ανακοινώσει «καμία υπόσχεση, όλα καθαρά».
 */
function readAdaptiveApi(repoRoot, reader) {
  const abs = path.join(repoRoot, ADAPTIVE_MODULE);
  const sourceFile = reader.parse(abs);
  if (sourceFile === null) throw new Error(`Δεν βρέθηκε το ${ADAPTIVE_MODULE}`);

  const api = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isFunctionDeclaration(statement) || statement.name === undefined) continue;
    const exported = (statement.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;
    const index = statement.parameters.findIndex(
      (p) => ts.isIdentifier(p.name) && /contrast/i.test(p.name.text),
    );
    if (index < 0) continue;
    const param = statement.parameters[index];
    api.set(statement.name.text, {
      name: statement.name.text,
      paramIndex: index,
      defaultThreshold: resolveThreshold(param.initializer ?? null, sourceFile, abs, reader),
      hasDefault: param.initializer !== undefined,
      returnsVerdict: statement.type !== undefined && statement.type.getText(sourceFile) === VERDICT_TYPE,
    });
  }
  if (api.size === 0) {
    throw new Error(`Καμία προσαρμοστική συνάρτηση με παράμετρο «contrast» στο ${ADAPTIVE_MODULE}`);
  }
  return api;
}

/** `true` όταν η ετυμηγορία πετιέται επιτόπου (`…(…).ink`) — ισοδύναμο με το χρωματικό API. */
function verdictDiscardedAt(call) {
  const parent = call.parent;
  return parent !== undefined
    && ts.isPropertyAccessExpression(parent)
    && parent.expression === call
    && parent.name.text === 'ink';
}

/**
 * 🔴 **Τα ΤΟΠΙΚΑ ονόματα του API μέσα σε ένα αρχείο** — γιατί το `import { f as g }` υπάρχει.
 *
 * Χωρίς αυτό, ένα `import { adaptColorForSurface as adapt }` θα έδινε κλήση `adapt(…)` που
 * **δεν** είναι στο API ⇒ **σιωπηλή απουσία**, δηλαδή η υπόσχεση δεν θα μετριόταν καθόλου και
 * η πύλη θα ανακοίνωνε «καθαρό». Είναι επίσης ο λόγος που το **προφίλτρο κειμένου είναι
 * ασφαλές**: είτε το όνομα εισάγεται (άρα υπάρχει στο κείμενο), είτε το αρχείο **είναι** το
 * module ορισμού (άρα υπάρχει κι εκεί).
 */
function localApiNames(sourceFile, api) {
  const local = new Map(api);
  for (const imported of namedImports(sourceFile)) {
    const entry = api.get(imported.original);
    if (entry !== undefined) local.set(imported.local, entry);
  }
  return local;
}

/** `true` αν το αρχείο μπορεί καν να περιέχει κλήση — φθηνό προφίλτρο πριν από το AST. */
function mayContainPromise(text, api) {
  for (const name of api.keys()) if (text.includes(name)) return true;
  return false;
}

/** Κάθε κλήση προσαρμοστικής συνάρτησης σε ένα αρχείο, με το κατώφλι της λυμένο. */
function sitesInFile(absFile, relFile, api, reader) {
  if (!reader.mayContain(absFile, api)) return [];
  const sourceFile = reader.parse(absFile);
  if (sourceFile === null) return [];
  const names = localApiNames(sourceFile, api);
  const out = [];
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const fn = names.get(calleeName(node.expression));
      if (fn !== undefined) {
        const arg = node.arguments[fn.paramIndex] ?? null;
        const threshold = arg === null
          ? (fn.hasDefault ? fn.defaultThreshold : null)
          : resolveThreshold(arg, sourceFile, absFile, reader);
        out.push({
          file: relFile,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
          fn: fn.name,
          threshold,
          fromDefault: arg === null,
          verdictAware: fn.returnsVerdict && !verdictDiscardedAt(node),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return out;
}

module.exports = {
  ADAPTIVE_MODULE,
  SCAN_ROOT,
  VERDICT_TYPE,
  createReader,
  isTestFile,
  localApiNames,
  mayContainPromise,
  readAdaptiveApi,
  resolveThreshold,
  sitesInFile,
  verdictDiscardedAt,
};
