"use client";
import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { StatusCheckboxesProps } from "../types";
import { AVAILABILITY } from "../constants";

export function StatusCheckboxes({ selected, onToggle }: StatusCheckboxesProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Διαθεσιμότητα</Label>
      <div className="space-y-2">
        {AVAILABILITY.map((opt) => (
          <div key={opt.value} className="flex items-center space-x-2">
            <Checkbox
              id={`status-${opt.value}`}
              checked={selected.includes(opt.value)}
              onCheckedChange={(checked) => onToggle(opt.value, !!checked)}
            />
            <Label htmlFor={`status-${opt.value}`} className="text-sm font-normal cursor-pointer">
              {opt.label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
