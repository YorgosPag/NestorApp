'use client';

/**
 * @fileoverview Bank Account Form Component
 * @description Form for creating/editing bank accounts
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-01
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards - ADR-001 (Radix Select)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
  BankAccount,
  BankAccountInput,
  AccountType,
  CurrencyCode
} from '@/types/contacts/banking';
import {
  createEmptyBankAccount,
  validateIBAN,
  cleanIBAN,
  ACCOUNT_TYPE_LABELS,
  CURRENCY_LABELS
} from '@/types/contacts/banking';
import { getBankByIBAN } from '@/constants/greek-banks';
import { IBANInput } from './IBANInput';
import { BankSelector } from './BankSelector';
import { Loader2, Save, X } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

// ============================================================================
// TYPES
// ============================================================================

interface BankAccountFormProps {
  /** Existing account for editing, or undefined for new */
  account?: BankAccount;
  /** Submit handler */
  onSubmit: (data: BankAccountInput) => Promise<void>;
  /** Cancel handler */
  onCancel: () => void;
  /** Whether the form is in loading state */
  loading?: boolean;
  /** Custom className */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Bank Account Form Component
 *
 * Features:
 * - Create or edit bank accounts
 * - IBAN validation with auto-bank detection
 * - Account type and currency selection
 * - Primary account toggle
 *
 * @example
 * ```tsx
 * <BankAccountForm
 *   account={editingAccount}
 *   onSubmit={async (data) => {
 *     await BankAccountsService.addAccount(contactId, data);
 *   }}
 *   onCancel={() => setIsEditing(false)}
 * />
 * ```
 */
