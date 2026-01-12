'use client';

import React from 'react';
import { CommonBadge } from '@/core/badges';
import { Button } from '@/components/ui/button';
import { useButtonPatterns } from '@/hooks/useButtonPatterns';
import { useIconSizes } from '@/hooks/useIconSizes';
import { formatDateTime } from '@/lib/intl-utils';
import { Edit, Save, X, CheckCircle } from 'lucide-react';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface HeaderProps {
    building: { id: string; category: string };
    isEditing: boolean;
    autoSaving: boolean;
    lastSaved: Date | null;
    setIsEditing: (isEditing: boolean) => void;
    handleSave: () => void;
}

export function Header({ building, isEditing, autoSaving, lastSaved, setIsEditing, handleSave }: HeaderProps) {
  // 🏢 ENTERPRISE: Centralized systems
  const { t } = useTranslation('building');
  const buttonPatterns = useButtonPatterns();
  const iconSizes = useIconSizes();

  // 🏢 ENTERPRISE: i18n-enabled category label mapping
  const getCategoryLabel = (category: string): string => {
    const categoryKey = `categories.${category}`;
    return t(categoryKey);
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <CommonBadge
          status="company"
          customLabel={`ID: ${building.id}`}
          variant="secondary"
          size="sm"
          className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
        />
        <CommonBadge
          status="company"
          customLabel={getCategoryLabel(building.category)}
          variant="outline"
          size="sm"
        />

        {isEditing && (
          <div className="flex items-center gap-2 text-xs">
            {autoSaving ? (
              <>
                <AnimatedSpinner size="small" />
                <span className="text-blue-600">{t('tabs.general.header.saving')}</span>
              </>
            ) : lastSaved ? (
              <>
                <CheckCircle className={`${iconSizes.xs} text-green-600`} />
                <span className="text-green-600">
                  {t('tabs.general.header.saved')} {lastSaved ? formatDateTime(lastSaved, { timeStyle: 'medium' }).split(' ')[1] : '--'}
                </span>
              </>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!isEditing ? (
          <Button {...buttonPatterns.actions.edit} onClick={() => setIsEditing(true)}>
            <Edit className={`${iconSizes.sm} mr-2`} />
            {t('tabs.general.header.edit')}
          </Button>
        ) : (
          <>
            <Button {...buttonPatterns.actions.cancel} onClick={() => setIsEditing(false)}>
              <X className={`${iconSizes.sm} mr-2`} />
              {t('tabs.general.header.cancel')}
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className={`${iconSizes.sm} mr-2`} />
              {t('tabs.general.header.save')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
