#!/usr/bin/env node
/**
 * **Ποιος μπορεί να εκτελέσει ένα αρχείο test** — ένας matcher ανά εκτελεστή.
 *
 * Εκτελεστής = ένα `jest.config*.js` ή το `playwright.config.ts`. Η ερώτηση εδώ είναι μόνο
 * «**το διεκδικεί;**»· το «είναι αυτό σφάλμα;» ζει στο `census.js`.
 *
 * ## 🔑 Ο MATCHER ΕΙΝΑΙ ΤΟΥ JEST, ΟΧΙ ΔΙΚΟΣ ΜΑΣ
 * Τα `testMatch` χρησιμοποιούν extglob (`?(x)`, `+(spec|test)`, `[jt]s`). Ένας χειρόγραφος
 * μεταφραστής glob→regex θα ήταν **δεύτερη διάλεκτος** που αποκλίνει σιωπηλά από αυτήν που
 * εκτελεί ο κόσμος (ακριβώς το εύρημα του ADR-749: τέσσερις μηχανές, πέντε διάλεκτοι, τρεις
 * αριθμοί). Εδώ φορτώνεται το **ίδιο** `globsToMatcher` του `jest-util` που χρησιμοποιεί το
 * `SearchSource` του jest.
 *
 * **Καλιμπραρισμένο**: ο στατικός matcher αναπαρήγαγε το `jest --listTests` σε **3251 = 3251**,
 * μηδέν απόκλιση **και προς τις δύο κατευθύνσεις**, στο πραγματικό δέντρο, σε Windows. Χωρίς
 * αυτή τη μέτρηση η πύλη θα ήταν εικασία με αριθμό.
 *
 * ⚠️ Αν το `jest-util` δεν βρεθεί, ο κώδικας **πετάει**. Δεν υπάρχει εφεδρικός matcher: μια
 * πύλη που «τα καταφέρνει όπως όπως» θα απαντούσε **λάθος** αντί για **τίποτα**, και το λάθος
 * της θα έμπαινε σε baseline ως γεγονός.
 *
 * @module scripts/lib/jest-partition/executors
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const { parseSource } = require('../contrast-promise/ts-read');
const { configObject, propertyOf } = require('../e2e-executability/project-identity');
const {
  PROJECT_ROOT,
  discoverConfigFiles,
  readConfig,
  substituteRootDir,
  toPosix,
} = require('./jest-configs');

/** Το αρχείο που ορίζει τη σουίτα Playwright. */
const PLAYWRIGHT_CONFIG_FILE = 'playwright.config.ts';

/**
 * Το `globsToMatcher` του **εγκατεστημένου** jest, μέσω της αλυσίδας εξαρτήσεών του.
 *
 * Η αλυσίδα είναι ρητή ώστε η αποτυχία να ονομάζει **ποιον** κρίκο δεν βρήκε — σε pnpm το
 * `jest-util` δεν είναι επιλύσιμο από τη ρίζα (αυστηρό node_modules).
 */
function loadGlobsToMatcher() {
  const chain = ['jest', 'jest-config', 'jest-util'];
  // Πάντα από το **εγκατεστημένο** jest του repo, ποτέ από το δέντρο που αναλύεται: ο matcher
  // είναι η αυθεντία, όχι δεδομένο του υπό εξέταση δέντρου (και οι άγκυρες αναλύουν μίνι-repo
  // εκτός του repo, όπου δεν υπάρχει node_modules).
  let from = PROJECT_ROOT;
  for (const moduleName of chain) {
    try {
      from = path.dirname(require.resolve(moduleName, { paths: [from] }));
    } catch {
      throw new Error(
        `[jest-partition] Δεν βρέθηκε το «${moduleName}» ξεκινώντας από «${from}». Η πύλη ` +
          'αρνείται να ταιριάξει glob με δική της διάλεκτο — εγκατέστησε τις εξαρτήσεις.',
      );
    }
  }
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const { globsToMatcher } = require(require.resolve('jest-util', { paths: [from] }));
  if (typeof globsToMatcher !== 'function') {
    throw new Error('[jest-partition] Το jest-util δεν εκθέτει globsToMatcher — άγνωστη έκδοση.');
  }
  return globsToMatcher;
}

