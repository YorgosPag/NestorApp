/**
 * @fileoverview **Η ΔΕΥΤΕΡΗ ΠΡΑΞΗ — «ΘΕΛΩ ΝΑ ΜΕ ΒΡΙΣΚΟΥΝ»** (ADR-827 §9.10 · #12).
 * @related services/mandate/agency-profile.service.ts · lib/auth/brokerage-gate.ts
 * @module app/api/agency-profile/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΔΙΑΔΡΟΜΗ ΓΙΑ ΤΗ ΓΡΑΦΗ, ΕΝΩ Η ΑΝΑΓΝΩΣΗ ΕΙΝΑΙ ΔΗΜΟΣΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κατάλογος διαβάζεται **απευθείας** από τον φυλλομετρητή *(`agency_profiles`:
 * `read: if true`)* — αυτό είναι όλο το §9.5: *«η απομόνωση επιτυγχάνεται με **ΤΟ ΤΙ
 * ΓΡΑΦΕΤΑΙ**»*. Άρα **δεν** υπάρχει `GET` εδώ, και δεν πρέπει να υπάρξει: θα ήταν
 * φίλτρο που κάποιος πρέπει να θυμάται, εκεί που η γραφή είναι ήδη ο φρουρός.
 *
 * Η **γραφή** είναι `write: false` στους κανόνες ⇒ περνά **υποχρεωτικά** από εδώ.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴🔴 ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΓΕΝΝΗΣΕ ΤΗΝ ΕΠΑΛΗΘΕΥΣΗ ΨΕΥΔΩΝΥΜΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ψευδώνυμο **δεν μπορεί** να παραχθεί στον διακομιστή: η αντίστροφη αναζήτηση
 * `companyId → ψευδώνυμο` θα ήταν **σάρωση**, δηλαδή απαρίθμηση γραφείων — και το
 * `alias-registry.ts` το δηλώνει ρητά *(γι' αυτό το `canonicalAlias` επιστρέφει
 * `null`)*. Άρα το **δηλώνει ο πελάτης**: το ξέρει ήδη, είναι στη διεύθυνση που
 * βλέπει.
 *
 * ⚠️ **Και ακριβώς γι' αυτό ΟΦΕΙΛΕΙ να επαληθευτεί.** Χωρίς έλεγχο, το γραφείο **Α**
 * δημοσιεύει με `alias` του γραφείου **Β**: το έγγραφο γράφεται σωστά στο
 * `agency_profiles/Α` *(το κλειδί έρχεται από την **απόδειξη**, όχι από το σώμα)*,
 * αλλά η **κάρτα του Α στον κατάλογο θα έδειχνε στον χώρο του Β**. Δεν είναι διαρροή —
 * είναι **παραπλάνηση**, και θα φαινόταν σωστή από κάθε πλευρά.
 *
 * 🔑 Η επαλήθευση είναι **μία σημειακή ανάγνωση κατά κλειδί** (`resolveAlias`) —
 * ακριβώς η πράξη που το `tenant-config.ts` επιτρέπει ρητά. Καμία σάρωση.
 *
 * ⚠️ **`not-found` και «ξένο» απαντούν ΤΑΥΤΟΣΗΜΑ** *(«δεν είναι η διεύθυνσή σου»)*,
 * ενώ η **βλάβη** απαντά **503** — *άγνωστο ≠ κενό* (N.12): ένα 422 σε βλάβη θα
 * έλεγε στο γραφείο ότι **η διεύθυνσή του δεν του ανήκει**.
 *
 * 🔒 `withAuth` *(απαιτεί οργανισμό)* + `gateBrokerage` *(απαιτεί **ενεργή** μεσιτική
 * ικανότητα)* + standard rate limit.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { gateBrokerage, type BrokerageDeniedResponse } from '@/lib/auth/brokerage-gate';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { placeRefSchema } from '@/lib/geo/place-ref-schema';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { resolveAlias } from '@/lib/workspace/alias-registry';
import {
  publishAgencyProfile,
  withdrawAgencyProfile,
  type AgencyProfileRejection,
} from '@/services/mandate/agency-profile.service';
import type { AgencyProfile } from '@/types/agency-profile';

/**
 * **Ό,τι δηλώνει το γραφείο** — και **μόνο** αυτό.
 *
 * 🔴 **ΚΑΝΕΝΑ `min(1)` ΣΤΑ ΠΕΔΙΑ ΠΕΡΙΕΧΟΜΕΝΟΥ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ.** Το *«λείπει η
 * επωνυμία»* το απαντά ο **γραφέας** *(`AGENCY_PROFILE_REJECTIONS` — με **όνομα** ανά
 * πεδίο, που γίνεται κλειδί i18n)*. Ένα `min(1)` εδώ θα το απαντούσε **πρώτο**, ως
 * `MALFORMED_BODY`, και θα έκανε τους ονομαστικούς λόγους **ανεκτέλεστους**: κάλυψη σε
 * **νεκρό** κλάδο δεν είναι κάλυψη, και ο άνθρωπος θα έβλεπε *«κακό σώμα»* αντί για
 * *«γράψε την επωνυμία»*. **Ένας κριτής ανά ερώτημα** (ADR-749).
 *
 * ⚠️ Τα `max` **μένουν**: είναι **μορφή**, όχι κρίση περιεχομένου — φρουρός πόρου, που
 * είναι δουλειά του συνόρου.
 */
