/**
 * 🏢 ENTERPRISE CARD SHELLS - Behaviour Tests
 *
 * Guards the contract GridCard and ListCard share through the Card primitives:
 * keyboard activation, action isolation from card activation, the badge cap,
 * and the layout differences that must NOT be centralized away.
 *
 * @see ADR-584 - both shells were rebuilt on shared primitives; these tests
 *      are what stops that refactor from silently changing behaviour.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Ruler } from 'lucide-react';

import { GridCard } from '../components/GridCard/GridCard';
import { ListCard } from '../components/ListCard/ListCard';

// ── Core mocks ────────────────────────────────────────────────────────────────

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/design-system', () => ({}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STATS = [{ icon: Ruler, label: 'Εμβαδόν', value: '15 m²' }];

const BADGES = [
  { label: 'Διαθέσιμη', variant: 'success' as const },
  { label: 'Νέα', variant: 'info' as const },
  { label: 'Τρίτη', variant: 'warning' as const },
];

/** Both shells honour the same contract - run each case against both. */
const SHELLS = [
  { name: 'GridCard', Card: GridCard as React.ComponentType<Record<string, unknown>> },
  { name: 'ListCard', Card: ListCard as unknown as React.ComponentType<Record<string, unknown>> },
];

describe('Card shells - shared contract', () => {
  describe.each(SHELLS)('$name', ({ Card }) => {
    it('renders title and subtitle', () => {
      render(<Card title="P-001" subtitle="Τυπική Θέση" />);

      expect(screen.getByRole('heading', { name: 'P-001' })).toBeInTheDocument();
      expect(screen.getByText('Τυπική Θέση')).toBeInTheDocument();
    });

    // Ως τις 2026-10-09 το όριο ήταν δύο και το τρίτο έπεφτε χωρίς ίχνος (ADR-777 §8.87.9γ2).
    it('caps badges at three in priority order — the overflow is counted, never dropped', () => {
      render(<Card title="P-001" badges={[...BADGES, { label: 'Τέταρτη', variant: 'outline' as const }]} />);

      const badges = screen.getAllByTestId('badge');
      expect(badges).toHaveLength(4);
      expect(badges[0]).toHaveTextContent('Διαθέσιμη');
      expect(badges[1]).toHaveTextContent('Νέα');
      expect(badges[2]).toHaveTextContent('Τρίτη');
      expect(badges[3]).toHaveTextContent('+1');
      expect(badges[3]).toHaveTextContent('Τέταρτη');
    });

    it('activates on click', async () => {
      const user = userEvent.setup();
      const onClick = jest.fn();
      render(<Card title="P-001" onClick={onClick} />);

      await user.click(screen.getByRole('article'));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it.each(['{Enter}', ' '])('activates on %s', async (key) => {
      const user = userEvent.setup();
      const onClick = jest.fn();
      render(<Card title="P-001" onClick={onClick} />);

      screen.getByRole('article').focus();
      await user.keyboard(key);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('forwards other keys to onKeyDown without activating', async () => {
      const user = userEvent.setup();
      const onClick = jest.fn();
      const onKeyDown = jest.fn();
      render(<Card title="P-001" onClick={onClick} onKeyDown={onKeyDown} />);

      screen.getByRole('article').focus();
      await user.keyboard('{Escape}');

      expect(onClick).not.toHaveBeenCalled();
      expect(onKeyDown).toHaveBeenCalledTimes(1);
    });

    it('renders no toolbar when there is nothing to put in it', () => {
      render(<Card title="P-001" />);

      expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    });

    it('toggles favorite without activating the card', async () => {
      const user = userEvent.setup();
      const onClick = jest.fn();
      const onToggleFavorite = jest.fn();
      render(<Card title="P-001" onClick={onClick} onToggleFavorite={onToggleFavorite} />);

      await user.click(screen.getByRole('button', { name: 'a11y.addFavorite' }));

      expect(onToggleFavorite).toHaveBeenCalledTimes(1);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('runs an action without activating the card', async () => {
      const user = userEvent.setup();
      const onClick = jest.fn();
      const onAction = jest.fn();
      render(
        <Card
          title="P-001"
          onClick={onClick}
          actions={[{ id: 'edit', label: 'Επεξεργασία', icon: Ruler, onClick: onAction }]}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Επεξεργασία' }));

      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('disables a disabled action', () => {
      render(
        <Card
          title="P-001"
          actions={[
            { id: 'edit', label: 'Επεξεργασία', icon: Ruler, onClick: jest.fn(), disabled: true },
          ]}
        />
      );

      expect(screen.getByRole('button', { name: 'Επεξεργασία' })).toBeDisabled();
    });

    it('hides stats when asked', () => {
      const { rerender } = render(<Card title="P-001" stats={STATS} />);
      expect(screen.getByText('15 m²')).toBeInTheDocument();

      rerender(<Card title="P-001" stats={STATS} hideStats />);
      expect(screen.queryByText('15 m²')).not.toBeInTheDocument();
    });

    it('renders custom content', () => {
      render(
        <Card title="P-001">
          <p>Προσαρμοσμένο περιεχόμενο</p>
        </Card>
      );

      expect(screen.getByText('Προσαρμοσμένο περιεχόμενο')).toBeInTheDocument();
    });

    it('falls back to the title as accessible name, and honours an override', () => {
      const { rerender } = render(<Card title="P-001" />);
      expect(screen.getByRole('article')).toHaveAccessibleName('P-001');

      rerender(<Card title="P-001" aria-label="Θέση στάθμευσης P-001" />);
      expect(screen.getByRole('article')).toHaveAccessibleName('Θέση στάθμευσης P-001');
    });
  });
});

describe('GridCard - grid-specific behaviour', () => {
  it('stacks stats vertically, showing the stat label', () => {
    render(<GridCard title="P-001" stats={STATS} />);

    // Vertical layout is the reason GridCard exists apart from ListCard:
    // it has the room to label each stat.
    expect(screen.getByText('Εμβαδόν')).toBeInTheDocument();
    expect(screen.getByText('15 m²')).toBeInTheDocument();
  });

  it('marks selection with aria-selected', () => {
    render(<GridCard title="P-001" isSelected />);

    expect(screen.getByRole('article')).toHaveAttribute('aria-selected', 'true');
  });
});

describe('ListCard - list-specific behaviour', () => {
  it('lays stats out horizontally, dropping the stat label', () => {
    render(<ListCard title="P-001" stats={STATS} />);

    // Horizontal rows have no room for labels - values only.
    expect(screen.queryByText('Εμβαδόν')).not.toBeInTheDocument();
    expect(screen.getByText('15 m²')).toBeInTheDocument();
  });

  it('marks selection with aria-pressed', () => {
    render(<ListCard title="P-001" isSelected />);

    expect(screen.getByRole('article')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a single badge inline with the title when inlineBadges is set', () => {
    render(<ListCard title="P-001" badges={BADGES} inlineBadges />);

    const badges = screen.getAllByTestId('badge');
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent('Διαθέσιμη');
  });

  // ADR-777 §8.87.9γ2 — το τρίτο σήμα (κοινό) υπήρχε στο μοντέλο και ΔΕΝ αποδιδόταν: όριο 2, σιωπηλή αποκοπή.
  it('renders three stacked badges — the third is not dropped', () => {
    const three = [...BADGES, { label: 'Δημόσια', variant: 'success' as const }].slice(0, 3);
    render(<ListCard title="P-001" badges={three} />);

    expect(three).toHaveLength(3);
    expect(screen.getAllByTestId('badge').map((badge) => badge.textContent)).toEqual(three.map((badge) => badge.label));
  });

  it('collapses badges beyond the cap into a named "+N" badge, never silently', () => {
    const five = ['Α', 'Β', 'Γ', 'Δ', 'Ε'].map((label) => ({ label, variant: 'outline' as const }));
    render(<ListCard title="P-001" badges={five} />);

    const badges = screen.getAllByTestId('badge');
    expect(badges).toHaveLength(4);
    expect(badges[3]).toHaveTextContent('+2');
    expect(badges[3]).toHaveTextContent('Δ, Ε');
  });

  it('forwards its ref to the card element', () => {
    const ref = React.createRef<HTMLElement>();
    render(<ListCard ref={ref} title="P-001" />);

    expect(ref.current).toBe(screen.getByRole('article'));
  });

  it('reports external hover state to the caller', async () => {
    const user = userEvent.setup();
    const onMouseEnter = jest.fn();
    const onMouseLeave = jest.fn();
    render(<ListCard title="P-001" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} />);

    await user.hover(screen.getByRole('article'));
    expect(onMouseEnter).toHaveBeenCalledTimes(1);

    await user.unhover(screen.getByRole('article'));
    expect(onMouseLeave).toHaveBeenCalledTimes(1);
  });

  it('applies a role when the caller needs listbox semantics', () => {
    render(<ListCard title="P-001" role="option" />);

    expect(screen.getByRole('option')).toBeInTheDocument();
  });
});
