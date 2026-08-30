/**
 * @fileoverview **Ο ΚΥΚΛΟΣ ΖΩΗΣ ΤΗΣ ΙΚΑΝΟΤΗΤΑΣ** — ποιος αλλάζει κατάσταση, και σε ποια.
 * @related ADR-824 §5.3 · types/organization-capability.ts · lib/auth/brokerage-authority.ts
 * @module services/company/organization-capability.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΞΕΧΩΡΙΣΤΟΣ ΓΡΑΦΕΑΣ ΑΝΤΙ ΓΙΑ `update()` ΣΤΙΣ ΔΙΑΔΡΟΜΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι μεταβάσεις είναι **δύο** και τις ζητούν **δύο διαφορετικά ακροατήρια** — ο
 * ιδρυτής (δηλώνει) και ο υπερδιαχειριστής (αποφασίζει). Γραμμένες στις διαδρομές θα
 * ήταν **δύο** αντίγραφα του ίδιου πίνακα, και η τρίτη διαδρομή θα γεννιόταν χωρίς
 * αυτόν. Ο πίνακας ζει **μία** φορά, εδώ.
 *
 * 🔑 **Η ΜΕΤΑΒΑΣΗ ΕΙΝΑΙ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ, ΟΧΙ ΕΛΕΥΘΕΡΗ ΑΝΑΘΕΣΗ.** Ένα `update({status})`
 * θα επέτρεπε `revoked → active` **χωρίς νέα δήλωση**, δηλαδή θα ανέστρεφε μια
 * ρυθμιστική απόφαση με ένα πάτημα και **χωρίς ίχνος**. Εδώ κάθε μετάβαση που δεν
 * είναι στον πίνακα απαντιέται **ονομαστικά**.
 *
 * ⚠️ **Ο ρόλος ΔΕΝ κρίνεται εδώ.** Το *«είσαι υπερδιαχειριστής;»* το απαντά ο ΕΝΑΣ
 * κριτής στο σύνορο (`withAuth({ requiredGlobalRoles })`, ADR-801 · CHECK 3.68). Αυτό
 * το αρχείο απαντά **μόνο** *«επιτρέπεται αυτή η μετάβαση;»* — δεύτερο ερώτημα,
 * δεύτερο αρχείο, **καμία** επικάλυψη.
 *
 * **Layering**: service — Admin SDK, μία ανάγνωση + μία γραφή.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { EntityAuditService } from '@/services/entity-audit.service';
import { withdrawAgencyProfile } from '@/services/mandate/agency-profile.service';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import {
  capabilityStatusFieldPath,
  capabilityStatusOf,
  type BrokerageDeclaration,
  type CapabilityStatus,
  type OrganizationCapabilities,
  type OrganizationCapabilityRecord,
} from '@/types/organization-capability';

const logger = createModuleLogger('organization-capability.service');

const CAPABILITY = 'brokerage_listings' as const;

/**
 * **Τι εκκρεμεί όσο η δήλωση περιμένει** — κλειδί i18n, ποτέ κείμενο (N.11).
 *
 * 🔑 Πρότυπο `requirements.currently_due` της Stripe: η οθόνη μπορεί να πει στον
 * άνθρωπο **τι λείπει, ονομαστικά** — αντί για ένα «δεν επιτρέπεται» που δεν
 * υποδεικνύει καμία πράξη.
 */
const PENDING_REQUIREMENT = { key: 'auth:brokerage.requirement.adminApproval' } as const;

// =============================================================================
// ΤΟ ΑΠΟΤΕΛΕΣΜΑ — κλειστό σύνολο, χωρίς σιωπηλό `default`
// =============================================================================

