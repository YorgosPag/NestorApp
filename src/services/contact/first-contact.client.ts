/**
 * @fileoverview **Η ΠΡΩΤΗ ΕΠΑΦΗ, ΟΠΩΣ ΤΗΝ ΒΛΕΠΕΙ Η ΟΘΟΝΗ** — μεταφορά, όχι κρίση.
 * @related ADR-843 §10 · services/contact/first-contact.service.ts · first-contact-projection.ts
 * @module services/contact/first-contact.client
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΜΙΑ ΚΡΙΣΗ ΕΔΩ — ΚΑΙ ΕΙΝΑΙ ΤΡΕΙΣ ΞΕΧΩΡΙΣΤΕΣ ΑΠΑΓΟΡΕΥΣΕΙΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | ⛔ Μην το κάνεις εδώ | Γιατί |
 * |---|---|
 * | **χωρητικότητα** *(«απομένουν 3»)* | κρίνεται **μετρώντας** στον διακομιστή· δεύτερος μετρητής θα δεχόταν την ενδέκατη |
 * | **αποκάλυψη** *(«τι βλέπει ο άλλος»)* | είναι το `disclosedToOfferer`, και **οφείλει** να τρέξει στην ίδια πλευρά με τον συνθέτη (§10.5) |
 * | **«γιατί ταιριάζει»** | τα **μεγέθη** δεν φεύγουν ποτέ από τον διακομιστή — ένας πελατικός υπολογισμός θα τα ζητούσε |
 *
 * ⛔ **ΚΑΙ ΟΧΙ `onSnapshot`.** Το `first_contacts` έχει **`read: false`**
 * (`firestore.rules`) ⇒ ζωντανή συνδρομή είναι **δομικά αδύνατη**, όχι απλώς
 * ανεπιθύμητη. Η κατάσταση της οθόνης είναι **διακριτή ένωση** με πηγή `fetch`.
 *
 * ⚠️ **Ο `apiClient` πετά σε μη-2xx**, οπότε κάθε πράξη μεταφράζεται εδώ σε **ρητή
 * ένωση αποτελεσμάτων** — η οθόνη δεν πιάνει εξαιρέσεις.
 */

import { apiClient, apiErrorBodyOf } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import {
  isFirstContactInvariant,
  isFirstContactRejection,
  type FirstContactDeclaration,
  type FirstContactInboxEntry,
  type FirstContactRejection,
} from '@/services/contact/first-contact-vocabulary';
import type { SeekerContactView } from '@/services/contact/first-contact-projection';
import type { FirstContactForSeeker, FirstContactInvariant } from '@/types/first-contact';

const logger = createModuleLogger('first-contact.client');

const CONTACTS_URL = '/api/first-contacts';

// =============================================================================
// 1. Η ΠΡΑΞΗ
// =============================================================================

/**
 * Τι έγινε με την **πρώτη επαφή**.
 *
 * 🔑 Το `opened` κουβαλά `created` **χωρίς να το κρίνει**: `false` σημαίνει *«την
 * είχες ήδη ανοιχτή»* — **επιτυχία**, όχι σφάλμα, και η οθόνη οφείλει να δείξει την
 * πράξη αντί για προειδοποίηση.
 */
export type OpenContactResult =
  | {
      readonly kind: 'opened';
      readonly contact: FirstContactForSeeker;
      readonly created: boolean;
    }
  | { readonly kind: 'refused'; readonly reason: FirstContactRejection }
  /**
   * 🔴 **Η ΠΟΡΤΑ ΑΠΑΝΤΑ ΔΥΟ ΔΙΑΚΡΙΤΑ 422, ΚΑΙ ΤΟ ΔΕΥΤΕΡΟ ΕΛΕΙΠΕ ΑΠΟ ΕΔΩ.**
   *
   * `CONTACT_REFUSED` λέει *«ο κόσμος δεν το επιτρέπει»*· `INVALID_CONTACT` λέει
   * *«λείπει κάτι δικό σου»* — **δύο εντελώς διαφορετικά επόμενα βήματα**, και μόνο το
   * δεύτερο διορθώνεται από τον ίδιο τον άνθρωπο, **εκεί που στέκεται**.
   *
   * ⚠️ **Γιατί δεν ήταν αβλαβής η παράλειψη**: το `first-contact-body.ts` **αρνήθηκε
   * επίτηδες** το `min(1)` στο zod, ώστε το *«γράψε πώς σε λένε»* να ταξιδεύει
   * ονομαστικά (`contact-no-name`) αντί για `MALFORMED_BODY`. Χωρίς αυτό το σκέλος, η
   * θυσία εκείνη **πήγαινε χαμένη**: ο μεταφορέας έριχνε τα αμετάβλητα στο `catch` και
   * η οθόνη έλεγε *«κάτι πήγε στραβά»* σε άνθρωπο που απλώς ξέχασε το όνομά του.
   *
   * 🔑 **Το γειτονικό υποσύστημα έχει σωστά ΕΝΑΝ διακριτή** (`mandate-inbox.client.ts`)
   * — επειδή εκείνη η πόρτα απαντά 422 σε **κάθε** άρνηση επίτηδες (ADR-787 Ε-5). Το
   * σχήμα αντιγράφηκε σε πόρτα με **δύο** προφίλ. Ίδιο σχήμα, άλλος αριθμός.
   */
  | { readonly kind: 'invalid'; readonly violations: readonly FirstContactInvariant[] }
  | { readonly kind: 'failed' };

