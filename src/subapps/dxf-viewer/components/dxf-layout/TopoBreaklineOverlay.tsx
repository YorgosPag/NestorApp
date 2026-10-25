'use client';
/**
 * ADR-920 Β4.8 Β1 · ADR-650 M2-Β — οι ΔΕΣΜΕΥΜΕΝΕΣ γραμμές ασυνέχειας στην κάτοψη.
 *
 * Πριν από αυτό, μια ασυνέχεια που έκοβε την επιφάνεια δεν φαινόταν πουθενά — ο μηχανικός πατούσε μια γραμμή
 * και έβλεπε μόνο ένα hint. Civil 3D: η ασυνέχεια φαίνεται πάντα μέσω του αντικειμένου-πηγής· Carlson:
 * «Highlight Breaklines» σε κίτρινο. Εδώ: **πάντα ορατές** όσο υπάρχουν, κίτρινες με σκούρο περίβλημα (κάθονται
 * πάνω στη γραμμή του σχεδίου από την οποία φτιάχτηκαν), με το ΜΟΤΙΒΟ να λέει από πού ήρθε το z
 * (`topo-breakline-style`) και κουκκίδες εκεί όπου ορίζεται.
 *
 * Όλες οι επιφάνειες (`TOPO_SURFACE_IDS`), όχι μόνο η `existing` — μια ασυνέχεια της `proposed` κόβει κι αυτή.
 * Σχεδιάζεται ΚΑΤΩ από τις υποψήφιες υπό έγκριση (σειρά mount): η πρόταση είναι η ερώτηση της στιγμής.
 *
 * ADR-040: standalone leaf· LOW-freq `subscribeTopo` + geo-reference, ΕΝΑΣ high-freq hook (transform).
 */
import React, { useSyncExternalStore } from 'react';
import { getTopoState, subscribeTopo } from '../../systems/topography/TopoPointStore';
import { TOPO_SURFACE_IDS } from '../../systems/topography/topo-types';
import {
  breaklineDash, TOPO_BREAKLINE_STROKE_PX, TOPO_BREAKLINE_VERTEX_DOT_PX,
} from '../../systems/topography/topo-breakline-style';
import { useTopoDisplayProjector } from '../../systems/topography/useTopoDisplayProjector';
import { useTransformValue } from '../../systems/cursor/ImmediateTransformStore';
import { UI_COLORS } from '../../config/color-config';
import type { Viewport } from '../../rendering/types/Types';
import { breaklineScreenPath } from './topo-breakline-paint/topo-breakline-screen-path';
import {
  TopoBreaklineStroke, type BreaklineStrokeSpec, type BreaklineVertexDots,
} from './topo-breakline-paint/TopoBreaklineStroke';

interface Props {
  readonly viewport: Viewport;
}

const CASING: BreaklineStrokeSpec = {
  color: UI_COLORS.TOPO_BREAKLINE_CASING, widthPx: TOPO_BREAKLINE_STROKE_PX.casing,
};

const DOTS: BreaklineVertexDots = {
  diameterPx: TOPO_BREAKLINE_VERTEX_DOT_PX, fill: UI_COLORS.TOPO_BREAKLINE, outline: UI_COLORS.TOPO_BREAKLINE_CASING,
};

export function TopoBreaklineOverlay({ viewport }: Props) {
  const state = useSyncExternalStore(subscribeTopo, getTopoState, getTopoState);
  const transform = useTransformValue();
  const projector = useTopoDisplayProjector();

  const breaklines = TOPO_SURFACE_IDS.flatMap((id) => state.surfaces[id].breaklines);
  if (breaklines.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 size-full pointer-events-none z-10"
      xmlns="http://www.w3.org/2000/svg"
    >
      {breaklines.map((b) => {
        const path = breaklineScreenPath(b.vertices, b.closed ?? false, projector, transform, viewport);
        return (
          <TopoBreaklineStroke
            key={b.id}
            d={path.d}
            vertices={path.vertices}
            under={CASING}
            stroke={{
              color: UI_COLORS.TOPO_BREAKLINE,
              widthPx: TOPO_BREAKLINE_STROKE_PX.stroke,
              dash: breaklineDash(b.elevationSource),
            }}
            dots={DOTS}
          />
        );
      })}
    </svg>
  );
}
