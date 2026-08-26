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
  actorWorkspace,
  type ApiActor,
} from '@/lib/auth/personal-scope-middleware';
import type { ListingActor } from '@/lib/owner-property/listing-custody';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { ownerPropertyDraftFromRequest } from '@/lib/owner-property/owner-property-draft-schema';
import { isOwnerPropertyLifecycle } from '@/types/owner-property';
import {
  setOwnerPropertyLifecycle,
  updateOwnerProperty,
} from '@/services/owner-property/owner-property-write.service';

import {
  respondToMalformed,
  respondToWrite,
  type OwnerPropertyResponse,
} from '../_shared/respond';

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
/**
 * **Ποιος ρωτά** — και **τα δύο** σκέλη της ταυτότητας, όχι μόνο το uid.
 *
 * 🔴 ADR-777 §8.39: το `companyId` υπήρχε πάντα εδώ και **δεν το ζητούσε κανείς**,
 * οπότε η διαδρομή μπορούσε να κρίνει μόνο «είναι δική σου;» — ποτέ «είναι του
 * γραφείου σου;». Η {@link mayAdminister} απαντά και τα δύο, **χωρίς** να διευρύνει τον
 * ιδιωτικό χώρο.
 *
 * 🔴 **ADR-817 — Ο ΝΕΚΡΟΣ ΚΛΑΔΟΣ ΖΩΝΤΑΝΕΨΕ.** Μέχρι τις 2026-08-26 εδώ έγραφε
 * `{ uid: ctx.uid, companyId: ctx.companyId }` με σχόλιο *«κανένα `?? null` εδώ: θα
 * ήταν νεκρός κλάδος που μοιάζει με φρουρός»* — **σωστό όσο ο πολίτης έπαιρνε 401 και
 * δεν έφτανε ποτέ**. Τώρα φτάνει, και ο τύπος-στόχος ήταν **ήδη έτοιμος**: το
 * `ListingActor.companyId` δηλώνεται `string | null` με αιτιολογία *«γιατί ο ιδιώτης
 * δεν έχει εταιρεία»*.
 *
 * ⚠️ Η μετάφραση γίνεται από το **ΕΝΑ** `actorWorkspace` — ποτέ με `?? null` εδώ:
 * κενή/απούσα εταιρεία **δεν ταιριάζει με τίποτα** στο `mayAdminister` (`hasTenant`),
 * και δεύτερη μετάφραση θα ήταν δεύτερη ερμηνεία του «απουσία».
 */
function actorOf(actor: ApiActor): ListingActor {
  return { uid: actor.ctx.uid, companyId: actorWorkspace(actor) };
}

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
      await setOwnerPropertyLifecycle(adminDb, ownerPropertyId, lifecycle, actorOf(actor)),
    );
  }

  const parsed = ownerPropertyDraftFromRequest(body);
  if (!parsed.ok) return respondToMalformed(parsed.malformed);

  return respondToWrite(
    await updateOwnerProperty(adminDb, ownerPropertyId, parsed.draft, actorOf(actor)),
  );
}

export const PATCH = withStandardRateLimit(
  withPersonalOrOrgAuth<OwnerPropertyResponse, RouteContext>(handler),
);
