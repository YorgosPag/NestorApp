'use client';

/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΙΚΑΝΟΤΗΤΑΣ, ΖΩΝΤΑΝΑ** — για την οθόνη, ποτέ ως φρουρός.
 * @related ADR-824 §8 Κ5 · ADR-824 §12.8 · lib/auth/brokerage-authority.ts
 * @module services/realtime/hooks/useOrganizationCapability
 *
 * ⛔ **ΔΕΝ ΕΙΝΑΙ Ο ΦΡΟΥΡΟΣ, ΚΑΙ ΔΕΝ ΠΡΕΠΕΙ ΝΑ ΓΙΝΕΙ ΠΟΤΕ.** Ο φρουρός είναι ο τύπος
 * {@link BrokerageAuthority} στον διακομιστή: μια διαδρομή που ξεχνά τον έλεγχο **δεν
 * μεταγλωττίζεται**. Αυτό εδώ απαντά **άλλο** ερώτημα — *«τι να δείξω στον άνθρωπο;»*
 * — και το OWASP το γράφει κατά λέξη: *«Developers must **never** rely on client-side
 * access control checks … they should never be the decisive factor»*.
 *
 * 🔑 **Ζωντανά, όχι εφάπαξ**: μια ανάκληση την ώρα που ο μεσίτης συμπληρώνει τη φόρμα
 * οφείλει να φανεί **αμέσως** — αλλιώς θα πατούσε «Αποθήκευση» και θα έπαιρνε 403 από
 * πόρτα που πριν από ένα λεπτό ήταν ανοιχτή. Ίδιο ιδίωμα με το `usePublicListing`.
 *
 * 🔴 **Κάθε αστοχία ⇒ `unrequested`, δηλαδή «μη διαθέσιμο».** Fail-closed **και στην
 * οθόνη**: το χειρότερο που μπορεί να κάνει είναι να κρύψει μια δυνατότητα που
 * υπάρχει — ποτέ να προσφέρει μία που δεν υπάρχει.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΜΙΑ ΣΥΝΔΡΟΜΗ, ΔΥΟ ΚΑΤΑΝΑΛΩΤΕΣ (ADR-824 §12.8)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Δύο οθόνες ρωτούν σήμερα: η **φόρμα** ρωτά για **μία** ικανότητα (Κ5), το **μενού**
 * ρωτά για **όλες** (Φάση 4). Η πρώτη γραφή θα ήταν δύο hooks με δύο `onSnapshot` στο
 * **ίδιο** έγγραφο — δύο μονοπάτια που μπορούν να αποκλίνουν, δηλαδή το σχήμα του
 * ADR-749.
 *
 * Εδώ υπάρχει **ΕΝΑΣ** αναγνώστης ({@link useOrganizationCapabilityView}) και το
 * ερώτημα της μίας ικανότητας **παράγεται** από αυτόν με ευρετηρίαση. Ο παλιός
 * καταναλωτής δεν άλλαξε ούτε γραμμή· άλλαξε **ποιος τον τροφοδοτεί**.
 *
 * 🔑 **Και κλιμακώνει χωρίς hook-μέσα-σε-βρόχο**: μια δεύτερη ικανότητα δεν προσθέτει
 * συνδρομή — το ίδιο στιγμιότυπο κουβαλά **όλο** το `capabilities`.
 */

import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { OrganizationCapabilityView } from '@/config/navigation-capability';
import { db } from '@/lib/firebase';
import { createModuleLogger } from '@/lib/telemetry';
import {
  ORGANIZATION_CAPABILITIES,
  capabilityDisclosureOf,
  capabilityStatusOf,
  type CapabilityDisclosure,
  type CapabilityStatus,
  type OrganizationCapabilities,
  type OrganizationCapability,
} from '@/types/organization-capability';

const logger = createModuleLogger('useOrganizationCapability');

/**
 * **Η προεπιλογή όταν δεν ξέρουμε τίποτα** — κάθε ικανότητα `unrequested`.
 *
 * ⚠️ **Παράγεται από το κλειστό σύνολο, ποτέ γραμμένη στο χέρι.** Ένα χειρόγραφο
 * `{ brokerage_listings: 'unrequested' }` θα έμενε ελλιπές τη μέρα που προστεθεί
 * δεύτερη ικανότητα, και ο τύπος **δεν θα το έπιανε** — γιατί θα ήταν σφάλμα
 * *παράλειψης σε literal*, ακριβώς αυτό που ο `Record` υποτίθεται ότι φυλάει.
 */
function emptyView(): OrganizationCapabilityView {
  return Object.fromEntries(
    ORGANIZATION_CAPABILITIES.map((capability) => [capability, 'unrequested' as const]),
  ) as OrganizationCapabilityView;
}

