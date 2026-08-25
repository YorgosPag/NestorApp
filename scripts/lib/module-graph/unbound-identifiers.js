/**
 * ΑΔΕΣΜΕΥΤΑ ΑΝΑΓΝΩΡΙΣΤΙΚΑ — «αναφέρεται όνομα που ΔΕΝ δηλώνεται και ΔΕΝ εισάγεται;»
 * (ADR-806)
 *
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΑΦΗΝΕΙ Ο N.17. Ο πράκτορας δεν τρέχει `tsc`, και:
 *   • το `ts.createSourceFile` (parse-only) βλέπει **σύνταξη**, όχι δεσμεύσεις·
 *   • το `symbol-integrity` ρωτά «εξάγει ο ΣΤΟΧΟΣ αυτό που ζητώ;» — δεν κοιτά ποτέ
 *     αναγνωριστικό που δεν ήρθε από import·
 *   • το jest δεν φορτώνει module που δεν αγγίζει κανένα test.
 * Μετρημένο ζωντανά (ADR-806 §4): μια σύμπτυξη αφαίρεσε τη σταθερά
 * `MODAL_SELECT_PLACEHOLDERS` και ΚΡΑΤΗΣΕ τη `getSelectPlaceholder` που τη διαβάζει.
 * **Και οι τρεις έλεγχοι βγήκαν πράσινοι** πάνω σε συνάρτηση που θα πετούσε
 * `ReferenceError` στην πρώτη κλήση.
 *
 * ⚠️ ΥΠΕΡ-ΠΡΟΣΕΓΓΙΖΕΙ ΤΙΣ ΔΕΣΜΕΥΣΕΙΣ ΕΠΙΤΗΔΕΣ: μαζεύει ΚΑΘΕ δεσμευμένο όνομα του
 * αρχείου σε ΕΝΑ επίπεδο σύνολο, αγνοώντας εμβέλειες. Άρα μπορεί να ΧΑΣΕΙ σφάλμα
 * (ψευδώς αρνητικό), αλλά **δεν μπορεί να εφεύρει** (ψευδώς θετικό). Για εργαλείο που
 * θα μπλοκάρει commit, αυτή είναι η σωστή κατεύθυνση: ένα ψευδώς θετικό διδάσκει τον
 * επόμενο να το αγνοεί.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

/**
 * 🔑 ΤΑ AMBIENT GLOBALS ΔΕΝ ΓΡΑΦΟΝΤΑΙ ΜΕ ΤΟ ΧΕΡΙ — ΤΑ ΡΩΤΑΜΕ.
 *
 * Η πρώτη γραφή είχε χειρόγραφη λίστα και μετρήθηκε ότι έβγαζε **254 ψευδώς θετικά
 * σύμβολα σε 655 σημεία** (`FirebaseFirestore` ×112, `GeoJSON` ×19, `HeadersInit` ×19,
 * `CanvasImageSource` ×17 …) — όλα νόμιμα. Χειρόγραφος κατάλογος καθολικών **αποκλίνει
 * σιωπηλά** από το `lib` που όντως φορτώνει ο μεταγλωττιστής: το σχήμα που απέτυχε
 * μετρημένα σε 3.34 (63) · 3.37 (18 vs 26) · 3.49 (60) · 3.57 (19/20).
 *
 * Αυθεντία είναι τα ΙΔΙΑ τα `lib.*.d.ts` της TypeScript και τα `@types/*` του έργου —
 * η ίδια κίνηση με το CHECK 3.42, που ρωτά το ΙΔΙΟ το Tailwind αντί να χαρτογραφεί.
 * ⚠️ Απουσία `node_modules` ⇒ πέφτουμε πίσω στον ελάχιστο πυρήνα, ΠΟΤΕ σε σφάλμα.
 */
