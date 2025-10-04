'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface FormFieldProps {
  id: string;
  label: string;
  value: number | string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEnterPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  unit?: string;
  readOnly?: boolean;
  tooltipText?: string;
  labelPosition?: 'top' | 'left';
  inputClassName?: string;
  labelClassName?: string;
  unitPosition?: 'left' | 'right';
  useGrouping?: boolean;
  isPercentage?: boolean;
}

export function FormField({
  id,
  label,
  value,
  onChange,
  onEnterPress,
  unit,
  readOnly = false,
  tooltipText,
  labelPosition = 'top',
  inputClassName,
  labelClassName,
  unitPosition = 'right',
  useGrouping = false,
  isPercentage = false
}: FormFieldProps) {
  const formatValue = (val: number | string) => {
    if (typeof val === 'number') {
        if (isPercentage) {
            return val.toFixed(2);
        }
        if (useGrouping) {
            return val.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return val.toString();
    }
    return val;
  };

  const displayValue = formatValue(value);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onEnterPress) {
      onEnterPress(e);
    }
  };

  return (
    <TooltipProvider>
        <div className={cn(
            "flex",
            labelPosition === 'top' ? "flex-col space-y-2" : "flex-row items-center justify-between gap-4"
        )}>
        <Label htmlFor={id} className={cn("text-sm font-medium", labelClassName)}>
            {label}
            {tooltipText && (
            <Tooltip>
                <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-muted-foreground ml-1 inline-block cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                <p>{tooltipText}</p>
                </TooltipContent>
            </Tooltip>
            )}
        </Label>
        <div className={cn("relative", inputClassName)}>
            {unit && unitPosition === 'left' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{unit}</span>}
            <Input
            id={id}
            name={id}
            type="text"
            value={displayValue}
            onChange={readOnly ? undefined : onChange}
            onKeyDown={readOnly ? undefined : handleKeyDown}
            readOnly={readOnly}
            className={cn(
                'h-8',
                readOnly ? 'bg-muted/50 border-dashed' : 'bg-background',
                unit && unitPosition === 'left' && 'pl-8',
                unit && unitPosition === 'right' && 'pr-8'
            )}
            />
            {unit && unitPosition === 'right' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{unit}</span>}
        </div>
        </div>
    </TooltipProvider>
  );
}
