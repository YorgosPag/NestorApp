/**
 * @jest-environment jsdom
 */
/**
 * ADR-884 Φ2στ-γ Γ3γ-1 — **οι χώροι πάνω στην κάτοψη του θεατή** (§4.14 σημείο 4 · §12 Δ8.2–Δ8.6).
 *
 * Κάτοψη: Σαλόνι + Κουζίνα ενιαίοι με νοητή γραμμή · Αποθήκη χωρίς σημείο λήψης (με δικό της όνομα) · Μπάνιο με σημείο.
 * Ελέγχεται **τι βλέπει ο επισκέπτης**: ποιος χώρος είναι κίτρινος, ποιος απαλός, ποιος γκρι, τι εμβαδόν λέγεται και πώς.
 */

import { render } from '@testing-library/react';

import type { ViewerLevelEntry, ViewerStop } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import type { PlacedStop } from '@/lib/spatial-tour/viewer/tour-viewer-plan';
import type { TourNode } from '@/types/spatial-tour';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join('|')}` : key),
    isNamespaceReady: true,
  }),
}));
jest.mock('@/lib/intl-formatting', () => ({
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat('el-GR', options).format(value),
}));

import { TourPlanAreaNote, TourPlanSpaces } from '../TourPlanSpaces';

const L0 = { kind: 'local', ordinal: 0 } as const;
const box = (x0: number, y0: number, x1: number, y1: number) =>
  [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

const LEVEL: ViewerLevelEntry = {
  id: 'l0', label: null, ordinal: 0, nodeIds: ['n-living', 'n-bath'], hasPlan: true,
  plan: { fileId: 'f1', source: 'engineer', image: { width: 1000, height: 500, contentHash: 'h1' }, metresPerPixel: 0.02 },
  spaces: [
    { id: 'living', points: box(0, 0, 5.95, 4), source: 'detected' },
    { id: 'kitchen', points: box(6.05, 0, 9, 4), source: 'detected', declaredArea: { areaM2: 12.4, source: 'engineer-study' } },
    { id: 'bath', points: box(9.2, 0, 11, 4), source: 'detected' },
    { id: 'store', points: box(0, 4.2, 2.5, 7), source: 'manual', room: { types: ['storage'], label: 'Αποθήκη', source: 'manual' } },
  ],
  separations: [{ id: 'g1', a: { x: 6, y: -0.1 }, b: { x: 6, y: 4.1 } }],
};

const stop = (id: string, x: number, y: number, room: TourNode['room'] = null): PlacedStop => {
  const node: TourNode = { id, levelKey: L0, position: { x, y, z: 0 }, links: [], ...(room === null ? {} : { room }) };
  const entry: ViewerStop = { stop: { captureId: `c-${id}`, nodeId: id, capturedAt: '', headingRad: 0, tilesetHash: 'h', faceSize: 1024 }, node, levelId: 'l0', number: 1 };
  return { entry, point: node.position ?? { x, y, z: 0 } };
};
const STOPS = [stop('n-living', 3, 2, { types: ['living-room'], label: 'Σαλόνι', source: 'manual' }), stop('n-bath', 10, 2)];
const nameOf = (id: string) => (id === 'n-living' ? 'Σαλόνι' : 'Σημείο 2');

/** 1 px = 1 cm — αρκετά μεγάλο ζουμ ώστε να χωρούν όλες οι ετικέτες. */
function renderSpaces(current: string | null, areas: 'shown' | 'hidden' = 'shown') {
  return render(
    <svg>
      <TourPlanSpaces level={LEVEL} stops={STOPS} currentNodeId={current} nameOf={nameOf} areas={areas} scale={0.01} />
    </svg>,
  );
}
const toneOf = (container: HTMLElement) =>
  Object.fromEntries([...container.querySelectorAll('path[data-tone]')].map((p, i) => [LEVEL.spaces[i].id, p.getAttribute('data-tone')]));
const labels = (container: HTMLElement) => [...container.querySelectorAll('text')].map((t) => [...t.querySelectorAll('tspan')].map((s) => s.textContent));

describe('TourPlanSpaces — ρόλοι', () => {
  it('στο σαλόνι ⇒ σαλόνι κίτρινο, κουζίνα (ενιαίος γείτονας) απαλή, αποθήκη γκρι, μπάνιο τίποτα', () => {
    const { container } = renderSpaces('n-living');
    expect(toneOf(container)).toEqual({ living: 'here', kitchen: 'joined', bath: 'idle', store: 'uncaptured' });
    expect(container.querySelector('path[data-tone="here"]')?.getAttribute('class')).toContain('--plan-space-here');
  });

  it('στο μπάνιο ⇒ μόνο το μπάνιο κίτρινο (κοινός αληθινός τοίχος ≠ γειτονία)· η κουζίνα χωρίς σημείο λήψης ⇒ γκρι', () => {
    expect(toneOf(renderSpaces('n-bath').container)).toEqual({ living: 'idle', kitchen: 'uncaptured', bath: 'here', store: 'uncaptured' });
  });

  it('τα πολύγωνα δεν πιάνουν κλικ και δεν διαβάζονται (το κλικ ανήκει στις τελείες)', () => {
    const { container } = renderSpaces('n-living');
    expect(container.querySelector('[data-plan-spaces]')?.getAttribute('class')).toContain('pointer-events-none');
    expect(container.querySelector('path[data-tone]')?.closest('[aria-hidden]')).not.toBeNull();
  });
});

describe('TourPlanSpaces — ετικέτες (Δ8.4–Δ8.6)', () => {
  it('μετρημένο με «≈» και ακέραιο · δηλωμένο χωρίς «≈» με δύο δεκαδικά · όνομα σημείου > όνομα χώρου · ποτέ «Σημείο N»', () => {
    const texts = labels(renderSpaces('n-living').container);
    expect(texts).toContainEqual(['Σαλόνι', 'spatial-tour:viewer.spaceAreaMeasured:24']);
    expect(texts).toContainEqual(['spatial-tour:viewer.spaceAreaDeclared:12,40']);
    expect(texts).toContainEqual(['Αποθήκη', 'spatial-tour:viewer.spaceAreaMeasured:7']);
    expect(texts.flat().join(' ')).not.toContain('Σημείο');
  });

  it('σημείο ΧΩΡΙΣ δηλωμένο χώρο μέσα σε χώρο με όνομα ⇒ το όνομα του χώρου, ποτέ «Σημείο N»', () => {
    const stops = [...STOPS, stop('n-store', 1, 5)];
    const nameOfAll = (id: string) => (id === 'n-living' ? 'Σαλόνι' : 'Σημείο 9');
    const { container } = render(
      <svg><TourPlanSpaces level={LEVEL} stops={stops} currentNodeId="n-store" nameOf={nameOfAll} areas="shown" scale={0.01} /></svg>,
    );
    expect(labels(container)).toContainEqual(['Αποθήκη', 'spatial-tour:viewer.spaceAreaMeasured:7']);
    expect(labels(container).flat().join(' ')).not.toContain('Σημείο');
  });

  it('η πηγή της δήλωσης λέγεται (tooltip SVG)', () => {
    const title = renderSpaces('n-living').container.querySelector('text title');
    expect(title?.textContent).toBe('spatial-tour:viewer.spaceDeclaredFrom:spatial-tour:viewer.declaredSource.engineerStudy');
  });

  it('εμβαδά κρυφά ⇒ κανένα εμβαδόν, τα ονόματα μένουν', () => {
    const texts = labels(renderSpaces('n-living', 'hidden').container);
    expect(texts.flat().join(' ')).not.toMatch(/spaceArea/);
    expect(texts).toContainEqual(['Σαλόνι']);
  });

  it('🔑 ετικέτα που δεν χωρά ΔΕΝ γράφεται (μικρή κάρτα: 1 px = 20 cm)', () => {
    const { container } = render(
      <svg><TourPlanSpaces level={LEVEL} stops={STOPS} currentNodeId="n-living" nameOf={nameOf} areas="shown" scale={0.2} /></svg>,
    );
    expect(container.querySelectorAll('text')).toHaveLength(0);
    expect(container.querySelectorAll('path[data-tone]')).toHaveLength(4);
  });
});

describe('TourPlanAreaNote', () => {
  it('φαίνεται όταν υπάρχει μετρημένο εμβαδόν · όχι με εμβαδά κρυφά · όχι όταν όλα είναι δηλωμένα', () => {
    expect(render(<TourPlanAreaNote level={LEVEL} areas="shown" />).container.textContent).toBe('spatial-tour:viewer.spaceAreaNote');
    expect(render(<TourPlanAreaNote level={LEVEL} areas="hidden" />).container.textContent).toBe('');
    const declaredOnly = { ...LEVEL, spaces: [LEVEL.spaces[1]] };
    expect(render(<TourPlanAreaNote level={declaredOnly} areas="shown" />).container.textContent).toBe('');
  });
});
