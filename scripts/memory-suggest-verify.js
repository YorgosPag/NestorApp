#!/usr/bin/env node
/**
 * memory-suggest-verify.js — προτείνει `verify:` εντολές για memories που δεν έχουν.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: το `verify:` είναι ο λόγος που η μνήμη εδώ ξεπερνά τα Zep/Letta/Mem0 —
 * αντί να **μαντεύει** παλαιότητα με timestamps, **εκτελεί** έναν ισχυρισμό. Αλλά ένα
 * memory χωρίς `verify:` σαπίζει σιωπηλά. Ο generator της Φ2 ήταν throwaway script· αυτό
 * είναι το μόνιμο εργαλείο, γιατί η δουλειά επαναλαμβάνεται σε κάθε νέα παρτίδα memories.
 *
 * ΜΕΘΟΔΟΣ (και οι δύο παγίδες της Φ2 κλεισμένες):
 *   1. Από κάθε memory βγάζει backticked `identifier` και `αρχείο.ts`.
 *   2. Το basename λύνεται σε **μοναδικό** repo path μέσω `git ls-files` — αν ταιριάζουν
 *      πολλά αρχεία, απορρίπτεται (ασαφής ισχυρισμός = άχρηστος ισχυρισμός).
 *   3. Ο έλεγχος γίνεται **in-process** (`src.includes(id)`), ΟΧΙ `execSync` ανά υποψήφιο:
 *      χιλιάδες bash spawns στα Windows = >2 λεπτά. Ένα `git ls-files`, μία ανάγνωση/αρχείο.
 *
 * ΦΙΛΤΡΟ ΔΙΑΚΡΙΤΟΤΗΤΑΣ (κρίσιμο): ένα check που θα περνούσε ούτως ή άλλως δεν αποδεικνύει
 * τίποτα — είναι **θόρυβος που μοιάζει με κάλυψη**. Δεκτά μόνο CONSTANT_CASE ≥8 ή
 * camelCase ≥16 χαρακτήρων, με blacklist κοινών ονομάτων.
 *
 * Χρήση:
 *   node scripts/memory-suggest-verify.js           # dry-run: τι θα πρότεινε
 *   node scripts/memory-suggest-verify.js --write   # γράφει το `verify:` στο frontmatter
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const store = require('./lib/memory/memory-store');

const REPO = path.resolve(__dirname, '..');

/**
 * Ονόματα που υπάρχουν παντού — ένα grep πάνω τους δεν αποδεικνύει τίποτα.
 *
 * ⚠️ ΜΟΝΟ ονόματα που **περνούν** τα φίλτρα σχήματος/μήκους παρακάτω. Μια πρώτη
 * εκδοχή αυτής της λίστας είχε `useState`, `position`, `className` — όλα κόβονται
 * ήδη από το μήκος (<16 camelCase), άρα η λίστα ήταν **νεκρός κώδικας**: το mutation
 * test «σβήσε το blacklist» περνούσε πράσινο. Ό,τι μπαίνει εδώ πρέπει να είναι
 * CONSTANT_CASE ≥8 ή camelCase ≥16 — αλλιώς δεν φυλάει τίποτα.
 */
const BLACKLIST = new Set([
  // CONSTANT_CASE ≥8 που ζουν σε κάθε repo
  'NODE_ENV', 'PUBLIC_URL', 'MAX_SAFE_INTEGER', 'MIN_SAFE_INTEGER',
  'POSITIVE_INFINITY', 'NEGATIVE_INFINITY',
  // DOM/platform API ≥16 χαρακτήρων — υπάρχουν σε εκατοντάδες αρχεία
  'addEventListener', 'removeEventListener', 'getBoundingClientRect',
  'requestAnimationFrame', 'cancelAnimationFrame', 'querySelectorAll',
  'toLocaleDateString', 'toLocaleTimeString', 'getElementsByTagName',
]);

const MIN_CONST = 8;
const MIN_CAMEL = 16;

/**
 * Είναι αρκετά διακριτό ώστε ένα grep πάνω του να σημαίνει κάτι;
 * CONSTANT_CASE ≥8 (π.χ. GRIP_SIZE_DEFAULT) ή camelCase/PascalCase ≥16.
 */
