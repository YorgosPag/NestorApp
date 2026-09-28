'use client';

/**
 * @fileoverview **Η ΚΟΥΚΚΙΔΑ ΚΕΡΣΟΡΑ ΣΤΟ ΠΑΤΩΜΑ** — γκρι ημιδιαφανής δίσκος που ακολουθεί το ποντίκι πάνω στο πάτωμα και
 * δείχνει «εδώ θα πατήσεις» (ADR-884 Φ2στ-γ · §4.14 σημείο 2, πρότυπο Zillow 3D Home / Matterport).
 * @related `useTourFloorOverlay.ts` (`useFloorCursor` — τη γράφει ανά καρέ) · `lib/spatial-tour/viewer/tour-floor-geometry.ts`
 * @module components/spatial-tour/viewer/TourFloorCursor
 *
 * 🔑 **Διακοσμητική** (`aria-hidden`, `pointer-events: none`): ο δρόμος του πληκτρολογίου και του αναγνώστη οθόνης είναι
 *   τα βελάκια-κουμπιά και η λίστα της στήλης. Ο δείκτης περνά από μέσα της στον καμβά.
 * 🔑 Όταν κάτω από τον κέρσορα **δεν** υπάρχει στάση να πας (`data-target="none"`), σβήνει: ο επισκέπτης βλέπει πριν πατήσει
 *   ότι εκεί το κλικ δεν κάνει τίποτα — καμία «τηλεμεταφορά» σε σημείο χωρίς λήψη.
 */

import type { RefObject } from 'react';

/** Ακτίνα της κουκκίδας πάνω στο πάτωμα (μέτρα) — πραγματική προοπτική: μεγαλώνει όσο πλησιάζει. */
export const FLOOR_CURSOR_RADIUS_M = 0.3;

/** Πλευρά = `FLOOR_DISC_PX` του `TourLinkButton` (100): ο πίνακας `matrix3d` την απλώνει στο πάτωμα. */
const CURSOR_CLASS =
  'pointer-events-none absolute left-0 top-0 h-[100px] w-[100px] origin-top-left rounded-full border-2 border-white/70 bg-black/25 transition-opacity data-[target=none]:opacity-40';

export function TourFloorCursor({ cursorRef }: { readonly cursorRef: RefObject<HTMLSpanElement | null> }) {
  return <span ref={cursorRef} hidden aria-hidden data-floor-cursor className={CURSOR_CLASS} />;
}
