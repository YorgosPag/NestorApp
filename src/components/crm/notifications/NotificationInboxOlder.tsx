'use client';

/**
 * @fileoverview **«ΠΑΛΑΙΟΤΕΡΕΣ»** — η επόμενη σελίδα από τη βάση, με ορατή αποτυχία και επανάληψη.
 * @related ADR-927 · stores/notification-feed.ts (`loadOlderNotifications`)
 * @module components/crm/notifications/NotificationInboxOlder
 *
 * Κουμπί, όχι άπειρη κύλιση: ο άνθρωπος αποφασίζει πόσο πίσω πάει, και το κάτω μέρος της σελίδας (συντομεύσεις,
 * υποσέλιδο) μένει προσβάσιμο (WCAG 2.4.3 — η άπειρη κύλιση κλέβει τη σειρά εστίασης).
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotificationCenter } from '@/stores/notificationCenter';
import { loadOlderNotifications } from '@/stores/notification-feed';

export function NotificationInboxOlder() {
  const { t } = useTranslation('crm');
  const hasMore = useNotificationCenter((s) => s.hasMore);
  const loadingOlder = useNotificationCenter((s) => s.loadingOlder);
  const status = useNotificationCenter((s) => s.status);
  const [failed, setFailed] = useState(false);

  if (!hasMore || status !== 'ready') return null;

  const load = () => {
    setFailed(false);
    loadOlderNotifications().catch(() => setFailed(true));
  };

  return (
    <footer className="flex flex-col items-center gap-2">
      {failed && <p role="alert" className="text-sm text-destructive">{t('notifications.inbox.loadOlderFailed')}</p>}
      <Button variant="secondary" size="sm" onClick={load} disabled={loadingOlder} aria-busy={loadingOlder}>
        {loadingOlder
          ? t('notifications.inbox.loadingOlder')
          : failed ? t('notifications.inbox.retry') : t('notifications.inbox.loadOlder')}
      </Button>
    </footer>
  );
}
