/**
 * @jest-environment node
 */

/**
 * ADR-603 §Ασπίδα — οι υπηρεσίες πίσω από τα routes προμηθειών του `defineRoute` **δεν** ρίχνουν σκέτο `Error`.
 *
 * Το σύνορο κρατά το μήνυμα **μόνο** για τυποποιημένο σφάλμα (`ProcurementRuleError`, `PurchaseOrderNotFoundError`,
 * ονομασμένα σφάλματα πεδίου). Ένα σκέτο `new Error('Cannot edit PO in status …')` θα έφτανε στον χρήστη ως γενικό
 * «Failed to …» — η οπισθοδρόμηση που η ανασκόπηση ασφαλείας ζήτησε να κλείσει. Η άγκυρα κοιτά τον **κώδικα**, γιατί τα
 * tests των routes κάνουν mock τις υπηρεσίες και δεν θα έβλεπαν ποτέ μια υπηρεσία που ξαναγράφει `new Error(`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Το κλειστό σύνολο: όσες υπηρεσίες καλούν τα routes `procurement/**` που περνούν από το `defineRoute`. */
const SERVICES = [
  'src/services/procurement/po-status-service.ts',
  'src/services/procurement/procurement-service.ts',
  'src/services/procurement/procurement-repository.ts',
  'src/subapps/procurement/services/material-service.ts',
  'src/subapps/procurement/services/framework-agreement-service.ts',
  'src/subapps/procurement/services/sourcing-event-service.ts',
  'src/subapps/procurement/services/rfq-line-service.ts',
] as const;

const PLAIN_THROW = /throw\s+new\s+Error\s*\(/;

describe('υπηρεσίες προμηθειών του `defineRoute` — κανένα σκέτο `throw new Error(`', () => {
  it.each(SERVICES)('%s', (file) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    const lines = source
      .split('\n')
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => PLAIN_THROW.test(line) && !line.trim().startsWith('*') && !line.trim().startsWith('//'));
    expect(lines.map(({ line, number }) => `${number}: ${line.trim()}`)).toEqual([]);
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: η κανονική έκφραση πιάνει το σχήμα που απαγορεύει', () => {
    expect(PLAIN_THROW.test("if (!po) throw new Error(`PO not found: ${poId}`);")).toBe(true);
    expect(PLAIN_THROW.test('throw new ProcurementRuleError(`Invalid transition`);')).toBe(false);
  });
});
