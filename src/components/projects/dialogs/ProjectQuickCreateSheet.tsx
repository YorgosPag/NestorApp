'use client';

/**
 * =============================================================================
 * ENTERPRISE: ProjectQuickCreateSheet — SSoT project creation from any context
 * =============================================================================
 *
 * Slide-over Sheet that embeds the canonical <ProjectDetails> editor in
 * create mode. Used whenever the user needs to create a project from a
 * context other than the main /projects page (e.g. while creating a
 * property or linking a building).
 *
 * Why a Sheet + the real editor (not a custom modal)?
 *   • **Single Source of Truth (Google pattern)**: Create = Edit. The EXACT
 *     same component, fields, labels, validation, and save path. Impossible
 *     for the two flows to diverge.
 *   • Any change to the project editor (new field, renamed label, new
 *     validation rule) applies here automatically.
 *   • Replaces the legacy `AddProjectDialog` which had diverged from the
 *     main editor (different fields, different labels, stale company-link).
 *
 * @module components/projects/dialogs/ProjectQuickCreateSheet
 * @enterprise "Fill then Create" pattern (Salesforce / Procore / SAP)
 */

import React, { useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ProjectDetails } from '@/components/projects/project-details';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Project } from '@/types/project';
import { DIALOG_SCROLL } from '@/styles/design-tokens';

const TEMP_PROJECT_ID = '__new__';

export interface ProjectQuickCreateSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Fired with the real Firestore project ID after successful creation */
  readonly onProjectCreated?: (projectId: string) => void;
}

/**
 * Builds the temp-project template used to drive the editor in create mode.
 * Mirrors the template from `projects-page-content.tsx` (SSoT source).
 */
function buildTempProject(): Project & { companyName: string } {
  return {
    id: TEMP_PROJECT_ID,
    name: '',
    title: '',
    description: '',
    status: 'planning',
    companyId: '',
    company: '',
    companyName: '',
    address: '',
    city: '',
    location: '',
    projectCode: '',
    progress: 0,
    totalValue: 0,
    totalArea: 0,
    lastUpdate: new Date().toISOString(),
  };
}

export function ProjectQuickCreateSheet({
  open,
  onOpenChange,
  onProjectCreated,
}: ProjectQuickCreateSheetProps) {
  const { t } = useTranslation(['projects', 'projects-data', 'projects-ika']);

  // 🏢 Reset the template each time the sheet opens — guarantees a clean form
  const tempProject = useMemo(() => (open ? buildTempProject() : null), [open]);

  const handleProjectCreated = useCallback((realProjectId: string) => {
    onProjectCreated?.(realProjectId);
    onOpenChange(false);
  }, [onProjectCreated, onOpenChange]);

  const handleCancelCreate = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          // Wider than the default w-3/4 sm:max-w-sm — the real editor
          // has multiple sections and needs room to breathe.
          'w-[min(960px,96vw)] sm:max-w-none p-0 flex flex-col',
          DIALOG_SCROLL.scrollable,
        )}
      >
        <SheetHeader className="p-4 border-b">
          <SheetTitle>{t('header.addProjectTitle')}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {tempProject && (
            <ProjectDetails
              project={tempProject}
              isCreateMode
              onProjectCreated={handleProjectCreated}
              onCancelCreate={handleCancelCreate}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
