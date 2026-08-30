/**
 * @fileoverview **Η ΣΥΓΚΑΤΑΘΕΣΗ ΤΟΥ ΙΔΙΟΚΤΗΤΗ** — ο άνθρωπος χωρίς λογαριασμό απαντά.
 * @related ADR-777 §8.33 · lib/tokens/signed-token.ts · types/owner-property-mandate.ts
 * @module services/mandate/mandate-consent.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΡΩΤΗΜΑ ΠΟΥ ΛΥΝΕΙ: ΠΩΣ ΛΕΕΙ «ΝΑΙ» ΚΑΠΟΙΟΣ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΧΡΗΣΤΗΣ ΜΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο πελάτης του μεσίτη είναι **επαφή** (`cont_*`), όχι λογαριασμός: *«ένας
 * οικοπεδούχος δεν έχει λογαριασμό τη στιγμή που ο μεσίτης γράφει το αίτημά του, και
 * ένα υποχρεωτικό uid θα έκανε τη ροή αδύνατη ακριβώς εκεί όπου συμβαίνει»*.
 *
 * Άρα η ταυτότητά του **είναι ο ίδιος ο σύνδεσμος**: υπογεγραμμένος από εμάς,
 * ονομάζει **ένα** ακίνητο και **μία** επαφή, λήγει, και ακυρώνεται.
 *
 * 🏆 **ΚΑΙ ΕΙΝΑΙ Ο ΤΥΠΟΣ ΠΟΥ ΑΝΑΓΝΩΡΙΖΕΙ Ο ΝΟΜΟΣ.** Το άρθρο 200 Ν.4072/2012 δέχεται
 * ρητά *«τα **μηνύματα ηλεκτρονικού ταχυδρομείου**»* ως έγγραφο τύπο της μεσιτικής
 * σύμβασης. Στο MLS η ίδια εξουσιοδότηση είναι **χαρτί σε ντοσιέ** που το σύστημα
 * *«δεν επαληθεύει ποτέ»*. Εδώ η απάντηση του ιδιοκτήτη **είναι** η εγγραφή.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΡΕΙΣ ΑΠΟΦΑΣΕΙΣ, ΚΑΙ ΚΑΜΙΑ ΔΕΝ ΕΙΝΑΙ ΓΟΥΣΤΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Καμία νέα συλλογή.** Η πύλη προμηθευτή κρατά τα `nonce` σε **δεύτερη**
 *    συλλογή· εδώ το ζωντανό `nonce` ζει **πάνω στην ίδια την εντολή**. Η κατάσταση
 *    που αποφασίζει είναι η κατάσταση που απαντά — κανένα δεύτερο βιβλίο να αποκλίνει.
 * 2. **Καμία νέα μηχανή υπογραφής.** `lib/tokens/signed-token` — το **ίδιο** SSoT που
 *    εξυπηρετεί το QR παρουσιών και την πύλη προμηθευτή.
 * 3. **Καμία δεύτερη γραφή.** Η απόφαση περνά από το **υπάρχον**
 *    {@link setOwnerPropertyMandate}, ώστε η δημόσια προβολή να ξαναγράφεται στην
 *    **ίδια** πράξη. Χωρίς αυτό, ο Κώστας θα πατούσε «ναι» και η αγγελία θα εμφανιζόταν
 *    «κάποια στιγμή» — δηλαδή ποτέ, μέχρι να την ξαναθυμηθεί κάποιος.
 *
 * **Layering**: service — Admin SDK. Καμία κρίση εδώ· η κρίση ζει στους τύπους.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import {
  decodeSignedToken,
  encodeSignedToken,
  newTokenNonce,
  requireTokenSecret,
  type SignedTokenRejection,
} from '@/lib/tokens/signed-token';
import { announceMandateDecision } from '@/services/mandate/mandate-decision-notifier.service';
import { setOwnerPropertyMandate } from '@/services/owner-property/owner-property-write.service';
import type { OwnerProperty } from '@/types/owner-property';
import type { BrokeredListingMandate } from '@/types/owner-property-mandate';
import { mandatesOf } from '@/types/owner-property-mandate';

const logger = createModuleLogger('mandate-consent.service');

/**
 * ⚠️ **Δικό του μυστικό, ΟΧΙ κοινό με τις άλλες δύο πύλες.** Ένα κοινό μυστικό θα
 * σήμαινε ότι σύνδεσμος παρουσιών με τα σωστά πεδία θα περνούσε για συγκατάθεση
 * ιδιοκτήτη — τα πεδία είναι απλό κείμενο, και η υπογραφή δεν ξέρει «σε ποια πύλη»
 * ανήκει. Ξεχωριστά μυστικά κάνουν τη σύγχυση **αδύνατη**, όχι απίθανη.
 */
