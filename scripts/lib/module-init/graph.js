/**
 * ADR-858 Δ4 — Ο ΓΡΑΦΟΣ ΕΙΣΑΓΩΓΩΝ, ΜΕ ΤΗ ΜΗΧΑΝΗ ΕΠΙΛΥΣΗΣ ΤΗΣ ΠΑΡΑΓΩΓΗΣ.
 *
 * 🔴 **ΓΙΑΤΙ ΔΕΝ ΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ ΤΟ dependency-cruiser ΕΔΩ.** Εκείνο απαντά «υπάρχει
 * κύκλος;» και η απάντησή του είναι **1159**. Αυτή η πύλη ρωτά **«θα σκάσει;»**, και
 * χρειάζεται κάτι που ο γράφος του depcruise δεν κουβαλά: **ποια ονόματα** περνά κάθε ακμή
 * και **πού χρησιμοποιούνται**. Δεύτερος λόγος, βαρύτερος: το `.dependency-cruiser.cjs`
 * είχε λάθος σειρά επεκτάσεων επί μήνες (ADR-858 §3.1) — μια πύλη που κληρονομεί τη μηχανή
 * επίλυσης άλλου εργαλείου κληρονομεί και τα τυφλά του σημεία.
 *
 * ⚠️ **Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟΥ NEXT.JS** και ζει σε ΕΝΑ σημείο: `check-shadowed-modules.js`
 * (CHECK 3.79). Δεύτερο αντίγραφο εδώ θα ήταν ακριβώς η δεύτερη αυθεντία που αποκλίνει
 * σιωπηλά — άγκυρα το επιβάλλει.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { RESOLVE_ORDER } = require('../../check-shadowed-modules');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC = path.join(PROJECT_ROOT, 'src');

const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', 'dist', 'coverage', '__snapshots__',
  'archive', 'patches', 'test.BACK', '__tests__', 'e2e',
]);

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

const isTestFile = (f) => /\.(test|spec|e2e\.spec|stories)\.[jt]sx?$/.test(f);

function collectSourceFiles(dir = SRC, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectSourceFiles(full, out);
    } else if (CODE_EXT.has(path.extname(entry.name)) && !isTestFile(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Επιλύει έναν specifier σε απόλυτο μονοπάτι αρχείου — **ακριβώς** όπως το webpack:
 * αρχείο πριν από φάκελο, και μέσα στο καθένα η σειρά `RESOLVE_ORDER`.
 */
