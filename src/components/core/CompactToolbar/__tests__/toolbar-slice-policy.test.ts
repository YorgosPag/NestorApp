/**
 * ADR-781 §19 — οι δυναμικές κλήσεις του `CompactToolbar` απέναντι στο `dynamicKeyPolicy`.
 *
 * Το `t(placeholder)` και το `t(tooltipKey)` διαβάζουν από το `config` του καλούντος, άρα ο γεννήτορας
 * δέχεται τη λίστα κλειδιών που γράφει άνθρωπος. Η λίστα ήταν αληθής για ΜΙΑ διαμόρφωση (`quotes`). Όταν
 * οι σελίδες προμηθειών απέκτησαν route slice, τα `vendors`/`procurement` έμεναν ωμά στο πρώτο καρέ χωρίς
 * να κοκκινίζει τίποτα πριν τον χρησμό. Εδώ η λίστα ΕΚΤΕΛΕΙΤΑΙ απέναντι στις πραγματικές διαμορφώσεις.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  agreementsToolbarConfig,
  materialsToolbarConfig,
  procurementToolbarConfig,
  quotesToolbarConfig,
  vendorsToolbarConfig,
} from '../configs';
import type { CompactToolbarConfig } from '../types';

interface PolicyEntry { readonly keys?: readonly string[]; readonly prefixes?: readonly string[] }

const ROOT = path.join(__dirname, '..', '..', '..', '..', '..');
const policy = (JSON.parse(fs.readFileSync(path.join(ROOT, '.i18n-shell-slice.json'), 'utf8')) as {
  dynamicKeyPolicy: Record<string, PolicyEntry>;
}).dynamicKeyPolicy;

const answered = (file: string, key: string): boolean => {
  const entry = policy[`src/components/core/CompactToolbar/${file}`];
  return (entry?.keys ?? []).some((known) => known === key || known.endsWith(`:${key}`))
    || (entry?.prefixes ?? []).some((prefix) => key.startsWith(`${prefix}.`));
};

const CONFIGS: ReadonlyArray<readonly [string, CompactToolbarConfig]> = [
  ['procurement', procurementToolbarConfig],
  ['quotes', quotesToolbarConfig],
  ['vendors', vendorsToolbarConfig],
  ['materials', materialsToolbarConfig],
  ['agreements', agreementsToolbarConfig],
];

describe('CompactToolbar — dynamicKeyPolicy απέναντι στις διαμορφώσεις με route slice', () => {
  test.each(CONFIGS)('%s — placeholder και tooltip «νέο» δηλωμένα', (_name, config) => {
    const missing = [config.searchPlaceholder, config.tooltips.newItem].filter((key) => !answered('CompactToolbar.tsx', key));
    expect(missing).toEqual([]);
  });

  test.each(CONFIGS)('%s — κάθε ετικέτα ταξινόμησης δηλωμένη', (_name, config) => {
    const labels = (config.sortOptions ?? []).flatMap((option) => [option.ascLabel, option.descLabel]);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.filter((key) => !answered('CompactToolbarActions.tsx', key))).toEqual([]);
  });
});
