'use strict';

/**
 * **Η ΣΑΡΩΣΗ** για την πύλη εγκυρότητας βάσεων (ADR-775 §16) — τι υπάρχει, τι ζητείται.
 *
 * Χωριστά από την **κρίση** (`validity.js`) και από την **αναφορά** (`check-golden-validity.js`):
 * εδώ ζουν μόνο αναγνώσεις. Ο διαχωρισμός δεν είναι αισθητικός — είναι ο λόγος που οι δοκιμές
 * μπορούν να τρέξουν πάνω σε **μίνι-repo** και να μεταλλάξουν τις **εισόδους**, αντί να
 * μεταλλάσσουν την ίδια την πύλη και να αποδεικνύουν ταυτολογίες.
 */

const fs = require('node:fs');
const path = require('node:path');

const { readProjects } = require('../e2e-executability/project-identity');
const { collectSourceFiles } = require('../module-graph/scan-config');
const { readScreenshotArgs, baselineFileArg } = require('./spec-screenshots');
const { baselineNameParser } = require('./validity');

/** Ίδιο κριτήριο «τι είναι spec» με το CHECK 3.46 — δύο ορισμοί θα απέκλιναν σιωπηλά. */
const SPEC_PATTERN = /(^|\/)e2e\/.*\.spec\.tsx?$|\.e2e\.spec\.tsx?$/;

const toPosix = (p) => p.split(path.sep).join('/');

function readSpecFiles(root) {
  const rootPosix = toPosix(root);
  return collectSourceFiles(root, ['src'])
    .filter((file) => SPEC_PATTERN.test(file))
    .map((file) => (file.startsWith(rootPosix) ? file.slice(rootPosix.length + 1) : file))
    .sort();
}

function* walkPngs(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkPngs(full);
    else if (entry.name.toLowerCase().endsWith('.png')) yield full;
  }
}

function readBaselineFiles(root, templates, projectNames) {
  const byPath = new Map();
  for (const template of templates) {
    const rootDir = path.join(root, template.split('{')[0]);
    if (!fs.existsSync(rootDir)) continue;
    const parser = baselineNameParser(template, projectNames);
    for (const abs of walkPngs(rootDir)) {
      if (byPath.has(abs)) continue;
      byPath.set(abs, describeBaseline(abs, rootDir, parser));
    }
  }
  return [...byPath.values()];
}

function describeBaseline(abs, rootDir, parser) {
  const rel = toPosix(path.relative(rootDir, abs));
  const specDir = path.posix.dirname(rel);
  const match = parser.exec(path.posix.basename(rel));
  if (match === null) {
    return { absPath: abs, rel, specDir, project: '<αδιάγνωστο>', arg: null, unparsed: true };
  }
  return {
    absPath: abs,
    rel,
    specDir,
    project: match.groups.project,
    arg: `${match.groups.arg}${match.groups.ext}`,
    unparsed: false,
  };
}

function readExpectations(root, specFiles) {
  const expectations = [];
  for (const rel of specFiles) {
    const specDir = rel.replace(/^src\//, '');
    for (const found of readScreenshotArgs(path.join(root, rel))) {
      expectations.push({
        ...found,
        specFile: rel,
        specDir,
        // Κλειδί αντιστοίχισης = το όνομα **αρχείου** που γράφει ο Playwright, όχι το όρισμα
        // του test: `zoom-0.5x.png` → `zoom-0-5x.png`.
        argFile: found.resolved ? baselineFileArg(found.arg) : null,
      });
    }
  }
  return expectations;
}

/** Ό,τι χρειάζεται η κρίση, από ένα **οποιοδήποτε** repo root (η δοκιμή δίνει μίνι-repo). */
function scanRepo(root) {
  const { projects } = readProjects({ root });
  const projectNames = projects.map((p) => p.name);
  const templates = [...new Set(projects.map((p) => p.snapshotTemplate).filter(Boolean))];
  const specFiles = readSpecFiles(root);
  return {
    projects,
    templates,
    specFiles,
    files: readBaselineFiles(root, templates, projectNames),
    expectations: readExpectations(root, specFiles),
  };
}

module.exports = { scanRepo, readSpecFiles, readBaselineFiles, readExpectations, SPEC_PATTERN };
