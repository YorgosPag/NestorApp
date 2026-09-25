'use client';

/**
 * # Η ΘΕΣΗ ΤΟΥ ΟΙΚΙΣΜΟΥ ΜΕΣΑ ΣΤΟ ΟΡΙΟ (ADR-883 §5.10)
 *
 * Ο οικισμός δεν έχει επίσημο όριο — το Rightmove/Idealista **επινοούν** ένα, το Google δείχνει
 * **μόνο** πινέζα. Εδώ ο χάρτης δείχνει **και τα δύο επίσημα**: το περίγραμμα της κοινότητας (όπου
 * κρίνονται οι αγγελίες) **και** πινέζα με το όνομα στη θέση της ΕΛΣΤΑΤ (πού είναι το χωριό μέσα της).
 *
 * 🔑 **Δεν κλέβει κλικ** (`pointer-events-none`): είναι προσανατολισμός, όχι περιεχόμενο — οι
 * πινέζες των αγγελιών από κάτω πρέπει να μένουν πατήσιμες.
 *
 * ⚠️ Το όνομα έρχεται από το **ίδιο** ευρετήριο που φόρτωσε ήδη το chip — καμία νέα λήψη.
 */

import React from 'react';
import { MapPin } from 'lucide-react';

import { Marker } from '@/lib/maps/maplibre';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAdminAreaIndex } from '@/hooks/geo/useAdminAreaIndex';
import type { AdminPlace } from '@/lib/geo/admin-boundaries';

export function AdminPlaceMarker({ place }: { readonly place: AdminPlace }) {
  const { t, isNamespaceReady } = useTranslation(['search-region']);
  const name = useAdminAreaIndex()?.areas.get(place.adminId)?.name ?? null;

  return (
    <Marker latitude={place.point.lat} longitude={place.point.lng} anchor="bottom">
      <figure
        className="pointer-events-none flex flex-col items-center"
        role="img"
        aria-label={isNamespaceReady && name !== null ? t('search-region:boundary.settlementMarker', { name }) : undefined}
      >
        {name !== null && (
          <figcaption className="rounded-md border border-border bg-card px-2 py-0.5 text-xs font-semibold text-foreground shadow-sm">
            {name}
          </figcaption>
        )}
        <MapPin className="size-7 fill-card text-foreground drop-shadow" aria-hidden />
      </figure>
    </Marker>
  );
}