const publishSchema = z.object({
  alias: z.string().max(128),
  displayName: z.string().max(200),
  gemiNumber: z.string().max(64),
  // ⚠️ `.optional()` **και** `.nullable()`: η οθόνη που δεν δήλωσε τόπο δεν στέλνει
  //    το πεδίο καθόλου, και το `null` είναι η **ρητή** «καμία περιοχή».
  place: placeRefSchema.nullable().optional(),
});

type AgencyProfileWriteResponse =
  | { readonly profile: AgencyProfile }
  | { readonly withdrawn: true }
  | { readonly error: 'INVALID_PROFILE'; readonly reason: AgencyProfileRejection }
  /** Το ψευδώνυμο δεν λύνεται σε **αυτόν** τον οργανισμό — ή δεν λύνεται καθόλου. */
  | { readonly error: 'ALIAS_NOT_OWNED' }
  /** 🔴 **Δεν μάθαμε** — ποτέ ίδιο με το παραπάνω. */
  | { readonly error: 'ALIAS_UNVERIFIED' }
  | BrokerageDeniedResponse
  | { readonly error: 'WRITE_FAILED' };

/**
 * **Είναι αυτή η διεύθυνση δική σου;** — `null` όταν ναι, αλλιώς η έτοιμη απάντηση.
 *
 * ⚠️ Ο έλεγχος είναι **ισότητα με το `companyId` ΤΗΣ ΑΠΟΔΕΙΞΗΣ**, ποτέ με το σώμα:
 * το ίδιο ιδίωμα που κάνει αδύνατο να κριθεί ο ένας οργανισμός και να γραφτεί ο άλλος.
 */
async function verifyAliasOwnership(
  alias: string,
  companyId: string,
): Promise<NextResponse<AgencyProfileWriteResponse> | null> {
  const resolution = await resolveAlias(alias);

  if (resolution.outcome === 'unknown') {
    return NextResponse.json({ error: 'ALIAS_UNVERIFIED' } as const, { status: 503 });
  }

  if (resolution.outcome === 'not-found' || resolution.companyId !== companyId) {
    return NextResponse.json({ error: 'ALIAS_NOT_OWNED' } as const, { status: 422 });
  }

  return null;
}

async function publishHandler(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<AgencyProfileWriteResponse>> {
  const adminDb = getAdminFirestore();

  // 🔴 Ο φρουρός ΠΡΩΤΟΣ — πριν διαβαστεί το σώμα. Δες {@link gateBrokerage}.
  const authority = await gateBrokerage(adminDb, ctx.companyId);
  if (authority instanceof NextResponse) return authority;

  const parsed = await readJsonBody(request, publishSchema);
  if ('rejected' in parsed) return parsed.rejected;

  const denial = await verifyAliasOwnership(parsed.data.alias, authority.companyId);
  if (denial !== null) return denial;

  const result = await publishAgencyProfile(adminDb, authority, {
    alias: parsed.data.alias,
    displayName: parsed.data.displayName,
    gemiNumber: parsed.data.gemiNumber,
    place: parsed.data.place ?? null,
  });

  // ⚠️ Κλειστό σύνολο, χωρίς `default`: πέμπτη κατάσταση του γραφέα **δεν
  //    μεταγλωττίζεται** μέχρι κάποιος να πει τι σημαίνει για το δίκτυο.
  switch (result.kind) {
    case 'published':
      return NextResponse.json({ profile: result.profile });
    case 'rejected':
      return NextResponse.json(
        { error: 'INVALID_PROFILE', reason: result.reason } as const,
        { status: 422 },
      );
    case 'failed':
      return NextResponse.json({ error: 'WRITE_FAILED' } as const, { status: 500 });
    // Ο γραφέας δεν επιστρέφει ποτέ `withdrawn` σε δημοσίευση — αλλά ο τύπος το
    // επιτρέπει, και ένα σιωπηλό `default` θα το έκρυβε ως 200 με κενό σώμα.
    case 'withdrawn':
      return NextResponse.json({ error: 'WRITE_FAILED' } as const, { status: 500 });
  }
}

/**
 * **Η απόσυρση — διαγραφή, όχι σημαία** (§9.10).
 *
 * ⚠️ **Απαιτεί ΚΑΙ ΕΔΩ ενεργή ικανότητα, σε αντίθεση με το Π2.** Δεν είναι αντίφαση:
 * εκεί ο καλών είναι ο **διακομιστής** τη στιγμή που η ικανότητα χάθηκε *(και καμία
 * απόδειξη δεν μπορεί να κατασκευαστεί)*· εδώ ο καλών είναι **άνθρωπος** που ζητά
 * πράξη για τον οργανισμό του, και κάθε τέτοια πράξη περνά από τον **ίδιο** κριτή.
 * Γραφείο που **ανακλήθηκε** δεν χρειάζεται αυτή την πόρτα: το προφίλ του έχει ήδη
 * σβηστεί από το Π2.
 */
async function withdrawHandler(
  _request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<AgencyProfileWriteResponse>> {
  const adminDb = getAdminFirestore();

  const authority = await gateBrokerage(adminDb, ctx.companyId);
  if (authority instanceof NextResponse) return authority;

  const result = await withdrawAgencyProfile(adminDb, authority.companyId);

  return result.kind === 'withdrawn'
    ? NextResponse.json({ withdrawn: true } as const)
    : NextResponse.json({ error: 'WRITE_FAILED' } as const, { status: 500 });
}

export const POST = withStandardRateLimit(withAuth<AgencyProfileWriteResponse>(publishHandler));
export const DELETE = withStandardRateLimit(withAuth<AgencyProfileWriteResponse>(withdrawHandler));