function resolveSpecifier(spec, fromFile, existing) {
  let base;
  if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else return null; // πακέτο — εκτός γράφου

  if (existing.has(base) && CODE_EXT.has(path.extname(base))) return base;
  for (const ext of RESOLVE_ORDER) {
    const candidate = base + ext;
    if (existing.has(candidate)) return candidate;
  }
  for (const ext of RESOLVE_ORDER) {
    const candidate = path.join(base, `index${ext}`);
    if (existing.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Αφαιρεί σχόλια — **σεβόμενο strings και template literals**.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ: 5 ΣΤΑ 6 ΕΥΡΗΜΑΤΑ ΗΤΑΝ ΣΧΟΛΙΑ.** Χωρίς αυτό, το JSDoc παράδειγμα
 * χρήσης που γράφει κάθε καλό component —
 * `* @example import { Spinner } from '@/components/ui/spinner';` — γινόταν **πραγματική
 * ακμή** στον γράφο, και το αρχείο κατηγορούνταν ότι εισάγει **τον εαυτό του** από το
 * barrel του. Δηλαδή η πύλη τιμωρούσε **ακριβώς** τα αρχεία που είναι καλά τεκμηριωμένα.
 *
 * ⚠️ **ΜΗΝ το αντικαταστήσεις με σκέτο `replace(/\\/\\*[\\s\\S]*?\\*\\//g, '')`**: ένα
 * `'...//...'` ή ένα `` `${x}//y` `` μέσα σε συμβολοσειρά θα έκοβε κώδικα. Ο σαρωτής
 * παρακολουθεί κατάσταση — είναι ο λόγος που δεν είναι μονόγραμμο regex.
 */
function stripComments(src) {
  let out = '';
  let i = 0;
  let state = 'code'; // code | line | block | sq | dq | tpl
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (state === 'code') {
      if (c === '/' && next === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && next === '*') { state = 'block'; i += 2; continue; }
      if (c === "'") state = 'sq';
      else if (c === '"') state = 'dq';
      else if (c === '`') state = 'tpl';
      out += c; i++; continue;
    }
    if (state === 'line') { if (c === '\n') { state = 'code'; out += c; } i++; continue; }
    if (state === 'block') { if (c === '*' && next === '/') { state = 'code'; i += 2; } else { if (c === '\n') out += c; i++; } continue; }
    // μέσα σε συμβολοσειρά: escape σεβαστό, τίποτα δεν κόβεται
    if (c === '\\') { out += c + (next ?? ''); i += 2; continue; }
    if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"') || (state === 'tpl' && c === '`')) state = 'code';
    out += c; i++;
  }
  return out;
}

/**
 * Οι **runtime** εισαγωγές ενός αρχείου, με τα τοπικά ονόματα που φέρνει κάθε μία.
 *
 * ⚠️ **Τα type-only imports ΔΕΝ μετράνε** — σβήνονται στη μεταγλώττιση, άρα δεν δημιουργούν
 * ούτε ακμή ούτε TDZ. Φιλτράρονται **δύο** μορφές: `import type { X }` (όλη η δήλωση) και
 * `import { type X, Y }` (ανά όνομα). Χωρίς αυτό, ο γράφος γεμίζει ακμές που δεν υπάρχουν
 * σε χρόνο εκτέλεσης — ψευδώς θετικά που θα έκαναν την πύλη θόρυβο.
 */
function parseImports(file, rawText) {
  const text = stripComments(rawText);
  const imports = [];
  // `import ... from 'x'` (named/default/namespace) — η μόνη μορφή που φέρνει bindings.
  const RE = /import\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/g;
  for (const m of text.matchAll(RE)) {
    const [, typeOnly, clause, spec] = m;
    if (typeOnly) continue; // `import type { … } from` ⇒ μηδέν runtime
    const names = [];
    const braced = clause.match(/\{([^}]*)\}/);
    if (braced) {
      for (const part of braced[1].split(',')) {
        const piece = part.trim();
        if (!piece || /^type\s/.test(piece)) continue; // inline `type X`
        const asMatch = piece.match(/\s+as\s+(\w+)$/);
        names.push(asMatch ? asMatch[1] : piece.split(/\s/)[0]);
      }
    }
    const bare = clause.replace(/\{[^}]*\}/, '').replace(/,/g, ' ').trim();
    for (const piece of bare.split(/\s+/)) {
      if (!piece) continue;
      const ns = piece.match(/^\*\s*as\s*(\w+)$/) || clause.match(/\*\s*as\s*(\w+)/);
      if (ns) { names.push(ns[1]); continue; }
      if (/^\w+$/.test(piece)) names.push(piece); // default import
    }
    imports.push({ spec, names: [...new Set(names)] });
  }
  // Side-effect import: ακμή χωρίς ονόματα (δεν μπορεί να γεννήσει TDZ, αλλά γεννά κύκλο).
  for (const m of text.matchAll(/import\s+['"]([^'"]+)['"]/g)) {
    imports.push({ spec: m[1], names: [] });
  }
  // 🔴 RE-EXPORTS — `export { X } from './y'` · `export * from './y'`.
  //
  // **ΤΟ ΚΕΝΟ ΠΟΥ ΕΚΑΝΕ ΤΗΝ ΠΥΛΗ ΣΧΟΛΙΟ, ΠΙΑΣΜΕΝΟ ΜΕ ΜΕΤΑΛΛΑΞΗ.** Η πρώτη γραφή διάβαζε
  // μόνο `import` και έμεινε **στον ίδιο αριθμό** όταν το αρχικό ελάττωμα επαναφέρθηκε
  // τεχνητά — δηλαδή θα γεννιόταν **αδύνατη να πυροδοτήσει** πάνω στο περιστατικό που τη
  // γέννησε. Αιτία: το `debug/index.tsx` ήταν **ΟΛΟ** re-exports, άρα **καμία** από τις
  // ακμές του barrel δεν υπήρχε στον γράφο — και χωρίς αυτές δεν σχηματιζόταν το SCC.
  //
  // Ένα re-export **φορτώνει** το module (δεν είναι δήλωση τύπου): γεννά ακμή, άρα γεννά
  // κύκλο. Δεν φέρνει τοπικό binding στο αρχείο που το γράφει, γι' αυτό `names: []` — η
  // ακμή μετράει για το SCC, όχι για ανάγνωση σε χρόνο αξιολόγησης.
  for (const m of text.matchAll(/export\s+(type\s+)?(?:\*|\{[^}]*\})(?:\s+as\s+\w+)?\s*from\s*['"]([^'"]+)['"]/g)) {
    if (m[1]) continue; // `export type { … } from` ⇒ σβήνεται
    imports.push({ spec: m[2], names: [] });
  }
  return imports;
}

