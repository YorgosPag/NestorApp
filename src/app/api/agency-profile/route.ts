/**
 * @fileoverview **Η ΔΕΥΤΕΡΗ ΠΡΑΞΗ — «ΘΕΛΩ ΝΑ ΜΕ ΒΡΙΣΚΟΥΝ»** (ADR-827 §9.10 · #12).
 * @related services/mandate/agency-profile.service.ts · lib/auth/brokerage-gate.ts
 * @related app/api/agency-profile/showcase-request.ts — σχήμα σύρματος + οι τρεις επαληθεύσεις
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
 * 🔒 `withAuth` *(απαιτεί οργανισμό)* + `gateShowcase` *(απαιτεί **ενεργή** μεσιτική
 * ικανότητα **μόνο όταν κάποια ειδικότητα είναι ρυθμιζόμενη**)* + standard rate limit.
 * ⚠️ Το `DELETE` **δεν** έχει φρουρό ικανότητας — δες τον χειριστή του.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { readJsonBody } from '@/lib/api/json-body';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { gateShowcase } from '@/lib/auth/brokerage-gate';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { showcaseOwnerId } from '@/lib/auth/brokerage-authority';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  publishShowcase,
  withdrawAgencyProfile,
  type ShowcaseCredentialDeclaration,
} from '@/services/mandate/agency-profile.service';
import {
  classifyDeclared,
  locate,
  publishSchema,
  verifyAliasOwnership,
  type AgencyProfileWriteResponse,
} from './showcase-request';

/**
 * ⚠️ **Η ΣΕΙΡΑ ΑΛΛΑΞΕ ΣΤΗ Φ6-Β3, ΚΑΙ ΕΙΝΑΙ ΑΝΑΓΚΗ ΟΧΙ ΑΜΕΛΕΙΑ.** Ο φρουρός δεν
 * μπορεί πια να τρέξει **πριν** το σώμα: το αν χρειάζεται μεσιτική ικανότητα το
 * απαντά **η ειδικότητα που δηλώνεται**. Ο λόγος της παλιάς σειράς — *«δεν λέμε
 * σε κάποιον που δεν επιτρέπεται καν αν το JSON του ήταν έγκυρο»* — **έπαψε να
 * υπάρχει**: κάθε μέλος οργανισμού επιτρέπεται σε **κάτι**. Δες {@link gateShowcase}.
 */
async function publishHandler(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<AgencyProfileWriteResponse>> {
  const adminDb = getAdminFirestore();

  const parsed = await readJsonBody(request, publishSchema);
  if ('rejected' in parsed) return parsed.rejected;

  const classified = await classifyDeclared(adminDb, parsed.data.credentials);
  if ('rejected' in classified) return classified.rejected;

  // 🔴 Ο φρουρός ρωτά **το επάγγελμα**, και παράγει την παραλλαγή της απόδειξης.
  const authority = await gateShowcase(adminDb, ctx.companyId, classified.occupations);
  if (authority instanceof NextResponse) return authority;

  const denial = await verifyAliasOwnership(parsed.data.alias, showcaseOwnerId(authority));
  if (denial !== null) return denial;

  // 🔑 Το `iscoCode` και οι ετικέτες έρχονται **από την ταξινομία**· από το σώμα
  //    μόνο ο αριθμός και ο εκδότης — τα δύο που **μόνο ο άνθρωπος** ξέρει.
  const credentials: ShowcaseCredentialDeclaration[] = classified.occupations.map(
    (occupation, index) => ({
      occupation,
      registrationNumber: parsed.data.credentials[index]?.registrationNumber ?? '',
      registrationChapter: parsed.data.credentials[index]?.registrationChapter ?? '',
    }),
  );

  const place = parsed.data.place ?? null;
  const located = await locate(adminDb, place);
  if ('rejected' in located) return located.rejected;

  const result = await publishShowcase(adminDb, authority, {
    alias: parsed.data.alias,
    displayName: parsed.data.displayName,
    credentials,
    place,
    position: located.position,
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
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΧΑΣΕ ΤΟΝ ΦΡΟΥΡΟ ΙΚΑΝΟΤΗΤΑΣ ΣΤΗ Φ6-Β3 — ΚΑΙ ΕΙΝΑΙ ΔΙΟΡΘΩΣΗ ΒΛΑΒΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι σήμερα το `DELETE` απαιτούσε **ενεργή μεσιτική ικανότητα**, με σχόλιο που
 * δήλωνε ρητά την αμηχανία του: *«γραφείο που ανακλήθηκε δεν χρειάζεται αυτή την
 * πόρτα — το προφίλ του έχει ήδη σβηστεί από το Π2»*. Δύο λόγοι που το
 * κατέρριψαν:
 *
 * 1. 🔴 **Ο ελαιοχρωματιστής δεν είχε ΠΟΤΕ ικανότητα** ⇒ δεν μπορούσε να
 *    αποσύρει τη βιτρίνα που μόλις δημοσίευσε. **Φρουρός που κάνει τη θεραπεία
 *    αδύνατη** — ακριβώς το σχήμα που το `provisionWorkspace` ονομάζει
 *    *(ADR-787 §5.1)* και που το ίδιο το `withdrawAgencyProfile` απορρίπτει για
 *    τον εαυτό του.
 * 2. Το Π2 σβήνει πλέον **μόνο ρυθμιζόμενη** βιτρίνα, άρα η υπόθεση *«έχει ήδη
 *    σβηστεί»* **έπαψε να ισχύει** και για τον ανακληθέντα μεσίτη που κρατά
 *    δεύτερη, μη ρυθμιζόμενη ειδικότητα.
 *
 * ⚠️ **Και δεν ανοίγει τίποτα**: το κλειδί διαγραφής είναι το `ctx.companyId`
 * **από τα claims**, ποτέ από το σώμα ⇒ ξένη βιτρίνα παραμένει **μη
 * εκφράσιμη**. Ο `withAuth` εγγυάται ότι ο καλών ανήκει σε αυτόν τον οργανισμό —
 * και η απόσυρση της **δικής σου** προβολής δεν είναι ρυθμιζόμενη πράξη· είναι
 * ανάκληση συγκατάθεσης.
 */
async function withdrawHandler(
  _request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<AgencyProfileWriteResponse>> {
  const result = await withdrawAgencyProfile(getAdminFirestore(), ctx.companyId);

  return result.kind === 'withdrawn'
    ? NextResponse.json({ withdrawn: true } as const)
    : NextResponse.json({ error: 'WRITE_FAILED' } as const, { status: 500 });
}

export const POST = withStandardRateLimit(withAuth<AgencyProfileWriteResponse>(publishHandler));
export const DELETE = withStandardRateLimit(withAuth<AgencyProfileWriteResponse>(withdrawHandler));
