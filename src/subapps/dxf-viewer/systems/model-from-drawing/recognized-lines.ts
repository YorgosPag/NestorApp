/**
 * ADR-929 §6.20 — η στρώση **«Γραμμές»** της αναγνώρισης εικόνας: τα τμήματα που διάβασε η σύντηξη, ως κανονικές
 * `LineEntity` προς το layer `RECOGNIZED_Geometry` (πρότυπο: AutoCAD Raster Design — η διανυσματοποίηση βγάζει line με
 * τη θέση και το μήκος του πρωτοτύπου, σε layer κατηγορίας). Καθαρή προβολή + ιδεμποτία· **καμία** εγγραφή εδώ.
 *
 * Ποια τμήματα (ο ΕΝΑΣ κανόνας, για προεπισκόπηση και εγγραφή):
 *   · ρόλος `annotation` (πινελιές μέσα σε κείμενο) ⇒ **ποτέ** — όπως το `PDFIMPORT` δεν κάνει το SHX κείμενο χωρίς ρητή
 *     εντολή, δεν κάνουμε γράμματα σκόρπιες γραμμές·
 *   · γραμμή/επέκταση διάστασης που **ζωγραφίζει ήδη** μια διάσταση (νέα που γράφεται ή υπάρχουσα) ⇒ όχι· όσες δεν
 *     δέθηκαν σε διάσταση **μένουν γραμμές** — ποτέ χαμένες (ίδιος κανόνας με το ADR-941 Δ19)·
 *   · όλα τα άλλα (παρειές, άγνωστα), με βεβαιότητα ≥ του επιπέδου που διάλεξε ο άνθρωπος (Δ10).
 *
 * 🔑 Σημεία **μόνο** μέσω `rasterPixelToScene` (Δ3) — ίδιος πίνακας με τον ζωγράφο του υποβάθρου και τους τοίχους.
 * 🔑 Ιδεμποτία: γραμμή που υπάρχει ήδη στη σκηνή (ίδια άκρα, οποιαδήποτε φορά, εντός ανοχής 2 px της εικόνας) δεν
 *    ξαναγράφεται ⇒ δεύτερο πάτημα = μηδέν νέες, και οι διορθώσεις του ανθρώπου μένουν (καμία διαγραφή).
 *
 * ΚΑΘΑΡΟ, ντετερμινιστικό με δεδομένο `newId`.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity, LineEntity } from '../../types/entities';
import type { RasterSegment } from '../../bim/plan-recognition/plan-recognition-types';
import { rasterPixelToScene, type RasterPlacement } from '../../floorplan-background/geometry/raster-scene-mapping';
import { calculateDistance } from '../../rendering/entities/shared/geometry-vector-utils';
import { generateEntityId } from '../entity-creation/utils';
import { meetsConfidenceTier, planConfidenceTier, type PlanConfidenceTier } from '../plan-recognition/plan-confidence';
import type { RasterLineworkSource } from './proposal-line-source';
import { recognizedMetadata } from './recognized-provenance';

/** Το layer ορίζεται ΜΕΤΑ την ιδεμποτία: δεν φτιάχνουμε layer για μηδέν νέες γραμμές. */
const LAYER_RESOLVED_AFTER_DEDUPE = '';

export interface RecognizedLinesInput {
  readonly linework: RasterLineworkSource;
  readonly placement: RasterPlacement;
  readonly backgroundId: string;
  /** Ο άνθρωπος: «κράτα όσες έχουν βεβαιότητα ≥ αυτού». */
  readonly minTier: PlanConfidenceTier;
  /** Τμήματα που ζωγραφίζει ήδη μια διάσταση — δεν γίνονται γραμμές. */
  readonly absorbed: ReadonlySet<string>;
  /** Πηγή ids (N.6). Προεπιλογή: `generateEntityId`. */
  readonly newId?: () => string;
}

export interface RecognizedLinesPartition {
  /** Όσες δεν υπάρχουν ούτε στη σκηνή ούτε νωρίτερα στην ίδια παρτίδα — με τη σειρά της σύντηξης. */
  readonly fresh: readonly LineEntity[];
  /** Πόσες υπάρχουν ήδη. */
  readonly existing: number;
}

function isKeptSegment(segment: RasterSegment, input: RecognizedLinesInput): boolean {
  if (input.linework.segmentRoles.get(segment.id) === 'annotation') return false;
  if (input.absorbed.has(segment.id)) return false;
  return meetsConfidenceTier(input.linework.segmentConfidence.get(segment.id)?.score, input.minTier);
}

function lineOf(segment: RasterSegment, input: RecognizedLinesInput): LineEntity {
  const confidence = planConfidenceTier(input.linework.segmentConfidence.get(segment.id)?.score);
  return {
    id: (input.newId ?? generateEntityId)(),
    type: 'line',
    layerId: LAYER_RESOLVED_AFTER_DEDUPE,
    start: rasterPixelToScene(segment.start, input.placement),
    end: rasterPixelToScene(segment.end, input.placement),
    metadata: recognizedMetadata({ backgroundId: input.backgroundId, origin: 'segment', sourceId: segment.id, confidence }),
  };
}

/** Η πρόταση της στρώσης «Γραμμές» (πριν την ιδεμποτία), με τη σειρά της σύντηξης. */
export function planRecognizedLines(input: RecognizedLinesInput): LineEntity[] {
  return input.linework.adjustedSegments.filter((s) => isKeptSegment(s, input)).map((s) => lineOf(s, input));
}

type LineEnds = readonly [Point2D, Point2D];

/** Ίδια άκρα, με οποιαδήποτε φορά, εντός `tolerance` μονάδων σκηνής. */
function sameEnds(a: LineEnds, b: LineEnds, tolerance: number): boolean {
  const near = (p: Point2D, q: Point2D): boolean => calculateDistance(p, q) <= tolerance;
  return (near(a[0], b[0]) && near(a[1], b[1])) || (near(a[0], b[1]) && near(a[1], b[0]));
}

/**
 * Χωρίζει την πρόταση σε «νέες» και «υπάρχουν ήδη», απέναντι στις γραμμές της σκηνής (οποιουδήποτε layer: αν ο άνθρωπος
 * μετέφερε την κρατημένη γραμμή αλλού, παραμένει η ίδια γραμμή). Ιδεμποτία: ξανά πάνω στη σκηνή που προέκυψε ⇒ `fresh = []`.
 */
export function partitionNewLines(
  proposed: readonly LineEntity[],
  sceneEntities: readonly Entity[],
  tolerance: number,
): RecognizedLinesPartition {
  const known: LineEnds[] = sceneEntities
    .filter((e): e is LineEntity => e.type === 'line')
    .map((l) => [l.start, l.end] as const);
  const fresh: LineEntity[] = [];
  for (const line of proposed) {
    const ends: LineEnds = [line.start, line.end];
    if (known.some((k) => sameEnds(k, ends, tolerance))) continue;
    fresh.push(line);
    known.push(ends);
  }
  return { fresh, existing: proposed.length - fresh.length };
}
