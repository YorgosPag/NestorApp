/**
 * @jest-environment node
 *
 * @fileoverview 📍 **Η ΑΓΚΥΡΑ ΤΩΝ ΣΗΜΕΙΩΝ ΛΗΨΗΣ** — από τη δήλωση ως το δημόσιο έγγραφο (ADR-897).
 * @related lib/listings/photo-capture-spot · services/listings/public-listing-gallery-projection ·
 *   services/listings/agency-media-selection · services/property-dossier/dossier-media-publication
 *
 * Πέντε ερωτήσεις, και καμία άλλη σουίτα δεν τις κάνει:
 *   Σ1 — η ταυτότητα της κάτοψης γίνεται **δείκτης**, και καμία ταυτότητα αρχείου δεν φτάνει στο κοινό;
 *   Σ2 — φωτογραφία **πριν** την κάτοψή της στη σειρά — δένει σωστά;
 *   Σ3 — σημείο σε κάτοψη που **δεν** δημοσιεύτηκε ⇒ πέφτει (ποτέ κρεμασμένος δείκτης);
 *   Σ4 — φωτογραφία **χωρίς** δήλωση ⇒ byte-προς-byte ίδια με πριν (καμία ψευδής «αλλαγή»);
 *   Σ5 — οι **δύο** παραγωγοί (γραφείο, φάκελος) κουβαλούν ταυτότητα + σημείο δεμένα στο **αρχείο**;
 *
 * ⛔ **ΜΕΤΑΛΛΑΞΗ**: στο `withCaptureSpots` γράψε τον δείκτη της **φωτογραφίας** αντί της κάτοψης ⇒ Σ1/Σ2 κοκκινίζουν.
 */

import { declaredFloorplanMaterial, PHOTO_MATERIAL } from '@/lib/listings/listing-material';
import type { PhotoCaptureSpot } from '@/lib/listings/photo-capture-spot';
import { publishedAgencyMediaSources } from '@/services/listings/agency-media-selection';
import type { AgencyMediaCandidate } from '@/services/listings/agency-media-publication';
import { withPublishedGallery, type ProjectedShelfImage } from '@/services/listings/public-listing-projection';
import {
  publishedDossierMediaSources,
  type DossierMediaCandidate,
  type DossierMediaOwner,
} from '@/services/property-dossier/dossier-media-publication';
import type { PublicListing } from '@/types/public-listing';

const AT = '2026-10-01T10:00:00.000Z';
const spotOn = (floorplanFileId: string): PhotoCaptureSpot =>
  ({ floorplanFileId, x: 0.3, y: 0.7, headingRad: 1, fovRad: 1.2 });

/** Η διεύθυνση του ραφιού είναι content-addressed — **δεν** περιέχει ταυτότητα αρχείου, και η άγκυρα το σέβεται. */
let shelfHash = 0;

function photo(id: string, captureSpot: PhotoCaptureSpot | null): ProjectedShelfImage {
  shelfHash += 1;
  return {
    url: `https://shelf/${shelfHash.toString(16).padStart(64, '0')}.webp`, width: 1600, height: 1200, sources: [], material: PHOTO_MATERIAL,
    declaredFocalPoint: null, detectedFocalPoint: null, sourceFileId: id, declaredCaptureSpot: captureSpot, declaredNorthRad: null,
  };
}

function plan(id: string): ProjectedShelfImage {
  return { ...photo(id, null), material: declaredFloorplanMaterial(AT) };
}

function listing(): PublicListing {
  return { id: 'prop_1', authorship: 'agency', coverImage: null, gallery: [], floorplans: [] } as unknown as PublicListing;
}

describe('Σ1 — ταυτότητα κάτοψης ⇒ δείκτης, καμία ταυτότητα αρχείου στο κοινό', () => {
  it('δύο όροφοι: κάθε φωτογραφία δείχνει στη ΔΙΚΗ της κάτοψη', () => {
    const result = withPublishedGallery(listing(), [
      plan('plan_ground'), plan('plan_first'),
      photo('photo_kitchen', spotOn('plan_ground')), photo('photo_bedroom', spotOn('plan_first')),
    ]);
    expect(result.gallery.map((image) => image.captureSpot?.floorplanIndex)).toEqual([0, 1]);
    expect(JSON.stringify(result)).not.toMatch(/plan_ground|plan_first|photo_kitchen|photo_bedroom/u);
  });
});

describe('Σ2 — η σειρά είναι του ανθρώπου: φωτογραφία πριν την κάτοψή της', () => {
  it('δένει στον σωστό δείκτη', () => {
    const result = withPublishedGallery(listing(), [
      photo('photo_a', spotOn('plan_b')), plan('plan_a'), plan('plan_b'),
    ]);
    expect(result.gallery[0].captureSpot).toEqual({ floorplanIndex: 1, x: 0.3, y: 0.7, headingRad: 1, fovRad: 1.2 });
  });
});

describe('Σ3 — κάτοψη που δεν βγήκε ⇒ το σημείο πέφτει', () => {
  it('κανένας κρεμασμένος δείκτης', () => {
    const result = withPublishedGallery(listing(), [plan('plan_a'), photo('photo_a', spotOn('plan_withdrawn'))]);
    expect(result.gallery[0]).not.toHaveProperty('captureSpot');
  });
});

describe('Σ4 — χωρίς δήλωση, η φωτογραφία μένει ίδια με πριν', () => {
  it('το πεδίο ΔΕΝ γράφεται καθόλου (ούτε `null`)', () => {
    const result = withPublishedGallery(listing(), [plan('plan_a'), photo('photo_a', null)]);
    expect(result.gallery[0]).not.toHaveProperty('captureSpot');
  });
});

