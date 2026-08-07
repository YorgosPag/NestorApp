#!/usr/bin/env node
/**
 * ADR-772 §9 — Ανοίγει **τα δοχεία**: από όνομα τύπου σε λίστα πεδίων.
 *
 * 🔑 ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ «διάβασε το interface». Μετρημένο στο ίδιο δέντρο:
 *
 *   · `CompanyAddress` δηλώνει **μηδέν** δικά του διοικητικά πεδία — τα δέκα τα παίρνει
 *     από `extends PostalAddressFields, GreekAdministrativeHierarchyFields`. Σαρωτής που
 *     διαβάζει μόνο τα δικά μέλη θα έλεγε «κανένα πεδίο, άρα τίποτα αδήλωτο»: **πράσινο
 *     που σημαίνει «δεν κοίταξα»**, το σχήμα που το CLAUDE.md τεκμηριώνει σε πέντε σημεία.
 *   · `AddressInfo` εισάγεται ως `@/types/contacts`, που είναι **barrel**
 *     (`export * from './contracts'`). Χωρίς παρακολούθηση επανεξαγωγής, ο τύπος
 *     «δεν βρίσκεται» — και ένα «δεν βρέθηκε» που διαβάζεται ως «καθαρό» είναι το ίδιο
 *     ψεύτικο πράσινο από την άλλη μεριά.
 *
 * Γι' αυτό εδώ υπάρχουν **τρεις** μηχανισμοί, όλοι απαραίτητοι, όλοι μετρημένοι:
 * κληρονομιά (`extends`) · άμεσες εισαγωγές · επανεξαγωγές (`export *` και `export { X } from`).
 *
 * ⚠️ ΚΑΜΙΑ ΣΙΩΠΗΛΗ ΑΠΟΡΡΙΨΗ. Ό,τι δεν επιλύεται επιστρέφεται ως ρητό `unresolved` με
 * **λόγο**, και ο καλών αποφασίζει αν μπλοκάρει (δοχείο του πίνακα ⇒ ναι, fail-closed).
 * Το πρότυπο είναι οι πέντε ρητές καταστάσεις του CHECK 3.35 (ADR-747).
 *
 * ⚠️ Η ΕΠΙΛΥΣΗ ΕΙΔΙΚΕΥΤΩΝ ΕΙΝΑΙ ΔΑΝΕΙΚΗ, ΟΧΙ ΑΝΤΙΓΡΑΜΜΕΝΗ: `resolveSpecifier` +
 * `readTsPathAliases` του ADR-700 (`scripts/lib/module-graph/resolve-specifier.js`).
 * Είναι σχεδιασμένο injectable — «ο καλών περνά το σύνολο αρχείων» — οπότε εδώ περνιέται
 * ένα σύνολο με πλάτη τον δίσκο (`fs.existsSync`): οι ειδικευτές που λύνουμε είναι
 * λίγοι (τα δοχεία και οι βάσεις τους), άρα ένας περίπατος 14.708 αρχείων για να
 * απαντηθούν ~10 ερωτήσεις θα ήταν σπατάλη — και **δεύτερη** υλοποίηση επίλυσης θα ήταν
 * το σχήμα του ADR-749 (τέσσερις μηχανές, τρεις αριθμοί).
 *
 * Parse-only (`ts.createSourceFile`): χωρίς program, χωρίς type-checker, χωρίς
 * διαγνωστικά — **δεν είναι `tsc`** (CLAUDE.md N.17).
 *
 * @module scripts/lib/address-vocabulary/type-index
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { toPosix, readTsPathAliases, resolveSpecifier } = require('../module-graph/resolve-specifier');

const propName = (node) => {
  const n = node.name;
  if (!n) return null;
  return ts.isIdentifier(n) || ts.isStringLiteral(n) ? n.text : null;
};

const scriptKindFor = (file) => (file.endsWith('.tsx') || file.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

/** Το **πρώτο** μπλοκ σχολίων ενός αρχείου — εκεί και μόνο εκεί δηλώνεται η παραγωγή. */
const LEADING_COMMENT = /^\s*(\/\*[\s\S]*?\*\/|(?:\/\/[^\n]*\n)+)/;
const GENERATED_MARKER = /@generated|auto-generated|automatically generated/i;