/**
 * **Ο ολικός χάρτης αποκαλύψεων** — κλειδί για κάθε ικανότητα, τιμή `null` όπου δεν υπάρχει
 * εγγραφή. Δες το {@link disclosuresOf} για το γιατί **ολικός** και όχι `Partial`.
 */
export type OrganizationCapabilityDisclosures = Readonly<
  Record<OrganizationCapability, CapabilityDisclosure | null>
>;

/** **Καμία αποκάλυψη** — η προεπιλογή όταν δεν ξέρουμε τίποτα, ή όταν η ανάγνωση απέτυχε. */
function emptyDisclosures(): OrganizationCapabilityDisclosures {
  return Object.fromEntries(
    ORGANIZATION_CAPABILITIES.map((capability) => [capability, null]),
  ) as OrganizationCapabilityDisclosures;
}

/** Το ωμό έγγραφο → **όλες** οι καταστάσεις, μέσα από τον ΕΝΑ μεταφραστή. */
function viewOf(capabilities: OrganizationCapabilities | undefined): OrganizationCapabilityView {
  return Object.fromEntries(
    ORGANIZATION_CAPABILITIES.map((capability) => [
      capability,
      capabilityStatusOf(capabilities, capability),
    ]),
  ) as OrganizationCapabilityView;
}

/**
 * Το ωμό έγγραφο → **όλες** οι αποκαλύψεις, μέσα από τον ΕΝΑ μεταφραστή.
 *
 * 🔑 **Ολικός χάρτης, όπως και η όψη** — παράγεται από το κλειστό σύνολο, ποτέ γραμμένος στο
 * χέρι. Η **τιμή** μπορεί να είναι `null` *(«κανείς δεν ζήτησε»)*, το **κλειδί** ποτέ: με
 * `Partial` κάθε καταναλωτής θα χρειαζόταν δική του σιωπηλή προεπιλογή για ικανότητα που
 * λείπει — δηλαδή απόφαση παρμένη από τον τύπο αντί για άνθρωπο.
 */
function disclosuresOf(
  capabilities: OrganizationCapabilities | undefined,
): OrganizationCapabilityDisclosures {
  return Object.fromEntries(
    ORGANIZATION_CAPABILITIES.map((capability) => [
      capability,
      capabilityDisclosureOf(capabilities, capability),
    ]),
  ) as OrganizationCapabilityDisclosures;
}

/**
 * **Η ΚΡΙΣΗ ΩΣ ΚΑΘΑΡΗ ΣΥΝΑΡΤΗΣΗ** — ό,τι δημοσιεύει ο αναγνώστης, χωρίς Firestore.
 *
 * ⚠️ Ζει χωριστά **επίτηδες**, με το ίδιο σκεπτικό που δηλώνει ήδη το
 * `use-public-place.test.ts`: *«μέσα σε `useEffect` θα μπορούσε να ελεγχθεί μόνο με
 * προσομοίωση Firestore, δηλαδή σε κόσμο που δεν υπάρχει»*. Έτσι ο χειριστής του
 * στιγμιότυπου μένει **μία κλήση χωρίς λογική**, και η λογική ελέγχεται ολόκληρη.
 */
export function capabilitiesStateOf(
  capabilities: OrganizationCapabilities | undefined,
): OrganizationCapabilitiesState {
  return { view: viewOf(capabilities), disclosures: disclosuresOf(capabilities), settled: true };
}

/**
 * **«Δεν ξέρω ακόμη» — και ΓΙΑΤΙ δεν αρκεί το `unrequested` γι' αυτό.**
 *
 * 🔴 **Fail-closed ΚΑΙ ειλικρίνεια είναι δύο απαιτήσεις, όχι μία.** Όσο δεν έχει έρθει
 * απάντηση, η όψη είναι «όλα `unrequested`» — σωστό για το *«μην προσφέρεις»*, **ψέμα**
 * για το *«τι λες στον άνθρωπο»*: ένα κανονικό, εγκεκριμένο μεσιτικό γραφείο θα έβλεπε
 * για ένα καρέ **«δεν έχεις δηλώσει μεσιτική δραστηριότητα»** σε κάθε φόρτωση.
 *
 * Γι' αυτό η άγνοια ταξιδεύει **χωριστά** από την κατάσταση. Ο καταναλωτής που
 * **κρύβει** (το μενού) δεν χρειάζεται να τη ρωτήσει — η όψη ήδη λέει «μην προσφέρεις».
 * Ο καταναλωτής που **μιλά** (η οθόνη) οφείλει: μέχρι να μάθει, λέει «φορτώνει».
 *
 * ⚠️ **ΜΗΝ το λύσεις με πέμπτη τιμή `CapabilityStatus`.** Το σύνολο των τεσσάρων είναι
 * ο **κύκλος ζωής στη βάση** (ADR-824 §5.2)· το «δεν διάβασα ακόμη» είναι κατάσταση
 * **του πελάτη**. Ανακατεμένα, κάθε `switch` του διακομιστή θα χρειαζόταν κλάδο για
 * τιμή που **δεν γράφεται ποτέ**.
 */
