'use client';

import '@/lib/design-system';
import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ContactsFilterBarProps {
  showOnlyOwners: boolean;
  onShowOnlyOwnersChange: (checked: boolean) => void;
}

export function ContactsFilterBar({ showOnlyOwners, onShowOnlyOwnersChange }: ContactsFilterBarProps) {
  const { t } = useTranslation('contacts');

  return (
    <div className="px-4 py-2 border-b">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="show-owners-only"
          checked={showOnlyOwners}
          onCheckedChange={(checked) => onShowOnlyOwnersChange(!!checked)}
        />
        <Label htmlFor="show-owners-only" className="text-sm font-medium">
          {t('filterBar.showOnlyWithProperties')}
        </Label>
      </div>
    </div>
  );
}
