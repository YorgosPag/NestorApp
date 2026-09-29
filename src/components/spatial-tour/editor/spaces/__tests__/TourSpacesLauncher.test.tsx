/**
 * @fileoverview **ΤΟ ΒΗΜΑ «ΧΩΡΟΙ» ΣΤΗ ΣΤΗΛΗ** (ADR-884 Φ2στ-γ Γ3γ-2β · §12 Δ8.3 · Δ9.1) — πληρότητα + ποια σημεία λείπουν +
 * κουμπί που **δεν** προσφέρεται χωρίς κλίμακα (ο γραφέας θα απαντούσε `plan-uncalibrated`).
 */

import { render, screen } from '@testing-library/react';

import type { TourViewerGraph, ViewerLevelEntry, ViewerStop } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import type { TourNode } from '@/types/spatial-tour';

import type { TourPanoramaSource } from '../../../viewer/tour-panorama-source';
import type { TourEditorActions } from '../../useTourEditorActions';
import { TourSpacesLauncher } from '../TourSpacesLauncher';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string, v?: Record<string, unknown>) => (v === undefined ? key : `${key}:${JSON.stringify(v)}`) }),
}));
jest.mock('next/dynamic', () => () => () => null);

const L0 = { kind: 'local', ordinal: 0 } as const;
const rect = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const PLAN = { fileId: 'f1', source: 'engineer' as const, image: { width: 1000, height: 500, contentHash: 'h1' }, metresPerPixel: 0.01 };
const node = (id: string, x: number, y: number): TourNode => ({ id, levelKey: L0, position: { x, y, z: 0 }, links: [] });
const NODES = [node('a', 2, -2), node('b', 7, -2), node('c', 8, -1)];

function renderLauncher(spaces: ViewerLevelEntry['spaces'], calibrated = true) {
  const entry: ViewerLevelEntry = { id: 'l0', label: null, ordinal: 0, nodeIds: NODES.map((n) => n.id), hasPlan: true, plan: PLAN, spaces, separations: [] };
  const stop = (n: TourNode, number: number): ViewerStop =>
    ({ stop: { captureId: `c-${n.id}`, nodeId: n.id, capturedAt: '', headingRad: 0, tilesetHash: 'h', faceSize: 1024 }, node: n, levelId: 'l0', number });
  const graph: TourViewerGraph = { stops: new Map(NODES.map((n, i) => [n.id, stop(n, i + 1)])), levels: [entry], adjacency: new Map(), spaceAreas: 'shown' };
  render(<TourSpacesLauncher graph={graph} levelId="l0" levelKey={L0} nodes={NODES} levels={[]} source={{} as TourPanoramaSource}
    actions={{} as TourEditorActions} nameOf={(id) => `Σ-${id}`} calibrated={calibrated} />);
}

it('«Χώροι: 1 από 3 σημεία» + ΠΟΙΑ λείπουν, με τη σειρά τους — προειδοποίηση, όχι φραγή', () => {
  renderLauncher([{ id: 's1', points: rect(0, 0, 4, -4), source: 'detected' }]);
  expect(screen.getByRole('heading', { name: 'spatial-tour:spaceEditor.coverage:{"covered":1,"total":3}' })).toBeTruthy();
  expect(screen.getByText(/spaceEditor\.coverageMissing:\{"names":"Σ-b, Σ-c"\}/)).toBeTruthy();
  expect((screen.getByRole('button', { name: /spaceEditor\.open/ }) as HTMLButtonElement).disabled).toBe(false);
});

it('όλα καλυμμένα ⇒ «όλα τα σημεία έχουν χώρο» · χωρίς κλίμακα ⇒ κουμπί ανενεργό με εξήγηση', () => {
  renderLauncher([{ id: 's1', points: rect(0, 0, 9, -4), source: 'detected' }], false);
  expect(screen.getByText('spatial-tour:spaceEditor.coverageComplete')).toBeTruthy();
  expect(screen.getByText('spatial-tour:spaceEditor.needsScale')).toBeTruthy();
  expect((screen.getByRole('button', { name: /spaceEditor\.open/ }) as HTMLButtonElement).disabled).toBe(true);
});
