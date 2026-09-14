/**
 * @fileoverview **«ΕΜΦΑΝΙΣΗ ΤΗΛΕΦΩΝΟΥ» ΚΑΙ «ΑΠΟΘΗΚΕΥΣΗ ΕΠΑΦΗΣ»** — τα κανάλια ΕΝΟΣ καταστήματος, σε ανώνυμο
 *   (ADR-841 §7 Α21.16 · Α21.17).
 * @related app/api/pro/[companyId]/locations/[locationId]/{channels,vcard}/route.ts ·
 *   services/mandate/agency-profile.service.ts (`lookupAgencyProfile`)
 * @module services/mandate/showcase-card-reveal
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΓΙΑΤΙ ΑΥΤΟ ΞΕΠΕΡΝΑ ΤΟ «ΚΛΙΚ ΓΙΑ ΑΠΟΚΑΛΥΨΗ» ΤΩΝ ΜΕΓΑΛΩΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Idealista · XE · Leboncoin κρύβουν τον αριθμό από το HTML — και οι εταιρείες scraping
 * **πουλάνε** έτοιμους συλλέκτες «by phone». Εδώ ο αριθμός δεν υπάρχει ούτε στο HTML **ούτε**
 * στη δημόσια βάση: φεύγει **ένα κατάστημα τη φορά**, από τον διακομιστή, με όριο `HEAVY`
 * (10/λεπτό ανά hash IP, fail-closed).
 *
 * 🔴 **ΔΥΟ ΠΟΡΤΕΣ, ΕΝΑΣ ΑΝΑΓΝΩΣΤΗΣ** (Α21.17): η vCard περιέχει **τους ίδιους αριθμούς** με την εμφάνιση —
 * άρα μετρά ως εμφάνιση, περνά από το **ίδιο** όριο και διαβάζει από τον **ίδιο** {@link revealLocationCard}.
 * Δεύτερος αναγνώστης θα μπορούσε να διαφωνήσει για το «υπάρχει;» — και η διαφωνία θα ήταν μαντείο.
 *
 * 🔑 **ΤΑΥΤΟΣΗΜΟ `absent`** για αδημοσίευτη βιτρίνα · ανύπαρκτο κατάστημα · κατάστημα χωρίς
 * κανάλια — η πόρτα **δεν** γίνεται μαντείο *«υπάρχει αυτό το γραφείο;»* (συγκάλυψη ADR-742).
 *
 * ⛔ **ΚΑΝΕΝΑΣ ΜΕΤΡΗΤΗΣ** (απόφαση Giorgio 2026-09-14 · ADR-843 ΠΕ2/ΠΕ3): πεδίο «πόσοι πάτησαν»
 * θα ήταν έτοιμο διάνυσμα κατάταξης, και παρακολούθηση επισκεπτών.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { revealablePhone } from '@/lib/contact/channel-phone';
import { readLocationChannels } from '@/lib/agency/showcase-card-channels-read';
import { lookupAgencyProfile } from '@/services/mandate/agency-profile.service';
import type { PublicShowcase } from '@/types/agency-profile';
import type {
  RevealedChannels,
  RevealedPhone,
  ShowcaseLocation,
  ShowcaseLocationChannels,
} from '@/types/showcase-card';

const logger = createModuleLogger('showcase-card-reveal');

const ABSENT = { kind: 'absent' } as const;
const UNAVAILABLE = { kind: 'unavailable' } as const;

export type ChannelReveal =
  | { readonly kind: 'revealed'; readonly channels: RevealedChannels }
  | { readonly kind: 'absent' }
  /** 🔴 **Δεν μάθαμε** — ποτέ ίδιο με το `absent` (N.12). */
  | { readonly kind: 'unavailable' };

/** Ό,τι χρειάζεται μια **επαφή**: η βιτρίνα, το κατάστημα, και τα **έγκυρα** κανάλια του. */
export type LocationCardReveal =
  | {
      readonly kind: 'revealed';
      readonly showcase: PublicShowcase;
      readonly location: ShowcaseLocation;
      readonly channels: ShowcaseLocationChannels;
    }
  | { readonly kind: 'absent' }
  | { readonly kind: 'unavailable' };

/**
 * **Ο ΕΝΑΣ αναγνώστης** — βιτρίνα με συγκάλυψη, κατάστημα, κανάλια.
 *
 * ⚠️ Τα τηλέφωνα που **δεν** κανονικοποιούνται πια (π.χ. άλλαξε ο πίνακας αριθμοδότησης) φιλτράρονται
 * **εδώ**, μία φορά — ώστε η εμφάνιση και η επαφή να μη διαφωνούν για το ποιοι αριθμοί υπάρχουν.
 */
export async function revealLocationCard(
  adminDb: AdminFirestore,
  companyId: string,
  locationId: string,
): Promise<LocationCardReveal> {
  // 🔑 Ο **υπάρχων** αναγνώστης με συγκάλυψη — αποσυρμένη βιτρίνα απαντά όπως η ανύπαρκτη.
  const lookup = await lookupAgencyProfile(adminDb, companyId);
  if (lookup.outcome === 'unavailable') return UNAVAILABLE;
  if (lookup.outcome !== 'found') return ABSENT;
  const location = lookup.showcase.locations.find(({ id }) => id === locationId);
  if (location === undefined) return ABSENT;

  try {
    const snapshot = await adminDb.collection(COLLECTIONS.SHOWCASE_CARD_CHANNELS).doc(companyId).get();
    const stored = readLocationChannels(snapshot.data(), locationId);
    const phones = stored.phones.filter(({ e164, extension }) => revealablePhone(e164, extension) !== null);
    if (phones.length === 0 && stored.emails.length === 0) return ABSENT;
    return { kind: 'revealed', showcase: lookup.showcase, location, channels: { ...stored, phones } };
  } catch (error) {
    logger.error('[CARD] Τα κανάλια δεν διαβάστηκαν — άγνωστο, όχι κενό', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return UNAVAILABLE;
  }
}

/** **«Εμφάνιση τηλεφώνου»** — τα κανάλια έτοιμα για τη σελίδα, χωρίς βιβλιοθήκη εκεί. */
export async function revealLocationChannels(
  adminDb: AdminFirestore,
  companyId: string,
  locationId: string,
): Promise<ChannelReveal> {
  const card = await revealLocationCard(adminDb, companyId, locationId);
  if (card.kind !== 'revealed') return card;
  const phones = card.channels.phones
    .map(({ e164, extension }) => revealablePhone(e164, extension))
    .filter((phone): phone is RevealedPhone => phone !== null);
  return {
    kind: 'revealed',
    channels: { phones, emails: card.channels.emails, emailConfirmations: card.channels.emailConfirmations },
  };
}
