'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Project } from '@/types/project';
import type { PlotFrontage } from '@/types/project-building-code';
import { FrontageAddressCreateDialog } from './FrontageAddressCreateDialog';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';

interface FrontageAddressSelectorProps {
  frontage: PlotFrontage;
  project: Project | null;
  isEditing: boolean;
  onChange(index: number, addressId: string | undefined): void;
}

function formatAddressOption(addr: { street?: string; number?: string; city: string }): string {
  const parts: string[] = [];
  if (addr.street) parts.push(addr.street);
  if (addr.number) parts.push(addr.number);
  if (addr.city) parts.push(addr.city);
  return parts.join(', ');
}

export function FrontageAddressSelector({
  frontage,
  project,
  isEditing,
  onChange,
}: FrontageAddressSelectorProps) {
  const { t } = useTranslation('buildingCode');
  const [dialogOpen, setDialogOpen] = useState(false);

  const addresses = project?.addresses ?? [];
  const currentAddress = addresses.find((a) => a.id === frontage.addressId);
  const addressDeleted = frontage.addressId && !currentAddress;

  const handleSelectChange = (value: string) => {
    if (value === SELECT_CLEAR_VALUE) {
      onChange(frontage.index, undefined);
    } else {
      onChange(frontage.index, value);
    }
  };

  const handleCreated = (newAddressId: string) => {
    onChange(frontage.index, newAddressId);
  };

  if (!isEditing) {
    return (
      <p className="text-sm text-muted-foreground">
        {addressDeleted
          ? <span className="text-destructive">{t('frontages.addressDeleted')}</span>
          : currentAddress
            ? formatAddressOption(currentAddress)
            : <span className="italic">{t('frontages.noAddress')}</span>
        }
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        {addressDeleted ? (
          <p className="text-sm text-destructive">{t('frontages.addressDeleted')}</p>
        ) : (
          <Select
            value={frontage.addressId ?? SELECT_CLEAR_VALUE}
            onValueChange={handleSelectChange}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={t('frontages.addressPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_CLEAR_VALUE}>
                <span className="text-muted-foreground">{t('frontages.noAddress')}</span>
              </SelectItem>
              {addresses.map((addr) => (
                <SelectItem key={addr.id} value={addr.id}>
                  {formatAddressOption(addr)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {frontage.addressId ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 shrink-0"
          onClick={() => onChange(frontage.index, undefined)}
          aria-label={t('frontages.noAddress')}
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5"
          onClick={() => setDialogOpen(true)}
          disabled={!project}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('frontages.addAddress')}
        </Button>
      )}

      {project && (
        <FrontageAddressCreateDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          project={project}
          frontageIndex={frontage.index}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
