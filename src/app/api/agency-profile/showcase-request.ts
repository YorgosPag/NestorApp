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
import { normalizeCoverageIds } from '@/lib/agency/coverage-absorption';
import { coverageOutlineDefect, type CoverageOutlineDefect } from '@/lib/agency/coverage-outline';
import { placeRefSchema } from '@/lib/geo/place-ref-schema';
import { resolveAlias } from '@/lib/workspace/alias-registry';
import { readOccupationClassification } from '@/services/esco/occupation-classification.reader';
import { readAdministrativeLineage } from '@/services/places/administrative-hierarchy.reader';
import { readLandPosition } from '@/services/places/place-position.reader';
import {
  PLACE_REF_TREATMENT,
  verifyPlaceRef,
} from '@/services/places/public-place-read.service';
import type { AgencyProfileRejection } from '@/services/mandate/agency-profile-verdict';
import {
  asCoverageRadiusKm,
  isNationwide,
  isOutlineCoverage,
  isRadiusCoverage,
  type DeclaredCoverage,
} from '@/types/agency-coverage';
import type { ClassifiedOccupation, PublicShowcase } from '@/types/agency-profile';
import type { GeoPoint } from '@/types/geo/coordinates';
import { SEAT_DISCLOSURES } from '@/types/showcase-legal-identity';
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
  // 🔴 ADR-841 §7 Α23 — **επιλογή** ονόματος, ποτέ κείμενο. Ο τίτλος ταξιδεύει μόνο για να πει
  //    **ποιος** από τους τίτλους του ΓΕΜΗ· το αν υπάρχει εκεί το κρίνει ο γραφέας, ονομαστικά.
  publicName: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('legal-name') }),
    z.object({ kind: z.literal('distinctive-title'), title: z.string().max(200) }),
  ]),
  // ⚠️ Κλειστό σύνολο **μορφής** — η οθόνη δεν παράγει άλλη τιμή. Το «λείπει» το κρίνει ο γραφέας.
  seatDisclosure: z.enum(SEAT_DISCLOSURES).nullable().optional(),
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
  /**
   * **Η ΔΗΛΩΜΕΝΗ ΕΜΒΕΛΕΙΑ** *(ADR-846)* — κλειστή ένωση δύο σκελών.
   *
   * ⚠️ Το `max(64)` στις ταυτότητες είναι **φρουρός πόρου**, όχι κρίση: κάθε στοιχείο
   * κοστίζει μια διάσχιση γενεαλογίας. Και **δεν χρειάζεται πλαφόν σχεδίασης** — η
   * κανονικοποίηση *(απορρόφηση απογόνων)* κρατά τη λίστα μικρή **μόνη της**, γι' αυτό
   * το όριο μπορεί να είναι τόσο χαλαρό.
   *
   * 🔑 **Κανένα `min(1)`**, ίδιο δόγμα με τα υπόλοιπα πεδία: το *«κενή λίστα»* το
   * απαντά ο **γραφέας**, μετατρέποντάς το σε `coverage: null` — μία αναπαράσταση
   * για την απουσία, όχι δύο.
   */
  coverage: z
    .union([
      z.object({ nationwide: z.literal(true) }),
      z.object({ adminIds: z.array(z.string().max(64)).max(200) }),
      /**
       * **Το σκέλος της ακτίνας** *(ADR-846 Φάση 2)* — **μορφή** εδώ, **κρίση** στον
       * {@link resolveCoverage}.
       *
       * ⚠️ **Κανένα `enum` στο `radiusKm` εδώ, επίτηδες.** Ένα `z.union([z.literal(10),…])`
       * θα απαντούσε *«κακό σώμα»* — δηλαδή ο άνθρωπος θα έβλεπε `MALFORMED_BODY` αντί
       * για ονομαστικό λόγο, ακριβώς η αστοχία που το σχόλιο των `min(1)` παραπάνω
       * περιγράφει. Ο κλειστός κατάλογος επιβάλλεται **ονομαστικά** παρακάτω, από τον
       * ίδιο κριτή που ονομάζει και την άγνωστη διοικητική περιοχή.
       */
      z.object({
        circle: z.object({
          center: z.object({ lat: z.number(), lng: z.number() }),
          radiusKm: z.number(),
        }),
      }),
      /**
       * **Το σκέλος του χαραγμένου πολυγώνου** *(ADR-846 Φάση 3)* — **μορφή** εδώ,
       * **κρίση** στον {@link resolveCoverage}, ίδιο δόγμα με την ακτίνα από πάνω.
       *
       * ⚠️ **Το `max(1000)` ΔΕΝ είναι το ταβάνι** — το ταβάνι είναι **100**
       * *(`COVERAGE_MAX_VERTICES`)* και επιβάλλεται **ονομαστικά** παρακάτω, ώστε ο
       * άνθρωπος να μάθει *«πάρα πολλές κορυφές»* αντί για `MALFORMED_BODY`. Αυτό εδώ
       * είναι **φρουρός πόρου**: ένα σώμα με 100.000 κορυφές δεν αξίζει ούτε ένα
       * `parse`. Η απόσταση των δύο αριθμών είναι επίτηδες μεγάλη — καμία **ανθρώπινη**
       * χάραξη δεν πέφτει ανάμεσά τους.
       */
      z.object({
        outline: z
          .array(z.object({ lat: z.number(), lng: z.number() }))
          .max(1000),
      }),
    ])
    .nullable()
    .optional(),
  /**
   * ⛔ **ΚΑΝΕΝΑ `mark` ΕΔΩ — ΕΦΥΓΕ ΣΤΗ ΔΙΚΗ ΤΟΥ ΔΙΑΔΡΟΜΗ** (ADR-841 §7 Α21, Φάση 2).
   *
   * Υπήρξε, και η αφαίρεσή του είναι **διόρθωση βλάβης**: η οθόνη διαβάζει πίσω το ίδιο
   * έγγραφο με τον κόσμο, όπου το σήμα ζει ως **δημόσιο URL** — το `privateStoragePath`
   * που ζητούσε αυτό το πεδίο **δεν επιστρέφει ποτέ**. Άρα κάθε δεύτερη δημοσίευση
   * έστελνε «κανένα σήμα» και **έσβηνε το λογότυπο**, χωρίς ο πελάτης να έχει τρόπο να
   * το αποφύγει.
   *
   * ⇒ `POST`/`DELETE /api/agency-profile/mark` — δες
   * {@link module:app/api/agency-profile/mark-request}.
   */
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
  /** Δηλωμένη περιοχή που **δεν υπάρχει** στην ιεραρχία ⇒ **διάλεξέ την ξανά** (422). */
  | { readonly error: 'COVERAGE_AREA_UNKNOWN'; readonly adminId: string }
  /** 🔴 **Δεν διαβάστηκε η ιεραρχία** ⇒ **ξαναδοκίμασε** (503), ποτέ 422. */
  | { readonly error: 'COVERAGE_UNVERIFIED' }
  /**
   * Δηλωμένη **ακτίνα** εκτός του κλειστού καταλόγου, ή κέντρο εκτός γης ⇒ **διόρθωσε** (422).
   *
   * ⚠️ **Η οθόνη ΔΕΝ μπορεί να το παράγει** *(κλειστά βήματα + σημείο από τον χάρτη)* —
   * υπάρχει ως **δεύτερη ζώνη** για ό,τι δεν ήρθε από την οθόνη μας. Ένας τύπος δεν
   * επιβιώνει ενός `JSON.parse` *(δες `asCoverageRadiusKm`)*.
   */
  | { readonly error: 'COVERAGE_RADIUS_INVALID' }
  /**
   * Δηλωμένο **χαραγμένο πολύγωνο** που δεν είναι σχήμα, ή που ξεπερνά τα ταβάνια
   * *(κορυφές · έκταση)* ⇒ **διόρθωσε** (422). Το `defect` **ονομάζει** το γιατί.
   *
   * ⚠️ **Η οθόνη ΜΠΟΡΕΙ να το παράγει** — σε αντίθεση με τον κύκλο. Ο άνθρωπος χαράζει
   * ελεύθερα, άρα *«πολύ πλατύ»* είναι **αναμενόμενη** απάντηση, όχι δεύτερη ζώνη. Γι'
   * αυτό η φόρμα καλεί **την ίδια** συνάρτηση και το λέει **πριν** την υποβολή
   * *(`lib/agency/coverage-outline.ts`)* — εδώ είναι η **εγγύηση**, εκεί η ανάδραση.
   */
  | { readonly error: 'COVERAGE_OUTLINE_INVALID'; readonly defect: CoverageOutlineDefect }
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

  const located = await locatePlace(adminDb, place);
  return 'placeError' in located
    ? {
        rejected: NextResponse.json(
          { error: located.placeError } as const,
          { status: PLACE_ERROR_STATUS[located.placeError] },
        ),
      }
    : located;
}

