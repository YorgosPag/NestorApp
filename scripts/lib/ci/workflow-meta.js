'use strict';

/**
 * ADR-757 — Ανάγνωση των ΔΥΟ πεδίων ενός workflow που αφορούν την ιεράρχηση πυλών:
 *   1. το `name:` (αυτό που βλέπει ο άνθρωπος στο email και στο Actions UI)
 *   2. τη λίστα `on.workflow_run.workflows:` (αυτό που παρακολουθεί ο συγκεντρωτής)
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

module.exports = {
  listWorkflowFiles,
  readWorkflowName,
  readWorkflowRunWatchList,
  // εκτεθειμένα για τα tests — η αυστηρότητα του αναγνώστη ΕΙΝΑΙ ο μηχανισμός
  significantLines,
  scalar,
  childLines,
};
