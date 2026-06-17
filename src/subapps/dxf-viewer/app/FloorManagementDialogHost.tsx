'use client';

/**
 * Mount host για το FloorManagementDialog.
 *
 * Ζει στο DxfViewerDialogs ώστε να αντλεί το ενεργό `buildingId` από τα levels του
 * level manager (ίδια πηγή με το `projectId`). Visibility owned by
 * FloorManagementDialogStore (zero React state εδώ). Mirror του
 * AdminLayerManagerDialogHost.
 */

import React from 'react';
import { FloorManagementDialog } from '../ui/components/FloorManagementDialog';

interface FloorManagementDialogHostProps {
  buildingId?: string | null;
}

export const FloorManagementDialogHost: React.FC<FloorManagementDialogHostProps> = ({
  buildingId = null,
}) => {
  return <FloorManagementDialog buildingId={buildingId} />;
};
