/**
 * @tests RouteTabs — ADR-328 Phase I L3
 *
 * Verifies pathname-driven active tab derivation, exactMatch + excludeStartsWith
 * semantics, router.push on change, i18n label resolution, and pure-helper
 * functions `isTabActive`/`findActiveHref`.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Package, FileText } from 'lucide-react';
import {
  RouteTabs,
  isTabActive,
  findActiveHref,
} from '../route-tabs';
import type { TabsNavTab } from '../tabs-types';

const pushMock = jest.fn();
const pathnameMock = jest.fn(() => '/procurement');

jest.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
  useRouter: () => ({ push: pushMock }),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => `T(${key})` }),
}));

jest.mock('@/components/ui/theme/ThemeComponents', () => ({
  getThemeVariant: jest.fn(() => ({
    container: '',
    tabTrigger: 'theme-default',
    content: '',
  })),
}));

jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ sm: 'h-4 w-4' }),
}));

const FIXTURE_TABS: readonly TabsNavTab[] = [
  {
    href: '/procurement',
    labelKey: 'nav.purchaseOrders',
    exactMatch: true,
    icon: Package,
  },
  {
    href: '/procurement/quotes',
    labelKey: 'nav.quotes',
    excludeStartsWith: ['/procurement/quotes/scan'],
    icon: FileText,
  },
] as const;

describe('isTabActive', () => {
  it('returns true on exact match', () => {
    expect(isTabActive('/procurement', FIXTURE_TABS[0])).toBe(true);
  });

  it('returns false on partial match when exactMatch=true', () => {
    expect(isTabActive('/procurement/quotes', FIXTURE_TABS[0])).toBe(false);
  });

  it('returns true on prefix match when no exactMatch', () => {
    expect(isTabActive('/procurement/quotes', FIXTURE_TABS[1])).toBe(true);
    expect(isTabActive('/procurement/quotes/foo', FIXTURE_TABS[1])).toBe(true);
  });

  it('honors excludeStartsWith', () => {
    expect(isTabActive('/procurement/quotes/scan', FIXTURE_TABS[1])).toBe(false);
    expect(isTabActive('/procurement/quotes/scan/anything', FIXTURE_TABS[1])).toBe(false);
  });

  it('returns false when pathname does not start with href', () => {
    expect(isTabActive('/other', FIXTURE_TABS[1])).toBe(false);
  });
});

describe('findActiveHref', () => {
  it('returns the matching href', () => {
    expect(findActiveHref('/procurement', FIXTURE_TABS)).toBe('/procurement');
    expect(findActiveHref('/procurement/quotes', FIXTURE_TABS)).toBe('/procurement/quotes');
  });

  it('returns undefined when nothing matches', () => {
    expect(findActiveHref('/other', FIXTURE_TABS)).toBeUndefined();
  });

  it('returns undefined for excludeStartsWith path', () => {
    expect(findActiveHref('/procurement/quotes/scan', FIXTURE_TABS)).toBeUndefined();
  });
});

describe('RouteTabs — render', () => {
  beforeEach(() => {
    pushMock.mockClear();
    pathnameMock.mockReset();
    pathnameMock.mockReturnValue('/procurement');
  });

  it('renders one trigger per tab with translated label', () => {
    render(
      <RouteTabs
        tabs={FIXTURE_TABS}
        i18nNamespace="procurement"
        ariaLabel="Procurement nav"
      />,
    );
    expect(
      screen.getByRole('tab', { name: /T\(nav\.purchaseOrders\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /T\(nav\.quotes\)/ }),
    ).toBeInTheDocument();
  });

  it('marks the matching tab active based on pathname', () => {
    pathnameMock.mockReturnValue('/procurement/quotes');
    render(
      <RouteTabs
        tabs={FIXTURE_TABS}
        i18nNamespace="procurement"
        ariaLabel="Procurement nav"
      />,
    );
    expect(
      screen.getByRole('tab', { name: /T\(nav\.quotes\)/ }),
    ).toHaveAttribute('data-state', 'active');
  });

  it('calls router.push with the tab href on click', async () => {
    const user = userEvent.setup();
    render(
      <RouteTabs
        tabs={FIXTURE_TABS}
        i18nNamespace="procurement"
        ariaLabel="Procurement nav"
      />,
    );
    await user.click(
      screen.getByRole('tab', { name: /T\(nav\.quotes\)/ }),
    );
    expect(pushMock).toHaveBeenCalledWith('/procurement/quotes');
  });

  it('forwards aria-label to the tabs root', () => {
    const { container } = render(
      <RouteTabs
        tabs={FIXTURE_TABS}
        i18nNamespace="procurement"
        ariaLabel="Procurement nav"
      />,
    );
    expect(container.querySelector('[role="tablist"]')?.parentElement).toHaveAttribute(
      'aria-label',
      'Procurement nav',
    );
  });
});