function readAmbientGlobals(projectRoot) {
  const names = new Set();
  const declRe = /^\s*(?:declare\s+)?(?:var|let|const|function|class|abstract class|namespace|module|enum)\s+([A-Za-z_$][\w$]*)/gm;
  const typeRe = /^\s*(?:declare\s+)?(?:interface|type)\s+([A-Za-z_$][\w$]*)/gm;
  const eat = (file) => {
    let src;
    try { src = fs.readFileSync(file, 'utf8'); } catch { return; }
    for (const re of [declRe, typeRe]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src)) !== null) names.add(m[1]);
    }
  };

  const libDir = path.join(projectRoot, 'node_modules', 'typescript', 'lib');
  try {
    for (const f of fs.readdirSync(libDir)) if (/^lib\..*\.d\.ts$/.test(f)) eat(path.join(libDir, f));
  } catch { /* χωρίς node_modules — ελάχιστος πυρήνας */ }

  const typesDir = path.join(projectRoot, 'node_modules', '@types');
  try {
    for (const pkg of fs.readdirSync(typesDir)) {
      const dir = path.join(typesDir, pkg);
      let entries;
      try { entries = fs.readdirSync(dir); } catch { continue; }
      for (const f of entries) if (f.endsWith('.d.ts')) eat(path.join(dir, f));
    }
  } catch { /* ignore */ }

  // Άμεσες εξαρτήσεις που κουβαλούν ΔΙΚΑ ΤΟΥΣ ambient namespaces (π.χ. το
  // `firebase-admin` δηλώνει `FirebaseFirestore`, το `geojson` το `GeoJSON`).
  // Χωρίς αυτό μετρήθηκαν 131 ψευδώς θετικά σημεία — και όλα νόμιμα.
  let deps = [];
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    deps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
  } catch { /* ignore */ }
  // ⚠️ Το pnpm στήνει τις άμεσες εξαρτήσεις ως SYMLINK: το `dirent.isDirectory()`
  // επιστρέφει **false** για symlink, οπότε η πρώτη γραφή δεν έμπαινε ΠΟΤΕ μέσα —
  // «σάρωσε» μηδέν πακέτα και το «δεν βρήκα» διαβαζόταν ως «δεν υπάρχει».
  const seenDirs = new Set();
  const isDir = (p2) => { try { return fs.statSync(p2).isDirectory(); } catch { return false; } };
  const eatDir = (dir, depth) => {
    if (depth > 3 || seenDirs.has(dir)) return;
    seenDirs.add(dir);
    let entries;
    try { entries = fs.readdirSync(dir); } catch { return; }
    for (const name of entries) {
      const full = path.join(dir, name);
      if (name === 'node_modules') continue;
      if (name.endsWith('.d.ts')) eat(full);
      else if (isDir(full)) eatDir(full, depth + 1);
    }
  };
  for (const d of deps) eatDir(path.join(projectRoot, 'node_modules', ...d.split('/')), 0);

  // 🔶 ΔΗΛΩΜΕΝΟ ΟΡΙΟ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΥΠΟΘΕΤΟΜΕΝΟ.
  // Τα ΜΕΤΑΒΑΤΙΚΑ ambient namespaces (`FirebaseFirestore` του @google-cloud/firestore
  // μέσω firebase-admin· `GeoJSON`) ΔΕΝ σαρώνονται. Δοκιμάστηκε σάρωση ολόκληρου του
  // pnpm store: βρήκε το `FirebaseFirestore` αλλά κόστισε **68,7s** έναντι **2,3s** —
  // εργαλείο που κοστίζει τόσο δεν είναι αυστηρότερο, είναι ανενεργό (CHECK 3.52).
  // Συνέπεια: ~4 ονόματα μένουν ως θόρυβος, ΑΝΑΓΝΩΡΙΣΙΜΟΣ από το ότι εμφανίζονται σε
  // δεκάδες άσχετους φακέλους (π.χ. 112 σημεία) — ένα ΠΡΑΓΜΑΤΙΚΟ αδέσμευτο σύμβολο
  // εμφανίζεται σε ΕΝΑ αρχείο.


  return names;
}

let ambientCache = null;
function ambientGlobals(projectRoot) {
  if (!ambientCache) ambientCache = readAmbientGlobals(projectRoot);
  return ambientCache;
}

