// components/NotificationDrawer.enterprise.tsx
// ✅ FULL ENTERPRISE: Uses new notificationCenter store with Map-based dedup

'use client';

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { useNotificationDrawer } from '@/stores/notificationDrawer';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { X, AlertCircle, RefreshCw, Eye, CheckCheck } from 'lucide-react';
import { useUserTimeZone } from '@/hooks/useUserTimeZone';
import { notificationListOf, useNotificationCenter } from '@/stores/notificationCenter';
import { loadOlderNotifications, restartNotificationFeed } from '@/stores/notification-feed';
import { useTranslation } from '@/i18n';
import type { Notification } from '@/types/notification';
import { notificationDisplayBody, notificationDisplayTitle } from '@/components/notifications/notification-display-title';
import { drawerDestination } from '@/components/notifications/drawer-destination';
import { useNotificationActions } from '@/components/notifications/useNotificationActions';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { isNotificationUnread } from '@/lib/notifications/notification-state';
import { SEVERITY_ICON, SEVERITY_TEXT_CLASS } from '@/components/notifications/notification-severity';
import '@/lib/design-system';

// 🔑 Ο ΔΙΑΚΟΠΤΗΣ ΖΕΙ ΣΤΟ `stores/notificationDrawer` (ADR-834). Ήταν εδώ, και
//    όποιος ήθελε μόνο να ΑΝΟΙΞΕΙ το συρτάρι φόρτωνε ΟΛΟΚΛΗΡΟ αυτό το αρχείο —
//    μαζί με `useAuth` → `AuthContext` → firebase/auth. Το μέτρησε άγκυρα που
//    κοκκίνισε (`shell-utilities-identity.test.tsx`), όχι ανάγνωση.

