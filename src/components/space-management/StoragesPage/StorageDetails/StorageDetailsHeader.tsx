'use client';

import React from 'react';
import { Warehouse } from 'lucide-react';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import type { Storage } from '@/types/storage/contracts';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('StorageDetailsHeader');

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
            createEntityAction('view', t('header.viewStorage'), () => logger.info('Show storage details')),
            createEntityAction('edit', t('header.edit'), () => logger.info('Edit storage')),
            createEntityAction('print', t('header.print'), () => logger.info('Print storage details')),
          ]}
          variant="detailed"
        />
      </div>

      {/* 📱 MOBILE: Hidden (no header duplication) */}
    </>
  );
}
