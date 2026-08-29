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
import type { AgencyProfile } from '@/types/agency-profile';
import type { AgencyProfileRejection } from '@/services/mandate/agency-profile.service';
import type { PlaceRef } from '@/types/geo/public-place';

const logger = createModuleLogger('useAgencyShowcase');

/** Πού βρίσκεται η βιτρίνα **τώρα** — τρεις τιμές, και η τρίτη δεν είναι η δεύτερη. */
export type ShowcaseState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'published'; readonly profile: AgencyProfile }
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
  | { readonly kind: 'not-allowed' }
  | { readonly kind: 'failed' };

export interface ShowcaseDeclaration {
  readonly alias: string;
  readonly displayName: string;
  readonly gemiNumber: string;
  readonly place: PlaceRef | null;
}

export interface AgencyShowcase {
  readonly state: ShowcaseState;
  readonly busy: 'publishing' | 'withdrawing' | null;
  readonly failure: ShowcaseFailure | null;
  readonly publish: (declaration: ShowcaseDeclaration) => Promise<void>;
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
    case 'BROKERAGE_NOT_ALLOWED':
      return { kind: 'not-allowed' };
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

    return firestoreQueryService.subscribeDoc<AgencyProfile>(
      'AGENCY_PROFILES',
      companyId,
      (profile) => {
        // ⚠️ Το `null` σημαίνει **δεν υπάρχει έγγραφο** — δηλαδή «δεν δημοσιεύτηκε»,
        //    που είναι **κατάσταση**, όχι βλάβη. Η βλάβη έρχεται από τον `onError`.
        setState(profile === null ? { phase: 'not-published' } : { phase: 'published', profile });
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

  const publish = useCallback(async (declaration: ShowcaseDeclaration) => {
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
