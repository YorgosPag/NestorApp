'use client';

import React, { useCallback, useState, useImperativeHandle, forwardRef } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AddressWithHierarchy } from '@/components/shared/addresses/AddressWithHierarchy';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import { SharedAddressActionCard } from '@/components/shared/addresses/SharedAddressActionCard';
import type { IndividualAddress, IndividualAddressType } from '@/types/ContactFormTypes';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// =============================================================================
// TYPES
// =============================================================================

interface IndividualAddressesSectionProps {
  addresses: IndividualAddress[];
  disabled?: boolean;
  onChange: (addresses: IndividualAddress[]) => void;
  hideAddButton?: boolean;
  hideSectionTitle?: boolean;
}

export interface IndividualAddressesSectionHandle {
  addAddress: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

const EXTRA_ADDRESS_TYPES: IndividualAddressType[] = ['work', 'vacation', 'other'];

function createEmptyAddress(type: IndividualAddressType = 'work'): IndividualAddress {
  return { type, street: '', number: '', postalCode: '', city: '' };
}

function toHierarchyValue(addr: IndividualAddress): Partial<AddressWithHierarchyValue> {
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

function fromHierarchyValue(existing: IndividualAddress, val: AddressWithHierarchyValue): IndividualAddress {
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

function formatStreetLine(addr: IndividualAddress): string {
  return [addr.street, addr.number, addr.city, addr.postalCode].filter(Boolean).join(', ');
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const IndividualAddressesSection = forwardRef<IndividualAddressesSectionHandle, IndividualAddressesSectionProps>(
  function IndividualAddressesSection({ addresses, disabled = false, onChange, hideAddButton = false, hideSectionTitle = false }, ref) {
    const { t: tAddr } = useTranslation('addresses');
    const { t: tForm } = useTranslation('contacts-form');
    const colors = useSemanticColors();

    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    React.useEffect(() => {
      if (disabled) setEditingIndex(null);
    }, [disabled]);

    const isEditing = !disabled;

    const extraAddresses = addresses.filter((_, i) => i > 0);

    const typeLabel = useCallback((type: IndividualAddressType) => tAddr(`types.${type}`) || type, [tAddr]);

    const handleUpdate = useCallback((extraIdx: number, updated: IndividualAddress) => {
      const newAll = [...addresses];
      newAll[extraIdx + 1] = updated;
      onChange(newAll);
    }, [addresses, onChange]);

    const addAddress = useCallback(() => {
      const newAll = [...addresses, createEmptyAddress('work')];
      onChange(newAll);
      setEditingIndex(extraAddresses.length);
    }, [addresses, extraAddresses.length, onChange]);

    const removeAddress = useCallback((extraIdx: number) => {
      const newAll = addresses.filter((_, i) => i !== extraIdx + 1);
      onChange(newAll);
      setEditingIndex(null);
    }, [addresses, onChange]);

    useImperativeHandle(ref, () => ({ addAddress }), [addAddress]);

    return (
      <div className="space-y-4">
        {!hideSectionTitle && <Separator />}

        <section aria-label={tAddr('types.individual')}>
          <header className="flex items-center justify-between mb-3">
            {!hideSectionTitle && (
              <h3 className="text-lg font-semibold text-foreground">
                {tAddr('types.individual')} ({extraAddresses.length})
              </h3>
            )}
            {!hideAddButton && (
              <Button type="button" variant="outline" size="sm" onClick={addAddress} disabled={disabled}>
                <Plus className="mr-1 h-4 w-4" />
                {tAddr('locations.newAddress')}
              </Button>
            )}
          </header>

          {extraAddresses.length === 0 ? (
            <p className={cn('text-sm py-2 text-center', colors.text.muted)}>
              {tAddr('list.empty')}
            </p>
          ) : (
            <ul className="space-y-4">
              {extraAddresses.map((addr, i) => (
                <li key={i} className="space-y-3">
                  {editingIndex === i ? (
                    <div className="border-2 border-primary rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <Select
                          value={addr.type}
                          disabled={disabled}
                          onValueChange={(val) => handleUpdate(i, { ...addr, type: val as IndividualAddressType })}
                        >
                          <SelectTrigger className="w-40 h-8 text-sm font-semibold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXTRA_ADDRESS_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingIndex(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <AddressWithHierarchy
                        value={toHierarchyValue(addr)}
                        onChange={(val) => handleUpdate(i, fromHierarchyValue(addr, val))}
                        disabled={disabled}
                      />
                      <div className="flex justify-end border-t pt-3">
                        <Button type="button" variant="outline" onClick={() => setEditingIndex(null)}>
                          {tAddr('deleteDialog.cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <SharedAddressActionCard
                      id={`individual-extra-${i}`}
                      streetLine={formatStreetLine(addr)}
                      typeLabel={typeLabel(addr.type)}
                      isEditing={isEditing}
                      onEdit={() => setEditingIndex(i)}
                      onDelete={() => removeAddress(i)}
                      editLabel={tForm('addressesSection.editAddress')}
                      deleteLabel={tForm('addressesSection.removeAddress')}
                    />
                  )}
                  {i < extraAddresses.length - 1 && <Separator />}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }
);
