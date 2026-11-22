'use client';

/**
 * @fileoverview **Η ΚΑΡΤΑ ΤΟΥ ΣΗΜΕΙΟΥ** — τι είναι το έδαφος εκεί που δείχνεις: υψόμετρο, κλίση, φορά, ισοϋψής, μέτρηση ή
 *   παρεμβολή, όριο, όγκος, θέση (ADR-920 §14.10 Ε1 · Ε2 — η ΙΔΙΑ κάρτα σε Κάτοψη και 3Δ).
 * @related ./terrain-inspect-store (`activeReading`) · ./terrain-inspect-words (οι λέξεις) · ./TerrainInspectContext
 * @module components/listing-detail/terrain/TerrainInspectCard
 *
 * 🔑 **Στη γωνία ΑΠΕΝΑΝΤΙ από τον δείκτη** (όπως οι κάρτες hover των Google Maps / Figma): δεν σκεπάζει ποτέ το σημείο που
 *   εξετάζεις, και η θέση αλλάζει με **κλάσεις**, όχι με inline style (N.3). Ο επιλογέας της γωνίας είναι πρωτογενής τιμή ⇒
 *   η κάρτα δεν ξαναποδίδεται μόνο επειδή κινήθηκε ο δείκτης στο ίδιο τεταρτημόριο.
 * ♿ Όρος–τιμή σε `<dl>`· η ζωντανή περιοχή ανακοινώνει **μόνο** το καρφιτσωμένο σημείο (Enter / κλικ / πάτημα-κράτημα) — το
 *   hover στα 60 fps θα έπνιγε τον αναγνώστη οθόνης. Ποτέ μόνο χρώμα: κάθε τιμή είναι κείμενο.
 */

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TerrainPointReading } from '@/lib/terrain/inspect/terrain-point-reading';
import { slopeClassRange } from '@/lib/terrain/publication/terrain-map-regions';
import { cn } from '@/lib/utils';

import { useTerrainInspect, useTerrainInspectStore, useTerrainWorldCentre } from './TerrainInspectContext';
import { activeReading, type TerrainInspectState } from './terrain-inspect-store';
import {
  TERRAIN_INSPECT_NAMESPACES, distanceLabel, elevationLabel, localPositionLabel, slopeLabel, worldPositionWords,
} from './terrain-inspect-words';
import { TerrainFlowSummary } from './TerrainFlowSummary';
import { slopeRangeLabel } from './terrain-map-words';

type T = ReturnType<typeof useTranslation>['t'];

const NS = 'listing-detail:terrain.map.inspect';
const TOWARDS = 'listing-detail:terrain.stats.towards';

const selectShowsPinned = (s: TerrainInspectState): boolean => s.pinned !== null && s.probe === null;
const selectPinned = (s: TerrainInspectState) => s.pinned;
const selectFlow = (s: TerrainInspectState) => s.flow;
const FLOW = 'listing-detail:terrain.map.flow';

/**
 * Η γωνία της κάρτας. `bottom-left-raised` = κάτω αριστερά **πάνω** από την ένδειξη υπερβολής του 3Δ (εκεί ο κύβος πιάνει
 * πάνω δεξιά και το «Αρχική όψη» κάτω δεξιά — η κάρτα δεν σκεπάζει ποτέ χειριστήριο ή προειδοποίηση).
 */
export type TerrainCardCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'bottom-left-raised';

const CORNER_CLASS: Readonly<Record<TerrainCardCorner, string>> = {
  'top-left': 'left-2 top-2',
  'top-right': 'right-2 top-2',
  'bottom-left': 'bottom-2 left-2',
  'bottom-right': 'bottom-2 right-2',
  'bottom-left-raised': 'bottom-12 left-2',
};

/** Κάτοψη: η απέναντι γωνία από το (x, y) ως προς το κέντρο (cx, cy) — όλα στο πλαίσιο του snapshot (y = βορράς). */
export function opposingCorner(x: number, y: number, cx: number, cy: number): TerrainCardCorner {
  const vertical = y >= cy ? 'bottom' : 'top';
  const horizontal = x < cx ? 'right' : 'left';
  return `${vertical}-${horizontal}`;
}

function Row({ term, children }: { readonly term: string; readonly children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="m-0 tabular-nums text-foreground">{children}</dd>
    </>
  );
}

function SlopeRow({ reading, bandsPct, t }: { readonly reading: TerrainPointReading; readonly bandsPct: readonly number[]; readonly t: T }) {
  const range = slopeRangeLabel(t, slopeClassRange(bandsPct, reading.slopeClass));
  return <Row term={t(`${NS}.slope`)}>{slopeLabel(t, reading)} · {t(`${NS}.slopeClass`, { range })}</Row>;
}

