/**
 * @tests BaseTabs — ADR-328 Phase I L1
 *
 * Verifies the canonical tabs primitive: pure renderer, controlled-only, two
 * content modes (array vs children), theme/iconColor/alwaysShowLabels, dev
 * console.warn on conflict, and a11y (jest-axe).
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Settings, MessageSquare } from 'lucide-react';
import { BaseTabs, TabsContent } from '../base-tabs';
import type { TabDefinition } from '../tabs-types';

expect.extend(toHaveNoViolations);

jest.mock('@/components/ui/theme/ThemeComponents', () => ({
  getThemeVariant: jest.fn((variant: string = 'default') => ({
    container: '',
    tabTrigger: variant === 'success' ? 'theme-success' : 'theme-default',
    content: '',
  })),
}));

jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ sm: 'h-4 w-4' }),
}));

// ADR-912 §2 — ο χώρος του περιέκτη. Το jsdom δεν έχει διάταξη ⇒ η αληθινή τιμή εδώ είναι `'measuring'`.
let mockContainerClass: 'measuring' | 'narrow' | 'wide' = 'measuring';
jest.mock('@/hooks/media/useContainerClass', () => ({
  useContainerClass: () => mockContainerClass,
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  mockContainerClass = 'measuring';
});

const fixtureTabs: TabDefinition[] = [
  {
    id: 'actions',
    label: 'Ενέργειες',
    icon: Settings,
    content: <div data-testid="content-actions">actions content</div>,
  },
  {
    id: 'communication',
    label: 'Επικοινωνία',
    icon: MessageSquare,
    iconColor: 'text-orange-600',
    content: <div data-testid="content-communication">communication content</div>,
  },
];

describe('BaseTabs — array mode', () => {
  it('renders one trigger per tab with label text', () => {
    render(
      <BaseTabs tabs={fixtureTabs} value="actions" onValueChange={jest.fn()} />,
    );
    expect(screen.getByRole('tab', { name: /Ενέργειες/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Επικοινωνία/ })).toBeInTheDocument();
  });

  it('renders the active tab content (Radix hides inactive)', () => {
    render(
      <BaseTabs tabs={fixtureTabs} value="actions" onValueChange={jest.fn()} />,
    );
    expect(screen.getByTestId('content-actions')).toBeVisible();
  });

  it('calls onValueChange when a non-active trigger is clicked', async () => {
    const handle = jest.fn();
    const user = userEvent.setup();
    render(
      <BaseTabs tabs={fixtureTabs} value="actions" onValueChange={handle} />,
    );
    await user.click(screen.getByRole('tab', { name: /Επικοινωνία/ }));
    expect(handle).toHaveBeenCalledWith('communication');
  });

  it('disables a tab marked disabled', () => {
    const tabs: TabDefinition[] = [
      { ...fixtureTabs[0], disabled: true },
      fixtureTabs[1],
    ];
    render(<BaseTabs tabs={tabs} value="communication" onValueChange={jest.fn()} />);
    expect(screen.getByRole('tab', { name: /Ενέργειες/ })).toBeDisabled();
  });

  it('applies iconColor class on the per-tab icon', () => {
    const { container } = render(
      <BaseTabs tabs={fixtureTabs} value="communication" onValueChange={jest.fn()} />,
    );
    const triggers = container.querySelectorAll('[role="tab"]');
    const commTrigger = triggers[1];
    const icon = commTrigger.querySelector('svg');
    expect(icon?.getAttribute('class') ?? '').toContain('text-orange-600');
  });

  // ADR-912 §2.2 — κάτω από `sm` η ετικέτα φαίνεται μόνο στην ενεργή, αλλά ΔΕΝ φεύγει ποτέ από το δέντρο
  // προσβασιμότητας: `sr-only`, όχι `hidden` (με `hidden` κάθε καρτέλα-εικονίδιο ήταν κουμπί χωρίς όνομα).
  it('keeps the label in the accessibility tree below sm: (sr-only, never hidden)', () => {
    render(
      <BaseTabs tabs={fixtureTabs} value="actions" onValueChange={jest.fn()} />,
    );
    const labelSpan = screen.getByText('Ενέργειες');
    expect(labelSpan).not.toHaveClass('hidden');
    expect(labelSpan).toHaveClass('sr-only');
    // Το `!` είναι το νόημα: το `globals.css` δηλώνει `.sr-only` με `!important` (ADR-912, μέτρηση 2026-10-10).
    expect(labelSpan).toHaveClass('sm:!not-sr-only');
    expect(labelSpan).toHaveClass('[[data-state=active]>&]:!not-sr-only');
  });

  it('shows labels unconditionally when alwaysShowLabels=true', () => {
    render(
      <BaseTabs
        tabs={fixtureTabs}
        value="actions"
        onValueChange={jest.fn()}
        alwaysShowLabels
      />,
    );
    const labelSpan = screen.getByText('Ενέργειες');
    expect(labelSpan).not.toHaveClass('hidden');
    expect(labelSpan).not.toHaveClass('sr-only');
  });

  it('applies theme variant tabTrigger class', () => {
    render(
      <BaseTabs
        tabs={fixtureTabs}
        value="actions"
        onValueChange={jest.fn()}
        theme="success"
      />,
    );
    expect(screen.getByRole('tab', { name: /Ενέργειες/ })).toHaveClass('theme-success');
  });

  it('renders without an icon when tab.icon is omitted', () => {
    const tabs = [
      { id: 'noicon', label: 'Plain', content: <div>plain</div> },
    ] as unknown as TabDefinition[];
    const { container } = render(
      <BaseTabs tabs={tabs} value="noicon" onValueChange={jest.fn()} />,
    );
    expect(container.querySelector('svg')).toBeNull();
  });

  it('forwards aria-label to the tabs root', () => {
    const { container } = render(
      <BaseTabs
        tabs={fixtureTabs}
        value="actions"
        onValueChange={jest.fn()}
        ariaLabel="Toolbar tabs"
      />,
    );
    expect(container.firstChild).toHaveAttribute('aria-label', 'Toolbar tabs');
  });
});

describe('BaseTabs — children mode', () => {
  it('renders children instead of tab.content when children provided', () => {
    render(
      <BaseTabs tabs={fixtureTabs} value="actions" onValueChange={jest.fn()}>
        <div data-testid="custom-content">custom panel</div>
      </BaseTabs>,
    );
    expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    expect(screen.queryByTestId('content-actions')).not.toBeInTheDocument();
  });

  it('warns in dev when both children and tab.content are provided', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <BaseTabs tabs={fixtureTabs} value="actions" onValueChange={jest.fn()}>
        <div>custom</div>
      </BaseTabs>,
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[BaseTabs] `children` and `tab.content` both provided'),
    );
    warnSpy.mockRestore();
  });

  it('does not warn when tabs have no content fields', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const tabs = [
      { id: 'a', label: 'A', icon: Settings },
      { id: 'b', label: 'B', icon: MessageSquare },
    ] as unknown as TabDefinition[];
    render(
      <BaseTabs tabs={tabs} value="a" onValueChange={jest.fn()}>
        <div>custom</div>
      </BaseTabs>,
    );
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('BaseTabs — accessibility', () => {
  it('has no jest-axe violations in array mode', async () => {
    const { container } = render(
      <BaseTabs
        tabs={fixtureTabs}
        value="actions"
        onValueChange={jest.fn()}
        ariaLabel="Test tabs"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no jest-axe violations in children mode', async () => {
    const { container } = render(
      <BaseTabs
        tabs={fixtureTabs}
        value="actions"
        onValueChange={jest.fn()}
        ariaLabel="Test tabs"
      >
        <TabsContent value="actions">custom actions panel</TabsContent>
        <TabsContent value="communication">custom comm panel</TabsContent>
      </BaseTabs>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('BaseTabs — link tabs (ADR-328 · ADR-330)', () => {
  const linkTabs: TabDefinition[] = [
    fixtureTabs[0],
    { id: 'procurement', label: 'Προμήθειες', icon: Settings, content: null, href: '/projects/p1/procurement/overview' },
  ];

  it('renders a link tab as a link that never becomes the active value', async () => {
    const handle = jest.fn();
    const user = userEvent.setup();
    render(<BaseTabs tabs={linkTabs} value="actions" onValueChange={handle} />);

    const link = screen.getByRole('tab', { name: /Προμήθειες/ });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/projects/p1/procurement/overview');
    expect(link).toHaveAttribute('aria-selected', 'false');

    await user.click(link);
    expect(handle).not.toHaveBeenCalled();
  });

  it('renders no panel for a link tab', () => {
    const { container } = render(<BaseTabs tabs={linkTabs} value="actions" onValueChange={jest.fn()} />);
    expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(1);
  });

  it('a disabled link tab has no href, so it cannot navigate', () => {
    const tabs: TabDefinition[] = [fixtureTabs[0], { ...linkTabs[1], href: '', disabled: true }];
    render(<BaseTabs tabs={tabs} value="actions" onValueChange={jest.fn()} />);

    const disabled = screen.getByRole('tab', { name: /Προμήθειες/ });
    expect(disabled.tagName).toBe('SPAN');
    expect(disabled).not.toHaveAttribute('href');
    expect(disabled).toHaveAttribute('aria-disabled', 'true');
  });

  it('has no jest-axe violations with a link tab in the strip', async () => {
    const { container } = render(
      <BaseTabs tabs={linkTabs} value="actions" onValueChange={jest.fn()} ariaLabel="Test tabs" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('BaseTabs — narrow container rail (ADR-912 §2)', () => {
  const rail = (container: HTMLElement) => container.querySelector('[data-scroll-edges]');

  it('wraps (no rail) while the container is unmeasured — the pre-ADR-912 behaviour', () => {
    const { container } = render(<BaseTabs tabs={fixtureTabs} value="actions" onValueChange={jest.fn()} />);
    expect(rail(container)).toBeNull();
    expect(screen.getByRole('tablist')).toHaveClass('flex-wrap');
  });

  it('wraps (no rail) in a wide container', () => {
    mockContainerClass = 'wide';
    const { container } = render(<BaseTabs tabs={fixtureTabs} value="actions" onValueChange={jest.fn()} />);
    expect(rail(container)).toBeNull();
  });

  it('becomes ONE scrolling line in a narrow container — the tablist IS the rail', () => {
    mockContainerClass = 'narrow';
    const { container } = render(<BaseTabs tabs={fixtureTabs} value="actions" onValueChange={jest.fn()} />);
    const tablist = screen.getByRole('tablist');
    expect(rail(container)).toBe(tablist);
    expect(tablist).toHaveClass('flex-nowrap');
    expect(tablist).not.toHaveClass('flex-wrap');
    // Τα μέλη της λωρίδας είναι ΑΜΕΣΑ παιδιά της — το `ScrollRail` μετρά και αποκαλύπτει `node.children`.
    expect(Array.from(tablist.children).filter((el) => el.getAttribute('role') === 'tab')).toHaveLength(2);
  });

  it('🔴 every tab in the rail SHOWS its label — not only the active one (ADR-912 §2.2, revised 2026-10-17)', () => {
    mockContainerClass = 'narrow';
    render(<BaseTabs tabs={fixtureTabs} value="actions" onValueChange={jest.fn()} />);
    // Η ανενεργή καρτέλα: πριν ήταν `sr-only` (μόνο εικονίδιο) — στη λωρίδα που κυλά, το όνομα φαίνεται.
    expect(screen.getByText('Επικοινωνία')).not.toHaveClass('sr-only');
    expect(screen.getByText('Ενέργειες')).not.toHaveClass('sr-only');
  });

  it('keeps tabs operable in the rail: click still changes the value', async () => {
    mockContainerClass = 'narrow';
    const handle = jest.fn();
    const user = userEvent.setup();
    render(<BaseTabs tabs={fixtureTabs} value="actions" onValueChange={handle} />);
    await user.click(screen.getByRole('tab', { name: /Επικοινωνία/ }));
    expect(handle).toHaveBeenCalledWith('communication');
  });

  it('keeps keyboard roving focus in the rail (ArrowRight moves to the next tab)', async () => {
    mockContainerClass = 'narrow';
    const user = userEvent.setup();
    render(<BaseTabs tabs={fixtureTabs} value="actions" onValueChange={jest.fn()} />);
    screen.getByRole('tab', { name: /Ενέργειες/ }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Επικοινωνία/ })).toHaveFocus();
  });

  it('names the paging arrows and keeps them OUT of the tablist', () => {
    mockContainerClass = 'narrow';
    render(<BaseTabs tabs={fixtureTabs} value="actions" onValueChange={jest.fn()} />);
    const tablist = screen.getByRole('tablist');
    const prev = screen.getByRole('button', { name: 'common-actions:actions.previous', hidden: true });
    const next = screen.getByRole('button', { name: 'common-actions:actions.next', hidden: true });
    expect(tablist.contains(prev)).toBe(false);
    expect(tablist.contains(next)).toBe(false);
  });

  it('has no jest-axe violations as a rail', async () => {
    mockContainerClass = 'narrow';
    const { container } = render(
      <BaseTabs tabs={fixtureTabs} value="actions" onValueChange={jest.fn()} ariaLabel="Test tabs" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