const SECRET_ENV = 'MANDATE_CONSENT_SECRET';

/** Πόσο ζει ο σύνδεσμος. Δεν είναι η διάρκεια της **εντολής** — είναι της **ερώτησης**. */
const LINK_LIFETIME_DAYS = 30;

// =============================================================================
// 1. ΕΚΔΟΣΗ
// =============================================================================

export interface IssuedConsentLink {
  readonly token: string;
  readonly nonce: string;
  readonly expiresAtISO: string;
}

/**
 * **Νέος σύνδεσμος συγκατάθεσης** για μια εντολή.
 *
 * ⚠️ **Δεν γράφει τίποτα.** Ο καλών οφείλει να αποθηκεύσει το `nonce` πάνω στην
 * εντολή — αλλιώς ο σύνδεσμος γεννιέται ήδη νεκρός. Ίδιο συμβόλαιο με το
 * `generateVendorPortalToken`, και ο λόγος είναι ο ίδιος: η αποθήκευση ανήκει στην
 * **πράξη** που δημιουργεί ή ενημερώνει την εντολή, ώστε να είναι **μία** γραφή.
 */
export function issueMandateConsentLink(
  ownerPropertyId: string,
  clientContactId: string,
  lifetimeDays: number = LINK_LIFETIME_DAYS,
): IssuedConsentLink {
  const nonce = newTokenNonce();
  const expiresAtMs = Date.now() + lifetimeDays * 24 * 60 * 60 * 1000;

  // ⚠️ **Χιλιοστά, ποτέ ISO.** Το ISO κουβαλά άνω-κάτω τελείες — τον ίδιο χαρακτήρα
  // που χωρίζει τα πεδία. Είναι ακριβώς το ελάττωμα που κρατούσε **κάθε** σύνδεσμο
  // προμηθευτή νεκρό (§8.33), και το `encodeSignedToken` πλέον **αρνείται** να το
  // υπογράψει — αλλά η σωστή γραφή είναι να μη ζητηθεί καν.
  const token = encodeSignedToken(requireTokenSecret(SECRET_ENV), [
    ownerPropertyId,
    clientContactId,
    nonce,
    String(expiresAtMs),
  ]);

  return { token, nonce, expiresAtISO: new Date(expiresAtMs).toISOString() };
}

// =============================================================================
// 2. ΑΝΑΓΝΩΣΗ — τι βλέπει ο άνθρωπος πριν αποφασίσει
// =============================================================================

/**
 * Γιατί δεν δείχνουμε την ερώτηση.
 *
 * 🔑 **Ονομασμένες καταστάσεις, γιατί ΚΑΘΕ ΜΙΑ λέγεται αλλιώς σε άνθρωπο.** «Ο
 * σύνδεσμος έληξε» στέλνει τον Κώστα να ζητήσει νέο· «η αγγελία δεν υπάρχει πια» του
 * λέει ότι δεν χρειάζεται να κάνει τίποτα· «άκυρος σύνδεσμος» τον προειδοποιεί. Ένα
 * κοινό «σφάλμα» θα του έλεγε και τα τρία, δηλαδή κανένα.
 *
 * ⚠️ Το `superseded` **δεν είναι λήξη**: σημαίνει ότι το γραφείο έστειλε **νεότερο**
 * σύνδεσμο. Ο άνθρωπος πρέπει να μάθει ότι έχει **πιο πρόσφατο μήνυμα**, όχι ότι
 * άργησε.
 */
export type ConsentRejection =
  | 'link-invalid'
  | 'link-expired'
  | 'listing-absent'
  | 'not-brokered'
  | 'client-mismatch'
  | 'superseded';

