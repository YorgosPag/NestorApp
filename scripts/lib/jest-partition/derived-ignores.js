#!/usr/bin/env node
/**
 * **Τι οφείλει να εξαιρεί το `jest.config.js`** — παραγόμενο, ποτέ γραμμένο στο χέρι.
 *
 * Καταναλώνεται από το **ίδιο το `jest.config.js`** σε κάθε εκκίνηση, οπότε το κόστος είναι
 * σχεδιαστικό κριτήριο: **~3ms** (ένα `readdir` της ρίζας, 4 `require`, 3 αναγνώσεις κειμένου,
 * λίγα `stat`). Δύο υποψήφιες αυθεντίες **απορρίφθηκαν με μέτρηση**:
 *   - `ts.readConfigFile` πάνω στα `outDir` των tsconfig (ο τρόπος του ADR-700) —
 *     **`require('typescript')` = 396ms**, σε κάθε `npx jest <αρχείο>`·
 *   - `git check-ignore` / `git ls-files` — **483ms**, ίδιο πρόβλημα.
 * Και τα δύο ζουν πλέον στην **πύλη** (Στρώμα 2), όπου πληρώνονται μία φορά.
 *
 * ## ΔΥΟ ΕΡΩΤΗΣΕΙΣ, ΔΥΟ ΑΥΘΕΝΤΙΕΣ
 *
 * **(α) Ποιον τον τρέχει ήδη αδελφός;** → τα ίδια τα `jest.config.<κάτι>.js`. Το `testMatch`
 * τους **είναι** η δήλωση ιδιοκτησίας· το κυριολεκτικό του πρόθεμα είναι η εξαίρεση.
 *
 * **(β) Ποιο δεν είναι πηγή;** → τα `.gitignore`. Η αρχή είναι «**το jest δεν τρέχει ΠΟΤΕ
 * αρχείο που αγνοεί το git**»: 7 μεταγλωττισμένα διπλότυπα κάτω από `functions/lib/`
 * (gitignored) εκτελούνταν σε κάθε `npx jest`, δηλαδή το αποτέλεσμα εξαρτιόταν από το αν
 * είχες τρέξει build, και ο κώδικας που έτρεχε ήταν **μπαγιάτικος**.
 *
 * ⚠️ **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: εδώ διαβάζονται μόνο **κυριολεκτικές** εγγραφές φακέλου, από τη ρίζα
 * και από τα `.gitignore` **ενός επιπέδου** κάτω. Οι εγγραφές με glob και τα βαθύτερα
 * `.gitignore` **δεν** διαβάζονται — αυτό είναι φθηνή **προσέγγιση**. Την ακριβή εκδοχή
 * («ρώτα το git») την κάνει η πύλη `check-jest-partition.js`, που πυροδοτεί `build-artifact`
 * σε ό,τι ξεφύγει. Η προσέγγιση δεν είναι τυφλό σημείο — είναι δηλωμένο στρώμα.
 *
 * @module scripts/lib/jest-partition/derived-ignores
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  GLOB_METACHARACTERS,
  PROJECT_ROOT,
  discoverSiblingConfigFiles,
  literalDirectoryPrefixOf,
  readConfig,
  toPosix,
} = require('./jest-configs');

/** Regex escape — η διαδρομή είναι δεδομένα, ποτέ σχήμα. */
function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Ένα κυριολεκτικό πρόθεμα (σχετικό με τη ρίζα) → **αγκυρωμένο** regex.
 *
 * 🔴 **Η ΑΓΚΥΡΩΣΗ ΔΕΝ ΕΙΝΑΙ ΚΑΛΛΩΠΙΣΜΟΣ — ΤΗΝ ΠΛΗΡΩΣΑΜΕ ΜΕΤΡΗΜΕΝΑ.** Η πρώτη γραφή έβγαζε
 * σκέτο `/report/`, και το `testPathIgnorePatterns` του jest είναι **αόριστο** regex: έσβησε
 * το `src/subapps/dxf-viewer/bim/thermal/report/__tests__/thermal-study-report.test.ts` —
 * υπαρκτή, tracked, περαστή σουίτα — επειδή στη **ρίζα** υπάρχει ένας άσχετος gitignored
 * φάκελος `report/`. Δηλαδή μια πύλη που υπάρχει για να μη χάνονται tests **έχανε test**,
 * σιωπηλά (3229 αντί 3230· το ένα φάνηκε μόνο επειδή ο αριθμός δεν έβγαινε).
 * Το ίδιο θα ίσχυε για `images/`, `reports/`, `coverage/`.
 *
 * ⚠️ Η αγκύρωση γίνεται με **ρητή απόλυτη ρίζα** και όχι με το `<rootDir>` token του jest:
 * το jest αντικαθιστά το token **χωρίς escape**, οπότε μια ρίζα με κανονικό χαρακτήρα στο
 * όνομά της θα γεννούσε άκυρο regex. Εδώ η ρίζα περνά από `escapeForRegex` πρώτα.
 * Το `/` μένει `/`: το jest εφαρμόζει `replacePathSepForRegex` και το μετατρέπει μόνο του.
 */
