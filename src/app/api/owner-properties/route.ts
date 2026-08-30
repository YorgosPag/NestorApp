/**
 * @fileoverview **Η ΠΟΡΤΑ ΤΗΣ ΚΑΤΑΧΩΡΗΣΗΣ** — ο ιδιώτης βάζει το ακίνητό του στην αγορά.
 * @related ADR-777 §7 (Α14 · Α22) · §8.16 · services/owner-property/owner-property-write.service.ts
 * @module app/api/owner-properties/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΖΗΤΑ ΚΑΝΕΝΑ `permission` — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ, ΟΧΙ ΠΑΡΑΛΕΙΨΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η αδελφή της διαδρομή (`/api/properties/create`) απαιτεί
 * `permissions: 'properties:properties:create'`. Εδώ **δεν** μπαίνει κανένα, και ο
 * λόγος είναι δομικός: τα δικαιώματα του έργου είναι **εμβέλειας εταιρείας**
 * (`lib/auth/roles.ts`, 10 ρόλοι μέσα σε μισθωτή) — και ο ιδιώτης **δεν έχει
 * εταιρεία**. Ένα permission εδώ θα ήταν φρουρός που **κανείς από το ακροατήριο της
 * Α14 δεν μπορεί να ικανοποιήσει**: η πόρτα θα ήταν κλειστή για **όλους** ακριβώς
 * όσους υπάρχει για να μπουν, και θα φαινόταν «ασφαλής».
 *
 * 🔑 **Η εξουσιοδότηση εδώ είναι η ΤΑΥΤΟΤΗΤΑ**, και επιβάλλεται δύο φορές: το
 * περιτύλιγμα απαιτεί συνδεδεμένο χρήστη, και το `authorUserId` **δεν έρχεται από το
 * σώμα** — γράφεται από το `uid` του δρώντος. Ό,τι δεν είναι στο σχήμα δεν μπορεί να
 * σταλεί.
 *
 * 🔴 **ADR-817 — `withPersonalOrOrgAuth`, ΟΧΙ `withAuth`.** Μέχρι τις 2026-08-26 αυτή
 * η πόρτα ήταν **κλειστή ακριβώς για το ακροατήριό της**: το `withAuth` απαιτεί
 * `AuthContext`, που **εγγυάται** μισθωτή, και ο ιδιώτης δεν έχει. Η αγγελία γράφεται
 * **μόνο** από Admin SDK (`firestore.rules`: `allow create: if false`), άρα το `401`
 * ήταν **απόλυτος** φραγμός — χωρίς παρακαμπτήριο από τον πελάτη.
 *
 * ⚠️ Γράφει **πάντα** `authorCompanyId: null`, δηλαδή **προσωπική θεματοφυλακή**
 * (`lib/owner-property/listing-custody.ts`) — **και για τον υπάλληλο γραφείου που
 * καταχωρεί το δικό του σπίτι**. Αυτό είναι το σημείο: ο ιδιωτικός χώρος **δεν
 * διευρύνεται ποτέ**, ούτε προς τα πάνω.
 *
 * ⚠️ **ΑΥΤΗ Η ΠΟΡΤΑ ΓΡΑΦΕΙ ΜΟΝΟ `mandate: 'self'`, ΚΑΙ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ (§8.33).** Ο
 * μεσίτης έχει **δική του** διαδρομή, γιατί έχει **δικά του** πράγματα να αποδείξει:
 * ποιος είναι ο πελάτης, πώς πάρθηκε η εντολή, μέχρι πότε ισχύει. Ένα προαιρετικό
 * `mandate` στο σώμα **εδώ** θα σήμαινε ότι κάθε συνδεδεμένος χρήστης μπορεί να
 * δηλώσει ότι ενεργεί για λογαριασμό τρίτου — δηλαδή η έγκριση θα ήταν **πεδίο που
 * στέλνει ο αιτών**, που είναι το αντίθετο του φρουρού.
 *
 * ⚠️ **Δηλωμένο όριο** *(ενημερώθηκε 2026-08-27, ADR-821)*: η `buildApiIdentity`
 * *(`lib/auth/auth-context.ts`)* μπορεί να **κατασκευάσει** ταυτότητα `dev-user`
 * όταν λείπει κάθε πιστοποιητικό. Πλέον **δεν** το αποφασίζει μόνη της: ρωτά τον
 * `decideIdentityFabrication` — και η κατασκευή **σβήνει** μόλις τρέξει ο Auth
 * Emulator, δηλαδή **ακριβώς στο περιβάλλον της ζωντανής επαλήθευσης**. Παραμένει
 * κανόνας ότι **δεν** θεωρείται απόδειξη auth σε καμία τοπική μέτρηση.
 *
 * ⚠️ **Ο δείκτης είναι ΟΝΟΜΑ, όχι αριθμός γραμμής, επίτηδες**: αυτή η παράγραφος
 * έγραφε `auth-context.ts:283` ενώ ο κλάδος είχε μετακινηθεί στην **336** από το
 * ADR-817. Ένας αριθμός γραμμής παλιώνει σιωπηλά (μάθημα CHECK 3.49 / N.12).
 */

import { NextResponse, type NextRequest } from 'next/server';

import {
  withPersonalOrOrgAuth,
  type ApiActor,
} from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createOwnerProperty } from '@/services/owner-property/owner-property-write.service';

import {
  respondToMalformed,
  respondToWrite,
  type OwnerPropertyResponse,
} from './_shared/respond';
import { readOwnerPropertyDraftRequest } from './_shared/read-draft-request';

/**
 * **Νέα αγγελία ιδιοκτήτη** — και **δημοσίευση στην ίδια πράξη**.
 *
 * 🔑 **Καμία ουρά έγκρισης** (απόφαση Giorgio 2026-08-11, §8.16): το φράγμα
 * ποιότητας είναι **μηχανικό** — τιμή ανά διάθεση (**Α22**) και τα υποχρεωτικά πεδία
 * του **§25.6** — και εκτελείται από το `ownerPropertyInvariantViolations`, την
 * **ίδια** συνάρτηση που τρέχει η φόρμα. Ό,τι το περνά **είναι** στην αγορά.
 */
async function handler(
  request: NextRequest,
  actor: ApiActor,
): Promise<NextResponse<OwnerPropertyResponse>> {
  // 🔑 Σώμα → ταυτότητα → προσχέδιο, με **αυτή** τη σειρά, από τη ΜΙΑ διατύπωση που
  // μοιράζεται με την πόρτα του μεσίτη (CHECK 3.28 μέτρησε το δίδυμο).
  const parsed = await readOwnerPropertyDraftRequest(request);
  if (!parsed.ok) return respondToMalformed(parsed.malformed);

  const { id } = parsed;

  return respondToWrite(
    await createOwnerProperty(
      getAdminFirestore(),
      // ⚠️ `actor.ctx.uid` **χωρίς διάκριση χώρου**, και είναι σωστό: το `uid` υπάρχει
      // και στα δύο μέλη της ένωσης. Μια διάκριση εδώ θα ήταν φρουρός χωρίς
      // ετυμηγορία — και τα δύο σκέλη θα έγραφαν την ίδια γραμμή.
      // ADR-832: κενός πίνακας = ο ιδιώτης μόνος του. Καμία εντολή, κανένα sentinel.
      { id, authorUserId: actor.ctx.uid, authorCompanyId: null, mandates: [] },
      parsed.draft,
    ),
  );
}

export const POST = withStandardRateLimit(withPersonalOrOrgAuth(handler));
