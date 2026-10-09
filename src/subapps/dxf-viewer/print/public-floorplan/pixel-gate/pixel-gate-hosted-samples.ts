/**
 * @fileoverview Τα δείγματα που **κρέμονται από άλλο στοιχείο**: επένδυση τοίχου και εξάρτημα σωλήνα (CHECK 3.101).
 * @related ADR-909 §6.7 · ./pixel-gate-samples · ./pixel-gate-sample-kit
 * @module subapps/dxf-viewer/print/public-floorplan/pixel-gate/pixel-gate-hosted-samples
 *
 * 🔑 Κανένα από τα δύο δεν γράφεται με το χέρι: η επένδυση παίρνει τη γεωμετρία της από τον **τοίχο-ξενιστή** της,
 * και το εξάρτημα **προκύπτει** από δύο σωλήνες που συναντιούνται σε γωνία, με τον ίδιο επιλυτή που τρέχει στην
 * παραγωγή (`resolveDesiredFittings`) και το ίδιο εργοστάσιο (`createMepFitting`).
 *
 * ⚠️ Το κελί του εξαρτήματος κρατά **μόνο** το εξάρτημα: οι δύο σωλήνες υπάρχουν για να το γεννήσουν και δεν μπαίνουν
 * στη σκηνή, αλλιώς το χρώμα τους θα χρεωνόταν στο `mep-fitting`. Η επένδυση κρατά τον τοίχο της — χωρίς αυτόν δεν
 * στέκεται πουθενά — όπως το άνοιγμα στο διπλανό αρχείο.
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { RenderableEntityType } from '../../../rendering/contract/renderable-entity-type';
import type { Entity } from '../../../types/entities';
import {
  buildDefaultWallCoveringParams,
  buildWallCoveringEntity,
} from '../../../hooks/drawing/wall-covering-completion';
import { buildDefaultMepSegmentParams, buildMepSegmentEntity } from '../../../hooks/drawing/mep-segment-completion';
import { resolveDesiredFittings } from '../../../bim/mep-fittings/mep-fitting-resolve';
import { createMepFitting } from '@/services/factories/mep-fitting.factory';
import type { CellGeometry, SampleFactory } from './pixel-gate-sample-kit';
import { LAYER_ID, built, present, wallOf } from './pixel-gate-sample-kit';

/** Η επένδυση πιάνει το μεσαίο κομμάτι του τοίχου των 3 m, στην εσωτερική του όψη. */
const COVERING_SPAN_MM = { start: 500, end: 2500 } as const;

function wallCoveringOf(c: CellGeometry): Entity[] {
  const host = wallOf(c);
  const params = buildDefaultWallCoveringParams({
    hostWallId: host.id,
    faceSide: 'inner',
    spanStartMm: COVERING_SPAN_MM.start,
    spanEndMm: COVERING_SPAN_MM.end,
  });
  return [host, built('wall-covering', buildWallCoveringEntity(params, LAYER_ID, host))];
}

function pipeOf(start: Point2D, end: Point2D) {
  return built('mep-segment', buildMepSegmentEntity(buildDefaultMepSegmentParams(start, end, 'pipe'), LAYER_ID));
}

function mepFittingOf(c: CellGeometry): Entity[] {
  const pipes: Entity[] = [pipeOf(c.from, c.to), pipeOf(c.to, c.ring[2])];
  const draft = present('mep-fitting', resolveDesiredFittings(pipes)[0]);
  return [
    createMepFitting({
      params: draft.params,
      geometry: draft.geometry,
      validation: draft.validation,
      layerId: LAYER_ID,
      visible: true,
    }),
  ];
}

export const PIXEL_GATE_HOSTED_SAMPLES: Readonly<
  Record<Extract<RenderableEntityType, 'wall-covering' | 'mep-fitting'>, SampleFactory>
> = {
  'wall-covering': wallCoveringOf,
  'mep-fitting': mepFittingOf,
};
