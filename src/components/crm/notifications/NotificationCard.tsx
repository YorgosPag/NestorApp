import { CommonBadge } from '@/core/badges';
import { cn } from '@/lib/design-system';
import { useNotificationUtils } from './notification-utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { CrmNotificationData } from './useNotifications';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

export const NotificationCard = ({ notification }: { notification: CrmNotificationData }) => {
  const { quick, radiusClass } = useBorderTokens();
  const { getTypeStyles, getTypeLabel } = useNotificationUtils();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();

  return (
    <div
      className={cn(
        spacing.padding.md,
        radiusClass.lg,
        'flex items-start transition-colors',
        spacing.gap.md,
        notification.read ? colors.bg.muted : cn(colors.bg.card, quick.card)
      )}
    >
      <div
        className={cn(
          'w-2 h-2 shrink-0',
          radiusClass.full,
          spacing.margin.top.xs,
          notification.read ? colors.bg.muted : cn(colors.bg.info, 'animate-pulse')
        )}
      />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className={cn('flex items-center', spacing.gap.sm)}>
            <h4 className="font-semibold">{notification.title}</h4>
            <CommonBadge
              status="company"
              customLabel={getTypeLabel(notification.type)}
              variant="outline"
              size="sm"
              className={cn('text-xs', getTypeStyles(notification.type))}
            />
          </div>
          <span className={cn('text-xs', colors.text.secondary)}>{notification.time}</span>
        </div>
        <p className={cn('text-sm', colors.text.secondary, spacing.margin.top.xs)}>{notification.description}</p>
      </div>
    </div>
  );
};