/** Χτίζει τον γράφο: `file → [{ to, names }]`. */
function buildGraph() {
  const files = collectSourceFiles();
  const existing = new Set(files);
  const graph = new Map();
  const sources = new Map();

  for (const file of files) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    sources.set(file, text);
    const edges = [];
    for (const { spec, names } of parseImports(file, text)) {
      const to = resolveSpecifier(spec, file, existing);
      if (to && to !== file) edges.push({ to, names });
    }
    graph.set(file, edges);
  }
  return { graph, sources, files };
}

/**
 * Tarjan — **ισχυρά συνεκτικές συνιστώσες**.
 *
 * 🔑 **ΓΙΑΤΙ SCC ΚΑΙ ΟΧΙ ΑΠΑΡΙΘΜΗΣΗ ΚΥΚΛΩΝ**: ο αριθμός των *απλών κύκλων* ενός γράφου
 * είναι εκθετικός — το depcruise αναφέρει **1159** επειδή μετρά *ακμές* που ανήκουν σε
 * κύκλο, όχι κύκλους. Το SCC δίνει το **σωστό αντικείμενο**: μια ομάδα αρχείων μέσα στην
 * οποία **κάθε** αρχείο φτάνει κάθε άλλο, δηλαδή ακριβώς το σύνολο όπου η σειρά
 * αξιολόγησης δεν είναι εγγυημένη. Και είναι **γραμμικό**.
 */
function findSCCs(graph) {
  let index = 0;
  const idx = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const sccs = [];

  // Ρητά επαναληπτικό: το `src/` έχει >16.000 κόμβους και η αναδρομή σκάει το stack.
  for (const root of graph.keys()) {
    if (idx.has(root)) continue;
    const work = [{ node: root, edge: 0 }];
    idx.set(root, index); low.set(root, index); index++;
    stack.push(root); onStack.add(root);

    while (work.length > 0) {
      const frame = work[work.length - 1];
      const edges = graph.get(frame.node) || [];
      if (frame.edge < edges.length) {
        const next = edges[frame.edge++].to;
        if (!idx.has(next)) {
          idx.set(next, index); low.set(next, index); index++;
          stack.push(next); onStack.add(next);
          work.push({ node: next, edge: 0 });
        } else if (onStack.has(next)) {
          low.set(frame.node, Math.min(low.get(frame.node), idx.get(next)));
        }
      } else {
        work.pop();
        if (work.length > 0) {
          const parent = work[work.length - 1].node;
          low.set(parent, Math.min(low.get(parent), low.get(frame.node)));
        }
        if (low.get(frame.node) === idx.get(frame.node)) {
          const component = [];
          let w;
          do { w = stack.pop(); onStack.delete(w); component.push(w); } while (w !== frame.node);
          if (component.length > 1) sccs.push(component);
        }
      }
    }
  }
  return sccs;
}

module.exports = { buildGraph, findSCCs, resolveSpecifier, parseImports, stripComments, collectSourceFiles, PROJECT_ROOT, SRC };
