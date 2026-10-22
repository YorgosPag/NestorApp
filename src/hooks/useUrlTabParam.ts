'use client';

/**
 * 🔗 **Η ΕΝΕΡΓΗ ΚΑΡΤΕΛΑ ΖΕΙ ΣΤΗ ΔΙΕΥΘΥΝΣΗ** (`?<param>=…`) — μία ανάγνωση, μία εγγραφή, για κάθε οθόνη με καρτέλες.
 * Έτσι η καρτέλα αντέχει ανανέωση, «πίσω» από άλλη σελίδα και κοινοποίηση συνδέσμου.
 *
 * 🔑 **Πάνω στο `url-query-state`, όχι στον router**: η εγγραφή είναι `replaceState` πάνω στα **ζωντανά** params (κανένας
 * γύρος στον server ανά κλικ, κανένα άσχετο κλειδί δεν χάνεται — π.χ. το `projectId` της επιλογής) και η ανάγνωση
 * `useUrlQuery` — το `useSearchParams` δεν βλέπει το `replaceState` στον dev (μετρημένο, ADR-777 §8.60.21.7).
 *
 * 🔑 **`replace`, όχι `push`** (ADR-242 Βήμα 3): η καρτέλα είναι κατάσταση θέασης, όχι προορισμός — πέντε κλικ σε
 * καρτέλες δεν πρέπει να θέλουν πέντε «πίσω» για να φύγεις (Baymard, back-button expectations). Και επειδή η
 * **τρέχουσα** καταχώριση ιστορικού κουβαλά πάντα την τελευταία καρτέλα, όποιος φύγει και πατήσει «πίσω» γυρίζει
 * **στην καρτέλα που άφησε** — το όφελος του `push` χωρίς το μολυσμένο ιστορικό του.
 *
 * Εξήχθη από το `useMediaTabParam` (ADR-777) όταν απέκτησε δεύτερο καταναλωτή — τη σελίδα έργου (ADR-242 Βήμα 3).
 *
 * @module hooks/useUrlTabParam
 * @see ADR-242 · ADR-332 D21 · ADR-777 §8.60.21.7
 */

import { useCallback, useEffect, useMemo } from 'react';

import { useUrlQuery } from '@/hooks/useUrlQuery';
import { replaceUrlSearchParams } from '@/lib/url-query-state';

export interface UrlTabParam {
  /** Η ωμή τιμή της διεύθυνσης — `null` όταν λείπει. */
  readonly raw: string | null;
  /** Γράφει την καρτέλα· με `omit` η παράμετρος **φεύγει** (η προεπιλογή δεν χρειάζεται να φαίνεται στη διεύθυνση). */
  readonly write: (tabId: string, omit?: boolean) => void;
}

/** Η ωμή τιμή + ο γραφέας. Ο γάντζος **δεν** ξέρει ποιες καρτέλες υπάρχουν — τις επικυρώνει το {@link useActiveUrlTab}. */
export function useUrlTabParam(param: string): UrlTabParam {
  const query = useUrlQuery();
  const raw = useMemo(() => new URLSearchParams(query).get(param), [query, param]);

  const write = useCallback((tabId: string, omit = false) => {
    replaceUrlSearchParams((params) => {
      if (omit) params.delete(param);
      else params.set(param, tabId);
    });
  }, [param]);

  return { raw, write };
}

export interface ActiveUrlTabOptions {
  /**
   * Ξαναγράφει τη διεύθυνση όταν δείχνει καρτέλα που **δεν υπάρχει** — ώστε κάθε άλλος αναγνώστης της παραμέτρου να
   * συμφωνεί με τη σκηνή. ⚠️ Μόνο όταν το σύνολο των καρτελών είναι **οριστικό**: οθόνη της οποίας καρτέλα
   * εμφανίζεται ασύγχρονα (π.χ. η περιήγηση 360° της αγγελίας) θα έσβηνε έναν έγκυρο βαθύ σύνδεσμο πριν προλάβει να ισχύσει.
   */
  readonly heal?: boolean;
}

export interface ActiveUrlTab {
  /** Πάντα καρτέλα που **υπάρχει** — ποτέ η ωμή τιμή της διεύθυνσης. */
  readonly activeTab: string;
  readonly setActiveTab: (tabId: string) => void;
}

/**
 * Η ενεργή καρτέλα **απέναντι στις καρτέλες που υπάρχουν**. Η πρώτη είναι η προεπιλογή και δεν γράφεται στη
 * διεύθυνση (μία οθόνη = μία διεύθυνση)· άγνωστη τιμή (παλιός σύνδεσμος) πέφτει σιωπηλά στην προεπιλογή.
 *
 * 🔴 Γιατί η επικύρωση ζει εδώ και όχι σε κάθε καταναλωτή (βρέθηκε στον browser, 2026-10-07): ο εταιρικός προβολέας
 * επικύρωνε μόνο το **σχήμα** της τιμής ⇒ η διεύθυνση έδειχνε καρτέλα άλλου ακινήτου ⇒ **καμία ενεργή καρτέλα, κενή σκηνή**.
 */
export function useActiveUrlTab(
  param: string,
  tabIds: readonly string[],
  { heal = false }: ActiveUrlTabOptions = {},
): ActiveUrlTab {
  const { raw, write } = useUrlTabParam(param);
  const defaultTab = tabIds[0] ?? '';
  const activeTab = raw !== null && tabIds.includes(raw) ? raw : defaultTab;

  useEffect(() => {
    if (heal && raw !== null && raw !== activeTab) write(activeTab, true);
  }, [heal, raw, activeTab, write]);

  const setActiveTab = useCallback((tabId: string) => write(tabId, tabId === defaultTab), [write, defaultTab]);

  return { activeTab, setActiveTab };
}
