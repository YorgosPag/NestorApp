'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface PanelLabelProps {
  labelKey: string;
  onExpand?: () => void;
  expanded?: boolean;
}

export const PanelLabel: React.FC<PanelLabelProps> = ({
  labelKey,
  onExpand,
  expanded = false,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <div className="dxf-ribbon-panel-label">
      <span>{t(labelKey)}</span>
      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={expanded}
          aria-label={t('ribbon.ariaLabels.expandPanel')}
        >
          {expanded ? '▴' : '▾'}
        </button>
      )}
    </div>
  );
};
