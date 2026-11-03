'use client';

/**
 * @fileoverview **ΜΙΑ ΓΡΑΜΜΗ ΤΟΥ INBOX** — `<article>` με τίτλο-κουμπί (το «άνοιγμα»), σώμα, κατηγορία, ώρα
 * και ενέργειες (αναγνωσμένη/μη · απόρριψη).
 * @related ADR-927 · notification-display-title.ts · notification-severity.ts
 * @module components/crm/notifications/NotificationInboxItem
 *
 * Αντικαθιστά την παλιά `NotificationCard` (ένα `div` που δεν πατιόταν, με τύπο μαντεμένο από το κείμενο).
 * Η κατάσταση «μη αναγνωσμένη» δεν λέγεται **μόνο** με χρώμα (ADR-771): έντονος τίτλος + τελεία + κείμενο
 * για αναγνώστη οθόνης.
 */

import { memo } from 'react';
import { CheckCheck, Mail, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { isNotificationUnread } from '@/lib/notifications/notification-state';
import { notificationDisplayBody, notificationDisplayTitle } from '@/components/notifications/notification-display-title';
import { SEVERITY_ICON, SEVERITY_TEXT_CLASS } from '@/components/notifications/notification-severity';
import type { NotificationActions } from '@/components/notifications/useNotificationActions';
import type { Notification } from '@/types/notification';
import { useInboxCategoryPresentation } from './inbox-category-presentation';

export interface NotificationInboxItemProps {
  readonly notification: Notification;
  /** Στη σειρά του Tab (roving tabindex). */
  readonly active: boolean;
  readonly timeFormatter: Intl.DateTimeFormat;
  readonly actions: NotificationActions;
  readonly onActivate: (id: string) => void;
  readonly rowRef: (el: HTMLElement | null) => void;
}

interface RowActionProps {
  readonly label: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly onClick: () => void;
  readonly destructive?: boolean;
}

function RowAction({ label, icon: Icon, onClick, destructive }: RowActionProps) {
  const iconSizes = useIconSizes();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onClick={onClick}
          className={cn(destructive && 'hover:text-destructive hover:bg-destructive/10')}
        >
          <Icon className={iconSizes.sm} aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

interface ItemPartProps {
  readonly n: Notification;
  readonly unread: boolean;
  readonly actions: NotificationActions;
}

function ItemContent({ n, unread, actions, titleId, timeFormatter }: ItemPartProps & { readonly titleId: string; readonly timeFormatter: Intl.DateTimeFormat }) {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const { t: tCrm } = useTranslation('crm');
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const category = useInboxCategoryPresentation(n);
  const body = notificationDisplayBody(t, n);
  const created = new Date(n.createdAt);
  return (
    <section className="min-w-0 flex-1">
      <h3 id={titleId} className="flex items-center gap-2 text-sm">
        {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--text-info))]" aria-hidden="true" />}
        <button
          type="button"
          tabIndex={-1}
          onClick={() => void actions.open(n)}
          className={cn('min-w-0 truncate text-left hover:underline', unread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80')}
        >
          {notificationDisplayTitle(t, n)}
        </button>
        {unread && <span className="sr-only">{tCrm('notifications.inbox.unreadMarker')}</span>}
      </h3>
      {body && <p className={cn('mt-1 line-clamp-2 text-sm break-words', colors.text.muted)}>{body}</p>}
      <footer className={cn('mt-1.5 flex items-center gap-2 text-xs', colors.text.muted)}>
        <category.Icon className={iconSizes.xs} aria-hidden="true" />
        <span>{category.label}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={n.createdAt}>{Number.isNaN(created.getTime()) ? '' : timeFormatter.format(created)}</time>
      </footer>
    </section>
  );
}

function ItemActions({ n, unread, actions }: ItemPartProps) {
  const { t } = useTranslation('crm');
  return (
    <div role="group" aria-label={t('notifications.inbox.rowActions')} className="flex shrink-0 items-center gap-0.5">
      {unread ? (
        <RowAction label={t('notifications.inbox.actions.markRead')} icon={CheckCheck} onClick={() => void actions.markRead([n.id])} />
      ) : (
        <RowAction label={t('notifications.inbox.actions.markUnread')} icon={Mail} onClick={() => void actions.markUnread([n.id])} />
      )}
      <RowAction label={t('notifications.inbox.actions.dismiss')} icon={X} onClick={() => void actions.dismiss(n.id)} destructive />
    </div>
  );
}

function NotificationInboxItemImpl({ notification: n, active, timeFormatter, actions, onActivate, rowRef }: NotificationInboxItemProps) {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const unread = isNotificationUnread(n.delivery.state);
  const titleId = `inbox-item-${n.id}`;
  const SeverityIcon = SEVERITY_ICON[n.severity];
  return (
    <article
      ref={rowRef}
      data-inbox-row=""
      tabIndex={active ? 0 : -1}
      aria-labelledby={titleId}
      onFocus={() => onActivate(n.id)}
      className={cn(
        'group flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        unread ? cn(getStatusBorder('info'), 'bg-card') : 'border-border bg-card/60',
      )}
    >
      <SeverityIcon className={cn(iconSizes.md, 'mt-0.5 shrink-0', SEVERITY_TEXT_CLASS[n.severity])} aria-hidden="true" />
      <ItemContent n={n} unread={unread} actions={actions} titleId={titleId} timeFormatter={timeFormatter} />
      <ItemActions n={n} unread={unread} actions={actions} />
    </article>
  );
}

export const NotificationInboxItem = memo(NotificationInboxItemImpl);
