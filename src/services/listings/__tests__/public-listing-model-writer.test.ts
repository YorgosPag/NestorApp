/**
 * @fileoverview 🏆 **Η ΑΓΚΥΡΑ Α-7** — μπορεί το `models[]` να διαφημίσει μοντέλο που δεν ψήθηκε;
 * @related ADR-845 §8 (Α-7) · §7.3 · ADR-841 §7 Α10 · Α11 · Α15 · ADR-842 §8 #5
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΡΩΤΑ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ ΚΑΜΙΑ ΑΛΛΗ ΔΕΝ ΡΩΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Μπορεί να γραφτεί `models[]` με URL που ΔΕΝ πέρασε από τον ψήστη;**
 *
 * Είναι η **ίδια κλάση** με το γραμμένο ιδίωμα του ραφιού — *«το κλειδί είναι το sha256 των
 * καθαρισμένων bytes ⇒ **χωρίς καθαρισμό δεν υπάρχει διεύθυνση**»* — και η απάντηση οφείλει να
 * είναι *«όχι, **δομικά**»*: η προβολή χτίζεται **ΑΠΟ ΤΗΝ ΑΝΑΦΟΡΑ** του ραφιού, ποτέ από τις
 * πηγές, ακριβώς όπως ο `withPublishedGallery`.
 *
 * 🔑 **Και η δεύτερη ερώτηση, που η Φ4.2β ανακάλυψε μετρώντας**: το σκέλος `measured` του
 * `SourcedAttribute` **απαιτεί `sourceRef`**. Ένα κενό, ένα ιδιωτικό μονοπάτι ή ένα `bldg_…`
 * εκεί θα ήταν **διαρροή ιδιωτικού αναγνωριστικού σε ανώνυμο** — το ίδιο μάθημα με το
 * χασαρισμένο `sourceRef` του ραφιού, μία βαθμίδα πιο πάνω.
 *
 * ⚠️ **ΣΥΝΑΡΤΗΣΕΙΣ, ΟΧΙ ΣΤΑΘΕΡΕΣ ΣΤΟ ΣΩΜΑ ΤΟΥ `describe`** *(μετρημένο στη Φ4.2α)*: το σώμα
 * τρέχει στη **συλλογή**, και μια εξαίρεση εκεί ρίχνει **ΟΛΟΚΛΗΡΟ** το αρχείο με
 * `Tests: 0 total` — δηλαδή οι γειτονικές άγκυρες σιωπούν και το μήνυμα δεν ονομάζει καμία.
 */

import { LISTING_MATERIAL_KEYS } from '@/lib/listings/listing-authorship';
import type { PublicListing } from '@/types/public-listing';

import {
  buildPublicListing,
  type PlaceKnowledge,
  type ProjectableProperty,
} from '../public-listing-projection';
import {
  LISTING_MODEL_SOURCE_REF,
  withPublishedModels,
  type ProjectedShelfModel,
} from '../public-listing-model-projection';

const AT = '2026-09-01T10:00:00.000Z';
/** Η στιγμή που **έμαθε η πηγή** — σκόπιμα ΔΙΑΦΟΡΕΤΙΚΗ από το {@link AT} της προβολής. */
const SOURCE_AT = '2026-08-14T07:30:00.000Z';
const NO_PLACE: PlaceKnowledge = { candidates: [], ref: null };

const LISTED: ProjectableProperty = {
  id: 'ownp_77aa21bc',
  name: 'Διαμέρισμα 80 τ.μ.',
  type: 'apartment',
  commercialStatus: 'for-sale',
  areas: { gross: 80 },
  commercial: { askingPrice: 150000 },
};

function buildOrThrow(property: ProjectableProperty): PublicListing {
  const listing = buildPublicListing(property, NO_PLACE, AT);
  if (listing === null) throw new Error('το fixture όφειλε να δημοσιεύεται');
  return listing;
}

function built(): PublicListing {
  return buildOrThrow(LISTED);
}

/** Ένα μοντέλο **όπως το επιστρέφει η αναφορά του ραφιού** — content-addressed URL. */
function shelfModel(hash: string, at: string = SOURCE_AT): ProjectedShelfModel {
  return {
    url: `https://storage.googleapis.com/bucket/listings/ownp_77aa21bc/${hash}.glb`,
    at,
  };
}

// ---------------------------------------------------------------------------

