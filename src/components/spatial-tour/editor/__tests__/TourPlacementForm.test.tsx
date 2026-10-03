/**
 * @jest-environment jsdom
 */
/**
 * ADR-884 Φ2δ · ADR-904 Κ8 — η φόρμα τοποθέτησης με την πρόταση θέσης του φωτογράφου.
 *
 * - **Χ** — χωρίς πρόταση: προεπιλογή ο πρώτος όροφος (συμπεριφορά πριν το Κ8, αμετάβλητη)·
 * - **Π** — πρόταση ορόφου που υπάρχει ⇒ **προεπιλεγμένος**· η τοποθέτηση μένει πράξη του υπευθύνου (κλικ)·
 * - **Ν** — πρόταση νέου τοπικού ορόφου (υπόγειο) ⇒ προσφέρεται **και** προεπιλέγεται, δίπλα στον επόμενο νέο·
 * - **Γ** — όροφος BIM εκτός περιήγησης ⇒ **δεν** επινοείται· προεπιλογή ο πρώτος, και η πρόταση το λέει ρητά.
 * - **Σ** (ADR-904 Κ9) — σημείο στην ίδια βαθμονομημένη κάτοψη ⇒ «στη θέση της πρότασης» προεπιλεγμένο, ένα κλικ = νέο σημείο **με**
 *   θέση σε μέτρα· ξετσεκάρισμα ⇒ χωρίς θέση· αλλαγμένη κάτοψη ⇒ η επιλογή **δεν** προσφέρεται (ποτέ μεταφορά).
 */

import { fireEvent, render, screen } from '@testing-library/react';

