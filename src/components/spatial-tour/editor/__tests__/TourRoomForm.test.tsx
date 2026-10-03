/**
 * @jest-environment jsdom
 */
/**
 * ADR-884 Φ2στ · §4.12 — η φόρμα του χώρου ενός σημείου.
 *
 * - **Π** — κανένας τύπος δεν προεπιλέγεται σιωπηλά: χωρίς επιλογή, τίποτα να αποθηκευτεί.
 * - **Α** — ό,τι αποθηκεύεται είναι κανονικοποιημένο· η προεπισκόπηση λέει ό,τι θα δουν οι επισκέπτες (και την αρίθμηση).
 * - **Ε** — ενιαίος χώρος: δεύτερος τύπος χωρίς τον ήδη επιλεγμένο.
 * - **Κ** — υπάρχων χώρος: αποθήκευση μόνο με αλλαγή· «χωρίς όνομα» ⇒ `null`.
 * - **Φ** — πρόταση φωτογράφου (ADR-904 Κ8): προσφέρεται σε σημείο χωρίς χώρο, **δεν** προσυμπληρώνεται, αποδοχή με ρητό κλικ·
 *   σημείο που ήδη έχει χώρο ⇒ καμία πρόταση (μιλά η απόφαση).
 */

import { fireEvent, render, screen, within } from '@testing-library/react';

import { buildViewerGraph } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import type { TourRoom } from '@/types/spatial-tour';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join('|')}` : key),
    isNamespaceReady: true,
  }),
}));

interface FakeSelectProps {
  readonly id: string; readonly label: string; readonly value: string | null; readonly placeholder?: string;
  readonly options: readonly { readonly value: string; readonly label: string }[]; readonly onChange: (value: string) => void;
}
jest.mock('../../LabeledSelect', () => ({
  LabeledSelect: ({ id, label, value, placeholder, options, onChange }: FakeSelectProps) => (
    <label htmlFor={id}>{label}
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  ),
}));

import { DEMO_TOUR_MANIFEST } from '../../viewer/demo/demo-tour';
import { TourRoomForm } from '../TourRoomForm';

const graphWith = (rooms: Readonly<Record<string, TourRoom>>) => {
  const nodes = DEMO_TOUR_MANIFEST.nodes.map((n) => (rooms[n.id] ? { ...n, room: rooms[n.id] } : n));
  return buildViewerGraph({ ...DEMO_TOUR_MANIFEST, nodes }, DEMO_TOUR_MANIFEST.levels);
};
const room = (types: TourRoom['types'], label: string | null = null): TourRoom => ({ types, label, source: 'manual' });
const typeSelect = (i: number) => screen.getAllByRole('combobox')[i];
const save = () => screen.getByRole('button', { name: 'spatial-tour:editor.roomSave' });

describe('TourRoomForm', () => {
  it('Π — χωρίς χώρο: κανένας τύπος επιλεγμένος, αποθήκευση κλειστή, καμία προεπισκόπηση', () => {
    render(<TourRoomForm graph={graphWith({})} nodeId="g2" onSave={jest.fn()} />);
    expect(typeSelect(0)).toHaveValue('');
    expect(save()).toBeDisabled();
    expect(screen.queryByText(/roomPreview/)).toBeNull();
  });

  it('Α — τύπος + όνομα ⇒ προεπισκόπηση του ονόματος, αποθήκευση κανονικοποιημένη', () => {
    const onSave = jest.fn();
    render(<TourRoomForm graph={graphWith({})} nodeId="g2" onSave={onSave} />);
    fireEvent.change(typeSelect(0), { target: { value: 'office' } });
    fireEvent.change(screen.getByLabelText('spatial-tour:editor.roomLabel'), { target: { value: '  Γραφείο μηχανικού ' } });
    expect(screen.getByText('spatial-tour:editor.roomPreview:Γραφείο μηχανικού')).toBeInTheDocument();
    fireEvent.click(save());
    expect(onSave).toHaveBeenCalledWith({ types: ['office'], label: 'Γραφείο μηχανικού' });
  });

  it('Α — ίδιος τύπος με άλλο σημείο του ορόφου ⇒ η προεπισκόπηση αριθμεί («Υπνοδωμάτιο 2»)', () => {
    render(<TourRoomForm graph={graphWith({ g1: room(['bedroom']) })} nodeId="g2" onSave={jest.fn()} />);
    fireEvent.change(typeSelect(0), { target: { value: 'bedroom' } });
    expect(screen.getByText('spatial-tour:editor.roomPreview:spatial-tour:rooms.numbered:spatial-tour:rooms.types.bedroom|2')).toBeInTheDocument();
  });

  it('Ε — ενιαίος χώρος: ο δεύτερος τύπος δεν προσφέρει τον πρώτο· αποθήκευση και των δύο', () => {
    const onSave = jest.fn();
    render(<TourRoomForm graph={graphWith({})} nodeId="g2" onSave={onSave} />);
    fireEvent.change(typeSelect(0), { target: { value: 'kitchen' } });
    fireEvent.click(screen.getByRole('button', { name: 'spatial-tour:editor.roomAddType' }));
    expect(within(typeSelect(1)).queryByRole('option', { name: 'spatial-tour:rooms.types.kitchen' })).toBeNull();
    fireEvent.change(typeSelect(1), { target: { value: 'living-room' } });
    fireEvent.click(save());
    expect(onSave).toHaveBeenCalledWith({ types: ['kitchen', 'living-room'], label: null });
  });

  it('Κ — υπάρχων χώρος: αποθήκευση μόνο με αλλαγή· «χωρίς όνομα» ⇒ null', () => {
    const onSave = jest.fn();
    render(<TourRoomForm graph={graphWith({ g2: room(['hallway']) })} nodeId="g2" onSave={onSave} />);
    expect(typeSelect(0)).toHaveValue('hallway');
    expect(save()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'spatial-tour:editor.roomClear' }));
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('Φ — πρόταση σε σημείο χωρίς χώρο: φαίνεται, ΔΕΝ προσυμπληρώνει, αποδοχή με ένα κλικ', () => {
    const onSave = jest.fn();
    render(<TourRoomForm graph={graphWith({})} nodeId="g2" onSave={onSave} suggestion={{ types: ['kitchen', 'living-room'], label: null }} />);
    expect(screen.getByText('spatial-tour:panel.hintFrom: spatial-tour:rooms.types.kitchen / spatial-tour:rooms.types.living-room')).toBeInTheDocument();
    expect(typeSelect(0)).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'spatial-tour:panel.hintApply' }));
    expect(onSave).toHaveBeenCalledWith({ types: ['kitchen', 'living-room'], label: null });
  });

  it('Φ — σημείο που ΗΔΗ έχει χώρο ⇒ καμία πρόταση', () => {
    render(<TourRoomForm graph={graphWith({ g2: room(['hallway']) })} nodeId="g2" onSave={jest.fn()} suggestion={{ types: ['kitchen'], label: null }} />);
    expect(screen.queryByRole('button', { name: 'spatial-tour:panel.hintApply' })).toBeNull();
  });
});
