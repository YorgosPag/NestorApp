/**
 * @fileoverview **Η ΜΙΑ ΑΓΓΕΛΙΑ** — επεξεργασία και απόσυρση από τον ίδιο τον κάτοχο.
 * @related ADR-777 §7 (Α14 · Α20 · Α22) · §8.16 · app/api/owner-properties/route.ts
 * @module app/api/owner-properties/[ownerPropertyId]/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ `DELETE`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η απόσυρση είναι **κύκλος ζωής** (`lifecycle: 'withdrawn'`), όχι διαγραφή — ίδιο
 * συμβόλαιο με τη **ζήτηση** της Α9, και για τον ίδιο λόγο: *ένα σβησμένο έγγραφο δεν
 * μπορεί να αποδείξει ότι μετρήθηκε ποτέ σωστά*. Ο κάτοχος **βλέπει** ό,τι απέσυρε
 * και μπορεί να το **επαναφέρει** με την ίδια διαδρομή.
 *
 * 🔑 **Και η δημόσια εξαφάνιση ΣΥΜΒΑΙΝΕΙ ΠΡΑΓΜΑΤΙΚΑ**: η αποσυρμένη καταχώρηση
 * προβάλλεται ως «καμία ζωντανή διάθεση» ⇒ `buildPublicListing` → `null` ⇒ ο γραφέας
 * **σβήνει** το `public_listings/{id}`. Δηλαδή το «απόσυρα την αγγελία μου» είναι
 * γεγονός στον χάρτη, όχι σημαία που κάποια οθόνη οφείλει να θυμηθεί να διαβάσει.
 *
 * ⚠️ **ΕΝΑ `PATCH` για δύο πράξεις, με διακριτή ένωση στο σώμα** — και όχι δύο
 * μέθοδοι: είναι η **ίδια** πράξη *«άλλαξε αυτή την αγγελία και ξαναγράψε την προβολή
 * της»*. Δύο διαδρομές θα ήταν δύο σώματα με τη δεύτερη να ξεχνά την επανασύνθεση την
 * ημέρα που θα άλλαζε κάτι.
 */

import { NextResponse, type NextRequest } from 'next/server';

import {
  withPersonalOrOrgAuth,
  listingActorOf,
  type ApiActor,
} from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { ownerPropertyDraftFromRequest } from '@/lib/owner-property/owner-property-draft-schema';
import { isOwnerPropertyLifecycle } from '@/types/owner-property';
import { isMarketingAudience } from '@/constants/marketing-audiences';
import {
  setOwnerPropertyAudience,
  setOwnerPropertyLifecycle,
  updateOwnerProperty,
} from '@/services/owner-property/owner-property-write.service';

import {
  respondToMalformed,
  respondToPrivateMarketing,
  respondToWrite,
  type OwnerPropertyResponse,
} from '../_shared/respond';
import { accountPrivateMarketingFrom } from '@/lib/mandate/private-marketing-request-body';
import { dispatchAccountPrivateMarketing } from '../_shared/private-marketing-dispatch';

/** Τα δυναμικά τμήματα της διαδρομής, όπως τα δίνει ο App Router. */
type RouteContext = { params: Promise<{ ownerPropertyId: string }> };

/**
 * **Άλλαξε αυτή την αγγελία.**
 *
 * Το σώμα είναι **ένα από τα δύο**, και διακρίνεται από την παρουσία του `lifecycle`:
 *
 * - `{ lifecycle: 'withdrawn' | 'listed' }` → **απόσυρση / επαναφορά**
 * - οτιδήποτε άλλο → **προσχέδιο περιεχομένου**
 *
 * 🔑 **Η απόσυρση ελέγχεται ΠΡΩΤΗ**, και είναι σειρά-συμβόλαιο: το προσχέδιο περνά
 * από τα invariants, ενώ η απόσυρση **επίτηδες όχι** (δες
 * {@link setOwnerPropertyLifecycle} — *«μια πύλη που εμποδίζει τον άνθρωπο να αποσύρει
 * το ακίνητό του τον κλειδώνει έξω από την έξοδο»*). Αντίστροφη σειρά θα σήμαινε ότι
 * μια άκυρη αγγελία **δεν μπορεί να αποσυρθεί**.
 */

async function handler(
  request: NextRequest,
  actor: ApiActor,
  routeContext?: RouteContext,
): Promise<NextResponse<OwnerPropertyResponse>> {
  const params = await routeContext?.params;
  const ownerPropertyId = params?.ownerPropertyId?.trim() ?? '';
  if (ownerPropertyId === '') {
    return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 });
  }

  const body: unknown = await request.json().catch(() => null);
  const adminDb = getAdminFirestore();

  const lifecycle = (body as { lifecycle?: unknown } | null)?.lifecycle;
  if (lifecycle !== undefined) {
    if (!isOwnerPropertyLifecycle(lifecycle)) {
      return respondToMalformed(['lifecycle']);
    }
    return respondToWrite(
      await setOwnerPropertyLifecycle(adminDb, ownerPropertyId, lifecycle, listingActorOf(actor)),
    );
  }

  // ADR-864 Ε-10 — το κοινό είναι **πράξη**, όχι πεδίο του προσχεδίου των 8 (ADR-777 Α2).
  const marketingAudience = (body as { marketingAudience?: unknown } | null)?.marketingAudience;
  if (marketingAudience !== undefined) {
    if (!isMarketingAudience(marketingAudience)) {
      return respondToMalformed(['marketingAudience']);
    }
    return respondToWrite(
      await setOwnerPropertyAudience(adminDb, ownerPropertyId, marketingAudience, listingActorOf(actor)),
    );
  }

  // ADR-864 Φ3 — αίτημα · συναίνεση · έντυπο · ανάκληση: **παραλλαγή σώματος**, όχι νέα διαδρομή (CHECK 3.78).
  const privateMarketing = (body as { privateMarketing?: unknown } | null)?.privateMarketing;
  if (privateMarketing !== undefined) {
    const action = accountPrivateMarketingFrom(privateMarketing);
    if (!action.ok) return respondToMalformed(action.malformed);
    return respondToPrivateMarketing(
      await dispatchAccountPrivateMarketing(adminDb, ownerPropertyId, action.body, listingActorOf(actor)),
    );
  }

  const parsed = ownerPropertyDraftFromRequest(body);
  if (!parsed.ok) return respondToMalformed(parsed.malformed);

  return respondToWrite(
    await updateOwnerProperty(adminDb, ownerPropertyId, parsed.draft, listingActorOf(actor)),
  );
}

export const PATCH = withStandardRateLimit(
  withPersonalOrOrgAuth<OwnerPropertyResponse, RouteContext>(handler),
);
