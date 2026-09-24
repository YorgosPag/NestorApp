'use client';

/**
 * **Το πλαίσιο της φούσκας του χάρτη** — θέση, μύτη, κλείσιμο (ADR-777 §8.71).
 *
 * 🔑 Βγήκε από τον `ListingMapPopup` όταν ήρθε δεύτερη φούσκα, του χάρτη χαρτοφυλακίου του
 * κατόχου. Το **περιεχόμενο** διαφέρει (δημόσια αγγελία ↔ ακίνητο του κατόχου)· η **τοποθέτηση**
 * δεν επιτρέπεται να διαφέρει, γιατί απαντά σε ερωτήσεις του **ζωγράφου** (πόσο μεγάλη είναι η
 * πινέζα, ποιο κλικ την άνοιξε), όχι του καταναλωτή.
 */

import React from 'react';
import type { PositionAnchor } from 'maplibre-gl';
import { Popup, type PopupEvent } from '@/lib/maps/maplibre';
import { focusFirstWithin } from '@/lib/a11y/focus-first';
import type { GeoPoint } from '@/types/geo/coordinates';

/**
 * Η μεγαλύτερη ακτίνα σχήματος-σημείου (`RADIUS.pin + δακτύλιος επιλογής`) — πόσο μακριά
 * από το κέντρο κάθεται η μύτη, **όποια πλευρά κι αν διαλέξει** η βιβλιοθήκη.
 */
const TIP_CLEARANCE_PX = 18;
const TIP_DIAGONAL_PX = Math.round(TIP_CLEARANCE_PX / Math.SQRT2);

const POPUP_TIP_OFFSET = {
  center: [0, 0],
  top: [0, TIP_CLEARANCE_PX],
  bottom: [0, -TIP_CLEARANCE_PX],
  left: [TIP_CLEARANCE_PX, 0],
  right: [-TIP_CLEARANCE_PX, 0],
  'top-left': [TIP_DIAGONAL_PX, TIP_DIAGONAL_PX],
  'top-right': [-TIP_DIAGONAL_PX, TIP_DIAGONAL_PX],
  'bottom-left': [TIP_DIAGONAL_PX, -TIP_DIAGONAL_PX],
  'bottom-right': [-TIP_DIAGONAL_PX, -TIP_DIAGONAL_PX],
} satisfies Record<PositionAnchor, [number, number]>;

interface ListingMapPopupFrameProps {
  /** Το σημείο του **σχήματος που πατήθηκε**: η ίδια συντεταγμένη με τον ζωγράφο. */
  readonly point: GeoPoint;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
}

/** Το `open` της MapLibre κουβαλά την ίδια τη φούσκα (`target`): εκεί ζει το πρώτο εστιάσιμο. */
function focusPopupContent(event: PopupEvent): void {
  focusFirstWithin(event.target.getElement());
}

export function ListingMapPopupFrame({ point, onClose, children }: ListingMapPopupFrameProps) {
  return (
    <Popup
      longitude={point.lng}
      latitude={point.lat}
      /*
        🔴 **ΚΑΝΕΝΑ `anchor` — Η MapLibre ΔΙΑΛΕΓΕΙ ΤΗΝ ΠΛΕΥΡΑ ΠΟΥ ΧΩΡΑ** (ADR-777 §8.76).
        Με `anchor="bottom"` καρφωμένο, πινέζα κοντά στην **πάνω** άκρη έδινε φούσκα
        **κομμένη** — μετρημένο ζωντανά: η κεφαλίδα της λίστας διαλέγματος έξω από τον χάρτη.
        Χωρίς `anchor` η βιβλιοθήκη προτιμά το `bottom` όταν χωρά (ίδια εικόνα με πριν) και
        γυρίζει μόνο όταν δεν χωρά. ⛔ Όχι auto-pan (Google InfoWindow): θα κουνούσε τον
        χάρτη κάτω από τον δείκτη **και** θα πυροδοτούσε το «Αναζήτηση καθώς μετακινώ».
      */
      /*
        ⚠️ **Το `offset` ΔΕΝ είναι αισθητική απόσταση**: χωρίς αυτό η μύτη του popup
        κάθεται πάνω στο κέντρο της πινέζας και **σκεπάζει το ίδιο το σχήμα** που μόλις
        πατήθηκε. **Ανά πλευρά**, γιατί η πλευρά πια αλλάζει: η ίδια απόσταση από το κέντρο.
      */
      offset={POPUP_TIP_OFFSET}
      onClose={onClose}
      /*
        🔴 **`closeOnClick={false}` — ΥΠΟΧΡΕΩΤΙΚΟ.** Με την προεπιλογή (`true`), το ίδιο
        το κλικ που **άνοιξε** το popup το κλείνει στον ίδιο κύκλο συμβάντων: το popup
        αναβοσβήνει και ο άνθρωπος δεν καταλαβαίνει ποτέ γιατί. Το κλείσιμο ζει στο `×`,
        στο `Escape` και στο κλικ σε **κενό** σημείο του χάρτη — τρεις ρητές διαδρομές.
      */
      closeOnClick={false}
      /*
        🔴 **Η ΕΣΤΙΑΣΗ ΜΕΝΕΙ — Η ΚΥΛΙΣΗ ΟΧΙ** (ADR-777 §8.77, μετρημένο: σελίδα 649 → 0 σε 11ms).
        Το `focus()` της MapLibre δεν έχει `preventScroll`, και μέσα σε **sticky** πάνελ ο Chrome
        κυλά τη σελίδα στη θέση του πάνελ χωρίς το κόλλημα. Εστιάζουμε **εμείς**, το ίδιο στοιχείο
        τη στιγμή του `open`, χωρίς κύλιση — δες `lib/a11y/focus-first.ts`.
      */
      focusAfterOpen={false}
      onOpen={focusPopupContent}
      className="listing-map-popup"
      maxWidth="15rem"
    >
      {children}
    </Popup>
  );
}
