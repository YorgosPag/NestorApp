'use client';

import React from 'react';
import { Warehouse, Eye, Edit, FileText } from 'lucide-react';
import { EntityDetailsHeader } from '@/core/entity-headers';
import type { Storage } from '@/types/storage/contracts';
import { GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface StorageDetailsHeaderProps {
  storage: Storage;
}

export function StorageDetailsHeader({ storage }: StorageDetailsHeaderProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('storage');

  // Helper function for type labels using i18n
  const getTypeLabel = (type: Storage['type']) => {
    return t(`general.types.${type}`, t('general.unknown'));
  };

  return (
    <>
      {/* 🖥️ DESKTOP: Show full header with actions */}
      <div className="hidden md:block">
        <EntityDetailsHeader
          icon={Warehouse}
          title={storage.name}
          actions={[
            {
              label: t('header.viewStorage'),
              onClick: () => console.log('Show storage details'),
              icon: Eye,
              className: GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON
            },
            {
              label: t('header.edit'),
              onClick: () => console.log('Edit storage'),
              icon: Edit,
              variant: 'outline'
            },
            {
              label: t('header.print'),
              onClick: () => console.log('Print storage details'),
              icon: FileText,
              variant: 'outline'
            }
          ]}
          variant="detailed"
        />
      </div>

      {/* 📱 MOBILE: Hidden (no header duplication) */}
    </>
  );
}