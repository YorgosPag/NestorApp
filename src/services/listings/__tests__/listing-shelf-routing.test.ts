/**
 * @fileoverview 🧭 **ΥΛΙΚΟ → ΡΑΦΙ → ΣΥΝΤΑΓΗ** — ADR-845 Φ4.2β · ADR-920 §14.9 Γ.
 * @related services/listings/listing-shelf-routing.ts
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: κάθε είδος του λεξιλογίου έχει ράφι **και** συνταγή, και η συνταγή είναι η **ίδια** συμβολοσειρά που
 * γράφει το ράφι. Αλλιώς το βραδινό πέρασμα θα έκρινε την αγγελία με άλλη συνταγή από αυτή που την ψήνει, και θα
 * έλεγε «παλιά» κάθε βράδυ ή «σωστή» για πάντα.
 */

import { LISTING_MATERIAL_KINDS, type ListingMaterial } from '@/lib/listings/listing-material';
import {
  LISTING_MODEL_SHELF,
  LISTING_SHELF,
  LISTING_TERRAIN_SHELF,
  LISTING_VIDEO_SHELF,
  shelfRecipe,
} from '@/services/upload/utils/public-shelf-kinds';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';

import { listingShelfLaneOf, listingShelfRecipesOf } from '../listing-shelf-routing';

/** Μόνο το `kind` διαβάζεται από τον διακόπτη· τα υπόλοιπα πεδία του σκέλους δεν αφορούν τη δρομολόγηση. */
const materialOf = (kind: ListingMaterial['kind']): ListingMaterial => ({ kind }) as ListingMaterial;
const sourceOf = (kind: ListingMaterial['kind']): PublicShelfSource<ListingMaterial> =>
  ({ privateStoragePath: `companies/c/${kind}`, material: materialOf(kind) }) as PublicShelfSource<ListingMaterial>;

const RASTER = shelfRecipe(LISTING_SHELF.encoding, LISTING_SHELF.framingOf(materialOf('photo')));

describe('listingShelfLaneOf — ΚΑΘΕ είδος έχει ράφι', () => {
  it.each(LISTING_MATERIAL_KINDS)('%s ⇒ ένα από τα τέσσερα ράφια', (kind) => {
    expect(['raster', 'model', 'video', 'terrain']).toContain(listingShelfLaneOf(materialOf(kind)));
  });

  it('🔴 άγνωστο είδος ⇒ πετά ΟΝΟΜΑΣΤΙΚΑ, ποτέ σιωπηλό ράφι', () => {
    expect(() => listingShelfLaneOf(materialOf('hologram' as ListingMaterial['kind']))).toThrow(/άγνωστο είδος υλικού/u);
  });
});

describe('listingShelfRecipesOf — η ΙΔΙΑ συνταγή με το ράφι', () => {
  it('raster (φωτογραφία · κάτοψη · κάτοψη ορόφου) ⇒ η συνταγή του raster ραφιού', () => {
    for (const kind of ['photo', 'floorplan', 'floorPlate'] as const) expect(listingShelfRecipesOf(sourceOf(kind))).toEqual([RASTER]);
  });

  it('μοντέλο · έδαφος ⇒ η συνταγή του ΔΙΚΟΥ τους ραφιού', () => {
    expect(listingShelfRecipesOf(sourceOf('model'))).toEqual([shelfRecipe(LISTING_MODEL_SHELF.encoding)]);
    expect(listingShelfRecipesOf(sourceOf('terrain'))).toEqual([shelfRecipe(LISTING_TERRAIN_SHELF.encoding)]);
  });

  it('🔑 βίντεο ⇒ ΔΥΟ συνταγές: MP4 και το raster εξώφυλλο', () => {
    expect(listingShelfRecipesOf(sourceOf('video'))).toEqual([shelfRecipe(LISTING_VIDEO_SHELF.encoding), RASTER]);
  });

  it('🏆 Β6.9 — η αναθεώρηση του builder εδάφους φτάνει στη συνταγή που κρίνει το βραδινό πέρασμα', () => {
    expect(listingShelfRecipesOf(sourceOf('terrain'))[0]).toMatch(/-b\d+$/u);
  });
});
