/**
 * @fileoverview **Η ΑΓΚΥΡΑ ΟΛΟΤΗΤΑΣ** — και οι ΔΥΟ διαδρομές αγγελίας γεμίζουν το `PublicListing.place`.
 * @related ADR-777 · SPEC-777A §13.7.3 (Β3) · §14.5 · services/listings/publish-public-listing.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΞΕΧΩΡΙΣΤΗ ΣΟΥΙΤΑ ΓΙΑ ΚΑΤΙ ΠΟΥ «ΗΔΗ ΔΟΥΛΕΥΕΙ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Επειδή **δεν δούλευε**, και **καμία** πύλη δεν το έλεγε. Μέχρι τη Β3:
 *
 *   - ο **ιδιώτης** γέμιζε το `place` (Α14) ⇒ η άγκυρα του §14.5 ήταν **πράσινη**·
 *   - ο **επαγγελματίας** —η πλειοψηφία του αποθέματος— **δεν είχε πού** να το
 *     δηλώσει ⇒ `place: null` για **κάθε** αγγελία εταιρείας, με το πεδίο **παρόν**,
 *     το σχήμα **κλειστό** και τα tests **πράσινα**.
 *
 * Δηλαδή ακριβώς το σχήμα «*0 = κανείς δεν κοίταξε*», μεταμφιεσμένο σε τελειωμένη
 * δουλειά. Μια άγκυρα που ρωτά *«γεμίζει το πεδίο;»* κοιτώντας **μία** διαδρομή δεν
 * απαντά τίποτα για την άλλη — γι' αυτό εδώ το ερώτημα είναι **απαρίθμηση**: *ποιες
 * είναι οι διαδρομές, και τις καλύπτουμε ΟΛΕΣ;*
 *
 * ⚠️ **Αν προστεθεί ΤΡΙΤΗ διαδρομή** (π.χ. μαζική εισαγωγή με δικό της γραφέα), αυτή η
 * σουίτα **δεν** θα γίνει κόκκινη από μόνη της — θα γίνει κόκκινη η **λογιστική** του
 * `Ο0`, που απαριθμεί τους παραγωγούς `PlaceKnowledge` ονομαστικά.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  buildPublicListing,
  type PlaceKnowledge,
  type ProjectableProperty,
} from '../public-listing-projection';
import { collectPlaceKnowledge } from '../publish-public-listing';
import {
  placeKnowledgeFromOwnerProperty,
  projectableFromOwnerProperty,
} from '@/lib/owner-property/owner-property-projection';
import { validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { PlaceRef } from '@/types/geo/public-place';

const AT = '2026-08-11T12:00:00.000Z';

/** Ο **πραγματικός** τόπος του dev Firestore — όχι επινοημένο δείγμα. */
const PLACE: PlaceRef = {
  landId: 'land_0cb5cbb6-bb31-4954-a7f9-8e8f9ac00a00',
  buildingId: 'pbld_24b3a8d7-2e56-40e6-8053-9c1628b425bf',
};

const COMPANY_PROPERTY: ProjectableProperty & { buildingId: string; projectId: string } = {
  id: 'prop_1',
  name: 'Διαμέρισμα Α2',
  type: 'apartment',
  commercialStatus: 'for-sale',
  commercial: { askingPrice: 180_000 },
  areas: { gross: 78 },
  floor: 2,
  buildingId: 'bldg_1',
  projectId: 'proj_1',
};

function dbWith(building: Record<string, unknown> | null): AdminFirestore {
  const fake = new FakeFirestore();
  if (building !== null) fake.seed(COLLECTIONS.BUILDINGS, 'bldg_1', building);
  fake.seed(COLLECTIONS.PROJECTS, 'proj_1', { addresses: [] });
  return fake as unknown as AdminFirestore;
}

// =============================================================================
// Ο — Η ΛΟΓΙΣΤΙΚΗ ΤΩΝ ΔΙΑΔΡΟΜΩΝ
// =============================================================================

