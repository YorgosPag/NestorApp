/**
 * @fileoverview **ΤΙ ΡΩΤΑ Ο ΔΙΑΚΟΜΙΣΤΗΣ ΠΡΙΝ ΓΡΑΨΕΙ** — το σχήμα του σύρματος, το
 * κλειστό σύνολο απαντήσεων, και οι **τρεις** επαληθεύσεις που δεν επιτρέπεται να
 * έρθουν από τον πελάτη.
 * @related app/api/agency-profile/route.ts · lib/agency/showcase-wire.ts
 * @module app/api/agency-profile/showcase-request
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΧΩΡΙΣΤΗΚΕ ΑΠΟ ΤΟ `route.ts` (2026-09-02)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η διαδρομή έφτασε **359 γραμμές** έναντι ορίου **300** για API route (N.7.1). Η
 * τομή **δεν** είναι «κόψε στη μέση»: εδώ ζει ό,τι απαντά *«είναι αυτό το αίτημα
 * αληθινό;»* — και στο `route.ts` μένει μόνο *«τι κάνουμε τότε»*. Ο χειριστής
 * διαβάζεται πλέον ολόκληρος σε μία οθόνη, που είναι ο λόγος ύπαρξης του ορίου.
 *
 * 🔴 **ΟΙ ΤΡΕΙΣ ΕΠΑΛΗΘΕΥΣΕΙΣ ΕΙΝΑΙ Η ΙΔΙΑ ΚΛΑΣΗ ΒΛΑΒΗΣ** — *«σωστό φίλτρο, ψεύτικη
 * κάρτα»* (ADR-841 Α9.5): **ψευδώνυμο** που ανήκει σε άλλον · **ταξινόμηση** που ο
 * πελάτης θα ονόμαζε μόνος του · **γεωμετρία** που θα έδειχνε σε αγορά που δεν
 * υπηρετείς. Και οι τρεις απαντούν **ΔΥΟ διαφορετικές θεραπείες** — *«διόρθωσέ το»*
 * (422) ≠ *«ξαναδοκίμασε»* (503) — γιατί **άγνωστο ≠ κενό** (N.12): ένα κοινό 422 σε
 * δική **μας** βλάβη στέλνει τον άνθρωπο να αλλάξει **σωστή** επιλογή.
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { ShowcaseDeniedResponse } from '@/lib/auth/brokerage-gate';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { ShowcaseWireDeclaration } from '@/lib/agency/showcase-wire';
import { placeRefSchema } from '@/lib/geo/place-ref-schema';
import { resolveAlias } from '@/lib/workspace/alias-registry';
import { readOccupationClassification } from '@/services/esco/occupation-classification.reader';
import { readLandPosition } from '@/services/places/place-position.reader';
import {
  PLACE_REF_TREATMENT,
  verifyPlaceRef,
} from '@/services/places/public-place-read.service';
import type { AgencyProfileRejection } from '@/services/mandate/agency-profile.service';
import type { ClassifiedOccupation, PublicShowcase } from '@/types/agency-profile';
import type { GeoPoint } from '@/types/geo/coordinates';
import type { PlaceRef } from '@/types/geo/public-place';
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
/**
 * 🔑 **`z.ZodType<ShowcaseWireDeclaration>` — ΤΟ ΣΧΗΜΑ ΔΕΝΕΤΑΙ ΜΕ ΤΟΝ ΤΥΠΟ.**
 * Ίδιο ιδίωμα με το `geoPointSchema`: μια μελλοντική προσθήκη πεδίου στο σύρμα
 * **δεν μεταγλωττίζεται** εδώ, αντί να περάσει σιωπηλά ως ανώνυμο αντικείμενο.
 * Χωρίς αυτό, ο πελάτης και η διαδρομή θα αποκλίνανε **αόρατα** — δες
 * `lib/agency/showcase-wire.ts`.
 */
