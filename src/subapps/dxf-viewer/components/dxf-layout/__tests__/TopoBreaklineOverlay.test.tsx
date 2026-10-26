/**
 * @jest-environment jsdom
 *
 * ADR-920 Β4.8 Β3.4 — το «μάτι» και η εστίαση φτάνουν ως τα pixels της κάτοψης.
 *
 * Έλεγχος ΡΑΦΗΣ (store → overlay → SVG), όπως το `TopoAutoBreaklinePreviewOverlay.test`: κοιτά το
 * ΤΕΛΙΚΟ SVG, όχι τι κρατά ο store. Ο ορισμός μένει άθικτος όταν οι ασυνέχειες κρύβονται — αυτό
 * είναι το μισό του Surface ↔ Style split και ελέγχεται κι αυτό.
 */

import React from 'react';
import { act, render } from '@testing-library/react';
import { TopoBreaklineOverlay } from '../TopoBreaklineOverlay';
import { clearTopo, getTopoBreaklines } from '../../../systems/topography/TopoPointStore';
import {
  restoreBreaklineDisplay, setBreaklinesVisible, setFocusedBreakline,
} from '../../../systems/topography/topo-breakline-display-store';
import { seedBreakline } from '../../../systems/topography/__tests__/topo-breakline-fixtures';
import { UI_COLORS } from '../../../config/color-config';
import { updateImmediateTransform } from '../../../systems/cursor/ImmediateTransformStore';
import type { Viewport } from '../../../rendering/types/Types';

updateImmediateTransform({ scale: 1, offsetX: 0, offsetY: 0 });
const viewport = { width: 800, height: 600 } as unknown as Viewport;

const renderOverlay = () => render(<TopoBreaklineOverlay viewport={viewport} />);

function paths(container: HTMLElement): Array<{ stroke: string; width: number }> {
  return Array.from(container.querySelectorAll('path')).map((p) => ({
    stroke: p.getAttribute('stroke') ?? '',
    width: Number(p.getAttribute('stroke-width') ?? 0),
  }));
}

function seedTwo(): { first: string; second: string } {
  const first = seedBreakline([{ x: 0, y: 0, z: 0 }, { x: 1_000, y: 0, z: 100 }]);
  const second = seedBreakline([{ x: 0, y: 500, z: 0 }, { x: 1_000, y: 500, z: 100 }]);
  return { first, second };
}

describe('ADR-920 Β3.4 — TopoBreaklineOverlay: μάτι + εστίαση', () => {
  beforeEach(() => act(() => { clearTopo(); restoreBreaklineDisplay({ visible: true }); }));
  afterEach(() => act(() => { clearTopo(); restoreBreaklineDisplay({ visible: true }); }));

  it('ορατές: περίβλημα + γραμμή ανά ασυνέχεια, καμία άλως χωρίς εστίαση', () => {
    act(() => { seedTwo(); });
    const drawn = paths(renderOverlay().container);
    expect(drawn.filter((p) => p.stroke === UI_COLORS.TOPO_BREAKLINE)).toHaveLength(2);
    expect(drawn.some((p) => p.stroke === UI_COLORS.SELECTION_HIGHLIGHT)).toBe(false);
  });

  it('κρυμμένες: τίποτα στην κάτοψη — αλλά ο ΟΡΙΣΜΟΣ μένει (η επιφάνεια κόβεται κανονικά)', () => {
    act(() => { seedTwo(); });
    const { container } = renderOverlay();
    act(() => setBreaklinesVisible(false));
    expect(container.querySelector('svg')).toBeNull();
    expect(getTopoBreaklines('existing')).toHaveLength(2);
    act(() => setBreaklinesVisible(true));
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('εστιασμένη: άλως στο χρώμα επιλογής + πιο χοντρή, και ζωγραφίζεται ΤΕΛΕΥΤΑΙΑ', () => {
    let ids = { first: '', second: '' };
    act(() => { ids = seedTwo(); });
    act(() => setFocusedBreakline(ids.first)); // πρώτη στον ορισμό — πρέπει να πάει στο τέλος
    const drawn = paths(renderOverlay().container);

    // …, [άλως], [εστιασμένη γραμμή]
    expect(drawn.at(-2)?.stroke).toBe(UI_COLORS.SELECTION_HIGHLIGHT);
    const lines = drawn.filter((p) => p.stroke === UI_COLORS.TOPO_BREAKLINE);
    expect(lines.at(-1)?.width).toBeGreaterThan(lines[0]?.width ?? Infinity);
  });

  it('εστίαση σε id που δεν υπάρχει πια: απλώς καμία άλως', () => {
    act(() => { seedTwo(); });
    act(() => setFocusedBreakline('bl_gone'));
    const drawn = paths(renderOverlay().container);
    expect(drawn.some((p) => p.stroke === UI_COLORS.SELECTION_HIGHLIGHT)).toBe(false);
  });
});
