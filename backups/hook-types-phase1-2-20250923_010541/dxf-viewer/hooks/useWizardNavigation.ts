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
    console.log('🧙‍♂️ handleNext called, current step:', step);
    
    switch (step) {
      case 'level':
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
    console.log('🧙‍♂️ handleBack called, current step:', step);
    
    switch (step) {
      case 'calibration':
        setImportWizardStep?.('level');
        break;
      case 'preview':
        setImportWizardStep?.('calibration');
        break;
      case 'level':
        // Already at first step, do nothing
        break;
      default:
        console.warn('⚠️ Unknown step in handleBack:', step);
    }
  }, [step, setImportWizardStep]);

  const handleClose = useCallback(() => {
    console.log('🧙‍♂️ Wizard cancelled');
    cancelImportWizard?.();
    onClose();
  }, [cancelImportWizard, onClose]);

  const canProceed = useCallback((): boolean => {
    console.log('🧙‍♂️ canProceed check:', { step, selectedLevelId, newLevelName });

    switch (step) {
      case 'level':
        const hasSelection = !!(selectedLevelId || newLevelName?.trim());
        console.log('🧙‍♂️ Level step - hasSelection:', hasSelection);
        return hasSelection;
      case 'calibration':
        // Calibration is optional, always allow proceed
        return true;
      case 'preview':
        // Preview step should always allow proceed (final step)
        return true;
      default:
        console.warn('⚠️ Unknown step in canProceed:', step);
        return false;
    }
  }, [step, selectedLevelId, newLevelName]);

  const getStepInfo = useCallback(() => {
    const stepTitles: Record<WizardStep, string> = {
      level: 'Επιλογή Επιπέδου',
      calibration: 'Βαθμονόμηση (Προαιρετική)',
      preview: 'Προεπισκόπηση & Εισαγωγή',
      complete: 'Ολοκλήρωση',
    };

    const stepNumbers: Record<WizardStep, number> = {
      level: 1,
      calibration: 2,
      preview: 3,
      complete: 4,
    };

    return {
      title: stepTitles[step] || 'Εισαγωγή DXF',
      number: stepNumbers[step] || 1,
      totalSteps: 3
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
