/**
 * @jest-environment node
 *
 * @fileoverview **Άγκυρα: το ταβάνι των κανόνων Storage = το μέγιστο όριο ανά είδος μέσου** (ADR-923 §5.10.3).
 *
 * Οι κανόνες Storage δεν εισάγουν TypeScript ⇒ ο αριθμός ζει **δύο** φορές. Αυτή η άγκυρα τους κρατά ίσους και κλειδώνει
 * τον **τελεστή** (`<=`): το emulator test αποδεικνύει ότι το σκέλος είναι καλωδιωμένο, αλλά ένα πραγματικό ανέβασμα
 * 500 MB + 1 θα ήταν 1 GB μεταφοράς ανά εκτέλεση.
 *
 * Μεταλλάξεις που πρέπει να πιάσει: όριο ανά είδος που ξεπερνά το ταβάνι των κανόνων (το ανέβασμα θα κοβόταν πριν φτάσει
 * στον server) · `<` αντί για `<=` · σκέλος που χάθηκε από το `allow write`.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { CATALOG_ASSET_MAX_BYTES, CATALOG_ASSET_UPLOAD_CEILING_BYTES } from '../asset-files';

const RULES = readFileSync(join(process.cwd(), 'storage.rules'), 'utf8');

function catalogLeg(): string {
  const match = /function isCatalogAssetUpload\(\) \{([\s\S]*?)\n\s*\}/.exec(RULES);
  if (match === null) throw new Error('isCatalogAssetUpload() δεν βρέθηκε στο storage.rules');
  return match[1];
}

describe('ταβάνι μέσων καταλόγου — storage.rules ⇔ CATALOG_ASSET_MAX_BYTES', () => {
  it('🔑 το σκέλος συγκρίνει με `<=` ακριβώς το ταβάνι της σταθεράς', () => {
    const size = /request\.resource\.size\s*(<=?)\s*(\d+)\s*\*\s*1024\s*\*\s*1024/.exec(catalogLeg());
    expect(size).not.toBeNull();
    expect(size?.[1]).toBe('<=');
    expect(Number(size?.[2]) * 1024 * 1024).toBe(CATALOG_ASSET_UPLOAD_CEILING_BYTES);
  });

  it('το σκέλος δέχεται ΜΟΝΟ `catalog_asset` και είναι στο `allow write`', () => {
    expect(catalogLeg()).toMatch(/entityType == 'catalog_asset'/);
    expect(RULES).toMatch(/isValidFileSize\(\) \|\| isListingVideoUpload\(\) \|\| isCatalogAssetUpload\(\)/);
  });

  it('κανένα όριο είδους δεν ξεπερνά το ταβάνι (αλλιώς οι κανόνες θα έκοβαν πριν κρίνει ο server)', () => {
    for (const bytes of Object.values(CATALOG_ASSET_MAX_BYTES)) expect(bytes).toBeLessThanOrEqual(CATALOG_ASSET_UPLOAD_CEILING_BYTES);
    expect(Object.values(CATALOG_ASSET_MAX_BYTES)).toContain(CATALOG_ASSET_UPLOAD_CEILING_BYTES);
  });
});