function isDistinctive(id) {
  if (BLACKLIST.has(id)) return false;
  if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(id)) return id.length >= MIN_CONST;
  if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(id) && /[a-z][A-Z]/.test(id)) return id.length >= MIN_CAMEL;
  return false;
}

/** basename → μοναδικό repo path. Πολλαπλά ταιριάσματα = ασαφές, το πετάμε. */
function buildFileIndex() {
  const out = execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const byBase = new Map();
  for (const rel of out.split('\n')) {
    if (!rel || !/\.(ts|tsx|js|jsx|json|rules)$/.test(rel)) continue;
    const base = path.basename(rel);
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(rel);
  }
  return new Map([...byBase].filter(([, v]) => v.length === 1).map(([k, v]) => [k, v[0]]));
}

/** Backticked tokens: `foo.ts`, `BAR_BAZ`, `someLongIdentifier` — χωρίς πρόζα. */
function backtickedTokens(text) {
  return [...text.matchAll(/`([^`\n]{2,80})`/g)].map((m) => m[1].trim());
}

const readSource = (() => {
  const cache = new Map();
  return (rel) => {
    if (!cache.has(rel)) {
      try {
        cache.set(rel, fs.readFileSync(path.join(REPO, rel), 'utf8'));
      } catch {
        cache.set(rel, null);
      }
    }
    return cache.get(rel);
  };
})();

/**
 * Ζευγάρι (αρχείο, identifier) που **αποδεδειγμένα** συνυπάρχουν αυτή τη στιγμή.
 * Επιστρέφει null αν δεν βρεθεί ζεύγος που να επαληθεύεται ΤΩΡΑ — δεν προτείνουμε
 * ποτέ ισχυρισμό που είναι ήδη ψευδής (θα γεννούσε κόκκινο gate από την πρώτη μέρα).
 */
function findClaim(slug, fileIndex) {
  const tokens = backtickedTokens(store.readRaw(slug));
  const files = tokens.filter((t) => fileIndex.has(path.basename(t))).map((t) => fileIndex.get(path.basename(t)));
  const ids = tokens.filter(isDistinctive);
  for (const rel of [...new Set(files)]) {
    const src = readSource(rel);
    if (!src) continue;
    for (const id of ids) {
      if (src.includes(id)) return { rel, id };
    }
  }
  return null;
}

// ── main ────────────────────────────────────────────────────────────────────

/** Το φίλτρο είναι pure και είναι ΟΛΗ η επιφάνεια ρίσκου → εκτίθεται για presubmit. */
module.exports = { isDistinctive, backtickedTokens, MIN_CONST, MIN_CAMEL };

/** Συλλέγει τα memories χωρίς `verify:` για τα οποία υπάρχει επαληθεύσιμος ισχυρισμός. */
function collectSuggestions(slugs, fileIndex) {
  let had = 0;
  const found = [];
  for (const slug of slugs) {
    if (store.splitFrontmatter(store.readRaw(slug))?.frontmatter.match(/^\s*verify:/m)) {
      had++;
      continue;
    }
    const claim = findClaim(slug, fileIndex);
    if (claim) found.push({ slug, ...claim });
  }
  return { had, found };
}

function main() {
  if (!store.memoryDirExists()) {
    console.log(`⏭️  skip — δεν υπάρχει ${store.MEMORY_DIR}`);
    return 0;
  }
  const slugs = [...store.listSlugs()].sort();
  const { had, found } = collectSuggestions(slugs, buildFileIndex());

  console.log(`\n🔬 ΠΡΟΤΑΣΕΙΣ verify:  ${found.length} νέες  (είχαν ήδη: ${had} / ${slugs.length})\n`);
  for (const { slug, rel, id } of found) {
    console.log(`  ${slug}\n     grep -q '${id}' ${rel}`);
  }

  if (!process.argv.includes('--write')) {
    console.log('\n  Dry-run. Εφαρμογή: node scripts/memory-suggest-verify.js --write\n');
    return 0;
  }

  let written = 0;
  for (const { slug, rel, id } of found) {
    const updated = store.upsertField(store.readRaw(slug), 'verify', `"grep -q '${id}' ${rel}"`);
    if (updated) {
      store.writeRaw(slug, updated);
      written++;
    }
  }
  console.log(`\n  ✅ γράφτηκαν ${written} / ${found.length}\n`);
  return 0;
}

if (require.main === module) process.exit(main());