import { buildViewerGraph } from '@/lib/spatial-tour/viewer/tour-viewer-graph';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join('|')}` : key),
    isNamespaceReady: true,
  }),
}));

interface FakeSelectProps {
  readonly id: string; readonly label: string; readonly value: string;
  readonly options: readonly { readonly value: string; readonly label: string }[]; readonly onChange: (value: string) => void;
}
jest.mock('../../LabeledSelect', () => ({
  LabeledSelect: ({ id, label, value, options, onChange }: FakeSelectProps) => (
    <label htmlFor={id}>{label}
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  ),
}));

import type { TourViewerLevel } from '@/lib/spatial-tour/viewer/tour-viewer-graph';

import { createDemoPanoramaSource } from '../../viewer/demo/demo-panorama-source';
import { DEMO_TOUR_LEVELS, DEMO_TOUR_MANIFEST } from '../../viewer/demo/demo-tour';
import { TourPlacementForm } from '../TourPlacementForm';

const GRAPH = buildViewerGraph(DEMO_TOUR_MANIFEST, DEMO_TOUR_MANIFEST.levels);
const floor = () => screen.getByLabelText('spatial-tour:editor.floor');
const place = () => fireEvent.click(screen.getByRole('button', { name: 'spatial-tour:editor.place' }));

const SOURCE = createDemoPanoramaSource(() => 1);

function renderForm(hint?: Parameters<typeof TourPlacementForm>[0]['hint'], levels: readonly TourViewerLevel[] = DEMO_TOUR_LEVELS) {
  const onPlace = jest.fn();
  render(<TourPlacementForm captureId="tcap_1" levels={levels} graph={GRAPH} busy={false} onPlace={onPlace} hint={hint} source={SOURCE} />);
  return onPlace;
}

describe('TourPlacementForm — πρόταση θέσης', () => {
  it('Χ — χωρίς πρόταση: ο πρώτος όροφος, καμία γραμμή πρότασης', () => {
    renderForm();
    expect(floor()).toHaveValue('floor:demo_upper');
    expect(screen.queryByText('spatial-tour:panel.hintFrom')).toBeNull();
  });

  it('Π — όροφος που υπάρχει ⇒ προεπιλεγμένος· η τοποθέτηση γίνεται ΜΟΝΟ με κλικ', () => {
    const onPlace = renderForm({ level: { kind: 'floor', floorId: 'demo_ground' } });
    expect(floor()).toHaveValue('floor:demo_ground');
    expect(screen.getByText('spatial-tour:panel.hintFrom')).toBeInTheDocument();
    expect(onPlace).not.toHaveBeenCalled();
    place();
    expect(onPlace).toHaveBeenCalledWith({ kind: 'new-node', levelKey: { kind: 'floor', floorId: 'demo_ground' }, linkFrom: null });
  });

  it('Ν — νέος τοπικός (υπόγειο) ⇒ προσφέρεται και προεπιλέγεται, δίπλα στον επόμενο νέο', () => {
    const onPlace = renderForm({ level: { kind: 'local', ordinal: -1 } });
    expect(floor()).toHaveValue('local:-1');
    expect(screen.getByRole('option', { name: 'spatial-tour:editor.newFloor:0' })).toBeInTheDocument();
    place();
    expect(onPlace).toHaveBeenCalledWith({ kind: 'new-node', levelKey: { kind: 'local', ordinal: -1 }, linkFrom: null });
  });

  it('Γ — όροφος BIM εκτός περιήγησης ⇒ δεν επινοείται· προεπιλογή ο πρώτος', () => {
    renderForm({ level: { kind: 'floor', floorId: 'gone' } });
    expect(floor()).toHaveValue('floor:demo_upper');
    expect(screen.queryByRole('option', { name: /gone/ })).toBeNull();
  });
});

describe('TourPlacementForm — σημείο της πρότασης (ADR-904 Κ9)', () => {
  const GROUND = { kind: 'floor', floorId: 'demo_ground' } as const;
  const PLAN = { fileId: 'file_1', source: 'engineer', image: { width: 300, height: 200, contentHash: 'h1' }, metresPerPixel: 0.02 } as const;
  const LEVELS: readonly TourViewerLevel[] = DEMO_TOUR_LEVELS.map((level) => (level.key.kind === 'floor' && level.key.floorId === 'demo_ground' ? { ...level, plan: PLAN } : level));
  const HINT = { level: GROUND, point: { planContentHash: 'h1', x: 120, y: 80, radiusPx: 10 } };
  const spot = () => screen.queryByRole('checkbox', { name: 'spatial-tour:editor.placeAtHint' });

  it('Σ1 — ίδια κάτοψη ⇒ προεπιλεγμένο· ένα κλικ = νέο σημείο ΜΕ θέση σε μέτρα (x ανατολή, y βορράς)', () => {
    const onPlace = renderForm(HINT, LEVELS);
    expect(spot()).toBeChecked();
    expect(onPlace).not.toHaveBeenCalled();
    place();
    const target = onPlace.mock.calls[0][0];
    expect(target).toMatchObject({ kind: 'new-node', levelKey: GROUND, linkFrom: null });
    expect(target.position.x).toBeCloseTo(2.4);
    expect(target.position.y).toBeCloseTo(-1.6);
  });

  it('Σ2 — ξετσεκάρισμα ⇒ νέο σημείο χωρίς θέση', () => {
    const onPlace = renderForm(HINT, LEVELS);
    fireEvent.click(spot() as HTMLElement);
    place();
    expect(onPlace).toHaveBeenCalledWith({ kind: 'new-node', levelKey: GROUND, linkFrom: null });
  });

  it('Σ3 — η κάτοψη άλλαξε (άλλο hash) ⇒ η επιλογή ΔΕΝ προσφέρεται, χωρίς θέση', () => {
    const onPlace = renderForm({ ...HINT, point: { ...HINT.point, planContentHash: 'h0' } }, LEVELS);
    expect(spot()).toBeNull();
    expect(screen.getByText(/spatial-tour:panel\.hintPointPlanChanged/)).toBeInTheDocument();
    place();
    expect(onPlace).toHaveBeenCalledWith({ kind: 'new-node', levelKey: GROUND, linkFrom: null });
  });
});