export function BankAccountForm({
  account,
  onSubmit,
  onCancel,
  loading = false,
  className
}: BankAccountFormProps) {
  const iconSizes = useIconSizes();
  const isEditing = !!account;

  // Form state
  const [formData, setFormData] = useState<BankAccountInput>(() => {
    if (account) {
      return {
        bankName: account.bankName,
        bankCode: account.bankCode,
        iban: account.iban,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        currency: account.currency,
        isPrimary: account.isPrimary,
        holderName: account.holderName,
        notes: account.notes,
        isActive: account.isActive
      };
    }
    return createEmptyBankAccount();
  });

  // Validation state - validate initial IBAN if editing
  const [ibanValid, setIbanValid] = useState(() => {
    if (account?.iban) {
      const result = validateIBAN(account.iban);
      return result.valid;
    }
    return false;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-detect bank from IBAN
  useEffect(() => {
    if (ibanValid && formData.iban) {
      const bank = getBankByIBAN(formData.iban);
      if (bank && !formData.bankCode) {
        setFormData(prev => ({
          ...prev,
          bankName: bank.name,
          bankCode: bank.code
        }));
      }
    }
  }, [formData.iban, ibanValid, formData.bankCode]);

  // Handle IBAN change
  const handleIbanChange = useCallback((value: string, isValid: boolean) => {
    setIbanValid(isValid);
    setFormData(prev => ({ ...prev, iban: value }));
    if (isValid) {
      setErrors(prev => {
        const next = { ...prev };
        delete next.iban;
        return next;
      });
    }
  }, []);

  // Handle bank selection
  const handleBankChange = useCallback((code: string, bank: { name: string } | undefined) => {
    setFormData(prev => ({
      ...prev,
      bankCode: code || undefined,
      bankName: bank?.name || prev.bankName
    }));
  }, []);

  // Handle form field changes
  const handleFieldChange = useCallback((
    field: keyof BankAccountInput,
    value: string | boolean
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    // IBAN validation
    if (!formData.iban) {
      newErrors.iban = 'Το IBAN είναι υποχρεωτικό';
    } else if (!ibanValid) {
      newErrors.iban = 'Μη έγκυρο IBAN';
    }

    // Bank name validation
    if (!formData.bankName.trim()) {
      newErrors.bankName = 'Το όνομα τράπεζας είναι υποχρεωτικό';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, ibanValid]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('[BankAccountForm] Submit clicked', {
      ibanValid,
      iban: formData.iban,
      bankName: formData.bankName
    });

    if (!validateForm()) {
      console.log('[BankAccountForm] Validation failed', errors);
      return;
    }

    console.log('[BankAccountForm] Validation passed, submitting...');

    try {
      await onSubmit(formData);
      console.log('[BankAccountForm] Submit successful');
    } catch (error) {
      console.error('[BankAccountForm] Submit error:', error);
      if (error instanceof Error) {
        setErrors({ submit: error.message });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      {/* IBAN */}
      <IBANInput
        value={formData.iban}
        onChange={handleIbanChange}
        disabled={loading}
        required
        error={errors.iban}
        showBankName
      />

      {/* Bank Selector */}
      <BankSelector
        value={formData.bankCode}
        onChange={handleBankChange}
        disabled={loading}
        required
        grouped
        allowOther
      />

      {/* Bank Name (for other banks or override) */}
      {(!formData.bankCode || formData.bankCode === '') && (
        <div className="space-y-2">
          <Label htmlFor="bankName">
            Όνομα Τράπεζας
            <span className="text-destructive ml-1">*</span>
          </Label>
          <Input
            id="bankName"
            value={formData.bankName}
            onChange={(e) => handleFieldChange('bankName', e.target.value)}
            disabled={loading}
            placeholder="π.χ. Deutsche Bank"
          />
          {errors.bankName && (
            <p className="text-sm text-destructive">{errors.bankName}</p>
          )}
        </div>
      )}

      {/* Account Type and Currency - Side by Side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Account Type */}
        <div className="space-y-2">
          <Label>Τύπος Λογαριασμού</Label>
          <Select
            value={formData.accountType}
            onValueChange={(value) => handleFieldChange('accountType', value as AccountType)}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(ACCOUNT_TYPE_LABELS) as [AccountType, string][]).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Currency */}
        <div className="space-y-2">
          <Label>Νόμισμα</Label>
          <Select
            value={formData.currency}
            onValueChange={(value) => handleFieldChange('currency', value as CurrencyCode)}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(CURRENCY_LABELS) as [CurrencyCode, string][]).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Holder Name (optional) */}
      <div className="space-y-2">
        <Label htmlFor="holderName">
          Δικαιούχος <span className="text-muted-foreground">(προαιρετικό)</span>
        </Label>
        <Input
          id="holderName"
          value={formData.holderName || ''}
          onChange={(e) => handleFieldChange('holderName', e.target.value)}
          disabled={loading}
          placeholder="Για κοινούς λογαριασμούς ή διαφορετικό δικαιούχο"
        />
      </div>

      {/* Notes (optional) */}
      <div className="space-y-2">
        <Label htmlFor="notes">
          Σημειώσεις <span className="text-muted-foreground">(προαιρετικό)</span>
        </Label>
        <Textarea
          id="notes"
          value={formData.notes || ''}
          onChange={(e) => handleFieldChange('notes', e.target.value)}
          disabled={loading}
          placeholder="Επιπλέον πληροφορίες..."
          rows={3}
        />
      </div>

      {/* Switches */}
      <div className="space-y-4">
        {/* Primary Account */}
        <div className="flex items-center justify-between">
          <Label htmlFor="isPrimary" className="cursor-pointer">
            Κύριος λογαριασμός
          </Label>
          <Switch
            id="isPrimary"
            checked={formData.isPrimary}
            onCheckedChange={(checked) => handleFieldChange('isPrimary', checked)}
            disabled={loading}
            variant="status"
          />
        </div>

        {/* Active Account */}
        <div className="flex items-center justify-between">
          <Label htmlFor="isActive" className="cursor-pointer">
            Ενεργός λογαριασμός
          </Label>
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => handleFieldChange('isActive', checked)}
            disabled={loading}
            variant="status"
          />
        </div>
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          {errors.submit}
        </p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          <X size={iconSizes.numeric.sm} className="mr-2" />
          Ακύρωση
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <Loader2 size={iconSizes.numeric.sm} className="mr-2 animate-spin" />
          ) : (
            <Save size={iconSizes.numeric.sm} className="mr-2" />
          )}
          {isEditing ? 'Αποθήκευση' : 'Προσθήκη'}
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default BankAccountForm;
