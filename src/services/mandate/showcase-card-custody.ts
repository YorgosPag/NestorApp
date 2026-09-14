/**
 * @fileoverview 🏆 **Η ΚΑΡΤΑ ΩΣ ΠΡΑΞΗ** — ο **μόνος** γραφέας της ψηφιακής κάρτας (ADR-841 §7 Α21.16 · Α21.17).
 * @related lib/agency/showcase-card-form.ts (η κρίση) · app/api/agency-profile/card/route.ts ·
 *   services/mandate/showcase-mark-custody.ts (το πρότυπο)
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
import { generateShowcaseLocationId } from '@/services/enterprise-id-convenience';
import type { AgencyProfileRejection } from '@/services/mandate/agency-profile-verdict';
import type { OwnedShowcaseLocation, ShowcaseLocation } from '@/types/showcase-card';

const logger = createModuleLogger('showcase-card-custody');

/** Ό,τι βλέπει **ο ιδιοκτήτης** για να επεξεργαστεί: τα καταστήματα με τα κανάλια τους, και η ιστοσελίδα. */
export interface OwnedShowcaseCard {
  readonly locations: readonly OwnedShowcaseLocation[];
  readonly website: string | null;
}

export type ShowcaseCardWriteResult =
  | ({ readonly kind: 'saved' } & OwnedShowcaseCard)
  | { readonly kind: 'rejected'; readonly reason: AgencyProfileRejection }
  | { readonly kind: 'failed' };

export type OwnedShowcaseCardRead =
  | ({ readonly kind: 'owned' } & OwnedShowcaseCard)
  | { readonly kind: 'without-showcase' }
  | { readonly kind: 'failed' };

/** Δημόσιο μισό + ιδιωτικό μισό → ό,τι βλέπει **ο ιδιοκτήτης** για να επεξεργαστεί. */
function ownedOf(locations: readonly ShowcaseLocation[], channelsRaw: unknown): OwnedShowcaseLocation[] {
  return locations.map((location) => ({ ...location, channels: readLocationChannels(channelsRaw, location.id) }));
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

  const profileRef = adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId);
  const channelsRef = adminDb.collection(COLLECTIONS.SHOWCASE_CARD_CHANNELS).doc(companyId);

  try {
    return await adminDb.runTransaction(async (transaction): Promise<ShowcaseCardWriteResult> => {
      const snapshot = await transaction.get(profileRef);
      const existing = snapshot.exists ? readShowcase(snapshot.data(), companyId) : null;
      if (existing?.outcome !== 'showcase') {
        return { kind: 'rejected', reason: 'agency-profile-card-without-showcase' };
      }

      // 🔑 Α21.18 — τα ιδιωτικά κανάλια διαβάζονται **μέσα** στη συναλλαγή: οι επιβεβαιώσεις τους
      //    επιβιώνουν μόνο για ίδια διεύθυνση, και μια εξαργύρωση που προλαβαίνει μπαίνει στο CAS.
      const channelsSnapshot = await transaction.get(channelsRef);
      const storedChannels = channelsSnapshot.data();
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
  } catch (error) {
    logger.error('[CARD] Η αποθήκευση της κάρτας απέτυχε', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
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
    return {
      kind: 'owned',
      locations: ownedOf(read.showcase.locations, channels.data()),
      website: read.showcase.website,
    };
  } catch (error) {
    logger.error('[CARD] Η ανάγνωση της κάρτας απέτυχε — άγνωστο, όχι κενό', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
}
