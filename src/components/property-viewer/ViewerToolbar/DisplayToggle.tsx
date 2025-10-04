
'use client';

import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

interface DisplayToggleProps {
  showLabels: boolean;
  onToggleLabels: () => void;
}

export function DisplayToggle({ showLabels, onToggleLabels }: DisplayToggleProps) {
  return (
    <div className="flex items-center gap-1 border rounded-md p-1">
      <Button
        variant={showLabels ? "default" : "ghost"}
        size="sm"
        onClick={onToggleLabels}
        className="h-8 w-8 p-0"
      >
        {showLabels ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </Button>
    </div>
  );
}
