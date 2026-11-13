'use strict';

/**
 * @fileoverview Φορτώνει τον **ίδιο** κώδικα PDF της παραγωγής έξω από τον bundler (ADR-923 §5.5.1), για τον smoke και για τον
 * γεννήτορα fixture. Ο κώδικας περνά από transpile σε προσωρινά `.mjs` **μέσα** στον φάκελο που δίνεται, ώστε τα `import()` να λύνονται
 * από εκεί. Μία αλήθεια, κανένα αντίγραφο. Το `server-only` είναι φράχτης του bundler, όχι εξάρτηση.
 */

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');

const REPO = path.resolve(__dirname, '../..');
const SERVICE_FILE = path.join(REPO, 'src/services/pdf/pdf-rasterize.service.ts');
const STRUCTURE_FILE = path.join(REPO, 'src/services/pdf/pdf-page-structure.ts');
const WALKER_FILE = path.join(REPO, 'src/services/pdf/pdf-path-walker.ts');
const SERVICE_PROBE = '.pdf-runtime-smoke.mjs';
const STRUCTURE_PROBE = '.pdf-runtime-structure.mjs';
const WALKER_PROBE = '.pdf-runtime-path-walker.mjs';

const transpiled = (source) =>
  ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;

function serviceSource() {
  const source = fs.readFileSync(SERVICE_FILE, 'utf8').replace(/^import 'server-only';$/m, '');
  return transpiled(source).replace(/(['"])\.\/pdf-page-structure\1/, `'./${STRUCTURE_PROBE}'`);
}

function structureSource() {
  return transpiled(fs.readFileSync(STRUCTURE_FILE, 'utf8')).replace(/(['"])\.\/pdf-path-walker\1/, `'./${WALKER_PROBE}'`);
}

/** Τρέχει το `use(service)` πάνω στον κώδικα της παραγωγής και αφήνει τον φάκελο όπως τον βρήκε. */
async function withPdfService(target, use) {
  const servicePath = path.join(target, SERVICE_PROBE);
  const structurePath = path.join(target, STRUCTURE_PROBE);
  const walkerPath = path.join(target, WALKER_PROBE);
  fs.writeFileSync(walkerPath, transpiled(fs.readFileSync(WALKER_FILE, 'utf8')));
  fs.writeFileSync(structurePath, structureSource());
  fs.writeFileSync(servicePath, serviceSource());
  try {
    return await use(await import(pathToFileURL(servicePath).href));
  } finally {
    fs.rmSync(servicePath, { force: true });
    fs.rmSync(structurePath, { force: true });
    fs.rmSync(walkerPath, { force: true });
  }
}

module.exports = { REPO, withPdfService };
