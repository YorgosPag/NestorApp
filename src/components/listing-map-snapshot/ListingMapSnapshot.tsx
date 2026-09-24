'use client';

/**
 * @fileoverview **Η μικρογραφία χάρτη μιας αγγελίας** — ή η εφεδρεία της.
 * @related ADR-777 §8.70 (Φάση 2) · components/owner-property/OwnerPropertyCardCover
 * @module components/listing-map-snapshot/ListingMapSnapshot
 *
 * 🔑 **Η απόδοση είναι μέρος της εικόνας, όχι υποσημείωση**: οι όροι του OSMF ζητούν απόδοση
 * **ορατή και ευανάγνωστη** όπου εμφανίζεται ο χάρτης, και η λέξη «OpenStreetMap» ως σύνδεσμο.
 * Γι' αυτό ζει μέσα στο ίδιο `<figure>`, με χρώματα θέματος (`bg-card` / `text-card-foreground`).
 *
 * ⚠️ **Αποτυχία ⇒ εφεδρεία, ποτέ σπασμένη εικόνα**: χωρίς provider, με λήξη χρόνου ή σφάλμα
 * απόδοσης, η κάρτα δείχνει ό,τι θα έδειχνε αν δεν υπήρχε καθόλου χάρτης.
 */

import React from 'react';

import { useNearViewport } from '@/hooks/useNearViewport';
import type { ListingMapMark } from '@/lib/listings/listing-map-mark';
import type { MapAttributionSegment } from '@/lib/maps/map-attribution';

import { useListingMapSnapshot } from './use-listing-map-snapshot';

interface ListingMapSnapshotProps {
  readonly mark: ListingMapMark;
  readonly alt: string;
  /** Το κουτί (μέγεθος, αναλογία, στρογγύλεμα) — το ορίζει ο καταναλωτής. */
  readonly className: string;
  /** Ό,τι δείχνεται όταν χάρτης δεν μπορεί να υπάρξει. */
  readonly fallback: React.ReactNode;
  /**
   * Το κείμενο φόρτωσης για αναγνώστη οθόνης — **το δίνει ο καταναλωτής** (§8.80).
   *
   * 🔴 Ως τότε το αρχείο καλούσε `t('property-market:…')` μόνο του. Με την κάρτα **αναζήτησης** ως
   * καταναλωτή, αυτό θα έσερνε το namespace `property-market` στη στατική κλειστότητα του
   * **κελύφους** (CHECK 3.34) — δηλαδή σε ~150 διαδρομές που δεν το διαβάζουν ποτέ. Η θεραπεία
   * είναι να **κοπεί η εισαγωγή**, όχι να δηλωθεί το namespace.
   */
  readonly loadingLabel: string;
  /** Επικάλυψη πάνω στον χάρτη (π.χ. η θεραπεία «Πρόσθεσε φωτογραφίες»). */
  readonly children?: React.ReactNode;
}

function Attribution({ segments }: { readonly segments: readonly MapAttributionSegment[] }): React.ReactElement | null {
  if (segments.length === 0) return null;
  return (
    <figcaption className="absolute bottom-0 right-0 rounded-tl bg-card px-1 text-[0.625rem] leading-tight text-card-foreground">
      {segments.map((segment, i) =>
        segment.href === undefined ? (
          <React.Fragment key={i}>{segment.text}</React.Fragment>
        ) : (
          <a key={i} href={segment.href} target="_blank" rel="noopener noreferrer" className="underline">
            {segment.text}
          </a>
        ),
      )}
    </figcaption>
  );
}

export function ListingMapSnapshot({ mark, alt, className, fallback, loadingLabel, children }: ListingMapSnapshotProps): React.ReactElement {
  const [ref, near] = useNearViewport<HTMLElement>();
  const view = useListingMapSnapshot(mark, near);

  if (view.status === 'unavailable' || view.status === 'failed') return <>{fallback}</>;

  const ready = view.status === 'ready';
  return (
    <figure ref={ref} aria-busy={!ready} className={`${className} relative m-0 border border-border bg-muted`}>
      {ready ? (
        // eslint-disable-next-line @next/next/no-img-element -- `blob:` URL τοπικού στιγμιοτύπου· το next/image δεν έχει τι να βελτιστοποιήσει
        <img src={view.url} alt={alt} decoding="async" className="h-full w-full object-cover" />
      ) : (
        <span className="sr-only">{loadingLabel}</span>
      )}
      {ready ? <Attribution segments={view.attribution} /> : null}
      {children}
    </figure>
  );
}
