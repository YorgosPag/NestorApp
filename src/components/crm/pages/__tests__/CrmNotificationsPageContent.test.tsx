/**
 * Η σελίδα Ειδοποιήσεις είναι προϊόν: ανοίγει στην παραγωγή, και μόνο το εργαλείο
 * δοκιμών μένει σε development (ADR-253).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { CrmNotificationsPageContent } from '../CrmNotificationsPageContent';
import type { Notification } from '@/types/notification';

const translate = (key: string) => (key === 'notifications.keyed.title' ? 'Μεταφρασμένος τίτλος' : key);

jest.mock('@/components/crm/notifications/useNotifications', () => ({
  useNotifications: jest.fn(),
}));
jest.mock('@/auth/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'user_1' } }) }));
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => mockTranslate(key) }) }));
jest.mock('@/hooks/useIconSizes', () => ({ useIconSizes: () => ({ sm: 'h-4 w-4' }) }));
jest.mock('@/core/states', () => ({ PageLoadingState: () => null }));
jest.mock('@/core/containers', () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
jest.mock('@/core/headers', () => ({
  PageHeader: ({ title, actions }: { title: { title: string }; actions: { customActions: React.ReactNode[] } }) => (
    <header>
      <h1>{title.title}</h1>
      {actions.customActions}
    </header>
  ),
}));
jest.mock('@/components/property-management/dashboard/UnifiedDashboard', () => ({ UnifiedDashboard: () => null }));
jest.mock('@/components/shared/ModuleBreadcrumb', () => ({ ModuleBreadcrumb: () => null }));
jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({ text: { muted: '', secondary: '' }, bg: { muted: '', card: '', info: '' } }),
}));
jest.mock('@/hooks/useBorderTokens', () => ({
  useBorderTokens: () => ({ quick: { card: '' }, radiusClass: { lg: '', full: '' } }),
}));
jest.mock('@/hooks/useSpacingTokens', () => ({
  useSpacingTokens: () => ({ padding: { md: '' }, gap: { md: '', sm: '' }, margin: { top: { xs: '' } } }),
}));
jest.mock('@/components/crm/notifications/notification-utils', () => ({
  useNotificationUtils: () => ({ getTypeVariant: () => 'info', getTypeLabel: () => 'label' }),
}));
jest.mock('@/core/badges', () => ({ CommonBadge: () => null }));

const mockTranslate = translate;

const { useNotifications } = jest.requireMock('@/components/crm/notifications/useNotifications') as {
  useNotifications: jest.Mock;
};

function givenNodeEnv(value: string): void {
  jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: value });
}

function givenOneKeyedNotification(): void {
  useNotifications.mockReturnValue({
    notifications: [{
      id: 'notif_1',
      type: 'info',
      title: 'Παγωμένο κείμενο',
      description: 'Σώμα',
      time: 'τώρα',
      read: false,
      _original: { id: 'notif_1', title: 'Παγωμένο κείμενο', titleKey: 'notifications.keyed.title', body: 'Σώμα' } as Notification,
    }],
    loading: false,
    error: null,
    unreadCount: 1,
    markAllAsRead: jest.fn(),
  });
}

describe('CrmNotificationsPageContent', () => {
  afterEach(() => jest.restoreAllMocks());

  it('στην παραγωγή δείχνει τη λίστα, όχι μήνυμα φραγής', () => {
    givenNodeEnv('production');
    givenOneKeyedNotification();

    render(<CrmNotificationsPageContent />);

    expect(screen.getByRole('heading', { level: 1, name: 'notifications.title' })).toBeTruthy();
    expect(screen.getByText('Σώμα')).toBeTruthy();
    expect(screen.queryByText(/disabled in production/i)).toBeNull();
  });

  it('το εργαλείο δοκιμών εμφανίζεται μόνο σε development', () => {
    givenOneKeyedNotification();

    givenNodeEnv('production');
    const { unmount } = render(<CrmNotificationsPageContent />);
    expect(screen.queryByRole('button', { name: 'notifications.test.create' })).toBeNull();
    unmount();

    givenNodeEnv('development');
    render(<CrmNotificationsPageContent />);
    expect(screen.getByRole('button', { name: 'notifications.test.create' })).toBeTruthy();
  });

  it('η κάρτα δείχνει τον τίτλο του κλειδιού, όχι το παγωμένο κείμενο', () => {
    givenNodeEnv('production');
    givenOneKeyedNotification();

    render(<CrmNotificationsPageContent />);

    expect(screen.getByText('Μεταφρασμένος τίτλος')).toBeTruthy();
    expect(screen.queryByText('Παγωμένο κείμενο')).toBeNull();
  });
});