/** Ό,τι χρειάζεται η οθόνη του Κώστα — και **τίποτε άλλο**. */
export interface ConsentRequest {
  readonly ownerPropertyId: string;
  readonly clientContactId: string;
  readonly nonce: string;
  readonly listingTitle: string;
  readonly authorCompanyId: string | null;
  /** Η **συμβατική λήξη της εντολής** — αυτό που καλείται να εγκρίνει. */
  readonly mandateExpiresAt: string;
  /** Πού βρίσκεται ήδη η απόφασή του: του επιτρέπει να **αλλάξει γνώμη**. */
  readonly currentDecision: BrokeredListingMandate['confirmation'];
}

export type ConsentLookup =
  | { readonly ok: true; readonly request: ConsentRequest }
  | { readonly ok: false; readonly reason: ConsentRejection };

const TOKEN_REJECTION: Record<SignedTokenRejection, ConsentRejection> = {
  malformed: 'link-invalid',
  'invalid-format': 'link-invalid',
  'invalid-signature': 'link-invalid',
  'server-config': 'link-invalid',
};

/** Ο σύνδεσμος → τα πεδία του, **χωρίς καμία επαφή με τη βάση**. */
function readToken(
  token: string,
): { ok: true; fields: [string, string, string, string] } | { ok: false; reason: ConsentRejection } {
  let secret: string;
  try {
    secret = requireTokenSecret(SECRET_ENV);
  } catch {
    logger.error('Λείπει το μυστικό υπογραφής της συγκατάθεσης', {
      data: { envVar: SECRET_ENV },
    });
    return { ok: false, reason: 'link-invalid' };
  }

  const verdict = decodeSignedToken(secret, token, 4);
  if (!verdict.ok) return { ok: false, reason: TOKEN_REJECTION[verdict.reason] };
  if (verdict.fields.length !== 4) return { ok: false, reason: 'link-invalid' };

  const [ownerPropertyId, clientContactId, nonce, expiresAtMs] = verdict.fields as [
    string,
    string,
    string,
    string,
  ];

  const expiry = Number(expiresAtMs);
  if (!Number.isFinite(expiry)) return { ok: false, reason: 'link-invalid' };
  if (Date.now() > expiry) return { ok: false, reason: 'link-expired' };

  return { ok: true, fields: [ownerPropertyId, clientContactId, nonce, expiresAtMs] };
}

/**
 * **Τι ζητά αυτός ο σύνδεσμος** — αφού αποδειχθεί ότι μιλά για υπαρκτή εντολή.
 *
 * 🔴 **ΤΡΕΙΣ ΑΝΕΞΑΡΤΗΤΟΙ ΕΛΕΓΧΟΙ, ΠΟΤΕ ΕΝΑΣ ΜΕ «Η».** Η υπογραφή αποδεικνύει ότι το
 * κείμενο είναι δικό μας· **δεν** αποδεικνύει ότι η εντολή υπάρχει ακόμη, ότι είναι
 * εντολή μεσίτη, ότι αφορά **αυτόν** τον πελάτη, ούτε ότι ο σύνδεσμος είναι ο
 * τρέχων. Ένας έλεγχος που τα ένωνε θα ήταν πράσινος σε καθεμία από τις τέσσερις
 * ξεχωριστές αστοχίες.
 */
export async function readMandateConsentRequest(
  adminDb: AdminFirestore,
  token: string,
): Promise<ConsentLookup> {
  const parsed = readToken(token);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };

  const [ownerPropertyId, clientContactId, nonce] = parsed.fields;

  const snapshot = await adminDb
    .collection(COLLECTIONS.OWNER_PROPERTIES)
    .doc(ownerPropertyId)
    .get();

  const property = snapshot.data() as OwnerProperty | undefined;
  if (property === undefined) return { ok: false, reason: 'listing-absent' };
  if (mandatesOf(property).length === 0) return { ok: false, reason: 'not-brokered' };

  // 🔑 **ΤΟ NONCE ΕΙΝΑΙ Η ΤΑΥΤΟΤΗΤΑ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ** — και με τον πληθυντικό γίνεται
  //    και ο **επιλογέας** της εντολής. Ο σύνδεσμος που κρατά ο ιδιοκτήτης δείχνει
  //    σε **μία** συγκεκριμένη πρόσκληση· ένα `mandates[0]` εδώ θα τον έκανε να
  //    εγκρίνει την εντολή **άλλου γραφείου**.
  const mandate = mandatesOf(property).find((m) => m.consentNonce === nonce);
  if (mandate === undefined) return { ok: false, reason: 'superseded' };
  if (mandate.clientContactId !== clientContactId) {
    return { ok: false, reason: 'client-mismatch' };
  }

  return {
    ok: true,
    request: {
      ownerPropertyId,
      clientContactId,
      nonce,
      listingTitle: property.title,
      authorCompanyId: property.authorCompanyId,
      mandateExpiresAt: mandate.expiresAt,
      currentDecision: mandate.confirmation,
    },
  };
}

