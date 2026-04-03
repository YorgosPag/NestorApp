import { useCallback, useState } from 'react';
import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import type { DialogState } from './construction-gantt-types';

const INITIAL_DIALOG_STATE: DialogState = {
  open: false,
  mode: 'createPhase',
};

export function useConstructionGanttDialog() {
  const [dialogState, setDialogState] = useState<DialogState>(INITIAL_DIALOG_STATE);

  const openCreatePhaseDialog = useCallback(() => {
    setDialogState({ open: true, mode: 'createPhase' });
  }, []);

  const openEditPhaseDialog = useCallback((phase: ConstructionPhase) => {
    setDialogState({ open: true, mode: 'editPhase', phase });
  }, []);

  const openCreateTaskDialog = useCallback((phaseId: string) => {
    setDialogState({ open: true, mode: 'createTask', phaseId });
  }, []);

  const openEditTaskDialog = useCallback((task: ConstructionTask) => {
    setDialogState({ open: true, mode: 'editTask', task });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogState(INITIAL_DIALOG_STATE);
  }, []);

  return {
    dialogState,
    openCreatePhaseDialog,
    openEditPhaseDialog,
    openCreateTaskDialog,
    openEditTaskDialog,
    closeDialog,
  };
}