/** Οι **δύο** θεραπείες ως κωδικοί δικτύου — «άλλαξέ τον» (422) ≠ «ξαναδοκίμασε» (503). */
export const PLACE_ERROR_STATUS = { PLACE_NOT_FOUND: 422, PLACE_UNVERIFIED: 503 } as const;

export type PlaceError = keyof typeof PLACE_ERROR_STATUS;

/**
 * **Η κρίση του `locate` χωρίς το δίκτυο** — ώστε δεύτερη πόρτα (η κάρτα, ADR-841 §7 Α21.16)
 * να την ξαναχρησιμοποιεί με **δικό της** τύπο απάντησης, αντί να αντιγράψει τις τρεις θεραπείες.
 */
export async function locatePlace(
  adminDb: ReturnType<typeof getAdminFirestore>,
  place: PlaceRef,
): Promise<{ readonly position: GeoPoint | null } | { readonly placeError: PlaceError }> {
  const treatment = PLACE_REF_TREATMENT[await verifyPlaceRef(adminDb, place)];
  if (treatment === 'reject') return { placeError: 'PLACE_NOT_FOUND' };
  if (treatment === 'retry') return { placeError: 'PLACE_UNVERIFIED' };
  return { position: await readLandPosition(adminDb, place.landId) };
}

