'use client';

/**
 * # Η ΣΧΕΔΙΑΣΜΕΝΗ ΠΕΡΙΟΧΗ ΜΕΣΑ ΣΤΟΝ ΧΑΡΤΗ — σε εξέλιξη ή εφαρμοσμένη (ADR-885)
 *
 * Όσο διαρκεί η σχεδίαση: το σχέδιο (διακεκομμένο) + η επιφάνεια που πιάνει τη χειρονομία.
 * Αλλιώς: η εφαρμοσμένη περιοχή, αν ο σύνδεσμος ζητά μία. Ποτέ και τα δύο — η επεξεργασία
 * ξεκινά **από** τα εφαρμοσμένα σχήματα, άρα δύο στρώσεις θα ζωγράφιζαν το ίδιο σχήμα δύο φορές.
 */

import React from 'react';

import type { DrawAreaSession } from '@/hooks/listings/useDrawAreaSession';
import type { GeoDrawnArea } from '@/types/geo/coordinates';
import { DrawAreaSurface } from './DrawAreaSurface';
import { DrawnAreaLayer } from './DrawnAreaLayer';

interface SearchAreaMapLayerProps {
  readonly session: DrawAreaSession;
  readonly applied: GeoDrawnArea | null;
}

export function SearchAreaMapLayer({ session, applied }: SearchAreaMapLayerProps) {
  if (session.active) {
    return (
      <>
        <DrawnAreaLayer key="draft" shapes={session.shapes} trace={session.trace} draft />
        <DrawAreaSurface
          trace={session.trace}
          onStroke={session.addStroke}
          onVertex={session.addVertex}
          onCloseTrace={session.closeTrace}
        />
      </>
    );
  }
  // 🔴 **`key` ανά κατάσταση — επαληθεύτηκε ζωντανά (2026-09-25).** Χωρίς αυτό, η «Επεξεργασία» έκανε
  //    το React να ξαναχρησιμοποιήσει το ΙΔΙΟ `<Source>` με άλλο `id` (`drawn-area` → `drawn-area-draft`)
  //    και το react-maplibre πετούσε `source id changed` ⇒ ολόκληρη η σελίδα στο error boundary.
  return applied === null ? null : <DrawnAreaLayer key="applied" shapes={applied.shapes} />;
}
