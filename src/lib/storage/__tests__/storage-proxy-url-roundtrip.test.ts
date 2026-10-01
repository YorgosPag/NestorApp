/**
 * 🔁 Η ΑΓΚΥΡΑ ROUND-TRIP ΤΟΥ PROXY URL — γραφέας (`buildProxyUrl`) ⇄ αναγνώστης (`storageObjectFromUrl`).
 *
 * Το σχήμα `internal-proxy` ανήκει σε **ένα** module και προς τις δύο κατευθύνσεις (2026-10-01). Ό,τι γράφει ο
 * γραφέας, ο αναγνώστης πρέπει να το διαβάζει πίσω **αυτούσιο** — για κάθε θέση bytes.
 *
 * 🔴 Ρ2 γεννήθηκε από μετρημένο σφάλμα: ο αναγνώστης κρατούσε το `?placement=eu-originals` **μέσα** στο object
 * name (`…jpg?placement=eu-originals`) — δηλαδή κάθε `downloadUrl` ΕΕ (π.χ. τα panoramas) διαβαζόταν σε **λάθος**
 * αντικείμενο. Μετάλλαξη: αφαίρεσε το `.split('?')[0]` του `readProxyPath` ⇒ ΚΟΚΚΙΝΟ.
 */

import { API_ROUTES } from '@/config/domain-constants';
import { FILE_STORAGE_PLACEMENTS } from '@/lib/files/file-storage-placement';

import { FILE_PREVIEW_ENCODING, FILE_PREVIEW_FALLBACK_WIDTH } from '@/lib/files/file-preview-ladder';

import { buildProxyPreview, buildProxyUrl, storageObjectFromUrl } from '../storage-object-url';

const PATH = 'companies/c1/entities/property/p1/domains/sales/categories/photos/files/file_1 εξωτερικό.jpg';

describe('proxy URL — round-trip γραφέα ⇄ αναγνώστη', () => {
  test('Ρ1 το legacy URL είναι αυτολεξεί το πριν-ADR-895 σχήμα (καμία παράμετρος)', () => {
    expect(buildProxyUrl(PATH)).toBe(`${API_ROUTES.STORAGE_FILE}/${PATH.split('/').map(encodeURIComponent).join('/')}`);
  });

  test.each(FILE_STORAGE_PLACEMENTS)('🔴 Ρ2 θέση «%s» ⇒ ο αναγνώστης δίνει πίσω ΑΚΡΙΒΩΣ το ίδιο object name', (placement) => {
    expect(storageObjectFromUrl(buildProxyUrl(PATH, placement))).toEqual({
      outcome: 'object',
      storagePath: PATH,
      scheme: 'internal-proxy',
      bucket: null,
    });
  });

  test.each(FILE_STORAGE_PLACEMENTS)('🔴 Ρ3 κάθε URL παραγώγου (θέση «%s») διαβάζεται πίσω στο ΙΔΙΟ αντικείμενο', (placement) => {
    const { src, srcSet } = buildProxyPreview(PATH, placement);
    const urls = [src, ...srcSet.split(', ').map((entry) => entry.split(' ')[0])];
    for (const url of urls) {
      expect(storageObjectFromUrl(url)).toMatchObject({ outcome: 'object', storagePath: PATH });
      expect(url.startsWith(buildProxyUrl(PATH, placement))).toBe(true);
    }
  });

  test('Ρ4 το srcset = ΟΛΗ η κλίμακα με περιγραφείς w, το src = πλάτος εφεδρείας', () => {
    const { src, srcSet } = buildProxyPreview(PATH, 'eu-originals');
    expect(srcSet.split(', ').map((entry) => entry.split(' ')[1])).toEqual(FILE_PREVIEW_ENCODING.widths.map((w) => `${w}w`));
    expect(src.endsWith(`&w=${FILE_PREVIEW_FALLBACK_WIDTH}`)).toBe(true);
    expect(buildProxyPreview(PATH).src.endsWith(`?w=${FILE_PREVIEW_FALLBACK_WIDTH}`)).toBe(true);
  });
});
