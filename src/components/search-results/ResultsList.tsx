'use client';

/**
 * Η λίστα της οθόνης 2 — **ζωντανή ταυτόχρονα** με τον χάρτη, ποτέ σε εναλλαγή.
 *
 * ⛔ ADR-777 Α3: *«Καμία εναλλαγή χάρτη ⇄ λίστας ως κύριος μηχανισμός, σε καμία
 * οθόνη»* — είναι η επιλογή (α), όπου μετρήθηκε **65%** να μη χρησιμοποιούν ποτέ τον
 * χάρτη. Τα δύο πλαίσια δείχνουν **το ίδιο φιλτραρισμένο σύνολο**, από την **ίδια**
 * συνάρτηση (`applyListingFilters`), γι' αυτό δεν μπορούν να διαφωνήσουν.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ListingCard } from './ListingCard';
import { UnmappedListingsRow } from './UnmappedListingsRow';
import type { PublicListing } from '@/types/public-listing';

interface ResultsListProps {
  readonly mapped: readonly PublicListing[];
  readonly unmapped: readonly PublicListing[];
  readonly highlightedId: string | null;
  readonly onHover: (id: string | null) => void;
  readonly onSelect: (id: string) => void;
}

export function ResultsList({ mapped, unmapped, highlightedId, onHover, onSelect }: ResultsListProps) {
  const { t } = useTranslation(['search-results']);
  const isEmpty = mapped.length === 0 && unmapped.length === 0;

  return (
    <section aria-label={t('search-results:list.label')} className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <p className="p-4 text-sm text-muted-foreground">{t('search-results:list.empty')}</p>
        ) : (
          <ul className="space-y-2 p-3">
            {mapped.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isHighlighted={listing.id === highlightedId}
                onHover={onHover}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </div>

      {/*
        ⛔ ΣΤΟ ΤΕΛΟΣ ΤΗΣ ΛΙΣΤΑΣ, ΜΕΣΑ ΣΤΟ ΙΔΙΟ ΠΛΑΙΣΙΟ — ποτέ δεύτερη επιφάνεια
        (Α5 §4.2, κανόνας 21). Και ποτέ φιλτραρισμένη από την κίνηση του χάρτη.
      */}
      <UnmappedListingsRow listings={unmapped} />
    </section>
  );
}
