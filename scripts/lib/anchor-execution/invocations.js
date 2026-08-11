'use strict';

/**
 * ADR-783 / CHECK 3.54 — **Τι εκτελεί** μια γραμμή `run:` ενός workflow.
 *
 * Η ερώτηση είναι στενή και μία: *«αυτή η εντολή τρέχει αρχεία test, και ποια;»*. Το «είναι
 * αυτό σφάλμα;» ζει στο `census.js`, όπως ακριβώς χωρίζονται οι ευθύνες στο CHECK 3.47.
 *
 * ## 🔑 FAIL-CLOSED: τρεις απαντήσεις, ποτέ δύο
 * Κάθε εντολή γίνεται `execution` (ξέρω ποια αρχεία), `not-execution` (αποδεδειγμένα δεν
 * τρέχει test) ή **`unresolvable`** (μοιάζει με εκτέλεση και **δεν** μπορώ να την λύσω).
 * Η τρίτη **μπλοκάρει**. Χωρίς αυτήν, μια εντολή που ο αναγνώστης δεν κατάλαβε θα διαβαζόταν
 * ως «κανείς δεν τρέχει αυτά τα αρχεία» **ή**, χειρότερα, θα εξαφανιζόταν σιωπηλά — και το
 * σχήμα «0 = κανείς δεν κοίταξε» έχει ήδη εμφανιστεί οκτώ φορές σε αυτό το repo.
 *
 * ## ⚠️ Τι ΔΕΝ κάνει
 * Δεν προσπαθεί να «καταλάβει» κέλυφος. Μια εντολή μετράει ως εκτέλεση **μόνο** αν το
 * εκτελέσιμο βρίσκεται σε **θέση εκτέλεσης** (`jest …`, `npx jest …`, `pnpm exec jest …`).
 * Το `echo "…jest suites passed…"` του `firestore-rules.yml` **μετρήθηκε** ως ψευδώς θετικό
 * σε πρόχειρη εκδοχή αυτού του αναγνώστη — γι' αυτό η θέση είναι κριτήριο, όχι η λέξη.
 *
 * @module scripts/lib/anchor-execution/invocations
 */

const fs = require('node:fs');
const path = require('node:path');

/** Εντολές που ξεκινούν έτσι μπορεί να εκτελούν test· ό,τι άλλο αγνοείται εντελώς. */
const COMMAND_HEADS = /^(jest|playwright|npx|pnpm|npm|yarn|node|node_modules|cross-env|firebase)\b/;

/** Ρήματα διαχειριστή πακέτων: αναφέρουν το `jest` ως **πακέτο**, δεν το τρέχουν. */
const PACKAGE_VERBS = /^(pnpm|npm|yarn)\s+(add|install|i|remove|rm|uninstall|why|ls|list|link|dedupe|store|audit)\b/;

/** Οι μορφές που **όντως** εκτελούν ένα δυαδικό: ό,τι μένει μπροστά από το όνομα. */
const EXEC_PREFIX = /^(?:(?:npx|pnpm\s+dlx|pnpm\s+exec|npm\s+exec|yarn\s+(?:run\s+)?(?=jest|playwright))\s+)?/;

/**
 * Σημαίες που **αλλάζουν το σύνολο των αρχείων** με τρόπο που δεν μοντελοποιείται στατικά.
 * Δεν είναι απαγόρευση: είναι δήλωση αδυναμίας ⇒ `unresolvable` ⇒ μπλοκ, ώστε να μην
 * περάσει ποτέ ως «τα τρέχει όλα» κάτι που τρέχει ένα υποσύνολο εξαρτημένο από το git.
 */
const SET_CHANGING_FLAGS = [
  '--onlyChanged', '-o', '--changedSince', '--changedFilesWithAncestor',
  '--findRelatedTests', '--onlyFailures', '-f', '--shard',
  '--selectProjects', '--projects', '--lastCommit',
];

/** Σημαίες που **δεν** εκτελούν τίποτα — άρα το βήμα δεν είναι εκτελεστής. */
const NON_EXECUTING_FLAGS = ['--listTests', '--showConfig', '--help', '--version', '--clearCache'];

