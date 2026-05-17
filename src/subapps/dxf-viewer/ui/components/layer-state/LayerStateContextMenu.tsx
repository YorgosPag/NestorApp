'use client';

import * as React from 'react';
import { useTranslation } from '@/i18n';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

export interface LayerStateContextMenuActions {
  readonly onRename: (id: string) => void;
  readonly onEditCategory: (id: string) => void;
  readonly onDuplicate: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

export interface LayerStateContextMenuProps {
  readonly stateId: string;
  readonly children: React.ReactNode;
  readonly actions: LayerStateContextMenuActions;
}

export function LayerStateContextMenu({
  stateId,
  children,
  actions,
}: LayerStateContextMenuProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => actions.onRename(stateId)}
          data-testid={`ctx-rename-${stateId}`}
        >
          {t('layerState.manage.contextMenu.rename')}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => actions.onEditCategory(stateId)}
          data-testid={`ctx-edit-category-${stateId}`}
        >
          {t('layerState.manage.contextMenu.editCategory')}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => actions.onDuplicate(stateId)}
          data-testid={`ctx-duplicate-${stateId}`}
        >
          {t('layerState.manage.contextMenu.duplicate')}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => actions.onDelete(stateId)}
          className="text-destructive focus:text-destructive"
          data-testid={`ctx-delete-${stateId}`}
        >
          {t('layerState.manage.contextMenu.delete')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
