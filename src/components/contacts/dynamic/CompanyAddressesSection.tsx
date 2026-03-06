'use client';

/**
 * ============================================================================
 * CompanyAddressesSection — Multi-address Section for Company Contacts
 * ============================================================================
 *
 * Supports multiple addresses: headquarters (always present) + N branches.
 * Pattern inspired by ContactKadSection (multi-KAD).
 *
 * @module components/contacts/dynamic/CompanyAddressesSection
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
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

// ============================================================================
// SUB-COMPONENT: Single address card
// ============================================================================

interface AddressCardProps {
  address: CompanyAddress;
  index: number;
  isHeadquarters: boolean;
  disabled: boolean;
  onFieldChange: (index: number, field: keyof CompanyAddress, value: string) => void;
  onRemove?: (index: number) => void;
}

function AddressCard({ address, index, isHeadquarters, disabled, onFieldChange, onRemove }: AddressCardProps) {
  const { t } = useTranslation('forms');

  return (
    <article className="rounded-lg border p-4 space-y-3">
      <header className="flex items-center justify-between">
        {isHeadquarters ? (
          <h4 className="text-sm font-semibold text-foreground">
            {t('addresses.typeHeadquarters')}
          </h4>
        ) : (
          <Select
            value={address.type}
            onValueChange={(val) => onFieldChange(index, 'type', val)}
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
        )}
        {!isHeadquarters && onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            disabled={disabled}
            aria-label={t('addresses.removeAddress')}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <fieldset className="space-y-1">
          <Label>{t('addresses.street')}</Label>
          <Input
            value={address.street}
            onChange={(e) => onFieldChange(index, 'street', e.target.value)}
            disabled={disabled}
          />
        </fieldset>
        <fieldset className="space-y-1">
          <Label>{t('addresses.number')}</Label>
          <Input
            value={address.number}
            onChange={(e) => onFieldChange(index, 'number', e.target.value)}
            disabled={disabled}
          />
        </fieldset>
        <fieldset className="space-y-1">
          <Label>{t('addresses.postalCode')}</Label>
          <Input
            value={address.postalCode}
            onChange={(e) => onFieldChange(index, 'postalCode', e.target.value)}
            maxLength={5}
            disabled={disabled}
          />
        </fieldset>
        <fieldset className="space-y-1">
          <Label>{t('addresses.city')}</Label>
          <Input
            value={address.city}
            onChange={(e) => onFieldChange(index, 'city', e.target.value)}
            disabled={disabled}
          />
        </fieldset>
      </div>
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

  // Headquarters = first entry with type 'headquarters', or first entry, or empty
  const hqIndex = addresses.findIndex((a) => a.type === 'headquarters');
  const effectiveHqIndex = hqIndex >= 0 ? hqIndex : 0;
  const headquarters: CompanyAddress = addresses[effectiveHqIndex] ?? {
    type: 'headquarters',
    street: '',
    number: '',
    postalCode: '',
    city: '',
  };
  const branches = addresses.filter((_, i) => i !== effectiveHqIndex);

  const handleFieldChange = useCallback(
    (index: number, field: keyof CompanyAddress, value: string) => {
      const updated = [...addresses];
      // Map visual index back to array index
      const actualIndex = index === 0 ? effectiveHqIndex : addresses.indexOf(branches[index - 1]);
      if (actualIndex >= 0 && actualIndex < updated.length) {
        updated[actualIndex] = { ...updated[actualIndex], [field]: value };
        onChange(updated);
      }
    },
    [addresses, effectiveHqIndex, branches, onChange],
  );

  const handleHqFieldChange = useCallback(
    (_index: number, field: keyof CompanyAddress, value: string) => {
      const updated = [...addresses];
      if (effectiveHqIndex < updated.length) {
        updated[effectiveHqIndex] = { ...updated[effectiveHqIndex], [field]: value };
      } else {
        // No HQ yet — create one
        updated.unshift({ ...headquarters, [field]: value });
      }
      onChange(updated);
    },
    [addresses, effectiveHqIndex, headquarters, onChange],
  );

  const handleBranchFieldChange = useCallback(
    (branchVisualIndex: number, field: keyof CompanyAddress, value: string) => {
      const updated = [...addresses];
      // branches array is addresses without HQ
      let branchCount = 0;
      for (let i = 0; i < updated.length; i++) {
        if (i === effectiveHqIndex) continue;
        if (branchCount === branchVisualIndex) {
          updated[i] = { ...updated[i], [field]: value };
          onChange(updated);
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
      {/* Headquarters — always present */}
      <section aria-label={t('addresses.headquarters')}>
        <AddressCard
          address={headquarters}
          index={0}
          isHeadquarters
          disabled={disabled}
          onFieldChange={handleHqFieldChange}
        />
      </section>

      <Separator />

      {/* Branches / Additional */}
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
                <AddressCard
                  address={addr}
                  index={i}
                  isHeadquarters={false}
                  disabled={disabled}
                  onFieldChange={handleBranchFieldChange}
                  onRemove={removeBranch}
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
