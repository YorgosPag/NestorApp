'use client';

/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΤΟΥ ΚΑΤΑΛΟΓΟΥ** — φόρτωση, πράξη, ξαναφόρτωση.
 * @related ADR-777 §8.34 · services/mandate/mandate-catalog.client.ts
 * @module hooks/mandate/useMandateCatalog
 *
 * 🔴 **ΟΙ ΠΡΑΞΕΙΣ ΕΞΗΧΘΗΣΑΝ** (ADR-841 §7 Α18.12.ζ E2): `busyId` · `feedback` · `act` ·
 * `setPresence` ζουν πλέον στο {@link useMandateRowActions}, γιατί ήταν **ήδη ανά
 * `ownerPropertyId`** και τις ζητά και η οθόνη **της μίας** εντολής. Εδώ μένει ό,τι
 * είναι **του καταλόγου**: η φόρτωσή του και το τι σημαίνει *«ξαναρώτα»* γι' αυτόν.
 *
 * ⛔ **ΜΗΝ τις ξαναγράψεις εδώ «για ευκολία»** — θα ήταν ο κλώνος-αδελφός του N.18.
 */

import { useIdentityGatedResource } from '@/hooks/useIdentityGatedResource';
import {
  fetchMandateCatalog,
  type CatalogLoad,
} from '@/services/mandate/mandate-catalog.client';
import {
  useMandateRowActions,
  type CatalogFeedback,
  type MandateRowActions,
} from '@/hooks/mandate/useMandateRowActions';
import type { MandateCatalog } from '@/services/mandate/mandate-catalog.service';

/** Λύθηκε η ταυτότητα και **δεν υπάρχει κανείς** — δες {@link useMandateDetail}. */
const UNAUTHENTICATED: CatalogLoad = { kind: 'failed', message: 'unauthenticated' };

// 🔑 **ΕΠΑΝΕΞΑΓΩΓΗ, ΟΧΙ ΔΕΥΤΕΡΗ ΔΗΛΩΣΗ** (ADR-841 §7 Α18.12.ζ E2): τα δύο σχήματα
//    μετακόμισαν στο {@link useMandateRowActions} μαζί με τους χειριστές που τα γεννούν.
//    Οι υπάρχοντες καταναλωτές *(`MandateCatalogRow.tsx`, οι άγκυρες)* συνεχίζουν να τα
//    ζητούν από εδώ — καμία αλλαγή σε αυτούς, και **ένας** ορισμός.
export type { CatalogFeedback, PresenceResult } from '@/hooks/mandate/useMandateRowActions';

export type MandateCatalogState =
  | { readonly state: 'loading' }
  | { readonly state: 'failed' }
  | {
      readonly state: 'ready';
      readonly catalog: MandateCatalog;
      readonly busyId: string | null;
      readonly feedback: CatalogFeedback | null;
    };

/**
 * ⚠️ **Οι δύο πράξεις ΔΕΝ ξαναδηλώνονται εδώ**: η υπογραφή τους διαβάζεται **από τον
 * ιδιοκτήτη τους** ({@link MandateRowActions}), ώστε μια αλλαγή εκεί να **σπάει** αυτό
 * το αρχείο αντί να το αφήνει να περνά μια σχεδόν-σωστή υπογραφή. Ίδιο ιδίωμα με το
 * `React.ComponentProps<typeof MandateCatalogRow>` της οθόνης.
 */
export interface MandateCatalogApi extends Pick<MandateRowActions, 'act' | 'setPresence'> {
  readonly view: MandateCatalogState;
  readonly reload: () => void;
}

export function useMandateCatalog(): MandateCatalogApi {
  // 🔑 **Ο ΙΔΙΟΣ ΚΑΝΟΝΑΣ ΜΕ ΤΗΝ ΟΘΟΝΗ ΤΗΣ ΜΙΑΣ ΕΝΤΟΛΗΣ, ΑΠΟ ΕΝΑ ΣΗΜΕΙΟ** — δες
  //    {@link useIdentityGatedResource} για το μετρημένο περιστατικό (0/251 αιτήματα).
  const { value: loaded, reload } = useIdentityGatedResource<CatalogLoad>(
    fetchMandateCatalog,
    UNAUTHENTICATED,
  );

  const { busyId, feedback, act, setPresence } = useMandateRowActions(reload);

  if (loaded === null) return { view: { state: 'loading' }, reload, act, setPresence };
  if (loaded.kind !== 'ready') return { view: { state: 'failed' }, reload, act, setPresence };
  return {
    view: { state: 'ready', catalog: loaded.catalog, busyId, feedback },
    reload,
    act,
    setPresence,
  };
}
