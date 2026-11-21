'use client';

/**
 * @fileoverview ⛰️ **Η ΣΚΗΝΗ «ΑΝΑΓΛΥΦΟ» ΤΗΣ ΔΗΜΟΣΙΑΣ ΑΓΓΕΛΙΑΣ** — κάτοψη και 3Δ του μετρημένου εδάφους, με τους αριθμούς και
 *   την πηγή του (ADR-920 Β6.6).
 * @related ../media/ListingMediaViewer (η καρτέλα) · ./TerrainViewStage (η ΜΙΑ όψη «Κάτοψη | 3Δ») · ./TerrainStatsList ·
 *   hooks/listings/useListingTerrainSnapshot (το στιγμιότυπο, όταν ζητηθεί) · lib/terrain/publication/terrain-map-model
 * @module components/listing-detail/terrain/ListingTerrainPanel
 *
 * 🔑 **Οι αριθμοί δεν περιμένουν το δίκτυο**: η κάρτα (`ListingTerrainCard`) ταξιδεύει ήδη μέσα στην αγγελία ⇒ έκταση,
 *   υψόμετρα, κλίσεις, κατωφέρεια και τοπογράφος φαίνονται αμέσως. Μόνο η σκηνή περιμένει το στιγμιότυπο, σε κουτί
 *   σταθερής αναλογίας (μηδέν μετατόπιση διάταξης).
 * 🔑 **Δύο αποτυχίες, δύο προτάσεις**: «δεν φόρτωσε» προσφέρει επανάληψη· «δεν μπορεί να εμφανιστεί» όχι (δεν θα βοηθούσε).
 * 🔑 **Στατικά μόνο τα ελαφριά** (αριθμοί, πηγή, fetch): ο χάρτης και το «Κάτοψη | 3Δ» είναι τεμπέλικη επιφάνεια
 *   (`terrain-surfaces.tsx`) που κατεβαίνει **παράλληλα** με το στιγμιότυπο — εκτός slice και bundle της σελίδας (CHECK 3.34).
 * 🔑 **Το πλάτος μετριέται εδώ**, όσο κατεβαίνουν, ώστε η σκηνή να χτίσει τον χάρτη μία φορά για το πλάτος που φαίνεται.
 */

import { useCallback, useRef, useState } from 'react';

import { ListingStageFailure } from '@/components/listing-detail/ListingStageFailure';
import { Card } from '@/components/ui/card';
import { useSizeObserver } from '@/hooks/media/useElementSize';
import { useListingTerrainSnapshot, type ListingTerrainSnapshotApi } from '@/hooks/listings/useListingTerrainSnapshot';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { terrainMapWidthClassOf } from '@/lib/terrain/publication/terrain-map-model';
import type { ListingTerrain } from '@/types/public-listing';

import { TerrainStatsList } from './TerrainStatsList';
import { TerrainSurveyCredit } from './TerrainSurveyCredit';
// Το ΙΔΙΟ κουτί με την κάρτα εισόδου και τον καμβά του `TerrainViewStage` ⇒ καμία μετατόπιση όταν έρθει η σκηνή.
import { LazyTerrainSnapshotStage, TERRAIN_STAGE_NOTICE_BOX as NOTICE_BOX, TerrainStagePending } from './terrain-surfaces';

const NS = 'listing-detail:terrain.panel';

export interface ListingTerrainPanelProps {
  readonly terrain: ListingTerrain;
}

export function ListingTerrainPanel({ terrain }: ListingTerrainPanelProps) {
  const { t } = useTranslation(['listing-detail']);
  const ref = useRef<HTMLElement>(null);
  const [widthClass, setWidthClass] = useState<number | null>(null);
  const onSize = useCallback((width: number) => setWidthClass(terrainMapWidthClassOf(width)), []);
  useSizeObserver(ref, onSize, 'content-box');
  const snapshot = useListingTerrainSnapshot(terrain.url);
  return (
    <section ref={ref} aria-label={t(`${NS}.label`)} data-listing-terrain-panel="" className="flex flex-col gap-3">
      <TerrainStage api={snapshot} widthClass={widthClass} />
      <TerrainSurveyCredit survey={terrain.survey} />
      <TerrainStatsList stats={terrain.stats} contourIntervalM={terrain.contourIntervalM} />
    </section>
  );
}

interface TerrainStageProps {
  readonly api: ListingTerrainSnapshotApi;
  readonly widthClass: number | null;
}

/**
 * Η σκηνή ανά κατάσταση — κάθε κατάσταση στο ΙΔΙΟ κουτί. Η φόρτωση του στιγμιοτύπου και του χάρτη λέει την ΙΔΙΑ πρόταση
 * (`TerrainStagePending`): για τον επισκέπτη είναι μία αναμονή, όχι δύο.
 */
function TerrainStage({ api, widthClass }: TerrainStageProps) {
  const { t } = useTranslation(['listing-detail']);
  const { state, retry } = api;
  if (state.kind === 'ready') return <LazyTerrainSnapshotStage snapshot={state.snapshot} widthClass={widthClass} />;
  if (state.kind === 'loading') return <TerrainStagePending />;
  if (state.kind === 'unreachable') {
    return <ListingStageFailure boxClassName={NOTICE_BOX} message={t(`${NS}.unreachable`)} retryLabel={t(`${NS}.retry`)} onRetry={retry} />;
  }
  return (
    <Card asChild className={NOTICE_BOX}>
      <section aria-live="polite" data-listing-terrain-stage="refused">
        <p className="m-0 text-sm text-muted-foreground">{t(`${NS}.refused`)}</p>
      </section>
    </Card>
  );
}
