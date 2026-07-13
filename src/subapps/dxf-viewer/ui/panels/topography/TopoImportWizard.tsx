'use client';
/**
 * ADR-650 Milestone 2 — «Εισαγωγή σημείων» wizard (Q9).
 *
 * Three steps — source → mapping → confirm — with the mapping step skipped for DXF, which
 * already carries world coordinates (see `useTopoImport`). All state lives in that hook;
 * this file is markup + wiring only.
 *
 * Reuses the existing generic `WizardProgress` stepper. It does NOT reuse `ui/ImportWizard`:
 * that shell is bound to `useLevels` (level/units/calibration steps) and predates N.3/N.11
 * (inline Tailwind + hardcoded Greek), so consuming it would import those violations.
 *
 * i18n: every string via `t()` (N.11). Styles: CSS module (N.3). Semantic structure (N.4).
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import { X } from 'lucide-react';
import { WizardProgress } from '../../components/WizardProgress';
import { TopoColumnMapStep } from './TopoColumnMapStep';
import { useTopoImport } from './useTopoImport';
import type { TopoSurfaceId } from '../../../systems/topography/topo-types';
import styles from './TopoImportWizard.module.css';

/** Everything a surveyor might drop on us: point files, spreadsheets, or a drawing. */
const ACCEPT = '.csv,.txt,.xyz,.pts,.dat,.xlsx,.xlsm,.dxf';

const TOTAL_STEPS = 3;
const STEP_NUMBER = { source: 1, mapping: 2, confirm: 3 } as const;

interface Props {
  readonly onClose: () => void;
  /** Fired after the points land in the store, so the panel can report the count. */
  readonly onImported: (count: number) => void;
  /** ADR-650 M6 — which surface the points land in. Defaults to the surveyed ground. */
  readonly surface?: TopoSurfaceId;
}

export function TopoImportWizard({ onClose, onImported, surface = 'existing' }: Props): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const wizard = useTopoImport(surface);
  const { step } = wizard;

  const onFile = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void wizard.loadFile(file);
  }, [wizard]);

  const onImport = React.useCallback(() => {
    onImported(wizard.commit());
    onClose();
  }, [wizard, onImported, onClose]);

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={t('topography.import.title')}>
      <div className={styles.dialog}>
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>{t('topography.import.title')}</h2>
            <p className={styles.subtitle}>
              {t('topography.import.stepOf', { step: STEP_NUMBER[step], total: TOTAL_STEPS })}
              {wizard.fileName ? ` · ${wizard.fileName}` : ''}
            </p>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label={t('topography.import.close')}>
            <X size={16} />
          </button>
        </header>

        <WizardProgress currentStep={STEP_NUMBER[step]} totalSteps={TOTAL_STEPS} />

        <main className={styles.body}>
          {step === 'source' && (
            <section className={styles.step}>
              <p className={styles.hint}>{t('topography.import.sourceHint')}</p>
              <input type="file" className={styles.input} accept={ACCEPT} onChange={onFile} disabled={wizard.busy} />
              {wizard.busy && <p className={styles.status}>{t('topography.import.reading')}</p>}
              {wizard.error && <p className={`${styles.status} ${styles.statusError}`}>{t('topography.import.error.read')}</p>}
            </section>
          )}

          {step === 'mapping' && <TopoColumnMapStep wizard={wizard} />}

          {step === 'confirm' && (
            <section className={styles.step}>
              <p className={styles.summary}>{t('topography.import.confirmCount', { count: wizard.points.length })}</p>
              {wizard.skippedCount > 0 && (
                <p className={styles.status}>{t('topography.import.previewSkipped', { count: wizard.skippedCount })}</p>
              )}
              <p className={styles.hint}>{t('topography.import.confirmHint')}</p>
            </section>
          )}
        </main>

        <footer className={styles.footer}>
          <button type="button" className={styles.button} onClick={wizard.back} disabled={step === 'source'}>
            {t('topography.import.back')}
          </button>
          {step === 'confirm' ? (
            <button type="button" className={styles.primaryButton} onClick={onImport} disabled={!wizard.canProceed}>
              {t('topography.import.import')}
            </button>
          ) : (
            <button type="button" className={styles.primaryButton} onClick={wizard.next} disabled={step === 'source' || !wizard.canProceed}>
              {t('topography.import.next')}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
