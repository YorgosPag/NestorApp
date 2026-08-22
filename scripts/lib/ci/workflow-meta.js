'use strict';

/**
 * ADR-757 — Ο **ΜΟΝΟΣ** αναγνώστης αρχείων workflow του έργου.
 *
 * Ξεκίνησε με δύο πεδία για την ιεράρχηση πυλών:
 *   1. το `name:` (αυτό που βλέπει ο άνθρωπος στο email και στο Actions UI)
 *   2. τη λίστα `on.workflow_run.workflows:` (αυτό που παρακολουθεί ο συγκεντρωτής)
 *
 * ΑΠΟ ΤΟ ADR-783 (CHECK 3.54) διαβάζει και **τι εκτελεί** ένα workflow:
 *   3. τα `on:` κλειδιά + τα `paths:` φίλτρα (πότε ξυπνά)
 *   4. τα βήματα `run:` με τα `continue-on-error`/`if` τους (τι τρέχει, και αν μπορεί
 *      να κοκκινίσει)
 * Ζουν **εδώ** και όχι σε δεύτερο αρχείο: ένας δεύτερος αναγνώστης YAML θα ήταν η
 * «δεύτερη διάλεκτος» του ADR-749 — τέσσερις μηχανές, πέντε διάλεκτοι, τρεις αριθμοί.
 *
 * ΓΙΑΤΙ ΟΧΙ ΠΛΗΡΗΣ YAML PARSER: το έργο δεν έχει εξάρτηση yaml/js-yaml και δεν προστίθεται
 * μία για δύο πεδία (N.5 — κάθε πακέτο θέλει έλεγχο άδειας και συντήρηση). Ο αναγνώστης εδώ
 * είναι σκόπιμα ΑΥΣΤΗΡΟΣ και ΠΕΡΙΟΡΙΣΜΕΝΟΣ: δέχεται μόνο το σχήμα που γράφουν τα ίδια τα
 * workflows του repo και ΠΕΤΑΕΙ σφάλμα σε ό,τι δεν καταλαβαίνει, αντί να επιστρέψει «τίποτα».
 *
 * 🔴 Η ΠΑΓΙΔΗ ΠΟΥ ΑΠΟΦΕΥΓΕΤΑΙ ΕΔΩ (CHECK 3.36, ADR-752): ένας regex αναγνώστης γέννησε
 * φάντασμα-namespace επειδή διάβασε ένα παράδειγμα μέσα σε ΣΧΟΛΙΟ. Άρα:
 *   - γραμμές σχολίου (πρώτος μη-κενός χαρακτήρας `#`) αφαιρούνται ΠΡΙΝ από κάθε ανάλυση·
 *   - η ένταξη σε μπλοκ γίνεται με ΕΣΟΧΗ (δομή), όχι με «η επόμενη γραμμή που ταιριάζει»·
 *   - `#` ΜΕΣΑ σε τιμή δεν πειράζεται όταν η τιμή είναι σε εισαγωγικά.
 */

const fs = require('fs');
const path = require('path');

/** Αρχεία που ΔΕΝ είναι ενεργά workflows (κρατιούνται στο δέντρο ως ιστορικό). */
const DISABLED_SUFFIX = '.disabled';

/**
 * @param {string} workflowsDir
 * @returns {string[]} ονόματα αρχείων (.yml), αλφαβητικά, χωρίς τα .disabled
 */
function listWorkflowFiles(workflowsDir) {
  return fs
    .readdirSync(workflowsDir)
    .filter((f) => f.endsWith('.yml') && !f.endsWith(DISABLED_SUFFIX))
    .sort();
}

/**
 * Γραμμές χωρίς γραμμές-σχόλια και χωρίς κενές γραμμές, με διατηρημένη εσοχή.
 * @param {string} text
 * @returns {{ indent: number, body: string }[]}
 */
function significantLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim().length > 0 && !/^\s*#/.test(line))
    .map((line) => ({ indent: line.length - line.trimStart().length, body: line.trimStart() }));
}

