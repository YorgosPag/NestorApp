'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface Props {
  label: string;
  value: string | number;
  onChange: (value: any) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
  helper?: string;
  trailingElement?: React.ReactNode;
}

export function FormRowInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  error,
  required,
  helper,
  trailingElement
}: Props) {
  const { getStatusBorder } = useBorderTokens();
  return (
    <div className="space-y-2">
      <Label>{label}{required && ' *'}</Label>
      <div className="relative">
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
          placeholder={placeholder}
          className={cn(error && getStatusBorder('error'))}
        />
        {trailingElement && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {trailingElement}
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}
