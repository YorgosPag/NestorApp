"use client";
import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Home } from "lucide-react";
import type { TypeCheckboxesProps } from "../types";
import { PROPERTY_TYPES } from "../constants";
import { useIconSizes } from '@/hooks/useIconSizes';

export function TypeCheckboxes({ selected, onToggle }: TypeCheckboxesProps) {
  const iconSizes = useIconSizes();

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium flex items-center gap-2">
        <Home className={iconSizes.sm} />
        Τύπος Ακινήτου
      </Label>
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {PROPERTY_TYPES.map((t) => (
          <div key={t.value} className="flex items-center space-x-2">
            <Checkbox
              id={`type-${t.value}`}
              checked={selected.includes(t.value)}
              onCheckedChange={(checked) => onToggle(t.value, !!checked)}
            />
            <Label htmlFor={`type-${t.value}`} className="text-sm font-normal cursor-pointer">
              {t.label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
