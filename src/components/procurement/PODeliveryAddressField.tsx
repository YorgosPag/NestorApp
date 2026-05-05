'use client';

/**
 * PODeliveryAddressField — Delivery address picker by type
 *
 * Address type selector + free text override.
 * User picks a type (Εργοτάξιο, Είσοδος, Παράδοση, ...) → autofill
 * il valore con l'indirizzo del progetto selezionato di quel tipo.
 *
 * ADR-332 Phase 8: when an address is picked from the project, expose its
 * provenance metadata (source label + freshness + has-coords) below the input
 * so the procurement operator knows the trust level of the autofill before
 * sending the PO. Editing the free-text input clears the badges (the typed
 * string can no longer be attributed to the original record).
 *
 * @see ADR-267 §Phase D — Entity Selectors (delivery address by type)
 * @see ADR-332 §3.10 / §10 Phase 8
 */

import { useCallback, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFirestoreProjects } from '@/hooks/useFirestoreProjects';
import {
  formatAddressLine,
  formatAddressType,
} from '@/types/project/address-helpers';
import type {
  ProjectAddress,
  ProjectAddressType,
} from '@/types/project/addresses';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  AddressSourceLabel,
  AddressFreshnessIndicator,
  AddressCoordsBadge,
  computeFreshness,
} from '@/components/shared/addresses/editor';

interface PODeliveryAddressFieldProps {
  projectId: string;
  value: string;
  onChange: (next: string) => void;
}

const NO_TYPE_VALUE = '__none__';

export function PODeliveryAddressField({
  projectId,
  value,
  onChange,
}: PODeliveryAddressFieldProps) {
  const { t: tProc } = useTranslation('procurement');
  const { t: tAddr } = useTranslation('addresses');
  const { projects } = useFirestoreProjects();
  const [chosenAddress, setChosenAddress] = useState<ProjectAddress | null>(null);

  const project = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  );

  const addresses: ProjectAddress[] = useMemo(
    () => (project?.addresses ?? []) as ProjectAddress[],
    [project],
  );

  const availableTypes = useMemo<ProjectAddressType[]>(() => {
    const set = new Set<ProjectAddressType>();
    for (const a of addresses) set.add(a.type);
    return Array.from(set);
  }, [addresses]);

  const handleTypeSelect = useCallback(
    (type: string) => {
      if (type === NO_TYPE_VALUE) {
        onChange('');
        setChosenAddress(null);
        return;
      }
      const candidates = addresses.filter((a) => a.type === type);
      const chosen = candidates.find((a) => a.isPrimary) ?? candidates[0] ?? null;
      if (chosen) {
        onChange(formatAddressLine(chosen));
        setChosenAddress(chosen);
      }
    },
    [addresses, onChange],
  );

  const handleFreeTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      setChosenAddress(null);
    },
    [onChange],
  );

  const hasProject = !!project;
  const hasOptions = availableTypes.length > 0;

  const freshness = useMemo(
    () => (chosenAddress ? computeFreshness(chosenAddress.verifiedAt) : null),
    [chosenAddress],
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[200px_1fr] md:gap-4">
        <div className="space-y-1.5">
          <Label>{tProc('form.deliveryAddressType')}</Label>
          <Select
            value=""
            onValueChange={handleTypeSelect}
            disabled={!hasProject || !hasOptions}
          >
            <SelectTrigger
              aria-label={tProc('form.deliveryAddressType')}
              disabled={!hasProject || !hasOptions}
            >
              <SelectValue
                placeholder={
                  !hasProject
                    ? tProc('form.deliveryAddressTypeNoProject')
                    : !hasOptions
                    ? tProc('form.deliveryAddressTypeNoOptions')
                    : tProc('form.deliveryAddressTypePlaceholder')
                }
              />
            </SelectTrigger>
            <SelectContent>
              {availableTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {formatAddressType(type)}
                </SelectItem>
              ))}
              <SelectItem value={NO_TYPE_VALUE}>
                {tProc('form.deliveryAddressTypeClear')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{tProc('form.deliveryAddress')}</Label>
          <Input
            value={value}
            onChange={handleFreeTextChange}
            placeholder={tProc('form.deliveryPlaceholder')}
          />
        </div>
      </div>

      {/* ADR-332 Phase 8 — provenance badges for the picked address */}
      {chosenAddress && freshness && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-muted-foreground">
            {tAddr('procurement.selectedFromAddress')}:
          </span>
          <AddressSourceLabel source={chosenAddress.source ?? 'unknown'} />
          <AddressFreshnessIndicator freshness={freshness} />
          <AddressCoordsBadge hasCoords={!!chosenAddress.coordinates} />
        </div>
      )}
    </div>
  );
}
