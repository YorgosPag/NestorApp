'use client';

/**
 * @fileoverview **«Μόλις εμφανιστώ, η εστίαση έρχεται σε μένα — στο ΙΔΙΟ commit που έφυγε το κουμπί που με άνοιξε.»**
 * @related lib/a11y/focus-first.ts (`focusFirstWithin` — ΤΙ εστιάζεται) · ADR-915 §37.7
 * @module lib/a11y/use-focus-first-on-mount
 *
 * 🔑 **`useLayoutEffect`, ΟΧΙ `useEffect`** — ίδια επιλογή με το `FocusScope autoFocus` του React Aria. Όταν η εμφάνιση
 *    **αντικαθιστά** το εστιασμένο στοιχείο, το commit το αφαιρεί και η εστίαση πέφτει στο `<body>` μέχρι να τρέξει το
 *    effect. Τα passive effects αδειάζουν σύγχρονα **μόνο** σε διακριτή είσοδο (κλικ/πλήκτρο, React ≥18)· σε κάθε άλλο commit
 *    — επανάληψη Suspense, `await` μετά από αποστολή — τρέχουν **μετά** το βάψιμο ⇒ ορατό κενό. Το layout effect τρέχει
 *    πριν βάψει ο browser, άρα κανένας παρατηρητής δεν βλέπει ποτέ το `<body>`.
 * ⚠️ Δεν καλύπτει το **fallback** ενός Suspense: εκεί το κουμπί φεύγει πριν υπάρξει ο στόχος. Αυτό λύνεται στον
 *    καλούντα (μετάβαση πάνω σε όριο που ήδη φαίνεται) — βλ. `RegistryUpkeepDecision.tsx`.
 */

import { useLayoutEffect, type RefObject } from 'react';

import { focusFirstWithin } from './focus-first';

/** Εστίασε το πρώτο εστιάσιμο μέσα στο `ref` κατά την προσάρτηση, χωρίς κύλιση. */
export function useFocusFirstOnMount(ref: RefObject<ParentNode | null>): void {
  useLayoutEffect(() => {
    focusFirstWithin(ref.current);
  }, [ref]);
}