/**
 * Είναι το αρχείο **παραγόμενο**;
 *
 * 🔑 Γιατί έχει σημασία εδώ: ένα παραγόμενο αρχείο δεν είναι **απόφαση**, είναι
 * **προβολή** άλλου SSoT. Το `src/types/i18n.ts` παράγεται από τα 100 locale JSON και
 * δηλώνει `municipality`, `municipalityId`, `settlementId`… — που είναι **κλειδιά
 * μετάφρασης**, όχι πεδία διεύθυνσης. Χωρίς αυτόν τον διαχωρισμό ήταν **1 στα 5**
 * ευρήματα, δηλαδή **20% ψευδώς θετικά** σε μπλοκάρουσα πύλη (πήχης Google: <10%) —
 * μετρημένο, όχι υποθετικό. Η φρεσκάδα του φρουρείται ήδη από το CHECK 3.33 και η
 * χειροκίνητη επεξεργασία του απαγορεύεται ρητά στην επικεφαλίδα του.
 *
 * ⚠️ Ο δείκτης διαβάζεται **μόνο** από το πρώτο μπλοκ σχολίων: «do not edit» κάπου στη
 * μέση ενός αρχείου είναι πρόζα, όχι δήλωση. Μετρημένο: το χαλαρό κριτήριο έβγαζε **21**
 * αρχεία, το αυστηρό **11** — και τα 11 είναι όντως παραγόμενα ή πρότυπα.
 * ⚠️ ΔΕΝ είναι σιωπηλή εξαίρεση: μετριέται ως ρητή κατάσταση `generated-artifact`, οπότε
 * ένα αρχείο που «γίνεται» παραγόμενο για να ξεφύγει αλλάζει **ορατά** τον αριθμό.
 */
function isGeneratedSource(text) {
  const match = LEADING_COMMENT.exec(text);
  return !!match && GENERATED_MARKER.test(match[0]);
}

/**
 * Τα μέλη ενός τύπου-αντικειμένου + τα ονόματα των βάσεών του.
 *
 * Δέχεται και `interface X extends A, B { … }` και `type X = A & { … }` — είναι η **ίδια**
 * πράξη γραμμένη με δύο συντακτικά, και το έργο χρησιμοποιεί και τα δύο.
 */
function readTypeShape(node, sourceFile) {
  const members = [];
  const bases = [];

  const collectMembers = (list) => {
    for (const m of list) {
      if (!ts.isPropertySignature(m)) continue;
      const name = propName(m);
      if (!name) continue;
      members.push({ name, line: sourceFile.getLineAndCharacterOfPosition(m.getStart(sourceFile)).line + 1 });
    }
  };
  const collectBase = (typeNode) => {
    if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) bases.push(typeNode.typeName.text);
    else if (ts.isExpressionWithTypeArguments(typeNode) && ts.isIdentifier(typeNode.expression)) bases.push(typeNode.expression.text);
    // Οτιδήποτε άλλο (Partial<X>, Omit<X,'a'>, ενώσεις, mapped types) είναι **δηλωμένα
    // εκτός εμβέλειας**: δεν είναι δοχείο που «απέκτησε πεδίο», είναι μετασχηματισμός
    // ενός δοχείου — και ο μεταγλωττιστής ήδη τον κρατά συνεπή με την πηγή του.
    else bases.push({ opaque: typeNode.getText(sourceFile).replace(/\s+/g, ' ').slice(0, 60) });
  };

  if (ts.isInterfaceDeclaration(node)) {
    collectMembers(node.members);
    for (const clause of node.heritageClauses || []) for (const t of clause.types) collectBase(t);
    return { members, bases };
  }
  if (ts.isTypeAliasDeclaration(node)) {
    const t = node.type;
    if (ts.isTypeLiteralNode(t)) collectMembers(t.members);
    else if (ts.isIntersectionTypeNode(t)) {
      for (const part of t.types) {
        if (ts.isTypeLiteralNode(part)) collectMembers(part.members);
        else collectBase(part);
      }
    } else return null; // ένωση / mapped / keyof → δεν είναι δοχείο
    return { members, bases };
  }
  return null;
}

/**
 * Ένα αρχείο, διαβασμένο μία φορά: δηλώσεις τύπων · εισαγωγές · επανεξαγωγές.
 * Το `parsed` κρατά τα πάντα ώστε η αναδρομή σε barrels να μη ξαναδιαβάζει.
 */
