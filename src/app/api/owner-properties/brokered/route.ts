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
type BrokeredResponse = OwnerPropertyResponse & { readonly notify?: NotifyOutcome };

async function handler(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<BrokeredResponse>> {
  const body: unknown = await request.json().catch(() => null);

  const id = ownerPropertyIdFromRequest((body as { id?: unknown } | null)?.id);
  if (id === null) return respondToMalformed(['id']);

  const parsedDraft = ownerPropertyDraftFromRequest(body);
  if (!parsedDraft.ok) return respondToMalformed(parsedDraft.malformed);

  const parsedMandate = brokeredMandateFromRequest(
    (body as { mandate?: unknown } | null)?.mandate,
  );
  if (!parsedMandate.ok) return respondToMalformed(parsedMandate.malformed);

  const adminDb = getAdminFirestore();

  // ⚠️ Η επωνυμία διαβάζεται **εδώ** και περνιέται· η υπηρεσία δεν ξέρει από εταιρείες.
  // Ένα `null` σημαίνει «δεν βρέθηκε» και **δεν** ακυρώνει την καταχώρηση — αλλά το
  // μήνυμα προς τον ιδιοκτήτη θα ήταν ανώνυμο, οπότε λέγεται κενό και όχι μπαλαντέρ.
  const agencyName = (await readCompanyPublicName(adminDb, ctx.companyId)) ?? '';

  const result = await createBrokeredListing(
    adminDb,
    {
      id,
      authorUserId: ctx.uid,
      authorCompanyId: ctx.companyId,
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
