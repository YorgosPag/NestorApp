/* eslint-disable design-system/enforce-semantic-colors */
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { useButtonPatterns } from '@/hooks/useButtonPatterns';
import { useIconSizes } from '@/hooks/useIconSizes';
import { Edit, Save, X } from 'lucide-react';
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

interface HeaderProps {
    building: { id: string };
    isEditing: boolean;
    /** Τρέχει η ρητή «Αποθήκευση» (ADR-248 §2.5: καμία αυτόματη εγγραφή όσο γράφει ο άνθρωπος). */
    saving: boolean;
    setIsEditing: (isEditing: boolean) => void;
    handleSave: () => void;
    /** When true, Edit/Save/Cancel buttons are hidden (parent header controls them) */
    hideEditControls?: boolean;
}

export function Header({ isEditing, saving, setIsEditing, handleSave, hideEditControls }: HeaderProps) {
  const { t } = useTranslation('building');
  const buttonPatterns = useButtonPatterns();
  const iconSizes = useIconSizes();

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {isEditing && saving && (
          <div className="flex items-center gap-2 text-xs">
            <AnimatedSpinner size="small" />
            <span className="text-primary">{t('tabs.general.header.saving')}</span>
          </div>
        )}
      </div>

      {/* Edit controls only when NOT parent-controlled */}
      {!hideEditControls && (
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
      )}
    </div>
  );
}
