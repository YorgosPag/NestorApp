/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΟΥ Ο-20** — «η κάτοψη ανακοινώνεται ως κάτοψη;» (ADR-841 §7 Α17).
 * @related ADR-841 §7 Α17 · §9 Ο-20 · lib/listings/listing-material · services/listings/public-listing-projection
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΡΩΤΑ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ ΚΑΜΙΑ ΑΛΛΗ ΔΕΝ ΡΩΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Μπορεί ένα ΣΧΕΔΙΟ να ανακοινωθεί στον κόσμο ως ΦΩΤΟΓΡΑΦΙΑ του κτιρίου;**
 *
 * Η ερώτηση έχει **δύο** παραγωγούς, και η μέτρηση της Α17.1 έδειξε ότι απαντιόνταν
 * **ανόμοια**: το γραφείο είχε φρουρό *(`category !== 'photos'`)*, ο ιδιώτης **κανέναν**
 * — ούτε είχε πεδίο πάνω στο οποίο να ρωτηθεί. ⚠️ Και η **ανομοιότητα** ήταν το εύρημα:
 * όποτε μια πρόταση λέει *«ο παραγωγός Χ δεν ρωτά»*, ο **δεύτερος** παραγωγός της ίδιας
 * συλλογής πρέπει να μετρηθεί στην **ίδια** αναπνοή.
 *
 * ⇒ Γι' αυτό η σουίτα ρωτά **και τους δύο** παραγωγούς για το **ίδιο** πράγμα. Μια
 * άγκυρα που ρωτούσε μόνο τον έναν θα ήταν ακριβώς το κενό που γέννησε το Ο-20.
 */

import {
  publishedOwnerMediaSources,
  publishedOwnerPhotos,
  ownerMediaMaterial,
} from '@/lib/owner-property/owner-media-publication';
import { publishedAgencyMediaSources } from '@/services/listings/agency-media-publication';
import { withPublishedGallery } from '@/services/listings/public-listing-projection';
import type { ProjectedShelfImage } from '@/services/listings/public-listing-projection';
import { LISTING_MATERIAL_KEYS } from '@/lib/listings/listing-authorship';
import {
  LISTING_FLOORPLAN_PROVENANCE_KEYS,
  PHOTO_MATERIAL,
  declaredFloorplanMaterial,
} from '@/lib/listings/listing-material';
import { ATTRIBUTE_PROVENANCES } from '@/lib/property/attribute-provenance';
import { listingLeadImage } from '@/lib/listings/listing-images';
import {
  LISTING_MIGRATIONS,
  PUBLIC_LISTING_SCHEMA_VERSION,
  upgradeListingDocument,
} from '@/lib/listings/public-listing-schema';
import type { OwnerPropertyMedia } from '@/types/owner-property';
import type { AgencyMediaCandidate } from '@/services/listings/agency-media-publication';
import type { PublicListing } from '@/types/public-listing';

const UPLOADED_AT = '2026-08-20T10:00:00.000Z';

/** Ένα αρχείο του **ιδιώτη**, όπως κάθεται στο `owner_properties/{id}.media`. */
function ownerFile(over: Partial<OwnerPropertyMedia> = {}): OwnerPropertyMedia {
  return {
    storagePath: 'owner_properties/u1/ownp_1/a.jpg',
    fileName: 'a.jpg',
    sizeBytes: 1024,
    uploadedAt: UPLOADED_AT,
    published: true,
    ...over,
  };
}

/** Ένα `files/{id}` του **γραφείου**. */
function agencyFile(over: Partial<AgencyMediaCandidate> = {}): AgencyMediaCandidate {
  return {
    id: 'file_a',
    entityType: 'property',
    storagePath: 'companies/comp_1/properties/prop_1/file_a.jpg',
    category: 'photos',
    classification: 'public',
    contentType: 'image/jpeg',
    status: 'ready',
    createdAt: UPLOADED_AT,
    lifecycleState: 'active',
    isDeleted: false,
    ...over,
  } as AgencyMediaCandidate;
}

/** Ό,τι επιστρέφει το ράφι, στη γλώσσα του γραφέα. */
function shelfImage(url: string, over: Partial<ProjectedShelfImage> = {}): ProjectedShelfImage {
  return { url, width: 1280, height: 960, sources: [], material: PHOTO_MATERIAL, ...over };
}

function listing(over: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'ownp_1',
    authorship: 'owner-declared',
    coverImage: null,
    gallery: [],
    floorplans: [],
    ...over,
  } as unknown as PublicListing;
}

