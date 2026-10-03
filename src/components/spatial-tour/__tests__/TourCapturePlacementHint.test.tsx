/**
 * @jest-environment jsdom
 */
/**
 * ADR-904 Κ8 — η πρόταση θέσης του φωτογράφου στα εισερχόμενα και στη φόρμα τοποθέτησης.
 *
 * - **Υ** — όροφος που **υπάρχει** ⇒ η ετικέτα του (ο ΙΔΙΟΣ κανόνας με τον θεατή)·
 * - **Ν** — τοπικός που δεν υπάρχει ⇒ «νέος όροφος N» (πρόταση νέου ορόφου, όχι σφάλμα)·
 * - **Χ** — όροφος BIM που **δεν** είναι πια στην περιήγηση ⇒ το λέει ρητά — ποτέ σιωπηλή αντιστοίχιση σε άλλον·
 * - **Ω** — πάντα με σήμα προέλευσης («Πρόταση φωτογράφου»)· χώρος με τον ΙΔΙΟ τρόπο εμφάνισης με τα σημεία.
 * - **Σ** (ADR-904 Κ9) — σημείο: στα εισερχόμενα (με `subject`) η κάτοψη με την καρφίτσα από το `getCapturePlan`· αλλαγμένη κάτοψη ⇒
 *   ρητό κείμενο και **καμία** κάτοψη· χωρίς `subject` (φόρμα) ⇒ μόνο κείμενο.
 */

import { render, screen } from '@testing-library/react';

import type { CaptureLevelChoice } from '@/lib/spatial-tour/tour-capture-placement-hint';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join('|')}` : key),
    isNamespaceReady: true,
  }),
}));

jest.mock('../useCapturePlanImage', () => ({ useCapturePlanImage: (_subject: unknown, hash: string | null) => (hash === null ? null : `blob:${hash}`) }));

import { TourCapturePlacementHint } from '../TourCapturePlacementHint';

const PLAN = { image: { width: 300, height: 200, contentHash: 'h1' }, metresPerPixel: 0.02 } as const;
const LEVELS: readonly CaptureLevelChoice[] = [
  { key: { kind: 'floor', floorId: 'flr_ground' }, ordinal: 0, label: null, calibratedPlan: PLAN },
  { key: { kind: 'local', ordinal: 1 }, ordinal: 1, label: 'Σοφίτα', calibratedPlan: null },
];
const SUBJECT = { kind: 'owner-property', id: 'oprop_1' } as const;
const SPOT = { level: { kind: 'floor', floorId: 'flr_ground' }, point: { planContentHash: 'h1', x: 120, y: 80, radiusPx: 30 } } as const;
const planImage = () => screen.queryByRole('img', { name: 'spatial-tour:panel.hintPlanAlt' });

const textOf = () => screen.getByText('spatial-tour:panel.hintFrom').parentElement?.textContent;

describe('TourCapturePlacementHint', () => {
  it('Υ — όροφος BIM που υπάρχει + ενιαίος χώρος', () => {
    render(<TourCapturePlacementHint hint={{ level: { kind: 'floor', floorId: 'flr_ground' }, room: { types: ['kitchen', 'dining-room'], label: null } }} levels={LEVELS} />);
    expect(textOf()).toBe('spatial-tour:panel.hintFromspatial-tour:viewer.floorNumbered:0 · spatial-tour:rooms.types.kitchen / spatial-tour:rooms.types.dining-room');
  });

  it('Υ — η ετικέτα του ορόφου υπερισχύει· το όνομα χώρου υπερισχύει του τύπου', () => {
    render(<TourCapturePlacementHint hint={{ level: { kind: 'local', ordinal: 1 }, room: { types: ['office'], label: 'Γραφείο μηχανικού' } }} levels={LEVELS} />);
    expect(textOf()).toBe('spatial-tour:panel.hintFromΣοφίτα · Γραφείο μηχανικού');
  });

  it('Ν — τοπικός όροφος που δεν υπάρχει ⇒ «νέος όροφος»', () => {
    render(<TourCapturePlacementHint hint={{ level: { kind: 'local', ordinal: -1 } }} levels={LEVELS} />);
    expect(textOf()).toBe('spatial-tour:panel.hintFromspatial-tour:panel.hintNewFloor:-1');
  });

  it('Χ — όροφος BIM εκτός περιήγησης ⇒ ρητά, ποτέ άλλος όροφος', () => {
    render(<TourCapturePlacementHint hint={{ level: { kind: 'floor', floorId: 'flr_deleted' } }} levels={LEVELS} />);
    expect(textOf()).toBe('spatial-tour:panel.hintFromspatial-tour:panel.hintGoneFloor');
  });

  it('Ω — κενή πρόταση ⇒ τίποτα', () => {
    const { container } = render(<TourCapturePlacementHint hint={{}} levels={LEVELS} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('TourCapturePlacementHint — σημείο (ADR-904 Κ9)', () => {
  it('Σ1 — εισερχόμενα, ίδια κάτοψη ⇒ κείμενο + κάτοψη με καρφίτσα στο pixel της πρότασης + ακρίβεια σε μέτρα', () => {
    render(<TourCapturePlacementHint hint={SPOT} levels={LEVELS} subject={SUBJECT} />);
    expect(textOf()).toContain('spatial-tour:panel.hintPointOnPlan');
    const svg = planImage();
    expect(svg?.querySelector('image')?.getAttribute('href')).toBe('blob:h1');
    expect([...(svg?.querySelectorAll('circle') ?? [])].map((c) => [c.getAttribute('cx'), c.getAttribute('cy')])).toContainEqual(['120', '80']);
    expect(screen.getByText(/^spatial-tour:panel.hintPointAccuracy:0[.,]6$/)).toBeInTheDocument();
  });

  it('Σ2 — η κάτοψη άλλαξε ⇒ ρητό κείμενο, ΚΑΜΙΑ κάτοψη (ποτέ μεταφορά στη νέα)', () => {
    render(<TourCapturePlacementHint hint={{ ...SPOT, point: { ...SPOT.point, planContentHash: 'h0' } }} levels={LEVELS} subject={SUBJECT} />);
    expect(textOf()).toContain('spatial-tour:panel.hintPointPlanChanged');
    expect(planImage()).toBeNull();
  });

  it('Σ3 — χωρίς subject (φόρμα τοποθέτησης) ⇒ μόνο κείμενο', () => {
    render(<TourCapturePlacementHint hint={SPOT} levels={LEVELS} />);
    expect(textOf()).toContain('spatial-tour:panel.hintPointOnPlan');
    expect(planImage()).toBeNull();
  });
});