/**
 * **Επαληθεύει τη δηλωμένη εμβέλεια ΚΑΙ την κανονικοποιεί** — δύο πράξεις, μία γνώση.
 *
 * 🔴 **Η ΕΓΚΥΡΟΤΗΤΑ ΔΕΝ ΕΡΧΕΤΑΙ ΑΠΟ ΤΟ ΣΩΜΑ** *(ADR-846)*. Ταυτότητα που δεν υπάρχει
 * δεν σκάει πουθενά: ο κριτής θα απαντούσε `disjoint` παντού, και ο επαγγελματίας θα
 * έβλεπε *«δήλωσα περιοχή»* ενώ **κανείς δεν μπορεί να τον βρει από αυτήν**. Ίδια κλάση
 * σιωπηλής βλάβης με τον δεσμό σε ανύπαρκτο τόπο, ίδιες **τρεις** θεραπείες.
 *
 * ⚠️ **Η κενή λίστα γίνεται `null`, ΕΔΩ, μία φορά**: *«δήλωσα και μετά τα έσβησα όλα»*
 * και *«δεν δήλωσα ποτέ»* είναι **η ίδια** κατάσταση για κάθε αναγνώστη, και δύο
 * αναπαραστάσεις της θα ήταν έλεγχος που κάποιος θα ξεχνούσε.
 */
export async function resolveCoverage(
  coverage: DeclaredCoverage | null | undefined,
): Promise<
  | { readonly coverage: DeclaredCoverage | null }
  | { readonly rejected: NextResponse<AgencyProfileWriteResponse> }
