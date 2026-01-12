import { CommonBadge } from '@/core/badges';
import { cn } from '@/lib/utils';
import { useNotificationUtils } from './notification-utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

/** Notification data structure for CRM notifications */
interface NotificationData {
  id?: string;
  title: string;
  type: string;
  description: string;
  time: string;
  read: boolean;
}

export const NotificationCard = ({ notification }: { notification: NotificationData }) => {
  const { quick } = useBorderTokens();
  const { getTypeStyles, getTypeLabel } = useNotificationUtils();
  const colors = useSemanticColors();

  return (
    <div className={cn(
      "p-4 rounded-lg flex items-start gap-4 transition-colors",
      notification.read ? "bg-muted/50" : `bg-card ${quick.card}`
    )}>
      <div className={cn(
        "w-2 h-2 rounded-full mt-1.5 shrink-0",
        notification.read ? colors.bg.muted : `${colors.bg.info} animate-pulse`
      )}></div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">{notification.title}</h4>
            <CommonBadge
              status="company"
              customLabel={getTypeLabel(notification.type)}
              variant="outline"
              size="sm"
              className={cn("text-xs", getTypeStyles(notification.type))}
            />
          </div>
          <span className="text-xs text-muted-foreground">{notification.time}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{notification.description}</p>
      </div>
    </div>
  );
};
