/**
 * @fileoverview ΑΓΚΥΡΑ — **η μικρογραφία της κάρτας του κατόχου** (ADR-777 §8.70).
 * @related lib/owner-property/owner-listing-thumbnail.ts
 *
 * 🔑 Δύο ερωτήσεις: ο **γραφέας** αφαιρεί το `altKey` (που «παγώνει» σε αποθηκευμένα έγγραφα),
 * και ο **αναγνώστης** δεν αφήνει ποτέ σκουπίδι του δίσκου να φτάσει σε `<img>`.
 */

import { publicationThumbnailOf, thumbnailFromLead } from '../owner-listing-thumbnail';
import type { ListingImage } from '@/types/public-listing';
import type { OwnerPropertyPublication } from '@/types/owner-property';

const LEAD: ListingImage = {
  url: 'https://shelf/0-2560.webp',
  width: 2560,
  height: 1700,
  altKey: 'listing-detail:gallery.ownerAlt',
  sources: [
    { url: 'https://shelf/0-640.webp', width: 640 },
    { url: 'https://shelf/0-2560.webp', width: 2560 },
  ],
};

const THUMBNAIL = {
  url: LEAD.url,
  width: LEAD.width,
  height: LEAD.height,
  sources: LEAD.sources,
  focalPoint: null,
};

function withPublication(thumbnail: unknown): { publication: OwnerPropertyPublication } {
  return { publication: { outcome: 'published', at: '2026-09-23T10:00:00.000Z', thumbnail } as OwnerPropertyPublication };
}

describe('thumbnailFromLead — ο γραφέας', () => {
  it('κρατά url · διαστάσεις · παράγωγα και ΑΦΑΙΡΕΙ το altKey', () => {
    const thumbnail = thumbnailFromLead(LEAD);

    expect(thumbnail).toEqual(THUMBNAIL);
    expect(thumbnail).not.toHaveProperty('altKey');
  });

  it('καμία κεντρική εικόνα ⇒ null', () => {
    expect(thumbnailFromLead(null)).toBeNull();
  });
});

describe('🎯 ADR-880 — το σημείο εστίασης επιβιώνει της μικρογραφίας', () => {
  it('ο γραφέας το κρατά, ο αναγνώστης το ελέγχει', () => {
    const focused = thumbnailFromLead({ ...LEAD, focalPoint: { x: 0.4, y: 0.2 } });
    expect(focused?.focalPoint).toEqual({ x: 0.4, y: 0.2 });
    expect(publicationThumbnailOf(withPublication(focused))?.focalPoint).toEqual({ x: 0.4, y: 0.2 });
    expect(publicationThumbnailOf(withPublication({ ...THUMBNAIL, focalPoint: { x: 2 } }))?.focalPoint).toBeNull();
  });
});

describe('publicationThumbnailOf — ο αναγνώστης', () => {
  it('έγκυρη μικρογραφία ⇒ η ίδια, αυτούσια', () => {
    expect(publicationThumbnailOf(withPublication(THUMBNAIL))).toEqual(THUMBNAIL);
  });

  it('🔑 έγγραφο πριν το πεδίο / χωρίς δημοσίευση ⇒ null', () => {
    expect(publicationThumbnailOf({})).toBeNull();
    expect(publicationThumbnailOf({ publication: { outcome: 'published', at: 'x' } })).toBeNull();
    expect(publicationThumbnailOf(withPublication(null))).toBeNull();
  });

  it.each([
    ['κενό url', { ...THUMBNAIL, url: '  ' }],
    ['url όχι συμβολοσειρά', { ...THUMBNAIL, url: 42 }],
    ['μηδενικό πλάτος', { ...THUMBNAIL, width: 0 }],
    ['ύψος NaN', { ...THUMBNAIL, height: Number.NaN }],
    ['όχι αντικείμενο', 'https://shelf/0.webp'],
  ])('🔴 σκουπίδι του δίσκου (%s) ⇒ null, ποτέ σπασμένη εικόνα', (_label, raw) => {
    expect(publicationThumbnailOf(withPublication(raw))).toBeNull();
  });

  it('χαλασμένα παράγωγα πετιούνται — η εικόνα μένει', () => {
    const raw = { ...THUMBNAIL, sources: [{ url: '', width: 640 }, THUMBNAIL.sources[1], 'x'] };

    expect(publicationThumbnailOf(withPublication(raw))?.sources).toEqual([THUMBNAIL.sources[1]]);
  });

  it('χωρίς πίνακα παραγώγων ⇒ κενός πίνακας, όχι αποτυχία', () => {
    const { sources: _omit, ...withoutSources } = THUMBNAIL;

    expect(publicationThumbnailOf(withPublication(withoutSources))?.sources).toEqual([]);
  });
});
