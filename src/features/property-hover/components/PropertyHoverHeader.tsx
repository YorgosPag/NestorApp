'use client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function PropertyHoverHeader({ name, type, building, statusLabel, statusColor }:{
  name: string; type: string; building: string; statusLabel: string; statusColor: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <h4 className="font-semibold text-sm leading-tight">{name}</h4>
          <span className="text-xs font-normal text-muted-foreground">{type} • {building}</span>
        </div>
        <Badge variant="outline" className={cn("text-xs flex-shrink-0", statusColor)}>
          {statusLabel}
        </Badge>
      </div>
    </div>
  );
}
