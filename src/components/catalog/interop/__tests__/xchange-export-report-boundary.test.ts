/**
 * @fileoverview Άγκυρα του ορίου της αναφοράς εξαγωγής xChange (ADR-934 Σ1γ · CHECK 3.34 / ADR-744).
 *
 * Η αναφορά εξαγωγής φαίνεται ΜΟΝΟ αφού κατέβει το αρχείο· τα κλειδιά της (`xchangeExport.report.*`) δεν ανήκουν στο πρώτο
 * φόρτωμα της διαδρομής «Εκδόσεις». Μετρημένο 2026-11-08: με στατική εισαγωγή η κλειστότητα της διαδρομής έφτασε 19471 bytes
 * (> 19190, σφράγιση + 25%) ⇒ η αναφορά μπαίνει στο interop ΜΟΝΟ ως τεμπέλικη επιφάνεια (`interop-surfaces.tsx` ·
 * `defineLazySurfaces`), ώστε το chunk να περιμένει τα κείμενά του. Ένα σκέτο `next/dynamic` δεν αρκεί: δίνει χρέος εισδοχής
 * (ωμό καρέ), και η πύλη το απορρίπτει.
 *
 * ⚠️ Ο έλεγχος ρωτά τον **ίδιο parser** με την πύλη (`scripts/lib/module-graph`), όχι regex: «ακμή» = ό,τι εκείνος λέει ακμή
 *    (και η εισαγωγή τύπου). Κρίνεται ΟΛΗ η κλάση (κάθε module του φακέλου), όχι το ένα αρχείο που έτυχε.
 */

import fs from 'node:fs';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseModule } = require('../../../../../scripts/lib/module-graph') as {
  parseModule: (file: string, text: string) => { imports: ReadonlyArray<{ spec: string; kind: string }> };
};

const INTEROP_DIR = path.resolve(__dirname, '..');
const REPORT_SPEC = './XChangeExportReport';

function interopModules(): string[] {
  return fs.readdirSync(INTEROP_DIR)
    .filter((name) => /\.(ts|tsx)$/.test(name) && name !== 'XChangeExportReport.tsx')
    .map((name) => path.join(INTEROP_DIR, name));
}

function staticReportEdges(file: string): string[] {
  const { imports } = parseModule(file, fs.readFileSync(file, 'utf8'));
  return imports
    .filter((imp) => imp.kind !== 'dynamic' && imp.spec === REPORT_SPEC)
    .map((imp) => `${path.basename(file)} → ${imp.spec}`);
}

describe('catalog/interop — η αναφορά εξαγωγής μένει πίσω από την τεμπέλικη επιφάνεια', () => {
  it('βλέπει τον διάλογο (ο φρουρός δεν σαρώνει κενό)', () => {
    expect(interopModules().map((file) => path.basename(file))).toContain('XChangeExportDialog.tsx');
  });

  it('κανένα module δεν εισάγει στατικά (ούτε ως τύπο) την αναφορά', () => {
    expect(interopModules().flatMap(staticReportEdges)).toEqual([]);
  });

  it('η δυναμική εισαγωγή της αναφοράς ΥΠΑΡΧΕΙ στο μητρώο (αλλιώς ο φρουρός πράσινος για λάθος λόγο)', () => {
    const file = path.join(INTEROP_DIR, 'interop-surfaces.tsx');
    const { imports } = parseModule(file, fs.readFileSync(file, 'utf8'));
    expect(imports).toContainEqual(expect.objectContaining({ kind: 'dynamic', spec: REPORT_SPEC }));
  });
});
