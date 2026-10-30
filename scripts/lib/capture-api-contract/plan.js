'use strict';
/**
 * CHECK 3.98 (ADR-904 Ε6) — **τι ΠΡΕΠΕΙ να υπάρχει στο `contracts/capture-api/`**, υπολογισμένο από τον κώδικα.
 *
 * Δύο αρχεία, και τα δύο **παράγωγα** του SSoT της εφαρμογής:
 *   openapi.json   — `buildCaptureApiDocument()` (σχήματα zod · κανόνες · αρνήσεις)
 *   fixtures.json  — τα κοινά παραδείγματα, **μόνο** αν κάθε ετυμηγορία συμφωνεί με το σχήμα της
 *
 * 🔑 Το σχέδιο **εκτελεί** τα modules (`ts-module-loader.requireFromInput`), δεν τα διαβάζει ως AST: το `z.toJSONSchema` είναι κώδικας.
 * Ό,τι αποτύχει (import `server-only`, fixture που διαφωνεί, άγνωστο σχήμα) γίνεται `errors` ⇒ τίποτα δεν γράφεται.
 */

const { openGateInput } = require('../gate-input');
const { requireFromInput } = require('../ts-module-loader');

const OUTPUT_ROOT = 'contracts/capture-api';
/** Τα δύο modules που ΕΚΤΕΛΕΙ το σχέδιο — η κλειστότητά τους είναι η είσοδος του συμβολαίου. */
const SOURCES = Object.freeze({
  document: 'src/contracts/capture-api/capture-api-document.ts',
  fixtures: 'src/contracts/capture-api/capture-api-fixtures.ts',
});
const REGENERATE = 'npm run generate:capture-api-contract';

/** JSON με σταθερή μορφή — η σειρά κλειδιών είναι η σειρά κατασκευής (ντετερμινιστική), LF, νέα γραμμή στο τέλος. */
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

/** Κάθε fixture ελέγχεται απέναντι στο σχήμα του — διαφωνία = σφάλμα σχεδίου, όχι «προειδοποίηση». */
function fixtureErrors(fixtures, schemas) {
  const errors = [];
  const names = new Set();
  for (const f of fixtures) {
    if (names.has(f.name)) errors.push(`fixture "${f.name}": duplicate name`);
    names.add(f.name);
    const schema = schemas[f.component];
    if (!schema) { errors.push(`fixture "${f.name}": unknown component "${f.component}"`); continue; }
    const accepted = schema.safeParse(f.body).success;
    if (accepted !== f.valid) {
      errors.push(`fixture "${f.name}": declared ${f.valid ? 'valid' : 'invalid'}, but ${f.component} ${accepted ? 'accepts' : 'rejects'} it`);
    }
  }
  return errors;
}

/**
 * `input` = η είσοδος (ADR-924): τα modules του συμβολαίου ΕΚΤΕΛΟΥΝΤΑΙ από την όψη της — με `--index` η κλειστότητά
 * τους όπως θα δεσμευτεί (`requireFromInput`), ποτέ σιωπηλά ο δίσκος.
 * @returns {{ outputs: Array<{path:string, content:string}>, errors: string[], outputRoot: string }}
 */
function buildPlan(root, input = openGateInput({ root })) {
  let loaded = null;
  try {
    loaded = requireFromInput({ input, entries: [SOURCES.document, SOURCES.fixtures] });
    const [documentModule, { CAPTURE_API_FIXTURES }] = loaded.modules;
    const errors = fixtureErrors(CAPTURE_API_FIXTURES, documentModule.CAPTURE_API_SCHEMAS);
    if (errors.length > 0) return { outputs: [], errors, outputRoot: OUTPUT_ROOT };
    const document = documentModule.buildCaptureApiDocument();
    // JSON round-trip: `undefined` κλειδιά (π.χ. «λείπει το rights») φεύγουν όπως θα έφευγαν στο δίκτυο.
    const fixtures = JSON.parse(JSON.stringify(CAPTURE_API_FIXTURES));
    return {
      outputs: [
        { path: `${OUTPUT_ROOT}/openapi.json`, content: stableJson(document) },
        { path: `${OUTPUT_ROOT}/fixtures.json`, content: stableJson({ contractVersion: document.info.version, fixtures }) },
      ],
      errors: [],
      outputRoot: OUTPUT_ROOT,
    };
  } catch (error) {
    return { outputs: [], errors: [error instanceof Error ? error.message : String(error)], outputRoot: OUTPUT_ROOT };
  } finally {
    if (loaded) loaded.dispose();
  }
}

module.exports = { buildPlan, OUTPUT_ROOT, REGENERATE, SOURCES };