function prefixToPattern(posixPrefix, root = PROJECT_ROOT) {
  const anchor = escapeForRegex(toPosix(root).replace(/\/+$/, ''));
  return `^${anchor}/${escapeForRegex(posixPrefix.replace(/^\/+/, ''))}`;
}

/**
 * (α) Τα προθέματα που **ήδη ανήκουν** σε sibling config.
 *
 * Ένα `testMatch: ['<rootDir>/tests/storage-rules/suites/ ** /*.storage.test.ts']` σημαίνει
 * «αυτός ο φάκελος είναι δικός μου». Το default οφείλει να τον αφήσει ήσυχο.
 */
function siblingOwnedPrefixes(root = PROJECT_ROOT) {
  const prefixes = new Set();
  for (const file of discoverSiblingConfigFiles(root)) {
    const config = readConfig(file, root);
    const testMatch = config.testMatch ?? [];
    if (testMatch.length === 0) {
      throw new Error(
        `[jest-partition] Το «${file}» δεν δηλώνει testMatch. Χωρίς δήλωση ιδιοκτησίας δεν ` +
          'μπορεί να παραχθεί εξαίρεση, και τα tests του θα έτρεχαν διπλά στο default config.',
      );
    }
    for (const glob of testMatch) prefixes.add(literalDirectoryPrefixOf(glob));
  }
  return [...prefixes].sort();
}

/** Οι γραμμές ενός `.gitignore` που είναι **κυριολεκτικές** διαδρομές (όχι σχόλια/άρνηση/glob). */
function literalIgnoreEntries(gitignoreFile) {
  if (!fs.existsSync(gitignoreFile)) return [];
  return fs
    .readFileSync(gitignoreFile, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#') && !line.startsWith('!'))
    .filter((line) => !GLOB_METACHARACTERS.test(line));
}

/**
 * (β) Τα προθέματα που **δεν είναι πηγή** — φάκελοι που αγνοεί το git.
 *
 * Κρατιούνται μόνο όσες εγγραφές **υπάρχουν στον δίσκο ως φάκελος**: το `.gitignore` δεν
 * ξεχωρίζει αρχείο από φάκελο όταν λείπει η τελική κάθετος (`/build`), και μια εξαίρεση που
 * μαντεύει λάθος θα έσβηνε σιωπηλά σουίτες.
 */
function gitIgnoredDirectoryPrefixes(root = PROJECT_ROOT) {
  const owners = [{ base: root, file: path.join(root, '.gitignore') }];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const base = path.join(root, entry.name);
    owners.push({ base, file: path.join(base, '.gitignore') });
  }

  const prefixes = new Set();
  for (const { base, file } of owners) {
    for (const raw of literalIgnoreEntries(file)) {
      const relative = raw.replace(/^\/+/, '').replace(/\/+$/, '');
      if (relative === '') continue;
      const absolute = path.join(base, relative);
      let stat;
      try {
        stat = fs.statSync(absolute);
      } catch {
        continue; // δεν υπάρχει σήμερα — δεν υπάρχει τίποτα να εξαιρεθεί
      }
      if (!stat.isDirectory()) continue;
      prefixes.add(`${toPosix(path.relative(root, absolute))}/`);
    }
  }
  return [...prefixes].sort();
}

/**
 * Η τελική λίστα regex για το `testPathIgnorePatterns` του default config.
 *
 * ⚠️ Οι διαδρομές γράφονται με **forward slash** και σε Windows: το jest εφαρμόζει
 * `replacePathSepForRegex` στα `testPathIgnorePatterns` κατά την κανονικοποίηση, δηλαδή
 * μετατρέπει μόνο του κάθε `/` σε `[\\/]`. Επαληθεύτηκε εκτελώντας `jest --listTests`:
 * το χειρόγραφο `'tests/firestore-rules'` **όντως** εξαιρεί, σε backslash δέντρο.
 */
function derivedTestPathIgnorePatterns(root = PROJECT_ROOT) {
  const prefixes = [...siblingOwnedPrefixes(root), ...gitIgnoredDirectoryPrefixes(root)]
    .map((prefix) => prefix.replace(/^\/+/, ''));
  return [...new Set(prefixes)].sort().map((prefix) => prefixToPattern(prefix, root));
}

module.exports = {
  derivedTestPathIgnorePatterns,
  escapeForRegex,
  gitIgnoredDirectoryPrefixes,
  literalIgnoreEntries,
  prefixToPattern,
  siblingOwnedPrefixes,
};
