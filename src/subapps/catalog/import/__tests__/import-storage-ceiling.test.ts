/**
 * Το ταβάνι του `storage.rules` για το αρχείο εισαγωγής ≡ `IMPORT_MAX_FILE_BYTES` (ADR-923 §5.5.1). Δύο αριθμοί σε δύο γλώσσες
 * που πρέπει να μένουν ίσοι: ο zod θα δεχόταν αρχείο που ο κάδος μετά θα αρνιόταν, στη μέση του ανεβάσματος.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { IMPORT_MAX_FILE_BYTES } from '../../vocabulary/catalog-import';

describe('ταβάνι αρχείου εισαγωγής', () => {
  it('ο κανόνας του κάδου λέει τον ίδιο αριθμό με το λεξιλόγιο', () => {
    const rules = readFileSync(join(process.cwd(), 'storage.rules'), 'utf8');
    const block = /function isCatalogImportUpload\(\) \{[\s\S]*?request\.resource\.size <= (\d+) \* 1024 \* 1024/.exec(rules);
    expect(Number(block?.[1]) * 1024 * 1024).toBe(IMPORT_MAX_FILE_BYTES);
  });
});