export interface OrganizationCapabilitiesState {
  readonly view: OrganizationCapabilityView;
  /**
   * **ΤΙ ΝΑ ΠΕΙ Η ΟΘΟΝΗ** — για όποιον **μιλά**, ποτέ για όποιον κρύβει.
   *
   * 🔑 **Ταξιδεύει ΧΩΡΙΣΤΑ από την όψη, με το ίδιο σκεπτικό που χωρίζει το `settled`.**
   * Όποιος **κρύβει** (το μενού) ρωτά μόνο το `view`: εκεί κάθε άγνοια και κάθε αστοχία
   * είναι ήδη «μην προσφέρεις». Όποιος **μιλά** (η οθόνη του ιδρυτή) χρειάζεται το
   * *«γιατί»* — και μια ανάκληση χωρίς λόγο είναι σιωπή που δεν διορθώνεται.
   *
   * ⚠️ `null` = **δεν υπάρχει εγγραφή**, ποτέ «δεν ξέρω». Το «δεν ξέρω» είναι το `settled`.
   */
  readonly disclosures: OrganizationCapabilityDisclosures;
  /** `false` = **δεν ξέρω ακόμη**. Ποτέ «δεν ζήτησε». */
  readonly settled: boolean;
}

/**
 * **Η κατάσταση ΟΛΩΝ των ικανοτήτων του οργανισμού, ζωντανά.**
 *
 * @param companyId `null` ⇒ ο άνθρωπος δεν έχει οργανισμό ⇒ όλα `unrequested`, και
 *   **γνωστό αμέσως** (`settled: true`): η απουσία οργανισμού δεν χρειάζεται ανάγνωση.
 */
/**
 * **Η ΣΥΝΔΡΟΜΗ ΚΑΘΑΥΤΗ** — χωριστά από το πώς την κρατά το React.
 *
 * ⚠️ Ζει έξω από το hook ώστε το hook να διαβάζεται ολόκληρο σε μια οθόνη (N.7.1), και
 * ώστε ο **κανόνας** (τι σημαίνει κάθε έκβαση) να μη χάνεται μέσα στην τελετουργία του
 * `useEffect`.
 */
function subscribeToCapabilities(
  tenant: string,
  publish: (state: OrganizationCapabilitiesState) => void,
): () => void {
  // tenant-scope-exempt: ανάγνωση **ενός** εγγράφου κατά ταυτότητα, και ο κανόνας
  // `companies/{id}` απαιτεί ήδη `getUserCompanyId() == companyId` — δεν υπάρχει
  // ερώτημα να φιλτραριστεί.
  return onSnapshot(
    doc(db, COLLECTIONS.COMPANIES, tenant),
    (snapshot) => {
      const capabilities = (
        snapshot.data() as { capabilities?: OrganizationCapabilities } | undefined
      )?.capabilities;
      publish(capabilitiesStateOf(capabilities));
    },
    (error: Error) => {
      logger.error('Οι ικανότητες του οργανισμού δεν διαβάστηκαν — η οθόνη ΚΡΥΒΕΙ', {
        data: { companyId: tenant },
        error: error.message,
      });
      // 🔴 **Αστοχία = ΓΝΩΣΤΟ «όχι», όχι αιώνια άγνοια.** Ένα `settled: false` εδώ θα
      // άφηνε την οθόνη να γυρίζει για πάντα όταν ο κανόνας Firestore αρνείται —
      // δηλαδή θα αντάλλασσε ψέμα με κόλλημα. Fail-closed **και** τερματίζει.
      publish({ view: emptyView(), disclosures: emptyDisclosures(), settled: true });
    },
  );
}

export function useOrganizationCapabilityView(
  companyId: string | null,
): OrganizationCapabilitiesState {
  const [state, setState] = useState<OrganizationCapabilitiesState>(() => ({
    view: emptyView(),
    disclosures: emptyDisclosures(),
    settled: false,
  }));

  useEffect(() => {
    const tenant = companyId?.trim() ?? '';

    if (tenant === '') {
      setState({ view: emptyView(), disclosures: emptyDisclosures(), settled: true });
      return;
    }

    // ⚠️ **Πίσω σε «δεν ξέρω» σε κάθε αλλαγή οργανισμού.** Χωρίς αυτό, μετά από αλλαγή
    // χώρου η οθόνη θα μιλούσε με **βεβαιότητα** για τον προηγούμενο.
    setState({ view: emptyView(), disclosures: emptyDisclosures(), settled: false });

    return subscribeToCapabilities(tenant, setState);
  }, [companyId]);

  return state;
}

