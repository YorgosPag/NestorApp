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
import { Popup } from '@/lib/maps/maplibre';
import type { GeoPoint } from '@/types/geo/coordinates';

interface ListingMapPopupFrameProps {
  /** Το σημείο του **σχήματος που πατήθηκε**: η ίδια συντεταγμένη με τον ζωγράφο. */
  readonly point: GeoPoint;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
}

export function ListingMapPopupFrame({ point, onClose, children }: ListingMapPopupFrameProps) {
  return (
    <Popup
      longitude={point.lng}
      latitude={point.lat}
      anchor="bottom"
      /*
        ⚠️ **Το `offset` ΔΕΝ είναι αισθητική απόσταση**: χωρίς αυτό η μύτη του popup
        κάθεται πάνω στο κέντρο της πινέζας και **σκεπάζει το ίδιο το σχήμα** που μόλις
        πατήθηκε — ο άνθρωπος χάνει την οπτική επιβεβαίωση του τι διάλεξε. Η τιμή είναι
        η μεγαλύτερη ακτίνα σχήματος-σημείου (`RADIUS.pin + δακτύλιος επιλογής`).
      */
      offset={[0, -18]}
      onClose={onClose}
      /*
        🔴 **`closeOnClick={false}` — ΥΠΟΧΡΕΩΤΙΚΟ.** Με την προεπιλογή (`true`), το ίδιο
        το κλικ που **άνοιξε** το popup το κλείνει στον ίδιο κύκλο συμβάντων: το popup
        αναβοσβήνει και ο άνθρωπος δεν καταλαβαίνει ποτέ γιατί. Το κλείσιμο ζει στο `×`,
        στο `Escape` και στο κλικ σε **κενό** σημείο του χάρτη — τρεις ρητές διαδρομές.
      */
      closeOnClick={false}
      className="listing-map-popup"
      maxWidth="15rem"
    >
      {children}
    </Popup>
  );
}