function parseFile(absFile, relFile) {
  const source = fs.readFileSync(absFile, 'utf8');
  const sourceFile = ts.createSourceFile(relFile, source, ts.ScriptTarget.Latest, true, scriptKindFor(relFile));
  const generated = isGeneratedSource(source);

  const declarations = new Map();
  const imports = new Map();
  const starReexports = [];
  const namedReexports = new Map();

  const visit = (node) => {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      const shape = readTypeShape(node, sourceFile);
      if (shape) {
        declarations.set(node.name.text, {
          name: node.name.text,
          file: relFile,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
          generated,
          ...shape,
        });
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  for (const stmt of sourceFile.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const b = stmt.importClause && stmt.importClause.namedBindings;
      if (b && ts.isNamedImports(b)) {
        for (const el of b.elements) {
          imports.set(el.name.text, { spec: stmt.moduleSpecifier.text, sourceName: (el.propertyName || el.name).text });
        }
      }
    } else if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const spec = stmt.moduleSpecifier.text;
      if (!stmt.exportClause) starReexports.push(spec);
      else if (ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) {
          namedReexports.set(el.name.text, { spec, sourceName: (el.propertyName || el.name).text });
        }
      }
    }
  }

  return { file: relFile, generated, declarations, imports, starReexports, namedReexports };
}

/**
 * Το περιβάλλον επίλυσης. Ένα ανά εκτέλεση· κρατά μνήμη parse ώστε ένα barrel που
 * διασχίζεται από πέντε δοχεία να διαβαστεί **μία** φορά.
 */
function createResolver(projectRoot) {
  const aliases = readTsPathAliases(projectRoot);
  const cache = new Map();
  // Το `probe` του ADR-700 ρωτά μόνο `fileSet.has(x)` — εδώ η απάντηση έρχεται από τον
  // δίσκο (βλ. σχόλιο αρχείου: λίγες ερωτήσεις, όχι περίπατος 14.708 αρχείων).
  const fileSet = {
    has: (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } },
  };

  const load = (relFile) => {
    if (cache.has(relFile)) return cache.get(relFile);
    const abs = path.join(projectRoot, relFile);
    let parsed = null;
    try { parsed = parseFile(abs, relFile); } catch { parsed = null; }
    cache.set(relFile, parsed);
    return parsed;
  };

  const toRel = (absPosix) => toPosix(path.relative(projectRoot, absPosix));

  const resolveFile = (spec, fromRelFile) => {
    const hit = resolveSpecifier(spec, toPosix(path.join(projectRoot, fromRelFile)), { projectRoot, aliases, fileSet });
    if (hit.kind !== 'internal') return null;
    return toRel(hit.file);
  };

  /**
   * Βρες τη **δήλωση** ενός ονόματος τύπου, ξεκινώντας από ένα αρχείο.
   * Ακολουθεί: τοπική δήλωση → άμεση εισαγωγή → ονομαστική επανεξαγωγή → `export *`.
   *
   * @returns {{status:'found', decl:object}|{status:'unresolved', reason:string}}
   */
  const resolveType = (typeName, fromRelFile, seen = new Set()) => {
    const key = `${fromRelFile}::${typeName}`;
    if (seen.has(key)) return { status: 'unresolved', reason: `κύκλος επανεξαγωγής στο ${fromRelFile}` };
    seen.add(key);

    const parsed = load(fromRelFile);
    if (!parsed) return { status: 'unresolved', reason: `αδύνατη η ανάγνωση του ${fromRelFile}` };

    if (parsed.declarations.has(typeName)) return { status: 'found', decl: parsed.declarations.get(typeName) };

    for (const table of [parsed.imports, parsed.namedReexports]) {
      const hop = table.get(typeName);
      if (!hop) continue;
      const target = resolveFile(hop.spec, fromRelFile);
      if (!target) return { status: 'unresolved', reason: `ανεπίλυτος ειδικευτής "${hop.spec}" (${fromRelFile})` };
      return resolveType(hop.sourceName, target, seen);
    }

    for (const spec of parsed.starReexports) {
      const target = resolveFile(spec, fromRelFile);
      if (!target) continue;
      const hit = resolveType(typeName, target, seen);
      if (hit.status === 'found') return hit;
    }

    return { status: 'unresolved', reason: `ο τύπος "${typeName}" δεν βρέθηκε από το ${fromRelFile}` };
  };

  /**
   * Τα **πραγματικά** πεδία ενός δοχείου: δικά του + όσα κληρονομεί, αναδρομικά.
   *
   * Οι ανεπίλυτες βάσεις **επιστρέφονται**, δεν σιωπούν — για δοχείο του πίνακα ο καλών
   * τις μεταφράζει σε αποτυχία (fail-closed): «δεν μπόρεσα να δω τα πεδία» δεν
   * επιτρέπεται να διαβαστεί ως «δεν έχει πεδία».
   */
  const effectiveFields = (decl, seen = new Set()) => {
    const key = `${decl.file}::${decl.name}`;
    if (seen.has(key)) return { fields: [], unresolvedBases: [], opaqueBases: [] };
    seen.add(key);

    const fields = decl.members.map((m) => ({ ...m, from: decl.name, file: decl.file }));
    const unresolvedBases = [];
    const opaqueBases = [];

    for (const base of decl.bases) {
      if (typeof base !== 'string') { opaqueBases.push(base.opaque); continue; }
      const hit = resolveType(base, decl.file, new Set());
      if (hit.status !== 'found') { unresolvedBases.push({ base, reason: hit.reason }); continue; }
      const inner = effectiveFields(hit.decl, seen);
      fields.push(...inner.fields);
      unresolvedBases.push(...inner.unresolvedBases);
      opaqueBases.push(...inner.opaqueBases);
    }
    return { fields, unresolvedBases, opaqueBases };
  };

  /** Κάθε τύπος που είναι προσιτός ως **βάση** ενός δοχείου — κρίνεται εκεί, όχι χωριστά. */
  const heritageClosure = (decl, out = new Set()) => {
    for (const base of decl.bases) {
      if (typeof base !== 'string') continue;
      const hit = resolveType(base, decl.file, new Set());
      if (hit.status !== 'found') continue;
      const key = `${hit.decl.file}::${hit.decl.name}`;
      if (out.has(key)) continue;
      out.add(key);
      heritageClosure(hit.decl, out);
    }
    return out;
  };

  return { load, resolveType, effectiveFields, heritageClosure, resolveFile, parseFile };
}

