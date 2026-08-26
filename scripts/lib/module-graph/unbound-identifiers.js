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
const crypto = require('node:crypto');
const ts = require('typescript');

/**
 * 🔑 ΤΑ AMBIENT GLOBALS ΔΕΝ ΓΡΑΦΟΝΤΑΙ ΜΕ ΤΟ ΧΕΡΙ — ΤΑ ΡΩΤΑΜΕ, ΚΑΙ ΤΑ ΡΩΤΑΜΕ ΜΕ AST.
 *
 * Η πρώτη γραφή είχε χειρόγραφη λίστα και μετρήθηκε ότι έβγαζε **254 ψευδώς θετικά
 * σύμβολα σε 655 σημεία** (`FirebaseFirestore` ×112, `GeoJSON` ×19, `HeadersInit` ×19,
 * `CanvasImageSource` ×17 …) — όλα νόμιμα. Χειρόγραφος κατάλογος καθολικών **αποκλίνει
 * σιωπηλά** από το `lib` που όντως φορτώνει ο μεταγλωττιστής: το σχήμα που απέτυχε
 * μετρημένα σε 3.34 (63) · 3.37 (18 vs 26) · 3.49 (60) · 3.57 (19/20).
 *
 * Η **δεύτερη** γραφή ρωτούσε τα ίδια τα `.d.ts`, αλλά με **κανονική έκφραση** — και η
 * regex δεν έχει έννοια **εμβέλειας**: μάζευε ως «καθολικό» κάθε `interface`/`class`
 * που ζει **ΜΕΣΑ** σε `declare namespace X { … }` (είναι `X.µέλος`, όχι καθολικό) και
 * κάθε δήλωση **module** `.d.ts` (είναι εξαγωγή, όχι καθολικό). Μετρημένο στο ίδιο
 * δέντρο την ίδια μέρα: **19.576 έναντι 2.531 ονομάτων — υπερ-προσέγγιση 7,7×**.
 * ⚠️ Ένα φουσκωμένο σύνολο καθολικών **δεν είναι συντηρητικό, είναι ΤΥΦΛΟ**: κάθε
 * όνομα που μπαίνει μέσα σβήνει και ένα πραγματικό σφάλμα. Αποδεδειγμένα ζωντανά —
 * με τη regex, το `GeoPoint` του `geo-ring.test.ts` γινόταν **αόρατο**.
 *
 * 🏆 **ΑΥΘΕΝΤΙΑ = Ο ΙΔΙΟΣ Ο ΚΑΝΟΝΑΣ ΤΗΣ TypeScript** (ίδια κίνηση με το CHECK 3.42,
 * που ρωτά το ΙΔΙΟ το Tailwind, και με το 3.47 που δανείζεται τον matcher του jest):
 *   • `.d.ts` **ΧΩΡΙΣ** top-level `import`/`export` = *script* ⇒ **όλες** οι δηλώσεις
 *     του είναι καθολικές·
 *   • `.d.ts` **ΜΕ** `import`/`export` = *module* ⇒ **τίποτα** δεν είναι καθολικό,
 *     εκτός από `declare global { … }` και `export as namespace X`·
 *   • μέλη μέσα σε `declare namespace X { … }` **ΠΟΤΕ** καθολικά.
 *
 * ⚠️ Απουσία `node_modules` ⇒ πέφτουμε πίσω στον ελάχιστο πυρήνα, ΠΟΤΕ σε σφάλμα.
 */
function harvestGlobals(sf, out) {
  const isModule = sf.statements.some((st) =>
    ts.isImportDeclaration(st) || ts.isExportDeclaration(st) || ts.isExportAssignment(st)
    || ts.isImportEqualsDeclaration(st)
    || (ts.canHaveModifiers(st)
      && (ts.getModifiers(st) || []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)));

  const addDecl = (st) => {
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) out.add(d.name.text);
      return;
    }
    if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isEnumDeclaration(st)
      || ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isModuleDeclaration(st))
      && st.name && ts.isIdentifier(st.name)) out.add(st.name.text);
    // ⚠️ `declare module 'πακέτο'` έχει StringLiteral όνομα — δήλωση **module**, όχι
    // καθολικό αναγνωριστικό· ο έλεγχος `isIdentifier` παραπάνω το κόβει.
  };

  for (const st of sf.statements) {
    if (ts.isNamespaceExportDeclaration(st)) { out.add(st.name.text); continue; }  // export as namespace X
    if (ts.isModuleDeclaration(st) && (st.flags & ts.NodeFlags.GlobalAugmentation)) {  // declare global { }
      if (st.body && ts.isModuleBlock(st.body)) for (const inner of st.body.statements) addDecl(inner);
      continue;
    }
    if (!isModule) addDecl(st);
  }
}

