'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface LabeledInputProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
}

export function LabeledInput({ id, icon, label, value, onChange, placeholder, className }: LabeledInputProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="text-xs font-medium flex items-center gap-1">
        {icon}
        {label}
      </Label>
      <div className="relative w-full">
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground">{icon}</div>
        <Input
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="h-9 pl-8"
        />
      </div>
    </div>
  );
}
