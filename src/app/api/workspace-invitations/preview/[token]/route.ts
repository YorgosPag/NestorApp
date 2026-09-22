import 'server-only';

/**
 * **GET /api/workspace-invitations/preview/[token]** — «ποιος με καλεί;» (ADR-853 Φ4 · §5 #4).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΙΝΑΙ **ΔΗΜΟΣΙΑ** — ΚΑΙ ΕΙΝΑΙ ΑΝΤΙ-PHISHING, ΟΧΙ ΕΥΚΟΛΙΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο προσκεκλημένος φτάνει από **email**, **πριν** από κάθε ταυτότητα: περνά από `/login`
 * και επιστρέφει (§6 #2). Μια διαδρομή με φρουρό θα ζητούσε από άνθρωπο να **συνδεθεί σε
 * κάτι που δεν ξέρει τι είναι** — ακριβώς η συνθήκη στην οποία δουλεύει το phishing.
 * Βλέπει **πρώτα** ποιος τον καλεί και για τι θέση, **μετά** αποφασίζει.
 *
 * ⚠️ **Η ΔΕΣΜΕΥΣΗ ΣΤΟ EMAIL ΔΕΝ ΧΑΛΑΡΩΝΕΙ**: κρίνεται στην **εξαργύρωση** (§7.5), που
 * είναι η πράξη που **γράφει**. Εδώ δεν γράφεται τίποτα πλην της τηλεμετρίας «ανοίχτηκε»,
 * και ό,τι μαθαίνει ο κρατών τον σύνδεσμο είναι **όνομα γραφείου, ρόλος, λήξη** — κανένα
 * προσωπικό δεδομένο, ούτε το email του παραλήπτη, ούτε το `companyId`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ `preview/[token]` ΚΑΙ ΟΧΙ `[token]` — ΣΦΑΛΜΑ ΜΕΤΑΓΛΩΤΤΙΣΗΣ ΠΟΥ ΑΠΟΦΕΥΧΘΗΚΕ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η αδελφή διαδρομή είναι `[invitationId]/revoke`, και το Next **αρνείται δύο διαφορετικά
 * ονόματα slug στο ίδιο επίπεδο** (*«You cannot use different slug names for the same
 * dynamic path»*) — δηλαδή ένα `[token]/` εδώ θα έριχνε το `next build`. Το **στατικό**
 * τμήμα `preview` λύνει τη σύγκρουση δομικά: στατικό και δυναμικό συνυπάρχουν.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΟ TOKEN ΕΙΝΑΙ ΣΤΗ ΔΙΕΥΘΥΝΣΗ **ΕΔΩ ΜΟΝΟ**, ΚΑΙ ΕΙΝΑΙ ΑΝΑΓΚΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η **πράξη** (`POST /redeem`) στέλνει το token σε **σώμα**, επειδή token σε URL διαρρέει
 * σε αρχεία διακομιστή, σε `Referer` προς τρίτους, σε ιστορικό και σε proxies (RFC 6819
 * §5.1.5 · OAuth 2.0 Security BCP). Εδώ **δεν υπάρχει εναλλακτική**: η διεύθυνση **είναι**
 * ο σύνδεσμος του email, και η σελίδα `(auth)/invite/[token]` τη διαβάζει πριν υπάρξει
 * ταυτότητα. Το αντιστάθμισμα είναι ότι αυτή η πόρτα **δεν καταναλώνει και δεν γράφει** —
 * δηλαδή μια διαρροή της διεύθυνσης δίνει **όψη**, ποτέ ένταξη.
 *
 * ⛔ **ΜΗΝ προσθέσεις γραμμή στο `ENDPOINT_CATEGORY_MAPPINGS`** — η δήλωση
 *    `withHeavyRateLimit` **υπερισχύει** μετά το ADR-855 Α1, οπότε η γραμμή θα ήταν νεκρή
 *    και το CHECK 3.78 Κ2 τη μετρά ως παραβίαση.
 *
 * @module api/workspace-invitations/preview/[token]
 * @see docs/centralized-systems/reference/adrs/ADR-853-workspace-invitations.md §8 Φ4
 */

