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
const { initializerOf, namedImports, parseSource, reExportOf } = require('./ts-read');

/** Το σπίτι του προσαρμοστικού μελανιού — και η **μόνη** θέση όπου το API ορίζεται. */
const ADAPTIVE_MODULE = 'src/subapps/dxf-viewer/config/adaptive-entity-color.ts';

/**
 * Το δεύτερο αρχείο ορισμού (ADR-909 Γ2.1): ο πυρήνας προσαρμογής (`adaptColorToBackground`,
 * `adaptColorForSurface`) βγήκε από το `adaptive-entity-color.ts`. Όσο η πύλη διάβαζε **μόνο**
 * το πρώτο, οι συναρτήσεις που μετακόμισαν έπαψαν να είναι API ⇒ οι κλήσεις τους δεν μετριούνταν
 * καθόλου και το ζωντανό δέντρο έβγαινε πράσινο.
 */
const CONTRAST_ADAPTATION_MODULE = 'src/subapps/dxf-viewer/config/contrast-adaptation.ts';

/**
 * **Όλα** τα αρχεία όπου ορίζεται το API. Το πρώτο είναι υποχρεωτικό· τα υπόλοιπα διαβάζονται
 * όταν υπάρχουν (ο ιστορικός κώδικας των Π-tests προηγείται του διαχωρισμού).
 */
const ADAPTIVE_MODULES = [ADAPTIVE_MODULE, CONTRAST_ADAPTATION_MODULE];

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

/** Η ονομαστική εισαγωγή που δένει το τοπικό `name` (`{ original, moduleSpecifier }`), ή `null`. */
function importOf(sourceFile, name) {
  for (const imported of namedImports(sourceFile)) {
    if (imported.local === name) return imported;
  }
  return null;
}

/** Πόσες επανεξαγωγές ακολουθούνται — φραγμένο, ώστε ένας κύκλος να μην κρεμάσει την πύλη. */
const MAX_REEXPORT_HOPS = 3;

/**
 * Η αριθμητική τιμή της εξαγόμενης σταθεράς `name` του `absFile`, ακολουθώντας
 * `export { … } from` (ADR-909 Γ2.1: το `MIN_ENTITY_CONTRAST` ζει στο `contrast-adaptation.ts`
 * και **επανεξάγεται** από το `adaptive-entity-color.ts`). `null` ⇒ ανεπίλυτο (fail-closed).
 */
function exportedNumber(absFile, name, reader, hops = MAX_REEXPORT_HOPS) {
  const ast = reader.parse(absFile);
  if (ast === null) return null;
  const local = numericValue(initializerOf(ast, name));
  if (local !== null || hops === 0) return local;
  const reExport = reExportOf(ast, name);
  if (reExport === null) return null;
  const target = reader.resolve(reExport.moduleSpecifier, absFile);
  if (target.kind !== 'internal') return null;
  return exportedNumber(target.file, reExport.original, reader, hops - 1);
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
 * εισαγωγής, συν τις επανεξαγωγές του στόχου). `null` ⇒ ανεπίλυτο, και η πύλη το θεωρεί **παραβίαση** (fail-closed): μια υπόσχεση
 * που δεν διαβάζεται δεν είναι υπόσχεση που τηρείται.
 */
function resolveThreshold(node, sourceFile, absFile, reader, hops = MAX_REEXPORT_HOPS) {
  const direct = numericValue(node);
  if (direct !== null) return direct;
  if (node === null || !ts.isIdentifier(node)) return null;

  const initializer = initializerOf(sourceFile, node.text);
  const local = numericValue(initializer);
  if (local !== null) return local;
  // `const A = B` — ψευδώνυμο σταθεράς (`PUBLIC_FLOORPLAN_MIN_INK_CONTRAST = MIN_ENTITY_CONTRAST`).
  if (initializer !== null && ts.isIdentifier(initializer) && hops > 0) {
    return resolveThreshold(initializer, sourceFile, absFile, reader, hops - 1);
  }

  const imported = importOf(sourceFile, node.text);
  if (imported === null) return null;
  const target = reader.resolve(imported.moduleSpecifier, absFile);
  if (target.kind !== 'internal') return null;
  return exportedNumber(target.file, imported.original, reader);
}

