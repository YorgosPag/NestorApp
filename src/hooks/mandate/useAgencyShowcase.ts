'use client';

/**
 * @fileoverview **Η ΒΙΤΡΙΝΑ ΤΟΥ ΓΡΑΦΕΙΟΥ, ΖΩΝΤΑΝΑ** — διαβάζει ο πελάτης, γράφει ο διακομιστής.
 * @related ADR-827 §9.10 · §9.13 · app/api/agency-profile/route.ts
 * @module hooks/mandate/useAgencyShowcase
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ Η ΑΝΑΓΝΩΣΗ ΕΙΝΑΙ ΑΠΕΥΘΕΙΑΣ ΚΑΙ Η ΓΡΑΦΗ ΟΧΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `agency_profiles` είναι **`read: true` / `write: false`**. Δεν είναι ασυμμετρία από
 * αμέλεια — είναι όλο το §9.5: *«η απομόνωση επιτυγχάνεται με **ΤΟ ΤΙ ΓΡΑΦΕΤΑΙ**»*. Η
 * βιτρίνα υπάρχει **για να φαίνεται**, άρα η ανάγνωση δεν χρειάζεται πόρτα· η γραφή
 * απαιτεί **απόδειξη μεσιτικής ικανότητας**, που ο φυλλομετρητής **δεν μπορεί** να
 * κατασκευάσει.
 *
 * 🔑 **Και η ίδια η οθόνη διαβάζει ό,τι διαβάζει ΚΑΙ Ο ΠΕΛΑΤΗΣ** — το ίδιο έγγραφο, με
 * τον ίδιο τρόπο. Ένας ξεχωριστός «δικός μας» αναγνώστης θα ήταν **δεύτερο βιβλίο**
 * (ADR-749): το γραφείο θα έβλεπε «δημοσιευμένο» ενώ ο κόσμος δεν θα το έβρισκε.
 *
 * ⚠️ **Ζωντανά, όχι εφάπαξ**: το **Π2** μπορεί να σβήσει τη βιτρίνα **την ώρα** που ο
 * μεσίτης την κοιτά *(ανάκληση από υπερδιαχειριστή)*. Μια εφάπαξ ανάγνωση θα άφηνε την
 * οθόνη να λέει «φαίνεστε στον κατάλογο» για κάτι που **έπαψε να υπάρχει**.
 *
 * ⚠️ **Αστοχία ⇒ `unavailable`, ΠΟΤΕ «μη δημοσιευμένο»** *(N.12 · άγνωστο ≠ κενό)*: μια
 * βλάβη που διαβαζόταν ως απόσυρση θα έσπρωχνε τον άνθρωπο να **ξαναδημοσιεύσει** κάτι
 * που ήδη υπάρχει.
 */

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
// 🔴 **Ο ΚΑΝΟΝΙΚΟΣ ΣΥΝΔΡΟΜΗΤΗΣ, ποτέ ωμό `onSnapshot`** (CHECK 3.7, module
//    `firestore-realtime`). Δεν είναι τελετουργικό: από το **ADR-361** η υπηρεσία
//    επιβάλλει **φρουρό ισότητας περιεχομένου** σε κάθε εκπομπή — ένα σκέτο
//    `onSnapshot` τον **παρακάμπτει** και ξαναποδίδει την οθόνη σε κάθε άσχετη
//    μεταβολή του εγγράφου. Το έπιασε η πύλη, όχι η κρίση μου.
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { createModuleLogger } from '@/lib/telemetry';
import { readShowcase } from '@/lib/agency/showcase-read';
import type { ShowcaseWireDeclaration } from '@/lib/agency/showcase-wire';
import type { PublicShowcase } from '@/types/agency-profile';
import {
  isCapabilityStatus,
  type CapabilityStatus,
} from '@/types/organization-capability';
import type { AgencyProfileRejection } from '@/services/mandate/agency-profile.service';

const logger = createModuleLogger('useAgencyShowcase');

/** Πού βρίσκεται η βιτρίνα **τώρα** — τρεις τιμές, και η τρίτη δεν είναι η δεύτερη. */
export type ShowcaseState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'published'; readonly profile: PublicShowcase }
  | { readonly phase: 'not-published' }
  /** 🔴 Η βάση δεν απάντησε. **Δεν** ισοπεδώνεται σε «μη δημοσιευμένο». */
  | { readonly phase: 'unavailable' };