import { after, NextResponse, type NextRequest } from 'next/server';

import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  previewWorkspaceInvitation,
  type InvitationPreviewOutcome,
} from '@/server/auth/workspace-invitation-preview';
import { markWorkspaceInvitationOpened } from '@/server/auth/workspace-invitation-redeem';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  WorkspaceInvitationPreview,
  WorkspaceInvitationRefusal,
} from '@/types/workspace-invitation';

const logger = createModuleLogger('WORKSPACE_INVITATION_PREVIEW');

type PreviewResponse =
  | { readonly invitation: WorkspaceInvitationPreview }
  | { readonly error: 'LINK_REFUSED'; readonly reason: WorkspaceInvitationRefusal }
  | { readonly error: 'PREVIEW_UNAVAILABLE' };

type Segment = { params: Promise<{ token: string }> };

/**
 * **Λόγος άρνησης → κωδικός HTTP**, και ο τύπος απαιτεί **κάθε** λόγο να απαντηθεί.
 *
 * 🔑 `Record<WorkspaceInvitationRefusal, number>`: μια **δέκατη** άρνηση στο λεξιλόγιο
 * **δεν μεταγλωττίζεται** μέχρι κάποιος να πει τι σημαίνει στο δίκτυο. Ένα `switch` με
 * `default: 400` θα την κατάπινε σιωπηλά.
 *
 * ⚠️ **GET, άρα ο πόρος μιλά — όχι η πράξη.** Η αδελφή πόρτα εξαργύρωσης απαντά `422` σε
 * κάθε άρνηση, και σωστά: εκεί κρίνεται **πράξη**. Εδώ ζητείται **πόρος**, οπότε το HTTP
 * έχει ακριβέστερες λέξεις — και το `410 Gone` *(«υπήρχε, δεν ισχύει πια»)* είναι το ίδιο
 * που χρησιμοποιεί η πύλη προμηθευτών για ανακληθέν/ληγμένο token.
 *
 * 🔶 **Τέσσερις λόγοι είναι ΑΦΤΑΣΤΟΙ από εδώ** — απαιτούν συνδεδεμένο άνθρωπο, που αυτή η
 * διαδρομή δεν έχει. Δηλώνονται ούτως ή άλλως: ο πίνακας είναι **πλήρης κάλυψη
 * λεξιλογίου**, όχι λίστα του τι συμβαίνει σήμερα.
 */
const STATUS_BY_REFUSAL: Readonly<Record<WorkspaceInvitationRefusal, number>> = {
  /** Το κείμενο δεν είναι σύνδεσμός μας — **σφάλμα αιτήματος**, όχι κατάσταση πόρου. */
  'link-invalid': 400,
  /**
   * RFC 9110 §15.5.20 **421 Misdirected Request** — ο σύνδεσμος εκδόθηκε για **άλλον** server (άλλο
   * περιβάλλον/κλειδί)· αυτός εδώ δεν μπορεί να απαντήσει με κύρος.
   */
  'link-foreign': 421,
  /** Έγκυρη υπογραφή, ανύπαρκτο έγγραφο: ο πόρος δεν βρίσκεται. */
  'invitation-unknown': 404,
  'expired': 410,
  'already-used': 410,
  'revoked': 410,
  // ── Άφταστα από αυτή την πόρτα (θέλουν ταυτότητα) ─────────────────────────
  'wrong-recipient': 403,
  'already-member': 409,
  'role-above-inviter': 422,
};

