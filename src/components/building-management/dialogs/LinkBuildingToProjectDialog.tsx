'use client';

/**
 * =============================================================================
 * ENTERPRISE: LinkBuildingToProjectDialog Component
 * =============================================================================
 *
 * Inline fix modal for orphan Buildings (ADR-284 §3.3 Phase 3b).
 *
 * Scope-limited by design:
 *   - Only assigns `projectId` to the Building (NOT a full edit).
 *   - Used when AddPropertyDialog detects a selected Building without project.
 *
 * Flow: user clicks "Σύνδεσέ το τώρα" → this dialog → POST
 * /api/buildings/[id]/link-project → atomic transaction on server.
 *
 * @module components/building-management/dialogs/LinkBuildingToProjectDialog
 * @enterprise ADR-284 §3.3 Phase 3b — Inline fix modal for orphan Buildings
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { FormField, FormGrid, FormInput } from '@/components/ui/form/FormComponents';
import { SaveButton, CancelButton } from '@/components/ui/form/ActionButtons';
import { Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DIALOG_SIZES } from '@/styles/design-tokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { ProjectListItem } from '@/components/building-management/building-services';

// =============================================================================
// TYPES
// =============================================================================

export interface LinkBuildingToProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buildingId: string;
  buildingName: string;
  projects: ProjectListItem[];
  projectsLoading?: boolean;
  onSuccess?: (projectId: string) => void;
}

interface LinkProjectApiResponse {
  success: boolean;
  data?: {
    buildingId: string;
    projectId: string;
    linked: true;
  };
  error?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function LinkBuildingToProjectDialog({
  open,
  onOpenChange,
  buildingId,
  buildingName,
  projects,
  projectsLoading = false,
  onSuccess,
}: LinkBuildingToProjectDialogProps) {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const { success, error: notifyError } = useNotifications();
  const iconSizes = useIconSizes();

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedProjectId('');
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const handleProjectChange = useCallback((value: string) => {
    setSelectedProjectId(value);
    if (error) setError(null);
  }, [error]);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedProjectId) {
      setError(t('dialog.linkBuildingToProject.validation.projectRequired'));
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post<LinkProjectApiResponse>(
        API_ROUTES.BUILDINGS.LINK_PROJECT(buildingId),
        { projectId: selectedProjectId },
      );

      if (response?.success === false) {
        throw new Error(response.error || 'Failed to link Building to Project');
      }

      success(t('dialog.linkBuildingToProject.messages.success'));
      onSuccess?.(selectedProjectId);
      onOpenChange(false);
    } catch (err) {
      const message =
        ApiClientError.isApiClientError(err)
          ? err.message
          : err instanceof Error
            ? err.message
            : '';
      setError(
        t('dialog.linkBuildingToProject.messages.error') +
          (message ? `: ${message}` : ''),
      );
      notifyError(t('dialog.linkBuildingToProject.messages.error'));
    } finally {
      setLoading(false);
    }
  }, [buildingId, onOpenChange, onSuccess, selectedProjectId, t, success, notifyError]);

  const canSubmit = !loading && !!selectedProjectId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_SIZES.md)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className={iconSizes.md} />
            {t('dialog.linkBuildingToProject.title')}
          </DialogTitle>
          <DialogDescription>
            {t('dialog.linkBuildingToProject.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FormGrid>
            <FormField
              label={t('dialog.linkBuildingToProject.buildingLabel')}
              htmlFor="linkBuilding-name"
            >
              <FormInput>
                <Input
                  id="linkBuilding-name"
                  value={buildingName}
                  readOnly
                  disabled
                />
              </FormInput>
            </FormField>

            <FormField
              label={t('dialog.linkBuildingToProject.projectLabel')}
              htmlFor="linkBuilding-project"
              required
            >
              <FormInput>
                <Select
                  value={selectedProjectId}
                  onValueChange={handleProjectChange}
                  disabled={loading || projectsLoading}
                >
                  <SelectTrigger
                    id="linkBuilding-project"
                    className={error ? 'border-destructive' : ''}
                  >
                    <SelectValue
                      placeholder={t(
                        'dialog.linkBuildingToProject.projectPlaceholder',
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {error ? (
                  <p className="mt-1 text-xs text-destructive">{error}</p>
                ) : null}
              </FormInput>
            </FormField>
          </FormGrid>

          <DialogFooter className="mt-4">
            <CancelButton
              onClick={() => onOpenChange(false)}
              disabled={loading}
            />
            <SaveButton loading={loading} disabled={!canSubmit} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default LinkBuildingToProjectDialog;
