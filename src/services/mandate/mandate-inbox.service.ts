import 'server-only';

/**
 * @fileoverview **ΤΑ ΕΙΣΕΡΧΟΜΕΝΑ ΤΟΥ ΓΡΑΦΕΙΟΥ** — Σ2 (ADR-827 §9.21).
 * @related types/mandate-request.ts · services/mandate/mandate-request.service.ts
 * @module services/mandate/mandate-inbox.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΡΩΤΗΜΑ ΤΟΥ Σ2 ΕΙΝΑΙ *«ΤΙ ΠΡΕΠΕΙ ΝΑ ΚΑΝΩ ΤΩΡΑ;»*, ΟΧΙ *«ΤΙ ΕΧΩ;»*
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Γι' αυτό η απάντηση είναι **ομάδες με σειρά επείγοντος** και όχι λίστα — ίδιο δόγμα
 * με τον κατάλογο εντολών (`mandate-catalog.service.ts`) και με τους κάδους του
 * DocuSign *(Action Required · Waiting · Completed)*.
 *
 * | Ομάδα | Τι είναι | Τι μπορεί να κάνει το γραφείο |
 * |---|---|---|
 * | `actionable` | εκκρεμεί **και** η προτεινόμενη εντολή δεν έχει λήξει | **να αποφασίσει** |
 * | `lapsed` | εκκρεμεί, αλλά η εντολή που προτείνει **έχει ήδη λήξει** | τίποτα — και πρέπει να **το ξέρει** |
 * | `decided` | το έκρινε ήδη | να το θυμάται |
 *
 * 🔴 **ΤΟ `lapsed` ΔΕΝ ΕΙΝΑΙ ΚΟΣΜΗΜΑ, ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ Η ΟΘΟΝΗ ΔΕΝ ΨΕΥΔΕΤΑΙ.** Ένα
 * αίτημα που προτείνει `expiresAt` στο παρελθόν είναι **νεκρό στην άφιξη**: η δεύτερη
 * πόρτα θα το απέρριπτε με `mandate-expiry-past` (§8.10 β). Αν το κρύβαμε, ο μεσίτης
 * θα έβλεπε αίτημα να **εξαφανίζεται** χωρίς εξήγηση — και θα το χρέωνε στο σύστημα.
 * Αν το βάζαμε στα `actionable`, θα του προσφέραμε κουμπί που **ο διακομιστής
 * απορρίπτει**. Ο μόνος ειλικρινής σχεδιασμός είναι η **τρίτη** ομάδα.
 *
 * ⚠️ **ΕΝΑ ΡΟΛΟΪ, ΚΑΙ ΕΙΝΑΙ ΕΔΩ.** Η κρίση *«ζωντανό;»* τρέχει στον **διακομιστή**
 * ({@link isRequestActionable}) και ταξιδεύει έτοιμη — ίδια απόφαση με το
 * `mandate-catalog.client.ts`: δεύτερος υπολογισμός στον πελάτη θα σήμαινε ότι το
 * ρολόι του υπολογιστή του μεσίτη μπορεί να διαφωνήσει με τη βάση.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΡΩΤΗΜΑ ΕΧΕΙ **ΕΝΑ** ΦΙΛΤΡΟ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΠΕΔΙΟ ΜΙΣΘΩΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `where('agencyCompanyId', '==', …)` — τίποτα άλλο. **Δεν** προστίθεται
 * `where('status','==','pending')` παρότι θα μίκραινε το σύνολο: οι **τρεις** ομάδες
 * θέλουν **όλες** τις καταστάσεις, και δύο ερωτήματα για μία οθόνη είναι δύο ταξίδια
 * που μπορούν να δουν **διαφορετική** βάση. Καμία `orderBy` για τον λόγο που γράφει
 * ήδη ο γραφέας του Σ1: σύνθετο ευρετήριο ⇒ νέα υποχρέωση στη **CHECK 3.15**.
 *
 * 🔑 **Το `agencyCompanyId` είναι ΚΑΙ το δηλωμένο πεδίο απομόνωσης** της συλλογής
 * (`tenant-config.ts:123`, **CHECK 3.35**) — άρα το ερώτημα είναι εμβέλειας **εξ
 * ορισμού**, όχι κατά σύμβαση. Και η **προέλευση** της τιμής είναι ο φρουρός: έρχεται
 * από το `ctx.companyId` του `withAuth`, **ποτέ** από το σώμα του αιτήματος.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import {
  isRequestActionable,
  mandateRequestForAgency,
  mandateRequestFromStored,
  readStoredRequestStatus,
  type MandateRequest,
  type MandateRequestDocument,
  type MandateRequestForAgency,
} from '@/types/mandate-request';
import type { PublicListing } from '@/types/public-listing';

const logger = createModuleLogger('mandate-inbox.service');

/**
 * **Πόσα αιτήματα διαβάζονται το πολύ.**
 *
 * ⚠️ Μικρότερο από το `MANDATE_CATALOG_CAP` (500) **επίτηδες**: εκεί κάθε γραμμή είναι
 * ενεργή εντολή που το γραφείο **οφείλει** να βλέπει· εδώ η ουρά είναι εξ ορισμού
 * μικρή, και ένα γραφείο με 200 αιτήματα έχει πρόβλημα ροής, όχι πρόβλημα ορίου.
 */
