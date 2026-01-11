'use client';

import React, { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle, Eye, EyeOff } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';

// Types για το unified form field system
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
}

export interface FormFieldValidation {
  required?: boolean;
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  custom?: (value: any) => string | undefined;
}

export interface UnifiedFormFieldProps {
  // Basic props
  id: string;
  name?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 
         'textarea' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'file';
  
  // Value and change handling
  value?: any;
  onChange?: (value: any) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  
  // Label and description
  label?: string;
  description?: string;
  placeholder?: string;
  helpText?: string;
  tooltip?: string;
  
  // Validation and errors
  error?: string;
  validation?: FormFieldValidation;
  showValidationIcon?: boolean;
  
  // Layout options
  labelPosition?: 'top' | 'left' | 'right' | 'floating';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal' | 'bordered';
  
  // State
  disabled?: boolean;
  readOnly?: boolean;
  loading?: boolean;
  required?: boolean;
  
  // Select/Multi-select specific
  options?: SelectOption[];
  multiple?: boolean;
  searchable?: boolean;
  
  // Textarea specific
  rows?: number;
  resize?: boolean;
  
  // Number specific
  min?: number;
  max?: number;
  step?: number;
  
  // Formatting options
  currency?: boolean;
  percentage?: boolean;
  thousandsSeparator?: boolean;
  
  // Unit display
  unit?: string;
  unitPosition?: 'left' | 'right';
  
  // Actions
  actions?: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
  }>;
  
  // Style overrides
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
  
  // Additional props
  [key: string]: any;
}