/** Ελάχιστος πυρήνας — ό,τι ΔΕΝ δηλώνεται στα lib (module system, test harness, JSX). */
const GLOBALS = new Set([
  'undefined', 'NaN', 'Infinity', 'globalThis', 'console', 'JSON', 'Math', 'Object', 'Array',
  'String', 'Number', 'Boolean', 'Symbol', 'BigInt', 'Date', 'RegExp', 'Error', 'TypeError',
  'RangeError', 'SyntaxError', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Proxy', 'Reflect',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
  'encodeURI', 'decodeURI', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'queueMicrotask', 'structuredClone', 'window', 'document', 'navigator', 'location', 'history',
  'localStorage', 'sessionStorage', 'fetch', 'Request', 'Response', 'Headers', 'URL',
  'URLSearchParams', 'FormData', 'Blob', 'File', 'FileReader', 'AbortController', 'AbortSignal',
  'Image', 'Audio', 'Worker', 'MessageChannel', 'BroadcastChannel', 'IntersectionObserver',
  'ResizeObserver', 'MutationObserver', 'PerformanceObserver', 'performance', 'requestAnimationFrame',
  'cancelAnimationFrame', 'requestIdleCallback', 'crypto', 'TextEncoder', 'TextDecoder',
  'ArrayBuffer', 'SharedArrayBuffer', 'DataView', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray',
  'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array',
  'BigInt64Array', 'BigUint64Array', 'Intl', 'process', 'Buffer', 'global', '__dirname',
  '__filename', 'require', 'module', 'exports', 'React', 'JSX', 'NodeJS', 'HTMLElement',
  'HTMLDivElement', 'HTMLInputElement', 'HTMLCanvasElement', 'CanvasRenderingContext2D',
  'SVGElement', 'Element', 'Node', 'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent',
  'PointerEvent', 'WheelEvent', 'TouchEvent', 'DragEvent', 'FocusEvent', 'InputEvent',
  'EventTarget', 'DOMRect', 'DOMMatrix', 'Path2D', 'ImageData', 'OffscreenCanvas', 'WebSocket',
  'jest', 'describe', 'it', 'test', 'expect', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll',
  'HTMLImageElement', 'HTMLButtonElement', 'HTMLAnchorElement', 'HTMLSelectElement',
  'HTMLTextAreaElement', 'HTMLFormElement', 'HTMLSpanElement', 'HTMLParagraphElement',
  'HTMLTableElement', 'HTMLVideoElement', 'HTMLAudioElement', 'HTMLIFrameElement',
  'HTMLLabelElement', 'HTMLUListElement', 'HTMLLIElement', 'HTMLHeadingElement',
  'SVGSVGElement', 'SVGPathElement', 'SVGGElement', 'WebGL2RenderingContext',
  'WebGLRenderingContext', 'MediaQueryList', 'DOMParser', 'XMLSerializer', 'FileList',
  'ClipboardEvent', 'AnimationEvent', 'TransitionEvent', 'PopStateEvent', 'StorageEvent',
  // ⚠️ ΤΥΠΟΙ-ΕΡΓΑΛΕΙΑ ΤΗΣ TypeScript: δεν δηλώνονται πουθενά στο αρχείο και δεν εισάγονται.
  // Χωρίς αυτούς το εργαλείο έβγαζε ψευδώς θετικά σε ΚΑΘΕ αρχείο με `Record<…>` — και ένα
  // εργαλείο που ουρλιάζει σε σωστό κώδικα διδάσκει τον επόμενο να το αγνοεί.
  'Record', 'Partial', 'Required', 'Readonly', 'Pick', 'Omit', 'Exclude', 'Extract',
  'NonNullable', 'Parameters', 'ConstructorParameters', 'ReturnType', 'InstanceType',
  'ThisParameterType', 'OmitThisParameter', 'ThisType', 'Awaited', 'Uppercase', 'Lowercase',
  'Capitalize', 'Uncapitalize', 'ReadonlyArray', 'ReadonlyMap', 'ReadonlySet', 'ArrayLike',
  'Iterable', 'AsyncIterable', 'IterableIterator', 'AsyncIterableIterator', 'Generator',
  'AsyncGenerator', 'PromiseLike', 'Function', 'Omit', 'Extract', 'IArguments', 'PropertyKey',
]);

/**
 * ⚠️ Το `as const` γράφεται συντακτικά ως TypeReference με όνομα `const`. Χωρίς αυτή την
 * εξαίρεση το εργαλείο ανέφερε «αδέσμευτο: const» σε κάθε αρχείο δεδομένων του έργου.
 */
const SYNTACTIC_NOT_A_NAME = new Set([
  'const',   // `x as const` — TypeReference, όχι όνομα
  'meta',    // `import.meta` — MetaProperty, όχι αναγνωριστικό
  'this',    // τύπος `this`
  'default', // `export { default }` / `import default`
]);

/** Κάθε όνομα που δεσμεύεται ΟΠΟΥΔΗΠΟΤΕ στο αρχείο (επίπεδο σύνολο, εσκεμμένα). */
function collectBindings(sf) {
  const names = new Set();
  const addName = (node) => {
    if (!node) return;
    if (ts.isIdentifier(node)) { names.add(node.text); return; }
    if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
      for (const el of node.elements) {
        if (ts.isBindingElement(el)) { addName(el.name); if (el.propertyName && ts.isIdentifier(el.propertyName)) names.add(el.propertyName.text); }
      }
    }
  };
  const visit = (n) => {
    if (ts.isImportDeclaration(n) && n.importClause) {
      const ic = n.importClause;
      if (ic.name) names.add(ic.name.text);
      const nb = ic.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) names.add(nb.name.text);
      if (nb && ts.isNamedImports(nb)) for (const e of nb.elements) names.add(e.name.text);
    }
    if (ts.isImportEqualsDeclaration(n) && n.name) names.add(n.name.text);
    if (ts.isVariableDeclaration(n)) addName(n.name);
    if (ts.isParameter(n)) addName(n.name);
    if (ts.isBindingElement(n)) addName(n.name);
    if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n) || ts.isEnumDeclaration(n)
      || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isModuleDeclaration(n))
      && n.name && ts.isIdentifier(n.name)) names.add(n.name.text);
    if ((ts.isFunctionExpression(n) || ts.isClassExpression(n)) && n.name) names.add(n.name.text);
    if (ts.isTypeParameterDeclaration(n) && n.name) names.add(n.name.text);
    if (ts.isCatchClause(n) && n.variableDeclaration) addName(n.variableDeclaration.name);
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
  return names;
}

