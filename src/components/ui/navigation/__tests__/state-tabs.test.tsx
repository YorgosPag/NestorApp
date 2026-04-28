/**
 * @tests StateTabs — ADR-328 Phase I L2
 *
 * Verifies controlled/uncontrolled mode, selection banner gating, fillHeight
 * layout class, onTabChange callback semantics, and children passthrough.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Settings, MessageSquare } from 'lucide-react';
import { StateTabs } from '../state-tabs';
import type { TabDefinition } from '../tabs-types';

jest.mock('@/components/ui/theme/ThemeComponents', () => ({
  getThemeVariant: jest.fn(() => ({
    container: 'theme-container',
    tabTrigger: 'theme-trigger',
    content: '',
  })),
}));

jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ sm: 'h-4 w-4' }),
}));

const fixtureTabs: TabDefinition[] = [
  {
    id: 'a',
    label: 'Alpha',
    icon: Settings,
    content: <div data-testid="content-a">A</div>,
  },
  {
    id: 'b',
    label: 'Beta',
    icon: MessageSquare,
    content: <div data-testid="content-b">B</div>,
  },
];

describe('StateTabs — uncontrolled mode', () => {
  it('uses tabs[0] when no defaultTab provided', () => {
    render(<StateTabs tabs={fixtureTabs} />);
    expect(screen.getByRole('tab', { name: /Alpha/ })).toHaveAttribute(
      'data-state',
      'active',
    );
  });

  it('uses defaultTab when provided', () => {
    render(<StateTabs tabs={fixtureTabs} defaultTab="b" />);
    expect(screen.getByRole('tab', { name: /Beta/ })).toHaveAttribute(
      'data-state',
      'active',
    );
  });

  it('switches active tab internally on click', async () => {
    const user = userEvent.setup();
    render(<StateTabs tabs={fixtureTabs} />);
    await user.click(screen.getByRole('tab', { name: /Beta/ }));
    expect(screen.getByRole('tab', { name: /Beta/ })).toHaveAttribute(
      'data-state',
      'active',
    );
  });

  it('calls onTabChange on click', async () => {
    const handle = jest.fn();
    const user = userEvent.setup();
    render(<StateTabs tabs={fixtureTabs} onTabChange={handle} />);
    await user.click(screen.getByRole('tab', { name: /Beta/ }));
    expect(handle).toHaveBeenCalledWith('b');
  });
});

describe('StateTabs — controlled mode', () => {
  it('honors `value` prop ignoring internal state', () => {
    render(<StateTabs tabs={fixtureTabs} value="b" />);
    expect(screen.getByRole('tab', { name: /Beta/ })).toHaveAttribute(
      'data-state',
      'active',
    );
  });

  it('does not change internal state when controlled (re-render keeps `value`)', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<StateTabs tabs={fixtureTabs} value="a" />);
    await user.click(screen.getByRole('tab', { name: /Beta/ }));
    rerender(<StateTabs tabs={fixtureTabs} value="a" />);
    expect(screen.getByRole('tab', { name: /Alpha/ })).toHaveAttribute(
      'data-state',
      'active',
    );
  });

  it('calls onTabChange even in controlled mode', async () => {
    const handle = jest.fn();
    const user = userEvent.setup();
    render(<StateTabs tabs={fixtureTabs} value="a" onTabChange={handle} />);
    await user.click(screen.getByRole('tab', { name: /Beta/ }));
    expect(handle).toHaveBeenCalledWith('b');
  });
});

describe('StateTabs — selection banner', () => {
  it('renders banner when selectedItems.length > 0 AND selectionMessage provided', () => {
    render(
      <StateTabs
        tabs={fixtureTabs}
        selectedItems={['x']}
        selectionMessage="1 selected"
      />,
    );
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('hides banner when selectedItems is empty', () => {
    render(
      <StateTabs
        tabs={fixtureTabs}
        selectedItems={[]}
        selectionMessage="should not show"
      />,
    );
    expect(screen.queryByText('should not show')).not.toBeInTheDocument();
  });

  it('hides banner when selectionMessage is missing', () => {
    render(<StateTabs tabs={fixtureTabs} selectedItems={['x']} />);
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
  });
});

describe('StateTabs — fillHeight', () => {
  it('does NOT apply flex-col classes by default', () => {
    const { container } = render(<StateTabs tabs={fixtureTabs} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).not.toContain('flex-1');
  });

  it('applies flex-col layout when fillHeight=true', () => {
    const { container } = render(<StateTabs tabs={fixtureTabs} fillHeight />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('flex-1');
    expect(root.className).toContain('flex-col');
    expect(root.className).toContain('min-h-0');
  });

  it('applies flex-shrink-0 to selection banner when fillHeight=true', () => {
    render(
      <StateTabs
        tabs={fixtureTabs}
        fillHeight
        selectedItems={['x']}
        selectionMessage="msg"
      />,
    );
    expect(screen.getByText('msg').className).toContain('flex-shrink-0');
  });
});

describe('StateTabs — children passthrough', () => {
  it('forwards children to BaseTabs (replaces tab.content)', () => {
    render(
      <StateTabs tabs={fixtureTabs}>
        <div data-testid="custom">custom panel</div>
      </StateTabs>,
    );
    expect(screen.getByTestId('custom')).toBeInTheDocument();
  });
});