export const UnifiedFormField = forwardRef<HTMLElement, UnifiedFormFieldProps>(({
  id,
  name = id,
  type = 'text',
  value,
  onChange,
  onBlur,
  onFocus,
  label,
  description,
  placeholder,
  helpText,
  tooltip,
  error,
  validation,
  showValidationIcon = true,
  labelPosition = 'top',
  size = 'md',
  variant = 'default',
  disabled = false,
  readOnly = false,
  loading = false,
  required = false,
  options = [],
  multiple = false,
  searchable = false,
  rows = 3,
  resize = true,
  min,
  max,
  step,
  currency = false,
  percentage = false,
  thousandsSeparator = false,
  unit,
  unitPosition = 'right',
  actions = [],
  className,
  inputClassName,
  labelClassName,
  ...props
}, ref) => {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, radius } = useBorderTokens();
  const { t } = useTranslation('forms');
  const [showPassword, setShowPassword] = React.useState(false);
  
  // Determine if field has error
  const hasError = Boolean(error);
  const isValid = !hasError && value && validation;
  
  // Size variants
  const sizeVariants = {
    sm: 'h-8 text-xs',
    md: 'h-10 text-sm',
    lg: 'h-12 text-base',
  };
  
  // Format value for display
  const formatValue = (val: any) => {
    if (val === undefined || val === null) return '';
    
    if (type === 'number' && typeof val === 'number') {
      if (currency) {
        return new Intl.NumberFormat('el-GR', {
          style: 'currency',
          currency: 'EUR'
        }).format(val);
      }
      
      if (percentage) {
        return `${val}%`;
      }
      
      if (thousandsSeparator) {
        return val.toLocaleString('el-GR');
      }
    }
    
    return val;
  };
  
  // Handle value change
  const handleChange = (newValue: any) => {
    if (onChange) {
      let processedValue = newValue;
      
      // Process number inputs
      if (type === 'number') {
        const numValue = parseFloat(newValue);
        processedValue = isNaN(numValue) ? '' : numValue;
      }
      
      onChange(processedValue);
    }
  };
  
  // Render input based on type
  const renderInput = () => {
    const baseInputProps = {
      id,
      name,
      value: type === 'number' ? value : formatValue(value),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => 
        handleChange(e.target.value),
      onBlur,
      onFocus,
      disabled: disabled || loading,
      readOnly,
      placeholder,
      required,
      className: cn(
        sizeVariants[size],
        {
          [`${getStatusBorder('error')} focus:${getStatusBorder('error').replace('border-', 'border-')} focus:ring-red-500`]: hasError,
          [`${getStatusBorder('success')} focus:${getStatusBorder('success').replace('border-', 'border-')} focus:ring-green-500`]: isValid,
          'cursor-not-allowed opacity-50': disabled,
          'bg-muted': readOnly,
        },
        inputClassName
      ),
      ...props
    };
    
    switch (type) {
      case 'textarea':
        return (
          <Textarea
            {...baseInputProps}
            rows={rows}
            className={cn(
              baseInputProps.className,
              !resize && 'resize-none'
            )}
            ref={ref as React.RefObject<HTMLTextAreaElement>}
          />
        );
        
      case 'select':
        return (
          <Select 
            value={value} 
            onValueChange={handleChange}
            disabled={disabled || loading}
          >
            <SelectTrigger className={baseInputProps.className}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem 
                  key={option.value} 
                  value={option.value}
                  disabled={option.disabled}
                >
                  <div className="flex flex-col">
                    <span>{option.label}</span>
                    {option.description && (
                      <span className="text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
        
      case 'password':
        return (
          <div className="relative">
            <Input
              {...baseInputProps}
              type={showPassword ? 'text' : 'password'}
              ref={ref as React.RefObject<HTMLInputElement>}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "absolute right-0 top-0 h-full px-3 py-2",
                INTERACTIVE_PATTERNS.SUBTLE_TRANSPARENT
              )}
              onClick={() => setShowPassword(!showPassword)}
              disabled={disabled}
            >
              {showPassword ? (
                <EyeOff className={iconSizes.sm} />
              ) : (
                <Eye className={iconSizes.sm} />
              )}
            </Button>
          </div>
        );
        
      case 'number':
        return (
          <div className="relative flex">
            {unit && unitPosition === 'left' && (
              <span className={`inline-flex items-center px-3 text-sm text-muted-foreground bg-muted ${quick.input} border-r-0 ${radius.md} rounded-r-none`}>
                {unit}
              </span>
            )}
            <Input
              {...baseInputProps}
              type="number"
              min={min}
              max={max}
              step={step}
              className={cn(
                baseInputProps.className,
                unit && unitPosition === 'left' && 'rounded-l-none',
                unit && unitPosition === 'right' && 'rounded-r-none'
              )}
              ref={ref as React.RefObject<HTMLInputElement>}
            />
            {unit && unitPosition === 'right' && (
              <span className={`inline-flex items-center px-3 text-sm text-muted-foreground bg-muted ${quick.input} border-l-0 ${radius.md} rounded-l-none`}>
                {unit}
              </span>
            )}
          </div>
        );
        
      default:
        return (
          <Input
            {...baseInputProps}
            type={type}
            ref={ref as React.RefObject<HTMLInputElement>}
          />
        );
    }
  };
  
  // Render field label
  const renderLabel = () => {
    if (!label) return null;
    
    return (
      <div className="flex items-center gap-2">
        <Label
          htmlFor={id}
          className={cn(
            'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
            {
              'text-red-600': hasError,
              'text-green-600': isValid,
            },
            labelClassName
          )}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className={`${iconSizes.sm} text-muted-foreground`} />
              </TooltipTrigger>
              <TooltipContent>
                <p>{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        {loading && (
          <AnimatedSpinner size="small" />
        )}
      </div>
    );
  };
  
  // Render actions
  const renderActions = () => {
    if (actions.length === 0) return null;
    
    return (
      <div className="flex items-center gap-1">
        {actions.map((action, index) => (
          <Button
            key={index}
            type="button"
            variant="ghost"
            size="sm"
            onClick={action.onClick}
            disabled={disabled}
            title={action.label}
          >
            <action.icon className={iconSizes.sm} />
          </Button>
        ))}
      </div>
    );
  };
  
  // Layout based on label position
  const isHorizontal = labelPosition === 'left' || labelPosition === 'right';
  
  return (
    <div className={cn('space-y-2', className)}>
      {labelPosition === 'top' && renderLabel()}
      
      <div className={cn(
        isHorizontal ? 'flex items-center gap-4' : 'space-y-2'
      )}>
        {labelPosition === 'left' && (
          <div className="min-w-0 flex-shrink-0">
            {renderLabel()}
          </div>
        )}
        
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            {renderInput()}
            {renderActions()}
          </div>
          
          {/* Description */}
          {description && (
            <p className="text-sm text-muted-foreground">
              {description}
            </p>
          )}
          
          {/* Error message */}
          {error && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              {showValidationIcon && <span>⚠️</span>}
              {error}
            </p>
          )}
          
          {/* Help text */}
          {helpText && !error && (
            <p className="text-xs text-muted-foreground">
              {helpText}
            </p>
          )}
        </div>
        
        {labelPosition === 'right' && (
          <div className="min-w-0 flex-shrink-0">
            {renderLabel()}
          </div>
        )}
      </div>
    </div>
  );
});

UnifiedFormField.displayName = 'UnifiedFormField';