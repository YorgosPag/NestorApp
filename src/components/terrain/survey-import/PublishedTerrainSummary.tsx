'use client';

/**
 * @fileoverview **Τι βλέπει ΗΔΗ ο αγοραστής** — το δημοσιευμένο έδαφος της αγγελίας, με την πηγή του (ADR-920 Β4.9).
 * @related lib/terrain/publication/listing-terrain-card (`ListingTerrainCard` — η κάρτα που κουβαλά η αγγελία) ·
 *   components/listing-detail/terrain/TerrainStatsList (οι ΙΔΙΟΙ αριθμοί με τη δημόσια σελίδα) ·
 *   services/realtime/hooks/usePublicListings (`usePublicListing` — ζωντανά, άρα αλλάζει μόλις ξαναπροβληθεί η αγγελία)
 * @module components/terrain/survey-import/PublishedTerrainSummary
 *
 * 🔑 Χωρίς αυτό ο ιδιοκτήτης δεν ξέρει αν ανεβάζει πρώτη φορά ή **αντικαθιστά** — και δεν βλέπει ότι η δημοσίευσή του
 *   έφτασε στην αγγελία. Διαβάζει την **κάρτα** (χωρίς mesh), όχι το στιγμιότυπο.
 */

import React, { useId } from 'react';

import { TerrainStatsList } from '@/components/listing-detail/terrain/TerrainStatsList';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDate } from '@/lib/intl-formatting';
import type { ListingTerrainCard } from '@/lib/terrain/publication/listing-terrain-card';

const NS = 'terrain-survey:current';

export function PublishedTerrainSummary({ card }: { readonly card: ListingTerrainCard | null }) {
  const { t } = useTranslation(['terrain-survey']);
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 rounded border border-border p-3">
      <h3 id={headingId} className="m-0 text-sm font-semibold text-foreground">{t(`${NS}.heading`)}</h3>
      {card === null ? (
        <p className="m-0 text-sm text-muted-foreground">{t(`${NS}.none`)}</p>
      ) : (
        <>
          <p className="m-0 text-sm text-foreground">
            {t(`${NS}.survey`, { name: card.survey.surveyorName, date: formatCalendarDate(card.survey.surveyedOn) })}
          </p>
          <TerrainStatsList stats={card.stats} contourIntervalM={card.contourIntervalM} />
          <p className="m-0 text-xs text-muted-foreground">{t(`${NS}.replaceHint`)}</p>
        </>
      )}
    </section>
  );
}
