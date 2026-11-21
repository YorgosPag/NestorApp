/**
 * @fileoverview 🏆 **Η ΚΑΡΤΑ ΩΣ ΠΡΑΞΗ** — ο **μόνος** γραφέας της ψηφιακής κάρτας (ADR-841 §7 Α21.16 · Α21.17 · Α21.20).
 * @related lib/agency/showcase-card-form.ts (η κρίση) · app/api/agency-profile/card/route.ts ·
 *   services/mandate/showcase-mark-custody.ts (το πρότυπο) · server/comms/email-delivery/email-delivery-ledger.ts
 * @module services/mandate/showcase-card-custody
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΗ ΠΡΑΞΗ — ΤΟ ΜΑΘΗΜΑ ΤΟΥ ΣΗΜΑΤΟΣ, ΤΡΙΤΗ ΦΟΡΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Τα κανάλια ζουν σε `deny_all` συλλογή, άρα η οθόνη της βιτρίνας **δεν μπορεί να τα διαβάσει
 * πίσω** από το δημόσιο έγγραφο. Αν η κάρτα ταξίδευε μέσα στη δήλωση της βιτρίνας (`set` χωρίς
 * `merge`), κάθε αλλαγή επωνυμίας θα έσβηνε τηλέφωνα που η οθόνη **δεν είχε από πού** να
 * ξαναστείλει — ακριβώς το περιστατικό του `mark` (Α21 Φάση 2).
 *
 * 🔑 **ΜΙΑ ΣΥΝΑΛΛΑΓΗ, ΔΥΟ ΕΓΓΡΑΦΑ**: `agency_profiles.locations` + `website` (δημόσιο) και
 * `showcase_card_channels` (ιδιωτικό) γράφονται **ατομικά**. Αλλιώς μια αποτυχία στη μέση θα
 * άφηνε κουμπί «Εμφάνιση τηλεφώνου» που δεν φέρνει τίποτα — ή τηλέφωνα που κανένα κουμπί δεν δείχνει.
 *
 * 🔑 **Α23.14.3 — ΠΡΙΝ ΤΗΝ ΠΡΩΤΗ ΔΗΜΟΣΙΕΥΣΗ**: το δημόσιο μισό περιμένει ως `draft` στο **ίδιο** ιδιωτικό έγγραφο·
 * η πρώτη δημοσίευση (`publishShowcase`) το μεταφέρει στη βιτρίνα και το σβήνει **στην ίδια συναλλαγή**.
 *
 * 🔑 **Α21.20 — ΤΑ EMAIL ΠΟΥ ΕΠΕΣΤΡΕΨΑΝ ΔΕΝ ΑΠΟΘΗΚΕΥΟΝΤΑΙ ΕΔΩ**: παράγονται από το ημερολόγιο
 * συμβάντων παράδοσης σε κάθε ανάγνωση (και μετά από κάθε αποθήκευση). Αποτυχία εκείνης της ανάγνωσης
 * ⇒ `emailReturns: null` («δεν μάθαμε») — **δεν** ρίχνει την κάρτα, και ποτέ δεν λέει «κανένα».
 *
 * ⚠️ **SERVER-ONLY** — Admin SDK.
 */

import 'server-only';

