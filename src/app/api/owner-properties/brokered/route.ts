/**
 * @fileoverview **Η ΠΟΡΤΑ ΤΟΥ ΓΡΑΦΕΙΟΥ** — ο μεσίτης καταχωρεί για λογαριασμό πελάτη.
 * @related ADR-777 §8.33 · services/mandate/brokered-listing.service.ts
 * @module app/api/owner-properties/brokered/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΗ ΔΙΑΔΡΟΜΗ ΑΠΟ ΤΟΥ ΙΔΙΩΤΗ — ΚΑΙ ΟΧΙ ΠΡΟΑΙΡΕΤΙΚΟ ΠΕΔΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Θα ήταν εύκολο να δεχτεί το `/api/owner-properties` ένα προαιρετικό `mandate`. Θα
 * σήμαινε ότι **κάθε συνδεδεμένος χρήστης** μπορεί να δηλώσει ότι ενεργεί για
 * λογαριασμό τρίτου — δηλαδή η έγκριση θα ήταν **πεδίο που στέλνει ο αιτών**, που
 * είναι το ακριβώς αντίθετο του φρουρού.
 *
 * 🔑 **Εδώ η ταυτότητα του γραφείου ΔΕΝ έρχεται από το σώμα**: το `authorCompanyId`
 * γράφεται από το `ctx.companyId`, όπως ακριβώς το `authorUserId` από το `ctx.uid`.
 * Ένας υπάλληλος **δεν μπορεί** να καταχωρήσει στο όνομα άλλου γραφείου, γιατί δεν
 * υπάρχει πεδίο να το ζητήσει.
 *
 * ⚠️ **Ο ιδιώτης δεν έχει εταιρεία** — και γι' αυτό αυτή η πόρτα απαιτεί `companyId`
 * ενώ η αδελφή της απαγορεύει permissions. Δύο ακροατήρια, δύο πόρτες, καμία με
 * φρουρό που το ακροατήριό της δεν μπορεί να ικανοποιήσει.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
import {
  isBrokerageDenial,
  requireBrokerageCapability,
} from '@/lib/auth/brokerage-authority';
import { readCompanyCapabilities } from '@/services/company/company-capabilities.reader';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { brokeredMandateFromRequest } from '@/lib/owner-property/brokered-mandate-schema';
import {
  ownerPropertyDraftFromRequest,
  ownerPropertyIdFromRequest,
} from '@/lib/owner-property/owner-property-draft-schema';
import { readCompanyPublicName } from '@/services/company/company-public-name.reader';
import {
  agencyAttestation,
  createBrokeredListing,
  OWNER_CONSENT_PROOF,
  type NotifyOutcome,
} from '@/services/mandate/brokered-listing.service';
import {
  readMandateCatalog,
  type MandateCatalog,
} from '@/services/mandate/mandate-catalog.service';
import { nowISO } from '@/lib/date-local';
import { AGENCY_ATTESTATION } from '@/types/owner-property-mandate';

import {
  respondToMalformed,
  respondToWrite,
  type OwnerPropertyResponse,
} from '../_shared/respond';

/**
 * Ό,τι φεύγει επιπλέον της κοινής απάντησης: **τι έγινε με το μήνυμα**.
 *
 * 🔴 **Ταξιδεύει ΠΑΝΤΑ**, γιατί το γραφείο πρέπει να ξέρει αν ο πελάτης έμαθε. Χωρίς
 * αυτό, ένα «αποθηκεύτηκε» θα σήμαινε ταυτόχρονα *«του στείλαμε»* και *«η επαφή δεν
 * έχει email και δεν θα μάθει ποτέ»* — και ο μεσίτης θα περίμενε απάντηση που δεν
 * ζητήθηκε από κανέναν. Ίδιο σκεπτικό με το `publish` του §8.16.
 */
type BrokeredResponse =
  | (OwnerPropertyResponse & { readonly notify?: NotifyOutcome })
  /**
   * 🔴 **Η ΑΡΝΗΣΗ ΤΗΣ ΡΥΘΜΙΖΟΜΕΝΗΣ ΠΡΑΞΗΣ — δικό της σχήμα, επίτηδες.**
   *
   * Δεν είναι `OwnerPropertyErrorResponse`: εκείνο απαντά *«η **αγγελία** σου λέει
   * κάτι λάθος»* και οδηγεί τον άνθρωπο **στη φόρμα**. Αυτό λέει *«**δεν
   * επιτρέπεσαι** σε αυτή τη δραστηριότητα»* και τον οδηγεί **στις ρυθμίσεις του
   * οργανισμού**. Κοινός κάδος θα τον έστελνε να διορθώσει το εμβαδόν επειδή το
   * γραφείο του δεν είναι μεσιτικό.
   *
   * ⚠️ **Το `capabilityStatus` ταξιδεύει**: *«δεν δήλωσες ποτέ»* ≠ *«εκκρεμεί»* ≠
   * *«σου ανακλήθηκε»* — τρεις **διαφορετικές** θεραπείες στην οθόνη.
   */
  | {
      readonly error: 'BROKERAGE_NOT_ALLOWED';
      readonly reason: string;
      readonly capabilityStatus: string;
    };