/**
 * **Γιατί δεν έγινε** — κλειδί i18n, ποτέ κείμενο (N.11).
 *
 * ⚠️ Οι λόγοι του **γραφέα** ταξιδεύουν αυτούσιοι *(`rejected`)* ώστε η οθόνη να δείξει
 * **ποιο πεδίο** λείπει· οι λόγοι της **πόρτας** είναι δικοί της. Ένας κοινός κάδος θα
 * έστελνε τον άνθρωπο να διορθώσει τη φόρμα επειδή έπεσε το ευρετήριο ψευδωνύμων.
 */
export type ShowcaseFailure =
  | { readonly kind: 'rejected'; readonly reason: AgencyProfileRejection }
  | { readonly kind: 'alias-not-owned' }
  | { readonly kind: 'alias-unverified' }
  /**
   * 🔴 **ΚΟΥΒΑΛΑ ΤΗΝ ΚΑΤΑΣΤΑΣΗ — ΚΑΙ ΜΕΧΡΙ ΤΙΣ 2026-08-30 ΔΕΝ ΤΗΝ ΚΟΥΒΑΛΟΥΣΕ.**
   *
   * Το 403 του `gateBrokerage` στέλνει **τρία** πεδία (`error` · `reason` ·
   * `capabilityStatus`), ο κριτής γράφει **ξεχωριστό** κείμενο για καθεμία από τις
   * τρεις καταστάσεις που αρνούνται, και τα κείμενα υπάρχουν **σε δύο γλώσσες** —
   * και ο `failureOf` τα **πετούσε όλα**, αφήνοντας `{ kind: 'not-allowed' }` σκέτο.
   * Ο ιδρυτής διάβαζε ένα γενικό *«δεν επιτρέπεται»* ενώ ο διακομιστής του είχε ήδη
   * πει **αν εκκρεμεί, αν ανακλήθηκε, ή αν δεν δήλωσε ποτέ** — τρεις καταστάσεις με
   * **τρεις διαφορετικές θεραπείες**: περίμενε · διάβασε τον λόγο · δήλωσε.
   *
   * ⚠️ Ίδιο ακριβώς σχήμα με το `ALIAS_NOT_OWNED ≠ ALIAS_UNVERIFIED` δύο γραμμές πιο
   * πάνω, που το ίδιο αυτό αρχείο ξεχωρίζει **με σχόλιο που εξηγεί γιατί**.
   *
   * 🔑 **`null` = «η πόρτα αρνήθηκε αλλά δεν ονόμασε κατάσταση»**, ποτέ «δεν ξέρω άρα
   * unrequested». Είναι το ίδιο δόγμα με το `settled` του αναγνώστη ικανοτήτων:
   * *άγνωστο ≠ κενό*. Το συναντά όποιος μιλά σε **παλιότερο** διακομιστή, και του
   * αξίζει το γενικό μήνυμα — όχι μια εικασία που θα του έλεγε να ξαναδηλώσει κάτι
   * που ίσως ήδη εκκρεμεί.
   */
  | { readonly kind: 'not-allowed'; readonly status: CapabilityStatus | null }
  /** Το `SHOWCASE_NO_ORGANIZATION`: **καμία βιτρίνα χωρίς χώρο** (Φ6-Β3). */
  | { readonly kind: 'no-organization' }
  /** Η ειδικότητα δεν βρέθηκε στην ταξινομία ⇒ *«διάλεξε ξανά»*. */
  | { readonly kind: 'occupation-unknown' }
  /** Ο δεσμός δεν δείχνει σε τόπο που υπάρχει ⇒ *«διάλεξέ τον ξανά»*. */
  | { readonly kind: 'place-not-found' }
  /**
   * 🔴 **ΔΕΝ ΜΑΘΑΜΕ** *(ταξινομία ή τόπος)* ⇒ *«ξαναδοκίμασε, **μην αλλάξεις
   * τίποτα**»*. Ισοπεδωμένο με τα δύο παραπάνω, η δική **μας** βλάβη θα έστελνε
   * τον άνθρωπο να αλλάξει **σωστή** επιλογή — και θα του φαινόταν εύλογο.
   */
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'failed' };

