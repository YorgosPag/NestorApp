'use client';

/**
 * @fileoverview 🗺️ **ΤΟ SVG ΤΟΥ ΧΑΡΤΗ ΕΔΑΦΟΥΣ** — κλάσεις κλίσης, ισοϋψείς, ετικέτες, σημάνσεις, βορράς, κλίμακα (ADR-920 Β4.8, Α5).
 * @related lib/terrain/publication/terrain-map-model (ΤΙ ζωγραφίζεται — εδώ μόνο ΠΩΣ) · ./terrain-map-symbols · ./terrain-map-palette
 * @module components/listing-detail/terrain/TerrainMapSvg
 *
 * 📐 **1 μονάδα SVG = 1 m**, `viewBox` από το μοντέλο· κείμενα σε μέτρα (`labelHeightM`), γραμμές σε css px
 *   (`non-scaling-stroke`) — ο χάρτης μεγαλώνει με το κουτί του, οι γραμμές μένουν γραμμές.
 * 🖨️ **Χαρτί**: λευκό ορθογώνιο κάτω από όλα, στα δύο θέματα — το ΙΔΙΟ SVG πάει στο PDF του showcase.
 * 🧱 **Σειρά στρωμάτων** (z = σειρά στο DOM): χαρτί → κλάσεις → αραιή περιοχή → έκταση / όριο → δευτερεύουσες → κύριες →
 *   ετικέτες → σημάνσεις → βορράς · κλίμακα. Οι ετικέτες πάνω από τις γραμμές, με άλω (`paint-order: stroke`) αντί για
 *   κομμένη γραμμή· οι σημάνσεις πάνω από όλα, γιατί είναι ο λόγος που ο ιδιοκτήτης κοιτάζει.
 * ♿ `role="img"` + `<title>` / `<desc>` (`aria-labelledby`)· το περιεχόμενο ως κείμενο ζει στον πίνακα του `<figure>`.
 * 🎨 Μηδέν inline style (N.3): θέσεις σε γνωρίσματα, χρώματα σε κλάσεις της παλέτας.
 */

import { useSvgFragmentId } from '@/hooks/media/useSvgFragmentId';
import type { TerrainMapModel } from '@/lib/terrain/publication/terrain-map-model';

import {
  TERRAIN_CONTOUR_LABEL_CLASS, TERRAIN_NORTH_CLASS, TERRAIN_PAPER_CLASS, TERRAIN_SCALE_BAR_CLASS, TERRAIN_STROKE_PX,
  terrainSlopeFillClass,
} from './terrain-map-palette';
import { MarkGlyph, NON_SCALING, SparseHatchPattern, TerrainLine } from './terrain-map-symbols';

/** Τα κείμενα του SVG — ήδη μεταφρασμένα και μορφοποιημένα από τον καλούντα. */
export interface TerrainMapSvgWords {
  readonly title: string;
  readonly description: string;
  /** «Β» / «N». */
  readonly north: string;
  readonly levelOf: (levelM: number) => string;
  readonly scaleStart: string;
  readonly scaleEnd: string;
}

/** Αναλογίες προς το ύψος κειμένου του μοντέλου — όλα τα σύμβολα μεγαλώνουν μαζί με τα γράμματα. */
const HALO_RATIO = 0.28;
const MARK_RADIUS_RATIO = 0.4;
const HATCH_TILE_RATIO = 0.8;
const NORTH_LETTER_RATIO = 1.1;
const NORTH_OUTLINE_RATIO = 0.12;
/** Το λευκό ανάμεσα σε γεμίσματα γειτονικών κλάσεων (ραφή anti-aliasing) κλείνει με περίγραμμα ίδιου χρώματος. */
const SEAM_PX = 0.5;

function SlopeLayer({ model }: { readonly model: TerrainMapModel }) {
  return (
    <g data-terrain-layer="slope">
      {model.slopeRegions.filter((region) => region.pathData.length > 0).map((region) => (
        <path key={region.classIndex} d={region.pathData} fillRule="evenodd" data-slope-class={region.classIndex}
          className={terrainSlopeFillClass(region.classIndex)} strokeWidth={SEAM_PX} strokeLinejoin="round" {...NON_SCALING} />
      ))}
    </g>
  );
}

function ContourLabels({ model, levelOf }: { readonly model: TerrainMapModel; readonly levelOf: (levelM: number) => string }) {
  const size = model.labelHeightM;
  return (
    <g data-terrain-layer="labels" fontSize={size} strokeWidth={size * HALO_RATIO} textAnchor="middle"
      dominantBaseline="central" className={TERRAIN_CONTOUR_LABEL_CLASS}>
      {model.contourLabels.map((label) => (
        <text key={`${label.levelM}:${label.x}:${label.y}`} x={label.x} y={label.y}
          transform={`rotate(${label.angleDeg} ${label.x} ${label.y})`} data-level={label.levelM}>
          {levelOf(label.levelM)}
        </text>
      ))}
    </g>
  );
}

