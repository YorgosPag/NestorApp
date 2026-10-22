'use client';

/**
 * 🔗 **Η ΕΝΕΡΓΗ ΚΑΡΤΕΛΑ ΤΟΥ ΠΡΟΒΟΛΕΑ ΖΕΙ ΣΤΗ ΔΙΕΥΘΥΝΣΗ** (`?mediaTab=…`) — για κάθε προσαρμογέα του `MediaViewerShell`.
 *
 * Λεπτό κέλυφος πάνω στο `@/hooks/useUrlTabParam` (ADR-242 Βήμα 3): εδώ ζει **μόνο** το όνομα του κλειδιού. Η ανάγνωση,
 * η εγγραφή (`replaceState` πάνω στα ζωντανά params — η δημόσια αγγελία κρατά στην ίδια διεύθυνση άτομα, νύχτες και
 * ανοιχτή φωτογραφία) και η επικύρωση απέναντι στις υπαρκτές καρτέλες είναι **κοινές** με κάθε άλλη οθόνη με καρτέλες.
 *
 * Ο γάντζος **δεν** ξέρει ποιες καρτέλες υπάρχουν: ο εταιρικός προσαρμογέας έχει δυναμικές καρτέλες ανά επίπεδο, ο
 * δημόσιος μόνο όσες έχουν περιεχόμενο — καθένας δίνει τις δικές του.
 *
 * @module components/shared/media/viewer/useMediaTabParam
 */

import {
  useActiveUrlTab,
  useUrlTabParam,
  type ActiveUrlTab,
  type ActiveUrlTabOptions,
  type UrlTabParam,
} from '@/hooks/useUrlTabParam';

/** URL Query Param key */
export const MEDIA_TAB_PARAM = 'mediaTab' as const;

export function useMediaTabParam(): UrlTabParam {
  return useUrlTabParam(MEDIA_TAB_PARAM);
}

/** Η ενεργή καρτέλα του προβολέα απέναντι στις καρτέλες που υπάρχουν — βλ. {@link useActiveUrlTab}. */
export function useActiveMediaTab(tabIds: readonly string[], options?: ActiveUrlTabOptions): ActiveUrlTab {
  return useActiveUrlTab(MEDIA_TAB_PARAM, tabIds, options);
}