/**
 * Το **συμβόλαιο** του προσαρμοστικού API, διαβασμένο από το ίδιο το API.
 *
 * Ρίχνει σφάλμα σε άδειο αποτέλεσμα — **fail-closed**: αν αύριο μετονομαστεί η παράμετρος, η
 * πύλη πρέπει να **σκάσει**, όχι να ανακοινώσει «καμία υπόσχεση, όλα καθαρά».
 */
function readAdaptiveApi(repoRoot, reader) {
  const api = new Map();
  for (const rel of ADAPTIVE_MODULES) {
    const abs = path.join(repoRoot, rel);
    const sourceFile = reader.parse(abs);
    if (sourceFile === null) {
      if (rel === ADAPTIVE_MODULE) throw new Error(`Δεν βρέθηκε το ${ADAPTIVE_MODULE}`);
      continue;
    }
    collectAdaptiveApi(api, sourceFile, abs, reader);
  }
  if (api.size === 0) {
    throw new Error(`Καμία προσαρμοστική συνάρτηση με παράμετρο «contrast» στο ${ADAPTIVE_MODULE}`);
  }
  return api;
}

/** Οι υποσχέσεις **ενός** αρχείου ορισμού, προστιθέμενες στο κοινό συμβόλαιο. */
function collectAdaptiveApi(api, sourceFile, abs, reader) {
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
        // `f(…, policy.minInkContrast)`: ο αριθμός δεν γράφεται εδώ — δες {@link fieldWritesInFile}.
        const forwarded = threshold === null && arg !== null && ts.isPropertyAccessExpression(arg);
        out.push({
          file: relFile,
          line: lineOf(sourceFile, node),
          fn: fn.name,
          threshold,
          fromDefault: arg === null,
          verdictAware: fn.returnsVerdict && !verdictDiscardedAt(node),
          ...(forwarded ? { forwardedField: arg.name.text } : {}),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return out;
}

const lineOf = (sourceFile, node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

/** Το όνομα ενός κλειδιού ιδιότητας (`a` ή `'a'`)· υπολογιζόμενο κλειδί ⇒ `null`. */
function propertyKeyText(name) {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null;
}

/**
 * Αν ο κόμβος **γράφει** σε ιδιότητα — `{ a: v }`, `{ a }`, `a = v` σε κλάση, `x.a = v` —
 * επιστρέφει `{ field, value }`· αλλιώς `null`. Δηλώσεις **τύπου** (`a?: number`) δεν είναι εγγραφές.
 */
function propertyWrite(node) {
  if (ts.isPropertyAssignment(node)) return { field: propertyKeyText(node.name), value: node.initializer };
  if (ts.isShorthandPropertyAssignment(node)) return { field: node.name.text, value: node.name };
  if (ts.isPropertyDeclaration(node) && node.initializer !== undefined) {
    return { field: propertyKeyText(node.name), value: node.initializer };
  }
  const assigns = ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken;
  if (assigns && ts.isPropertyAccessExpression(node.left)) return { field: node.left.name.text, value: node.right };
  return null;
}

/**
 * 🔴 **Η υπόσχεση μετριέται ΕΚΕΙ ΠΟΥ ΓΡΑΦΕΤΑΙ Ο ΑΡΙΘΜΟΣ** (ADR-909 Γ2.1).
 *
 * Το `applyPlotColor` καλεί `adaptColorForSurface(…, policy.minInkContrast)`: το κατώφλι είναι
 * **πεδίο**, και τον αριθμό τον δηλώνει άλλος (`minInkContrast: PUBLIC_FLOORPLAN_MIN_INK_CONTRAST`).
 * Η κλήση είναι *προωθητής*· υπόσχεση δίνει **κάθε εγγραφή** στο πεδίο, και αυτές επιστρέφονται εδώ.
 *
 * - τιμή που λύνεται σε αριθμό ⇒ υπόσχεση με κατώφλι, κρίνεται όπως κάθε άλλη·
 * - **ομώνυμη** αναμετάδοση (`{ a: input.a }`, `{ a }` από παράμετρο) ⇒ `relay` — ο αριθμός είναι πιο πίσω·
 * - οτιδήποτε άλλο ⇒ `threshold: null`, δηλαδή **παραβίαση** (fail-closed): αλυσίδα που αλλάζει όνομα
 *   στη μέση δεν ακολουθείται, και δεν μαντεύεται.
 *
 * ⚠️ Η αντιστοίχιση είναι **κατά όνομα πεδίου**, όχι κατά τύπο (parse-only, N.17). Ένα γενικόλογο όνομα
 * (`contrast`) θα έπιανε ξένες εγγραφές — προς την **αυστηρή** πλευρά, ποτέ προς τη σιωπηλή.
 */
function fieldWritesInFile(absFile, relFile, fields, reader) {
  // Το προφίλτρο κειμένου δέχεται κάθε συλλογή με `.keys()` — εδώ τα ονόματα πεδίων, όχι το API.
  if (!reader.mayContain(absFile, fields)) return [];
  const sourceFile = reader.parse(absFile);
  if (sourceFile === null) return [];
  const out = [];
  const visit = (node) => {
    const write = propertyWrite(node);
    if (write !== null && fields.has(write.field)) {
      const threshold = resolveThreshold(write.value, sourceFile, absFile, reader);
      out.push({
        file: relFile,
        line: lineOf(sourceFile, node),
        fn: write.field,
        declares: write.field,
        threshold,
        fromDefault: false,
        verdictAware: false,
        ...(threshold === null && calleeName(write.value) === write.field ? { relay: true } : {}),
      });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return out;
}

/** Κλήση/εγγραφή **προϊόντος**: ούτε το ίδιο το API, ούτε test — μόνο αυτές δεσμεύουν. */
const isProductSite = (site) => !ADAPTIVE_MODULES.includes(site.file) && !isTestFile(site.file);

/**
 * **Όλες** οι υποσχέσεις ενός συνόλου αρχείων (`[{ abs, rel }]`): οι κλήσεις του API **και** οι
 * εγγραφές στα πεδία που οι κλήσεις προωθούν. Ο ΕΝΑΣ δρόμος — τον περπατούν η πύλη και τα tests της.
 *
 * `anchored` = τα προωθημένα πεδία που **έχουν** δηλούντα με αριθμό. Προωθητής χωρίς άγκυρα είναι
 * κατώφλι που κανείς δεν μέτρησε ⇒ η πύλη τον μπλοκάρει (fail-closed).
 */
function promiseSites(entries, api, reader) {
  const calls = entries.flatMap((e) => sitesInFile(e.abs, e.rel, api, reader));
  const fields = new Set(
    calls.filter(isProductSite).map((s) => s.forwardedField).filter((f) => f !== undefined),
  );
  const writes = fields.size === 0
    ? []
    : entries.flatMap((e) => fieldWritesInFile(e.abs, e.rel, fields, reader));
  const anchored = new Set(
    writes.filter((s) => isProductSite(s) && s.threshold !== null).map((s) => s.declares),
  );
  return { sites: [...calls, ...writes], fields, anchored };
}

module.exports = {
  ADAPTIVE_MODULE,
  ADAPTIVE_MODULES,
  CONTRAST_ADAPTATION_MODULE,
  SCAN_ROOT,
  VERDICT_TYPE,
  createReader,
  fieldWritesInFile,
  isTestFile,
  localApiNames,
  mayContainPromise,
  promiseSites,
  readAdaptiveApi,
  resolveThreshold,
  sitesInFile,
  verdictDiscardedAt,
};