// ===========================================================================
describe('Κ1 — 🔴 Ο ΙΔΙΩΤΗΣ: η δηλωμένη κάτοψη ΔΕΝ μπαίνει στη συλλογή', () => {
  it('🔴 κάτοψη + φωτογραφία ⇒ ΕΝΑ στη συλλογή, ΕΝΑ στις κατόψεις', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: σβήσε το `.filter((image) => !isFloorplanMaterial(...))` από
    //    το `withPublishedGallery` ⇒ η κάτοψη ξαναμπαίνει στη συλλογή και αυτό
    //    κοκκινίζει. Είναι **ακριβώς** η γραμμή που κλείνει το Ο-20.
    const result = withPublishedGallery(listing(), [
      shelfImage('https://shelf/photo.webp'),
      shelfImage('https://shelf/plan.webp', {
        material: declaredFloorplanMaterial(UPLOADED_AT),
      }),
    ]);

    expect(result.gallery.map((image) => image.url)).toEqual(['https://shelf/photo.webp']);
    expect(result.floorplans.map((fact) => fact.value.url)).toEqual(['https://shelf/plan.webp']);
  });

  it('🔴 το `alt` της κάτοψης ΔΕΝ είναι το `alt` της συλλογής', () => {
    // ⚠️ Το πιο ορατό μισό του Ο-20: όχι *πού* κάθεται η εικόνα, αλλά **τι λέγεται** για
    //    αυτήν σε όποιον δεν τη βλέπει. «Φωτογραφία 1 από 1» για σχέδιο είναι ψέμα.
    const keys = LISTING_MATERIAL_KEYS['owner-declared'];
    const result = withPublishedGallery(listing(), [
      shelfImage('https://shelf/plan.webp', {
        material: declaredFloorplanMaterial(UPLOADED_AT),
      }),
    ]);

    expect(result.floorplans[0].value.altKey).toBe(keys.floorplanAlt);
    expect(result.floorplans[0].value.altKey).not.toBe(keys.galleryAlt);
  });

  it('🔴 αγγελία ΓΡΑΦΕΙΟΥ ⇒ η κάτοψη παίρνει το κλειδί ΓΡΑΦΕΙΟΥ, όχι σταθερά', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάρφωσε το `floorplanAlt` σε κυριολεκτικό ⇒ κοκκινίζει. Είναι
    //    η **ίδια** κλάση με το Ο-18: πρόταση αληθής όσο υπάρχει ΕΝΑΣ παραγωγός.
    const result = withPublishedGallery(listing({ authorship: 'agency' }), [
      shelfImage('https://shelf/plan.webp', {
        material: declaredFloorplanMaterial(UPLOADED_AT),
      }),
    ]);

    expect(result.floorplans[0].value.altKey).toBe(LISTING_MATERIAL_KEYS.agency.floorplanAlt);
  });

  it('🔴 η κάτοψη ΔΕΝ γίνεται ΠΟΤΕ η κορυφαία εικόνα της αγγελίας', () => {
    // ⚠️ Το `listingLeadImage` είναι `coverImage ?? gallery[0]`. Αν η κάτοψη έμενε στη
    //    συλλογή και ήταν πρώτη, θα γινόταν το **LCP** της σελίδας και η εικόνα της
    //    κάρτας — δηλαδή το σχέδιο θα ήταν *η* εικόνα του ακινήτου στα αποτελέσματα.
    const result = withPublishedGallery(listing(), [
      shelfImage('https://shelf/plan.webp', {
        material: declaredFloorplanMaterial(UPLOADED_AT),
      }),
      shelfImage('https://shelf/photo.webp'),
    ]);

    expect(listingLeadImage(result)?.url).toBe('https://shelf/photo.webp');
  });
});