/**
 * Διάσχιση φακέλου για `.d.ts` — ΕΝΑΣ περίπατος, και για τα δύο σύνολα.
 *
 * ⚠️ **ΤΟ ΒΑΘΟΣ ΕΙΝΑΙ ΠΑΡΑΜΕΤΡΟΣ, ΟΧΙ ΣΤΑΘΕΡΑ, ΚΑΙ ΕΙΝΑΙ ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΑ ΕΡΩΤΗΜΑΤΑ**:
 * ένα πακέτο κρατά τους τύπους του ρηχά (3 επίπεδα φτάνουν και σταματούν την έκρηξη),
 * το **δικό μας** δέντρο όχι — μετρημένο: με όριο 3 έμεναν έξω **4** δικά μας ambient
 * αρχεία (`floorplan-background/providers/utif.d.ts`, `systems/topography/cdt2d.d.ts`,
 * `text-engine/fonts/opentype.d.ts`, `text-engine/spell/nspell.d.ts`), και η απουσία
 * τους θα φαινόταν ως **ψευδώς θετικό σε σωστό κώδικα**.
 */
const VENDOR_MAX_DEPTH = 3;
const PROJECT_MAX_DEPTH = 12;

function walkDts(dir, depth, seenDirs, onFile, maxDepth = VENDOR_MAX_DEPTH) {
  if (depth > maxDepth || seenDirs.has(dir)) return;
  seenDirs.add(dir);
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.name.endsWith('.d.ts')) { onFile(full); continue; }
    // ⚠️ **ΠΡΩΤΑ Ο ΦΘΗΝΟΣ ΕΛΕΓΧΟΣ, ΤΟ `statSync` ΜΟΝΟ ΓΙΑ SYMLINK.** Το pnpm στήνει τις
    // άμεσες εξαρτήσεις ως symlink και το `dirent.isDirectory()` επιστρέφει **false**
    // γι' αυτές — γι' αυτό χρειάζεται το `statSync`. Αλλά **μόνο** γι' αυτές: η πρώτη
    // γραφή το καλούσε σε **κάθε** εγγραφή, και πάνω στο δικό μας δέντρο (15.294
    // αρχεία) κόστιζε **~29s** — από 17s σε 46s, δηλαδή ζώνη `SKIP_` (μάθημα 3.52).
    if (e.isDirectory()) { walkDts(full, depth + 1, seenDirs, onFile, maxDepth); continue; }
    if (!e.isSymbolicLink()) continue;
    try {
      if (fs.statSync(full).isDirectory()) walkDts(full, depth + 1, seenDirs, onFile, maxDepth);
    } catch { /* σπασμένος σύνδεσμος */ }
  }
}

/**
 * Οι φάκελοι που μπορούν να δηλώσουν καθολικά: `typescript/lib` · `@types/*` · κάθε
 * **άμεση** εξάρτηση **και ένα επίπεδο** των δικών της.
 *
 * ⚠️ **ΚΑΙ ΤΑ ΤΡΙΑ ΕΙΔΗ ΕΞΑΡΤΗΣΗΣ, ΟΧΙ ΜΟΝΟ `dependencies`** — μετρημένο: το
 * `FirebaseFirestore` (**112** σημεία, ο μεγαλύτερος θόρυβος του εργαλείου) ζει στο
 * `@google-cloud/firestore`, που το `firebase-admin` δηλώνει **`optionalDependencies`**.
 * Με μόνο τα `dependencies` ο φάκελος δεν εντοπιζόταν ΠΟΤΕ.
 * ⚠️ **`realpathSync` ΠΡΩΤΑ**: χωρίς αυτό η ανάλυση ξεκινά από το symlink της ρίζας και
 * δεν βλέπει ποτέ το `.pnpm/<pkg>@<ver>/node_modules/` όπου ζουν οι εξαρτήσεις του.
 * Αυθεντία της ανάλυσης είναι το **ίδιο το Node** (`require.resolve`), όχι μαντεψιά για
 * τη διάταξη του pnpm.
 */