/**
 * **Πλησίασε.** Ο ζητών κάνει την πρώτη κίνηση (ΠΕ1).
 *
 * ⚠️ **Καμία ταυτότητα χρήστη στο σώμα**: το `seekerUserId` το γράφει ο διακομιστής
 * από την απόδειξη. Δεν υπάρχει πεδίο να ζητήσει κάποιος πράξη στο όνομα άλλου.
 */
export async function openFirstContactFromScreen(
  declaration: FirstContactDeclaration,
): Promise<OpenContactResult> {
  try {
    const body = await apiClient.post<{
      contact: FirstContactForSeeker;
      created: boolean;
    }>(CONTACTS_URL, declaration);
    return { kind: 'opened', contact: body.contact, created: body.created };
  } catch (cause) {
    const reason = refusalOf(cause);
    if (reason !== null) return { kind: 'refused', reason };

    // ⚠️ **Ο δεύτερος διακριτής, και η σειρά δεν έχει σημασία** — τα δύο σχήματα είναι
    //    **ασύνδετα**: `error` είναι ή `CONTACT_REFUSED` ή `INVALID_CONTACT`, ποτέ και τα
    //    δύο. Ελέγχονται διαδοχικά για να μείνει κάθε φρουρός **μία** ερώτηση.
    const violations = invariantViolationsOf(cause);
    if (violations !== null) return { kind: 'invalid', violations };

    logger.error('Η πρώτη επαφή δεν καταγράφηκε', {
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return { kind: 'failed' };
  }
}

/**
 * Ο λόγος άρνησης όπως τον έστειλε ο διακομιστής, ή `null` όταν η αποτυχία ήταν
 * **δικτύου** — δύο πράγματα που η οθόνη πρέπει να πει διαφορετικά.
 *
 * ⚠️ **Ο διακριτής ελέγχεται ΠΡΩΤΟΣ και δεν παρακάμπτεται.** Ένα `reason` χωρίς αυτόν
 * θα σήμαινε ότι διαβάζουμε πεδίο από σχήμα που δεν αναγνωρίσαμε — και ένας άγνωστος
 * κωδικός θα κατέληγε **ωμό κλειδί στην οθόνη**.
 */
function refusalOf(cause: unknown): FirstContactRejection | null {
  const body = apiErrorBodyOf(cause);
  if (body === null || body.error !== 'CONTACT_REFUSED') return null;

  return isFirstContactRejection(body.reason) ? body.reason : null;
}

/**
 * **Ποια αμετάβλητα έσπασαν** — ή `null` όταν η αποτυχία δεν ήταν αυτού του σχήματος.
 *
 * 🔴 **ΤΟ ΦΙΛΤΡΟ ΔΕΝ ΕΙΝΑΙ ΕΥΠΡΕΠΕΙΑ, ΕΙΝΑΙ Ο ΙΔΙΟΣ ΦΡΟΥΡΟΣ ΜΕ ΤΟΥ `refusalOf`**: ένας
 * **άγνωστος** κωδικός αμετάβλητου θα κατέληγε **ωμό κλειδί στην οθόνη** — ακριβώς το
 * περιστατικό ADR-834 §6.5.ε, που ο αδελφός του αποτρέπει ήδη.
 *
 * ⚠️ **ΚΑΙ ΤΟ ΚΕΝΟ ΑΠΟΤΕΛΕΣΜΑ ΕΠΙΣΤΡΕΦΕΙ `null`, ΟΧΙ `[]`** (N.12): πίνακας που
 * **άδειασε επειδή δεν αναγνωρίσαμε κανέναν** θα έλεγε στην οθόνη *«άκυρο, χωρίς
 * λόγο»* — δηλαδή θα παρουσίαζε την **άγνοιά μας** ως πλήρη απάντηση. Ένα `null` το
 * στέλνει στο `failed`, που είναι **αληθές**: δεν μάθαμε τι έφταιξε.
 */
function invariantViolationsOf(cause: unknown): readonly FirstContactInvariant[] | null {
  const body = apiErrorBodyOf(cause);
  if (body === null || body.error !== 'INVALID_CONTACT') return null;
  if (!Array.isArray(body.violations)) return null;

  const known = body.violations.filter(isFirstContactInvariant);
  return known.length > 0 ? known : null;
}

// =============================================================================
// 2. Η ΑΠΟΣΥΡΣΗ (ΠΕ5 + ΠΕ6 — μία πράξη)
// =============================================================================

export type WithdrawContactResult =
  | { readonly kind: 'withdrawn'; readonly contact: FirstContactForSeeker }
  | { readonly kind: 'absent' }
  | { readonly kind: 'failed' };

/**
 * **Απόσυρε.**
 *
 * ⛔ **Η ΟΘΟΝΗ ΠΟΥ ΚΑΛΕΙ ΑΥΤΟ ΔΕΝ ΛΕΕΙ «ΔΙΑΓΡΑΦΟΝΤΑΙ ΤΑ ΣΤΟΙΧΕΙΑ ΣΟΥ»** (Κ10). Λέει
 * **«σταματά η πρόσβαση από εδώ — ό,τι είδε, το είδε»**. Ο άλλος μπορεί να έχει το
 * τηλέφωνο σε χαρτί, και *μια υπόσχεση που δεν μπορούμε να κρατήσουμε είναι χειρότερη
 * από καμία*.
 *
 * 🔑 **Η δεύτερη απόσυρση επιστρέφει `withdrawn` κι αυτή**: το `withdrawn: false` του
 * σώματος λέει μόνο ότι η **σφραγίδα χρόνου δεν μετακινήθηκε** — γεγονός του
 * διακομιστή, όχι απόφαση της οθόνης. Για τον άνθρωπο, η πράξη είναι κλειστή· και οι
 * δύο απαντήσεις σημαίνουν **ακριβώς αυτό**.
 */
export async function withdrawFirstContactFromScreen(
  contactId: string,
): Promise<WithdrawContactResult> {
  try {
    const body = await apiClient.patch<{ contact: FirstContactForSeeker }>(
      `${CONTACTS_URL}/${encodeURIComponent(contactId)}`,
      { lifecycle: 'withdrawn' },
    );
    return { kind: 'withdrawn', contact: body.contact };
  } catch (cause) {
    if (apiErrorBodyOf(cause)?.error === 'CONTACT_ABSENT') return { kind: 'absent' };

    logger.error('Η απόσυρση δεν καταγράφηκε', {
      data: { contactId },
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return { kind: 'failed' };
  }
}

// =============================================================================
// 3. ΟΙ ΔΥΟ ΟΨΕΙΣ — δύο διευθύνσεις, γιατί δύο ακροατήρια
// =============================================================================

export type MyContactsLoad =
  | { readonly kind: 'ready'; readonly view: SeekerContactView }
  | { readonly kind: 'failed' };

/**
 * **Ποιους πλησίασα, και τι μου μένει.**
 *
 * ⚠️ Η **χωρητικότητα έρχεται μαζί**, από την ίδια ανάγνωση. ⛔ **ΜΗΝ** την ξαναμετρήσεις
 * από το `view.contacts` στην οθόνη: δύο μετρητές είναι δύο αριθμοί που μπορούν να
 * διαφωνήσουν, και ο άνθρωπος βλέπει **και τους δύο**.
 */
export async function fetchMyFirstContacts(): Promise<MyContactsLoad> {
  try {
    return { kind: 'ready', view: await apiClient.get<SeekerContactView>(`${CONTACTS_URL}/mine`) };
  } catch (cause) {
    logger.error('Οι επαφές μου δεν φορτώθηκαν', {
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return { kind: 'failed' };
  }
}

export type ContactInboxLoad =
  | { readonly kind: 'ready'; readonly entries: readonly FirstContactInboxEntry[] }
  | { readonly kind: 'failed' };

/**
 * **Ποιοι με πλησίασαν.**
 *
 * ⚠️ **Η ανάγνωση ΣΦΡΑΓΙΖΕΙ** — ο διακομιστής γράφει `seenAt` (write-once) γιατί τα
 * στοιχεία του ζητούντος φαίνονται **δίπλα, χωρίς κλικ** (Κ7 #1): το άνοιγμα της
 * λίστας **είναι** η στιγμή που τα είδες. ⛔ **ΜΗΝ** καλέσεις αυτό για προανάκτηση
 * σε φόντο: θα σφράγιζε πράξεις που **κανείς δεν κοίταξε**, και ο ζητών ρωτά *«το
 * είδε;»* περιμένοντας αλήθεια (Κ10).
 */
export async function fetchFirstContactInbox(): Promise<ContactInboxLoad> {
  try {
    const body = await apiClient.get<{ entries: readonly FirstContactInboxEntry[] }>(
      `${CONTACTS_URL}/inbox`,
    );
    return { kind: 'ready', entries: body.entries };
  } catch (cause) {
    logger.error('Τα εισερχόμενα της πρώτης επαφής δεν φορτώθηκαν', {
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return { kind: 'failed' };
  }
}
