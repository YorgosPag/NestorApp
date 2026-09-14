/**
 * @fileoverview **«ΕΜΦΑΝΙΣΗ ΤΗΛΕΦΩΝΟΥ»** — τα κανάλια ΕΝΟΣ καταστήματος, σε ανώνυμο (ADR-841 §7 Α21.16).
 * @related app/api/pro/[companyId]/locations/[locationId]/channels/route.ts ·
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
import type { RevealedChannels, RevealedPhone } from '@/types/showcase-card';

const logger = createModuleLogger('showcase-card-reveal');

export type ChannelReveal =
  | { readonly kind: 'revealed'; readonly channels: RevealedChannels }
  | { readonly kind: 'absent' }
  /** 🔴 **Δεν μάθαμε** — ποτέ ίδιο με το `absent` (N.12). */
  | { readonly kind: 'unavailable' };

export async function revealLocationChannels(
  adminDb: AdminFirestore,
  companyId: string,
  locationId: string,
): Promise<ChannelReveal> {
  // 🔑 Ο **υπάρχων** αναγνώστης με συγκάλυψη — αποσυρμένη βιτρίνα απαντά όπως η ανύπαρκτη.
  const lookup = await lookupAgencyProfile(adminDb, companyId);
  if (lookup.outcome === 'unavailable') return { kind: 'unavailable' };
  if (lookup.outcome !== 'found') return { kind: 'absent' };
  if (!lookup.showcase.locations.some(({ id }) => id === locationId)) return { kind: 'absent' };

  try {
    const snapshot = await adminDb.collection(COLLECTIONS.SHOWCASE_CARD_CHANNELS).doc(companyId).get();
    const channels = readLocationChannels(snapshot.data(), locationId);
    const phones = channels.phones
      .map(({ e164, extension }) => revealablePhone(e164, extension))
      .filter((phone): phone is RevealedPhone => phone !== null);
    if (phones.length === 0 && channels.emails.length === 0) return { kind: 'absent' };
    return { kind: 'revealed', channels: { phones, emails: channels.emails } };
  } catch (error) {
    logger.error('[CARD] Τα κανάλια δεν διαβάστηκαν — άγνωστο, όχι κενό', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'unavailable' };
  }
}
