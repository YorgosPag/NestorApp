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

  it('hides label below sm: by default', () => {
    render(
      <BaseTabs tabs={fixtureTabs} value="actions" onValueChange={jest.fn()} />,
    );
    const labelSpan = screen.getByText('Ενέργειες');
    expect(labelSpan).toHaveClass('hidden');
    expect(labelSpan).toHaveClass('sm:inline');
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
