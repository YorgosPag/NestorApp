'use client';
import { useCallback } from 'react';
import { useLevels } from '../systems/levels';
import type { ImportWizardState } from '../systems/levels';

export type WizardStep = ImportWizardState['step'];

export interface WizardNavigationActions {
  handleNext: () => void;
  handleBack: () => void;
  handleClose: () => void;
  canProceed: () => boolean;
  getStepInfo: () => {
    title: string;
    number: number;
    totalSteps: number;
  };
}

interface UseWizardNavigationProps {
  onComplete: () => void;
  onClose: () => void;
}

export function useWizardNavigation({ onComplete, onClose }: UseWizardNavigationProps): WizardNavigationActions {
  const { 
    importWizard, 
    setImportWizardStep, 
    completeImport,
    cancelImportWizard 
  } = useLevels();

  const step = importWizard.step;
  const selectedLevelId = importWizard.selectedLevelId;
  const newLevelName = importWizard.newLevelName;

  const handleNext = useCallback(() => {

    switch (step) {
      case 'level':
        setImportWizardStep?.('units');
        break;
      case 'units':
        setImportWizardStep?.('calibration');
        break;
      case 'calibration':
        setImportWizardStep?.('preview');
        break;
      case 'preview':
        completeImport?.();
        onComplete();
        break;
      default:
        console.warn('⚠️ Unknown step in handleNext:', step);
    }
  }, [step, setImportWizardStep, completeImport, onComplete]);

  const handleBack = useCallback(() => {

    switch (step) {
      case 'units':
        setImportWizardStep?.('level');
        break;
      case 'calibration':
        setImportWizardStep?.('units');
        break;
      case 'preview':
        setImportWizardStep?.('calibration');
        break;
      case 'level':
        break;
      default:
        console.warn('⚠️ Unknown step in handleBack:', step);
    }
  }, [step, setImportWizardStep]);

  const handleClose = useCallback(() => {

    cancelImportWizard?.();
    onClose();
  }, [cancelImportWizard, onClose]);

  const canProceed = useCallback((): boolean => {

    switch (step) {
      case 'level':
        const hasSelection = !!(selectedLevelId || newLevelName?.trim());
        return hasSelection;
      case 'units':
        // Units selection always allows proceed (auto-detect is valid default)
        return true;
      case 'calibration':
        return true;
      case 'preview':
        return true;
      default:
        console.warn('⚠️ Unknown step in canProceed:', step);
        return false;
    }
  }, [step, selectedLevelId, newLevelName]);

  const getStepInfo = useCallback(() => {
    const stepTitles: Record<WizardStep, string> = {
      level: 'Επιλογή Επιπέδου',
      units: 'Μονάδες Σχεδίου',
      calibration: 'Βαθμονόμηση (Προαιρετική)',
      preview: 'Προεπισκόπηση & Εισαγωγή',
      complete: 'Ολοκλήρωση',
    };

    const stepNumbers: Record<WizardStep, number> = {
      level: 1,
      units: 2,
      calibration: 3,
      preview: 4,
      complete: 5,
    };

    return {
      title: stepTitles[step] || 'Εισαγωγή DXF',
      number: stepNumbers[step] || 1,
      totalSteps: 4
    };
  }, [step]);

  return {
    handleNext,
    handleBack,
    handleClose,
    canProceed,
    getStepInfo
  };
}
