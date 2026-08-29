/**
 * @fileoverview **Η ΔΗΜΟΣΙΕΥΣΗ ΤΗΣ ΒΙΤΡΙΝΑΣ** — η δεύτερη πράξη, και είναι του γραφείου.
 * @related ADR-827 §9.10 (Π1 · Π2) · ADR-824 §6 (η απόδειξη) · ADR-787 Ε-5 §8 (ψευδώνυμο)
 * @module services/mandate/agency-profile.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΥΟ ΠΡΑΞΕΙΣ, ΚΑΙ Η ΔΕΥΤΕΡΗ ΕΙΝΑΙ ΤΟΥ ΓΡΑΦΕΙΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **ικανότητα** `brokerage_listings` είναι απόφαση **της πλατφόρμας** — *«επιτρέπεσαι
 * να μεσιτεύεις»*. Η **δημοσίευση** είναι απόφαση **του γραφείου** — *«θέλω να με
 * βρίσκουν»*. Αυτόματη δημοσίευση με τη χορήγηση θα δημοσίευε οργανισμό **που δεν το
 * ζήτησε**, δηλαδή ακριβώς την **ακούσια ιδιότητα μέλους** που κάνει το
 * `workspace_aliases` απαγορευμένο για σάρωση (ADR-787 Ε-5 §4 #1).
 *
 * 🔑 **Η ΠΑΡΟΥΣΙΑ ΕΙΝΑΙ Η ΣΥΓΚΑΤΑΘΕΣΗ.** Δεν υπάρχει πεδίο `isPublished`: θα ήταν
 * σημαία που μπορεί να διαφωνήσει με την ύπαρξη του εγγράφου (**ADR-749**).
 * **Απόσυρση = διαγραφή.**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΑ ΔΥΟ ΑΜΕΤΑΒΛΗΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Π1 | Η δημοσίευση απαιτεί `brokerage_listings === 'active'` |
 * | Π2 | `active` που **παύει** ⇒ το προφίλ **παύει να υπάρχει** |
 *
 * 🔴 **Το Π1 ΔΕΝ επιβάλλεται με `if` εδώ — επιβάλλεται από τον ΤΥΠΟ.** Η συνάρτηση
 * δέχεται {@link BrokerageAuthority}, που έχει `unique symbol` **μη εξαγόμενο**: μόνο
 * ο `requireBrokerageCapability` τον κατασκευάζει, και **κουβαλά το `companyId` ΤΟΥ
 * ΚΡΙΤΗ**. Άρα είναι **αδύνατο** να κριθεί ο ένας οργανισμός και να δημοσιευτεί ο
 * άλλος — ίδιο ιδίωμα με το `createBrokeredListing` (ADR-824 §6).
 *
 * ⚠️ **Το Π2 είναι ΠΡΑΞΗ, όχι έλεγχος ανάγνωσης.** Ένας αναγνώστης που θα ρωτούσε
 * *«είναι ακόμη active;»* σε κάθε σάρωση του καταλόγου θα ήταν **δεύτερος κριτής**
 * (ADR-749) **και** μία ανάγνωση εταιρείας ανά γραμμή. Η ανάκληση της ικανότητας
 * **καλεί** το {@link withdrawAgencyProfile}· ο κατάλογος μένει καθαρός επειδή
 * **γράφτηκε** καθαρός.
 *
 * **Layering**: service — Admin SDK. Η **κρίση** ζει στους τύπους.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import type { BrokerageAuthority } from '@/lib/auth/brokerage-authority';
import type { AgencyProfile, AgencyProfileLookup } from '@/types/agency-profile';
import type { PlaceRef } from '@/types/geo/public-place';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('agency-profile.service');

// =============================================================================
// ΤΙ ΔΗΛΩΝΕΙ ΤΟ ΓΡΑΦΕΙΟ
// =============================================================================

/**
 * **Ό,τι γράφει ο άνθρωπος**, και τίποτα παραπάνω.
 *
 * ⛔ **ΚΑΜΙΑ αυτόματη αντιγραφή από το `companies/{id}`** (§9.9 β). Το GDPR εξαιρεί τα
 * **νομικά** πρόσωπα *(αιτ. σκ. 14)*, αλλά μεσίτης με **ατομική επιχείρηση** είναι
 * **φυσικό** πρόσωπο και η έδρα του μπορεί να είναι η **κατοικία** του. Άρα κάθε πεδίο
 * που δημοσιεύεται πρέπει να έχει **γραφτεί ρητά για δημοσίευση**, όχι να έχει
 * κληρονομηθεί από εγγραφή που έγινε για άλλον λόγο.
 */
