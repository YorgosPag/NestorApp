'use client';

/**
 * ============================================================================
 * CompanyAddressesSection - Multi-address Section for Company Contacts
 * ============================================================================
 *
 * Supports multiple addresses: headquarters (always present) + N branches.
 * Each branch uses AddressWithHierarchy for consistent address entry
 * with Greek administrative hierarchy support.
 *
 * @module components/contacts/dynamic/CompanyAddressesSection
 */

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/design-system';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2 } from 'lucide-react';
import { BranchDeleteConfirmDialog } from '@/components/contacts/dialogs/BranchDeleteConfirmDialog';
import { AddressWithHierarchy } from '@/components/shared/addresses/AddressWithHierarchy';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import type { CompanyAddress } from '@/types/ContactFormTypes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface CompanyAddressesSectionProps {
  addresses: CompanyAddress[];
  disabled?: boolean;
  onChange: (addresses: CompanyAddress[]) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function createEmptyBranch(): CompanyAddress {
  return {
    type: 'branch',
    street: '',
    number: '',
    postalCode: '',
    city: '',
  };
}

/** Map CompanyAddress to AddressWithHierarchyValue */
function toHierarchyValue(addr: CompanyAddress): Partial<AddressWithHierarchyValue> {
  return {
    street: addr.street,
    number: addr.number,
    postalCode: addr.postalCode,
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

/** Map AddressWithHierarchyValue back to CompanyAddress fields */
function fromHierarchyValue(
  existing: CompanyAddress,
  val: AddressWithHierarchyValue
): CompanyAddress {
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
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CompanyAddressesSection({
  addresses,
  disabled = false,
  onChange,
}: CompanyAddressesSectionProps) {
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);
  const colors = useSemanticColors();
  const [branchDeleteIndex, setBranchDeleteIndex] = useState<number | null>(null);
  // Headquarters = first entry with type 'headquarters', or first entry
  const hqIndex = addresses.findIndex((a) => a.type === 'headquarters');
  const effectiveHqIndex = hqIndex >= 0 ? hqIndex : 0;
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
    onChange([...addresses, createEmptyBranch()]);
  }, [addresses, onChange]);

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
      <Separator />

      {/* Branches / Additional Addresses */}
      <section aria-label={t('contacts-form:addressesSection.branchesTitle')}>
        <header className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t('contacts-form:addressesSection.branchesTitle')}
          </h3>
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
        </header>

        {branches.length === 0 ? (
          <p className={cn("text-sm py-2 text-center", colors.text.muted)}>
            {t('contacts-form:addressesSection.noBranches')}
          </p>
        ) : (
          <ul className="space-y-4">
            {branches.map((addr, i) => (
              <li key={i} className="space-y-3">
                <header className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">
                    {t('contacts-form:addressesSection.branch')} {branches.length > 1 ? `#${i + 1}` : ''}
                  </h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setBranchDeleteIndex(i)}
                    disabled={disabled}
                    aria-label={t('contacts-form:addressesSection.removeAddress')}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </header>
                <AddressWithHierarchy
                  value={toHierarchyValue(addr)}
                  onChange={(val) => handleBranchUpdate(i, fromHierarchyValue(addr, val))}
                  disabled={disabled}
                />
                {i < branches.length - 1 && <Separator />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 📍 Branch delete confirmation (ADR-277 Safety) */}
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
}

export default CompanyAddressesSection;
