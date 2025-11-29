'use client';
import { PropertyBadge } from '@/core/badges';
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
        <PropertyBadge
          status={'for-sale' as any}
          variant="outline"
          size="sm"
          className={cn("text-xs flex-shrink-0", statusColor)}
        />
      </div>
    </div>
  );
}
