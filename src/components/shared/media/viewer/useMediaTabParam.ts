'use client';

/**
 * 🔗 **Η ΕΝΕΡΓΗ ΚΑΡΤΕΛΑ ΤΟΥ ΠΡΟΒΟΛΕΑ ΖΕΙ ΣΤΗ ΔΙΕΥΘΥΝΣΗ** (`?mediaTab=…`) — μία ανάγνωση, μία εγγραφή, για κάθε προσαρμογέα
 * του `MediaViewerShell`. Έτσι η καρτέλα αντέχει ανανέωση, «πίσω» και κοινοποίηση συνδέσμου.
 *
 * 🔑 **Πάνω στο `url-query-state`, όχι στον router**: η εγγραφή είναι `replaceState` πάνω στα **ζωντανά** params (κανένας
 * γύρος στον server ανά κλικ, κανένα άσχετο κλειδί δεν χάνεται) και η ανάγνωση `useUrlQuery` — το `useSearchParams` δεν
 * βλέπει το `replaceState` στον dev (μετρημένο, ADR-777 §8.60.21.7). Η δημόσια αγγελία κρατά στην ίδια διεύθυνση άτομα,
 * νύχτες και ανοιχτή φωτογραφία· ένα `router.replace` από παλιό στιγμιότυπο θα τα έσβηνε σιωπηλά.
 *
 * Ο γάντζος **δεν** ξέρει ποιες καρτέλες υπάρχουν: επιστρέφει την ωμή τιμή και ο προσαρμογέας την επικυρώνει απέναντι
 * στις δικές του (ο εταιρικός έχει δυναμικές καρτέλες ανά επίπεδο, ο δημόσιος μόνο όσες έχουν περιεχόμενο).
 *
 * @module components/shared/media/viewer/useMediaTabParam
 */

import { useCallback, useEffect, useMemo } from 'react';

import { useUrlQuery } from '@/hooks/useUrlQuery';
import { replaceUrlSearchParams } from '@/lib/url-query-state';

/** URL Query Param key */
export const MEDIA_TAB_PARAM = 'mediaTab' as const;

export interface MediaTabParam {
  /** Η ωμή τιμή της διεύθυνσης — `null` όταν λείπει. */
  readonly raw: string | null;
  /** Γράφει την καρτέλα· με `omit` η παράμετρος **φεύγει** (η προεπιλογή δεν χρειάζεται να φαίνεται στη διεύθυνση). */
  readonly write: (tabId: string, omit?: boolean) => void;
}

export function useMediaTabParam(): MediaTabParam {
  const query = useUrlQuery();
  const raw = useMemo(() => new URLSearchParams(query).get(MEDIA_TAB_PARAM), [query]);

  const write = useCallback((tabId: string, omit = false) => {
    replaceUrlSearchParams((params) => {
      if (omit) params.delete(MEDIA_TAB_PARAM);
      else params.set(MEDIA_TAB_PARAM, tabId);
    });
  }, []);

  return { raw, write };
}

export interface ActiveMediaTabOptions {
  /**
   * Ξαναγράφει τη διεύθυνση όταν δείχνει καρτέλα που **δεν υπάρχει** — ώστε κάθε άλλος αναγνώστης της παραμέτρου να
   * συμφωνεί με τη σκηνή. ⚠️ Μόνο όταν το σύνολο των καρτελών είναι **οριστικό**: προσαρμογέας του οποίου καρτέλα
   * εμφανίζεται ασύγχρονα (π.χ. η περιήγηση 360° της αγγελίας) θα έσβηνε έναν έγκυρο βαθύ σύνδεσμο πριν προλάβει να ισχύσει.
   */
  readonly heal?: boolean;
}

export interface ActiveMediaTab {
  /** Πάντα καρτέλα που **υπάρχει** — ποτέ η ωμή τιμή της διεύθυνσης. */
  readonly activeTab: string;
  readonly setActiveTab: (tabId: string) => void;
}

/**
 * Η ενεργή καρτέλα **απέναντι στις καρτέλες που υπάρχουν** — η μία απάντηση και για τους δύο προσαρμογείς.
 *
 * 🔴 Γιατί εδώ και όχι σε κάθε προσαρμογέα (βρέθηκε στον browser, 2026-10-07): ο εταιρικός επικύρωνε μόνο το **σχήμα**
 * της τιμής (`floorplan-floor-*`). Μεζονέτα στην «Κάτοψη Ορόφου 1ος» → επιλογή διαμερίσματος ενός επιπέδου ⇒ η διεύθυνση
 * έδειχνε καρτέλα άλλου ακινήτου ⇒ **καμία ενεργή καρτέλα, κενή σκηνή**. Η πρώτη καρτέλα είναι η προεπιλογή και δεν
 * γράφεται στη διεύθυνση.
 */
export function useActiveMediaTab(tabIds: readonly string[], { heal = false }: ActiveMediaTabOptions = {}): ActiveMediaTab {
  const { raw, write } = useMediaTabParam();
  const defaultTab = tabIds[0] ?? '';
  const activeTab = raw !== null && tabIds.includes(raw) ? raw : defaultTab;

  useEffect(() => {
    if (heal && raw !== null && raw !== activeTab) write(activeTab, true);
  }, [heal, raw, activeTab, write]);

  const setActiveTab = useCallback((tabId: string) => write(tabId, tabId === defaultTab), [write, defaultTab]);

  return { activeTab, setActiveTab };
}