export const publishSchema: z.ZodType<ShowcaseWireDeclaration> = z.object({
  alias: z.string().max(128),
  displayName: z.string().max(200),
  /**
   * 🔴 **ΜΟΝΟ `escoUri` — καμία ετικέτα, κανένας `iscoCode`.** Η ταξινόμηση
   * διαβάζεται από τον διακομιστή· ετικέτα από το σύρμα θα επέτρεπε «Δικηγόρος»
   * πάνω σε URI υδραυλικού *(σωστό φίλτρο, ψεύτικη κάρτα)*.
   *
   * ⚠️ Το `max(8)` είναι **φρουρός πόρου**, όχι κρίση: κάθε στοιχείο κοστίζει μία
   * ανάγνωση ταξινομίας. Το *«καμία ειδικότητα»* το απαντά ο **γραφέας**, με
   * όνομα (`agency-profile-occupation-missing`) — ένα `min(1)` εδώ θα το
   * μετέτρεπε σε `MALFORMED_BODY` και θα έκανε τον ονομαστικό λόγο νεκρό.
   */
  credentials: z
    .array(
      z.object({
        escoUri: z.string().max(256),
        registrationNumber: z.string().max(64).optional(),
        registrationChapter: z.string().max(128).optional(),
      }),
    )
    .max(8),
  // ⚠️ `.optional()` **και** `.nullable()`: η οθόνη που δεν δήλωσε τόπο δεν στέλνει
  //    το πεδίο καθόλου, και το `null` είναι η **ρητή** «καμία περιοχή».
  //
  //    🔴 **ΚΑΝΕΝΑ `position` ΕΔΩ, ΕΠΙΤΗΔΕΣ**: τη γεωμετρία την παράγει ο
  //    διακομιστής από τη γη (δες {@link locate}). Δες `lib/agency/showcase-wire`.
  place: placeRefSchema.nullable().optional(),
});

export type AgencyProfileWriteResponse =
  | { readonly profile: PublicShowcase }
  | { readonly withdrawn: true }
  | { readonly error: 'INVALID_PROFILE'; readonly reason: AgencyProfileRejection }
  /** Το ψευδώνυμο δεν λύνεται σε **αυτόν** τον οργανισμό — ή δεν λύνεται καθόλου. */
  | { readonly error: 'ALIAS_NOT_OWNED' }
  /** 🔴 **Δεν μάθαμε** — ποτέ ίδιο με το παραπάνω. */
  | { readonly error: 'ALIAS_UNVERIFIED' }
  /** Το URI δεν αντιστοιχεί σε επάγγελμα της ταξινομίας ⇒ **διόρθωσε** (422). */
  | { readonly error: 'OCCUPATION_UNKNOWN'; readonly escoUri: string }
  /** 🔴 **Δεν μπορέσαμε να ρωτήσουμε** την ταξινομία ⇒ **ξαναδοκίμασε** (503). */
  | { readonly error: 'CLASSIFICATION_UNAVAILABLE' }
  /** Ο δεσμός δεν δείχνει σε τόπο που υπάρχει ⇒ **άλλαξέ τον** (422). */
  | { readonly error: 'PLACE_NOT_FOUND' }
  /** 🔴 **Δεν μάθαμε** αν ο τόπος υπάρχει ⇒ **ξαναδοκίμασε** (503), ποτέ 422. */
  | { readonly error: 'PLACE_UNVERIFIED' }
  | ShowcaseDeniedResponse
  | { readonly error: 'WRITE_FAILED' };

/**
 * **Είναι αυτή η διεύθυνση δική σου;** — `null` όταν ναι, αλλιώς η έτοιμη απάντηση.
 *
 * ⚠️ Ο έλεγχος είναι **ισότητα με το `companyId` ΤΗΣ ΑΠΟΔΕΙΞΗΣ**, ποτέ με το σώμα:
 * το ίδιο ιδίωμα που κάνει αδύνατο να κριθεί ο ένας οργανισμός και να γραφτεί ο άλλος.
 */
