'use client';

/**
 * @fileoverview 🏔️ **Ο ΧΑΡΤΗΣ ΕΔΑΦΟΥΣ ΤΗΣ ΑΓΓΕΛΙΑΣ** — σχέδιο, λεζάντα, πίνακας κλάσεων κλίσης, υπόμνημα (ADR-920 Β4.8, Α5 · Α6).
 * @related lib/terrain/publication/terrain-map-model (`terrainMapModelOf` — ο καλών το υπολογίζει, εδώ μόνο αποδίδεται) ·
 *   ./TerrainMapSvg · ./TerrainSlopeTable · ./terrain-map-symbols · components/market/MapRampLegend (`kind: 'symbol'`)
 * @module components/listing-detail/terrain/TerrainContourMap
 *
 * 🔑 **Λεπτή όψη πάνω σε καθαρό μοντέλο** (πρότυπο `floor-plate-view` → `FloorPlateUnitLayer`): δέχεται το έτοιμο
 *   `TerrainMapModel`. Η ίδια όψη υπηρετεί τη δημόσια αγγελία **και** την προεπισκόπηση του ιδιοκτήτη — η διαφορά είναι
 *   μόνο αν το μοντέλο κουβαλά σημάνσεις (`marks`), ποτέ δεύτερο συστατικό.
 * ♿ `<figure>`: το SVG (`role="img"`, τίτλος + περιγραφή) · η λεζάντα (ισοδιάσταση) · ο πίνακας κλάσεων (το υπόμνημα του
 *   χρώματος **και** η εναλλακτική σε κείμενο) · η ένδειξη «ενδεικτικές» (Α6 — ποτέ εκτίμηση κόστους) · το υπόμνημα των
 *   συμβόλων, μόνο όσων **υπάρχουν** στον χάρτη (Revit / ArchiCAD: υπόμνημα του φύλλου, όχι κατάλογος βιβλιοθήκης).
 */

import { useMemo, type ReactNode } from 'react';

import { MapRampLegend, type MapLegendItem } from '@/components/market/MapRampLegend';
import { useSvgFragmentId } from '@/hooks/media/useSvgFragmentId';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TerrainMapMark, TerrainMapModel } from '@/lib/terrain/publication/terrain-map-model';

import { TerrainMapSvg, type TerrainMapSvgWords } from './TerrainMapSvg';
import { TerrainSlopeTable } from './TerrainSlopeTable';
import { MarkSwatch, SparseSwatch, TerrainLineSwatch } from './terrain-map-symbols';
import { TERRAIN_MAP_WORD_NAMESPACES, lengthLabel, metresOf } from './terrain-map-words';

type T = ReturnType<typeof useTranslation>['t'];

const NS = 'listing-detail:terrain.map';
const MARK_KINDS: readonly TerrainMapMark['kind'][] = ['conflicting', 'coincident'];

function svgWordsOf(t: T, model: TerrainMapModel): TerrainMapSvgWords {
  const interval = lengthLabel(t, model.contourIntervalM);
  return {
    title: t(`${NS}.title`),
    description: t(`${NS}.description`, {
      interval, major: lengthLabel(t, model.majorContourIntervalM), scale: lengthLabel(t, model.scaleBar.lengthM),
    }),
    north: t(`${NS}.north`),
    levelOf: (levelM) => metresOf(levelM, model.contourIntervalM),
    scaleStart: metresOf(0, model.scaleBar.lengthM),
    scaleEnd: lengthLabel(t, model.scaleBar.lengthM),
  };
}

/** Τα σύμβολα που υπάρχουν σε ΑΥΤΟΝ τον χάρτη — ένα όριο που δεν σχεδιάστηκε δεν μπαίνει στο υπόμνημα. */
function legendItemsOf(t: T, model: TerrainMapModel, sparsePatternId: string): MapLegendItem[] {
  const items: MapLegendItem[] = [];
  const add = (key: string, node: ReactNode, label: string) =>
    items.push({ key, swatch: { kind: 'symbol', node }, label });
  if (model.minorContoursPathData.length > 0) {
    add('contourMinor', <TerrainLineSwatch kind="contourMinor" />, t(`${NS}.legend.minor`, { interval: lengthLabel(t, model.contourIntervalM) }));
  }
  if (model.majorContoursPathData.length > 0) {
    add('contourMajor', <TerrainLineSwatch kind="contourMajor" />, t(`${NS}.legend.major`, { major: lengthLabel(t, model.majorContourIntervalM) }));
  }
  add('extent', <TerrainLineSwatch kind="extent" />, t(`${NS}.legend.extent`));
  if (model.boundaryPathData !== null) add('boundary', <TerrainLineSwatch kind="boundary" />, t(`${NS}.legend.boundary`));
  if (model.sparsePathData !== null) add('sparse', <SparseSwatch patternId={sparsePatternId} />, t(`${NS}.legend.sparse`));
  for (const kind of MARK_KINDS) {
    if (model.marks.some((mark) => mark.kind === kind)) add(kind, <MarkSwatch kind={kind} />, t(`${NS}.legend.${kind}`));
  }
  return items;
}

export interface TerrainContourMapProps {
  readonly model: TerrainMapModel;
}

export function TerrainContourMap({ model }: TerrainContourMapProps) {
  const { t } = useTranslation([...TERRAIN_MAP_WORD_NAMESPACES]);
  const sparsePatternId = useSvgFragmentId('terrainsw');
  const words = useMemo(() => svgWordsOf(t, model), [t, model]);
  const legend = useMemo(() => legendItemsOf(t, model, sparsePatternId), [t, model, sparsePatternId]);
  return (
    <figure className="m-0 flex flex-col gap-3" data-terrain-contour-map="">
      <TerrainMapSvg model={model} words={words} />
      <figcaption className="flex flex-col gap-3">
        <p className="m-0 text-sm text-foreground">
          {t(`${NS}.caption`, { interval: lengthLabel(t, model.contourIntervalM), major: lengthLabel(t, model.majorContourIntervalM) })}
        </p>
        <TerrainSlopeTable regions={model.slopeRegions} t={t} />
        <p className="m-0 text-xs text-muted-foreground" data-terrain-indicative="">{t(`${NS}.indicative`)}</p>
        <MapRampLegend caption={t(`${NS}.legend.caption`)} items={legend} />
      </figcaption>
    </figure>
  );
}