async function handler(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<BrokeredResponse>> {
  const adminDb = getAdminFirestore();

  // ══════════════════════════════════════════════════════════════════════════
  // 🔴 Ο ΦΡΟΥΡΟΣ ΤΗΣ ΡΥΘΜΙΖΟΜΕΝΗΣ ΠΡΑΞΗΣ — ΠΡΩΤΟΣ, ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΑΛΛΗ ΔΟΥΛΕΙΑ
  // ══════════════════════════════════════════════════════════════════════════
  //
  // ⚠️ **ΠΡΙΝ την ανάγνωση του σώματος**, και είναι δύο πράγματα μαζί: δεν κάνουμε
  //    δουλειά για αιτούντα που δεν επιτρέπεται, και **δεν του λέμε αν το JSON του
  //    ήταν έγκυρο** — μια άρνηση που περιγράφει το σώμα είναι κανάλι πληροφορίας
  //    προς κάποιον που δεν έπρεπε καν να φτάσει εδώ.
  //
  // 🔑 **Μία ανάγνωση εγγράφου, και είναι η ΦΘΗΝΟΤΕΡΗ διαδρομή για την άρνηση**: η
  //    επωνυμία διαβάζεται **μετά**, μόνο για όποιον περνά.
  const authority = requireBrokerageCapability(
    ctx.companyId,
    await readCompanyCapabilities(adminDb, ctx.companyId),
  );

  if (isBrokerageDenial(authority)) {
    return NextResponse.json(
      {
        error: 'BROKERAGE_NOT_ALLOWED',
        reason: authority.reason,
        capabilityStatus: authority.status,
      } as const,
      { status: 403 },
    );
  }

  const body: unknown = await request.json().catch(() => null);

  const id = ownerPropertyIdFromRequest((body as { id?: unknown } | null)?.id);
  if (id === null) return respondToMalformed(['id']);

  const parsedDraft = ownerPropertyDraftFromRequest(body);
  if (!parsedDraft.ok) return respondToMalformed(parsedDraft.malformed);

  const parsedMandate = brokeredMandateFromRequest(
    (body as { mandate?: unknown } | null)?.mandate,
  );
  if (!parsedMandate.ok) return respondToMalformed(parsedMandate.malformed);

  // ⚠️ Η επωνυμία διαβάζεται **εδώ** και περνιέται· η υπηρεσία δεν ξέρει από εταιρείες.
  // Ένα `null` σημαίνει «δεν βρέθηκε» και **δεν** ακυρώνει την καταχώρηση — αλλά το
  // μήνυμα προς τον ιδιοκτήτη θα ήταν ανώνυμο, οπότε λέγεται κενό και όχι μπαλαντέρ.
  const agencyName = (await readCompanyPublicName(adminDb, ctx.companyId)) ?? '';

  const result = await createBrokeredListing(
    adminDb,
    // 🔴 **Η ΑΠΟΔΕΙΞΗ, ΟΧΙ Η ΤΑΥΤΟΤΗΤΑ.** Το `authorCompanyId` δεν περνιέται πια:
    //    ο γραφέας το διαβάζει **από την απόδειξη**, άρα είναι αδύνατο να κριθεί ο
    //    ένας οργανισμός και να γραφτεί ο άλλος.
    authority,
    {
      id,
      authorUserId: ctx.uid,
      agencyName,
    },
    parsedDraft.draft,
    {
      clientContactId: parsedMandate.mandate.clientContactId,
      expiresAt: parsedMandate.mandate.expiresAt,
      proof:
        parsedMandate.mandate.via === AGENCY_ATTESTATION
          ? agencyAttestation(ctx.uid, parsedMandate.mandate.documentPath)
          : OWNER_CONSENT_PROOF,
    },
  );

  const response = respondToWrite(result.write);
  if (result.write.kind !== 'saved') return response;

  return NextResponse.json({
    property: result.write.property,
    publish: result.write.publish,
    notify: result.notify,
  });
}

export const POST = withStandardRateLimit(withAuth(handler));

// =============================================================================
// Ο ΚΑΤΑΛΟΓΟΣ — η άλλη μισή πόρτα (ADR-777 §8.34)
// =============================================================================

/**
 * **Τι έχει στα χέρια του το γραφείο.**
 *
 * 🔑 **ΙΔΙΑ ΔΙΑΔΡΟΜΗ, ΑΛΛΟ ΡΗΜΑ — και δεν είναι οικονομία αρχείων.** Το
 * `/api/owner-properties/brokered` **είναι** «οι εντολές αυτού του γραφείου»: το
 * `POST` γεννά μία, το `GET` τις απαριθμεί. Μια ξεχωριστή διεύθυνση θα σήμαινε δύο
 * τόποι που πρέπει να συμφωνούν για το **ποιος** είναι το γραφείο — και η απάντηση
 * ζει ήδη σε **μία** γραμμή, εδώ: `ctx.companyId`.
 *
 * ⚠️ **Καμία παράμετρος από το δίκτυο δεν αγγίζει την εμβέλεια.** Δεν υπάρχει
 * `?companyId=`, δεν υπάρχει φίλτρο κατάστασης στο ερώτημα: η **κατάσταση είναι
 * υπολογισμένη** (`mandateStandingOf`), άρα ένα φίλτρο διακομιστή θα ήταν δεύτερος
 * ταξινομητής που θα απέκλινε από τον πρώτο. Η οθόνη φιλτράρει ό,τι ήδη κρίθηκε.
 *
 * ⚠️ **Ένα ρολόι για όλες τις γραμμές** — δες `mandateStandingOf`.
 */
async function catalogHandler(
  _request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<MandateCatalog | { error: string }>> {
  const catalog = await readMandateCatalog(getAdminFirestore(), ctx.companyId, nowISO());
  return NextResponse.json(catalog);
}

export const GET = withStandardRateLimit(withAuth(catalogHandler));