/**
 * **Η κατάσταση ΜΙΑΣ ικανότητας του οργανισμού.**
 *
 * 🔑 **Παράγωγο, όχι δεύτερη ανάγνωση** — δες την κεφαλίδα του αρχείου.
 *
 * @param companyId `null` ⇒ ο άνθρωπος δεν έχει οργανισμό ⇒ `unrequested`.
 */
export function useOrganizationCapability(
  companyId: string | null,
  capability: OrganizationCapability,
): CapabilityStatus {
  const { view } = useOrganizationCapabilityView(companyId);
  return useMemo(() => view[capability], [view, capability]);
}

/**
 * **Η ΟΨΗ ΓΙΑ ΤΟΝ ΣΥΝΔΕΔΕΜΕΝΟ ΑΝΘΡΩΠΟ — ΚΑΙ Ο ΕΝΑΣ ΤΟΠΟΣ ΠΟΥ ΞΕΡΕΙ ΓΙΑΤΙ ΤΟ
 * `companyId === null` ΣΗΜΑΙΝΕΙ ΔΥΟ ΠΡΑΓΜΑΤΑ.**
 *
 * 🔴 **ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ, 2026-08-28 — και ήταν ελάττωμα ΔΙΚΟ ΜΟΥ, όχι θεωρία.**
 * Η ακολουθία που κατέγραψε ο ανιχνευτής σε **κάθε** φόρτωση της σελίδας ήταν:
 *
 * ```
 * authLoading=true  hasUser=false  companyId=null   ⇒ settled=true  status=unrequested
 * authLoading=true  hasUser=true   companyId=comp_… ⇒ settled=false
 * authLoading=true  hasUser=true   companyId=comp_… ⇒ settled=true  status=active
 * authLoading=false hasUser=true   companyId=comp_… ⇒ settled=true  status=active
 * ```
 *
 * Δηλαδή ένα **εγκεκριμένο** μεσιτικό γραφείο διάβαζε στην οθόνη *«Το γραφείο σου δεν
 * έχει δηλώσει μεσιτική δραστηριότητα»* για ~1,5 δευτερόλεπτο, **σε κάθε άνοιγμα**,
 * πριν εμφανιστεί ο κατάλογός του. Ο λόγος: το `companyId` φτάνει **αργότερα** από την
 * πρώτη απόδοση, και το `null` της αναμονής είναι **οπτικά ταυτόσημο** με το `null` του
 * ανθρώπου που πράγματι δεν έχει οργανισμό.
 *
 * 🔑 **Το ίδιο το `AuthContext` έχει γραμμένο τον κανόνα** για το αδελφό του πεδίο:
 * *«`null` σημαίνει “δεν ρωτήθηκε ακόμη” (`unknown`), ΠΟΤΕ “δεν έχει”»*. Εδώ
 * επιβάλλεται και για τον οργανισμό, σε **ένα** σημείο.
 *
 * ⚠️ **Γιατί το `authLoading` ΚΑΙ ΟΧΙ το `user !== null`**: μετρήθηκε ότι το
 * `authLoading` γίνεται `false` **τελευταίο** — μετά το `user` και μετά το `companyId`.
 * Είναι δηλαδή το **μόνο** σήμα που, όταν κλείσει, εγγυάται ότι δεν έρχεται άλλη
 * αλλαγή ταυτότητας. Ένα `user !== null` θα άνοιγε το στόμα της οθόνης **νωρίτερα**,
 * δηλαδή θα ξανάφτιαχνε το ίδιο ψέμα σε μικρότερο παράθυρο — και τα παράθυρα αυτά
 * είναι ακριβώς που δεν πιάνει καμία πύλη.
 *
 * ⚠️ **Η ΟΨΗ ΔΕΝ ΑΛΛΑΖΕΙ, ΜΟΝΟ ΤΟ «ΞΕΡΩ»**: όσο η ταυτότητα εκκρεμεί, η όψη μένει
 * *«όλα unrequested»* — άρα όποιος **κρύβει** (το μενού) παίρνει ήδη τη σωστή απάντηση
 * και **δεν χρειάζεται** να ρωτήσει το `settled`. Μόνο όποιος **μιλά** ρωτά.
 */
export function useMyOrganizationCapabilities(): OrganizationCapabilitiesState {
  const { user, loading: authLoading } = useAuth();
  const state = useOrganizationCapabilityView(user?.companyId ?? null);

  return useMemo(
    () =>
      authLoading
        ? { view: state.view, disclosures: state.disclosures, settled: false }
        : state,
    [authLoading, state],
  );
}
