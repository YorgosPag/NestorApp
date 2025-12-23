
'use client';

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function ZoomControls({ zoom, onZoomIn, onZoomOut, onReset }: ZoomControlsProps) {
  const iconSizes = useIconSizes();
  return (
    <div className="flex items-center gap-1 border rounded-md p-1">
      <Button variant="ghost" size="sm" onClick={onZoomOut} className={`${iconSizes.xl} p-0`}>
        <ZoomOut className={iconSizes.sm} />
      </Button>
      <span className="text-xs px-2 min-w-[3rem] text-center">
        {Math.round(zoom * 100)}%
      </span>
      <Button variant="ghost" size="sm" onClick={onZoomIn} className={`${iconSizes.xl} p-0`}>
        <ZoomIn className={iconSizes.sm} />
      </Button>
      <Separator orientation="vertical" className="h-6" />
      <Button variant="ghost" size="sm" onClick={onReset} className={`${iconSizes.xl} p-0`}>
        <RotateCcw className={iconSizes.sm} />
      </Button>
    </div>
  );
}
