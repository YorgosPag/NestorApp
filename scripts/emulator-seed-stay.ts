/**
 * ============================================================================
 * 🏖️ SEED — ΒΡΑΧΥΧΡΟΝΙΑ ΔΙΑΜΟΝΗ ΓΙΑ ΖΩΝΤΑΝΗ ΕΠΑΛΗΘΕΥΣΗ (ADR-777 §8.60.21.7)
 * ============================================================================
 *
 * Δύο αγγελίες βραχυχρόνιας με **δηλωμένη** πολιτική κατοικιδίων, για να περπατηθούν ζωντανά τα
 * σενάρια που θέλουν **εγγραφή** (χρέωση κατοικιδίου στο σύνολο · `maxPets` · αίτημα + εισερχόμενο ·
 * `price-changed`) — **χωρίς** να αγγιχτεί η παραγωγή.
 *
 * 🔑 **ΜΟΝΟ ΠΡΑΓΜΑΤΙΚΟΙ ΓΡΑΦΕΙΣ — ΚΑΝΕΝΑ ΧΕΙΡΟΓΡΑΦΟ ΕΓΓΡΑΦΟ.** Ένα `db.doc(…).set({…})` εδώ θα ήταν
 * **δεύτερη αλήθεια του σχήματος**: θα περνούσε ό,τι ο πραγματικός γραφέας απορρίπτει, και θα έλειπε
 * ό,τι εκείνος παράγει (δημοσίευση · `schemaVersion` · ίχνος ελέγχου). Άρα ο seeder περνά από την
 * **ίδια πόρτα** με το `POST /api/owner-properties`: πρώτα ο αναλυτής του δικτύου
 * (`ownerPropertyDraftFromRequest`), μετά ο γραφέας (`createOwnerProperty` / `updateOwnerProperty`),
 * μετά το ημερολόγιο (`executeStayCalendarCommand`). Απόκλιση του seeder από το σχήμα **σκάει εδώ**,
 * όχι σιωπηλά στην οθόνη.
 *
 * 🛡️ **Καμία διαδρομή προς την παραγωγή**: το `runSeeder` θέτει `FIRESTORE_EMULATOR_HOST` **πριν**
 * αρχικοποιηθεί ο Admin SDK και τερματίζει αν ο emulator δεν απαντά. ⚠️ Το project id του emulator είναι
 * **ίδιο** με της παραγωγής (`pagonis-87766`) — η **σειρά** είναι η προστασία, γι' αυτό **καμία** δική
 * μας αρχικοποίηση εδώ.
 *
 * 🎯 **Δύο αγγελίες, σχεδιασμένες να ΔΙΑΚΡΙΝΟΥΝ τα δύο κλειδιά ταξινόμησης** (3 νύχτες, 2 κατοικίδια):
 *   Α «Στούντιο με αυλή»   50 €/νύχτα + 10 €/κατοικίδιο/νύχτα = 150 + 60 = **210 €**
 *   Β «Διαμέρισμα με θέα»  60 €/νύχτα, κατοικίδια δωρεάν      =            **180 €**
 * Κατά τιμή νύχτας: Α πριν Β. Κατά **πραγματικό** σύνολο: **Β πριν Α**. Η αντιστροφή είναι η απόδειξη.
 *
 * ♻️ **Ιδεμποτεντικό**: υπάρχει ήδη η αγγελία του κατόχου ⇒ `updateOwnerProperty` με τις **ίδιες**
 * ταυτότητες προσφορών (Α20 σημ. 4)· δεν υπάρχει ⇒ `createOwnerProperty`. Δύο εκτελέσεις = ίδια βάση.
 *
 * Χρήση (με τον emulator ήδη σε λειτουργία και τα personas σπαρμένα):
 *   npm run emulator:seed-stay                     ← αρχική σπορά
 *   npm run emulator:seed-stay -- --nightly 55     ← σενάριο `price-changed`: αλλάζει την τιμή της Α
 *
 * ⚠️ `NODE_OPTIONS=--conditions=react-server` (στο `package.json`): οι γραφείς έχουν `import 'server-only'`,
 * που πετά σε σκέτο Node. Ίδιος δηλωμένος μηχανισμός με το `backfill:first-contact-offerer`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-777-unified-property-map-search.md §8.60.21.7
 * @see scripts/emulator-seed-personas.ts — οι ταυτότητες
 */

