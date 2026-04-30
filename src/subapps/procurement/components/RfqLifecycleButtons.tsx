'use client';

import { Button } from '@/components/ui/button';
import type { RfqHeaderAction } from '@/subapps/procurement/utils/rfq-header-actions';

interface RfqLifecycleButtonsProps {
  actions: RfqHeaderAction[];
}

export function RfqLifecycleButtons({ actions }: RfqLifecycleButtonsProps) {
  return (
    <>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={`lifecycle-${action.id}`}
            size="sm"
            variant={action.variant ?? 'outline'}
            disabled={action.disabled}
            title={action.disabled ? action.disabledTooltip : undefined}
            onClick={action.onClick}
            className={action.destructive ? 'text-destructive hover:text-destructive' : undefined}
          >
            <Icon className="mr-1 h-4 w-4" />
            {action.label}
          </Button>
        );
      })}
    </>
  );
}
