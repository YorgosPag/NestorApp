"use client";

import React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================================================
// ENTERPRISE DROPDOWN SYSTEM - UNIFIED RADIX UI SOLUTION
// ============================================================================
//
// 🏢 ΕΠΑΓΓΕΛΜΑΤΙΚΟ: Single source of truth χρησιμοποιώντας Radix UI Select
// ♿ Enterprise Accessibility: WAI-ARIA compliant
// ⌨️ Professional Keyboard Navigation
// 📱 Mobile Ready & Touch Friendly
// 🎨 Custom Theme Integration (gray colors, professional styling)
//
// ============================================================================

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ComponentType<any>;
  disabled?: boolean;
}

export interface EnterpriseDropdownProps {
  value: string;
  onValueChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
}

/**
 * 🏢 Enterprise Dropdown Component - UNIFIED RADIX UI SOLUTION
 *
 * Επαγγελματικό dropdown component που χρησιμοποιεί Radix UI Select
 * με custom enterprise styling και backward compatibility
 *
 * Features:
 * ♿ WAI-ARIA compliant accessibility
 * ⌨️ Professional keyboard navigation
 * 📱 Mobile ready & touch friendly
 * 🎨 Custom theme integration (gray colors)
 * 🔄 100% backward compatible API
 */
export const EnterpriseDropdown: React.FC<EnterpriseDropdownProps> = ({
  value,
  onValueChange,
  options,
  placeholder = "Επιλέξτε...",
  disabled = false,
  className,
  error
}) => {
  return (
    <div className={cn("relative", className)}>
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn(
            "w-full h-10 px-3 py-2 text-sm",
            error ? "border-destructive focus:ring-destructive" : ""
          )}
        >
          <div className="flex items-center space-x-2 flex-1 text-left">
            {options.find(option => option.value === value) ? (
              <>
                {options.find(option => option.value === value)?.icon && (
                  React.createElement(
                    options.find(option => option.value === value)!.icon!,
                    { className: "h-4 w-4 text-muted-foreground" }
                  )
                )}
                <span className="text-foreground">
                  {options.find(option => option.value === value)?.label}
                </span>
              </>
            ) : (
              <SelectValue placeholder={placeholder} />
            )}
          </div>
        </SelectTrigger>

        <SelectContent>
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="flex items-center gap-2"
              >
                <div className="flex items-center gap-2 w-full">
                  {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                  <span className="flex-1">{option.label}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}
    </div>
  );
};

export default EnterpriseDropdown;