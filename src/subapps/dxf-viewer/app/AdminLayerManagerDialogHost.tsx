'use client';

/**
 * ADR-391 — Mount host for the AdminLayerManagerDialog.
 *
 * Lives in DxfViewerContent so it can access `levelManager.saveContext` for
 * project context (projectId / project name fed to AdminLayerManager filters).
 * Visibility owned by AdminLayerManagerDialogStore (zero React state here).
 */

import React from 'react';
import { AdminLayerManagerDialog } from '../ui/components/AdminLayerManagerDialog';

interface AdminLayerManagerDialogHostProps {
  projectId?: string | null;
  projectName?: string;
}

export const AdminLayerManagerDialogHost: React.FC<AdminLayerManagerDialogHostProps> = ({
  projectId = null,
  projectName = '',
}) => {
  return <AdminLayerManagerDialog projectId={projectId} projectName={projectName} />;
};
