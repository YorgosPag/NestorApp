'use client';

import { useState } from 'react';
import { Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Project } from '@/types/project';
import { useProjectBuildingCode } from '@/hooks/useProjectBuildingCode';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { BuildingCodeForm } from './BuildingCodeForm';

interface BuildingCodeTabProps {
  project?: Project | null;
  data?: Project | null;
}

export function BuildingCodeTab({ project, data }: BuildingCodeTabProps) {
  const projectData = project ?? data ?? null;
  const hook = useProjectBuildingCode(projectData);
  const { t } = useTranslation('buildingCode');
  const [isEditing, setIsEditing] = useState(false);

  const handleStartEdit = () => setIsEditing(true);

  const handleCancel = () => {
    hook.reset();
    setIsEditing(false);
  };

  const handleSave = async () => {
    const ok = await hook.save();
    if (ok) setIsEditing(false);
  };

  return (
    <section className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{t('form.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('form.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isEditing ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={hook.isSaving}
                className="gap-1.5"
              >
                <X className="h-4 w-4" aria-hidden />
                {t('editMode.cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSave()}
                disabled={!hook.canSave}
                className="gap-1.5"
              >
                <Save className="h-4 w-4" aria-hidden />
                {hook.isSaving ? t('editMode.saving') : t('editMode.save')}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleStartEdit}
              className="gap-1.5"
            >
              <Pencil className="h-4 w-4" aria-hidden />
              {t('editMode.edit')}
            </Button>
          )}
        </div>
      </div>

      <BuildingCodeForm hook={hook} isEditing={isEditing} project={projectData} />
    </section>
  );
}

export default BuildingCodeTab;