export const MANDATE_INBOX_CAP = 200;

// =============================================================================
// 1. ΤΙ ΦΕΥΓΕΙ ΠΡΟΣ ΤΗΝ ΟΘΟΝΗ
// =============================================================================

/** Οι τρεις κάδοι, με **σειρά επείγοντος**. */
export interface MandateInboxGroups {
  readonly actionable: readonly MandateRequestForAgency[];
  readonly lapsed: readonly MandateRequestForAgency[];
  readonly decided: readonly MandateRequestForAgency[];
}

/** Τα εισερχόμενα, ολόκληρα. */
export interface MandateInbox {
  readonly groups: MandateInboxGroups;
  /** Πόσα **δεν έχει ανοίξει** κανείς — το κόκκινο σημάδι της πλοήγησης. */
  readonly unseen: number;
  /**
   * 🔴 **Πόσα δείχνουν σε αγγελία ΧΩΡΙΣ δημόσια προβολή** — και γι' αυτό δεν φαίνονται.
   *
   * Ο ιδιοκτήτης απέσυρε την αγγελία **αφού** έστειλε το αίτημα. Δεν υπάρχει τίποτα να
   * δείξουμε *(η προβολή **είναι** το τι βλέπει το γραφείο, §8.2)* και τίποτα να
   * κριθεί. **Αλλά ο αριθμός ταξιδεύει**: μια σιωπηλή εξαφάνιση είναι ακριβώς το
   * σχήμα *«0 = κανείς δεν κοίταξε»* — ο μεσίτης που θυμάται ότι είχε 5 αιτήματα και
   * βλέπει 4 πρέπει να μάθει **γιατί**, όχι να υποθέσει βλάβη.
   */
  readonly withoutListing: number;
  /** Χτυπήθηκε το {@link MANDATE_INBOX_CAP}; — ίδιο συμβόλαιο με τον κατάλογο. */
  readonly truncated: boolean;
}

/** 🔴 **Δεν μάθαμε** ≠ **δεν υπάρχει** (N.12). Ποτέ κενά εισερχόμενα σε βλάβη. */
export type MandateInboxLoad =
  | { readonly kind: 'ready'; readonly inbox: MandateInbox }
  | { readonly kind: 'unavailable' };

// =============================================================================
// 2. Η ΑΝΑΓΝΩΣΗ
// =============================================================================

