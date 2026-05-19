'use client';

/**
 * ADR-345 Fase 5.5 — Host wrapper for FindReplaceDialog from the ribbon
 * text editor contextual tab.
 *
 * Encapsulates the three heavy dependencies that FindReplaceDialog needs
 * (sceneManager, layerProvider, entities) so DxfViewerContent stays clean.
 * Renders null when no level is active (services = null).
 */

import React, { useCallback, useMemo } from 'react';
import { FindReplaceDialog } from './FindReplaceDialog';
import { useDxfTextServices } from './hooks/useDxfTextServices';
import { useCurrentSceneModel } from './hooks/useCurrentSceneModel';
import { getGlobalCommandHistory } from '../../core/commands';
import type { ICommand } from '../../core/commands/interfaces';
import type { DxfTextSceneEntity } from '../../core/commands/text';
import type { Entity } from '../../types/entities';

interface DxfFindReplaceHostProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

function isTextEntity(e: Entity): e is DxfTextSceneEntity {
  return e.type === 'text' || e.type === 'mtext';
}

export function DxfFindReplaceHost({ open, onOpenChange }: DxfFindReplaceHostProps) {
  const services = useDxfTextServices();
  const scene = useCurrentSceneModel();

  const entities = useMemo(
    () => (scene ? scene.entities.filter(isTextEntity) : []),
    [scene],
  );

  const onExecuteCommand = useCallback((cmd: ICommand) => {
    getGlobalCommandHistory().execute(cmd);
  }, []);

  if (!services) return null;

  return (
    <FindReplaceDialog
      open={open}
      onOpenChange={onOpenChange}
      entities={entities}
      sceneManager={services.sceneManager}
      layerProvider={services.layerProvider}
      onExecuteCommand={onExecuteCommand}
    />
  );
}
