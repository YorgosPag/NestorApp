/**
 * @fileoverview **ΟΙ ΓΡΑΜΜΕΣ ΠΟΥ ΑΛΛΑΖΕΙ ΜΙΑ ΑΛΛΑΓΗ** — «αγγίζει αυτή η αλλαγή τις γραμμές `start..end` του αρχείου `rel`;»
 * Ο «νέος κώδικας» του SonarQube (Clean as You Code) και του Tricorder της Google: μια πύλη κρίνει ό,τι **έγραψε**
 * αυτή η αλλαγή, όχι ό,τι **βρήκε** στο αρχείο που έτυχε να αγγίξει.
 * @module scripts/lib/git-changed-lines
 *
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (ADR-584 §9, 2026-10-30): το CHECK 3.28 `--diff` μπλόκαρε 19 ομάδες commit για κλώνους που ζούσαν
 *    ήδη στο HEAD — μετρημένο στο accounting: **20 από 22** κλώνοι προϋπήρχαν με ταυτόσημο κείμενο, και η μόνη αλλαγή
 *    στα αρχεία τους ήταν μία γραμμή `useTranslation` **έξω** από τον κλώνο. Η μόνη «διέξοδος» ήταν `SKIP_JSCPD_DIFF=1`.
 *
 * 🔑 Βάση σύγκρισης: `HEAD` (repo χωρίς commit ⇒ το κενό δέντρο: όλα νέα). `cached` ⇒ το ευρετήριο (ό,τι θα δεσμευτεί),
 *    αλλιώς ο δίσκος. Αρχείο **νέο** (`A`, ή untracked) ⇒ κάθε γραμμή του είναι αλλαγμένη.
 * 🔑 Καθαρή διαγραφή (`+c,0`) ⇒ αγγίζει τη **ραφή** `c..c+1`: η αφαίρεση μιας διαφορετικής γραμμής ενώνει δύο μισά σε
 *    κλώνο, χωρίς να προσθέσει ούτε μία γραμμή. Χωρίς αυτό, «σβήνω ό,τι τα ξεχώριζε» θα περνούσε ως «δεν έγραψα τίποτα».
 * ⚠️ Fail-closed: αρχείο που το git λέει αλλαγμένο αλλά δεν αναλύθηκε κανένα hunk του ⇒ «όλο αλλαγμένο», ποτέ «τίποτα».
 */

'use strict';

const { spawnSync } = require('node:child_process');
const { listTreeEntries, runGit: runGitRaw } = require('./git-index-snapshot');

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/** `core.quotepath=false`: αλλιώς κάθε μη-ASCII μονοπάτι βγαίνει σε εισαγωγικά με escapes και δεν ταιριάζει ποτέ. */
const runGit = (repoRoot, args) => runGitRaw(repoRoot, ['-c', 'core.quotepath=false', ...args]);

function resolveBase(repoRoot) {
  const head = spawnSync('git', ['rev-parse', '--verify', '-q', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
  return head.status === 0 ? 'HEAD' : EMPTY_TREE;
}

/** `+++ b/<μονοπάτι>` → μονοπάτι (το git βάζει TAB στο τέλος όταν το όνομα έχει κενό). `/dev/null` ⇒ `null`. */
function headerPath(line) {
  const raw = line.slice(4).replace(/\t$/, '');
  return raw === '/dev/null' ? null : raw.replace(/^b\//, '');
}

/**
 * Ανάλυση `git diff -U0` → `μονοπάτι → [αρχή, τέλος][]` στην αρίθμηση του **νέου** κειμένου.
 * ⚠️ Το `+++ ` διαβάζεται ΜΟΝΟ ως κεφαλίδα (μετά το `diff --git`): μια προστιθέμενη γραμμή με περιεχόμενο `++ x`
 *    εμφανίζεται ως `+++ x` μέσα στο σώμα και θα άλλαζε σιωπηλά το «τρέχον αρχείο».
 * @param {string} patch
 * @returns {Map<string, Array<[number, number]>>}
 */
function parseUnifiedZero(patch) {
  const ranges = new Map();
  let current = null;
  let inHeader = false;
  for (const line of patch.split(/\r?\n/)) {
    if (line.startsWith('diff --git ')) { inHeader = true; current = null; continue; }
    if (inHeader && line.startsWith('+++ ')) {
      inHeader = false;
      current = headerPath(line);
      if (current && !ranges.has(current)) ranges.set(current, []);
      continue;
    }
    const hunk = current && !inHeader ? HUNK.exec(line) : null;
    if (!hunk) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    ranges.get(current).push(count === 0 ? [start, start + 1] : [start, start + count - 1]);
  }
  return ranges;
}

/**
 * `--name-status -z` → { added, changed }. Μετονομασία (`R`/`C`) = αλλαγμένο με το ΝΕΟ όνομα, όχι νέο: το
 * περιεχόμενο που μετακόμισε δεν το «έγραψε» η αλλαγή.
 */
function parseNameStatus(output) {
  const added = new Set();
  const changed = new Set();
  const moved = new Set();
  const fields = output.split('\0').filter(Boolean);
  for (let i = 0; i < fields.length;) {
    const status = fields[i];
    const twoPaths = status.startsWith('R') || status.startsWith('C');
    const rel = twoPaths ? fields[i + 2] : fields[i + 1];
    i += twoPaths ? 3 : 2;
    changed.add(rel);
    if (status === 'A') added.add(rel);
    if (twoPaths) moved.add(rel);
  }
  return { added, changed, moved };
}

/**
 * @param {{repoRoot: string, paths: string[], cached?: boolean}} options `paths` = σχετικά posix μονοπάτια
 * @returns {{touches: (rel: string, start: number, end: number) => boolean, base: string}}
 */
function createChangedLineIndex({ repoRoot, paths, cached = false }) {
  const base = resolveBase(repoRoot);
  // ⚠️ ΧΩΡΙΣ pathspec, επίτηδες (μετρημένο): περιορισμένο στο νέο όνομα, το git δεν βλέπει το παλιό ⇒ η μετονομασία
  //    γίνεται «προσθήκη» και κάθε μετακομισμένη γραμμή «νέα». Το diff όλης της αλλαγής είναι μικρό (-U0)· και έτσι
  //    κανένα ENAMETOOLONG με εκατοντάδες αρχεία.
  const diffArgs = ['diff', ...(cached ? ['--cached'] : []), '--no-color', '--no-ext-diff', '-M', base];
  const { added, changed, moved } = parseNameStatus(runGit(repoRoot, [...diffArgs, '--name-status', '-z']));
  const ranges = parseUnifiedZero(runGit(repoRoot, [...diffArgs, '-U0']));
  // Τα tracked στη βάση (SSoT `listTreeEntries`) — ό,τι λείπει είναι untracked ή νέο.
  const tracked = (base === EMPTY_TREE ? null : listTreeEntries({ repoRoot, rev: base, paths })) || new Map();
  const touches = (rel, start, end) => {
    if (added.has(rel)) return true;
    if (!changed.has(rel)) return !tracked.has(rel);   // untracked ⇒ νέο· tracked χωρίς αλλαγή ⇒ τίποτα
    const list = ranges.get(rel);
    // Καθαρή μετακίνηση (R100) = κανένα hunk, και σωστά: δεν γράφτηκε τίποτα. Αλλιώς «άλλαξε, κανένα hunk» ⇒ fail-closed.
    if (!list || list.length === 0) return !moved.has(rel);
    return list.some(([from, to]) => from <= end && to >= start);
  };
  return { touches, base };
}

module.exports = { createChangedLineIndex, parseUnifiedZero, parseNameStatus, EMPTY_TREE };
