#!/usr/bin/env node
/**
 * **Η ταυτότητα κάθε project του `playwright.config.ts`**: ποιον user-agent στέλνει στην πράξη
 * και πού γράφει τα golden του.
 *
 * ## 🔴 ΓΙΑΤΙ AST ΚΑΙ ΟΧΙ `playwright test --list --reporter=json`
 * Το προφανές («ρώτα το ίδιο το εργαλείο για τη λυμένη ρύθμιση», όπως το CHECK 3.42 ρωτά το
 * `resolveConfig` του Tailwind) **δοκιμάστηκε και απορρίφθηκε με μέτρηση**: ο JSON reporter
 * εκθέτει `config.projects[].name` αλλά το **`use` έρχεται ΚΕΝΟ** (μετρημένο 2026-08-08,
 * playwright 1.57.0). Πύλη χτισμένη πάνω του θα απαντούσε «κανένα project δεν έχει userAgent»
 * σε **κάθε** εκτέλεση — δηλαδή **7 ψευδώς θετικά**, ή με το κριτήριο ταιριάσματος **«0
 * παραβιάσεις, πάντα»**. Η όγδοη εμφάνιση του «0 = κανείς δεν κοίταξε», γραμμένη από εμάς.
 *
 * ## Η ΑΥΘΕΝΤΙΑ ΤΟΥ UA ΕΙΝΑΙ Η ΒΙΒΛΙΟΘΗΚΗ, ΟΧΙ ΕΜΕΙΣ
 * Τα device descriptors του Playwright **περιέχουν** `userAgent` (τεκμηρίωση: *«The User Agent
 * is included in the device and therefore you will rarely need to change it»*). Άρα ένα project
 * που γράφει `...devices['Desktop Chrome']` **ήδη** στέλνει πραγματικό Chrome UA — έμμεσα, και
 * χωρίς κανείς να το έχει αποφασίσει. Η τιμή διαβάζεται από το **εγκατεστημένο**
 * `@playwright/test`, ώστε μια αναβάθμιση να μη γεννά απόκλιση.
 *
 * ⚠️ **Αυτό είναι που κάνει την πύλη απαραίτητη**: η προστασία υπάρχει αλλά είναι **τυχαία**.
 * Ένα project γραμμένο ως `use: { viewport: {...} }` σκέτο παίρνει **403 χωρίς σώμα** — μήνυμα
 * που δεν λέει τίποτα, σε σουίτα που δεν τρέχει πουθενά για να το πει.
 * Μετρημένο (2026-08-08, headless chromium 143): σκέτο `newContext()` ⇒
 * `HeadlessChrome/143.0.7499.4` ⇒ ταιριάζει στο pattern `headlesschrome`.
 *
 * @module scripts/lib/e2e-executability/project-identity
 */

'use strict';

const path = require('node:path');
const ts = require('typescript');

const { parseSource } = require('../contrast-promise/ts-read');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

/** Το αρχείο που ορίζει τα projects. */
const CONFIG_PATH = 'playwright.config.ts';

/** Το όνομα της εισαγωγής των device descriptors — αλλαγή ⇒ `unanalyzable`, ποτέ σιωπή. */
const DEVICES_IDENTIFIER = 'devices';

// ── πρωτογενείς αναγνώσεις αντικειμένων ─────────────────────────────────────────────

function nameOf(node) {
  if (node === undefined) return null;
  return ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : null;
}

function propertyOf(objectLiteral, name) {
  for (const property of objectLiteral.properties) {
    if (ts.isPropertyAssignment(property) && nameOf(property.name) === name) {
      return property.initializer;
    }
  }
  return null;
}

function stringOf(node) {
  if (node === null || node === undefined) return null;
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null;
}

/** Το `devices['Χ']` ενός spread, ή `null` αν το spread είναι κάτι άλλο. */
function spreadDeviceName(expression) {
  if (!ts.isElementAccessExpression(expression)) return null;
  if (nameOf(expression.expression) !== DEVICES_IDENTIFIER) return null;
  return stringOf(expression.argumentExpression);
}

/** Το αντικείμενο του `export default defineConfig({...})` — ή σκέτου `export default {...}`. */
function configObject(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (!ts.isExportAssignment(statement)) continue;
    const expression = ts.isCallExpression(statement.expression)
      ? statement.expression.arguments[0]
      : statement.expression;
    if (expression !== undefined && ts.isObjectLiteralExpression(expression)) return expression;
  }
  return null;
}

// ── επίλυση του user-agent ──────────────────────────────────────────────────────────

/**
 * Ο user-agent που προκύπτει από ένα `use: {...}` — **με τη σειρά που τον λύνει ο Playwright**:
 * τελευταία ανάθεση κερδίζει, ώστε το `{ ...devices['X'], userAgent: 'ρητό' }` να δίνει το ρητό.
 *
 * @returns {{userAgent: string|null, source: string, unresolved: string[]}}
 */
