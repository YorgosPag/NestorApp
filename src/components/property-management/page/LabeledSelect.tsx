'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LabeledSelectProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  onValueChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function LabeledSelect({ id, icon, label, value, onValueChange, options, placeholder }: LabeledSelectProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-medium flex items-center gap-1">
        {icon}
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="h-9">
          <SelectValue placeholder={placeholder || `Επιλέξτε ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
