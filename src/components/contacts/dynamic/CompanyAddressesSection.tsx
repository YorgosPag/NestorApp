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

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { AddressWithHierarchy } from '@/components/shared/addresses/AddressWithHierarchy';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import type { CompanyAddress } from '@/types/ContactFormTypes';

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
// SUB-COMPONENT: Single branch card with AddressWithHierarchy
// ============================================================================

interface BranchCardProps {
  address: CompanyAddress;
  index: number;
  disabled: boolean;
  onChange: (updated: CompanyAddress) => void;
  onRemove: () => void;
  onTypeChange: (type: string) => void;
}

function BranchCard({ address, index, disabled, onChange, onRemove, onTypeChange }: BranchCardProps) {
  const { t } = useTranslation('forms');

  return (
    <article className="rounded-lg border p-4 space-y-3">
      <header className="flex items-center justify-between">
        <Select
          value={address.type}
          onValueChange={onTypeChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('addresses.type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="headquarters">{t('addresses.typeHeadquarters')}</SelectItem>
            <SelectItem value="branch">{t('addresses.typeBranch')}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={disabled}
          aria-label={t('addresses.removeAddress')}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </header>

      <AddressWithHierarchy
        value={toHierarchyValue(address)}
        onChange={(val) => onChange(fromHierarchyValue(address, val))}
        disabled={disabled}
      />
    </article>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CompanyAddressesSection({
  addresses,
  disabled = false,
  onChange,
}: CompanyAddressesSectionProps) {
  const { t } = useTranslation('forms');

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

  const handleBranchTypeChange = useCallback(
    (branchVisualIndex: number, type: string) => {
      const newAddresses = [...addresses];
      let branchCount = 0;
      for (let i = 0; i < newAddresses.length; i++) {
        if (i === effectiveHqIndex) continue;
        if (branchCount === branchVisualIndex) {
          newAddresses[i] = { ...newAddresses[i], type: type as 'headquarters' | 'branch' };
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
    <fieldset className="space-y-6" disabled={disabled}>
      <Separator />

      {/* Branches / Additional Addresses */}
      <section aria-label={t('addresses.additionalAddresses')}>
        <header className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t('addresses.additionalAddresses')}
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addBranch}
            disabled={disabled}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t('addresses.addAddress')}
          </Button>
        </header>

        {branches.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t('addresses.noAdditional')}
          </p>
        ) : (
          <ul className="space-y-3">
            {branches.map((addr, i) => (
              <li key={i}>
                <BranchCard
                  address={addr}
                  index={i}
                  disabled={disabled}
                  onChange={(updated) => handleBranchUpdate(i, updated)}
                  onRemove={() => removeBranch(i)}
                  onTypeChange={(type) => handleBranchTypeChange(i, type)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </fieldset>
  );
}

export default CompanyAddressesSection;
