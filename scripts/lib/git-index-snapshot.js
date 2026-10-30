/**
 * @fileoverview **ΤΟ ΣΤΙΓΜΙΟΤΥΠΟ ΤΟΥ COMMIT** — τα αρχεία του ευρετηρίου (index) υλοποιημένα
 * σε προσωρινό φάκελο, ώστε μια πύλη pre-commit να κρίνει **ό,τι θα μπει στο commit**,
 * όχι ό,τι τυχαίνει να βρίσκεται στο working tree.
 * @module scripts/lib/git-index-snapshot
 *
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (2026-09-27, CHECK 3.34): σε δέντρο με πολλούς παράλληλους πράκτορες,
 * ένα commit **που δεν άγγιζε κανένα locale** (μετακόμιση `easing`) μπλοκαρίστηκε επειδή
 * **ξένες, αστάδιοποίητες** αλλαγές στο `admin.json` έκαναν το working tree να αποκλίνει από
 * το `shell-slice`. Η πύλη έκρινε λάθος αντικείμενο: το commit ήταν συνεπές, ο δίσκος όχι.
 *
 * 🔑 Γιατί `checkout-index` και όχι `git show :path` ανά αρχείο: ένα spawn για όλο το σύνολο
 * (εκατοντάδες locales) αντί για ένα ανά αρχείο· και οι βιβλιοθήκες μένουν **αμετάβλητες** —
 * διαβάζουν από `projectRoot` όπως πάντα, απλώς η ρίζα είναι το στιγμιότυπο.
 * Αρχείο που **δεν** είναι στο index (untracked / διαγραμμένο-και-σταδιοποιημένο) **λείπει**
 * από το στιγμιότυπο — ακριβώς όπως θα λείπει από το commit.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MAX_BUFFER = 64 * 1024 * 1024;

function runGit(repoRoot, args, input) {
  const result = spawnSync('git', args, {
    cwd: repoRoot, input, encoding: 'utf8', maxBuffer: MAX_BUFFER, stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} απέτυχε (${result.status}): ${(result.stderr || '').trim()}`);
  }
  return result.stdout;
}

/**
 * @param {{repoRoot: string, pathspecs: string[], into?: string, rawBytes?: boolean}} options pathspecs = αρχεία ή φάκελοι,
 *   σχετικοί με τη ρίζα. `into` = ΥΠΑΡΧΟΝ στιγμιότυπο που συμπληρώνεται (ADR-744 §32.12: το CHECK 3.51
 *   μαθαίνει ποια modules χρειάζεται μόνο ΑΦΟΥ διαβάσει config/aliases από το ίδιο στιγμιότυπο)· τότε το
 *   `dispose` δεν σβήνει τίποτα — ανήκει σε όποιον το δημιούργησε.
 * @returns {{root: string, files: string[], dispose: () => void}}
 */
function materializeIndex({ repoRoot, pathspecs, into, rawBytes = false }) {
  // ⚠️ Τα pathspecs ΔΕΝ περνούν ως ορίσματα: ~900 αρχεία κλειστότητας (CHECK 3.51) = ENAMETOOLONG στα Windows.
  // Μία `ls-files` για όλο το ευρετήριο (~30k, μετρημένο <1s) και φίλτρο εδώ: ακριβές αρχείο ή πρόθεμα φακέλου.
  const exact = new Set(pathspecs.map(spec => spec.replace(/\\/g, '/').replace(/\/+$/, '')));
  const underSpec = file => {
    for (let at = file.lastIndexOf('/'); at > 0; at = file.lastIndexOf('/', at - 1)) {
      if (exact.has(file.slice(0, at))) return true;
    }
    return false;
  };
  const files = exact.size === 0
    ? []
    : runGit(repoRoot, ['ls-files', '-z', '--cached']).split('\0').filter(f => f && (exact.has(f) || underSpec(f)));
  const root = into || fs.mkdtempSync(path.join(os.tmpdir(), 'git-index-snapshot-'));
  const dispose = into ? () => {} : () => fs.rmSync(root, { recursive: true, force: true });
  try {
    if (files.length > 0) {
      const prefix = `${root.replace(/\\/g, '/')}/`;
      // `rawBytes` (ADR-924): τα bytes του blob αυτούσια — χωρίς αυτό, με `core.autocrlf=true` ένα LF αρχείο
      // γράφεται CRLF και μια πύλη που συγκρίνει bytes (CHECK 3.85: παγωμένες εκδόσεις, παραγόμενο ευρετήριο)
      // κρίνει κάτι που ΔΕΝ θα δεσμευτεί. Μετρημένο: 7 ψευδή ευρήματα.
      const eol = rawBytes ? ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf'] : [];
      runGit(repoRoot, [...eol, 'checkout-index', '-f', '-z', '--stdin', `--prefix=${prefix}`], `${files.join('\0')}\0`);
    }
  } catch (error) {
    dispose();
    throw error;
  }
  return { root, files, dispose };
}

