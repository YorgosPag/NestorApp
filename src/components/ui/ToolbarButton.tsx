'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { CommonBadge } from "@/core/badges";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';

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
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative">
          <Button 
            variant={variant} 
            size="sm" 
            className={cn("h-8 w-8 p-0", className)} 
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
              className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center"
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
