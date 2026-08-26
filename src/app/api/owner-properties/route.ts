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
 * ⚠️ **Δηλωμένο όριο**: σε `NODE_ENV=development` το `auth-context.ts:283` δίνει
 * `dev-user` σε κάθε κλήση χωρίς credentials. Είναι **προϋπάρχον** και πετά σε
 * παραγωγή — δεν «διορθώνεται» εδώ, αλλά **δεν** θεωρείται απόδειξη auth σε καμία
 * τοπική επαλήθευση.
 */

import { NextResponse, type NextRequest } from 'next/server';

import {
  withPersonalOrOrgAuth,
  type ApiActor,
} from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  ownerPropertyDraftFromRequest,
  ownerPropertyIdFromRequest,
} from '@/lib/owner-property/owner-property-draft-schema';
import { createOwnerProperty } from '@/services/owner-property/owner-property-write.service';

import {
  respondToMalformed,
  respondToWrite,
  type OwnerPropertyResponse,
} from './_shared/respond';

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
  // ⚠️ `json()` πετά σε κατεστραμμένο σώμα — και ένα ακάλυπτο `throw` εδώ θα γινόταν
  // **500**, δηλαδή «δικό μας λάθος» για κάτι που έστειλε ο πελάτης.
  const body: unknown = await request.json().catch(() => null);

  // 🔴 Η ταυτότητα κρίνεται **πριν** το προσχέδιο, και είναι σειρά-συμβόλαιο: ένα
  // έγκυρο προσχέδιο με **άκυρη** ταυτότητα δεν έχει πού να γραφτεί, οπότε το να
  // κριθεί πρώτο το περιεχόμενο θα ανέφερε λάθος πεδίο στον άνθρωπο.
  const id = ownerPropertyIdFromRequest((body as { id?: unknown } | null)?.id);
  if (id === null) return respondToMalformed(['id']);

  const parsed = ownerPropertyDraftFromRequest(body);
  if (!parsed.ok) return respondToMalformed(parsed.malformed);

  return respondToWrite(
    await createOwnerProperty(
      getAdminFirestore(),
      // ⚠️ `actor.ctx.uid` **χωρίς διάκριση χώρου**, και είναι σωστό: το `uid` υπάρχει
      // και στα δύο μέλη της ένωσης. Μια διάκριση εδώ θα ήταν φρουρός χωρίς
      // ετυμηγορία — και τα δύο σκέλη θα έγραφαν την ίδια γραμμή.
      { id, authorUserId: actor.ctx.uid, authorCompanyId: null, mandate: { kind: 'self' } },
      parsed.draft,
    ),
  );
}

export const POST = withStandardRateLimit(withPersonalOrOrgAuth(handler));