/** Τα αναγνωριστικά που ΔΙΑΒΑΖΟΝΤΑΙ (όχι ονόματα ιδιοτήτων, όχι ετικέτες JSX). */
function collectReads(sf) {
  const reads = [];
  const visit = (n, parent) => {
    if (ts.isIdentifier(n)) {
      const p = parent;
      const isPropertyName = p && (
        (ts.isPropertyAccessExpression(p) && p.name === n) ||
        (ts.isQualifiedName(p) && p.right === n) ||
        (ts.isPropertyAssignment(p) && p.name === n) ||
        (ts.isPropertySignature(p) && p.name === n) ||
        (ts.isMethodDeclaration(p) && p.name === n) ||
        (ts.isMethodSignature(p) && p.name === n) ||
        (ts.isPropertyDeclaration(p) && p.name === n) ||
        (ts.isEnumMember(p) && p.name === n) ||
        (ts.isBindingElement(p) && p.propertyName === n) ||
        (ts.isImportSpecifier(p)) || (ts.isExportSpecifier(p)) ||
        (ts.isJsxAttribute(p) && p.name === n) ||
        // `get foo() {}` / `set foo(v) {}` σε object literal ή class: ΟΝΟΜΑ, όχι ανάγνωση.
        (ts.isGetAccessorDeclaration(p) && p.name === n) ||
        (ts.isSetAccessorDeclaration(p) && p.name === n) ||
        // `import('./m').Foo` — το `Foo` ζει στο ΞΕΝΟ module, όχι σε αυτή την εμβέλεια.
        (ts.isImportTypeNode(p) && p.qualifier === n) ||
        // `[x: number, y: number]` — ΕΤΙΚΕΤΑ στοιχείου tuple, όχι δέσμευση.
        (ts.isNamedTupleMember(p) && p.name === n) ||
        // `outerLoop: for (…) { break outerLoop; }` — ετικέτα εντολής, όχι αναγνωριστικό.
        (ts.isLabeledStatement(p) && p.label === n) ||
        (ts.isBreakOrContinueStatement(p) && p.label === n) ||
        // `export * as marks from './marks'` — NamespaceExport: ΔΕΝ δεσμεύει τοπικά.
        (ts.isNamespaceExport(p) && p.name === n) ||
        // Ενδογενές στοιχείο JSX (`<div>`): ΠΟΤΕ αναγνωριστικό. Τα components ξεκινούν
        // με κεφαλαίο και ΠΡΕΠΕΙ να ελέγχονται — γι' αυτό το κριτήριο είναι το πεζό αρχικό.
        ((ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxClosingElement(p))
          && p.tagName === n && /^[a-z]/.test(n.text))
      );
      if (!isPropertyName) reads.push(n);
    }
    ts.forEachChild(n, (c) => visit(c, n));
  };
  ts.forEachChild(sf, (c) => visit(c, sf));
  return reads;
}

/**
 * @returns {{file:string, name:string, line:number}[]} αδέσμευτα αναγνωριστικά
 */
function findUnbound(relPath, source, projectRoot) {
  const kind = relPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(relPath, source, ts.ScriptTarget.Latest, true, kind);
  if ((sf.parseDiagnostics || []).length) return [];   // σπασμένη σύνταξη — άλλο ερώτημα
  const bound = collectBindings(sf);
  const ambient = ambientGlobals(projectRoot || process.cwd());
  const out = [];
  const seen = new Set();
  for (const id of collectReads(sf)) {
    const name = id.text;
    if (bound.has(name) || GLOBALS.has(name) || ambient.has(name)
      || SYNTACTIC_NOT_A_NAME.has(name) || seen.has(name)) continue;
    seen.add(name);
    out.push({ file: relPath, name, line: sf.getLineAndCharacterOfPosition(id.getStart(sf)).line + 1 });
  }
  return out;
}

module.exports = { findUnbound, collectBindings, ambientGlobals, GLOBALS };