export interface AgencyProfileDeclaration {
  readonly alias: string;
  readonly displayName: string;
  readonly gemiNumber: string;
  readonly place: PlaceRef | null;
}

/** Το αποτέλεσμα της δημοσίευσης — **ποτέ `boolean`**: μια άρνηση οφείλει να εξηγείται. */
export type AgencyProfileWriteResult =
  | { readonly kind: 'published'; readonly profile: AgencyProfile }
  | { readonly kind: 'withdrawn' }
  | { readonly kind: 'rejected'; readonly reason: AgencyProfileRejection }
  | { readonly kind: 'failed' };

/** Κλειδιά i18n του «γιατί όχι» — ίδιο συμβόλαιο με το `BrokerageDenial.reason`. */
export const AGENCY_PROFILE_REJECTIONS = [
  'agency-profile-alias-missing',
  'agency-profile-name-missing',
  'agency-profile-gemi-missing',
] as const;

export type AgencyProfileRejection = (typeof AGENCY_PROFILE_REJECTIONS)[number];

// =============================================================================
// Η ΔΗΜΟΣΙΕΥΣΗ
// =============================================================================

/**
 * **«Θέλω να με βρίσκουν.»**
 *
 * @param authority Η **απόδειξη** μεσιτικής ικανότητας — όχι `companyId`. Δες Π1.
 *
 * ⚠️ **Ιδεμποτής**: δεύτερη κλήση με τα ίδια στοιχεία γράφει το ίδιο έγγραφο στο ίδιο
 * κλειδί. Το `publishedAt` **ανανεώνεται** επίτηδες — απαντά *«πότε δηλώθηκε αυτή η
 * βιτρίνα»*, όχι *«πότε μπήκε πρώτη φορά στον κατάλογο»*, και η δεύτερη ερώτηση δεν
 * έχει κανέναν να τη ρωτήσει.
 */