export type CapabilityTransitionResult =
  | { readonly kind: 'applied'; readonly status: CapabilityStatus }
  /** Η μετάβαση **δεν** επιτρέπεται από την κατάσταση που βρέθηκε. */
  | { readonly kind: 'illegal-transition'; readonly from: CapabilityStatus }
  /** Ο οργανισμός δεν υπάρχει — *«δεν υπάρχει **για σένα**»*. */
  | { readonly kind: 'absent' }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * Από πού **επιτρέπεται** να ξεκινήσει κάθε μετάβαση.
 *
 * 🔴 **`Record<…>` πάνω στο κλειστό σύνολο** ⇒ μια πέμπτη κατάσταση δεν
 * μεταγλωττίζεται μέχρι κάποιος να πει αν δηλώνεται/εγκρίνεται/ανακαλείται από εκεί.
 *
 * | Μετάβαση | Από | Γιατί |
 * |---|---|---|
 * | **δήλωση** | `unrequested` · `revoked` | ένα ανακληθέν γραφείο **δικαιούται** να ξαναδηλώσει — αλλιώς η ανάκληση θα ήταν ισόβια |
 * | **δήλωση** ⛔ `pending` | — | δεύτερη δήλωση πάνω σε εκκρεμή θα **έσβηνε** την πρώτη μαζί με τη στιγμή της |
 * | **δήλωση** ⛔ `active` | — | δεν υπάρχει τι να ζητηθεί· θα ήταν σιωπηλή υποβάθμιση σε `pending` |
 * | **έγκριση** | `pending` **μόνο** | 🔴 έγκριση από `unrequested` σημαίνει **ενεργοποίηση χωρίς δήλωση** — ακριβώς ό,τι ο Ν. 4072 απαγορεύει |
 * | **ανάκληση** | `pending` · `active` | ανακαλείς ό,τι δόθηκε **ή** ό,τι ζητήθηκε |
 */
const ALLOWED_FROM = {
  declare: ['unrequested', 'revoked'],
  approve: ['pending'],
  revoke: ['pending', 'active'],
} as const satisfies Record<string, readonly CapabilityStatus[]>;

// =============================================================================
// Η ΓΡΑΦΗ — μία διατύπωση
// =============================================================================

/**
 * **Πράξη που ΟΦΕΙΛΕΙ να ολοκληρωθεί ΠΡΙΝ γραφτεί η νέα κατάσταση.**
 *
 * Επιστρέφει `null` όταν πέτυχε, ή **γιατί** απέτυχε — ποτέ `boolean`: μια αποτυχία
 * που μπλοκάρει ρυθμιστική απόφαση οφείλει να λέει τι έφταιξε.
 *
 * 🔴 **ΓΙΑΤΙ ΠΡΙΝ ΚΑΙ ΟΧΙ ΜΕΤΑ — ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΑΝΤΙΦΑΣΚΕΙ ΜΕ ΤΟ «ΠΡΩΤΑ Η ΑΛΗΘΕΙΑ»**
 *
 * Το συμβόλαιο *«πρώτα η απόφαση, μετά το παράγωγο»* (σάρωση αγγελιών,
 * `agency-listings-sweep.service.ts`) υπάρχει επειδή εκείνο το παράγωγο **δημοσιεύει**:
 * γραμμένο πρώτο, μια αστοχία θα άφηνε δημόσια αγγελία που **καμία** απόφαση δεν
 * στηρίζει.
 *
 * Ένα παράγωγο **διαγραφής** έχει την **αντίθετη** ασυμμετρία, και γι' αυτό αντιστρέφει
 * τη σειρά:
 *
 * | Σειρά | Αν αποτύχει το παράγωγο | Κατάσταση κόσμου |
 * |---|---|---|
 * | γραφή → διαγραφή | κατάσταση `revoked`, βιτρίνα **ζωντανή** | 🔴 γραφείο διαφημίζεται με **ανύπαρκτη άδεια** |
 * | **διαγραφή → γραφή** | κατάσταση `active`, βιτρίνα **σβηστή** | ✅ γραφείο **που δεν δημοσίευσε** — νόμιμη, συνηθισμένη κατάσταση |
 *
 * 🔑 **ΚΑΙ ΤΟ ΑΠΟΦΑΣΙΣΤΙΚΟ: Η ΕΠΙΣΚΕΥΗ.** Με τη σειρά «γραφή → διαγραφή», μια αστοχία
 * είναι **αδιόρθωτη από την ίδια πόρτα**: η κατάσταση έγινε ήδη `revoked`, και το
 * `ALLOWED_FROM.revoke` **δεν** περιλαμβάνει το `revoked` ⇒ δεύτερο πάτημα απαντά
 * `illegal-transition` (409) και **δεν ξαναδοκιμάζει ποτέ** τη διαγραφή. Με τη σειρά
 * αντεστραμμένη, η αποτυχία αφήνει την κατάσταση **ως είχε** και το ίδιο κουμπί
 * δουλεύει ξανά. *Φρουρός που κάνει τη θεραπεία αδύνατη είναι το σχήμα του
 * `provisionWorkspace` (ADR-787 §5.1) — εδώ αποφεύγεται από τη σειρά, όχι από σχόλιο.*
 *
 * ⚠️ **Fail-closed, εν γνώσει μας**: αποτυχία εδώ **ματαιώνει** τη ρυθμιστική απόφαση.
 * Είναι το σωστό πρόσημο — ανάκληση που αφήνει το γραφείο στον κατάλογο είναι
 * χειρότερη από ανάκληση που αποτυγχάνει **θορυβωδώς** και ξαναπατιέται.
 */