/**
 * Γράφει περιεχόμενο **μόνο στο ευρετήριο** (`hash-object -w` + `update-index --cacheinfo`) — ο δίσκος μένει
 * ανέγγιχτος. Για παραγόμενα αρχεία των οποίων το αντίγραφο στον δίσκο κουβαλά **ξένη** αστάδιοποίητη δουλειά:
 * το commit παίρνει ό,τι γεννιέται από το ευρετήριο, και κανείς δεν χάνει τίποτα.
 * @param {{repoRoot: string, relPath: string, content: string}} options
 */
function writeIndexBlob({ repoRoot, relPath, content }) {
  const sha = runGit(repoRoot, ['hash-object', '-w', '--stdin', '--path', relPath], content).trim();
  runGit(repoRoot, ['update-index', '--add', '--cacheinfo', `100644,${sha},${relPath}`]);
  return sha;
}

/**
 * Το κείμενο ενός αρχείου **όπως είναι στο ευρετήριο** (`git show :path`), ή `null` αν δεν υπάρχει εκεί.
 * @param {{repoRoot: string, relPath: string}} options
 */
function readIndexText({ repoRoot, relPath }) {
  const result = spawnSync('git', ['show', `:${relPath}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: MAX_BUFFER });
  if (result.error) throw result.error;
  return result.status === 0 ? result.stdout : null;
}

/**
 * ADR-744 §31 — `μονοπάτι → blob sha` για κάθε εγγραφή του ευρετηρίου (stage 0). **Δωρεάν**
 * διεύθυνση περιεχομένου: το git έχει ήδη κατακερματίσει κάθε αρχείο που θα μπει στο commit.
 * @param {{repoRoot: string}} options
 * @returns {Map<string, string>}
 */
function listIndexEntries({ repoRoot }) {
  const entries = new Map();
  for (const record of runGit(repoRoot, ['ls-files', '-s', '-z']).split('\0')) {
    const tab = record.indexOf('\t');
    if (tab < 0) continue;
    const [, sha, stage] = record.slice(0, tab).split(' ');
    if (stage === '0') entries.set(record.slice(tab + 1), sha);
  }
  return entries;
}

/**
 * Τα αρχεία των οποίων το working tree **αποκλίνει** από το ευρετήριο (αλλαγμένα ή σβησμένα,
 * αστάδιοποίητα). Για όλα τα υπόλοιπα, ο δίσκος ΕΙΝΑΙ το ευρετήριο — διαβάζεται χωρίς spawn.
 * @param {{repoRoot: string}} options
 * @returns {Set<string>}
 */
function listWorktreeDivergence({ repoRoot }) {
  return new Set(runGit(repoRoot, ['diff', '--name-only', '-z', '--no-renames']).split('\0').filter(Boolean));
}

/**
 * Το κείμενο πολλών blobs του ευρετηρίου, **ωμό** (τα bytes του αντικειμένου), σε ΕΝΑ spawn:
 * `git cat-file --batch` με είσοδο `<sha>`. Αντικείμενο που λείπει απλώς λείπει.
 *
 * ⚠️ ΓΙΑΤΙ ΟΧΙ `--filters`, ΜΕΤΡΗΜΕΝΟ (git 2.54, Windows): το `%(objectsize)` αναφέρει το μέγεθος
 * του **αφιλτράριστου** blob ενώ εκπέμπει τα **φιλτραρισμένα** bytes (LF→CRLF) ⇒ ο αναλυτής
 * αποσυγχρονίζεται από το πρώτο αρχείο και κάθε επόμενο κείμενο είναι σκουπίδι (33/33 λάθος).
 * Ό,τι διαβάζει ο walk (ακμές, ονόματα, namespaces) δεν εξαρτάται από το EOL.
 * @param {{repoRoot: string, entries: Array<[string, string]>}} options `[μονοπάτι, blob sha]`
 * @returns {Map<string, Buffer>} τα bytes κάθε blob (δυαδικά αρχεία: γραμματοσειρές, εικόνες — ADR-924 Φ2)
 */
function readIndexBlobs({ repoRoot, entries }) {
  const out = new Map();
  if (entries.length === 0) return out;
  const result = spawnSync('git', ['cat-file', '--batch'], {
    cwd: repoRoot, input: entries.map(([, sha]) => `${sha}\n`).join(''), maxBuffer: MAX_BUFFER * 4,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git cat-file --batch απέτυχε (${result.status}): ${String(result.stderr).trim()}`);
  const buffer = result.stdout;
  let at = 0;
  for (const [rel] of entries) {
    const eol = buffer.indexOf(0x0a, at);
    const header = buffer.toString('utf8', at, eol);
    at = eol + 1;
    if (header.endsWith(' missing')) continue;
    const size = Number(header.slice(header.lastIndexOf(' ') + 1));
    out.set(rel, buffer.subarray(at, at + size));
    at += size + 1;   // + το LF που κλείνει κάθε αντικείμενο
  }
  return out;
}

/** Το κείμενο (UTF-8) πολλών blobs — βλ. `readIndexBlobs`. @returns {Map<string, string>} */
function readIndexTexts({ repoRoot, entries }) {
  return new Map([...readIndexBlobs({ repoRoot, entries })].map(([rel, bytes]) => [rel, bytes.toString('utf8')]));
}

/**
 * **Η ΟΨΗ ΤΟΥ COMMIT χωρίς στιγμιότυπο** (ADR-924) — για πύλες που σαρώνουν ΟΛΟ το δέντρο, όπου το
 * `materializeIndex` θα αντέγραφε ~21k αρχεία. Αρχεία = το ευρετήριο (untracked λείπουν, σταδιοποιημένη
 * διαγραφή λείπει). Κείμενο = ο δίσκος, **εκτός** από όσα αποκλίνουν από το ευρετήριο: εκείνα διαβάζονται
 * ως blob, όλα μαζί σε ΕΝΑ spawn. Σε δέντρο χωρίς ξένη δουλειά το κόστος είναι δύο εντολές git.
 * ⚠️ Τα blobs έρχονται με EOL του ευρετηρίου (LF), ο δίσκος με του checkout — δες `readIndexTexts`.
 * 🧹 Εξήχθη από το `createIndexSources` του i18n-shell-slice (N.0.2), που μένει καταναλωτής του.
 * @param {{repoRoot: string, include?: (rel: string) => boolean, snapshot?: object}} options `snapshot` = `takeCommitSnapshot` (Φ4)
 * @returns {{entries: Map<string, string>, files: string[], has: (rel: string) => boolean,
 *            readText: (rel: string) => ?string, readBytes: (rel: string) => ?Buffer, divergent: number}}
 */
function createCommitView({ repoRoot, include = () => true, snapshot = null }) {
  // ⚡ ADR-924 Φ4: με `snapshot` (το στιγμιότυπο της εκτέλεσης) ΚΑΝΕΝΑ spawn — η όψη χτίζεται από τα δεδομένα του
  const indexEntries = snapshot ? new Map(snapshot.entries) : listIndexEntries({ repoRoot });
  const entries = new Map([...indexEntries].filter(([rel]) => include(rel)));
  const divergent = [...(snapshot ? snapshot.divergent : listWorktreeDivergence({ repoRoot }))].filter(rel => entries.has(rel));
  const fromIndex = snapshot
    ? new Map(snapshot.blobs.filter(([rel]) => entries.has(rel)).map(([rel, bytes]) => [rel, Buffer.from(bytes)]))
    : readIndexBlobs({ repoRoot, entries: divergent.map(rel => [rel, entries.get(rel)]) });
  const readBytes = (rel) => {
    if (!entries.has(rel)) return null;
    if (fromIndex.has(rel)) return fromIndex.get(rel);
    try {
      return fs.readFileSync(path.join(repoRoot, rel));
    } catch {
      return null;
    }
  };
  return {
    entries,
    files: [...entries.keys()].sort(),
    has: rel => entries.has(rel),
    readText: (rel) => {
      const bytes = readBytes(rel);
      return bytes === null ? null : bytes.toString('utf8');
    },
    readBytes,
    divergent: divergent.length,
    divergentFiles: new Set(divergent),
  };
}

/**
 * ADR-744 §32 Β2 — `μονοπάτι → blob sha` **ενός commit** (π.χ. `HEAD`, ο γονέας αυτού που φτιάχνεται),
 * περιορισμένο στα `paths`. Μονοπάτι που δεν υπάρχει στο commit (νέο αρχείο) απλώς λείπει.
 * ⚠️ Τα μονοπάτια ΔΕΝ περνούν ως ορίσματα (ENAMETOOLONG, βλ. `materializeIndex`): ΕΝΑ `ls-tree -r`
 * για όλο το δέντρο και φίλτρο εδώ. ⚠️ Repo χωρίς commit ⇒ `null` («δεν υπάρχει γονέας»), όχι σφάλμα.
 * @param {{repoRoot: string, rev?: string, paths: Iterable<string>}} options
 * @returns {?Map<string, string>}
 */
function listTreeEntries({ repoRoot, rev = 'HEAD', paths }) {
  const wanted = new Set(paths);
  const result = spawnSync('git', ['ls-tree', '-r', '-z', '--full-tree', rev], {
    cwd: repoRoot, encoding: 'utf8', maxBuffer: MAX_BUFFER, stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) return null;
  const entries = new Map();
  for (const record of result.stdout.split('\0')) {
    const tab = record.indexOf('\t');
    if (tab < 0) continue;
    const rel = record.slice(tab + 1);
    const [, type, sha] = record.slice(0, tab).split(' ');
    if (type === 'blob' && wanted.has(rel)) entries.set(rel, sha);
  }
  return entries;
}

/**
 * Τα σταδιοποιημένα μονοπάτια (προστέθηκαν · αντιγράφηκαν · άλλαξαν · μετονομάστηκαν — ΟΧΙ σβησμένα), σχετικά posix.
 * ΤΟ ΕΝΑ σημείο της σκανδάλης «τι αγγίζει αυτό το commit» (ADR-924 Φ3: ήταν εννέα αντίγραφα του ίδιου `git diff`).
 *
 * ⚠️ `-z`, όχι γραμμές: χωρίς αυτό το git βάζει σε εισαγωγικά και escapes κάθε μη-ASCII μονοπάτι (`core.quotepath`) ⇒
 *    ένα ελληνικό όνομα αρχείου δεν ταίριαζε ποτέ σε φίλτρο. ⚠️ Σφάλμα του git ⇒ `throw`, ποτέ σιωπηλό «κανένα»:
 *    μια σκανδάλη που επιστρέφει `[]` όταν αποτυγχάνει κάνει την πύλη σιωπηλά πράσινη.
 * @param {{repoRoot: string}} options
 * @returns {string[]}
 */
function listStagedPaths({ repoRoot }) {
  return runGit(repoRoot, ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']).split('\0').filter(Boolean);
}

/**
 * ADR-924 Φ2 — τα tracked αρχεία **κειμένου** (`-I`) που περιέχουν `needle` (σταθερή συμβολοσειρά, ή πίνακας = «οποιαδήποτε»),
 * με την ΙΔΙΑ μηχανή του git και στις δύο όψεις: `cached` ⇒ το κείμενο του ευρετηρίου, αλλιώς του δίσκου. Ποτέ untracked.
 * `git grep` βγαίνει 1 όταν δεν βρει τίποτα — δεν είναι σφάλμα.
 * @param {{repoRoot: string, needle: string|string[], pathspecs?: string[], cached?: boolean}} options
 * @returns {string[]} σχετικά posix μονοπάτια
 */
function grepFiles({ repoRoot, needle, pathspecs = [], cached = false }) {
  const needles = (Array.isArray(needle) ? needle : [needle]).flatMap(n => ['-e', n]);
  const args = ['grep', '-l', '-I', '--fixed-strings', '-z', ...(cached ? ['--cached'] : []), ...needles, '--', ...pathspecs];
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: MAX_BUFFER });
  if (result.error) throw result.error;
  if (result.status === 1) return [];
  if (result.status !== 0) throw new Error(`git grep απέτυχε (${result.status}): ${(result.stderr || '').trim()}`);
  return result.stdout.split('\0').filter(Boolean);
}

/**
 * **ΤΟ ΣΤΙΓΜΙΟΤΥΠΟ ΜΙΑΣ ΕΚΤΕΛΕΣΗΣ** (ADR-924 Φ4) — ό,τι χρειάζεται μια όψη του commit, σε **σειριοποιήσιμη** μορφή
 * (structured clone προς worker threads): εγγραφές ευρετηρίου · αποκλίνοντα · τα blobs τους · untracked.
 *
 * 🔑 ΓΙΑΤΙ (μετρημένο §8.9): κάθε πύλη έχτιζε ΔΙΚΗ της όψη (~1,3s, τρία spawn) — ~90 φορές το ίδιο ερώτημα ανά commit,
 *    και θεωρητικά με ΔΙΑΦΟΡΕΤΙΚΗ απάντηση αν κάποιος σταδιοποιούσε στο μεταξύ. Ο εκτελεστής το παίρνει ΜΙΑ φορά: μία
 *    απάντηση για όλες τις πύλες της ίδιας εκτέλεσης. Τα `untracked` τα χρειάζεται η ζώνη ασφαλείας του worker (ό,τι
 *    υπάρχει στον δίσκο και ΔΕΝ θα δεσμευτεί).
 * @param {{repoRoot: string}} options
 * @returns {{repoRoot: string, entries: Array<[string, string]>, divergent: string[], blobs: Array<[string, Buffer]>,
 *            untracked: string[]}}
 */
function takeCommitSnapshot({ repoRoot }) {
  const entries = listIndexEntries({ repoRoot });
  const divergent = [...listWorktreeDivergence({ repoRoot })].filter(rel => entries.has(rel));
  const blobs = readIndexBlobs({ repoRoot, entries: divergent.map(rel => [rel, entries.get(rel)]) });
  const untracked = runGit(repoRoot, ['ls-files', '-o', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  return { repoRoot, entries: [...entries], divergent, blobs: [...blobs], untracked };
}

module.exports = {
  materializeIndex, writeIndexBlob, readIndexText, listIndexEntries, listWorktreeDivergence, readIndexTexts,
  readIndexBlobs, grepFiles, listStagedPaths,
  createCommitView, takeCommitSnapshot, listTreeEntries, runGit,
};
