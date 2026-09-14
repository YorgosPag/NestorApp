/**
 * @fileoverview **ΤΟ ΣΗΜΑ ΣΤΑ ΔΥΟ ΜΙΣΑ ΤΗΣ ΚΑΡΤΑΣ** — ανάγνωση και εγγραφή των επιβεβαιώσεων email ενός
 *   καταστήματος μέσα σε συναλλαγή (ADR-841 §7 Α21.18 · Α21.20).
 * @related services/mandate/showcase-email-confirmation-decision.ts (γράφει επιβεβαίωση) ·
 *   services/mandate/showcase-email-return.service.ts (την ακυρώνει)
 * @module services/mandate/showcase-email-confirmation-store
 *
 * 🔴 **ΕΞΗΧΘΗ ΤΗ ΣΤΙΓΜΗ ΠΟΥ ΧΡΕΙΑΣΤΗΚΕ ΔΕΥΤΕΡΗ ΦΟΡΑ** (N.0.2 · N.18): ζούσε ιδιωτικό στην απόφαση. Η
 * ακύρωση από hard bounce ρωτά **το ίδιο** («είναι ακόμη η διεύθυνση στην κάρτα;») και γράφει **το ίδιο**
 * (ιδιωτική λίστα + δημόσια ημερομηνία από την **ίδια** λίστα). Δίδυμο θα σήμαινε ότι η μία πλευρά
 * μπορεί να ξεχάσει το δημόσιο μισό — σήμα που λέει «λαμβάνει» ενώ η ιδιωτική λίστα είναι κενή.
 *
 * ⚠️ **SERVER-ONLY** — Admin SDK.
 */

import 'server-only';

import type { DocumentSnapshot, Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { readLocationChannels } from '@/lib/agency/showcase-card-channels-read';
import { latestConfirmedAt } from '@/lib/agency/showcase-email-confirmation-rules';
import { readShowcase } from '@/lib/agency/showcase-read';
import { sameChannelEmail } from '@/lib/contact/channel-email';
import type { ShowcaseEmailConfirmation, ShowcaseLocation, ShowcaseLocationChannels } from '@/types/showcase-card';

/** Ποιο κανάλι: γραφείο · κατάστημα · διεύθυνση. */
export interface ShowcaseEmailAddress {
  readonly companyId: string;
  readonly locationId: string;
  readonly email: string;
}

/** Κάρτα που **ακόμη** δημοσιεύει αυτή τη διεύθυνση σε αυτό το κατάστημα. */
export interface CardWithEmail {
  readonly agencyName: string;
  readonly locations: readonly ShowcaseLocation[];
  readonly channels: ShowcaseLocationChannels;
  readonly storedLocations: Record<string, unknown>;
}

function cardWithEmail(profile: DocumentSnapshot, channels: DocumentSnapshot, address: ShowcaseEmailAddress): CardWithEmail | null {
  const read = profile.exists ? readShowcase(profile.data(), address.companyId) : null;
  if (read?.outcome !== 'showcase') return null;
  if (!read.showcase.locations.some(({ id }) => id === address.locationId)) return null;
  const stored = readLocationChannels(channels.data(), address.locationId);
  if (!stored.emails.some((email) => sameChannelEmail(email, address.email))) return null;
  const rawLocations = (channels.data() as { locations?: unknown } | undefined)?.locations;
  return {
    agencyName: read.showcase.displayName,
    locations: read.showcase.locations,
    channels: stored,
    storedLocations: typeof rawLocations === 'object' && rawLocations !== null ? (rawLocations as Record<string, unknown>) : {},
  };
}

/**
 * **Η κάρτα, αν δημοσιεύει ακόμη αυτή τη διεύθυνση** — ή `null`.
 *
 * ⚠️ Μέσα σε συναλλαγή οι αναγνώσεις είναι **διαδοχικές**: κάθε μία μπαίνει στο CAS πριν από την πρώτη εγγραφή.
 */
export async function readCardWithEmail(
  adminDb: AdminFirestore,
  address: ShowcaseEmailAddress,
  tx?: Transaction,
): Promise<CardWithEmail | null> {
  const profileRef = adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(address.companyId);
  const channelsRef = adminDb.collection(COLLECTIONS.SHOWCASE_CARD_CHANNELS).doc(address.companyId);
  const profile = tx ? await tx.get(profileRef) : await profileRef.get();
  const channels = tx ? await tx.get(channelsRef) : await channelsRef.get();
  return cardWithEmail(profile, channels, address);
}

/**
 * **Γράψε τις επιβεβαιώσεις ενός καταστήματος** — ιδιωτικό κανάλι **και** δημόσιο `emailConfirmedAt`,
 * από την **ίδια** λίστα, στην **ίδια** συναλλαγή.
 */
export function writeLocationConfirmations(
  adminDb: AdminFirestore,
  tx: Transaction,
  address: ShowcaseEmailAddress,
  card: CardWithEmail,
  confirmations: readonly ShowcaseEmailConfirmation[],
): void {
  const emailConfirmedAt = latestConfirmedAt(confirmations);
  tx.set(adminDb.collection(COLLECTIONS.SHOWCASE_CARD_CHANNELS).doc(address.companyId), {
    locations: { ...card.storedLocations, [address.locationId]: { ...card.channels, emailConfirmations: confirmations } },
  });
  tx.update(adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(address.companyId), {
    locations: card.locations.map((location) => (location.id === address.locationId ? { ...location, emailConfirmedAt } : location)),
  });
}
