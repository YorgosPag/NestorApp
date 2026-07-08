import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Mail } from 'lucide-react';

import { EmailRenderer } from '../EmailRenderer';
import { PhoneRenderer } from '../PhoneRenderer';
import { SocialRenderer } from '../SocialRenderer';
import { WebsiteRenderer } from '../WebsiteRenderer';
import type { CommunicationConfig, CommunicationItem } from '../../types';

// ---------------------------------------------------------------------------
// Lightweight mocks — απομονώνουμε το wiring (value flow / onChange / gating)
// από τα heavy Radix/design-system primitives.
// ---------------------------------------------------------------------------

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ sm: 'h-4 w-4' }),
}));

jest.mock('@/hooks/useBorderTokens', () => ({
  useBorderTokens: () => ({ quick: { separatorH: 'border-b' } }),
}));

jest.mock('@/lib/design-system', () => ({}));

// Το primitives διαβάζει COMMUNICATION_STYLES από '../../config' — mock απευθείας
// (ίδιο resolved module) ώστε να μη φορτώσει το heavy styles/effects graph.
jest.mock('../../config', () => ({
  COMMUNICATION_STYLES: { groupedTable: { input: 'input-cls' } },
}));

jest.mock('@/core/badges', () => ({
  CommonBadge: ({ status, onClick }: { status: string; onClick?: () => void }) => (
    <button type="button" data-testid={`badge-${status}`} onClick={onClick}>
      {status}
    </button>
  ),
}));

jest.mock('@/components/ui/effects', () => ({
  HOVER_COLOR_EFFECTS: { FADE_OUT: 'fade' },
  HOVER_TEXT_EFFECTS: { RED: 'red' },
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" data-testid="delete-btn" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <div data-testid="select" data-value={value}>{children}</div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<CommunicationConfig> = {}): CommunicationConfig {
  return {
    type: 'email',
    title: 'title.key',
    icon: Mail,
    fields: { primary: 'email' },
    types: [
      { value: 'work', label: 'type.work' },
      { value: 'home', label: 'type.home' },
    ],
    defaultType: 'work',
    placeholder: 'placeholder.key',
    labelPlaceholder: 'label.placeholder',
    supportsPrimary: true,
    emptyStateText: 'empty.key',
    addButtonText: 'add.key',
    ...overrides,
  } as CommunicationConfig;
}

const baseItem: CommunicationItem = { type: 'work', label: 'Εργασία' };

describe('Communication renderers (ADR-593 shared shell)', () => {
  describe('EmailRenderer', () => {
    it('renders a 4-column desktop row with the email cell wired to updateItem', () => {
      const updateItem = jest.fn();
      const { container } = render(
        <EmailRenderer
          item={{ ...baseItem, email: 'a@b.gr' }}
          index={2}
          isDesktop
          config={makeConfig()}
          updateItem={updateItem}
          setPrimary={jest.fn()}
          removeItem={jest.fn()}
        />
      );

      expect((container.firstChild as HTMLElement).className).toContain('grid-cols-4');

      const emailInput = screen.getByPlaceholderText('john@example.com') as HTMLInputElement;
      expect(emailInput.value).toBe('a@b.gr');
      expect(emailInput.type).toBe('email');

      fireEvent.change(emailInput, { target: { value: 'x@y.gr' } });
      expect(updateItem).toHaveBeenCalledWith(2, 'email', 'x@y.gr');
    });

    it('shows the Primary badge (supportsPrimary) and wires setPrimary', () => {
      const setPrimary = jest.fn();
      render(
        <EmailRenderer
          item={{ ...baseItem, isPrimary: false }}
          index={0}
          isDesktop
          config={makeConfig()}
          updateItem={jest.fn()}
          setPrimary={setPrimary}
          removeItem={jest.fn()}
        />
      );
      fireEvent.click(screen.getByTestId('badge-secondary'));
      expect(setPrimary).toHaveBeenCalledWith(0);
    });

    it('returns null on mobile', () => {
      const { container } = render(
        <EmailRenderer
          item={baseItem}
          index={0}
          isDesktop={false}
          config={makeConfig()}
          updateItem={jest.fn()}
          setPrimary={jest.fn()}
          removeItem={jest.fn()}
        />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('PhoneRenderer', () => {
    it('renders a 6-column row with countryCode default and number wiring', () => {
      const updateItem = jest.fn();
      const { container } = render(
        <PhoneRenderer
          item={{ type: 'mobile', number: '2310111222' }}
          index={1}
          isDesktop
          config={makeConfig({ type: 'phone', fields: { primary: 'number' } })}
          updateItem={updateItem}
          setPrimary={jest.fn()}
          removeItem={jest.fn()}
        />
      );

      expect((container.firstChild as HTMLElement).className).toContain('grid-cols-6');
      expect((screen.getByPlaceholderText('+30') as HTMLInputElement).value).toBe('+30');

      const numberInput = screen.getByPlaceholderText('2310 123456') as HTMLInputElement;
      expect(numberInput.value).toBe('2310111222');
      fireEvent.change(numberInput, { target: { value: '2311999888' } });
      expect(updateItem).toHaveBeenCalledWith(1, 'number', '2311999888');
    });
  });

  describe('WebsiteRenderer', () => {
    it('renders a 4-column row with url wiring and no Primary badge', () => {
      const updateItem = jest.fn();
      const { container } = render(
        <WebsiteRenderer
          item={{ type: 'company', url: 'https://x.gr' }}
          index={0}
          isDesktop
          config={makeConfig({ type: 'website', supportsPrimary: false, fields: { primary: 'url' } })}
          updateItem={updateItem}
          removeItem={jest.fn()}
        />
      );

      expect((container.firstChild as HTMLElement).className).toContain('grid-cols-4');
      expect(screen.queryByTestId('badge-secondary')).toBeNull();

      const urlInput = screen.getByPlaceholderText('https://example.com') as HTMLInputElement;
      fireEvent.change(urlInput, { target: { value: 'https://z.gr' } });
      expect(updateItem).toHaveBeenCalledWith(0, 'url', 'https://z.gr');
    });
  });

  describe('SocialRenderer', () => {
    it('renders a 6-column row with platform + username wiring and no Primary', () => {
      const updateItem = jest.fn();
      const { container } = render(
        <SocialRenderer
          item={{ type: 'personal', username: 'john', url: '' }}
          index={3}
          isDesktop
          config={makeConfig({ type: 'social', supportsPrimary: false, fields: { primary: 'username' } })}
          updateItem={updateItem}
          removeItem={jest.fn()}
        />
      );

      expect((container.firstChild as HTMLElement).className).toContain('grid-cols-6');
      expect(screen.queryByTestId('badge-secondary')).toBeNull();

      const usernameInput = screen.getByPlaceholderText('john-doe') as HTMLInputElement;
      expect(usernameInput.value).toBe('john');
      fireEvent.change(usernameInput, { target: { value: 'mary' } });
      expect(updateItem).toHaveBeenCalledWith(3, 'username', 'mary');
    });

    it('wires the delete button to removeItem', () => {
      const removeItem = jest.fn();
      render(
        <SocialRenderer
          item={{ type: 'personal' }}
          index={5}
          isDesktop
          config={makeConfig({ supportsPrimary: false })}
          updateItem={jest.fn()}
          removeItem={removeItem}
        />
      );
      fireEvent.click(screen.getByTestId('delete-btn'));
      expect(removeItem).toHaveBeenCalledWith(5);
    });
  });
});