export async function verifyAliasOwnership(
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

/**
 * **Λύνει τα δηλωμένα URI σε ταξινομημένες ειδικότητες** — ή την έτοιμη απάντηση.
 *
 * 🔴 **Μία ανάγνωση ανά credential, στη ΓΡΑΦΗ** *(η οικονομία που δέχτηκε ρητά η
 * Α1.6)*: η βιτρίνα κουβαλά μετά το αντίγραφο, με το ιδίωμα *«αντίγραφο, όχι
 * αυθεντία»*. Ο κατάλογος **δεν** ξαναρωτά την ταξινομία ποτέ.
 */
export async function classifyDeclared(
  adminDb: ReturnType<typeof getAdminFirestore>,
  declared: readonly { readonly escoUri: string }[],
): Promise<
  | { readonly occupations: ClassifiedOccupation[] }
  | { readonly rejected: NextResponse<AgencyProfileWriteResponse> }
> {
  const occupations: ClassifiedOccupation[] = [];

  for (const entry of declared) {
    const read = await readOccupationClassification(adminDb, entry.escoUri);

    // ⚠️ **ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΕΣ ΘΕΡΑΠΕΙΕΣ** (N.12): *«δεν υπάρχει τέτοιο επάγγελμα»*
    //    λέει «διάλεξε άλλο»· *«δεν μπόρεσα να ρωτήσω»* λέει «ξαναδοκίμασε». Ένα
    //    κοινό 422 θα έστελνε τον άνθρωπο να αλλάξει **σωστή** επιλογή για δική
    //    μας βλάβη.
    if (read.outcome === 'absent') {
      return {
        rejected: NextResponse.json(
          { error: 'OCCUPATION_UNKNOWN', escoUri: entry.escoUri } as const,
          { status: 422 },
        ),
      };
    }
    if (read.outcome === 'unavailable') {
      return {
        rejected: NextResponse.json(
          { error: 'CLASSIFICATION_UNAVAILABLE' } as const,
          { status: 503 },
        ),
      };
    }

    occupations.push(read.occupation);
  }

  return { occupations };
}

/**
 * **Επαληθεύει τον τόπο ΚΑΙ παράγει τη γεωμετρία του** — δύο πράξεις, ένα πέρασμα.
 *
 * 🔴 **Η ΓΕΩΜΕΤΡΙΑ ΔΕΝ ΕΡΧΕΤΑΙ ΑΠΟ ΤΟ ΣΩΜΑ** *(δες `place-position.reader`)*:
 * ένα `position` από τον πελάτη θα επέτρεπε βιτρίνα με τόπο στη Θεσσαλονίκη και
 * σημείο στην Αθήνα — **σωστή κάρτα, ψεύτικο φίλτρο**.
 *
 * ⚠️ **Και ο δεσμός επαληθεύεται πρώτος**, με τις **τρεις** θεραπείες του
 * `PLACE_REF_TREATMENT`: *«άλλαξέ τον»* ≠ *«ξαναδοκίμασε»* ≠ *«προχώρα»*. Χωρίς
 * αυτό, ένας δεσμός σε ανύπαρκτο τόπο θα ταξίδευε στη βιτρίνα, θα **φαινόταν**
 * λυμένος, και απλώς δεν θα εμφανιζόταν ποτέ σε κανένα φίλτρο.
 */
export async function locate(
  adminDb: ReturnType<typeof getAdminFirestore>,
  place: PlaceRef | null,
): Promise<
  | { readonly position: GeoPoint | null }
  | { readonly rejected: NextResponse<AgencyProfileWriteResponse> }
> {
  // «Δεν δήλωσε τόπο» είναι **νόμιμο**: ο επαγγελματίας μπαίνει στον κατάλογο
  // χωρίς να εμφανίζεται στο φίλτρο απόστασης.
  if (place === null) return { position: null };

  const treatment = PLACE_REF_TREATMENT[await verifyPlaceRef(adminDb, place)];
  if (treatment === 'reject') {
    return {
      rejected: NextResponse.json({ error: 'PLACE_NOT_FOUND' } as const, { status: 422 }),
    };
  }
  if (treatment === 'retry') {
    return {
      rejected: NextResponse.json({ error: 'PLACE_UNVERIFIED' } as const, { status: 503 }),
    };
  }

  return { position: await readLandPosition(adminDb, place.landId) };
}
