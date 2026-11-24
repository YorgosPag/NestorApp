/**
 * @fileoverview **Η ΛΕΖΑΝΤΑ ΦΩΤΟΓΡΑΦΙΑΣ — λεξιλόγιο, ανάγνωση, δήλωση, προβολή στο δημόσιο έγγραφο.**
 * @related lib/listings/photo-caption · services/listings/public-listing-gallery-projection
 *
 * Πέντε ερωτήσεις: *«είναι κάθε είδος σε ακριβώς μία ομάδα;»* · *«διαβάζεται σκουπίδι ως απουσία;»* · *«μπορεί να
 * υπάρξει άδεια λεζάντα;»* · *«αφαιρεί το `null` τη γραμμή;»* · *«γράφεται η λεζάντα στο `gallery` ΜΟΝΟ όταν δηλώθηκε,
 * και ποτέ σε κάτοψη;»*.
 */

import { declaredFloorplanMaterial, PHOTO_MATERIAL } from '@/lib/listings/listing-material';
import {
  PHOTO_CAPTION_TEXT_MAX,
  PHOTO_SUBJECT_GROUPS,
  PHOTO_SUBJECTS,
  declaredCaptionsSchema,
  photoCaptionOf,
  readDeclaredCaptions,
  readPhotoCaption,
  withDeclaredCaption,
  type PhotoCaption,
} from '@/lib/listings/photo-caption';
import {
  withPublishedGallery,
  type ProjectedShelfImage,
} from '@/services/listings/public-listing-gallery-projection';
import type { PublicListing } from '@/types/public-listing';

const CAPTION: PhotoCaption = { subject: 'cityPlan', text: 'Ο.Τ. Γ753' };

describe('Λ1 — το λεξιλόγιο: κάθε είδος σε ΑΚΡΙΒΩΣ μία ομάδα', () => {
  it('η λίστα είναι η ένωση των ομάδων, χωρίς διπλότυπο', () => {
    const grouped = Object.values(PHOTO_SUBJECT_GROUPS).flat();
    expect([...PHOTO_SUBJECTS]).toEqual(grouped);
    expect(new Set(grouped).size).toBe(grouped.length);
  });
});

describe('Λ2 — readPhotoCaption: σκουπίδι ⇒ απουσία', () => {
  it('έγκυρη λεζάντα περνά αυτούσια', () => {
    expect(readPhotoCaption(CAPTION)).toEqual(CAPTION);
  });

  it('μόνο είδος ή μόνο κείμενο είναι λεζάντα', () => {
    expect(readPhotoCaption({ subject: 'plot', text: null })).toEqual({ subject: 'plot', text: null });
    expect(readPhotoCaption({ subject: null, text: 'Νότια πλευρά' })).toEqual({ subject: null, text: 'Νότια πλευρά' });
  });

  it.each([
    undefined,
    null,
    'Σαλόνι',
    {},
    { subject: null, text: null },
    { subject: 'spaceship', text: null },
    { subject: 'plot', text: '   ' },
    { subject: 'plot', text: 'x'.repeat(PHOTO_CAPTION_TEXT_MAX + 1) },
    { subject: 'plot', text: null, fileId: 'file_1' },
  ])('%p ⇒ null', (raw) => {
    expect(readPhotoCaption(raw)).toBeNull();
  });
});

describe('Λ3 — photoCaptionOf: ό,τι έγραψε ο άνθρωπος, κανονικοποιημένο', () => {
  it('τίποτα ⇒ καμία λεζάντα', () => {
    expect(photoCaptionOf(null, null)).toBeNull();
    expect(photoCaptionOf(null, '  \n ')).toBeNull();
  });

  it('συμπτύσσει τα κενά και κόβει στο όριο', () => {
    expect(photoCaptionOf('view', '  Θέα   στη \n θάλασσα ')).toEqual({ subject: 'view', text: 'Θέα στη θάλασσα' });
    expect(photoCaptionOf(null, 'α'.repeat(PHOTO_CAPTION_TEXT_MAX + 30))?.text).toHaveLength(PHOTO_CAPTION_TEXT_MAX);
  });

  it('ό,τι παράγει το δέχεται ο αναγνώστης (ιδιοδυναμία)', () => {
    const caption = photoCaptionOf('aerial', ' Από  ψηλά ');
    expect(readPhotoCaption(caption)).toEqual(caption);
  });
});

describe('Λ4 — η δήλωση ανά αρχείο', () => {
  it('άκυρη γραμμή πέφτει μόνη της', () => {
    const declared = readDeclaredCaptions({ file_a: CAPTION, file_b: { subject: 'nope', text: null }, '': CAPTION });
    expect([...declared.keys()]).toEqual(['file_a']);
  });

  it('`null` αφαιρεί τη γραμμή, χωρίς μετάλλαξη', () => {
    const declared = readDeclaredCaptions({ file_a: CAPTION });
    const next = withDeclaredCaption(declared, 'file_a', null);
    expect(next.size).toBe(0);
    expect(declared.size).toBe(1);
  });

  it('το σχήμα της πόρτας φράσσει το πλήθος και αρνείται άδεια λεζάντα', () => {
    const schema = declaredCaptionsSchema(1);
    expect(schema.safeParse({ file_a: CAPTION }).success).toBe(true);
    expect(schema.safeParse({ file_a: CAPTION, file_b: CAPTION }).success).toBe(false);
    expect(schema.safeParse({ file_a: { subject: null, text: null } }).success).toBe(false);
  });
});

function shelfImage(id: string, caption: PhotoCaption | null): ProjectedShelfImage {
  return {
    url: `https://shelf/${id}.webp`, width: 1600, height: 1200, sources: [], material: PHOTO_MATERIAL,
    declaredFocalPoint: null, detectedFocalPoint: null, sourceFileId: id, declaredCaptureSpot: null,
    declaredCaption: caption, declaredNorthRad: null,
  };
}

function listing(): PublicListing {
  return { id: 'ownp_1', authorship: 'owner-declared', coverImage: null, gallery: [], floorplans: [] } as unknown as PublicListing;
}

describe('Λ5 — η προβολή στο δημόσιο έγγραφο', () => {
  it('η λεζάντα γράφεται στη φωτογραφία της, αυτούσια', () => {
    const result = withPublishedGallery(listing(), [shelfImage('a', null), shelfImage('b', CAPTION)]);
    expect(result.gallery[1].caption).toEqual(CAPTION);
  });

  it('χωρίς δήλωση το πεδίο ΔΕΝ γράφεται — η φωτογραφία μένει ίδια με πριν', () => {
    const result = withPublishedGallery(listing(), [shelfImage('a', null)]);
    expect('caption' in result.gallery[0]).toBe(false);
  });

  it('κάτοψη δεν παίρνει ποτέ λεζάντα φωτογραφίας', () => {
    const plan = { ...shelfImage('p', CAPTION), material: declaredFloorplanMaterial('2026-11-24T10:00:00.000Z') };
    const result = withPublishedGallery(listing(), [plan]);
    expect('caption' in result.floorplans[0].value).toBe(false);
  });
});