/**
 * 🔑 **ΔΕΝ ΟΡΙΖΕΤΑΙ ΕΔΩ, ΚΑΙ ΕΙΝΑΙ ΔΙΟΡΘΩΣΗ** *(Φ6-Β4)*. Μέχρι σήμερα αυτό το
 * αρχείο δήλωνε **δικό του** `ShowcaseDeclaration` με σκέτο `gemiNumber`, ενώ ο
 * γραφέας δήλωνε **ομώνυμο** τύπο με άλλο σχήμα. Δύο απαντήσεις στο *«τι είναι
 * δήλωση βιτρίνας»*, σε αρχεία που δεν εισάγουν το ένα το άλλο ⇒ η απόκλιση
 * ήταν **αόρατη** και θα εκδηλωνόταν ως `MALFORMED_BODY` σε χρόνο εκτέλεσης.
 *
 * @see lib/agency/showcase-wire — η **μία** αυθεντία, που το zod της διαδρομής επαληθεύει.
 */
export type { ShowcaseWireDeclaration } from '@/lib/agency/showcase-wire';

export interface AgencyShowcase {
  readonly state: ShowcaseState;
  readonly busy: 'publishing' | 'withdrawing' | null;
  readonly failure: ShowcaseFailure | null;
  readonly publish: (declaration: ShowcaseWireDeclaration) => Promise<void>;
  readonly withdraw: () => Promise<void>;
}

const ENDPOINT = '/api/agency-profile' as const;

/**
 * **Η απάντηση της πόρτας → λόγος αποτυχίας**, ή `null` όταν πέτυχε.
 *
 * ⚠️ Ο έλεγχος γίνεται στο **σώμα**, όχι μόνο στο `response.ok`: η πόρτα απαντά με
 * **ονόματα** *(`ALIAS_NOT_OWNED` ≠ `ALIAS_UNVERIFIED`)* ακριβώς για να μπορεί η οθόνη
 * να πει το σωστό — ένα σκέτο «απέτυχε» θα πετούσε αυτή την πληροφορία.
 */
async function failureOf(response: Response): Promise<ShowcaseFailure | null> {
  if (response.ok) return null;

  const body = (await response.json().catch(() => null)) as {
    error?: string;
    reason?: AgencyProfileRejection;
    /**
     * ⚠️ **`unknown`, ΟΧΙ `CapabilityStatus`** — και η διαφορά δεν είναι τυπική. Το
     * σώμα είναι **σύρμα**: ένας ισχυρισμός τύπου εδώ θα ήταν υπόσχεση που κανείς δεν
     * επαληθεύει, και η πρώτη τιμή εκτός συνόλου θα ζωγράφιζε **ωμό κλειδί**. Ο
     * `isCapabilityStatus` είναι που τη μετατρέπει σε γνώση.
     */
    capabilityStatus?: unknown;
  } | null;

  switch (body?.error) {
    case 'INVALID_PROFILE':
      return body.reason !== undefined
        ? { kind: 'rejected', reason: body.reason }
        : { kind: 'failed' };
    case 'ALIAS_NOT_OWNED':
      return { kind: 'alias-not-owned' };
    case 'ALIAS_UNVERIFIED':
      return { kind: 'alias-unverified' };
    case 'SHOWCASE_NO_ORGANIZATION':
      return { kind: 'no-organization' };
    case 'OCCUPATION_UNKNOWN':
      return { kind: 'occupation-unknown' };
    case 'PLACE_NOT_FOUND':
      return { kind: 'place-not-found' };
    // 🔑 **Δύο κωδικοί, ΜΙΑ θεραπεία** — και είναι σωστό να ενωθούν *εδώ*: ο
    //    άνθρωπος δεν χρειάζεται να ξέρει αν έπεσε η ταξινομία ή ο χάρτης· η
    //    πράξη του είναι η ίδια. Ό,τι δεν ενώνεται είναι *«διόρθωσε»* με
    //    *«ξαναδοκίμασε»*.
    case 'CLASSIFICATION_UNAVAILABLE':
    case 'PLACE_UNVERIFIED':
      return { kind: 'unavailable' };
    case 'BROKERAGE_NOT_ALLOWED': {
      // ⚠️ **Τοπική σταθερά, ΟΧΙ διπλή ανάγνωση του `body?.…`**: το `switch (body?.error)`
      //    στενεύει το **πεδίο**, ποτέ το `body`, οπότε δύο εμφανίσεις της ίδιας
      //    διαδρομής θα ήταν δύο **διαφορετικές** εκφράσεις για τον μεταγλωττιστή — και
      //    η δεύτερη θα ζητούσε έλεγχο που δεν έγινε.
      const wire = body?.capabilityStatus;
      return { kind: 'not-allowed', status: isCapabilityStatus(wire) ? wire : null };
    }
    default:
      return { kind: 'failed' };
  }
}

