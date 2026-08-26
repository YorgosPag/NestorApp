import 'server-only';

/**
 * @fileoverview **Η ΠΟΡΤΑ ΤΟΥ ΠΟΛΙΤΗ** — η διαδρομή που δέχεται άνθρωπο **χωρίς οργανισμό**.
 * @related ADR-817 · ADR-807 §3.3 · ADR-787 §5.1-§5.4 · ADR-660 §5.7
 * @module lib/auth/personal-scope-middleware
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο πολίτης έμπαινε, προσγειωνόταν, **έβλεπε** τα ακίνητά του — και **δεν μπορούσε
 * να καταχωρήσει τίποτα**: κάθε μία από τις **319** διαδρομές `withAuth` απαντούσε
 * `401`, γιατί το `AuthContext` **εγγυάται** μισθωτή και ο πολίτης δεν έχει.
 *
 * Για την **αγγελία** ο φραγμός ήταν **απόλυτος**: το `firestore.rules` δίνει
 * `allow create: if false` στο `owner_properties` — **μόνο Admin SDK**. Δεν υπήρχε
 * παρακαμπτήριος από τον πελάτη, σε αντίθεση με τη **ζήτηση** (`property_demands`),
 * που ο πελάτης γράφει μόνος του και **δούλευε ήδη** (ADR-817 §2.2).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΗ ΠΟΡΤΑ ΚΑΙ ΟΧΙ ΣΗΜΑΙΑ ΣΤΟ `withAuth`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ **ΑΥΤΟ ΤΟ ΠΕΡΙΤΥΛΙΓΜΑ ΔΕΝ ΔΕΧΕΤΑΙ `permissions` — ΚΑΙ ΕΙΝΑΙ ΤΟ ΚΕΝΤΡΟ ΤΗΣ
 * ΕΠΙΛΟΓΗΣ.** Τα permissions είναι **εμβέλειας εταιρείας** κατά δήλωση του ίδιου του
 * PDP (`lib/auth/permissions.ts`: *«η παραχώρηση ζει δίπλα στο `companyId` και δεν
 * κουβαλά δική της εμβέλεια»*). Αν αυτή ήταν σημαία του `withAuth`, κάποιος θα
 * μπορούσε να γράψει `{ workspace: 'any', permissions: 'properties:properties:create' }`
 * — δηλαδή **φρουρό που το ακροατήριο της πόρτας δεν μπορεί να ικανοποιήσει**, με την
 * πόρτα κλειστή για **όλους** ακριβώς όσους υπάρχει για να μπουν, και να **φαίνεται
 * ασφαλής**. Είναι η βλάβη που η κεφαλίδα του `app/api/owner-properties/route.ts`
 * υπάρχει για να αποτρέψει. Με ξεχωριστό τύπο επιλογών η σύνταξη είναι **μη
 * εκφράσιμη**, όχι απλώς αποθαρρυμένη.
 *
 * 🔑 **ΜΙΑ ΜΗΧΑΝΗ, ΔΥΟ ΠΟΡΤΕΣ**: και οι δύο ρωτούν το **ίδιο** `buildApiIdentity` και
 * αρνούνται με το **ίδιο** `api-denial`. Διαφέρουν **μόνο** σε τι παραδίδουν στον
 * handler και τι επιτρέπουν να ζητηθεί.
 *
 * ⛔ **ΤΟ ΣΥΝΟΛΟ ΤΩΝ ΚΑΤΑΝΑΛΩΤΩΝ ΕΙΝΑΙ ΚΛΕΙΣΤΟ** (ADR-817 §5). Νέα διαδρομή —
 * **ακόμα και σωστή** — μπλοκάρει στην άγκυρα
 * `lib/auth/__tests__/personal-scope-consumers.test.ts`, ώστε να τη δει άνθρωπος.
 * Ένα κλειστό σύνολο που εγκρίνει σιωπηλά τις σωστές πράξεις δεν θα έβλεπε ποτέ τη
 * **δεύτερη** σωστή πράξη να γίνεται **τρίτη**.
 */

import type { NextRequest, NextResponse } from 'next/server';

import { buildApiIdentity } from './auth-context';
import { createUnauthorizedResponse, type ErrorResponse } from './api-denial';
import type { AuthContext, PersonalIdentityContext } from './types';

