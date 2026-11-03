/**
 * Η σελίδα Ειδοποιήσεις (ADR-927 · ADR-253): προϊόν στην παραγωγή, ΜΙΑ πηγή με το κουδούνι,
 * φίλτρο στη διεύθυνση, πλήκτρα, απόρριψη με αναίρεση, άνοιγμα μόνο από τον μόνιμο σύνδεσμο.
 */

import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useNotificationCenter } from '@/stores/notificationCenter';
import type { Notification } from '@/types/notification';
import { CrmNotificationsPageContent } from '../CrmNotificationsPageContent';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockNotify = jest.fn();
let mockQuery = '';

jest.mock('@/services/notificationService', () => ({
  NOTIFICATION_PAGE_SIZE: 50,
  markNotificationsAsRead: jest.fn().mockResolvedValue(undefined),
  dismissNotification: jest.fn().mockResolvedValue(undefined),
  setNotificationDeliveryState: jest.fn().mockResolvedValue(undefined),
  fetchNotificationsBefore: jest.fn().mockResolvedValue([]),
  subscribeToNotifications: jest.fn(() => () => undefined),
}));
jest.mock('@/hooks/useFirestoreNotifications', () => ({ useFirestoreNotifications: () => undefined }));
jest.mock('@/lib/workspace/navigation', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }) }));
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(mockQuery) }));
jest.mock('@/providers/NotificationProvider', () => ({ useOptionalNotifications: () => ({ notify: mockNotify }) }));
jest.mock('@/auth/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'user_1' } }) }));
jest.mock('@/hooks/useUserTimeZone', () => ({ useUserTimeZone: () => 'Europe/Athens' }));
const mockT = (key: string) => (key === 'notifications.keyed.title' ? 'Μεταφρασμένος τίτλος' : key);
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: mockT, i18n: { language: 'el' } }) }));
jest.mock('@/i18n', () => ({ useTranslation: () => ({ t: mockT, i18n: { language: 'el' } }) }));
jest.mock('@/components/account/notification-settings-config', () => ({
  CATEGORY_ICONS: new Proxy({}, { get: () => () => null }),
}));
jest.mock('@/hooks/useIconSizes', () => ({ useIconSizes: () => ({ xs: '', sm: '', md: '', xl: '' }) }));
jest.mock('@/core/states', () => ({ PageLoadingState: () => <p>loading</p> }));
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

const service = jest.requireMock('@/services/notificationService') as Record<string, jest.Mock>;

function n(id: string, extra: Partial<Notification> = {}): Notification {
  return {
    id, tenantId: 't', userId: 'user_1', createdAt: '2026-11-03T08:00:00.000Z', severity: 'info', title: `title ${id}`,
    source: { service: 'test' }, channel: 'inapp', delivery: { state: 'delivered', attempts: 1 }, ...extra,
  };
}

function givenNodeEnv(value: string): void {
  jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: value });
}

function seed(...ns: Notification[]): void {
  act(() => {
    useNotificationCenter.getState().ingest(ns);
    useNotificationCenter.getState().setStatus('ready');
  });
}

function renderPage() {
  return render(<TooltipProvider><CrmNotificationsPageContent /></TooltipProvider>);
}

const rows = () => screen.queryAllByRole('article');

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery = '';
  useNotificationCenter.getState().reset();
  givenNodeEnv('production');
});
afterEach(() => jest.restoreAllMocks());

describe('CrmNotificationsPageContent — προϊόν (ADR-253)', () => {
  it('στην παραγωγή δείχνει τη λίστα· η κάρτα αποδίδει τον τίτλο του κλειδιού', () => {
    seed(n('k', { title: 'Παγωμένο κείμενο', titleKey: 'notifications.keyed.title', body: 'Σώμα' }));
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'notifications.title' })).toBeTruthy();
    expect(screen.getByText('Μεταφρασμένος τίτλος')).toBeTruthy();
    expect(screen.queryByText('Παγωμένο κείμενο')).toBeNull();
  });

  it('το εργαλείο δοκιμών εμφανίζεται μόνο σε development', () => {
    seed(n('a'));
    const { unmount } = renderPage();
    expect(screen.queryByRole('button', { name: 'notifications.test.create' })).toBeNull();
    unmount();
    givenNodeEnv('development');
    renderPage();
    expect(screen.getByRole('button', { name: 'notifications.test.create' })).toBeTruthy();
  });
});

describe('CrmNotificationsPageContent — ΜΙΑ πηγή με το κουδούνι', () => {
  it('ειδοποίηση που απορρίφθηκε αλλού (συρτάρι) φεύγει και από τη σελίδα', () => {
    seed(n('a'), n('b'));
    renderPage();
    expect(rows()).toHaveLength(2);
    seed(n('a', { delivery: { state: 'dismissed', attempts: 1 } }));
    expect(rows()).toHaveLength(1);
  });

  it('το φίλτρο «μη αναγνωσμένες» διαβάζεται από τη διεύθυνση', () => {
    mockQuery = 'view=unread';
    seed(n('a'), n('b', { delivery: { state: 'seen', attempts: 1 } }));
    renderPage();
    expect(rows()).toHaveLength(1);
    expect(screen.getByText('title a')).toBeTruthy();
  });

  it('η αλλαγή φίλτρου γράφει στη διεύθυνση, όχι σε τοπική κατάσταση', () => {
    seed(n('a'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /notifications\.inbox\.views\.unread/ }));
    expect(mockReplace).toHaveBeenCalledWith('/crm/notifications?view=unread', { scroll: false });
  });
});

describe('CrmNotificationsPageContent — ενέργειες', () => {
  it('«e» απορρίπτει τη γραμμή με εστίαση· η αναίρεση γράφει πίσω την προηγούμενη κατάσταση', async () => {
    seed(n('a'), n('b', { createdAt: '2026-11-03T07:00:00.000Z' }));
    renderPage();
    const first = rows()[0];
    act(() => first.focus());
    await act(async () => { fireEvent.keyDown(first, { key: 'e' }); });

    expect(service.dismissNotification).toHaveBeenCalledWith('a');
    expect(rows()).toHaveLength(1);
    const [, options] = mockNotify.mock.calls[0] as [string, { actions: { onClick: () => void }[] }];
    await act(async () => { options.actions[0].onClick(); });
    expect(service.setNotificationDeliveryState).toHaveBeenCalledWith('a', 'delivered');
    expect(rows()).toHaveLength(2);
  });

  it('το άνοιγμα περνά ΜΟΝΟ από τον μόνιμο σύνδεσμο (ADR-849 Β1), ποτέ από την ωμή διαδρομή', async () => {
    seed(n('link', { actions: [{ id: 'view', label: 'view', url: '/properties/p1' }] }));
    renderPage();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'title link' })); });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(String(mockPush.mock.calls[0][0])).toContain('/n/link');
    expect(String(mockPush.mock.calls[0][0])).not.toContain('/properties/p1');
  });

  it('σήμανση ως μη αναγνωσμένη από τη γραμμή', async () => {
    seed(n('a', { delivery: { state: 'seen', attempts: 1 } }));
    renderPage();
    const row = rows()[0];
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'notifications.inbox.actions.markUnread' }));
    });
    expect(service.setNotificationDeliveryState).toHaveBeenCalledWith('a', 'delivered');
    expect(useNotificationCenter.getState().unread).toBe(1);
  });
});
