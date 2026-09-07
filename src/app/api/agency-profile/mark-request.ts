/**
 * @fileoverview **ΤΟ ΣΥΝΟΡΟ ΤΗΣ ΔΗΛΩΣΗΣ ΣΗΜΑΤΟΣ** — σχήμα σύρματος + η μία κρίση που
 *   ανήκει εδώ (ADR-841 §7 Α21, Φάση 2).
 * @related app/api/agency-profile/mark/route · lib/agency/showcase-wire ·
 *   services/mandate/showcase-mark-custody
 * @module app/api/agency-profile/mark-request
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΑΠΟ ΤΟ `showcase-request`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Είναι **άλλη πράξη**, με άλλο σώμα, άλλο σύνολο αρνήσεων και άλλο φρουρό. Το
 * `showcase-request` κουβαλά την ταξινομία, τον χάρτη και το ψευδώνυμο — **τίποτα** από
 * αυτά δεν αφορά μια εικόνα. Ένα κοινό αρχείο θα έκανε τη διαδρομή του σήματος να
 * σέρνει τον αναγνώστη ESCO για να πει *«αυτό δεν είναι λογότυπο»*.
 *
 * ⚠️ Το `declaredMark` **μετακόμισε εδώ αυτούσιο** από το `showcase-request`, όπου
 * γεννήθηκε στη Φάση 1 μαζί με το πεδίο `mark` της δήλωσης. Το πεδίο έφυγε· ο κριτής
 * ακολούθησε την **πράξη**, όχι το αρχείο.
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { isShowcaseMarkKind } from '@/lib/agency/showcase-mark-kind';
import type { ShowcaseMarkWire } from '@/lib/agency/showcase-wire';
import type { AgencyProfileRejection } from '@/services/mandate/agency-profile-verdict';
import type { ShowcaseMarkDeclaration } from '@/services/mandate/showcase-mark-publication';
import type { DeclaredShowcaseMark } from '@/types/agency-profile';

/**
 * 🔑 **`z.ZodType<ShowcaseMarkWire>` — ΤΟ ΣΧΗΜΑ ΔΕΝΕΤΑΙ ΜΕ ΤΟΝ ΤΥΠΟ**, ίδιο ιδίωμα με
 * το `publishSchema`: μια μελλοντική προσθήκη πεδίου στο σύρμα **δεν μεταγλωττίζεται**
 * εδώ, αντί να περάσει σιωπηλά ως ανώνυμο αντικείμενο.
 *
 * ⚠️ **Το σχήμα ΔΕΝ κρίνει το `kind`**, και είναι ο ίδιος κανόνας με το `min(1)` των
 * credentials: ένα `z.enum(SHOWCASE_MARK_KINDS)` θα απαντούσε `MALFORMED_BODY` σε κάτι
 * που ο **γραφέας** ξέρει να **ονομάσει**. Εδώ μόνο **μορφή** — τα `max` είναι φρουροί
 * πόρου, που είναι δουλειά του συνόρου· την κρίση την κάνει το {@link declaredMark}.
 */
export const markSchema: z.ZodType<ShowcaseMarkWire> = z.object({
  kind: z.string().max(32),
  /**
   * 🔴 **ΚΑΝΕΝΑ `url` ΕΔΩ, ΕΠΙΤΗΔΕΣ** — μόνο μονοπάτι **ιδιωτικού** κάδου: ο
   * διακομιστής κατεβάζει το πρωτότυπο ο ίδιος, ώστε ο καθαρισμός EXIF/GPS να **μην
   * μπορεί** να παρακαμφθεί από τον πελάτη. Και για το `portrait` αυτό δεν είναι
   * μορφοποίηση: η selfie κουβαλά **GPS του σπιτιού** του ανθρώπου.
   *
   * ⚠️ **Και το μονοπάτι ΔΕΝ είναι εξουσιοδότηση**: ότι ζει στον χώρο **της δικής σου**
   * εταιρείας το επαληθεύει ο `markSourceForCompany`, με ταυτότητα **από την απόδειξη**.
   */
  privateStoragePath: z.string().max(1024),
});

/** Ό,τι μπορεί να απαντήσει η διαδρομή του σήματος — **κλειστό σύνολο**. */
export type ShowcaseMarkWriteResponse =
  | { readonly mark: DeclaredShowcaseMark }
  | { readonly retracted: true }
  | { readonly error: 'INVALID_MARK'; readonly reason: AgencyProfileRejection }
  | { readonly error: 'WRITE_FAILED' };

/**
 * **Το σήμα του σύρματος στη γλώσσα του γραφέα** — ή ονομασμένη άρνηση.
 *
 * 🔑 **Ίδιο σχήμα επιστροφής με το `locate`**: `{ mark }` ή `{ rejected }`. Ένας κριτής
 * ανά ερώτημα, και η άρνηση **γεννιέται εκεί που την ξέρουν**.
 *
 * 🔴 **ΓΙΑΤΙ ΑΓΝΩΣΤΟ `kind` ΕΙΝΑΙ ΑΡΝΗΣΗ ΚΑΙ ΟΧΙ ΣΙΩΠΗΛΟ `null`.** Στη Φάση 1 το `null`
 * σήμαινε *«κανένα σήμα»* και **άδειαζε το ράφι** — ο άνθρωπος θα πατούσε «αποθήκευση»
 * και το σήμα του θα **εξαφανιζόταν χωρίς εξήγηση**.
 *
 * ⚠️ **Και τώρα που η απόσυρση είναι ρητό `DELETE`, ο λόγος ΔΥΝΑΜΩΣΕ**: η σιωπηλή
 * απόρριψη δεν έχει πια καν το άλλοθι ότι «κάτι σημαίνει». Ένα άγνωστο είδος είναι
 * **λάθος του αιτήματος**, τελεία — και δεν αξίζει ούτε ανάγνωση εγγράφου.
 */
export function declaredMark(
  wire: ShowcaseMarkWire,
):
  | { readonly mark: ShowcaseMarkDeclaration }
  | { readonly rejected: NextResponse<ShowcaseMarkWriteResponse> } {
  if (!isShowcaseMarkKind(wire.kind)) {
    return {
      rejected: NextResponse.json(
        { error: 'INVALID_MARK', reason: 'agency-profile-mark-unknown-kind' } as const,
        { status: 422 },
      ),
    };
  }

  // ⛔ **Καμία επαλήθευση κατοχής ΕΔΩ, επίτηδες.** Το *«ανήκει σε αυτόν;»* απαντιέται
  //    στον γραφέα (`markSourceForCompany`), όπου η ταυτότητα έρχεται **από την
  //    απόδειξη**. Ένας δεύτερος έλεγχος εδώ θα ήταν δεύτερος κριτής — και θα έπρεπε να
  //    διαβάσει το `companyId` από κάπου, δηλαδή θα γεννούσε δεύτερη πηγή ταυτότητας.
  return { mark: { kind: wire.kind, privateStoragePath: wire.privateStoragePath } };
}
