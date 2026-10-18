/**
 * @fileoverview **Η γραμμή εργαλείων της κάτοψης** — ADR-912 §12.17 (αντικαθιστά την άγκυρα πηγής `…-header-reflow`,
 * ADR-907 §11.14, που διάβαζε κλάσεις από το `FloorplanGallery` πριν μετακομίσει η κεφαλίδα).
 *
 * 🔴 Το ελάττωμα που φυλάγεται (μετρημένο 2026-10-12 και 2026-10-18 στα 390px): ενέργειες **εκτός κάδρου** (πρώτα) και
 *   **δύο σειρές / 13 κουμπιά + σειρά ονόματος αρχείου** (μετά) πάνω από κάτοψη 280px.
 *
 * ΓΕ-1 στενό: ΜΙΑ σειρά (χωρίς αναδίπλωση) — ‹ 1/2 ›, πλήρης οθόνη, λήψη, «⋯»· όχι +/−/100%, όχι όνομα αρχείου.
 * ΓΕ-2 στενό: καμία δυνατότητα δεν χάνεται — μεγέθυνση, μέτρηση (ως διακόπτες), άνοιγμα στο DXF στο «⋯»· η διαγραφή
 *      τελευταία. Ενεργό εργαλείο μέτρησης μένει ορατό στη σειρά.
 * ΓΕ-3 φαρδύ / `measuring`: η προηγούμενη διάταξη (όνομα + όλα τα εργαλεία, αναδίπλωση).
 * ΓΕ-4 ‹ 1/2 ›: ένα αρχείο ⇒ καμία πλοήγηση· στο άκρο σταματά (`clamp`).
 *
 * ⚠️ Το jsdom δεν έχει διάταξη: εδώ αποδεικνύεται η ΔΟΜΗ. Ότι η σειρά χωρά στα 390px το έδειξε η ζωντανή μέτρηση (ADR).
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { TooltipProvider } from '@/components/ui/tooltip';
import type { FileRecord } from '@/types/file-record';
import { FloorplanGalleryToolbar, type FloorplanGalleryToolbarProps } from '../FloorplanGalleryToolbar';
import { floorplanSequenceOf } from '../floorplan-sequence';

let mockContainerClass: 'measuring' | 'narrow' | 'wide' = 'measuring';
jest.mock('@/hooks/media/useContainerClass', () => ({ useContainerClass: () => mockContainerClass }));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/useSceneFileLevelId', () => ({ useSceneFileLevelId: (id: string | null) => (id ? 'lvl_1' : null) }));
const mockPush = jest.fn();
jest.mock('@/lib/workspace/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

afterEach(() => {
  mockContainerClass = 'measuring';
  mockPush.mockReset();
});

const FILES = [{ id: 'f1' }, { id: 'f2' }] as unknown as FileRecord[];

function zoomPan(): FloorplanGalleryToolbarProps['zp'] {
  return { zoom: 1, zoomIn: jest.fn(), zoomOut: jest.fn(), resetAll: jest.fn() } as unknown as FloorplanGalleryToolbarProps['zp'];
}

function renderToolbar(overrides: Partial<FloorplanGalleryToolbarProps> = {}) {
  const props: FloorplanGalleryToolbarProps = {
    sequence: floorplanSequenceOf(FILES, 0, jest.fn()),
    fileName: 'Κατόψεις property-floorplan - Μεζονέτα',
    fileExt: 'dxf',
    zp: zoomPan(),
    onOpenFullscreen: jest.fn(),
    dxf: { drawingMode: 'dark', onToggleDrawingMode: jest.fn(), inkColor: null, onInkChange: jest.fn(), bim3D: null },
    measureMode: null,
    onMeasureModeChange: jest.fn(),
    measureScopeKey: 'f1',
    dxfFileId: 'f1',
    onCalibrate: null,
    onDownload: jest.fn(),
    downloadDisabled: false,
    onDelete: jest.fn(),
    ...overrides,
  };
  render(<TooltipProvider><FloorplanGalleryToolbar {...props} /></TooltipProvider>);
  return props;
}

const toolbar = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('[data-floorplan-toolbar]');
  if (!el) throw new Error('η γραμμή εργαλείων δεν αποδόθηκε');
  return el;
};

describe('FloorplanGalleryToolbar — στενό (ΜΙΑ σειρά)', () => {
  beforeEach(() => { mockContainerClass = 'narrow'; });

  it('🔴 ΓΕ-1 ‹ 1/2 › + πλήρης οθόνη + λήψη + «⋯», χωρίς αναδίπλωση, χωρίς +/− και χωρίς όνομα αρχείου', () => {
    renderToolbar();
    expect(toolbar()).toHaveAttribute('data-floorplan-toolbar', 'compact');
    expect(toolbar().className).toContain('flex-nowrap');
    expect(toolbar().className).not.toMatch(/(^|\s)flex-wrap(\s|$)/u);
    expect(screen.getByRole('navigation', { name: 'viewer.sequenceNav' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'files-media:floorplan.fullscreen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'files-media:floorplan.download' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'actions.more' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'files-media:floorplan.zoomIn' })).not.toBeInTheDocument();
    expect(screen.queryByText(/property-floorplan/u)).not.toBeInTheDocument();
  });

  it('🔴 ΓΕ-2 το «⋯» κρατά κάθε δυνατότητα· μέτρηση ως διακόπτης· διαγραφή τελευταία', async () => {
    const user = userEvent.setup();
    const props = renderToolbar();
    await user.click(screen.getByRole('button', { name: 'actions.more' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'files-media:floorplan.zoomIn' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'floorplan.measure.distance' })).toHaveAttribute('aria-checked', 'false');
    const items = Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]'));
    expect(items[items.length - 1]).toHaveAccessibleName('files-media:floorplan.delete');
    await user.click(within(menu).getByRole('menuitem', { name: 'files-media:floorplan.openInDxf' }));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(props.onDelete).not.toHaveBeenCalled();
  });

  it('ΓΕ-2 ενεργό εργαλείο μέτρησης μένει ορατό στη σειρά και κλείνει με ένα πάτημα', async () => {
    const user = userEvent.setup();
    const props = renderToolbar({ measureMode: 'area' });
    await user.click(screen.getByRole('button', { name: 'floorplan.measure.area', pressed: true }));
    expect(props.onMeasureModeChange).toHaveBeenCalledWith(null);
  });
});

describe('FloorplanGalleryToolbar — φαρδύ', () => {
  it.each(['wide', 'measuring'] as const)('ΓΕ-3 (%s) όνομα αρχείου + όλα τα εργαλεία, με αναδίπλωση', (state) => {
    mockContainerClass = state;
    renderToolbar();
    expect(toolbar()).toHaveAttribute('data-floorplan-toolbar', 'wide');
    expect(toolbar().className).toContain('flex-wrap');
    expect(screen.getByText(/property-floorplan/u)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /floorplan\.zoomIn$/u })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'actions.more' })).not.toBeInTheDocument();
  });
});

describe('floorplanSequenceOf — ‹ 1/2 ›', () => {
  it('ΓΕ-4 ένα αρχείο ⇒ καμία πλοήγηση· στο άκρο σταματά', () => {
    expect(floorplanSequenceOf(FILES.slice(0, 1), 0, jest.fn())).toBeNull();
    const select = jest.fn();
    const last = floorplanSequenceOf(FILES, 1, select);
    expect(last?.next).toBeNull();
    last?.step(1);
    expect(select).not.toHaveBeenCalled();
    last?.step(-1);
    expect(select).toHaveBeenCalledWith(0);
  });
});
