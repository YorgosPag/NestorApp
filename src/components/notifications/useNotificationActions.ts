'use client';

/**
 * @fileoverview **ΟΙ ΕΝΕΡΓΕΙΕΣ ΠΑΝΩ ΣΕ ΕΙΔΟΠΟΙΗΣΗ** — μία υλοποίηση για το συρτάρι **και** τη σελίδα Inbox.
 * @related ADR-927 · ADR-849 Β1 · ADR-866 §2.10 Β2 · stores/notificationCenter.ts · drawer-destination.ts
 * @module components/notifications/useNotificationActions
 *
 * Κάθε ενέργεια είναι **αισιόδοξη** (πρώτα η οθόνη, μετά η βάση) και **αυτοθεραπευόμενη**: αν η εγγραφή
 * αποτύχει, η ζωντανή ροή φέρνει πίσω την αληθινή κατάσταση. Τα δεδομένα διαβάζονται **τη στιγμή του
 * γεγονότος** (`getState()`), ποτέ από στιγμιότυπο απόδοσης — αλλιώς το «όλα αναγνωσμένα» θα έβλεπε λίστα
 * που ίσως άλλαξε στο μεταξύ (ADR-040, κανόνας 2).
 *
 * Η απόρριψη έχει **αναίρεση** (Gmail · GitHub «Done»): ένα toast, πάντα το ίδιο `id` ⇒ το νεότερο
 * αντικαθιστά το προηγούμενο αντί να στοιβάζονται.
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { useRouter } from '@/lib/workspace/navigation';
import { declaredHref } from '@/lib/workspace/route-worlds';
import { useNotifications as useToasts } from '@/providers/NotificationProvider';
import { NotificationClient } from '@/api/notificationClient';
import { API_ROUTES } from '@/config/domain-constants';
import { drawerDestination } from '@/components/notifications/drawer-destination';
import {
  dismissNotification,
  markNotificationsAsRead,
  setNotificationDeliveryState,
  type RestorableDeliveryState,
} from '@/services/notificationService';
import { useNotificationCenter } from '@/stores/notificationCenter';
import { isNotificationUnread } from '@/lib/notifications/notification-state';
import { createModuleLogger } from '@/lib/telemetry';
import type { Notification } from '@/types/notification';

const logger = createModuleLogger('notification-actions');

const DISMISS_TOAST_ID = 'notification-dismissed';

let actionClient: NotificationClient | null = null;
/** Ο πελάτης REST μόνο για το `act` (δρόμοι εκτός μόνιμου συνδέσμου). Τεμπέλικη κατασκευή: SSR-safe. */
function getActionClient(): NotificationClient {
  actionClient ??= new NotificationClient({ baseUrl: API_ROUTES.NOTIFICATIONS.LIST });
  return actionClient;
}

const center = () => useNotificationCenter.getState();

/** Η κατάσταση στην οποία γυρίζει μια ειδοποίηση μετά από «αναίρεση απόρριψης». */
function restorableStateOf(n: Notification): RestorableDeliveryState {
  const { state } = n.delivery;
  return state === 'seen' || state === 'acted' ? state : 'delivered';
}

export interface NotificationActions {
  /** Χωρίς `ids` ⇒ όλες οι μη αναγνωσμένες που έχει ο πελάτης. */
  markRead: (ids?: readonly string[]) => Promise<void>;
  markUnread: (ids: readonly string[]) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  /** Το «Προβολή»: ο ΕΝΑΣ δρόμος (`drawerDestination`). Χωρίς προορισμό ⇒ απλώς «αναγνωσμένη». */
  open: (n: Notification) => Promise<void>;
}

export interface NotificationActionsOptions {
  /** Πριν από εσωτερική πλοήγηση — π.χ. το συρτάρι κλείνει. */
  readonly onBeforeNavigate?: () => void;
}

export function useNotificationActions(options: NotificationActionsOptions = {}): NotificationActions {
  const { onBeforeNavigate } = options;
  const router = useRouter();
  const { t } = useTranslation(COMMON_NAMESPACES);
  const { notify } = useToasts();

  const markRead = useCallback(async (ids?: readonly string[]) => {
    const s = center();
    const target = (ids ?? s.order).filter((id) => {
      const n = s.items.get(id);
      return n !== undefined && isNotificationUnread(n.delivery.state);
    });
    if (target.length === 0) return;
    s.setDeliveryState(target, 'seen');
    try {
      await markNotificationsAsRead(target);
    } catch (error) {
      logger.error('Failed to persist mark as read', { error });
    }
  }, []);

  const markUnread = useCallback(async (ids: readonly string[]) => {
    if (ids.length === 0) return;
    center().setDeliveryState(ids, 'delivered');
    try {
      await Promise.all(ids.map((id) => setNotificationDeliveryState(id, 'delivered')));
    } catch (error) {
      logger.error('Failed to persist mark as unread', { error });
    }
  }, []);

  const undoDismiss = useCallback(async (previous: Notification) => {
    center().ingest([previous]);
    try {
      await setNotificationDeliveryState(previous.id, restorableStateOf(previous));
    } catch (error) {
      logger.error('Failed to undo dismiss', { error });
    }
  }, []);

  const dismiss = useCallback(async (id: string) => {
    const previous = center().items.get(id);
    if (!previous) return;
    center().dismiss(id);
    try {
      await dismissNotification(id);
    } catch (error) {
      logger.error('Failed to persist dismiss', { error });
      return;
    }
    notify(t('notifications.dismissed'), {
      type: 'info',
      id: DISMISS_TOAST_ID,
      actions: [{ label: t('notifications.undo'), onClick: () => void undoDismiss(previous) }],
    });
  }, [notify, t, undoDismiss]);

  const open = useCallback(async (n: Notification) => {
    const destination = drawerDestination(n);
    if (!destination) {
      await markRead([n.id]);
      return;
    }
    if (destination.kind === 'external') {
      window.open(destination.href, '_blank', 'noopener,noreferrer');
    } else {
      onBeforeNavigate?.();
      // ΔΡΟΜΟΣ #3: ο μόνιμος σύνδεσμος `/n/{id}` (ADR-849 Β1) ή η ιστορική ευρετική —
      // ο μεταγλωττιστής δεν βλέπει ποια ειδοποίηση θα πατηθεί.
      router.push(
        declaredHref('Μόνιμος σύνδεσμος ειδοποίησης — ο χώρος-στόχος λύνεται στον διακομιστή.', destination.href),
      );
    }
    center().setDeliveryState([n.id], 'acted');
    // 🔑 ADR-849 Β1 — ο μόνιμος σύνδεσμος ΓΡΑΦΕΙ ο ίδιος το «ανοίχτηκε» (ένας συγγραφέας για email και
    //    κουδούνι)· το `act` μένει μόνο για τους άλλους δύο δρόμους.
    if (destination.kind === 'permalink') return;
    try {
      await getActionClient().act({ id: n.id, actionId: n.actions?.[0]?.id ?? 'view' });
    } catch (error) {
      logger.error('Action failed', { error });
    }
  }, [markRead, onBeforeNavigate, router]);

  return useMemo(() => ({ markRead, markUnread, dismiss, open }), [markRead, markUnread, dismiss, open]);
}