// ===========================================================================
describe('Κ2 — 🔴 Η ΠΡΟΕΛΕΥΣΗ: δηλωμένη, με τη στιγμή ΤΟΥ ΑΝΘΡΩΠΟΥ', () => {
  it('🔴 `provenance: declared` και `at` = το `uploadedAt`, ΠΟΤΕ ρολόι του γραφέα', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βάλε `at: new Date().toISOString()` στον γραφέα ⇒ κοκκινίζει.
    //    Το `AttributeFactBase.at` ρωτά *«πότε το έμαθε **η πηγή**»* — και η πηγή είναι
    //    ο άνθρωπος τη στιγμή του ανεβάσματος, όχι ο διακομιστής τη στιγμή της προβολής.
    const result = withPublishedGallery(listing(), [
      shelfImage('https://shelf/plan.webp', {
        material: declaredFloorplanMaterial(UPLOADED_AT),
      }),
    ]);

    expect(result.floorplans[0].provenance).toBe('declared');
    expect(result.floorplans[0].at).toBe(UPLOADED_AT);
  });

  it('🔴 ΚΑΘΕ προέλευση έχει κλειδί — καμία δεν καταλήγει ωμή στην οθόνη', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: σβήσε το `measured` από το `LISTING_FLOORPLAN_PROVENANCE_KEYS`
    //    ⇒ κοκκινίζει. Είναι η άγκυρα που εμποδίζει την **Α15 να ξανασυμβεί**: η οθόνη
    //    διαλέγει κλειδί **από την τιμή** του εγγράφου, άρα ελλιπής χάρτης = ωμό κλειδί
    //    την ημέρα που ο παραγωγός της Φ4 γράψει `'measured'`.
    for (const provenance of ATTRIBUTE_PROVENANCES) {
      expect(typeof LISTING_FLOORPLAN_PROVENANCE_KEYS[provenance]).toBe('string');
      expect(LISTING_FLOORPLAN_PROVENANCE_KEYS[provenance]).not.toBe('');
    }
  });
});

// ===========================================================================
describe('Κ3 — 🔴 Η ΔΗΛΩΣΗ ΤΑΞΙΔΕΥΕΙ ΑΠΟ ΤΗ ΦΟΡΜΑ ΩΣ ΤΟ ΡΑΦΙ', () => {
  it('🔴 `kind: floorplan` ⇒ το ράφι μαθαίνει ότι είναι κάτοψη', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάρφωσε `material: PHOTO_MATERIAL` στο
    //    `publishedOwnerMediaSources` ⇒ κοκκινίζει. Χωρίς αυτό το ταξίδι, ο διαχωρισμός
    //    στο τέλος **δεν έχει με τι να γίνει**.
    const [source] = publishedOwnerMediaSources([ownerFile({ kind: 'floorplan' })]);

    expect(source.material).toEqual({ kind: 'floorplan', at: UPLOADED_AT });
  });

  it('🔑 ΚΑΙ Η ΚΑΤΟΨΗ ΠΕΡΝΑ ΑΠΟ ΤΟ ΡΑΦΙ — ένα πρόθεμα, μία συμφιλίωση', () => {
    // ⚠️ Ο πειρασμός ήταν να **μη** σταλεί η κάτοψη στο ράφι. Θα ήταν καταστροφικό:
    //    δύο κλήσεις του `reconcilePublicShelf` για την ίδια αγγελία σβήνουν η μία τα
    //    αντικείμενα της άλλης *(`deleteExtra`, πρόθεμα ένα ανά αγγελία)*.
    const sources = publishedOwnerMediaSources([
      ownerFile({ storagePath: 'p/a.jpg' }),
      ownerFile({ storagePath: 'p/plan.jpg', kind: 'floorplan' }),
    ]);

    expect(sources.map((s) => s.privateStoragePath)).toEqual(['p/a.jpg', 'p/plan.jpg']);
  });

  it('🔴 ΑΔΗΛΩΤΟ αρχείο μένει ΦΩΤΟΓΡΑΦΙΑ — η προεπιλογή δεν αλλάζει ό,τι ήδη βλέπει ο κόσμος', () => {
    // ⚠️ Κάθε αρχείο που υπάρχει σήμερα ανέβηκε **πριν** υπάρξει η ερώτηση. Προεπιλογή
    //    `'floorplan'` θα τα έβγαζε σιωπηλά από τη συλλογή — αλλαγή σε **δημοσιευμένη**
    //    αγγελία που κανείς άνθρωπος δεν ζήτησε.
    const untouched = ownerFile();
    delete (untouched as { kind?: unknown }).kind;

    expect(ownerMediaMaterial(untouched)).toEqual({ kind: 'photo' });
    expect(publishedOwnerPhotos([untouched])).toHaveLength(1);
  });

  it('🔴 η «πρώτη» μετριέται ΜΟΝΟ στις φωτογραφίες', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: γύρνα το `isLeadOwnerMedia` σε `publishedOwnerMedia` ⇒
    //    κοκκινίζει. Η οθόνη του κατόχου θα σήμαινε «1η» μια κάτοψη που **δεν μπαίνει
    //    καν στη συλλογή** — το ίδιο ψέμα που η συνάρτηση γράφτηκε για να αποτρέψει.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isLeadOwnerMedia } = require('@/lib/owner-property/owner-media-publication') as
      typeof import('@/lib/owner-property/owner-media-publication');

    const media = [
      ownerFile({ storagePath: 'p/plan.jpg', kind: 'floorplan' }),
      ownerFile({ storagePath: 'p/photo.jpg' }),
    ];

    expect(isLeadOwnerMedia(media, 'p/plan.jpg')).toBe(false);
    expect(isLeadOwnerMedia(media, 'p/photo.jpg')).toBe(true);
  });
});