import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ownerPropertyDraftFromRequest } from '@/lib/owner-property/owner-property-draft-schema';
import type { ListingActor } from '@/lib/owner-property/listing-custody';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import {
  createOwnerProperty,
  updateOwnerProperty,
} from '@/services/owner-property/owner-property-write.service';
import type { OwnerPropertyWriteResult } from '@/services/owner-property/owner-property-write-result';
import { executeStayCalendarCommand } from '@/services/stay-calendar/stay-calendar-write.service';
import type { StayPetPolicy } from '@/types/property-offers';

import { runSeeder, seedIdentity, type SeedIdentity } from './lib/emulator/identity';
import { PERSONAS } from './lib/emulator/personas';

// ============================================================================
// ΤΑ ΔΕΔΟΜΕΝΑ
// ============================================================================

const OWNER_EMAIL = 'ext.owner@solo.local';
const GUEST_EMAIL = 'ext.seeker@solo.local';

interface StayFixture {
  readonly title: string;
  readonly nightly: number;
  readonly pets: StayPetPolicy;
  readonly point: { readonly lat: number; readonly lng: number };
}

/** Η Α είναι αυτή που αλλάζει τιμή στο σενάριο `price-changed` (`--nightly`). */
const FIXTURES: readonly [StayFixture, StayFixture] = [
  {
    title: 'Στούντιο με αυλή (DEMO)',
    nightly: 50,
    pets: { accepts: 'yes', maxPets: 2, fee: { amount: 10, per: 'petNight' } },
    point: { lat: 40.6401, lng: 22.9444 },
  },
  {
    title: 'Διαμέρισμα με θέα (DEMO)',
    nightly: 60,
    pets: { accepts: 'yes', maxPets: 2, fee: null },
    point: { lat: 40.632, lng: 22.948 },
  },
];

// ============================================================================
// ΒΟΗΘΗΤΙΚΑ
// ============================================================================

function persona(email: string): SeedIdentity {
  const found = PERSONAS.find((person) => person.email === email);
  if (!found) throw new Error(`Λείπει το persona ${email} από το scripts/lib/emulator/personas.ts`);
  return found;
}