async function handler(
  _request: NextRequest,
  segment?: Segment,
): Promise<NextResponse<PreviewResponse>> {
  if (!segment) {
    // ⚠️ Το Next δεν έδωσε συμφραζόμενα ⇒ **δικό μας** σφάλμα, ποτέ του καλούντα (πρότυπο
    //    `open-invite.ts`: `missing_context` → 500).
    logger.error('Η διαδρομή κλήθηκε χωρίς συμφραζόμενα τμήματος');
    return NextResponse.json({ error: 'PREVIEW_UNAVAILABLE' } as const, { status: 500 });
  }

  const { token: rawToken } = await segment.params;

  let token: string;
  try {
    token = decodeURIComponent(rawToken);
  } catch {
    // 🔴 **ΕΔΩ ΞΕΠΕΡΝΑΜΕ ΤΟ ΔΙΚΟ ΜΑΣ ΠΡΟΤΥΠΟ**: το `open-invite.ts` καλεί
    //    `decodeURIComponent` **ακάλυπτο**, και ένα κακοσχηματισμένο `%` σε διεύθυνση πετά
    //    `URIError` ⇒ **500 σε σφάλμα του καλούντα**. Ένας σαρωτής που στέλνει `%zz`
    //    γεμίζει τα αρχεία σφαλμάτων με δικά μας 500 και κρύβει τα αληθινά.
    return NextResponse.json(
      { error: 'LINK_REFUSED', reason: 'link-invalid' } as const,
      { status: STATUS_BY_REFUSAL['link-invalid'] },
    );
  }

  const outcome = await previewWorkspaceInvitation({ token });

  if (outcome.kind === 'preview') {
    // 🔑 **`after()` ΚΑΙ ΟΧΙ FIRE-AND-FORGET** (Next 15, πρότυπο `vendor/quote/[token]`):
    //    η σήμανση τρέχει **μετά** την απόκριση, άρα ο άνθρωπος δεν περιμένει γραφή που
    //    δεν τον αφορά — και δεν κρέμεται promise που ο runtime μπορεί να κόψει.
    // ⚠️ Η ίδια η `markWorkspaceInvitationOpened` **ποτέ δεν πετά** και γράφει **μόνο την
    //    πρώτη φορά**, ώστε το «πότε ανοίχτηκε» να μη γίνεται «πότε ξαναφορτώθηκε».
    after(async () => {
      await markWorkspaceInvitationOpened(outcome.invitationId);
    });
    return NextResponse.json({ invitation: outcome.preview } as const, { status: 200 });
  }

  return respond(outcome);
}

/** **Έκβαση → HTTP**, κλειστό σύνολο, **χωρίς `default`** (ιδίωμα των αδελφών πορτών). */
export function respond(outcome: InvitationPreviewOutcome): NextResponse<PreviewResponse> {
  switch (outcome.kind) {
    case 'preview':
      // Χειρίζεται ο `handler` (θέλει το `after()` πρώτα). Εδώ για την **πληρότητα** του
      // switch: μια μελλοντική έκβαση δεν μεταγλωττίζεται μέχρι να αποκτήσει σημασία.
      return NextResponse.json({ invitation: outcome.preview } as const);

    case 'refused':
      // 🔑 Ο λόγος **ταξιδεύει**: «έληξε» · «ανακλήθηκε» · «δεν είναι σύνδεσμός μας»
      //    στέλνουν τον άνθρωπο σε **τρεις διαφορετικές** ενέργειες (§5 #7 — η αγορά
      //    δίνει ένα γενικό «invitation not valid»).
      return NextResponse.json(
        { error: 'LINK_REFUSED', reason: outcome.reason } as const,
        { status: STATUS_BY_REFUSAL[outcome.reason] },
      );

    case 'unavailable':
      // 🔴 **503 — «δεν μπορέσαμε να ρωτήσουμε»**, ποτέ ονομασμένη άρνηση: η αιτία είναι
      //    μυστικό που λείπει ή έγγραφο με ρόλο εκτός λεξιλογίου. **Καμία** ενέργεια του
      //    ανθρώπου δεν διορθώνει κανένα από τα δύο (N.12 · ADR-787 Ε-5 §4 #3).
      return NextResponse.json({ error: 'PREVIEW_UNAVAILABLE' } as const, { status: 503 });
  }
}

export const GET = withHeavyRateLimit<Segment>(handler);