function resolveUse(useObject, devices) {
  const state = { userAgent: null, source: 'κανένα', unresolved: [] };
  if (useObject === null) return state;

  for (const property of useObject.properties) {
    if (ts.isSpreadAssignment(property)) {
      applySpread(property, devices, state);
    } else if (ts.isPropertyAssignment(property) && nameOf(property.name) === 'userAgent') {
      applyExplicit(property, state);
    }
  }
  return state;
}

function applySpread(property, devices, state) {
  const deviceName = spreadDeviceName(property.expression);
  if (deviceName === null) {
    state.unresolved.push('spread που δεν είναι devices[...]');
    return;
  }
  const descriptor = devices[deviceName];
  if (descriptor === undefined) {
    state.unresolved.push(`devices['${deviceName}'] δεν υπάρχει στο εγκατεστημένο playwright`);
    return;
  }
  if (typeof descriptor.userAgent === 'string') {
    state.userAgent = descriptor.userAgent;
    state.source = `devices['${deviceName}']`;
  }
}

function applyExplicit(property, state) {
  const literal = stringOf(property.initializer);
  if (literal === null) {
    state.unresolved.push('userAgent που δεν είναι string literal');
    return;
  }
  state.userAgent = literal;
  state.source = 'ρητό userAgent';
}

/**
 * Συγχώνευση καθολικού `use` με του project — το project κερδίζει, όπως στον Playwright.
 * Τα `unresolved` **αθροίζονται**: άγνωστο σε οποιοδήποτε επίπεδο σημαίνει άγνωστο συνολικά.
 */
function mergeUse(base, own) {
  const unresolved = [...base.unresolved, ...own.unresolved];
  return own.userAgent !== null
    ? { ...own, unresolved }
    : { userAgent: base.userAgent, source: base.source, unresolved };
}

// ── δημόσια ανάγνωση ────────────────────────────────────────────────────────────────

/**
 * Κάθε project του config, με τον πραγματικό του UA και το πρότυπο golden του.
 *
 * @param {object} [options]
 * @param {string} [options.root] ρίζα repo (οι δοκιμές δίνουν μίνι-repo)
 * @param {object} [options.devices] ένεση για τις δοκιμές· αλλιώς το εγκατεστημένο playwright
 * @returns {{projects: Array<object>, configPath: string, defaultTemplate: string|null}}
 */
function readProjects({ root = PROJECT_ROOT, devices } = {}) {
  // eslint-disable-next-line global-require -- προαιρετική εξάρτηση: το module πρέπει να
  // φορτώνεται και να δοκιμάζεται με ενεμένα descriptors, χωρίς εγκατεστημένο playwright.
  const deviceTable = devices || require('@playwright/test').devices;
  const sourceFile = parseSource(path.join(root, CONFIG_PATH));
  const config = configObject(sourceFile);

  if (config === null) {
    throw new Error(
      `[3.46] δεν βρέθηκε \`export default\` με αντικείμενο ρύθμισης στο ${CONFIG_PATH}.`,
    );
  }

  const baseUse = resolveUse(propertyOf(config, 'use'), deviceTable);
  const defaultTemplate = stringOf(propertyOf(config, 'snapshotPathTemplate'));
  const projectsArray = propertyOf(config, 'projects');

  if (projectsArray === null || !ts.isArrayLiteralExpression(projectsArray)) {
    throw new Error(`[3.46] το \`projects\` του ${CONFIG_PATH} δεν είναι πίνακας literal.`);
  }

  const projects = projectsArray.elements.map((element, index) =>
    readProject(element, index, { baseUse, defaultTemplate, deviceTable }));

  return { projects, configPath: CONFIG_PATH, defaultTemplate };
}

function readProject(element, index, { baseUse, defaultTemplate, deviceTable }) {
  if (!ts.isObjectLiteralExpression(element)) {
    return {
      name: `<project #${index}>`,
      userAgent: null,
      userAgentSource: 'κανένα',
      unresolved: ['το στοιχείο δεν είναι αντικείμενο literal'],
      snapshotTemplate: defaultTemplate,
      templateIsExplicit: false,
    };
  }
  const own = resolveUse(propertyOf(element, 'use'), deviceTable);
  const merged = mergeUse(baseUse, own);
  const ownTemplate = stringOf(propertyOf(element, 'snapshotPathTemplate'));

  return {
    name: stringOf(propertyOf(element, 'name')) ?? `<project #${index}>`,
    userAgent: merged.userAgent,
    userAgentSource: merged.source,
    unresolved: merged.unresolved,
    snapshotTemplate: ownTemplate ?? defaultTemplate,
    templateIsExplicit: ownTemplate !== null || defaultTemplate !== null,
  };
}

module.exports = {
  readProjects,
  resolveUse,
  mergeUse,
  configObject,
  propertyOf,
  spreadDeviceName,
  CONFIG_PATH,
  PROJECT_ROOT,
};
