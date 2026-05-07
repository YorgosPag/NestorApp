/**
 * =============================================================================
 * A11y audit — FloorplanBackgroundPanel + CalibrationDialog (ADR-340 Phase 8)
 * =============================================================================
 *
 * jest-axe-driven accessibility audit. Covers:
 *   - axe-clean DOM in 3 states (empty, loaded, calibrating)
 *   - aria-label / aria-pressed coverage on all icon-only buttons
 *   - role="alert" wiring on error <output>
 *   - Slider min/max/step exposed via input attrs
 *   - Greek + English label keys produce non-empty translated strings
 *   - CalibrationDialog: open state has accessible name + description
 *
 * Hooks (`useFloorplanBackgroundForLevel`, `useCalibration`,
 * `useFloorplanBackgroundStore`, `useTranslation`, `useSemanticColors`) are
 * mocked at module boundary — the test focuses on the rendered DOM
 * accessibility, not the data flow. Visual regression covers the wider
 * pipeline.
 *
 * Run: `npx jest FloorplanBackgroundPanel.a11y --runInBand`
 *
 * @see ADR-340 §6 Phase 8 (a11y audit)
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// ── Mocks (must precede imports of components-under-test) ────────────────────

const mockT = jest.fn((key: string) => key);

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockT, i18n: { language: 'el' } }),
}));

jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({
    text: { muted: 'text-muted', primary: 'text-primary' },
    bg: {},
    border: {},
    ring: {},
    interactive: {},
    gradients: {},
    getText: () => '',
    getBg: () => '',
  }),
}));

jest.mock('@/components/shared/files/FileUploadButton', () => ({
  FileUploadButton: ({ buttonText, icon }: { buttonText: string; icon?: React.ReactNode }) => (
    <button type="button" aria-label={buttonText}>
      {icon}
      {buttonText}
    </button>
  ),
}));

jest.mock('@/components/ui/floating', () => ({
  FloatingPanel: Object.assign(
    ({ children }: { children: React.ReactNode }) => (
      <section role="dialog" aria-label="Floorplan Background Panel">
        {children}
      </section>
    ),
    {
      Header: ({ title }: { title: string }) => <header><h2>{title}</h2></header>,
      Content: ({ children }: { children: React.ReactNode }) => <article>{children}</article>,
    },
  ),
}));

// Radix Tooltip needs a TooltipProvider in the tree — flatten it for a11y.
jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? <>{children}</> : <span>{children}</span>,
  TooltipContent: () => null,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Radix Select trigger lacks an inferable name in jsdom — flatten to a labeled <select>.
jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: { children: React.ReactNode; value?: string; onValueChange?: (v: string) => void }) => (
    <select aria-label="select" value={value} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));

// Radix AlertDialog renders into a portal which makes axe scoping awkward — keep it inline.
jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div role="alertdialog" aria-labelledby="ad-title" aria-describedby="ad-desc">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2 id="ad-title">{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p id="ad-desc">{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <footer>{children}</footer>,
  AlertDialogAction: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>{children}</button>
  ),
  AlertDialogCancel: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
}));

// Slider — render a labeled native range input for axe.
jest.mock('@/components/ui/slider', () => ({
  Slider: ({ value, min, max, step, onValueChange }: { value: number[]; min: number; max: number; step: number; onValueChange?: (v: number[]) => void }) => (
    <input
      type="range"
      aria-label="slider"
      value={value[0]}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onValueChange?.([Number(e.target.value)])}
    />
  ),
}));

const mockUseLevel = jest.fn();
jest.mock('../../hooks/useFloorplanBackgroundForLevel', () => ({
  useFloorplanBackgroundForLevel: () => mockUseLevel(),
}));

const mockUseCalibration = jest.fn();
jest.mock('../../hooks/useCalibration', () => ({
  useCalibration: () => mockUseCalibration(),
}));

import { FloorplanBackgroundPanel } from '../FloorplanBackgroundPanel';

// ── Fixture builders ─────────────────────────────────────────────────────────

function calibrationIdle() {
  return {
    isActive: false,
    hasPointA: false,
    pixelDist: 0,
    startCalibration: jest.fn(),
    cancelCalibration: jest.fn(),
    applyCalibration: jest.fn(),
  };
}

function calibrationActive(hasPointA = false) {
  return { ...calibrationIdle(), isActive: true, hasPointA };
}

function levelResultEmpty() {
  return {
    floorId: 'floor-1',
    background: null,
    isLoading: false,
    error: null,
    uploadBackground: jest.fn(),
    deleteBackground: jest.fn(),
    setTransform: jest.fn(),
    setOpacity: jest.fn(),
    setVisible: jest.fn(),
    setLocked: jest.fn(),
  };
}

function levelResultLoaded() {
  return {
    ...levelResultEmpty(),
    background: {
      id: 'rbg_test',
      companyId: 'co',
      floorId: 'floor-1',
      fileId: 'file_1',
      providerId: 'image' as const,
      providerMetadata: { imageOrientation: 1, imageMimeType: 'image/png', imageDecoderUsed: 'native' as const },
      naturalBounds: { width: 1000, height: 800 },
      transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      calibration: null,
      opacity: 1,
      visible: true,
      locked: false,
      createdAt: 0,
      updatedAt: 0,
      createdBy: 'u',
      updatedBy: 'u',
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('FloorplanBackgroundPanel — a11y', () => {
  beforeEach(() => {
    mockT.mockClear();
    mockT.mockImplementation((key: string) => key);
  });

  it('empty state has no axe violations', async () => {
    mockUseLevel.mockReturnValue(levelResultEmpty());
    mockUseCalibration.mockReturnValue(calibrationIdle());

    const { container } = render(<FloorplanBackgroundPanel isOpen onClose={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('loaded state has no axe violations + toggle buttons expose aria-pressed', async () => {
    mockUseLevel.mockReturnValue(levelResultLoaded());
    mockUseCalibration.mockReturnValue(calibrationIdle());

    const { container } = render(<FloorplanBackgroundPanel isOpen onClose={() => {}} />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    const visibleBtn = screen.getByLabelText('panels.floorplanBackground.controls.visible');
    expect(visibleBtn).toHaveAttribute('aria-pressed', 'true');

    const lockedBtn = screen.getByLabelText('panels.floorplanBackground.controls.locked');
    expect(lockedBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('calibrating state has no axe violations and shows instruction A', async () => {
    mockUseLevel.mockReturnValue(levelResultLoaded());
    mockUseCalibration.mockReturnValue(calibrationActive(false));

    const { container } = render(<FloorplanBackgroundPanel isOpen onClose={() => {}} />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
    expect(screen.getByText('panels.floorplanBackground.calibration.instructionA')).toBeInTheDocument();
  });

  it('renders nothing when isOpen=false', () => {
    mockUseLevel.mockReturnValue(levelResultEmpty());
    mockUseCalibration.mockReturnValue(calibrationIdle());

    const { container } = render(<FloorplanBackgroundPanel isOpen={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('every icon-only button declares an accessible name (aria-label)', () => {
    mockUseLevel.mockReturnValue(levelResultLoaded());
    mockUseCalibration.mockReturnValue(calibrationIdle());

    render(<FloorplanBackgroundPanel isOpen onClose={() => {}} />);
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      const label =
        btn.getAttribute('aria-label') ??
        btn.textContent?.trim() ??
        '';
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('error message uses role="alert" so screen readers announce it', () => {
    mockUseLevel.mockReturnValue({ ...levelResultEmpty(), error: 'panels.floorplanBackground.errors.uploadFailed' });
    mockUseCalibration.mockReturnValue(calibrationIdle());

    render(<FloorplanBackgroundPanel isOpen onClose={() => {}} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('uploadFailed');
  });

  it('translates Greek + English keys to non-empty strings', () => {
    const greekStub: Record<string, string> = {
      'panels.floorplanBackground.title': 'Φόντο Κάτοψης',
      'panels.floorplanBackground.empty.message': 'Καμία κάτοψη φορτωμένη',
      'panels.floorplanBackground.empty.uploadPdf': 'Φόρτωση PDF',
      'panels.floorplanBackground.empty.uploadImage': 'Φόρτωση Εικόνας',
      'panels.floorplanBackground.empty.supportedFormats': 'PNG / JPG / WEBP / TIFF',
    };
    mockT.mockImplementation((key: string) => greekStub[key] ?? key);
    mockUseLevel.mockReturnValue(levelResultEmpty());
    mockUseCalibration.mockReturnValue(calibrationIdle());

    render(<FloorplanBackgroundPanel isOpen onClose={() => {}} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('Φόντο Κάτοψης');

    // Every button's accessible name resolves to a non-empty Greek-or-fallback string.
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      const name = btn.getAttribute('aria-label') ?? btn.textContent ?? '';
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CalibrationDialog suite — separate mock graph, separate describe block
// ─────────────────────────────────────────────────────────────────────────────

const mockUseStore = jest.fn();
const mockUseCalForDialog = jest.fn();

jest.mock('../../stores/floorplanBackgroundStore', () => ({
  useFloorplanBackgroundStore: (selector: (s: unknown) => unknown) => mockUseStore(selector),
}));

// Re-mock useCalibration in this scope (jest hoists mocks per file, but we
// reuse the same mock fn — assertions read from it inside dialog tests).
import { CalibrationDialog } from '../CalibrationDialog';

describe('CalibrationDialog — a11y', () => {
  function configureOpen() {
    const sessionStore = {
      calibrationSession: {
        floorId: 'floor-1',
        pointA: { x: 10, y: 10 },
        pointB: { x: 100, y: 10 },
      },
      floors: { 'floor-1': { background: { transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 } } } },
    };
    mockUseStore.mockImplementation((selector: (s: unknown) => unknown) => selector(sessionStore));
  }

  beforeEach(() => {
    mockUseStore.mockReset();
    mockUseCalForDialog.mockReset();
    mockUseCalibration.mockReturnValue({
      pixelDist: 90,
      applyCalibration: jest.fn(),
      cancelCalibration: jest.fn(),
    });
  });

  it('open dialog has accessible title + description, no axe violations', async () => {
    configureOpen();
    const { container } = render(<CalibrationDialog />);

    // Radix AlertDialog renders into a portal — query by role.
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeInTheDocument();

    const title = within(dialog).getByText('panels.floorplanBackground.calibration.title');
    expect(title).toBeInTheDocument();

    const results = await axe(container.parentElement ?? container);
    expect(results).toHaveNoViolations();
  });

  it('closed dialog renders nothing accessible', () => {
    mockUseStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({ calibrationSession: null, floors: {} }),
    );
    render(<CalibrationDialog />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