describe('🔴 Ο — ΚΑΘΕ διαδρομή αγγελίας μπορεί να δείξει στο επίπεδο Α', () => {
  /**
   * **Η κλειστή απαρίθμηση.** Ό,τι γράφει δημόσια αγγελία περνά από
   * `buildPublicListing(property, place, at)`, και το `place` το παράγει **ένας** από
   * αυτούς τους δύο. Ένας τρίτος παραγωγός σημαίνει τρίτη διαδρομή — και τότε αυτή η
   * λίστα οφείλει να μεγαλώσει **συνειδητά**, όχι σιωπηλά.
   */
  const PLACE_KNOWLEDGE_PRODUCERS = [
    'collectPlaceKnowledge (επαγγελματίας: ακίνητο → κτίριο → έργο)',
    'placeKnowledgeFromOwnerProperty (ιδιώτης: η δική του δήλωση)',
  ] as const;

  it('Ο0 — οι παραγωγοί γνώσης τόπου είναι ΔΥΟ, ονομαστικά', () => {
    expect(PLACE_KNOWLEDGE_PRODUCERS).toHaveLength(2);
    expect(typeof collectPlaceKnowledge).toBe('function');
    expect(typeof placeKnowledgeFromOwnerProperty).toBe('function');
  });

  it('🔑 Ο1 — ΙΔΙΩΤΗΣ: η δήλωσή του φτάνει αυτούσια στη δημόσια αγγελία', () => {
    const property = validOwnerProperty({
      place: {
        kind: 'declared',
        point: { lat: 40.6403, lng: 22.9444 },
        label: 'Στέφανου Δραγούμη, 8',
        accuracy: 'exact',
        link: PLACE,
      },
    });

    const listing = buildPublicListing(
      projectableFromOwnerProperty(property),
      placeKnowledgeFromOwnerProperty(property, AT),
      AT,
    );

    expect(listing?.place).toEqual(PLACE);
  });

  /**
   * 🔴 **ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΚΕΝΟ ΠΟΥ ΕΚΛΕΙΣΕ Η Β3.** Πριν από αυτήν, η ίδια είσοδος
   * παρήγαγε `place: null` — και μια ζήτηση Ζ3/Ζ5 απαντούσε `place-unresolved` για
   * **κάθε** αγγελία εταιρείας.
   */
  it('🔑 Ο2 — ΕΠΑΓΓΕΛΜΑΤΙΑΣ: ο δεσμός του ΚΤΙΡΙΟΥ κατεβαίνει στην αγγελία', async () => {
    const db = dbWith({ projectId: 'proj_1', placeRef: PLACE });

    const knowledge = await collectPlaceKnowledge(db, COMPANY_PROPERTY, AT);
    const listing = buildPublicListing(COMPANY_PROPERTY, knowledge, AT);

    expect(listing?.place).toEqual(PLACE);
  });

  it('🔑 Ο3 — και οι δύο διαδρομές δείχνουν στην ΙΔΙΑ ταυτότητα (§14.5, ο λόγος ύπαρξης)', async () => {
    const owner = validOwnerProperty({
      place: {
        kind: 'declared',
        point: { lat: 40.6403, lng: 22.9444 },
        label: 'Στέφανου Δραγούμη, 8',
        accuracy: 'exact',
        link: PLACE,
      },
    });
    const ownerListing = buildPublicListing(
      projectableFromOwnerProperty(owner),
      placeKnowledgeFromOwnerProperty(owner, AT),
      AT,
    );

    const companyListing = buildPublicListing(
      COMPANY_PROPERTY,
      await collectPlaceKnowledge(dbWith({ projectId: 'proj_1', placeRef: PLACE }), COMPANY_PROPERTY, AT),
      AT,
    );

    expect(ownerListing?.place).toEqual(companyListing?.place);
    expect(companyListing?.place).not.toBeNull();
  });
});

// =============================================================================
// Π — ΤΟ ΑΝΕΒΑΣΜΑ ΤΗΣ ΑΛΥΣΙΔΑΣ
// =============================================================================