// ===========================================================================
describe('Κ4 — ⛔ ΤΟ ΓΡΑΦΕΙΟ: ο φρουρός που ΥΠΗΡΧΕ, κλειδωμένος', () => {
  it('🔴 ΚΑΤΟΨΗ ως **JPEG**, σημασμένη `public`, ΔΕΝ δημοσιεύεται', () => {
    // 🔴 **ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΣΕΝΑΡΙΟ ΠΟΥ ΤΟ HANDOFF ΝΟΜΙΖΕ ΑΝΟΙΧΤΟ** — και είναι κλειστό,
    //    από τη γρ. 96 του `agency-media-publication` *(λευκή λίστα `=== 'photos'`)*.
    //    ⚠️ Η **υπάρχουσα** άγκυρα του Κ2 της `agency-gallery-wiring` χρησιμοποιούσε
    //    `application/dxf`, δηλαδή **δεν ξεχώριζε ποιος από τους δύο φρουρούς έπιασε**.
    //    Με **εικονικό MIME** ο φρουρός του MIME **δεν μπορεί** να το πιάσει ⇒ ό,τι
    //    μένει είναι η κατηγορία.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: σβήσε τη γρ. 96 ⇒ κοκκινίζει, και **μόνο** αυτό.
    expect(
      publishedAgencyMediaSources([
        agencyFile({ category: 'floorplans', contentType: 'image/jpeg' }),
      ]),
    ).toEqual([]);
  });

  it('🔑 ό,τι ΠΕΡΝΑ δηλώνεται ΦΩΤΟΓΡΑΦΙΑ — και είναι απόδειξη, όχι παραδοχή', () => {
    // ⚠️ Οι δύο άκρες του **ίδιου** ισχυρισμού: αν χαλαρώσει η γρ. 96, αυτή η σταθερά
    //    γίνεται ψέμα. Η άγκυρα τις ρωτά **μαζί** ώστε να μη χωρίσουν.
    const [source] = publishedAgencyMediaSources([agencyFile()]);

    expect(source.material).toEqual({ kind: 'photo' });
  });
});

// ===========================================================================
describe('Κ5 — 🔴 Ο ΚΡΙΚΟΣ 8: τα ΠΑΛΙΑ έγγραφα δεν πέφτουν', () => {
  it('🔴 έγγραφο χωρίς `floorplans` ⇒ κενός πίνακας, ποτέ `undefined`', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: σβήσε τον κρίκο 8 ⇒ κοκκινίζει **και εδώ και στην Κ6**. Χωρίς
    //    αυτόν, μια οθόνη που κάνει `floorplans.filter(...)` πέφτει σε `undefined` —
    //    δηλαδή **λευκή σελίδα**, όχι «απουσία κάτοψης».
    const upgraded = upgradeListingDocument({ id: 'x', gallery: [], schemaVersion: 7 });

    expect(upgraded.floorplans).toEqual([]);
    expect(upgraded.schemaVersion).toBe(PUBLIC_LISTING_SCHEMA_VERSION);
  });

  it('🔑 ιδιοδύναμο — δεύτερη διέλευση δεν αλλάζει τίποτα', () => {
    const once = upgradeListingDocument({ id: 'x', gallery: [], schemaVersion: 7 });
    expect(upgradeListingDocument(once)).toEqual(once);
  });

  it('⛔ ο κρίκος ΔΕΝ μεταναστεύει εικόνες από τη συλλογή — καμία εικασία', () => {
    // ⚠️ Δεν υπάρχει τίποτα πάνω σε μια υπάρχουσα εικόνα που να λέει «κάτοψη». Ένας
    //    κρίκος που θα μάντευε θα μετακινούσε **δημόσιες** εικόνες με βάση εικασία.
    const upgraded = upgradeListingDocument({
      id: 'x',
      gallery: [{ url: 'https://shelf/plan.webp', altKey: 'k' }],
      schemaVersion: 7,
    });

    expect(upgraded.gallery).toHaveLength(1);
    expect(upgraded.floorplans).toEqual([]);
  });

  it('🔴 Κ6 του ADR-839 — η έκδοση είναι ΠΛΗΘΟΣ ΚΡΙΚΩΝ + 1', () => {
    expect(PUBLIC_LISTING_SCHEMA_VERSION).toBe(LISTING_MIGRATIONS.length + 1);
  });
});