function vendorTypeRoots(projectRoot) {
  const dirs = new Set();
  const add = (p2) => { try { dirs.add(fs.realpathSync(p2)); } catch { /* δεν υπάρχει */ } };

  add(path.join(projectRoot, 'node_modules', 'typescript', 'lib'));
  try {
    const typesDir = path.join(projectRoot, 'node_modules', '@types');
    for (const pkg of fs.readdirSync(typesDir)) add(path.join(typesDir, pkg));
  } catch { /* ignore */ }

  let deps = [];
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    deps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
  } catch { /* ignore */ }

  for (const d of deps) {
    let own;
    try { own = fs.realpathSync(path.join(projectRoot, 'node_modules', ...d.split('/'))); } catch { continue; }
    dirs.add(own);
    let meta;
    try { meta = JSON.parse(fs.readFileSync(path.join(own, 'package.json'), 'utf8')); } catch { continue; }
    const children = Object.keys({
      ...(meta.dependencies || {}), ...(meta.optionalDependencies || {}), ...(meta.peerDependencies || {}),
    });
    for (const c of children) {
      try { add(path.dirname(require.resolve(`${c}/package.json`, { paths: [own] }))); } catch { /* ignore */ }
    }
  }
  return dirs;
}

function collectGlobalsFrom(dirs, maxDepth) {
  const names = new Set();
  const seenDirs = new Set();
  const onFile = (file) => {
    let src;
    try { src = fs.readFileSync(file, 'utf8'); } catch { return; }
    harvestGlobals(ts.createSourceFile(file, src, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS), names);
  };
  for (const d of dirs) walkDts(d, 0, seenDirs, onFile, maxDepth);
  return names;
}

/**
 * 🔴 **ΤΟ ΕΡΓΟ ΔΗΛΩΝΕΙ ΚΑΙ ΔΙΚΑ ΤΟΥ ΚΑΘΟΛΙΚΑ, ΚΑΙ ΔΕΝ ΔΙΑΒΑΖΟΝΤΑΝ ΠΟΤΕ**:
 * `types/root-ambient.d.ts` · `types/window.d.ts` · `types/jest-globals.d.ts` κ.ά.
 * Με το φουσκωμένο σύνολο της regex η απουσία τους ήταν αόρατη· με ακριβές σύνολο
 * θα γεννούσε **ψευδώς θετικά σε σωστό κώδικα** — και μια πύλη που ουρλιάζει σε
 * σωστό κώδικα διδάσκει τον επόμενο να την αγνοεί.
 *
 * ⚠️ **ΔΕΝ μπαίνουν στην προσωρινή μνήμη**: αλλάζουν με τον κώδικα, όχι με το
 * lockfile. Είναι **19** αρχεία — μετρημένο κόστος υπό τα 60ms.
 */
function projectAmbientRoots(projectRoot) {
  return new Set(['src', 'scripts', 'types']
    .map((r) => path.join(projectRoot, r))
    .filter((p2) => { try { return fs.statSync(p2).isDirectory(); } catch { return false; } }));
}

/**
 * ⚠️ **ΓΙΑΤΙ ΠΡΟΣΩΡΙΝΗ ΜΝΗΜΗ ΚΑΙ ΓΙΑΤΙ ΜΕ ΑΥΤΟ ΤΟ ΑΠΟΤΥΠΩΜΑ**: η ακριβής σάρωση
 * κοστίζει **~17s** (12.833 `.d.ts`). Πύλη που κοστίζει τόσο δεν είναι αυστηρότερη —
 * είναι **ανενεργή** (μάθημα CHECK 3.52). Με τη μνήμη το κόστος πέφτει σε **~50ms**.
 *
 * 🔑 **Το αποτύπωμα είναι sha256 ΤΩΝ ΕΙΣΟΔΩΝ, ΠΟΤΕ ΡΟΛΟΪ** (μάθημα CHECK 3.33: ένα
 * `git checkout` αλλάζει `mtime` χωρίς να αλλάξει τίποτα). Είσοδοι: το `pnpm-lock.yaml`
 * (καμία εξάρτηση δεν αλλάζει χωρίς αυτό) **και ο κώδικας αυτού του αρχείου** — αλλιώς
 * αλλαγή στον ίδιο τον κανόνα συγκομιδής θα διάβαζε **παλιό** αποτέλεσμα, δηλαδή το
 * κριτήριο θα άλλαζε χωρίς ποτέ να ασκηθεί (ίδια παγίδα με τη σκανδάλη του 3.57).
 * ⚠️ Καμία αποτυχία της μνήμης δεν είναι σφάλμα: αστοχία ⇒ ξαναχτίζουμε.
 */
