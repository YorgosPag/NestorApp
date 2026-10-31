/**
 * @fileoverview Άγκυρα του ορίου επαφών της τιμολόγησης (ADR-923 §5.11 «3δ» Σ9 · CHECK 3.34 / ADR-744).
 *
 * Η αναζήτηση επαφών φέρνει όλη την υπηρεσία επαφών και τα κλειδιά της (`dropdown.*` σε 10 `common-*`). Μπαίνει στις
 * διαδρομές εκπτώσεων/τιμοκαταλόγων ΜΟΝΟ μέσω `next/dynamic`. Μετρημένο 2026-10-30: ένα σκέτο
 * `import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown'` αρκούσε για να σύρει τον dropdown
 * στο route slice — ο περιπατητής της πύλης μετρά και την εισαγωγή τύπου ως ακμή.
 *
 * ⚠️ Ο έλεγχος ρωτά τον **ίδιο parser** με την πύλη (`scripts/lib/module-graph`), όχι regex: «ακμή» = ό,τι εκείνος
 *    λέει ακμή. Κρίνεται ΟΛΗ η κλάση (κάθε module του φακέλου), όχι το ένα αρχείο που έτυχε.
 */

import fs from 'node:fs';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseModule } = require('../../../../../scripts/lib/module-graph') as {
  parseModule: (file: string, text: string) => { imports: ReadonlyArray<{ spec: string; kind: string }> };
};

const PRICING_DIR = path.resolve(__dirname, '..');
const CONTACT_SURFACES: readonly string[] = [
  '@/components/contacts/',
  '@/components/ui/enterprise-contact-dropdown',
];

function pricingModules(): string[] {
  return fs.readdirSync(PRICING_DIR)
    .filter((name) => /\.(ts|tsx)$/.test(name))
    .map((name) => path.join(PRICING_DIR, name));
}

function staticContactEdges(file: string): string[] {
  const { imports } = parseModule(file, fs.readFileSync(file, 'utf8'));
  return imports
    .filter((imp) => imp.kind !== 'dynamic')
    .filter((imp) => CONTACT_SURFACES.some((surface) => imp.spec.startsWith(surface)))
    .map((imp) => `${path.basename(file)} → ${imp.spec}`);
}

describe('catalog/pricing — η αναζήτηση επαφών μένει πίσω από next/dynamic', () => {
  it('βλέπει τον επιλογέα (ο φρουρός δεν σαρώνει κενό)', () => {
    expect(pricingModules().map((file) => path.basename(file))).toContain('PricingPartyPicker.tsx');
  });

  it('κανένα module δεν εισάγει στατικά (ούτε ως τύπο) επιφάνεια επαφών', () => {
    expect(pricingModules().flatMap(staticContactEdges)).toEqual([]);
  });

  it('η δυναμική εισαγωγή του ContactSearchManager ΥΠΑΡΧΕΙ (αλλιώς ο φρουρός πράσινος για λάθος λόγο)', () => {
    const file = path.join(PRICING_DIR, 'PricingPartyPicker.tsx');
    const { imports } = parseModule(file, fs.readFileSync(file, 'utf8'));
    expect(imports).toContainEqual(expect.objectContaining({
      kind: 'dynamic',
      spec: '@/components/contacts/relationships/ContactSearchManager',
    }));
  });
});