describe('Σ5 — και οι δύο παραγωγοί δένουν στο ΑΡΧΕΙΟ', () => {
  it('γραφείο: ταυτότητα + σημείο ταξιδεύουν με την πηγή', () => {
    const file = {
      id: 'file_a', entityType: 'property', storagePath: 'companies/c/properties/p/file_a.jpg', category: 'photos',
      classification: 'public', contentType: 'image/jpeg', status: 'ready', createdAt: AT,
      lifecycleState: 'active', isDeleted: false,
    } as AgencyMediaCandidate;
    const [source] = publishedAgencyMediaSources([file], {
      order: [], floorplans: [], captureSpots: new Map([['file_a', spotOn('plan_x')]]),
    });
    expect(source).toMatchObject({ sourceFileId: 'file_a', captureSpot: spotOn('plan_x') });
  });

  it('φάκελος: το σημείο ακολουθεί την ταυτότητα, όχι τη θέση στη δήλωση', () => {
    const dossier: DossierMediaOwner = { id: 'pdos_a', label: 'Σπίτι', userId: 'user-1', type: 'land' };
    const fileOf = (id: string): DossierMediaCandidate => ({
      id, entityType: 'property_dossier', entityId: dossier.id, userId: dossier.userId,
      storagePath: `people/user-1/entities/property_dossier/pdos_a/domains/sales/categories/photos/files/${id}.png`,
      contentType: 'image/png', status: 'ready', lifecycleState: 'active', isDeleted: false, createdAt: AT,
      domain: 'sales', category: 'photos', purpose: 'view',
    });
    const sources = publishedDossierMediaSources(
      dossier,
      [fileOf('f1'), fileOf('f2')],
      ['f2', 'f1'],
      { captureSpots: new Map([['f1', spotOn('plan_y')]]) },
    );
    const byId = new Map(sources.map((source) => [source.sourceFileId, source.captureSpot]));
    expect(byId.get('f1')).toEqual(spotOn('plan_y'));
    expect(byId.get('f2') ?? null).toBeNull();
  });
});

/**
 * 🧭 **Σ6–Σ7 — ο βορράς της κάτοψης (ADR-897 Φ5.2)**.
 * ⛔ **ΜΕΤΑΛΛΑΞΗ**: στο `withPublishedGallery` γράψε το `toListingImage` στον κλάδο `floorplan` ⇒ Σ6 κοκκινίζει·
 *   αφαίρεσε τη γραμμή `northRad` από τον παραγωγό ⇒ Σ7 κοκκινίζει.
 */
function planWithNorth(id: string, northRad: number | null): ProjectedShelfImage {
  return { ...plan(id), declaredNorthRad: northRad };
}

describe('Σ6 — ο βορράς φτάνει ΜΟΝΟ στην κάτοψη που τον δήλωσε', () => {
  it('κάτοψη με βορρά ⇒ `northRad`· κάτοψη χωρίς ⇒ κανένα πεδίο (byte-προς-byte ίδια)', () => {
    const result = withPublishedGallery(listing(), [planWithNorth('plan_a', 1.25), planWithNorth('plan_b', null)]);
    expect(result.floorplans[0].value.northRad).toBe(1.25);
    expect('northRad' in result.floorplans[1].value).toBe(false);
  });

  it('η φωτογραφία ΔΕΝ παίρνει ποτέ βορρά, ακόμη κι αν ο φορέας τον κουβαλούσε', () => {
    const result = withPublishedGallery(listing(), [plan('plan_a'), { ...photo('photo_a', null), declaredNorthRad: 2 }]);
    expect('northRad' in result.gallery[0]).toBe(false);
  });
});

describe('Σ7 — οι δύο παραγωγοί κουβαλούν τον βορρά δεμένο στο ΑΡΧΕΙΟ', () => {
  it('γραφείο: `floorplanNorth` ⇒ `northRad` της πηγής', () => {
    const file = {
      id: 'file_a', entityType: 'property', storagePath: 'companies/c/properties/p/file_a.jpg', category: 'photos',
      classification: 'public', contentType: 'image/jpeg', status: 'ready', createdAt: AT,
      lifecycleState: 'active', isDeleted: false,
    } as AgencyMediaCandidate;
    const [source] = publishedAgencyMediaSources([file], {
      order: [], floorplans: [], floorplanNorth: new Map([['file_a', 0.5]]),
    });
    expect(source.northRad).toBe(0.5);
  });

  it('φάκελος: ο βορράς ακολουθεί την ταυτότητα', () => {
    const dossier: DossierMediaOwner = { id: 'pdos_a', label: 'Σπίτι', userId: 'user-1', type: 'land' };
    const fileOf = (id: string): DossierMediaCandidate => ({
      id, entityType: 'property_dossier', entityId: dossier.id, userId: dossier.userId,
      storagePath: `people/user-1/entities/property_dossier/pdos_a/domains/sales/categories/photos/files/${id}.png`,
      contentType: 'image/png', status: 'ready', lifecycleState: 'active', isDeleted: false, createdAt: AT,
      domain: 'sales', category: 'photos', purpose: 'view',
    });
    const sources = publishedDossierMediaSources(dossier, [fileOf('f1'), fileOf('f2')], ['f2', 'f1'], {
      floorplanNorth: new Map([['f2', 3]]),
    });
    const byId = new Map(sources.map((source) => [source.sourceFileId, source.northRad]));
    expect(byId.get('f2')).toBe(3);
    expect(byId.get('f1') ?? null).toBeNull();
  });
});
