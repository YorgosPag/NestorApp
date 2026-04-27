'use client';

/**
 * ============================================================================
 * CompanyAddressesSection - Multi-address Section for Company Contacts
 * ============================================================================
 *
 * Supports multiple addresses: headquarters (always present) + N branches.
 * Each branch uses SharedAddressActionCard (view) + AddressWithHierarchy (edit).
 *
 * @module components/contacts/dynamic/CompanyAddressesSection
 */

import React, { useCallback, useState, useImperativeHandle, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/design-system';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus } from 'lucide-react';
import { BranchDeleteConfirmDialog } from '@/components/contacts/dialogs/BranchDeleteConfirmDialog';
import { AddressWithHierarchy } from '@/components/shared/addresses/AddressWithHierarchy';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import { SharedAddressActionCard } from '@/components/shared/addresses/SharedAddressActionCard';
import type { CompanyAddress } from '@/types/ContactFormTypes';
import type { ContactType } from '@/types/contacts';
import { getDefaultSecondaryAddressType, type ContactAddressType } from '@/types/contacts/address-types';
import { AddressTypeSelector } from '@/components/contacts/addresses/AddressTypeSelector';
import { resolveContactAddressLabel } from '@/components/contacts/addresses/contactAddressLabel';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// TYPES
// ============================================================================

interface CompanyAddressesSectionProps {
  addresses: CompanyAddress[];
  disabled?: boolean;
  onChange: (addresses: CompanyAddress[]) => void;
  hideAddButton?: boolean;
  hideSectionTitle?: boolean;
  /**
   * ADR-319: contact type drives which address-type keys are allowed in the
   * per-branch selector. Falls back to company semantics when omitted.
   */
  contactType?: ContactType;
}

export interface CompanyAddressesSectionHandle {
  addBranch: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function createEmptyBranch(contactType?: ContactType): CompanyAddress {
  return {
    // ADR-319: default branch type respects the contact scope
    // (`office` for individuals, `branch` for company/service).
    type: getDefaultSecondaryAddressType(contactType),
    street: '',
    number: '',
    postalCode: '',
    city: '',
  };
}

function toHierarchyValue(addr: CompanyAddress): Partial<AddressWithHierarchyValue> {
  return {
    street: addr.street,
    number: addr.number,
    postalCode: addr.postalCode,
    country: addr.country ?? '',
    settlementName: addr.city,
    settlementId: addr.settlementId ?? null,
    communityName: addr.communityName ?? '',
    municipalUnitName: addr.municipalUnitName ?? '',
    municipalityName: addr.municipalityName ?? '',
    municipalityId: addr.municipalityId ?? null,
    regionalUnitName: addr.regionalUnitName ?? '',
    regionName: addr.regionName ?? addr.region ?? '',
    decentAdminName: addr.decentAdminName ?? '',
    majorGeoName: addr.majorGeoName ?? '',
  };
}

function fromHierarchyValue(existing: CompanyAddress, val: AddressWithHierarchyValue): CompanyAddress {
  return {
    ...existing,
    street: val.street,
    number: val.number,
    postalCode: val.postalCode,
    city: val.settlementName || val.municipalityName,
    settlementId: val.settlementId,
    communityName: val.communityName,
    municipalUnitName: val.municipalUnitName,
    municipalityName: val.municipalityName,
    municipalityId: val.municipalityId,
    regionalUnitName: val.regionalUnitName,
    regionName: val.regionName,
    region: val.regionName,
    decentAdminName: val.decentAdminName,
    majorGeoName: val.majorGeoName,
    country: val.country || undefined,
  };
}

function formatBranchStreetLine(addr: CompanyAddress): string {
  const parts = [addr.street, addr.number, addr.city, addr.postalCode].filter(Boolean);
  return parts.join(', ');
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const CompanyAddressesSection = forwardRef<CompanyAddressesSectionHandle, CompanyAddressesSectionProps>(function CompanyAddressesSection({
  addresses,
  disabled = false,
  onChange,
  hideAddButton = false,
  hideSectionTitle = false,
  contactType,
}, ref) {
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);
  const { t: tAddr } = useTranslation('addresses');
  const tAddrFn = React.useCallback((key: string) => tAddr(key) as string, [tAddr]);
  const colors = useSemanticColors();
  const [branchDeleteIndex, setBranchDeleteIndex] = useState<number | null>(null);
  const [editingBranchIndex, setEditingBranchIndex] = useState<number | null>(null);

  // Close inline form when global edit mode ends
  React.useEffect(() => {
    if (disabled) setEditingBranchIndex(null);
  }, [disabled]);

  const isEditing = !disabled;

  // ADR-319: HQ is always index 0 (positional invariant across contact types).
  const effectiveHqIndex = 0;
  const branches = addresses.filter((_, i) => i !== effectiveHqIndex);

  const handleBranchUpdate = useCallback(
    (branchVisualIndex: number, updated: CompanyAddress) => {
      const newAddresses = [...addresses];
      let branchCount = 0;
      for (let i = 0; i < newAddresses.length; i++) {
        if (i === effectiveHqIndex) continue;
        if (branchCount === branchVisualIndex) {
          newAddresses[i] = updated;
          onChange(newAddresses);
          return;
        }
        branchCount++;
      }
    },
    [addresses, effectiveHqIndex, onChange],
  );

  const addBranch = useCallback(() => {
    const newAddresses = [...addresses, createEmptyBranch(contactType)];
    onChange(newAddresses);
    // Auto-open inline edit for the new branch
    setEditingBranchIndex(branches.length);
  }, [addresses, branches.length, contactType, onChange]);

  useImperativeHandle(ref, () => ({ addBranch }), [addBranch]);

  const removeBranch = useCallback(
    (branchVisualIndex: number) => {
      const updated = [...addresses];
      let branchCount = 0;
      for (let i = 0; i < updated.length; i++) {
        if (i === effectiveHqIndex) continue;
        if (branchCount === branchVisualIndex) {
          updated.splice(i, 1);
          onChange(updated);
          return;
        }
        branchCount++;
      }
    },
    [addresses, effectiveHqIndex, onChange],
  );

  return (
    <div className="space-y-6">
      {!hideSectionTitle && <Separator />}

      <section aria-label={t('contacts-form:addressesSection.branchesTitle')}>
        <header className="flex items-center justify-between mb-3">
          {!hideSectionTitle && (
            <h3 className="text-lg font-semibold text-foreground">
              {t('contacts-form:addressesSection.branchesTitle')} ({branches.length})
            </h3>
          )}
          {!hideAddButton && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addBranch}
              disabled={disabled}
            >
              <Plus className="mr-1 h-4 w-4" />
              {t('contacts-form:addressesSection.addAddress')}
            </Button>
          )}
        </header>

        {branches.length > 0 && (
          <ul className="space-y-4">
            {branches.map((addr, i) => (
              <li key={i} className="space-y-3">
                {editingBranchIndex === i ? (
                  /* Inline edit form */
                  <div className="border-2 border-primary rounded-lg p-3 space-y-3">
                    <div className="flex items-center">
                      <AddressTypeSelector
                        contactType={contactType}
                        value={addr.type}
                        customLabel={addr.customLabel}
                        disabled={disabled}
                        onChange={(next) => handleBranchUpdate(i, { ...addr, type: next.type, customLabel: next.customLabel })}
                      />
                    </div>
                    <AddressWithHierarchy
                      value={toHierarchyValue(addr)}
                      onChange={(val) => handleBranchUpdate(i, fromHierarchyValue(addr, val))}
                      disabled={disabled}
                    />
                    <div className="flex justify-end border-t pt-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditingBranchIndex(null)}
                      >
                        {tAddr('deleteDialog.cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Card view */
                  <SharedAddressActionCard
                    id={`branch-${i}`}
                    streetLine={formatBranchStreetLine(addr)}
                    typeLabel={resolveContactAddressLabel(addr.type, addr.customLabel, tAddrFn)}
                    isEditing={isEditing}
                    onEdit={() => setEditingBranchIndex(i)}
                    onDelete={() => setBranchDeleteIndex(i)}
                    editLabel={t('contacts-form:addressesSection.editAddress')}
                    deleteLabel={t('contacts-form:addressesSection.removeAddress')}
                  />
                )}
                {i < branches.length - 1 && <Separator />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <BranchDeleteConfirmDialog
        open={branchDeleteIndex !== null}
        onOpenChange={(open) => { if (!open) setBranchDeleteIndex(null); }}
        onConfirm={() => {
          if (branchDeleteIndex !== null) {
            removeBranch(branchDeleteIndex);
            setBranchDeleteIndex(null);
          }
        }}
      />
    </div>
  );
});

export default CompanyAddressesSection;
