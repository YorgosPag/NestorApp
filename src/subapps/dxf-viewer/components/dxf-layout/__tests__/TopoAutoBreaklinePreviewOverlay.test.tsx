/**
 * @jest-environment jsdom
 *
 * ADR-650 M8β/Γ — η ΕΣΤΙΑΣΗ φτάνει όντως ως τα pixels του καμβά.
 *
 * Είναι έλεγχος ΡΑΦΗΣ, όχι λογικής: το `focusedId` περνά store → hook → overlay → attribute, και
 * κάθε κρίκος μπορεί να το ρίξει **χωρίς κανένα type error, κανένα warning, κανένα κόκκινο test** —
 * ακριβώς όπως το `selected` του ⊙ πετάχτηκε σιωπηλά από τη χειροκίνητη λίστα props του
 * `ClashMarkerLayer` στο M5α.2. Το μόνο σύμπτωμα ήταν «δεν βλέπω την αλλαγή».
 *
 * Γι' αυτό οι έλεγχοι κοιτούν το ΤΕΛΙΚΟ SVG (άλως, πάχος, σειρά ζωγραφικής) και όχι τι κρατάει
 * το store — και επαληθεύτηκε ότι πέφτουν κόκκινοι αν αφαιρεθεί η εστίαση από το overlay.
 */

import React from 'react';
import { act, render } from '@testing-library/react';
import { TopoAutoBreaklinePreviewOverlay } from '../TopoAutoBreaklinePreviewOverlay';
import { autoBreaklineStore } from '../../../systems/topography/auto-breaklines/auto-breakline-store';
import type {
  AutoBreaklineCandidate,
  AutoBreaklineReport,
} from '../../../systems/topography/auto-breaklines/auto-breakline-types';
import { UI_COLORS } from '../../../config/color-config';
import type { ViewTransform, Viewport } from '../../../rendering/types/Types';

const transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
const viewport = { width: 800, height: 600 } as unknown as Viewport;

function candidate(id: string): AutoBreaklineCandidate {
  return {
    id,
    vertices: [{ x: 0, y: 0, z: 0 }, { x: 1_000, y: 1_000, z: 500 }],
    closed: false,
    lengthMm: 1_414,
    avgFoldDeg: 40,
    edgeCount: 1,
  };
}

const REPORT: AutoBreaklineReport = {
  surfaceId: 'existing',
  candidates: [candidate('a'), candidate('b')],
  droppedByCap: 0,
  notEnoughData: false,
};

const renderOverlay = () =>
  render(<TopoAutoBreaklinePreviewOverlay transform={transform} viewport={viewport} />);

/**
 * Κάθε γραφή στο store μέσα σε `act`. Το `reset` του afterEach τρέχει με το overlay ΑΚΟΜΗ mounted,
 * και μια ενημέρωση εκτός `act` αφήνει το React να αποδώσει σε άγνωστη στιγμή — θόρυβος σήμερα,
 * ανάγνωση του ΠΡΟΗΓΟΥΜΕΝΟΥ SVG την ημέρα που ένας έλεγχος θα εστιάσει μετά το render.
 */
const review = (mutate: () => void) => act(mutate);

/** Κάθε `<path>` με το πάχος και το χρώμα του, στη σειρά που ζωγραφίζεται. */
function paths(container: HTMLElement): Array<{ stroke: string; width: string }> {
  return Array.from(container.querySelectorAll('path')).map((p) => ({
    stroke: p.getAttribute('stroke') ?? '',
    width: p.getAttribute('stroke-width') ?? '',
  }));
}

describe('ADR-650 M8β/Γ — TopoAutoBreaklinePreviewOverlay', () => {
  beforeEach(() => review(() => autoBreaklineStore.reset()));
  afterEach(() => review(() => autoBreaklineStore.reset()));

  it('renders nothing while no pass is under review', () => {
    const { container } = renderOverlay();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('draws one path per candidate and no halo while nothing is focused', () => {
    review(() => autoBreaklineStore.setReport(REPORT));
    const drawn = paths(renderOverlay().container);

    expect(drawn).toHaveLength(2);
    expect(drawn.every((p) => p.stroke === UI_COLORS.TOPO_BREAKLINE_APPROVED)).toBe(true);
    expect(drawn.some((p) => p.stroke === UI_COLORS.SELECTION_HIGHLIGHT)).toBe(false);
  });

  it('gives the focused candidate a halo AND a thicker stroke — χρώμα ΚΑΙ μέγεθος', () => {
    review(() => autoBreaklineStore.setReport(REPORT));
    review(() => autoBreaklineStore.focus('a'));
    const drawn = paths(renderOverlay().container);

    const halo = drawn.find((p) => p.stroke === UI_COLORS.SELECTION_HIGHLIGHT);
    expect(halo).toBeDefined();

    const widths = drawn
      .filter((p) => p.stroke === UI_COLORS.TOPO_BREAKLINE_APPROVED)
      .map((p) => Number(p.width));
    expect(Math.max(...widths)).toBeGreaterThan(Math.min(...widths));
  });

  it('keeps the approval colour under the focus — δύο ερωτήσεις, δύο απαντήσεις', () => {
    review(() => autoBreaklineStore.setReport(REPORT));
    review(() => autoBreaklineStore.toggle('a')); // απορριφθείσα…
    review(() => autoBreaklineStore.focus('a'));  // …και εστιασμένη
    const drawn = paths(renderOverlay().container);

    expect(drawn.some((p) => p.stroke === UI_COLORS.TOPO_BREAKLINE_REJECTED)).toBe(true);
    expect(drawn.some((p) => p.stroke === UI_COLORS.SELECTION_HIGHLIGHT)).toBe(true);
  });

  it('draws the focused candidate LAST, so its halo is never buried under a neighbour', () => {
    review(() => autoBreaklineStore.setReport(REPORT));
    review(() => autoBreaklineStore.focus('a')); // πρώτη στο report — πρέπει να μετακινηθεί στο τέλος
    const drawn = paths(renderOverlay().container);

    // …, [μη εστιασμένη], [άλως], [εστιασμένη]
    expect(drawn.at(-2)?.stroke).toBe(UI_COLORS.SELECTION_HIGHLIGHT);
    expect(Number(drawn.at(-1)?.width)).toBeGreaterThan(Number(drawn[0]?.width));
  });
});