/** Κάθε `jest.config*.js` ως εκτελεστής. */
function jestExecutors(root = PROJECT_ROOT) {
  const globsToMatcher = loadGlobsToMatcher();
  const rootPosix = toPosix(root).replace(/\/+$/, '');

  return discoverConfigFiles(root).map((file) => {
    const config = readConfig(file, root);
    const testMatch = (config.testMatch ?? []).map((glob) => substituteRootDir(toPosix(glob), rootPosix));
    const ignore = (config.testPathIgnorePatterns ?? [])
      .map((pattern) => substituteRootDir(pattern, rootPosix))
      .map((pattern) => new RegExp(pattern));
    const matches = globsToMatcher(testMatch);
    return {
      id: file,
      kind: 'jest',
      claims: (posixAbsolute) => matches(posixAbsolute) && !ignore.some((r) => r.test(posixAbsolute)),
    };
  });
}

/** Κάθε κυριολεκτική συμβολοσειρά ενός array literal, ή `null` αν δεν είναι array. */
function stringLiteralsOf(node) {
  if (node === null || node === undefined) return null;
  if (ts.isStringLiteral(node)) return [node.text];
  if (!ts.isArrayLiteralExpression(node)) return null;
  const values = [];
  for (const element of node.elements) {
    if (!ts.isStringLiteral(element)) return null; // μη αναλύσιμο ⇒ ποτέ μισή απάντηση
    values.push(element.text);
  }
  return values;
}

/**
 * Η σουίτα Playwright ως **ένας** εκτελεστής.
 *
 * ⚠️ Η ερώτηση εδώ είναι «*ανήκει το αρχείο στη σουίτα Playwright;*», **όχι** «*ποιο project
 * το τρέχει;*» — το δεύτερο το απαντά το CHECK 3.46 (ADR-775) και είναι άλλη ευθύνη. Γι' αυτό
 * διαβάζεται το **top-level** `testDir`/`testMatch`: τα per-project `testMatch` είναι πάντα
 * υποσύνολο και δεν αλλάζουν την ιδιοκτησία.
 */
function playwrightExecutor(root = PROJECT_ROOT) {
  const configPath = path.join(root, PLAYWRIGHT_CONFIG_FILE);
  if (!fs.existsSync(configPath)) return null;

  const object = configObject(parseSource(configPath));
  if (object === null) {
    throw new Error(`[jest-partition] Το «${PLAYWRIGHT_CONFIG_FILE}» δεν έχει αναγνωρίσιμο default export.`);
  }
  const testDir = stringLiteralsOf(propertyOf(object, 'testDir'));
  const testMatch = stringLiteralsOf(propertyOf(object, 'testMatch'));
  const testIgnore = stringLiteralsOf(propertyOf(object, 'testIgnore')) ?? [];
  if (testDir === null || testDir.length !== 1 || testMatch === null || testMatch.length === 0) {
    throw new Error(
      `[jest-partition] Το «${PLAYWRIGHT_CONFIG_FILE}» δεν δηλώνει αναλύσιμα testDir/testMatch. ` +
        'Χωρίς αυτά κάθε e2e spec θα φαινόταν ορφανό — η πύλη σταματά αντί να πει ψέματα.',
    );
  }

  const globsToMatcher = loadGlobsToMatcher();
  const base = `${toPosix(path.resolve(root, testDir[0]))}/`;
  const matches = globsToMatcher(testMatch);
  const excluded = testIgnore.length > 0 ? globsToMatcher(testIgnore) : () => false;

  return {
    id: PLAYWRIGHT_CONFIG_FILE,
    kind: 'playwright',
    claims: (posixAbsolute) =>
      posixAbsolute.startsWith(base) && matches(posixAbsolute) && !excluded(posixAbsolute),
  };
}

/** Όλοι οι εκτελεστές του δέντρου. */
function allExecutors(root = PROJECT_ROOT) {
  const playwright = playwrightExecutor(root);
  return playwright === null ? jestExecutors(root) : [...jestExecutors(root), playwright];
}

module.exports = {
  PLAYWRIGHT_CONFIG_FILE,
  allExecutors,
  jestExecutors,
  loadGlobsToMatcher,
  playwrightExecutor,
  stringLiteralsOf,
};
