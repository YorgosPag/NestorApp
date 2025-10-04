
'use client';

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function ZoomControls({ zoom, onZoomIn, onZoomOut, onReset }: ZoomControlsProps) {
  return (
    <div className="flex items-center gap-1 border rounded-md p-1">
      <Button variant="ghost" size="sm" onClick={onZoomOut} className="h-8 w-8 p-0">
        <ZoomOut className="h-4 w-4" />
      </Button>
      <span className="text-xs px-2 min-w-[3rem] text-center">
        {Math.round(zoom * 100)}%
      </span>
      <Button variant="ghost" size="sm" onClick={onZoomIn} className="h-8 w-8 p-0">
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Separator orientation="vertical" className="h-6" />
      <Button variant="ghost" size="sm" onClick={onReset} className="h-8 w-8 p-0">
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}