/**
 * **Τι περιμένει αυτό το γραφείο.**
 *
 * @param nowISO — η **περασμένη** στιγμή· κανένα ρολόι εδώ μέσα, ώστε τα άκρα της
 *   λήξης να είναι δοκιμάσιμα (ίδιο ιδίωμα με `submitMandateRequest`).
 */
export async function readMandateInbox(
  adminDb: AdminFirestore,
  agencyCompanyId: string,
  nowISO: string,
): Promise<MandateInboxLoad> {
  const requests = await readAgencyRequests(adminDb, agencyCompanyId);
  if (requests === null) return { kind: 'unavailable' };

  const listings = await readListingsFor(adminDb, requests.rows);
  if (listings === null) return { kind: 'unavailable' };

  const views = requests.rows
    .map((request) => {
      const listing = listings.get(request.ownerPropertyId);
      return listing === undefined
        ? null
        : { request, view: mandateRequestForAgency(request, listing) };
    })
    .filter((pair): pair is { request: MandateRequest; view: MandateRequestForAgency } => pair !== null);

  return {
    kind: 'ready',
    inbox: {
      groups: groupByUrgency(views, nowISO),
      unseen: views.filter((pair) => pair.view.seenAt === null).length,
      withoutListing: requests.rows.length - views.length,
      truncated: requests.truncated,
    },
  };
}

/** Ό,τι διάβασε η **μία** σάρωση: τα αιτήματα του γραφείου, και αν κόπηκαν. */
interface AgencyRequests {
  readonly rows: readonly MandateRequest[];
  readonly truncated: boolean;
}

/**
 * **Η μία σάρωση** — και ο μοναδικός τόπος όπου ονομάζεται η εμβέλεια.
 *
 * @returns `null` **μόνο** σε βλάβη — ποτέ κενός πίνακας ως «δεν ξέρω» (N.12).
 */
