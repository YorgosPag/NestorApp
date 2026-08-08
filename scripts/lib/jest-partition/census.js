#!/usr/bin/env node
/**
 * **Η ΑΠΟΓΡΑΦΗ**: κάθε αρχείο test του δέντρου, σε **ακριβώς μία** ρητή κατάσταση.
 *
 * Το κριτήριο είναι μία πρόταση: *κάθε tracked αρχείο test ανήκει σε **ακριβώς έναν**
 * εκτελεστή — όχι 0, όχι 2+.*
 *
 * ## ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΑ ΜΕΓΑΛΑ ΕΡΓΑΛΕΙΑ
 * | | «όχι 2×»; | «όχι 0»; |
 * |---|---|---|
 * | **Bazel / Buck2** | ✅ δηλωμένη ιδιοκτησία | ❌ αρχείο εκτός BUILD απλώς **δεν υπάρχει** |
 * | **Jest `projects`** | ❌ σιωπηλή επικάλυψη ([#14019](https://github.com/jestjs/jest/issues/14019), *closed as not planned*) | ❌ |
 * | **εδώ** | ✅ | ✅ **κλειστή λογιστική** |
 *
 * Το «**όχι 0**» δεν είναι θεωρητικό: είναι το μάθημα που πλήρωσε το CHECK 3.46 — **369 tests
 * σε 5 αρχεία** που δεν εκτελούσε **κανένα** workflow, με όλες τις πύλες πράσινες.
 *
 * ## ΓΙΑΤΙ ΟΧΙ RATCHET
 * Δεν υπάρχει «λιγότερα διπλοεκτελούμενα από χθες». Και τα 21 ευρήματα διορθώνονται στο ίδιο
 * commit, οπότε μια baseline θα **κλείδωνε** το ελάττωμα αντί να το λύσει.
 *
 * @module scripts/lib/jest-partition/census
 */

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { PROJECT_ROOT, toPosix } = require('./jest-configs');
const { allExecutors } = require('./executors');

/** Το σχήμα ονόματος που κάνει ένα αρχείο «test» για οποιονδήποτε από τους εκτελεστές. */
const TEST_SHAPED = /\.(test|spec)\.[jt]sx?$/;

/**
 * Οι μόνοι φάκελοι που δεν διασχίζονται. **Δεν είναι λίστα πολιτικής** — είναι τα δύο σημεία
 * που δεν ανήκουν στο δέντρο πηγής με κανένα κριτήριο. Κάθε άλλος φάκελος διασχίζεται, ακόμη
 * κι αν τον αγνοεί το git: το να **μη δεις** ένα build artifact είναι ακριβώς το ελάττωμα.
 */
const NEVER_TRAVERSED = new Set(['node_modules', '.git']);

/** ⛔ Οι καταστάσεις που μπλοκάρουν. */
const VIOLATION_STATES = ['multi-owned', 'build-artifact', 'unowned'];

/** ✅ Οι καταστάσεις που είναι νόμιμες — απαριθμούνται ώστε καμία να μην είναι σιωπηλή. */
const LEGITIMATE_STATES = [
  'jest-owned',
  'playwright-owned',
  'jest-owned-untracked',
  'untracked-unowned',
  'ignored-not-run',
];

const ALL_STATES = [...VIOLATION_STATES, ...LEGITIMATE_STATES];

/** Κάθε test-shaped αρχείο που υπάρχει στον δίσκο. */
function walkTestShaped(root) {
  const found = [];
  const visit = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (NEVER_TRAVERSED.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (TEST_SHAPED.test(entry.name)) found.push(toPosix(full));
    }
  };
  visit(root);
  return found;
}

/**
 * Ό,τι γνωρίζει το git ως **παρακολουθούμενο** — δηλαδή και το **σταδιοποιημένο**.
 *
 * ⚠️ Αυτό είναι που κλείνει την πόρτα διαφυγής: ένα νέο αρχείο test δεν μπορεί να μπει στο
 * repo χωρίς `git add`, και μόλις μπει στο index το βλέπει η πύλη. Άρα το «άφησέ το untracked
 * για να μη σε κρίνουν» δεν φτάνει ποτέ σε commit.
 */
function trackedFiles(root) {
  const out = cp.execSync('git ls-files', { cwd: root, maxBuffer: 1024 * 1024 * 512 }).toString();
  return new Set(out.split('\n').filter(Boolean).map((rel) => `${toPosix(root)}/${toPosix(rel)}`));
}

