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
 * `withAuth` απαιτεί συνδεδεμένο χρήστη, και το `authorUserId` **δεν έρχεται από το
 * σώμα** — γράφεται από το `ctx.uid`. Ό,τι δεν είναι στο σχήμα δεν μπορεί να σταλεί.
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

import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
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
  ctx: AuthContext,
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
      { id, authorUserId: ctx.uid, authorCompanyId: null, mandate: { kind: 'self' } },
      parsed.draft,
    ),
  );
}

export const POST = withStandardRateLimit(withAuth(handler));
