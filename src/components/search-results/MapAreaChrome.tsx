'use client';

/**
 * # ΤΑ ΧΕΙΡΙΣΤΗΡΙΑ ΠΕΡΙΟΧΗΣ ΠΑΝΩ ΑΠΟ ΤΟΝ ΧΑΡΤΗ — ΜΙΑ ΑΠΟΦΑΣΗ, ΤΕΣΣΕΡΙΣ ΚΑΤΑΣΤΑΣΕΙΣ (ADR-885)
 *
 * | Κατάσταση | Τι δείχνεται |
 * |---|---|
 * | σχεδίαση σε εξέλιξη | η ζώνη σχεδίασης (οδηγία · μέτρηση · Αναίρεση/Ακύρωση/Εφαρμογή) |
 * | όριο δήμου | το chip του δήμου *(ADR-883)* |
 * | σχεδιασμένη περιοχή | το chip του σχεδίου (Επεξεργασία · Αφαίρεση ορίου) |
 * | καμία | χάπι «Αναζήτηση εδώ │ διακόπτης» + εργαλείο **Σχεδίαση** στην μπάρα (§8.85) |
 *
 * 🔑 **Ζει εδώ, όχι στο `SearchResultsContent`**: η σελίδα είναι ήδη στο όριο των 500
 * γραμμών (N.7.1), και η ερώτηση *«ποιο χειριστήριο πάνω από τον χάρτη;»* είναι **μία**
 * ευθύνη — το ίδιο σκεπτικό με το «ένα χειριστήριο που δεν κάνει τίποτα δεν δείχνεται» του
 * `MapAreaControl`.
 */

import React, { useMemo } from 'react';
import { Pencil } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { AdminBoundaryState } from '@/hooks/geo/useAdminBoundary';
import type { DrawAreaSession } from '@/hooks/listings/useDrawAreaSession';
import type { MapAreaSearch } from '@/hooks/listings/useMapAreaSearch';
import { searchDrawnArea } from '@/lib/listings/listing-drawn-area';
import { drawnPreviewCount, type DrawnPreviewCount } from '@/lib/listings/listing-drawn-preview';
import type { ListingFilters } from '@/lib/listings/listing-filters';
import type { ListingReadCoverage } from '@/lib/listings/listing-geo-query';
import type { GeoDrawnArea } from '@/types/geo/coordinates';
import type { PublicListing } from '@/types/public-listing';
import { MapAreaControl } from './MapAreaControl';
import { RegionBoundaryChip } from './RegionBoundaryChip';
import { DrawAreaToolbar } from './draw/DrawAreaToolbar';
import { DrawnAreaChip } from './draw/DrawnAreaChip';
import { LazyPriceMapControl } from './price-map/price-map-entry';
import { MapToolbarButton } from '@/subapps/geo-canvas/components/map-overlays/MapToolbar';

interface MapAreaChromeProps {
  readonly mapArea: MapAreaSearch;
  readonly region: AdminBoundaryState;
  readonly session: DrawAreaSession;
  /** Τα φίλτρα **όπως κρίνονται** — για τη ζωντανή μέτρηση με τον ίδιο φιλτραριστή. */
  readonly filters: ListingFilters;
  /** Ό,τι διαβάστηκε για την τρέχουσα περιοχή. */
  readonly listings: readonly PublicListing[];
  readonly coverage: ListingReadCoverage;
}

/**
 * Το εργαλείο «Σχεδίαση» στην μπάρα του χάρτη (ADR-777 §8.85) — μόνο όταν έχει φορτώσει το namespace
 * (ποτέ ωμά κλειδιά, CHECK 3.51).
 */
function DrawAreaButton({ onStart }: { readonly onStart: () => void }) {
  const { t, isNamespaceReady } = useTranslation(['search-region']);
  const iconSizes = useIconSizes();
  return isNamespaceReady ? (
    <MapToolbarButton
      label={t('search-region:draw.startLabel')}
      icon={<Pencil className={iconSizes.md} aria-hidden="true" />}
      onClick={onStart}
    />
  ) : null;
}

interface AreaChipInput {
  readonly session: DrawAreaSession;
  readonly region: AdminBoundaryState;
  readonly drawn: GeoDrawnArea | null;
  readonly mapArea: MapAreaSearch;
  readonly previewCount: DrawnPreviewCount | null;
}

/** **Ποιο chip;** — η σειρά του πίνακα της κεφαλίδας. `undefined` ⇒ διακόπτης + «Σχεδίαση». */
function areaChip({ session, region, drawn, mapArea, previewCount }: AreaChipInput): React.ReactNode {
  if (session.active) {
    const apply = (): void => {
      const area = session.finish();
      if (area !== null) mapArea.applyDrawnArea(area);
    };
    return <DrawAreaToolbar session={session} previewCount={previewCount} onApply={apply} />;
  }
  if (region.status !== 'none') {
    const framed = region.status === 'ready' ? region.boundary.region.bbox : null;
    return <RegionBoundaryChip region={region} onRemove={() => mapArea.removeRegion(framed)} onWiden={mapArea.selectRegion} />;
  }
  if (drawn !== null) {
    return <DrawnAreaChip area={drawn} onRemove={() => mapArea.removeRegion(drawn.bbox)} onEdit={() => session.start(drawn)} />;
  }
  return undefined;
}

export function MapAreaChrome({ mapArea, region, session, filters, listings, coverage }: MapAreaChromeProps) {
  const drawn = searchDrawnArea(filters.near);

  const previewCount = useMemo(
    () =>
      session.active && session.preview !== null
        ? drawnPreviewCount(listings, filters, session.preview, coverage)
        : null,
    [session.active, session.preview, listings, filters, coverage]
  );

  const chip = areaChip({ session, region, drawn, mapArea, previewCount });

  return (
    <MapAreaControl
      followMap={mapArea.followMap}
      onFollowMapChange={mapArea.setFollowMap}
      hasPendingArea={mapArea.pendingArea !== null}
      onSearchHere={mapArea.applyPendingArea}
      regionChip={chip}
      // Με chip η σχεδίαση ξανανοίγει ΑΠΟ το chip («Επεξεργασία») — δεύτερη πόρτα θα ήταν διπλή αλήθεια.
      drawButton={chip === undefined ? <DrawAreaButton onStart={() => session.start(null)} /> : null}
      layerControl={session.active ? null : <LazyPriceMapControl />}
    />
  );
}