function PositionRow({ reading, t }: { readonly reading: TerrainPointReading; readonly t: T }) {
  const centre = useTerrainWorldCentre();
  const { copy, copied } = useCopyToClipboard();
  const world = centre === null ? null : worldPositionWords(t, centre, reading.x, reading.y);
  return (
    <Row term={t(`${NS}.position`)}>
      <span className="block">{localPositionLabel(t, reading.x, reading.y)}</span>
      {world?.lines.map((line) => <span key={line} className="block">{line}</span>)}
      {world && (
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => void copy(world.copyText)}>
          {copied ? t(`${NS}.copied`) : t(`${NS}.copy`)}
        </Button>
      )}
    </Row>
  );
}

function ReadingRows({ reading, bandsPct, t }: { readonly reading: TerrainPointReading; readonly bandsPct: readonly number[]; readonly t: T }) {
  const contour = reading.nearestContour;
  const boundary = reading.boundary;
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      <Row term={t(`${NS}.elevation`)}>
        <span className="block font-medium">{elevationLabel(t, reading.elevationM)}</span>
        <span className="block text-muted-foreground">
          {t(`${NS}.relative`, { above: distanceLabel(t, reading.aboveLowestM), below: distanceLabel(t, reading.belowHighestM) })}
        </span>
      </Row>
      <SlopeRow reading={reading} bandsPct={bandsPct} t={t} />
      <Row term={t(`${NS}.downslope`)}>{reading.downslope ? t(`${TOWARDS}.${reading.downslope}`) : t(`${NS}.flat`)}</Row>
      {contour && (
        <Row term={t(`${NS}.contour`)}>
          {t(`${NS}.contourValue`, { level: elevationLabel(t, contour.levelM), distance: distanceLabel(t, contour.distanceM) })}
        </Row>
      )}
      <Row term={t(`${NS}.ground`)}>{reading.measured ? t(`${NS}.measured`) : t(`${NS}.interpolated`)}</Row>
      {boundary && (
        <Row term={t(`${NS}.boundary`)}>
          {t(boundary.inside ? `${NS}.inside` : `${NS}.outside`, { distance: distanceLabel(t, boundary.distanceM) })}
        </Row>
      )}
      {reading.underEnvelope && <Row term={t(`${NS}.envelopeTerm`)}>{t(`${NS}.envelope`)}</Row>}
      <PositionRow reading={reading} t={t} />
    </dl>
  );
}

interface TerrainInspectCardProps {
  /**
   * Πού κάθεται η κάρτα για ΑΥΤΗ την ανάγνωση — στην κάτοψη απέναντι από το σημείο του χάρτη (`opposingCorner`), στο 3Δ
   * ανάλογα με τη θέση του δείκτη στην οθόνη. Διαβάζεται τη στιγμή της απόδοσης (getter, κανόνας ADR-040).
   */
  readonly cornerOf: (reading: TerrainPointReading) => TerrainCardCorner;
}

export function TerrainInspectCard({ cornerOf }: TerrainInspectCardProps) {
  const { t } = useTranslation([...TERRAIN_INSPECT_NAMESPACES]);
  const store = useTerrainInspectStore();
  const reading = useTerrainInspect(activeReading);
  const pinned = useTerrainInspect(selectShowsPinned);
  const flow = useTerrainInspect(selectFlow);
  if (reading === null || store === null) return null;
  const bandsPct = store.index().snapshot.slopeBandsPct;
  const corner = cornerOf(reading);
  return (
    <aside aria-label={t(pinned ? `${NS}.pinned` : `${NS}.label`)} data-terrain-inspect-card="" data-corner={corner}
      className={cn('absolute z-[var(--z-index-docked)] flex max-w-[18rem] flex-col gap-2 rounded-md border border-border',
        'bg-popover p-2 text-xs text-popover-foreground shadow-md', CORNER_CLASS[corner])}>
      <ReadingRows reading={reading} bandsPct={bandsPct} t={t} />
      {pinned && flow && <TerrainFlowSummary flow={flow} t={t} />}
      {pinned && (
        <footer className="flex flex-wrap items-center gap-2">
          {!flow && (
            <Button type="button" variant="secondary" size="sm" onClick={store.dropWater}>
              {t(`${FLOW}.drop`)}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={store.unpin}>{t(`${NS}.unpin`)}</Button>
        </footer>
      )}
    </aside>
  );
}

/** Η ζωντανή περιοχή: ανακοινώνει ΜΟΝΟ το καρφιτσωμένο σημείο. Μένει ΠΑΝΤΑ στο DOM (κενή), αλλιώς δεν ανακοινώνει. */
export function TerrainInspectAnnouncer() {
  const { t } = useTranslation([...TERRAIN_INSPECT_NAMESPACES]);
  const pinned = useTerrainInspect(selectPinned);
  const text = pinned === null ? '' : t(`${NS}.announce`, { elevation: elevationLabel(t, pinned.elevationM), slope: slopeLabel(t, pinned) });
  return <p aria-live="polite" className="sr-only" data-terrain-inspect-announcer="">{text}</p>;
}
