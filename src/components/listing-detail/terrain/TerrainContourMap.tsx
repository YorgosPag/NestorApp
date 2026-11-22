'use client';

/**
 * @fileoverview 🏔️ **Ο ΧΑΡΤΗΣ ΕΔΑΦΟΥΣ ΤΗΣ ΑΓΓΕΛΙΑΣ** — διακόπτης «Υψόμετρα | Κλίσεις» (Β6.2), σχέδιο, λεζάντα, κλειδί χρώματος
 *   (λωρίδα υψομέτρων ή πίνακας κλάσεων κλίσης), υπόμνημα (ADR-920 Β4.8 · Β6.2, Α5 · Α6).
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

import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { MapRampLegend, type MapLegendItem } from '@/components/market/MapRampLegend';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { useSvgFragmentId } from '@/hooks/media/useSvgFragmentId';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TerrainPointReading } from '@/lib/terrain/inspect/terrain-point-reading';
import type { TerrainMapMark, TerrainMapModel } from '@/lib/terrain/publication/terrain-map-model';

import { TerrainElevationLegend } from './TerrainElevationLegend';
import { TerrainInspectAnnouncer, TerrainInspectCard, opposingCorner } from './TerrainInspectCard';
import { useTerrainInspectStore } from './TerrainInspectContext';
import type { TerrainInspectLayerWords } from './TerrainInspectLayer';
import { TerrainMapSvg, type TerrainMapFill, type TerrainMapSvgWords } from './TerrainMapSvg';
import { TerrainSlopeTable } from './TerrainSlopeTable';
import { MarkSwatch, SparseSwatch, TerrainLineSwatch } from './terrain-map-symbols';
import { TERRAIN_MAP_WORD_NAMESPACES, lengthLabel, metresOf } from './terrain-map-words';

type T = ReturnType<typeof useTranslation>['t'];

const NS = 'listing-detail:terrain.map';
const MARK_KINDS: readonly TerrainMapMark['kind'][] = ['conflicting', 'coincident'];

/** Οι δύο χρωματισμοί, με τη σειρά του διακόπτη — πρώτο το υψόμετρο, όπως στον DXF viewer (ADR-920 Β6.2). */
const FILLS: readonly TerrainMapFill[] = ['elevation', 'slope'];

/**
 * ADR-920 Β6.9 — «ό,τι δηλώνεται = ό,τι σχεδιάζεται» (USGS · Esri multi-scale contours): όταν δεν χωρά **καμία** ενδιάμεση
 * (`minorShown === 'none'`), λεζάντα και περιγραφή δηλώνουν μόνο τις κύριες. Η απόφαση είναι του μοντέλου.
 */
function indexOnly(model: TerrainMapModel): boolean {
  return model.minorShown === 'none';
}

function descriptionKeyOf(model: TerrainMapModel, fill: TerrainMapFill): string {
  const base = fill === 'elevation' ? `${NS}.descriptionElevation` : `${NS}.description`;
  return indexOnly(model) ? `${base}IndexOnly` : base;
}