type BeforeWrite = () => Promise<string | null>;

/**
 * **Το ίχνος** — χωριστά, γιατί είναι **παράγωγο** και ποτέ δεν ρίχνει τη μετάβαση.
 *
 * ⚠️ Τρέχει **ΜΕΤΑ** τη γραφή: αν αποτύχει, η απόφαση **έχει ήδη ισχύ** και δεν
 * επιτρέπεται να ακυρωθεί επειδή δεν γράφτηκε η σημείωσή της. Η `recordChange`
 * καταπίνει η ίδια τα σφάλματά της (επιστρέφει `null`).
 */
function recordTransition(
  companyId: string,
  performedBy: string,
  from: CapabilityStatus,
  to: CapabilityStatus,
): Promise<string | null> {
  return EntityAuditService.recordChange({
    // ⚠️ **Το λεξιλόγιο από το SSoT** (`ENTITY_TYPES`, CHECK 3.7): η κυριολεξία
    //    `'company'` εδώ θα ήταν δεύτερη γραφή του ίδιου ονόματος.
    entityType: ENTITY_TYPES.COMPANY,
    entityId: companyId,
    entityName: null,
    action: 'status_changed',
    changes: [{ field: capabilityStatusFieldPath(CAPABILITY), oldValue: from, newValue: to }],
    performedBy,
    performedByName: null,
    companyId,
  });
}