/** `--nightly 55` ⇒ 55. Απούσα ⇒ `null` (η τιμή του fixture). Άκυρη ⇒ σφάλμα, ποτέ σιωπηλή προεπιλογή. */
function nightlyOverride(argv: readonly string[]): number | null {
  const at = argv.indexOf('--nightly');
  if (at === -1) return null;
  const value = Number(argv[at + 1]);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Άκυρο --nightly: «${argv[at + 1] ?? ''}»`);
  return value;
}

/** Η υπάρχουσα αγγελία του κατόχου με αυτόν τον τίτλο — ταυτότητα ακινήτου + προσφοράς, ή `null`. */
async function existingListing(
  db: Firestore,
  ownerUid: string,
  title: string,
): Promise<{ readonly id: string; readonly offerId: string } | null> {
  const snapshot = await db
    .collection(COLLECTIONS.OWNER_PROPERTIES)
    .where('authorUserId', '==', ownerUid)
    .where('title', '==', title)
    .limit(1)
    .get();
  const doc = snapshot.docs[0];
  if (!doc) return null;
  const offers: ReadonlyArray<{ readonly id: string; readonly kind: string }> = doc.get('offers') ?? [];
  const stay = offers.find((offer) => offer.kind === 'leaseShort');
  return stay ? { id: doc.id, offerId: stay.id } : null;
}

/** Το προσχέδιο — περνά από τον **αναλυτή του δικτύου**, όπως κάθε αίτημα του κατόχου. */
function draftOf(fixture: StayFixture, offerId: string, nightly: number) {
  const parsed = ownerPropertyDraftFromRequest({
    title: fixture.title,
    type: 'apartment',
    areaSqm: 45,
    floor: 1,
    bedrooms: 1,
    offers: [{
      id: offerId,
      kind: 'leaseShort',
      lifecycle: 'active',
      nightlyRate: nightly,
      minNights: 1,
      maxGuests: 2,
      pets: fixture.pets,
    }],
    place: { kind: 'declared', point: fixture.point, label: 'Θεσσαλονίκη', accuracy: null, link: null },
    media: [],
  });
  if (!parsed.ok) throw new Error(`Το προσχέδιο «${fixture.title}» απορρίφθηκε: ${parsed.malformed.join(', ')}`);
  return parsed.draft;
}

/** Αποτυχία **δυνατά**: αγγελία που δεν δημοσιεύτηκε είναι αόρατη στην αναζήτηση — ψευδές «έτοιμο». */
function assertPublished(title: string, result: OwnerPropertyWriteResult): string {
  if (result.kind !== 'saved') {
    const detail = result.kind === 'invalid' ? result.violations.join(', ') : result.kind;
    throw new Error(`«${title}»: ο γραφέας απάντησε ${result.kind} (${detail})`);
  }
  if (result.publish !== 'published') throw new Error(`«${title}»: αποθηκεύτηκε αλλά δημοσίευση = ${result.publish}`);
  return result.property.id;
}

// ============================================================================
// Η ΣΠΟΡΑ
// ============================================================================

async function seedListing(db: Firestore, owner: ListingActor, fixture: StayFixture, nightly: number): Promise<string> {
  const existing = await existingListing(db, owner.uid, fixture.title);
  const offerId = existing?.offerId ?? enterpriseIdService.generatePropertyOfferId();
  const draft = draftOf(fixture, offerId, nightly);

  const result = existing
    ? await updateOwnerProperty(db, existing.id, draft, owner)
    : await createOwnerProperty(
        db,
        { id: enterpriseIdService.generateOwnerPropertyId(), authorUserId: owner.uid, authorCompanyId: null, mandates: [] },
        draft,
      );
  const id = assertPublished(fixture.title, result);

  const calendar = await executeStayCalendarCommand(db, id, { action: 'declare', declared: true }, { kind: 'host', actor: owner });
  if (calendar.kind !== 'ok') throw new Error(`«${fixture.title}»: το ημερολόγιο απάντησε ${calendar.kind}`);

  console.log(`   ${existing ? '↻' : '✚'} ${fixture.title.padEnd(26)} ${String(nightly).padStart(3)} €/νύχτα  ${id}`);
  return id;
}

async function seed(auth: Auth, db: Firestore): Promise<void> {
  const override = nightlyOverride(process.argv);
  const owner: ListingActor = { uid: await seedIdentity(auth, db, persona(OWNER_EMAIL)), companyId: null };
  await seedIdentity(auth, db, persona(GUEST_EMAIL));

  console.log('🏖️  Αγγελίες βραχυχρόνιας (κάτοχος: ' + OWNER_EMAIL + '):');
  const [first, second] = FIXTURES;
  const firstId = await seedListing(db, owner, first, override ?? first.nightly);
  await seedListing(db, owner, second, second.nightly);

  console.log('');
  console.log('✅ Έτοιμο. Επισκέπτης: ' + GUEST_EMAIL + ' · οικοδεσπότης: ' + OWNER_EMAIL);
  console.log(`   Σελίδα Α: http://localhost:3001/listing/${firstId}?pets=2`);
}

runSeeder(seed);
