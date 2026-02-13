'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

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
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: Centralized spacing tokens
  const spacing = useSpacingTokens();
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
        <div className={cn(
            "flex",
            labelPosition === 'top' ? cn("flex-col", spacing.spaceBetween.sm) : cn("flex-row items-center justify-between", spacing.gap.md)
        )}>
        <Label htmlFor={id} className={cn("text-sm font-medium", labelClassName)}>
            {label}
            {tooltipText && (
            <Tooltip>
                <TooltipTrigger asChild>
                <Info className={`${iconSizes.xs} text-muted-foreground ml-1 inline-block cursor-help`} />
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
                readOnly ? 'bg-muted/50 border-dashed' : colors.bg.primary,
                unit && unitPosition === 'left' && 'pl-8',
                unit && unitPosition === 'right' && 'pr-8'
            )}
            />
            {unit && unitPosition === 'right' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{unit}</span>}
        </div>
        </div>
  );
}