/** Ποια από τα δοθέντα αρχεία αγνοεί το git — **μία** κλήση, με stdin. */
function gitIgnoredAmong(root, absoluteFiles) {
  if (absoluteFiles.length === 0) return new Set();
  const input = absoluteFiles.join('\n');
  let stdout = '';
  try {
    stdout = cp.execSync('git check-ignore --stdin', {
      cwd: root,
      input,
      maxBuffer: 1024 * 1024 * 64,
    }).toString();
  } catch (error) {
    // exit code 1 = «κανένα δεν αγνοείται»· οτιδήποτε άλλο είναι πραγματικό σφάλμα
    if (error.status !== 1) throw error;
    stdout = error.stdout ? error.stdout.toString() : '';
  }
  return new Set(stdout.split('\n').filter(Boolean).map((line) => toPosix(line.trim())));
}

/**
 * Η κατάσταση ενός αρχείου. **Η σειρά είναι το συμβόλαιο**, όχι λεπτομέρεια υλοποίησης:
 * ένα build artifact κρίνεται ως τέτοιο **πριν** ρωτηθεί από πόσους διεκδικείται, γιατί η
 * θεραπεία είναι η ίδια (να μην το βλέπει κανείς) όσοι κι αν το διεκδικούν.
 */
function classify({ owners, tracked, ignored }) {
  if (ignored) return owners.length > 0 ? 'build-artifact' : 'ignored-not-run';
  if (owners.length > 1) return 'multi-owned';
  if (owners.length === 1) {
    if (owners[0].kind === 'playwright') return 'playwright-owned';
    return tracked ? 'jest-owned' : 'jest-owned-untracked';
  }
  return tracked ? 'unowned' : 'untracked-unowned';
}

/**
 * Η πλήρης απογραφή, με **κλειστή λογιστική**.
 *
 * Το άθροισμα των κάδων **πρέπει** να ισούται με το πλήθος των αρχείων· διαφορετικά πετάει.
 * Η λογιστική είναι το όργανο που εγγυάται ότι κανένα αρχείο δεν χάνεται σιωπηλά — δεν
 * επιτρέπεται να χαθεί **η ίδια** σιωπηλά (μάθημα CHECK 3.39 §Κ15β).
 */
function buildCensus(root = PROJECT_ROOT) {
  const rootPosix = toPosix(root).replace(/\/+$/, '');
  const executors = allExecutors(root);
  const tracked = trackedFiles(root);

  const onDisk = walkTestShaped(root);
  const universe = [...new Set([...onDisk, ...[...tracked].filter((f) => TEST_SHAPED.test(f))])].sort();

  const untracked = universe.filter((file) => !tracked.has(file));
  const ignored = gitIgnoredAmong(root, untracked);

  const byState = Object.fromEntries(ALL_STATES.map((state) => [state, []]));
  for (const file of universe) {
    const owners = executors.filter((executor) => executor.claims(file));
    const state = classify({ owners, tracked: tracked.has(file), ignored: ignored.has(file) });
    if (byState[state] === undefined) {
      throw new Error(`[jest-partition] Άγνωστη κατάσταση «${state}» για το «${file}».`);
    }
    byState[state].push({
      file: file.startsWith(`${rootPosix}/`) ? file.slice(rootPosix.length + 1) : file,
      owners: owners.map((executor) => executor.id),
    });
  }

  const counted = ALL_STATES.reduce((sum, state) => sum + byState[state].length, 0);
  if (counted !== universe.length) {
    throw new Error(
      `[jest-partition] Η λογιστική δεν κλείνει: ${counted} καταγεγραμμένα σε ${universe.length} ` +
        'αρχεία. Κάποιο αρχείο χάθηκε — η πύλη σταματά αντί να αναφέρει λιγότερα.',
    );
  }

  return {
    total: universe.length,
    executors: executors.map((executor) => ({ id: executor.id, kind: executor.kind })),
    byState,
    violations: VIOLATION_STATES.flatMap((state) =>
      byState[state].map((entry) => ({ state, ...entry })),
    ),
  };
}

module.exports = {
  ALL_STATES,
  LEGITIMATE_STATES,
  NEVER_TRAVERSED,
  TEST_SHAPED,
  VIOLATION_STATES,
  buildCensus,
  classify,
  gitIgnoredAmong,
  trackedFiles,
  walkTestShaped,
};
