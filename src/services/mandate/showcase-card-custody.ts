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
 * 🔑 **Α21.20 — ΤΑ EMAIL ΠΟΥ ΕΠΕΣΤΡΕΨΑΝ ΔΕΝ ΑΠΟΘΗΚΕΥΟΝΤΑΙ ΕΔΩ**: παράγονται από το ημερολόγιο
 * συμβάντων παράδοσης σε κάθε ανάγνωση (και μετά από κάθε αποθήκευση). Αποτυχία εκείνης της ανάγνωσης
 * ⇒ `emailReturns: null` («δεν μάθαμε») — **δεν** ρίχνει την κάρτα, και ποτέ δεν λέει «κανένα».
 *
 * ⚠️ **SERVER-ONLY** — Admin SDK.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { readShowcase } from '@/lib/agency/showcase-read';
import { readLocationChannels } from '@/lib/agency/showcase-card-channels-read';
import {
  formCard,
  formWebsite,
  isCardRejection,
  type VerifiedLocationDeclaration,
} from '@/lib/agency/showcase-card-form';
import { mailboxAbsentSince } from '@/lib/communications/email-delivery/recipient-standing';
import { readRecipientStandings } from '@/server/comms/email-delivery/email-delivery-ledger';
import { generateShowcaseLocationId } from '@/services/enterprise-id-convenience';
import type { AgencyProfileRejection } from '@/services/mandate/agency-profile-verdict';
import type { OwnedShowcaseLocation, ShowcaseEmailReturn, ShowcaseLocation } from '@/types/showcase-card';

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
  | { readonly kind: 'without-showcase' }
  | { readonly kind: 'failed' };

type CardWrite =
  | { readonly kind: 'saved'; readonly locations: readonly OwnedShowcaseLocation[]; readonly website: string | null }
  | { readonly kind: 'rejected'; readonly reason: AgencyProfileRejection };

/** Δημόσιο μισό + ιδιωτικό μισό → ό,τι βλέπει **ο ιδιοκτήτης** για να επεξεργαστεί. */
function ownedOf(locations: readonly ShowcaseLocation[], channelsRaw: unknown): OwnedShowcaseLocation[] {
  return locations.map((location) => ({ ...location, channels: readLocationChannels(channelsRaw, location.id) }));
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

/** Η συναλλαγή της αποθήκευσης — δημόσιο και ιδιωτικό μισό, ή τίποτα. */
async function writeCard(
  adminDb: AdminFirestore,
  companyId: string,
  declared: readonly VerifiedLocationDeclaration[],
  website: string | null,
): Promise<CardWrite> {
  const profileRef = adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId);
  const channelsRef = adminDb.collection(COLLECTIONS.SHOWCASE_CARD_CHANNELS).doc(companyId);
  return adminDb.runTransaction(async (transaction): Promise<CardWrite> => {
    const snapshot = await transaction.get(profileRef);
    const existing = snapshot.exists ? readShowcase(snapshot.data(), companyId) : null;
    if (existing?.outcome !== 'showcase') return { kind: 'rejected', reason: 'agency-profile-card-without-showcase' };

    // 🔑 Α21.18 — τα ιδιωτικά κανάλια διαβάζονται **μέσα** στη συναλλαγή: οι επιβεβαιώσεις τους
    //    επιβιώνουν μόνο για ίδια διεύθυνση, και μια εξαργύρωση που προλαβαίνει μπαίνει στο CAS.
    const storedChannels = (await transaction.get(channelsRef)).data();
    const existingIds = new Set(existing.showcase.locations.map(({ id }) => id));
    const formed = formCard(
      declared,
      existingIds,
      generateShowcaseLocationId,
      (locationId) => readLocationChannels(storedChannels, locationId).emailConfirmations,
    );
    if (isCardRejection(formed)) return { kind: 'rejected', reason: formed.reason };

    // ⚠️ `update` στο δημόσιο (το έγγραφο ανήκει στον γραφέα της βιτρίνας) · `set` χωρίς
    //    `merge` στο ιδιωτικό (η κάρτα είναι ολόκληρη — ένα αφαιρεμένο τηλέφωνο **φεύγει**).
    transaction.update(profileRef, { locations: formed.locations, website });
    transaction.set(channelsRef, { locations: formed.channels.locations });
    return { kind: 'saved', locations: ownedOf(formed.locations, formed.channels), website };
  });
}

/**
 * **«Αυτή είναι η κάρτα μου.»** — ολόκληρη, όπως η δήλωση της βιτρίνας.
 *
 * 🔑 **Υπάρχει βιτρίνα;** — ρωτιέται **μέσα** στη συναλλαγή: η κάρτα ζει στο έγγραφο της βιτρίνας,
 * και μια απόσυρση που προλαβαίνει δεν επιτρέπεται να αφήσει ορφανά κανάλια.
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

/** **Ο ιδιοκτήτης διαβάζει την κάρτα του** — δημόσιο και ιδιωτικό, για να επεξεργαστεί. */
export async function readOwnedShowcaseCard(
  adminDb: AdminFirestore,
  companyId: string,
): Promise<OwnedShowcaseCardRead> {
  try {
    const [profile, channels] = await Promise.all([
      adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId).get(),
      adminDb.collection(COLLECTIONS.SHOWCASE_CARD_CHANNELS).doc(companyId).get(),
    ]);
    const read = profile.exists ? readShowcase(profile.data(), companyId) : null;
    if (read?.outcome !== 'showcase') return { kind: 'without-showcase' };
    const locations = ownedOf(read.showcase.locations, channels.data());
    const emailReturns = await emailReturnsOf(adminDb, companyId, locations);
    return { kind: 'owned', locations, website: read.showcase.website, emailReturns };
  } catch (error) {
    logger.error('[CARD] Η ανάγνωση της κάρτας απέτυχε — άγνωστο, όχι κενό', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
}
