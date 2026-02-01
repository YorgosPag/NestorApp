'use client';

/**
 * @fileoverview Bank Selector Component
 * @description Radix-based dropdown for Greek banks selection
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-01
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards - ADR-001 (Radix Select only)
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  GREEK_BANKS,
  getSystemicBanks,
  getAllBanksSorted,
  type BankInfo
} from '@/constants/greek-banks';

// ============================================================================
// TYPES
// ============================================================================

interface BankSelectorProps {
  /** Currently selected bank code (SWIFT/BIC) */
  value?: string;
  /** Change handler - receives both code and bank info */
  onChange: (code: string, bank: BankInfo | undefined) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Custom label */
  label?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Custom placeholder */
  placeholder?: string;
  /** Custom className */
  className?: string;
  /** Show grouped banks (systemic first) */
  grouped?: boolean;
  /** Allow custom/other bank entry */
  allowOther?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const OTHER_BANK_VALUE = '__OTHER__';

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Bank Selector Component
 *
 * Features:
 * - Greek banks catalog with SWIFT/BIC codes
 * - Grouped display (systemic banks first)
 * - Optional "Other" selection for non-Greek banks
 * - ADR-001 compliant (Radix Select)
 *
 * @example
 * ```tsx
 * <BankSelector
 *   value={bankCode}
 *   onChange={(code, bank) => {
 *     setBankCode(code);
 *     setBankName(bank?.name || '');
 *   }}
 *   grouped
 * />
 * ```
 */
export function BankSelector({
  value,
  onChange,
  disabled = false,
  label = 'Τράπεζα',
  required = false,
  placeholder = 'Επιλέξτε τράπεζα...',
  className,
  grouped = true,
  allowOther = true
}: BankSelectorProps) {
  const systemicBanks = getSystemicBanks();
  const allBanks = getAllBanksSorted();
  const otherBanks = allBanks.filter(
    bank => !systemicBanks.some(s => s.code === bank.code)
  );

  const handleValueChange = (newValue: string) => {
    if (newValue === OTHER_BANK_VALUE) {
      onChange('', undefined);
    } else {
      const bank = GREEK_BANKS.find(b => b.code === newValue);
      onChange(newValue, bank);
    }
  };

  const renderBankItem = (bank: BankInfo) => (
    <SelectItem key={bank.code} value={bank.code}>
      <span className="flex items-center gap-2">
        {bank.brandColor && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: bank.brandColor }}
            aria-hidden="true"
          />
        )}
        <span>{bank.name}</span>
      </span>
    </SelectItem>
  );

  return (
    <div className={cn('space-y-2', className)}>
      {/* Label */}
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {/* Select */}
      <Select
        value={value || undefined}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {grouped ? (
            <>
              {/* Systemic Banks Group */}
              <SelectGroup>
                <SelectLabel>Συστημικές Τράπεζες</SelectLabel>
                {systemicBanks.map(renderBankItem)}
              </SelectGroup>

              <SelectSeparator />

              {/* Other Greek Banks Group */}
              <SelectGroup>
                <SelectLabel>Άλλες Τράπεζες</SelectLabel>
                {otherBanks.map(renderBankItem)}
              </SelectGroup>

              {/* Other Option */}
              {allowOther && (
                <>
                  <SelectSeparator />
                  <SelectItem value={OTHER_BANK_VALUE}>
                    Άλλη τράπεζα (εξωτερικού)
                  </SelectItem>
                </>
              )}
            </>
          ) : (
            <>
              {/* Flat list */}
              {allBanks.map(renderBankItem)}

              {allowOther && (
                <>
                  <SelectSeparator />
                  <SelectItem value={OTHER_BANK_VALUE}>
                    Άλλη τράπεζα (εξωτερικού)
                  </SelectItem>
                </>
              )}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default BankSelector;
