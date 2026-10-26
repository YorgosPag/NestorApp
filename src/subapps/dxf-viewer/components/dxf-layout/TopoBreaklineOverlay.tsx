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
 * ADR-920 Β3.4 — «μάτι» + εστίαση από το `topo-breakline-display-store` (ίδιος store με το 3Δ layer και το
 * ribbon toggle): κρυμμένες ⇒ τίποτα (ο ΟΡΙΣΜΟΣ μένει, η επιφάνεια κόβεται κανονικά — Surface ↔ Style)·
 * η εστιασμένη σχεδιάζεται ΤΕΛΕΥΤΑΙΑ, με πάχος `focused` και την κοινή άλως (`committed-breakline-paint`) στη θέση
 * του περιβλήματος — ίδια όψη με την εστιασμένη υποψήφια, το μοτίβο της πηγής z μένει.
 *
 * ADR-040: standalone leaf· LOW-freq `subscribeTopo` + display store + geo-reference, ΕΝΑΣ high-freq hook
 * (transform).
 */
import React, { useSyncExternalStore } from 'react';
import { getTopoState, subscribeTopo } from '../../systems/topography/TopoPointStore';
import { TOPO_SURFACE_IDS } from '../../systems/topography/topo-types';
import {
  getBreaklineDisplayState, subscribeBreaklineDisplay,
} from '../../systems/topography/topo-breakline-display-store';
import { useTopoDisplayProjector } from '../../systems/topography/useTopoDisplayProjector';
import { useTransformValue } from '../../systems/cursor/ImmediateTransformStore';
import type { Viewport } from '../../rendering/types/Types';
import { breaklineScreenPath } from './topo-breakline-paint/topo-breakline-screen-path';
import { TopoBreaklineStroke } from './topo-breakline-paint/TopoBreaklineStroke';
import {
  committedBreaklinePaint, COMMITTED_BREAKLINE_DOTS,
} from './topo-breakline-paint/committed-breakline-paint';

interface Props {
  readonly viewport: Viewport;
}

export function TopoBreaklineOverlay({ viewport }: Props) {
  const state = useSyncExternalStore(subscribeTopo, getTopoState, getTopoState);
  const display = useSyncExternalStore(subscribeBreaklineDisplay, getBreaklineDisplayState, getBreaklineDisplayState);
  const transform = useTransformValue();
  const projector = useTopoDisplayProjector();

  if (!display.visible) return null;
  const { focusedId } = display;
  const all = TOPO_SURFACE_IDS.flatMap((id) => state.surfaces[id].breaklines);
  if (all.length === 0) return null;
  // SVG = painter's order: η εστιασμένη τελευταία ⇒ πάντα από πάνω, η άλως της δεν κρύβεται κάτω από τη διπλανή.
  const breaklines = [...all.filter((b) => b.id !== focusedId), ...all.filter((b) => b.id === focusedId)];

  return (
    <svg
      className="absolute inset-0 size-full pointer-events-none z-10"
      xmlns="http://www.w3.org/2000/svg"
    >
      {breaklines.map((b) => {
        const path = breaklineScreenPath(b.vertices, b.closed ?? false, projector, transform, viewport);
        const paint = committedBreaklinePaint(b.elevationSource, b.id === focusedId);
        return (
          <TopoBreaklineStroke
            key={b.id}
            d={path.d}
            vertices={path.vertices}
            under={paint.under}
            stroke={paint.stroke}
            dots={COMMITTED_BREAKLINE_DOTS}
          />
        );
      })}
    </svg>
  );
}
