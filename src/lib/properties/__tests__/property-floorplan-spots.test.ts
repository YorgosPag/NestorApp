/**
 * @fileoverview **Κατόψεις ακινήτου με σημεία λήψης** (ADR-899 §4 · ADR-897).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Κ1: ο δείκτης φωτογραφίας παίρνεται από τη σειρά ανάγνωσης αντί για τη σειρά της γκαλερί ⇒ σημείο → λάθος φωτογραφία.
 * - Κ2: κάτοψη χωρίς σημεία «τρώει» τον αριθμό της ⇒ η «Κάτοψη 2» λέει άλλο πράγμα από τη σελίδα κατόψεων.
 * - Κ3: κάτοψη PDF μπαίνει στο πάνελ ⇒ `<img>` σε PDF.
 * - Κ4: επινοημένες διαστάσεις ⇒ κώνοι σε λάθος αναλογία · μετρημένες (ADR-899 §3.7) χάνονται.
 * - Κ5: σημείο προς κάτοψη που δεν υπάρχει πια γίνεται πιστευτό.
 */

import { buildProxyPreview } from '@/lib/storage/storage-object-url';

import { propertyFloorplanSpotsOf } from '../property-floorplan-spots';
import { propertyPhotosOf } from '../property-photos';

const pathOf = (id: string, ext = 'jpg') => `companies/c1/entities/property/p1/files/${id}.${ext}`;
const image = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, displayName: id, storagePath: pathOf(id), contentType: 'image/jpeg', ...extra });
const spot = (floorplanFileId: string, x = 0.5) => ({ floorplanFileId, x, y: 0.5, headingRad: 1, fovRad: 1 });

const PHOTO_FILES = [image('photo_a'), image('photo_b'), image('photo_c')];
const PLANS = [image('plan_ground'), image('plan_first'), { ...image('plan_pdf'), storagePath: pathOf('plan_pdf', 'pdf'), contentType: 'application/pdf' }];

function entriesFor(declaration: Record<string, unknown>) {
  const { photos } = propertyPhotosOf(PHOTO_FILES, declaration);
  return propertyFloorplanSpotsOf(photos, PLANS, declaration);
}

describe('propertyFloorplanSpotsOf', () => {
  it('🔴 Κ1 ο δείκτης είναι η θέση στη γκαλερί (εξώφυλλο πρώτο)', () => {
    const [entry] = entriesFor({
      publishedMediaOrder: ['photo_c'],
      publishedPhotoCaptureSpots: { photo_c: spot('plan_ground', 0.2), photo_b: spot('plan_ground', 0.8) },
    });
    expect(entry.photos.map((p) => [p.imageIndex, p.spot.x])).toEqual([[0, 0.2], [2, 0.8]]);
  });

  it('🔴 Κ2 κάτοψη χωρίς σημεία δεν εμφανίζεται αλλά κρατά τον αριθμό της· η δηλωμένη σειρά νικά', () => {
    const entries = entriesFor({
      publishedFloorplans: ['plan_first', 'plan_ground'],
      publishedPhotoCaptureSpots: { photo_a: spot('plan_ground') },
    });
    expect(entries.map((e) => [e.key, e.ordinal])).toEqual([['plan_ground', 2]]);
  });

  it('🔴 Κ3 μόνο κατόψεις-εικόνες· 🔴 Κ4 διαστάσεις άγνωστες, URL από την κλίμακα', () => {
    const entries = entriesFor({ publishedPhotoCaptureSpots: { photo_a: spot('plan_pdf'), photo_b: spot('plan_ground') } });
    expect(entries.map((e) => e.key)).toEqual(['plan_ground']);
    const { src, srcSet } = buildProxyPreview(pathOf('plan_ground'));
    expect(entries[0].figure).toEqual({
      src,
      srcSet,
      alt: 'plan_ground',
      width: null,
      height: null,
      northRad: null,
    });
  });

  it('🔴 Κ4 μετρημένες διαστάσεις (ADR-899 §3.7) ⇒ το σχήμα τις παίρνει, η κλίμακα κόβεται', () => {
    const plans = [image('plan_ground', { imageDimensions: { width: 1200, height: 800 } })];
    const { photos } = propertyPhotosOf(PHOTO_FILES, { publishedPhotoCaptureSpots: { photo_a: spot('plan_ground') } });
    const [entry] = propertyFloorplanSpotsOf(photos, plans, { publishedPhotoCaptureSpots: { photo_a: spot('plan_ground') } });
    expect(entry.figure).toMatchObject({ width: 1200, height: 800 });
    expect(entry.figure.srcSet).toBe(buildProxyPreview(pathOf('plan_ground'), 'legacy-default', { width: 1200, height: 800 }).srcSet);
  });

  it('ο δηλωμένος βορράς ταξιδεύει', () => {
    const [entry] = entriesFor({
      publishedPhotoCaptureSpots: { photo_a: spot('plan_ground') },
      publishedFloorplanNorth: { plan_ground: 1.5 },
    });
    expect(entry.figure.northRad).toBe(1.5);
  });

  it('🔴 Κ5 σημείο προς κάτοψη που δεν υπάρχει ⇒ αγνοείται', () => {
    expect(entriesFor({ publishedPhotoCaptureSpots: { photo_a: spot('plan_deleted') } })).toEqual([]);
  });
});