function svgWordsOf(t: T, model: TerrainMapModel, fill: TerrainMapFill): TerrainMapSvgWords {
  const interval = lengthLabel(t, model.contourIntervalM);
  return {
    title: t(`${NS}.title`),
    description: t(descriptionKeyOf(model, fill), {
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
  // Σύμβολο μόνο για γραμμή που ΣΧΕΔΙΑΣΤΗΚΕ — στο `'none'` δεν υπάρχει, και το λέει η σημείωση `MinorHiddenNote` (Β6.9).
  if (model.minorShown !== 'none' && model.minorContoursPathData.length > 0) {
    // Β6.8 — the reader is told when intermediates were dropped on steep ground (OS / USGS practice), never left to guess.
    const minorKey = model.minorShown === 'some' ? `${NS}.legend.minorThinned` : `${NS}.legend.minor`;
    add('contourMinor', <TerrainLineSwatch kind="contourMinor" />, t(minorKey, { interval: lengthLabel(t, model.contourIntervalM) }));
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

/** «Υψόμετρα | Κλίσεις» — ο κοινός `SegmentedControl` (radio group, βελάκια, ποτέ κενό). */
function FillSwitch({ fill, onFill, t }: { readonly fill: TerrainMapFill; readonly onFill: (fill: TerrainMapFill) => void; readonly t: T }) {
  return (
    <SegmentedControl value={fill} onValueChange={onFill} aria-label={t(`${NS}.fill.label`)}>
      {FILLS.map((item) => (
        <SegmentedControlItem key={item} value={item}>{t(`${NS}.fill.${item}`)}</SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

/**
 * Το κλειδί του χρώματος ανά χρωματισμό: λωρίδα υψομέτρων, ή ο πίνακας κλάσεων κλίσης με την ένδειξη «ενδεικτικές» (Α6),
 * που αφορά **μόνο** τις κλάσεις κλίσης.
 */
function FillKey({ model, fill, t }: { readonly model: TerrainMapModel; readonly fill: TerrainMapFill; readonly t: T }) {
  if (fill === 'elevation') return <TerrainElevationLegend model={model} t={t} />;
  return (
    <>
      <TerrainSlopeTable regions={model.slopeRegions} t={t} />
      <p className="m-0 text-xs text-muted-foreground" data-terrain-indicative="">{t(`${NS}.indicative`)}</p>
    </>
  );
}

/** Η λεζάντα: το διάστημα που ΣΧΕΔΙΑΖΕΤΑΙ σε αυτό το μέγεθος (USGS: η δήλωση διαστήματος ζει στο περιθώριο). */
function CaptionLine({ model, t }: { readonly model: TerrainMapModel; readonly t: T }) {
  const words = { interval: lengthLabel(t, model.contourIntervalM), major: lengthLabel(t, model.majorContourIntervalM) };
  return <p className="m-0 text-sm text-foreground">{t(indexOnly(model) ? `${NS}.captionIndexOnly` : `${NS}.caption`, words)}</p>;
}

/**
 * ADR-920 Β6.9 — σημείωση περιθωρίου, **όχι** γραμμή υπομνήματος: δείγμα για γραμμή που δεν υπάρχει στον χάρτη θα έλεγε
 * ψέματα. Λέει ποιο διάστημα λείπει και πού φαίνεται· το διάστημα του οικοπέδου (στατιστικά · 3Δ) δεν αλλάζει.
 */
function MinorHiddenNote({ model, t }: { readonly model: TerrainMapModel; readonly t: T }) {
  if (!indexOnly(model)) return null;
  return (
    <p className="m-0 text-xs text-muted-foreground" data-terrain-minor-hidden="">
      {t(`${NS}.minorHidden`, { interval: lengthLabel(t, model.contourIntervalM) })}
    </p>
  );
}

function inspectWordsOf(t: T, model: TerrainMapModel): TerrainInspectLayerWords {
  return {
    contourLabelOf: (levelM) => t(`${NS}.inspect.contourLabel`, { level: lengthLabel(t, levelM, model.contourIntervalM) }),
    profileStart: t(`${NS}.profile.start`),
    profileEnd: t(`${NS}.profile.end`),
  };
}

/**
 * ADR-920 §14.10 — ο χάρτης **με** επιθεώρηση όταν υπάρχει πάροχος (δημόσια αγγελία · προεπισκόπηση), αλλιώς σκέτο σχέδιο.
 * Το περιτύλιγμα υπάρχει μόνο ως πλαίσιο θέσης της κάρτας (`relative`), η οποία κάθεται στη γωνία απέναντι από το σημείο.
 */
function MapStage({ model, words, fill, t }: { readonly model: TerrainMapModel; readonly words: TerrainMapSvgWords; readonly fill: TerrainMapFill; readonly t: T }) {
  const store = useTerrainInspectStore();
  const inspect = useMemo(() => (store ? inspectWordsOf(t, model) : undefined), [store, t, model]);
  const { viewBox: box } = model;
  const cornerOf = useCallback(
    (reading: TerrainPointReading) => opposingCorner(reading.x, reading.y, box.minX + box.width / 2, -(box.minY + box.height / 2)),
    [box],
  );
  if (!inspect) return <TerrainMapSvg model={model} words={words} fill={fill} />;
  return (
    <>
      <div className="relative" data-terrain-map-stage="">
        <TerrainMapSvg model={model} words={words} fill={fill} inspect={inspect} />
        <TerrainInspectCard cornerOf={cornerOf} />
      </div>
      <p className="m-0 text-xs text-muted-foreground" data-terrain-inspect-hint="">{t(`${NS}.inspect.hint`)}</p>
      <TerrainInspectAnnouncer />
    </>
  );
}

export function TerrainContourMap({ model }: TerrainContourMapProps) {
  const { t } = useTranslation([...TERRAIN_MAP_WORD_NAMESPACES]);
  const [fill, setFill] = useState<TerrainMapFill>('elevation');
  const sparsePatternId = useSvgFragmentId('terrainsw');
  const words = useMemo(() => svgWordsOf(t, model, fill), [t, model, fill]);
  const legend = useMemo(() => legendItemsOf(t, model, sparsePatternId), [t, model, sparsePatternId]);
  return (
    <figure className="m-0 flex flex-col gap-3" data-terrain-contour-map="" data-terrain-fill={fill}>
      <FillSwitch fill={fill} onFill={setFill} t={t} />
      <MapStage model={model} words={words} fill={fill} t={t} />
      <figcaption className="flex flex-col gap-3">
        <CaptionLine model={model} t={t} />
        <MinorHiddenNote model={model} t={t} />
        <FillKey model={model} fill={fill} t={t} />
        <MapRampLegend caption={t(`${NS}.legend.caption`)} items={legend} />
      </figcaption>
    </figure>
  );
}
