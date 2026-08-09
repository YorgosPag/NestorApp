/**
 * 🎯 ΥΨΟΜΕΤΡΟ ΤΟΥ ΣΗΜΕΙΟΥ ΚΑΤΩ ΑΠΟ ΤΟΝ ΔΕΙΚΤΗ — μία ευθύνη, ένα αρχείο
 *
 * Εξήχθη από το `InteractiveMapContainer.tsx` (N.7.1: 501/500 γραμμές). **Εξαγωγή, όχι
 * κόψιμο γραμμών**: αυτό εδώ είναι ένα κλειστό ερώτημα — «όταν ο δείκτης σταθεί σε ένα
 * σημείο, τι υψόμετρο έχει;» — με δικό του χρονισμό, δική του ασύγχρονη διαδρομή και δικό
 * του κίνδυνο stale closure. Ο container δεν χρειάζεται να ξέρει τίποτα από αυτά.
 *
 * ⚠️ ΤΡΙΑ ΠΡΑΓΜΑΤΑ ΠΟΥ ΜΟΙΑΖΟΥΝ ΠΕΡΙΤΤΑ ΚΑΙ ΔΕΝ ΕΙΝΑΙ:
 *
 * 1. **Το `ref`.** Η απάντηση του δικτύου φτάνει αργότερα· χωρίς ref το callback θα
 *    διάβαζε το `hoveredCoordinate` της στιγμής που **δημιουργήθηκε**, δηλαδή ένα σημείο
 *    που ο χρήστης έχει ήδη προσπεράσει. Γι' αυτό το `hoveredCoordinate` **δεν** είναι
 *    στις εξαρτήσεις του `useCallback`: αν ήταν, θα ξαναγραφόταν το callback σε **κάθε**
 *    κίνηση του ποντικιού, ακυρώνοντας τον throttle.
 *
 * 2. **Ο έλεγχος ταυτότητας σημείου.** Δύο αιτήματα μπορούν να επιστρέψουν εκτός σειράς.
 *    Χωρίς αυτόν, το υψόμετρο του **παλιού** σημείου θα γραφόταν πάνω στο **νέο** — τιμή
 *    που δεν είναι λάθος κατά τι, είναι **ξένη**.
 *
 * 3. **Ο φρουρός `alt !== undefined`.** Η γραφή του υψομέτρου αλλάζει το ίδιο το
 *    `hoveredCoordinate` που ενεργοποιεί αυτό το effect. Χωρίς τον φρουρό, κάθε επιτυχία
 *    θα ζητούσε ξανά την ίδια τιμή — **άπειρος βρόχος με κόστος δικτύου**.
 *
 * @module subapps/geo-canvas/hooks/map/useHoveredElevation
 */

import { useCallback, useEffect, useRef } from 'react';
import type { GeoCoordinate } from '../../types';
import { elevationService } from '../../services/map/ElevationService';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useHoveredElevation');

/**
 * Πόσο ακίνητος πρέπει να μείνει ο δείκτης πριν ρωτήσουμε την υπηρεσία υψομέτρου (ms).
 * Ο δείκτης περνά από εκατοντάδες σημεία ανά δευτερόλεπτο· ενδιαφέρει μόνο εκείνο στο
 * οποίο **στάθηκε**.
 */
const ELEVATION_SETTLE_MS = 500;

/**
 * Πόσο κοντά πρέπει να είναι δύο σημεία για να θεωρηθούν το ίδιο (μοίρες).
 * ~11 m στον ισημερινό — κάτω από την ακρίβεια που δίνει η ίδια η υπηρεσία.
 */
const SAME_COORDINATE_EPSILON = 0.0001;

/**
 * Συμπληρώνει το `alt` του σημείου κάτω από τον δείκτη, όταν αυτός σταθεί.
 *
 * Δεν επιστρέφει τίποτα: η τιμή γράφεται **εκεί όπου ζει ήδη** το σημείο, ώστε να μην
 * υπάρξει δεύτερη πηγή αλήθειας για το «πού είναι ο δείκτης».
 */
export function useHoveredElevation(
  hoveredCoordinate: GeoCoordinate | null,
  setHoveredCoordinate: (coord: GeoCoordinate | null) => void,
): void {
  const hoveredCoordinateRef = useRef<GeoCoordinate | null>(null);

  useEffect(() => {
    hoveredCoordinateRef.current = hoveredCoordinate;
  }, [hoveredCoordinate]);

  const fetchElevationForCoordinate = useCallback(
    async (lng: number, lat: number) => {
      try {
        const result = await elevationService.getElevation(lng, lat);
        if (result === null) return;

        const previous = hoveredCoordinateRef.current;
        if (!previous) return;

        const isSameCoordinate =
          Math.abs(previous.lat - lat) < SAME_COORDINATE_EPSILON &&
          Math.abs(previous.lng - lng) < SAME_COORDINATE_EPSILON;

        if (isSameCoordinate) {
          setHoveredCoordinate({ ...previous, alt: result });
        }
      } catch (error) {
        logger.warn('Elevation fetch failed', { lng, lat, error });
      }
    },
    [setHoveredCoordinate],
  );

  useEffect(() => {
    if (!hoveredCoordinate || hoveredCoordinate.alt !== undefined) return;

    const { lng, lat } = hoveredCoordinate;
    const timeoutId = setTimeout(() => {
      fetchElevationForCoordinate(lng, lat);
    }, ELEVATION_SETTLE_MS);

    return () => clearTimeout(timeoutId);
  }, [hoveredCoordinate, fetchElevationForCoordinate]);
}
