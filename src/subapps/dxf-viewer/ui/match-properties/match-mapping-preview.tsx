'use client';

/**
 * ADR-581 — Mapping preview: ανά διακριτό targetType δείχνει τις αντιστοιχίσεις
 * πηγή→στόχος των επιλεγμένων ρόλων, με confidence badge + λόγο αντιστοίχισης,
 * και τις consistency προειδοποιήσεις. Χρήσιμο και σε same-type (επιβεβαίωση).
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { MatchTargetPreview, MatchPreviewRow } from './match-dialog-model';
import styles from './match-properties-dialog.module.css';

interface MatchMappingPreviewProps {
  readonly previews: readonly MatchTargetPreview[];
  readonly isCrossType: boolean;
}

export const MatchMappingPreview: React.FC<MatchMappingPreviewProps> = ({ previews }) => {
  const { t } = useTranslation('dxf-viewer-shell');

  return (
    <section className={styles.preview}>
      <h3 className={styles.previewTitle}>{t('matchProperties.previewTitle')}</h3>
      {previews.length === 0 ? (
        <p className={styles.previewEmpty}>{t('matchProperties.previewEmpty')}</p>
      ) : (
        previews.map((preview) => (
          <PreviewGroup key={preview.targetType} preview={preview} />
        ))
      )}
    </section>
  );
};

interface PreviewGroupProps {
  readonly preview: MatchTargetPreview;
}

const PreviewGroup: React.FC<PreviewGroupProps> = ({ preview }) => {
  const { t } = useTranslation('dxf-viewer-shell');

  const typeLabel = t(`matchProperties.entityType.${preview.targetType}`, {
    defaultValue: preview.targetType,
  });

  return (
    <article className={styles.previewGroup}>
      <h4 className={styles.previewGroupHeader}>
        {t('matchProperties.targetTypeHeading', { type: typeLabel, count: preview.count })}
      </h4>
      <ul className={styles.previewRows}>
        {preview.rows.map((row) => (
          <PreviewRow key={String(row.role)} row={row} />
        ))}
      </ul>
      {preview.warningKeys.length > 0 ? (
        <ul className={styles.warnings}>
          {preview.warningKeys.map((key) => (
            <li key={key} className={styles.warning}>
              <mark>{t(key)}</mark>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
};

interface PreviewRowProps {
  readonly row: MatchPreviewRow;
}

const PreviewRow: React.FC<PreviewRowProps> = ({ row }) => {
  const { t } = useTranslation('dxf-viewer-shell');

  return (
    <li className={styles.previewRow}>
      <span>{t(row.sourceLabelKey)}</span>
      <span className={styles.mapArrow} aria-hidden="true">→</span>
      <span className={styles.mapTarget}>{t(row.targetLabelKey)}</span>
      <span className={styles.confidence}>{Math.round(row.confidence * 100)}%</span>
      <span className={styles.reason}>{t(`matchProperties.reason.${row.reason}`)}</span>
    </li>
  );
};
