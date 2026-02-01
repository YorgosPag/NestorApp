'use client';

/**
 * @fileoverview IBAN Input Component
 * @description Enterprise-grade IBAN input with real-time validation
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-01
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards - ADR-001 (Radix components)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { validateIBAN, formatIBAN, cleanIBAN } from '@/types/contacts/banking';
import { getBankByIBAN } from '@/constants/greek-banks';
import { AlertCircle, CheckCircle2, Building2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

// ============================================================================
// TYPES
// ============================================================================

interface IBANInputProps {
  /** Current IBAN value */
  value: string;
  /** Change handler */
  onChange: (value: string, isValid: boolean) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Custom label */
  label?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Custom placeholder */
  placeholder?: string;
  /** Custom className */
  className?: string;
  /** Show detected bank name */
  showBankName?: boolean;
  /** Error message from parent */
  error?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * IBAN Input Component
 *
 * Features:
 * - Real-time IBAN validation (ISO 13616)
 * - Automatic formatting with spaces
 * - Greek bank detection from IBAN
 * - Visual validation feedback
 *
 * @example
 * ```tsx
 * <IBANInput
 *   value={iban}
 *   onChange={(value, isValid) => setIban(value)}
 *   showBankName
 * />
 * ```
 */
export function IBANInput({
  value,
  onChange,
  disabled = false,
  label = 'IBAN',
  required = false,
  placeholder = 'GR16 0110 1250 0000 0001 2300 695',
  className,
  showBankName = true,
  error: externalError
}: IBANInputProps) {
  const iconSizes = useIconSizes();
  const [localValue, setLocalValue] = useState(formatIBAN(value));
  const [validationState, setValidationState] = useState<{
    isValid: boolean;
    error?: string;
  }>({ isValid: false });
  const [detectedBank, setDetectedBank] = useState<string | null>(null);

  // Validate and detect bank when value changes
  useEffect(() => {
    const cleaned = cleanIBAN(value);
    if (!cleaned) {
      setValidationState({ isValid: false });
      setDetectedBank(null);
      return;
    }

    const result = validateIBAN(cleaned);
    setValidationState({
      isValid: result.valid,
      error: result.error
    });

    // Detect Greek bank
    if (result.valid) {
      const bank = getBankByIBAN(cleaned);
      setDetectedBank(bank?.name || null);
    } else {
      setDetectedBank(null);
    }
  }, [value]);

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.toUpperCase();

    // Allow only valid IBAN characters (letters and numbers)
    const filtered = inputValue.replace(/[^A-Z0-9\s]/g, '');

    // Format with spaces
    const formatted = formatIBAN(filtered);
    setLocalValue(formatted);

    // Clean for storage and validation
    const cleaned = cleanIBAN(filtered);
    const result = validateIBAN(cleaned);

    onChange(cleaned, result.valid);
  }, [onChange]);

  // Determine visual state
  const hasValue = cleanIBAN(localValue).length > 0;
  const showSuccess = hasValue && validationState.isValid;
  const showError = hasValue && !validationState.isValid;
  const errorMessage = externalError || validationState.error;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Label */}
      <Label htmlFor="iban-input" className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {/* Input with validation icon */}
      <div className="relative">
        <Input
          id="iban-input"
          type="text"
          value={localValue}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            'pr-10 font-mono tracking-wide',
            showSuccess && 'border-green-500 focus:ring-green-500',
            showError && 'border-destructive focus:ring-destructive'
          )}
          aria-invalid={showError}
          aria-describedby={errorMessage ? 'iban-error' : undefined}
        />

        {/* Validation icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          {showSuccess && (
            <CheckCircle2
              size={iconSizes.numeric.md}
              className="text-green-500"
              aria-label="Valid IBAN"
            />
          )}
          {showError && (
            <AlertCircle
              size={iconSizes.numeric.md}
              className="text-destructive"
              aria-label="Invalid IBAN"
            />
          )}
        </div>
      </div>

      {/* Error message */}
      {showError && errorMessage && (
        <p id="iban-error" className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle size={iconSizes.numeric.sm} />
          {errorMessage}
        </p>
      )}

      {/* Detected bank name */}
      {showBankName && detectedBank && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Building2 size={iconSizes.numeric.sm} className="text-primary" />
          <span>{detectedBank}</span>
        </p>
      )}
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default IBANInput;
