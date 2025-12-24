'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { CommonBadge } from "@/core/badges";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';

interface ToolbarButtonProps {
  tooltip: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  disabled?: boolean;
  badge?: string | number;
}

export function ToolbarButton({
  tooltip,
  children,
  onClick,
  className,
  variant = "ghost",
  disabled = false,
  badge
}: ToolbarButtonProps) {
  const iconSizes = useIconSizes();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative">
          <Button 
            variant={variant} 
            size="sm" 
            className={cn(`${iconSizes.xl} p-0`, className)} 
            onClick={onClick}
            disabled={disabled}
          >
            {children}
          </Button>
          {badge && (
            <CommonBadge
              status="company"
              customLabel={badge.toString()}
              variant="destructive"
              className={`absolute -top-1 -right-1 ${iconSizes.sm} p-0 text-xs flex items-center justify-center`}
            />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
