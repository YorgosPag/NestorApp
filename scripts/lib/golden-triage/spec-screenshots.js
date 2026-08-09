'use strict';

/**
 * **Ποιες βάσεις ΑΠΑΙΤΕΙ ένα spec** — ADR-775 §16 (CHECK εγκυρότητας golden).
 *
 * Διαβάζει το AST του spec και επιστρέφει κάθε `toHaveScreenshot('όνομα.png')`.
 *
 * ⚠️ **Fail-closed**: ένα `toHaveScreenshot(variable)` **δεν** σιωπά — επιστρέφεται με
 * `resolved:false` και ο καταναλωτής το ονομάζει ρητή κατάσταση. Ένας σαρωτής που απλώς
 * παραλείπει ό,τι δεν καταλαβαίνει απαντά «όλα εντάξει» ακριβώς εκεί που δεν κοίταξε — το
 * σχήμα που κόστισε 39 golden.
 *
 * ⚠️ Το `toHaveScreenshot()` **χωρίς όρισμα** είναι νόμιμο στον Playwright (το όνομα παράγεται
 * από τον τίτλο του test). Δεν το υποστηρίζουμε σιωπηλά: `resolved:false` με δικό του λόγο.
 */

const path = require('node:path');
const ts = require('typescript');

const { parseSource } = require('../contrast-promise/ts-read');

/**
 * ⚠️ **ΔΥΟ** matchers, όχι ένας: το `bim-3d-visual-regression.spec.ts` καταναλώνει τη βάση του
 * με `toMatchSnapshot('point-entities-3d.png')`. Με μόνο το `toHaveScreenshot`, η **υπαρκτή
 * και ζητούμενη** βάση του θα χαρακτηριζόταν **ορφανή** — μια πύλη που ονομάζει λάθος τη
 * σωστή περίπτωση είναι χειρότερη από πύλη που δεν υπάρχει.
 */
const MATCHERS = ['toHaveScreenshot', 'toMatchSnapshot'];

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function calleeName(node) {
  if (!ts.isCallExpression(node)) return null;
  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee)) return null;
  return callee.name.text;
}

function argumentOf(node) {
  const first = node.arguments[0];
  if (first === undefined) {
    return { resolved: false, reason: 'χωρίς όρισμα (όνομα από τον τίτλο του test)' };
  }
  if (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) {
    return { resolved: true, arg: first.text };
  }
  return { resolved: false, reason: 'το όρισμα δεν είναι κυριολεκτική συμβολοσειρά' };
}

/**
 * @param {string} absSpecFile απόλυτο μονοπάτι του spec
 * @returns {Array<{arg:string|null, resolved:boolean, reason?:string, line:number, file:string}>}
 */
function readScreenshotArgs(absSpecFile) {
  const sourceFile = parseSource(absSpecFile);
  const found = [];
  const visit = (node) => {
    const matcher = calleeName(node);
    if (matcher !== null && MATCHERS.includes(matcher)) {
      const parsed = argumentOf(node);
      found.push({
        ...parsed,
        arg: parsed.arg ?? null,
        matcher,
        line: lineOf(sourceFile, node),
        file: absSpecFile,
      });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return found;
}

/**
 * Λύνει το `snapshotPathTemplate` του Playwright σε **πραγματικό μονοπάτι**.
 *
 * Τα διακριτικά είναι του Playwright, όχι δικά μας — γι' αυτό διαβάζονται από το config
 * (`readProjects`) και **δεν** ξαναγράφονται εδώ ως σταθερές.
 *
 * @param {string} template π.χ. `dir/{testFilePath}/{arg}-{projectName}-{platform}{ext}`
 * @param {{testFileRelative:string, arg:string, projectName:string, platform:string}} tokens
 */
function resolveSnapshotPath(template, tokens) {
  const ext = path.extname(tokens.arg);
  const argNoExt = tokens.arg.slice(0, tokens.arg.length - ext.length);
  return template
    .replace(/\{testFilePath\}/g, tokens.testFileRelative.replace(/\\/g, '/'))
    .replace(/\{testFileName\}/g, path.basename(tokens.testFileRelative))
    .replace(/\{testFileDir\}/g, path.dirname(tokens.testFileRelative).replace(/\\/g, '/'))
    .replace(/\{arg\}/g, argNoExt)
    .replace(/\{projectName\}/g, sanitizeForFilePath(tokens.projectName))
    .replace(/\{platform\}/g, tokens.platform)
    .replace(/\{ext\}/g, ext);
}

/**
 * Ο Playwright «καθαρίζει» **και** το `{projectName}` **και** το `{arg}` πριν τα βάλει σε
 * μονοπάτι. Η κλάση χαρακτήρων είναι **αντιγραμμένη από το `sanitizeForFilePath` του
 * playwright-core** και όχι επινοημένη.
 *
 * 🔴 **Το έπιασε η ίδια η πύλη στην πρώτη της εκτέλεση**: το test ζητά `zoom-0.5x.png` και το
 * αρχείο λέγεται `zoom-0-5x-visual-dxf-win32.png` — η τελεία γίνεται παύλα. Χωρίς αυτό η πύλη
 * ανέφερε `missing-baseline` για βάση που **υπάρχει και είναι σωστή**: ψευδώς θετικό που θα
 * γεννιόταν κόκκινο και θα «λυνόταν» με μετονομασία αρχείου, δηλαδή με **σπάσιμο** της σουίτας.
 */
function sanitizeForFilePath(value) {
  return value.replace(/[\x00-\x2C\x2E-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/g, '-');
}

/** Το όνομα αρχείου που θα γράψει ο Playwright για ένα `arg` — «καθαρισμένο», με την κατάληξη. */
function baselineFileArg(arg) {
  const ext = path.extname(arg);
  return `${sanitizeForFilePath(arg.slice(0, arg.length - ext.length))}${ext}`;
}

module.exports = {
  readScreenshotArgs, resolveSnapshotPath, sanitizeForFilePath, baselineFileArg, MATCHERS,
};