export function NotificationDrawer() {
  const { isOpen, close } = useNotificationDrawer();
  const items = useNotificationCenter(s => s.items);
  const order = useNotificationCenter(s => s.order);
  const status = useNotificationCenter(s => s.status);
  const storeError = useNotificationCenter(s => s.error);
  const hasMore = useNotificationCenter(s => s.hasMore);
  const loadingOlder = useNotificationCenter(s => s.loadingOlder);

  // 🏢 ENTERPRISE: Persistent card selection (like project management cards)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 🔑 ADR-927 — οι ενέργειες ζουν σε ΕΝΑ hook, κοινό με τη σελίδα ειδοποιήσεων.
  const { markRead, dismiss: handleDismiss, open: openNotification } = useNotificationActions({ onBeforeNavigate: close });

  const { t, i18n } = useTranslation(COMMON_NAMESPACES);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { getStatusBorder } = useBorderTokens();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // 🕐 Η ζώνη του ανθρώπου από το ΕΝΑ SSoT (`user_notification_settings/{uid}`), ζωντανά.
  //    ⚠️ Ήταν fetch στο `/api/notifications/preferences` — αποθήκη-φάντασμα που κανείς δεν
  //    έγραφε, πίσω από `withAuth` ⇒ 401 + `[ERROR]` σε ΚΑΘΕ φόρτωση για κάθε πολίτη.
  const userTimeZone = useUserTimeZone();

  // ✅ ENTERPRISE: Retry — ξανανοίγει τη ΜΙΑ ροή (ήταν REST `list` που αντικαθιστούσε σιωπηλά τον ακροατή).
  const handleRetry = () => restartNotificationFeed();

  // ✅ ENTERPRISE: Παλαιότερες — δρομέας-τιμή στη βάση. ⚠️ Ήταν `GET /api/notifications?cursor=…`, που
  //    **αγνοούσε** το `cursor` ⇒ γύριζε ξανά την πρώτη σελίδα και το κουμπί δεν έφευγε ποτέ (2026-11-03).
  const handleLoadMore = () => {
    loadOlderNotifications().catch(() => undefined); // καταγράφεται στη ροή· το κουμπί μένει για επανάληψη
  };

  // 🌐 Γλώσσα = η γλώσσα της ΟΘΟΝΗΣ (ό,τι διαβάζει ο άνθρωπος τώρα)· ζώνη = η δηλωμένη.
  //    Memo: ένα `Intl.DateTimeFormat` ανά απόδοση είναι ακριβό και εδώ αποδίδεται λίστα.
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language || 'el', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: userTimeZone,
      }),
    [i18n.language, userTimeZone],
  );

  // ✅ ENTERPRISE: Focus management - trap and restore
  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element (the Bell button)
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus first interactive element (close button)
    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    // Restore focus when drawer closes
    return () => {
      previousActiveElement.current?.focus();
    };
  }, [isOpen]);

  // ✅ ENTERPRISE: Escape key (centralized hook)
  useEscapeKey(close, isOpen);

  // ✅ ENTERPRISE: Focus trap (Tab loop)
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const drawer = document.getElementById('notification-drawer');
      if (!drawer) return;

      const focusableElements = drawer.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  // Convert Map to array για rendering
  const notificationsList: Notification[] = notificationListOf({ items, order });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[var(--z-index-app-drawer-scrim)]"
        onClick={close}
      />

      {/* Drawer - ✅ ENTERPRISE: aria-modal for accessibility */}
      <aside
        id="notification-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-title"
        className={`fixed right-0 top-0 h-screen w-[420px] ${colors.bg.primary} shadow-xl flex flex-col z-[var(--z-index-app-drawer)] border-l`}
      >
        {/* ✅ ENTERPRISE: Live region for screen readers */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {t('notifications.count', { count: notificationsList.length })}
        </div>

        <header className="flex items-center justify-between p-4 border-b">
          <h2 id="notif-title" className="text-lg font-semibold">{t('notifications.title')}</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => void markRead()}>
              {t('notifications.markAllRead')}
            </Button>
            <Button
              ref={closeButtonRef}
              variant="ghost"
              size="icon-sm"
              onClick={close}
              aria-label={t('buttons.close')}
            >
              <X className={iconSizes.md} />
            </Button>
          </div>
        </header>

        {/* Scrollable content — plain div avoids Radix ScrollArea display:table overflow bug */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* ✅ ENTERPRISE: Error state UI με Retry */}
          {storeError ? (
            <div className={cn("flex flex-col items-center justify-center h-full gap-3 p-4", colors.text.muted)}>
              <AlertCircle className={`${iconSizes.xl} text-destructive`} />
              <p className="text-sm text-center">{storeError}</p>
              <Button variant="default" size="sm" onClick={handleRetry}>
                <RefreshCw className={iconSizes.sm} />
                {t('notifications.retry')}
              </Button>
            </div>
          ) : status === 'loading' ? (
            <div className={cn("flex items-center justify-center h-full", colors.text.muted)}>
              <p>{t('notifications.loading')}</p>
            </div>
          ) : notificationsList.length === 0 ? (
            <div className={cn("flex items-center justify-center h-full", colors.text.muted)}>
              <p>{t('notifications.empty')}</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {notificationsList.map(n => {
                const Icon = SEVERITY_ICON[n.severity];
                const colorClass = SEVERITY_TEXT_CLASS[n.severity];
                const isUnread = isNotificationUnread(n.delivery.state);

                // 🔴 **Η ΑΠΟΦΑΣΗ ΕΦΥΓΕ ΑΠΟ ΤΟ RENDER** (ADR-841 §7 Α18.10). Ζούσε εδώ ως
                //    κλειστή συνάρτηση μέσα σε `.map()`, και ήταν **σιωπηλά λάθος**: το
                //    `defaultValue` έκανε το i18next να **μην γυρίσει ποτέ το κλειδί**, οπότε το
                //    δίχτυ διασταυρούμενων namespaces του `useTranslation` (ADR-716 Φ5) δεν έτρεχε
                //    **ποτέ** — και ο άνθρωπος έβλεπε το **παγωμένο** κείμενο της παραγωγής.
                const displayTitle = notificationDisplayTitle(t, n);
                // ADR-892 §13 — το σώμα με την ίδια σειρά (κλειδί πρώτα, αποθηκευμένο κείμενο μετά).
                const displayBody = notificationDisplayBody(t, n);

                // 🔑 ADR-849 Β1 — ο δρόμος του «Προβολή» (μόνιμος σύνδεσμος · εξωτερικός · ιστορικός).
                const destination = drawerDestination(n);

                // Card states — matches project management ListCard styling
                const isSelected = selectedId === n.id;
                const cardStateClass = isSelected
                  ? `${getStatusBorder('info')} bg-[hsl(var(--bg-info))] shadow-sm`
                  : isUnread
                    ? `${getStatusBorder('info')} bg-card shadow-sm`
                    : 'border-border bg-card';

                return (
                  <Card
                    key={n.id}
                    onClick={() => setSelectedId(prev => prev === n.id ? null : n.id)}
                    className={[
                      'p-3 cursor-pointer relative',
                      'transition-colors duration-150 hover:bg-accent/50',
                      cardStateClass,
                    ].join(' ')}
                  >
                    {/* Header: severity icon + content + dismiss X */}
                    <div className="flex items-start gap-2 min-w-0">
                      <Icon className={`${iconSizes.md} mt-0.5 flex-shrink-0 ${colorClass}`} />

                      <div className="min-w-0 flex-1 overflow-hidden">
                        <span className={`text-sm leading-tight block truncate ${isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                          {displayTitle}
                        </span>
                        {displayBody && (
                          <p className={cn("text-sm break-words mt-1 line-clamp-3", colors.text.muted)}>
                            {displayBody}
                          </p>
                        )}
                        <time className={cn("text-xs mt-1.5 block", colors.text.muted)}>
                          {dateFormatter.format(new Date(n.createdAt))}
                        </time>
                      </div>

                      {/* Dismiss X — removes notification from panel */}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className={cn("flex-shrink-0 hover:text-destructive hover:bg-destructive/10", colors.text.muted)}
                        onClick={(e) => { e.stopPropagation(); void handleDismiss(n.id); }}
                        aria-label={t('notifications.dismiss')}
                        title={t('notifications.dismiss')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Action buttons */}
                    <nav className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-border/40">
                      {/* Προβολή (View) — navigates to relevant page */}
                      {destination && (
                        <Button
                          variant="default"
                          size="xs"
                          onClick={(e) => { e.stopPropagation(); void openNotification(n); }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {t('notifications.actions.view_email')}
                        </Button>
                      )}

                      {/* Προβλήθηκε (Mark as Read) — always visible */}
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={!isUnread}
                        className="border-[hsl(var(--text-success))]/50 text-[hsl(var(--text-success))] hover:bg-[hsl(var(--bg-success))]/10"
                        onClick={(e) => { e.stopPropagation(); void markRead([n.id]); }}
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        {t('notifications.markRead')}
                      </Button>
                    </nav>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ✅ ENTERPRISE: Load More με cursor pagination */}
          {hasMore && status === 'ready' && notificationsList.length > 0 && (
            <div className="p-2 pt-0">
              <Button variant="secondary" size="sm" className="w-full" onClick={handleLoadMore} disabled={loadingOlder}>
                {t('notifications.loadMore')}
              </Button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
