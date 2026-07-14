/**
 * ADR-655 — Tests ταυτότητας πακέτου: URL building + το **allowlist parsing** (σημείο ασφαλείας).
 *
 * Το `parseAssetPackFileName` είναι η πρώτη γραμμή άμυνας του proxy: ό,τι δεν αναλύεται σε
 * `{assetId, variant}` απορρίπτεται ΠΡΙΝ αγγίξει το Storage. Σε συνδυασμό με τον strict έλεγχο
 * `Set.has(assetId)`, το path traversal δεν έχει επιφάνεια — δεν βασιζόμαστε σε anti-traversal regex.
 */

import {
  ASSET_PACKS,
  assetPackAssetUrl,
  assetPackFileName,
  assetPackStoragePath,
  getAssetPack,
  parseAssetPackFileName,
} from '../asset-pack-registry';

const pack = ASSET_PACKS['furniture-plan-2d'];

describe('getAssetPack', () => {
  it('βρίσκει γνωστό pack', () => {
    expect(getAssetPack('furniture-plan-2d')?.id).toBe('furniture-plan-2d');
  });

  it('γυρίζει null για άγνωστο id (ποτέ σιωπηλό fallback)', () => {
    expect(getAssetPack('δεν-υπάρχει')).toBeNull();
  });
});

describe('ταυτότητα του furniture-plan-2d', () => {
  it('είναι entitled by default — fail-closed, ποτέ public κατά λάθος', () => {
    expect(pack.defaultStatus).toBe('entitled');
  });

  it('δεν επιτρέπει αναδιανομή', () => {
    expect(pack.license.redistributable).toBe(false);
  });

  it('το allowlist γεμίζει από τον κατάλογο (μηδέν αντιγραφή ids)', () => {
    const ids = pack.listAssetIds();
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain('furn-obj-001-1');
  });
});

describe('ADR-654 M6 — entourage packs (people + vehicles)', () => {
  it('και τα δύο νέα packs υπάρχουν και είναι entitled (fail-closed)', () => {
    for (const id of ['people-plan-2d', 'vehicles-plan-2d'] as const) {
      const p = getAssetPack(id);
      expect(p?.id).toBe(id);
      expect(p?.defaultStatus).toBe('entitled');
      expect(p?.license.redistributable).toBe(false);
    }
  });

  it('το allowlist κάθε pack γεμίζει από τον δικό του κατάλογο', () => {
    const people = ASSET_PACKS['people-plan-2d'].listAssetIds();
    const vehicles = ASSET_PACKS['vehicles-plan-2d'].listAssetIds();
    expect(people.length).toBeGreaterThan(0);
    expect(people).toContain('ppl-obj-001-1');
    expect(vehicles.length).toBeGreaterThan(0);
    expect(vehicles).toContain('veh-obj-010-1');
    // Δεν μπερδεύονται τα allowlists των δύο packs.
    expect(vehicles).not.toContain('ppl-obj-001-1');
  });
});

describe('URL + storage path', () => {
  it('το URL είναι same-origin και περιέχει την έκδοση', () => {
    expect(assetPackAssetUrl(pack, 'furn-obj-001-1')).toBe(
      '/api/asset-packs/furniture-plan-2d/v1/furn-obj-001-1.webp',
    );
  });

  it('το thumbnail variant έχει δικό του όνομα', () => {
    expect(assetPackAssetUrl(pack, 'furn-obj-001-1', 'thumb')).toBe(
      '/api/asset-packs/furniture-plan-2d/v1/furn-obj-001-1.thumb.webp',
    );
  });

  it('το storage path είναι versioned (⇒ immutable caching + rollback)', () => {
    expect(assetPackStoragePath(pack, 'furn-obj-001-1.webp')).toBe(
      'asset-packs/furniture-plan-2d/v1/furn-obj-001-1.webp',
    );
  });
});

describe('parseAssetPackFileName — allowlist gate', () => {
  it('κάνει round-trip με το assetPackFileName', () => {
    for (const variant of ['full', 'thumb'] as const) {
      const fileName = assetPackFileName('furn-obj-001-1', variant);
      expect(parseAssetPackFileName(fileName)).toEqual({ assetId: 'furn-obj-001-1', variant });
    }
  });

  it('ξεχωρίζει thumb από full (το .thumb.webp ΔΕΝ διαβάζεται ως full)', () => {
    expect(parseAssetPackFileName('x.thumb.webp')).toEqual({ assetId: 'x', variant: 'thumb' });
    expect(parseAssetPackFileName('x.webp')).toEqual({ assetId: 'x', variant: 'full' });
  });

  it('απορρίπτει ό,τι δεν είναι .webp', () => {
    expect(parseAssetPackFileName('secret.json')).toBeNull();
    expect(parseAssetPackFileName('furn-obj-001-1')).toBeNull();
    expect(parseAssetPackFileName('')).toBeNull();
  });

  it('traversal payloads δεν επιβιώνουν του allowlist', () => {
    // Το όνομα μπορεί να «αναλυθεί», αλλά το assetId δεν είναι ΠΟΤΕ στον κατάλογο ⇒ 404.
    const parsed = parseAssetPackFileName('../../etc/passwd.webp');
    const allowlist = new Set(pack.listAssetIds());
    expect(parsed).not.toBeNull();
    expect(allowlist.has(parsed!.assetId)).toBe(false);
  });
});