export function useAgencyShowcase(): AgencyShowcase {
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;

  const [state, setState] = useState<ShowcaseState>({ phase: 'loading' });
  const [busy, setBusy] = useState<AgencyShowcase['busy']>(null);
  const [failure, setFailure] = useState<ShowcaseFailure | null>(null);

  useEffect(() => {
    if (companyId === null) {
      // ⚠️ **Χωρίς οργανισμό δεν υπάρχει βιτρίνα να αναζητηθεί** — και αυτό είναι
      //    «δεν δημοσιεύτηκε», όχι βλάβη: το ερώτημα δεν έχει υποκείμενο.
      setState({ phase: 'not-published' });
      return;
    }

    setState({ phase: 'loading' });

    return firestoreQueryService.subscribeDoc<Record<string, unknown>>(
      'AGENCY_PROFILES',
      companyId,
      (raw) => {
        // ⚠️ Το `null` σημαίνει **δεν υπάρχει έγγραφο** — δηλαδή «δεν δημοσιεύτηκε»,
        //    που είναι **κατάσταση**, όχι βλάβη. Η βλάβη έρχεται από τον `onError`.
        if (raw === null) {
          setState({ phase: 'not-published' });
          return;
        }

        // ───────────────────────────────────────────────────────────────────
        // 🔴 Ο ΙΔΙΟΣ ΦΡΟΥΡΟΣ ΜΕ ΤΟΝ ΚΟΣΜΟ — ΚΑΙ ΜΕΧΡΙ ΤΗ Φ6-Β4 ΕΛΕΙΠΕ
        //
        // Αυτό το αρχείο γράφει στην κεφαλή του ότι *«η οθόνη διαβάζει ό,τι
        // διαβάζει ΚΑΙ Ο ΠΕΛΑΤΗΣ… ένας ξεχωριστός δικός μας αναγνώστης θα ήταν
        // δεύτερο βιβλίο: το γραφείο θα έβλεπε “δημοσιευμένο” ενώ ο κόσμος δεν
        // θα το έβρισκε»*. Και **ακριβώς αυτό έκανε**: ένα `subscribeDoc<
        // PublicShowcase>` είναι ισχυρισμός τύπου, όχι ανάγνωση — δεχόταν ό,τι
        // γράφτηκε ποτέ, ενώ ο `usePublicAgencies` περνά από το `readShowcase`.
        //
        // ⇒ Έγγραφο **μη αναγνώσιμο** είναι *«δεν δημοσιεύτηκε»*, ταυτόσημα με
        // ό,τι βλέπει ο κόσμος. Το `unavailable` μένει **μόνο** για τη βλάβη.
        // ───────────────────────────────────────────────────────────────────
        const read = readShowcase(raw, companyId);
        setState(
          read.outcome === 'showcase'
            ? { phase: 'published', profile: read.showcase }
            : { phase: 'not-published' },
        );
      },
      (error) => {
        logger.error('[SHOWCASE] Η βιτρίνα δεν διαβάστηκε — άγνωστο, όχι κενό', {
          data: { companyId },
          error: error.message,
        });
        setState({ phase: 'unavailable' });
      },
    );
  }, [companyId]);

  const publish = useCallback(async (declaration: ShowcaseWireDeclaration) => {
    setBusy('publishing');
    setFailure(null);
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(declaration),
      });
      setFailure(await failureOf(response));
    } catch {
      // Δίκτυο που δεν απάντησε — **όχι** άρνηση της πόρτας.
      setFailure({ kind: 'failed' });
    } finally {
      setBusy(null);
    }
  }, []);

  const withdraw = useCallback(async () => {
    setBusy('withdrawing');
    setFailure(null);
    try {
      setFailure(await failureOf(await fetch(ENDPOINT, { method: 'DELETE' })));
    } catch {
      setFailure({ kind: 'failed' });
    } finally {
      setBusy(null);
    }
  }, []);

  return { state, busy, failure, publish, withdraw };
}
