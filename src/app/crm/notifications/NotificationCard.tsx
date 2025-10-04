import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getTypeStyles, getTypeLabel } from './notification-utils';

export const NotificationCard = ({ notification }: { notification: any }) => {
  return (
    <div className={cn(
      "p-4 rounded-lg flex items-start gap-4 transition-colors",
      notification.read ? "bg-muted/50" : "bg-card border"
    )}>
      <div className={cn(
        "w-2 h-2 rounded-full mt-1.5 shrink-0",
        notification.read ? 'bg-gray-300' : 'bg-blue-500 animate-pulse'
      )}></div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">{notification.title}</h4>
            <Badge variant="outline" className={cn("text-xs", getTypeStyles(notification.type))}>
              {getTypeLabel(notification.type)}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">{notification.time}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{notification.description}</p>
      </div>
    </div>
  );
};
