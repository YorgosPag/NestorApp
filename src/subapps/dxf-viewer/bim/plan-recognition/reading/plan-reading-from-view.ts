/**
 * Η ελεγμένη ανάγνωση της όψης ⇒ {@link PlanReading} στα **αρχικά** px (ADR-929 Δ3, Δ5, Δ9). Τρέχει στον πελάτη, που
 * κρατά την ευθυγράμμιση· ο διακομιστής απαντά σε `view-‰` και δεν γνωρίζει ομογραφίες.
 *
 * 🔑 Η βεβαιότητα του παρόχου γίνεται ο παράγοντας `reading` (Δ9). Οι παράγοντες `geometry` / `solver` προστίθενται στη
 * σύντηξη της Φ4, ποτέ εδώ: μια ανάγνωση δεν ξέρει τίποτα για τη γεωμετρία.
 * 🔑 Μια διάσταση χωρίς τιμή σε mm (ο πάροχος δεν ήταν σίγουρος για τη μονάδα) **δεν** γίνεται περιορισμός του λύτη. Το
 * κείμενό της μένει στα `texts`, ώστε ο άνθρωπος να το δει.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/reading/plan-reading-from-view
 */

import type { Homography } from '@/lib/geometry/homography';
import type {
  PlanConfidence,
  PlanDimension,
  PlanOpeningReading,
  PlanReading,
  PlanRoomReading,
  PlanText,
} from '../plan-recognition-types';
import { viewBoxToOriginal, type PlanReadingView } from './plan-reading-view';
import type { PlanViewReading } from './plan-reading-wire';

const readingConfidence = (score: number): PlanConfidence => ({ score, factors: { reading: score } });

export interface PlanReadingProvenance {
  readonly model: string;
  readonly schemaVersion: number;
}

export function planReadingFromView(
  reading: PlanViewReading,
  view: PlanReadingView,
  alignedToOriginal: Homography,
  provenance: PlanReadingProvenance,
): PlanReading {
  const texts: PlanText[] = reading.texts.map((t) => ({
    id: t.id,
    kind: t.kind,
    raw: t.raw,
    rect: viewBoxToOriginal(t.box, view, alignedToOriginal),
    confidence: readingConfidence(t.confidence),
  }));
  const dimensions: PlanDimension[] = reading.dimensions.flatMap((d) =>
    d.valueMm !== null && d.valueMm > 0
      ? [{ textId: d.textId, valueMm: d.valueMm, segmentIds: d.segmentIds, confidence: readingConfidence(d.confidence) }]
      : [],
  );
  const rooms: PlanRoomReading[] = reading.rooms.map((r) => ({
    name: r.name,
    writtenAreaM2: r.writtenAreaM2 !== null && r.writtenAreaM2 > 0 ? r.writtenAreaM2 : null,
    boundarySegmentIds: r.boundarySegmentIds,
    nameTextId: r.nameTextId,
    confidence: readingConfidence(r.confidence),
  }));
  const openings: PlanOpeningReading[] = reading.openings.map((o) => ({
    kind: o.kind,
    hostSegmentId: o.hostSegmentId,
    alongFraction: o.alongFraction,
    sizeTextId: o.sizeTextId,
    confidence: readingConfidence(o.confidence),
  }));
  const s = reading.writtenScale;
  return {
    model: provenance.model,
    schemaVersion: provenance.schemaVersion,
    texts,
    dimensions,
    writtenScale: s === null ? null : { textId: s.textId, denominator: s.denominator, confidence: readingConfidence(s.confidence) },
    rooms,
    openings,
  };
}