> {
  if (coverage === null || coverage === undefined) return { coverage: null };
  // 🔑 «Όλη η Ελλάδα» δεν έχει τίποτα να επαληθευτεί — δεν είναι ταυτότητα, είναι όριο.
  if (isNationwide(coverage)) return { coverage };

  // ── Η ΑΚΤΙΝΑ: κλειστός κατάλογος + κέντρο πάνω στη γη ──────────────────────
  //
  // 🔴 **Ο κλειστός κατάλογος είναι ΟΛΟ το επιχείρημα που επέτρεψε αυτό το σκέλος**
  //    *(δες `types/agency-coverage.ts`)*. Αν ο διακομιστής δεχόταν αυθαίρετο αριθμό,
  //    η απαγόρευση #6 θα είχε ανασταθεί από την πίσω πόρτα — με τον τύπο να λέει
  //    «τέσσερα βήματα» και τη βάση να κρατά «500».
  if (isRadiusCoverage(coverage)) {
    const { center, radiusKm } = coverage.circle;
    const step = asCoverageRadiusKm(radiusKm);
    const onEarth =
      Number.isFinite(center.lat) &&
      Number.isFinite(center.lng) &&
      Math.abs(center.lat) <= 90 &&
      Math.abs(center.lng) <= 180;

    if (step === null || !onEarth) {
      return {
        rejected: NextResponse.json(
          { error: 'COVERAGE_RADIUS_INVALID' } as const,
          { status: 422 },
        ),
      };
    }
    // ⚠️ **Ξαναχτίζεται από τα επαληθευμένα μέρη**, δεν περνά αυτούσιο: ό,τι δεν
    //    ελέγχθηκε δεν αποθηκεύεται *(και το `step` κουβαλά τον στενό τύπο)*.
    return { coverage: { circle: { center: { lat: center.lat, lng: center.lng }, radiusKm: step } } };
  }

  // ── ΤΟ ΧΑΡΑΓΜΕΝΟ ΠΟΛΥΓΩΝΟ: σχήμα + τα ΔΥΟ ταβάνια ────────────────────────────
  //
  // 🔴 **Ο ΕΛΕΓΧΟΣ ΕΙΝΑΙ Η ΙΔΙΑ ΣΥΝΑΡΤΗΣΗ ΠΟΥ ΤΡΕΧΕΙ Η ΦΟΡΜΑ ΚΑΙ Ο ΑΝΑΓΝΩΣΤΗΣ**
  //    *(`lib/agency/coverage-outline.ts`)*. Τρεις καλούντες, **μία** κρίση: αλλιώς ο
  //    άνθρωπος βλέπει πράσινο και τρώει άρνηση, ή ο δίσκος κρατά σχήμα που κανείς δεν
  //    θα δεχόταν σήμερα. Το ταβάνι έκτασης *(περιγεγραμμένος ≤ 50 χλμ)* είναι **το
  //    ανώτατο βήμα ακτίνας**, όχι νέος αριθμός — δες `types/agency-coverage.ts`.
  if (isOutlineCoverage(coverage)) {
    const defect = coverageOutlineDefect(coverage.outline);
    if (defect !== null) {
      return {
        rejected: NextResponse.json(
          { error: 'COVERAGE_OUTLINE_INVALID', defect } as const,
          { status: 422 },
        ),
      };
    }
    // ⚠️ **Ξαναχτίζεται από τα επαληθευμένα μέρη** — ίδιο ιδίωμα με τον κύκλο: ό,τι
    //    δεν ελέγχθηκε δεν αποθηκεύεται (ένα `{ lat, lng, note: '…' }` δεν περνά).
    return {
      coverage: { outline: coverage.outline.map(({ lat, lng }) => ({ lat, lng })) },
    };
  }

  if (coverage.adminIds.length === 0) return { coverage: null };

  const lineageOf = await readAdministrativeLineage();
  if (lineageOf === null) {
    return {
      rejected: NextResponse.json({ error: 'COVERAGE_UNVERIFIED' } as const, { status: 503 }),
    };
  }

  // ⚠️ **Ονομάζεται η ΠΡΩΤΗ άγνωστη**, δεν απορρίπτονται σιωπηλά: ο άνθρωπος πρέπει να
  //    μάθει **ποια** επιλογή του χάθηκε, όχι ότι «κάτι» δεν πέρασε.
  for (const adminId of coverage.adminIds) {
    if (lineageOf(adminId).length === 0) {
      return {
        rejected: NextResponse.json(
          { error: 'COVERAGE_AREA_UNKNOWN', adminId } as const,
          { status: 422 },
        ),
      };
    }
  }

  return { coverage: { adminIds: normalizeCoverageIds(coverage.adminIds, lineageOf) } };
}