/**
 * **Ο δρων, ΚΑΙ Ο ΧΩΡΟΣ ΤΟΥ** — διακριτή ένωση, ποτέ σκέτο `AuthContext`.
 *
 * 🔑 **Ο ΜΕΤΑΓΛΩΤΤΙΣΤΗΣ ΕΙΝΑΙ Ο ΦΡΟΥΡΟΣ.** Το `actor.ctx.companyId` **δεν
 * μεταγλωττίζεται** χωρίς διάκριση: η ιδιότητα **δεν υπάρχει** στο μέλος `personal`.
 * Άρα ο προσωπικός χώρος **δεν μπορεί δομικά** να περάσει εκεί όπου απαιτείται
 * μισθωτής — ανά **έκφραση**, όχι ανά αρχείο, και χωρίς καμία πύλη να χρειάζεται να
 * το θυμάται.
 *
 * ⚠️ **Διακριτή ένωση και όχι `companyId: string | null`**: το δεύτερο θα επέτρεπε
 * στον handler να γράψει `ctx.companyId` και να πάρει `null` **σιωπηλά** — δηλαδή θα
 * μετέθετε την αστοχία από τη μεταγλώττιση στο ερώτημα Firestore, όπου γίνεται
 * «κενός μισθωτής» (**CHECK 3.35**).
 */
export type ApiActor =
  | { readonly scope: 'organization'; readonly ctx: AuthContext }
  | { readonly scope: 'personal'; readonly ctx: PersonalIdentityContext };

/**
 * **Ο χώρος του δρώντος** — `null` όταν δεν υπάρχει οργανισμός.
 *
 * ⚠️ **Η ΜΟΝΗ νόμιμη μετάφραση προς `string | null`**, και ζει εδώ ώστε να είναι
 * **μία**. Ο τύπος-στόχος είναι το `ListingActor` του `lib/owner-property/
 * listing-custody.ts` (**CHECK 3.56**), που δηλώνει `companyId: string | null` με
 * γραμμένη αιτιολογία *«γιατί ο ιδιώτης δεν έχει εταιρεία»* και **απορρίπτει ρητά**
 * το `null` στον εταιρικό του κλάδο.
 *
 * ⛔ **ΜΗΝ γράψεις `?? ''`.** Κενή εταιρεία **δεν ταιριάζει με τίποτα — ούτε με κενή**
 * (`hasTenant`), και ένα κενό `companyId` σε ερώτημα Firestore είναι ακριβώς αυτό που
 * κυνηγά το **CHECK 3.35**.
 */
export function actorWorkspace(actor: ApiActor): string | null {
  return actor.scope === 'organization' ? actor.ctx.companyId : null;
}

/**
 * Handler που δέχεται **και τα δύο** είδη χώρου.
 *
 * ⚠️ Δεν παίρνει `PermissionCache`: το μόνο που θα έκανε μαζί του είναι
 * `checkPermission`, που είναι **εμβέλειας εταιρείας**. Ένα όρισμα που κανείς δεν
 * επιτρέπεται να χρησιμοποιήσει είναι πρόσκληση να χρησιμοποιηθεί.
 */
export type PersonalOrOrgHandler<T = unknown, R = unknown> = (
  request: NextRequest,
  actor: ApiActor,
  routeContext?: R,
) => Promise<NextResponse<T | ErrorResponse>>;

/**
 * Wrap an API handler so it accepts **both** an organization member and a citizen.
 *
 * ⚠️ **Η ΠΡΟΕΠΙΛΟΓΗ ΤΟΥ ΣΥΝΟΡΟΥ ΜΕΝΕΙ FAIL-CLOSED**: το `withAuth` εξακολουθεί να
 * απαντά `401` στον πολίτη. Μια διαδρομή αποκτά προσωπική εμβέλεια **μόνο**
 * καλώντας **αυτό** — ποτέ σιωπηλά, ποτέ με σημαία (ADR-817 §3).
 *
 * @example
 * ```typescript
 * export const POST = withStandardRateLimit(withPersonalOrOrgAuth(handler));
 * ```
 */
export function withPersonalOrOrgAuth<T = unknown, R = unknown>(
  handler: PersonalOrOrgHandler<T, R>,
): (request: NextRequest, routeContext?: R) => Promise<NextResponse<T | ErrorResponse>> {
  return async (request, routeContext) => {
    const identity = await buildApiIdentity(request);

    if (!identity.ok) {
      return createUnauthorizedResponse(identity.reason) as NextResponse<ErrorResponse>;
    }

    // ⚠️ **Ο ΔΡΩΝ ΞΑΝΑΧΤΙΖΕΤΑΙ, ΔΕΝ ΠΡΟΩΘΕΙΤΑΙ ΤΟ `ApiIdentity`.** Το `ok: true` είναι
    //    η ετυμηγορία του **συνόρου** — ο handler δεν έχει καμία δουλειά να τη βλέπει,
    //    και αν τη δει, ο επόμενος θα γράψει `if (actor.ok)` σε τιμή που είναι **πάντα**
    //    αληθής: φρουρός που δεν μπορεί να πυροδοτήσει (ADR-749 §5).
    const actor: ApiActor =
      identity.scope === 'organization'
        ? { scope: 'organization', ctx: identity.ctx }
        : { scope: 'personal', ctx: identity.ctx };

    return handler(request, actor, routeContext);
  };
}