function NorthArrow({ model, letter }: { readonly model: TerrainMapModel; readonly letter: string }) {
  const { northArrow, labelHeightM } = model;
  return (
    <g data-terrain-layer="north" className={TERRAIN_NORTH_CLASS} strokeWidth={labelHeightM * NORTH_OUTLINE_RATIO}
      strokeLinejoin="round">
      <path d={northArrow.pathData} />
      <text x={northArrow.letter.x} y={northArrow.letter.y} textAnchor="middle" fontWeight="bold"
        fontSize={labelHeightM * NORTH_LETTER_RATIO}>
        {letter}
      </text>
    </g>
  );
}

/** Κλασική χαρτογραφική μπάρα: εναλλάξ γεμάτα / κενά τμήματα, «0» στην αρχή, μήκος με μονάδα στο τέλος. */
function ScaleBar({ model, start, end }: { readonly model: TerrainMapModel; readonly start: string; readonly end: string }) {
  const { scaleBar: bar, labelHeightM } = model;
  const part = bar.lengthM / bar.parts;
  const textY = bar.y + bar.heightM + labelHeightM;
  return (
    <g data-terrain-layer="scale" data-length={bar.lengthM}>
      {Array.from({ length: bar.parts }, (_, index) => (
        <rect key={index} x={bar.x + index * part} y={bar.y} width={part} height={bar.heightM} {...NON_SCALING}
          className={index % 2 === 0 ? TERRAIN_SCALE_BAR_CLASS.filled : TERRAIN_SCALE_BAR_CLASS.hollow}
          strokeWidth={TERRAIN_STROKE_PX.scaleBar} />
      ))}
      <g fontSize={labelHeightM} strokeWidth={labelHeightM * HALO_RATIO} textAnchor="middle"
        className={TERRAIN_SCALE_BAR_CLASS.label}>
        <text x={bar.x} y={textY}>{start}</text>
        <text x={bar.x + bar.lengthM} y={textY}>{end}</text>
      </g>
    </g>
  );
}

function Marks({ model }: { readonly model: TerrainMapModel }) {
  if (model.marks.length === 0) return null;
  const r = model.labelHeightM * MARK_RADIUS_RATIO;
  return (
    <g data-terrain-layer="marks">
      {model.marks.map((mark) => <MarkGlyph key={`${mark.kind}:${mark.x}:${mark.y}`} kind={mark.kind} x={mark.x} y={mark.y} r={r} />)}
    </g>
  );
}

export interface TerrainMapSvgProps {
  readonly model: TerrainMapModel;
  readonly words: TerrainMapSvgWords;
}

export function TerrainMapSvg({ model, words }: TerrainMapSvgProps) {
  const id = useSvgFragmentId('terrain');
  const { viewBox: box } = model;
  const sparseId = `${id}-sparse`;
  return (
    <svg viewBox={`${box.minX} ${box.minY} ${box.width} ${box.height}`} role="img"
      aria-labelledby={`${id}-title ${id}-desc`} data-terrain-map="" className="block h-auto w-full rounded-md border border-border">
      <title id={`${id}-title`}>{words.title}</title>
      <desc id={`${id}-desc`}>{words.description}</desc>
      {model.sparsePathData !== null && (
        <defs><SparseHatchPattern id={sparseId} tile={model.labelHeightM * HATCH_TILE_RATIO} /></defs>
      )}
      <rect x={box.minX} y={box.minY} width={box.width} height={box.height} className={TERRAIN_PAPER_CLASS} />
      <SlopeLayer model={model} />
      {model.sparsePathData !== null && (
        <path d={model.sparsePathData} fillRule="evenodd" fill={`url(#${sparseId})`} data-terrain-layer="sparse" />
      )}
      <TerrainLine kind="extent" d={model.extentPathData} />
      {model.boundaryPathData !== null && <TerrainLine kind="boundary" d={model.boundaryPathData} />}
      {model.minorContoursPathData.length > 0 && <TerrainLine kind="contourMinor" d={model.minorContoursPathData} />}
      {model.majorContoursPathData.length > 0 && <TerrainLine kind="contourMajor" d={model.majorContoursPathData} />}
      <ContourLabels model={model} levelOf={words.levelOf} />
      <Marks model={model} />
      <NorthArrow model={model} letter={words.north} />
      <ScaleBar model={model} start={words.scaleStart} end={words.scaleEnd} />
    </svg>
  );
}