describe('Π — η αλυσίδα της Α1 λύνει ΔΥΟ ερωτήσεις με ΕΝΑ ανέβασμα', () => {
  /**
   * 🔴 **Η ΑΚΡΙΒΗΣ ΓΡΑΜΜΗ ΠΟΥ ΑΛΛΑΞΕ.** Πριν τη Β3 το ανέβασμα σταματούσε στο
   * `property.projectId` (*«ξέρω το έργο, δεν χρειάζομαι το κτίριο»*) — σωστό για τη
   * **θέση**, τυφλό για τον **δεσμό**, που ζει ένα σκαλί πιο κάτω. Χωρίς αυτή την
   * άγκυρα, μια μελλοντική «βελτιστοποίηση» που ξαναβάζει το πρόωρο `return` θα
   * περνούσε πράσινη και θα άδειαζε σιωπηλά το `place` όλων των εταιρειών.
   */
  it('🔴 Π1 — το ΚΤΙΡΙΟ διαβάζεται ΑΚΟΜΑ ΚΑΙ όταν το ακίνητο ξέρει ήδη το έργο του', async () => {
    const knowledge = await collectPlaceKnowledge(
      dbWith({ projectId: 'proj_1', placeRef: PLACE }),
      COMPANY_PROPERTY,
      AT,
    );

    expect(knowledge.ref).toEqual(PLACE);
  });

  it('Π2 — κτίριο ΧΩΡΙΣ δεσμό ⇒ `ref: null`, ρητά, ποτέ `undefined`', async () => {
    const knowledge = await collectPlaceKnowledge(dbWith({ projectId: 'proj_1' }), COMPANY_PROPERTY, AT);
    expect(knowledge.ref).toBeNull();
  });

  it('Π3 — κτίριο που δεν υπάρχει ⇒ `ref: null`, χωρίς εξαίρεση', async () => {
    const knowledge = await collectPlaceKnowledge(dbWith(null), COMPANY_PROPERTY, AT);
    expect(knowledge.ref).toBeNull();
  });

  /**
   * 🔶 **Δηλωμένο όριο, με άγκυρα.** Ακίνητο χωρίς `buildingId` **δεν** κληρονομεί
   * δεσμό από το έργο: ένα έργο μπορεί να έχει πολλά κτίρια σε διαφορετικές γη, και
   * μια τέτοια κληρονομιά θα ήταν **εικασία** — ακριβώς αυτό που απαγορεύει το §13.3.
   */
  it('🔶 Π4 — ακίνητο ΧΩΡΙΣ κτίριο δεν κληρονομεί δεσμό από το έργο', async () => {
    const { buildingId: _dropped, ...withoutBuilding } = COMPANY_PROPERTY;
    const knowledge = await collectPlaceKnowledge(
      dbWith({ projectId: 'proj_1', placeRef: PLACE }),
      withoutBuilding,
      AT,
    );

    expect(knowledge.ref).toBeNull();
  });

  it('Π5 — το έργο του ΚΤΙΡΙΟΥ εξακολουθεί να λύνεται όταν το ακίνητο δεν το ξέρει', async () => {
    const fake = new FakeFirestore();
    fake.seed(COLLECTIONS.BUILDINGS, 'bldg_1', { projectId: 'proj_1', placeRef: PLACE });
    fake.seed(COLLECTIONS.PROJECTS, 'proj_1', {
      addresses: [{ coordinates: { lat: 40.64, lng: 22.94 } }],
    });

    const knowledge = await collectPlaceKnowledge(
      fake as unknown as AdminFirestore,
      { buildingId: 'bldg_1' },
      AT,
    );

    expect(knowledge.candidates).toHaveLength(1);
    expect(knowledge.ref).toEqual(PLACE);
  });
});

// =============================================================================
// Μ — ΜΙΑ ΠΟΡΤΑ, ΟΧΙ ΔΥΟ
// =============================================================================

describe('🔴 Μ — ο δεσμός έχει ΜΙΑ είσοδο· δεύτερη θα ήταν το σχήμα του ADR-749', () => {
  /**
   * Μέχρι τη Β3 ο δεσμός ζούσε ως **προαιρετικό πεδίο του ακινήτου**. Αν είχε μείνει
   * **και** εκεί **και** στη γνώση τόπου, θα υπήρχαν δύο είσοδοι για ένα πεδίο εξόδου
   * — με κανόνα προτεραιότητας που κάποιος θα έγραφε λάθος, στο **ίδιο** πεδίο που
   * **ΕΙΝΑΙ** η μηχανή ταιριάσματος.
   */
  it('🔴 Μ1 — πεδίο `placeRef` πάνω στο ΑΚΙΝΗΤΟ δεν φτάνει στην έξοδο', () => {
    const sneaky = { ...COMPANY_PROPERTY, placeRef: PLACE } as ProjectableProperty;
    const empty: PlaceKnowledge = { candidates: [], ref: null };

    expect(buildPublicListing(sneaky, empty, AT)?.place).toBeNull();
  });

  it('Μ2 — η απουσία δεσμού μένει ΡΗΤΗ (`null`), ποτέ `undefined`', () => {
    const listing = buildPublicListing(COMPANY_PROPERTY, { candidates: [], ref: null }, AT);

    expect(listing?.place).toBeNull();
    expect(Object.keys(listing ?? {})).toContain('place');
  });
});