describe('🏆 Α-7 — ΤΟ `models[]` ΧΤΙΖΕΤΑΙ ΑΠΟ ΤΗΝ ΑΝΑΦΟΡΑ ΤΟΥ ΡΑΦΙΟΥ', () => {
  it('η ΚΑΘΑΡΗ προβολή γεννά ΚΕΝΟ πίνακα — το ράφι δεν έχει ρωτηθεί ακόμη', () => {
    // ⚠️ Ίδια σημασιολογία με `gallery`/`floorplans` **από τη Φ4.2β**: ως τη Φ4.2α το κενό
    //    σήμαινε «δεν υπάρχει παραγωγός». Τώρα υπάρχει.
    expect(built().models).toEqual([]);
  });

  it('🔴 το URL που γράφεται είναι ΑΚΡΙΒΩΣ αυτό της αναφοράς — καμία ανακατασκευή', () => {
    const model = shelfModel('a'.repeat(64));
    const listing = withPublishedModels(built(), [model]);

    expect(listing.models).toHaveLength(1);
    expect(listing.models[0].value.url).toBe(model.url);
  });

  it('🔴 ό,τι ΔΕΝ είναι στην αναφορά ΔΕΝ μπαίνει — κενή αναφορά ⇒ κενό κουτί', () => {
    // Η μετάλλαξη που πιάνει: ένας γραφέας που θα «συμπλήρωνε» από τις πηγές αντί για την
    // αναφορά. Το ράφι ΠΕΤΑ ό,τι δεν ψήθηκε — άρα κενή αναφορά σημαίνει «τίποτα δεν πέρασε».
    expect(withPublishedModels(built(), []).models).toEqual([]);
  });

  it('🔑 πολλά μοντέλα επιτρέπονται, ΜΕ ΤΗ ΣΕΙΡΑ ΤΗΣ ΑΝΑΦΟΡΑΣ — καμία ταξινόμηση', () => {
    // Η Α11 δημοσιεύει ΚΑΙ `as-built` ΚΑΙ `proposal` — γι' αυτό το κουτί είναι πίνακας.
    const first = shelfModel('1'.repeat(64));
    const second = shelfModel('2'.repeat(64));
    const listing = withPublishedModels(built(), [first, second]);

    expect(listing.models.map((model) => model.value.url)).toEqual([first.url, second.url]);
  });

  it('η υπόλοιπη αγγελία μένει ΑΝΕΠΑΦΗ — ο γραφέας αγγίζει ΕΝΑ κουτί', () => {
    const before = built();
    const after = withPublishedModels(before, [shelfModel('b'.repeat(64))]);

    expect(after.gallery).toEqual(before.gallery);
    expect(after.floorplans).toEqual(before.floorplans);
    expect(after.id).toBe(before.id);
  });
});

