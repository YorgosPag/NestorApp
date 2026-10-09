/**
 * Άγκυρες του γραφέα του `videos[]` (ADR-907 §10 · CHECK 3.76). Οι τίτλοι των `describe` είναι **δηλωμένοι** στο
 * `scripts/lib/listing-model-custody/contract.js` — μετονομασία εδώ χωρίς αλλαγή εκεί κοκκινίζει την πύλη, επίτηδες.
 */

import { LISTING_MATERIAL_KEYS } from '@/lib/listings/listing-authorship';
import { PUBLIC_LISTING_SCHEMA_VERSION, upgradeListingDocument } from '@/lib/listings/public-listing-schema';
import type { PublicListing } from '@/types/public-listing';

import { withPublishedVideos, type ProjectedShelfVideo } from '../public-listing-video-projection';

const VIDEO: ProjectedShelfVideo = {
  url: 'https://storage.googleapis.com/public-media/listings/prop_1/' + 'a'.repeat(64) + '.mp4',
  at: '2026-10-07T09:00:00.000Z',
  durationSec: 74.5,
  width: 1080,
  height: 1920,
  poster: null,
};

/** Μόνο ό,τι διαβάζει ο γραφέας — ο πλήρης τύπος έχει δεκάδες πεδία που δεν τον αφορούν. */
function listing(authorship: PublicListing['authorship']): PublicListing {
  const partial: Pick<PublicListing, 'authorship' | 'videos'> = { authorship, videos: [] };
  return partial as PublicListing;
}

describe('Β-1 — ΤΟ `videos[]` ΧΤΙΖΕΤΑΙ ΑΠΟ ΤΗΝ ΑΝΑΦΟΡΑ ΤΟΥ ΡΑΦΙΟΥ', () => {
  it('ό,τι μέτρησε ο ψήστης φτάνει αυτούσιο στο δημόσιο έγγραφο', () => {
    const [video] = withPublishedVideos(listing('agency'), [VIDEO]).videos;

    expect(video.value).toMatchObject({ url: VIDEO.url, width: 1080, height: 1920, durationSec: 74.5 });
  });

  it('κενή αναφορά ⇒ κενό κουτί — ό,τι είχε η αγγελία πριν ΔΕΝ επιβιώνει', () => {
    const published = withPublishedVideos(listing('agency'), [VIDEO]);

    expect(withPublishedVideos(published, []).videos).toEqual([]);
  });

  it('η σειρά είναι η σειρά της αναφοράς — καμία ταξινόμηση', () => {
    const second = { ...VIDEO, url: VIDEO.url.replace('aaaa', 'bbbb') };

    expect(withPublishedVideos(listing('agency'), [second, VIDEO]).videos.map((v) => v.value.url)).toEqual([
      second.url,
      VIDEO.url,
    ]);
  });

  it('χωρίς καρέ από το raster ράφι το εξώφυλλο γράφεται `null` — δεν μαντεύεται από το βίντεο', () => {
    expect(withPublishedVideos(listing('agency'), [VIDEO]).videos[0].value.poster).toBeNull();
  });

  it('🔴 το εξώφυλλο φτάνει όπως το έβγαλε το ράφι, με το `altKey` ΤΟΥ ΒΙΝΤΕΟ (ADR-907 §10.8)', () => {
    const poster = { url: 'https://shelf/p-1280.webp', width: 1280, height: 720, sources: [{ url: 'https://shelf/p-1280.webp', width: 1280 }] };
    const [video] = withPublishedVideos(listing('owner-declared'), [{ ...VIDEO, poster }]).videos;

    expect(video.value.poster).toEqual({ ...poster, altKey: LISTING_MATERIAL_KEYS['owner-declared'].videoAlt });
  });
});

describe('Β-2 — Η ΠΡΟΕΛΕΥΣΗ ΕΙΝΑΙ `declared` ΚΑΙ Η ΣΤΙΓΜΗ ΕΙΝΑΙ ΤΗΣ ΠΗΓΗΣ', () => {
  it('🔑 `declared`, ποτέ `measured`: μετρήσαμε τη ΜΟΡΦΗ του βίντεο, όχι το περιεχόμενό του', () => {
    const [video] = withPublishedVideos(listing('agency'), [VIDEO]).videos;

    expect(video.provenance).toBe('declared');
    expect(video.at).toBe(VIDEO.at);
  });

  it.each(['agency', 'owner-declared'] as const)('το `altKey` διαλέγεται από την authorship «%s»', (authorship) => {
    const [video] = withPublishedVideos(listing(authorship), [VIDEO]).videos;

    expect(video.value.altKey).toBe(LISTING_MATERIAL_KEYS[authorship].videoAlt);
    expect(video.value.altKey).toMatch(/^listing-detail:video\.alt\./);
  });
});

describe('ο κρίκος 18 του δημόσιου σχήματος', () => {
  it('έγγραφο της έκδοσης 17 αποκτά ΚΕΝΟ `videos` — `doc.videos.map` δεν συναντά ποτέ `undefined`', () => {
    const upgraded = upgradeListingDocument({ schemaVersion: 17, models: [] });

    expect(upgraded.videos).toEqual([]);
    expect(upgraded.schemaVersion).toBe(PUBLIC_LISTING_SCHEMA_VERSION);
  });

  it('σκουπίδι στη θέση του πίνακα ⇒ κενό, όχι εξαίρεση (ιδιοδύναμο)', () => {
    expect(upgradeListingDocument({ schemaVersion: 17, videos: 'nope' }).videos).toEqual([]);
  });
});