export async function publishAgencyProfile(
  adminDb: AdminFirestore,
  authority: BrokerageAuthority,
  declaration: AgencyProfileDeclaration,
): Promise<AgencyProfileWriteResult> {
  const rejection = rejectionFor(declaration);
  if (rejection) return { kind: 'rejected', reason: rejection };

  const profile: AgencyProfile = {
    // 🔴 ΑΠΟ ΤΗΝ ΑΠΟΔΕΙΞΗ, ποτέ από όρισμα: αδύνατο να κριθεί ο ένας και να γραφτεί
    //    ο άλλος (ADR-824 §6).
    companyId: authority.companyId,
    alias: declaration.alias.trim(),
    displayName: declaration.displayName.trim(),
    gemiNumber: declaration.gemiNumber.trim(),
    place: declaration.place,
    publishedAt: nowISO(),
  };

  try {
    await adminDb
      .collection(COLLECTIONS.AGENCY_PROFILES)
      .doc(authority.companyId)
      .set(profile);
    return { kind: 'published', profile };
  } catch (error) {
    logger.error('[AGENCY-PROFILE] Η δημοσίευση απέτυχε', {
      companyId: authority.companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
}

/**
 * **Η απόσυρση — ΔΙΑΓΡΑΦΗ, όχι σημαία** (§9.10).
 *
 * 🔑 Καλείται από **δύο** σημεία, και το δεύτερο είναι το Π2: (α) το γραφείο που
 * αποσύρεται μόνο του, (β) η **ανάκληση της ικανότητας** `brokerage_listings`.
 *
 * ⚠️ **ΔΕΝ δέχεται {@link BrokerageAuthority}, και είναι σκόπιμο.** Η απόσυρση πρέπει
 * να δουλεύει **ακριβώς όταν** η ικανότητα έχει ήδη χαθεί — τότε καμία απόδειξη δεν
 * μπορεί να κατασκευαστεί. Φρουρός που κάνει τη θεραπεία αδύνατη είναι το σχήμα του
 * `provisionWorkspace` (ADR-787 §5.1): *«φρουρός που κάνει τον έλεγχο του φρουρουμένου
 * αδύνατο»*. Ο καλών εδώ είναι **πάντα** ο διακομιστής.
 *
 * ⚠️ Ιδεμποτής: διαγραφή ανύπαρκτου εγγράφου **δεν** είναι σφάλμα — και δεν πρέπει να
 * είναι, γιατί το Π2 τρέχει και για γραφεία που ποτέ δεν δημοσιεύτηκαν.
 */
export async function withdrawAgencyProfile(
  adminDb: AdminFirestore,
  companyId: string,
): Promise<AgencyProfileWriteResult> {
  try {
    await adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId).delete();
    return { kind: 'withdrawn' };
  } catch (error) {
    logger.error('[AGENCY-PROFILE] Η απόσυρση απέτυχε', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
}

// =============================================================================
// Η ΑΝΑΓΝΩΣΗ — σημειακή, με ΣΥΓΚΑΛΥΨΗ
// =============================================================================

/**
 * **Ποιο γραφείο ζει σε αυτό το `companyId`;** — η σημειακή ανάγνωση του §9.6.
 *
 * 🔴 **Η ΣΥΓΚΑΛΥΨΗ ΕΙΝΑΙ ΕΔΩ, ΚΑΙ ΕΙΝΑΙ ΔΟΜΙΚΗ**: γραφείο που **δεν** δημοσιεύτηκε
 * επιστρέφει `not-published`, το ίδιο ακριβώς με χώρο που **δεν υπήρξε ποτέ**. Η
 * συνάρτηση **δεν ρωτά** αν υπάρχει ο μισθωτής — δεν έχει τρόπο να το μάθει, και αυτό
 * είναι το ζητούμενο: *η απουσία από την προβολή είναι αδιάκριτη από την ανυπαρξία*.
 *
 * ⚠️ **Το `unavailable` ΔΕΝ ισοπεδώνεται σε `not-published`** (N.12 · Ε-5 §4 #3).
 * *Άγνωστο ≠ κενό*: μια βλάβη Firestore που διαβαζόταν ως *«το γραφείο αποσύρθηκε»*
 * θα ήταν λάθος **προς τα έξω** και **αόρατη** προς τα μέσα. Ο καλών ενώνει τις δύο
 * τιμές **στην οθόνη**· ο κώδικας τις κρατά χωριστές.
 */
export async function lookupAgencyProfile(
  adminDb: AdminFirestore,
  companyId: string,
): Promise<AgencyProfileLookup> {
  if (companyId.trim() === '') return { outcome: 'not-published' };

  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.AGENCY_PROFILES)
      .doc(companyId)
      .get();

    if (!snapshot.exists) return { outcome: 'not-published' };
    return { outcome: 'found', profile: snapshot.data() as AgencyProfile };
  } catch (error) {
    logger.error('[AGENCY-PROFILE] Η αναζήτηση απέτυχε — άγνωστο, όχι κενό', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { outcome: 'unavailable' };
  }
}

// =============================================================================
// ΙΔΙΩΤΙΚΑ
// =============================================================================

/**
 * **Τι λείπει από τη δήλωση** — `null` όταν δεν λείπει τίποτα.
 *
 * ⚠️ Ο έλεγχος του **ΓΕΜΗ** δεν είναι τυπικότητα: χωρίς αυτόν ο κατάλογος γίνεται
 * *«ονόματα που ισχυρίζονται ότι είναι μεσίτες»*, δηλαδή **επικίνδυνος** αντί για
 * χρήσιμος (§9.9 β). Η **μορφή** του δεν ελέγχεται εδώ — αυτό είναι δουλειά του
 * ADR-824, όπου ζει η `BrokerageDeclaration`, και δεύτερος κανόνας εδώ θα ήταν ο
 * τρίτος ορισμός του ίδιου πράγματος.
 */
function rejectionFor(
  declaration: AgencyProfileDeclaration,
): AgencyProfileRejection | null {
  if (declaration.alias.trim() === '') return 'agency-profile-alias-missing';
  if (declaration.displayName.trim() === '') return 'agency-profile-name-missing';
  if (declaration.gemiNumber.trim() === '') return 'agency-profile-gemi-missing';
  return null;
}