// =============================================================================
// 3. Η ΑΠΟΦΑΣΗ
// =============================================================================

export type ConsentDecision = 'confirmed' | 'declined';

export type ConsentOutcome =
  | { readonly ok: true; readonly decision: ConsentDecision }
  | { readonly ok: false; readonly reason: ConsentRejection | 'write-failed' };

/**
 * **Ο ιδιοκτήτης αποφασίζει** — και η αγγελία εμφανίζεται ή εξαφανίζεται στην ίδια πράξη.
 *
 * 🔑 **Ο σύνδεσμος ΔΕΝ καίγεται μετά τη χρήση, και είναι απόφαση.** Η πύλη προμηθευτή
 * τον καίει, γιατί μια προσφορά υποβάλλεται μία φορά. Εδώ ο άνθρωπος έχει δικαίωμα να
 * **αλλάξει γνώμη** για την περιουσία του — και μάλιστα ο δρόμος της **βεβαίωσης
 * γραφείου** στηρίζεται ακριβώς σε αυτό: του στέλνουμε σύνδεσμο **αντίρρησης** πάνω σε
 * εντολή που είναι ήδη `confirmed`. Ένας σύνδεσμος μιας χρήσης θα έκανε την αντίρρηση
 * αδύνατη μετά την πρώτη επίσκεψη.
 *
 * ⚠️ **Το `confirmedByUserId` μένει `null`** όταν απαντά από τον σύνδεσμο: ο Κώστας
 * δεν έχει λογαριασμό. Το «πότε» το κρατά το `decidedAt` — και **αυτό** είναι η
 * ουσία του έγγραφου τύπου, όχι ένα uid που δεν υπάρχει.
 */
export async function recordMandateDecision(
  adminDb: AdminFirestore,
  token: string,
  decision: ConsentDecision,
): Promise<ConsentOutcome> {
  const lookup = await readMandateConsentRequest(adminDb, token);
  if (!lookup.ok) return { ok: false, reason: lookup.reason };

  const snapshot = await adminDb
    .collection(COLLECTIONS.OWNER_PROPERTIES)
    .doc(lookup.request.ownerPropertyId)
    .get();

  const property = snapshot.data() as OwnerProperty | undefined;
  if (property === undefined) return { ok: false, reason: 'listing-absent' };

  // 🔑 **Η ΠΡΟΣΚΛΗΣΗ ΔΙΑΛΕΓΕΙ ΤΗΝ ΕΝΤΟΛΗ** — δες `readConsentTarget`. Ο σύνδεσμος
  //    που πάτησε ο ιδιοκτήτης αφορά **μία** πρόσκληση· χωρίς αυτό το φίλτρο θα
  //    ενέκρινε ό,τι έτυχε να είναι πρώτο στον πίνακα.
  const current = mandatesOf(property).find((m) => m.consentNonce === lookup.request.nonce);
  if (current === undefined) return { ok: false, reason: 'listing-absent' };

  const previous = current.confirmation;
  const decidedAt = nowISO();

  const next: BrokeredListingMandate = {
    ...current,
    confirmation: decision,
    decidedAt,
  };

  const result = await setOwnerPropertyMandate(
    adminDb,
    lookup.request.ownerPropertyId,
    next,
  );

  if (result.kind === 'saved') {
    // 🔴 **ΜΕΤΑ τη γραφή, ΠΟΤΕ πριν** (ADR-777 §8.34). Η απόφαση του ιδιοκτήτη είναι
    // η πράξη· η ειδοποίηση του γραφείου είναι **παρακολούθημα**. Μια αποστολή πριν
    // την επιτυχή γραφή θα έλεγε στον μεσίτη «ενέκρινε» για έγκριση που **δεν
    // αποθηκεύτηκε** — και ο μεσίτης θα έψαχνε αγγελία που δεν βγήκε ποτέ.
    //
    // ⚠️ Αναμένεται με `await` και **δεν** μπορεί να αποτύχει το αίτημα: ο
    // ειδοποιητής δεν πετά ποτέ. Fire-and-forget θα σήμαινε ότι σε serverless η
    // ειδοποίηση **μπορεί να μη φύγει ποτέ** όταν παγώσει η συνάρτηση.
    await announceMandateDecision(adminDb, {
      ownerPropertyId: lookup.request.ownerPropertyId,
      listingTitle: property.title,
      clientContactId: current.clientContactId,
      recipientUserId: property.authorUserId,
      tenantId: property.authorCompanyId,
      previous,
      next: decision,
      decidedAt,
    });

    return { ok: true, decision };
  }
  if (result.kind === 'absent') return { ok: false, reason: 'listing-absent' };
  return { ok: false, reason: 'write-failed' };
}