/**
 * Αφαιρεί εισαγωγικά και σχόλιο-στο-τέλος-γραμμής από μια βαθμωτή τιμή YAML.
 * Σε τιμή με εισαγωγικά, ό,τι είναι ΜΕΣΑ επιστρέφεται αυτούσιο (τα `#` επιτρέπονται).
 * @param {string} raw
 * @returns {string}
 */
function scalar(raw) {
  const quoted = raw.match(/^(['"])([\s\S]*?)\1\s*(?:#.*)?$/);
  if (quoted) return quoted[2];
  return raw.replace(/\s+#.*$/, '').trim();
}

/**
 * Οι γραμμές-παιδιά ενός κλειδιού: όσες ακολουθούν με ΜΕΓΑΛΥΤΕΡΗ εσοχή, μέχρι την πρώτη
 * γραμμή με εσοχή ≤ του γονέα. Αυτή είναι η δομική ερώτηση — όχι «η επόμενη που ταιριάζει».
 * @param {{indent:number, body:string}[]} lines
 * @param {number} parentIndex
 * @returns {{indent:number, body:string}[]}
 */
function childLines(lines, parentIndex) {
  const parentIndent = lines[parentIndex].indent;
  const out = [];
  for (let i = parentIndex + 1; i < lines.length; i += 1) {
    if (lines[i].indent <= parentIndent) break;
    out.push(lines[i]);
  }
  return out;
}

/**
 * @param {{indent:number, body:string}[]} lines
 * @param {string} key
 * @param {number} [expectedIndent] αν δοθεί, το κλειδί πρέπει να είναι ΑΚΡΙΒΩΣ σε αυτή την εσοχή
 * @returns {number} δείκτης γραμμής ή -1
 */
function findKey(lines, key, expectedIndent) {
  return lines.findIndex(
    (line) =>
      line.body.startsWith(`${key}:`) &&
      (expectedIndent === undefined || line.indent === expectedIndent)
  );
}

/**
 * Το εμφανιζόμενο όνομα του workflow — αυτό που μπαίνει στο θέμα του email
 * («Run failed: <name> — main») και αυτό με το οποίο ταιριάζει το `on.workflow_run.workflows`.
 *
 * @param {string} filePath
 * @returns {string}
 * @throws αν λείπει `name:` στο ανώτατο επίπεδο — ένα workflow χωρίς όνομα είναι
 *         απαρακολούθητο εξ ορισμού (το GitHub δείχνει τη διαδρομή αρχείου).
 */
function readWorkflowName(filePath) {
  const lines = significantLines(fs.readFileSync(filePath, 'utf8'));
  const index = findKey(lines, 'name', 0);
  if (index === -1) {
    throw new Error(`${path.basename(filePath)}: λείπει "name:" στο ανώτατο επίπεδο`);
  }
  const value = scalar(lines[index].body.slice('name:'.length).trim());
  if (!value) {
    throw new Error(`${path.basename(filePath)}: το "name:" είναι κενό`);
  }
  return value;
}

/**
 * Η λίστα `on.workflow_run.workflows:` — τα ονόματα που παρακολουθεί ο συγκεντρωτής.
 * Επιστρέφει [] όταν το workflow δεν έχει καθόλου σκανδάλη `workflow_run` (το κανονικό).
 *
 * @param {string} filePath
 * @returns {string[]}
 */
function readWorkflowRunWatchList(filePath) {
  const lines = significantLines(fs.readFileSync(filePath, 'utf8'));

  // `on:` στο ανώτατο επίπεδο. (Το YAML 1.1 θα το διάβαζε ως boolean true· εδώ είναι κείμενο.)
  const onIndex = findKey(lines, 'on', 0);
  if (onIndex === -1) return [];

  const onChildren = childLines(lines, onIndex);
  const runIndex = findKey(onChildren, 'workflow_run');
  if (runIndex === -1) return [];

  const runChildren = childLines(onChildren, runIndex);
  const listIndex = findKey(runChildren, 'workflows');
  if (listIndex === -1) return [];

  return childLines(runChildren, listIndex)
    .filter((line) => line.body.startsWith('- '))
    .map((line) => scalar(line.body.slice(2).trim()));
}

/**
 * Οι **αυτόματες** σκανδάλες ενός workflow και τα φίλτρα διαδρομών τους.
 *
 * ⚠️ Το `workflow_dispatch` **δεν** είναι αυτόματη σκανδάλη: ένα workflow που ξυπνά μόνο
 * με το χέρι δεν εκτελεί τίποτα σε κανένα PR — και αν κάποιος το μετρήσει ως εκτελεστή,
 * η πύλη λέει «εκτελείται» για κάτι που **κανείς δεν τρέχει ποτέ**.
 *
 * @param {string} filePath
 * @returns {{ automatic: string[], pathFiltered: boolean }}
 *   `automatic` = όσα από `push`/`pull_request`/`schedule`/`workflow_run` υπάρχουν·
 *   `pathFiltered` = **κάθε** αυτόματη σκανδάλη έχει `paths:` ⇒ υπάρχει αλλαγή που δεν
 *   την ξυπνά (δηλωμένο κενό, όχι παράβαση).
 */
function readWorkflowTriggers(filePath) {
  const lines = significantLines(fs.readFileSync(filePath, 'utf8'));
  const onIndex = findKey(lines, 'on', 0);
  if (onIndex === -1) return { automatic: [], pathFiltered: false };

  const onChildren = childLines(lines, onIndex);
  const topIndent = onChildren.length > 0 ? onChildren[0].indent : 0;
  const AUTOMATIC = ['push', 'pull_request', 'pull_request_target', 'schedule', 'workflow_run'];

  const automatic = [];
  let filtered = 0;
  for (let i = 0; i < onChildren.length; i += 1) {
    if (onChildren[i].indent !== topIndent) continue;
    const key = onChildren[i].body.replace(/:.*$/, '').trim();
    if (!AUTOMATIC.includes(key)) continue;
    automatic.push(key);
    if (findKey(childLines(onChildren, i), 'paths') !== -1) filtered += 1;
  }
  return { automatic, pathFiltered: automatic.length > 0 && filtered === automatic.length };
}

/**
 * Κάθε βήμα με `run:` του workflow, με **ό,τι κρίνει αν μπορεί να κοκκινίσει**.
 *
 * 🔴 Το `continue-on-error` διαβάζεται σε **δύο** επίπεδα (βήμα ΚΑΙ job) επειδή αυτό
 * ακριβώς είναι το ελάττωμα που γέννησε το ADR-783: το `coverage-ratchet.yml` **τρέχει**
 * ολόκληρη τη σουίτα με `continue-on-error: true` στο βήμα ⇒ 3.259 αρχεία test
 * εκτελούνται και **κανένα δεν μπορεί να κοκκινίσει τίποτα**.
 *
 * Το `if:` μετριέται κι αυτό: βήμα υπό συνθήκη **δεν** είναι εγγύηση εκτέλεσης (τα
 * βήματα `seed` του coverage-ratchet τρέχουν μόνο σε χειροκίνητο dispatch).
 *
 * @param {string} filePath
 * @returns {{ job: string, run: string, continueOnError: boolean, conditional: boolean }[]}
 */
/**
 * Το `env:` ενός βήματος, ως χάρτης ονόματος → τιμή.
 *
 * ΑΠΟ ΤΟ ADR-788 (CHECK 3.57): το **περιβάλλον** ενός production build είναι μέρος
 * του **τι χτίζεται**, όχι διακόσμηση. Μετρημένο στις 2026-08-21: το job του
 * χρησμού έχτιζε με **1 από τις 20** μεταβλητές των δύο άλλων καλούντων του
 * `build:ci` — και πέθαινε σε OOM. Χωρίς αυτό το πεδίο, καμία πύλη δεν μπορεί να
 * ρωτήσει «χτίζουν όλοι τον ίδιο server;».
 *
 * ⚠️ Η πρώτη γραμμή του βήματος έχει το πρόθεμα `- `, άρα τα κλειδιά του βήματος
 * κάθονται **δύο** κενά πιο μέσα από τον δείκτη του `-`. Ένας υπολογισμός εσοχής
 * που το αγνοεί βρίσκει **μηδέν** κλειδιά και επιστρέφει `{}` — δηλαδή «δεν έχει
 * env», που είναι το ίδιο σχήμα «0 = κανείς δεν κοίταξε».
 *
 * @param {{indent:number, body:string}[]} stepLines γραμμές ΕΝΟΣ βήματος, με εσοχή
 * @returns {Record<string,string>}
 */
function stepEnv(stepLines) {
  if (stepLines.length === 0) return {};
  const keyIndent = stepLines[0].indent + 2;
  const normalized = stepLines.map((line, index) =>
    index === 0 ? { indent: keyIndent, body: line.body.replace(/^- /, '') } : line,
  );
  const envIndex = findKey(normalized, 'env', keyIndent);
  if (envIndex === -1) return {};

  const out = {};
  for (const line of childLines(normalized, envIndex)) {
    const match = line.body.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (match) out[match[1]] = scalar(match[2]);
  }
  return out;
}

function readWorkflowRunSteps(filePath) {
  const lines = significantLines(fs.readFileSync(filePath, 'utf8'));
  const jobsIndex = findKey(lines, 'jobs', 0);
  if (jobsIndex === -1) return [];

  const jobLines = childLines(lines, jobsIndex);
  const jobIndent = jobLines.length > 0 ? jobLines[0].indent : 0;
  const steps = [];

  for (let i = 0; i < jobLines.length; i += 1) {
    if (jobLines[i].indent !== jobIndent) continue;
    const job = jobLines[i].body.replace(/:.*$/, '').trim();
    const body = childLines(jobLines, i);
    const stepsIndex = findKey(body, 'steps');
    if (stepsIndex === -1) continue;

    // `continue-on-error` του job: ΜΟΝΟ στο άμεσο επίπεδο του job, ποτέ μέσα στα steps.
    const jobIndentBody = body.length > 0 ? body[0].indent : 0;
    const jobContinue = body.some(
      (l) => l.indent === jobIndentBody && /^continue-on-error:\s*true\b/.test(l.body),
    );

    const stepLines = childLines(body, stepsIndex);
    const starts = stepLines.reduce((acc, l, idx) => (l.body.startsWith('- ') ? [...acc, idx] : acc), []);
    starts.forEach((start, n) => {
      const end = n + 1 < starts.length ? starts[n + 1] : stepLines.length;
      const chunk = stepLines.slice(start, end).map((l) => l.body.replace(/^- /, ''));
      const runIndex = chunk.findIndex((b) => b.startsWith('run:'));
      if (runIndex === -1) return;

      // `run: |` / `run: >` ⇒ το σώμα είναι οι γραμμές που ακολουθούν. Το `>` (folded)
      // ενώνει με ΚΕΝΟ: μια εντολή σπασμένη σε γραμμές είναι ΜΙΑ εντολή, και αν διαβαστεί
      // ως πολλές, το «pnpm exec jest» μόνο του μοιάζει με ΟΛΗ τη σουίτα (μετρημένο λάθος).
      let run = chunk[runIndex].slice('run:'.length).trim();
      if (/^[|>][-+]?$/.test(run) || run === '') {
        run = chunk.slice(runIndex + 1).join(run.startsWith('>') ? ' ' : '\n');
      }
      steps.push({
        job,
        run,
        env: stepEnv(stepLines.slice(start, end)),
        continueOnError: jobContinue || chunk.some((b) => /^continue-on-error:\s*true\b/.test(b)),
        conditional: chunk.some((b) => /^if:/.test(b)),
      });
    });
  }
  return steps;
}

module.exports = {
  listWorkflowFiles,
  readWorkflowName,
  readWorkflowRunWatchList,
  readWorkflowRunSteps,
  readWorkflowTriggers,
  // εκτεθειμένα για τα tests — η αυστηρότητα του αναγνώστη ΕΙΝΑΙ ο μηχανισμός
  significantLines,
  scalar,
  childLines,
};