/**
 * «Άνοιξε **κάθε** δοχείο του πίνακα» — **μία** φορά, για **τρεις** καταναλωτές.
 *
 * ⚠️ ΓΡΑΦΤΗΚΕ ΕΠΕΙΔΗ Η ΠΥΛΗ 3.28 (jscpd / N.18) ΤΟ ΕΠΙΑΣΕ: ο ίδιος βρόχος «λύσε τον
 * ειδικευτή → λύσε τον τύπο → πάρε την κλειστότητα κληρονομιάς» ήταν γραμμένος **τρεις**
 * φορές (κριτής δοχείων · σκανδάλη Στρώματος 1 · κλειδιά εξαίρεσης). Τρεις υλοποιήσεις
 * του «ποια είναι τα δοχεία» είναι το ακριβές σχήμα που το ADR-749 αποσυναρμολόγησε —
 * τέσσερις μηχανές SSoT με τρεις διαφορετικούς αριθμούς για το ίδιο δέντρο. Η πύλη το
 * είπε **πριν** γραφτεί το «done», που είναι όλος ο λόγος ύπαρξής της.
 *
 * @returns {{container:object, decl:object|null, reason:string|null, heritage:Set<string>}[]}
 *   `decl === null` ⇒ **δηλωμένη αποτυχία** με `reason`· ποτέ σιωπηλή παράλειψη.
 */
function resolveContainerDeclarations(table, resolver) {
  return table.containers.map((container) => {
    const from = container.specifier
      ? resolver.resolveFile(container.specifier, table.file)
      : table.file;
    if (!from) {
      return { container, decl: null, heritage: new Set(), reason: `ανεπίλυτος ειδικευτής "${container.specifier}"` };
    }
    const hit = resolver.resolveType(container.typeName, from);
    if (hit.status !== 'found') {
      return { container, decl: null, heritage: new Set(), reason: hit.reason };
    }
    return { container, decl: hit.decl, heritage: resolver.heritageClosure(hit.decl), reason: null };
  });
}

module.exports = {
  createResolver, parseFile, readTypeShape, isGeneratedSource, resolveContainerDeclarations,
};