// =============================================================================
// 4. «ΤΟ ΕΙΔΕ» — το `Delivered` του DocuSign
// =============================================================================

/**
 * **Ο ιδιοκτήτης άνοιξε τον σύνδεσμο.** Σφραγίζει το `viewedAt` — **μία** φορά.
 *
 * 🔴 **ΓΙΑΤΙ ΔΕΝ ΜΠΗΚΕ ΜΕΣΑ ΣΤΟ {@link readMandateConsentRequest}.** Εκείνο είναι
 * **ανάγνωση**, και το καλεί και ο έλεγχος πριν από κάθε απόφαση
 * ({@link recordMandateDecision}). Μια εγγραφή κρυμμένη εκεί θα σήμαινε ότι κάθε
 * κλήση του API αποφάσεων «βλέπει» τη σελίδα — δηλαδή το πεδίο θα γέμιζε **και όταν
 * δεν την είδε άνθρωπος**, και θα το έκανε με ημερομηνία, δηλαδή πειστικά. Η σφραγίδα
 * ζει εκεί που όντως αποδίδεται σελίδα: `(auth)/mandate/[token]/page.tsx`.
 *
 * 🔑 **Ιδεμποτέντ εκ σχεδιασμού, ΟΧΙ με κλείδωμα.** Γράφει **μόνο** όταν το `viewedAt`
 * είναι `null` ⇒ δεύτερη κλήση δεν αλλάζει τίποτα. Έτσι η διπλή απόδοση της React,
 * ένα refresh ή μια προανάκτηση είναι **αβλαβή** — και δεν χρειάστηκε ούτε κλείδωμα
 * ούτε δεύτερο βιβλίο. Η **πρώτη** ματιά είναι το γεγονός· η δέκατη δεν αλλάζει
 * καμία απόφαση του γραφείου και θα έκανε κάθε φόρτωση σελίδας εγγραφή στη βάση.
 *
 * ⚠️ **Δεν επιστρέφει τίποτα και δεν πετά ποτέ.** Είναι **παρατήρηση**, όχι πράξη του
 * ανθρώπου: μια αποτυχία εδώ δεν επιτρέπεται να εμποδίσει τον ιδιοκτήτη να δει και να
 * απαντήσει στην εντολή του. Καταγράφεται και προσπερνιέται.
 */
export async function markMandateViewed(
  adminDb: AdminFirestore,
  ownerPropertyId: string,
  /**
   * 🔑 **Ποια πρόσκληση άνοιξε** (ADR-832). Χωρίς αυτό, η σφραγίδα «το είδε» θα
   * έπεφτε σε αυθαίρετη εντολή — και το *«πόσο γρήγορα απαντά ο ιδιοκτήτης;»* θα
   * μετρούσε **άλλο** γραφείο από αυτό που έστειλε τον σύνδεσμο.
   */
  consentNonce: string,
): Promise<void> {
  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.OWNER_PROPERTIES)
      .doc(ownerPropertyId)
      .get();

    const property = snapshot.data() as OwnerProperty | undefined;
    if (property === undefined) return;

    const mandate = mandatesOf(property).find((m) => m.consentNonce === consentNonce);
    if (mandate === undefined) return;
    if (mandate.viewedAt !== null) return;

    await setOwnerPropertyMandate(adminDb, ownerPropertyId, {
      ...mandate,
      viewedAt: nowISO(),
    });
  } catch (error) {
    logger.error('Η σφραγίδα «το είδε» δεν γράφτηκε', {
      data: { ownerPropertyId },
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