import type { DocumentReference, Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { readShowcase } from '@/lib/agency/showcase-read';
import { athensClockAt } from '@/lib/calendar/weekly-hours';
import {
  readCardDraft,
  readLocationChannels,
  readLocationPremises,
  type ShowcaseCardDraft,
} from '@/lib/agency/showcase-card-channels-read';
import { areaOnlyResidue, stripAreaOnlyResidue } from '@/lib/agency/showcase-area-only-residue';
import { showcaseLocationArea } from '@/services/places/showcase-location-area';
import {
  formCard,
  formWebsite,
  isCardRejection,
  type FormedCard,
  type VerifiedLocationDeclaration,
} from '@/lib/agency/showcase-card-form';
import { mailboxAbsentSince } from '@/lib/communications/email-delivery/recipient-standing';
import { readRecipientStandings } from '@/server/comms/email-delivery/email-delivery-ledger';
import { generateShowcaseLocationId } from '@/services/enterprise-id-convenience';
import type { AgencyProfileRejection } from '@/services/mandate/agency-profile-verdict';
import type {
  OwnedShowcaseLocation,
  ShowcaseEmailReturn,
  ShowcaseLocation,
  ShowcaseLocationArea,
} from '@/types/showcase-card';
import type { PlaceRef } from '@/types/geo/public-place';

const logger = createModuleLogger('showcase-card-custody');

/** Ό,τι βλέπει **ο ιδιοκτήτης** για να επεξεργαστεί: τα καταστήματα με τα κανάλια τους, και η ιστοσελίδα. */
export interface OwnedShowcaseCard {
  readonly locations: readonly OwnedShowcaseLocation[];
  readonly website: string | null;
  /** Α21.20 — email της κάρτας που επέστρεψαν οριστικά· `null` = δεν μάθαμε. */
  readonly emailReturns: readonly ShowcaseEmailReturn[] | null;
}

export type ShowcaseCardWriteResult =
  | ({ readonly kind: 'saved' } & OwnedShowcaseCard)
  | { readonly kind: 'rejected'; readonly reason: AgencyProfileRejection }
  | { readonly kind: 'failed' };

export type OwnedShowcaseCardRead =
  | ({ readonly kind: 'owned' } & OwnedShowcaseCard)
  | { readonly kind: 'failed' };

type CardWrite =
  | { readonly kind: 'saved'; readonly locations: readonly OwnedShowcaseLocation[]; readonly website: string | null }
  | { readonly kind: 'rejected'; readonly reason: AgencyProfileRejection };

/**
 * Δημόσιο μισό + ιδιωτικό μισό → ό,τι βλέπει **ο ιδιοκτήτης** για να επεξεργαστεί.
 *
 * 🔑 ADR-896 §6 — ο τόπος του καταστήματος «μόνο περιοχή» **δεν** υπάρχει στο δημόσιο· έρχεται από το ιδιωτικό
 * `premises`, ώστε η φόρμα να ξανανοίγει με τον ίδιο τόπο και μια αποθήκευση να μην τον «ξεχνά».
 */
function ownedOf(locations: readonly ShowcaseLocation[], privateRaw: unknown): OwnedShowcaseLocation[] {
  return locations.map((location) => ({
    ...location,
    channels: readLocationChannels(privateRaw, location.id),
    premises: location.street !== null ? location.place : readLocationPremises(privateRaw, location.id),
  }));
}

/** Α21.20 — **ποια email της κάρτας επέστρεψαν οριστικά**, από το ημερολόγιο. Δεν πετά ποτέ. */
async function emailReturnsOf(
  adminDb: AdminFirestore,
  companyId: string,
  locations: readonly OwnedShowcaseLocation[],
): Promise<readonly ShowcaseEmailReturn[] | null> {
  const emails = locations.flatMap(({ channels }) => channels.emails);
  if (emails.length === 0) return [];
  try {
    const standings = await readRecipientStandings(adminDb, emails);
    const returns: ShowcaseEmailReturn[] = [];
    for (const [email, standing] of standings) {
      const returnedAt = mailboxAbsentSince(standing);
      if (returnedAt !== null) returns.push({ email, returnedAt });
    }
    return returns;
  } catch (error) {
    logger.warn('[CARD] Η κατάσταση παράδοσης των email δεν διαβάστηκε — άγνωστο, όχι «κανένα»', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * **Πού ζει σήμερα το δημόσιο μισό της κάρτας** (Α23.14.3): στη βιτρίνα αν δημοσιεύτηκε, αλλιώς στο **πρόχειρο** του
 * ιδιωτικού εγγράφου. Ένα από τα δύο, **ποτέ** και τα δύο — η πρώτη δημοσίευση σβήνει το πρόχειρο στην ίδια συναλλαγή.
 */
interface CardHome {
  readonly published: boolean;
  readonly locations: readonly ShowcaseLocation[];
  readonly website: string | null;
}

function cardHomeOf(profileRaw: unknown, privateRaw: unknown, companyId: string): CardHome {
  const read = profileRaw === undefined ? null : readShowcase(profileRaw, companyId);
  if (read?.outcome === 'showcase') {
    return { published: true, locations: read.showcase.locations, website: read.showcase.website };
  }
  const draft = readCardDraft(privateRaw);
  return { published: false, locations: draft?.locations ?? [], website: draft?.website ?? null };
}

/**
 * **Το πρόχειρο της κάρτας, μέσα σε ΞΕΝΗ συναλλαγή** (Α23.14.3) — η δημοσίευση (που το μεταφέρει) και η προεπισκόπηση
 * (που κρίνει την έδρα του) ρωτούν **εδώ**, με τον ίδιο αναγνώστη με τον γραφέα. Η ανάγνωση μπαίνει στο CAS: μια
 * αποθήκευση κάρτας που προλαβαίνει ξανατρέχει τη συναλλαγή του καλούντα. ⚠️ Καλείται **πριν** από κάθε γραφή.
 */
export async function readCardDraftIn(
  adminDb: AdminFirestore,
  transaction: Transaction,
  companyId: string,
): Promise<ShowcaseCardDraft | null> {
  const snapshot = await transaction.get(adminDb.collection(COLLECTIONS.SHOWCASE_CARD_CHANNELS).doc(companyId));
  return readCardDraft(snapshot.data());
}

/**
 * **Οι γραφές της αποθήκευσης** — επιστρέφει το ιδιωτικό μισό που γράφτηκε.
 *
 * ⚠️ `update` στο δημόσιο (το έγγραφο ανήκει στον γραφέα της βιτρίνας) · `set` χωρίς `merge` στο ιδιωτικό (η κάρτα
 * είναι ολόκληρη — ένα αφαιρεμένο τηλέφωνο **φεύγει**). ADR-896 §6 — ο τόπος των «μόνο περιοχή» ζει στο ιδιωτικό.
 *
 * 🔴 Α23.14.3 — **χωρίς βιτρίνα ΤΙΠΟΤΑ στο δημόσιο**: η ύπαρξη του `agency_profiles` ΕΙΝΑΙ η δημοσίευση. Το δημόσιο
 * μισό περιμένει στο ιδιωτικό (`deny_all`) ως `draft`, στο **ίδιο** `set`.
 */
function writeHalves(
  transaction: Transaction,
  refs: { readonly profileRef: DocumentReference; readonly channelsRef: DocumentReference },
  published: boolean,
  formed: FormedCard,
  website: string | null,
): Record<string, unknown> {
  const privateHalf = { locations: formed.channels.locations, premises: formed.premises };
  if (!published) {
    transaction.set(refs.channelsRef, { ...privateHalf, draft: { locations: formed.locations, website } });
    return privateHalf;
  }
  transaction.update(refs.profileRef, { locations: formed.locations, website });
  transaction.set(refs.channelsRef, privateHalf);
  return privateHalf;
}

/** Η συναλλαγή της αποθήκευσης — δημόσιο (ή πρόχειρο) και ιδιωτικό μισό, ή τίποτα. */
async function writeCard(
  adminDb: AdminFirestore,
  companyId: string,
  declared: readonly VerifiedLocationDeclaration[],
  website: string | null,
): Promise<CardWrite> {
  const profileRef = adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId);
  const channelsRef = adminDb.collection(COLLECTIONS.SHOWCASE_CARD_CHANNELS).doc(companyId);
  return adminDb.runTransaction(async (transaction): Promise<CardWrite> => {
    // 🔑 Η βιτρίνα ρωτιέται **μέσα** στη συναλλαγή: μια δημοσίευση ή απόσυρση που προλαβαίνει μπαίνει στο CAS.
    const snapshot = await transaction.get(profileRef);
    // 🔑 Α21.18 — τα ιδιωτικά κανάλια διαβάζονται **μέσα** στη συναλλαγή: οι επιβεβαιώσεις τους
    //    επιβιώνουν μόνο για ίδια διεύθυνση, και μια εξαργύρωση που προλαβαίνει μπαίνει στο CAS.
    const storedChannels = (await transaction.get(channelsRef)).data();
    const home = cardHomeOf(snapshot.exists ? snapshot.data() : undefined, storedChannels, companyId);
    // 🔑 Α23.14.3 — τα ids του προχείρου **κρατιούνται**, ώστε τα κανάλια να ταιριάζουν και μετά τη δημοσίευση.
    const existingIds = new Set(home.locations.map(({ id }) => id));
    const formed = formCard(
      declared,
      existingIds,
      generateShowcaseLocationId,
      (locationId) => readLocationChannels(storedChannels, locationId).emailConfirmations,
      // Α21.21 — «σήμερα» για τις ειδικές ώρες είναι σήμερα ΣΤΗΝ ΕΛΛΑΔΑ, όχι του διακομιστή (UTC).
      athensClockAt(new Date()).dateKey,
    );
    if (isCardRejection(formed)) return { kind: 'rejected', reason: formed.reason };

    const privateHalf = writeHalves(transaction, { profileRef, channelsRef }, home.published, formed, website);
    return { kind: 'saved', locations: ownedOf(formed.locations, privateHalf), website };
  });
}

/**
 * **«Αυτή είναι η κάρτα μου.»** — ολόκληρη, όπως η δήλωση της βιτρίνας.
 *
 * 🔑 **Υπάρχει βιτρίνα;** — ρωτιέται **μέσα** στη συναλλαγή: με βιτρίνα η κάρτα γράφεται στο έγγραφό της· χωρίς,
 * ως **πρόχειρο** στο ιδιωτικό (Α23.14.3 — πρότυπο Stripe/Google Business Profile: συμπληρώνεις **πριν** βγεις live).
 *
 * @param websiteRaw Η ιστοσελίδα όπως πληκτρολογήθηκε — κρίνεται **εδώ**, με τον ίδιο κριτή που φυλά τον αναγνώστη.
 */
export async function saveShowcaseCard(
  adminDb: AdminFirestore,
  companyId: string,
  declared: readonly VerifiedLocationDeclaration[],
  websiteRaw: string | null,
): Promise<ShowcaseCardWriteResult> {
  const website = formWebsite(websiteRaw);
  if (isCardRejection(website)) return { kind: 'rejected', reason: website.reason };
  let written: CardWrite;
  try {
    written = await writeCard(adminDb, companyId, declared, website);
  } catch (error) {
    logger.error('[CARD] Η αποθήκευση της κάρτας απέτυχε', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
  if (written.kind !== 'saved') return written;
  return { ...written, emailReturns: await emailReturnsOf(adminDb, companyId, written.locations) };
}

/**
 * **Ειδικές μέρες από απάντηση email** (Α21.21 Φάση Β) — γράφει **μόνο** το δημόσιο `locations`, μέσα στη συναλλαγή του
 * καλούντος. Τα κανάλια (ιδιωτικό μισό) **δεν** αγγίζονται: μια απάντηση «Κλειστά» δεν έχει λόγο να ξαναγράψει τηλέφωνα.
 *
 * ⚠️ **Δέχεται ΜΟΝΟ κριμένα καταστήματα**: ο καλών τα περνά πρώτα από το `applyHolidayAnswers`, δηλαδή από τον **ίδιο**
 * κριτή ειδικών ωρών με τη φόρμα (`formLocationHours`). Ζει εδώ ώστε ο γραφέας της κάρτας να μένει **ένα** αρχείο.
 */
export function writeLocationSpecialHours(
  adminDb: AdminFirestore,
  transaction: Transaction,
  companyId: string,
  judged: readonly ShowcaseLocation[],
): void {
  transaction.update(adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId), { locations: judged });
}

/**
 * **Ο ιδιοκτήτης διαβάζει την κάρτα του** — δημόσιο (ή πρόχειρο) και ιδιωτικό, για να επεξεργαστεί.
 *
 * 🔑 Α23.14.3 — χωρίς βιτρίνα διαβάζεται το **πρόχειρο** (απόν ⇒ κενή κάρτα, που **είναι** αληθινή: τίποτα δεν
 * γράφτηκε). Η βλάβη μένει `failed` — ποτέ κενή κάρτα (N.12).
 */
export async function readOwnedShowcaseCard(
  adminDb: AdminFirestore,
  companyId: string,
): Promise<OwnedShowcaseCardRead> {
  try {
    const [profile, channels] = await Promise.all([
      adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId).get(),
      adminDb.collection(COLLECTIONS.SHOWCASE_CARD_CHANNELS).doc(companyId).get(),
    ]);
    const home = cardHomeOf(profile.exists ? profile.data() : undefined, channels.data(), companyId);
    const locations = ownedOf(home.locations, channels.data());
    const emailReturns = await emailReturnsOf(adminDb, companyId, locations);
    return { kind: 'owned', locations, website: home.website, emailReturns };
  } catch (error) {
    logger.error('[CARD] Η ανάγνωση της κάρτας απέτυχε — άγνωστο, όχι κενό', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
}

/** Η έκβαση της μετάπτωσης ενός εγγράφου — `unavailable` = δεν διαβάστηκε το ευρετήριο περιοχών, ξαναδοκίμασε. */
export type AreaOnlyPremisesMove = 'moved' | 'clean' | 'absent' | 'unavailable';

/**
 * **Ο τόπος των καταστημάτων «μόνο περιοχή» φεύγει από το δημόσιο έγγραφο** (ADR-896 §6 — μετάπτωση).
 *
 * 🔑 **ΜΙΑ ΣΥΝΑΛΛΑΓΗ, ΔΥΟ ΕΓΓΡΑΦΑ** — όπως η αποθήκευση: ο τόπος γράφεται στο ιδιωτικό `premises` (`merge`: τα
 * κανάλια μένουν) **και** αφαιρείται από το δημόσιο, με τον δήμο στη θέση του. Αλλιώς μια αποτυχία στη μέση θα
 * άφηνε τον ιδιοκτήτη χωρίς τόπο στη φόρμα — ή τη διεύθυνση ακόμη δημόσια.
 *
 * 🔑 **Ιδεμποτική**: ο κριτής (`areaOnlyResidue`) διαβάζεται **μέσα** στη συναλλαγή· δεύτερο τρέξιμο ⇒ `clean`.
 */
export async function moveAreaOnlyPremises(adminDb: AdminFirestore, companyId: string): Promise<AreaOnlyPremisesMove> {
  const profileRef = adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId);
  const channelsRef = adminDb.collection(COLLECTIONS.SHOWCASE_CARD_CHANNELS).doc(companyId);
  return adminDb.runTransaction(async (transaction): Promise<AreaOnlyPremisesMove> => {
    const snapshot = await transaction.get(profileRef);
    const rawLocations: unknown = snapshot.data()?.locations;
    if (!snapshot.exists || !Array.isArray(rawLocations)) return 'absent';
    const residue = areaOnlyResidue(rawLocations);
    if (residue.length === 0) return 'clean';

    const areas = new Map<string, ShowcaseLocationArea | null>();
    const premises: Record<string, PlaceRef> = {};
    for (const { locationId, place, position } of residue) {
      const area = await showcaseLocationArea(position);
      if (area === 'unavailable') return 'unavailable';
      areas.set(locationId, area.area);
      if (place !== null) premises[locationId] = place;
    }
    transaction.set(channelsRef, { premises }, { merge: true });
    transaction.update(profileRef, { locations: stripAreaOnlyResidue(rawLocations, areas) });
    return 'moved';
  });
}
