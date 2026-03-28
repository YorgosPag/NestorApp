'use client';

/**
 * OwnersList — Reusable multi-owner form component (domain-neutral)
 *
 * Manages a list of PropertyOwnerEntry[] with contact search + percentage inputs.
 * Used by: ReserveDialog, SellDialog, ProjectLandownersTab.
 *
 * Business logic (validation, formatting) lives in @/lib/ownership/owner-utils.
 * This component is pure UI.
 *
 * @module components/shared/owners/OwnersList
 * @enterprise ADR-244
 */

import React, { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ContactSearchManager } from '@/components/contacts/relationships/ContactSearchManager';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { cn } from '@/lib/utils';
import { Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { isPercentageValid } from '@/lib/ownership/owner-utils';
import type { PropertyOwnerEntry, PropertyOwnerRole } from '@/types/ownership-table';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

export interface OwnersListProps {
  /** Current owners array */
  owners: PropertyOwnerEntry[];
  /** Callback when owners change */
  onChange: (owners: PropertyOwnerEntry[]) => void;
  /** Default role for new entries */
  defaultRole: PropertyOwnerRole;
  /** Disable all interactions */
  disabled?: boolean;
  /** Maximum number of owners (default: 10) */
  maxOwners?: number;
  /** Read-only mode — show names only, no editing */
  readOnly?: boolean;
  /** Allow removing the last owner (default: false — sales requires >=1 buyer) */
  allowEmpty?: boolean;
  /** Context-aware labels (override defaults for different domains) */
  labels?: {
    /** Label for single owner (default: "Αγοραστής") */
    singular?: string;
    /** Label for multiple owners (default: "Ιδιοκτήτες") */
    plural?: string;
    /** Add button text (default: "Προσθήκη Συνιδιοκτήτη") */
    addButton?: string;
    /** Required message (default: "Η επιλογή αγοραστή είναι υποχρεωτική") */
    required?: string;
    /** Search placeholder (default: "Αναζήτηση επαφής...") */
    placeholder?: string;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_MAX_OWNERS = 10;

// ============================================================================
// HELPERS (component-private)
// ============================================================================

function createEmptyOwner(role: PropertyOwnerRole): PropertyOwnerEntry {
  return {
    contactId: '',
    name: '',
    ownershipPct: 100,
    role,
    paymentPlanId: null,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function OwnersList({
  owners,
  onChange,
  defaultRole,
  disabled = false,
  maxOwners = DEFAULT_MAX_OWNERS,
  readOnly = false,
  allowEmpty = false,
  labels,
}: OwnersListProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // Context-aware labels — defaults are sales-oriented, overridable per domain
  const labelSingular = labels?.singular ?? t('sales.dialogs.reserve.buyerName');
  const labelPlural = labels?.plural ?? t('sales.dialogs.owners.label');
  const labelAdd = labels?.addButton ?? t('sales.dialogs.owners.addCoOwner');
  const labelRequired = labels?.required ?? t('sales.dialogs.reserve.buyerRequired');
  const labelPlaceholder = labels?.placeholder ?? t('sales.dialogs.reserve.buyerPlaceholder');

  // ── Derived state (validation via SSoT: owner-utils) ─────────────────
  const totalPct = useMemo(
    () => owners.reduce((sum, o) => sum + o.ownershipPct, 0),
    [owners],
  );
  const isValidTotal = isPercentageValid(owners);
  // When allowEmpty=true (landowners), single owner shows % + delete like multi-owner
  const isSingleOwner = !allowEmpty && owners.length === 1;

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleAdd = useCallback(() => {
    if (owners.length >= maxOwners) return;

    // If adding second owner, split existing 100% to 50/50
    if (owners.length === 1 && owners[0].ownershipPct === 100) {
      const secondRole = defaultRole === 'buyer' ? 'co_buyer' as const : defaultRole;
      onChange([
        { ...owners[0], ownershipPct: 50 },
        { ...createEmptyOwner(secondRole), ownershipPct: 50 },
      ]);
    } else {
      const newRole = defaultRole === 'buyer' ? 'co_buyer' as const : defaultRole;
      onChange([...owners, createEmptyOwner(newRole)]);
    }
  }, [owners, onChange, maxOwners, defaultRole]);

  const handleRemove = useCallback((index: number) => {
    const updated = owners.filter((_, i) => i !== index);
    // If back to single owner, auto-set 100% (regardless of allowEmpty)
    if (updated.length === 1) {
      updated[0] = { ...updated[0], ownershipPct: 100, role: defaultRole };
    }
    onChange(updated);
  }, [owners, onChange, defaultRole]);

  const handleContactSelect = useCallback((index: number, contact: ContactSummary | null) => {
    onChange(owners.map((entry, i) =>
      i === index
        ? { ...entry, contactId: contact?.id ?? '', name: contact?.name ?? '' }
        : entry
    ));
  }, [owners, onChange]);

  const handlePercentageChange = useCallback((index: number, value: string) => {
    const parsed = parseFloat(value);
    const pct = isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed));
    onChange(owners.map((entry, i) =>
      i === index ? { ...entry, ownershipPct: pct } : entry
    ));
  }, [owners, onChange]);

  const getExcludeIds = useCallback((currentIndex: number): string[] => {
    return owners
      .filter((_, i) => i !== currentIndex)
      .map(o => o.contactId)
      .filter(Boolean);
  }, [owners]);

  // ── Read-only mode ─────────────────────────────────────────────────────
  if (readOnly && owners.length > 0) {
    return (
      <section className="space-y-1">
        <Label className="text-sm font-medium">
          {labelSingular}
        </Label>
        <ul className="space-y-1">
          {owners.map((owner) => (
            <li key={owner.contactId} className="text-sm text-foreground">
              {owner.name}
              {owners.length > 1 && (
                <span className={cn('ml-1', COLOR_BRIDGE.text.muted)}>
                  ({owner.ownershipPct}%)
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  // ── Empty state: start with first owner ────────────────────────────────
  if (owners.length === 0) {
    return (
      <fieldset className="space-y-1">
        <Label className="text-sm font-medium">
          {labelSingular}
        </Label>
        <ContactSearchManager
          selectedContactId=""
          onContactSelect={(contact) => {
            if (contact) {
              onChange([{ ...createEmptyOwner(defaultRole), contactId: contact.id, name: contact.name }]);
            }
          }}
          allowedContactTypes={['individual', 'company']}
          placeholder={labelPlaceholder}
          disabled={disabled}
        />
        <p className="text-xs text-destructive">
          {labelRequired}
        </p>
      </fieldset>
    );
  }

  // ── Main list ──────────────────────────────────────────────────────────
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <Label className="text-sm font-medium">
        {owners.length > 1 ? labelPlural : labelSingular}
      </Label>

      <ol className="space-y-2">
        {owners.map((owner, index) => (
          <li key={`owner-${index}`} className="flex items-end gap-2">
            <section className="min-w-0 flex-1">
              <ContactSearchManager
                selectedContactId={owner.contactId}
                onContactSelect={(contact) => handleContactSelect(index, contact)}
                excludeContactIds={getExcludeIds(index)}
                allowedContactTypes={['individual', 'company']}
                placeholder={labelPlaceholder}
                disabled={disabled}
              />
            </section>

            {!isSingleOwner && (
              <section className="w-20 shrink-0">
                <Label className="text-xs">%</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={owners.length === 1 ? 100 : (owner.ownershipPct || '')}
                  onChange={(e) => handlePercentageChange(index, e.target.value)}
                  className="text-right text-sm"
                  disabled={disabled || owners.length === 1}
                />
              </section>
            )}

            {!isSingleOwner && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => handleRemove(index)}
                disabled={disabled}
                aria-label={t('sales.dialogs.owners.remove')}
              >
                <Trash2 className={cn(iconSizes.sm, 'text-destructive')} />
              </Button>
            )}
          </li>
        ))}
      </ol>

      <footer className="flex items-center justify-between pt-1">
        {owners.length < maxOwners && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("gap-1 text-xs", colors.text.muted)}
            onClick={handleAdd}
            disabled={disabled}
          >
            <Plus className={iconSizes.xs} />
            {labelAdd}
          </Button>
        )}

        {!isSingleOwner && owners.length > 0 && (
          <span className={cn(
            'inline-flex items-center gap-1 text-xs font-medium',
            isValidTotal ? COLOR_BRIDGE.text.success : COLOR_BRIDGE.text.error,
          )}>
            {isValidTotal ? (
              <CheckCircle className="h-3.5 w-3.5" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5" />
            )}
            {totalPct.toFixed(0)}%
            {!isValidTotal && (
              <span className="ml-0.5">
                — {t('sales.dialogs.owners.totalMustBe100')}
              </span>
            )}
          </span>
        )}
      </footer>
    </fieldset>
  );
}