const CACHE_REL = path.join('node_modules', '.cache', 'nestor', 'ambient-globals.json');

function cacheFingerprint(projectRoot) {
  const h = crypto.createHash('sha256');
  for (const f of [path.join(projectRoot, 'pnpm-lock.yaml'), __filename]) {
    try { h.update(fs.readFileSync(f)); } catch { h.update(`missing:${f}`); }
  }
  return h.digest('hex');
}

function readVendorGlobals(projectRoot) {
  const cacheFile = path.join(projectRoot, CACHE_REL);
  const fingerprint = cacheFingerprint(projectRoot);
  if (!process.env.UNBOUND_NO_CACHE) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (cached && cached.fingerprint === fingerprint && Array.isArray(cached.names)) {
        return new Set(cached.names);
      }
    } catch { /* αστοχία μνήμης — ξαναχτίζουμε */ }
  }
  const names = collectGlobalsFrom(vendorTypeRoots(projectRoot), VENDOR_MAX_DEPTH);
  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify({ fingerprint, names: [...names].sort() }));
  } catch { /* μόνο ταχύτητα — ποτέ ορθότητα */ }
  return names;
}

function readAmbientGlobals(projectRoot) {
  const names = readVendorGlobals(projectRoot);
  for (const n of collectGlobalsFrom(projectAmbientRoots(projectRoot), PROJECT_MAX_DEPTH)) names.add(n);
  return names;
}

let ambientCache = null;
let ambientCacheRoot = null;
function ambientGlobals(projectRoot) {
  const root = projectRoot || process.cwd();
  if (!ambientCache || ambientCacheRoot !== root) {
    ambientCache = readAmbientGlobals(root);
    ambientCacheRoot = root;
  }
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
 * **ΜΙΑ ΑΝΑΛΥΣΗ, ΔΥΟ ΑΠΑΝΤΗΣΕΙΣ** — «αναλύθηκε;» **και** «τι βρέθηκε;».
 *
 * ⚠️ Ο {@link findUnbound} επιστρέφει `[]` **και** για «καθαρό» **και** για «σπασμένη
 * σύνταξη». Ο καλών που θέλει να τα ξεχωρίσει (η πύλη: ένα αρχείο που δεν αναλύθηκε
 * **δεν είναι** καθαρό) θα έπρεπε αλλιώς να ξανα-αναλύσει — δηλαδή **δεύτερο parse σε
 * κάθε αρχείο**: μετρημένο **+18s** στα 15.296 αρχεία, για πληροφορία που η πρώτη
 * ανάλυση **είχε ήδη**.
 *
 * @returns {{parsed:boolean, unbound:{file:string,name:string,line:number}[]}}
 */
function scanFile(relPath, source, projectRoot) {
  const kind = relPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(relPath, source, ts.ScriptTarget.Latest, true, kind);
  if ((sf.parseDiagnostics || []).length) return { parsed: false, unbound: [] };
  return { parsed: true, unbound: collectUnbound(sf, relPath, projectRoot) };
}

/**
 * @returns {{file:string, name:string, line:number}[]} αδέσμευτα αναγνωριστικά
 */
function findUnbound(relPath, source, projectRoot) {
  return scanFile(relPath, source, projectRoot).unbound;
}

function collectUnbound(sf, relPath, projectRoot) {
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

module.exports = {
  scanFile, findUnbound, collectBindings, ambientGlobals, GLOBALS,
  // εκτεθειμένα ΓΙΑ ΤΙΣ ΑΓΚΥΡΕΣ: ο κανόνας «τι είναι καθολικό» πρέπει να ασκείται
  // απευθείας, αλλιώς μια αλλαγή του περνά κρυμμένη πίσω από 12.833 αρχεία.
  harvestGlobals, vendorTypeRoots, cacheFingerprint,
};