describe('🏆 Α-7β — Η ΠΡΟΕΛΕΥΣΗ ΚΑΙ Ο ΥΠΟΧΡΕΩΤΙΚΟΣ ΔΕΙΚΤΗΣ ΤΗΣ', () => {
  function onlyModel(): PublicListing['models'][number] {
    return withPublishedModels(built(), [shelfModel('c'.repeat(64))]).models[0];
  }

  it('🔴 `measured` — το μοντέλο του εργολάβου ΒΓΗΚΕ από BIM (ADR-845 §7.3)', () => {
    // Το `attribute-provenance` ορίζει: «`measured` — υπολογισμένο από DXF/BIM». Ένα
    // `declared` εδώ θα υποβάθμιζε σιωπηλά κάτι μετρημένο — η αντίστροφη παγίδα της Α15.
    expect(onlyModel().provenance).toBe('measured');
  });

  it('🔴 και ΚΟΥΒΑΛΑ `sourceRef` — το σκέλος `measured` το ΑΠΑΙΤΕΙ', () => {
    const model = onlyModel();
    if (model.provenance !== 'measured') throw new Error('η προηγούμενη άγκυρα το εγγυάται');

    expect(model.sourceRef).toBe(LISTING_MODEL_SOURCE_REF);
    expect(model.sourceRef.length).toBeGreaterThan(0);
  });

  it('🔴 ο δείκτης είναι ΚΑΤΗΓΟΡΙΑ, όχι ταυτότητα — κανένα ιδιωτικό αναγνωριστικό δημόσια', () => {
    // Η γραμμένη απόφαση του ADR-842 §8 #5, με το προηγούμενο του `property-model:levels`.
    // Ένα `bldg_…`/`ownp_…`/ιδιωτικό μονοπάτι εδώ θα ταξίδευε σε ΑΝΩΝΥΜΟ επισκέπτη.
    expect(LISTING_MODEL_SOURCE_REF).toMatch(/^property-model:/);
    expect(LISTING_MODEL_SOURCE_REF).not.toMatch(/bldg_|ownp_|comp_|prop_|owner_properties/);
    expect(LISTING_MODEL_SOURCE_REF).not.toContain('/');
  });

  it('🔴 το `at` έρχεται από ΤΗΝ ΠΗΓΗ, ποτέ από το ρολόι της προβολής', () => {
    // Η μετάλλαξη που πιάνει: `at: projectedAt` αντί για `at: model.at`. Και τα δύο είναι
    // έγκυρες ISO συμβολοσειρές, άρα ΜΟΝΟ η διάκριση των δύο τιμών το αποκαλύπτει.
    const model = onlyModel();

    expect(model.at).toBe(SOURCE_AT);
    expect(model.at).not.toBe(AT);
  });

  it('🔑 δύο μοντέλα με ΔΙΑΦΟΡΕΤΙΚΕΣ στιγμές κρατούν η καθεμιά τη δική της', () => {
    // Χωρίς αυτό, ένα `at` υπολογισμένο ΜΙΑ φορά έξω από τον βρόχο θα περνούσε το από πάνω.
    const early = shelfModel('d'.repeat(64), '2026-01-02T00:00:00.000Z');
    const late = shelfModel('e'.repeat(64), '2026-07-08T00:00:00.000Z');

    const listing = withPublishedModels(built(), [early, late]);

    expect(listing.models.map((model) => model.at)).toEqual([early.at, late.at]);
  });
});

describe('🏆 Α-7γ — ΤΟ `altKey` ΔΙΑΛΕΓΕΤΑΙ ΑΠΟ ΤΗΝ `authorship` ΤΗΣ ΙΔΙΑΣ ΑΓΓΕΛΙΑΣ (Α15)', () => {
  it('το κλειδί είναι το `modelAlt` της γραμμής της αγγελίας — ποτέ σταθερά', () => {
    const listing = withPublishedModels(built(), [shelfModel('f'.repeat(64))]);

    expect(listing.models[0].value.altKey).toBe(
      LISTING_MATERIAL_KEYS[listing.authorship].modelAlt,
    );
  });

  it('🔴 και ΑΛΛΑΖΕΙ με την authorship — η μετάλλαξη που πιάνει τη σταθερά', () => {
    // Ως την Α14 το κλειδί ήταν σταθερά, και ήταν σωστό όσο υπήρχε ΕΝΑΣ παραγωγός. Τη μέρα
    // που το γραφείο απέκτησε υλικό, η ίδια σταθερά έλεγε «υλικό του κατόχου» σε 6 στις 7.
    const agency = withPublishedModels(buildOrThrow({ ...LISTED, authorship: 'agency' }), [
      shelfModel('a'.repeat(64)),
    ]);
    const owner = withPublishedModels(
      buildOrThrow({ ...LISTED, authorship: 'owner-declared' }),
      [shelfModel('a'.repeat(64))],
    );

    expect(agency.models[0].value.altKey).toBe(LISTING_MATERIAL_KEYS.agency.modelAlt);
    expect(owner.models[0].value.altKey).toBe(LISTING_MATERIAL_KEYS['owner-declared'].modelAlt);
    expect(agency.models[0].value.altKey).not.toBe(owner.models[0].value.altKey);
  });

  it('🔴 το κλειδί είναι i18n κλειδί, ΠΟΤΕ ωμό κείμενο (N.11)', () => {
    const listing = withPublishedModels(built(), [shelfModel('a'.repeat(64))]);
    const altKey = listing.models[0].value.altKey;

    expect(altKey).toMatch(/^search-results:detail\.media\.modelAlt\./);
    // Ένα ωμό ελληνικό κείμενο εδώ θα έφτανε **παγωμένο** σε δημοσιευμένο έγγραφο Firestore,
    // δηλαδή ανεπίστρεπτα — δες το Ο-7 για το κόστος της μετακόμισης τέτοιων κλειδιών.
    expect(altKey).not.toMatch(/[Ͱ-Ͽἀ-῿]/);
  });
});