async function readAgencyRequests(
  adminDb: AdminFirestore,
  agencyCompanyId: string,
): Promise<AgencyRequests | null> {
  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.MANDATE_REQUESTS)
      .where('agencyCompanyId', '==', agencyCompanyId)
      .limit(MANDATE_INBOX_CAP + 1)
      .get();

    const truncated = snapshot.size > MANDATE_INBOX_CAP;
    if (truncated) {
      logger.warn('Τα εισερχόμενα αιτήματα χτύπησαν το όριο ανάγνωσης', {
        data: { agencyCompanyId, cap: MANDATE_INBOX_CAP },
      });
    }

    return {
      rows: snapshot.docs.slice(0, MANDATE_INBOX_CAP).map((doc) => readRow(doc.id, doc.data())),
      truncated,
    };
  } catch (error) {
    logger.error('[MANDATE-INBOX] Η ανάγνωση των αιτημάτων απέτυχε — άγνωστο, όχι κενό', {
      agencyCompanyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Ένα ωμό έγγραφο → αίτημα, με **την επισκευή ειπωμένη**.
 *
 * 🔑 Ο **ίδιος** μεταφραστής με τον γραφέα του Σ1 (`mandateRequestFromStored`): δύο
 * αναγνώστες που διάβαζαν αλλιώς το κληροδότημα θα έδειχναν στον μεσίτη «όχι» που ο
 * κριτής δεν αναγνωρίζει.
 */
function readRow(id: string, data: unknown): MandateRequest {
  const stored = data as MandateRequestDocument;
  if (readStoredRequestStatus(stored.status).repaired === 'unreadable') {
    logger.error('[MANDATE-INBOX] Αίτημα με ΜΗ ΑΝΑΓΝΩΣΙΜΗ κατάσταση — δείχνεται ως τελικό όχι', {
      requestId: id,
      storedStatus: String(stored.status),
    });
  }
  return mandateRequestFromStored(stored);
}

/**
 * **Οι δημόσιες προβολές των αγγελιών, σε ΕΝΑ ταξίδι.**
 *
 * 🔴 **ΔΙΑΒΑΖΕΤΑΙ Η `public_listings`, ΠΟΤΕ ΤΟ ΩΜΟ `owner_properties`** (§8.2). Το
 * ωμό έγγραφο κουβαλά `authorUserId`, διεύθυνση ακριβείας και ό,τι άλλο ο ιδιοκτήτης
 * δεν δημοσίευσε· η προβολή είναι **ακριβώς ό,τι βλέπει ο κόσμος**. Και δεν
 * ξανασυντίθεται εδώ: την **γράφει** ο `writeListingProjection`, οπότε μια δεύτερη
 * σύνθεση θα ήταν δεύτερη μηχανή για το ίδιο έγγραφο (ADR-749).
 *
 * ⚠️ **`getAll` και όχι N αναγνώσεις**: το Admin SDK το εκθέτει στη ρίζα ακριβώς γι'
 * αυτό, και ο κατάλογος εντολών το χρησιμοποιεί ήδη για τα ονόματα των πελατών.
 *
 * @returns `null` **μόνο** σε βλάβη. Έγγραφο που **δεν υπάρχει** δεν είναι βλάβη —
 *   λείπει από τον χάρτη, και ο καλών το μετρά ως {@link MandateInbox.withoutListing}.
 */
async function readListingsFor(
  adminDb: AdminFirestore,
  requests: readonly MandateRequest[],
): Promise<Map<string, PublicListing> | null> {
  const ids = [...new Set(requests.map((request) => request.ownerPropertyId))];
  if (ids.length === 0) return new Map();

  try {
    const snapshots = await adminDb.getAll(
      ...ids.map((id) => adminDb.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(id)),
    );

    const found = new Map<string, PublicListing>();
    snapshots.forEach((snapshot, index) => {
      const data = snapshot.data();
      if (data !== undefined) {
        found.set(ids[index], { ...(data as PublicListing), id: ids[index] });
      }
    });
    return found;
  } catch (error) {
    logger.error('[MANDATE-INBOX] Η ανάγνωση των δημόσιων προβολών απέτυχε', {
      count: ids.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// =============================================================================
// 3. Η ΚΑΤΑΤΑΞΗ — τι πρέπει να γίνει ΤΩΡΑ
// =============================================================================

interface Pair {
  readonly request: MandateRequest;
  readonly view: MandateRequestForAgency;
}

/**
 * **Οι τρεις κάδοι, ταξινομημένοι.**
 *
 * 🔑 **Τα `actionable` ταξινομούνται κατά ΛΗΞΗ, όχι κατά άφιξη** — και αυτό είναι η
 * διαφορά ανάμεσα σε λίστα και σε οθόνη τριάζ. Το αίτημα που **πεθαίνει αύριο** πρέπει
 * να κριθεί σήμερα, ακόμη κι αν ήρθε τελευταίο. Μια ταξινόμηση κατά `requestedAt` θα
 * έθαβε ακριβώς εκείνο που δεν αντέχει αναμονή.
 *
 * ⚠️ Τα `lapsed` και τα `decided` πάνε **αντίστροφα** (πιο πρόσφατο πρώτα): εκεί δεν
 * υπάρχει προθεσμία να τηρηθεί — υπάρχει **μνήμη** να ανακληθεί, και η μνήμη ρωτιέται
 * από το πρόσφατο προς το παλιό.
 */
function groupByUrgency(pairs: readonly Pair[], nowISO: string): MandateInboxGroups {
  const pending = pairs.filter((pair) => pair.request.status === 'pending');

  const actionable = pending.filter((pair) => isRequestActionable(pair.request, nowISO));
  const lapsed = pending.filter((pair) => !isRequestActionable(pair.request, nowISO));
  const decided = pairs.filter((pair) => pair.request.status !== 'pending');

  return {
    actionable: actionable
      .slice()
      .sort((a, b) => compareISO(a.view.terms.expiresAt, b.view.terms.expiresAt))
      .map((pair) => pair.view),
    lapsed: lapsed
      .slice()
      .sort((a, b) => compareISO(b.view.requestedAt, a.view.requestedAt))
      .map((pair) => pair.view),
    decided: decided
      .slice()
      .sort((a, b) => compareISO(b.view.decidedAt ?? '', a.view.decidedAt ?? ''))
      .map((pair) => pair.view),
  };
}

/**
 * **Σύγκριση ISO στιγμών, με το άγνωστο ΣΤΟ ΤΕΛΟΣ.**
 *
 * ⚠️ Ένα `Date.parse` που δίνει `NaN` κάνει **κάθε** σύγκριση `false` ⇒ η `sort`
 * αφήνει το χαλασμένο **εκεί που το βρήκε** — δηλαδή μπορεί να καθίσει **πρώτο** στην
 * οθόνη τριάζ. Ίδιο μάθημα με το `Ζ3`: το άγνωστο δεν αντιμετωπίζεται σιωπηλά.
 */
function compareISO(left: string, right: string): number {
  const a = Date.parse(left);
  const b = Date.parse(right);
  if (Number.isNaN(a)) return Number.isNaN(b) ? 0 : 1;
  if (Number.isNaN(b)) return -1;
  return a - b;
}

// =============================================================================
// 4. ΕΝΑ ΑΙΤΗΜΑ — Η ΛΕΠΤΟΜΕΡΕΙΑ, ΚΑΙ Η ΣΦΡΑΓΙΔΑ «ΤΟ ΕΙΔΑ»
// =============================================================================

/** Τι απέγινε το άνοιγμα **ενός** αιτήματος. */
export type MandateRequestLoad =
  | { readonly kind: 'ready'; readonly request: MandateRequestForAgency }
  /** Δεν υπάρχει — **ή δεν είναι δικό σου**. Ποτέ χωριστά (§9.4). */
  | { readonly kind: 'absent' }
  /** Υπάρχει, αλλά η αγγελία του **δεν έχει πια δημόσια προβολή**. */
  | { readonly kind: 'listing-withdrawn' }
  | { readonly kind: 'unavailable' };

/**
 * **Το γραφείο ανοίγει ΕΝΑ αίτημα** — και η σφραγίδα «το είδα» μπαίνει εδώ.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 «ΔΕΝ ΥΠΑΡΧΕΙ» ΚΑΙ «ΔΕΝ ΕΙΝΑΙ ΔΙΚΟ ΣΟΥ» ΑΠΑΝΤΟΥΝ **ΤΑΥΤΟΣΗΜΑ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα ξεχωριστό `403` θα **επιβεβαίωνε την ύπαρξη** ξένου εγγράφου — και εδώ «ξένο
 * έγγραφο» σημαίνει *«υπάρχει αίτημα ανάθεσης με αυτό το αναγνωριστικό»*, δηλαδή
 * κανάλι απαρίθμησης προς ανταγωνιστή. Ίδιο ιδίωμα με το `loadOwnListing` του Σ1.
 *
 * 🔑 **Ο φρουρός είναι ΠΕΔΙΟ ΤΟΥ ΕΓΓΡΑΦΟΥ, όχι ερώτημα**: διαβάζουμε κατ' ευθείαν το
 * `doc(requestId)` και συγκρίνουμε το `agencyCompanyId` του **με αυτό που απέδειξε ο
 * καλών**. Ένα `where()` θα ήταν δεύτερος δρόμος προς την ίδια απάντηση, ακριβότερος.
 */
export async function readAgencyRequest(
  adminDb: AdminFirestore,
  requestId: string,
  agencyCompanyId: string,
  nowISO: string,
): Promise<MandateRequestLoad> {
  let stored: MandateRequest;
  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.MANDATE_REQUESTS)
      .doc(requestId)
      .get();

    const data = snapshot.data();
    if (data === undefined) return { kind: 'absent' };

    stored = readRow(snapshot.id, data);
    if (stored.agencyCompanyId !== agencyCompanyId) return { kind: 'absent' };
  } catch (error) {
    logger.error('[MANDATE-INBOX] Η ανάγνωση του αιτήματος απέτυχε — άγνωστο, όχι κενό', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'unavailable' };
  }

  const listings = await readListingsFor(adminDb, [stored]);
  if (listings === null) return { kind: 'unavailable' };

  const listing = listings.get(stored.ownerPropertyId);
  if (listing === undefined) return { kind: 'listing-withdrawn' };

  // 🔴 **Η ΣΦΡΑΓΙΔΑ ΜΠΑΙΝΕΙ ΜΕΤΑ ΤΗΝ ΕΠΙΤΥΧΗ ΣΥΝΘΕΣΗ, ΚΑΙ ΤΟ `await` ΕΙΝΑΙ ΣΚΟΠΙΜΟ**:
  //    η προβολή που επιστρέφεται πρέπει να λέει την **ίδια** αλήθεια με τη βάση. Ένα
  //    fire-and-forget θα γύριζε `seenAt: null` για αίτημα που μόλις σφραγίστηκε, και
  //    η οθόνη θα το έδειχνε «νέο» μέχρι την επόμενη φόρτωση.
  const seenAt = await stampSeen(adminDb, stored, nowISO);
  return { kind: 'ready', request: mandateRequestForAgency({ ...stored, seenAt }, listing) };
}

/**
 * **Σφραγίζει το `seenAt` — ΜΙΑ φορά.**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΙΔΕΜΠΟΤΕΝΤ ΕΚ ΣΧΕΔΙΑΣΜΟΥ, ΟΧΙ ΜΕ ΚΛΕΙΔΩΜΑ — ΤΟ ΙΔΙΩΜΑ ΤΟΥ `markMandateViewed`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Γράφει **μόνο** όταν το `seenAt` είναι `null` ⇒ δεύτερη κλήση δεν αλλάζει τίποτα.
 * Έτσι η διπλή απόδοση της React, ένα refresh ή μια προανάκτηση είναι **αβλαβή** —
 * χωρίς κλείδωμα και χωρίς δεύτερο βιβλίο. **Η πρώτη ματιά είναι το γεγονός**· η
 * δέκατη δεν αλλάζει καμία απόφαση και θα έκανε κάθε φόρτωση σελίδας εγγραφή.
 *
 * ⚠️ **Δεν πετά ΠΟΤΕ.** Είναι **παρατήρηση**, όχι πράξη του ανθρώπου: μια αποτυχία εδώ
 * δεν επιτρέπεται να εμποδίσει τον μεσίτη να **δει** και να **κρίνει** το αίτημα.
 * Καταγράφεται και προσπερνιέται — και η επιστρεφόμενη τιμή μένει `null`, δηλαδή η
 * οθόνη λέει την **αλήθεια της βάσης**, όχι την πρόθεσή μας.
 *
 * ⛔ **ΜΗΝ το κάνεις `update({ seenAt })` χωρίς τον έλεγχο**: θα μετακινούσε τη
 * σφραγίδα σε κάθε άνοιγμα, και το *«πόσο γρήγορα απαντά αυτό το γραφείο;»* — που
 * είναι η μόνη χρήση του πεδίου — θα μετρούσε πάντα **μηδέν**.
 */
async function stampSeen(
  adminDb: AdminFirestore,
  request: MandateRequest,
  nowISO: string,
): Promise<string | null> {
  if (request.seenAt !== null) return request.seenAt;

  try {
    await adminDb
      .collection(COLLECTIONS.MANDATE_REQUESTS)
      .doc(request.id)
      .update({ seenAt: nowISO });
    return nowISO;
  } catch (error) {
    logger.error('[MANDATE-INBOX] Η σφραγίδα «το είδα» δεν γράφτηκε', {
      requestId: request.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