/**
 * Σπάει ένα σώμα `run:` σε ανεξάρτητες εντολές κελύφους, **κρατώντας ποιος καταπίνει ποιον**.
 *
 * 🔑 Το `||` είναι το μόνο που αλλάζει την ετυμηγορία. Το προεπιλεγμένο κέλυφος του GitHub
 * είναι `bash -e`: σε `a; b` ή `a && b` μια αποτυχία του `a` σκοτώνει το βήμα — σε `a || b`
 * **όχι**. Άρα μια κλήση με `||` μετά της είναι «ανεκτή», και μετράει ως μπλοκάρουσα **μόνο**
 * αν ακολουθεί άλλη εντολή που μπορεί να αποτύχει (τυπικά ο κριτής).
 *
 * Χωρίς αυτή τη διάκριση, ένα `npx jest … || true` θα διαβαζόταν ως «μπλοκάρει» — δηλαδή η
 * πύλη θα έλεγε ψέματα με τον **ίδιο** τρόπο που λέει ψέματα το `continue-on-error`.
 *
 * @returns {{ command: string, tolerated: boolean, last: boolean }[]}
 */
function splitCommands(run) {
  const parts = run.split(/(\r?\n|&&|\|\||;)/);
  const segments = [];
  for (let i = 0; i < parts.length; i += 2) {
    const command = parts[i].trim();
    if (command === '') continue;
    segments.push({ command, separatorAfter: (parts[i + 1] || '').trim() });
  }
  return segments.map((segment, index) => ({
    command: segment.command,
    tolerated: segment.separatorAfter === '||',
    last: segments.slice(index + 1).every((next) => next.command === 'true' || next.command === ':'),
  }));
}

/**
 * Ξετυλίγει τα περιτυλίγματα που κρύβουν την πραγματική εντολή.
 * `firebase emulators:exec … "jest --config …"` είναι η μορφή που τρέχουν **τέσσερα**
 * workflows εξομοιωτή· χωρίς το ξετύλιγμα, 137 αρχεία test θα φαίνονταν ανεκτέλεστα.
 */
