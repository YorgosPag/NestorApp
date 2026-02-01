'use client';

/**
 * @fileoverview Bank Account Card Component
 * @description Display card for a single bank account
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-01
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BankAccount } from '@/types/contacts/banking';
import { formatIBAN, ACCOUNT_TYPE_LABELS, CURRENCY_LABELS } from '@/types/contacts/banking';
import { getBankByCode } from '@/constants/greek-banks';
import {
  Star,
  StarOff,
  Pencil,
  Trash2,
  Building2,
  CreditCard,
  Copy,
  Check
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

// ============================================================================
// TYPES
// ============================================================================

interface BankAccountCardProps {
  /** The bank account to display */
  account: BankAccount;
  /** Whether the card is in edit mode (show actions) */
  editable?: boolean;
  /** Handler for edit action */
  onEdit?: (account: BankAccount) => void;
  /** Handler for delete action */
  onDelete?: (account: BankAccount) => void;
  /** Handler for set primary action */
  onSetPrimary?: (account: BankAccount) => void;
  /** Custom className */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Bank Account Card Component
 *
 * Displays a bank account with:
 * - Bank name and logo color
 * - Formatted IBAN with copy button
 * - Account type and currency badges
 * - Primary account indicator
 * - Edit/Delete actions (when editable)
 *
 * @example
 * ```tsx
 * <BankAccountCard
 *   account={account}
 *   editable
 *   onEdit={(acc) => openEditDialog(acc)}
 *   onDelete={(acc) => confirmDelete(acc)}
 *   onSetPrimary={(acc) => setPrimary(acc)}
 * />
 * ```
 */
export function BankAccountCard({
  account,
  editable = false,
  onEdit,
  onDelete,
  onSetPrimary,
  className
}: BankAccountCardProps) {
  const iconSizes = useIconSizes();
  const [copied, setCopied] = React.useState(false);

  // Get bank info for color
  const bankInfo = account.bankCode ? getBankByCode(account.bankCode) : null;
  const brandColor = bankInfo?.brandColor || '#6B7280';

  // Format IBAN for display
  const formattedIban = formatIBAN(account.iban);

  // Copy IBAN to clipboard
  const handleCopyIban = async () => {
    try {
      await navigator.clipboard.writeText(account.iban);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy IBAN:', err);
    }
  };

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all hover:shadow-md',
        account.isPrimary && 'ring-2 ring-primary',
        !account.isActive && 'opacity-60',
        className
      )}
    >
      {/* Color accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: brandColor }}
        aria-hidden="true"
      />

      <CardContent className="pl-4 py-4">
        <div className="flex items-start justify-between gap-4">
          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Bank name and primary badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <Building2
                size={iconSizes.numeric.md}
                style={{ color: brandColor }}
                aria-hidden="true"
              />
              <span className="font-medium text-foreground truncate">
                {account.bankName}
              </span>
              {account.isPrimary && (
                <Badge variant="default" className="shrink-0">
                  <Star size={iconSizes.numeric.xs} className="mr-1" />
                  Κύριος
                </Badge>
              )}
              {!account.isActive && (
                <Badge variant="secondary" className="shrink-0">
                  Ανενεργός
                </Badge>
              )}
            </div>

            {/* IBAN with copy button */}
            <div className="flex items-center gap-2">
              <CreditCard
                size={iconSizes.numeric.sm}
                className="text-muted-foreground shrink-0"
                aria-hidden="true"
              />
              <code className="font-mono text-sm text-foreground bg-muted px-2 py-1 rounded">
                {formattedIban}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleCopyIban}
                title="Αντιγραφή IBAN"
              >
                {copied ? (
                  <Check size={iconSizes.numeric.sm} className="text-green-500" />
                ) : (
                  <Copy size={iconSizes.numeric.sm} />
                )}
              </Button>
            </div>

            {/* Account type and currency */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">
                {ACCOUNT_TYPE_LABELS[account.accountType]}
              </Badge>
              <Badge variant="outline">
                {CURRENCY_LABELS[account.currency] || account.currency}
              </Badge>
              {account.holderName && (
                <span className="text-sm text-muted-foreground">
                  Δικαιούχος: {account.holderName}
                </span>
              )}
            </div>

            {/* Notes */}
            {account.notes && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {account.notes}
              </p>
            )}
          </div>

          {/* Actions */}
          {editable && (
            <div className="flex flex-col gap-1 shrink-0">
              {/* Set as primary */}
              {!account.isPrimary && onSetPrimary && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onSetPrimary(account)}
                  title="Ορισμός ως κύριος"
                >
                  <StarOff size={iconSizes.numeric.sm} />
                </Button>
              )}

              {/* Edit */}
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(account)}
                  title="Επεξεργασία"
                >
                  <Pencil size={iconSizes.numeric.sm} />
                </Button>
              )}

              {/* Delete */}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete(account)}
                  title="Διαγραφή"
                >
                  <Trash2 size={iconSizes.numeric.sm} />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default BankAccountCard;