async function transition(
  adminDb: AdminFirestore,
  companyId: string,
  /**
   * **Ποιος το έκανε** — υποχρεωτικό όρισμα, ποτέ προαιρετικό (ADR-195, CHECK 3.17).
   *
   * 🔴 Μια μετάβαση **ρυθμιζόμενης** ικανότητας είναι ακριβώς το γεγονός για το
   * οποίο υπάρχει το ίχνος ελέγχου: την ημέρα που ρωτήσει επιμελητήριο *«ποιος
   * ενέκρινε αυτό το γραφείο και πότε;»*, το `logger.info` **δεν είναι απάντηση**.
   * Το `decidedByUserId` του εγγράφου κρατά **μόνο την τελευταία** τιμή· το ίχνος
   * κρατά **τη σειρά**.
   */
  performedBy: string,
  allowedFrom: readonly CapabilityStatus[],
  next: (current: OrganizationCapabilityRecord | undefined) => OrganizationCapabilityRecord,
  /** Δες {@link BeforeWrite}. Απών ⇒ η μετάβαση δεν έχει παράγωγο διαγραφής. */
  beforeWrite?: BeforeWrite,
): Promise<CapabilityTransitionResult> {
  const ref = adminDb.collection(COLLECTIONS.COMPANIES).doc(companyId);

  try {
    const snapshot = await ref.get();
    if (!snapshot.exists) return { kind: 'absent' };

    const capabilities = (snapshot.data() as { capabilities?: OrganizationCapabilities } | undefined)
      ?.capabilities;
    const from = capabilityStatusOf(capabilities, CAPABILITY);

    if (!allowedFrom.includes(from)) return { kind: 'illegal-transition', from };

    // 🔴 **ΜΕΤΑ τη νομιμότητα, ΠΡΙΝ τη γραφή** — και οι δύο θέσεις είναι απαραίτητες.
    //    *Μετά*: μια παράνομη μετάβαση δεν επιτρέπεται να σβήσει τίποτα — αλλιώς ένα
    //    απορριφθέν πάτημα θα είχε **παρενέργεια**. *Πριν*: δες {@link BeforeWrite}.
    const failure = await beforeWrite?.();
    if (failure !== undefined && failure !== null) {
      logger.error('Το παράγωγο ΜΑΤΑΙΩΣΕ τη μετάβαση — η κατάσταση ΜΕΝΕΙ ΩΣ ΕΙΧΕ', {
        data: { companyId, capability: CAPABILITY, from },
        error: failure,
      });
      return { kind: 'failed', message: failure };
    }

    const record = next(capabilities?.[CAPABILITY]);

    // ⚠️ **`update` με μονοπάτι πεδίου, ΠΟΤΕ `set` ολόκληρου εγγράφου.** Το
    //    `companies/{id}` κουβαλά `settings`, `orgStructure`, `plan` — ένα ολικό `set`
    //    από εδώ θα τα έσβηνε, και ο γραφέας αυτού του αρχείου **δεν τα ξέρει καν**.
    await ref.update({ [`capabilities.${CAPABILITY}`]: record });

    logger.info('Μετάβαση ικανότητας οργανισμού', {
      data: { companyId, capability: CAPABILITY, from, to: record.status },
    });

    await recordTransition(companyId, performedBy, from, record.status);

    return { kind: 'applied', status: record.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Η μετάβαση ικανότητας απέτυχε', { data: { companyId }, error: message });
    return { kind: 'failed', message };
  }
}

// =============================================================================
// ΟΙ ΤΡΕΙΣ ΠΡΑΞΕΙΣ
// =============================================================================

/**
 * **Ο ιδρυτής δηλώνει μεσιτική δραστηριότητα** → `pending`.
 *
 * 🔴 **ΔΕΝ γίνεται `active`, και αυτό είναι όλο το νόημα.** Απορρίφθηκε **ρητά** το
 * «μόνο δήλωση, χωρίς έγκριση» (ADR-824 §5.3): ο Ν. 4072 κάνει τη μεσιτεία **χωρίς
 * εγγραφή παράνομη**, και πλατφόρμα που ενεργοποιεί ρυθμιζόμενη δραστηριότητα με
 * **αυτοδήλωση** αναλαμβάνει το ρίσκο η ίδια.
 */
export function declareBrokerage(
  adminDb: AdminFirestore,
  companyId: string,
  declaration: BrokerageDeclaration,
): Promise<CapabilityTransitionResult> {
  return transition(adminDb, companyId, declaration.declaredByUserId, ALLOWED_FROM.declare, () => ({
    status: 'pending',
    requirements: [PENDING_REQUIREMENT],
    declaration,
    decidedByUserId: null,
    decidedAt: null,
    // ⚠️ Ο παλιός λόγος ανάκλησης **σβήνεται** στη νέα δήλωση: αφορούσε τον
    //    προηγούμενο κύκλο, και κρατημένος θα εμφανιζόταν δίπλα σε εκκρεμή αίτηση.
    revocationReason: null,
  }));
}

/** **Ο υπερδιαχειριστής εγκρίνει** → `active`. Μόνο από `pending`. */
export function approveBrokerage(
  adminDb: AdminFirestore,
  companyId: string,
  decidedByUserId: string,
): Promise<CapabilityTransitionResult> {
  return transition(adminDb, companyId, decidedByUserId, ALLOWED_FROM.approve, (current) => ({
    status: 'active',
    requirements: [],
    declaration: current?.declaration ?? null,
    decidedByUserId,
    decidedAt: nowISO(),
    revocationReason: null,
  }));
}

/**
 * **Ο υπερδιαχειριστής ανακαλεί** → `revoked`, **με γραμμένο λόγο**.
 *
 * ⚠️ **ΔΕΝ επιστρέφει σε `unrequested`**: *«δεν ζήτησε ποτέ»* και *«του το πήραμε»*
 * είναι διαφορετικά γεγονότα με **διαφορετική θεραπεία στην οθόνη**.
 *
 * ⚠️ **Η δήλωση ΔΙΑΤΗΡΕΙΤΑΙ**: χωρίς αυτήν, ένα ανακληθέν γραφείο δεν θα μπορούσε να
 * απαντήσει *«τι είχα δηλώσει;»* — και ο ρυθμιστικός φάκελος θα έσβηνε μαζί με το
 * δικαίωμα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ Π2 ΖΕΙ **ΕΔΩ** — ΚΑΙ ΜΕΧΡΙ ΤΙΣ 2026-08-29 ΔΕΝ ΤΟ ΚΑΛΟΥΣΕ ΚΑΝΕΙΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το αμετάβλητο **Π2** του ADR-827 §9.10 — *«`active` που παύει ⇒ το προφίλ παύει να
 * υπάρχει»* — ήταν γραμμένο και τεκμηριωμένο στο
 * {@link withdrawAgencyProfile}, και **καμία διαδρομή δεν το εκτελούσε**: ακριβώς το
 * σχήμα *«σχόλιο που μοιάζει με έλεγχο»* που μετρά το ADR-749 §5.
 *
 * ⚠️ **Ήταν ακίνδυνο μόνο όσο δεν υπήρχε οθόνη δημοσίευσης** — δηλαδή όσο δεν υπήρχε
 * προφίλ να μείνει ορφανό. Η στιγμή που ανοίγει η βιτρίνα είναι η στιγμή που ένα
 * ανακληθέν γραφείο θα συνέχιζε να **διαφημίζεται στον κατάλογο με ανύπαρκτη άδεια**.
 *
 * 🔑 **ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΗ ΔΙΑΔΡΟΜΗ** *(όπου ζει η σάρωση αγγελιών)*: η ανάκληση της
 * ικανότητας είναι η **μόνη** μετάβαση που βγαίνει από το `active`. Δεμένο στη
 * **μετάβαση**, το Π2 ισχύει και για τη διαδρομή που **δεν έχει γραφτεί ακόμη**·
 * δεμένο στη διαδρομή, θα ξεχνιόταν την πρώτη φορά που θα γεννιόταν δεύτερη.
 *
 * ⚠️ **Και ΔΕΝ επαναφέρεται στην επανέγκριση — επίτηδες.** Οι αγγελίες επανέρχονται
 * αυτόματα γιατί ανήκουν στον **ιδιοκτήτη**, αθώο τρίτο που δεν έφταιξε σε τίποτα. Η
 * βιτρίνα ανήκει στο **γραφείο** και *η παρουσία της ΕΙΝΑΙ η συγκατάθεση* (§9.10): η
 * αυτόματη επαναδημοσίευση θα δημοσίευε οργανισμό **που δεν το ξαναζήτησε**. Το
 * γραφείο ξαναδηλώνει — και αυτή η δεύτερη πράξη είναι το νόημα.
 */
export function revokeBrokerage(
  adminDb: AdminFirestore,
  companyId: string,
  decidedByUserId: string,
  reason: string,
): Promise<CapabilityTransitionResult> {
  return transition(
    adminDb,
    companyId,
    decidedByUserId,
    ALLOWED_FROM.revoke,
    (current) => ({
      status: 'revoked',
      requirements: [],
      declaration: current?.declaration ?? null,
      decidedByUserId,
      decidedAt: nowISO(),
      revocationReason: reason,
    }),
    // 🔴 **Π2** — δες {@link BeforeWrite} για το γιατί τρέχει **πριν** τη γραφή.
    //    Ιδεμποτής: γραφείο που ποτέ δεν δημοσιεύτηκε επιστρέφει `withdrawn` το ίδιο.
    async () => {
      const outcome = await withdrawAgencyProfile(adminDb, companyId);
      return outcome.kind === 'withdrawn' ? null : 'AGENCY_PROFILE_WITHDRAWAL_FAILED';
    },
  );
}
