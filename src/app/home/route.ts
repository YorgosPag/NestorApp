/**
 * **`/home` — «πήγαινέ με εκεί που ανήκω».** Ο διακομιστής αποφασίζει, πάντα.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΛΥΝΕΙ (ADR-819 §8)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η σελίδα 404 πρόσφερε **«Επιστροφή στη σύνδεση»** σε άνθρωπο **ήδη
 * συνδεδεμένο** — μετρημένο στην οθόνη 2026-08-26, με το κέλυφός του γύρω-γύρω.
 * Το μόνο κουμπί οδηγούσε σε πράξη που είχε ήδη κάνει.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ROUTE HANDLER ΚΑΙ ΟΧΙ ΑΝΑΓΝΩΣΗ ΤΑΥΤΟΤΗΤΑΣ ΜΕΣΑ ΣΤΟ `not-found.tsx`
 * ─────────────────────────────────────────────────────────────────────────────
 * Η προφανής υλοποίηση θα ήταν να γίνει το `app/not-found.tsx` server component
 * που διαβάζει το cookie. **Δύο ανεξάρτητοι λόγοι το απαγορεύουν:**
 *
 * 1. **Προαποδοσιμότητα** (CHECK 3.55): το ριζικό `not-found` είναι το όριο που
 *    ο Next παράγει **στατικά** στο `next build` για κάθε διεύθυνση χωρίς
 *    αντιστοιχία. Ανάγνωση `cookies()` εκεί είναι δυναμική χρήση σε στατική
 *    διαδρομή — ακριβώς το σχήμα που φυλάει η πύλη. Ένα route handler είναι
 *    **εξ ορισμού** δυναμικό: το ερώτημα δεν τίθεται καν.
 * 2. **Ένα σημείο, όχι ένα ανά όριο**: τα 404 γεννιούνται από **πολλά** όρια
 *    *(ρίζα, κέλυφος, `o/[workspace]`)*. Ο σύνδεσμος `/home` απαντά για **όλα**.
 *
 * ⛔ **ΜΗΝ το κάνεις σελίδα (`page.tsx`)**: δεν έχει τίποτα να δείξει, και μια
 *    σελίδα που μόνο ανακατευθύνει πληρώνει ολόκληρο render κελύφους πριν φύγει.
 *
 * ⚠️ **ΤΟ `home` ΕΙΝΑΙ ΔΗΛΩΜΕΝΟ ΕΚΤΟΣ ΕΜΒΕΛΕΙΑΣ ΧΩΡΟΥ** (`workspace-scope.ts`),
 *    και **δεν** είναι διακοσμητικό: το `not-found.tsx` χρησιμοποιεί το
 *    **workspace-aware** `Link` του συνόρου. Χωρίς τη δήλωση, ένα 404 μέσα σε
 *    χώρο θα παρήγαγε `/o/<ψευδώνυμο>/home` — διεύθυνση **χωρίς σελίδα**, δηλαδή
 *    το κουμπί εξόδου από το 404 θα οδηγούσε σε **νέο 404**.
 *
 * @module app/home/route
 */

import { NextResponse, type NextRequest } from 'next/server';

import { readPageIdentity } from '@/server/auth/page-identity';
import { AUTH_ROUTES } from '@/lib/routes';
import { workspaceHomeHref } from '@/lib/workspace/workspace-home';
import { type WorkspaceOwner } from '@/lib/workspace/workspace-segment';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('home-redirect');

export async function GET(request: NextRequest): Promise<NextResponse> {
  const identity = await readPageIdentity();

  // ⚠️ **Ο ανώνυμος ΔΕΝ είναι σφάλμα εδώ.** Το `/home` το πατά και ο επισκέπτης
  //    που έπεσε σε 404 χωρίς ποτέ να συνδεθεί — για εκείνον η σύνδεση **είναι**
  //    ο σωστός προορισμός. Το ίδιο κουμπί, δύο σωστές απαντήσεις.
  if (!identity.ok) {
    return NextResponse.redirect(new URL(AUTH_ROUTES.login, request.url));
  }

  const owner: WorkspaceOwner =
    identity.scope === 'organization'
      ? { kind: 'organization', companyId: identity.ctx.companyId }
      : { kind: 'personal' };

  const href = await workspaceHomeHref(owner);

  // ⚠️ `null` ⇒ ο χώρος **δεν έχει διεύθυνση** (ADR-819 §4.1 κανόνας 4). Στέλνουμε
  //    στη σύνδεση — δεν **κατασκευάζουμε** διεύθυνση για να έχουμε κάτι να πούμε.
  //    Η αιτία μένει ακέραιη στα ίχνη· ο άνθρωπος δεν μένει σε αδιέξοδο.
  if (href === null) {
    logger.error('[HOME] Ο χώρος δεν έχει διεύθυνση — έξοδος προς τη σύνδεση', {
      uid: identity.ctx.uid,
    });
    return NextResponse.redirect(new URL(AUTH_ROUTES.login, request.url));
  }

  // ⚠️ **307, ποτέ 308** — ίδιος λόγος με το δίχτυ `(app)/[...unprefixed]`: ο
  //    προορισμός **εξαρτάται από το ποιος ρωτά**. Ένα 308 είναι cacheable ⇒ ο
  //    φυλλομετρητής θα κλείδωνε `/home → <ο χώρος του Α>` και θα το σέρβιρε στον Β.
  return NextResponse.redirect(new URL(href, request.url), 307);
}
