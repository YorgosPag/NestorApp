'use client';

/**
 * ADR-581 — «Αντιγραφή Ιδιοτήτων» modal (Radix Dialog SSoT, ADR-001).
 *
 * Δένεται με τον deterministic πυρήνα μέσω `useMatchProperties`. Δείχνει:
 *   - σύνοψη πλήθους στόχων,
 *   - checklist ρόλων ανά κατηγορία (habit default προεπιλεγμένο),
 *   - mapping preview (πάντα ορατό — χρήσιμο και σε same-type),
 *   - footer με Άκυρο / Εφαρμογή.
 * Αν δεν υπάρχει έγκυρη πηγή+στόχοι → μήνυμα + μόνο Άκυρο.
 */

import React, { Suspense, useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import { USE_AI_MATCH_PROPERTIES } from '../../config/feature-flags';
import { MatchAiPrompt } from '../../app/dxf-viewer-lazy-components';
import { useMatchProperties } from './useMatchProperties';
import { MatchChecklist } from './MatchChecklist';
import { MatchMappingPreview } from './match-mapping-preview';
import styles from './match-properties-dialog.module.css';

interface MatchSettingsDialogProps {
  readonly levelManager: LevelsHookReturn;
  readonly onClose: () => void;
}

export const MatchSettingsDialog: React.FC<MatchSettingsDialogProps> = ({
  levelManager,
  onClose,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const match = useMatchProperties({ levelManager, onClose });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) match.cancel();
    },
    [match],
  );

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('matchProperties.title')}</DialogTitle>
        </DialogHeader>

        {match.ready ? (
          <div className={styles.body}>
            <p className={styles.summary}>
              {t('matchProperties.targetsLabel', { count: match.targetCount })}
            </p>
            {USE_AI_MATCH_PROPERTIES ? (
              <Suspense fallback={null}>
                <MatchAiPrompt
                  offeredRoles={match.offeredRoles}
                  sourceType={match.sourceType}
                  targetTypes={match.targetTypes}
                  onResolve={match.applyAiRoles}
                />
              </Suspense>
            ) : null}
            <MatchChecklist
              groups={match.groups}
              selectedRoles={match.selectedRoles}
              toggleRole={match.toggleRole}
              setCategoryRoles={match.setCategoryRoles}
            />
            <MatchMappingPreview previews={match.previews} isCrossType={match.isCrossType} />
          </div>
        ) : (
          <p className={styles.empty}>{t('matchProperties.noSelection')}</p>
        )}

        <DialogFooter>
          <div className={styles.footerActions}>
            <Button variant="ghost" onClick={match.cancel}>
              {t('matchProperties.cancel')}
            </Button>
            {match.ready ? (
              <Button variant="default" onClick={match.apply}>
                {t('matchProperties.apply')}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