function unwrap(command) {
  const emulator = command.match(/emulators:exec[^"']*["']([^"']+)["']/);
  if (emulator) return emulator[1].trim();
  const crossEnv = command.match(/^cross-env\s+(?:\w+=\S+\s+)*(.+)$/);
  if (crossEnv) return crossEnv[1].trim();
  return command;
}

/** Τα scripts του `package.json` ως χάρτης — η αυθεντία για κάθε `pnpm run <όνομα>`. */
function loadScripts(projectRoot) {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  return pkg.scripts || {};
}

/**
 * `pnpm run test:x` → το σώμα του script, αναδρομικά (τα scripts καλούν scripts).
 * Τα ορίσματα που ακολουθούν διατηρούνται, με το `--` του npm να αφαιρείται: το
 * `pnpm test -- --ci` σημαίνει `jest --passWithNoTests --ci`.
 */
function expandScripts(command, scripts, depth = 0) {
  if (depth > 5) return command;
  const match = command.match(/^(?:pnpm(?:\s+run)?|npm\s+run|yarn(?:\s+run)?)\s+([\w:.@/-]+)/);
  if (!match) return command;
  const body = scripts[match[1]];
  if (body === undefined) return command;
  const rest = command.slice(match[0].length).replace(/^\s*--\s+/, ' ').trim();
  return expandScripts(`${body}${rest ? ` ${rest}` : ''}`.trim(), scripts, depth + 1);
}

/** Χωρίζει σε tokens σεβόμενο τα εισαγωγικά, και τα αφαιρεί. */
function tokenize(command) {
  return (command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || []).map((token) =>
    token.replace(/^['"]/, '').replace(/['"]$/, ''),
  );
}

/** Το όνομα του δυαδικού που εκτελείται, ή `null` αν η εντολή δεν εκτελεί δυαδικό. */
function executableOf(command) {
  const stripped = command.replace(EXEC_PREFIX, '').trim();
  const first = tokenize(stripped)[0];
  if (first === undefined) return null;
  const base = first.replace(/^.*[/\\]/, '').replace(/\.(js|cjs|mjs)$/, '');
  return { base, rest: stripped.slice(first.length).trim() };
}

/**
 * Τα ορίσματα μιας κλήσης jest: **ποιο config** και **ποια μοτίβα διαδρομής**.
 *
 * ⚠️ Τα θετικά ορίσματα του jest είναι **regex πάνω στην ΠΛΗΡΗ διαδρομή**, όχι διαδρομές
 * αρχείων. Γι' αυτό εδώ γίνονται `RegExp` και δοκιμάζονται στην απόλυτη posix διαδρομή —
 * ό,τι ακριβώς κάνει το `SearchSource` του jest σε Linux runner.
 */
function parseJestArgs(rest) {
  const tokens = tokenize(rest);
  const patterns = [];
  let config = null;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (NON_EXECUTING_FLAGS.includes(token)) return { kind: 'not-execution' };
    if (SET_CHANGING_FLAGS.includes(token) || SET_CHANGING_FLAGS.some((f) => token.startsWith(`${f}=`))) {
      return { kind: 'unresolvable', why: `σημαία «${token}» αλλάζει το σύνολο των αρχείων δυναμικά` };
    }
    if (token === '--config') { config = tokens[i + 1]; i += 1; continue; }
    if (token.startsWith('--config=')) { config = token.slice('--config='.length); continue; }
    const inlinePattern = token.match(/^--testPathPatterns?=(.*)$/);
    if (inlinePattern) { patterns.push(inlinePattern[1]); continue; }
    if (/^--testPathPatterns?$/.test(token)) { patterns.push(tokens[i + 1] ?? ''); i += 1; continue; }
    if (token.startsWith('-')) continue;
    patterns.push(token);
  }

  const compiled = [];
  for (const pattern of patterns) {
    try {
      compiled.push(new RegExp(pattern));
    } catch (error) {
      return { kind: 'unresolvable', why: `μη έγκυρο regex διαδρομής «${pattern}»` };
    }
  }
  return { kind: 'execution', runner: 'jest', config: config ?? 'jest.config.js', patterns: compiled };
}

/** Τα ορίσματα μιας κλήσης playwright — μόνο «τρέχει test;» και με ποιο φίλτρο. */
function parsePlaywrightArgs(rest) {
  const tokens = tokenize(rest);
  if (tokens[0] !== 'test') return { kind: 'not-execution' };
  const patterns = [];
  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === '--list') return { kind: 'not-execution' };
    if (token.startsWith('-')) continue;
    try {
      patterns.push(new RegExp(token));
    } catch {
      return { kind: 'unresolvable', why: `μη έγκυρο φίλτρο playwright «${token}»` };
    }
  }
  return { kind: 'execution', runner: 'playwright', config: 'playwright.config.ts', patterns };
}

/**
 * Η ταξινόμηση **μίας** εντολής κελύφους.
 * @returns {{kind:'execution'|'not-execution'|'unresolvable'}} — ποτέ `undefined`
 */
function classifyCommand(rawCommand, scripts) {
  const command = unwrap(rawCommand.trim());
  if (!COMMAND_HEADS.test(command)) return { kind: 'not-execution' };
  if (PACKAGE_VERBS.test(command)) return { kind: 'not-execution' };

  const expanded = unwrap(expandScripts(command, scripts));
  const executable = executableOf(expanded);
  if (executable === null) return { kind: 'not-execution' };

  if (executable.base === 'jest') return parseJestArgs(executable.rest);
  if (executable.base === 'playwright') return parsePlaywrightArgs(executable.rest);

  // Δεν εκτελεί jest/playwright — αλλά **αναφέρει** κάποιο από τα δύο σε εντολή που ξεκινά
  // με runner. Δεν το καταλαβαίνω ⇒ το λέω. Ποτέ σιωπηλή απόρριψη.
  if (/(^|[\s/])(jest|playwright)([\s/]|$)/.test(expanded)) {
    return { kind: 'unresolvable', why: `αναφέρει test runner σε μορφή που δεν αναλύεται: «${expanded.slice(0, 80)}»` };
  }
  return { kind: 'not-execution' };
}

module.exports = {
  COMMAND_HEADS,
  NON_EXECUTING_FLAGS,
  PACKAGE_VERBS,
  SET_CHANGING_FLAGS,
  classifyCommand,
  expandScripts,
  executableOf,
  loadScripts,
  parseJestArgs,
  parsePlaywrightArgs,
  splitCommands,
  tokenize,
  unwrap,
};
